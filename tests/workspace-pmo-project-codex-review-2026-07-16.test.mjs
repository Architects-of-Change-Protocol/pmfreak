import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Regression tests for defects found by an automated review (Codex) on
// PR #526 (Workspace → PMO → Project hierarchy) after it was merged to main.
// Each test pins a fix so a future refactor cannot silently reintroduce the
// defect. Findings judged ambiguous or architecturally significant (which
// workspace new projects/PMOs should resolve to; the ensureDefaultPmo
// runtime race; what counts as "PMO setup complete" for onboarding) were
// deliberately left out of this sprint pending a product decision — see the
// PR conversation, not this file, for that triage.
// ─────────────────────────────────────────────────────────────────────────────

const layout = fs.readFileSync("src/app/(protected)/layout.tsx", "utf8");
const projectSettingsClient = fs.readFileSync("src/components/pmfreak/projects/project-settings-client.tsx", "utf8");
const contextChatService = fs.readFileSync("src/lib/chat/context-chat-service.ts", "utf8");
const savePmoTenant = fs.readFileSync("src/lib/pmo/save-pmo-tenant.ts", "utf8");
const projectAdminService = fs.readFileSync("src/lib/projects/project-admin-service.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260828000001_workspace_pmo_project_hierarchy.sql", "utf8");

// ─── Finding: resolveCanonicalWorkspace's `recovered` flag (meaning "the
// preferred-workspace cookie didn't match a real membership, fell back") was
// wired into resolveOnboardingState's `isRecovered` flag (meaning "this
// workspace was just bootstrapped, skip the trial check"). A trial-blocked
// user could set the pmfreak.workspaceId cookie to any non-matching value
// (a random UUID, or a workspace they left) and permanently bypass trial
// gating, since they fully control that cookie. Reproduced by tracing:
// resolveCanonicalWorkspace(userId, "garbage") -> recovered=true even though
// the fallback workspace has real trial history. ────────────────────────────

test("protected layout only skips the trial check for a workspace freshly bootstrapped in this request, never for a stale/tampered preferred-workspace cookie", () => {
  assert.ok(
    /isRecovered:\s*justBootstrapped/.test(layout),
    "resolveOnboardingState must receive a flag scoped to the explicit ensureUserWorkspace bootstrap branch, not resolvedWorkspace.recovered"
  );
  assert.ok(
    !/isRecovered:\s*resolvedWorkspace\.recovered/.test(layout),
    "must not pass resolveCanonicalWorkspace's cookie-mismatch-fallback flag directly into the trial-skip gate"
  );
});

// ─── Finding: project-settings-client.tsx always resent form.pmoId on every
// save. The PMO dropdown only lists active PMOs, so a project currently
// sitting in an archived PMO keeps form.pmoId at that archived id (no
// matching <option>, never touched by the user) — resending it unconditionally
// resubmitted that unchanged value on every save and tripped the server's
// (correct) archived-PMO rejection for edits unrelated to the PMO field,
// blocking ALL edits to such a project, including fixing its status. ────────

test("project settings only sends pmoId in the PATCH body when the user actually changed it", () => {
  assert.ok(
    /pmoChanged\s*=\s*form\.pmoId\s*!==\s*\(project\.pmo_id\s*\?\?\s*""\)/.test(projectSettingsClient),
    "save() must compare form.pmoId against the original project.pmo_id"
  );
  assert.ok(
    /\.\.\.\(pmoChanged \? \{ pmoId: form\.pmoId \|\| null \} : \{\}\)/.test(projectSettingsClient),
    "pmoId must be omitted from the PATCH body entirely when unchanged, not just recomputed"
  );
});

// ─── Finding: context-chat-service.ts's listMessages ordered ascending then
// applied .limit(200) — for a conversation with more than 200 messages this
// returns the OLDEST 200 rows forever, never the newest, stranding long
// conversations on their earliest history. ──────────────────────────────────

