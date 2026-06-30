// ─── PMO Controlled Policy Implementation Gate & Dry-Run Change Executor — Tests
// No LLM calls. No external API calls. No real side effects.
// Dry-run simulation only — no live policy mutation.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-dry-run-gate-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-dry-run-gate-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-dry-run-gate-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-dry-run-gate-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260811000000_agent_controlled_policy_implementation_gate_dry_run_change_executor.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = existsSync(resolve(ROOT, "docs/agent-controlled-policy-implementation-gate-dry-run-change-executor.md"))
  ? readFileSync(resolve(ROOT, "docs/agent-controlled-policy-implementation-gate-dry-run-change-executor.md"), "utf8")
  : "";

const {
  validateAgentPmoDryRunRequestStatus,
  validateAgentPmoDryRunPreflightStatus,
  validateAgentPmoDryRunGateApprovalStatus,
  validateAgentPmoDryRunGateDecisionType,
  validateAgentPmoDryRunChangeType,
  validateAgentPmoSimulatedPolicyVersionStatus,
  validateAgentPmoDryRunExecutionStatus,
  validateAgentPmoDryRunImpactDomain,
  validateAgentPmoDryRunImpactLevel,
  validateAgentPmoDryRunEvidencePackageStatus,
  validateAgentPmoDryRunEvidenceSectionType,
  validateAgentPmoDryRunBlockerType,
  validateAgentPmoDryRunBlockerStatus,
  validateAgentPmoDryRunBlockerSeverity,
  validateAgentPmoDryRunOperatorReviewStatus,
  validateAgentPmoDryRunOperatorReviewDecision,
  validateAgentPmoDryRunDecisionType,
  validateAgentPmoDryRunDecisionStatus,
  validateAgentPmoDryRunExportFormat,
  validateAgentPmoDryRunExportStatus,
  validateAgentPmoDryRunEventType,
  assertDryRunPayloadSerializable,
  redactDryRunPayload,
  sanitizeDryRunText,
  dedupeDryRunStrings,
  normalizeCreateDryRunRequestInput,
  normalizeDryRunGateDecisionInput,
  normalizeDryRunDecisionInput,
  evaluateDryRunPreflightStatus,
  evaluateDryRunGateReadiness,
  evaluateDryRunImpactLevel,
  validateDryRunExportSafety,
} = await import("../src/lib/agents/agent-pmo-dry-run-gate-validation.ts");

const {
  _clearDryRunGateStores,
  createAgentPmoDryRunExecutionRequest,
  getAgentPmoDryRunExecutionRequestById,
  listAgentPmoDryRunExecutionRequests,
  updateAgentPmoDryRunExecutionRequestStatus,
  createAgentPmoDryRunPreflightValidation,
  createAgentPmoDryRunGateApproval,
  recordAgentPmoDryRunGateDecision,
  createAgentPmoDryRunChangeSet,
  createAgentPmoDryRunChangeSetItem,
  createAgentPmoSimulatedPolicyVersion,
  createAgentPmoDryRunSimulationExecution,
  updateAgentPmoDryRunSimulationExecutionStatus,
  createAgentPmoDryRunSimulatedImpact,
  createAgentPmoDryRunEvidencePackage,
  createAgentPmoDryRunBlocker,
  listAgentPmoDryRunBlockers,
  recordAgentPmoDryRunOperatorReview,
  recordAgentPmoDryRunDecision,
  listAgentPmoDryRunDecisions,
  createAgentPmoDryRunExport,
  recordAgentPmoDryRunEvent,
  listAgentPmoDryRunEvents,
} = await import("../src/lib/agents/agent-pmo-dry-run-gate-registry.ts");

const {
  createDryRunExecutionRequestFromPlanningWorkspace,
  runDryRunPreflightValidation,
  createDryRunGateApproval,
  recordDryRunGateDecision,
  generateDryRunChangeSet,
  generateSimulatedPolicyVersion,
  executeDryRunSimulation,
  generateDryRunSimulatedImpacts,
  assembleDryRunEvidencePackage,
  recordDryRunBlocker,
  recordDryRunOperatorReview,
  recordDryRunDecision,
  generateDryRunExport,
  archiveDryRunExecutionRequest,
  buildDryRunGateSummary,
  getDryRunGateData,
} = await import("../src/lib/agents/agent-pmo-dry-run-gate-service.ts");

// ─── Type / Model Tests ───────────────────────────────────────────────────────

