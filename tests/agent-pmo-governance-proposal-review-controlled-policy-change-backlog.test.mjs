// ─── PMO Governance Proposal Review & Controlled Policy Change Backlog — Tests
// No LLM calls. No external API calls. No real side effects.
// Draft policies are NOT live policies.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-backlog-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-backlog-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-backlog-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-backlog-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260808000000_agent_pmo_governance_proposal_review_controlled_policy_change_backlog.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = existsSync(resolve(ROOT, "docs/agent-pmo-governance-proposal-review-controlled-policy-change-backlog.md"))
  ? readFileSync(resolve(ROOT, "docs/agent-pmo-governance-proposal-review-controlled-policy-change-backlog.md"), "utf8")
  : "";

const {
  validateAgentPmoPolicyBacklogItemStatus,
  validateAgentPmoPolicyBacklogItemType,
  validateAgentPmoPolicyBacklogPriority,
  validateAgentPmoPolicyChangeRequestStatus,
  validateAgentPmoPolicyChangeScopeType,
  validateAgentPmoPolicySimulationStatus,
  validateAgentPmoPolicyImpactLevel,
  validateAgentPmoGovernancePolicyDraftType,
  validateAgentPmoGovernancePolicyDraftStatus,
  validateAgentPmoPolicyApprovalStage,
  validateAgentPmoPolicyApprovalStatus,
  validateAgentPmoPolicyApprovalDecisionType,
  validateAgentPmoPolicyImplementationReadinessStatus,
  validateAgentPmoPolicyRollbackPlanType,
  validateAgentPmoPolicyRollbackPlanStatus,
  validateAgentPmoPolicyBacklogEventType,
  assertPolicyBacklogPayloadSerializable,
  redactPolicyBacklogPayload,
  sanitizePolicyBacklogText,
  dedupePolicyBacklogStrings,
  normalizeCreatePolicyBacklogItemInput,
  normalizeCreatePolicyChangeRequestInput,
  normalizePolicyApprovalDecisionInput,
  derivePolicyBacklogPriority,
  derivePolicyChangeScopeType,
  derivePolicyImpactLevel,
  evaluatePolicyImplementationReadiness,
} = await import("../src/lib/agents/agent-pmo-policy-backlog-validation.ts");

const {
  _clearPolicyBacklogStores,
  createPolicyBacklogItem,
  getPolicyBacklogItemById,
  listPolicyBacklogItems,
  updatePolicyBacklogItemStatus,
  createPolicyChangeRequest,
  getPolicyChangeRequestById,
  listPolicyChangeRequests,
  createPolicyChangeScope,
  listPolicyChangeScopes,
  createPolicySimulation,
  listPolicySimulations,
  completePolicySimulation,
  createPolicyImpactPreview,
  listPolicyImpactPreviews,
  createVersionedPolicyDraft,
  listPolicyDrafts,
  createPolicyApprovalWorkflow,
  getPolicyApprovalWorkflowById,
  listPolicyApprovalWorkflows,
  recordPolicyApprovalDecision,
  listPolicyApprovalDecisions,
  createImplementationReadiness,
  getLatestImplementationReadiness,
  createPolicyRollbackPlan,
  listPolicyRollbackPlans,
  recordPolicyBacklogEvent,
  listPolicyBacklogEvents,
} = await import("../src/lib/agents/agent-pmo-policy-backlog-registry.ts");

const {
  createPolicyBacklogItemFromProposal,
  createPolicyChangeRequestFromBacklogItem,
  runPolicyChangeSimulation,
  generatePolicyImpactPreview,
  createVersionedGovernancePolicyDraft,
  createPolicyApprovalWorkflowForRequest,
  recordPolicyApprovalDecisionForWorkflow,
  evaluatePolicyImplementationReadinessForRequest,
  createGovernancePolicyRollbackPlan,
  archivePolicyChangeRequest,
  buildPolicyBacklogSummary,
  getPolicyBacklogData,
} = await import("../src/lib/agents/agent-pmo-policy-backlog-service.ts");

// ─── Type/Status Array Tests ──────────────────────────────────────────────────

test("backlog item statuses contain expected values", () => {
  for (const s of ["created","open","analysis","simulation_ready","simulation_completed",
    "approval_ready","approved_for_future_implementation","rejected","archived"]) {
    assert.ok(validateAgentPmoPolicyBacklogItemStatus(s), `missing: ${s}`);
  }
  assert.ok(!validateAgentPmoPolicyBacklogItemStatus("invalid"));
});

