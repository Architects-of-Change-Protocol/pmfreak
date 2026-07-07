import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import type {
  DecisionSupportShadowControlledReplayCaseAggregate,
  DecisionSupportShadowControlledReplayDecision,
  DecisionSupportShadowControlledReplayEvaluationResult,
  DecisionSupportShadowControlledReplayEvaluationSummary,
  DecisionSupportShadowControlledReplayPassResult,
  DecisionSupportShadowControlledReplayRouteRecommendation,
} from "./decisionSupportShadowControlledReplayTypes";
import type { DecisionSupportShadowPersistenceReadinessEvaluationSummary } from "./decisionSupportShadowCapturePersistenceReadinessTypes";
import type { DecisionSupportShadowStorageFakeAdapterEvaluationSummary } from "./decisionSupportShadowCaptureStorageFakeAdapterTypes";
import type { DecisionSupportShadowStorageAdapterPlanEvaluationSummary } from "./decisionSupportShadowCaptureStorageAdapterPlanTypes";
import type { DecisionSupportShadowStoragePolicyEvaluationSummary } from "./decisionSupportShadowCaptureStoragePolicyTypes";
import type { DecisionSupportShadowCaptureHarnessEvaluationSummary } from "./decisionSupportShadowCaptureHarnessTypes";
import type { ClarificationResponseEvaluationSummary } from "../clarification/clarificationResponseEvaluation";

/**
 * Sprint 31R — Clarification-Gated Decision Support Integration Plan: types.
 *
 * Pure type definitions for an offline, deterministic **integration plan** — not an implementation —
 * that answers how `decision_support` would eventually be integrated behind a clarification gate,
 * without exposing any decision output to a user, without touching the router/composer/endpoint, and
 * without building any real persistence. This module only ever reads already-computed Sprint 18R-30R
 * evaluation results; it creates no database, migration, SQL file, table, Supabase write, real storage
 * adapter, real repository, or feature flag, and it does not touch the router, composer, any production
 * handler, or the gateway.
 *
 * See `docs/conversational-brain-decision-support-clarification-gated-integration-plan.md` for the full
 * scope and non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationPlanProfile = "strict_clarification_gated_integration_plan";

export type DecisionSupportClarificationGatedIntegrationPlanMode =
  | "plan_only"
  | "route_contract_review"
  | "clarification_gate_review"
  | "adapter_handoff_review"
  | "user_visible_dry_run_readiness_review";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationPlanDecision =
  | "ready_for_user_visible_dry_run_plan"
  | "continue_shadow_only"
  | "blocked_by_missing_clarification_gate"
  | "blocked_by_route_contract_gap"
  | "blocked_by_safety_regression"
  | "blocked_by_production_wiring_risk";

// ─── Route kind / stage ───────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationRouteKind =
  | "clarification_gated_decision_support"
  | "existing_route_preserved"
  | "unsupported_preserved"
  | "shadow_only";

export type DecisionSupportClarificationGatedIntegrationStage =
  | "classifier_detection"
  | "route_guard"
  | "clarification_gate"
  | "decision_support_candidate"
  | "safe_response_draft"
  | "user_visible_dry_run"
  | "production_wiring";

// ─── Gate type / status / severity ─────────────────────────────────────────────────────

export type DecisionSupportClarificationGateType =
  | "must_clarify_before_decision"
  | "must_confirm_context"
  | "must_confirm_missing_slots"
  | "must_preserve_existing_route"
  | "must_keep_unsupported"
  | "must_remain_shadow_only"
  | "must_not_show_decision_output";

export type DecisionSupportClarificationGateStatus =
  | "required"
  | "satisfied_by_existing_clarification_strategy"
  | "missing"
  | "blocked";

export type DecisionSupportClarificationGateSeverity = "info" | "warning" | "blocking" | "critical";

// ─── Integration action status ─────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationActionStatus =
  | "allowed_in_plan"
  | "future_only"
  | "prohibited"
  | "blocked";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect (`allowProductionWiring`/
 * `allowRouterChange`/`allowComposerChange`/`allowEndpointChange`/`allowUserVisibleDecisionSupport`/
 * `allowRealPersistence`/`allowDbWrite`/`allowSupabaseWrite`/`allowExternalCalls`) is a literal
 * `false` — see `createDecisionSupportClarificationGatedIntegrationPlanConfig()`, which forces every
 * one of them to `false` regardless of what a caller's overrides object claims, mirroring how the
 * Sprint 30R controlled replay's own config never actually loosens its six `allow*` real-side-effect
 * flags from an override.
 */
