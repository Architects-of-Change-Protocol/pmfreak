begin;

create table if not exists public.ai_agent_permissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id text not null,
  project_id uuid references public.projects(id) on delete cascade,
  permissions text[] not null default '{}',
  granted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (cardinality(permissions) > 0)
);

create index if not exists ai_agent_permissions_workspace_agent_idx on public.ai_agent_permissions(workspace_id, agent_id);
create index if not exists ai_agent_permissions_workspace_project_idx on public.ai_agent_permissions(workspace_id, project_id) where revoked_at is null;

alter table public.ai_agent_permissions enable row level security;

drop policy if exists "ai agent permissions read by workspace members" on public.ai_agent_permissions;

create policy "ai agent permissions read by workspace members"
  on public.ai_agent_permissions
  for select
  using (
    exists (
      select 1
      from public.workspace_memberships wm
      where wm.workspace_id = ai_agent_permissions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "ai agent permissions manage by owner or admin" on public.ai_agent_permissions;

create policy "ai agent permissions manage by owner or admin"
  on public.ai_agent_permissions
  for all
  using (
    exists (
      select 1
      from public.workspace_memberships wm
      where wm.workspace_id = ai_agent_permissions.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_memberships wm
      where wm.workspace_id = ai_agent_permissions.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

commit;
