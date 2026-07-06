import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  normalizeDecisionSupportInput,
  detectDecisionType,
  extractDecisionOptions,
  identifyDecisionTradeoffs,
  identifyDecisionRisks,
  identifyEvidenceNeeds,
  buildDecisionStatement,
  estimateDecisionConfidence,
  explainDecisionSupportAnalysis,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportAnalyzer.ts";
import {
  handleDecisionSupportCandidate,
  formatDecisionSupportCandidateResponse,
  explainDecisionSupportCandidateHandler,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateHandler.ts";
import { DECISION_SUPPORT_HANDLER_CASES } from "./fixtures/conversational-brain-decision-support-handler-cases.ts";

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
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

/**
 * Sprint 19R — Decision Support Candidate Handler.
 *
 * Tests the pure, isolated candidate handler in
 * `src/lib/playbook-engine/conversation/decision-support/`. This handler is NOT wired to the
 * router, composer, any production handler, or POST /api/command-center/chat — the safety section
 * below asserts that in source, not just in behavior. The regression section re-runs the golden
 * evaluation, the Sprint 17R boundary review, and the Sprint 18R architecture review to confirm
 * none of their metrics changed.
 */

const VALID_DECISION_TYPES = new Set([
  "choose_between_options",
  "escalate_or_wait",
  "close_or_continue",
  "bill_or_wait",
  "accept_or_mitigate_risk",
  "change_vendor_or_continue",
  "approve_or_request_evidence",
  "prioritize_next_step",
  "identify_missing_decision",
  "general_decision_support",
]);

const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

function normalizedJoin(strings) {
  return normalizeDecisionSupportInput(strings.filter(Boolean).join(" "));
}

// ─── Fixture structure ───────────────────────────────────────────────────────────

test("fixture has at least 30 cases", () => {
  assert.ok(DECISION_SUPPORT_HANDLER_CASES.length >= 30, `expected >= 30 cases, got ${DECISION_SUPPORT_HANDLER_CASES.length}`);
});

test("fixture has at most 60 cases", () => {
  assert.ok(DECISION_SUPPORT_HANDLER_CASES.length <= 60, `expected <= 60 cases, got ${DECISION_SUPPORT_HANDLER_CASES.length}`);
});

test("every fixture case has a unique id", () => {
  const ids = DECISION_SUPPORT_HANDLER_CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids found in fixture");
});

test("every fixture case has a non-empty input", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    assert.equal(typeof c.input, "string");
    assert.ok(c.input.trim().length > 0, `case ${c.id} input must not be empty`);
  }
});

test("every fixture case has a valid expectedDecisionType", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    assert.ok(VALID_DECISION_TYPES.has(c.expectedDecisionType), `case ${c.id} has invalid expectedDecisionType "${c.expectedDecisionType}"`);
  }
});

test("every fixture case has expectedMinOptions >= 1", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    assert.ok(c.expectedMinOptions >= 1, `case ${c.id} expectedMinOptions must be >= 1`);
  }
});

test("every fixture case has a valid expectedConfidence", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    assert.ok(VALID_CONFIDENCE.has(c.expectedConfidence), `case ${c.id} has invalid expectedConfidence "${c.expectedConfidence}"`);
  }
});

test("every fixture case has boolean shouldAskClarifyingQuestion", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    assert.equal(typeof c.shouldAskClarifyingQuestion, "boolean", `case ${c.id} shouldAskClarifyingQuestion must be boolean`);
  }
});

test("fixture covers all ten decision types", () => {
  const covered = new Set(DECISION_SUPPORT_HANDLER_CASES.map((c) => c.expectedDecisionType));
  for (const type of VALID_DECISION_TYPES) {
    assert.ok(covered.has(type), `expected fixture to cover decision type "${type}"`);
  }
});

// ─── Analyzer: normalizeDecisionSupportInput ────────────────────────────────────

test("normalizeDecisionSupportInput normalizes accents/case/whitespace stably", () => {
  const a = normalizeDecisionSupportInput("¿Qué OPCIÓN debería   escoger?");
  const b = normalizeDecisionSupportInput("que opcion deberia escoger");
  assert.equal(a, "que opcion deberia escoger?");
  assert.equal(normalizeDecisionSupportInput(a), normalizeDecisionSupportInput(a), "must be idempotent/stable");
  assert.ok(a.includes(b.slice(0, 10)));
});

// ─── Analyzer: detectDecisionType ───────────────────────────────────────────────

test("detectDecisionType detects bill_or_wait", () => {
  assert.equal(detectDecisionType("conviene facturar ya o esperar recepción formal"), "bill_or_wait");
});

test("detectDecisionType detects escalate_or_wait", () => {
  assert.equal(detectDecisionType("conviene escalar o esperar"), "escalate_or_wait");
});

test("detectDecisionType detects close_or_continue", () => {
  assert.equal(detectDecisionType("deberíamos cerrar ya o pedir más evidencia"), "close_or_continue");
});

test("detectDecisionType detects accept_or_mitigate_risk", () => {
  assert.equal(detectDecisionType("deberíamos aceptar este riesgo o mitigarlo"), "accept_or_mitigate_risk");
});

test("detectDecisionType detects change_vendor_or_continue", () => {
  assert.equal(detectDecisionType("deberíamos cambiar de proveedor o presionar al actual"), "change_vendor_or_continue");
});

test("detectDecisionType detects approve_or_request_evidence", () => {
  assert.equal(detectDecisionType("aprobamos esto o pedimos más evidencia"), "approve_or_request_evidence");
});

test("detectDecisionType detects prioritize_next_step", () => {
  assert.equal(detectDecisionType("qué hago primero"), "prioritize_next_step");
});

test("detectDecisionType detects identify_missing_decision", () => {
  assert.equal(detectDecisionType("qué decisión falta"), "identify_missing_decision");
});

test("detectDecisionType returns general_decision_support as a safe fallback", () => {
  assert.equal(detectDecisionType("qué opción debería escoger"), "general_decision_support");
  assert.equal(detectDecisionType("cuál alternativa conviene"), "general_decision_support");
});

test("detectDecisionType runs over every fixture case and matches expectedDecisionType", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    assert.equal(
      detectDecisionType(c.input),
      c.expectedDecisionType,
      `case ${c.id} ("${c.input}") expected decision type "${c.expectedDecisionType}"`,
    );
  }
});

// ─── Analyzer: extractDecisionOptions ───────────────────────────────────────────

test("extractDecisionOptions detects options separated by 'o'", () => {
  const options = extractDecisionOptions("deberíamos hacer A o B");
  assert.ok(options.length >= 2);
  assert.ok(options.every((o) => o.detectedFromInput));
});

test("extractDecisionOptions detects options with 'vs'", () => {
  const options = extractDecisionOptions("el plan A vs el plan B modernizado");
  assert.ok(options.length >= 2);
  assert.ok(options.every((o) => o.detectedFromInput));
});

test("extractDecisionOptions creates default options for bill_or_wait", () => {
  const options = extractDecisionOptions("conviene facturar ya o esperar recepción formal");
  assert.equal(options.length, 2);
  assert.ok(options.some((o) => /facturar/i.test(o.label)));
  assert.ok(options.some((o) => /esperar/i.test(o.label)));
});

test("extractDecisionOptions creates default options for escalate_or_wait", () => {
  const options = extractDecisionOptions("conviene escalar o esperar");
  assert.equal(options.length, 2);
  assert.ok(options.some((o) => /escalar/i.test(o.label)));
  assert.ok(options.some((o) => /esperar/i.test(o.label)));
});

test("extractDecisionOptions creates default options for accept_or_mitigate_risk", () => {
  const options = extractDecisionOptions("deberíamos aceptar este riesgo o mitigarlo");
  assert.equal(options.length, 2);
  assert.ok(options.some((o) => /aceptar/i.test(o.label)));
  assert.ok(options.some((o) => /mitigar/i.test(o.label)));
});

test("extractDecisionOptions always returns at least one option for clear decision_support input", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const options = extractDecisionOptions(c.input);
    assert.ok(options.length >= 1, `case ${c.id} must produce at least one option`);
  }
});

// ─── Handler: handleDecisionSupportCandidate ────────────────────────────────────

test("handleDecisionSupportCandidate processes every fixture case without throwing", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    assert.doesNotThrow(() => handleDecisionSupportCandidate({ input: c.input }), `case ${c.id} must not throw`);
  }
});

test("result.kind is decision_support_candidate_result for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.equal(result.kind, "decision_support_candidate_result", `case ${c.id}`);
  }
});

test("result.decisionStatement is non-empty for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.ok(result.decisionStatement.trim().length > 0, `case ${c.id}`);
  }
});

test("result.detectedDecisionType matches expectedDecisionType for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.equal(result.detectedDecisionType, c.expectedDecisionType, `case ${c.id}`);
  }
});

test("result.options.length >= expectedMinOptions for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.ok(
      result.options.length >= c.expectedMinOptions,
      `case ${c.id} expected >= ${c.expectedMinOptions} options, got ${result.options.length}`,
    );
  }
});

test("result.tradeoffs is non-empty and contains expectedTradeoffKeywords for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.ok(result.tradeoffs.length > 0, `case ${c.id} tradeoffs must not be empty`);
    const joined = normalizedJoin(result.tradeoffs.flatMap((t) => [t.dimension, t.summary]));
    for (const keyword of c.expectedTradeoffKeywords) {
      assert.ok(joined.includes(keyword), `case ${c.id} expected tradeoff keyword "${keyword}" in "${joined}"`);
    }
  }
});

test("result.risks is non-empty and contains expectedRiskKeywords for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.ok(result.risks.length > 0, `case ${c.id} risks must not be empty`);
    const joined = normalizedJoin(result.risks.flatMap((r) => [r.description, r.mitigation]));
    for (const keyword of c.expectedRiskKeywords) {
      assert.ok(joined.includes(keyword), `case ${c.id} expected risk keyword "${keyword}" in "${joined}"`);
    }
  }
});

test("result.evidenceNeeded is non-empty and contains expectedEvidenceKeywords for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.ok(result.evidenceNeeded.length > 0, `case ${c.id} evidenceNeeded must not be empty`);
    const joined = normalizedJoin(result.evidenceNeeded.flatMap((e) => [e.description, e.reason]));
    for (const keyword of c.expectedEvidenceKeywords) {
      assert.ok(joined.includes(keyword), `case ${c.id} expected evidence keyword "${keyword}" in "${joined}"`);
    }
  }
});

test("result.recommendation.recommendedPath and suggestedNextStep are non-empty for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.ok(result.recommendation.recommendedPath.trim().length > 0, `case ${c.id}`);
    assert.ok(result.recommendation.suggestedNextStep.trim().length > 0, `case ${c.id}`);
  }
});

test("result.recommendation.confidence matches expectedConfidence for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.equal(result.recommendation.confidence, c.expectedConfidence, `case ${c.id}`);
  }
});

test("result.recommendation.shouldAskClarifyingQuestion matches fixture for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.equal(result.recommendation.shouldAskClarifyingQuestion, c.shouldAskClarifyingQuestion, `case ${c.id}`);
    if (c.shouldAskClarifyingQuestion) {
      assert.ok(typeof result.recommendation.clarificationQuestion === "string" && result.recommendation.clarificationQuestion.length > 0);
    }
  }
});

test("result.safety is always the fixed safe-candidate object for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.equal(result.safety.shouldExecuteAction, false, `case ${c.id}`);
    assert.equal(result.safety.shouldCreateTask, false, `case ${c.id}`);
    assert.equal(result.safety.shouldSendEmail, false, `case ${c.id}`);
    assert.equal(result.safety.shouldWriteToDb, false, `case ${c.id}`);
    assert.equal(result.safety.requiresHumanConfirmation, true, `case ${c.id}`);
    assert.equal(result.safety.productionRoutingEnabled, false, `case ${c.id}`);
  }
});

test("result.auditMetadata.handlerVersion and matchedPatterns exist for every case", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.equal(typeof result.auditMetadata.handlerVersion, "string");
    assert.ok(result.auditMetadata.handlerVersion.length > 0);
    assert.ok(Array.isArray(result.auditMetadata.matchedPatterns));
    assert.ok(result.auditMetadata.matchedPatterns.length > 0, `case ${c.id}`);
  }
});

test("handleDecisionSupportCandidate throws on empty input", () => {
  assert.throws(() => handleDecisionSupportCandidate({ input: "" }));
  assert.throws(() => handleDecisionSupportCandidate({ input: "   " }));
});

test("handleDecisionSupportCandidate is deterministic for the same input", () => {
  const a = handleDecisionSupportCandidate({ input: "conviene escalar o esperar" });
  const b = handleDecisionSupportCandidate({ input: "conviene escalar o esperar" });
  assert.equal(a.detectedDecisionType, b.detectedDecisionType);
  assert.equal(a.decisionStatement, b.decisionStatement);
  assert.equal(a.recommendation.confidence, b.recommendation.confidence);
});

// ─── Formatting: formatDecisionSupportCandidateResponse ─────────────────────────

test("formatDecisionSupportCandidateResponse includes all required sections and safety language", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES.slice(0, 10)) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    const text = formatDecisionSupportCandidateResponse(result);
    assert.ok(text.includes("Decisión a resolver"), `case ${c.id}`);
    assert.ok(text.includes("Opciones detectadas"), `case ${c.id}`);
    assert.ok(text.includes("Tradeoffs"), `case ${c.id}`);
    assert.ok(text.includes("Riesgos"), `case ${c.id}`);
    assert.ok(text.includes("Evidencia"), `case ${c.id}`);
    assert.ok(text.includes("Recomendación"), `case ${c.id}`);
    assert.ok(text.includes("Siguiente paso"), `case ${c.id}`);
    assert.ok(/validaci[oó]n humana/i.test(text), `case ${c.id} must mention human validation`);
  }
});

test("formatDecisionSupportCandidateResponse never claims an action was executed, a task created, or an email sent", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES.slice(0, 10)) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    const text = formatDecisionSupportCandidateResponse(result).toLowerCase();
    assert.ok(!/\bse ejecut(o|ó)\b/.test(text) || /no se ejecut/.test(text));
    assert.ok(!/\bse cre(o|ó) la tarea\b/.test(text));
    assert.ok(!/\bse envi(o|ó) el correo\b/.test(text));
    assert.ok(text.includes("no se ejecutó ninguna acción"));
    assert.ok(text.includes("no se creó ninguna tarea"));
    assert.ok(text.includes("no se envió ningún correo"));
  }
});

// ─── explain* capability functions ───────────────────────────────────────────────

test("explainDecisionSupportAnalysis documents scope and decision types", () => {
  const explain = explainDecisionSupportAnalysis();
  assert.equal(typeof explain.capability, "string");
  assert.ok(Array.isArray(explain.decisionTypes) && explain.decisionTypes.length === 10);
  assert.ok(Array.isArray(explain.doesNot) && explain.doesNot.length > 0);
  assert.ok(Array.isArray(explain.limitations) && explain.limitations.length > 0);
});

test("explainDecisionSupportCandidateHandler documents safety and non-connection to production", () => {
  const explain = explainDecisionSupportCandidateHandler();
  assert.equal(typeof explain.capability, "string");
  assert.ok(Array.isArray(explain.doesNot) && explain.doesNot.length > 0);
  assert.ok(Array.isArray(explain.safetyGuarantees) && explain.safetyGuarantees.length > 0);
  assert.equal(typeof explain.humanConfirmationPolicy, "string");
  assert.ok(explain.humanConfirmationPolicy.length > 0);
  assert.equal(typeof explain.connectionToProduction, "string");
  assert.ok(/none/i.test(explain.connectionToProduction));
});

// ─── Safety: source-level isolation checks ──────────────────────────────────────

