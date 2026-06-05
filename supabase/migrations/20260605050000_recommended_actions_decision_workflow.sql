-- H4: PM Decision Workflow for Recommended Actions
-- Adds decision tracking columns, audit table, and indexes.
-- Human PM remains final decision authority — system records, never overrides.

-- Decision columns on recommended_actions
alter table public.recommended_actions
  add column if not exists decision_reason text,
  add column if not exists decided_by uuid references auth.users(id) on delete set null,
  add column if not exists decided_at timestamptz,
  add column if not exists deferred_until timestamptz,
  add column if not exists converted_task_id uuid,
  add column if not exists decision_metadata jsonb not null default '{}'::jsonb;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recommended_actions_set_updated_at on public.recommended_actions;
create trigger recommended_actions_set_updated_at
  before update on public.recommended_actions
  for each row execute procedure public.set_updated_at();

-- Additional indexes for decision queries
create index if not exists recommended_actions_project_status_idx
  on public.recommended_actions(project_id, status);

create index if not exists recommended_actions_decided_by_idx
  on public.recommended_actions(decided_by);

-- Decision audit table
create table if not exists public.recommended_action_decisions (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  recommended_action_id uuid not null references public.recommended_actions(id) on delete cascade,

  previous_status text not null,
  new_status text not null,

  decision_reason text,
  decision_metadata jsonb not null default '{}'::jsonb,

  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz not null default now(),

  created_at timestamptz not null default now()
);

create index if not exists recommended_action_decisions_action_idx
  on public.recommended_action_decisions(recommended_action_id, decided_at desc);

create index if not exists recommended_action_decisions_project_idx
  on public.recommended_action_decisions(project_id, decided_at desc);

alter table public.recommended_action_decisions enable row level security;

drop policy if exists "workspace members can read recommended_action_decisions" on public.recommended_action_decisions;
create policy "workspace members can read recommended_action_decisions"
  on public.recommended_action_decisions
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert recommended_action_decisions" on public.recommended_action_decisions;
create policy "workspace members can insert recommended_action_decisions"
  on public.recommended_action_decisions
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));
