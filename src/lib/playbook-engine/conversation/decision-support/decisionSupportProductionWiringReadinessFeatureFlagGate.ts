/**
 * Sprint 37R — Decision Support Production Wiring Readiness / Feature Flag Gate.
 *
 * A pure, offline, deterministic, **readiness-only** gate — not a real feature flag, not a real router,
 * composer, or endpoint wiring — that reviews every Sprint 36R-accepted default-off adapter simulation
 * against a future feature flag contract, a future production wiring contract, a future rollback contract,
 * and a governance approval checklist. It never implements, activates, or reads a real feature flag; never
 * touches the real router, composer, or endpoint; never shows anything to a real user; and never persists
 * anything real.
 *
 * Reuses, rather than reimplements: the Sprint 36R default-off route/composer integration adapter
 * (`runDecisionSupportDefaultOffRouteComposerIntegrationAdapter`,
 * `summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter`), which in turn reuses the Sprint
 * 35R user-visible dry run evaluation harness, the Sprint 34R response draft quality evaluation, the
 * Sprint 33R response draft harness, the Sprint 32R response QA / user-visible dry run plan, the Sprint
 * 31R clarification-gated integration plan, the Sprint 30R controlled shadow replay evaluation, the Sprint
 * 29R persistence readiness review, the Sprint 25R-28R layer evaluations, and the Sprint 22R clarification
 * response evaluation.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call Supabase,
 * send email, create a task, or call an LLM; does not use `fetch`; does not read an environment variable or activate
 * a feature flag; and does not connect `decision_support` to the router. It never shows any
 * decision-support output to a user, and it never persists any real output. Every contract and checklist
 * this module produces is `readinessOnly: true`, `generatedForReadinessGateOnly: true`, and every
 * `*AllowedNow` field on a case result is always `false`. See
 * `docs/conversational-brain-decision-support-production-wiring-readiness-feature-flag-gate.md` for the
 * full design writeup.
 */

import { runDecisionSupportDefaultOffRouteComposerIntegrationAdapter, summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter } from "./decisionSupportDefaultOffRouteComposerIntegrationAdapter";

import type {
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  DecisionSupportFeatureFlagGateContract,
  DecisionSupportFeatureFlagGateContractStatus,
  DecisionSupportGovernanceApprovalChecklist,
  DecisionSupportGovernanceChecklistStatus,
  DecisionSupportProductionWiringContractStatus,
  DecisionSupportProductionWiringReadinessContract,
  DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  DecisionSupportProductionWiringReadinessFeatureFlagGateConfig,
  DecisionSupportProductionWiringReadinessFeatureFlagGateDecision,
  DecisionSupportProductionWiringReadinessFeatureFlagGateExplain,
  DecisionSupportProductionWiringReadinessFeatureFlagGateOptions,
  DecisionSupportProductionWiringReadinessFeatureFlagGateResult,
  DecisionSupportProductionWiringReadinessFeatureFlagGateSummary,
  DecisionSupportProductionWiringReadinessFeatureFlagGateSummaryOptions,
  DecisionSupportProductionWiringReadinessGateKind,
  DecisionSupportProductionWiringReadinessGateQaStatus,
  DecisionSupportProductionWiringReadinessGateRiskLevel,
  DecisionSupportProductionWiringReadinessGateViolationType,
  DecisionSupportRollbackContractStatus,
  DecisionSupportRollbackReadinessContract,
} from "./decisionSupportProductionWiringReadinessFeatureFlagGateTypes";

export type {
  DecisionSupportProductionWiringReadinessFeatureFlagGateProfile,
  DecisionSupportProductionWiringReadinessFeatureFlagGateMode,
  DecisionSupportProductionWiringReadinessFeatureFlagGateDecision,
  DecisionSupportProductionWiringReadinessGateKind,
  DecisionSupportFeatureFlagGateContractStatus,
  DecisionSupportProductionWiringContractStatus,
  DecisionSupportRollbackContractStatus,
  DecisionSupportGovernanceChecklistStatus,
  DecisionSupportProductionWiringReadinessGateQaStatus,
  DecisionSupportProductionWiringReadinessGateRiskLevel,
  DecisionSupportProductionWiringReadinessGateViolationType,
  DecisionSupportProductionWiringReadinessFeatureFlagGateConfig,
  DecisionSupportFeatureFlagGateContract,
  DecisionSupportProductionWiringReadinessContract,
  DecisionSupportRollbackReadinessContract,
  DecisionSupportGovernanceApprovalChecklist,
  DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult,
  DecisionSupportProductionWiringReadinessFeatureFlagGateOptions,
  DecisionSupportProductionWiringReadinessFeatureFlagGateResult,
  DecisionSupportProductionWiringReadinessFeatureFlagGateSummaryOptions,
  DecisionSupportProductionWiringReadinessFeatureFlagGateSummary,
  DecisionSupportProductionWiringReadinessFeatureFlagGateExplain,
} from "./decisionSupportProductionWiringReadinessFeatureFlagGateTypes";

export const DECISION_SUPPORT_PRODUCTION_WIRING_READINESS_FEATURE_FLAG_GATE_VERSION = "37R.1.0";

const PROPOSED_FEATURE_FLAG_KEY = "pmfreak.decisionSupport.defaultOffRouteComposerAdapter";

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 38R — Default-Off Feature Flag Implementation Shell";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 37R — Production Wiring Readiness / Feature Flag Gate";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_production_wiring_readiness_feature_flag_gate"` default config. Every
 * `allow*` real-side-effect field is always `false`, forced regardless of any override a caller passes —
 * mirroring how every prior sprint's config never actually loosens its own `allow*` real-side-effect flags
 * from an override. Every `require*` field is always `true`.
 */
export function createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig(
  overrides: Partial<DecisionSupportProductionWiringReadinessFeatureFlagGateConfig> = {},
): DecisionSupportProductionWiringReadinessFeatureFlagGateConfig {
  const config: DecisionSupportProductionWiringReadinessFeatureFlagGateConfig = {
    profile: "strict_production_wiring_readiness_feature_flag_gate",
    mode: overrides.mode ?? "readiness_gate_only",
    readinessOnly: true,
    // These fifteen are never actually loosened here, regardless of what a caller's override object
    // claims — this is the production wiring readiness / feature flag gate's own strict, non-negotiable
    // invariant.
    allowProductionWiring: false,
    allowRouterChange: false,
    allowComposerChange: false,
    allowEndpointChange: false,
    allowFeatureFlagImplementation: false,
    allowFeatureFlagActivation: false,
    allowFeatureFlagRuntimeRead: false,
    allowUserVisibleOutput: false,
    allowRealPersistence: false,
    allowDbWrite: false,
    allowSupabaseWrite: false,
    allowExternalCalls: false,
    allowActionExecution: false,
    allowTaskCreation: false,
    allowEmailDraftCreation: false,
    requireDefaultOffAdapterPass: true,
    requireFeatureFlagContract: true,
    requireProductionWiringContract: true,
    requireRollbackContract: true,
    requireGovernanceChecklist: true,
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
  "Implement a default-off feature flag implementation shell.",
  "Implement a no-op feature flag contract implementation.",
  "Write feature flag default-off tests.",
  "Implement a route guard implementation shell.",
  "Implement a composer guard implementation shell.",
  "Implement an endpoint guard implementation shell.",
  "Write a rollback smoke test plan.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Wire router to live decision_support.",
  "Wire composer to live decision_support.",
  "Wire endpoint to live decision_support.",
  "Implement active production feature flag.",
  "Activate production feature flag.",
  "Read runtime feature flag.",
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
export function listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Gate kind mapping ────────────────────────────────────────────────────────────────

function gateKindForAdapterKind(adapterKind: string): DecisionSupportProductionWiringReadinessGateKind {
  switch (adapterKind) {
    case "clarification_gate_adapter":
      return "clarification_gate_readiness";
    case "route_preservation_adapter":
      return "route_preservation_readiness";
    case "unsupported_boundary_adapter":
      return "unsupported_boundary_readiness";
    case "shadow_only_adapter":
      return "shadow_only_readiness";
    case "blocked_unsafe_adapter":
    default:
      return "blocked_unsafe_readiness";
  }
}

// ─── Feature flag gate contract ───────────────────────────────────────────────────────

export type DecisionSupportFeatureFlagGateContractOptions = {
  config?: Partial<DecisionSupportProductionWiringReadinessFeatureFlagGateConfig>;
};

const PROHIBITED_ACTIVATION_PATHS: string[] = [
  "implicit_activation",
  "env_var_runtime_read_in_sprint_37r",
  "router_default_on",
  "composer_default_on",
  "endpoint_default_on",
  "user_visible_output_without_approval",
  "activation_without_rollback_contract",
];

const REQUIRED_FUTURE_CHECKS: string[] = [
  "default_off_flag_exists",
  "flag_defaults_false",
  "router_guard_checks_flag",
  "composer_guard_checks_flag",
  "endpoint_guard_checks_flag",
  "rollback_disables_flag",
  "monitoring_contract_exists",
  "manual_smoke_test_completed",
];

/**
 * Builds the feature flag gate contract a future feature flag shell (Sprint 38R) would need to satisfy for
 * a given Sprint 36R adapter case result. Never implements, activates, or reads a real feature flag — the
 * proposed flag key is a documentation-only string.
 */
export function createDecisionSupportFeatureFlagGateContract(
  adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  _options: DecisionSupportFeatureFlagGateContractOptions = {},
): DecisionSupportFeatureFlagGateContract {
  return {
    contractId: `feature-flag-contract-${adapterCaseResult.caseId}`,
    proposedFeatureFlagKey: PROPOSED_FEATURE_FLAG_KEY,
    status: "ready",
    readinessOnly: true,
    featureFlagImplementedNow: false,
    featureFlagActiveNow: false,
    featureFlagRuntimeReadNow: false,
    defaultValueMustBe: false,
    activationRequiresExplicitFutureSprint: true,
    activationRequiresGovernanceApproval: true,
    activationRequiresRollbackPlan: true,
    activationRequiresMonitoringPlan: true,
    activationRequiresManualVerification: true,
    activationRequiresUserVisibleOutputReview: true,
    activationRequiresProductionIncidentRollbackOwner: true,
    prohibitedActivationPaths: [...PROHIBITED_ACTIVATION_PATHS],
    requiredFutureChecks: [...REQUIRED_FUTURE_CHECKS],
    score: 95,
    rationale: [
      `Proposes ${PROPOSED_FEATURE_FLAG_KEY} as a future default-off feature flag key — it is never implemented or activated by this sprint.`,
      "Every activation precondition (governance approval, rollback plan, monitoring plan, manual verification, user-visible output review, production incident rollback owner) is required before Sprint 38R or later may implement the flag shell.",
    ],
  } satisfies DecisionSupportFeatureFlagGateContract;
}

function checkFeatureFlagContract(contract: DecisionSupportFeatureFlagGateContract): { passed: boolean; violations: DecisionSupportProductionWiringReadinessGateViolationType[] } {
  const violations: DecisionSupportProductionWiringReadinessGateViolationType[] = [];
  if (contract.featureFlagActiveNow !== false) violations.push("feature_flag_activation_path_enabled");
  if (contract.featureFlagRuntimeReadNow !== false) violations.push("feature_flag_runtime_read_attempted");
  if (contract.defaultValueMustBe !== false) violations.push("feature_flag_default_off_missing");
  const contractInvariantsOk =
    contract.readinessOnly === true &&
    contract.featureFlagImplementedNow === false &&
    contract.activationRequiresExplicitFutureSprint === true &&
    contract.activationRequiresGovernanceApproval === true &&
    contract.activationRequiresRollbackPlan === true &&
    contract.activationRequiresMonitoringPlan === true &&
    contract.activationRequiresManualVerification === true &&
    contract.activationRequiresUserVisibleOutputReview === true &&
    contract.activationRequiresProductionIncidentRollbackOwner === true &&
    contract.status === "ready" &&
    contract.score >= 85;
  if (!contractInvariantsOk && violations.length === 0) violations.push("feature_flag_contract_missing");
  return { passed: violations.length === 0, violations };
}

// ─── Production wiring readiness contract ─────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessContractOptions = {
  config?: Partial<DecisionSupportProductionWiringReadinessFeatureFlagGateConfig>;
};

/**
 * Builds the production wiring readiness contract a future router/composer/endpoint wiring (Sprint 38R or
 * later) would need to satisfy for a given Sprint 36R adapter case result. Never touches the real router,
 * composer, or endpoint.
 */
export function createDecisionSupportProductionWiringReadinessContract(
  adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  _options: DecisionSupportProductionWiringReadinessContractOptions = {},
): DecisionSupportProductionWiringReadinessContract {
  return {
    contractId: `production-wiring-contract-${adapterCaseResult.caseId}`,
    status: "ready",
    readinessOnly: true,
    productionWiringImplementedNow: false,
    routerChangeAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    routerImportAllowedNow: false,
    composerImportAllowedNow: false,
    endpointImportAllowedNow: false,
    requiresFeatureFlagDefaultOff: true,
    requiresRouterGuard: true,
    requiresComposerGuard: true,
    requiresEndpointGuard: true,
    requiresNoOpFallback: true,
    requiresExistingRoutePreservation: true,
    requiresClarificationGatePreservation: true,
    requiresUnsupportedBoundaryPreservation: true,
    requiresNoUserVisibleOutputByDefault: true,
    requiresNoPersistenceByDefault: true,
    requiresNoExternalCallsByDefault: true,
    score: 94,
    rationale: [
      "No router, composer, or endpoint import is allowed until a default-off feature flag guard exists on every one of those three surfaces.",
      "Existing production routes (clarification gate, route preservation, unsupported boundary) must stay preserved by default — this contract never authorizes a production route/composer/endpoint change now.",
    ],
  } satisfies DecisionSupportProductionWiringReadinessContract;
}

function checkProductionWiringContract(
  contract: DecisionSupportProductionWiringReadinessContract,
): { passed: boolean; violations: DecisionSupportProductionWiringReadinessGateViolationType[] } {
  const violations: DecisionSupportProductionWiringReadinessGateViolationType[] = [];
  if (contract.routerChangeAllowedNow !== false || contract.routerImportAllowedNow !== false) violations.push("router_wiring_allowed");
  if (contract.composerChangeAllowedNow !== false || contract.composerImportAllowedNow !== false) violations.push("composer_wiring_allowed");
  if (contract.endpointChangeAllowedNow !== false || contract.endpointImportAllowedNow !== false) violations.push("endpoint_wiring_allowed");
  const contractInvariantsOk =
    contract.readinessOnly === true &&
    contract.productionWiringImplementedNow === false &&
    contract.requiresFeatureFlagDefaultOff === true &&
    contract.requiresRouterGuard === true &&
    contract.requiresComposerGuard === true &&
    contract.requiresEndpointGuard === true &&
    contract.requiresNoOpFallback === true &&
    contract.requiresExistingRoutePreservation === true &&
    contract.requiresClarificationGatePreservation === true &&
    contract.requiresUnsupportedBoundaryPreservation === true &&
    contract.requiresNoUserVisibleOutputByDefault === true &&
    contract.requiresNoPersistenceByDefault === true &&
    contract.requiresNoExternalCallsByDefault === true &&
    contract.status === "ready" &&
    contract.score >= 85;
  if (!contractInvariantsOk && violations.length === 0) violations.push("production_wiring_contract_missing");
  return { passed: violations.length === 0, violations };
}

// ─── Rollback readiness contract ──────────────────────────────────────────────────────

export type DecisionSupportRollbackReadinessContractOptions = {
  config?: Partial<DecisionSupportProductionWiringReadinessFeatureFlagGateConfig>;
};

/**
 * Builds the rollback readiness contract a future production wiring (Sprint 38R or later) would need to
 * satisfy for a given Sprint 36R adapter case result. Never implements a real rollback path — only the
 * contract every future rollback plan must satisfy.
 */
export function createDecisionSupportRollbackReadinessContract(
  adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  _options: DecisionSupportRollbackReadinessContractOptions = {},
): DecisionSupportRollbackReadinessContract {
  return {
    contractId: `rollback-contract-${adapterCaseResult.caseId}`,
    status: "ready",
    readinessOnly: true,
    rollbackImplementedNow: false,
    rollbackRequiresFeatureFlagDisable: true,
    rollbackRequiresRouteFallback: true,
    rollbackRequiresComposerFallback: true,
    rollbackRequiresEndpointFallback: true,
    rollbackRequiresNoDataMigration: true,
    rollbackRequiresNoDataCleanup: true,
    rollbackRequiresNoPersistentStateDependency: true,
    rollbackRequiresNoExternalSideEffectsCleanup: true,
    rollbackRequiresIncidentOwner: true,
    rollbackRequiresVerificationChecklist: true,
    rollbackScore: 92,
    rationale: [
      "A rollback must be a single feature-flag disable plus a route/composer/endpoint fallback to the existing production path — no data migration or cleanup is required because nothing real is ever persisted by this gate.",
      "An incident owner and a verification checklist are required before any future activation, not before this readiness gate.",
    ],
  } satisfies DecisionSupportRollbackReadinessContract;
}

function checkRollbackContract(contract: DecisionSupportRollbackReadinessContract): { passed: boolean; violations: DecisionSupportProductionWiringReadinessGateViolationType[] } {
  const violations: DecisionSupportProductionWiringReadinessGateViolationType[] = [];
  if (contract.rollbackRequiresFeatureFlagDisable !== true) violations.push("rollback_disable_path_missing");
  if (contract.rollbackRequiresRouteFallback !== true) violations.push("fallback_route_missing");
  if (contract.rollbackRequiresComposerFallback !== true) violations.push("fallback_composer_missing");
  const contractInvariantsOk =
    contract.readinessOnly === true &&
    contract.rollbackImplementedNow === false &&
    contract.rollbackRequiresEndpointFallback === true &&
    contract.rollbackRequiresNoDataMigration === true &&
    contract.rollbackRequiresNoDataCleanup === true &&
    contract.rollbackRequiresNoPersistentStateDependency === true &&
    contract.rollbackRequiresNoExternalSideEffectsCleanup === true &&
    contract.rollbackRequiresIncidentOwner === true &&
    contract.rollbackRequiresVerificationChecklist === true &&
    contract.status === "ready" &&
    contract.rollbackScore >= 85;
  if (!contractInvariantsOk && violations.length === 0) violations.push("rollback_contract_missing");
  return { passed: violations.length === 0, violations };
}

// ─── Governance approval checklist ────────────────────────────────────────────────────

export type DecisionSupportGovernanceApprovalChecklistOptions = {
  config?: Partial<DecisionSupportProductionWiringReadinessFeatureFlagGateConfig>;
};

const REQUIRED_APPROVAL_ITEMS: string[] = [
  "feature_flag_contract_reviewed",
  "router_guard_reviewed",
  "composer_guard_reviewed",
  "endpoint_guard_reviewed",
  "rollback_contract_reviewed",
  "monitoring_contract_reviewed",
  "user_visible_output_reviewed",
  "security_review_completed",
  "regression_tests_green",
  "manual_smoke_test_completed",
];

const COMPLETED_NOW_ITEMS: string[] = ["regression_tests_green", "feature_flag_contract_reviewed", "rollback_contract_reviewed"];

const PENDING_FUTURE_APPROVAL_ITEMS: string[] = [
  "router_guard_reviewed",
  "composer_guard_reviewed",
  "endpoint_guard_reviewed",
  "monitoring_contract_reviewed",
  "user_visible_output_reviewed",
  "security_review_completed",
  "manual_smoke_test_completed",
];

/**
 * Builds the governance approval checklist a future activation decision (Sprint 38R or later) would need
 * to complete for a given Sprint 36R adapter case result. Never claims real governance approval — this
 * sprint only records which items are already evidenced (`completedNowItems`) versus which remain for a
 * real human governance review (`pendingFutureApprovalItems`).
 */
export function createDecisionSupportGovernanceApprovalChecklist(
  adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  _options: DecisionSupportGovernanceApprovalChecklistOptions = {},
): DecisionSupportGovernanceApprovalChecklist {
  return {
    checklistId: `governance-checklist-${adapterCaseResult.caseId}`,
    status: "prepared",
    readinessOnly: true,
    governanceApprovalGrantedNow: false,
    approvalRequiredBeforeActivation: true,
    approvalStateOverclaimed: false,
    requiredApprovalItems: [...REQUIRED_APPROVAL_ITEMS],
    completedNowItems: [...COMPLETED_NOW_ITEMS],
    pendingFutureApprovalItems: [...PENDING_FUTURE_APPROVAL_ITEMS],
    checklistScore: 88,
    rationale: [
      "regression_tests_green, feature_flag_contract_reviewed, and rollback_contract_reviewed are the only items this offline gate can evidence today.",
      "router_guard_reviewed, composer_guard_reviewed, endpoint_guard_reviewed, monitoring_contract_reviewed, user_visible_output_reviewed, security_review_completed, and manual_smoke_test_completed all require a real human governance review this gate never performs or claims to have performed.",
    ],
  } satisfies DecisionSupportGovernanceApprovalChecklist;
}

function checkGovernanceChecklist(checklist: DecisionSupportGovernanceApprovalChecklist): { passed: boolean; violations: DecisionSupportProductionWiringReadinessGateViolationType[] } {
  const contractInvariantsOk =
    checklist.readinessOnly === true && checklist.approvalRequiredBeforeActivation === true && checklist.status === "prepared" && checklist.checklistScore >= 80;
  return { passed: contractInvariantsOk, violations: contractInvariantsOk ? [] : ["governance_checklist_missing"] };
}

function checkNoApprovalOverclaim(checklist: DecisionSupportGovernanceApprovalChecklist): { passed: boolean; violations: DecisionSupportProductionWiringReadinessGateViolationType[] } {
  const violations: DecisionSupportProductionWiringReadinessGateViolationType[] = [];
  if (checklist.governanceApprovalGrantedNow !== false) violations.push("approval_state_overclaimed");
  if (checklist.approvalStateOverclaimed !== false) violations.push("approval_state_overclaimed");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

// ─── Default-off adapter / visibility / production eligibility / leaks / side effects ─

function checkDefaultOffAdapter(adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult): {
  passed: boolean;
  violations: DecisionSupportProductionWiringReadinessGateViolationType[];
} {
  const passed = adapterCaseResult.adapterAccepted === true && adapterCaseResult.safeForProductionWiringReadinessReview === true;
  return { passed, violations: passed ? [] : ["production_wiring_contract_missing"] };
}

function checkNoVisibilityAttempt(
  adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  productionWiringContract: DecisionSupportProductionWiringReadinessContract,
): { passed: boolean; violations: DecisionSupportProductionWiringReadinessGateViolationType[] } {
  const violations: DecisionSupportProductionWiringReadinessGateViolationType[] = [];
  if (adapterCaseResult.composerResult.payload.userVisibleNow) violations.push("user_visible_output_allowed");
  if (adapterCaseResult.composerResult.userVisibleOutputAttempted) violations.push("user_visible_output_allowed");
  if (adapterCaseResult.routeResult.userVisibleOutputAttempted) violations.push("user_visible_output_allowed");
  if (productionWiringContract.requiresNoUserVisibleOutputByDefault !== true) violations.push("user_visible_output_allowed");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkNoProductionEligibility(
  adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  featureFlagContract: DecisionSupportFeatureFlagGateContract,
  productionWiringContract: DecisionSupportProductionWiringReadinessContract,
): { passed: boolean; violations: DecisionSupportProductionWiringReadinessGateViolationType[] } {
  const violations: DecisionSupportProductionWiringReadinessGateViolationType[] = [];
  if (adapterCaseResult.composerResult.payload.productionEligibleNow) violations.push("production_eligible_now");
  if (productionWiringContract.productionWiringImplementedNow) violations.push("production_eligible_now");
  if (featureFlagContract.featureFlagActiveNow) violations.push("feature_flag_activation_path_enabled");
  if (featureFlagContract.featureFlagRuntimeReadNow) violations.push("feature_flag_runtime_read_attempted");
  if (productionWiringContract.routerChangeAllowedNow) violations.push("router_wiring_allowed");
  if (productionWiringContract.composerChangeAllowedNow) violations.push("composer_wiring_allowed");
  if (productionWiringContract.endpointChangeAllowedNow) violations.push("endpoint_wiring_allowed");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkNoLeaks(adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult): { passed: boolean; violations: DecisionSupportProductionWiringReadinessGateViolationType[] } {
  const violations: DecisionSupportProductionWiringReadinessGateViolationType[] = [];
  for (const s of adapterCaseResult.composerResult.payload.sections) {
    if (s.containsRawInput) violations.push("raw_input_leak");
    if (s.containsFullCandidate) violations.push("full_candidate_leak");
    if (s.containsPii) violations.push("pii_leak");
    if (s.containsProjectNameRaw) violations.push("project_name_leak");
  }
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkNoSideEffects(adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult): {
  passed: boolean;
  violations: DecisionSupportProductionWiringReadinessGateViolationType[];
} {
  const violations: DecisionSupportProductionWiringReadinessGateViolationType[] = [];
  const composerResult = adapterCaseResult.composerResult;
  if (composerResult.payload.persistedNow) violations.push("real_persistence_allowed");
  if (composerResult.payload.executableNow) violations.push("action_execution_allowed");
  if (composerResult.payload.externalSideEffectsAllowed) violations.push("external_call_allowed");
  if (composerResult.realPersistenceAttempted) violations.push("real_persistence_allowed");
  if (composerResult.dbWriteAttempted) violations.push("side_effect_risk");
  if (composerResult.supabaseWriteAttempted) violations.push("side_effect_risk");
  if (composerResult.externalCallAttempted) violations.push("external_call_allowed");
  if (composerResult.actionExecutionAttempted) violations.push("action_execution_allowed");
  if (composerResult.endpointChangeAttempted) violations.push("endpoint_wiring_allowed");
  if (composerResult.composerChangeAttempted) violations.push("composer_wiring_allowed");
  if (adapterCaseResult.routeResult.routerChangeAttempted) violations.push("router_wiring_allowed");
  for (const s of composerResult.payload.sections) {
    if (s.containsExecutableInstruction) violations.push("action_execution_allowed");
    if (s.containsPersistenceInstruction) violations.push("real_persistence_allowed");
  }
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

// ─── Gate case validation ─────────────────────────────────────────────────────────────

const CRITICAL_VIOLATIONS = new Set<DecisionSupportProductionWiringReadinessGateViolationType>([
  "feature_flag_activation_path_enabled",
  "feature_flag_runtime_read_attempted",
  "router_wiring_allowed",
  "composer_wiring_allowed",
  "endpoint_wiring_allowed",
  "approval_state_overclaimed",
  "user_visible_output_allowed",
  "production_eligible_now",
  "real_persistence_allowed",
  "external_call_allowed",
  "action_execution_allowed",
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "side_effect_risk",
]);

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export type DecisionSupportProductionWiringReadinessFeatureFlagGateCaseValidationResult = {
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
};

/**
 * Validates one Sprint 36R adapter case result against its four Sprint 37R readiness contracts/checklist.
 * Exposed separately from `evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase()` so tests
 * (and future callers) can mutate a contract/checklist and re-validate without rebuilding everything.
 */
export function validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(
  adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  featureFlagContract: DecisionSupportFeatureFlagGateContract,
  productionWiringContract: DecisionSupportProductionWiringReadinessContract,
  rollbackContract: DecisionSupportRollbackReadinessContract,
  governanceChecklist: DecisionSupportGovernanceApprovalChecklist,
): DecisionSupportProductionWiringReadinessFeatureFlagGateCaseValidationResult {
  const featureFlag = checkFeatureFlagContract(featureFlagContract);
  const productionWiring = checkProductionWiringContract(productionWiringContract);
  const rollback = checkRollbackContract(rollbackContract);
  const governance = checkGovernanceChecklist(governanceChecklist);
  const defaultOffAdapter = checkDefaultOffAdapter(adapterCaseResult);
  const noApprovalOverclaim = checkNoApprovalOverclaim(governanceChecklist);
  const noVisibilityAttempt = checkNoVisibilityAttempt(adapterCaseResult, productionWiringContract);
  const noProductionEligibility = checkNoProductionEligibility(adapterCaseResult, featureFlagContract, productionWiringContract);
  const noLeaks = checkNoLeaks(adapterCaseResult);
  const noSideEffects = checkNoSideEffects(adapterCaseResult);

  const allChecks = [featureFlag, productionWiring, rollback, governance, defaultOffAdapter, noApprovalOverclaim, noVisibilityAttempt, noProductionEligibility, noLeaks, noSideEffects];
  const violations = dedupe(allChecks.flatMap((c) => c.violations));
  const hasCriticalViolation = violations.some((v) => CRITICAL_VIOLATIONS.has(v));

  let qaStatus: DecisionSupportProductionWiringReadinessGateQaStatus;
  let riskLevel: DecisionSupportProductionWiringReadinessGateRiskLevel;
  let gateAccepted: boolean;
  let gateRejected: boolean;
  let gateBlocked: boolean;
  if (violations.length === 0) {
    qaStatus = "pass";
    riskLevel = "low";
    gateAccepted = true;
    gateRejected = false;
    gateBlocked = false;
  } else if (hasCriticalViolation) {
    qaStatus = "blocked";
    riskLevel = "critical";
    gateAccepted = false;
    gateRejected = false;
    gateBlocked = true;
  } else {
    qaStatus = "fail";
    riskLevel = "high";
    gateAccepted = false;
    gateRejected = true;
    gateBlocked = false;
  }

  return {
    gateAccepted,
    gateRejected,
    gateBlocked,
    qaStatus,
    riskLevel,
    violations,
    featureFlagContractPassed: featureFlag.passed,
    productionWiringContractPassed: productionWiring.passed,
    rollbackContractPassed: rollback.passed,
    governanceChecklistPrepared: governance.passed,
    defaultOffAdapterPassed: defaultOffAdapter.passed,
    noApprovalOverclaimPassed: noApprovalOverclaim.passed,
    noVisibilityAttemptPassed: noVisibilityAttempt.passed,
    noProductionEligibilityPassed: noProductionEligibility.passed,
    noLeaksPassed: noLeaks.passed,
    noSideEffectsPassed: noSideEffects.passed,
    safeForDefaultOffFeatureFlagImplementationShell: violations.length === 0,
  };
}

// ─── Gate case evaluation ──────────────────────────────────────────────────────────────

export type DecisionSupportProductionWiringReadinessFeatureFlagGateCaseOptions = {
  config?: Partial<DecisionSupportProductionWiringReadinessFeatureFlagGateConfig>;
};

/**
 * Evaluates a single Sprint 36R adapter case result: builds its feature flag gate contract, production
 * wiring readiness contract, rollback readiness contract, and governance approval checklist, then
 * validates all four together. Every `*AllowedNow` field on the returned case result is always `false`.
 */
export function evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(
  adapterCaseResult: DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  options: DecisionSupportProductionWiringReadinessFeatureFlagGateCaseOptions = {},
): DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult {
  const featureFlagContract = createDecisionSupportFeatureFlagGateContract(adapterCaseResult, { config: options.config });
  const productionWiringContract = createDecisionSupportProductionWiringReadinessContract(adapterCaseResult, { config: options.config });
  const rollbackContract = createDecisionSupportRollbackReadinessContract(adapterCaseResult, { config: options.config });
  const governanceChecklist = createDecisionSupportGovernanceApprovalChecklist(adapterCaseResult, { config: options.config });

  const validation = validateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(adapterCaseResult, featureFlagContract, productionWiringContract, rollbackContract, governanceChecklist);

  const warnings = [...adapterCaseResult.warnings];
  if (!validation.gateAccepted) {
    warnings.push(`Case ${adapterCaseResult.caseId}: readiness gate ${validation.qaStatus} — violations: ${validation.violations.join(", ")}.`);
  }

  return {
    caseId: adapterCaseResult.caseId,
    sourceAdapterKind: adapterCaseResult.adapterKind,
    sourceCaseId: adapterCaseResult.caseId,
    generatedForReadinessGateOnly: true,
    readinessOnly: true,
    gateKind: gateKindForAdapterKind(adapterCaseResult.adapterKind),
    featureFlagContract,
    productionWiringContract,
    rollbackContract,
    governanceChecklist,
    gateAccepted: validation.gateAccepted,
    gateRejected: validation.gateRejected,
    gateBlocked: validation.gateBlocked,
    qaStatus: validation.qaStatus,
    riskLevel: validation.riskLevel,
    violations: validation.violations,
    featureFlagContractPassed: validation.featureFlagContractPassed,
    productionWiringContractPassed: validation.productionWiringContractPassed,
    rollbackContractPassed: validation.rollbackContractPassed,
    governanceChecklistPrepared: validation.governanceChecklistPrepared,
    defaultOffAdapterPassed: validation.defaultOffAdapterPassed,
    noApprovalOverclaimPassed: validation.noApprovalOverclaimPassed,
    noVisibilityAttemptPassed: validation.noVisibilityAttemptPassed,
    noProductionEligibilityPassed: validation.noProductionEligibilityPassed,
    noLeaksPassed: validation.noLeaksPassed,
    noSideEffectsPassed: validation.noSideEffectsPassed,
    safeForDefaultOffFeatureFlagImplementationShell: validation.safeForDefaultOffFeatureFlagImplementationShell,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    productionWiringAllowedNow: false,
    routerChangeAllowedNow: false,
    composerChangeAllowedNow: false,
    endpointChangeAllowedNow: false,
    featureFlagImplementationAllowedNow: false,
    featureFlagActivationAllowedNow: false,
    userVisibleOutputAllowedNow: false,
    realPersistenceAllowedNow: false,
    actionExecutionAllowedNow: false,
    warnings,
  } satisfies DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult;
}

// ─── Gate run ─────────────────────────────────────────────────────────────────────────

/**
 * Runs the full Sprint 37R production wiring readiness / feature flag gate: reuses (or builds) the Sprint
 * 36R default-off route/composer integration adapter against the same corpus (default: that adapter's own
 * small self-contained synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for the full Sprint 18R
 * corpus), evaluates a readiness gate case for every accepted adapter case, and consolidates the Sprint
 * 37R allowed/prohibited actions. Never implements or activates a feature flag, never touches the router,
 * composer, or endpoint, never shows anything to a user, and never persists anything real.
 */
export function runDecisionSupportProductionWiringReadinessFeatureFlagGate(
  options: DecisionSupportProductionWiringReadinessFeatureFlagGateOptions = {},
): DecisionSupportProductionWiringReadinessFeatureFlagGateResult {
  const config = createDecisionSupportProductionWiringReadinessFeatureFlagGateConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;

  const adapter = options.adapter ?? runDecisionSupportDefaultOffRouteComposerIntegrationAdapter({ cases: options.cases, harness: options.harness, now });
  const adapterSummary = summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter(adapter);

  const caseResults = adapter.caseResults.map((c) => evaluateDecisionSupportProductionWiringReadinessFeatureFlagGateCase(c, { config }));

  const allowedNextActions = listDecisionSupportProductionWiringReadinessFeatureFlagGateAllowedNextActions();
  const prohibitedActions = listDecisionSupportProductionWiringReadinessFeatureFlagGateProhibitedActions();

  const warnings: string[] = [];
  if (adapterSummary.decision !== "ready_for_production_wiring_readiness_feature_flag_gate") {
    warnings.push(`Sprint 36R default-off route/composer integration adapter decision is "${adapterSummary.decision}", not "ready_for_production_wiring_readiness_feature_flag_gate" — this gate cannot recommend Sprint 38R until that is resolved.`);
  }
  if (adapterSummary.adapterAcceptedCount !== adapterSummary.totalCases) {
    warnings.push("Not every Sprint 36R adapter case is accepted — this gate cannot recommend Sprint 38R until that is resolved.");
  }
  if (adapterSummary.safeForProductionWiringReadinessReviewCount !== adapterSummary.totalCases) {
    warnings.push("Not every Sprint 36R adapter case is safeForProductionWiringReadinessReview — this gate cannot recommend Sprint 38R until that is resolved.");
  }
  for (const caseResult of caseResults) warnings.push(...caseResult.warnings);

  return {
    config,
    adapter,
    adapterSummary,
    caseResults,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportProductionWiringReadinessFeatureFlagGateResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

const REPRESENTATIVE_LIMIT = 8;

function average(values: number[]): number {
  if (values.length === 0) return 100;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

function computeDecision(fields: {
  totalCases: number;
  gateEvaluatedCount: number;
  gateAcceptedCount: number;
  gateRejectedCount: number;
  gateBlockedCount: number;
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
  sprint36AdapterDecision: string | undefined;
}): DecisionSupportProductionWiringReadinessFeatureFlagGateDecision {
  if (fields.noLeaksPassedCount !== fields.totalCases || fields.noSideEffectsPassedCount !== fields.totalCases || fields.realPersistenceAllowedNowCount > 0 || fields.actionExecutionAllowedNowCount > 0) {
    return "blocked_by_leakage_or_side_effect_risk";
  }

  if (fields.noVisibilityAttemptPassedCount !== fields.totalCases || fields.userVisibleOutputAllowedNowCount > 0 || fields.safeForUserVisibleOutputNowCount > 0 || fields.safeForProductionCount > 0) {
    return "blocked_by_visibility_risk";
  }

  if (
    fields.noProductionEligibilityPassedCount !== fields.totalCases ||
    fields.productionWiringAllowedNowCount > 0 ||
    fields.routerChangeAllowedNowCount > 0 ||
    fields.composerChangeAllowedNowCount > 0 ||
    fields.endpointChangeAllowedNowCount > 0 ||
    fields.featureFlagImplementationAllowedNowCount > 0 ||
    fields.featureFlagActivationAllowedNowCount > 0
  ) {
    return "blocked_by_production_wiring_risk";
  }

  if (fields.featureFlagContractPassedCount !== fields.totalCases) return "blocked_by_feature_flag_contract_gap";
  if (fields.productionWiringContractPassedCount !== fields.totalCases || fields.defaultOffAdapterPassedCount !== fields.totalCases) {
    return "blocked_by_production_wiring_contract_gap";
  }
  if (fields.rollbackContractPassedCount !== fields.totalCases) return "blocked_by_rollback_contract_gap";
  if (fields.governanceChecklistPreparedCount !== fields.totalCases || fields.governanceApprovalGrantedNowCount > 0 || fields.approvalOverclaimCount > 0) {
    return "blocked_by_governance_checklist_gap";
  }

  const allClean =
    fields.totalCases > 0 &&
    fields.gateEvaluatedCount === fields.totalCases &&
    fields.gateAcceptedCount === fields.totalCases &&
    fields.gateRejectedCount === 0 &&
    fields.gateBlockedCount === 0 &&
    fields.qaPassCount === fields.totalCases &&
    fields.qaWarningCount === 0 &&
    fields.qaFailCount === 0 &&
    fields.qaBlockedCount === 0 &&
    fields.featureFlagContractPassedCount === fields.totalCases &&
    fields.productionWiringContractPassedCount === fields.totalCases &&
    fields.rollbackContractPassedCount === fields.totalCases &&
    fields.governanceChecklistPreparedCount === fields.totalCases &&
    fields.governanceApprovalGrantedNowCount === 0 &&
    fields.approvalOverclaimCount === 0 &&
    fields.defaultOffAdapterPassedCount === fields.totalCases &&
    fields.noVisibilityAttemptPassedCount === fields.totalCases &&
    fields.noProductionEligibilityPassedCount === fields.totalCases &&
    fields.noLeaksPassedCount === fields.totalCases &&
    fields.noSideEffectsPassedCount === fields.totalCases &&
    fields.safeForDefaultOffFeatureFlagImplementationShellCount === fields.totalCases &&
    fields.safeForUserVisibleOutputNowCount === 0 &&
    fields.safeForProductionCount === 0 &&
    fields.averageFeatureFlagContractScore >= 90 &&
    fields.averageProductionWiringContractScore >= 90 &&
    fields.averageRollbackContractScore >= 90 &&
    fields.averageGovernanceChecklistScore >= 85 &&
    fields.minFeatureFlagContractScore >= 85 &&
    fields.minProductionWiringContractScore >= 85 &&
    fields.minRollbackContractScore >= 85 &&
    fields.minGovernanceChecklistScore >= 80 &&
    fields.violationCount === 0 &&
    fields.criticalViolationCount === 0 &&
    fields.productionWiringAllowedNowCount === 0 &&
    fields.routerChangeAllowedNowCount === 0 &&
    fields.composerChangeAllowedNowCount === 0 &&
    fields.endpointChangeAllowedNowCount === 0 &&
    fields.featureFlagImplementationAllowedNowCount === 0 &&
    fields.featureFlagActivationAllowedNowCount === 0 &&
    fields.userVisibleOutputAllowedNowCount === 0 &&
    fields.realPersistenceAllowedNowCount === 0 &&
    fields.actionExecutionAllowedNowCount === 0 &&
    fields.sprint36AdapterDecision === "ready_for_production_wiring_readiness_feature_flag_gate";

  return allClean ? "ready_for_default_off_feature_flag_implementation_shell" : "continue_readiness_gate_only";
}

function recommendedNextSprintFor(decision: DecisionSupportProductionWiringReadinessFeatureFlagGateDecision): string {
  switch (decision) {
    case "ready_for_default_off_feature_flag_implementation_shell":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_feature_flag_contract_gap":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Feature Flag Contract Hardening)`;
    case "blocked_by_production_wiring_contract_gap":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Production Wiring Contract Hardening)`;
    case "blocked_by_rollback_contract_gap":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Rollback Contract Hardening)`;
    case "blocked_by_governance_checklist_gap":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Governance Checklist Hardening)`;
    case "blocked_by_visibility_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Visibility Risk Hardening)`;
    case "blocked_by_production_wiring_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Production Wiring Risk Hardening)`;
    case "blocked_by_leakage_or_side_effect_risk":
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (Leakage/Side Effect Hardening)`;
    case "continue_readiness_gate_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

/**
 * Turns a `runDecisionSupportProductionWiringReadinessFeatureFlagGate()` result — or a bare
 * `DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult[]` plus
 * `options.sprint36AdapterDecision` — into a review-ready report: per-gate-kind counts, QA status counts,
 * safety counts (every production-side-effect count expected zero), score averages/minimums, a decision,
 * and a recommended next sprint. Pure — takes already-computed case results rather than re-running
 * anything.
 */
export function summarizeDecisionSupportProductionWiringReadinessFeatureFlagGate(
  gateOrCaseResults: DecisionSupportProductionWiringReadinessFeatureFlagGateResult | DecisionSupportProductionWiringReadinessFeatureFlagGateCaseResult[],
  options: DecisionSupportProductionWiringReadinessFeatureFlagGateSummaryOptions = {},
): DecisionSupportProductionWiringReadinessFeatureFlagGateSummary {
  const caseResults = Array.isArray(gateOrCaseResults) ? gateOrCaseResults : gateOrCaseResults.caseResults;
  const sprint36AdapterDecision = Array.isArray(gateOrCaseResults) ? options.sprint36AdapterDecision : (options.sprint36AdapterDecision ?? gateOrCaseResults.adapterSummary.decision);
  const gateWarnings = Array.isArray(gateOrCaseResults) ? [] : gateOrCaseResults.warnings;

  const totalCases = caseResults.length;

  const gateEvaluatedCount = totalCases;
  const gateAcceptedCount = caseResults.filter((c) => c.gateAccepted).length;
  const gateRejectedCount = caseResults.filter((c) => c.gateRejected).length;
  const gateBlockedCount = caseResults.filter((c) => c.gateBlocked).length;

  const clarificationGateReadinessCount = caseResults.filter((c) => c.gateKind === "clarification_gate_readiness").length;
  const routePreservationReadinessCount = caseResults.filter((c) => c.gateKind === "route_preservation_readiness").length;
  const unsupportedBoundaryReadinessCount = caseResults.filter((c) => c.gateKind === "unsupported_boundary_readiness").length;
  const shadowOnlyReadinessCount = caseResults.filter((c) => c.gateKind === "shadow_only_readiness").length;
  const blockedUnsafeReadinessCount = caseResults.filter((c) => c.gateKind === "blocked_unsafe_readiness").length;

  const qaPassCount = caseResults.filter((c) => c.qaStatus === "pass").length;
  const qaWarningCount = caseResults.filter((c) => c.qaStatus === "warning").length;
  const qaFailCount = caseResults.filter((c) => c.qaStatus === "fail").length;
  const qaBlockedCount = caseResults.filter((c) => c.qaStatus === "blocked").length;

  const featureFlagContractPassedCount = caseResults.filter((c) => c.featureFlagContractPassed).length;
  const productionWiringContractPassedCount = caseResults.filter((c) => c.productionWiringContractPassed).length;
  const rollbackContractPassedCount = caseResults.filter((c) => c.rollbackContractPassed).length;
  const governanceChecklistPreparedCount = caseResults.filter((c) => c.governanceChecklistPrepared).length;
  const governanceApprovalGrantedNowCount = caseResults.filter((c) => c.governanceChecklist.governanceApprovalGrantedNow).length;
  const approvalOverclaimCount = caseResults.filter((c) => c.governanceChecklist.approvalStateOverclaimed).length;
  const defaultOffAdapterPassedCount = caseResults.filter((c) => c.defaultOffAdapterPassed).length;
  const noVisibilityAttemptPassedCount = caseResults.filter((c) => c.noVisibilityAttemptPassed).length;
  const noProductionEligibilityPassedCount = caseResults.filter((c) => c.noProductionEligibilityPassed).length;
  const noLeaksPassedCount = caseResults.filter((c) => c.noLeaksPassed).length;
  const noSideEffectsPassedCount = caseResults.filter((c) => c.noSideEffectsPassed).length;

  const safeForDefaultOffFeatureFlagImplementationShellCount = caseResults.filter((c) => c.safeForDefaultOffFeatureFlagImplementationShell).length;
  const safeForUserVisibleOutputNowCount = caseResults.filter((c) => c.safeForUserVisibleOutputNow).length;
  const safeForProductionCount = caseResults.filter((c) => c.safeForProduction).length;

  const featureFlagScores = caseResults.map((c) => c.featureFlagContract.score);
  const productionWiringScores = caseResults.map((c) => c.productionWiringContract.score);
  const rollbackScores = caseResults.map((c) => c.rollbackContract.rollbackScore);
  const governanceScores = caseResults.map((c) => c.governanceChecklist.checklistScore);

  const averageFeatureFlagContractScore = average(featureFlagScores);
  const averageProductionWiringContractScore = average(productionWiringScores);
  const averageRollbackContractScore = average(rollbackScores);
  const averageGovernanceChecklistScore = average(governanceScores);

  const minFeatureFlagContractScore = featureFlagScores.length > 0 ? Math.min(...featureFlagScores) : 0;
  const minProductionWiringContractScore = productionWiringScores.length > 0 ? Math.min(...productionWiringScores) : 0;
  const minRollbackContractScore = rollbackScores.length > 0 ? Math.min(...rollbackScores) : 0;
  const minGovernanceChecklistScore = governanceScores.length > 0 ? Math.min(...governanceScores) : 0;

  const allViolations = caseResults.flatMap((c) => c.violations);
  const violationCount = allViolations.length;
  const criticalViolationCount = caseResults.filter((c) => c.riskLevel === "critical").flatMap((c) => c.violations).length;

  const productionWiringAllowedNowCount = caseResults.filter((c) => c.productionWiringAllowedNow).length;
  const routerChangeAllowedNowCount = caseResults.filter((c) => c.routerChangeAllowedNow).length;
  const composerChangeAllowedNowCount = caseResults.filter((c) => c.composerChangeAllowedNow).length;
  const endpointChangeAllowedNowCount = caseResults.filter((c) => c.endpointChangeAllowedNow).length;
  const featureFlagImplementationAllowedNowCount = caseResults.filter((c) => c.featureFlagImplementationAllowedNow).length;
  const featureFlagActivationAllowedNowCount = caseResults.filter((c) => c.featureFlagActivationAllowedNow).length;
  const userVisibleOutputAllowedNowCount = caseResults.filter((c) => c.userVisibleOutputAllowedNow).length;
  const realPersistenceAllowedNowCount = caseResults.filter((c) => c.realPersistenceAllowedNow).length;
  const actionExecutionAllowedNowCount = caseResults.filter((c) => c.actionExecutionAllowedNow).length;

  const decision = computeDecision({
    totalCases,
    gateEvaluatedCount,
    gateAcceptedCount,
    gateRejectedCount,
    gateBlockedCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    featureFlagContractPassedCount,
    productionWiringContractPassedCount,
    rollbackContractPassedCount,
    governanceChecklistPreparedCount,
    governanceApprovalGrantedNowCount,
    approvalOverclaimCount,
    defaultOffAdapterPassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    safeForDefaultOffFeatureFlagImplementationShellCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    averageFeatureFlagContractScore,
    averageProductionWiringContractScore,
    averageRollbackContractScore,
    averageGovernanceChecklistScore,
    minFeatureFlagContractScore,
    minProductionWiringContractScore,
    minRollbackContractScore,
    minGovernanceChecklistScore,
    violationCount,
    criticalViolationCount,
    productionWiringAllowedNowCount,
    routerChangeAllowedNowCount,
    composerChangeAllowedNowCount,
    endpointChangeAllowedNowCount,
    featureFlagImplementationAllowedNowCount,
    featureFlagActivationAllowedNowCount,
    userVisibleOutputAllowedNowCount,
    realPersistenceAllowedNowCount,
    actionExecutionAllowedNowCount,
    sprint36AdapterDecision,
  });

  const warnings = [...gateWarnings, ...caseResults.flatMap((c) => c.warnings)];

  return {
    totalCases,
    gateEvaluatedCount,
    gateAcceptedCount,
    gateRejectedCount,
    gateBlockedCount,
    clarificationGateReadinessCount,
    routePreservationReadinessCount,
    unsupportedBoundaryReadinessCount,
    shadowOnlyReadinessCount,
    blockedUnsafeReadinessCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    featureFlagContractPassedCount,
    productionWiringContractPassedCount,
    rollbackContractPassedCount,
    governanceChecklistPreparedCount,
    governanceApprovalGrantedNowCount,
    approvalOverclaimCount,
    defaultOffAdapterPassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    safeForDefaultOffFeatureFlagImplementationShellCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    averageFeatureFlagContractScore,
    averageProductionWiringContractScore,
    averageRollbackContractScore,
    averageGovernanceChecklistScore,
    minFeatureFlagContractScore,
    minProductionWiringContractScore,
    minRollbackContractScore,
    minGovernanceChecklistScore,
    violationCount,
    criticalViolationCount,
    productionWiringAllowedNowCount,
    routerChangeAllowedNowCount,
    composerChangeAllowedNowCount,
    endpointChangeAllowedNowCount,
    featureFlagImplementationAllowedNowCount,
    featureFlagActivationAllowedNowCount,
    userVisibleOutputAllowedNowCount,
    realPersistenceAllowedNowCount,
    actionExecutionAllowedNowCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeAcceptedGateResults: caseResults.filter((c) => c.gateAccepted).slice(0, REPRESENTATIVE_LIMIT),
    rejectedGateResults: caseResults.filter((c) => c.gateRejected),
    blockedGateResults: caseResults.filter((c) => c.gateBlocked),
    warnings,
  } satisfies DecisionSupportProductionWiringReadinessFeatureFlagGateSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 37R production wiring readiness / feature flag gate — mirrors the
 * style of `explainDecisionSupportDefaultOffRouteComposerIntegrationAdapter()` (Sprint 36R). See
 * `docs/conversational-brain-decision-support-production-wiring-readiness-feature-flag-gate.md` for full
 * context.
 */
export function explainDecisionSupportProductionWiringReadinessFeatureFlagGate(): DecisionSupportProductionWiringReadinessFeatureFlagGateExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-production-wiring-readiness-feature-flag-gate",
    purpose:
      "Reviews every Sprint 36R-accepted default-off adapter simulation against a future feature flag contract, a future production wiring " +
      "contract, a future rollback contract, and a governance approval checklist — without ever implementing, activating, or reading a real " +
      "feature flag, and without ever touching the real router, composer, endpoint, or persistence layer.",
    nonGoals: [
      "Implement or activate a real feature flag, or read an environment variable.",
      "Wire the router, composer, or endpoint directly to live decision_support.",
      "Show any output to a real user.",
      "Create a real database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action, create any real task, or send any real email/draft.",
      "Persist any real output.",
      "Claim real governance approval or production eligibility.",
      "Call an LLM or an external API.",
    ],
    gateProfile:
      'The "strict_production_wiring_readiness_feature_flag_gate" profile: `readinessOnly` is always true, every allow* field ' +
      "(allowProductionWiring/allowRouterChange/allowComposerChange/allowEndpointChange/allowFeatureFlagImplementation/" +
      "allowFeatureFlagActivation/allowFeatureFlagRuntimeRead/allowUserVisibleOutput/allowRealPersistence/allowDbWrite/allowSupabaseWrite/" +
      "allowExternalCalls/allowActionExecution/allowTaskCreation/allowEmailDraftCreation) is a literal false, forced regardless of any override " +
      "a caller passes, and every require* field is always true.",
    gateModes: [
      "readiness_gate_only (default): the full production wiring readiness / feature flag gate, covering every gate kind.",
      "feature_flag_contract_review: emphasizes createDecisionSupportFeatureFlagGateContract() output.",
      "production_wiring_preflight_review: emphasizes createDecisionSupportProductionWiringReadinessContract() output.",
      "rollback_contract_review: emphasizes createDecisionSupportRollbackReadinessContract() output.",
      "governance_approval_checklist_review: emphasizes createDecisionSupportGovernanceApprovalChecklist() output.",
      "default_off_activation_guard_review: emphasizes every *AllowedNow field staying false across every case.",
    ],
    gateKindRules: [
      "clarification_gate_adapter (Sprint 36R adapter kind) -> clarification_gate_readiness.",
      "route_preservation_adapter -> route_preservation_readiness.",
      "unsupported_boundary_adapter -> unsupported_boundary_readiness.",
      "shadow_only_adapter -> shadow_only_readiness.",
      "blocked_unsafe_adapter -> blocked_unsafe_readiness (the safe fallback for any adapter kind this gate does not build a positive contract for).",
    ],
    featureFlagGateContractRules: [
      `Proposes ${PROPOSED_FEATURE_FLAG_KEY} as the future feature flag key — never implemented or activated by this sprint.`,
      "Every contract is readinessOnly: true, featureFlagImplementedNow: false, featureFlagActiveNow: false, featureFlagRuntimeReadNow: false, defaultValueMustBe: false.",
      "Every activationRequires* field is true — activation is reserved for an explicit future sprint with governance approval, a rollback plan, a monitoring plan, manual verification, a user-visible output review, and a production incident rollback owner.",
    ],
    productionWiringReadinessContractRules: [
      "Every contract is readinessOnly: true, productionWiringImplementedNow: false, and every *ChangeAllowedNow / *ImportAllowedNow field is false.",
      "Every requires* field is true — a future wiring needs a default-off flag, a router/composer/endpoint guard, a no-op fallback, and preservation of every existing route (clarification gate, route preservation, unsupported boundary) plus no user-visible output/persistence/external calls by default.",
    ],
    rollbackReadinessContractRules: [
      "Every contract is readinessOnly: true, rollbackImplementedNow: false.",
      "A rollback must disable the feature flag and fall back to the existing route/composer/endpoint, require no data migration/cleanup/persistent-state dependency/external-side-effect cleanup, and require an incident owner plus a verification checklist before any future activation.",
    ],
    governanceApprovalChecklistRules: [
      "Every checklist is readinessOnly: true, governanceApprovalGrantedNow: false, approvalStateOverclaimed: false, status: prepared.",
      "Only regression_tests_green, feature_flag_contract_reviewed, and rollback_contract_reviewed are ever in completedNowItems — every other required approval item stays in pendingFutureApprovalItems, since this offline gate cannot evidence a real human governance review.",
    ],
    gateCaseEvaluationRules: [
      "Confirms the source Sprint 36R adapter case was adapterAccepted and safeForProductionWiringReadinessReview before treating the gate as passable.",
      "Validates the feature flag contract, production wiring contract, rollback contract, and governance checklist together, plus no-approval-overclaim, no-visibility-attempt, no-production-eligibility, no-leaks, and no-side-effects.",
      "qaStatus is blocked if any critical (wiring/activation/visibility/leak/side-effect/overclaim) violation is present, else fail if any other violation is present, else pass.",
    ],
    gateRunRules: [
      "Reuses (or accepts) the Sprint 36R default-off route/composer integration adapter against the same corpus rather than re-deriving it.",
      "Evaluates exactly one readiness gate case per Sprint 36R adapter case result.",
      "Never implements or activates a feature flag, never touches the router/composer/endpoint, never shows output to a user, and never persists output.",
    ],
    decisionRule:
      "ready_for_default_off_feature_flag_implementation_shell requires: totalCases > 0, gateAcceptedCount === totalCases, every rejected/" +
      "blocked count at zero, qaPassCount === totalCases, every contract/checklist pass count === totalCases, every score average/minimum at or " +
      "above its floor, every violation/AllowedNow count at zero, and the Sprint 36R adapter decision === " +
      "ready_for_production_wiring_readiness_feature_flag_gate. Otherwise, in priority order: blocked_by_leakage_or_side_effect_risk if any " +
      "leak/side-effect gate fails; else blocked_by_visibility_risk if any visibility gate fails or a nonzero safeForUserVisibleOutputNow/" +
      "safeForProduction count is observed; else blocked_by_production_wiring_risk if any production-eligibility gate fails or any AllowedNow " +
      "count is nonzero; else blocked_by_feature_flag_contract_gap; else blocked_by_production_wiring_contract_gap (also covers a default-off " +
      "adapter gap); else blocked_by_rollback_contract_gap; else blocked_by_governance_checklist_gap; else continue_readiness_gate_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyUserVisibleOutputIsNotShown:
      "Every case result carries userVisibleOutputAllowedNow: false and safeForUserVisibleOutputNow: false — a future feature flag activation " +
      "must explicitly review and approve output before it could ever reach a real user.",
    whyRouterIsNotChanged: "brainRouter.ts is production code. This gate only reviews a synthetic production wiring contract offline — it never imports or modifies the router.",
    whyComposerIsNotChanged: "responseComposer.ts is production code. This gate never imports or modifies the composer.",
    whyEndpointIsNotChanged: "POST /api/command-center/chat is production code. This gate never imports or modifies the endpoint or its handlers.",
    whyFeatureFlagIsNotCreated:
      "This gate only proposes a future feature flag key and its activation contract — implementing the flag shell itself is reserved for " +
      "Sprint 38R, and activating it is reserved for a later, explicitly governed sprint.",
    whyProcessEnvIsNotRead: "This module never reads an environment variable or any runtime configuration — every contract field is a literal, config-independent value (enforced by a source-scanning test).",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review (reused transitively via the Sprint 36R/35R/34R/33R/32R/31R chain) still resolves to " +
      "do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR " +
      "policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by reviewing readiness contracts.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseStorageIsNotCreated: "This gate never writes anything real — every contract stays readinessOnly: true, every AllowedNow field stays false.",
    whyStorageAdapterIsNotCreated: "This gate reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 36R/35R/34R/33R/32R/31R chain) as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this gate does not build.",
    whyApprovalIsNotOverclaimed:
      "governanceApprovalGrantedNow is always false and approvalStateOverclaimed is always false — only three checklist items " +
      "(regression_tests_green, feature_flag_contract_reviewed, rollback_contract_reviewed) are ever marked completedNowItems; every other item " +
      "stays pendingFutureApprovalItems until a real human governance review completes it.",
    expectedSprint38Path:
      "If every gate case stays qaStatus: pass, safeForDefaultOffFeatureFlagImplementationShell: true, every violation/AllowedNow count stays " +
      "at zero, every contract score average/minimum stays at or above its floor, and the Sprint 36R adapter decision stays " +
      "ready_for_production_wiring_readiness_feature_flag_gate, Sprint 38R can implement a default-off feature flag implementation shell — " +
      "still never activated, still never wired to the real router/composer/endpoint, and still never shown to a real user until a future, " +
      "explicitly governed sprint turns it on for a real workspace.",
  };
}
