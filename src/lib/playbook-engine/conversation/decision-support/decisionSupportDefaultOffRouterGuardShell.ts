/**
 * Sprint 39R — Decision Support Default-Off Router Guard Shell.
 *
 * A pure, offline, deterministic, **shell-only** router guard shell — not a real router guard, not a real
 * router import, not a real route mutation — that reviews every Sprint 38R-accepted default-off feature flag
 * implementation shell case against a formal (but entirely no-op) router guard definition, a static
 * feature-flag-state reference, a no-op route evaluation, a composer guard readiness handoff, and a router
 * rollback reference. It never touches the real router, never imports the real router, never mutates a live
 * route, never activates a feature flag, never reads `process.env` or any runtime configuration source,
 * never touches the real composer or endpoint, never shows anything to a real user, and never persists
 * anything real.
 *
 * Reuses, rather than reimplements: the Sprint 38R default-off feature flag implementation shell
 * (`runDecisionSupportDefaultOffFeatureFlagImplementationShell`,
 * `summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell`), which in turn reuses the entire
 * Sprint 18R-37R chain (production wiring readiness / feature flag gate, default-off route/composer
 * integration adapter, user-visible dry run evaluation harness, response draft quality evaluation, response
 * draft harness, response QA dry run plan, clarification-gated integration plan, controlled shadow replay,
 * persistence readiness review, and every earlier shadow-mode/classifier evaluation).
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call Supabase,
 * send email, create a task, or call an LLM; does not use `fetch`; does not read an environment variable or
 * activate a feature flag; and does not connect `decision_support` to the router. It never shows any
 * decision-support output to a user, and it never persists any real output. Every definition, state
 * reference, route evaluation, handoff, and rollback reference this module produces is `shellOnly: true`,
 * `noOpRouterGuard: true`, `generatedForRouterGuardShellOnly: true`, and every `*AllowedNow` field on a case
 * result is always `false`. See
 * `docs/conversational-brain-decision-support-default-off-router-guard-shell.md` for the full design
 * writeup.
 */

import {
  runDecisionSupportDefaultOffFeatureFlagImplementationShell,
  summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell,
} from "./decisionSupportDefaultOffFeatureFlagImplementationShell";

import type {
  DecisionSupportDefaultOffComposerGuardReadinessHandoff,
  DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  DecisionSupportDefaultOffFutureRouteIntent,
  DecisionSupportDefaultOffLiveRouteDecision,
  DecisionSupportDefaultOffRouterGuardFeatureFlagSource,
  DecisionSupportDefaultOffRouterGuardFeatureFlagState,
  DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference,
  DecisionSupportDefaultOffRouterGuardFeatureFlagStateReferenceOptions,
  DecisionSupportDefaultOffRouterGuardRollbackReference,
  DecisionSupportDefaultOffRouterGuardRouteEvaluation,
  DecisionSupportDefaultOffRouterGuardRouteEvaluationOptions,
  DecisionSupportDefaultOffRouterGuardShellCaseResult,
  DecisionSupportDefaultOffRouterGuardShellConfig,
  DecisionSupportDefaultOffRouterGuardShellDecision,
  DecisionSupportDefaultOffRouterGuardShellDefinition,
  DecisionSupportDefaultOffRouterGuardShellExplain,
  DecisionSupportDefaultOffRouterGuardShellKind,
  DecisionSupportDefaultOffRouterGuardShellOptions,
  DecisionSupportDefaultOffRouterGuardShellQaStatus,
  DecisionSupportDefaultOffRouterGuardShellResult,
  DecisionSupportDefaultOffRouterGuardShellRiskLevel,
  DecisionSupportDefaultOffRouterGuardShellSummary,
  DecisionSupportDefaultOffRouterGuardShellSummaryOptions,
  DecisionSupportDefaultOffRouterGuardShellViolationType,
} from "./decisionSupportDefaultOffRouterGuardShellTypes";

export type {
  DecisionSupportDefaultOffRouterGuardShellProfile,
  DecisionSupportDefaultOffRouterGuardShellMode,
  DecisionSupportDefaultOffRouterGuardShellDecision,
  DecisionSupportDefaultOffRouterGuardShellKind,
  DecisionSupportDefaultOffLiveRouteDecision,
  DecisionSupportDefaultOffFutureRouteIntent,
  DecisionSupportDefaultOffRouterGuardFeatureFlagState,
  DecisionSupportDefaultOffRouterGuardFeatureFlagSource,
  DecisionSupportDefaultOffRouterGuardShellStatus,
  DecisionSupportDefaultOffRouterGuardShellQaStatus,
  DecisionSupportDefaultOffRouterGuardShellRiskLevel,
  DecisionSupportDefaultOffRouterGuardShellViolationType,
  DecisionSupportDefaultOffRouterGuardShellConfig,
  DecisionSupportDefaultOffRouterGuardShellDefinition,
  DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference,
  DecisionSupportDefaultOffRouterGuardFeatureFlagStateReferenceOptions,
  DecisionSupportDefaultOffRouterGuardRouteEvaluation,
  DecisionSupportDefaultOffRouterGuardRouteEvaluationOptions,
  DecisionSupportDefaultOffComposerGuardReadinessHandoff,
  DecisionSupportDefaultOffRouterGuardRollbackReference,
  DecisionSupportDefaultOffRouterGuardShellCaseResult,
  DecisionSupportDefaultOffRouterGuardShellOptions,
  DecisionSupportDefaultOffRouterGuardShellResult,
  DecisionSupportDefaultOffRouterGuardShellSummaryOptions,
  DecisionSupportDefaultOffRouterGuardShellSummary,
  DecisionSupportDefaultOffRouterGuardShellExplain,
  DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
} from "./decisionSupportDefaultOffRouterGuardShellTypes";

export const DECISION_SUPPORT_DEFAULT_OFF_ROUTER_GUARD_SHELL_VERSION = "39R.1.0";

const PROPOSED_FEATURE_FLAG_KEY = "pmfreak.decisionSupport.defaultOffRouteComposerAdapter" as const;

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 40R — Default-Off Composer Guard Shell";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 39R — Default-Off Router Guard Shell";

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_default_off_router_guard_shell"` default config. Every `allow*` real-side-
 * effect field is always `false`, forced regardless of any override a caller passes — mirroring how every
 * prior sprint's config never actually loosens its own `allow*` real-side-effect flags from an override.
 * Every `require*` field is always `true`.
 */
