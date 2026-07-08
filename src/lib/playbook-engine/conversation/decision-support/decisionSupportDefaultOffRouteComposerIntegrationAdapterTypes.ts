import type { DecisionSupportUserVisibleDryRunEvaluationCaseResult } from "./decisionSupportUserVisibleDryRunEvaluationHarnessTypes";

/**
 * Sprint 36R — Decision Support Default-Off Route/Composer Integration Adapter: types.
 *
 * Pure type definitions for an offline, deterministic, **default-off** adapter that connects every
 * Sprint 35R-validated preview to a synthetic route guard contract and a synthetic composer guard
 * contract — simulating how a future route/composer wiring would behave without ever touching the real
 * router, composer, endpoint, feature flag, or persistence layer. This module only ever reads
 * already-computed Sprint 18R-35R evaluation results and produces synthetic, internal-only,
 * `defaultOff: true` / `adapterEnabledNow: false` results; it never shows anything to a real user, never
 * persists anything real, and never touches the router, composer, endpoint, or any production handler.
 *
 * See `docs/conversational-brain-decision-support-default-off-route-composer-integration-adapter.md` for
 * the full scope and non-goals.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterProfile = "strict_default_off_route_composer_integration_adapter";

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterMode =
  | "default_off_adapter_only"
  | "isolated_noop_route_simulation"
  | "isolated_noop_composer_simulation"
  | "route_guard_contract_review"
  | "composer_guard_contract_review"
  | "production_wiring_readiness_review";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterDecision =
  | "ready_for_production_wiring_readiness_feature_flag_gate"
  | "continue_default_off_adapter_only"
  | "blocked_by_route_contract_gap"
  | "blocked_by_composer_contract_gap"
  | "blocked_by_default_off_gap"
  | "blocked_by_visibility_risk"
  | "blocked_by_production_wiring_risk"
  | "blocked_by_leakage_or_side_effect_risk";

// ─── Adapter kind ─────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffAdapterKind = "clarification_gate_adapter" | "route_preservation_adapter" | "unsupported_boundary_adapter" | "shadow_only_adapter" | "blocked_unsafe_adapter";

// ─── Route decision ───────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteDecision =
  | "simulate_route_to_clarification_gate"
  | "simulate_preserve_existing_route"
  | "simulate_preserve_unsupported"
  | "simulate_shadow_only"
  | "simulate_block_unsafe";

// ─── Composer decision ────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffComposerDecision =
  | "simulate_composer_internal_preview_payload"
  | "simulate_composer_route_preservation_payload"
  | "simulate_composer_unsupported_boundary_payload"
  | "simulate_composer_shadow_only_payload"
  | "simulate_composer_blocked_payload";

// ─── Adapter status ───────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffAdapterStatus = "accepted" | "rejected" | "blocked";

// ─── Adapter QA status ────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffAdapterQaStatus = "pass" | "warning" | "fail" | "blocked";

// ─── Adapter risk level ───────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffAdapterRiskLevel = "low" | "medium" | "high" | "critical";

// ─── Adapter violation type ───────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffAdapterViolationType =
  | "default_off_disabled"
  | "adapter_enabled_now"
  | "router_wiring_attempted"
  | "composer_wiring_attempted"
  | "endpoint_wiring_attempted"
  | "feature_flag_activation_attempted"
  | "user_visible_output_attempted"
  | "production_wiring_attempted"
  | "real_persistence_attempted"
  | "db_write_attempted"
  | "supabase_write_attempted"
  | "external_call_attempted"
  | "action_execution_attempted"
  | "task_creation_attempted"
  | "email_or_draft_creation_attempted"
  | "raw_input_leak"
  | "full_candidate_leak"
  | "pii_leak"
  | "project_name_leak"
  | "route_contract_gap"
  | "composer_contract_gap"
  | "missing_clarification_gate"
  | "existing_route_not_preserved"
  | "unsupported_not_preserved"
  | "unsafe_adapter_payload";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*`/`adapterEnabledNow` field that could ever enable a real side effect or turn this adapter
 * on is a literal `false` — see `createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig()`,
 * which forces every one of them to `false` regardless of what a caller's overrides object claims,
 * mirroring every prior sprint's config invariant in this package.
 */
