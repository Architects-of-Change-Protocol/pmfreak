/**
 * Sprint 20R — Decision Support Shadow Mapping Evaluation: types.
 *
 * Pure type definitions for a read-only, offline evaluator that measures how the Sprint 19R Decision
 * Support Candidate Handler (`decisionSupportCandidateHandler.ts`) would behave against the Sprint 18R
 * architecture corpus (`tests/fixtures/conversational-brain-decision-clarification-cases.ts`) and
 * today's production/enriched/adapter routing (`intentCompatibilityAdapter.ts`, via
 * `decisionClarificationArchitectureReview.ts`) — without wiring anything to the router, composer,
 * any production handler, or the endpoint. See
 * `docs/conversational-brain-decision-support-shadow-mapping.md` for the full design writeup.
 */

import type {
  DecisionClarificationArchitectureCategory,
  DecisionClarificationDesiredFutureRoute,
  DecisionClarificationTargetKind,
} from "../classifier/decisionClarificationArchitectureReview";
import type { ConversationIntent as ProductionConversationIntent } from "../types";
import type {
  ConversationIntentFamily as EnrichedConversationIntentFamily,
  ConversationIntentType as EnrichedConversationIntentType,
} from "@/lib/conversational-brain";
import type {
  DecisionSupportCandidateResult,
  DecisionSupportConfidence,
  DecisionSupportDecisionType,
} from "./decisionSupportCandidateTypes";

// ─── Input ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowMappingOptions = {
  /** Whether clarification_* cases are included in the returned results. Default true. */
  includeClarificationCases?: boolean;
  /** Whether existing_route_should_win cases are included in the returned results. Default true. */
  includeExistingRouteCases?: boolean;
  /** Whether the candidate handler is actually invoked for eligible cases. Default true. */
  runCandidateHandler?: boolean;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

/** Documents the full input shape this evaluator conceptually accepts (`cases` + options). The
 * actual function signature is `runDecisionSupportShadowMappingEvaluation(cases, options?)`. */
export type DecisionSupportShadowMappingInput = DecisionSupportShadowMappingOptions & {
  cases: import("../classifier/decisionClarificationArchitectureReview").DecisionClarificationCase[];
};

// ─── Eligibility ─────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowEligibility = {
  isDecisionSupportDesired: boolean;
  isClarificationDesired: boolean;
  isExistingRouteCase: boolean;
  isCandidateHandlerEligible: boolean;
  eligibilityReason: string;
  ineligibilityReasons: string[];
};

// ─── Collision classification ────────────────────────────────────────────────────────

export type DecisionSupportShadowCollisionType =
  | "none"
  | "collides_with_playbook_analysis"
  | "collides_with_general_pm_advice"
  | "collides_with_risk_analysis"
  | "collides_with_closure_billing"
  | "collides_with_governance_audit"
  | "collides_with_project_status"
  | "collides_with_communication_draft"
  | "collides_with_task_action"
  | "unsupported_mapping"
  | "clarification_required"
  | "existing_route_should_win"
  | "classifier_disagreement"
  | "mapping_gap"
  | "handler_not_applicable"
  | "handler_low_confidence"
  | "handler_missing_options"
  | "handler_missing_evidence"
  | "handler_safety_failure";

// ─── Integration mode ─────────────────────────────────────────────────────────────────

export type DecisionSupportShadowIntegrationMode =
  | "do_not_integrate"
  | "docs_only"
  | "offline_evaluation_only"
  | "shadow_mode_default_off"
  | "feature_flag_default_off"
  | "route_after_classifier_calibration"
  | "route_after_adapter_mapping"
  | "route_after_clarification_strategy";

// ─── Result ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowMappingResult = {
  id: string;
  input: string;
  architectureCategory: DecisionClarificationArchitectureCategory;
  desiredFutureRoute: DecisionClarificationDesiredFutureRoute;
  currentSafeMappedIntent: ProductionConversationIntent;
  targetKind: DecisionClarificationTargetKind;
  productionIntent: ProductionConversationIntent;
  enrichedFamily: EnrichedConversationIntentFamily;
  enrichedType?: EnrichedConversationIntentType;
  mappedIntent: ProductionConversationIntent;
  eligibility: DecisionSupportShadowEligibility;
  candidateResult?: DecisionSupportCandidateResult;
  candidateResponsePreview?: string;
  candidateDecisionType?: DecisionSupportDecisionType;
  candidateConfidence?: DecisionSupportConfidence;
  candidateHasOptions: boolean;
  candidateHasEvidence: boolean;
  candidateSafetyPass: boolean;
  isCurrentMappingSafe: boolean;
  isCandidateHandlerSafe: boolean;
  isShadowRoutable: boolean;
  collisionType: DecisionSupportShadowCollisionType;
  integrationMode: DecisionSupportShadowIntegrationMode;
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowMappingCategorySummary = {
  architectureCategory: DecisionClarificationArchitectureCategory;
  totalCases: number;
  candidateHandlerEligibleCount: number;
  candidateHandlerSafeCount: number;
  shadowRoutableCount: number;
  shadowRoutableRate: number;
};

export type DecisionSupportShadowMappingNextSprintRecommendation =
  | "Sprint 21R — Decision Support Classifier Boundary Calibration"
  | "Sprint 21R — Decision Support Handler Quality Hardening"
  | "Sprint 21R — Decision Support Adapter Mapping Plan"
  | "Sprint 21R — Clarification Response Strategy"
  | "Sprint 21R — Decision Support Shadow Mode Prep";

export type DecisionSupportShadowMappingSummary = {
  totalCases: number;
  evaluatedCases: number;
  decisionSupportDesiredCount: number;
  clarificationDesiredCount: number;
  existingRouteCount: number;
  candidateHandlerEligibleCount: number;
  candidateHandlerCoverageRate: number;
  candidateHandlerSafeCount: number;
  candidateHandlerSafeRate: number;
  shadowRoutableCount: number;
  shadowRoutableRate: number;
  currentMappingSafeCount: number;
  currentMappingSafeRate: number;
  unsafeClassifierCollisionCount: number;
  playbookCollisionCount: number;
  generalPmCollisionCount: number;
  riskCollisionCount: number;
  closureCollisionCount: number;
  governanceCollisionCount: number;
  unsupportedMappingCount: number;
  clarificationRequiredCount: number;
  handlerLowConfidenceCount: number;
  handlerMissingOptionsCount: number;
  handlerMissingEvidenceCount: number;
  handlerSafetyFailureCount: number;
  /** Sprint 21R — count of decision_support-desired cases where the enriched classifier's own
   * intentFamily is "decision_support", independent of what the adapter maps that family to today. */
  enrichedDecisionSupportDetectedCount: number;
  /** enrichedDecisionSupportDetectedCount / decisionSupportDesiredCount, as a 0-100 percentage. */
  enrichedDecisionSupportDetectionRate: number;
  /** Sprint 21R — identical count to enrichedDecisionSupportDetectedCount, named for the "boundary
   * captured" framing used in the Sprint 21R doc: the semantic decision_support boundary was
   * correctly recognized, even though production routing for it does not exist yet. */
  decisionSupportBoundaryCapturedCount: number;
  /** decisionSupportBoundaryCapturedCount / decisionSupportDesiredCount, as a 0-100 percentage. */
  decisionSupportBoundaryCapturedRate: number;
  /** Sprint 21R — of the cases where the enriched classifier now detects decision_support, how many
   * still map (via the Sprint 10R adapter) to "unsupported". This is NOT a production success — it is
   * the documented safe fallback holding for a family with no production route yet. Never treat this
   * as routable; see recommendedIntegrationMode below, which is unaffected by this count. */
  unsupportedSafeParkingCount: number;
  /** Sprint 21R — enrichedDecisionSupportDetectedCount minus the Sprint 20R pre-calibration baseline
   * (15/45, measured directly against the unmodified Sprint 20R patterns before this sprint's
   * changes) — how many additional decision_support_* cases the enriched classifier now correctly
   * recognizes as decision_support that it previously missed or misrouted to another family. Clamped
   * to 0 so a future regression reads as 0, not negative. */
  semanticBoundaryImprovementCount: number;
  /** Sprint 20R baseline (21) minus this run's unsafeClassifierCollisionCount. Positive means fewer
   * live classifier collisions than Sprint 20R measured; clamped to 0. */
  unsafeClassifierCollisionReduction: number;
  /** Sprint 20R baseline (3) minus this run's playbookCollisionCount. Clamped to 0. */
  playbookCollisionReduction: number;
  /** Sprint 20R baseline (7) minus this run's generalPmCollisionCount. Clamped to 0. */
  generalPmCollisionReduction: number;
  /** Sprint 20R baseline (5) minus this run's riskCollisionCount. Clamped to 0. */
  riskCollisionReduction: number;
  /** Sprint 20R baseline (2) minus this run's closureCollisionCount. Clamped to 0. */
  closureCollisionReduction: number;
  /** Sprint 20R baseline (3) minus this run's governanceCollisionCount. Clamped to 0. */
  governanceCollisionReduction: number;
  byArchitectureCategory: Record<DecisionClarificationArchitectureCategory, DecisionSupportShadowMappingCategorySummary>;
  byCollisionType: Record<DecisionSupportShadowCollisionType, number>;
  byDecisionType: Record<DecisionSupportDecisionType, number>;
  byIntegrationMode: Record<DecisionSupportShadowIntegrationMode, number>;
  topUnsafeCollisions: DecisionSupportShadowMappingResult[];
  topHandlerGaps: DecisionSupportShadowMappingResult[];
  topShadowRoutableCases: DecisionSupportShadowMappingResult[];
  recommendedIntegrationMode: DecisionSupportShadowIntegrationMode;
  recommendedNextSprint: DecisionSupportShadowMappingNextSprintRecommendation;
  recommendation: string;
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowMappingExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  nonGoals: string[];
  eligibilityRules: string[];
  collisionRules: string[];
  safetyRules: string[];
  integrationModeRules: string[];
  recommendedNextSprintLogic: string[];
};
