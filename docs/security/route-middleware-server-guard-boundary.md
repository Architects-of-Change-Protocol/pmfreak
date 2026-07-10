# Route middleware / server guard consistency boundary (Perilla 8)

**Middleware is not the authorization boundary for sensitive data.** PMFreak's
edge proxy (`src/proxy.ts`) decides whether a *page* redirects to `/login` or
an onboarding step. It intentionally passes every `/api/**` request straight
through untouched, and even for pages it only proves *authentication* and
*"has some workspace"* — never workspace membership for a specific resource,
project access, billing-manage authority, or founder/internal identity. Every
sensitive route, page, layout, server action, and API handler must prove its
own authorization locally, server-side, before it reads or mutates anything
sensitive. This document is the trust model for that boundary, companion to
`auth-role-boundary.md`, `admin-founder-endpoint-boundary.md`,
`billing-authorization-boundary.md`, `invite-workspace-role-boundary.md`,
`workspace-role-update-boundary.md`, `stripe-webhook-billing-lifecycle-boundary.md`,
and `supabase-rls-service-role-boundary.md` (Perillas 1–7).

## The vulnerability this closes

Perillas 1–7 hardened specific trust boundaries (signup, billing, invites,
role updates, founder/admin endpoints, the Stripe webhook, and RLS/
service-role usage). Perilla 8 audits the horizontal seam that cuts across all
of them: **is the correct guard actually present, in the correct order, on
every route that touches sensitive data** — not just the ones a prior perilla
happened to name.

The audit (source-scan across all ~520 `src/app/api/**/route.ts` files, all
`(protected)/**/page.tsx` pages, and all 13 `"use server"` files, cross-checked
against the `@/lib/security/server-authorization` capability pipeline) found
several concrete instances of the exact failure modes this perilla's brief
calls out:

1. **Trust-handshake approve/reject/revoke had no auth check at all, and
   trusted the approver's identity from the request body.**
   `src/app/api/governance/trust/handshakes/[id]/approve/route.ts` (and its
   `reject`/`revoke` siblings) read `body.approverUserId` and called
   `approveTrustHandshake({ id, approverUserId: body.approverUserId })` with
   zero authentication — any unauthenticated caller could approve a
   cross-domain trust handshake (which creates a standing verifier policy
   granting an external verifier real capability authority) and attribute it
   to an arbitrary user id. Fixed: `requireAuthUser()` +
   `isFounderOrInternalUser()` gate the route; the actor id always comes from
   the session.
2. **Delegation issuance trusted `body.delegatorRole` for an authorization
   decision, and never checked workspace membership.**
   `POST /api/v1/delegations` and `POST /api/governance/delegations/issue`
   spread the raw request body — including a client-supplied
   `delegatorRole` — into `issueDelegatedCapability`, whose
   `assertDelegationRules` gates which actions a delegator may delegate based
   on that role. Any authenticated user could claim `delegatorRole: "owner"`
   for a workspace they had never joined and receive a valid, persisted
   delegation grant. Fixed: `delegatorRole` is now always resolved
   server-side from `workspace_memberships` for the exact `workspaceId` being
   delegated against (via `requireWorkspaceRole(workspaceId, "pm")`, which
   also confirms real membership).
3. **Delegation revoke had no ownership check at all.**
   `revokeDelegatedCapability` updated `governance_delegations` by id with no
   workspace/delegator check — any authenticated user who observed or guessed
   a delegation id could revoke it (cascading to its full child chain).
   Fixed: a new `requireDelegationRevokeActor` helper
   (`src/lib/workspace-access.ts`) resolves the delegation's real
   `workspace_id`/`delegator_user_id` first and only allows the original
   delegator or a workspace owner/admin to revoke.
4. **A federation webhook accepted any Bearer token as valid.**
   `src/app/api/federation/webhooks/[connectorId]/route.ts` set
   `federationAuthorized: request.headers.get("authorization")?.startsWith("Bearer ") ?? false`
   — the token *value* was never checked against anything, so any caller
   could impersonate a federation connector for any `workspaceId`. Fixed: the
   token is now verified with `requireSystemOrWebhookSecret()` against
   `FEDERATION_WEBHOOK_SECRET`, failing closed if unset.
