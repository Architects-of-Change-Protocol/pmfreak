import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  runDecisionClarificationArchitectureReview,
  summarizeDecisionClarificationArchitectureReview,
  explainDecisionClarificationArchitecture,
} from "../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts";
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

/**
 * Sprint 18R — Decision Support + Clarification Architecture Review.
 *
 * This is an architecture/design-review sprint, not a vocabulary-calibration sprint and not a
 * production-integration sprint: it does not touch intentClassifier.rules.ts, intent-patterns.ts,
 * intentCompatibilityAdapter.ts, the router, the composer, any handler, or the endpoint, and it must
 * not change the golden corpus's compatibilityRate/per-category results or the Sprint 17R boundary
 * review's metrics (see "Regression awareness" below).
 */

const VALID_ARCHITECTURE_CATEGORIES = new Set([
  "decision_support_clear",
  "decision_support_vs_playbook",
  "decision_support_vs_general_pm",
  "decision_support_vs_risk",
  "decision_support_vs_closure",
  "decision_support_vs_governance",
  "clarification_clear",
  "clarification_vs_general_pm",
  "clarification_vs_status",
  "clarification_vs_risk",
  "clarification_vs_task",
  "clarification_vs_communication",
  "existing_route_should_win",
]);

const VALID_DESIRED_FUTURE_ROUTES = new Set([
  "decision_support",
  "needs_clarification",
  "general_pm_advice",
  "project_status_question",
  "recommendation_request",
  "risk_analysis",
  "communication_draft",
  "closure_question",
  "billing_question",
  "governance_question",
  "audit_question",
  "task_or_action_request",
  "unsupported",
]);

const VALID_CURRENT_SAFE_MAPPED_INTENTS = new Set([
  "general_pm_advice",
  "project_status_question",
  "recommendation_request",
  "risk_analysis",
  "communication_draft",
  "closure_question",
  "billing_question",
  "governance_question",
  "audit_question",
  "task_or_action_request",
  "unsupported",
  "clarification",
  "unknown",
]);

const VALID_TARGET_KINDS = new Set(["future_architecture", "clarification_strategy", "existing_production_route"]);
const VALID_RISK_LEVELS = new Set(["low", "medium", "high"]);

const DECISION_SUPPORT_CATEGORIES = new Set([
  "decision_support_clear",
  "decision_support_vs_playbook",
  "decision_support_vs_general_pm",
  "decision_support_vs_risk",
  "decision_support_vs_closure",
  "decision_support_vs_governance",
]);

const CLARIFICATION_CATEGORIES = new Set([
  "clarification_clear",
  "clarification_vs_general_pm",
  "clarification_vs_status",
  "clarification_vs_risk",
  "clarification_vs_task",
  "clarification_vs_communication",
]);

// ─── Corpus structure ───────────────────────────────────────────────────────────

test("corpus has at least 70 cases", () => {
  assert.ok(DECISION_CLARIFICATION_CASES.length >= 70, `expected >= 70 cases, got ${DECISION_CLARIFICATION_CASES.length}`);
});

test("corpus has at most 100 cases", () => {
  assert.ok(DECISION_CLARIFICATION_CASES.length <= 100, `expected <= 100 cases, got ${DECISION_CLARIFICATION_CASES.length}`);
});

test("every case has a unique id", () => {
  const ids = DECISION_CLARIFICATION_CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids found in corpus");
});

test("every case has a non-empty input", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.equal(typeof c.input, "string", `case ${c.id} input must be a string`);
    assert.ok(c.input.trim().length > 0, `case ${c.id} input must not be empty`);
  }
});

test("every case has a valid architectureCategory", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.ok(VALID_ARCHITECTURE_CATEGORIES.has(c.architectureCategory), `case ${c.id} has invalid architectureCategory "${c.architectureCategory}"`);
  }
});

test("every case has a valid desiredFutureRoute", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.ok(VALID_DESIRED_FUTURE_ROUTES.has(c.desiredFutureRoute), `case ${c.id} has invalid desiredFutureRoute "${c.desiredFutureRoute}"`);
  }
});

