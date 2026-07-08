/**
 * Sprint 38R — Decision Support Default-Off Feature Flag Implementation Shell: fixtures.
 *
 * Scenario descriptors used by
 * `tests/playbook-engine-conversation-decision-support-default-off-feature-flag-implementation-shell.test.mjs`.
 * Each entry documents one behavior this sprint must exhibit. Cases that exercise a real shell case
 * evaluation carry a `sourceGateKind` — one of the five Sprint 37R gate kinds
 * (`clarification_gate_readiness`, `route_preservation_readiness`, `unsupported_boundary_readiness`,
 * `shadow_only_readiness`, `blocked_unsafe_readiness`) — that the test file uses to synthesize a minimal
 * `DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult`-shaped object (since the real Sprint
 * 18R corpus only ever produces `clarification_gate_readiness`/`route_preservation_readiness` cases) before
 * feeding it through `evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase()`. Negative
 * synthetic scenarios are driven by hardcoded per-id mutations in the test file itself, mirroring the
 * Sprint 37R fixture/test convention in this package.
 *
 * This fixture never imports from `src/`, and is never imported by production code — it exists only for
 * this sprint's own test suite.
 */

export type DecisionSupportDefaultOffFeatureFlagImplementationShellFixtureCase = {
  id: string;
  scenario: string;
  shellKind: string;
  expectedQaStatus: string;
  expectedRiskLevel: string;
  expectedShellAccepted: boolean;
  expectedFeatureFlagState: string;
  expectedFeatureFlagSource: string;
  expectedSafeForDefaultOffRouterGuardShell: boolean;
  expectedSafeForUserVisibleOutputNow: boolean;
  expectedSafeForProduction: boolean;
  expectedViolations: string[];
  notes: string;
  /** Present only for scenarios that build/evaluate a real synthetic shell case. */
  sourceGateKind?: "clarification_gate_readiness" | "route_preservation_readiness" | "unsupported_boundary_readiness" | "shadow_only_readiness" | "blocked_unsafe_readiness";
  /** Present only for the fifteen "attempt to enable X blocked" config scenarios. */
  configOverrideField?:
    | "allowProductionFeatureFlagImplementation"
    | "allowFeatureFlagActivation"
    | "allowFeatureFlagRuntimeRead"
    | "allowProductionWiring"
    | "allowRouterChange"
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
  /** Present only for state-resolution negative scenarios. */
  stateOverrideField?: string;
};

const PASS_COMMON = {
  expectedQaStatus: "pass",
  expectedRiskLevel: "low",
  expectedShellAccepted: true,
  expectedFeatureFlagState: "disabled",
  expectedFeatureFlagSource: "static_default_off",
  expectedSafeForDefaultOffRouterGuardShell: true,
  expectedSafeForUserVisibleOutputNow: false,
  expectedSafeForProduction: false,
  expectedViolations: [] as string[],
};

const CONFIG_NA_COMMON = {
  shellKind: "n/a",
  ...PASS_COMMON,
};

