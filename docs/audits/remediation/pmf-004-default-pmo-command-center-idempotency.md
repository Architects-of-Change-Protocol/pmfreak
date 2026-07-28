# PMF-004 — Default PMO & Command Center Activation Idempotency

## 1. Backlog item

`PMF-004` (`docs/audits/pmfreak-post-merge-backlog.json`, P0, `data-integrity`): *"`pmos` table lacks unique constraint on `workspace_id` — duplicate-PMO race condition."* Independently re-verified in `docs/audits/pmfreak-remediation-decision-brief.md` §5 (PMF-004) and §8, which additionally found a structurally identical, unfixed race in `ensureUserWorkspace` (workspace bootstrap) — explicitly folded into this sprint's scope per its own task description ("unguarded check-then-insert behavior in paths such as `savePmoTenant`; `ensureUserWorkspace`...").

Prerequisites verified before starting: PR #557 (`fix(auth): enforce write authorization on execution mutations`) and PR #558 (`fix(auth): secure critical-path materialization`) are both merged into `main` (`merged: true`, confirmed via the GitHub API), and this branch started from `origin/main` at `eb1c018` with a clean, 0-ahead/0-behind worktree.

## 2. Ratified multi-PMO invariant

Multiple PMOs per workspace are supported. Default PMO bootstrap must converge to one canonical default identity per workspace. Global uniqueness on `pmos.workspace_id` is prohibited. This matches `ADR-PMF-003` Rule 1 ("A Workspace may contain multiple PMOs") and the decision brief's own recommendation (§16, §19 item 3), whose ratification answer for Decision 3 was still `PENDING` — updated by this sprint per its own instruction (task §17) to reflect the above, since it is exactly what this sprint's own ratified decision states. No other decision-brief answer was touched.

## 3. Creation-path inventory

