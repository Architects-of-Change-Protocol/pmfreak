import type {
  DecisionSupportResponseDraftQualityCaseEvaluation,
  DecisionSupportResponseDraftQualityEvaluationResult,
  DecisionSupportResponseDraftQualityEvaluationSummary,
} from "./decisionSupportResponseDraftQualityEvaluationTypes";

/**
 * Sprint 35R — Decision Support User-Visible Dry Run Evaluation Harness: types.
 *
 * Pure type definitions for an offline, deterministic **user-visible dry run evaluation harness** — not
 * a user-visible output, and not production wiring — that renders a synthetic, internal-only preview of
 * how every Sprint 34R-evaluated draft *would eventually look* if a future composer ever showed it to a
 * user, validates each preview against a display contract keyed by preview kind, and consolidates a
 * decision on whether the corpus is ready for a Sprint 36R default-off route/composer integration
 * adapter. This module only ever reads already-computed Sprint 18R-34R evaluation results and renders
 * synthetic preview content from fixed templates; it never shows anything to a real user, never persists
 * anything real, and never touches the router, composer, endpoint, or any production handler.
 *
 * See `docs/conversational-brain-decision-support-user-visible-dry-run-evaluation-harness.md` for the
 * full scope and non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunEvaluationHarnessProfile = "strict_user_visible_dry_run_evaluation_harness";

export type DecisionSupportUserVisibleDryRunEvaluationHarnessMode =
  | "dry_run_harness_only"
  | "internal_preview_rendering"
  | "display_contract_evaluation"
  | "composer_readiness_review"
  | "route_preserving_preview_review";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunEvaluationHarnessDecision =
  | "ready_for_default_off_route_composer_integration_adapter"
  | "continue_dry_run_harness_only"
  | "blocked_by_preview_contract_gap"
  | "blocked_by_visibility_risk"
  | "blocked_by_low_preview_quality"
  | "blocked_by_leakage_or_side_effect_risk";

// ─── Preview kind ─────────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunPreviewKind =
  | "clarification_first_preview"
  | "route_preservation_preview"
  | "unsupported_boundary_preview"
  | "shadow_only_internal_preview"
  | "blocked_unsafe_preview";

// ─── Preview status ───────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunPreviewStatus = "rendered" | "validated" | "rejected" | "blocked";

// ─── Preview QA status ────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunPreviewQaStatus = "pass" | "warning" | "fail" | "blocked";

// ─── Preview risk level ───────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunPreviewRiskLevel = "low" | "medium" | "high" | "critical";

// ─── Preview display section kind ────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunDisplaySectionKind =
  | "acknowledgement"
  | "clarifying_question"
  | "assumptions"
  | "safe_options"
  | "recommended_next_step"
  | "non_execution_notice"
  | "route_preservation_notice"
  | "unsupported_boundary_notice"
  | "shadow_only_notice"
  | "blocked_notice"
  | "internal_dry_run_notice";

// ─── Preview violation type ───────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunViolationType =
  | "user_visible_output_attempted"
  | "missing_internal_dry_run_notice"
  | "missing_clarifying_question"
  | "missing_assumptions"
  | "missing_safe_next_step"
  | "missing_non_execution_notice"
  | "direct_decision_without_clarification"
  | "overconfident_language"
  | "unsafe_display_format"
  | "route_not_preserved"
  | "unsupported_not_preserved"
  | "raw_input_leak"
  | "full_candidate_leak"
  | "pii_leak"
  | "project_name_leak"
  | "action_execution"
  | "task_creation"
  | "email_or_draft_creation"
  | "real_persistence"
  | "db_write"
  | "supabase_write"
  | "external_call"
  | "router_wiring"
  | "composer_wiring"
  | "endpoint_wiring"
  | "feature_flag_activation";

// ─── Display contract status ──────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunDisplayContractStatus = "compatible" | "compatible_with_warning" | "incompatible" | "blocked";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect is a literal `false` — see
 * `createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig()`, which forces every one of them to
 * `false` regardless of what a caller's overrides object claims, mirroring every prior sprint's config
 * invariant in this package.
 */
export type DecisionSupportUserVisibleDryRunEvaluationHarnessConfig = {
  profile: "strict_user_visible_dry_run_evaluation_harness";
  mode: DecisionSupportUserVisibleDryRunEvaluationHarnessMode;
  minPreviewQualityScore: number;
  minDisplayContractScore: number;
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
  requireQualityEvaluationPass: true;
  requireInternalDryRunNotice: true;
  requireDisplayContractCompatibility: true;
  requireNoVisibilityAttempt: true;
  requireNoLeakage: true;
  requireNoSideEffects: true;
  requireNoProductionEligibility: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Display section ──────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunDisplaySection = {
  sectionId: string;
  kind: DecisionSupportUserVisibleDryRunDisplaySectionKind;
  title: string;
  body: string;
  order: number;
  required: boolean;
  internalOnly: boolean;
  userVisibleNow: false;
  containsRawInput: false;
  containsFullCandidate: false;
  containsPii: false;
  containsProjectNameRaw: false;
  containsExecutableInstruction: false;
  containsPersistenceInstruction: false;
  warnings: string[];
};

// ─── Display contract ─────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunDisplayContract = {
  contractId: string;
  previewKind: DecisionSupportUserVisibleDryRunPreviewKind;
  requiredSections: DecisionSupportUserVisibleDryRunDisplaySectionKind[];
  prohibitedSections: DecisionSupportUserVisibleDryRunDisplaySectionKind[];
  requiresInternalDryRunNotice: true;
  requiresClarificationFirst: boolean;
  requiresRoutePreservation: boolean;
  requiresUnsupportedPreservation: boolean;
  blocksDirectDecision: true;
  blocksExecution: true;
  blocksPersistence: true;
  blocksExternalCalls: true;
  blocksProductionEligibility: true;
  displayContractStatus: DecisionSupportUserVisibleDryRunDisplayContractStatus;
  displayContractScore: number;
  rationale: string[];
};

// ─── Preview ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunPreview = {
  previewId: string;
  sourceCaseId: string;
  sourceDraftId: string;
  previewKind: DecisionSupportUserVisibleDryRunPreviewKind;
  sourceDraftKind: string;
  sourceRouteKind: string;
  generatedForDryRunOnly: true;
  internalPreviewOnly: true;
  userVisibleNow: false;
  persistedNow: false;
  executableNow: false;
  externalSideEffectsAllowed: false;
  productionEligibleNow: false;
  status: DecisionSupportUserVisibleDryRunPreviewStatus;
  displaySections: DecisionSupportUserVisibleDryRunDisplaySection[];
  displayContract: DecisionSupportUserVisibleDryRunDisplayContract;
  previewQualityScore: number;
  displayContractScore: number;
  warnings: string[];
};

// ─── Preview validation result ───────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunPreviewValidationResult = {
  previewId: string;
  valid: boolean;
  qaStatus: DecisionSupportUserVisibleDryRunPreviewQaStatus;
  riskLevel: DecisionSupportUserVisibleDryRunPreviewRiskLevel;
  violations: DecisionSupportUserVisibleDryRunViolationType[];
  internalDryRunNoticePassed: boolean;
  displayContractPassed: boolean;
  clarificationFirstPassed: boolean;
  routePreservationPassed: boolean;
  unsupportedPreservationPassed: boolean;
  nonExecutionNoticePassed: boolean;
  noVisibilityAttemptPassed: boolean;
  noProductionEligibilityPassed: boolean;
  noLeaksPassed: boolean;
  noSideEffectsPassed: boolean;
  userVisibleOutputAttempted: false;
  productionWiringAttempted: false;
  routerChangeAttempted: false;
  composerChangeAttempted: false;
  endpointChangeAttempted: false;
  featureFlagAttempted: false;
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  recommendation: string;
};

// ─── Harness case result ─────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunEvaluationCaseResult = {
  caseId: string;
  sourceDraftId: string;
  sourceDraftKind: string;
  sourceRouteKind: string;
  preview: DecisionSupportUserVisibleDryRunPreview;
  validation: DecisionSupportUserVisibleDryRunPreviewValidationResult;
  previewRendered: boolean;
  previewAccepted: boolean;
  previewRejected: boolean;
  previewBlocked: boolean;
  safeForDefaultOffRouteComposerAdapter: boolean;
  safeForUserVisibleOutputNow: false;
  safeForProduction: false;
  warnings: string[];
};

// ─── Harness options / result ────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunEvaluationHarnessOptions = {
  config?: Partial<DecisionSupportUserVisibleDryRunEvaluationHarnessConfig>;
  /** Sprint 34R response draft quality evaluation to reuse — if omitted, a fresh one is built from
   * `cases`/`now`. */
  evaluation?: DecisionSupportResponseDraftQualityEvaluationResult;
  /** Corpus to run the harness over — defaults to the Sprint 34R evaluation's own small self-contained
   * synthetic corpus when omitted and `evaluation` is not supplied. Callers who want the full Sprint 18R
   * corpus's documented numbers pass `DECISION_CLARIFICATION_CASES` explicitly. */
  cases?: import("../classifier/decisionClarificationArchitectureReview").DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportUserVisibleDryRunEvaluationHarnessResult = {
  config: DecisionSupportUserVisibleDryRunEvaluationHarnessConfig;
  /** Sprint 34R response draft quality evaluation, reused (not re-derived), against the same corpus. */
  evaluation: DecisionSupportResponseDraftQualityEvaluationResult;
  evaluationSummary: DecisionSupportResponseDraftQualityEvaluationSummary;
  caseResults: DecisionSupportUserVisibleDryRunEvaluationCaseResult[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunEvaluationHarnessSummaryOptions = {
  /** Only used when `harnessOrCaseResults` is a bare case-results array — for a full harness result, the
   * Sprint 34R decision is read from `evaluationSummary.decision` directly. */
  sprint34EvaluationDecision?: string;
};

export type DecisionSupportUserVisibleDryRunEvaluationHarnessSummary = {
  totalCases: number;
  previewRenderedCount: number;
  previewAcceptedCount: number;
  previewRejectedCount: number;
  previewBlockedCount: number;
  clarificationFirstPreviewCount: number;
  routePreservationPreviewCount: number;
  unsupportedBoundaryPreviewCount: number;
  shadowOnlyInternalPreviewCount: number;
  blockedUnsafePreviewCount: number;
  qaPassCount: number;
  qaWarningCount: number;
  qaFailCount: number;
  qaBlockedCount: number;
  safeForDefaultOffRouteComposerAdapterCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  averagePreviewQualityScore: number;
  averageDisplayContractScore: number;
  minPreviewQualityScore: number;
  minDisplayContractScore: number;
  internalDryRunNoticePassedCount: number;
  displayContractPassedCount: number;
  clarificationFirstPassedCount: number;
  routePreservationPassedCount: number;
  unsupportedPreservationPassedCount: number;
  nonExecutionNoticePassedCount: number;
  noVisibilityAttemptPassedCount: number;
  noProductionEligibilityPassedCount: number;
  noLeaksPassedCount: number;
  noSideEffectsPassedCount: number;
  violationCount: number;
  criticalViolationCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  routerChangeAttemptedCount: number;
  composerChangeAttemptedCount: number;
  endpointChangeAttemptedCount: number;
  featureFlagAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  decision: DecisionSupportUserVisibleDryRunEvaluationHarnessDecision;
  recommendedNextSprint: string;
  representativeAcceptedPreviews: DecisionSupportUserVisibleDryRunEvaluationCaseResult[];
  rejectedPreviews: DecisionSupportUserVisibleDryRunEvaluationCaseResult[];
  blockedPreviews: DecisionSupportUserVisibleDryRunEvaluationCaseResult[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportUserVisibleDryRunEvaluationHarnessExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  harnessProfile: string;
  harnessModes: string[];
  previewKindRules: string[];
  displayContractRules: string[];
  previewRenderingRules: string[];
  previewValidationRules: string[];
  harnessRunRules: string[];
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
  expectedSprint36Path: string;
};

// Re-exported so callers of this module never need to import the Sprint 34R types directly just to pass
// a `DecisionSupportResponseDraftQualityCaseEvaluation`-shaped value in.
export type { DecisionSupportResponseDraftQualityCaseEvaluation };
