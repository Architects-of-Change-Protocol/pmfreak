-- P2-03: Source != Raw Input != Normalized Event != Evidence.
-- This migration captures input only. It never creates evidence_items.

create or replace function public.operational_is_service_role()
returns boolean language sql stable set search_path = pg_catalog, auth, public as $$
  select auth.role() = 'service_role' or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
$$;

-- PostgreSQL 17 resolves fields on a polymorphic trigger record more strictly.
-- Keep the historical trigger and replace only its function with table-specific
-- branches so a fresh runtime can materialize the retained operational chain.
create or replace function public.enforce_operational_lineage()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'operational_signals' then
    if not exists (select 1 from public.evidence_items e where e.id = new.evidence_item_id and e.workspace_id = new.workspace_id and e.project_id = new.project_id) then raise exception 'signal_evidence_scope_mismatch'; end if;
  elsif tg_table_name = 'risk_issue_records' then
    if not exists (select 1 from public.operational_signals s where s.id = new.signal_id and s.workspace_id = new.workspace_id and s.project_id = new.project_id) then raise exception 'risk_signal_scope_mismatch'; end if;
  elsif tg_table_name = 'governance_events' then
    if not exists (select 1 from public.risk_issue_records r where r.id = new.related_entity_id and r.workspace_id = new.workspace_id and r.project_id = new.project_id) then raise exception 'governance_risk_scope_mismatch'; end if;
  elsif tg_table_name = 'recommended_actions' then
    if tg_op = 'INSERT' and new.governance_event_id is not null and new.status <> 'proposed' then raise exception 'governed_recommendation_must_start_proposed'; end if;
    if new.governance_event_id is not null and not exists (
      select 1 from public.governance_events g join public.risk_issue_records r on r.id = g.related_entity_id
      where g.id = new.governance_event_id and g.workspace_id = new.workspace_id and g.project_id = new.project_id and new.risk_issue_id = r.id
    ) then raise exception 'recommendation_governance_lineage_mismatch'; end if;
  elsif tg_table_name = 'operational_decision_records' then
    if new.recommendation_id is not null and not exists (
      select 1 from public.recommended_actions a where a.id = new.recommendation_id and a.workspace_id = new.workspace_id and a.project_id = new.project_id and a.governance_event_id = new.governance_event_id
    ) then raise exception 'decision_recommendation_lineage_mismatch'; end if;
  end if;
  return new;
end $$;

-- The platform event table column is event_payload. Preserve its recursive
-- secret-key validation while repairing the historical trigger's stale name.
create or replace function public.find_forbidden_platform_event_payload_key(value jsonb, path text default '')
returns text language plpgsql immutable set search_path = pg_catalog, public as $$
declare
  forbidden_keys constant text[] := array['full_email_body','full_contract_text','raw_document_text','password','secret','token','api_key'];
  item record;
  child_path text;
  found_path text;
begin
  if $1 is null then return null; end if;
  if jsonb_typeof($1) = 'object' then
    for item in select entry.key, entry.value from jsonb_each($1) as entry loop
      child_path := case when $2 = '' then item.key else $2 || '.' || item.key end;
      if lower(item.key) = any (forbidden_keys) then return child_path; end if;
      found_path := public.find_forbidden_platform_event_payload_key(item.value, child_path);
      if found_path is not null then return found_path; end if;
    end loop;
  elsif jsonb_typeof($1) = 'array' then
    for item in select entry.ordinality - 1 as idx, entry.value from jsonb_array_elements($1) with ordinality as entry(value, ordinality) loop
      child_path := $2 || '[' || item.idx || ']';
      found_path := public.find_forbidden_platform_event_payload_key(item.value, child_path);
      if found_path is not null then return found_path; end if;
    end loop;
  end if;
  return null;
end $$;

create or replace function public.validate_platform_event_payload()
returns trigger language plpgsql set search_path = public as $$
declare forbidden_path text;
begin
  forbidden_path := public.find_forbidden_platform_event_payload_key(new.event_payload);
  if forbidden_path is not null then
    raise exception 'Forbidden payload key detected: %', forbidden_path using errcode = 'P0001';
  end if;
  return new;
end $$;

create table public.operational_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  source_key text not null check (source_key ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'),
  source_kind text not null check (source_kind in ('manual_demo','connector','import')),
  display_name text not null check (char_length(trim(display_name)) between 1 and 160),
  status text not null default 'active' check (status in ('active','degraded','stale','unavailable','revoked')),
  is_fixture boolean not null default false,
  fixture_label text,
  fixture_expires_when text[],
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, project_id, source_key),
  foreign key (workspace_id, project_id) references public.projects(workspace_id, id) on delete cascade,
  check (not is_fixture or (fixture_label = 'DEMO / FIXTURE' and coalesce(array_length(fixture_expires_when, 1), 0) > 0))
);

