-- PM Performance Engine
-- EPIC 6 Sprint 2: Transform PM assignments into measurable performance evidence.
--
-- Tables created:
--   pm_performance_snapshots  — Historical PM performance snapshots
--   pm_performance_metrics    — Individual metric records per snapshot
--   pm_performance_evidence   — Evidence sources that contributed to a snapshot

-- ─────────────────────────────────────────────────────────────────────────────
-- pm_performance_snapshots
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pm_performance_snapshots (
  id                            uuid        primary key default gen_random_uuid(),

  workspace_id                  uuid        not null references workspaces(id) on delete cascade,
  pm_id                         uuid        not null references project_managers(id) on delete cascade,

  governance_score              numeric(5,2) not null
                                  check (governance_score >= 0 and governance_score <= 100),
  execution_score               numeric(5,2) not null
                                  check (execution_score >= 0 and execution_score <= 100),
  prediction_accuracy_score     numeric(5,2) not null
                                  check (prediction_accuracy_score >= 0 and prediction_accuracy_score <= 100),
  decision_effectiveness_score  numeric(5,2) not null
                                  check (decision_effectiveness_score >= 0 and decision_effectiveness_score <= 100),
  portfolio_health_score        numeric(5,2) not null
                                  check (portfolio_health_score >= 0 and portfolio_health_score <= 100),
  overall_score                 numeric(5,2) not null
                                  check (overall_score >= 0 and overall_score <= 100),

  performance_status            text        not null
                                  check (performance_status in ('excellent', 'strong', 'stable', 'warning', 'critical')),

  snapshot_payload              jsonb       not null default '{}',

  generated_at                  timestamptz not null default now(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index if not exists pm_performance_snapshots_workspace_pm_idx
  on pm_performance_snapshots (workspace_id, pm_id, generated_at desc);

create index if not exists pm_performance_snapshots_workspace_status_idx
  on pm_performance_snapshots (workspace_id, performance_status);

create index if not exists pm_performance_snapshots_overall_score_idx
  on pm_performance_snapshots (workspace_id, overall_score desc);

alter table pm_performance_snapshots enable row level security;

create policy "workspace members can read pm_performance_snapshots"
  on pm_performance_snapshots for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_performance_snapshots.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pm_performance_snapshots"
  on pm_performance_snapshots for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_performance_snapshots.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pm_performance_metrics
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pm_performance_metrics (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  performance_snapshot_id uuid        not null references pm_performance_snapshots(id) on delete cascade,

  metric_domain           text        not null
                            check (metric_domain in ('governance', 'execution', 'prediction', 'decision', 'portfolio', 'overall')),
  metric_name             text        not null,
  metric_value            numeric(7,4) not null,
  metric_weight           numeric(5,4) not null default 1.0
                            check (metric_weight >= 0 and metric_weight <= 1),
  metric_status           text        not null
                            check (metric_status in ('excellent', 'strong', 'stable', 'warning', 'critical')),

  created_at              timestamptz not null default now()
);

create index if not exists pm_performance_metrics_snapshot_idx
  on pm_performance_metrics (workspace_id, performance_snapshot_id);

create index if not exists pm_performance_metrics_domain_idx
  on pm_performance_metrics (workspace_id, metric_domain);

alter table pm_performance_metrics enable row level security;

create policy "workspace members can read pm_performance_metrics"
  on pm_performance_metrics for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_performance_metrics.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pm_performance_metrics"
  on pm_performance_metrics for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_performance_metrics.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pm_performance_evidence
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pm_performance_evidence (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  performance_snapshot_id uuid        not null references pm_performance_snapshots(id) on delete cascade,

  source_entity_type      text        not null,
  source_entity_id        uuid        not null,

  evidence_type           text        not null,
  contribution_weight     numeric(5,4) not null default 1.0
                            check (contribution_weight >= 0 and contribution_weight <= 1),

  created_at              timestamptz not null default now()
);

create index if not exists pm_performance_evidence_snapshot_idx
  on pm_performance_evidence (workspace_id, performance_snapshot_id);

create index if not exists pm_performance_evidence_source_idx
  on pm_performance_evidence (workspace_id, source_entity_type, source_entity_id);

alter table pm_performance_evidence enable row level security;

create policy "workspace members can read pm_performance_evidence"
  on pm_performance_evidence for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_performance_evidence.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pm_performance_evidence"
  on pm_performance_evidence for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_performance_evidence.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
