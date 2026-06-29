// ─── Controlled Execution Learning Signals & Governance Feedback Loop — Tests ──
// No LLM calls. No external API calls. No real side effects.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-learning-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-learning-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-learning-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-learning-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260806000000_agent_controlled_execution_learning_signals_governance_feedback_loop.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = existsSync(resolve(ROOT, "docs/agent-controlled-execution-learning-signals-governance-feedback-loop.md"))
  ? readFileSync(resolve(ROOT, "docs/agent-controlled-execution-learning-signals-governance-feedback-loop.md"), "utf8")
  : "";

const {
  validateAgentExecutionLearningSignalStatus,
  validateAgentExecutionLearningSignalType,
  validateAgentExecutionLearningSignalCategory,
  validateAgentExecutionLearningSourceType,
  validateAgentExecutionLearningPrivacyClassification,
  validateAgentExecutionLearningRetentionClass,
  validateAgentExecutionLearningExtractionStatus,
  validateAgentExecutionGovernanceFeedbackStatus,
  validateAgentExecutionGovernanceFeedbackType,
  validateAgentExecutionGovernanceFeedbackSeverity,
  validateAgentExecutionRiskCalibrationDirection,
  validateAgentExecutionTrendDirection,
  validateAgentExecutionRouteEffectiveness,
  validateAgentExecutionLearningEventType,
  assertLearningSignalPayloadSerializable,
  redactLearningSignalPayload,
  normalizeCreateAgentExecutionLearningSignalInput,
  normalizeExtractLearningSignalsInput,
  normalizeGenerateGovernanceFeedbackInput,
  normalizeGenerateWorkspaceLearningSummaryInput,
  dedupeLearningStrings,
  evaluateLearningPrivacyFilter,
  deriveRiskCalibrationDirection,
  deriveGovernanceFeedbackSeverity,
  calculateSignalWeight,
  calculateLearningConfidence,
} = await import("../src/lib/agents/agent-execution-learning-validation.ts");

const {
  createAgentExecutionLearningSignal,
  getAgentExecutionLearningSignalById,
  listAgentExecutionLearningSignals,
  updateAgentExecutionLearningSignalStatus,
  createAgentExecutionLearningExtraction,
  updateAgentExecutionLearningExtraction,
  createAgentExecutionLearningPrivacyFilter,
  createAgentExecutionGovernanceFeedback,
  updateAgentExecutionGovernanceFeedbackStatus,
  listAgentExecutionGovernanceFeedback,
  createAgentExecutionRiskCalibrationSignal,
  createAgentExecutionEvidenceQualitySignal,
  createAgentExecutionAdapterPerformanceSignal,
  createAgentExecutionReviewDecisionPattern,
  createAgentExecutionReviewRoutingFeedback,
  createAgentExecutionWorkspaceLearningSummary,
  createAgentExecutionAggregateLearningSignal,
  recordAgentExecutionLearningEvent,
  listAgentExecutionLearningEvents,
  _clearLearningStores,
} = await import("../src/lib/agents/agent-execution-learning-registry.ts");

const {
  runLearningPrivacyFilter,
  createPrivacySafeLearningSignal,
  extractLearningSignalsFromOutcome,
  extractLearningSignalsFromHumanOutcomeReview,
  extractLearningSignalsFromCorrectionLoop,
  extractLearningSignalsFromFailedDispatchTriage,
  generateGovernanceFeedbackFromSignals,
  generateRiskCalibrationSignals,
  generateEvidenceQualitySignals,
  generateAdapterPerformanceSignals,
  generateReviewDecisionPatterns,
  generateReviewRoutingFeedback,
  generateWorkspaceLearningSummary,
  createPrivacySafeAggregateSignal,
  archiveLearningSignal,
  buildExecutionLearningSummary,
} = await import("../src/lib/agents/agent-execution-learning-service.ts");

// ─── Type / Union Tests ───────────────────────────────────────────────────────

test("learning signal statuses — all values present in types file", () => {
  const statuses = [
    "created","privacy_pending","privacy_passed","privacy_blocked",
    "active","archived","invalidated",
  ];
  for (const s of statuses) {
    assert.ok(typesFile.includes(`"${s}"`), `Missing status: ${s}`);
  }
});

test("learning signal types — all values present in types file", () => {
  const types = [
    "outcome_accepted","outcome_rejected","correction_requested",
    "retry_recommended","evidence_missing","evidence_complete",
    "confidence_low","confidence_high","intended_actual_matched",
    "intended_actual_mismatched","dispatch_failed","triage_retryable",
    "triage_escalated","risk_underestimated","risk_overestimated",
    "risk_aligned","adapter_quality_positive","adapter_quality_negative",
    "review_route_effective","review_route_ineffective",
  ];
  for (const t of types) {
    assert.ok(typesFile.includes(`"${t}"`), `Missing signal type: ${t}`);
  }
});

