-- H5: Task Draft Engine
-- When a PM converts a Recommended Action, this creates a traceable Task Draft
-- for PM review before any real task execution occurs.
-- The system drafts. The PM confirms. No automatic task execution.

create table if not exists public.task_drafts (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,

  recommended_action_id uuid not null references public.recommended_actions(id) on delete cascade,
  raid_item_id          uuid references public.raid_items(id) on delete set null,

  title       text not null,
  description text not null,

  draft_status text not null default 'draft' check (draft_status in (
    'draft',
    'reviewed',
    'approved',
    'discarded',
    'converted_to_task'
  )),

  suggested_owner    text,
  suggested_due_date timestamptz,
  suggested_due_window text,

  priority text not null default 'medium' check (priority in (
    'low',
    'medium',
    'high',
    'critical'
  )),

  source_type    text not null default 'recommended_action',
  source_payload jsonb not null default '{}'::jsonb,

  acceptance_criteria jsonb not null default '[]'::jsonb,
  checklist           jsonb not null default '[]'::jsonb,

  confidence_score numeric(5,2),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deduplicate: one draft per recommended action per workspace
create unique index if not exists task_drafts_workspace_action_uidx
  on public.task_drafts(workspace_id, recommended_action_id);

create index if not exists task_drafts_workspace_idx
  on public.task_drafts(workspace_id);

create index if not exists task_drafts_project_idx
  on public.task_drafts(project_id);

create index if not exists task_drafts_recommended_action_idx
  on public.task_drafts(recommended_action_id);

create index if not exists task_drafts_draft_status_idx
  on public.task_drafts(workspace_id, project_id, draft_status);

create index if not exists task_drafts_priority_idx
  on public.task_drafts(workspace_id, project_id, priority);

-- updated_at trigger (reuse or create the function)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists task_drafts_set_updated_at on public.task_drafts;
create trigger task_drafts_set_updated_at
  before update on public.task_drafts
  for each row execute procedure public.set_updated_at();

alter table public.task_drafts enable row level security;

drop policy if exists "workspace members can read task_drafts" on public.task_drafts;
create policy "workspace members can read task_drafts"
  on public.task_drafts
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert task_drafts" on public.task_drafts;
create policy "workspace members can insert task_drafts"
  on public.task_drafts
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can update task_drafts" on public.task_drafts;
create policy "workspace members can update task_drafts"
  on public.task_drafts
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
