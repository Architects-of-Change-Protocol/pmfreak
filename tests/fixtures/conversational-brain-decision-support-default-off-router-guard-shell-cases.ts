/**
 * Sprint 39R — Decision Support Default-Off Router Guard Shell: fixtures.
 *
 * Scenario descriptors used by
 * `tests/playbook-engine-conversation-decision-support-default-off-router-guard-shell.test.mjs`. Each entry
 * documents one behavior this sprint must exhibit. Cases that exercise a real router guard case evaluation
 * carry a `sourceShellKind` — one of the five Sprint 38R feature flag shell kinds
 * (`clarification_gate_flag_shell`, `route_preservation_flag_shell`, `unsupported_boundary_flag_shell`,
 * `shadow_only_flag_shell`, `blocked_unsafe_flag_shell`) — that the test file uses to synthesize a minimal
 * `DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult`-shaped object (since the real Sprint
 * 18R corpus only ever produces `clarification_gate_flag_shell`/`route_preservation_flag_shell` cases)
 * before feeding it through `evaluateDecisionSupportDefaultOffRouterGuardShellCase()`. Negative synthetic
 * scenarios are driven by hardcoded per-id mutations/force-options in the test file itself, mirroring the
 * Sprint 38R fixture/test convention in this package.
 *
 * This fixture never imports from `src/`, and is never imported by production code — it exists only for
 * this sprint's own test suite.
 */

export type DecisionSupportDefaultOffRouterGuardShellFixtureCase = {
  id: string;
  scenario: string;
  routerGuardShellKind: string;
  expectedQaStatus: string;
  expectedRiskLevel: string;
  expectedRouterGuardAccepted: boolean;
  expectedLiveRouteDecision: string;
  expectedFutureRouteIntent: string;
  expectedSafeForDefaultOffComposerGuardShell: boolean;
  expectedSafeForUserVisibleOutputNow: boolean;
  expectedSafeForProduction: boolean;
  expectedViolations: string[];
  notes: string;
  /** Present only for scenarios that build/evaluate a real synthetic router guard case. */
  sourceShellKind?: "clarification_gate_flag_shell" | "route_preservation_flag_shell" | "unsupported_boundary_flag_shell" | "shadow_only_flag_shell" | "blocked_unsafe_flag_shell";
  /** Present only for the seventeen "attempt to enable X blocked" config scenarios. */
  configOverrideField?:
    | "allowProductionRouterGuardImplementation"
    | "allowRouterImport"
    | "allowRouterRuntimeWiring"
    | "allowRouteMutation"
    | "allowFeatureFlagRuntimeRead"
    | "allowFeatureFlagActivation"
    | "allowProductionWiring"
    | "allowComposerChange"
    | "allowEndpointChange"
    | "allowUserVisibleOutput"
    | "allowRealPersistence"
    | "allowDbWrite"
    | "allowSupabaseWrite"
    | "allowExternalCalls"
    | "allowActionExecution"
    | "allowTaskCreation"
    | "allowEmailDraftCreation";
  /** Present only for feature-flag-state-reference negative scenarios. */
  stateOverrideField?: string;
  /** Present only for route-evaluation negative scenarios. */
  routeOverrideField?: string;
};

const PASS_COMMON = {
  expectedQaStatus: "pass",
  expectedRiskLevel: "low",
  expectedRouterGuardAccepted: true,
  expectedSafeForDefaultOffComposerGuardShell: true,
  expectedSafeForUserVisibleOutputNow: false,
  expectedSafeForProduction: false,
  expectedViolations: [] as string[],
};

const CONFIG_NA_COMMON = {
  routerGuardShellKind: "n/a",
  expectedLiveRouteDecision: "n/a",
  expectedFutureRouteIntent: "n/a",
  ...PASS_COMMON,
};

