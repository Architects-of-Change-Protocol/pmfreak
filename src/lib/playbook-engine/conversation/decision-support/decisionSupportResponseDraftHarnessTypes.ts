import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import type {
  DecisionSupportResponseQaDryRunCaseAssessment,
  DecisionSupportResponseQaDryRunPlanResult,
  DecisionSupportResponseQaDryRunPlanSummary,
} from "./decisionSupportResponseQaDryRunPlanTypes";

/**
 * Sprint 33R — Decision Support Response Draft Harness: types.
 *
 * Pure type definitions for an offline, deterministic **response draft harness** — not a user-visible
 * dry run, and not production wiring — that generates, validates, and evaluates synthetic drafts of a
 * `decision_support` response for every case the Sprint 32R response QA plan already assessed as safe
 * for this harness. This module only ever reads already-computed Sprint 18R-32R evaluation results and
 * builds QA-only synthetic drafts; it never shows anything to a real user, never persists anything
 * real, and never touches the router, composer, endpoint, or any production handler.
 *
 * See `docs/conversational-brain-decision-support-response-draft-harness.md` for the full scope and
 * non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessProfile = "strict_response_draft_harness";

export type DecisionSupportResponseDraftHarnessMode =
  | "harness_only"
  | "synthetic_draft_generation"
  | "contract_backed_draft_generation"
  | "qa_backed_draft_generation"
  | "dry_run_readiness_harness";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessDecision =
  | "ready_for_response_draft_quality_evaluation"
  | "continue_harness_only"
  | "blocked_by_contract_gap"
  | "blocked_by_unsafe_draft"
  | "blocked_by_leakage"
  | "blocked_by_side_effect_risk";

// ─── Draft kind ───────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessDraftKind =
  | "clarification_first_draft"
  | "route_preservation_draft"
  | "unsupported_boundary_draft"
  | "shadow_only_internal_draft"
  | "blocked_unsafe_draft";

// ─── Draft status ─────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessDraftStatus = "generated" | "validated" | "rejected" | "blocked";

// ─── Draft QA status ──────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessQaStatus = "pass" | "warning" | "fail" | "blocked";

// ─── Draft risk level ─────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessRiskLevel = "low" | "medium" | "high" | "critical";

// ─── Draft violation type ─────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessViolationType =
  | "direct_decision_without_clarification"
  | "missing_clarifying_question"
  | "missing_assumptions"
  | "missing_safe_next_step"
  | "missing_non_execution_notice"
  | "unsafe_recommendation"
  | "overconfident_recommendation"
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
  | "feature_flag_activation"
  | "raw_input_leak"
  | "full_candidate_leak"
  | "pii_leak"
  | "project_name_leak"
  | "user_visible_output"
  | "production_wiring";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect is a literal `false` — see
 * `createDecisionSupportResponseDraftHarnessConfig()`, which forces every one of them to `false`
 * regardless of what a caller's overrides object claims, mirroring the Sprint 32R response QA plan's
 * own config invariant.
 */
export type DecisionSupportResponseDraftHarnessConfig = {
  profile: "strict_response_draft_harness";
  mode: DecisionSupportResponseDraftHarnessMode;
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
  requireQaPlanPass: true;
  requireContractMatch: true;
  requireClarificationFirstForDecisionSupport: true;
  requireRoutePreservationForExistingRoutes: true;
  requireUnsupportedPreservation: true;
  requireNonExecutionNotice: true;
  requireSafeNextStep: true;
  requireNoLeaks: true;
  requireNoSideEffects: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Response draft ───────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessDraftSections = {
  acknowledgement?: string;
  clarificationQuestion?: string;
  assumptions?: string[];
  advisoryFrame?: string;
  safeOptions?: string[];
  recommendedNextStep?: string;
  nonExecutionNotice?: string;
  routePreservationNotice?: string;
  unsupportedBoundaryNotice?: string;
  shadowOnlyNotice?: string;
  blockedNotice?: string;
};

export type DecisionSupportResponseDraftHarnessDraftContract = {
  requiresClarificationFirst: boolean;
  requiresRoutePreservation: boolean;
  requiresUnsupportedPreservation: boolean;
  blocksDirectDecision: true;
  blocksExecution: true;
  blocksPersistence: true;
  blocksExternalCalls: true;
};

export type DecisionSupportResponseDraftHarnessDraftSafety = {
  rawInputIncluded: false;
  fullCandidateIncluded: false;
  piiIncluded: false;
  projectNameIncluded: false;
  taskPayloadIncluded: false;
  emailDraftPayloadIncluded: false;
  dbPayloadIncluded: false;
  supabasePayloadIncluded: false;
  externalCallPayloadIncluded: false;
};

export type DecisionSupportResponseDraftHarnessDraft = {
  draftId: string;
  sourceCaseId: string;
  draftKind: DecisionSupportResponseDraftHarnessDraftKind;
  sourceResponseKind: string;
  sourceRouteKind: string;
  generatedForHarnessOnly: true;
  userVisibleNow: false;
  persistedNow: false;
  executableNow: false;
  externalSideEffectsAllowed: false;
  status: DecisionSupportResponseDraftHarnessDraftStatus;
  sections: DecisionSupportResponseDraftHarnessDraftSections;
  contract: DecisionSupportResponseDraftHarnessDraftContract;
  safety: DecisionSupportResponseDraftHarnessDraftSafety;
  warnings: string[];
};

// ─── Draft validation result ──────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessValidationResult = {
  draftId: string;
  valid: boolean;
  qaStatus: DecisionSupportResponseDraftHarnessQaStatus;
  riskLevel: DecisionSupportResponseDraftHarnessRiskLevel;
  violations: DecisionSupportResponseDraftHarnessViolationType[];
  contractMatched: boolean;
  clarificationFirstPassed: boolean;
  routePreservationPassed: boolean;
  unsupportedPreservationPassed: boolean;
  nonExecutionNoticePassed: boolean;
  safeNextStepPassed: boolean;
  noLeaksPassed: boolean;
  noSideEffectsPassed: boolean;
  userVisibleOutputAttempted: false;
  productionWiringAttempted: false;
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  recommendation: string;
};

