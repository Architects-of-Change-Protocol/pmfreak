# Admin / founder / early-access / trial-license endpoint boundary

Trust boundary for founder/internal-only surfaces: who may reach them, what
proves that, and what never counts as proof. Companion to
[`auth-role-boundary.md`](./auth-role-boundary.md), which covers the role
system in general.

**Client-provided founder/admin claims are never trusted.** Founder/internal
endpoint access is never granted from `user_metadata.role`, display role, or
any client-supplied `role`/`actorRole`/`isFounder`/`isAdmin`/`isOwner`/
`permissions`/`claims` field.

## The vulnerability this closes

Perillas 1–4 hardened signup, billing, invite acceptance, and workspace
role updates. Auditing the remaining founder/admin/early-access/trial
surface for Perilla 5 found:

1. **`src/app/(protected)/early-access/page.tsx` had no founder gate at
   all.** It called `requireAuthUser()` and then went straight to
   instantiating a service-role Supabase client and rendering every early
   access invite (including target emails), every trial license's status
   across all workspaces, every workspace activation, and first-user
   telemetry counts. Any signed-in user — not just founders — could load
   `/early-access` and see this. This was the founder-dashboard-summary
   exposure the perilla brief specifically calls out; the four API routes
   (`founder-actions`, `invites`, `summary`, `accept`) already had the
   correct `isFounderOrInternalUser` gate, but this page did not.
2. **Two raw-SQL-shaped `execute_sql` RPC calls** (in
   `src/app/api/early-access/summary/route.ts` and
   `src/lib/auth/resolve-onboarding-state.ts`) built an inline SQL string
   and sent it through `supabase.rpc("execute_sql", { query: ... })`. That
   RPC does not exist in any migration — the calls were silent no-ops,
   meaning trial expiry sweeps never actually ran through either path. This
   is also a pattern worth removing on its own: a generic "run this SQL
   string" RPC is exactly the shape that turns into a real SQL-injection
   primitive if a future edit ever lets user input reach the string.
3. **`extendTrialLicense`'s duration check (`extensionDays <= 0 ||
   extensionDays > 60`) silently passed `NaN` through** — `NaN <= 0` and
   `NaN > 60` are both `false`, so a non-numeric `extensionDays` reached
   `new Date(NaN).toISOString()`, throwing an uncontrolled `RangeError`
   instead of a clean validation error.
4. Founder-action target ids (`inviteId`/`trialId`) and the invite-creation
   email were used directly in service-role queries with no explicit
   presence/shape validation — an empty id would reach a service-role
   `.eq("id", "")` filter before failing.
5. `founder-actions`/`invites` JSON body parsing was not wrapped in
   `try/catch` — a malformed body would throw an unhandled exception instead
   of a clean 400.

None of these were a role-spoofing bypass of `isFounderOrInternalUser` itself
(that guard was already correctly reading only the internal email domain
list and `FOUNDER_EMAIL_ALLOWLIST`, never `user.role`/metadata/body fields).
The primary finding is #1: a founder-only read surface that simply had no
founder check.

## Founder/internal access: trusted vs. untrusted sources

| Source | Trusted for founder/internal access? |
| --- | --- |
| `INTERNAL_EMAIL_DOMAINS` (`@pmfreak.ai`, `@onchainfest.xyz`), matched server-side | ✅ Yes |
| `FOUNDER_EMAIL_ALLOWLIST` environment variable, parsed server-side | ✅ Yes |
| `user_metadata.role` / `AuthUserContext.role` (display role) | ❌ Never |
| `body.role` / `body.actorRole` / `body.isFounder` / `body.isAdmin` / `body.isOwner` / `body.permissions` / `body.claims` | ❌ Never |
| `body.founderEmail` / `body.adminEmail` / `body.emailOverride` | ❌ Never — the actor's email always comes from `requireAuthUser()`'s Supabase session, not the request body |
| Query params, cookies | ❌ Never |
| `workspace_memberships.role` | ❌ Not consulted for founder/internal access at all — workspace admin/owner is a separate concept (see `auth-role-boundary.md`); a workspace owner is not automatically a founder |

## The central guard: `evaluateFounderOrInternalAccess` / `isFounderOrInternalUser`

`src/lib/auth.ts` exports `evaluateFounderOrInternalAccess({ email })`, the
single decision function every founder/internal-gated surface must go
through. Its signature is deliberately `{ email }` only:

```ts
export type FounderAccessDecision =
  | "allow"
  | "deny_missing_email"
  | "deny_invalid_email"
  | "deny_not_founder_or_internal";

