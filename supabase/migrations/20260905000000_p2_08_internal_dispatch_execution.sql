-- P2-08: Idempotent Internal Dispatch and Execution Experience.
-- Canonical Task remains public.execution_tasks.
-- This migration creates a bounded 1:1 internal execution state record.
-- It does NOT create Outcome/Observation records and does NOT call external providers.

create table public.internal_task_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  task_id uuid not null references public.execution_tasks(id) on delete restrict,
  source_action_id uuid not null references public.material_action_proposals(id) on delete restrict,
  governance_evaluation_id uuid not null references public.material_action_governance_evaluations(id) on delete restrict,
  provider_key text not null default 'pmfreak/internal-state-machine:v1'
    check (provider_key = 'pmfreak/internal-state-machine:v1'),
  status text not null
    check (status in ('queued','running','blocked','failed','completed')),
  attempt_count integer not null default 1 check (attempt_count >= 1),
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240),
  correlation_id text not null,
  causation_id text,
  failure_class text,
  failure_message text,
  queued_at timestamptz not null,
  started_at timestamptz,
  blocked_at timestamptz,
  failed_at timestamptz,
  completed_at timestamptz,
  last_transition_at timestamptz not null,
  dispatched_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, task_id),
  unique (workspace_id, idempotency_key)
);

create index internal_task_executions_project_status_idx
  on public.internal_task_executions(project_id, status, updated_at desc);
create index internal_task_executions_action_idx
  on public.internal_task_executions(source_action_id);

alter table public.internal_task_executions enable row level security;

create policy internal_task_executions_scoped_select
  on public.internal_task_executions for select to authenticated
  using (public.can_access_operational_project(workspace_id, project_id));

revoke all on public.internal_task_executions from anon, authenticated;
grant select on public.internal_task_executions to authenticated;

create trigger set_internal_task_executions_updated_at
  before update on public.internal_task_executions
  for each row execute function public.set_updated_at();

-- Governed Task lifecycle state can only be changed by the P2-08 execution RPC.
create or replace function public.protect_governed_task_execution_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(old.source_payload ->> 'source', '') = 'governed_action'
     and row(old.status, old.progress_percent, old.start_date, old.completed_at)
         is distinct from
         row(new.status, new.progress_percent, new.start_date, new.completed_at)
     and coalesce(pg_catalog.current_setting('pmfreak.p2_08_internal_execution', true), '') <> '1' then
    raise exception 'governed_task_lifecycle_requires_internal_execution';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_governed_task_execution_state
  on public.execution_tasks;
create trigger protect_governed_task_execution_state
  before update of status, progress_percent, start_date, completed_at
  on public.execution_tasks
  for each row execute function public.protect_governed_task_execution_state();

-- P2-08 execution audit event names are reserved for the canonical RPC.
create or replace function public.protect_internal_execution_event_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_type like 'internal_execution_%'
     and coalesce(pg_catalog.current_setting('pmfreak.p2_08_internal_execution', true), '') <> '1' then
    raise exception 'internal_execution_event_provenance_required';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_internal_execution_event_provenance
  on public.execution_task_events;
create trigger protect_internal_execution_event_provenance
  before insert on public.execution_task_events
  for each row execute function public.protect_internal_execution_event_provenance();

