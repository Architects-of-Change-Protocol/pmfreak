-- PMFreak governed evidence-to-decision loop v1.
-- Security model:
--   * authenticated workspace readers may read project-scoped records;
--   * owner/admin/pm may create evidence;
--   * sensitive derived/audit records are written only through validated RPCs;
--   * governance, decisions, evidence links, detector runs and outputs are append-only;
--   * authority is checked against the canonical DB workspace roles (owner/admin/pm/viewer).
-- This is PMFreak role-mapping enforcement aligned with AOC concepts. It is not an AOC claim/approval assertion.

create extension if not exists pgcrypto;

create or replace function public.operational_is_service_role()
returns boolean language sql stable set search_path = public
as $$ select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' $$;

create or replace function public.operational_workspace_role(p_workspace_id uuid)
returns text language sql stable security definer set search_path = public
as $$
  select wm.role from public.workspace_memberships wm
  where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
$$;

create or replace function public.can_access_operational_project(p_workspace_id uuid, p_project_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    join public.workspace_memberships wm on wm.workspace_id = p.workspace_id
    where p.id = p_project_id and p.workspace_id = p_workspace_id and wm.user_id = auth.uid()
  )
$$;

create or replace function public.can_write_operational_project(p_workspace_id uuid, p_project_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.can_access_operational_project(p_workspace_id, p_project_id)
    and public.operational_workspace_role(p_workspace_id) in ('owner','admin','pm')
$$;

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  source_type text not null check (source_type in ('manual_note','email','meeting_minutes','ticket','conversation','document_reference')),
  title text not null,
  content text not null,
  source_reference text,
  confidence_level text not null default 'medium' check (confidence_level in ('low','medium','high')),
  status text not null default 'recorded' check (status in ('recorded','analyzed','analysis_failed','archived')),
  metadata jsonb not null default '{}'::jsonb,
  evidence_hash text not null,
  version integer not null default 1 check (version > 0),
  supersedes_evidence_item_id uuid references public.evidence_items(id) on delete restrict,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (evidence_hash ~ '^[a-f0-9]{64}$')
);

create table if not exists public.operational_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete restrict,
  signal_type text not null check (signal_type in ('scope_creep','schedule_risk','cost_risk','quality_risk','stakeholder_blocker','missing_approval','decision_needed','delivery_impediment','billing_risk','governance_gap')),
  severity text not null check (severity in ('low','medium','high','critical')),
  confidence_score numeric(5,2) not null check (confidence_score between 0 and 100),
  summary text not null,
  rationale text not null,
  detected_by text not null default 'system/deterministic:governance_signal_detector_v1',
  status text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique (evidence_item_id, signal_type)
);

create table if not exists public.risk_issue_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  signal_id uuid not null references public.operational_signals(id) on delete restrict,
  type text not null check (type in ('risk','issue','impediment','change','decision_needed')),
  title text not null,
  description text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  probability text not null check (probability in ('low','medium','high')),
  impact text not null check (impact in ('low','medium','high','critical')),
  owner_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','monitoring','mitigated','resolved','closed')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signal_id)
);

create table if not exists public.governance_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  related_entity_type text not null check (related_entity_type = 'risk_issue_record'),
  related_entity_id uuid not null references public.risk_issue_records(id) on delete restrict,
  protocol_reference text not null default 'PMFreak operational governance rules v1 — aligned with AOC concepts',
  rule_key text not null,
  authority_required text not null,
  evidence_required boolean not null default false,
  governance_status text not null check (governance_status in ('compliant','warning','violation','decision_required')),
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (related_entity_id, rule_key)
);

-- Reuse the existing recommendation table without breaking legacy RAID recommendations.
alter table public.recommended_actions alter column raid_item_id drop not null;
alter table public.recommended_actions add column if not exists governance_event_id uuid references public.governance_events(id) on delete restrict;
alter table public.recommended_actions add column if not exists risk_issue_id uuid references public.risk_issue_records(id) on delete restrict;
alter table public.recommended_actions add column if not exists recommendation text;
alter table public.recommended_actions add column if not exists urgency text check (urgency in ('low','medium','high','immediate'));
alter table public.recommended_actions add column if not exists suggested_owner_user_id uuid references auth.users(id) on delete set null;
alter table public.recommended_actions drop constraint if exists recommended_actions_status_check;
alter table public.recommended_actions add constraint recommended_actions_status_check check (status in ('proposed','accepted','rejected','modified','executed','deferred','converted_to_task'));
create unique index if not exists recommended_actions_governance_event_uidx on public.recommended_actions(governance_event_id) where governance_event_id is not null;

