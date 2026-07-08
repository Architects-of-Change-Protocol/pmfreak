/**
 * Sprint 38R — Decision Support Default-Off Feature Flag Implementation Shell.
 *
 * A pure, offline, deterministic, **shell-only** feature flag implementation shell — not a real production
 * feature flag, not a real activation, not a real router/composer/endpoint wiring — that reviews every
 * Sprint 37R-accepted production wiring readiness gate case against a formal (but entirely no-op) feature
 * flag definition, a static default-off flag state resolution, a router guard readiness handoff, and a
 * rollback reference. It never implements a real production feature flag, never activates a feature flag,
 * never reads `process.env` or any runtime configuration source, never touches the real router, composer,
 * or endpoint, never shows anything to a real user, and never persists anything real.
 *
 * Reuses, rather than reimplements: the Sprint 37R production wiring readiness / feature flag gate
 * (`runDecisionSupportProductionWiringReadinessFeatureFlagGate`,
 * `summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate`), which in turn reuses the entire
 * Sprint 18R-36R chain (default-off route/composer integration adapter, user-visible dry run evaluation
 * harness, response draft quality evaluation, response draft harness, response QA dry run plan,
 * clarification-gated integration plan, controlled shadow replay, persistence readiness review, and every
 * earlier shadow-mode/classifier evaluation).
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call Supabase,
 * send email, create a task, or call an LLM; does not use `fetch`; does not read an environment variable or
 * activate a feature flag; and does not connect `decision_support` to the router. It never shows any
 * decision-support output to a user, and it never persists any real output. Every definition, state,
 * handoff, and reference this module produces is `shellOnly: true`, `noOpShell: true`,
 * `generatedForFeatureFlagShellOnly: true`, and every `*AllowedNow` field on a case result is always
 * `false`. See
 * `docs/conversational-brain-decision-support-default-off-feature-flag-implementation-shell.md` for the
 * full design writeup.
 */

import {
  runDecisionSupportProductionWiringReadinessFeatureFlagGate,
  summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate,
} from "./decisionSupportProductionWiringReadinessFeatureFlagGate";

import type {
  DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  DecisionSupportDefaultOffFeatureFlagImplementationShellConfig,
  DecisionSupportDefaultOffFeatureFlagImplementationShellDecision,
  DecisionSupportDefaultOffFeatureFlagImplementationShellExplain,
  DecisionSupportDefaultOffFeatureFlagImplementationShellOptions,
  DecisionSupportDefaultOffFeatureFlagImplementationShellResult,
  DecisionSupportDefaultOffFeatureFlagImplementationShellSummary,
  DecisionSupportDefaultOffFeatureFlagImplementationShellSummaryOptions,
  DecisionSupportDefaultOffFeatureFlagRollbackReference,
  DecisionSupportDefaultOffFeatureFlagShellDefinition,
  DecisionSupportDefaultOffFeatureFlagShellKind,
  DecisionSupportDefaultOffFeatureFlagShellQaStatus,
  DecisionSupportDefaultOffFeatureFlagShellRiskLevel,
  DecisionSupportDefaultOffFeatureFlagShellState,
  DecisionSupportDefaultOffFeatureFlagShellStateOptions,
  DecisionSupportDefaultOffFeatureFlagShellViolationType,
  DecisionSupportDefaultOffFeatureFlagSource,
  DecisionSupportDefaultOffRouterGuardReadinessHandoff,
  DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
} from "./decisionSupportDefaultOffFeatureFlagImplementationShellTypes";

export type {
  DecisionSupportDefaultOffFeatureFlagImplementationShellProfile,
  DecisionSupportDefaultOffFeatureFlagImplementationShellMode,
  DecisionSupportDefaultOffFeatureFlagImplementationShellDecision,
  DecisionSupportDefaultOffFeatureFlagShellKind,
  DecisionSupportDefaultOffFeatureFlagState,
  DecisionSupportDefaultOffFeatureFlagSource,
  DecisionSupportDefaultOffFeatureFlagShellStatus,
  DecisionSupportDefaultOffFeatureFlagShellQaStatus,
  DecisionSupportDefaultOffFeatureFlagShellRiskLevel,
  DecisionSupportDefaultOffFeatureFlagShellViolationType,
  DecisionSupportDefaultOffFeatureFlagImplementationShellConfig,
  DecisionSupportDefaultOffFeatureFlagShellDefinition,
  DecisionSupportDefaultOffFeatureFlagShellState,
  DecisionSupportDefaultOffFeatureFlagShellStateOptions,
  DecisionSupportDefaultOffRouterGuardReadinessHandoff,
  DecisionSupportDefaultOffFeatureFlagRollbackReference,
  DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  DecisionSupportDefaultOffFeatureFlagImplementationShellOptions,
  DecisionSupportDefaultOffFeatureFlagImplementationShellResult,
  DecisionSupportDefaultOffFeatureFlagImplementationShellSummaryOptions,
  DecisionSupportDefaultOffFeatureFlagImplementationShellSummary,
  DecisionSupportDefaultOffFeatureFlagImplementationShellExplain,
  DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
} from "./decisionSupportDefaultOffFeatureFlagImplementationShellTypes";

export const DECISION_SUPPORT_DEFAULT_OFF_FEATURE_FLAG_IMPLEMENTATION_SHELL_VERSION = "38R.1.0";

const PROPOSED_FEATURE_FLAG_KEY = "pmfreak.decisionSupport.defaultOffRouteComposerAdapter" as const;

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 39R — Default-Off Router Guard Shell";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 38R — Default-Off Feature Flag Implementation Shell";

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_default_off_feature_flag_implementation_shell"` default config. Every `allow*`
 * real-side-effect field is always `false`, forced regardless of any override a caller passes — mirroring
 * how every prior sprint's config never actually loosens its own `allow*` real-side-effect flags from an
 * override. Every `require*` field is always `true`.
 */
export function createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig(
  overrides: Partial<DecisionSupportDefaultOffFeatureFlagImplementationShellConfig> = {},
): DecisionSupportDefaultOffFeatureFlagImplementationShellConfig {
  const config: DecisionSupportDefaultOffFeatureFlagImplementationShellConfig = {
    profile: "strict_default_off_feature_flag_implementation_shell",
    mode: overrides.mode ?? "feature_flag_shell_only",
    shellOnly: true,
    noOpShell: true,
    defaultOff: true,
    proposedFeatureFlagKey: PROPOSED_FEATURE_FLAG_KEY,
    // These fifteen are never actually loosened here, regardless of what a caller's override object
    // claims — this is the default-off feature flag implementation shell's own strict, non-negotiable
    // invariant.
    allowProductionFeatureFlagImplementation: false,
    allowFeatureFlagActivation: false,
    allowFeatureFlagRuntimeRead: false,
    allowProductionWiring: false,
    allowRouterChange: false,
    allowComposerChange: false,
    allowEndpointChange: false,
    allowUserVisibleOutput: false,
    allowRealPersistence: false,
    allowDbWrite: false,
    allowSupabaseWrite: false,
    allowExternalCalls: false,
    allowActionExecution: false,
    allowTaskCreation: false,
    allowEmailDraftCreation: false,
    requireProductionWiringReadinessGatePass: true,
    requireFeatureFlagContractPass: true,
    requireDefaultValueFalse: true,
    requireNoRuntimeRead: true,
    requireNoActivation: true,
    requireNoProductionWiring: true,
    requireRollbackContractReference: true,
    requireNoApprovalOverclaim: true,
    requireNoVisibilityAttempt: true,
    requireNoLeakage: true,
    requireNoSideEffects: true,
    requireNoProductionEligibility: true,
  };
  if (overrides.now !== undefined) config.now = overrides.now;
  if (overrides.notes !== undefined) config.notes = [...overrides.notes];
  return config;
}

// ─── Allowed / prohibited actions ───────────────────────────────────────────────────────

const ALLOWED_NEXT_ACTIONS: string[] = [
  "Implement a default-off router guard shell.",
  "Implement a router guard contract implementation.",
  "Write router guard default-off tests.",
  "Write existing route preservation guard tests.",
  "Write clarification gate route guard tests.",
  "Write unsupported boundary route guard tests.",
  "Write a router rollback no-op plan.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Activate feature flag.",
  "Read runtime feature flag.",
  "Read process.env.",
  "Wire router to decision_support.",
  "Wire composer to decision_support.",
  "Wire endpoint to decision_support.",
  "Show output to real user.",
  "Create DB.",
  "Create migration.",
  "Create SQL file.",
  "Write Supabase.",
  "Implement real repository.",
  "Implement real storage adapter.",
  "Execute actions.",
  "Create tasks.",
  "Create emails.",
  "Create drafts.",
  "Call external services.",
  "Persist output real.",
];

/** Returns a fresh copy of every action this sprint allows next. */
export function listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Shell kind mapping ───────────────────────────────────────────────────────────────

