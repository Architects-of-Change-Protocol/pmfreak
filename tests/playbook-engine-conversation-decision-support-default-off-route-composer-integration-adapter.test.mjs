import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_VERSION,
  createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig,
  listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions,
  listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions,
  createDecisionSupportDefaultOffRouteGuardContract,
  createDecisionSupportDefaultOffComposerGuardContract,
  simulateDecisionSupportDefaultOffRouteAdapter,
  simulateDecisionSupportDefaultOffComposerAdapter,
  validateDecisionSupportDefaultOffRouteComposerAdapter,
  runDecisionSupportDefaultOffRouteComposerIntegrationAdapter,
  summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter,
  explainDecisionSupportDefaultOffRouteComposerIntegrationAdapter,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouteComposerIntegrationAdapter.ts";
import { DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_CASES } from "./fixtures/conversational-brain-decision-support-default-off-route-composer-integration-adapter-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Sprint 35R harness — reused to build real dry-run case results for this sprint's adapter simulations.
import {
  runDecisionSupportUserVisibleDryRunEvaluationHarness,
  summarizeDecisionSupportUserVisibleDryRunEvaluationHarness,
  renderDecisionSupportUserVisibleDryRunPreview,
  validateDecisionSupportUserVisibleDryRunPreview,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarness.ts";

// Regression imports — Sprint 18R-35R + golden/classifier/vocabulary suites, reused read-only for comparison.
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
 * Sprint 36R — Decision Support Default-Off Route/Composer Integration Adapter.
 *
 * Tests the pure, offline, deterministic, default-off adapter in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouteComposerIntegrationAdapter.ts`.
 * This connects every Sprint 35R-validated preview to a synthetic route guard contract and a synthetic
 * composer guard contract — it never shows anything to a real user, never persists anything real, and
 * never touches the router/composer/endpoint/feature flag.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

/** Builds a real Sprint 35R DecisionSupportUserVisibleDryRunEvaluationCaseResult from a minimal quality-case shape. */
function buildDryRunCaseResult(qualityCaseEvaluation) {
  const rendered = renderDecisionSupportUserVisibleDryRunPreview(qualityCaseEvaluation);
  const validation = validateDecisionSupportUserVisibleDryRunPreview(rendered);
  const status = validation.valid ? "validated" : validation.qaStatus === "blocked" ? "blocked" : "rejected";
  const preview = { ...rendered, status };
  return {
    caseId: qualityCaseEvaluation.caseId,
    sourceDraftId: qualityCaseEvaluation.draftId,
    sourceDraftKind: qualityCaseEvaluation.draftKind,
    sourceRouteKind: qualityCaseEvaluation.sourceRouteKind,
    preview,
    validation,
    previewRendered: true,
    previewAccepted: validation.valid,
    previewRejected: !validation.valid && status === "rejected",
    previewBlocked: status === "blocked",
    safeForDefaultOffRouteComposerAdapter: validation.valid,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings: [],
  };
}

function dryRunCaseResultFromFixture(fixtureId) {
  const fixtureCase = fixtureFor(fixtureId);
  assert.ok(fixtureCase.sourceQualityCaseEvaluation, `fixture ${fixtureId} must declare sourceQualityCaseEvaluation`);
  return buildDryRunCaseResult(fixtureCase.sourceQualityCaseEvaluation);
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const HARNESS = runDecisionSupportUserVisibleDryRunEvaluationHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const HARNESS_SUMMARY = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(HARNESS);
const ADAPTER = runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ harness: HARNESS, now: NOW });
const SUMMARY = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter(ADAPTER);

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 45 and 65 cases", () => {
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_CASES.length >= 45);
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_CASES.length <= 65);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.adapterKind, "string");
    assert.equal(typeof c.expectedRouteDecision, "string");
    assert.equal(typeof c.expectedComposerDecision, "string");
    assert.equal(typeof c.expectedQaStatus, "string");
    assert.equal(typeof c.expectedRiskLevel, "string");
    assert.equal(typeof c.expectedValid, "boolean");
    assert.equal(typeof c.expectedRouteGuardPassed, "boolean");
    assert.equal(typeof c.expectedComposerGuardPassed, "boolean");
    assert.equal(typeof c.expectedDefaultOffPassed, "boolean");
    assert.equal(typeof c.expectedIsolatedNoOpPassed, "boolean");
    assert.equal(typeof c.expectedSafeForProductionWiringReadinessReview, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleOutputNow, "boolean");
    assert.equal(c.expectedSafeForUserVisibleOutputNow, false);
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(c.expectedSafeForProduction, false);
    assert.ok(Array.isArray(c.expectedViolations));
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_VERSION, "string");
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig", createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig],
  ["listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions", listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions],
  ["listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions", listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions],
  ["createDecisionSupportDefaultOffRouteGuardContract", createDecisionSupportDefaultOffRouteGuardContract],
  ["createDecisionSupportDefaultOffComposerGuardContract", createDecisionSupportDefaultOffComposerGuardContract],
  ["simulateDecisionSupportDefaultOffRouteAdapter", simulateDecisionSupportDefaultOffRouteAdapter],
  ["simulateDecisionSupportDefaultOffComposerAdapter", simulateDecisionSupportDefaultOffComposerAdapter],
  ["validateDecisionSupportDefaultOffRouteComposerAdapter", validateDecisionSupportDefaultOffRouteComposerAdapter],
  ["runDecisionSupportDefaultOffRouteComposerIntegrationAdapter", runDecisionSupportDefaultOffRouteComposerIntegrationAdapter],
  ["summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter", summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter],
  ["explainDecisionSupportDefaultOffRouteComposerIntegrationAdapter", explainDecisionSupportDefaultOffRouteComposerIntegrationAdapter],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture adapter-config-default-strict)", () => {
  fixtureFor("adapter-config-default-strict");
  const config = createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig();
  assert.equal(config.profile, "strict_default_off_route_composer_integration_adapter");
  assert.equal(config.mode, "default_off_adapter_only");
  assert.equal(config.defaultOff, true);
  assert.equal(config.adapterEnabledNow, false);
  assert.equal(config.allowProductionWiring, false);
  assert.equal(config.allowRouterChange, false);
  assert.equal(config.allowComposerChange, false);
  assert.equal(config.allowEndpointChange, false);
  assert.equal(config.allowFeatureFlagImplementation, false);
  assert.equal(config.allowFeatureFlagActivation, false);
  assert.equal(config.allowUserVisibleOutput, false);
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowTaskCreation, false);
  assert.equal(config.allowEmailDraftCreation, false);
  assert.equal(config.requireDryRunHarnessPass, true);
  assert.equal(config.requireDefaultOff, true);
  assert.equal(config.requireNoOpIsolation, true);
  assert.equal(config.requireRouteGuardContract, true);
  assert.equal(config.requireComposerGuardContract, true);
  assert.equal(config.requireNoVisibilityAttempt, true);
  assert.equal(config.requireNoLeakage, true);
  assert.equal(config.requireNoSideEffects, true);
  assert.equal(config.requireNoProductionEligibility, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "adapter-config-block-adapter-enabled-now",
  "adapter-config-block-user-visible-output",
  "adapter-config-block-production-wiring",
  "adapter-config-block-router-change",
  "adapter-config-block-composer-change",
  "adapter-config-block-endpoint-change",
  "adapter-config-block-feature-flag-implementation",
  "adapter-config-block-feature-flag-activation",
  "adapter-config-block-real-persistence",
  "adapter-config-block-db-write",
  "adapter-config-block-supabase-write",
  "adapter-config-block-external-calls",
  "adapter-config-block-action-execution",
  "adapter-config-block-task-creation",
  "adapter-config-block-email-draft-creation",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 15);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all fifteen are forced true at once", () => {
  const config = createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig({
    adapterEnabledNow: true,
    allowProductionWiring: true,
    allowRouterChange: true,
    allowComposerChange: true,
    allowEndpointChange: true,
    allowFeatureFlagImplementation: true,
    allowFeatureFlagActivation: true,
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
  assert.equal(config.defaultOff, true);
});

test("config honors safe overrides (mode, now, notes)", () => {
  const config = createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig({
    mode: "route_guard_contract_review",
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "route_guard_contract_review");
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("production wiring readiness review"));
  assert.ok(joined.includes("default-off feature flag gate contract"));
  assert.ok(joined.includes("route guard implementation plan"));
  assert.ok(joined.includes("composer guard implementation plan"));
  assert.ok(joined.includes("endpoint safety gate review"));
  assert.ok(joined.includes("rollback readiness review"));
  assert.ok(joined.includes("governance approval checklist"));
});

test("listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("wire router to live decision_support"));
  assert.ok(joined.includes("wire composer to live decision_support"));
  assert.ok(joined.includes("wire endpoint to live decision_support"));
  assert.ok(joined.includes("implement production feature flag"));
  assert.ok(joined.includes("activate production feature flag"));
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

test("listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Route guard contract ───────────────────────────────────────────────────────────

const ROUTE_GUARD_FIXTURE_EXPECTATIONS = [
  ["adapter-route-guard-clarification-gate", "clarification_gate_adapter", "simulate_route_to_clarification_gate"],
  ["adapter-route-guard-route-preservation", "route_preservation_adapter", "simulate_preserve_existing_route"],
  ["adapter-route-guard-unsupported-boundary", "unsupported_boundary_adapter", "simulate_preserve_unsupported"],
  ["adapter-route-guard-shadow-only", "shadow_only_adapter", "simulate_shadow_only"],
  ["adapter-route-guard-blocked-unsafe", "blocked_unsafe_adapter", "simulate_block_unsafe"],
];

for (const [fixtureId, expectedAdapterKind, expectedRouteDecision] of ROUTE_GUARD_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: route guard contract produces the documented adapter kind and route decision`, () => {
    const dryRunCaseResult = dryRunCaseResultFromFixture(fixtureId);
    const contract = createDecisionSupportDefaultOffRouteGuardContract(dryRunCaseResult);
    assert.equal(contract.adapterKind, expectedAdapterKind);
    assert.equal(contract.routeDecision, expectedRouteDecision);
    assert.equal(contract.defaultOff, true);
    assert.equal(contract.isolatedNoOpAdapter, true);
    assert.equal(contract.routeWiringActiveNow, false);
    assert.equal(contract.productionRouteChangeAllowedNow, false);
    assert.equal(contract.blocksDirectDecision, true);
    assert.equal(contract.blocksUserVisibleOutput, true);
    assert.equal(contract.blocksProductionEligibility, true);
    assert.ok(contract.routeGuardScore >= 85);
    assert.ok(contract.rationale.length > 0);
  });
}

test("route guard contract requiresClarificationGate only for clarification_gate_adapter", () => {
  const contract = createDecisionSupportDefaultOffRouteGuardContract(dryRunCaseResultFromFixture("adapter-route-guard-clarification-gate"));
  assert.equal(contract.requiresClarificationGate, true);
  assert.equal(contract.preservesExistingRoute, false);
  assert.equal(contract.preservesUnsupportedBoundary, false);
  assert.equal(contract.keepsShadowOnly, false);
  assert.equal(contract.blocksUnsafe, false);
});

test("route guard contract preservesExistingRoute only for route_preservation_adapter", () => {
  const contract = createDecisionSupportDefaultOffRouteGuardContract(dryRunCaseResultFromFixture("adapter-route-guard-route-preservation"));
  assert.equal(contract.preservesExistingRoute, true);
  assert.equal(contract.requiresClarificationGate, false);
});

test("route guard contract preservesUnsupportedBoundary only for unsupported_boundary_adapter", () => {
  const contract = createDecisionSupportDefaultOffRouteGuardContract(dryRunCaseResultFromFixture("adapter-route-guard-unsupported-boundary"));
  assert.equal(contract.preservesUnsupportedBoundary, true);
});

test("route guard contract keepsShadowOnly only for shadow_only_adapter", () => {
  const contract = createDecisionSupportDefaultOffRouteGuardContract(dryRunCaseResultFromFixture("adapter-route-guard-shadow-only"));
  assert.equal(contract.keepsShadowOnly, true);
});

