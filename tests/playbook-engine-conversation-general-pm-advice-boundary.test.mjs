import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  runGeneralPmAdviceBoundaryReview,
  summarizeGeneralPmAdviceBoundaryReview,
  explainGeneralPmAdviceBoundaryPolicy,
} from "../src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts";
import { GENERAL_PM_ADVICE_BOUNDARY_CASES } from "./fixtures/conversational-brain-general-pm-advice-boundary-cases.ts";
import {
  runGoldenIntentEvaluation,
  summarizeGoldenIntentEvaluation,
} from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

/**
 * Sprint 17R — General PM Advice Boundary & Design Review.
 *
 * This is a boundary/design-review sprint, not a vocabulary-calibration sprint: it does not touch
 * intentClassifier.rules.ts, intent-patterns.ts, or intentCompatibilityAdapter.ts, and it must not
 * change the Sprint 11R-16R golden corpus's compatibilityRate or per-category results (see the
 * "Regression awareness" section below).
 */

const VALID_BOUNDARY_CATEGORIES = new Set([
  "safe_general_pm_advice",
  "playbook_analysis_preferred",
  "decision_support_candidate",
  "ambiguous_clarification_candidate",
  "project_status_preferred",
  "communication_draft_preferred",
  "task_action_preferred",
  "closure_billing_preferred",
  "risk_issue_dependency_preferred",
  "governance_audit_preferred",
]);

const VALID_POLICY_TARGET_KINDS = new Set(["production_intent", "architecture_candidate", "clarification_candidate"]);
const VALID_RISK_LEVELS = new Set(["low", "medium", "high"]);

// ─── Corpus structure ───────────────────────────────────────────────────────────

test("boundary corpus has at least 60 cases", () => {
  assert.ok(
    GENERAL_PM_ADVICE_BOUNDARY_CASES.length >= 60,
    `expected >= 60 cases, got ${GENERAL_PM_ADVICE_BOUNDARY_CASES.length}`,
  );
});

test("every case has a unique id", () => {
  const ids = GENERAL_PM_ADVICE_BOUNDARY_CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids found in boundary corpus");
});

test("every case has a non-empty input", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    assert.equal(typeof c.input, "string", `case ${c.id} input must be a string`);
    assert.ok(c.input.trim().length > 0, `case ${c.id} input must not be empty`);
  }
});

test("every case has a valid boundaryCategory", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    assert.ok(VALID_BOUNDARY_CATEGORIES.has(c.boundaryCategory), `case ${c.id} has invalid boundaryCategory "${c.boundaryCategory}"`);
  }
});

test("every case has a policyTarget", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    assert.equal(typeof c.policyTarget, "string", `case ${c.id} must have a policyTarget`);
    assert.ok(c.policyTarget.length > 0, `case ${c.id} policyTarget must not be empty`);
  }
});

test("every case has a valid policyTargetKind", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    assert.ok(
      VALID_POLICY_TARGET_KINDS.has(c.policyTargetKind),
      `case ${c.id} has invalid policyTargetKind "${c.policyTargetKind}"`,
    );
  }
});

test("every case has a rationale", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    assert.equal(typeof c.rationale, "string", `case ${c.id} must have a rationale`);
    assert.ok(c.rationale.trim().length > 0, `case ${c.id} rationale must not be empty`);
  }
});

test("every case has a valid riskLevel", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    assert.ok(VALID_RISK_LEVELS.has(c.riskLevel), `case ${c.id} has invalid riskLevel "${c.riskLevel}"`);
  }
});

test("every case has a boolean shouldCurrentSystemHandle", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    assert.equal(typeof c.shouldCurrentSystemHandle, "boolean", `case ${c.id} shouldCurrentSystemHandle must be a boolean`);
  }
});

test("architecture_candidate cases always target decision_support", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    if (c.policyTargetKind === "architecture_candidate") {
      assert.equal(c.policyTarget, "decision_support", `case ${c.id} architecture_candidate must target "decision_support"`);
    }
  }
});