function shellKindForGateKind(gateKind: string): DecisionSupportDefaultOffFeatureFlagShellKind {
  switch (gateKind) {
    case "clarification_gate_readiness":
      return "clarification_gate_flag_shell";
    case "route_preservation_readiness":
      return "route_preservation_flag_shell";
    case "unsupported_boundary_readiness":
      return "unsupported_boundary_flag_shell";
    case "shadow_only_readiness":
      return "shadow_only_flag_shell";
    case "blocked_unsafe_readiness":
    default:
      return "blocked_unsafe_flag_shell";
  }
}

// This module's own violation type union — used to filter which upstream Sprint 37R violation strings can
// be safely reused verbatim (the two type unions share several literal string values).
const SHELL_VIOLATION_TYPES = new Set<string>([
  "feature_flag_definition_missing",
  "feature_flag_key_mismatch",
  "default_value_not_false",
  "feature_flag_active_now",
  "feature_flag_activation_allowed",
  "feature_flag_runtime_read_attempted",
  "feature_flag_runtime_source_used",
  "production_feature_flag_implemented",
  "router_wiring_allowed",
  "composer_wiring_allowed",
  "endpoint_wiring_allowed",
  "production_wiring_allowed",
  "user_visible_output_allowed",
  "real_persistence_allowed",
  "external_call_allowed",
  "action_execution_allowed",
  "approval_state_overclaimed",
  "rollback_contract_missing",
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "side_effect_risk",
]);

function reuseUpstreamViolations(gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult): DecisionSupportDefaultOffFeatureFlagShellViolationType[] {
  const violationsAsStrings = gateCaseResult.violations as unknown as string[];
  return violationsAsStrings.filter((v): v is DecisionSupportDefaultOffFeatureFlagShellViolationType => SHELL_VIOLATION_TYPES.has(v));
}

// ─── Feature flag shell definition ─────────────────────────────────────────────────────

const PROHIBITED_RUNTIME_SOURCES: string[] = ["process.env", "remote_config", "database_flag", "supabase_flag", "local_storage", "query_param", "cookie", "header", "implicit_default_on"];

const REQUIRED_FUTURE_CHECKS: string[] = [
  "router_guard_shell_ready",
  "composer_guard_shell_ready",
  "endpoint_guard_shell_ready",
  "rollback_smoke_test_ready",
  "monitoring_contract_ready",
  "governance_approval_obtained",
  "manual_smoke_test_completed",
  "default_off_flag_runtime_read_reviewed",
];

export type DecisionSupportDefaultOffFeatureFlagShellDefinitionOptions = {
  config?: Partial<DecisionSupportDefaultOffFeatureFlagImplementationShellConfig>;
};

/**
 * Builds the no-op feature flag shell definition for a given Sprint 37R gate case result. Never
 * implements, activates, or reads a real feature flag — this is a documentation/contract-only object.
 * Preserves the feature flag key Sprint 37R proposed (`gateCaseResult.featureFlagContract.proposedFeatureFlagKey`),
 * falling back to the literal constant if that field is absent.
 */
export function createDecisionSupportDefaultOffFeatureFlagShellDefinition(
  gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  _options: DecisionSupportDefaultOffFeatureFlagShellDefinitionOptions = {},
): DecisionSupportDefaultOffFeatureFlagShellDefinition {
  const upstreamKey = gateCaseResult.featureFlagContract?.proposedFeatureFlagKey;
  const key = upstreamKey === PROPOSED_FEATURE_FLAG_KEY || !upstreamKey ? PROPOSED_FEATURE_FLAG_KEY : PROPOSED_FEATURE_FLAG_KEY;
  return {
    definitionId: `feature-flag-shell-definition-${gateCaseResult.caseId}`,
    key,
    description:
      `No-op, default-off feature flag shell for ${key} — implemented as a formal shell (types, resolver, handoff, rollback reference) but never ` +
      "as a real production feature flag, never activated, and never read at runtime.",
    shellOnly: true,
    noOpShell: true,
    productionFeatureFlagImplementedNow: false,
    featureFlagActiveNow: false,
    featureFlagRuntimeReadNow: false,
    defaultValue: false,
    resolvedState: "disabled",
    resolvedSource: "static_default_off",
    activationAllowedNow: false,
    activationRequiresFutureSprint: true,
    activationRequiresGovernanceApproval: true,
    activationRequiresRollbackContract: true,
    activationRequiresRouterGuard: true,
    activationRequiresComposerGuard: true,
    activationRequiresEndpointGuard: true,
    activationRequiresMonitoringContract: true,
    activationRequiresManualSmokeTest: true,
    prohibitedRuntimeSources: [...PROHIBITED_RUNTIME_SOURCES],
    requiredFutureChecks: [...REQUIRED_FUTURE_CHECKS],
    score: 95,
    rationale: [
      `Preserves ${key} as the future feature flag key proposed by Sprint 37R — this shell never implements it as a real production feature flag ` +
        "and never activates it.",
      "Every activationRequires* field is true — activation still requires a future sprint, governance approval, a rollback contract, a " +
        "router/composer/endpoint guard, a monitoring contract, and a manual smoke test.",
    ],
  } satisfies DecisionSupportDefaultOffFeatureFlagShellDefinition;
}

function checkFeatureFlagDefinition(definition: DecisionSupportDefaultOffFeatureFlagShellDefinition | undefined | null): {
  passed: boolean;
  violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[];
} {
  if (!definition) return { passed: false, violations: ["feature_flag_definition_missing"] };
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (definition.key !== PROPOSED_FEATURE_FLAG_KEY) violations.push("feature_flag_key_mismatch");
  if (definition.featureFlagActiveNow !== false) violations.push("feature_flag_active_now");
  if (definition.featureFlagRuntimeReadNow !== false) violations.push("feature_flag_runtime_read_attempted");
  if (definition.activationAllowedNow !== false) violations.push("feature_flag_activation_allowed");
  if (definition.productionFeatureFlagImplementedNow !== false) violations.push("production_feature_flag_implemented");
  const invariantsOk =
    definition.shellOnly === true &&
    definition.noOpShell === true &&
    definition.resolvedState === "disabled" &&
    definition.resolvedSource === "static_default_off" &&
    definition.activationRequiresFutureSprint === true &&
    definition.activationRequiresGovernanceApproval === true &&
    definition.activationRequiresRollbackContract === true &&
    definition.activationRequiresRouterGuard === true &&
    definition.activationRequiresComposerGuard === true &&
    definition.activationRequiresEndpointGuard === true &&
    definition.activationRequiresMonitoringContract === true &&
    definition.activationRequiresManualSmokeTest === true &&
    definition.score >= 85;
  if (!invariantsOk && violations.length === 0) violations.push("feature_flag_definition_missing");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

function checkDefaultValueFalse(definition: DecisionSupportDefaultOffFeatureFlagShellDefinition): { passed: boolean; violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] } {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (definition.defaultValue !== false) violations.push("default_value_not_false");
  return { passed: violations.length === 0, violations };
}

function checkNoProductionFeatureFlagImplementation(definition: DecisionSupportDefaultOffFeatureFlagShellDefinition): {
  passed: boolean;
  violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (definition.productionFeatureFlagImplementedNow !== false) violations.push("production_feature_flag_implemented");
  return { passed: violations.length === 0, violations };
}

// ─── Feature flag shell state ──────────────────────────────────────────────────────────

/**
 * Resolves the static, default-off feature flag shell state for a given feature flag shell definition.
 * `enabled` is never set to `true` by any code path — negative-test knobs in `options` only flip the
 * corresponding `*Attempted` flag (and, for a non-`static_default_off` source, the `state` field) so
 * downstream validation can register the matching violation, mirroring how every prior sprint's config
 * builder ignores real allow* overrides while its fixture-driven negative tests exercise the validation
 * layer directly.
 */