test("learning signal categories — all values present", () => {
  const cats = ["outcome","evidence","confidence","risk","adapter","review","triage","governance"];
  for (const c of cats) {
    assert.ok(typesFile.includes(`"${c}"`), `Missing category: ${c}`);
  }
});

test("governance feedback types — all values present", () => {
  const types = [
    "risk_calibration","evidence_requirement","adapter_quality",
    "review_routing","human_review_policy","triage_policy","governance_observation",
  ];
  for (const t of types) {
    assert.ok(typesFile.includes(`"${t}"`), `Missing feedback type: ${t}`);
  }
});

test("learning event types — all 16 values present", () => {
  const events = [
    "learning_signal_created","learning_signal_privacy_checked",
    "learning_signal_privacy_passed","learning_signal_privacy_blocked",
    "learning_extraction_started","learning_extraction_succeeded",
    "learning_extraction_failed","governance_feedback_created",
    "risk_calibration_signal_created","evidence_quality_signal_created",
    "adapter_performance_signal_created","review_decision_pattern_created",
    "review_routing_feedback_created","workspace_learning_summary_created",
    "aggregate_signal_created","learning_signal_archived",
  ];
  for (const e of events) {
    assert.ok(typesFile.includes(`"${e}"`), `Missing event type: ${e}`);
  }
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

test("validateAgentExecutionLearningSignalStatus — valid values pass", () => {
  assert.ok(validateAgentExecutionLearningSignalStatus("active"));
  assert.ok(validateAgentExecutionLearningSignalStatus("archived"));
  assert.ok(validateAgentExecutionLearningSignalStatus("privacy_blocked"));
  assert.ok(!validateAgentExecutionLearningSignalStatus("unknown_status"));
  assert.ok(!validateAgentExecutionLearningSignalStatus(null));
});

test("validateAgentExecutionLearningSignalType — all signal types valid", () => {
  assert.ok(validateAgentExecutionLearningSignalType("outcome_accepted"));
  assert.ok(validateAgentExecutionLearningSignalType("dispatch_failed"));
  assert.ok(validateAgentExecutionLearningSignalType("risk_underestimated"));
  assert.ok(!validateAgentExecutionLearningSignalType("made_up_type"));
});

test("validateAgentExecutionGovernanceFeedbackSeverity — valid values", () => {
  assert.ok(validateAgentExecutionGovernanceFeedbackSeverity("info"));
  assert.ok(validateAgentExecutionGovernanceFeedbackSeverity("critical"));
  assert.ok(!validateAgentExecutionGovernanceFeedbackSeverity("unknown"));
});

test("assertLearningSignalPayloadSerializable — accepts small payloads", () => {
  assert.doesNotThrow(() => assertLearningSignalPayloadSerializable({ count: 5, status: "active" }));
});

test("assertLearningSignalPayloadSerializable — rejects > 20KB payloads", () => {
  const huge = { data: "x".repeat(21 * 1024) };
  assert.throws(() => assertLearningSignalPayloadSerializable(huge), /20KB/);
});

test("redactLearningSignalPayload — redacts sensitive keys", () => {
  const result = redactLearningSignalPayload({
    password: "secret123",
    email: "user@test.com",
    count: 5,
    status: "active",
  });
  assert.equal(result.password, "[REDACTED]");
  assert.equal(result.email, "[REDACTED]");
  assert.equal(result.count, 5);
  assert.equal(result.status, "active");
});

test("redactLearningSignalPayload — returns null for null input", () => {
  assert.equal(redactLearningSignalPayload(null), null);
});

test("normalizeCreateAgentExecutionLearningSignalInput — validates required fields", () => {
  assert.throws(() => normalizeCreateAgentExecutionLearningSignalInput({
    workspaceId: "",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "dispatch_success",
  }), /workspaceId/);
});

test("normalizeCreateAgentExecutionLearningSignalInput — clamps signal weight to 0-100", () => {
  const result = normalizeCreateAgentExecutionLearningSignalInput({
    workspaceId: "ws1",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "dispatch_success",
    signalWeight: 200,
    confidenceScore: -5,
  });
  assert.equal(result.signalWeight, 100);
  assert.equal(result.confidenceScore, 0);
});

test("normalizeCreateAgentExecutionLearningSignalInput — rejects signalValue > 240 chars", () => {
  assert.throws(() => normalizeCreateAgentExecutionLearningSignalInput({
    workspaceId: "ws1",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "x".repeat(241),
  }), /240/);
});

test("normalizeGenerateWorkspaceLearningSummaryInput — rejects periodEnd before periodStart", () => {
  assert.throws(() => normalizeGenerateWorkspaceLearningSummaryInput({
    workspaceId: "ws1",
    periodStart: "2026-09-01T00:00:00Z",
    periodEnd: "2026-08-01T00:00:00Z",
  }), /periodEnd/);
});

test("dedupeLearningStrings — removes duplicates", () => {
  const result = dedupeLearningStrings(["a","b","a","c","b"]);
  assert.deepEqual(result, ["a","b","c"]);
});

// ─── Privacy Filter Tests ─────────────────────────────────────────────────────

test("evaluateLearningPrivacyFilter — blocks raw payload keys", () => {
  const result = evaluateLearningPrivacyFilter({
    workspaceId: "ws1",
    sourceType: "execution_outcome",
    sourceId: "src1",
    candidateSignalType: "outcome_accepted",
    signalValue: "dispatch_success",
    signalPayload: { payload: "some raw data", count: 5 },
  });
  assert.equal(result.containsRawPayload, true);
  assert.equal(result.safeToStore, false);
  assert.equal(result.privacyClassification, "blocked_raw_payload");
  assert.equal(result.retentionClass, "blocked");
});

test("evaluateLearningPrivacyFilter — blocks long free text in signalValue", () => {
  const result = evaluateLearningPrivacyFilter({
    workspaceId: "ws1",
    sourceType: "execution_outcome",
    sourceId: "src1",
    candidateSignalType: "outcome_accepted",
    signalValue: "x".repeat(241),
    signalPayload: null,
  });
  assert.equal(result.containsFreeText, true);
  assert.equal(result.safeToStore, false);
  assert.equal(result.privacyClassification, "blocked_free_text");
});

test("evaluateLearningPrivacyFilter — blocks long free text in payload values", () => {
  const result = evaluateLearningPrivacyFilter({
    workspaceId: "ws1",
    sourceType: "execution_outcome",
    sourceId: "src1",
    candidateSignalType: "outcome_accepted",
    signalValue: "dispatch_success",
    signalPayload: { description: "x".repeat(101) },
  });
  assert.equal(result.containsFreeText, true);
  assert.equal(result.safeToStore, false);
});

test("evaluateLearningPrivacyFilter — blocks sensitive keys", () => {
  const result = evaluateLearningPrivacyFilter({
    workspaceId: "ws1",
    sourceType: "execution_outcome",
    sourceId: "src1",
    candidateSignalType: "outcome_accepted",
    signalValue: "dispatch_success",
    signalPayload: { token: "abc123" },
  });
  assert.equal(result.containsSensitiveKey, true);
  assert.equal(result.safeToStore, false);
  assert.equal(result.privacyClassification, "blocked_sensitive");
});

test("evaluateLearningPrivacyFilter — allows enum/count/score/category values", () => {
  const result = evaluateLearningPrivacyFilter({
    workspaceId: "ws1",
    sourceType: "execution_outcome",
    sourceId: "src1",
    candidateSignalType: "outcome_accepted",
    signalValue: "dispatch_success",
    signalPayload: { count: 5, riskLevel: "high", status: "active" },
  });
  assert.equal(result.safeToStore, true);
  assert.equal(result.privacyClassification, "safe");
  assert.equal(result.retentionClass, "signal_only");
});

test("evaluateLearningPrivacyFilter — blocks customer identifier keys", () => {
  const result = evaluateLearningPrivacyFilter({
    workspaceId: "ws1",
    sourceType: "execution_outcome",
    sourceId: "src1",
    candidateSignalType: "outcome_accepted",
    signalValue: "dispatch_success",
    signalPayload: { customer: "cust_123" },
  });
  assert.equal(result.containsCustomerIdentifier, true);
  assert.equal(result.safeToStore, false);
});

test("deriveRiskCalibrationDirection — underestimated when low risk and correction requested", () => {
  const dir = deriveRiskCalibrationDirection({
    originalRiskLevel: "low",
    correctionRequested: true,
  });
  assert.equal(dir, "underestimated");
});

test("deriveRiskCalibrationDirection — overestimated when high risk and accepted with high confidence", () => {
  const dir = deriveRiskCalibrationDirection({
    originalRiskLevel: "high",
    reviewDecisionType: "approve",
    outcomeConfidenceLevel: "high",
  });
  assert.equal(dir, "overestimated");
});

test("deriveRiskCalibrationDirection — aligned when approved without correction", () => {
  const dir = deriveRiskCalibrationDirection({
    originalRiskLevel: "medium",
    reviewDecisionType: "approve",
  });
  assert.equal(dir, "aligned");
});

test("deriveGovernanceFeedbackSeverity — high when weight >= 80 and confidence >= 70", () => {
  assert.equal(deriveGovernanceFeedbackSeverity({ signalWeight: 85, confidenceScore: 75 }), "high");
});

test("deriveGovernanceFeedbackSeverity — medium when weight >= 60", () => {
  assert.equal(deriveGovernanceFeedbackSeverity({ signalWeight: 65, confidenceScore: 50 }), "medium");
});

test("calculateSignalWeight — base 50, +20 for reject", () => {
  const w = calculateSignalWeight({ humanDecisionType: "reject" });
  assert.equal(w, 70);
});

test("calculateSignalWeight — clamped to 0-100", () => {
  const w = calculateSignalWeight({
    humanDecisionType: "reject",
    riskLevel: "critical",
    evidenceCompletenessLevel: "none",
    confidenceLevel: "low",
  });
  assert.ok(w <= 100);
  assert.ok(w >= 0);
});

test("calculateLearningConfidence — base 40, increases with sources", () => {
  const base = calculateLearningConfidence({ sourceAvailable: false, privacySafe: false, humanDecisionPresent: false });
  const full = calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: true, evidenceCompletenessLevel: "complete" });
  assert.ok(full > base);
  assert.ok(full <= 100);
  assert.ok(base >= 0);
});

