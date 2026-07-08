import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import type {
  DecisionSupportClarificationGatedIntegrationCaseAssessment,
  DecisionSupportClarificationGatedIntegrationPlanResult,
  DecisionSupportClarificationGatedIntegrationPlanSummary,
  DecisionSupportClarificationGatedIntegrationRouteKind,
} from "./decisionSupportClarificationGatedIntegrationPlanTypes";

/**
 * Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan: types.
 *
 * Pure type definitions for an offline, deterministic **response QA plan** — not an implementation, and
 * not a user-visible dry run itself — that answers what a safe `decision_support` response would look
 * like *if* it were eventually shown to a user, what response format is acceptable vs risky, what
 * content must be blocked, and what QA gates a response must pass before it could ever become visible.
 * This module only ever reads already-computed Sprint 18R-31R evaluation results and builds
 * QA-only synthetic response drafts; it never shows anything to a real user, never persists anything
 * real, and never touches the router, composer, endpoint, or any production handler.
 *
 * See `docs/conversational-brain-decision-support-response-qa-dry-run-plan.md` for the full scope and
 * non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunPlanProfile = "strict_response_qa_user_visible_dry_run_plan";

export type DecisionSupportResponseQaDryRunPlanMode =
  | "plan_only"
  | "response_contract_review"
  | "synthetic_response_qa"
  | "clarification_gated_response_review"
  | "user_visible_dry_run_readiness_review";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunPlanDecision =
  | "ready_for_response_draft_harness"
  | "continue_plan_only"
  | "blocked_by_response_contract_gap"
  | "blocked_by_unsafe_response_pattern"
  | "blocked_by_missing_clarification_gate"
  | "blocked_by_production_wiring_risk";

// ─── Response kind ────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunResponseKind =
  | "clarification_question"
  | "decision_support_advisory"
  | "route_preservation_notice"
  | "unsupported_boundary_notice"
  | "shadow_only_internal"
  | "unsafe_response_blocked";

// ─── QA status / risk level ───────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunQaStatus = "pass" | "warning" | "fail" | "blocked";

export type DecisionSupportResponseQaDryRunRiskLevel = "low" | "medium" | "high" | "critical";

// ─── Violation type ───────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunViolationType =
  | "direct_decision_without_clarification"
  | "unsupported_action_execution"
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
  | "overconfident_recommendation"
  | "missing_assumptions"
  | "missing_clarifying_question"
  | "missing_non_execution_disclaimer"
  | "missing_next_safe_step"
  | "unsafe_instruction";

// ─── Gate type ────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunGateType =
  | "must_be_clarification_first"
  | "must_state_assumptions"
  | "must_avoid_direct_execution"
  | "must_not_create_tasks"
  | "must_not_create_emails"
  | "must_not_persist"
  | "must_not_call_external_services"
  | "must_not_leak_raw_input"
  | "must_not_leak_full_candidate"
  | "must_not_leak_pii"
  | "must_preserve_existing_route"
  | "must_preserve_unsupported"
  | "must_remain_shadow_only"
  | "must_be_safe_for_dry_run_only";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect is a literal `false` — see
 * `createDecisionSupportResponseQaDryRunPlanConfig()`, which forces every one of them to `false`
 * regardless of what a caller's overrides object claims, mirroring the Sprint 31R integration plan's
 * own config invariant.
 */
export type DecisionSupportResponseQaDryRunPlanConfig = {
  profile: "strict_response_qa_user_visible_dry_run_plan";
  mode: DecisionSupportResponseQaDryRunPlanMode;
  allowUserVisibleDryRun: false;
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
  requireClarificationGate: true;
  requireResponseContract: true;
  requireAssumptionDisclosure: true;
  requireNonExecutionGuarantee: true;
  requireNoRawInputLeak: true;
  requireNoFullCandidateLeak: true;
  requireNoPiiLeak: true;
  requireSafeNextStep: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Response contract ────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunResponseContract = {
  responseKind: DecisionSupportResponseQaDryRunResponseKind;
  allowedInSprint32: boolean;
  futureOnly: boolean;
  prohibitedInSprint32: boolean;
  requiresClarificationGate: boolean;
  requiresAssumptionDisclosure: boolean;
  requiresNonExecutionGuarantee: boolean;
  requiresSafeNextStep: boolean;
  allowsDirectDecision: false;
  allowsActionExecution: false;
  allowsTaskCreation: false;
  allowsEmailDraftCreation: false;
  allowsRealPersistence: false;
  allowsExternalCalls: false;
  allowsProductionWiring: false;
  requiredGates: DecisionSupportResponseQaDryRunGateType[];
  prohibitedPatterns: DecisionSupportResponseQaDryRunViolationType[];
  expectedStructure: string[];
  rationale: string[];
};

// ─── Synthetic response draft ────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunResponseSections = {
  clarificationQuestion?: string;
  assumptions?: string[];
  advisoryFrame?: string;
  safeOptions?: string[];
  recommendedNextStep?: string;
  nonExecutionNotice?: string;
  routePreservationNotice?: string;
  unsupportedNotice?: string;
};

export type DecisionSupportResponseQaDryRunSyntheticResponseDraft = {
  draftId: string;
  sourceCaseId: string;
  responseKind: DecisionSupportResponseQaDryRunResponseKind;
  routeKind: string;
  generatedForQaOnly: true;
  userVisibleNow: false;
  persistedNow: false;
  responseSections: DecisionSupportResponseQaDryRunResponseSections;
  prohibitedContentPresent: boolean;
  notes: string[];
};

// ─── Gate result ──────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunGateResult = {
  gateType: DecisionSupportResponseQaDryRunGateType;
  status: DecisionSupportResponseQaDryRunQaStatus;
  riskLevel: DecisionSupportResponseQaDryRunRiskLevel;
  passed: boolean;
  violations: DecisionSupportResponseQaDryRunViolationType[];
  evidence: string[];
  recommendation: string;
};

// ─── Case assessment ──────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunCaseAssessment = {
  caseId: string;
  routeKind: string;
  responseKind: DecisionSupportResponseQaDryRunResponseKind;
  responseContract: DecisionSupportResponseQaDryRunResponseContract;
  syntheticDraft: DecisionSupportResponseQaDryRunSyntheticResponseDraft;
  gateResults: DecisionSupportResponseQaDryRunGateResult[];
  qaStatus: DecisionSupportResponseQaDryRunQaStatus;
  riskLevel: DecisionSupportResponseQaDryRunRiskLevel;
  safeForResponseDraftHarness: boolean;
  safeForUserVisibleDryRunNow: false;
  safeForProduction: false;
  directDecisionBlocked: true;
  actionExecutionBlocked: true;
  taskCreationBlocked: true;
  emailDraftCreationBlocked: true;
  persistenceBlocked: true;
  externalCallsBlocked: true;
  userVisibleOutputAttempted: false;
  productionWiringAttempted: false;
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  warnings: string[];
};

// ─── Plan options / result ────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunPlanOptions = {
  config?: Partial<DecisionSupportResponseQaDryRunPlanConfig>;
  /** Corpus to plan over — defaults to the Sprint 31R integration plan's own small self-contained
   * synthetic corpus when omitted. Callers who want the full Sprint 18R corpus's documented numbers
   * pass `DECISION_CLARIFICATION_CASES` explicitly. */
  cases?: DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportResponseQaDryRunPlanResult = {
  config: DecisionSupportResponseQaDryRunPlanConfig;
  /** Sprint 31R clarification-gated integration plan, reused (not re-derived), against the same corpus. */
  integrationPlan: DecisionSupportClarificationGatedIntegrationPlanResult;
  integrationSummary: DecisionSupportClarificationGatedIntegrationPlanSummary;
  assessments: DecisionSupportResponseQaDryRunCaseAssessment[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunPlanSummaryOptions = {
  /** Only used when `planOrAssessments` is a bare assessments array — for a full plan result, the
   * Sprint 31R decision is read from `integrationSummary.decision` directly. */
  sprint31IntegrationDecision?: string;
};

export type DecisionSupportResponseQaDryRunPlanSummary = {
  totalCases: number;
  clarificationQuestionCaseCount: number;
  advisoryCaseCount: number;
  routePreservationCaseCount: number;
  unsupportedBoundaryCaseCount: number;
  shadowOnlyCaseCount: number;
  unsafeBlockedCaseCount: number;
  qaPassCaseCount: number;
  qaWarningCaseCount: number;
  qaFailCaseCount: number;
  qaBlockedCaseCount: number;
  safeForResponseDraftHarnessCount: number;
  safeForUserVisibleDryRunNowCount: number;
  safeForProductionCount: number;
  directDecisionBlockedCount: number;
  actionExecutionBlockedCount: number;
  taskCreationBlockedCount: number;
  emailDraftCreationBlockedCount: number;
  persistenceBlockedCount: number;
  externalCallsBlockedCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  rawInputLeakCount: number;
  fullCandidateLeakCount: number;
  piiLeakCount: number;
  projectNameLeakCount: number;
  violationCount: number;
  criticalViolationCount: number;
  decision: DecisionSupportResponseQaDryRunPlanDecision;
  recommendedNextSprint: string;
  representativePassingCases: DecisionSupportResponseQaDryRunCaseAssessment[];
  warningCases: DecisionSupportResponseQaDryRunCaseAssessment[];
  blockedCases: DecisionSupportResponseQaDryRunCaseAssessment[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportResponseQaDryRunPlanExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  planProfile: string;
  planModes: string[];
  responseKindRules: string[];
  responseContractRules: string[];
  syntheticDraftRules: string[];
  gateEvaluationRules: string[];
  caseAssessmentRules: string[];
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
  expectedSprint33Path: string;
};

// Re-exported so callers of this module never need to import the Sprint 31R types directly just to
// pass a `DecisionSupportClarificationGatedIntegrationCaseAssessment`-shaped value in.
export type { DecisionSupportClarificationGatedIntegrationCaseAssessment, DecisionSupportClarificationGatedIntegrationRouteKind };
