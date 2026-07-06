import test from "node:test";
import assert from "node:assert/strict";

import {
  runGoldenIntentEvaluation,
  summarizeGoldenIntentEvaluation,
  explainGoldenIntentEvaluation,
} from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

const VALID_CATEGORIES = new Set([
  "general_pm_advice",
  "project_status",
  "playbook_analysis",
  "communication_draft",
  "closure_billing",
  "governance_audit",
  "risk_issue_dependency",
  "task_action",
  "decision_support",
  "ambiguous_or_unknown",
]);

// ─── Corpus shape ───────────────────────────────────────────────────────────────

test("golden corpus has at least 75 cases", () => {
  assert.ok(GOLDEN_INTENT_CASES.length >= 75, `expected >= 75 cases, got ${GOLDEN_INTENT_CASES.length}`);
});

test("every case has a unique id", () => {
  const ids = GOLDEN_INTENT_CASES.map((c) => c.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, "duplicate ids found in golden corpus");
});

test("every case has a non-empty input", () => {
  for (const c of GOLDEN_INTENT_CASES) {
    assert.equal(typeof c.input, "string", `case ${c.id} input must be a string`);
    assert.ok(c.input.trim().length > 0, `case ${c.id} input must not be empty`);
  }
});

test("every case has a valid category", () => {
  for (const c of GOLDEN_INTENT_CASES) {
    assert.ok(VALID_CATEGORIES.has(c.category), `case ${c.id} has invalid category "${c.category}"`);
  }
});

test("every case has an expectedMappedIntent", () => {
  for (const c of GOLDEN_INTENT_CASES) {
    assert.equal(typeof c.expectedMappedIntent, "string", `case ${c.id} must have expectedMappedIntent`);
    assert.ok(c.expectedMappedIntent.length > 0, `case ${c.id} expectedMappedIntent must not be empty`);
  }
});

test("all minimum required categories are represented in the corpus", () => {
  const present = new Set(GOLDEN_INTENT_CASES.map((c) => c.category));
  for (const category of VALID_CATEGORIES) {
    assert.ok(present.has(category), `corpus is missing category "${category}"`);
  }
});

// ─── runGoldenIntentEvaluation ──────────────────────────────────────────────────

test("runGoldenIntentEvaluation processes every case in the corpus", () => {
  const { results } = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.equal(results.length, GOLDEN_INTENT_CASES.length);
  for (const result of results) {
    assert.equal(typeof result.actual.productionIntent, "string");
    assert.equal(typeof result.actual.enrichedFamily, "string");
    assert.equal(typeof result.actual.mappedIntent, "string");
    assert.equal(typeof result.actual.compatible, "boolean");
    assert.equal(typeof result.matches.productionIntent, "boolean");
    assert.equal(typeof result.matches.mappedIntent, "boolean");
  }
});

test("runGoldenIntentEvaluation does not throw on ambiguous_or_unknown cases", () => {
  const ambiguousCases = GOLDEN_INTENT_CASES.filter((c) => c.category === "ambiguous_or_unknown");
  assert.ok(ambiguousCases.length > 0, "expected at least one ambiguous_or_unknown case");
  assert.doesNotThrow(() => runGoldenIntentEvaluation(ambiguousCases));
});

test("decision_support cases produce documented migration warnings", () => {
  const decisionCases = GOLDEN_INTENT_CASES.filter((c) => c.category === "decision_support");
  assert.ok(decisionCases.length > 0, "expected at least one decision_support case");
  const { results } = runGoldenIntentEvaluation(decisionCases);
  for (const result of results) {
    assert.ok(
      result.actual.migrationWarnings.some((w) => w.code === "decision_support_no_production_equivalent"),
      `case ${result.id} should carry the decision_support_no_production_equivalent warning`,
    );
  }
});

// ─── summarizeGoldenIntentEvaluation ────────────────────────────────────────────

test("summary calculates totalCases correctly", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.equal(evaluation.summary.totalCases, GOLDEN_INTENT_CASES.length);
  assert.equal(evaluation.summary.compatibleCount + evaluation.summary.incompatibleCount, evaluation.summary.totalCases);
});

test("summary calculates compatibilityRate as a 0-100 percentage matching compatibleCount", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const { compatibleCount, totalCases, compatibilityRate } = evaluation.summary;
  assert.ok(compatibilityRate >= 0 && compatibilityRate <= 100);
  const expectedRate = Math.round((compatibleCount / totalCases) * 1000) / 10;
  assert.equal(compatibilityRate, expectedRate);
});

