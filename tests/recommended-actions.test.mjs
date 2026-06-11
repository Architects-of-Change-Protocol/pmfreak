import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const migration = fs.readFileSync("supabase/migrations/20260605040000_recommended_actions.sql", "utf8");
const decisionMigration = fs.readFileSync("supabase/migrations/20260605050000_recommended_actions_decision_workflow.sql", "utf8");
const engine = fs.readFileSync("src/lib/recommended-actions/generate-recommended-actions.ts", "utf8");
const materializer = fs.readFileSync("src/lib/recommended-actions/materialize-recommended-actions.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/recommended-actions/index.ts", "utf8");
const route = fs.readFileSync("src/app/api/recommended-actions/route.ts", "utf8");
const decisionRoute = fs.readFileSync("src/app/api/recommended-actions/decision/route.ts", "utf8");
const decisionWorkflow = fs.readFileSync("src/lib/recommended-actions/decision-workflow.ts", "utf8");
const shell = fs.readFileSync("src/components/pmfreak/operational-shell.tsx", "utf8");
const repository = fs.readFileSync("src/lib/project-discovery/discovery-repository.ts", "utf8");

test("recommended_actions migration creates table with all required columns", () => {
  assert.match(migration, /create table if not exists public\.recommended_actions/);
  for (const col of [
    "id", "workspace_id", "project_id", "raid_item_id",
    "title", "description", "recommended_action_type", "status",
    "confidence_score", "impact_level", "rationale", "recommended_owner",
    "recommended_due_window", "evidence_summary", "source_signal_id", "fingerprint",
    "created_at", "updated_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${col}\\b`), `column ${col} missing from migration`);
  }
});

test("recommended_actions migration has unique fingerprint constraint", () => {
  assert.match(migration, /recommended_actions_workspace_fingerprint_uidx/);
  assert.match(migration, /workspace_id, fingerprint/);
});

test("recommended_actions migration has required indexes", () => {
  assert.match(migration, /recommended_actions_workspace_idx/);
  assert.match(migration, /recommended_actions_project_idx/);
  assert.match(migration, /recommended_actions_raid_item_idx/);
  assert.match(migration, /recommended_actions_status_idx/);
});

test("recommended_actions migration enforces status and type check constraints", () => {
  assert.match(migration, /proposed/);
  assert.match(migration, /accepted/);
  assert.match(migration, /rejected/);
  assert.match(migration, /deferred/);
  assert.match(migration, /converted_to_task/);
  assert.match(migration, /schedule_meeting/);
  assert.match(migration, /request_approval/);
  assert.match(migration, /escalate_issue/);
  assert.match(migration, /confirm_dependency/);
  assert.match(migration, /review_assumption/);
});

test("recommended_actions migration enables RLS with workspace member policy", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});

test("generation engine exports generateRecommendedActions function", () => {
  assert.match(engine, /export function generateRecommendedActions/);
});

test("generation engine contains all supported action types", () => {
  for (const actionType of [
    "schedule_meeting", "stakeholder_alignment", "request_approval",
    "create_mitigation_plan", "create_contingency_plan", "clarify_requirement",
    "escalate_issue", "confirm_dependency", "assign_owner",
    "review_assumption", "validate_scope", "follow_up", "other",
  ]) {
    assert.match(engine, new RegExp(`"${actionType}"`), `action type ${actionType} missing`);
  }
});

test("generation engine uses sha256 fingerprinting", () => {
  assert.match(engine, /createHash\("sha256"\)/);
  assert.match(engine, /actionFingerprint/);
});

test("generation engine generates status as proposed only", () => {
  assert.match(engine, /"proposed"/);
  assert.doesNotMatch(engine, /status:.*"accepted"/);
  assert.doesNotMatch(engine, /status:.*"rejected"/);
  assert.doesNotMatch(engine, /status:.*"converted_to_task"/);
});

test("materializer logs started, completed, and failed events", () => {
  assert.match(materializer, /recommended_actions\.started/);
  assert.match(materializer, /recommended_actions\.completed/);
  assert.match(materializer, /recommended_actions\.failed/);
});

test("materializer logs workspaceId, projectId, created, updated, skipped, durationMs", () => {
  assert.match(materializer, /workspaceId/);
  assert.match(materializer, /projectId/);
  assert.match(materializer, /created/);
  assert.match(materializer, /updated/);
  assert.match(materializer, /skipped/);
  assert.match(materializer, /durationMs/);
});

test("materializer does not auto-accept or auto-convert actions", () => {
  assert.doesNotMatch(materializer, /"accepted"/);
  assert.doesNotMatch(materializer, /"converted_to_task"/);
});

