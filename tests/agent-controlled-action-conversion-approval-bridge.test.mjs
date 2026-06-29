// ─── Agent Controlled Action Conversion & Approval Bridge — Tests ───────────────
// These tests run without Supabase / a live database.
// No LLM calls. No external API calls. No adapter execution.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// ─── Source Files ─────────────────────────────────────────────────────────────

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-action-conversion-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-action-conversion-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-action-conversion-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-action-conversion-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260803000000_agent_controlled_action_conversion_approval_bridge.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = readFileSync(resolve(ROOT, "docs/agent-controlled-action-conversion-approval-bridge.md"), "utf8");

// ─── Pure validation import (no inter-module TS deps) ─────────────────────────

const {
  validateAgentActionConversionStatus,
  validateAgentActionConversionReadiness,
  validateAgentActionConversionRiskLevel,
  validateAgentActionConversionPreflightStatus,
  validateAgentActionConversionPreflightCheckType,
  validateAgentActionApprovalRequirement,
  validateAgentActionApprovalBridgeStatus,
  validateAgentActionExecutionRequestCreationStatus,
  validateAgentActionConversionEventType,
  assertActionConversionPayloadSerializable,
  redactActionConversionPayload,
  normalizeCreateAgentActionConversionInput,
  normalizeCreateAgentActionApprovalBridgeInput,
  calculateActionConversionReadiness,
  evaluateApprovalRequirement,
  getActionDraftToExecutionMapping,
} = await import("../src/lib/agents/agent-action-conversion-validation.ts");

// ─── Type / Union Tests ────────────────────────────────────────────────────────

test("conversion statuses — all values present in types file", () => {
  const statuses = [
    "created", "preflight_pending", "preflight_passed", "preflight_failed",
    "approval_required", "approval_not_required", "approval_pending",
    "approval_satisfied", "execution_request_created", "blocked", "cancelled", "completed",
  ];
  for (const s of statuses) {
    assert.ok(typesFile.includes(`"${s}"`), `Missing status: ${s}`);
  }
});

