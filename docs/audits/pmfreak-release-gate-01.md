# PMFreak Release Gate 01 — Post-Merge Runtime Completion

## 1. Gate Purpose

Validate, via real browser/runtime UAT (not automated tests alone), that the merged foundational remediation sequence (PMF-003, PMF-003B, PMF-004, PMF-001/002 — PRs #557–#561) actually works through the real PMFreak user journey, before Prompt 5 (Project Brain Honesty) begins.

## 2. Date / UTC Timestamp

Session conducted 2026-07-28 (UTC date per system clock). Exact per-checkpoint UTC timestamps were not independently captured by either party during the live browser session; the UAT run identifier below stands in as the traceable reference.

## 3. Repository and Branch

- Repository: `architects-of-change-protocol/pmfreak`
- Verification session branch: `claude/pmfreak-release-gate-01-runtime-2so6pk`
- Corrective-fix branch: `fix/release-gate-01-auth-session-persistence` (created from `origin/main`)

## 4. `origin/main` SHA

`58de7dae8ca8e98f7da4a5c76349c17ae837110a`

## 5. Deployed SHA

`58de7dae8ca8e98f7da4a5c76349c17ae837110a` — confirmed identical to `origin/main` via `GET https://pmfreak.com/api/build-info` (`{"app":"pmfreak","commit":"58de7dae8ca8e98f7da4a5c76349c17ae837110a","branch":"main","vercelEnv":"production", ...}`).

## 6. Environment Classification

Production (`https://pmfreak.com/`). No dedicated staging/UAT environment or main-branch preview connected to an isolated database was available or discoverable; per the gate's own environment preference order, production was used only because no safer environment existed, with an explicitly disposable/internal test identity and a plan for narrowly-scoped disposable entities. The journey was interrupted by a genuine defect before any disposable UAT entity was created (see §17).

## 7. Sanitized Runtime URL

`https://pmfreak.com/`

## 8. UAT Mode

**Mode B — Agent-guided human browser UAT.** This Claude Code sandbox's egress proxy enforces an organization-level policy that denies outbound connections to `pmfreak.com` (confirmed via the proxy's own diagnostic endpoint: `gateway answered 403 to CONNECT (policy denial or upstream failure)`, host `pmfreak.com:443`) — Mode A (direct automated browser control) was attempted and is not available from this environment. The repository owner drove the browser directly; each checkpoint's evidence (route, visible state, screenshots) was reported back and correlated against repository code, automated tests, and (where reachable) persisted-state expectations.

## 9. UAT Run Identifier

`PMF-GATE01-20260728`

## 10. Redacted Test Identity

