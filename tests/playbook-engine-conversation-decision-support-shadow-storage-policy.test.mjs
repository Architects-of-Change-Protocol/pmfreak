import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createDecisionSupportShadowStoragePolicyProfile,
  classifyDecisionSupportShadowStorageField,
  listDecisionSupportShadowStorageFieldPolicies,
  createDecisionSupportShadowStorageRetentionPolicy,
  createDecisionSupportShadowStorageDeletionPolicy,
  createDecisionSupportShadowDefaultOffPersistencePlan,
  assessDecisionSupportShadowCaptureRecordForStorage,
  runDecisionSupportShadowStoragePolicyEvaluation,
  summarizeDecisionSupportShadowStoragePolicyEvaluation,
  explainDecisionSupportShadowStoragePolicy,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts";
import { DECISION_SUPPORT_SHADOW_STORAGE_POLICY_FIELD_CASES } from "./fixtures/conversational-brain-decision-support-shadow-storage-policy-cases.ts";

import {
  captureDecisionSupportShadowRun,
  runDecisionSupportShadowCaptureHarnessEvaluation,
  summarizeDecisionSupportShadowCaptureHarnessEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";
import { DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES } from "./fixtures/conversational-brain-decision-support-shadow-capture-harness-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

import {
  prepareDecisionSupportShadowModeRun,
  runDecisionSupportShadowModePrepEvaluation,
  summarizeDecisionSupportShadowModePrepEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts";
import {
  runDecisionSupportAdapterMappingPlan,
  summarizeDecisionSupportAdapterMappingPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlan.ts";
import {
  runDecisionSupportShadowMappingEvaluation,
  summarizeDecisionSupportShadowMappingEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts";
import { handleDecisionSupportCandidate } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateHandler.ts";
import { DECISION_SUPPORT_HANDLER_CASES } from "./fixtures/conversational-brain-decision-support-handler-cases.ts";
import {
  runDecisionClarificationArchitectureReview,
  summarizeDecisionClarificationArchitectureReview,
} from "../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts";
import {
  runGeneralPmAdviceBoundaryReview,
  summarizeGeneralPmAdviceBoundaryReview,
} from "../src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts";
import { GENERAL_PM_ADVICE_BOUNDARY_CASES } from "./fixtures/conversational-brain-general-pm-advice-boundary-cases.ts";
import {
  runGoldenIntentEvaluation,
  summarizeGoldenIntentEvaluation,
} from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";
import {
  runClarificationResponseEvaluation,
  summarizeClarificationResponseEvaluation,
  toDecisionClarificationEvaluationCases,
  toGeneralPmBoundaryEvaluationCases,
  toCustomFixtureEvaluationCases,
} from "../src/lib/playbook-engine/conversation/clarification/clarificationResponseEvaluation.ts";
import { CLARIFICATION_RESPONSE_CASES } from "./fixtures/conversational-brain-clarification-response-cases.ts";

/**
 * Sprint 26R — Decision Support Shadow Capture Storage Policy / Default-Off Persistence Plan.
 *
 * Tests the pure, offline, deterministic storage **policy** in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts`.
 * This module classifies capture-record fields, defines a strict retention/deletion policy, and
 * assembles a default-off persistence plan — it creates no database, migration, storage adapter,
 * Supabase write, or real feature flag. The regression section re-runs the golden evaluation and
 * every prior sprint's evaluator to confirm none of their metrics changed.
 */

// ─── Structure ───────────────────────────────────────────────────────────────────

test("createDecisionSupportShadowStoragePolicyProfile exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowStoragePolicyProfile, "function");
});

test("classifyDecisionSupportShadowStorageField exists and is a function", () => {
  assert.equal(typeof classifyDecisionSupportShadowStorageField, "function");
});

test("listDecisionSupportShadowStorageFieldPolicies exists and is a function", () => {
  assert.equal(typeof listDecisionSupportShadowStorageFieldPolicies, "function");
});

test("createDecisionSupportShadowStorageRetentionPolicy exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowStorageRetentionPolicy, "function");
});

test("createDecisionSupportShadowStorageDeletionPolicy exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowStorageDeletionPolicy, "function");
});

test("createDecisionSupportShadowDefaultOffPersistencePlan exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowDefaultOffPersistencePlan, "function");
});

test("assessDecisionSupportShadowCaptureRecordForStorage exists and is a function", () => {
  assert.equal(typeof assessDecisionSupportShadowCaptureRecordForStorage, "function");
});

test("runDecisionSupportShadowStoragePolicyEvaluation exists and is a function", () => {
  assert.equal(typeof runDecisionSupportShadowStoragePolicyEvaluation, "function");
});

test("summarizeDecisionSupportShadowStoragePolicyEvaluation exists and is a function", () => {
  assert.equal(typeof summarizeDecisionSupportShadowStoragePolicyEvaluation, "function");
});

test("explainDecisionSupportShadowStoragePolicy exists and is a function", () => {
  assert.equal(typeof explainDecisionSupportShadowStoragePolicy, "function");
});

// ─── Policy profile ─────────────────────────────────────────────────────────────────

test("policy profile is strict_default_off and fully default-off", () => {
  const profile = createDecisionSupportShadowStoragePolicyProfile();
  assert.equal(profile.profile, "strict_default_off");
  assert.equal(profile.persistenceDefaultEnabled, false);
  assert.equal(profile.requiresFeatureFlag, true);
  assert.equal(profile.featureFlagDefault, false);
  assert.equal(profile.storageAdapterImplemented, false);
  assert.equal(profile.dbMigrationImplemented, false);
  assert.equal(profile.supabaseWriteImplemented, false);
  assert.equal(profile.productionRouteChanged, false);
});

test("the default-off persistence plan carries the same core profile fields", () => {
  const plan = createDecisionSupportShadowDefaultOffPersistencePlan();
  assert.equal(plan.kind, "decision_support_shadow_storage_policy_plan");
  assert.equal(plan.profile, "strict_default_off");
  assert.equal(plan.persistenceDefaultEnabled, false);
  assert.equal(plan.requiresFeatureFlag, true);
  assert.equal(plan.requiredFeatureFlagName, "ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE");
  assert.equal(plan.featureFlagDefault, false);
  assert.equal(plan.storageAdapterImplemented, false);
  assert.equal(plan.dbMigrationImplemented, false);
  assert.equal(plan.supabaseWriteImplemented, false);
  assert.equal(plan.productionRouteChanged, false);
});

// ─── Field classification (fixture-driven) ──────────────────────────────────────────

for (const c of DECISION_SUPPORT_SHADOW_STORAGE_POLICY_FIELD_CASES) {
  test(`field classification ${c.id}: ${c.fieldName} -> ${c.expectedDecision}`, () => {
    const policy = classifyDecisionSupportShadowStorageField(c.fieldName);
    assert.equal(policy.fieldName, c.fieldName);
    assert.equal(policy.decision, c.expectedDecision, `case ${c.id}`);
    assert.equal(policy.risk, c.expectedRisk, `case ${c.id}`);
    assert.equal(policy.allowedInFuturePersistentStorage, c.expectedAllowedInFuturePersistentStorage, `case ${c.id}`);
    assert.equal(policy.allowedInTestMemoryOnly, c.expectedAllowedInTestMemoryOnly, `case ${c.id}`);
    assert.equal(policy.prohibitedAlways, c.expectedProhibitedAlways, `case ${c.id}`);
    assert.ok(Array.isArray(policy.requiredTransformations));
    assert.ok(policy.reason.length > 0);
  });
}

test("field classification corpus has between 20 and 40 cases", () => {
  assert.ok(DECISION_SUPPORT_SHADOW_STORAGE_POLICY_FIELD_CASES.length >= 20);
  assert.ok(DECISION_SUPPORT_SHADOW_STORAGE_POLICY_FIELD_CASES.length <= 40);
});

test("classifyDecisionSupportShadowStorageField is deterministic (same field name -> same policy)", () => {
  const a = classifyDecisionSupportShadowStorageField("rawInput");
  const b = classifyDecisionSupportShadowStorageField("rawInput");
  assert.deepEqual(a, b);
});