export const DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_CASES: DecisionSupportDefaultOffFeatureFlagImplementationShellFixtureCase[] = [
  // ─── Config: default strict (1) ─────────────────────────────────────────────────────
  {
    id: "shell-config-default-strict",
    scenario: "config default strict",
    ...CONFIG_NA_COMMON,
    notes:
      "createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig() with no overrides must return profile " +
      "strict_default_off_feature_flag_implementation_shell, mode feature_flag_shell_only, shellOnly/noOpShell/defaultOff true, " +
      "proposedFeatureFlagKey pmfreak.decisionSupport.defaultOffRouteComposerAdapter, every allow* field false, and every require* field true.",
  },

  // ─── Config: attempts to enable forbidden actions are blocked (15) ─────────────────
  {
    id: "shell-config-block-production-feature-flag-implementation",
    scenario: "attempts to enable production feature flag implementation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowProductionFeatureFlagImplementation: true } must still yield allowProductionFeatureFlagImplementation: false.",
    configOverrideField: "allowProductionFeatureFlagImplementation",
  },
  {
    id: "shell-config-block-feature-flag-activation",
    scenario: "attempts to enable feature flag activation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowFeatureFlagActivation: true } must still yield allowFeatureFlagActivation: false.",
    configOverrideField: "allowFeatureFlagActivation",
  },
  {
    id: "shell-config-block-feature-flag-runtime-read",
    scenario: "attempts to enable feature flag runtime read blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowFeatureFlagRuntimeRead: true } must still yield allowFeatureFlagRuntimeRead: false.",
    configOverrideField: "allowFeatureFlagRuntimeRead",
  },
  {
    id: "shell-config-block-production-wiring",
    scenario: "attempts to enable production wiring blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowProductionWiring: true } must still yield allowProductionWiring: false.",
    configOverrideField: "allowProductionWiring",
  },
  {
    id: "shell-config-block-router-change",
    scenario: "attempts to enable router change blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowRouterChange: true } must still yield allowRouterChange: false.",
    configOverrideField: "allowRouterChange",
  },
  {
    id: "shell-config-block-composer-change",
    scenario: "attempts to enable composer change blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowComposerChange: true } must still yield allowComposerChange: false.",
    configOverrideField: "allowComposerChange",
  },
  {
    id: "shell-config-block-endpoint-change",
    scenario: "attempts to enable endpoint change blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowEndpointChange: true } must still yield allowEndpointChange: false.",
    configOverrideField: "allowEndpointChange",
  },
  {
    id: "shell-config-block-user-visible-output",
    scenario: "attempts to enable user visible output blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowUserVisibleOutput: true } must still yield allowUserVisibleOutput: false.",
    configOverrideField: "allowUserVisibleOutput",
  },
  {
    id: "shell-config-block-real-persistence",
    scenario: "attempts to enable real persistence blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowRealPersistence: true } must still yield allowRealPersistence: false.",
    configOverrideField: "allowRealPersistence",
  },
  {
    id: "shell-config-block-db-write",
    scenario: "attempts to enable DB write blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowDbWrite: true } must still yield allowDbWrite: false.",
    configOverrideField: "allowDbWrite",
  },
  {
    id: "shell-config-block-supabase-write",
    scenario: "attempts to enable Supabase write blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowSupabaseWrite: true } must still yield allowSupabaseWrite: false.",
    configOverrideField: "allowSupabaseWrite",
  },
  {
    id: "shell-config-block-external-calls",
    scenario: "attempts to enable external calls blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowExternalCalls: true } must still yield allowExternalCalls: false.",
    configOverrideField: "allowExternalCalls",
  },
  {
    id: "shell-config-block-action-execution",
    scenario: "attempts to enable action execution blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowActionExecution: true } must still yield allowActionExecution: false.",
    configOverrideField: "allowActionExecution",
  },
  {
    id: "shell-config-block-task-creation",
    scenario: "attempts to enable task creation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowTaskCreation: true } must still yield allowTaskCreation: false.",
    configOverrideField: "allowTaskCreation",
  },
  {
    id: "shell-config-block-email-draft-creation",
    scenario: "attempts to enable email draft creation blocked",
    ...CONFIG_NA_COMMON,
    notes: "Passing { allowEmailDraftCreation: true } must still yield allowEmailDraftCreation: false.",
    configOverrideField: "allowEmailDraftCreation",
  },

  // ─── Shell definition (4) ─────────────────────────────────────────────────────────────
  {
    id: "shell-definition-key-preserved",
    scenario: "shell definition key preserved",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffFeatureFlagShellDefinition() must preserve key pmfreak.decisionSupport.defaultOffRouteComposerAdapter from Sprint 37R's proposed feature flag key.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-definition-default-value-false",
    scenario: "shell definition defaultValue false",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffFeatureFlagShellDefinition() must return defaultValue: false always.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-definition-no-production-flag-implemented",
    scenario: "shell definition no production feature flag implemented",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffFeatureFlagShellDefinition() must return productionFeatureFlagImplementedNow: false always.",
    sourceGateKind: "route_preservation_readiness",
  },
  {
    id: "shell-definition-no-runtime-read-now",
    scenario: "shell definition no runtime read now",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffFeatureFlagShellDefinition() must return featureFlagRuntimeReadNow: false and featureFlagActiveNow: false always.",
    sourceGateKind: "route_preservation_readiness",
  },

  // ─── Shell state (3) ──────────────────────────────────────────────────────────────────
  {
    id: "shell-state-disabled",
    scenario: "shell state disabled",
    ...CONFIG_NA_COMMON,
    notes: "resolveDecisionSupportDefaultOffFeatureFlagShellState() must return enabled: false and state: disabled by default.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-state-static-default-off",
    scenario: "shell state static_default_off",
    ...CONFIG_NA_COMMON,
    notes: "resolveDecisionSupportDefaultOffFeatureFlagShellState() must return source: static_default_off by default.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-state-no-activation-attempted",
    scenario: "shell state no activation attempted",
    ...CONFIG_NA_COMMON,
    notes: "resolveDecisionSupportDefaultOffFeatureFlagShellState() must return activationAttempted: false and runtimeReadAttempted: false by default.",
    sourceGateKind: "clarification_gate_readiness",
  },

  // ─── Router guard readiness handoff — one per shellKind (5) ─────────────────────────
  {
    id: "shell-handoff-clarification-gate",
    scenario: "router handoff clarification gate flag shell",
    shellKind: "clarification_gate_flag_shell",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase() for a clarification_gate_readiness case must produce shellKind clarification_gate_flag_shell and shellAccepted true.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-handoff-route-preservation",
    scenario: "router handoff route preservation flag shell",
    shellKind: "route_preservation_flag_shell",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase() for a route_preservation_readiness case must produce shellKind route_preservation_flag_shell and shellAccepted true.",
    sourceGateKind: "route_preservation_readiness",
  },
  {
    id: "shell-handoff-unsupported-boundary",
    scenario: "router handoff unsupported boundary flag shell",
    shellKind: "unsupported_boundary_flag_shell",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase() for an unsupported_boundary_readiness case must produce shellKind unsupported_boundary_flag_shell and shellAccepted true.",
    sourceGateKind: "unsupported_boundary_readiness",
  },
  {
    id: "shell-handoff-shadow-only",
    scenario: "router handoff shadow only flag shell",
    shellKind: "shadow_only_flag_shell",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase() for a shadow_only_readiness case must produce shellKind shadow_only_flag_shell and shellAccepted true.",
    sourceGateKind: "shadow_only_readiness",
  },
  {
    id: "shell-handoff-blocked-unsafe",
    scenario: "router handoff blocked unsafe flag shell",
    shellKind: "blocked_unsafe_flag_shell",
    ...PASS_COMMON,
    notes: "evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase() for a blocked_unsafe_readiness case must produce shellKind blocked_unsafe_flag_shell and shellAccepted true.",
    sourceGateKind: "blocked_unsafe_readiness",
  },

  // ─── Rollback reference (1) ───────────────────────────────────────────────────────────
  {
    id: "shell-rollback-reference-ready",
    scenario: "rollback reference ready",
    ...CONFIG_NA_COMMON,
    notes: "createDecisionSupportDefaultOffFeatureFlagRollbackReference() must return shellOnly: true, rollbackImplementedNow: false, every rollbackRequires* field true, and score >= 85.",
    sourceGateKind: "clarification_gate_readiness",
  },

  // ─── Safety confirmations (5) ────────────────────────────────────────────────────────
  {
    id: "shell-no-approval-overclaim",
    scenario: "no approval overclaim",
    shellKind: "clarification_gate_flag_shell",
    ...PASS_COMMON,
    notes: "A valid shell case must report noApprovalOverclaimPassed: true, propagated from the upstream Sprint 37R gate case.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-no-visibility-attempt",
    scenario: "no visibility attempt",
    shellKind: "clarification_gate_flag_shell",
    ...PASS_COMMON,
    notes: "A valid shell case must report noVisibilityAttemptPassed: true and userVisibleOutputAllowedNow: false.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-no-production-eligibility",
    scenario: "no production eligibility",
    shellKind: "clarification_gate_flag_shell",
    ...PASS_COMMON,
    notes: "A valid shell case must report noProductionEligibilityPassed: true and safeForProduction: false.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-no-leakage",
    scenario: "no leakage",
    shellKind: "clarification_gate_flag_shell",
    ...PASS_COMMON,
    notes: "A valid shell case must report noLeaksPassed: true.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-no-side-effects",
    scenario: "no side effects",
    shellKind: "clarification_gate_flag_shell",
    ...PASS_COMMON,
    notes: "A valid shell case must report noSideEffectsPassed: true.",
    sourceGateKind: "clarification_gate_readiness",
  },

  // ─── Negative synthetic scenarios (14) ───────────────────────────────────────────────
  {
    id: "shell-negative-wrong-feature-flag-key",
    scenario: "negative wrong feature flag key",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "fail",
    expectedRiskLevel: "high",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "disabled",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_key_mismatch"],
    notes: "Mutating the feature flag shell definition's key to a different string must fail featureFlagDefinitionPassed and reject (not block) the shell.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-negative-default-value-true",
    scenario: "negative default value true",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "fail",
    expectedRiskLevel: "high",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "disabled",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["default_value_not_false"],
    notes: "Mutating featureFlagDefinition.defaultValue to true must fail defaultValueFalsePassed and reject (not block) the shell.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-negative-enabled-true",
    scenario: "negative enabled true",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "blocked",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_active_now"],
    notes: "Forcing featureFlagState via forceEnabled: true must never actually set enabled true, but must fail staticDefaultOffResolutionPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
    stateOverrideField: "forceEnabled",
  },
  {
    id: "shell-negative-runtime-read-attempted",
    scenario: "negative runtime read attempted",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "blocked",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_runtime_read_attempted"],
    notes: "Forcing featureFlagState.runtimeReadAttempted true must fail noRuntimeReadPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
    stateOverrideField: "forceRuntimeReadAttempted",
  },
  {
    id: "shell-negative-activation-attempted",
    scenario: "negative activation attempted",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "blocked",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["feature_flag_activation_allowed"],
    notes: "Forcing featureFlagState.activationAttempted true must fail noActivationPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
    stateOverrideField: "forceActivationAttempted",
  },
  {
    id: "shell-negative-production-flag-implemented-now",
    scenario: "negative production flag implemented now",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "disabled",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["production_feature_flag_implemented"],
    notes: "Mutating featureFlagDefinition.productionFeatureFlagImplementedNow to true must fail noProductionFeatureFlagImplementationPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-negative-router-change-allowed",
    scenario: "negative router change allowed",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "blocked",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["router_wiring_allowed"],
    notes: "Forcing featureFlagState.routerChangeAttempted true must fail routerGuardHandoffPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
    stateOverrideField: "forceRouterChangeAttempted",
  },
  {
    id: "shell-negative-composer-change-allowed",
    scenario: "negative composer change allowed",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "blocked",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["composer_wiring_allowed"],
    notes: "Forcing featureFlagState.composerChangeAttempted true must fail routerGuardHandoffPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
    stateOverrideField: "forceComposerChangeAttempted",
  },
  {
    id: "shell-negative-endpoint-change-allowed",
    scenario: "negative endpoint change allowed",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "blocked",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["endpoint_wiring_allowed"],
    notes: "Forcing featureFlagState.endpointChangeAttempted true must fail routerGuardHandoffPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
    stateOverrideField: "forceEndpointChangeAttempted",
  },
  {
    id: "shell-negative-user-visible-output-allowed",
    scenario: "negative user visible output allowed",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "blocked",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["user_visible_output_allowed"],
    notes: "Forcing featureFlagState.userVisibleOutputAttempted true must fail noVisibilityAttemptPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
    stateOverrideField: "forceUserVisibleOutputAttempted",
  },
  {
    id: "shell-negative-real-persistence-allowed",
    scenario: "negative real persistence allowed",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "blocked",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["real_persistence_allowed"],
    notes: "Forcing featureFlagState.realPersistenceAttempted true must fail noSideEffectsPassed and block the shell.",
    sourceGateKind: "clarification_gate_readiness",
    stateOverrideField: "forceRealPersistenceAttempted",
  },
  {
    id: "shell-negative-raw-input-leak",
    scenario: "negative raw input leak",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "disabled",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["raw_input_leak"],
    notes: "A source Sprint 37R gate case with noLeaksPassed: false and violations including raw_input_leak must propagate that violation and fail noLeaksPassed.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-negative-pii-leak",
    scenario: "negative PII leak",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "disabled",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["pii_leak"],
    notes: "A source Sprint 37R gate case with noLeaksPassed: false and violations including pii_leak must propagate that violation and fail noLeaksPassed.",
    sourceGateKind: "clarification_gate_readiness",
  },
  {
    id: "shell-negative-side-effect-risk",
    scenario: "negative side effect risk",
    shellKind: "clarification_gate_flag_shell",
    expectedQaStatus: "blocked",
    expectedRiskLevel: "critical",
    expectedShellAccepted: false,
    expectedFeatureFlagState: "disabled",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: false,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: ["side_effect_risk"],
    notes: "A source Sprint 37R gate case with noSideEffectsPassed: false and violations including side_effect_risk must propagate that violation and fail noSideEffectsPassed.",
    sourceGateKind: "clarification_gate_readiness",
  },

  // ─── Summary / decision (3) ──────────────────────────────────────────────────────────
  {
    id: "shell-summary-pass",
    scenario: "summary pass",
    shellKind: "n/a",
    expectedQaStatus: "pass",
    expectedRiskLevel: "low",
    expectedShellAccepted: true,
    expectedFeatureFlagState: "disabled",
    expectedFeatureFlagSource: "static_default_off",
    expectedSafeForDefaultOffRouterGuardShell: true,
    expectedSafeForUserVisibleOutputNow: false,
    expectedSafeForProduction: false,
    expectedViolations: [],
    notes:
      "summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell() over the full Sprint 18R corpus (via " +
      "runDecisionSupportDefaultOffFeatureFlagImplementationShell with DECISION_CLARIFICATION_CASES) must report qaPassCount === totalCases, " +
      "qaWarningCount/qaFailCount/qaBlockedCount === 0.",
  },
  {
    id: "shell-decision-ready-for-default-off-router-guard-shell",
    scenario: "decision ready_for_default_off_router_guard_shell",
    shellKind: "n/a",
    ...PASS_COMMON,
    notes:
      "summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell() over the full Sprint 18R corpus must report decision: " +
      "ready_for_default_off_router_guard_shell.",
  },
  {
    id: "shell-recommended-sprint-39r",
    scenario: "recommended Sprint 39R",
    shellKind: "n/a",
    ...PASS_COMMON,
    notes:
      "summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell() over the full Sprint 18R corpus must report recommendedNextSprint: " +
      '"Sprint 39R — Default-Off Router Guard Shell".',
  },
];
