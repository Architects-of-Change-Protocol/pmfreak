import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  normalizeClarificationInput,
  detectClarificationStrategyType,
  inferMissingSlots,
  inferSuggestedRouteOptions,
  explainClarificationResponseAnalysis,
} from "../src/lib/playbook-engine/conversation/clarification/clarificationResponseAnalyzer.ts";
import {
  handleClarificationResponseCandidate,
  formatClarificationResponseCandidate,
  explainClarificationResponseStrategy,
} from "../src/lib/playbook-engine/conversation/clarification/clarificationResponseStrategy.ts";
import {
  runClarificationResponseEvaluation,
  summarizeClarificationResponseEvaluation,
  explainClarificationResponseEvaluation,
  toDecisionClarificationEvaluationCases,
  toGeneralPmBoundaryEvaluationCases,
} from "../src/lib/playbook-engine/conversation/clarification/clarificationResponseEvaluation.ts";
import { CLARIFICATION_RESPONSE_CASES } from "./fixtures/conversational-brain-clarification-response-cases.ts";

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
import {
  runDecisionSupportShadowMappingEvaluation,
  summarizeDecisionSupportShadowMappingEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts";
import { handleDecisionSupportCandidate } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateHandler.ts";
import { DECISION_SUPPORT_HANDLER_CASES } from "./fixtures/conversational-brain-decision-support-handler-cases.ts";

/**
 * Sprint 22R — Clarification Response Strategy.
 *
 * Tests the pure, isolated clarification response strategy in
 * `src/lib/playbook-engine/conversation/clarification/`. This strategy is NOT wired to the router,
 * composer, any production handler, or POST /api/command-center/chat — the safety section below
 * asserts that in source, not just in behavior. The regression section re-runs the golden
 * evaluation and every prior sprint's own test-defining metrics to confirm none changed.
 */

const VALID_STRATEGY_TYPES = new Set([
  "generic_ambiguous",
  "review_without_context",
  "follow_up_ambiguous",
  "concern_without_domain",
  "stalled_progress_ambiguous",
  "communication_hint_ambiguous",
  "task_hint_ambiguous",
  "risk_hint_ambiguous",
  "status_hint_ambiguous",
  "decision_hint_ambiguous",
  "context_missing_for_known_route",
]);

const VALID_MISSING_SLOTS = new Set([
  "project",
  "intent",
  "source_context",
  "desired_output",
  "urgency",
  "owner",
  "timeframe",
  "action_authorization",
  "evidence",
  "recipient",
  "decision_options",
]);

const VALID_AMBIGUITY_LEVELS = new Set(["low", "medium", "high"]);

// ─── Fixture structure ───────────────────────────────────────────────────────────

test("fixture has at least 40 cases", () => {
  assert.ok(CLARIFICATION_RESPONSE_CASES.length >= 40, `expected >= 40 cases, got ${CLARIFICATION_RESPONSE_CASES.length}`);
});

test("fixture has at most 70 cases", () => {
  assert.ok(CLARIFICATION_RESPONSE_CASES.length <= 70, `expected <= 70 cases, got ${CLARIFICATION_RESPONSE_CASES.length}`);
});

test("every fixture case has a unique id", () => {
  const ids = CLARIFICATION_RESPONSE_CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids found in fixture");
});

test("every fixture case has a non-empty input", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.equal(typeof c.input, "string");
    assert.ok(c.input.trim().length > 0, `case ${c.id} input must not be empty`);
  }
});

test("every fixture case has a valid expectedStrategyType", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.ok(VALID_STRATEGY_TYPES.has(c.expectedStrategyType), `case ${c.id} has invalid expectedStrategyType "${c.expectedStrategyType}"`);
  }
});

test("every fixture case has expectedMissingSlots as an array of valid slots", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.ok(Array.isArray(c.expectedMissingSlots), `case ${c.id} expectedMissingSlots must be an array`);
    for (const slot of c.expectedMissingSlots) {
      assert.ok(VALID_MISSING_SLOTS.has(slot), `case ${c.id} has invalid missing slot "${slot}"`);
    }
  }
});

test("every fixture case has expectedRouteOptionIntents as a non-empty array", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.ok(Array.isArray(c.expectedRouteOptionIntents), `case ${c.id} expectedRouteOptionIntents must be an array`);
    assert.ok(c.expectedRouteOptionIntents.length > 0, `case ${c.id} expectedRouteOptionIntents must not be empty`);
  }
});

test("every fixture case has a valid expectedAmbiguityLevel", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.ok(VALID_AMBIGUITY_LEVELS.has(c.expectedAmbiguityLevel), `case ${c.id} has invalid expectedAmbiguityLevel "${c.expectedAmbiguityLevel}"`);
  }
});

test("every fixture case has a valid expectedPrimaryQuestionSlot", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.ok(VALID_MISSING_SLOTS.has(c.expectedPrimaryQuestionSlot), `case ${c.id} has invalid expectedPrimaryQuestionSlot "${c.expectedPrimaryQuestionSlot}"`);
  }
});

test("every fixture case has boolean shouldMentionNoActionExecuted", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.equal(typeof c.shouldMentionNoActionExecuted, "boolean", `case ${c.id} shouldMentionNoActionExecuted must be boolean`);
  }
});

test("fixture covers all eleven clarification strategy types", () => {
  const covered = new Set(CLARIFICATION_RESPONSE_CASES.map((c) => c.expectedStrategyType));
  for (const type of VALID_STRATEGY_TYPES) {
    assert.ok(covered.has(type), `expected fixture to cover strategy type "${type}"`);
  }
});

// ─── Analyzer: normalizeClarificationInput ───────────────────────────────────────

test("normalizeClarificationInput normalizes accents/case/whitespace stably", () => {
  const a = normalizeClarificationInput("¿Qué   HACEMOS?");
  assert.equal(a, "que hacemos?");
  assert.equal(normalizeClarificationInput(a), normalizeClarificationInput(a), "must be idempotent/stable");
});

// ─── Analyzer: detectClarificationStrategyType ───────────────────────────────────

test("detectClarificationStrategyType detects generic_ambiguous", () => {
  assert.equal(detectClarificationStrategyType("ayuda"), "generic_ambiguous");
  assert.equal(detectClarificationStrategyType("qué hacemos"), "generic_ambiguous");
});

test("detectClarificationStrategyType detects review_without_context", () => {
  assert.equal(detectClarificationStrategyType("revisá esto"), "review_without_context");
});

test("detectClarificationStrategyType detects follow_up_ambiguous", () => {
  assert.equal(detectClarificationStrategyType("dale seguimiento"), "follow_up_ambiguous");
});

test("detectClarificationStrategyType detects concern_without_domain", () => {
  assert.equal(detectClarificationStrategyType("me preocupa esto"), "concern_without_domain");
  assert.equal(detectClarificationStrategyType("no me gusta cómo va esto"), "concern_without_domain");
});

test("detectClarificationStrategyType detects stalled_progress_ambiguous", () => {
  assert.equal(detectClarificationStrategyType("esto no avanza"), "stalled_progress_ambiguous");
});

test("detectClarificationStrategyType detects communication_hint_ambiguous", () => {
  assert.equal(detectClarificationStrategyType("habría que decirle algo"), "communication_hint_ambiguous");
});

test("detectClarificationStrategyType detects task_hint_ambiguous", () => {
  assert.equal(detectClarificationStrategyType("alguien tiene que ver esto"), "task_hint_ambiguous");
});

test("detectClarificationStrategyType detects risk_hint_ambiguous", () => {
  assert.equal(detectClarificationStrategyType("esto puede ser un problema"), "risk_hint_ambiguous");
});

test("detectClarificationStrategyType detects status_hint_ambiguous", () => {
  assert.equal(detectClarificationStrategyType("cómo va esto"), "status_hint_ambiguous");
});

test("detectClarificationStrategyType detects decision_hint_ambiguous", () => {
  assert.equal(detectClarificationStrategyType("hay que decidir algo"), "decision_hint_ambiguous");
});

test("detectClarificationStrategyType detects context_missing_for_known_route", () => {
  assert.equal(detectClarificationStrategyType("redactame eso"), "context_missing_for_known_route");
  assert.equal(detectClarificationStrategyType("creá esa tarea"), "context_missing_for_known_route");
  assert.equal(detectClarificationStrategyType("facturamos eso"), "context_missing_for_known_route");
});

test("detectClarificationStrategyType runs over every fixture case and matches expectedStrategyType", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.equal(
      detectClarificationStrategyType(c.input),
      c.expectedStrategyType,
      `case ${c.id} ("${c.input}") expected strategy type "${c.expectedStrategyType}"`,
    );
  }
});

// ─── Analyzer: inferMissingSlots ─────────────────────────────────────────────────

test("'ayuda' missing slots include project and intent", () => {
  const slots = inferMissingSlots("ayuda", detectClarificationStrategyType("ayuda"));
  assert.ok(slots.includes("project"));
  assert.ok(slots.includes("intent"));
});

test("'revisá esto' missing slots include source_context", () => {
  const slots = inferMissingSlots("revisá esto", detectClarificationStrategyType("revisá esto"));
  assert.ok(slots.includes("source_context"));
});

test("'dale seguimiento' missing slots include intent and project or source_context", () => {
  const slots = inferMissingSlots("dale seguimiento", detectClarificationStrategyType("dale seguimiento"));
  assert.ok(slots.includes("intent"));
  assert.ok(slots.includes("project") || slots.includes("source_context"));
});

test("'habría que decirle algo' missing slots include recipient or source_context", () => {
  const slots = inferMissingSlots("habría que decirle algo", detectClarificationStrategyType("habría que decirle algo"));
  assert.ok(slots.includes("recipient") || slots.includes("source_context"));
});

test("'alguien tiene que ver esto' missing slots include owner or action_authorization", () => {
  const slots = inferMissingSlots("alguien tiene que ver esto", detectClarificationStrategyType("alguien tiene que ver esto"));
  assert.ok(slots.includes("owner") || slots.includes("action_authorization"));
});

test("'hay que decidir algo' missing slots include decision_options", () => {
  const slots = inferMissingSlots("hay que decidir algo", detectClarificationStrategyType("hay que decidir algo"));
  assert.ok(slots.includes("decision_options"));
});

test("'redactame eso' missing slots include source_context", () => {
  const slots = inferMissingSlots("redactame eso", detectClarificationStrategyType("redactame eso"));
  assert.ok(slots.includes("source_context"));
});

// ─── Analyzer: inferSuggestedRouteOptions ────────────────────────────────────────

function intentsFor(input) {
  const strategyType = detectClarificationStrategyType(input);
  const missingSlots = inferMissingSlots(input, strategyType);
  return inferSuggestedRouteOptions(input, strategyType, missingSlots).map((o) => o.intent);
}

test("generic_ambiguous route options include project_status_question, risk_analysis, decision_support, communication_draft", () => {
  const intents = intentsFor("ayuda");
  for (const expected of ["project_status_question", "risk_analysis", "decision_support", "communication_draft"]) {
    assert.ok(intents.includes(expected), `expected ${expected} in ${JSON.stringify(intents)}`);
  }
});

test("follow_up_ambiguous route options include communication_draft and task_or_action_request", () => {
  const intents = intentsFor("dale seguimiento");
  assert.ok(intents.includes("communication_draft"));
  assert.ok(intents.includes("task_or_action_request"));
});

test("concern_without_domain route options include risk_analysis and project_status_question", () => {
  const intents = intentsFor("me preocupa esto");
  assert.ok(intents.includes("risk_analysis"));
  assert.ok(intents.includes("project_status_question"));
});

test("communication_hint_ambiguous route options include communication_draft", () => {
  assert.ok(intentsFor("habría que decirle algo").includes("communication_draft"));
});

test("task_hint_ambiguous route options include task_or_action_request", () => {
  assert.ok(intentsFor("alguien tiene que ver esto").includes("task_or_action_request"));
});

test("risk_hint_ambiguous route options include risk_analysis", () => {
  assert.ok(intentsFor("esto puede ser un problema").includes("risk_analysis"));
});

test("decision_hint_ambiguous route options include decision_support", () => {
  assert.ok(intentsFor("hay que decidir algo").includes("decision_support"));
});

// ─── Handler: handleClarificationResponseCandidate ───────────────────────────────

test("handleClarificationResponseCandidate processes every fixture case without throwing", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    assert.doesNotThrow(() => handleClarificationResponseCandidate({ input: c.input }), `case ${c.id} must not throw`);
  }
});

test("result.kind is clarification_response_candidate_result for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.equal(result.kind, "clarification_response_candidate_result", `case ${c.id}`);
  }
});

test("result.strategyType matches expectedStrategyType for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.equal(result.strategyType, c.expectedStrategyType, `case ${c.id}`);
  }
});

test("result.ambiguityLevel matches expectedAmbiguityLevel for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.equal(result.ambiguityLevel, c.expectedAmbiguityLevel, `case ${c.id}`);
  }
});

test("result.missingSlots contains every expectedMissingSlots entry for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    for (const slot of c.expectedMissingSlots) {
      assert.ok(result.missingSlots.includes(slot), `case ${c.id} expected missing slot "${slot}"`);
    }
  }
});

test("result.suggestedRouteOptions contains every expectedRouteOptionIntents entry for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    const intents = result.suggestedRouteOptions.map((o) => o.intent);
    for (const expected of c.expectedRouteOptionIntents) {
      assert.ok(intents.includes(expected), `case ${c.id} expected route option "${expected}" in ${JSON.stringify(intents)}`);
    }
  }
});

test("result.primaryQuestion exists and its slot matches expectedPrimaryQuestionSlot for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.ok(result.primaryQuestion, `case ${c.id}`);
    assert.ok(result.primaryQuestion.question.trim().length > 0, `case ${c.id}`);
    assert.equal(result.primaryQuestion.slot, c.expectedPrimaryQuestionSlot, `case ${c.id}`);
  }
});

test("result.secondaryQuestions never exceeds three entries for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.ok(result.secondaryQuestions.length <= 3, `case ${c.id}`);
  }
});

test("result.responseText is non-empty and includes route options for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.ok(result.responseText.trim().length > 0, `case ${c.id}`);
    assert.ok(/rutas/i.test(result.responseText), `case ${c.id} responseText should mention possible routes`);
  }
});

test("result.safety is always the fixed safe-candidate object for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.equal(result.safety.shouldExecuteAction, false, `case ${c.id}`);
    assert.equal(result.safety.shouldCreateTask, false, `case ${c.id}`);
    assert.equal(result.safety.shouldSendEmail, false, `case ${c.id}`);
    assert.equal(result.safety.shouldWriteToDb, false, `case ${c.id}`);
    assert.equal(result.safety.requiresUserReply, true, `case ${c.id}`);
    assert.equal(result.safety.productionRoutingEnabled, false, `case ${c.id}`);
    assert.equal(result.safety.maxQuestionsRecommended, 3, `case ${c.id}`);
  }
});

test("result.auditMetadata.strategyVersion, matchedSignals, and missingSlots exist for every case", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.equal(typeof result.auditMetadata.strategyVersion, "string");
    assert.ok(result.auditMetadata.strategyVersion.length > 0);
    assert.ok(Array.isArray(result.auditMetadata.matchedSignals));
    assert.ok(result.auditMetadata.matchedSignals.length > 0, `case ${c.id}`);
    assert.ok(Array.isArray(result.auditMetadata.missingSlots));
  }
});

test("handleClarificationResponseCandidate throws on empty input", () => {
  assert.throws(() => handleClarificationResponseCandidate({ input: "" }));
  assert.throws(() => handleClarificationResponseCandidate({ input: "   " }));
});

test("handleClarificationResponseCandidate is deterministic for the same input", () => {
  const a = handleClarificationResponseCandidate({ input: "dale seguimiento" });
  const b = handleClarificationResponseCandidate({ input: "dale seguimiento" });
  assert.equal(a.strategyType, b.strategyType);
  assert.equal(a.responseText, b.responseText);
  assert.deepEqual(a.missingSlots, b.missingSlots);
});

test("handleClarificationResponseCandidate uses availableContext to reduce missing slots", () => {
  const withoutContext = handleClarificationResponseCandidate({ input: "revisá esto" });
  const withContext = handleClarificationResponseCandidate({
    input: "revisá esto",
    availableContext: { knownProjectName: "Proyecto Alfa", attachedContextSummary: "correo del cliente adjunto" },
  });
  assert.ok(withoutContext.missingSlots.includes("project"));
  assert.ok(!withContext.missingSlots.includes("project"));
  assert.ok(!withContext.missingSlots.includes("source_context"));
});

// ─── Formatting: formatClarificationResponseCandidate ────────────────────────────

test("formatClarificationResponseCandidate includes acknowledgment, primary question, routes, and no-action note", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES.slice(0, 15)) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    const text = formatClarificationResponseCandidate(result);
    assert.ok(/te ayudo/i.test(text), `case ${c.id} should acknowledge the request`);
    assert.ok(text.includes(result.primaryQuestion.question), `case ${c.id} should include the primary question`);
    assert.ok(/rutas/i.test(text), `case ${c.id} should offer possible routes`);
    assert.ok(/no ejecut/i.test(text), `case ${c.id} should note that nothing was executed`);
  }
});

test("formatClarificationResponseCandidate never affirms an executed action, created task, sent email, or DB write", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    const text = formatClarificationResponseCandidate(result).toLowerCase();
    assert.ok(!/\bse ejecut(o|ó)\b/.test(text), `case ${c.id}`);
    assert.ok(!/\bse cre(o|ó) (la|una) tarea\b/.test(text), `case ${c.id}`);
    assert.ok(!/\bse envi(o|ó) (el|un) correo\b/.test(text), `case ${c.id}`);
    assert.ok(!/\bse actualiz(o|ó) la base de datos\b/.test(text), `case ${c.id}`);
    assert.ok(text.includes("no ejecuté ninguna acción"), `case ${c.id}`);
    assert.ok(text.includes("no creé ninguna tarea"), `case ${c.id}`);
    assert.ok(text.includes("no envié ningún correo"), `case ${c.id}`);
  }
});

test("formatClarificationResponseCandidate includeAuditFooter option appends strategy/ambiguity footer", () => {
  const result = handleClarificationResponseCandidate({ input: "ayuda" });
  const text = formatClarificationResponseCandidate(result, { includeAuditFooter: true });
  assert.ok(text.includes(result.strategyType));
  assert.ok(text.includes(result.ambiguityLevel));
});

// ─── explain* capability functions ───────────────────────────────────────────────

test("explainClarificationResponseAnalysis documents scope and strategy types", () => {
  const explain = explainClarificationResponseAnalysis();
  assert.equal(typeof explain.capability, "string");
  assert.ok(Array.isArray(explain.strategyTypes) && explain.strategyTypes.length === 11);
  assert.ok(Array.isArray(explain.doesNot) && explain.doesNot.length > 0);
  assert.ok(Array.isArray(explain.limitations) && explain.limitations.length > 0);
});

test("explainClarificationResponseStrategy documents safety and non-connection to production", () => {
  const explain = explainClarificationResponseStrategy();
  assert.equal(typeof explain.capability, "string");
  assert.ok(Array.isArray(explain.doesNot) && explain.doesNot.length > 0);
  assert.ok(Array.isArray(explain.safetyGuarantees) && explain.safetyGuarantees.length > 0);
  assert.equal(typeof explain.humanReplyPolicy, "string");
  assert.ok(explain.humanReplyPolicy.length > 0);
  assert.equal(typeof explain.connectionToProduction, "string");
  assert.ok(/none/i.test(explain.connectionToProduction));
});

test("explainClarificationResponseEvaluation documents non-goals and recommendation logic", () => {
  const explain = explainClarificationResponseEvaluation();
  assert.equal(typeof explain.capability, "string");
  assert.ok(Array.isArray(explain.nonGoals) && explain.nonGoals.length > 0);
  assert.ok(Array.isArray(explain.expectedClarificationRules) && explain.expectedClarificationRules.length > 0);
  assert.ok(Array.isArray(explain.acceptabilityRules) && explain.acceptabilityRules.length > 0);
  assert.ok(Array.isArray(explain.recommendedNextSprintLogic) && explain.recommendedNextSprintLogic.length > 0);
});

