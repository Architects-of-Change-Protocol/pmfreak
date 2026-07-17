-- ensure_default_pmo(): close a runtime PMO-creation race with the same
-- advisory-lock pattern already used by 20260828000001's one-time backfill.
--
-- pmo-service.ts's ensureDefaultPmo() is a check-then-insert
-- (listPmos() then createPmo()) run from application code across four
-- project-creation entry points (save-project-onboarding.ts,
-- projects/actions.ts, command-center/actions.ts, api/getting-started).
-- Two concurrent requests for the same brand-new workspace (e.g. a
-- double-submitted onboarding form, or two tabs) can both observe zero
-- PMOs and both insert a "General PMO" row before either commits — the
-- exact race already reproduced and fixed for the migration backfill via
-- pg_advisory_xact_lock, just triggered at runtime instead of migration
-- time. supabase-js has no multi-statement transaction API, so the lock
-- has to be acquired and the check-then-insert performed inside a single
-- Postgres function, called via .rpc() from ensureDefaultPmo() rather than
-- as two separate round-trips.
--
-- Deliberately plain invoker rights, not an elevated-privilege function: the
-- eventual insert must still pass the same RLS policy a normal client-side
-- insert would, so calling this RPC grants no privilege beyond what the
-- caller already has.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function ensure_default_pmo(
  p_workspace_id uuid,
  p_name text,
  p_created_by_user_id uuid
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
    return v_pmo;
  end if;

  insert into pmos (workspace_id, name, pmo_type, created_by_user_id)
  values (p_workspace_id, p_name, 'company_pmo', p_created_by_user_id)
  returning * into v_pmo;

  return v_pmo;
end;
$$;

-- Explicit revoke-then-grant rather than relying on Postgres's default
-- PUBLIC execute grant, matching this codebase's established convention for
-- every function (not just SECURITY DEFINER ones) — see
-- 20260825000000_fix_security_definer_public_execute_grants.sql and
-- 20260611000000_operational_evidence_decision_loop.sql.
revoke all on function public.ensure_default_pmo(uuid, text, uuid) from public;
grant execute on function public.ensure_default_pmo(uuid, text, uuid) to authenticated, service_role;
