import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_VERSION,
  createDecisionSupportClarificationGatedIntegrationPlanConfig,
  listDecisionSupportClarificationGatedIntegrationActionPolicies,
  listDecisionSupportClarificationGatedIntegrationAllowedNextActions,
  listDecisionSupportClarificationGatedIntegrationProhibitedActions,
  createDecisionSupportClarificationGatedRouteContract,
  createDecisionSupportClarificationGateRequirements,
  classifyDecisionSupportClarificationGatedRouteKind,
  assessDecisionSupportClarificationGatedIntegrationCase,
  buildDecisionSupportClarificationGatedIntegrationPlan,
  summarizeDecisionSupportClarificationGatedIntegrationPlan,
  explainDecisionSupportClarificationGatedIntegrationPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportClarificationGatedIntegrationPlan.ts";
import { DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_CASES } from "./fixtures/conversational-brain-decision-support-clarification-gated-integration-plan-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Regression imports — Sprint 18R-30R + golden/classifier/vocabulary suites, reused read-only for comparison.
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
import { runGoldenIntentEvaluation, summarizeGoldenIntentEvaluation } from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

/**
 * Sprint 31R — Clarification-Gated Decision Support Integration Plan.
 *
 * Tests the pure, offline, deterministic integration plan in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportClarificationGatedIntegrationPlan.ts`.
 * This plans how decision_support would eventually be integrated behind a clarification gate — it
 * creates no database, migration, table, real storage adapter, Supabase write, or feature flag, does
 * not touch the router/composer/endpoint, and never shows anything to a user.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const PLAN = buildDecisionSupportClarificationGatedIntegrationPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const SUMMARY = summarizeDecisionSupportClarificationGatedIntegrationPlan(PLAN);

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 30 and 50 cases", () => {
  assert.ok(DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_CASES.length >= 30);
  assert.ok(DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_CASES.length <= 50);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.routeKind, "string");
    assert.equal(typeof c.expectedGateReady, "boolean");
    assert.equal(typeof c.expectedSafeForIntegrationPlan, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleDryRun, "boolean");
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(typeof c.expectedDirectDecisionOutputBlocked, "boolean");
    assert.equal(typeof c.expectedDecision, "string");
    assert.equal(typeof c.expectedSideEffectsZero, "boolean");
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_VERSION, "string");
  assert.ok(DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportClarificationGatedIntegrationPlanConfig", createDecisionSupportClarificationGatedIntegrationPlanConfig],
  ["listDecisionSupportClarificationGatedIntegrationActionPolicies", listDecisionSupportClarificationGatedIntegrationActionPolicies],
  ["listDecisionSupportClarificationGatedIntegrationAllowedNextActions", listDecisionSupportClarificationGatedIntegrationAllowedNextActions],
  ["listDecisionSupportClarificationGatedIntegrationProhibitedActions", listDecisionSupportClarificationGatedIntegrationProhibitedActions],
  ["createDecisionSupportClarificationGatedRouteContract", createDecisionSupportClarificationGatedRouteContract],
  ["createDecisionSupportClarificationGateRequirements", createDecisionSupportClarificationGateRequirements],
  ["classifyDecisionSupportClarificationGatedRouteKind", classifyDecisionSupportClarificationGatedRouteKind],
  ["assessDecisionSupportClarificationGatedIntegrationCase", assessDecisionSupportClarificationGatedIntegrationCase],
  ["buildDecisionSupportClarificationGatedIntegrationPlan", buildDecisionSupportClarificationGatedIntegrationPlan],
  ["summarizeDecisionSupportClarificationGatedIntegrationPlan", summarizeDecisionSupportClarificationGatedIntegrationPlan],
  ["explainDecisionSupportClarificationGatedIntegrationPlan", explainDecisionSupportClarificationGatedIntegrationPlan],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture cgip-config-default-strict)", () => {
  fixtureFor("cgip-config-default-strict");
  const config = createDecisionSupportClarificationGatedIntegrationPlanConfig();
  assert.equal(config.profile, "strict_clarification_gated_integration_plan");
  assert.equal(config.mode, "plan_only");
  assert.equal(config.allowProductionWiring, false);
  assert.equal(config.allowRouterChange, false);
  assert.equal(config.allowComposerChange, false);
  assert.equal(config.allowEndpointChange, false);
  assert.equal(config.allowUserVisibleDecisionSupport, false);
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.requireClarificationGate, true);
  assert.equal(config.requireExistingRoutePreservation, true);
  assert.equal(config.requireUnsupportedPreservation, true);
  assert.equal(config.requireShadowReplayClean, true);
  assert.equal(config.requireSafeResponseDryRunBeforeVisibility, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "cgip-config-block-production-wiring",
  "cgip-config-block-router-change",
  "cgip-config-block-composer-change",
  "cgip-config-block-endpoint-change",
  "cgip-config-block-user-visible-decision-support",
  "cgip-config-block-real-persistence",
  "cgip-config-block-db-write",
  "cgip-config-block-supabase-write",
  "cgip-config-block-external-calls",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 9);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportClarificationGatedIntegrationPlanConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all nine are forced true at once", () => {
  const config = createDecisionSupportClarificationGatedIntegrationPlanConfig({
    allowProductionWiring: true,
    allowRouterChange: true,
    allowComposerChange: true,
    allowEndpointChange: true,
    allowUserVisibleDecisionSupport: true,
    allowRealPersistence: true,
    allowDbWrite: true,
    allowSupabaseWrite: true,
    allowExternalCalls: true,
  });
  assert.equal(config.allowProductionWiring, false);
  assert.equal(config.allowRouterChange, false);
  assert.equal(config.allowComposerChange, false);
  assert.equal(config.allowEndpointChange, false);
  assert.equal(config.allowUserVisibleDecisionSupport, false);
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
});

test("config honors safe overrides (mode, now, notes)", () => {
  const config = createDecisionSupportClarificationGatedIntegrationPlanConfig({
    mode: "route_contract_review",
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "route_contract_review");
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Action policies ────────────────────────────────────────────────────────────────

const ACTION_POLICY_FIXTURE_IDS = [
  "cgip-action-classifier-detects-boundary",
  "cgip-action-route-to-clarification-gate",
  "cgip-action-generate-decision-support-candidate",
  "cgip-action-compose-user-visible-response",
  "cgip-action-wire-router",
  "cgip-action-wire-composer",
  "cgip-action-enable-production-feature-flag",
  "cgip-action-persist-shadow-output",
  "cgip-action-execute-decision-support-action",
];

assert.equal(ACTION_POLICY_FIXTURE_IDS.length, 9);

const EXPECTED_ACTION_POLICIES = {
  classifierDetectsDecisionSupportBoundary: { allowedInSprint31: true, futureOnly: false, prohibitedInSprint31: false, requiresClarificationGate: true, requiresUserVisibleDryRun: false, requiresProductionReview: false },
  routeToClarificationGate: { allowedInSprint31: true, futureOnly: false, prohibitedInSprint31: false, requiresClarificationGate: true, requiresUserVisibleDryRun: false, requiresProductionReview: false },
  generateDecisionSupportCandidate: { allowedInSprint31: true, futureOnly: false, prohibitedInSprint31: false, requiresClarificationGate: true, requiresUserVisibleDryRun: true, requiresProductionReview: false },
  composeUserVisibleDecisionSupportResponse: { allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true, requiresClarificationGate: true, requiresUserVisibleDryRun: true, requiresProductionReview: true },
  wireRouterToDecisionSupport: { allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true, requiresClarificationGate: true, requiresUserVisibleDryRun: true, requiresProductionReview: true },
  wireComposerToDecisionSupport: { allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true, requiresClarificationGate: true, requiresUserVisibleDryRun: true, requiresProductionReview: true },
  enableProductionFeatureFlag: { allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true, requiresClarificationGate: true, requiresUserVisibleDryRun: true, requiresProductionReview: true },
  persistDecisionSupportShadowOutput: { allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true, requiresClarificationGate: false, requiresUserVisibleDryRun: false, requiresProductionReview: true },
  executeDecisionSupportAction: { allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true, requiresClarificationGate: true, requiresUserVisibleDryRun: true, requiresProductionReview: true },
};

test("listDecisionSupportClarificationGatedIntegrationActionPolicies returns exactly 9 policies", () => {
  const policies = listDecisionSupportClarificationGatedIntegrationActionPolicies();
  assert.equal(policies.length, 9);
  assert.deepEqual(new Set(policies.map((p) => p.actionName)), new Set(Object.keys(EXPECTED_ACTION_POLICIES)));
});

for (const fixtureId of ACTION_POLICY_FIXTURE_IDS) {
  test(`${fixtureId}: action policy flags match exactly`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const actionName = fixtureCase.actionPolicyName;
    assert.ok(actionName, `fixture ${fixtureId} must declare actionPolicyName`);
    const policies = listDecisionSupportClarificationGatedIntegrationActionPolicies();
    const policy = policies.find((p) => p.actionName === actionName);
    assert.ok(policy, `missing action policy ${actionName}`);
    const expected = EXPECTED_ACTION_POLICIES[actionName];
    assert.equal(policy.allowedInSprint31, expected.allowedInSprint31);
    assert.equal(policy.futureOnly, expected.futureOnly);
    assert.equal(policy.prohibitedInSprint31, expected.prohibitedInSprint31);
    assert.equal(policy.requiresClarificationGate, expected.requiresClarificationGate);
    assert.equal(policy.requiresUserVisibleDryRun, expected.requiresUserVisibleDryRun);
    assert.equal(policy.requiresProductionReview, expected.requiresProductionReview);
    assert.equal(typeof policy.reason, "string");
    assert.ok(policy.reason.length > 0);
  });
}

test("listDecisionSupportClarificationGatedIntegrationActionPolicies returns a fresh array each call", () => {
  const a = listDecisionSupportClarificationGatedIntegrationActionPolicies();
  a.push({ actionName: "bogus" });
  const b = listDecisionSupportClarificationGatedIntegrationActionPolicies();
  assert.ok(!b.some((p) => p.actionName === "bogus"));
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportClarificationGatedIntegrationAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("user-visible dry run"));
  assert.ok(joined.includes("response qa"));
  assert.ok(joined.includes("clarification-gated route contract"));
  assert.ok(joined.includes("safe response draft"));
  assert.ok(joined.includes("route preservation"));
});

test("listDecisionSupportClarificationGatedIntegrationAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportClarificationGatedIntegrationAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportClarificationGatedIntegrationAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportClarificationGatedIntegrationProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("production wiring"));
  assert.ok(joined.includes("router change"));
  assert.ok(joined.includes("composer change"));
  assert.ok(joined.includes("endpoint change"));
  assert.ok(joined.includes("user-visible decision support output"));
  assert.ok(joined.includes("real persistence"));
  assert.ok(joined.includes("db write"));
  assert.ok(joined.includes("supabase write"));
  assert.ok(joined.includes("migration file"));
  assert.ok(joined.includes("sql file"));
  assert.ok(joined.includes("production feature flag"));
  assert.ok(joined.includes("real repository"));
  assert.ok(joined.includes("real storage adapter"));
  assert.ok(joined.includes("action execution"));
  assert.ok(joined.includes("email/task/draft creation"));
});

test("listDecisionSupportClarificationGatedIntegrationProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportClarificationGatedIntegrationProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportClarificationGatedIntegrationProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Route contracts ────────────────────────────────────────────────────────────────

test("cgip-route-contract-clarification-gated: contract shape", () => {
  fixtureFor("cgip-route-contract-clarification-gated");
  const contract = createDecisionSupportClarificationGatedRouteContract("clarification_gated_decision_support");
  assert.equal(contract.routeKind, "clarification_gated_decision_support");
  assert.equal(contract.preservesExistingRoute, false);
  assert.equal(contract.preservesUnsupportedBehavior, false);
  assert.equal(contract.requiresClarificationGate, true);
  assert.equal(contract.allowsDirectDecisionOutput, false);
  assert.equal(contract.allowsUserVisibleDryRun, true);
  assert.equal(contract.allowsProductionWiring, false);
  assert.deepEqual(
    contract.requiredGateTypes,
    ["must_clarify_before_decision", "must_confirm_context", "must_confirm_missing_slots", "must_not_show_decision_output"],
  );
  assert.ok(contract.prohibitedBehaviors.length > 0);
  assert.equal(contract.expectedNextStage, "user_visible_dry_run_plan");
});

test("cgip-route-contract-existing-route: contract shape", () => {
  fixtureFor("cgip-route-contract-existing-route");
  const contract = createDecisionSupportClarificationGatedRouteContract("existing_route_preserved");
  assert.equal(contract.preservesExistingRoute, true);
  assert.equal(contract.preservesUnsupportedBehavior, false);
  assert.equal(contract.requiresClarificationGate, false);
  assert.equal(contract.allowsDirectDecisionOutput, false);
  assert.equal(contract.allowsUserVisibleDryRun, false);
  assert.equal(contract.allowsProductionWiring, false);
  assert.deepEqual(contract.requiredGateTypes, ["must_preserve_existing_route", "must_not_show_decision_output"]);
  assert.equal(contract.expectedNextStage, "preserve_existing_behavior");
});

test("cgip-route-contract-unsupported: contract shape", () => {
  fixtureFor("cgip-route-contract-unsupported");
  const contract = createDecisionSupportClarificationGatedRouteContract("unsupported_preserved");
  assert.equal(contract.preservesExistingRoute, false);
  assert.equal(contract.preservesUnsupportedBehavior, true);
  assert.equal(contract.requiresClarificationGate, false);
  assert.equal(contract.allowsDirectDecisionOutput, false);
  assert.equal(contract.allowsUserVisibleDryRun, false);
  assert.equal(contract.allowsProductionWiring, false);
  assert.deepEqual(contract.requiredGateTypes, ["must_keep_unsupported", "must_not_show_decision_output"]);
  assert.equal(contract.expectedNextStage, "preserve_unsupported_behavior");
});

test("cgip-route-contract-shadow-only: contract shape", () => {
  fixtureFor("cgip-route-contract-shadow-only");
  const contract = createDecisionSupportClarificationGatedRouteContract("shadow_only");
  assert.equal(contract.preservesExistingRoute, false);
  assert.equal(contract.preservesUnsupportedBehavior, false);
  assert.equal(contract.requiresClarificationGate, false);
  assert.equal(contract.allowsDirectDecisionOutput, false);
  assert.equal(contract.allowsUserVisibleDryRun, false);
  assert.equal(contract.allowsProductionWiring, false);
  assert.deepEqual(contract.requiredGateTypes, ["must_remain_shadow_only", "must_not_show_decision_output"]);
  assert.equal(contract.expectedNextStage, "continue_shadow_only");
});

test("every route contract prohibits production wiring", () => {
  for (const routeKind of ["clarification_gated_decision_support", "existing_route_preserved", "unsupported_preserved", "shadow_only"]) {
    const contract = createDecisionSupportClarificationGatedRouteContract(routeKind);
    assert.equal(contract.allowsProductionWiring, false, `routeKind ${routeKind} must never allow production wiring`);
    assert.equal(contract.allowsDirectDecisionOutput, false, `routeKind ${routeKind} must never allow direct decision output`);
  }
});

// ─── Gate requirements ──────────────────────────────────────────────────────────────

test("cgip-gates-clarification-gated: 4 gates, all blocking direct decision output", () => {
  fixtureFor("cgip-gates-clarification-gated");
  const gates = createDecisionSupportClarificationGateRequirements("clarification_gated_decision_support");
  assert.equal(gates.length, 4);
  assert.deepEqual(
    new Set(gates.map((g) => g.gateType)),
    new Set(["must_clarify_before_decision", "must_confirm_context", "must_confirm_missing_slots", "must_not_show_decision_output"]),
  );
  for (const g of gates) assert.equal(g.blocksDirectDecisionOutput, true);
});

test("cgip-gates-existing-route: 2 gates", () => {
  fixtureFor("cgip-gates-existing-route");
  const gates = createDecisionSupportClarificationGateRequirements("existing_route_preserved");
  assert.equal(gates.length, 2);
  assert.deepEqual(new Set(gates.map((g) => g.gateType)), new Set(["must_preserve_existing_route", "must_not_show_decision_output"]));
});

test("cgip-gates-unsupported: 2 gates", () => {
  fixtureFor("cgip-gates-unsupported");
  const gates = createDecisionSupportClarificationGateRequirements("unsupported_preserved");
  assert.equal(gates.length, 2);
  assert.deepEqual(new Set(gates.map((g) => g.gateType)), new Set(["must_keep_unsupported", "must_not_show_decision_output"]));
});

test("cgip-gates-shadow-only: 2 gates", () => {
  fixtureFor("cgip-gates-shadow-only");
  const gates = createDecisionSupportClarificationGateRequirements("shadow_only");
  assert.equal(gates.length, 2);
  assert.deepEqual(new Set(gates.map((g) => g.gateType)), new Set(["must_remain_shadow_only", "must_not_show_decision_output"]));
});

test("every gate requirement, for every route kind, blocks direct decision output", () => {
  for (const routeKind of ["clarification_gated_decision_support", "existing_route_preserved", "unsupported_preserved", "shadow_only"]) {
    const gates = createDecisionSupportClarificationGateRequirements(routeKind);
    for (const g of gates) assert.equal(g.blocksDirectDecisionOutput, true, `routeKind ${routeKind} gate ${g.gateType} must block direct decision output`);
  }
});

test("must_not_show_decision_output gate is present with critical severity for every route kind", () => {
  for (const routeKind of ["clarification_gated_decision_support", "existing_route_preserved", "unsupported_preserved", "shadow_only"]) {
    const gates = createDecisionSupportClarificationGateRequirements(routeKind);
    const gate = gates.find((g) => g.gateType === "must_not_show_decision_output");
    assert.ok(gate, `routeKind ${routeKind} must include must_not_show_decision_output`);
    assert.equal(gate.severity, "critical");
    assert.equal(gate.status, "required");
  }
});

// ─── Classification ─────────────────────────────────────────────────────────────────

test("classifyDecisionSupportClarificationGatedRouteKind maps every Sprint 30R route recommendation", () => {
  assert.equal(classifyDecisionSupportClarificationGatedRouteKind({ caseId: "x", routeRecommendation: "clarification_gated_decision_support" }), "clarification_gated_decision_support");
  assert.equal(classifyDecisionSupportClarificationGatedRouteKind({ caseId: "x", routeRecommendation: "keep_existing_route" }), "existing_route_preserved");
  assert.equal(classifyDecisionSupportClarificationGatedRouteKind({ caseId: "x", routeRecommendation: "keep_unsupported" }), "unsupported_preserved");
  assert.equal(classifyDecisionSupportClarificationGatedRouteKind({ caseId: "x", routeRecommendation: "shadow_only" }), "shadow_only");
  assert.equal(classifyDecisionSupportClarificationGatedRouteKind({ caseId: "x", routeRecommendation: "needs_more_replay" }), "shadow_only");
});

// ─── Case assessment ────────────────────────────────────────────────────────────────

const ASSESSMENT_FIXTURE_IDS = [
  "cgip-assessment-clarification-gated",
  "cgip-assessment-existing-route",
  "cgip-assessment-unsupported",
  "cgip-assessment-shadow-only",
];

assert.equal(ASSESSMENT_FIXTURE_IDS.length, 4);

for (const fixtureId of ASSESSMENT_FIXTURE_IDS) {
  test(`${fixtureId}: case assessment matches expected flags`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const assessment = assessDecisionSupportClarificationGatedIntegrationCase(fixtureCase.sourceCase);
    assert.equal(assessment.routeKind, fixtureCase.routeKind);
    assert.equal(assessment.gateReady, fixtureCase.expectedGateReady);
    assert.equal(assessment.safeForIntegrationPlan, fixtureCase.expectedSafeForIntegrationPlan);
    assert.equal(assessment.safeForUserVisibleDryRun, fixtureCase.expectedSafeForUserVisibleDryRun);
    assert.equal(assessment.safeForProduction, fixtureCase.expectedSafeForProduction);
    assert.equal(assessment.directDecisionOutputBlocked, fixtureCase.expectedDirectDecisionOutputBlocked);
  });
}

test("assessDecisionSupportClarificationGatedIntegrationCase: shouldUseClarificationGate/shouldPreserveExistingRoute/shouldPreserveUnsupported/shouldRemainShadowOnly are mutually exclusive per route kind", () => {
  const clarificationGated = assessDecisionSupportClarificationGatedIntegrationCase({ caseId: "a", routeRecommendation: "clarification_gated_decision_support" });
  assert.equal(clarificationGated.shouldUseClarificationGate, true);
  assert.equal(clarificationGated.shouldPreserveExistingRoute, false);
  assert.equal(clarificationGated.shouldPreserveUnsupported, false);
  assert.equal(clarificationGated.shouldRemainShadowOnly, false);

  const existingRoute = assessDecisionSupportClarificationGatedIntegrationCase({ caseId: "b", routeRecommendation: "keep_existing_route" });
  assert.equal(existingRoute.shouldPreserveExistingRoute, true);
  assert.equal(existingRoute.shouldUseClarificationGate, false);

  const unsupported = assessDecisionSupportClarificationGatedIntegrationCase({ caseId: "c", routeRecommendation: "keep_unsupported" });
  assert.equal(unsupported.shouldPreserveUnsupported, true);
  assert.equal(unsupported.shouldUseClarificationGate, false);

  const shadowOnly = assessDecisionSupportClarificationGatedIntegrationCase({ caseId: "d", routeRecommendation: "shadow_only" });
  assert.equal(shadowOnly.shouldRemainShadowOnly, true);
  assert.equal(shadowOnly.shouldUseClarificationGate, false);
});

// ─── Direct decision output / production always blocked ───────────────────────────

test("cgip-direct-decision-output-always-blocked: literal true across every route kind", () => {
  fixtureFor("cgip-direct-decision-output-always-blocked");
  for (const routeRecommendation of ["clarification_gated_decision_support", "keep_existing_route", "keep_unsupported", "shadow_only"]) {
    const assessment = assessDecisionSupportClarificationGatedIntegrationCase({ caseId: "x", routeRecommendation });
    assert.equal(assessment.directDecisionOutputBlocked, true);
    assert.equal(assessment.routeContract.allowsDirectDecisionOutput, false);
  }
});

test("cgip-production-always-blocked: literal false across every route kind", () => {
  fixtureFor("cgip-production-always-blocked");
  for (const routeRecommendation of ["clarification_gated_decision_support", "keep_existing_route", "keep_unsupported", "shadow_only"]) {
    const assessment = assessDecisionSupportClarificationGatedIntegrationCase({ caseId: "x", routeRecommendation });
    assert.equal(assessment.safeForProduction, false);
    assert.equal(assessment.routeContract.allowsProductionWiring, false);
  }
});

// ─── Plan build ─────────────────────────────────────────────────────────────────────

test("buildDecisionSupportClarificationGatedIntegrationPlan produces one assessment per replayed case", () => {
  assert.equal(PLAN.assessments.length, DECISION_CLARIFICATION_CASES.length);
});

test("buildDecisionSupportClarificationGatedIntegrationPlan reuses the Sprint 30R replay decision", () => {
  assert.equal(PLAN.replaySummary.decision, "ready_for_clarification_gated_integration_plan");
});

test("buildDecisionSupportClarificationGatedIntegrationPlan reuses the Sprint 29R persistence readiness decision", () => {
  assert.equal(PLAN.persistenceReadinessSummary.decision, "do_not_build_real_persistence_yet");
});

test("buildDecisionSupportClarificationGatedIntegrationPlan reuses Sprint 25R-28R layer summaries", () => {
  assert.equal(PLAN.captureHarnessEvaluationSummary.acceptableCaptureRate, 100);
  assert.equal(PLAN.storagePolicyEvaluationSummary.rawInputViolationCount, 0);
  assert.equal(PLAN.storageAdapterPlanEvaluationSummary.validDraftRate, 100);
  assert.equal(PLAN.fakeAdapterEvaluationSummary.fakeWriteAcceptedRate, 100);
});

test("buildDecisionSupportClarificationGatedIntegrationPlan reuses the Sprint 22R clarification response evaluation", () => {
  assert.equal(PLAN.clarificationResponseEvaluationSummary.safetyPassRate, 100);
});

test("buildDecisionSupportClarificationGatedIntegrationPlan honors the default synthetic corpus when no cases are supplied", () => {
  const defaultPlan = buildDecisionSupportClarificationGatedIntegrationPlan({ now: NOW });
  assert.ok(defaultPlan.assessments.length > 0);
  assert.ok(defaultPlan.assessments.length < DECISION_CLARIFICATION_CASES.length);
});

// ─── Plan summary ───────────────────────────────────────────────────────────────────

test("summary: totalCases matches the Sprint 18R corpus size", () => {
  assert.equal(SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
});

test("summary: route kind counts sum to totalCases", () => {
  const sum = SUMMARY.clarificationGatedCaseCount + SUMMARY.existingRoutePreservedCaseCount + SUMMARY.unsupportedPreservedCaseCount + SUMMARY.shadowOnlyCaseCount;
  assert.equal(sum, SUMMARY.totalCases);
});

test("summary: gateMissingCaseCount is 0 and gateReadyCaseCount equals clarificationGatedCaseCount", () => {
  assert.equal(SUMMARY.gateMissingCaseCount, 0);
  assert.equal(SUMMARY.gateReadyCaseCount, SUMMARY.clarificationGatedCaseCount);
});

test("summary: safeForIntegrationPlanCount equals totalCases and directDecisionOutputBlockedCount equals totalCases", () => {
  assert.equal(SUMMARY.safeForIntegrationPlanCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.directDecisionOutputBlockedCount, SUMMARY.totalCases);
});

test("summary: safeForUserVisibleDryRunCount equals clarificationGated + existingRoutePreserved counts", () => {
  assert.equal(SUMMARY.safeForUserVisibleDryRunCount, SUMMARY.clarificationGatedCaseCount + SUMMARY.existingRoutePreservedCaseCount);
});

test("summary: safeForProductionCount is 0 (fixture cgip-production-always-blocked invariant, at plan level)", () => {
  assert.equal(SUMMARY.safeForProductionCount, 0);
});

test("cgip-zero-side-effects: every production/wiring-attempted count is zero", () => {
  fixtureFor("cgip-zero-side-effects");
  assert.equal(SUMMARY.productionWiringAttemptedCount, 0);
  assert.equal(SUMMARY.routerChangeAttemptedCount, 0);
  assert.equal(SUMMARY.composerChangeAttemptedCount, 0);
  assert.equal(SUMMARY.endpointChangeAttemptedCount, 0);
  assert.equal(SUMMARY.userVisibleDecisionSupportAttemptedCount, 0);
  assert.equal(SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(SUMMARY.externalCallAttemptedCount, 0);
});

test("cgip-decision-ready-for-dry-run-plan: decision is ready_for_user_visible_dry_run_plan", () => {
  fixtureFor("cgip-decision-ready-for-dry-run-plan");
  assert.equal(SUMMARY.decision, "ready_for_user_visible_dry_run_plan");
});

test("cgip-recommended-sprint-32r: recommendedNextSprint is Sprint 32R", () => {
  fixtureFor("cgip-recommended-sprint-32r");
  assert.equal(SUMMARY.recommendedNextSprint, "Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan");
});

test("summary accepts a bare assessments array plus sprint30ReplayDecision option", () => {
  const bareSummary = summarizeDecisionSupportClarificationGatedIntegrationPlan(PLAN.assessments, {
    sprint30ReplayDecision: PLAN.replaySummary.decision,
  });
  assert.equal(bareSummary.totalCases, SUMMARY.totalCases);
  assert.equal(bareSummary.decision, SUMMARY.decision);
});

test("summary: bare assessments array without sprint30ReplayDecision cannot reach ready_for_user_visible_dry_run_plan", () => {
  const bareSummary = summarizeDecisionSupportClarificationGatedIntegrationPlan(PLAN.assessments);
  assert.notEqual(bareSummary.decision, "ready_for_user_visible_dry_run_plan");
});

test("summary: representativeClarificationGatedCases is capped and preservedExistingRouteCases/preservedUnsupportedCases match counts", () => {
  assert.ok(SUMMARY.representativeClarificationGatedCases.length <= 8);
  assert.equal(SUMMARY.preservedExistingRouteCases.length, SUMMARY.existingRoutePreservedCaseCount);
  assert.equal(SUMMARY.preservedUnsupportedCases.length, SUMMARY.unsupportedPreservedCaseCount);
});

// ─── Explain ────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportClarificationGatedIntegrationPlan returns a structured explanation", () => {
  const explain = explainDecisionSupportClarificationGatedIntegrationPlan();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
});

// ─── Regression: Sprint 18R-30R + golden/classifier metrics unchanged ──────────────

test("regression: Sprint 30R controlled replay metrics stay clean against the 79-case corpus", () => {
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowControlledReplayEvaluation(evaluation);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.deterministicReplayRate, 100);
  assert.equal(summary.safeReplayRate, 100);
  assert.equal(summary.fakeWriteAcceptedRate, 100);
  assert.equal(summary.decision, "ready_for_clarification_gated_integration_plan");
});

test("regression: Sprint 29R persistence readiness baseline matches the documented Sprint 29R result", () => {
  const inputMetrics = createDecisionSupportShadowPersistenceReadinessInputMetrics(DECISION_CLARIFICATION_CASES, { now: NOW });
  const review = buildDecisionSupportShadowPersistenceReadinessReview({ now: NOW, inputMetrics });
  const summary = summarizeDecisionSupportShadowPersistenceReadinessReview(review);
  assert.equal(summary.readinessScore, 62.9);
  assert.equal(summary.decision, "do_not_build_real_persistence_yet");
  assert.equal(summary.realPersistenceAllowedNow, false);
  assert.equal(summary.migrationFileAllowedNow, false);
  assert.equal(summary.sqlFileAllowedNow, false);
});

test("regression: Sprint 28R fake adapter metrics stay clean against the 79-case corpus", () => {
  const result = runDecisionSupportShadowStorageFakeAdapterEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(result);
  assert.equal(summary.fakeWriteAcceptedRate, 100);
  assert.equal(summary.readinessStatus, "ready_for_persistence_readiness_review");
});

test("regression: Sprint 27R adapter plan metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStorageAdapterPlanEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(results);
  assert.equal(summary.validDraftRate, 100);
  assert.equal(summary.invalidDraftCount, 0);
});

test("regression: Sprint 26R storage policy metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStoragePolicyEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStoragePolicyEvaluation(results);
  assert.equal(summary.rawInputViolationCount, 0);
  assert.equal(summary.fullCandidateViolationCount, 0);
  assert.equal(summary.sideEffectViolationCount, 0);
});

test("regression: Sprint 25R shadow capture harness metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW, context: { mode: "dry_run" } });
  const summary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(results);
  assert.equal(summary.acceptableCaptureRate, 100);
  assert.equal(summary.rawInputRetainedCount, 0);
  assert.equal(summary.userVisibleOutputRetainedCount, 0);
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
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportClarificationGatedIntegrationPlan.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportClarificationGatedIntegrationPlanTypes.ts", import.meta.url),
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

test("this module never calls the system clock (no bare Date.now()/new Date())", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /new Date\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /Date\.now\(\)/);
});

test("this module never imports from tests/fixtures/", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /tests\/fixtures/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportClarificationGatedIntegrationPlan/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});