create table public.operational_raw_inputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  source_id uuid not null references public.operational_sources(id) on delete restrict,
  external_id text,
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 8 and 200),
  media_type text not null default 'application/json',
  payload jsonb not null,
  content_digest text not null check (content_digest ~ '^sha256:[a-f0-9]{64}$'),
  status text not null default 'received' check (status in ('received','quarantined','rejected')),
  occurred_at timestamptz not null,
  captured_at timestamptz not null default now(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  correlation_id uuid not null,
  causation_id uuid,
  provenance jsonb not null,
  foreign key (workspace_id, project_id) references public.projects(workspace_id, id) on delete cascade,
  unique (source_id, idempotency_key)
);

create table public.operational_normalized_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  source_id uuid not null references public.operational_sources(id) on delete restrict,
  raw_input_id uuid not null references public.operational_raw_inputs(id) on delete restrict,
  event_type text not null,
  schema_version integer not null check (schema_version > 0),
  normalizer_key text not null,
  subject_type text not null check (subject_type = 'project'),
  subject_id uuid not null,
  event_payload jsonb not null,
  event_digest text not null check (event_digest ~ '^sha256:[a-f0-9]{64}$'),
  status text not null check (status in ('accepted','quarantined')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  correlation_id uuid not null,
  causation_id uuid not null,
  provenance jsonb not null,
  foreign key (workspace_id, project_id) references public.projects(workspace_id, id) on delete cascade,
  unique (raw_input_id, event_type, schema_version)
);

create index operational_sources_scope_idx on public.operational_sources(workspace_id, project_id, status);
create index operational_raw_inputs_scope_idx on public.operational_raw_inputs(workspace_id, project_id, captured_at desc);
create index operational_normalized_events_scope_idx on public.operational_normalized_events(workspace_id, project_id, recorded_at desc);

alter table public.operational_sources enable row level security;
alter table public.operational_raw_inputs enable row level security;
alter table public.operational_normalized_events enable row level security;

create policy operational_sources_scoped_select on public.operational_sources for select to authenticated
  using (public.can_access_operational_project(workspace_id, project_id));
create policy operational_raw_inputs_scoped_select on public.operational_raw_inputs for select to authenticated
  using (public.can_access_operational_project(workspace_id, project_id));
create policy operational_normalized_events_scoped_select on public.operational_normalized_events for select to authenticated
  using (public.can_access_operational_project(workspace_id, project_id));

create or replace function public.prevent_operational_intake_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception '% is immutable; record a superseding input/event', tg_table_name;
end $$;

create trigger operational_raw_inputs_immutable before update or delete on public.operational_raw_inputs
  for each row execute function public.prevent_operational_intake_mutation();
create trigger operational_normalized_events_immutable before update or delete on public.operational_normalized_events
  for each row execute function public.prevent_operational_intake_mutation();

