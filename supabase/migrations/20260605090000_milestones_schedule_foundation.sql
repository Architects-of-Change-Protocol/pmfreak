-- ─────────────────────────────────────────────────────────────────────────────
-- H8: Milestones & Schedule Foundation
-- Creates project_milestones and adds schedule fields to execution_tasks.
-- No automatic scheduling, Gantt, or critical path.
-- Data foundation for H9 Critical Path.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── project_milestones ───────────────────────────────────────────────────────

create table if not exists public.project_milestones (
  id                 uuid          primary key default gen_random_uuid(),

  workspace_id       uuid          not null references public.workspaces(id) on delete cascade,
  project_id         uuid          not null references public.projects(id) on delete cascade,

  title              text          not null,
  description        text          null,

  milestone_type     text          not null default 'delivery',
  status             text          not null default 'planned',

  target_date        timestamptz   null,
  baseline_date      timestamptz   null,
  forecast_date      timestamptz   null,
  completed_at       timestamptz   null,

  confidence_score   numeric(5,2)  null,

  source_type        text          not null default 'manual',
  source_payload     jsonb         not null default '{}'::jsonb,

  created_by         uuid          null,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now(),

  constraint project_milestones_type_check check (
    milestone_type in (
      'kickoff',
      'discovery',
      'design',
      'approval',
      'delivery',
      'deployment',
      'training',
      'acceptance',
      'go_live',
      'handover',
      'other'
    )
  ),

  constraint project_milestones_status_check check (
    status in (
      'planned',
      'at_risk',
      'blocked',
      'completed',
      'cancelled'
    )
  )
);

-- Indexes
create index if not exists project_milestones_workspace_idx
  on public.project_milestones (workspace_id);

create index if not exists project_milestones_project_idx
  on public.project_milestones (project_id);

create index if not exists project_milestones_status_idx
  on public.project_milestones (status);

create index if not exists project_milestones_target_date_idx
  on public.project_milestones (target_date);

create index if not exists project_milestones_type_idx
  on public.project_milestones (milestone_type);

-- updated_at trigger
create trigger set_updated_at_project_milestones
  before update on public.project_milestones
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.project_milestones enable row level security;

create policy "workspace members can read project_milestones"
  on public.project_milestones
  for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can insert project_milestones"
  on public.project_milestones
  for insert
  with check (public.is_workspace_member(workspace_id));

create policy "workspace members can update project_milestones"
  on public.project_milestones
  for update
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can delete project_milestones"
  on public.project_milestones
  for delete
  using (public.is_workspace_member(workspace_id));

-- ── execution_tasks schedule fields ─────────────────────────────────────────

alter table public.execution_tasks
  add column if not exists planned_start_date   timestamptz   null,
  add column if not exists planned_finish_date  timestamptz   null,
  add column if not exists baseline_start_date  timestamptz   null,
  add column if not exists baseline_finish_date timestamptz   null,
  add column if not exists forecast_start_date  timestamptz   null,
  add column if not exists forecast_finish_date timestamptz   null,
  add column if not exists milestone_id         uuid          null references public.project_milestones(id) on delete set null,
  add column if not exists schedule_status      text          not null default 'unscheduled',
  add column if not exists schedule_confidence  numeric(5,2)  null;

alter table public.execution_tasks
  drop constraint if exists execution_tasks_schedule_status_check;

alter table public.execution_tasks
  add constraint execution_tasks_schedule_status_check check (
    schedule_status in (
      'unscheduled',
      'scheduled',
      'at_risk',
      'delayed',
      'completed',
      'cancelled'
    )
  );

-- Indexes for schedule fields
create index if not exists execution_tasks_planned_start_idx
  on public.execution_tasks (project_id, planned_start_date);

create index if not exists execution_tasks_planned_finish_idx
  on public.execution_tasks (project_id, planned_finish_date);

create index if not exists execution_tasks_milestone_idx
  on public.execution_tasks (project_id, milestone_id);

create index if not exists execution_tasks_schedule_status_idx
  on public.execution_tasks (project_id, schedule_status);