create table if not exists public.operational_decision_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  recommendation_id uuid references public.recommended_actions(id) on delete restrict,
  governance_event_id uuid references public.governance_events(id) on delete restrict,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decision text not null,
  decision_status text not null check (decision_status in ('accepted','rejected','modified','escalated','needs_more_evidence')),
  rationale text not null,
  authority_basis text not null,
  authority_evaluation jsonb not null,
  supersedes_decision_record_id uuid references public.operational_decision_records(id) on delete restrict,
  correction_reason text,
  created_at timestamptz not null default now(),
  check ((supersedes_decision_record_id is null and correction_reason is null) or (supersedes_decision_record_id is not null and correction_reason is not null))
);

create unique index if not exists operational_decision_terminal_recommendation_uidx
  on public.operational_decision_records(recommendation_id)
  where recommendation_id is not null and decision_status in ('accepted','rejected','modified');

create table if not exists public.decision_evidence_links (
  id uuid primary key default gen_random_uuid(),
  decision_record_id uuid not null references public.operational_decision_records(id) on delete restrict,
  evidence_item_id uuid not null references public.evidence_items(id) on delete restrict,
  link_reason text not null,
  evidence_hash_at_decision text not null,
  evidence_version_at_decision integer not null,
  evidence_title_snapshot text not null,
  evidence_source_reference_snapshot text,
  created_at timestamptz not null default now(),
  unique (decision_record_id, evidence_item_id),
  check (evidence_hash_at_decision ~ '^[a-f0-9]{64}$')
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  agent_key text not null,
  input_summary text not null,
  status text not null check (status in ('completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  error_message text
);

create table if not exists public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete restrict,
  output_type text not null,
  output_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists evidence_items_scope_created_idx on public.evidence_items(workspace_id, project_id, created_at desc);
create index if not exists operational_signals_scope_status_idx on public.operational_signals(workspace_id, project_id, status, created_at desc);
create index if not exists risk_issue_records_scope_status_idx on public.risk_issue_records(workspace_id, project_id, status, created_at desc);
create index if not exists governance_events_scope_status_idx on public.governance_events(workspace_id, project_id, governance_status, created_at desc);
create index if not exists operational_decisions_scope_created_idx on public.operational_decision_records(workspace_id, project_id, created_at desc);
create index if not exists decision_evidence_links_decision_idx on public.decision_evidence_links(decision_record_id);
create index if not exists agent_runs_scope_started_idx on public.agent_runs(workspace_id, project_id, started_at desc);

create or replace function public.compute_evidence_hash(p_title text, p_content text, p_source_reference text, p_source_type text, p_version integer)
returns text language sql immutable set search_path = public
as $$
  select encode(digest(concat_ws(E'\n', trim(p_title), trim(p_content), coalesce(trim(p_source_reference), ''), p_source_type, p_version::text), 'sha256'), 'hex')
$$;

create or replace function public.prepare_evidence_item()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.workspace_id = new.workspace_id) then
    raise exception 'project_workspace_mismatch';
  end if;
  if tg_op = 'INSERT' then
    if new.created_by <> auth.uid() and not public.operational_is_service_role() then raise exception 'evidence_actor_mismatch'; end if;
    new.evidence_hash := public.compute_evidence_hash(new.title, new.content, new.source_reference, new.source_type, new.version);
  else
    if row(old.workspace_id, old.project_id, old.created_by, old.supersedes_evidence_item_id)
      is distinct from row(new.workspace_id, new.project_id, new.created_by, new.supersedes_evidence_item_id) then
      raise exception 'evidence_identity_is_immutable';
    end if;
    if old.frozen_at is not null and row(old.workspace_id,old.project_id,old.created_by,old.source_type,old.title,old.content,old.source_reference,old.version)
      is distinct from row(new.workspace_id,new.project_id,new.created_by,new.source_type,new.title,new.content,new.source_reference,new.version) then
      raise exception 'frozen_evidence_is_immutable';
    end if;
    if row(old.title,old.content,old.source_reference,old.source_type) is distinct from row(new.title,new.content,new.source_reference,new.source_type) then
      new.version := old.version + 1;
      new.evidence_hash := public.compute_evidence_hash(new.title, new.content, new.source_reference, new.source_type, new.version);
    elsif new.version <> old.version then
      raise exception 'evidence_version_is_system_managed';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_prepare_evidence_item on public.evidence_items;
create trigger trg_prepare_evidence_item before insert or update on public.evidence_items for each row execute function public.prepare_evidence_item();

create or replace function public.enforce_operational_scope_consistency()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.workspace_id = new.workspace_id) then raise exception 'project_workspace_mismatch'; end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['operational_signals','risk_issue_records','governance_events','operational_decision_records','agent_runs'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_scope', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.enforce_operational_scope_consistency()', 'trg_' || t || '_scope', t);
  end loop;
