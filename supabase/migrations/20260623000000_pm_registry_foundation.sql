-- PM Registry Foundation
-- Sprint 1: Introduce Project Manager as a first-class governed entity.
--
-- Tables created:
--   project_managers    — PM entity registry per workspace
--   pm_assignments      — Auditable PM↔Project assignment records
--   pm_profiles         — PM capacity and role profile

-- ─────────────────────────────────────────────────────────────────────────────
-- project_managers
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists project_managers (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  user_id       uuid        references auth.users(id) on delete set null,
  display_name  text        not null,
  email         text        not null,
  status        text        not null default 'active'
                              check (status in ('active', 'inactive', 'suspended')),
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists project_managers_workspace_email_unique
  on project_managers (workspace_id, email);

alter table project_managers enable row level security;

create policy "workspace members can read project_managers"
  on project_managers for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = project_managers.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage project_managers"
  on project_managers for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = project_managers.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pm_assignments
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pm_assignments (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  pm_id           uuid        not null references project_managers(id) on delete cascade,
  project_id      uuid        not null references projects(id) on delete cascade,
  assignment_type text        not null
                                check (assignment_type in ('primary', 'secondary', 'program', 'observer')),
  assigned_at     timestamptz not null default now(),
  removed_at      timestamptz
);

-- Only one active primary PM per project
create unique index if not exists pm_assignments_one_primary_per_project
  on pm_assignments (workspace_id, project_id)
  where assignment_type = 'primary' and removed_at is null;

-- No duplicate active assignments for same PM + project + type
create unique index if not exists pm_assignments_no_duplicate_active
  on pm_assignments (workspace_id, pm_id, project_id, assignment_type)
  where removed_at is null;

alter table pm_assignments enable row level security;

create policy "workspace members can read pm_assignments"
  on pm_assignments for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_assignments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pm_assignments"
  on pm_assignments for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_assignments.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- pm_profiles
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists pm_profiles (
  id                    uuid        primary key default gen_random_uuid(),
  workspace_id          uuid        not null references workspaces(id) on delete cascade,
  pm_id                 uuid        not null references project_managers(id) on delete cascade,
  role                  text        not null default 'project_manager'
                                      check (role in ('project_manager', 'senior_pm', 'program_manager', 'portfolio_manager')),
  experience_level      text        not null default 'mid'
                                      check (experience_level in ('junior', 'mid', 'senior', 'principal')),
  capacity_limit        integer     not null default 100
                                      check (capacity_limit >= 0 and capacity_limit <= 100),
  active_projects_limit integer     not null default 5
                                      check (active_projects_limit > 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (workspace_id, pm_id)
);

alter table pm_profiles enable row level security;

create policy "workspace members can read pm_profiles"
  on pm_profiles for select
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_profiles.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "workspace admins can manage pm_profiles"
  on pm_profiles for all
  using (
    exists (
      select 1 from workspace_memberships wm
      where wm.workspace_id = pm_profiles.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );
