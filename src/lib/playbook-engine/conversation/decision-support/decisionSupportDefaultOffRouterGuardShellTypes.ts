import type { DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult } from "./decisionSupportDefaultOffFeatureFlagImplementationShellTypes";

/**
 * Sprint 39R — Decision Support Default-Off Router Guard Shell: types.
 *
 * Pure type definitions for an offline, deterministic, **shell-only** router guard shell that reviews every
 * Sprint 38R-accepted default-off feature flag implementation shell case against a formal (but entirely
 * no-op) router guard definition, a static feature-flag-state reference, a no-op route evaluation, a
 * composer guard readiness handoff, and a router rollback reference. This module never touches the real
 * router, never imports the real router, never mutates a live route, never activates a feature flag, never
 * reads `process.env` or any runtime configuration source, never touches the real composer or endpoint, and
 * never shows anything to a real user or persists anything real. It only ever reads already-computed Sprint
 * 38R shell case results and produces synthetic, internal-only, `shellOnly: true` /
 * `generatedForRouterGuardShellOnly: true` results.
 *
 * See `docs/conversational-brain-decision-support-default-off-router-guard-shell.md` for the full scope and
 * non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellProfile = "strict_default_off_router_guard_shell";

export type DecisionSupportDefaultOffRouterGuardShellMode =
  | "router_guard_shell_only"
  | "no_op_route_selection_review"
  | "existing_route_preservation_guard_review"
  | "clarification_gate_route_guard_review"
  | "unsupported_boundary_route_guard_review"
  | "composer_guard_handoff_review"
  | "rollback_route_guard_shell_review";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellDecision =
  | "ready_for_default_off_composer_guard_shell"
  | "continue_router_guard_shell_only"
  | "blocked_by_router_guard_definition_gap"
  | "blocked_by_default_off_gap"
  | "blocked_by_router_import_risk"
  | "blocked_by_route_mutation_risk"
  | "blocked_by_production_wiring_risk"
  | "blocked_by_visibility_risk"
  | "blocked_by_leakage_or_side_effect_risk";

// ─── Router guard kind ──────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellKind =
  | "clarification_gate_router_guard_shell"
  | "route_preservation_router_guard_shell"
  | "unsupported_boundary_router_guard_shell"
  | "shadow_only_router_guard_shell"
  | "blocked_unsafe_router_guard_shell";

// ─── Live route decision / future route intent ─────────────────────────────────────────

export type DecisionSupportDefaultOffLiveRouteDecision = "preserve_current_route_noop" | "block_route_mutation_default_off" | "keep_shadow_only_noop" | "block_unsafe_noop";

export type DecisionSupportDefaultOffFutureRouteIntent =
  | "future_route_to_clarification_gate"
  | "future_preserve_existing_route"
  | "future_preserve_unsupported_boundary"
  | "future_keep_shadow_only"
  | "future_block_unsafe";

// ─── Router guard feature flag state / source ──────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardFeatureFlagState = "disabled" | "blocked" | "invalid";

export type DecisionSupportDefaultOffRouterGuardFeatureFlagSource = "static_default_off" | "test_fixture_only" | "invalid_runtime_source";

// ─── Router guard status / QA status / risk level ──────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellStatus = "accepted" | "rejected" | "blocked";

export type DecisionSupportDefaultOffRouterGuardShellQaStatus = "pass" | "warning" | "fail" | "blocked";

export type DecisionSupportDefaultOffRouterGuardShellRiskLevel = "low" | "medium" | "high" | "critical";

// ─── Router guard violation type ───────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellViolationType =
  | "router_guard_definition_missing"
  | "feature_flag_state_missing"
  | "feature_flag_enabled_now"
  | "feature_flag_runtime_read_attempted"
  | "router_import_attempted"
  | "router_runtime_wiring_active"
  | "route_mutation_allowed"
  | "route_mutation_attempted"
  | "current_route_not_preserved"
  | "clarification_gate_not_preserved"
  | "existing_route_not_preserved"
  | "unsupported_boundary_not_preserved"
  | "shadow_only_not_preserved"
  | "unsafe_route_not_blocked"
  | "composer_handoff_missing"
  | "rollback_route_reference_missing"
  | "composer_wiring_allowed"
  | "endpoint_wiring_allowed"
  | "production_wiring_allowed"
  | "user_visible_output_allowed"
  | "real_persistence_allowed"
  | "external_call_allowed"
  | "action_execution_allowed"
  | "approval_state_overclaimed"
  | "raw_input_leak"
  | "full_candidate_leak"
  | "pii_leak"
  | "project_name_leak"
  | "side_effect_risk";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect, wiring change, or router
 * import/mutation/activation is a literal `false` — see
 * `createDecisionSupportDefaultOffRouterGuardShellConfig()`, which forces every one of them to `false`
 * regardless of what a caller's overrides object claims, mirroring every prior sprint's config invariant in
 * this package.
 */
