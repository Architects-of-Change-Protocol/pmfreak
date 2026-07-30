# Release Gate 01 — Corrective Hotfix #2: Protected Navigation Auth-Loss (Post-PR-#562)

**Severity:** P1 (production defect: an authenticated user is redirected to `/login` on ordinary internal navigation, session effectively lost, without signing out).
**Scope:** `src/components/pmfreak/operational-shell.tsx`, `src/components/pmfreak/navigation/advanced-drawer.tsx`, `src/components/pmfreak/navigation/sidebar-pmo-tree.tsx`, `src/lib/auth/validate-continuation-route.ts`, `src/lib/auth/route-policy-registry.ts`, `src/lib/auth/runtime-auth-continuity.ts` (memoization only). No product-code change outside the navigation/auth path.
**Branch:** `fix/release-gate-01-navigation-and-brain-activation`, based on `origin/main` at `5777a3df799c874de956ded1f2e100673e60cdcb` (PR #562's merge commit).
**Discovered during:** Post-merge production UAT of PR #562, reproducing the same observable symptom PR #562 was believed to have fixed.

---

## 1. Executive Summary

PR #562 correctly eliminated the double-`getUser()` call *within* `(protected)/layout.tsx`'s own request handling. Production UAT after that PR merged reproduced the **identical observable symptom** — authenticated `/projects/new` shell renders correctly, then clicking a nav item (or a fresh direct navigation) redirects to `/login` — via a **different** mechanism the layout-only fix never touched:

1. **Prefetch race.** `next/link`'s default viewport prefetching fired real background HTTP requests, through Edge middleware (`src/proxy.ts` → `src/lib/supabase/proxy.ts`), for every visible protected nav link as soon as the authenticated shell rendered. Each such request independently calls `supabase.auth.getUser()`, which refreshes the session on-demand if the access token is expired. Because Supabase single-use-rotates the refresh token the instant it is used, only the *first* of several concurrent prefetch requests (or the user's own real click-through navigation, if it loses the race) succeeds; the rest are rejected with `401 "Invalid Refresh Token: Already Used"`, which `src/lib/supabase/proxy.ts:59-73` treats as a hard, non-recoverable auth rejection (deliberately, correctly, no `getSession()` fallback for a real 401/403) — and `src/proxy.ts:58-63` redirects to `/login`.
2. **Continuation-allowlist drift.** `isSafeContinuationRoute`'s hand-maintained `ALLOWED_PREFIXES` list had silently drifted out of sync with the real, growing set of protected routes/nav destinations — `/chat`, `/execution`, `/executive`, `/pmos`, `/workspaces`, `/team`, and others were simply missing. So even when re-login succeeded, the user's actually-requested destination was silently discarded and the login flow landed them back on `/command-center` or `/projects/new` — the exact "logging back in returns them to Projects... the cycle repeats" behavior reported.
3. **Route-classification drift (latent, not itself the cause).** `/execution` and `/workspace-setup` are real nav hrefs (`src/lib/workspace/navigation-hierarchy.ts`) with no explicit entry in `route-policy-registry.ts`'s route tables, falling through to the `"unknown"` policy — currently harmless only because `isProtectedPageRoute` also treats `"unknown"` as protected.

This is the same *class* of hazard PR #562 fixed (concurrent, uncoordinated, refresh-capable `getUser()` calls racing the same single-use refresh token) — relocated from "two calls within one Server Component request" to "many calls across concurrent Edge middleware invocations triggered by Link prefetch." PR #562's own remediation record already flagged this exact possibility as an open, unproven hypothesis (`docs/audits/remediation/release-gate-01-auth-session-persistence.md` §9c, §15 item 4): *"Any other future code path that independently calls `getUser()`/`getSession()` a second time within the same protected-route request would reintroduce an equivalent race."* This corrective pass confirms and closes that specific, predicted gap.

---

## 2. Investigation

Conducted via static, real-invocation tracing of the actual production code (no live browser access to `pmfreak.com` from this sandbox — see §7 for required UAT). Full call graph for one click-through navigation from `/projects/new` to another protected route:

