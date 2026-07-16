import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Regression tests for defects found during the Independent Final Review
// & Merge Readiness Audit of the Workspace → PMO → Project hierarchy
// (branch claude/pmfreak-workspace-pmo-project-h78vqa). Each test pins a fix
// found by direct adversarial re-verification against real Postgres, not by
// trusting the prior validation sprint's own report.
// ─────────────────────────────────────────────────────────────────────────────

const projectAdminService = fs.readFileSync("src/lib/projects/project-admin-service.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260828000000_workspace_pmo_project_hierarchy.sql", "utf8");
const rbac = fs.readFileSync("src/lib/security/rbac.ts", "utf8");
const pmosRoute = fs.readFileSync("src/app/api/pmos/route.ts", "utf8");
const pmoIdRoute = fs.readFileSync("src/app/api/pmos/[id]/route.ts", "utf8");
const pmoDuplicateRoute = fs.readFileSync("src/app/api/pmos/[id]/duplicate/route.ts", "utf8");
const projectIdRoute = fs.readFileSync("src/app/api/projects/[id]/route.ts", "utf8");

// ─── Finding: moving a project into an archived PMO was silently allowed by
// the app layer (getPmoById does not filter by status), even though the
// move-target dropdown (listPmos default) only ever lists active PMOs — a
// crafted PATCH request could bypass that UI-only filtering and assign new
// work to an archived container with no warning. Reproduced via raw SQL
// (RLS/trigger layer has no opinion on status; this is a service-layer gap).
// ─────────────────────────────────────────────────────────────────────────────

test("updateProject rejects assigning a project to an archived PMO", () => {
  assert.ok(
    /if \(pmo\.status === "archived"\) throw new Error/.test(projectAdminService),
    "updateProject must reject an archived pmoId target, matching the move-target dropdown's active-only filtering"
  );
});

// ─── Finding (architectural, pre-existing, NOT introduced by this refactor):
// src/lib/security/rbac.ts's ROLE_PERMISSION_MAP / defaultGovernancePolicyEvaluator
// is dead code — the real authorization decisions flow entirely through the
// AOC enterprise governance runtime's own GOVERNANCE_POLICY_REGISTRY, which
// uses a differently-typed role enum. This test does not fix that (out of
// scope — a large pre-existing subsystem, unrelated to this diff), it only
// documents that THIS refactor's own new role checks correctly avoid
// depending on it, using a direct DB-role check instead
// (src/lib/workspace-access.ts:requireWorkspaceRole) — confirmed by grep,
// not by reading the AOC runtime's internals.
// ─────────────────────────────────────────────────────────────────────────────

test("rbac.ts's ROLE_PERMISSION_MAP-based evaluator remains unused by any real authorization path (documents a pre-existing gap, not introduced here)", () => {
  const consumers = [...rbac.matchAll(/defaultGovernancePolicyEvaluator/g)].length;
  // Exactly one occurrence = its own definition; a second occurrence
  // elsewhere would mean it started being consulted for real decisions,
  // which would change the analysis in the independent review report.
  assert.equal(consumers, 1, "defaultGovernancePolicyEvaluator should still only be defined, not consumed, in this file");
});

test("new PMO/project role-gated mutation routes use the direct DB-role check, not the AOC governance runtime's role mapping", () => {
  for (const [name, src] of [
    ["POST /api/pmos", pmosRoute],
    ["/api/pmos/[id]", pmoIdRoute],
    ["/api/pmos/[id]/duplicate", pmoDuplicateRoute],
  ]) {
    assert.ok(src.includes('from "@/lib/workspace-access"'), `${name} must import the direct-DB-role helper`);
    assert.ok(src.includes('requireWorkspaceMinimumRole(') , `${name} must call the direct-DB-role check`);
  }
  const deleteHandler = projectIdRoute.slice(projectIdRoute.indexOf("export async function DELETE"));
  assert.ok(deleteHandler.includes('requireWorkspaceMinimumRole(scoped.workspace_id, "admin")'));
});

// ─── Finding: confirmed (not merely asserted) that the projects table's
// DELETE RLS policy has literally zero role restriction — any workspace
// member's DELETE passes RLS. Verified live against Postgres: `select
// policyname, cmd, qual from pg_policies where tablename='projects' and
// cmd='DELETE'` returns a policy whose USING clause only checks
// `workspace_memberships` existence, no role filter. This is why the
// app-layer admin-minimum check on DELETE (tested above) is the ONLY real
// gate — pin that fact so a future migration that "simplifies" the DELETE
// route by relying on RLS alone would be caught by this test's sibling
// re-verification, not silently ship a privilege-escalation regression.
// ─────────────────────────────────────────────────────────────────────────────

test("projects DELETE RLS policy in the migration history has no role predicate (documents why the app-layer admin check is load-bearing)", () => {
  // This policy predates this sprint (20260512160000_workspace_authorization_rewrite.sql)
  // and is intentionally NOT modified here (out of scope) — this test only
  // pins the observed fact so the app-layer DELETE role check above is
  // understood as necessary, not redundant, by future readers.
  const workspaceAuthMigration = fs.readFileSync("supabase/migrations/20260512160000_workspace_authorization_rewrite.sql", "utf8");
  const deletePolicyMatch = workspaceAuthMigration.match(/create policy "workspace members can delete projects"[\s\S]*?;/);
  assert.ok(deletePolicyMatch, "expected to find the projects DELETE policy in its origin migration");
  assert.ok(!/role\s*=|role\s+in\s*\(/.test(deletePolicyMatch[0]), "projects DELETE RLS policy still has no role predicate — confirms the app-layer check in project-id/route.ts DELETE is the real gate");
});

// ─── Finding: verified live (5 concurrent DO-block executions against a
// reset workspace -> exactly 1 PMO) and via a forced mid-block exception
// (0 PMOs, 0 project links afterward — full rollback) that the backfill is
// both race-safe and atomic. Pin the structural markers that make this true.
// ─────────────────────────────────────────────────────────────────────────────

test("PMO backfill remains a single atomic DO block guarded by an advisory lock (re-confirms the validation sprint's fix is intact)", () => {
  assert.ok(/pg_advisory_xact_lock\(hashtext\(/.test(migration));
  assert.ok(/^do \$\$/m.test(migration));
  assert.ok(/^end \$\$;/m.test(migration));
});

// ─── Thread identity (section 9.5): verified live that 5 distinct scopes
// (workspace A, PMO1, project Alpha, project Beta, workspace B) produce 5
// distinct conversation ids, and that a second workspace-scope conversation
// for the same workspace is rejected by the unique index — no fragmentation,
// no accidental sharing. Pin the unique index shape.
// ─────────────────────────────────────────────────────────────────────────────

test("context_conversations enforces exactly one active conversation per scope via a partial unique index", () => {
  assert.ok(migration.includes("context_conversations_scope_unique_idx"));
  assert.ok(/coalesce\(pmo_id,/.test(migration));
  assert.ok(/coalesce\(project_id,/.test(migration));
  assert.ok(/where status = 'active'/.test(migration));
});
