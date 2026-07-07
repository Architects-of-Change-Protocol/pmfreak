import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  runDecisionSupportShadowMappingEvaluation,
  summarizeDecisionSupportShadowMappingEvaluation,
  explainDecisionSupportShadowMappingEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

import {
  runGoldenIntentEvaluation,
  summarizeGoldenIntentEvaluation,
} from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";
import {
  runGeneralPmAdviceBoundaryReview,
  summarizeGeneralPmAdviceBoundaryReview,
} from "../src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts";
import { GENERAL_PM_ADVICE_BOUNDARY_CASES } from "./fixtures/conversational-brain-general-pm-advice-boundary-cases.ts";
import {
  runDecisionClarificationArchitectureReview,
  summarizeDecisionClarificationArchitectureReview,
} from "../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts";

/**
 * Sprint 20R — Decision Support Shadow Mapping Evaluation.
 *
 * Tests the pure, offline evaluator in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts`.
 * This evaluator does not integrate the candidate handler into the router — the safety section below
 * asserts that in source, not just in behavior. The regression section re-runs the golden evaluation,
 * the Sprint 17R boundary review, and the Sprint 18R architecture review to confirm none of their
 * metrics changed.
 */

const results = runDecisionSupportShadowMappingEvaluation(DECISION_CLARIFICATION_CASES);
const summary = summarizeDecisionSupportShadowMappingEvaluation(results);

function findResult(input) {
  const found = results.find((r) => r.input === input);
  assert.ok(found, `expected a result for input "${input}"`);
  return found;
}

function findCasesByCategory(category) {
  return DECISION_CLARIFICATION_CASES.filter((c) => c.architectureCategory === category);
}

// ─── Structure ───────────────────────────────────────────────────────────────────

test("runDecisionSupportShadowMappingEvaluation exists and is a function", () => {
  assert.equal(typeof runDecisionSupportShadowMappingEvaluation, "function");
});

test("summarizeDecisionSupportShadowMappingEvaluation exists and is a function", () => {
  assert.equal(typeof summarizeDecisionSupportShadowMappingEvaluation, "function");
});

test("explainDecisionSupportShadowMappingEvaluation exists and is a function", () => {
  assert.equal(typeof explainDecisionSupportShadowMappingEvaluation, "function");
});

test("evaluator processes every case in the Sprint 18R corpus by default", () => {
  assert.equal(results.length, DECISION_CLARIFICATION_CASES.length);
});

test("summary.totalCases matches corpus length", () => {
  assert.equal(summary.totalCases, DECISION_CLARIFICATION_CASES.length);
});

const REQUIRED_SUMMARY_FIELDS = [
  "decisionSupportDesiredCount",
  "clarificationDesiredCount",
  "existingRouteCount",
  "candidateHandlerEligibleCount",
  "candidateHandlerCoverageRate",
  "candidateHandlerSafeRate",
  "shadowRoutableRate",
  "currentMappingSafeRate",
  "unsafeClassifierCollisionCount",
  "playbookCollisionCount",
  "generalPmCollisionCount",
  "byArchitectureCategory",
  "byCollisionType",
  "byDecisionType",
  "byIntegrationMode",
  "recommendedIntegrationMode",
  "recommendedNextSprint",
];

for (const field of REQUIRED_SUMMARY_FIELDS) {
  test(`summary includes ${field}`, () => {
    assert.notEqual(summary[field], undefined, `expected summary.${field} to be defined`);
  });
}

// ─── Eligibility ─────────────────────────────────────────────────────────────────

for (const category of ["decision_support_clear", "decision_support_vs_playbook", "decision_support_vs_general_pm"]) {
  test(`${category} cases are eligible for the candidate handler`, () => {
    const cases = findCasesByCategory(category);
    assert.ok(cases.length > 0, `expected at least one case in ${category}`);
    for (const c of cases) {
      const result = findResult(c.input);
      assert.equal(result.eligibility.isCandidateHandlerEligible, true, `case ${c.id} should be eligible`);
      assert.equal(result.eligibility.isDecisionSupportDesired, true);
    }
  });
}

for (const category of ["clarification_clear", "clarification_vs_general_pm"]) {
  test(`${category} cases are NOT eligible for the candidate handler`, () => {
    const cases = findCasesByCategory(category);
    assert.ok(cases.length > 0, `expected at least one case in ${category}`);
    for (const c of cases) {
      const result = findResult(c.input);
      assert.equal(result.eligibility.isCandidateHandlerEligible, false, `case ${c.id} should not be eligible`);
      assert.equal(result.eligibility.isClarificationDesired, true);
    }
  });
}