| Order | Context | Call | File:Line | Refresh-capable? |
|---|---|---|---|---|
| 0 (background) | Browser / Next.js Router | `next/link` viewport-prefetch fires for every visible sidebar `<Link>` (primary/lens/utility tiers, 12+ items) as soon as `/projects/new` mounts — no `prefetch={false}` anywhere pre-fix | `operational-shell.tsx` (pre-fix), `advanced-drawer.tsx`, `sidebar-pmo-tree.tsx` | — |
| 1..N (concurrent) | Edge middleware, once per prefetch request | `supabase.auth.getUser()` | `src/lib/supabase/proxy.ts:49` | Yes |
| N+1 | Edge middleware for the actual clicked navigation | `supabase.auth.getUser()` | `src/lib/supabase/proxy.ts:49` | Yes |
| N+2 | Server Component (`(protected)/layout.tsx`), same request as the real click | `assertRuntimeAuthContinuity()` → `getUser()` | `src/lib/auth/runtime-auth-continuity.ts:72` | Yes, but middleware already forwarded the refreshed `Cookie` header for the same request via `NextResponse.next({request:{headers}})` — this leg is the part PR #562 already made safe. |

The double-call PR #562 fixed was *within a single request* (layout calling `getUser()` twice). The new defect is *across concurrently-fired, independent requests* — a class of race PR #562's own fix could not and did not address, since it only deduplicated the layout's own calls.

---

## 3. Root-Cause Analysis (ranked, with confidence)

1. **Primary, confirmed.** Default-enabled `next/link` prefetching in the persistent nav shell (`operational-shell.tsx`, `advanced-drawer.tsx`, `sidebar-pmo-tree.tsx`) causes every visible protected nav link to fire a real request through Edge middleware as soon as the shell renders. Each concurrent middleware invocation independently calls `getUser()` against the same, not-yet-rotated refresh-token cookie snapshot the browser is still holding. Supabase's one-time-use refresh-token rotation means only one of these concurrent refreshes can succeed; any other — including, unluckily, the request generated by the user's own click — gets `401 "Invalid Refresh Token: Already Used"`, which middleware correctly (by design) treats as a hard auth rejection and redirects to `/login`.
2. **Confirmed, compounding.** `isSafeContinuationRoute`'s `ALLOWED_PREFIXES` allowlist was missing most of the real protected route set, so the post-login redirect dropped the originally-requested destination for most of the 12 named nav destinations — this is what made the failure look like "always lands back on Projects" rather than a one-off blip.
3. **Confirmed, latent classification drift, not itself causal.** `/execution` and `/workspace-setup` fell through to the `"unknown"` route policy.
4. **Ruled out:** stale Router-Cache/RSC payloads (affected pages are `force-dynamic`, no custom `staleTimes` override), a client-side global 401 interceptor (none exists in this codebase), and any client component independently re-checking auth on mount.

---

## 4. Correction

1. **Stop the prefetch storm.** Every internal navigation `<Link>` in `operational-shell.tsx`, `advanced-drawer.tsx`, and `sidebar-pmo-tree.tsx` now sets `prefetch={false}`. This does not change click-through navigation behavior at all — it only stops Next.js from firing speculative background requests for every visible protected destination while the user is simply looking at the current page. This is the direct fix for the concurrency race: with no background prefetch traffic, the only `getUser()`-triggering request for a given navigation is the one the user's own click actually generates, plus the one Server Component render downstream of it — exactly the single-refresh-per-navigation shape PR #562 already made safe for.
2. **Eliminate the duplicated allowlist.** `isSafeContinuationRoute` (`src/lib/auth/validate-continuation-route.ts`) no longer maintains its own `ALLOWED_PREFIXES` list. It now delegates to `isProtectedPageRoute` (`src/lib/auth/route-policy-registry.ts`) — the same canonical route table already used to decide whether a route requires authentication in the first place — so there is exactly one source of truth for "is this a real, known app route," and it cannot drift out of sync with itself. `internal-debug` routes (e.g. `/debug-session`) are explicitly excluded from continuation targets even though they count as "protected" for auth purposes — they are internal tooling, not a place a user should be returned to after login. `BLOCKED_PREFIXES` (auth/api/`_next` routes) is retained as an explicit belt-and-suspenders denylist.
3. **Close the route-classification drift.** `route-policy-registry.ts`'s `WORKSPACE_CONTEXTUAL_ROUTES` now explicitly lists `/execution`, `/workspace-setup`, `/programs`, `/trials`, and `/evidence` — every real `NAVIGATION_HIERARCHY` href now resolves to an explicit policy, none fall through to `"unknown"`.
4. **Defense in depth for future call sites.** `assertRuntimeAuthContinuity()`'s real (no injected `deps`) call path is now memoized per request via React's `cache()` — so if a future Server Component needs the resolved auth user again in the same request (as `src/app/(protected)/projects/new/page.tsx` now does, to resolve the workspace role for the Brain-activation permission gate — see the companion Brain-activation-honesty remediation record), it reuses the layout's already-resolved result instead of making its own independent `getUser()` call. Test-injected `deps` calls are deliberately **not** cached (cache() keys on referential identity; every test call already runs fresh). This closes, in advance, the exact "a second call site" gap this defect and PR #562's residual-debt note both warned about.