end $$;

create or replace function public.reject_audit_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.operational_is_service_role() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception '% is append-only', tg_table_name;
end $$;

do $$ declare t text; begin
  foreach t in array array['operational_signals','governance_events','operational_decision_records','decision_evidence_links','agent_runs','agent_outputs'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_append_only', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.reject_audit_mutation()', 'trg_' || t || '_append_only', t);
  end loop;
end $$;

create or replace function public.enforce_operational_lineage()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'operational_signals' and not exists (
    select 1 from public.evidence_items e where e.id = new.evidence_item_id and e.workspace_id = new.workspace_id and e.project_id = new.project_id
  ) then raise exception 'signal_evidence_scope_mismatch'; end if;
  if tg_table_name = 'risk_issue_records' and not exists (
    select 1 from public.operational_signals s where s.id = new.signal_id and s.workspace_id = new.workspace_id and s.project_id = new.project_id
  ) then raise exception 'risk_signal_scope_mismatch'; end if;
  if tg_table_name = 'governance_events' and not exists (
    select 1 from public.risk_issue_records r where r.id = new.related_entity_id and r.workspace_id = new.workspace_id and r.project_id = new.project_id
  ) then raise exception 'governance_risk_scope_mismatch'; end if;
  if tg_table_name = 'recommended_actions' and tg_op = 'INSERT' and new.governance_event_id is not null and new.status <> 'proposed' then
    raise exception 'governed_recommendation_must_start_proposed';
  end if;
  if tg_table_name = 'recommended_actions' and new.governance_event_id is not null and not exists (
    select 1 from public.governance_events g join public.risk_issue_records r on r.id = g.related_entity_id
    where g.id = new.governance_event_id and g.workspace_id = new.workspace_id and g.project_id = new.project_id
      and new.risk_issue_id = r.id
  ) then raise exception 'recommendation_governance_lineage_mismatch'; end if;
  if tg_table_name = 'operational_decision_records' and new.recommendation_id is not null and not exists (
    select 1 from public.recommended_actions a
    where a.id = new.recommendation_id and a.workspace_id = new.workspace_id and a.project_id = new.project_id
      and a.governance_event_id = new.governance_event_id
  ) then raise exception 'decision_recommendation_lineage_mismatch'; end if;
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['operational_signals','risk_issue_records','governance_events','recommended_actions','operational_decision_records'] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_lineage', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.enforce_operational_lineage()', 'trg_' || t || '_lineage', t);
  end loop;
end $$;

create or replace function public.guard_risk_issue_human_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.operational_is_service_role() and
    row(old.workspace_id,old.project_id,old.signal_id,old.type,old.title,old.description,old.severity,old.probability,old.impact,old.created_at)
      is distinct from
    row(new.workspace_id,new.project_id,new.signal_id,new.type,new.title,new.description,new.severity,new.probability,new.impact,new.created_at) then
    raise exception 'risk_detector_fields_are_immutable';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_guard_risk_issue_human_update on public.risk_issue_records;
create trigger trg_guard_risk_issue_human_update before update on public.risk_issue_records
  for each row execute function public.guard_risk_issue_human_update();

create or replace function public.prepare_decision_evidence_link()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.operational_decision_records; e public.evidence_items; expected_evidence_id uuid;
begin
  select * into d from public.operational_decision_records where id = new.decision_record_id;
  select * into e from public.evidence_items where id = new.evidence_item_id;
  if d.id is null or e.id is null or d.workspace_id <> e.workspace_id or d.project_id <> e.project_id then
    raise exception 'decision_evidence_scope_mismatch';
  end if;
  if d.recommendation_id is not null then
    select s.evidence_item_id into expected_evidence_id
    from public.recommended_actions a
    join public.governance_events g on g.id = a.governance_event_id and g.related_entity_id = a.risk_issue_id
    join public.risk_issue_records r on r.id = a.risk_issue_id
    join public.operational_signals s on s.id = r.signal_id
    where a.id = d.recommendation_id and g.id = d.governance_event_id;
    if expected_evidence_id is null or expected_evidence_id <> e.id then
      raise exception 'decision_evidence_lineage_mismatch';
    end if;
  end if;
  new.evidence_hash_at_decision := e.evidence_hash;
  new.evidence_version_at_decision := e.version;
  new.evidence_title_snapshot := e.title;
  new.evidence_source_reference_snapshot := e.source_reference;
  update public.evidence_items set frozen_at = coalesce(frozen_at, now()), updated_at = now() where id = e.id;
  return new;