test("existing_route_should_win cases are NOT eligible for the candidate handler", () => {
  const cases = findCasesByCategory("existing_route_should_win");
  assert.equal(cases.length, 10);
  for (const c of cases) {
    const result = findResult(c.input);
    assert.equal(result.eligibility.isCandidateHandlerEligible, false, `case ${c.id} should not be eligible`);
    assert.equal(result.eligibility.isExistingRouteCase, true);
  }
});

test("all decision_support_* cases are eligible (candidateHandlerCoverageRate is 100)", () => {
  assert.equal(summary.candidateHandlerCoverageRate, 100);
  assert.equal(summary.candidateHandlerEligibleCount, summary.decisionSupportDesiredCount);
});

// ─── Candidate handler ───────────────────────────────────────────────────────────

test("eligible cases have a candidateResult of kind decision_support_candidate_result", () => {
  const eligibleResults = results.filter((r) => r.eligibility.isCandidateHandlerEligible);
  assert.ok(eligibleResults.length > 0);
  for (const r of eligibleResults) {
    assert.ok(r.candidateResult, `case ${r.id} should have a candidateResult`);
    assert.equal(r.candidateResult.kind, "decision_support_candidate_result");
  }
});

test("eligible cases' candidateResult has options, evidenceNeeded, and a recommendation", () => {
  const eligibleResults = results.filter((r) => r.eligibility.isCandidateHandlerEligible);
  for (const r of eligibleResults) {
    assert.ok(r.candidateResult.options.length >= 1, `case ${r.id} should have >= 1 option`);
    assert.ok(r.candidateResult.evidenceNeeded.length >= 1, `case ${r.id} should have >= 1 evidence need`);
    assert.ok(r.candidateResult.recommendation, `case ${r.id} should have a recommendation`);
    assert.ok(r.candidateHasOptions);
    assert.ok(r.candidateHasEvidence);
  }
});

test("eligible cases' candidateResult passes the safety checklist", () => {
  const eligibleResults = results.filter((r) => r.eligibility.isCandidateHandlerEligible);
  for (const r of eligibleResults) {
    assert.equal(r.candidateSafetyPass, true, `case ${r.id} should pass the safety checklist`);
    assert.equal(r.isCandidateHandlerSafe, true, `case ${r.id} should be safe`);
    assert.equal(r.candidateResult.safety.shouldExecuteAction, false);
    assert.equal(r.candidateResult.safety.shouldCreateTask, false);
    assert.equal(r.candidateResult.safety.shouldSendEmail, false);
    assert.equal(r.candidateResult.safety.shouldWriteToDb, false);
    assert.equal(r.candidateResult.safety.requiresHumanConfirmation, true);
    assert.equal(r.candidateResult.safety.productionRoutingEnabled, false);
  }
});

test("non-eligible cases (clarification, existing route) never run the candidate handler", () => {
  const nonEligibleResults = results.filter((r) => !r.eligibility.isCandidateHandlerEligible);
  assert.ok(nonEligibleResults.length > 0);
  for (const r of nonEligibleResults) {
    assert.equal(r.candidateResult, undefined, `case ${r.id} should not have a candidateResult`);
  }
});

test("runCandidateHandler: false skips the candidate handler for every case", () => {
  const noHandlerResults = runDecisionSupportShadowMappingEvaluation(DECISION_CLARIFICATION_CASES, { runCandidateHandler: false });
  for (const r of noHandlerResults) {
    assert.equal(r.candidateResult, undefined);
    assert.equal(r.isCandidateHandlerSafe, false);
    assert.equal(r.isShadowRoutable, false);
  }
});

test("no result ever indicates an executed action", () => {
  for (const r of results) {
    if (r.candidateResult) assert.equal(r.candidateResult.safety.shouldExecuteAction, false);
  }
});

// ─── Collision detection ─────────────────────────────────────────────────────────

test("cases mapped to recommendation_request count as collides_with_playbook_analysis", () => {
  // Sprint 21R calibration eliminated every live decision_support/playbook_analysis collision in this
  // corpus (playbookCollisionCount: 3 -> 0) — this test now documents that the rule still classifies
  // correctly if such a collision ever reappears, rather than asserting one must exist.
  const named = results.filter((r) => r.mappedIntent === "recommendation_request" && r.eligibility.isDecisionSupportDesired);
  for (const r of named) assert.equal(r.collisionType, "collides_with_playbook_analysis");
});

test("cases mapped to general_pm_advice count as collides_with_general_pm_advice", () => {
  const named = results.filter((r) => r.mappedIntent === "general_pm_advice" && r.eligibility.isDecisionSupportDesired);
  assert.ok(named.length > 0, "expected at least one live general_pm_advice collision in this corpus");
  for (const r of named) assert.equal(r.collisionType, "collides_with_general_pm_advice");
});

