/**
 * Sprint 18R — Decision Support + Clarification Architecture Review.
 *
 * Sprint 17R's boundary review proved that `general_pm_advice` should not absorb `decision_support`
 * or `needs_clarification` vocabulary, and recommended a dedicated architecture review for both
 * before any further vocabulary calibration. This module is that review's pure, read-only evaluator:
 * given the Sprint 18R corpus (`tests/fixtures/conversational-brain-decision-clarification-cases.ts`),
 * it runs the existing Sprint 10R shadow comparison (`intentCompatibilityAdapter.ts`) for each case
 * and measures (a) whether today's documented "safe" temporary mapping
 * (`decision_support -> unsupported`, `needs_clarification -> general_pm_advice`) actually holds live,
 * (b) whether the future route a case should eventually get is already reachable today, and (c) where
 * a `decision_support`/`needs_clarification` candidate collides with one of the eight other
 * categories in practice.
 *
 * Like every module in this package tree, this does not call the router, composer, or any handler;
 * does not touch `POST /api/command-center/chat`; does not read/write a database, call Supabase,
 * send email, or create a task; does not activate the enriched classifier anywhere (no feature flag
 * wired to anything); and does not create a `decision_support` production handler or a real
 * clarification loop — both remain documented, unimplemented gaps after this sprint.
 */

import type { ConversationIntent as ProductionConversationIntent } from "../types";
import type {
  ConversationIntentFamily as EnrichedConversationIntentFamily,
  ConversationIntentType as EnrichedConversationIntentType,
} from "@/lib/conversational-brain";

import {
  runIntentClassifierShadowComparison,
  type IntentMappingWarning,
  type ShadowComparisonOptions,
} from "./intentCompatibilityAdapter";

// ─── Corpus-facing types ──────────────────────────────────────────────────────────

export type DecisionClarificationArchitectureCategory =
  | "decision_support_clear"
  | "decision_support_vs_playbook"
  | "decision_support_vs_general_pm"
  | "decision_support_vs_risk"
  | "decision_support_vs_closure"
  | "decision_support_vs_governance"
  | "clarification_clear"
  | "clarification_vs_general_pm"
  | "clarification_vs_status"
  | "clarification_vs_risk"
  | "clarification_vs_task"
  | "clarification_vs_communication"
  | "existing_route_should_win";

export type DecisionClarificationDesiredFutureRoute =
  | "decision_support"
  | "needs_clarification"
  | "general_pm_advice"
  | "project_status_question"
  | "recommendation_request"
  | "risk_analysis"
  | "communication_draft"
  | "closure_question"
  | "billing_question"
  | "governance_question"
  | "audit_question"
  | "task_or_action_request"
  | "unsupported";

export type DecisionClarificationTargetKind = "future_architecture" | "clarification_strategy" | "existing_production_route";

export type DecisionClarificationRiskLevel = "low" | "medium" | "high";

export type DecisionClarificationCase = {
  /** Unique identifier within the corpus, e.g. "dc-01". */
  id: string;
  /** Natural-language PM phrase, in Spanish, as a real PMFreak user would type it. */
  input: string;
  architectureCategory: DecisionClarificationArchitectureCategory;
  desiredFutureRoute: DecisionClarificationDesiredFutureRoute;
  /** The production-safe intent this message maps to *today*, per the Sprint 10R adapter's
   * documented mapping decisions (`decision_support -> unsupported`,
   * `needs_clarification -> general_pm_advice`) or, for `existing_route_should_win` cases, the
   * production intent that already correctly serves this message. */
  currentSafeMappedIntent: ProductionConversationIntent;
  targetKind: DecisionClarificationTargetKind;
  /** Why the policy says this case belongs where it does — required, never inferred at runtime. */
  rationale: string;
  riskLevel: DecisionClarificationRiskLevel;
  requiresNewHandler: boolean;
  requiresClarification: boolean;
  /** Always `false` in this corpus — Sprint 18R never executes an action. */
  shouldExecuteAction: false;
  notes?: string;
};

// ─── Family-bucket helpers (mirrors generalPmAdviceBoundaryReview.ts's approach) ───

