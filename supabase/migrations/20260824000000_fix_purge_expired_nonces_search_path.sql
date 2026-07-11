-- Fix: public.purge_expired_nonces() was created without a schema-qualified
-- name, a pinned search_path, or an explicit PUBLIC execute revocation —
-- the only SECURITY DEFINER function in the codebase missing all three
-- (found by the Perilla 13B static SECURITY DEFINER review, see
-- docs/release/hosted-grants-report.md). Every other SECURITY DEFINER
-- function in this codebase pins search_path and explicitly revokes the
-- PostgreSQL default PUBLIC execute grant (see e.g.
-- 20260823000001_fix_workspace_memberships_rls_recursion.sql,
-- 20260611000000_operational_evidence_decision_loop.sql). This migration
-- brings purge_expired_nonces() in line with that contract. Its body was
-- already fully schema-qualified (`public.agent_attestation_nonces`), so
-- this is a hardening/consistency fix, not a response to a proven
-- exploit — no application code calls this function today (grep confirms
-- zero call sites in src/), so it is presently unreachable except via a
-- privileged/service-role context (e.g. a future pg_cron job), and the
-- PUBLIC-execute default was latent, not exercised.

create or replace function public.purge_expired_nonces()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.agent_attestation_nonces where expires_at < now();
$$;

revoke all on function public.purge_expired_nonces() from public;
