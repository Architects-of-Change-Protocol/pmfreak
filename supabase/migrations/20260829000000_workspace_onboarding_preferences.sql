-- Guided Workspace Onboarding — per-user display preferences.
--
-- This table stores ONLY how a user wants the guided setup panel displayed
-- (collapsed / dismissed / skipped optional steps / onboarding version seen)
-- plus the insights first-view interaction event. It never stores derived
-- activation progress: progress is always computed from real workspace data
-- (projects, execution_tasks, raid_items, context_messages, invitations,
-- recommended_actions). Dismissing the guide hides it — it never marks the
-- workspace as configured.

create table if not exists public.workspace_onboarding_preferences (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,

  onboarding_version integer not null default 1,

  collapsed    boolean not null default false,
  dismissed_at timestamptz,

  -- Only non-essential step ids may ever be stored here; the service layer
  -- validates against the closed step-id set. Bounded to keep the row small.
  skipped_step_ids text[] not null default '{}'::text[]
    check (coalesce(array_length(skipped_step_ids, 1), 0) <= 32),

  -- UX interaction event: first time this user opened a populated
  -- executive/portfolio insight surface in this workspace.
  insights_first_viewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspace_onboarding_preferences_workspace_user_uidx
    unique (workspace_id, user_id)
);

create index if not exists workspace_onboarding_preferences_workspace_idx
  on public.workspace_onboarding_preferences(workspace_id);

-- updated_at trigger (function shared with earlier migrations)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_onboarding_preferences_set_updated_at
  on public.workspace_onboarding_preferences;
create trigger workspace_onboarding_preferences_set_updated_at
  before update on public.workspace_onboarding_preferences
  for each row execute procedure public.set_updated_at();

alter table public.workspace_onboarding_preferences enable row level security;

-- Personal display preference: each member reads and writes only their own
-- row, and only inside a workspace they belong to. There is no delete policy
-- (reopen clears dismissed_at instead) and no cross-user visibility.

drop policy if exists "members read own onboarding preferences"
  on public.workspace_onboarding_preferences;
create policy "members read own onboarding preferences"
  on public.workspace_onboarding_preferences
  for select to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "members insert own onboarding preferences"
  on public.workspace_onboarding_preferences;
create policy "members insert own onboarding preferences"
  on public.workspace_onboarding_preferences
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists "members update own onboarding preferences"
  on public.workspace_onboarding_preferences;
create policy "members update own onboarding preferences"
  on public.workspace_onboarding_preferences
  for update to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

grant select, insert, update on public.workspace_onboarding_preferences to authenticated;