test("clarification_candidate cases always target needs_clarification", () => {
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    if (c.policyTargetKind === "clarification_candidate") {
      assert.equal(c.policyTarget, "needs_clarification", `case ${c.id} clarification_candidate must target "needs_clarification"`);
    }
  }
});

// ─── Coverage ───────────────────────────────────────────────────────────────────

test("corpus covers every boundary category with its documented minimum", () => {
  const counts = new Map();
  for (const c of GENERAL_PM_ADVICE_BOUNDARY_CASES) {
    counts.set(c.boundaryCategory, (counts.get(c.boundaryCategory) ?? 0) + 1);
  }
  const minimums = {
    safe_general_pm_advice: 12,
    playbook_analysis_preferred: 8,
    decision_support_candidate: 10,
    ambiguous_clarification_candidate: 10,
    project_status_preferred: 5,
    communication_draft_preferred: 5,
    task_action_preferred: 5,
    closure_billing_preferred: 5,
    risk_issue_dependency_preferred: 5,
    governance_audit_preferred: 5,
  };
  for (const [category, minimum] of Object.entries(minimums)) {
    const actual = counts.get(category) ?? 0;
    assert.ok(actual >= minimum, `expected >= ${minimum} "${category}" cases, got ${actual}`);
  }
});

// ─── Evaluator: runGeneralPmAdviceBoundaryReview ────────────────────────────────

test("runGeneralPmAdviceBoundaryReview processes every case in the corpus", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  assert.equal(results.length, GENERAL_PM_ADVICE_BOUNDARY_CASES.length);
  for (const result of results) {
    assert.equal(typeof result.productionIntent, "string");
    assert.equal(typeof result.enrichedFamily, "string");
    assert.equal(typeof result.enrichedType, "string");
    assert.equal(typeof result.mappedIntent, "string");
    assert.equal(typeof result.isPolicyAligned, "boolean");
    assert.equal(typeof result.isArchitectureGap, "boolean");
    assert.equal(typeof result.isClarificationGap, "boolean");
    assert.equal(typeof result.isCurrentSystemAcceptable, "boolean");
    assert.equal(typeof result.conflictType, "string");
    assert.ok(Array.isArray(result.notes));
  }
});

test("every decision_support_candidate result is flagged as an architecture gap", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const decisionResults = results.filter((r) => r.boundaryCategory === "decision_support_candidate");
  assert.ok(decisionResults.length > 0);
  for (const r of decisionResults) {
    assert.equal(r.isArchitectureGap, true, `case ${r.id} should be flagged isArchitectureGap`);
  }
});

test("every ambiguous_clarification_candidate result is flagged as a clarification gap", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const clarificationResults = results.filter((r) => r.boundaryCategory === "ambiguous_clarification_candidate");
  assert.ok(clarificationResults.length > 0);
  for (const r of clarificationResults) {
    assert.equal(r.isClarificationGap, true, `case ${r.id} should be flagged isClarificationGap`);
  }
});

test("runGeneralPmAdviceBoundaryReview does not throw on the full corpus", () => {
  assert.doesNotThrow(() => runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES));
});

// ─── Evaluator: summarizeGeneralPmAdviceBoundaryReview ──────────────────────────

test("summarizeGeneralPmAdviceBoundaryReview calculates totalCases correctly", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(summary.totalCases, GENERAL_PM_ADVICE_BOUNDARY_CASES.length);
});

test("summary includes policyAlignedRate as a 0-100 percentage matching policyAlignedCount", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.ok(summary.policyAlignedRate >= 0 && summary.policyAlignedRate <= 100);
  const expectedRate = Math.round((summary.policyAlignedCount / summary.totalCases) * 1000) / 10;
  assert.equal(summary.policyAlignedRate, expectedRate);
});

test("summary includes currentSystemAcceptableRate as a 0-100 percentage matching currentSystemAcceptableCount", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.ok(summary.currentSystemAcceptableRate >= 0 && summary.currentSystemAcceptableRate <= 100);
  const expectedRate = Math.round((summary.currentSystemAcceptableCount / summary.totalCases) * 1000) / 10;
  assert.equal(summary.currentSystemAcceptableRate, expectedRate);
});

