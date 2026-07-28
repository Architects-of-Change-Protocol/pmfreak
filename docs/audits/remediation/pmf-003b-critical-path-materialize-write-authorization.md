# PMF-003B Remediation — Critical-Path Materialization Write Authorization Hotfix

**Origin:** Discovered as residual debt during `PMF-003` (see PR #557 description
§"Discovered but out of scope" and `docs/audits/remediation/pmf-003-execution-task-write-authorization.md`
§2 "DISCOVERED, OUT OF SCOPE — same defect class, different module").
**Relationship to PMF-003:** Same defect class (read-level authorization
guarding a state-changing mutation) as the four call sites fixed in PR #557,
but in a different module (`src/lib/critical-path/*` vs.
`src/lib/execution-tasks/*`) and not named in the original `PMF-003` backlog
item, so it was explicitly deferred to this follow-up hotfix rather than
folded into PR #557.
**Branch:** `fix/critical-path-materialize-write-authorization`
**Prerequisite:** PR #557 (`fix/execution-task-write-authorization`, merge
commit `257ae44733b79c241e8f9981740bca512599ff18`, head `e35ec39da9d7ccea5268095d1668ad076ec3effc`) — confirmed merged into `main` before this work began.
**Status:** Fixed and verified

## 1. Affected route and symbols

- Route: `POST /api/critical-path/materialize`
- File: `src/app/api/critical-path/materialize/route.ts`
- Handler (added by this hotfix for testability): `handleMaterializeCriticalPath`
- Service invoked: `materializeCriticalPath` (`src/lib/critical-path/materialize-critical-path.ts`)
- Authorization helper: `requireProjectAccess` (`src/lib/security/server-authorization.ts`)
- Authentication helper: `requireAuthenticatedUser` (`src/lib/security/server-authorization.ts`)

### Runtime trace

```
POST /api/critical-path/materialize
  → requireAuthenticatedUser()                    (unchanged: 401 if absent)
  → parse { projectId } from body                 (unchanged: 400 if missing/invalid)
  → requireProjectAccess(projectId, "read")        ← VULNERABLE ARGUMENT (this fix: → "write")
  → materializeCriticalPath({ projectId })
      → loadGraph(projectId)                       reads execution_tasks / execution_task_dependencies / project_milestones scoped by projectId
      → validateGraph / forwardPass / backwardPass / computeFloat / computeCriticalPath
      → supabase.from("execution_tasks").update({ is_critical, early_start, early_finish,
          late_start, late_finish, total_float, free_float, variance_days,
          criticality_score }).eq("id", taskId)    ← the mutation, once per task in the project
  → response { ok, criticalTaskIds, projectFinish } (unchanged)
```

`requireProjectAccess` resolves workspace/tenant scope from the real project
row server-side (via `evaluateCapability` → `authorizeRuntimeAction`), never
from client-supplied identifiers — this was already true before the fix and
is unchanged by it.

## 2. Mutation performed

`materializeCriticalPath` overwrites nine scheduling/criticality columns on
every row of `execution_tasks` belonging to the project: `is_critical`,
`early_start`, `early_finish`, `late_start`, `late_finish`, `total_float`,
`free_float`, `variance_days`, `criticality_score`. This is unambiguously a
state-changing write, not a read — confirmed by direct inspection of
`materialize-critical-path.ts:49-67`.

No dedicated audit-event table write exists for this action; the only
"audit" signal is structured `console.log` (`critical_path.started` /
`critical_path.completed` / `critical_path.failed`) emitted from inside
`materializeCriticalPath` itself. A denied request never invokes
`materializeCriticalPath`, so it never emits any of these events — this was
verified directly in the regression tests via a call-count assertion on the
injected `materializeCriticalPath` fake.

## 3. Original authorization defect

`requireProjectAccess(projectId, "read")` (route.ts:27, pre-fix) authorized
this mutation on **read**-level project access. Because the live, DB-default
`"viewer"` workspace role (`src/lib/workspace-access.ts`) grants read access
to any workspace member, a viewer — or any other role with legitimate read
access but no write authority — could trigger a real, unconditional
recomputation and overwrite of every task's scheduling/criticality fields in
the project, exactly the pattern already confirmed and fixed for the four
`PMF-003` sites in PR #557.

## 4. Live viewer exploitability

Confirmed exploitable: `"viewer"` is the real, DB-default, currently
invitable workspace role (same conclusion as `PMF-003`, independently
re-derived here against this route specifically, not assumed from the prior
finding). The regression test `PMF-003B 1a` demonstrates a live-viewer actor
successfully reaching and completing materialization pre-fix (`200`
observed where `403` was required).

## 5. Tenant-isolation behavior

Unaffected by, and independent of, this fix. `requireProjectAccess` denies
any request where the resolved project's workspace does not match the
actor's workspace, regardless of the requested permission tier — this was
already true before the fix (cross-tenant denial tests pass pre-fix and
post-fix identically) and required no change. No cross-tenant exploit
exists in this endpoint before or after this hotfix.

## 6. Adjacent endpoint inventory