// ─── Evaluator ────────────────────────────────────────────────────────────────────

const EVALUATION_CASES = [
  ...toDecisionClarificationEvaluationCases(DECISION_CLARIFICATION_CASES),
  ...toGeneralPmBoundaryEvaluationCases(GENERAL_PM_ADVICE_BOUNDARY_CASES),
];

test("runClarificationResponseEvaluation processes every case from the Sprint 18R + Sprint 17R corpora without throwing", () => {
  assert.doesNotThrow(() => runClarificationResponseEvaluation(EVALUATION_CASES));
});

test("summarizeClarificationResponseEvaluation computes totalCases correctly", () => {
  const results = runClarificationResponseEvaluation(EVALUATION_CASES);
  const summary = summarizeClarificationResponseEvaluation(results);
  assert.equal(summary.totalCases, DECISION_CLARIFICATION_CASES.length + GENERAL_PM_ADVICE_BOUNDARY_CASES.length);
});

test("summary exposes evaluatedClarificationCases, coverage, acceptability, and safety rates", () => {
  const results = runClarificationResponseEvaluation(EVALUATION_CASES);
  const summary = summarizeClarificationResponseEvaluation(results);
  assert.ok(summary.evaluatedClarificationCases > 0);
  assert.equal(typeof summary.strategyCoverageRate, "number");
  assert.equal(typeof summary.acceptableResponseRate, "number");
  assert.equal(typeof summary.safetyPassRate, "number");
  assert.equal(typeof summary.routeOptionsCoverageRate, "number");
  assert.equal(typeof summary.overQuestioningCount, "number");
  assert.ok(summary.byStrategyType && typeof summary.byStrategyType === "object");
  assert.ok(summary.byAmbiguityLevel && typeof summary.byAmbiguityLevel === "object");
  assert.ok(summary.byMissingSlot && typeof summary.byMissingSlot === "object");
  assert.ok(typeof summary.recommendedNextSprint === "string" && summary.recommendedNextSprint.length > 0);
});

test("acceptableResponseRate is at least 85% against the Sprint 18R + Sprint 17R clarification corpora", () => {
  const results = runClarificationResponseEvaluation(EVALUATION_CASES);
  const summary = summarizeClarificationResponseEvaluation(results);
  assert.ok(summary.acceptableResponseRate >= 85, `expected acceptableResponseRate >= 85, got ${summary.acceptableResponseRate}`);
});

test("safetyPassRate is exactly 100%", () => {
  const results = runClarificationResponseEvaluation(EVALUATION_CASES);
  const summary = summarizeClarificationResponseEvaluation(results);
  assert.equal(summary.safetyPassRate, 100, `expected safetyPassRate to be 100, got ${summary.safetyPassRate}`);
});

test("overQuestioningCount is 0", () => {
  const results = runClarificationResponseEvaluation(EVALUATION_CASES);
  const summary = summarizeClarificationResponseEvaluation(results);
  assert.equal(summary.overQuestioningCount, 0, `expected overQuestioningCount to be 0, got ${summary.overQuestioningCount}`);
});

test("recommendedNextSprint reflects the current, real evaluation state", () => {
  const results = runClarificationResponseEvaluation(EVALUATION_CASES);
  const summary = summarizeClarificationResponseEvaluation(results);
  const validRecommendations = new Set([
    "Sprint 23R — Clarification Response Quality Hardening",
    "Sprint 23R — Clarification Safety Hardening",
    "Sprint 23R — Decision Support Adapter Mapping Plan",
    "Sprint 23R — Controlled Shadow Capture Prep",
  ]);
  assert.ok(validRecommendations.has(summary.recommendedNextSprint));
});

// ─── Safety: source-level isolation checks ───────────────────────────────────────