test("backlog item types contain expected values", () => {
  for (const t of ["risk_policy","evidence_requirement","adapter_quality_review","review_routing",
    "human_review_policy","triage_policy","approval_policy","governance_process"]) {
    assert.ok(validateAgentPmoPolicyBacklogItemType(t), `missing: ${t}`);
  }
  assert.ok(!validateAgentPmoPolicyBacklogItemType("unknown"));
});

test("backlog priorities contain expected values", () => {
  for (const p of ["low","normal","high","urgent"]) {
    assert.ok(validateAgentPmoPolicyBacklogPriority(p), `missing: ${p}`);
  }
  assert.ok(!validateAgentPmoPolicyBacklogPriority("critical"));
});

test("change request statuses contain expected values", () => {
  for (const s of ["draft","open","simulation_pending","simulation_completed","approval_pending",
    "approved","rejected","deferred","archived"]) {
    assert.ok(validateAgentPmoPolicyChangeRequestStatus(s), `missing: ${s}`);
  }
});

test("change scope types contain expected values", () => {
  for (const t of ["risk_scoring","evidence_requirements","human_review_policy","review_routing",
    "triage_policy","adapter_governance","dispatch_gate_policy","approval_policy","governance_reporting"]) {
    assert.ok(validateAgentPmoPolicyChangeScopeType(t), `missing: ${t}`);
  }
});

test("simulation statuses contain expected values", () => {
  for (const s of ["created","running","completed","failed","cancelled"]) {
    assert.ok(validateAgentPmoPolicySimulationStatus(s), `missing: ${s}`);
  }
});

test("impact levels contain expected values", () => {
  for (const l of ["none","low","medium","high","critical"]) {
    assert.ok(validateAgentPmoPolicyImpactLevel(l), `missing: ${l}`);
  }
});

test("draft types contain expected values", () => {
  for (const t of ["risk_policy_draft","evidence_requirement_draft","review_routing_draft",
    "human_review_policy_draft","triage_policy_draft","adapter_governance_draft","approval_policy_draft"]) {
    assert.ok(validateAgentPmoGovernancePolicyDraftType(t), `missing: ${t}`);
  }
});

test("draft statuses contain expected values", () => {
  for (const s of ["created","open","under_review","approved_for_future_implementation","rejected","archived"]) {
    assert.ok(validateAgentPmoGovernancePolicyDraftStatus(s), `missing: ${s}`);
  }
});

test("approval stages contain expected values", () => {
  for (const s of ["pmo_review","security_review","operations_review","executive_review",
    "data_governance_review","final_pmo_approval"]) {
    assert.ok(validateAgentPmoPolicyApprovalStage(s), `missing: ${s}`);
  }
});

test("approval statuses contain expected values", () => {
  for (const s of ["not_started","pending","approved","rejected","changes_requested","skipped","cancelled"]) {
    assert.ok(validateAgentPmoPolicyApprovalStatus(s), `missing: ${s}`);
  }
});

test("approval decision types contain expected values", () => {
  for (const d of ["approve","reject","request_changes","skip","cancel"]) {
    assert.ok(validateAgentPmoPolicyApprovalDecisionType(d), `missing: ${d}`);
  }
});

test("implementation readiness statuses contain expected values", () => {
  for (const s of ["not_ready","simulation_required","approval_required","rollback_required",
    "ready_for_future_implementation","blocked"]) {
    assert.ok(validateAgentPmoPolicyImplementationReadinessStatus(s), `missing: ${s}`);
  }
});

test("rollback plan types contain expected values", () => {
  for (const t of ["manual_rollback","version_revert","policy_disable","routing_restore",
    "scoring_restore","evidence_requirement_restore"]) {
    assert.ok(validateAgentPmoPolicyRollbackPlanType(t), `missing: ${t}`);
  }
});

test("rollback plan statuses contain expected values", () => {
  for (const s of ["created","open","reviewed","approved","rejected","archived"]) {
    assert.ok(validateAgentPmoPolicyRollbackPlanStatus(s), `missing: ${s}`);
  }
});

