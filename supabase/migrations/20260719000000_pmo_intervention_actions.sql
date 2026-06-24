-- PMO Intervention / Action Loop
-- EPIC 6 Sprint 6: Convert PMO governance violations into governed intervention actions.
--
-- Tables created:
--   pmo_intervention_actions  — Human-governed action records derived from PMO violations

-- ─────────────────────────────────────────────────────────────────────────────
-- pmo_intervention_actions
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pmo_intervention_actions (
  id                      uuid        primary key default gen_random_uuid(),

  workspace_id            uuid        not null references workspaces(id) on delete cascade,

  -- Source
  source_type             text        not null,
  source_id               text,
  source_snapshot_id      text,
  source_violation_id     text,
  source_recommendation_id text,

  -- Action
  action_type             text        not null,
  action_title            text        not null,
  action_description      text        not null,
  priority                text        not null
                            check (priority in ('low', 'medium', 'high', 'critical')),
  status                  text        not null default 'proposed'
                            check (status in ('proposed', 'approved', 'rejected', 'in_progress', 'completed', 'dismissed', 'cancelled')),

  -- Target
  target_type             text,
  target_id               text,
  target_name             text,

  -- Context
  pm_id                   text,
  project_id              text,

  -- Evidence / recommendation snapshot
  evidence                jsonb,
  recommendation          jsonb,

  -- Approval
  requires_approval       boolean     not null default true,
  approval_status         text        not null default 'pending'
                            check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  approved_by             text,
  approved_at             timestamptz,
  rejected_by             text,
  rejected_at             timestamptz,
  rejection_reason        text,

  -- Completion
  completed_by            text,
  completed_at            timestamptz,
  completion_notes        text,

  -- Dismissal
  dismissed_by            text,
  dismissed_at            timestamptz,
  dismissal_reason        text,

  -- Decision
  decision_reason         text,

  -- Audit
  created_by              text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists pmo_intervention_actions_workspace_idx
  on pmo_intervention_actions (workspace_id, created_at desc);

create index if not exists pmo_intervention_actions_workspace_status_idx
  on pmo_intervention_actions (workspace_id, status);

create index if not exists pmo_intervention_actions_workspace_priority_idx
  on pmo_intervention_actions (workspace_id, priority);

alter table pmo_intervention_actions enable row level security;

create policy "workspace members can read pmo_intervention_actions"
  on pmo_intervention_actions for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_intervention_actions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can insert pmo_intervention_actions"
  on pmo_intervention_actions for insert
  with check (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_intervention_actions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace members can update pmo_intervention_actions"
  on pmo_intervention_actions for update
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pmo_intervention_actions.workspace_id
        and wm.user_id = auth.uid()
    )
  );
