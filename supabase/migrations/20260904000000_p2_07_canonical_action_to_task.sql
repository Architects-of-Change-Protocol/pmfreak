-- P2-07: canonical governed Action -> exactly one internal PMFreak Task.
-- This migration does NOT execute work and does NOT create Outcomes/Observations.

-- Canonical governed provenance is stored in execution_tasks.source_payload to
-- avoid duplicating the existing Task model. The expression index is the durable
-- database invariant: one governed Action can map to at most one Task.
create unique index if not exists execution_tasks_governed_action_uidx
  on public.execution_tasks (workspace_id, ((source_payload ->> 'sourceActionId')))
  where source_payload ->> 'source' = 'governed_action'
    and nullif(source_payload ->> 'sourceActionId', '') is not null;

-- Ordinary/manual and legacy Task creation remain available. The canonical
-- governed provenance marker can only be written from the bounded RPC below.
-- This keeps the migration forward-only/additive and does not weaken existing RLS.
create or replace function public.protect_governed_execution_task_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     and coalesce(new.source_payload ->> 'source', '') = 'governed_action'
     and coalesce(pg_catalog.current_setting('pmfreak.p2_07_canonical_dispatch', true), '') <> '1' then
    raise exception 'governed_task_provenance_cannot_be_forged';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.source_payload ->> 'source', '') = 'governed_action'
     and new.source_payload is distinct from old.source_payload then
    raise exception 'governed_task_provenance_immutable';
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.source_payload ->> 'source', '') <> 'governed_action'
     and coalesce(new.source_payload ->> 'source', '') = 'governed_action' then
    raise exception 'governed_task_provenance_cannot_be_forged';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_governed_execution_task_provenance_insert
  on public.execution_tasks;
create trigger protect_governed_execution_task_provenance_insert
  before insert on public.execution_tasks
  for each row execute function public.protect_governed_execution_task_provenance();

drop trigger if exists protect_governed_execution_task_provenance_update
  on public.execution_tasks;
create trigger protect_governed_execution_task_provenance_update
  before update of source_payload on public.execution_tasks
  for each row execute function public.protect_governed_execution_task_provenance();

