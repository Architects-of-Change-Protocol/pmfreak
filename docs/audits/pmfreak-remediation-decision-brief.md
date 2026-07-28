# PMFreak Remediation Decision Brief — Independent P0 Verification

**Prepared:** 2026-07-28
**Scope:** Independent verification of `docs/audits/pmfreak-post-merge-critical-path-audit.md` (audit date 2026-07-27) and `docs/audits/pmfreak-post-merge-backlog.json`, plus the five product-owner decisions required to unblock remediation.
**Method:** Read-only repository inspection, git archaeology, static code tracing with file:line citations, and direct spot-checks of the highest-stakes cited files. No application code, tests, migrations, or configuration were modified. No database was queried (none was configured in this environment).
**Relationship to the audit:** This document treats the audit as a hypothesis to be independently re-derived, not as proof of its own conclusions. Six independent research passes were run blind against the live codebase — covering onboarding/activation, execution-task authorization, PMO cardinality, Project Brain honesty, Portfolio/Command Center scope, and the test-suite blind spot — before the audit artifacts were located and read. The findings below cross-check that independent research against the audit's exact backlog IDs.

---

## 1. Executive Summary

Independent verification **confirms all five P0 findings** in `pmfreak-post-merge-backlog.json` (PMF-001 through PMF-005) with high confidence, using file:line evidence gathered independently of the audit's own citations. In three cases the independent investigation goes further than the audit and surfaces a **stronger or additional** instance of the same defect class:

- **PMF-002** (legacy wizard blocks direct Project creation): the audit cites only the wizard's disabled button. Independent tracing found the *routing layer itself* (`resolve-onboarding-state.ts` + `onboarding-route-map.ts`) enforces the same precondition architecturally, before a user's browser ever renders the button — a more binding violation of ADR-PMF-006 Rule 11 than the audit documents, and one ADR-PMF-006 itself does not name.
- **PMF-003** (read-gates-write authorization): the audit's own evidence list cites `src/lib/security/rbac.ts`'s `executive_viewer`/`external_stakeholder` roles as the exploitable actors. Independent verification found that role taxonomy is **dead code**, never consulted by the live authorization path (confirmed by both this investigation and a prior first-party review, `artifacts/independent-final-review-2026-07-16/defects.md:8`). The **actually live, DB-default, production-assignable** role is `"viewer"` (`src/lib/workspace-access.ts:4-5`), which is invitable today via `/team` UI. This resolves the audit's own Unknown #4 (§22 item 4): view-only roles **are** actively assignable in production, not merely latent — the vulnerability is real and currently exploitable, not hypothetical.
- **PMF-004** (pmos duplicate-PMO race): independent verification confirms the exact race and additionally found a **second, structurally identical, unguarded check-then-insert race** in workspace bootstrap itself (`ensureUserWorkspace`, `src/lib/workspaces.ts:77-106`), which can duplicate a user's *workspace* root under concurrent first-login page loads — broader than PMF-004's stated `pmos`-only scope and only partially captured by PMF-007.
- **PMF-005** (Project Brain overclaim): confirmed exactly, plus a **citation error in the backlog itself** — `affectedAreas` cites `src/components/pmfreak/project-brain/project-brain-online-hero.tsx`, but the file actually lives at `src/components/pmfreak/intelligence-inbox/project-brain-online-hero.tsx` (content and line numbers 13/18-20 are otherwise exactly correct). Also found: the project's own honesty-guardrail test (`tests/project-brain-foundation-integration.test.mjs:182-206`) checks two *different* files with an under-broad regex, and never reads the actual offending file — a concrete, named test-suite blind spot.
- **PMF-001** confirmed with one softening nuance: the `loadDemo` fictional-project-seeding branch in `/api/getting-started` appears unreachable from the current wizard UI (no live call site found with `loadDemo:true`) — the endpoint still honors it if called directly, so the defect stands, but "actively seeding fake projects for real users today" should be stated as "reachable via direct API call, not via the current UI" rather than as an everyday occurrence.

No P0 was found to be **NOT REPRODUCIBLE**, **ALREADY FIXED BY LATER COMMIT**, or fully **BLOCKED FROM VERIFICATION** — all five are **CONFIRMED**, with the specific caveats above and additional caveats noted per-item in §5.

