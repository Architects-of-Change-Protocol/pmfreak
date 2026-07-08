import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import type {
  DecisionSupportResponseDraftHarnessCaseResult,
  DecisionSupportResponseDraftHarnessResult,
  DecisionSupportResponseDraftHarnessSummary,
} from "./decisionSupportResponseDraftHarnessTypes";

/**
 * Sprint 34R — Decision Support Response Draft Quality Evaluation: types.
 *
 * Pure type definitions for an offline, deterministic **response draft quality evaluation** — not a
 * user-visible dry run, and not production wiring — that scores every synthetic draft the Sprint 33R
 * response draft harness already generated and validated across fourteen quality dimensions (clarity,
 * usefulness, PM relevance, clarification quality, assumption quality, safe-next-step quality,
 * non-execution clarity, route/unsupported preservation quality, tone, conciseness, overconfidence,
 * leakage, and side effects), and consolidates a decision on whether the corpus is ready for a Sprint 35R
 * user-visible dry run evaluation harness. This module only ever reads already-computed Sprint 18R-33R
 * evaluation results; it never shows anything to a real user, never persists anything real, and never
 * touches the router, composer, endpoint, or any production handler.
 *
 * See `docs/conversational-brain-decision-support-response-draft-quality-evaluation.md` for the full
 * scope and non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityEvaluationProfile = "strict_response_draft_quality_evaluation";

export type DecisionSupportResponseDraftQualityEvaluationMode =
  | "quality_evaluation_only"
  | "clarification_quality_review"
  | "route_preservation_quality_review"
  | "unsupported_boundary_quality_review"
  | "dry_run_readiness_quality_review";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityEvaluationDecision =
  | "ready_for_user_visible_dry_run_evaluation_harness"
  | "continue_quality_evaluation_only"
  | "blocked_by_low_quality_score"
  | "blocked_by_clarification_quality_gap"
  | "blocked_by_unsafe_tone"
  | "blocked_by_missing_safe_next_step"
  | "blocked_by_leakage_or_side_effect_risk";

// ─── Quality dimension ────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityDimension =
  | "clarity"
  | "usefulness"
  | "pm_relevance"
  | "clarification_quality"
  | "assumption_quality"
  | "safe_next_step_quality"
  | "non_execution_clarity"
  | "route_preservation_quality"
  | "unsupported_boundary_quality"
  | "tone"
  | "conciseness"
  | "no_overconfidence"
  | "no_leakage"
  | "no_side_effects";

// ─── Quality status ───────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityStatus = "pass" | "warning" | "fail" | "blocked";

// ─── Quality risk level ───────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityRiskLevel = "low" | "medium" | "high" | "critical";

// ─── Quality issue type ───────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityIssueType =
  | "unclear_question"
  | "missing_question"
  | "weak_assumptions"
  | "missing_assumptions"
  | "weak_next_step"
  | "missing_next_step"
  | "missing_non_execution_notice"
  | "overconfident_language"
  | "sounds_like_final_decision"
  | "too_verbose"
  | "too_vague"
  | "not_pm_relevant"
  | "route_not_preserved"
  | "unsupported_not_preserved"
  | "unsafe_tone"
  | "raw_input_leak"
  | "full_candidate_leak"
  | "pii_leak"
  | "project_name_leak"
  | "side_effect_risk"
  | "execution_language"
  | "task_creation_language"
  | "email_creation_language"
  | "persistence_language";

// ─── Quality score band ───────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityScoreBand = "excellent" | "acceptable" | "needs_improvement" | "unacceptable" | "blocked";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect is a literal `false` — see
 * `createDecisionSupportResponseDraftQualityEvaluationConfig()`, which forces every one of them to
 * `false` regardless of what a caller's overrides object claims, mirroring the Sprint 33R response draft
 * harness's own config invariant.
 */
export type DecisionSupportResponseDraftQualityEvaluationConfig = {
  profile: "strict_response_draft_quality_evaluation";
  mode: DecisionSupportResponseDraftQualityEvaluationMode;
  minOverallScore: number;
  minDimensionScore: number;
  minClarificationScore: number;
  minSafetyScore: number;
  allowUserVisibleOutput: false;
  allowProductionWiring: false;
  allowRouterChange: false;
  allowComposerChange: false;
  allowEndpointChange: false;
  allowFeatureFlag: false;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  allowActionExecution: false;
  allowTaskCreation: false;
  allowEmailDraftCreation: false;
  requireHarnessPass: true;
  requireNoCriticalIssues: true;
  requireNoLeakage: true;
  requireNoSideEffects: true;
  requireClarificationFirstQuality: true;
  requireSafeNextStepQuality: true;
  requireNonExecutionClarity: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Dimension score ──────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityDimensionScore = {
  dimension: DecisionSupportResponseDraftQualityDimension;
  score: number;
  status: DecisionSupportResponseDraftQualityStatus;
  riskLevel: DecisionSupportResponseDraftQualityRiskLevel;
  scoreBand: DecisionSupportResponseDraftQualityScoreBand;
  issues: DecisionSupportResponseDraftQualityIssueType[];
  evidence: string[];
  recommendation: string;
};

// ─── Case quality evaluation ──────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityCaseEvaluation = {
  caseId: string;
  draftId: string;
  draftKind: string;
  sourceRouteKind: string;
  sourceResponseKind: string;
  dimensionScores: DecisionSupportResponseDraftQualityDimensionScore[];
  overallScore: number;
  safetyScore: number;
  clarificationScore: number;
  qualityStatus: DecisionSupportResponseDraftQualityStatus;
  riskLevel: DecisionSupportResponseDraftQualityRiskLevel;
  scoreBand: DecisionSupportResponseDraftQualityScoreBand;
  pass: boolean;
  warning: boolean;
  fail: boolean;
  blocked: boolean;
  safeForUserVisibleDryRunHarness: boolean;
  safeForUserVisibleOutputNow: false;
  safeForProduction: false;
  issues: DecisionSupportResponseDraftQualityIssueType[];
  criticalIssueCount: number;
  leakageIssueCount: number;
  sideEffectIssueCount: number;
  userVisibleOutputAttempted: false;
  productionWiringAttempted: false;
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  notes: string[];
};

// ─── Evaluation options / result ──────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityEvaluationOptions = {
  config?: Partial<DecisionSupportResponseDraftQualityEvaluationConfig>;
  /** Sprint 33R response draft harness result to reuse — if omitted, a fresh one is built from `cases`/`now`. */
  harness?: DecisionSupportResponseDraftHarnessResult;
  /** Corpus to run the evaluation over — defaults to the Sprint 33R harness's own small self-contained
   * synthetic corpus when omitted and `harness` is not supplied. Callers who want the full Sprint 18R
   * corpus's documented numbers pass `DECISION_CLARIFICATION_CASES` explicitly. */
  cases?: DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportResponseDraftQualityEvaluationResult = {
  config: DecisionSupportResponseDraftQualityEvaluationConfig;
  /** Sprint 33R response draft harness, reused (not re-derived), against the same corpus. */
  harness: DecisionSupportResponseDraftHarnessResult;
  harnessSummary: DecisionSupportResponseDraftHarnessSummary;
  caseEvaluations: DecisionSupportResponseDraftQualityCaseEvaluation[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityEvaluationSummaryOptions = {
  /** Only used when `evaluationOrCaseEvaluations` is a bare case-evaluations array — for a full
   * evaluation result, the Sprint 33R decision is read from `harnessSummary.decision` directly. */
  sprint33HarnessDecision?: string;
};

export type DecisionSupportResponseDraftQualityEvaluationSummary = {
  totalCases: number;
  evaluatedDraftCount: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  blockedCount: number;
  excellentCount: number;
  acceptableCount: number;
  needsImprovementCount: number;
  unacceptableCount: number;
  blockedBandCount: number;
  averageOverallScore: number;
  averageSafetyScore: number;
  averageClarificationScore: number;
  minOverallScore: number;
  minSafetyScore: number;
  minClarificationScore: number;
  safeForUserVisibleDryRunHarnessCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  criticalIssueCount: number;
  leakageIssueCount: number;
  sideEffectIssueCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  clarityPassCount: number;
  usefulnessPassCount: number;
  pmRelevancePassCount: number;
  clarificationQualityPassCount: number;
  assumptionQualityPassCount: number;
  safeNextStepQualityPassCount: number;
  nonExecutionClarityPassCount: number;
  routePreservationQualityPassCount: number;
  unsupportedBoundaryQualityPassCount: number;
  tonePassCount: number;
  concisenessPassCount: number;
  noOverconfidencePassCount: number;
  noLeakagePassCount: number;
  noSideEffectsPassCount: number;
  decision: DecisionSupportResponseDraftQualityEvaluationDecision;
  recommendedNextSprint: string;
  representativeExcellentCases: DecisionSupportResponseDraftQualityCaseEvaluation[];
  warningCases: DecisionSupportResponseDraftQualityCaseEvaluation[];
  failingCases: DecisionSupportResponseDraftQualityCaseEvaluation[];
  blockedCases: DecisionSupportResponseDraftQualityCaseEvaluation[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftQualityEvaluationExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  evaluationProfile: string;
  evaluationModes: string[];
  dimensionRules: string[];
  scoringRules: string[];
  caseEvaluationRules: string[];
  decisionRule: string;
  allowedNextActions: string[];
  prohibitedNextActions: string[];
  whyUserVisibleOutputIsNotShown: string;
  whyRouterIsNotChanged: string;
  whyComposerIsNotChanged: string;
  whyEndpointIsNotChanged: string;
  whyFeatureFlagIsNotCreated: string;
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whySqlFileIsNotCreated: string;
  whySupabaseStorageIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  whyRepositoryIsNotCreated: string;
  expectedSprint35Path: string;
};

// Re-exported so callers of this module never need to import the Sprint 33R types directly just to
// pass a `DecisionSupportResponseDraftHarnessCaseResult`-shaped value in.
export type { DecisionSupportResponseDraftHarnessCaseResult };