end $$;

drop trigger if exists trg_prepare_decision_evidence_link on public.decision_evidence_links;
create trigger trg_prepare_decision_evidence_link before insert on public.decision_evidence_links
  for each row execute function public.prepare_decision_evidence_link();

create or replace function public.guard_governed_recommendation_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.governance_event_id is not null and row(old.status,old.decision_reason,old.decided_by,old.decided_at,old.recommendation)
    is distinct from row(new.status,new.decision_reason,new.decided_by,new.decided_at,new.recommendation)
    and coalesce(current_setting('pmfreak.governed_decision_rpc', true), '') <> 'on'
    and not public.operational_is_service_role() then
    raise exception 'governed_recommendation_requires_evidence_backed_decision';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_governed_recommendation_update on public.recommended_actions;
create trigger trg_guard_governed_recommendation_update before update on public.recommended_actions for each row execute function public.guard_governed_recommendation_update();

-- RLS: read access follows workspace/project membership. Sensitive writes have no direct authenticated policy.
do $$ declare t text; begin
  foreach t in array array['evidence_items','operational_signals','risk_issue_records','governance_events','operational_decision_records','agent_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_scoped_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_scoped_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_scoped_update', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_access_operational_project(workspace_id, project_id))', t || '_scoped_select', t);
  end loop;
end $$;

create policy evidence_items_writer_insert on public.evidence_items for insert to authenticated
  with check (public.can_write_operational_project(workspace_id, project_id) and created_by = auth.uid());
create policy evidence_items_writer_update_unfrozen on public.evidence_items for update to authenticated
  using (public.can_write_operational_project(workspace_id, project_id) and frozen_at is null)
  with check (public.can_write_operational_project(workspace_id, project_id) and frozen_at is null and created_by = auth.uid());

create policy risk_issue_records_writer_update on public.risk_issue_records for update to authenticated
  using (public.can_write_operational_project(workspace_id, project_id))
  with check (public.can_write_operational_project(workspace_id, project_id));

alter table public.decision_evidence_links enable row level security;
drop policy if exists decision_evidence_links_scoped_select on public.decision_evidence_links;
drop policy if exists decision_evidence_links_scoped_insert on public.decision_evidence_links;
create policy decision_evidence_links_scoped_select on public.decision_evidence_links for select to authenticated using (
  exists (select 1 from public.operational_decision_records d where d.id = decision_record_id and public.can_access_operational_project(d.workspace_id, d.project_id))
);

alter table public.agent_outputs enable row level security;
drop policy if exists agent_outputs_scoped_select on public.agent_outputs;
drop policy if exists agent_outputs_scoped_insert on public.agent_outputs;
create policy agent_outputs_scoped_select on public.agent_outputs for select to authenticated using (
  exists (select 1 from public.agent_runs r where r.id = agent_run_id and public.can_access_operational_project(r.workspace_id, r.project_id))
);

-- Replace broad legacy recommendation policies. Governed rows are written only by the decision/materialization RPCs.
drop policy if exists "workspace members can read recommended_actions" on public.recommended_actions;
drop policy if exists "workspace members can insert recommended_actions" on public.recommended_actions;
drop policy if exists "workspace members can update recommended_actions" on public.recommended_actions;
drop policy if exists recommended_actions_scoped_select on public.recommended_actions;
drop policy if exists recommended_actions_scoped_insert on public.recommended_actions;
drop policy if exists recommended_actions_scoped_update on public.recommended_actions;
create policy recommended_actions_scoped_select on public.recommended_actions for select to authenticated
  using (public.can_access_operational_project(workspace_id, project_id));
create policy recommended_actions_legacy_writer_insert on public.recommended_actions for insert to authenticated
  with check (governance_event_id is null and public.can_write_operational_project(workspace_id, project_id));
create policy recommended_actions_legacy_writer_update on public.recommended_actions for update to authenticated
  using (governance_event_id is null and public.can_write_operational_project(workspace_id, project_id))
  with check (governance_event_id is null and public.can_write_operational_project(workspace_id, project_id));

