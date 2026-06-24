-- PMO Command Center
-- EPIC 6 Sprint 5: Build the executive governance layer of PMFreak.
--
-- Tables created:
--   pmo_command_center_snapshots  — Aggregated PMO organizational snapshots
--   pmo_attention_items           — Prioritized attention queue items per snapshot
--   pmo_recommendations           — Executive recommendations per snapshot

-- ─────────────────────────────────────────────────────────────────────────────
-- pmo_command_center_snapshots
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pmo_command_center_snapshots (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,

  overall_health_score    numeric(7,2) not null
                            check (overall_health_score >= 0 and overall_health_score <= 100),
  capacity_score          numeric(7,2) not null
                            check (capacity_score >= 0 and capacity_score <= 100),
  governance_score        numeric(7,2) not null
                            check (governance_score >= 0 and governance_score <= 100),
  execution_score         numeric(7,2) not null
                            check (execution_score >= 0 and execution_score <= 100),
  risk_score              numeric(7,2) not null
                            check (risk_score >= 0 and risk_score <= 100),

  project_count           integer     not null default 0 check (project_count >= 0),
  portfolio_count         integer     not null default 0 check (portfolio_count >= 0),
  pm_count                integer     not null default 0 check (pm_count >= 0),

  critical_projects       integer     not null default 0 check (critical_projects >= 0),
  warning_projects        integer     not null default 0 check (warning_projects >= 0),
  healthy_projects        integer     not null default 0 check (healthy_projects >= 0),

  snapshot_payload        jsonb       not null default '{}',

  generated_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists pmo_command_center_snapshots_workspace_idx
  on pmo_command_center_snapshots (workspace_id, generated_at desc);

create index if not exists pmo_command_center_snapshots_workspace_health_idx
  on pmo_command_center_snapshots (workspace_id, overall_health_score desc);

create index if not exists pmo_command_center_snapshots_workspace_risk_idx
  on pmo_command_center_snapshots (workspace_id, risk_score desc);

alter table pmo_command_center_snapshots enable row level security;

create policy "workspace members can read pmo_command_center_snapshots"
  on pmo_command_center_snapshots for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_command_center_snapshots.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pmo_command_center_snapshots"
  on pmo_command_center_snapshots for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_command_center_snapshots.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pmo_attention_items
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pmo_attention_items (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  snapshot_id             uuid        not null references pmo_command_center_snapshots(id) on delete cascade,

  entity_type             text        not null
                            check (entity_type in ('pm', 'project', 'portfolio', 'governance')),
  entity_id               uuid        not null,

  priority                text        not null
                            check (priority in ('low', 'medium', 'high', 'critical')),

  title                   text        not null,
  description             text        not null,
  recommended_action      text        not null,

  created_at              timestamptz not null default now()
);

create index if not exists pmo_attention_items_snapshot_idx
  on pmo_attention_items (snapshot_id, priority);

create index if not exists pmo_attention_items_workspace_idx
  on pmo_attention_items (workspace_id, priority);

alter table pmo_attention_items enable row level security;

create policy "workspace members can read pmo_attention_items"
  on pmo_attention_items for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_attention_items.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pmo_attention_items"
  on pmo_attention_items for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_attention_items.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pmo_recommendations
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pmo_recommendations (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  snapshot_id             uuid        not null references pmo_command_center_snapshots(id) on delete cascade,

  recommendation_type     text        not null
                            check (recommendation_type in ('capacity', 'governance', 'execution', 'portfolio', 'staffing', 'risk')),

  recommendation          text        not null,
  confidence_score        numeric(5,4) not null
                            check (confidence_score >= 0 and confidence_score <= 1),
  impact_score            text        not null
                            check (impact_score in ('low', 'medium', 'high', 'critical')),

  created_at              timestamptz not null default now()
);

create index if not exists pmo_recommendations_snapshot_idx
  on pmo_recommendations (snapshot_id, confidence_score desc);

create index if not exists pmo_recommendations_workspace_type_idx
  on pmo_recommendations (workspace_id, recommendation_type);

alter table pmo_recommendations enable row level security;

create policy "workspace members can read pmo_recommendations"
  on pmo_recommendations for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_recommendations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pmo_recommendations"
  on pmo_recommendations for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_recommendations.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
