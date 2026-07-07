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
