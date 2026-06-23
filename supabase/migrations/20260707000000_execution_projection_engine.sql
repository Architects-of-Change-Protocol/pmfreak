-- ─────────────────────────────────────────────────────────────────────────────
-- Execution Projection Engine — EPIC 3 Sprint 4
-- Transforms accepted governance commitments into structured execution
-- projections: tasks, effort, dependencies, participants, risk, readiness.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── execution_projections ───────────────────────────────────────────────────

create table if not exists execution_projections (
  id                       uuid        primary key default gen_random_uuid(),
  workspace_id             uuid        not null references workspaces(id) on delete cascade,
  commitment_id            uuid        not null references governance_commitments(id) on delete cascade,
  projection_title         text        not null,
  projection_description   text        not null,
  status                   text        not null default 'generated' check (status in (
    'generated',
    'validated',
    'approved',
    'rejected',
    'archived'
  )),
  estimated_effort_hours   integer     not null default 0 check (estimated_effort_hours >= 0),
  estimated_duration_days  integer     not null default 0 check (estimated_duration_days >= 0),
  projected_risk           text        not null default 'low' check (projected_risk in (
    'low',
    'medium',
    'high',
    'critical'
  )),
  confidence_score         numeric(4,3) not null default 0.0 check (confidence_score >= 0.0 and confidence_score <= 1.0),
  generated_at             timestamptz not null default now(),
  validated_at             timestamptz,
  approved_at              timestamptz,
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (id, workspace_id),
  constraint fk_execution_projection_commitment_workspace
    foreign key (commitment_id, workspace_id)
    references governance_commitments(id, workspace_id)
);

create index execution_projections_workspace_id_idx    on execution_projections (workspace_id);
create index execution_projections_commitment_id_idx   on execution_projections (workspace_id, commitment_id);
create index execution_projections_status_idx          on execution_projections (workspace_id, status);
create index execution_projections_risk_idx            on execution_projections (workspace_id, projected_risk);
create index execution_projections_generated_at_idx    on execution_projections (generated_at desc);
create index execution_projections_created_at_idx      on execution_projections (created_at desc);

alter table execution_projections enable row level security;

create policy "workspace_members_can_access_execution_projections"
  on execution_projections
  for all
  using (is_workspace_member(workspace_id));

create trigger set_execution_projections_updated_at
  before update on execution_projections
  for each row execute function update_updated_at_column();

-- ─── execution_projection_tasks ──────────────────────────────────────────────

create table if not exists execution_projection_tasks (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        not null references workspaces(id) on delete cascade,
  projection_id    uuid        not null references execution_projections(id) on delete cascade,
  task_name        text        not null,
  task_description text        not null default '',
  estimated_hours  integer     not null default 0 check (estimated_hours >= 0),
  sequence_order   integer     not null default 0,
  owner_type       text        not null default '',
  created_at       timestamptz not null default now(),

  unique (id, workspace_id),
  constraint fk_projection_task_projection_workspace
    foreign key (projection_id, workspace_id)
    references execution_projections(id, workspace_id)
);

create index execution_projection_tasks_workspace_id_idx   on execution_projection_tasks (workspace_id);
create index execution_projection_tasks_projection_id_idx  on execution_projection_tasks (workspace_id, projection_id);
create index execution_projection_tasks_sequence_idx       on execution_projection_tasks (projection_id, sequence_order);

alter table execution_projection_tasks enable row level security;

create policy "workspace_members_can_access_execution_projection_tasks"
  on execution_projection_tasks
  for all
  using (is_workspace_member(workspace_id));

-- ─── execution_projection_dependencies ───────────────────────────────────────

create table if not exists execution_projection_dependencies (
  id                    uuid        primary key default gen_random_uuid(),
  workspace_id          uuid        not null references workspaces(id) on delete cascade,
  projection_id         uuid        not null references execution_projections(id) on delete cascade,
  dependency_type       text        not null check (dependency_type in (
    'decision',
    'authority',
    'ratification',
    'amendment',
    'resource'
  )),
  dependency_reference  text        not null,
  criticality           text        not null default 'medium' check (criticality in (
    'low',
    'medium',
    'high',
    'critical'
  )),
  created_at            timestamptz not null default now(),

  unique (id, workspace_id),
  constraint fk_projection_dependency_projection_workspace
    foreign key (projection_id, workspace_id)
    references execution_projections(id, workspace_id)
);

create index execution_projection_dependencies_workspace_id_idx  on execution_projection_dependencies (workspace_id);
create index execution_projection_dependencies_projection_id_idx on execution_projection_dependencies (workspace_id, projection_id);
create index execution_projection_dependencies_type_idx          on execution_projection_dependencies (dependency_type);

alter table execution_projection_dependencies enable row level security;

create policy "workspace_members_can_access_execution_projection_dependencies"
  on execution_projection_dependencies
  for all
  using (is_workspace_member(workspace_id));

-- ─── execution_projection_participants ───────────────────────────────────────

create table if not exists execution_projection_participants (
  id                    uuid        primary key default gen_random_uuid(),
  workspace_id          uuid        not null references workspaces(id) on delete cascade,
  projection_id         uuid        not null references execution_projections(id) on delete cascade,
  participant_type      text        not null,
  participant_reference text        not null default '',
  responsibility        text        not null default '',
  created_at            timestamptz not null default now(),

  unique (id, workspace_id),
  constraint fk_projection_participant_projection_workspace
    foreign key (projection_id, workspace_id)
    references execution_projections(id, workspace_id)
);

create index execution_projection_participants_workspace_id_idx  on execution_projection_participants (workspace_id);
create index execution_projection_participants_projection_id_idx on execution_projection_participants (workspace_id, projection_id);
create index execution_projection_participants_type_idx          on execution_projection_participants (participant_type);

alter table execution_projection_participants enable row level security;

create policy "workspace_members_can_access_execution_projection_participants"
  on execution_projection_participants
  for all
  using (is_workspace_member(workspace_id));