export const evaluateFounderOrInternalAccess = (input: { email?: string | null }): FounderAccessResult => { ... };
```

There is no `role`, `actorRole`, `isFounder`, `isAdmin`, or `permissions`
parameter for a caller to smuggle elevated identity through — even if a
caller attaches extra fields to the input object, the function only ever
reads `.email`. `isFounderOrInternalUser(user: AuthUserContext)` is a thin
wrapper (`evaluateFounderOrInternalAccess({ email: user.email }).allowed`)
kept for the existing call sites; it never reads `user.role`.

Fail-closed behavior:

- Missing / `null` / empty / whitespace-only email → `deny_missing_email`.
- An email that doesn't match `local@domain.tld` shape → `deny_invalid_email`.
- A well-formed email that isn't on an internal domain or the allowlist →
  `deny_not_founder_or_internal`.

### `FOUNDER_EMAIL_ALLOWLIST` parsing

`process.env.FOUNDER_EMAIL_ALLOWLIST` is split on `,`, each entry trimmed and
lowercased, empty entries dropped, and the result loaded into a `Set`.
Membership is checked with `Set.has(normalizedEmail)` — **exact string
equality only**. `victor@example.com` matches the allowlist entry
`victor@example.com`; `victor@example.com.evil.com` does not, because it is
a different string, not a substring or prefix match.

### Internal domain matching

`INTERNAL_EMAIL_DOMAINS = ["@pmfreak.ai", "@onchainfest.xyz"]`, checked with
`normalizedEmail.endsWith(domain)` — note the domain literal includes the
leading `"@"`. This is what makes the match spoof-resistant in both
directions:

- `attacker@pmfreak.ai.evil.com` does **not** end with the literal string
  `"@pmfreak.ai"` (it ends with `.evil.com`) → denied.
- `attacker@evilpmfreak.ai` does **not** end with `"@pmfreak.ai"` either —
  the character immediately before `pmfreak.ai` is `l`, not `@` → denied.
- `user@pmfreak.ai` ends with `"@pmfreak.ai"` exactly → allowed.

## Why `user_metadata.role` / display role / body claims don't count

- `AuthUserContext.role` is populated from `user_metadata.role`
  (`src/lib/auth.ts`, `toDisplayRole`), which is client-writable at signup
  and clamped so it can never read back as `"owner"`/`"admin"` — it is
  informational/UI-only by design (see `auth-role-boundary.md`). Founder
  gating never reads it.
- A request body is fully attacker-controlled. Nothing in
  `evaluateFounderOrInternalAccess`, `isFounderOrInternalUser`, or any route
  reads `body.role` / `body.actorRole` / `body.isFounder` / `body.isAdmin` /
  `body.isOwner` / `body.permissions` / `body.claims` — the founder-actions
  and invites routes source-scan-test this directly (see Tests below).

## Endpoints covered and their gate

| Endpoint | Method | Gate | Notes |
| --- | --- | --- | --- |
| `src/app/api/early-access/founder-actions/route.ts` | POST | `requireAuthUser()` → `isFounderOrInternalUser()`, both before the body is parsed | Actions: `approve_invite`, `revoke_invite`, `resend_invite_email`, `revoke_trial`, `extend_trial`. Unknown action → 400, no mutation function is ever called on that path. |
| `src/app/api/early-access/invites/route.ts` | POST | `requireAuthUser()` → `isFounderOrInternalUser()`, before the body is parsed | Creates an invite; only `inviteEmail`/`inviteNote`/`requiresApproval` are read from the body. |
| `src/app/api/early-access/summary/route.ts` | GET | `requireAuthUser()` → `isFounderOrInternalUser()`, before the service-role client is instantiated | Cross-workspace aggregate read (pending invites, trial status, activations, event counts). |
| `src/app/(protected)/early-access/page.tsx` | Server Component (GET) | `requireAuthUser()` → `isFounderOrInternalUser()`, before the service-role client is instantiated | **The fix in this perilla.** Non-founder users get `notFound()` (404) — not a redirect, so the page's existence/data isn't distinguishable to them, and not partial data. |
| `src/app/api/early-access/accept/route.ts` | POST | `requireAuthUser()` only — deliberately **not** founder-gated | See "Early-access accept is not a founder action" below. |
| `src/lib/auth/resolve-onboarding-state.ts` | n/a (server helper) | `isFounderOrInternalUser(user)` skips the trial-expiry/trial-block branch entirely for founders/internal | Not an HTTP endpoint, but gates the same trial-license concept. |

## Order of operations

Every founder-gated route/page follows:

```
1. authenticate (requireAuthUser)
2. resolve founder/internal authorization (isFounderOrInternalUser) — before body parsing, before service-role client creation
3. parse input (with try/catch — malformed JSON → 400, not an unhandled exception)
4. validate target entity (requireNonEmptyId — before the service-role client is created)
5. validate action-specific input (isValidTrialExtensionDays, isValidInviteEmail)
6. apply mutation (service-role client, only now instantiated)
7. return a safe response (message stripped of the internal error code prefix; no raw SQL/service-role errors, stack traces, or secrets)
```

## Founder actions (`founder-actions/route.ts`)

Each action's target id (`inviteId`/`trialId`) is validated by
`requireNonEmptyId()` inside the corresponding `src/lib/early-access.ts`
function, **before** that function creates its service-role client — an
empty/missing id fails closed with `missing_target::...` rather than
reaching a `.eq("id", "")` query. `extend_trial`'s `extensionDays` is
validated by `isValidTrialExtensionDays()`: must be a whole number,
`1..MAX_TRIAL_EXTENSION_DAYS` (60) — `NaN`, `Infinity`, non-integers, and
out-of-range values are all rejected (previously `NaN` slipped through the
`<= 0 || > 60` check and threw an uncontrolled `RangeError`). `revoke_invite`,
`revoke_trial`, and `extend_trial` accept an optional `reason` string
(`sanitizeAuditReason`: trimmed, capped at 500 chars, never required and
never authoritative) that's recorded in the corresponding
`early_access_events.event_payload` alongside the server-resolved
`actorUserId` — the audit trail this perilla's brief asks for, without a
schema change (the existing `event_payload` `jsonb` column already carries
it).

## Early-access invites (`invites/route.ts`)

`createEarlyAccessInvite` validates the target email with
`isValidInviteEmail()` before creating its service-role client. The call
site only ever passes `inviteEmail`, `inviterUserId: user.id` (server-side,
never from the body), `inviteNote`, and `requiresApproval` — there is no
parameter for `role`/`isFounder`/`permissions`, so even a body containing
those fields cannot grant anything through this path.

## Early-access summary (`summary/route.ts`)

Founder-gated the same way as the other routes. The trial-expiry sweep
previously ran `supabase.rpc("execute_sql", { query: "update trial_licenses
set trial_status='expired' where trial_status='active' and trial_end_at <
now();" })` — replaced with a scoped, parameterized
`.from("trial_licenses").update({ trial_status: "expired"
}).eq("trial_status", "active").lt("trial_end_at", ...)` call. Same fix
applied to the equivalent call in `resolve-onboarding-state.ts` (which
additionally had the trial id string-interpolated into the SQL — not
attacker-reachable there since the id comes from a prior DB read scoped to
the caller's own memberships, but still a raw-SQL-shaped pattern worth
removing).

## Trial/license mutations (`extendTrialLicense`, `revokeTrialLicense`, `revokeEarlyAccessInvite`, `approveEarlyAccessInvite`, `resendEarlyAccessInviteEmail`)

All five live in `src/lib/early-access.ts` and share the same shape:
`requireNonEmptyId()` on the target id → (duration/email validation where
applicable) → `createSupabaseServiceRoleClient(..., actorUserId)` → the
actual query. `actorUserId` is always the caller parameter resolved from
`requireAuthUser()`'s session in the calling route — never read from the
body — and is now threaded into the privileged-access context (previously
only `systemActor: "system"` was set) so `logSecurityEvent` attributes the
privileged-client use to the real actor.

## Service role usage

Every service-role client (`createSupabaseServiceRoleClient` /
`createPrivilegedSupabaseClient`) in this surface is created **after**
`requireAuthUser()` and `isFounderOrInternalUser()` have both already
passed (or, for `acceptEarlyAccessInvite`, after the invite/email checks
that route relies on — see below). None of the founder-gated functions
instantiate a service-role client speculatively before validating their
inputs. `src/lib/security/privileged-access-registry.ts` documents each
service-role caller in this surface and its mitigations; it was updated as
part of this perilla for `early-access/page.tsx`, `early-access/summary/route.ts`,
`lib/early-access.ts`, and a new entry for
`lib/auth/resolve-onboarding-state.ts` (which was using the service role
without a registry entry at all).

## Early-access accept is not a founder action

`src/app/api/early-access/accept/route.ts` is intentionally **not**
founder-gated — it's the path a newly invited (non-founder) user goes
through to activate their own trial. Its authorization model is different
and narrower: `requireAuthUser()` only, plus `acceptEarlyAccessInvite()`
requiring the invite's `invite_email` to match the authenticated user's own
email (a Perilla 3 fix, preserved here) before any workspace/membership
mutation runs. The route reads only `inviteToken` and `workspaceName` from
the body — `isFounder`/`role`/`isAdmin` fields are never read here or in
`acceptEarlyAccessInvite`'s input type, so a body like
`{ "token": "...", "isFounder": true, "role": "founder" }` cannot grant
founder/internal access through this endpoint. Do not add a founder check
to this route — that would conflate two different permissions (self-service
invite acceptance vs. founder administration of other people's invites).

## Regression this fix prevents

- A normal authenticated user loading `/early-access` can no longer see any
  invite emails, trial license status, workspace activation data, or
  telemetry counts — they get a 404.
- `user_metadata.role`, display role, and every client-suppliable
  `role`/`actorRole`/`isFounder`/`isAdmin`/`isOwner`/`permissions`/`claims`
  field remain unable to grant founder/internal access anywhere in this
  surface (this was already correct pre-Perilla-5 for the four API routes;
  it's now also true — trivially, since there's no such field to read — for
  the dashboard page).
- A malformed `extensionDays` (`NaN`, a string, `Infinity`) on
  `extend_trial` fails closed with a clean 400 instead of throwing an
  uncontrolled `RangeError`.
- An empty/missing target id on any founder action fails closed before any
  service-role query is built.
- Malformed JSON on `founder-actions`, `invites`, or `accept` returns a
  clean 400 instead of an unhandled exception.
- The trial-expiry sweeps in `summary/route.ts` and
  `resolve-onboarding-state.ts` actually run now (they were previously
  silent no-ops against a non-existent `execute_sql` RPC).
- Legitimate founders/internal users (internal domain or
  `FOUNDER_EMAIL_ALLOWLIST`) are unaffected — their access is unchanged.

## Tests

`tests/admin-founder-endpoint-boundary.test.mjs` covers:

- `evaluateFounderOrInternalAccess`/`isFounderOrInternalUser` behaviorally:
  missing/invalid email, internal-domain exact match, both directions of
  domain spoofing, allowlist exact match and parsing (whitespace, empty
  entries, casing), and that extra fields on the input
  (`actorRole`/`isFounder`/`isAdmin`/`role`/`permissions`) never influence
  the decision.
- The extracted pure validators (`requireNonEmptyId`,
  `isValidTrialExtensionDays`, `sanitizeAuditReason`, `isValidInviteEmail`)
  directly, including the `NaN`/`Infinity`/non-integer/out-of-range trial
  duration cases.
- Source-level ordering checks for each route/page: auth → founder gate →
  body parsing → mutation, that no route reads a client-supplied
  role/actorRole/isFounder/isAdmin/isOwner/permissions/claims field, that an
  unknown founder action never reaches a mutation call, and that the
  dashboard page's founder gate runs before its service-role client is
  created.
- That neither `summary/route.ts` nor `resolve-onboarding-state.ts` still
  references the removed `execute_sql` RPC.
- That the accept route stays free of `isFounderOrInternalUser`/body-role
  reads, and that the Perilla 3 email-mismatch guard is still in place
  before any mutation.

`src/lib/early-access.ts`'s mutation functions call
`createSupabaseServiceRoleClient` directly with no dependency-injection
seam (same constraint documented in
`tests/early-access-invite-email-boundary.test.mjs` for
`acceptEarlyAccessInvite`), so full behavioral (not source-level) coverage
of the DB-touching parts of `approveEarlyAccessInvite`/
`revokeEarlyAccessInvite`/`revokeTrialLicense`/`extendTrialLicense`/
`resendEarlyAccessInviteEmail`/`createEarlyAccessInvite` would need a live
Supabase instance or a broader refactor — out of scope for this perilla.
The extracted validators they call into (id/duration/reason/email) are
fully unit-tested; the wiring order (validate-before-service-role-client) is
source-scan-tested per function.
