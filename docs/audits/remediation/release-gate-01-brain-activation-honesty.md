# Release Gate 01 — Corrective Hotfix #3: Project Brain Activation False "network_error"

**Severity:** P1 (production defect: activation failures are misclassified to the user, masking the real cause; a `viewer` role can partially proceed through a mutation path it is not authorized to complete).
**Scope:** `src/lib/projects/save-project-onboarding.ts`, `src/lib/projects/project-brain-authorization.ts` (new), `src/components/pmfreak/projects/create-project-wizard.tsx`, `src/app/(protected)/projects/new/page.tsx`, `supabase/migrations/20260901000000_project_onboarding_create_correlation_idempotency.sql` (new).
**Branch:** `fix/release-gate-01-navigation-and-brain-activation` (same branch as the navigation-continuity fix — see §6 for why these were kept in one branch despite having independent root causes).
**Discovered during:** Post-PR-#562 production UAT — a `viewer`-role user completing the New Project wizard and clicking "Activate Brain" saw *"Project Brain activation failed — A network error occurred... RECOVERABLE / network_error"*.

---

## 1. Executive Summary

The reported `network_error` classification was **not trustworthy** — it was the client's catch-all label for *any* rejection of the wizard's Server Action call, with zero inspection of what was actually thrown. Investigation found three independent, real defects behind the single reported symptom, none of which are a genuine network/transport failure:

1. **Client-side error-classification bug.** `create-project-wizard.tsx`'s `handleActivate` wrapped `saveProjectOnboarding(...)` in a bare `catch` that unconditionally set the error message to *"A network error occurred"* / `failureDetail: "network_error"` for **any** rejection — a real offline/DNS failure and an expired session mid-wizard (which middleware intercepts with a redirect the Server Action runtime cannot parse, producing a thrown, non-network rejection) were indistinguishable to the user.
2. **Missing, inconsistent authorization boundary.** `saveProjectOnboarding` had **no role/permission gate on Project creation at all** — any authenticated workspace member, including `viewer`, could reach the `projects` insert. But the PMO a brand-new project auto-creates (`ensureDefaultPmo`) **was already** gated to `owner`/`admin`/`pm` at the database layer (the `"workspace managers can manage pmos"` RLS policy, `supabase/migrations/20260828000001_workspace_pmo_project_hierarchy.sql`). A `viewer` creating the first project in a PMO-less workspace passed the (ungated) project-creation path and then hit an **unexplained RLS rejection** creating the PMO underneath it — a real, demonstrable permission denial, flattened by the outer catch-all into the generic `unexpected_exception` bucket, never labeled as a permission problem, and (per defect #1) capable of surfacing to the user as a fabricated "network error" depending on exactly where in the Server Action transport the failure manifested.
3. **Non-idempotent retry.** Nothing tied a retried submission back to the wizard's own `correlationId` (generated once per mount, unchanged across Retry clicks). If a first attempt actually committed server-side but the client never received/processed the confirmation, Retry performed a fresh, independent insert — a duplicate Project (and duplicate governance brief).

A fourth, smaller honesty gap was found and fixed along the way: the downstream-failure rollback path always told the user *"the project has been removed"*, even when the compensating delete itself failed.

---

## 2. Investigation

Traced the real production entry points end to end: UI → `handleActivate` → Server Action (`saveProjectOnboarding`) → auth → workspace resolution → PMO resolution → project insert → downstream ingestion/brief generation → response → client error mapping.

- **Client entry point** (`create-project-wizard.tsx`): `handleActivate` calls `saveProjectOnboarding(payload, correlationId, { pmoId })` as a plain Next.js Server Action invocation — there is no application-authored `fetch()`, no URL, no HTTP status code in this flow. The **only** error classification for the entire flow was the blanket `catch` described above.
- **Server-side handler** (`save-project-onboarding.ts`): auth check (`getAuthUser`) → payload validation → plan-quota check (`canCreateMoreProjects`, billing-only, role-independent) → `resolveWriteWorkspace` (also returns the caller's real `workspace_memberships.role`) → PMO resolution (`getPmoById` for an explicit PMO, else `ensureDefaultPmo`) → `projects` insert → best-effort context ingestion/brief generation. Every branch already returned a typed, three-state result (`success` / `recoverable_failure` / `fatal_failure` with a `failureClass` string) — **none of which** ever reaches the client as a thrown rejection under normal operation. For the wizard's blanket `catch` to fire at all, the failure has to happen **outside** this function, at the Server Action transport layer itself (most plausibly: the session expired mid-wizard, and `src/proxy.ts`'s protected-route gate intercepted the action's POST with a 307 redirect to `/login` instead of the expected action-result payload, which the Next.js action client cannot parse and rejects).
- **Authorization reality (pre-fix):** `projects`' own RLS policy (`"users can insert own projects"`) is role-agnostic — any authenticated member passes. `ensureDefaultPmo`'s underlying RPC is deliberately plain invoker-rights (not `SECURITY DEFINER`), so the workspace's `"workspace managers can manage pmos"` policy (`owner`/`admin`/`pm` only) genuinely governs it. A `viewer` creating a project in a workspace with zero existing PMOs would have the PMO insert denied by Postgres RLS (`insufficient_privilege`), thrown from `ensureDefaultPmo`, caught by `save-project-onboarding.ts`'s outer `catch` **before** `insertedProjectId` was ever set (the PMO resolution happens before the project insert) — routed to the generic `unexpected_exception` branch, message *"An unexpected error occurred. Please try again."*

---

## 3. Correction

### 3a. Honest client-side error classification

`handleActivate`'s catch block now inspects what was actually thrown instead of assuming network failure for everything:

```ts
const isGenuineNetworkFailure = err instanceof TypeError;
```

A real `TypeError` (`"Failed to fetch"` and equivalents) is the only case still honestly labeled `network_error`. Anything else is labeled `action_transport_error` with a message that does not claim a network problem: *"We couldn't confirm this action completed. This can happen if your session expired or the request was interrupted... please check you're still signed in, then try again."* This does not claim to fully diagnose the cause (the app genuinely cannot, from this vantage point, tell an expired session from other transport-layer interruptions) — it stops asserting a specific, wrong cause instead.

### 3b. Consistent, upfront authorization boundary

New `src/lib/projects/project-brain-authorization.ts`: `canActivateProjectBrain(role)` — `true` for `owner`/`admin`/`pm`, `false` for `viewer`/`null`/`undefined`. Deliberately mirrors the same DB-level RLS boundary `ensureDefaultPmo` was already subject to, so the two authorization boundaries (project creation and its auto-created PMO) can no longer disagree.

`save-project-onboarding.ts` now checks this **immediately after** resolving the caller's real workspace role (`resolveWriteWorkspace`) and **before** any PMO or project mutation is attempted:

- Denied callers get a distinct `fatal_failure` / `failureClass: "insufficient_permissions"` result, with an honest message ("Your workspace role does not have permission to create projects or activate a Project Brain...") — not a generic error, not a fabricated network error, and no `projectId` (no partial-success signal).
- Zero mutations are attempted for a denied caller — no PMO row, no project row, nothing to roll back. This is a strictly stronger guarantee than the pre-fix behavior, which could reach a real (rejected) PMO-creation RPC call before failing.
- Session is untouched — this is a pure authorization decision, not an authentication one; no logout, no cookie mutation, no redirect.

**UI courtesy (not the security boundary — the server check above is):** `src/app/(protected)/projects/new/page.tsx` resolves the caller's real role via `assertRuntimeAuthContinuity()` (the same request-memoized call `(protected)/layout.tsx` already made — see the companion navigation-continuity remediation record for why this reuses rather than duplicates that call) plus `resolveWriteWorkspace`, and passes `canActivateBrain` down to `CreateProjectWizard`. When `false`, `StepBrainActivation` renders a permission-denied explanation instead of the actionable form — a `viewer` never sees a button that the server will always reject. `handleActivate` also refuses to submit when `canActivateBrain` is false, even if invoked directly, as defense in depth alongside the UI gate.

### 3c. Idempotent retry

New migration `20260901000000_project_onboarding_create_correlation_idempotency.sql`: adds a nullable `projects.create_correlation_id` column and a unique index on `(workspace_id, create_correlation_id)` (partial, excludes nulls — existing rows unaffected). `save-project-onboarding.ts` now writes the wizard's `correlationId` on insert. On a unique-violation (Postgres `23505`) — meaning a prior attempt with this exact correlation id already committed — the function looks up and returns that existing project as a `success` result instead of erroring or inserting a duplicate. The database itself is the idempotency boundary (consistent with the existing `ensure_default_pmo`/`ensure_user_workspace` advisory-lock pattern for the same class of check-then-insert race), not application-level check-then-insert.

This also fixes a side effect of the pre-existing rollback logic: if the compensating delete after a downstream failure itself fails, the project row survives with its `create_correlation_id` intact — a subsequent Retry now correctly resolves to that same real row via the idempotency path, instead of erroring again or duplicating it.

### 3d. Rollback-failure honesty

The downstream-failure rollback branch now tracks whether the compensating delete actually succeeded (`rollbackSucceeded`) and only claims *"the project has been removed"* when it did. When the delete itself fails, the message instead says the retry will resume the same project rather than duplicate it — true given 3c's idempotency fix.

---

## 4. Tests

New file: `tests/release-gate-01-brain-activation-honesty.test.mjs`:

- `canActivateProjectBrain` — real invocation: denies `viewer`/`null`/`undefined`, allows `owner`/`admin`/`pm`.
- `saveProjectOnboarding` checks permission before any PMO/project mutation (source-level call-order assertion, matching this file's established static-analysis test convention — see `tests/create-project-brain.test.mjs`, `tests/create-project-flow.test.mjs`).
- The permission-denial result is a distinct `fatal_failure`/`insufficient_permissions`, carries no `projectId`.
- Rollback-failure path no longer unconditionally claims success.
- Migration adds the correlation-id column and unique index; `saveProjectOnboarding` writes it and handles the unique-violation replay path, returning the pre-existing project rather than a fresh insert.
- Wizard's catch block distinguishes `err instanceof TypeError` from everything else; no longer hardcodes `network_error`.
- `StepBrainActivation` renders a permission-denied state (not the actionable form) when `canActivateBrain` is false; `handleActivate` refuses to submit in that case.
- `page.tsx` resolves the role via the request-memoized `assertRuntimeAuthContinuity()` and passes `canActivateBrain` down, without a second independent `getAuthUser()`/`requireAuthUser()` call.

## 5. Validation

| Command | Result |
|---|---|
| `npx tsx --test tests/release-gate-01-brain-activation-honesty.test.mjs` | 16/16 pass |
| `npx tsx --test tests/create-project-brain.test.mjs tests/create-project-flow.test.mjs tests/workspace-pmo-project-hierarchy.test.mjs` (pre-existing contract suites, unaffected) | all pass |
| `npm test` (full suite, real local Postgres) | **12,909 pass, 0 fail, 0 skipped** (main suite) + **8/8 pass** (module-mocks) |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 614 warnings (baseline) |
| `npm run build` | Success, all routes generated |

Migration: additive/nullable only, no backfill required, no impact on existing rows.

## 6. Why This Stayed in the Same Branch as the Navigation-Continuity Fix

Failures A and B were investigated independently (see the companion `release-gate-01-protected-navigation-continuity.md`) and have **materially independent root causes** — a middleware/prefetch concurrency race vs. a client error-classification bug + a missing authorization boundary + non-idempotent retry. They do not share code, and neither fix depends on the other. They were kept in one branch/PR because both are corrections to the same Release Gate 01 corrective cycle, both were required before the gate could resume, and combined validation (one full-suite run, one build, one preview) is more efficient than two nearly-identical PRs; if the reviewer prefers a split, this record and the navigation-continuity record are already written as independently revertable units (disjoint file sets, `git revert` of either leaves the other intact).

## 7. Residual Debt

1. **No live browser/network evidence yet** for the exact "Activate Brain" request/response (§6 of the task's evidence requirements — request URL/method/status, `Set-Cookie` presence, single-vs-duplicate request). This sandbox cannot reach a deployed preview directly. Required before this record can be marked runtime-verified.
2. **The precise HTTP-adjacent mechanism behind the original production `network_error` report is still not independently confirmed** — this record fixes the classification bug (any rejection ≠ "network error") and the two most plausible real causes found (session-expiry-mid-wizard, viewer/PMO permission denial), but does not have direct evidence of which one fired for the specific reported incident. Both are now honestly distinguishable from a genuine transport failure going forward, which is the actionable fix regardless of which one it was.
3. `ingestProjectSetupContext` (called after the project insert, before brief generation) is still not individually try/catch-guarded — a failure there still routes through the outer catch's rollback path, which is now honest about its outcome (3d) but does not by itself reduce how often that path is hit. Out of scope for this narrowly-focused hotfix; flagged for a future, separate pass if it proves to be a meaningful source of rollback attempts in production telemetry.