test("listDecisionSupportShadowStorageFieldPolicies returns every known field, allowed and prohibited", () => {
  const policies = listDecisionSupportShadowStorageFieldPolicies();
  assert.ok(policies.length > 20);
  const byName = new Map(policies.map((p) => [p.fieldName, p]));
  assert.equal(byName.get("inputHash").decision, "allowed_with_hashing");
  assert.equal(byName.get("candidateSummary").decision, "allowed_with_minimization");
  assert.equal(byName.get("safetySnapshot").decision, "allowed");
  assert.equal(byName.get("auditMetadata").decision, "allowed");
  assert.equal(byName.get("inputPreview").decision, "requires_explicit_policy_exception");
  assert.equal(byName.get("rawInput").decision, "prohibited");
  assert.equal(byName.get("fullDecisionCandidate").decision, "prohibited");
  assert.equal(byName.get("fullClarificationCandidate").decision, "prohibited");
  assert.equal(byName.get("userVisibleOutput").decision, "prohibited");
  assert.equal(byName.get("projectName").decision, "prohibited");
  assert.equal(byName.get("emailAddress").decision, "prohibited");
  assert.equal(byName.get("phoneNumber").decision, "prohibited");
  assert.equal(byName.get("rawEvidence").decision, "prohibited");
  assert.equal(byName.get("responseText").decision, "prohibited");
  assert.equal(byName.get("recentMessages").decision, "prohibited");
  assert.equal(byName.get("conversationMessages").decision, "prohibited");
});

// ─── Retention policy ────────────────────────────────────────────────────────────────

test("current retention policy is ephemeral_only with zero retention", () => {
  const retention = createDecisionSupportShadowStorageRetentionPolicy();
  assert.equal(retention.retentionMode, "ephemeral_only");
  assert.equal(retention.defaultRetentionDays, 0);
  assert.equal(retention.maximumRetentionDays, 0);
  assert.equal(retention.deletionRequired, true);
  assert.equal(retention.requiresDeletionAudit, true);
  assert.ok(Array.isArray(retention.notes));
  assert.ok(retention.notes.length > 0);
});

test("retention policy documents a future proposal without enabling it", () => {
  const retention = createDecisionSupportShadowStorageRetentionPolicy();
  const notesText = retention.notes.join(" ");
  assert.match(notesText, /7/);
  assert.match(notesText, /30/);
  assert.match(notesText, /feature flag/i);
});

// ─── Deletion policy ─────────────────────────────────────────────────────────────────

test("deletion policy is hard-delete-only with capture id/workspace/policy-version deletion", () => {
  const deletion = createDecisionSupportShadowStorageDeletionPolicy();
  assert.equal(deletion.hardDeleteRequired, true);
  assert.equal(deletion.softDeleteAllowed, false);
  assert.equal(deletion.deletionAuditMetadataOnly, true);
  assert.equal(deletion.deleteByCaptureIdRequired, true);
  assert.equal(deletion.deleteByWorkspaceRequired, true);
  assert.equal(deletion.deleteByPolicyVersionRequired, true);
  assert.equal(deletion.deleteRawPayloadIfEverIntroduced, true);
  assert.ok(deletion.notes.length > 0);
});

// ─── Default-off gates ───────────────────────────────────────────────────────────────

test("storage_default_off, no_db_migration, no_storage_adapter, no_supabase_write all pass", () => {
  const plan = createDecisionSupportShadowDefaultOffPersistencePlan();
  const byGate = new Map(plan.readinessGates.map((g) => [g.gate, g]));
  assert.equal(byGate.get("storage_default_off").passed, true);
  assert.equal(byGate.get("no_db_migration").passed, true);
  assert.equal(byGate.get("no_storage_adapter").passed, true);
  assert.equal(byGate.get("no_supabase_write").passed, true);
});

test("feature_flag_required exists as a named-but-unimplemented prerequisite", () => {
  const plan = createDecisionSupportShadowDefaultOffPersistencePlan();
  const gate = plan.readinessGates.find((g) => g.gate === "feature_flag_required");
  assert.ok(gate);
  assert.equal(gate.passed, false);
  assert.equal(gate.requiredBeforeStorageImplementation, true);
  assert.match(gate.reason, /ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE/);
});