create or replace function public.capture_operational_input(
  p_workspace_id uuid, p_project_id uuid, p_source_key text, p_idempotency_key text,
  p_title text, p_content text, p_occurred_at timestamptz, p_correlation_id uuid,
  p_causation_id uuid default null, p_external_id text default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_source public.operational_sources;
  v_raw public.operational_raw_inputs;
  v_event public.operational_normalized_events;
  v_payload jsonb;
  v_raw_digest text;
  v_event_digest text;
  v_duplicate boolean := false;
  v_audit_id uuid;
begin
  if v_actor is null then raise exception 'intake_unauthenticated'; end if;
  if not public.can_write_operational_project(p_workspace_id, p_project_id) then raise exception 'intake_access_denied'; end if;
  if nullif(trim(p_title), '') is null or nullif(trim(p_content), '') is null then raise exception 'intake_malformed'; end if;
  if p_occurred_at > now() + interval '5 minutes' then raise exception 'intake_occurred_at_invalid'; end if;

  insert into public.operational_sources(workspace_id, project_id, source_key, source_kind, display_name, status, is_fixture, fixture_label, fixture_expires_when, created_by)
  values (p_workspace_id, p_project_id, p_source_key, 'manual_demo', 'Manual demo submission', 'active', true, 'DEMO / FIXTURE', array['P2-04','P2-13','P2-17'], v_actor)
  on conflict (workspace_id, project_id, source_key) do nothing;
  select * into v_source from public.operational_sources
    where workspace_id=p_workspace_id and project_id=p_project_id and source_key=p_source_key;
  case v_source.status
    when 'degraded' then raise exception 'intake_source_degraded';
    when 'stale' then raise exception 'intake_source_stale';
    when 'unavailable' then raise exception 'intake_source_unavailable';
    when 'revoked' then raise exception 'intake_source_revoked';
    else null;
  end case;

  v_payload := jsonb_build_object('title', trim(p_title), 'content', trim(p_content));
  v_raw_digest := 'sha256:' || encode(extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.operational_raw_inputs(workspace_id,project_id,source_id,external_id,idempotency_key,payload,content_digest,status,occurred_at,actor_user_id,correlation_id,causation_id,provenance)
  values(p_workspace_id,p_project_id,v_source.id,nullif(trim(p_external_id),''),trim(p_idempotency_key),v_payload,v_raw_digest,'received',p_occurred_at,v_actor,p_correlation_id,p_causation_id,
    jsonb_build_object('sourceId',v_source.id,'sourceKey',v_source.source_key,'capturedBy',v_actor,'fixtureLabel',v_source.fixture_label))
  on conflict (source_id,idempotency_key) do nothing returning * into v_raw;
  if v_raw.id is null then
    v_duplicate := true;
    select * into v_raw from public.operational_raw_inputs where source_id=v_source.id and idempotency_key=trim(p_idempotency_key);
    if v_raw.content_digest <> v_raw_digest then raise exception 'intake_idempotency_conflict'; end if;
  end if;

  v_event_digest := 'sha256:' || encode(extensions.digest(convert_to(jsonb_build_object('eventType','manual_input.submitted','schemaVersion',1,'rawDigest',v_raw.content_digest,'payload',v_payload)::text,'UTF8'),'sha256'),'hex');
  insert into public.operational_normalized_events(workspace_id,project_id,source_id,raw_input_id,event_type,schema_version,normalizer_key,subject_type,subject_id,event_payload,event_digest,status,occurred_at,actor_user_id,correlation_id,causation_id,provenance)
  values(p_workspace_id,p_project_id,v_source.id,v_raw.id,'manual_input.submitted',1,'pmfreak/manual-input-normalizer:v1','project',p_project_id,v_payload,v_event_digest,'accepted',p_occurred_at,v_actor,p_correlation_id,v_raw.id,
    jsonb_build_object('sourceId',v_source.id,'rawInputId',v_raw.id,'rawDigest',v_raw.content_digest,'normalizer','pmfreak/manual-input-normalizer:v1'))
  on conflict (raw_input_id,event_type,schema_version) do nothing returning * into v_event;
  if v_event.id is null then select * into v_event from public.operational_normalized_events where raw_input_id=v_raw.id and event_type='manual_input.submitted' and schema_version=1; end if;

  if not v_duplicate then
    insert into public.platform_events(workspace_id,project_id,actor_id,actor_type,event_type,event_category,event_payload,source,correlation_id,causation_id,visibility,sensitivity_level,learning_eligible,raw_reference_table,raw_reference_id,metadata,occurred_at)
    values(p_workspace_id,p_project_id,v_actor,'user','NORMALIZED_EVENT_RECORDED','provenance',jsonb_build_object('eventId',v_event.id,'eventType',v_event.event_type,'schemaVersion',v_event.schema_version,'eventDigest',v_event.event_digest),'user_action',p_correlation_id,null,'project','internal',false,'operational_raw_inputs',v_raw.id,jsonb_build_object('sourceId',v_source.id,'normalizerKey',v_event.normalizer_key),p_occurred_at)
    returning id into v_audit_id;
  end if;

  return jsonb_build_object('disposition',case when v_duplicate then 'duplicate' else 'created' end,'source',to_jsonb(v_source),'rawInput',to_jsonb(v_raw),'normalizedEvent',to_jsonb(v_event),'auditEventId',v_audit_id,'evidenceCreated',false);
end $$;

revoke all on function public.capture_operational_input(uuid,uuid,text,text,text,text,timestamptz,uuid,uuid,text) from public;
grant execute on function public.capture_operational_input(uuid,uuid,text,text,text,text,timestamptz,uuid,uuid,text) to authenticated;

comment on table public.operational_sources is 'Authorized source registry. A Source is not Raw Input, Normalized Event, or Evidence.';
comment on table public.operational_raw_inputs is 'Immutable content-addressed captures. A Raw Input is not Evidence or fact.';
comment on table public.operational_normalized_events is 'Immutable schema-versioned projections retaining Raw Input provenance. Not Evidence.';