test("backlog event types contain expected values", () => {
  for (const e of ["policy_backlog_item_created","policy_change_request_created","policy_change_scope_created",
    "policy_simulation_created","policy_simulation_completed","policy_impact_preview_created",
    "policy_draft_created","policy_approval_workflow_created","policy_approval_decision_recorded",
    "policy_rollback_plan_created","policy_implementation_readiness_evaluated","policy_change_request_archived"]) {
    assert.ok(validateAgentPmoPolicyBacklogEventType(e), `missing: ${e}`);
  }
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

test("normalizeCreatePolicyBacklogItemInput validates required fields", () => {
  const result = normalizeCreatePolicyBacklogItemInput({
    workspaceId: "ws-1",
    itemType: "risk_policy",
    itemCategory: "risk",
    title: "Test Item",
    description: "Test description",
  });
  assert.equal(result.workspaceId, "ws-1");
  assert.equal(result.priority, "normal");
});

test("normalizeCreatePolicyBacklogItemInput rejects missing workspaceId", () => {
  assert.throws(() => normalizeCreatePolicyBacklogItemInput({
    workspaceId: "",
    itemType: "risk_policy",
    itemCategory: "risk",
    title: "Test",
    description: "Test",
  }));
});

test("normalizeCreatePolicyChangeRequestInput validates required fields", () => {
  const result = normalizeCreatePolicyChangeRequestInput({
    workspaceId: "ws-1",
    backlogItemId: "item-1",
    policyArea: "risk_policy",
    changeSummary: "Summary",
    changeRationale: "Rationale",
  });
  assert.equal(result.workspaceId, "ws-1");
});

test("normalizePolicyApprovalDecisionInput validates required fields", () => {
  const result = normalizePolicyApprovalDecisionInput({
    workspaceId: "ws-1",
    workflowId: "wf-1",
    stage: "pmo_review",
    decisionType: "approve",
  });
  assert.equal(result.stage, "pmo_review");
});

test("sanitizePolicyBacklogText truncates long text", () => {
  const long = "A".repeat(500);
  const result = sanitizePolicyBacklogText(long, 240);
  assert.ok(result.length <= 240);
});

test("dedupePolicyBacklogStrings removes duplicates", () => {
  const result = dedupePolicyBacklogStrings(["a","b","a","c","b"]);
  assert.deepEqual(result, ["a","b","c"]);
});

test("payload redaction blocks forbidden keys", () => {
  const payload = {
    itemType: "risk_policy",
    password: "secret123",
    token: "abc",
    email: "user@example.com",
    raw_payload: "raw data",
    outcomePayload: "outcome",
    customer: "customer name",
  };
  const result = redactPolicyBacklogPayload(payload);
  assert.ok(!("password" in result));
  assert.ok(!("token" in result));
  assert.ok(!("email" in result));
  assert.ok(!("raw_payload" in result));
  assert.ok(!("outcomePayload" in result));
  assert.ok(!("customer" in result));
  assert.ok("itemType" in result);
});

test("assertPolicyBacklogPayloadSerializable accepts valid payload", () => {
  assert.doesNotThrow(() => assertPolicyBacklogPayloadSerializable({ key: "value", count: 1 }));
});

test("derivePolicyBacklogPriority is deterministic", () => {
  const a = derivePolicyBacklogPriority({ itemType: "risk_policy", estimatedImpactLevel: "critical" });
  const b = derivePolicyBacklogPriority({ itemType: "risk_policy", estimatedImpactLevel: "critical" });
  assert.equal(a, b);
  assert.equal(a, "urgent");
});

test("derivePolicyChangeScopeType maps item types correctly", () => {
  assert.equal(derivePolicyChangeScopeType({ itemType: "risk_policy" }), "risk_scoring");
  assert.equal(derivePolicyChangeScopeType({ itemType: "evidence_requirement" }), "evidence_requirements");
  assert.equal(derivePolicyChangeScopeType({ itemType: "review_routing" }), "review_routing");
});

test("derivePolicyImpactLevel is deterministic", () => {
  const a = derivePolicyImpactLevel({ estimatedAffectedCount: 1000, estimatedApprovalRateChange: 20, estimatedRejectionRateChange: 0 });
  const b = derivePolicyImpactLevel({ estimatedAffectedCount: 1000, estimatedApprovalRateChange: 20, estimatedRejectionRateChange: 0 });
  assert.equal(a, b);
  assert.equal(a, "critical");
});

test("evaluatePolicyImplementationReadiness returns correct statuses", () => {
  assert.equal(
    evaluatePolicyImplementationReadiness({ simulationCompleted: true, approvalCompleted: true, rollbackPlanPresent: true }),
    "ready_for_future_implementation",
  );
  assert.equal(
    evaluatePolicyImplementationReadiness({ simulationCompleted: false, approvalCompleted: true, rollbackPlanPresent: true }),
    "simulation_required",
  );
  assert.equal(
    evaluatePolicyImplementationReadiness({ simulationCompleted: true, approvalCompleted: false, rollbackPlanPresent: true }),
    "approval_required",
  );
  assert.equal(
    evaluatePolicyImplementationReadiness({ simulationCompleted: true, approvalCompleted: true, rollbackPlanPresent: false }),
    "rollback_required",
  );
  assert.equal(
    evaluatePolicyImplementationReadiness({ simulationCompleted: false, approvalCompleted: false, rollbackPlanPresent: false, blockedReasons: ["x"] }),
    "blocked",
  );
});

// ─── Migration Tests ──────────────────────────────────────────────────────────

test("migration creates agent_pmo_policy_backlog_items table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_backlog_items"));
});

