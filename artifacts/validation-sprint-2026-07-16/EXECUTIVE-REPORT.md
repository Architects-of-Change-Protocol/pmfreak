# PMFreak — Acceptance, Migration & Context Isolation Validation Sprint

**Scope validated:** branch `claude/pmfreak-workspace-pmo-project-h78vqa`, original
implementation commit `3c0eab6`, plus the fixes made during this validation
sprint (see commit for this sprint).

## A. Executive summary

**Status: CONDITIONAL GO**

The Workspace → PMO → Project refactor is architecturally sound and the
reported metrics (54 files, 12,319 tests, green typecheck/static checks)
were real — but they did not, by themselves, prove the sprint's safety
claims. Direct execution against real Postgres databases (fresh-apply,
seeded upgrade, RLS negative tests, live chat-isolation behavioral proof,
and concurrency races) surfaced **5 real defects**, two of them capable of
crossing a tenant boundary under realistic conditions. All 5 are now fixed,
with regression tests and re-verified empirical evidence for every fix.

No data loss, no orphaned projects, no duplicate default PMOs (after fix),
no cross-workspace/PMO/project chat leakage, and no RLS bypass were
observed in any post-fix test. The `CONDITIONAL` qualifier reflects two
residual items that are appropriate to close as fast-follows rather than
blockers (see §"Residual risks").

**Global risk: MEDIUM → LOW after fixes.**

### Defects found

| # | Severity | Area | Summary | Status |
|---|---|---|---|---|
| 1 | **High** | Migration / concurrency | Two concurrent runs of the PMO backfill created two duplicate default PMOs for the same workspace (reproduced: 2 concurrent runs → 2 rows 45µs apart) | **Fixed** — `pg_advisory_xact_lock` wraps the backfill in an atomic `DO` block. Re-tested with 5 concurrent runs → exactly 1 row. |
| 2 | **High** | Database / cross-tenant integrity | `projects.pmo_id` and `context_conversations.pmo_id`/`project_id` had no DB-level check that the referenced entity belongs to the same `workspace_id`. RLS only validates the row's *own* workspace membership. Reproduced: a legitimate workspace-B member set their own project's `pmo_id` to a **known** workspace-A PMO id via a raw UPDATE — it succeeded. | **Fixed** — `BEFORE INSERT OR UPDATE` triggers on `projects` and `context_conversations` reject any cross-workspace reference, at the database layer (defense in depth, holds even for direct Supabase/service-role calls). Re-tested: same UPDATE now raises `projects.pmo_id must reference a PMO in the same workspace`. |
| 3 | **Medium** | Context isolation | `/api/context-chat` derived a pmo/project scope's `workspace_id` from the caller's **preferred-workspace cookie**, not from the entity itself. A user in two workspaces requesting a project-scoped chat for a project in their non-preferred workspace would persist a `context_conversations` row **mislabeled** with the wrong `workspace_id` — readable, via the workspace-membership RLS policy, by members of the wrong workspace. | **Fixed** — scope resolution now derives `workspace_id` from the PMO/project's own row for those two scopes; the preferred-workspace cookie is used only for the workspace-level scope, where there is no other entity to derive from. |
| 4 | **Medium** | Authorization | PMO create/update/delete/duplicate routes checked only read-level workspace membership; a viewer's write attempt was rejected by RLS but surfaced as a generic 500 instead of 403 — no independent app-layer role check existed, unlike the rest of the codebase's own `requireWorkspaceRole` convention for workspace-scoped admin mutations. | **Fixed** — explicit `pm`-minimum role check added, matching the RLS "workspace managers can manage pmos" policy exactly; returns a clean 403. |
| 5 | **Medium** | Authorization | `DELETE /api/projects/[id]` reused the same `write` permission check as `PATCH`. The `projects` table's DELETE RLS policy has **no role restriction at all** (any workspace member passes it) — the app-layer check was the only real gate, and it did not distinguish "can edit" from "can permanently destroy." | **Fixed** — explicit `admin`-minimum role check added ahead of the delete, independent of the shared write-permission gate. |