export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig = {
  profile: "strict_default_off_route_composer_integration_adapter";
  mode: DecisionSupportDefaultOffRouteComposerIntegrationAdapterMode;
  defaultOff: true;
  adapterEnabledNow: false;
  allowProductionWiring: false;
  allowRouterChange: false;
  allowComposerChange: false;
  allowEndpointChange: false;
  allowFeatureFlagImplementation: false;
  allowFeatureFlagActivation: false;
  allowUserVisibleOutput: false;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  allowActionExecution: false;
  allowTaskCreation: false;
  allowEmailDraftCreation: false;
  requireDryRunHarnessPass: true;
  requireDefaultOff: true;
  requireNoOpIsolation: true;
  requireRouteGuardContract: true;
  requireComposerGuardContract: true;
  requireNoVisibilityAttempt: true;
  requireNoLeakage: true;
  requireNoSideEffects: true;
  requireNoProductionEligibility: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Route guard contract ─────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteGuardContract = {
  contractId: string;
  adapterKind: DecisionSupportDefaultOffAdapterKind;
  sourcePreviewKind: string;
  routeDecision: DecisionSupportDefaultOffRouteDecision;
  defaultOff: true;
  isolatedNoOpAdapter: true;
  routeWiringActiveNow: false;
  productionRouteChangeAllowedNow: false;
  requiresClarificationGate: boolean;
  preservesExistingRoute: boolean;
  preservesUnsupportedBoundary: boolean;
  keepsShadowOnly: boolean;
  blocksUnsafe: boolean;
  blocksDirectDecision: true;
  blocksUserVisibleOutput: true;
  blocksProductionEligibility: true;
  routeGuardScore: number;
  rationale: string[];
};

// ─── Composer guard contract ──────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffComposerGuardContract = {
  contractId: string;
  adapterKind: DecisionSupportDefaultOffAdapterKind;
  sourcePreviewKind: string;
  composerDecision: DecisionSupportDefaultOffComposerDecision;
  defaultOff: true;
  isolatedNoOpAdapter: true;
  composerWiringActiveNow: false;
  productionComposerChangeAllowedNow: false;
  internalPayloadOnly: true;
  userVisibleNow: false;
  persistedNow: false;
  executableNow: false;
  blocksDirectDecision: true;
  blocksExecution: true;
  blocksPersistence: true;
  blocksExternalCalls: true;
  blocksProductionEligibility: true;
  composerGuardScore: number;
  rationale: string[];
};

// ─── Composer payload section / payload ──────────────────────────────────────────────

export type DecisionSupportDefaultOffComposerPayloadSection = {
  sectionId: string;
  kind: string;
  title: string;
  body: string;
  order: number;
  internalOnly: true;
  userVisibleNow: false;
  containsRawInput: false;
  containsFullCandidate: false;
  containsPii: false;
  containsProjectNameRaw: false;
  containsExecutableInstruction: false;
  containsPersistenceInstruction: false;
  warnings: string[];
};

export type DecisionSupportDefaultOffComposerPayload = {
  payloadId: string;
  sourceCaseId: string;
  sourcePreviewId: string;
  adapterKind: DecisionSupportDefaultOffAdapterKind;
  composerDecision: DecisionSupportDefaultOffComposerDecision;
  generatedForAdapterEvaluationOnly: true;
  internalPayloadOnly: true;
  defaultOff: true;
  adapterEnabledNow: false;
  userVisibleNow: false;
  persistedNow: false;
  executableNow: false;
  externalSideEffectsAllowed: false;
  productionEligibleNow: false;
  sections: DecisionSupportDefaultOffComposerPayloadSection[];
  warnings: string[];
};

// ─── Route adapter result ─────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteAdapterResult = {
  caseId: string;
  sourcePreviewId: string;
  sourcePreviewKind: string;
  adapterKind: DecisionSupportDefaultOffAdapterKind;
  routeDecision: DecisionSupportDefaultOffRouteDecision;
  routeGuardContract: DecisionSupportDefaultOffRouteGuardContract;
  routeGuardPassed: boolean;
  defaultOffPassed: boolean;
  isolatedNoOpPassed: boolean;
  safeForComposerAdapterSimulation: boolean;
  routeWiringActiveNow: false;
  routerChangeAttempted: false;
  productionWiringAttempted: false;
  userVisibleOutputAttempted: false;
  warnings: string[];
};

// ─── Composer adapter result ──────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffComposerAdapterResult = {
  caseId: string;
  sourcePreviewId: string;
  adapterKind: DecisionSupportDefaultOffAdapterKind;
  composerDecision: DecisionSupportDefaultOffComposerDecision;
  composerGuardContract: DecisionSupportDefaultOffComposerGuardContract;
  payload: DecisionSupportDefaultOffComposerPayload;
  composerGuardPassed: boolean;
  defaultOffPassed: boolean;
  isolatedNoOpPassed: boolean;
  safeForDefaultOffAdapter: boolean;
  composerWiringActiveNow: false;
  composerChangeAttempted: false;
  endpointChangeAttempted: false;
  featureFlagAttempted: false;
  userVisibleOutputAttempted: false;
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  actionExecutionAttempted: false;
  warnings: string[];
};

// ─── Adapter validation result ────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteComposerAdapterValidationResult = {
  caseId: string;
  valid: boolean;
  status: DecisionSupportDefaultOffAdapterStatus;
  qaStatus: DecisionSupportDefaultOffAdapterQaStatus;
  riskLevel: DecisionSupportDefaultOffAdapterRiskLevel;
  violations: DecisionSupportDefaultOffAdapterViolationType[];
  routeGuardPassed: boolean;
  composerGuardPassed: boolean;
  defaultOffPassed: boolean;
  isolatedNoOpPassed: boolean;
  noVisibilityAttemptPassed: boolean;
  noProductionEligibilityPassed: boolean;
  noLeaksPassed: boolean;
  noSideEffectsPassed: boolean;
  safeForProductionWiringReadinessReview: boolean;
  recommendation: string;
};