test("migration creates agent_pmo_policy_change_requests table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_change_requests"));
});

test("migration creates agent_pmo_policy_change_scopes table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_change_scopes"));
});

test("migration creates agent_pmo_policy_simulations table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_simulations"));
});

test("migration creates agent_pmo_policy_impact_previews table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_impact_previews"));
});

test("migration creates agent_pmo_governance_policy_drafts table", () => {
  assert.ok(migrationFile.includes("agent_pmo_governance_policy_drafts"));
});

test("migration creates agent_pmo_policy_approval_workflows table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_approval_workflows"));
});

test("migration creates agent_pmo_policy_approval_decisions table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_approval_decisions"));
});

test("migration creates agent_pmo_policy_implementation_readiness table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_implementation_readiness"));
});

test("migration creates agent_pmo_policy_rollback_plans table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_rollback_plans"));
});

test("migration creates agent_pmo_policy_backlog_events table", () => {
  assert.ok(migrationFile.includes("agent_pmo_policy_backlog_events"));
});

test("migration enables RLS on all tables", () => {
  assert.ok(migrationFile.includes("enable row level security") || migrationFile.includes("ENABLE ROW LEVEL SECURITY"));
});

test("migration creates indexes", () => {
  assert.ok(migrationFile.includes("create index") || migrationFile.includes("CREATE INDEX"));
});

test("migration references workspaces", () => {
  assert.ok(migrationFile.includes("workspaces"));
});

test("migration does not use unrestricted true policies", () => {
  const policyLines = migrationFile.split("\n").filter(l => l.includes("using (true)") || l.includes("USING (true)"));
  assert.equal(policyLines.length, 0, "Should not use unrestricted 'using (true)' policies");
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("contract includes AgentPmoPolicyBacklogItemRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyBacklogItemRow"));
});

test("contract includes AgentPmoPolicyChangeRequestRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyChangeRequestRow"));
});

test("contract includes AgentPmoPolicyChangeScopeRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyChangeScopeRow"));
});

test("contract includes AgentPmoPolicySimulationRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicySimulationRow"));
});

test("contract includes AgentPmoPolicyImpactPreviewRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyImpactPreviewRow"));
});

test("contract includes AgentPmoGovernancePolicyDraftRow", () => {
  assert.ok(contractFile.includes("AgentPmoGovernancePolicyDraftRow"));
});

test("contract includes AgentPmoPolicyApprovalWorkflowRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyApprovalWorkflowRow"));
});

test("contract includes AgentPmoPolicyApprovalDecisionRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyApprovalDecisionRow"));
});

test("contract includes AgentPmoPolicyImplementationReadinessRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyImplementationReadinessRow"));
});

test("contract includes AgentPmoPolicyRollbackPlanRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyRollbackPlanRow"));
});

test("contract includes AgentPmoPolicyBacklogEventRow", () => {
  assert.ok(contractFile.includes("AgentPmoPolicyBacklogEventRow"));
});

test("contract includes policy backlog column arrays", () => {
  assert.ok(contractFile.includes("AGENT_PMO_POLICY_BACKLOG_ITEM_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_PMO_POLICY_CHANGE_REQUEST_COLUMNS"));
});

test("contract version string updated with policy backlog", () => {
  assert.ok(contractFile.includes("pmo-governance-proposal-review-controlled-policy-change-backlog"));
});

// ─── Registry Tests ───────────────────────────────────────────────────────────

test("registry exports createPolicyBacklogItem", () => {
  assert.equal(typeof createPolicyBacklogItem, "function");
});

test("registry exports listPolicyBacklogItems", () => {
  assert.equal(typeof listPolicyBacklogItems, "function");
});