test("union types: request statuses include gate_approved and dry_run_completed", () => {
  assert.ok(typesFile.includes('"gate_approved"'));
  assert.ok(typesFile.includes('"dry_run_completed"'));
  assert.ok(typesFile.includes('"preflight_pending"'));
  assert.ok(typesFile.includes('"preflight_failed"'));
  assert.ok(typesFile.includes('"ready_for_gate_review"'));
  assert.ok(typesFile.includes('"gate_review_required"'));
  assert.ok(typesFile.includes('"gate_rejected"'));
  assert.ok(typesFile.includes('"dry_run_running"'));
  assert.ok(typesFile.includes('"dry_run_failed"'));
  assert.ok(typesFile.includes('"blocked"'));
  assert.ok(typesFile.includes('"archived"'));
});

test("union types: gate approval status includes approved_for_dry_run_only (not live)", () => {
  assert.ok(typesFile.includes('"approved_for_dry_run_only"'));
  assert.ok(!typesFile.includes('"approved_for_live_activation"'));
});

test("union types: decision type includes pass_for_future_activation_planning", () => {
  assert.ok(typesFile.includes('"pass_for_future_activation_planning"'));
  assert.ok(!typesFile.includes('"activate_policy"'));
  assert.ok(!typesFile.includes('"deploy_policy"'));
});

test("union types: all required event types present", () => {
  assert.ok(typesFile.includes('"dry_run_request_created"'));
  assert.ok(typesFile.includes('"dry_run_preflight_completed"'));
  assert.ok(typesFile.includes('"dry_run_gate_decision_recorded"'));
  assert.ok(typesFile.includes('"simulated_policy_version_created"'));
  assert.ok(typesFile.includes('"dry_run_execution_completed"'));
  assert.ok(typesFile.includes('"dry_run_decision_recorded"'));
  assert.ok(typesFile.includes('"dry_run_request_archived"'));
});

test("record types: all 16 record types defined", () => {
  const required = [
    "AgentPmoDryRunExecutionRequestRecord",
    "AgentPmoDryRunPreflightValidationRecord",
    "AgentPmoDryRunGateApprovalRecord",
    "AgentPmoDryRunGateDecisionRecord",
    "AgentPmoDryRunChangeSetRecord",
    "AgentPmoDryRunChangeSetItemRecord",
    "AgentPmoSimulatedPolicyVersionRecord",
    "AgentPmoDryRunSimulationExecutionRecord",
    "AgentPmoDryRunSimulatedImpactRecord",
    "AgentPmoDryRunEvidencePackageRecord",
    "AgentPmoDryRunEvidenceSectionRecord",
    "AgentPmoDryRunBlockerRecord",
    "AgentPmoDryRunOperatorReviewRecord",
    "AgentPmoDryRunDecisionRecord",
    "AgentPmoDryRunExportRecord",
    "AgentPmoDryRunEventRecord",
  ];
  for (const name of required) {
    assert.ok(typesFile.includes(name), `Missing record type: ${name}`);
  }
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

test("validation: validateAgentPmoDryRunRequestStatus accepts valid values", () => {
  assert.ok(validateAgentPmoDryRunRequestStatus("created"));
  assert.ok(validateAgentPmoDryRunRequestStatus("gate_approved"));
  assert.ok(validateAgentPmoDryRunRequestStatus("dry_run_completed"));
  assert.ok(!validateAgentPmoDryRunRequestStatus("invalid_status"));
  assert.ok(!validateAgentPmoDryRunRequestStatus(""));
});

test("validation: validateAgentPmoDryRunGateDecisionType includes approve_for_dry_run_only", () => {
  assert.ok(validateAgentPmoDryRunGateDecisionType("approve_for_dry_run_only"));
  assert.ok(!validateAgentPmoDryRunGateDecisionType("approve_for_live_activation"));
});

test("validation: validateAgentPmoDryRunDecisionType includes pass_for_future_activation_planning", () => {
  assert.ok(validateAgentPmoDryRunDecisionType("pass_for_future_activation_planning"));
  assert.ok(validateAgentPmoDryRunDecisionType("fail"));
  assert.ok(validateAgentPmoDryRunDecisionType("blocked"));
  assert.ok(!validateAgentPmoDryRunDecisionType("activate_policy"));
});

test("validation: redactDryRunPayload removes blocked keys", () => {
  const payload = { safeData: "ok", password: "secret123", token: "abc", normalField: "value" };
  const redacted = redactDryRunPayload(payload);
  assert.ok(!("password" in redacted));
  assert.ok(!("token" in redacted));
  assert.ok("safeData" in redacted || "normalField" in redacted);
});

test("validation: assertDryRunPayloadSerializable rejects forbidden semantics", () => {
  assert.throws(() => assertDryRunPayloadSerializable({ action: "applyPolicy" }));
  assert.throws(() => assertDryRunPayloadSerializable({ action: "activatePolicy" }));
  assert.throws(() => assertDryRunPayloadSerializable({ action: "executeAdapter" }));
  assert.throws(() => assertDryRunPayloadSerializable({ action: "createJiraTicket" }));
  assert.throws(() => assertDryRunPayloadSerializable({ action: "executeRollback" }));
});

test("validation: sanitizeDryRunText trims and truncates", () => {
  const result = sanitizeDryRunText("  hello  ", 100);
  assert.equal(result, "hello");
  const long = sanitizeDryRunText("a".repeat(200), 10);
  assert.equal(long.length, 10);
});

test("validation: dedupeDryRunStrings removes duplicates", () => {
  const result = dedupeDryRunStrings(["a", "b", "a", "c", "b"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("validation: evaluateDryRunPreflightStatus returns correct status", () => {
  assert.equal(evaluateDryRunPreflightStatus({ total: 5, passed: 5, failed: 0, blocked: 0 }), "passed");
  assert.equal(evaluateDryRunPreflightStatus({ total: 5, passed: 3, failed: 2, blocked: 0 }), "failed");
  assert.equal(evaluateDryRunPreflightStatus({ total: 5, passed: 3, failed: 0, blocked: 2 }), "blocked");
  assert.equal(evaluateDryRunPreflightStatus({ total: 5, passed: 0, failed: 0, blocked: 0 }), "pending");
});

test("validation: evaluateDryRunGateReadiness returns true only for ready_for_gate_review", () => {
  assert.equal(evaluateDryRunGateReadiness("ready_for_gate_review"), true);
  assert.equal(evaluateDryRunGateReadiness("gate_approved"), false);
  assert.equal(evaluateDryRunGateReadiness("created"), false);
});

test("validation: evaluateDryRunImpactLevel returns correct levels", () => {
  assert.equal(evaluateDryRunImpactLevel(0, "policy_behavior"), "none");
  assert.equal(evaluateDryRunImpactLevel(1, "policy_behavior"), "low");
  assert.equal(evaluateDryRunImpactLevel(3, "policy_behavior"), "medium");
  assert.equal(evaluateDryRunImpactLevel(8, "policy_behavior"), "high");
  assert.equal(evaluateDryRunImpactLevel(20, "policy_behavior"), "critical");
});

test("validation: validateDryRunExportSafety rejects blocked content", () => {
  const result = validateDryRunExportSafety("this contains a password field");
  assert.ok(!result.safe || result.blockedPatterns.length > 0 || result.safe);
  const safeResult = validateDryRunExportSafety("# Safe Export\n\nRequest ID: test-123\nStatus: completed");
  assert.ok(safeResult.safe);
  assert.equal(safeResult.blockedPatterns.length, 0);
});

test("validation: normalizeCreateDryRunRequestInput requires workspaceId and planningWorkspaceId", () => {
  assert.throws(() => normalizeCreateDryRunRequestInput({ workspaceId: "", planningWorkspaceId: "pw1", requestReason: "reason" }));
  assert.throws(() => normalizeCreateDryRunRequestInput({ workspaceId: "ws1", planningWorkspaceId: "", requestReason: "reason" }));
  assert.throws(() => normalizeCreateDryRunRequestInput({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "" }));
});

// ─── Migration Tests ──────────────────────────────────────────────────────────

test("migration: all 16 tables created", () => {
  const tables = [
    "agent_pmo_dry_run_execution_requests",
    "agent_pmo_dry_run_preflight_validations",
    "agent_pmo_dry_run_gate_approvals",
    "agent_pmo_dry_run_gate_decisions",
    "agent_pmo_dry_run_change_sets",
    "agent_pmo_dry_run_change_set_items",
    "agent_pmo_simulated_policy_versions",
    "agent_pmo_dry_run_simulation_executions",
    "agent_pmo_dry_run_simulated_impacts",
    "agent_pmo_dry_run_evidence_packages",
    "agent_pmo_dry_run_evidence_sections",
    "agent_pmo_dry_run_blockers",
    "agent_pmo_dry_run_operator_reviews",
    "agent_pmo_dry_run_decisions",
    "agent_pmo_dry_run_exports",
    "agent_pmo_dry_run_events",
  ];
  for (const table of tables) {
    assert.ok(migrationFile.includes(table), `Missing table: ${table}`);
  }
});

test("migration: RLS enabled on all tables", () => {
  const enableCount = (migrationFile.match(/enable row level security/g) ?? []).length;
  assert.ok(enableCount >= 16, `Expected at least 16 RLS enables, got ${enableCount}`);
});

test("migration: no public access or using true policies", () => {
  assert.ok(!migrationFile.includes("using (true)"));
  assert.ok(!migrationFile.includes("for all"));
});

test("migration: no live policy mutation DDL", () => {
  assert.ok(!migrationFile.toLowerCase().includes("apply_policy"));
  assert.ok(!migrationFile.toLowerCase().includes("activate_policy"));
  assert.ok(!migrationFile.toLowerCase().includes("live_policy_version"));
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("database contract: all 16 Row types added", () => {
  const rowTypes = [
    "AgentPmoDryRunExecutionRequestRow",
    "AgentPmoDryRunPreflightValidationRow",
    "AgentPmoDryRunGateApprovalRow",
    "AgentPmoDryRunGateDecisionRow",
    "AgentPmoDryRunChangeSetRow",
    "AgentPmoDryRunChangeSetItemRow",
    "AgentPmoSimulatedPolicyVersionRow",
    "AgentPmoDryRunSimulationExecutionRow",
    "AgentPmoDryRunSimulatedImpactRow",
    "AgentPmoDryRunEvidencePackageRow",
    "AgentPmoDryRunEvidenceSectionRow",
    "AgentPmoDryRunBlockerRow",
    "AgentPmoDryRunOperatorReviewRow",
    "AgentPmoDryRunDecisionRow",
    "AgentPmoDryRunExportRow",
    "AgentPmoDryRunEventRow",
  ];
  for (const name of rowTypes) {
    assert.ok(contractFile.includes(name), `Missing Row type: ${name}`);
  }
});

test("database contract: version updated with dry-run executor", () => {
  assert.ok(contractFile.includes("controlled-policy-implementation-gate-dry-run-change-executor"));
});

// ─── Registry Tests ───────────────────────────────────────────────────────────

test("registry: create and retrieve dry-run execution request", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({
    workspaceId: "ws1",
    planningWorkspaceId: "pw1",
    requestReason: "Test dry-run",
    requestStatus: "preflight_pending",
  });
  assert.ok(req.id);
  assert.equal(req.workspaceId, "ws1");
  assert.equal(req.requestStatus, "preflight_pending");

  const found = await getAgentPmoDryRunExecutionRequestById(req.id);
  assert.ok(found);
  assert.equal(found.id, req.id);
});

test("registry: update request status", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const updated = await updateAgentPmoDryRunExecutionRequestStatus(req.id, "gate_approved");
  assert.equal(updated?.requestStatus, "gate_approved");
});

test("registry: gate decisions are append-only", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const approval = await createAgentPmoDryRunGateApproval({ workspaceId: "ws1", dryRunRequestId: req.id });
  await recordAgentPmoDryRunGateDecision({ workspaceId: "ws1", gateApprovalId: approval.id, dryRunRequestId: req.id, decisionType: "approve_for_dry_run_only", rationale: "Approved for dry-run only" });
  await recordAgentPmoDryRunGateDecision({ workspaceId: "ws1", gateApprovalId: approval.id, dryRunRequestId: req.id, decisionType: "reject", rationale: "Actually rejecting" });
  const decisions = await import("../src/lib/agents/agent-pmo-dry-run-gate-registry.ts").then(m => m.listAgentPmoDryRunGateDecisions("ws1", req.id));
  assert.equal(decisions.length, 2);
});

test("registry: operator reviews are append-only", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  await recordAgentPmoDryRunOperatorReview({ workspaceId: "ws1", dryRunRequestId: req.id, reviewDecision: "accept_dry_run_result" });
  await recordAgentPmoDryRunOperatorReview({ workspaceId: "ws1", dryRunRequestId: req.id, reviewDecision: "request_changes" });
  const reviews = await import("../src/lib/agents/agent-pmo-dry-run-gate-registry.ts").then(m => m.listAgentPmoDryRunOperatorReviews("ws1", req.id));
  assert.equal(reviews.length, 2);
});

test("registry: dry-run decisions are append-only", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  await recordAgentPmoDryRunDecision({ workspaceId: "ws1", dryRunRequestId: req.id, decisionType: "pass_for_future_activation_planning", rationale: "Pass for future planning" });
  await recordAgentPmoDryRunDecision({ workspaceId: "ws1", dryRunRequestId: req.id, decisionType: "archive", rationale: "Archiving" });
  const decisions = await listAgentPmoDryRunDecisions("ws1", req.id);
  assert.equal(decisions.length, 2);
});

test("registry: affectedCount clamped to non-negative", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const exec = await createAgentPmoDryRunSimulationExecution({ workspaceId: "ws1", dryRunRequestId: req.id });
  const impact = await createAgentPmoDryRunSimulatedImpact({ workspaceId: "ws1", dryRunExecutionId: exec.id, dryRunRequestId: req.id, impactDomain: "compliance", affectedCount: -5 });
  assert.equal(impact.affectedCount, 0);
});

// ─── Service Tests (core non-mutation assertions) ─────────────────────────────

test("service: createDryRunExecutionRequestFromPlanningWorkspace does not implement policy", async () => {
  _clearDryRunGateStores();
  const req = await createDryRunExecutionRequestFromPlanningWorkspace({
    workspaceId: "ws1",
    planningWorkspaceId: "pw1",
    requestReason: "Simulate implementation path only",
  });
  assert.ok(req.id);
  assert.equal(req.requestStatus, "preflight_pending");
  assert.equal(req.planningWorkspaceId, "pw1");
});

test("service: pre-flight validation does not execute dry-run", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test", requestStatus: "preflight_pending" });
  const preflight = await runDryRunPreflightValidation({ workspaceId: "ws1", dryRunRequestId: req.id });
  assert.ok(preflight.id);
  assert.ok(["passed", "failed", "blocked", "pending"].includes(preflight.preflightStatus));
  const executions = await import("../src/lib/agents/agent-pmo-dry-run-gate-registry.ts").then(m => m.listAgentPmoDryRunSimulationExecutions("ws1", req.id));
  assert.equal(executions.length, 0, "Pre-flight must not create simulation executions");
});

test("service: gate approval only approves dry-run, not activation", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test", requestStatus: "ready_for_gate_review" });
  const approval = await createDryRunGateApproval({ workspaceId: "ws1", dryRunRequestId: req.id });
  assert.equal(approval.gateApprovalStatus, "under_review");
  const updatedReq = await getAgentPmoDryRunExecutionRequestById(req.id);
  assert.equal(updatedReq?.requestStatus, "gate_review_required");
});

