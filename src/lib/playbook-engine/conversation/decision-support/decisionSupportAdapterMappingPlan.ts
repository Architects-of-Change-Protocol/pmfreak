/**
 * Sprint 23R — Decision Support Adapter Mapping Plan.
 *
 * A pure, read-only, offline planner that simulates eight candidate strategies for how
 * `decision_support` (and `needs_clarification`) could eventually be mapped by
 * `intentCompatibilityAdapter.ts`, and compares them on safety, existing-route preservation, and how
 * much of today's production wiring each would require to realize — without changing the adapter,
 * the router, the composer, any production handler, the endpoint, or any feature flag.
 *
 * It reuses, rather than reimplements: the Sprint 20R/21R shadow mapping evaluator
 * (`runDecisionSupportShadowMappingEvaluation`, itself built on the Sprint 18R architecture review
 * and the Sprint 19R candidate handler), and the Sprint 22R Clarification Response Strategy
 * (`handleClarificationResponseCandidate`). Every simulated result carries `shouldExecuteAction:
 * false` and none of the eight strategies ever overrides an `existing_route_should_win` case.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not activate the
 * enriched classifier in production; and does not connect `decision_support` to the router. See
 * `docs/conversational-brain-decision-support-adapter-mapping-plan.md` for the full design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";

import {
  runDecisionSupportShadowMappingEvaluation,
  type DecisionSupportShadowMappingResult,
} from "./decisionSupportShadowMappingEvaluation";
import { handleClarificationResponseCandidate } from "../clarification/clarificationResponseStrategy";
import type { ClarificationResponseCandidateResult } from "../clarification/clarificationResponseTypes";

import type {
  DecisionSupportAdapterMappingNextSprintRecommendation,
  DecisionSupportAdapterMappingOutcome,
  DecisionSupportAdapterMappingPlanExplain,
  DecisionSupportAdapterMappingPlanOptions,
  DecisionSupportAdapterMappingPlanSummary,
  DecisionSupportAdapterMappingResult,
  DecisionSupportAdapterMappingRiskLevel,
  DecisionSupportAdapterMappingSimulatedIntent,
  DecisionSupportAdapterMappingStrategy,
  DecisionSupportAdapterMappingStrategySummary,
} from "./decisionSupportAdapterMappingPlanTypes";

export type {
  DecisionSupportAdapterMappingStrategy,
  DecisionSupportAdapterMappingPlanOptions,
  DecisionSupportAdapterMappingPlanInput,
  DecisionSupportAdapterMappingSimulatedIntent,
  DecisionSupportAdapterMappingRiskLevel,
  DecisionSupportAdapterMappingOutcome,
  DecisionSupportAdapterMappingResult,
  DecisionSupportAdapterMappingStrategySummary,
  DecisionSupportAdapterMappingNextSprintRecommendation,
  DecisionSupportAdapterMappingPlanSummary,
  DecisionSupportAdapterMappingPlanExplain,
} from "./decisionSupportAdapterMappingPlanTypes";

// ─── Strategy list ───────────────────────────────────────────────────────────────────

export const ALL_DECISION_SUPPORT_ADAPTER_MAPPING_STRATEGIES: DecisionSupportAdapterMappingStrategy[] = [
  "keep_unsupported",
  "map_to_general_pm_advice",
  "map_to_recommendation_request",
  "shadow_candidate_handler_only",
  "feature_flag_default_off",
  "clarify_before_decision_support",
  "hybrid_shadow_then_clarify",
  "do_not_map",
];

export function listDecisionSupportAdapterMappingStrategies(): DecisionSupportAdapterMappingStrategy[] {
  return [...ALL_DECISION_SUPPORT_ADAPTER_MAPPING_STRATEGIES];
}

// ─── Static per-strategy wiring requirements ─────────────────────────────────────────

/** What a *future, real* integration of this strategy would require touching — not what this
 * sprint touches (this sprint touches none of it). Used only to compute
 * `requiresRouterChange`/`requiresAdapterChange`/`requiresFeatureFlag`/`introducesProductionBehavior`
 * per result; overridden to all-false for `existing_route_should_win` cases (nothing to change) and
 * for `do_not_map` (explicitly defers every decision). */
const STRATEGY_WIRING: Record<
  DecisionSupportAdapterMappingStrategy,
  { requiresRouterChange: boolean; requiresAdapterChange: boolean; requiresFeatureFlag: boolean }
> = {
  keep_unsupported: { requiresRouterChange: false, requiresAdapterChange: false, requiresFeatureFlag: false },
  map_to_general_pm_advice: { requiresRouterChange: false, requiresAdapterChange: true, requiresFeatureFlag: false },
  map_to_recommendation_request: { requiresRouterChange: false, requiresAdapterChange: true, requiresFeatureFlag: false },
  shadow_candidate_handler_only: { requiresRouterChange: true, requiresAdapterChange: false, requiresFeatureFlag: true },
  feature_flag_default_off: { requiresRouterChange: true, requiresAdapterChange: true, requiresFeatureFlag: true },
  clarify_before_decision_support: { requiresRouterChange: true, requiresAdapterChange: true, requiresFeatureFlag: false },
  hybrid_shadow_then_clarify: { requiresRouterChange: true, requiresAdapterChange: true, requiresFeatureFlag: true },
  do_not_map: { requiresRouterChange: false, requiresAdapterChange: false, requiresFeatureFlag: false },
};