test("every case has a valid currentSafeMappedIntent", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.ok(
      VALID_CURRENT_SAFE_MAPPED_INTENTS.has(c.currentSafeMappedIntent),
      `case ${c.id} has invalid currentSafeMappedIntent "${c.currentSafeMappedIntent}"`,
    );
  }
});

test("every case has a valid targetKind", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.ok(VALID_TARGET_KINDS.has(c.targetKind), `case ${c.id} has invalid targetKind "${c.targetKind}"`);
  }
});

test("every case has a rationale", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.equal(typeof c.rationale, "string", `case ${c.id} must have a rationale`);
    assert.ok(c.rationale.trim().length > 0, `case ${c.id} rationale must not be empty`);
  }
});

test("every case has a valid riskLevel", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.ok(VALID_RISK_LEVELS.has(c.riskLevel), `case ${c.id} has invalid riskLevel "${c.riskLevel}"`);
  }
});

test("every case has boolean requiresNewHandler and requiresClarification", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.equal(typeof c.requiresNewHandler, "boolean", `case ${c.id} requiresNewHandler must be a boolean`);
    assert.equal(typeof c.requiresClarification, "boolean", `case ${c.id} requiresClarification must be a boolean`);
  }
});

test("every case has shouldExecuteAction === false", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.equal(c.shouldExecuteAction, false, `case ${c.id} shouldExecuteAction must be false`);
  }
});

// ─── Coverage ───────────────────────────────────────────────────────────────────

test("corpus covers every architecture category with its documented minimum", () => {
  const counts = new Map();
  for (const c of DECISION_CLARIFICATION_CASES) {
    counts.set(c.architectureCategory, (counts.get(c.architectureCategory) ?? 0) + 1);
  }
  const minimums = {
    decision_support_clear: 12,
    decision_support_vs_playbook: 8,
    decision_support_vs_general_pm: 8,
    decision_support_vs_risk: 6,
    decision_support_vs_closure: 6,
    decision_support_vs_governance: 5,
    clarification_clear: 10,
    clarification_vs_general_pm: 6,
    existing_route_should_win: 10,
  };
  for (const [category, minimum] of Object.entries(minimums)) {
    const actual = counts.get(category) ?? 0;
    assert.ok(actual >= minimum, `expected >= ${minimum} "${category}" cases, got ${actual}`);
  }
  const combinedVsOthers =
    (counts.get("clarification_vs_status") ?? 0) +
    (counts.get("clarification_vs_risk") ?? 0) +
    (counts.get("clarification_vs_task") ?? 0) +
    (counts.get("clarification_vs_communication") ?? 0);
  assert.ok(combinedVsOthers >= 8, `expected >= 8 combined clarification_vs_status/risk/task/communication cases, got ${combinedVsOthers}`);
});

// ─── Evaluator: runDecisionClarificationArchitectureReview ──────────────────────

test("runDecisionClarificationArchitectureReview processes every case in the corpus", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  assert.equal(results.length, DECISION_CLARIFICATION_CASES.length);
  for (const result of results) {
    assert.equal(typeof result.productionIntent, "string");
    assert.equal(typeof result.enrichedFamily, "string");
    assert.equal(typeof result.enrichedType, "string");
    assert.equal(typeof result.mappedIntent, "string");
    assert.equal(typeof result.isCurrentSafeMapping, "boolean");
    assert.equal(typeof result.isFutureRouteAlreadySupported, "boolean");
    assert.equal(typeof result.requiresNewHandler, "boolean");
    assert.equal(typeof result.requiresClarification, "boolean");
    assert.equal(result.shouldExecuteAction, false);
    assert.equal(typeof result.conflictType, "string");
    assert.ok(Array.isArray(result.warnings));
  }
});

test("runDecisionClarificationArchitectureReview does not throw on the full corpus", () => {
  assert.doesNotThrow(() => runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES));
});

// ─── Evaluator: summarizeDecisionClarificationArchitectureReview ───────────────

test("summarizeDecisionClarificationArchitectureReview calculates totalCases correctly", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(summary.totalCases, DECISION_CLARIFICATION_CASES.length);
});