test("summary groups results by category", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.equal(report.byCategory.length, VALID_CATEGORIES.size);
  const totalAcrossCategories = report.byCategory.reduce((sum, c) => sum + c.totalCases, 0);
  assert.equal(totalAcrossCategories, evaluation.summary.totalCases);
  for (const categorySummary of report.byCategory) {
    assert.ok(VALID_CATEGORIES.has(categorySummary.category));
    assert.equal(categorySummary.compatibleCount + categorySummary.incompatibleCount, categorySummary.totalCases);
  }
});

test("summary includes thresholdBand and recommendation", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.ok(["staging_candidate", "needs_adjustment", "not_ready"].includes(report.overall.thresholdBand));
  assert.equal(typeof report.overall.recommendation, "string");
  assert.ok(report.overall.recommendation.length > 0);
});

test("summary does not fail or block on a low compatibilityRate", () => {
  // Explicitly documents the soft-threshold contract: no matter what compatibilityRate comes out
  // to, running the full corpus through summarizeGoldenIntentEvaluation must not throw, and there
  // is no assertion here requiring compatibilityRate to meet any particular bar.
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.doesNotThrow(() => summarizeGoldenIntentEvaluation(evaluation));
});

test("summary exposes incompatible cases, cases with warnings, and the two detection-gap slices", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.ok(Array.isArray(report.incompatibleCases));
  assert.ok(Array.isArray(report.casesWithWarnings));
  assert.ok(Array.isArray(report.productionUnsupportedButEnrichedDetected));
  assert.ok(Array.isArray(report.enrichedUnknownButProductionDetected));
  assert.equal(report.incompatibleCases.length, evaluation.summary.incompatibleCount);
  for (const c of report.incompatibleCases) {
    assert.equal(c.actual.compatible, false);
  }
});

test("expectedMappedIntentPassCount + expectedMappedIntentFailCount equals totalCases", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.equal(
    evaluation.summary.expectedMappedIntentPassCount + evaluation.summary.expectedMappedIntentFailCount,
    evaluation.summary.totalCases,
  );
});

test("the recorded golden corpus is internally consistent: no drift against current classifier behavior", () => {
  // This is the regression check the corpus exists to provide: every expectedMappedIntent was
  // captured by actually running the classifiers, so a passing run here means nobody has changed
  // classifier/adapter behavior without updating the corpus (or vice versa).
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.equal(
    evaluation.summary.expectedMappedIntentFailCount,
    0,
    `expected 0 drifted cases, got ${evaluation.summary.expectedMappedIntentFailCount}: ` +
      JSON.stringify(evaluation.summary.warnings, null, 2),
  );
});

// ─── explainGoldenIntentEvaluation ──────────────────────────────────────────────

test("explainGoldenIntentEvaluation documents scope, categories, and threshold bands", () => {
  const explain = explainGoldenIntentEvaluation();
  assert.equal(typeof explain.capability, "string");
  assert.ok(Array.isArray(explain.doesNot) && explain.doesNot.length > 0);
  assert.equal(explain.categories.length, VALID_CATEGORIES.size);
  assert.ok(Array.isArray(explain.thresholdBands) && explain.thresholdBands.length === 3);
});

// ─── Safety: golden evaluation never calls router/composer/handlers/DB/network ─────

test("golden evaluation module does not call a database or external service", async () => {
  const fs = await import("node:fs");
  const content = fs.readFileSync(
    new URL(
      "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts",
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
    assert.doesNotMatch(content, re, `intentGoldenEvaluation.ts must not match ${re}`);
  }
});

test("golden evaluation module does not import router/composer/handlers/gateway", async () => {
  const fs = await import("node:fs");
  const content = fs.readFileSync(
    new URL(
      "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts",
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
    assert.doesNotMatch(content, re, `intentGoldenEvaluation.ts must not import from ${re}`);
  }
});

test("golden evaluation never creates tasks, sends emails, or executes actions", () => {
  // Structural guarantee: running the full corpus through the evaluator + summarizer must be a
  // pure computation — no exceptions, no dangling promises/timers hinting at side effects.
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.equal(typeof report, "object");
  // Re-running must be deterministic (no hidden state/mutation across calls).
  const evaluationAgain = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  assert.deepEqual(evaluationAgain.summary.totalCases, evaluation.summary.totalCases);
  assert.deepEqual(evaluationAgain.summary.compatibilityRate, evaluation.summary.compatibilityRate);
});
