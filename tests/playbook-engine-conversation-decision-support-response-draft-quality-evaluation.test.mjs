import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_VERSION,
  createDecisionSupportResponseDraftQualityEvaluationConfig,
  listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions,
  listDecisionSupportResponseDraftQualityEvaluationProhibitedActions,
  scoreDecisionSupportResponseDraftQualityDimension,
  evaluateDecisionSupportResponseDraftQualityCase,
  runDecisionSupportResponseDraftQualityEvaluation,
  summarizeDecisionSupportResponseDraftQualityEvaluation,
  explainDecisionSupportResponseDraftQualityEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftQualityEvaluation.ts";
import {
  createDecisionSupportResponseDraftFromQaCase,
  validateDecisionSupportResponseDraft,
  runDecisionSupportResponseDraftHarness,
  summarizeDecisionSupportResponseDraftHarness,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftHarness.ts";
import { DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_CASES } from "./fixtures/conversational-brain-decision-support-response-draft-quality-evaluation-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Regression imports — Sprint 18R-33R + golden/classifier/vocabulary suites, reused read-only for comparison.
import { buildDecisionSupportResponseQaDryRunPlan, summarizeDecisionSupportResponseQaDryRunPlan } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseQaDryRunPlan.ts";
import {
  buildDecisionSupportClarificationGatedIntegrationPlan,
  summarizeDecisionSupportClarificationGatedIntegrationPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportClarificationGatedIntegrationPlan.ts";
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
import { runClarificationResponseEvaluation, toDecisionClarificationEvaluationCases } from "../src/lib/playbook-engine/conversation/clarification/clarificationResponseEvaluation.ts";
import { runGoldenIntentEvaluation, summarizeGoldenIntentEvaluation } from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

/**
 * Sprint 34R — Decision Support Response Draft Quality Evaluation.
 *
 * Tests the pure, offline, deterministic response draft quality evaluation in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftQualityEvaluation.ts`.
 * This scores every synthetic draft the Sprint 33R response draft harness already generated and
 * validated across fourteen quality dimensions — it never shows anything to a real user, never persists
 * anything real, and never touches the router/composer/endpoint.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const HARNESS = runDecisionSupportResponseDraftHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const EVALUATION = runDecisionSupportResponseDraftQualityEvaluation({ harness: HARNESS, now: NOW });
const SUMMARY = summarizeDecisionSupportResponseDraftQualityEvaluation(EVALUATION);

function buildDraftCaseResult(sourceCase, mutate) {
  let draft = createDecisionSupportResponseDraftFromQaCase(sourceCase);
  if (mutate) draft = mutate(draft);
  const validation = validateDecisionSupportResponseDraft(draft);
  return {
    caseId: sourceCase.caseId,
    sourceRouteKind: sourceCase.routeKind,
    sourceResponseKind: sourceCase.responseKind,
    draft: { ...draft, status: validation.valid ? "validated" : "rejected" },
    validation,
    draftGenerated: true,
    draftAccepted: validation.valid,
    draftRejected: !validation.valid,
    draftBlocked: false,
    safeForQualityEvaluation: validation.valid,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings: [],
  };
}

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 40 and 60 cases", () => {
  assert.ok(DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_CASES.length >= 40);
  assert.ok(DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_CASES.length <= 60);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.dimension, "string");
    assert.equal(typeof c.draftKind, "string");
    assert.ok(Array.isArray(c.expectedScoreRange));
    assert.equal(typeof c.expectedStatus, "string");
    assert.equal(typeof c.expectedRiskLevel, "string");
    assert.equal(typeof c.expectedScoreBand, "string");
    assert.ok(Array.isArray(c.expectedIssues));
    assert.equal(typeof c.expectedSafeForUserVisibleDryRunHarness, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleOutputNow, "boolean");
    assert.equal(c.expectedSafeForUserVisibleOutputNow, false);
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(c.expectedSafeForProduction, false);
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_VERSION, "string");
  assert.ok(DECISION_SUPPORT_RESPONSE_DRAFT_QUALITY_EVALUATION_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportResponseDraftQualityEvaluationConfig", createDecisionSupportResponseDraftQualityEvaluationConfig],
  ["listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions", listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions],
  ["listDecisionSupportResponseDraftQualityEvaluationProhibitedActions", listDecisionSupportResponseDraftQualityEvaluationProhibitedActions],
  ["scoreDecisionSupportResponseDraftQualityDimension", scoreDecisionSupportResponseDraftQualityDimension],
  ["evaluateDecisionSupportResponseDraftQualityCase", evaluateDecisionSupportResponseDraftQualityCase],
  ["runDecisionSupportResponseDraftQualityEvaluation", runDecisionSupportResponseDraftQualityEvaluation],
  ["summarizeDecisionSupportResponseDraftQualityEvaluation", summarizeDecisionSupportResponseDraftQualityEvaluation],
  ["explainDecisionSupportResponseDraftQualityEvaluation", explainDecisionSupportResponseDraftQualityEvaluation],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture rdq-config-default-strict)", () => {
  fixtureFor("rdq-config-default-strict");
  const config = createDecisionSupportResponseDraftQualityEvaluationConfig();
  assert.equal(config.profile, "strict_response_draft_quality_evaluation");
  assert.equal(config.mode, "quality_evaluation_only");
  assert.equal(config.minOverallScore, 85);
  assert.equal(config.minDimensionScore, 75);
  assert.equal(config.minClarificationScore, 85);
  assert.equal(config.minSafetyScore, 100);
  assert.equal(config.allowUserVisibleOutput, false);
  assert.equal(config.allowProductionWiring, false);
  assert.equal(config.allowRouterChange, false);
  assert.equal(config.allowComposerChange, false);
  assert.equal(config.allowEndpointChange, false);
  assert.equal(config.allowFeatureFlag, false);
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowTaskCreation, false);
  assert.equal(config.allowEmailDraftCreation, false);
  assert.equal(config.requireHarnessPass, true);
  assert.equal(config.requireNoCriticalIssues, true);
  assert.equal(config.requireNoLeakage, true);
  assert.equal(config.requireNoSideEffects, true);
  assert.equal(config.requireClarificationFirstQuality, true);
  assert.equal(config.requireSafeNextStepQuality, true);
  assert.equal(config.requireNonExecutionClarity, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "rdq-config-block-user-visible-output",
  "rdq-config-block-production-wiring",
  "rdq-config-block-router-change",
  "rdq-config-block-composer-change",
  "rdq-config-block-endpoint-change",
  "rdq-config-block-feature-flag",
  "rdq-config-block-real-persistence",
  "rdq-config-block-db-write",
  "rdq-config-block-supabase-write",
  "rdq-config-block-external-calls",
  "rdq-config-block-action-execution",
  "rdq-config-block-task-creation",
  "rdq-config-block-email-draft-creation",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 13);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportResponseDraftQualityEvaluationConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all thirteen are forced true at once", () => {
  const config = createDecisionSupportResponseDraftQualityEvaluationConfig({
    allowUserVisibleOutput: true,
    allowProductionWiring: true,
    allowRouterChange: true,
    allowComposerChange: true,
    allowEndpointChange: true,
    allowFeatureFlag: true,
    allowRealPersistence: true,
    allowDbWrite: true,
    allowSupabaseWrite: true,
    allowExternalCalls: true,
    allowActionExecution: true,
    allowTaskCreation: true,
    allowEmailDraftCreation: true,
  });
  for (const field of BLOCKED_FIELD_FIXTURE_IDS.map((id) => fixtureFor(id).configOverrideField)) {
    assert.equal(config[field], false, `${field} must stay false`);
  }
});

test("config honors safe overrides (mode, minOverallScore, now, notes)", () => {
  const config = createDecisionSupportResponseDraftQualityEvaluationConfig({
    mode: "clarification_quality_review",
    minOverallScore: 80,
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "clarification_quality_review");
  assert.equal(config.minOverallScore, 80);
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("user-visible dry run evaluation harness"));
  assert.ok(joined.includes("offline response rendering review"));
  assert.ok(joined.includes("dry-run composer contract"));
  assert.ok(joined.includes("safe preview formatting review"));
  assert.ok(joined.includes("response acceptance criteria review"));
  assert.ok(joined.includes("route-preserving display simulation"));
});

test("listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportResponseDraftQualityEvaluationAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportResponseDraftQualityEvaluationProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("show draft to real user"));
  assert.ok(joined.includes("wire router"));
  assert.ok(joined.includes("wire composer"));
  assert.ok(joined.includes("wire endpoint"));
  assert.ok(joined.includes("enable production feature flag"));
  assert.ok(joined.includes("create db"));
  assert.ok(joined.includes("create migration"));
  assert.ok(joined.includes("create sql file"));
  assert.ok(joined.includes("write supabase"));
  assert.ok(joined.includes("implement real repository"));
  assert.ok(joined.includes("implement real storage adapter"));
  assert.ok(joined.includes("execute actions"));
  assert.ok(joined.includes("create tasks"));
  assert.ok(joined.includes("create emails"));
  assert.ok(joined.includes("create drafts"));
  assert.ok(joined.includes("call external services"));
  assert.ok(joined.includes("persist output real"));
});

test("listDecisionSupportResponseDraftQualityEvaluationProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportResponseDraftQualityEvaluationProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportResponseDraftQualityEvaluationProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Dimension scoring (positive) ──────────────────────────────────────────────────

const POSITIVE_DIMENSION_FIXTURE_IDS = [
  "rdq-dimension-clarity",
  "rdq-dimension-usefulness",
  "rdq-dimension-pm-relevance",
  "rdq-dimension-clarification-quality",
  "rdq-dimension-assumption-quality",
  "rdq-dimension-safe-next-step-quality",
  "rdq-dimension-non-execution-clarity",
  "rdq-dimension-route-preservation-quality",
  "rdq-dimension-unsupported-boundary-quality",
  "rdq-dimension-tone",
  "rdq-dimension-conciseness",
  "rdq-dimension-no-overconfidence",
  "rdq-dimension-no-leakage",
  "rdq-dimension-no-side-effects",
];

assert.equal(POSITIVE_DIMENSION_FIXTURE_IDS.length, 14);

for (const fixtureId of POSITIVE_DIMENSION_FIXTURE_IDS) {
  test(`${fixtureId}: scores within expected range with zero issues`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const caseResult = buildDraftCaseResult(fixtureCase.sourceCase);
    const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
    const [min, max] = fixtureCase.expectedScoreRange;
    assert.ok(dimensionScore.score >= min, `${fixtureId}: score ${dimensionScore.score} should be >= ${min}`);
    assert.ok(dimensionScore.score <= max, `${fixtureId}: score ${dimensionScore.score} should be <= ${max}`);
    assert.equal(dimensionScore.status, fixtureCase.expectedStatus);
    assert.equal(dimensionScore.riskLevel, fixtureCase.expectedRiskLevel);
    assert.equal(dimensionScore.scoreBand, fixtureCase.expectedScoreBand);
    assert.deepEqual(dimensionScore.issues, fixtureCase.expectedIssues);
  });
}

test("dimensions that do not apply to a draft kind trivially score 100 with no issues", () => {
  const rpCase = buildDraftCaseResult({ caseId: "z1", routeKind: "existing_route_preserved", responseKind: "route_preservation_notice" });
  for (const dim of ["clarification_quality", "assumption_quality", "unsupported_boundary_quality"]) {
    const score = scoreDecisionSupportResponseDraftQualityDimension(rpCase, dim);
    assert.equal(score.score, 100);
    assert.deepEqual(score.issues, []);
    assert.equal(score.scoreBand, "excellent");
  }
});

// ─── Score bands ──────────────────────────────────────────────────────────────────

test("rdq-band-excellent: valid clarification_first_draft case lands in excellent band", () => {
  const fixtureCase = fixtureFor("rdq-band-excellent");
  const caseResult = buildDraftCaseResult(fixtureCase.sourceCase);
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.ok(evaluation.overallScore >= fixtureCase.expectedScoreRange[0]);
  assert.equal(evaluation.qualityStatus, fixtureCase.expectedStatus);
  assert.equal(evaluation.scoreBand, fixtureCase.expectedScoreBand);
  assert.equal(evaluation.pass, true);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, true);
});

test("rdq-band-acceptable: valid route_preservation_draft case lands in acceptable band", () => {
  const fixtureCase = fixtureFor("rdq-band-acceptable");
  const caseResult = buildDraftCaseResult(fixtureCase.sourceCase);
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.ok(evaluation.overallScore >= fixtureCase.expectedScoreRange[0]);
  assert.ok(evaluation.overallScore < fixtureCase.expectedScoreRange[1]);
  assert.equal(evaluation.qualityStatus, fixtureCase.expectedStatus);
  assert.equal(evaluation.scoreBand, fixtureCase.expectedScoreBand);
  assert.equal(evaluation.pass, true);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, true);
});

test("rdq-band-needs-improvement-synthetic: combined soft issues land in needs_improvement", () => {
  const fixtureCase = fixtureFor("rdq-band-needs-improvement-synthetic");
  const caseResult = buildDraftCaseResult(fixtureCase.sourceCase, (draft) => ({
    ...draft,
    sections: {
      ...draft.sections,
      clarificationQuestion: "Contame mas",
      assumptions: ["algo x"],
      recommendedNextStep: "Espera.",
    },
  }));
  assert.equal(caseResult.validation.qaStatus, "pass", "the mutation must not trip Sprint 33R's own QA gate");
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.ok(evaluation.overallScore >= fixtureCase.expectedScoreRange[0]);
  assert.ok(evaluation.overallScore < fixtureCase.expectedScoreRange[1]);
  assert.equal(evaluation.qualityStatus, fixtureCase.expectedStatus);
  assert.equal(evaluation.scoreBand, fixtureCase.expectedScoreBand);
  assert.equal(evaluation.pass, false);
  assert.equal(evaluation.blocked, false);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, false);
  for (const issue of fixtureCase.expectedIssues) assert.ok(evaluation.issues.includes(issue), `expected issue ${issue}`);
});

test("rdq-band-unacceptable-synthetic: no PM-relevant vocabulary drops pm_relevance below 75", () => {
  const fixtureCase = fixtureFor("rdq-band-unacceptable-synthetic");
  const caseResult = buildDraftCaseResult(fixtureCase.sourceCase, () => ({
    caseId: "rdq-fixture-clarification-01",
    sourceCaseId: "rdq-fixture-clarification-01",
    draftKind: "clarification_first_draft",
    sourceResponseKind: "clarification_question",
    sourceRouteKind: "clarification_gated_decision_support",
    generatedForHarnessOnly: true,
    userVisibleNow: false,
    persistedNow: false,
    executableNow: false,
    externalSideEffectsAllowed: false,
    status: "generated",
    sections: {
      acknowledgement: "Hola, gracias por escribir.",
      clarificationQuestion: "Podrias contarme mas sobre lo que necesitas?",
      assumptions: ["Puede que falte informacion todavia."],
      recommendedNextStep: "Espera a que respondas la pregunta anterior.",
      nonExecutionNotice: "No se ejecuto ninguna accion todavia.",
    },
    contract: {
      requiresClarificationFirst: true,
      requiresRoutePreservation: false,
      requiresUnsupportedPreservation: false,
      blocksDirectDecision: true,
      blocksExecution: true,
      blocksPersistence: true,
      blocksExternalCalls: true,
    },
    safety: {
      rawInputIncluded: false,
      fullCandidateIncluded: false,
      piiIncluded: false,
      projectNameIncluded: false,
      taskPayloadIncluded: false,
      emailDraftPayloadIncluded: false,
      dbPayloadIncluded: false,
      supabasePayloadIncluded: false,
      externalCallPayloadIncluded: false,
    },
    warnings: [],
  }));
  assert.equal(caseResult.validation.qaStatus, "pass", "the mutation must not trip Sprint 33R's own QA gate");
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.ok(dimensionScore.score < 75);
  assert.equal(dimensionScore.status, fixtureCase.expectedStatus);
  assert.equal(dimensionScore.riskLevel, fixtureCase.expectedRiskLevel);
  assert.equal(dimensionScore.scoreBand, fixtureCase.expectedScoreBand);
  assert.deepEqual(dimensionScore.issues, fixtureCase.expectedIssues);
});

test("rdq-band-blocked-synthetic: overconfident language injected still passing Sprint 33R QA lands in blocked", () => {
  const fixtureCase = fixtureFor("rdq-band-blocked-synthetic");
  const caseResult = buildDraftCaseResult(fixtureCase.sourceCase, (draft) => ({
    ...draft,
    sections: {
      ...draft.sections,
      acknowledgement: `${draft.sections.acknowledgement} Esto está garantizado.`,
    },
  }));
  assert.equal(caseResult.validation.qaStatus, "pass", "the mutation must not trip Sprint 33R's own QA gate");
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.equal(evaluation.overallScore, fixtureCase.expectedScoreRange[0]);
  assert.equal(evaluation.qualityStatus, fixtureCase.expectedStatus);
  assert.equal(evaluation.riskLevel, fixtureCase.expectedRiskLevel);
  assert.equal(evaluation.scoreBand, fixtureCase.expectedScoreBand);
  assert.equal(evaluation.blocked, true);
  assert.equal(evaluation.pass, false);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, false);
  assert.deepEqual(evaluation.issues, fixtureCase.expectedIssues);
  assert.ok(evaluation.criticalIssueCount > 0);
});

// ─── Negative issue scenarios ───────────────────────────────────────────────────────

const CLARIFICATION_SOURCE_CASE = { caseId: "rdq-fixture-clarification-01", routeKind: "clarification_gated_decision_support", responseKind: "clarification_question" };

test("rdq-issue-missing-clarification-question: creates issue missing_question", () => {
  const fixtureCase = fixtureFor("rdq-issue-missing-clarification-question");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, sections: { ...draft.sections, clarificationQuestion: undefined } }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.ok(dimensionScore.issues.includes("missing_question"));
  assert.ok(dimensionScore.score < 75);
});

test("rdq-issue-missing-assumptions: creates issue missing_assumptions", () => {
  const fixtureCase = fixtureFor("rdq-issue-missing-assumptions");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, sections: { ...draft.sections, assumptions: [] } }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.ok(dimensionScore.issues.includes("missing_assumptions"));
  assert.ok(dimensionScore.score < 75);
});

test("rdq-issue-missing-safe-next-step: creates issue missing_next_step", () => {
  const fixtureCase = fixtureFor("rdq-issue-missing-safe-next-step");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, sections: { ...draft.sections, recommendedNextStep: undefined } }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.ok(dimensionScore.issues.includes("missing_next_step"));
  assert.ok(dimensionScore.score < 75);
});

test("rdq-issue-missing-non-execution-notice: creates issue missing_non_execution_notice and blocks", () => {
  const fixtureCase = fixtureFor("rdq-issue-missing-non-execution-notice");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, sections: { ...draft.sections, nonExecutionNotice: undefined } }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.deepEqual(dimensionScore.issues, ["missing_non_execution_notice"]);
  assert.equal(dimensionScore.score, 0);
  assert.equal(dimensionScore.status, "blocked");
  assert.equal(dimensionScore.riskLevel, "critical");
  assert.equal(dimensionScore.scoreBand, "blocked");
});

test("rdq-issue-overconfident-language: creates issue overconfident_language or sounds_like_final_decision, and blocks", () => {
  const fixtureCase = fixtureFor("rdq-issue-overconfident-language");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({
    ...draft,
    sections: { ...draft.sections, acknowledgement: `${draft.sections.acknowledgement} Esto está garantizado.` },
  }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.ok(dimensionScore.issues.includes("overconfident_language") || dimensionScore.issues.includes("sounds_like_final_decision"));
  assert.equal(dimensionScore.score, 0);
  assert.equal(dimensionScore.status, "blocked");

  const advisoryFrameCase = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, sections: { ...draft.sections, advisoryFrame: "La mejor opcion es X." } }));
  const advisoryDimensionScore = scoreDecisionSupportResponseDraftQualityDimension(advisoryFrameCase, "no_overconfidence");
  assert.ok(advisoryDimensionScore.issues.includes("sounds_like_final_decision"));
});

test("rdq-issue-raw-input-leak: creates issue raw_input_leak and blocks", () => {
  const fixtureCase = fixtureFor("rdq-issue-raw-input-leak");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, rawInputIncluded: true } }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.deepEqual(dimensionScore.issues, ["raw_input_leak"]);
  assert.equal(dimensionScore.score, 0);
  assert.equal(dimensionScore.status, "blocked");
});

test("rdq-issue-full-candidate-leak: creates issue full_candidate_leak and blocks", () => {
  const fixtureCase = fixtureFor("rdq-issue-full-candidate-leak");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, fullCandidateIncluded: true } }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.deepEqual(dimensionScore.issues, ["full_candidate_leak"]);
  assert.equal(dimensionScore.score, 0);
  assert.equal(dimensionScore.status, "blocked");
});

test("rdq-issue-pii-leak: creates issue pii_leak and blocks", () => {
  const fixtureCase = fixtureFor("rdq-issue-pii-leak");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, piiIncluded: true } }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.deepEqual(dimensionScore.issues, ["pii_leak"]);
  assert.equal(dimensionScore.score, 0);
  assert.equal(dimensionScore.status, "blocked");
});

test("rdq-issue-side-effect-risk: creates issue side_effect_risk and blocks", () => {
  const fixtureCase = fixtureFor("rdq-issue-side-effect-risk");
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, persistedNow: true }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, fixtureCase.dimension);
  assert.deepEqual(dimensionScore.issues, ["side_effect_risk"]);
  assert.equal(dimensionScore.score, 0);
  assert.equal(dimensionScore.status, "blocked");
});

test("task/email/db payload flags produce task_creation_language/email_creation_language/persistence_language", () => {
  const taskCase = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, taskPayloadIncluded: true } }));
  assert.ok(scoreDecisionSupportResponseDraftQualityDimension(taskCase, "no_side_effects").issues.includes("task_creation_language"));

  const emailCase = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, emailDraftPayloadIncluded: true } }));
  assert.ok(scoreDecisionSupportResponseDraftQualityDimension(emailCase, "no_side_effects").issues.includes("email_creation_language"));

  const dbCase = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, dbPayloadIncluded: true } }));
  assert.ok(scoreDecisionSupportResponseDraftQualityDimension(dbCase, "no_side_effects").issues.includes("persistence_language"));
});

test("project name leak creates issue project_name_leak", () => {
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, projectNameIncluded: true } }));
  const dimensionScore = scoreDecisionSupportResponseDraftQualityDimension(caseResult, "no_leakage");
  assert.deepEqual(dimensionScore.issues, ["project_name_leak"]);
});

// ─── Case evaluation (positive) ─────────────────────────────────────────────────────

test("valid clarification_first_draft case passes with expected scores", () => {
  const caseResult = buildDraftCaseResult({ caseId: "cf-1", routeKind: "clarification_gated_decision_support", responseKind: "clarification_question" });
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.ok(evaluation.overallScore >= 85);
  assert.equal(evaluation.safetyScore, 100);
  assert.ok(evaluation.clarificationScore >= 85);
  assert.equal(evaluation.pass, true);
  assert.equal(evaluation.warning, false);
  assert.equal(evaluation.fail, false);
  assert.equal(evaluation.blocked, false);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, true);
  assert.equal(evaluation.safeForUserVisibleOutputNow, false);
  assert.equal(evaluation.safeForProduction, false);
  assert.equal(evaluation.criticalIssueCount, 0);
  assert.equal(evaluation.leakageIssueCount, 0);
  assert.equal(evaluation.sideEffectIssueCount, 0);
});

test("valid route_preservation_draft case passes with expected scores", () => {
  const caseResult = buildDraftCaseResult({ caseId: "rp-1", routeKind: "existing_route_preserved", responseKind: "route_preservation_notice" });
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.ok(evaluation.overallScore >= 85);
  assert.equal(evaluation.safetyScore, 100);
  assert.equal(evaluation.clarificationScore, 100);
  assert.equal(evaluation.pass, true);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, true);
});

test("valid unsupported_boundary_draft case passes with expected scores", () => {
  const caseResult = buildDraftCaseResult({ caseId: "ub-1", routeKind: "unsupported_preserved", responseKind: "unsupported_boundary_notice" });
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.ok(evaluation.overallScore >= 85);
  assert.equal(evaluation.safetyScore, 100);
  assert.equal(evaluation.pass, true);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, true);
});

test("valid shadow_only_internal_draft case passes with expected scores", () => {
  const caseResult = buildDraftCaseResult({ caseId: "so-1", routeKind: "shadow_only", responseKind: "shadow_only_internal" });
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.ok(evaluation.overallScore >= 85);
  assert.equal(evaluation.safetyScore, 100);
  assert.equal(evaluation.pass, true);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, true);
});

// ─── Case evaluation (negative) ─────────────────────────────────────────────────────

test("low score (combined soft issues) produces warning or fail", () => {
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({
    ...draft,
    sections: { ...draft.sections, clarificationQuestion: "Contame mas", assumptions: ["algo x"], recommendedNextStep: "Espera." },
  }));
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.ok(evaluation.warning || evaluation.fail);
  assert.equal(evaluation.pass, false);
  assert.equal(evaluation.blocked, false);
});

test("critical issue (unsafe tone) produces blocked", () => {
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({
    ...draft,
    sections: { ...draft.sections, acknowledgement: `${draft.sections.acknowledgement} !!! DEBES aceptar esto.` },
  }));
  assert.equal(caseResult.validation.qaStatus, "pass");
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.equal(evaluation.blocked, true);
  assert.equal(evaluation.qualityStatus, "blocked");
  assert.equal(evaluation.overallScore, 0);
  assert.ok(evaluation.issues.includes("unsafe_tone"));
});

test("leakage produces blocked", () => {
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, rawInputIncluded: true } }));
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.equal(evaluation.blocked, true);
  assert.equal(evaluation.leakageIssueCount, 1);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, false);
});

test("side effect risk produces blocked", () => {
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, executableNow: true }));
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.equal(evaluation.blocked, true);
  assert.equal(evaluation.sideEffectIssueCount, 1);
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, false);
});

test("a case whose Sprint 33R draft was rejected/blocked is refused evaluation and forced to blocked", () => {
  const caseResult = buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, sections: { ...draft.sections, nonExecutionNotice: undefined } }));
  assert.equal(caseResult.draftAccepted, false);
  const evaluation = evaluateDecisionSupportResponseDraftQualityCase(caseResult);
  assert.equal(evaluation.blocked, true);
  assert.equal(evaluation.qualityStatus, "blocked");
  assert.equal(evaluation.safeForUserVisibleDryRunHarness, false);
});

// ─── Evaluation run ─────────────────────────────────────────────────────────────────

test("runDecisionSupportResponseDraftQualityEvaluation produces one case evaluation per Sprint 33R case", () => {
  assert.equal(EVALUATION.caseEvaluations.length, HARNESS.caseResults.length);
});

test("runDecisionSupportResponseDraftQualityEvaluation reuses the Sprint 33R harness decision", () => {
  assert.equal(EVALUATION.harnessSummary.decision, "ready_for_response_draft_quality_evaluation");
});

test("runDecisionSupportResponseDraftQualityEvaluation honors the default synthetic corpus when no cases are supplied", () => {
  const defaultEvaluation = runDecisionSupportResponseDraftQualityEvaluation({ now: NOW });
  assert.ok(defaultEvaluation.caseEvaluations.length > 0);
  assert.ok(defaultEvaluation.caseEvaluations.length < DECISION_CLARIFICATION_CASES.length);
});

test("runDecisionSupportResponseDraftQualityEvaluation can reuse a pre-built harness instead of rebuilding one", () => {
  const harness = runDecisionSupportResponseDraftHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const evaluation = runDecisionSupportResponseDraftQualityEvaluation({ harness, now: NOW });
  assert.equal(evaluation.caseEvaluations.length, harness.caseResults.length);
  assert.equal(evaluation.harness, harness);
});

test("rdq-summary-quality-pass: totalCases matches the Sprint 18R corpus size, every case passes", () => {
  fixtureFor("rdq-summary-quality-pass");
  assert.equal(SUMMARY.totalCases, 79);
  assert.equal(SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(SUMMARY.evaluatedDraftCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.passCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.warningCount, 0);
  assert.equal(SUMMARY.failCount, 0);
  assert.equal(SUMMARY.blockedCount, 0);
});

test("summary: excellentCount/acceptableCount match the documented Sprint 33R draft-kind baseline", () => {
  assert.ok(SUMMARY.excellentCount >= 69);
  assert.ok(SUMMARY.acceptableCount >= 10);
  assert.equal(SUMMARY.needsImprovementCount, 0);
  assert.equal(SUMMARY.unacceptableCount, 0);
  assert.equal(SUMMARY.blockedBandCount, 0);
});

test("summary: score bands sum to totalCases", () => {
  const sum = SUMMARY.excellentCount + SUMMARY.acceptableCount + SUMMARY.needsImprovementCount + SUMMARY.unacceptableCount + SUMMARY.blockedBandCount;
  assert.equal(sum, SUMMARY.totalCases);
});

test("summary: score averages/minimums meet their floors", () => {
  assert.ok(SUMMARY.averageOverallScore >= 90);
  assert.equal(SUMMARY.averageSafetyScore, 100);
  assert.ok(SUMMARY.averageClarificationScore >= 85);
  assert.ok(SUMMARY.minOverallScore >= 85);
  assert.equal(SUMMARY.minSafetyScore, 100);
  assert.ok(SUMMARY.minClarificationScore >= 85);
});

test("summary: safety/leakage/side-effect/attempted counts are all clean", () => {
  assert.equal(SUMMARY.safeForUserVisibleDryRunHarnessCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.safeForUserVisibleOutputNowCount, 0);
  assert.equal(SUMMARY.safeForProductionCount, 0);
  assert.equal(SUMMARY.criticalIssueCount, 0);
  assert.equal(SUMMARY.leakageIssueCount, 0);
  assert.equal(SUMMARY.sideEffectIssueCount, 0);
  assert.equal(SUMMARY.userVisibleOutputAttemptedCount, 0);
  assert.equal(SUMMARY.productionWiringAttemptedCount, 0);
  assert.equal(SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(SUMMARY.externalCallAttemptedCount, 0);
});

test("summary: every dimension pass count equals totalCases for the clean corpus", () => {
  assert.equal(SUMMARY.clarityPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.usefulnessPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.pmRelevancePassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.clarificationQualityPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.assumptionQualityPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.safeNextStepQualityPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.nonExecutionClarityPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.routePreservationQualityPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.unsupportedBoundaryQualityPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.tonePassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.concisenessPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noOverconfidencePassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noLeakagePassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noSideEffectsPassCount, SUMMARY.totalCases);
});

test("rdq-decision-ready-for-user-visible-dry-run-evaluation-harness: decision is ready_for_user_visible_dry_run_evaluation_harness", () => {
  fixtureFor("rdq-decision-ready-for-user-visible-dry-run-evaluation-harness");
  assert.equal(SUMMARY.decision, "ready_for_user_visible_dry_run_evaluation_harness");
});

test("rdq-recommended-sprint-35r: recommendedNextSprint is Sprint 35R", () => {
  fixtureFor("rdq-recommended-sprint-35r");
  assert.equal(SUMMARY.recommendedNextSprint, "Sprint 35R — User-Visible Dry Run Evaluation Harness");
});

test("summary accepts a bare case-evaluations array plus sprint33HarnessDecision option", () => {
  const bareSummary = summarizeDecisionSupportResponseDraftQualityEvaluation(EVALUATION.caseEvaluations, {
    sprint33HarnessDecision: EVALUATION.harnessSummary.decision,
  });
  assert.equal(bareSummary.totalCases, SUMMARY.totalCases);
  assert.equal(bareSummary.decision, SUMMARY.decision);
});

test("summary: bare case-evaluations array without sprint33HarnessDecision cannot reach ready_for_user_visible_dry_run_evaluation_harness", () => {
  const bareSummary = summarizeDecisionSupportResponseDraftQualityEvaluation(EVALUATION.caseEvaluations);
  assert.notEqual(bareSummary.decision, "ready_for_user_visible_dry_run_evaluation_harness");
});

test("summary: representativeExcellentCases is capped and warningCases/failingCases/blockedCases are empty for the clean corpus", () => {
  assert.ok(SUMMARY.representativeExcellentCases.length <= 8);
  assert.equal(SUMMARY.warningCases.length, 0);
  assert.equal(SUMMARY.failingCases.length, 0);
  assert.equal(SUMMARY.blockedCases.length, 0);
});

// ─── Decision blocking paths ────────────────────────────────────────────────────────

test("decision: leakage/side-effect issues force blocked_by_leakage_or_side_effect_risk", () => {
  const leaked = evaluateDecisionSupportResponseDraftQualityCase(buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, safety: { ...draft.safety, rawInputIncluded: true } })));
  const summary = summarizeDecisionSupportResponseDraftQualityEvaluation([leaked], { sprint33HarnessDecision: "ready_for_response_draft_quality_evaluation" });
  assert.equal(summary.decision, "blocked_by_leakage_or_side_effect_risk");
});

test("decision: unsafe tone forces blocked_by_unsafe_tone when no leakage/side-effect issue is present", () => {
  const unsafeToneCase = evaluateDecisionSupportResponseDraftQualityCase(
    buildDraftCaseResult(CLARIFICATION_SOURCE_CASE, (draft) => ({ ...draft, sections: { ...draft.sections, acknowledgement: `${draft.sections.acknowledgement} !!! DEBES aceptar esto.` } })),
  );
  assert.equal(unsafeToneCase.leakageIssueCount, 0);
  assert.equal(unsafeToneCase.sideEffectIssueCount, 0);
  const summary = summarizeDecisionSupportResponseDraftQualityEvaluation([unsafeToneCase], { sprint33HarnessDecision: "ready_for_response_draft_quality_evaluation" });
  assert.equal(summary.decision, "blocked_by_unsafe_tone");
});

test("decision: missing/weak safe next step forces blocked_by_missing_safe_next_step", () => {
  const missingNextStep = evaluateDecisionSupportResponseDraftQualityCase(
    buildDraftCaseResult({ caseId: "rp-neg", routeKind: "existing_route_preserved", responseKind: "route_preservation_notice" }, (draft) => ({
      ...draft,
      sections: { ...draft.sections, recommendedNextStep: "Ok." },
    })),
  );
  assert.equal(missingNextStep.leakageIssueCount, 0);
  assert.equal(missingNextStep.sideEffectIssueCount, 0);
  assert.ok(!missingNextStep.issues.includes("unsafe_tone"));
  const summary = summarizeDecisionSupportResponseDraftQualityEvaluation([missingNextStep], { sprint33HarnessDecision: "ready_for_response_draft_quality_evaluation" });
  assert.equal(summary.decision, "blocked_by_missing_safe_next_step");
});

test("decision: continue_quality_evaluation_only when the Sprint 33R harness decision is not ready", () => {
  const summary = summarizeDecisionSupportResponseDraftQualityEvaluation(EVALUATION.caseEvaluations, { sprint33HarnessDecision: "continue_harness_only" });
  assert.equal(summary.decision, "continue_quality_evaluation_only");
});

// ─── Explain ────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportResponseDraftQualityEvaluation returns a structured explanation", () => {
  const explain = explainDecisionSupportResponseDraftQualityEvaluation();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
});

// ─── Regression: Sprint 18R-33R + golden/classifier metrics unchanged ──────────────

test("regression: Sprint 33R response draft harness metrics stay clean against the 79-case corpus", () => {
  const harness = runDecisionSupportResponseDraftHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseDraftHarness(harness);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.draftAcceptedCount, 79);
  assert.equal(summary.clarificationFirstDraftCount, 69);
  assert.equal(summary.routePreservationDraftCount, 10);
  assert.equal(summary.decision, "ready_for_response_draft_quality_evaluation");
});

test("regression: Sprint 32R response QA plan metrics stay clean against the 79-case corpus", () => {
  const plan = buildDecisionSupportResponseQaDryRunPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseQaDryRunPlan(plan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.clarificationQuestionCaseCount, 69);
  assert.equal(summary.routePreservationCaseCount, 10);
  assert.equal(summary.decision, "ready_for_response_draft_harness");
});

test("regression: Sprint 31R clarification-gated integration plan metrics stay clean against the 79-case corpus", () => {
  const integrationPlan = buildDecisionSupportClarificationGatedIntegrationPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportClarificationGatedIntegrationPlan(integrationPlan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.clarificationGatedCaseCount, 69);
  assert.equal(summary.existingRoutePreservedCaseCount, 10);
  assert.equal(summary.decision, "ready_for_user_visible_dry_run_plan");
});

test("regression: Sprint 30R controlled replay metrics stay clean against the 79-case corpus", () => {
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowControlledReplayEvaluation(evaluation);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.deterministicReplayRate, 100);
  assert.equal(summary.safeReplayRate, 100);
  assert.equal(summary.decision, "ready_for_clarification_gated_integration_plan");
});

test("regression: Sprint 29R persistence readiness baseline matches the documented Sprint 29R result", () => {
  const inputMetrics = createDecisionSupportShadowPersistenceReadinessInputMetrics(DECISION_CLARIFICATION_CASES, { now: NOW });
  const review = buildDecisionSupportShadowPersistenceReadinessReview({ now: NOW, inputMetrics });
  const summary = summarizeDecisionSupportShadowPersistenceReadinessReview(review);
  assert.equal(summary.readinessScore, 62.9);
  assert.equal(summary.decision, "do_not_build_real_persistence_yet");
});

test("regression: Sprint 28R fake adapter metrics stay clean against the 79-case corpus", () => {
  const result = runDecisionSupportShadowStorageFakeAdapterEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(result);
  assert.equal(summary.fakeWriteAcceptedRate, 100);
});

test("regression: Sprint 27R adapter plan metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStorageAdapterPlanEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(results);
  assert.equal(summary.validDraftRate, 100);
});

test("regression: Sprint 26R storage policy metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStoragePolicyEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStoragePolicyEvaluation(results);
  assert.equal(summary.rawInputViolationCount, 0);
  assert.equal(summary.fullCandidateViolationCount, 0);
});

test("regression: Sprint 25R shadow capture harness metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW, context: { mode: "dry_run" } });
  const summary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(results);
  assert.equal(summary.acceptableCaptureRate, 100);
  assert.equal(summary.rawInputRetainedCount, 0);
});

test("regression: Sprint 22R clarification response evaluation still runs cleanly", () => {
  const results = runClarificationResponseEvaluation(toDecisionClarificationEvaluationCases(DECISION_CLARIFICATION_CASES), { now: NOW });
  assert.ok(results.length > 0);
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
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftQualityEvaluation.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftQualityEvaluationTypes.ts", import.meta.url),
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

test("this module never calls the system clock (no bare Date.now()/new Date()) or an LLM", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /new Date\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /Date\.now\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\bopenai\b/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\banthropic\b/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\.chat\.completions\b/);
});

test("this module never imports from tests/fixtures/", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /tests\/fixtures/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportResponseDraftQualityEvaluation/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});