// ─── Registry Tests ───────────────────────────────────────────────────────────

test("createAgentExecutionLearningSignal — creates record with correct fields", async () => {
  _clearLearningStores();
  const record = await createAgentExecutionLearningSignal({
    workspaceId: "ws-test",
    sourceType: "execution_outcome",
    sourceId: "outcome-1",
    outcomeId: "outcome-1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "dispatch_success",
    signalWeight: 60,
    confidenceScore: 70,
    privacyClassification: "safe",
    retentionClass: "signal_only",
    safeSignalPayload: { count: 1 },
  });
  assert.ok(record.id);
  assert.equal(record.workspaceId, "ws-test");
  assert.equal(record.signalType, "outcome_accepted");
  assert.equal(record.status, "active");
  assert.equal(record.signalPayload, null); // Never store raw payload
  assert.deepEqual(record.safeSignalPayload, { count: 1 });
});

test("getAgentExecutionLearningSignalById — returns null for wrong workspace", async () => {
  _clearLearningStores();
  const record = await createAgentExecutionLearningSignal({
    workspaceId: "ws-test",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "dispatch_success",
    privacyClassification: "safe",
    retentionClass: "signal_only",
    safeSignalPayload: null,
  });
  const found = await getAgentExecutionLearningSignalById("wrong-ws", record.id);
  assert.equal(found, null);
});