5. **Cross-tenant admin surfaces (`GET /api/governance/trust/handshakes`,
   `GET /api/governance/trust/events`) had no auth at all**, despite their own
   privileged-access-registry entries claiming "admin review"/"serves
   admin/system review purposes only". Fixed: both now gate on
   `isFounderOrInternalUser()`.
6. **A policy-evaluation route let a client-supplied `body.actor` skip
   authentication entirely.** `POST /api/sdk/policies/evaluate` only called
   `getAuthUser()` when `body.actor` was absent — supplying
   `actor: { actorType: "ai_agent", ... }` bypassed authentication and the
   downstream membership check. Fixed: `getAuthUser()` now always runs first.
7. **Several read GET routes had no guard at all**, taking `workspaceId`/
   `projectId` from the query string with no membership/access check:
   `/api/federation/events`, `/api/federation/pulse`, `/api/ai/project-state`,
   `/api/ai/suggestions`, `/api/sdk/agents/evaluate`. Fixed with
   `requireWorkspaceMember`/`requireProjectAccess` as appropriate.
8. **Five `/api/ai/*` module routes had no auth guard at all** (unauthenticated
   AI-inference invocation): `escalation-guide`, `meetings`, `political-risk`,
   `project-memory`, `stakeholder-intel`, plus `pmfreak-brain` (which forwards
   the caller's cookie to downstream authenticated routes with no local
   check). Fixed with `requireAuthUser()`.
9. **Two intelligence routes skipped authentication entirely on the
   no-`projectId` branch.** `/api/intelligence/execution-risk` and
   `/api/intelligence/operational-live` only ran `requireProjectPermission`
   when a `projectId` was supplied — an unauthenticated request with no
   `projectId` reached the mock/aggregate payload with zero auth check.
   Fixed with an unconditional `requireAuthenticatedUser()`.
10. **Milestone/execution-task *mutations* were gated on `"read"` permission
    instead of `"write"`.** `createProjectMilestone`, `updateProjectMilestone`,
    `completeProjectMilestone`, `cancelProjectMilestone`
    (`src/lib/schedule/milestones.ts`), `updateExecutionTaskSchedule`
    (`src/lib/schedule/task-schedule.ts`), and
    `convertTaskDraftToExecutionTask`
    (`src/lib/execution-tasks/convert-task-draft.ts`) all called
    `requireProjectAccess(projectId, "read")` even though they insert/update
    rows — under `src/lib/security/rbac.ts`, `"read"` is granted to
    `external_stakeholder`, a view-only role that does not get `"write"`. A
    view-only project member could create/modify/complete/cancel milestones
    and convert task drafts. Fixed: all now require `"write"`.
11. **A dead auth-bypass parameter.** `convertTaskDraftToExecutionTask`
    accepted an optional `actorUserId` that, when present, skipped
    `requireAuthenticatedUser()` entirely. No caller ever used it, but it was
    a live footgun for any future caller. Removed.
12. **A route.ts imported a legacy security module directly**, which the
    codebase's existing `runtime-consumer-sovereignty-boundary.test.mjs`
    already forbids (`src/app/**` may not import
    `@/lib/security/access-guards` directly — it must go through the
    `@/aoc/runtime-consumer` re-export). Caught and fixed during this
    perilla's own verification pass, not a newly-introduced regression.

None of these were `AuthUserContext.role`/`user_metadata.role`-style display-
role spoofing (that class of bug was already closed by Perillas 1–5) — every
finding above is the *other* half of the brief: a route that either had no
guard at all, trusted an identity/role field straight from the request body,
or called the right guard with the wrong scope/permission.

## Route trust model

