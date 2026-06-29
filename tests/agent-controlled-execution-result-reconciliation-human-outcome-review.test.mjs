// ─── Controlled Execution Result Reconciliation & Human Outcome Review — Tests ──
// No LLM calls. No external API calls. No real side effects.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-outcome-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-outcome-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-outcome-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-outcome-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260805000000_agent_controlled_execution_result_reconciliation_human_outcome_review.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = existsSync(resolve(ROOT, "docs/agent-controlled-execution-result-reconciliation-human-outcome-review.md"))
  ? readFileSync(resolve(ROOT, "docs/agent-controlled-execution-result-reconciliation-human-outcome-review.md"), "utf8")
  : "";

const {
  validateAgentExecutionOutcomeStatus,
  validateAgentExecutionOutcomeType,
  validateAgentExecutionOutcomeMatchStatus,
  validateAgentExecutionEvidenceCompletenessLevel,
  validateAgentExecutionOutcomeConfidenceLevel,
  validateAgentExecutionOutcomeReviewRequirement,
  validateAgentExecutionOutcomeReviewStatus,
  validateAgentExecutionOutcomeDecisionType,
  validateAgentExecutionFailureCategory,
  validateAgentExecutionCorrectionType,
  validateAgentExecutionCorrectionStatus,
  validateAgentExecutionOutcomeEventType,
  assertExecutionOutcomePayloadSerializable,
  redactExecutionOutcomePayload,
  normalizeCreateAgentExecutionOutcomeInput,
  normalizeReconcileDispatchOutcomeInput,
  normalizeCreateHumanOutcomeReviewInput,
  normalizeRecordHumanOutcomeDecisionInput,
  dedupeOutcomeStrings,
  calculateEvidenceCompleteness,
  compareIntendedVsActualOutcome,
  calculateOutcomeConfidence,
  determineOutcomeReviewRequirement,
} = await import("../src/lib/agents/agent-execution-outcome-validation.ts");

const {
  createAgentExecutionOutcome,
  getAgentExecutionOutcomeById,
  getAgentExecutionOutcomeByExecutionRequestId,
  listAgentExecutionOutcomes,
  updateAgentExecutionOutcomeStatus,
  createAgentExecutionOutcomeReconciliation,
  getAgentExecutionOutcomeReconciliationByOutcomeId,
  createAgentExecutionOutcomeComparison,
  getAgentExecutionOutcomeComparisonByOutcomeId,
  createAgentExecutionEvidenceCompleteness,
  getAgentExecutionEvidenceCompletenessByOutcomeId,
  createAgentExecutionOutcomeConfidence,
  getAgentExecutionOutcomeConfidenceByOutcomeId,
  createAgentExecutionHumanOutcomeReview,
  getAgentExecutionHumanOutcomeReviewByOutcomeId,
  getAgentExecutionHumanOutcomeReviewById,
  updateAgentExecutionHumanOutcomeReviewStatus,
  createAgentExecutionFailedDispatchTriage,
  getAgentExecutionFailedDispatchTriageByOutcomeId,
  createAgentExecutionCorrectionLoop,
  updateAgentExecutionCorrectionLoopStatus,
  getAgentExecutionCorrectionLoopByOutcomeId,
  recordAgentExecutionOutcomeEvent,
  listAgentExecutionOutcomeEvents,
  _clearOutcomeStores,
} = await import("../src/lib/agents/agent-execution-outcome-registry.ts");

const {
  createOutcomeFromDispatchAttempt,
  reconcileDispatchOutcome,
  scoreOutcomeEvidenceCompleteness,
  compareOutcomeIntendedVsActual,
  scoreOutcomeConfidence,
  determineHumanOutcomeReview,
  createHumanOutcomeReview,
  recordHumanOutcomeDecision,
  createFailedDispatchTriage,
  createOutcomeCorrectionLoop,
  archiveOutcome,
  buildExecutionOutcomeSummary,
} = await import("../src/lib/agents/agent-execution-outcome-service.ts");

// ─── Type / Union Tests ───────────────────────────────────────────────────────

test("outcome statuses — all values present in types file", () => {
  const statuses = [
    "created","reconciling","reconciled","evidence_review","comparison_pending",
    "comparison_complete","confidence_scored","review_required","review_in_progress",
    "review_complete","correction_required","correction_in_progress","correction_complete",
    "archived","failed",
  ];
  for (const s of statuses) {
    assert.ok(typesFile.includes(`"${s}"`), `Missing outcome status: ${s}`);
  }
});

test("outcome types — all values present in types file", () => {
  for (const v of ["dispatch_success","dispatch_failure","adapter_success","adapter_failure","partial_success","noop","blocked","cancelled","reconciliation_failure"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing outcome type: ${v}`);
  }
});

test("outcome match statuses — all present in types file", () => {
  for (const v of ["matched","partial_match","mismatch","undetermined","no_intended_outcome"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing match status: ${v}`);
  }
});

test("evidence completeness levels — all present in types file", () => {
  for (const v of ["none","minimal","partial","sufficient","complete"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing completeness level: ${v}`);
  }
});

test("confidence levels — all present in types file", () => {
  for (const v of ["low","medium","high"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing confidence level: ${v}`);
  }
});

test("review requirements — all present in types file", () => {
  for (const v of ["not_required","required_low_confidence","required_mismatch","required_failure","required_correction","required_policy"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing review requirement: ${v}`);
  }
});

test("review statuses — all present in types file", () => {
  for (const v of ["not_required","pending","in_progress","approved","rejected","deferred","cancelled"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing review status: ${v}`);
  }
});

test("decision types — all present in types file", () => {
  for (const v of ["approve","reject","request_correction","archive","escalate","defer"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing decision type: ${v}`);
  }
});

test("failure categories — all present in types file", () => {
  for (const v of ["dispatch_blocked","adapter_refused","adapter_error","idempotency_conflict","lock_unavailable","confirmation_rejected","evidence_insufficient","reconciliation_error","unknown"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing failure category: ${v}`);
  }
});

test("correction types — all present in types file", () => {
  for (const v of ["retry_dispatch","re_evaluate_readiness","update_evidence","manual_override","escalate_to_human","cancel_execution"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing correction type: ${v}`);
  }
});

test("correction statuses — all present in types file", () => {
  for (const v of ["created","in_progress","applied","failed","cancelled"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing correction status: ${v}`);
  }
});

test("outcome event types — all present in types file", () => {
  for (const v of ["outcome_created","reconciliation_started","reconciliation_complete","evidence_completeness_scored","comparison_started","comparison_complete","confidence_scored","review_requirement_determined","human_review_created","human_review_decision_recorded","failed_dispatch_triaged","correction_loop_created","correction_loop_applied","outcome_archived"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing event type: ${v}`);
  }
});

// ─── Record Types ─────────────────────────────────────────────────────────────

test("AgentExecutionOutcomeRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionOutcomeRecord"));
});

test("AgentExecutionOutcomeReconciliationRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionOutcomeReconciliationRecord"));
});

test("AgentExecutionOutcomeComparisonRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionOutcomeComparisonRecord"));
});

test("AgentExecutionEvidenceCompletenessRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionEvidenceCompletenessRecord"));
});

test("AgentExecutionOutcomeConfidenceRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionOutcomeConfidenceRecord"));
});

test("AgentExecutionHumanOutcomeReviewRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionHumanOutcomeReviewRecord"));
});

test("AgentExecutionFailedDispatchTriageRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionFailedDispatchTriageRecord"));
});

test("AgentExecutionCorrectionLoopRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionCorrectionLoopRecord"));
});

test("AgentExecutionOutcomeEventRecord type defined", () => {
  assert.ok(typesFile.includes("AgentExecutionOutcomeEventRecord"));
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

test("validateAgentExecutionOutcomeStatus — valid values", () => {
  assert.ok(validateAgentExecutionOutcomeStatus("created"));
  assert.ok(validateAgentExecutionOutcomeStatus("archived"));
  assert.ok(validateAgentExecutionOutcomeStatus("failed"));
});

test("validateAgentExecutionOutcomeStatus — invalid values", () => {
  assert.ok(!validateAgentExecutionOutcomeStatus("invalid"));
  assert.ok(!validateAgentExecutionOutcomeStatus(null));
  assert.ok(!validateAgentExecutionOutcomeStatus(undefined));
});

test("validateAgentExecutionOutcomeType — all values", () => {
  assert.ok(validateAgentExecutionOutcomeType("dispatch_success"));
  assert.ok(validateAgentExecutionOutcomeType("noop"));
  assert.ok(!validateAgentExecutionOutcomeType("bad"));
});

test("validateAgentExecutionOutcomeMatchStatus — all values", () => {
  assert.ok(validateAgentExecutionOutcomeMatchStatus("matched"));
  assert.ok(validateAgentExecutionOutcomeMatchStatus("mismatch"));
  assert.ok(!validateAgentExecutionOutcomeMatchStatus("invalid"));
});

test("validateAgentExecutionEvidenceCompletenessLevel — all values", () => {
  assert.ok(validateAgentExecutionEvidenceCompletenessLevel("none"));
  assert.ok(validateAgentExecutionEvidenceCompletenessLevel("complete"));
  assert.ok(!validateAgentExecutionEvidenceCompletenessLevel("invalid"));
});

test("validateAgentExecutionOutcomeConfidenceLevel — all values", () => {
  assert.ok(validateAgentExecutionOutcomeConfidenceLevel("low"));
  assert.ok(validateAgentExecutionOutcomeConfidenceLevel("high"));
  assert.ok(!validateAgentExecutionOutcomeConfidenceLevel("unknown"));
});

test("validateAgentExecutionOutcomeReviewRequirement — all values", () => {
  assert.ok(validateAgentExecutionOutcomeReviewRequirement("not_required"));
  assert.ok(validateAgentExecutionOutcomeReviewRequirement("required_mismatch"));
  assert.ok(!validateAgentExecutionOutcomeReviewRequirement("invalid"));
});

test("validateAgentExecutionOutcomeDecisionType — all values", () => {
  assert.ok(validateAgentExecutionOutcomeDecisionType("approve"));
  assert.ok(validateAgentExecutionOutcomeDecisionType("defer"));
  assert.ok(!validateAgentExecutionOutcomeDecisionType("invalid"));
});

test("validateAgentExecutionFailureCategory — all values", () => {
  assert.ok(validateAgentExecutionFailureCategory("unknown"));
  assert.ok(validateAgentExecutionFailureCategory("adapter_error"));
  assert.ok(!validateAgentExecutionFailureCategory("bad_category"));
});

test("validateAgentExecutionCorrectionType — all values", () => {
  assert.ok(validateAgentExecutionCorrectionType("retry_dispatch"));
  assert.ok(validateAgentExecutionCorrectionType("cancel_execution"));
  assert.ok(!validateAgentExecutionCorrectionType("invalid"));
});

test("validateAgentExecutionCorrectionStatus — all values", () => {
  assert.ok(validateAgentExecutionCorrectionStatus("created"));
  assert.ok(validateAgentExecutionCorrectionStatus("applied"));
  assert.ok(!validateAgentExecutionCorrectionStatus("invalid"));
});

test("validateAgentExecutionOutcomeEventType — all values", () => {
  assert.ok(validateAgentExecutionOutcomeEventType("outcome_created"));
  assert.ok(validateAgentExecutionOutcomeEventType("outcome_archived"));
  assert.ok(!validateAgentExecutionOutcomeEventType("invalid"));
});

test("assertExecutionOutcomePayloadSerializable — valid payload", () => {
  assert.doesNotThrow(() => assertExecutionOutcomePayloadSerializable({ foo: "bar" }));
  assert.doesNotThrow(() => assertExecutionOutcomePayloadSerializable(null));
});

test("assertExecutionOutcomePayloadSerializable — invalid payload", () => {
  const circular = {};
  circular.self = circular;
  assert.throws(() => assertExecutionOutcomePayloadSerializable(circular));
});

test("redactExecutionOutcomePayload — redacts sensitive keys", () => {
  const result = redactExecutionOutcomePayload({
    name: "test",
    password: "secret123",
    token: "abc",
    apiKey: "key123",
    api_key: "k2",
    authorization: "Bearer x",
    stripe_secret: "sk_test",
    private_key: "pk",
    credential: "cred",
    client_secret: "cs",
    refresh_token: "rt",
    access_token: "at",
    session_cookie: "sc",
    cookie: "co",
  });
  assert.equal(result.name, "test");
  assert.equal(result.password, "[REDACTED]");
  assert.equal(result.token, "[REDACTED]");
  assert.equal(result.apiKey, "[REDACTED]");
  assert.equal(result.api_key, "[REDACTED]");
  assert.equal(result.authorization, "[REDACTED]");
  assert.equal(result.stripe_secret, "[REDACTED]");
  assert.equal(result.private_key, "[REDACTED]");
  assert.equal(result.credential, "[REDACTED]");
  assert.equal(result.client_secret, "[REDACTED]");
  assert.equal(result.refresh_token, "[REDACTED]");
  assert.equal(result.access_token, "[REDACTED]");
  assert.equal(result.session_cookie, "[REDACTED]");
  assert.equal(result.cookie, "[REDACTED]");
});

test("redactExecutionOutcomePayload — null passthrough", () => {
  assert.equal(redactExecutionOutcomePayload(null), null);
});

test("redactExecutionOutcomePayload — nested object", () => {
  const result = redactExecutionOutcomePayload({ nested: { password: "s3cr3t", value: 42 } });
  assert.equal(result.nested.password, "[REDACTED]");
  assert.equal(result.nested.value, 42);
});

test("dedupeOutcomeStrings — removes duplicates and empty strings", () => {
  const result = dedupeOutcomeStrings(["a", "b", "a", "", "c", "b"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("normalizeCreateAgentExecutionOutcomeInput — sets defaults", () => {
  const result = normalizeCreateAgentExecutionOutcomeInput({
    workspaceId: "ws1",
    executionRequestId: "er1",
  });
  assert.equal(result.workspaceId, "ws1");
  assert.equal(result.outcomeType, "noop");
  assert.equal(result.finalizationId, null);
});

test("normalizeCreateAgentExecutionOutcomeInput — throws on missing workspaceId", () => {
  assert.throws(() => normalizeCreateAgentExecutionOutcomeInput({ workspaceId: "", executionRequestId: "er1" }));
});

test("normalizeCreateAgentExecutionOutcomeInput — throws on missing executionRequestId", () => {
  assert.throws(() => normalizeCreateAgentExecutionOutcomeInput({ workspaceId: "ws1", executionRequestId: "" }));
});

test("normalizeReconcileDispatchOutcomeInput — sets defaults", () => {
  const result = normalizeReconcileDispatchOutcomeInput({ workspaceId: "ws1", outcomeId: "o1" });
  assert.equal(result.actorId, null);
});

test("normalizeCreateHumanOutcomeReviewInput — sets defaults", () => {
  const result = normalizeCreateHumanOutcomeReviewInput({ workspaceId: "ws1", outcomeId: "o1" });
  assert.equal(result.priority, "normal");
  assert.equal(result.title, "Human Outcome Review");
});

test("normalizeRecordHumanOutcomeDecisionInput — throws on invalid decisionType", () => {
  assert.throws(() => normalizeRecordHumanOutcomeDecisionInput({
    workspaceId: "ws1", outcomeId: "o1", humanReviewId: "hr1", decisionType: /** @type {any} */ ("invalid"),
  }));
});

// ─── Evidence Completeness Tests ──────────────────────────────────────────────

test("calculateEvidenceCompleteness — all present returns complete", () => {
  const result = calculateEvidenceCompleteness({
    dispatchSucceeded: true,
    adapterExecutionExists: true,
    resultExists: true,
    evidenceCount: 3,
    lineageComplete: true,
  });
  assert.equal(result.level, "complete");
  assert.equal(result.completenessScore, 100);
  assert.deepEqual(result.blockingGaps, []);
});

test("calculateEvidenceCompleteness — none returns none", () => {
  const result = calculateEvidenceCompleteness({
    dispatchSucceeded: false,
    adapterExecutionExists: false,
    resultExists: false,
    evidenceCount: 0,
    lineageComplete: false,
  });
  assert.equal(result.level, "none");
  assert.equal(result.completenessScore, 0);
  assert.ok(result.blockingGaps.length > 0);
});

test("calculateEvidenceCompleteness — partial fills", () => {
  const result = calculateEvidenceCompleteness({
    dispatchSucceeded: true,
    adapterExecutionExists: true,
    resultExists: false,
    evidenceCount: 0,
    lineageComplete: false,
  });
  assert.ok(result.completenessScore > 0);
  assert.ok(result.completenessScore < 100);
  assert.ok(result.missingTypes.includes("execution_result"));
});

// ─── Comparison Tests ─────────────────────────────────────────────────────────

test("compareIntendedVsActualOutcome — matched", () => {
  const result = compareIntendedVsActualOutcome({
    intendedOutcomeSummary: "task completed successfully",
    actualOutcomeSummary: "task completed successfully",
    outcomeType: "dispatch_success",
    dispatchSucceeded: true,
  });
  assert.equal(result.matchStatus, "matched");
  assert.equal(result.requiresCorrection, false);
});

test("compareIntendedVsActualOutcome — no intended outcome", () => {
  const result = compareIntendedVsActualOutcome({
    intendedOutcomeSummary: null,
    actualOutcomeSummary: "something happened",
    outcomeType: "dispatch_success",
    dispatchSucceeded: true,
  });
  assert.equal(result.matchStatus, "no_intended_outcome");
});

test("compareIntendedVsActualOutcome — mismatch on failure", () => {
  const result = compareIntendedVsActualOutcome({
    intendedOutcomeSummary: "send email to team",
    actualOutcomeSummary: "dispatch failed",
    outcomeType: "dispatch_failure",
    dispatchSucceeded: false,
  });
  assert.equal(result.matchStatus, "mismatch");
  assert.equal(result.requiresCorrection, true);
});

test("compareIntendedVsActualOutcome — undetermined when no actual", () => {
  const result = compareIntendedVsActualOutcome({
    intendedOutcomeSummary: "do something",
    actualOutcomeSummary: null,
    outcomeType: "adapter_failure",
    dispatchSucceeded: false,
  });
  assert.equal(result.matchStatus, "undetermined");
});

// ─── Confidence Scoring Tests ─────────────────────────────────────────────────

test("calculateOutcomeConfidence — high confidence with all positive signals", () => {
  const result = calculateOutcomeConfidence({
    dispatchSucceeded: true,
    adapterExecutionExists: true,
    resultExists: true,
    evidenceCompletenessLevel: "complete",
    lineageComplete: true,
    matchStatus: "matched",
    outcomeType: "dispatch_success",
  });
  assert.equal(result.confidenceLevel, "high");
  assert.ok(result.confidenceScore >= 80);
});

test("calculateOutcomeConfidence — low confidence with all negative signals", () => {
  const result = calculateOutcomeConfidence({
    dispatchSucceeded: false,
    adapterExecutionExists: false,
    resultExists: false,
    evidenceCompletenessLevel: "none",
    lineageComplete: false,
    matchStatus: "mismatch",
    outcomeType: "dispatch_failure",
  });
  assert.equal(result.confidenceLevel, "low");
  assert.ok(result.confidenceScore < 50);
});

test("calculateOutcomeConfidence — score clamped between 0-100", () => {
  const result = calculateOutcomeConfidence({
    dispatchSucceeded: false,
    adapterExecutionExists: false,
    resultExists: false,
    evidenceCompletenessLevel: "none",
    lineageComplete: false,
    matchStatus: "mismatch",
    outcomeType: "reconciliation_failure",
  });
  assert.ok(result.confidenceScore >= 0);
  assert.ok(result.confidenceScore <= 100);
});

// ─── Review Requirement Tests ─────────────────────────────────────────────────

test("determineOutcomeReviewRequirement — not required for high confidence match", () => {
  const result = determineOutcomeReviewRequirement({
    confidenceLevel: "high",
    matchStatus: "matched",
    outcomeType: "dispatch_success",
    requiresCorrection: false,
  });
  assert.equal(result.reviewRequirement, "not_required");
  assert.equal(result.reviewStatus, "not_required");
});

test("determineOutcomeReviewRequirement — required for correction", () => {
  const result = determineOutcomeReviewRequirement({
    confidenceLevel: "high",
    matchStatus: "matched",
    outcomeType: "dispatch_success",
    requiresCorrection: true,
  });
  assert.equal(result.reviewRequirement, "required_correction");
  assert.equal(result.reviewStatus, "pending");
  assert.equal(result.priority, "high");
});

test("determineOutcomeReviewRequirement — required for failure", () => {
  const result = determineOutcomeReviewRequirement({
    confidenceLevel: "medium",
    matchStatus: "undetermined",
    outcomeType: "dispatch_failure",
    requiresCorrection: false,
  });
  assert.equal(result.reviewRequirement, "required_failure");
});

test("determineOutcomeReviewRequirement — required for mismatch", () => {
  const result = determineOutcomeReviewRequirement({
    confidenceLevel: "high",
    matchStatus: "mismatch",
    outcomeType: "dispatch_success",
    requiresCorrection: false,
  });
  assert.equal(result.reviewRequirement, "required_mismatch");
});

test("determineOutcomeReviewRequirement — required for low confidence", () => {
  const result = determineOutcomeReviewRequirement({
    confidenceLevel: "low",
    matchStatus: "matched",
    outcomeType: "dispatch_success",
    requiresCorrection: false,
  });
  assert.equal(result.reviewRequirement, "required_low_confidence");
});

// ─── Registry Tests ───────────────────────────────────────────────────────────

test("createAgentExecutionOutcome — creates record with defaults", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({
    workspaceId: "ws1",
    executionRequestId: "er1",
  });
  assert.ok(outcome.id);
  assert.equal(outcome.workspaceId, "ws1");
  assert.equal(outcome.executionRequestId, "er1");
  assert.equal(outcome.status, "created");
  assert.equal(outcome.outcomeType, "noop");
  assert.equal(outcome.matchStatus, "undetermined");
  assert.equal(outcome.confidenceScore, 0);
  assert.equal(outcome.confidenceLevel, "low");
  assert.equal(outcome.reviewRequirement, "not_required");
  assert.equal(outcome.reviewStatus, "not_required");
});

test("getAgentExecutionOutcomeById — retrieves by id", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const found = await getAgentExecutionOutcomeById("ws1", outcome.id);
  assert.ok(found);
  assert.equal(found.id, outcome.id);
});

test("getAgentExecutionOutcomeById — returns null for wrong workspace", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const found = await getAgentExecutionOutcomeById("ws_other", outcome.id);
  assert.equal(found, null);
});

test("getAgentExecutionOutcomeByExecutionRequestId — finds by request id", async () => {
  _clearOutcomeStores();
  await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er_unique" });
  const found = await getAgentExecutionOutcomeByExecutionRequestId("ws1", "er_unique");
  assert.ok(found);
  assert.equal(found.executionRequestId, "er_unique");
});

test("listAgentExecutionOutcomes — filters by status", async () => {
  _clearOutcomeStores();
  await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const o2 = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er2" });
  await updateAgentExecutionOutcomeStatus({ workspaceId: "ws1", outcomeId: o2.id, status: "archived" });
  const archived = await listAgentExecutionOutcomes("ws1", { status: "archived" });
  assert.equal(archived.length, 1);
  assert.equal(archived[0].id, o2.id);
});

test("updateAgentExecutionOutcomeStatus — updates status", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const updated = await updateAgentExecutionOutcomeStatus({ workspaceId: "ws1", outcomeId: outcome.id, status: "reconciling" });
  assert.equal(updated.status, "reconciling");
});

test("createAgentExecutionOutcomeReconciliation — creates record", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const rec = await createAgentExecutionOutcomeReconciliation({
    workspaceId: "ws1",
    outcomeId: outcome.id,
    executionRequestId: "er1",
    finalizationId: null,
    dispatchAttemptId: null,
    dispatchSucceeded: true,
    adapterExecutionExists: true,
    resultExists: true,
    evidenceCount: 2,
    lineageComplete: true,
    reconciliationNotes: [],
  });
  assert.ok(rec.id);
  assert.equal(rec.dispatchSucceeded, true);
});

test("getAgentExecutionOutcomeReconciliationByOutcomeId — finds by outcome", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  await createAgentExecutionOutcomeReconciliation({
    workspaceId: "ws1", outcomeId: outcome.id, executionRequestId: "er1",
    finalizationId: null, dispatchAttemptId: null, dispatchSucceeded: false,
    adapterExecutionExists: false, resultExists: false, evidenceCount: 0,
    lineageComplete: false, reconciliationNotes: ["test"],
  });
  const found = await getAgentExecutionOutcomeReconciliationByOutcomeId("ws1", outcome.id);
  assert.ok(found);
  assert.ok(found.reconciliationNotes.includes("test"));
});

test("createAgentExecutionEvidenceCompleteness — creates record", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const rec = await createAgentExecutionEvidenceCompleteness({
    workspaceId: "ws1", outcomeId: outcome.id, executionRequestId: "er1",
    completenessScore: 75, level: "sufficient", presentTypes: ["dispatch_record"],
    missingTypes: ["lineage"], blockingGaps: [], warnings: [],
  });
  assert.ok(rec.id);
  assert.equal(rec.level, "sufficient");
});

test("createAgentExecutionOutcomeConfidence — creates record", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const rec = await createAgentExecutionOutcomeConfidence({
    workspaceId: "ws1", outcomeId: outcome.id, executionRequestId: "er1",
    confidenceScore: 85, confidenceLevel: "high", confidenceReasons: ["Dispatch succeeded"],
  });
  assert.ok(rec.id);
  assert.equal(rec.confidenceLevel, "high");
});

test("createAgentExecutionHumanOutcomeReview — creates record", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const rec = await createAgentExecutionHumanOutcomeReview({
    workspaceId: "ws1", outcomeId: outcome.id, executionRequestId: "er1",
    reviewRequirement: "required_mismatch", priority: "high",
    title: "Review required", summary: null, dueAt: null, createdBy: null,
  });
  assert.ok(rec.id);
  assert.equal(rec.reviewStatus, "pending");
  assert.equal(rec.decisionType, null);
});

test("updateAgentExecutionHumanOutcomeReviewStatus — records decision", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const review = await createAgentExecutionHumanOutcomeReview({
    workspaceId: "ws1", outcomeId: outcome.id, executionRequestId: "er1",
    reviewRequirement: "required_failure", priority: "normal",
    title: "Review", summary: null, dueAt: null, createdBy: null,
  });
  const updated = await updateAgentExecutionHumanOutcomeReviewStatus({
    workspaceId: "ws1", reviewId: review.id, reviewStatus: "approved",
    decisionType: "approve", decisionRationale: "Looks good", decidedBy: "user1",
  });
  assert.equal(updated.reviewStatus, "approved");
  assert.equal(updated.decisionType, "approve");
  assert.equal(updated.decidedBy, "user1");
  assert.ok(updated.decidedAt);
});

test("createAgentExecutionFailedDispatchTriage — creates record", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1", outcomeType: "dispatch_failure" });
  const rec = await createAgentExecutionFailedDispatchTriage({
    workspaceId: "ws1", outcomeId: outcome.id, executionRequestId: "er1",
    finalizationId: null, dispatchAttemptId: null, failureCategory: "dispatch_blocked",
    failureMessage: "blocked", blockingReasons: ["no gate"], triageNotes: ["retry"],
    recommendedCorrectionType: "retry_dispatch",
  });
  assert.ok(rec.id);
  assert.equal(rec.failureCategory, "dispatch_blocked");
});

test("createAgentExecutionCorrectionLoop — creates record", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const rec = await createAgentExecutionCorrectionLoop({
    workspaceId: "ws1", outcomeId: outcome.id, executionRequestId: "er1",
    correctionType: "retry_dispatch", correctionRationale: "retry",
  });
  assert.ok(rec.id);
  assert.equal(rec.correctionStatus, "created");
});

test("updateAgentExecutionCorrectionLoopStatus — updates status", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const loop = await createAgentExecutionCorrectionLoop({
    workspaceId: "ws1", outcomeId: outcome.id, executionRequestId: "er1",
    correctionType: "update_evidence", correctionRationale: null,
  });
  const updated = await updateAgentExecutionCorrectionLoopStatus({
    workspaceId: "ws1", correctionLoopId: loop.id, correctionStatus: "applied", appliedBy: "u1",
  });
  assert.equal(updated.correctionStatus, "applied");
  assert.ok(updated.appliedAt);
});

test("recordAgentExecutionOutcomeEvent — creates event", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const event = await recordAgentExecutionOutcomeEvent({
    workspaceId: "ws1", outcomeId: outcome.id, eventType: "outcome_created",
    message: "test event",
  });
  assert.ok(event.id);
  assert.equal(event.eventType, "outcome_created");
});

test("listAgentExecutionOutcomeEvents — retrieves events for outcome", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  await recordAgentExecutionOutcomeEvent({ workspaceId: "ws1", outcomeId: outcome.id, eventType: "outcome_created" });
  await recordAgentExecutionOutcomeEvent({ workspaceId: "ws1", outcomeId: outcome.id, eventType: "reconciliation_started" });
  const events = await listAgentExecutionOutcomeEvents("ws1", outcome.id);
  assert.equal(events.length, 2);
});

// ─── Service Tests ────────────────────────────────────────────────────────────

test("createOutcomeFromDispatchAttempt — creates outcome with event", async () => {
  _clearOutcomeStores();
  const outcome = await createOutcomeFromDispatchAttempt({
    workspaceId: "ws1",
    executionRequestId: "er1",
    outcomeType: "dispatch_success",
  });
  assert.ok(outcome.id);
  assert.equal(outcome.outcomeType, "dispatch_success");
  const events = await listAgentExecutionOutcomeEvents("ws1", outcome.id);
  assert.ok(events.some((e) => e.eventType === "outcome_created"));
});

test("reconcileDispatchOutcome — reconciles and creates reconciliation record", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1", outcomeType: "dispatch_success" });
  const { reconciliation } = await reconcileDispatchOutcome({ workspaceId: "ws1", outcomeId: outcome.id });
  assert.ok(reconciliation.id);
  const updated = await getAgentExecutionOutcomeById("ws1", outcome.id);
  assert.equal(updated.status, "reconciled");
});

test("scoreOutcomeEvidenceCompleteness — scores and updates outcome", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const { evidenceCompleteness } = await scoreOutcomeEvidenceCompleteness("ws1", outcome.id);
  assert.ok(evidenceCompleteness.id);
  assert.ok(typeof evidenceCompleteness.completenessScore === "number");
  const updated = await getAgentExecutionOutcomeById("ws1", outcome.id);
  assert.equal(updated.status, "evidence_review");
});

test("compareOutcomeIntendedVsActual — compares and updates outcome", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({
    workspaceId: "ws1", executionRequestId: "er1",
    intendedOutcomeSummary: "send report", actualOutcomeSummary: "send report",
    outcomeType: "dispatch_success",
  });
  const { comparison } = await compareOutcomeIntendedVsActual("ws1", outcome.id);
  assert.ok(comparison.id);
  const updated = await getAgentExecutionOutcomeById("ws1", outcome.id);
  assert.equal(updated.status, "comparison_complete");
});

test("scoreOutcomeConfidence — scores and updates outcome", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const { confidence } = await scoreOutcomeConfidence("ws1", outcome.id);
  assert.ok(confidence.id);
  const updated = await getAgentExecutionOutcomeById("ws1", outcome.id);
  assert.equal(updated.status, "confidence_scored");
});

test("determineHumanOutcomeReview — sets review requirement", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1", outcomeType: "dispatch_failure" });
  const result = await determineHumanOutcomeReview("ws1", outcome.id);
  assert.ok(result.reviewRequirement);
  assert.ok(result.reviewStatus);
});

test("createHumanOutcomeReview — creates review and updates status", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const { humanReview } = await createHumanOutcomeReview({ workspaceId: "ws1", outcomeId: outcome.id });
  assert.ok(humanReview.id);
  assert.equal(humanReview.reviewStatus, "pending");
  const updated = await getAgentExecutionOutcomeById("ws1", outcome.id);
  assert.equal(updated.status, "review_in_progress");
});

test("recordHumanOutcomeDecision — approve sets review_complete", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const { humanReview } = await createHumanOutcomeReview({ workspaceId: "ws1", outcomeId: outcome.id });
  const { outcome: updatedOutcome } = await recordHumanOutcomeDecision({
    workspaceId: "ws1", outcomeId: outcome.id, humanReviewId: humanReview.id,
    decisionType: "approve", decisionRationale: "LGTM",
  });
  assert.equal(updatedOutcome.status, "review_complete");
});

test("recordHumanOutcomeDecision — reject sets correction_required", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const { humanReview } = await createHumanOutcomeReview({ workspaceId: "ws1", outcomeId: outcome.id });
  const { outcome: updatedOutcome } = await recordHumanOutcomeDecision({
    workspaceId: "ws1", outcomeId: outcome.id, humanReviewId: humanReview.id,
    decisionType: "reject",
  });
  assert.equal(updatedOutcome.status, "correction_required");
});

test("createFailedDispatchTriage — creates triage record", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1", outcomeType: "dispatch_failure" });
  const { triage } = await createFailedDispatchTriage({
    workspaceId: "ws1", outcomeId: outcome.id, failureCategory: "adapter_error",
    failureMessage: "adapter crashed",
  });
  assert.ok(triage.id);
  assert.equal(triage.failureCategory, "adapter_error");
});

test("createOutcomeCorrectionLoop — creates correction and updates status", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const { correctionLoop } = await createOutcomeCorrectionLoop({
    workspaceId: "ws1", outcomeId: outcome.id, correctionType: "retry_dispatch",
  });
  assert.ok(correctionLoop.id);
  const updated = await getAgentExecutionOutcomeById("ws1", outcome.id);
  assert.equal(updated.status, "correction_in_progress");
});

test("archiveOutcome — sets status to archived", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  const archived = await archiveOutcome("ws1", outcome.id);
  assert.equal(archived.status, "archived");
});

test("buildExecutionOutcomeSummary — returns comprehensive summary", async () => {
  _clearOutcomeStores();
  const outcome = await createAgentExecutionOutcome({ workspaceId: "ws1", executionRequestId: "er1" });
  await reconcileDispatchOutcome({ workspaceId: "ws1", outcomeId: outcome.id });
  const summary = await buildExecutionOutcomeSummary("ws1", outcome.id);
  assert.ok(summary.outcome);
  assert.ok(summary.reconciliation);
  assert.ok(Array.isArray(summary.events));
});

// ─── Migration Tests ──────────────────────────────────────────────────────────

test("migration file — defines all 9 tables", () => {
  const tables = [
    "agent_execution_outcomes",
    "agent_execution_outcome_reconciliations",
    "agent_execution_outcome_comparisons",
    "agent_execution_evidence_completeness",
    "agent_execution_outcome_confidence",
    "agent_execution_human_outcome_reviews",
    "agent_execution_failed_dispatch_triage",
    "agent_execution_correction_loops",
    "agent_execution_outcome_events",
  ];
  for (const t of tables) {
    assert.ok(migrationFile.includes(t), `Missing table: ${t}`);
  }
});

test("migration file — enables RLS on all tables", () => {
  assert.ok(migrationFile.includes("enable row level security"));
  const rlsCount = (migrationFile.match(/enable row level security/g) ?? []).length;
  assert.ok(rlsCount >= 9);
});

test("migration file — workspace member policies present", () => {
  assert.ok(migrationFile.includes("workspace_members_read_execution_outcomes"));
  assert.ok(migrationFile.includes("workspace_members_insert_execution_outcomes"));
  assert.ok(migrationFile.includes("workspace_members_read_human_outcome_reviews"));
});

test("migration file — references correct upstream tables", () => {
  assert.ok(migrationFile.includes("references public.agent_execution_requests(id)"));
  assert.ok(migrationFile.includes("references public.agent_execution_finalizations(id)"));
  assert.ok(migrationFile.includes("references public.workspaces(id)"));
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("database contract — all 9 row types defined", () => {
  assert.ok(contractFile.includes("AgentExecutionOutcomeRow"));
  assert.ok(contractFile.includes("AgentExecutionOutcomeReconciliationRow"));
  assert.ok(contractFile.includes("AgentExecutionOutcomeComparisonRow"));
  assert.ok(contractFile.includes("AgentExecutionEvidenceCompletenessRow"));
  assert.ok(contractFile.includes("AgentExecutionOutcomeConfidenceRow"));
  assert.ok(contractFile.includes("AgentExecutionHumanOutcomeReviewRow"));
  assert.ok(contractFile.includes("AgentExecutionFailedDispatchTriageRow"));
  assert.ok(contractFile.includes("AgentExecutionCorrectionLoopRow"));
  assert.ok(contractFile.includes("AgentExecutionOutcomeEventRow"));
});

test("database contract — all column arrays defined", () => {
  assert.ok(contractFile.includes("AGENT_EXECUTION_OUTCOME_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_OUTCOME_RECONCILIATION_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_OUTCOME_COMPARISON_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_EVIDENCE_COMPLETENESS_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_OUTCOME_CONFIDENCE_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_HUMAN_OUTCOME_REVIEW_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_FAILED_DISPATCH_TRIAGE_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_CORRECTION_LOOP_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_OUTCOME_EVENT_COLUMNS"));
});

test("database contract — version includes reconciliation layer", () => {
  assert.ok(contractFile.includes("controlled-execution-result-reconciliation-human-outcome-review"));
});

// ─── Index.ts Export Tests ────────────────────────────────────────────────────

test("index.ts — exports all outcome types", () => {
  assert.ok(indexFile.includes("AgentExecutionOutcomeRecord"));
  assert.ok(indexFile.includes("AgentExecutionOutcomeReconciliationRecord"));
  assert.ok(indexFile.includes("CreateAgentExecutionOutcomeInput"));
  assert.ok(indexFile.includes("ReconcileDispatchOutcomeInput"));
  assert.ok(indexFile.includes("CreateHumanOutcomeReviewInput"));
  assert.ok(indexFile.includes("RecordHumanOutcomeDecisionInput"));
});

test("index.ts — exports all validation helpers", () => {
  assert.ok(indexFile.includes("validateAgentExecutionOutcomeStatus"));
  assert.ok(indexFile.includes("calculateEvidenceCompleteness"));
  assert.ok(indexFile.includes("compareIntendedVsActualOutcome"));
  assert.ok(indexFile.includes("calculateOutcomeConfidence"));
  assert.ok(indexFile.includes("determineOutcomeReviewRequirement"));
  assert.ok(indexFile.includes("redactExecutionOutcomePayload"));
});

test("index.ts — exports all registry functions", () => {
  assert.ok(indexFile.includes("createAgentExecutionOutcome"));
  assert.ok(indexFile.includes("listAgentExecutionOutcomes"));
  assert.ok(indexFile.includes("createAgentExecutionHumanOutcomeReview"));
  assert.ok(indexFile.includes("_clearOutcomeStores"));
});

test("index.ts — exports all service functions", () => {
  assert.ok(indexFile.includes("createOutcomeFromDispatchAttempt"));
  assert.ok(indexFile.includes("reconcileDispatchOutcome"));
  assert.ok(indexFile.includes("scoreOutcomeEvidenceCompleteness"));
  assert.ok(indexFile.includes("compareOutcomeIntendedVsActual"));
  assert.ok(indexFile.includes("scoreOutcomeConfidence"));
  assert.ok(indexFile.includes("determineHumanOutcomeReview"));
  assert.ok(indexFile.includes("createHumanOutcomeReview"));
  assert.ok(indexFile.includes("recordHumanOutcomeDecision"));
  assert.ok(indexFile.includes("createFailedDispatchTriage"));
  assert.ok(indexFile.includes("createOutcomeCorrectionLoop"));
  assert.ok(indexFile.includes("archiveOutcome"));
  assert.ok(indexFile.includes("buildExecutionOutcomeSummary"));
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability types — new source type present", () => {
  assert.ok(obsFile.includes("agent_controlled_execution_result_reconciliation_human_outcome_review"));
});

test("observability types — new audit event types present", () => {
  assert.ok(obsFile.includes("execution_outcome_created"));
  assert.ok(obsFile.includes("execution_outcome_reconciled"));
  assert.ok(obsFile.includes("execution_outcome_human_review_created"));
  assert.ok(obsFile.includes("execution_outcome_decision_recorded"));
  assert.ok(obsFile.includes("execution_outcome_archived"));
});

// ─── No Prohibited Content ────────────────────────────────────────────────────

test("types file — no LLM/embedding references", () => {
  assert.ok(!typesFile.includes("openai"));
  assert.ok(!typesFile.includes("anthropic"));
  assert.ok(!typesFile.includes("gemini"));
  assert.ok(!typesFile.includes("embedding"));
});

test("validation file — no LLM/embedding references", () => {
  assert.ok(!validationFile.includes("openai"));
  assert.ok(!validationFile.includes("anthropic"));
  assert.ok(!validationFile.includes("gemini"));
  assert.ok(!validationFile.includes("embedding"));
});

test("registry file — no LLM/embedding references", () => {
  assert.ok(!registryFile.includes("openai"));
  assert.ok(!registryFile.includes("anthropic"));
  assert.ok(!registryFile.includes("gemini"));
  assert.ok(!registryFile.includes("embedding"));
});

test("service file — no LLM/embedding references", () => {
  assert.ok(!serviceFile.includes("openai"));
  assert.ok(!serviceFile.includes("anthropic"));
  assert.ok(!serviceFile.includes("gemini"));
  assert.ok(!serviceFile.includes("embedding"));
});

test("service file — no project mutation", () => {
  assert.ok(!serviceFile.includes("mutateProject"));
  assert.ok(!serviceFile.includes("sendEmail"));
  assert.ok(!serviceFile.includes("sendSlack"));
  assert.ok(!serviceFile.includes("createTicket"));
});

// ─── Terminology Tests ────────────────────────────────────────────────────────

test("no informal terminology in types file", () => {
  const lowerTypes = typesFile.toLowerCase();
  assert.ok(!lowerTypes.includes("fucker"));
});

test("no informal terminology in validation file", () => {
  const lower = validationFile.toLowerCase();
  assert.ok(!lower.includes("fucker"));
});

test("no informal terminology in service file", () => {
  const lower = serviceFile.toLowerCase();
  assert.ok(!lower.includes("fucker"));
});

// ─── Regression — Previous Layer Imports ─────────────────────────────────────

test("regression — dispatch types file still exists", () => {
  const exists = existsSync(resolve(ROOT, "src/lib/agents/agent-execution-dispatch-types.ts"));
  assert.ok(exists);
});

test("regression — dispatch service file still exists", () => {
  const exists = existsSync(resolve(ROOT, "src/lib/agents/agent-execution-dispatch-service.ts"));
  assert.ok(exists);
});

test("regression — dispatch migration still exists", () => {
  const exists = existsSync(resolve(ROOT, "supabase/migrations/20260804000000_agent_controlled_execution_finalization_adapter_dispatch_gate.sql"));
  assert.ok(exists);
});

test("regression — action conversion types still exist", () => {
  const exists = existsSync(resolve(ROOT, "src/lib/agents/agent-action-conversion-types.ts"));
  assert.ok(exists);
});

test("regression — result types still exist", () => {
  const exists = existsSync(resolve(ROOT, "src/lib/agents/agent-execution-result-types.ts"));
  assert.ok(exists);
});