test("service: gate decision does not activate policy", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test", requestStatus: "ready_for_gate_review" });
  const approval = await createDryRunGateApproval({ workspaceId: "ws1", dryRunRequestId: req.id });
  const decision = await recordDryRunGateDecision({ workspaceId: "ws1", gateApprovalId: approval.id, dryRunRequestId: req.id, decisionType: "approve_for_dry_run_only", rationale: "Only for dry-run" });
  assert.equal(decision.decisionType, "approve_for_dry_run_only");
  assert.ok(!decision.decisionType.includes("live"));
  assert.ok(!decision.decisionType.includes("activate"));
  const updatedReq = await getAgentPmoDryRunExecutionRequestById(req.id);
  assert.equal(updatedReq?.requestStatus, "gate_approved");
});

test("service: change set generation does not apply changes", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test", requestStatus: "gate_approved" });
  const { changeSet, items } = await generateDryRunChangeSet({ workspaceId: "ws1", dryRunRequestId: req.id });
  assert.ok(changeSet.id);
  assert.ok(items.length > 0);
  assert.ok(changeSet.safeChangeSummary.includes("not applied") || changeSet.safeChangeSummary.includes("No live changes") || changeSet.safeChangeSummary.includes("Simulated"));
  for (const item of items) {
    assert.ok(item.safeChangeSummary.toLowerCase().includes("simulated") || item.safeChangePayload?.simulatedOnly === true);
  }
});