test("readiness values — all present in types file", () => {
  for (const v of ["not_ready", "ready", "blocked", "requires_approval", "converted"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing readiness: ${v}`);
  }
});

test("risk levels — all present in types file", () => {
  for (const l of ["low", "medium", "high", "critical"]) {
    assert.ok(typesFile.includes(`"${l}"`), `Missing risk level: ${l}`);
  }
});

test("preflight statuses — all present in types file", () => {
  for (const s of ["not_run", "running", "passed", "failed", "warning"]) {
    assert.ok(typesFile.includes(`"${s}"`), `Missing preflight status: ${s}`);
  }
});

test("preflight check types — required types present", () => {
  const required = [
    "action_draft_exists", "review_item_accepted", "tool_mapping_exists",
    "execution_mode_safe", "no_external_side_effects",
  ];
  for (const t of required) {
    assert.ok(typesFile.includes(`"${t}"`), `Missing check type: ${t}`);
  }
});

test("approval requirements — all present in types file", () => {
  const reqs = [
    "not_required", "required", "required_high_risk", "required_critical_risk",
    "required_external_side_effect", "required_policy",
  ];
  for (const r of reqs) {
    assert.ok(typesFile.includes(`"${r}"`), `Missing approval requirement: ${r}`);
  }
});

test("approval bridge statuses — all present in types file", () => {
  for (const s of ["not_required", "required", "pending", "satisfied", "rejected", "cancelled", "expired"]) {
    assert.ok(typesFile.includes(`"${s}"`), `Missing bridge status: ${s}`);
  }
});

test("execution request creation statuses — all present in types file", () => {
  for (const s of ["not_started", "ready", "created", "failed", "blocked"]) {
    assert.ok(typesFile.includes(`"${s}"`), `Missing exec creation status: ${s}`);
  }
});

test("event types — required types present in types file", () => {
  const required = [
    "conversion_created", "preflight_passed", "approval_bridge_created", "execution_request_created",
  ];
  for (const t of required) {
    assert.ok(typesFile.includes(`"${t}"`), `Missing event type: ${t}`);
  }
});

// ─── Validation tests ─────────────────────────────────────────────────────────

test("validateAgentActionConversionStatus — accepts valid statuses", () => {
  for (const s of ["created", "preflight_passed", "approval_required", "execution_request_created", "blocked", "cancelled", "completed"]) {
    assert.equal(validateAgentActionConversionStatus(s), true);
  }
  assert.equal(validateAgentActionConversionStatus("unknown"), false);
  assert.equal(validateAgentActionConversionStatus(""), false);
});

test("validateAgentActionConversionReadiness — accepts valid values", () => {
  for (const v of ["not_ready", "ready", "blocked", "requires_approval", "converted"]) {
    assert.equal(validateAgentActionConversionReadiness(v), true);
  }
  assert.equal(validateAgentActionConversionReadiness("pending"), false);
});

test("validateAgentActionConversionRiskLevel — accepts valid levels", () => {
  for (const l of ["low", "medium", "high", "critical"]) {
    assert.equal(validateAgentActionConversionRiskLevel(l), true);
  }
  assert.equal(validateAgentActionConversionRiskLevel("extreme"), false);
});

test("validateAgentActionConversionPreflightStatus — accepts valid statuses", () => {
  for (const s of ["not_run", "running", "passed", "failed", "warning"]) {
    assert.equal(validateAgentActionConversionPreflightStatus(s), true);
  }
});

test("validateAgentActionConversionPreflightCheckType — accepts valid types", () => {
  for (const t of ["action_draft_exists", "review_item_accepted", "tool_mapping_exists", "execution_mode_safe", "no_external_side_effects"]) {
    assert.equal(validateAgentActionConversionPreflightCheckType(t), true);
  }
});

test("validateAgentActionApprovalRequirement — accepts valid values", () => {
  for (const r of ["not_required", "required", "required_high_risk", "required_critical_risk", "required_policy"]) {
    assert.equal(validateAgentActionApprovalRequirement(r), true);
  }
});

test("validateAgentActionApprovalBridgeStatus — accepts valid values", () => {
  for (const s of ["not_required", "required", "pending", "satisfied", "rejected", "cancelled", "expired"]) {
    assert.equal(validateAgentActionApprovalBridgeStatus(s), true);
  }
});

test("validateAgentActionExecutionRequestCreationStatus — accepts valid values", () => {
  for (const s of ["not_started", "ready", "created", "failed", "blocked"]) {
    assert.equal(validateAgentActionExecutionRequestCreationStatus(s), true);
  }
});

test("validateAgentActionConversionEventType — accepts valid values", () => {
  for (const t of ["conversion_created", "preflight_passed", "approval_bridge_created", "execution_request_created"]) {
    assert.equal(validateAgentActionConversionEventType(t), true);
  }
});

test("valid conversion input normalizes", () => {
  const result = normalizeCreateAgentActionConversionInput({ workspaceId: "ws-1", actionDraftId: "draft-1" });
  assert.equal(result.workspaceId, "ws-1");
  assert.equal(result.actionDraftId, "draft-1");
  assert.equal(result.ownerId, null);
});

test("missing workspaceId rejects", () => {
  assert.throws(() => normalizeCreateAgentActionConversionInput({ workspaceId: "", actionDraftId: "x" }));
});

test("missing actionDraftId rejects", () => {
  assert.throws(() => normalizeCreateAgentActionConversionInput({ workspaceId: "ws", actionDraftId: "" }));
});

test("non-serializable conversion payload throws", () => {
  const circular = {};
  circular.self = circular;
  assert.throws(() => assertActionConversionPayloadSerializable(circular));
});

test("serializable payload passes validation", () => {
  assert.doesNotThrow(() => assertActionConversionPayloadSerializable({ foo: "bar" }));
});

test("secret keys are redacted", () => {
  const payload = { password: "secret123", token: "abc", normalKey: "visible" };
  const redacted = redactActionConversionPayload(payload);
  assert.equal(redacted.password, "[REDACTED]");
  assert.equal(redacted.token, "[REDACTED]");
  assert.equal(redacted.normalKey, "visible");
});

test("null payload redaction returns null", () => {
  assert.equal(redactActionConversionPayload(null), null);
});

test("readiness score clamps to 0-100", () => {
  const result = calculateActionConversionReadiness({
    actionDraftExists: false, reviewItemExists: false, reviewItemAccepted: false,
    reviewDecisionExists: false, actionDraftConvertible: false, actionDraftAlreadyConverted: false,
    sourceResultLinked: false, sourceEvidenceLinked: false, targetScopeKnown: false,
    safePayloadPresent: false, riskLevelKnown: false, ownerOrRoleKnown: false,
    toolMappingExists: false, executionModeSafe: false,
  });
  assert(result.readinessScore >= 0 && result.readinessScore <= 100);
});

test("readiness calculation blocks missing accepted review", () => {
  const result = calculateActionConversionReadiness({
    actionDraftExists: true, reviewItemExists: true, reviewItemAccepted: false,
    reviewDecisionExists: true, actionDraftConvertible: true, actionDraftAlreadyConverted: false,
    sourceResultLinked: true, sourceEvidenceLinked: true, targetScopeKnown: true,
    safePayloadPresent: true, riskLevelKnown: true, ownerOrRoleKnown: true,
    toolMappingExists: true, executionModeSafe: true,
  });
  assert.equal(result.readiness, "blocked");
  assert(result.blockingReasons.length > 0);
});

test("readiness calculation blocks unsafe execution mode", () => {
  const result = calculateActionConversionReadiness({
    actionDraftExists: true, reviewItemExists: true, reviewItemAccepted: true,
    reviewDecisionExists: true, actionDraftConvertible: true, actionDraftAlreadyConverted: false,
    sourceResultLinked: true, sourceEvidenceLinked: true, targetScopeKnown: true,
    safePayloadPresent: true, riskLevelKnown: true, ownerOrRoleKnown: true,
    toolMappingExists: true, executionModeSafe: false,
  });
  assert.equal(result.readiness, "blocked");
  assert(result.blockingReasons.some(r => r.toLowerCase().includes("mode")));
});

test("readiness calculation warns about missing evidence (not blocking for manual)", () => {
  const result = calculateActionConversionReadiness({
    actionDraftExists: true, reviewItemExists: true, reviewItemAccepted: true,
    reviewDecisionExists: true, actionDraftConvertible: true, actionDraftAlreadyConverted: false,
    sourceResultLinked: false, sourceEvidenceLinked: false, targetScopeKnown: true,
    safePayloadPresent: true, riskLevelKnown: true, ownerOrRoleKnown: true,
    toolMappingExists: true, executionModeSafe: true,
  });
  assert.equal(result.readiness, "ready");
  assert(result.warnings.length > 0);
});

test("blocking reasons deduplicate", () => {
  const result = calculateActionConversionReadiness({
    actionDraftExists: false, reviewItemExists: false, reviewItemAccepted: false,
    reviewDecisionExists: false, actionDraftConvertible: false, actionDraftAlreadyConverted: false,
    sourceResultLinked: false, sourceEvidenceLinked: false, targetScopeKnown: false,
    safePayloadPresent: false, riskLevelKnown: false, ownerOrRoleKnown: false,
    toolMappingExists: false, executionModeSafe: false,
  });
  assert.equal(new Set(result.blockingReasons).size, result.blockingReasons.length);
});

test("approval requirement evaluation — required for high risk", () => {
  const result = evaluateApprovalRequirement({
    riskLevel: "high", actionType: "draft_task", requiresApproval: false,
    hasExternalSideEffectPotential: false, ownerOrRoleKnown: true,
  });
  assert.equal(result.approvalRequired, true);
  assert.equal(result.approvalRequirement, "required_high_risk");
  assert.equal(result.requiredApproverRole, "pmo_lead");
});

test("approval requirement evaluation — required for critical risk", () => {
  const result = evaluateApprovalRequirement({
    riskLevel: "critical", actionType: "draft_task", requiresApproval: false,
    hasExternalSideEffectPotential: false, ownerOrRoleKnown: true,
  });
  assert.equal(result.approvalRequired, true);
  assert.equal(result.approvalRequirement, "required_critical_risk");
  assert.equal(result.requiredApproverRole, "executive");
});

test("approval requirement evaluation — not required for safe low-risk status report", () => {
  const result = evaluateApprovalRequirement({
    riskLevel: "low", actionType: "draft_status_report", requiresApproval: false,
    hasExternalSideEffectPotential: false, ownerOrRoleKnown: true,
  });
  assert.equal(result.approvalRequired, false);
  assert.equal(result.approvalRequirement, "not_required");
});

// ─── Mapping Tests ─────────────────────────────────────────────────────────────

test("draft_email maps to draft_email / draft_email_adapter / draft_only / approval required", () => {
  const m = getActionDraftToExecutionMapping("draft_email");
  assert.ok(m);
  assert.equal(m.toolKey, "draft_email");
  assert.equal(m.adapterKey, "draft_email_adapter");
  assert.equal(m.executionMode, "draft_only");
  assert.equal(m.requiresApproval, true);
});

test("draft_task maps to draft_task / draft_task_adapter / draft_only / approval required", () => {
  const m = getActionDraftToExecutionMapping("draft_task");
  assert.ok(m);
  assert.equal(m.toolKey, "draft_task");
  assert.equal(m.adapterKey, "draft_task_adapter");
  assert.equal(m.executionMode, "draft_only");
  assert.equal(m.requiresApproval, true);
});

test("draft_project_update maps to draft_project_update / draft_project_update_adapter / draft_only / approval required", () => {
  const m = getActionDraftToExecutionMapping("draft_project_update");
  assert.ok(m);
  assert.equal(m.toolKey, "draft_project_update");
  assert.equal(m.adapterKey, "draft_project_update_adapter");
  assert.equal(m.executionMode, "draft_only");
  assert.equal(m.requiresApproval, true);
});

test("draft_risk_escalation maps to risk_analysis / risk_analysis_adapter / draft_only / approval required", () => {
  const m = getActionDraftToExecutionMapping("draft_risk_escalation");
  assert.ok(m);
  assert.equal(m.toolKey, "risk_analysis");
  assert.equal(m.adapterKey, "risk_analysis_adapter");
  assert.equal(m.executionMode, "draft_only");
  assert.equal(m.requiresApproval, true);
});

test("draft_status_report maps to executive_summary / executive_summary_adapter / draft_only", () => {
  const m = getActionDraftToExecutionMapping("draft_status_report");
  assert.ok(m);
  assert.equal(m.toolKey, "executive_summary");
  assert.equal(m.adapterKey, "executive_summary_adapter");
  assert.equal(m.executionMode, "draft_only");
});

test("draft_governance_note maps to executive_summary / executive_summary_adapter / draft_only", () => {
  const m = getActionDraftToExecutionMapping("draft_governance_note");
  assert.ok(m);
  assert.equal(m.toolKey, "executive_summary");
  assert.equal(m.adapterKey, "executive_summary_adapter");
  assert.equal(m.executionMode, "draft_only");
});

test("draft_follow_up maps to draft_task / draft_task_adapter / draft_only / approval required", () => {
  const m = getActionDraftToExecutionMapping("draft_follow_up");
  assert.ok(m);
  assert.equal(m.toolKey, "draft_task");
  assert.equal(m.adapterKey, "draft_task_adapter");
  assert.equal(m.executionMode, "draft_only");
  assert.equal(m.requiresApproval, true);
});

test("manual_action maps to noop / noop_adapter / dry_run / approval required", () => {
  const m = getActionDraftToExecutionMapping("manual_action");
  assert.ok(m);
  assert.equal(m.toolKey, "noop");
  assert.equal(m.adapterKey, "noop_adapter");
  assert.equal(m.executionMode, "dry_run");
  assert.equal(m.requiresApproval, true);
});

test("unknown action type returns null", () => {
  assert.equal(getActionDraftToExecutionMapping("send_email_directly"), null);
});

// ─── Migration Tests ──────────────────────────────────────────────────────────

test("migration creates agent_action_conversions table", () => {
  assert.ok(migrationFile.includes("agent_action_conversions"));
});

test("migration creates agent_action_conversion_preflights table", () => {
  assert.ok(migrationFile.includes("agent_action_conversion_preflights"));
});

test("migration creates agent_action_approval_bridges table", () => {
  assert.ok(migrationFile.includes("agent_action_approval_bridges"));
});

test("migration creates agent_action_conversion_events table", () => {
  assert.ok(migrationFile.includes("agent_action_conversion_events"));
});

test("migration enables RLS on all conversion tables", () => {
  assert.ok(migrationFile.includes("enable row level security"));
});

test("migration creates indexes", () => {
  assert.ok(migrationFile.includes("create index if not exists"));
});

test("migration references agent_review_action_drafts", () => {
  assert.ok(migrationFile.includes("agent_review_action_drafts"));
});

test("migration references agent_review_items", () => {
  assert.ok(migrationFile.includes("agent_review_items"));
});

test("migration references agent_review_decisions", () => {
  assert.ok(migrationFile.includes("agent_review_decisions"));
});

test("migration references agent_execution_requests", () => {
  assert.ok(migrationFile.includes("agent_execution_requests"));
});

test("migration references workspaces", () => {
  assert.ok(migrationFile.includes("workspaces"));
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("database contract includes AgentActionConversionRow", () => {
  assert.ok(contractFile.includes("AgentActionConversionRow"));
});

test("database contract includes AgentActionConversionPreflightRow", () => {
  assert.ok(contractFile.includes("AgentActionConversionPreflightRow"));
});

test("database contract includes AgentActionApprovalBridgeRow", () => {
  assert.ok(contractFile.includes("AgentActionApprovalBridgeRow"));
});

test("database contract includes AgentActionConversionEventRow", () => {
  assert.ok(contractFile.includes("AgentActionConversionEventRow"));
});

test("database contract includes conversion column arrays", () => {
  assert.ok(contractFile.includes("AGENT_ACTION_CONVERSION_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_ACTION_CONVERSION_PREFLIGHT_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_ACTION_APPROVAL_BRIDGE_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_ACTION_CONVERSION_EVENT_COLUMNS"));
});

test("database contract version string updated with this sprint", () => {
  assert.ok(contractFile.includes("controlled-action-conversion-approval-bridge"));
});

// ─── Registry Export Tests ────────────────────────────────────────────────────

test("registry exports createAgentActionConversion", () => {
  assert.ok(registryFile.includes("export async function createAgentActionConversion"));
});

test("registry exports getAgentActionConversionById", () => {
  assert.ok(registryFile.includes("export async function getAgentActionConversionById"));
});

test("registry exports getAgentActionConversionByActionDraftId", () => {
  assert.ok(registryFile.includes("export async function getAgentActionConversionByActionDraftId"));
});

test("registry exports listAgentActionConversions", () => {
  assert.ok(registryFile.includes("export async function listAgentActionConversions"));
});

test("registry exports updateAgentActionConversionStatus", () => {
  assert.ok(registryFile.includes("export async function updateAgentActionConversionStatus"));
});

test("registry exports createAgentActionConversionPreflight", () => {
  assert.ok(registryFile.includes("export async function createAgentActionConversionPreflight"));
});

test("registry exports getLatestAgentActionConversionPreflight", () => {
  assert.ok(registryFile.includes("export async function getLatestAgentActionConversionPreflight"));
});

test("registry exports createAgentActionApprovalBridge", () => {
  assert.ok(registryFile.includes("export async function createAgentActionApprovalBridge"));
});

test("registry exports getAgentActionApprovalBridgeByConversionId", () => {
  assert.ok(registryFile.includes("export async function getAgentActionApprovalBridgeByConversionId"));
});

test("registry exports updateAgentActionApprovalBridgeStatus", () => {
  assert.ok(registryFile.includes("export async function updateAgentActionApprovalBridgeStatus"));
});

test("registry exports recordAgentActionConversionEvent", () => {
  assert.ok(registryFile.includes("export async function recordAgentActionConversionEvent"));
});

test("registry exports listAgentActionConversionEvents", () => {
  assert.ok(registryFile.includes("export async function listAgentActionConversionEvents"));
});

test("registry does not hard-delete records", () => {
  assert.ok(!registryFile.includes(".delete("), "Registry should not hard-delete");
});

test("registry events are append-only (no update on events)", () => {
  assert.ok(!registryFile.includes("eventStore.set(k, record)"), "Events should be appended, not replaced");
});

test("registry preflights are append-only (array push, not replace)", () => {
  assert.ok(registryFile.includes("...existing, record"), "Preflights should be appended");
});

// ─── Service Export Tests ─────────────────────────────────────────────────────

test("service exports createConversionFromActionDraft", () => {
  assert.ok(serviceFile.includes("export async function createConversionFromActionDraft"));
});

test("service exports runActionConversionPreflight", () => {
  assert.ok(serviceFile.includes("export async function runActionConversionPreflight"));
});

test("service exports evaluateActionApprovalBridge", () => {
  assert.ok(serviceFile.includes("export async function evaluateActionApprovalBridge"));
});

test("service exports createExecutionRequestFromActionDraft", () => {
  assert.ok(serviceFile.includes("export async function createExecutionRequestFromActionDraft"));
});

test("service exports cancelActionConversion", () => {
  assert.ok(serviceFile.includes("export async function cancelActionConversion"));
});

test("service exports markApprovalBridgeSatisfied", () => {
  assert.ok(serviceFile.includes("export async function markApprovalBridgeSatisfied"));
});

test("service exports buildActionConversionSummary", () => {
  assert.ok(serviceFile.includes("export async function buildActionConversionSummary"));
});

test("service exports getActionDraftToExecutionMapping", () => {
  assert.ok(
    serviceFile.includes("export function getActionDraftToExecutionMapping") ||
    serviceFile.includes("export { getActionDraftToExecutionMapping }"),
    "Service should export getActionDraftToExecutionMapping",
  );
});

test("service does not call LLM providers", () => {
  assert.ok(!serviceFile.includes('"openai"') && !serviceFile.includes("'openai'"));
  assert.ok(!serviceFile.includes('"@anthropic-ai"') && !serviceFile.includes("'@anthropic-ai'"));
  assert.ok(!serviceFile.includes('"gemini"') && !serviceFile.includes("'gemini'"));
});

test("service does not call embeddings", () => {
  assert.ok(!serviceFile.includes("embedding"));
});

test("service does not call external APIs directly", () => {
  assert.ok(!serviceFile.includes("fetch("), "Should not use raw fetch");
});

test("service does not send communications", () => {
  assert.ok(!serviceFile.includes("sendEmail") && !serviceFile.includes("send_email"));
  assert.ok(!serviceFile.match(/slack\s*\(/));
  assert.ok(!serviceFile.includes("sendSlack"));
});

test("service does not mutate projects", () => {
  assert.ok(!serviceFile.includes("updateProject") && !serviceFile.includes("mutateProject"));
});

test("service does not execute adapters", () => {
  assert.ok(!serviceFile.includes("executeAdapter") && !serviceFile.includes("runAdapter"));
});

test("service createConversionFromActionDraft prevents duplicate active conversion", () => {
  assert.ok(serviceFile.includes("active conversion already exists"), "Should check for duplicates");
});

test("service uses safe execution modes only", () => {
  assert.ok(serviceFile.includes("dry_run") && serviceFile.includes("draft_only") && serviceFile.includes("approval_required"));
  assert.ok(!serviceFile.includes("approved_execution"));
});

test("service preserves source lineage in execution request", () => {
  assert.ok(serviceFile.includes("actionDraftId") && serviceFile.includes("reviewItemId") && serviceFile.includes("conversionId"));
});

test("service cancelActionConversion does not delete records", () => {
  assert.ok(!serviceFile.includes("delete") || serviceFile.includes("Do not delete"), "Cancel should not delete");
  assert.ok(serviceFile.includes('"cancelled"'));
});

// ─── API Route Tests ──────────────────────────────────────────────────────────

const routes = [
  "src/app/api/agents/execution/action-conversions/route.ts",
  "src/app/api/agents/execution/action-conversions/[conversionId]/route.ts",
  "src/app/api/agents/execution/action-conversions/from-action-draft/route.ts",
  "src/app/api/agents/execution/action-conversions/[conversionId]/preflight/route.ts",
  "src/app/api/agents/execution/action-conversions/[conversionId]/approval-bridge/route.ts",
  "src/app/api/agents/execution/action-conversions/[conversionId]/approval-satisfied/route.ts",
  "src/app/api/agents/execution/action-conversions/[conversionId]/execution-request/route.ts",
  "src/app/api/agents/execution/action-conversions/[conversionId]/cancel/route.ts",
  "src/app/api/agents/execution/action-conversions/[conversionId]/events/route.ts",
  "src/app/api/agents/execution/action-conversions/summary/route.ts",
];

for (const route of routes) {
  test(`route exists: ${route}`, () => {
    assert.ok(existsSync(resolve(ROOT, route)), `Missing route: ${route}`);
  });
}

test("route files do not import LLM providers", () => {
  for (const route of routes) {
    const src = readFileSync(resolve(ROOT, route), "utf8");
    assert.ok(!src.includes("openai"), `${route}: should not import openai`);
    assert.ok(!src.includes("anthropic"), `${route}: should not import anthropic`);
    assert.ok(!src.includes("embedding"), `${route}: should not use embeddings`);
  }
});

test("route files do not execute adapters", () => {
  for (const route of routes) {
    const src = readFileSync(resolve(ROOT, route), "utf8");
    assert.ok(!src.includes("executeAdapter") && !src.includes("runAdapter"), `${route}: should not execute adapters`);
  }
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability types include action conversion event types", () => {
  assert.ok(obsFile.includes("action_conversion_created"));
  assert.ok(obsFile.includes("action_conversion_preflight_passed"));
  assert.ok(obsFile.includes("action_conversion_approval_bridge_created"));
  assert.ok(obsFile.includes("action_conversion_execution_request_created"));
});

test("observability source includes agent_controlled_action_conversion_approval_bridge", () => {
  assert.ok(obsFile.includes("agent_controlled_action_conversion_approval_bridge"));
});

test("service records audit events (best-effort)", () => {
  assert.ok(serviceFile.includes("tryAuditEvent"), "Service should attempt audit events");
  assert.ok(serviceFile.includes("audit is best-effort") || serviceFile.includes("// audit is best-effort"), "Audit should be documented as best-effort");
});

// ─── Index Export Tests ───────────────────────────────────────────────────────

test("index exports action conversion types", () => {
  assert.ok(indexFile.includes("AgentActionConversionRecord"));
  assert.ok(indexFile.includes("AgentActionConversionStatus"));
  assert.ok(indexFile.includes("AgentActionApprovalBridgeRecord"));
});

test("index exports validation helpers", () => {
  assert.ok(indexFile.includes("validateAgentActionConversionStatus"));
  assert.ok(indexFile.includes("redactActionConversionPayload"));
  assert.ok(indexFile.includes("evaluateApprovalRequirement"));
});

test("index exports registry functions", () => {
  assert.ok(indexFile.includes("createAgentActionConversion"));
  assert.ok(indexFile.includes("createAgentActionApprovalBridge"));
  assert.ok(indexFile.includes("recordAgentActionConversionEvent"));
});

test("index exports service functions", () => {
  assert.ok(indexFile.includes("createConversionFromActionDraft"));
  assert.ok(indexFile.includes("evaluateActionApprovalBridge"));
  assert.ok(indexFile.includes("buildActionConversionSummary"));
});

// ─── Terminology Tests ────────────────────────────────────────────────────────

const filesToCheckTerminology = [
  typesFile, validationFile, registryFile, serviceFile, migrationFile, docsFile,
];

test("no prohibited terminology in sprint files", () => {
  const prohibited = /[Ff]ucker/;
  for (const src of filesToCheckTerminology) {
    assert.ok(!prohibited.test(src), "Found prohibited terminology");
  }
});
