-- Operational Runtime Memory schema
-- Provides persistent operational cognition infrastructure on top of the vault
-- digestive system. Unlike vault nutrients (which decay), unresolved records
-- here accumulate pressure weight over time, reflecting the real-world cost of
-- leaving operational tension unaddressed.
--
-- Three tables:
--   operational_memory_runtime_records      — normalized operational signals with causality lineage
--   operational_intervention_records — history of attempts to resolve each record
--
-- Tenant isolation uses company_id (text) + current_company_id() RLS,
-- consistent with the operational_memory_entries domain.
-- workspace_id and project_id provide sub-company scoping.

-- ─── Operational Memory Records ───────────────────────────────────────────────

create table if not exists public.operational_memory_runtime_records (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,

  -- Extended scope dimensions
  conversation_id text null,
  intervention_id text null,
  stakeholder_id text null,

  -- Record classification
  record_type text not null check (record_type in (
    'blocker', 'risk', 'escalation', 'decision', 'commitment',
    'dependency', 'stakeholder_signal', 'delivery_pressure',
    'governance_gap', 'timeline_signal', 'intervention', 'recovery'
  )),

  summary text not null,
  detail text null,

  -- Causality lineage
  parent_record_id uuid null references public.operational_memory_runtime_records(id) on delete set null,
  lineage_type text null check (lineage_type in (
    'caused_by', 'triggers', 'blocks', 'escalates_to',
    'resolved_by', 'depends_on', 'related_to'
  )),

  -- Resolution state
  resolution_status text not null default 'unresolved' check (resolution_status in (
    'unresolved', 'in_progress', 'resolved', 'escalated', 'abandoned'
  )),

  -- Operational weighting (0..1 each)
  continuity_weight numeric(5,4) not null default 0.5,
  operational_pressure_weight numeric(5,4) not null default 0.5,
  escalation_weight numeric(5,4) not null default 0.3,
  unresolved_weight numeric(5,4) not null default 0.5,
  delivery_impact_weight numeric(5,4) not null default 0.5,

  confidence numeric(5,4) not null default 0.7,

  -- Ingestion provenance
  ingestion_source text not null check (ingestion_source in (
    'chat_conversation', 'operational_summary', 'uploaded_document',
    'ai_intervention', 'manual_note', 'escalation_event',
    'governance_event', 'connector_signal'
  )),
  source_ref text null,

  -- Vault linkage
  nutrient_ids jsonb not null default '[]'::jsonb,

  -- Intervention tracking
  intervention_count integer not null default 0,

  -- Timestamps
  first_observed_at timestamptz not null default now(),
  last_observed_at timestamptz not null default now(),
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_memory_runtime_records_company_idx
  on public.operational_memory_runtime_records (company_id, created_at desc);

create index if not exists operational_memory_runtime_records_workspace_idx
  on public.operational_memory_runtime_records (workspace_id, created_at desc)
  where workspace_id is not null;

create index if not exists operational_memory_runtime_records_project_idx
  on public.operational_memory_runtime_records (company_id, project_id, created_at desc)
  where project_id is not null;

create index if not exists operational_memory_runtime_records_unresolved_idx
  on public.operational_memory_runtime_records (company_id, resolution_status, first_observed_at asc)
  where resolution_status in ('unresolved', 'escalated', 'in_progress');

create index if not exists operational_memory_runtime_records_type_idx
  on public.operational_memory_runtime_records (company_id, record_type, resolution_status);

create index if not exists operational_memory_runtime_records_lineage_idx
  on public.operational_memory_runtime_records (parent_record_id)
  where parent_record_id is not null;

alter table public.operational_memory_runtime_records enable row level security;

drop policy if exists "tenant access operational_memory_runtime_records" on public.operational_memory_runtime_records;

create policy "tenant access operational_memory_runtime_records"
  on public.operational_memory_runtime_records
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);

-- ─── Operational Intervention Records ────────────────────────────────────────

create table if not exists public.operational_intervention_records (
  id uuid primary key default gen_random_uuid(),
  memory_record_id uuid not null references public.operational_memory_runtime_records(id) on delete cascade,
  company_id text not null,
  workspace_id uuid null references public.workspaces(id) on delete set null,
  project_id uuid null references public.projects(id) on delete set null,

  intervention_type text not null check (intervention_type in (
    'escalation', 'blocker_resolution', 'stakeholder_engagement',
    'process_change', 'dependency_resolution', 'governance_action'
  )),

  description text not null,
  attempted_at timestamptz not null default now(),
  outcome text not null default 'pending' check (outcome in (
    'succeeded', 'failed', 'partial', 'pending', 'abandoned'
  )),
  resolved_at timestamptz null,
  failure_reason text null,
  actor_ref text null,

  created_at timestamptz not null default now()
);

create index if not exists operational_intervention_records_memory_idx
  on public.operational_intervention_records (memory_record_id, attempted_at asc);

create index if not exists operational_intervention_records_company_idx
  on public.operational_intervention_records (company_id, attempted_at desc);

create index if not exists operational_intervention_records_outcome_idx
  on public.operational_intervention_records (company_id, outcome)
  where outcome in ('pending', 'failed');

alter table public.operational_intervention_records enable row level security;

drop policy if exists "tenant access operational_intervention_records" on public.operational_intervention_records;

create policy "tenant access operational_intervention_records"
  on public.operational_intervention_records
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);