create or replace function public.dispatch_governed_action_to_internal_task(
  p_workspace_id uuid,
  p_project_id uuid,
  p_action_id uuid,
  p_expected_proposal_digest text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_action public.material_action_proposals;
  v_evaluation public.material_action_governance_evaluations;
  v_decision public.operational_decision_records;
  v_project public.projects;
  v_existing public.execution_tasks;
  v_task public.execution_tasks;
  v_priority text;
  v_title text;
  v_description text;
  v_source_payload jsonb;
begin
  if v_actor is null then
    raise exception 'action_task_unauthenticated';
  end if;

  if p_action_id is null or p_workspace_id is null or p_project_id is null then
    raise exception 'action_task_scope_required';
  end if;

  -- Scope is part of the lookup so wrong-tenant and wrong-project IDs do not
  -- expose whether the Action exists elsewhere.
  select *
    into v_action
    from public.material_action_proposals
   where id = p_action_id
     and workspace_id = p_workspace_id
     and project_id = p_project_id;

  if v_action.id is null then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'not_found',
      'reason', 'action_not_dispatchable'
    );
  end if;

  if not public.can_write_operational_project(v_action.workspace_id, v_action.project_id) then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'unauthorized',
      'reason', 'action_not_dispatchable'
    );
  end if;

  -- The P2-06 in-process grant is actor-scoped. Do not silently transfer it.
  if v_action.proposed_by <> v_actor then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'actor_mismatch',
      'reason', 'governed_action_actor_mismatch'
    );
  end if;

  if p_expected_proposal_digest is not null
     and p_expected_proposal_digest <> v_action.proposal_digest then
    return jsonb_build_object(
      'disposition', 'conflict',
      'failureClass', 'idempotency_conflict',
      'actionId', v_action.id,
      'proposalDigest', v_action.proposal_digest,
      'reason', 'action_task_proposal_digest_conflict'
    );
  end if;

  -- Serialize every dispatch attempt for one Action. Combined with the unique
  -- expression index this makes sequential and concurrent replay converge.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_action.workspace_id::text || ':action-task:' || v_action.id::text,
      0
    )
  );

  select *
    into v_existing
    from public.execution_tasks
   where workspace_id = v_action.workspace_id
     and source_payload ->> 'source' = 'governed_action'
     and source_payload ->> 'sourceActionId' = v_action.id::text
   limit 1;

  if v_existing.id is not null then
    insert into public.execution_task_events(
      workspace_id,
      project_id,
      task_id,
      event_type,
      event_payload,
      actor_user_id
    )
    values(
      v_existing.workspace_id,
      v_existing.project_id,
      v_existing.id,
      'governed_action_task_replayed',
      jsonb_build_object(
        'sourceActionId', v_action.id,
        'proposalDigest', v_action.proposal_digest,
        'correlationId', v_action.correlation_id,
        'causationId', v_action.causation_id,
        'idempotentReplay', true
      ),
      v_actor
    );

    return jsonb_build_object(
      'disposition', 'existing',
      'task', to_jsonb(v_existing),
      'sourceActionId', v_action.id,
      'idempotentReplay', true
    );
  end if;

  -- The latest persisted evaluation is authoritative. Revocation is append-only
  -- in P2-06, so an authorized Action revoked later resolves here as revoked.
  select *
    into v_evaluation
    from public.material_action_governance_evaluations
   where action_id = v_action.id
     and workspace_id = v_action.workspace_id
     and project_id = v_action.project_id
     and proposal_digest = v_action.proposal_digest
   order by evaluated_at desc, recorded_at desc
   limit 1;

  if v_evaluation.id is null then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'governance_missing',
      'reason', 'governance_evaluation_missing'
    );
  end if;

  if v_action.expires_at <= pg_catalog.now() then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'expired',
      'governanceState', v_evaluation.governance_state,
      'reason', 'action_expired'
    );
  end if;

  if v_evaluation.valid_until is not null
     and v_evaluation.valid_until <= pg_catalog.now() then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'stale',
      'governanceState', v_evaluation.governance_state,
      'reason', 'governance_evaluation_stale'
    );
  end if;

  if not v_evaluation.can_commit_action
     or v_evaluation.governance_state not in ('authorized', 'not_required') then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'governance_not_dispatchable',
      'governanceState', v_evaluation.governance_state,
      'reason', 'governed_action_not_dispatchable'
    );
  end if;

  -- Authorized material work must retain the policy/grant evidence that made it
  -- allowable. Ordinary "not_required" work still carries any available refs.
  if v_evaluation.governance_state = 'authorized'
     and (
       v_evaluation.policy_decision_reference is null
       or coalesce(pg_catalog.array_length(v_evaluation.grant_references, 1), 0) = 0
     ) then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'governance_evidence_incomplete',
      'governanceState', v_evaluation.governance_state,
      'reason', 'policy_or_grant_reference_missing'
    );
  end if;

  select *
    into v_decision
    from public.operational_decision_records
   where id = v_action.source_decision_id
     and workspace_id = v_action.workspace_id
     and project_id = v_action.project_id
     and decision_status in ('accepted', 'modified');

  if v_decision.id is null then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'source_decision_ineligible',
      'reason', 'source_decision_ineligible'
    );
  end if;

  if not exists (
    select 1
      from public.decision_evidence_links l
     where l.decision_record_id = v_decision.id
  ) then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'lineage_incomplete',
      'reason', 'decision_evidence_lineage_missing'
    );
  end if;

  select *
    into v_project
    from public.projects
   where id = v_action.project_id
     and workspace_id = v_action.workspace_id;

  if v_project.id is null or v_project.status = 'archived' then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'project_not_dispatchable',
      'reason', 'project_not_dispatchable'
    );
  end if;

  if not exists (
    select 1
      from public.workspace_memberships wm
     where wm.workspace_id = v_action.workspace_id
       and wm.user_id = v_action.proposed_by
  ) then
    return jsonb_build_object(
      'disposition', 'denied',
      'failureClass', 'actor_not_member',
      'reason', 'governed_action_actor_not_workspace_member'
    );
  end if;

  v_priority := case v_action.proposal ->> 'risk'
    when 'critical' then 'critical'
    when 'high' then 'high'
    when 'low' then 'low'
    else 'medium'
  end;

  v_title := pg_catalog.left(
    coalesce(
      nullif(pg_catalog.btrim(v_action.proposal ->> 'intendedEffect'), ''),
      nullif(pg_catalog.btrim(v_action.proposal ->> 'actionType'), ''),
      'Governed action task'
    ),
    200
  );

  v_description := pg_catalog.concat_ws(
    E'\n\n',
    nullif('Operation: ' || coalesce(v_action.proposal ->> 'intendedOperation', ''), 'Operation: '),
    nullif('Effect: ' || coalesce(v_action.proposal ->> 'intendedEffect', ''), 'Effect: '),
    nullif('Justification: ' || coalesce(v_action.proposal ->> 'justification', ''), 'Justification: ')
  );

  v_source_payload := jsonb_build_object(
    'source', 'governed_action',
    'schemaVersion', 'pmfreak.action-to-task.v1',
    'sourceActionId', v_action.id,
    'sourceDecisionId', v_action.source_decision_id,
    'sourceRecommendationId', v_decision.recommendation_id,
    'proposalDigest', v_action.proposal_digest,
    'governanceEvaluationId', v_evaluation.id,
    'governanceState', v_evaluation.governance_state,
    'governanceContractVersion', v_evaluation.contract_version,
    'policyReference', v_evaluation.policy_decision_reference,
    'grantReferences', to_jsonb(v_evaluation.grant_references),
    'obligationReferences', to_jsonb(v_evaluation.obligation_references),
    'approvalReferences', to_jsonb(v_evaluation.approval_references),
    'evidenceReferences', coalesce(v_action.proposal -> 'evidenceReferenceIds', '[]'::jsonb),
    'proposedActorId', v_action.proposed_by,
    'accountableActorId', v_action.proposal ->> 'accountableActorId',
    'actionType', v_action.proposal ->> 'actionType',
    'intendedOperation', v_action.proposal ->> 'intendedOperation',
    'intendedEffect', v_action.proposal ->> 'intendedEffect',
    'justification', v_action.proposal ->> 'justification',
    'risk', v_action.proposal ->> 'risk',
    'correlationId', v_action.correlation_id,
    'causationId', v_action.causation_id,
    'actionCreatedAt', v_action.created_at,
    'governanceEvaluatedAt', v_evaluation.evaluated_at,
    'mappedAt', pg_catalog.now(),
    'authorizedDoesNotMeanExecuted', true,
    'taskCreatedDoesNotMeanOutcome', true
  );

  perform pg_catalog.set_config('pmfreak.p2_07_canonical_dispatch', '1', true);

  insert into public.execution_tasks(
    workspace_id,
    project_id,
    task_draft_id,
    recommended_action_id,
    raid_item_id,
    title,
    description,
    status,
    priority,
    owner_user_id,
    owner_name,
    due_date,
    acceptance_criteria,
    checklist,
    confidence_score,
    source_payload,
    created_by
  )
  values(
    v_action.workspace_id,
    v_action.project_id,
    null,
    v_decision.recommendation_id,
    null,
    v_title,
    coalesce(v_description, ''),
    'not_started',
    v_priority,
    v_action.proposed_by,
    null,
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    v_source_payload,
    v_actor
  )
  returning * into v_task;

  insert into public.execution_task_events(
    workspace_id,
    project_id,
    task_id,
    event_type,
    event_payload,
    actor_user_id
  )
  values(
    v_task.workspace_id,
    v_task.project_id,
    v_task.id,
    'governed_action_task_created',
    jsonb_build_object(
      'sourceActionId', v_action.id,
      'sourceDecisionId', v_action.source_decision_id,
      'governanceEvaluationId', v_evaluation.id,
      'governanceState', v_evaluation.governance_state,
      'policyReference', v_evaluation.policy_decision_reference,
      'grantReferences', to_jsonb(v_evaluation.grant_references),
      'approvalReferences', to_jsonb(v_evaluation.approval_references),
      'proposalDigest', v_action.proposal_digest,
      'correlationId', v_action.correlation_id,
      'causationId', v_action.causation_id,
      'createdVsReplay', 'created',
      'executed', false,
      'outcomeCreated', false
    ),
    v_actor
  );

  return jsonb_build_object(
    'disposition', 'created',
    'task', to_jsonb(v_task),
    'sourceActionId', v_action.id,
    'governanceEvaluationId', v_evaluation.id,
    'governanceState', v_evaluation.governance_state,
    'nonExecution', jsonb_build_object(
      'taskCreated', true,
      'executed', false,
      'outcomeCreated', false,
      'observationCreated', false,
      'remoteAocWriteback', false
    )
  );
end;
$$;

revoke all on function public.dispatch_governed_action_to_internal_task(uuid, uuid, uuid, text)
  from public;
grant execute on function public.dispatch_governed_action_to_internal_task(uuid, uuid, uuid, text)
  to authenticated;

comment on function public.dispatch_governed_action_to_internal_task(uuid, uuid, uuid, text)
  is 'P2-07 canonical governed Action-to-internal-Task boundary. Idempotent, fail-closed, tenant-scoped; never executes work or creates an Outcome.';