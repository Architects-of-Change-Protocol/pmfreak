create extension if not exists "pgcrypto";

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = any(allowed_roles)
  );
$$;

alter table public.message_analyses enable row level security;
alter table public.project_suggestions enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.workspace_audit_events enable row level security;
alter table public.first_user_telemetry_events enable row level security;

alter table public.message_analyses add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.project_suggestions add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.workspace_invitations add constraint workspace_invitations_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;
alter table public.workspace_audit_events add constraint workspace_audit_events_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete cascade;

update public.message_analyses ma
set workspace_id = p.workspace_id
from public.projects p
where ma.workspace_id is null
  and ma.project_id is not null
  and p.id::text = ma.project_id;

update public.project_suggestions ps
set workspace_id = p.workspace_id
from public.projects p
where ps.workspace_id is null
  and p.id::text = ps.project_id;

create index if not exists idx_message_analyses_workspace_id on public.message_analyses(workspace_id);
create index if not exists idx_project_suggestions_workspace_id on public.project_suggestions(workspace_id);

alter table public.message_analyses alter column workspace_id set not null;
alter table public.project_suggestions alter column workspace_id set not null;

drop policy if exists "workspace members can manage message analyses" on public.message_analyses;

create policy "workspace members can manage message analyses"
on public.message_analyses
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can manage project suggestions" on public.project_suggestions;

create policy "workspace members can manage project suggestions"
on public.project_suggestions
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can read invitations" on public.workspace_invitations;

create policy "workspace members can read invitations"
on public.workspace_invitations
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace owner admin can manage invitations" on public.workspace_invitations;

create policy "workspace owner admin can manage invitations"
on public.workspace_invitations
for all to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists "workspace members can read audit events" on public.workspace_audit_events;

create policy "workspace members can read audit events"
on public.workspace_audit_events
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace owner admin can insert audit events" on public.workspace_audit_events;

create policy "workspace owner admin can insert audit events"
on public.workspace_audit_events
for insert to authenticated
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists "service role full access on first user telemetry" on public.first_user_telemetry_events;

create policy "service role full access on first user telemetry"
on public.first_user_telemetry_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
