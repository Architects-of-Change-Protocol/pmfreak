/**
 * Sprint 22R — Clarification Response Strategy: offline evaluation.
 *
 * A pure, read-only, offline evaluator that measures how the Sprint 22R Clarification Response
 * Strategy (`clarificationResponseStrategy.ts`) behaves against the two existing corpora that
 * already carry clarification-shaped cases: the Sprint 18R architecture corpus
 * (`tests/fixtures/conversational-brain-decision-clarification-cases.ts`, `clarification_*`
 * categories) and the Sprint 17R boundary corpus
 * (`tests/fixtures/conversational-brain-general-pm-advice-boundary-cases.ts`,
 * `ambiguous_clarification_candidate` category). It also accepts this sprint's own fixture
 * (`tests/fixtures/conversational-brain-clarification-response-cases.ts`) as a `custom_fixture`
 * source.
 *
 * Like every module in this package tree, this does not call the router, composer, or any
 * production handler; does not touch `POST /api/command-center/chat`; does not read/write a
 * database, call Supabase, send email, create a task, or call an LLM; does not use `fetch`; and does
 * not activate the enriched classifier in production. See
 * `docs/conversational-brain-clarification-response-strategy.md` for the full design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import type { GeneralPmAdviceBoundaryCase } from "../classifier/generalPmAdviceBoundaryReview";

import { handleClarificationResponseCandidate } from "./clarificationResponseStrategy";
import type {
  ClarificationAmbiguityLevel,
  ClarificationMissingSlot,
  ClarificationRouteOptionIntent,
  ClarificationStrategyType,
} from "./clarificationResponseTypes";

// ─── Input ─────────────────────────────────────────────────────────────────────────

export type ClarificationResponseEvaluationSourceCorpus =
  | "decision_clarification_architecture"
  | "general_pm_boundary"
  | "custom_fixture";

export type ClarificationCustomFixtureCase = {
  id: string;
  input: string;
  expectedClarification: boolean;
};

export type ClarificationResponseEvaluationCase =
  | { sourceCorpus: "decision_clarification_architecture"; case: DecisionClarificationCase }
  | { sourceCorpus: "general_pm_boundary"; case: GeneralPmAdviceBoundaryCase }
  | { sourceCorpus: "custom_fixture"; case: ClarificationCustomFixtureCase };

export type ClarificationResponseEvaluationOptions = {
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

/**
 * Filters the Sprint 18R architecture corpus down to its clarification-relevant cases and wraps
 * them for `runClarificationResponseEvaluation`. Pure — never mutates `cases`.
 */
export function toDecisionClarificationEvaluationCases(
  cases: DecisionClarificationCase[],
): ClarificationResponseEvaluationCase[] {
  return cases.map((c) => ({ sourceCorpus: "decision_clarification_architecture" as const, case: c }));
}

/**
 * Wraps the Sprint 17R boundary corpus for `runClarificationResponseEvaluation`. Pure — never
 * mutates `cases`.
 */
export function toGeneralPmBoundaryEvaluationCases(
  cases: GeneralPmAdviceBoundaryCase[],
): ClarificationResponseEvaluationCase[] {
  return cases.map((c) => ({ sourceCorpus: "general_pm_boundary" as const, case: c }));
}

/** Wraps this sprint's own fixture corpus for `runClarificationResponseEvaluation`. */
export function toCustomFixtureEvaluationCases(
  cases: ClarificationCustomFixtureCase[],
): ClarificationResponseEvaluationCase[] {
  return cases.map((c) => ({ sourceCorpus: "custom_fixture" as const, case: c }));
}

// ─── Result ──────────────────────────────────────────────────────────────────────────

export type ClarificationResponseEvaluationResult = {
  id: string;
  input: string;
  sourceCorpus: ClarificationResponseEvaluationSourceCorpus;
  expectedClarification: boolean;
  architectureCategory?: string;
  boundaryCategory?: string;
  desiredFutureRoute?: string;
  strategyType: ClarificationStrategyType;
  ambiguityLevel: ClarificationAmbiguityLevel;
  missingSlots: ClarificationMissingSlot[];
  suggestedRouteOptionIntents: ClarificationRouteOptionIntent[];
  primaryQuestion: string;
  secondaryQuestionCount: number;
  responseText: string;
  hasProjectQuestion: boolean;
  hasIntentQuestion: boolean;
  hasSourceContextQuestion: boolean;
  hasUsefulRouteOptions: boolean;
  asksTooManyQuestions: boolean;
  safetyPass: boolean;
  shouldExecuteAction: boolean;
  shouldCreateTask: boolean;
  shouldSendEmail: boolean;
  shouldWriteToDb: boolean;
  requiresUserReply: boolean;
  isAcceptableClarificationResponse: boolean;
  warnings: string[];
};

function computeExpectedClarification(wrapped: ClarificationResponseEvaluationCase): boolean {
  if (wrapped.sourceCorpus === "decision_clarification_architecture") {
    const c = wrapped.case;
    return (
      c.desiredFutureRoute === "needs_clarification" ||
      c.targetKind === "clarification_strategy" ||
      c.requiresClarification === true ||
      c.architectureCategory.startsWith("clarification_")
    );
  }
  if (wrapped.sourceCorpus === "general_pm_boundary") {
    return wrapped.case.boundaryCategory === "ambiguous_clarification_candidate";
  }
  return wrapped.case.expectedClarification;
}

function extractCaseFields(wrapped: ClarificationResponseEvaluationCase): {
  id: string;
  input: string;
  architectureCategory?: string;
  boundaryCategory?: string;
  desiredFutureRoute?: string;
} {
  if (wrapped.sourceCorpus === "decision_clarification_architecture") {
    return {
      id: wrapped.case.id,
      input: wrapped.case.input,
      architectureCategory: wrapped.case.architectureCategory,
      desiredFutureRoute: wrapped.case.desiredFutureRoute,
    };
  }
  if (wrapped.sourceCorpus === "general_pm_boundary") {
    return { id: wrapped.case.id, input: wrapped.case.input, boundaryCategory: wrapped.case.boundaryCategory };
  }
  return { id: wrapped.case.id, input: wrapped.case.input };
}

const EXECUTED_ACTION_CLAIM_PATTERN =
  /\bse ejecut(o|ó)\b|\bse creo\b|\bse creó\b|\bse envio\b|\bse envió\b|\bse asigno\b|\bse asignó\b|\bse actualizo\b|\bse actualizó\b/;

/**
 * Runs the clarification response strategy for every wrapped evaluation case and scores each result
 * against this sprint's acceptability/safety rules. Pure — never mutates `cases`, never calls the
 * router, composer, any handler, a database, Supabase, or any external service, and never activates
 * a feature flag.
 */
export function runClarificationResponseEvaluation(
  cases: ClarificationResponseEvaluationCase[],
  options: ClarificationResponseEvaluationOptions = {},
): ClarificationResponseEvaluationResult[] {
  return cases.map((wrapped) => {
    const { id, input, architectureCategory, boundaryCategory, desiredFutureRoute } = extractCaseFields(wrapped);
    const expectedClarification = computeExpectedClarification(wrapped);

    const result = handleClarificationResponseCandidate({ input, source: "architecture_review", now: options.now });

    const hasProjectQuestion =
      result.primaryQuestion.slot === "project" || result.secondaryQuestions.some((q) => q.slot === "project");
    const hasIntentQuestion =
      result.primaryQuestion.slot === "intent" || result.secondaryQuestions.some((q) => q.slot === "intent");
    const hasSourceContextQuestion =
      result.primaryQuestion.slot === "source_context" ||
      result.secondaryQuestions.some((q) => q.slot === "source_context");
    const hasUsefulRouteOptions = result.suggestedRouteOptions.length > 0;
    const asksTooManyQuestions = result.secondaryQuestions.length > 3;

    const safetyPass =
      result.safety.shouldExecuteAction === false &&
      result.safety.shouldCreateTask === false &&
      result.safety.shouldSendEmail === false &&
      result.safety.shouldWriteToDb === false &&
      result.safety.requiresUserReply === true;

    const affirmsExecution = EXECUTED_ACTION_CLAIM_PATTERN.test(result.responseText.toLowerCase());

    const warnings: string[] = [...result.warnings];
    if (!hasUsefulRouteOptions) warnings.push("No route options were suggested for this input.");
    if (asksTooManyQuestions) warnings.push("More than 3 secondary questions were generated.");
    if (result.responseText.trim().length === 0) warnings.push("responseText is empty.");
    if (affirmsExecution) warnings.push("responseText appears to affirm an executed action.");

    const isAcceptableClarificationResponse =
      result.responseText.trim().length > 0 &&
      result.primaryQuestion.question.trim().length > 0 &&
      hasUsefulRouteOptions &&
      safetyPass &&
      !affirmsExecution &&
      !asksTooManyQuestions;

    return {
      id,
      input,
      sourceCorpus: wrapped.sourceCorpus,
      expectedClarification,
      architectureCategory,
      boundaryCategory,
      desiredFutureRoute,
      strategyType: result.strategyType,
      ambiguityLevel: result.ambiguityLevel,
      missingSlots: result.missingSlots,
      suggestedRouteOptionIntents: result.suggestedRouteOptions.map((o) => o.intent),
      primaryQuestion: result.primaryQuestion.question,
      secondaryQuestionCount: result.secondaryQuestions.length,
      responseText: result.responseText,
      hasProjectQuestion,
      hasIntentQuestion,
      hasSourceContextQuestion,
      hasUsefulRouteOptions,
      asksTooManyQuestions,
      safetyPass,
      shouldExecuteAction: result.safety.shouldExecuteAction,
      shouldCreateTask: result.safety.shouldCreateTask,
      shouldSendEmail: result.safety.shouldSendEmail,
      shouldWriteToDb: result.safety.shouldWriteToDb,
      requiresUserReply: result.safety.requiresUserReply,
      isAcceptableClarificationResponse,
      warnings,
    } satisfies ClarificationResponseEvaluationResult;
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

const STRATEGY_TYPES: ClarificationStrategyType[] = [
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
];

const AMBIGUITY_LEVELS: ClarificationAmbiguityLevel[] = ["low", "medium", "high"];

const MISSING_SLOTS: ClarificationMissingSlot[] = [
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
];

export type ClarificationResponseNextSprintRecommendation =
  | "Sprint 23R — Clarification Response Quality Hardening"
  | "Sprint 23R — Clarification Safety Hardening"
  | "Sprint 23R — Decision Support Adapter Mapping Plan"
  | "Sprint 23R — Controlled Shadow Capture Prep";

export type ClarificationResponseEvaluationSummary = {
  totalCases: number;
  evaluatedClarificationCases: number;
  strategyCoverageCount: number;
  strategyCoverageRate: number;
  acceptableResponseCount: number;
  acceptableResponseRate: number;
  safetyPassCount: number;
  safetyPassRate: number;
  routeOptionsCoverageCount: number;
  routeOptionsCoverageRate: number;
  overQuestioningCount: number;
  missingProjectQuestionCount: number;
  missingIntentQuestionCount: number;
  missingSourceContextQuestionCount: number;
  byStrategyType: Record<ClarificationStrategyType, number>;
  byAmbiguityLevel: Record<ClarificationAmbiguityLevel, number>;
  byMissingSlot: Record<ClarificationMissingSlot, number>;
  topClarificationResponses: ClarificationResponseEvaluationResult[];
  weakClarificationResponses: ClarificationResponseEvaluationResult[];
  recommendedNextSprint: ClarificationResponseNextSprintRecommendation;
  recommendation: string;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

/**
 * Sprint 21R's own measured, documented result (`recommendedIntegrationMode: "do_not_integrate"` —
 * see `docs/conversational-brain-decision-support-classifier-boundary.md`): the decision_support
 * adapter mapping (`decision_support -> unsupported`) is still the Sprint 10R safe fallback, not a
 * real production route. Used only to select `recommendedNextSprint` below when clarification itself
 * is solid — a fixed, documented snapshot, never re-measured at runtime by this module.
 */
const DECISION_SUPPORT_ADAPTER_MAPPING_STILL_PENDING = true;

function computeRecommendedNextSprint(
  acceptableResponseRate: number,
  safetyPassRate: number,
): { recommendedNextSprint: ClarificationResponseNextSprintRecommendation; recommendation: string } {
  if (acceptableResponseRate < 85) {
    return {
      recommendedNextSprint: "Sprint 23R — Clarification Response Quality Hardening",
      recommendation: `acceptableResponseRate (${acceptableResponseRate}%) is below the 85% floor — harden the response quality (missing route options, over-questioning, or empty text) before anything else.`,
    };
  }
  if (safetyPassRate < 100) {
    return {
      recommendedNextSprint: "Sprint 23R — Clarification Safety Hardening",
      recommendation: `safetyPassRate (${safetyPassRate}%) is below 100% — this is a hard safety regression and must be fixed before any other clarification work.`,
    };
  }
  if (DECISION_SUPPORT_ADAPTER_MAPPING_STILL_PENDING) {
    return {
      recommendedNextSprint: "Sprint 23R — Decision Support Adapter Mapping Plan",
      recommendation: `acceptableResponseRate (${acceptableResponseRate}%) and safetyPassRate (${safetyPassRate}%) are both solid, but decision_support still maps to the Sprint 10R "unsupported" safe fallback (Sprint 21R recommendedIntegrationMode: do_not_integrate) — that adapter/mapping plan is the next architectural step.`,
    };
  }
  return {
    recommendedNextSprint: "Sprint 23R — Controlled Shadow Capture Prep",
    recommendation: `acceptableResponseRate (${acceptableResponseRate}%) and safetyPassRate (${safetyPassRate}%) are both solid and decision_support integration is no longer pending — the architecture is healthy enough to prepare a controlled shadow capture.`,
  };
}

/**
 * Turns a `runClarificationResponseEvaluation()` result array into a review-ready report: coverage,
 * acceptability, safety, and route-option rates; over-questioning and missing-question defect
 * counts; per-strategy-type/ambiguity-level/missing-slot breakdowns; the strongest and weakest
 * responses; and a next-sprint recommendation. Pure — takes an already-computed result array rather
 * than re-running anything.
 *
 * `strategyCoverageRate`/`Count` are scored only over `evaluatedClarificationCases` (cases this
 * sprint's policy expects the strategy to actually handle); `routeOptionsCoverageRate`/`Count` are
 * scored over every case in `results`, since route options should never be empty regardless of
 * whether clarification was the expected outcome for that case.
 */
export function summarizeClarificationResponseEvaluation(
  results: ClarificationResponseEvaluationResult[],
): ClarificationResponseEvaluationSummary {
  const totalCases = results.length;
  const evaluated = results.filter((r) => r.expectedClarification);
  const evaluatedClarificationCases = evaluated.length;

  const byStrategyType = Object.fromEntries(STRATEGY_TYPES.map((t) => [t, 0])) as Record<ClarificationStrategyType, number>;
  const byAmbiguityLevel = Object.fromEntries(AMBIGUITY_LEVELS.map((l) => [l, 0])) as Record<ClarificationAmbiguityLevel, number>;
  const byMissingSlot = Object.fromEntries(MISSING_SLOTS.map((s) => [s, 0])) as Record<ClarificationMissingSlot, number>;

  let strategyCoverageCount = 0;
  let acceptableResponseCount = 0;
  let overQuestioningCount = 0;
  let missingProjectQuestionCount = 0;
  let missingIntentQuestionCount = 0;
  let missingSourceContextQuestionCount = 0;

  for (const result of evaluated) {
    byStrategyType[result.strategyType] += 1;
    byAmbiguityLevel[result.ambiguityLevel] += 1;
    for (const slot of result.missingSlots) byMissingSlot[slot] += 1;

    if (result.hasUsefulRouteOptions) strategyCoverageCount += 1;
    if (result.isAcceptableClarificationResponse) acceptableResponseCount += 1;
    if (result.asksTooManyQuestions) overQuestioningCount += 1;
    if (result.missingSlots.includes("project") && !result.hasProjectQuestion) missingProjectQuestionCount += 1;
    if (result.missingSlots.includes("intent") && !result.hasIntentQuestion) missingIntentQuestionCount += 1;
    if (result.missingSlots.includes("source_context") && !result.hasSourceContextQuestion) {
      missingSourceContextQuestionCount += 1;
    }
  }

  const safetyPassCount = results.filter((r) => r.safetyPass).length;
  const routeOptionsCoverageCount = results.filter((r) => r.hasUsefulRouteOptions).length;

  const acceptableResponseRate = rateOf(acceptableResponseCount, evaluatedClarificationCases);
  const safetyPassRate = rateOf(safetyPassCount, totalCases);

  const topClarificationResponses = evaluated.filter((r) => r.isAcceptableClarificationResponse).slice(0, 5);
  const weakClarificationResponses = evaluated.filter((r) => !r.isAcceptableClarificationResponse).slice(0, 5);

  const { recommendedNextSprint, recommendation } = computeRecommendedNextSprint(acceptableResponseRate, safetyPassRate);

  return {
    totalCases,
    evaluatedClarificationCases,
    strategyCoverageCount,
    strategyCoverageRate: rateOf(strategyCoverageCount, evaluatedClarificationCases),
    acceptableResponseCount,
    acceptableResponseRate,
    safetyPassCount,
    safetyPassRate,
    routeOptionsCoverageCount,
    routeOptionsCoverageRate: rateOf(routeOptionsCoverageCount, totalCases),
    overQuestioningCount,
    missingProjectQuestionCount,
    missingIntentQuestionCount,
    missingSourceContextQuestionCount,
    byStrategyType,
    byAmbiguityLevel,
    byMissingSlot,
    topClarificationResponses,
    weakClarificationResponses,
    recommendedNextSprint,
    recommendation,
  };
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type ClarificationResponseEvaluationExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  nonGoals: string[];
  expectedClarificationRules: string[];
  acceptabilityRules: string[];
  recommendedNextSprintLogic: string[];
};

export function explainClarificationResponseEvaluation(): ClarificationResponseEvaluationExplain {
  return {
    capability: "playbook-engine-conversation-clarification-response-evaluation",
    purpose:
      "Measures, offline and without touching production, how the Sprint 22R Clarification Response Strategy " +
      "behaves against the Sprint 18R architecture corpus's clarification_* cases and the Sprint 17R boundary " +
      "corpus's ambiguous_clarification_candidate cases (plus this sprint's own fixture corpus): whether the " +
      "response is acceptable, safe, and appropriately scoped, and what Sprint 23R follow-up this evidence supports.",
    doesNot: [
      "Does not import or call router/brainRouter.ts, composer/responseComposer.ts, any handlers/*.ts, or conversationalBrainGateway.ts.",
      "Does not touch POST /api/command-center/chat.",
      "Does not read or write a database, call Supabase, send email, create tasks, or execute any action.",
      "Does not call an LLM or any external API — fully deterministic and local, no fetch.",
      "Does not activate a feature flag or the enriched classifier in production.",
      "Does not modify classifier/intentClassifier.rules.ts, intent-patterns.ts, or intentCompatibilityAdapter.ts's mapping table.",
    ],
    nonGoals: [
      "Integrate the clarification strategy into the router.",
      "Change the endpoint, composer, or any production handler.",
      "Implement a persistent, multi-turn clarification loop.",
      "Calibrate general_pm_advice vocabulary.",
      "Create a new Context Resolver, Router, or Composer.",
    ],
    expectedClarificationRules: [
      "For decision_clarification_architecture cases: desiredFutureRoute === 'needs_clarification', OR targetKind === 'clarification_strategy', OR requiresClarification === true, OR architectureCategory starts with 'clarification_'.",
      "For general_pm_boundary cases: boundaryCategory === 'ambiguous_clarification_candidate'.",
      "For custom_fixture cases: the fixture's own recorded expectedClarification value.",
    ],
    acceptabilityRules: [
      "isAcceptableClarificationResponse requires: non-empty responseText, a non-empty primaryQuestion, at least one " +
        "suggested route option, every safety.* check passing, no phrase in responseText affirming an executed " +
        "action/task/email, and no more than three secondary questions.",
      "safetyPass requires shouldExecuteAction/shouldCreateTask/shouldSendEmail/shouldWriteToDb all false and " +
        "requiresUserReply true — computed over every case regardless of whether clarification was expected.",
    ],
    recommendedNextSprintLogic: [
      "acceptableResponseRate < 85% -> Clarification Response Quality Hardening.",
      "safetyPassRate < 100% (checked only once the quality floor holds) -> Clarification Safety Hardening.",
      "Otherwise, if the decision_support adapter mapping is still pending (Sprint 21R's documented do_not_integrate " +
        "snapshot) -> Decision Support Adapter Mapping Plan.",
      "Otherwise -> Controlled Shadow Capture Prep.",
    ],
  };
}
