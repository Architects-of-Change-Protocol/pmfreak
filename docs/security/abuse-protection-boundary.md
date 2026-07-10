# Abuse Protection Boundary — Perilla 9

## 1. What this perilla closes

Perillas 1-8 built a strong **authorization** boundary for PMFreak: signup
role metadata, workspace membership, invite acceptance, workspace role
updates, billing authorization, the Stripe webhook lifecycle, the Supabase
RLS/service-role boundary, and route/server-guard consistency. Every one of
those answers the question:

> Can this caller access or mutate this thing at all?

This perilla answers a different question:

> Can this caller do it too often, too fast, or too many times — even
> though they are correctly authorized?

**A correctly authorized endpoint can still be unsafe if it can be abused
without limits.** A real workspace owner can create 10,000 Stripe checkout
sessions. A real founder can spam invite resends. A real authenticated user
can hammer an AI-adjacent route thousands of times. An anonymous caller can
flood a public, unauthenticated endpoint that creates state (like requesting
a trust handshake) or brute-force a token by trying thousands of guesses
against an endpoint that correctly rejects each one individually.
Authorization controls *who* may act; abuse protection controls *how often,
how safely, and under what replay/cost/idempotency limits* they may act.
**Public does not mean unlimited.**

## 2. The abuse protection helper

`src/lib/security/abuse-protection.ts` is the single choke point every
protected route calls through:

```ts
enforceAbuseLimit({ scope, identifier, limit, windowSeconds, action?, metadata? })
  => { allowed: true, key, remaining?, resetAt? }
   | { allowed: false, key, reason: "rate_limited" | "cooldown" | "invalid_key", retryAfterSeconds?, resetAt? }
```

It implements a fixed-window counter: `scope` (+ optional `action`) is the
policy bucket, `identifier` (a user id, workspace id, email, IP, or raw
token) is hashed before use, and `limit`/`windowSeconds` define the window.
An invalid configuration, or a failure to reach the backing store, both
**deny the request** — this module never fails open.

`abuseDenyResponse(decision)` turns a denial into a `429` `Response` with a
`Retry-After` header and a body of `{ error, code }` — `code` is always one
of `rate_limited | cooldown | invalid_key`, never anything more specific.

### Storage

Two interchangeable stores implement the same `AbuseStore` interface:

- **In-memory** (`createInMemoryAbuseStore`) — a per-process `Map`. This is
  the fallback whenever Supabase service-role env vars are not configured:
  local dev, and every test in this repo (no live Supabase connection is
  available or desired for unit tests).
- **Supabase-backed** (`abuse_rate_limits` table +
  `abuse_rate_limit_increment` RPC, see
  `supabase/migrations/20260819000000_abuse_rate_limits.sql`) — selected
  automatically whenever `hasSupabaseServiceRoleEnv` is true, which is the
  case in every real deployment (the app already requires these env vars for
  everything else). The RPC does an atomic `INSERT ... ON CONFLICT DO
  UPDATE` keyed on `(scope, identifier_hash, window_start)`, so concurrent
  requests across serverless instances share one counter with no lost-update
  race. The table has **no policy for `authenticated`/`anon`** — RLS with
  zero policies denies all client access; only `service_role` (which
  bypasses RLS) can read/write it, and the RPC itself is only granted to
  `service_role`.

### Key construction

`buildAbuseKey([scope, action, identifierHash])` joins non-empty parts with
`:`. The identifier is always hashed first via `hashAbuseIdentifier`, which:

1. Normalizes the raw value (trim + lowercase) via `normalizeAbuseIdentifier`
   — `USER@Example.COM` and `user@example.com` collapse to the same bucket;
   an empty/missing identifier maps to a fixed `"anonymous"` bucket rather
   than throwing (fail closed, not fail open).
2. Hashes it with SHA-256, salted with a static domain-separation prefix plus
   an optional `ABUSE_HASH_PEPPER` env var (unset in dev/test; expected to be
   set in production for stronger resistance to a rainbow-table attack over
   common emails/IPs).