test("listAgentExecutionLearningSignals — filters by signalType", async () => {
  _clearLearningStores();
  await createAgentExecutionLearningSignal({
    workspaceId: "ws-filter",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "v1",
    privacyClassification: "safe",
    retentionClass: "signal_only",
    safeSignalPayload: null,
  });
  await createAgentExecutionLearningSignal({
    workspaceId: "ws-filter",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "confidence_low",
    signalCategory: "confidence",
    signalValue: "low",
    privacyClassification: "safe",
    retentionClass: "signal_only",
    safeSignalPayload: null,
  });
  const accepted = await listAgentExecutionLearningSignals("ws-filter", { signalType: "outcome_accepted" });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].signalType, "outcome_accepted");
});

test("updateAgentExecutionLearningSignalStatus — archives signal", async () => {
  _clearLearningStores();
  const record = await createAgentExecutionLearningSignal({
    workspaceId: "ws-archive",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "v1",
    privacyClassification: "safe",
    retentionClass: "signal_only",
    safeSignalPayload: null,
  });
  const updated = await updateAgentExecutionLearningSignalStatus("ws-archive", record.id, "archived");
  assert.equal(updated?.status, "archived");
});

test("createAgentExecutionGovernanceFeedback — creates record without mutating policy", async () => {
  _clearLearningStores();
  const record = await createAgentExecutionGovernanceFeedback({
    workspaceId: "ws-gov",
    feedbackType: "risk_calibration",
    feedbackCategory: "risk",
    severity: "medium",
    recommendation: "Review risk scoring for adapter_x",
    confidenceScore: 70,
    sourceSignalIds: ["sig-1","sig-2"],
  });
  assert.ok(record.id);
  assert.equal(record.feedbackType, "risk_calibration");
  assert.equal(record.status, "created");
  // Feedback record does not mutate any policy
  assert.equal(typeof record.recommendation, "string");
  assert.ok(record.recommendation.length > 0);
});