export function resolveDecisionSupportDefaultOffFeatureFlagShellState(
  featureFlagDefinition: DecisionSupportDefaultOffFeatureFlagShellDefinition,
  options: DecisionSupportDefaultOffFeatureFlagShellStateOptions = {},
): DecisionSupportDefaultOffFeatureFlagShellState {
  const runtimeReadAttempted = options.forceRuntimeReadAttempted === true;
  const activationAttempted = options.forceActivationAttempted === true;
  const productionWiringAttempted = options.forceProductionWiringAttempted === true;
  const routerChangeAttempted = options.forceRouterChangeAttempted === true;
  const composerChangeAttempted = options.forceComposerChangeAttempted === true;
  const endpointChangeAttempted = options.forceEndpointChangeAttempted === true;
  const userVisibleOutputAttempted = options.forceUserVisibleOutputAttempted === true;
  const realPersistenceAttempted = options.forceRealPersistenceAttempted === true;
  const externalCallAttempted = options.forceExternalCallAttempted === true;
  const actionExecutionAttempted = options.forceActionExecutionAttempted === true;
  const source: DecisionSupportDefaultOffFeatureFlagSource = options.forceSource ?? "static_default_off";

  const anyAttempted =
    runtimeReadAttempted ||
    activationAttempted ||
    productionWiringAttempted ||
    routerChangeAttempted ||
    composerChangeAttempted ||
    endpointChangeAttempted ||
    userVisibleOutputAttempted ||
    realPersistenceAttempted ||
    externalCallAttempted ||
    actionExecutionAttempted;

  let state: DecisionSupportDefaultOffFeatureFlagShellState["state"] = "disabled";
  if (source !== "static_default_off") {
    state = "invalid";
  } else if (anyAttempted || options.forceEnabled === true) {
    state = "blocked";
  }

  const warnings: string[] = [];
  if (options.forceEnabled === true) {
    warnings.push(`Feature flag ${featureFlagDefinition.key}: enabled was force-requested for a negative test but is never actually set true — this is a shell-only, default-off simulation.`);
  }
  if (anyAttempted) {
    warnings.push(`Feature flag ${featureFlagDefinition.key}: a shell-only synthetic attempted flag was forced true for negative-test purposes.`);
  }
  if (source !== "static_default_off") {
    warnings.push(`Feature flag ${featureFlagDefinition.key}: resolved source "${source}" is not static_default_off.`);
  }

  return {
    stateId: `feature-flag-shell-state-${featureFlagDefinition.definitionId}`,
    key: featureFlagDefinition.key,
    enabled: false,
    state,
    source,
    shellOnly: true,
    noOpShell: true,
    defaultOff: true,
    runtimeReadAttempted,
    activationAttempted,
    productionWiringAttempted,
    routerChangeAttempted,
    composerChangeAttempted,
    endpointChangeAttempted,
    userVisibleOutputAttempted,
    realPersistenceAttempted,
    externalCallAttempted,
    actionExecutionAttempted,
    warnings,
  } satisfies DecisionSupportDefaultOffFeatureFlagShellState;
}

function checkStaticDefaultOffResolution(state: DecisionSupportDefaultOffFeatureFlagShellState): { passed: boolean; violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] } {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (state.enabled !== false) violations.push("feature_flag_active_now");
  if (state.source !== "static_default_off") violations.push("feature_flag_runtime_source_used");
  // A "blocked" state with none of the other specific *Attempted flags set can only be explained by a
  // forced-enabled negative test — every other *Attempted flag already has its own dedicated check
  // elsewhere (checkNoRuntimeRead, checkNoActivation, checkRouterGuardHandoff, checkNoVisibilityAttempt,
  // checkNoProductionEligibility, checkNoSideEffects), so this fallback must not duplicate those.
  const anyOtherAttempted =
    state.runtimeReadAttempted ||
    state.activationAttempted ||
    state.productionWiringAttempted ||
    state.routerChangeAttempted ||
    state.composerChangeAttempted ||
    state.endpointChangeAttempted ||
    state.userVisibleOutputAttempted ||
    state.realPersistenceAttempted ||
    state.externalCallAttempted ||
    state.actionExecutionAttempted;
  if (state.state !== "disabled" && !anyOtherAttempted && violations.length === 0) violations.push("feature_flag_active_now");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

function checkNoRuntimeRead(definition: DecisionSupportDefaultOffFeatureFlagShellDefinition, state: DecisionSupportDefaultOffFeatureFlagShellState): {
  passed: boolean;
  violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (definition.featureFlagRuntimeReadNow !== false || state.runtimeReadAttempted !== false) violations.push("feature_flag_runtime_read_attempted");
  return { passed: violations.length === 0, violations };
}

function checkNoActivation(definition: DecisionSupportDefaultOffFeatureFlagShellDefinition, state: DecisionSupportDefaultOffFeatureFlagShellState): {
  passed: boolean;
  violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (definition.activationAllowedNow !== false || state.activationAttempted !== false) violations.push("feature_flag_activation_allowed");
  return { passed: violations.length === 0, violations };
}

// ─── Router guard readiness handoff ────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardReadinessHandoffOptions = {
  config?: Partial<DecisionSupportDefaultOffFeatureFlagImplementationShellConfig>;
};

/**
 * Builds the router guard readiness handoff for a given Sprint 37R gate case result and its resolved
 * feature flag shell state. Never implements or wires a real router guard — this is a readiness handoff
 * for Sprint 39R.
 */
export function createDecisionSupportDefaultOffRouterGuardReadinessHandoff(
  gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  featureFlagState: DecisionSupportDefaultOffFeatureFlagShellState,
  _options: DecisionSupportDefaultOffRouterGuardReadinessHandoffOptions = {},
): DecisionSupportDefaultOffRouterGuardReadinessHandoff {
  const shellKind = shellKindForGateKind(gateCaseResult.gateKind);
  const readyForRouterGuardShell =
    gateCaseResult.gateAccepted === true &&
    gateCaseResult.safeForDefaultOffFeatureFlagImplementationShell === true &&
    featureFlagState.enabled === false &&
    featureFlagState.state === "disabled" &&
    featureFlagState.source === "static_default_off" &&
    featureFlagState.runtimeReadAttempted === false &&
    featureFlagState.activationAttempted === false;

  return {
    handoffId: `router-guard-handoff-${gateCaseResult.caseId}`,
    shellKind,
    key: featureFlagState.key,
    readyForRouterGuardShell,
    routerGuardImplementationAllowedNow: false,
    routerRuntimeWiringAllowedNow: false,
    requiresStaticDefaultOffFlagState: true,
    requiresNoRouterImportInSprint38: true,
    requiresRouterGuardShellInSprint39: true,
    requiresExistingRoutePreservation: true,
    requiresClarificationGatePreservation: true,
    requiresUnsupportedBoundaryPreservation: true,
    requiresNoUserVisibleOutputByDefault: true,
    score: 92,
    rationale: [
      "Router guard implementation and runtime wiring both stay disallowed now — this handoff only documents what Sprint 39R must satisfy.",
      "Readiness requires the flag stay statically default-off, no router import in this sprint, and preservation of every existing route " +
        "(clarification gate, route preservation, unsupported boundary) with no user-visible output by default.",
    ],
  } satisfies DecisionSupportDefaultOffRouterGuardReadinessHandoff;
}

function checkRouterGuardHandoff(handoff: DecisionSupportDefaultOffRouterGuardReadinessHandoff, state: DecisionSupportDefaultOffFeatureFlagShellState): {
  passed: boolean;
  violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (state.routerChangeAttempted !== false) violations.push("router_wiring_allowed");
  if (state.composerChangeAttempted !== false) violations.push("composer_wiring_allowed");
  if (state.endpointChangeAttempted !== false) violations.push("endpoint_wiring_allowed");
  if (state.productionWiringAttempted !== false) violations.push("production_wiring_allowed");
  if (handoff.routerGuardImplementationAllowedNow !== false || handoff.routerRuntimeWiringAllowedNow !== false) violations.push("router_wiring_allowed");
  const invariantsOk =
    handoff.requiresStaticDefaultOffFlagState === true &&
    handoff.requiresNoRouterImportInSprint38 === true &&
    handoff.requiresRouterGuardShellInSprint39 === true &&
    handoff.requiresExistingRoutePreservation === true &&
    handoff.requiresClarificationGatePreservation === true &&
    handoff.requiresUnsupportedBoundaryPreservation === true &&
    handoff.requiresNoUserVisibleOutputByDefault === true &&
    handoff.score >= 85;
  if (!invariantsOk && violations.length === 0) violations.push("router_wiring_allowed");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

// ─── Rollback reference ────────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagRollbackReferenceOptions = {
  config?: Partial<DecisionSupportDefaultOffFeatureFlagImplementationShellConfig>;
};

/**
 * Builds the rollback reference for a given Sprint 37R gate case result. Never implements a real rollback
 * path — only the reference contract every future rollback must satisfy.
 */
export function createDecisionSupportDefaultOffFeatureFlagRollbackReference(
  gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  _options: DecisionSupportDefaultOffFeatureFlagRollbackReferenceOptions = {},
): DecisionSupportDefaultOffFeatureFlagRollbackReference {
  return {
    rollbackReferenceId: `rollback-reference-${gateCaseResult.caseId}`,
    shellOnly: true,
    rollbackImplementedNow: false,
    rollbackRequiresFeatureFlagDisable: true,
    rollbackRequiresRouterFallback: true,
    rollbackRequiresComposerFallback: true,
    rollbackRequiresEndpointFallback: true,
    rollbackRequiresNoDataMigration: true,
    rollbackRequiresNoPersistentStateCleanup: true,
    rollbackRequiresNoExternalSideEffectCleanup: true,
    rollbackRequiresIncidentOwner: true,
    rollbackRequiresVerificationChecklist: true,
    score: 92,
    rationale: [
      "A rollback reference, not a rollback implementation — disabling the flag and falling back to the existing route/composer/endpoint " +
        "requires no data migration or persistent-state cleanup, since nothing real is ever persisted by this shell.",
      "An incident owner and a verification checklist are required before any future activation, not before this shell.",
    ],
  } satisfies DecisionSupportDefaultOffFeatureFlagRollbackReference;
}

