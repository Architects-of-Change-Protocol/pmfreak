# Release Gate 01 — Corrective Hotfix: Production Authentication Session Persistence

**Severity:** P1 (production defect: an authenticated user is incorrectly redirected to `/login` and their session is destroyed, without signing out).
**Scope:** `src/app/(protected)/layout.tsx`, `src/lib/auth.ts`, `src/lib/auth/runtime-auth-continuity.ts`. No product-code change outside this authentication path.
**Branch:** `fix/release-gate-01-auth-session-persistence`, based on `origin/main` at `58de7dae8ca8e98f7da4a5c76349c17ae837110a`.
**Discovered during:** Release Gate 01 agent-guided human browser UAT, live against `https://pmfreak.com/` (production), commit `58de7dae8ca8e98f7da4a5c76349c17ae837110a` confirmed via `/api/build-info`.

---

## 1. Executive Summary

`src/app/(protected)/layout.tsx` — the layout wrapping every authenticated route in PMFreak — made **two independent, uncoordinated server-side `supabase.auth.getUser()` calls per request**: one inside `assertRuntimeAuthContinuity()`, immediately followed by a second inside `requireAuthUser()` → `getAuthUser()`. Each call created its own separate Supabase server client.

`src/lib/supabase/server.ts`'s cookie adapter silently swallows any cookie-write failure (`try { cookieStore.set(...) } catch {}`), which is *necessary* — Next.js Server Components are not allowed to write cookies, and this must not throw — but has a real cost: if the access token was expired, the first `getUser()` call's on-demand token refresh succeeds in-memory but can never be persisted back to cookies from this render. Supabase rotates (invalidates) the refresh token server-side as soon as it is used, regardless of whether the caller manages to persist the replacement. The second, independent `getUser()` call then presents that same, now-already-consumed refresh token and is rejected outright (`401`, "Invalid Refresh Token: Already Used"). `requireAuthUser()` treats that as "not authenticated" and redirects to `/login`.

Once that now-dead refresh token cookie is subsequently presented to Edge middleware (`src/lib/supabase/proxy.ts`), the Supabase client's own `SIGNED_OUT` handling proactively clears every stored auth cookie via middleware's own cookie adapter (which does **not** swallow writes) — this is the exact mechanism behind the "the cookie table was completely empty" symptom observed live in production DevTools.

**Fix:** `assertRuntimeAuthContinuity()` now returns the resolved Supabase user; `(protected)/layout.tsx` builds the full `AuthUserContext` directly from it via a new pure helper, `buildAuthUserContext()`, instead of making a second, independent `getUser()` call. Exactly one `getUser()` call — and therefore at most one refresh attempt — happens per protected-route request.

---

## 2. Production Evidence