type FamilyBucket =
  | "general_pm_advice"
  | "playbook_analysis"
  | "project_status"
  | "task_action"
  | "communication_draft"
  | "closure_billing"
  | "risk_issue_dependency"
  | "governance_audit"
  | "decision_support"
  | "needs_clarification"
  | "other";

function mapProductionIntentToFamilyBucket(intent: ProductionConversationIntent): FamilyBucket {
  switch (intent) {
    case "general_pm_advice":
      return "general_pm_advice";
    case "project_status_question":
      return "project_status";
    case "recommendation_request":
      return "playbook_analysis";
    case "risk_analysis":
      return "risk_issue_dependency";
    case "communication_draft":
      return "communication_draft";
    case "closure_question":
    case "billing_question":
      return "closure_billing";
    case "governance_question":
    case "audit_question":
      return "governance_audit";
    case "task_or_action_request":
      return "task_action";
    case "clarification":
      return "needs_clarification";
    case "unsupported":
    case "unknown":
      return "other";
    default: {
      const exhaustiveCheck: never = intent;
      throw new Error(`decisionClarificationArchitectureReview: unmapped production intent '${String(exhaustiveCheck)}'.`);
    }
  }
}

function mapEnrichedFamilyToFamilyBucket(family: EnrichedConversationIntentFamily): FamilyBucket {
  if (family === "unknown") return "other";
  return family;
}

function mapDesiredFutureRouteToFamilyBucket(route: DecisionClarificationDesiredFutureRoute): FamilyBucket {
  switch (route) {
    case "decision_support":
      return "decision_support";
    case "needs_clarification":
      return "needs_clarification";
    case "general_pm_advice":
      return "general_pm_advice";
    case "project_status_question":
      return "project_status";
    case "recommendation_request":
      return "playbook_analysis";
    case "risk_analysis":
      return "risk_issue_dependency";
    case "communication_draft":
      return "communication_draft";
    case "closure_question":
    case "billing_question":
      return "closure_billing";
    case "governance_question":
    case "audit_question":
      return "governance_audit";
    case "task_or_action_request":
      return "task_action";
    case "unsupported":
      return "other";
    default: {
      const exhaustiveCheck: never = route;
      throw new Error(`decisionClarificationArchitectureReview: unmapped desiredFutureRoute '${String(exhaustiveCheck)}'.`);
    }
  }
}

// ─── Result-facing types ──────────────────────────────────────────────────────────

export type DecisionClarificationConflictType =
  | "none"
  | "decision_support_missing_handler"
  | "decision_support_collides_with_general_pm"
  | "decision_support_collides_with_playbook"
  | "decision_support_collides_with_risk"
  | "decision_support_collides_with_closure"
  | "decision_support_collides_with_governance"
  | "clarification_missing_strategy"
  | "clarification_collides_with_general_pm"
  | "clarification_collides_with_status"
  | "clarification_collides_with_risk"
  | "clarification_collides_with_task"
  | "clarification_collides_with_communication"
  | "existing_route_regression"
  | "mapping_gap"
  | "classifier_disagreement";

export type DecisionClarificationCaseResult = {
  id: string;
  input: string;
  architectureCategory: DecisionClarificationArchitectureCategory;
  desiredFutureRoute: DecisionClarificationDesiredFutureRoute;
  currentSafeMappedIntent: ProductionConversationIntent;
  targetKind: DecisionClarificationTargetKind;
  productionIntent: ProductionConversationIntent;
  enrichedFamily: EnrichedConversationIntentFamily;
  enrichedType: EnrichedConversationIntentType;
  mappedIntent: ProductionConversationIntent;
  /** Whether the live `mappedIntent` still equals this case's declared `currentSafeMappedIntent` —
   * i.e. whether the Sprint 10R adapter's documented safe-fallback mapping actually holds today for
   * this specific input, rather than the enriched classifier having pattern-matched into some other,
   * more specific (and possibly wrong) production intent. */
  isCurrentSafeMapping: boolean;
  /** Whether the case's `desiredFutureRoute` is already reachable today without any new
   * architecture: for `existing_production_route` cases, whether production's own intent already
   * equals `desiredFutureRoute`; for `future_architecture`/`clarification_strategy` cases, whether
   * the best available live signal (enriched family, or production's own `clarification` intent)
   * already detects the right family. */
  isFutureRouteAlreadySupported: boolean;
  requiresNewHandler: boolean;
  requiresClarification: boolean;
  shouldExecuteAction: false;
  conflictType: DecisionClarificationConflictType;
  riskLevel: DecisionClarificationRiskLevel;
  rationale: string;
  warnings: string[];
};

function computeIsFutureRouteAlreadySupported(
  targetKind: DecisionClarificationTargetKind,
  desiredFutureRoute: DecisionClarificationDesiredFutureRoute,
  productionIntent: ProductionConversationIntent,
  enrichedFamily: EnrichedConversationIntentFamily,
): boolean {
  if (targetKind === "existing_production_route") return productionIntent === desiredFutureRoute;
  if (targetKind === "future_architecture") return enrichedFamily === "decision_support";
  return enrichedFamily === "needs_clarification" || productionIntent === "clarification";
}

const DECISION_SUPPORT_COLLISION_BY_BUCKET: Partial<Record<FamilyBucket, DecisionClarificationConflictType>> = {
  general_pm_advice: "decision_support_collides_with_general_pm",
  playbook_analysis: "decision_support_collides_with_playbook",
  risk_issue_dependency: "decision_support_collides_with_risk",
  closure_billing: "decision_support_collides_with_closure",
  governance_audit: "decision_support_collides_with_governance",
};

const CLARIFICATION_COLLISION_BY_BUCKET: Partial<Record<FamilyBucket, DecisionClarificationConflictType>> = {
  general_pm_advice: "clarification_collides_with_general_pm",
  project_status: "clarification_collides_with_status",
  risk_issue_dependency: "clarification_collides_with_risk",
  task_action: "clarification_collides_with_task",
  communication_draft: "clarification_collides_with_communication",
};

/**
 * Conflict classification: `decision_support`/`needs_clarification` cases always carry *some*
 * gap conflictType (there is no production route or clarification loop for either family yet), so
 * `"none"` is reserved for `existing_route_should_win` cases where production already matches the
 * policy target, and for the narrow case where production's own literal intent already resolves to
 * the right family (`clarification` for clarification cases). Everything else names the specific
 * live collision when the production classifier's bucket matches one of the eight other categories,
 * or falls back to the baseline "missing handler"/"missing strategy" gap when it doesn't.
 */
function computeConflictType(
  architectureCategory: DecisionClarificationArchitectureCategory,
  targetKind: DecisionClarificationTargetKind,
  productionIntent: ProductionConversationIntent,
  desiredFutureRoute: DecisionClarificationDesiredFutureRoute,
): DecisionClarificationConflictType {
  const productionFamilyBucket = mapProductionIntentToFamilyBucket(productionIntent);

  if (targetKind === "existing_production_route") {
    return productionIntent === desiredFutureRoute ? "none" : "existing_route_regression";
  }

  if (targetKind === "future_architecture") {
    return DECISION_SUPPORT_COLLISION_BY_BUCKET[productionFamilyBucket] ?? "decision_support_missing_handler";
  }

  // clarification_strategy
  if (productionFamilyBucket === "needs_clarification") return "none";
  return CLARIFICATION_COLLISION_BY_BUCKET[productionFamilyBucket] ?? "clarification_missing_strategy";
}

export type DecisionClarificationReviewOptions = ShadowComparisonOptions;

/**
 * Runs the Sprint 10R shadow comparison (production classifier + enriched classifier + adapter
 * mapping) for every case in the corpus and scores each result against this sprint's architecture
 * policy. Pure — never mutates `cases`, never calls the router, composer, any handler, a database,
 * Supabase, or any external service, and never activates the enriched classifier in production.
 */
export function runDecisionClarificationArchitectureReview(
  cases: DecisionClarificationCase[],
  options: DecisionClarificationReviewOptions = {},
): DecisionClarificationCaseResult[] {
  return cases.map((architectureCase) => {
    const shadow = runIntentClassifierShadowComparison(
      { workspaceId: "decision-clarification-review", userId: "decision-clarification-review", message: architectureCase.input },
      options,
    );

    const productionIntent = shadow.productionIntent;
    const enrichedFamily = shadow.enrichedIntent.intentFamily;
    const enrichedType = shadow.enrichedIntent.intentType;
    const mappedIntent = shadow.mappedIntent;

    const isCurrentSafeMapping = mappedIntent === architectureCase.currentSafeMappedIntent;
    const isFutureRouteAlreadySupported = computeIsFutureRouteAlreadySupported(
      architectureCase.targetKind,
      architectureCase.desiredFutureRoute,
      productionIntent,
      enrichedFamily,
    );
    const conflictType = computeConflictType(
      architectureCase.architectureCategory,
      architectureCase.targetKind,
      productionIntent,
      architectureCase.desiredFutureRoute,
    );

    const warnings: string[] = [];
    if (!isCurrentSafeMapping) {
      warnings.push(
        `Live mappedIntent "${mappedIntent}" does not match this case's declared currentSafeMappedIntent ` +
          `"${architectureCase.currentSafeMappedIntent}" — the documented safe-fallback mapping does not hold for this input today.`,
      );
    }
    for (const warning of shadow.migrationWarnings as IntentMappingWarning[]) {
      if (warning.severity === "caution") warnings.push(`${warning.code}: ${warning.message}`);
    }

    return {
      id: architectureCase.id,
      input: architectureCase.input,
      architectureCategory: architectureCase.architectureCategory,
      desiredFutureRoute: architectureCase.desiredFutureRoute,
      currentSafeMappedIntent: architectureCase.currentSafeMappedIntent,
      targetKind: architectureCase.targetKind,
      productionIntent,
      enrichedFamily,
      enrichedType,
      mappedIntent,
      isCurrentSafeMapping,
      isFutureRouteAlreadySupported,
      requiresNewHandler: architectureCase.requiresNewHandler,
      requiresClarification: architectureCase.requiresClarification,
      shouldExecuteAction: false,
      conflictType,
      riskLevel: architectureCase.riskLevel,
      rationale: architectureCase.rationale,
      warnings,
    };
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────────

export type DecisionClarificationCategorySummary = {
  architectureCategory: DecisionClarificationArchitectureCategory;
  totalCases: number;
  currentSafeMappingCount: number;
  currentSafeMappingRate: number;
  futureRouteAlreadySupportedCount: number;
  futureRouteAlreadySupportedRate: number;
};

export type DecisionClarificationImplementationStep =
  | "Decision Support Candidate Handler"
  | "Clarification Response Strategy"
  | "General PM Advice Calibration"
  | "Controlled Shadow Capture Prep";

export type DecisionClarificationNextSprintRecommendation =
  | "Sprint 19R — Decision Support Candidate Handler"
  | "Sprint 19R — Clarification Response Strategy"
  | "Sprint 19R — Decision Support Candidate Handler, then Sprint 20R — Clarification Response Strategy";

export type DecisionClarificationSummary = {
  totalCases: number;
  currentSafeMappingCount: number;
  currentSafeMappingRate: number;
  futureRouteAlreadySupportedCount: number;
  futureRouteAlreadySupportedRate: number;
  requiresNewHandlerCount: number;
  requiresClarificationCount: number;
  shouldExecuteActionCount: number;
  byArchitectureCategory: Record<DecisionClarificationArchitectureCategory, DecisionClarificationCategorySummary>;
  byConflictType: Record<DecisionClarificationConflictType, number>;
  decisionSupportCases: DecisionClarificationCaseResult[];
  clarificationCases: DecisionClarificationCaseResult[];
  existingRouteShouldWinCases: DecisionClarificationCaseResult[];
  /** Cases where `isCurrentSafeMapping` is false — the documented safe-fallback mapping breaks down
   * live for this input (usually because the enriched classifier pattern-matched into a different,
   * more specific family than the one this case is meant to represent). */
  unsafeMappings: DecisionClarificationCaseResult[];
  /** `existing_route_should_win` cases whose live `conflictType` is `existing_route_regression` —
   * production no longer routes an already-supported, unambiguous message correctly. Should be empty. */
  existingRouteRegressions: DecisionClarificationCaseResult[];
  /** Up to 10 decision_support cases with a specific (non-baseline) collision conflictType, highest
   * riskLevel first — the clearest evidence for where a future handler would need to win a real
   * live tie-break, not just fill an empty slot. */
  topDecisionSupportGaps: DecisionClarificationCaseResult[];
  /** Same as `topDecisionSupportGaps`, for clarification cases. */
  topClarificationGaps: DecisionClarificationCaseResult[];
  recommendedImplementationOrder: DecisionClarificationImplementationStep[];
  recommendedNextSprint: DecisionClarificationNextSprintRecommendation;
  recommendation: string;
};

const ARCHITECTURE_CATEGORIES: DecisionClarificationArchitectureCategory[] = [
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
];

const CONFLICT_TYPES: DecisionClarificationConflictType[] = [
  "none",
  "decision_support_missing_handler",
  "decision_support_collides_with_general_pm",
  "decision_support_collides_with_playbook",
  "decision_support_collides_with_risk",
  "decision_support_collides_with_closure",
  "decision_support_collides_with_governance",
  "clarification_missing_strategy",
  "clarification_collides_with_general_pm",
  "clarification_collides_with_status",
  "clarification_collides_with_risk",
  "clarification_collides_with_task",
  "clarification_collides_with_communication",
  "existing_route_regression",
  "mapping_gap",
  "classifier_disagreement",
];

const DECISION_SUPPORT_CATEGORIES = new Set<DecisionClarificationArchitectureCategory>([
  "decision_support_clear",
  "decision_support_vs_playbook",
  "decision_support_vs_general_pm",
  "decision_support_vs_risk",
  "decision_support_vs_closure",
  "decision_support_vs_governance",
]);

const CLARIFICATION_CATEGORIES = new Set<DecisionClarificationArchitectureCategory>([
  "clarification_clear",
  "clarification_vs_general_pm",
  "clarification_vs_status",
  "clarification_vs_risk",
  "clarification_vs_task",
  "clarification_vs_communication",
]);

const TOP_GAPS_LIMIT = 10;
const RISK_ORDER: Record<DecisionClarificationRiskLevel, number> = { high: 0, medium: 1, low: 2 };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

function topGaps(cases: DecisionClarificationCaseResult[], baselineConflictType: DecisionClarificationConflictType): DecisionClarificationCaseResult[] {
  return cases
    .filter((c) => c.conflictType !== "none" && c.conflictType !== baselineConflictType)
    .concat(cases.filter((c) => c.conflictType === baselineConflictType))
    .sort((a, b) => {
      const aIsSpecific = a.conflictType !== baselineConflictType ? 0 : 1;
      const bIsSpecific = b.conflictType !== baselineConflictType ? 0 : 1;
      if (aIsSpecific !== bIsSpecific) return aIsSpecific - bIsSpecific;
      return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    })
    .slice(0, TOP_GAPS_LIMIT);
}

function recommendImplementationOrder(
  requiresNewHandlerCount: number,
  requiresClarificationCount: number,
): DecisionClarificationImplementationStep[] {
  if (requiresNewHandlerCount >= requiresClarificationCount) {
    return [
      "Decision Support Candidate Handler",
      "Clarification Response Strategy",
      "General PM Advice Calibration",
      "Controlled Shadow Capture Prep",
    ];
  }
  return [
    "Clarification Response Strategy",
    "Decision Support Candidate Handler",
    "General PM Advice Calibration",
    "Controlled Shadow Capture Prep",
  ];
}

/** Share above which one gap dominates the other clearly enough to order the next two sprints. */
const DOMINANT_GAP_SHARE = 0.6;

function recommendNextSprint(
  decisionSupportGapCount: number,
  clarificationGapCount: number,
): { recommendedNextSprint: DecisionClarificationNextSprintRecommendation; recommendation: string } {
  const total = decisionSupportGapCount + clarificationGapCount;
  const decisionSupportShare = total > 0 ? decisionSupportGapCount / total : 0;

  if (decisionSupportShare >= DOMINANT_GAP_SHARE) {
    return {
      recommendedNextSprint: "Sprint 19R — Decision Support Candidate Handler",
      recommendation:
        `decision_support cases (${decisionSupportGapCount}/${total} of the two gap groups, ${round1(decisionSupportShare * 100)}%) ` +
        "dominate over clarification cases — prioritize a Decision Support Candidate Handler in Sprint 19R.",
    };
  }
  if (decisionSupportShare <= 1 - DOMINANT_GAP_SHARE) {
    return {
      recommendedNextSprint: "Sprint 19R — Clarification Response Strategy",
      recommendation:
        `clarification cases (${clarificationGapCount}/${total} of the two gap groups, ${round1((1 - decisionSupportShare) * 100)}%) ` +
        "dominate over decision_support cases — prioritize a Clarification Response Strategy in Sprint 19R.",
    };
  }
  return {
    recommendedNextSprint: "Sprint 19R — Decision Support Candidate Handler, then Sprint 20R — Clarification Response Strategy",
    recommendation:
      `decision_support (${decisionSupportGapCount}) and clarification (${clarificationGapCount}) gap counts are close enough ` +
      "(neither reaches a 60% share of the two) that both matter — sequence a Decision Support Candidate Handler in Sprint 19R " +
      "followed by a Clarification Response Strategy in Sprint 20R.",
  };
}

/**
 * Turns a `runDecisionClarificationArchitectureReview()` result array into a review-ready report:
 * global + per-architecture-category rates, conflict-type breakdown, the decision_support/
 * clarification/existing-route slices, unsafe-mapping and regression slices, and a next-sprint
 * recommendation. Pure — takes an already-computed result array rather than re-running anything.
 */
export function summarizeDecisionClarificationArchitectureReview(
  results: DecisionClarificationCaseResult[],
): DecisionClarificationSummary {
  const totalCases = results.length;

  const byArchitectureCategory = Object.fromEntries(
    ARCHITECTURE_CATEGORIES.map((architectureCategory) => [
      architectureCategory,
      {
        architectureCategory,
        totalCases: 0,
        currentSafeMappingCount: 0,
        currentSafeMappingRate: 0,
        futureRouteAlreadySupportedCount: 0,
        futureRouteAlreadySupportedRate: 0,
      } satisfies DecisionClarificationCategorySummary,
    ]),
  ) as Record<DecisionClarificationArchitectureCategory, DecisionClarificationCategorySummary>;

  const byConflictType = Object.fromEntries(CONFLICT_TYPES.map((conflictType) => [conflictType, 0])) as Record<
    DecisionClarificationConflictType,
    number
  >;

  let currentSafeMappingCount = 0;
  let futureRouteAlreadySupportedCount = 0;
  let requiresNewHandlerCount = 0;
  let requiresClarificationCount = 0;
  let shouldExecuteActionCount = 0;

  const decisionSupportCases: DecisionClarificationCaseResult[] = [];
  const clarificationCases: DecisionClarificationCaseResult[] = [];
  const existingRouteShouldWinCases: DecisionClarificationCaseResult[] = [];
  const unsafeMappings: DecisionClarificationCaseResult[] = [];
  const existingRouteRegressions: DecisionClarificationCaseResult[] = [];

  for (const result of results) {
    const categorySummary = byArchitectureCategory[result.architectureCategory];
    categorySummary.totalCases += 1;
    if (result.isCurrentSafeMapping) {
      currentSafeMappingCount += 1;
      categorySummary.currentSafeMappingCount += 1;
    } else {
      unsafeMappings.push(result);
    }
    if (result.isFutureRouteAlreadySupported) {
      futureRouteAlreadySupportedCount += 1;
      categorySummary.futureRouteAlreadySupportedCount += 1;
    }
    if (result.requiresNewHandler) requiresNewHandlerCount += 1;
    if (result.requiresClarification) requiresClarificationCount += 1;
    if (result.shouldExecuteAction) shouldExecuteActionCount += 1;

    byConflictType[result.conflictType] += 1;

    if (DECISION_SUPPORT_CATEGORIES.has(result.architectureCategory)) decisionSupportCases.push(result);
    if (CLARIFICATION_CATEGORIES.has(result.architectureCategory)) clarificationCases.push(result);
    if (result.architectureCategory === "existing_route_should_win") existingRouteShouldWinCases.push(result);
    if (result.conflictType === "existing_route_regression") existingRouteRegressions.push(result);
  }

  for (const architectureCategory of ARCHITECTURE_CATEGORIES) {
    const categorySummary = byArchitectureCategory[architectureCategory];
    categorySummary.currentSafeMappingRate = rateOf(categorySummary.currentSafeMappingCount, categorySummary.totalCases);
    categorySummary.futureRouteAlreadySupportedRate = rateOf(
      categorySummary.futureRouteAlreadySupportedCount,
      categorySummary.totalCases,
    );
  }

  const topDecisionSupportGaps = topGaps(decisionSupportCases, "decision_support_missing_handler");
  const topClarificationGaps = topGaps(clarificationCases, "clarification_missing_strategy");

  const recommendedImplementationOrder = recommendImplementationOrder(requiresNewHandlerCount, requiresClarificationCount);
  const { recommendedNextSprint, recommendation } = recommendNextSprint(decisionSupportCases.length, clarificationCases.length);

  return {
    totalCases,
    currentSafeMappingCount,
    currentSafeMappingRate: rateOf(currentSafeMappingCount, totalCases),
    futureRouteAlreadySupportedCount,
    futureRouteAlreadySupportedRate: rateOf(futureRouteAlreadySupportedCount, totalCases),
    requiresNewHandlerCount,
    requiresClarificationCount,
    shouldExecuteActionCount,
    byArchitectureCategory,
    byConflictType,
    decisionSupportCases,
    clarificationCases,
    existingRouteShouldWinCases,
    unsafeMappings,
    existingRouteRegressions,
    topDecisionSupportGaps,
    topClarificationGaps,
    recommendedImplementationOrder,
    recommendedNextSprint,
    recommendation,
  };
}

// ─── Policy explanation ────────────────────────────────────────────────────────────

export type DecisionClarificationArchitectureExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  whatIsDecisionSupport: string;
  whatIsNotDecisionSupport: string[];
  whatIsNeedsClarification: string;
  whatIsNotNeedsClarification: string[];
  desiredClarificationResponse: string;
  precedenceRules: string[];
  safeTemporaryMapping: string[];
  futureHandlerRequirements: string[];
  futureClarificationStrategyRequirements: string[];
  nonGoals: string[];
};

/**
 * Capability explanation for the Sprint 18R architecture review module — mirrors the style of
 * `explainGeneralPmAdviceBoundaryPolicy()` (Sprint 17R) and `explainGoldenIntentEvaluation()`
 * (Sprint 11R). See `docs/conversational-brain-decision-support-clarification-architecture.md` for
 * full context.
 */
export function explainDecisionClarificationArchitecture(): DecisionClarificationArchitectureExplain {
  return {
    capability: "playbook-engine-conversation-decision-clarification-architecture-review",
    purpose:
      "Defines what decision_support and needs_clarification mean, when each should win against the eight other " +
      "conversation categories, and measures how today's production classifier, enriched classifier, and Sprint 10R " +
      "adapter mapping behave against that policy — without building a production handler, a clarification loop, or " +
      "changing production behavior in any way.",
    doesNot: [
      "Does not replace, call, or modify classifier/intentClassifier.rules.ts or intent-patterns.ts.",
      "Does not touch router/brainRouter.ts, composer/responseComposer.ts, or any handlers/*.ts.",
      "Does not touch POST /api/command-center/chat or runConversationalBrainGateway().",
      "Does not read or write a database, call Supabase, send email, create tasks, or emit audit events.",
      "Does not activate the enriched classifier in production — there is still no feature flag wired to anything.",
      "Does not create a decision_support production handler or a real clarification loop — both remain documented, unimplemented gaps.",
      "Does not calibrate general_pm_advice vocabulary.",
    ],
    whatIsDecisionSupport:
      "decision_support is for messages asking to choose between options, evaluate alternatives, compare paths, " +
      "unblock a pending decision, identify who should decide or what decision is missing, explain tradeoffs, or " +
      "decide whether to escalate/wait/close/ask for more evidence/change approach.",
    whatIsNotDecisionSupport: [
      "playbook_analysis wins if the message asks for the playbook's own recommendation or governed next action " +
        "('qué recomienda el playbook', 'cuál es la siguiente mejor acción') rather than to resolve a choice.",
      "project_status wins if the message asks about status, progress, or health ('cómo va el proyecto', 'qué avance tenemos').",
      "risk_issue_dependency wins if the message asks about risks/issues/dependencies without asking to choose between them ('qué riesgos hay').",
      "closure_billing wins if the message asks about closure/billing readiness without framing a choice ('qué falta para facturar').",
      "communication_draft wins if the message asks to draft a communication ('redactame un correo defendiendo esta decisión').",
      "task_action wins if the message asks to create/assign/close a task or action ('creá una tarea para evaluar opciones').",
      "governance_audit wins if the message asks for evidence/rules/justification behind a decision already made ('qué evidencia usaste para recomendar esto').",
    ],
    whatIsNeedsClarification:
      "needs_clarification is for messages too ambiguous to route safely — no named topic, project, or object — " +
      "where none of the eight operational categories has enough signal to act on.",
    whatIsNotNeedsClarification: [
      "Any message carrying a clear operational signal wins instead: 'qué riesgos hay' -> risk_issue_dependency, " +
        "'redactame un correo' -> communication_draft, 'qué falta para facturar' -> closure_billing, " +
        "'creá una tarea' -> task_action, 'mostrame el audit trail' -> governance_audit, " +
        "'qué recomienda el playbook' -> playbook_analysis, 'cómo va el proyecto' -> project_status.",
    ],
    desiredClarificationResponse:
      "Te ayudo. Para ubicarlo bien, necesito una de estas pistas: 1) ¿Querés revisar estado, riesgos, facturación, " +
      "comunicación, tareas o una decisión? 2) ¿De qué proyecto estamos hablando? 3) ¿Hay un correo, documento o " +
      "contexto específico que deba usar? (Not implemented — this is the target response shape for a future " +
      "clarification loop, not a live behavior of this sprint.)",
    precedenceRules: [
      "1. communication_draft if there is an explicit drafting/responding/communicating verb.",
      "2. task_action if there is create/assign/convert/mark/close a task or action.",
      "3. closure_billing if there is billing/closure/reception readiness framing.",
      "4. governance_audit if there is evidence/rule/audit-trail/justification framing.",
      "5. risk_issue_dependency if there are explicit risks/issues/dependencies/blockers.",
      "6. project_status if there is status/progress/health framing.",
      "7. playbook_analysis if it asks for the playbook/PMFreak's own recommendation.",
      "8. decision_support if it asks to choose/evaluate options/unblock a decision.",
      "9. needs_clarification if none of the above has enough signal.",
      "10. general_pm_advice as the general PM-advice fallback when no operational intent is more specific.",
    ],
    safeTemporaryMapping: [
      "decision_support -> unsupported (Sprint 10R documented decision): avoids implying an evidence/audit answer " +
        "production cannot give yet.",
      "needs_clarification -> general_pm_advice (Sprint 10R documented decision): mirrors production's own " +
        "clarification -> general_pm_advisor route.",
      "Both mappings are documented defaults, not correct answers — see this review's isCurrentSafeMapping field " +
        "for how often they actually hold live per case.",
    ],
    futureHandlerRequirements: [
      "A Decision Support Candidate Handler must not execute any action — read-only analysis only.",
      "It must compare named options, identify tradeoffs, and recommend a next step.",
      "It must be able to ask for missing evidence/context rather than guessing when data is incomplete.",
      "It must reuse the existing DecisionDraft data already produced by operational-intelligence-engine.ts (Sprint 5) " +
        "rather than inventing a new data source.",
      "It must always require human approval before any decision it discusses is acted on.",
    ],
    futureClarificationStrategyRequirements: [
      "A Clarification Response Strategy must not execute any domain handler.",
      "It must return a clarifying question, not a canned general_pm_advice answer.",
      "It must preserve conversational context so the next turn can route correctly once clarified.",
      "It must let the user pick one of the operational categories, a project, or supply missing context (see desiredClarificationResponse).",
    ],
    nonGoals: [
      "Create a decision_support production handler.",
      "Implement a real clarification loop.",
      "Change the router, composer, any handler, or the endpoint.",
      "Activate a feature flag or the enriched classifier in production.",
      "Read/write a database, call Supabase, send email, create tasks, or execute any action.",
      "Calibrate general_pm_advice vocabulary.",
      "Raise the golden corpus's global compatibilityRate.",
    ],
  };
}
