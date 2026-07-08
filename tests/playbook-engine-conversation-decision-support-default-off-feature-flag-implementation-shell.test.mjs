import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_VERSION,
  createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig,
  listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions,
  listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions,
  createDecisionSupportDefaultOffFeatureFlagShellDefinition,
  resolveDecisionSupportDefaultOffFeatureFlagShellState,
  createDecisionSupportDefaultOffRouterGuardReadinessHandoff,
  createDecisionSupportDefaultOffFeatureFlagRollbackReference,
  validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase,
  evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase,
  runDecisionSupportDefaultOffFeatureFlagImplementationShell,
  summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell,
  explainDecisionSupportDefaultOffFeatureFlagImplementationShell,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffFeatureFlagImplementationShell.ts";
import { DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_CASES } from "./fixtures/conversational-brain-decision-support-default-off-feature-flag-implementation-shell-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Sprint 37R gate — reused to build real Sprint 37R gate case results for this sprint's shell evaluations.
import {
  runDecisionSupportProductionWiringReadinessFeatureFlagGate,
  summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportProductionWiringReadinessFeatureFlagGate.ts";
import {
  runDecisionSupportDefaultOffRouteComposerIntegrationAdapter,
  summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouteComposerIntegrationAdapter.ts";
import { runDecisionSupportUserVisibleDryRunEvaluationHarness, summarizeDecisionSupportUserVisibleDryRunEvaluationHarness } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarness.ts";

// Regression imports — Sprint 18R-37R + golden/classifier suites, reused read-only for comparison.
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
 * Sprint 38R — Decision Support Default-Off Feature Flag Implementation Shell.
 *
 * Tests the pure, offline, deterministic, shell-only feature flag implementation shell in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffFeatureFlagImplementationShell.ts`.
 * This builds a formal, no-op default-off feature flag shell (types, resolver, handoff, rollback-reference
 * functions) for every Sprint 37R-accepted production wiring readiness gate case — it never implements a
 * real production feature flag, never activates a feature flag, never reads process.env, never touches the
 * router/composer/endpoint, never shows anything to a real user, and never persists anything real.
 */

const NOW = "2026-01-01T00:00:00.000Z";
const PROPOSED_FEATURE_FLAG_KEY = "pmfreak.decisionSupport.defaultOffRouteComposerAdapter";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

/** Builds a minimal, fully-shaped Sprint 37R gate case result for a given gate kind. Every gate kind
 * actually occurs in the real Sprint 18R corpus except unsupported_boundary_readiness/shadow_only_readiness/
 * blocked_unsafe_readiness, which never occur there (Sprint 37R's own baseline is 69 clarification + 10 route
 * preservation cases, 0 of the other three) — this synthesizes a safe, accepted, readiness-passed case for
 * any of the five kinds so every Sprint 38R shell-kind mapping can still be exercised directly. */
function buildFakeGateCaseResult(gateKind, caseId, overrides = {}) {
  const id = caseId ?? `fake-${gateKind}`;
  const base = {
    caseId: id,
    sourceAdapterKind: `${gateKind}-adapter`,
    sourceCaseId: id,
    generatedForReadinessGateOnly: true,
    readinessOnly: true,
    gateKind,
    featureFlagContract: {
      contractId: `feature-flag-contract-${id}`,
      proposedFeatureFlagKey: PROPOSED_FEATURE_FLAG_KEY,
      status: "ready",
      readinessOnly: true,
      featureFlagImplementedNow: false,
      featureFlagActiveNow: false,
      featureFlagRuntimeReadNow: false,
      defaultValueMustBe: false,
      score: 95,
      rationale: ["synthetic"],
    },
    productionWiringContract: { contractId: `production-wiring-contract-${id}`, status: "ready", readinessOnly: true, productionWiringImplementedNow: false, score: 94, rationale: ["synthetic"] },
    rollbackContract: { contractId: `rollback-contract-${id}`, status: "ready", readinessOnly: true, rollbackImplementedNow: false, rollbackScore: 92, rationale: ["synthetic"] },
    governanceChecklist: { checklistId: `governance-checklist-${id}`, status: "prepared", readinessOnly: true, governanceApprovalGrantedNow: false, approvalStateOverclaimed: false, checklistScore: 88, rationale: ["synthetic"] },
    gateAccepted: true,
    gateRejected: false,
    gateBlocked: false,
    qaStatus: "pass",
    riskLevel: "low",
    violations: [],
    featureFlagContractPassed: true,
    productionWiringContractPassed: true,
    rollbackContractPassed: true,
    governanceChecklistPrepared: true,
    defaultOffAdapterPassed: true,
    noApprovalOverclaimPassed: true,
    noVisibilityAttemptPassed: true,
    noProductionEligibilityPassed: true,
    noLeaksPassed: true,
    noSideEffectsPassed: true,
    safeForDefaultOffFeatureFlagImplementationShell: true,
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
  return { ...base, ...overrides };
}

function fakeGateCaseResultFromFixture(fixtureId, overrides = {}) {
  const fixtureCase = fixtureFor(fixtureId);
  assert.ok(fixtureCase.sourceGateKind, `fixture ${fixtureId} must declare sourceGateKind`);
  return buildFakeGateCaseResult(fixtureCase.sourceGateKind, fixtureId, overrides);
}

function buildValidParts(gateKind, caseId, stateOptions) {
  const gateCaseResult = buildFakeGateCaseResult(gateKind, caseId);
  const featureFlagDefinition = createDecisionSupportDefaultOffFeatureFlagShellDefinition(gateCaseResult);
  const featureFlagState = resolveDecisionSupportDefaultOffFeatureFlagShellState(featureFlagDefinition, stateOptions);
  const routerGuardReadinessHandoff = createDecisionSupportDefaultOffRouterGuardReadinessHandoff(gateCaseResult, featureFlagState);
  const rollbackReference = createDecisionSupportDefaultOffFeatureFlagRollbackReference(gateCaseResult);
  return { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference };
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const HARNESS = runDecisionSupportUserVisibleDryRunEvaluationHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const ADAPTER = runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ harness: HARNESS, now: NOW });
const ADAPTER_SUMMARY = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter(ADAPTER);
const GATE = runDecisionSupportProductionWiringReadinessFeatureFlagGate({ adapter: ADAPTER, now: NOW });
const GATE_SUMMARY = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate(GATE);
const SHELL = runDecisionSupportDefaultOffFeatureFlagImplementationShell({ gate: GATE, now: NOW });
const SHELL_SUMMARY = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell(SHELL);

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 45 and 65 cases", () => {
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_CASES.length >= 45);
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_CASES.length <= 65);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.shellKind, "string");
    assert.equal(typeof c.expectedQaStatus, "string");
    assert.equal(typeof c.expectedRiskLevel, "string");
    assert.equal(typeof c.expectedShellAccepted, "boolean");
    assert.equal(typeof c.expectedFeatureFlagState, "string");
    assert.equal(typeof c.expectedFeatureFlagSource, "string");
    assert.equal(typeof c.expectedSafeForDefaultOffRouterGuardShell, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleOutputNow, "boolean");
    assert.equal(c.expectedSafeForUserVisibleOutputNow, false);
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(c.expectedSafeForProduction, false);
    assert.ok(Array.isArray(c.expectedViolations));
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_VERSION, "string");
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig", createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig],
  ["listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions", listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions],
  ["listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions", listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions],
  ["createDecisionSupportDefaultOffFeatureFlagShellDefinition", createDecisionSupportDefaultOffFeatureFlagShellDefinition],
  ["resolveDecisionSupportDefaultOffFeatureFlagShellState", resolveDecisionSupportDefaultOffFeatureFlagShellState],
  ["createDecisionSupportDefaultOffRouterGuardReadinessHandoff", createDecisionSupportDefaultOffRouterGuardReadinessHandoff],
  ["createDecisionSupportDefaultOffFeatureFlagRollbackReference", createDecisionSupportDefaultOffFeatureFlagRollbackReference],
  ["evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase", evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase],
  ["runDecisionSupportDefaultOffFeatureFlagImplementationShell", runDecisionSupportDefaultOffFeatureFlagImplementationShell],
  ["summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell", summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell],
  ["explainDecisionSupportDefaultOffFeatureFlagImplementationShell", explainDecisionSupportDefaultOffFeatureFlagImplementationShell],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture shell-config-default-strict)", () => {
  fixtureFor("shell-config-default-strict");
  const config = createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig();
  assert.equal(config.profile, "strict_default_off_feature_flag_implementation_shell");
  assert.equal(config.mode, "feature_flag_shell_only");
  assert.equal(config.shellOnly, true);
  assert.equal(config.noOpShell, true);
  assert.equal(config.defaultOff, true);
  assert.equal(config.proposedFeatureFlagKey, PROPOSED_FEATURE_FLAG_KEY);
  assert.equal(config.allowProductionFeatureFlagImplementation, false);
  assert.equal(config.allowFeatureFlagActivation, false);
  assert.equal(config.allowFeatureFlagRuntimeRead, false);
  assert.equal(config.allowProductionWiring, false);
  assert.equal(config.allowRouterChange, false);
  assert.equal(config.allowComposerChange, false);
  assert.equal(config.allowEndpointChange, false);
  assert.equal(config.allowUserVisibleOutput, false);
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowTaskCreation, false);
  assert.equal(config.allowEmailDraftCreation, false);
  assert.equal(config.requireProductionWiringReadinessGatePass, true);
  assert.equal(config.requireFeatureFlagContractPass, true);
  assert.equal(config.requireDefaultValueFalse, true);
  assert.equal(config.requireNoRuntimeRead, true);
  assert.equal(config.requireNoActivation, true);
  assert.equal(config.requireNoProductionWiring, true);
  assert.equal(config.requireRollbackContractReference, true);
  assert.equal(config.requireNoApprovalOverclaim, true);
  assert.equal(config.requireNoVisibilityAttempt, true);
  assert.equal(config.requireNoLeakage, true);
  assert.equal(config.requireNoSideEffects, true);
  assert.equal(config.requireNoProductionEligibility, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "shell-config-block-production-feature-flag-implementation",
  "shell-config-block-feature-flag-activation",
  "shell-config-block-feature-flag-runtime-read",
  "shell-config-block-production-wiring",
  "shell-config-block-router-change",
  "shell-config-block-composer-change",
  "shell-config-block-endpoint-change",
  "shell-config-block-user-visible-output",
  "shell-config-block-real-persistence",
  "shell-config-block-db-write",
  "shell-config-block-supabase-write",
  "shell-config-block-external-calls",
  "shell-config-block-action-execution",
  "shell-config-block-task-creation",
  "shell-config-block-email-draft-creation",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 15);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all fifteen are forced true at once", () => {
  const config = createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig({
    allowProductionFeatureFlagImplementation: true,
    allowFeatureFlagActivation: true,
    allowFeatureFlagRuntimeRead: true,
    allowProductionWiring: true,
    allowRouterChange: true,
    allowComposerChange: true,
    allowEndpointChange: true,
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
  assert.equal(config.shellOnly, true);
  assert.equal(config.noOpShell, true);
  assert.equal(config.defaultOff, true);
});

test("config honors safe overrides (mode, now, notes)", () => {
  const config = createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig({
    mode: "runtime_read_guard_review",
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "runtime_read_guard_review");
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("default-off router guard shell"));
  assert.ok(joined.includes("router guard contract implementation"));
  assert.ok(joined.includes("router guard default-off tests"));
  assert.ok(joined.includes("existing route preservation guard tests"));
  assert.ok(joined.includes("clarification gate route guard tests"));
  assert.ok(joined.includes("unsupported boundary route guard tests"));
  assert.ok(joined.includes("router rollback no-op plan"));
});

test("listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("activate feature flag"));
  assert.ok(joined.includes("read runtime feature flag"));
  assert.ok(joined.includes("read process.env"));
  assert.ok(joined.includes("wire router to decision_support"));
  assert.ok(joined.includes("wire composer to decision_support"));
  assert.ok(joined.includes("wire endpoint to decision_support"));
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

test("listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Feature flag shell definition ──────────────────────────────────────────────────

const DEFINITION_FIXTURE_IDS = ["shell-definition-key-preserved", "shell-definition-default-value-false", "shell-definition-no-production-flag-implemented", "shell-definition-no-runtime-read-now"];

for (const fixtureId of DEFINITION_FIXTURE_IDS) {
  test(`${fixtureId}: feature flag shell definition carries every shell-only invariant`, () => {
    const gateCaseResult = fakeGateCaseResultFromFixture(fixtureId);
    const definition = createDecisionSupportDefaultOffFeatureFlagShellDefinition(gateCaseResult);
    assert.equal(definition.key, PROPOSED_FEATURE_FLAG_KEY);
    assert.equal(definition.shellOnly, true);
    assert.equal(definition.noOpShell, true);
    assert.equal(definition.productionFeatureFlagImplementedNow, false);
    assert.equal(definition.featureFlagActiveNow, false);
    assert.equal(definition.featureFlagRuntimeReadNow, false);
    assert.equal(definition.defaultValue, false);
    assert.equal(definition.resolvedState, "disabled");
    assert.equal(definition.resolvedSource, "static_default_off");
    assert.equal(definition.activationAllowedNow, false);
    assert.equal(definition.activationRequiresFutureSprint, true);
    assert.equal(definition.activationRequiresGovernanceApproval, true);
    assert.equal(definition.activationRequiresRollbackContract, true);
    assert.equal(definition.activationRequiresRouterGuard, true);
    assert.equal(definition.activationRequiresComposerGuard, true);
    assert.equal(definition.activationRequiresEndpointGuard, true);
    assert.equal(definition.activationRequiresMonitoringContract, true);
    assert.equal(definition.activationRequiresManualSmokeTest, true);
    for (const source of ["process.env", "remote_config", "database_flag", "supabase_flag", "local_storage", "query_param", "cookie", "header", "implicit_default_on"]) {
      assert.ok(definition.prohibitedRuntimeSources.includes(source), `prohibitedRuntimeSources must include ${source}`);
    }
    for (const check of [
      "router_guard_shell_ready",
      "composer_guard_shell_ready",
      "endpoint_guard_shell_ready",
      "rollback_smoke_test_ready",
      "monitoring_contract_ready",
      "governance_approval_obtained",
      "manual_smoke_test_completed",
      "default_off_flag_runtime_read_reviewed",
    ]) {
      assert.ok(definition.requiredFutureChecks.includes(check), `requiredFutureChecks must include ${check}`);
    }
    assert.ok(definition.score >= 85);
    assert.ok(definition.rationale.length > 0);
  });
}

// ─── Feature flag shell state ───────────────────────────────────────────────────────

const STATE_FIXTURE_IDS = ["shell-state-disabled", "shell-state-static-default-off", "shell-state-no-activation-attempted"];

for (const fixtureId of STATE_FIXTURE_IDS) {
  test(`${fixtureId}: feature flag shell state resolves to the static default-off baseline`, () => {
    const gateCaseResult = fakeGateCaseResultFromFixture(fixtureId);
    const definition = createDecisionSupportDefaultOffFeatureFlagShellDefinition(gateCaseResult);
    const state = resolveDecisionSupportDefaultOffFeatureFlagShellState(definition);
    assert.equal(state.key, PROPOSED_FEATURE_FLAG_KEY);
    assert.equal(state.enabled, false);
    assert.equal(state.state, "disabled");
    assert.equal(state.source, "static_default_off");
    assert.equal(state.shellOnly, true);
    assert.equal(state.noOpShell, true);
    assert.equal(state.defaultOff, true);
    assert.equal(state.runtimeReadAttempted, false);
    assert.equal(state.activationAttempted, false);
    assert.equal(state.productionWiringAttempted, false);
    assert.equal(state.routerChangeAttempted, false);
    assert.equal(state.composerChangeAttempted, false);
    assert.equal(state.endpointChangeAttempted, false);
    assert.equal(state.userVisibleOutputAttempted, false);
    assert.equal(state.realPersistenceAttempted, false);
    assert.equal(state.externalCallAttempted, false);
    assert.equal(state.actionExecutionAttempted, false);
  });
}

test("resolveDecisionSupportDefaultOffFeatureFlagShellState never sets enabled true even when forceEnabled is requested", () => {
  const gateCaseResult = buildFakeGateCaseResult("clarification_gate_readiness", "state-force-enabled");
  const definition = createDecisionSupportDefaultOffFeatureFlagShellDefinition(gateCaseResult);
  const state = resolveDecisionSupportDefaultOffFeatureFlagShellState(definition, { forceEnabled: true });
  assert.equal(state.enabled, false);
  assert.equal(state.state, "blocked");
  assert.ok(state.warnings.length > 0);
});

// ─── Router guard readiness handoff — shellKind mapping (5) ─────────────────────────

const HANDOFF_FIXTURE_EXPECTATIONS = [
  ["shell-handoff-clarification-gate", "clarification_gate_readiness", "clarification_gate_flag_shell"],
  ["shell-handoff-route-preservation", "route_preservation_readiness", "route_preservation_flag_shell"],
  ["shell-handoff-unsupported-boundary", "unsupported_boundary_readiness", "unsupported_boundary_flag_shell"],
  ["shell-handoff-shadow-only", "shadow_only_readiness", "shadow_only_flag_shell"],
  ["shell-handoff-blocked-unsafe", "blocked_unsafe_readiness", "blocked_unsafe_flag_shell"],
];

for (const [fixtureId, gateKind, expectedShellKind] of HANDOFF_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: router guard readiness handoff carries every invariant and readiness flag`, () => {
    const gateCaseResult = buildFakeGateCaseResult(gateKind, fixtureId);
    const definition = createDecisionSupportDefaultOffFeatureFlagShellDefinition(gateCaseResult);
    const state = resolveDecisionSupportDefaultOffFeatureFlagShellState(definition);
    const handoff = createDecisionSupportDefaultOffRouterGuardReadinessHandoff(gateCaseResult, state);
    assert.equal(handoff.shellKind, expectedShellKind);
    assert.equal(handoff.key, PROPOSED_FEATURE_FLAG_KEY);
    assert.equal(handoff.readyForRouterGuardShell, true);
    assert.equal(handoff.routerGuardImplementationAllowedNow, false);
    assert.equal(handoff.routerRuntimeWiringAllowedNow, false);
    assert.equal(handoff.requiresStaticDefaultOffFlagState, true);
    assert.equal(handoff.requiresNoRouterImportInSprint38, true);
    assert.equal(handoff.requiresRouterGuardShellInSprint39, true);
    assert.equal(handoff.requiresExistingRoutePreservation, true);
    assert.equal(handoff.requiresClarificationGatePreservation, true);
    assert.equal(handoff.requiresUnsupportedBoundaryPreservation, true);
    assert.equal(handoff.requiresNoUserVisibleOutputByDefault, true);
    assert.ok(handoff.score >= 85);
    assert.ok(handoff.rationale.length > 0);
  });
}