test("cases mapped to risk_analysis count as collides_with_risk_analysis", () => {
  const named = results.filter((r) => r.mappedIntent === "risk_analysis" && r.eligibility.isDecisionSupportDesired);
  assert.ok(named.length > 0, "expected at least one live risk collision in this corpus");
  for (const r of named) assert.equal(r.collisionType, "collides_with_risk_analysis");
});

test("cases mapped to closure_question or billing_question count as collides_with_closure_billing", () => {
  const named = results.filter(
    (r) => (r.mappedIntent === "closure_question" || r.mappedIntent === "billing_question") && r.eligibility.isDecisionSupportDesired,
  );
  assert.ok(named.length > 0, "expected at least one live closure/billing collision in this corpus");
  for (const r of named) assert.equal(r.collisionType, "collides_with_closure_billing");
});

test("cases mapped to governance_question or audit_question count as collides_with_governance_audit", () => {
  // Sprint 21R calibration eliminated every live decision_support/governance_audit collision in this
  // corpus (governanceCollisionCount: 3 -> 0) — this test now documents that the rule still classifies
  // correctly if such a collision ever reappears, rather than asserting one must exist.
  const named = results.filter(
    (r) => (r.mappedIntent === "governance_question" || r.mappedIntent === "audit_question") && r.eligibility.isDecisionSupportDesired,
  );
  for (const r of named) assert.equal(r.collisionType, "collides_with_governance_audit");
});

test("needs_clarification cases count as clarification_required", () => {
  const clarificationResults = results.filter((r) => r.eligibility.isClarificationDesired);
  assert.equal(clarificationResults.length, 24);
  for (const r of clarificationResults) assert.equal(r.collisionType, "clarification_required");
});

test("existing_route_should_win cases count as existing_route_should_win", () => {
  const existingRouteResults = results.filter((r) => r.eligibility.isExistingRouteCase);
  assert.equal(existingRouteResults.length, 10);
  for (const r of existingRouteResults) assert.equal(r.collisionType, "existing_route_should_win");
});

test("byCollisionType tallies sum to totalCases", () => {
  const total = Object.values(summary.byCollisionType).reduce((sum, n) => sum + n, 0);
  assert.equal(total, summary.totalCases);
});

// ─── Safety (source-level) ────────────────────────────────────────────────────────