test("createAgentExecutionLearningExtraction — creates with created status", async () => {
  _clearLearningStores();
  const record = await createAgentExecutionLearningExtraction({
    workspaceId: "ws-ext",
    sourceType: "execution_outcome",
    sourceId: "outcome-1",
  });
  assert.equal(record.status, "created");
  assert.equal(record.signalsExtracted, 0);
});

test("recordAgentExecutionLearningEvent — appends event", async () => {
  _clearLearningStores();
  await recordAgentExecutionLearningEvent({
    workspaceId: "ws-events",
    eventType: "learning_signal_created",
    message: "Signal created",
  });
  const events = await listAgentExecutionLearningEvents("ws-events");
  assert.ok(events.length > 0);
  assert.equal(events[0].eventType, "learning_signal_created");
});

test("privacy filters — append-only, not deleted", async () => {
  _clearLearningStores();
  const f1 = await createAgentExecutionLearningPrivacyFilter({
    workspaceId: "ws-pf",
    sourceType: "execution_outcome",
    sourceId: "src1",
    candidateSignalType: "outcome_accepted",
    containsRawPayload: false,
    containsFreeText: false,
    containsSensitiveKey: false,
    containsCustomerIdentifier: false,
    containsProjectIdentifier: false,
    safeToStore: true,
    redactionApplied: false,
    privacyClassification: "safe",
    retentionClass: "signal_only",
    filterReasons: [],
  });
  const f2 = await createAgentExecutionLearningPrivacyFilter({
    workspaceId: "ws-pf",
    sourceType: "execution_outcome",
    sourceId: "src1",
    candidateSignalType: "outcome_rejected",
    containsRawPayload: true,
    containsFreeText: false,
    containsSensitiveKey: false,
    containsCustomerIdentifier: false,
    containsProjectIdentifier: false,
    safeToStore: false,
    redactionApplied: false,
    privacyClassification: "blocked_raw_payload",
    retentionClass: "blocked",
    filterReasons: ["raw_payload_key:payload"],
  });
  assert.ok(f1.id !== f2.id);
  assert.equal(f2.safeToStore, false);
});

// ─── Service Tests ────────────────────────────────────────────────────────────

test("createPrivacySafeLearningSignal — returns null when privacy blocked", async () => {
  _clearLearningStores();
  const signal = await createPrivacySafeLearningSignal({
    workspaceId: "ws-priv",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "dispatch_success",
    signalPayload: { payload: "raw data here" }, // Should be blocked
  });
  assert.equal(signal, null);
});

test("createPrivacySafeLearningSignal — succeeds with safe payload", async () => {
  _clearLearningStores();
  const signal = await createPrivacySafeLearningSignal({
    workspaceId: "ws-safe",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "dispatch_success",
    signalPayload: { riskLevel: "low", count: 1 },
  });
  assert.ok(signal !== null);
  assert.equal(signal.status, "active");
  assert.equal(signal.signalPayload, null); // INVARIANT: never store raw payload
});

test("extractLearningSignalsFromOutcome — does NOT read outcomePayload, intendedSummary, actualSummary", async () => {
  // This is verified at the code level — these fields are not in the parameter type
  assert.ok(!serviceFile.includes("outcomePayload"), "Service must not reference outcomePayload");
  assert.ok(!serviceFile.includes("safeOutcomePayload"), "Service must not reference safeOutcomePayload");
  assert.ok(!serviceFile.includes("intendedSummary"), "Service must not reference intendedSummary");
  assert.ok(!serviceFile.includes("actualSummary"), "Service must not reference actualSummary");
});

test("extractLearningSignalsFromHumanOutcomeReview — does NOT read rationale", () => {
  assert.ok(!serviceFile.includes("rationale"), "Service must not reference rationale");
});

test("extractLearningSignalsFromCorrectionLoop — does NOT read correctionReason", () => {
  assert.ok(!serviceFile.includes("correctionReason"), "Service must not reference correctionReason");
});

test("extractLearningSignalsFromFailedDispatchTriage — does NOT read failureMessage", () => {
  assert.ok(!serviceFile.includes("failureMessage"), "Service must not reference failureMessage");
});

test("extractLearningSignalsFromOutcome — extracts signals from approved outcome", async () => {
  _clearLearningStores();
  const signals = await extractLearningSignalsFromOutcome({
    id: "outcome-approved",
    workspaceId: "ws-extract",
    status: "review_complete",
    outcomeType: "dispatch_success",
    matchStatus: "matched",
    confidenceLevel: "high",
    evidenceCompletenessLevel: "complete",
    reviewRequirement: "required_policy",
    reviewStatus: "approved",
    adapterKey: "adapter_x",
  });
  assert.ok(signals.length > 0);
  const types = signals.map((s) => s.signalType);
  assert.ok(types.includes("outcome_accepted"), "Should have outcome_accepted signal");
  assert.ok(types.includes("intended_actual_matched"), "Should have match signal");
});

test("extractLearningSignalsFromHumanOutcomeReview — extracts reject signal without rationale", async () => {
  _clearLearningStores();
  const signals = await extractLearningSignalsFromHumanOutcomeReview({
    id: "review-1",
    workspaceId: "ws-review",
    decisionType: "reject",
    reviewRequirement: "required_policy",
    reviewStatus: "rejected",
    priority: "high",
    riskLevel: "high",
    assignedRole: "pm",
    outcomeId: "outcome-1",
    adapterKey: "adapter_x",
    // rationale is NOT passed — it's excluded from the type
  });
  assert.ok(signals.length > 0);
  assert.equal(signals[0].signalType, "outcome_rejected");
});

test("extractLearningSignalsFromCorrectionLoop — extracts correction signal without correctionReason", async () => {
  _clearLearningStores();
  const signals = await extractLearningSignalsFromCorrectionLoop({
    id: "loop-1",
    workspaceId: "ws-corr",
    correctionType: "retry_dispatch",
    status: "created",
    retryRecommended: true,
    outcomeId: "outcome-1",
    adapterKey: "adapter_x",
    // correctionReason is NOT passed
  });
  assert.ok(signals.length >= 2);
  const types = signals.map((s) => s.signalType);
  assert.ok(types.includes("correction_requested"));
  assert.ok(types.includes("retry_recommended"));
});

test("extractLearningSignalsFromFailedDispatchTriage — extracts triage signals without failureMessage", async () => {
  _clearLearningStores();
  const signals = await extractLearningSignalsFromFailedDispatchTriage({
    id: "triage-1",
    workspaceId: "ws-triage",
    failureCategory: "adapter_error",
    retryable: true,
    suggestedRetryMode: "immediate",
    requiresHumanReview: true,
    requiresCorrection: false,
    requiresEscalation: true,
    outcomeId: null,
    adapterKey: "adapter_x",
    // failureMessage is NOT passed
  });
  assert.ok(signals.length > 0);
  const types = signals.map((s) => s.signalType);
  assert.ok(types.includes("dispatch_failed"));
  assert.ok(types.includes("triage_retryable"));
  assert.ok(types.includes("triage_escalated"));
});

test("generateGovernanceFeedbackFromSignals — creates records only, does not mutate policies", async () => {
  _clearLearningStores();
  // Create some signals first
  await createPrivacySafeLearningSignal({
    workspaceId: "ws-gov",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "risk_underestimated",
    signalCategory: "risk",
    signalValue: "low",
  });
  const feedback = await generateGovernanceFeedbackFromSignals({
    workspaceId: "ws-gov",
  });
  assert.ok(feedback.length > 0);
  // Feedback records have status "created", NOT applied to any policy
  for (const f of feedback) {
    assert.equal(f.status, "created");
    assert.ok(typeof f.recommendation === "string");
  }
});

test("generateGovernanceFeedbackFromSignals — governance feedback does not contain policy mutation code", () => {
  // Verify no policy mutation in service
  assert.ok(!serviceFile.includes("updatePolicy"), "No policy mutation allowed");
  assert.ok(!serviceFile.includes("setPolicy"), "No policy mutation allowed");
  assert.ok(!serviceFile.includes("mutatePolicy"), "No policy mutation allowed");
  assert.ok(!serviceFile.includes("changeRouting"), "No routing mutation allowed");
});

test("archiveLearningSignal — sets archived status, does not delete", async () => {
  _clearLearningStores();
  const sig = await createPrivacySafeLearningSignal({
    workspaceId: "ws-arch",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "dispatch_success",
  });
  assert.ok(sig !== null);
  const archived = await archiveLearningSignal("ws-arch", sig.id);
  assert.equal(archived?.status, "archived");
  // Signal still exists (not deleted)
  const found = await getAgentExecutionLearningSignalById("ws-arch", sig.id);
  assert.ok(found !== null);
  assert.equal(found.status, "archived");
});

test("buildExecutionLearningSummary — returns counts without raw payload", async () => {
  _clearLearningStores();
  await createPrivacySafeLearningSignal({
    workspaceId: "ws-summary",
    sourceType: "execution_outcome",
    sourceId: "src1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    signalValue: "dispatch_success",
  });
  const summary = await buildExecutionLearningSummary("ws-summary");
  assert.equal(typeof summary.totalSignals, "number");
  assert.ok(summary.totalSignals >= 1);
  assert.ok(typeof summary.byCategory === "object");
  assert.ok(typeof summary.byType === "object");
  // No raw payload in summary
  assert.ok(!JSON.stringify(summary).includes("outcomePayload"));
});