One **Low** finding (project overview links to "Meetings"/"Risks & Issues"
implied per-project scoping via a `?projectId=` param those pages silently
ignore) was also fixed — links now honestly labeled "(preview)" and no
longer pass a param the destination doesn't consume. One **Low** finding
(`moveProjectToPmo` in `pmo-service.ts` is dead code — the real move path
is `updateProject`'s `pmoId` field) is documented, not fixed (harmless,
no scope justification to remove/wire it up in a validation sprint).

### Recommendation

**Ready for Review**, contingent on the residual risks below being
acknowledged by a human reviewer before merge. This sprint did not merge to
main, did not push to any remote, and did not touch production.

## Residual risks (documented, not blocking)

1. **No black-box PostgREST/GoTrue-backed test was possible in this
   sandbox** (no Docker daemon). Chat isolation was proven two ways
   instead: (a) RLS negative tests directly against Postgres with simulated
   JWT claims — the authoritative, final enforcement layer — and (b) a live
   behavioral run of the responder's exact query logic (verified identical
   to the shipped `.ts` file by direct code review) against real seeded
   data, reproducing the sprint's literal Alpha/Beta/Gamma/Delta secret
   scenario. Recommend a full hosted-Supabase run of the sprint's manual-QA
   steps (§20 of the brief) as a pre-production CI gate.
