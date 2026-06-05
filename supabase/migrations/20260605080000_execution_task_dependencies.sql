-- ─────────────────────────────────────────────────────────────────────────────
-- H7: Execution Task Dependencies & Execution Network Graph
-- Creates the dependency graph foundation for modeling task sequencing,
-- blockers, and execution flow.  No scheduling, Gantt, or critical path.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── execution_task_dependencies ──────────────────────────────────────────────

create table if not exists public.execution_task_dependencies (
  id                   uuid        primary key default gen_random_uuid(),

  workspace_id         uuid        not null references public.workspaces(id) on delete cascade,
  project_id           uuid        not null references public.projects(id) on delete cascade,

  predecessor_task_id  uuid        not null references public.execution_tasks(id) on delete cascade,
  successor_task_id    uuid        not null references public.execution_tasks(id) on delete cascade,

  dependency_type      text        not null default 'finish_to_start',
  status               text        not null default 'active',

  lag_days             integer     not null default 0,
  reason               text        null,

  source_type          text        not null default 'manual',
  source_payload       jsonb       not null default '{}'::jsonb,

  confidence_score     numeric(5,2) null,

  created_by           uuid        null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint execution_task_dependencies_type_check check (
    dependency_type in (
      'finish_to_start',
      'start_to_start',
      'finish_to_finish',
      'start_to_finish',
      'blocks',
      'gated_by',
      'approval_required',
      'external_dependency'
    )
  ),

  constraint execution_task_dependencies_status_check check (
    status in ('active', 'resolved', 'invalidated', 'proposed')
  ),

  constraint execution_task_dependencies_no_self_loop check (
    predecessor_task_id != successor_task_id
  )
);

-- Unique: one dependency per (workspace, predecessor, successor, type)
create unique index if not exists execution_task_dependencies_unique_idx
  on public.execution_task_dependencies (workspace_id, predecessor_task_id, successor_task_id, dependency_type);

-- Indexes
create index if not exists execution_task_dependencies_workspace_idx
  on public.execution_task_dependencies (workspace_id);

create index if not exists execution_task_dependencies_project_idx
  on public.execution_task_dependencies (project_id);

create index if not exists execution_task_dependencies_predecessor_idx
  on public.execution_task_dependencies (predecessor_task_id);

create index if not exists execution_task_dependencies_successor_idx
  on public.execution_task_dependencies (successor_task_id);

create index if not exists execution_task_dependencies_status_idx
  on public.execution_task_dependencies (status);

create index if not exists execution_task_dependencies_type_idx
  on public.execution_task_dependencies (dependency_type);

-- updated_at trigger
create trigger set_updated_at_execution_task_dependencies
  before update on public.execution_task_dependencies
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.execution_task_dependencies enable row level security;

create policy "workspace members can read execution_task_dependencies"
  on public.execution_task_dependencies
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert execution_task_dependencies"
  on public.execution_task_dependencies
  for insert
  with check (public.is_workspace_member(workspace_id));

create policy "workspace members can update execution_task_dependencies"
  on public.execution_task_dependencies
  for update
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can delete execution_task_dependencies"
  on public.execution_task_dependencies
  for delete
  using (public.is_workspace_member(workspace_id));