create or replace function public.operational_authority_evaluation(p_workspace_id uuid, p_authority_required text, p_decision_status text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare actor_role text; allowed boolean := false; basis text; reason text;
begin
  actor_role := public.operational_workspace_role(p_workspace_id);
  if actor_role is null or actor_role = 'viewer' then
    allowed := false; reason := 'read_only_role';
  elsif actor_role in ('owner','admin') then
    allowed := true; basis := actor_role || ' workspace authority (PMFreak role mapping v1)'; reason := 'workspace_authority';
  elsif actor_role = 'pm' and p_decision_status in ('escalated','needs_more_evidence') then
    allowed := true; basis := 'pm escalation/review authority (PMFreak role mapping v1)'; reason := 'non_terminal_escalation_authority';
  elsif actor_role = 'pm' and p_authority_required in ('PM or sponsor','accountable owner','project manager operating authority','baseline review') then
    allowed := true; basis := 'pm project authority (PMFreak role mapping v1)'; reason := 'project_manager_authority';
  else
    allowed := false; reason := 'authority_requirement_not_satisfied';
  end if;
  return jsonb_build_object('allowed',allowed,'actor_role',actor_role,'authority_required',p_authority_required,'authority_basis',basis,'reason',reason,'mapping','pmfreak_role_mapping_v1');
end $$;

-- Transactional deterministic chain materialization. It derives all lineage from the evidence root.
create or replace function public.materialize_operational_chain(p_evidence_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.evidence_items; corpus text; detected record; signal_row public.operational_signals;
  risk_row public.risk_issue_records; gov_row public.governance_events; action_row public.recommended_actions;
  run_id uuid := gen_random_uuid(); chain jsonb := '[]'::jsonb; v_rule_key text; authority text; evidence_required boolean;
  governance_status text; explanation text; risk_type text; recommendation_text text; action_type text;
begin
  select * into e from public.evidence_items where id = p_evidence_item_id;
  if e.id is null then raise exception 'evidence_not_found'; end if;
  if not public.can_write_operational_project(e.workspace_id, e.project_id) then raise exception 'operational_write_denied'; end if;
  corpus := e.title || E'\n' || e.content;

  for detected in
    select * from (values
      ('scope_creep','high',92::numeric,'Work outside the agreed scope was requested.','outside scope|out of scope|fuera de (alcance|scope)|additional (work|activity|request)|actividad adicional|not in (the )?scope'),
      ('missing_approval','high',95::numeric,'Required approval is absent or unresolved.','without (formal )?approval|no (formal )?approval|sin aprobaci[oó]n|pending approval|not approved'),
      ('schedule_risk','high',84::numeric,'The evidence indicates schedule exposure.','delay(ed)?|behind schedule|fecha.*riesgo|deadline.*(miss|risk)|late delivery'),
      ('cost_risk','high',86::numeric,'The evidence indicates cost exposure.','cost overrun|over budget|budget.*risk|sobrecosto|presupuesto.*riesgo'),
      ('quality_risk','medium',80::numeric,'The evidence indicates a quality concern.','quality (issue|risk)|defect|rework|calidad.*riesgo'),
      ('stakeholder_blocker','high',85::numeric,'A stakeholder is blocking progress or alignment.','stakeholder.*block|client.*block|sponsor.*unavailable|bloqueo.*(cliente|stakeholder)'),
      ('delivery_impediment','high',88::numeric,'Delivery cannot proceed normally.','blocked|impediment|cannot proceed|no podemos avanzar|bloquead[oa]'),
      ('billing_risk','high',88::numeric,'Billing or recoverability is at risk.','invoice.*(risk|dispute)|billing.*(risk|dispute)|facturaci[oó]n.*riesgo|unbillable'),
      ('decision_needed','medium',82::numeric,'A human decision is needed to proceed.','decision (is )?needed|requires? a decision|se requiere decisi[oó]n|decidir antes'),
      ('governance_gap','medium',78::numeric,'A governance responsibility or control is missing.','no owner|without owner|sin responsable|governance gap|no process')
    ) as r(signal_type,severity,confidence_score,summary,pattern)
    where corpus ~* r.pattern
  loop
    insert into public.operational_signals(workspace_id,project_id,evidence_item_id,signal_type,severity,confidence_score,summary,rationale,detected_by,status)
    values(e.workspace_id,e.project_id,e.id,detected.signal_type,detected.severity,detected.confidence_score,detected.summary,
      'Deterministic rule matched explicit language in the recorded evidence. Detector: system/deterministic:governance_signal_detector_v1.',
      'system/deterministic:governance_signal_detector_v1','open')
    on conflict (evidence_item_id,signal_type) do nothing;
    select * into signal_row from public.operational_signals where evidence_item_id=e.id and signal_type=detected.signal_type;

    risk_type := case when detected.signal_type='scope_creep' then 'change' when detected.signal_type in ('missing_approval','decision_needed') then 'decision_needed'
      when detected.signal_type in ('delivery_impediment','stakeholder_blocker') then 'impediment' when detected.signal_type='governance_gap' then 'issue' else 'risk' end;
    insert into public.risk_issue_records(workspace_id,project_id,signal_id,type,title,description,severity,probability,impact,status)
    values(e.workspace_id,e.project_id,signal_row.id,risk_type,signal_row.summary,signal_row.rationale,signal_row.severity,
      case when signal_row.confidence_score>=85 then 'high' when signal_row.confidence_score>=65 then 'medium' else 'low' end,signal_row.severity,'open')
    on conflict (signal_id) do nothing;
    select * into risk_row from public.risk_issue_records where signal_id=signal_row.id;

    v_rule_key := case detected.signal_type when 'missing_approval' then 'approval_required_v1' when 'scope_creep' then 'scope_authority_v1'
      when 'billing_risk' then 'billing_evidence_v1' when 'stakeholder_blocker' then 'stakeholder_escalation_v1'
      when 'delivery_impediment' then 'impediment_accountability_v1' else 'operational_signal_review_v1' end;
    authority := case detected.signal_type when 'missing_approval' then 'authorized approver' when 'scope_creep' then 'sponsor or PMO'
      when 'billing_risk' then 'commercial owner' when 'stakeholder_blocker' then 'PM or sponsor'
      when 'delivery_impediment' then 'accountable owner' else 'baseline review' end;
    evidence_required := detected.signal_type in ('missing_approval','scope_creep','billing_risk');
    governance_status := case detected.signal_type when 'missing_approval' then 'decision_required' when 'scope_creep' then 'decision_required'
      when 'billing_risk' then 'warning' when 'stakeholder_blocker' then 'decision_required'
      when 'delivery_impediment' then case when risk_row.owner_user_id is not null and risk_row.due_date is not null then 'compliant' else 'violation' end
      else 'compliant' end;
    explanation := case detected.signal_type when 'missing_approval' then 'Formal approval is missing; an authorized human decision and approval evidence are required.'
      when 'scope_creep' then 'A scope change requires sponsor or PMO authority and a traceable decision before execution.'
      when 'billing_risk' then 'Billing exposure requires formal commercial evidence before closure.'
      when 'stakeholder_blocker' then 'The blocker requires escalation or an explicit authorized human decision.'
      when 'delivery_impediment' then 'Delivery impediments require an accountable owner and target date.'
      else 'No elevated control is required by the deterministic v1 rule set.' end;
    insert into public.governance_events(workspace_id,project_id,related_entity_type,related_entity_id,rule_key,authority_required,evidence_required,governance_status,explanation)
    values(e.workspace_id,e.project_id,'risk_issue_record',risk_row.id,v_rule_key,authority,evidence_required,governance_status,explanation)
    on conflict (related_entity_id,rule_key) do nothing;
    select g.* into gov_row from public.governance_events g where g.related_entity_id = risk_row.id and g.rule_key = v_rule_key;

    recommendation_text := case when detected.signal_type in ('scope_creep','missing_approval') then 'Request formal scope and approval confirmation before executing the requested work.'
      when detected.signal_type='billing_risk' then 'Collect formal commercial evidence and confirm billability with the accountable owner.'
      when detected.signal_type='stakeholder_blocker' then 'Record an escalation decision with an explicit response deadline.'
      when detected.signal_type='delivery_impediment' then 'Assign an accountable owner and target date before the next delivery checkpoint.'
      else 'Review the signal with the project owner and record the agreed response.' end;
    action_type := case when detected.signal_type='missing_approval' then 'request_approval' when detected.signal_type='scope_creep' then 'validate_scope' else 'follow_up' end;
    insert into public.recommended_actions(workspace_id,project_id,raid_item_id,governance_event_id,risk_issue_id,title,description,recommendation,recommended_action_type,status,confidence_score,impact_level,rationale,urgency,evidence_summary,source_signal_id,fingerprint)
    values(e.workspace_id,e.project_id,null,gov_row.id,risk_row.id,'Respond to '||replace(detected.signal_type,'_',' '),recommendation_text,recommendation_text,action_type,'proposed',
      detected.confidence_score,detected.severity,jsonb_build_object('governanceEventId',gov_row.id,'signalId',signal_row.id,'method','deterministic_rule_v1'),
      case when detected.severity='critical' then 'immediate' when detected.severity='high' then 'high' else 'medium' end,
      jsonb_build_object('evidenceItemId',e.id,'evidenceHash',e.evidence_hash,'evidenceVersion',e.version,'signalId',signal_row.id),signal_row.id,
      encode(digest(e.workspace_id::text||':'||gov_row.id::text,'sha256'),'hex'))
    on conflict (governance_event_id) where governance_event_id is not null do nothing;
    select * into action_row from public.recommended_actions where governance_event_id=gov_row.id;
    chain := chain || jsonb_build_array(jsonb_build_object('signal',to_jsonb(signal_row),'riskIssue',to_jsonb(risk_row),'governanceEvent',to_jsonb(gov_row),'recommendation',to_jsonb(action_row)));
  end loop;

  insert into public.agent_runs(id,workspace_id,project_id,agent_key,input_summary,status,started_at,completed_at)
  values(run_id,e.workspace_id,e.project_id,'system/deterministic:governance_signal_detector_v1',e.title,'completed',now(),now());
  insert into public.agent_outputs(agent_run_id,output_type,output_payload)
  values(run_id,'operational_chain',jsonb_build_object('detectorKind','system/deterministic','evidenceItemId',e.id,'chain',chain));
  update public.evidence_items set status='analyzed', updated_at=now() where id=e.id;
  return jsonb_build_object('evidenceItemId',e.id,'detector','system/deterministic:governance_signal_detector_v1','chain',chain,'agentRunId',run_id);
end $$;

create or replace function public.record_operational_chain_failure(p_evidence_item_id uuid, p_error_message text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.evidence_items;
begin
  select * into e from public.evidence_items where id=p_evidence_item_id;
  if e.id is null or not public.can_write_operational_project(e.workspace_id,e.project_id) then raise exception 'operational_write_denied'; end if;
  insert into public.agent_runs(workspace_id,project_id,agent_key,input_summary,status,error_message)
  values(e.workspace_id,e.project_id,'system/deterministic:governance_signal_detector_v1',e.title,'failed',left(p_error_message,1000));
  update public.evidence_items set status='analysis_failed',updated_at=now() where id=e.id and frozen_at is null;
end $$;

-- Atomic authority-checked human decision. Governed lineage and evidence are derived server-side.
create or replace function public.record_operational_decision(
  p_recommendation_id uuid,
  p_manual_evidence_item_id uuid,
  p_decision text,
  p_decision_status text,
  p_rationale text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.recommended_actions; g public.governance_events; r public.risk_issue_records; s public.operational_signals; e public.evidence_items;
  d public.operational_decision_records; authority jsonb; target_status text; authority_required text := 'baseline review';
begin
  if p_decision_status not in ('accepted','rejected','modified','escalated','needs_more_evidence') then raise exception 'invalid_decision_status'; end if;
  if nullif(trim(p_decision),'') is null or nullif(trim(p_rationale),'') is null then raise exception 'decision_and_rationale_required'; end if;

  if p_recommendation_id is not null then
    select * into a from public.recommended_actions where id=p_recommendation_id and governance_event_id is not null;
    if a.id is null then raise exception 'governed_recommendation_not_found'; end if;
    if not public.can_access_operational_project(a.workspace_id,a.project_id) then raise exception 'decision_access_denied'; end if;
    select * into g from public.governance_events where id=a.governance_event_id and related_entity_id=a.risk_issue_id;
    select * into r from public.risk_issue_records where id=a.risk_issue_id;
    select * into s from public.operational_signals where id=r.signal_id;
    select * into e from public.evidence_items where id=s.evidence_item_id;
    if g.id is null or r.id is null or s.id is null or e.id is null then raise exception 'governed_lineage_incomplete'; end if;
    if p_manual_evidence_item_id is not null and p_manual_evidence_item_id <> e.id then raise exception 'decision_evidence_lineage_mismatch'; end if;
    authority_required := g.authority_required;
  else
    select * into e from public.evidence_items where id=p_manual_evidence_item_id;
    if e.id is null or not public.can_access_operational_project(e.workspace_id,e.project_id) then raise exception 'manual_decision_evidence_not_found'; end if;
  end if;

  authority := public.operational_authority_evaluation(e.workspace_id,authority_required,p_decision_status);
  if not coalesce((authority->>'allowed')::boolean,false) then raise exception 'operational_decision_authority_denied:%',authority->>'reason'; end if;

  insert into public.operational_decision_records(workspace_id,project_id,recommendation_id,governance_event_id,decided_by,decision,decision_status,rationale,authority_basis,authority_evaluation)
  values(e.workspace_id,e.project_id,a.id,g.id,auth.uid(),trim(p_decision),p_decision_status,trim(p_rationale),authority->>'authority_basis',authority)
  returning * into d;
  insert into public.decision_evidence_links(decision_record_id,evidence_item_id,link_reason,evidence_hash_at_decision,evidence_version_at_decision,evidence_title_snapshot,evidence_source_reference_snapshot)
  values(d.id,e.id,'Evidence derived from the governed recommendation lineage.',e.evidence_hash,e.version,e.title,e.source_reference);

  if a.id is not null then
    target_status := case when p_decision_status in ('escalated','needs_more_evidence') then 'proposed' else p_decision_status end;
    perform set_config('pmfreak.governed_decision_rpc','on',true);
    update public.recommended_actions set status=target_status,decision_reason=p_rationale,decided_by=auth.uid(),decided_at=now(),updated_at=now() where id=a.id;
  end if;
  return jsonb_build_object('decision',to_jsonb(d),'evidenceLinked',1,'authorityEvaluation',authority);
end $$;

create or replace function public.get_operational_assurance_summary(p_workspace_id uuid,p_project_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare result jsonb;
begin
  if not public.can_access_operational_project(p_workspace_id,p_project_id) then raise exception 'assurance_access_denied'; end if;
  select jsonb_build_object(
    'scope','project','workspaceId',p_workspace_id,'projectId',p_project_id,'asOf',now(),
    'totalGovernanceEvents',(select count(*) from public.governance_events where workspace_id=p_workspace_id and project_id=p_project_id),
    'decisionRequiredCount',(select count(*) from public.governance_events where workspace_id=p_workspace_id and project_id=p_project_id and governance_status='decision_required'),
    'violationsCount',(select count(*) from public.governance_events where workspace_id=p_workspace_id and project_id=p_project_id and governance_status='violation'),
    'openRecommendations',(select count(*) from public.recommended_actions where workspace_id=p_workspace_id and project_id=p_project_id and governance_event_id is not null and status='proposed'),
    'unresolvedRisksIssues',(select count(*) from public.risk_issue_records where workspace_id=p_workspace_id and project_id=p_project_id and status not in ('resolved','closed')),
    'evidenceLinkedDecisionsCount',(select count(distinct d.id) from public.operational_decision_records d join public.decision_evidence_links l on l.decision_record_id=d.id where d.workspace_id=p_workspace_id and d.project_id=p_project_id),
    'evidenceWithoutSignalCount',(select count(*) from public.evidence_items e where e.workspace_id=p_workspace_id and e.project_id=p_project_id and not exists(select 1 from public.operational_signals s where s.evidence_item_id=e.id)),
    'incompleteChainCount',(select count(*) from public.operational_signals s where s.workspace_id=p_workspace_id and s.project_id=p_project_id and not exists(
      select 1 from public.risk_issue_records r join public.governance_events g on g.related_entity_id=r.id join public.recommended_actions a on a.governance_event_id=g.id and a.risk_issue_id=r.id where r.signal_id=s.id
    ))
  ) into result;
  return result;
end $$;

revoke all on function public.materialize_operational_chain(uuid) from public;
revoke all on function public.record_operational_chain_failure(uuid,text) from public;
revoke all on function public.record_operational_decision(uuid,uuid,text,text,text) from public;
revoke all on function public.get_operational_assurance_summary(uuid,uuid) from public;
grant execute on function public.materialize_operational_chain(uuid) to authenticated;
grant execute on function public.record_operational_chain_failure(uuid,text) to authenticated;
grant execute on function public.record_operational_decision(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.get_operational_assurance_summary(uuid,uuid) to authenticated;


-- Limit helper visibility: clients may evaluate only their own current JWT scope.
revoke all on function public.operational_workspace_role(uuid) from public;
revoke all on function public.operational_authority_evaluation(uuid,text,text) from public;
revoke all on function public.can_access_operational_project(uuid,uuid) from public;
revoke all on function public.can_write_operational_project(uuid,uuid) from public;
grant execute on function public.can_access_operational_project(uuid,uuid) to authenticated;
grant execute on function public.can_write_operational_project(uuid,uuid) to authenticated;