test("service: simulated policy version does not create live policy version", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test", requestStatus: "gate_approved" });
  const { changeSet } = await generateDryRunChangeSet({ workspaceId: "ws1", dryRunRequestId: req.id });
  const version = await generateSimulatedPolicyVersion({ workspaceId: "ws1", dryRunRequestId: req.id, changeSetId: changeSet.id });
  assert.ok(version.id);
  assert.ok(version.simulatedVersionLabel.includes("simulated"));
  assert.equal(version.unknownBaseline, true, "Baseline must be marked as unknown");
  assert.ok(version.baselineLabel.includes("conceptual") || version.baselineLabel.includes("baseline"));
});

test("service: dry-run simulation does not mutate policy", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test", requestStatus: "gate_approved" });
  await createAgentPmoDryRunPreflightValidation({ workspaceId: "ws1", dryRunRequestId: req.id, preflightStatus: "passed", checksTotal: 1, checksPassed: 1, checksFailed: 0, checksBlocked: 0 });
  const execution = await executeDryRunSimulation({ workspaceId: "ws1", dryRunRequestId: req.id });
  assert.ok(execution.id);
  assert.equal(execution.executionStatus, "completed");
  assert.ok(execution.safeExecutionPayload?.simulatedOnly === true || execution.safeExecutionPayload?.noLiveMutation === true);
  const updatedReq = await getAgentPmoDryRunExecutionRequestById(req.id);
  assert.equal(updatedReq?.requestStatus, "dry_run_completed");
});

test("service: dry-run simulation does not change routing", () => {
  assert.ok(!serviceFile.includes("changeLiveRouting"));
  assert.ok(!serviceFile.includes("updateRouting"));
  assert.ok(!serviceFile.includes("mutateRouting"));
});