| Path | File | Table(s) written | Concurrency mechanism (before) | Concurrency mechanism (after) | Classification (before) |
|---|---|---|---|---|---|
| `savePmoTenant` | `src/lib/pmo/save-pmo-tenant.ts` | `workspace_governance` (upsert, already safe), `workspaces` (update), `pmos` | `workspace_governance`: safe (`upsert` on `workspace_id`). `pmos`: raw `SELECT ... .limit(1).maybeSingle()` (no `ORDER BY`) then `INSERT` else `UPDATE` — two unguarded round trips | `pmos`: single call to `ensure_default_pmo` RPC (advisory-lock guarded) with `p_sync_existing: true` | `VULNERABLE — CHECK THEN INSERT` |
| `ensureUserWorkspace` | `src/lib/workspaces.ts` | `workspace_memberships` (read), `workspaces` (insert), `workspace_memberships` (insert) | Raw `SELECT` then `INSERT workspaces` + `INSERT workspace_memberships` — two unguarded round trips | Single call to `ensure_user_workspace` RPC (advisory-lock guarded, keyed by `user_id`) | `VULNERABLE — CHECK THEN INSERT` |
| `ensureDefaultPmo` (`pmo-service.ts`) | `src/lib/pmos/pmo-service.ts` | `pmos` | Already safe: single call to `ensure_default_pmo` RPC (migration `20260828000002`) | Same RPC, now with two additional optional parameters (`pmoType`, `syncExisting`) that default to the prior behavior for existing callers | `SAFE — IDEMPOTENT` (unchanged) |
| `createWorkspace` (explicit "New Workspace" flow) | `src/lib/workspaces.ts` | `workspaces`, `workspace_memberships` | Raw insert, no get-or-create semantics — by design, this always creates an *additional* workspace, never resolves to an existing one | Unchanged | `SAFE — EXPLICIT MULTI-* CREATION` (an explicit "create a new workspace" action has no idempotency contract to begin with — not a default-identity path) |
| `createPmo` / `duplicatePmo` (`pmo-service.ts`) | `src/lib/pmos/pmo-service.ts` | `pmos` | Raw insert, explicit user-requested creation | Unchanged | `SAFE — EXPLICIT MULTI-PMO CREATION` (explicit non-default PMO creation is intentionally not idempotent against the default — per this sprint's ratified boundary) |
| Callers of `ensureDefaultPmo`: `command-center/actions.ts`, `api/getting-started/route.ts`, `create-minimal-project.ts`, `save-project-onboarding.ts` | various | `pmos` (via `ensureDefaultPmo`) | Already safe (delegates to the RPC) | Unchanged; all four still call `ensureDefaultPmo(workspaceId, userId, name)` with no new options, so `p_sync_existing` defaults to `false` — a project-creation call can never rename the workspace's existing default PMO | `SAFE — IDEMPOTENT` (unchanged) |
| Migration backfill (one-time) | `supabase/migrations/20260828000001_workspace_pmo_project_hierarchy.sql` | `pmos` | Advisory-lock-guarded `DO` block (`pg_advisory_xact_lock`) | Unchanged — out of scope, already safe | `SAFE — IDEMPOTENT` (unchanged) |
| `create-pmo-wizard.tsx` (`inFlightRef`) | `src/components/pmfreak/pmo/create-pmo-wizard.tsx` | N/A (client-side guard only) | Same-tab-only re-entry guard; does not protect against two tabs or a genuine retry | Unchanged (client-side guards are explicitly not a substitute for server-side idempotency per this sprint's required properties; the server-side fix makes the client-side gap safe rather than needing to close it client-side) | `SAFE — IDEMPOTENT` (client guard is a UX nicety layered on top of a now-idempotent server operation, not the source of correctness) |

No other creation/selection paths for workspace, PMO, default PMO, Command Center root, activation record, activation context, default-PMO membership, or associated audit event were found. Command Center has no distinct table (`docs/architecture/command-center-foundation.md:14`) — it is the `workspaces` row itself, already covered above via `savePmoTenant`'s `workspaces` update (which is idempotent regardless of race, since it is a plain `UPDATE ... WHERE id = $1`, not a create).

## 4. Default-PMO representation

**Current schema representation:** no `is_default` column, no `default_pmo_id` reference on `workspaces`, and no other explicit discriminator exists on `pmos`. The *only* existing convention — already implemented by `ensure_default_pmo()` (migration `20260828000002`) and by the migration-backfill's own project-attachment logic (`20260828000001`, `order by created_at asc limit 1`) — is: **the oldest active PMO row for a given `workspace_id`** (`status = 'active'`, `order by created_at asc`, `limit 1`).

Per the decision rule in this sprint's task description ("reuse a current durable, explicit default-PMO identifier if one exists" before inventing anything new), this existing convention is reused rather than replaced. It is:
- **Durable**: based on `created_at`, immutable once set.
- **Survives renaming**: unaffected by `name`/`pmo_type` changes.
- **Tenant-scoped**: keyed by `workspace_id`.
- **Not currently ambiguous** in this codebase's own data model, because nothing else ever attempted to encode a *separate*, conflicting notion of "default" — the only two callers that materialize a workspace's default PMO (`ensureDefaultPmo` and, after this fix, `savePmoTenant`) both resolve it via this same convention now.
- Legitimate non-default PMOs coexist without conflict, since they are simply PMOs with a later `created_at` — never selected by the "oldest active" query, never renamed by it, never counted against it.

No new column, index, or reference was added. Application-level locking alone would not have been sufficient on its own (it does not survive multiple server instances/processes), which is why the mechanism is a database-level advisory lock, not a JS-level mutex — but the *identity* itself did not need a new representation, only a shared, race-safe implementation.

## 5. Existing-data preflight

No configured Supabase/production database is available in this environment (confirmed: no `SUPABASE_URL`/`DATABASE_URL`/`POSTGRES*` env vars set, no `.env` beyond `.env.example`/`.env.operational-flow.example`). Per the task's own instructions, no attempt was made to query an unknown database, and no claim is made about production data cleanliness.

A local PostgreSQL 16 server is available in this sandboxed environment (`postgresql-16`, initially stopped) and was used to build a real, executable concurrency test harness against a fresh, disposable database and a minimal fixture schema derived verbatim from the relevant production migrations (see §11). This is schema/code-level verification, not a preflight against any real tenant data, and does not substitute for one.

No ambiguous existing defaults were found or could be found, since no production data was inspected. This is disclosed as residual environment-dependent coverage in §17, not claimed as a completed data audit.

## 6. Pre-fix race evidence

The vulnerable application code (`savePmoTenant`'s `pmos` section, `ensureUserWorkspace`) could never be executed end-to-end in this repository's test environment even before this fix — both require a live Supabase backend (`getAuthUser()`, JWT-backed cookies, a real Postgres with the full Supabase schema and RLS), which PR #557/#558's own residual-debt disclosures confirm has never been available here. Per this sprint's task description §10 ("if the race cannot be executably demonstrated... use the strongest meaningful service/database test available"), the race is instead demonstrated one level down: against a real PostgreSQL instance, using the exact SQL pattern the removed application code executed.

`tests/pmf-004-default-pmo-command-center-idempotency.test.mjs` reproduces, against a real table with real overlapping transactions:

- **`savePmoTenant`'s removed pattern** (`racerCheckThenInsertPmo`): a `SELECT count(*)` existence check, an inter-process delay modelling the real gap between two separate Supabase round trips, then a conditional `INSERT`. Run twice concurrently for one brand-new workspace:

  ```
  npx tsx --test tests/pmf-004-default-pmo-command-center-idempotency.test.mjs
  ```
  Result (pre-fix-pattern test, run in isolation against the *removed* SQL shape): **2 `pmos` rows** for one workspace — the exact defect PMF-004 reports.

- **`ensureUserWorkspace`'s removed pattern** (`racerCheckThenInsertWorkspace`): same shape, against `workspace_memberships`/`workspaces`. Result: **2 independent `workspaces` rows** for one user — the sibling race this sprint's scope explicitly names.

These two tests will keep passing forever (they intentionally exercise the *old*, no-longer-present application pattern directly in SQL, not the current TypeScript), serving as a permanent, executable record of why the lock-guarded RPC is necessary — since nothing at the database level (no constraint was added, per the ratified invariant) prevents this class of race on its own; only routing through `ensure_default_pmo`/`ensure_user_workspace` does.

Confirmed not a fixture/import/environment error: the same test file's post-fix tests, using the identical database/fixture/harness, reliably produce exactly 1 row under the same and higher concurrency (§9), so the harness itself is proven capable of both outcomes — the difference is exclusively which code path is exercised.

## 7. Selected concurrency strategy

**Extend the existing, already-correct `ensure_default_pmo` advisory-lock pattern** (migration `20260828000002`) rather than inventing a second mechanism, and add one sibling function (`ensure_user_workspace`) using the identical pattern for the workspace-bootstrap race. This was the clear preference per the task's own decision order ("prefer an existing proven pattern, particularly if `ensureDefaultPmo` already solves the same race safely").

`supabase/migrations/20260831000000_pmo_command_center_activation_idempotency.sql`:

1. **Drops and recreates `ensure_default_pmo`** with two new, defaulted parameters: `p_pmo_type text default null` and `p_sync_existing boolean default false`. Existing callers (`pmo-service.ts`'s project-creation paths) are unaffected — they omit both, preserving exact prior behavior (create-once, never rename). `savePmoTenant` is the only caller that passes `p_pmo_type` and `p_sync_existing: true`, restoring its pre-existing "keep the pmos row in sync with a rename" behavior, now done atomically inside the same locked function instead of via a separate, unguarded `UPDATE`.
2. **Adds `ensure_user_workspace(p_user_id, p_default_name)`**, the same `pg_advisory_xact_lock` pattern keyed by `hashtext('pmfreak_ensure_user_workspace_' || p_user_id::text)`, for the workspace-bootstrap race in `ensureUserWorkspace`.

**Why the same function/lock for both the project-creation path and the Command Center activation path:** if `savePmoTenant` used a *different* lock key than `ensureDefaultPmo`'s project-creation callers, a project-creation call and a Command-Center-activation call racing for the same brand-new workspace could each acquire their own lock and both still observe zero PMOs — reintroducing the exact race under a different pair of entry points. Routing both through one function with one lock key is what actually closes the race for every entry point, not just within each entry point individually.

**Why a lock, not a scoped unique index:** a partial unique index (e.g., on "the single oldest row per workspace") cannot be expressed declaratively in Postgres — "oldest" is not a property a `UNIQUE`/`EXCLUDE` constraint can enforce, since it depends on comparing rows to each other, not to a fixed key. A `pg_advisory_xact_lock` correctly serializes the read-then-write sequence itself, which is the actual defect (a race in *behavior*, not a missing constraint on *shape*).

**Required properties, satisfied:**
- Operates at the database boundary (a Postgres function), not client-side or process-local — correct across multiple server instances.
- Preserves multiple PMOs per workspace (no constraint added; `pmos` schema is untouched).
- Losing callers re-read and return the winner's row inside the same function call — no separate re-read step needed by callers.
- No arbitrary record selection — always the oldest active row, by explicit `ORDER BY`.
- Safe on retry and after client timeout (§13).
- No raw constraint/lock error is ever visible to a caller — advisory locks block rather than raise, and there is no unique constraint to violate.
- Tenant isolation preserved — locks are keyed by `workspace_id`/`user_id`, never shared across tenants (verified in §9).

**Why global `UNIQUE(workspace_id)` on `pmos` was not added:** this is the one thing the ratified invariant (§2) explicitly forbids — it would make legitimate multiple PMOs per workspace impossible, directly contradicting `ADR-PMF-003` Rule 1. No unique index of any kind was added to `pmos` by this migration.

## 8. Production implementation

- `supabase/migrations/20260831000000_pmo_command_center_activation_idempotency.sql` — the two functions described in §7.
- `src/lib/pmos/pmo-service.ts` — `ensureDefaultPmo()` gains an optional fourth parameter (`EnsureDefaultPmoOptions { pmoType?, syncExisting? }`), passed through to the RPC; existing call sites are unchanged and get identical behavior (both options default to their prior effective values).
- `src/lib/pmo/save-pmo-tenant.ts` — the `pmos` check-then-insert-or-update block (previously two separate `SELECT`/`INSERT`/`UPDATE` calls) replaced by one call to `supabaseClient.rpc("ensure_default_pmo", { p_workspace_id, p_name: tenant.identity.pmoName, p_created_by_user_id: user.id, p_pmo_type: commandCenterType, p_sync_existing: true })`. On RPC failure, the existing `pmo.create.pmo_entity_warn` non-fatal warn-and-continue behavior is preserved exactly (the overall activation still reports `success`, matching prior behavior — the `pmos` row has always been a best-effort materialization relative to the authoritative `workspace_governance` upsert).
- `src/lib/workspaces.ts` — `ensureUserWorkspace()`'s create branch (previously a raw `workspaces` insert + a call to `ensureWorkspaceMembership`) replaced by one call to `supabase.rpc("ensure_user_workspace", { p_user_id: userId, p_default_name: "Workspace" })`, followed by a plain read of the resulting membership row's `role` (safe — the membership is guaranteed to exist by the time the RPC returns, no race on this read). Explicit return-type annotation added (`Promise<{ workspaceId: string; role: WorkspaceContext["role"]; created: boolean }>`) to keep the function's public contract pinned regardless of the RPC's loosely-typed response shape (the Supabase client here has no generated `Database` generic, so `.rpc()` returns a loosely-typed result — the existing `ensureDefaultPmo()` already handled this the same way via an explicit cast, now mirrored here).

## 9. Caller migration map

| Caller | Change |
|---|---|
| `src/app/(protected)/command-center/actions.ts` (`activateContextAction`) | None — calls `ensureDefaultPmo(workspaceId, userId)` with no new options; behavior unchanged |
| `src/app/api/getting-started/route.ts` | None — same as above |
| `src/lib/projects/create-minimal-project.ts` | None — same as above |
| `src/lib/projects/save-project-onboarding.ts` | None — same as above |
| `src/lib/pmo/save-pmo-tenant.ts` | Migrated from a raw check-then-insert-or-update to `ensureDefaultPmo`'s underlying RPC directly (via the service-role client already in scope), with `pmoType`/`syncExisting: true` |
| `src/lib/workspaces.ts` (`ensureUserWorkspace`) | Migrated from a raw check-then-insert to the new `ensure_user_workspace` RPC |
| `src/lib/workspaces.ts` (`createWorkspace`) | Unchanged — this is the explicit "New Workspace" action, not a default-identity get-or-create; it has no idempotency contract to begin with (see §3) |
| `src/app/(protected)/executive/page.tsx`, `src/app/(protected)/command-center/page.tsx`, `src/app/api/onboarding/route.ts`, `src/lib/workspaces/resolve-write-workspace.ts`, `src/lib/founder-program/admission.ts` | None — all call `ensureUserWorkspace(userId)` and only ever use `.workspaceId`/`.role`; none reads `.created`, confirmed by repository-wide search, so the (unchanged) external contract of `ensureUserWorkspace` needed no caller-side changes |

## 10. Retry/timeout behavior

Client-side: `use-command-center-activation.ts`'s `SUBMIT_TIMEOUT_MS` guard already models "idle → submitting → success | failure" with no simulated progress and no `AbortController` (a rejected/never-settling server action cannot be cancelled from the client, and the hook does not pretend otherwise — a prior sprint already removed the simulated "Keep Waiting" lifecycle entirely, confirmed by `tests/command-center-activation-sequence.test.mjs`'s own header comment, which documents that removal). A client-side timeout marks the UI `failure` and clears the in-flight guard on the *original* call's `finally`, so a user-initiated Retry (`handleRetryActivation` → `handleCreate`) genuinely re-invokes `savePmoTenant` once the original settles, or immediately if it already has.

Server-side, this is now safe regardless of the exact interleaving: §7's advisory lock guarantees that a slow original call and a fast retry — whichever arrives first — serialize against each other and both resolve to the same canonical PMO id, with no duplicate row and no raw database error surfaced to either caller. This is executed and verified directly (`tests/.../test.mjs`, "a slow original activation and a fast retry converge on the same canonical PMO", §13.9.3) using an artificially delayed original call racing an undelayed retry — both converge on one row.

## 11. Partial-state repair behavior

`ensure_default_pmo`/`ensure_user_workspace` are both get-or-create-only repair operations, not full-bootstrap operations: given a workspace that exists with no default PMO yet, exactly one is created (verified, §13.9.5); given a user with a membership already resolved, no new workspace or membership is ever touched (`ensureUserWorkspace`'s existing fast-path read is untouched by this fix). No parallel default PMO is ever created alongside an existing one — the function always re-reads before creating, inside the same lock.

## 12. Multiple legitimate PMO preservation

Verified directly: seeding a workspace with two legitimate PMOs (an oldest "canonical default" and a later, explicitly-named non-default PMO), a subsequent `ensure_default_pmo` call resolves specifically to the oldest one, leaves the row count at 2, and leaves the non-default row's `name`/`pmo_type` completely untouched (`tests/.../test.mjs`, "with multiple legitimate PMOs present..."). No global uniqueness assumption exists anywhere in the migration or the application code changed by this sprint (confirmed by a dedicated static regression test, `tests/pmf-004-idempotent-call-sites.test.mjs`, asserting no `UNIQUE(workspace_id)`-shaped constraint appears in the migration).

## 13. Audit-event behavior

No persisted audit-event table exists for PMO/Command-Center activation (confirmed independently by the decision brief, §8, and unchanged by this sprint) — `savePmoTenant` only emits structured `console.log`/`console.error` via its local `emit()` helper. This sprint did not build a new audit-event subsystem (explicitly out of scope per the task's non-goals); the existing `pmo.create.persisted`/`pmo.create.success`/`pmo.create.pmo_entity_warn` log events are preserved exactly as before, still emitted exactly once per `savePmoTenant` invocation regardless of whether the RPC created or found the default PMO. This remains disclosed as residual debt (§17), not newly introduced by this fix — a duplicate-PMO race would previously have left no durable audit trail either; now there is no race to leave a trail of.

## 14. Migration details

One migration, additive and non-destructive:

- `supabase/migrations/20260831000000_pmo_command_center_activation_idempotency.sql`
  - `drop function if exists ensure_default_pmo(uuid, text, uuid);` then recreates it with two additional, defaulted parameters (a genuine signature change requires drop-then-create in Postgres; `create or replace` cannot add parameters to an existing signature without creating an ambiguous overload).
  - `create function ensure_user_workspace(uuid, text) returns workspaces ...` — new function, no existing signature to replace.
  - Explicit `revoke ... from public; grant execute ... to <roles>;` for both, matching this repository's established convention (`20260825000000_fix_security_definer_public_execute_grants.sql`). `ensure_default_pmo` keeps its existing `authenticated, service_role` grant (it is still called from the ordinary per-session client by `pmo-service.ts`'s project-creation paths). `ensure_user_workspace` is granted to `service_role` only — narrower, since no legitimate caller ever needs to invoke workspace bootstrap as a plain authenticated user (confirmed: `workspaces` has no `INSERT` RLS policy at all, only a `SELECT` policy, so a direct authenticated call would fail on the insert regardless — the narrower grant is defense in depth, not the only protection).
  - No table, column, or constraint changes. Both functions preserve every legitimate existing `pmos`/`workspaces`/`workspace_memberships` row unconditionally — neither function ever deletes, consolidates, or reassigns anything.
  - Fresh-database application: verified via the test harness's own setup (`tests/pmf-004-default-pmo-command-center-idempotency.test.mjs`), which applies this migration's function-definition SQL (grant/revoke statements stripped, since the sandbox's plain Postgres has no `authenticated`/`service_role` roles) against a disposable database on every test run — 5/5 clean runs (§16).
  - Rollback: this repository's migration convention (confirmed across all prior migrations in `supabase/migrations/`) does not include down-migrations; consistent with that convention, none was added here. A manual rollback, if ever needed, is `drop function ensure_user_workspace(uuid, text); drop function ensure_default_pmo(uuid, text, uuid, text, boolean); ` followed by recreating the prior 3-parameter `ensure_default_pmo` from migration `20260828000002` verbatim.

## 15. Tests added

- `tests/pmf-004-default-pmo-command-center-idempotency.test.mjs` — 17 tests, real-Postgres concurrency proof (see §6, §16).
- `tests/pmf-004-idempotent-call-sites.test.mjs` — 5 tests, DB-free static regression guards (source-level: no raw `pmos`/`workspaces` check-then-insert remains; both entry points call the RPC; the migration reuses the existing lock key; no global uniqueness was introduced). Runs in every CI environment regardless of database availability.
- Three pre-existing static tests updated to match the new implementation shape while preserving the exact behavioral guarantee each one protects (not weakened, not removed):
  - `tests/workspace-pmo-project-codex-review-2026-07-16.test.mjs` — "savePmoTenant ... updates the existing pmos row's name/type on re-activation" now asserts the RPC call carries `p_sync_existing: true` and the renamed `p_name`, instead of asserting a raw `.update()` call that no longer exists.
  - `tests/workspace-pmo-project-hierarchy.test.mjs` — "PMO onboarding materializes a pmos row" now asserts the RPC call site instead of a raw `.from("pmos")` reference.
  - `tests/invite-workspace-role-boundary.test.mjs` — "workspace creator owner assignment is a hardcoded server-side literal, not client-derived" now additionally asserts the hardcoded `'owner'` literal lives inside `ensure_user_workspace`'s SQL body (not a JS-level variable) and that the function accepts no caller-supplied role parameter — the same security invariant, now enforced one layer lower.

## 16. Validation results

| Command | Exit | Result |
|---|---|---|
| `npx tsx --test tests/pmf-004-default-pmo-command-center-idempotency.test.mjs` (×5 consecutive runs) | 0 (all 5) | 17/17 pass, every run |
| `npx tsx --test tests/pmf-004-idempotent-call-sites.test.mjs` | 0 | 5/5 pass |
| `npx tsx --test tests/create-pmo-flow.test.mjs tests/command-center-activation-sequence.test.mjs tests/workspace-pmo-project-codex-review-2026-07-16.test.mjs tests/workspace-pmo-project-hierarchy.test.mjs tests/workspace-pmo-project-validation-sprint.test.mjs tests/workspace-pmo-project-independent-review.test.mjs` | 0 | 110/110 pass |
| `npx tsx --test tests/invite-workspace-role-boundary.test.mjs tests/supabase-rls-service-role-boundary.test.mjs` | 0 | 81/81 pass |
| `npm run typecheck` | 0 | 0 errors (required an explicit return-type annotation + cast on `ensureUserWorkspace`, added — see §8) |
| `npm run lint` | 0 | 0 errors, 614 warnings (identical to the PR #557/#558 baseline; no new warnings in any changed/new file) |
| `npm run build` | 0 | Success, all routes generated |
| `npm test` (full suite) | 0 | 12,838/12,838 pass (baseline 12,816 + 22 new: 17 + 5) |

The concurrency suite was run at 2, 5, and 10 concurrent callers (both for `ensure_default_pmo` and `ensure_user_workspace`), across 5 full repeated runs of the file, with zero failures — no flaky success observed.

## 17. Residual debt

1. **No live-Supabase end-to-end test** exists for `savePmoTenant`/`ensureUserWorkspace` (consistent with every prior security/data-integrity fix in this repository, per PR #557/#558's own disclosed residual debt) — the concurrency proof in this sprint operates one level down, against a real Postgres instance with a minimal fixture schema and the actual production function bodies, not against the full application stack. Enabling a live-DB CI job (`PMF004_PSQL_ADMIN`/`PMF004_TEST_DATABASE_URL_TEMPLATE` env vars, both already supported by the test harness) would close this gap without any code changes.
2. **No production/staging data preflight** was performed (§5) — no database was configured in this environment. If ambiguous existing default-PMO conflicts exist in real tenant data today, this fix does not detect or repair them; it only guarantees no *new* duplicates can be created going forward.
3. **The `ensureUserWorkspace` fix is broader than PMF-004's originally stated scope** (the backlog text names only `pmos`), but is explicitly included in this sprint's own task description ("unguarded check-then-insert behavior in paths such as `savePmoTenant`; `ensureUserWorkspace`") and was independently flagged as an unfixed sibling race in the decision brief (§8, §11, §21 item 1) — fixed here rather than deferred, since the task explicitly named it in scope.
4. **No persisted audit-event trail** for PMO/Command-Center activation (§13) — unchanged, pre-existing, out of scope per this sprint's own non-goals (no new audit architecture).
5. **The activation UI's "Keep Waiting" timer** named in the original task description (§9.9, §14) no longer exists in this codebase — a prior sprint (documented in `tests/command-center-activation-sequence.test.mjs`'s own header) already replaced the simulated activation lifecycle with a real idle→submitting→success|failure state machine and removed "Keep Waiting" entirely. No UI change was made or needed by this sprint for that specific requirement; §10 confirms the current UI's retry path is already safe given the server-side fix.

## 18. Explicit non-goals (honored)

No global `UNIQUE(workspace_id)` on `pmos`. No PMO consolidation or deletion. No PMO domain redesign. No onboarding redesign or legacy-wizard retirement. No navigation changes. No Command Center UI redesign. No Project Brain changes. No evidence-ingestion changes. No Portfolio changes. No broad schema normalization. No broad RLS refactoring. No distributed job system. No unrelated activation copy changes. No modification to the original audit or backlog JSON artifacts. No auto-merge of the resulting PR.