test("materializer preserves manual status by skipping non-proposed existing actions", () => {
  assert.match(materializer, /status.*!==.*"proposed"/);
  assert.match(materializer, /skipped \+= 1/);
});

test("materializer returns empty result for projects with no RAID items", () => {
  assert.match(materializer, /items\.length === 0/);
  assert.match(materializer, /created: 0, updated: 0, skipped: 0/);
});

test("index re-exports all public symbols", () => {
  assert.match(indexFile, /generateRecommendedActions/);
  assert.match(indexFile, /materializeRecommendedActions/);
  assert.match(indexFile, /RecommendedActionsMaterializationResult/);
  assert.match(indexFile, /GeneratedRecommendedAction/);
});

test("API route requires authentication and project read access", () => {
  assert.match(route, /requireAuthenticatedUser/);
  assert.match(route, /requireProjectAccess\(projectId, "read"\)/);
});

test("API route supports projectId, raidItemId, and status filters", () => {
  assert.match(route, /projectId/);
  assert.match(route, /raidItemId/);
  assert.match(route, /status/);
});

test("API route sorts by confidence desc then created desc", () => {
  assert.match(route, /confidence_score.*ascending.*false/);
  assert.match(route, /created_at.*ascending.*false/);
});

test("API route returns recommendedActions array", () => {
  assert.match(route, /recommendedActions/);
});

test("discovery repository triggers recommended actions after RAID materialization", () => {
  assert.match(repository, /materializeRecommendedActions/);
  assert.match(repository, /from "@\/lib\/recommended-actions"/);
});

test("operational shell loads and renders recommended actions panel", () => {
  assert.match(shell, /recommended-actions/);
  assert.match(shell, /recommendedActions/);
  assert.match(shell, /Recommended Actions/);
  assert.match(shell, /Top Recommended Action/);
});

test("operational shell supports status quick filters", () => {
  assert.match(shell, /proposed/);
  assert.match(shell, /accepted/);
  assert.match(shell, /rejected/);
  assert.match(shell, /deferred/);
  assert.match(shell, /converted/);
});

