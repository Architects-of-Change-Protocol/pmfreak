import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Regression tests for defects found during the Acceptance, Migration &
// Context Isolation Validation Sprint. Each test pins the fix in place so a
// future refactor cannot silently reintroduce the defect.
// ─────────────────────────────────────────────────────────────────────────────

const migration = fs.readFileSync("supabase/migrations/20260828000001_workspace_pmo_project_hierarchy.sql", "utf8");
const pmosRoute = fs.readFileSync("src/app/api/pmos/route.ts", "utf8");
const pmoIdRoute = fs.readFileSync("src/app/api/pmos/[id]/route.ts", "utf8");
const pmoDuplicateRoute = fs.readFileSync("src/app/api/pmos/[id]/duplicate/route.ts", "utf8");
const projectIdRoute = fs.readFileSync("src/app/api/projects/[id]/route.ts", "utf8");
const contextChatRoute = fs.readFileSync("src/app/api/context-chat/route.ts", "utf8");
const pmoService = fs.readFileSync("src/lib/pmos/pmo-service.ts", "utf8");
const projectAdminService = fs.readFileSync("src/lib/projects/project-admin-service.ts", "utf8");

// ─── Finding: PMO backfill race condition (two concurrent migration runs
// created two "default" PMOs for the same workspace — reproduced empirically:
// 5 truly concurrent executions of the unguarded backfill produced 2 rows for
// one workspace before the fix, exactly 1 after). ─────────────────────────────