export function createDecisionSupportDefaultOffRouterGuardShellConfig(
  overrides: Partial<DecisionSupportDefaultOffRouterGuardShellConfig> = {},
): DecisionSupportDefaultOffRouterGuardShellConfig {
  const config: DecisionSupportDefaultOffRouterGuardShellConfig = {
    profile: "strict_default_off_router_guard_shell",
    mode: overrides.mode ?? "router_guard_shell_only",
    shellOnly: true,
    noOpRouterGuard: true,
    defaultOff: true,
    proposedFeatureFlagKey: PROPOSED_FEATURE_FLAG_KEY,
    // These seventeen are never actually loosened here, regardless of what a caller's override object
    // claims — this is the default-off router guard shell's own strict, non-negotiable invariant.
    allowProductionRouterGuardImplementation: false,
    allowRouterImport: false,
    allowRouterRuntimeWiring: false,
    allowRouteMutation: false,
    allowFeatureFlagRuntimeRead: false,
    allowFeatureFlagActivation: false,
    allowProductionWiring: false,
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
    requireFeatureFlagShellPass: true,
    requireDefaultOffFeatureFlagState: true,
    requireNoRouterImport: true,
    requireNoRouterRuntimeWiring: true,
    requireNoRouteMutation: true,
    requireCurrentRoutePreservation: true,
    requireComposerGuardHandoff: true,
    requireRollbackRouteReference: true,
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
  "Implement a default-off composer guard shell.",
  "Implement a composer guard contract implementation.",
  "Write composer guard default-off tests.",
  "Write no-op route-to-composer handoff tests.",
  "Write user-visible output blocking tests.",
  "Write a composer rollback no-op plan.",
  "Conduct an endpoint guard readiness review.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Import real router.",
  "Wire router to decision_support.",
  "Mutate live route.",
  "Activate feature flag.",
  "Read runtime feature flag.",
  "Read process.env.",
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
export function listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportDefaultOffRouterGuardShellProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Shell kind mapping ───────────────────────────────────────────────────────────────

function routerGuardShellKindForFeatureFlagShellKind(featureFlagShellKind: string): DecisionSupportDefaultOffRouterGuardShellKind {
  switch (featureFlagShellKind) {
    case "clarification_gate_flag_shell":
      return "clarification_gate_router_guard_shell";
    case "route_preservation_flag_shell":
      return "route_preservation_router_guard_shell";
    case "unsupported_boundary_flag_shell":
      return "unsupported_boundary_router_guard_shell";
    case "shadow_only_flag_shell":
      return "shadow_only_router_guard_shell";
    case "blocked_unsafe_flag_shell":
    default:
      return "blocked_unsafe_router_guard_shell";
  }
}

function requiresPreservationForShellKind(shellKind: DecisionSupportDefaultOffRouterGuardShellKind): {
  requiresClarificationGatePreservation: boolean;
  requiresExistingRoutePreservation: boolean;
  requiresUnsupportedBoundaryPreservation: boolean;
  requiresShadowOnlyPreservation: boolean;
  requiresUnsafeRouteBlock: boolean;
} {
  switch (shellKind) {
    case "clarification_gate_router_guard_shell":
      return { requiresClarificationGatePreservation: true, requiresExistingRoutePreservation: false, requiresUnsupportedBoundaryPreservation: false, requiresShadowOnlyPreservation: false, requiresUnsafeRouteBlock: false };
    case "route_preservation_router_guard_shell":
      return { requiresClarificationGatePreservation: false, requiresExistingRoutePreservation: true, requiresUnsupportedBoundaryPreservation: false, requiresShadowOnlyPreservation: false, requiresUnsafeRouteBlock: false };
    case "unsupported_boundary_router_guard_shell":
      return { requiresClarificationGatePreservation: false, requiresExistingRoutePreservation: false, requiresUnsupportedBoundaryPreservation: true, requiresShadowOnlyPreservation: false, requiresUnsafeRouteBlock: false };
    case "shadow_only_router_guard_shell":
      return { requiresClarificationGatePreservation: false, requiresExistingRoutePreservation: false, requiresUnsupportedBoundaryPreservation: false, requiresShadowOnlyPreservation: true, requiresUnsafeRouteBlock: false };
    case "blocked_unsafe_router_guard_shell":
    default:
      return { requiresClarificationGatePreservation: false, requiresExistingRoutePreservation: false, requiresUnsupportedBoundaryPreservation: false, requiresShadowOnlyPreservation: false, requiresUnsafeRouteBlock: true };
  }
}

function futureRouteIntentForShellKind(shellKind: DecisionSupportDefaultOffRouterGuardShellKind): DecisionSupportDefaultOffFutureRouteIntent {
  switch (shellKind) {
    case "clarification_gate_router_guard_shell":
      return "future_route_to_clarification_gate";
    case "route_preservation_router_guard_shell":
      return "future_preserve_existing_route";
    case "unsupported_boundary_router_guard_shell":
      return "future_preserve_unsupported_boundary";
    case "shadow_only_router_guard_shell":
      return "future_keep_shadow_only";
    case "blocked_unsafe_router_guard_shell":
    default:
      return "future_block_unsafe";
  }
}

// This module's own violation type union — used to filter which upstream Sprint 38R violation strings can
// be safely reused verbatim (the two type unions share several literal string values).
const SHELL_VIOLATION_TYPES = new Set<string>([
  "feature_flag_runtime_read_attempted",
  "composer_wiring_allowed",
  "endpoint_wiring_allowed",
  "production_wiring_allowed",
  "user_visible_output_allowed",
  "real_persistence_allowed",
  "external_call_allowed",
  "action_execution_allowed",
  "approval_state_overclaimed",
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "side_effect_risk",
]);

function reuseUpstreamViolations(featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult): DecisionSupportDefaultOffRouterGuardShellViolationType[] {
  const violationsAsStrings = featureFlagShellCaseResult.violations as unknown as string[];
  return violationsAsStrings.filter((v): v is DecisionSupportDefaultOffRouterGuardShellViolationType => SHELL_VIOLATION_TYPES.has(v));
}

// ─── Router guard shell definition ─────────────────────────────────────────────────────

const PROHIBITED_ROUTER_SOURCES: string[] = ["real_router", "route_registry", "production_handler", "endpoint_route", "runtime_router_context", "process.env", "remote_config", "database_route_config", "implicit_route_mutation", "default_on_decision_support_route"];

const REQUIRED_FUTURE_CHECKS: string[] = [
  "composer_guard_shell_ready",
  "endpoint_guard_shell_ready",
  "router_guard_contract_reviewed",
  "route_preservation_smoke_test_ready",
  "clarification_gate_smoke_test_ready",
  "unsupported_boundary_smoke_test_ready",
  "rollback_route_fallback_ready",
  "governance_approval_obtained",
  "manual_smoke_test_completed",
];

export type DecisionSupportDefaultOffRouterGuardShellDefinitionOptions = {
  config?: Partial<DecisionSupportDefaultOffRouterGuardShellConfig>;
};

/**
 * Builds the no-op router guard shell definition for a given Sprint 38R feature flag shell case result.
 * Never implements, imports, or wires a real router guard — this is a documentation/contract-only object.
 * Preserves the feature flag key Sprint 38R already resolved (`featureFlagShellCaseResult.featureFlagDefinition.key`),
 * falling back to the literal constant if that field is absent or mismatched.
 */
export function createDecisionSupportDefaultOffRouterGuardShellDefinition(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  _options: DecisionSupportDefaultOffRouterGuardShellDefinitionOptions = {},
): DecisionSupportDefaultOffRouterGuardShellDefinition {
  const shellKind = routerGuardShellKindForFeatureFlagShellKind(featureFlagShellCaseResult.shellKind);
  const upstreamKey = featureFlagShellCaseResult.featureFlagDefinition?.key;
  const key = upstreamKey === PROPOSED_FEATURE_FLAG_KEY ? PROPOSED_FEATURE_FLAG_KEY : PROPOSED_FEATURE_FLAG_KEY;
  const requires = requiresPreservationForShellKind(shellKind);

  return {
    definitionId: `router-guard-shell-definition-${featureFlagShellCaseResult.caseId}`,
    shellKind,
    key,
    description:
      `No-op, default-off router guard shell for ${key} — implemented as a formal shell (types, definition, route evaluation, composer handoff, ` +
      "rollback reference) but never as a real router guard, never imported from the real router, and never wired at runtime.",
    shellOnly: true,
    noOpRouterGuard: true,
    productionRouterGuardImplementedNow: false,
    routerImportAllowedNow: false,
    routerRuntimeWiringActiveNow: false,
    routeMutationAllowedNow: false,
    featureFlagEnabledNow: false,
    featureFlagRuntimeReadNow: false,
    defaultOff: true,
    requiresFeatureFlagDisabled: true,
    requiresCurrentRoutePreservation: true,
    ...requires,
    requiresComposerGuardHandoff: true,
    requiresRollbackRouteReference: true,
    prohibitedRouterSources: [...PROHIBITED_ROUTER_SOURCES],
    requiredFutureChecks: [...REQUIRED_FUTURE_CHECKS],
    score: 95,
    rationale: [
      `Preserves ${key} as the feature flag key Sprint 38R already resolved as statically default-off — this shell never implements a real router ` +
        "guard, never imports the real router, and never mutates a live route.",
      "requiresFeatureFlagDisabled and requiresCurrentRoutePreservation are both true — router guard readiness still requires the flag stay " +
        "statically default-off and the current route stay preserved, plus a composer guard handoff and a rollback route reference.",
    ],
  } satisfies DecisionSupportDefaultOffRouterGuardShellDefinition;
}

function checkRouterGuardDefinition(definition: DecisionSupportDefaultOffRouterGuardShellDefinition | undefined | null): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  if (!definition) return { passed: false, violations: ["router_guard_definition_missing"] };
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  if (definition.key !== PROPOSED_FEATURE_FLAG_KEY) violations.push("router_guard_definition_missing");
  if (definition.routerImportAllowedNow !== false) violations.push("router_import_attempted");
  if (definition.routerRuntimeWiringActiveNow !== false) violations.push("router_runtime_wiring_active");
  if (definition.routeMutationAllowedNow !== false) violations.push("route_mutation_allowed");
  if (definition.featureFlagEnabledNow !== false) violations.push("feature_flag_enabled_now");
  if (definition.featureFlagRuntimeReadNow !== false) violations.push("feature_flag_runtime_read_attempted");
  if (definition.productionRouterGuardImplementedNow !== false) violations.push("router_guard_definition_missing");
  const invariantsOk =
    definition.shellOnly === true &&
    definition.noOpRouterGuard === true &&
    definition.defaultOff === true &&
    definition.requiresFeatureFlagDisabled === true &&
    definition.requiresCurrentRoutePreservation === true &&
    definition.requiresComposerGuardHandoff === true &&
    definition.requiresRollbackRouteReference === true &&
    definition.score >= 85;
  if (!invariantsOk && violations.length === 0) violations.push("router_guard_definition_missing");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

// ─── Router guard feature flag state reference ─────────────────────────────────────────

/**
 * Builds a static reference to the Sprint 38R feature flag shell state for a given feature flag shell case
 * result. Never activates, never reads at runtime — `featureFlagEnabled` is never set to `true` by any code
 * path. Negative-test knobs in `options` only flip the corresponding `*Attempted` flag (or force an
 * `enabled`/`state`/`source` mismatch) so downstream validation can register the matching violation,
 * mirroring how Sprint 38R's own `resolveDecisionSupportDefaultOffFeatureFlagShellState()` never actually
 * enables its flag from a negative-test knob.
 */
export function createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  options: DecisionSupportDefaultOffRouterGuardFeatureFlagStateReferenceOptions = {},
): DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference {
  const upstream = featureFlagShellCaseResult.featureFlagState;

  const runtimeReadAttempted = options.forceRuntimeReadAttempted === true || upstream.runtimeReadAttempted === true;
  const activationAttempted = options.forceActivationAttempted === true || upstream.activationAttempted === true;
  const enabledForced = options.forceEnabled === true;
  const source: DecisionSupportDefaultOffRouterGuardFeatureFlagSource = options.forceSource ?? (upstream.source as DecisionSupportDefaultOffRouterGuardFeatureFlagSource);

  let featureFlagState: DecisionSupportDefaultOffRouterGuardFeatureFlagState;
  if (options.forceState !== undefined) {
    featureFlagState = options.forceState;
  } else if (source !== "static_default_off") {
    featureFlagState = "invalid";
  } else if (enabledForced || runtimeReadAttempted || activationAttempted || upstream.state !== "disabled") {
    featureFlagState = "blocked";
  } else {
    featureFlagState = "disabled";
  }

  const warnings: string[] = [];
  if (options.forceEnabled === true) {
    warnings.push(`Router guard feature flag state reference ${upstream.key}: enabled was force-requested for a negative test but is never actually set true — this is a shell-only, static reference.`);
  }
  if (runtimeReadAttempted || activationAttempted) {
    warnings.push(`Router guard feature flag state reference ${upstream.key}: a shell-only synthetic attempted flag was forced true for negative-test purposes.`);
  }
  if (source !== "static_default_off") {
    warnings.push(`Router guard feature flag state reference ${upstream.key}: resolved source "${source}" is not static_default_off.`);
  }
  if (upstream.enabled !== false || upstream.state !== "disabled" || upstream.source !== "static_default_off") {
    warnings.push(`Router guard feature flag state reference ${upstream.key}: the upstream Sprint 38R feature flag state was not itself clean.`);
  }

  return {
    stateReferenceId: `router-guard-feature-flag-state-reference-${featureFlagShellCaseResult.caseId}`,
    key: upstream.key,
    featureFlagState,
    featureFlagEnabled: false,
    source,
    defaultOff: true,
    shellOnly: true,
    runtimeReadAttempted,
    activationAttempted,
    featureFlagRuntimeReadNow: false,
    featureFlagActivationAllowedNow: false,
    warnings,
  } satisfies DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference;
}

function checkFeatureFlagDisabled(stateReference: DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  if (stateReference.featureFlagEnabled !== false) violations.push("feature_flag_enabled_now");
  if (stateReference.source !== "static_default_off") violations.push("feature_flag_state_missing");
  if (stateReference.runtimeReadAttempted !== false || stateReference.featureFlagRuntimeReadNow !== false) violations.push("feature_flag_runtime_read_attempted");
  if (stateReference.activationAttempted !== false || stateReference.featureFlagActivationAllowedNow !== false) violations.push("feature_flag_enabled_now");
  const anyAttempted = stateReference.runtimeReadAttempted || stateReference.activationAttempted;
  if (stateReference.featureFlagState !== "disabled" && !anyAttempted && stateReference.source === "static_default_off" && violations.length === 0) {
    violations.push("feature_flag_enabled_now");
  }
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

// ─── Router guard route evaluation ─────────────────────────────────────────────────────

/**
 * Evaluates the no-op route decision for a given Sprint 38R feature flag shell case result, its router guard
 * definition, and its feature-flag-state reference. Never mutates a live route, never imports the router,
 * never wires anything at runtime — every default value is a documented no-op. Negative-test knobs in
 * `options` only flip the corresponding `*Attempted`/`*Now` flag so downstream validation can register the
 * matching violation; they never actually enable a route mutation.
 */
export function evaluateDecisionSupportDefaultOffRouterGuardRoute(
  _featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  routerGuardDefinition: DecisionSupportDefaultOffRouterGuardShellDefinition,
  _featureFlagStateReference: DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference,
  options: DecisionSupportDefaultOffRouterGuardRouteEvaluationOptions = {},
): DecisionSupportDefaultOffRouterGuardRouteEvaluation {
  const shellKind = routerGuardDefinition.shellKind;

  const routeMutationAttempted = options.forceRouteMutationAttempted === true;
  const routerImportAttempted = options.forceRouterImportAttempted === true;
  const routerRuntimeWiringActiveNow = options.forceRouterRuntimeWiringActiveNow === true;
  const decisionSupportRouteActivatedNow = options.forceDecisionSupportRouteActivatedNow === true;
  const userVisibleNow = options.forceUserVisibleNow === true;
  const productionEligibleNow = options.forceProductionEligibleNow === true;

  let clarificationGatePreserved = false;
  let existingRoutePreserved = false;
  let unsupportedBoundaryPreserved = false;
  let shadowOnlyPreserved = false;
  let unsafeRouteBlocked = false;
  let score: number;
  let liveRouteDecision: DecisionSupportDefaultOffLiveRouteDecision = "preserve_current_route_noop";

  switch (shellKind) {
    case "clarification_gate_router_guard_shell":
      clarificationGatePreserved = true;
      score = 94;
      break;
    case "route_preservation_router_guard_shell":
      existingRoutePreserved = true;
      score = 92;
      break;
    case "unsupported_boundary_router_guard_shell":
      unsupportedBoundaryPreserved = true;
      score = 90;
      break;
    case "shadow_only_router_guard_shell":
      shadowOnlyPreserved = true;
      score = 88;
      liveRouteDecision = "keep_shadow_only_noop";
      break;
    case "blocked_unsafe_router_guard_shell":
    default:
      unsafeRouteBlocked = true;
      score = 85;
      liveRouteDecision = "block_unsafe_noop";
      break;
  }

  const futureRouteIntent = futureRouteIntentForShellKind(shellKind);

  // Forcing a route mutation attempt overrides the live route decision regardless of shell kind — this is
  // the one negative-test knob that changes which no-op decision is reported, mirroring Sprint 38R's own
  // "blocked" state fallback.
  if (routeMutationAttempted) liveRouteDecision = "block_route_mutation_default_off";

  const warnings: string[] = [];
  if (routeMutationAttempted) warnings.push(`Route evaluation ${shellKind}: routeMutationAttempted was force-requested for a negative test — the live route is never actually mutated.`);
  if (routerImportAttempted) warnings.push(`Route evaluation ${shellKind}: routerImportAttempted was force-requested for a negative test — the real router is never actually imported.`);
  if (routerRuntimeWiringActiveNow) warnings.push(`Route evaluation ${shellKind}: routerRuntimeWiringActiveNow was force-requested for a negative test — no runtime wiring is ever actually active.`);
  if (decisionSupportRouteActivatedNow) warnings.push(`Route evaluation ${shellKind}: decisionSupportRouteActivatedNow was force-requested for a negative test — decision_support is never actually routed to.`);
  if (userVisibleNow) warnings.push(`Route evaluation ${shellKind}: userVisibleNow was force-requested for a negative test — no output is ever actually shown to a user.`);
  if (productionEligibleNow) warnings.push(`Route evaluation ${shellKind}: productionEligibleNow was force-requested for a negative test — this shell is never actually production eligible.`);

  return {
    routeEvaluationId: `router-guard-route-evaluation-${routerGuardDefinition.definitionId}`,
    sourceCaseId: routerGuardDefinition.definitionId,
    shellKind,
    liveRouteDecision,
    futureRouteIntent,
    defaultOff: true,
    shellOnly: true,
    currentRoutePreserved: true,
    routeMutationAllowedNow: false,
    routeMutationAttempted,
    routerRuntimeWiringActiveNow,
    routerImportAttempted,
    decisionSupportRouteActivatedNow,
    clarificationGatePreserved,
    existingRoutePreserved,
    unsupportedBoundaryPreserved,
    shadowOnlyPreserved,
    unsafeRouteBlocked,
    userVisibleNow,
    persistedNow: false,
    executableNow: false,
    externalSideEffectsAllowed: false,
    productionEligibleNow,
    score,
    rationale: [
      `${shellKind}: the current route stays preserved (currentRoutePreserved: true) and no live route mutation is ever allowed (routeMutationAllowedNow: false).`,
      `futureRouteIntent is ${futureRouteIntent} — a documented intent for a future, explicitly governed sprint, not an active route change.`,
    ],
    warnings,
  } satisfies DecisionSupportDefaultOffRouterGuardRouteEvaluation;
}

function checkNoRouterImport(routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation, definition: DecisionSupportDefaultOffRouterGuardShellDefinition): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  if (routeEvaluation.routerImportAttempted !== false || definition.routerImportAllowedNow !== false) violations.push("router_import_attempted");
  return { passed: violations.length === 0, violations };
}

function checkNoRouterRuntimeWiring(routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation, definition: DecisionSupportDefaultOffRouterGuardShellDefinition): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  if (routeEvaluation.routerRuntimeWiringActiveNow !== false || definition.routerRuntimeWiringActiveNow !== false) violations.push("router_runtime_wiring_active");
  return { passed: violations.length === 0, violations };
}