export type DecisionSupportDefaultOffRouterGuardShellConfig = {
  profile: "strict_default_off_router_guard_shell";
  mode: DecisionSupportDefaultOffRouterGuardShellMode;
  shellOnly: true;
  noOpRouterGuard: true;
  defaultOff: true;
  proposedFeatureFlagKey: "pmfreak.decisionSupport.defaultOffRouteComposerAdapter";
  allowProductionRouterGuardImplementation: false;
  allowRouterImport: false;
  allowRouterRuntimeWiring: false;
  allowRouteMutation: false;
  allowFeatureFlagRuntimeRead: false;
  allowFeatureFlagActivation: false;
  allowProductionWiring: false;
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
  requireFeatureFlagShellPass: true;
  requireDefaultOffFeatureFlagState: true;
  requireNoRouterImport: true;
  requireNoRouterRuntimeWiring: true;
  requireNoRouteMutation: true;
  requireCurrentRoutePreservation: true;
  requireComposerGuardHandoff: true;
  requireRollbackRouteReference: true;
  requireNoApprovalOverclaim: true;
  requireNoVisibilityAttempt: true;
  requireNoLeakage: true;
  requireNoSideEffects: true;
  requireNoProductionEligibility: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Router guard shell definition ─────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellDefinition = {
  definitionId: string;
  shellKind: DecisionSupportDefaultOffRouterGuardShellKind;
  key: "pmfreak.decisionSupport.defaultOffRouteComposerAdapter";
  description: string;
  shellOnly: true;
  noOpRouterGuard: true;
  productionRouterGuardImplementedNow: false;
  routerImportAllowedNow: false;
  routerRuntimeWiringActiveNow: false;
  routeMutationAllowedNow: false;
  featureFlagEnabledNow: false;
  featureFlagRuntimeReadNow: false;
  defaultOff: true;
  requiresFeatureFlagDisabled: true;
  requiresCurrentRoutePreservation: true;
  requiresClarificationGatePreservation: boolean;
  requiresExistingRoutePreservation: boolean;
  requiresUnsupportedBoundaryPreservation: boolean;
  requiresShadowOnlyPreservation: boolean;
  requiresUnsafeRouteBlock: boolean;
  requiresComposerGuardHandoff: true;
  requiresRollbackRouteReference: true;
  prohibitedRouterSources: string[];
  requiredFutureChecks: string[];
  score: number;
  rationale: string[];
};

// ─── Router guard feature flag state reference ─────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference = {
  stateReferenceId: string;
  key: string;
  featureFlagState: DecisionSupportDefaultOffRouterGuardFeatureFlagState;
  featureFlagEnabled: false;
  source: DecisionSupportDefaultOffRouterGuardFeatureFlagSource;
  defaultOff: true;
  shellOnly: true;
  runtimeReadAttempted: boolean;
  activationAttempted: boolean;
  featureFlagRuntimeReadNow: false;
  featureFlagActivationAllowedNow: false;
  warnings: string[];
};