2. **Migration re-application safety** matches this repo's own established
   convention across all 148 prior migrations (`CREATE POLICY` etc. are not
   idempotent under a naive `psql -f` re-run) — this is not a regression,
   and the real deployment path (Supabase's tracked migration application)
   applies each file exactly once. Documented in the deployment plan.
3. **PMO chat/settings do not yet have per-PMO membership/agent/template
   scoping** — those admin surfaces currently link to the existing
   workspace-level pages. This was scoped out of the original refactor and
   remains a known, intentional gap for a future sprint, not a defect.

## B. Validation matrix

| Area | Result | Evidence | Residual risk |
|---|---|---|---|
| Migración fresh (149 files, empty DB) | **Pass** | `fresh-apply-initial-run.log` (pre-fix); re-verified post-fix via `check-fresh-db-migrations.mjs` local mode | None |
| Migración upgrade (seeded pre-refactor DB) | **Pass** | `migration-integrity-sql-checks.txt` | None |
| Integridad Project-PMO (0 nulls, 0 mismatches) | **Pass** | `migration-integrity-sql-checks.txt` (SQL + counts) | None |
| Idempotencia del backfill | **Pass** | `migration-integrity-sql-checks.txt` §Idempotency | None |
| Concurrencia del backfill (race) | **Pass (after fix)** | `migration-integrity-sql-checks.txt` §Concurrency — reproduced failure, then re-verified fix with 5 concurrent runs | None |
| Consistencia cross-workspace (pmo_id/project_id) | **Pass (after fix)** | `migration-integrity-sql-checks.txt` §trigger proof | None |
| RLS — lectura/escritura por rol | **Pass** | `rls-test-results.txt` (8 scenarios + positive controls + trigger test) | None |
| RLS — cross-workspace denial | **Pass** | `rls-test-results.txt` tests 1/2/5/7 | None |
| Chat isolation — Project/PMO/Workspace | **Pass** | `chat-isolation-live-proof-results.txt` (8/8 scenarios, live data) | See residual risk #1 (no PostgREST black-box run) |
| Autorización de API (PMO/Project mutations) | **Pass (after fix)** | Code + `tests/workspace-pmo-project-validation-sprint.test.mjs` | None |
| Deep links / rutas antiguas | **Pass** | Code trace: `/workspace`, `/create-pmo`, `/copilot` redirects intact; new routes registered in `route-policy-registry.ts`; onboarding chain (`workspace/setup → create-command-center → invite-team → command-center`) traced end to end | Full manual click-through not performed (no live server session in this sandbox) |
| UX onboarding (Workspace→PMO→Project) | **Pass** | Code trace of `createWorkspaceAction`/`savePmoTenant`/`createProjectAction`; `pmos` row now materialized alongside governance JSON | None |
| Build | **Pass** | `next build` — compiled successfully, typecheck in-build passed, all new routes present in the manifest | None |
| Typecheck | **Pass** | `tsc --noEmit` — 0 errors | None |
| Lint | **Pass** | `eslint` — 0 errors (610 pre-existing warnings, unrelated to this diff) | None |
| DB schema contract | **Pass** | `check-db-schema-contract.mjs` | None |
| AOC boundaries | **Pass** | `lint-aoc-boundaries.mjs`, `check-aoc-packages.mjs`, `check-aoc-dependency-direction.mjs` | None |
| Full test suite | **Pass** | `npm test` — 12,330 tests (12,319 original + 47 new: 37 hierarchy + 10 regression), 0 failures after fixing 1 stale assertion in my own earlier test | None |

## C. Files touched in this validation sprint (in addition to the original 54)

| File | Why |
|---|---|
| `supabase/migrations/20260828000000_workspace_pmo_project_hierarchy.sql` | Fixed the `workspace_governance.workspace_id::text` join type mismatch that broke fresh-apply; wrapped the backfill in an advisory-lock-guarded `DO` block (closes the concurrent-duplicate-PMO race); added `enforce_project_pmo_same_workspace` and `enforce_context_conversation_same_workspace` triggers (closes the cross-workspace pmo_id/project_id gap) |
| `src/app/api/context-chat/route.ts` | Scope resolution now derives `workspace_id` from the PMO/project entity itself instead of the caller's preferred-workspace cookie |
| `src/lib/pmos/pmo-service.ts` | Added `getPmoWorkspaceId` (entity-derived scope lookup) |
| `src/lib/projects/project-admin-service.ts` | Added `getProjectWorkspaceId` (entity-derived scope lookup) |
| `src/app/api/pmos/route.ts`, `src/app/api/pmos/[id]/route.ts`, `src/app/api/pmos/[id]/duplicate/route.ts` | Added explicit `pm`-minimum workspace-role check ahead of every mutation |
| `src/app/api/projects/[id]/route.ts` | Added `admin`-minimum role check on DELETE; added workspace-membership validation for `ownerUserId` reassignment |
| `src/app/(protected)/projects/[id]/project-tab-nav.tsx` | Removed misleading `?projectId=` param from links whose destination pages don't consume it; labeled them "(preview)" |
| `tests/workspace-pmo-project-hierarchy.test.mjs` | Updated one assertion to match the improved (more secure) context-chat implementation |
| `tests/workspace-pmo-project-validation-sprint.test.mjs` (new) | 10 regression tests, one per defect found in this sprint |
| `artifacts/validation-sprint-2026-07-16/*` (new) | This evidence folder |

## D. Command evidence

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors, 610 pre-existing warnings |
| `node scripts/check-db-schema-contract.mjs` | PASS |
| `node scripts/lint-aoc-boundaries.mjs` | PASS |
| `node scripts/check-aoc-packages.mjs` | PASS |
| `node scripts/check-aoc-dependency-direction.mjs` | PASS |
| `FRESH_DB_URL=... ALLOW_DESTRUCTIVE_FRESH_DB_TEST=true node scripts/check-fresh-db-migrations.mjs` (local Postgres 16) | Fresh apply PASS, schema contracts PASS, 413 tables, 1 pre-existing table without RLS (unrelated) |
| `npm test` (`node --test tests/*.test.mjs tests/*.test.ts` via tsx) | 12,330 tests, 12,330 pass, 0 fail |
| `npm run build` | Compiled successfully in 34.6s; all new routes present |
| Manual `psql` RLS negative-test suite (8 scenarios + 4 positive controls + 1 trigger test) | All PASS |
| Manual concurrent-backfill race test (5 parallel `psql -f`) | 1 PMO created (was 2 before fix) |
| Live chat-isolation behavioral proof (8 scenarios against real seeded DB) | All PASS |

## E. Deployment plan

### Pre-deploy checks
1. Confirm this branch's `npm test`, `npx tsc --noEmit`, `npm run lint`,
   and `npm run build` are green in CI (all confirmed locally in this
   sprint).
2. Run `check:fresh-db-migrations` in **hosted** mode against an isolated
   Supabase project (this sprint validated **local** mode only, due to no
   Docker/PostgREST in this sandbox) — closes residual risk #1.
3. Take a database snapshot/backup immediately before applying the
   migration (standard practice for any schema change touching `projects`).

### Database migration
4. Apply `20260828000000_workspace_pmo_project_hierarchy.sql` via the
   normal Supabase migration pipeline (single serialized apply — the
   concurrency race this sprint found and fixed only manifests under
   genuinely parallel execution, which the tracked pipeline does not do).
5. Immediately after, run the integrity SQL from
   `migration-integrity-sql-checks.txt` against production data:
   `select count(*) from projects where pmo_id is null` (expect 0) and the
   cross-workspace-mismatch query (expect 0).

### Application deployment
6. Deploy the application code. No environment variables or secrets
   changed in this sprint.
7. The `pmfreak.workspaceId` cookie is additive — existing sessions without
   it fall back to `resolveCanonicalWorkspace`'s existing oldest-membership
   behavior, unchanged from before this refactor.

### Post-deploy verification
8. Spot-check: an existing user's `/command-center` still resolves their
   projects; `/pmos` shows the backfilled default PMO; a new project
   created from `/projects/new` lands on `/projects/[id]` (Overview).
9. Confirm the PMO backfill integrity query above returns 0/0 against the
   real production dataset.
10. Watch error-rate/observability dashboards for `workspace_scope_violation`
    and `project_scope_violation` security-event spikes for the first hour
    (these are the event types the new role checks emit on denial — a
    spike would indicate an unexpected permission regression for a real
    user cohort, not an attack).

### Monitoring
11. `enforce_project_pmo_same_workspace` / `enforce_context_conversation_same_workspace`
    trigger exceptions are new failure modes — alert if their error text
    ("must reference a PMO/project in the same workspace") appears in
    application logs, since a legitimate code path should never trigger
    them (only a bug or an attack attempt would).

### Rollback criteria
- Roll back the **application** deploy (not the migration) if: the
  onboarding chain breaks for new users, existing users cannot see their
  projects, or the new role checks produce false-positive 403s for a real
  user cohort.
- The **migration itself should not be rolled back** by dropping the new
  tables/columns — it is purely additive (`pmo_id` nullable,
  `ON DELETE SET NULL`, new tables only). A previous application version
  can continue operating against the migrated schema: it simply never
  reads `pmos`/`context_conversations`/`context_messages` and ignores
  `projects.pmo_id`/`methodology`/`icon`/`color`. This was not empirically
  re-tested against the literal prior application version in this sprint
  (out of scope — no prior build was run), but is a structural guarantee
  from the migration's additive-only design (verified: no existing
  column was renamed, retyped, or made newly `NOT NULL`).

### Rollback procedure
1. Revert the application deployment to the prior release.
2. Leave the database schema as-is (additive migration; safe to leave
   applied even if the application is rolled back).
3. If a genuine data-integrity issue is found post-deploy (not observed in
   this sprint), the new tables can be safely emptied
   (`delete from context_messages; delete from context_conversations;`) or
   `pmos`/`projects.pmo_id` can be selectively corrected via the same
   integrity SQL used to verify them — never via `DROP TABLE`/`DROP COLUMN`
   without a second review.

## F. PR recommendation

**1. Ready for Review.**

The implementation is architecturally correct, all found defects are fixed
with regression tests and re-verified empirical evidence, and the full
build/test/lint/typecheck/migration suite is green. It is not "GO" outright
because two residual items (§Residual risks) warrant a human reviewer's
explicit sign-off before a production merge: the lack of a hosted-Supabase
black-box test run in this sandbox, and the intentionally-deferred
per-PMO membership/agent/template scoping.