export const DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_CASES: DecisionSupportDefaultOffRouterGuardShellFixtureCase[] = [
  // ─── Config: default strict (1) ─────────────────────────────────────────────────────
  {
    id: "router-guard-config-default-strict",
    scenario: "config default strict",
    ...CONFIG_NA_COMMON,
    notes:
      "createDecisionSupportDefaultOffRouterGuardShellConfig() with no overrides must return profile strict_default_off_router_guard_shell, mode " +
      "router_guard_shell_only, shellOnly/noOpRouterGuard/defaultOff true, proposedFeatureFlagKey pmfreak.decisionSupport.defaultOffRouteComposerAdapter, " +
      "every allow* field false, and every require* field true.",
  },

  // ─── Config: attempts to enable forbidden actions are blocked (17) ─────────────────
  {
    id: "router-guard-config-block-production-router-guard-implementation",
    scenario: "attempts to enable production router guard implementation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowProductionRouterGuardImplementation: true } must still yield allowProductionRouterGuardImplementation: false.",
    configOverrideField: "allowProductionRouterGuardImplementation",
  },
  {
    id: "router-guard-config-block-router-import",
    scenario: "attempts to enable router import blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowRouterImport: true } must still yield allowRouterImport: false.",
    configOverrideField: "allowRouterImport",
  },
  {
    id: "router-guard-config-block-router-runtime-wiring",
    scenario: "attempts to enable router runtime wiring blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowRouterRuntimeWiring: true } must still yield allowRouterRuntimeWiring: false.",
    configOverrideField: "allowRouterRuntimeWiring",
  },
  {
    id: "router-guard-config-block-route-mutation",
    scenario: "attempts to enable route mutation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowRouteMutation: true } must still yield allowRouteMutation: false.",
    configOverrideField: "allowRouteMutation",
  },
  {
    id: "router-guard-config-block-feature-flag-runtime-read",
    scenario: "attempts to enable feature flag runtime read blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowFeatureFlagRuntimeRead: true } must still yield allowFeatureFlagRuntimeRead: false.",
    configOverrideField: "allowFeatureFlagRuntimeRead",
  },
  {
    id: "router-guard-config-block-feature-flag-activation",
    scenario: "attempts to enable feature flag activation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowFeatureFlagActivation: true } must still yield allowFeatureFlagActivation: false.",
    configOverrideField: "allowFeatureFlagActivation",
  },
  {
    id: "router-guard-config-block-production-wiring",
    scenario: "attempts to enable production wiring blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowProductionWiring: true } must still yield allowProductionWiring: false.",
    configOverrideField: "allowProductionWiring",
  },
  {
    id: "router-guard-config-block-composer-change",
    scenario: "attempts to enable composer change blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowComposerChange: true } must still yield allowComposerChange: false.",
    configOverrideField: "allowComposerChange",
  },
  {
    id: "router-guard-config-block-endpoint-change",
    scenario: "attempts to enable endpoint change blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowEndpointChange: true } must still yield allowEndpointChange: false.",
    configOverrideField: "allowEndpointChange",
  },
  {
    id: "router-guard-config-block-user-visible-output",
    scenario: "attempts to enable user visible output blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowUserVisibleOutput: true } must still yield allowUserVisibleOutput: false.",
    configOverrideField: "allowUserVisibleOutput",
  },
  {
    id: "router-guard-config-block-real-persistence",
    scenario: "attempts to enable real persistence blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowRealPersistence: true } must still yield allowRealPersistence: false.",
    configOverrideField: "allowRealPersistence",
  },
  {
    id: "router-guard-config-block-db-write",
    scenario: "attempts to enable DB write blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowDbWrite: true } must still yield allowDbWrite: false.",
    configOverrideField: "allowDbWrite",
  },
  {
    id: "router-guard-config-block-supabase-write",
    scenario: "attempts to enable Supabase write blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowSupabaseWrite: true } must still yield allowSupabaseWrite: false.",
    configOverrideField: "allowSupabaseWrite",
  },
  {
    id: "router-guard-config-block-external-calls",
    scenario: "attempts to enable external calls blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowExternalCalls: true } must still yield allowExternalCalls: false.",
    configOverrideField: "allowExternalCalls",
  },
  {
    id: "router-guard-config-block-action-execution",
    scenario: "attempts to enable action execution blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowActionExecution: true } must still yield allowActionExecution: false.",
    configOverrideField: "allowActionExecution",
  },
  {
    id: "router-guard-config-block-task-creation",
    scenario: "attempts to enable task creation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowTaskCreation: true } must still yield allowTaskCreation: false.",
    configOverrideField: "allowTaskCreation",
  },
  {
    id: "router-guard-config-block-email-draft-creation",
    scenario: "attempts to enable email draft creation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowEmailDraftCreation: true } must still yield allowEmailDraftCreation: false.",
    configOverrideField: "allowEmailDraftCreation",
  },

  // ─── Router guard definition correctness (4) ────────────────────────────────────────
  {
    id: "router-guard-definition-key-preserved",
    scenario: "router guard definition key preserved",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffRouterGuardShellDefinition() must preserve key pmfreak.decisionSupport.defaultOffRouteComposerAdapter from Sprint 38R's feature flag shell definition.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-definition-no-production-guard-implemented",
    scenario: "router guard definition no production guard implemented",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffRouterGuardShellDefinition() must return productionRouterGuardImplementedNow: false always.",
    sourceShellKind: "route_preservation_flag_shell",
  },
  {
    id: "router-guard-definition-no-router-import-allowed",
    scenario: "router guard definition no router import allowed",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffRouterGuardShellDefinition() must return routerImportAllowedNow: false and routerRuntimeWiringActiveNow: false always.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-definition-no-route-mutation-allowed",
    scenario: "router guard definition no route mutation allowed",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffRouterGuardShellDefinition() must return routeMutationAllowedNow: false and featureFlagEnabledNow: false always.",
    sourceShellKind: "route_preservation_flag_shell",
  },

  // ─── Feature flag state reference (3) ───────────────────────────────────────────────
  {
    id: "router-guard-state-reference-disabled",
    scenario: "feature flag state reference disabled",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference() must return featureFlagState: disabled and featureFlagEnabled: false by default.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-state-reference-static-default-off",
    scenario: "feature flag state reference static_default_off",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference() must return source: static_default_off by default.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-state-reference-no-activation-attempted",
    scenario: "feature flag state reference no activation attempted",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference() must return activationAttempted: false and runtimeReadAttempted: false by default.",
    sourceShellKind: "clarification_gate_flag_shell",
  },

  // ─── Route evaluation — one per shellKind (5) ───────────────────────────────────────
  {
    id: "router-guard-route-clarification-gate",
    scenario: "route evaluation clarification gate router guard shell",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffRouterGuardShellCase() for a clarification_gate_flag_shell case must produce routerGuardShellKind clarification_gate_router_guard_shell and routerGuardAccepted true.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-route-preservation",
    scenario: "route evaluation route preservation router guard shell",
    routerGuardShellKind: "route_preservation_router_guard_shell",
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_preserve_existing_route",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffRouterGuardShellCase() for a route_preservation_flag_shell case must produce routerGuardShellKind route_preservation_router_guard_shell and routerGuardAccepted true.",
    sourceShellKind: "route_preservation_flag_shell",
  },
  {
    id: "router-guard-route-unsupported-boundary",
    scenario: "route evaluation unsupported boundary router guard shell",
    routerGuardShellKind: "unsupported_boundary_router_guard_shell",
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_preserve_unsupported_boundary",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffRouterGuardShellCase() for an unsupported_boundary_flag_shell case must produce routerGuardShellKind unsupported_boundary_router_guard_shell and routerGuardAccepted true.",
    sourceShellKind: "unsupported_boundary_flag_shell",
  },
  {
    id: "router-guard-route-shadow-only",
    scenario: "route evaluation shadow only router guard shell",
    routerGuardShellKind: "shadow_only_router_guard_shell",
    expectedLiveRouteDecision: "keep_shadow_only_noop",
    expectedFutureRouteIntent: "future_keep_shadow_only",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffRouterGuardShellCase() for a shadow_only_flag_shell case must produce routerGuardShellKind shadow_only_router_guard_shell and routerGuardAccepted true.",
    sourceShellKind: "shadow_only_flag_shell",
  },
  {
    id: "router-guard-route-blocked-unsafe",
    scenario: "route evaluation blocked unsafe router guard shell",
    routerGuardShellKind: "blocked_unsafe_router_guard_shell",
    expectedLiveRouteDecision: "block_unsafe_noop",
    expectedFutureRouteIntent: "future_block_unsafe",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffRouterGuardShellCase() for a blocked_unsafe_flag_shell case must produce routerGuardShellKind blocked_unsafe_router_guard_shell and routerGuardAccepted true.",
    sourceShellKind: "blocked_unsafe_flag_shell",
  },

  // ─── Composer guard handoff / rollback reference (2) ────────────────────────────────
  {
    id: "router-guard-composer-handoff-ready",
    scenario: "composer guard handoff ready",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffComposerGuardReadinessHandoff() must return readyForComposerGuardShell: true, composerGuardImplementationAllowedNow: false, composerRuntimeWiringAllowedNow: false, every requires* field true, and score >= 85.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-rollback-reference-ready",
    scenario: "rollback reference ready",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffRouterGuardRollbackReference() must return shellOnly: true, rollbackImplementedNow: false, every rollbackRequires* field true, and score >= 85.",
    sourceShellKind: "clarification_gate_flag_shell",
  },

  // ─── Safety confirmations (5) ────────────────────────────────────────────────────────
  {
    id: "router-guard-no-approval-overclaim",
    scenario: "no approval overclaim",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    ...PASS_COMMON,
    notes: "A valid router guard case must report noApprovalOverclaimPassed: true, propagated from the upstream Sprint 38R shell case.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-no-visibility-attempt",
    scenario: "no visibility attempt",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    ...PASS_COMMON,
    notes: "A valid router guard case must report noVisibilityAttemptPassed: true and userVisibleOutputAllowedNow: false.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-no-production-eligibility",
    scenario: "no production eligibility",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    ...PASS_COMMON,
    notes: "A valid router guard case must report noProductionEligibilityPassed: true and safeForProduction: false.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-no-leakage",
    scenario: "no leakage",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    ...PASS_COMMON,
    notes: "A valid router guard case must report noLeaksPassed: true.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-no-side-effects",
    scenario: "no side effects",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    ...PASS_COMMON,
    notes: "A valid router guard case must report noSideEffectsPassed: true.",
    sourceShellKind: "clarification_gate_flag_shell",
  },

  // ─── Negative synthetic scenarios (13) ───────────────────────────────────────────────
  {
    id: "router-guard-negative-router-import-attempted",
    scenario: "negative router import attempted",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["router_import_attempted"],
    notes: "Forcing routeEvaluation.routerImportAttempted true must fail noRouterImportPassed and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
    routeOverrideField: "forceRouterImportAttempted",
  },
  {
    id: "router-guard-negative-router-runtime-wiring-active",
    scenario: "negative router runtime wiring active",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["router_runtime_wiring_active"],
    notes: "Forcing routeEvaluation.routerRuntimeWiringActiveNow true must fail noRouterRuntimeWiringPassed and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
    routeOverrideField: "forceRouterRuntimeWiringActiveNow",
  },
  {
    id: "router-guard-negative-route-mutation-attempted",
    scenario: "negative route mutation attempted",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "block_route_mutation_default_off",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["route_mutation_attempted"],
    notes: "Forcing routeEvaluation.routeMutationAttempted true must fail noRouteMutationPassed, switch liveRouteDecision to block_route_mutation_default_off, and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
    routeOverrideField: "forceRouteMutationAttempted",
  },
  {
    id: "router-guard-negative-decision-support-route-activated",
    scenario: "negative decision_support route activated",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["route_mutation_attempted", "current_route_not_preserved"],
    notes: "Forcing routeEvaluation.decisionSupportRouteActivatedNow true must fail noRouteMutationPassed and currentRoutePreservationPassed, and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
    routeOverrideField: "forceDecisionSupportRouteActivatedNow",
  },
  {
    id: "router-guard-negative-feature-flag-enabled",
    scenario: "negative feature flag enabled",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_enabled_now"],
    notes: "Forcing featureFlagStateReference via forceEnabled: true must never actually set featureFlagEnabled true, but must fail featureFlagDisabledPassed and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
    stateOverrideField: "forceEnabled",
  },
  {
    id: "router-guard-negative-runtime-flag-read",
    scenario: "negative runtime flag read",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_runtime_read_attempted"],
    notes: "Forcing featureFlagStateReference.runtimeReadAttempted true must fail featureFlagDisabledPassed and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
    stateOverrideField: "forceRuntimeReadAttempted",
  },
  {
    id: "router-guard-negative-composer-change-allowed",
    scenario: "negative composer change allowed",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["composer_wiring_allowed"],
    notes: "Mutating composerGuardReadinessHandoff.composerGuardImplementationAllowedNow to true must fail composerGuardHandoffPassed and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-negative-endpoint-change-allowed",
    scenario: "negative endpoint change allowed",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["endpoint_wiring_allowed"],
    notes: "An upstream Sprint 38R shell case with noProductionEligibilityPassed: false and an endpoint_wiring_allowed violation must propagate and block the router guard (endpoint_wiring_allowed is critical, mirroring Sprint 38R's own treatment of endpoint_wiring_allowed).",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-negative-user-visible-output-allowed",
    scenario: "negative user visible output allowed",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["user_visible_output_allowed"],
    notes: "Forcing routeEvaluation.userVisibleNow true must fail noVisibilityAttemptPassed and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
    routeOverrideField: "forceUserVisibleNow",
  },
  {
    id: "router-guard-negative-real-persistence-allowed",
    scenario: "negative real persistence allowed",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["real_persistence_allowed"],
    notes: "An upstream Sprint 38R shell case with noSideEffectsPassed: false and violations including real_persistence_allowed must propagate that violation and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-negative-raw-input-leak",
    scenario: "negative raw input leak",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["raw_input_leak"],
    notes: "An upstream Sprint 38R shell case with noLeaksPassed: false and violations including raw_input_leak must propagate that violation and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-negative-pii-leak",
    scenario: "negative PII leak",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["pii_leak"],
    notes: "An upstream Sprint 38R shell case with noLeaksPassed: false and violations including pii_leak must propagate that violation and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
  },
  {
    id: "router-guard-negative-side-effect-risk",
    scenario: "negative side effect risk",
    routerGuardShellKind: "clarification_gate_router_guard_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedRouterGuardAccepted: false,
    expectedLiveRouteDecision: "preserve_current_route_noop",
    expectedFutureRouteIntent: "future_route_to_clarification_gate",
    expectedSafeForDefaultOffComposerGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["side_effect_risk"],
    notes: "An upstream Sprint 38R shell case with noSideEffectsPassed: false and violations including side_effect_risk must propagate that violation and block the router guard.",
    sourceShellKind: "clarification_gate_flag_shell",
  },

  // ─── Summary / decision (3) ──────────────────────────────────────────────────────────
  {
    id: "router-guard-summary-pass",
    scenario: "summary pass",
    ...CONFIG_NA_COMMON,
    notes:
      "summarizeDecisionSupportDefaultOffRouterGuardShell() over the full Sprint 18R corpus (via runDecisionSupportDefaultOffRouterGuardShell with " +
      "DECISION_CLARIFICATION_CASES) must report qaPassCount === totalCases, qaWarningCount/qaFailCount/qaBlockedCount === 0.",
  },
  {
    id: "router-guard-decision-ready-for-default-off-composer-guard-shell",
    scenario: "decision ready_for_default_off_composer_guard_shell",
    ...CONFIG_NA_COMMON,
    notes: "summarizeDecisionSupportDefaultOffRouterGuardShell() over the full Sprint 18R corpus must report decision: ready_for_default_off_composer_guard_shell.",
  },
  {
    id: "router-guard-recommended-sprint-40r",
    scenario: "recommended Sprint 40R",
    ...CONFIG_NA_COMMON,
    notes: 'summarizeDecisionSupportDefaultOffRouterGuardShell() over the full Sprint 18R corpus must report recommendedNextSprint: "Sprint 40R — Default-Off Composer Guard Shell".',
  },
];