export type DecisionSupportDefaultOffRouterGuardFeatureFlagStateReferenceOptions = {
  forceEnabled?: boolean;
  forceState?: DecisionSupportDefaultOffRouterGuardFeatureFlagState;
  forceSource?: DecisionSupportDefaultOffRouterGuardFeatureFlagSource;
  forceRuntimeReadAttempted?: boolean;
  forceActivationAttempted?: boolean;
};

// ─── Router guard route evaluation ─────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardRouteEvaluation = {
  routeEvaluationId: string;
  sourceCaseId: string;
  shellKind: DecisionSupportDefaultOffRouterGuardShellKind;
  liveRouteDecision: DecisionSupportDefaultOffLiveRouteDecision;
  futureRouteIntent: DecisionSupportDefaultOffFutureRouteIntent;
  defaultOff: true;
  shellOnly: true;
  currentRoutePreserved: true;
  routeMutationAllowedNow: false;
  routeMutationAttempted: boolean;
  routerRuntimeWiringActiveNow: boolean;
  routerImportAttempted: boolean;
  decisionSupportRouteActivatedNow: boolean;
  clarificationGatePreserved: boolean;
  existingRoutePreserved: boolean;
  unsupportedBoundaryPreserved: boolean;
  shadowOnlyPreserved: boolean;
  unsafeRouteBlocked: boolean;
  userVisibleNow: boolean;
  persistedNow: false;
  executableNow: false;
  externalSideEffectsAllowed: false;
  productionEligibleNow: boolean;
  score: number;
  rationale: string[];
  warnings: string[];
};

export type DecisionSupportDefaultOffRouterGuardRouteEvaluationOptions = {
  forceRouteMutationAttempted?: boolean;
  forceRouterImportAttempted?: boolean;
  forceRouterRuntimeWiringActiveNow?: boolean;
  forceDecisionSupportRouteActivatedNow?: boolean;
  forceUserVisibleNow?: boolean;
  forceProductionEligibleNow?: boolean;
};

// ─── Composer guard readiness handoff ───────────────────────────────────────────────────

export type DecisionSupportDefaultOffComposerGuardReadinessHandoff = {
  handoffId: string;
  shellKind: DecisionSupportDefaultOffRouterGuardShellKind;
  sourceCaseId: string;
  key: string;
  readyForComposerGuardShell: boolean;
  composerGuardImplementationAllowedNow: false;
  composerRuntimeWiringAllowedNow: false;
  requiresRouterGuardShellAccepted: true;
  requiresFeatureFlagDisabled: true;
  requiresCurrentRoutePreserved: true;
  requiresNoComposerImportInSprint39: true;
  requiresComposerGuardShellInSprint40: true;
  requiresNoUserVisibleOutputByDefault: true;
  requiresNoPersistenceByDefault: true;
  requiresNoActionExecutionByDefault: true;
  score: number;
  rationale: string[];
};

// ─── Router rollback reference ─────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardRollbackReference = {
  rollbackReferenceId: string;
  shellOnly: true;
  rollbackImplementedNow: false;
  rollbackRequiresFeatureFlagDisable: true;
  rollbackRequiresCurrentRouteFallback: true;
  rollbackRequiresExistingRoutePreservation: true;
  rollbackRequiresComposerNoOpFallback: true;
  rollbackRequiresEndpointNoOpFallback: true;
  rollbackRequiresNoDataMigration: true;
  rollbackRequiresNoPersistentStateCleanup: true;
  rollbackRequiresNoExternalSideEffectCleanup: true;
  rollbackRequiresIncidentOwner: true;
  rollbackRequiresVerificationChecklist: true;
  score: number;
  rationale: string[];
};