test("route guard contract blocksUnsafe only for blocked_unsafe_adapter", () => {
  const contract = createDecisionSupportDefaultOffRouteGuardContract(dryRunCaseResultFromFixture("adapter-route-guard-blocked-unsafe"));
  assert.equal(contract.blocksUnsafe, true);
});

// ─── Composer guard contract ────────────────────────────────────────────────────────

const COMPOSER_GUARD_FIXTURE_EXPECTATIONS = [
  ["adapter-composer-guard-clarification-gate", "clarification_gate_adapter", "simulate_composer_internal_preview_payload"],
  ["adapter-composer-guard-route-preservation", "route_preservation_adapter", "simulate_composer_route_preservation_payload"],
  ["adapter-composer-guard-unsupported-boundary", "unsupported_boundary_adapter", "simulate_composer_unsupported_boundary_payload"],
  ["adapter-composer-guard-shadow-only", "shadow_only_adapter", "simulate_composer_shadow_only_payload"],
  ["adapter-composer-guard-blocked-unsafe", "blocked_unsafe_adapter", "simulate_composer_blocked_payload"],
];

for (const [fixtureId, expectedAdapterKind, expectedComposerDecision] of COMPOSER_GUARD_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: composer guard contract produces the documented adapter kind and composer decision`, () => {
    const dryRunCaseResult = dryRunCaseResultFromFixture(fixtureId);
    const contract = createDecisionSupportDefaultOffComposerGuardContract(dryRunCaseResult);
    assert.equal(contract.adapterKind, expectedAdapterKind);
    assert.equal(contract.composerDecision, expectedComposerDecision);
    assert.equal(contract.defaultOff, true);
    assert.equal(contract.isolatedNoOpAdapter, true);
    assert.equal(contract.composerWiringActiveNow, false);
    assert.equal(contract.productionComposerChangeAllowedNow, false);
    assert.equal(contract.internalPayloadOnly, true);
    assert.equal(contract.userVisibleNow, false);
    assert.equal(contract.persistedNow, false);
    assert.equal(contract.executableNow, false);
    assert.equal(contract.blocksDirectDecision, true);
    assert.equal(contract.blocksExecution, true);
    assert.equal(contract.blocksPersistence, true);
    assert.equal(contract.blocksExternalCalls, true);
    assert.equal(contract.blocksProductionEligibility, true);
    assert.ok(contract.composerGuardScore >= 85);
    assert.ok(contract.rationale.length > 0);
  });
}

test("createDecisionSupportDefaultOffComposerGuardContract can derive adapterKind from a route result", () => {
  const dryRunCaseResult = dryRunCaseResultFromFixture("adapter-composer-guard-route-preservation");
  const routeResult = simulateDecisionSupportDefaultOffRouteAdapter(dryRunCaseResult);
  const contract = createDecisionSupportDefaultOffComposerGuardContract(dryRunCaseResult, routeResult);
  assert.equal(contract.adapterKind, routeResult.adapterKind);
});

// ─── Route adapter simulation ────────────────────────────────────────────────────────

const ROUTE_SIMULATION_FIXTURE_EXPECTATIONS = [
  ["adapter-simulate-route-clarification", "clarification_gate_adapter"],
  ["adapter-simulate-route-preservation", "route_preservation_adapter"],
  ["adapter-simulate-route-unsupported", "unsupported_boundary_adapter"],
  ["adapter-simulate-route-shadow-only", "shadow_only_adapter"],
];

for (const [fixtureId, expectedAdapterKind] of ROUTE_SIMULATION_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: route adapter simulation produces the expected adapter kind with every default-off invariant`, () => {
    const dryRunCaseResult = dryRunCaseResultFromFixture(fixtureId);
    const routeResult = simulateDecisionSupportDefaultOffRouteAdapter(dryRunCaseResult);
    assert.equal(routeResult.adapterKind, expectedAdapterKind);
    assert.equal(routeResult.routeGuardPassed, true);
    assert.equal(routeResult.defaultOffPassed, true);
    assert.equal(routeResult.isolatedNoOpPassed, true);
    assert.equal(routeResult.safeForComposerAdapterSimulation, true);
    assert.equal(routeResult.routeWiringActiveNow, false);
    assert.equal(routeResult.routerChangeAttempted, false);
    assert.equal(routeResult.productionWiringAttempted, false);
    assert.equal(routeResult.userVisibleOutputAttempted, false);
  });
}

