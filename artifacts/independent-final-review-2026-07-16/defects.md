# Defect Register — Independent Review

Defects found by direct, adversarial re-verification against real
PostgreSQL, not by trusting the prior validation sprint's own report.

| ID | Severity | Defect | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|---|
| D1 | **Info (architectural, pre-existing, NOT introduced by this refactor)** | `src/lib/security/rbac.ts`'s `ROLE_PERMISSION_MAP`/`defaultGovernancePolicyEvaluator` is dead code — never consulted by the real authorization path (`authorizeRuntimeAction` → AOC governance runtime's own `GOVERNANCE_POLICY_REGISTRY`, a differently-typed role/permission system). `access-guards.ts` also casts the raw DB role (`'pm'`/`'viewer'` lowercase) directly as `rbac.ts`'s `WorkspaceRole` type (`'PM'` uppercase, plus `contributor`/`executive_viewer`/etc., none of which are real `workspace_memberships.role` CHECK-constraint values) with no actual mapping — but since the map is dead code, this mismatch has no live effect. | `grep -rn "defaultGovernancePolicyEvaluator" src` → 1 occurrence (its own definition) | **Not fixed** — pre-existing, unrelated to this branch's diff (`rbac.ts`, `access-guards.ts`, `governance-core.ts` are not in the 64-file diff), would require redesigning a large pre-existing governance subsystem, explicitly out of scope ("no rediseñes PMFreak") | `tests/workspace-pmo-project-independent-review.test.mjs` pins the *observed fact* (still exactly 1 occurrence) so a future change that starts wiring this map into real decisions is caught and re-analyzed, not silently trusted | **Documented, not blocking.** This refactor's own new role checks (D-fix-4 below) deliberately avoid this subsystem entirely. |
| D2 | **Low** | `updateProject`'s `pmoId` validation (`getPmoById`) does not filter by `status`, allowing a project to be assigned to an **archived** PMO via a crafted `PATCH` request — even though the move-target dropdown (`listPmos` default) only ever lists active PMOs, so this bypasses UI-only filtering. | `select ... from pmos` shows `status='archived'` PMO returned by `getPmoById(workspaceId, archivedPmoId)`; a raw-SQL UPDATE assigning a project to it succeeds (RLS/triggers have no opinion on `status`, by design — archived is a soft state) | Added an explicit `if (pmo.status === "archived") throw ...` check in `updateProject` (`src/lib/projects/project-admin-service.ts`) | `tests/workspace-pmo-project-independent-review.test.mjs` — "updateProject rejects assigning a project to an archived PMO" | **Fixed.** |

## Findings confirmed NOT to be defects (adversarially tested, held up)

- Migration concurrency race (prior sprint's fix): re-verified with 5
  concurrent runs → exactly 1 PMO. **Holds.**
- Migration atomicity for "interrupted after PMO creation, before Project
  linking" (explicitly named in sprint §6.3, not previously tested this
  precisely): forced a mid-block exception → 0 PMOs, 0 links, full
  rollback. **New evidence, confirms the fix generalizes correctly.**
- Cross-workspace `pmo_id`/`project_id` triggers (prior sprint's fix):
  re-verified with both a live-subquery id (RLS-blind, fails closed) and a
  hardcoded/known id (defeats RLS-blindness, trigger still rejects).
  **Holds, and the known-id variant closes a gap in the prior sprint's own
  test methodology** (its `test_6` alone could not distinguish "trigger
  rejected" from "RLS hid the row so the UPDATE set NULL").
- Context-chat workspace-derivation fix (prior sprint's fix): re-confirmed
  neither the pmo nor project branch calls `resolvePreferredWorkspace`.
  **Holds.**
- PMO-mutation and project-DELETE role checks (prior sprint's fixes):
  re-confirmed both use the direct DB-role helper
  (`src/lib/workspace-access.ts`), independently of the D1 finding above.
  **Holds.**
- Thread identity uniqueness (not previously tested this explicitly): 5
  distinct scopes → 5 distinct conversation ids; duplicate rejected by the
  unique index; no dangerous global-fallback pattern found anywhere.
  **New evidence, closes §9.5 explicitly.**
- Chat isolation (Alpha/Beta/Gamma/Delta secret scenario): re-run against a
  freshly rebuilt database at current HEAD, replicating the exact,
  re-verified query logic of the shipped responder. **Holds.**
- Fresh-apply migration type mismatch (prior sprint's fix,
  `workspace_governance.workspace_id::text` join): re-confirmed fixed —
  fresh apply passes cleanly from an empty database.

No Critical or High severity defects were found in this independent
review. The two prior High findings from the original validation sprint
(PMO backfill race, cross-workspace `pmo_id` gap) were both re-verified
fixed with fresh, independent evidence rather than assumed correct.