The `critical-path` module (`src/app/api/critical-path/`, `src/lib/critical-path/`)
contains exactly two HTTP handlers; no other `POST`/`PUT`/`PATCH`/`DELETE`
handlers, server actions, or additional persistence/materialization helpers
exist in this module:

| Route / symbol | Mutates? | Permission required | Permission enforced (pre-fix) | Tenant/project validation | Classification |
|---|---|---|---|---|---|
| `GET /api/critical-path` (`src/app/api/critical-path/route.ts`) | No — `getProjectCriticalPath` only reads (`src/lib/critical-path/repository.ts` contains no `.insert`/`.update`/`.delete`) | read | read | `requireProjectAccess(projectId, "read")` | `READ-ONLY` |
| `POST /api/critical-path/materialize` (`src/app/api/critical-path/materialize/route.ts`) | Yes — see §2 | write | read | `requireProjectAccess(projectId, "write")` (post-fix) | `VULNERABLE — SAME DEFECT CLASS` (pre-fix) → `SAFE — WRITE ENFORCED` (post-fix) |

The only UI entry point invoking the mutation is
`src/components/pmfreak/operational-shell.tsx:633` (`fetch("/api/critical-path/materialize", ...)`);
no other caller exists in the codebase.

No additional endpoints were modified. This inventory is scoped to the
`critical-path` module only, per the hotfix's explicit scope boundary — it is
not a repository-wide endpoint audit.

## 7. Canonical conventions reused (from PR #557)

- Authentication: `requireAuthenticatedUser()` → `401 { ok: false, error: "Unauthenticated." }` on failure.
- Write authorization: `requireProjectAccess(projectId, "write")` → `403 { ok: false, error: "Access denied." }` on failure (single, non-disclosing message — does not distinguish insufficient-role from cross-tenant, matching the canonical convention already used by the four PR #557 sites and by `execution-task-dependencies/materialize`).
- DI testability pattern: an exported `handle*(request, depsOverride)` function with a `defaultDeps` object of real implementations, and a thin `POST` export that delegates to it with no overrides — identical in shape to `handleMaterializeExecutionTaskDependencies` (`src/app/api/execution-task-dependencies/materialize/route.ts`), which this hotfix mirrors call-for-call.
- No literal `403`-vs-`404` distinction was forced for cross-tenant vs. not-found cases; the existing single `403 "Access denied."` response for any `requireProjectAccess` failure was preserved unchanged, consistent with the repository's existing convention on this exact route family.

## 8. Pre-fix failing-test evidence

Command: `npx tsx --test tests/critical-path-materialize-write-authorization.test.mjs`
(run immediately after the DI refactor, before changing `"read"` → `"write"`).

```
1..6
# tests 6
# suites 0
# pass 5
# fail 1
```

The single failure was the viewer-denial test:

```
not ok 1 - PMF-003B 1a. viewer denial: live viewer role cannot materialize critical-path state
  error: |-
    Expected values to be strictly equal:
    200 !== 403
```

The other 5 tests (writer success, cross-tenant denial, unauthenticated
denial, direct-object injection, repeat-call) already passed pre-fix,
confirming the failure was specifically and only the read-authorizes-write
defect — not a broken fixture, import error, missing dependency, incorrect
mock, or changed response shape. Writer-success behavior (test `1b`) was
confirmed intact both before and after the fix.

## 9. Minimal production fix

Single-argument change in `src/app/api/critical-path/materialize/route.ts`:

```diff
- await deps.requireProjectAccess(projectId, "read");
+ await deps.requireProjectAccess(projectId, "write");
```

Alongside this, the route was refactored into the same DI shape as its
sibling `execution-task-dependencies/materialize` route (an exported
`handleMaterializeCriticalPath(request, depsOverride)` with a `POST` export
that delegates to it) so the authorization boundary can be exercised in
tests without a live backend. This is a testability change only — the
`POST` export's runtime behavior with no overrides is byte-for-byte
equivalent to the pre-refactor handler, aside from the permission argument.
No other logic, response contract, error mapping, or persistence semantics
were changed.

## 10. Post-fix passing-test evidence

Command: `npx tsx --test tests/critical-path-materialize-write-authorization.test.mjs`
(run after the `"read"` → `"write"` fix).

```
1..6
# tests 6
# suites 0
# pass 6
# fail 0
```

## 11. Tests added

New file: `tests/critical-path-materialize-write-authorization.test.mjs` (6 tests).

**Why a new file instead of extending `tests/execution-task-write-authorization.test.mjs`:**
this endpoint is invoked by `projectId` alone — it has no secondary
task/dependency resource id to load and derive scope from, unlike the four
`PMF-003` call sites — so its fixtures (no fake Supabase table seeding
needed; the service itself is injected as a fake) and its direct-object-
injection scenario (a spoofed extra body field vs. a spoofed secondary
resource id) differ enough that sharing the file would blur rather than
clarify the boundary. It reuses the identical DI/fake-`requireProjectAccess`
pattern and `ROLE_RANK` model from that file.

Coverage:

- **1a — viewer denial:** live `viewer` role denied `403`; `materializeCriticalPath` never invoked (zero mutation, zero audit log emission).
- **1b — writer success:** `pm` role succeeds `200`; existing response contract (`ok`, `criticalTaskIds`, `projectFinish`) preserved; materialization invoked exactly once with the correct `projectId`.
- **1c — cross-tenant denial:** `pm` in workspace A denied `403` for a project in workspace B; zero mutation; response does not disclose the foreign workspace id; canonical non-disclosing `"Access denied."` message.
- **1d — unauthenticated denial:** `401`; authorization never evaluated (`requireProjectAccess.calls.length === 0`); zero mutation.
- **1e — direct-object injection:** a spoofed `workspaceId` field in the request body is proven inert — authorization is evaluated against the real target `projectId` only, and the spoofed claim cannot grant cross-tenant access.
- **1f — repeat-call:** two consecutive authorized calls each independently succeed and each independently re-run the computation — documents the existing (non-deduplicating, non-idempotent-guarded) contract rather than inventing new behavior.

## 12. Broader validation

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `npx tsx --test tests/critical-path-materialize-write-authorization.test.mjs` | 0 | 6/6 pass (post-fix; 5/6 pre-fix, see §8) |
| 2 | `npx tsx --test tests/execution-task-write-authorization.test.mjs` | 0 | 17/17 pass (PMF-003 suite unaffected) |
| 3 | `npx tsx --test tests/critical-path.test.mjs` | 0 | 151/151 pass |
| 4 | `npx tsx --test tests/critical-path-intelligence.test.mjs` | 0 | 2/2 pass |
| 5 | `npx tsx --test tests/execution-tasks.test.mjs tests/execution-task-dependencies.test.mjs tests/route-guard-consistency.test.mjs` | 0 | 212/212 pass |
| 6 | `npx tsx --test tests/authority-governance.test.mjs tests/authorization-adversarial-contract.test.mjs tests/authorization-adversarial-phase-4-3.test.mjs tests/authorization-adversarial-phase-4-5.test.mjs tests/billing-authorization-workspace-membership.test.mjs tests/billing-checkout-session-route.test.mjs tests/dashboard-authorization-enforcement-runtime.test.mjs tests/dashboard-role-authorization-runtime.test.mjs tests/delegated-authority-contract.test.mjs tests/invite-workspace-role-boundary.test.mjs tests/local-authority-bypass-hardening.test.mjs tests/runtime-authority-provider-resolution.test.mjs tests/signup-role-escalation.test.mjs tests/tenant-isolation-contract.test.mjs tests/vault-intake-authorization.test.ts tests/workspace-role-update-boundary.test.mjs` | 0 | 244/244 pass |
| 7 | `npm run typecheck` (`tsc --noEmit`) | 0 | 0 errors |
| 8 | `npm run lint` | 0 | 0 errors, 614 warnings (pre-existing `@typescript-eslint/no-unused-vars` in test files — identical count to the PR #557 baseline) |
| 9 | `npm run build` | 0 | Success, all routes generated, including `/api/critical-path/materialize` |
| 10 | `npm test` (full suite) | 0 | 12,816/12,816 pass (baseline 12,810 from PR #557 + 6 new) |

All targeted security tests pass. The full suite completed (not timed out or
partial) at 12,816/12,816.

## 13. Files changed

- `src/app/api/critical-path/materialize/route.ts` — DI refactor + permission argument `"read"` → `"write"`
- `tests/critical-path-materialize-write-authorization.test.mjs` (new)
- `docs/audits/remediation/pmf-003b-critical-path-materialize-write-authorization.md` (new, this file)

No other file was modified. `docs/audits/remediation/pmf-003-execution-task-write-authorization.md`, the original audit, the backlog JSON, and the decision brief were not touched.

## 14. Residual debt

1. **AOC governance-core call-chain tracing:** the same disclosed static-reading ambiguity in the `requireProjectAccess` → `evaluateCapability` → `authorizeRuntimeAction` → governance-core chain noted in the `PMF-003` remediation record (§3) and the independent decision brief (§5 item 12) applies identically here, since this fix reuses the same helper. Not re-traced dynamically in this hotfix.
2. **No live-backend end-to-end test:** consistent with the `PMF-003` precedent, the new tests inject a faithful model of the real `requireProjectAccess` role/tenant semantics rather than exercising a live Supabase instance against a real `viewer`-role session.
3. **No dedicated audit-event table for critical-path materialization:** the only signal is structured `console.log`; this predates the hotfix and was not introduced or altered by it. Out of scope to add a persisted audit trail here — that would be a product change, not a minimal authorization fix.

## 15. Explicit non-goals honored

No changes were made to: `rbac.ts`/the broader permission model, RLS
policies, application roles or role seeds, onboarding, PMO cardinality or
activation, Project Brain, evidence ingestion, Portfolio, Command Center
entity scope, terminology, critical-path algorithm/schedule/dependency
calculations, performance, the `PMF-003` remediation record, the original
audit, the backlog JSON, the decision brief, or any file outside the three
listed in §13.
