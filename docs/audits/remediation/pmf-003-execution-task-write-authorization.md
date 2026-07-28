# PMF-003 Remediation — Execution-Task/Dependency Write Authorization Hotfix

**Backlog item:** `PMF-003` (`docs/audits/pmfreak-post-merge-backlog.json`), P0, security-authorization
**Source audit:** `docs/audits/pmfreak-post-merge-critical-path-audit.md` §12
**Independent verification:** `docs/audits/pmfreak-remediation-decision-brief.md` §5, §7 (branch `docs/pmfreak-remediation-decision-brief`, commit `6c20a995`)
**Branch:** `fix/execution-task-write-authorization`
**Status:** Fixed and verified

## 1. Vulnerability

Four legacy execution-task and task-dependency mutation call sites authorized
on `requireProjectAccess(id, "read")` instead of `"write"`. Any authenticated
workspace member with **read-only** access — including the live, DB-default
`"viewer"` workspace role (`src/lib/workspace-access.ts`, invitable today via
the production `/team` invite UI and its server action) — could reassign task
ownership, change task status/due-date/progress, and create/materialize task
dependencies through these routes, even though the corresponding UI hides the
controls that would normally trigger them.

The audit's own evidence cited the `rbac.ts` `executive_viewer`/
`external_stakeholder` role taxonomy as the exploitable actors. Independent
verification (decision brief §5, §7) corrected this: that taxonomy is dead
code, never consulted by the live authorization path. The actually
exploitable, live, production-assignable role is the DB-default `"viewer"`
role. This distinction does not change the fix (the permission argument was
wrong regardless of which role name is cited) but does confirm the exposure
was active in production, not latent.

### UI gating was not authorization

`src/app/(protected)/projects/[id]/page.tsx` hides mutation controls for
`role === "viewer"`, and the sibling `[taskId]` route's `GET` handler
independently hides Task Detail drawer controls behind its own `"write"`
check — but the quick-status control still called the defective `/update`
endpoint directly. A direct request to any of the four endpoints bypassed the
UI entirely; no client-side control provided any actual protection.

### Cross-tenant boundary

Independent of read/write, `requireProjectAccess` resolves workspace scope
from the project row server-side and never trusts a client-supplied
workspace/project id. No cross-tenant exploit existed before or after this
fix — the defect's blast radius was strictly "any workspace member with the
`viewer` role can mutate any task within a workspace they legitimately
belong to," not cross-tenant.

## 2. Affected endpoints (full inventory)

### VULNERABLE — READ AUTHORIZES WRITE (fixed in this branch)

| # | Route / symbol | Mutation | Fix |
|---|---|---|---|
| 1 | `POST /api/execution-tasks/update` (`src/app/api/execution-tasks/update/route.ts`) | status, owner, progress, due-date changes on `execution_tasks` | `requireProjectAccess(task.project_id, "read")` → `"write"` |
| 2 | `POST /api/execution-task-dependencies/update` (`src/app/api/execution-task-dependencies/update/route.ts`) | status transitions on `execution_task_dependencies` | `requireProjectAccess(dep.project_id, "read")` → `"write"` |
| 3 | `createExecutionTaskDependency` (`src/lib/execution-tasks/dependencies/create-dependency.ts`), invoked by `POST /api/execution-task-dependencies` | dependency creation | `requireProjectAccess(predTask.project_id, "read")` → `"write"` |
| 4 | `POST /api/execution-task-dependencies/materialize` (`src/app/api/execution-task-dependencies/materialize/route.ts`) | bulk dependency materialization | `requireProjectAccess(projectId, "read")` → `"write"` |

### SAFE — WRITE AUTHORITY ALREADY ENFORCED (no change)