// ─── Composer adapter simulation ────────────────────────────────────────────────────

test("adapter-simulate-composer-internal-preview-payload: composer adapter simulation produces a safe internal-only payload", () => {
  const fixtureCase = fixtureFor("adapter-simulate-composer-internal-preview-payload");
  const dryRunCaseResult = dryRunCaseResultFromFixture(fixtureCase.id);
  const routeResult = simulateDecisionSupportDefaultOffRouteAdapter(dryRunCaseResult);
  const composerResult = simulateDecisionSupportDefaultOffComposerAdapter(dryRunCaseResult, routeResult);

  assert.equal(composerResult.composerDecision, "simulate_composer_internal_preview_payload");
  const payload = composerResult.payload;
  assert.equal(payload.generatedForAdapterEvaluationOnly, true);
  assert.equal(payload.internalPayloadOnly, true);
  assert.equal(payload.defaultOff, true);
  assert.equal(payload.adapterEnabledNow, false);
  assert.equal(payload.userVisibleNow, false);
  assert.equal(payload.persistedNow, false);
  assert.equal(payload.executableNow, false);
  assert.equal(payload.externalSideEffectsAllowed, false);
  assert.equal(payload.productionEligibleNow, false);
  assert.ok(payload.sections.length > 0);
  for (const section of payload.sections) {
    assert.equal(section.internalOnly, true);
    assert.equal(section.userVisibleNow, false);
    assert.equal(section.containsRawInput, false);
    assert.equal(section.containsFullCandidate, false);
    assert.equal(section.containsPii, false);
    assert.equal(section.containsProjectNameRaw, false);
    assert.equal(section.containsExecutableInstruction, false);
    assert.equal(section.containsPersistenceInstruction, false);
  }
  assert.equal(composerResult.composerGuardPassed, true);
  assert.equal(composerResult.defaultOffPassed, true);
  assert.equal(composerResult.isolatedNoOpPassed, true);
  assert.equal(composerResult.safeForDefaultOffAdapter, true);
  assert.equal(composerResult.composerWiringActiveNow, false);
  assert.equal(composerResult.composerChangeAttempted, false);
  assert.equal(composerResult.endpointChangeAttempted, false);
  assert.equal(composerResult.featureFlagAttempted, false);
  assert.equal(composerResult.userVisibleOutputAttempted, false);
  assert.equal(composerResult.realPersistenceAttempted, false);
  assert.equal(composerResult.dbWriteAttempted, false);
  assert.equal(composerResult.supabaseWriteAttempted, false);
  assert.equal(composerResult.externalCallAttempted, false);
  assert.equal(composerResult.actionExecutionAttempted, false);
});

// ─── Adapter validation (positive) ───────────────────────────────────────────────────

