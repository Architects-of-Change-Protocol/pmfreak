-- P2-06: governed Decision -> inert Material Action. No Task, dispatch, execution,
-- Outcome, Observation, learning elevation, or remote AOC writeback occurs here.

create table public.material_action_proposals (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  source_decision_id uuid not null references public.operational_decision_records(id) on delete restrict,
  proposed_by uuid not null references auth.users(id) on delete restrict,
  schema_version text not null check (schema_version = 'pmfreak.material-action.v1'),
  digest_version text not null check (digest_version = 'sha256:pmfreak-material-action:v1'),
  proposal_digest text not null check (proposal_digest ~ '^[a-f0-9]{64}$'),
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 200),
  action_class text not null check (action_class in ('ordinary_business_write','external_write','authority_mutation','material_agent_action','knowledge_elevation','policy_classified')),
  materiality text not null check (materiality in ('ordinary','material','unknown','prohibited')),
  proposal jsonb not null,
  correlation_id text not null,
  causation_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  persisted_at timestamptz not null default now(),
  fixture_metadata jsonb,
  unique (workspace_id, idempotency_key),
  unique (workspace_id, id, proposal_digest),
  check (expires_at > created_at),
  check (proposal->>'remoteDecisionWriteback' = 'false' and proposal->>'createsTask' = 'false' and proposal->>'dispatchesAction' = 'false' and proposal->>'executesAction' = 'false'),
  check (fixture_metadata is null)
);

create table public.material_action_governance_evaluations (
  id uuid primary key,
  action_id uuid not null references public.material_action_proposals(id) on delete restrict,
  workspace_id uuid not null,
  project_id uuid not null,
  proposal_digest text not null,
  contract_version text not null check (contract_version = 'pmfreak.aoc-e.in-process-governance.v1'),
  evaluator_kind text not null check (evaluator_kind = 'aoc_e_in_process'),
  governance_state text not null check (governance_state in ('not_required','requires_review','requires_approval','authorized','denied','revoked','expired','stale','unavailable','degraded')),
  policy_decision_reference text,
  grant_references text[] not null default '{}',
  obligation_references text[] not null default '{}',
  approval_references text[] not null default '{}',
  reason_codes text[] not null default '{}',
  evaluated_at timestamptz not null,
  valid_until timestamptz,
  can_commit_action boolean not null,
  can_execute boolean not null default false check (not can_execute),
  authorization_evidence jsonb not null,
  recorded_at timestamptz not null default now(),
  unique (action_id, proposal_digest, evaluated_at),
  foreign key (workspace_id, action_id, proposal_digest) references public.material_action_proposals(workspace_id, id, proposal_digest) on delete restrict
);

create table public.material_action_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  action_id uuid not null references public.material_action_proposals(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_version text not null check (event_version = 'pmfreak.material-action-audit.v1'),
  event_type text not null check (event_type in ('decision_to_action_requested','material_action_proposed','governance_evaluation_completed','authorization_granted','authorization_denied','replayed','conflict','unavailable_or_degraded')),
  correlation_id text not null,
  causation_id text,
  redacted_payload jsonb not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  check (not (redacted_payload ?| array['rawPayload','content','token','secret','apiKey','serviceRoleKey']))
);

create index material_action_proposals_scope_idx on public.material_action_proposals(workspace_id, project_id, persisted_at desc);
create index material_action_evaluations_scope_idx on public.material_action_governance_evaluations(workspace_id, project_id, recorded_at desc);
create index material_action_audit_scope_idx on public.material_action_audit_events(workspace_id, project_id, recorded_at desc);

alter table public.material_action_proposals enable row level security;
alter table public.material_action_governance_evaluations enable row level security;
alter table public.material_action_audit_events enable row level security;

create policy material_action_proposals_scoped_select on public.material_action_proposals for select to authenticated
  using (public.can_access_operational_project(workspace_id, project_id));
create policy material_action_evaluations_scoped_select on public.material_action_governance_evaluations for select to authenticated
  using (public.can_access_operational_project(workspace_id, project_id));