const runtimeProbe = String.raw`
import assert from "node:assert/strict";
import { generateRecommendedActions } from "./src/lib/recommended-actions/index.ts";

const ids = (() => { let i = 0; return () => "00000000-0000-0000-0000-" + String(++i).padStart(12, "0"); })();
const workspaceId = "00000000-0000-0000-0000-000000000101";
const projectId = "00000000-0000-0000-0000-000000000202";

// Risk item — generic
const riskItem = { id: ids(), workspaceId, projectId, category: "risk", title: "Vendor delivery delay risk", description: "Vendor may not deliver on time", confidenceScore: 75, owner: null, sourceSignalId: null };
const riskActions = generateRecommendedActions(riskItem);
assert.ok(riskActions.length >= 1, "risk item generates at least one action");
const riskTypes = riskActions.map(a => a.recommendedActionType);
assert.ok(riskTypes.some(t => ["create_mitigation_plan", "request_approval", "schedule_meeting"].includes(t)), "risk actions include mitigation or approval type");
assert.ok(riskTypes.includes("follow_up"), "risk actions include follow_up");

// Risk item — approval dependency
const approvalRiskItem = { id: ids(), workspaceId, projectId, category: "risk", title: "Approval dependency from Cisco", description: "Awaiting Cisco approval to proceed", confidenceScore: 88, owner: "PM", sourceSignalId: null };
const approvalActions = generateRecommendedActions(approvalRiskItem);
const approvalTypes = approvalActions.map(a => a.recommendedActionType);
assert.ok(approvalTypes.includes("request_approval"), "approval risk generates request_approval action");
assert.ok(approvalTypes.includes("schedule_meeting"), "approval risk generates schedule_meeting action");

// Dependency item
const depItem = { id: ids(), workspaceId, projectId, category: "dependency", title: "Infrastructure access dependency", description: "Depends on site access clearance from facilities", confidenceScore: 80, owner: null, sourceSignalId: null };
const depActions = generateRecommendedActions(depItem);
const depTypes = depActions.map(a => a.recommendedActionType);
assert.ok(depTypes.includes("confirm_dependency"), "dependency generates confirm_dependency");
assert.ok(depTypes.includes("assign_owner"), "dependency with no owner generates assign_owner");
assert.ok(depTypes.includes("follow_up"), "dependency generates follow_up");

// Assumption item
const assumptionItem = { id: ids(), workspaceId, projectId, category: "assumption", title: "Team availability assumed for next sprint", description: "We assume the team will be fully available", confidenceScore: 60, owner: null, sourceSignalId: null };
const assumptionActions = generateRecommendedActions(assumptionItem);
const assumptionTypes = assumptionActions.map(a => a.recommendedActionType);
assert.ok(assumptionTypes.includes("review_assumption"), "assumption generates review_assumption");
assert.ok(assumptionTypes.includes("validate_scope"), "assumption generates validate_scope");

// Issue item — blocker
const issueItem = { id: ids(), workspaceId, projectId, category: "issue", title: "Network access blocked for team", description: "Team is blocked from accessing production environment", confidenceScore: 85, owner: null, sourceSignalId: null };
const issueActions = generateRecommendedActions(issueItem);
const issueTypes = issueActions.map(a => a.recommendedActionType);
assert.ok(issueTypes.includes("escalate_issue"), "blocker issue generates escalate_issue");
assert.ok(issueTypes.includes("create_mitigation_plan"), "issue generates create_mitigation_plan");

// Low-confidence issue treated as unknown
const unknownItem = { id: ids(), workspaceId, projectId, category: "issue", title: "Unknown timeline gap", description: "Unclear what the delivery gap is", confidenceScore: 25, owner: null, sourceSignalId: null };
const unknownActions = generateRecommendedActions(unknownItem);
const unknownTypes = unknownActions.map(a => a.recommendedActionType);
assert.ok(unknownTypes.includes("clarify_requirement"), "low-confidence issue generates clarify_requirement");
assert.ok(unknownTypes.includes("stakeholder_alignment"), "low-confidence issue generates stakeholder_alignment");

// Fingerprint determinism
const fp1 = generateRecommendedActions(riskItem)[0].fingerprint;
const fp2 = generateRecommendedActions(riskItem)[0].fingerprint;
assert.equal(fp1, fp2, "fingerprint is deterministic for same input");

// Different items produce different fingerprints
const fp3 = generateRecommendedActions(depItem)[0].fingerprint;
assert.notEqual(fp1, fp3, "different raid items produce different fingerprints");

// All actions default to proposed
for (const action of [...riskActions, ...depActions, ...assumptionActions, ...issueActions, ...unknownActions]) {
  assert.equal(action.status, "proposed", "all generated actions are proposed");
}

// All actions have evidence_summary with traceability
for (const action of riskActions) {
  assert.ok(action.evidenceSummary.raidItemId, "action has raidItemId in evidence_summary");
  assert.ok(action.evidenceSummary.raidCategory, "action has raidCategory in evidence_summary");
  assert.ok(action.evidenceSummary.discoveryOrigin, "action has discoveryOrigin in evidence_summary");
}

// Empty RAID: calling with empty array produces nothing
assert.equal([].flatMap(i => generateRecommendedActions(i)).length, 0, "empty RAID produces no actions");

console.log("All recommended-actions runtime probes passed.");
`;

test("runtime: risk generates actions with correct types and traceability", () => {
  execFileSync("npx", ["tsx", "--eval", runtimeProbe], { encoding: "utf8", stdio: "pipe" });
});

// ── H4: PM Decision Workflow ──────────────────────────────────────────────

test("H4: decision migration adds decision columns to recommended_actions", () => {
  for (const col of ["decision_reason", "decided_by", "decided_at", "deferred_until", "converted_task_id", "decision_metadata"]) {
    assert.match(decisionMigration, new RegExp(`\\b${col}\\b`), `column ${col} missing from decision migration`);
  }
});

test("H4: decision migration creates recommended_action_decisions table", () => {
  assert.match(decisionMigration, /create table if not exists public\.recommended_action_decisions/);
  for (const col of ["id", "workspace_id", "project_id", "recommended_action_id", "previous_status", "new_status", "decision_reason", "decided_by", "decided_at"]) {
    assert.match(decisionMigration, new RegExp(`\\b${col}\\b`), `audit column ${col} missing`);
  }
});

test("H4: decision migration creates required indexes", () => {
  assert.match(decisionMigration, /recommended_actions_project_status_idx/);
  assert.match(decisionMigration, /recommended_actions_decided_by_idx/);
  assert.match(decisionMigration, /recommended_action_decisions_action_idx/);
  assert.match(decisionMigration, /recommended_action_decisions_project_idx/);
});

test("H4: decision migration enables RLS on audit table", () => {
  assert.match(decisionMigration, /enable row level security/);
  assert.match(decisionMigration, /is_workspace_member\(workspace_id\)/);
});

test("H4: decision migration has updated_at trigger", () => {
  assert.match(decisionMigration, /set_updated_at/);
  assert.match(decisionMigration, /before update on public\.recommended_actions/);
});