-- New work gate used by both initial queue and active/resume/retry transitions.
-- The RPCs intentionally use the latest persisted governance evaluation.
create or replace function public.p2_08_validate_execution_governance(
  p_task_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.execution_tasks;
  v_action public.material_action_proposals;
  v_evaluation public.material_action_governance_evaluations;
  v_action_id uuid;
begin
  select * into v_task
  from public.execution_tasks
  where id = p_task_id;

  if v_task.id is null then
    return jsonb_build_object('allowed', false, 'failureClass', 'not_found', 'reason', 'task_not_found');
  end if;

  if coalesce(v_task.source_payload ->> 'source', '') <> 'governed_action' then
    return jsonb_build_object('allowed', false, 'failureClass', 'not_governed', 'reason', 'internal_execution_requires_governed_task');
  end if;

  if not public.can_write_operational_project(v_task.workspace_id, v_task.project_id) then
    return jsonb_build_object('allowed', false, 'failureClass', 'unauthorized', 'reason', 'internal_execution_write_denied');
  end if;

  begin
    v_action_id := nullif(v_task.source_payload ->> 'sourceActionId', '')::uuid;
  exception when others then
    return jsonb_build_object('allowed', false, 'failureClass', 'lineage_invalid', 'reason', 'source_action_reference_invalid');
  end;

  select * into v_action
  from public.material_action_proposals
  where id = v_action_id
    and workspace_id = v_task.workspace_id
    and project_id = v_task.project_id;

  if v_action.id is null then
    return jsonb_build_object('allowed', false, 'failureClass', 'lineage_invalid', 'reason', 'source_action_not_found');
  end if;

  if v_action.proposed_by <> p_actor then
    return jsonb_build_object('allowed', false, 'failureClass', 'actor_mismatch', 'reason', 'governed_action_actor_mismatch');
  end if;

  select * into v_evaluation
  from public.material_action_governance_evaluations
  where action_id = v_action.id
    and workspace_id = v_action.workspace_id
    and project_id = v_action.project_id
    and proposal_digest = v_action.proposal_digest
  order by evaluated_at desc, recorded_at desc
  limit 1;

  if v_evaluation.id is null then
    return jsonb_build_object('allowed', false, 'failureClass', 'governance_missing', 'reason', 'governance_evaluation_missing');
  end if;

  if v_action.expires_at <= pg_catalog.now() then
    return jsonb_build_object(
      'allowed', false,
      'failureClass', 'expired',
      'governanceState', v_evaluation.governance_state,
      'reason', 'action_expired'
    );
  end if;

  if v_evaluation.valid_until is not null
     and v_evaluation.valid_until <= pg_catalog.now() then
    return jsonb_build_object(
      'allowed', false,
      'failureClass', 'stale',
      'governanceState', v_evaluation.governance_state,
      'reason', 'governance_evaluation_stale'
    );
  end if;

  if not v_evaluation.can_commit_action
     or v_evaluation.governance_state not in ('authorized','not_required') then
    return jsonb_build_object(
      'allowed', false,
      'failureClass', 'governance_not_executable',
      'governanceState', v_evaluation.governance_state,
      'reason', 'governed_action_not_executable'
    );
  end if;

  if v_evaluation.governance_state = 'authorized'
     and (
       v_evaluation.policy_decision_reference is null
       or coalesce(pg_catalog.array_length(v_evaluation.grant_references, 1), 0) = 0
     ) then
    return jsonb_build_object(
      'allowed', false,
      'failureClass', 'governance_evidence_incomplete',
      'governanceState', v_evaluation.governance_state,
      'reason', 'policy_or_grant_reference_missing'
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'workspaceId', v_task.workspace_id,
    'projectId', v_task.project_id,
    'taskId', v_task.id,
    'actionId', v_action.id,
    'governanceEvaluationId', v_evaluation.id,
    'governanceState', v_evaluation.governance_state,
    'proposalDigest', v_action.proposal_digest,
    'correlationId', v_action.correlation_id,
    'causationId', v_action.causation_id,
    'policyReference', v_evaluation.policy_decision_reference,
    'grantReferences', to_jsonb(v_evaluation.grant_references)
  );
end;
$$;

revoke all on function public.p2_08_validate_execution_governance(uuid, uuid) from public;
-- intentionally no authenticated grant: only the bounded SECURITY DEFINER RPCs call it.

create or replace function public.dispatch_internal_task_execution(
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.execution_tasks;
  v_existing public.internal_task_executions;
  v_execution public.internal_task_executions;
  v_gate jsonb;
  v_now timestamptz := pg_catalog.now();
begin
  if v_actor is null then
    raise exception 'internal_execution_unauthenticated';
  end if;

  if p_task_id is null then
    raise exception 'internal_execution_task_required';
  end if;

  select * into v_task from public.execution_tasks where id = p_task_id;
  if v_task.id is null then
    return jsonb_build_object('disposition','denied','failureClass','not_found','reason','task_not_found');
  end if;

  if not public.can_write_operational_project(v_task.workspace_id, v_task.project_id) then
    return jsonb_build_object('disposition','denied','failureClass','unauthorized','reason','internal_execution_write_denied');
  end if;

  if coalesce(v_task.source_payload ->> 'source', '') <> 'governed_action' then
    return jsonb_build_object('disposition','denied','failureClass','not_governed','reason','internal_execution_requires_governed_task');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_task.workspace_id::text || ':internal-execution:' || v_task.id::text, 0)
  );

  -- Historical dispatch replay wins before current governance: revocation never erases evidence.
  select * into v_existing
  from public.internal_task_executions
  where workspace_id = v_task.workspace_id
    and task_id = v_task.id
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'disposition','existing',
      'execution',to_jsonb(v_existing),
      'task',to_jsonb(v_task),
      'idempotentReplay',true,
      'nonOutcome',jsonb_build_object('outcomeCreated',false,'observationCreated',false,'remoteAocWriteback',false)
    );
  end if;

  if v_task.status <> 'not_started' then
    return jsonb_build_object(
      'disposition','denied',
      'failureClass','invalid_task_state',
      'reason','new_internal_execution_requires_not_started_task'
    );
  end if;

  v_gate := public.p2_08_validate_execution_governance(v_task.id, v_actor);
  if not coalesce((v_gate ->> 'allowed')::boolean, false) then
    return jsonb_build_object(
      'disposition','denied',
      'failureClass',v_gate ->> 'failureClass',
      'governanceState',v_gate ->> 'governanceState',
      'reason',v_gate ->> 'reason'
    );
  end if;

  perform pg_catalog.set_config('pmfreak.p2_08_internal_execution', '1', true);

  insert into public.internal_task_executions(
    workspace_id,
    project_id,
    task_id,
    source_action_id,
    governance_evaluation_id,
    provider_key,
    status,
    attempt_count,
    idempotency_key,
    correlation_id,
    causation_id,
    queued_at,
    last_transition_at,
    dispatched_by
  )
  values(
    v_task.workspace_id,
    v_task.project_id,
    v_task.id,
    (v_gate ->> 'actionId')::uuid,
    (v_gate ->> 'governanceEvaluationId')::uuid,
    'pmfreak/internal-state-machine:v1',
    'queued',
    1,
    'internal-execution:' || v_task.id::text,
    v_gate ->> 'correlationId',
    v_gate ->> 'causationId',
    v_now,
    v_now,
    v_actor
  )
  returning * into v_execution;

  insert into public.execution_task_events(
    workspace_id, project_id, task_id, event_type, event_payload, actor_user_id
  )
  values(
    v_task.workspace_id,
    v_task.project_id,
    v_task.id,
    'internal_execution_queued',
    jsonb_build_object(
      'executionId', v_execution.id,
      'sourceActionId', v_execution.source_action_id,
      'governanceEvaluationId', v_execution.governance_evaluation_id,
      'previousExecutionState', null,
      'newExecutionState', 'queued',
      'attemptCount', v_execution.attempt_count,
      'providerKey', v_execution.provider_key,
      'correlationId', v_execution.correlation_id,
      'causationId', v_execution.causation_id,
      'outcomeCreated', false
    ),
    v_actor
  );

  return jsonb_build_object(
    'disposition','queued',
    'execution',to_jsonb(v_execution),
    'task',to_jsonb(v_task),
    'idempotentReplay',false,
    'nonOutcome',jsonb_build_object(
      'executionRecorded',true,
      'outcomeCreated',false,
      'observationCreated',false,
      'remoteAocWriteback',false
    )
  );