// ─── Adapter case result ──────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult = {
  caseId: string;
  sourcePreviewId: string;
  sourcePreviewKind: string;
  adapterKind: DecisionSupportDefaultOffAdapterKind;
  routeResult: DecisionSupportDefaultOffRouteAdapterResult;
  composerResult: DecisionSupportDefaultOffComposerAdapterResult;
  validation: DecisionSupportDefaultOffRouteComposerAdapterValidationResult;
  adapterAccepted: boolean;
  adapterRejected: boolean;
  adapterBlocked: boolean;
  safeForProductionWiringReadinessReview: boolean;
  safeForUserVisibleOutputNow: false;
  safeForProduction: false;
  warnings: string[];
};

// ─── Adapter options / result ─────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterOptions = {
  config?: Partial<DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig>;
  /** Sprint 35R user-visible dry run evaluation harness result to reuse — if omitted, a fresh one is
   * built from `cases`/`now`. */
  harness?: import("./decisionSupportUserVisibleDryRunEvaluationHarnessTypes").DecisionSupportUserVisibleDryRunEvaluationHarnessResult;
  /** Corpus to run the underlying Sprint 35R harness over — defaults to that harness's own small
   * self-contained synthetic corpus when omitted and `harness` is not supplied. Callers who want the full
   * Sprint 18R corpus's documented numbers pass `DECISION_CLARIFICATION_CASES` explicitly. */
  cases?: import("../classifier/decisionClarificationArchitectureReview").DecisionClarificationCase[];
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult = {
  config: DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig;
  /** Sprint 35R user-visible dry run evaluation harness result, reused (not re-derived). */
  harness: import("./decisionSupportUserVisibleDryRunEvaluationHarnessTypes").DecisionSupportUserVisibleDryRunEvaluationHarnessResult;
  harnessSummary: import("./decisionSupportUserVisibleDryRunEvaluationHarnessTypes").DecisionSupportUserVisibleDryRunEvaluationHarnessSummary;
  caseResults: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult[];
  allowedNextActions: string[];
  prohibitedActions: string[];
  warnings: string[];
};

// ─── Summary ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummaryOptions = {
  /** Only used when `adapterOrCaseResults` is a bare case-results array — for a full adapter result, the
   * Sprint 35R decision is read from `harnessSummary.decision` directly. */
  sprint35HarnessDecision?: string;
};

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummary = {
  totalCases: number;
  adapterEvaluatedCount: number;
  adapterAcceptedCount: number;
  adapterRejectedCount: number;
  adapterBlockedCount: number;
  clarificationGateAdapterCount: number;
  routePreservationAdapterCount: number;
  unsupportedBoundaryAdapterCount: number;
  shadowOnlyAdapterCount: number;
  blockedUnsafeAdapterCount: number;
  qaPassCount: number;
  qaWarningCount: number;
  qaFailCount: number;
  qaBlockedCount: number;
  safeForProductionWiringReadinessReviewCount: number;
  safeForUserVisibleOutputNowCount: number;
  safeForProductionCount: number;
  routeGuardPassedCount: number;
  composerGuardPassedCount: number;
  defaultOffPassedCount: number;
  isolatedNoOpPassedCount: number;
  noVisibilityAttemptPassedCount: number;
  noProductionEligibilityPassedCount: number;
  noLeaksPassedCount: number;
  noSideEffectsPassedCount: number;
  averageRouteGuardScore: number;
  averageComposerGuardScore: number;
  minRouteGuardScore: number;
  minComposerGuardScore: number;
  violationCount: number;
  criticalViolationCount: number;
  routerChangeAttemptedCount: number;
  composerChangeAttemptedCount: number;
  endpointChangeAttemptedCount: number;
  featureFlagAttemptedCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  actionExecutionAttemptedCount: number;
  taskCreationAttemptedCount: number;
  emailDraftCreationAttemptedCount: number;
  decision: DecisionSupportDefaultOffRouteComposerIntegrationAdapterDecision;
  recommendedNextSprint: string;
  representativeAcceptedAdapters: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult[];
  rejectedAdapters: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult[];
  blockedAdapters: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult[];
  warnings: string[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteComposerIntegrationAdapterExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  adapterProfile: string;
  adapterModes: string[];
  adapterKindRules: string[];
  routeGuardContractRules: string[];
  composerGuardContractRules: string[];
  routeAdapterSimulationRules: string[];
  composerAdapterSimulationRules: string[];
  adapterValidationRules: string[];
  adapterRunRules: string[];
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
  expectedSprint37Path: string;
};

// Re-exported so callers of this module never need to import the Sprint 35R types directly just to pass
// a `DecisionSupportUserVisibleDryRunEvaluationCaseResult`-shaped value in.
export type { DecisionSupportUserVisibleDryRunEvaluationCaseResult };
