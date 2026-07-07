/**
 * Sprint 20R — Decision Support Shadow Mapping Evaluation.
 *
 * A pure, read-only, offline evaluator that measures how the Sprint 19R Decision Support Candidate
 * Handler (`decisionSupportCandidateHandler.ts`) would behave against the Sprint 18R architecture
 * corpus (`tests/fixtures/conversational-brain-decision-clarification-cases.ts`) and today's live
 * production classifier / enriched classifier / Sprint 10R adapter mapping (via
 * `runDecisionClarificationArchitectureReview()` and `runIntentClassifierShadowComparison()`).
 *
 * This module answers, with real measurements rather than assumptions: how many Sprint 18R cases are
 * eligible for `decision_support`, how many the candidate handler can process safely, where it
 * collides with `playbook_analysis`/`general_pm_advice`/`risk_issue_dependency`/`closure_billing`/
 * `governance_audit`, which current mappings are temporarily safe, which are dangerous, what
 * integration mode is recommended for the future, and what must happen in Sprint 21R before any
 * feature flag is even considered.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not activate the
 * enriched classifier in production (no feature flag wired to anything); and does not connect
 * `decision_support` to the router. See
 * `docs/conversational-brain-decision-support-shadow-mapping.md` for the full design writeup.
 */

import type { DecisionClarificationArchitectureCategory, DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import { runDecisionClarificationArchitectureReview } from "../classifier/decisionClarificationArchitectureReview";
import type { ConversationIntent as ProductionConversationIntent } from "../types";

import { handleDecisionSupportCandidate, formatDecisionSupportCandidateResponse } from "./decisionSupportCandidateHandler";
import type { DecisionSupportCandidateResult, DecisionSupportDecisionType } from "./decisionSupportCandidateTypes";

import type {
  DecisionSupportShadowCollisionType,
  DecisionSupportShadowEligibility,
  DecisionSupportShadowIntegrationMode,
  DecisionSupportShadowMappingCategorySummary,
  DecisionSupportShadowMappingExplain,
  DecisionSupportShadowMappingNextSprintRecommendation,
  DecisionSupportShadowMappingOptions,
  DecisionSupportShadowMappingResult,
  DecisionSupportShadowMappingSummary,
} from "./decisionSupportShadowMappingTypes";

export type {
  DecisionSupportShadowMappingOptions,
  DecisionSupportShadowMappingInput,
  DecisionSupportShadowEligibility,
  DecisionSupportShadowCollisionType,
  DecisionSupportShadowIntegrationMode,
  DecisionSupportShadowMappingResult,
  DecisionSupportShadowMappingCategorySummary,
  DecisionSupportShadowMappingNextSprintRecommendation,
  DecisionSupportShadowMappingSummary,
  DecisionSupportShadowMappingExplain,
} from "./decisionSupportShadowMappingTypes";

// ─── Eligibility ─────────────────────────────────────────────────────────────────────

/**
 * Eligibility rules (Sprint 20R spec §3):
 *  A. Eligible for the candidate handler when desiredFutureRoute === "decision_support",
 *     requiresNewHandler === true, shouldExecuteAction === false, targetKind === "future_architecture",
 *     and input is non-empty.
 *  B. Never eligible when desiredFutureRoute === "needs_clarification", requiresClarification === true,
 *     targetKind === "clarification_strategy", or architectureCategory starts with "clarification_".
 *  C. Never eligible when targetKind === "existing_production_route" (existing_route_should_win).
 */
function computeEligibility(architectureCase: DecisionClarificationCase): DecisionSupportShadowEligibility {
  const isDecisionSupportDesired = architectureCase.desiredFutureRoute === "decision_support";
  const isClarificationDesired = architectureCase.desiredFutureRoute === "needs_clarification";
  const isExistingRouteCase = architectureCase.targetKind === "existing_production_route";

  const ineligibilityReasons: string[] = [];
  if (!isDecisionSupportDesired) {
    ineligibilityReasons.push(`desiredFutureRoute is "${architectureCase.desiredFutureRoute}", not "decision_support".`);
  }
  if (!architectureCase.requiresNewHandler) ineligibilityReasons.push("requiresNewHandler is false.");
  if (architectureCase.shouldExecuteAction) ineligibilityReasons.push("shouldExecuteAction is true.");
  if (architectureCase.targetKind !== "future_architecture") {
    ineligibilityReasons.push(`targetKind is "${architectureCase.targetKind}", not "future_architecture".`);
  }
  if (!architectureCase.input || architectureCase.input.trim().length === 0) ineligibilityReasons.push("input is empty.");
  if (isClarificationDesired) ineligibilityReasons.push("desiredFutureRoute is needs_clarification.");
  if (architectureCase.requiresClarification) ineligibilityReasons.push("requiresClarification is true.");
  if (architectureCase.architectureCategory.startsWith("clarification_")) {
    ineligibilityReasons.push(`architectureCategory "${architectureCase.architectureCategory}" is a clarification category.`);
  }
  if (isExistingRouteCase) ineligibilityReasons.push("targetKind is existing_production_route.");

  const isCandidateHandlerEligible = ineligibilityReasons.length === 0;

  return {
    isDecisionSupportDesired,
    isClarificationDesired,
    isExistingRouteCase,
    isCandidateHandlerEligible,
    eligibilityReason: isCandidateHandlerEligible
      ? "desiredFutureRoute=decision_support, requiresNewHandler=true, shouldExecuteAction=false, targetKind=future_architecture, non-empty input."
      : "Not eligible for the candidate handler — see ineligibilityReasons.",
    ineligibilityReasons,
  };
}

// ─── Candidate handler safety evaluation ─────────────────────────────────────────────

const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

/**
 * Full structural + safety checklist (Sprint 20R spec §5). Returns true only if every check passes:
 * a non-empty decisionStatement, at least one option/tradeoff/risk/evidence-need, a non-empty
 * recommendedPath/suggestedNextStep, a valid confidence value, and every safety.* flag exactly at
 * its documented safe-candidate value.
 */
function evaluateCandidateHandlerSafety(result: DecisionSupportCandidateResult): boolean {
  if (result.kind !== "decision_support_candidate_result") return false;
  if (!result.decisionStatement || result.decisionStatement.trim().length === 0) return false;
  if (result.options.length < 1) return false;
  if (result.tradeoffs.length < 1) return false;
  if (result.risks.length < 1) return false;
  if (result.evidenceNeeded.length < 1) return false;
  if (!result.recommendation.recommendedPath || result.recommendation.recommendedPath.trim().length === 0) return false;
  if (!result.recommendation.suggestedNextStep || result.recommendation.suggestedNextStep.trim().length === 0) return false;
  if (!VALID_CONFIDENCE.has(result.recommendation.confidence)) return false;

  const safety = result.safety;
  if (safety.shouldExecuteAction !== false) return false;
  if (safety.shouldCreateTask !== false) return false;
  if (safety.shouldSendEmail !== false) return false;
  if (safety.shouldWriteToDb !== false) return false;
  if (safety.requiresHumanConfirmation !== true) return false;
  if (safety.productionRoutingEnabled !== false) return false;

  return true;
}

// ─── Collision classification ────────────────────────────────────────────────────────

const CLASSIFIER_COLLISION_BY_MAPPED_INTENT: Partial<Record<ProductionConversationIntent, DecisionSupportShadowCollisionType>> = {
  recommendation_request: "collides_with_playbook_analysis",
  general_pm_advice: "collides_with_general_pm_advice",
  risk_analysis: "collides_with_risk_analysis",
  closure_question: "collides_with_closure_billing",
  billing_question: "collides_with_closure_billing",
  governance_question: "collides_with_governance_audit",
  audit_question: "collides_with_governance_audit",
};

/** The residual classifier-level bucket once no named family collision matches. */
function computeClassifierCollisionType(
  mappedIntent: ProductionConversationIntent,
  productionIntent: ProductionConversationIntent,
): DecisionSupportShadowCollisionType {
  const named = CLASSIFIER_COLLISION_BY_MAPPED_INTENT[mappedIntent];
  if (named) return named;
  if (mappedIntent === "unsupported") return "unsupported_mapping";
  if (productionIntent !== mappedIntent) return "classifier_disagreement";
  return "mapping_gap";
}

const HANDLER_COLLISION_TYPES = new Set<DecisionSupportShadowCollisionType>([
  "handler_safety_failure",
  "handler_missing_options",
  "handler_missing_evidence",
  "handler_low_confidence",
]);

/**
 * Full collisionType classification (Sprint 20R spec §4). Priority, most severe/specific first:
 *  1. existing_route_should_win / clarification_required — reported categories, never overridden.
 *  2. handler_safety_failure — a hard safety-gate violation on an otherwise-eligible case.
 *  3. Named classifier-family collisions (playbook, general_pm, risk, closure_billing, governance_audit).
 *  4. Handler structural/quality gaps (missing options/evidence, low confidence) once no more severe
 *     classifier collision is present.
 *  5. handler_not_applicable for decision_support-desired cases the candidate handler did not run for.
 *  6. The residual classifier bucket (unsupported_mapping / classifier_disagreement / mapping_gap).
 */
function computeCollisionType(params: {
  eligibility: DecisionSupportShadowEligibility;
  mappedIntent: ProductionConversationIntent;
  productionIntent: ProductionConversationIntent;
  candidateResult: DecisionSupportCandidateResult | undefined;
  isCandidateHandlerSafe: boolean;
  ran: boolean;
}): DecisionSupportShadowCollisionType {
  const { eligibility, mappedIntent, productionIntent, candidateResult, isCandidateHandlerSafe, ran } = params;

  if (eligibility.isExistingRouteCase) return "existing_route_should_win";
  if (eligibility.isClarificationDesired) return "clarification_required";
  if (!eligibility.isDecisionSupportDesired) return "none";

  if (ran && !isCandidateHandlerSafe) return "handler_safety_failure";

  const classifierCollision = computeClassifierCollisionType(mappedIntent, productionIntent);
  const isNamedFamilyCollision =
    classifierCollision !== "mapping_gap" &&
    classifierCollision !== "unsupported_mapping" &&
    classifierCollision !== "classifier_disagreement";
  if (isNamedFamilyCollision) return classifierCollision;

  if (ran && candidateResult) {
    if (candidateResult.options.length === 0) return "handler_missing_options";
    if (candidateResult.evidenceNeeded.length === 0) return "handler_missing_evidence";
    if (candidateResult.recommendation.confidence === "low") return "handler_low_confidence";
  }

  if (!eligibility.isCandidateHandlerEligible) return "handler_not_applicable";

  return classifierCollision;
}

// ─── Per-case integration mode tag ───────────────────────────────────────────────────

function computeCaseIntegrationMode(params: {
  eligibility: DecisionSupportShadowEligibility;
  collisionType: DecisionSupportShadowCollisionType;
  isShadowRoutable: boolean;
}): DecisionSupportShadowIntegrationMode {
  const { eligibility, collisionType, isShadowRoutable } = params;

  if (eligibility.isExistingRouteCase) return "do_not_integrate";
  if (eligibility.isClarificationDesired) return "route_after_clarification_strategy";
  if (!eligibility.isCandidateHandlerEligible) return "do_not_integrate";
  if (collisionType === "handler_safety_failure") return "do_not_integrate";
  if (collisionType === "collides_with_playbook_analysis" || collisionType === "collides_with_general_pm_advice") {
    return "route_after_classifier_calibration";
  }
  if (
    collisionType === "collides_with_risk_analysis" ||
    collisionType === "collides_with_closure_billing" ||
    collisionType === "collides_with_governance_audit"
  ) {
    return "route_after_classifier_calibration";
  }
  if (collisionType === "mapping_gap" || collisionType === "classifier_disagreement") return "route_after_adapter_mapping";
  if (
    collisionType === "handler_low_confidence" ||
    collisionType === "handler_missing_options" ||
    collisionType === "handler_missing_evidence"
  ) {
    return "offline_evaluation_only";
  }
  if (isShadowRoutable) return "shadow_mode_default_off";
  return "offline_evaluation_only";
}

// ─── Main evaluator ───────────────────────────────────────────────────────────────────

function shouldIncludeCase(architectureCase: DecisionClarificationCase, options: Required<Pick<DecisionSupportShadowMappingOptions, "includeClarificationCases" | "includeExistingRouteCases">>): boolean {
  if (!options.includeClarificationCases && architectureCase.architectureCategory.startsWith("clarification_")) return false;
  if (!options.includeExistingRouteCases && architectureCase.architectureCategory === "existing_route_should_win") return false;
  return true;
}

/**
 * Runs the Sprint 20R shadow mapping evaluation: for every included case, runs the Sprint 18R
 * architecture review's shadow comparison (production classifier + enriched classifier + Sprint 10R
 * adapter mapping), computes eligibility for the Sprint 19R candidate handler, runs the candidate
 * handler for eligible cases (unless `runCandidateHandler: false`), evaluates its safety, and
 * classifies the resulting collisionType and per-case integrationMode. Pure — never mutates `cases`,
 * never calls the router, composer, any handler, a database, Supabase, or any external service, never
 * calls `fetch` or an LLM, and never activates a feature flag.
 */
export function runDecisionSupportShadowMappingEvaluation(
  cases: DecisionClarificationCase[],
  options: DecisionSupportShadowMappingOptions = {},
): DecisionSupportShadowMappingResult[] {
  const includeClarificationCases = options.includeClarificationCases ?? true;
  const includeExistingRouteCases = options.includeExistingRouteCases ?? true;
  const runCandidateHandler = options.runCandidateHandler ?? true;

  const filteredCases = cases.filter((c) => shouldIncludeCase(c, { includeClarificationCases, includeExistingRouteCases }));

  const architectureResults = runDecisionClarificationArchitectureReview(filteredCases);
  const architectureResultById = new Map(architectureResults.map((r) => [r.id, r]));

  return filteredCases.map((architectureCase) => {
    const architectureResult = architectureResultById.get(architectureCase.id);
    if (!architectureResult) {
      throw new Error(`decisionSupportShadowMappingEvaluation: missing architecture result for case "${architectureCase.id}".`);
    }

    const eligibility = computeEligibility(architectureCase);
    const shouldRunHandler = runCandidateHandler && eligibility.isCandidateHandlerEligible;

    const candidateResult = shouldRunHandler
      ? handleDecisionSupportCandidate({ input: architectureCase.input, source: "architecture_review", now: options.now })
      : undefined;

    const isCandidateHandlerSafe = candidateResult ? evaluateCandidateHandlerSafety(candidateResult) : false;

    const collisionType = computeCollisionType({
      eligibility,
      mappedIntent: architectureResult.mappedIntent,
      productionIntent: architectureResult.productionIntent,
      candidateResult,
      isCandidateHandlerSafe,
      ran: Boolean(candidateResult),
    });

    const candidateConfidence = candidateResult?.recommendation.confidence;
    const isShadowRoutable =
      eligibility.isCandidateHandlerEligible &&
      !eligibility.isClarificationDesired &&
      isCandidateHandlerSafe &&
      candidateConfidence !== undefined &&
      candidateConfidence !== "low" &&
      !HANDLER_COLLISION_TYPES.has(collisionType);

    const integrationMode = computeCaseIntegrationMode({ eligibility, collisionType, isShadowRoutable });

    const warnings: string[] = [];
    if (!architectureResult.isCurrentSafeMapping) {
      warnings.push(
        `Live mappedIntent "${architectureResult.mappedIntent}" does not match this case's declared ` +
          `currentSafeMappedIntent "${architectureCase.currentSafeMappedIntent}" — the documented safe-fallback ` +
          "mapping does not hold for this input today.",
      );
    }
    if (candidateResult && !isCandidateHandlerSafe) {
      warnings.push("Candidate handler result failed one or more safety/structural checks — see collisionType.");
    }

    return {
      id: architectureCase.id,
      input: architectureCase.input,
      architectureCategory: architectureCase.architectureCategory,
      desiredFutureRoute: architectureCase.desiredFutureRoute,
      currentSafeMappedIntent: architectureCase.currentSafeMappedIntent,
      targetKind: architectureCase.targetKind,
      productionIntent: architectureResult.productionIntent,
      enrichedFamily: architectureResult.enrichedFamily,
      enrichedType: architectureResult.enrichedType,
      mappedIntent: architectureResult.mappedIntent,
      eligibility,
      candidateResult,
      candidateResponsePreview: candidateResult ? formatDecisionSupportCandidateResponse(candidateResult).slice(0, 400) : undefined,
      candidateDecisionType: candidateResult?.detectedDecisionType,
      candidateConfidence,
      candidateHasOptions: candidateResult ? candidateResult.options.length > 0 : false,
      candidateHasEvidence: candidateResult ? candidateResult.evidenceNeeded.length > 0 : false,
      candidateSafetyPass: isCandidateHandlerSafe,
      isCurrentMappingSafe: architectureResult.isCurrentSafeMapping,
      isCandidateHandlerSafe,
      isShadowRoutable,
      collisionType,
      integrationMode,
      warnings,
    } satisfies DecisionSupportShadowMappingResult;
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

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

const COLLISION_TYPES: DecisionSupportShadowCollisionType[] = [
  "none",
  "collides_with_playbook_analysis",
  "collides_with_general_pm_advice",
  "collides_with_risk_analysis",
  "collides_with_closure_billing",
  "collides_with_governance_audit",
  "collides_with_project_status",
  "collides_with_communication_draft",
  "collides_with_task_action",
  "unsupported_mapping",
  "clarification_required",
  "existing_route_should_win",
  "classifier_disagreement",
  "mapping_gap",
  "handler_not_applicable",
  "handler_low_confidence",
  "handler_missing_options",
  "handler_missing_evidence",
  "handler_safety_failure",
];

const DECISION_TYPES: DecisionSupportDecisionType[] = [
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
];

const INTEGRATION_MODES: DecisionSupportShadowIntegrationMode[] = [
  "do_not_integrate",
  "docs_only",
  "offline_evaluation_only",
  "shadow_mode_default_off",
  "feature_flag_default_off",
  "route_after_classifier_calibration",
  "route_after_adapter_mapping",
  "route_after_clarification_strategy",
];

/** Severity rank for sorting topUnsafeCollisions / topHandlerGaps — lower is more severe/specific. */
const COLLISION_SEVERITY_RANK: Partial<Record<DecisionSupportShadowCollisionType, number>> = {
  handler_safety_failure: 0,
  collides_with_playbook_analysis: 1,
  collides_with_general_pm_advice: 1,
  collides_with_risk_analysis: 2,
  collides_with_closure_billing: 2,
  collides_with_governance_audit: 2,
  handler_missing_evidence: 3,
  handler_missing_options: 3,
  classifier_disagreement: 4,
  mapping_gap: 4,
  handler_low_confidence: 5,
};

const TOP_LIST_LIMIT = 10;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

/**
 * Sprint 20R pre-calibration baseline, as measured and documented in
 * docs/conversational-brain-decision-support-shadow-mapping.md before Sprint 21R's classifier
 * changes: `unsafeClassifierCollisionCount` and its five named-family sub-counts come directly from
 * that doc's results table. `enrichedDecisionSupportDetectedCount` (15/45) was measured directly
 * against the unmodified Sprint 20R `intent-patterns.ts` (before any Sprint 21R pattern change) —
 * it is a distinct measurement from `unsafeClassifierCollisionCount` (which counts live collisions
 * with a *different* production intent, not raw enriched-family detection), so it is recorded here
 * rather than re-derived. Used only to compute the *Reduction/*ImprovementCount fields below —
 * never mutated, never re-measured at runtime.
 */
const SPRINT_20R_BASELINE = {
  unsafeClassifierCollisionCount: 21,
  playbookCollisionCount: 3,
  generalPmCollisionCount: 7,
  riskCollisionCount: 5,
  closureCollisionCount: 2,
  governanceCollisionCount: 3,
  enrichedDecisionSupportDetectedCount: 15,
} as const;

function reductionFrom(baseline: number, current: number): number {
  return Math.max(0, baseline - current);
}

function improvementFrom(baseline: number, current: number): number {
  return Math.max(0, current - baseline);
}

/** Share above which a bucket is considered dominant for the integration-mode heuristic below. */
const CLASSIFIER_DOMINANCE_SHARE = 0.5;
/** Minimum share of eligible cases an unsafe-classifier-collision slice must reach to matter at all. */
const MEANINGFUL_COLLISION_SHARE = 0.15;

function computeRecommendedIntegrationMode(input: {
  candidateHandlerEligibleCount: number;
  candidateHandlerSafeRate: number;
  shadowRoutableRate: number;
  handlerSafetyFailureCount: number;
  unsafeClassifierCollisionCount: number;
  playbookCollisionCount: number;
  generalPmCollisionCount: number;
  mappingGapCount: number;
  classifierDisagreementCount: number;
  existingRouteRegressionCount: number;
}): { recommendedIntegrationMode: DecisionSupportShadowIntegrationMode; recommendation: string } {
  const {
    candidateHandlerEligibleCount,
    candidateHandlerSafeRate,
    shadowRoutableRate,
    handlerSafetyFailureCount,
    unsafeClassifierCollisionCount,
    playbookCollisionCount,
    generalPmCollisionCount,
    mappingGapCount,
    classifierDisagreementCount,
    existingRouteRegressionCount,
  } = input;

  if (handlerSafetyFailureCount > 0 || candidateHandlerSafeRate < 70 || shadowRoutableRate < 50) {
    return {
      recommendedIntegrationMode: "do_not_integrate",
      recommendation:
        `do_not_integrate: candidateHandlerSafeRate (${candidateHandlerSafeRate}%) or shadowRoutableRate ` +
        `(${shadowRoutableRate}%) is below the safety threshold, or handlerSafetyFailureCount ` +
        `(${handlerSafetyFailureCount}) is above zero — nothing should be wired to production until this clears.`,
    };
  }

  const collisionShare = candidateHandlerEligibleCount > 0 ? unsafeClassifierCollisionCount / candidateHandlerEligibleCount : 0;
  const playbookGeneralPmShare =
    unsafeClassifierCollisionCount > 0 ? (playbookCollisionCount + generalPmCollisionCount) / unsafeClassifierCollisionCount : 0;
  const mappingShare =
    unsafeClassifierCollisionCount > 0 ? (mappingGapCount + classifierDisagreementCount) / unsafeClassifierCollisionCount : 0;

  if (collisionShare >= MEANINGFUL_COLLISION_SHARE && playbookGeneralPmShare >= CLASSIFIER_DOMINANCE_SHARE) {
    return {
      recommendedIntegrationMode: "route_after_classifier_calibration",
      recommendation:
        `route_after_classifier_calibration: playbook_analysis + general_pm_advice collisions make up ` +
        `${round1(playbookGeneralPmShare * 100)}% of ${unsafeClassifierCollisionCount} unsafe classifier collisions ` +
        `(${round1(collisionShare * 100)}% of eligible cases) — the handler itself is safe, but the classifier ` +
        "boundary must be resolved before any routing change.",
    };
  }

  if (collisionShare >= MEANINGFUL_COLLISION_SHARE && mappingShare >= CLASSIFIER_DOMINANCE_SHARE) {
    return {
      recommendedIntegrationMode: "route_after_adapter_mapping",
      recommendation:
        `route_after_adapter_mapping: mapping_gap + classifier_disagreement collisions make up ` +
        `${round1(mappingShare * 100)}% of ${unsafeClassifierCollisionCount} unsafe classifier collisions — the ` +
        "adapter's decision_support mapping needs work before any routing change.",
    };
  }

  if (
    candidateHandlerSafeRate >= 90 &&
    shadowRoutableRate >= 85 &&
    collisionShare < MEANINGFUL_COLLISION_SHARE &&
    handlerSafetyFailureCount === 0 &&
    existingRouteRegressionCount === 0
  ) {
    return {
      recommendedIntegrationMode: "feature_flag_default_off",
      recommendation:
        `feature_flag_default_off: candidateHandlerSafeRate (${candidateHandlerSafeRate}%) and shadowRoutableRate ` +
        `(${shadowRoutableRate}%) are both high, classifier collisions are low, and there are no existing-route ` +
        "regressions — this is the strongest state this evaluator can recommend.",
    };
  }

  if (
    candidateHandlerSafeRate >= 85 &&
    shadowRoutableRate >= 70 &&
    handlerSafetyFailureCount === 0 &&
    existingRouteRegressionCount === 0
  ) {
    return {
      recommendedIntegrationMode: "shadow_mode_default_off",
      recommendation:
        `shadow_mode_default_off: candidateHandlerSafeRate (${candidateHandlerSafeRate}%) and shadowRoutableRate ` +
        `(${shadowRoutableRate}%) are healthy enough to prepare a default-off shadow mode, though classifier ` +
        "collisions should still be tracked.",
    };
  }

  return {
    recommendedIntegrationMode: "offline_evaluation_only",
    recommendation:
      `offline_evaluation_only: candidateHandlerSafeRate (${candidateHandlerSafeRate}%) is acceptable but ` +
      `shadowRoutableRate (${shadowRoutableRate}%) or the classifier-collision profile is not yet strong enough ` +
      "to recommend shadow mode or a feature flag — keep this as an offline/shadow evaluation for now.",
  };
}

function computeRecommendedNextSprint(input: {
  playbookCollisionCount: number;
  generalPmCollisionCount: number;
  handlerLowConfidenceCount: number;
  handlerMissingOptionsCount: number;
  handlerMissingEvidenceCount: number;
  handlerSafetyFailureCount: number;
  mappingGapCount: number;
  classifierDisagreementCount: number;
  clarificationUnsafeMappingCount: number;
}): { recommendedNextSprint: DecisionSupportShadowMappingNextSprintRecommendation; recommendation: string } {
  const {
    playbookCollisionCount,
    generalPmCollisionCount,
    handlerMissingOptionsCount,
    handlerMissingEvidenceCount,
    handlerSafetyFailureCount,
    mappingGapCount,
    classifierDisagreementCount,
    clarificationUnsafeMappingCount,
  } = input;

  const classifierBoundaryBucket = playbookCollisionCount + generalPmCollisionCount;
  // handlerLowConfidenceCount is deliberately excluded here: a low-confidence result is the handler
  // correctly asking a clarifying question when the message names fewer than two concrete options and
  // no availableContext was supplied (this evaluator never fabricates context) — documented, intended
  // behavior, not a structural defect. Structural defects (missing options/evidence, a safety-flag
  // failure) are the actual "handler needs hardening" signal.
  const handlerQualityBucket = handlerMissingOptionsCount + handlerMissingEvidenceCount + handlerSafetyFailureCount;
  const adapterMappingBucket = mappingGapCount + classifierDisagreementCount;
  // Uses the *unsafe* clarification-mapping count (cases where today's live mapping is not even the
  // documented safe fallback), not the raw clarificationRequiredCount — the latter counts every
  // clarification-desired case regardless of whether it is actually a live problem today, which would
  // otherwise make this bucket dominate purely from corpus composition, not from real risk.
  const clarificationBucket = clarificationUnsafeMappingCount;

  const buckets: Array<{ recommendedNextSprint: DecisionSupportShadowMappingNextSprintRecommendation; value: number }> = [
    { recommendedNextSprint: "Sprint 21R — Decision Support Classifier Boundary Calibration", value: classifierBoundaryBucket },
    { recommendedNextSprint: "Sprint 21R — Decision Support Handler Quality Hardening", value: handlerQualityBucket },
    { recommendedNextSprint: "Sprint 21R — Decision Support Adapter Mapping Plan", value: adapterMappingBucket },
    { recommendedNextSprint: "Sprint 21R — Clarification Response Strategy", value: clarificationBucket },
  ];

  const dominant = buckets.reduce((best, current) => (current.value > best.value ? current : best), buckets[0]);

  if (dominant.value === 0) {
    return {
      recommendedNextSprint: "Sprint 21R — Decision Support Shadow Mode Prep",
      recommendation:
        "No dominant gap bucket (classifier boundary, handler quality, adapter mapping, clarification) was found " +
        "— the architecture is healthy enough to prepare a controlled shadow mode rollout next.",
    };
  }

  return {
    recommendedNextSprint: dominant.recommendedNextSprint,
    recommendation:
      `${dominant.recommendedNextSprint.replace("Sprint 21R — ", "")} is the dominant gap: classifier boundary ` +
      `(playbook+general_pm collisions) = ${classifierBoundaryBucket}, handler quality gaps = ${handlerQualityBucket}, ` +
      `adapter/mapping gaps = ${adapterMappingBucket}, clarification-required = ${clarificationBucket}.`,
  };
}

function topBySeverity(results: DecisionSupportShadowMappingResult[], predicate: (r: DecisionSupportShadowMappingResult) => boolean): DecisionSupportShadowMappingResult[] {
  return results
    .filter(predicate)
    .slice()
    .sort((a, b) => (COLLISION_SEVERITY_RANK[a.collisionType] ?? 99) - (COLLISION_SEVERITY_RANK[b.collisionType] ?? 99))
    .slice(0, TOP_LIST_LIMIT);
}

const CONFIDENCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Turns a `runDecisionSupportShadowMappingEvaluation()` result array into a review-ready report:
 * global + per-architecture-category rates, collision/decision-type/integration-mode breakdowns, the
 * top unsafe collisions / handler gaps / shadow-routable cases, and an integration-mode + next-sprint
 * recommendation. Pure — takes an already-computed result array rather than re-running anything.
 */
export function summarizeDecisionSupportShadowMappingEvaluation(
  results: DecisionSupportShadowMappingResult[],
): DecisionSupportShadowMappingSummary {
  const totalCases = results.length;

  const byArchitectureCategory = Object.fromEntries(
    ARCHITECTURE_CATEGORIES.map((architectureCategory) => [
      architectureCategory,
      {
        architectureCategory,
        totalCases: 0,
        candidateHandlerEligibleCount: 0,
        candidateHandlerSafeCount: 0,
        shadowRoutableCount: 0,
        shadowRoutableRate: 0,
      } satisfies DecisionSupportShadowMappingCategorySummary,
    ]),
  ) as Record<DecisionClarificationArchitectureCategory, DecisionSupportShadowMappingCategorySummary>;

  const byCollisionType = Object.fromEntries(COLLISION_TYPES.map((c) => [c, 0])) as Record<DecisionSupportShadowCollisionType, number>;
  const byDecisionType = Object.fromEntries(DECISION_TYPES.map((t) => [t, 0])) as Record<DecisionSupportDecisionType, number>;
  const byIntegrationMode = Object.fromEntries(INTEGRATION_MODES.map((m) => [m, 0])) as Record<DecisionSupportShadowIntegrationMode, number>;

  let decisionSupportDesiredCount = 0;
  let clarificationDesiredCount = 0;
  let existingRouteCount = 0;
  let candidateHandlerEligibleCount = 0;
  let candidateHandlerSafeCount = 0;
  let shadowRoutableCount = 0;
  let enrichedDecisionSupportDetectedCount = 0;
  let unsupportedSafeParkingCount = 0;
  let currentMappingSafeCount = 0;
  let existingRouteRegressionCount = 0;
  let clarificationUnsafeMappingCount = 0;

  for (const result of results) {
    const categorySummary = byArchitectureCategory[result.architectureCategory];
    categorySummary.totalCases += 1;

    if (result.eligibility.isDecisionSupportDesired) {
      decisionSupportDesiredCount += 1;
      if (result.enrichedFamily === "decision_support") {
        enrichedDecisionSupportDetectedCount += 1;
        if (result.mappedIntent === "unsupported") unsupportedSafeParkingCount += 1;
      }
    }
    if (result.eligibility.isClarificationDesired) clarificationDesiredCount += 1;
    if (result.eligibility.isExistingRouteCase) existingRouteCount += 1;
    if (result.eligibility.isCandidateHandlerEligible) {
      candidateHandlerEligibleCount += 1;
      categorySummary.candidateHandlerEligibleCount += 1;
    }
    if (result.isCandidateHandlerSafe) {
      candidateHandlerSafeCount += 1;
      categorySummary.candidateHandlerSafeCount += 1;
    }
    if (result.isShadowRoutable) {
      shadowRoutableCount += 1;
      categorySummary.shadowRoutableCount += 1;
    }
    if (result.isCurrentMappingSafe) currentMappingSafeCount += 1;
    if (result.eligibility.isClarificationDesired && !result.isCurrentMappingSafe) clarificationUnsafeMappingCount += 1;
    if (result.eligibility.isExistingRouteCase && result.mappedIntent !== result.desiredFutureRoute) {
      existingRouteRegressionCount += 1;
    }

    byCollisionType[result.collisionType] += 1;
    byIntegrationMode[result.integrationMode] += 1;
    if (result.candidateDecisionType) byDecisionType[result.candidateDecisionType] += 1;
  }

  for (const architectureCategory of ARCHITECTURE_CATEGORIES) {
    const categorySummary = byArchitectureCategory[architectureCategory];
    categorySummary.shadowRoutableRate = rateOf(categorySummary.shadowRoutableCount, categorySummary.totalCases);
  }

  const playbookCollisionCount = byCollisionType.collides_with_playbook_analysis;
  const generalPmCollisionCount = byCollisionType.collides_with_general_pm_advice;
  const riskCollisionCount = byCollisionType.collides_with_risk_analysis;
  const closureCollisionCount = byCollisionType.collides_with_closure_billing;
  const governanceCollisionCount = byCollisionType.collides_with_governance_audit;
  const unsupportedMappingCount = byCollisionType.unsupported_mapping;
  const clarificationRequiredCount = byCollisionType.clarification_required;
  const handlerLowConfidenceCount = byCollisionType.handler_low_confidence;
  const handlerMissingOptionsCount = byCollisionType.handler_missing_options;
  const handlerMissingEvidenceCount = byCollisionType.handler_missing_evidence;
  const handlerSafetyFailureCount = byCollisionType.handler_safety_failure;
  const mappingGapCount = byCollisionType.mapping_gap;
  const classifierDisagreementCount = byCollisionType.classifier_disagreement;

  const unsafeClassifierCollisionCount =
    playbookCollisionCount +
    generalPmCollisionCount +
    riskCollisionCount +
    closureCollisionCount +
    governanceCollisionCount +
    mappingGapCount +
    classifierDisagreementCount;

  const candidateHandlerCoverageRate = rateOf(candidateHandlerEligibleCount, decisionSupportDesiredCount || totalCases);
  const candidateHandlerSafeRate = rateOf(candidateHandlerSafeCount, candidateHandlerEligibleCount);
  const shadowRoutableRate = rateOf(shadowRoutableCount, candidateHandlerEligibleCount);
  const currentMappingSafeRate = rateOf(currentMappingSafeCount, totalCases);

  const { recommendedIntegrationMode, recommendation: integrationModeRecommendation } = computeRecommendedIntegrationMode({
    candidateHandlerEligibleCount,
    candidateHandlerSafeRate,
    shadowRoutableRate,
    handlerSafetyFailureCount,
    unsafeClassifierCollisionCount,
    playbookCollisionCount,
    generalPmCollisionCount,
    mappingGapCount,
    classifierDisagreementCount,
    existingRouteRegressionCount,
  });

  const { recommendedNextSprint, recommendation: nextSprintRecommendation } = computeRecommendedNextSprint({
    playbookCollisionCount,
    generalPmCollisionCount,
    handlerLowConfidenceCount,
    handlerMissingOptionsCount,
    handlerMissingEvidenceCount,
    handlerSafetyFailureCount,
    mappingGapCount,
    classifierDisagreementCount,
    clarificationUnsafeMappingCount,
  });

  const topUnsafeCollisions = topBySeverity(
    results,
    (r) =>
      r.collisionType === "collides_with_playbook_analysis" ||
      r.collisionType === "collides_with_general_pm_advice" ||
      r.collisionType === "collides_with_risk_analysis" ||
      r.collisionType === "collides_with_closure_billing" ||
      r.collisionType === "collides_with_governance_audit" ||
      r.collisionType === "classifier_disagreement" ||
      r.collisionType === "mapping_gap",
  );

  const topHandlerGaps = topBySeverity(results, (r) => HANDLER_COLLISION_TYPES.has(r.collisionType));

  const topShadowRoutableCases = results
    .filter((r) => r.isShadowRoutable)
    .slice()
    .sort((a, b) => (CONFIDENCE_ORDER[a.candidateConfidence ?? "low"] ?? 9) - (CONFIDENCE_ORDER[b.candidateConfidence ?? "low"] ?? 9))
    .slice(0, TOP_LIST_LIMIT);

  return {
    totalCases,
    evaluatedCases: totalCases,
    decisionSupportDesiredCount,
    clarificationDesiredCount,
    existingRouteCount,
    candidateHandlerEligibleCount,
    candidateHandlerCoverageRate,
    candidateHandlerSafeCount,
    candidateHandlerSafeRate,
    shadowRoutableCount,
    shadowRoutableRate,
    currentMappingSafeCount,
    currentMappingSafeRate,
    unsafeClassifierCollisionCount,
    playbookCollisionCount,
    generalPmCollisionCount,
    riskCollisionCount,
    closureCollisionCount,
    governanceCollisionCount,
    unsupportedMappingCount,
    clarificationRequiredCount,
    handlerLowConfidenceCount,
    handlerMissingOptionsCount,
    handlerMissingEvidenceCount,
    handlerSafetyFailureCount,
    enrichedDecisionSupportDetectedCount,
    enrichedDecisionSupportDetectionRate: rateOf(enrichedDecisionSupportDetectedCount, decisionSupportDesiredCount),
    decisionSupportBoundaryCapturedCount: enrichedDecisionSupportDetectedCount,
    decisionSupportBoundaryCapturedRate: rateOf(enrichedDecisionSupportDetectedCount, decisionSupportDesiredCount),
    unsupportedSafeParkingCount,
    semanticBoundaryImprovementCount: improvementFrom(
      SPRINT_20R_BASELINE.enrichedDecisionSupportDetectedCount,
      enrichedDecisionSupportDetectedCount,
    ),
    unsafeClassifierCollisionReduction: reductionFrom(SPRINT_20R_BASELINE.unsafeClassifierCollisionCount, unsafeClassifierCollisionCount),
    playbookCollisionReduction: reductionFrom(SPRINT_20R_BASELINE.playbookCollisionCount, playbookCollisionCount),
    generalPmCollisionReduction: reductionFrom(SPRINT_20R_BASELINE.generalPmCollisionCount, generalPmCollisionCount),
    riskCollisionReduction: reductionFrom(SPRINT_20R_BASELINE.riskCollisionCount, riskCollisionCount),
    closureCollisionReduction: reductionFrom(SPRINT_20R_BASELINE.closureCollisionCount, closureCollisionCount),
    governanceCollisionReduction: reductionFrom(SPRINT_20R_BASELINE.governanceCollisionCount, governanceCollisionCount),
    byArchitectureCategory,
    byCollisionType,
    byDecisionType,
    byIntegrationMode,
    topUnsafeCollisions,
    topHandlerGaps,
    topShadowRoutableCases,
    recommendedIntegrationMode,
    recommendedNextSprint,
    recommendation: `${integrationModeRecommendation} ${nextSprintRecommendation}`,
  };
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 20R shadow mapping evaluator — mirrors the style of
 * `explainDecisionClarificationArchitecture()` (Sprint 18R) and
 * `explainDecisionSupportCandidateHandler()` (Sprint 19R). See
 * `docs/conversational-brain-decision-support-shadow-mapping.md` for full context.
 */
export function explainDecisionSupportShadowMappingEvaluation(): DecisionSupportShadowMappingExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-shadow-mapping-evaluation",
    purpose:
      "Measures, offline and without touching production, how the Sprint 19R Decision Support Candidate Handler " +
      "would behave against the Sprint 18R architecture corpus and today's live classifier/adapter routing: how " +
      "many cases are eligible, how many the handler can process safely, where it collides with the eight other " +
      "categories, which current mappings are safe, which are dangerous, and what integration mode and Sprint 21R " +
      "follow-up this evidence supports.",
    doesNot: [
      "Does not import or call router/brainRouter.ts, composer/responseComposer.ts, any handlers/*.ts, or conversationalBrainGateway.ts.",
      "Does not touch POST /api/command-center/chat.",
      "Does not read or write a database, call Supabase, send email, create tasks, or execute any action.",
      "Does not call an LLM or any external API — fully deterministic and local, no fetch.",
      "Does not activate a feature flag or the enriched classifier in production.",
      "Does not modify classifier/intentClassifier.rules.ts, intent-patterns.ts, or intentCompatibilityAdapter.ts's mapping table.",
      "Does not connect decision_support to the router — isShadowRoutable never means production routing.",
    ],
    nonGoals: [
      "Integrate the candidate handler into the router.",
      "Change the endpoint, composer, or any production handler.",
      "Change classifier patterns or the adapter mapping table.",
      "Activate any feature flag.",
      "Create a new Context Resolver, Router, or Composer.",
      "Calibrate general_pm_advice vocabulary.",
      "Implement a clarification loop.",
    ],
    eligibilityRules: [
      "Eligible for the candidate handler when desiredFutureRoute === 'decision_support', requiresNewHandler === true, " +
        "shouldExecuteAction === false, targetKind === 'future_architecture', and input is non-empty.",
      "Never eligible when desiredFutureRoute === 'needs_clarification', requiresClarification === true, " +
        "targetKind === 'clarification_strategy', or architectureCategory starts with 'clarification_'.",
      "Never eligible when targetKind === 'existing_production_route' (existing_route_should_win cases).",
      "Clarification and existing-route cases are always reported in results/summary, but never run through the " +
        "candidate handler by default (see includeClarificationCases/includeExistingRouteCases/runCandidateHandler).",
    ],
    collisionRules: [
      "existing_route_should_win / clarification_required are reported first and never overridden by any other rule.",
      "handler_safety_failure fires whenever the candidate handler ran and failed any structural or safety.* check.",
      "Named classifier-family collisions (collides_with_playbook_analysis/general_pm_advice/risk_analysis/" +
        "closure_billing/governance_audit) are keyed off the live mappedIntent value and take priority over handler-" +
        "quality gaps, since a classifier collision is a more fundamental routing risk than a handler quality issue.",
      "handler_missing_options / handler_missing_evidence / handler_low_confidence fire only once no named classifier " +
        "collision is present, for cases where the candidate handler ran.",
      "handler_not_applicable covers decision_support-desired cases the candidate handler did not run for (e.g. " +
        "runCandidateHandler: false).",
      "unsupported_mapping / classifier_disagreement / mapping_gap are the residual classifier bucket: unsupported_mapping " +
        "means the documented Sprint 10R safe fallback held; the other two mean the classifier landed on some other " +
        "production intent not named above.",
    ],
    safetyRules: [
      "isCandidateHandlerSafe requires: kind === 'decision_support_candidate_result'; a non-empty decisionStatement; " +
        "at least one option, tradeoff, risk, and evidence need; non-empty recommendedPath and suggestedNextStep; a " +
        "valid confidence value; and every safety.* flag at its documented safe-candidate value (shouldExecuteAction/" +
        "shouldCreateTask/shouldSendEmail/shouldWriteToDb === false, requiresHumanConfirmation === true, " +
        "productionRoutingEnabled === false).",
      "isShadowRoutable requires isCandidateHandlerEligible, isCandidateHandlerSafe, confidence !== 'low', no handler-" +
        "quality/safety collisionType, and no clarification desired. isShadowRoutable never means production " +
        "routing — it only means 'viable candidate for a future shadow-mode/offline evaluation'.",
    ],
    integrationModeRules: [
      "do_not_integrate if candidateHandlerSafeRate < 70%, shadowRoutableRate < 50%, or any handlerSafetyFailureCount > 0.",
      "route_after_classifier_calibration if the handler is safe but playbook_analysis + general_pm_advice collisions " +
        "dominate the unsafe-classifier-collision slice.",
      "route_after_adapter_mapping if the handler is safe but mapping_gap + classifier_disagreement collisions dominate instead.",
      "feature_flag_default_off requires candidateHandlerSafeRate >= 90%, shadowRoutableRate >= 85%, low classifier " +
        "collisions, no safety failures, and no existing-route regressions.",
      "shadow_mode_default_off requires candidateHandlerSafeRate >= 85%, shadowRoutableRate >= 70%, no safety " +
        "failures, and no existing-route regressions.",
      "offline_evaluation_only is the default, safe fallback when none of the above thresholds are met — this " +
        "sprint does not force shadow mode when the data does not support it.",
    ],
    recommendedNextSprintLogic: [
      "Computes four gap buckets: classifier boundary (playbook + general_pm collisions), handler quality " +
        "(low-confidence + missing-options + missing-evidence + safety-failure counts), adapter/mapping " +
        "(mapping_gap + classifier_disagreement counts), and clarification-required count.",
      "Recommends the sprint matching whichever bucket is largest: Classifier Boundary Calibration, Handler Quality " +
        "Hardening, Adapter Mapping Plan, or Clarification Response Strategy, in that priority order on ties.",
      "Recommends Decision Support Shadow Mode Prep only when every bucket is zero.",
    ],
  };
}
