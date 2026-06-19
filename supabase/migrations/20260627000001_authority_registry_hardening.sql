-- ─────────────────────────────────────────────────────────────────────────────
-- Authority Registry: RLS Hardening & Unique Index Fixes
-- Sprint 6 follow-up: addresses review feedback on governance security
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Admin/owner helper function ─────────────────────────────────────────────
-- Reusable guard: returns true if the calling user is an owner or admin of the
-- given workspace.

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
$$;

-- ─── Fix authority_registrations unique constraint ────────────────────────────
-- The original constraint used a plain UNIQUE on (workspace_id, actor_id,
-- authority_type, authority_scope, project_id).  PostgreSQL treats each NULL as
-- distinct, so workspace-scoped rows (project_id = NULL) could be duplicated.
-- We also do not want revoked/expired rows blocking a later active re-grant.
-- Replace with two partial unique indexes scoped to status = 'active'.

alter table public.authority_registrations
  drop constraint if exists authority_registrations_unique_active;

-- One active workspace-scoped authority per actor+type
create unique index if not exists authority_registrations_unique_active_workspace
  on public.authority_registrations (workspace_id, actor_id, authority_type)
  where status = 'active'
    and authority_scope = 'workspace'
    and project_id is null;

-- One active project-scoped authority per actor+type+project
create unique index if not exists authority_registrations_unique_active_project
  on public.authority_registrations (workspace_id, actor_id, authority_type, project_id)
  where status = 'active'
    and authority_scope = 'project'
    and project_id is not null;

-- ─── Tighten authority_registrations RLS ─────────────────────────────────────
-- Any workspace member could previously grant authority to anyone.  Restrict
-- inserts and updates to workspace admins/owners only.

drop policy if exists "workspace members can insert authority registrations" on public.authority_registrations;
drop policy if exists "workspace members can update authority registrations" on public.authority_registrations;

create policy "workspace admins can insert authority registrations"
  on public.authority_registrations
  for insert
  to authenticated
  with check (
    public.is_workspace_admin(workspace_id)
    and granted_by = auth.uid()
  );

create policy "workspace admins can update authority registrations"
  on public.authority_registrations
  for update
  to authenticated
  using (public.is_workspace_admin(workspace_id));

-- ─── Tighten authority_delegations RLS ───────────────────────────────────────
-- Any workspace member could previously insert delegation rows, bypassing all
-- service-layer checks.  Restrict inserts so only the delegator themselves can
-- create rows (service checks prevent broadening/depth violations), and restrict
-- updates (revocations) to workspace admins.

drop policy if exists "workspace members can insert authority delegations" on public.authority_delegations;
drop policy if exists "workspace members can update authority delegations" on public.authority_delegations;

create policy "delegators can insert authority delegations"
  on public.authority_delegations
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
    and delegator_id = auth.uid()
  );

create policy "workspace admins can update authority delegations"
  on public.authority_delegations
  for update
  to authenticated
  using (public.is_workspace_admin(workspace_id));