The raw value **never** appears in the returned key, in logs, or in any
persisted row. `getClientIp` / `getClientIpFromHeaders` extract the caller's
IP from `x-forwarded-for` (first hop) / `x-real-ip`, for use as an
identifier in public routes.

### Metadata redaction

Any `metadata` passed to `enforceAbuseLimit` is filtered through
`redactAbuseMetadata` before it reaches the store or a log line — any key
containing `token`, `email`, `secret`, `password`, `authorization`, or
`cookie` is dropped. Abuse tracking only ever needs hashed identifiers plus
non-identifying context (route scope, action, counts).

### Denial telemetry

Every deny path also calls `logSecurityEvent("abuse_rate_limited", ...)` (a
new `SecurityEventType`, additive to `src/lib/security/telemetry.ts`), so
rate-limit denials show up in the same `security_events` audit trail as
authorization denials, tagged distinctly by event type.

## 3. The abuse protection registry

`src/lib/security/abuse-protection-registry.ts` is the declarative
inventory: one entry per protected route/action, with `classification`,
`requiredProtection`, `windowSeconds`, `maxAttempts`, and an `enforced`
flag. `enforced: true` entries call `enforceAbuseLimit` directly in the
listed file. `enforced: false` entries are documented residuals — read-only
discovery routes, or routes already protected by a narrower control (a
signed handshake token) — each with a `residualNote` explaining the
reasoning, not a silent gap.

`tests/abuse-protection-boundary.test.mjs` enforces that the registry stays
in sync with the actual route source: every entry it expects to be enforced
is checked by grepping the named file for the `enforceAbuseLimit(` call and
the exact `scope` string.

## 4. Public / semi-public endpoint classification

| Endpoint | Classification | Protection |
| --- | --- | --- |
| `POST /signup` (`signupAction`) | public-state-creating | per-IP+email rate limit (8/hour) |
| `POST /login` (`loginAction`) | public-auth-attempt | per-IP+email rate limit (10/15min), defense-in-depth over Supabase Auth's own throttling |
| `GET /accept-invite/[token]` (workspace invite accept) | public-state-creating | per-IP (20/hour) + per-token (10/hour) attempt limit; token hashed before use |
| `POST /api/early-access/accept` | public-state-creating (auth required, token-driven) | per-IP (20/hour) + per-token (10/hour) attempt limit |
| `POST /api/governance/trust/handshakes/request` | public-state-creating | per-IP+issuer rate limit (20/hour) |
| `.../trust/.well-known/capability-issuer`, `.../trust/keys` | public-read-low-risk | documented residual — no secret material, cheap to serve, external verifiers must reach it without a session |
| `.../trust/events/import` | public-machine-to-machine | documented residual — already gated by a signed, individually-rate-limited handshake token + cryptographic event signature |
| `.../governance/capabilities/verify` | public-read-low-risk | documented residual — bounded local signature verification, no external calls |
| `POST /api/federation/webhooks/[connectorId]` | webhook-invalid-attempt | per-IP+connector rate limit (20/hour), applied only to requests that fail `FEDERATION_WEBHOOK_SECRET` verification |

## 5. Authenticated cost / cooldown protection

| Endpoint | Protection |
| --- | --- |
| `POST /api/billing/create-checkout-session` | per-user+workspace cooldown, 5 attempts/60s |
| `POST /api/billing/create-portal-session` | per-user+workspace cooldown, 5 attempts/60s |
| `sendInviteAction` (workspace invite create, `team/actions.ts`) | per-actor rate limit (20/hour) + per-workspace+email cooldown (1/5min) |
| `POST /api/early-access/invites` (invite create) | per-actor rate limit (30/hour) |
| `POST /api/early-access/founder-actions` (approve/revoke/resend/extend) | per-actor+action rate limit (30/hour) |
| `POST /api/upload` | per-user+project rate limit (20/hour), defense-in-depth on top of the existing plan-based `reserveUploadQuota` |
| `GET/DELETE /api/project-evidence`, `GET /api/project-evidence-content` | per-user+project rate limit (60-300/hour depending on read vs. mutate) |
| `GET /api/ai/suggestions`, `/api/ai/project-state` | per-IP+project rate limit (120/hour) |
| `GET /api/ai/escalation-guide`, `/meetings`, `/political-risk`, `/project-memory`, `/stakeholder-intel` | per-user rate limit (60/hour) |
| `POST /api/ai/pmfreak-brain` | per-user rate limit (30/hour) — lower, since it fans out to 3 downstream AI calls per request |