test("registry exports createPolicyChangeRequest", () => {
  assert.equal(typeof createPolicyChangeRequest, "function");
});

test("registry exports listPolicyChangeRequests", () => {
  assert.equal(typeof listPolicyChangeRequests, "function");
});

test("registry exports createPolicySimulation", () => {
  assert.equal(typeof createPolicySimulation, "function");
});

test("registry exports completePolicySimulation", () => {
  assert.equal(typeof completePolicySimulation, "function");
});

test("registry exports createVersionedPolicyDraft", () => {
  assert.equal(typeof createVersionedPolicyDraft, "function");
});

test("registry exports createPolicyApprovalWorkflow", () => {
  assert.equal(typeof createPolicyApprovalWorkflow, "function");
});

test("registry exports recordPolicyApprovalDecision", () => {
  assert.equal(typeof recordPolicyApprovalDecision, "function");
});

test("registry exports listPolicyApprovalDecisions", () => {
  assert.equal(typeof listPolicyApprovalDecisions, "function");
});

test("registry exports createImplementationReadiness", () => {
  assert.equal(typeof createImplementationReadiness, "function");
});

test("registry exports createPolicyRollbackPlan", () => {
  assert.equal(typeof createPolicyRollbackPlan, "function");
});

test("registry exports recordPolicyBacklogEvent", () => {
  assert.equal(typeof recordPolicyBacklogEvent, "function");
});

test("registry exports listPolicyBacklogEvents", () => {
  assert.equal(typeof listPolicyBacklogEvents, "function");
});

test("events are append-only", async () => {
  _clearPolicyBacklogStores();
  await recordPolicyBacklogEvent({ workspaceId: "ws-ev", eventType: "policy_backlog_item_created" });
  await recordPolicyBacklogEvent({ workspaceId: "ws-ev", eventType: "policy_change_request_created" });
  const events = await listPolicyBacklogEvents({ workspaceId: "ws-ev" });
  assert.ok(events.length >= 2);
});

test("approval decisions are append-only", async () => {
  _clearPolicyBacklogStores();
  const wf = await createPolicyApprovalWorkflow({
    workspaceId: "ws-dec",
    changeRequestId: "cr-1",
    requiredStages: ["pmo_review"],
  });
  await recordPolicyApprovalDecision({ workspaceId: "ws-dec", workflowId: wf.id, stage: "pmo_review", decisionType: "approve", status: "approved" });
  await recordPolicyApprovalDecision({ workspaceId: "ws-dec", workflowId: wf.id, stage: "pmo_review", decisionType: "approve", status: "approved" });
  const decisions = await listPolicyApprovalDecisions("ws-dec", wf.id);
  assert.ok(decisions.length >= 2);
});

test("policy drafts are versioned", async () => {
  _clearPolicyBacklogStores();
  const cr = await createPolicyChangeRequest({
    workspaceId: "ws-draft",
    backlogItemId: "item-1",
    policyArea: "risk_policy",
    changeSummary: "Summary",
    changeRationale: "Rationale",
  });
  const d1 = await createVersionedPolicyDraft({ workspaceId: "ws-draft", changeRequestId: cr.id, draftType: "risk_policy_draft", draftTitle: "Draft 1", draftSummary: "Summary 1" });
  const d2 = await createVersionedPolicyDraft({ workspaceId: "ws-draft", changeRequestId: cr.id, draftType: "risk_policy_draft", draftTitle: "Draft 2", draftSummary: "Summary 2" });
  assert.equal(d1.draftVersion, 1);
  assert.equal(d2.draftVersion, 2);
});

test("registry does not apply policies", () => {
  assert.ok(!registryFile.includes("applyPolicy"));
  assert.ok(!registryFile.includes("mutatePolicy"));
  assert.ok(!registryFile.includes("activatePolicy"));
  assert.ok(!registryFile.includes("deployPolicy"));
});

// ─── Service Tests ────────────────────────────────────────────────────────────

test("service exports createPolicyBacklogItemFromProposal", () => {
  assert.equal(typeof createPolicyBacklogItemFromProposal, "function");
});

test("service exports createPolicyChangeRequestFromBacklogItem", () => {
  assert.equal(typeof createPolicyChangeRequestFromBacklogItem, "function");
});

test("service exports runPolicyChangeSimulation", () => {
  assert.equal(typeof runPolicyChangeSimulation, "function");
});

test("service exports generatePolicyImpactPreview", () => {
  assert.equal(typeof generatePolicyImpactPreview, "function");
});

