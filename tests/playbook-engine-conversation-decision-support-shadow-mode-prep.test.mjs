import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  prepareDecisionSupportShadowModeRun,
  evaluateDecisionSupportShadowModeRun,
  runDecisionSupportShadowModePrepEvaluation,
  summarizeDecisionSupportShadowModePrepEvaluation,
  explainDecisionSupportShadowModePrep,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts";
import { DECISION_SUPPORT_SHADOW_MODE_PREP_CASES } from "./fixtures/conversational-brain-decision-support-shadow-mode-prep-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

import {
  runDecisionSupportAdapterMappingPlan,
  summarizeDecisionSupportAdapterMappingPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlan.ts";
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
 * Sprint 24R — Decision Support Shadow Mode Prep.
 *
 * Tests the pure, offline, deterministic contract in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts`. This
 * module prepares the *contract* for a future shadow mode — it does not activate shadow mode, does
 * not connect decision_support to the router, and never returns/persists/executes anything, even
 * when a caller forces every `allow*`/`featureFlagEnabled` context flag to `true`. The regression
 * section re-runs the golden evaluation and every prior sprint's evaluator to confirm none of their
 * metrics changed.
 */

function runCase(fixtureCase) {
  return prepareDecisionSupportShadowModeRun(
    {
      id: fixtureCase.id,
      input: fixtureCase.input,
      projectName: fixtureCase.projectName,
      availableContext: fixtureCase.availableContext,
      desiredFutureRoute: fixtureCase.desiredFutureRoute,
      architectureCategory: fixtureCase.architectureCategory,
      targetKind: fixtureCase.targetKind,
    },
    fixtureCase.forcedContext ?? {},
  );
}

const FIXTURE_RUNS = new Map(DECISION_SUPPORT_SHADOW_MODE_PREP_CASES.map((c) => [c.id, runCase(c)]));

function fixtureCase(id) {
  const found = DECISION_SUPPORT_SHADOW_MODE_PREP_CASES.find((c) => c.id === id);
  assert.ok(found, `expected a fixture case with id "${id}"`);
  return found;
}

function fixtureRun(id) {
  const found = FIXTURE_RUNS.get(id);
  assert.ok(found, `expected a run for fixture case "${id}"`);
  return found;
}

const CORPUS_RESULTS = runDecisionSupportShadowModePrepEvaluation(DECISION_CLARIFICATION_CASES);
const CORPUS_SUMMARY = summarizeDecisionSupportShadowModePrepEvaluation(CORPUS_RESULTS);

// ─── Structure ───────────────────────────────────────────────────────────────────

test("prepareDecisionSupportShadowModeRun exists and is a function", () => {
  assert.equal(typeof prepareDecisionSupportShadowModeRun, "function");
});

test("evaluateDecisionSupportShadowModeRun exists and is a function", () => {
  assert.equal(typeof evaluateDecisionSupportShadowModeRun, "function");
});

test("runDecisionSupportShadowModePrepEvaluation exists and is a function", () => {
  assert.equal(typeof runDecisionSupportShadowModePrepEvaluation, "function");
});

test("summarizeDecisionSupportShadowModePrepEvaluation exists and is a function", () => {
  assert.equal(typeof summarizeDecisionSupportShadowModePrepEvaluation, "function");
});

test("explainDecisionSupportShadowModePrep exists and is a function", () => {
  assert.equal(typeof explainDecisionSupportShadowModePrep, "function");
});

test("strategy supported is hybrid_shadow_then_clarify", () => {
  const run = fixtureRun("sm-01");
  assert.equal(run.strategy, "hybrid_shadow_then_clarify");
});

test("result.kind is decision_support_shadow_mode_run", () => {
  const run = fixtureRun("sm-01");
  assert.equal(run.kind, "decision_support_shadow_mode_run");
});

test("prepareDecisionSupportShadowModeRun throws on empty input", () => {
  assert.throws(() => prepareDecisionSupportShadowModeRun({ input: "" }));
  assert.throws(() => prepareDecisionSupportShadowModeRun({ input: "   " }));
});

// ─── Default-off behavior ────────────────────────────────────────────────────────

test("every run is isDefaultOff and disallows every side effect regardless of branch", () => {
  for (const run of FIXTURE_RUNS.values()) {
    assert.equal(run.isDefaultOff, true);
    assert.equal(run.userVisibleOutputAllowed, false);
    assert.equal(run.persistenceAllowed, false);
    assert.equal(run.executionAllowed, false);
    assert.equal(run.productionRouteChangeAllowed, false);
    assert.equal(run.shouldReturnCandidateToUser, false);
    assert.equal(run.shouldPersistShadowResult, false);
    assert.equal(run.shouldExecuteAction, false);
    assert.equal(run.shouldSendEmail, false);
    assert.equal(run.shouldCreateTask, false);
    assert.equal(run.shouldWriteToDb, false);
  }
});

// ─── Decision support behavior ───────────────────────────────────────────────────

test("decision_support medium/high confidence generates a decision_support_candidate", () => {
  for (const id of ["sm-01", "sm-02", "sm-03", "sm-04", "sm-05", "sm-06", "sm-07"]) {
    const run = fixtureRun(id);
    assert.equal(run.status, "shadow_candidate_generated", `case ${id}`);
    assert.equal(run.candidateKind, "decision_support_candidate", `case ${id}`);
    assert.ok(run.decisionCandidate, `case ${id} should have a decisionCandidate`);
    assert.ok(["medium", "high"].includes(run.decisionCandidate.recommendation.confidence), `case ${id}`);
  }
});

test("decision_support low confidence generates a clarification_response_candidate instead", () => {
  for (const id of ["sm-08", "sm-09", "sm-10", "sm-27"]) {
    const run = fixtureRun(id);
    assert.equal(run.status, "clarification_candidate_generated", `case ${id}`);
    assert.equal(run.candidateKind, "clarification_response_candidate", `case ${id}`);
    assert.ok(run.clarificationCandidate, `case ${id} should have a clarificationCandidate`);
    assert.equal(run.decisionCandidate?.recommendation.confidence, "low", `case ${id}`);
  }
});

test("decision candidate includes a recommendation and passes candidate_handler_safety", () => {
  const run = fixtureRun("sm-01");
  assert.ok(run.decisionCandidate.recommendation.recommendedPath.length > 0);
  const gate = run.gateResults.find((g) => g.gate === "candidate_handler_safety");
  assert.equal(gate.passed, true);
});

test("clarification fallback includes a primaryQuestion and passes clarification_safety", () => {
  const run = fixtureRun("sm-08");
  assert.ok(run.clarificationCandidate.primaryQuestion.question.length > 0);
  const gate = run.gateResults.find((g) => g.gate === "clarification_safety");
  assert.equal(gate.passed, true);
});

test("no decision or clarification candidate is ever shown to the user", () => {
  for (const run of FIXTURE_RUNS.values()) {
    assert.equal(run.shouldReturnCandidateToUser, false);
  }
});

// ─── Clarification behavior ──────────────────────────────────────────────────────

test("needs_clarification cases generate a clarification_response_candidate", () => {
  for (const id of ["sm-11", "sm-12", "sm-13", "sm-14", "sm-28"]) {
    const run = fixtureRun(id);
    assert.equal(run.status, "clarification_candidate_generated", `case ${id}`);
    assert.equal(run.candidateKind, "clarification_response_candidate", `case ${id}`);
  }
});

test("clarification response requires a user reply and never executes/creates/sends/writes", () => {
  const run = fixtureRun("sm-11");
  assert.equal(run.clarificationCandidate.safety.requiresUserReply, true);
  assert.equal(run.shouldExecuteAction, false);
  assert.equal(run.shouldCreateTask, false);
  assert.equal(run.shouldSendEmail, false);
  assert.equal(run.shouldWriteToDb, false);
});

// ─── Existing route preservation ─────────────────────────────────────────────────

test("existing_route_should_win cases generate existing_route_preserved with no candidates", () => {
  for (const id of ["sm-15", "sm-16", "sm-17"]) {
    const run = fixtureRun(id);
    assert.equal(run.status, "existing_route_preserved", `case ${id}`);
    assert.equal(run.candidateKind, "existing_route_preserved", `case ${id}`);
    assert.equal(run.decisionCandidate, undefined, `case ${id}`);
    assert.equal(run.clarificationCandidate, undefined, `case ${id}`);
    assert.equal(run.preservesExistingRoute, true, `case ${id}`);
  }
});

test("existing-route preservation wins even when desiredFutureRoute is decision_support", () => {
  const run = fixtureRun("sm-17");
  assert.equal(run.status, "existing_route_preserved");
});

test("same input with different fixture metadata produces different outcomes (redactame un correo)", () => {
  const existingRoute = fixtureRun("sm-15");
  const notApplicable = fixtureRun("sm-20");
  assert.equal(existingRoute.input, notApplicable.input);
  assert.equal(existingRoute.status, "existing_route_preserved");
  assert.equal(notApplicable.status, "not_applicable");
});

test("same input with different fixture metadata produces different outcomes (creá una tarea)", () => {
  const existingRoute = fixtureRun("sm-16");
  const notApplicable = fixtureRun("sm-21");
  assert.equal(existingRoute.input, notApplicable.input);
  assert.equal(existingRoute.status, "existing_route_preserved");
  assert.equal(notApplicable.status, "not_applicable");
});

// ─── Not-applicable behavior ──────────────────────────────────────────────────────

test("non decision / non clarification / non existing-route cases produce not_applicable", () => {
  for (const id of ["sm-18", "sm-19", "sm-20", "sm-21"]) {
    const run = fixtureRun(id);
    assert.equal(run.status, "not_applicable", `case ${id}`);
    assert.equal(run.candidateKind, "none", `case ${id}`);
    assert.equal(run.decisionCandidate, undefined, `case ${id}`);
    assert.equal(run.clarificationCandidate, undefined, `case ${id}`);
  }
});

// ─── Safety gates ─────────────────────────────────────────────────────────────────

test("all normal (non-forced-context) fixture cases pass every blocking gate", () => {
  for (const c of DECISION_SUPPORT_SHADOW_MODE_PREP_CASES) {
    if (c.forcedContext) continue;
    const run = fixtureRun(c.id);
    assert.equal(run.allBlockingGatesPassed, true, `case ${c.id}`);
  }
});

const FORCED_GATE_CASE_IDS = ["sm-22", "sm-23", "sm-24", "sm-25", "sm-26"];

test("forcing featureFlagEnabled true blocks the run", () => {
  const run = fixtureRun("sm-22");
  assert.equal(run.status, "blocked_by_safety_gate");
  const gate = run.gateResults.find((g) => g.gate === "default_off");
  assert.equal(gate.passed, false);
});

test("forcing allowUserVisibleOutput true blocks the run", () => {
  const run = fixtureRun("sm-23");
  assert.equal(run.status, "blocked_by_safety_gate");
  const gate = run.gateResults.find((g) => g.gate === "no_user_visible_output");
  assert.equal(gate.passed, false);
});

test("forcing allowPersistence true blocks the run", () => {
  const run = fixtureRun("sm-24");
  assert.equal(run.status, "blocked_by_safety_gate");
  const gate = run.gateResults.find((g) => g.gate === "no_persistence");
  assert.equal(gate.passed, false);
});

test("forcing allowExecution true blocks the run", () => {
  const run = fixtureRun("sm-25");
  assert.equal(run.status, "blocked_by_safety_gate");
  const gate = run.gateResults.find((g) => g.gate === "no_execution");
  assert.equal(gate.passed, false);
});

test("forcing allowProductionRouteChange true blocks the run", () => {
  const run = fixtureRun("sm-26");
  assert.equal(run.status, "blocked_by_safety_gate");
  const gate = run.gateResults.find((g) => g.gate === "no_production_route");
  assert.equal(gate.passed, false);
});

test("blocked runs still do not return/persist/execute/send/create/write anything", () => {
  for (const id of FORCED_GATE_CASE_IDS) {
    const run = fixtureRun(id);
    assert.equal(run.candidateKind, "none", `case ${id}`);
    assert.equal(run.decisionCandidate, undefined, `case ${id}`);
    assert.equal(run.clarificationCandidate, undefined, `case ${id}`);
    assert.equal(run.shouldReturnCandidateToUser, false, `case ${id}`);
    assert.equal(run.shouldPersistShadowResult, false, `case ${id}`);
    assert.equal(run.shouldExecuteAction, false, `case ${id}`);
    assert.equal(run.shouldSendEmail, false, `case ${id}`);
    assert.equal(run.shouldCreateTask, false, `case ${id}`);
    assert.equal(run.shouldWriteToDb, false, `case ${id}`);
  }
});

test("every fixture case matches its expected status and candidateKind", () => {
  for (const c of DECISION_SUPPORT_SHADOW_MODE_PREP_CASES) {
    const run = fixtureRun(c.id);
    assert.equal(run.status, c.expectedStatus, `case ${c.id}`);
    assert.equal(run.candidateKind, c.expectedCandidateKind, `case ${c.id}`);
    assert.equal(run.shouldReturnCandidateToUser, c.expectedShouldReturnCandidateToUser, `case ${c.id}`);
    assert.equal(run.shouldPersistShadowResult, c.expectedShouldPersistShadowResult, `case ${c.id}`);
    assert.equal(run.shouldExecuteAction, c.expectedShouldExecuteAction, `case ${c.id}`);
    if (c.expectedPreservesExistingRoute !== undefined) {
      assert.equal(run.preservesExistingRoute, c.expectedPreservesExistingRoute, `case ${c.id}`);
    }
  }
});

// ─── Evaluation ───────────────────────────────────────────────────────────────────

test("evaluator processes the Sprint 18R corpus", () => {
  assert.equal(CORPUS_RESULTS.length, DECISION_CLARIFICATION_CASES.length);
});

test("summary.totalCases matches corpus length", () => {
  assert.equal(CORPUS_SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(CORPUS_SUMMARY.totalCases, 79);
});

test("summary.acceptableShadowPrepRunRate is 100%", () => {
  assert.equal(CORPUS_SUMMARY.acceptableShadowPrepRunRate, 100);
});

test("summary.allBlockingGatesPassedRate is 100%", () => {
  assert.equal(CORPUS_SUMMARY.allBlockingGatesPassedRate, 100);
});

test("summary side-effect counts are all zero", () => {
  assert.equal(CORPUS_SUMMARY.shouldReturnCandidateToUserCount, 0);
  assert.equal(CORPUS_SUMMARY.shouldPersistShadowResultCount, 0);
  assert.equal(CORPUS_SUMMARY.shouldExecuteActionCount, 0);
  assert.equal(CORPUS_SUMMARY.shouldSendEmailCount, 0);
  assert.equal(CORPUS_SUMMARY.shouldCreateTaskCount, 0);
  assert.equal(CORPUS_SUMMARY.shouldWriteToDbCount, 0);
});

test("summary.existingRoutePreservedCount is 10 (matches the Sprint 18R corpus's existing_route_should_win cases)", () => {
  assert.equal(CORPUS_SUMMARY.existingRoutePreservedCount, 10);
});

test("summary.decisionCandidateGeneratedCount and clarificationCandidateGeneratedCount are both > 0", () => {
  assert.ok(CORPUS_SUMMARY.decisionCandidateGeneratedCount > 0);
  assert.ok(CORPUS_SUMMARY.clarificationCandidateGeneratedCount > 0);
});

test("summary.blockedBySafetyGateCount is 0 for the unmodified Sprint 18R corpus", () => {
  assert.equal(CORPUS_SUMMARY.blockedBySafetyGateCount, 0);
});

test("summary.recommendedNextSprint is 'Sprint 25R — Decision Support Shadow Capture Harness' given clean metrics", () => {
  assert.equal(CORPUS_SUMMARY.recommendedNextSprint, "Sprint 25R — Decision Support Shadow Capture Harness");
});

test("summarizeDecisionSupportShadowModePrepEvaluation over the shadow-mode-prep fixture corpus reports a non-zero blockedBySafetyGateCount", () => {
  const fixtureResults = DECISION_SUPPORT_SHADOW_MODE_PREP_CASES.map((c) => evaluateDecisionSupportShadowModeRun(fixtureRun(c.id)));
  const summary = summarizeDecisionSupportShadowModePrepEvaluation(fixtureResults);
  assert.equal(summary.totalCases, DECISION_SUPPORT_SHADOW_MODE_PREP_CASES.length);
  assert.equal(summary.blockedBySafetyGateCount, FORCED_GATE_CASE_IDS.length);
  assert.ok(summary.acceptableShadowPrepRunRate < 100, "forced-gate-failure cases should not count as acceptable");
  assert.equal(summary.recommendedNextSprint, "Sprint 25R — Shadow Mode Safety Hardening");
});

// ─── Safety: no production imports ────────────────────────────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts", import.meta.url),
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
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts", import.meta.url),
    "utf8",
  );
  const imports = importLines(source);
  assert.doesNotMatch(imports, /intentCompatibilityAdapter/);
  assert.doesNotMatch(imports, /intentClassifier\.rules/);
  assert.doesNotMatch(imports, /intent-patterns/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportShadowModePrep/);
});

test("no feature flag is ever activated by this sprint (source has no feature-flag read)", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /growthbook/i);
});

// ─── Explain ──────────────────────────────────────────────────────────────────────

test("explainDecisionSupportShadowModePrep documents purpose, non-goals, strategy, gates, and the Sprint 25R path", () => {
  const explain = explainDecisionSupportShadowModePrep();
  assert.ok(explain.purpose.length > 0);
  assert.ok(explain.nonGoals.length > 0);
  assert.equal(explain.strategy, "hybrid_shadow_then_clarify");
  assert.ok(explain.defaultOffPolicy.length > 0);
  assert.ok(explain.safetyGates.length > 0);
  assert.ok(explain.existingRoutePreservation.length > 0);
  assert.ok(explain.whyUserVisibleOutputIsForbidden.length > 0);
  assert.ok(explain.whyPersistenceIsForbidden.length > 0);
  assert.ok(explain.whyFeatureFlagIsNotImplementedYet.length > 0);
  assert.ok(explain.whyProductionIsNotChanged.length > 0);
  assert.ok(explain.expectedSprint25Path.length > 0);
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
  assert.equal(summary.policyAlignedRate, 82.9);
  assert.equal(summary.currentSystemAcceptableRate, 84.3);
});

test("Sprint 18R architecture review metrics are unchanged by this sprint", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.currentSafeMappingRate, 84.8);
  assert.equal(summary.futureRouteAlreadySupportedRate, 84.8);
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

test("Sprint 23R adapter mapping plan metrics are unchanged by this sprint", () => {
  const results = runDecisionSupportAdapterMappingPlan(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionSupportAdapterMappingPlan(results);
  assert.equal(summary.recommendedSprint24Strategy, "hybrid_shadow_then_clarify");
  assert.equal(summary.recommendedNextSprint, "Sprint 24R — Decision Support Shadow Mode Prep");
  const hybrid = summary.strategySummaries.hybrid_shadow_then_clarify;
  assert.equal(hybrid.safeOutcomeRate, 100);
  assert.equal(hybrid.riskyOutcomeCount, 0);
  assert.equal(hybrid.criticalRiskCount, 0);
  assert.equal(hybrid.preservesExistingRouteRate, 100);
  assert.equal(hybrid.candidateHandlerSafeCount, 45);
  assert.equal(hybrid.clarificationSafeCount, 51);
});