function checkNoRouteMutation(routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation, definition: DecisionSupportDefaultOffRouterGuardShellDefinition): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  if (routeEvaluation.routeMutationAttempted !== false) violations.push("route_mutation_attempted");
  if (routeEvaluation.routeMutationAllowedNow !== false || definition.routeMutationAllowedNow !== false) violations.push("route_mutation_allowed");
  if (routeEvaluation.decisionSupportRouteActivatedNow !== false) violations.push("route_mutation_attempted");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

function checkCurrentRoutePreservation(routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  if (routeEvaluation.currentRoutePreserved !== true) violations.push("current_route_not_preserved");
  if (routeEvaluation.decisionSupportRouteActivatedNow !== false) violations.push("current_route_not_preserved");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

function checkRouteIntentPreservation(routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  switch (routeEvaluation.shellKind) {
    case "clarification_gate_router_guard_shell":
      if (routeEvaluation.clarificationGatePreserved !== true) violations.push("clarification_gate_not_preserved");
      break;
    case "route_preservation_router_guard_shell":
      if (routeEvaluation.existingRoutePreserved !== true) violations.push("existing_route_not_preserved");
      break;
    case "unsupported_boundary_router_guard_shell":
      if (routeEvaluation.unsupportedBoundaryPreserved !== true) violations.push("unsupported_boundary_not_preserved");
      break;
    case "shadow_only_router_guard_shell":
      if (routeEvaluation.shadowOnlyPreserved !== true) violations.push("shadow_only_not_preserved");
      break;
    case "blocked_unsafe_router_guard_shell":
    default:
      if (routeEvaluation.unsafeRouteBlocked !== true) violations.push("unsafe_route_not_blocked");
      break;
  }
  return { passed: violations.length === 0, violations };
}

// ─── Composer guard readiness handoff ───────────────────────────────────────────────────

export type DecisionSupportDefaultOffComposerGuardReadinessHandoffOptions = {
  config?: Partial<DecisionSupportDefaultOffRouterGuardShellConfig>;
};

/**
 * Builds the composer guard readiness handoff for a given Sprint 38R feature flag shell case result and its
 * router guard route evaluation. Never implements or wires a real composer guard — this is a readiness
 * handoff for Sprint 40R.
 */
export function createDecisionSupportDefaultOffComposerGuardReadinessHandoff(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation,
  _options: DecisionSupportDefaultOffComposerGuardReadinessHandoffOptions = {},
): DecisionSupportDefaultOffComposerGuardReadinessHandoff {
  const readyForComposerGuardShell =
    featureFlagShellCaseResult.shellAccepted === true &&
    featureFlagShellCaseResult.safeForDefaultOffRouterGuardShell === true &&
    routeEvaluation.currentRoutePreserved === true &&
    routeEvaluation.routeMutationAttempted === false &&
    routeEvaluation.routerImportAttempted === false &&
    routeEvaluation.routerRuntimeWiringActiveNow === false &&
    routeEvaluation.decisionSupportRouteActivatedNow === false;

  return {
    handoffId: `composer-guard-readiness-handoff-${featureFlagShellCaseResult.caseId}`,
    shellKind: routeEvaluation.shellKind,
    sourceCaseId: featureFlagShellCaseResult.caseId,
    key: PROPOSED_FEATURE_FLAG_KEY,
    readyForComposerGuardShell,
    composerGuardImplementationAllowedNow: false,
    composerRuntimeWiringAllowedNow: false,
    requiresRouterGuardShellAccepted: true,
    requiresFeatureFlagDisabled: true,
    requiresCurrentRoutePreserved: true,
    requiresNoComposerImportInSprint39: true,
    requiresComposerGuardShellInSprint40: true,
    requiresNoUserVisibleOutputByDefault: true,
    requiresNoPersistenceByDefault: true,
    requiresNoActionExecutionByDefault: true,
    score: 92,
    rationale: [
      "Composer guard implementation and runtime wiring both stay disallowed now — this handoff only documents what Sprint 40R must satisfy.",
      "Readiness requires this router guard shell case be accepted, the flag stay statically default-off, the current route stay preserved, no " +
        "composer import in this sprint, and no user-visible output or action execution by default.",
    ],
  } satisfies DecisionSupportDefaultOffComposerGuardReadinessHandoff;
}

function checkComposerGuardHandoff(handoff: DecisionSupportDefaultOffComposerGuardReadinessHandoff): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  if (handoff.composerGuardImplementationAllowedNow !== false || handoff.composerRuntimeWiringAllowedNow !== false) violations.push("composer_wiring_allowed");
  const invariantsOk =
    handoff.requiresRouterGuardShellAccepted === true &&
    handoff.requiresFeatureFlagDisabled === true &&
    handoff.requiresCurrentRoutePreserved === true &&
    handoff.requiresNoComposerImportInSprint39 === true &&
    handoff.requiresComposerGuardShellInSprint40 === true &&
    handoff.requiresNoUserVisibleOutputByDefault === true &&
    handoff.requiresNoPersistenceByDefault === true &&
    handoff.requiresNoActionExecutionByDefault === true &&
    handoff.score >= 85;
  if (!invariantsOk && violations.length === 0) violations.push("composer_handoff_missing");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

// ─── Router rollback reference ─────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardRollbackReferenceOptions = {
  config?: Partial<DecisionSupportDefaultOffRouterGuardShellConfig>;
};

/**
 * Builds the router rollback reference for a given Sprint 38R feature flag shell case result and its route
 * evaluation. Never implements a real rollback path — only the reference contract every future rollback must
 * satisfy.
 */
export function createDecisionSupportDefaultOffRouterGuardRollbackReference(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  _routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation,
  _options: DecisionSupportDefaultOffRouterGuardRollbackReferenceOptions = {},
): DecisionSupportDefaultOffRouterGuardRollbackReference {
  return {
    rollbackReferenceId: `router-guard-rollback-reference-${featureFlagShellCaseResult.caseId}`,
    shellOnly: true,
    rollbackImplementedNow: false,
    rollbackRequiresFeatureFlagDisable: true,
    rollbackRequiresCurrentRouteFallback: true,
    rollbackRequiresExistingRoutePreservation: true,
    rollbackRequiresComposerNoOpFallback: true,
    rollbackRequiresEndpointNoOpFallback: true,
    rollbackRequiresNoDataMigration: true,
    rollbackRequiresNoPersistentStateCleanup: true,
    rollbackRequiresNoExternalSideEffectCleanup: true,
    rollbackRequiresIncidentOwner: true,
    rollbackRequiresVerificationChecklist: true,
    score: 92,
    rationale: [
      "A router rollback reference, not a rollback implementation — disabling the flag and falling back to the current route requires no data " +
        "migration or persistent-state cleanup, since nothing real is ever persisted by this shell.",
      "An incident owner and a verification checklist are required before any future router guard activation, not before this shell.",
    ],
  } satisfies DecisionSupportDefaultOffRouterGuardRollbackReference;
}

function checkRollbackReference(rollbackReference: DecisionSupportDefaultOffRouterGuardRollbackReference): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  const invariantsOk =
    rollbackReference.shellOnly === true &&
    rollbackReference.rollbackImplementedNow === false &&
    rollbackReference.rollbackRequiresFeatureFlagDisable === true &&
    rollbackReference.rollbackRequiresCurrentRouteFallback === true &&
    rollbackReference.rollbackRequiresExistingRoutePreservation === true &&
    rollbackReference.rollbackRequiresComposerNoOpFallback === true &&
    rollbackReference.rollbackRequiresEndpointNoOpFallback === true &&
    rollbackReference.rollbackRequiresNoDataMigration === true &&
    rollbackReference.rollbackRequiresNoPersistentStateCleanup === true &&
    rollbackReference.rollbackRequiresNoExternalSideEffectCleanup === true &&
    rollbackReference.rollbackRequiresIncidentOwner === true &&
    rollbackReference.rollbackRequiresVerificationChecklist === true &&
    rollbackReference.score >= 85;
  return { passed: invariantsOk, violations: invariantsOk ? [] : ["rollback_route_reference_missing"] };
}

// ─── Upstream propagated checks (approval / visibility / production eligibility / leaks / side effects) ─

function checkNoApprovalOverclaim(featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  if (featureFlagShellCaseResult.noApprovalOverclaimPassed === true) return { passed: true, violations: [] };
  const reused = reuseUpstreamViolations(featureFlagShellCaseResult).filter((v) => v === "approval_state_overclaimed");
  return { passed: false, violations: reused.length > 0 ? reused : ["approval_state_overclaimed"] };
}

function checkNoVisibilityAttempt(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation,
): { passed: boolean; violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] } {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  const visibilityFallback: DecisionSupportDefaultOffRouterGuardShellViolationType[] = ["user_visible_output_allowed"];
  if (featureFlagShellCaseResult.noVisibilityAttemptPassed !== true) {
    const reused = reuseUpstreamViolations(featureFlagShellCaseResult).filter((v) => v === "user_visible_output_allowed");
    violations.push(...(reused.length > 0 ? reused : visibilityFallback));
  }
  if (routeEvaluation.userVisibleNow !== false) violations.push("user_visible_output_allowed");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

function checkNoProductionEligibility(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  definition: DecisionSupportDefaultOffRouterGuardShellDefinition,
  routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation,
): { passed: boolean; violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] } {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  const fallback: DecisionSupportDefaultOffRouterGuardShellViolationType[] = ["production_wiring_allowed"];
  if (featureFlagShellCaseResult.shellAccepted !== true || featureFlagShellCaseResult.safeForDefaultOffRouterGuardShell !== true) {
    const reused = reuseUpstreamViolations(featureFlagShellCaseResult);
    violations.push(...(reused.length > 0 ? reused : fallback));
  }
  if (featureFlagShellCaseResult.noProductionEligibilityPassed !== true) {
    const reused = reuseUpstreamViolations(featureFlagShellCaseResult);
    violations.push(...(reused.length > 0 ? reused : fallback));
  }
  if (routeEvaluation.productionEligibleNow !== false) violations.push("production_wiring_allowed");
  if (routeEvaluation.routerImportAttempted !== false) violations.push("router_import_attempted");
  if (routeEvaluation.routerRuntimeWiringActiveNow !== false) violations.push("router_runtime_wiring_active");
  if (routeEvaluation.routeMutationAttempted !== false) violations.push("route_mutation_attempted");
  if (definition.featureFlagEnabledNow !== false) violations.push("feature_flag_enabled_now");
  if (definition.featureFlagRuntimeReadNow !== false) violations.push("feature_flag_runtime_read_attempted");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

const LEAK_VIOLATION_TYPES = new Set<string>(["raw_input_leak", "full_candidate_leak", "pii_leak", "project_name_leak"]);

function checkNoLeaks(featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult): {
  passed: boolean;
  violations: DecisionSupportDefaultOffRouterGuardShellViolationType[];
} {
  if (featureFlagShellCaseResult.noLeaksPassed === true) return { passed: true, violations: [] };
  const reused = reuseUpstreamViolations(featureFlagShellCaseResult).filter((v) => LEAK_VIOLATION_TYPES.has(v));
  return { passed: false, violations: reused.length > 0 ? reused : ["raw_input_leak", "full_candidate_leak", "pii_leak", "project_name_leak"] };
}

const SIDE_EFFECT_VIOLATION_TYPES = new Set<string>(["real_persistence_allowed", "external_call_allowed", "action_execution_allowed", "composer_wiring_allowed", "endpoint_wiring_allowed", "side_effect_risk"]);

function checkNoSideEffects(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation,
): { passed: boolean; violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] } {
  const violations: DecisionSupportDefaultOffRouterGuardShellViolationType[] = [];
  const sideEffectFallback: DecisionSupportDefaultOffRouterGuardShellViolationType[] = ["side_effect_risk"];
  if (featureFlagShellCaseResult.noSideEffectsPassed !== true) {
    const reused = reuseUpstreamViolations(featureFlagShellCaseResult).filter((v) => SIDE_EFFECT_VIOLATION_TYPES.has(v));
    violations.push(...(reused.length > 0 ? reused : sideEffectFallback));
  }
  if (routeEvaluation.externalSideEffectsAllowed !== false) violations.push("side_effect_risk");
  if (routeEvaluation.executableNow !== false) violations.push("action_execution_allowed");
  if (routeEvaluation.persistedNow !== false) violations.push("real_persistence_allowed");
  return { passed: violations.length === 0, violations: dedupe(violations) };
}

// ─── Router guard case validation ──────────────────────────────────────────────────────

// Definitional gaps (missing/malformed contract objects) are non-critical — they reject the case, but do not
// block it — mirroring Sprint 38R's own critical/non-critical split (where "production_wiring_allowed" is
// also treated as a non-critical, rejecting-only violation).
const CRITICAL_VIOLATIONS = new Set<DecisionSupportDefaultOffRouterGuardShellViolationType>([
  "feature_flag_enabled_now",
  "feature_flag_runtime_read_attempted",
  "router_import_attempted",
  "router_runtime_wiring_active",
  "route_mutation_allowed",
  "route_mutation_attempted",
  "current_route_not_preserved",
  "clarification_gate_not_preserved",
  "existing_route_not_preserved",
  "unsupported_boundary_not_preserved",
  "shadow_only_not_preserved",
  "unsafe_route_not_blocked",
  "composer_wiring_allowed",
  "endpoint_wiring_allowed",
  "user_visible_output_allowed",
  "real_persistence_allowed",
  "external_call_allowed",
  "action_execution_allowed",
  "approval_state_overclaimed",
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "side_effect_risk",
]);

export type DecisionSupportDefaultOffRouterGuardShellCaseValidationResult = {
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
};

/**
 * Validates one Sprint 38R feature flag shell case result against its router guard definition, feature-flag-
 * state reference, route evaluation, composer guard readiness handoff, and rollback reference. Exposed
 * separately from `evaluateDecisionSupportDefaultOffRouterGuardShellCase()` so tests (and future callers) can
 * mutate an object and re-validate without rebuilding everything.
 */
