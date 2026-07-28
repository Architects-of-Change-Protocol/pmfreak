# PMF-001 / PMF-002 — Canonical Onboarding Consolidation & Honest Activation

## 1. Backlog items addressed

- `PMF-001` (`docs/audits/pmfreak-post-merge-backlog.json`, P0, `misleading-product-state`) — *"Legacy onboarding wizard fabricates data and bypasses evidence-derived activation."*
- `PMF-002` (P0, `canonical-architecture-contradiction`) — *"Legacy wizard hard-blocks direct Project creation, contradicting ratified IA."*

Both independently re-verified in `docs/audits/pmfreak-remediation-decision-brief.md` §5/§6/§11/§14, which additionally documented a *stronger, undocumented* instance of PMF-002 at the routing layer (`resolve-onboarding-state.ts`/`onboarding-route-map.ts`), not just the legacy wizard's disabled button — that routing-layer instance is fixed here as well, per the decision brief's own corrected implementation boundary (§5, item 12).

Prerequisites verified merged into `origin/main` before this sprint began:
- `PMF-003` (PR #557, merge commit `257ae44733b79c241e8f9981740bca512599ff18`) — execution-task/dependency write authorization.
- `PMF-003B` (PR #558, merge commit `eb1c018...`) — critical-path materialization write authorization.
- `PMF-004` (PR #559, commit `7a8a8d4`) — default PMO/Command Center activation idempotency; remediation record read in full at `docs/audits/remediation/pmf-004-default-pmo-command-center-idempotency.md`.

Starting `origin/main` SHA: `7a8a8d4ccf62954da26a0ae3869c138b937ed9fc` (0 ahead/0 behind at branch creation).

## 2. Ratified onboarding decision

Decision 1 in the decision brief was `PENDING`; this sprint's own ratified instruction (task §1) is exactly what that decision needed, so it was recorded there (and nowhere else in the brief was touched):

> The PR #547 evidence-derived onboarding model is canonical. The legacy wizard is retired as a reachable onboarding system. Project creation must not require prior PMO or Command Center creation. Onboarding progression derives from real persisted state.

## 3. Pre-change onboarding inventory

Two onboarding systems existed, unequally reachable:

| System | Entry point | Reachability | Classification |
|---|---|---|---|
| Legacy wizard (`getting-started-flow.tsx`, PR #504/#522) | `/workspace/setup` | **The actual live gate** for every new/PMO-less user, via `proxy.ts` → `resolveOnboardingStateFromJwt` → `needs_pmo_setup` → `getOnboardingRedirect` | `LEGACY — RETIRE` |
| Evidence-derived engine (`src/lib/workspace-activation/*`, PR #547) | `/workspace-setup` (no slash) + embedded on `/dashboard` | Unreachable pre-onboarding — not in `route-policy-registry.ts`'s lists, and `/dashboard` was itself gated behind the legacy flow | `CANONICAL — KEEP` |

Full per-file inventory:

| File/symbol | Route | Reachable | Creates persisted data | Can seed fake data | Blocks Project creation | Disposition |
|---|---|---|---|---|---|---|
| `src/components/pmfreak/activation/getting-started-flow.tsx` | `/workspace/setup` | Yes (canonical gate) | Yes | Yes (`loadDemo`) | Yes (disabled button + tooltip) | `LEGACY — RETIRE` (removed) |
| `src/app/api/getting-started/route.ts` | `POST /api/getting-started` | Yes (via wizard) | `projects`, `operational_memory`, `user_metadata.onboarding_completed` | Yes (`demoAppend`, `activation-demo` sourceRef) | N/A | `LEGACY — RETIRE` (removed) |
| `src/components/pmfreak/onboarding/ActivationProgress.tsx` | N/A (subcomponent) | Only via wizard | No | No | No | `DEAD CODE — REMOVE AFTER VERIFICATION` (0 other importers, confirmed by grep; removed) |
| `src/components/pmfreak/onboarding/AIActivationTransition.tsx` | N/A (subcomponent) | Only via wizard | No | No | No | `DEAD CODE — REMOVE AFTER VERIFICATION` (0 other importers, confirmed by grep; removed) |
| `src/app/api/onboarding/route.ts` | `POST /api/onboarding` | **Zero callers found anywhere in the codebase** (confirmed by repository-wide grep) | `onboarding_analyses`, `user_metadata.onboarding_completed` | No | N/A | `SUPERSEDED — REMOVE` (removed) |
| `src/lib/auth/resolve-onboarding-state.ts` | N/A (routing authority) | Yes | Reads only | No | **Yes — PMO-before-project gate** | `CANONICAL — MODIFY` (PMO gate removed) |
| `src/lib/auth/onboarding-route-map.ts` | N/A (routing authority) | Yes | No | No | Routed PMO-less users to `/workspace/setup` | `CANONICAL — MODIFY` |
| `src/proxy.ts` | Edge middleware | Yes | No | No | Enforced the JWT-boolean-derived gate on every workspace-core/contextual route | `CANONICAL — MODIFY` (onboarding-state decision removed entirely) |
| `src/app/(protected)/layout.tsx` | Layout | Yes | Reads only | No | No (deferred to proxy previously) | `CANONICAL — MODIFY` (now sole redirect authority) |
| `src/app/(protected)/onboarding/page.tsx` | `/onboarding` | Yes | No | No | No (redirected to legacy route) | `LEGACY — COMPATIBILITY ADAPTER REQUIRED` (now derives destination live) |
| `src/app/(protected)/getting-started/page.tsx` | `/getting-started` | Yes | No | No | No (redirected to legacy route) | `LEGACY — COMPATIBILITY ADAPTER REQUIRED` (now derives destination live) |
| `src/app/(protected)/workspace/setup/page.tsx` | `/workspace/setup` | Yes | No | No | No | `LEGACY — COMPATIBILITY ADAPTER REQUIRED` (now derives destination live) |
| `src/lib/pmo/save-pmo-tenant.ts` | N/A (shared action) | Yes | `workspace_governance`, `pmos` | No | No | `SHARED INFRASTRUCTURE — PRESERVE` (stopped writing `onboarding_completed`) |
| `src/app/signup/actions.ts` | signup form action | Yes | `auth.users.user_metadata` | No | No | `CANONICAL — MODIFY` (stopped writing initial `onboarding_completed: false`, routing switched to DB-derived resolver) |
| `src/app/api/login/route.ts` | `POST /api/login` | Yes | No | No | No | `CANONICAL — MODIFY` (switched from JWT boolean to DB-derived resolver, matching `auth/callback/route.ts`) |
| `src/lib/workspace-activation/*` (4 files) | N/A (canonical engine) | Reachable via `/api/workspace-activation`, `/workspace-setup`, `/dashboard`, Command Center empty/populated states | Reads only (+ display preferences) | No | No | `CANONICAL — KEEP` (unchanged) |
| `src/components/pmfreak/onboarding/workspace-onboarding-panel.tsx` | Embedded | Yes | Display preferences only | No | No | `CANONICAL — KEEP` (unchanged) |
| `src/components/pmfreak/projects/create-project-wizard.tsx` + `save-project-onboarding.ts` | `/projects/new` | Yes | `projects` (real fields only) | No | **No — auto-creates default PMO if none given** | `CANONICAL — KEEP` (unchanged; already correct) |
| `src/lib/projects/create-minimal-project.ts` | `/projects` inline form, JSON API | Yes | `projects` | No | No (same auto-PMO pattern) | `CANONICAL — KEEP` (unchanged) |
| `src/components/pmfreak/tasks/quick-add-task-modal.tsx` + `/api/execution-tasks` | Any "Add task" CTA | Yes | `execution_tasks` (no RAID/recommendation ancestry required) | No | No | `CANONICAL — KEEP` (unchanged; already correct) |
| `src/app/(protected)/command-center/actions.ts` (`activateContextAction`) | Command Center activation | Yes | `pmos` (via PMF-004's `ensureDefaultPmo`), `projects` | No | No | `CANONICAL — KEEP` (unchanged; already flag-free, already reuses PMF-004) |
| `src/app/(protected)/pmo/invite-team/page.tsx` | `/pmo/invite-team` | Yes, as a real optional link (never a forced redirect target — confirmed by grep across `src/lib/auth/*`, `src/proxy.ts`) | `workspace_invitations` | No | No | `SHARED INFRASTRUCTURE — PRESERVE` (unchanged) |
| `src/lib/auth.ts` (`AuthUserContext.onboardingCompleted`) | N/A | Read by 1 dead prop pass-through + `operational-shell.tsx`'s hardcoded `true` | No | No | No | `LEGACY — COMPATIBILITY ADAPTER REQUIRED` (marked `@deprecated`, no longer written to `true` anywhere) |
| `tests/workspace-onboarding-guardrails.test.mjs` | N/A (CI guardrail) | N/A | N/A | N/A | N/A | `CANONICAL — MODIFY` (extended, see §11) |

## 4. Before-state routing matrix

| State | Before | After |
|---|---|---|
| 1. No workspace | `resolveWriteWorkspace`/`ensureUserWorkspace` (PMF-004, already merged) auto-bootstraps atomically before onboarding state is ever read — `no_workspace` was already effectively unreachable in `(protected)/layout.tsx` | Unchanged; `no_workspace` remains a defensive, honestly-handled fallback (`getOnboardingRedirect` → `/projects/new`, never the legacy wizard) |
| 2. Workspace, no PMO, no Project | `resolveOnboardingState` checked `pmos` **before** `projects` → `needs_pmo_setup` → Edge middleware forced `/workspace/setup` (legacy wizard); the wizard's Create Project button was `disabled` with tooltip "Create a Command Center first" | No PMO check anywhere in the resolver → `needs_project` → `/projects/new`, reachable with zero PMOs |
| 3. Workspace + Project, no task | Reachable only after clearing the PMO gate; `execution_started`-style state not separately gated at the routing layer (task creation was never itself blocked — only PMO was) | Unchanged: `active` once a Project exists; task creation is a Command Center/`WorkspaceOnboardingPanel` CTA, never a routing gate |
| 4. Workspace + Project + first task | Reachable once PMO gate cleared | Reachable directly; `deriveActivationStage`/`evaluateActivationRules` (PR #547 engine, unchanged) compute `execution_started` etc. from real evidence |
| 5. Command Center already activated | `resolveOnboardingStateFromJwt` returns `active` only if the JWT `onboarding_completed` claim happens to be `true` — stale after a token refresh gap (PMF-006-adjacent divergence) | `resolveOnboardingState` (DB-derived) is the *only* resolver anywhere in the routing path; reload always re-derives from real `projects` rows, and PMF-004's `ensure_default_pmo` is reused unchanged for the idempotent activation call itself |
| 6. Partial legacy state (flag true, no Project / flag false, real Project) | The stale JWT flag was authoritative at the Edge layer — a `true` flag with no Project would pass the gate; a `false` flag with a real Project would still force the legacy wizard | The flag is never read by any routing decision anywhere; `resolveOnboardingState` derives purely from real `projects` rows every time, so both stale-flag directions converge to the correct state |
| 7. Viewer/restricted role | Unaffected by the PMO gate either way (role enforcement is independent of onboarding-state gating) | Unchanged — `resolveOnboardingState` has no role branching; role/permission enforcement remains entirely in `requireProjectAccess`/`requireWorkspaceMember` et al. (PMF-003/PMF-003B, untouched) |

## 5. Fabricated-state inventory

| Value | Source | Classification | Disposition |
|---|---|---|---|
| `completionScore` (`Math.round(len / 2.4)` on template text length) | `getting-started-flow.tsx:262` | `FABRICATED — VISUAL` | Removed (file deleted) |
| `readinessScore`/`operationalCoherence`/`governanceCompleteness`/`templateCoverage` | `getting-started-flow.tsx:274-293` | `FABRICATED — VISUAL` | Removed (file deleted) |
| Hardcoded domain templates (`stakeholder_intelligence`, `delivery_intelligence`, etc.) persisted as `operational_memory` rows unless edited | `getting-started-flow.tsx:65-108`, `api/getting-started/route.ts:53-60` | `FABRICATED — PERSISTED` (unless the user edited every field before submit) | Removed (both files deleted); see §6 for historical-row handling |
| `demoAppend` fictional "Escalation signal"/"PM fatigue signal"/"Governance gap" rows, `sourceRef: "activation-demo"` | `api/getting-started/route.ts:47-55` | `FABRICATED — PERSISTED` | Removed (file deleted); dead-from-the-UI even before removal (decision brief §5 item 12 — `submit(false)` was the wizard's only call site) |
| `onboarding_completed: true` (JWT flag) | `api/getting-started/route.ts:62`, `save-pmo-tenant.ts`, `api/onboarding/route.ts`, `signup/actions.ts` (initial `false`) | `FABRICATED — PERSISTED` (a boolean presented as authoritative activation proof with no re-derivation) | All write sites removed; field marked `@deprecated` in `AuthUserContext`, never read for routing |
| `AIActivationTransition` staged copy | `AIActivationTransition.tsx` | Not independently audited beyond confirming it had no other callers (out of scope: honest-ai-copy.test.mjs already pinned its banned-string list pre-existing this sprint) | File removed with its only caller |

## 6. Historical persisted fake-data findings

No production/staging database is configured in this sandboxed environment (no `SUPABASE_URL`/`DATABASE_URL` env vars — consistent with every prior remediation sprint in this repository, including PMF-004 §5). No attempt was made to query or delete any row.

**Deterministic signature for a future cleanup proposal**, if one is pursued:
- `operational_memory` rows with `source_ref = 'activation-demo'` are unambiguously the fake demo-seed rows — this signature is 100% reliable and safe to query read-only at any time.
- `operational_memory` rows with `source_ref = 'activation'` are **ambiguous**: they include both the wizard's default hardcoded template text (if a user submitted without editing) and legitimately user-edited real content — these cannot be distinguished from the `source_ref` alone; the row's `text` column would need comparison against the six hardcoded template strings in the (now-deleted) wizard, which is possible only by preserving those strings for future ambiguity-resolution (recorded verbatim in §5 above and in `git log` on the deleted file).
- `auth.users.user_metadata.onboarding_completed` rows: cannot be distinguished from legitimate historical intent vs. fabricated activation proof — no cleanup action is proposed for this field; it is simply no longer read.

No records may have been further modified by users in a way that would resolve this ambiguity (no evidence either way was inspected, per the "no database available" constraint above). Per task rules, this ambiguity is preserved, not guessed at, and no deletion or mutation was executed. The canonical path introduced by this sprint creates zero new `activation-demo` or fabricated-template rows going forward (guarded by `tests/pmf-001-002-canonical-onboarding.test.mjs` and the extended `tests/workspace-onboarding-guardrails.test.mjs`).

## 7. Canonical derived state machine

**Superseded by the correction pass — see §21.** The state machine below is the CURRENT, reconciled version; §21 documents why the original (initial-PR) 4-state version was corrected.

`src/lib/auth/resolve-onboarding-state.ts` (`OnboardingState`) — derived from the exact same evidence source (`collectWorkspaceActivationEvidence`, the PR #547 workspace-activation engine's own evidence collector) as the checklist UI, not a second, independently-queried machine:

| State | Required real entities | Canonical route | `hasWorkspaceAccess` | `isOnboardingComplete` | Next action |
|---|---|---|---|---|---|
| `no_workspace` | None resolvable (defensive; `resolveWriteWorkspace` bootstraps before this is normally read) | `/projects/new` | false | false | Workspace bootstraps transparently as part of project creation |
| `needs_project` | Workspace exists, zero non-archived `projects` rows | `/projects/new` | false | false | Create Project (no PMO precondition) |
| `needs_task` | A real Project exists, zero `execution_tasks` rows, Command Center not active | `/command-center` | true | false | Add first task (honest "Add your first task" state) |
| `execution_started` | A real Project AND a real task exist, Command Center not active | `/command-center` | true | false | Activate Command Center |
| `active` | Command Center is active — a real, PMF-004-backed `pmos` row exists (independent of task existence) | `/command-center` | true | true | Full app; Invite Team as a recommendation; evidence ingestion |
| `trial_blocked` | An expired/revoked trial license | `/trial-inactive` | false | false | Contact sales / renew (unchanged) |

No PMO/Command Center check gates `needs_project`→`needs_task` progression. `resolveOnboardingStateFromJwt` (the boolean-authority shortcut) remains deleted outright — there is exactly one resolver, DB-derived, called from exactly one redirect authority (`(protected)/layout.tsx`).

`hasWorkspaceAccess` and `isOnboardingComplete` are two distinct boolean *views* over this single state — not two competing machines: `hasWorkspaceAccess` gates the persistent route (layout.tsx) and is satisfied by `needs_task`/`execution_started`/`active` alike (ADR-PMF-006: a Project may exist, and general navigation remains open, before Command Center is active); `isOnboardingComplete` is stricter (`active` only) and drives the post-auth landing decision (`resolve-post-auth-destination.ts`), funneling incomplete users toward `/command-center` until Command Center is truly active.

## 8. Production implementation

**One route authority.** `(protected)/layout.tsx` is now the sole place that makes an onboarding-state-based redirect decision. `src/proxy.ts` (Edge middleware) makes none — it retains only authentication gating (`/login?next=`), the `/workspace` legacy-shell quarantine, and a neutral post-auth-route landing for `/login`/`/signup` hits by already-authenticated users. This directly resolves PMF-002's routing-layer instance: previously Edge middleware unconditionally forced any user with a false/stale JWT `onboarding_completed` claim to `/workspace/setup`, *before* the DB-derived resolver (used only in `layout.tsx`) ever ran — two routing authorities that could disagree. There is now exactly one.

**Legacy paths retired.** `getting-started-flow.tsx`, its two private subcomponents (`ActivationProgress.tsx`, `AIActivationTransition.tsx`), `api/getting-started/route.ts`, and the dead `api/onboarding/route.ts` (zero callers) are deleted outright. `/workspace/setup`, `/getting-started`, and `/onboarding` remain registered protected routes (so a bookmarked URL doesn't fall through to `unknown` policy) but now render nothing — each calls `redirectToCanonicalOnboardingDestination()` (`src/lib/auth/legacy-onboarding-redirect.ts`), which resolves the caller's *real, current* onboarding state and redirects there. No hardcoded destination, no possibility of drifting from the live resolver.

**Shared infrastructure preserved.** `src/lib/workspace-activation/*` (evidence-derived engine), `workspace-onboarding-panel.tsx`, `/api/workspace-activation`, `create-project-wizard.tsx`/`save-project-onboarding.ts`/`create-minimal-project.ts` (already PMO-optional, unchanged), `quick-add-task-modal.tsx`/`/api/execution-tasks` (already ancestry-free, unchanged), `command-center/actions.ts`'s `activateContextAction` (already flag-free and already reusing PMF-004's `ensureDefaultPmo`, unchanged), and `/pmo/invite-team` (already a soft link, unchanged) — none of these needed modification; independent verification confirmed they were already correct.

## 9. Legacy paths retired (files removed)

- `src/components/pmfreak/activation/getting-started-flow.tsx`
- `src/components/pmfreak/onboarding/ActivationProgress.tsx`
- `src/components/pmfreak/onboarding/AIActivationTransition.tsx`
- `src/app/api/getting-started/route.ts`
- `src/app/api/onboarding/route.ts`

## 10. Project-first routing

Verified directly (real function invocation, `tests/pmf-001-002-canonical-onboarding.test.mjs`, `tests/resolve-onboarding-state.test.mjs`): a workspace with zero PMOs and zero projects resolves to `needs_project` → `/projects/new`; the same workspace with a real project resolves to `active`, regardless of PMO existence. `CreateProjectWizard`/`saveProjectOnboarding` (unchanged) auto-create a default PMO via `ensureDefaultPmo` only as an internal implementation detail — never a precondition a user must clear first.

## 11. First-task journey

`AddTaskCta` → `QuickAddTaskModal` → `POST /api/execution-tasks` → `createExecutionTaskDirect` (all pre-existing, unchanged) writes the same canonical `execution_tasks` row the RAID→Recommendation→Task-Draft conversion pipeline writes, without requiring that chain. Confirmed no RAID/recommendation/task-draft ancestry is required by direct creation.

## 12. PMF-004 activation reuse

`activateContextAction` (`command-center/actions.ts`, unchanged by this sprint) calls `ensureDefaultPmo`, which is PMF-004's advisory-lock-guarded `ensure_default_pmo` RPC. No new activation operation was introduced. Verified by source inspection and by the passing PMF-004 regression suite (`tests/pmf-004-*.test.mjs`, unaffected by this sprint's changes — re-run in §15).

## 13. Invite Team behavior

`/pmo/invite-team` was already never a routing redirect target anywhere in `src/lib/auth/*` or `src/proxy.ts` (confirmed by grep, both before and after this sprint) — it is a real, reachable page linked only as an optional recommendation from the Command Center empty state (`tests/command-center-onboarding-actions.test.mjs`, pre-existing and still green). No change was needed or made.

## 14. Partial-state recovery

Handled entirely by re-derivation: `resolveOnboardingState` reads only real `projects`/`trial_licenses` rows on every request, so a stale `onboarding_completed` flag (true or false, in any direction) cannot produce an incorrect state — it is never consulted. No new migration, no synthesized entities, no duplicate creation.

## 15. Security/tenancy verification

No authorization logic was touched. `requireAuthenticatedUser`/`requireWorkspaceMember`/`requireProjectAccess` and the PMF-003/PMF-003B write-permission fixes are unchanged; the full pre-existing security/tenancy regression suite was re-run and remains green (see §17). `resolveOnboardingState`'s new `getClient` test seam is additive dependency injection only — production callers still get the real service-role client unless a test explicitly overrides it.

## 16. Pre-fix failing-test evidence

`tests/pmf-001-002-canonical-onboarding.test.mjs` was written first, with only a non-behavioral `getClient` DI seam added to `resolveOnboardingState`/`loadPmoTenant` (the PMO-gate defect itself left intact), then run against pre-fix code:

```
npx tsx --test tests/pmf-001-002-canonical-onboarding.test.mjs
# tests 12
# pass 1
# fail 11
```

11/12 failed, proving:
- A PMO-less workspace with a real project resolved to `needs_pmo_setup`, not `active` (test 1).
- A PMO-less, project-less workspace resolved to `needs_pmo_setup`, not `needs_project` (test 2).
- `getOnboardingRedirect` still routed to the legacy wizard (test 3).
- `resolveOnboardingStateFromJwt` (the boolean-authority shortcut) still existed (test 4) and `proxy.ts` still read `onboarding_completed` for routing (test 5).
- `(protected)/layout.tsx` had no `needs_project` redirect branch (test 6).
- The legacy wizard component, its API route, and the retired pages/dead route all still existed and rendered/wrote as before (tests 7–9, 12).
- `save-pmo-tenant.ts`/`signup/actions.ts` still wrote the `onboarding_completed` flag (test 11).

The one passing test (10) confirmed `save-project-onboarding.ts`/`create-minimal-project.ts` were already clean of demo-seeding — correctly not a defect to fix. No failure was an import error, broken fixture, invalid mock, missing dependency, or environment problem: `npm install` was required once (fresh sandbox, `node_modules` absent) and is disclosed as environment setup, not evidence.

## 17. Post-fix validation

| Command | Exit | Result |
|---|---|---|
| `npx tsx --test tests/pmf-001-002-canonical-onboarding.test.mjs` | 0 | 12/12 pass |
| `npx tsx --test tests/resolve-onboarding-state.test.mjs tests/proxy-routing.test.mjs tests/workspace-onboarding-guardrails.test.mjs tests/pmf-001-002-canonical-onboarding.test.mjs` | 0 | 64/64 pass |
| `npx tsx --test tests/workspace-onboarding-guardrails.test.mjs tests/honest-ai-copy.test.mjs` | 0 | 18/18 pass |
| `npx tsx --test tests/auth-redirect-resolution.test.mjs` | 0 | 11/11 pass |
| `npm test` (full suite) | 0 | 12,838/12,838 pass, 17 skipped (pre-existing, unrelated), 0 fail |
| `npm run typecheck` | 0 | 0 errors |
| `npm run lint` | 0 | 0 errors, 614 warnings — identical to the PMF-004 baseline (614); `npx eslint` scoped to every file this sprint changed reports 0 errors, 0 warnings |
| `npm run build` | 0 | Success, all routes generated including `/workspace/setup`, `/getting-started`, `/onboarding`, `/projects/new` |

Ten pre-existing tests initially failed after the production change and were updated (not weakened) because they encoded the *old, defective* architecture as their expected behavior: `tests/auth-redirect-resolution.test.mjs`, `tests/resolve-onboarding-state.test.mjs`, `tests/proxy-routing.test.mjs`, `tests/legacy-shell-quarantine.test.mjs`, `tests/create-pmo-flow.test.mjs`, `tests/workspace-pmo-project-codex-review-2026-07-16.test.mjs`, `tests/workspace-pmo-project-hierarchy.test.mjs`, `tests/honest-ai-copy.test.mjs`. Each update is annotated in-file with why the old assertion was wrong and what real behavior it now pins. No test was deleted without a replacement assertion of equal or greater strength (several were converted from source-text regex to real function invocation against a fake Supabase client — see `resolve-onboarding-state.test.mjs`).

Real function-level invocation (not source-text-only) was used wherever a fake Supabase query client could exercise the actual code path — `resolveOnboardingState`'s PMO-before-project precedence is proven by calling the real function with mocked `pmos`/`projects` responses, not by regex on the source.

## 18. Manual UAT status

**Not executed.** No browser/E2E environment or configured Supabase instance was available in this sandboxed session (consistent with every prior remediation sprint in this repository — PMF-003/PMF-003B/PMF-004 all disclosed the same constraint). The strongest available validation was run instead: real-invocation service-level tests against a fake query client, full static/build/typecheck validation, and the full pre-existing regression suite. The manual UAT checklist below is provided for execution against a preview/staging deployment with a real Supabase instance; none of its steps have been executed by this sprint.

1. Create fresh user/account.
2. Enter protected area — confirm no redirect to `/workspace/setup`.
3. Observe honest empty workspace state (no Project yet).
4. Confirm workspace bootstrap happened automatically (no separate "create workspace" step required).
5. Create Project directly at `/projects/new` without any PMO existing.
6. Reload — confirm Project persists.
7. Add a first real task via "Add task" CTA.
8. Reload — confirm task persists.
9. Observe `execution_started`-consistent state in the Command Center / `WorkspaceOnboardingPanel`.
10. Activate Command Center from the panel/CTA.
11. Confirm activation reuses PMF-004's idempotent path (no duplicate PMO row on retry).
12. Confirm landing inside the activated Command Center, no dead-end, no forced Invite Team redirect.
13. Reload — confirm onboarding does not return / no redirect loop.
14. Confirm no fake evidence, readiness percentage, or seeded activity appears anywhere in the journey.
15. Confirm Invite Team is reachable only as an optional link, never a blocker.
16. Confirm a viewer-role account cannot perform any of the mutating steps above.
17. Visit the bookmarked legacy URLs (`/workspace/setup`, `/getting-started`, `/onboarding`) at each state above — confirm each redirects to the correct current destination, never a dead end or loop.
18. Open two tabs, trigger Command Center activation in both — confirm convergence to one canonical PMO (PMF-004 behavior, unchanged).
19. Simulate a slow/timed-out activation request and retry — confirm safe convergence (PMF-004 behavior, unchanged).

## 19. Residual debt

1. **`AuthUserContext.onboardingCompleted`** (`src/lib/auth.ts`) remains as a field (marked `@deprecated`) because it still has two read sites outside the onboarding-routing path: a dead, unused prop pass-through in `command-center/page.tsx` → `command-center-client.tsx`, and a hardcoded-`true` (already disconnected from the real field) input to `computeCapabilityRevealState` in `operational-shell.tsx`, which drives nav capability-reveal staging — unrelated to onboarding routing and out of this sprint's scope (would be a broader navigation/capability-reveal refactor). Nothing in the routing-critical path reads this field anymore.
2. **PMF-006** (Edge/DB onboarding-state divergence) is substantially addressed as a side effect of this sprint — Edge middleware no longer makes any onboarding-state decision at all, eliminating the divergence class entirely — but PMF-006 itself was not the sprint's target and its backlog item is not being marked resolved here; that determination belongs to whoever next triages the backlog.
3. **Historical fake `operational_memory` rows** (`source_ref = 'activation-demo'` and potentially unedited `source_ref = 'activation'` rows) are not cleaned up — see §6 for the deterministic-signature analysis and why a `source_ref = 'activation'` cleanup cannot be executed safely without further investigation into row content.
4. **No live-Supabase/E2E validation** was performed — see §18.
5. **`src/lib/pmo/load-pmo-tenant.ts`'s new `getClient` DI seam** is now unused in production code (the PMO check that called it was removed from `resolveOnboardingState`) but was left in place as harmless, minimal, reusable test infrastructure rather than reverted — it changes no production behavior (the default path is unchanged) and follows the same pattern already established in `evaluate-workspace-activation.ts`.

## 20. Explicit non-goals (honored)

No Project Brain/evidence-ingestion expansion. No Gmail/Slack/Teams integration. No Portfolio implementation. No Command Center scope redesign. No visual redesign. No broad navigation refactoring. No broad permission/RLS refactoring. No deletion of historical database rows. No new AI functionality. No new fake/demo data. No onboarding analytics. No team-invitation redesign. No modification to the original audit/backlog JSON artifacts. No auto-merge of the resulting PR.

## 21. Correction pass — state authority reconciliation

Product review of PR #560 found the initial implementation, while correctly retiring the legacy wizard and removing the PMO-before-Project gate, did not satisfy the sprint's canonical derived-state-machine requirement: `resolveOnboardingState` modeled only `no_workspace | needs_project | active | trial_blocked` and returned `active` as soon as a single Project existed, prematurely treating onboarding as complete and collapsing "Project exists", "a real task exists", and "Command Center is active" into one state — while `src/lib/workspace-activation/*` (PR #547) separately computed `execution_started` and related evidence-derived stages for display purposes only, never consulted by routing. Two authorities, overlapping semantics.

### 21.1 Reconciliation approach

`resolveOnboardingState` now calls `collectWorkspaceActivationEvidence` (the PR #547 engine's own evidence collector) directly for `projectExists`/`taskExists`/`pmoExists`, rather than running its own separate `projects`/`pmos` queries. This is not a second state machine consulting the same tables independently — it is the identical function call the checklist UI's evidence collection already used, reused verbatim. `evaluate-workspace-activation.ts`/`activation-rules.ts` were **not modified** (zero-risk to the canonical, heavily-tested checklist engine); only `resolveOnboardingState` was changed to depend on them.

The service-role client `resolveOnboardingState` already constructs for its trial-license check is passed through as `collectWorkspaceActivationEvidence`'s `getClient` override (`getClient: async () => supabase`), so evidence collection never falls back to that function's own RLS/cookie-scoped default — this routing authority must be reliable in every calling context, including immediately after a fresh sign-in (§21.3), so it never depends on session-cookie propagation.

`role: "viewer"` is passed to `collectWorkspaceActivationEvidence` as a functionally inert placeholder: verified by reading the function, `role` only flows into `evidence.role` (consumed by per-step `actionAllowed`) and `deriveWorkspaceActivationMode`'s inputs (`ownerType`/`memberCount`/`pendingInviteExists`, not `role`) — `resolveOnboardingState` reads none of that, only `projectExists`/`taskExists`/`pmoExists`.

### 21.2 New state model

`OnboardingState` gained two states, reusing the PR #547 engine's own vocabulary directly rather than inventing new terms: `needs_task` (a real Project, zero real tasks) and `execution_started` (a real Project AND a real task, Command Center not yet active) — the latter name is the exact literal `deriveActivationStage` already returns for this evidence shape. `active` was redefined to require `pmoExists` (a real, PMF-004-backed `pmos` row) — independent of task existence, since `activateContextAction` can create a Project and PMO together without a task ever existing first, and once Command Center is active that is the terminal onboarding state regardless of checklist completeness.

Verified by direct comparison (`tests/pmf-001-002-state-authority-reconciliation.test.mjs`, "resolveOnboardingState and activation-rules.ts agree on which phase a given evidence shape represents"): for identical evidence, `resolveOnboardingState`'s state and `deriveActivationStage`/`deriveActivationSteps`'s stage/step-completion agree.

### 21.3 Two views, one state — not two machines

Two boolean helpers now exist in `onboarding-route-map.ts`, both pure functions of the single `OnboardingState` value, never independently derived:

- **`isOnboardingComplete(state)`** — `true` only for `active` (Command Center active). Drives the post-auth landing decision (`resolve-post-auth-destination.ts`): a freshly authenticated user in `needs_task`/`execution_started` is funneled to `/command-center` (via `getOnboardingRedirect`) rather than an arbitrary requested route, until Command Center is truly active.
- **`hasWorkspaceAccess(state)`** — `true` for every state except `no_workspace`/`needs_project`/`trial_blocked`. Drives `(protected)/layout.tsx`'s persistent route gate: a Project may exist, and a user may freely navigate the rest of the app (`/team`, `/billing`, `/dashboard`, etc.), before Command Center is active — this sprint's ratified rule and ADR-PMF-006 both require this; making the persistent gate as strict as `isOnboardingComplete` would have re-introduced exactly the kind of broad, un-scoped navigation restriction the original sprint explicitly excluded.

`needs_task`, `execution_started` and `active` all resolve to the same `getOnboardingRedirect` destination (`/command-center`) — this is the explicitly-permitted "first-task and activation steps hosted inside /command-center" design (the states remain distinct in the `OnboardingState` value and in `hasWorkspaceAccess`/`isOnboardingComplete`'s differing treatment of them; only the redirect *destination* is shared, matching the route that already hosts the unchanged evidence-derived `WorkspaceOnboardingPanel`/`CommandCenterEmptyState` CTA for both "add first task" and "activate Command Center").

### 21.4 Login/signup session-visibility verification

Investigated per explicit instruction: the initial PR's `signup/actions.ts` and `api/login/route.ts` called `getAuthUser()` (cookie/RLS-backed, via `createSupabaseServerClient()` → `next/headers` `cookies()`) immediately after `supabase.auth.signUp()`/`signInWithPassword()`, to resolve the post-auth destination. This assumed the session cookie set during sign-in/sign-up is visible to a subsequent `cookies()` read within the same Server Action/Route Handler execution — a real, non-obvious assumption about Next.js's per-request cookie-jar semantics.

Rather than attempting to prove that assumption holds (which would require simulating Next.js's internal request-scoped cookie store — not achievable in this Node test environment), the dependency was **eliminated**: both flows now build the identity used for `resolveOnboardingState`/`resolveCanonicalWorkspace` directly from `data.user` — the object `signUp()`/`signInWithPassword()` themselves return, with no cookie read involved. `resolveOnboardingState`'s parameter type was narrowed from the full, cookie-derived `AuthUserContext` to a minimal `OnboardingStateUser = { id: string; email: string | null }` (the only fields it actually reads: `user.id` for queries, `user.email` via `isFounderOrInternalUser`, whose parameter type was narrowed to match). `resolveCanonicalWorkspace` already used the service-role client keyed by `userId`, independent of cookies. Neither function anywhere in this call chain reads `cookies()`.

Verified directly (`tests/pmf-001-002-auth-session-visibility.test.mjs`): (1) neither `signup/actions.ts` nor `api/login/route.ts` imports/calls `getAuthUser()` anymore; (2) real invocation of `resolveOnboardingState` with only `{id, email}` — exactly what a sign-in/sign-up response provides — resolves correctly against a fake, non-cookie-backed client; (3) evidence collection reuses the resolver's own already-constructed client rather than creating a new cookie-backed one.

`src/app/auth/callback/route.ts` (pre-existing, unrelated to this sprint) retains its own `getAuthUser()`-based pattern for the OAuth callback flow — not modified here (out of scope; it predates this sprint and was not the flow flagged for investigation). It shares the same underlying mechanism (Next.js's documented per-request mutable cookie store) that the signup/login redesign no longer needs to rely on. Flagged as residual note in §19, not a regression introduced by this pass.

### 21.5 Preserved work (unchanged by this pass)

Legacy wizard retirement, fake-evidence-route deletion, Project-before-PMO routing, Invite Team optionality, PMF-004 as the sole activation implementation, and the historical-rows-untouched stance — all verified unchanged: no file touched in §8/§9 of this record was modified again in this pass except `resolve-onboarding-state.ts`, `onboarding-route-map.ts`, `(protected)/layout.tsx`, `src/lib/auth.ts` (one function's parameter type narrowed), `src/app/signup/actions.ts`, and `src/app/api/login/route.ts`.

### 21.6 Pre-correction failure evidence

`tests/pmf-001-002-state-authority-reconciliation.test.mjs` was written first and run against PR #560 HEAD (`7d49e394c50120449c12d4d6ac0481b3dda74d5b`) before any correction:

```
npx tsx --test tests/pmf-001-002-state-authority-reconciliation.test.mjs
# tests 1
# pass 0
# fail 1   (module load failure: hasWorkspaceAccess did not exist yet)
```

An isolated, import-failure-free check confirmed the underlying behavioral gap directly: `resolveOnboardingState` with a fake client returning a real Project (no task, no PMO) returned `"active"` — proving the exact state-collapse defect described, independent of the new export's absence.

### 21.7 Post-correction validation

| Command | Exit | Result |
|---|---|---|
| `npx tsx --test tests/pmf-001-002-state-authority-reconciliation.test.mjs tests/pmf-001-002-auth-session-visibility.test.mjs` | 0 | 17/17 pass |
| `npx tsx --test tests/pmf-001-002-canonical-onboarding.test.mjs tests/pmf-001-002-state-authority-reconciliation.test.mjs tests/pmf-001-002-auth-session-visibility.test.mjs tests/resolve-onboarding-state.test.mjs tests/proxy-routing.test.mjs tests/auth-redirect-resolution.test.mjs tests/legacy-shell-quarantine.test.mjs tests/workspace-onboarding-guardrails.test.mjs` (corrected onboarding tests) | 0 | 114/114 pass |
| workspace-activation tests (`*workspace-activation*`, `*workspace-onboarding*`) | 0 | 61/61 pass (engine files unmodified) |
| task-creation tests (`*execution-task*`, excluding dependencies) | 0 | 108/108 pass |
| PMF-004 tests (`pmf-004-default-pmo-command-center-idempotency`, `pmf-004-idempotent-call-sites`) | 0 | 5/5 pass, 17 skipped (pre-existing: no local Postgres in this sandbox, self-disclosed by the PMF-004 record — unrelated to this pass) |
| auth/login/signup tests (`*login*`, `*signup*`) | 0 | 18/18 pass |
| `npm test` (full suite) | 0 | 12,856/12,856 pass, 17 skipped (same pre-existing PMF-004 skips), 0 fail |
| `npm run typecheck` | 0 | 0 errors |
| `npm run lint` | 0 | 0 errors, 614 warnings — identical to baseline; `npx eslint` scoped to every file this pass changed reports 0 errors, 0 warnings |
| `npm run build` | 0 | Success, all routes generated |

Four pre-existing tests (from the initial PR) failed after this correction and were updated because they encoded the *superseded* "active = Project exists" semantics: `tests/pmf-001-002-canonical-onboarding.test.mjs`, `tests/resolve-onboarding-state.test.mjs` (two tests), `tests/legacy-shell-quarantine.test.mjs`. Each update is annotated in-file explaining the corrected semantics; no assertion was weakened — each now pins the stricter, reconciled behavior.

### 21.8 Correction-pass residual debt

- `src/app/auth/callback/route.ts`'s pre-existing `getAuthUser()`-based pattern (§21.4) was not modified — out of the explicit scope ("the new login/signup flow"). It is not proven unsafe; it shares the same documented Next.js mechanism the redesigned flows no longer need to depend on.
- No live-Supabase/E2E validation of the corrected journey was performed — same constraint as §18, unchanged.

## 22. PR #560 Manual UAT and Merge Gate

**Date / UTC timestamp of this pass:** 2026-07-28T20:27:38Z.
**Tester/runtime agent:** Claude Sonnet 5, running as the Claude Code runtime agent in an ephemeral remote-execution container (not a human tester, no browser session).
**Task framing vs. actual repository state — read this before the rest of this section:** this pass was commissioned as a pre-merge UAT/merge-gate task for PR #560, instructed to block merge pending real browser/runtime validation. On establishing baseline (per the task's own §3), **PR #560 was already merged to `main`** (`state: closed`, `merged: true`, `merged_by: vicvalch`, `merged_at: 2026-07-28T20:04:19Z`) before this pass began — the merge decision was made by the repository owner outside this task, prior to any runtime UAT. This was surfaced to the user, who directed this pass to proceed as a **post-merge retroactive validation and evidence report**, not a merge gate (there is no pending merge left to gate). Everything below should be read in that light: findings are follow-up items against `main`, not blockers to a still-open PR.

### 22.1 Baseline

| Item | Value |
|---|---|
| Repository path | `/home/user/pmfreak` |
| Designated working branch | `claude/pmfreak-pr560-onboarding-uat-opz5ef` |
| Branch HEAD at session start | `fd163ba06ed6f98a514ac51a8a079816400f8500` |
| `origin/main` SHA | `fd163ba06ed6f98a514ac51a8a079816400f8500` (identical — the branch sat exactly on `main`'s tip; `git merge-base --is-ancestor` confirmed `main` already contains this commit) |
| PR #560 head SHA (pre-squash) | `ad5919e31c24cc31d33e3c6a789403c2f0d37ab6` |
| PR #560 base SHA | `7a8a8d4ccf62954da26a0ae3869c138b937ed9fc` (#559) |
| PR #560 state | `closed`, `merged: true` (squash-merged into `main` as `fd163ba0`) |
| Worktree status | Clean at session start; no uncommitted or untracked files |
| Ahead/behind vs. `origin/main` | 0 behind, 0 ahead (branch === main tip) |

No branch reset was required (no divergent/stale history to rebase). This document's own edit is the only change made by this pass.

### 22.2 Runtime-environment determination (§4 criteria)

Inspected: `README.md`, `package.json` scripts, `.env.example`/`.env.operational-flow.example`, shell environment, Docker, local Postgres, and the repository for any Playwright/E2E harness.

| Requirement | Status |
|---|---|
| Browser-accessible PMFreak instance | **Unavailable** — no running dev server, no preview/staging URL configured for this session |
| Working signup/login against a real backend | **Unavailable** — no `.env.local`; no `SUPABASE_*` env vars set anywhere in the session shell |
| Real authenticated session | **Unavailable** (no backend to authenticate against) |
| Database persistence (Supabase) | **Unavailable** — no reachable Supabase project; `supabase/` contains only migration SQL, no local Supabase stack running |
| Playwright/E2E browser framework | **Absent from the repository** — no Playwright config, no existing browser E2E suite to run or extend |
| `node_modules` | Not installed at session start (`npm ci` run first; 586 packages installed cleanly) |

**Conclusion: true browser/runtime UAT (Scenarios A–H) is not possible in this environment.** No product behavior was altered to work around this. Per §4/§18, this is treated as `CANONICAL ONBOARDING UAT BLOCKED` for the runtime-journey portion specifically, folded into the overall post-merge verdict below — not as a reason to skip the automated validation that *is* possible.

### 22.3 Automated validation actually performed

One gap was closeable without touching product code: the PR's own reported "17 PMF-004 environment-dependent skips" (`tests/pmf-004-default-pmo-command-center-idempotency.test.mjs`) are real-Postgres concurrency tests for exactly the Command Center activation idempotency guarantee this merge gate is about (`ensure_default_pmo`/`ensure_user_workspace` converging to one row under concurrent/duplicate calls). Postgres 16 was already installed in this container but not running; `service postgresql start` brought it up, and the test file's own documented fallback (`sudo -u postgres psql`, no env vars needed) picked it up with zero configuration changes. This is test infrastructure, not product-behavior modification, and it runs the real SQL functions from `supabase/migrations/20260831000000_pmo_command_center_activation_idempotency.sql` under genuine concurrent transactions — stronger evidence than the mocked/static contract tests, though it is still function-level (real Postgres, no Next.js/Supabase-auth/browser layer) rather than a full browser reproduction of a double-click.

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | 586 packages installed |
| `service postgresql start` (Postgres 16, local, disposable to this container) | 0 | `accepting connections` on 5432 |
| `npx tsx --test tests/pmf-004-default-pmo-command-center-idempotency.test.mjs` (alone, with Postgres running) | 0 | **17/17 pass, 0 skipped** (previously 0 pass / 17 skipped without local Postgres) |
| Targeted onboarding/activation/PMF-004 tests (`pmf-001-002-*`, `resolve-onboarding-state`, `workspace-activation-*`, `workspace-onboarding-*`, `command-center-*`, `pmf-004-*`, `signup-role-escalation`) | 0 | 185/185 run, **168 pass, 0 fail, 17 skipped** on the first pass (before Postgres was started) |
| `npm test` (full suite, Postgres running) | 0 | **12,873/12,873 pass, 0 fail, 0 skipped** (12,856 + the 17 now-unskipped PMF-004 tests — matches the PR's reported baseline exactly, with the disclosed gap now closed) |
| `npm run typecheck` | 0 | 0 errors |
| `npm run lint` | 0 | 0 errors, 614 warnings (identical to the PR's reported baseline) |
| `npm run build` | 0 | Success, all routes generated, including `/command-center`, `/getting-started`, `/onboarding`, `/workspace/setup`, `/workspace-setup`, `/projects/new` (one pre-existing, unrelated Turbopack tracing warning on `next.config.ts` → `degraded-mode.ts`, not part of this PR) |

**Skipped-test analysis:** zero tests were skipped by the end of this pass. The only skip class that existed (the 17 PMF-004 concurrency tests) was resolved by providing the missing Postgres dependency, not by weakening any assertion. No merge-critical behavior remains untested-and-unverified at the automated level.

### 22.4 Source-level confirmation of PR #560's claimed corrections (supporting evidence only — not a UAT substitute)

Static inspection of `main` (not a substitute for runtime verification, but explicitly permitted as supporting evidence per §4) confirmed every item is actually present, not just claimed:

- `src/components/pmfreak/activation/getting-started-flow.tsx`, `src/app/api/getting-started/route.ts`, `src/app/api/onboarding/route.ts` — confirmed deleted.
- `src/lib/auth/legacy-onboarding-redirect.ts` — present.
- `src/lib/auth/resolve-onboarding-state.ts` — confirmed calling `collectWorkspaceActivationEvidence` directly (the PR #547 engine), not a second query path.
- `src/lib/auth/onboarding-route-map.ts` — confirmed exporting both `isOnboardingComplete` and `hasWorkspaceAccess` as distinct views.
- `resolveOnboardingStateFromJwt` — confirmed absent anywhere in `src/`.
- `src/app/signup/actions.ts` and `src/app/api/login/route.ts` — confirmed building identity from `data.user` (the sign-up/sign-in response), no `getAuthUser()` call in either file.

### 22.5 Scenario-by-scenario disposition (§6–§13)

Every lettered scenario (A: new authenticated user, B: workspace bootstrap, C: Project-first creation, D: first execution task, E: Command Center activation, F: legacy routes/flags, G: partial-state recovery, H: honest zero states) requires a live browser session against a real, persisted backend. None could be executed — see §22.2. No UAT run identifier, disposable identity, or disposable workspace/Project/task was created, because no environment existed to create them in. No screenshots or traces exist. No before/after row-count matrix exists (no live database was touched by a UAT journey; the only database activity this pass performed was the ephemeral, self-cleaning PMF-004 test-suite databases created and dropped by the test file's own `test.after` hook — confirmed no `pmf004_test_*` databases remain: `sudo -u postgres psql -l` after the run shows none). This is the one part of the task genuinely blocked by environment, not by anything this pass could have done differently.

Authorization/isolation smoke check (§15): the existing regression suite already includes onboarding-adjacent authorization tests (e.g. "workspaceId manipulated to a workspace the actor does not belong to fails closed", "activation API verifies membership server-side and never trusts workspaceId input", evidence-probe workspace-scoping tests) — all passing as part of the 12,873. These are service/unit-level, not a live two-account browser cross-tenant check; no new authorization defect was found or demonstrated, so no narrow fix was in scope.

### 22.6 Defects found

**None** — at the level this pass could actually verify (automated tests, typecheck, lint, build, source inspection). No P0, P1, P2, or P3 defect was identified or demonstrated. No code changes were made to product source; the only repository change from this pass is this document.

### 22.7 Residual debt / open risk

1. **No browser/E2E validation of the canonical journey has ever been performed for PR #560** — not at initial implementation, not at the correction pass, not at this post-merge pass. This is now merged to `main` without that validation ever having occurred. This is the single most material residual risk from this entire remediation.
2. Everything listed in §19 and §21.8 remains unchanged and still applies (deprecated `onboardingCompleted` field, PMF-006 not formally closed, historical fake `operational_memory` rows not cleaned up, `auth/callback/route.ts` not modified).
3. The PMF-004 idempotency gap is now closed at the **database-function level** (real Postgres, real migration SQL, real concurrent transactions) but still not at the full-stack browser level (Next.js server action → Supabase auth → Postgres → UI feedback). A future pass with a real Supabase/staging environment should still execute the browser-level Scenario E (double-click activation, network retry) at least once before this is considered fully closed.
4. The local Postgres 16 instance started in this container for test purposes is disposable to this ephemeral session and was used only for the repository's own test suite (creating/dropping short-lived `pmf004_test_*` databases) — no product/customer data exists in or touched this instance.

### 22.8 Cleanup status

No disposable UAT entities (user, workspace, Project, task) were created — none of Scenarios A–H executed. No cleanup is owed. The ephemeral Postgres test databases created by the PMF-004 suite were dropped automatically by the test file's own teardown; verified none remain.

### 22.9 Final disposition

PR #560 is already merged; there is no pending merge for this pass to gate. Every automated validation this environment can run is green, including the one previously-disclosed gap (17 PMF-004 skips), now fully closed. No defect was found or demonstrated by any means available in this session. The one requirement this task could not satisfy is the one it explicitly says must not be faked or waived: an actual browser/runtime walk of the canonical journey. That has still never happened for this feature, across every sprint of this remediation.

**CANONICAL ONBOARDING UAT BLOCKED — RUNTIME ENVIRONMENT REQUIRED** (for the browser/runtime-journey portion specifically; all automated validation available in this environment passed with 0 failures and 0 skips, and is documented above as a post-merge finding, not a merge gate, since PR #560 was already merged prior to this pass).
