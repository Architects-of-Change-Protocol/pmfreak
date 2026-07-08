import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_VERSION,
  createDecisionSupportDefaultOffRouterGuardShellConfig,
  listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions,
  listDecisionSupportDefaultOffRouterGuardShellProhibitedActions,
  createDecisionSupportDefaultOffRouterGuardShellDefinition,
  createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference,
  evaluateDecisionSupportDefaultOffRouterGuardRoute,
  createDecisionSupportDefaultOffComposerGuardReadinessHandoff,
  createDecisionSupportDefaultOffRouterGuardRollbackReference,
  validateDecisionSupportDefaultOffRouterGuardShellCase,
  evaluateDecisionSupportDefaultOffRouterGuardShellCase,
  runDecisionSupportDefaultOffRouterGuardShell,
  summarizeDecisionSupportDefaultOffRouterGuardShell,
  explainDecisionSupportDefaultOffRouterGuardShell,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouterGuardShell.ts";
import { DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_CASES } from "./fixtures/conversational-brain-decision-support-default-off-router-guard-shell-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Sprint 38R shell — reused read-only to prove this sprint doesn't corrupt the chain it consumes.
import {
  runDecisionSupportDefaultOffFeatureFlagImplementationShell,
  summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffFeatureFlagImplementationShell.ts";

/**
 * Sprint 39R — Decision Support Default-Off Router Guard Shell.
 *
 * Tests the pure, offline, deterministic, shell-only router guard shell in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouterGuardShell.ts`.
 * This builds a formal, no-op default-off router guard shell (types, definition, feature-flag-state
 * reference, route evaluation, composer guard handoff, rollback-reference functions) for every Sprint
 * 38R-accepted default-off feature flag implementation shell case — it never imports or wires the real
 * router, never mutates a live route, never activates a feature flag, never reads process.env, never touches
 * the composer/endpoint, never shows anything to a real user, and never persists anything real.
 */

const NOW = "2026-01-01T00:00:00.000Z";
const PROPOSED_FEATURE_FLAG_KEY = "pmfreak.decisionSupport.defaultOffRouteComposerAdapter";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

/** Builds a minimal, fully-shaped Sprint 38R feature flag shell case result for a given shell kind. Every
 * shell kind actually occurs in the real Sprint 18R corpus except unsupported_boundary_flag_shell/
 * shadow_only_flag_shell/blocked_unsafe_flag_shell, which never occur there (Sprint 38R's own baseline is 69
 * clarification + 10 route preservation cases, 0 of the other three) — this synthesizes a safe, accepted,
 * shell-passed case for any of the five kinds so every Sprint 39R shell-kind mapping can still be exercised
 * directly. */
function buildFakeFeatureFlagShellCaseResult(shellKind, caseId, overrides = {}) {
  const id = caseId ?? `fake-${shellKind}`;
  const featureFlagDefinition = {
    definitionId: `feature-flag-shell-definition-${id}`,
    key: PROPOSED_FEATURE_FLAG_KEY,
    description: "synthetic",
    shellOnly: true,
    noOpShell: true,
    productionFeatureFlagImplementedNow: false,
    featureFlagActiveNow: false,
    featureFlagRuntimeReadNow: false,
    defaultValue: false,
    resolvedState: "disabled",
    resolvedSource: "static_default_off",
    activationAllowedNow: false,
    activationRequiresFutureSprint: true,
    activationRequiresGovernanceApproval: true,
    activationRequiresRollbackContract: true,
    activationRequiresRouterGuard: true,
    activationRequiresComposerGuard: true,
    activationRequiresEndpointGuard: true,
    activationRequiresMonitoringContract: true,
    activationRequiresManualSmokeTest: true,
    prohibitedRuntimeSources: ["process.env"],
    requiredFutureChecks: ["router_guard_shell_ready"],
    score: 95,
    rationale: ["synthetic"],
  };
  const featureFlagState = {
    stateId: `feature-flag-shell-state-${id}`,
    key: PROPOSED_FEATURE_FLAG_KEY,
    enabled: false,
    state: "disabled",
    source: "static_default_off",
    shellOnly: true,
    noOpShell: true,
    defaultOff: true,
    runtimeReadAttempted: false,
    activationAttempted: false,
    productionWiringAttempted: false,
    routerChangeAttempted: false,
    composerChangeAttempted: false,
    endpointChangeAttempted: false,
    userVisibleOutputAttempted: false,
    realPersistenceAttempted: false,
    externalCallAttempted: false,
    actionExecutionAttempted: false,
    warnings: [],
  };
  const routerGuardReadinessHandoff = {
    handoffId: `router-guard-handoff-${id}`,
    shellKind,
    key: PROPOSED_FEATURE_FLAG_KEY,
    readyForRouterGuardShell: true,
    routerGuardImplementationAllowedNow: false,
    routerRuntimeWiringAllowedNow: false,
    requiresStaticDefaultOffFlagState: true,
    requiresNoRouterImportInSprint38: true,
    requiresRouterGuardShellInSprint39: true,
    requiresExistingRoutePreservation: true,
    requiresClarificationGatePreservation: true,
    requiresUnsupportedBoundaryPreservation: true,
    requiresNoUserVisibleOutputByDefault: true,
    score: 92,
    rationale: ["synthetic"],
  };
  const rollbackReference = {
    rollbackReferenceId: `rollback-reference-${id}`,
    shellOnly: true,
    rollbackImplementedNow: false,
    rollbackRequiresFeatureFlagDisable: true,
    rollbackRequiresRouterFallback: true,
    rollbackRequiresComposerFallback: true,
    rollbackRequiresEndpointFallback: true,
    rollbackRequiresNoDataMigration: true,
    rollbackRequiresNoPersistentStateCleanup: true,
    rollbackRequiresNoExternalSideEffectCleanup: true,
    rollbackRequiresIncidentOwner: true,
    rollbackRequiresVerificationChecklist: true,
    score: 92,
    rationale: ["synthetic"],
  };

  const base = {
    caseId: id,
    sourceGateKind: `${shellKind}-gate`,
    sourceCaseId: id,
    shellKind,
    generatedForFeatureFlagShellOnly: true,
    shellOnly: true,
    noOpShell: true,
    defaultOff: true,
    featureFlagDefinition,
    featureFlagState,
    routerGuardReadinessHandoff,
    rollbackReference,
    shellAccepted: true,
    shellRejected: false,
    shellBlocked: false,
    qaStatus: "pass",
    riskLevel: "low",
    violations: [],
    featureFlagDefinitionPassed: true,
    defaultValueFalsePassed: true,
    staticDefaultOffResolutionPassed: true,
    noRuntimeReadPassed: true,
    noActivationPassed: true,
    noProductionFeatureFlagImplementationPassed: true,
    routerGuardHandoffPassed: true,
    rollbackReferencePassed: true,
    noApprovalOverclaimPassed: true,
    noVisibilityAttemptPassed: true,
    noProductionEligibilityPassed: true,
    noLeaksPassed: true,
    noSideEffectsPassed: true,
    safeForDefaultOffRouterGuardShell: true,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    featureFlagActivationAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings: [],
  };
  return { ...base, ...overrides };
}

function fakeFeatureFlagShellCaseResultFromFixture(fixtureId, overrides = {}) {
  const fixtureCase = fixtureFor(fixtureId);
  assert.ok(fixtureCase.sourceShellKind, `fixture ${fixtureId} must declare sourceShellKind`);
  return buildFakeFeatureFlagShellCaseResult(fixtureCase.sourceShellKind, fixtureId, overrides);
}

function buildValidParts(shellKind, caseId, stateOptions, routeOptions) {
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult(shellKind, caseId);
  const routerGuardDefinition = createDecisionSupportDefaultOffRouterGuardShellDefinition(featureFlagShellCaseResult);
  const featureFlagStateReference = createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(featureFlagShellCaseResult, stateOptions);
  const routeEvaluation = evaluateDecisionSupportDefaultOffRouterGuardRoute(featureFlagShellCaseResult, routerGuardDefinition, featureFlagStateReference, routeOptions);
  const composerGuardReadinessHandoff = createDecisionSupportDefaultOffComposerGuardReadinessHandoff(featureFlagShellCaseResult, routeEvaluation);
  const rollbackReference = createDecisionSupportDefaultOffRouterGuardRollbackReference(featureFlagShellCaseResult, routeEvaluation);
  return { featureFlagShellCaseResult, routerGuardDefinition, featureFlagStateReference, routeEvaluation, composerGuardReadinessHandoff, rollbackReference };
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const FEATURE_FLAG_SHELL = runDecisionSupportDefaultOffFeatureFlagImplementationShell({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const FEATURE_FLAG_SHELL_SUMMARY = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell(FEATURE_FLAG_SHELL);
const ROUTER_GUARD_SHELL = runDecisionSupportDefaultOffRouterGuardShell({ shell: FEATURE_FLAG_SHELL, now: NOW });
const ROUTER_GUARD_SHELL_SUMMARY = summarizeDecisionSupportDefaultOffRouterGuardShell(ROUTER_GUARD_SHELL);

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 45 and 65 cases", () => {
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_CASES.length >= 45);
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_CASES.length <= 65);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.routerGuardShellKind, "string");
    assert.equal(typeof c.expectedQaStatus, "string");
    assert.equal(typeof c.expectedRiskLevel, "string");
    assert.equal(typeof c.expectedRouterGuardAccepted, "boolean");
    assert.equal(typeof c.expectedLiveRouteDecision, "string");
    assert.equal(typeof c.expectedFutureRouteIntent, "string");
    assert.equal(typeof c.expectedSafeForDefaultOffComposerGuardShell, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleOutputNow, "boolean");
    assert.equal(c.expectedSafeForUserVisibleOutputNow, false);
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(c.expectedSafeForProduction, false);
    assert.ok(Array.isArray(c.expectedViolations));
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_VERSION, "string");
  assert.ok(DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportDefaultOffRouterGuardShellConfig", createDecisionSupportDefaultOffRouterGuardShellConfig],
  ["listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions", listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions],
  ["listDecisionSupportDefaultOffRouterGuardShellProhibitedActions", listDecisionSupportDefaultOffRouterGuardShellProhibitedActions],
  ["createDecisionSupportDefaultOffRouterGuardShellDefinition", createDecisionSupportDefaultOffRouterGuardShellDefinition],
  ["createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference", createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference],
  ["evaluateDecisionSupportDefaultOffRouterGuardRoute", evaluateDecisionSupportDefaultOffRouterGuardRoute],
  ["createDecisionSupportDefaultOffComposerGuardReadinessHandoff", createDecisionSupportDefaultOffComposerGuardReadinessHandoff],
  ["createDecisionSupportDefaultOffRouterGuardRollbackReference", createDecisionSupportDefaultOffRouterGuardRollbackReference],
  ["validateDecisionSupportDefaultOffRouterGuardShellCase", validateDecisionSupportDefaultOffRouterGuardShellCase],
  ["evaluateDecisionSupportDefaultOffRouterGuardShellCase", evaluateDecisionSupportDefaultOffRouterGuardShellCase],
  ["runDecisionSupportDefaultOffRouterGuardShell", runDecisionSupportDefaultOffRouterGuardShell],
  ["summarizeDecisionSupportDefaultOffRouterGuardShell", summarizeDecisionSupportDefaultOffRouterGuardShell],
  ["explainDecisionSupportDefaultOffRouterGuardShell", explainDecisionSupportDefaultOffRouterGuardShell],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture router-guard-config-default-strict)", () => {
  fixtureFor("router-guard-config-default-strict");
  const config = createDecisionSupportDefaultOffRouterGuardShellConfig();
  assert.equal(config.profile, "strict_default_off_router_guard_shell");
  assert.equal(config.mode, "router_guard_shell_only");
  assert.equal(config.shellOnly, true);
  assert.equal(config.noOpRouterGuard, true);
  assert.equal(config.defaultOff, true);
  assert.equal(config.proposedFeatureFlagKey, PROPOSED_FEATURE_FLAG_KEY);
  assert.equal(config.allowProductionRouterGuardImplementation, false);
  assert.equal(config.allowRouterImport, false);
  assert.equal(config.allowRouterRuntimeWiring, false);
  assert.equal(config.allowRouteMutation, false);
  assert.equal(config.allowFeatureFlagRuntimeRead, false);
  assert.equal(config.allowFeatureFlagActivation, false);
  assert.equal(config.allowProductionWiring, false);
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
  assert.equal(config.requireFeatureFlagShellPass, true);
  assert.equal(config.requireDefaultOffFeatureFlagState, true);
  assert.equal(config.requireNoRouterImport, true);
  assert.equal(config.requireNoRouterRuntimeWiring, true);
  assert.equal(config.requireNoRouteMutation, true);
  assert.equal(config.requireCurrentRoutePreservation, true);
  assert.equal(config.requireComposerGuardHandoff, true);
  assert.equal(config.requireRollbackRouteReference, true);
  assert.equal(config.requireNoApprovalOverclaim, true);
  assert.equal(config.requireNoVisibilityAttempt, true);
  assert.equal(config.requireNoLeakage, true);
  assert.equal(config.requireNoSideEffects, true);
  assert.equal(config.requireNoProductionEligibility, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "router-guard-config-block-production-router-guard-implementation",
  "router-guard-config-block-router-import",
  "router-guard-config-block-router-runtime-wiring",
  "router-guard-config-block-route-mutation",
  "router-guard-config-block-feature-flag-runtime-read",
  "router-guard-config-block-feature-flag-activation",
  "router-guard-config-block-production-wiring",
  "router-guard-config-block-composer-change",
  "router-guard-config-block-endpoint-change",
  "router-guard-config-block-user-visible-output",
  "router-guard-config-block-real-persistence",
  "router-guard-config-block-db-write",
  "router-guard-config-block-supabase-write",
  "router-guard-config-block-external-calls",
  "router-guard-config-block-action-execution",
  "router-guard-config-block-task-creation",
  "router-guard-config-block-email-draft-creation",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 17);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportDefaultOffRouterGuardShellConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all seventeen are forced true at once", () => {
  const config = createDecisionSupportDefaultOffRouterGuardShellConfig({
    allowProductionRouterGuardImplementation: true,
    allowRouterImport: true,
    allowRouterRuntimeWiring: true,
    allowRouteMutation: true,
    allowFeatureFlagRuntimeRead: true,
    allowFeatureFlagActivation: true,
    allowProductionWiring: true,
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
  assert.equal(config.noOpRouterGuard, true);
  assert.equal(config.defaultOff, true);
});