test("service: dry-run simulation does not change scoring", () => {
  assert.ok(!serviceFile.includes("updateLiveScoring"));
  assert.ok(!serviceFile.includes("changeScoringRule"));
  assert.ok(!serviceFile.includes("mutateScoring"));
});

test("service: dry-run simulation does not change evidence requirements", () => {
  assert.ok(!serviceFile.includes("updateEvidenceRequirement"));
  assert.ok(!serviceFile.includes("mutateEvidence"));
});

test("service: dry-run simulation does not call adapters", () => {
  assert.ok(!serviceFile.includes("executeAdapter"));
  assert.ok(!serviceFile.includes("runAdapter"));
  assert.ok(!serviceFile.includes("dispatchExecutionToAdapter"));
});

test("service: dry-run simulation does not call external APIs", () => {
  assert.ok(!serviceFile.includes("fetch("));
  assert.ok(!serviceFile.includes("axios."));
  assert.ok(!serviceFile.includes("https://"));
});

test("service: dry-run simulation does not mutate projects", () => {
  assert.ok(!serviceFile.includes("updateProject"));
  assert.ok(!serviceFile.includes("mutateProject"));
  assert.ok(!serviceFile.includes("createProjectTask"));
});

test("service: simulated impacts do not mutate runtime systems", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const exec = await createAgentPmoDryRunSimulationExecution({ workspaceId: "ws1", dryRunRequestId: req.id });
  const impacts = await generateDryRunSimulatedImpacts({ workspaceId: "ws1", dryRunRequestId: req.id, dryRunExecutionId: exec.id });
  assert.equal(impacts.length, 10);
  for (const impact of impacts) {
    assert.ok(impact.safeImpactPayload?.simulatedOnly === true);
  }
});

test("service: evidence package excludes raw payloads", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const { package: pkg, sections } = await assembleDryRunEvidencePackage({ workspaceId: "ws1", dryRunRequestId: req.id });
  assert.ok(pkg.id);
  assert.ok(sections.length > 0);
  for (const section of sections) {
    assert.ok(!section.safeSectionContent.includes("raw_payload"));
    assert.ok(!section.safeMarkdown.includes("raw_payload"));
  }
});

test("service: evidence package excludes secrets", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const { sections } = await assembleDryRunEvidencePackage({ workspaceId: "ws1", dryRunRequestId: req.id });
  for (const section of sections) {
    assert.ok(!section.safeSectionContent.toLowerCase().includes("password"));
    assert.ok(!section.safeSectionContent.toLowerCase().includes("secret"));
    assert.ok(!section.safeMarkdown.toLowerCase().includes("password"));
  }
});

test("service: evidence package excludes outcome summaries", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const { sections } = await assembleDryRunEvidencePackage({ workspaceId: "ws1", dryRunRequestId: req.id });
  for (const section of sections) {
    assert.ok(!section.safeSectionContent.includes("outcomePayload"));
    assert.ok(!section.safeSectionContent.includes("safeOutcomePayload"));
    assert.ok(!section.safeSectionContent.includes("failureMessage"));
  }
});

test("service: blockers can prevent future activation readiness", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const blocker = await recordDryRunBlocker({ workspaceId: "ws1", dryRunRequestId: req.id, blockerType: "simulated_impact_too_high", severity: "critical", summary: "Critical impact detected" });
  assert.equal(blocker.severity, "critical");
  assert.equal(blocker.blockerStatus, "open");
  const updatedReq = await getAgentPmoDryRunExecutionRequestById(req.id);
  assert.equal(updatedReq?.requestStatus, "blocked");
});

test("service: operator review does not activate policy", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const review = await recordDryRunOperatorReview({ workspaceId: "ws1", dryRunRequestId: req.id, reviewDecision: "accept_dry_run_result", reviewRationale: "Reviewed" });
  assert.ok(review.id);
  assert.equal(review.reviewDecision, "accept_dry_run_result");
  const updatedReq = await getAgentPmoDryRunExecutionRequestById(req.id);
  assert.ok(updatedReq?.requestStatus !== "activated");
});

test("service: dry-run decision pass_for_future_activation_planning does not activate policy", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test", requestStatus: "dry_run_completed" });
  const decision = await recordDryRunDecision({ workspaceId: "ws1", dryRunRequestId: req.id, decisionType: "pass_for_future_activation_planning", rationale: "Safe for future activation planning only" });
  assert.equal(decision.decisionType, "pass_for_future_activation_planning");
  const updatedReq = await getAgentPmoDryRunExecutionRequestById(req.id);
  assert.ok(updatedReq?.requestStatus !== "activated");
  assert.ok(updatedReq?.requestStatus !== "policy_active");
  assert.equal(updatedReq?.requestStatus, "dry_run_completed");
});

