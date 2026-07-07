/**
 * Sprint 31R — Clarification-Gated Decision Support Integration Plan: fixtures.
 *
 * Scenario descriptors used by
 * `tests/playbook-engine-conversation-decision-support-clarification-gated-integration-plan.test.mjs`.
 * Each entry documents one behavior this sprint must exhibit — some carry a `sourceCase` (a minimal
 * `DecisionSupportClarificationGatedIntegrationSourceCase`-shaped object, i.e. anything with
 * `caseId`/`category`/`routeRecommendation`, exactly what a Sprint 30R replay aggregate or pass result
 * already carries) that the test file classifies/assesses through the actual pipeline; others (e.g.
 * "attempt to enable X blocked", "action policy Y") describe a config/list-level invariant the test
 * file checks directly, and use neutral placeholders for the fields that do not apply.
 *
 * This fixture never imports from `src/`, and is never imported by production code — it exists only
 * for this sprint's own test suite.
 */

export type DecisionSupportClarificationGatedIntegrationPlanFixtureRouteKind =
  | "clarification_gated_decision_support"
  | "existing_route_preserved"
  | "unsupported_preserved"
  | "shadow_only";

export type DecisionSupportClarificationGatedIntegrationPlanFixtureSourceCase = {
  caseId: string;
  category?: string;
  routeRecommendation: "clarification_gated_decision_support" | "keep_existing_route" | "keep_unsupported" | "shadow_only" | "needs_more_replay";
};

export type DecisionSupportClarificationGatedIntegrationPlanFixtureCase = {
  id: string;
  scenario: string;
  routeKind: DecisionSupportClarificationGatedIntegrationPlanFixtureRouteKind;
  expectedGateReady: boolean;
  expectedSafeForIntegrationPlan: boolean;
  expectedSafeForUserVisibleDryRun: boolean;
  expectedSafeForProduction: boolean;
  expectedDirectDecisionOutputBlocked: boolean;
  expectedDecision: string;
  expectedSideEffectsZero: boolean;
  notes: string;
  /** Present only for scenarios that classify/assess a real replay-shaped source case. */
  sourceCase?: DecisionSupportClarificationGatedIntegrationPlanFixtureSourceCase;
  /** Present only for the nine "attempt to enable X blocked" config scenarios. */
  configOverrideField?:
    | "allowProductionWiring"
    | "allowRouterChange"
    | "allowComposerChange"
    | "allowEndpointChange"
    | "allowUserVisibleDecisionSupport"
    | "allowRealPersistence"
    | "allowDbWrite"
    | "allowSupabaseWrite"
    | "allowExternalCalls";
  /** Present only for the nine action-policy scenarios. */
  actionPolicyName?: string;
};

const DECISION_CANDIDATE_SOURCE_CASE: DecisionSupportClarificationGatedIntegrationPlanFixtureSourceCase = {
  caseId: "cgip-fixture-decision-01",
  category: "decision_candidate",
  routeRecommendation: "clarification_gated_decision_support",
};

const CLARIFICATION_CANDIDATE_SOURCE_CASE: DecisionSupportClarificationGatedIntegrationPlanFixtureSourceCase = {
  caseId: "cgip-fixture-clarification-01",
  category: "clarification_candidate",
  routeRecommendation: "clarification_gated_decision_support",
};

const EXISTING_ROUTE_SOURCE_CASE: DecisionSupportClarificationGatedIntegrationPlanFixtureSourceCase = {
  caseId: "cgip-fixture-existing-route-01",
  category: "existing_route_preserved",
  routeRecommendation: "keep_existing_route",
};

const UNSUPPORTED_SOURCE_CASE: DecisionSupportClarificationGatedIntegrationPlanFixtureSourceCase = {
  caseId: "cgip-fixture-unsupported-01",
  category: "unsupported_or_not_applicable",
  routeRecommendation: "keep_unsupported",
};

const SHADOW_ONLY_SOURCE_CASE: DecisionSupportClarificationGatedIntegrationPlanFixtureSourceCase = {
  caseId: "cgip-fixture-shadow-only-01",
  category: "decision_candidate",
  routeRecommendation: "shadow_only",
};