create policy material_action_audit_scoped_select on public.material_action_audit_events for select to authenticated
  using (public.can_access_operational_project(workspace_id, project_id));

create or replace function public.reject_material_action_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'material_action_evidence_is_immutable';
end $$;

create trigger material_action_proposals_immutable before update or delete on public.material_action_proposals
  for each row execute function public.reject_material_action_mutation();
create trigger material_action_evaluations_immutable before update or delete on public.material_action_governance_evaluations
  for each row execute function public.reject_material_action_mutation();
create trigger material_action_audit_immutable before update or delete on public.material_action_audit_events
  for each row execute function public.reject_material_action_mutation();

-- Tables are query-only through the Data API; the transactional RPC is the sole write path.
revoke all on public.material_action_proposals, public.material_action_governance_evaluations, public.material_action_audit_events from anon, authenticated;
grant select on public.material_action_proposals, public.material_action_governance_evaluations, public.material_action_audit_events to authenticated;

create or replace function public.persist_governed_material_action(p_proposal jsonb, p_evaluation jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_existing public.material_action_proposals; v_proposal public.material_action_proposals;
  v_decision public.operational_decision_records; v_evaluation public.material_action_governance_evaluations; v_event_type text;
  v_actor_role text; v_expected_state text; v_expected_commit boolean;
begin
  if v_actor is null then raise exception 'material_action_unauthenticated'; end if;
  if p_proposal->>'schemaVersion' <> 'pmfreak.material-action.v1' then raise exception 'material_action_unsupported_version'; end if;
  if p_proposal->>'deterministicDigest' !~ '^[a-f0-9]{64}$' then raise exception 'material_action_digest_invalid'; end if;
  if coalesce((p_proposal->>'remoteDecisionWriteback')::boolean,true) or coalesce((p_proposal->>'createsTask')::boolean,true)
     or coalesce((p_proposal->>'dispatchesAction')::boolean,true) or coalesce((p_proposal->>'executesAction')::boolean,true) then
    raise exception 'material_action_non_execution_boundary';
  end if;
  if p_proposal->'fixture' <> 'null'::jsonb then raise exception 'material_action_fixture_not_permitted_for_acceptance'; end if;

  select * into v_decision from public.operational_decision_records
    where id=(p_proposal->>'decisionReferenceId')::uuid and workspace_id=(p_proposal->>'workspaceId')::uuid
      and project_id=(p_proposal->>'projectId')::uuid and decision_status in ('accepted','modified');
  if v_decision.id is null then raise exception 'material_action_source_decision_ineligible'; end if;
  if not public.can_write_operational_project(v_decision.workspace_id,v_decision.project_id) then raise exception 'material_action_write_denied'; end if;
  if v_decision.decided_by <> v_actor then raise exception 'material_action_decision_actor_mismatch'; end if;
  if not exists (select 1 from public.decision_evidence_links l where l.decision_record_id=v_decision.id) then raise exception 'material_action_evidence_required'; end if;

  -- Serialize the canonical idempotency scope before inspecting it. Concurrent
  -- identical callers replay; concurrent different content receives conflict.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_decision.workspace_id::text || ':' || (p_proposal->>'idempotencyKey'), 0));

  select * into v_existing from public.material_action_proposals where workspace_id=v_decision.workspace_id and idempotency_key=p_proposal->>'idempotencyKey';
  if v_existing.id is not null then
    if v_existing.proposal_digest <> p_proposal->>'deterministicDigest' then
      insert into public.material_action_audit_events(workspace_id,project_id,action_id,actor_id,event_version,event_type,correlation_id,causation_id,redacted_payload,occurred_at)
      values(v_existing.workspace_id,v_existing.project_id,v_existing.id,v_actor,'pmfreak.material-action-audit.v1','conflict',v_existing.correlation_id,v_existing.causation_id,jsonb_build_object('proposalDigest',p_proposal->>'deterministicDigest'),(p_evaluation->>'evaluatedAt')::timestamptz);
      return jsonb_build_object('disposition','conflict','actionId',v_existing.id,'proposalDigest',v_existing.proposal_digest,'error','material_action_idempotency_conflict');
    end if;
    return jsonb_build_object('disposition','replay','proposal',to_jsonb(v_existing),'evaluation',(select to_jsonb(e) from public.material_action_governance_evaluations e where e.action_id=v_existing.id order by recorded_at desc limit 1));
  end if;

  v_actor_role := public.operational_workspace_role(v_decision.workspace_id);
  v_expected_state := case
    when p_proposal->>'actionClass' = 'knowledge_elevation' then 'denied'
    when p_proposal->>'materiality' = 'unknown' then 'degraded'
    when p_proposal->>'materiality' = 'ordinary' then 'not_required'
    when v_decision.governance_event_id is null then 'unavailable'
    when v_actor_role in ('owner','admin') then 'authorized'
    else 'requires_approval'
  end;
  v_expected_commit := v_expected_state in ('authorized','not_required');
  if p_evaluation->>'state' <> v_expected_state or coalesce((p_evaluation->>'canCommitAction')::boolean,false) <> v_expected_commit then
    raise exception 'material_action_governance_projection_mismatch';
  end if;
  if v_expected_state = 'authorized' and nullif(p_evaluation->>'policyDecisionReference','') is null then
    raise exception 'material_action_policy_evidence_required';
  end if;

  insert into public.material_action_proposals(id,workspace_id,project_id,source_decision_id,proposed_by,schema_version,digest_version,proposal_digest,idempotency_key,action_class,materiality,proposal,correlation_id,causation_id,expires_at,created_at)
  values((p_proposal->>'actionId')::uuid,v_decision.workspace_id,v_decision.project_id,v_decision.id,v_actor,p_proposal->>'schemaVersion',p_proposal->>'digestVersion',p_proposal->>'deterministicDigest',p_proposal->>'idempotencyKey',p_proposal->>'actionClass',p_proposal->>'materiality',p_proposal,p_proposal->>'sourceCorrelationId',nullif(p_proposal->>'causationId',''),(p_proposal->>'expiresAt')::timestamptz,(p_proposal->>'createdAt')::timestamptz) returning * into v_proposal;

  insert into public.material_action_governance_evaluations(id,action_id,workspace_id,project_id,proposal_digest,contract_version,evaluator_kind,governance_state,policy_decision_reference,grant_references,obligation_references,approval_references,reason_codes,evaluated_at,valid_until,can_commit_action,can_execute,authorization_evidence)
  values((p_evaluation->>'evaluationId')::uuid,v_proposal.id,v_proposal.workspace_id,v_proposal.project_id,v_proposal.proposal_digest,'pmfreak.aoc-e.in-process-governance.v1','aoc_e_in_process',p_evaluation->>'state',nullif(p_evaluation->>'policyDecisionReference',''),array(select jsonb_array_elements_text(coalesce(p_evaluation->'grantReferenceIds','[]'))),array(select jsonb_array_elements_text(coalesce(p_evaluation->'obligationReferenceIds','[]'))),array(select jsonb_array_elements_text(coalesce(p_evaluation->'approvalReferenceIds','[]'))),array(select jsonb_array_elements_text(coalesce(p_evaluation->'reasonCodes','[]'))),(p_evaluation->>'evaluatedAt')::timestamptz,nullif(p_evaluation->>'validUntil','')::timestamptz,(p_evaluation->>'canCommitAction')::boolean,false,p_evaluation) returning * into v_evaluation;

  v_event_type := case when v_evaluation.governance_state='authorized' then 'authorization_granted' when v_evaluation.governance_state in ('denied','revoked','expired','stale') then 'authorization_denied' when v_evaluation.governance_state in ('unavailable','degraded') then 'unavailable_or_degraded' else 'governance_evaluation_completed' end;
  insert into public.material_action_audit_events(workspace_id,project_id,action_id,actor_id,event_version,event_type,correlation_id,causation_id,redacted_payload,occurred_at)
  values(v_proposal.workspace_id,v_proposal.project_id,v_proposal.id,v_actor,'pmfreak.material-action-audit.v1',v_event_type,v_proposal.correlation_id,v_proposal.causation_id,jsonb_build_object('proposalDigest',v_proposal.proposal_digest,'sourceDecisionId',v_proposal.source_decision_id,'governanceState',v_evaluation.governance_state,'contractVersion',v_evaluation.contract_version,'authorizedDoesNotMeanExecuted',true),(p_evaluation->>'evaluatedAt')::timestamptz);
  return jsonb_build_object('disposition','created','proposal',to_jsonb(v_proposal),'evaluation',to_jsonb(v_evaluation),'nonExecution',jsonb_build_object('taskCreated',false,'dispatched',false,'executed',false,'outcomeCreated',false,'observationCreated',false,'learningElevated',false,'remoteAocWriteback',false));
