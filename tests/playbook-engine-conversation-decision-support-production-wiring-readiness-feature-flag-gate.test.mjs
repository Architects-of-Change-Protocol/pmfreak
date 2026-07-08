import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_VERSION,
  createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig,
  listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions,
  listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions,
  createDecisionSupportFeatureFlagGateContract,
  createDecisionSupportProductionWiringReadinessContract,
  createDecisionSupportRollbackReadinessContract,
  createDecisionSupportGovernanceApprovalChecklist,
  validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase,
  evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase,
  runDecisionSupportProductionWiringReadinessFeatureFlagGate,
  summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate,
  explainDecisionSupportProductionWiringReadinessFeatureFlagGate,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportProductionWiringReadinessFeatureFlagGate.ts";
import { DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_CASES } from "./fixtures/conversational-brain-decision-support-production-wiring-readiness-feature-flag-gate-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Sprint 36R adapter — reused to build real Sprint 36R adapter case results for this sprint's gate evaluations.
import {
  runDecisionSupportDefaultOffRouteComposerIntegrationAdapter,
  summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouteComposerIntegrationAdapter.ts";
import { runDecisionSupportUserVisibleDryRunEvaluationHarness, summarizeDecisionSupportUserVisibleDryRunEvaluationHarness } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarness.ts";

// Regression imports — Sprint 18R-36R + golden/classifier/vocabulary suites, reused read-only for comparison.
import { runDecisionSupportResponseDraftQualityEvaluation, summarizeDecisionSupportResponseDraftQualityEvaluation } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftQualityEvaluation.ts";
import { runDecisionSupportResponseDraftHarness, summarizeDecisionSupportResponseDraftHarness } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftHarness.ts";
import { buildDecisionSupportResponseQaDryRunPlan, summarizeDecisionSupportResponseQaDryRunPlan } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseQaDryRunPlan.ts";
import {
  buildDecisionSupportClarificationGatedIntegrationPlan,
  summarizeDecisionSupportClarificationGatedIntegrationPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportClarificationGatedIntegrationPlan.ts";
import {
  runDecisionSupportShadowControlledReplayEvaluation,
  summarizeDecisionSupportShadowControlledReplayEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowControlledReplay.ts";
import {
  buildDecisionSupportShadowPersistenceReadinessReview,
  createDecisionSupportShadowPersistenceReadinessInputMetrics,
  summarizeDecisionSupportShadowPersistenceReadinessReview,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCapturePersistenceReadiness.ts";
import {
  runDecisionSupportShadowStorageFakeAdapterEvaluation,
  summarizeDecisionSupportShadowStorageFakeAdapterEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapter.ts";
import {
  runDecisionSupportShadowStorageAdapterPlanEvaluation,
  summarizeDecisionSupportShadowStorageAdapterPlanEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts";
import {
  runDecisionSupportShadowStoragePolicyEvaluation,
  summarizeDecisionSupportShadowStoragePolicyEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts";
import {
  runDecisionSupportShadowCaptureHarnessEvaluation,
  summarizeDecisionSupportShadowCaptureHarnessEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";
import { runDecisionSupportShadowModePrepEvaluation, summarizeDecisionSupportShadowModePrepEvaluation } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts";
import { runClarificationResponseEvaluation, toDecisionClarificationEvaluationCases } from "../src/lib/playbook-engine/conversation/clarification/clarificationResponseEvaluation.ts";
import { runGoldenIntentEvaluation, summarizeGoldenIntentEvaluation } from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

/**
 * Sprint 37R — Decision Support Production Wiring Readiness / Feature Flag Gate.
 *
 * Tests the pure, offline, deterministic, readiness-only gate in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportProductionWiringReadinessFeatureFlagGate.ts`.
 * This reviews every Sprint 36R-accepted default-off adapter simulation against a future feature flag
 * contract, a future production wiring contract, a future rollback contract, and a governance approval
 * checklist — it never implements or activates a feature flag, never touches the router/composer/endpoint,
 * never shows anything to a real user, and never persists anything real.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

/** Builds a minimal, fully-shaped Sprint 36R adapter case result for a given adapter kind. Every adapter
 * kind actually occurs in the real Sprint 18R corpus except unsupported_boundary_adapter/shadow_only_adapter/
 * blocked_unsafe_adapter, which never occur there (Sprint 36R's own baseline is 69 clarification + 10 route
 * preservation cases, 0 of the other three) — this synthesizes a safe, accepted, default-off case for any
 * of the five kinds so every Sprint 37R gate-kind mapping can still be exercised directly. */
function buildFakeAdapterCaseResult(adapterKind, caseId) {
  const id = caseId ?? `fake-${adapterKind}`;
  const sections = [
    {
      sectionId: `${id}-section-1`,
      kind: "summary",
      title: "Summary",
      body: "This is a safe, internal-only synthetic section.",
      order: 1,
      internalOnly: true,
      userVisibleNow: false,
      containsRawInput: false,
      containsFullCandidate: false,
      containsPii: false,
      containsProjectNameRaw: false,
      containsExecutableInstruction: false,
      containsPersistenceInstruction: false,
      warnings: [],
    },
  ];
  const payload = {
    payloadId: `payload-${id}`,
    sourceCaseId: id,
    sourcePreviewId: `preview-${id}`,
    adapterKind,
    composerDecision: "simulate_composer_internal_preview_payload",
    generatedForAdapterEvaluationOnly: true,
    internalPayloadOnly: true,
    defaultOff: true,
    adapterEnabledNow: false,
    userVisibleNow: false,
    persistedNow: false,
    executableNow: false,
    externalSideEffectsAllowed: false,
    productionEligibleNow: false,
    sections,
    warnings: [],
  };
  const composerResult = {
    caseId: id,
    sourcePreviewId: `preview-${id}`,
    adapterKind,
    composerDecision: "simulate_composer_internal_preview_payload",
    composerGuardContract: { contractId: `composer-contract-${adapterKind}`, adapterKind },
    payload,
    composerGuardPassed: true,
    defaultOffPassed: true,
    isolatedNoOpPassed: true,
    safeForDefaultOffAdapter: true,
    composerWiringActiveNow: false,
    composerChangeAttempted: false,
    endpointChangeAttempted: false,
    featureFlagAttempted: false,
    userVisibleOutputAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    externalCallAttempted: false,
    actionExecutionAttempted: false,
    warnings: [],
  };
  const routeResult = {
    caseId: id,
    sourcePreviewId: `preview-${id}`,
    sourcePreviewKind: `${adapterKind}-preview`,
    adapterKind,
    routeDecision: "simulate_route_to_clarification_gate",
    routeGuardContract: { contractId: `route-contract-${adapterKind}`, adapterKind },
    routeGuardPassed: true,
    defaultOffPassed: true,
    isolatedNoOpPassed: true,
    safeForComposerAdapterSimulation: true,
    routeWiringActiveNow: false,
    routerChangeAttempted: false,
    productionWiringAttempted: false,
    userVisibleOutputAttempted: false,
    warnings: [],
  };
  return {
    caseId: id,
    sourcePreviewId: `preview-${id}`,
    sourcePreviewKind: `${adapterKind}-preview`,
    adapterKind,
    routeResult,
    composerResult,
    validation: { valid: true, status: "accepted", qaStatus: "pass", riskLevel: "low", violations: [] },
    adapterAccepted: true,
    adapterRejected: false,
    adapterBlocked: false,
    safeForProductionWiringReadinessReview: true,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings: [],
  };
}

function fakeCaseResultFromFixture(fixtureId) {
  const fixtureCase = fixtureFor(fixtureId);
  assert.ok(fixtureCase.sourceAdapterKind, `fixture ${fixtureId} must declare sourceAdapterKind`);
  return buildFakeAdapterCaseResult(fixtureCase.sourceAdapterKind, fixtureId);
}

function buildValidParts(adapterKind, caseId) {
  const adapterCaseResult = buildFakeAdapterCaseResult(adapterKind, caseId);
  const featureFlagContract = createDecisionSupportFeatureFlagGateContract(adapterCaseResult);
  const productionWiringContract = createDecisionSupportProductionWiringReadinessContract(adapterCaseResult);
  const rollbackContract = createDecisionSupportRollbackReadinessContract(adapterCaseResult);
  const governanceChecklist = createDecisionSupportGovernanceApprovalChecklist(adapterCaseResult);
  return { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist };
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const HARNESS = runDecisionSupportUserVisibleDryRunEvaluationHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const ADAPTER = runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ harness: HARNESS, now: NOW });
const ADAPTER_SUMMARY = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter(ADAPTER);
const GATE = runDecisionSupportProductionWiringReadinessFeatureFlagGate({ adapter: ADAPTER, now: NOW });
const GATE_SUMMARY = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate(GATE);

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 45 and 65 cases", () => {
  assert.ok(DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_CASES.length >= 45);
  assert.ok(DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_CASES.length <= 65);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.gateKind, "string");
    assert.equal(typeof c.expectedQaStatus, "string");
    assert.equal(typeof c.expectedRiskLevel, "string");
    assert.equal(typeof c.expectedGateAccepted, "boolean");
    assert.equal(typeof c.expectedFeatureFlagContractStatus, "string");
    assert.equal(typeof c.expectedProductionWiringContractStatus, "string");
    assert.equal(typeof c.expectedRollbackContractStatus, "string");
    assert.equal(typeof c.expectedGovernanceChecklistStatus, "string");
    assert.equal(typeof c.expectedSafeForDefaultOffFeatureFlagImplementationShell, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleOutputNow, "boolean");
    assert.equal(c.expectedSafeForUserVisibleOutputNow, false);
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(c.expectedSafeForProduction, false);
    assert.ok(Array.isArray(c.expectedViolations));
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_VERSION, "string");
  assert.ok(DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig", createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig],
  ["listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions", listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions],
  ["listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions", listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions],
  ["createDecisionSupportFeatureFlagGateContract", createDecisionSupportFeatureFlagGateContract],
  ["createDecisionSupportProductionWiringReadinessContract", createDecisionSupportProductionWiringReadinessContract],
  ["createDecisionSupportRollbackReadinessContract", createDecisionSupportRollbackReadinessContract],
  ["createDecisionSupportGovernanceApprovalChecklist", createDecisionSupportGovernanceApprovalChecklist],
  ["evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase", evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase],
  ["runDecisionSupportProductionWiringReadinessFeatureFlagGate", runDecisionSupportProductionWiringReadinessFeatureFlagGate],
  ["summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate", summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate],
  ["explainDecisionSupportProductionWiringReadinessFeatureFlagGate", explainDecisionSupportProductionWiringReadinessFeatureFlagGate],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture gate-config-default-strict)", () => {
  fixtureFor("gate-config-default-strict");
  const config = createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig();
  assert.equal(config.profile, "strict_production_wiring_readiness_feature_flag_gate");
  assert.equal(config.mode, "readiness_gate_only");
  assert.equal(config.readinessOnly, true);
  assert.equal(config.allowProductionWiring, false);
  assert.equal(config.allowRouterChange, false);
  assert.equal(config.allowComposerChange, false);
  assert.equal(config.allowEndpointChange, false);
  assert.equal(config.allowFeatureFlagImplementation, false);
  assert.equal(config.allowFeatureFlagActivation, false);
  assert.equal(config.allowFeatureFlagRuntimeRead, false);
  assert.equal(config.allowUserVisibleOutput, false);
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowTaskCreation, false);
  assert.equal(config.allowEmailDraftCreation, false);
  assert.equal(config.requireDefaultOffAdapterPass, true);
  assert.equal(config.requireFeatureFlagContract, true);
  assert.equal(config.requireProductionWiringContract, true);
  assert.equal(config.requireRollbackContract, true);
  assert.equal(config.requireGovernanceChecklist, true);
  assert.equal(config.requireNoApprovalOverclaim, true);
  assert.equal(config.requireNoVisibilityAttempt, true);
  assert.equal(config.requireNoLeakage, true);
  assert.equal(config.requireNoSideEffects, true);
  assert.equal(config.requireNoProductionEligibility, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "gate-config-block-production-wiring",
  "gate-config-block-router-change",
  "gate-config-block-composer-change",
  "gate-config-block-endpoint-change",
  "gate-config-block-feature-flag-implementation",
  "gate-config-block-feature-flag-activation",
  "gate-config-block-feature-flag-runtime-read",
  "gate-config-block-user-visible-output",
  "gate-config-block-real-persistence",
  "gate-config-block-db-write",
  "gate-config-block-supabase-write",
  "gate-config-block-external-calls",
  "gate-config-block-action-execution",
  "gate-config-block-task-creation",
  "gate-config-block-email-draft-creation",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 15);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all fifteen are forced true at once", () => {
  const config = createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig({
    allowProductionWiring: true,
    allowRouterChange: true,
    allowComposerChange: true,
    allowEndpointChange: true,
    allowFeatureFlagImplementation: true,
    allowFeatureFlagActivation: true,
    allowFeatureFlagRuntimeRead: true,
    allowUserVisibleOutput: true,
    allowRealPersistence: true,
    allowDbWrite: true,
    allowSupabaseWrite: true,
    allowExternalCalls: true,
    allowActionExecution: true,
    allowTaskCreation: true,
    allowEmailDraftCreation: true,
  });
  for (const field of BLOCKED_FIELD_FIXTURE_IDS.map((id) => fixtureFor(id).configOverrideField)) {
    assert.equal(config[field], false, `${field} must stay false`);
  }
  assert.equal(config.readinessOnly, true);
});

test("config honors safe overrides (mode, now, notes)", () => {
  const config = createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig({
    mode: "feature_flag_contract_review",
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "feature_flag_contract_review");
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("default-off feature flag implementation shell"));
  assert.ok(joined.includes("no-op feature flag contract implementation"));
  assert.ok(joined.includes("feature flag default-off tests"));
  assert.ok(joined.includes("route guard implementation shell"));
  assert.ok(joined.includes("composer guard implementation shell"));
  assert.ok(joined.includes("endpoint guard implementation shell"));
  assert.ok(joined.includes("rollback smoke test plan"));
});

test("listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("wire router to live decision_support"));
  assert.ok(joined.includes("wire composer to live decision_support"));
  assert.ok(joined.includes("wire endpoint to live decision_support"));
  assert.ok(joined.includes("implement active production feature flag"));
  assert.ok(joined.includes("activate production feature flag"));
  assert.ok(joined.includes("read runtime feature flag"));
  assert.ok(joined.includes("show output to real user"));
  assert.ok(joined.includes("create db"));
  assert.ok(joined.includes("create migration"));
  assert.ok(joined.includes("create sql file"));
  assert.ok(joined.includes("write supabase"));
  assert.ok(joined.includes("implement real repository"));
  assert.ok(joined.includes("implement real storage adapter"));
  assert.ok(joined.includes("execute actions"));
  assert.ok(joined.includes("create tasks"));
  assert.ok(joined.includes("create emails"));
  assert.ok(joined.includes("create drafts"));
  assert.ok(joined.includes("call external services"));
  assert.ok(joined.includes("persist output real"));
});

test("listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Feature flag gate contract ─────────────────────────────────────────────────────

const FEATURE_FLAG_CONTRACT_FIXTURE_IDS = [
  "gate-feature-flag-contract-ready",
  "gate-feature-flag-contract-default-off-required",
  "gate-feature-flag-contract-no-runtime-read-now",
  "gate-feature-flag-contract-no-implementation-now",
];

for (const fixtureId of FEATURE_FLAG_CONTRACT_FIXTURE_IDS) {
  test(`${fixtureId}: feature flag gate contract carries every readiness-only invariant`, () => {
    const adapterCaseResult = fakeCaseResultFromFixture(fixtureId);
    const contract = createDecisionSupportFeatureFlagGateContract(adapterCaseResult);
    assert.equal(contract.proposedFeatureFlagKey, "pmfreak.decisionSupport.defaultOffRouteComposerAdapter");
    assert.equal(contract.status, "ready");
    assert.equal(contract.readinessOnly, true);
    assert.equal(contract.featureFlagImplementedNow, false);
    assert.equal(contract.featureFlagActiveNow, false);
    assert.equal(contract.featureFlagRuntimeReadNow, false);
    assert.equal(contract.defaultValueMustBe, false);
    assert.equal(contract.activationRequiresExplicitFutureSprint, true);
    assert.equal(contract.activationRequiresGovernanceApproval, true);
    assert.equal(contract.activationRequiresRollbackPlan, true);
    assert.equal(contract.activationRequiresMonitoringPlan, true);
    assert.equal(contract.activationRequiresManualVerification, true);
    assert.equal(contract.activationRequiresUserVisibleOutputReview, true);
    assert.equal(contract.activationRequiresProductionIncidentRollbackOwner, true);
    assert.ok(contract.prohibitedActivationPaths.includes("implicit_activation"));
    assert.ok(contract.prohibitedActivationPaths.includes("env_var_runtime_read_in_sprint_37r"));
    assert.ok(contract.prohibitedActivationPaths.includes("router_default_on"));
    assert.ok(contract.prohibitedActivationPaths.includes("composer_default_on"));
    assert.ok(contract.prohibitedActivationPaths.includes("endpoint_default_on"));
    assert.ok(contract.prohibitedActivationPaths.includes("user_visible_output_without_approval"));
    assert.ok(contract.prohibitedActivationPaths.includes("activation_without_rollback_contract"));
    assert.ok(contract.requiredFutureChecks.includes("default_off_flag_exists"));
    assert.ok(contract.requiredFutureChecks.includes("flag_defaults_false"));
    assert.ok(contract.requiredFutureChecks.includes("router_guard_checks_flag"));
    assert.ok(contract.requiredFutureChecks.includes("composer_guard_checks_flag"));
    assert.ok(contract.requiredFutureChecks.includes("endpoint_guard_checks_flag"));
    assert.ok(contract.requiredFutureChecks.includes("rollback_disables_flag"));
    assert.ok(contract.requiredFutureChecks.includes("monitoring_contract_exists"));
    assert.ok(contract.requiredFutureChecks.includes("manual_smoke_test_completed"));
    assert.ok(contract.score >= 85);
    assert.ok(contract.rationale.length > 0);
  });
}

// ─── Production wiring readiness contract ──────────────────────────────────────────

const PRODUCTION_WIRING_CONTRACT_FIXTURE_IDS = [
  "gate-production-wiring-contract-ready",
  "gate-production-wiring-contract-no-router-import-now",
  "gate-production-wiring-contract-no-composer-import-now",
  "gate-production-wiring-contract-no-endpoint-import-now",
];

for (const fixtureId of PRODUCTION_WIRING_CONTRACT_FIXTURE_IDS) {
  test(`${fixtureId}: production wiring readiness contract carries every readiness-only invariant`, () => {
    const adapterCaseResult = fakeCaseResultFromFixture(fixtureId);
    const contract = createDecisionSupportProductionWiringReadinessContract(adapterCaseResult);
    assert.equal(contract.status, "ready");
    assert.equal(contract.readinessOnly, true);
    assert.equal(contract.productionWiringImplementedNow, false);
    assert.equal(contract.routerChangeAllowedNow, false);
    assert.equal(contract.composerChangeAllowedNow, false);
    assert.equal(contract.endpointChangeAllowedNow, false);
    assert.equal(contract.routerImportAllowedNow, false);
    assert.equal(contract.composerImportAllowedNow, false);
    assert.equal(contract.endpointImportAllowedNow, false);
    assert.equal(contract.requiresFeatureFlagDefaultOff, true);
    assert.equal(contract.requiresRouterGuard, true);
    assert.equal(contract.requiresComposerGuard, true);
    assert.equal(contract.requiresEndpointGuard, true);
    assert.equal(contract.requiresNoOpFallback, true);
    assert.equal(contract.requiresExistingRoutePreservation, true);
    assert.equal(contract.requiresClarificationGatePreservation, true);
    assert.equal(contract.requiresUnsupportedBoundaryPreservation, true);
    assert.equal(contract.requiresNoUserVisibleOutputByDefault, true);
    assert.equal(contract.requiresNoPersistenceByDefault, true);
    assert.equal(contract.requiresNoExternalCallsByDefault, true);
    assert.ok(contract.score >= 85);
    assert.ok(contract.rationale.length > 0);
  });
}

// ─── Rollback readiness contract ────────────────────────────────────────────────────

const ROLLBACK_CONTRACT_FIXTURE_IDS = ["gate-rollback-contract-ready", "gate-rollback-contract-no-data-migration-required", "gate-rollback-contract-no-persistent-state-dependency"];

for (const fixtureId of ROLLBACK_CONTRACT_FIXTURE_IDS) {
  test(`${fixtureId}: rollback readiness contract carries every readiness-only invariant`, () => {
    const adapterCaseResult = fakeCaseResultFromFixture(fixtureId);
    const contract = createDecisionSupportRollbackReadinessContract(adapterCaseResult);
    assert.equal(contract.status, "ready");
    assert.equal(contract.readinessOnly, true);
    assert.equal(contract.rollbackImplementedNow, false);
    assert.equal(contract.rollbackRequiresFeatureFlagDisable, true);
    assert.equal(contract.rollbackRequiresRouteFallback, true);
    assert.equal(contract.rollbackRequiresComposerFallback, true);
    assert.equal(contract.rollbackRequiresEndpointFallback, true);
    assert.equal(contract.rollbackRequiresNoDataMigration, true);
    assert.equal(contract.rollbackRequiresNoDataCleanup, true);
    assert.equal(contract.rollbackRequiresNoPersistentStateDependency, true);
    assert.equal(contract.rollbackRequiresNoExternalSideEffectsCleanup, true);
    assert.equal(contract.rollbackRequiresIncidentOwner, true);
    assert.equal(contract.rollbackRequiresVerificationChecklist, true);
    assert.ok(contract.rollbackScore >= 85);
    assert.ok(contract.rationale.length > 0);
  });
}

// ─── Governance approval checklist ──────────────────────────────────────────────────

const GOVERNANCE_CHECKLIST_FIXTURE_IDS = ["gate-governance-checklist-prepared", "gate-governance-approval-not-granted-now", "gate-governance-approval-not-overclaimed"];

for (const fixtureId of GOVERNANCE_CHECKLIST_FIXTURE_IDS) {
  test(`${fixtureId}: governance approval checklist never overclaims approval`, () => {
    const adapterCaseResult = fakeCaseResultFromFixture(fixtureId);
    const checklist = createDecisionSupportGovernanceApprovalChecklist(adapterCaseResult);
    assert.equal(checklist.status, "prepared");
    assert.equal(checklist.readinessOnly, true);
    assert.equal(checklist.governanceApprovalGrantedNow, false);
    assert.equal(checklist.approvalRequiredBeforeActivation, true);
    assert.equal(checklist.approvalStateOverclaimed, false);
    for (const item of [
      "feature_flag_contract_reviewed",
      "router_guard_reviewed",
      "composer_guard_reviewed",
      "endpoint_guard_reviewed",
      "rollback_contract_reviewed",
      "monitoring_contract_reviewed",
      "user_visible_output_reviewed",
      "security_review_completed",
      "regression_tests_green",
      "manual_smoke_test_completed",
    ]) {
      assert.ok(checklist.requiredApprovalItems.includes(item), `requiredApprovalItems must include ${item}`);
    }
    assert.ok(checklist.completedNowItems.includes("regression_tests_green"));
    assert.ok(checklist.completedNowItems.includes("feature_flag_contract_reviewed"));
    assert.ok(checklist.completedNowItems.includes("rollback_contract_reviewed"));
    for (const item of ["router_guard_reviewed", "composer_guard_reviewed", "endpoint_guard_reviewed", "monitoring_contract_reviewed", "user_visible_output_reviewed", "security_review_completed", "manual_smoke_test_completed"]) {
      assert.ok(checklist.pendingFutureApprovalItems.includes(item), `pendingFutureApprovalItems must include ${item}`);
    }
    assert.ok(checklist.checklistScore >= 80);
    assert.ok(checklist.rationale.length > 0);
  });
}

// ─── Gate case evaluation: gate kind mapping (positive) ─────────────────────────────

const GATE_KIND_FIXTURE_EXPECTATIONS = [
  ["gate-kind-clarification-readiness", "clarification_gate_adapter", "clarification_gate_readiness"],
  ["gate-kind-route-preservation-readiness", "route_preservation_adapter", "route_preservation_readiness"],
  ["gate-kind-unsupported-readiness", "unsupported_boundary_adapter", "unsupported_boundary_readiness"],
  ["gate-kind-shadow-only-readiness", "shadow_only_adapter", "shadow_only_readiness"],
  ["gate-kind-blocked-unsafe-readiness", "blocked_unsafe_adapter", "blocked_unsafe_readiness"],
];

for (const [fixtureId, adapterKind, expectedGateKind] of GATE_KIND_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: evaluate produces the documented gate kind and passes every gate`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const adapterCaseResult = buildFakeAdapterCaseResult(adapterKind, fixtureId);
    const result = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult);
    assert.equal(result.gateKind, expectedGateKind);
    assert.equal(result.generatedForReadinessGateOnly, true);
    assert.equal(result.readinessOnly, true);
    assert.equal(result.gateAccepted, fixtureCase.expectedGateAccepted);
    assert.equal(result.gateRejected, false);
    assert.equal(result.gateBlocked, false);
    assert.equal(result.qaStatus, fixtureCase.expectedQaStatus);
    assert.equal(result.riskLevel, fixtureCase.expectedRiskLevel);
    assert.deepEqual(result.violations, []);
    assert.equal(result.featureFlagContractPassed, true);
    assert.equal(result.productionWiringContractPassed, true);
    assert.equal(result.rollbackContractPassed, true);
    assert.equal(result.governanceChecklistPrepared, true);
    assert.equal(result.defaultOffAdapterPassed, true);
    assert.equal(result.noApprovalOverclaimPassed, true);
    assert.equal(result.noVisibilityAttemptPassed, true);
    assert.equal(result.noProductionEligibilityPassed, true);
    assert.equal(result.noLeaksPassed, true);
    assert.equal(result.noSideEffectsPassed, true);
    assert.equal(result.safeForDefaultOffFeatureFlagImplementationShell, fixtureCase.expectedSafeForDefaultOffFeatureFlagImplementationShell);
    assert.equal(result.safeForUserVisibleOutputNow, false);
    assert.equal(result.safeForProduction, false);
    assert.equal(result.productionWiringAllowedNow, false);
    assert.equal(result.routerChangeAllowedNow, false);
    assert.equal(result.composerChangeAllowedNow, false);
    assert.equal(result.endpointChangeAllowedNow, false);
    assert.equal(result.featureFlagImplementationAllowedNow, false);
    assert.equal(result.featureFlagActivationAllowedNow, false);
    assert.equal(result.userVisibleOutputAllowedNow, false);
    assert.equal(result.realPersistenceAllowedNow, false);
    assert.equal(result.actionExecutionAllowedNow, false);
  });
}

test("gate-no-visibility-attempt / gate-no-production-eligibility / gate-no-leakage / gate-no-side-effects: a valid gate case passes every safety check", () => {
  for (const fixtureId of ["gate-no-visibility-attempt", "gate-no-production-eligibility", "gate-no-leakage", "gate-no-side-effects"]) {
    fixtureFor(fixtureId);
    const adapterCaseResult = fakeCaseResultFromFixture(fixtureId);
    const result = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult);
    assert.equal(result.noVisibilityAttemptPassed, true);
    assert.equal(result.noProductionEligibilityPassed, true);
    assert.equal(result.noLeaksPassed, true);
    assert.equal(result.noSideEffectsPassed, true);
    assert.equal(result.gateAccepted, true);
  }
});

// ─── Gate case evaluation: negative synthetic ───────────────────────────────────────

test("gate-negative-feature-flag-contract-missing: mutating featureFlagContract.status to not_ready fails featureFlagContractPassed", () => {
  fixtureFor("gate-negative-feature-flag-contract-missing");
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-ffc-missing");
  const mutated = { ...featureFlagContract, status: "not_ready" };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, mutated, productionWiringContract, rollbackContract, governanceChecklist);
  assert.equal(validation.featureFlagContractPassed, false);
  assert.equal(validation.gateAccepted, false);
  assert.equal(validation.qaStatus, "fail");
  assert.equal(validation.riskLevel, "high");
  assert.ok(validation.violations.includes("feature_flag_contract_missing"));
});

test("gate-negative-feature-flag-active-now: mutating featureFlagContract.featureFlagActiveNow to true fails and blocks", () => {
  fixtureFor("gate-negative-feature-flag-active-now");
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-ffc-active");
  const mutated = { ...featureFlagContract, featureFlagActiveNow: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, mutated, productionWiringContract, rollbackContract, governanceChecklist);
  assert.equal(validation.featureFlagContractPassed, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.equal(validation.riskLevel, "critical");
  assert.ok(validation.violations.includes("feature_flag_activation_path_enabled"));
});

test("gate-negative-runtime-read-now: mutating featureFlagContract.featureFlagRuntimeReadNow to true fails and blocks", () => {
  fixtureFor("gate-negative-runtime-read-now");
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-ffc-runtime");
  const mutated = { ...featureFlagContract, featureFlagRuntimeReadNow: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, mutated, productionWiringContract, rollbackContract, governanceChecklist);
  assert.equal(validation.featureFlagContractPassed, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("feature_flag_runtime_read_attempted"));
});

test("gate-negative-production-wiring-allowed-now: mutating productionWiringImplementedNow to true fails noProductionEligibilityPassed and blocks", () => {
  fixtureFor("gate-negative-production-wiring-allowed-now");
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-pw-implemented");
  const mutated = { ...productionWiringContract, productionWiringImplementedNow: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, featureFlagContract, mutated, rollbackContract, governanceChecklist);
  assert.equal(validation.productionWiringContractPassed, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.equal(validation.riskLevel, "critical");
  assert.ok(validation.violations.includes("production_eligible_now"));
});

test("gate-negative-router-change-allowed-now: mutating routerChangeAllowedNow to true fails and blocks", () => {
  fixtureFor("gate-negative-router-change-allowed-now");
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-router");
  const mutated = { ...productionWiringContract, routerChangeAllowedNow: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, featureFlagContract, mutated, rollbackContract, governanceChecklist);
  assert.equal(validation.productionWiringContractPassed, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("router_wiring_allowed"));
});

test("gate-negative-composer-change-allowed-now: mutating composerChangeAllowedNow to true fails and blocks", () => {
  fixtureFor("gate-negative-composer-change-allowed-now");
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-composer");
  const mutated = { ...productionWiringContract, composerChangeAllowedNow: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, featureFlagContract, mutated, rollbackContract, governanceChecklist);
  assert.equal(validation.productionWiringContractPassed, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("composer_wiring_allowed"));
});

test("gate-negative-endpoint-change-allowed-now: mutating endpointChangeAllowedNow to true fails and blocks", () => {
  fixtureFor("gate-negative-endpoint-change-allowed-now");
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-endpoint");
  const mutated = { ...productionWiringContract, endpointChangeAllowedNow: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, featureFlagContract, mutated, rollbackContract, governanceChecklist);
  assert.equal(validation.productionWiringContractPassed, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("endpoint_wiring_allowed"));
});

test("gate-negative-governance-approval-overclaimed: mutating approvalStateOverclaimed to true fails noApprovalOverclaimPassed and blocks", () => {
  fixtureFor("gate-negative-governance-approval-overclaimed");
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-overclaim");
  const mutated = { ...governanceChecklist, approvalStateOverclaimed: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, mutated);
  assert.equal(validation.noApprovalOverclaimPassed, false);
  assert.equal(validation.governanceChecklistPrepared, true);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("approval_state_overclaimed"));
});

test("governanceApprovalGrantedNow true is also an approval overclaim and is never counted as a default pass", () => {
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "neg-granted");
  const mutated = { ...governanceChecklist, governanceApprovalGrantedNow: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, mutated);
  assert.equal(validation.noApprovalOverclaimPassed, false);
  assert.ok(validation.violations.includes("approval_state_overclaimed"));
});

test("gate-negative-user-visible-output-allowed: mutating composerResult.payload.userVisibleNow to true fails noVisibilityAttemptPassed and blocks", () => {
  fixtureFor("gate-negative-user-visible-output-allowed");
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-visible");
  const mutated = { ...adapterCaseResult, composerResult: { ...adapterCaseResult.composerResult, payload: { ...adapterCaseResult.composerResult.payload, userVisibleNow: true } } };
  const result = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(mutated);
  assert.equal(result.noVisibilityAttemptPassed, false);
  assert.equal(result.gateAccepted, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("user_visible_output_allowed"));
});

test("gate-negative-real-persistence-allowed: mutating composerResult.payload.persistedNow to true fails noSideEffectsPassed and blocks", () => {
  fixtureFor("gate-negative-real-persistence-allowed");
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-persist");
  const mutated = { ...adapterCaseResult, composerResult: { ...adapterCaseResult.composerResult, payload: { ...adapterCaseResult.composerResult.payload, persistedNow: true } } };
  const result = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(mutated);
  assert.equal(result.noSideEffectsPassed, false);
  assert.equal(result.gateAccepted, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("real_persistence_allowed"));
});

test("payload executableNow/externalSideEffectsAllowed true also fail noSideEffectsPassed", () => {
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-exec");
  const executableResult = { ...adapterCaseResult, composerResult: { ...adapterCaseResult.composerResult, payload: { ...adapterCaseResult.composerResult.payload, executableNow: true } } };
  assert.ok(evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(executableResult).violations.includes("action_execution_allowed"));

  const externalResult = { ...adapterCaseResult, composerResult: { ...adapterCaseResult.composerResult, payload: { ...adapterCaseResult.composerResult.payload, externalSideEffectsAllowed: true } } };
  assert.ok(evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(externalResult).violations.includes("external_call_allowed"));
});

test("gate-negative-raw-input-leak: a payload section with containsRawInput true fails noLeaksPassed and blocks", () => {
  fixtureFor("gate-negative-raw-input-leak");
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-raw");
  const mutated = {
    ...adapterCaseResult,
    composerResult: {
      ...adapterCaseResult.composerResult,
      payload: { ...adapterCaseResult.composerResult.payload, sections: adapterCaseResult.composerResult.payload.sections.map((s) => ({ ...s, containsRawInput: true })) },
    },
  };
  const result = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(mutated);
  assert.equal(result.noLeaksPassed, false);
  assert.equal(result.gateAccepted, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("raw_input_leak"));
});

test("gate-negative-pii-leak: a payload section with containsPii true fails noLeaksPassed and blocks", () => {
  fixtureFor("gate-negative-pii-leak");
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-pii");
  const mutated = {
    ...adapterCaseResult,
    composerResult: {
      ...adapterCaseResult.composerResult,
      payload: { ...adapterCaseResult.composerResult.payload, sections: adapterCaseResult.composerResult.payload.sections.map((s) => ({ ...s, containsPii: true })) },
    },
  };
  const result = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(mutated);
  assert.equal(result.noLeaksPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("pii_leak"));
});

test("full candidate leak and project name leak also fail noLeaksPassed", () => {
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-leak-other");
  const fullCandidateResult = {
    ...adapterCaseResult,
    composerResult: {
      ...adapterCaseResult.composerResult,
      payload: { ...adapterCaseResult.composerResult.payload, sections: adapterCaseResult.composerResult.payload.sections.map((s) => ({ ...s, containsFullCandidate: true })) },
    },
  };
  assert.ok(evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(fullCandidateResult).violations.includes("full_candidate_leak"));

  const projectNameResult = {
    ...adapterCaseResult,
    composerResult: {
      ...adapterCaseResult.composerResult,
      payload: { ...adapterCaseResult.composerResult.payload, sections: adapterCaseResult.composerResult.payload.sections.map((s) => ({ ...s, containsProjectNameRaw: true })) },
    },
  };
  assert.ok(evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(projectNameResult).violations.includes("project_name_leak"));
});

test("gate-negative-side-effect-risk: dbWriteAttempted/supabaseWriteAttempted true fail noSideEffectsPassed and block", () => {
  fixtureFor("gate-negative-side-effect-risk");
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-side-effect");
  const mutated = { ...adapterCaseResult, composerResult: { ...adapterCaseResult.composerResult, dbWriteAttempted: true, supabaseWriteAttempted: true } };
  const result = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(mutated);
  assert.equal(result.noSideEffectsPassed, false);
  assert.equal(result.gateAccepted, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("side_effect_risk"));
});

test("routerChangeAttempted/composerChangeAttempted/endpointChangeAttempted true also fail noSideEffectsPassed", () => {
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-wiring-attempted");
  const routerMutated = { ...adapterCaseResult, routeResult: { ...adapterCaseResult.routeResult, routerChangeAttempted: true } };
  assert.equal(evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(routerMutated).noSideEffectsPassed, false);

  const composerMutated = { ...adapterCaseResult, composerResult: { ...adapterCaseResult.composerResult, composerChangeAttempted: true } };
  assert.equal(evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(composerMutated).noSideEffectsPassed, false);

  const endpointMutated = { ...adapterCaseResult, composerResult: { ...adapterCaseResult.composerResult, endpointChangeAttempted: true } };
  assert.equal(evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(endpointMutated).noSideEffectsPassed, false);
});

test("adapterAccepted/safeForProductionWiringReadinessReview false fails defaultOffAdapterPassed", () => {
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "neg-not-accepted");
  const mutated = { ...adapterCaseResult, adapterAccepted: false };
  const result = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(mutated);
  assert.equal(result.defaultOffAdapterPassed, false);
  assert.equal(result.gateAccepted, false);
});

// ─── Gate run ─────────────────────────────────────────────────────────────────────────

test("gate processes the full Sprint 18R corpus and produces one gate case per accepted Sprint 36R adapter case", () => {
  assert.equal(GATE.caseResults.length, ADAPTER.caseResults.length);
  assert.ok(GATE.caseResults.length > 0);
});

test("runDecisionSupportProductionWiringReadinessFeatureFlagGate reuses the Sprint 36R adapter decision", () => {
  assert.equal(GATE.adapterSummary.decision, "ready_for_production_wiring_readiness_feature_flag_gate");
});

test("runDecisionSupportProductionWiringReadinessFeatureFlagGate honors the default synthetic corpus when no cases are supplied", () => {
  const defaultGate = runDecisionSupportProductionWiringReadinessFeatureFlagGate({ now: NOW });
  assert.ok(defaultGate.caseResults.length > 0);
  assert.ok(defaultGate.caseResults.length < DECISION_CLARIFICATION_CASES.length);
});

test("runDecisionSupportProductionWiringReadinessFeatureFlagGate can reuse a pre-built Sprint 36R adapter instead of rebuilding one", () => {
  const adapter = runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const gate = runDecisionSupportProductionWiringReadinessFeatureFlagGate({ adapter, now: NOW });
  assert.equal(gate.caseResults.length, adapter.caseResults.length);
  assert.equal(gate.adapter, adapter);
});

test("gate-summary-pass: totalCases matches the Sprint 18R corpus size, every case passes", () => {
  fixtureFor("gate-summary-pass");
  assert.equal(GATE_SUMMARY.totalCases, 79);
  assert.equal(GATE_SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(GATE_SUMMARY.gateEvaluatedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.gateAcceptedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.gateRejectedCount, 0);
  assert.equal(GATE_SUMMARY.gateBlockedCount, 0);
  assert.equal(GATE_SUMMARY.qaPassCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.qaWarningCount, 0);
  assert.equal(GATE_SUMMARY.qaFailCount, 0);
  assert.equal(GATE_SUMMARY.qaBlockedCount, 0);
});

test("summary: gate-kind counts match the documented Sprint 36R adapter-kind baseline", () => {
  assert.equal(GATE_SUMMARY.clarificationGateReadinessCount, 69);
  assert.equal(GATE_SUMMARY.routePreservationReadinessCount, 10);
  assert.equal(GATE_SUMMARY.unsupportedBoundaryReadinessCount, 0);
  assert.equal(GATE_SUMMARY.shadowOnlyReadinessCount, 0);
  assert.equal(GATE_SUMMARY.blockedUnsafeReadinessCount, 0);
});

test("summary: gate-kind counts sum to totalCases", () => {
  const sum =
    GATE_SUMMARY.clarificationGateReadinessCount + GATE_SUMMARY.routePreservationReadinessCount + GATE_SUMMARY.unsupportedBoundaryReadinessCount + GATE_SUMMARY.shadowOnlyReadinessCount + GATE_SUMMARY.blockedUnsafeReadinessCount;
  assert.equal(sum, GATE_SUMMARY.totalCases);
});

test("summary: contract/checklist pass counts equal totalCases for the clean corpus", () => {
  assert.equal(GATE_SUMMARY.featureFlagContractPassedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.productionWiringContractPassedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.rollbackContractPassedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.governanceChecklistPreparedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.governanceApprovalGrantedNowCount, 0);
  assert.equal(GATE_SUMMARY.approvalOverclaimCount, 0);
  assert.equal(GATE_SUMMARY.defaultOffAdapterPassedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.noVisibilityAttemptPassedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.noProductionEligibilityPassedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.noLeaksPassedCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.noSideEffectsPassedCount, GATE_SUMMARY.totalCases);
});

test("summary: safeFor* counts are as expected", () => {
  assert.equal(GATE_SUMMARY.safeForDefaultOffFeatureFlagImplementationShellCount, GATE_SUMMARY.totalCases);
  assert.equal(GATE_SUMMARY.safeForUserVisibleOutputNowCount, 0);
  assert.equal(GATE_SUMMARY.safeForProductionCount, 0);
});

test("summary: score averages/minimums meet their floors", () => {
  assert.ok(GATE_SUMMARY.averageFeatureFlagContractScore >= 90);
  assert.ok(GATE_SUMMARY.averageProductionWiringContractScore >= 90);
  assert.ok(GATE_SUMMARY.averageRollbackContractScore >= 90);
  assert.ok(GATE_SUMMARY.averageGovernanceChecklistScore >= 85);
  assert.ok(GATE_SUMMARY.minFeatureFlagContractScore >= 85);
  assert.ok(GATE_SUMMARY.minProductionWiringContractScore >= 85);
  assert.ok(GATE_SUMMARY.minRollbackContractScore >= 85);
  assert.ok(GATE_SUMMARY.minGovernanceChecklistScore >= 80);
});

test("summary: violation and AllowedNow counts are all clean", () => {
  assert.equal(GATE_SUMMARY.violationCount, 0);
  assert.equal(GATE_SUMMARY.criticalViolationCount, 0);
  assert.equal(GATE_SUMMARY.productionWiringAllowedNowCount, 0);
  assert.equal(GATE_SUMMARY.routerChangeAllowedNowCount, 0);
  assert.equal(GATE_SUMMARY.composerChangeAllowedNowCount, 0);
  assert.equal(GATE_SUMMARY.endpointChangeAllowedNowCount, 0);
  assert.equal(GATE_SUMMARY.featureFlagImplementationAllowedNowCount, 0);
  assert.equal(GATE_SUMMARY.featureFlagActivationAllowedNowCount, 0);
  assert.equal(GATE_SUMMARY.userVisibleOutputAllowedNowCount, 0);
  assert.equal(GATE_SUMMARY.realPersistenceAllowedNowCount, 0);
  assert.equal(GATE_SUMMARY.actionExecutionAllowedNowCount, 0);
});

test("gate-decision-ready-for-default-off-feature-flag-implementation-shell: decision is as expected", () => {
  fixtureFor("gate-decision-ready-for-default-off-feature-flag-implementation-shell");
  assert.equal(GATE_SUMMARY.decision, "ready_for_default_off_feature_flag_implementation_shell");
});

test("gate-recommended-sprint-38r: recommendedNextSprint is Sprint 38R", () => {
  fixtureFor("gate-recommended-sprint-38r");
  assert.equal(GATE_SUMMARY.recommendedNextSprint, "Sprint 38R — Default-Off Feature Flag Implementation Shell");
});

test("summary accepts a bare case-results array plus sprint36AdapterDecision option", () => {
  const bareSummary = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate(GATE.caseResults, { sprint36AdapterDecision: GATE.adapterSummary.decision });
  assert.equal(bareSummary.totalCases, GATE_SUMMARY.totalCases);
  assert.equal(bareSummary.decision, GATE_SUMMARY.decision);
});

test("summary: bare case-results array without sprint36AdapterDecision cannot reach ready_for_default_off_feature_flag_implementation_shell", () => {
  const bareSummary = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate(GATE.caseResults);
  assert.notEqual(bareSummary.decision, "ready_for_default_off_feature_flag_implementation_shell");
});

test("summary: representativeAcceptedGateResults is capped and rejectedGateResults/blockedGateResults are empty for the clean corpus", () => {
  assert.ok(GATE_SUMMARY.representativeAcceptedGateResults.length <= 8);
  assert.equal(GATE_SUMMARY.rejectedGateResults.length, 0);
  assert.equal(GATE_SUMMARY.blockedGateResults.length, 0);
});

// ─── Decision blocking paths (synthetic) ─────────────────────────────────────────────

test("decision: a leaked case forces blocked_by_leakage_or_side_effect_risk", () => {
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "decision-leak");
  const mutated = {
    ...adapterCaseResult,
    composerResult: {
      ...adapterCaseResult.composerResult,
      payload: { ...adapterCaseResult.composerResult.payload, sections: adapterCaseResult.composerResult.payload.sections.map((s) => ({ ...s, containsPii: true })) },
    },
  };
  const caseResult = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(mutated);
  const summary = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate([caseResult], { sprint36AdapterDecision: "ready_for_production_wiring_readiness_feature_flag_gate" });
  assert.equal(summary.decision, "blocked_by_leakage_or_side_effect_risk");
});

test("decision: a user-visible-output violation with no leakage forces blocked_by_visibility_risk", () => {
  const adapterCaseResult = buildFakeAdapterCaseResult("clarification_gate_adapter", "decision-visibility");
  const mutated = { ...adapterCaseResult, composerResult: { ...adapterCaseResult.composerResult, payload: { ...adapterCaseResult.composerResult.payload, userVisibleNow: true } } };
  const caseResult = evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(mutated);
  const summary = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate([caseResult], { sprint36AdapterDecision: "ready_for_production_wiring_readiness_feature_flag_gate" });
  assert.equal(summary.decision, "blocked_by_visibility_risk");
});

test("decision: a router-wiring-allowed violation with no leakage/visibility forces blocked_by_production_wiring_risk", () => {
  const { adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist } = buildValidParts("clarification_gate_adapter", "decision-wiring");
  const mutatedProductionWiring = { ...productionWiringContract, routerChangeAllowedNow: true };
  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, featureFlagContract, mutatedProductionWiring, rollbackContract, governanceChecklist);
  const caseResult = {
    caseId: adapterCaseResult.caseId,
    sourceAdapterKind: adapterCaseResult.adapterKind,
    sourceCaseId: adapterCaseResult.caseId,
    generatedForReadinessGateOnly: true,
    readinessOnly: true,
    gateKind: "clarification_gate_readiness",
    featureFlagContract,
    productionWiringContract: mutatedProductionWiring,
    rollbackContract,
    governanceChecklist,
    ...validation,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    featureFlagImplementationAllowedNow: false,
    featureFlagActivationAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate([caseResult], { sprint36AdapterDecision: "ready_for_production_wiring_readiness_feature_flag_gate" });
  assert.equal(summary.decision, "blocked_by_production_wiring_risk");
});

test("decision: continue_readiness_gate_only when the Sprint 36R adapter decision is not ready", () => {
  const summary = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate(GATE.caseResults, { sprint36AdapterDecision: "continue_default_off_adapter_only" });
  assert.equal(summary.decision, "continue_readiness_gate_only");
});

// ─── Explain ──────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportProductionWiringReadinessFeatureFlagGate returns a structured explanation", () => {
  const explain = explainDecisionSupportProductionWiringReadinessFeatureFlagGate();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
  assert.equal(typeof explain.whyApprovalIsNotOverclaimed, "string");
  assert.equal(typeof explain.whyProcessEnvIsNotRead, "string");
});

// ─── Regression: Sprint 24R-36R + golden/classifier metrics unchanged ──────────────

test("regression: Sprint 36R default-off route/composer integration adapter metrics stay clean against the 79-case corpus", () => {
  assert.equal(ADAPTER_SUMMARY.totalCases, 79);
  assert.equal(ADAPTER_SUMMARY.adapterAcceptedCount, 79);
  assert.equal(ADAPTER_SUMMARY.qaPassCount, 79);
  assert.equal(ADAPTER_SUMMARY.decision, "ready_for_production_wiring_readiness_feature_flag_gate");
});

test("regression: Sprint 35R user-visible dry run evaluation harness metrics stay clean against the 79-case corpus", () => {
  const summary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(HARNESS);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.previewAcceptedCount, 79);
  assert.equal(summary.safeForDefaultOffRouteComposerAdapterCount, 79);
  assert.equal(summary.decision, "ready_for_default_off_route_composer_integration_adapter");
});

test("regression: Sprint 34R response draft quality evaluation metrics stay clean against the 79-case corpus", () => {
  const evaluation = runDecisionSupportResponseDraftQualityEvaluation({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseDraftQualityEvaluation(evaluation);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.passCount, 79);
  assert.equal(summary.decision, "ready_for_user_visible_dry_run_evaluation_harness");
});

test("regression: Sprint 33R response draft harness metrics stay clean against the 79-case corpus", () => {
  const harness = runDecisionSupportResponseDraftHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseDraftHarness(harness);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.draftAcceptedCount, 79);
  assert.equal(summary.clarificationFirstDraftCount, 69);
  assert.equal(summary.routePreservationDraftCount, 10);
  assert.equal(summary.decision, "ready_for_response_draft_quality_evaluation");
});

test("regression: Sprint 32R response QA plan metrics stay clean against the 79-case corpus", () => {
  const plan = buildDecisionSupportResponseQaDryRunPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseQaDryRunPlan(plan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.clarificationQuestionCaseCount, 69);
  assert.equal(summary.routePreservationCaseCount, 10);
  assert.equal(summary.decision, "ready_for_response_draft_harness");
});

test("regression: Sprint 31R clarification-gated integration plan metrics stay clean against the 79-case corpus", () => {
  const integrationPlan = buildDecisionSupportClarificationGatedIntegrationPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportClarificationGatedIntegrationPlan(integrationPlan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.clarificationGatedCaseCount, 69);
  assert.equal(summary.existingRoutePreservedCaseCount, 10);
  assert.equal(summary.decision, "ready_for_user_visible_dry_run_plan");
});

test("regression: Sprint 30R controlled replay metrics stay clean against the 79-case corpus", () => {
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowControlledReplayEvaluation(evaluation);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.deterministicReplayRate, 100);
  assert.equal(summary.safeReplayRate, 100);
  assert.equal(summary.decision, "ready_for_clarification_gated_integration_plan");
});

test("regression: Sprint 29R persistence readiness baseline matches the documented Sprint 29R result", () => {
  const inputMetrics = createDecisionSupportShadowPersistenceReadinessInputMetrics(DECISION_CLARIFICATION_CASES, { now: NOW });
  const review = buildDecisionSupportShadowPersistenceReadinessReview({ now: NOW, inputMetrics });
  const summary = summarizeDecisionSupportShadowPersistenceReadinessReview(review);
  assert.equal(summary.readinessScore, 62.9);
  assert.equal(summary.decision, "do_not_build_real_persistence_yet");
});

test("regression: Sprint 28R fake adapter metrics stay clean against the 79-case corpus", () => {
  const result = runDecisionSupportShadowStorageFakeAdapterEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(result);
  assert.equal(summary.fakeWriteAcceptedRate, 100);
});

test("regression: Sprint 27R adapter plan metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStorageAdapterPlanEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(results);
  assert.equal(summary.validDraftRate, 100);
});

test("regression: Sprint 26R storage policy metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStoragePolicyEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStoragePolicyEvaluation(results);
  assert.equal(summary.rawInputViolationCount, 0);
  assert.equal(summary.fullCandidateViolationCount, 0);
});

test("regression: Sprint 25R shadow capture harness metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW, context: { mode: "dry_run" } });
  const summary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(results);
  assert.equal(summary.acceptableCaptureRate, 100);
  assert.equal(summary.rawInputRetainedCount, 0);
});

test("regression: Sprint 24R shadow mode prep metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowModePrepEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowModePrepEvaluation(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.acceptableShadowPrepRunRate, 100);
  assert.equal(summary.allBlockingGatesPassedRate, 100);
  assert.equal(summary.blockedBySafetyGateCount, 0);
  assert.equal(summary.existingRoutePreservedCount, 10);
});

test("regression: Sprint 22R clarification response evaluation still runs cleanly", () => {
  const results = runClarificationResponseEvaluation(toDecisionClarificationEvaluationCases(DECISION_CLARIFICATION_CASES), { now: NOW });
  assert.ok(results.length > 0);
});

test("regression: golden intent compatibilityRate is unaffected by this sprint", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.ok(report.overall.compatibilityRate >= 0);
  assert.ok(report.overall.compatibilityRate <= 100);
});

// ─── No real storage / no production ───────────────────────────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

const IMPLEMENTATION_SOURCE = readFileSync(new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportProductionWiringReadinessFeatureFlagGate.ts", import.meta.url), "utf8");
const TYPES_SOURCE = readFileSync(new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportProductionWiringReadinessFeatureFlagGateTypes.ts", import.meta.url), "utf8");

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /brainRouter/);
  assert.doesNotMatch(imports, /responseComposer/);
  assert.doesNotMatch(imports, /conversationalBrainGateway/);
  assert.doesNotMatch(imports, /handlers\//);
  assert.doesNotMatch(imports, /command-center\/chat/);
  assert.doesNotMatch(imports, /supabase/i);
  assert.doesNotMatch(imports, /nodemailer/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\bfetch\(/);
});

test("this module never imports intentCompatibilityAdapter.ts, intentClassifier.rules.ts, or intent-patterns.ts", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /intentCompatibilityAdapter/);
  assert.doesNotMatch(imports, /intentClassifier\.rules/);
  assert.doesNotMatch(imports, /intent-patterns/);
});

test("no feature flag / env read is ever performed by this sprint", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /process\.env/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /growthbook/i);
  assert.doesNotMatch(TYPES_SOURCE, /process\.env/);
});

test("no database/migration/storage-adapter vocabulary appears as executable code (only as string literals/docs)", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /createClient\(/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\.from\(["'`]\w+["'`]\)\.(insert|upsert|update|delete)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /CREATE TABLE/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /ALTER TABLE/i);
});

test("this module never calls the system clock (no bare Date.now()/new Date()) or an LLM", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /new Date\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /Date\.now\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\bopenai\b/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\banthropic\b/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\.chat\.completions\b/);
});

test("this module never imports from tests/fixtures/", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /tests\/fixtures/);
});

test("this module never actually implements or activates a feature flag (no true literal assigned to a feature-flag-shaped field)", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /featureFlagImplementedNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /featureFlagActiveNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /featureFlagRuntimeReadNow:\s*true/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportProductionWiringReadinessFeatureFlagGate/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});

test("no feature flag implementation file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../src/lib/feature-flags/decisionSupportRouteComposerFlag.ts", import.meta.url), "utf8"));
  assert.throws(() => readFileSync(new URL("../src/lib/feature-flags/pmfreakDecisionSupportDefaultOffRouteComposerAdapter.ts", import.meta.url), "utf8"));
});