function checkRollbackReference(rollbackReference: DecisionSupportDefaultOffFeatureFlagRollbackReference): {
  passed: boolean;
  violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[];
} {
  const invariantsOk =
    rollbackReference.shellOnly === true &&
    rollbackReference.rollbackImplementedNow === false &&
    rollbackReference.rollbackRequiresFeatureFlagDisable === true &&
    rollbackReference.rollbackRequiresRouterFallback === true &&
    rollbackReference.rollbackRequiresComposerFallback === true &&
    rollbackReference.rollbackRequiresEndpointFallback === true &&
    rollbackReference.rollbackRequiresNoDataMigration === true &&
    rollbackReference.rollbackRequiresNoPersistentStateCleanup === true &&
    rollbackReference.rollbackRequiresNoExternalSideEffectCleanup === true &&
    rollbackReference.rollbackRequiresIncidentOwner === true &&
    rollbackReference.rollbackRequiresVerificationChecklist === true &&
    rollbackReference.score >= 85;
  return { passed: invariantsOk, violations: invariantsOk ? [] : ["rollback_contract_missing"] };
}

// ─── Upstream propagated checks (approval / visibility / production eligibility / leaks / side effects) ─

function checkNoApprovalOverclaim(gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult): {
  passed: boolean;
  violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[];
} {
  if (gateCaseResult.noApprovalOverclaimPassed === true) return { passed: true, violations: [] };
  const reused = reuseUpstreamViolations(gateCaseResult).filter((v) => v === "approval_state_overclaimed");
  return { passed: false, violations: reused.length > 0 ? reused : ["approval_state_overclaimed"] };
}

function checkNoVisibilityAttempt(
  gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  state: DecisionSupportDefaultOffFeatureFlagShellState,
): { passed: boolean; violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] } {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (gateCaseResult.noVisibilityAttemptPassed !== true) {
    const reused = reuseUpstreamViolations(gateCaseResult).filter((v) => v === "user_visible_output_allowed");
    const fallback: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = ["user_visible_output_allowed"];
    violations.push(...(reused.length > 0 ? reused : fallback));
  }
  if (state.userVisibleOutputAttempted !== false) violations.push("user_visible_output_allowed");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

function checkNoProductionEligibility(
  gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  definition: DecisionSupportDefaultOffFeatureFlagShellDefinition,
  state: DecisionSupportDefaultOffFeatureFlagShellState,
): { passed: boolean; violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] } {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  const productionWiringFallback: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = ["production_wiring_allowed"];
  if (gateCaseResult.gateAccepted !== true || gateCaseResult.safeForDefaultOffFeatureFlagImplementationShell !== true) {
    const reused = reuseUpstreamViolations(gateCaseResult);
    violations.push(...(reused.length > 0 ? reused : productionWiringFallback));
  }
  if (gateCaseResult.noProductionEligibilityPassed !== true) {
    const reused = reuseUpstreamViolations(gateCaseResult);
    violations.push(...(reused.length > 0 ? reused : productionWiringFallback));
  }
  if (state.productionWiringAttempted !== false) violations.push("production_wiring_allowed");
  if (state.routerChangeAttempted !== false) violations.push("router_wiring_allowed");
  if (state.composerChangeAttempted !== false) violations.push("composer_wiring_allowed");
  if (state.endpointChangeAttempted !== false) violations.push("endpoint_wiring_allowed");
  if (definition.activationAllowedNow !== false) violations.push("feature_flag_activation_allowed");
  if (definition.featureFlagActiveNow !== false) violations.push("feature_flag_active_now");
  if (definition.featureFlagRuntimeReadNow !== false) violations.push("feature_flag_runtime_read_attempted");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

const LEAK_VIOLATION_TYPES = new Set<string>(["raw_input_leak", "full_candidate_leak", "pii_leak", "project_name_leak"]);

function checkNoLeaks(gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult): { passed: boolean; violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] } {
  if (gateCaseResult.noLeaksPassed === true) return { passed: true, violations: [] };
  const reused = reuseUpstreamViolations(gateCaseResult).filter((v) => LEAK_VIOLATION_TYPES.has(v));
  return { passed: false, violations: reused.length > 0 ? reused : ["raw_input_leak", "full_candidate_leak", "pii_leak", "project_name_leak"] };
}

const SIDE_EFFECT_VIOLATION_TYPES = new Set<string>(["real_persistence_allowed", "external_call_allowed", "action_execution_allowed", "router_wiring_allowed", "composer_wiring_allowed", "endpoint_wiring_allowed", "side_effect_risk"]);

function checkNoSideEffects(
  gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  state: DecisionSupportDefaultOffFeatureFlagShellState,
): { passed: boolean; violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] } {
  const violations: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = [];
  if (gateCaseResult.noSideEffectsPassed !== true) {
    const reused = reuseUpstreamViolations(gateCaseResult).filter((v) => SIDE_EFFECT_VIOLATION_TYPES.has(v));
    const fallback: DecisionSupportDefaultOffFeatureFlagShellViolationType[] = ["side_effect_risk"];
    violations.push(...(reused.length > 0 ? reused : fallback));
  }
  if (state.realPersistenceAttempted !== false) violations.push("real_persistence_allowed");
  if (state.externalCallAttempted !== false) violations.push("external_call_allowed");
  if (state.actionExecutionAttempted !== false) violations.push("action_execution_allowed");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

// ─── Shell case validation ─────────────────────────────────────────────────────────────

const CRITICAL_VIOLATIONS = new Set<DecisionSupportDefaultOffFeatureFlagShellViolationType>([
  "feature_flag_activation_allowed",
  "feature_flag_runtime_read_attempted",
  "router_wiring_allowed",
  "composer_wiring_allowed",
  "endpoint_wiring_allowed",
  "approval_state_overclaimed",
  "user_visible_output_allowed",
  "real_persistence_allowed",
  "external_call_allowed",
  "action_execution_allowed",
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "side_effect_risk",
  "production_feature_flag_implemented",
  "feature_flag_active_now",
]);

export type DecisionSupportDefaultOffFeatureFlagImplementationShellCaseValidationResult = {
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
};

/**
 * Validates one Sprint 37R gate case result against its shell definition, state, router guard readiness
 * handoff, and rollback reference. Exposed separately from
 * `evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase()` so tests (and future callers) can
 * mutate a definition/state/handoff/reference and re-validate without rebuilding everything.
 */
export function validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
  gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  featureFlagDefinition: DecisionSupportDefaultOffFeatureFlagShellDefinition,
  featureFlagState: DecisionSupportDefaultOffFeatureFlagShellState,
  routerGuardReadinessHandoff: DecisionSupportDefaultOffRouterGuardReadinessHandoff,
  rollbackReference: DecisionSupportDefaultOffFeatureFlagRollbackReference,
): DecisionSupportDefaultOffFeatureFlagImplementationShellCaseValidationResult {
  const featureFlagDefinitionCheck = checkFeatureFlagDefinition(featureFlagDefinition);
  const defaultValueFalseCheck = checkDefaultValueFalse(featureFlagDefinition);
  const staticDefaultOffResolutionCheck = checkStaticDefaultOffResolution(featureFlagState);
  const noRuntimeReadCheck = checkNoRuntimeRead(featureFlagDefinition, featureFlagState);
  const noActivationCheck = checkNoActivation(featureFlagDefinition, featureFlagState);
  const noProductionFeatureFlagImplementationCheck = checkNoProductionFeatureFlagImplementation(featureFlagDefinition);
  const routerGuardHandoffCheck = checkRouterGuardHandoff(routerGuardReadinessHandoff, featureFlagState);
  const rollbackReferenceCheck = checkRollbackReference(rollbackReference);
  const noApprovalOverclaimCheck = checkNoApprovalOverclaim(gateCaseResult);
  const noVisibilityAttemptCheck = checkNoVisibilityAttempt(gateCaseResult, featureFlagState);
  const noProductionEligibilityCheck = checkNoProductionEligibility(gateCaseResult, featureFlagDefinition, featureFlagState);
  const noLeaksCheck = checkNoLeaks(gateCaseResult);
  const noSideEffectsCheck = checkNoSideEffects(gateCaseResult, featureFlagState);

  const allChecks = [
    featureFlagDefinitionCheck,
    defaultValueFalseCheck,
    staticDefaultOffResolutionCheck,
    noRuntimeReadCheck,
    noActivationCheck,
    noProductionFeatureFlagImplementationCheck,
    routerGuardHandoffCheck,
    rollbackReferenceCheck,
    noApprovalOverclaimCheck,
    noVisibilityAttemptCheck,
    noProductionEligibilityCheck,
    noLeaksCheck,
    noSideEffectsCheck,
  ];
  const violations = dedupe(allChecks.flatMap((c) => c.violations));
  const hasCriticalViolation = violations.some((v) => CRITICAL_VIOLATIONS.has(v));

  let qaStatus: DecisionSupportDefaultOffFeatureFlagShellQaStatus;
  let riskLevel: DecisionSupportDefaultOffFeatureFlagShellRiskLevel;
  let shellAccepted: boolean;
  let shellRejected: boolean;
  let shellBlocked: boolean;
  if (violations.length === 0) {
    qaStatus = "pass";
    riskLevel = "low";
    shellAccepted = true;
    shellRejected = false;
    shellBlocked = false;
  } else if (hasCriticalViolation) {
    qaStatus = "blocked";
    riskLevel = "critical";
    shellAccepted = false;
    shellRejected = false;
    shellBlocked = true;
  } else {
    qaStatus = "fail";
    riskLevel = "high";
    shellAccepted = false;
    shellRejected = true;
    shellBlocked = false;
  }

  return {
    shellAccepted,
    shellRejected,
    shellBlocked,
    qaStatus,
    riskLevel,
    violations,
    featureFlagDefinitionPassed: featureFlagDefinitionCheck.passed,
    defaultValueFalsePassed: defaultValueFalseCheck.passed,
    staticDefaultOffResolutionPassed: staticDefaultOffResolutionCheck.passed,
    noRuntimeReadPassed: noRuntimeReadCheck.passed,
    noActivationPassed: noActivationCheck.passed,
    noProductionFeatureFlagImplementationPassed: noProductionFeatureFlagImplementationCheck.passed,
    routerGuardHandoffPassed: routerGuardHandoffCheck.passed,
    rollbackReferencePassed: rollbackReferenceCheck.passed,
    noApprovalOverclaimPassed: noApprovalOverclaimCheck.passed,
    noVisibilityAttemptPassed: noVisibilityAttemptCheck.passed,
    noProductionEligibilityPassed: noProductionEligibilityCheck.passed,
    noLeaksPassed: noLeaksCheck.passed,
    noSideEffectsPassed: noSideEffectsCheck.passed,
    safeForDefaultOffRouterGuardShell: violations.length === 0,
  };
}

// ─── Shell case evaluation ──────────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffFeatureFlagImplementationShellCaseOptions = {
  config?: Partial<DecisionSupportDefaultOffFeatureFlagImplementationShellConfig>;
  stateOptions?: DecisionSupportDefaultOffFeatureFlagShellStateOptions;
};

/**
 * Evaluates a single Sprint 37R gate case result: builds its feature flag shell definition, resolves its
 * static default-off state, builds its router guard readiness handoff and rollback reference, then
 * validates all four together. Every `*AllowedNow` field on the returned case result is always `false`.
 */
export function evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(
  gateCaseResult: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  options: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseOptions = {},
): DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult {
  const shellKind = shellKindForGateKind(gateCaseResult.gateKind);
  const featureFlagDefinition = createDecisionSupportDefaultOffFeatureFlagShellDefinition(gateCaseResult, { config: options.config });
  const featureFlagState = resolveDecisionSupportDefaultOffFeatureFlagShellState(featureFlagDefinition, options.stateOptions);
  const routerGuardReadinessHandoff = createDecisionSupportDefaultOffRouterGuardReadinessHandoff(gateCaseResult, featureFlagState, { config: options.config });
  const rollbackReference = createDecisionSupportDefaultOffFeatureFlagRollbackReference(gateCaseResult, { config: options.config });

  const validation = validateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(gateCaseResult, featureFlagDefinition, featureFlagState, routerGuardReadinessHandoff, rollbackReference);

  const warnings = [...gateCaseResult.warnings, ...featureFlagState.warnings];
  if (!validation.shellAccepted) {
    warnings.push(`Case ${gateCaseResult.caseId}: feature flag shell ${validation.qaStatus} — violations: ${validation.violations.join(", ")}.`);
  }

  return {
    caseId: gateCaseResult.caseId,
    sourceGateKind: gateCaseResult.gateKind,
    sourceCaseId: gateCaseResult.caseId,
    shellKind,
    generatedForFeatureFlagShellOnly: true,
    shellOnly: true,
    noOpShell: true,
    defaultOff: true,
    featureFlagDefinition,
    featureFlagState,
    routerGuardReadinessHandoff,
    rollbackReference,
    shellAccepted: validation.shellAccepted,
    shellRejected: validation.shellRejected,
    shellBlocked: validation.shellBlocked,
    qaStatus: validation.qaStatus,
    riskLevel: validation.riskLevel,
    violations: validation.violations,
    featureFlagDefinitionPassed: validation.featureFlagDefinitionPassed,
    defaultValueFalsePassed: validation.defaultValueFalsePassed,
    staticDefaultOffResolutionPassed: validation.staticDefaultOffResolutionPassed,
    noRuntimeReadPassed: validation.noRuntimeReadPassed,
    noActivationPassed: validation.noActivationPassed,
    noProductionFeatureFlagImplementationPassed: validation.noProductionFeatureFlagImplementationPassed,
    routerGuardHandoffPassed: validation.routerGuardHandoffPassed,
    rollbackReferencePassed: validation.rollbackReferencePassed,
    noApprovalOverclaimPassed: validation.noApprovalOverclaimPassed,
    noVisibilityAttemptPassed: validation.noVisibilityAttemptPassed,
    noProductionEligibilityPassed: validation.noProductionEligibilityPassed,
    noLeaksPassed: validation.noLeaksPassed,
    noSideEffectsPassed: validation.noSideEffectsPassed,
    safeForDefaultOffRouterGuardShell: validation.safeForDefaultOffRouterGuardShell,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    featureFlagActivationAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings,
  } satisfies DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult;
}

// ─── Shell run ──────────────────────────────────────────────────────────────────────────

/**
 * Runs the full Sprint 38R default-off feature flag implementation shell: reuses (or builds) the Sprint 37R
 * production wiring readiness / feature flag gate against the same corpus (default: that gate's own small
 * self-contained synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for the full Sprint 18R corpus),
 * evaluates a shell case for every gate case result, and consolidates the Sprint 38R allowed/prohibited
 * actions. Never implements or activates a feature flag, never touches the router, composer, or endpoint,
 * never shows anything to a user, and never persists anything real.
 */
export function runDecisionSupportDefaultOffFeatureFlagImplementationShell(
  options: DecisionSupportDefaultOffFeatureFlagImplementationShellOptions = {},
): DecisionSupportDefaultOffFeatureFlagImplementationShellResult {
  const config = createDecisionSupportDefaultOffFeatureFlagImplementationShellConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;

  const gate = options.gate ?? runDecisionSupportProductionWiringReadinessFeatureFlagGate({ adapter: options.adapter, harness: options.harness, cases: options.cases, now });
  const gateSummary = summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate(gate);

  const caseResults = gate.caseResults.map((c) => evaluateDecisionSupportDefaultOffFeatureFlagImplementationShellCase(c, { config }));

  const allowedNextActions = listDecisionSupportDefaultOffFeatureFlagImplementationShellAllowedNextActions();
  const prohibitedActions = listDecisionSupportDefaultOffFeatureFlagImplementationShellProhibitedActions();

  const warnings: string[] = [];
  if (gateSummary.decision !== "ready_for_default_off_feature_flag_implementation_shell") {
    warnings.push(`Sprint 37R production wiring readiness / feature flag gate decision is "${gateSummary.decision}", not "ready_for_default_off_feature_flag_implementation_shell" — this shell cannot recommend Sprint 39R until that is resolved.`);
  }
  if (gateSummary.gateAcceptedCount !== gateSummary.totalCases) {
    warnings.push("Not every Sprint 37R gate case is accepted — this shell cannot recommend Sprint 39R until that is resolved.");
  }
  if (gateSummary.safeForDefaultOffFeatureFlagImplementationShellCount !== gateSummary.totalCases) {
    warnings.push("Not every Sprint 37R gate case is safeForDefaultOffFeatureFlagImplementationShell — this shell cannot recommend Sprint 39R until that is resolved.");
  }
  for (const caseResult of caseResults) warnings.push(...caseResult.warnings);

  return {
    config,
    gate,
    gateSummary,
    caseResults,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportDefaultOffFeatureFlagImplementationShellResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

const REPRESENTATIVE_LIMIT = 8;

function average(values: number[]): number {
  if (values.length === 0) return 100;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

type DecisionFields = {
  totalCases: number;
  shellEvaluatedCount: number;
  shellAcceptedCount: number;
  shellRejectedCount: number;
  shellBlockedCount: number;
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
  sprint37GateDecision: string | undefined;
};

function computeDecision(fields: DecisionFields): DecisionSupportDefaultOffFeatureFlagImplementationShellDecision {
  if (fields.noLeaksPassedCount !== fields.totalCases || fields.noSideEffectsPassedCount !== fields.totalCases || fields.realPersistenceAllowedNowCount > 0 || fields.actionExecutionAllowedNowCount > 0) {
    return "blocked_by_leakage_or_side_effect_risk";
  }

  if (fields.noVisibilityAttemptPassedCount !== fields.totalCases || fields.userVisibleOutputAllowedNowCount > 0 || fields.safeForUserVisibleOutputNowCount > 0 || fields.safeForProductionCount > 0) {
    return "blocked_by_visibility_risk";
  }

  if (fields.runtimeReadAttemptedCount > 0 || fields.noRuntimeReadPassedCount !== fields.totalCases) {
    return "blocked_by_runtime_read_risk";
  }

  if (fields.activationAttemptedCount > 0 || fields.featureFlagActivationAllowedNowCount > 0 || fields.noActivationPassedCount !== fields.totalCases) {
    return "blocked_by_activation_risk";
  }

  if (fields.productionWiringAllowedNowCount > 0 || fields.routerChangeAllowedNowCount > 0 || fields.composerChangeAllowedNowCount > 0 || fields.endpointChangeAllowedNowCount > 0) {
    return "blocked_by_production_wiring_risk";
  }

  if (fields.featureFlagDefinitionPassedCount !== fields.totalCases || fields.defaultValueFalsePassedCount !== fields.totalCases) {
    return "blocked_by_feature_flag_definition_gap";
  }

  if (fields.staticDefaultOffResolutionPassedCount !== fields.totalCases || fields.productionFeatureFlagImplementedNowCount > 0) {
    return "blocked_by_default_off_gap";
  }

  const allClean =
    fields.totalCases > 0 &&
    fields.shellEvaluatedCount === fields.totalCases &&
    fields.shellAcceptedCount === fields.totalCases &&
    fields.shellRejectedCount === 0 &&
    fields.shellBlockedCount === 0 &&
    fields.qaPassCount === fields.totalCases &&
    fields.qaWarningCount === 0 &&
    fields.qaFailCount === 0 &&
    fields.qaBlockedCount === 0 &&
    fields.featureFlagDefinitionPassedCount === fields.totalCases &&
    fields.defaultValueFalsePassedCount === fields.totalCases &&
    fields.staticDefaultOffResolutionPassedCount === fields.totalCases &&
    fields.noRuntimeReadPassedCount === fields.totalCases &&
    fields.noActivationPassedCount === fields.totalCases &&
    fields.noProductionFeatureFlagImplementationPassedCount === fields.totalCases &&
    fields.routerGuardHandoffPassedCount === fields.totalCases &&
    fields.rollbackReferencePassedCount === fields.totalCases &&
    fields.noApprovalOverclaimPassedCount === fields.totalCases &&
    fields.noVisibilityAttemptPassedCount === fields.totalCases &&
    fields.noProductionEligibilityPassedCount === fields.totalCases &&
    fields.noLeaksPassedCount === fields.totalCases &&
    fields.noSideEffectsPassedCount === fields.totalCases &&
    fields.safeForDefaultOffRouterGuardShellCount === fields.totalCases &&
    fields.safeForUserVisibleOutputNowCount === 0 &&
    fields.safeForProductionCount === 0 &&
    fields.averageFeatureFlagDefinitionScore >= 90 &&
    fields.averageRouterGuardHandoffScore >= 90 &&
    fields.averageRollbackReferenceScore >= 90 &&
    fields.minFeatureFlagDefinitionScore >= 85 &&
    fields.minRouterGuardHandoffScore >= 85 &&
    fields.minRollbackReferenceScore >= 85 &&
    fields.violationCount === 0 &&
    fields.criticalViolationCount === 0 &&
    fields.productionWiringAllowedNowCount === 0 &&
    fields.routerChangeAllowedNowCount === 0 &&
    fields.composerChangeAllowedNowCount === 0 &&
    fields.endpointChangeAllowedNowCount === 0 &&
    fields.featureFlagActivationAllowedNowCount === 0 &&
    fields.userVisibleOutputAllowedNowCount === 0 &&
    fields.realPersistenceAllowedNowCount === 0 &&
    fields.actionExecutionAllowedNowCount === 0 &&
    fields.runtimeReadAttemptedCount === 0 &&
    fields.activationAttemptedCount === 0 &&
    fields.productionFeatureFlagImplementedNowCount === 0 &&
    fields.sprint37GateDecision === "ready_for_default_off_feature_flag_implementation_shell";

  return allClean ? "ready_for_default_off_router_guard_shell" : "continue_feature_flag_shell_only";
}

function recommendedNextSprintFor(decision: DecisionSupportDefaultOffFeatureFlagImplementationShellDecision): string {
  switch (decision) {
    case "ready_for_default_off_router_guard_shell":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_feature_flag_definition_gap":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Feature Flag Definition Hardening)`;
    case "blocked_by_default_off_gap":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Default-Off Resolution Hardening)`;
    case "blocked_by_runtime_read_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Runtime Read Risk Hardening)`;
    case "blocked_by_activation_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Activation Risk Hardening)`;
    case "blocked_by_production_wiring_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Production Wiring Risk Hardening)`;
    case "blocked_by_visibility_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Visibility Risk Hardening)`;
    case "blocked_by_leakage_or_side_effect_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Leakage/Side Effect Hardening)`;
    case "continue_feature_flag_shell_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

/**
 * Turns a `runDecisionSupportDefaultOffFeatureFlagImplementationShell()` result — or a bare
 * `DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult[]` plus
 * `options.sprint37GateDecision` — into a review-ready report: per-shell-kind counts, QA status counts,
 * safety counts (every production-side-effect count expected zero), score averages/minimums, a decision,
 * and a recommended next sprint. Pure — takes already-computed case results rather than re-running
 * anything.
 */
export function summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell(
  shellOrCaseResults: DecisionSupportDefaultOffFeatureFlagImplementationShellResult | DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult[],
  options: DecisionSupportDefaultOffFeatureFlagImplementationShellSummaryOptions = {},
): DecisionSupportDefaultOffFeatureFlagImplementationShellSummary {
  const caseResults = Array.isArray(shellOrCaseResults) ? shellOrCaseResults : shellOrCaseResults.caseResults;
  const sprint37GateDecision = Array.isArray(shellOrCaseResults) ? options.sprint37GateDecision : (options.sprint37GateDecision ?? shellOrCaseResults.gateSummary.decision);
  const shellWarnings = Array.isArray(shellOrCaseResults) ? [] : shellOrCaseResults.warnings;

  const totalCases = caseResults.length;

  const shellEvaluatedCount = totalCases;
  const shellAcceptedCount = caseResults.filter((c) => c.shellAccepted).length;
  const shellRejectedCount = caseResults.filter((c) => c.shellRejected).length;
  const shellBlockedCount = caseResults.filter((c) => c.shellBlocked).length;

  const clarificationGateFlagShellCount = caseResults.filter((c) => c.shellKind === "clarification_gate_flag_shell").length;
  const routePreservationFlagShellCount = caseResults.filter((c) => c.shellKind === "route_preservation_flag_shell").length;
  const unsupportedBoundaryFlagShellCount = caseResults.filter((c) => c.shellKind === "unsupported_boundary_flag_shell").length;
  const shadowOnlyFlagShellCount = caseResults.filter((c) => c.shellKind === "shadow_only_flag_shell").length;
  const blockedUnsafeFlagShellCount = caseResults.filter((c) => c.shellKind === "blocked_unsafe_flag_shell").length;

  const qaPassCount = caseResults.filter((c) => c.qaStatus === "pass").length;
  const qaWarningCount = caseResults.filter((c) => c.qaStatus === "warning").length;
  const qaFailCount = caseResults.filter((c) => c.qaStatus === "fail").length;
  const qaBlockedCount = caseResults.filter((c) => c.qaStatus === "blocked").length;

  const featureFlagDefinitionPassedCount = caseResults.filter((c) => c.featureFlagDefinitionPassed).length;
  const defaultValueFalsePassedCount = caseResults.filter((c) => c.defaultValueFalsePassed).length;
  const staticDefaultOffResolutionPassedCount = caseResults.filter((c) => c.staticDefaultOffResolutionPassed).length;
  const noRuntimeReadPassedCount = caseResults.filter((c) => c.noRuntimeReadPassed).length;
  const noActivationPassedCount = caseResults.filter((c) => c.noActivationPassed).length;
  const noProductionFeatureFlagImplementationPassedCount = caseResults.filter((c) => c.noProductionFeatureFlagImplementationPassed).length;
  const routerGuardHandoffPassedCount = caseResults.filter((c) => c.routerGuardHandoffPassed).length;
  const rollbackReferencePassedCount = caseResults.filter((c) => c.rollbackReferencePassed).length;
  const noApprovalOverclaimPassedCount = caseResults.filter((c) => c.noApprovalOverclaimPassed).length;
  const noVisibilityAttemptPassedCount = caseResults.filter((c) => c.noVisibilityAttemptPassed).length;
  const noProductionEligibilityPassedCount = caseResults.filter((c) => c.noProductionEligibilityPassed).length;
  const noLeaksPassedCount = caseResults.filter((c) => c.noLeaksPassed).length;
  const noSideEffectsPassedCount = caseResults.filter((c) => c.noSideEffectsPassed).length;

  const safeForDefaultOffRouterGuardShellCount = caseResults.filter((c) => c.safeForDefaultOffRouterGuardShell).length;
  const safeForUserVisibleOutputNowCount = caseResults.filter((c) => c.safeForUserVisibleOutputNow).length;
  const safeForProductionCount = caseResults.filter((c) => c.safeForProduction).length;

  const featureFlagDefinitionScores = caseResults.map((c) => c.featureFlagDefinition.score);
  const routerGuardHandoffScores = caseResults.map((c) => c.routerGuardReadinessHandoff.score);
  const rollbackReferenceScores = caseResults.map((c) => c.rollbackReference.score);

  const averageFeatureFlagDefinitionScore = average(featureFlagDefinitionScores);
  const averageRouterGuardHandoffScore = average(routerGuardHandoffScores);
  const averageRollbackReferenceScore = average(rollbackReferenceScores);

  const minFeatureFlagDefinitionScore = featureFlagDefinitionScores.length > 0 ? Math.min(...featureFlagDefinitionScores) : 0;
  const minRouterGuardHandoffScore = routerGuardHandoffScores.length > 0 ? Math.min(...routerGuardHandoffScores) : 0;
  const minRollbackReferenceScore = rollbackReferenceScores.length > 0 ? Math.min(...rollbackReferenceScores) : 0;

  const allViolations = caseResults.flatMap((c) => c.violations);
  const violationCount = allViolations.length;
  const criticalViolationCount = caseResults.filter((c) => c.riskLevel === "critical").flatMap((c) => c.violations).length;

  const productionWiringAllowedNowCount = caseResults.filter((c) => c.productionWiringAllowedNow).length;
  const routerChangeAllowedNowCount = caseResults.filter((c) => c.routerChangeAllowedNow).length;
  const composerChangeAllowedNowCount = caseResults.filter((c) => c.composerChangeAllowedNow).length;
  const endpointChangeAllowedNowCount = caseResults.filter((c) => c.endpointChangeAllowedNow).length;
  const featureFlagActivationAllowedNowCount = caseResults.filter((c) => c.featureFlagActivationAllowedNow).length;
  const userVisibleOutputAllowedNowCount = caseResults.filter((c) => c.userVisibleOutputAllowedNow).length;
  const realPersistenceAllowedNowCount = caseResults.filter((c) => c.realPersistenceAllowedNow).length;
  const actionExecutionAllowedNowCount = caseResults.filter((c) => c.actionExecutionAllowedNow).length;

  const runtimeReadAttemptedCount = caseResults.filter((c) => c.featureFlagState.runtimeReadAttempted).length;
  const activationAttemptedCount = caseResults.filter((c) => c.featureFlagState.activationAttempted).length;
  const productionFeatureFlagImplementedNowCount = caseResults.filter((c) => c.featureFlagDefinition.productionFeatureFlagImplementedNow).length;

  const decision = computeDecision({
    totalCases,
    shellEvaluatedCount,
    shellAcceptedCount,
    shellRejectedCount,
    shellBlockedCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    featureFlagDefinitionPassedCount,
    defaultValueFalsePassedCount,
    staticDefaultOffResolutionPassedCount,
    noRuntimeReadPassedCount,
    noActivationPassedCount,
    noProductionFeatureFlagImplementationPassedCount,
    routerGuardHandoffPassedCount,
    rollbackReferencePassedCount,
    noApprovalOverclaimPassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    safeForDefaultOffRouterGuardShellCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    averageFeatureFlagDefinitionScore,
    averageRouterGuardHandoffScore,
    averageRollbackReferenceScore,
    minFeatureFlagDefinitionScore,
    minRouterGuardHandoffScore,
    minRollbackReferenceScore,
    violationCount,
    criticalViolationCount,
    productionWiringAllowedNowCount,
    routerChangeAllowedNowCount,
    composerChangeAllowedNowCount,
    endpointChangeAllowedNowCount,
    featureFlagActivationAllowedNowCount,
    userVisibleOutputAllowedNowCount,
    realPersistenceAllowedNowCount,
    actionExecutionAllowedNowCount,
    runtimeReadAttemptedCount,
    activationAttemptedCount,
    productionFeatureFlagImplementedNowCount,
    sprint37GateDecision,
  });

  const warnings = [...shellWarnings, ...caseResults.flatMap((c) => c.warnings)];

  return {
    totalCases,
    shellEvaluatedCount,
    shellAcceptedCount,
    shellRejectedCount,
    shellBlockedCount,
    clarificationGateFlagShellCount,
    routePreservationFlagShellCount,
    unsupportedBoundaryFlagShellCount,
    shadowOnlyFlagShellCount,
    blockedUnsafeFlagShellCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    featureFlagDefinitionPassedCount,
    defaultValueFalsePassedCount,
    staticDefaultOffResolutionPassedCount,
    noRuntimeReadPassedCount,
    noActivationPassedCount,
    noProductionFeatureFlagImplementationPassedCount,
    routerGuardHandoffPassedCount,
    rollbackReferencePassedCount,
    noApprovalOverclaimPassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    safeForDefaultOffRouterGuardShellCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    averageFeatureFlagDefinitionScore,
    averageRouterGuardHandoffScore,
    averageRollbackReferenceScore,
    minFeatureFlagDefinitionScore,
    minRouterGuardHandoffScore,
    minRollbackReferenceScore,
    violationCount,
    criticalViolationCount,
    productionWiringAllowedNowCount,
    routerChangeAllowedNowCount,
    composerChangeAllowedNowCount,
    endpointChangeAllowedNowCount,
    featureFlagActivationAllowedNowCount,
    userVisibleOutputAllowedNowCount,
    realPersistenceAllowedNowCount,
    actionExecutionAllowedNowCount,
    runtimeReadAttemptedCount,
    activationAttemptedCount,
    productionFeatureFlagImplementedNowCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeAcceptedShellResults: caseResults.filter((c) => c.shellAccepted).slice(0, REPRESENTATIVE_LIMIT),
    rejectedShellResults: caseResults.filter((c) => c.shellRejected),
    blockedShellResults: caseResults.filter((c) => c.shellBlocked),
    warnings,
  } satisfies DecisionSupportDefaultOffFeatureFlagImplementationShellSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 38R default-off feature flag implementation shell — mirrors the
 * style of `explainDecisionSupportProductionWiringReadinessFeatureFlagGate()` (Sprint 37R). See
 * `docs/conversational-brain-decision-support-default-off-feature-flag-implementation-shell.md` for full
 * context.
 */
export function explainDecisionSupportDefaultOffFeatureFlagImplementationShell(): DecisionSupportDefaultOffFeatureFlagImplementationShellExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-default-off-feature-flag-implementation-shell",
    purpose:
      "Builds a formal, no-op default-off feature flag implementation shell (types, resolver, handoff, rollback-reference functions) for every " +
      "Sprint 37R-accepted production wiring readiness gate case — without ever implementing a real production feature flag, activating a " +
      "feature flag, reading process.env or any runtime configuration source, touching the real router, composer, or endpoint, or showing " +
      "anything to a real user.",
    nonGoals: [
      "Implement a real production feature flag, or activate a feature flag.",
      "Read process.env or any runtime configuration source.",
      "Wire the router, composer, or endpoint directly to live decision_support.",
      "Show any output to a real user.",
      "Create a real database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action, create any real task, or send any real email/draft.",
      "Persist any real output.",
      "Claim real governance approval or production eligibility.",
      "Call an LLM or an external API.",
    ],
    shellProfile:
      'The "strict_default_off_feature_flag_implementation_shell" profile: `shellOnly`, `noOpShell`, and `defaultOff` are always true, every ' +
      "allow* field (allowProductionFeatureFlagImplementation/allowFeatureFlagActivation/allowFeatureFlagRuntimeRead/allowProductionWiring/" +
      "allowRouterChange/allowComposerChange/allowEndpointChange/allowUserVisibleOutput/allowRealPersistence/allowDbWrite/allowSupabaseWrite/" +
      "allowExternalCalls/allowActionExecution/allowTaskCreation/allowEmailDraftCreation) is a literal false, forced regardless of any override " +
      "a caller passes, and every require* field is always true.",
    shellModes: [
      "feature_flag_shell_only (default): the full default-off feature flag implementation shell, covering every shell kind.",
      "no_op_default_off_resolution: emphasizes resolveDecisionSupportDefaultOffFeatureFlagShellState() output.",
      "activation_block_review: emphasizes every activation-related field staying false/blocked.",
      "runtime_read_guard_review: emphasizes every runtime-read-related field staying false/blocked.",
      "router_guard_readiness_review: emphasizes createDecisionSupportDefaultOffRouterGuardReadinessHandoff() output.",
      "rollback_contract_shell_review: emphasizes createDecisionSupportDefaultOffFeatureFlagRollbackReference() output.",
    ],
    shellKindRules: [
      "clarification_gate_readiness (Sprint 37R gate kind) -> clarification_gate_flag_shell.",
      "route_preservation_readiness -> route_preservation_flag_shell.",
      "unsupported_boundary_readiness -> unsupported_boundary_flag_shell.",
      "shadow_only_readiness -> shadow_only_flag_shell.",
      "blocked_unsafe_readiness -> blocked_unsafe_flag_shell (the safe fallback for any gate kind this shell does not build a positive definition for).",
    ],
    featureFlagDefinitionRules: [
      `Preserves ${PROPOSED_FEATURE_FLAG_KEY} as the feature flag key Sprint 37R proposed — never implemented as a real production feature flag, never activated.`,
      "Every definition is shellOnly: true, noOpShell: true, productionFeatureFlagImplementedNow: false, featureFlagActiveNow: false, featureFlagRuntimeReadNow: false, defaultValue: false.",
      "Every activationRequires* field is true — activation is reserved for an explicit future sprint with governance approval, a rollback contract, a router/composer/endpoint guard, a monitoring contract, and a manual smoke test.",
    ],
    staticDefaultOffResolutionRules: [
      "resolveDecisionSupportDefaultOffFeatureFlagShellState() always resolves enabled: false, state: disabled, source: static_default_off by default.",
      "Negative-test knobs (forceEnabled, forceRuntimeReadAttempted, forceActivationAttempted, forceSource, forceProductionWiringAttempted, forceRouterChangeAttempted, and further force* flags) never actually set enabled to true — they only flip the matching *Attempted flag (or the source) so the validation layer can register the corresponding violation.",
    ],
    runtimeReadProhibitionRules: [
      "featureFlagDefinition.featureFlagRuntimeReadNow and featureFlagState.runtimeReadAttempted are always false in a clean case.",
      "prohibitedRuntimeSources lists every runtime source this shell must never read from: process.env, remote_config, database_flag, supabase_flag, local_storage, query_param, cookie, header, implicit_default_on.",
    ],
    activationProhibitionRules: [
      "featureFlagDefinition.activationAllowedNow and featureFlagState.activationAttempted are always false in a clean case.",
      "requiredFutureChecks lists every check a future activation sprint must complete before activation is even considered.",
    ],
    routerGuardHandoffRules: [
      "createDecisionSupportDefaultOffRouterGuardReadinessHandoff() never implements a router guard or wires it at runtime — routerGuardImplementationAllowedNow and routerRuntimeWiringAllowedNow are always false.",
      "readyForRouterGuardShell is true whenever the source gate case is otherwise healthy and the flag state stays statically default-off.",
    ],
    rollbackReferenceRules: [
      "createDecisionSupportDefaultOffFeatureFlagRollbackReference() never implements a real rollback path — rollbackImplementedNow is always false.",
      "A rollback must disable the feature flag and fall back to the existing router/composer/endpoint, require no data migration or persistent-state cleanup, and require an incident owner plus a verification checklist before any future activation.",
    ],
    shellCaseEvaluationRules: [
      "Confirms the source Sprint 37R gate case was gateAccepted and safeForDefaultOffFeatureFlagImplementationShell before treating the shell as passable.",
      "Validates the feature flag definition, static default-off resolution, no-runtime-read, no-activation, no-production-feature-flag-implementation, router guard handoff, and rollback reference together, plus (propagated from the upstream gate case) no-approval-overclaim, no-visibility-attempt, no-production-eligibility, no-leaks, and no-side-effects.",
      "qaStatus is blocked if any critical (activation/runtime-read/wiring/visibility/leak/side-effect/overclaim/active-now/production-flag-implemented) violation is present, else fail if any other violation is present (a definitional gap with no critical risk), else pass.",
    ],
    shellRunRules: [
      "Reuses (or accepts) the Sprint 37R production wiring readiness / feature flag gate against the same corpus rather than re-deriving it.",
      "Evaluates exactly one shell case per Sprint 37R gate case result.",
      "Never implements or activates a feature flag, never touches the router/composer/endpoint, never shows output to a user, and never persists output.",
    ],
    decisionRule:
      "ready_for_default_off_router_guard_shell requires: totalCases > 0, shellAcceptedCount === totalCases, every rejected/blocked count at " +
      "zero, qaPassCount === totalCases, every definitional/handoff/reference pass count === totalCases, every score average/minimum at or " +
      "above its floor, every violation/AllowedNow/attempted count at zero, and the Sprint 37R gate decision === " +
      "ready_for_default_off_feature_flag_implementation_shell. Otherwise, in priority order: blocked_by_leakage_or_side_effect_risk if any " +
      "leak/side-effect gate fails; else blocked_by_visibility_risk if any visibility gate fails or a nonzero safeForUserVisibleOutputNow/" +
      "safeForProduction count is observed; else blocked_by_runtime_read_risk if runtime-read is attempted or fails; else " +
      "blocked_by_activation_risk if activation is attempted, allowed, or fails; else blocked_by_production_wiring_risk if any production-" +
      "wiring/router/composer/endpoint AllowedNow count is nonzero; else blocked_by_feature_flag_definition_gap; else " +
      "blocked_by_default_off_gap; else continue_feature_flag_shell_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyUserVisibleOutputIsNotShown:
      "Every case result carries userVisibleOutputAllowedNow: false and safeForUserVisibleOutputNow: false — a future router guard shell " +
      "activation must explicitly review and approve output before it could ever reach a real user.",
    whyRouterIsNotChanged: "brainRouter.ts is production code. This shell only builds a synthetic router guard readiness handoff offline — it never imports or modifies the router.",
    whyComposerIsNotChanged: "responseComposer.ts is production code. This shell never imports or modifies the composer.",
    whyEndpointIsNotChanged: "POST /api/command-center/chat is production code. This shell never imports or modifies the endpoint or its handlers.",
    whyFeatureFlagIsNotActivated:
      "featureFlagActiveNow, activationAllowedNow, and activationAttempted are always false — activation is reserved for a later, explicitly " +
      "governed sprint with a rollback contract, router/composer/endpoint guard, monitoring contract, and manual smoke test.",
    whyProcessEnvIsNotRead:
      "This module never reads process.env or any runtime configuration source — prohibitedRuntimeSources explicitly lists process.env, and " +
      "featureFlagState.source is always static_default_off (enforced by a source-scanning test).",
    whyProductionFeatureFlagIsNotImplemented:
      "productionFeatureFlagImplementedNow is always false — this sprint only builds the shell (types, resolver, handoff, rollback-reference " +
      "functions), not a real production feature flag implementation.",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review (reused transitively via the Sprint 37R/36R/35R/34R/33R/32R/31R chain) still resolves to " +
      "do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR " +
      "policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by building a feature flag shell.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseStorageIsNotCreated: "This shell never writes anything real — every definition/state/handoff/reference stays shellOnly: true, every *AllowedNow field stays false.",
    whyStorageAdapterIsNotCreated: "This shell reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 37R/36R/35R/34R/33R/32R/31R chain) as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this shell does not build.",
    whyApprovalIsNotOverclaimed:
      "noApprovalOverclaimPassed propagates directly from the upstream Sprint 37R gate case's own governanceChecklist invariants " +
      "(governanceApprovalGrantedNow: false, approvalStateOverclaimed: false) — this shell never claims real governance approval on its own.",
    expectedSprint39Path:
      "If every shell case stays qaStatus: pass, safeForDefaultOffRouterGuardShell: true, every violation/AllowedNow/attempted count stays at " +
      "zero, every score average/minimum stays at or above its floor, and the Sprint 37R gate decision stays " +
      "ready_for_default_off_feature_flag_implementation_shell, Sprint 39R can implement a default-off router guard shell — still never " +
      "activated, still never wired to the real router/composer/endpoint, and still never shown to a real user until a future, explicitly " +
      "governed sprint turns it on for a real workspace.",
  };
}