| Layer | What it proves | What it does NOT prove |
| --- | --- | --- |
| `src/proxy.ts` (edge proxy) | The request has a valid Supabase session cookie (for page routes); resolves coarse onboarding-state redirects from the session JWT | Workspace membership for any specific `workspaceId`; project access; billing-manage authority; founder/internal identity; anything about `/api/**` requests, which pass through untouched |
| `src/app/(protected)/layout.tsx` | `requireAuthUser()` (real DB-backed identity) + the caller's own canonical workspace is resolved | Access to a workspace/project/resource named in a URL param, query string, or form field — pages under `(protected)/**` that accept one must still guard it themselves |
| Route/page/action-local guard (this perilla's subject) | The actual authorization decision for the specific resource being read/mutated | — this is the boundary that must never be skipped |

**Why middleware can't be the boundary here:** Next.js middleware (this
fork's `proxy.ts`) cannot perform the async, multi-table DB lookups that real
authorization requires (workspace membership role, project-to-workspace
ownership, billing-manage role, founder allowlist) — `resolveOnboardingStateFromJwt`
in `src/proxy.ts` is explicitly JWT-only for this reason. Even if it could,
API routes need JSON `401`/`403` responses, not redirects, and a single
edge-level check can't express the different guard each of the ten categories
below requires. Middleware is a coarse, fast first filter; it is not, and
cannot be, the final authorization boundary.

## Route categories and their required guard

| Category | Required guard | Examples |
| --- | --- | --- |
| **Public** | None — but must be in `PUBLIC_ROUTE_ALLOWLIST` (`src/lib/security/route-guard-registry.ts`) and must never read a sensitive table or use service-role without an explicit, test-enforced justification | `/api/build-info`, `/api/health`, `/api/route-debug`, `/api/login`, `/api/governance/trust/.well-known/capability-issuer`, `/api/governance/trust/keys`, `/api/governance/capabilities/verify` |
| **Auth-only** | `requireAuthUser()` / `getAuthUser()` / `requireAuthenticatedUser()` — identity only, no workspace/project/billing/founder data | `/api/ai/escalation-guide`, `/api/ai/meetings`, `/api/ai/political-risk`, `/api/ai/project-memory`, `/api/ai/stakeholder-intel`, `/api/ai/pmfreak-brain`, `/api/billing/state` (read-only, self-scoped) |
| **Workspace-scoped** | `requireWorkspaceRole` / `requireWorkspaceMember` — role/membership resolved from `workspace_memberships` for the *exact* `workspaceId` being used, never a client-supplied role | `/api/federation/events`, `/api/federation/pulse`, `/api/sdk/agents/evaluate`, `team/actions.ts` |
| **Project-scoped** | `requireProjectAccess(projectId, "read" \| "write")` — project resolved to its workspace server-side; `"write"` for any mutation, `"read"` only for reads | `/api/ai/project-state`, `/api/ai/suggestions`, `/api/intelligence/execution-risk`, `/api/intelligence/operational-live`, schedule/execution-task mutations |
| **Billing** | `requireBillingManageMembership` — never `user.role`/`user_metadata.role`/`body.actorRole`/`body.billingRole` | `/api/billing/create-checkout-session`, `/api/billing/create-portal-session` |
| **Webhook** | Signature/secret verification *before* any service-role client — `verifyStripeWebhookEvent` (Stripe) or `requireSystemOrWebhookSecret` (internal shared-secret webhooks) | `/api/billing/webhook`, `/api/federation/webhooks/[connectorId]` |
| **Founder/internal** | `isFounderOrInternalUser()` / `evaluateFounderOrInternalAccess()` — never `user_metadata.role`, display role, or `body.isFounder`/`isAdmin` | `/api/early-access/*`, `(protected)/early-access/page.tsx`, `/api/runtime/hardening`, `/api/governance/trust/handshakes*`, `/api/governance/trust/events` |
| **Invite acceptance** | `acceptWorkspaceInvite` / `acceptEarlyAccessInvite` — token validated server-side, email matched server-side, role/workspace taken from the invite record, never the client | `(protected)/accept-invite/[token]/page.tsx`, `/api/early-access/accept` |
| **Upload/evidence** | `requireProjectAccess` (or `getAuthUser` + workspace-scoped storage path) before any storage/DB read-write | `/api/upload`, `/api/project-evidence`, `/api/project-evidence-content` |
| **AOC/governance** | `requireAuthenticatedUser` + `evaluateCapability`/`requireWorkspaceMember`/`requireProjectAccess` (the `@/lib/security/server-authorization` pipeline, which delegates to the enterprise runtime's real DB-backed membership checks — verified not to be a stub during this audit) | The ~450 `/api/agents/**`, `/api/v1/**`, `/api/sdk/**` routes; see `docs/security/local-authority-bypass-audit.md` for the full prior audit of this surface |
| **Delegation** | `requireWorkspaceRole` (issue) / `requireDelegationRevokeActor` (revoke) / identity-matched `actorUserId` (consume/evaluate) | `/api/v1/delegations*`, `/api/governance/delegations/*` |

## API route expectations

- Every HTTP method (`GET` *and* `POST`/`PATCH`/`DELETE`) needs its own guard
  check — a route that gates `POST` but leaves `GET` open still leaks data.
- `workspaceId`/`projectId`/`companyId` read from `request.json()`,
  `searchParams`, or a path param is never trusted directly in a query — it
  must be validated against the caller's real membership/access first.
- `401` for unauthenticated, `403` for authenticated-but-not-authorized,
  `404` for tenant-scoped resources where confirming existence itself would
  leak information (e.g. delegation revoke returns `404` for both "not
  found" and "not yours" — see `requireDelegationRevokeActor`), `400` for
  malformed input, `409` for invalid state/replay.
- Service-role (`createSupabaseServiceRoleClient`/`createPrivilegedSupabaseClient`)
  is only ever created *after* the route's guard has already run, and the
  call site must be listed in `src/lib/security/privileged-access-registry.ts`
  (enforced by `tests/supabase-rls-service-role-boundary.test.mjs` test #8 —
  unaffected by this perilla, already comprehensive).

## Page/layout expectations

`(protected)/layout.tsx` gives every page under it `requireAuthUser()` plus
the caller's own canonical workspace — free authentication, not free
authorization. A page still needs its own guard if it:

- reads founder/internal-only data (must call `isFounderOrInternalUser()`
  before any privileged client — see `(protected)/early-access/page.tsx`);
- uses `createSupabaseServiceRoleClient`/`createPrivilegedSupabaseClient`
  directly (must be scoped to the caller's own resolved workspace, or gated
  by a founder check — audited across every privileged-client page in this
  perilla, none found unguarded);
- takes a resource id from a dynamic route segment (`[id]`, `[token]`,
  `[pmId]`) — must validate the caller's access to that specific resource
  server-side (e.g. `(protected)/projects/[id]/page.tsx` calls
  `evaluateCapabilityAccess({ workspaceId, projectId, permission: "read" })`
  before rendering; `(protected)/accept-invite/[token]/page.tsx` delegates to
  `acceptWorkspaceInvite`, which fails closed on email/expiry/status
  mismatch).

## Server action expectations

Every `"use server"` file (13 total: `capabilities/actions.ts`,
`command-center/actions.ts`, `playground/actions.ts`, `policies/actions.ts`,
`projects/actions.ts`, `team/actions.ts`, `trust/agents/actions.ts`,
`login/actions.ts`, `signup/actions.ts`, and the four `src/lib/pmo/save-*.ts`/
`src/lib/projects/save-project-onboarding.ts` server actions) must, and
currently does:

- call an auth guard before touching `FormData`;
- never trust a `role`/`workspaceRole` field read from `FormData` for an
  actual grant — `formData.get("role")` values go through
  `normalizeWorkspaceRole()`/`canAssignWorkspaceRole()` and are re-validated
  by `inviteWorkspaceMember`/`requireWorkspaceRole`, never inserted as-is
  (see `signupAction`, which hardcodes `DEFAULT_SIGNUP_ROLE` and never reads
  a submitted `role` field at all — Perilla 1);
- validate any `workspaceId`/`projectId` read from `FormData` against the
  caller's real membership (`requireWorkspaceRole(workspaceId, ...)`) before
  using it, or derive it server-side from the caller's own membership
  (`ensureUserWorkspace(user.id)`, `resolveCanonicalWorkspace(user.id)`) —
  never trusted blindly;
- create a service-role client only after the guard above has already run.

One latent (not currently exploitable) risk: `saveTeamInvites`
(`src/lib/pmo/save-team-invites.ts`) inserts a `role` field into
`pmo_team_invites` without passing it through `normalizeWorkspaceRole`. No
accept-invite flow currently reads that column back to grant a real
`workspace_memberships` role, so it's inert today — but any future feature
that promotes a `pmo_team_invites.role` into a real grant must route it
through `normalizeWorkspaceRole`/`canAssignWorkspaceRole` first.

## Workspace/project access pattern

Central helpers (do not duplicate):

- `requireWorkspaceRole(workspaceId, minimumRole)` / `requireBillingManageMembership`
  / `requireWorkspaceInviteActor` / `requireWorkspaceRoleUpdateActor` —
  `src/lib/workspace-access.ts`, all read `workspace_memberships` directly.
- `requireDelegationRevokeActor(delegationId, userId)` — new in this perilla,
  same file: resolves a delegation's real `workspace_id`/`delegator_user_id`
  before allowing a revoke.
- `requireAuthenticatedUser` / `requireWorkspaceMember` / `requireProjectAccess`
  / `requireResourceWorkspaceAccess` / `requireSystemOrWebhookSecret` /
  `evaluateCapability` — `src/lib/security/server-authorization.ts`, the
  guard surface for the AOC governance/agent route family.

`requireProjectAccess`/`requireResourceWorkspaceAccess` take a `Permission`
(`"read" | "write" | ...`, `src/lib/security/rbac.ts`) — always pass `"write"`
for a mutation. Passing `"read"` on a mutation silently grants view-only
roles write access (see finding #10 above).

## Billing guard pattern

`requireBillingManageMembership({ userId, workspaceId })` reads
`workspace_memberships.role` directly and is the only function that may
authorize `billing.manage` actions (checkout session creation, portal
access). Never `user.role`, `user_metadata.role`, `body.actorRole`, or
`body.billingRole` — see `docs/security/billing-authorization-boundary.md`.

## Founder/internal guard pattern

`isFounderOrInternalUser(user)` / `evaluateFounderOrInternalAccess({ email })`
(`src/lib/auth.ts`) are the only functions that may authorize founder/
internal-only surfaces. Input is `{ email }` only — no `role`/`actorRole`/
`isFounder`/`isAdmin` parameter exists to smuggle elevated identity through.
See `docs/security/admin-founder-endpoint-boundary.md`.

## Webhook guard pattern

Two forms, both must run before any service-role client:

1. **External signed webhook (Stripe):** `verifyStripeWebhookEvent` validates
   the raw body against the Stripe signature header.
2. **Internal shared-secret webhook:** `requireSystemOrWebhookSecret(received, expected)`
   compares a bearer token against a server-only env var (e.g.
   `FEDERATION_WEBHOOK_SECRET`), failing closed if the env var is unset. Prior
   to this perilla, `federation/webhooks/[connectorId]` only checked that an
   `Authorization` header started with the literal string `"Bearer "` — never
   the token value.
3. **Machine-to-machine handshake token:** `consumeOrAssertHandshake`
   (`/api/governance/trust/events/import`) validates a signed handshake token
   plus an event-payload signature — a third legitimate pattern for
   non-human callers, distinct from a user session.

## Invite acceptance pattern

`acceptWorkspaceInvite` (workspace invites) and `acceptEarlyAccessInvite`
(early-access invites) are the only functions that may accept an invite.
Both validate the token server-side, match the invite's email against the
authenticated session, and take `workspaceId`/`role` from the resolved
invite record — never a client-supplied value. Expired/revoked/used tokens
fail closed. See `docs/security/invite-workspace-role-boundary.md`.

## Service-role route expectations

Unchanged by this perilla, already comprehensive: every
`createSupabaseServiceRoleClient`/`createPrivilegedSupabaseClient` call site
must appear in `src/lib/security/privileged-access-registry.ts`, and no
`"use client"` file may call either factory — both enforced by
`tests/supabase-rls-service-role-boundary.test.mjs` (tests #7, #8). This
perilla added local guards to two governance/trust routes (`handshakes` GET,
`events` GET) that had a registered privileged-access entry but no
*application-layer* auth guard gating access to it — the registry entry
alone does not enforce who may reach the route.

## Forbidden auth patterns

Never used for a server-side authorization decision, anywhere in this
codebase (enforced by `tests/route-guard-consistency.test.mjs`):

- `user.role === "owner"` / `authUser.role === "admin"` /
  `AuthUserContext.role` (display role — see `src/lib/auth.ts`'s
  `toDisplayRole`, which is clamped so it can never even read back as
  `"owner"`/`"admin"`).
- `user_metadata.role === "owner"` / `raw_user_meta_data` role elevation.
- `body.actorRole` / `body.isAdmin` / `body.isFounder` / `body.isOwner` /
  `body.billingRole`.

(Note: `membership.role`/`access.role` comparisons — the real,
`workspace_memberships`-resolved role — are the *correct* pattern and are
deliberately not flagged; see `src/lib/workspace-access.ts`,
`src/lib/workspace-team.ts`, `src/lib/audit-trail.ts`.)

## How tests enforce route consistency

`tests/route-guard-consistency.test.mjs` (new in this perilla):

- Every entry in `ROUTE_GUARD_REGISTRY` (`src/lib/security/route-guard-registry.ts`)
  points at a real file that contains its declared `requiredGuard` string.
- Every entry in `PUBLIC_ROUTE_ALLOWLIST` either doesn't call a service-role
  factory, or has an explicit `serviceRoleJustification`.
- Billing routes call `requireBillingManageMembership`; the Stripe webhook
  verifies its signature before any service-role client; founder/internal
  routes call `isFounderOrInternalUser`/`evaluateFounderOrInternalAccess`;
  invite routes call `acceptWorkspaceInvite`/`acceptEarlyAccessInvite`.
- Regression guards for every fix in this perilla: trust-handshake mutation
  routes never read `body.approverUserId`/`rejectorUserId`/`revokerUserId`;
  delegation issue routes never spread the raw body's `delegatorRole`;
  delegation revoke routes always call `requireDelegationRevokeActor`; the
  federation webhook never treats a bare `Bearer ` prefix as authorization;
  schedule/execution-task mutations require `"write"`, not `"read"`.
- Every `route.ts` under the sensitive namespaces this perilla covers
  (`billing`, `early-access`, `governance/trust`, `governance/delegations`,
  `governance/capabilities`, `v1/delegations`, `federation`) must be in
  `ROUTE_GUARD_REGISTRY` or `PUBLIC_ROUTE_ALLOWLIST` — a new, unclassified
  route in one of these namespaces fails the suite.
- Repo-wide source scans for the forbidden auth patterns above.
- This document exists, lists every route category, and states the
  middleware-is-not-the-boundary rule explicitly.

`tests/supabase-rls-service-role-boundary.test.mjs` (Perilla 7, unaffected)
continues to enforce the service-role registry invariant independently.
`tests/runtime-consumer-sovereignty-boundary.test.mjs` (pre-existing)
continues to enforce that `src/app/**` never imports legacy security modules
directly — this perilla's own route.ts edits were re-checked against it.

## Known residual risks

- **The AOC governance/agent surface (~450 routes) is classified as a whole**,
  not file-by-file in `ROUTE_GUARD_REGISTRY` — it's covered instead by the
  `@/lib/security/server-authorization` boundary and
  `docs/security/local-authority-bypass-audit.md`. A route-by-route registry
  over all ~520 API files was judged disproportionate; the registry instead
  covers every route this perilla found to be a genuine gap plus the
  explicitly named categories (billing, webhook, founder/internal, invite,
  delegation) and a representative project/workspace-scoped sample.
- **`GET /api/v1/delegations` and `GET /api/governance/delegations` rely on
  RLS rather than an explicit app-layer `workspaceId` membership check** —
  acceptable today (RLS policies are correctly scoped, confirmed by Perilla
  7's audit), but an app-layer check would be defense-in-depth against a
  future RLS regression.
- **`saveTeamInvites`'s `role` field is not run through `normalizeWorkspaceRole`**
  — inert today (no accept-flow reads it back into a real grant), but must be
  fixed before any such flow is built.
- **`/api/governance/trust/handshakes/request` (POST) is intentionally
  unauthenticated** (external verifier self-registration, analogous to
  requesting an API key) with no rate limiting — low risk since it only
  creates a `status: "requested"` row with zero standing authority until an
  internal founder approves it, but a future hardening pass could add rate
  limiting.
- **`/api/dashboard/approvals/decision` is an unguarded `501` stub** — safe
  today (no data read or written), but must get a real guard before it's
  wired up to actual approval-decision logic.
- **Some route classifications in this doc rely on source-scan, not a live
  integration test** — the registry/test suite verifies the guard *function
  call* is present in the right order, not that it behaves correctly against
  a live database (that correctness is covered separately by each guard
  helper's own unit tests, e.g. `tests/billing-authorization-workspace-membership.test.mjs`).