// ─── Router guard case result ──────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellCaseResult = {
  caseId: string;
  sourceShellKind: string;
  sourceCaseId: string;
  routerGuardShellKind: DecisionSupportDefaultOffRouterGuardShellKind;
  generatedForRouterGuardShellOnly: true;
  shellOnly: true;
  noOpRouterGuard: true;
  defaultOff: true;
  routerGuardDefinition: DecisionSupportDefaultOffRouterGuardShellDefinition;
  featureFlagStateReference: DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference;
  routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation;
  composerGuardReadinessHandoff: DecisionSupportDefaultOffComposerGuardReadinessHandoff;
  rollbackReference: DecisionSupportDefaultOffRouterGuardRollbackReference;
  routerGuardAccepted: boolean;
  routerGuardRejected: boolean;
  routerGuardBlocked: boolean;
  qaStatus: DecisionSupportDefaultOffRouterGuardShellQaStatus;
  riskLevel: DecisionSupportDefaultOffRouterGuardShellRiskLevel;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
  routerGuardDefinitionPassed: boolean;
  featureFlagDisabledPassed: boolean;
  noRouterImportPassed: boolean;
  noRouterRuntimeWiringPassed: boolean;
  noRouteMutationPassed: boolean;
  currentRoutePreservationPassed: boolean;
  routeIntentPreservationPassed: boolean;
  composerGuardHandoffPassed: boolean;
  rollbackReferencePassed: boolean;
  noApprovalOverclaimPassed: boolean;
  noVisibilityAttemptPassed: boolean;
  noProductionEligibilityPassed: boolean;
  noLeaksPassed: boolean;
  noSideEffectsPassed: boolean;
  safeForDefaultOffComposerGuardShell: boolean;
  safeForUserVisibleOutputNow: false;
  safeForProduction: false;
  productionWiringAllowedNow: false;
  routerChangeAllowedNow: false;
  routeMutationAllowedNow: false;
  composerChangeAllowedNow: false;
  endpointChangeAllowedNow: false;
  userVisibleOutputAllowedNow: false;
  realPersistenceAllowedNow: false;
  actionExecutionAllowedNow: false;
  warnings: string[];
};