test("generateWorkspaceLearningSummary — creates summary with no raw payload", async () => {
  _clearLearningStores();
  const summary = await generateWorkspaceLearningSummary({
    workspaceId: "ws-wsummary",
    periodStart: "2026-08-01T00:00:00Z",
    periodEnd: "2026-08-31T23:59:59Z",
  });
  assert.ok(summary.id);
  assert.equal(summary.workspaceId, "ws-wsummary");
  assert.equal(typeof summary.totalSignals, "number");
  assert.ok(!JSON.stringify(summary.topSignalsJson).includes("outcomePayload"));
  assert.ok(!JSON.stringify(summary.topSignalsJson).includes("rationale"));
});

test("createPrivacySafeAggregateSignal — only creates when threshold met", async () => {
  _clearLearningStores();
  const notMet = await createPrivacySafeAggregateSignal({
    workspaceId: "ws-agg",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    count: 3,
    threshold: 10,
  });
  assert.equal(notMet, null);

  const met = await createPrivacySafeAggregateSignal({
    workspaceId: "ws-agg",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    count: 15,
    threshold: 10,
  });
  assert.ok(met !== null);
  assert.equal(met.thresholdMet, true);
  assert.equal(met.aggregateScope, "workspace");
  assert.equal(met.privacySafe, true);
});

// ─── Migration Tests ──────────────────────────────────────────────────────────

test("migration — all 12 tables defined", () => {
  const tables = [
    "agent_execution_learning_signals",
    "agent_execution_learning_extractions",
    "agent_execution_learning_privacy_filters",
    "agent_execution_governance_feedback",
    "agent_execution_risk_calibration_signals",
    "agent_execution_evidence_quality_signals",
    "agent_execution_adapter_performance_signals",
    "agent_execution_review_decision_patterns",
    "agent_execution_review_routing_feedback",
    "agent_execution_workspace_learning_summaries",
    "agent_execution_aggregate_learning_signals",
    "agent_execution_learning_events",
  ];
  for (const table of tables) {
    assert.ok(migrationFile.includes(table), `Migration missing table: ${table}`);
  }
});

test("migration — RLS enabled on all 12 tables", () => {
  const tables = [
    "agent_execution_learning_signals",
    "agent_execution_learning_extractions",
    "agent_execution_learning_privacy_filters",
    "agent_execution_governance_feedback",
    "agent_execution_risk_calibration_signals",
    "agent_execution_evidence_quality_signals",
    "agent_execution_adapter_performance_signals",
    "agent_execution_review_decision_patterns",
    "agent_execution_review_routing_feedback",
    "agent_execution_workspace_learning_summaries",
    "agent_execution_aggregate_learning_signals",
    "agent_execution_learning_events",
  ];
  for (const table of tables) {
    assert.ok(
      migrationFile.includes(`alter table public.${table} enable row level security`),
      `RLS not enabled for: ${table}`,
    );
  }
});

test("migration — no using (true) policies", () => {
  assert.ok(!migrationFile.includes("using (true)"), "Must not use permissive using (true) policies");
});

test("migration — uses workspace_members membership check", () => {
  assert.ok(migrationFile.includes("workspace_members"), "Must use workspace membership check for RLS");
});

// ─── DB Contract Tests ────────────────────────────────────────────────────────

test("database contract — all 12 row types defined", () => {
  const types = [
    "AgentExecutionLearningSignalRow",
    "AgentExecutionLearningExtractionRow",
    "AgentExecutionLearningPrivacyFilterRow",
    "AgentExecutionGovernanceFeedbackRow",
    "AgentExecutionRiskCalibrationSignalRow",
    "AgentExecutionEvidenceQualitySignalRow",
    "AgentExecutionAdapterPerformanceSignalRow",
    "AgentExecutionReviewDecisionPatternRow",
    "AgentExecutionReviewRoutingFeedbackRow",
    "AgentExecutionWorkspaceLearningSummaryRow",
    "AgentExecutionAggregateLearningSignalRow",
    "AgentExecutionLearningEventRow",
  ];
  for (const t of types) {
    assert.ok(contractFile.includes(t), `DB contract missing: ${t}`);
  }
});

