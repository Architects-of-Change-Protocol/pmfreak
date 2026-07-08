import type { DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult } from "./decisionSupportProductionWiringReadinessFeatureFlagGateTypes";

/**
 * Sprint 38R — Decision Support Default-Off Feature Flag Implementation Shell: types.
 *
 * Pure type definitions for an offline, deterministic, **shell-only** feature flag implementation shell
 * that reviews every Sprint 37R-accepted production wiring readiness gate case against a formal (but
 * entirely no-op) feature flag definition, a static default-off flag state resolution, a router guard
 * readiness handoff, and a rollback reference. This module never implements a real production feature
 * flag, never activates a feature flag, never reads `process.env` or any runtime configuration source,
 * never touches the real router, composer, or endpoint, and never shows anything to a real user or
 * persists anything real. It only ever reads already-computed Sprint 37R gate case results and produces
 * synthetic, internal-only, `shellOnly: true` / `generatedForFeatureFlagShellOnly: true` results.
 *
 * See `docs/conversational-brain-decision-support-default-off-feature-flag-implementation-shell.md` for the
 * full scope and non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagImplementationShellProfile = "strict_default_off_feature_flag_implementation_shell";

export type DecisionSupportDefaultOffFeatureFlagImplementationShellMode =
  | "feature_flag_shell_only"
  | "no_op_default_off_resolution"
  | "activation_block_review"
  | "runtime_read_guard_review"
  | "router_guard_readiness_review"
  | "rollback_contract_shell_review";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagImplementationShellDecision =
  | "ready_for_default_off_router_guard_shell"
  | "continue_feature_flag_shell_only"
  | "blocked_by_feature_flag_definition_gap"
  | "blocked_by_default_off_gap"
  | "blocked_by_runtime_read_risk"
  | "blocked_by_activation_risk"
  | "blocked_by_production_wiring_risk"
  | "blocked_by_visibility_risk"
  | "blocked_by_leakage_or_side_effect_risk";

// ─── Shell kind ───────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagShellKind = "clarification_gate_flag_shell" | "route_preservation_flag_shell" | "unsupported_boundary_flag_shell" | "shadow_only_flag_shell" | "blocked_unsafe_flag_shell";

// ─── Flag state / source ──────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagState = "disabled" | "blocked" | "invalid";

export type DecisionSupportDefaultOffFeatureFlagSource = "static_default_off" | "test_fixture_only" | "invalid_runtime_source";

// ─── Shell status / QA status / risk level ────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagShellStatus = "accepted" | "rejected" | "blocked";

export type DecisionSupportDefaultOffFeatureFlagShellQaStatus = "pass" | "warning" | "fail" | "blocked";

export type DecisionSupportDefaultOffFeatureFlagShellRiskLevel = "low" | "medium" | "high" | "critical";

// ─── Shell violation type ─────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagShellViolationType =
  | "feature_flag_definition_missing"
  | "feature_flag_key_mismatch"
  | "default_value_not_false"
  | "feature_flag_active_now"
  | "feature_flag_activation_allowed"
  | "feature_flag_runtime_read_attempted"
  | "feature_flag_runtime_source_used"
  | "production_feature_flag_implemented"
  | "router_wiring_allowed"
  | "composer_wiring_allowed"
  | "endpoint_wiring_allowed"
  | "production_wiring_allowed"
  | "user_visible_output_allowed"
  | "real_persistence_allowed"
  | "external_call_allowed"
  | "action_execution_allowed"
  | "approval_state_overclaimed"
  | "rollback_contract_missing"
  | "raw_input_leak"
  | "full_candidate_leak"
  | "pii_leak"
  | "project_name_leak"
  | "side_effect_risk";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect, wiring change, or feature flag
 * implementation/activation is a literal `false` — see
 * `createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig()`, which forces every one of them
 * to `false` regardless of what a caller's overrides object claims, mirroring every prior sprint's config
 * invariant in this package.
 */