test("summary includes currentSafeMappingRate matching currentSafeMappingCount", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.ok(summary.currentSafeMappingRate >= 0 && summary.currentSafeMappingRate <= 100);
  const expectedRate = Math.round((summary.currentSafeMappingCount / summary.totalCases) * 1000) / 10;
  assert.equal(summary.currentSafeMappingRate, expectedRate);
});

test("summary includes futureRouteAlreadySupportedRate matching futureRouteAlreadySupportedCount", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.ok(summary.futureRouteAlreadySupportedRate >= 0 && summary.futureRouteAlreadySupportedRate <= 100);
  const expectedRate = Math.round((summary.futureRouteAlreadySupportedCount / summary.totalCases) * 1000) / 10;
  assert.equal(summary.futureRouteAlreadySupportedRate, expectedRate);
});

test("summary includes requiresNewHandlerCount, requiresClarificationCount, and shouldExecuteActionCount", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(typeof summary.requiresNewHandlerCount, "number");
  assert.equal(typeof summary.requiresClarificationCount, "number");
  assert.equal(typeof summary.shouldExecuteActionCount, "number");
  assert.equal(summary.shouldExecuteActionCount, 0);
});

test("summary groups results by architectureCategory", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  const categories = Object.keys(summary.byArchitectureCategory);
  assert.equal(categories.length, VALID_ARCHITECTURE_CATEGORIES.size);
  const totalAcrossCategories = Object.values(summary.byArchitectureCategory).reduce((sum, c) => sum + c.totalCases, 0);
  assert.equal(totalAcrossCategories, summary.totalCases);
});

test("summary groups results by conflictType", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  const totalAcrossConflictTypes = Object.values(summary.byConflictType).reduce((sum, n) => sum + n, 0);
  assert.equal(totalAcrossConflictTypes, summary.totalCases);
});

test("summary identifies decisionSupportCases, clarificationCases, and existingRouteShouldWinCases", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.ok(Array.isArray(summary.decisionSupportCases));
  assert.ok(Array.isArray(summary.clarificationCases));
  assert.ok(Array.isArray(summary.existingRouteShouldWinCases));
  for (const c of summary.decisionSupportCases) assert.ok(DECISION_SUPPORT_CATEGORIES.has(c.architectureCategory));
  for (const c of summary.clarificationCases) assert.ok(CLARIFICATION_CATEGORIES.has(c.architectureCategory));
  for (const c of summary.existingRouteShouldWinCases) assert.equal(c.architectureCategory, "existing_route_should_win");
  assert.equal(
    summary.decisionSupportCases.length + summary.clarificationCases.length + summary.existingRouteShouldWinCases.length,
    summary.totalCases,
  );
});

test("summary identifies unsafeMappings and existingRouteRegressions", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.ok(Array.isArray(summary.unsafeMappings));
  for (const c of summary.unsafeMappings) assert.equal(c.isCurrentSafeMapping, false);
  assert.ok(Array.isArray(summary.existingRouteRegressions));
  for (const c of summary.existingRouteRegressions) assert.equal(c.conflictType, "existing_route_regression");
});

test("summary returns topDecisionSupportGaps and topClarificationGaps capped at 10", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.ok(Array.isArray(summary.topDecisionSupportGaps));
  assert.ok(Array.isArray(summary.topClarificationGaps));
  assert.ok(summary.topDecisionSupportGaps.length <= 10);
  assert.ok(summary.topClarificationGaps.length <= 10);
});

test("summary returns a recommendedImplementationOrder consistent with the documented rule", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.ok(Array.isArray(summary.recommendedImplementationOrder));
  assert.equal(summary.recommendedImplementationOrder.length, 4);
  if (summary.requiresNewHandlerCount >= summary.requiresClarificationCount) {
    assert.equal(summary.recommendedImplementationOrder[0], "Decision Support Candidate Handler");
  } else {
    assert.equal(summary.recommendedImplementationOrder[0], "Clarification Response Strategy");
  }
});

