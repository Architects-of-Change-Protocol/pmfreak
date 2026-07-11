begin;

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_agent_id text,
  actor_role text,
  event_type text not null,
  route_id text not null,
  requested_permission text,
  denied_permission text,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists security_events_workspace_created_idx on public.security_events(workspace_id, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists "security events readable by workspace owner admin" on public.security_events;

create policy "security events readable by workspace owner admin"
  on public.security_events
  for select
  using (
    exists (
      select 1 from public.workspace_memberships wm
      where wm.workspace_id = security_events.workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner','admin')
    )
  );

revoke insert, update, delete on public.security_events from anon, authenticated;

commit;