export function validateDecisionSupportDefaultOffRouterGuardShellCase(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  routerGuardDefinition: DecisionSupportDefaultOffRouterGuardShellDefinition,
  featureFlagStateReference: DecisionSupportDefaultOffRouterGuardFeatureFlagStateReference,
  routeEvaluation: DecisionSupportDefaultOffRouterGuardRouteEvaluation,
  composerGuardReadinessHandoff: DecisionSupportDefaultOffComposerGuardReadinessHandoff,
  rollbackReference: DecisionSupportDefaultOffRouterGuardRollbackReference,
): DecisionSupportDefaultOffRouterGuardShellCaseValidationResult {
  const routerGuardDefinitionCheck = checkRouterGuardDefinition(routerGuardDefinition);
  const featureFlagDisabledCheck = checkFeatureFlagDisabled(featureFlagStateReference);
  const noRouterImportCheck = checkNoRouterImport(routeEvaluation, routerGuardDefinition);
  const noRouterRuntimeWiringCheck = checkNoRouterRuntimeWiring(routeEvaluation, routerGuardDefinition);
  const noRouteMutationCheck = checkNoRouteMutation(routeEvaluation, routerGuardDefinition);
  const currentRoutePreservationCheck = checkCurrentRoutePreservation(routeEvaluation);
  const routeIntentPreservationCheck = checkRouteIntentPreservation(routeEvaluation);
  const composerGuardHandoffCheck = checkComposerGuardHandoff(composerGuardReadinessHandoff);
  const rollbackReferenceCheck = checkRollbackReference(rollbackReference);
  const noApprovalOverclaimCheck = checkNoApprovalOverclaim(featureFlagShellCaseResult);
  const noVisibilityAttemptCheck = checkNoVisibilityAttempt(featureFlagShellCaseResult, routeEvaluation);
  const noProductionEligibilityCheck = checkNoProductionEligibility(featureFlagShellCaseResult, routerGuardDefinition, routeEvaluation);
  const noLeaksCheck = checkNoLeaks(featureFlagShellCaseResult);
  const noSideEffectsCheck = checkNoSideEffects(featureFlagShellCaseResult, routeEvaluation);

  const allChecks = [
    routerGuardDefinitionCheck,
    featureFlagDisabledCheck,
    noRouterImportCheck,
    noRouterRuntimeWiringCheck,
    noRouteMutationCheck,
    currentRoutePreservationCheck,
    routeIntentPreservationCheck,
    composerGuardHandoffCheck,
    rollbackReferenceCheck,
    noApprovalOverclaimCheck,
    noVisibilityAttemptCheck,
    noProductionEligibilityCheck,
    noLeaksCheck,
    noSideEffectsCheck,
  ];
  const violations = dedupe(allChecks.flatMap((c) => c.violations));
  const hasCriticalViolation = violations.some((v) => CRITICAL_VIOLATIONS.has(v));

  let qaStatus: DecisionSupportDefaultOffRouterGuardShellQaStatus;
  let riskLevel: DecisionSupportDefaultOffRouterGuardShellRiskLevel;
  let routerGuardAccepted: boolean;
  let routerGuardRejected: boolean;
  let routerGuardBlocked: boolean;
  if (violations.length === 0) {
    qaStatus = "pass";
    riskLevel = "low";
    routerGuardAccepted = true;
    routerGuardRejected = false;
    routerGuardBlocked = false;
  } else if (hasCriticalViolation) {
    qaStatus = "blocked";
    riskLevel = "critical";
    routerGuardAccepted = false;
    routerGuardRejected = false;
    routerGuardBlocked = true;
  } else {
    qaStatus = "fail";
    riskLevel = "high";
    routerGuardAccepted = false;
    routerGuardRejected = true;
    routerGuardBlocked = false;
  }

  return {
    routerGuardAccepted,
    routerGuardRejected,
    routerGuardBlocked,
    qaStatus,
    riskLevel,
    violations,
    routerGuardDefinitionPassed: routerGuardDefinitionCheck.passed,
    featureFlagDisabledPassed: featureFlagDisabledCheck.passed,
    noRouterImportPassed: noRouterImportCheck.passed,
    noRouterRuntimeWiringPassed: noRouterRuntimeWiringCheck.passed,
    noRouteMutationPassed: noRouteMutationCheck.passed,
    currentRoutePreservationPassed: currentRoutePreservationCheck.passed,
    routeIntentPreservationPassed: routeIntentPreservationCheck.passed,
    composerGuardHandoffPassed: composerGuardHandoffCheck.passed,
    rollbackReferencePassed: rollbackReferenceCheck.passed,
    noApprovalOverclaimPassed: noApprovalOverclaimCheck.passed,
    noVisibilityAttemptPassed: noVisibilityAttemptCheck.passed,
    noProductionEligibilityPassed: noProductionEligibilityCheck.passed,
    noLeaksPassed: noLeaksCheck.passed,
    noSideEffectsPassed: noSideEffectsCheck.passed,
    safeForDefaultOffComposerGuardShell: violations.length === 0,
  };
}

// ─── Router guard case evaluation ──────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouterGuardShellCaseOptions = {
  config?: Partial<DecisionSupportDefaultOffRouterGuardShellConfig>;
  stateOptions?: DecisionSupportDefaultOffRouterGuardFeatureFlagStateReferenceOptions;
  routeOptions?: DecisionSupportDefaultOffRouterGuardRouteEvaluationOptions;
};

/**
 * Evaluates a single Sprint 38R feature flag shell case result: builds its router guard shell definition,
 * builds its static feature-flag-state reference, evaluates its no-op route decision, builds its composer
 * guard readiness handoff and router rollback reference, then validates all five together. Every
 * `*AllowedNow` field on the returned case result is always `false`.
 */
export function evaluateDecisionSupportDefaultOffRouterGuardShellCase(
  featureFlagShellCaseResult: DecisionSupportDefaultOffFeatureFlagImplementationShellCaseResult,
  options: DecisionSupportDefaultOffRouterGuardShellCaseOptions = {},
): DecisionSupportDefaultOffRouterGuardShellCaseResult {
  const routerGuardDefinition = createDecisionSupportDefaultOffRouterGuardShellDefinition(featureFlagShellCaseResult, { config: options.config });
  const featureFlagStateReference = createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference(featureFlagShellCaseResult, options.stateOptions);
  const routeEvaluation = evaluateDecisionSupportDefaultOffRouterGuardRoute(featureFlagShellCaseResult, routerGuardDefinition, featureFlagStateReference, options.routeOptions);
  const composerGuardReadinessHandoff = createDecisionSupportDefaultOffComposerGuardReadinessHandoff(featureFlagShellCaseResult, routeEvaluation, { config: options.config });
  const rollbackReference = createDecisionSupportDefaultOffRouterGuardRollbackReference(featureFlagShellCaseResult, routeEvaluation, { config: options.config });

  const validation = validateDecisionSupportDefaultOffRouterGuardShellCase(
    featureFlagShellCaseResult,
    routerGuardDefinition,
    featureFlagStateReference,
    routeEvaluation,
    composerGuardReadinessHandoff,
    rollbackReference,
  );

  const warnings = [...featureFlagShellCaseResult.warnings, ...featureFlagStateReference.warnings, ...routeEvaluation.warnings];
  if (!validation.routerGuardAccepted) {
    warnings.push(`Case ${featureFlagShellCaseResult.caseId}: router guard shell ${validation.qaStatus} — violations: ${validation.violations.join(", ")}.`);
  }

  return {
    caseId: featureFlagShellCaseResult.caseId,
    sourceShellKind: featureFlagShellCaseResult.shellKind,
    sourceCaseId: featureFlagShellCaseResult.caseId,
    routerGuardShellKind: routerGuardDefinition.shellKind,
    generatedForRouterGuardShellOnly: true,
    shellOnly: true,
    noOpRouterGuard: true,
    defaultOff: true,
    routerGuardDefinition,
    featureFlagStateReference,
    routeEvaluation,
    composerGuardReadinessHandoff,
    rollbackReference,
    routerGuardAccepted: validation.routerGuardAccepted,
    routerGuardRejected: validation.routerGuardRejected,
    routerGuardBlocked: validation.routerGuardBlocked,
    qaStatus: validation.qaStatus,
    riskLevel: validation.riskLevel,
    violations: validation.violations,
    routerGuardDefinitionPassed: validation.routerGuardDefinitionPassed,
    featureFlagDisabledPassed: validation.featureFlagDisabledPassed,
    noRouterImportPassed: validation.noRouterImportPassed,
    noRouterRuntimeWiringPassed: validation.noRouterRuntimeWiringPassed,
    noRouteMutationPassed: validation.noRouteMutationPassed,
    currentRoutePreservationPassed: validation.currentRoutePreservationPassed,
    routeIntentPreservationPassed: validation.routeIntentPreservationPassed,
    composerGuardHandoffPassed: validation.composerGuardHandoffPassed,
    rollbackReferencePassed: validation.rollbackReferencePassed,
    noApprovalOverclaimPassed: validation.noApprovalOverclaimPassed,
    noVisibilityAttemptPassed: validation.noVisibilityAttemptPassed,
    noProductionEligibilityPassed: validation.noProductionEligibilityPassed,
    noLeaksPassed: validation.noLeaksPassed,
    noSideEffectsPassed: validation.noSideEffectsPassed,
    safeForDefaultOffComposerGuardShell: validation.safeForDefaultOffComposerGuardShell,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: false,
    routeMutationAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings,
  } satisfies DecisionSupportDefaultOffRouterGuardShellCaseResult;
}

// ─── Router guard run ───────────────────────────────────────────────────────────────────

/**
 * Runs the full Sprint 39R default-off router guard shell: reuses (or builds) the Sprint 38R default-off
 * feature flag implementation shell against the same corpus (default: that shell's own small self-contained
 * synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for the full Sprint 18R corpus), evaluates a router
 * guard case for every Sprint 38R shell case result, and consolidates the Sprint 39R allowed/prohibited
 * actions. Never imports or wires the real router, never mutates a live route, never activates a feature
 * flag, never touches the composer or endpoint, never shows anything to a user, and never persists anything
 * real.
 */
export function runDecisionSupportDefaultOffRouterGuardShell(options: DecisionSupportDefaultOffRouterGuardShellOptions = {}): DecisionSupportDefaultOffRouterGuardShellResult {
  const config = createDecisionSupportDefaultOffRouterGuardShellConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;

  const shell = options.shell ?? runDecisionSupportDefaultOffFeatureFlagImplementationShell({ cases: options.cases, now });
  const shellSummary = summarizeDecisionSupportDefaultOffFeatureFlagImplementationShell(shell);

  const caseResults = shell.caseResults.map((c) => evaluateDecisionSupportDefaultOffRouterGuardShellCase(c, { config }));

  const allowedNextActions = listDecisionSupportDefaultOffRouterGuardShellAllowedNextActions();
  const prohibitedActions = listDecisionSupportDefaultOffRouterGuardShellProhibitedActions();

  const warnings: string[] = [];
  if (shellSummary.decision !== "ready_for_default_off_router_guard_shell") {
    warnings.push(`Sprint 38R default-off feature flag implementation shell decision is "${shellSummary.decision}", not "ready_for_default_off_router_guard_shell" — this shell cannot recommend Sprint 40R until that is resolved.`);
  }
  if (shellSummary.shellAcceptedCount !== shellSummary.totalCases) {
    warnings.push("Not every Sprint 38R shell case is accepted — this shell cannot recommend Sprint 40R until that is resolved.");
  }
  if (shellSummary.safeForDefaultOffRouterGuardShellCount !== shellSummary.totalCases) {
    warnings.push("Not every Sprint 38R shell case is safeForDefaultOffRouterGuardShell — this shell cannot recommend Sprint 40R until that is resolved.");
  }
  for (const caseResult of caseResults) warnings.push(...caseResult.warnings);

  return {
    config,
    shell,
    shellSummary,
    caseResults,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportDefaultOffRouterGuardShellResult;
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
  routerGuardEvaluatedCount: number;
  routerGuardAcceptedCount: number;
  routerGuardRejectedCount: number;
  routerGuardBlockedCount: number;
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
  sprint38ShellDecision: string | undefined;
};

function computeDecision(fields: DecisionFields): DecisionSupportDefaultOffRouterGuardShellDecision {
  if (fields.noLeaksPassedCount !== fields.totalCases || fields.noSideEffectsPassedCount !== fields.totalCases || fields.realPersistenceAllowedNowCount > 0 || fields.actionExecutionAllowedNowCount > 0) {
    return "blocked_by_leakage_or_side_effect_risk";
  }

  if (fields.noVisibilityAttemptPassedCount !== fields.totalCases || fields.userVisibleOutputAllowedNowCount > 0 || fields.safeForUserVisibleOutputNowCount > 0 || fields.safeForProductionCount > 0) {
    return "blocked_by_visibility_risk";
  }

  if (fields.routerImportAttemptedCount > 0 || fields.noRouterImportPassedCount !== fields.totalCases) {
    return "blocked_by_router_import_risk";
  }

  if (fields.routeMutationAttemptedCount > 0 || fields.routeMutationAllowedNowCount > 0 || fields.noRouteMutationPassedCount !== fields.totalCases || fields.decisionSupportRouteActivatedNowCount > 0) {
    return "blocked_by_route_mutation_risk";
  }

  if (fields.productionWiringAllowedNowCount > 0 || fields.routerChangeAllowedNowCount > 0 || fields.composerChangeAllowedNowCount > 0 || fields.endpointChangeAllowedNowCount > 0) {
    return "blocked_by_production_wiring_risk";
  }

  if (fields.routerGuardDefinitionPassedCount !== fields.totalCases || fields.featureFlagDisabledPassedCount !== fields.totalCases) {
    return "blocked_by_router_guard_definition_gap";
  }

  if (fields.featureFlagRuntimeReadNowCount > 0 || fields.currentRoutePreservationPassedCount !== fields.totalCases) {
    return "blocked_by_default_off_gap";
  }

  const allClean =
    fields.totalCases > 0 &&
    fields.routerGuardEvaluatedCount === fields.totalCases &&
    fields.routerGuardAcceptedCount === fields.totalCases &&
    fields.routerGuardRejectedCount === 0 &&
    fields.routerGuardBlockedCount === 0 &&
    fields.qaPassCount === fields.totalCases &&
    fields.qaWarningCount === 0 &&
    fields.qaFailCount === 0 &&
    fields.qaBlockedCount === 0 &&
    fields.routerGuardDefinitionPassedCount === fields.totalCases &&
    fields.featureFlagDisabledPassedCount === fields.totalCases &&
    fields.noRouterImportPassedCount === fields.totalCases &&
    fields.noRouterRuntimeWiringPassedCount === fields.totalCases &&
    fields.noRouteMutationPassedCount === fields.totalCases &&
    fields.currentRoutePreservationPassedCount === fields.totalCases &&
    fields.routeIntentPreservationPassedCount === fields.totalCases &&
    fields.composerGuardHandoffPassedCount === fields.totalCases &&
    fields.rollbackReferencePassedCount === fields.totalCases &&
    fields.noApprovalOverclaimPassedCount === fields.totalCases &&
    fields.noVisibilityAttemptPassedCount === fields.totalCases &&
    fields.noProductionEligibilityPassedCount === fields.totalCases &&
    fields.noLeaksPassedCount === fields.totalCases &&
    fields.noSideEffectsPassedCount === fields.totalCases &&
    fields.safeForDefaultOffComposerGuardShellCount === fields.totalCases &&
    fields.safeForUserVisibleOutputNowCount === 0 &&
    fields.safeForProductionCount === 0 &&
    fields.averageRouterGuardDefinitionScore >= 90 &&
    fields.averageRouteEvaluationScore >= 90 &&
    fields.averageComposerGuardHandoffScore >= 90 &&
    fields.averageRollbackReferenceScore >= 90 &&
    fields.minRouterGuardDefinitionScore >= 85 &&
    fields.minRouteEvaluationScore >= 85 &&
    fields.minComposerGuardHandoffScore >= 85 &&
    fields.minRollbackReferenceScore >= 85 &&
    fields.violationCount === 0 &&
    fields.criticalViolationCount === 0 &&
    fields.productionWiringAllowedNowCount === 0 &&
    fields.routerChangeAllowedNowCount === 0 &&
    fields.routeMutationAllowedNowCount === 0 &&
    fields.composerChangeAllowedNowCount === 0 &&
    fields.endpointChangeAllowedNowCount === 0 &&
    fields.userVisibleOutputAllowedNowCount === 0 &&
    fields.realPersistenceAllowedNowCount === 0 &&
    fields.actionExecutionAllowedNowCount === 0 &&
    fields.routerImportAttemptedCount === 0 &&
    fields.routerRuntimeWiringActiveNowCount === 0 &&
    fields.routeMutationAttemptedCount === 0 &&
    fields.decisionSupportRouteActivatedNowCount === 0 &&
    fields.featureFlagRuntimeReadNowCount === 0 &&
    fields.sprint38ShellDecision === "ready_for_default_off_router_guard_shell";

  return allClean ? "ready_for_default_off_composer_guard_shell" : "continue_router_guard_shell_only";
}

function recommendedNextSprintFor(decision: DecisionSupportDefaultOffRouterGuardShellDecision): string {
  switch (decision) {
    case "ready_for_default_off_composer_guard_shell":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_router_guard_definition_gap":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Router Guard Definition Hardening)`;
    case "blocked_by_default_off_gap":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Default-Off Resolution Hardening)`;
    case "blocked_by_router_import_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Router Import Risk Hardening)`;
    case "blocked_by_route_mutation_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Route Mutation Risk Hardening)`;
    case "blocked_by_production_wiring_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Production Wiring Risk Hardening)`;
    case "blocked_by_visibility_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Visibility Risk Hardening)`;
    case "blocked_by_leakage_or_side_effect_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Leakage/Side Effect Hardening)`;
    case "continue_router_guard_shell_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

/**
 * Turns a `runDecisionSupportDefaultOffRouterGuardShell()` result — or a bare
 * `DecisionSupportDefaultOffRouterGuardShellCaseResult[]` plus `options.sprint38ShellDecision` — into a
 * review-ready report: per-shell-kind counts, QA status counts, safety counts (every production-side-effect
 * count expected zero), score averages/minimums, a decision, and a recommended next sprint. Pure — takes
 * already-computed case results rather than re-running anything.
 */
export function summarizeDecisionSupportDefaultOffRouterGuardShell(
  resultOrCaseResults: DecisionSupportDefaultOffRouterGuardShellResult | DecisionSupportDefaultOffRouterGuardShellCaseResult[],
  options: DecisionSupportDefaultOffRouterGuardShellSummaryOptions = {},
): DecisionSupportDefaultOffRouterGuardShellSummary {
  const caseResults = Array.isArray(resultOrCaseResults) ? resultOrCaseResults : resultOrCaseResults.caseResults;
  const sprint38ShellDecision = Array.isArray(resultOrCaseResults) ? options.sprint38ShellDecision : (options.sprint38ShellDecision ?? resultOrCaseResults.shellSummary.decision);
  const resultWarnings = Array.isArray(resultOrCaseResults) ? [] : resultOrCaseResults.warnings;

  const totalCases = caseResults.length;

  const routerGuardEvaluatedCount = totalCases;
  const routerGuardAcceptedCount = caseResults.filter((c) => c.routerGuardAccepted).length;
  const routerGuardRejectedCount = caseResults.filter((c) => c.routerGuardRejected).length;
  const routerGuardBlockedCount = caseResults.filter((c) => c.routerGuardBlocked).length;

  const clarificationGateRouterGuardCount = caseResults.filter((c) => c.routerGuardShellKind === "clarification_gate_router_guard_shell").length;
  const routePreservationRouterGuardCount = caseResults.filter((c) => c.routerGuardShellKind === "route_preservation_router_guard_shell").length;
  const unsupportedBoundaryRouterGuardCount = caseResults.filter((c) => c.routerGuardShellKind === "unsupported_boundary_router_guard_shell").length;
  const shadowOnlyRouterGuardCount = caseResults.filter((c) => c.routerGuardShellKind === "shadow_only_router_guard_shell").length;
  const blockedUnsafeRouterGuardCount = caseResults.filter((c) => c.routerGuardShellKind === "blocked_unsafe_router_guard_shell").length;

  const qaPassCount = caseResults.filter((c) => c.qaStatus === "pass").length;
  const qaWarningCount = caseResults.filter((c) => c.qaStatus === "warning").length;
  const qaFailCount = caseResults.filter((c) => c.qaStatus === "fail").length;
  const qaBlockedCount = caseResults.filter((c) => c.qaStatus === "blocked").length;

  const routerGuardDefinitionPassedCount = caseResults.filter((c) => c.routerGuardDefinitionPassed).length;
  const featureFlagDisabledPassedCount = caseResults.filter((c) => c.featureFlagDisabledPassed).length;
  const noRouterImportPassedCount = caseResults.filter((c) => c.noRouterImportPassed).length;
  const noRouterRuntimeWiringPassedCount = caseResults.filter((c) => c.noRouterRuntimeWiringPassed).length;
  const noRouteMutationPassedCount = caseResults.filter((c) => c.noRouteMutationPassed).length;
  const currentRoutePreservationPassedCount = caseResults.filter((c) => c.currentRoutePreservationPassed).length;
  const routeIntentPreservationPassedCount = caseResults.filter((c) => c.routeIntentPreservationPassed).length;
  const composerGuardHandoffPassedCount = caseResults.filter((c) => c.composerGuardHandoffPassed).length;
  const rollbackReferencePassedCount = caseResults.filter((c) => c.rollbackReferencePassed).length;
  const noApprovalOverclaimPassedCount = caseResults.filter((c) => c.noApprovalOverclaimPassed).length;
  const noVisibilityAttemptPassedCount = caseResults.filter((c) => c.noVisibilityAttemptPassed).length;
  const noProductionEligibilityPassedCount = caseResults.filter((c) => c.noProductionEligibilityPassed).length;
  const noLeaksPassedCount = caseResults.filter((c) => c.noLeaksPassed).length;
  const noSideEffectsPassedCount = caseResults.filter((c) => c.noSideEffectsPassed).length;

  const safeForDefaultOffComposerGuardShellCount = caseResults.filter((c) => c.safeForDefaultOffComposerGuardShell).length;
  const safeForUserVisibleOutputNowCount = caseResults.filter((c) => c.safeForUserVisibleOutputNow).length;
  const safeForProductionCount = caseResults.filter((c) => c.safeForProduction).length;

  const routerGuardDefinitionScores = caseResults.map((c) => c.routerGuardDefinition.score);
  const routeEvaluationScores = caseResults.map((c) => c.routeEvaluation.score);
  const composerGuardHandoffScores = caseResults.map((c) => c.composerGuardReadinessHandoff.score);
  const rollbackReferenceScores = caseResults.map((c) => c.rollbackReference.score);

  const averageRouterGuardDefinitionScore = average(routerGuardDefinitionScores);
  const averageRouteEvaluationScore = average(routeEvaluationScores);
  const averageComposerGuardHandoffScore = average(composerGuardHandoffScores);
  const averageRollbackReferenceScore = average(rollbackReferenceScores);

  const minRouterGuardDefinitionScore = routerGuardDefinitionScores.length > 0 ? Math.min(...routerGuardDefinitionScores) : 0;
  const minRouteEvaluationScore = routeEvaluationScores.length > 0 ? Math.min(...routeEvaluationScores) : 0;
  const minComposerGuardHandoffScore = composerGuardHandoffScores.length > 0 ? Math.min(...composerGuardHandoffScores) : 0;
  const minRollbackReferenceScore = rollbackReferenceScores.length > 0 ? Math.min(...rollbackReferenceScores) : 0;

  const allViolations = caseResults.flatMap((c) => c.violations);
  const violationCount = allViolations.length;
  const criticalViolationCount = caseResults.filter((c) => c.riskLevel === "critical").flatMap((c) => c.violations).length;

  const productionWiringAllowedNowCount = caseResults.filter((c) => c.productionWiringAllowedNow).length;
  const routerChangeAllowedNowCount = caseResults.filter((c) => c.routerChangeAllowedNow).length;
  const routeMutationAllowedNowCount = caseResults.filter((c) => c.routeMutationAllowedNow).length;
  const composerChangeAllowedNowCount = caseResults.filter((c) => c.composerChangeAllowedNow).length;
  const endpointChangeAllowedNowCount = caseResults.filter((c) => c.endpointChangeAllowedNow).length;
  const userVisibleOutputAllowedNowCount = caseResults.filter((c) => c.userVisibleOutputAllowedNow).length;
  const realPersistenceAllowedNowCount = caseResults.filter((c) => c.realPersistenceAllowedNow).length;
  const actionExecutionAllowedNowCount = caseResults.filter((c) => c.actionExecutionAllowedNow).length;

  const routerImportAttemptedCount = caseResults.filter((c) => c.routeEvaluation.routerImportAttempted).length;
  const routerRuntimeWiringActiveNowCount = caseResults.filter((c) => c.routeEvaluation.routerRuntimeWiringActiveNow).length;
  const routeMutationAttemptedCount = caseResults.filter((c) => c.routeEvaluation.routeMutationAttempted).length;
  const decisionSupportRouteActivatedNowCount = caseResults.filter((c) => c.routeEvaluation.decisionSupportRouteActivatedNow).length;
  const featureFlagRuntimeReadNowCount = caseResults.filter((c) => c.featureFlagStateReference.runtimeReadAttempted).length;

  const decision = computeDecision({
    totalCases,
    routerGuardEvaluatedCount,
    routerGuardAcceptedCount,
    routerGuardRejectedCount,
    routerGuardBlockedCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    routerGuardDefinitionPassedCount,
    featureFlagDisabledPassedCount,
    noRouterImportPassedCount,
    noRouterRuntimeWiringPassedCount,
    noRouteMutationPassedCount,
    currentRoutePreservationPassedCount,
    routeIntentPreservationPassedCount,
    composerGuardHandoffPassedCount,
    rollbackReferencePassedCount,
    noApprovalOverclaimPassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    safeForDefaultOffComposerGuardShellCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    averageRouterGuardDefinitionScore,
    averageRouteEvaluationScore,
    averageComposerGuardHandoffScore,
    averageRollbackReferenceScore,
    minRouterGuardDefinitionScore,
    minRouteEvaluationScore,
    minComposerGuardHandoffScore,
    minRollbackReferenceScore,
    violationCount,
    criticalViolationCount,
    productionWiringAllowedNowCount,
    routerChangeAllowedNowCount,
    routeMutationAllowedNowCount,
    composerChangeAllowedNowCount,
    endpointChangeAllowedNowCount,
    userVisibleOutputAllowedNowCount,
    realPersistenceAllowedNowCount,
    actionExecutionAllowedNowCount,
    routerImportAttemptedCount,
    routerRuntimeWiringActiveNowCount,
    routeMutationAttemptedCount,
    decisionSupportRouteActivatedNowCount,
    featureFlagRuntimeReadNowCount,
    sprint38ShellDecision,
  });

  const warnings = [...resultWarnings, ...caseResults.flatMap((c) => c.warnings)];

  return {
    totalCases,
    routerGuardEvaluatedCount,
    routerGuardAcceptedCount,
    routerGuardRejectedCount,
    routerGuardBlockedCount,
    clarificationGateRouterGuardCount,
    routePreservationRouterGuardCount,
    unsupportedBoundaryRouterGuardCount,
    shadowOnlyRouterGuardCount,
    blockedUnsafeRouterGuardCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    routerGuardDefinitionPassedCount,
    featureFlagDisabledPassedCount,
    noRouterImportPassedCount,
    noRouterRuntimeWiringPassedCount,
    noRouteMutationPassedCount,
    currentRoutePreservationPassedCount,
    routeIntentPreservationPassedCount,
    composerGuardHandoffPassedCount,
    rollbackReferencePassedCount,
    noApprovalOverclaimPassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    safeForDefaultOffComposerGuardShellCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    averageRouterGuardDefinitionScore,
    averageRouteEvaluationScore,
    averageComposerGuardHandoffScore,
    averageRollbackReferenceScore,
    minRouterGuardDefinitionScore,
    minRouteEvaluationScore,
    minComposerGuardHandoffScore,
    minRollbackReferenceScore,
    violationCount,
    criticalViolationCount,
    productionWiringAllowedNowCount,
    routerChangeAllowedNowCount,
    routeMutationAllowedNowCount,
    composerChangeAllowedNowCount,
    endpointChangeAllowedNowCount,
    userVisibleOutputAllowedNowCount,
    realPersistenceAllowedNowCount,
    actionExecutionAllowedNowCount,
    routerImportAttemptedCount,
    routerRuntimeWiringActiveNowCount,
    routeMutationAttemptedCount,
    decisionSupportRouteActivatedNowCount,
    featureFlagRuntimeReadNowCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeAcceptedRouterGuardResults: caseResults.filter((c) => c.routerGuardAccepted).slice(0, REPRESENTATIVE_LIMIT),
    rejectedRouterGuardResults: caseResults.filter((c) => c.routerGuardRejected),
    blockedRouterGuardResults: caseResults.filter((c) => c.routerGuardBlocked),
    warnings,
  } satisfies DecisionSupportDefaultOffRouterGuardShellSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 39R default-off router guard shell — mirrors the style of
 * `explainDecisionSupportDefaultOffFeatureFlagImplementationShell()` (Sprint 38R). See
 * `docs/conversational-brain-decision-support-default-off-router-guard-shell.md` for full context.
 */
export function explainDecisionSupportDefaultOffRouterGuardShell(): DecisionSupportDefaultOffRouterGuardShellExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-default-off-router-guard-shell",
    purpose:
      "Builds a formal, no-op default-off router guard shell (types, definition, feature-flag-state reference, route evaluation, composer guard " +
      "handoff, rollback-reference functions) for every Sprint 38R-accepted default-off feature flag implementation shell case — without ever " +
      "importing the real router, mutating a live route, activating a feature flag, reading process.env or any runtime configuration source, " +
      "touching the real composer or endpoint, or showing anything to a real user.",
    nonGoals: [
      "Import or wire the real router, or mutate a live route.",
      "Implement a real production router guard.",
      "Activate a feature flag, or read process.env or any runtime configuration source.",
      "Wire the composer or endpoint directly to live decision_support.",
      "Show any output to a real user.",
      "Create a real database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action, create any real task, or send any real email/draft.",
      "Persist any real output.",
      "Claim real governance approval or production eligibility.",
      "Call an LLM or an external API.",
    ],
    shellProfile:
      'The "strict_default_off_router_guard_shell" profile: `shellOnly`, `noOpRouterGuard`, and `defaultOff` are always true, every allow* field ' +
      "(allowProductionRouterGuardImplementation/allowRouterImport/allowRouterRuntimeWiring/allowRouteMutation/allowFeatureFlagRuntimeRead/" +
      "allowFeatureFlagActivation/allowProductionWiring/allowComposerChange/allowEndpointChange/allowUserVisibleOutput/allowRealPersistence/" +
      "allowDbWrite/allowSupabaseWrite/allowExternalCalls/allowActionExecution/allowTaskCreation/allowEmailDraftCreation) is a literal false, " +
      "forced regardless of any override a caller passes, and every require* field is always true.",
    shellModes: [
      "router_guard_shell_only (default): the full default-off router guard shell, covering every shell kind.",
      "no_op_route_selection_review: emphasizes evaluateDecisionSupportDefaultOffRouterGuardRoute() output.",
      "existing_route_preservation_guard_review: emphasizes route_preservation_router_guard_shell cases.",
      "clarification_gate_route_guard_review: emphasizes clarification_gate_router_guard_shell cases.",
      "unsupported_boundary_route_guard_review: emphasizes unsupported_boundary_router_guard_shell cases.",
      "composer_guard_handoff_review: emphasizes createDecisionSupportDefaultOffComposerGuardReadinessHandoff() output.",
      "rollback_route_guard_shell_review: emphasizes createDecisionSupportDefaultOffRouterGuardRollbackReference() output.",
    ],
    shellKindRules: [
      "clarification_gate_flag_shell (Sprint 38R shell kind) -> clarification_gate_router_guard_shell.",
      "route_preservation_flag_shell -> route_preservation_router_guard_shell.",
      "unsupported_boundary_flag_shell -> unsupported_boundary_router_guard_shell.",
      "shadow_only_flag_shell -> shadow_only_router_guard_shell.",
      "blocked_unsafe_flag_shell -> blocked_unsafe_router_guard_shell (the safe fallback for any shell kind this shell does not build a positive definition for).",
    ],
    routerGuardDefinitionRules: [
      `Preserves ${PROPOSED_FEATURE_FLAG_KEY} as the feature flag key Sprint 38R already resolved as statically default-off — never implemented as a real router guard.`,
      "Every definition is shellOnly: true, noOpRouterGuard: true, productionRouterGuardImplementedNow: false, routerImportAllowedNow: false, routerRuntimeWiringActiveNow: false, routeMutationAllowedNow: false.",
      "requiresClarificationGatePreservation/requiresExistingRoutePreservation/requiresUnsupportedBoundaryPreservation/requiresShadowOnlyPreservation/requiresUnsafeRouteBlock are set true for exactly the shell kind that needs them, false for the rest.",
    ],
    featureFlagStateReferenceRules: [
      "createDecisionSupportDefaultOffRouterGuardFeatureFlagStateReference() always resolves featureFlagEnabled: false — a static reference to the Sprint 38R feature flag shell state, never a runtime read.",
      "Negative-test knobs (forceEnabled, forceState, forceSource, forceRuntimeReadAttempted, forceActivationAttempted) never actually set featureFlagEnabled to true — they only flip the matching *Attempted flag (or the state/source) so the validation layer can register the corresponding violation.",
    ],
    routeEvaluationRules: [
      "evaluateDecisionSupportDefaultOffRouterGuardRoute() always resolves currentRoutePreserved: true, routeMutationAllowedNow: false, decisionSupportRouteActivatedNow: false by default.",
      "Negative-test knobs (forceRouteMutationAttempted, forceRouterImportAttempted, forceRouterRuntimeWiringActiveNow, forceDecisionSupportRouteActivatedNow, forceUserVisibleNow, forceProductionEligibleNow) never actually mutate a route, import the router, or show output — they only flip the matching flag.",
    ],
    currentRoutePreservationRules: [
      "currentRoutePreservationPassed requires routeEvaluation.currentRoutePreserved === true and decisionSupportRouteActivatedNow === false.",
      "Every route evaluation preserves the current live route by construction — only a direct test mutation or a forced route-mutation/activation attempt can fail this check.",
    ],
    futureRouteIntentRules: [
      "clarification_gate_router_guard_shell -> future_route_to_clarification_gate.",
      "route_preservation_router_guard_shell -> future_preserve_existing_route.",
      "unsupported_boundary_router_guard_shell -> future_preserve_unsupported_boundary.",
      "shadow_only_router_guard_shell -> future_keep_shadow_only.",
      "blocked_unsafe_router_guard_shell -> future_block_unsafe.",
    ],
    composerGuardHandoffRules: [
      "createDecisionSupportDefaultOffComposerGuardReadinessHandoff() never implements a composer guard or wires it at runtime — composerGuardImplementationAllowedNow and composerRuntimeWiringAllowedNow are always false.",
      "readyForComposerGuardShell is true whenever the source Sprint 38R shell case is otherwise healthy and the route evaluation stays a no-op (current route preserved, no mutation/import/wiring/activation attempted).",
    ],
    rollbackReferenceRules: [
      "createDecisionSupportDefaultOffRouterGuardRollbackReference() never implements a real rollback path — rollbackImplementedNow is always false.",
      "A rollback must disable the feature flag and fall back to the current route, require no data migration or persistent-state cleanup, and require an incident owner plus a verification checklist before any future activation.",
    ],
    routerGuardCaseEvaluationRules: [
      "Confirms the source Sprint 38R shell case was shellAccepted and safeForDefaultOffRouterGuardShell before treating the router guard shell as passable.",
      "Validates the router guard definition, feature-flag-state reference, no-router-import, no-router-runtime-wiring, no-route-mutation, current-route-preservation, route-intent-preservation, composer guard handoff, and rollback reference together, plus (propagated from the upstream shell case) no-approval-overclaim, no-visibility-attempt, no-production-eligibility, no-leaks, and no-side-effects.",
      "qaStatus is blocked if any critical (import/wiring/mutation/preservation/visibility/leak/side-effect/overclaim/enabled-now) violation is present, else fail if any other violation is present (a definitional gap with no critical risk), else pass.",
    ],
    routerGuardRunRules: [
      "Reuses (or accepts) the Sprint 38R default-off feature flag implementation shell against the same corpus rather than re-deriving it.",
      "Evaluates exactly one router guard case per Sprint 38R shell case result.",
      "Never imports or wires the real router, never mutates a live route, never activates a feature flag, never touches the composer/endpoint, never shows output to a user, and never persists output.",
    ],
    decisionRule:
      "ready_for_default_off_composer_guard_shell requires: totalCases > 0, routerGuardAcceptedCount === totalCases, every rejected/blocked count " +
      "at zero, qaPassCount === totalCases, every definitional/handoff/reference pass count === totalCases, every score average/minimum at or " +
      "above its floor, every violation/AllowedNow/attempted count at zero, and the Sprint 38R shell decision === " +
      "ready_for_default_off_router_guard_shell. Otherwise, in priority order: blocked_by_leakage_or_side_effect_risk if any leak/side-effect " +
      "gate fails; else blocked_by_visibility_risk if any visibility gate fails or a nonzero safeForUserVisibleOutputNow/safeForProduction count " +
      "is observed; else blocked_by_router_import_risk if a router import is attempted or fails; else blocked_by_route_mutation_risk if a route " +
      "mutation is attempted, allowed, or fails, or decision_support is activated; else blocked_by_production_wiring_risk if any production-" +
      "wiring/router/composer/endpoint AllowedNow count is nonzero; else blocked_by_router_guard_definition_gap; else blocked_by_default_off_gap; " +
      "else continue_router_guard_shell_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyUserVisibleOutputIsNotShown:
      "Every case result carries userVisibleOutputAllowedNow: false and safeForUserVisibleOutputNow: false — a future composer guard shell " +
      "activation must explicitly review and approve output before it could ever reach a real user.",
    whyRouterIsNotChanged: "brainRouter.ts is production code. This shell only builds a synthetic router guard definition and route evaluation offline — it never imports or modifies the router.",
    whyRouterIsNotImported:
      "routerImportAllowedNow and routerImportAttempted are always false in a clean case (enforced by a source-scanning test that this module " +
      "never imports the real router).",
    whyComposerIsNotChanged: "responseComposer.ts is production code. This shell never imports or modifies the composer — it only documents a composer guard readiness handoff for Sprint 40R.",
    whyEndpointIsNotChanged: "POST /api/command-center/chat is production code. This shell never imports or modifies the endpoint or its handlers.",
    whyFeatureFlagIsNotActivated:
      "featureFlagEnabledNow, featureFlagEnabled, and activationAttempted are always false — activation is reserved for a later, explicitly " +
      "governed sprint with a rollback contract, a composer/endpoint guard, a monitoring contract, and a manual smoke test.",
    whyProcessEnvIsNotRead:
      "This module never reads process.env or any runtime configuration source — prohibitedRouterSources explicitly lists process.env, and " +
      "featureFlagStateReference.source is always static_default_off (enforced by a source-scanning test).",
    whyProductionRouterGuardIsNotImplemented:
      "productionRouterGuardImplementedNow is always false — this sprint only builds the shell (types, definition, route evaluation, handoff, " +
      "rollback-reference functions), not a real production router guard implementation.",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review (reused transitively via the Sprint 38R/37R/36R/35R/34R/33R/32R/31R chain) still resolves to " +
      "do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR " +
      "policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by building a router guard shell.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseStorageIsNotCreated: "This shell never writes anything real — every definition/state reference/route evaluation/handoff/reference stays shellOnly: true, every *AllowedNow field stays false.",
    whyStorageAdapterIsNotCreated: "This shell reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 38R/37R/36R/35R/34R/33R/32R/31R chain) as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this shell does not build.",
    whyApprovalIsNotOverclaimed:
      "noApprovalOverclaimPassed propagates directly from the upstream Sprint 38R shell case's own governance invariants (propagated in turn from " +
      "the Sprint 37R gate's governanceChecklist: governanceApprovalGrantedNow: false, approvalStateOverclaimed: false) — this shell never claims " +
      "real governance approval on its own.",
    expectedSprint40Path:
      "If every router guard case stays qaStatus: pass, safeForDefaultOffComposerGuardShell: true, every violation/AllowedNow/attempted count " +
      "stays at zero, every score average/minimum stays at or above its floor, and the Sprint 38R shell decision stays " +
      "ready_for_default_off_router_guard_shell, Sprint 40R can implement a default-off composer guard shell — still never activated, still " +
      "never wired to the real router/composer/endpoint, and still never shown to a real user until a future, explicitly governed sprint turns " +
      "it on for a real workspace.",
  };
}
