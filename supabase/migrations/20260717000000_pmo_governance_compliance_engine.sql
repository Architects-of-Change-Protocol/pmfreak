-- PMO Governance Compliance Engine
-- EPIC 6 Sprint 4: Transform governance from control mechanisms to a measurable organizational capability.
--
-- Tables created:
--   governance_compliance_snapshots  — Historical compliance snapshots per PM
--   governance_compliance_gaps       — Individual governance gaps detected per snapshot
--   governance_compliance_evidence   — Evidence sources contributing to each snapshot

-- ─────────────────────────────────────────────────────────────────────────────
-- governance_compliance_snapshots
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists governance_compliance_snapshots (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  pm_id                   uuid        not null references project_managers(id) on delete cascade,

  constitution_score      numeric(7,2) not null
                            check (constitution_score >= 0 and constitution_score <= 100),
  authority_score         numeric(7,2) not null
                            check (authority_score >= 0 and authority_score <= 100),
  ratification_score      numeric(7,2) not null
                            check (ratification_score >= 0 and ratification_score <= 100),
  decision_score          numeric(7,2) not null
                            check (decision_score >= 0 and decision_score <= 100),
  execution_score         numeric(7,2) not null
                            check (execution_score >= 0 and execution_score <= 100),
  learning_score          numeric(7,2) not null
                            check (learning_score >= 0 and learning_score <= 100),
  overall_score           numeric(7,2) not null
                            check (overall_score >= 0 and overall_score <= 100),

  compliance_status       text        not null
                            check (compliance_status in ('compliant', 'warning', 'critical')),

  snapshot_payload        jsonb       not null default '{}',

  generated_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists governance_compliance_snapshots_workspace_pm_idx
  on governance_compliance_snapshots (workspace_id, pm_id, generated_at desc);

create index if not exists governance_compliance_snapshots_workspace_status_idx
  on governance_compliance_snapshots (workspace_id, compliance_status);

create index if not exists governance_compliance_snapshots_workspace_score_idx
  on governance_compliance_snapshots (workspace_id, overall_score desc);

alter table governance_compliance_snapshots enable row level security;

create policy "workspace members can read governance_compliance_snapshots"
  on governance_compliance_snapshots for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = governance_compliance_snapshots.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage governance_compliance_snapshots"
  on governance_compliance_snapshots for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = governance_compliance_snapshots.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- governance_compliance_gaps
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists governance_compliance_gaps (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  snapshot_id             uuid        not null references governance_compliance_snapshots(id) on delete cascade,

  domain                  text        not null
                            check (domain in ('constitution', 'authority', 'ratification', 'decision', 'execution', 'learning')),
  gap_type                text        not null,
  severity                text        not null
                            check (severity in ('low', 'medium', 'high', 'critical')),
  description             text        not null,
  evidence_count          integer     not null default 0
                            check (evidence_count >= 0),

  detected_at             timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

create index if not exists governance_compliance_gaps_snapshot_idx
  on governance_compliance_gaps (workspace_id, snapshot_id);

create index if not exists governance_compliance_gaps_domain_idx
  on governance_compliance_gaps (workspace_id, domain, severity);

alter table governance_compliance_gaps enable row level security;

create policy "workspace members can read governance_compliance_gaps"
  on governance_compliance_gaps for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = governance_compliance_gaps.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage governance_compliance_gaps"
  on governance_compliance_gaps for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = governance_compliance_gaps.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- governance_compliance_evidence
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists governance_compliance_evidence (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,
  snapshot_id             uuid        not null references governance_compliance_snapshots(id) on delete cascade,

  source_entity_type      text        not null,
  source_entity_id        uuid        not null,

  evidence_type           text        not null,
  contribution_weight     numeric(5,4) not null default 1.0
                            check (contribution_weight >= 0 and contribution_weight <= 1),

  created_at              timestamptz not null default now()
);

create index if not exists governance_compliance_evidence_snapshot_idx
  on governance_compliance_evidence (workspace_id, snapshot_id);

create index if not exists governance_compliance_evidence_source_idx
  on governance_compliance_evidence (workspace_id, source_entity_type, source_entity_id);

alter table governance_compliance_evidence enable row level security;

create policy "workspace members can read governance_compliance_evidence"
  on governance_compliance_evidence for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = governance_compliance_evidence.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage governance_compliance_evidence"
  on governance_compliance_evidence for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = governance_compliance_evidence.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