Pre-existing production account belonging to the repository owner, domain `@onchainfest.xyz` (an internal-allowlisted domain per `src/lib/auth.ts`'s `INTERNAL_EMAIL_DOMAINS`, not a customer account). Role: `viewer`. Full email withheld from this report. A disposable, uniquely-named UAT identity/workspace/Project/task using the `PMF-GATE01-20260728` alias was never created — the journey was blocked at the authentication checkpoint before workspace bootstrap began.

## 11. Prerequisite Merge Verification

| PR | Title | State | Merge commit | Contained in current `origin/main`? |
|---|---|---|---|---|
| #557 | fix(auth): enforce write authorization on execution mutations (PMF-003) | merged | `257ae44733b79c241e8f9981740bca512599ff18` | Yes |
| #558 | fix(auth): secure critical-path materialization (PMF-003B) | merged | `eb1c0185f2b42cf61af9bdd3638af8b9a108d78d` | Yes |
| #559 | fix(pmo): make default Command Center activation idempotent (PMF-004) | merged | `7a8a8d4ccf62954da26a0ae3869c138b937ed9fc` | Yes |
| #560 | fix(onboarding): consolidate honest project-first activation (PMF-001/002) | merged | `fd163ba06ed6f98a514ac51a8a079816400f8500` | Yes |
| #561 | docs: add post-merge UAT report for PR #560 | merged | `58de7dae8ca8e98f7da4a5c76349c17ae837110a` (current `origin/main` tip) | Yes (identical content confirmed byte-for-byte against `claude/pmfreak-pr560-onboarding-uat-opz5ef` commit `211d996e277ce643ee3ae34841b7253ad7c1fd80`) |

**GATE-01: PASS.**

## 12. PMF-003 Authorization Evidence

Automated (re-verified this session, no code changes since original merge): `tests/execution-task-write-authorization.test.mjs` — 17/17 pass; the four previously-vulnerable endpoints (`execution-tasks/update`, `execution-task-dependencies/update`, `execution-task-dependencies` create, `execution-task-dependencies/materialize`) all gate on `"write"`. No live two-account browser cross-tenant smoke test was performed (blocked by the same runtime-access limitation as the rest of this gate — see §19).

## 13. PMF-003B Authorization Evidence

Automated (re-verified): `tests/critical-path-materialize-write-authorization.test.mjs` — 6/6 pass. `POST /api/critical-path/materialize` gates on `"write"`.

## 14. PMF-004 Idempotency Evidence

Automated (re-verified, real local PostgreSQL 16, this session): `tests/pmf-004-default-pmo-command-center-idempotency.test.mjs` — 17/17 pass (part of the 12,882/12,882 full-suite run, §30). No browser-level double-click/double-tab activation smoke test was performed — Command Center activation (Checkpoint E) was never reached in this gate's journey.

## 15. Canonical-Route Inventory

Not independently re-derived this session beyond what PR #560 and its remediation record already document (`docs/audits/remediation/pmf-001-002-canonical-onboarding-honest-activation.md`); no code affecting routing changed except the auth-continuity fix in this session (§32), which does not alter the onboarding-state route map.

## 16. Browser Route-Transition Matrix

| Step | Route before | Action | Route after | Expected | Result |
|---|---|---|---|---|---|
| Checkpoint 0 | — | `GET /api/build-info` | — | commit matches `origin/main` | **PASS** |
| Checkpoint A | `/projects/new` (authenticated, full shell rendered) | Click "Create Center" nav item | `/login?next=%2Fcreate-command-center` | stay authenticated, land on `/create-command-center` | **FAIL — P1 defect** |
| Checkpoint A (control) | (new tab) | Direct navigation to `/command-center` | `/login?next=%2Fcommand-center` | stay authenticated | **FAIL — same defect, confirms non-transient** |

No further route transitions were exercised — the journey was paused per the gate's own corrective-defect protocol.

## 17. Workspace Bootstrap Results

**NOT REACHED.** Blocked by the Checkpoint A defect.

## 18. Project-First Results

**NOT REACHED.**

## 19. First-Task Results

**NOT REACHED.**

## 20. Activation Results

**NOT REACHED.**

## 21. Reload Continuity

Not exercised as a distinct checkpoint; the direct-navigation control in §16 is evidence of the same class of failure (a fresh request, not merely a stale client-side router cache), which is the essential property reload continuity would also test.

## 22. Sign-Out/Sign-In Continuity

**NOT REACHED** — the account was already involuntarily de-authenticated by the defect itself before this checkpoint could be exercised as designed.

## 23. Legacy URL Results

**NOT REACHED.**

## 24. Legacy Boolean Results

**NOT REACHED.**

## 25. Honest Zero-State Results

**NOT REACHED.**

## 26. Persistence Before/After Matrix

**NOT REACHED** — no disposable UAT entities were created; no database inspection of workspace/project/task/PMO row counts was performed this session.

## 27. Fabricated-State Inspection

**NOT REACHED** for the onboarding journey. No fabricated evidence, readiness score, or fake activity was observed on the two pages that did render (`/projects/new`, the `/login` page) before the defect halted the journey.

## 28. Authorization Smoke Results

Automated PMF-003/003B/004 suites re-run and green (§12–14). No live two-account browser cross-tenant check was performed (§19 below).

## 29. Screenshots/Traces

Two screenshots were provided by the repository owner during Checkpoint A (authenticated `/projects/new` state showing the sidebar identity/role badge; the `/login?next=%2Fcreate-command-center` redirect result) and a third confirming the direct-navigation control (`/login?next=%2Fcommand-center`). Not reproduced verbatim in this report (may contain account-identifying detail); described in `docs/audits/remediation/release-gate-01-auth-session-persistence.md` §2–3.

## 30. Automated Commands and Results

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | 586 packages installed |
| `npm run typecheck` | 0 | 0 errors |
| `npm run lint` | 0 | 0 errors, 614 warnings (baseline) |
| `npm run build` | 0 | Success, all routes generated |
| `npm test` (full suite, local Postgres running) | 0 | **12,882/12,882 pass, 0 fail, 0 skipped** |

(12,882 = the previously-certified 12,873 baseline + 9 new regression tests added by the corrective hotfix — see `docs/audits/remediation/release-gate-01-auth-session-persistence.md` §12.)

## 31. Skipped-Test Disposition

Zero tests skipped in this session's full-suite run (local Postgres was running throughout).

## 32. Defects Found

**One P1 defect**, discovered live during Checkpoint A: an authenticated production user was redirected to `/login` on ordinary internal navigation, with all auth cookies subsequently cleared, without signing out. Full detail, root cause, and correction in `docs/audits/remediation/release-gate-01-auth-session-persistence.md`. Summary:

- **Root cause:** `src/app/(protected)/layout.tsx` made two independent, uncoordinated server-side `getUser()` calls per request (`assertRuntimeAuthContinuity()` then `requireAuthUser()`/`getAuthUser()`, each with its own Supabase client). When the access token was expired, the first call's on-demand refresh succeeded but could not be persisted (Server Components cannot write cookies); the second call then presented the same, now-already-rotated-and-consumed refresh token and was rejected outright, triggering the login redirect and a subsequent legitimate cookie-clear by middleware.
- **Correction:** `assertRuntimeAuthContinuity()` now returns the resolved user; the layout builds the full `AuthUserContext` from it via a new `buildAuthUserContext()` helper instead of calling `getUser()` a second time. Exactly one `getUser()` call now happens per protected-route request.
- **Files changed:** `src/lib/auth.ts`, `src/lib/auth/runtime-auth-continuity.ts`, `src/app/(protected)/layout.tsx`; new test `tests/release-gate-01-auth-session-persistence.test.mjs`.

## 33. Corrective PR

Branch `fix/release-gate-01-auth-session-persistence`, based on `origin/main` at `58de7dae8ca8e98f7da4a5c76349c17ae837110a`. PR to be opened as a draft targeting `main` (see final response for the PR number/URL once created). **Not merged. Not marked ready for merge** — runtime UAT of the fix against a deployed preview has not yet occurred.

## 34. Residual Debt

1. The auth-session-persistence fix itself has not yet been runtime-verified against a live deployment (no preview URL was available at the time of writing) — required before this gate can resume past Checkpoint A.
2. `next.config.ts`'s Server Action `allowedOrigins` does not list `pmfreak.com` (only `pmfreak-mu.vercel.app`) — discovered during investigation, not proven to be the mechanism behind this defect, flagged for product-owner attention as a separate, unconfirmed risk to Server-Action-based mutations from the custom domain.
3. Checkpoints B through H (workspace bootstrap through honest zero-states), the persistence before/after matrix, and the live two-account cross-tenant authorization smoke check are all still outstanding and must be executed once Checkpoint A passes cleanly.

## 35. Cleanup State

No disposable UAT entities were created (the journey never reached workspace bootstrap), so no cleanup is owed. The pre-existing production account used for reproduction was not modified, and per the corrective-defect protocol, was explicitly not deleted.

## 36. Gate Assertions and Evidence

| Gate | Assertion | Status | Evidence |
|---|---|---|---|
| GATE-01 | PMF-003, PMF-003B, PMF-004, PMF-001/002 merged into current main | **PASS** | §11 |
| GATE-02 | Read-only users cannot mutate execution tasks/dependencies | **PASS** (automated only) | §12 |
| GATE-03 | Read-only users cannot materialize critical paths | **PASS** (automated only) | §13 |
| GATE-04 | Exactly one onboarding system is user-reachable | **NOT APPLICABLE (not reached this session)** | §15 |
| GATE-05 | Workspace bootstrap is persistent and idempotent | **BLOCKED** | §17 |
| GATE-06 | Direct Project creation succeeds without a PMO | **BLOCKED** | §18 |
| GATE-07 | Direct Project creation succeeds without Command Center activation | **BLOCKED** | §18 |
| GATE-08 | Invite Team is non-blocking | **BLOCKED** | not reached |
| GATE-09 | A legitimate manual task can be created without fabricated ancestry | **BLOCKED** | §19 |
| GATE-10 | Project-without-task produces an honest first-task state | **BLOCKED** | §19 |
| GATE-11 | Activation availability derives from real execution evidence | **BLOCKED** | §20 |
| GATE-12 | Command Center active derives from PMF-004-backed persisted state | **BLOCKED** | §20 |
| GATE-13 | Concurrent/repeated activation produces one canonical PMO/activation | **PASS** (automated only, real Postgres concurrency tests, §14); browser-level not reached |
| GATE-14 | Reload preserves the correct state at every stage | **BLOCKED** | §21 |
| GATE-15 | Sign-out/sign-in restores the correct state at every stage | **BLOCKED** | §22 |
| GATE-16 | Legacy URLs redirect according to canonical persisted state | **BLOCKED** | §23 |
| GATE-17 | Legacy onboarding booleans are not authoritative | **BLOCKED** | §24 |
| GATE-18 | No fabricated readiness score renders | **NOT APPLICABLE (not reached)** | §25 |
| GATE-19 | No fake evidence is inserted or rendered | **NOT APPLICABLE (not reached)** | §25 |
| GATE-20 | No simulated learning/intelligence appears in foundational zero state | **NOT APPLICABLE (not reached)** | §25 |
| GATE-21 | Post-activation landing reaches a functioning Command Center | **BLOCKED** | §20 |
| GATE-22 | Full required automated validation is green | **PASS** | §30 |
| GATE-23 | The deployed runtime commit matches the main commit being certified | **PASS** | §5 |
| GATE-24 | No P0 or P1 defect remains open | **FAIL** | §32 — one P1 open pending runtime-verified corrective PR |

## 37. Final Verdict (original, pre-#562-merge)

**RELEASE GATE 01 FAILED — CORRECTIVE PR REQUIRED**

GATE-24 fails: one P1 production authentication/session-persistence defect was found and is not yet closed (fix implemented and automated-validated on branch `fix/release-gate-01-auth-session-persistence`, but not yet runtime-verified against a deployment). No later checkpoint (workspace bootstrap onward) was reached. This gate must be re-run from Checkpoint A once the corrective PR's preview deployment passes the same reproduction sequence cleanly, before Prompt 5 may begin.

---

## 38. Corrective Pass #2 (post-#562-merge production UAT)

PR #562 (the corrective PR from §33/§37 above) merged into `main` at `5777a3df799c874de956ded1f2e100673e60cdcb`. Post-merge production UAT against that exact deployed commit reproduced **two** new P1 defects, distinct from (though in one case closely related to) the one #562 fixed:

- **Failure A — protected navigation still loses authentication.** Same observable symptom as the original Checkpoint A defect (authenticated shell renders, clicking a protected nav item bounces to `/login`, session effectively lost), reproduced via a **different mechanism**: concurrent `next/link` prefetch requests independently racing the same single-use refresh token across multiple Edge middleware invocations, plus a stale, hand-maintained post-login continuation-route allowlist silently dropping the user's actually-requested destination. Full root-cause analysis and fix: `docs/audits/remediation/release-gate-01-protected-navigation-continuity.md`.
- **Failure B — Project Brain activation showed a fabricated "network_error" for a `viewer`.** The client-side error classifier collapsed every Server Action rejection into a hardcoded "network error" message with no inspection of the actual cause; `viewer` had no explicit permission gate on Project creation while its auto-created PMO was already gated at the database layer, producing an unexplained, generically-classified failure; and Retry was not idempotent. Full root-cause analysis and fix: `docs/audits/remediation/release-gate-01-brain-activation-honesty.md`.

**Corrective branch:** `fix/release-gate-01-navigation-and-brain-activation`, based on `origin/main` at `5777a3df799c874de956ded1f2e100673e60cdcb` (does not reuse or modify the merged `fix/release-gate-01-auth-session-persistence` branch). Both failures are addressed in this one branch — their root causes are independent (see `release-gate-01-brain-activation-honesty.md` §6 for why they were not split into two PRs) but neither depends on the other and each is independently revertable.

**Validation (this sandbox, real local Postgres):** `npm run typecheck` 0 errors; `npm run lint` 0 errors / 614 warnings (baseline, unchanged); `npm run build` success, all routes generated; `npm test` (full suite) **12,909 pass, 0 fail, 0 skipped** (main suite) + **8/8 pass** (module-mocks) — zero skips because this session's sandbox had a usable local Postgres (unlike the environment #562's own validation ran in), so even the PMF-004 concurrency suite ran for real rather than being skipped.

**Not yet done from this sandbox:** live browser/network UAT against a deployed preview (this sandbox cannot reach `pmfreak.com` or a Vercel preview URL directly — same limitation documented in §8/§35 of the original gate run). See the corrective PR's own final report for the required post-deployment checkpoint sequence.

## 39. Final Verdict (Corrective Pass #2)

**RELEASE GATE 01 FAILED — CORRECTIVE PR REQUIRED (superseded by Corrective Pass #2 above; do not treat §37 as current)**

Two new P1 defects were found in post-#562-merge production UAT and are code-complete, automated-validated, and documented on branch `fix/release-gate-01-navigation-and-brain-activation`, but **not yet runtime-verified against a deployed preview**. This gate must be re-run from Checkpoint A once that branch's preview deployment passes the same reproduction sequences (Failure A and Failure B) cleanly, before Prompt 5, 6, or 7 may begin.