const SAFE_OUTCOMES = new Set<DecisionSupportAdapterMappingOutcome>([
  "safe_parking",
  "safe_shadow_candidate",
  "safe_clarification",
  "feature_flag_blocked_safe",
  "existing_route_preserved",
  "not_applicable",
  "requires_future_router",
]);

const UNSAFE_OUTCOMES = new Set<DecisionSupportAdapterMappingOutcome>(["unsafe_generic_answer", "unsafe_playbook_answer"]);

/** Categories where a wrong generic answer is especially dangerous (billing/risk/closure framing) —
 * see docs/conversational-brain-decision-support-adapter-mapping-plan.md, "Why not map to
 * general_pm_advice". Elevates `map_to_general_pm_advice`'s risk from "high" to "critical" only. */
const CRITICAL_RISK_CATEGORIES = new Set(["decision_support_vs_risk", "decision_support_vs_closure"]);

// ─── Clarification safety (mirrors clarificationResponseEvaluation.ts's acceptability checks) ────

function evaluateClarificationSafety(result: ClarificationResponseCandidateResult): boolean {
  if (result.kind !== "clarification_response_candidate_result") return false;
  if (result.responseText.trim().length === 0) return false;
  if (!result.primaryQuestion.question || result.primaryQuestion.question.trim().length === 0) return false;
  if (result.suggestedRouteOptions.length === 0) return false;
  if (result.secondaryQuestions.length > 3) return false;

  const safety = result.safety;
  if (safety.shouldExecuteAction !== false) return false;
  if (safety.shouldCreateTask !== false) return false;
  if (safety.shouldSendEmail !== false) return false;
  if (safety.shouldWriteToDb !== false) return false;
  if (safety.requiresUserReply !== true) return false;
  if (safety.productionRoutingEnabled !== false) return false;

  return true;
}

// ─── Per-case precomputed context ────────────────────────────────────────────────────

type CaseContext = {
  architectureCase: DecisionClarificationCase;
  shadow: DecisionSupportShadowMappingResult;
  clarificationEligible: boolean;
  clarificationRan: boolean;
  clarificationSafe: boolean;
};

function computeClarificationEligibility(shadow: DecisionSupportShadowMappingResult): boolean {
  if (shadow.eligibility.isClarificationDesired) return true;
  if (shadow.eligibility.isExistingRouteCase) return false;
  // A decision_support-desired case is also a reasonable clarification candidate whenever it is not
  // a confident, safe shadow-routable candidate itself (low confidence, handler-quality gap, or not
  // eligible at all) — this is the signal `clarify_before_decision_support`/`hybrid_shadow_then_clarify`
  // use to decide whether to clarify instead of answering.
  if (shadow.eligibility.isDecisionSupportDesired) return !shadow.isShadowRoutable;
  return false;
}

function buildCaseContext(
  architectureCase: DecisionClarificationCase,
  shadow: DecisionSupportShadowMappingResult,
  options: { runClarificationStrategy: boolean; now?: string },
): CaseContext {
  const clarificationEligible = computeClarificationEligibility(shadow);
  const clarificationRan = options.runClarificationStrategy && clarificationEligible;
  const clarificationSafe = clarificationRan
    ? evaluateClarificationSafety(
        handleClarificationResponseCandidate({ input: architectureCase.input, source: "architecture_review", now: options.now }),
      )
    : false;

  return { architectureCase, shadow, clarificationEligible, clarificationRan, clarificationSafe };
}

// ─── Per-case, per-strategy simulation ───────────────────────────────────────────────

type SimulatedMapping = {
  simulatedMappedIntent: DecisionSupportAdapterMappingSimulatedIntent;
  simulatedOutcome: DecisionSupportAdapterMappingOutcome;
  riskLevel: DecisionSupportAdapterMappingRiskLevel;
  failureReason?: string;
};

function simulateExistingRouteCase(): SimulatedMapping {
  return { simulatedMappedIntent: "current_existing_route", simulatedOutcome: "existing_route_preserved", riskLevel: "low" };
}