test("summary groups results by boundaryCategory", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  const categories = Object.keys(summary.byBoundaryCategory);
  assert.equal(categories.length, VALID_BOUNDARY_CATEGORIES.size);
  const totalAcrossCategories = Object.values(summary.byBoundaryCategory).reduce((sum, c) => sum + c.totalCases, 0);
  assert.equal(totalAcrossCategories, summary.totalCases);
});

test("summary groups results by conflictType", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  const totalAcrossConflictTypes = Object.values(summary.byConflictType).reduce((sum, n) => sum + n, 0);
  assert.equal(totalAcrossConflictTypes, summary.totalCases);
  assert.ok(typeof summary.byConflictType.none === "number");
});

test("summary identifies decisionSupportCandidates", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.ok(Array.isArray(summary.decisionSupportCandidates));
  assert.ok(summary.decisionSupportCandidates.length >= 10);
  for (const c of summary.decisionSupportCandidates) {
    assert.equal(c.boundaryCategory, "decision_support_candidate");
  }
});

test("summary identifies clarificationCandidates", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.ok(Array.isArray(summary.clarificationCandidates));
  assert.ok(summary.clarificationCandidates.length >= 10);
  for (const c of summary.clarificationCandidates) {
    assert.equal(c.boundaryCategory, "ambiguous_clarification_candidate");
  }
});

test("summary identifies safeGeneralPmAdviceCases", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.ok(Array.isArray(summary.safeGeneralPmAdviceCases));
  assert.ok(summary.safeGeneralPmAdviceCases.length >= 12);
  for (const c of summary.safeGeneralPmAdviceCases) {
    assert.equal(c.boundaryCategory, "safe_general_pm_advice");
  }
});

test("summary identifies architectureGapCount and clarificationGapCount", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(typeof summary.architectureGapCount, "number");
  assert.equal(typeof summary.clarificationGapCount, "number");
  assert.equal(summary.architectureGapCount, summary.decisionSupportCandidates.length);
  assert.equal(summary.clarificationGapCount, summary.clarificationCandidates.length);
});

test("misroutedGeneralPmAdviceCases is the union of overused and missed cases", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(
    summary.misroutedGeneralPmAdviceCases.length,
    summary.casesWhereGeneralPmAdviceIsOverused.length + summary.casesWhereGeneralPmAdviceIsMissed.length,
  );
  for (const c of summary.casesWhereGeneralPmAdviceIsMissed) {
    assert.equal(c.boundaryCategory, "safe_general_pm_advice");
    assert.equal(c.isPolicyAligned, false);
  }
});

test("summary returns a recommendedNextSprint from the documented set", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  const validRecommendations = new Set([
    "Sprint 18R — Decision Support Architecture",
    "Sprint 18R — Ambiguous / Clarification Strategy",
    "Sprint 18R — General PM Advice Calibration",
    "Controlled Shadow Capture Prep",
    "Decision Support + Clarification Architecture Review",
  ]);
  assert.ok(validRecommendations.has(summary.recommendedNextSprint), `unexpected recommendedNextSprint: ${summary.recommendedNextSprint}`);
  assert.equal(typeof summary.recommendation, "string");
  assert.ok(summary.recommendation.length > 0);
});

test("summary does not fail or block on a low policyAlignedRate", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  assert.doesNotThrow(() => summarizeGeneralPmAdviceBoundaryReview(results));
});

// ─── explainGeneralPmAdviceBoundaryPolicy ───────────────────────────────────────

