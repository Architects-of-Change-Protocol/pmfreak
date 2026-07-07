import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ALL_DECISION_SUPPORT_ADAPTER_MAPPING_STRATEGIES,
  listDecisionSupportAdapterMappingStrategies,
  simulateDecisionSupportAdapterMapping,
  runDecisionSupportAdapterMappingPlan,
  summarizeDecisionSupportAdapterMappingPlan,
  explainDecisionSupportAdapterMappingPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlan.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

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
 * Sprint 23R — Decision Support Adapter Mapping Plan.
 *
 * Tests the pure, offline planner/simulator in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlan.ts`. This
 * plan does not integrate anything into the router, composer, or any production handler — the safety
 * section below asserts that in behavior (every result carries shouldExecuteAction: false), and the
 * regression section re-runs the golden evaluation and every prior sprint's evaluator to confirm none
 * of their metrics changed.
 */

const ALL_RESULTS = runDecisionSupportAdapterMappingPlan(DECISION_CLARIFICATION_CASES);
const SUMMARY = summarizeDecisionSupportAdapterMappingPlan(ALL_RESULTS);

function resultsForStrategy(strategy) {
  return ALL_RESULTS.filter((r) => r.strategy === strategy);
}

function findResult(strategy, input) {
  const found = ALL_RESULTS.find((r) => r.strategy === strategy && r.input === input);
  assert.ok(found, `expected a result for strategy "${strategy}" and input "${input}"`);
  return found;
}

function findCasesByCategory(category) {
  return DECISION_CLARIFICATION_CASES.filter((c) => c.architectureCategory === category);
}

// ─── Structure ───────────────────────────────────────────────────────────────────

test("listDecisionSupportAdapterMappingStrategies exists and returns all 8 strategies", () => {
  assert.equal(typeof listDecisionSupportAdapterMappingStrategies, "function");
  const strategies = listDecisionSupportAdapterMappingStrategies();
  const expected = [
    "keep_unsupported",
    "map_to_general_pm_advice",
    "map_to_recommendation_request",
    "shadow_candidate_handler_only",
    "feature_flag_default_off",
    "clarify_before_decision_support",
    "hybrid_shadow_then_clarify",
    "do_not_map",
  ];
  assert.deepEqual(strategies, expected);
  assert.deepEqual(ALL_DECISION_SUPPORT_ADAPTER_MAPPING_STRATEGIES, expected);
});

test("simulateDecisionSupportAdapterMapping exists and is a function", () => {
  assert.equal(typeof simulateDecisionSupportAdapterMapping, "function");
});

test("runDecisionSupportAdapterMappingPlan exists and is a function", () => {
  assert.equal(typeof runDecisionSupportAdapterMappingPlan, "function");
});

test("summarizeDecisionSupportAdapterMappingPlan exists and is a function", () => {
  assert.equal(typeof summarizeDecisionSupportAdapterMappingPlan, "function");
});

test("explainDecisionSupportAdapterMappingPlan exists and is a function", () => {
  assert.equal(typeof explainDecisionSupportAdapterMappingPlan, "function");
});

test("evaluator processes the Sprint 18R corpus for every strategy (cases x strategies)", () => {
  assert.equal(ALL_RESULTS.length, DECISION_CLARIFICATION_CASES.length * 8);
});

test("summary.totalCases matches corpus length", () => {
  assert.equal(SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
});

test("summary.strategiesEvaluated is at least 8", () => {
  assert.ok(SUMMARY.strategiesEvaluated >= 8, `expected >= 8, got ${SUMMARY.strategiesEvaluated}`);
});

test("summary.strategySummaries includes every strategy", () => {
  for (const strategy of listDecisionSupportAdapterMappingStrategies()) {
    assert.ok(SUMMARY.strategySummaries[strategy], `expected a strategySummary for "${strategy}"`);
    assert.equal(SUMMARY.strategySummaries[strategy].strategy, strategy);
    assert.equal(SUMMARY.strategySummaries[strategy].totalCases, DECISION_CLARIFICATION_CASES.length);
  }
});

for (const field of ["bestStrategy", "safestNonProductionStrategy", "safestFutureIntegrationStrategy", "recommendedSprint24Strategy", "recommendedNextSprint"]) {
  test(`summary.${field} exists`, () => {
    assert.notEqual(SUMMARY[field], undefined, `expected summary.${field} to be defined`);
  });
}

// ─── Strategy behavior: keep_unsupported ────────────────────────────────────────

test("keep_unsupported: decision_support cases map to unsupported / safe_parking / low risk, no wiring", () => {
  for (const c of findCasesByCategory("decision_support_clear")) {
    const r = findResult("keep_unsupported", c.input);
    assert.equal(r.simulatedMappedIntent, "unsupported");
    assert.equal(r.simulatedOutcome, "safe_parking");
    assert.equal(r.riskLevel, "low");
    assert.equal(r.requiresRouterChange, false);
    assert.equal(r.requiresFeatureFlag, false);
    assert.equal(r.introducesProductionBehavior, false);
  }
});

// ─── Strategy behavior: map_to_general_pm_advice ────────────────────────────────

test("map_to_general_pm_advice: decision_support cases map to general_pm_advice / unsafe_generic_answer / high-or-critical risk", () => {
  for (const c of findCasesByCategory("decision_support_clear")) {
    const r = findResult("map_to_general_pm_advice", c.input);
    assert.equal(r.simulatedMappedIntent, "general_pm_advice");
    assert.equal(r.simulatedOutcome, "unsafe_generic_answer");
    assert.ok(["high", "critical"].includes(r.riskLevel), `expected high/critical risk, got ${r.riskLevel}`);
  }
});

test("map_to_general_pm_advice: recommendedForSprint24 is false and it never wins bestStrategy", () => {
  assert.equal(SUMMARY.strategySummaries.map_to_general_pm_advice.recommendedForSprint24, false);
  assert.notEqual(SUMMARY.bestStrategy, "map_to_general_pm_advice");
});

// ─── Strategy behavior: map_to_recommendation_request ───────────────────────────

test("map_to_recommendation_request: decision_support cases map to recommendation_request / unsafe_playbook_answer / high risk", () => {
  for (const c of findCasesByCategory("decision_support_vs_playbook")) {
    const r = findResult("map_to_recommendation_request", c.input);
    assert.equal(r.simulatedMappedIntent, "recommendation_request");
    assert.equal(r.simulatedOutcome, "unsafe_playbook_answer");
    assert.equal(r.riskLevel, "high");
  }
});

test("map_to_recommendation_request: recommendedForSprint24 is false and it never wins bestStrategy", () => {
  assert.equal(SUMMARY.strategySummaries.map_to_recommendation_request.recommendedForSprint24, false);
  assert.notEqual(SUMMARY.bestStrategy, "map_to_recommendation_request");
});

// ─── Strategy behavior: shadow_candidate_handler_only ───────────────────────────

test("shadow_candidate_handler_only: eligible decision_support cases run the candidate handler safely and never execute/show anything", () => {
  const results = resultsForStrategy("shadow_candidate_handler_only").filter((r) => r.isDecisionSupportDesired);
  assert.ok(results.length > 0);
  for (const r of results) {
    assert.equal(r.candidateHandlerEligible, true);
    assert.equal(r.candidateHandlerSafe, true);
    assert.equal(r.shouldExecuteAction, false);
    assert.notEqual(r.simulatedOutcome, "unsafe_generic_answer");
    assert.notEqual(r.simulatedOutcome, "unsafe_playbook_answer");
  }
});

test("shadow_candidate_handler_only: can be recommended for Sprint 24", () => {
  const summary = SUMMARY.strategySummaries.shadow_candidate_handler_only;
  assert.equal(summary.riskyOutcomeCount, 0);
  assert.equal(summary.recommendedForSprint24, true);
});

// ─── Strategy behavior: feature_flag_default_off ────────────────────────────────

test("feature_flag_default_off: decision_support cases map to feature_flag_blocked / feature_flag_blocked_safe, flag not activated", () => {
  for (const c of findCasesByCategory("decision_support_clear")) {
    const r = findResult("feature_flag_default_off", c.input);
    assert.equal(r.simulatedMappedIntent, "feature_flag_blocked");
    assert.equal(r.simulatedOutcome, "feature_flag_blocked_safe");
    assert.equal(r.requiresFeatureFlag, true);
    assert.equal(r.introducesProductionBehavior, false, "the flag is default-off, so no live production behavior changes");
    assert.equal(r.shouldExecuteAction, false);
  }
});

// ─── Strategy behavior: clarify_before_decision_support ─────────────────────────

test("clarify_before_decision_support: clarification-desired cases use the clarification strategy safely", () => {
  const results = resultsForStrategy("clarify_before_decision_support").filter((r) => r.isClarificationDesired);
  assert.ok(results.length > 0);
  for (const r of results) {
    assert.equal(r.clarificationEligible, true);
    assert.equal(r.simulatedMappedIntent, "clarification_response_candidate");
    assert.equal(r.shouldExecuteAction, false);
  }
});

test("clarify_before_decision_support: low-confidence decision_support cases can use the clarification strategy", () => {
  const lowConfidenceEligible = resultsForStrategy("clarify_before_decision_support").filter(
    (r) => r.isDecisionSupportDesired && r.clarificationEligible,
  );
  assert.ok(lowConfidenceEligible.length > 0, "expected at least one low-confidence/unroutable decision_support case eligible for clarification");
  for (const r of lowConfidenceEligible) {
    assert.equal(r.simulatedMappedIntent, "clarification_response_candidate");
  }
});

test("clarify_before_decision_support: never executes an action", () => {
  for (const r of resultsForStrategy("clarify_before_decision_support")) {
    assert.equal(r.shouldExecuteAction, false);
  }
});

// ─── Strategy behavior: hybrid_shadow_then_clarify ──────────────────────────────

test("hybrid_shadow_then_clarify: confident/safe decision_support candidates use shadow mode", () => {
  const shadowResults = runDecisionSupportShadowMappingEvaluation(DECISION_CLARIFICATION_CASES);
  const shadowRoutableInputs = new Set(shadowResults.filter((r) => r.isShadowRoutable).map((r) => r.input));
  assert.ok(shadowRoutableInputs.size > 0);
  for (const input of shadowRoutableInputs) {
    const r = findResult("hybrid_shadow_then_clarify", input);
    assert.equal(r.simulatedMappedIntent, "decision_support_candidate");
    assert.equal(r.simulatedOutcome, "safe_shadow_candidate");
  }
});

test("hybrid_shadow_then_clarify: low-confidence decision_support cases and all clarification-desired cases use clarification", () => {
  const results = resultsForStrategy("hybrid_shadow_then_clarify");
  const nonShadowDecisionSupport = results.filter((r) => r.isDecisionSupportDesired && r.simulatedOutcome !== "safe_shadow_candidate");
  const clarificationCases = results.filter((r) => r.isClarificationDesired);
  assert.ok(nonShadowDecisionSupport.length > 0);
  assert.ok(clarificationCases.length > 0);
  for (const r of [...nonShadowDecisionSupport, ...clarificationCases]) {
    assert.equal(r.simulatedMappedIntent, "clarification_response_candidate");
  }
});

test("hybrid_shadow_then_clarify: existing routes are preserved and criticalRiskCount is 0", () => {
  const summary = SUMMARY.strategySummaries.hybrid_shadow_then_clarify;
  assert.equal(summary.preservesExistingRouteRate, 100);
  assert.equal(summary.criticalRiskCount, 0);
});

test("hybrid_shadow_then_clarify is the safestFutureIntegrationStrategy given current metrics", () => {
  assert.equal(SUMMARY.safestFutureIntegrationStrategy, "hybrid_shadow_then_clarify");
});

// ─── Strategy behavior: do_not_map ───────────────────────────────────────────────

test("do_not_map: outcome is not_applicable for decision_support and clarification cases", () => {
  for (const r of resultsForStrategy("do_not_map")) {
    if (r.isExistingRouteCase) {
      assert.equal(r.simulatedOutcome, "existing_route_preserved");
    } else {
      assert.equal(r.simulatedOutcome, "not_applicable");
    }
    assert.equal(r.riskLevel, "low");
  }
});

test("do_not_map: recommendedForSprint24 is false given how much safe evidence already exists", () => {
  assert.equal(SUMMARY.strategySummaries.do_not_map.recommendedForSprint24, false);
  assert.ok(SUMMARY.strategySummaries.do_not_map.blockerReasons.length > 0);
});

// ─── Existing route preservation ────────────────────────────────────────────────

test("existing_route_should_win cases are never overwritten by any strategy", () => {
  const existingRouteCases = findCasesByCategory("existing_route_should_win");
  assert.equal(existingRouteCases.length, 10);
  for (const strategy of listDecisionSupportAdapterMappingStrategies()) {
    for (const c of existingRouteCases) {
      const r = findResult(strategy, c.input);
      assert.equal(r.simulatedMappedIntent, "current_existing_route");
      assert.equal(r.simulatedOutcome, "existing_route_preserved");
      assert.equal(r.preservesExistingRoute, true);
    }
  }
});

test("preservesExistingRouteRate is 100% for every strategy", () => {
  for (const strategy of listDecisionSupportAdapterMappingStrategies()) {
    assert.equal(SUMMARY.strategySummaries[strategy].preservesExistingRouteRate, 100, `expected 100% for ${strategy}`);
  }
});

test("preservesExistingRouteRate is 100% for recommendedSprint24Strategy", () => {
  assert.equal(SUMMARY.strategySummaries[SUMMARY.recommendedSprint24Strategy].preservesExistingRouteRate, 100);
});

// ─── Safety ──────────────────────────────────────────────────────────────────────

test("shouldExecuteAction is false in every single result across every strategy", () => {
  for (const r of ALL_RESULTS) {
    assert.equal(r.shouldExecuteAction, false);
  }
});

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlan.ts", import.meta.url),
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
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlan.ts", import.meta.url),
    "utf8",
  );
  const imports = importLines(source);
  assert.doesNotMatch(imports, /intentCompatibilityAdapter/);
  assert.doesNotMatch(imports, /intentClassifier\.rules/);
  assert.doesNotMatch(imports, /intent-patterns/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportAdapterMappingPlan/);
});

// ─── Explain ─────────────────────────────────────────────────────────────────────

test("explainDecisionSupportAdapterMappingPlan documents purpose, non-goals, strategies, and why each risky strategy is unsafe", () => {
  const explain = explainDecisionSupportAdapterMappingPlan();
  assert.ok(explain.purpose.length > 0);
  assert.ok(explain.nonGoals.length > 0);
  assert.ok(explain.strategiesOverview.length >= 8);
  assert.ok(explain.strategyRisks.length > 0);
  assert.ok(explain.whyMapToGeneralPmAdviceIsUnsafe.length > 0);
  assert.ok(explain.whyMapToRecommendationRequestIsUnsafe.length > 0);
  assert.ok(explain.whyKeepUnsupportedIsSafeButInsufficient.length > 0);
  assert.ok(explain.whyShadowCandidateHandlerOnlyIsSafer.length > 0);
  assert.ok(explain.whyClarifyBeforeDecisionSupportIsNeeded.length > 0);
  assert.ok(explain.whyHybridShadowThenClarifyIsLikelySafest.length > 0);
  assert.ok(explain.whyProductionIsNotChanged.length > 0);
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
  assert.equal(summary.policyAlignedRate, 82.9, `expected policyAlignedRate to stay 82.9, got ${summary.policyAlignedRate}`);
  assert.equal(
    summary.currentSystemAcceptableRate,
    84.3,
    `expected currentSystemAcceptableRate to stay 84.3, got ${summary.currentSystemAcceptableRate}`,
  );
});

test("Sprint 18R architecture review metrics are unchanged by this sprint", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.currentSafeMappingRate, 84.8, `expected currentSafeMappingRate to stay 84.8, got ${summary.currentSafeMappingRate}`);
  assert.equal(
    summary.futureRouteAlreadySupportedRate,
    84.8,
    `expected futureRouteAlreadySupportedRate to stay 84.8, got ${summary.futureRouteAlreadySupportedRate}`,
  );
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
  assert.equal(summary.playbookCollisionCount, 0);
  assert.equal(summary.generalPmCollisionCount, 1);
  assert.equal(summary.riskCollisionCount, 2);
  assert.equal(summary.closureCollisionCount, 1);
  assert.equal(summary.governanceCollisionCount, 0);
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