## 6. Invite / token brute-force and replay protection

Every token-acceptance flow already had (from Perillas 3/5) generic,
reason-coded error responses (`invalid_token`, `expired`, `revoked`,
`already_used`, `email_mismatch`) and a single conditional
`UPDATE ... WHERE status = 'pending'` that makes concurrent replay of the
same token win the race at most once. This perilla adds the missing layer
on top: an **attempt limit**, so a caller cannot brute-force a token by
volume even though each individual guess already fails safely.

- **Workspace invite accept** (`accept-invite/[token]/page.tsx`): per-IP
  limit (20/hour) plus a per-`(IP, token)` limit (10/hour) — the raw token
  is hashed before being used as the rate-limit identifier, never persisted.
- **Early-access accept** (`api/early-access/accept/route.ts`): same shape —
  per-IP (20/hour) + per-`(IP, token)` (10/hour).

Workspace invite tokens remain plaintext in `workspace_invitations.token`
(early-access invite tokens are already hashed — `invite_token_hash`, a
pre-existing design from before this perilla). Changing the workspace invite
token storage model is out of scope for this perilla (see Residuals below);
the attempt-limit layer above is the mitigation added here.

## 7. Billing session spam protection

`create-checkout-session` and `create-portal-session` both call
`enforceAbuseLimit` with `identifier = buildAbuseKey([user.id, workspaceId])`
— note this is **not** IP-based; it's scoped to the specific
authenticated-user + workspace pair, because the actor is always known by
this point (this runs after `requireBillingManageMembership`). Both routes
verify the abuse check runs before any Stripe API call in source order (see
`tests/abuse-protection-boundary.test.mjs` #24), so a denied request never
reaches Stripe at all — no session, no customer creation, no cost.

## 8. Trust / federation request protection

`governance/trust/handshakes/request` — the one genuinely public,
unauthenticated, state-creating route in the trust/federation surface — is
rate-limited per `(IP, verifierName)` before `requestTrustHandshake` is
called. Read-only discovery routes (`.well-known`, `keys`) and the
machine-to-machine `events/import` route (already gated by a signed
handshake token) are documented residuals, not silent gaps — see the
registry `residualNote` on each. The federation connector webhook rate-limits
only the *invalid*-secret-attempt path, so a legitimate, already-authorized
connector is never throttled by this control.

## 9. Upload / evidence / AI cost protection

Upload already had file-count/size limits, MIME/extension/magic-byte
validation, and a plan-based monthly quota (`reserveUploadQuota`) before this
perilla — those are authorization/validation/cost-cap controls, not
frequency controls. This perilla adds a request-frequency limit per
user+project on top, so a burst of requests within quota can't still exhaust
extraction/storage throughput in a short window. Evidence read/delete routes
and the AI-adjacent routes (`suggestions`, `project-state`,
`escalation-guide`, `meetings`, `political-risk`, `project-memory`,
`stakeholder-intel`, `pmfreak-brain`) each keep their existing
auth/project-access guard unchanged and add a rate limit on top — see the
per-route table above. None of these AI routes currently call an external,
metered AI provider (`runAIModule`/`analyzeProjectState` are internal), so
today's risk is compute/DB load rather than a per-call vendor bill; the
limits are sized to blunt both a present-day logical-DoS risk and a future
cost risk if/when a real provider is wired in.

## 10. Safe error behavior

- Login/signup abuse denials redirect with a generic
  `"Too many ... attempts"` message — no indication of whether the
  email/account exists.
- `abuseDenyResponse` always returns the same three-value `code` regardless
  of *why* — a caller cannot distinguish "you hit the IP limit" from "you hit
  the token limit" from the response body.
- Invite/token accept error messages (`ERROR_MESSAGES` maps) were already
  generic pre-perilla (Perilla 3) and are unchanged here; this perilla adds
  the attempt-limit layer, not new error text.

## 11. Testing strategy

`tests/abuse-protection-boundary.test.mjs` covers:

- Registry existence and coverage (public state-creating, billing,
  invite-spam, AI/upload/evidence routes; every entry has
  `windowSeconds`/`maxAttempts`; no duplicate ids; residual entries carry a
  `residualNote`).
- Helper behavior: hashing never contains the raw input, email
  normalization collapses case, empty identifiers don't crash, a fake
  in-memory store proves the fixed-window deny-then-reset behavior with an
  injectable clock.
- Behavioral tests for `create-checkout-session`/`create-portal-session`
  (dependency-injected `enforceAbuseLimit`, matching the existing
  `billing-checkout-session-route.test.mjs` DI pattern) — a deny returns
  `429` and Stripe is never called; an allow still creates a session (no
  regression).
- Source-scans confirming every other listed route calls `enforceAbuseLimit`
  with the expected `scope`, in the correct order relative to the
  expensive/sensitive operation it guards, and that the underlying
  auth/project guard from Perilla 8 is still present.
- A cross-check that every state-creating entry in Perilla 8's
  `PUBLIC_ROUTE_ALLOWLIST` has a corresponding `enforced: true` entry here.

`tests/billing-checkout-session-route.test.mjs` (Perilla 2) was updated to
inject an always-allow `enforceAbuseLimit` fake, so that authorization suite
stays decoupled from rate-limit counting — abuse-limit behavior for those
same routes is covered separately in this perilla's test file.

## 12. Known residual risks

- **In-memory store is per-process.** In local dev (no Supabase service-role
  env) or in a deployment that somehow lacks those env vars, the in-memory
  fallback does not share counters across serverless instances or
  restarts — it is a best-effort local dev/test fallback, not a
  production-grade distributed limiter. Production is expected to always
  have Supabase service-role env configured (the app already requires it for
  everything else), which selects the persistent Supabase-backed store
  automatically.
- **No CAPTCHA, no WAF, no device fingerprinting, no fraud-scoring engine.**
  Explicitly out of scope for this perilla — see the brief's "do not
  implement" list. The rate limits here are a first, mechanical line of
  defense, not a full anti-abuse system.
- **Workspace invite tokens remain plaintext** in `workspace_invitations`.
  Attempt-limiting mitigates brute-force volume but does not change the
  storage model; hashing them is a larger, separate change left out of this
  perilla's scope.
- **Fixed-window counting**, not sliding-window or token-bucket — a caller
  can burst up to `2x limit` requests around a window boundary. Acceptable
  for a first abuse-protection layer; not exploited for anything beyond
  doubling the effective burst rate.
- **AI cost limits are sized against today's internal (non-metered) AI
  modules.** If/when a real external, metered AI provider is wired into
  these routes, the limits documented here should be revisited against that
  provider's actual per-call cost.
- **A persistent Supabase outage fails closed** — `enforceAbuseLimit` denies
  the request rather than allowing it through when the backing store errors.
  This is a deliberate security tradeoff (documented in the helper's
  docstring): it means a rate-limit-store outage can 429 real traffic on the
  protected routes, but it never silently disables abuse protection.
- **Trust handshake request rate limiting is IP+issuer-based**, not
  proof-of-work or cryptographically bound — a distributed attacker with
  many IPs and issuer names could still exceed the intended volume. Treated
  as acceptable for a first abuse-protection layer on a route that also
  requires a plausible `requestedTrustDomain` and grants no standing
  authority until a founder approves it.
