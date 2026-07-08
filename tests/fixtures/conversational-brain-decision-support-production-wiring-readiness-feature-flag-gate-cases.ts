/**
 * Sprint 37R — Decision Support Production Wiring Readiness / Feature Flag Gate: fixtures.
 *
 * Scenario descriptors used by
 * `tests/playbook-engine-conversation-decision-support-production-wiring-readiness-feature-flag-gate.test.mjs`.
 * Each entry documents one behavior this sprint must exhibit. Cases that exercise a real readiness gate
 * case evaluation carry a `sourceAdapterKind` — one of the five Sprint 36R adapter kinds
 * (`clarification_gate_adapter`, `route_preservation_adapter`, `unsupported_boundary_adapter`,
 * `shadow_only_adapter`, `blocked_unsafe_adapter`) — that the test file uses to synthesize a minimal
 * `DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult`-shaped object (since the real Sprint
 * 18R corpus only ever produces `clarification_gate_adapter`/`route_preservation_adapter` cases) before
 * feeding it through `evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase()`. Negative
 * synthetic scenarios are driven by hardcoded per-id mutations in the test file itself, mirroring the
 * Sprint 36R fixture/test convention in this package.
 *
 * This fixture never imports from `src/`, and is never imported by production code — it exists only for
 * this sprint's own test suite.
 */

export type DecisionSupportProductionWiringReadinessFeatureFlagGateFixtureCase = {
  id: string;
  scenario: string;
  gateKind: string;
  expectedQaStatus: string;
  expectedRiskLevel: string;
  expectedGateAccepted: boolean;
  expectedFeatureFlagContractStatus: string;
  expectedProductionWiringContractStatus: string;
  expectedRollbackContractStatus: string;
  expectedGovernanceChecklistStatus: string;
  expectedSafeForDefaultOffFeatureFlagImplementationShell: boolean;
  expectedSafeForUserVisibleOutputNow: boolean;
  expectedSafeForProduction: boolean;
  expectedViolations: string[];
  notes: string;
  /** Present only for scenarios that build/evaluate a real synthetic gate case. */
  sourceAdapterKind?: "clarification_gate_adapter" | "route_preservation_adapter" | "unsupported_boundary_adapter" | "shadow_only_adapter" | "blocked_unsafe_adapter";
  /** Present only for the fifteen "attempt to enable X blocked" config scenarios. */
  configOverrideField?:
    | "allowProductionWiring"
    | "allowRouterChange"
    | "allowComposerChange"
    | "allowEndpointChange"
    | "allowFeatureFlagImplementation"
    | "allowFeatureFlagActivation"
    | "allowFeatureFlagRuntimeRead"
    | "allowUserVisibleOutput"
    | "allowRealPersistence"
    | "allowDbWrite"
    | "allowSupabaseWrite"
    | "allowExternalCalls"
    | "allowActionExecution"
    | "allowTaskCreation"
    | "allowEmailDraftCreation";
};

const PASS_COMMON = {
  expectedQaStatus: "pass",
  expectedRiskLevel: "low",
  expectedGateAccepted: true,
  expectedFeatureFlagContractStatus: "ready",
  expectedProductionWiringContractStatus: "ready",
  expectedRollbackContractStatus: "ready",
  expectedGovernanceChecklistStatus: "prepared",
  expectedSafeForDefaultOffFeatureFlagImplementationShell: true,
  expectedSafeForUserVisibleOutputNow: false,
  expectedSafeForProduction: false,
  expectedViolations: [] as string[],
};

const CONFIG_NA_COMMON = {
  gateKind: "n/a",
  ...PASS_COMMON,
};