No change to login, signup, logout, or middleware's core auth-decision logic (401/403 → unauthenticated is still correct and unchanged — a real dead refresh token must still bounce to `/login`; the fix is to stop *manufacturing* spurious dead-token events via unnecessary background traffic).

---

## 5. Tests

New file: `tests/release-gate-01-protected-navigation-continuity.test.mjs` — real invocation of the actual production entry points (`isSafeContinuationRoute`, `getRouteAccessPolicy`, `isProtectedPageRoute`, `NAVIGATION_HIERARCHY`), plus source-level assertions that every internal nav `<Link>` in the three affected shell components disables prefetch:

- Every real `NAVIGATION_HIERARCHY` destination is a safe continuation route (fails against the pre-fix `ALLOWED_PREFIXES` list, which was missing 8 of the 12 named destinations; passes after delegating to `isProtectedPageRoute`).
- The continuation validator still rejects `/login`, `/signup`, `/api/*`, `/debug-session`, protocol-relative/external targets, and control-character injection.
- `/execution` and `/workspace-setup` resolve to an explicit policy, not `"unknown"`.
- Every shell/advanced-drawer/sidebar-PMO-tree `<Link>` sets `prefetch={false}`.

Updated: `tests/auth-redirect-resolution.test.mjs` and `tests/create-pmo-flow.test.mjs`, whose prior assertions checked for the now-removed `ALLOWED_PREFIXES` symbol by source-text match — updated to assert the real, current behavior (delegation to `isProtectedPageRoute`, verified by real invocation) instead of a symbol name.

## 6. Validation

| Command | Result |
|---|---|
| `npx tsx --test tests/release-gate-01-protected-navigation-continuity.test.mjs` | 26/26 pass |
| Targeted auth/nav/PMO suite (`auth-redirect-resolution`, `proxy-routing`, `create-pmo-flow`, `create-project-brain`, `create-project-flow`, `workspace-pmo-project-hierarchy`, plus both new files) | 182/182 pass |
| `npm test` (full suite, real local Postgres) | **12,909 pass, 0 fail, 0 skipped** (main suite) + **8/8 pass** (module-mocks) |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 614 warnings (identical to documented baseline) |
| `npm run build` | Success, all routes generated (including `/execution`, `/workspace-setup`) |

No migration required for this record (the idempotency migration in the companion Brain-activation record is unrelated to navigation).

## 7. Residual Debt / What Remains Unverified From This Sandbox

1. **No live browser/network evidence yet.** This sandbox cannot reach `pmfreak.com` or a Vercel preview directly. The exact reproduction sequence (click "Create Center" from `/projects/new`, observe `/login` redirect and empty cookie table; direct navigation control to `/command-center`) has not been re-run against a deployed preview of this fix. Required before this record can be marked runtime-verified — see the final report's post-deployment UAT checklist.
2. **Prefetch is disabled, not proven absent as a contributing factor in isolation.** This fix removes the speculative background traffic that is the most direct, reproducible trigger for the race under a routine, expected token-expiry window. It does not add a mutex/single-flight guard around Edge middleware's `getUser()`-triggered refresh itself — a genuinely concurrent pair of *real* user-initiated requests (e.g. two browser tabs, or a double-click triggering two real navigations) could in principle still race. This is a narrower residual surface than the pre-fix prefetch storm (bounded by actual user action rather than automatic background fan-out), and is not itself the reported symptom, but is disclosed here rather than implied fixed.
3. **`next.config.ts`'s `STATIC_SERVER_ACTION_ORIGINS`** still does not list `pmfreak.com` (flagged, not fixed, in the PR #562 remediation record's residual debt #2) — unrelated to this defect, still outstanding, still the product owner's call.