test("service exports createVersionedGovernancePolicyDraft", () => {
  assert.equal(typeof createVersionedGovernancePolicyDraft, "function");
});

test("service exports createPolicyApprovalWorkflowForRequest", () => {
  assert.equal(typeof createPolicyApprovalWorkflowForRequest, "function");
});

test("service exports recordPolicyApprovalDecisionForWorkflow", () => {
  assert.equal(typeof recordPolicyApprovalDecisionForWorkflow, "function");
});

test("service exports evaluatePolicyImplementationReadinessForRequest", () => {
  assert.equal(typeof evaluatePolicyImplementationReadinessForRequest, "function");
});

test("service exports createGovernancePolicyRollbackPlan", () => {
  assert.equal(typeof createGovernancePolicyRollbackPlan, "function");
});

test("service exports archivePolicyChangeRequest", () => {
  assert.equal(typeof archivePolicyChangeRequest, "function");
});

test("service exports buildPolicyBacklogSummary", () => {
  assert.equal(typeof buildPolicyBacklogSummary, "function");
});

test("service exports getPolicyBacklogData", () => {
  assert.equal(typeof getPolicyBacklogData, "function");
});

test("service does not call LLM providers", () => {
  assert.ok(!serviceFile.includes("openai"));
  assert.ok(!serviceFile.includes("anthropic"));
  assert.ok(!serviceFile.includes("gemini"));
  assert.ok(!serviceFile.includes("embedding"));
  assert.ok(!serviceFile.includes("createEmbedding"));
});

test("service does not call external APIs directly", () => {
  assert.ok(!serviceFile.includes('fetch("http'));
  assert.ok(!serviceFile.includes('fetch("https'));
});

test("service does not send communications", () => {
  assert.ok(!serviceFile.includes("sendEmail"));
  assert.ok(!serviceFile.includes("send_email"));
  assert.ok(!serviceFile.includes("sendSlack"));
});

test("service does not apply policies", () => {
  assert.ok(!serviceFile.includes("applyPolicy"));
  assert.ok(!serviceFile.includes("mutatePolicy"));
  assert.ok(!serviceFile.includes("activatePolicy"));
  assert.ok(!serviceFile.includes("deployPolicy"));
});

test("service does not execute adapters", () => {
  assert.ok(!serviceFile.includes("executeAdapter"));
  assert.ok(!serviceFile.includes("runAdapter"));
  assert.ok(!serviceFile.includes("dispatchExecutionToAdapter"));
});

test("service does not train models", () => {
  assert.ok(!serviceFile.includes("trainModel"));
  assert.ok(!serviceFile.includes("fine-tune"));
  assert.ok(!serviceFile.includes("finetune"));
});

test("service does not change routing", () => {
  assert.ok(!serviceFile.includes("updateRouting"));
  assert.ok(!serviceFile.includes("changeRouting"));
});

// ─── Functional Service Tests ─────────────────────────────────────────────────

test("createPolicyBacklogItemFromProposal rejects non-approved proposals", async () => {
  _clearPolicyBacklogStores();
  // Need a proposal store populated — use registry from dashboard
  const { createPolicyProposal, _clearDashboardStores } = await import("../src/lib/agents/agent-pmo-governance-dashboard-registry.ts");
  _clearDashboardStores();
  const proposal = await createPolicyProposal({
    workspaceId: "ws-reject",
    proposalType: "risk_policy",
    proposalCategory: "risk",
    proposedChangeSummary: "Test proposal",
    riskLevel: "medium",
    status: "open",
  });
  await assert.rejects(() => createPolicyBacklogItemFromProposal({
    workspaceId: "ws-reject",
    proposalId: proposal.id,
  }));
});

test("createPolicyBacklogItemFromProposal accepts approved proposals", async () => {
  _clearPolicyBacklogStores();
  const { createPolicyProposal, recordPolicyProposalReview, _clearDashboardStores } = await import("../src/lib/agents/agent-pmo-governance-dashboard-registry.ts");
  _clearDashboardStores();
  const proposal = await createPolicyProposal({
    workspaceId: "ws-approved",
    proposalType: "risk_policy",
    proposalCategory: "risk",
    proposedChangeSummary: "Tighten risk review thresholds.",
    riskLevel: "medium",
  });
  await recordPolicyProposalReview("ws-approved", proposal.id, "approve_for_future_implementation");
  const item = await createPolicyBacklogItemFromProposal({
    workspaceId: "ws-approved",
    proposalId: proposal.id,
  });
  assert.ok(item.id);
  assert.equal(item.sourceProposalId, proposal.id);
  assert.equal(item.workspaceId, "ws-approved");
});