export type DecisionSupportDefaultOffFeatureFlagImplementationShellConfig = {
  profile: "strict_default_off_feature_flag_implementation_shell";
  mode: DecisionSupportDefaultOffFeatureFlagImplementationShellMode;
  shellOnly: true;
  noOpShell: true;
  defaultOff: true;
  proposedFeatureFlagKey: "pmfreak.decisionSupport.defaultOffRouteComposerAdapter";
  allowProductionFeatureFlagImplementation: false;
  allowFeatureFlagActivation: false;
  allowFeatureFlagRuntimeRead: false;
  allowProductionWiring: false;
  allowRouterChange: false;
  allowComposerChange: false;
  allowEndpointChange: false;
  allowUserVisibleOutput: false;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  allowActionExecution: false;
  allowTaskCreation: false;
  allowEmailDraftCreation: false;
  requireProductionWiringReadinessGatePass: true;
  requireFeatureFlagContractPass: true;
  requireDefaultValueFalse: true;
  requireNoRuntimeRead: true;
  requireNoActivation: true;
  requireNoProductionWiring: true;
  requireRollbackContractReference: true;
  requireNoApprovalOverclaim: true;
  requireNoVisibilityAttempt: true;
  requireNoLeakage: true;
  requireNoSideEffects: true;
  requireNoProductionEligibility: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Feature flag shell definition ─────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagShellDefinition = {
  definitionId: string;
  key: "pmfreak.decisionSupport.defaultOffRouteComposerAdapter";
  description: string;
  shellOnly: true;
  noOpShell: true;
  productionFeatureFlagImplementedNow: false;
  featureFlagActiveNow: false;
  featureFlagRuntimeReadNow: false;
  defaultValue: false;
  resolvedState: "disabled";
  resolvedSource: "static_default_off";
  activationAllowedNow: false;
  activationRequiresFutureSprint: true;
  activationRequiresGovernanceApproval: true;
  activationRequiresRollbackContract: true;
  activationRequiresRouterGuard: true;
  activationRequiresComposerGuard: true;
  activationRequiresEndpointGuard: true;
  activationRequiresMonitoringContract: true;
  activationRequiresManualSmokeTest: true;
  prohibitedRuntimeSources: string[];
  requiredFutureChecks: string[];
  score: number;
  rationale: string[];
};

// ─── Feature flag shell state ──────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagShellState = {
  stateId: string;
  key: string;
  enabled: false;
  state: DecisionSupportDefaultOffFeatureFlagState;
  source: DecisionSupportDefaultOffFeatureFlagSource;
  shellOnly: true;
  noOpShell: true;
  defaultOff: true;
  runtimeReadAttempted: boolean;
  activationAttempted: boolean;
  productionWiringAttempted: boolean;
  routerChangeAttempted: boolean;
  composerChangeAttempted: boolean;
  endpointChangeAttempted: boolean;
  userVisibleOutputAttempted: boolean;
  realPersistenceAttempted: boolean;
  externalCallAttempted: boolean;
  actionExecutionAttempted: boolean;
  warnings: string[];
};

export type DecisionSupportDefaultOffFeatureFlagShellStateOptions = {
  forceEnabled?: boolean;
  forceRuntimeReadAttempted?: boolean;
  forceActivationAttempted?: boolean;
  forceSource?: DecisionSupportDefaultOffFeatureFlagSource;
  forceProductionWiringAttempted?: boolean;
  forceRouterChangeAttempted?: boolean;
  forceComposerChangeAttempted?: boolean;
  forceEndpointChangeAttempted?: boolean;
  forceUserVisibleOutputAttempted?: boolean;
  forceRealPersistenceAttempted?: boolean;
  forceExternalCallAttempted?: boolean;
  forceActionExecutionAttempted?: boolean;
};

// ─── Router guard readiness handoff ────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardReadinessHandoff = {
  handoffId: string;
  shellKind: DecisionSupportDefaultOffFeatureFlagShellKind;
  key: string;
  readyForRouterGuardShell: boolean;
  routerGuardImplementationAllowedNow: false;
  routerRuntimeWiringAllowedNow: false;
  requiresStaticDefaultOffFlagState: true;
  requiresNoRouterImportInSprint38: true;
  requiresRouterGuardShellInSprint39: true;
  requiresExistingRoutePreservation: true;
  requiresClarificationGatePreservation: true;
  requiresUnsupportedBoundaryPreservation: true;
  requiresNoUserVisibleOutputByDefault: true;
  score: number;
  rationale: string[];
};

