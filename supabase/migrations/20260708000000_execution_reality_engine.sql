-- ─────────────────────────────────────────────────────────────────────────────
-- Execution Reality Engine — EPIC 3 Sprint 5
-- Transforms execution projections into observed execution realities.
-- Enables variance tracking, drift detection, projection accuracy measurement,
-- and continuous feedback into the institutional learning loop.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── execution_realities ─────────────────────────────────────────────────────

create table if not exists execution_realities (
  id                       uuid        primary key default gen_random_uuid(),
  workspace_id             uuid        not null references workspaces(id) on delete cascade,
  projection_id            uuid        not null references execution_projections(id) on delete cascade,
  reality_title            text        not null,
  reality_description      text        not null default '',
  status                   text        not null default 'observed' check (status in (
    'observed',
    'validated',
    'completed',
    'archived'
  )),
  actual_effort_hours      integer     not null default 0 check (actual_effort_hours >= 0),
  actual_duration_days     integer     not null default 0 check (actual_duration_days >= 0),
  actual_risk              text        not null default 'low' check (actual_risk in (
    'low',
    'medium',
    'high',
    'critical'
  )),
  actual_task_count        integer     not null default 0 check (actual_task_count >= 0),
  actual_participant_count integer     not null default 0 check (actual_participant_count >= 0),
  confidence_score         numeric(4,3) not null default 0.0 check (confidence_score >= 0.0 and confidence_score <= 1.0),
  observed_at              timestamptz not null default now(),
  validated_at             timestamptz,
  completed_at             timestamptz,
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (id, workspace_id),
  constraint fk_execution_reality_projection_workspace
    foreign key (projection_id, workspace_id)
    references execution_projections(id, workspace_id)
);

create index execution_realities_workspace_id_idx   on execution_realities (workspace_id);
create index execution_realities_projection_id_idx  on execution_realities (workspace_id, projection_id);
create index execution_realities_status_idx         on execution_realities (workspace_id, status);
create index execution_realities_risk_idx           on execution_realities (workspace_id, actual_risk);
create index execution_realities_observed_at_idx    on execution_realities (observed_at desc);
create index execution_realities_created_at_idx     on execution_realities (created_at desc);

alter table execution_realities enable row level security;

create policy "workspace_members_can_access_execution_realities"
  on execution_realities
  for all
  using (is_workspace_member(workspace_id));

create trigger set_execution_realities_updated_at
  before update on execution_realities
  for each row execute function update_updated_at_column();

-- ─── execution_variances ──────────────────────────────────────────────────────

create table if not exists execution_variances (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references workspaces(id) on delete cascade,
  reality_id          uuid        not null references execution_realities(id) on delete cascade,
  variance_type       text        not null check (variance_type in (
    'effort',
    'duration',
    'risk',
    'tasks',
    'participants'
  )),
  projected_value     numeric     not null default 0,
  actual_value        numeric     not null default 0,
  variance_percentage numeric(8,2) not null default 0.0,
  severity            text        not null default 'low' check (severity in (
    'low',
    'medium',
    'high',
    'critical'
  )),
  created_at          timestamptz not null default now(),

  unique (id, workspace_id),
  constraint fk_execution_variance_reality_workspace
    foreign key (reality_id, workspace_id)
    references execution_realities(id, workspace_id)
);

create index execution_variances_workspace_id_idx on execution_variances (workspace_id);
create index execution_variances_reality_id_idx   on execution_variances (workspace_id, reality_id);
create index execution_variances_type_idx         on execution_variances (variance_type);
create index execution_variances_severity_idx     on execution_variances (workspace_id, severity);

alter table execution_variances enable row level security;

create policy "workspace_members_can_access_execution_variances"
  on execution_variances
  for all
  using (is_workspace_member(workspace_id));

-- ─── execution_observations ───────────────────────────────────────────────────

create table if not exists execution_observations (
  id                  uuid        primary key default gen_random_uuid(),
  workspace_id        uuid        not null references workspaces(id) on delete cascade,
  reality_id          uuid        not null references execution_realities(id) on delete cascade,
  observation_type    text        not null,
  observation_value   text        not null default '',
  observation_source  text        not null default '',
  observed_by         uuid,
  observed_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  unique (id, workspace_id),
  constraint fk_execution_observation_reality_workspace
    foreign key (reality_id, workspace_id)
    references execution_realities(id, workspace_id)
);

create index execution_observations_workspace_id_idx on execution_observations (workspace_id);
create index execution_observations_reality_id_idx   on execution_observations (workspace_id, reality_id);
create index execution_observations_type_idx         on execution_observations (observation_type);
create index execution_observations_observed_at_idx  on execution_observations (observed_at desc);

alter table execution_observations enable row level security;

create policy "workspace_members_can_access_execution_observations"
  on execution_observations
  for all
  using (is_workspace_member(workspace_id));

-- ─── execution_drifts ─────────────────────────────────────────────────────────

create table if not exists execution_drifts (
  id          uuid        primary key default gen_random_uuid(),
  workspace_id uuid       not null references workspaces(id) on delete cascade,
  reality_id  uuid        not null references execution_realities(id) on delete cascade,
  drift_type  text        not null check (drift_type in (
    'schedule',
    'effort',
    'resource',
    'risk'
  )),
  severity    text        not null default 'none' check (severity in (
    'none',
    'emerging',
    'persistent',
    'critical'
  )),
  description text        not null default '',
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),

  unique (id, workspace_id),
  constraint fk_execution_drift_reality_workspace
    foreign key (reality_id, workspace_id)
    references execution_realities(id, workspace_id)
);

create index execution_drifts_workspace_id_idx on execution_drifts (workspace_id);
create index execution_drifts_reality_id_idx   on execution_drifts (workspace_id, reality_id);
create index execution_drifts_type_idx         on execution_drifts (drift_type);
create index execution_drifts_severity_idx     on execution_drifts (workspace_id, severity);
create index execution_drifts_detected_at_idx  on execution_drifts (detected_at desc);

alter table execution_drifts enable row level security;

create policy "workspace_members_can_access_execution_drifts"
  on execution_drifts
  for all
  using (is_workspace_member(workspace_id));