A significant fact independent of the P0s themselves: the two audit artifacts, believed missing at the start of this verification, were confirmed to exist on branch `claude/pmfreak-audit-backlog-lhlaae` (commit `2f5d6be`) and are now **also merged into `origin/main`** as commit `004eb3fb` (PR #555) — byte-identical content, confirmed by direct diff. This decision brief is branched from current `origin/main`, which is the canonical, up-to-date location containing the audit.

---

## 2. Repository Baseline

| Fact | Value |
|---|---|
| Repository path | `/home/user/pmfreak` |
| Prior working branch (this verification session) | `claude/pmfreak-p0-verification-mdoyha` |
| This document's branch | `docs/pmfreak-remediation-decision-brief`, created from `origin/main` |
| `origin/main` HEAD at branch creation | `004eb3fb5adaf818cbcccfeddf50d965aa0f466f` |
| Audit branch `claude/pmfreak-audit-backlog-lhlaae` HEAD | `2f5d6be089d091264457cc2ffda2851c197c964f` |
| Audit branch base / merge-base with main | `7aac1a52e96fe9ecc1ec96faf5b184e36aecc9e9` (identical content to `origin/main`'s prior tip) |
| Working tree | Clean at every checkpoint (`git status`: nothing to commit) |
| Both audit artifacts exist | Yes — on `origin/claude/pmfreak-audit-backlog-lhlaae` (commit `2f5d6be`) **and** on `origin/main` (commit `004eb3fb`, PR #555, squash-merged), byte-identical |
| Commit introducing the artifacts | `2f5d6be` (branch) / `004eb3fb` (main, via PR #555) |
| Already merged into `main`? | **Yes**, as of `004eb3fb` |

**Verification narrative:** At session start, an exhaustive search (`git log --all`, all local/remote branches, full-disk `find`) found **no trace** of either audit artifact anywhere in the repository. Six independent research agents were dispatched to investigate the underlying product claims directly against the live codebase in the meantime. Mid-session, new instructions arrived identifying the audit's actual location (branch `claude/pmfreak-audit-backlog-lhlaae`, commit `2f5d6be`). This was independently verified via `git fetch origin --prune`, `git ls-remote --heads`, and `git show <ref>:<path>` for both files — not taken on faith. That verification also revealed `origin/main` had advanced (via PR #555) to include the identical content, confirmed by direct `diff` of both artifact copies. This branch is created from `origin/main` rather than the older feature branch because main is now the more current, canonical location of the same content.

---

## 3. Audit Artifact Reconciliation

- **Markdown audit:** `docs/audits/pmfreak-post-merge-critical-path-audit.md`, dated 2026-07-27, scope PRs #530–#553, 23 sections, verdict `PMFREAK CRITICAL PATH PARTIAL — REMEDIATION BACKLOG READY`.
- **Backlog JSON:** `docs/audits/pmfreak-post-merge-backlog.json`, `headSha: 7aac1a52e96fe9ecc1ec96faf5b184e36aecc9e9`, 25 items total (5×P0, 10×P1, 8×P2, 2×P3) — matches the markdown's own summary table in §17 exactly, item-for-item.
- **Self-reported audit method:** the audit states it ran `npm ci` → `typecheck` → `lint` → `build` → `npm test`, all green, **12,793/12,793 tests passing in 89.5s** (§13). This is the audit's own fresh run against `7aac1a5`, not a stale historical figure — distinct from an older, unrelated in-repo audit (`docs/audit/pmfreak-integrated-audit/`) whose own test run (dated earlier, different scope) reported a 240s timeout at ~6,067 subtests. The two numbers describe different runs at different times; there is no direct contradiction, but the current audit's number was not independently re-executed in full during this verification (see §12).
- **Qualifications not fully carried into the JSON:** the markdown's §22 "Unknowns Requiring Product Decision" (5 items) and its Contradiction Register (§4, 7 items) contain nuance the JSON's flat `dependencies`/`nonGoals` fields only partially capture — notably Unknown #4 (whether view-only roles are actually assignable) and Unknown #5 (PMO cardinality), both addressed in §7–8 below with materially new information the audit did not have.

---

## 4. P0 Inventory (verbatim from `pmfreak-post-merge-backlog.json`)

| ID | Title | Category | Confidence (audit) | Recommended Sprint |
|---|---|---|---|---|
| **PMF-001** | Legacy onboarding wizard fabricates data and bypasses evidence-derived activation | misleading-product-state | high | 1 |
| **PMF-002** | Legacy wizard hard-blocks direct Project creation, contradicting ratified IA | canonical-architecture-contradiction | high | 1 |
| **PMF-003** | Execution-task/dependency mutation endpoints authorize on 'read' not 'write' | security-authorization | high | 3 |
| **PMF-004** | `pmos` table lacks unique constraint on `workspace_id` — duplicate-PMO race condition | data-integrity | high | 2 |
| **PMF-005** | 'Project Brain Online'/'smarter' claim renders at zero-evidence state | misleading-product-state | high | 4 |

Exactly 5 P0 items exist in the JSON, matching the audit's own stated count (§1, §17). **No discrepancy in P0 count.** §10 below confirms no additional item requires P0-equivalent treatment.

---

## 5. Independent P0 Verification Matrix

### PMF-001 — Legacy onboarding wizard fabricates data and bypasses evidence-derived activation

1. **Audit's claim:** `getting-started-flow.tsx` computes fabricated readiness/completion scores, persists hardcoded fake evidence templates as real `operational_memory` rows, has a demo-seeding branch, and writes the forbidden `onboarding_completed` boolean — and is the actual live gate every new user reaches.
2. **Current code path:** `GET /workspace/setup` → `WorkspaceSetupPage` (`src/app/(protected)/workspace/setup/page.tsx:1-9`) → `GettingStartedFlow` (`src/components/pmfreak/activation/getting-started-flow.tsx`).
3. **Entry point:** every new/PMO-less user, forced by `src/proxy.ts:65-95` (Edge middleware) and `src/lib/auth/onboarding-route-map.ts:8-19` (both `"no_workspace"` and `"needs_pmo_setup"` map to `/workspace/setup`).
4. **Authorization boundary:** N/A (own-account onboarding, no cross-tenant surface).
5. **Persistence boundary:** `POST /api/getting-started` (`src/app/api/getting-started/route.ts`) — inserts a `projects` row, `saveOperationalMemory` rows (`sourceRef: "activation"` or `"activation-demo"`), and calls `supabase.auth.updateUser({ onboarding_completed: true })` (line 62).
6. **User-visible consequence:** a brand-new user sees a fabricated "readiness"/"operational coherence"/"governance completeness" percentage (`getting-started-flow.tsx:274-293`) computed from `Math.round(templateText.length / 2.4)` (line ~262) rather than any real signal, and — unless every template field is hand-edited — template evidence is persisted into the same `operational_memory` store real evidence uses, indistinguishable in the UI.
7. **Files/symbols inspected:** `getting-started-flow.tsx` (readiness `useMemo`, `completion` scoring, `submit()`), `api/getting-started/route.ts` (`ensureDefaultPmo`, `saveOperationalMemory`, `onboarding_completed` write), `src/lib/auth/onboarding-route-map.ts`, `src/proxy.ts`, `tests/workspace-onboarding-guardrails.test.mjs`.
8. **Tests currently covering the path:** `tests/workspace-onboarding-guardrails.test.mjs` — confirmed to scan only the PR #547 surface (`src/lib/workspace-activation/*`, `workspace-onboarding-panel.tsx`), not `getting-started-flow.tsx` or `api/getting-started/route.ts` at all.
9. **Missing tests:** a guardrail scanning the *actual* canonical entry point; an integration test asserting a fresh account's `operational_memory` contains zero rows until real evidence is submitted (exactly what the backlog's `requiredTests` field specifies).
10. **Independent severity assessment:** confirms the audit's P0 rating — the readiness fabrication is entirely client-only and never sent to the server (verified: the `submit()` POST body at line ~306 contains only `{form, templates, loadDemo}`, no score fields), so it cannot corrupt persisted state, but it **is** shown to every new user as if real, satisfying the "misleading-product-state" category directly.
11. **Confidence:** High. Every cited line was independently re-derived, not merely re-read from the audit.
12. **Nuance not in the audit:** the `loadDemo` demo-seeding branch (`route.ts:30-33,47-51,55`) has no reachable call site in the current wizard UI (`getting-started-flow.tsx`'s only submit call is `submit(false)`, line ~660) — it is dead-from-the-UI but live-from-the-API. This softens "currentBehavior" slightly (not an everyday occurrence for real users) without changing the verdict, since the readiness fabrication and the persisted `onboarding_completed` flag are independently, unconditionally live regardless of the demo branch.
13. **Final verification verdict: CONFIRMED.**

### PMF-002 — Legacy wizard hard-blocks direct Project creation, contradicting ratified IA

1. **Audit's claim:** the wizard's "Create Project" button is disabled until "Create Command Center" is done (`getting-started-flow.tsx:359-370`), contradicting ADR-PMF-006 Rule 11.
2. **Current code path:** UI layer — `getting-started-flow.tsx` Step 0 (lines 338-386; disabled button + tooltip now at **lines 361-372**, a ~2-line drift from the audit's cited 359-370, same content). **Routing layer** (not cited by the audit or by ADR-PMF-006 itself) — `resolveOnboardingState` (`src/lib/auth/resolve-onboarding-state.ts:83-105`) returns `"needs_pmo_setup"` (blocking) *before* ever checking for project existence; `onboarding-route-map.ts:8-19` routes both `"no_workspace"` and `"needs_pmo_setup"` to `/workspace/setup`, and only `"needs_project"` (i.e., PMO already exists) reaches `/projects/new`.
3. **Entry point:** same as PMF-001.
4. **Authorization boundary:** N/A.
5. **Persistence boundary:** N/A directly (this is a gating/routing defect, not a data-integrity one).
6. **User-visible consequence:** a brand-new user cannot create a Project without first completing PMO/Command-Center creation — via *either* the disabled button *or* the fact that the only reachable pre-PMO route is `/workspace/setup` itself.
7. **Files/symbols inspected:** `getting-started-flow.tsx:338-386`, `resolve-onboarding-state.ts:83-105`, `onboarding-route-map.ts:8-19`, `src/lib/projects/create-minimal-project.ts:99-117` (`createMinimalProject`, which itself auto-creates a PMO if none is passed — the *service layer* does **not** require a PMO, only the *routing/UI layer* does), `docs/adr/ADR-PMF-006-project-execution-aggregate.md` (Rule 11, lines 87-91; Rule 12, lines 92-95).
8. **Tests currently covering the path:** none found asserting a fresh, zero-PMO workspace can create a project through the onboarding surface (matches the backlog's own `requiredTests` gap).
9. **Missing tests:** exactly what the backlog specifies — "fresh workspace, zero PMOs, successfully creates a project via the onboarding surface."
10. **Independent severity assessment: confirms and arguably strengthens P0.** ADR-PMF-006 itself (lines 38-43, 146-148, 182-185, 241-244, 258-259) *already documents* the wizard-button instance of this violation as a known, unresolved, explicitly out-of-scope gap ("a current-state gap this ADR flags but does not fix"). The routing-layer gate found independently here is a *stronger* architectural instance of the same Rule 11 violation, and is **not named anywhere in ADR-PMF-006** (`resolve-onboarding-state.ts` and `onboarding-route-map.ts` do not appear in the ADR text — confirmed by direct grep). Any remediation of PMF-002 that only patches the wizard's button without also reordering `resolveOnboardingState`'s precedence will not actually satisfy Rule 11 for a PMO-less user, since the route map will still never send them to `/projects/new`.
11. **Confidence:** High.
12. **Final verification verdict: CONFIRMED**, with an important implementation-boundary correction: PMF-002's stated `implementationBoundary` ("remove the precondition gate in `getting-started-flow.tsx`... likely resolved as a byproduct of PMF-001 if the file is retired") is **incomplete** — retiring the wizard file alone does not fix this, because the routing-layer precedence (`resolve-onboarding-state.ts`, `onboarding-route-map.ts`) sits upstream of any specific onboarding UI and would still block PMO-less users from `/projects/new` regardless of which UI renders at `/workspace/setup`.

### PMF-003 — Execution-task/dependency mutation endpoints authorize on 'read' not 'write'

1. **Audit's claim:** four endpoints gate mutations on `requireProjectAccess(id, "read")` instead of `"write"`; `executive_viewer`/`external_stakeholder` roles (from `src/lib/security/rbac.ts`) could exploit this.
2. **Current code path — directly re-verified by this session, not merely re-read from the audit:**
   - `POST /api/execution-tasks/update` — `src/app/api/execution-tasks/update/route.ts:47`: `await requireProjectAccess(task.project_id, "read");` guarding an update to `status`/`owner_user_id`/`owner_name`/`progress_percent`/`due_date`.
   - `POST /api/execution-task-dependencies/update` — `src/app/api/execution-task-dependencies/update/route.ts:60`: same pattern, guarding a dependency status transition.
   - `POST /api/execution-task-dependencies` (create) → `createExecutionTaskDependency` — `src/lib/execution-tasks/dependencies/create-dependency.ts:88`.
   - `POST /api/execution-task-dependencies/materialize` — `src/app/api/execution-task-dependencies/materialize/route.ts:30`.
   Both of the first two were spot-checked directly in this session (§ spot-check above) and confirmed byte-for-byte.
3. **Entry point:** any authenticated workspace member; no UI gate is required to reach these routes directly (`fetch`/`curl`).
4. **Authorization boundary — this is where independent verification materially corrects the audit:** the audit's evidence cites `src/lib/security/rbac.ts`'s `executive_viewer`/`external_stakeholder` role definitions as the exploitable actors. Independent tracing found `rbac.ts`'s 7-value role taxonomy (`owner, admin, PM, contributor, executive_viewer, external_stakeholder, ai_agent`) is **dead code** — never consulted by the real authorization path, confirmed by this session's own tracing *and* by a prior first-party review already in the repository (`artifacts/independent-final-review-2026-07-16/defects.md:8`, finding "D1": *"`ROLE_PERMISSION_MAP` is dead code — never consulted by the real authorization path"*). The **live** role system is `src/lib/workspace-access.ts:4-5` — `WORKSPACE_ROLES = ["owner","admin","pm","viewer"]` — enforced via the DB column `role text not null default 'viewer' check (role in (...))` (`supabase/migrations/20260512160000_workspace_authorization_rewrite.sql:13`). The permission helper actually invoked (`requireProjectAccess` → `access-guards.ts:80-96`) resolves workspace scope from the project row directly (line 84), independent of read/write, so **no cross-tenant exploit exists** — the bug is strictly "any workspace member with the DB `viewer` role can mutate any task in that workspace," not a tenant-isolation break.
5. **Persistence boundary:** direct `.update()`/`.insert()` calls against `execution_tasks`/`execution_task_dependencies`. RLS on both tables is role-agnostic (`is_workspace_member(workspace_id)` only, per `20260605070000_execution_tasks.sql:71-77` and `20260605080000_execution_task_dependencies.sql:92-105`) — **no database-level defense-in-depth exists** if the app-layer check is bypassed, confirming the app-layer fix is the only mitigation available.
6. **User-visible consequence:** a DB-default `"viewer"`-role workspace member — assignable today via the real `/team` invite UI (`src/app/(protected)/team/page.tsx:24`, `<option value="viewer">`) and via `sendInviteAction`/`inviteWorkspaceMember` (`src/app/(protected)/team/actions.ts:9-51`, `workspace-access.ts:50,59-61`) — can reassign task ownership, change status/due-date/progress, and create/materialize dependencies through these four routes, even though the UI hides the controls that would normally call them (`src/app/(protected)/projects/[id]/page.tsx:43`: `canCreateTask = role !== "viewer"`).
7. **Files/symbols inspected:** all four routes above; `access-guards.ts:80-96`; `workspace-access.ts`; `rbac.ts`; `team/page.tsx`; `team/actions.ts`; RLS migrations for both tables; the correctly-gated sibling `src/app/api/execution-tasks/[taskId]/route.ts:130` (`"write"`), whose own code comment (lines 125-128) states the legacy `/update` route was *"kept at `read` for backward compatibility"* — i.e., a known, deliberate, unresolved deferral, not an oversight.
8. **Tests currently covering the path:** `tests/execution-tasks.test.mjs`, `tests/execution-task-dependencies.test.mjs`, `tests/route-guard-consistency.test.mjs`. The last of these has a *directly on-point* regression guard (`route-guard-consistency.test.mjs:280-296`, "Perilla 8 regression guard") asserting `"write"` for the sibling `milestones.ts`/`task-schedule.ts`/`convert-task-draft.ts` files fixed by commit `128726f` (2026-07-10, PR #514) — but it does **not** assert anything about the four PMF-003 sites. `grep '"read"\|"write"\|requireProjectAccess'` over `execution-tasks.test.mjs`/`execution-task-dependencies.test.mjs` returns **zero matches**.
9. **Missing tests:** exactly as the backlog specifies — a 403 test for `viewer`-role POSTs to each of the four routes. None exist today for any of the four.
10. **Independent severity assessment:** **confirms and strengthens P0.** Because the actually-exploitable role (`viewer`) is real/live/default/invitable (unlike the dead-code roles the audit's own evidence cites), this is an **active production exposure**, not a latent/theoretical one. Historical corroboration: this exact defect class was found and fixed one day after being introduced for sibling files (`128726f`, 2026-07-10, one day after `08b0b8c` introduced the four defective files) but was never extended to these four — the team's own remediation precedent treats this pattern as a real, worth-fixing bug class.
11. **Confidence:** High.
12. **One residual verification gap, disclosed rather than hidden:** tracing `requireProjectAccess` → `evaluateCapability` → `authorizeRuntimeAction` → the AOC governance-core policy registry appears, when read statically, to re-enter the same pipeline in a way that looks mutually recursive (`access-guards.ts:90` calling back into the same action). This could not be fully resolved without running the application; it does not weaken the finding (the `128726f` fix commit is first-party evidence the read/write distinction has real effect), but the exact runtime mechanics should be confirmed dynamically before remediation, not solely from static reading.
13. **Final verification verdict: CONFIRMED**, with the correction that the true exploitable actor is the live `"viewer"` DB role, not the dead-code roles the audit's evidence cites.

### PMF-004 — `pmos` table lacks unique constraint on `workspace_id` — duplicate-PMO race condition

1. **Audit's claim:** `savePmoTenant`'s check-then-insert against `pmos` (no unique constraint) allows concurrent activation to create duplicate PMO rows.
2. **Current code path:** `savePmoTenant` (`src/lib/pmo/save-pmo-tenant.ts:128-167`) — SELECT `existingPmo`, then INSERT else UPDATE, two separate Supabase round-trips, no transaction, no lock.
3. **Entry point:** the "Activate Command Center" wizard (`create-pmo-wizard.tsx`, route `/create-command-center`); also indirectly via `ensureDefaultPmo` (a *different*, already-fixed path, see below).
4. **Authorization boundary:** N/A (own-workspace activation).
5. **Persistence boundary — independently re-verified:** `supabase/migrations/20260828000001_workspace_pmo_project_hierarchy.sql:29-49` — confirmed **no unique constraint** on `pmos.workspace_id`, only a plain btree index (`pmos_workspace_idx`, line 48-49). Direct spot-check in this session (`grep -n "unique" 20260828000001_*.sql`) found zero matches for `pmos` (the only unique index in that file family belongs to an unrelated table, `context_conversations`).
6. **User-visible consequence:** two browser tabs, or a client-timeout-then-retry racing the still-pending original request, can both observe "no existing PMO" and both insert — producing two `pmos` rows for one workspace.
7. **Files/symbols inspected:** `save-pmo-tenant.ts:128-167`; `supabase/migrations/20260828000001_*.sql`; `supabase/migrations/20260828000002_ensure_default_pmo_advisory_lock.sql` (the *already-fixed* sibling path, see below); `create-pmo-wizard.tsx:720,808-871` (`inFlightRef`); `src/lib/workspaces.ts:77-106` (`ensureUserWorkspace`, a related, additional finding below).
8. **Tests currently covering the path:** `tests/command-center-activation-sequence.test.mjs:150-152` asserts only the single-tab `inFlightRef` guard — no cross-tab/concurrency test exists. `artifacts/independent-final-review-2026-07-16/migration-concurrency.md:21-25` previously verified concurrency-safety **only** for the one-time migration backfill DO-block (5 concurrent `psql` runs → exactly 1 row) — it never tested `savePmoTenant`'s or `ensureUserWorkspace`'s *runtime* check-then-insert paths.
9. **Missing tests:** exactly as specified — a concurrency test firing two parallel `savePmoTenant` calls for one workspace, asserting exactly one `pmos` row results.
10. **Independent severity assessment: confirms P0, and finds the underlying anti-pattern is broader than PMF-004's stated scope.** The exact same class of bug (`ensure_default_pmo`'s unguarded check-then-insert) was **already found and fixed** elsewhere in the same codebase via a Postgres advisory lock (`ensure_default_pmo()` SQL function, `pg_advisory_xact_lock(hashtext('pmfreak_ensure_default_pmo_' || workspace_id))`, migration `20260828000002`, whose own comment explicitly names the race: *"Two concurrent requests for the same brand-new workspace can both observe zero PMOs and both insert... before either commits"*) — but that fix was **never extended** to `savePmoTenant`'s own separate `pmos` insert, which is the actual path the Command Center "Activate" wizard uses. `save-pmo-tenant.ts:127`'s own code comment (*"Idempotent: skip when the workspace already has a PMO"*) is **false** for the concurrent case — true only for strictly sequential single-tab retries. **Additional finding beyond PMF-004's stated scope:** `ensureUserWorkspace` (`src/lib/workspaces.ts:77-106`) has the **identical** unguarded pattern for the *Workspace* row itself (SELECT `workspace_memberships`, then INSERT `workspaces` + membership if none found) — a brand-new user opening two protected-route tabs on first login can race this and create two independent workspaces. `workspace_memberships`'s PK (`workspace_id, user_id`) cannot prevent this since it only dedupes a given pair *after* two different workspace rows already exist. This is a distinct, unfixed race from PMF-004, only partially overlapping with PMF-007's stated "orphaned-workspace" framing (PMF-007 describes a *sequential-write* atomicity gap within one call; this is a *concurrent-call* duplication gap between two calls).
11. **Confidence:** High.
12. **Also confirmed:** no persisted audit-event trail exists for PMO/Command-Center activation at all — `savePmoTenant` only does `console.log`/`console.error` via a local `emit()` helper, never writing to `governance_audit_events`. A duplicate-PMO race would leave no durable evidence trail to investigate after the fact.
13. **Final verification verdict: CONFIRMED**, with an additional related-but-distinct race in `ensureUserWorkspace` flagged in §11 (Severity Reassessment) and §21 (Out of Scope) rather than folded into PMF-004 itself, per the instruction not to expand the backlog in this prompt.

### PMF-005 — 'Project Brain Online'/'smarter' claim renders at zero-evidence state

1. **Audit's claim:** the "Project Brain Online" hero + "the more evidence you provide, the smarter your Project Brain becomes" copy renders unconditionally at first Command Center visit, zero evidence, overclaiming adaptive learning the deterministic implementation doesn't have.
2. **Current code path — directly re-verified, including a path correction:** `ProjectBrainOnlineHero`, actually located at **`src/components/pmfreak/intelligence-inbox/project-brain-online-hero.tsx`** (confirmed via `find`; the backlog JSON's `affectedAreas` array cites `src/components/pmfreak/project-brain/project-brain-online-hero.tsx`, a directory that does not exist — a genuine citation error, though the audit markdown's own inline references (§10, §19) do not repeat the wrong directory, only the JSON's `affectedAreas` field does). Line numbers are exactly correct: line 13 is the `<h1>Project Brain Online</h1>` heading; lines 18-20 are the "smarter" paragraph — spot-checked directly in this session.
3. **Entry point:** `command-center-client.tsx:118-121` — rendered whenever `showIntelligenceInbox` is true, gated only by that boolean, **not** by evidence count.
4. **Authorization boundary:** N/A.
5. **Persistence boundary:** N/A (pure UI copy).
6. **User-visible consequence:** a project with literally zero evidence beyond its own creation sees the identical "Online"/"smarter" framing as a project with substantial evidence.
7. **Files/symbols inspected:** `project-brain-online-hero.tsx`, `command-center-client.tsx:118-121,143-144`, `operational-memory-panel.tsx:35-39` (a second, separately unconditional "Project Brain Status … Online" block), `src/lib/project-brain/derive-initial-response.ts`, `src/lib/project-brain/episodic-memory/derive-episodes.ts`, `docs/product/project-brain/01-episodic-memory.md`.
8. **Tests currently covering the path:** `tests/project-brain-foundation-integration.test.mjs:182-206` — the project's explicit "no fabricated learning" guardrail. **Confirmed test-suite blind spot:** it reads only `evidence-timeline-card.tsx` and `project-intelligence-inbox.tsx` into memory and regexes for `/got smarter/i` and `/Learned from/i` — it **never reads** `project-brain-online-hero.tsx` at all, and even if it did, its regex would not match the actual phrasing ("the more evidence you provide, the smarter your Project Brain becomes" contains no "got smarter"). This is a concrete, named, reproducible gap: the honesty test polices the wrong file with an under-broad pattern.
9. **Missing tests:** as the backlog specifies — extend the existing honesty test (or a renamed successor) to actually read `project-brain-online-hero.tsx` and assert no unconditional "smarter"/"learns"/"adapts" language renders without a real evidence-count gate.
10. **Independent severity assessment: confirms P0.** Runtime capability behind "Project Brain" is confirmed deterministic/rule-based — zero ML, zero training, zero embeddings (grep across `src/lib/project-brain/` for train/neural/embedding/tensorflow/pytorch returns zero matches) — so the "smarter" claim is not merely premature, it describes a capability class (adaptive learning) that does not exist in the implementation at all, a direct violation of the canonical principle against calling something "learned"/"adaptive" without runtime evidence.
11. **Confidence:** High.
12. **Additional related defect found (feeds PMF-012's severity, see §11):** the same investigation found a genuine timestamp/content-mutation defect — the "N evidence items" FACT is re-derived live on every render (correct), but its episode's `occurredAt` is frozen at the *project's creation time* (`derive-episodes.ts:212,230,252`, fed by `project-intelligence-inbox.tsx:246`'s `generatedAt: createdAt`) — so the same displayed episode silently shows a different count on later visits while its timeline position never moves, with **no supersession/knowledge-transition episode ever emitted** to explain the change (confirmed: `KnowledgeTransition` is a fully-typed but never-populated field, `episodic-memory/types.ts:69-89`, `derive-episodes.ts` never pushes to it). This is a real violation of the episodic-memory model's own stated invariant (recorded episodes should not silently mutate without a visible supersession event) — distinct from, but closely related to, PMF-012's stated "timestamps use creation time" framing; recommend the PMF-012 implementer read this framing rather than treating it as pure display-layer cosmetics.
13. **Final verification verdict: CONFIRMED**, with a citation-path correction in the backlog and a concrete test-blind-spot mechanism identified.

---

## 6. Canonical Onboarding Verification (independent §5.1 investigation)

- **Both onboarding systems are live code, unequally reachable.** The legacy wizard (`getting-started-flow.tsx`, introduced `08b0b8c`/PR #504, last touched `7c5e94c`/PR #522) is **not** part of PR #547. PR #547 (`f6324a7`, "guided workspace onboarding with evidence-derived activation") introduced a genuinely separate, evidence-derived system: `src/lib/workspace-activation/{evaluate-workspace-activation,activation-rules,onboarding-preferences}.ts`, `GET/PATCH /api/workspace-activation`, `workspace-onboarding-panel.tsx`, migration `20260829000000_workspace_onboarding_preferences.sql`.
- **Routing determines which one a real user reaches, and it is not the newer one.** `src/proxy.ts:65-95` (Edge middleware) resolves activation state coarsely from a JWT boolean and unconditionally redirects any onboarding-incomplete request to `/workspace/setup` (with a slash) — the legacy wizard's route, per `route-policy-registry.ts:16-58,125-128` (`/workspace/setup` is an explicit `SETUP_ROUTE`; `requiresOnboardingCompletion` is true for `dashboard`/`command-center`/`projects` etc.). PR #547's panel lives at **`/workspace-setup`** (no slash) — a route entirely absent from `route-policy-registry.ts`'s lists, so `requiresOnboardingCompletion("/workspace-setup")` is false and nothing redirects a new user there. The panel is also embedded inline on `/dashboard` (`dashboard/page.tsx:11`), but `/dashboard` is itself gated behind the same onboarding-completion check that sends incomplete users to the legacy wizard first — so the panel is unreachable from the default new-user path either way.
- **Concrete reachability answers:**
  - Brand-new authenticated user, no workspace → `/workspace/setup` (legacy `GettingStartedFlow`).
  - Existing user with a workspace but no PMO → same, `/workspace/setup` (`needs_pmo_setup` maps to the same route as `no_workspace`, `onboarding-route-map.ts:8-19`).
  - User with an active PMO but no project → `/projects/new` (`needs_project`).
  - `/onboarding` (a third route) simply `redirect("/workspace/setup")` (`src/app/(protected)/onboarding/page.tsx:1-5`), reinforcing the legacy wizard as the de facto canonical target.
- **Neither system is dead code.** Both are imported and rendered by live routes; `tests/legacy-shell-quarantine.test.mjs:6-17,32-37` is a static regression test that pins the legacy wizard's continued existence and current redirect behavior, confirming maintainers know it is intentionally still live, not forgotten cruft.
- **Fabricated state — persisted vs. visual-only, resolved per-item:**
  - Readiness/completion scores (`getting-started-flow.tsx:258-293`): **visual-only, client state, never persisted** — the POST body to `/api/getting-started` never includes them (verified by reading the full request-body construction).
  - `onboarding_completed` boolean: **persisted, authoritative, not re-derived from real entities** — written unconditionally on any successful submit (`api/getting-started/route.ts:62`), later read as sole authority by the Edge middleware (`proxy.ts:67`, `resolve-onboarding-state.ts:115-119`).
  - Demo/seed data (`loadDemo` branch): **persisted if triggered** (real `projects` row named "PMFreak Demo Launch Recovery", plus `operational_memory` rows tagged `sourceRef: "activation-demo"`) but **no reachable UI call site found** in the current wizard (only `submit(false)` is ever called) — reachable via direct API call only.
  - `onboardingCompleted: true` hardcoded in `operational-shell.tsx:788`: passed unconditionally into `computeCapabilityRevealState`, rather than derived — currently harmless because `OperationalShell` only mounts after onboarding is already confirmed complete upstream (`layout.tsx:51,67-68`), but would silently go stale if that upstream gate ever changed.
- **PR #530-533 chain (context for ADR-PMF-006's ratification):** `b82b05e` (#530, domain model draft) → `afc9418` (#531, ratify 12 founder-decided ADRs, same date as ADR-PMF-006) → `0a77b41` (#532, canonical product language) → `23f7425` (#533, canonical IA). All four are documentation-only per their commit subjects; ADR-PMF-006's ratification date coincides with #531's "12 founder-decided ADRs" commit, strongly suggesting it is one of them (not independently re-diffed line-by-line — noted as unverified beyond date/subject correlation).
- **Project creation vs. PMO/Command-Center precondition — mixed answer, resolved by layer:** the *service layer* (`createMinimalProject`, `create-minimal-project.ts:99-117`) never requires an explicit PMO — it silently auto-creates a default one if absent. The *routing/UI layer* does impose the precondition, as detailed in PMF-002 above. ADR-PMF-006 Rule 11/12 (lines 87-95) forbid exactly this, and self-report the wizard-button instance as a known, unresolved, out-of-scope gap (line 43, 216-217) — but do not mention the routing-layer instance found independently here.

---

## 7. Authorization Boundary Verification (independent §5.2 investigation)

Fully reconciled with PMF-003 (§5 above). Summary of scope-limited findings, not expanded into a general permission audit:

- **In-scope defective endpoints (4):** `execution-tasks/update`, `execution-task-dependencies/update`, `execution-task-dependencies` (create), `execution-task-dependencies/materialize` — all gate on `"read"`.
- **Correctly-gated comparables in the same domain (confirms the pattern is known elsewhere):** `execution-tasks/[taskId]` PATCH (`"write"`), `create-execution-task.ts` (`"write"`), `convert-task-draft.ts` (`"write"`), `schedule/task-schedule.ts` (`"write"`) — the last three fixed together by PR #514 (`128726f`, "Perilla 8"), which explicitly named the "read-gates-write" pattern as a defect class one day after it was introduced (`08b0b8c`), but did not touch the four PMF-003 files.
- **Workspace-scope/cross-tenant enforcement:** independent of read/write — `access-guards.ts:80-96` derives workspace scope from the project row server-side, never trusting a client-supplied ID, for *both* read and write calls. **No cross-tenant exploit exists**; the bug's blast radius is "any task within a workspace the `viewer` legitimately belongs to," not "any tenant's data."
- **Ownership enforcement:** none exists at the task level for any role above `viewer` (a `contributor`/`pm`/`admin` can mutate any task in the workspace, not just their own) — a general design characteristic, not unique to this bug, but relevant to blast-radius framing.
- **UI gating vs. server enforcement — confirmed independent:** `projects/[id]/page.tsx:43` hides mutation controls for `role === "viewer"`, and a separate, correctly-gated route (`[taskId]` GET, `"write"` check at lines 60-66) independently hides Task Detail drawer controls — but the underlying quick-status control still calls the **defective** `/update` endpoint (`project-task-list.tsx:40`). UI hiding provides no protection against a direct request.
- **View-only role reality, resolved (corrects the audit's own citations):** `"viewer"` is real, DB schema default, assignable via the actual production `/team` invite UI and its server action, and referenced directly in production code (`projects/[id]/page.tsx:43`). The 7-value `rbac.ts` taxonomy the audit cites as evidence (`executive_viewer`, `external_stakeholder`) is a parallel, dead-code system, already flagged as such by a prior first-party review (`artifacts/independent-final-review-2026-07-16/defects.md:8`). **This upgrades, not downgrades, the audit's own Unknown #4** — view-only roles are an active production exposure today, not merely latent.
- **Test coverage:** `route-guard-consistency.test.mjs:280-296`'s Perilla-8 regression guard is the one directly on-point precedent test; it does not cover any of the four PMF-003 sites. `authorization-adversarial-contract.test.mjs` only pattern-matches the dead-code `rbac.ts` file, not live behavior — its "adversarial" naming is misleading given it is a static-text assertion, not a live-request test.

---

## 8. PMO Cardinality and Activation-Race Verification (independent §5.3 investigation)

- **Schema, independently re-verified:** `pmos` table (`20260828000001_workspace_pmo_project_hierarchy.sql:29-49`) — PK `id`, FK `workspace_id → workspaces(id)`, **no unique constraint of any kind**, only a plain composite btree index `pmos_workspace_idx (workspace_id, status, created_at)`. Direct grep for `unique` across all `pmos`-touching migrations returns zero hits for that table.
- **Command Center is not a distinct table** — confirmed via both code (`savePmoTenant` `.update()`s the existing `workspaces` row, never inserts a new entity) and documentation (`docs/architecture/command-center-foundation.md:14`, *"A Command Center is not a new table. It is the existing `workspaces` table."*).
- **Get-or-create audit across all three relevant paths:**
  | Path | Atomic? |
  |---|---|
  | One-time migration backfill | **Yes** — wrapped in `pg_advisory_xact_lock` |
  | `ensureDefaultPmo` (`pmo-service.ts:200-209` → RPC `ensure_default_pmo`, migration `20260828000002`) | **Yes** — advisory-lock-guarded, single round trip, explicitly built to fix exactly this race class |
  | `savePmoTenant`'s own `pmos` insert (the actual Command Center "Activate" path) | **No** — unguarded, two-step, no lock |
  | `ensureUserWorkspace` (workspace bootstrap) | **No** — same unguarded pattern, additional finding beyond PMF-004 |
- **Concurrency traces:** same-tab double-click is guarded (`inFlightRef`, `create-pmo-wizard.tsx:720,808-811`); **two tabs are not guarded** (separate component instance, separate ref); a client-side timeout does not abort the underlying request (no `AbortController` found), so a same-tab Retry after timeout is naturally serialized (not racy) but any two independent callers (two tabs, a curl replay, a load-balancer double-delivery) are not. No idempotency key, no `If-Match`, no optimistic-concurrency compare-and-swap exists anywhere in either path.
- **Constraint-violation handling:** hypothetical today (no constraint exists), but `savePmoTenant`'s insert already swallows any DB error into a `warn`-level log and still reports `{status: "success"}` — so adding a naive unique constraint without also fixing this handling would silently drop the PMO-materialization step for the race's loser while still telling the user "success."
- **Audit-event duplication:** no persisted audit-event row is written for PMO/Command-Center activation at all (`savePmoTenant` only logs via a local `console`-based `emit()` helper) — a duplicate-PMO race leaves no durable audit trail, only duplicate ephemeral log lines.
- **Ratified cardinality — this resolves the audit's own Unknown #5 (§22 item 5) more precisely than the audit could:** `docs/adr/ADR-PMF-003-pmo-governance-semantics.md` Rule 1 (line 29) **explicitly ratifies** *"A Workspace may contain multiple PMOs"* — confirmed independently, not merely asserted by product intent, by the schema's own deliberate absence of a uniqueness constraint (also stated directly in `docs/product-architecture/01-canonical-domain-model.md:288`). **Multi-PMO-per-workspace is not an open question** — it is already ratified. What genuinely remains open is narrower: Rule 5-6 of the same ADR (lines 33-34) say a **default, invisible PMO must not be created as a universal technical requirement**, only as an explicit decision — and the codebase's `ensureDefaultPmo`/`savePmoTenant` currently violate that (they run unconditionally), a **separate, already-acknowledged** gap (ADR-PMF-003's own Risk section, lines 63-65) distinct from the race condition itself.
- **Contradictions found:** the wizard route (`/create-command-center`, button text "Activate Command Center →") and its own error copy name the action "Command Center creation" — but the ratified domain model (`docs/product-architecture/01.1-domain-ratification.md:61,316,318`) states Command Center is never an independently-created entity and explicitly calls out this exact flow: *"'Create Command Center' currently creates a PMO."* This is a live, ratified-but-unresolved naming contradiction, not hypothetical.

---

## 9. Project Brain Honesty Verification (independent §5.4 investigation)

- **Full string inventory** (file:line) of every user-facing Project Brain claim was compiled; see PMF-005 in §5 for the headline finding. Additional unconditional-render exceptions found beyond the hero: `operational-memory-panel.tsx:35-39` ("Project Brain Status … Online") renders regardless of the passed-in `response` prop; `brain-boot-sequence.tsx` (see PMF-010, P1) is a purely time-based, backend-disconnected animation whose own code comment admits *"the project is already saved by the time this renders... a staged reveal only."*
- **Runtime capability confirmed deterministic, not adaptive:** `derive-initial-response.ts`/`derive-episodes.ts` are pure functions — field-presence checks to template strings, no LLM call, no training, no embeddings, no feedback loop. Corroborated by the project's own docs (`docs/product/project-brain/01-episodic-memory.md` §17, listing LLM-based extraction and embeddings as explicitly *deferred*, not implemented).
- **"Online" — ambiguous in isolation, resolved by docs:** `docs/product/project-brain/01-episodic-memory.md:62-71` explicitly defines "online"/`brain_activated` as mere availability (present from the moment a project row exists, no activation gate), not an intelligence claim — but the hero's specific pairing of "Online" directly against "the smarter... becomes" (§1/§5) does read as an intelligence claim in that one juxtaposition, which is precisely what makes it the audit's flagged instance rather than the (harmless) status-badge instances elsewhere.
- **Epistemic classes — visible in one surface, not the other:** `EpistemicType` (8 values defined, only FACT/REPORTED/OPEN_QUESTION/UNKNOWN/RECOMMENDATION ever generated) is rendered as distinct badges in the Brief (`ProjectBrainStatementCard`), but the parallel Episode Timeline (`ProjectEpisodeCard`/`ProjectEpisodeDetail`) shows episode-type badges and a bare confidence caption, never the same epistemic-type badge — an inconsistent epistemic surface across the two views of the same underlying data.
- **Provenance:** genuinely visible in the UI (not merely internal) — `ProjectBrainStatementCard` renders a real "Evidence" section per statement (source title, type, primary/secondary tag, link), with an honest "No sources yet." fallback.
- **Structured knowledge gaps:** genuinely displayed in two real surfaces (`KnowledgeGapsPanel`, Brief's "What I Need Next"), prop-driven from real derived data, not hardcoded.
- **Timestamp semantics — a real, separate defect found (feeds PMF-012):** `occurredAt` is correctly bound to real row timestamps for `project_created`/`brain_activated`/`context_recorded`/`evidence_stored` episodes, but `knowledge_recorded`/`question_opened`/`gap_identified` episodes are frozen at the project's *creation* timestamp regardless of when the underlying fact actually became true, with the live-recomputed evidence *count* able to silently change on a frozen-timestamp episode with no supersession event ever emitted — detailed in PMF-005 item 12 above.
- **Zero-state handling — honest almost everywhere, one exception:** episode timeline, Brief sections, and knowledge-gaps panel all show honest, non-fabricated empty-state copy with zero evidence. The one exception is precisely `ProjectBrainOnlineHero` (PMF-005) — the single surface that is not evidence-gated.
- **Test-suite mechanism for the gap, confirmed:** `tests/project-brain-foundation-integration.test.mjs:182-206` reads only two unrelated files and regexes for phrasing that doesn't match the actual offending copy — detailed in PMF-005 item 8.

---

## 10. Any Additional P0 Verification

The backlog JSON contains **exactly 5 P0 items** (PMF-001 through PMF-005), matching the audit's own stated count (§1, §17 of the markdown). No P0 item exists in the JSON beyond the five addressed in §5. **No discrepancy in P0 count; nothing was silently omitted.**

Two P1 items (PMF-007, PMF-012) were found during independent verification to have broader or more severe underlying mechanisms than their stated descriptions suggest (detailed in §8 and §9/§5 respectively) — addressed as a severity-reassessment recommendation in §11, not elevated to P0 unilaterally, since that determination belongs to the product owner/remediation team with full context, not to this verification pass.

---

## 11. Severity Reassessment

| Item | Audit's rating | Independent finding | Recommendation |
|---|---|---|---|
| PMF-001 | P0, high confidence | Confirmed; demo-seed branch softer than implied (UI-unreachable) | Keep P0 — readiness fabrication + persisted flag are independently sufficient |
| PMF-002 | P0, high confidence | Confirmed; routing-layer gate is a stronger, undocumented instance | Keep P0; **broaden the implementation boundary** to include `resolve-onboarding-state.ts`/`onboarding-route-map.ts`, not just the wizard file |
| PMF-003 | P0, high confidence | Confirmed; exploitable role is live `"viewer"`, not the cited dead-code roles | Keep P0; **correct the evidence citation** in any downstream sprint ticket to reference `workspace-access.ts`, not `rbac.ts` |
| PMF-004 | P0, high confidence | Confirmed; `ensureUserWorkspace` has an unfixed sibling race | Keep P0 for `pmos`; **flag `ensureUserWorkspace`'s workspace-duplication race for a follow-up ticket** (not folded into PMF-004 per this prompt's no-backlog-expansion constraint) |
| PMF-005 | P0, high confidence | Confirmed; wrong file path in `affectedAreas`, and the guardrail test targets the wrong file | Keep P0; **fix the `affectedAreas` citation** and route the fix through a test that actually reads `project-brain-online-hero.tsx` |
| PMF-007 (P1) | P1 | The stated "orphaned-workspace" framing undersells a concurrent-call duplicate-workspace race structurally identical to PMF-004's | **Recommend re-reading PMF-007 alongside this brief's §8 finding before scoping its fix** — the atomic-transaction fix alone does not address the concurrent-duplicate-workspace case |
| PMF-012 (P1) | P1 | The "day-1 clustering" framing undersells a silent content-mutation-without-supersession defect | **Recommend re-reading PMF-012 alongside this brief's §5/§9 finding** — the fix should also address the missing supersession-episode emission, not just per-statement timestamp threading |

No item is recommended for demotion. No new P0 is unilaterally declared; both flagged items remain P1 pending remediation-team judgment with the fuller context above.

---

## 12. Test-Suite Blind-Spot Analysis

Current CI (`.github/workflows/ci-governance.yml:14-24`): `npm ci` → `build:aoc` → `typecheck` → `lint` → `test` → `check:governance` → `check:publish-ready` → `check:package-purity`. `npm test` = `tsx --test tests/*.test.mjs tests/*.test.ts` (`package.json:11`) — a **top-level-only glob** (subdirectory test files, e.g. `tests/compliance/compliance-scripts.test.mjs`, are run by a separate script, not `npm test`).

Per-defect blind-spot mechanism, independently confirmed for all three defect classes named in the task:

| Defect class | Existing tests | Why they miss it | Missing test type |
|---|---|---|---|
| Onboarding/activation confusion (PMF-001/002/006) | `tests/proxy-routing.test.mjs`, `tests/resolve-onboarding-state.test.mjs` | Both are `readFileSync` + regex-against-source-text — they assert the JWT-shortcut pattern *exists*, never that it agrees with DB truth, and never invoke the actual routing functions | Route/middleware integration test |
| Read-gates-write authorization (PMF-003) | `tests/execution-tasks.test.mjs`, `tests/execution-task-dependencies.test.mjs` | Zero references to `requireProjectAccess` or the permission-string argument at all (confirmed by grep) | Authorization-boundary / tenant-isolation integration test |
| PMO/Command-Center activation race (PMF-004) | `tests/create-pmo-flow.test.mjs`, `tests/command-center-activation-sequence.test.mjs` | Both self-declared static-analysis-only or single-tab-guard-only; the DB migration's own concurrency proof (`migration-concurrency.md`) never covered the runtime `savePmoTenant`/`ensureUserWorkspace` paths | Database/service-integration test under real concurrency |
| Project Brain overclaim (PMF-005) | `tests/project-brain-foundation-integration.test.mjs` | Reads the wrong two files with an under-broad regex, never reads the actual offending file | Static CI guardrail (content-scan), fixed to target the correct file |

General blind-spot pattern across all four: the test suite is overwhelmingly **static source-text assertion** (`fs.readFileSync` + regex/string match) rather than **live route or database-integration testing**. This explains why `npm ci && typecheck && lint && build && test` can be fully green (per the audit's own §13, 12,793/12,793) while all five P0 defects remain live — the tests validate that *new* code paths behave correctly in isolation, and separately validate that certain *forbidden strings* don't appear in specific files, but nothing in the suite exercises the actual live routing precedence, the actual permission argument passed at a mutation call site, or actual concurrent database writes. This is a **coverage gap**, not a false negative in the tests that do exist — confirmed independently, not merely restated from the audit's own §13 interpretation, which reaches the same conclusion.

---

## 13. Missing Critical-Path Test Matrix

| Proposed test | Exact failure it would catch | Why current tests miss it | Type | Sprint (per audit's own §18 grouping) |
|---|---|---|---|---|
| Fresh account, assert `operational_memory` has zero rows until real evidence submitted | PMF-001's persisted fake templates | No integration test exercises the real onboarding POST and checks persisted rows | Database integration | Sprint 1 |
| Fresh workspace, zero PMOs, project creation succeeds via onboarding surface | PMF-002 (both the button gate and the routing-layer gate) | No test exercises `resolveOnboardingState`'s actual precedence with a real zero-PMO fixture | Route + service integration | Sprint 1 |
| `viewer`-role POST to each of the 4 PMF-003 routes → expect 403 | PMF-003 | No test references the permission argument at all | Authorization-boundary | Sprint 3 |
| Two parallel `savePmoTenant` calls for one workspace → expect exactly 1 `pmos` row | PMF-004 | Existing concurrency test only covers the migration backfill, not the runtime path | Database integration (real concurrency) | Sprint 2 |
| Two parallel `ensureUserWorkspace` calls for one new user → expect exactly 1 workspace | Additional finding, §8/§11 (not in backlog) | No test exists for this path at all | Database integration (real concurrency) | Follow-up, not yet scheduled |
| Assert `project-brain-online-hero.tsx`'s actual copy is evidence-gated | PMF-005 | Existing guardrail reads the wrong files with the wrong regex | Static CI guardrail | Sprint 4 |
| Assert episode `occurredAt` matches the originating evidence row's timestamp, and a supersession episode is emitted on content change | PMF-012 (deepened per §9) | No test exists for either property | Unit / service integration | Sprint 4 |

---

## 14. Product Decision 1 — Canonical Onboarding

- **Current state:** the legacy wizard (`getting-started-flow.tsx`) is the actual live gate for every new/PMO-less user; PR #547's evidence-derived engine is fully built and correct but only reachable via an un-gated, unlisted route (`/workspace-setup`) or embedded on a page (`/dashboard`) that is itself unreachable pre-onboarding.
- **Evidence:** §6 above, in full.
- **Viable options:**
  1. **Retire the legacy wizard**, reroute `/workspace/setup` to the PR #547 engine (selectively porting any UX the new engine lacks), per the backlog's own `implementationBoundary` for PMF-001/002.
  2. **Keep both**, explicitly documenting the legacy wizard as the intentional first-run experience and the PR #547 engine as a secondary/status surface (requires actively removing the fabricated-scores and forbidden-boolean defects from the legacy wizard regardless).
  3. **Merge them** — port the PR #547 evidence engine's computation into the legacy wizard's UX shell.
- **Recommended option:** **1** — retire the legacy wizard as the entry gate. It is the option the backlog's own PMF-001/PMF-002 `implementationBoundary` fields already assume, and it is the only option that resolves PMF-002's routing-layer instance (§5/§11) without leaving a second, parallel onboarding surface to keep in sync.
- **Reasons:** the PR #547 engine is independently verified correct (real evidence-derivation, no fabrication, `activation-rules.ts` self-documented as free of randomness/clock-dependence — not independently re-derived line-by-line in this pass, flagged as a residual gap); retiring the wizard is the only option that also resolves PMF-002 at the routing layer, since `onboarding-route-map.ts` currently has no route to send users to that isn't gated on PMO-first logic.
- **Migration/implementation consequence:** `resolve-onboarding-state.ts` and `onboarding-route-map.ts` must be reworked, not just the wizard component, per the corrected `implementationBoundary` in §5/PMF-002.
- **Cost/risk:** Option 1 — moderate implementation cost (already scoped as Sprint 1, size M+S in the backlog), low risk given the new engine is independently verified sound. Option 2 — lower short-term cost, but leaves two onboarding systems to maintain and does not resolve PMF-002's routing-layer instance. Option 3 — highest cost, re-implements UX from scratch inside a component whose scoring logic must first be entirely removed.
- **Question requiring product-owner ratification:** *Should `getting-started-flow.tsx` be deleted outright in favor of the PR #547 evidence-derived engine, or does it contain onboarding UX the new engine still lacks and should selectively retain (audit §22 item 1, restated)?*

---

## 15. Product Decision 2 — View-Only Role Exposure

- **Current state:** the DB-default `"viewer"` workspace role is real, assignable today via the production `/team` invite UI and its server action, and is the role the audit's own PMF-003 finding actually concerns — not the dead-code `rbac.ts` roles the audit's evidence cites.
- **Evidence:** §5 (PMF-003), §7 in full.
- **Classification:** **active production exposure** — not "reachable but not surfaced," not "latent," not "blocked from verification." Any workspace with an invited `"viewer"`-role member has this exposure live today.
- **Recommended security treatment:** treat as a standard authorization-boundary bug requiring a straightforward, scoped fix (change `"read"` → `"write"` at the four cited call sites) — no broader RBAC redesign is required or recommended, consistent with the backlog's own `nonGoals` for PMF-003.
- **Does this change severity, urgency, or only exploitability?** **It changes urgency, not severity.** The audit already rated this P0; independent verification confirms P0 is correct and additionally establishes the exposure is *actively* exploitable in any workspace with a `"viewer"`-role invite today (not merely a defect that would matter once a hypothetical role became assignable) — i.e., the audit under-stated confidence in real-world reachability (its own Unknown #4 left this open) where independent verification can now say definitively: **yes, reachable, today, in production.**
- **Product-owner note:** the authorization correction is recommended regardless of role-assignment reachability, per the task's own instruction — this is doubly true here since the role *is* reachable.

---

## 16. Product Decision 3 — PMO Cardinality

- **Current state:** `pmos.workspace_id` has no unique constraint (deliberately, matching ratified intent); `savePmoTenant`'s runtime insert path for it is an unguarded race.
- **Evidence:** §8 in full.
- **Cardinalities implied by the system, reconciled:**
  - One Workspace → many PMOs: **ratified** (ADR-PMF-003 Rule 1; confirmed by the schema's deliberate absence of a unique constraint).
  - One PMO → exactly one Workspace: **ratified and enforced** (`workspace_id NOT NULL` FK).
  - Command Center → not a distinct entity; scoped to Workspace (`docs/architecture/command-center-foundation.md:14`).
  - A **default** PMO per workspace → **ratified as bounded to exactly one, created only by explicit decision** (ADR-PMF-003 Rules 5-6) — **not yet enforced**, and this is the actual unresolved question, narrower than the audit's Unknown #5 framing.
- **Contradictions found:** the wizard UI/route names the action "Command Center creation" while the ratified domain model states this is conceptually wrong (it creates a PMO) — a live, ratified-but-unresolved naming contradiction (§8).
- **Recommended canonical cardinality:** many-PMOs-per-workspace is already ratified and should not be revisited; what requires a fix is making the **default PMO's** get-or-create idempotent (mirroring `ensure_default_pmo`'s already-correct advisory-lock pattern) rather than adding a blanket unique constraint that would contradict Rule 1.
- **Do not instruct a migration to enforce this until ratified** — per task instruction, no migration is proposed here.
- **Required final question, restated with the more precise alternative this verification surfaces:** *Should PMFreak enforce exactly one **default/auto-created** PMO per workspace (via an idempotent, lock-guarded upsert, matching `ensure_default_pmo`'s existing pattern), while continuing to allow unlimited **explicitly-created, non-default** PMOs per workspace as already ratified by ADR-PMF-003 Rule 1 — or is even the "one default PMO" invariant intended to be relaxed?*

---

## 17. Product Decision 4 — Portfolio Status

- **Current state — contradictory across layers, not a single clean bucket:**
  - The PMI-sense "Portfolio" entity ratified by ADR-PMF-004 (Enterprise → Workspace → PMO → Portfolio → Program → Project): **planned, not started** — zero DB table, zero route matching the ratified target path `/workspaces/[id]/pmos/[id]/portfolios/[id]`.
  - The `/portfolio` route, the `<h2>Portfolio</h2>` heading over `pmos/[pmoId]`'s plain project list, and `command-center/portfolio-summary.ts`'s "portfolio" variables: **superseded-in-intent / not-yet-renamed** — ADR-PMF-004 itself names these exact usages as squatting on the term (lines 13-20, 80, 87, 119) but they remain live and unchanged.
  - `personal_portfolios` (a genuinely different, real feature): **backend-complete, UI-orphaned** — full migration + RLS + service + 7 API routes + dedicated tests, but **no page in `src/app` consumes it.**
  - Five analytical engines (conflict-arbitration, load-balancing, executive-decision-simulation, pmo-intervention-automation, executive-dashboard-aggregation) under `src/lib/portfolio/`: **dormant** — fully built and unit-tested, but their barrel export (`src/lib/portfolio/index.ts`) has zero importers anywhere in `src/`; only consumed by throwaway fixture scripts.
- **Evidence:** independent agent report (Topic A), full inventory of routes/components/nav/types/tables/services/tests cited by file:line, cross-checked against ADR-PMF-004 and `docs/product-architecture/07-route-layout-and-navigation-architecture.md:37-39` (target-state route spec).
- **Recommended status:** **hide the term-squatting usages, keep the dormant/orphaned code as-is (do not delete), and treat the ratified PMI-Portfolio entity as a future roadmap item** — do not implement it now, but stop using the word "Portfolio" for non-Portfolio data (this is already backlog item PMF-022, P2).
- **Visibility consequence:** renaming the squatting usages (nav lens, PMO page heading, command-center variables) has low implementation cost and directly resolves a ratified-but-unaddressed contradiction (ADR-PMF-004 self-documents it); it does not require building the real entity.
- **Do not implement this recommendation now** — per task instruction, this is a product-owner ratification item, not an action item for this pass.

---

## 18. Product Decision 5 — Command Center Entity Scope

- **Current state:** Command Center's real entity anchor is **Workspace** everywhere except the one live UI surface (`/command-center`'s `CommandCenterClient`), which is **Project**-scoped within that workspace and additionally mixes in a workspace-wide PMO/project-count strip (`portfolio-summary.ts`) on the same screen. `/pmo-command-center` (despite its name) resolves via `workspaces[0]?.id` — the user's *first* workspace, no `pmoId` param exists anywhere in its type signatures. No code path anywhere scopes a "Command Center" to a PMO, Portfolio, or Program row, despite three of the four Command Center subsystems having "PMO" in their names.
- **Evidence:** independent agent report (Topic B), cross-checked against ADR-PMF-007 (which itself, ratified 2026-07-18, explicitly calls this exact Project/Workspace mixing an unresolved, out-of-scope risk, not a violation this ADR fixes).
- **Likely impact of a split, concretely:**
  - Routes: `command-center/page.tsx`, `pmo-command-center/page.tsx` + its API route (would need a `pmoId` param added — none exists today), `create-command-center/page.tsx`.
  - DB/FKs: `pmo_command_center_snapshots`/`pmo_attention_items`/`pmo_recommendations` would need a new `pmo_id` FK (none exists despite the "PMO" name); `operational_command_centers` (workspace_id + project_id composite FK) would need re-keying if Project scope changes — but this table has zero importers in `src/` today, so its cost is theoretical.
  - Activation: `CommandCenterActivationSequence`/`use-command-center-activation.ts` (scope-agnostic today, low direct risk); `save-pmo-tenant.ts` (the actual materializer, already flagged in PMF-004/§8).
  - Navigation/permissions: `navigation-hierarchy.ts`'s "Create Center"/"Execution" entries; `requireWorkspaceMember`-only checks in `pmo-command-center`'s route (no PMO- or Project-level authorization exists there today — new plumbing required, not just a query change).
  - Project Brain/evidence: `CommandCenterClient` directly wires Project Brain and Intelligence Inbox components to a single project — a rescope above Project level requires deciding whether Project Brain becomes a child view or is rolled up, since today it *is* the entire content of the Project-level Command Center.
  - Daily Execution: a separate, sibling nav item with no direct code coupling found — low blast radius from this specific split.
- **Recommended timing:** **not inside critical-path remediation, and not immediately after the first release gate** — this is architecturally significant (new FK relationships, new authorization plumbing, a Project-Brain-ownership decision) and should be scoped as its **own future architecture sprint**, consistent with ADR-PMF-007's own stated deferral and the audit's own §21 ("Deferred or Explicitly Excluded Work").
- **Do not expand the remediation backlog during this prompt** — noted, not actioned.

---

## 19. Recommended Ratification Decisions

Restated in single-sentence form for the product owner (full reasoning in §14-18):

1. **Onboarding:** retire the legacy wizard as the entry gate; port any UX it has that the PR #547 engine lacks; rework the routing layer (`resolve-onboarding-state.ts`/`onboarding-route-map.ts`), not just the component.
2. **View-only roles:** treat as an active, currently-exploitable production exposure; fix the four call sites' permission argument; no RBAC redesign needed.
3. **PMO cardinality:** many-PMOs-per-workspace is already ratified — do not revisit; fix only the *default* PMO's idempotency using the existing advisory-lock pattern.
4. **Portfolio:** rename the term-squatting usages now (low cost); defer building the real ratified entity to a future roadmap item; keep the dormant/orphaned code as-is.
5. **Command Center scope split:** defer to a dedicated future architecture sprint, not this remediation pass or the immediate post-gate window.

---

## 20. Consequences for the Sequential Remediation Roadmap

The audit's own Sprint 1-6 sequencing (§18 of the markdown) is **independently assessed as sound**, with two scoping corrections:

- **Sprint 1** (PMF-001, 002, 006, 007) must explicitly include `resolve-onboarding-state.ts`/`onboarding-route-map.ts` rework, not just `getting-started-flow.tsx` retirement, or PMF-002 will not actually be resolved (§5/§11).
- **Sprint 1**'s PMF-007 scope should be read alongside this brief's §8/§11 finding about `ensureUserWorkspace`'s concurrent-duplication race, which is broader than the "orphaned-workspace-on-partial-failure" framing in the backlog text, even though it is not itself elevated to P0 here.
- **Sprint 2** (PMF-004, 009, 017) correctly gates on the PMO-cardinality product decision (§16) before writing any constraint — confirmed the right sequencing; the *narrower* form of that decision (§16's restated question) should let Sprint 2 proceed sooner than a literal "one-vs-many PMOs" framing would have allowed, since many-PMOs is already ratified and only the default-PMO idempotency needs a decision.
- **Sprint 3** (PMF-003 et al.) has no sequencing blockers; independent verification found no reason to delay it, and given the confirmed active production exposure (§15), there is a case for the product owner to consider re-prioritizing it ahead of Sprint 2 rather than after it — a scheduling call for the product owner, not a scope change made here.
- **Sprint 4** (PMF-005, 010, 012, 015, 019) should incorporate this brief's §9/§11 finding on the missing supersession-episode mechanism when scoping PMF-012, not just per-statement timestamp threading.
- **Release Gate** (after Sprints 1-3): independently endorsed as written — no additional gate criteria are recommended here.

---

## 21. Findings Discovered but Out of Scope

These are genuine findings from this verification pass that do not correspond to an existing backlog ID and are **not** being added to the backlog, per the task's explicit no-expansion instruction:

1. **`ensureUserWorkspace` concurrent-duplication race** (`src/lib/workspaces.ts:77-106`) — structurally identical to PMF-004 but for the Workspace row itself, not `pmos`. Recommend a future backlog item once the remediation team reviews this brief.
2. **Governance-core call-chain appears mutually recursive when traced statically** (`access-guards.ts:90` re-entering `authorizeRuntimeAction`) — flagged as a residual verification gap under PMF-003, not a confirmed defect; needs a dynamic/runtime trace to resolve, not further static reading.
3. **`operational_command_centers` DB table and module have zero importers anywhere in `src/`** — fully built, dormant, parallel to the Portfolio-engine dormancy pattern found in Decision 4. Not a defect, but worth product awareness given it duplicates naming/scope concepts also present in `pmo_command_center_snapshots`.
4. **`activation-rules.ts`'s determinism claim** (no randomness/clock-dependence) was not independently re-derived line-by-line — taken from the PR #547 commit's own test description, spot-checked only at a high level. Recommend a dedicated review before treating it as fully proven if Decision 1 proceeds toward retiring the legacy wizard in its favor.
5. **The prior, unrelated in-repo audit** (`docs/audit/pmfreak-integrated-audit/`) reported a materially different, older test-run result (240s timeout, ~6,067 subtests) than this audit's own fresh 12,793/12,793 run. Not a contradiction (different runs, different times, different scope) — flagged so a future reader does not conflate the two documents.

---

## 22. Product-Owner Ratification Checklist

**Decision 1 — Canonical onboarding**
- Recommended option: Retire the legacy wizard (`getting-started-flow.tsx`) as the entry gate; port any UX the PR #547 evidence-derived engine lacks; rework `resolve-onboarding-state.ts`/`onboarding-route-map.ts` so the routing layer itself no longer forces PMO-first.
- Alternative: Keep both systems, explicitly documented, with the legacy wizard's fabrication/forbidden-flag defects fixed in place regardless.
- Main consequence: Resolving PMF-002 requires the routing-layer rework either way; retiring the wizard avoids maintaining two onboarding systems long-term.
- Product-owner answer: `PENDING`

**Decision 2 — View-only role exposure classification**
- Evidence-based classification: **Active production exposure** — the exploitable role (`"viewer"`) is real, DB-default, and assignable today via the live `/team` invite UI; the audit's own cited roles (`executive_viewer`/`external_stakeholder`) are dead code and were never the actual live exposure.
- Recommended security treatment: Scoped call-site fix (change `"read"` to `"write"` at 4 sites); no RBAC redesign required.
- Product-owner answer: `PENDING ACKNOWLEDGEMENT`

**Decision 3 — PMO cardinality**
- Recommended invariant: Many PMOs per workspace remains ratified and unchanged (ADR-PMF-003 Rule 1); only the *default* auto-created PMO needs an idempotent, lock-guarded upsert (mirroring the already-correct `ensure_default_pmo` pattern).
- Alternative: Relax even the "one default PMO" invariant, treating default-PMO duplication as acceptable.
- Migration consequence: No blanket unique constraint on `pmos.workspace_id` (would contradict Rule 1); a scoped idempotency fix in `savePmoTenant` instead.
- Product-owner answer: **RATIFIED** (PMF-004 remediation sprint) — Multiple PMOs per workspace are supported. Default PMO bootstrap must converge to one canonical default identity per workspace. Global uniqueness on `pmos.workspace_id` is prohibited. See `docs/audits/remediation/pmf-004-default-pmo-command-center-idempotency.md` for the implementation.

**Decision 4 — Portfolio**
- Recommended status: Rename the term-squatting usages now (nav lens, PMO-page heading, command-center variables); defer building the ratified PMI-Portfolio entity to a future roadmap item; leave dormant/orphaned Portfolio code and the UI-orphaned `personal_portfolios` backend as-is for now.
- Visibility consequence: Removing "Portfolio" from non-Portfolio surfaces is low-cost and resolves a contradiction ADR-PMF-004 itself already names as unaddressed.
- Product-owner answer: `PENDING`

**Decision 5 — Command Center entity-scope split**
- Recommended timing: A dedicated future architecture sprint — not inside this remediation pass, and not immediately after the first release gate.
- Alternative: Defer indefinitely and formally document the current Project/Workspace mixing as permanent, accepted debt rather than a future split.
- Architectural consequence: A split requires new PMO-level FK relationships (none exist today despite "PMO" naming in three subsystems), new authorization plumbing (only workspace-level checks exist today), and an explicit decision on whether Project Brain becomes a child view or is rolled up.
- Product-owner answer: `PENDING`

No downstream remediation prompt depending on these five decisions may begin until the relevant answer has been explicitly ratified.

---

## 23. Final Verdict

All five P0 findings in `pmfreak-post-merge-backlog.json` are independently **CONFIRMED**, with three material additions surfaced by independent verification (a stronger routing-layer instance of PMF-002, a corrected identification of the actually-exploitable role for PMF-003, and a citation-path correction plus a broader race-condition finding for PMF-004/PMF-005 respectively). No P0 was found NOT REPRODUCIBLE, ALREADY FIXED, or BLOCKED. Five product-owner decisions are prepared with recommendations but explicitly not ratified by this document. No implementation, test, migration, or configuration change was made — this document is analysis only.

**VERIFICATION COMPLETE — PRODUCT-OWNER RATIFICATION REQUIRED**