end $$;

create or replace function public.revoke_governed_material_action(p_action_id uuid, p_evaluation_id uuid, p_evaluated_at timestamptz, p_reason_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_action public.material_action_proposals; v_existing public.material_action_governance_evaluations; v_eval public.material_action_governance_evaluations; v_role text;
begin
  if v_actor is null then raise exception 'material_action_unauthenticated'; end if;
  select * into v_action from public.material_action_proposals where id=p_action_id;
  if v_action.id is null or not public.can_write_operational_project(v_action.workspace_id,v_action.project_id) then raise exception 'material_action_not_found'; end if;
  v_role := public.operational_workspace_role(v_action.workspace_id);
  if v_actor <> v_action.proposed_by and v_role not in ('owner','admin') then raise exception 'material_action_revoke_denied'; end if;
  select * into v_existing from public.material_action_governance_evaluations where action_id=p_action_id and governance_state='revoked' order by recorded_at desc limit 1;
  if v_existing.id is not null then return jsonb_build_object('disposition','replay','evaluation',to_jsonb(v_existing)); end if;
  insert into public.material_action_governance_evaluations(id,action_id,workspace_id,project_id,proposal_digest,contract_version,evaluator_kind,governance_state,policy_decision_reference,grant_references,obligation_references,approval_references,reason_codes,evaluated_at,can_commit_action,can_execute,authorization_evidence)
  values(p_evaluation_id,v_action.id,v_action.workspace_id,v_action.project_id,v_action.proposal_digest,'pmfreak.aoc-e.in-process-governance.v1','aoc_e_in_process','revoked',null,'{}','{}','{}',array[trim(p_reason_code)],p_evaluated_at,false,false,jsonb_build_object('evaluationId',p_evaluation_id,'evaluatedAt',p_evaluated_at,'state','revoked','reasonCodes',array[trim(p_reason_code)],'canCommitAction',false,'canExecute',false)) returning * into v_eval;
  insert into public.material_action_audit_events(workspace_id,project_id,action_id,actor_id,event_version,event_type,correlation_id,causation_id,redacted_payload,occurred_at)
  values(v_action.workspace_id,v_action.project_id,v_action.id,v_actor,'pmfreak.material-action-audit.v1','authorization_denied',v_action.correlation_id,v_action.causation_id,jsonb_build_object('proposalDigest',v_action.proposal_digest,'governanceState','revoked','reasonCode',trim(p_reason_code)),p_evaluated_at);
  return jsonb_build_object('disposition','created','evaluation',to_jsonb(v_eval));
end $$;

revoke all on function public.persist_governed_material_action(jsonb,jsonb) from public, anon;
grant execute on function public.persist_governed_material_action(jsonb,jsonb) to authenticated;
revoke all on function public.revoke_governed_material_action(uuid,uuid,timestamptz,text) from public, anon;
grant execute on function public.revoke_governed_material_action(uuid,uuid,timestamptz,text) to authenticated;

comment on function public.persist_governed_material_action(jsonb,jsonb) is 'P2-06 transactional Decision-to-inert-Material-Action boundary; never creates or executes a Task.';
