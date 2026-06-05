-- ─────────────────────────────────────────────────────────────────────────────
-- H6: Execution Tasks
-- Task Draft → Execution Task lifecycle.
-- Machine drafts. Human approves. System executes governance.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── execution_tasks ───────────────────────────────────────────────────────────

create table if not exists public.execution_tasks (
  id                    uuid primary key default gen_random_uuid(),

  workspace_id          uuid not null references public.workspaces(id),
  project_id            uuid not null references public.projects(id),

  task_draft_id         uuid not null references public.task_drafts(id),

  recommended_action_id uuid null references public.recommended_actions(id),

  raid_item_id          uuid null references public.raid_items(id),

  title                 text not null,
  description           text not null,

  status                text not null default 'not_started'
                        check (status in ('not_started','in_progress','blocked','completed','cancelled')),

  priority              text not null default 'medium'
                        check (priority in ('low','medium','high','critical')),

  owner_user_id         uuid null,
  owner_name            text null,

  start_date            timestamptz null,
  due_date              timestamptz null,
  completed_at          timestamptz null,

  progress_percent      integer not null default 0
                        check (progress_percent >= 0 and progress_percent <= 100),

  acceptance_criteria   jsonb not null default '[]'::jsonb,
  checklist             jsonb not null default '[]'::jsonb,

  confidence_score      numeric(5,2) null,

  source_payload        jsonb not null default '{}'::jsonb,

  created_by            uuid null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Prevent duplicate conversion: one execution task per draft
create unique index if not exists execution_tasks_draft_uidx
  on public.execution_tasks (task_draft_id);

-- Standard query indexes
create index if not exists execution_tasks_workspace_idx    on public.execution_tasks (workspace_id);
create index if not exists execution_tasks_project_idx      on public.execution_tasks (project_id);
create index if not exists execution_tasks_status_idx       on public.execution_tasks (status);
create index if not exists execution_tasks_priority_idx     on public.execution_tasks (priority);
create index if not exists execution_tasks_due_date_idx     on public.execution_tasks (due_date);
create index if not exists execution_tasks_owner_idx        on public.execution_tasks (owner_user_id);

-- RLS
alter table public.execution_tasks enable row level security;

create policy "workspace members can read execution_tasks"
  on public.execution_tasks for select
  using (is_workspace_member(workspace_id));

create policy "workspace members can insert execution_tasks"
  on public.execution_tasks for insert
  with check (is_workspace_member(workspace_id));

create policy "workspace members can update execution_tasks"
  on public.execution_tasks for update
  using (is_workspace_member(workspace_id));

-- updated_at trigger
create trigger set_execution_tasks_updated_at
  before update on public.execution_tasks
  for each row execute function public.set_updated_at();

-- ── execution_task_events ─────────────────────────────────────────────────────

create table if not exists public.execution_task_events (
  id             uuid primary key default gen_random_uuid(),

  workspace_id   uuid not null,
  project_id     uuid not null,
  task_id        uuid not null references public.execution_tasks(id),

  event_type     text not null,
  event_payload  jsonb not null default '{}'::jsonb,

  actor_user_id  uuid null,

  created_at     timestamptz not null default now()
);

create index if not exists execution_task_events_task_idx       on public.execution_task_events (task_id);
create index if not exists execution_task_events_project_idx    on public.execution_task_events (project_id);
create index if not exists execution_task_events_created_at_idx on public.execution_task_events (created_at);

alter table public.execution_task_events enable row level security;

create policy "workspace members can read execution_task_events"
  on public.execution_task_events for select
  using (is_workspace_member(workspace_id));

create policy "workspace members can insert execution_task_events"
  on public.execution_task_events for insert
  with check (is_workspace_member(workspace_id));