end;
$$;

revoke all on function public.dispatch_internal_task_execution(uuid) from public;
grant execute on function public.dispatch_internal_task_execution(uuid) to authenticated;

create or replace function public.transition_internal_task_execution(
  p_task_id uuid,
  p_command text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.execution_tasks;
  v_execution public.internal_task_executions;
  v_gate jsonb;
  v_command text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_command,'')));
  v_previous text;
  v_target text;
  v_event text;
  v_now timestamptz := pg_catalog.now();
  v_attempt integer;
begin
  if v_actor is null then
    raise exception 'internal_execution_unauthenticated';
  end if;

  if p_task_id is null then
    raise exception 'internal_execution_task_required';
  end if;

  if v_command not in ('start','block','fail','retry','complete') then
    return jsonb_build_object('disposition','denied','failureClass','validation_failed','reason','internal_execution_command_invalid');
  end if;

  select * into v_task from public.execution_tasks where id = p_task_id;
  if v_task.id is null then
    return jsonb_build_object('disposition','denied','failureClass','not_found','reason','task_not_found');
  end if;

  if not public.can_write_operational_project(v_task.workspace_id, v_task.project_id) then
    return jsonb_build_object('disposition','denied','failureClass','unauthorized','reason','internal_execution_write_denied');
  end if;

  if coalesce(v_task.source_payload ->> 'source', '') <> 'governed_action' then
    return jsonb_build_object('disposition','denied','failureClass','not_governed','reason','internal_execution_requires_governed_task');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_task.workspace_id::text || ':internal-execution:' || v_task.id::text, 0)
  );

  select * into v_execution
  from public.internal_task_executions
  where workspace_id = v_task.workspace_id
    and task_id = v_task.id
  for update;

  if v_execution.id is null then
    return jsonb_build_object('disposition','denied','failureClass','not_dispatched','reason','internal_execution_not_queued');
  end if;

  if v_execution.dispatched_by <> v_actor then
    return jsonb_build_object('disposition','denied','failureClass','actor_mismatch','reason','internal_execution_actor_mismatch');
  end if;

  v_previous := v_execution.status;

  -- Idempotent target-state replay.
  if (v_command = 'start' and v_previous = 'running')
     or (v_command = 'block' and v_previous = 'blocked')
     or (v_command = 'fail' and v_previous = 'failed')
     or (v_command = 'complete' and v_previous = 'completed')
     or (v_command = 'retry' and v_previous = 'queued' and v_execution.attempt_count > 1) then
    return jsonb_build_object(
      'disposition','existing',
      'execution',to_jsonb(v_execution),
      'task',to_jsonb(v_task),
      'idempotentReplay',true,
      'nonOutcome',jsonb_build_object('outcomeCreated',false,'observationCreated',false,'remoteAocWriteback',false)
    );
  end if;

  if v_command = 'start' and v_previous in ('queued','blocked') then
    v_target := 'running';
    v_event := 'internal_execution_started';
  elsif v_command = 'block' and v_previous in ('queued','running') then
    v_target := 'blocked';
    v_event := 'internal_execution_blocked';
  elsif v_command = 'fail' and v_previous in ('queued','running','blocked') then
    v_target := 'failed';
    v_event := 'internal_execution_failed';
  elsif v_command = 'retry' and v_previous = 'failed' then
    v_target := 'queued';
    v_event := 'internal_execution_retried';
  elsif v_command = 'complete' and v_previous = 'running' then
    v_target := 'completed';
    v_event := 'internal_execution_completed';
  else
    return jsonb_build_object(
      'disposition','denied',
      'failureClass','invalid_transition',
      'executionState',v_previous,
      'reason','internal_execution_transition_invalid'
    );
  end if;

  -- Starting/resuming and retrying authorize new work, so revalidate latest governance.
  if v_command in ('start','retry') then
    v_gate := public.p2_08_validate_execution_governance(v_task.id, v_actor);
    if not coalesce((v_gate ->> 'allowed')::boolean, false) then
      return jsonb_build_object(
        'disposition','denied',
        'failureClass',v_gate ->> 'failureClass',
        'governanceState',v_gate ->> 'governanceState',
        'executionState',v_previous,
        'reason',v_gate ->> 'reason'
      );
    end if;
  end if;

  perform pg_catalog.set_config('pmfreak.p2_08_internal_execution', '1', true);

  v_attempt := v_execution.attempt_count + case when v_command = 'retry' then 1 else 0 end;

  update public.internal_task_executions
  set
    status = v_target,
    attempt_count = v_attempt,
    governance_evaluation_id = case
      when v_command in ('start','retry') then (v_gate ->> 'governanceEvaluationId')::uuid
      else governance_evaluation_id
    end,
    failure_class = case when v_target = 'failed' then 'internal_execution_failed' when v_target = 'queued' then null else failure_class end,
    failure_message = case when v_target = 'failed' then 'Internal execution marked failed.' when v_target = 'queued' then null else failure_message end,
    queued_at = case when v_command = 'retry' then v_now else queued_at end,
    started_at = case when v_target = 'running' then v_now when v_command = 'retry' then null else started_at end,
    blocked_at = case when v_target = 'blocked' then v_now when v_target = 'running' or v_command = 'retry' then null else blocked_at end,
    failed_at = case when v_target = 'failed' then v_now when v_command = 'retry' then null else failed_at end,
    completed_at = case when v_target = 'completed' then v_now else completed_at end,
    last_transition_at = v_now
  where id = v_execution.id
  returning * into v_execution;

  if v_target = 'running' then
    update public.execution_tasks
    set
      status = 'in_progress',
      start_date = coalesce(start_date, v_now),
      updated_at = v_now
    where id = v_task.id
    returning * into v_task;
  elsif v_target = 'blocked' then
    if v_task.status = 'in_progress' then
      update public.execution_tasks
      set status = 'blocked', updated_at = v_now
      where id = v_task.id
      returning * into v_task;
    end if;
  elsif v_target = 'failed' then
    if v_task.status = 'in_progress' then
      update public.execution_tasks
      set status = 'blocked', updated_at = v_now
      where id = v_task.id
      returning * into v_task;
    end if;
  elsif v_target = 'completed' then
    update public.execution_tasks
    set
      status = 'completed',
      progress_percent = 100,
      completed_at = v_now,
      updated_at = v_now
    where id = v_task.id
    returning * into v_task;
  end if;

  insert into public.execution_task_events(
    workspace_id, project_id, task_id, event_type, event_payload, actor_user_id
  )
  values(
    v_task.workspace_id,
    v_task.project_id,
    v_task.id,
    v_event,
    jsonb_build_object(
      'executionId', v_execution.id,
      'sourceActionId', v_execution.source_action_id,
      'governanceEvaluationId', v_execution.governance_evaluation_id,
      'previousExecutionState', v_previous,
      'newExecutionState', v_target,
      'attemptCount', v_execution.attempt_count,
      'providerKey', v_execution.provider_key,
      'correlationId', v_execution.correlation_id,
      'causationId', v_execution.causation_id,
      'outcomeCreated', false
    ),
    v_actor
  );

  return jsonb_build_object(
    'disposition','transitioned',
    'execution',to_jsonb(v_execution),
    'task',to_jsonb(v_task),
    'idempotentReplay',false,
    'nonOutcome',jsonb_build_object(
      'executionRecorded',true,
      'outcomeCreated',false,
      'observationCreated',false,
      'remoteAocWriteback',false
    )
  );
end;
$$;

revoke all on function public.transition_internal_task_execution(uuid, text) from public;
grant execute on function public.transition_internal_task_execution(uuid, text) to authenticated;

comment on table public.internal_task_executions
  is 'P2-08 bounded internal execution lifecycle for canonical PMFreak Tasks. Not a Task model and not an Outcome.';
comment on function public.dispatch_internal_task_execution(uuid)
  is 'P2-08 idempotent governed Task -> queued internal execution boundary.';
comment on function public.transition_internal_task_execution(uuid, text)
  is 'P2-08 internal execution state transition boundary. Completion does not create Outcome.';