test("config honors safe overrides (mode, now, notes)", () => {
  const config = createDecisionSupportDefaultOffRouterGuardShellConfig({
    mode: "composer_guard_handoff_review",
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "composer_guard_handoff_review");
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("default-off composer guard shell"));
  assert.ok(joined.includes("composer guard contract implementation"));
  assert.ok(joined.includes("composer guard default-off tests"));
  assert.ok(joined.includes("no-op route-to-composer handoff tests"));
  assert.ok(joined.includes("user-visible output blocking tests"));
  assert.ok(joined.includes("composer rollback no-op plan"));
  assert.ok(joined.includes("endpoint guard readiness review"));
});

test("listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportDefaultOffRouterGuardShellProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("import real router"));
  assert.ok(joined.includes("wire router to decision_support"));
  assert.ok(joined.includes("mutate live route"));
  assert.ok(joined.includes("activate feature flag"));
  assert.ok(joined.includes("read runtime feature flag"));
  assert.ok(joined.includes("read process.env"));
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

test("listDecisionSupportDefaultOffRouterGuardShellProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportDefaultOffRouterGuardShellProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportDefaultOffRouterGuardShellProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Router guard shell definition ──────────────────────────────────────────────────

const DEFINITION_FIXTURE_IDS = [
  "router-guard-definition-key-preserved",
  "router-guard-definition-no-production-guard-implemented",
  "router-guard-definition-no-router-import-allowed",
  "router-guard-definition-no-route-mutation-allowed",
];

for (const fixtureId of DEFINITION_FIXTURE_IDS) {
  test(`${fixtureId}: router guard shell definition carries every shell-only invariant`, () => {
    const featureFlagShellCaseResult = fakeFeatureFlagShellCaseResultFromFixture(fixtureId);
    const definition = createDecisionSupportDefaultOffRouterGuardShellDefinition(featureFlagShellCaseResult);
    assert.equal(definition.key, PROPOSED_FEATURE_FLAG_KEY);
    assert.equal(definition.shellOnly, true);
    assert.equal(definition.noOpRouterGuard, true);
    assert.equal(definition.productionRouterGuardImplementedNow, false);
    assert.equal(definition.routerImportAllowedNow, false);
    assert.equal(definition.routerRuntimeWiringActiveNow, false);
    assert.equal(definition.routeMutationAllowedNow, false);
    assert.equal(definition.featureFlagEnabledNow, false);
    assert.equal(definition.featureFlagRuntimeReadNow, false);
    assert.equal(definition.defaultOff, true);
    assert.equal(definition.requiresFeatureFlagDisabled, true);
    assert.equal(definition.requiresCurrentRoutePreservation, true);
    assert.equal(definition.requiresComposerGuardHandoff, true);
    assert.equal(definition.requiresRollbackRouteReference, true);
    for (const source of ["real_router", "route_registry", "production_handler", "endpoint_route", "runtime_router_context", "process.env", "remote_config", "database_route_config", "implicit_route_mutation", "default_on_decision_support_route"]) {
      assert.ok(definition.prohibitedRouterSources.includes(source), `prohibitedRouterSources must include ${source}`);
    }
    for (const check of [
      "composer_guard_shell_ready",
      "endpoint_guard_shell_ready",
      "router_guard_contract_reviewed",
      "route_preservation_smoke_test_ready",
      "clarification_gate_smoke_test_ready",
      "unsupported_boundary_smoke_test_ready",
      "rollback_route_fallback_ready",
      "governance_approval_obtained",
      "manual_smoke_test_completed",
    ]) {
      assert.ok(definition.requiredFutureChecks.includes(check), `requiredFutureChecks must include ${check}`);
    }
    assert.ok(definition.score >= 85);
    assert.ok(definition.rationale.length > 0);
  });
}

test("router guard shell definition sets exactly one preservation requirement true per shell kind", () => {
  const expectations = [
    ["clarification_gate_flag_shell", "requiresClarificationGatePreservation"],
    ["route_preservation_flag_shell", "requiresExistingRoutePreservation"],
    ["unsupported_boundary_flag_shell", "requiresUnsupportedBoundaryPreservation"],
    ["shadow_only_flag_shell", "requiresShadowOnlyPreservation"],
    ["blocked_unsafe_flag_shell", "requiresUnsafeRouteBlock"],
  ];
  const ALL_FIELDS = ["requiresClarificationGatePreservation", "requiresExistingRoutePreservation", "requiresUnsupportedBoundaryPreservation", "requiresShadowOnlyPreservation", "requiresUnsafeRouteBlock"];
  for (const [shellKind, trueField] of expectations) {
    const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult(shellKind, `def-req-${shellKind}`);
    const definition = createDecisionSupportDefaultOffRouterGuardShellDefinition(featureFlagShellCaseResult);
    for (const field of ALL_FIELDS) {
      assert.equal(definition[field], field === trueField, `${shellKind}: ${field} must be ${field === trueField}`);
    }
  }
});

// ─── Feature flag state reference ───────────────────────────────────────────────────

const STATE_FIXTURE_IDS = ["router-guard-state-reference-disabled", "router-guard-state-reference-static-default-off", "router-guard-state-reference-no-activation-attempted"];

for (const fixtureId of STATE_FIXTURE_IDS) {
  test(`${fixtureId}: feature flag state reference resolves to the static default-off baseline`, () => {
    const featureFlagShellCaseResult = fakeFeatureFlagShellCaseResultFromFixture(fixtureId);
    const stateReference = createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(featureFlagShellCaseResult);
    assert.equal(stateReference.key, PROPOSED_FEATURE_FLAG_KEY);
    assert.equal(stateReference.featureFlagState, "disabled");
    assert.equal(stateReference.featureFlagEnabled, false);
    assert.equal(stateReference.source, "static_default_off");
    assert.equal(stateReference.defaultOff, true);
    assert.equal(stateReference.shellOnly, true);
    assert.equal(stateReference.runtimeReadAttempted, false);
    assert.equal(stateReference.activationAttempted, false);
    assert.equal(stateReference.featureFlagRuntimeReadNow, false);
    assert.equal(stateReference.featureFlagActivationAllowedNow, false);
  });
}

test("createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference never sets featureFlagEnabled true even when forceEnabled is requested", () => {
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "state-force-enabled");
  const stateReference = createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(featureFlagShellCaseResult, { forceEnabled: true });
  assert.equal(stateReference.featureFlagEnabled, false);
  assert.equal(stateReference.featureFlagState, "blocked");
  assert.ok(stateReference.warnings.length > 0);
});

test("createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference reports invalid when the source is forced away from static_default_off", () => {
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "state-force-source");
  const stateReference = createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(featureFlagShellCaseResult, { forceSource: "invalid_runtime_source" });
  assert.equal(stateReference.featureFlagState, "invalid");
  assert.equal(stateReference.featureFlagEnabled, false);
});