test("tenant_isolation_required, access_control_required, policy_version_required exist as future prerequisites", () => {
  const plan = createDecisionSupportShadowDefaultOffPersistencePlan();
  for (const gateName of ["tenant_isolation_required", "access_control_required", "policy_version_required"]) {
    const gate = plan.readinessGates.find((g) => g.gate === gateName);
    assert.ok(gate, gateName);
    assert.equal(gate.passed, false, gateName);
    assert.equal(gate.requiredBeforeStorageImplementation, true, gateName);
  }
});

test("assumeFuturePrerequisitesSatisfied models a test-only scenario where the four warning gates pass", () => {
  const plan = createDecisionSupportShadowDefaultOffPersistencePlan({ assumeFuturePrerequisitesSatisfied: true });
  for (const gateName of ["tenant_isolation_required", "access_control_required", "feature_flag_required", "policy_version_required"]) {
    const gate = plan.readinessGates.find((g) => g.gate === gateName);
    assert.equal(gate.passed, true, gateName);
  }
});

test("plan always carries all 21 readiness gates", () => {
  const plan = createDecisionSupportShadowDefaultOffPersistencePlan();
  assert.equal(plan.readinessGates.length, 21);
});

test("retention_policy_defined and deletion_policy_defined gates pass, and the plan carries both policies", () => {
  const plan = createDecisionSupportShadowDefaultOffPersistencePlan();
  const byGate = new Map(plan.readinessGates.map((g) => [g.gate, g]));
  assert.equal(byGate.get("retention_policy_defined").passed, true);
  assert.equal(byGate.get("deletion_policy_defined").passed, true);
  assert.ok(plan.retentionPolicy);
  assert.ok(plan.deletionPolicy);
});

// ─── Capture record assessment: real Sprint 25R records ─────────────────────────────

function runSourceRun(fixtureCase) {
  return prepareDecisionSupportShadowModeRun(
    {
      id: fixtureCase.id,
      input: fixtureCase.input,
      availableContext: fixtureCase.availableContext,
      desiredFutureRoute: fixtureCase.desiredFutureRoute,
      architectureCategory: fixtureCase.architectureCategory,
      targetKind: fixtureCase.targetKind,
    },
    fixtureCase.shadowModeContext ?? {},
  );
}

test("assessing a real Sprint 25R dry_run capture record reports no raw/full/output violations", () => {
  const fixtureCase = DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES.find((c) => c.id === "cap-01");
  const run = runSourceRun(fixtureCase);
  const capture = captureDecisionSupportShadowRun(run, { mode: "dry_run" });
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({
    ...capture.record,
    dbWriteAttempted: capture.dbWriteAttempted,
    supabaseWriteAttempted: capture.supabaseWriteAttempted,
    shouldExecuteAction: capture.shouldExecuteAction,
    shouldSendEmail: capture.shouldSendEmail,
    shouldCreateTask: capture.shouldCreateTask,
    shouldWriteToDb: capture.shouldWriteToDb,
    shouldReturnCandidateToUser: capture.shouldReturnCandidateToUser,
    shouldPersistShadowResult: capture.shouldPersistShadowResult,
  });
  assert.equal(assessment.rawInputViolation, false);
  assert.equal(assessment.fullCandidateViolation, false);
  assert.equal(assessment.userVisibleOutputViolation, false);
  assert.equal(assessment.dbWriteViolation, false);
  assert.equal(assessment.supabaseWriteViolation, false);
  assert.equal(assessment.sideEffectViolation, false);
  assert.equal(assessment.storageReady, true);
});

test("assessing a real Sprint 25R test_only_in_memory capture record reports no raw/full/output violations", () => {
  const fixtureCase = DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES.find((c) => c.id === "cap-05");
  const run = runSourceRun(fixtureCase);
  const capture = captureDecisionSupportShadowRun(run, { mode: "test_only_in_memory", allowInMemoryCaptureForTests: true, policyAcknowledged: true });
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({
    ...capture.record,
    dbWriteAttempted: capture.dbWriteAttempted,
    supabaseWriteAttempted: capture.supabaseWriteAttempted,
    shouldExecuteAction: capture.shouldExecuteAction,
  });
  assert.equal(assessment.rawInputViolation, false);
  assert.equal(assessment.fullCandidateViolation, false);
  assert.equal(assessment.userVisibleOutputViolation, false);
  assert.equal(assessment.storageReady, true);
});

