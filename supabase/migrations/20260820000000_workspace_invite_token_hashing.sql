-- ============================================================================
-- Perilla 11 (Beta Release Closure Gate): workspace invite token hashing.
--
-- workspace_invitations.token was a plaintext bearer credential. Rate limiting
-- (Perilla 9) bounded online guessing, and the column-level GRANT
-- (20260818000000) removed it from authenticated SELECTs, but the plaintext
-- remained exposed to database dumps, backups, service-role reads, and any
-- accidental logging. This migration moves the table to hash-only storage:
--
--   * adds `token_hash` (sha256 hex of a 192-bit CSPRNG token — see
--     src/lib/security/invite-tokens.ts) and `revoked_at`;
--   * REVOKES every legacy plaintext-token invitation still pending. Legacy
--     tokens cannot be transformed into hashes retroactively without keeping
--     the plaintext around, so the closure-gate decision is: invalidate and
--     require regeneration (docs/release/beta-release-closure-summary.md);
--   * drops the plaintext `token` column entirely;
--   * re-issues the authenticated column-scoped SELECT grant WITHOUT
--     token_hash — the hash is service-role-only, like the plaintext was
--     after 20260818000000.
--
-- Idempotent: add column if not exists / drop column if exists; the legacy
-- revocation predicate (`token_hash is null`) can never match invitations
-- created after this migration, because application inserts always write
-- token_hash (src/lib/workspace-team.ts inviteWorkspaceMember).
-- ============================================================================

alter table public.workspace_invitations
  add column if not exists token_hash text;

alter table public.workspace_invitations
  add column if not exists revoked_at timestamptz;

-- Uniqueness only where a hash exists: legacy rows keep token_hash null.
create unique index if not exists workspace_invitations_token_hash_unique
  on public.workspace_invitations (token_hash)
  where token_hash is not null;

-- Invalidate legacy plaintext-token invitations that are still redeemable.
update public.workspace_invitations
  set status = 'revoked',
      revoked_at = now()
  where status = 'pending'
    and token_hash is null;

-- Remove the plaintext bearer credential from the schema (and from every
-- future dump/backup). Historical rows keep their lifecycle metadata.
alter table public.workspace_invitations
  drop column if exists token;

-- Re-issue the column-scoped SELECT grant (first established in
-- 20260818000000_supabase_rls_service_role_boundary_hardening.sql) so the
-- authenticated role can read invitation lifecycle columns but never
-- token_hash. Service role retains full access.
revoke select on public.workspace_invitations from authenticated;

grant select (
  id,
  workspace_id,
  company_id,
  email,
  role,
  status,
  invited_by_user_id,
  accepted_by_user_id,
  expires_at,
  accepted_at,
  revoked_at,
  created_at
) on public.workspace_invitations to authenticated;