// ─── Route evaluation — shellKind mapping + defaults (5) ────────────────────────────

const ROUTE_FIXTURE_EXPECTATIONS = [
  ["router-guard-route-clarification-gate", "clarification_gate_flag_shell", "clarification_gate_router_guard_shell", "preserve_current_route_noop", "future_route_to_clarification_gate"],
  ["router-guard-route-preservation", "route_preservation_flag_shell", "route_preservation_router_guard_shell", "preserve_current_route_noop", "future_preserve_existing_route"],
  ["router-guard-route-unsupported-boundary", "unsupported_boundary_flag_shell", "unsupported_boundary_router_guard_shell", "preserve_current_route_noop", "future_preserve_unsupported_boundary"],
  ["router-guard-route-shadow-only", "shadow_only_flag_shell", "shadow_only_router_guard_shell", "keep_shadow_only_noop", "future_keep_shadow_only"],
  ["router-guard-route-blocked-unsafe", "blocked_unsafe_flag_shell", "blocked_unsafe_router_guard_shell", "block_unsafe_noop", "future_block_unsafe"],
];

for (const [fixtureId, sourceShellKind, expectedRouterGuardShellKind, expectedLiveRouteDecision, expectedFutureRouteIntent] of ROUTE_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: evaluate produces the documented router guard shell kind and route decision`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult(sourceShellKind, fixtureId);
    const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult);
    assert.equal(result.routerGuardShellKind, expectedRouterGuardShellKind);
    assert.equal(result.routeEvaluation.liveRouteDecision, expectedLiveRouteDecision);
    assert.equal(result.routeEvaluation.futureRouteIntent, expectedFutureRouteIntent);
    assert.equal(result.generatedForRouterGuardShellOnly, true);
    assert.equal(result.shellOnly, true);
    assert.equal(result.noOpRouterGuard, true);
    assert.equal(result.defaultOff, true);
    assert.equal(result.routerGuardAccepted, fixtureCase.expectedRouterGuardAccepted);
    assert.equal(result.routerGuardRejected, false);
    assert.equal(result.routerGuardBlocked, false);
    assert.equal(result.qaStatus, fixtureCase.expectedQaStatus);
    assert.equal(result.riskLevel, fixtureCase.expectedRiskLevel);
    assert.deepEqual(result.violations, []);
    assert.equal(result.routerGuardDefinitionPassed, true);
    assert.equal(result.featureFlagDisabledPassed, true);
    assert.equal(result.noRouterImportPassed, true);
    assert.equal(result.noRouterRuntimeWiringPassed, true);
    assert.equal(result.noRouteMutationPassed, true);
    assert.equal(result.currentRoutePreservationPassed, true);
    assert.equal(result.routeIntentPreservationPassed, true);
    assert.equal(result.composerGuardHandoffPassed, true);
    assert.equal(result.rollbackReferencePassed, true);
    assert.equal(result.noApprovalOverclaimPassed, true);
    assert.equal(result.noVisibilityAttemptPassed, true);
    assert.equal(result.noProductionEligibilityPassed, true);
    assert.equal(result.noLeaksPassed, true);
    assert.equal(result.noSideEffectsPassed, true);
    assert.equal(result.safeForDefaultOffComposerGuardShell, fixtureCase.expectedSafeForDefaultOffComposerGuardShell);
    assert.equal(result.safeForUserVisibleOutputNow, false);
    assert.equal(result.safeForProduction, false);
    assert.equal(result.productionWiringAllowedNow, false);
    assert.equal(result.routerChangeAllowedNow, false);
    assert.equal(result.routeMutationAllowedNow, false);
    assert.equal(result.composerChangeAllowedNow, false);
    assert.equal(result.endpointChangeAllowedNow, false);
    assert.equal(result.userVisibleOutputAllowedNow, false);
    assert.equal(result.realPersistenceAllowedNow, false);
    assert.equal(result.actionExecutionAllowedNow, false);
  });
}

test("route evaluation always reports currentRoutePreserved true and every AllowedNow field false by default", () => {
  for (const [, sourceShellKind] of ROUTE_FIXTURE_EXPECTATIONS) {
    const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult(sourceShellKind, `route-defaults-${sourceShellKind}`);
    const definition = createDecisionSupportDefaultOffRouterGuardShellDefinition(featureFlagShellCaseResult);
    const stateReference = createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(featureFlagShellCaseResult);
    const routeEvaluation = evaluateDecisionSupportDefaultOffRouterGuardRoute(featureFlagShellCaseResult, definition, stateReference);
    assert.equal(routeEvaluation.currentRoutePreserved, true);
    assert.equal(routeEvaluation.routeMutationAllowedNow, false);
    assert.equal(routeEvaluation.routeMutationAttempted, false);
    assert.equal(routeEvaluation.routerRuntimeWiringActiveNow, false);
    assert.equal(routeEvaluation.routerImportAttempted, false);
    assert.equal(routeEvaluation.decisionSupportRouteActivatedNow, false);
    assert.equal(routeEvaluation.userVisibleNow, false);
    assert.equal(routeEvaluation.persistedNow, false);
    assert.equal(routeEvaluation.executableNow, false);
    assert.equal(routeEvaluation.externalSideEffectsAllowed, false);
    assert.equal(routeEvaluation.productionEligibleNow, false);
    assert.ok(routeEvaluation.score >= 85);
    assert.ok(routeEvaluation.rationale.length > 0);
  }
});

// ─── Composer guard handoff / rollback reference ────────────────────────────────────

test("router-guard-composer-handoff-ready: composer guard readiness handoff carries every invariant", () => {
  const featureFlagShellCaseResult = fakeFeatureFlagShellCaseResultFromFixture("router-guard-composer-handoff-ready");
  const definition = createDecisionSupportDefaultOffRouterGuardShellDefinition(featureFlagShellCaseResult);
  const stateReference = createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(featureFlagShellCaseResult);
  const routeEvaluation = evaluateDecisionSupportDefaultOffRouterGuardRoute(featureFlagShellCaseResult, definition, stateReference);
  const handoff = createDecisionSupportDefaultOffComposerGuardReadinessHandoff(featureFlagShellCaseResult, routeEvaluation);
  assert.equal(handoff.key, PROPOSED_FEATURE_FLAG_KEY);
  assert.equal(handoff.readyForComposerGuardShell, true);
  assert.equal(handoff.composerGuardImplementationAllowedNow, false);
  assert.equal(handoff.composerRuntimeWiringAllowedNow, false);
  assert.equal(handoff.requiresRouterGuardShellAccepted, true);
  assert.equal(handoff.requiresFeatureFlagDisabled, true);
  assert.equal(handoff.requiresCurrentRoutePreserved, true);
  assert.equal(handoff.requiresNoComposerImportInSprint39, true);
  assert.equal(handoff.requiresComposerGuardShellInSprint40, true);
  assert.equal(handoff.requiresNoUserVisibleOutputByDefault, true);
  assert.equal(handoff.requiresNoPersistenceByDefault, true);
  assert.equal(handoff.requiresNoActionExecutionByDefault, true);
  assert.ok(handoff.score >= 85);
  assert.ok(handoff.rationale.length > 0);
});

test("router-guard-rollback-reference-ready: rollback reference carries every shell-only invariant", () => {
  const featureFlagShellCaseResult = fakeFeatureFlagShellCaseResultFromFixture("router-guard-rollback-reference-ready");
  const definition = createDecisionSupportDefaultOffRouterGuardShellDefinition(featureFlagShellCaseResult);
  const stateReference = createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(featureFlagShellCaseResult);
  const routeEvaluation = evaluateDecisionSupportDefaultOffRouterGuardRoute(featureFlagShellCaseResult, definition, stateReference);
  const rollbackReference = createDecisionSupportDefaultOffRouterGuardRollbackReference(featureFlagShellCaseResult, routeEvaluation);
  assert.equal(rollbackReference.shellOnly, true);
  assert.equal(rollbackReference.rollbackImplementedNow, false);
  assert.equal(rollbackReference.rollbackRequiresFeatureFlagDisable, true);
  assert.equal(rollbackReference.rollbackRequiresCurrentRouteFallback, true);
  assert.equal(rollbackReference.rollbackRequiresExistingRoutePreservation, true);
  assert.equal(rollbackReference.rollbackRequiresComposerNoOpFallback, true);
  assert.equal(rollbackReference.rollbackRequiresEndpointNoOpFallback, true);
  assert.equal(rollbackReference.rollbackRequiresNoDataMigration, true);
  assert.equal(rollbackReference.rollbackRequiresNoPersistentStateCleanup, true);
  assert.equal(rollbackReference.rollbackRequiresNoExternalSideEffectCleanup, true);
  assert.equal(rollbackReference.rollbackRequiresIncidentOwner, true);
  assert.equal(rollbackReference.rollbackRequiresVerificationChecklist, true);
  assert.ok(rollbackReference.score >= 85);
  assert.ok(rollbackReference.rationale.length > 0);
});

// ─── Router guard case evaluation: safety confirmations on a clean case ─────────────

test("router-guard-no-approval-overclaim / no-visibility-attempt / no-production-eligibility / no-leakage / no-side-effects: a valid case passes every safety check", () => {
  for (const fixtureId of ["router-guard-no-approval-overclaim", "router-guard-no-visibility-attempt", "router-guard-no-production-eligibility", "router-guard-no-leakage", "router-guard-no-side-effects"]) {
    const fixtureCase = fixtureFor(fixtureId);
    const featureFlagShellCaseResult = fakeFeatureFlagShellCaseResultFromFixture(fixtureId);
    const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult);
    assert.equal(result.noApprovalOverclaimPassed, true);
    assert.equal(result.noVisibilityAttemptPassed, true);
    assert.equal(result.noProductionEligibilityPassed, true);
    assert.equal(result.noLeaksPassed, true);
    assert.equal(result.noSideEffectsPassed, true);
    assert.equal(result.routerGuardAccepted, true);
    assert.equal(result.safeForUserVisibleOutputNow, false);
    assert.equal(result.safeForProduction, false);
    assert.equal(result.qaStatus, fixtureCase.expectedQaStatus);
  }
});

// ─── Negative synthetic scenarios ────────────────────────────────────────────────────

test("router-guard-negative-router-import-attempted: forcing routerImportAttempted fails noRouterImportPassed and blocks", () => {
  fixtureFor("router-guard-negative-router-import-attempted");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-router-import");
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceRouterImportAttempted: true } });
  assert.equal(result.noRouterImportPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.equal(result.riskLevel, "critical");
  assert.ok(result.violations.includes("router_import_attempted"));
});

test("router-guard-negative-router-runtime-wiring-active: forcing routerRuntimeWiringActiveNow fails noRouterRuntimeWiringPassed and blocks", () => {
  fixtureFor("router-guard-negative-router-runtime-wiring-active");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-router-wiring");
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceRouterRuntimeWiringActiveNow: true } });
  assert.equal(result.noRouterRuntimeWiringPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("router_runtime_wiring_active"));
});

test("router-guard-negative-route-mutation-attempted: forcing routeMutationAttempted fails noRouteMutationPassed, flips liveRouteDecision, and blocks", () => {
  fixtureFor("router-guard-negative-route-mutation-attempted");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-route-mutation");
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceRouteMutationAttempted: true } });
  assert.equal(result.noRouteMutationPassed, false);
  assert.equal(result.routeEvaluation.liveRouteDecision, "block_route_mutation_default_off");
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("route_mutation_attempted"));
});

test("router-guard-negative-decision-support-route-activated: forcing decisionSupportRouteActivatedNow fails route-mutation and current-route-preservation checks and blocks", () => {
  fixtureFor("router-guard-negative-decision-support-route-activated");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-route-activated");
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceDecisionSupportRouteActivatedNow: true } });
  assert.equal(result.noRouteMutationPassed, false);
  assert.equal(result.currentRoutePreservationPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("route_mutation_attempted"));
  assert.ok(result.violations.includes("current_route_not_preserved"));
});

test("router-guard-negative-feature-flag-enabled: forcing featureFlagStateReference via forceEnabled never sets featureFlagEnabled true but blocks", () => {
  fixtureFor("router-guard-negative-feature-flag-enabled");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-flag-enabled");
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { stateOptions: { forceEnabled: true } });
  assert.equal(result.featureFlagStateReference.featureFlagEnabled, false);
  assert.equal(result.featureFlagStateReference.featureFlagState, "blocked");
  assert.equal(result.featureFlagDisabledPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("feature_flag_enabled_now"));
});

test("router-guard-negative-runtime-flag-read: forcing runtimeReadAttempted fails featureFlagDisabledPassed and blocks", () => {
  fixtureFor("router-guard-negative-runtime-flag-read");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-runtime-read");
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { stateOptions: { forceRuntimeReadAttempted: true } });
  assert.equal(result.featureFlagDisabledPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("feature_flag_runtime_read_attempted"));
});

test("router-guard-negative-composer-change-allowed: mutating composerGuardImplementationAllowedNow fails composerGuardHandoffPassed and blocks", () => {
  fixtureFor("router-guard-negative-composer-change-allowed");
  const parts = buildValidParts("clarification_gate_flag_shell", "neg-composer");
  const mutatedHandoff = { ...parts.composerGuardReadinessHandoff, composerGuardImplementationAllowedNow: true };
  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(
    parts.featureFlagShellCaseResult,
    parts.routerGuardDefinition,
    parts.featureFlagStateReference,
    parts.routeEvaluation,
    mutatedHandoff,
    parts.rollbackReference,
  );
  assert.equal(validation.composerGuardHandoffPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.equal(validation.riskLevel, "critical");
  assert.ok(validation.violations.includes("composer_wiring_allowed"));
});

test("router-guard-negative-endpoint-change-allowed: an upstream Sprint 38R shell case with endpoint_wiring_allowed propagates and blocks", () => {
  fixtureFor("router-guard-negative-endpoint-change-allowed");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-endpoint", {
    noProductionEligibilityPassed: false,
    violations: ["endpoint_wiring_allowed"],
  });
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult);
  assert.equal(result.noProductionEligibilityPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("endpoint_wiring_allowed"));
});

test("router-guard-negative-user-visible-output-allowed: forcing userVisibleNow fails noVisibilityAttemptPassed and blocks", () => {
  fixtureFor("router-guard-negative-user-visible-output-allowed");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-visible");
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceUserVisibleNow: true } });
  assert.equal(result.noVisibilityAttemptPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("user_visible_output_allowed"));
});

test("router-guard-negative-real-persistence-allowed: an upstream Sprint 38R shell case with real_persistence_allowed propagates and blocks", () => {
  fixtureFor("router-guard-negative-real-persistence-allowed");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-persist", {
    noSideEffectsPassed: false,
    violations: ["real_persistence_allowed"],
  });
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult);
  assert.equal(result.noSideEffectsPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("real_persistence_allowed"));
});

test("router-guard-negative-raw-input-leak: an upstream Sprint 38R shell case with raw_input_leak propagates and blocks", () => {
  fixtureFor("router-guard-negative-raw-input-leak");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-raw-input-leak", {
    noLeaksPassed: false,
    violations: ["raw_input_leak"],
  });
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult);
  assert.equal(result.noLeaksPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("raw_input_leak"));
});

test("router-guard-negative-pii-leak: an upstream Sprint 38R shell case with pii_leak propagates and blocks", () => {
  fixtureFor("router-guard-negative-pii-leak");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-pii-leak", {
    noLeaksPassed: false,
    violations: ["pii_leak"],
  });
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult);
  assert.equal(result.noLeaksPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("pii_leak"));
});

test("negative: full_candidate_leak and project_name_leak upstream violations also propagate", () => {
  const fullCandidateResult = evaluateDecisionSupportDefaultOffRouterGuardShellCase(
    buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-full-candidate", { noLeaksPassed: false, violations: ["full_candidate_leak"] }),
  );
  assert.ok(fullCandidateResult.violations.includes("full_candidate_leak"));

  const projectNameResult = evaluateDecisionSupportDefaultOffRouterGuardShellCase(
    buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-project-name", { noLeaksPassed: false, violations: ["project_name_leak"] }),
  );
  assert.ok(projectNameResult.violations.includes("project_name_leak"));
});

test("negative: an upstream shell case with noLeaksPassed false but no recognizable leak sub-type falls back to all four leak types", () => {
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-leak-unknown", { noLeaksPassed: false, violations: [] }));
  for (const leak of ["raw_input_leak", "full_candidate_leak", "pii_leak", "project_name_leak"]) {
    assert.ok(result.violations.includes(leak));
  }
});

test("router-guard-negative-side-effect-risk: an upstream Sprint 38R shell case with side_effect_risk propagates and blocks", () => {
  fixtureFor("router-guard-negative-side-effect-risk");
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-side-effect", {
    noSideEffectsPassed: false,
    violations: ["side_effect_risk"],
  });
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult);
  assert.equal(result.noSideEffectsPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("side_effect_risk"));
});

test("negative: forcing productionEligibleNow (non-critical alone) fails noProductionEligibilityPassed and rejects", () => {
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-production-eligible");
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceProductionEligibleNow: true } });
  assert.equal(result.noProductionEligibilityPassed, false);
  // production_wiring_allowed is not in the critical violation set, so this is a rejection, not a block.
  assert.equal(result.qaStatus, "fail");
  assert.equal(result.riskLevel, "high");
  assert.equal(result.routerGuardRejected, true);
  assert.ok(result.violations.includes("production_wiring_allowed"));
});

test("negative: an upstream shell case with shellAccepted false or safeForDefaultOffRouterGuardShell false blocks/rejects the router guard", () => {
  const notAccepted = evaluateDecisionSupportDefaultOffRouterGuardShellCase(buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-not-accepted", { shellAccepted: false }));
  assert.equal(notAccepted.noProductionEligibilityPassed, false);
  assert.notEqual(notAccepted.qaStatus, "pass");

  const notSafe = evaluateDecisionSupportDefaultOffRouterGuardShellCase(buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-not-safe", { safeForDefaultOffRouterGuardShell: false }));
  assert.equal(notSafe.noProductionEligibilityPassed, false);
  assert.notEqual(notSafe.qaStatus, "pass");
});

test("negative: upstream noApprovalOverclaimPassed false propagates and blocks", () => {
  const result = evaluateDecisionSupportDefaultOffRouterGuardShellCase(
    buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "neg-overclaim", { noApprovalOverclaimPassed: false, violations: ["approval_state_overclaimed"] }),
  );
  assert.equal(result.noApprovalOverclaimPassed, false);
  assert.equal(result.qaStatus, "blocked");
  assert.ok(result.violations.includes("approval_state_overclaimed"));
});

test("negative: mutating the router guard definition's key fails routerGuardDefinitionPassed and rejects", () => {
  const parts = buildValidParts("clarification_gate_flag_shell", "neg-key");
  const mutatedDefinition = { ...parts.routerGuardDefinition, key: "some.other.flag.key" };
  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(parts.featureFlagShellCaseResult, mutatedDefinition, parts.featureFlagStateReference, parts.routeEvaluation, parts.composerGuardReadinessHandoff, parts.rollbackReference);
  assert.equal(validation.routerGuardDefinitionPassed, false);
  assert.equal(validation.qaStatus, "fail");
  assert.equal(validation.riskLevel, "high");
  assert.ok(validation.violations.includes("router_guard_definition_missing"));
});

test("negative: mutating routeEvaluation.currentRoutePreserved to false fails currentRoutePreservationPassed and blocks", () => {
  const parts = buildValidParts("clarification_gate_flag_shell", "neg-current-route");
  const mutatedRouteEvaluation = { ...parts.routeEvaluation, currentRoutePreserved: false };
  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(parts.featureFlagShellCaseResult, parts.routerGuardDefinition, parts.featureFlagStateReference, mutatedRouteEvaluation, parts.composerGuardReadinessHandoff, parts.rollbackReference);
  assert.equal(validation.currentRoutePreservationPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("current_route_not_preserved"));
});

test("negative: mutating routeEvaluation.clarificationGatePreserved to false fails routeIntentPreservationPassed and blocks", () => {
  const parts = buildValidParts("clarification_gate_flag_shell", "neg-intent");
  const mutatedRouteEvaluation = { ...parts.routeEvaluation, clarificationGatePreserved: false };
  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(parts.featureFlagShellCaseResult, parts.routerGuardDefinition, parts.featureFlagStateReference, mutatedRouteEvaluation, parts.composerGuardReadinessHandoff, parts.rollbackReference);
  assert.equal(validation.routeIntentPreservationPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("clarification_gate_not_preserved"));
});

test("negative: mutating rollbackReference.rollbackImplementedNow to true fails rollbackReferencePassed and rejects", () => {
  const parts = buildValidParts("clarification_gate_flag_shell", "neg-rollback");
  const mutatedRollback = { ...parts.rollbackReference, rollbackImplementedNow: true };
  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(parts.featureFlagShellCaseResult, parts.routerGuardDefinition, parts.featureFlagStateReference, parts.routeEvaluation, parts.composerGuardReadinessHandoff, mutatedRollback);
  assert.equal(validation.rollbackReferencePassed, false);
  assert.ok(validation.violations.includes("rollback_route_reference_missing"));
});

// ─── Router guard run ─────────────────────────────────────────────────────────────────

test("router guard shell processes the full Sprint 18R corpus and produces one router guard case per Sprint 38R shell case", () => {
  assert.equal(ROUTER_GUARD_SHELL.caseResults.length, FEATURE_FLAG_SHELL.caseResults.length);
  assert.ok(ROUTER_GUARD_SHELL.caseResults.length > 0);
});

test("runDecisionSupportDefaultOffRouterGuardShell reuses the Sprint 38R shell decision", () => {
  assert.equal(ROUTER_GUARD_SHELL.shellSummary.decision, "ready_for_default_off_router_guard_shell");
});

test("runDecisionSupportDefaultOffRouterGuardShell honors the default synthetic corpus when no cases are supplied", () => {
  const defaultShell = runDecisionSupportDefaultOffRouterGuardShell({ now: NOW });
  assert.ok(defaultShell.caseResults.length > 0);
  assert.ok(defaultShell.caseResults.length < DECISION_CLARIFICATION_CASES.length);
});

test("runDecisionSupportDefaultOffRouterGuardShell can reuse a pre-built Sprint 38R shell instead of rebuilding one", () => {
  const shell = runDecisionSupportDefaultOffFeatureFlagImplementationShell({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const routerGuardShell = runDecisionSupportDefaultOffRouterGuardShell({ shell, now: NOW });
  assert.equal(routerGuardShell.caseResults.length, shell.caseResults.length);
  assert.equal(routerGuardShell.shell, shell);
});

test("router-guard-summary-pass: totalCases matches the Sprint 18R corpus size, every case passes", () => {
  fixtureFor("router-guard-summary-pass");
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.totalCases, 79);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routerGuardEvaluatedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routerGuardAcceptedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routerGuardRejectedCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routerGuardBlockedCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.qaPassCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.qaWarningCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.qaFailCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.qaBlockedCount, 0);
});

test("summary: shell-kind counts match the documented Sprint 38R baseline", () => {
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.clarificationGateRouterGuardCount, FEATURE_FLAG_SHELL_SUMMARY.clarificationGateFlagShellCount);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routePreservationRouterGuardCount, FEATURE_FLAG_SHELL_SUMMARY.routePreservationFlagShellCount);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.unsupportedBoundaryRouterGuardCount, FEATURE_FLAG_SHELL_SUMMARY.unsupportedBoundaryFlagShellCount);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.shadowOnlyRouterGuardCount, FEATURE_FLAG_SHELL_SUMMARY.shadowOnlyFlagShellCount);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.blockedUnsafeRouterGuardCount, FEATURE_FLAG_SHELL_SUMMARY.blockedUnsafeFlagShellCount);
});

test("summary: shell-kind counts sum to totalCases", () => {
  const sum =
    ROUTER_GUARD_SHELL_SUMMARY.clarificationGateRouterGuardCount +
    ROUTER_GUARD_SHELL_SUMMARY.routePreservationRouterGuardCount +
    ROUTER_GUARD_SHELL_SUMMARY.unsupportedBoundaryRouterGuardCount +
    ROUTER_GUARD_SHELL_SUMMARY.shadowOnlyRouterGuardCount +
    ROUTER_GUARD_SHELL_SUMMARY.blockedUnsafeRouterGuardCount;
  assert.equal(sum, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
});

test("summary: every *Passed count equals totalCases for the clean corpus", () => {
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routerGuardDefinitionPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.featureFlagDisabledPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.noRouterImportPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.noRouterRuntimeWiringPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.noRouteMutationPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.currentRoutePreservationPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routeIntentPreservationPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.composerGuardHandoffPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.rollbackReferencePassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.noApprovalOverclaimPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.noVisibilityAttemptPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.noProductionEligibilityPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.noLeaksPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.noSideEffectsPassedCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
});

test("summary: safeFor* counts are as expected", () => {
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.safeForDefaultOffComposerGuardShellCount, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.safeForUserVisibleOutputNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.safeForProductionCount, 0);
});

test("summary: score averages/minimums meet their floors", () => {
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.averageRouterGuardDefinitionScore >= 90);
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.averageRouteEvaluationScore >= 90);
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.averageComposerGuardHandoffScore >= 90);
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.averageRollbackReferenceScore >= 90);
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.minRouterGuardDefinitionScore >= 85);
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.minRouteEvaluationScore >= 85);
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.minComposerGuardHandoffScore >= 85);
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.minRollbackReferenceScore >= 85);
});

test("summary: violation, AllowedNow, and attempted counts are all clean", () => {
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.violationCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.criticalViolationCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.productionWiringAllowedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routerChangeAllowedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routeMutationAllowedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.composerChangeAllowedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.endpointChangeAllowedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.userVisibleOutputAllowedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.realPersistenceAllowedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.actionExecutionAllowedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routerImportAttemptedCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routerRuntimeWiringActiveNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.routeMutationAttemptedCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.decisionSupportRouteActivatedNowCount, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.featureFlagRuntimeReadNowCount, 0);
});

test("router-guard-decision-ready-for-default-off-composer-guard-shell: decision is as expected", () => {
  fixtureFor("router-guard-decision-ready-for-default-off-composer-guard-shell");
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.decision, "ready_for_default_off_composer_guard_shell");
});

test("router-guard-recommended-sprint-40r: recommendedNextSprint is Sprint 40R", () => {
  fixtureFor("router-guard-recommended-sprint-40r");
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.recommendedNextSprint, "Sprint 40R — Default-Off Composer Guard Shell");
});

test("summary accepts a bare case-results array plus sprint38ShellDecision option", () => {
  const bareSummary = summarizeDecisionSupportDefaultOffRouterGuardShell(ROUTER_GUARD_SHELL.caseResults, { sprint38ShellDecision: ROUTER_GUARD_SHELL.shellSummary.decision });
  assert.equal(bareSummary.totalCases, ROUTER_GUARD_SHELL_SUMMARY.totalCases);
  assert.equal(bareSummary.decision, ROUTER_GUARD_SHELL_SUMMARY.decision);
});

test("summary: bare case-results array without sprint38ShellDecision cannot reach ready_for_default_off_composer_guard_shell", () => {
  const bareSummary = summarizeDecisionSupportDefaultOffRouterGuardShell(ROUTER_GUARD_SHELL.caseResults);
  assert.notEqual(bareSummary.decision, "ready_for_default_off_composer_guard_shell");
});

test("summary: representativeAcceptedRouterGuardResults is capped and rejected/blocked arrays are empty for the clean corpus", () => {
  assert.ok(ROUTER_GUARD_SHELL_SUMMARY.representativeAcceptedRouterGuardResults.length <= 8);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.rejectedRouterGuardResults.length, 0);
  assert.equal(ROUTER_GUARD_SHELL_SUMMARY.blockedRouterGuardResults.length, 0);
});

// ─── Decision blocking paths (synthetic) ────────────────────────────────────────────

test("decision: a leaked case forces blocked_by_leakage_or_side_effect_risk", () => {
  const caseResult = evaluateDecisionSupportDefaultOffRouterGuardShellCase(
    buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "decision-leak", { noLeaksPassed: false, violations: ["pii_leak"] }),
  );
  const summary = summarizeDecisionSupportDefaultOffRouterGuardShell([caseResult], { sprint38ShellDecision: "ready_for_default_off_router_guard_shell" });
  assert.equal(summary.decision, "blocked_by_leakage_or_side_effect_risk");
});

test("decision: a user-visible-output violation with no leakage forces blocked_by_visibility_risk", () => {
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "decision-visibility");
  const caseResult = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceUserVisibleNow: true } });
  const summary = summarizeDecisionSupportDefaultOffRouterGuardShell([caseResult], { sprint38ShellDecision: "ready_for_default_off_router_guard_shell" });
  assert.equal(summary.decision, "blocked_by_visibility_risk");
});

test("decision: a router import attempt with no leakage/visibility forces blocked_by_router_import_risk", () => {
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "decision-router-import");
  const caseResult = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceRouterImportAttempted: true } });
  const summary = summarizeDecisionSupportDefaultOffRouterGuardShell([caseResult], { sprint38ShellDecision: "ready_for_default_off_router_guard_shell" });
  assert.equal(summary.decision, "blocked_by_router_import_risk");
});

test("decision: a route mutation attempt with no leakage/visibility/import forces blocked_by_route_mutation_risk", () => {
  const featureFlagShellCaseResult = buildFakeFeatureFlagShellCaseResult("clarification_gate_flag_shell", "decision-route-mutation");
  const caseResult = evaluateDecisionSupportDefaultOffRouterGuardShellCase(featureFlagShellCaseResult, { routeOptions: { forceRouteMutationAttempted: true } });
  const summary = summarizeDecisionSupportDefaultOffRouterGuardShell([caseResult], { sprint38ShellDecision: "ready_for_default_off_router_guard_shell" });
  assert.equal(summary.decision, "blocked_by_route_mutation_risk");
});

test("decision: a routerChangeAllowedNow-style override on the case result itself forces blocked_by_production_wiring_risk", () => {
  // This branch of the decision function reads the case result's own (always-false-by-construction)
  // *AllowedNow fields, mirroring how Sprint 38R's own equivalent decision-blocking test hand-crafts a
  // case result rather than routing it through the evaluator (which never sets these fields true).
  const parts = buildValidParts("clarification_gate_flag_shell", "decision-wiring");
  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(
    parts.featureFlagShellCaseResult,
    parts.routerGuardDefinition,
    parts.featureFlagStateReference,
    parts.routeEvaluation,
    parts.composerGuardReadinessHandoff,
    parts.rollbackReference,
  );
  const caseResult = {
    caseId: parts.featureFlagShellCaseResult.caseId,
    sourceShellKind: parts.featureFlagShellCaseResult.shellKind,
    sourceCaseId: parts.featureFlagShellCaseResult.caseId,
    routerGuardShellKind: parts.routerGuardDefinition.shellKind,
    generatedForRouterGuardShellOnly: true,
    shellOnly: true,
    noOpRouterGuard: true,
    defaultOff: true,
    routerGuardDefinition: parts.routerGuardDefinition,
    featureFlagStateReference: parts.featureFlagStateReference,
    routeEvaluation: parts.routeEvaluation,
    composerGuardReadinessHandoff: parts.composerGuardReadinessHandoff,
    rollbackReference: parts.rollbackReference,
    ...validation,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: true,
    routeMutationAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportDefaultOffRouterGuardShell([caseResult], { sprint38ShellDecision: "ready_for_default_off_router_guard_shell" });
  assert.equal(summary.decision, "blocked_by_production_wiring_risk");
});

test("decision: a router guard definition key mismatch with everything else clean forces blocked_by_router_guard_definition_gap", () => {
  const parts = buildValidParts("clarification_gate_flag_shell", "decision-def-gap");
  const mutatedDefinition = { ...parts.routerGuardDefinition, key: "some.other.key" };
  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(parts.featureFlagShellCaseResult, mutatedDefinition, parts.featureFlagStateReference, parts.routeEvaluation, parts.composerGuardReadinessHandoff, parts.rollbackReference);
  const caseResult = {
    caseId: parts.featureFlagShellCaseResult.caseId,
    sourceShellKind: parts.featureFlagShellCaseResult.shellKind,
    sourceCaseId: parts.featureFlagShellCaseResult.caseId,
    routerGuardShellKind: mutatedDefinition.shellKind,
    generatedForRouterGuardShellOnly: true,
    shellOnly: true,
    noOpRouterGuard: true,
    defaultOff: true,
    routerGuardDefinition: mutatedDefinition,
    featureFlagStateReference: parts.featureFlagStateReference,
    routeEvaluation: parts.routeEvaluation,
    composerGuardReadinessHandoff: parts.composerGuardReadinessHandoff,
    rollbackReference: parts.rollbackReference,
    ...validation,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: false,
    routeMutationAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportDefaultOffRouterGuardShell([caseResult], { sprint38ShellDecision: "ready_for_default_off_router_guard_shell" });
  assert.equal(summary.decision, "blocked_by_router_guard_definition_gap");
});

test("decision: currentRoutePreserved false alone (everything else clean) forces blocked_by_default_off_gap", () => {
  const parts = buildValidParts("clarification_gate_flag_shell", "decision-default-off-gap");
  const mutatedRouteEvaluation = { ...parts.routeEvaluation, currentRoutePreserved: false };
  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(parts.featureFlagShellCaseResult, parts.routerGuardDefinition, parts.featureFlagStateReference, mutatedRouteEvaluation, parts.composerGuardReadinessHandoff, parts.rollbackReference);
  const caseResult = {
    caseId: parts.featureFlagShellCaseResult.caseId,
    sourceShellKind: parts.featureFlagShellCaseResult.shellKind,
    sourceCaseId: parts.featureFlagShellCaseResult.caseId,
    routerGuardShellKind: parts.routerGuardDefinition.shellKind,
    generatedForRouterGuardShellOnly: true,
    shellOnly: true,
    noOpRouterGuard: true,
    defaultOff: true,
    routerGuardDefinition: parts.routerGuardDefinition,
    featureFlagStateReference: parts.featureFlagStateReference,
    routeEvaluation: mutatedRouteEvaluation,
    composerGuardReadinessHandoff: parts.composerGuardReadinessHandoff,
    rollbackReference: parts.rollbackReference,
    ...validation,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: false,
    routeMutationAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings: [],
  };
  assert.equal(validation.routerGuardDefinitionPassed, true);
  assert.equal(validation.featureFlagDisabledPassed, true);
  const summary = summarizeDecisionSupportDefaultOffRouterGuardShell([caseResult], { sprint38ShellDecision: "ready_for_default_off_router_guard_shell" });
  assert.equal(summary.decision, "blocked_by_default_off_gap");
});

test("decision: continue_router_guard_shell_only when the Sprint 38R shell decision is not ready", () => {
  const summary = summarizeDecisionSupportDefaultOffRouterGuardShell(ROUTER_GUARD_SHELL.caseResults, { sprint38ShellDecision: "continue_feature_flag_shell_only" });
  assert.equal(summary.decision, "continue_router_guard_shell_only");
});

// ─── Explain ──────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportDefaultOffRouterGuardShell returns a structured explanation", () => {
  const explain = explainDecisionSupportDefaultOffRouterGuardShell();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
  assert.equal(typeof explain.whyApprovalIsNotOverclaimed, "string");
  assert.equal(typeof explain.whyProcessEnvIsNotRead, "string");
  assert.equal(typeof explain.whyFeatureFlagIsNotActivated, "string");
  assert.equal(typeof explain.whyRouterIsNotImported, "string");
  assert.equal(typeof explain.whyProductionRouterGuardIsNotImplemented, "string");
  assert.equal(typeof explain.expectedSprint40Path, "string");
});

// ─── Regression: Sprint 38R chain stays clean ──────────────────────────────────────

test("regression: Sprint 38R default-off feature flag implementation shell metrics stay clean against the 79-case corpus", () => {
  const shell = runDecisionSupportDefaultOffFeatureFlagImplementationShell({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell(shell);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.shellAcceptedCount, 79);
  assert.equal(summary.qaPassCount, 79);
  assert.equal(summary.violationCount, 0);
  assert.equal(summary.decision, "ready_for_default_off_router_guard_shell");
});

// ─── No real storage / no production ───────────────────────────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

const IMPLEMENTATION_SOURCE = readFileSync(new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouterGuardShell.ts", import.meta.url), "utf8");
const TYPES_SOURCE = readFileSync(new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportDefaultOffRouterGuardShellTypes.ts", import.meta.url), "utf8");

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
  // documentation-only array entry in prohibitedRouterSources — what must never appear is an actual
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

test("this module never actually implements/imports/activates a real router guard or feature flag (no true literal assigned to a shaped field)", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /productionRouterGuardImplementedNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /routerImportAllowedNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /routerRuntimeWiringActiveNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /routeMutationAllowedNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /featureFlagEnabledNow:\s*true/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /featureFlagEnabled:\s*true\b/);
});

test("this module only imports from the Sprint 38R shell module and its own types (tiny import list)", () => {
  // importLines() only captures lines that literally start with "import" — multi-line `import { ... } from
  // "..."` statements split the module specifier onto its own "} from ..." line, so check the "from" clause
  // directly instead (and confirm the excluded module names never appear anywhere in the file at all,
  // including comments).
  assert.match(IMPLEMENTATION_SOURCE, /from "\.\/decisionSupportDefaultOffFeatureFlagImplementationShell"/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportProductionWiringReadinessFeatureFlagGate/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportDefaultOffRouteComposerIntegrationAdapter/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportUserVisibleDryRunEvaluationHarness/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportResponseDraft/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /decisionSupportShadow/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportDefaultOffRouterGuardShell/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});

test("no feature flag or router guard implementation file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../src/lib/feature-flags/decisionSupportRouteComposerFlag.ts", import.meta.url), "utf8"));
  assert.throws(() => readFileSync(new URL("../src/lib/feature-flags/pmfreakDecisionSupportDefaultOffRouteComposerAdapter.ts", import.meta.url), "utf8"));
  assert.throws(() => readFileSync(new URL("../src/lib/router/decisionSupportRouterGuard.ts", import.meta.url), "utf8"));
});