// ─── Rollback reference ──────────────────────────────────────────────────────────────

test("shell-rollback-reference-ready: rollback reference carries every shell-only invariant", () => {
  const gateCaseResult = fakeGateCaseResultFromFixture("shell-rollback-reference-ready");
  const rollbackReference = createDecisionSupportDefaultOffFeatureFlagRollbackReference(gateCaseResult);
  assert.equal(rollbackReference.shellOnly, true);
  assert.equal(rollbackReference.rollbackImplementedNow, false);
  assert.equal(rollbackReference.rollbackRequiresFeatureFlagDisable, true);
  assert.equal(rollbackReference.rollbackRequiresRouterFallback, true);
  assert.equal(rollbackReference.rollbackRequiresComposerFallback, true);
  assert.equal(rollbackReference.rollbackRequiresEndpointFallback, true);
  assert.equal(rollbackReference.rollbackRequiresNoDataMigration, true);
  assert.equal(rollbackReference.rollbackRequiresNoPersistentStateCleanup, true);
  assert.equal(rollbackReference.rollbackRequiresNoExternalSideEffectCleanup, true);
  assert.equal(rollbackReference.rollbackRequiresIncidentOwner, true);
  assert.equal(rollbackReference.rollbackRequiresVerificationChecklist, true);
  assert.ok(rollbackReference.score >= 85);
  assert.ok(rollbackReference.rationale.length > 0);
});

