-- ─────────────────────────────────────────────────────────────────────────────
-- Personal Portfolio Intelligence
-- EPIC 5 — Sprint 1: Foundation
--
-- Creates the personal portfolio entity that lets a PM aggregate, prioritize,
-- and get attention-allocation guidance across all their active projects.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── personal_portfolios ──────────────────────────────────────────────────────

create table if not exists public.personal_portfolios (
  id                uuid primary key default gen_random_uuid(),

  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  owner_id          uuid not null,

  name              text not null,
  description       text,

  status            text not null default 'active'
                      check (status in ('active', 'archived')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (id, workspace_id)
);

create index if not exists personal_portfolios_owner_idx
  on public.personal_portfolios(workspace_id, owner_id);

create index if not exists personal_portfolios_status_idx
  on public.personal_portfolios(workspace_id, status);

alter table public.personal_portfolios enable row level security;

create policy "portfolio_owner_access"
  on public.personal_portfolios
  for all
  to authenticated
  using (is_workspace_member(workspace_id) and owner_id = auth.uid());

-- ─── personal_portfolio_projects ──────────────────────────────────────────────

create table if not exists public.personal_portfolio_projects (
  id              uuid primary key default gen_random_uuid(),

  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  portfolio_id    uuid not null references public.personal_portfolios(id) on delete cascade,
  project_id      uuid not null,

  added_at        timestamptz not null default now(),

  unique (portfolio_id, project_id)
);

create index if not exists personal_portfolio_projects_portfolio_idx
  on public.personal_portfolio_projects(workspace_id, portfolio_id);

create index if not exists personal_portfolio_projects_project_idx
  on public.personal_portfolio_projects(workspace_id, project_id);

alter table public.personal_portfolio_projects enable row level security;

create policy "portfolio_projects_owner_access"
  on public.personal_portfolio_projects
  for all
  to authenticated
  using (
    exists (
      select 1 from public.personal_portfolios pp
      where pp.id = portfolio_id
        and pp.workspace_id = workspace_id
        and pp.owner_id = auth.uid()
    )
  );

-- ─── personal_portfolio_snapshots ─────────────────────────────────────────────

create table if not exists public.personal_portfolio_snapshots (
  id                        uuid primary key default gen_random_uuid(),

  workspace_id              uuid not null references public.workspaces(id) on delete cascade,
  portfolio_id              uuid not null references public.personal_portfolios(id) on delete cascade,

  snapshot_status           text not null default 'generated'
                              check (snapshot_status in ('generated', 'validated', 'archived')),

  -- Sprint 1: aggregate health counters
  total_projects            integer not null default 0,
  healthy_projects          integer not null default 0,
  warning_projects          integer not null default 0,
  critical_projects         integer not null default 0,

  overall_health            numeric(5,2) not null default 100
                              check (overall_health between 0 and 100),

  -- Sprint 2: prioritized project ids (ordered)
  ranked_project_ids        uuid[] not null default '{}',

  -- Sprint 3: attention allocation { projectId: percentage }
  attention_allocation      jsonb not null default '{}',

  -- Sprint 4: neglect consequences { projectId: consequence payload }
  neglect_consequences      jsonb not null default '{}',

  -- Sprint 5: command center payload
  command_center_payload    jsonb not null default '{}',

  snapshot_payload          jsonb not null default '{}',

  generated_at              timestamptz not null default now(),
  created_at                timestamptz not null default now(),

  unique (id, workspace_id)
);

create index if not exists personal_portfolio_snapshots_portfolio_idx
  on public.personal_portfolio_snapshots(workspace_id, portfolio_id, created_at desc);

create index if not exists personal_portfolio_snapshots_status_idx
  on public.personal_portfolio_snapshots(workspace_id, snapshot_status);

alter table public.personal_portfolio_snapshots enable row level security;

create policy "portfolio_snapshots_owner_access"
  on public.personal_portfolio_snapshots
  for all
  to authenticated
  using (
    exists (
      select 1 from public.personal_portfolios pp
      where pp.id = portfolio_id
        and pp.workspace_id = workspace_id
        and pp.owner_id = auth.uid()
    )
  );

-- ─── personal_portfolio_attention_items ───────────────────────────────────────

create table if not exists public.personal_portfolio_attention_items (
  id                uuid primary key default gen_random_uuid(),

  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  snapshot_id       uuid not null references public.personal_portfolio_snapshots(id) on delete cascade,
  project_id        uuid not null,

  attention_type    text not null check (attention_type in (
                      'critical_signal',
                      'overdue_commitment',
                      'execution_drift',
                      'authority_gap',
                      'low_health_score',
                      'neglect_risk',
                      'capacity_conflict',
                      'escalation_pending'
                    )),

  severity          text not null check (severity in ('low', 'medium', 'high', 'critical')),

  title             text not null,
  description       text,
  recommended_action text,

  created_at        timestamptz not null default now()
);

create index if not exists personal_portfolio_attention_items_snapshot_idx
  on public.personal_portfolio_attention_items(workspace_id, snapshot_id);

create index if not exists personal_portfolio_attention_items_project_idx
  on public.personal_portfolio_attention_items(workspace_id, project_id);

create index if not exists personal_portfolio_attention_items_severity_idx
  on public.personal_portfolio_attention_items(workspace_id, severity);

alter table public.personal_portfolio_attention_items enable row level security;

create policy "portfolio_attention_items_owner_access"
  on public.personal_portfolio_attention_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.personal_portfolio_snapshots pps
      join public.personal_portfolios pp on pp.id = pps.portfolio_id
      where pps.id = snapshot_id
        and pp.workspace_id = workspace_id
        and pp.owner_id = auth.uid()
    )
  );
