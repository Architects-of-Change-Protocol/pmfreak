# Billing authorization boundary

Trust boundary for `billing.manage` actions: checkout session creation and billing
portal access. Companion to [`auth-role-boundary.md`](./auth-role-boundary.md),
which covers roles in general; this document is billing-specific.

## The vulnerability this closes

`src/app/api/billing/create-checkout-session/route.ts` derived the `actorRole`
passed to `enforceRuntimeAuthorization({ action: "billing.manage" })` from
`AuthUserContext.role` — the **display role**, sourced from client-writable
`user_metadata.role` (see `auth-role-boundary.md`). `create-portal-session/route.ts`
called the same governance action without deriving any role at all, which was
also incorrect — it meant no authoritative role was ever checked for that route.

This was flagged as a residual risk after
[Perilla 1 — Signup Role Escalation Hardening](./auth-role-boundary.md): the
signup-escalation path was closed (display role can never read back as
`"owner"`/`"admin"`), but the billing route was still architecturally wired to
authorize a critical, revenue-facing action from a role value that is never
trustworthy for authorization — it's informational/UI-only by design. A
practical side effect: because display role is now permanently clamped to
`"pm"`/`"viewer"`, real workspace owners/admins could never actually pass the
old check either, so the route was both insecure in principle and broken in
practice for legitimate users.

## Billing actions in scope

| Action | Route | What it does |
| --- | --- | --- |
| `billing.manage` | `POST /api/billing/create-checkout-session` | Creates a Stripe Checkout session to start/upgrade a subscription |
| `billing.manage` | `POST /api/billing/create-portal-session` | Opens the Stripe Billing Portal for an existing customer |

`GET /api/billing/state` is a read-only endpoint scoped to the caller's own
company subscription; it performs no billing mutation and is out of scope.
`POST /api/billing/webhook` is Stripe-authenticated (webhook secret), not
user-role-authenticated, and is out of scope.

## Who can manage billing

```
owner: allowed
admin: allowed
pm:    denied
viewer: denied
```

Defined by `canManageBilling()` in `src/lib/workspace-access.ts`. This is a
conscious policy choice for this perilla: owner and admin are the only roles
that create financial obligations on behalf of the workspace. There is no
current product requirement for `pm` to manage billing, so it is denied along
with `viewer` per the safe default.

## The trusted source of `actorRole` for billing.manage

`requireBillingManageMembership({ userId, workspaceId })` in
`src/lib/workspace-access.ts` is the sole authorization gate for both routes.
It:

1. Queries `workspace_memberships` directly for `(workspace_id, user_id)` —
   the same server-side, RLS-governed table used everywhere else in the app
   for workspace role resolution.
2. Denies (`WorkspaceMembershipError("workspace_missing")`) if no membership
   row exists — this covers both "workspace doesn't exist" and "user isn't a
   member," collapsed into one fail-closed outcome so the response can't be
   used to enumerate workspaces.
3. Denies (`WorkspaceMembershipError("insufficient_role")`) if the role is not
   `"owner"` or `"admin"` per `canManageBilling()`.
4. Only on success, returns `{ userId, workspaceId, role }` — the validated
   role — which the caller may use, but the function itself has already made
   the authorization decision; the route does not re-derive or override it.

`requireBillingManageMembership` takes only `userId` and `workspaceId` — there
is no `role`/`actorRole` parameter, so there is nothing for a caller to pass in
that would influence the decision.

### Sources that are explicitly NOT consulted

- `AuthUserContext.role` (display role) — informational/UI only, sourced from
  client-writable `user_metadata.role`, never authoritative (see
  `auth-role-boundary.md`).
- `user_metadata.role` directly — same reason.
- Any field in the request body: `role`, `actorRole`, `billingRole`,
  `workspaceRole`, `isAdmin`, `isOwner`, `isFounder`, `permissions`, `claims`,
  `metadata`. The checkout route's `CheckoutPayload` type only reads `plan`;
  every other field is structurally ignored. `create-portal-session` reads no
  body at all.
- Any query parameter or cookie value.
- Stripe customer/session metadata. Metadata written to Stripe
  (`companyId`, `plan`) is informational only, written *after* authorization
  has already succeeded, and is never read back to make an authorization
  decision.

## Order of operations

```
1. authenticate user (getAuthUser)
2. resolve workspaceId from the x-pmf-workspace-id header — missing/empty → deny (403), fail closed
3. requireBillingManageMembership(userId, workspaceId) — server-side DB query
   → missing membership → deny (403)
   → role not owner/admin → deny (403)
4. parse and validate plan from the request body — invalid → deny (400)
5. only after 1-4 all pass: create/reuse Stripe customer, create Stripe session
```

Authorization always completes before any Stripe API call. No Stripe session
is created on any denial path.

## Why these two routes bypass the generic AOC governance wrapper

Every other governed route in the app calls the shared
`enforceRuntimeAuthorization()` / `evaluateGovernanceAction()` pipeline
(`src/aoc/enterprise/runtime/governance-core.ts`). The billing routes
deliberately do not, for two concrete reasons found while fixing this:

1. That pipeline's `"billing.manage"` policy carries a special case
   (`decisionNeedsApproval` in `governance-core.ts`): `actorRole === "admin"`
   returns `require_admin_approval` rather than an outright allow. There is no
   implemented approval workflow wired to these routes, so calling the
   wrapper with an honestly-reported `actorRole: "admin"` would permanently
   block real workspace admins — directly contradicting the required policy
   above (owner **and** admin allowed). Changing that shared branch would
   affect every other consumer of `"billing.manage"` app-wide, which is out of
   scope for this fix.
2. The wrapper's workspace-scoped composed-guard step
   (`access.requireGovernancePermission`) re-enters the same authorization
   pipeline through `src/lib/security/access-guards.ts`, adding several layers
   of indirection across seven adapters (security-audit, privileged-db,
   access-verification, agent-attestation, policy-evaluator, trust-domain,
   trust-coordination) for what should be a single, deterministic table
   lookup. A dedicated, minimal, directly-testable helper is safer and more
   auditable for one of the most sensitive, revenue-facing surfaces in the
   app.

`requireBillingManageMembership` is intentionally small and single-purpose so
its behavior is easy to verify end-to-end (see the tests below). Denials still
go through `denyResponse()`, which logs a `billing_governance_denied` security
event via the same telemetry pipeline (`src/lib/security/telemetry.ts`) used
elsewhere — so audit visibility on denials is preserved even though the
generic governance wrapper is not invoked.

## What happens in each edge case

| Scenario | Result |
| --- | --- |
| No `x-pmf-workspace-id` header | 403, `workspace_missing`, no membership lookup, no Stripe call |
| Authenticated, but no `workspace_memberships` row for this workspace | 403, `workspace_missing` |
| `workspace_memberships.role = "viewer"` | 403, `insufficient_role` |
| `workspace_memberships.role = "pm"` | 403, `insufficient_role` |
| `user_metadata.role = "admin"` but no/insufficient workspace membership | 403 — display role is never consulted |
| `AuthUserContext.role = "admin"` but workspace role is `"viewer"` | 403 — display role is never consulted |
| Body contains `role`/`actorRole`/`billingRole`/`isOwner`, real workspace role is `"viewer"`/`"pm"` | 403 — body fields are structurally never read for authorization |
| `workspace_memberships.role = "admin"` | 200, Stripe checkout/portal session created |
| `workspace_memberships.role = "owner"` | 200, Stripe checkout/portal session created |
| Unrecognized/garbage role value in the DB | 403, fail closed (never silently trusted) |

## Regression this fix prevents

- `user_metadata.role = "admin"`/`"owner"` (spoofed pre-fix, historical, or
  tampered data) can no longer create a checkout session or open the billing
  portal.
- A client sending `role`, `actorRole`, `billingRole`, `isOwner`, `isAdmin`, or
  `isFounder` in the request body can no longer influence billing
  authorization — those fields were never read for this purpose, and this is
  now covered by tests that inject them alongside a genuinely insufficient
  workspace role and assert denial.
- Real workspace owners and admins are no longer incorrectly blocked by a
  display role that can never legitimately read back as `"owner"`/`"admin"`
  (see the "vulnerability this closes" section above) — this fix restores the
  legitimate flow, not just closes the escalation path.

## Tests

- `tests/billing-authorization-workspace-membership.test.mjs` — direct,
  behavioral tests of `requireBillingManageMembership()` and
  `canManageBilling()` against a mocked Supabase client: owner/admin allow,
  pm/viewer deny, missing membership fails closed, unrecognized role and role
  casing fail closed, and the function signature has no role parameter for a
  caller to spoof.
- `tests/billing-checkout-session-route.test.mjs` — full route-level
  behavioral tests (auth, Supabase, and Stripe mocked at the module boundary;
  the real route handlers and real `requireBillingManageMembership` run
  unmodified) covering both `create-checkout-session` and
  `create-portal-session`: display-role/metadata-role bypass attempts, body
  role injection, viewer/pm denial, owner/admin allow, missing workspaceId,
  "Stripe never called on denial," Stripe metadata excludes client-role
  fields, and the authorized end-to-end flow.
- `tests/authorization-adversarial-phase-4-3.test.mjs` and
  `tests/governance-runtime-contract.test.mjs` were updated to assert the new
  boundary (`requireBillingManageMembership` present, `user.role` /
  `toGovernanceRole` / `enforceRuntimeAuthorization` absent from the billing
  routes) instead of the old display-role-derived pattern.

## Residual risks

- **Other billing-adjacent surfaces**: `GET /api/billing/state` is read-only
  and out of scope. No trial/license/subscription-management API routes exist
  elsewhere in the codebase today (verified by search); if any are added,
  they must use `requireBillingManageMembership` or an equivalent
  workspace-membership-backed check, not display role.
- **`enforceRuntimeAuthorization`'s `"billing.manage"` policy is unchanged** —
  it still exists in `governance-core.ts` with its `minimumRole`/admin-approval
  metadata for any future caller. It is simply no longer used by these two
  routes. If a future feature wants the generic governance wrapper's approval
  workflow for billing actions, that policy will need deliberate design work
  (an actual approval UI/flow), not just re-wiring `actorRole`.
- **UI display role**: components that render `user.role` for cosmetic/nav
  purposes are unaffected and still correctly non-authoritative (see
  `auth-role-boundary.md`).