const DECISION_SUPPORT_DIR_FILES = [
  "../src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateTypes.ts",
  "../src/lib/playbook-engine/conversation/decision-support/decisionSupportAnalyzer.ts",
  "../src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateHandler.ts",
  "../src/lib/playbook-engine/conversation/decision-support/index.ts",
];

test("decision-support module does not call fetch, a database, Supabase, or Gmail", () => {
  const forbidden = [
    /\bfetch\(/,
    /from\s+["'][^"']*supabase[^"']*["']/i,
    /from\s+["'][^"']*gmail[^"']*["']/i,
    /\bsendEmail\s*\(/i,
    /\bcreateTask\s*\(/i,
    /\bcreateRaidItem\s*\(/i,
    /\bcreatePlatformEvent\s*\(/i,
  ];
  for (const relativePath of DECISION_SUPPORT_DIR_FILES) {
    const content = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const re of forbidden) {
      assert.doesNotMatch(content, re, `${relativePath} must not match ${re}`);
    }
  }
});

test("decision-support module does not import router/composer/handlers/gateway", () => {
  const forbiddenImports = [
    /from\s+["'][^"']*brainRouter[^"']*["']/,
    /from\s+["'][^"']*responseComposer[^"']*["']/,
    /from\s+["'][^"']*\/handlers\/[^"']*["']/,
    /from\s+["'][^"']*conversationalBrainGateway[^"']*["']/,
  ];
  for (const relativePath of DECISION_SUPPORT_DIR_FILES) {
    const content = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const re of forbiddenImports) {
      assert.doesNotMatch(content, re, `${relativePath} must not import from ${re}`);
    }
  }
});

test("decision-support module does not import the classifier pattern files or the adapter", () => {
  const forbiddenImports = [
    /from\s+["'][^"']*intentClassifier\.rules["']/,
    /from\s+["'][^"']*intent-patterns["']/,
    /from\s+["'][^"']*intentCompatibilityAdapter["']/,
  ];
  for (const relativePath of DECISION_SUPPORT_DIR_FILES) {
    const content = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const re of forbiddenImports) {
      assert.doesNotMatch(content, re, `${relativePath} must not import from ${re}`);
    }
  }
});

test("production conversation barrel (index.ts) does not export the decision-support module", () => {
  const content = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(content, /decision-support/);
});

test("decision-support handler never sets shouldExecuteAction/shouldCreateTask/shouldSendEmail/shouldWriteToDb to true", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES) {
    const result = handleDecisionSupportCandidate({ input: c.input });
    assert.equal(result.safety.shouldExecuteAction, false);
    assert.equal(result.safety.shouldCreateTask, false);
    assert.equal(result.safety.shouldSendEmail, false);
    assert.equal(result.safety.shouldWriteToDb, false);
  }
});

// ─── Regression: golden evaluation + Sprint 17R + Sprint 18R unchanged ──────────

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

test("this sprint does not change the Sprint 17R boundary review's structural metrics", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(summary.totalCases, 70);
  assert.equal(summary.policyAlignedRate, 74.3, `expected policyAlignedRate to stay 74.3, got ${summary.policyAlignedRate}`);
  assert.equal(summary.currentSystemAcceptableRate, 84.3, `expected currentSystemAcceptableRate to stay 84.3, got ${summary.currentSystemAcceptableRate}`);
  assert.equal(summary.architectureGapCount, 10);
  assert.equal(summary.clarificationGapCount, 10);
});

test("this sprint does not change the Sprint 18R decision/clarification architecture review's structural metrics", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.currentSafeMappingRate, 64.6, `expected currentSafeMappingRate to stay 64.6, got ${summary.currentSafeMappingRate}`);
  assert.equal(
    summary.futureRouteAlreadySupportedRate,
    49.4,
    `expected futureRouteAlreadySupportedRate to stay 49.4, got ${summary.futureRouteAlreadySupportedRate}`,
  );
  assert.equal(summary.requiresNewHandlerCount, 45);
  assert.equal(summary.requiresClarificationCount, 24);
  assert.equal(summary.recommendedNextSprint, "Sprint 19R — Decision Support Candidate Handler");
});