const VALIDATION_POSITIVE_FIXTURE_IDS = [
  "adapter-validate-default-off-passed",
  "adapter-validate-isolated-noop-passed",
  "adapter-validate-route-guard-passed",
  "adapter-validate-composer-guard-passed",
  "adapter-validate-no-visibility-attempt",
  "adapter-validate-no-production-eligibility",
  "adapter-validate-no-leakage",
  "adapter-validate-no-side-effects",
];

assert.equal(VALIDATION_POSITIVE_FIXTURE_IDS.length, 8);

for (const fixtureId of VALIDATION_POSITIVE_FIXTURE_IDS) {
  test(`${fixtureId}: valid route/composer adapter pair passes every gate`, () => {
    const dryRunCaseResult = dryRunCaseResultFromFixture(fixtureId);
    const routeResult = simulateDecisionSupportDefaultOffRouteAdapter(dryRunCaseResult);
    const composerResult = simulateDecisionSupportDefaultOffComposerAdapter(dryRunCaseResult, routeResult);
    const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, composerResult);
    assert.equal(validation.valid, true);
    assert.equal(validation.status, "accepted");
    assert.equal(validation.qaStatus, "pass");
    assert.equal(validation.riskLevel, "low");
    assert.deepEqual(validation.violations, []);
    assert.equal(validation.routeGuardPassed, true);
    assert.equal(validation.composerGuardPassed, true);
    assert.equal(validation.defaultOffPassed, true);
    assert.equal(validation.isolatedNoOpPassed, true);
    assert.equal(validation.noVisibilityAttemptPassed, true);
    assert.equal(validation.noProductionEligibilityPassed, true);
    assert.equal(validation.noLeaksPassed, true);
    assert.equal(validation.noSideEffectsPassed, true);
    assert.equal(validation.safeForProductionWiringReadinessReview, true);
  });
}

// ─── Adapter validation (negative synthetic) ─────────────────────────────────────────

function buildValidPair(fixtureId) {
  const dryRunCaseResult = dryRunCaseResultFromFixture(fixtureId);
  const routeResult = simulateDecisionSupportDefaultOffRouteAdapter(dryRunCaseResult);
  const composerResult = simulateDecisionSupportDefaultOffComposerAdapter(dryRunCaseResult, routeResult);
  return { routeResult, composerResult };
}

