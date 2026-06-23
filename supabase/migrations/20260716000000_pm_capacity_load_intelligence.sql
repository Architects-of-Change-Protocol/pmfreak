-- PM Capacity & Load Intelligence
-- EPIC 6 Sprint 3: Transform PM performance into operational sustainability intelligence.
--
-- Tables created:
--   pm_capacity_snapshots  — Historical PM capacity and load snapshots
--   pm_capacity_metrics    — Individual metric records per capacity snapshot
--   pm_capacity_evidence   — Evidence sources that contributed to a capacity snapshot

-- ─────────────────────────────────────────────────────────────────────────────
-- pm_capacity_snapshots
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pm_capacity_snapshots (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  pm_id                   uuid        not null references project_managers(id) on delete cascade,

  capacity_score          numeric(7,2) not null
                            check (capacity_score >= 0),
  load_score              numeric(7,2) not null
                            check (load_score >= 0),
  utilization_percentage  numeric(7,2) not null
                            check (utilization_percentage >= 0),

  burn_risk               text        not null
                            check (burn_risk in ('none', 'low', 'medium', 'high', 'critical')),
  capacity_status         text        not null
                            check (capacity_status in ('underutilized', 'healthy', 'busy', 'overloaded', 'critical')),

  recommended_action      text        not null,

  snapshot_payload        jsonb       not null default '{}',

  generated_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists pm_capacity_snapshots_workspace_pm_idx
  on pm_capacity_snapshots (workspace_id, pm_id, generated_at desc);

create index if not exists pm_capacity_snapshots_workspace_status_idx
  on pm_capacity_snapshots (workspace_id, capacity_status);

create index if not exists pm_capacity_snapshots_workspace_risk_idx
  on pm_capacity_snapshots (workspace_id, burn_risk);

alter table pm_capacity_snapshots enable row level security;

create policy "workspace members can read pm_capacity_snapshots"
  on pm_capacity_snapshots for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_capacity_snapshots.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pm_capacity_snapshots"
  on pm_capacity_snapshots for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_capacity_snapshots.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pm_capacity_metrics
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pm_capacity_metrics (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  capacity_snapshot_id    uuid        not null references pm_capacity_snapshots(id) on delete cascade,

  metric_name             text        not null,
  metric_value            numeric(7,4) not null,
  metric_weight           numeric(5,4) not null default 1.0
                            check (metric_weight >= 0 and metric_weight <= 1),
  metric_status           text        not null
                            check (metric_status in ('underutilized', 'healthy', 'busy', 'overloaded', 'critical')),

  created_at              timestamptz not null default now()
);

create index if not exists pm_capacity_metrics_snapshot_idx
  on pm_capacity_metrics (workspace_id, capacity_snapshot_id);

create index if not exists pm_capacity_metrics_name_idx
  on pm_capacity_metrics (workspace_id, metric_name);

alter table pm_capacity_metrics enable row level security;

create policy "workspace members can read pm_capacity_metrics"
  on pm_capacity_metrics for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_capacity_metrics.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pm_capacity_metrics"
  on pm_capacity_metrics for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_capacity_metrics.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pm_capacity_evidence
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pm_capacity_evidence (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  capacity_snapshot_id    uuid        not null references pm_capacity_snapshots(id) on delete cascade,

  source_entity_type      text        not null,
  source_entity_id        uuid        not null,

  evidence_type           text        not null,
  contribution_weight     numeric(5,4) not null default 1.0
                            check (contribution_weight >= 0 and contribution_weight <= 1),

  created_at              timestamptz not null default now()
);

create index if not exists pm_capacity_evidence_snapshot_idx
  on pm_capacity_evidence (workspace_id, capacity_snapshot_id);

create index if not exists pm_capacity_evidence_source_idx
  on pm_capacity_evidence (workspace_id, source_entity_type, source_entity_id);

alter table pm_capacity_evidence enable row level security;

create policy "workspace members can read pm_capacity_evidence"
  on pm_capacity_evidence for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_capacity_evidence.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pm_capacity_evidence"
  on pm_capacity_evidence for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_capacity_evidence.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