test("listMessages fetches the newest N messages (descending + limit) then restores chronological order, rather than limiting an ascending query", () => {
  const fn = contextChatService.slice(contextChatService.indexOf("export async function listMessages"));
  assert.ok(/order\("created_at", \{ ascending: false \}\)/.test(fn), "must order descending before applying limit to take the most recent rows");
  assert.ok(/\.reverse\(\)/.test(fn), "must reverse the descending page back into chronological order for callers");
});

// ─── Finding: savePmoTenant's idempotent "skip if the workspace already has
// a pmos row" branch updated workspace_governance and workspaces.name but
// never the pmos row itself — re-running the setup wizard to rename a PMO
// left the pmos row (what navigation/chat/project-assignment hang off)
// showing the old, stale name indefinitely. ──────────────────────────────────

test("savePmoTenant updates the existing pmos row's name/type when the workspace already has one, not just workspace_governance", () => {
  const existingBranch = savePmoTenant.slice(savePmoTenant.indexOf("if (!existingPmo?.id)"));
  assert.ok(existingBranch.includes('} else {'), "must have an else branch for the already-has-a-pmos-row case");
  const elseBranch = existingBranch.slice(existingBranch.indexOf("} else {"));
  assert.ok(elseBranch.includes('.from("pmos")') && elseBranch.includes(".update("), "the else branch must update the existing pmos row");
  assert.ok(elseBranch.includes("tenant.identity.pmoName"), "the update must carry the wizard's (possibly renamed) PMO name");
});

// ─── Finding: duplicateProject copied source.pmo_id directly into the new
// project with no archived-PMO check, even though updateProject (fixed in
// the prior independent-review sprint) rejects assigning a project to an
// archived PMO. Duplicating a project that lives in an archived PMO is the
// same kind of new assignment as an explicit move, so it silently bypassed
// that exact rule via a different code path. ────────────────────────────────

test("duplicateProject falls back to unassigned rather than copying an archived PMO into the new project", () => {
  const fn = projectAdminService.slice(projectAdminService.indexOf("export async function duplicateProject"));
  assert.ok(/pmo\.status === "archived"\) targetPmoId = null/.test(fn), "must null out targetPmoId when the source project's PMO is archived");
  assert.ok(/pmo_id:\s*targetPmoId/.test(fn), "the insert must use the archived-checked targetPmoId, not source.pmo_id directly");
});

// ─── Finding: the context_conversations CHECK constraint's comment described
// pmo_id as "optional denormalization" for project-scoped rows, even though
// the scope-unique index keys on (workspace_id, context_type, pmo_id,
// project_id). If any writer ever set pmo_id on a project-scoped row (which
// the constraint permitted), it would no longer collide with the pmo_id-less
// row for the same project on the unique index — producing a second "active"
// conversation and silently fragmenting that project's chat thread. The one
// real writer (getOrCreateConversation) never sets it, so this was a latent
// schema landmine rather than a live bug; closed by tightening the CHECK
// constraint to match what the real writer already does. ───────────────────

test("context_conversations CHECK constraint requires pmo_id to be null for project-scoped rows (no denormalization escape hatch)", () => {
  assert.ok(
    /context_type = 'project' and project_id is not null and pmo_id is null/.test(migration),
    "project scope must forbid a non-null pmo_id, closing the scope-unique-index fragmentation risk"
  );
});

// ─── Finding: context_messages.workspace_id is a caller-supplied parameter
// (appendMessage) with no database-level guarantee it matches its own
// conversation_id's real workspace_id — the same class of gap as
// projects.pmo_id / context_conversations.pmo_id, which already got
// BEFORE INSERT/UPDATE triggers in the validation sprint. This table was
// missed. Closed with the same trigger pattern. ─────────────────────────────

test("a trigger enforces context_messages.workspace_id matches its conversation's own workspace", () => {
  assert.ok(migration.includes("enforce_context_message_same_workspace"));
  assert.ok(/create trigger context_messages_same_workspace/.test(migration));
  assert.ok(/before insert or update of conversation_id, workspace_id on context_messages/.test(migration));
});