test("H4: decision workflow validates allowed transitions", () => {
  assert.match(decisionWorkflow, /VALID_TRANSITIONS/);
  assert.match(decisionWorkflow, /proposed.*accepted.*rejected.*deferred.*converted_to_task/s);
  assert.match(decisionWorkflow, /invalid_transition/);
});

test("H4: decision workflow updates all decision fields", () => {
  assert.match(decisionWorkflow, /decision_reason/);
  assert.match(decisionWorkflow, /decided_by/);
  assert.match(decisionWorkflow, /decided_at/);
  assert.match(decisionWorkflow, /deferred_until/);
  assert.match(decisionWorkflow, /converted_task_id/);
  assert.match(decisionWorkflow, /decision_metadata/);
});

test("H4: decision workflow inserts into recommended_action_decisions audit table", () => {
  assert.match(decisionWorkflow, /recommended_action_decisions/);
  assert.match(decisionWorkflow, /previous_status/);
  assert.match(decisionWorkflow, /new_status/);
});

test("H4: decision workflow returns typed result contract", () => {
  assert.match(decisionWorkflow, /RecommendedActionDecisionResult/);
  assert.match(decisionWorkflow, /ok: true/);
  assert.match(decisionWorkflow, /ok: false/);
  assert.match(decisionWorkflow, /failureClass/);
});

test("H4: decision workflow covers all failure classes", () => {
  for (const fc of ["unauthenticated", "not_found", "unauthorized", "invalid_transition", "validation_failed", "persistence_failed"]) {
    assert.match(decisionWorkflow, new RegExp(fc), `failureClass ${fc} missing from decision workflow`);
  }
});

test("H4: decision workflow logs preserved decision event", () => {
  assert.match(materializer, /recommended_actions\.preserved_decision/);
  assert.match(materializer, /actionId/);
  assert.match(materializer, /fingerprint/);
});

test("H4: decision API endpoint exists and validates actionId and decision", () => {
  assert.match(decisionRoute, /actionId/);
  assert.match(decisionRoute, /decision/);
  assert.match(decisionRoute, /accepted.*rejected.*deferred.*converted_to_task/s);
});

test("H4: decision API maps failure classes to correct HTTP statuses", () => {
  assert.match(decisionRoute, /unauthenticated.*401/s);
  assert.match(decisionRoute, /not_found.*404/s);
  assert.match(decisionRoute, /unauthorized.*403/s);
});

test("H4: decision API does not expose raw Supabase errors", () => {
  assert.doesNotMatch(decisionRoute, /supabase\.error/);
  assert.doesNotMatch(decisionRoute, /error\.message/);
});

test("H4: index exports decision workflow types", () => {
  assert.match(indexFile, /DecisionInput/);
  assert.match(indexFile, /RecommendedActionDecisionResult/);
  assert.match(indexFile, /decision-workflow/);
});

test("H4: GET route selects decision fields", () => {
  assert.match(route, /decision_reason/);
  assert.match(route, /decided_at/);
  assert.match(route, /deferred_until/);
});

test("H4: UI includes decision controls for proposed actions", () => {
  assert.match(shell, /Accept/);
  assert.match(shell, /Reject/);
  assert.match(shell, /Defer/);
  assert.match(shell, /Convert/);
  assert.match(shell, /handleDecision/);
});

test("H4: UI does not show controls for rejected actions", () => {
  assert.match(shell, /status === "rejected".*no further actions/s);
});

test("H4: UI does not show controls for converted actions", () => {
  assert.match(shell, /status === "converted_to_task"/);
  assert.match(shell, /Converted/);
});

test("H4: UI shows decision history when decided_at is present", () => {
  assert.match(shell, /decided_at/);
  assert.match(shell, /decision_reason/);
  assert.match(shell, /deferred_until/);
});

test("H4: UI shows non-blocking error on decision failure", () => {
  assert.match(shell, /decisionError/);
});

test("H4: UI refreshes action list after decision", () => {
  assert.match(shell, /refreshActions/);
});

test("H4 hardening: governed recommendations are excluded from legacy GET and rejected by legacy decisions", () => {
  assert.match(route, /\.is\("governance_event_id", null\)/);
  assert.match(decisionWorkflow, /governance_event_id/);
  assert.match(decisionWorkflow, /Governed recommendations must be decided through the evidence-backed operational decision flow\./);
  assert.match(decisionWorkflow, /requireProjectAccess\(action\.project_id, "write"\)/);
  assert.match(decisionRoute, /governed_flow_required: 409/);
});