export const DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_CASES: DecisionSupportClarificationGatedIntegrationPlanFixtureCase[] = [
  // ─── Config: default strict config (1) ──────────────────────────────────────────────
  {
    id: "cgip-config-default-strict",
    scenario: "config default strict",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGatedIntegrationPlanConfig() with no overrides must return profile " +
      "strict_clarification_gated_integration_plan, mode plan_only, every allow* field false, and every require* field true.",
  },

  // ─── Config: attempts to enable forbidden actions are blocked (9) ──────────────────
  {
    id: "cgip-config-block-production-wiring",
    scenario: "attempt to enable production wiring blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowProductionWiring: true } must still yield allowProductionWiring: false.",
    configOverrideField: "allowProductionWiring",
  },
  {
    id: "cgip-config-block-router-change",
    scenario: "attempt to enable router change blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowRouterChange: true } must still yield allowRouterChange: false.",
    configOverrideField: "allowRouterChange",
  },
  {
    id: "cgip-config-block-composer-change",
    scenario: "attempt to enable composer change blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowComposerChange: true } must still yield allowComposerChange: false.",
    configOverrideField: "allowComposerChange",
  },
  {
    id: "cgip-config-block-endpoint-change",
    scenario: "attempt to enable endpoint change blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowEndpointChange: true } must still yield allowEndpointChange: false.",
    configOverrideField: "allowEndpointChange",
  },
  {
    id: "cgip-config-block-user-visible-decision-support",
    scenario: "attempt to enable user-visible decision support blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowUserVisibleDecisionSupport: true } must still yield allowUserVisibleDecisionSupport: false.",
    configOverrideField: "allowUserVisibleDecisionSupport",
  },
  {
    id: "cgip-config-block-real-persistence",
    scenario: "attempt to enable real persistence blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowRealPersistence: true } must still yield allowRealPersistence: false.",
    configOverrideField: "allowRealPersistence",
  },
  {
    id: "cgip-config-block-db-write",
    scenario: "attempt to enable DB write blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowDbWrite: true } must still yield allowDbWrite: false.",
    configOverrideField: "allowDbWrite",
  },
  {
    id: "cgip-config-block-supabase-write",
    scenario: "attempt to enable Supabase write blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowSupabaseWrite: true } must still yield allowSupabaseWrite: false.",
    configOverrideField: "allowSupabaseWrite",
  },
  {
    id: "cgip-config-block-external-calls",
    scenario: "attempt to enable external calls blocked",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "Passing { allowExternalCalls: true } must still yield allowExternalCalls: false.",
    configOverrideField: "allowExternalCalls",
  },

  // ─── Action policies (9) ─────────────────────────────────────────────────────────────
  {
    id: "cgip-action-classifier-detects-boundary",
    scenario: "action policy: classifierDetectsDecisionSupportBoundary",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "classifierDetectsDecisionSupportBoundary must be allowedInSprint31: true, futureOnly: false, prohibitedInSprint31: false.",
    actionPolicyName: "classifierDetectsDecisionSupportBoundary",
  },
  {
    id: "cgip-action-route-to-clarification-gate",
    scenario: "action policy: routeToClarificationGate",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "routeToClarificationGate must be allowedInSprint31: true, futureOnly: false, prohibitedInSprint31: false.",
    actionPolicyName: "routeToClarificationGate",
  },
  {
    id: "cgip-action-generate-decision-support-candidate",
    scenario: "action policy: generateDecisionSupportCandidate",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "generateDecisionSupportCandidate must be allowedInSprint31: true, requiresUserVisibleDryRun: true.",
    actionPolicyName: "generateDecisionSupportCandidate",
  },
  {
    id: "cgip-action-compose-user-visible-response",
    scenario: "action policy: composeUserVisibleDecisionSupportResponse",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "composeUserVisibleDecisionSupportResponse must be allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true.",
    actionPolicyName: "composeUserVisibleDecisionSupportResponse",
  },
  {
    id: "cgip-action-wire-router",
    scenario: "action policy: wireRouterToDecisionSupport",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "wireRouterToDecisionSupport must be allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true.",
    actionPolicyName: "wireRouterToDecisionSupport",
  },
  {
    id: "cgip-action-wire-composer",
    scenario: "action policy: wireComposerToDecisionSupport",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "wireComposerToDecisionSupport must be allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true.",
    actionPolicyName: "wireComposerToDecisionSupport",
  },
  {
    id: "cgip-action-enable-production-feature-flag",
    scenario: "action policy: enableProductionFeatureFlag",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "enableProductionFeatureFlag must be allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true.",
    actionPolicyName: "enableProductionFeatureFlag",
  },
  {
    id: "cgip-action-persist-shadow-output",
    scenario: "action policy: persistDecisionSupportShadowOutput",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "persistDecisionSupportShadowOutput must be allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true, " +
      "requiresClarificationGate: false, requiresUserVisibleDryRun: false, requiresProductionReview: true.",
    actionPolicyName: "persistDecisionSupportShadowOutput",
  },
  {
    id: "cgip-action-execute-decision-support-action",
    scenario: "action policy: executeDecisionSupportAction",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes: "executeDecisionSupportAction must be allowedInSprint31: false, futureOnly: true, prohibitedInSprint31: true.",
    actionPolicyName: "executeDecisionSupportAction",
  },

  // ─── Route contracts (4) ─────────────────────────────────────────────────────────────
  {
    id: "cgip-route-contract-clarification-gated",
    scenario: "route contract: clarification_gated_decision_support",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGatedRouteContract('clarification_gated_decision_support') must have requiresClarificationGate: true, " +
      "allowsDirectDecisionOutput: false, allowsUserVisibleDryRun: true, allowsProductionWiring: false, and 4 requiredGateTypes.",
    sourceCase: DECISION_CANDIDATE_SOURCE_CASE,
  },
  {
    id: "cgip-route-contract-existing-route",
    scenario: "route contract: existing_route_preserved",
    routeKind: "existing_route_preserved",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGatedRouteContract('existing_route_preserved') must have preservesExistingRoute: true, " +
      "requiresClarificationGate: false, allowsUserVisibleDryRun: false, and 2 requiredGateTypes.",
    sourceCase: EXISTING_ROUTE_SOURCE_CASE,
  },
  {
    id: "cgip-route-contract-unsupported",
    scenario: "route contract: unsupported_preserved",
    routeKind: "unsupported_preserved",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGatedRouteContract('unsupported_preserved') must have preservesUnsupportedBehavior: true, " +
      "allowsUserVisibleDryRun: false, and 2 requiredGateTypes.",
    sourceCase: UNSUPPORTED_SOURCE_CASE,
  },
  {
    id: "cgip-route-contract-shadow-only",
    scenario: "route contract: shadow_only",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGatedRouteContract('shadow_only') must have preservesExistingRoute: false, " +
      "preservesUnsupportedBehavior: false, allowsUserVisibleDryRun: false, and 2 requiredGateTypes.",
    sourceCase: SHADOW_ONLY_SOURCE_CASE,
  },

  // ─── Gate requirement sets (4) ───────────────────────────────────────────────────────
  {
    id: "cgip-gates-clarification-gated",
    scenario: "gate requirements: clarification_gated_decision_support (4 gates)",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGateRequirements('clarification_gated_decision_support') must return exactly " +
      "must_clarify_before_decision, must_confirm_context, must_confirm_missing_slots, must_not_show_decision_output — every gate " +
      "with blocksDirectDecisionOutput: true.",
    sourceCase: CLARIFICATION_CANDIDATE_SOURCE_CASE,
  },
  {
    id: "cgip-gates-existing-route",
    scenario: "gate requirements: existing_route_preserved (2 gates)",
    routeKind: "existing_route_preserved",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGateRequirements('existing_route_preserved') must return exactly " +
      "must_preserve_existing_route, must_not_show_decision_output.",
    sourceCase: EXISTING_ROUTE_SOURCE_CASE,
  },
  {
    id: "cgip-gates-unsupported",
    scenario: "gate requirements: unsupported_preserved (2 gates)",
    routeKind: "unsupported_preserved",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGateRequirements('unsupported_preserved') must return exactly " +
      "must_keep_unsupported, must_not_show_decision_output.",
    sourceCase: UNSUPPORTED_SOURCE_CASE,
  },
  {
    id: "cgip-gates-shadow-only",
    scenario: "gate requirements: shadow_only (2 gates)",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportClarificationGateRequirements('shadow_only') must return exactly " +
      "must_remain_shadow_only, must_not_show_decision_output.",
    sourceCase: SHADOW_ONLY_SOURCE_CASE,
  },

  // ─── Case assessment: safe*/gateReady correctness per route kind (4) ────────────────
  {
    id: "cgip-assessment-clarification-gated",
    scenario: "case assessment: clarification_gated_decision_support",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "assessDecisionSupportClarificationGatedIntegrationCase() for a clarification_gated_decision_support case must yield " +
      "gateReady: true, safeForIntegrationPlan: true, safeForUserVisibleDryRun: true, safeForProduction: false, " +
      "shouldUseClarificationGate: true, directDecisionOutputBlocked: true.",
    sourceCase: DECISION_CANDIDATE_SOURCE_CASE,
  },
  {
    id: "cgip-assessment-existing-route",
    scenario: "case assessment: existing_route_preserved",
    routeKind: "existing_route_preserved",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "assessDecisionSupportClarificationGatedIntegrationCase() for an existing_route_preserved case must yield " +
      "safeForIntegrationPlan: true, safeForUserVisibleDryRun: true, safeForProduction: false, shouldPreserveExistingRoute: true.",
    sourceCase: EXISTING_ROUTE_SOURCE_CASE,
  },
  {
    id: "cgip-assessment-unsupported",
    scenario: "case assessment: unsupported_preserved",
    routeKind: "unsupported_preserved",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "assessDecisionSupportClarificationGatedIntegrationCase() for an unsupported_preserved case must yield " +
      "safeForIntegrationPlan: true, safeForUserVisibleDryRun: false, safeForProduction: false, shouldPreserveUnsupported: true.",
    sourceCase: UNSUPPORTED_SOURCE_CASE,
  },
  {
    id: "cgip-assessment-shadow-only",
    scenario: "case assessment: shadow_only",
    routeKind: "shadow_only",
    expectedGateReady: false,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: false,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "assessDecisionSupportClarificationGatedIntegrationCase() for a shadow_only case must yield safeForIntegrationPlan: true " +
      "(shadow-only-safe), safeForUserVisibleDryRun: false, safeForProduction: false, shouldRemainShadowOnly: true.",
    sourceCase: SHADOW_ONLY_SOURCE_CASE,
  },

  // ─── Direct decision output always blocked (1) ──────────────────────────────────────
  {
    id: "cgip-direct-decision-output-always-blocked",
    scenario: "direct decision output always blocked, across every route kind",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "Every DecisionSupportClarificationGatedIntegrationCaseAssessment.directDecisionOutputBlocked must be the literal true, " +
      "and every DecisionSupportClarificationGatedRouteContract.allowsDirectDecisionOutput must be the literal false, regardless of routeKind.",
    sourceCase: DECISION_CANDIDATE_SOURCE_CASE,
  },

  // ─── Production always blocked (1) ──────────────────────────────────────────────────
  {
    id: "cgip-production-always-blocked",
    scenario: "production always blocked, across every route kind",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "Every DecisionSupportClarificationGatedIntegrationCaseAssessment.safeForProduction must be the literal false, and every " +
      "DecisionSupportClarificationGatedRouteContract.allowsProductionWiring must be the literal false, regardless of routeKind.",
    sourceCase: DECISION_CANDIDATE_SOURCE_CASE,
  },

  // ─── Zero side effects (1) ───────────────────────────────────────────────────────────
  {
    id: "cgip-zero-side-effects",
    scenario: "every production/wiring-attempted count is zero",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "n/a",
    expectedSideEffectsZero: true,
    notes:
      "summarizeDecisionSupportClarificationGatedIntegrationPlan() must report productionWiringAttemptedCount, " +
      "routerChangeAttemptedCount, composerChangeAttemptedCount, endpointChangeAttemptedCount, " +
      "userVisibleDecisionSupportAttemptedCount, realPersistenceAttemptedCount, dbWriteAttemptedCount, " +
      "supabaseWriteAttemptedCount, and externalCallAttemptedCount all at 0.",
  },

  // ─── Final decision + recommended sprint (2) ────────────────────────────────────────
  {
    id: "cgip-decision-ready-for-dry-run-plan",
    scenario: "decision ready_for_user_visible_dry_run_plan",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "ready_for_user_visible_dry_run_plan",
    expectedSideEffectsZero: true,
    notes:
      "summarizeDecisionSupportClarificationGatedIntegrationPlan() over the full Sprint 18R corpus (via buildDecisionSupportClarificationGatedIntegrationPlan " +
      "with DECISION_CLARIFICATION_CASES) must report decision: ready_for_user_visible_dry_run_plan.",
  },
  {
    id: "cgip-recommended-sprint-32r",
    scenario: "recommended Sprint 32R",
    routeKind: "clarification_gated_decision_support",
    expectedGateReady: true,
    expectedSafeForIntegrationPlan: true,
    expectedSafeForUserVisibleDryRun: true,
    expectedSafeForProduction: false,
    expectedDirectDecisionOutputBlocked: true,
    expectedDecision: "ready_for_user_visible_dry_run_plan",
    expectedSideEffectsZero: true,
    notes:
      "summarizeDecisionSupportClarificationGatedIntegrationPlan() over the full Sprint 18R corpus must report recommendedNextSprint: " +
      '"Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan".',
  },
];