// ─── Rollback reference ────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagRollbackReference = {
  rollbackReferenceId: string;
  shellOnly: true;
  rollbackImplementedNow: false;
  rollbackRequiresFeatureFlagDisable: true;
  rollbackRequiresRouterFallback: true;
  rollbackRequiresComposerFallback: true;
  rollbackRequiresEndpointFallback: true;
  rollbackRequiresNoDataMigration: true;
  rollbackRequiresNoPersistentStateCleanup: true;
  rollbackRequiresNoExternalSideEffectCleanup: true;
  rollbackRequiresIncidentOwner: true;
  rollbackRequiresVerificationChecklist: true;
  score: number;
  rationale: string[];
};

// ─── Shell case result ─────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult = {
  caseId: string;
  sourceGateKind: string;
  sourceCaseId: string;
  shellKind: DecisionSupportDefaultOffFeatureFlagShellKind;
  generatedForFeatureFlagShellOnly: true;
  shellOnly: true;
  noOpShell: true;
  defaultOff: true;
  featureFlagDefinition: DecisionSupportDefaultOffFeatureFlagShellDefinition;
  featureFlagState: DecisionSupportDefaultOffFeatureFlagShellState;
  routerGuardReadinessHandoff: DecisionSupportDefaultOffRouterGuardReadinessHandoff;
  rollbackReference: DecisionSupportDefaultOffFeatureFlagRollbackReference;
  shellAccepted: boolean;
  shellRejected: boolean;
  shellBlocked: boolean;
  qaStatus: DecisionSupportDefaultOffFeatureFlagShellQaStatus;
  riskLevel: DecisionSupportDefaultOffFeatureFlagShellRiskLevel;
  violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[];
  featureFlagDefinitionPassed: boolean;
  defaultValueFalsePassed: boolean;
  staticDefaultOffResolutionPassed: boolean;
  noRuntimeReadPassed: boolean;
  noActivationPassed: boolean;
  noProductionFeatureFlagImplementationPassed: boolean;
  routerGuardHandoffPassed: boolean;
  rollbackReferencePassed: boolean;
  noApprovalOverclaimPassed: boolean;
  noVisibilityAttemptPassed: boolean;
  noProductionEligibilityPassed: boolean;
  noLeaksPassed: boolean;
  noSideEffectsPassed: boolean;
  safeForDefaultOffRouterGuardShell: boolean;
  safeForUserVisibleOutputNow: false;
  safeForProduction: false;
  productionWiringAllowedNow: false;
  routerChangeAllowedNow: false;
  composerChangeAllowedNow: false;
  endpointChangeAllowedNow: false;
  featureFlagActivationAllowedNow: false;
  userVisibleOutputAllowedNow: false;
  realPersistenceAllowedNow: false;
  actionExecutionAllowedNow: false;
  warnings: string[];
};