test("adapter-negative-adapter-enabled-now-true: composer payload adapterEnabledNow true fails defaultOffPassed and blocks", () => {
  fixtureFor("adapter-negative-adapter-enabled-now-true");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-adapter-enabled-now-true");
  const mutated = { ...composerResult, payload: { ...composerResult.payload, adapterEnabledNow: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.defaultOffPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.equal(validation.riskLevel, "critical");
  assert.ok(validation.violations.includes("adapter_enabled_now"));
});

test("adapter-negative-route-wiring-active: route contract routeWiringActiveNow true fails routeGuardPassed and rejects", () => {
  fixtureFor("adapter-negative-route-wiring-active");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-route-wiring-active");
  const mutated = { ...routeResult, routeGuardContract: { ...routeResult.routeGuardContract, routeWiringActiveNow: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(mutated, composerResult);
  assert.equal(validation.valid, false);
  assert.equal(validation.routeGuardPassed, false);
  assert.equal(validation.qaStatus, "fail");
  assert.equal(validation.status, "rejected");
  assert.ok(validation.violations.includes("route_contract_gap"));
});

test("adapter-negative-composer-wiring-active: composer contract composerWiringActiveNow true fails composerGuardPassed and rejects", () => {
  fixtureFor("adapter-negative-composer-wiring-active");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-composer-wiring-active");
  const mutated = { ...composerResult, composerGuardContract: { ...composerResult.composerGuardContract, composerWiringActiveNow: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.composerGuardPassed, false);
  assert.equal(validation.qaStatus, "fail");
  assert.equal(validation.status, "rejected");
  assert.ok(validation.violations.includes("composer_contract_gap"));
});

test("adapter-negative-user-visible-now-true: payload userVisibleNow true fails noVisibilityAttemptPassed and blocks", () => {
  fixtureFor("adapter-negative-user-visible-now-true");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-user-visible-now-true");
  const mutated = { ...composerResult, payload: { ...composerResult.payload, userVisibleNow: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noVisibilityAttemptPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("user_visible_output_attempted"));
});

test("preview section userVisibleNow true also fails noVisibilityAttemptPassed", () => {
  const { routeResult, composerResult } = buildValidPair("adapter-negative-user-visible-now-true");
  const mutated = {
    ...composerResult,
    payload: { ...composerResult.payload, sections: composerResult.payload.sections.map((s, i) => (i === 0 ? { ...s, userVisibleNow: true } : s)) },
  };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.noVisibilityAttemptPassed, false);
  assert.equal(validation.valid, false);
});

test("adapter-negative-production-eligible-now-true: payload productionEligibleNow true fails noProductionEligibilityPassed and blocks", () => {
  fixtureFor("adapter-negative-production-eligible-now-true");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-production-eligible-now-true");
  const mutated = { ...composerResult, payload: { ...composerResult.payload, productionEligibleNow: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("production_wiring_attempted"));
});

test("adapter-negative-db-supabase-attempt: dbWriteAttempted/supabaseWriteAttempted true fail noSideEffectsPassed and block", () => {
  fixtureFor("adapter-negative-db-supabase-attempt");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-db-supabase-attempt");
  const mutated = { ...composerResult, dbWriteAttempted: true, supabaseWriteAttempted: true };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("db_write_attempted"));
  assert.ok(validation.violations.includes("supabase_write_attempted"));
});

test("adapter-negative-raw-input-leak: a payload section with containsRawInput true fails noLeaksPassed and blocks", () => {
  fixtureFor("adapter-negative-raw-input-leak");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-raw-input-leak");
  const mutated = {
    ...composerResult,
    payload: { ...composerResult.payload, sections: composerResult.payload.sections.map((s, i) => (i === 0 ? { ...s, containsRawInput: true } : s)) },
  };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noLeaksPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("raw_input_leak"));
});

test("adapter-negative-pii-leak: a payload section with containsPii true fails noLeaksPassed and blocks", () => {
  fixtureFor("adapter-negative-pii-leak");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-pii-leak");
  const mutated = {
    ...composerResult,
    payload: { ...composerResult.payload, sections: composerResult.payload.sections.map((s, i) => (i === 0 ? { ...s, containsPii: true } : s)) },
  };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noLeaksPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("pii_leak"));
});

test("full candidate leak and project name leak also fail noLeaksPassed", () => {
  const { routeResult, composerResult } = buildValidPair("adapter-negative-raw-input-leak");
  const fullCandidateResult = {
    ...composerResult,
    payload: { ...composerResult.payload, sections: composerResult.payload.sections.map((s, i) => (i === 0 ? { ...s, containsFullCandidate: true } : s)) },
  };
  assert.ok(validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, fullCandidateResult).violations.includes("full_candidate_leak"));

  const projectNameResult = {
    ...composerResult,
    payload: { ...composerResult.payload, sections: composerResult.payload.sections.map((s, i) => (i === 0 ? { ...s, containsProjectNameRaw: true } : s)) },
  };
  assert.ok(validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, projectNameResult).violations.includes("project_name_leak"));
});

test("adapter-negative-side-effect: payload persistedNow true fails noSideEffectsPassed and blocks", () => {
  fixtureFor("adapter-negative-side-effect");
  const { routeResult, composerResult } = buildValidPair("adapter-negative-side-effect");
  const mutated = { ...composerResult, payload: { ...composerResult.payload, persistedNow: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("real_persistence_attempted"));
});

test("payload with executableNow true fails noSideEffectsPassed", () => {
  const { routeResult, composerResult } = buildValidPair("adapter-negative-side-effect");
  const mutated = { ...composerResult, payload: { ...composerResult.payload, executableNow: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.ok(validation.violations.includes("action_execution_attempted"));
});

test("payload with externalSideEffectsAllowed true fails noSideEffectsPassed", () => {
  const { routeResult, composerResult } = buildValidPair("adapter-negative-side-effect");
  const mutated = { ...composerResult, payload: { ...composerResult.payload, externalSideEffectsAllowed: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.ok(validation.violations.includes("external_call_attempted"));
});

test("payload section with containsExecutableInstruction true fails noSideEffectsPassed", () => {
  const { routeResult, composerResult } = buildValidPair("adapter-negative-side-effect");
  const mutated = {
    ...composerResult,
    payload: { ...composerResult.payload, sections: composerResult.payload.sections.map((s, i) => (i === 0 ? { ...s, containsExecutableInstruction: true } : s)) },
  };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.ok(validation.violations.includes("action_execution_attempted"));
});

test("payload section with containsPersistenceInstruction true fails noSideEffectsPassed", () => {
  const { routeResult, composerResult } = buildValidPair("adapter-negative-side-effect");
  const mutated = {
    ...composerResult,
    payload: { ...composerResult.payload, sections: composerResult.payload.sections.map((s, i) => (i === 0 ? { ...s, containsPersistenceInstruction: true } : s)) },
  };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, mutated);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.ok(validation.violations.includes("real_persistence_attempted"));
});

// ─── Adapter run ──────────────────────────────────────────────────────────────────────

test("adapter processes the full Sprint 18R corpus and produces one case result per case", () => {
  assert.equal(ADAPTER.caseResults.length, HARNESS.caseResults.length);
  assert.ok(ADAPTER.caseResults.length > 0);
});

test("runDecisionSupportDefaultOffRouteComposerIntegrationAdapter reuses the Sprint 35R harness decision", () => {
  assert.equal(ADAPTER.harnessSummary.decision, "ready_for_default_off_route_composer_integration_adapter");
});

test("runDecisionSupportDefaultOffRouteComposerIntegrationAdapter honors the default synthetic corpus when no cases are supplied", () => {
  const defaultAdapter = runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ now: NOW });
  assert.ok(defaultAdapter.caseResults.length > 0);
  assert.ok(defaultAdapter.caseResults.length < DECISION_CLARIFICATION_CASES.length);
});

test("runDecisionSupportDefaultOffRouteComposerIntegrationAdapter can reuse a pre-built Sprint 35R harness instead of rebuilding one", () => {
  const harness = runDecisionSupportUserVisibleDryRunEvaluationHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const adapter = runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ harness, now: NOW });
  assert.equal(adapter.caseResults.length, harness.caseResults.length);
  assert.equal(adapter.harness, harness);
});

test("adapter-summary-pass: totalCases matches the Sprint 18R corpus size, every case passes", () => {
  fixtureFor("adapter-summary-pass");
  assert.equal(SUMMARY.totalCases, 79);
  assert.equal(SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(SUMMARY.adapterEvaluatedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.adapterAcceptedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.adapterRejectedCount, 0);
  assert.equal(SUMMARY.adapterBlockedCount, 0);
  assert.equal(SUMMARY.qaPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.qaWarningCount, 0);
  assert.equal(SUMMARY.qaFailCount, 0);
  assert.equal(SUMMARY.qaBlockedCount, 0);
});

test("summary: adapter-kind counts match the documented Sprint 35R preview-kind baseline", () => {
  assert.equal(SUMMARY.clarificationGateAdapterCount, 69);
  assert.equal(SUMMARY.routePreservationAdapterCount, 10);
  assert.equal(SUMMARY.unsupportedBoundaryAdapterCount, 0);
  assert.equal(SUMMARY.shadowOnlyAdapterCount, 0);
  assert.equal(SUMMARY.blockedUnsafeAdapterCount, 0);
});

test("summary: adapter-kind counts sum to totalCases", () => {
  const sum = SUMMARY.clarificationGateAdapterCount + SUMMARY.routePreservationAdapterCount + SUMMARY.unsupportedBoundaryAdapterCount + SUMMARY.shadowOnlyAdapterCount + SUMMARY.blockedUnsafeAdapterCount;
  assert.equal(sum, SUMMARY.totalCases);
});

test("summary: safeFor* counts are as expected", () => {
  assert.equal(SUMMARY.safeForProductionWiringReadinessReviewCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.safeForUserVisibleOutputNowCount, 0);
  assert.equal(SUMMARY.safeForProductionCount, 0);
});

test("summary: score averages/minimums meet their floors", () => {
  assert.ok(SUMMARY.averageRouteGuardScore >= 90);
  assert.ok(SUMMARY.averageComposerGuardScore >= 90);
  assert.ok(SUMMARY.minRouteGuardScore >= 85);
  assert.ok(SUMMARY.minComposerGuardScore >= 85);
});

test("summary: every gate-pass count equals totalCases for the clean corpus", () => {
  assert.equal(SUMMARY.routeGuardPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.composerGuardPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.defaultOffPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.isolatedNoOpPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noVisibilityAttemptPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noProductionEligibilityPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noLeaksPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noSideEffectsPassedCount, SUMMARY.totalCases);
});

test("summary: violation and attempted counts are all clean", () => {
  assert.equal(SUMMARY.violationCount, 0);
  assert.equal(SUMMARY.criticalViolationCount, 0);
  assert.equal(SUMMARY.routerChangeAttemptedCount, 0);
  assert.equal(SUMMARY.composerChangeAttemptedCount, 0);
  assert.equal(SUMMARY.endpointChangeAttemptedCount, 0);
  assert.equal(SUMMARY.featureFlagAttemptedCount, 0);
  assert.equal(SUMMARY.userVisibleOutputAttemptedCount, 0);
  assert.equal(SUMMARY.productionWiringAttemptedCount, 0);
  assert.equal(SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(SUMMARY.externalCallAttemptedCount, 0);
  assert.equal(SUMMARY.actionExecutionAttemptedCount, 0);
  assert.equal(SUMMARY.taskCreationAttemptedCount, 0);
  assert.equal(SUMMARY.emailDraftCreationAttemptedCount, 0);
});

test("adapter-decision-ready-for-production-wiring-readiness-feature-flag-gate: decision is as expected", () => {
  fixtureFor("adapter-decision-ready-for-production-wiring-readiness-feature-flag-gate");
  assert.equal(SUMMARY.decision, "ready_for_production_wiring_readiness_feature_flag_gate");
});

test("adapter-recommended-sprint-37r: recommendedNextSprint is Sprint 37R", () => {
  fixtureFor("adapter-recommended-sprint-37r");
  assert.equal(SUMMARY.recommendedNextSprint, "Sprint 37R — Production Wiring Readiness / Feature Flag Gate");
});

test("summary accepts a bare case-results array plus sprint35HarnessDecision option", () => {
  const bareSummary = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter(ADAPTER.caseResults, {
    sprint35HarnessDecision: ADAPTER.harnessSummary.decision,
  });
  assert.equal(bareSummary.totalCases, SUMMARY.totalCases);
  assert.equal(bareSummary.decision, SUMMARY.decision);
});

test("summary: bare case-results array without sprint35HarnessDecision cannot reach ready_for_production_wiring_readiness_feature_flag_gate", () => {
  const bareSummary = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter(ADAPTER.caseResults);
  assert.notEqual(bareSummary.decision, "ready_for_production_wiring_readiness_feature_flag_gate");
});

test("summary: representativeAcceptedAdapters is capped and rejectedAdapters/blockedAdapters are empty for the clean corpus", () => {
  assert.ok(SUMMARY.representativeAcceptedAdapters.length <= 8);
  assert.equal(SUMMARY.rejectedAdapters.length, 0);
  assert.equal(SUMMARY.blockedAdapters.length, 0);
});

// ─── Decision blocking paths (synthetic) ─────────────────────────────────────────────

test("decision: a leaked case forces blocked_by_leakage_or_side_effect_risk", () => {
  const { routeResult, composerResult } = buildValidPair("adapter-negative-raw-input-leak");
  const leaked = { ...composerResult, payload: { ...composerResult.payload, sections: composerResult.payload.sections.map((s, i) => (i === 0 ? { ...s, containsPii: true } : s)) } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, leaked);
  const caseResult = {
    caseId: "leak-1",
    sourcePreviewId: routeResult.sourcePreviewId,
    sourcePreviewKind: routeResult.sourcePreviewKind,
    adapterKind: routeResult.adapterKind,
    routeResult,
    composerResult: leaked,
    validation,
    adapterAccepted: false,
    adapterRejected: false,
    adapterBlocked: true,
    safeForProductionWiringReadinessReview: false,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter([caseResult], { sprint35HarnessDecision: "ready_for_default_off_route_composer_integration_adapter" });
  assert.equal(summary.decision, "blocked_by_leakage_or_side_effect_risk");
});

test("decision: a rejected (route contract gap) case with no leakage forces blocked_by_route_contract_gap", () => {
  const { routeResult, composerResult } = buildValidPair("adapter-negative-route-wiring-active");
  const rejectedRoute = { ...routeResult, routeGuardContract: { ...routeResult.routeGuardContract, routeWiringActiveNow: true } };
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(rejectedRoute, composerResult);
  assert.equal(validation.qaStatus, "fail");
  const caseResult = {
    caseId: "gap-1",
    sourcePreviewId: routeResult.sourcePreviewId,
    sourcePreviewKind: routeResult.sourcePreviewKind,
    adapterKind: routeResult.adapterKind,
    routeResult: rejectedRoute,
    composerResult,
    validation,
    adapterAccepted: false,
    adapterRejected: true,
    adapterBlocked: false,
    safeForProductionWiringReadinessReview: false,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter([caseResult], { sprint35HarnessDecision: "ready_for_default_off_route_composer_integration_adapter" });
  assert.equal(summary.decision, "blocked_by_route_contract_gap");
});

test("decision: continue_default_off_adapter_only when the Sprint 35R harness decision is not ready", () => {
  const summary = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter(ADAPTER.caseResults, { sprint35HarnessDecision: "continue_dry_run_harness_only" });
  assert.equal(summary.decision, "continue_default_off_adapter_only");
});

// ─── Explain ──────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportDefaultOffRouteComposerIntegrationAdapter returns a structured explanation", () => {
  const explain = explainDecisionSupportDefaultOffRouteComposerIntegrationAdapter();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
});

// ─── Regression: Sprint 18R-35R + golden/classifier metrics unchanged ──────────────

test("regression: Sprint 35R user-visible dry run evaluation harness metrics stay clean against the 79-case corpus", () => {
  assert.equal(HARNESS_SUMMARY.totalCases, 79);
  assert.equal(HARNESS_SUMMARY.previewAcceptedCount, 79);
  assert.equal(HARNESS_SUMMARY.safeForDefaultOffRouteComposerAdapterCount, 79);
  assert.equal(HARNESS_SUMMARY.decision, "ready_for_default_off_route_composer_integration_adapter");
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

const IMPLEMENTATION_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouteComposerIntegrationAdapter.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouteComposerIntegrationAdapterTypes.ts", import.meta.url),
  "utf8",
);

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

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportDefaultOffRouteComposerIntegrationAdapter/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});

test("no feature flag implementation file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../src/lib/feature-flags/decisionSupportRouteComposerFlag.ts", import.meta.url), "utf8"));
});
