-- ─────────────────────────────────────────────────────────────────────────────
-- Project Constitution Lifecycle
-- Sprint 2: Constitution Lifecycle Governance
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── project_constitutions ───────────────────────────────────────────────────

create table if not exists public.project_constitutions (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  project_id           uuid not null references public.projects(id) on delete cascade,
  title                text not null check (char_length(trim(title)) > 0),
  description          text null,
  current_status       text not null default 'draft'
                         check (current_status in ('draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived')),
  status_changed_at    timestamptz not null default now(),
  status_changed_by    uuid not null references auth.users(id) on delete restrict,
  lifecycle_version    integer not null default 1 check (lifecycle_version >= 1),
  created_by           uuid not null references auth.users(id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  metadata             jsonb not null default '{}'::jsonb,

  -- workspace isolation: composite key ensures queries never cross workspace boundaries
  constraint project_constitutions_workspace_project_fkey
    foreign key (project_id, workspace_id)
    references public.projects(id, workspace_id) on delete cascade
);

create index if not exists project_constitutions_workspace_idx
  on public.project_constitutions(workspace_id);

create index if not exists project_constitutions_project_idx
  on public.project_constitutions(project_id, workspace_id);

create index if not exists project_constitutions_status_idx
  on public.project_constitutions(workspace_id, current_status);

alter table public.project_constitutions enable row level security;

create policy "workspace members can read constitutions"
  on public.project_constitutions
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert constitutions"
  on public.project_constitutions
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
    and status_changed_by = auth.uid()
  );

create policy "workspace members can update constitutions"
  on public.project_constitutions
  for update
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- ─── constitution_lifecycle_history ──────────────────────────────────────────

create table if not exists public.constitution_lifecycle_history (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  constitution_id  uuid not null references public.project_constitutions(id) on delete cascade,
  from_status      text not null
                     check (from_status in ('draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived')),
  to_status        text not null
                     check (to_status in ('draft', 'proposed', 'approved', 'active', 'suspended', 'closed', 'archived')),
  changed_by       uuid not null references auth.users(id) on delete restrict,
  changed_at       timestamptz not null default now(),
  reason           text null,
  lifecycle_version_after integer not null check (lifecycle_version_after >= 1),
  metadata         jsonb not null default '{}'::jsonb
);

create index if not exists constitution_lifecycle_history_constitution_idx
  on public.constitution_lifecycle_history(constitution_id, workspace_id);

create index if not exists constitution_lifecycle_history_workspace_idx
  on public.constitution_lifecycle_history(workspace_id);

alter table public.constitution_lifecycle_history enable row level security;

create policy "workspace members can read lifecycle history"
  on public.constitution_lifecycle_history
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert lifecycle history"
  on public.constitution_lifecycle_history
  for insert
  with check (
    public.is_workspace_member(workspace_id)
    and changed_by = auth.uid()
  );