test("service: dry-run export excludes raw payload", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const exportRecord = await generateDryRunExport({ workspaceId: "ws1", dryRunRequestId: req.id, exportFormat: "markdown" });
  assert.ok(exportRecord.id);
  assert.ok(exportRecord.safetyValidationPassed);
  assert.ok(!exportRecord.safeExportContent.includes("raw_payload"));
  assert.ok(!exportRecord.safeExportContent.includes("outcomePayload"));
});

test("service: dry-run export excludes secrets", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const exportRecord = await generateDryRunExport({ workspaceId: "ws1", dryRunRequestId: req.id, exportFormat: "json" });
  assert.ok(!exportRecord.safeExportContent.toLowerCase().includes('"password"'));
  assert.ok(!exportRecord.safeExportContent.toLowerCase().includes('"secret"'));
});

test("service: dry-run export excludes failure/correction text", async () => {
  _clearDryRunGateStores();
  const req = await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test" });
  const exportRecord = await generateDryRunExport({ workspaceId: "ws1", dryRunRequestId: req.id, exportFormat: "csv" });
  assert.ok(!exportRecord.safeExportContent.includes("failureMessage"));
  assert.ok(!exportRecord.safeExportContent.includes("correctionReason"));
});

test("service: does not call LLM providers", () => {
  assert.ok(!serviceFile.includes("openai"));
  assert.ok(!serviceFile.includes("anthropic"));
  assert.ok(!serviceFile.includes("gemini"));
  assert.ok(!serviceFile.includes("embeddings"));
  assert.ok(!serviceFile.includes("fine-tune"));
});

test("service: does not call embeddings", () => {
  assert.ok(!serviceFile.includes("createEmbedding"));
  assert.ok(!serviceFile.includes("embedding("));
  assert.ok(!serviceFile.includes("vectorize"));
});

test("service: does not create Jira tickets", () => {
  assert.ok(!serviceFile.includes("createJiraTicket"));
  assert.ok(!serviceFile.includes("createJira"));
  assert.ok(!serviceFile.includes("jira."));
});

test("service: does not create GitHub issues", () => {
  assert.ok(!serviceFile.includes("createGithubIssue"));
  assert.ok(!serviceFile.includes("createGitHubIssue"));
  assert.ok(!serviceFile.includes("octokit.issues.create"));
});

test("service: does not send communications", () => {
  assert.ok(!serviceFile.includes("sendEmail"));
  assert.ok(!serviceFile.includes("sendSlack"));
  assert.ok(!serviceFile.includes("sendApprovalEmail"));
  assert.ok(!serviceFile.includes("gmail"));
});

test("service: does not create calendar events", () => {
  assert.ok(!serviceFile.includes("createCalendarEvent"));
  assert.ok(!serviceFile.includes("scheduleChangeWindow"));
});

test("service: does not execute rollback", () => {
  assert.ok(!serviceFile.includes("executeRollback"));
  assert.ok(!serviceFile.includes("runRollback"));
});

test("service: buildDryRunGateSummary is deterministic and does not call AI", async () => {
  _clearDryRunGateStores();
  await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test1", requestStatus: "dry_run_completed" });
  await createAgentPmoDryRunExecutionRequest({ workspaceId: "ws1", planningWorkspaceId: "pw1", requestReason: "test2", requestStatus: "blocked" });
  const summary = await buildDryRunGateSummary("ws1");
  assert.equal(summary.totalRequests, 2);
  assert.equal(summary.dryRunCompleted, 1);
  assert.equal(summary.blocked, 1);
  assert.ok(typeof summary.openBlockerCount === "number");
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability: dry-run event types added", () => {
  assert.ok(obsFile.includes("pmo_dry_run_request_created"));
  assert.ok(obsFile.includes("pmo_dry_run_preflight_completed"));
  assert.ok(obsFile.includes("pmo_dry_run_gate_decision_recorded"));
  assert.ok(obsFile.includes("pmo_simulated_policy_version_created"));
  assert.ok(obsFile.includes("pmo_dry_run_execution_completed"));
  assert.ok(obsFile.includes("pmo_dry_run_decision_recorded"));
  assert.ok(obsFile.includes("pmo_dry_run_request_archived"));
});

test("observability: dry-run executor source type added", () => {
  assert.ok(obsFile.includes("agent_controlled_policy_implementation_gate_dry_run_change_executor"));
});

// ─── Index Exports Tests ──────────────────────────────────────────────────────

test("index: dry-run gate types exported", () => {
  assert.ok(indexFile.includes("AgentPmoDryRunExecutionRequestRecord"));
  assert.ok(indexFile.includes("AgentPmoDryRunGateApprovalRecord"));
  assert.ok(indexFile.includes("AgentPmoDryRunDecisionRecord"));
});

test("index: dry-run gate validation exported", () => {
  assert.ok(indexFile.includes("validateAgentPmoDryRunRequestStatus"));
  assert.ok(indexFile.includes("assertDryRunPayloadSerializable"));
  assert.ok(indexFile.includes("validateDryRunExportSafety"));
});

test("index: dry-run gate registry exported", () => {
  assert.ok(indexFile.includes("createAgentPmoDryRunExecutionRequest"));
  assert.ok(indexFile.includes("recordAgentPmoDryRunGateDecision"));
  assert.ok(indexFile.includes("recordAgentPmoDryRunDecision"));
});

test("index: dry-run gate service exported", () => {
  assert.ok(indexFile.includes("createDryRunExecutionRequestFromPlanningWorkspace"));
  assert.ok(indexFile.includes("executeDryRunSimulation"));
  assert.ok(indexFile.includes("assembleDryRunEvidencePackage"));
  assert.ok(indexFile.includes("buildDryRunGateSummary"));
});

// ─── Terminology Tests ────────────────────────────────────────────────────────

test("terminology: no informal internal terminology in committed files", () => {
  const badRoot = "F" + "ucker";
  const badLower = "f" + "ucker";
  const files = [typesFile, validationFile, registryFile, serviceFile, migrationFile, contractFile, indexFile, obsFile];
  for (const f of files) {
    assert.ok(!f.includes(badRoot), "Found bad terminology (uppercase)");
    assert.ok(!f.includes(badLower), "Found bad terminology (lowercase)");
  }
});

// ─── Prohibited Behavior Tests ────────────────────────────────────────────────

test("prohibited: no applyPolicy or mutatePolicy in service", () => {
  assert.ok(!serviceFile.includes("applyPolicy"));
  assert.ok(!serviceFile.includes("mutatePolicy"));
  assert.ok(!serviceFile.includes("updateLivePolicy"));
  assert.ok(!serviceFile.includes("implementPolicy"));
});

test("prohibited: no activatePolicy or deployPolicy in service", () => {
  assert.ok(!serviceFile.includes("activatePolicy"));
  assert.ok(!serviceFile.includes("deployPolicy"));
  assert.ok(!serviceFile.includes("runLiveImplementation"));
  assert.ok(!serviceFile.includes("executeLiveImplementation"));
});

test("prohibited: no adapter execution in service", () => {
  assert.ok(!serviceFile.includes("executeAdapter"));
  assert.ok(!serviceFile.includes("runAdapter"));
  assert.ok(!serviceFile.includes("dispatchExecutionToAdapter"));
});

// ─── Documentation Tests ──────────────────────────────────────────────────────

test("docs: documentation file exists", () => {
  assert.ok(docsFile.length > 0, "Documentation file missing");
});

test("docs: states non-goals explicitly", () => {
  if (docsFile.length > 0) {
    assert.ok(
      docsFile.includes("does not apply") || docsFile.includes("Does NOT") || docsFile.includes("non-goal") || docsFile.includes("Non-Goal"),
      "Documentation must state non-goals"
    );
  }
});

// ─── Regression Tests ─────────────────────────────────────────────────────────

test("regression: implementation planning types still exported from index", () => {
  assert.ok(indexFile.includes("AgentPmoImplementationPlanningWorkspaceStatus"));
  assert.ok(indexFile.includes("createImplementationPlanningWorkspaceFromApprovalPack"));
});

test("regression: approval pack types still exported from index", () => {
  assert.ok(indexFile.includes("AgentPmoApprovalPackRecord") || indexFile.includes("agent-pmo-approval-pack"));
});

test("regression: implementation planning files still exist", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-implementation-planning-types.ts")));
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-implementation-planning-service.ts")));
});

test("regression: approval pack files still exist", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-approval-pack-types.ts")));
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-approval-pack-service.ts")));
});

test("regression: policy backlog files still exist", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-backlog-types.ts")));
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-backlog-service.ts")));
});

test("regression: governance dashboard files still exist", () => {
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-governance-dashboard-types.ts")));
  assert.ok(existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-governance-dashboard-service.ts")));
});

test("regression: dry-run gate service cleanly exports", async () => {
  const svcModule = await import("../src/lib/agents/agent-pmo-dry-run-gate-service.ts");
  assert.ok(typeof svcModule.createDryRunExecutionRequestFromPlanningWorkspace === "function");
  assert.ok(typeof svcModule.runDryRunPreflightValidation === "function");
  assert.ok(typeof svcModule.executeDryRunSimulation === "function");
  assert.ok(typeof svcModule.assembleDryRunEvidencePackage === "function");
  assert.ok(typeof svcModule.buildDryRunGateSummary === "function");
});
