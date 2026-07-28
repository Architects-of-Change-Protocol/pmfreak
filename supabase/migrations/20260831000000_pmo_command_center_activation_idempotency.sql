-- PMF-004: close the runtime check-then-insert races in default-PMO / Command
-- Center activation and in workspace bootstrap, without adding any global
-- uniqueness constraint on pmos.workspace_id (multiple PMOs per workspace
-- remains a ratified, fully supported product feature — ADR-PMF-003 Rule 1).
--
-- Two structurally identical unguarded check-then-insert races existed:
--
--   1. save-pmo-tenant.ts's own `pmos` insert (the Command Center "Activate"
--      wizard path) — SELECT existingPmo (with no ORDER BY, so not even
--      consistently the same row), then INSERT else UPDATE, as two separate
--      Supabase round-trips with no lock. Two tabs, or a client-timeout
--      racing a still-pending original request, can both observe "no
--      existing PMO" and both insert.
--
--   2. ensureUserWorkspace (src/lib/workspaces.ts) — SELECT existingMembership,
--      then INSERT workspaces + membership if none found, again two separate
--      round-trips with no lock. Two concurrent first-login page loads for a
--      brand-new user can both observe "no membership" and both create an
--      independent workspace.
--
-- The exact same race class was already found and fixed for
-- pmo-service.ts's ensureDefaultPmo() via ensure_default_pmo(), an
-- advisory-lock-guarded Postgres function (migration 20260828000002). That
-- fix was never extended to the Command Center activation path or to
-- workspace bootstrap. Rather than inventing a second mechanism, this
-- migration:
--
--   (a) extends ensure_default_pmo() with two additional parameters so the
--       Command Center activation path can reuse the identical lock,
--       identical "canonical default PMO" identity (oldest active PMO row
--       for the workspace, the pre-existing convention this function
--       already implements), and identical get-or-create semantics — while
--       also being able to set pmo_type and sync name/type on repeat
--       activation, which the project-creation callers of
--       ensure_default_pmo() do not need and must not get (their calls
--       leave p_sync_existing at its default of false, so their behavior is
--       unchanged: an existing default PMO's name is never overwritten by a
--       new project's creation call).
--
--   (b) adds ensure_user_workspace(), the same advisory-lock pattern keyed
--       by user_id instead of workspace_id, for the workspace-bootstrap
--       race.
--
-- Using the SAME ensure_default_pmo() function (and therefore the same
-- advisory lock key, `pmfreak_ensure_default_pmo_<workspace_id>`) for both
-- the project-creation get-or-create path and the Command Center activation
-- path is required, not optional: if the two entry points used different
-- lock keys, a project-creation call and a Command-Center-activation call
-- racing each other for the same brand-new workspace could still both
-- observe zero PMOs and both insert. One canonical function is the only way
-- to guarantee both entry points serialize against each other.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists ensure_default_pmo(uuid, text, uuid);

create function ensure_default_pmo(
  p_workspace_id uuid,
  p_name text,
  p_created_by_user_id uuid,
  p_pmo_type text default null,
  p_sync_existing boolean default false
) returns pmos
language plpgsql
as $$
declare
  v_pmo pmos;
begin
  perform pg_advisory_xact_lock(hashtext('pmfreak_ensure_default_pmo_' || p_workspace_id::text));

  select * into v_pmo
  from pmos
  where workspace_id = p_workspace_id
    and status = 'active'
  order by created_at asc
  limit 1;

  if found then
    if p_sync_existing then
      update pmos
      set name = p_name,
          pmo_type = coalesce(p_pmo_type, pmo_type),
          updated_at = now()
      where id = v_pmo.id
      returning * into v_pmo;
    end if;
    return v_pmo;
  end if;

  insert into pmos (workspace_id, name, pmo_type, created_by_user_id)
  values (p_workspace_id, p_name, coalesce(p_pmo_type, 'company_pmo'), p_created_by_user_id)
  returning * into v_pmo;

  return v_pmo;
end;
$$;

-- Same explicit revoke-then-grant convention as every function in this
-- codebase (20260825000000_fix_security_definer_public_execute_grants.sql).
-- `authenticated` keeps access because pmo-service.ts's ensureDefaultPmo()
-- calls this RPC from the ordinary per-session client (project-creation
-- paths), not the service-role client; RLS's "workspace managers can manage
-- pmos" policy still governs the eventual insert/update for that caller,
-- since this function is deliberately plain invoker rights, not
-- SECURITY DEFINER — exactly as already documented in 20260828000002.
revoke all on function public.ensure_default_pmo(uuid, text, uuid, text, boolean) from public;
grant execute on function public.ensure_default_pmo(uuid, text, uuid, text, boolean) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- ensure_user_workspace(): the same advisory-lock get-or-create pattern,
-- keyed by user_id, for the workspace-bootstrap race in ensureUserWorkspace
-- (src/lib/workspaces.ts). Only ever called from application code using the
-- service-role client (workspace bootstrap runs before the caller has any
-- membership row, so RLS would otherwise block both writes — see the
-- PRIVILEGED_ACCESS comment already on ensureUserWorkspace); grant is
-- restricted to service_role only, narrower than ensure_default_pmo's grant,
-- since no legitimate caller ever needs to invoke this as a plain
-- authenticated user.
-- ─────────────────────────────────────────────────────────────────────────────

create function ensure_user_workspace(
  p_user_id uuid,
  p_default_name text default 'Workspace'
) returns workspaces
language plpgsql
as $$
declare
  v_workspace_id uuid;
  v_workspace workspaces;
begin
  perform pg_advisory_xact_lock(hashtext('pmfreak_ensure_user_workspace_' || p_user_id::text));

  select workspace_id into v_workspace_id
  from workspace_memberships
  where user_id = p_user_id
  order by created_at asc
  limit 1;

  if v_workspace_id is not null then
    select * into v_workspace from workspaces where id = v_workspace_id;
    return v_workspace;
  end if;

  insert into workspaces (name, created_by_user_id)
  values (p_default_name, p_user_id)
  returning * into v_workspace;

  insert into workspace_memberships (workspace_id, user_id, role)
  values (v_workspace.id, p_user_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return v_workspace;
end;
$$;

revoke all on function public.ensure_user_workspace(uuid, text) from public;
grant execute on function public.ensure_user_workspace(uuid, text) to service_role;
