-- P2-04: verified Normalized Event -> Evidence derivation.
-- Forward-only and additive. Historical evidence is retained with unknown provenance.

alter table public.evidence_items
  add column if not exists normalized_event_id uuid references public.operational_normalized_events(id) on delete restrict,
  add column if not exists raw_input_id uuid references public.operational_raw_inputs(id) on delete restrict,
  add column if not exists source_id uuid references public.operational_sources(id) on delete restrict,
  add column if not exists derivation_idempotency_key text,
  add column if not exists digest_algorithm text,
  add column if not exists canonicalization_version text,
  add column if not exists assertion_type text,
  add column if not exists classification text,
  add column if not exists confidence_score numeric(5,4),
  add column if not exists missing_data_state text,
  add column if not exists freshness_state text,
  add column if not exists stale_at timestamptz,
  add column if not exists lifecycle text,
  add column if not exists occurred_at timestamptz,
  add column if not exists evaluated_at timestamptz,
  add column if not exists recorded_at timestamptz,
  add column if not exists correlation_id uuid,
  add column if not exists causation_id uuid,
  add column if not exists fixture_state text,
  add column if not exists derivation_digest text,
  add column if not exists rejection_reason text,
  add column if not exists degraded_reason text;

alter table public.evidence_items add constraint evidence_derivation_complete check (
  normalized_event_id is null or (
    raw_input_id is not null and source_id is not null and
    derivation_idempotency_key is not null and
    digest_algorithm = 'sha256' and canonicalization_version = 'evidence:v1' and
    assertion_type in ('FACT','INFERENCE','ASSUMPTION') and
    classification in ('UNCLASSIFIED','PROJECT_STATUS','RISK','ISSUE','DECISION_CONTEXT','DELIVERY') and
    confidence_score between 0 and 1 and
    missing_data_state in ('COMPLETE','PARTIAL','UNKNOWN') and
    freshness_state in ('CURRENT','STALE') and
    lifecycle in ('RECORDED','STALE','REJECTED','DEGRADED','SUPERSEDED') and
    fixture_state in ('LIVE','DEMO_FIXTURE') and
    derivation_digest ~ '^sha256:[a-f0-9]{64}$' and
    derivation_digest <> 'sha256:' || repeat('0', 64) and
    occurred_at is not null and evaluated_at is not null and recorded_at is not null and
    correlation_id is not null and causation_id is not null
  )
);

create unique index evidence_items_derivation_scope_key_uidx
  on public.evidence_items(workspace_id, project_id, derivation_idempotency_key)
  where normalized_event_id is not null;
create index evidence_items_normalized_event_idx on public.evidence_items(normalized_event_id) where normalized_event_id is not null;
create index evidence_items_provenance_idx on public.evidence_items(workspace_id, project_id, source_id, raw_input_id, normalized_event_id);
create index evidence_items_derivation_digest_idx on public.evidence_items(derivation_digest) where derivation_digest is not null;

create or replace function public.prevent_derived_evidence_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.normalized_event_id is not null and tg_op = 'DELETE' then
    raise exception 'derived_evidence_is_append_only';
  end if;
  if old.normalized_event_id is not null and row(
    old.workspace_id,old.project_id,old.created_by,old.source_type,old.title,old.content,old.source_reference,old.version,
    old.normalized_event_id,old.raw_input_id,old.source_id,old.derivation_idempotency_key,old.digest_algorithm,old.canonicalization_version,
    old.assertion_type,old.classification,old.confidence_score,old.missing_data_state,old.freshness_state,old.stale_at,old.lifecycle,
    old.occurred_at,old.evaluated_at,old.recorded_at,old.correlation_id,old.causation_id,old.fixture_state,old.derivation_digest
  ) is distinct from row(
    new.workspace_id,new.project_id,new.created_by,new.source_type,new.title,new.content,new.source_reference,new.version,
    new.normalized_event_id,new.raw_input_id,new.source_id,new.derivation_idempotency_key,new.digest_algorithm,new.canonicalization_version,
    new.assertion_type,new.classification,new.confidence_score,new.missing_data_state,new.freshness_state,new.stale_at,new.lifecycle,
    new.occurred_at,new.evaluated_at,new.recorded_at,new.correlation_id,new.causation_id,new.fixture_state,new.derivation_digest
  ) then
    raise exception 'derived_evidence_provenance_is_immutable';
  end if;
  return new;
