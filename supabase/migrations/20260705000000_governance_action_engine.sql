-- ─────────────────────────────────────────────────────────────────────────────
-- Governance Action Engine — EPIC 3 Sprint 2
-- Transforms governance signals into recommended, prioritized, justified, and
-- traceable governance interventions. Actions are suggested, never automatic.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── governance_actions ──────────────────────────────────────────────────────

create table if not exists governance_actions (
  id                      uuid         primary key default gen_random_uuid(),
  workspace_id            uuid         not null references workspaces(id) on delete cascade,
  signal_id               uuid         not null references governance_signals(id) on delete cascade,
  action_type             text         not null check (action_type in (
    'create_escalation',
    'request_ratification',
    'request_approval',
    'create_delegation',
    'assign_authority',
    'review_amendment',
    'review_decision',
    'review_risk',
    'initiate_governance_review',
    'close_signal',
    'reassess_recommendation',
    'other'
  )),
  action_priority         text         not null check (action_priority in ('low', 'medium', 'high', 'critical')),
  action_status           text         not null default 'generated' check (action_status in (
    'generated',
    'reviewed',
    'approved',
    'rejected',
    'expired',
    'completed'
  )),
  title                   text         not null,
  description             text         not null,
  recommended_owner_type  text         not null,
  recommended_owner_id    uuid,
  recommended_due_date    timestamptz  not null,
  justification           text         not null,
  confidence_score        numeric(4,3) not null default 0.0 check (confidence_score between 0.0 and 1.0),
  created_at              timestamptz  not null default now(),
  updated_at              timestamptz  not null default now(),
  completed_at            timestamptz,
  expired_at              timestamptz,

  unique (id, workspace_id)
);

create index governance_actions_workspace_id_idx      on governance_actions (workspace_id);
create index governance_actions_signal_id_idx         on governance_actions (signal_id);
create index governance_actions_action_status_idx     on governance_actions (action_status);
create index governance_actions_action_priority_idx   on governance_actions (action_priority);
create index governance_actions_created_at_idx        on governance_actions (created_at desc);

alter table governance_actions enable row level security;

create policy "workspace_members_can_access_governance_actions"
  on governance_actions
  for all
  using (is_workspace_member(workspace_id));

-- ─── governance_action_evidence ──────────────────────────────────────────────

create table if not exists governance_action_evidence (
  id                    uuid         primary key default gen_random_uuid(),
  workspace_id          uuid         not null references workspaces(id) on delete cascade,
  action_id             uuid         not null references governance_actions(id) on delete cascade,
  signal_id             uuid         references governance_signals(id) on delete set null,
  recommendation_id     uuid,
  learning_pattern_id   uuid,
  contribution_weight   numeric(4,3) not null default 1.0 check (contribution_weight between 0.0 and 1.0),
  created_at            timestamptz  not null default now(),

  unique (id, workspace_id)
);

create index governance_action_evidence_workspace_id_idx on governance_action_evidence (workspace_id);
create index governance_action_evidence_action_id_idx    on governance_action_evidence (action_id);

alter table governance_action_evidence enable row level security;

create policy "workspace_members_can_access_governance_action_evidence"
  on governance_action_evidence
  for all
  using (is_workspace_member(workspace_id));

-- ─── governance_action_assignments ───────────────────────────────────────────

create table if not exists governance_action_assignments (
  id                uuid         primary key default gen_random_uuid(),
  workspace_id      uuid         not null references workspaces(id) on delete cascade,
  action_id         uuid         not null references governance_actions(id) on delete cascade,
  assigned_to       uuid         not null,
  assignment_status text         not null default 'assigned' check (assignment_status in (
    'assigned',
    'accepted',
    'completed',
    'declined'
  )),
  assigned_at       timestamptz  not null default now(),
  accepted_at       timestamptz,
  completed_at      timestamptz,

  unique (id, workspace_id)
);

create index governance_action_assignments_workspace_id_idx on governance_action_assignments (workspace_id);
create index governance_action_assignments_action_id_idx    on governance_action_assignments (action_id);
create index governance_action_assignments_assigned_to_idx  on governance_action_assignments (assigned_to);

alter table governance_action_assignments enable row level security;

create policy "workspace_members_can_access_governance_action_assignments"
  on governance_action_assignments
  for all
  using (is_workspace_member(workspace_id));
