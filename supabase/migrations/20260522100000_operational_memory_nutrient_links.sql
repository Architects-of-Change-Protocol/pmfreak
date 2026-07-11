-- Nutrient–Operational Memory Bridge Link Table
--
-- Stores bidirectional links between vault_nutrients and
-- operational_memory_records. The vault uses workspace_id scoping while
-- operational memory uses company_id scoping; this table bridges both.
--
-- Tenant isolation: company_id (text) + current_company_id() RLS, consistent
-- with the operational_memory_records domain. workspace_id is also stored for
-- vault-side lookups.

create table if not exists public.operational_memory_nutrient_links (
  id uuid primary key default gen_random_uuid(),

  -- Tenant scoping (both systems)
  company_id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,

  -- The vault nutrient (no FK — vault_nutrients uses a different tenant scope;
  -- referential integrity is enforced at the application layer)
  nutrient_id uuid not null,

  -- The operational memory record
  operational_memory_record_id uuid not null
    references public.operational_memory_runtime_records(id) on delete cascade,

  -- Link classification
  link_type text not null check (link_type in (
    'promoted_from',
    'recurrence_match',
    'escalation_match',
    'resolved_followup',
    'lineage_reference'
  )),

  confidence numeric(5,4) not null default 0.7,

  created_at timestamptz not null default now(),

  -- Flexible metadata (signal category, severity, recurrence outcome, etc.)
  metadata jsonb not null default '{}'::jsonb
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists omn_links_company_idx
  on public.operational_memory_nutrient_links (company_id, created_at desc);

create index if not exists omn_links_workspace_idx
  on public.operational_memory_nutrient_links (workspace_id, created_at desc);

create index if not exists omn_links_project_idx
  on public.operational_memory_nutrient_links (workspace_id, project_id, created_at desc)
  where project_id is not null;

create index if not exists omn_links_nutrient_idx
  on public.operational_memory_nutrient_links (nutrient_id);

create index if not exists omn_links_record_idx
  on public.operational_memory_nutrient_links (operational_memory_record_id);

create index if not exists omn_links_link_type_idx
  on public.operational_memory_nutrient_links (company_id, link_type, created_at desc);

-- Unique constraint: a nutrient can only be linked to the same memory record once
create unique index if not exists omn_links_unique_nutrient_record
  on public.operational_memory_nutrient_links (nutrient_id, operational_memory_record_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.operational_memory_nutrient_links enable row level security;

drop policy if exists "tenant access operational_memory_nutrient_links" on public.operational_memory_nutrient_links;

create policy "tenant access operational_memory_nutrient_links"
  on public.operational_memory_nutrient_links
  for all
  to authenticated
  using (public.current_company_id() = company_id)
  with check (public.current_company_id() = company_id);