test("explainGeneralPmAdviceBoundaryPolicy documents definition and precedence rules", () => {
  const explain = explainGeneralPmAdviceBoundaryPolicy();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.whatIsGeneralPmAdvice, "string");
  assert.ok(explain.whatIsGeneralPmAdvice.length > 0);
  assert.ok(Array.isArray(explain.whatIsNotGeneralPmAdvice) && explain.whatIsNotGeneralPmAdvice.length > 0);
  assert.ok(Array.isArray(explain.precedenceRules) && explain.precedenceRules.length > 0);
  for (const rule of explain.precedenceRules) {
    assert.ok(VALID_BOUNDARY_CATEGORIES.has(rule.category));
    assert.equal(typeof rule.beatsGeneralPmAdviceWhen, "string");
  }
  assert.ok(Array.isArray(explain.categoriesThatBeatGeneralPmAdvice) && explain.categoriesThatBeatGeneralPmAdvice.length > 0);
  assert.ok(Array.isArray(explain.unresolvedArchitectureGaps) && explain.unresolvedArchitectureGaps.length > 0);
  assert.ok(Array.isArray(explain.unresolvedClarificationGaps) && explain.unresolvedClarificationGaps.length > 0);
  assert.ok(Array.isArray(explain.doesNot) && explain.doesNot.length > 0);
});

// ─── Policy assertions (specific phrases per the sprint spec) ───────────────────

function findCase(input) {
  const found = GENERAL_PM_ADVICE_BOUNDARY_CASES.find((c) => c.input === input);
  assert.ok(found, `expected boundary corpus to contain a case with input "${input}"`);
  return found;
}

test("'cómo manejarías un cliente difícil' has policyTarget general_pm_advice", () => {
  assert.equal(findCase("cómo manejarías un cliente difícil").policyTarget, "general_pm_advice");
});

test("'qué recomienda el playbook' has policyTarget recommendation_request", () => {
  assert.equal(findCase("qué recomienda el playbook").policyTarget, "recommendation_request");
});

test("'qué opción debería escoger' has policyTarget decision_support", () => {
  assert.equal(findCase("qué opción debería escoger").policyTarget, "decision_support");
});

test("'ayuda' has policyTarget needs_clarification", () => {
  assert.equal(findCase("ayuda").policyTarget, "needs_clarification");
});

test("'cómo va el proyecto' has policyTarget project_status_question", () => {
  assert.equal(findCase("cómo va el proyecto").policyTarget, "project_status_question");
});

test("'redactame un correo' has policyTarget communication_draft", () => {
  assert.equal(findCase("redactame un correo").policyTarget, "communication_draft");
});

test("'creá una tarea para Arturo' has policyTarget task_or_action_request", () => {
  assert.equal(findCase("creá una tarea para Arturo").policyTarget, "task_or_action_request");
});

test("'qué falta para facturar' has policyTarget billing_question or closure_question", () => {
  const policyTarget = findCase("qué falta para facturar").policyTarget;
  assert.ok(
    policyTarget === "billing_question" || policyTarget === "closure_question",
    `expected billing_question or closure_question, got "${policyTarget}"`,
  );
});

test("'qué riesgos hay' has policyTarget risk_analysis", () => {
  assert.equal(findCase("qué riesgos hay").policyTarget, "risk_analysis");
});

test("'mostrame el audit trail' has policyTarget audit_question", () => {
  assert.equal(findCase("mostrame el audit trail").policyTarget, "audit_question");
});

// ─── Safety ──────────────────────────────────────────────────────────────────────

test("boundary review module does not call a database or external service", () => {
  const content = readFileSync(
    new URL(
      "../src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts",
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
    assert.doesNotMatch(content, re, `generalPmAdviceBoundaryReview.ts must not match ${re}`);
  }
});

test("boundary review module does not import router/composer/handlers/gateway", () => {
  const content = readFileSync(
    new URL(
      "../src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts",
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
    assert.doesNotMatch(content, re, `generalPmAdviceBoundaryReview.ts must not import from ${re}`);
  }
});

test("boundary review module does not modify the production classifier pattern files", () => {
  const content = readFileSync(
    new URL(
      "../src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(content, /from\s+["'][^"']*intentClassifier\.rules["']/);
  assert.doesNotMatch(content, /from\s+["'][^"']*intent-patterns["']/);
});

test("boundary review never creates tasks, sends emails, or executes actions", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(typeof summary, "object");
  const resultsAgain = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summaryAgain = summarizeGeneralPmAdviceBoundaryReview(resultsAgain);
  assert.deepEqual(summaryAgain.totalCases, summary.totalCases);
  assert.deepEqual(summaryAgain.policyAlignedRate, summary.policyAlignedRate);
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