test("createPolicyChangeRequestFromBacklogItem creates request and scope", async () => {
  _clearPolicyBacklogStores();
  const item = await createPolicyBacklogItem({
    workspaceId: "ws-cr",
    itemType: "risk_policy",
    itemCategory: "risk",
    title: "Risk Policy Update",
    description: "Update risk scoring thresholds.",
    sourceSignalCount: 5,
  });
  const { changeRequest, scope } = await createPolicyChangeRequestFromBacklogItem({
    workspaceId: "ws-cr",
    backlogItemId: item.id,
  });
  assert.ok(changeRequest.id);
  assert.ok(scope.id);
  assert.equal(changeRequest.backlogItemId, item.id);
  assert.equal(scope.changeRequestId, changeRequest.id);
});

test("runPolicyChangeSimulation returns completed simulation", async () => {
  _clearPolicyBacklogStores();
  const cr = await createPolicyChangeRequest({
    workspaceId: "ws-sim",
    backlogItemId: "item-sim",
    policyArea: "risk_policy",
    changeSummary: "Adjust thresholds",
    changeRationale: "Signal volume analysis",
  });
  const sim = await runPolicyChangeSimulation({
    workspaceId: "ws-sim",
    changeRequestId: cr.id,
  });
  assert.ok(sim.id);
  assert.equal(sim.status, "completed");
  assert.ok(sim.safeSimulationSummary.includes("No AI was used"));
});

test("simulation is deterministic", async () => {
  _clearPolicyBacklogStores();
  const cr = await createPolicyChangeRequest({
    workspaceId: "ws-det",
    backlogItemId: "item-det",
    policyArea: "evidence_requirement",
    changeSummary: "Update evidence requirements",
    changeRationale: "Evidence gap analysis",
  });
  const sim1 = await runPolicyChangeSimulation({ workspaceId: "ws-det", changeRequestId: cr.id });
  _clearPolicyBacklogStores();
  const cr2 = await createPolicyChangeRequest({
    workspaceId: "ws-det",
    backlogItemId: "item-det",
    policyArea: "evidence_requirement",
    changeSummary: "Update evidence requirements",
    changeRationale: "Evidence gap analysis",
  });
  const sim2 = await runPolicyChangeSimulation({ workspaceId: "ws-det", changeRequestId: cr2.id });
  assert.equal(sim1.estimatedAffectedCount, sim2.estimatedAffectedCount);
  assert.equal(sim1.impactLevel, sim2.impactLevel);
});

test("createVersionedGovernancePolicyDraft creates non-live draft", async () => {
  _clearPolicyBacklogStores();
  const cr = await createPolicyChangeRequest({
    workspaceId: "ws-draft",
    backlogItemId: "item-d",
    policyArea: "risk_policy",
    changeSummary: "Update risk policy",
    changeRationale: "Analysis complete",
  });
  const draft = await createVersionedGovernancePolicyDraft({
    workspaceId: "ws-draft",
    changeRequestId: cr.id,
  });
  assert.ok(draft.id);
  assert.equal(draft.isLivePolicy, false);
  assert.ok(draft.draftSummary.includes("NOT A LIVE POLICY") || draft.draftSummary.includes("non-live"));
  assert.ok(draft.draftVersion >= 1);
});

test("evaluatePolicyImplementationReadinessForRequest evaluates prerequisites", async () => {
  _clearPolicyBacklogStores();
  const cr = await createPolicyChangeRequest({
    workspaceId: "ws-ready",
    backlogItemId: "item-r",
    policyArea: "risk_policy",
    changeSummary: "Ready for evaluation",
    changeRationale: "Analysis",
  });
  const readiness = await evaluatePolicyImplementationReadinessForRequest({
    workspaceId: "ws-ready",
    changeRequestId: cr.id,
  });
  assert.ok(readiness.id);
  assert.ok(["not_ready","simulation_required","approval_required","rollback_required","blocked","ready_for_future_implementation"].includes(readiness.readinessStatus));
  // Without simulation/approval/rollback, it should not be ready
  assert.ok(readiness.readinessStatus !== "ready_for_future_implementation");
});

test("buildPolicyBacklogSummary returns expected shape", async () => {
  _clearPolicyBacklogStores();
  const summary = await buildPolicyBacklogSummary("ws-sum");
  assert.ok(typeof summary.totalBacklogItems === "number");
  assert.ok(typeof summary.openBacklogItems === "number");
  assert.ok(typeof summary.totalChangeRequests === "number");
});

