-- Fresh-database migration proof (Perilla 13) found that
-- workspace_admins_can_read_all_memberships (added in
-- 20260515100000_rls_governance_fixes.sql) causes
-- "infinite recursion detected in policy for relation workspace_memberships":
-- its USING clause queries public.workspace_memberships again, which
-- re-triggers RLS on workspace_memberships (including this same policy),
-- looping until Postgres' recursion guard aborts the query.
--
-- Because public.is_workspace_member() (used by ~50 other migrations across
-- nearly every tenant-scoped table) itself queries workspace_memberships,
-- this recursion blocks reads on the vast majority of the schema for any
-- authenticated user — a blocking correctness/RLS defect, not merely a
-- fresh-database artifact. Confirmed via direct RLS smoke test against a
-- clean database (two workspaces, `authenticated` role, real auth.uid()).
--
-- Fix: reuse the existing public.is_workspace_admin(p_workspace_id uuid)
-- SECURITY DEFINER helper (20260627000001_authority_registry_hardening.sql).
-- A SECURITY DEFINER function executes with the privileges of its owner,
-- which is exempt from row level security, so its internal query against
-- workspace_memberships does not re-trigger this table's RLS policies —
-- breaking the recursion. That helper predates this fix but was missing a
-- pinned search_path (required by the SECURITY DEFINER hardening contract in
-- F.2); this migration also fixes that.

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  )
$$;

revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

drop policy if exists "workspace_admins_can_read_all_memberships" on public.workspace_memberships;
create policy "workspace_admins_can_read_all_memberships"
  on public.workspace_memberships
  for select
  to authenticated
  using (public.is_workspace_admin(workspace_id));