test("shadow mapping evaluator module does not call a database or external service", () => {
  const content = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts", import.meta.url),
    "utf8",
  );
  const forbidden = [
    /from\s+["'][^"']*supabase[^"']*["']/i,
    /\bfetch\(/,
    /\bsendEmail\s*\(/i,
    /\bcreatePlatformEvent\s*\(/i,
    /from\s+["'][^"']*gmail[^"']*["']/i,
    /\bcreateTask\s*\(/i,
    /\bcreateRaidItem\s*\(/i,
  ];
  for (const re of forbidden) {
    assert.doesNotMatch(content, re, `decisionSupportShadowMappingEvaluation.ts must not match ${re}`);
  }
});

test("shadow mapping evaluator module does not import router/composer/handlers/gateway", () => {
  const content = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts", import.meta.url),
    "utf8",
  );
  const forbiddenImports = [
    /from\s+["'][^"']*brainRouter[^"']*["']/,
    /from\s+["'][^"']*responseComposer[^"']*["']/,
    /from\s+["'][^"']*\/handlers\/[^"']*["']/,
    /from\s+["'][^"']*conversationalBrainGateway[^"']*["']/,
    /require\(\s*["'][^"']*(brainRouter|responseComposer|\/handlers\/|conversationalBrainGateway)[^"']*["']\s*\)/,
  ];
  for (const re of forbiddenImports) {
    assert.doesNotMatch(content, re, `decisionSupportShadowMappingEvaluation.ts must not import from ${re}`);
  }
});

test("shadow mapping evaluator module does not modify production classifier pattern files or adapter mapping", () => {
  const content = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(content, /from\s+["'][^"']*intentClassifier\.rules["']/);
  assert.doesNotMatch(content, /from\s+["'][^"']*intent-patterns["']/);
});

test("shadow mapping evaluation never creates tasks, sends emails, or executes actions", () => {
  assert.equal(summary.handlerSafetyFailureCount, 0);
  const resultsAgain = runDecisionSupportShadowMappingEvaluation(DECISION_CLARIFICATION_CASES);
  const summaryAgain = summarizeDecisionSupportShadowMappingEvaluation(resultsAgain);
  assert.deepEqual(summaryAgain.totalCases, summary.totalCases);
  assert.deepEqual(summaryAgain.candidateHandlerSafeRate, summary.candidateHandlerSafeRate);
  assert.deepEqual(summaryAgain.recommendedIntegrationMode, summary.recommendedIntegrationMode);
});

// ─── Explain ─────────────────────────────────────────────────────────────────────

test("explain returns objective, non-goals, eligibility/collision/safety/integration-mode rules, and next-sprint logic", () => {
  const explain = explainDecisionSupportShadowMappingEvaluation();
  assert.equal(typeof explain.purpose, "string");
  assert.ok(explain.purpose.length > 0);
  assert.ok(Array.isArray(explain.nonGoals) && explain.nonGoals.length > 0);
  assert.ok(Array.isArray(explain.eligibilityRules) && explain.eligibilityRules.length > 0);
  assert.ok(Array.isArray(explain.collisionRules) && explain.collisionRules.length > 0);
  assert.ok(Array.isArray(explain.safetyRules) && explain.safetyRules.length > 0);
  assert.ok(Array.isArray(explain.integrationModeRules) && explain.integrationModeRules.length > 0);
  assert.ok(Array.isArray(explain.recommendedNextSprintLogic) && explain.recommendedNextSprintLogic.length > 0);
});

// ─── Regression awareness ────────────────────────────────────────────────────────

test("this sprint does not change the golden evaluation's global compatibilityRate", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.equal(report.overall.compatibilityRate, 72.5, `expected global compatibilityRate to stay 72.5, got ${report.overall.compatibilityRate}`);
});

test("this sprint does not change the golden evaluation's per-category results for previously-calibrated categories", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  const byCategory = Object.fromEntries(report.byCategory.map((c) => [c.category, c]));
  const expectedRates = {
    project_status: 100,
    closure_billing: 100,
    risk_issue_dependency: 100,
    task_action: 100,
    communication_draft: 100,
    governance_audit: 90,
    playbook_analysis: 88.9,
  };
  for (const [category, expectedRate] of Object.entries(expectedRates)) {
    assert.equal(
      byCategory[category].compatibilityRate,
      expectedRate,
      `expected ${category} compatibilityRate to stay ${expectedRate}, got ${byCategory[category].compatibilityRate}`,
    );
  }
});

test("Sprint 21R calibration only moves policyAlignedRate (via decision_support boundary detection), not the other Sprint 17R structural metrics", () => {
  const boundaryResults = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const boundarySummary = summarizeGeneralPmAdviceBoundaryReview(boundaryResults);
  assert.equal(boundarySummary.totalCases, 70);
  // Sprint 21R calibration: policyAlignedRate rose from 74.3 to 82.9 — every one of these newly-aligned
  // cases has policyTargetKind "architecture_candidate" (i.e. boundaryCategory "decision_support_candidate"),
  // so the enriched classifier now correctly detects decision_support where it previously missed it or
  // collided with another family. No other boundary category's alignment changed.
  assert.equal(boundarySummary.policyAlignedRate, 82.9, `expected policyAlignedRate to move to 82.9 (Sprint 21R decision_support boundary calibration), got ${boundarySummary.policyAlignedRate}`);
  assert.equal(
    boundarySummary.currentSystemAcceptableRate,
    84.3,
    `expected currentSystemAcceptableRate to stay 84.3, got ${boundarySummary.currentSystemAcceptableRate}`,
  );
  assert.equal(boundarySummary.architectureGapCount, 10);
  assert.equal(boundarySummary.clarificationGapCount, 10);
});

test("Sprint 21R calibration only moves currentSafeMappingRate/futureRouteAlreadySupportedRate (via decision_support boundary detection), not the other Sprint 18R structural metrics", () => {
  const architectureResults = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const architectureSummary = summarizeDecisionClarificationArchitectureReview(architectureResults);
  assert.equal(architectureSummary.totalCases, 79);
  // Sprint 21R calibration: currentSafeMappingRate rose from 64.6 to 84.8 because many decision_support_*
  // cases that used to collide with another live production intent (breaking the documented
  // decision_support -> unsupported safe fallback) now correctly land on enrichedFamily "decision_support",
  // which still maps to "unsupported" today — the same safe fallback, now reached more often. See
  // docs/conversational-brain-decision-support-classifier-boundary.md.
  assert.equal(
    architectureSummary.currentSafeMappingRate,
    84.8,
    `expected currentSafeMappingRate to move to 84.8 (Sprint 21R decision_support boundary calibration), got ${architectureSummary.currentSafeMappingRate}`,
  );
  assert.equal(
    architectureSummary.futureRouteAlreadySupportedRate,
    84.8,
    `expected futureRouteAlreadySupportedRate to move to 84.8 (Sprint 21R decision_support boundary calibration), got ${architectureSummary.futureRouteAlreadySupportedRate}`,
  );
  assert.equal(architectureSummary.requiresNewHandlerCount, 45);
  assert.equal(architectureSummary.requiresClarificationCount, 24);
  assert.equal(architectureSummary.existingRouteRegressions.length, 0);
});