test("getPolicyBacklogData returns complete shape", async () => {
  _clearPolicyBacklogStores();
  const data = await getPolicyBacklogData({ workspaceId: "ws-data" });
  assert.ok(Array.isArray(data.backlogItems));
  assert.ok(Array.isArray(data.changeRequests));
  assert.ok(Array.isArray(data.simulations));
  assert.ok(Array.isArray(data.drafts));
  assert.ok(Array.isArray(data.workflows));
  assert.ok(typeof data.summary === "object");
});

test("archivePolicyChangeRequest sets status to archived", async () => {
  _clearPolicyBacklogStores();
  const cr = await createPolicyChangeRequest({
    workspaceId: "ws-arch",
    backlogItemId: "item-a",
    policyArea: "triage_policy",
    changeSummary: "Archive this",
    changeRationale: "Not needed",
  });
  const archived = await archivePolicyChangeRequest({
    workspaceId: "ws-arch",
    changeRequestId: cr.id,
  });
  assert.equal(archived.status, "archived");
});

// ─── API Route Tests ──────────────────────────────────────────────────────────

const routeBase = resolve(ROOT, "src/app/api/agents/execution/policy-backlog");

test("backlog-items route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "backlog-items/route.ts")));
});

test("change-requests route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "change-requests/route.ts")));
});

test("simulations route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "simulations/route.ts")));
});

test("drafts route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "drafts/route.ts")));
});

test("approval-workflows route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "approval-workflows/route.ts")));
});

test("rollback-plans route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "rollback-plans/route.ts")));
});

test("summary route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "summary/route.ts")));
});

test("data route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "data/route.ts")));
});

test("events route exists", () => {
  assert.ok(existsSync(resolve(routeBase, "events/route.ts")));
});

const routeFiles = [
  "backlog-items/route.ts", "change-requests/route.ts", "simulations/route.ts",
  "drafts/route.ts", "approval-workflows/route.ts", "rollback-plans/route.ts",
  "summary/route.ts", "data/route.ts", "events/route.ts",
].map(f => {
  try { return readFileSync(resolve(routeBase, f), "utf8"); } catch { return ""; }
}).join("\n");

test("route files do not call LLM providers", () => {
  assert.ok(!routeFiles.includes("openai"));
  assert.ok(!routeFiles.includes("anthropic"));
  assert.ok(!routeFiles.includes("gemini"));
});

test("route files do not send communications", () => {
  assert.ok(!routeFiles.includes("sendEmail"));
  assert.ok(!routeFiles.includes("sendSlack"));
});

test("route files do not apply policies", () => {
  assert.ok(!routeFiles.includes("applyPolicy"));
  assert.ok(!routeFiles.includes("mutatePolicy"));
  assert.ok(!routeFiles.includes("activatePolicy"));
  assert.ok(!routeFiles.includes("deployPolicy"));
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability types include policy backlog source", () => {
  assert.ok(obsFile.includes("agent_pmo_governance_proposal_review_controlled_policy_change_backlog"));
});

test("observability types include policy backlog event types", () => {
  assert.ok(obsFile.includes("pmo_policy_backlog_item_created"));
  assert.ok(obsFile.includes("pmo_policy_change_request_created"));
  assert.ok(obsFile.includes("pmo_policy_simulation_completed"));
  assert.ok(obsFile.includes("pmo_policy_draft_created"));
  assert.ok(obsFile.includes("pmo_policy_approval_decision_recorded"));
});

// ─── Terminology Tests ────────────────────────────────────────────────────────

const BAD_PATTERN = /[Ff]ucker/;

const newFiles = [
  typesFile, validationFile, registryFile, serviceFile,
  migrationFile, contractFile, indexFile, docsFile,
];

test("no informal terminology in added source files", () => {
  for (const f of newFiles) {
    assert.ok(!BAD_PATTERN.test(f), "Informal terminology found in a new file");
  }
});

// ─── Regression Tests ─────────────────────────────────────────────────────────

test("prior governance dashboard types file still exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-governance-dashboard-types.ts")));
});

test("prior governance dashboard service file still exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-governance-dashboard-service.ts")));
});

test("prior governance migration still exists", () => {
  assert.ok(existsSync(resolve(ROOT, "supabase/migrations/20260807000000_agent_controlled_pmo_governance_intelligence_dashboard.sql")));
});