test("PMO backfill is wrapped in an advisory-lock-guarded DO block (closes the concurrent-duplicate-default-PMO race)", () => {
  assert.ok(/pg_advisory_xact_lock\(hashtext\(/.test(migration), "backfill must acquire an advisory lock before the check-then-insert");
  assert.ok(/^do \$\$/m.test(migration), "backfill must run as a single atomic DO block, not separate autocommitting statements");
});

// ─── Finding: projects.pmo_id / context_conversations.pmo_id had no
// database-level guarantee that the referenced PMO/project belongs to the
// same workspace_id — RLS only validates the row's OWN workspace membership,
// never a referenced foreign row's workspace. Reproduced empirically: a
// legitimate workspace-B member set projects.pmo_id to a workspace-A PMO via
// a direct UPDATE (using a hardcoded/known PMO id — RLS's blind-to-other-
// workspaces read behavior does NOT prevent this once the id is known by any
// means). Closed with BEFORE INSERT/UPDATE triggers. ───────────────────────

test("a trigger enforces projects.pmo_id belongs to the project's own workspace", () => {
  assert.ok(migration.includes("enforce_project_pmo_same_workspace"));
  assert.ok(/create trigger projects_pmo_same_workspace/.test(migration));
  assert.ok(/before insert or update of pmo_id, workspace_id on projects/.test(migration));
});

test("a trigger enforces context_conversations.pmo_id/project_id belong to the conversation's own workspace", () => {
  assert.ok(migration.includes("enforce_context_conversation_same_workspace"));
  assert.ok(/create trigger context_conversations_same_workspace/.test(migration));
});

// ─── Finding: PMO mutation routes (create/update/delete/duplicate) only
// checked read-level workspace membership (requireWorkspaceMember), so a
// "viewer" role member's write attempt was rejected by RLS but surfaced as a
// generic 500 instead of a clean 403 — no app-layer role enforcement existed
// independent of the RLS backstop, contradicting the rest of the codebase's
// own requireWorkspaceRole convention used everywhere else for workspace-
// scoped admin mutations. ───────────────────────────────────────────────────

test("PMO create/update/delete/duplicate routes enforce a workspace role, not just membership", () => {
  for (const [name, src] of [["POST /api/pmos", pmosRoute], ["/api/pmos/[id]", pmoIdRoute], ["/api/pmos/[id]/duplicate", pmoDuplicateRoute]]) {
    assert.ok(/requireWorkspaceRole.*"pm"/.test(src) || src.includes('requireWorkspaceMinimumRole(') , `${name} must check a minimum workspace role for mutations`);
  }
});

// ─── Finding: DELETE /api/projects/[id] reused the same "write" permission
// check as PATCH, but the projects table's DELETE RLS policy has NO role
// restriction at all (any workspace member passes it) — the app-layer check
// was the only gate distinguishing "can edit" from "can permanently destroy",
// and it did not distinguish them. ──────────────────────────────────────────

test("project DELETE enforces an explicit admin-or-above role check beyond the shared write-permission gate", () => {
  const deleteHandler = projectIdRoute.slice(projectIdRoute.indexOf("export async function DELETE"));
  assert.ok(/requireWorkspaceMinimumRole\(scoped\.workspace_id, "admin"\)/.test(deleteHandler), "DELETE must require at least admin role — RLS on projects.DELETE has no role restriction");
});

// ─── Finding: PATCH /api/projects/[id] ownerUserId accepted any string with
// no verification the target user is an actual member of the project's
// workspace — ownership could be silently reassigned to a non-member. ──────

test("project ownership reassignment validates the new owner is a workspace member", () => {
  const patchHandler = projectIdRoute.slice(projectIdRoute.indexOf("export async function PATCH"), projectIdRoute.indexOf("export async function DELETE"));
  assert.ok(patchHandler.includes('.from("workspace_memberships")'), "ownerUserId patch must check workspace_memberships before accepting the new owner");
  assert.ok(patchHandler.includes("must be a member of this workspace"));
});

// ─── Finding: /api/context-chat derived a pmo/project scope's workspace_id
// from the caller's PREFERRED-workspace cookie/session rather than from the
// PMO/project row itself. A user in two workspaces requesting a project-
// scoped chat for a project in their non-preferred workspace would persist a
// context_conversations row with a MISMATCHED workspace_id (wrong workspace
// tag on a real conversation) — which, via the workspace-membership read RLS
// policy, would let members of the WRONG (preferred) workspace read a
// conversation about an entity they have no relationship to. Closed by
// deriving workspace_id from the entity's own row for pmo/project scopes. ──

test("context-chat scope resolution derives workspace_id from the PMO/project entity itself, never from the preferred-workspace cookie", () => {
  assert.ok(contextChatRoute.includes("getPmoWorkspaceId"), "pmo scope must look up the PMO's own workspace_id");
  assert.ok(contextChatRoute.includes("getProjectWorkspaceId"), "project scope must look up the project's own workspace_id");
  assert.ok(pmoService.includes("export async function getPmoWorkspaceId"));
  assert.ok(projectAdminService.includes("export async function getProjectWorkspaceId"));
  // Only the workspace-level scope may use the caller's preferred workspace —
  // pmo/project branches must not call resolvePreferredWorkspace at all.
  const pmoBranch = contextChatRoute.slice(contextChatRoute.indexOf('contextType === "pmo"'), contextChatRoute.indexOf('contextType === "project"'));
  const projectBranch = contextChatRoute.slice(contextChatRoute.indexOf('contextType === "project"'), contextChatRoute.indexOf("return { error: \"invalid_scope\" }"));
  assert.ok(!pmoBranch.includes("resolvePreferredWorkspace"), "pmo scope must not fall back to the preferred-workspace cookie");
  assert.ok(!projectBranch.includes("resolvePreferredWorkspace"), "project scope must not fall back to the preferred-workspace cookie");
});

test("context-chat pmo/project scopes 404 cleanly when the entity does not exist, rather than silently mislabeling a conversation", () => {
  assert.ok(/PMO not found/.test(contextChatRoute));
  assert.ok(/Project not found/.test(contextChatRoute));
});

// ─── Migration integrity: reruns / partial-failure tolerance ─────────────

test("projects.pmo_id remains nullable (no hard NOT NULL finalization step) so a partially-applied backfill never blocks writes", () => {
  assert.ok(!/alter table projects alter column pmo_id set not null/.test(migration));
});

test("pmos/context_conversations/context_messages table creation uses IF NOT EXISTS for safe re-application", () => {
  assert.ok(/create table if not exists pmos/.test(migration));
  assert.ok(/create table if not exists context_conversations/.test(migration));
  assert.ok(/create table if not exists context_messages/.test(migration));
});