const CLARIFICATION_DIR_FILES = [
  "../src/lib/playbook-engine/conversation/clarification/clarificationResponseTypes.ts",
  "../src/lib/playbook-engine/conversation/clarification/clarificationResponseAnalyzer.ts",
  "../src/lib/playbook-engine/conversation/clarification/clarificationResponseStrategy.ts",
  "../src/lib/playbook-engine/conversation/clarification/clarificationResponseEvaluation.ts",
  "../src/lib/playbook-engine/conversation/clarification/index.ts",
];

test("clarification module does not call fetch, a database, Supabase, or Gmail", () => {
  const forbidden = [
    /\bfetch\(/,
    /from\s+["'][^"']*supabase[^"']*["']/i,
    /from\s+["'][^"']*gmail[^"']*["']/i,
    /\bsendEmail\s*\(/i,
    /\bcreateTask\s*\(/i,
    /\bcreateRaidItem\s*\(/i,
    /\bcreatePlatformEvent\s*\(/i,
  ];
  for (const relativePath of CLARIFICATION_DIR_FILES) {
    const content = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const re of forbidden) {
      assert.doesNotMatch(content, re, `${relativePath} must not match ${re}`);
    }
  }
});

test("clarification module does not import router/composer/handlers/gateway", () => {
  const forbiddenImports = [
    /from\s+["'][^"']*brainRouter[^"']*["']/,
    /from\s+["'][^"']*responseComposer[^"']*["']/,
    /from\s+["'][^"']*\/handlers\/[^"']*["']/,
    /from\s+["'][^"']*conversationalBrainGateway[^"']*["']/,
  ];
  for (const relativePath of CLARIFICATION_DIR_FILES) {
    const content = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const re of forbiddenImports) {
      assert.doesNotMatch(content, re, `${relativePath} must not import from ${re}`);
    }
  }
});

test("clarification module does not modify or import the production classifier pattern files or the adapter", () => {
  const forbiddenImports = [
    /from\s+["'][^"']*intentClassifier\.rules["']/,
    /from\s+["'][^"']*intent-patterns["']/,
    /from\s+["'][^"']*intentCompatibilityAdapter["']/,
  ];
  for (const relativePath of CLARIFICATION_DIR_FILES) {
    const content = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const re of forbiddenImports) {
      assert.doesNotMatch(content, re, `${relativePath} must not import from ${re}`);
    }
  }
});

test("production conversation barrel (index.ts) does not export the clarification module", () => {
  const content = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(content, /clarification/);
});

test("clarification strategy never sets shouldExecuteAction/shouldCreateTask/shouldSendEmail/shouldWriteToDb to true", () => {
  for (const c of CLARIFICATION_RESPONSE_CASES) {
    const result = handleClarificationResponseCandidate({ input: c.input });
    assert.equal(result.safety.shouldExecuteAction, false);
    assert.equal(result.safety.shouldCreateTask, false);
    assert.equal(result.safety.shouldSendEmail, false);
    assert.equal(result.safety.shouldWriteToDb, false);
  }
});

test("clarification response evaluation never creates tasks, sends emails, or executes actions", () => {
  const results = runClarificationResponseEvaluation(EVALUATION_CASES);
  for (const result of results) {
    assert.equal(result.shouldExecuteAction, false);
    assert.equal(result.shouldCreateTask, false);
    assert.equal(result.shouldSendEmail, false);
    assert.equal(result.shouldWriteToDb, false);
  }
});

// ─── Regression: golden evaluation + prior sprints unchanged ────────────────────

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

test("Sprint 17R boundary review metrics are unchanged by this sprint", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(summary.totalCases, 70);
  assert.equal(summary.policyAlignedRate, 82.9, `expected policyAlignedRate to stay 82.9, got ${summary.policyAlignedRate}`);
  assert.equal(summary.currentSystemAcceptableRate, 84.3, `expected currentSystemAcceptableRate to stay 84.3, got ${summary.currentSystemAcceptableRate}`);
  assert.equal(summary.architectureGapCount, 10);
  assert.equal(summary.clarificationGapCount, 10);
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
  assert.equal(summary.enrichedDecisionSupportDetectionRate, 88.9);
  assert.equal(summary.recommendedIntegrationMode, "do_not_integrate");
});