- `PATCH /api/execution-tasks/[taskId]` — `requireProjectAccess(task.project_id, "write")`; its own code comment already named the legacy `/update` route as the deferred gap this hotfix closes.
- `POST /api/execution-tasks` (direct/"Quick Add Task" creation) → `createExecutionTaskDirect` — `requireProjectAccess(project.id, "write")`.
- `POST /api/execution-tasks/convert` → `convertTaskDraftToExecutionTask` — `requireProjectAccess(draft.project_id, "write")`.
- `src/lib/schedule/task-schedule.ts` (`updateExecutionTaskSchedule`) — `"write"`.
- `src/lib/schedule/milestones.ts` (create/update/complete/cancel) — `"write"` (fixed previously by PR #514 / commit `128726f`, "Perilla 8" — the precedent this hotfix follows).

### NOT A MUTATION (read-only, correctly read-gated — no change)

- `GET /api/execution-tasks`, `GET /api/execution-tasks/activity`, `GET /api/execution-tasks/[taskId]`, `GET /api/execution-tasks/daily`, `GET /api/execution-task-dependencies`, `GET /api/execution-task-graph`.

### DISCOVERED, OUT OF SCOPE — same defect class, different module

`POST /api/critical-path/materialize` (`src/app/api/critical-path/materialize/route.ts:27`) gates `materializeCriticalPath` — which writes `is_critical`, `early_start`, `early_finish`, `late_start`, `late_finish`, `total_float`, `free_float`, `variance_days`, `criticality_score` to `execution_tasks` — on `requireProjectAccess(projectId, "read")`. This is the identical defect pattern but lives in the `critical-path` module, is not named in the `PMF-003` backlog item, the audit, or the decision brief, and its fix is separable from closing `PMF-003`. **Not fixed in this branch.** Flagged here for a separate security remediation ticket.

## 3. Canonical fix

`requireProjectAccess(projectId, permission)` (`src/lib/security/server-authorization.ts`) is the repository's single canonical project-scoped authorization helper, already used correctly by the sibling `[taskId]` PATCH route, `create-execution-task.ts`, `convert-task-draft.ts`, `task-schedule.ts`, and `milestones.ts`. This hotfix makes the four vulnerable call sites use the exact same helper the same way those routes already do — a call-site argument correction (`"read"` → `"write"`), not a new authorization mechanism, not a change to `rbac.ts`, and not an RLS change. This matches `PMF-003`'s own `implementationBoundary` and `nonGoals` in the backlog, and mirrors the precedent set by PR #514 (`128726f`, "Perilla 8"), which fixed the identical pattern for `milestones.ts`/`task-schedule.ts`/`convert-task-draft.ts` one day after it was introduced.

Denial semantics were preserved unchanged: every route already caught any thrown authorization error and returned its existing `403` response (`"Access denied."` / `"Authorization check failed/failed."`) — this hotfix does not alter status codes, response shapes, or error messages, only which permission tier is requested.

### Residual verification gap (disclosed, not blocking)

Tracing `requireProjectAccess` → `evaluateCapability` → `authorizeRuntimeAction` → the AOC enterprise-runtime governance-policy registry (`src/aoc/enterprise/runtime/governance-core.ts`) appears, from static reading alone, to re-enter the same authorization entrypoint in a way that is hard to fully resolve without a live/dynamic trace. The independent decision brief (§5 item 12) flagged this identical ambiguity and concluded it does not weaken the finding, citing the working `128726f` precedent as first-party evidence the read/write distinction has real effect in production. This hotfix relies on the same evidence and does not attempt to re-trace or refactor the AOC governance core — that is out of scope for a minimal call-site fix and is carried forward as the same disclosed residual debt.

## 4. Tests added

New file: `tests/execution-task-write-authorization.test.mjs` (17 tests).

Each of the four vulnerable call sites was made dependency-injectable
(`handleUpdateExecutionTask`, `handleUpdateExecutionTaskDependency`,
`handleMaterializeExecutionTaskDependencies`, and an added `depsOverride`
parameter on `createExecutionTaskDependency`), following the exact DI
pattern already established in this repository for testing authorization
boundaries without a live backend (see `tests/vault-intake-authorization.test.ts`
and `tests/billing-checkout-session-route.test.mjs` — "same DI pattern as the
billing routes"). `POST` exports are unchanged in behavior; they now delegate
to the testable `handle*` function with real default dependencies.

For each of the 4 call sites, 4–5 tests exercise the real
authentication → permission-argument → resource-scope → mutation chain
against an in-memory fake Supabase store and a fake `requireProjectAccess`
that models the live, DB-default `WORKSPACE_ROLES` rank
(`owner > admin > pm > viewer`, `src/lib/workspace-access.ts`): `"read"` is
granted to any workspace member, `"write"` only to `pm`/`admin`/`owner`, and
any request for a project outside the actor's own workspace is denied
regardless of permission (modeling the real, RLS-independent server-side
scope derivation already verified safe by the decision brief).

- **Viewer denial** (`*a` tests): a live `viewer`-role actor attempts the
  mutation; asserts `403`/`ok:false`, zero rows changed in the fake store,
  and zero `execution_task_events` rows written.
- **Write-capable success** (`*b` tests): a `pm`-role actor performs the same
  mutation; asserts success, the expected state change, and the expected
  audit event.
- **Cross-tenant denial** (`*c` tests): a `pm` in workspace A targets a
  resource owned by workspace B; asserts denial, zero state change, and that
  the response body does not disclose the foreign workspace id.
- **Unauthenticated denial** (`*d` tests): asserts `401`/`ok:false` and that
  the permission check is never even evaluated (authentication short-circuits
  before authorization).
- **Direct-object injection** (test `1e`, execution-tasks/update only): a
  client-supplied `projectId` in the request body is ignored — the
  permission check always uses the project id resolved from the
  DB-loaded task row.

These tests exercise the real production logic of the routes/service
(unmodified business logic, only the auth/DB dependencies are swapped for
fakes) — they are not source-text/regex assertions.

### Residual test-coverage debt (disclosed)

This repository has no live Supabase/Next.js request-context test harness
(routes call `createSupabaseServerClient()`, which uses `next/headers`
`cookies()` and a real network connection — not fakeable without a live
backend). The tests above therefore inject a faithful model of the real
`requireProjectAccess` role/tenant semantics rather than exercising the full,
live AOC governance-core call chain end-to-end. This is the same limitation,
and the same disclosed mitigation, as the repository's own precedent tests
(`tests/vault-intake-authorization.test.ts`, `tests/billing-checkout-session-route.test.mjs`).
A true end-to-end run against a live Supabase test database, with a real
`viewer`-role session, was not performed in this sprint and is carried
forward as residual verification debt — consistent with the decision
brief's own disclosed limitation on this exact call chain (§5 item 12).

## 5. Pre-fix failing-test evidence

Command: `npx tsx --test tests/execution-task-write-authorization.test.mjs`
(run after the DI refactor, before the `"read"` → `"write"` fix).

```
1..17
# tests 17
# suites 0
# pass 13
# fail 4
```

The 4 failures were exactly the 4 viewer-denial tests (`PMF-003 1a`, `2a`,
`3a`, `4a`) — each asserting `403`/denial but observing `200`/`ok:true`
(the viewer-role actor's mutation succeeded). Example:

```
not ok 1 - PMF-003 1a. viewer denial: live viewer role cannot reassign a task via /api/execution-tasks/update
  error: |-
    Expected values to be strictly equal:
    200 !== 403
```

All 13 non-viewer-denial tests (write-capable success, cross-tenant denial,
unauthenticated denial, direct-object injection) already passed pre-fix,
confirming the failures were specifically and only the read-authorizes-write
defect, not a broken fixture or environment issue.

## 6. Post-fix passing-test evidence

Command: `npx tsx --test tests/execution-task-write-authorization.test.mjs`
(run after the `"read"` → `"write"` fix).

```
1..17
# tests 17
# suites 0
# pass 17
# fail 0
```

## 7. Cross-tenant behavior

Verified unchanged and safe: cross-tenant denial tests (`1c`, `2c`, `3c`,
`4c`) pass both before and after the fix — this hotfix did not alter, and
did not need to alter, cross-tenant enforcement. `requireProjectAccess`
already derived workspace scope from the server-loaded resource row in every
case, never from client input.

## 8. Files changed

- `src/app/api/execution-tasks/update/route.ts`
- `src/app/api/execution-task-dependencies/update/route.ts`
- `src/app/api/execution-task-dependencies/materialize/route.ts`
- `src/lib/execution-tasks/dependencies/create-dependency.ts`
- `tests/execution-task-write-authorization.test.mjs` (new)
- `docs/audits/remediation/pmf-003-execution-task-write-authorization.md` (new, this file)

## 9. Validation commands and results

| Command | Exit | Result |
|---|---|---|
| `npx tsx --test tests/execution-task-write-authorization.test.mjs` | 0 | 17/17 pass (post-fix) |
| `npx tsx --test tests/execution-tasks.test.mjs tests/execution-task-dependencies.test.mjs tests/route-guard-consistency.test.mjs` | 0 | 212/212 pass |
| `npx tsx --test tests/authority-governance.test.mjs tests/authorization-adversarial-contract.test.mjs tests/authorization-adversarial-phase-4-3.test.mjs tests/authorization-adversarial-phase-4-5.test.mjs tests/billing-authorization-workspace-membership.test.mjs tests/billing-checkout-session-route.test.mjs tests/delegated-authority-contract.test.mjs tests/invite-workspace-role-boundary.test.mjs tests/local-authority-bypass-hardening.test.mjs tests/runtime-authority-provider-resolution.test.mjs tests/signup-role-escalation.test.mjs tests/tenant-isolation-contract.test.mjs tests/vault-intake-authorization.test.ts tests/vault-intake.test.mjs tests/workspace-role-update-boundary.test.mjs tests/dashboard-authorization-enforcement-runtime.test.mjs tests/dashboard-role-authorization-runtime.test.mjs` | 0 | 259/259 pass |
| `npm run typecheck` | 0 | 0 errors |
| `npm run lint` | 0 | 0 errors, 614 warnings (pre-existing `@typescript-eslint/no-unused-vars` in test files — identical count to the audit's own §13 baseline) |
| `npm run build` | 0 | Success, all routes generated, no new warnings introduced by this change |
| `npm test` (full suite) | 0 | 12,810/12,810 pass (baseline 12,793 + 17 new) |

## 10. Residual security debt

1. **Same defect class, different module, out of scope:** `POST /api/critical-path/materialize` — see §2. Recommend a follow-up `PMF-0xx` ticket.
2. **AOC governance-core call-chain tracing:** the apparent mutual re-entry noted in §3 was not dynamically traced in this sprint (matches the decision brief's own disclosed limitation, §5 item 12).
3. **No live-backend end-to-end test:** see §4's residual test-coverage debt — the new tests model the real role/tenant semantics faithfully but do not exercise a live Supabase instance.
4. Pre-existing, unrelated findings from the same audit (`PMF-014` no explicit membership check on `operational-governance-brief`; `PMF-016` unchecked audit-event writes; `PMF-020`, `PMF-021`) are explicitly out of scope for this hotfix and were not touched.

## 11. Explicit non-goals honored

No changes were made to: `rbac.ts`/the broader permission model, RLS policies, application roles or role seeds, onboarding, PMO cardinality/activation, Project Brain or evidence ingestion, UI, or any file outside the four call sites and their supporting test/doc.