// ─── Options / result ──────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellOptions = {
  config?: Partial<DecisionSupportDefaultOffRouterGuardShellConfig>;
  /** Sprint 38R default-off feature flag implementation shell result to reuse — if omitted, a fresh one is
   * built from `cases`/`now`. */
  shell?: import("./decisionSupportDefaultOffFeatureFlagImplementationShellTypes").DecisionSupportDefaultOffFeatureFlagImplementationShellResult;
  /** Corpus to run the underlying Sprint 38R shell (and, transitively, the Sprint 37R gate) over — defaults
   * to that shell's own small self-contained synthetic corpus when omitted and `shell` is not supplied.
   * Callers who want the full Sprint 18R corpus's documented numbers pass `DECISION_CLARIFICATION_CASES`
   * explicitly. */
  cases?: import("../classifier/decisionClarificationArchitectureReview").DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportDefaultOffRouterGuardShellResult = {
  config: DecisionSupportDefaultOffRouterGuardShellConfig;
  /** Sprint 38R default-off feature flag implementation shell result, reused (not re-derived). */
  shell: import("./decisionSupportDefaultOffFeatureFlagImplementationShellTypes").DecisionSupportDefaultOffFeatureFlagImplementationShellResult;
  shellSummary: import("./decisionSupportDefaultOffFeatureFlagImplementationShellTypes").DecisionSupportDefaultOffFeatureFlagImplementationShellSummary;
  caseResults: DecisionSupportDefaultOffRouterGuardShellCaseResult[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellSummaryOptions = {
  /** Only used when `resultOrCaseResults` is a bare case-results array — for a full result, the Sprint 38R
   * decision is read from `shellSummary.decision` directly. */
  sprint38ShellDecision?: string;
};

export type DecisionSupportDefaultOffRouterGuardShellSummary = {
  totalCases: number;
  routerGuardEvaluatedCount: number;
  routerGuardAcceptedCount: number;
  routerGuardRejectedCount: number;
  routerGuardBlockedCount: number;
  clarificationGateRouterGuardCount: number;
  routePreservationRouterGuardCount: number;
  unsupportedBoundaryRouterGuardCount: number;
  shadowOnlyRouterGuardCount: number;
  blockedUnsafeRouterGuardCount: number;
  qaPassCount: number;
  qaWarningCount: number;
  qaFailCount: number;
  qaBlockedCount: number;
  routerGuardDefinitionPassedCount: number;
  featureFlagDisabledPassedCount: number;
  noRouterImportPassedCount: number;
  noRouterRuntimeWiringPassedCount: number;
  noRouteMutationPassedCount: number;
  currentRoutePreservationPassedCount: number;
  routeIntentPreservationPassedCount: number;
  composerGuardHandoffPassedCount: number;
  rollbackReferencePassedCount: number;
  noApprovalOverclaimPassedCount: number;
  noVisibilityAttemptPassedCount: number;
  noProductionEligibilityPassedCount: number;
  noLeaksPassedCount: number;
  noSideEffectsPassedCount: number;
  safeForDefaultOffComposerGuardShellCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  averageRouterGuardDefinitionScore: number;
  averageRouteEvaluationScore: number;
  averageComposerGuardHandoffScore: number;
  averageRollbackReferenceScore: number;
  minRouterGuardDefinitionScore: number;
  minRouteEvaluationScore: number;
  minComposerGuardHandoffScore: number;
  minRollbackReferenceScore: number;
  violationCount: number;
  criticalViolationCount: number;
  productionWiringAllowedNowCount: number;
  routerChangeAllowedNowCount: number;
  routeMutationAllowedNowCount: number;
  composerChangeAllowedNowCount: number;
  endpointChangeAllowedNowCount: number;
  userVisibleOutputAllowedNowCount: number;
  realPersistenceAllowedNowCount: number;
  actionExecutionAllowedNowCount: number;
  routerImportAttemptedCount: number;
  routerRuntimeWiringActiveNowCount: number;
  routeMutationAttemptedCount: number;
  decisionSupportRouteActivatedNowCount: number;
  featureFlagRuntimeReadNowCount: number;
  decision: DecisionSupportDefaultOffRouterGuardShellDecision;
  recommendedNextSprint: string;
  representativeAcceptedRouterGuardResults: DecisionSupportDefaultOffRouterGuardShellCaseResult[];
  rejectedRouterGuardResults: DecisionSupportDefaultOffRouterGuardShellCaseResult[];
  blockedRouterGuardResults: DecisionSupportDefaultOffRouterGuardShellCaseResult[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  shellProfile: string;
  shellModes: string[];
  shellKindRules: string[];
  routerGuardDefinitionRules: string[];
  featureFlagStateReferenceRules: string[];
  routeEvaluationRules: string[];
  currentRoutePreservationRules: string[];
  futureRouteIntentRules: string[];
  composerGuardHandoffRules: string[];
  rollbackReferenceRules: string[];
  routerGuardCaseEvaluationRules: string[];
  routerGuardRunRules: string[];
  decisionRule: string;
  allowedNextActions: string[];
  prohibitedNextActions: string[];
  whyUserVisibleOutputIsNotShown: string;
  whyRouterIsNotChanged: string;
  whyRouterIsNotImported: string;
  whyComposerIsNotChanged: string;
  whyEndpointIsNotChanged: string;
  whyFeatureFlagIsNotActivated: string;
  whyProcessEnvIsNotRead: string;
  whyProductionRouterGuardIsNotImplemented: string;
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whySqlFileIsNotCreated: string;
  whySupabaseStorageIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  whyRepositoryIsNotCreated: string;
  whyApprovalIsNotOverclaimed: string;
  expectedSprint40Path: string;
};

// Re-exported so callers of this module never need to import the Sprint 38R types directly just to pass a
// `DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult`-shaped value in.
export type { DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult };
