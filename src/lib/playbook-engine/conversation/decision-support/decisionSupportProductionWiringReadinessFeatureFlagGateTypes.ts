import type { DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult } from "./decisionSupportDefaultOffRouteComposerIntegrationAdapterTypes";

/**
 * Sprint 37R — Decision Support Production Wiring Readiness / Feature Flag Gate: types.
 *
 * Pure type definitions for an offline, deterministic, **readiness-only** gate that reviews every Sprint
 * 36R-accepted default-off adapter simulation against a future feature flag contract, a future production
 * wiring contract, a future rollback contract, and a governance approval checklist — without ever
 * implementing, activating, or reading a real feature flag, without ever touching the real router,
 * composer, or endpoint, and without ever showing anything to a real user or persisting anything real.
 * This module only ever reads already-computed Sprint 36R adapter case results and produces synthetic,
 * internal-only, `readinessOnly: true` / `generatedForReadinessGateOnly: true` results.
 *
 * See
 * `docs/conversational-brain-decision-support-production-wiring-readiness-feature-flag-gate.md` for the
 * full scope and non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessFeatureFlagGateProfile = "strict_production_wiring_readiness_feature_flag_gate";

export type DecisionSupportProductionWiringReadinessFeatureFlagGateMode =
  | "readiness_gate_only"
  | "feature_flag_contract_review"
  | "production_wiring_preflight_review"
  | "rollback_contract_review"
  | "governance_approval_checklist_review"
  | "default_off_activation_guard_review";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessFeatureFlagGateDecision =
  | "ready_for_default_off_feature_flag_implementation_shell"
  | "continue_readiness_gate_only"
  | "blocked_by_feature_flag_contract_gap"
  | "blocked_by_production_wiring_contract_gap"
  | "blocked_by_rollback_contract_gap"
  | "blocked_by_governance_checklist_gap"
  | "blocked_by_visibility_risk"
  | "blocked_by_production_wiring_risk"
  | "blocked_by_leakage_or_side_effect_risk";

// ─── Gate kind ────────────────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessGateKind =
  | "clarification_gate_readiness"
  | "route_preservation_readiness"
  | "unsupported_boundary_readiness"
  | "shadow_only_readiness"
  | "blocked_unsafe_readiness";

// ─── Contract statuses ────────────────────────────────────────────────────────────────

export type DecisionSupportFeatureFlagGateContractStatus = "ready" | "ready_with_warning" | "not_ready" | "blocked";

export type DecisionSupportProductionWiringContractStatus = "ready" | "ready_with_warning" | "not_ready" | "blocked";

export type DecisionSupportRollbackContractStatus = "ready" | "ready_with_warning" | "not_ready" | "blocked";

export type DecisionSupportGovernanceChecklistStatus = "prepared" | "prepared_with_warning" | "incomplete" | "blocked";

// ─── Gate QA status / risk level ──────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessGateQaStatus = "pass" | "warning" | "fail" | "blocked";

export type DecisionSupportProductionWiringReadinessGateRiskLevel = "low" | "medium" | "high" | "critical";

// ─── Gate violation type ──────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessGateViolationType =
  | "feature_flag_contract_missing"
  | "feature_flag_default_off_missing"
  | "feature_flag_activation_path_enabled"
  | "feature_flag_runtime_read_attempted"
  | "production_wiring_contract_missing"
  | "router_wiring_allowed"
  | "composer_wiring_allowed"
  | "endpoint_wiring_allowed"
  | "rollback_contract_missing"
  | "rollback_disable_path_missing"
  | "fallback_route_missing"
  | "fallback_composer_missing"
  | "governance_checklist_missing"
  | "approval_state_overclaimed"
  | "user_visible_output_allowed"
  | "production_eligible_now"
  | "real_persistence_allowed"
  | "external_call_allowed"
  | "action_execution_allowed"
  | "raw_input_leak"
  | "full_candidate_leak"
  | "pii_leak"
  | "project_name_leak"
  | "side_effect_risk";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect, wiring change, or feature flag
 * implementation/activation is a literal `false` — see
 * `createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig()`, which forces every one of them
 * to `false` regardless of what a caller's overrides object claims, mirroring every prior sprint's config
 * invariant in this package.
 */
export type DecisionSupportProductionWiringReadinessFeatureFlagGateConfig = {
  profile: "strict_production_wiring_readiness_feature_flag_gate";
  mode: DecisionSupportProductionWiringReadinessFeatureFlagGateMode;
  readinessOnly: true;
  allowProductionWiring: false;
  allowRouterChange: false;
  allowComposerChange: false;
  allowEndpointChange: false;
  allowFeatureFlagImplementation: false;
  allowFeatureFlagActivation: false;
  allowFeatureFlagRuntimeRead: false;
  allowUserVisibleOutput: false;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  allowActionExecution: false;
  allowTaskCreation: false;
  allowEmailDraftCreation: false;
  requireDefaultOffAdapterPass: true;
  requireFeatureFlagContract: true;
  requireProductionWiringContract: true;
  requireRollbackContract: true;
  requireGovernanceChecklist: true;
  requireNoApprovalOverclaim: true;
  requireNoVisibilityAttempt: true;
  requireNoLeakage: true;
  requireNoSideEffects: true;
  requireNoProductionEligibility: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Feature flag gate contract ───────────────────────────────────────────────────────

export type DecisionSupportFeatureFlagGateContract = {
  contractId: string;
  proposedFeatureFlagKey: string;
  status: DecisionSupportFeatureFlagGateContractStatus;
  readinessOnly: true;
  featureFlagImplementedNow: false;
  featureFlagActiveNow: false;
  featureFlagRuntimeReadNow: false;
  defaultValueMustBe: false;
  activationRequiresExplicitFutureSprint: true;
  activationRequiresGovernanceApproval: true;
  activationRequiresRollbackPlan: true;
  activationRequiresMonitoringPlan: true;
  activationRequiresManualVerification: true;
  activationRequiresUserVisibleOutputReview: true;
  activationRequiresProductionIncidentRollbackOwner: true;
  prohibitedActivationPaths: string[];
  requiredFutureChecks: string[];
  score: number;
  rationale: string[];
};

// ─── Production wiring readiness contract ─────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessContract = {
  contractId: string;
  status: DecisionSupportProductionWiringContractStatus;
  readinessOnly: true;
  productionWiringImplementedNow: false;
  routerChangeAllowedNow: false;
  composerChangeAllowedNow: false;
  endpointChangeAllowedNow: false;
  routerImportAllowedNow: false;
  composerImportAllowedNow: false;
  endpointImportAllowedNow: false;
  requiresFeatureFlagDefaultOff: true;
  requiresRouterGuard: true;
  requiresComposerGuard: true;
  requiresEndpointGuard: true;
  requiresNoOpFallback: true;
  requiresExistingRoutePreservation: true;
  requiresClarificationGatePreservation: true;
  requiresUnsupportedBoundaryPreservation: true;
  requiresNoUserVisibleOutputByDefault: true;
  requiresNoPersistenceByDefault: true;
  requiresNoExternalCallsByDefault: true;
  score: number;
  rationale: string[];
};

// ─── Rollback readiness contract ──────────────────────────────────────────────────────

export type DecisionSupportRollbackReadinessContract = {
  contractId: string;
  status: DecisionSupportRollbackContractStatus;
  readinessOnly: true;
  rollbackImplementedNow: false;
  rollbackRequiresFeatureFlagDisable: true;
  rollbackRequiresRouteFallback: true;
  rollbackRequiresComposerFallback: true;
  rollbackRequiresEndpointFallback: true;
  rollbackRequiresNoDataMigration: true;
  rollbackRequiresNoDataCleanup: true;
  rollbackRequiresNoPersistentStateDependency: true;
  rollbackRequiresNoExternalSideEffectsCleanup: true;
  rollbackRequiresIncidentOwner: true;
  rollbackRequiresVerificationChecklist: true;
  rollbackScore: number;
  rationale: string[];
};

// ─── Governance approval checklist ────────────────────────────────────────────────────

export type DecisionSupportGovernanceApprovalChecklist = {
  checklistId: string;
  status: DecisionSupportGovernanceChecklistStatus;
  readinessOnly: true;
  governanceApprovalGrantedNow: false;
  approvalRequiredBeforeActivation: true;
  approvalStateOverclaimed: false;
  requiredApprovalItems: string[];
  completedNowItems: string[];
  pendingFutureApprovalItems: string[];
  checklistScore: number;
  rationale: string[];
};

// ─── Gate case result ─────────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult = {
  caseId: string;
  sourceAdapterKind: string;
  sourceCaseId: string;
  generatedForReadinessGateOnly: true;
  readinessOnly: true;
  gateKind: DecisionSupportProductionWiringReadinessGateKind;
  featureFlagContract: DecisionSupportFeatureFlagGateContract;
  productionWiringContract: DecisionSupportProductionWiringReadinessContract;
  rollbackContract: DecisionSupportRollbackReadinessContract;
  governanceChecklist: DecisionSupportGovernanceApprovalChecklist;
  gateAccepted: boolean;
  gateRejected: boolean;
  gateBlocked: boolean;
  qaStatus: DecisionSupportProductionWiringReadinessGateQaStatus;
  riskLevel: DecisionSupportProductionWiringReadinessGateRiskLevel;
  violations: DecisionSupportProductionWiringReadinessGateViolationType[];
  featureFlagContractPassed: boolean;
  productionWiringContractPassed: boolean;
  rollbackContractPassed: boolean;
  governanceChecklistPrepared: boolean;
  defaultOffAdapterPassed: boolean;
  noApprovalOverclaimPassed: boolean;
  noVisibilityAttemptPassed: boolean;
  noProductionEligibilityPassed: boolean;
  noLeaksPassed: boolean;
  noSideEffectsPassed: boolean;
  safeForDefaultOffFeatureFlagImplementationShell: boolean;
  safeForUserVisibleOutputNow: false;
  safeForProduction: false;
  productionWiringAllowedNow: false;
  routerChangeAllowedNow: false;
  composerChangeAllowedNow: false;
  endpointChangeAllowedNow: false;
  featureFlagImplementationAllowedNow: false;
  featureFlagActivationAllowedNow: false;
  userVisibleOutputAllowedNow: false;
  realPersistenceAllowedNow: false;
  actionExecutionAllowedNow: false;
  warnings: string[];
};

// ─── Gate options / result ────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessFeatureFlagGateOptions = {
  config?: Partial<DecisionSupportProductionWiringReadinessFeatureFlagGateConfig>;
  /** Sprint 36R default-off route/composer integration adapter result to reuse — if omitted, a fresh one
   * is built from `cases`/`harness`/`now`. */
  adapter?: import("./decisionSupportDefaultOffRouteComposerIntegrationAdapterTypes").DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult;
  /** Sprint 35R user-visible dry run evaluation harness result to reuse when building a fresh Sprint 36R
   * adapter — if omitted, a fresh one is built from `cases`/`now`. */
  harness?: import("./decisionSupportUserVisibleDryRunEvaluationHarnessTypes").DecisionSupportUserVisibleDryRunEvaluationHarnessResult;
  /** Corpus to run the underlying Sprint 36R adapter over — defaults to that adapter's own small
   * self-contained synthetic corpus when omitted and neither `adapter` nor `harness` is supplied. Callers
   * who want the full Sprint 18R corpus's documented numbers pass `DECISION_CLARIFICATION_CASES`
   * explicitly. */
  cases?: import("../classifier/decisionClarificationArchitectureReview").DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportProductionWiringReadinessFeatureFlagGateResult = {
  config: DecisionSupportProductionWiringReadinessFeatureFlagGateConfig;
  /** Sprint 36R default-off route/composer integration adapter result, reused (not re-derived). */
  adapter: import("./decisionSupportDefaultOffRouteComposerIntegrationAdapterTypes").DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult;
  adapterSummary: import("./decisionSupportDefaultOffRouteComposerIntegrationAdapterTypes").DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummary;
  caseResults: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessFeatureFlagGateSummaryOptions = {
  /** Only used when `gateOrCaseResults` is a bare case-results array — for a full gate result, the Sprint
   * 36R decision is read from `adapterSummary.decision` directly. */
  sprint36AdapterDecision?: string;
};

export type DecisionSupportProductionWiringReadinessFeatureFlagGateSummary = {
  totalCases: number;
  gateEvaluatedCount: number;
  gateAcceptedCount: number;
  gateRejectedCount: number;
  gateBlockedCount: number;
  clarificationGateReadinessCount: number;
  routePreservationReadinessCount: number;
  unsupportedBoundaryReadinessCount: number;
  shadowOnlyReadinessCount: number;
  blockedUnsafeReadinessCount: number;
  qaPassCount: number;
  qaWarningCount: number;
  qaFailCount: number;
  qaBlockedCount: number;
  featureFlagContractPassedCount: number;
  productionWiringContractPassedCount: number;
  rollbackContractPassedCount: number;
  governanceChecklistPreparedCount: number;
  governanceApprovalGrantedNowCount: number;
  approvalOverclaimCount: number;
  defaultOffAdapterPassedCount: number;
  noVisibilityAttemptPassedCount: number;
  noProductionEligibilityPassedCount: number;
  noLeaksPassedCount: number;
  noSideEffectsPassedCount: number;
  safeForDefaultOffFeatureFlagImplementationShellCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  averageFeatureFlagContractScore: number;
  averageProductionWiringContractScore: number;
  averageRollbackContractScore: number;
  averageGovernanceChecklistScore: number;
  minFeatureFlagContractScore: number;
  minProductionWiringContractScore: number;
  minRollbackContractScore: number;
  minGovernanceChecklistScore: number;
  violationCount: number;
  criticalViolationCount: number;
  productionWiringAllowedNowCount: number;
  routerChangeAllowedNowCount: number;
  composerChangeAllowedNowCount: number;
  endpointChangeAllowedNowCount: number;
  featureFlagImplementationAllowedNowCount: number;
  featureFlagActivationAllowedNowCount: number;
  userVisibleOutputAllowedNowCount: number;
  realPersistenceAllowedNowCount: number;
  actionExecutionAllowedNowCount: number;
  decision: DecisionSupportProductionWiringReadinessFeatureFlagGateDecision;
  recommendedNextSprint: string;
  representativeAcceptedGateResults: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult[];
  rejectedGateResults: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult[];
  blockedGateResults: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessFeatureFlagGateExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  gateProfile: string;
  gateModes: string[];
  gateKindRules: string[];
  featureFlagGateContractRules: string[];
  productionWiringReadinessContractRules: string[];
  rollbackReadinessContractRules: string[];
  governanceApprovalChecklistRules: string[];
  gateCaseEvaluationRules: string[];
  gateRunRules: string[];
  decisionRule: string;
  allowedNextActions: string[];
  prohibitedNextActions: string[];
  whyUserVisibleOutputIsNotShown: string;
  whyRouterIsNotChanged: string;
  whyComposerIsNotChanged: string;
  whyEndpointIsNotChanged: string;
  whyFeatureFlagIsNotCreated: string;
  whyProcessEnvIsNotRead: string;
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whySqlFileIsNotCreated: string;
  whySupabaseStorageIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  whyRepositoryIsNotCreated: string;
  whyApprovalIsNotOverclaimed: string;
  expectedSprint38Path: string;
};

// Re-exported so callers of this module never need to import the Sprint 36R types directly just to pass a
// `DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult`-shaped value in.
export type { DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult };
