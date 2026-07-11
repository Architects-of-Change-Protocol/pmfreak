-- Dashboard Source Snapshots schema
-- Provides durable, tenant-scoped persistence for dashboard source snapshots.
-- Implements the storage contract defined in Track 8.8 of the PMO Dashboard
-- Runtime Integration track.
--
-- Snapshots represent point-in-time hydrated payloads for each DashboardSourceKind:
--   executive_dashboard_report
--   intervention_report
--   decision_simulation_reports
--   conflict_report
--
-- Tenant isolation is enforced via tenant_id (text). tenant_id corresponds to
-- the company/organization scope used throughout the PMFreak runtime. RLS is
-- enabled using current_company_id() consistent with the established project
-- convention. Callers must never query without supplying tenant_id.
--
-- workspace_id and portfolio_id provide sub-tenant scoping and are nullable.
-- The scope tuple (tenant_id, workspace_id, portfolio_id, source_kind) identifies
-- the latest snapshot for a given dashboard context.

create table if not exists public.dashboard_source_snapshots (
  id text primary key,
  tenant_id text not null,
  workspace_id text null,
  portfolio_id text null,
  source_kind text not null check (source_kind in (
    'executive_dashboard_report',
    'intervention_report',
    'decision_simulation_reports',
    'conflict_report'
  )),
  payload jsonb not null,
  generated_at timestamptz not null,
  expires_at timestamptz null,
  schema_version text not null,
  runtime_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Primary scope index: supports scope-filtered latest-snapshot queries
create index if not exists idx_dashboard_source_snapshots_scope
  on public.dashboard_source_snapshots (tenant_id, workspace_id, portfolio_id, source_kind, generated_at desc);

-- Tenant-level index: supports listing all snapshots for a tenant
create index if not exists idx_dashboard_source_snapshots_tenant
  on public.dashboard_source_snapshots (tenant_id);

-- Enable row-level security
alter table public.dashboard_source_snapshots enable row level security;

-- RLS policy: tenant isolation via current_company_id()
-- tenant_id in this module maps to the company/organization scope.
-- Adjust the column name here if your auth setup resolves differently.
drop policy if exists "tenant access dashboard_source_snapshots" on public.dashboard_source_snapshots;

create policy "tenant access dashboard_source_snapshots"
  on public.dashboard_source_snapshots
  for all
  to authenticated
  using (public.current_company_id() = tenant_id)
  with check (public.current_company_id() = tenant_id);