test("summary returns a recommendedNextSprint from the documented set", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  const validRecommendations = new Set([
    "Sprint 19R — Decision Support Candidate Handler",
    "Sprint 19R — Clarification Response Strategy",
    "Sprint 19R — Decision Support Candidate Handler, then Sprint 20R — Clarification Response Strategy",
  ]);
  assert.ok(validRecommendations.has(summary.recommendedNextSprint), `unexpected recommendedNextSprint: ${summary.recommendedNextSprint}`);
  assert.equal(typeof summary.recommendation, "string");
  assert.ok(summary.recommendation.length > 0);
});

test("summary does not fail or block on any metric value", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  assert.doesNotThrow(() => summarizeDecisionClarificationArchitectureReview(results));
});

// ─── explainDecisionClarificationArchitecture ───────────────────────────────────

test("explainDecisionClarificationArchitecture documents decision_support and needs_clarification", () => {
  const explain = explainDecisionClarificationArchitecture();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.whatIsDecisionSupport, "string");
  assert.ok(explain.whatIsDecisionSupport.length > 0);
  assert.equal(typeof explain.whatIsNeedsClarification, "string");
  assert.ok(explain.whatIsNeedsClarification.length > 0);
  assert.ok(Array.isArray(explain.whatIsNotDecisionSupport) && explain.whatIsNotDecisionSupport.length > 0);
  assert.ok(Array.isArray(explain.whatIsNotNeedsClarification) && explain.whatIsNotNeedsClarification.length > 0);
  assert.ok(Array.isArray(explain.precedenceRules) && explain.precedenceRules.length > 0);
  assert.ok(Array.isArray(explain.safeTemporaryMapping) && explain.safeTemporaryMapping.length > 0);
  assert.ok(Array.isArray(explain.futureHandlerRequirements) && explain.futureHandlerRequirements.length > 0);
  assert.ok(Array.isArray(explain.futureClarificationStrategyRequirements) && explain.futureClarificationStrategyRequirements.length > 0);
  assert.ok(Array.isArray(explain.nonGoals) && explain.nonGoals.length > 0);
  assert.ok(Array.isArray(explain.doesNot) && explain.doesNot.length > 0);
});

// ─── Policy assertions (specific phrases per the sprint spec) ───────────────────

function findCase(input) {
  const found = DECISION_CLARIFICATION_CASES.find((c) => c.input === input);
  assert.ok(found, `expected corpus to contain a case with input "${input}"`);
  return found;
}

test("'qué opción debería escoger' has desiredFutureRoute decision_support", () => {
  assert.equal(findCase("qué opción debería escoger").desiredFutureRoute, "decision_support");
});

test("'deberíamos hacer A o B' has desiredFutureRoute decision_support", () => {
  assert.equal(findCase("deberíamos hacer A o B").desiredFutureRoute, "decision_support");
});

test("'conviene escalar o esperar' has desiredFutureRoute decision_support", () => {
  assert.equal(findCase("conviene escalar o esperar").desiredFutureRoute, "decision_support");
});

test("'ayuda' has desiredFutureRoute needs_clarification", () => {
  assert.equal(findCase("ayuda").desiredFutureRoute, "needs_clarification");
});

test("'revisá esto' has desiredFutureRoute needs_clarification", () => {
  assert.equal(findCase("revisá esto").desiredFutureRoute, "needs_clarification");
});

test("'qué hacemos' has desiredFutureRoute needs_clarification", () => {
  assert.equal(findCase("qué hacemos").desiredFutureRoute, "needs_clarification");
});

test("'redactame un correo' has desiredFutureRoute communication_draft", () => {
  assert.equal(findCase("redactame un correo").desiredFutureRoute, "communication_draft");
});

test("'creá una tarea para Arturo' has desiredFutureRoute task_or_action_request", () => {
  assert.equal(findCase("creá una tarea para Arturo").desiredFutureRoute, "task_or_action_request");
});

test("'qué falta para facturar' has desiredFutureRoute billing_question or closure_question", () => {
  const desiredFutureRoute = findCase("qué falta para facturar").desiredFutureRoute;
  assert.ok(
    desiredFutureRoute === "billing_question" || desiredFutureRoute === "closure_question",
    `expected billing_question or closure_question, got "${desiredFutureRoute}"`,
  );
});

test("'qué riesgos hay' has desiredFutureRoute risk_analysis", () => {
  assert.equal(findCase("qué riesgos hay").desiredFutureRoute, "risk_analysis");
});

test("'cómo va el proyecto' has desiredFutureRoute project_status_question", () => {
  assert.equal(findCase("cómo va el proyecto").desiredFutureRoute, "project_status_question");
});

test("'mostrame el audit trail' has desiredFutureRoute audit_question", () => {
  assert.equal(findCase("mostrame el audit trail").desiredFutureRoute, "audit_question");
});

// ─── Architecture assertions ─────────────────────────────────────────────────────

test("all decision_support cases have requiresNewHandler true", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    if (DECISION_SUPPORT_CATEGORIES.has(c.architectureCategory)) {
      assert.equal(c.requiresNewHandler, true, `case ${c.id} (${c.architectureCategory}) must have requiresNewHandler true`);
    }
  }
});

test("all clarification_clear cases have requiresClarification true", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    if (c.architectureCategory === "clarification_clear") {
      assert.equal(c.requiresClarification, true, `case ${c.id} must have requiresClarification true`);
    }
  }
});

test("all cases have shouldExecuteAction false", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    assert.equal(c.shouldExecuteAction, false, `case ${c.id} must have shouldExecuteAction false`);
  }
});

test("existing_route_should_win cases do not require a new handler or clarification", () => {
  for (const c of DECISION_CLARIFICATION_CASES) {
    if (c.architectureCategory === "existing_route_should_win") {
      assert.equal(c.requiresNewHandler, false, `case ${c.id} (existing_route_should_win) must not require a new handler`);
      assert.equal(c.requiresClarification, false, `case ${c.id} (existing_route_should_win) must not require clarification`);
    }
  }
});

// ─── Safety ──────────────────────────────────────────────────────────────────────

test("architecture review module does not call a database or external service", () => {
  const content = readFileSync(
    new URL(
      "../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts",
      import.meta.url,
    ),
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
    assert.doesNotMatch(content, re, `decisionClarificationArchitectureReview.ts must not match ${re}`);
  }
});

test("architecture review module does not import router/composer/handlers/gateway", () => {
  const content = readFileSync(
    new URL(
      "../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts",
      import.meta.url,
    ),
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
    assert.doesNotMatch(content, re, `decisionClarificationArchitectureReview.ts must not import from ${re}`);
  }
});

test("architecture review module does not modify the production classifier pattern files", () => {
  const content = readFileSync(
    new URL(
      "../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(content, /from\s+["'][^"']*intentClassifier\.rules["']/);
  assert.doesNotMatch(content, /from\s+["'][^"']*intent-patterns["']/);
});

test("architecture review never creates tasks, sends emails, or executes actions", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(summary.shouldExecuteActionCount, 0);
  const resultsAgain = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summaryAgain = summarizeDecisionClarificationArchitectureReview(resultsAgain);
  assert.deepEqual(summaryAgain.totalCases, summary.totalCases);
  assert.deepEqual(summaryAgain.currentSafeMappingRate, summary.currentSafeMappingRate);
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
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(summary.totalCases, 70);
  // Sprint 21R calibration: policyAlignedRate rose from 74.3 to 82.9 — see
  // docs/conversational-brain-decision-support-classifier-boundary.md.
  assert.equal(summary.policyAlignedRate, 82.9, `expected policyAlignedRate to move to 82.9 (Sprint 21R decision_support boundary calibration), got ${summary.policyAlignedRate}`);
  assert.equal(
    summary.currentSystemAcceptableRate,
    84.3,
    `expected currentSystemAcceptableRate to stay 84.3, got ${summary.currentSystemAcceptableRate}`,
  );
  assert.equal(summary.architectureGapCount, 10);
  assert.equal(summary.clarificationGapCount, 10);
});