function simulateDecisionSupportCase(ctx: CaseContext, strategy: DecisionSupportAdapterMappingStrategy): SimulatedMapping {
  const { architectureCase, shadow } = ctx;

  switch (strategy) {
    case "keep_unsupported":
      return { simulatedMappedIntent: "unsupported", simulatedOutcome: "safe_parking", riskLevel: "low" };

    case "map_to_general_pm_advice": {
      const risk: DecisionSupportAdapterMappingRiskLevel = CRITICAL_RISK_CATEGORIES.has(architectureCase.architectureCategory)
        ? "critical"
        : "high";
      return {
        simulatedMappedIntent: "general_pm_advice",
        simulatedOutcome: "unsafe_generic_answer",
        riskLevel: risk,
        failureReason: "A generic PM-advice answer would be given for a decision-shaped question without options, tradeoffs, or evidence.",
      };
    }

    case "map_to_recommendation_request":
      return {
        simulatedMappedIntent: "recommendation_request",
        simulatedOutcome: "unsafe_playbook_answer",
        riskLevel: "high",
        failureReason: "A playbook-governance answer would be given for a decision the playbook has no authority over.",
      };

    case "shadow_candidate_handler_only": {
      if (!shadow.eligibility.isCandidateHandlerEligible) {
        return { simulatedMappedIntent: "unsupported", simulatedOutcome: "not_applicable", riskLevel: "low" };
      }
      if (shadow.isShadowRoutable) {
        return { simulatedMappedIntent: "decision_support_candidate", simulatedOutcome: "safe_shadow_candidate", riskLevel: "low" };
      }
      return {
        simulatedMappedIntent: "decision_support_candidate",
        simulatedOutcome: "requires_future_router",
        riskLevel: "medium",
        failureReason: "Candidate handler ran but is low-confidence or has a quality/collision gap — not yet shadow-routable.",
      };
    }

    case "feature_flag_default_off":
      return { simulatedMappedIntent: "feature_flag_blocked", simulatedOutcome: "feature_flag_blocked_safe", riskLevel: "low" };

    case "clarify_before_decision_support":
      if (!shadow.isShadowRoutable) {
        return ctx.clarificationSafe
          ? { simulatedMappedIntent: "clarification_response_candidate", simulatedOutcome: "safe_clarification", riskLevel: "low" }
          : {
              simulatedMappedIntent: "clarification_response_candidate",
              simulatedOutcome: "requires_future_router",
              riskLevel: "medium",
              failureReason: "Clarification strategy did not pass its safety/acceptability checks for this input.",
            };
      }
      // Confident/safe shadow candidates still get no live answer under this strategy alone —
      // it only decides whether to clarify, and defers to the current safe fallback otherwise.
      return { simulatedMappedIntent: "unsupported", simulatedOutcome: "safe_parking", riskLevel: "low" };

    case "hybrid_shadow_then_clarify":
      if (shadow.isShadowRoutable) {
        return { simulatedMappedIntent: "decision_support_candidate", simulatedOutcome: "safe_shadow_candidate", riskLevel: "low" };
      }
      return ctx.clarificationSafe
        ? { simulatedMappedIntent: "clarification_response_candidate", simulatedOutcome: "safe_clarification", riskLevel: "low" }
        : {
            simulatedMappedIntent: "clarification_response_candidate",
            simulatedOutcome: "requires_future_router",
            riskLevel: "medium",
            failureReason: "Clarification strategy did not pass its safety/acceptability checks for this input.",
          };

    case "do_not_map":
      return { simulatedMappedIntent: "unsupported", simulatedOutcome: "not_applicable", riskLevel: "low" };

    default: {
      const exhaustiveCheck: never = strategy;
      throw new Error(`decisionSupportAdapterMappingPlan: unhandled strategy '${String(exhaustiveCheck)}'.`);
    }
  }
}

function simulateClarificationCase(ctx: CaseContext, strategy: DecisionSupportAdapterMappingStrategy): SimulatedMapping {
  switch (strategy) {
    case "keep_unsupported":
    case "shadow_candidate_handler_only":
    case "feature_flag_default_off":
      // None of these strategies touch clarification-desired cases — today's documented safe
      // fallback (needs_clarification -> general_pm_advice) holds unchanged.
      return strategy === "shadow_candidate_handler_only"
        ? { simulatedMappedIntent: "general_pm_advice", simulatedOutcome: "not_applicable", riskLevel: "low" }
        : { simulatedMappedIntent: "general_pm_advice", simulatedOutcome: "safe_parking", riskLevel: "low" };

    case "map_to_general_pm_advice":
      // This is already today's documented mapping for clarification-desired cases — still flagged
      // unsafe/generic (a real clarifying question was never asked), just not a *new* regression.
      return {
        simulatedMappedIntent: "general_pm_advice",
        simulatedOutcome: "unsafe_generic_answer",
        riskLevel: "medium",
        failureReason: "A generic PM-advice answer would be given for an under-specified message instead of a clarifying question.",
      };

    case "map_to_recommendation_request":
      return {
        simulatedMappedIntent: "recommendation_request",
        simulatedOutcome: "unsafe_playbook_answer",
        riskLevel: "medium",
        failureReason: "A playbook-governance answer would be given for an under-specified message instead of a clarifying question.",
      };

    case "clarify_before_decision_support":
    case "hybrid_shadow_then_clarify":
      return ctx.clarificationSafe
        ? { simulatedMappedIntent: "clarification_response_candidate", simulatedOutcome: "safe_clarification", riskLevel: "low" }
        : {
            simulatedMappedIntent: "clarification_response_candidate",
            simulatedOutcome: "requires_future_router",
            riskLevel: "medium",
            failureReason: "Clarification strategy did not pass its safety/acceptability checks for this input.",
          };

    case "do_not_map":
      return { simulatedMappedIntent: "general_pm_advice", simulatedOutcome: "not_applicable", riskLevel: "low" };

    default: {
      const exhaustiveCheck: never = strategy;
      throw new Error(`decisionSupportAdapterMappingPlan: unhandled strategy '${String(exhaustiveCheck)}'.`);
    }
  }
}

function buildResult(ctx: CaseContext, strategy: DecisionSupportAdapterMappingStrategy): DecisionSupportAdapterMappingResult {
  const { architectureCase, shadow } = ctx;
  const isExistingRouteCase = shadow.eligibility.isExistingRouteCase;
  const isDecisionSupportDesired = shadow.eligibility.isDecisionSupportDesired;
  const isClarificationDesired = shadow.eligibility.isClarificationDesired;

  const simulated: SimulatedMapping = isExistingRouteCase
    ? simulateExistingRouteCase()
    : isDecisionSupportDesired
      ? simulateDecisionSupportCase(ctx, strategy)
      : simulateClarificationCase(ctx, strategy);

  const wiring = isExistingRouteCase || strategy === "do_not_map" ? { requiresRouterChange: false, requiresAdapterChange: false, requiresFeatureFlag: false } : STRATEGY_WIRING[strategy];

  const introducesProductionBehavior = wiring.requiresAdapterChange && !wiring.requiresFeatureFlag;

  const preservesExistingRoute = true; // No strategy in this plan ever overrides an existing_route_should_win case.

  const warnings: string[] = [];
  if (!shadow.isCurrentMappingSafe) {
    warnings.push(
      `Live currentProductionMappedIntent "${shadow.mappedIntent}" does not match this case's declared ` +
        `currentSafeMappedIntent "${architectureCase.currentSafeMappedIntent}" today.`,
    );
  }
  if (simulated.failureReason) warnings.push(simulated.failureReason);

  const mappingIsSafeForCurrentSprint = !UNSAFE_OUTCOMES.has(simulated.simulatedOutcome);
  const mappingIsRecommended = SAFE_OUTCOMES.has(simulated.simulatedOutcome) && preservesExistingRoute;

  return {
    id: architectureCase.id,
    input: architectureCase.input,
    architectureCategory: architectureCase.architectureCategory,
    desiredFutureRoute: architectureCase.desiredFutureRoute,
    currentSafeMappedIntent: architectureCase.currentSafeMappedIntent,
    targetKind: architectureCase.targetKind,
    strategy,
    currentProductionMappedIntent: shadow.mappedIntent,
    simulatedMappedIntent: simulated.simulatedMappedIntent,
    simulatedOutcome: simulated.simulatedOutcome,
    riskLevel: simulated.riskLevel,
    isDecisionSupportDesired,
    isClarificationDesired,
    isExistingRouteCase,
    candidateHandlerEligible: shadow.eligibility.isCandidateHandlerEligible,
    candidateHandlerSafe: shadow.isCandidateHandlerSafe,
    clarificationEligible: ctx.clarificationEligible,
    clarificationSafe: ctx.clarificationSafe,
    preservesExistingRoute,
    introducesProductionBehavior,
    requiresRouterChange: wiring.requiresRouterChange,
    requiresAdapterChange: wiring.requiresAdapterChange,
    requiresFeatureFlag: wiring.requiresFeatureFlag,
    shouldExecuteAction: false,
    mappingIsRecommended,
    mappingIsSafeForCurrentSprint,
    failureReason: simulated.failureReason,
    warnings,
  } satisfies DecisionSupportAdapterMappingResult;
}

// ─── Public API ───────────────────────────────────────────────────────────────────────

/**
 * Simulates a single strategy against a single case. Computes its own shadow-mapping and
 * clarification context internally (via a one-case call to `runDecisionSupportShadowMappingEvaluation`
 * and, if eligible, `handleClarificationResponseCandidate`) — convenient for ad hoc checks; prefer
 * `runDecisionSupportAdapterMappingPlan` for evaluating a whole corpus, which computes this context
 * once per case rather than once per (case, strategy) pair.
 */
export function simulateDecisionSupportAdapterMapping(
  architectureCase: DecisionClarificationCase,
  strategy: DecisionSupportAdapterMappingStrategy,
  options: DecisionSupportAdapterMappingPlanOptions = {},
): DecisionSupportAdapterMappingResult {
  const runCandidateHandler = options.runCandidateHandler ?? true;
  const runClarificationStrategy = options.runClarificationStrategy ?? true;

  const [shadow] = runDecisionSupportShadowMappingEvaluation([architectureCase], {
    includeClarificationCases: true,
    includeExistingRouteCases: true,
    runCandidateHandler,
    now: options.now,
  });

  const ctx = buildCaseContext(architectureCase, shadow, { runClarificationStrategy, now: options.now });
  return buildResult(ctx, strategy);
}

/**
 * Runs every requested strategy (default: all eight) against every case in the corpus. For each
 * case, the Sprint 20R/21R shadow-mapping evaluation and, where eligible, the Sprint 22R
 * clarification strategy are each computed exactly once and reused across all strategies — this
 * function never re-derives eligibility or re-runs a handler per strategy. Pure — never mutates
 * `cases`, never calls the router, composer, any production handler, a database, Supabase, or any
 * external service, never calls `fetch` or an LLM, and never activates a feature flag.
 */
export function runDecisionSupportAdapterMappingPlan(
  cases: DecisionClarificationCase[],
  options: DecisionSupportAdapterMappingPlanOptions = {},
): DecisionSupportAdapterMappingResult[] {
  const strategies = options.strategies ?? ALL_DECISION_SUPPORT_ADAPTER_MAPPING_STRATEGIES;
  const includeClarificationCases = options.includeClarificationCases ?? true;
  const includeExistingRouteCases = options.includeExistingRouteCases ?? true;
  const runCandidateHandler = options.runCandidateHandler ?? true;
  const runClarificationStrategy = options.runClarificationStrategy ?? true;

  const shadowResults = runDecisionSupportShadowMappingEvaluation(cases, {
    includeClarificationCases,
    includeExistingRouteCases,
    runCandidateHandler,
    now: options.now,
  });

  const architectureById = new Map(cases.map((c) => [c.id, c]));

  const contexts: CaseContext[] = shadowResults.map((shadow) => {
    const architectureCase = architectureById.get(shadow.id);
    if (!architectureCase) {
      throw new Error(`decisionSupportAdapterMappingPlan: missing architecture case for id "${shadow.id}".`);
    }
    return buildCaseContext(architectureCase, shadow, { runClarificationStrategy, now: options.now });
  });

  const results: DecisionSupportAdapterMappingResult[] = [];
  for (const strategy of strategies) {
    for (const ctx of contexts) {
      results.push(buildResult(ctx, strategy));
    }
  }
  return results;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

const REPRESENTATIVE_LIMIT = 5;

const TIE_BREAK_PRIORITY: DecisionSupportAdapterMappingStrategy[] = [
  "hybrid_shadow_then_clarify",
  "shadow_candidate_handler_only",
  "clarify_before_decision_support",
  "feature_flag_default_off",
  "keep_unsupported",
  "do_not_map",
  "map_to_recommendation_request",
  "map_to_general_pm_advice",
];

function tieBreakIndex(strategy: DecisionSupportAdapterMappingStrategy): number {
  const index = TIE_BREAK_PRIORITY.indexOf(strategy);
  return index === -1 ? TIE_BREAK_PRIORITY.length : index;
}

function summarizeStrategy(
  strategy: DecisionSupportAdapterMappingStrategy,
  results: DecisionSupportAdapterMappingResult[],
): DecisionSupportAdapterMappingStrategySummary {
  const totalCases = results.length;
  const decisionSupportCases = results.filter((r) => r.isDecisionSupportDesired).length;
  const clarificationCases = results.filter((r) => r.isClarificationDesired).length;
  const existingRouteCases = results.filter((r) => r.isExistingRouteCase).length;

  const riskyOutcomeCount = results.filter((r) => UNSAFE_OUTCOMES.has(r.simulatedOutcome)).length;
  const safeOutcomeCount = totalCases - riskyOutcomeCount;
  const criticalRiskCount = results.filter((r) => r.riskLevel === "critical").length;
  const preservesExistingRouteCount = results.filter((r) => r.preservesExistingRoute).length;
  const candidateHandlerSafeCount = results.filter((r) => r.candidateHandlerSafe).length;
  const clarificationSafeCount = results.filter((r) => r.clarificationSafe).length;
  const introducesProductionBehaviorCount = results.filter((r) => r.introducesProductionBehavior).length;
  const requiresRouterChangeCount = results.filter((r) => r.requiresRouterChange).length;
  const requiresAdapterChangeCount = results.filter((r) => r.requiresAdapterChange).length;
  const requiresFeatureFlagCount = results.filter((r) => r.requiresFeatureFlag).length;

  const safeOutcomeRate = rateOf(safeOutcomeCount, totalCases);
  const riskyOutcomeRate = rateOf(riskyOutcomeCount, totalCases);
  const preservesExistingRouteRate = rateOf(preservesExistingRouteCount, totalCases);

  const blockerReasons: string[] = [];
  if (riskyOutcomeCount > 0) {
    blockerReasons.push(`${riskyOutcomeCount} case(s) would receive an unsafe outcome (unsafe_generic_answer/unsafe_playbook_answer).`);
  }
  if (criticalRiskCount > 0) blockerReasons.push(`${criticalRiskCount} case(s) carry critical risk.`);
  if (preservesExistingRouteRate < 100) blockerReasons.push("Does not preserve 100% of existing_route_should_win cases.");
  if (strategy === "do_not_map") {
    blockerReasons.push(
      "Corpus evidence already supports moving past documentation-only planning (candidateHandlerSafeRate/safetyPassRate are both high) — deferring further offers no new safety benefit.",
    );
  }

  const recommendedForSprint24 =
    strategy !== "do_not_map" && riskyOutcomeCount === 0 && criticalRiskCount === 0 && preservesExistingRouteRate === 100;

  const representativeSafeCases = results.filter((r) => !UNSAFE_OUTCOMES.has(r.simulatedOutcome)).slice(0, REPRESENTATIVE_LIMIT);
  const representativeRiskyCases = results.filter((r) => UNSAFE_OUTCOMES.has(r.simulatedOutcome)).slice(0, REPRESENTATIVE_LIMIT);

  return {
    strategy,
    totalCases,
    decisionSupportCases,
    clarificationCases,
    existingRouteCases,
    safeOutcomeCount,
    safeOutcomeRate,
    riskyOutcomeCount,
    riskyOutcomeRate,
    criticalRiskCount,
    preservesExistingRouteCount,
    preservesExistingRouteRate,
    candidateHandlerSafeCount,
    clarificationSafeCount,
    introducesProductionBehaviorCount,
    requiresRouterChangeCount,
    requiresAdapterChangeCount,
    requiresFeatureFlagCount,
    recommendedForSprint24,
    blockerReasons,
    representativeSafeCases,
    representativeRiskyCases,
  };
}

const NON_PRODUCTION_SAFE_CANDIDATES: DecisionSupportAdapterMappingStrategy[] = [
  "keep_unsupported",
  "shadow_candidate_handler_only",
  "hybrid_shadow_then_clarify",
  "feature_flag_default_off",
];

function pickBestStrategy(
  strategySummaries: Record<DecisionSupportAdapterMappingStrategy, DecisionSupportAdapterMappingStrategySummary>,
  strategies: DecisionSupportAdapterMappingStrategy[],
): DecisionSupportAdapterMappingStrategy {
  const eligible = strategies.filter((s) => {
    const summary = strategySummaries[s];
    return summary.criticalRiskCount === 0 && summary.preservesExistingRouteRate === 100 && summary.introducesProductionBehaviorCount === 0;
  });
  const pool = eligible.length > 0 ? eligible : strategies;
  return pool
    .slice()
    .sort((a, b) => {
      const rateDiff = strategySummaries[b].safeOutcomeRate - strategySummaries[a].safeOutcomeRate;
      if (rateDiff !== 0) return rateDiff;
      return tieBreakIndex(a) - tieBreakIndex(b);
    })[0];
}

function pickWorstStrategy(
  strategySummaries: Record<DecisionSupportAdapterMappingStrategy, DecisionSupportAdapterMappingStrategySummary>,
  strategies: DecisionSupportAdapterMappingStrategy[],
): DecisionSupportAdapterMappingStrategy {
  return strategies
    .slice()
    .sort((a, b) => {
      const summaryA = strategySummaries[a];
      const summaryB = strategySummaries[b];
      const rateDiff = summaryA.safeOutcomeRate - summaryB.safeOutcomeRate;
      if (rateDiff !== 0) return rateDiff;
      return summaryB.criticalRiskCount - summaryA.criticalRiskCount;
    })[0];
}

function pickSafestNonProductionStrategy(
  strategySummaries: Record<DecisionSupportAdapterMappingStrategy, DecisionSupportAdapterMappingStrategySummary>,
  strategies: DecisionSupportAdapterMappingStrategy[],
): DecisionSupportAdapterMappingStrategy {
  const candidates = NON_PRODUCTION_SAFE_CANDIDATES.filter((s) => strategies.includes(s));
  const pool = candidates.length > 0 ? candidates : strategies;
  return pool
    .slice()
    .sort((a, b) => {
      const summaryA = strategySummaries[a];
      const summaryB = strategySummaries[b];
      const rateDiff = summaryB.safeOutcomeRate - summaryA.safeOutcomeRate;
      if (rateDiff !== 0) return rateDiff;
      const usefulnessDiff =
        summaryB.candidateHandlerSafeCount + summaryB.clarificationSafeCount - (summaryA.candidateHandlerSafeCount + summaryA.clarificationSafeCount);
      if (usefulnessDiff !== 0) return usefulnessDiff;
      return tieBreakIndex(a) - tieBreakIndex(b);
    })[0];
}

function pickSafestFutureIntegrationStrategy(
  strategySummaries: Record<DecisionSupportAdapterMappingStrategy, DecisionSupportAdapterMappingStrategySummary>,
  strategies: DecisionSupportAdapterMappingStrategy[],
): DecisionSupportAdapterMappingStrategy {
  const hybrid = strategySummaries["hybrid_shadow_then_clarify"];
  if (
    strategies.includes("hybrid_shadow_then_clarify") &&
    hybrid &&
    hybrid.safeOutcomeRate >= 85 &&
    hybrid.criticalRiskCount === 0 &&
    hybrid.preservesExistingRouteRate === 100
  ) {
    return "hybrid_shadow_then_clarify";
  }
  if (strategies.includes("shadow_candidate_handler_only")) return "shadow_candidate_handler_only";
  return pickSafestNonProductionStrategy(strategySummaries, strategies);
}

function computeRecommendedSprint24Strategy(
  strategySummaries: Record<DecisionSupportAdapterMappingStrategy, DecisionSupportAdapterMappingStrategySummary>,
  strategies: DecisionSupportAdapterMappingStrategy[],
): { recommendedSprint24Strategy: DecisionSupportAdapterMappingStrategy; recommendation: string } {
  const hybrid = strategySummaries["hybrid_shadow_then_clarify"];
  if (
    strategies.includes("hybrid_shadow_then_clarify") &&
    hybrid &&
    hybrid.safeOutcomeRate >= 85 &&
    hybrid.criticalRiskCount === 0 &&
    hybrid.preservesExistingRouteRate === 100 &&
    hybrid.candidateHandlerSafeCount > 0 &&
    hybrid.clarificationSafeCount > 0
  ) {
    return {
      recommendedSprint24Strategy: "hybrid_shadow_then_clarify",
      recommendation:
        `hybrid_shadow_then_clarify: safeOutcomeRate (${hybrid.safeOutcomeRate}%) is at/above the 85% floor, ` +
        `criticalRiskCount is 0, existing routes are 100% preserved, and it produces both ` +
        `${hybrid.candidateHandlerSafeCount} safe shadow candidates and ${hybrid.clarificationSafeCount} safe ` +
        "clarifications — the widest safe coverage of any strategy this plan can recommend.",
    };
  }

  const shadow = strategySummaries["shadow_candidate_handler_only"];
  if (strategies.includes("shadow_candidate_handler_only") && shadow && shadow.safeOutcomeRate >= 70 && shadow.criticalRiskCount === 0) {
    return {
      recommendedSprint24Strategy: "shadow_candidate_handler_only",
      recommendation:
        `shadow_candidate_handler_only: safeOutcomeRate (${shadow.safeOutcomeRate}%) is healthy but the hybrid ` +
        "combination did not clear its bar — a shadow-only plan is the next safest step, though it will not " +
        "cover low-confidence decision_support cases.",
    };
  }

  const clarify = strategySummaries["clarify_before_decision_support"];
  if (strategies.includes("clarify_before_decision_support") && clarify && clarify.clarificationSafeCount > clarify.candidateHandlerSafeCount) {
    return {
      recommendedSprint24Strategy: "clarify_before_decision_support",
      recommendation:
        "clarify_before_decision_support: clarification-safe cases outnumber candidate-handler-safe cases — " +
        "most of the risk is a lack of context, not a handler quality gap, so a clarification-gated plan is safest.",
    };
  }

  return {
    recommendedSprint24Strategy: "keep_unsupported",
    recommendation:
      "keep_unsupported: no simulated strategy cleared the bar for a shadow or clarification-gated plan yet — " +
      "the safe, documented fallback should hold while the gaps found here are hardened.",
  };
}

function computeRecommendedNextSprint(
  recommendedSprint24Strategy: DecisionSupportAdapterMappingStrategy,
): DecisionSupportAdapterMappingNextSprintRecommendation {
  if (recommendedSprint24Strategy === "hybrid_shadow_then_clarify" || recommendedSprint24Strategy === "shadow_candidate_handler_only") {
    return "Sprint 24R — Decision Support Shadow Mode Prep";
  }
  if (recommendedSprint24Strategy === "clarify_before_decision_support") {
    return "Sprint 24R — Clarification-Gated Decision Support Plan";
  }
  return "Sprint 24R — Adapter Mapping Risk Hardening";
}

function computeCurrentBehaviorSummary(results: DecisionSupportAdapterMappingResult[], strategies: DecisionSupportAdapterMappingStrategy[]): string {
  const firstStrategy = strategies[0];
  const oneStrategySlice = results.filter((r) => r.strategy === firstStrategy);
  const decisionSupportCount = oneStrategySlice.filter((r) => r.isDecisionSupportDesired).length;
  const clarificationCount = oneStrategySlice.filter((r) => r.isClarificationDesired).length;
  const existingRouteCount = oneStrategySlice.filter((r) => r.isExistingRouteCase).length;
  return (
    `Today (Sprint 10R adapter, unchanged by this sprint): ${decisionSupportCount} decision_support-desired cases map to ` +
    `"unsupported"; ${clarificationCount} needs_clarification-desired cases map to "general_pm_advice"; ` +
    `${existingRouteCount} existing_route_should_win cases already route correctly. No case in this corpus is answered ` +
    "with a real decision_support handler in production today."
  );
}

/**
 * Turns a `runDecisionSupportAdapterMappingPlan()` result array into a plan-ready report: per-strategy
 * safety/coverage/wiring metrics, the best/worst/safest-non-production/safest-future-integration
 * strategies, today's actual behavior, and a Sprint 24R strategy + next-sprint recommendation. Pure —
 * takes an already-computed result array rather than re-running anything.
 */
export function summarizeDecisionSupportAdapterMappingPlan(
  results: DecisionSupportAdapterMappingResult[],
): DecisionSupportAdapterMappingPlanSummary {
  const strategies = Array.from(new Set(results.map((r) => r.strategy)));
  const strategySummaries = Object.fromEntries(
    strategies.map((strategy) => [strategy, summarizeStrategy(strategy, results.filter((r) => r.strategy === strategy))]),
  ) as Record<DecisionSupportAdapterMappingStrategy, DecisionSupportAdapterMappingStrategySummary>;

  const totalCases = strategies.length > 0 ? strategySummaries[strategies[0]].totalCases : 0;

  const bestStrategy = pickBestStrategy(strategySummaries, strategies);
  const worstStrategy = pickWorstStrategy(strategySummaries, strategies);
  const safestNonProductionStrategy = pickSafestNonProductionStrategy(strategySummaries, strategies);
  const safestFutureIntegrationStrategy = pickSafestFutureIntegrationStrategy(strategySummaries, strategies);
  const currentBehaviorSummary = computeCurrentBehaviorSummary(results, strategies);
  const { recommendedSprint24Strategy, recommendation: strategyRecommendation } = computeRecommendedSprint24Strategy(
    strategySummaries,
    strategies,
  );
  const recommendedNextSprint = computeRecommendedNextSprint(recommendedSprint24Strategy);

  return {
    totalCases,
    strategiesEvaluated: strategies.length,
    strategySummaries,
    bestStrategy,
    worstStrategy,
    safestNonProductionStrategy,
    safestFutureIntegrationStrategy,
    currentBehaviorSummary,
    recommendedSprint24Strategy,
    recommendedNextSprint,
    recommendation: `${strategyRecommendation} Next: ${recommendedNextSprint}.`,
  };
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 23R adapter mapping plan — mirrors the style of
 * `explainDecisionSupportShadowMappingEvaluation()` (Sprint 20R) and
 * `explainClarificationResponseStrategy()` (Sprint 22R). See
 * `docs/conversational-brain-decision-support-adapter-mapping-plan.md` for full context.
 */
export function explainDecisionSupportAdapterMappingPlan(): DecisionSupportAdapterMappingPlanExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-adapter-mapping-plan",
    purpose:
      "Simulates eight candidate strategies for how decision_support (and needs_clarification) could eventually be " +
      "mapped by intentCompatibilityAdapter.ts, and compares them on safety, existing-route preservation, and wiring " +
      "cost, so Sprint 24R can pick a strategy with evidence instead of guessing — without changing the adapter, " +
      "router, composer, any handler, the endpoint, or any feature flag.",
    doesNot: [
      "Does not import or call router/brainRouter.ts, composer/responseComposer.ts, any handlers/*.ts, or conversationalBrainGateway.ts.",
      "Does not touch POST /api/command-center/chat.",
      "Does not read or write a database, call Supabase, send email, create tasks, or execute any action.",
      "Does not call an LLM or any external API — fully deterministic and local, no fetch.",
      "Does not activate a feature flag or the enriched classifier in production.",
      "Does not modify classifier/intentClassifier.rules.ts, intent-patterns.ts, or intentCompatibilityAdapter.ts's mapping table.",
      "Does not connect decision_support to the router — every simulated result carries shouldExecuteAction: false.",
    ],
    nonGoals: [
      "Integrate any strategy into the router.",
      "Change the endpoint, composer, or any production handler.",
      "Change classifier patterns or the adapter mapping table.",
      "Activate any feature flag.",
      "Create a new Context Resolver, Router, or Composer.",
      "Calibrate general_pm_advice vocabulary.",
      "Implement a persistent clarification loop.",
    ],
    strategiesOverview: [
      "keep_unsupported: preserve today's Sprint 10R safe fallback (decision_support -> unsupported) — safe, but no UX improvement.",
      "map_to_general_pm_advice: route decision_support to the existing general_pm_advice route — unsafe, loses options/tradeoffs/evidence.",
      "map_to_recommendation_request: route decision_support to playbook_analysis — unsafe, implies governed authority the playbook does not have over the decision.",
      "shadow_candidate_handler_only: run the Sprint 19R candidate handler offline for eligible cases, never shown to the user.",
      "feature_flag_default_off: plan a future integration gated behind a default-off flag — not activated this sprint.",
      "clarify_before_decision_support: ask a clarifying question first for low-confidence/unroutable decision_support cases and all clarification-desired cases.",
      "hybrid_shadow_then_clarify: shadow-route confident/safe candidates, clarify the rest — combines the two safest capabilities built so far.",
      "do_not_map: defer every mapping decision — documented as no longer justified given how much safe evidence already exists.",
    ],
    strategyRisks: [
      "map_to_general_pm_advice and map_to_recommendation_request are the only two strategies that ever produce an unsafe_* outcome in this plan.",
      "Every other strategy's worst outcome is 'requires_future_router' (a quality gap, never a wrong answer shown to a user) or 'not_applicable'.",
      "No strategy in this plan overrides an existing_route_should_win case — preservesExistingRouteRate is 100% for all eight by design.",
    ],
    whyMapToGeneralPmAdviceIsUnsafe:
      "It answers a decision-shaped question with generic PM coaching that has no named options, tradeoffs, risks, or evidence needs — " +
      "exactly the collision Sprint 21R spent its whole budget reducing (playbook/general_pm collisions fell from 10 to 1). Adopting this " +
      "strategy would reintroduce that risk deliberately, at the adapter level, for every decision_support case.",
    whyMapToRecommendationRequestIsUnsafe:
      "It answers a decision the user must make with an answer framed as the playbook's own governed recommendation — confusing 'what should " +
      "I decide' with 'what does the playbook say', and risking the same decision_support/playbook_analysis collision Sprint 18R documented for " +
      "dc-13/dc-15/dc-17/dc-19.",
    whyKeepUnsupportedIsSafeButInsufficient:
      "It is the only strategy that changes nothing — zero risk, zero wiring cost — but it also never uses the Sprint 19R candidate handler or " +
      "the Sprint 22R clarification strategy that this program has spent three sprints building and hardening, so it leaves real, already-safe " +
      "capability unused.",
    whyShadowCandidateHandlerOnlyIsSafer:
      "It never shows a candidate result to a user — isShadowRoutable-eligible cases are only evaluated offline — so it carries the same zero " +
      "risk as keep_unsupported while actually exercising the candidate handler's 100% candidateHandlerSafeRate, which is exactly the evidence " +
      "Sprint 24R needs before any real integration.",
    whyClarifyBeforeDecisionSupportIsNeeded:
      "shadowRoutableRate is only 40% (Sprint 20R/21R) — most decision_support cases are not confident/safe enough to shadow-route today. A " +
      "clarify-first fallback for the other 60% (plus all needs_clarification-desired cases) means no decision_support case is ever left with " +
      "only the generic 'unsupported'/'general_pm_advice' non-answer; it either gets a safe shadow candidate or a safe clarifying question.",
    whyHybridShadowThenClarifyIsLikelySafest:
      "It combines the previous two: confident/safe candidates go to shadow mode (never shown to the user), everything else gets a real " +
      "clarifying question instead of silence — covering both the 40% shadowRoutableRate and the 60% gap, with zero unsafe outcomes and 100% " +
      "existing-route preservation, while still requiring no live production change this sprint.",
    whyProductionIsNotChanged:
      "Every strategy above is simulated by calling the existing, already-isolated Sprint 19R/20R/21R/22R modules with this corpus — none of " +
      "them are imported by intentCompatibilityAdapter.ts, brainRouter.ts, responseComposer.ts, any handlers/*.ts, or POST " +
      "/api/command-center/chat, and this module adds no new import into any of those files.",
  };
}
