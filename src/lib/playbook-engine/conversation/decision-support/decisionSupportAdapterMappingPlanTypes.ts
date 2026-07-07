/**
 * Sprint 23R — Decision Support Adapter Mapping Plan: types.
 *
 * Pure type definitions for a read-only, offline planner/simulator that compares eight candidate
 * strategies for how `decision_support` (and its `needs_clarification` sibling) could eventually be
 * mapped by `intentCompatibilityAdapter.ts` — without changing that adapter, the router, the
 * composer, any production handler, or the endpoint. It answers, with simulated evidence rather than
 * assumptions, which mapping strategy is safest to plan for next (Sprint 24R), reusing the Sprint 19R
 * Decision Support Candidate Handler, the Sprint 22R Clarification Response Strategy, and the Sprint
 * 20R/21R shadow mapping evaluator against the Sprint 18R architecture corpus
 * (`tests/fixtures/conversational-brain-decision-clarification-cases.ts`). See
 * `docs/conversational-brain-decision-support-adapter-mapping-plan.md` for the full design writeup.
 */

import type {
  DecisionClarificationArchitectureCategory,
  DecisionClarificationCase,
  DecisionClarificationDesiredFutureRoute,
  DecisionClarificationTargetKind,
} from "../classifier/decisionClarificationArchitectureReview";
import type { ConversationIntent as ProductionConversationIntent } from "../types";

// ─── Strategy ──────────────────────────────────────────────────────────────────────

export type DecisionSupportAdapterMappingStrategy =
  | "keep_unsupported"
  | "map_to_general_pm_advice"
  | "map_to_recommendation_request"
  | "shadow_candidate_handler_only"
  | "feature_flag_default_off"
  | "clarify_before_decision_support"
  | "hybrid_shadow_then_clarify"
  | "do_not_map";

// ─── Input ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportAdapterMappingPlanOptions = {
  /** Which strategies to simulate. Defaults to all eight, in the order documented above. */
  strategies?: DecisionSupportAdapterMappingStrategy[];
  /** Whether clarification_* cases are included in the returned results. Default true. */
  includeClarificationCases?: boolean;
  /** Whether existing_route_should_win cases are included in the returned results. Default true. */
  includeExistingRouteCases?: boolean;
  /** Whether the Sprint 19R candidate handler is actually invoked for eligible cases. Default true. */
  runCandidateHandler?: boolean;
  /** Whether the Sprint 22R clarification strategy is actually invoked for eligible cases. Default true. */
  runClarificationStrategy?: boolean;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

/** Documents the full input shape this planner conceptually accepts (`cases` + `strategy` + options).
 * The actual function signatures are `runDecisionSupportAdapterMappingPlan(cases, options?)` (all
 * strategies at once) and `simulateDecisionSupportAdapterMapping(case, strategy, options?)` (one
 * case, one strategy). */
export type DecisionSupportAdapterMappingPlanInput = DecisionSupportAdapterMappingPlanOptions & {
  cases: DecisionClarificationCase[];
  strategy: DecisionSupportAdapterMappingStrategy;
};

// ─── Simulated intent / outcome / risk ──────────────────────────────────────────────

export type DecisionSupportAdapterMappingSimulatedIntent =
  | "unsupported"
  | "general_pm_advice"
  | "recommendation_request"
  | "decision_support_candidate"
  | "clarification_response_candidate"
  | "feature_flag_blocked"
  | "current_existing_route";

export type DecisionSupportAdapterMappingRiskLevel = "low" | "medium" | "high" | "critical";

export type DecisionSupportAdapterMappingOutcome =
  | "safe_parking"
  | "unsafe_generic_answer"
  | "unsafe_playbook_answer"
  | "safe_shadow_candidate"
  | "safe_clarification"
  | "feature_flag_blocked_safe"
  | "existing_route_preserved"
  | "not_applicable"
  | "requires_future_router";