// ─── Capture record assessment: synthetic policy-violation records ──────────────────

test("synthetic record with rawInputRetained: true is a rawInputViolation", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({ captureStatus: "capture_preview_generated", rawInputRetained: true });
  assert.equal(assessment.rawInputViolation, true);
  assert.equal(assessment.storageReady, false);
});

test("synthetic record with a literal rawInput field is a rawInputViolation", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({ captureStatus: "capture_preview_generated", rawInput: "el texto crudo del usuario" });
  assert.equal(assessment.rawInputViolation, true);
  assert.equal(assessment.prohibitedFieldObservedCount > 0, true);
  assert.equal(assessment.storageReady, false);
});

test("synthetic record with fullDecisionCandidateRetained: true is a fullCandidateViolation", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({ captureStatus: "capture_preview_generated", fullDecisionCandidateRetained: true });
  assert.equal(assessment.fullCandidateViolation, true);
  assert.equal(assessment.storageReady, false);
});

test("synthetic record with a literal fullClarificationCandidate field is a fullCandidateViolation", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({ captureStatus: "capture_preview_generated", fullClarificationCandidate: { responseText: "..." } });
  assert.equal(assessment.fullCandidateViolation, true);
  assert.equal(assessment.storageReady, false);
});

test("synthetic record with userVisibleOutputRetained: true is a userVisibleOutputViolation", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({ captureStatus: "capture_preview_generated", userVisibleOutputRetained: true });
  assert.equal(assessment.userVisibleOutputViolation, true);
  assert.equal(assessment.storageReady, false);
});

test("synthetic record with dbWriteAttempted: true is a dbWriteViolation", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({ captureStatus: "capture_preview_generated", dbWriteAttempted: true });
  assert.equal(assessment.dbWriteViolation, true);
  assert.equal(assessment.storageReady, false);
});

test("synthetic record with supabaseWriteAttempted: true is a supabaseWriteViolation", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({ captureStatus: "capture_preview_generated", supabaseWriteAttempted: true });
  assert.equal(assessment.supabaseWriteViolation, true);
  assert.equal(assessment.storageReady, false);
});

test("synthetic record with shouldExecuteAction: true is a sideEffectViolation", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({ captureStatus: "capture_preview_generated", shouldExecuteAction: true });
  assert.equal(assessment.sideEffectViolation, true);
  assert.equal(assessment.storageReady, false);
});

test("a clean synthetic record (only allowed fields, no forced flags) is storage-ready", () => {
  const assessment = assessDecisionSupportShadowCaptureRecordForStorage({
    captureId: "capture-dry_run-x",
    sourceRunId: "x",
    captureStatus: "capture_preview_generated",
    mode: "dry_run",
    inputHash: "dssh_deadbeef",
    candidateSummary: { candidateKind: "none", status: "not_applicable", safetyPass: true },
  });
  assert.equal(assessment.storageReady, true);
  assert.equal(assessment.rawInputViolation, false);
  assert.equal(assessment.fullCandidateViolation, false);
});

// ─── Evaluation: Sprint 18R corpus via Sprint 25R capture harness ────────────────────

const EVAL_RESULTS = runDecisionSupportShadowStoragePolicyEvaluation(DECISION_CLARIFICATION_CASES);
const EVAL_SUMMARY = summarizeDecisionSupportShadowStoragePolicyEvaluation(EVAL_RESULTS, createDecisionSupportShadowDefaultOffPersistencePlan());

test("evaluator processes the Sprint 18R corpus via the Sprint 25R capture harness", () => {
  assert.equal(EVAL_RESULTS.length, DECISION_CLARIFICATION_CASES.length);
  assert.equal(EVAL_SUMMARY.totalCaptureRecords, DECISION_CLARIFICATION_CASES.length);
  assert.equal(EVAL_SUMMARY.totalCaptureRecords, 79);
});

test("assessedRecords equals totalCaptureRecords", () => {
  assert.equal(EVAL_SUMMARY.assessedRecords, EVAL_SUMMARY.totalCaptureRecords);
});

test("no violations anywhere in the Sprint 18R corpus evaluation", () => {
  assert.equal(EVAL_SUMMARY.rawInputViolationCount, 0);
  assert.equal(EVAL_SUMMARY.fullCandidateViolationCount, 0);
  assert.equal(EVAL_SUMMARY.userVisibleOutputViolationCount, 0);
  assert.equal(EVAL_SUMMARY.dbWriteViolationCount, 0);
  assert.equal(EVAL_SUMMARY.supabaseWriteViolationCount, 0);
  assert.equal(EVAL_SUMMARY.sideEffectViolationCount, 0);
  assert.equal(EVAL_SUMMARY.prohibitedFieldObservedCount, 0);
});

test("captureHarnessCleanRate is 100%", () => {
  assert.equal(EVAL_SUMMARY.captureHarnessCleanRate, 100);
});

test("retention/deletion policy defined for every assessed record", () => {
  assert.ok(EVAL_SUMMARY.retentionPolicyDefinedCount > 0);
  assert.ok(EVAL_SUMMARY.deletionPolicyDefinedCount > 0);
  assert.equal(EVAL_SUMMARY.retentionPolicyDefinedCount, EVAL_SUMMARY.totalCaptureRecords);
  assert.equal(EVAL_SUMMARY.deletionPolicyDefinedCount, EVAL_SUMMARY.totalCaptureRecords);
});

test("default evaluation reaches ready_for_storage_adapter_design and recommends Sprint 27R", () => {
  assert.equal(EVAL_SUMMARY.storageReadinessStatus, "ready_for_storage_adapter_design");
  assert.equal(EVAL_SUMMARY.recommendedNextSprint, "Sprint 27R — Shadow Capture Storage Adapter Plan");
  assert.ok(EVAL_SUMMARY.recommendation.length > 0);
});

test("blockingReadinessGateFailureCount is 0 by default", () => {
  assert.equal(EVAL_SUMMARY.blockingReadinessGateFailureCount, 0);
  assert.equal(EVAL_SUMMARY.readinessGatePassRate < 100, true, "warning-severity future-prerequisite gates keep the overall pass rate below 100%");
});

test("representative allowed/prohibited/exception field lists are non-empty and disjoint", () => {
  assert.ok(EVAL_SUMMARY.representativeAllowedFields.length > 0);
  assert.ok(EVAL_SUMMARY.representativeProhibitedFields.length > 0);
  assert.ok(EVAL_SUMMARY.representativePolicyExceptions.length > 0);
  const allowedSet = new Set(EVAL_SUMMARY.representativeAllowedFields);
  for (const f of EVAL_SUMMARY.representativeProhibitedFields) assert.equal(allowedSet.has(f), false);
});

test("weakRecordAssessments is empty when nothing violates the policy", () => {
  assert.deepEqual(EVAL_SUMMARY.weakRecordAssessments, []);
});

test("evaluation with a test-only-in-memory pass included also stays policy-clean", () => {
  const results = runDecisionSupportShadowStoragePolicyEvaluation(DECISION_CLARIFICATION_CASES, { includeTestMemoryPass: true });
  const summary = summarizeDecisionSupportShadowStoragePolicyEvaluation(results, createDecisionSupportShadowDefaultOffPersistencePlan({ mode: "test_memory_readiness_evaluation" }));
  assert.equal(results.length, DECISION_CLARIFICATION_CASES.length * 2);
  assert.equal(summary.rawInputViolationCount, 0);
  assert.equal(summary.sideEffectViolationCount, 0);
  assert.equal(summary.captureHarnessCleanRate, 100);
});

test("a corpus of synthetic policy-violation records is reported blocked_by_policy_violation", () => {
  const violatingRecords = [
    { captureStatus: "capture_preview_generated", rawInputRetained: true },
    { captureStatus: "capture_preview_generated", dbWriteAttempted: true },
  ];
  const results = runDecisionSupportShadowStoragePolicyEvaluation(violatingRecords);
  const summary = summarizeDecisionSupportShadowStoragePolicyEvaluation(results, createDecisionSupportShadowDefaultOffPersistencePlan());
  assert.equal(summary.storageReadinessStatus, "blocked_by_policy_violation");
  assert.ok(summary.rawInputViolationCount + summary.dbWriteViolationCount > 0);
});

