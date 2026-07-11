-- Fix: reserve_upload_quota / commit_upload_quota / cancel_upload_quota and
-- four RLS-helper SECURITY DEFINER functions (is_organizational_memory_governor,
-- is_organizational_pattern_governor, is_decision_effectiveness_governor,
-- is_bridge_owner) relied on PostgreSQL's default PUBLIC execute grant
-- instead of an explicit revoke-then-grant, unlike every other SECURITY
-- DEFINER function in this codebase (see
-- 20260823000001_fix_workspace_memberships_rls_recursion.sql and the
-- revoke/grant pairs in 20260611000000_operational_evidence_decision_loop.sql
-- for the established pattern this codebase otherwise follows consistently).
--
-- Found by the Perilla 13B static SECURITY DEFINER review
-- (docs/release/hosted-grants-report.md, PR brief section F.3). No proven
-- exploit is attached to this — the quota functions already required a
-- valid `authenticated`/`service_role` session for their intended callers
-- at the application layer, and the governor/bridge-owner functions only
-- return a boolean membership check — but leaving PUBLIC (and therefore
-- `anon`) with an un-revoked EXECUTE grant is contrary to this codebase's
-- own least-privilege contract for SECURITY DEFINER functions. Each revoke
-- below is paired with the grant its existing callers need, so no intended
-- caller's access changes — only PUBLIC/anon's does.
--
-- Not fixed here: public.prepare_decision_evidence_link() (trigger
-- function, `returns trigger`) — trigger functions cannot be invoked via a
-- direct SQL call regardless of EXECUTE grants (Postgres: "trigger
-- functions can only be called as triggers"), so its un-revoked PUBLIC
-- grant is inert. Left as-is to keep this migration's diff minimal;
-- documented as an accepted low-risk static finding in
-- docs/release/hosted-grants-report.md.

revoke all on function public.reserve_upload_quota(text, integer, integer, text, text) from public;
grant execute on function public.reserve_upload_quota(text, integer, integer, text, text) to authenticated, service_role;

revoke all on function public.commit_upload_quota(uuid, text) from public;
grant execute on function public.commit_upload_quota(uuid, text) to authenticated, service_role;

revoke all on function public.cancel_upload_quota(uuid, text) from public;
grant execute on function public.cancel_upload_quota(uuid, text) to authenticated, service_role;

revoke all on function public.is_organizational_memory_governor(uuid) from public;
grant execute on function public.is_organizational_memory_governor(uuid) to authenticated;

revoke all on function public.is_organizational_pattern_governor(uuid) from public;
grant execute on function public.is_organizational_pattern_governor(uuid) to authenticated;

revoke all on function public.is_decision_effectiveness_governor(uuid) from public;
grant execute on function public.is_decision_effectiveness_governor(uuid) to authenticated;

revoke all on function public.is_bridge_owner(uuid, uuid) from public;
grant execute on function public.is_bridge_owner(uuid, uuid) to authenticated;