export type DecisionSupportClarificationGatedIntegrationPlanConfig = {
  profile: "strict_clarification_gated_integration_plan";
  mode: DecisionSupportClarificationGatedIntegrationPlanMode;
  allowProductionWiring: false;
  allowRouterChange: false;
  allowComposerChange: false;
  allowEndpointChange: false;
  allowUserVisibleDecisionSupport: false;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  requireClarificationGate: true;
  requireExistingRoutePreservation: true;
  requireUnsupportedPreservation: true;
  requireShadowReplayClean: true;
  requireSafeResponseDryRunBeforeVisibility: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Action policy ────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationActionPolicy = {
  actionName: string;
  stage: DecisionSupportClarificationGatedIntegrationStage;
  status: DecisionSupportClarificationGatedIntegrationActionStatus;
  allowedInSprint31: boolean;
  futureOnly: boolean;
  prohibitedInSprint31: boolean;
  requiresClarificationGate: boolean;
  requiresUserVisibleDryRun: boolean;
  requiresProductionReview: boolean;
  reason: string;
};

// ─── Clarification gate requirement ────────────────────────────────────────────────────

export type DecisionSupportClarificationGateRequirement = {
  gateId: string;
  gateType: DecisionSupportClarificationGateType;
  status: DecisionSupportClarificationGateStatus;
  severity: DecisionSupportClarificationGateSeverity;
  appliesToRouteKind: DecisionSupportClarificationGatedIntegrationRouteKind;
  missingSlotsRequired: boolean;
  contextConfirmationRequired: boolean;
  userConfirmationRequired: boolean;
  blocksDirectDecisionOutput: boolean;
  evidence: string[];
  recommendation: string;
};

// ─── Route contract ─────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedRouteContract = {
  routeKind: DecisionSupportClarificationGatedIntegrationRouteKind;
  inputCategory: string;
  preservesExistingRoute: boolean;
  preservesUnsupportedBehavior: boolean;
  requiresClarificationGate: boolean;
  allowsDirectDecisionOutput: false;
  allowsUserVisibleDryRun: boolean;
  allowsProductionWiring: false;
  requiredGateTypes: DecisionSupportClarificationGateType[];
  prohibitedBehaviors: string[];
  expectedNextStage: string;
  rationale: string[];
};

// ─── Case assessment ────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationCaseAssessment = {
  caseId: string;
  sourceCategory: string;
  replayRouteRecommendation: string;
  routeKind: DecisionSupportClarificationGatedIntegrationRouteKind;
  routeContract: DecisionSupportClarificationGatedRouteContract;
  gateRequirements: DecisionSupportClarificationGateRequirement[];
  gateReady: boolean;
  safeForIntegrationPlan: boolean;
  safeForUserVisibleDryRun: boolean;
  safeForProduction: false;
  shouldPreserveExistingRoute: boolean;
  shouldPreserveUnsupported: boolean;
  shouldRemainShadowOnly: boolean;
  shouldUseClarificationGate: boolean;
  directDecisionOutputBlocked: true;
  warnings: string[];
};

// ─── Source case (Sprint 30R aggregate / pass result) ──────────────────────────────────

/**
 * The minimal shape this module needs from a Sprint 30R controlled replay result — satisfied
 * structurally by both `DecisionSupportShadowControlledReplayCaseAggregate` and
 * `DecisionSupportShadowControlledReplayPassResult`, so `classifyDecisionSupportClarificationGatedRouteKind()`
 * and `assessDecisionSupportClarificationGatedIntegrationCase()` accept either.
 */
export type DecisionSupportClarificationGatedIntegrationSourceCase = {
  caseId: string;
  category?: string;
  routeRecommendation: DecisionSupportShadowControlledReplayRouteRecommendation;
};

// ─── Plan result ──────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationPlanOptions = {
  config?: Partial<DecisionSupportClarificationGatedIntegrationPlanConfig>;
  /** Corpus to replay/review — defaults to a small self-contained synthetic corpus when omitted, never
   * imported from `tests/fixtures/`. Callers who want the full Sprint 18R corpus's documented numbers
   * pass `DECISION_CLARIFICATION_CASES` explicitly, exactly as Sprint 29R/30R's own test suites do. */
  cases?: DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportClarificationGatedIntegrationPlanResult = {
  config: DecisionSupportClarificationGatedIntegrationPlanConfig;
  /** Sprint 30R controlled shadow replay evaluation, reused (not re-derived), against the same corpus. */
  replayEvaluation: DecisionSupportShadowControlledReplayEvaluationResult;
  replaySummary: DecisionSupportShadowControlledReplayEvaluationSummary;
  /** Sprint 29R persistence readiness review summary, reused (not re-derived), against the same corpus. */
  persistenceReadinessSummary: DecisionSupportShadowPersistenceReadinessEvaluationSummary;
  /** Sprint 28R fake adapter evaluation summary, reused (not re-derived), against the same corpus. */
  fakeAdapterEvaluationSummary: DecisionSupportShadowStorageFakeAdapterEvaluationSummary;
  /** Sprint 27R storage adapter plan evaluation summary, reused (not re-derived), against the same corpus. */
  storageAdapterPlanEvaluationSummary: DecisionSupportShadowStorageAdapterPlanEvaluationSummary;
  /** Sprint 26R storage policy evaluation summary, reused (not re-derived), against the same corpus. */
  storagePolicyEvaluationSummary: DecisionSupportShadowStoragePolicyEvaluationSummary;
  /** Sprint 25R capture harness evaluation summary, reused (not re-derived), against the same corpus. */
  captureHarnessEvaluationSummary: DecisionSupportShadowCaptureHarnessEvaluationSummary;
  /** Sprint 22R clarification response evaluation summary, reused (not re-derived), against the same corpus —
   * evidence that the clarification gate is backed by an existing, already-tested strategy. */
  clarificationResponseEvaluationSummary: ClarificationResponseEvaluationSummary;
  assessments: DecisionSupportClarificationGatedIntegrationCaseAssessment[];
  actionPolicies: DecisionSupportClarificationGatedIntegrationActionPolicy[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationPlanSummaryOptions = {
  /** Only used when `planOrAssessments` is a bare assessments array — for a full plan result, the
   * Sprint 30R decision is read from `replaySummary.decision` directly. */
  sprint30ReplayDecision?: DecisionSupportShadowControlledReplayDecision;
};

export type DecisionSupportClarificationGatedIntegrationPlanSummary = {
  totalCases: number;
  clarificationGatedCaseCount: number;
  existingRoutePreservedCaseCount: number;
  unsupportedPreservedCaseCount: number;
  shadowOnlyCaseCount: number;
  gateReadyCaseCount: number;
  gateMissingCaseCount: number;
  safeForIntegrationPlanCount: number;
  safeForUserVisibleDryRunCount: number;
  safeForProductionCount: number;
  directDecisionOutputBlockedCount: number;
  productionWiringAttemptedCount: number;
  routerChangeAttemptedCount: number;
  composerChangeAttemptedCount: number;
  endpointChangeAttemptedCount: number;
  userVisibleDecisionSupportAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  decision: DecisionSupportClarificationGatedIntegrationPlanDecision;
  recommendedNextSprint: string;
  representativeClarificationGatedCases: DecisionSupportClarificationGatedIntegrationCaseAssessment[];
  preservedExistingRouteCases: DecisionSupportClarificationGatedIntegrationCaseAssessment[];
  preservedUnsupportedCases: DecisionSupportClarificationGatedIntegrationCaseAssessment[];
  blockedCases: DecisionSupportClarificationGatedIntegrationCaseAssessment[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationPlanExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  planProfile: string;
  planModes: string[];
  actionPolicyRules: string[];
  routeKindClassification: string[];
  routeContractRules: string[];
  gateRequirementRules: string[];
  caseAssessmentRules: string[];
  decisionRule: string;
  allowedNextActions: string[];
  prohibitedNextActions: string[];
  whyRouterIsNotChanged: string;
  whyComposerIsNotChanged: string;
  whyEndpointIsNotChanged: string;
  whyUserVisibleOutputIsNotShown: string;
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whySqlFileIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  whyRepositoryIsNotCreated: string;
  expectedSprint32Path: string;
};

// Re-exported so callers of this module never need to import the aggregate/pass-result types
// directly just to build a `DecisionSupportClarificationGatedIntegrationSourceCase`-compatible value.
export type {
  DecisionSupportShadowControlledReplayCaseAggregate,
  DecisionSupportShadowControlledReplayPassResult,
};
