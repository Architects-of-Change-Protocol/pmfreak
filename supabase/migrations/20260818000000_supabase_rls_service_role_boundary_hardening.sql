-- Perilla 7 — Supabase RLS / Service Role Boundary Audit.
--
-- Application guards and database policies must agree on the same trust
-- boundaries (Perillas 1-6). Two gaps let the database grant more than the
-- application intends:
--
-- 1. company_subscriptions carried a `for all to authenticated` policy from
--    the original (pre-workspace) tenant model. Any authenticated user could
--    directly INSERT/UPDATE/DELETE their own company_subscriptions row —
--    setting plan/subscription_status/stripe_customer_id/stripe_subscription_id
--    to arbitrary values via the Supabase client/REST API — completely
--    bypassing the Stripe webhook signature check and the checkout route's
--    workspace-membership billing gate (Perilla 6, Perilla 2). This is
--    exactly the class of bug those two perillas hardened at the application
--    layer; the database allowed it to reopen underneath. Reads are
--    preserved (billing/command-center/upload/analyze-ai/copilot routes all
--    read this table via the authenticated server client) — only writes are
--    narrowed to service-role-only.
--
-- 2. workspace_invitations.token is a plaintext, bearer-style invite secret
--    (see docs/security/invite-workspace-role-boundary.md — no hashing yet).
--    The existing "workspace members can read invitations" policy makes
--    every column of every pending invite visible to any workspace member
--    via a direct table query. The application only ever selects
--    email/role/expires_at/status (src/app/(protected)/team/page.tsx), and
--    acceptance reads the token exclusively through the service-role client
--    in acceptWorkspaceInvite (src/lib/workspace-team.ts) — but RLS is
--    row-level, not column-level, so any member could still pull another
--    invitee's token directly and accept on their behalf before the real
--    recipient does (the email-match guard added in Perilla 3 checks the
--    accepting user's email, but a member who already knows another
--    workspace member's email could self-invite... more importantly this is
--    a plaintext bearer credential that should never be broadly readable at
--    all). Column-level GRANT restricts token to service-role only,
--    independent of row-level policy.

-- ============================================================
-- 1. company_subscriptions: split "for all" into SELECT (authenticated,
--    unchanged scope) + service-role-only writes.
-- ============================================================

drop policy if exists "tenant access company_subscriptions" on public.company_subscriptions;

create policy "authenticated can read own company_subscriptions"
  on public.company_subscriptions
  for select
  to authenticated
  using (public.current_company_id() = company_id);

create policy "service role manages company_subscriptions"
  on public.company_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================
-- 2. workspace_invitations: column-scoped SELECT for authenticated,
--    excluding the plaintext `token` column. INSERT/UPDATE/DELETE grants
--    and the existing row-level policies (member read, owner/admin manage)
--    are untouched — this only narrows which *columns* a SELECT may return.
-- ============================================================

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
  created_at
) on public.workspace_invitations to authenticated;