test("database contract — version includes learning signals sprint", () => {
  assert.ok(contractFile.includes("controlled-execution-learning-signals-governance-feedback-loop"));
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability types — new learning event types added", () => {
  const events = [
    "execution_learning_signal_created",
    "execution_learning_signal_privacy_checked",
    "execution_learning_signal_privacy_blocked",
    "execution_learning_extraction_succeeded",
    "execution_governance_feedback_created",
    "execution_risk_calibration_signal_created",
  ];
  for (const e of events) {
    assert.ok(obsFile.includes(`"${e}"`), `Missing observability event: ${e}`);
  }
});

test("observability types — new source type added", () => {
  assert.ok(obsFile.includes("agent_controlled_execution_learning_signals_governance_feedback_loop"));
});

// ─── Index Exports Tests ──────────────────────────────────────────────────────

test("index — exports learning types", () => {
  assert.ok(indexFile.includes("AgentExecutionLearningSignalRecord"));
  assert.ok(indexFile.includes("AgentExecutionGovernanceFeedbackRecord"));
  assert.ok(indexFile.includes("CreateAgentExecutionLearningSignalInput"));
});

test("index — exports validation functions", () => {
  assert.ok(indexFile.includes("validateAgentExecutionLearningSignalType"));
  assert.ok(indexFile.includes("evaluateLearningPrivacyFilter"));
  assert.ok(indexFile.includes("calculateSignalWeight"));
});

test("index — exports service functions", () => {
  assert.ok(indexFile.includes("createPrivacySafeLearningSignal"));
  assert.ok(indexFile.includes("generateGovernanceFeedbackFromSignals"));
  assert.ok(indexFile.includes("buildExecutionLearningSummary"));
});

// ─── API Route Tests ──────────────────────────────────────────────────────────

test("API route — signals route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/learning/signals/route.ts")));
});

test("API route — governance-feedback route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/learning/governance-feedback/route.ts")));
});

test("API route — workspace-summary route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/learning/workspace-summary/route.ts")));
});

test("API route — events route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/learning/events/route.ts")));
});

// ─── Prohibited Behavior Tests ────────────────────────────────────────────────

test("prohibited — no LLM/embedding calls in service", () => {
  assert.ok(!serviceFile.includes("openai"), "No openai in service");
  assert.ok(!serviceFile.includes("anthropic"), "No anthropic in service");
  assert.ok(!serviceFile.includes("embedding"), "No embedding in service");
  assert.ok(!serviceFile.includes("fine-tune"), "No fine-tune in service");
});

test("prohibited — no fetch() calls in service or registry", () => {
  assert.ok(!serviceFile.includes("fetch("), "No fetch() in service");
  assert.ok(!registryFile.includes("fetch("), "No fetch() in registry");
});

test("prohibited — service does not store raw payload fields", () => {
  assert.ok(!serviceFile.includes("outcomePayload"), "No outcomePayload");
  assert.ok(!serviceFile.includes("safeOutcomePayload"), "No safeOutcomePayload");
  assert.ok(!serviceFile.includes("intendedSummary"), "No intendedSummary");
  assert.ok(!serviceFile.includes("actualSummary"), "No actualSummary");
  assert.ok(!serviceFile.includes("failureMessage"), "No failureMessage");
  assert.ok(!serviceFile.includes("correctionReason"), "No correctionReason");
});

test("prohibited — no hard deletes in registry", () => {
  assert.ok(!registryFile.includes(".delete("), "No .delete() in registry");
  assert.ok(!registryFile.includes("delete from"), "No DELETE FROM in registry");
});

// ─── Terminology Tests ────────────────────────────────────────────────────────

test("terminology — no informal internal terms in any new file", () => {
  const filesToCheck = [typesFile, validationFile, registryFile, serviceFile, migrationFile];
  const badTerms = ["fucker", "Fucker", "FUCKER"];
  for (const file of filesToCheck) {
    for (const term of badTerms) {
      assert.ok(!file.includes(term), `Found prohibited term: ${term}`);
    }
  }
});

// ─── Regression Tests ─────────────────────────────────────────────────────────

test("regression — prior outcome layer still exports correctly", () => {
  assert.ok(indexFile.includes("createAgentExecutionOutcome"));
  assert.ok(indexFile.includes("buildExecutionOutcomeSummary"));
  assert.ok(indexFile.includes("reconcileDispatchOutcome"));
});

test("regression — aggregate scope is workspace only (global_disabled)", async () => {
  _clearLearningStores();
  const record = await createAgentExecutionAggregateLearningSignal({
    aggregateScope: "workspace",
    workspaceId: "ws1",
    signalType: "outcome_accepted",
    signalCategory: "outcome",
    count: 10,
    thresholdMet: true,
    privacySafe: true,
  });
  assert.equal(record.aggregateScope, "workspace");
  // global_disabled scope does not get any actual data
});