// ─── Options / result ──────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagImplementationShellOptions = {
  config?: Partial<DecisionSupportDefaultOffFeatureFlagImplementationShellConfig>;
  /** Sprint 37R production wiring readiness / feature flag gate result to reuse — if omitted, a fresh one
   * is built from `adapter`/`harness`/`cases`/`now`. */
  gate?: import("./decisionSupportProductionWiringReadinessFeatureFlagGateTypes").DecisionSupportProductionWiringReadinessFeatureFlagGateResult;
  /** Sprint 36R default-off route/composer integration adapter result to reuse when building a fresh Sprint
   * 37R gate — if omitted, a fresh one is built from `harness`/`cases`/`now`. */
  adapter?: import("./decisionSupportDefaultOffRouteComposerIntegrationAdapterTypes").DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult;
  /** Sprint 35R user-visible dry run evaluation harness result to reuse when building a fresh Sprint 36R
   * adapter — if omitted, a fresh one is built from `cases`/`now`. */
  harness?: import("./decisionSupportUserVisibleDryRunEvaluationHarnessTypes").DecisionSupportUserVisibleDryRunEvaluationHarnessResult;
  /** Corpus to run the underlying Sprint 37R gate over — defaults to that gate's own small self-contained
   * synthetic corpus when omitted and neither `gate`, `adapter`, nor `harness` is supplied. Callers who want
   * the full Sprint 18R corpus's documented numbers pass `DECISION_CLARIFICATION_CASES` explicitly. */
  cases?: import("../classifier/decisionClarificationArchitectureReview").DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportDefaultOffFeatureFlagImplementationShellResult = {
  config: DecisionSupportDefaultOffFeatureFlagImplementationShellConfig;
  /** Sprint 37R production wiring readiness / feature flag gate result, reused (not re-derived). */
  gate: import("./decisionSupportProductionWiringReadinessFeatureFlagGateTypes").DecisionSupportProductionWiringReadinessFeatureFlagGateResult;
  gateSummary: import("./decisionSupportProductionWiringReadinessFeatureFlagGateTypes").DecisionSupportProductionWiringReadinessFeatureFlagGateSummary;
  caseResults: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagImplementationShellSummaryOptions = {
  /** Only used when `shellOrCaseResults` is a bare case-results array — for a full shell result, the Sprint
   * 37R decision is read from `gateSummary.decision` directly. */
  sprint37GateDecision?: string;
};

export type DecisionSupportDefaultOffFeatureFlagImplementationShellSummary = {
  totalCases: number;
  shellEvaluatedCount: number;
  shellAcceptedCount: number;
  shellRejectedCount: number;
  shellBlockedCount: number;
  clarificationGateFlagShellCount: number;
  routePreservationFlagShellCount: number;
  unsupportedBoundaryFlagShellCount: number;
  shadowOnlyFlagShellCount: number;
  blockedUnsafeFlagShellCount: number;
  qaPassCount: number;
  qaWarningCount: number;
  qaFailCount: number;
  qaBlockedCount: number;
  featureFlagDefinitionPassedCount: number;
  defaultValueFalsePassedCount: number;
  staticDefaultOffResolutionPassedCount: number;
  noRuntimeReadPassedCount: number;
  noActivationPassedCount: number;
  noProductionFeatureFlagImplementationPassedCount: number;
  routerGuardHandoffPassedCount: number;
  rollbackReferencePassedCount: number;
  noApprovalOverclaimPassedCount: number;
  noVisibilityAttemptPassedCount: number;
  noProductionEligibilityPassedCount: number;
  noLeaksPassedCount: number;
  noSideEffectsPassedCount: number;
  safeForDefaultOffRouterGuardShellCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  averageFeatureFlagDefinitionScore: number;
  averageRouterGuardHandoffScore: number;
  averageRollbackReferenceScore: number;
  minFeatureFlagDefinitionScore: number;
  minRouterGuardHandoffScore: number;
  minRollbackReferenceScore: number;
  violationCount: number;
  criticalViolationCount: number;
  productionWiringAllowedNowCount: number;
  routerChangeAllowedNowCount: number;
  composerChangeAllowedNowCount: number;
  endpointChangeAllowedNowCount: number;
  featureFlagActivationAllowedNowCount: number;
  userVisibleOutputAllowedNowCount: number;
  realPersistenceAllowedNowCount: number;
  actionExecutionAllowedNowCount: number;
  runtimeReadAttemptedCount: number;
  activationAttemptedCount: number;
  productionFeatureFlagImplementedNowCount: number;
  decision: DecisionSupportDefaultOffFeatureFlagImplementationShellDecision;
  recommendedNextSprint: string;
  representativeAcceptedShellResults: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult[];
  rejectedShellResults: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult[];
  blockedShellResults: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagImplementationShellExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  shellProfile: string;
  shellModes: string[];
  shellKindRules: string[];
  featureFlagDefinitionRules: string[];
  staticDefaultOffResolutionRules: string[];
  runtimeReadProhibitionRules: string[];
  activationProhibitionRules: string[];
  routerGuardHandoffRules: string[];
  rollbackReferenceRules: string[];
  shellCaseEvaluationRules: string[];
  shellRunRules: string[];
  decisionRule: string;
  allowedNextActions: string[];
  prohibitedNextActions: string[];
  whyUserVisibleOutputIsNotShown: string;
  whyRouterIsNotChanged: string;
  whyComposerIsNotChanged: string;
  whyEndpointIsNotChanged: string;
  whyFeatureFlagIsNotActivated: string;
  whyProcessEnvIsNotRead: string;
  whyProductionFeatureFlagIsNotImplemented: string;
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whySqlFileIsNotCreated: string;
  whySupabaseStorageIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  whyRepositoryIsNotCreated: string;
  whyApprovalIsNotOverclaimed: string;
  expectedSprint39Path: string;
};

// Re-exported so callers of this module never need to import the Sprint 37R types directly just to pass a
// `DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult`-shaped value in.
export type { DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult };
