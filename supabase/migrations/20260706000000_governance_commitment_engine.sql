-- ─────────────────────────────────────────────────────────────────────────────
-- Governance Commitment Engine — EPIC 3 Sprint 3
-- Transforms governance actions into verifiable, auditable, traceable
-- commitments with explicit human ownership and accountability.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── governance_commitments ──────────────────────────────────────────────────

create table if not exists governance_commitments (
  id                      uuid         primary key default gen_random_uuid(),
  workspace_id            uuid         not null references workspaces(id) on delete cascade,
  action_id               uuid         not null references governance_actions(id) on delete cascade,
  commitment_title        text         not null,
  commitment_description  text         not null,
  owner_id                uuid         not null,
  owner_type              text         not null,
  priority                text         not null check (priority in ('low', 'medium', 'high', 'critical')),
  status                  text         not null default 'pending_acceptance' check (status in (
    'pending_acceptance',
    'accepted',
    'rejected',
    'active',
    'completed',
    'breached',
    'cancelled',
    'delegated',
    'expired'
  )),
  due_date                timestamptz  not null,
  accepted_at             timestamptz,
  started_at              timestamptz,
  completed_at            timestamptz,
  cancelled_at            timestamptz,
  breached_at             timestamptz,
  expired_at              timestamptz,
  outcome                 text         check (outcome in ('successful', 'partial', 'failed', 'unknown')),
  created_at              timestamptz  not null default now(),
  updated_at              timestamptz  not null default now(),

  unique (id, workspace_id)
);

create index governance_commitments_workspace_id_idx   on governance_commitments (workspace_id);
create index governance_commitments_action_id_idx      on governance_commitments (action_id);
create index governance_commitments_owner_id_idx       on governance_commitments (owner_id);
create index governance_commitments_status_idx         on governance_commitments (status);
create index governance_commitments_priority_idx       on governance_commitments (priority);
create index governance_commitments_due_date_idx       on governance_commitments (due_date);
create index governance_commitments_created_at_idx     on governance_commitments (created_at desc);

alter table governance_commitments enable row level security;

create policy "workspace_members_can_access_governance_commitments"
  on governance_commitments
  for all
  using (is_workspace_member(workspace_id));

-- ─── governance_commitment_history ───────────────────────────────────────────

create table if not exists governance_commitment_history (
  id               uuid         primary key default gen_random_uuid(),
  workspace_id     uuid         not null references workspaces(id) on delete cascade,
  commitment_id    uuid         not null references governance_commitments(id) on delete cascade,
  previous_status  text         not null,
  new_status       text         not null,
  changed_by       uuid         not null,
  reason           text,
  created_at       timestamptz  not null default now(),

  unique (id, workspace_id)
);

create index governance_commitment_history_workspace_id_idx  on governance_commitment_history (workspace_id);
create index governance_commitment_history_commitment_id_idx on governance_commitment_history (commitment_id);
create index governance_commitment_history_created_at_idx    on governance_commitment_history (created_at desc);

alter table governance_commitment_history enable row level security;

create policy "workspace_members_can_access_governance_commitment_history"
  on governance_commitment_history
  for all
  using (is_workspace_member(workspace_id));

-- ─── governance_commitment_delegations ───────────────────────────────────────

create table if not exists governance_commitment_delegations (
  id             uuid         primary key default gen_random_uuid(),
  workspace_id   uuid         not null references workspaces(id) on delete cascade,
  commitment_id  uuid         not null references governance_commitments(id) on delete cascade,
  delegated_by   uuid         not null,
  delegated_to   uuid         not null,
  reason         text         not null,
  delegated_at   timestamptz  not null default now(),
  accepted_at    timestamptz,
  status         text         not null default 'pending' check (status in (
    'pending',
    'accepted',
    'rejected',
    'cancelled'
  )),
  created_at     timestamptz  not null default now(),

  unique (id, workspace_id)
);

create index governance_commitment_delegations_workspace_id_idx  on governance_commitment_delegations (workspace_id);
create index governance_commitment_delegations_commitment_id_idx on governance_commitment_delegations (commitment_id);
create index governance_commitment_delegations_delegated_by_idx  on governance_commitment_delegations (delegated_by);
create index governance_commitment_delegations_delegated_to_idx  on governance_commitment_delegations (delegated_to);

alter table governance_commitment_delegations enable row level security;

create policy "workspace_members_can_access_governance_commitment_delegations"
  on governance_commitment_delegations
  for all
  using (is_workspace_member(workspace_id));

-- ─── governance_commitment_evidence ──────────────────────────────────────────

create table if not exists governance_commitment_evidence (
  id                uuid         primary key default gen_random_uuid(),
  workspace_id      uuid         not null references workspaces(id) on delete cascade,
  commitment_id     uuid         not null references governance_commitments(id) on delete cascade,
  artifact_id       uuid,
  memory_record_id  uuid,
  description       text         not null,
  created_at        timestamptz  not null default now(),

  unique (id, workspace_id)
);

create index governance_commitment_evidence_workspace_id_idx  on governance_commitment_evidence (workspace_id);
create index governance_commitment_evidence_commitment_id_idx on governance_commitment_evidence (commitment_id);

alter table governance_commitment_evidence enable row level security;

create policy "workspace_members_can_access_governance_commitment_evidence"
  on governance_commitment_evidence
  for all
  using (is_workspace_member(workspace_id));