end $$;
drop trigger if exists evidence_items_derived_append_only on public.evidence_items;
create trigger evidence_items_derived_append_only before update or delete on public.evidence_items
  for each row execute function public.prevent_derived_evidence_mutation();

create or replace function public.derive_operational_evidence(
  p_workspace_id uuid, p_project_id uuid, p_normalized_event_id uuid,
  p_idempotency_key text, p_assertion_type text, p_classification text,
  p_confidence_score numeric, p_missing_data_state text,
  p_evaluated_at timestamptz, p_stale_at timestamptz default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_event public.operational_normalized_events;
  v_raw public.operational_raw_inputs;
  v_source public.operational_sources;
  v_existing public.evidence_items;
  v_evidence public.evidence_items;
  v_canonical jsonb;
  v_digest text;
  v_freshness text;
  v_lifecycle text;
  v_audit_id uuid;
begin
  if v_actor is null then raise exception 'evidence_unauthenticated'; end if;
  if not public.can_write_operational_project(p_workspace_id, p_project_id) then raise exception 'evidence_access_denied'; end if;
  if nullif(trim(p_idempotency_key), '') is null or char_length(trim(p_idempotency_key)) < 8 then raise exception 'evidence_idempotency_key_invalid'; end if;
  if p_assertion_type not in ('FACT','INFERENCE','ASSUMPTION') then raise exception 'evidence_assertion_type_unknown'; end if;
  if p_classification not in ('UNCLASSIFIED','PROJECT_STATUS','RISK','ISSUE','DECISION_CONTEXT','DELIVERY') then raise exception 'evidence_classification_unknown'; end if;
  if p_confidence_score is null or p_confidence_score < 0 or p_confidence_score > 1 then raise exception 'evidence_confidence_invalid'; end if;
  if p_missing_data_state not in ('COMPLETE','PARTIAL','UNKNOWN') then raise exception 'evidence_missing_data_state_invalid'; end if;
  if p_evaluated_at is null or p_evaluated_at > now() + interval '5 minutes' then raise exception 'evidence_evaluated_at_invalid'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || p_project_id::text || ':' || trim(p_idempotency_key), 0));
  select * into v_event from public.operational_normalized_events
    where id=p_normalized_event_id and workspace_id=p_workspace_id and project_id=p_project_id;
  if v_event.id is null then raise exception 'normalized_event_not_found_or_scope_mismatch'; end if;
  if v_event.status <> 'accepted' then raise exception 'normalized_event_not_derivable_%', v_event.status; end if;
  if v_event.schema_version <> 1 or v_event.event_type <> 'manual_input.submitted' then raise exception 'normalized_event_version_unsupported'; end if;
  select * into v_raw from public.operational_raw_inputs where id=v_event.raw_input_id and workspace_id=p_workspace_id and project_id=p_project_id;
  if v_raw.id is null then raise exception 'evidence_missing_raw_input_provenance'; end if;
  if v_raw.status <> 'received' then raise exception 'raw_input_not_derivable_%', v_raw.status; end if;
  select * into v_source from public.operational_sources where id=v_event.source_id and workspace_id=p_workspace_id and project_id=p_project_id;
  if v_source.id is null then raise exception 'evidence_missing_source_provenance'; end if;
  if v_source.status in ('revoked','unavailable','degraded') then raise exception 'evidence_source_%', v_source.status; end if;

  v_freshness := case when v_source.status='stale' or (p_stale_at is not null and p_stale_at <= p_evaluated_at) then 'STALE' else 'CURRENT' end;
  v_lifecycle := case when v_freshness='STALE' then 'STALE' else 'RECORDED' end;
  v_canonical := jsonb_build_object(
    'assertionType',p_assertion_type,'canonicalizationVersion','evidence:v1','classification',p_classification,
    'confidenceScore',p_confidence_score,'eventDigest',v_event.event_digest,'eventId',v_event.id,
    'fixtureState',case when v_source.is_fixture then 'DEMO_FIXTURE' else 'LIVE' end,
    'missingDataState',p_missing_data_state,'projectId',p_project_id,'workspaceId',p_workspace_id
  );
  v_digest := 'sha256:' || encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');

  select * into v_existing from public.evidence_items
    where workspace_id=p_workspace_id and project_id=p_project_id and derivation_idempotency_key=trim(p_idempotency_key);
  if v_existing.id is not null then
    if v_existing.derivation_digest <> v_digest or v_existing.normalized_event_id <> v_event.id then raise exception 'evidence_idempotency_conflict'; end if;
    return jsonb_build_object('disposition','duplicate','evidence',to_jsonb(v_existing),'source',to_jsonb(v_source),'rawInput',to_jsonb(v_raw),'normalizedEvent',to_jsonb(v_event),'intelligenceRan',false);
  end if;

  insert into public.evidence_items(
    workspace_id,project_id,created_by,source_type,title,content,source_reference,confidence_level,status,metadata,evidence_hash,version,
    normalized_event_id,raw_input_id,source_id,derivation_idempotency_key,digest_algorithm,canonicalization_version,assertion_type,classification,
    confidence_score,missing_data_state,freshness_state,stale_at,lifecycle,occurred_at,evaluated_at,recorded_at,correlation_id,causation_id,fixture_state,derivation_digest
  ) values (
    p_workspace_id,p_project_id,v_actor,'manual_note',v_event.event_payload->>'title',v_event.event_payload->>'content',v_source.source_key,
    case when p_confidence_score < .34 then 'low' when p_confidence_score < .67 then 'medium' else 'high' end,'recorded',
    jsonb_build_object('redaction','canonical safe content','sourceKind',v_source.source_kind),repeat('0',64),1,
    v_event.id,v_raw.id,v_source.id,trim(p_idempotency_key),'sha256','evidence:v1',p_assertion_type,p_classification,
    p_confidence_score,p_missing_data_state,v_freshness,p_stale_at,v_lifecycle,v_event.occurred_at,p_evaluated_at,now(),v_event.correlation_id,v_event.id,
    case when v_source.is_fixture then 'DEMO_FIXTURE' else 'LIVE' end,v_digest
  ) returning * into v_evidence;

  insert into public.platform_events(workspace_id,project_id,actor_id,actor_type,event_type,event_category,event_payload,source,correlation_id,causation_id,visibility,sensitivity_level,learning_eligible,raw_reference_table,raw_reference_id,metadata,occurred_at)
  values(p_workspace_id,p_project_id,v_actor,'user','EVIDENCE_DERIVED_V1','provenance',
    jsonb_build_object('eventVersion',1,'evidenceId',v_evidence.id,'normalizedEventId',v_event.id,'rawInputId',v_raw.id,'sourceId',v_source.id,'digest',v_digest,'canonicalizationVersion','evidence:v1','assertionType',p_assertion_type,'classification',p_classification,'confidence',p_confidence_score,'missingDataState',p_missing_data_state,'freshnessState',v_freshness,'fixtureState',v_evidence.fixture_state,'redaction',jsonb_build_object('rawPayloadIncluded',false)),
    'user_action',v_event.correlation_id,v_event.id,'project','internal',false,'evidence_items',v_evidence.id,
    jsonb_build_object('idempotencyKeyDigest',encode(extensions.digest(convert_to(trim(p_idempotency_key),'UTF8'),'sha256'),'hex'),'correlationKind','correlation_not_causation'),p_evaluated_at)
  returning id into v_audit_id;

  return jsonb_build_object('disposition','created','evidence',to_jsonb(v_evidence),'source',to_jsonb(v_source),'rawInput',to_jsonb(v_raw),'normalizedEvent',to_jsonb(v_event),'auditEventId',v_audit_id,'intelligenceRan',false);
end $$;

revoke all on function public.derive_operational_evidence(uuid,uuid,uuid,text,text,text,numeric,text,timestamptz,timestamptz) from public;
grant execute on function public.derive_operational_evidence(uuid,uuid,uuid,text,text,text,numeric,text,timestamptz,timestamptz) to authenticated;

-- New authenticated Evidence writes must pass through the narrow derivation RPC.
drop policy if exists evidence_items_role_insert on public.evidence_items;
drop policy if exists "operational evidence insert" on public.evidence_items;
drop policy if exists evidence_items_writer_insert on public.evidence_items;

comment on function public.derive_operational_evidence(uuid,uuid,uuid,text,text,text,numeric,text,timestamptz,timestamptz)
  is 'P2-04 connector-neutral derivation boundary. Creates Evidence only from an accepted, scoped Normalized Event; never runs intelligence.';