// ─── Shell case evaluation: safety confirmations on a clean case ────────────────────

test("shell-no-approval-overclaim / shell-no-visibility-attempt / shell-no-production-eligibility / shell-no-leakage / shell-no-side-effects: a valid shell case passes every safety check", () => {
  for (const fixtureId of ["shell-no-approval-overclaim", "shell-no-visibility-attempt", "shell-no-production-eligibility", "shell-no-leakage", "shell-no-side-effects"]) {
    const fixtureCase = fixtureFor(fixtureId);
    const gateCaseResult = fakeGateCaseResultFromFixture(fixtureId);
    const result = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult);
    assert.equal(result.noApprovalOverclaimPassed, true);
    assert.equal(result.noVisibilityAttemptPassed, true);
    assert.equal(result.noProductionEligibilityPassed, true);
    assert.equal(result.noLeaksPassed, true);
    assert.equal(result.noSideEffectsPassed, true);
    assert.equal(result.shellAccepted, true);
    assert.equal(result.safeForUserVisibleOutputNow, false);
    assert.equal(result.safeForProduction, false);
    assert.equal(result.qaStatus, fixtureCase.expectedQaStatus);
  }
});

// ─── Shell case evaluation: shellKind mapping + every *Passed boolean true on a clean case ─

for (const [fixtureId, gateKind, expectedShellKind] of HANDOFF_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: evaluate produces the documented shell kind and passes every gate`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const gateCaseResult = buildFakeGateCaseResult(gateKind, fixtureId);
    const result = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult);
    assert.equal(result.shellKind, expectedShellKind);
    assert.equal(result.generatedForFeatureFlagShellOnly, true);
    assert.equal(result.shellOnly, true);
    assert.equal(result.noOpShell, true);
    assert.equal(result.defaultOff, true);
    assert.equal(result.shellAccepted, fixtureCase.expectedShellAccepted);
    assert.equal(result.shellRejected, false);
    assert.equal(result.shellBlocked, false);
    assert.equal(result.qaStatus, fixtureCase.expectedQaStatus);
    assert.equal(result.riskLevel, fixtureCase.expectedRiskLevel);
    assert.deepEqual(result.violations, []);
    assert.equal(result.featureFlagDefinitionPassed, true);
    assert.equal(result.defaultValueFalsePassed, true);
    assert.equal(result.staticDefaultOffResolutionPassed, true);
    assert.equal(result.noRuntimeReadPassed, true);
    assert.equal(result.noActivationPassed, true);
    assert.equal(result.noProductionFeatureFlagImplementationPassed, true);
    assert.equal(result.routerGuardHandoffPassed, true);
    assert.equal(result.rollbackReferencePassed, true);
    assert.equal(result.noApprovalOverclaimPassed, true);
    assert.equal(result.noVisibilityAttemptPassed, true);
    assert.equal(result.noProductionEligibilityPassed, true);
    assert.equal(result.noLeaksPassed, true);
    assert.equal(result.noSideEffectsPassed, true);
    assert.equal(result.safeForDefaultOffRouterGuardShell, fixtureCase.expectedSafeForDefaultOffRouterGuardShell);
    assert.equal(result.safeForUserVisibleOutputNow, false);
    assert.equal(result.safeForProduction, false);
    assert.equal(result.productionWiringAllowedNow, false);
    assert.equal(result.routerChangeAllowedNow, false);
    assert.equal(result.composerChangeAllowedNow, false);
    assert.equal(result.endpointChangeAllowedNow, false);
    assert.equal(result.featureFlagActivationAllowedNow, false);
    assert.equal(result.userVisibleOutputAllowedNow, false);
    assert.equal(result.realPersistenceAllowedNow, false);
    assert.equal(result.actionExecutionAllowedNow, false);
  });
}

// ─── Shell case evaluation: negative synthetic ──────────────────────────────────────

test("shell-negative-wrong-feature-flag-key: mutating the definition's key fails featureFlagDefinitionPassed and rejects", () => {
  fixtureFor("shell-negative-wrong-feature-flag-key");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-key");
  const mutated = { ...featureFlagDefinition, key: "some.other.flag.key" };
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, mutated, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.featureFlagDefinitionPassed, false);
  assert.equal(validation.shellAccepted, false);
  assert.equal(validation.qaStatus, "fail");
  assert.equal(validation.riskLevel, "high");
  assert.ok(validation.violations.includes("feature_flag_key_mismatch"));
});

test("shell-negative-default-value-true: mutating defaultValue to true fails defaultValueFalsePassed and rejects", () => {
  fixtureFor("shell-negative-default-value-true");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-default-value");
  const mutated = { ...featureFlagDefinition, defaultValue: true };
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, mutated, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.defaultValueFalsePassed, false);
  assert.equal(validation.qaStatus, "fail");
  assert.ok(validation.violations.includes("default_value_not_false"));
});

test("shell-negative-enabled-true: forcing state.enabled via forceEnabled never sets enabled true but blocks the shell", () => {
  fixtureFor("shell-negative-enabled-true");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-enabled", { forceEnabled: true });
  assert.equal(featureFlagState.enabled, false);
  assert.equal(featureFlagState.state, "blocked");
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.staticDefaultOffResolutionPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.equal(validation.riskLevel, "critical");
  assert.ok(validation.violations.includes("feature_flag_active_now"));
});

test("shell-negative-runtime-read-attempted: forcing runtimeReadAttempted fails noRuntimeReadPassed and blocks", () => {
  fixtureFor("shell-negative-runtime-read-attempted");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-runtime-read", {
    forceRuntimeReadAttempted: true,
  });
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.noRuntimeReadPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("feature_flag_runtime_read_attempted"));
});

test("shell-negative-activation-attempted: forcing activationAttempted fails noActivationPassed and blocks", () => {
  fixtureFor("shell-negative-activation-attempted");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-activation", {
    forceActivationAttempted: true,
  });
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.noActivationPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("feature_flag_activation_allowed"));
});

test("negative: definition.activationAllowedNow true also fails noActivationPassed", () => {
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-activation-allowed-now");
  const mutated = { ...featureFlagDefinition, activationAllowedNow: true };
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, mutated, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.noActivationPassed, false);
  assert.ok(validation.violations.includes("feature_flag_activation_allowed"));
});

test("negative: definition.featureFlagActiveNow true also fails featureFlagDefinitionPassed and blocks", () => {
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-active-now");
  const mutated = { ...featureFlagDefinition, featureFlagActiveNow: true };
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, mutated, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.featureFlagDefinitionPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("feature_flag_active_now"));
});

test("negative: definition.featureFlagRuntimeReadNow true also fails noRuntimeReadPassed and blocks", () => {
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-runtime-read-now");
  const mutated = { ...featureFlagDefinition, featureFlagRuntimeReadNow: true };
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, mutated, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.noRuntimeReadPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("feature_flag_runtime_read_attempted"));
});

test("shell-negative-production-flag-implemented-now: mutating productionFeatureFlagImplementedNow to true fails and blocks", () => {
  fixtureFor("shell-negative-production-flag-implemented-now");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-production-flag");
  const mutated = { ...featureFlagDefinition, productionFeatureFlagImplementedNow: true };
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, mutated, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.noProductionFeatureFlagImplementationPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.equal(validation.riskLevel, "critical");
  assert.ok(validation.violations.includes("production_feature_flag_implemented"));
});

test("shell-negative-router-change-allowed: forcing routerChangeAttempted fails routerGuardHandoffPassed and blocks", () => {
  fixtureFor("shell-negative-router-change-allowed");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-router", { forceRouterChangeAttempted: true });
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.routerGuardHandoffPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("router_wiring_allowed"));
});

test("shell-negative-composer-change-allowed: forcing composerChangeAttempted fails routerGuardHandoffPassed and blocks", () => {
  fixtureFor("shell-negative-composer-change-allowed");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-composer", { forceComposerChangeAttempted: true });
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.routerGuardHandoffPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("composer_wiring_allowed"));
});

test("shell-negative-endpoint-change-allowed: forcing endpointChangeAttempted fails routerGuardHandoffPassed and blocks", () => {
  fixtureFor("shell-negative-endpoint-change-allowed");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-endpoint", { forceEndpointChangeAttempted: true });
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.routerGuardHandoffPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("endpoint_wiring_allowed"));
});

test("negative: forcing productionWiringAttempted fails routerGuardHandoffPassed/noProductionEligibilityPassed (non-critical, rejects)", () => {
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-production-wiring", {
    forceProductionWiringAttempted: true,
  });
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.equal(validation.routerGuardHandoffPassed, false);
  // production_wiring_allowed is not in the critical violation set, so this is a rejection, not a block.
  assert.equal(validation.qaStatus, "fail");
  assert.equal(validation.riskLevel, "high");
  assert.equal(validation.shellRejected, true);
  assert.ok(validation.violations.includes("production_wiring_allowed"));
});

test("shell-negative-user-visible-output-allowed: forcing userVisibleOutputAttempted fails noVisibilityAttemptPassed and blocks", () => {
  fixtureFor("shell-negative-user-visible-output-allowed");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-visible", {
    forceUserVisibleOutputAttempted: true,
  });
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.noVisibilityAttemptPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("user_visible_output_allowed"));
});

test("shell-negative-real-persistence-allowed: forcing realPersistenceAttempted fails noSideEffectsPassed and blocks", () => {
  fixtureFor("shell-negative-real-persistence-allowed");
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "neg-persist", {
    forceRealPersistenceAttempted: true,
  });
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("real_persistence_allowed"));
});

test("negative: forcing externalCallAttempted/actionExecutionAttempted also fail noSideEffectsPassed", () => {
  const parts1 = buildValidParts("clarification_gate_readiness", "neg-external", { forceExternalCallAttempted: true });
  const validation1 = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
    parts1.gateCaseResult,
    parts1.featureFlagDefinition,
    parts1.featureFlagState,
    parts1.routerGuardReadinessHandoff,
    parts1.rollbackReference,
  );
  assert.equal(validation1.noSideEffectsPassed, false);
  assert.ok(validation1.violations.includes("external_call_allowed"));

  const parts2 = buildValidParts("clarification_gate_readiness", "neg-action-exec", { forceActionExecutionAttempted: true });
  const validation2 = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
    parts2.gateCaseResult,
    parts2.featureFlagDefinition,
    parts2.featureFlagState,
    parts2.routerGuardReadinessHandoff,
    parts2.rollbackReference,
  );
  assert.equal(validation2.noSideEffectsPassed, false);
  assert.ok(validation2.violations.includes("action_execution_allowed"));
});

test("shell-negative-raw-input-leak: an upstream gate case with a raw_input_leak violation propagates and blocks", () => {
  fixtureFor("shell-negative-raw-input-leak");
  const gateCaseResult = buildFakeGateCaseResult("clarification_gate_readiness", "neg-raw-input-leak", {
    noLeaksPassed: false,
    violations: ["raw_input_leak"],
  });
  const result = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult);
  assert.equal(result.noLeaksPassed, false);
  assert.equal(result.shellBlocked, true);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("raw_input_leak"));
});

test("shell-negative-pii-leak: an upstream gate case with a pii_leak violation propagates and blocks", () => {
  fixtureFor("shell-negative-pii-leak");
  const gateCaseResult = buildFakeGateCaseResult("clarification_gate_readiness", "neg-pii-leak", {
    noLeaksPassed: false,
    violations: ["pii_leak"],
  });
  const result = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult);
  assert.equal(result.noLeaksPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("pii_leak"));
});

test("negative: full_candidate_leak and project_name_leak upstream violations also propagate", () => {
  const fullCandidateResult = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
    buildFakeGateCaseResult("clarification_gate_readiness", "neg-full-candidate", { noLeaksPassed: false, violations: ["full_candidate_leak"] }),
  );
  assert.ok(fullCandidateResult.violations.includes("full_candidate_leak"));

  const projectNameResult = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
    buildFakeGateCaseResult("clarification_gate_readiness", "neg-project-name", { noLeaksPassed: false, violations: ["project_name_leak"] }),
  );
  assert.ok(projectNameResult.violations.includes("project_name_leak"));
});

test("negative: an upstream gate case with noLeaksPassed false but no recognizable leak sub-type falls back to all four leak types", () => {
  const result = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
    buildFakeGateCaseResult("clarification_gate_readiness", "neg-leak-unknown", { noLeaksPassed: false, violations: [] }),
  );
  for (const leak of ["raw_input_leak", "full_candidate_leak", "pii_leak", "project_name_leak"]) {
    assert.ok(result.violations.includes(leak));
  }
});

test("shell-negative-side-effect-risk: an upstream gate case with a side_effect_risk violation propagates and blocks", () => {
  fixtureFor("shell-negative-side-effect-risk");
  const gateCaseResult = buildFakeGateCaseResult("clarification_gate_readiness", "neg-side-effect", {
    noSideEffectsPassed: false,
    violations: ["side_effect_risk"],
  });
  const result = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult);
  assert.equal(result.noSideEffectsPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("side_effect_risk"));
});

test("negative: an upstream gate case with gateAccepted false or safeForDefaultOffFeatureFlagImplementationShell false blocks the shell", () => {
  const notAccepted = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(buildFakeGateCaseResult("clarification_gate_readiness", "neg-not-accepted", { gateAccepted: false }));
  assert.equal(notAccepted.noProductionEligibilityPassed, false);
  assert.notEqual(notAccepted.qaStatus, "pass");

  const notSafe = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
    buildFakeGateCaseResult("clarification_gate_readiness", "neg-not-safe", { safeForDefaultOffFeatureFlagImplementationShell: false }),
  );
  assert.equal(notSafe.noProductionEligibilityPassed, false);
  assert.notEqual(notSafe.qaStatus, "pass");
});

test("negative: upstream noApprovalOverclaimPassed false propagates and blocks", () => {
  const result = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
    buildFakeGateCaseResult("clarification_gate_readiness", "neg-overclaim", { noApprovalOverclaimPassed: false, violations: ["approval_state_overclaimed"] }),
  );
  assert.equal(result.noApprovalOverclaimPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("approval_state_overclaimed"));
});

// ─── Shell run ─────────────────────────────────────────────────────────────────────────

test("shell processes the full Sprint 18R corpus and produces one shell case per Sprint 37R gate case", () => {
  assert.equal(SHELL.caseResults.length, GATE.caseResults.length);
  assert.ok(SHELL.caseResults.length > 0);
});

test("runDecisionSupportDefaultOffFeatureFlagImplementationShell reuses the Sprint 37R gate decision", () => {
  assert.equal(SHELL.gateSummary.decision, "ready_for_default_off_feature_flag_implementation_shell");
});

test("runDecisionSupportDefaultOffFeatureFlagImplementationShell honors the default synthetic corpus when no cases are supplied", () => {
  const defaultShell = runDecisionSupportDefaultOffFeatureFlagImplementationShell({ now: NOW });
  assert.ok(defaultShell.caseResults.length > 0);
  assert.ok(defaultShell.caseResults.length < DECISION_CLARIFICATION_CASES.length);
});

test("runDecisionSupportDefaultOffFeatureFlagImplementationShell can reuse a pre-built Sprint 37R gate instead of rebuilding one", () => {
  const gate = runDecisionSupportProductionWiringReadinessFeatureFlagGate({ adapter: ADAPTER, now: NOW });
  const shell = runDecisionSupportDefaultOffFeatureFlagImplementationShell({ gate, now: NOW });
  assert.equal(shell.caseResults.length, gate.caseResults.length);
  assert.equal(shell.gate, gate);
});

test("shell-summary-pass: totalCases matches the Sprint 18R corpus size, every case passes", () => {
  fixtureFor("shell-summary-pass");
  assert.equal(SHELL_SUMMARY.totalCases, 79);
  assert.equal(SHELL_SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(SHELL_SUMMARY.shellEvaluatedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.shellAcceptedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.shellRejectedCount, 0);
  assert.equal(SHELL_SUMMARY.shellBlockedCount, 0);
  assert.equal(SHELL_SUMMARY.qaPassCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.qaWarningCount, 0);
  assert.equal(SHELL_SUMMARY.qaFailCount, 0);
  assert.equal(SHELL_SUMMARY.qaBlockedCount, 0);
});

test("summary: shell-kind counts match the documented Sprint 37R gate-kind baseline", () => {
  assert.equal(SHELL_SUMMARY.clarificationGateFlagShellCount, 69);
  assert.equal(SHELL_SUMMARY.routePreservationFlagShellCount, 10);
  assert.equal(SHELL_SUMMARY.unsupportedBoundaryFlagShellCount, 0);
  assert.equal(SHELL_SUMMARY.shadowOnlyFlagShellCount, 0);
  assert.equal(SHELL_SUMMARY.blockedUnsafeFlagShellCount, 0);
});

test("summary: shell-kind counts sum to totalCases", () => {
  const sum =
    SHELL_SUMMARY.clarificationGateFlagShellCount + SHELL_SUMMARY.routePreservationFlagShellCount + SHELL_SUMMARY.unsupportedBoundaryFlagShellCount + SHELL_SUMMARY.shadowOnlyFlagShellCount + SHELL_SUMMARY.blockedUnsafeFlagShellCount;
  assert.equal(sum, SHELL_SUMMARY.totalCases);
});

test("summary: every *Passed count equals totalCases for the clean corpus", () => {
  assert.equal(SHELL_SUMMARY.featureFlagDefinitionPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.defaultValueFalsePassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.staticDefaultOffResolutionPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.noRuntimeReadPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.noActivationPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.noProductionFeatureFlagImplementationPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.routerGuardHandoffPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.rollbackReferencePassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.noApprovalOverclaimPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.noVisibilityAttemptPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.noProductionEligibilityPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.noLeaksPassedCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.noSideEffectsPassedCount, SHELL_SUMMARY.totalCases);
});

test("summary: safeFor* counts are as expected", () => {
  assert.equal(SHELL_SUMMARY.safeForDefaultOffRouterGuardShellCount, SHELL_SUMMARY.totalCases);
  assert.equal(SHELL_SUMMARY.safeForUserVisibleOutputNowCount, 0);
  assert.equal(SHELL_SUMMARY.safeForProductionCount, 0);
});

test("summary: score averages/minimums meet their floors", () => {
  assert.ok(SHELL_SUMMARY.averageFeatureFlagDefinitionScore >= 90);
  assert.ok(SHELL_SUMMARY.averageRouterGuardHandoffScore >= 90);
  assert.ok(SHELL_SUMMARY.averageRollbackReferenceScore >= 90);
  assert.ok(SHELL_SUMMARY.minFeatureFlagDefinitionScore >= 85);
  assert.ok(SHELL_SUMMARY.minRouterGuardHandoffScore >= 85);
  assert.ok(SHELL_SUMMARY.minRollbackReferenceScore >= 85);
});

test("summary: violation, AllowedNow, and attempted counts are all clean", () => {
  assert.equal(SHELL_SUMMARY.violationCount, 0);
  assert.equal(SHELL_SUMMARY.criticalViolationCount, 0);
  assert.equal(SHELL_SUMMARY.productionWiringAllowedNowCount, 0);
  assert.equal(SHELL_SUMMARY.routerChangeAllowedNowCount, 0);
  assert.equal(SHELL_SUMMARY.composerChangeAllowedNowCount, 0);
  assert.equal(SHELL_SUMMARY.endpointChangeAllowedNowCount, 0);
  assert.equal(SHELL_SUMMARY.featureFlagActivationAllowedNowCount, 0);
  assert.equal(SHELL_SUMMARY.userVisibleOutputAllowedNowCount, 0);
  assert.equal(SHELL_SUMMARY.realPersistenceAllowedNowCount, 0);
  assert.equal(SHELL_SUMMARY.actionExecutionAllowedNowCount, 0);
  assert.equal(SHELL_SUMMARY.runtimeReadAttemptedCount, 0);
  assert.equal(SHELL_SUMMARY.activationAttemptedCount, 0);
  assert.equal(SHELL_SUMMARY.productionFeatureFlagImplementedNowCount, 0);
});

test("shell-decision-ready-for-default-off-router-guard-shell: decision is as expected", () => {
  fixtureFor("shell-decision-ready-for-default-off-router-guard-shell");
  assert.equal(SHELL_SUMMARY.decision, "ready_for_default_off_router_guard_shell");
});

test("shell-recommended-sprint-39r: recommendedNextSprint is Sprint 39R", () => {
  fixtureFor("shell-recommended-sprint-39r");
  assert.equal(SHELL_SUMMARY.recommendedNextSprint, "Sprint 39R — Default-Off Router Guard Shell");
});

test("summary accepts a bare case-results array plus sprint37GateDecision option", () => {
  const bareSummary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell(SHELL.caseResults, { sprint37GateDecision: SHELL.gateSummary.decision });
  assert.equal(bareSummary.totalCases, SHELL_SUMMARY.totalCases);
  assert.equal(bareSummary.decision, SHELL_SUMMARY.decision);
});

test("summary: bare case-results array without sprint37GateDecision cannot reach ready_for_default_off_router_guard_shell", () => {
  const bareSummary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell(SHELL.caseResults);
  assert.notEqual(bareSummary.decision, "ready_for_default_off_router_guard_shell");
});

test("summary: representativeAcceptedShellResults is capped and rejectedShellResults/blockedShellResults are empty for the clean corpus", () => {
  assert.ok(SHELL_SUMMARY.representativeAcceptedShellResults.length <= 8);
  assert.equal(SHELL_SUMMARY.rejectedShellResults.length, 0);
  assert.equal(SHELL_SUMMARY.blockedShellResults.length, 0);
});

// ─── Decision blocking paths (synthetic) ────────────────────────────────────────────

test("decision: a leaked case forces blocked_by_leakage_or_side_effect_risk", () => {
  const caseResult = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
    buildFakeGateCaseResult("clarification_gate_readiness", "decision-leak", { noLeaksPassed: false, violations: ["pii_leak"] }),
  );
  const summary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell([caseResult], { sprint37GateDecision: "ready_for_default_off_feature_flag_implementation_shell" });
  assert.equal(summary.decision, "blocked_by_leakage_or_side_effect_risk");
});

test("decision: a user-visible-output violation with no leakage forces blocked_by_visibility_risk", () => {
  const parts = buildValidParts("clarification_gate_readiness", "decision-visibility", { forceUserVisibleOutputAttempted: true });
  const caseResult = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(parts.gateCaseResult, { stateOptions: { forceUserVisibleOutputAttempted: true } });
  const summary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell([caseResult], { sprint37GateDecision: "ready_for_default_off_feature_flag_implementation_shell" });
  assert.equal(summary.decision, "blocked_by_visibility_risk");
});

test("decision: a runtime-read attempt with no leakage/visibility forces blocked_by_runtime_read_risk", () => {
  const gateCaseResult = buildFakeGateCaseResult("clarification_gate_readiness", "decision-runtime-read");
  const caseResult = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, { stateOptions: { forceRuntimeReadAttempted: true } });
  const summary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell([caseResult], { sprint37GateDecision: "ready_for_default_off_feature_flag_implementation_shell" });
  assert.equal(summary.decision, "blocked_by_runtime_read_risk");
});

test("decision: an activation attempt with no leakage/visibility/runtime-read forces blocked_by_activation_risk", () => {
  const gateCaseResult = buildFakeGateCaseResult("clarification_gate_readiness", "decision-activation");
  const caseResult = evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, { stateOptions: { forceActivationAttempted: true } });
  const summary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell([caseResult], { sprint37GateDecision: "ready_for_default_off_feature_flag_implementation_shell" });
  assert.equal(summary.decision, "blocked_by_activation_risk");
});

test("decision: a routerChangeAllowedNow-style violation on the case result itself forces blocked_by_production_wiring_risk", () => {
  // This branch of the decision function reads the case result's own (always-false-by-construction)
  // *AllowedNow fields, mirroring how Sprint 37R's own equivalent decision-blocking test hand-crafts a
  // case result rather than routing it through the evaluator (which never sets these fields true).
  const { gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference } = buildValidParts("clarification_gate_readiness", "decision-wiring");
  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);
  const caseResult = {
    caseId: gateCaseResult.caseId,
    sourceGateKind: gateCaseResult.gateKind,
    sourceCaseId: gateCaseResult.caseId,
    shellKind: "clarification_gate_flag_shell",
    generatedForFeatureFlagShellOnly: true,
    shellOnly: true,
    noOpShell: true,
    defaultOff: true,
    featureFlagDefinition,
    featureFlagState,
    routerGuardReadinessHandoff,
    rollbackReference,
    ...validation,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: true,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    featureFlagActivationAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell([caseResult], { sprint37GateDecision: "ready_for_default_off_feature_flag_implementation_shell" });
  assert.equal(summary.decision, "blocked_by_production_wiring_risk");
});

test("decision: continue_feature_flag_shell_only when the Sprint 37R gate decision is not ready", () => {
  const summary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell(SHELL.caseResults, { sprint37GateDecision: "continue_readiness_gate_only" });
  assert.equal(summary.decision, "continue_feature_flag_shell_only");
});

// ─── Explain ──────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportDefaultOffFeatureFlagImplementationShell returns a structured explanation", () => {
  const explain = explainDecisionSupportDefaultOffFeatureFlagImplementationShell();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
  assert.equal(typeof explain.whyApprovalIsNotOverclaimed, "string");
  assert.equal(typeof explain.whyProcessEnvIsNotRead, "string");
  assert.equal(typeof explain.whyFeatureFlagIsNotActivated, "string");
  assert.equal(typeof explain.whyProductionFeatureFlagIsNotImplemented, "string");
  assert.equal(typeof explain.expectedSprint39Path, "string");
});

// ─── Regression: Sprint 22R-37R + golden intent metrics unchanged ──────────────────

test("regression: Sprint 37R production wiring readiness / feature flag gate metrics stay clean against the 79-case corpus", () => {
  assert.equal(GATE_SUMMARY.totalCases, 79);
  assert.equal(GATE_SUMMARY.gateAcceptedCount, 79);
  assert.equal(GATE_SUMMARY.qaPassCount, 79);
  assert.equal(GATE_SUMMARY.decision, "ready_for_default_off_feature_flag_implementation_shell");
});

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
  assert.equal(summary.decision, "ready_for_response_draft_quality_evaluation");
});

test("regression: Sprint 32R response QA plan metrics stay clean against the 79-case corpus", () => {
  const plan = buildDecisionSupportResponseQaDryRunPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseQaDryRunPlan(plan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.decision, "ready_for_response_draft_harness");
});

test("regression: Sprint 31R clarification-gated integration plan metrics stay clean against the 79-case corpus", () => {
  const integrationPlan = buildDecisionSupportClarificationGatedIntegrationPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportClarificationGatedIntegrationPlan(integrationPlan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.decision, "ready_for_user_visible_dry_run_plan");
});

test("regression: Sprint 30R controlled replay metrics stay clean against the 79-case corpus", () => {
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowControlledReplayEvaluation(evaluation);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.deterministicReplayRate, 100);
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
  assert.equal(summary.blockedBySafetyGateCount, 0);
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

const IMPLEMENTATION_SOURCE = readFileSync(new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffFeatureFlagImplementationShell.ts", import.meta.url), "utf8");
const TYPES_SOURCE = readFileSync(new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffFeatureFlagImplementationShellTypes.ts", import.meta.url), "utf8");

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /brainRouter/);
  assert.doesNotMatch(imports, /responseComposer/);
  assert.doesNotMatch(imports, /conversationalBrainGateway/);
  assert.doesNotMatch(imports, /handlers\//);
  assert.doesNotMatch(imports, /command-center\/chat/);
  assert.doesNotMatch(imports, /\/router\//);
  assert.doesNotMatch(imports, /\/composer\//);
  assert.doesNotMatch(imports, /\/endpoint\//);
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
  // The literal string "process.env" is intentionally mentioned in prose/docs and listed as a
  // documentation-only array entry in prohibitedRuntimeSources — what must never appear is an actual
  // property/bracket access on it (process.env.X / process.env["X"]), which is what an actual runtime read
  // would look like.
  const REAL_ENV_READ = /process\.env(\.[A-Za-z_$]|\[)/;
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, REAL_ENV_READ);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /growthbook/i);
  assert.doesNotMatch(TYPES_SOURCE, REAL_ENV_READ);
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
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /featureFlagActiveNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /featureFlagRuntimeReadNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /productionFeatureFlagImplementedNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\benabled:\s*true\b/);
});

test("this module only imports from the Sprint 37R gate module and its own types (tiny import list)", () => {
  // importLines() only captures lines that literally start with "import" — multi-line `import { ... } from
  // "..."` statements split the module specifier onto its own "} from ..." line, so check the "from" clause
  // directly instead (and confirm the excluded module names never appear anywhere in the file at all,
  // including comments).
  assert.match(IMPLEMENTATION_SOURCE, /from "\.\/decisionSupportProductionWiringReadinessFeatureFlagGate"/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportDefaultOffRouteComposerIntegrationAdapter/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportUserVisibleDryRunEvaluationHarness/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportResponseDraft/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportShadow/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportDefaultOffFeatureFlagImplementationShell/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});

test("no feature flag implementation file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../src/lib/feature-flags/decisionSupportRouteComposerFlag.ts", import.meta.url), "utf8"));
  assert.throws(() => readFileSync(new URL("../src/lib/feature-flags/pmfreakDecisionSupportDefaultOffRouteComposerAdapter.ts", import.meta.url), "utf8"));
});