// ─── No real storage / no real DB / no real feature flag ────────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts", import.meta.url),
    "utf8",
  );
  const imports = importLines(source);
  assert.doesNotMatch(imports, /brainRouter/);
  assert.doesNotMatch(imports, /responseComposer/);
  assert.doesNotMatch(imports, /conversationalBrainGateway/);
  assert.doesNotMatch(imports, /handlers\//);
  assert.doesNotMatch(imports, /command-center\/chat/);
  assert.doesNotMatch(imports, /supabase/i);
  assert.doesNotMatch(imports, /nodemailer/i);
  assert.doesNotMatch(source, /\bfetch\(/);
});

test("this module never imports intentCompatibilityAdapter.ts, intentClassifier.rules.ts, or intent-patterns.ts", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts", import.meta.url),
    "utf8",
  );
  const imports = importLines(source);
  assert.doesNotMatch(imports, /intentCompatibilityAdapter/);
  assert.doesNotMatch(imports, /intentClassifier\.rules/);
  assert.doesNotMatch(imports, /intent-patterns/);
});

test("no feature flag is ever activated by this sprint (source has no feature-flag/env read)", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /growthbook/i);
});

test("no database/migration/storage-adapter vocabulary appears as executable code (only as string literals/docs)", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /createClient\(/);
  assert.doesNotMatch(source, /\.from\(["'`]\w+["'`]\)\.(insert|upsert|update|delete)/);
  assert.doesNotMatch(source, /CREATE TABLE/i);
  assert.doesNotMatch(source, /ALTER TABLE/i);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportShadowCaptureStoragePolicy/);
});

// ─── Explain ──────────────────────────────────────────────────────────────────────

test("explainDecisionSupportShadowStoragePolicy documents purpose, non-goals, policy, retention/deletion, gates, and the Sprint 27R path", () => {
  const explain = explainDecisionSupportShadowStoragePolicy();
  assert.ok(explain.purpose.length > 0);
  assert.ok(explain.nonGoals.length > 0);
  assert.ok(explain.policyProfile.length > 0);
  assert.ok(explain.fieldClassification.length > 0);
  assert.ok(explain.prohibitedFields.length > 0);
  assert.ok(explain.allowedFields.length > 0);
  assert.ok(explain.exceptionFields.length > 0);
  assert.ok(explain.retentionPolicy.length > 0);
  assert.ok(explain.deletionPolicy.length > 0);
  assert.ok(explain.defaultOffFeatureFlagPlan.length > 0);
  assert.ok(explain.readinessGates.length > 0);
  assert.ok(explain.whyDbIsNotCreated.length > 0);
  assert.ok(explain.whyMigrationIsNotCreated.length > 0);
  assert.ok(explain.whyStorageAdapterIsNotCreated.length > 0);
  assert.ok(explain.expectedSprint27Path.length > 0);
});

test("explain's prohibited fields include the spec's explicit prohibited list", () => {
  const explain = explainDecisionSupportShadowStoragePolicy();
  for (const f of ["rawInput", "fullDecisionCandidate", "fullClarificationCandidate", "userVisibleOutput", "emailAddress", "phoneNumber", "projectName", "conversationMessages", "recentMessages", "responseText"]) {
    assert.ok(explain.prohibitedFields.includes(f), f);
  }
});

// ─── Regression: golden evaluation + prior sprints unchanged ────────────────────

test("this sprint does not change the golden evaluation's global compatibilityRate", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.equal(report.overall.compatibilityRate, 72.5, `expected global compatibilityRate to stay 72.5, got ${report.overall.compatibilityRate}`);
});

test("Sprint 17R boundary review metrics are unchanged by this sprint", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(summary.policyAlignedRate, 82.9);
  assert.equal(summary.currentSystemAcceptableRate, 84.3);
});

test("Sprint 18R architecture review metrics are unchanged by this sprint", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.currentSafeMappingRate, 84.8);
  assert.equal(summary.futureRouteAlreadySupportedRate, 84.8);
  assert.equal(summary.requiresNewHandlerCount, 45);
  assert.equal(summary.requiresClarificationCount, 24);
});

test("Sprint 19R candidate handler behavior is unchanged by this sprint", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES.slice(0, 5)) {
    assert.doesNotThrow(() => handleDecisionSupportCandidate({ input: c.input }));
  }
});

test("Sprint 20R/21R shadow mapping evaluation metrics are unchanged by this sprint", () => {
  const results = runDecisionSupportShadowMappingEvaluation(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionSupportShadowMappingEvaluation(results);
  assert.equal(summary.candidateHandlerSafeRate, 100);
  assert.equal(summary.shadowRoutableRate, 40);
  assert.equal(summary.unsafeClassifierCollisionCount, 5);
  assert.equal(summary.recommendedIntegrationMode, "do_not_integrate");
});

test("Sprint 22R clarification response strategy metrics are unchanged by this sprint", () => {
  const cases = [
    ...toDecisionClarificationEvaluationCases(DECISION_CLARIFICATION_CASES),
    ...toGeneralPmBoundaryEvaluationCases(GENERAL_PM_ADVICE_BOUNDARY_CASES),
    ...toCustomFixtureEvaluationCases(CLARIFICATION_RESPONSE_CASES),
  ];
  const results = runClarificationResponseEvaluation(cases);
  const summary = summarizeClarificationResponseEvaluation(results);
  assert.equal(summary.evaluatedClarificationCases, 34);
  assert.equal(summary.acceptableResponseRate, 100);
  assert.equal(summary.safetyPassRate, 100);
  assert.equal(summary.routeOptionsCoverageRate, 100);
  assert.equal(summary.overQuestioningCount, 0);
});

test("Sprint 23R adapter mapping plan metrics are unchanged by this sprint", () => {
  const results = runDecisionSupportAdapterMappingPlan(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionSupportAdapterMappingPlan(results);
  assert.equal(summary.recommendedSprint24Strategy, "hybrid_shadow_then_clarify");
  assert.equal(summary.recommendedNextSprint, "Sprint 24R — Decision Support Shadow Mode Prep");
  const hybrid = summary.strategySummaries.hybrid_shadow_then_clarify;
  assert.equal(hybrid.safeOutcomeRate, 100);
  assert.equal(hybrid.riskyOutcomeCount, 0);
  assert.equal(hybrid.criticalRiskCount, 0);
});

test("Sprint 24R shadow mode prep metrics are unchanged by this sprint", () => {
  const results = runDecisionSupportShadowModePrepEvaluation(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionSupportShadowModePrepEvaluation(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.shadowEligibleCount, 69);
  assert.equal(summary.decisionCandidateGeneratedCount, 18);
  assert.equal(summary.clarificationCandidateGeneratedCount, 51);
  assert.equal(summary.existingRoutePreservedCount, 10);
  assert.equal(summary.blockedBySafetyGateCount, 0);
  assert.equal(summary.acceptableShadowPrepRunRate, 100);
  assert.equal(summary.allBlockingGatesPassedRate, 100);
});

test("Sprint 25R shadow capture harness metrics are unchanged by this sprint", () => {
  const dryRunResults = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES);
  const dryRunSummary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(dryRunResults);
  assert.equal(dryRunSummary.totalCases, 79);
  assert.equal(dryRunSummary.acceptableCaptureRate, 100);
  assert.equal(dryRunSummary.allBlockingGatesPassedRate, 100);
  assert.equal(dryRunSummary.rawInputRetainedCount, 0);
  assert.equal(dryRunSummary.fullDecisionCandidateRetainedCount, 0);
  assert.equal(dryRunSummary.fullClarificationCandidateRetainedCount, 0);
  assert.equal(dryRunSummary.userVisibleOutputRetainedCount, 0);
  assert.equal(dryRunSummary.dbWriteAttemptedCount, 0);
  assert.equal(dryRunSummary.supabaseWriteAttemptedCount, 0);
  assert.equal(dryRunSummary.existingRouteCaptureCount, 10);
});

test("Sprint 25R shadow capture harness fixture corpus (blocking-gate cases) is unchanged by this sprint", () => {
  let blockedCount = 0;
  for (const c of DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES) {
    const run = runSourceRun(c);
    const context = { ...(c.contextOverrides ?? {}), mode: c.contextOverrides?.mode ?? c.mode };
    const capture = captureDecisionSupportShadowRun(run, context);
    if (capture.captureStatus === "capture_blocked_by_gate") blockedCount += 1;
  }
  assert.equal(blockedCount, 12);
});