export const DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_CASES: DecisionSupportProductionWiringReadinessFeatureFlagGateFixtureCase[] = [
  // ─── Config: default strict (1) ─────────────────────────────────────────────────────
  {
    id: "gate-config-default-strict",
    scenario: "config default strict",
    ...CONFIG_NA_COMMON,
    notes:
      "createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig() with no overrides must return profile " +
      "strict_production_wiring_readiness_feature_flag_gate, mode readiness_gate_only, readinessOnly true, every allow* field false, and every " +
      "require* field true.",
  },

  // ─── Config: attempts to enable forbidden actions are blocked (15) ─────────────────
  {
    id: "gate-config-block-production-wiring",
    scenario: "attempts to enable production wiring blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowProductionWiring: true } must still yield allowProductionWiring: false.",
    configOverrideField: "allowProductionWiring",
  },
  {
    id: "gate-config-block-router-change",
    scenario: "attempts to enable router change blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowRouterChange: true } must still yield allowRouterChange: false.",
    configOverrideField: "allowRouterChange",
  },
  {
    id: "gate-config-block-composer-change",
    scenario: "attempts to enable composer change blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowComposerChange: true } must still yield allowComposerChange: false.",
    configOverrideField: "allowComposerChange",
  },
  {
    id: "gate-config-block-endpoint-change",
    scenario: "attempts to enable endpoint change blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowEndpointChange: true } must still yield allowEndpointChange: false.",
    configOverrideField: "allowEndpointChange",
  },
  {
    id: "gate-config-block-feature-flag-implementation",
    scenario: "attempts to enable feature flag implementation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowFeatureFlagImplementation: true } must still yield allowFeatureFlagImplementation: false.",
    configOverrideField: "allowFeatureFlagImplementation",
  },
  {
    id: "gate-config-block-feature-flag-activation",
    scenario: "attempts to enable feature flag activation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowFeatureFlagActivation: true } must still yield allowFeatureFlagActivation: false.",
    configOverrideField: "allowFeatureFlagActivation",
  },
  {
    id: "gate-config-block-feature-flag-runtime-read",
    scenario: "attempts to enable feature flag runtime read blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowFeatureFlagRuntimeRead: true } must still yield allowFeatureFlagRuntimeRead: false.",
    configOverrideField: "allowFeatureFlagRuntimeRead",
  },
  {
    id: "gate-config-block-user-visible-output",
    scenario: "attempts to enable user visible output blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowUserVisibleOutput: true } must still yield allowUserVisibleOutput: false.",
    configOverrideField: "allowUserVisibleOutput",
  },
  {
    id: "gate-config-block-real-persistence",
    scenario: "attempts to enable real persistence blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowRealPersistence: true } must still yield allowRealPersistence: false.",
    configOverrideField: "allowRealPersistence",
  },
  {
    id: "gate-config-block-db-write",
    scenario: "attempts to enable DB write blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowDbWrite: true } must still yield allowDbWrite: false.",
    configOverrideField: "allowDbWrite",
  },
  {
    id: "gate-config-block-supabase-write",
    scenario: "attempts to enable Supabase write blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowSupabaseWrite: true } must still yield allowSupabaseWrite: false.",
    configOverrideField: "allowSupabaseWrite",
  },
  {
    id: "gate-config-block-external-calls",
    scenario: "attempts to enable external calls blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowExternalCalls: true } must still yield allowExternalCalls: false.",
    configOverrideField: "allowExternalCalls",
  },
  {
    id: "gate-config-block-action-execution",
    scenario: "attempts to enable action execution blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowActionExecution: true } must still yield allowActionExecution: false.",
    configOverrideField: "allowActionExecution",
  },
  {
    id: "gate-config-block-task-creation",
    scenario: "attempts to enable task creation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowTaskCreation: true } must still yield allowTaskCreation: false.",
    configOverrideField: "allowTaskCreation",
  },
  {
    id: "gate-config-block-email-draft-creation",
    scenario: "attempts to enable email draft creation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowEmailDraftCreation: true } must still yield allowEmailDraftCreation: false.",
    configOverrideField: "allowEmailDraftCreation",
  },

  // ─── Feature flag contract (4) ───────────────────────────────────────────────────────
  {
    id: "gate-feature-flag-contract-ready",
    scenario: "feature flag contract default ready",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportFeatureFlagGateContract() must return status ready with score >= 85 and proposedFeatureFlagKey pmfreak.decisionSupport.defaultOffRouteComposerAdapter.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-feature-flag-contract-default-off-required",
    scenario: "feature flag contract default-off required",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportFeatureFlagGateContract() must return defaultValueMustBe: false always.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-feature-flag-contract-no-runtime-read-now",
    scenario: "feature flag contract no runtime read now",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportFeatureFlagGateContract() must return featureFlagRuntimeReadNow: false always.",
    sourceAdapterKind: "route_preservation_adapter",
  },
  {
    id: "gate-feature-flag-contract-no-implementation-now",
    scenario: "feature flag contract no implementation now",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportFeatureFlagGateContract() must return featureFlagImplementedNow: false and featureFlagActiveNow: false always.",
    sourceAdapterKind: "route_preservation_adapter",
  },

  // ─── Production wiring contract (4) ──────────────────────────────────────────────────
  {
    id: "gate-production-wiring-contract-ready",
    scenario: "production wiring contract ready",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportProductionWiringReadinessContract() must return status ready with score >= 85.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-production-wiring-contract-no-router-import-now",
    scenario: "production wiring contract no router import now",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportProductionWiringReadinessContract() must return routerImportAllowedNow: false and routerChangeAllowedNow: false always.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-production-wiring-contract-no-composer-import-now",
    scenario: "production wiring contract no composer import now",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportProductionWiringReadinessContract() must return composerImportAllowedNow: false and composerChangeAllowedNow: false always.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-production-wiring-contract-no-endpoint-import-now",
    scenario: "production wiring contract no endpoint import now",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportProductionWiringReadinessContract() must return endpointImportAllowedNow: false and endpointChangeAllowedNow: false always.",
    sourceAdapterKind: "clarification_gate_adapter",
  },

  // ─── Rollback contract (3) ────────────────────────────────────────────────────────────
  {
    id: "gate-rollback-contract-ready",
    scenario: "rollback contract ready",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportRollbackReadinessContract() must return status ready with rollbackScore >= 85.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-rollback-contract-no-data-migration-required",
    scenario: "rollback contract no data migration required",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportRollbackReadinessContract() must return rollbackRequiresNoDataMigration: true and rollbackRequiresNoDataCleanup: true always.",
    sourceAdapterKind: "route_preservation_adapter",
  },
  {
    id: "gate-rollback-contract-no-persistent-state-dependency",
    scenario: "rollback contract no persistent state dependency",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportRollbackReadinessContract() must return rollbackRequiresNoPersistentStateDependency: true and rollbackRequiresNoExternalSideEffectsCleanup: true always.",
    sourceAdapterKind: "route_preservation_adapter",
  },

  // ─── Governance checklist (3) ────────────────────────────────────────────────────────
  {
    id: "gate-governance-checklist-prepared",
    scenario: "governance checklist prepared",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportGovernanceApprovalChecklist() must return status prepared with checklistScore >= 80 and all ten requiredApprovalItems present.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-governance-approval-not-granted-now",
    scenario: "governance approval not granted now",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportGovernanceApprovalChecklist() must return governanceApprovalGrantedNow: false always.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-governance-approval-not-overclaimed",
    scenario: "governance approval not overclaimed",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportGovernanceApprovalChecklist() must return approvalStateOverclaimed: false always, with pendingFutureApprovalItems non-empty.",
    sourceAdapterKind: "clarification_gate_adapter",
  },

  // ─── Gate kind readiness (5) ──────────────────────────────────────────────────────────
  {
    id: "gate-kind-clarification-readiness",
    scenario: "gate clarification readiness",
    gateKind: "clarification_gate_readiness",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase() for a clarification_gate_adapter case must produce gateKind clarification_gate_readiness and gateAccepted true.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-kind-route-preservation-readiness",
    scenario: "gate route preservation readiness",
    gateKind: "route_preservation_readiness",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase() for a route_preservation_adapter case must produce gateKind route_preservation_readiness and gateAccepted true.",
    sourceAdapterKind: "route_preservation_adapter",
  },
  {
    id: "gate-kind-unsupported-readiness",
    scenario: "gate unsupported readiness",
    gateKind: "unsupported_boundary_readiness",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase() for an unsupported_boundary_adapter case must produce gateKind unsupported_boundary_readiness and gateAccepted true.",
    sourceAdapterKind: "unsupported_boundary_adapter",
  },
  {
    id: "gate-kind-shadow-only-readiness",
    scenario: "gate shadow-only readiness",
    gateKind: "shadow_only_readiness",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase() for a shadow_only_adapter case must produce gateKind shadow_only_readiness and gateAccepted true.",
    sourceAdapterKind: "shadow_only_adapter",
  },
  {
    id: "gate-kind-blocked-unsafe-readiness",
    scenario: "gate blocked unsafe readiness",
    gateKind: "blocked_unsafe_readiness",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase() for a blocked_unsafe_adapter case must produce gateKind blocked_unsafe_readiness and gateAccepted true.",
    sourceAdapterKind: "blocked_unsafe_adapter",
  },

  // ─── Safety confirmations (4) ────────────────────────────────────────────────────────
  {
    id: "gate-no-visibility-attempt",
    scenario: "no visibility attempt",
    gateKind: "clarification_gate_readiness",
    ...PASS_COMMON,
    notes: "A valid gate case must report noVisibilityAttemptPassed: true and userVisibleOutputAllowedNow: false.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-no-production-eligibility",
    scenario: "no production eligibility",
    gateKind: "clarification_gate_readiness",
    ...PASS_COMMON,
    notes: "A valid gate case must report noProductionEligibilityPassed: true and safeForProduction: false.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-no-leakage",
    scenario: "no leakage",
    gateKind: "clarification_gate_readiness",
    ...PASS_COMMON,
    notes: "A valid gate case must report noLeaksPassed: true.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-no-side-effects",
    scenario: "no side effects",
    gateKind: "clarification_gate_readiness",
    ...PASS_COMMON,
    notes: "A valid gate case must report noSideEffectsPassed: true.",
    sourceAdapterKind: "clarification_gate_adapter",
  },

  // ─── Negative synthetic scenarios (13) ───────────────────────────────────────────────
  {
    id: "gate-negative-feature-flag-contract-missing",
    scenario: "negative feature flag contract missing",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "fail",
    expectedRiskLevel: "high",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "not_ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_contract_missing"],
    notes: "Mutating the feature flag contract's status to not_ready must fail featureFlagContractPassed and reject the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-feature-flag-active-now",
    scenario: "negative feature flag active now",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_activation_path_enabled"],
    notes: "Mutating featureFlagContract.featureFlagActiveNow to true must fail featureFlagContractPassed and noProductionEligibilityPassed, and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-runtime-read-now",
    scenario: "negative runtime read now",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_runtime_read_attempted"],
    notes: "Mutating featureFlagContract.featureFlagRuntimeReadNow to true must fail featureFlagContractPassed and noProductionEligibilityPassed, and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-production-wiring-allowed-now",
    scenario: "negative production wiring allowed now",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "not_ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["production_eligible_now"],
    notes: "Mutating productionWiringContract.productionWiringImplementedNow to true must fail noProductionEligibilityPassed and reject the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-router-change-allowed-now",
    scenario: "negative router change allowed now",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "not_ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["router_wiring_allowed"],
    notes: "Mutating productionWiringContract.routerChangeAllowedNow to true must fail productionWiringContractPassed and noProductionEligibilityPassed, and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-composer-change-allowed-now",
    scenario: "negative composer change allowed now",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "not_ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["composer_wiring_allowed"],
    notes: "Mutating productionWiringContract.composerChangeAllowedNow to true must fail productionWiringContractPassed and noProductionEligibilityPassed, and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-endpoint-change-allowed-now",
    scenario: "negative endpoint change allowed now",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "not_ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["endpoint_wiring_allowed"],
    notes: "Mutating productionWiringContract.endpointChangeAllowedNow to true must fail productionWiringContractPassed and noProductionEligibilityPassed, and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-governance-approval-overclaimed",
    scenario: "negative governance approval overclaimed",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["approval_state_overclaimed"],
    notes: "Mutating governanceChecklist.approvalStateOverclaimed to true must fail noApprovalOverclaimPassed and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-user-visible-output-allowed",
    scenario: "negative user visible output allowed",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["user_visible_output_allowed"],
    notes: "Mutating the source adapter case's composerResult.payload.userVisibleNow to true must fail noVisibilityAttemptPassed and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-real-persistence-allowed",
    scenario: "negative real persistence allowed",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["real_persistence_allowed"],
    notes: "Mutating the source adapter case's composerResult.payload.persistedNow to true must fail noSideEffectsPassed and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-raw-input-leak",
    scenario: "negative raw input leak",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["raw_input_leak"],
    notes: "Mutating a payload section's containsRawInput to true must fail noLeaksPassed and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-pii-leak",
    scenario: "negative PII leak",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["pii_leak"],
    notes: "Mutating a payload section's containsPii to true must fail noLeaksPassed and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },
  {
    id: "gate-negative-side-effect-risk",
    scenario: "negative side effect risk",
    gateKind: "clarification_gate_readiness",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedGateAccepted: false,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["side_effect_risk"],
    notes: "Mutating the source adapter case's composerResult.dbWriteAttempted and supabaseWriteAttempted to true must fail noSideEffectsPassed and block the gate.",
    sourceAdapterKind: "clarification_gate_adapter",
  },

  // ─── Summary / decision (3) ──────────────────────────────────────────────────────────
  {
    id: "gate-summary-pass",
    scenario: "summary pass",
    gateKind: "n/a",
    expectedQaStatus: "pass",
    expectedRiskLevel: "low",
    expectedGateAccepted: true,
    expectedFeatureFlagContractStatus: "ready",
    expectedProductionWiringContractStatus: "ready",
    expectedRollbackContractStatus: "ready",
    expectedGovernanceChecklistStatus: "prepared",
    expectedSafeForDefaultOffFeatureFlagImplementationShell: true,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: [],
    notes:
      "summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate() over the full Sprint 18R corpus (via " +
      "runDecisionSupportProductionWiringReadinessFeatureFlagGate with DECISION_CLARIFICATION_CASES) must report qaPassCount === totalCases, " +
      "qaWarningCount/qaFailCount/qaBlockedCount === 0.",
  },
  {
    id: "gate-decision-ready-for-default-off-feature-flag-implementation-shell",
    scenario: "decision ready_for_default_off_feature_flag_implementation_shell",
    gateKind: "n/a",
    ...PASS_COMMON,
    notes:
      "summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate() over the full Sprint 18R corpus must report decision: " +
      "ready_for_default_off_feature_flag_implementation_shell.",
  },
  {
    id: "gate-recommended-sprint-38r",
    scenario: "recommended Sprint 38R",
    gateKind: "n/a",
    ...PASS_COMMON,
    notes:
      "summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate() over the full Sprint 18R corpus must report recommendedNextSprint: " +
      '"Sprint 38R — Default-Off Feature Flag Implementation Shell".',
  },
];