// ─── Result ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportAdapterMappingResult = {
  id: string;
  input: string;
  architectureCategory: DecisionClarificationArchitectureCategory;
  desiredFutureRoute: DecisionClarificationDesiredFutureRoute;
  currentSafeMappedIntent: ProductionConversationIntent;
  targetKind: DecisionClarificationTargetKind;
  strategy: DecisionSupportAdapterMappingStrategy;
  /** Today's live adapter mapping for this input, per the Sprint 20R/21R shadow evaluator
   * (`runDecisionSupportShadowMappingEvaluation`'s `mappedIntent`) — unaffected by `strategy`. */
  currentProductionMappedIntent: ProductionConversationIntent;
  simulatedMappedIntent: DecisionSupportAdapterMappingSimulatedIntent;
  simulatedOutcome: DecisionSupportAdapterMappingOutcome;
  riskLevel: DecisionSupportAdapterMappingRiskLevel;
  isDecisionSupportDesired: boolean;
  isClarificationDesired: boolean;
  isExistingRouteCase: boolean;
  /** Case-level fact from the Sprint 20R/21R shadow evaluator — unaffected by `strategy`. */
  candidateHandlerEligible: boolean;
  /** Case-level fact from the Sprint 20R/21R shadow evaluator — unaffected by `strategy`. */
  candidateHandlerSafe: boolean;
  /** Case-level fact: whether the Sprint 22R clarification strategy is a reasonable response for
   * this case (clarification-desired, or a low-confidence/unroutable decision_support case) —
   * unaffected by `strategy`. */
  clarificationEligible: boolean;
  /** Case-level fact: whether the Sprint 22R clarification strategy passed its safety/acceptability
   * checks for this input — unaffected by `strategy`. */
  clarificationSafe: boolean;
  preservesExistingRoute: boolean;
  introducesProductionBehavior: boolean;
  requiresRouterChange: boolean;
  requiresAdapterChange: boolean;
  requiresFeatureFlag: boolean;
  /** Always `false` — this planner never executes an action, real or simulated. */
  shouldExecuteAction: false;
  mappingIsRecommended: boolean;
  mappingIsSafeForCurrentSprint: boolean;
  failureReason?: string;
  warnings: string[];
};

// ─── Strategy summary ────────────────────────────────────────────────────────────────

export type DecisionSupportAdapterMappingStrategySummary = {
  strategy: DecisionSupportAdapterMappingStrategy;
  totalCases: number;
  decisionSupportCases: number;
  clarificationCases: number;
  existingRouteCases: number;
  safeOutcomeCount: number;
  safeOutcomeRate: number;
  riskyOutcomeCount: number;
  riskyOutcomeRate: number;
  criticalRiskCount: number;
  preservesExistingRouteCount: number;
  preservesExistingRouteRate: number;
  candidateHandlerSafeCount: number;
  clarificationSafeCount: number;
  introducesProductionBehaviorCount: number;
  requiresRouterChangeCount: number;
  requiresAdapterChangeCount: number;
  requiresFeatureFlagCount: number;
  recommendedForSprint24: boolean;
  blockerReasons: string[];
  representativeSafeCases: DecisionSupportAdapterMappingResult[];
  representativeRiskyCases: DecisionSupportAdapterMappingResult[];
};

// ─── Plan summary ──────────────────────────────────────────────────────────────────────

export type DecisionSupportAdapterMappingNextSprintRecommendation =
  | "Sprint 24R — Decision Support Shadow Mode Prep"
  | "Sprint 24R — Clarification-Gated Decision Support Plan"
  | "Sprint 24R — Adapter Mapping Risk Hardening";

export type DecisionSupportAdapterMappingPlanSummary = {
  totalCases: number;
  strategiesEvaluated: number;
  strategySummaries: Record<DecisionSupportAdapterMappingStrategy, DecisionSupportAdapterMappingStrategySummary>;
  bestStrategy: DecisionSupportAdapterMappingStrategy;
  worstStrategy: DecisionSupportAdapterMappingStrategy;
  safestNonProductionStrategy: DecisionSupportAdapterMappingStrategy;
  safestFutureIntegrationStrategy: DecisionSupportAdapterMappingStrategy;
  currentBehaviorSummary: string;
  recommendedSprint24Strategy: DecisionSupportAdapterMappingStrategy;
  recommendedNextSprint: DecisionSupportAdapterMappingNextSprintRecommendation;
  recommendation: string;
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportAdapterMappingPlanExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  nonGoals: string[];
  strategiesOverview: string[];
  strategyRisks: string[];
  whyMapToGeneralPmAdviceIsUnsafe: string;
  whyMapToRecommendationRequestIsUnsafe: string;
  whyKeepUnsupportedIsSafeButInsufficient: string;
  whyShadowCandidateHandlerOnlyIsSafer: string;
  whyClarifyBeforeDecisionSupportIsNeeded: string;
  whyHybridShadowThenClarifyIsLikelySafest: string;
  whyProductionIsNotChanged: string;
};