Reproduced live, agent-guided (Mode B — the Claude Code sandbox's egress policy blocks direct outbound access to `pmfreak.com`; the repository owner drove the browser and reported results), during Release Gate 01's browser/runtime UAT.

| Item | Value |
|---|---|
| Runtime URL | `https://pmfreak.com/` (production) |
| Deployed commit (confirmed via `GET /api/build-info`) | `58de7dae8ca8e98f7da4a5c76349c17ae837110a` — matches `origin/main` exactly |
| `vercelEnv` | `production` |
| Account | pre-existing production account, role `viewer` (redacted email; domain `@onchainfest.xyz`, an internal-allowlisted domain per `src/lib/auth.ts`'s `INTERNAL_EMAIL_DOMAINS`, not a customer account) |
| Authenticated-shell evidence | `/projects/new` rendered normally, full `OperationalShell` nav, sidebar showed the account's email and `viewer` role badge |
| Triggering action | Clicked the "Create Center" nav item (`href="/create-command-center"`) |
| Result | Redirected to `pmfreak.com/login?next=%2Fcreate-command-center` |
| Direct-navigation control | Fresh top-level navigation (new tab, typed/loaded URL, not a client-side link) to `https://pmfreak.com/command-center` **also** redirected to `/login?next=%2Fcommand-center` |
| Cookie inspection | Chrome DevTools → Application → Storage → Cookies → `https://pmfreak.com` — **the cookie table was completely empty**; no cookie names starting with `sb-`, no cookies at all |
| User action | Did not sign out, did not clear cookies manually |

---

## 3. Reproduction Steps

1. Authenticate normally (session had been established prior to this session, not observed first-hand — see §14, Residual Debt, for the one gap this leaves).
2. Land on `/projects/new` with a normal, fully-rendered authenticated shell.
3. Click "Create Center" in the left nav (`href="/create-command-center"`).
4. Observe redirect to `/login?next=%2Fcreate-command-center`.
5. Open a fresh tab, navigate directly to `/command-center`.
6. Observe redirect to `/login?next=%2Fcommand-center` — confirms the session is dead, not merely a bad client-side navigation.
7. Inspect cookies for `pmfreak.com` — confirms zero cookies remain, not just an expired/invalid one.

## 4. Expected vs. Actual Behavior

| | Expected | Actual (pre-fix) |
|---|---|---|
| Internal navigation while authenticated | Stays authenticated, no redirect | Redirected to `/login` |
| Direct navigation to a protected route with a valid session | Session recognized | Redirected to `/login` |
| Cookie state after the above | Auth cookies present and valid | Cookie table completely empty |
| Root cause class | N/A | Session token silently corrupted by the app's own server-side code, not a genuine expiry |

---

## 5. Authentication Architecture Inventory

| File | Symbol | Runtime context | Calls `getUser()`/refresh? | Cookie writer | Can persist a refresh? |
|---|---|---|---|---|---|
| `src/lib/supabase/proxy.ts` | `updateSession` | Edge middleware | Yes | `request.cookies.set` + `response.cookies.set`, no try/catch | **Yes** — the only context that reliably can |
| `src/proxy.ts` | `proxy` (uses `updateSession`) | Edge middleware | Indirectly | forwards `response` from `updateSession`; `redirectPreservingSession` forwards its cookies to redirects | Yes |
| `src/lib/supabase/server.ts` | `createSupabaseServerClient` | Server Components, Route Handlers, Server Actions (shared factory) | On demand (via `getUser()`/`getSession()` callers) | `cookieStore.set` wrapped in `try {} catch {}` | **No, in a plain Server Component render** (Next.js throws; error is swallowed). Yes in Route Handlers/Server Actions. |
| `src/lib/auth/runtime-auth-continuity.ts` | `assertRuntimeAuthContinuity` (pre-fix) | Server Component (`(protected)/layout.tsx`) | Yes, unconditionally, its own client | via `createSupabaseServerClient` | No (Server Component context) |
| `src/lib/auth.ts` | `getAuthUser` / `requireAuthUser` (pre-fix, called a *second* time from layout) | Server Component (`(protected)/layout.tsx`) | Yes, unconditionally, its own **separate** client | via `createSupabaseServerClient` | No (Server Component context) |
| `src/app/(protected)/layout.tsx` | `ProtectedLayout` | Server Component | Called both of the above, back-to-back, pre-fix | — | — |
| `src/app/login/actions.ts`, `src/app/api/login/route.ts`, `src/app/signup/actions.ts` | login/signup | Server Action / Route Handler | `signInWithPassword`/`signUp` write session via the request's response — can persist | Yes | Yes |
| `src/app/logout/route.ts` | logout | Route Handler | `signOut()` | Yes | Yes (intentional) |

**Tests covering this before the fix:** none exercised real `getUser()` call counts or cookie-persistence behavior — `tests/auth-redirect-resolution.test.mjs`, `tests/proxy-routing.test.mjs`, and `tests/resolve-onboarding-state.test.mjs` are static source-text assertions (matches the general blind-spot pattern already identified in `docs/audits/pmfreak-remediation-decision-brief.md` §12).

---

## 6. Root-Cause Analysis

`(protected)/layout.tsx` (pre-fix):

```ts
const continuity = await assertRuntimeAuthContinuity();   // getUser() call #1 (own client)
if (!continuity.ok) { redirect(...) }

const user = await requireAuthUser();                     // getAuthUser() -> getUser() call #2 (own, SEPARATE client)
```

Both calls read the same cookie-backed session. If the access token was expired:

1. Call #1's client (`assertRuntimeAuthContinuity`'s own `createSupabaseServerClient()`) detects the expired token and refreshes on-demand (`@supabase/auth-js`'s `__loadSession()` refresh-if-expired path — this happens regardless of the `autoRefreshToken` setting, which only gates the *background/proactive* timer, not on-demand refresh triggered by actually calling `getUser()`/`getSession()`). The refresh **succeeds** — Supabase's Auth server issues a new access+refresh token pair and immediately invalidates (rotates) the old refresh token server-side.
2. The new tokens cannot be written back to cookies from this render (`createSupabaseServerClient`'s `setAll` throws inside a Server Component render; the error is caught and silently discarded — see `src/lib/supabase/server.ts:14-22`). The render itself succeeds using the in-memory refreshed user — this is why the authenticated shell could render correctly on the page shown just before the failure.
3. Call #2's client (`getAuthUser`'s own, separate `createSupabaseServerClient()`) reads cookies again — still the **old**, now-already-consumed refresh token, since call #1 never persisted its replacement. Supabase's Auth server rejects this second refresh attempt outright: `401`, "Invalid Refresh Token: Already Used." This is a genuine auth rejection, not a transient error.
4. `getAuthUser()` returns `null`; `requireAuthUser()` redirects to `/login`.
5. On the *next* request (e.g. the direct `/command-center` navigation), Edge middleware's `updateSession()` presents the same dead refresh token. Supabase's Auth server again rejects it; the Supabase JS client's internal `SIGNED_OUT` handling then proactively clears every stored auth cookie via the `@supabase/ssr` `createServerClient` adapter's `onAuthStateChange` listener (visible in `node_modules/@supabase/ssr/dist/module/createServerClient.js`) — and because middleware's cookie adapter does **not** swallow writes, this clearing succeeds and is forwarded to the browser via the login redirect. This is the exact, fully explained mechanism behind "the cookie table was completely empty."

This is fully deterministic, not a rare race: it reproduces on essentially every request where the access token happens to be expired at render time, which — given `(protected)/layout.tsx` runs on every protected navigation — is a routine, expected occurrence for any session left open across a normal token lifetime.

### Why the authenticated sidebar could render before the server rejected the session

Call #1 (`assertRuntimeAuthContinuity`) actually succeeded for that request — it obtained a valid, refreshed in-memory user and the page rendered correctly. The corruption is a *side effect* of that same successful call (the now-unpersisted, rotated refresh token), which only manifests as a visible failure on the *next* `getUser()` call — in the pre-fix code, that was call #2 in the very same request (`requireAuthUser()`), and after that, every subsequent request.

### Was the cookie never written, or written and later removed?

Both, at different points, now precisely distinguished:
- The **replacement** token from the first (successful) refresh was **never written** at all (swallowed in a Server Component context).
- The **original** (now-dead) token **was later actively removed** — correctly, since middleware genuinely could no longer treat it as valid, and the app's own `SIGNED_OUT` handling cleared it as designed for a truly dead session. That clearing was the *symptom* of the two-call race, not a separate bug in its own right.

---

## 7. Why Existing Tests Missed the Defect

No existing test invoked `assertRuntimeAuthContinuity()` or `getAuthUser()`/`requireAuthUser()` as real functions with a simulated token-refresh outcome. `tests/pmf-001-002-auth-session-visibility.test.mjs` covers a related but different concern (login/signup's *first* post-auth destination resolution not depending on a same-request cookie round trip) and does not touch `(protected)/layout.tsx`'s per-navigation auth-continuity check at all. `assertRuntimeAuthContinuity` and `getAuthUser` were previously not unit-testable in isolation — both hard-depended on `next/headers` and constructed their own Supabase client internally with no injection seam, which is exactly why this class of defect (a live route/session-integration bug, not a static text-pattern violation) was invisible to the pre-fix suite. This matches the general blind-spot pattern already documented in `docs/audits/pmfreak-remediation-decision-brief.md` §12: the suite is overwhelmingly static source-text assertion, not live route/session-integration testing.

## 8. Security Implications

- No cross-tenant or unauthorized-access exposure — the opposite: legitimate, correctly-authenticated users are denied access to their own data.
- No credentials, tokens, or session values were exposed at any point; the defect is a false-negative session check, not a false-positive one.
- No fix here weakens any authorization boundary — `assertRuntimeAuthContinuity`'s auth-rejection-vs-network-error distinction, and its `getSession()` fallback for transient errors, are preserved unchanged.

## 9. Pre-Fix Failing-Test Evidence

`tests/release-gate-01-auth-session-persistence.test.mjs` was written against the fixed API surface (`buildAuthUserContext` export, `assertRuntimeAuthContinuity(deps)`), then run against the pre-fix versions of the three affected files (`git stash` of the fix, tests kept):

```
$ npx tsx --test tests/release-gate-01-auth-session-persistence.test.mjs
TAP version 13
# file:///home/user/pmfreak/tests/release-gate-01-auth-session-persistence.test.mjs:52
# import { buildAuthUserContext } from "../src/lib/auth.ts";
#          ^^^^^^^^^^^^^^^^^^^^
# SyntaxError: The requested module '../src/lib/auth.ts' does not provide an export named 'buildAuthUserContext'
...
not ok 1 - tests/release-gate-01-auth-session-persistence.test.mjs
# tests 1
# pass 0
# fail 1
```

The pre-fix code has no seam to invoke `assertRuntimeAuthContinuity` with an injected fake auth client and no `buildAuthUserContext` export — so the new tests cannot even load against it. This is itself evidence of the missing testability the defect exploited: the two `getUser()` calls in `(protected)/layout.tsx` could not have been asserted against ("exactly one call, resolved user reused") without this refactor.

## 9b. Behavior-Level Regression Evidence Against Real Production Entry Points

§9's failing-test evidence proves the new API surface (`buildAuthUserContext`) was absent pre-fix — it does not, by itself, prove the *runtime* defect existed, since an import error is a build-shape difference, not a behavioral one. Two additional files close that gap by exercising the actual, pre-existing production entry points — `assertRuntimeAuthContinuity()` (its real zero-arg production signature, not the injected-deps test seam), `getAuthUser()`, `requireAuthUser()`, and the real `createSupabaseServerClient()` cookie adapter (`src/lib/supabase/server.ts`, unmodified by this PR) — with only the true I/O boundary mocked (`next/headers`, `@supabase/ssr`'s `createServerClient`):

- `tests/module-mocks/release-gate-01-production-entrypoint-pre-fix-pattern.test.mjs` — replays the exact pre-fix `(protected)/layout.tsx` call shape (`assertRuntimeAuthContinuity()` then `requireAuthUser()`, two independent `getUser()` calls) through these real functions.
- `tests/module-mocks/release-gate-01-production-entrypoint-fixed-pattern.test.mjs` — replays the fixed call shape (`assertRuntimeAuthContinuity()` then `buildAuthUserContext(continuity.user)`, one `getUser()` call).
- `tests/module-mocks/release-gate-01-fake-supabase.mjs` — the shared fake GoTrue/cookie-jar double both files use.

Both files depend on Node's `--experimental-test-module-mocks` (needed for `t.mock.module`), which is a process-wide loader-behavior flag, not a per-file one. Rather than adding it to the main `npm test` invocation (which would apply it to all ~500 pre-existing test files that don't use it), `tests/module-mocks/` is a dedicated directory run as its own `tsx --test` invocation with the flag; `package.json`'s `test` script chains `tsx --test tests/*.test.mjs tests/*.test.ts && tsx --experimental-test-module-mocks --test tests/module-mocks/*.test.mjs` so the flag's scope is limited to the two files that actually need it.

**Two CI-only compatibility issues surfaced and fixed while landing this test file (neither anticipated in advance; both invisible to local runs, including from-scratch `npm ci` on both Node 22 and Node 24):**

1. `mock.module()`'s exports-object option was renamed between Node majors — Node 22.x only recognizes `namedExports`; Node 24.x (this repo's CI runner silently upgrades a pinned `node-version: '20'` to the runner's current default — 24.x at time of writing) recognizes `exports` and only *deprecates* `namedExports` (works, with a warning) — except passing both keys together throws `ERR_INVALID_ARG_VALUE`. `tests/module-mocks/release-gate-01-fake-supabase.mjs`'s `mockModuleOptions(exportsObj)` picks the correct key from `process.versions.node`.
2. `t.mock.module()` given a bare specifier (`"next/headers"`, `"@supabase/ssr"`) failed in CI with `ERR_MODULE_NOT_FOUND` (`Cannot find module '.../tests/module-mocks/next/headers'`) on two different call shapes tried in turn — called from the shared helper, and called directly in the test file — neither reproduced locally, including on a genuinely re-verified Node 22.23.1 and 24.18.0 via `nvm` (an earlier "verified on both Node majors" claim in an intermediate commit turned out to rest on a silently-failed `nvm use 22` that kept running Node 24 both times — corrected once noticed). The stack trace pointed at tsx's loader (`resolveDirectory`/`resolveBase`, which has its own error-message text-parsing fallback for `ERR_MODULE_NOT_FOUND`), suggesting an environment-sensitive edge case in how `mock.module()`'s bare-specifier resolution interacts with tsx, not anything under this test's control. Fix: `resolveMockTarget(specifier)` pre-resolves each specifier to a concrete `file://` URL via `import.meta.resolve()` before handing it to `t.mock.module()` — `mock.module()` still correctly intercepts every other importer's plain `import ... from "next/headers"` (it matches by resolved target, not specifier text), so there is no bare-specifier resolution step left for `mock.module()`/tsx to disagree about.

Verified clean after both fixes on genuinely-switched Node 22.23.1 and Node 24.18.0 (via `nvm`, confirmed with `node --version` each time), each from a from-scratch `npm ci`.

Verified by literally executing `tests/module-mocks/release-gate-01-production-entrypoint-pre-fix-pattern.test.mjs` against a separate worktree checked out at `origin/main` (`58de7dae8ca8e98f7da4a5c76349c17ae837110a`) — i.e. against `src/lib/auth.ts`, `src/lib/auth/runtime-auth-continuity.ts`, and `src/lib/supabase/server.ts` exactly as they shipped in production, not this branch's versions:

```
$ npx tsx --experimental-test-module-mocks --test tests/module-mocks/release-gate-01-production-entrypoint-pre-fix-pattern.test.mjs
# (run inside a worktree of 58de7dae8ca8e98f7da4a5c76349c17ae837110a)
ok 1 - PRE-FIX PATTERN: assertRuntimeAuthContinuity() followed by a second, independent
       getAuthUser() call loses the session and requireAuthUser() redirects to /login,
       despite a genuinely authenticated first call
1..1
# pass 1, fail 0
```

This confirms, using main's real unmodified code: the first call (`assertRuntimeAuthContinuity()`) genuinely authenticates and its on-demand refresh write is genuinely swallowed by the real cookie adapter (asserted directly against the cookie jar, not inferred); the second, independent call (`getAuthUser()`) is then genuinely rejected with the already-used-refresh-token error; and `requireAuthUser()` genuinely throws the `NEXT_REDIRECT` to `/login` — the literal production symptom (authenticated UI, then a server-driven login redirect), reproduced end-to-end through real code, not a hand-modeled analogue of it.

One important scoping note: this same pre-fix-pattern test also passes unchanged on this branch (post-fix) — `getAuthUser()`/`requireAuthUser()` are not modified by this PR and remain exactly as vulnerable to a second, independent call as before. That is expected and correctly scoped: the fix is that `(protected)/layout.tsx` no longer *makes* that second call, not that the underlying hazard in calling `getUser()` twice against a non-persisting client was removed. Any other future code path that independently calls `getUser()`/`getSession()` a second time within the same protected-route request would still reproduce this defect — this is unchanged from, and already called out in, §15 item 4.

The companion fixed-pattern file necessarily cannot run against `origin/main` at all (`buildAuthUserContext` doesn't exist there — an import error, same shape as §9). Its evidentiary weight is instead the assertion that, using the same real entry points and the same swallow-on-write hazard (the cookie jar in that test still refuses to persist writes), the fixed call shape resolves the same authenticated user with exactly one `createServerClient()`/`getUser()` call — asserted via a call counter on the mocked factory, not inferred from source text.

## 9c. Evidence Classification

- **Confirmed root cause** (reproduced against real, unmodified `origin/main` production code, §9b): `(protected)/layout.tsx` made two independent, uncoordinated `getUser()` calls per request; a Server-Component-swallowed cookie write from the first call's on-demand token refresh left the second call presenting an already-consumed, single-use refresh token, which Supabase genuinely rejects (`401`, "Invalid Refresh Token: Already Used"), which `requireAuthUser()` genuinely treats as unauthenticated and redirects to `/login`.
- **Contributing weakness** (real, but not itself sufficient to cause the defect): `createSupabaseServerClient`'s `try { cookieStore.set(...) } catch {}` swallow-on-write behavior (`src/lib/supabase/server.ts`). This is *necessary* Next.js Server Component behavior, not a bug in itself — it only becomes a hazard when combined with a second, independent `getUser()` call in the same request. Still present and unchanged post-fix (§15 item 4).
- **Defensive improvement** (reduces the chance of recurrence, not independently proven to be "the fix" on its own): `assertRuntimeAuthContinuity()`'s new injectable-deps seam. It doesn't change any real caller's behavior, but it's what made §9b's real-entry-point testing possible at all — this class of live route/session-integration defect was structurally untestable before this PR (§7).
- **Unproven hypothesis** (plausible, not independently confirmed): the *precise* minute-by-minute mechanism and timing of the specific incident account's token expiry (§15 item 1), and the exact wall-clock gap between the two `getUser()` calls in the original production request. The *general* mechanism (any expired-token render redundantly double-refreshing) is confirmed and doesn't depend on this detail, but the specific incident timeline was not reconstructed from logs.
- **Not claimed:** that this fix, by itself, changes `createSupabaseServerClient`'s cookie-write behavior — it doesn't (§8, §11, §15 item 4). The fix is scoped entirely to eliminating the redundant second call that turned the pre-existing (correct, necessary) swallow-on-write behavior into a session-destroying race.

## 10. Implementation

1. **`src/lib/auth.ts`** — extracted the existing inline mapping logic in `getAuthUser` into a new pure, exported function `buildAuthUserContext(user: MinimalSupabaseUser): AuthUserContext | null`. `getAuthUser()` itself is unchanged in behavior (still creates its own client, still calls `getUser()` once, still memoized via React's `cache()`) — every one of its ~230 other call sites across the app is unaffected.
2. **`src/lib/auth/runtime-auth-continuity.ts`** — `assertRuntimeAuthContinuity` now:
   - Accepts an optional `Partial<RuntimeAuthContinuityDeps>` (each of `getUser`, `getSession`, `getPathname`, `getAuthCookieNames` individually injectable; defaults to the real `next/headers`/Supabase-backed implementations when omitted — zero behavior change for every real caller).
   - Returns the resolved Supabase `user` object (not just `userId`) in its report.
3. **`src/app/(protected)/layout.tsx`** — replaced the second, independent `await requireAuthUser()` call with `buildAuthUserContext(continuity.user)`, reusing the user `assertRuntimeAuthContinuity` already resolved. If that ever maps to `null` (an authenticated Supabase user with no email — the same edge case `getAuthUser` already handled), the layout redirects to `/login?next=...` exactly as `requireAuthUser` did.

Net effect: **exactly one `getUser()` call per protected-route request**, eliminating the double-refresh race entirely, without touching `getAuthUser()`/`requireAuthUser()`'s behavior for any other call site, without touching middleware, without touching login/signup/logout, and without weakening the auth-rejection-vs-network-error distinction `assertRuntimeAuthContinuity` already provided.

## 11. Cookie/Session Contract After the Fix

Unchanged from before, for every context except the one that was broken:

- Login/signup (Server Action/Route Handler): unchanged, persists normally.
- Middleware: unchanged, refreshes and persists normally, clears cookies only on a genuine `SIGNED_OUT`/auth rejection.
- Logout: unchanged — the only normal user action that intentionally clears the session.
- **Protected-route Server Component render:** now performs at most one `getUser()` call per request (previously two), so a same-request refresh, if it happens, is never immediately followed by a second, independent refresh attempt against the same now-stale cookie.

## 12. Validation

| Command | Exit | Result |
|---|---|---|
| `npx tsx --test tests/release-gate-01-auth-session-persistence.test.mjs` (pre-fix, stashed) | 1 | 0 pass / 1 fail (import error, see §9) |
| `npx tsx --test tests/release-gate-01-auth-session-persistence.test.mjs` (post-fix) | 0 | 9/9 pass |
| `npx tsx --experimental-test-module-mocks --test tests/module-mocks/release-gate-01-production-entrypoint-pre-fix-pattern.test.mjs` run against a worktree of `origin/main` (58de7dae8ca8e98f7da4a5c76349c17ae837110a), real unmodified source | 0 | 1/1 pass — real `assertRuntimeAuthContinuity`/`getAuthUser`/`requireAuthUser`/`createSupabaseServerClient` reproduce the defect end-to-end (see §9b) |
| Same file, run against post-fix source (this branch) | 0 | 1/1 pass — hazard is unchanged in `getAuthUser`/`requireAuthUser` themselves, as expected (see §9b scoping note) |
| `tests/module-mocks/release-gate-01-production-entrypoint-fixed-pattern.test.mjs` (post-fix only — imports `buildAuthUserContext`) | 0 | 1/1 pass — fixed call shape makes exactly one `getUser()` call |
| Targeted auth/onboarding/session suite (12 files: `auth-redirect-resolution`, `pmf-001-002-auth-session-visibility`, `pmf-001-002-canonical-onboarding`, `pmf-001-002-state-authority-reconciliation`, `proxy-routing`, `resolve-onboarding-state`, `runtime-authority-provider-resolution`, `signup-role-escalation`, `workspace-onboarding-guardrails`, `workspace-onboarding-preferences`, `command-center-onboarding-actions`, plus the new files) | 0 | 146/146 pass |
| PMF-003/003B/004 regression suites (`execution-task-write-authorization`, `critical-path-materialize-write-authorization`, `execution-tasks`, `execution-task-dependencies`, `route-guard-consistency`, `pmf-004-idempotent-call-sites`) | 0 | 240/240 pass |
| `npm test` (full suite; `package.json`'s `test` script now chains a second `tsx --experimental-test-module-mocks --test tests/module-mocks/*.test.mjs` invocation, scoped to only the new entry-point-regression files — see §9b) | 0 | **12,867 pass, 0 fail, 17 skipped** (12,884 total, matches documented pre-existing skip count) — verified locally against a from-scratch `npm ci` on both genuinely-switched Node 22.23.1 and Node 24.18.0 (via `nvm`, confirmed with `node --version`) |
| `npm run typecheck` | 0 | 0 errors |
| `npx eslint` on the 3 new files | 0 | 0 errors |
| `npm run build` | 0 | Success, all routes generated |

No migration required or made — this is application-code-only.

## 12b. Test-Count Reconciliation (12,873 baseline → 12,867 reported pass)

The PR description's original validation table was authored in an environment with real local Postgres available, producing `12,873` baseline / `0` skipped. This environment (and CI) has no local Postgres, so the reconciliation below re-measures the baseline the same way, in the same environment, for a true apples-to-apples comparison — not just quoting the old number.

`origin/main` @ `58de7dae8ca8e98f7da4a5c76349c17ae837110a`, this environment, `npx tsx --test tests/*.test.mjs tests/*.test.ts`:

| | Files | Total | Pass | Fail | Skip |
|---|---|---|---|---|---|
| Baseline (origin/main, re-measured here) | 476 | 12,873 | 12,856 | 0 | 17 |

All 17 skips are pre-existing, in a single file — `tests/pmf-004-default-pmo-command-center-idempotency.test.mjs` (added in PR #524, well before this branch) — each gated by `{ skip: !DB_AVAILABLE && SKIP_REASON }`, where `SKIP_REASON` is `"No usable local Postgres for PMF-004 concurrency tests ... Disclosed as residual, environment-dependent coverage in the PMF-004 remediation record"`. Confirmed identical (same 17, same reason) running `origin/main`'s own unmodified code in this same environment — this PR did not cause, and could not have prevented, these skips.

This branch (135cc9a), split `npm test` invocation:

| Invocation | Files | Total | Pass | Fail | Skip |
|---|---|---|---|---|---|
| `tsx --test tests/*.test.mjs tests/*.test.ts` | 477 (476 baseline + 1 new: `tests/release-gate-01-auth-session-persistence.test.mjs`) | 12,882 | 12,865 | 0 | 17 |
| `tsx --experimental-test-module-mocks --test tests/module-mocks/*.test.mjs` | 2 (both new) | 2 | 2 | 0 | 0 |
| **Combined** | **479** | **12,884** | **12,867** | **0** | **17** |

Reconciliation: `12,884 − 12,873 = 11` new tests added (9 in `tests/release-gate-01-auth-session-persistence.test.mjs`, 2 in `tests/module-mocks/`), all passing, 0 skipped, 0 failed. The skip count (17) is unchanged from baseline — same file, same reason, same count. There is no set of "six tests" that stopped running or lost coverage: `12,873 − 12,867 = 6` is the arithmetic difference between the *pass* counts of two runs measured under different Postgres-availability assumptions (the original table's 0-skip baseline vs. this environment's 17-skip baseline), not six tests that disappeared — it resolves to `17 (pre-existing, unrelated skips) − 11 (new, all passing) = 6`. Every test that executes passes; total discovered/executed tests increased by 11, not decreased.

Files outside both `npm test` globs, confirmed pre-existing and covered elsewhere, not newly excluded by the split: `tests/compliance/compliance-scripts.test.mjs` (pre-existing since PR #524, run via its own `npm run compliance:test` / `.github/workflows/ip-compliance.yml`, never matched by the original single-invocation `tests/*.test.mjs tests/*.test.ts` glob either — unaffected by this PR's invocation split).

## 13. Runtime Verification

Governance Gate passed; preview UAT began. **Checkpoint 1 (clean login + `sb-*` cookie presence) FAILED** on the first attempt: `/projects/new` rendered a fully authenticated shell (correct account/role) immediately before `/api/debug-auth` reported `authenticated: false` and DevTools showed zero `sb-*` cookies for the preview domain. This is a genuinely different defect from the one this PR originally fixed (§13a) — investigated and corrected below, in the same PR per the user's direction, before UAT restarted.

### 13a. Second defect found during UAT: `/api/login` can silently discard a just-established session

**Discovered via a real, running Next.js 16.2.10 server, not a mock assumption.** Using a minimal fake GoTrue HTTP backend and a live `next dev` instance of this repo, two things were verified directly over real HTTP:

1. A Route Handler's `cookies().set()` mutation (via `createSupabaseServerClient`'s adapter) DOES correctly merge onto a `NextResponse.redirect()`'s `Set-Cookie` header when the handler returns normally — ruling out a general "redirect responses drop cookies" theory for this Next.js version.
2. When something throws **after** that cookie mutation is queued but **before** the handler returns, Next.js's own generated error response carries **no** `Set-Cookie` header at all — the already-written session is silently discarded.

`src/app/api/login/route.ts`'s `POST` handler hits exactly this: `signInWithPassword()` succeeds and queues the session cookie, then `resolveOnboardingState(authUser, (await resolveCanonicalWorkspace(authUser.id)).workspaceId)` runs, unguarded, before the final `return NextResponse.redirect(...)`. Reproduced live: pointing the real route at a fake GoTrue backend with a deliberately-broken `resolveCanonicalWorkspace` dependency (missing service-role env, in the reproduction — any failure there has the same effect) produced a `POST /api/login` **500**, with **no** `Set-Cookie` header, even though the sign-in itself had fully succeeded and the cookie had genuinely been queued.

`resolveCanonicalWorkspace`/`resolveOnboardingState` only decide which authenticated page to land the user on — they never establish or validate the auth session itself — so a failure there destroying an otherwise-successful login is never correct.

**Fix:** `src/app/api/login/route.ts` now wraps the onboarding-resolution call in `try/catch`, logging via `logContinuityIssue` and falling back to the same "state unknown" path already used when there's no `authUser` at all (`resolvePostAuthDestination` sends that to `/projects/new`) — so a failure there can never again cost the user their just-established, genuinely valid session. Re-verified against the same live fake-backend harness: `POST /api/login` now returns a **307 to `/projects/new`** (matching the destination actually observed during Checkpoint 1) **with** the session `Set-Cookie` header present, and an independent follow-up request presenting only that cookie reports `authenticated: true`.

**Honesty about what this does and doesn't establish:** this fix is confirmed, with real HTTP evidence, to prevent one concrete way `/api/login` can silently drop a session while still redirecting the user to exactly the destination observed (`/projects/new`) with no visible error. It does **not** by itself confirm this was the exact mechanism behind the Checkpoint 1 observation — a dropped cookie on the login response should also have prevented `/projects/new`'s *own* render from showing an authenticated shell (no cookie would have reached the browser for that follow-up navigation at all), which doesn't fully square with what was reported. An alternative, unverified explanation: Next.js's client-side Router Cache serving a stale, previously-authenticated RSC payload for `/projects/new` from an earlier point in the same session, while the underlying session had already been separately lost (e.g. via §1's still-latent contributing weakness, or a concurrent-request race at the middleware layer not covered by either fix in this PR). This alternative is **not** independently confirmed and is recorded as an unproven hypothesis, not a finding.

**Tests:** `tests/module-mocks/login-onboarding-resolution-failure-pre-fix.test.mjs` (documents the pre-fix throw against the real, unmodified dependency chain) and `login-onboarding-resolution-failure-fixed.test.mjs` (real, unmodified `POST` export of `route.ts`, asserting the redirect and cookie both survive). Both leave `SUPABASE_SERVICE_ROLE_KEY` unset and use the real, unmocked `resolveCanonicalWorkspace` — it throws on its own via `createSupabaseServiceRoleClient()`, the exact failure verified live in §13a — rather than mocking `@/lib/workspaces/canonical-workspace-resolver`/`@/lib/auth/resolve-onboarding-state` via `t.mock.module()`: an initial version did mock them and hit a *third* CI-only resolution failure (`Cannot find module '.../tests/module-mocks/@/lib/workspaces/canonical-workspace-resolver'`) — `import.meta.resolve()` (the §12b fix for bare package specifiers) does not reliably route a `@/`-aliased internal specifier through tsx's path-alias resolution in CI, unreproducible locally the same way as the two `next/headers`/`@supabase/ssr` cases. Not chasing a fourth specifier trick — using the real, unmocked dependency chain sidesteps needing to mock an internal `@/` module at all. Verified: the fixed-behavior test fails with the exact uncaught exception when run against the pre-fix `route.ts` (confirmed by temporarily swapping in `origin/main`'s version of this untouched-until-now file), and passes after the fix, on both Node 22.23.1 and Node 24.18.0.

**Scope note (superseded by §13b):** `src/app/signup/actions.ts` had the identical unguarded shape. Originally flagged as residual debt in §15 for a follow-up; the repository owner subsequently required it be fixed in this same PR (new-user signup/onboarding UAT depends on it), so it is now fixed — see §13b.

### 13b. Third defect found closing out signup: the identical unguarded shape in `src/app/signup/actions.ts`

`signupAction` (the Server Action backing `/signup` — `signUp()` succeeds and queues the session cookie, then an unguarded `resolveOnboardingState(authUser, (await resolveCanonicalWorkspace(authUser.id)).workspaceId)` runs before the Server Action's own `redirect(decision.destination)` call) has the exact same hazard §13a fixed for `/api/login/route.ts`. Fixed identically: wrapped in `try/catch`, logging via `logContinuityIssue` (`post_signup_onboarding_resolution_failed`) and falling back to the same "state unknown" path (`/projects/new`) — strictly *after* the existing `if (error) redirect(...)` and `if (!data.session) redirect(...)` checks, so it has no effect on genuine signup-authentication failures, never claims onboarding is complete, and never fabricates workspace/project state; it only isolates the destination-resolution failure.

**Tests** (`tests/module-mocks/signup-*.test.mjs`, each a separate file for the established process-isolation reason):
- `signup-onboarding-resolution-failure-pre-fix.test.mjs` — documents the pre-fix throw (`resolveCanonicalWorkspace` throwing on its own via missing `SUPABASE_SERVICE_ROLE_KEY`, same technique as §13a) against the real, unmodified dependency chain.
- `signup-onboarding-resolution-failure-fixed.test.mjs` — the real, unmodified `signupAction` export, asserting the redirect (`NEXT_REDIRECT;replace;/projects/new`, read from the thrown redirect error's `.digest` — Server Actions always exit via that throw) and the session cookie both survive, **plus** an independent follow-up request (the real `/api/debug-auth` `GET` handler, sharing only the cookie jar) reporting `authenticated: true` for the signup-issued session.
- `signup-authentication-failure-does-not-redirect-as-authenticated.test.mjs` — a genuine `signUp()` failure (e.g. "User already registered") still redirects to `/signup?error=...`, never to `/projects/new` or `/command-center`, and writes no cookie — proving the fix's `try/catch` is scoped strictly after the real auth-failure checks and cannot mask one.
- `signup-onboarding-resolution-success-path-unchanged.test.mjs` — proves the fix's fallback does *not* unconditionally fire: real, unmocked `resolveOnboardingState` + `resolvePostAuthDestination`, fed evidence for an already-active Command Center, resolve to `/command-center` (not the failure-fallback `/projects/new`).

**A fourth resolution-mocking limitation, discovered and worked around while building the success-path test:** unlike every other package mocked in this suite, `@supabase/supabase-js` ships its raw `.ts` source alongside `dist/` inside `node_modules` (`"files": ["dist", "src"]`). Reproduced directly (a standalone `.ts` file importing `@supabase/supabase-js` from any project, not specific to this codebase): tsx resolves that import to `node_modules/@supabase/supabase-js/src/index.ts`, not `dist/index.mjs` — and calls through that resolution bypass `node:test`'s `t.mock.module()` hook entirely; mocking both the `dist` and the computed `src` target URLs was tried and neither intercepted the call. This blocks module-mocking `createClient` anywhere it's reached through a `.ts` import chain (i.e. `resolveCanonicalWorkspace`/`resolveOnboardingState`'s real service-role DB access), which is why the success-path test uses `resolveOnboardingState`'s own pre-existing `opts.getClient` test seam directly instead of routing the DB layer through `signupAction` itself — the redirect/cookie-survival and genuine-failure tests don't need this workaround, since they rely on a synchronous env-var throw that happens before `createClient` is ever reached.

Verified: the fixed-behavior test fails with the exact uncaught exception when run against the pre-fix `signup/actions.ts` (confirmed by temporarily swapping in `origin/main`'s version of this file), and all four signup test files pass after the fix, on both Node 22.23.1 and Node 24.18.0. Full suite (`npm test`), `npm run typecheck`, `npx eslint`, and `npm run build` all clean on both Node majors.

## 14. Rollback Considerations

The change is additive/subtractive within three files and is easy to revert (`git revert`) if the preview UAT surfaces a regression. No data migration, no schema change, no change to login/signup/logout. If reverted, the pre-existing double-`getUser()`-call defect returns; no new failure mode is introduced by rolling back.

## 15. Residual Debt

1. **Not independently confirmed:** the *exact* moment/mechanism by which the reproducing account's access token became expired (e.g., how long the session had been open before this UAT session). The fix addresses the *general* mechanism (any expired-token render redundantly double-refreshing), which is sufficient regardless of how any specific token came to be expired, but a precise minute-by-minute timeline of the original incident was not reconstructed.
2. **`next.config.ts`'s `STATIC_SERVER_ACTION_ORIGINS = ["pmfreak-mu.vercel.app"]`** (Next.js's Server Action origin allowlist) does not include `pmfreak.com`, the custom production domain actually used in this reproduction. This was discovered during investigation and is *not* the mechanism behind this defect (the reproduction was plain `GET` navigation, not a Server Action submission, and Next.js additionally auto-trusts the request's own same-origin Host by default), but it is a plausible separate risk to Server Action-based mutations (form submissions) issued from `pmfreak.com` and is flagged here for product-owner attention rather than fixed in this narrowly-scoped PR.
3. **`@supabase/auth-helpers-nextjs`** remains a listed `package.json` dependency (deprecated) but is not imported anywhere in `src/` — confirmed dead, not a contributing factor, left untouched as out of scope for this hotfix.
4. `createSupabaseServerClient`'s swallow-on-write-failure pattern (`src/lib/supabase/server.ts:14-22`) is unchanged and remains necessary (Server Components genuinely cannot write cookies) — the fix here is to avoid *needing* a second, redundant call in the one place that was making one, not to change this adapter itself. Any *other* future code path that independently calls `getUser()`/`getSession()` a second time within the same protected-route request would reintroduce an equivalent race; this is now called out explicitly in both files' doc comments.
5. ~~`src/app/signup/actions.ts` has the same unguarded-cookie-write-then-DB-call shape §13a fixed in `/api/login/route.ts`~~ **Fixed — see §13b.** (Originally flagged here as out-of-scope residual debt; the repository owner subsequently required it be closed in this same PR since new-user signup/onboarding UAT depends on it.)
6. **`src/proxy.ts`'s `isInternalDebugRoute` gate uses `process.env.NODE_ENV === "production"` instead of `VERCEL_ENV`/`isProductionRuntime()`.** Since Next.js sets `NODE_ENV=production` for every `next build` including preview deploys, `/debug-session` silently redirects to `/command-center` on *any* Vercel deployment, preview included — even though `getRuntimeEnvironment()` (used correctly everywhere else, e.g. `/api/debug-auth`'s own production gate) would resolve preview deploys to `"preview"`, not `"production"`. Discovered while trying to use `/debug-session` as a UAT diagnostic tool; recorded here as a separate, pre-existing, unrelated defect per explicit instruction not to fold it into this hotfix. Does not block any diagnostics performed in this record — `/api/debug-auth` (an API route, which bypasses this page-level gate entirely) was used instead.

## 16. Release-Gate Impact

Release Gate 01's browser/runtime UAT is paused pending this fix's deployment and re-verification (see `docs/audits/pmfreak-release-gate-01.md`). No other Release Gate 01 checkpoint (workspace bootstrap, Project-first creation, first task, Command Center activation, etc.) was reached before this defect blocked the journey at Checkpoint A.