// ─── Harness case result ───────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessCaseResult = {
  caseId: string;
  sourceRouteKind: string;
  sourceResponseKind: string;
  draft: DecisionSupportResponseDraftHarnessDraft;
  validation: DecisionSupportResponseDraftHarnessValidationResult;
  draftGenerated: boolean;
  draftAccepted: boolean;
  draftRejected: boolean;
  draftBlocked: boolean;
  safeForQualityEvaluation: boolean;
  safeForUserVisibleOutputNow: false;
  safeForProduction: false;
  warnings: string[];
};

// ─── Harness options / result ──────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessOptions = {
  config?: Partial<DecisionSupportResponseDraftHarnessConfig>;
  /** Sprint 32R response QA plan to reuse — if omitted, a fresh one is built from `cases`/`now`. */
  qaPlan?: DecisionSupportResponseQaDryRunPlanResult;
  /** Corpus to run the harness over — defaults to the Sprint 31R integration plan's own small
   * self-contained synthetic corpus when omitted and `qaPlan` is not supplied. Callers who want the
   * full Sprint 18R corpus's documented numbers pass `DECISION_CLARIFICATION_CASES` explicitly. */
  cases?: DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportResponseDraftHarnessResult = {
  config: DecisionSupportResponseDraftHarnessConfig;
  /** Sprint 32R response QA / user-visible dry run plan, reused (not re-derived), against the same corpus. */
  qaPlan: DecisionSupportResponseQaDryRunPlanResult;
  qaSummary: DecisionSupportResponseQaDryRunPlanSummary;
  caseResults: DecisionSupportResponseDraftHarnessCaseResult[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessSummaryOptions = {
  /** Only used when `harnessOrCaseResults` is a bare case-results array — for a full harness result,
   * the Sprint 32R decision is read from `qaSummary.decision` directly. */
  sprint32QaDecision?: string;
};

export type DecisionSupportResponseDraftHarnessSummary = {
  totalCases: number;
  draftGeneratedCount: number;
  draftAcceptedCount: number;
  draftRejectedCount: number;
  draftBlockedCount: number;
  clarificationFirstDraftCount: number;
  routePreservationDraftCount: number;
  unsupportedBoundaryDraftCount: number;
  shadowOnlyInternalDraftCount: number;
  blockedUnsafeDraftCount: number;
  qaPassCount: number;
  qaWarningCount: number;
  qaFailCount: number;
  qaBlockedCount: number;
  safeForQualityEvaluationCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  contractMatchedCount: number;
  clarificationFirstPassedCount: number;
  routePreservationPassedCount: number;
  unsupportedPreservationPassedCount: number;
  nonExecutionNoticePassedCount: number;
  safeNextStepPassedCount: number;
  noLeaksPassedCount: number;
  noSideEffectsPassedCount: number;
  violationCount: number;
  criticalViolationCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  rawInputIncludedCount: number;
  fullCandidateIncludedCount: number;
  piiIncludedCount: number;
  projectNameIncludedCount: number;
  taskPayloadIncludedCount: number;
  emailDraftPayloadIncludedCount: number;
  dbPayloadIncludedCount: number;
  supabasePayloadIncludedCount: number;
  externalCallPayloadIncludedCount: number;
  decision: DecisionSupportResponseDraftHarnessDecision;
  recommendedNextSprint: string;
  representativeAcceptedDrafts: DecisionSupportResponseDraftHarnessCaseResult[];
  rejectedDrafts: DecisionSupportResponseDraftHarnessCaseResult[];
  blockedDrafts: DecisionSupportResponseDraftHarnessCaseResult[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseDraftHarnessExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  harnessProfile: string;
  harnessModes: string[];
  draftKindRules: string[];
  draftCreationRules: string[];
  draftValidationRules: string[];
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
  expectedSprint34Path: string;
};

// Re-exported so callers of this module never need to import the Sprint 32R types directly just to
// pass a `DecisionSupportResponseQaDryRunCaseAssessment`-shaped value in.
export type { DecisionSupportResponseQaDryRunCaseAssessment };
