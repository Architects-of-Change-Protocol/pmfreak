/**
 * Sprint 36R — Decision Support Default-Off Route/Composer Integration Adapter.
 *
 * A pure, offline, deterministic, **default-off** adapter — not a real route or composer wiring — that
 * connects every Sprint 35R-validated preview to a synthetic route guard contract and a synthetic
 * composer guard contract, simulating how a future route/composer wiring would behave without ever
 * touching the real router, composer, endpoint, feature flag, or persistence layer.
 *
 * Reuses, rather than reimplements: the Sprint 35R user-visible dry run evaluation harness
 * (`runDecisionSupportUserVisibleDryRunEvaluationHarness`, `summarizeDecisionSupportUserVisibleDryRunEvaluationHarness`),
 * which in turn reuses the Sprint 34R response draft quality evaluation, the Sprint 33R response draft
 * harness, the Sprint 32R response QA / user-visible dry run plan, the Sprint 31R clarification-gated
 * integration plan, the Sprint 30R controlled shadow replay evaluation, the Sprint 29R persistence
 * readiness review, the Sprint 25R-28R layer evaluations, and the Sprint 22R clarification response
 * evaluation.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. It never shows any decision-support output to a user, and it never persists any real output.
 * Every route guard contract, composer guard contract, and composer payload this module produces is
 * synthetic and default-off: `defaultOff: true`, `adapterEnabledNow: false`, `isolatedNoOpAdapter: true`,
 * `routeWiringActiveNow: false`, `composerWiringActiveNow: false`, `userVisibleNow: false`,
 * `persistedNow: false`, `executableNow: false`, `externalSideEffectsAllowed: false`,
 * `productionEligibleNow: false` always. See
 * `docs/conversational-brain-decision-support-default-off-route-composer-integration-adapter.md` for the
 * full design writeup.
 */

import { runDecisionSupportUserVisibleDryRunEvaluationHarness, summarizeDecisionSupportUserVisibleDryRunEvaluationHarness } from "./decisionSupportUserVisibleDryRunEvaluationHarness";

import type {
  DecisionSupportDefaultOffAdapterKind,
  DecisionSupportDefaultOffAdapterQaStatus,
  DecisionSupportDefaultOffAdapterRiskLevel,
  DecisionSupportDefaultOffAdapterStatus,
  DecisionSupportDefaultOffAdapterViolationType,
  DecisionSupportDefaultOffComposerAdapterResult,
  DecisionSupportDefaultOffComposerDecision,
  DecisionSupportDefaultOffComposerGuardContract,
  DecisionSupportDefaultOffComposerPayload,
  DecisionSupportDefaultOffComposerPayloadSection,
  DecisionSupportDefaultOffRouteAdapterResult,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterDecision,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterExplain,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterOptions,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummary,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummaryOptions,
  DecisionSupportDefaultOffRouteComposerAdapterValidationResult,
  DecisionSupportDefaultOffRouteDecision,
  DecisionSupportDefaultOffRouteGuardContract,
  DecisionSupportUserVisibleDryRunEvaluationCaseResult,
} from "./decisionSupportDefaultOffRouteComposerIntegrationAdapterTypes";

export type {
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterProfile,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterMode,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterDecision,
  DecisionSupportDefaultOffAdapterKind,
  DecisionSupportDefaultOffRouteDecision,
  DecisionSupportDefaultOffComposerDecision,
  DecisionSupportDefaultOffAdapterStatus,
  DecisionSupportDefaultOffAdapterQaStatus,
  DecisionSupportDefaultOffAdapterRiskLevel,
  DecisionSupportDefaultOffAdapterViolationType,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig,
  DecisionSupportDefaultOffRouteGuardContract,
  DecisionSupportDefaultOffComposerGuardContract,
  DecisionSupportDefaultOffComposerPayloadSection,
  DecisionSupportDefaultOffComposerPayload,
  DecisionSupportDefaultOffRouteAdapterResult,
  DecisionSupportDefaultOffComposerAdapterResult,
  DecisionSupportDefaultOffRouteComposerAdapterValidationResult,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterOptions,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummaryOptions,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummary,
  DecisionSupportDefaultOffRouteComposerIntegrationAdapterExplain,
} from "./decisionSupportDefaultOffRouteComposerIntegrationAdapterTypes";

export const DECISION_SUPPORT_DEFAULT_OFF_ROUTE_COMPOSER_INTEGRATION_ADAPTER_VERSION = "36R.1.0";

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 37R — Production Wiring Readiness / Feature Flag Gate";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 36R — Default-Off Route/Composer Integration Adapter";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_default_off_route_composer_integration_adapter"` default config. Every
 * `allow*`/`adapterEnabledNow` real-side-effect field is always `false`, forced regardless of any
 * override a caller passes — mirroring how every prior sprint's config never actually loosens its own
 * `allow*` real-side-effect flags from an override. Every `require*` field is always `true`.
 */
export function createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig(
  overrides: Partial<DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig> = {},
): DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig {
  const config: DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig = {
    profile: "strict_default_off_route_composer_integration_adapter",
    mode: overrides.mode ?? "default_off_adapter_only",
    defaultOff: true,
    // These fourteen are never actually loosened here, regardless of what a caller's override object
    // claims — this is the default-off route/composer integration adapter's own strict, non-negotiable
    // invariant.
    adapterEnabledNow: false,
    allowProductionWiring: false,
    allowRouterChange: false,
    allowComposerChange: false,
    allowEndpointChange: false,
    allowFeatureFlagImplementation: false,
    allowFeatureFlagActivation: false,
    allowUserVisibleOutput: false,
    allowRealPersistence: false,
    allowDbWrite: false,
    allowSupabaseWrite: false,
    allowExternalCalls: false,
    allowActionExecution: false,
    allowTaskCreation: false,
    allowEmailDraftCreation: false,
    requireDryRunHarnessPass: true,
    requireDefaultOff: true,
    requireNoOpIsolation: true,
    requireRouteGuardContract: true,
    requireComposerGuardContract: true,
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
  "Run a production wiring readiness review (Sprint 37R).",
  "Design a default-off feature flag gate contract.",
  "Write a route guard implementation plan.",
  "Write a composer guard implementation plan.",
  "Run an endpoint safety gate review.",
  "Run a rollback readiness review.",
  "Complete a governance approval checklist.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Wire router to live decision_support.",
  "Wire composer to live decision_support.",
  "Wire endpoint to live decision_support.",
  "Implement production feature flag.",
  "Activate production feature flag.",
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
export function listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Adapter kind mapping ─────────────────────────────────────────────────────────────

function adapterKindForPreviewKind(previewKind: string): DecisionSupportDefaultOffAdapterKind {
  switch (previewKind) {
    case "clarification_first_preview":
      return "clarification_gate_adapter";
    case "route_preservation_preview":
      return "route_preservation_adapter";
    case "unsupported_boundary_preview":
      return "unsupported_boundary_adapter";
    case "shadow_only_internal_preview":
      return "shadow_only_adapter";
    case "blocked_unsafe_preview":
    default:
      return "blocked_unsafe_adapter";
  }
}

// ─── Route guard contract ─────────────────────────────────────────────────────────────

type RouteGuardTemplate = {
  routeDecision: DecisionSupportDefaultOffRouteDecision;
  requiresClarificationGate: boolean;
  preservesExistingRoute: boolean;
  preservesUnsupportedBoundary: boolean;
  keepsShadowOnly: boolean;
  blocksUnsafe: boolean;
  routeGuardScore: number;
  rationale: string[];
};

const ROUTE_GUARD_TEMPLATES: Record<DecisionSupportDefaultOffAdapterKind, RouteGuardTemplate> = {
  clarification_gate_adapter: {
    routeDecision: "simulate_route_to_clarification_gate",
    requiresClarificationGate: true,
    preservesExistingRoute: false,
    preservesUnsupportedBoundary: false,
    keepsShadowOnly: false,
    blocksUnsafe: false,
    routeGuardScore: 95,
    rationale: ["A clarification_gate_adapter simulates routing to the clarification gate before any decision_support output — it never simulates a direct decision."],
  },
  route_preservation_adapter: {
    routeDecision: "simulate_preserve_existing_route",
    requiresClarificationGate: false,
    preservesExistingRoute: true,
    preservesUnsupportedBoundary: false,
    keepsShadowOnly: false,
    blocksUnsafe: false,
    routeGuardScore: 92,
    rationale: ["A route_preservation_adapter simulates preserving the existing production route rather than simulating a decision_support answer."],
  },
  unsupported_boundary_adapter: {
    routeDecision: "simulate_preserve_unsupported",
    requiresClarificationGate: false,
    preservesExistingRoute: false,
    preservesUnsupportedBoundary: true,
    keepsShadowOnly: false,
    blocksUnsafe: false,
    routeGuardScore: 90,
    rationale: ["An unsupported_boundary_adapter simulates preserving the existing safe fallback rather than simulating a decision_support answer."],
  },
  shadow_only_adapter: {
    routeDecision: "simulate_shadow_only",
    requiresClarificationGate: false,
    preservesExistingRoute: false,
    preservesUnsupportedBoundary: false,
    keepsShadowOnly: true,
    blocksUnsafe: false,
    routeGuardScore: 88,
    rationale: ["A shadow_only_adapter simulates keeping the case internal — it never simulates a user-visible route of any shape."],
  },
  blocked_unsafe_adapter: {
    routeDecision: "simulate_block_unsafe",
    requiresClarificationGate: false,
    preservesExistingRoute: false,
    preservesUnsupportedBoundary: false,
    keepsShadowOnly: false,
    blocksUnsafe: true,
    routeGuardScore: 85,
    rationale: ["A blocked_unsafe_adapter simulates blocking the case behind the generic safe fallback route."],
  },
};

export type DecisionSupportDefaultOffRouteGuardContractOptions = {
  config?: Partial<DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig>;
};

/**
 * Builds the route guard contract a future route wiring would need to satisfy for a given Sprint 35R
 * dry-run case result's preview kind. Every contract is `defaultOff: true`, `isolatedNoOpAdapter: true`,
 * `routeWiringActiveNow: false`, `productionRouteChangeAllowedNow: false`, `blocksDirectDecision: true`,
 * `blocksUserVisibleOutput: true`, `blocksProductionEligibility: true`.
 */
export function createDecisionSupportDefaultOffRouteGuardContract(
  dryRunCaseResult: DecisionSupportUserVisibleDryRunEvaluationCaseResult,
  _options: DecisionSupportDefaultOffRouteGuardContractOptions = {},
): DecisionSupportDefaultOffRouteGuardContract {
  const previewKind = dryRunCaseResult.preview.previewKind;
  const adapterKind = adapterKindForPreviewKind(previewKind);
  const template = ROUTE_GUARD_TEMPLATES[adapterKind];

  return {
    contractId: `route-contract-${adapterKind}`,
    adapterKind,
    sourcePreviewKind: previewKind,
    routeDecision: template.routeDecision,
    defaultOff: true,
    isolatedNoOpAdapter: true,
    routeWiringActiveNow: false,
    productionRouteChangeAllowedNow: false,
    requiresClarificationGate: template.requiresClarificationGate,
    preservesExistingRoute: template.preservesExistingRoute,
    preservesUnsupportedBoundary: template.preservesUnsupportedBoundary,
    keepsShadowOnly: template.keepsShadowOnly,
    blocksUnsafe: template.blocksUnsafe,
    blocksDirectDecision: true,
    blocksUserVisibleOutput: true,
    blocksProductionEligibility: true,
    routeGuardScore: template.routeGuardScore,
    rationale: [...template.rationale],
  } satisfies DecisionSupportDefaultOffRouteGuardContract;
}

function routeGuardPassed(contract: DecisionSupportDefaultOffRouteGuardContract): boolean {
  return (
    contract.defaultOff === true &&
    contract.isolatedNoOpAdapter === true &&
    contract.routeWiringActiveNow === false &&
    contract.productionRouteChangeAllowedNow === false &&
    contract.blocksUserVisibleOutput === true &&
    contract.blocksProductionEligibility === true &&
    contract.routeGuardScore >= 85
  );
}

// ─── Route adapter simulation ─────────────────────────────────────────────────────────

export type DecisionSupportDefaultOffRouteAdapterSimulationOptions = {
  config?: Partial<DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig>;
};

/**
 * Simulates a route adapter for a single Sprint 35R dry-run case result: builds the route guard
 * contract, determines the adapter kind and route decision, and confirms
 * `defaultOffPassed`/`isolatedNoOpPassed`/`routeGuardPassed`/`safeForComposerAdapterSimulation`. Always
 * `routeWiringActiveNow: false`, `routerChangeAttempted: false`, `productionWiringAttempted: false`,
 * `userVisibleOutputAttempted: false` — this function never attempts a real route change.
 */
export function simulateDecisionSupportDefaultOffRouteAdapter(
  dryRunCaseResult: DecisionSupportUserVisibleDryRunEvaluationCaseResult,
  options: DecisionSupportDefaultOffRouteAdapterSimulationOptions = {},
): DecisionSupportDefaultOffRouteAdapterResult {
  const config = createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig(options.config);
  const routeGuardContract = createDecisionSupportDefaultOffRouteGuardContract(dryRunCaseResult, { config: options.config });

  const guardPassed = routeGuardPassed(routeGuardContract);
  const defaultOffPassed = config.defaultOff === true && config.adapterEnabledNow === false && routeGuardContract.defaultOff === true && routeGuardContract.routeWiringActiveNow === false;
  const isolatedNoOpPassed = routeGuardContract.isolatedNoOpAdapter === true;
  const safeForComposerAdapterSimulation = guardPassed && defaultOffPassed && isolatedNoOpPassed;

  const warnings: string[] = [];
  if (!guardPassed) warnings.push(`Case ${dryRunCaseResult.caseId}: route guard contract failed for adapter kind ${routeGuardContract.adapterKind}.`);

  return {
    caseId: dryRunCaseResult.caseId,
    sourcePreviewId: dryRunCaseResult.preview.previewId,
    sourcePreviewKind: dryRunCaseResult.preview.previewKind,
    adapterKind: routeGuardContract.adapterKind,
    routeDecision: routeGuardContract.routeDecision,
    routeGuardContract,
    routeGuardPassed: guardPassed,
    defaultOffPassed,
    isolatedNoOpPassed,
    safeForComposerAdapterSimulation,
    routeWiringActiveNow: false,
    routerChangeAttempted: false,
    productionWiringAttempted: false,
    userVisibleOutputAttempted: false,
    warnings,
  } satisfies DecisionSupportDefaultOffRouteAdapterResult;
}

// ─── Composer guard contract ──────────────────────────────────────────────────────────

type ComposerGuardTemplate = {
  composerDecision: DecisionSupportDefaultOffComposerDecision;
  composerGuardScore: number;
  rationale: string[];
};

const COMPOSER_GUARD_TEMPLATES: Record<DecisionSupportDefaultOffAdapterKind, ComposerGuardTemplate> = {
  clarification_gate_adapter: {
    composerDecision: "simulate_composer_internal_preview_payload",
    composerGuardScore: 95,
    rationale: ["A clarification_gate_adapter simulates an internal-only composer payload carrying a clarifying question, never a direct decision."],
  },
  route_preservation_adapter: {
    composerDecision: "simulate_composer_route_preservation_payload",
    composerGuardScore: 92,
    rationale: ["A route_preservation_adapter simulates an internal-only composer payload that preserves the existing production route."],
  },
  unsupported_boundary_adapter: {
    composerDecision: "simulate_composer_unsupported_boundary_payload",
    composerGuardScore: 90,
    rationale: ["An unsupported_boundary_adapter simulates an internal-only composer payload that preserves the existing safe fallback."],
  },
  shadow_only_adapter: {
    composerDecision: "simulate_composer_shadow_only_payload",
    composerGuardScore: 88,
    rationale: ["A shadow_only_adapter simulates an internal-only composer payload that never leaves the shadow boundary."],
  },
  blocked_unsafe_adapter: {
    composerDecision: "simulate_composer_blocked_payload",
    composerGuardScore: 85,
    rationale: ["A blocked_unsafe_adapter simulates an internal-only composer payload carrying only the generic safe fallback."],
  },
};

export type DecisionSupportDefaultOffComposerGuardContractOptions = {
  config?: Partial<DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig>;
};

/**
 * Builds the composer guard contract a future composer wiring would need to satisfy for a given adapter
 * kind (from `simulateDecisionSupportDefaultOffRouteAdapter()`, or derived directly from the dry-run case
 * result's preview kind when `routeResult` is omitted). Every contract is `defaultOff: true`,
 * `isolatedNoOpAdapter: true`, `composerWiringActiveNow: false`, `productionComposerChangeAllowedNow:
 * false`, `internalPayloadOnly: true`, `userVisibleNow: false`, `persistedNow: false`, `executableNow:
 * false`, `blocksDirectDecision: true`, `blocksExecution: true`, `blocksPersistence: true`,
 * `blocksExternalCalls: true`, `blocksProductionEligibility: true`.
 */
export function createDecisionSupportDefaultOffComposerGuardContract(
  dryRunCaseResult: DecisionSupportUserVisibleDryRunEvaluationCaseResult,
  routeResult?: DecisionSupportDefaultOffRouteAdapterResult,
  _options: DecisionSupportDefaultOffComposerGuardContractOptions = {},
): DecisionSupportDefaultOffComposerGuardContract {
  const previewKind = dryRunCaseResult.preview.previewKind;
  const adapterKind = routeResult?.adapterKind ?? adapterKindForPreviewKind(previewKind);
  const template = COMPOSER_GUARD_TEMPLATES[adapterKind];

  return {
    contractId: `composer-contract-${adapterKind}`,
    adapterKind,
    sourcePreviewKind: previewKind,
    composerDecision: template.composerDecision,
    defaultOff: true,
    isolatedNoOpAdapter: true,
    composerWiringActiveNow: false,
    productionComposerChangeAllowedNow: false,
    internalPayloadOnly: true,
    userVisibleNow: false,
    persistedNow: false,
    executableNow: false,
    blocksDirectDecision: true,
    blocksExecution: true,
    blocksPersistence: true,
    blocksExternalCalls: true,
    blocksProductionEligibility: true,
    composerGuardScore: template.composerGuardScore,
    rationale: [...template.rationale],
  } satisfies DecisionSupportDefaultOffComposerGuardContract;
}

function composerGuardPassed(contract: DecisionSupportDefaultOffComposerGuardContract): boolean {
  return (
    contract.defaultOff === true &&
    contract.isolatedNoOpAdapter === true &&
    contract.composerWiringActiveNow === false &&
    contract.productionComposerChangeAllowedNow === false &&
    contract.internalPayloadOnly === true &&
    contract.userVisibleNow === false &&
    contract.persistedNow === false &&
    contract.executableNow === false &&
    contract.composerGuardScore >= 85
  );
}

// ─── Composer payload ─────────────────────────────────────────────────────────────────

function payloadSectionFromDisplaySection(section: DecisionSupportUserVisibleDryRunEvaluationCaseResult["preview"]["displaySections"][number]): DecisionSupportDefaultOffComposerPayloadSection {
  return {
    sectionId: section.sectionId,
    kind: section.kind,
    title: section.title,
    body: section.body,
    order: section.order,
    internalOnly: true,
    userVisibleNow: false,
    containsRawInput: false,
    containsFullCandidate: false,
    containsPii: false,
    containsProjectNameRaw: false,
    containsExecutableInstruction: false,
    containsPersistenceInstruction: false,
    warnings: [...section.warnings],
  } satisfies DecisionSupportDefaultOffComposerPayloadSection;
}

function buildComposerPayload(
  dryRunCaseResult: DecisionSupportUserVisibleDryRunEvaluationCaseResult,
  composerGuardContract: DecisionSupportDefaultOffComposerGuardContract,
): DecisionSupportDefaultOffComposerPayload {
  const sections = dryRunCaseResult.preview.displaySections.map((section) => payloadSectionFromDisplaySection(section));
  const warnings: string[] = [];
  for (const section of sections) {
    if (section.containsRawInput || section.containsFullCandidate || section.containsPii || section.containsProjectNameRaw) {
      warnings.push(`Section ${section.sectionId} carries a leak flag — this payload cannot be safe for the default-off adapter.`);
    }
    if (section.containsExecutableInstruction || section.containsPersistenceInstruction) {
      warnings.push(`Section ${section.sectionId} carries a side-effect flag — this payload cannot be safe for the default-off adapter.`);
    }
  }

  return {
    payloadId: `payload-${dryRunCaseResult.preview.previewId}`,
    sourceCaseId: dryRunCaseResult.caseId,
    sourcePreviewId: dryRunCaseResult.preview.previewId,
    adapterKind: composerGuardContract.adapterKind,
    composerDecision: composerGuardContract.composerDecision,
    generatedForAdapterEvaluationOnly: true,
    internalPayloadOnly: true,
    defaultOff: true,
    adapterEnabledNow: false,
    userVisibleNow: false,
    persistedNow: false,
    executableNow: false,
    externalSideEffectsAllowed: false,
    productionEligibleNow: false,
    sections,
    warnings,
  } satisfies DecisionSupportDefaultOffComposerPayload;
}

// ─── Composer adapter simulation ──────────────────────────────────────────────────────

export type DecisionSupportDefaultOffComposerAdapterSimulationOptions = {
  config?: Partial<DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig>;
};

/**
 * Simulates a composer adapter for a single Sprint 35R dry-run case result plus its
 * `simulateDecisionSupportDefaultOffRouteAdapter()` route result: builds the composer guard contract,
 * builds an internal-only payload from the preview's display sections, and confirms
 * `defaultOffPassed`/`isolatedNoOpPassed`/`composerGuardPassed`/`safeForDefaultOffAdapter`. Always
 * `composerWiringActiveNow: false`, `composerChangeAttempted: false`, `endpointChangeAttempted: false`,
 * `featureFlagAttempted: false`, `userVisibleOutputAttempted: false`, `realPersistenceAttempted: false`,
 * `dbWriteAttempted: false`, `supabaseWriteAttempted: false`, `externalCallAttempted: false`,
 * `actionExecutionAttempted: false` — this function never attempts a real composer change or side effect.
 */
export function simulateDecisionSupportDefaultOffComposerAdapter(
  dryRunCaseResult: DecisionSupportUserVisibleDryRunEvaluationCaseResult,
  routeResult: DecisionSupportDefaultOffRouteAdapterResult,
  options: DecisionSupportDefaultOffComposerAdapterSimulationOptions = {},
): DecisionSupportDefaultOffComposerAdapterResult {
  const config = createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig(options.config);
  const composerGuardContract = createDecisionSupportDefaultOffComposerGuardContract(dryRunCaseResult, routeResult, { config: options.config });
  const payload = buildComposerPayload(dryRunCaseResult, composerGuardContract);

  const guardPassed = composerGuardPassed(composerGuardContract) && payload.warnings.length === 0;
  const defaultOffPassed =
    config.defaultOff === true &&
    config.adapterEnabledNow === false &&
    composerGuardContract.defaultOff === true &&
    composerGuardContract.composerWiringActiveNow === false &&
    payload.defaultOff === true &&
    payload.adapterEnabledNow === false;
  const isolatedNoOpPassed = composerGuardContract.isolatedNoOpAdapter === true;
  const safeForDefaultOffAdapter = guardPassed && defaultOffPassed && isolatedNoOpPassed;

  const warnings = [...payload.warnings];
  if (!guardPassed) warnings.push(`Case ${dryRunCaseResult.caseId}: composer guard contract failed for adapter kind ${composerGuardContract.adapterKind}.`);

  return {
    caseId: dryRunCaseResult.caseId,
    sourcePreviewId: dryRunCaseResult.preview.previewId,
    adapterKind: composerGuardContract.adapterKind,
    composerDecision: composerGuardContract.composerDecision,
    composerGuardContract,
    payload,
    composerGuardPassed: guardPassed,
    defaultOffPassed,
    isolatedNoOpPassed,
    safeForDefaultOffAdapter,
    composerWiringActiveNow: false,
    composerChangeAttempted: false,
    endpointChangeAttempted: false,
    featureFlagAttempted: false,
    userVisibleOutputAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    externalCallAttempted: false,
    actionExecutionAttempted: false,
    warnings,
  } satisfies DecisionSupportDefaultOffComposerAdapterResult;
}

// ─── Adapter validation ───────────────────────────────────────────────────────────────

type CheckResult = { passed: boolean; violations: DecisionSupportDefaultOffAdapterViolationType[] };

function checkRouteGuard(routeResult: DecisionSupportDefaultOffRouteAdapterResult): CheckResult {
  const contract = routeResult.routeGuardContract;
  const passed =
    contract.defaultOff === true &&
    contract.isolatedNoOpAdapter === true &&
    contract.routeWiringActiveNow === false &&
    contract.productionRouteChangeAllowedNow === false &&
    contract.blocksUserVisibleOutput === true &&
    contract.blocksProductionEligibility === true &&
    contract.routeGuardScore >= 85 &&
    routeResult.routeGuardPassed === true;
  return { passed, violations: passed ? [] : ["route_contract_gap"] };
}

function checkComposerGuard(composerResult: DecisionSupportDefaultOffComposerAdapterResult): CheckResult {
  const contract = composerResult.composerGuardContract;
  const passed =
    contract.defaultOff === true &&
    contract.isolatedNoOpAdapter === true &&
    contract.composerWiringActiveNow === false &&
    contract.productionComposerChangeAllowedNow === false &&
    contract.internalPayloadOnly === true &&
    contract.userVisibleNow === false &&
    contract.persistedNow === false &&
    contract.executableNow === false &&
    contract.composerGuardScore >= 85 &&
    composerResult.composerGuardPassed === true;
  return { passed, violations: passed ? [] : ["composer_contract_gap"] };
}

function checkDefaultOff(
  config: DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig,
  routeResult: DecisionSupportDefaultOffRouteAdapterResult,
  composerResult: DecisionSupportDefaultOffComposerAdapterResult,
): CheckResult {
  const violations: DecisionSupportDefaultOffAdapterViolationType[] = [];
  if (config.defaultOff !== true || config.adapterEnabledNow !== false) violations.push("default_off_disabled");
  if (routeResult.defaultOffPassed !== true) violations.push("default_off_disabled");
  if (composerResult.defaultOffPassed !== true) violations.push("default_off_disabled");
  if (composerResult.payload.defaultOff !== true) violations.push("default_off_disabled");
  if (composerResult.payload.adapterEnabledNow !== false) violations.push("adapter_enabled_now");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkIsolatedNoOp(routeResult: DecisionSupportDefaultOffRouteAdapterResult, composerResult: DecisionSupportDefaultOffComposerAdapterResult): CheckResult {
  const passed = routeResult.routeGuardContract.isolatedNoOpAdapter === true && composerResult.composerGuardContract.isolatedNoOpAdapter === true;
  return { passed, violations: passed ? [] : ["route_contract_gap", "composer_contract_gap"] };
}

function checkNoVisibilityAttempt(routeResult: DecisionSupportDefaultOffRouteAdapterResult, composerResult: DecisionSupportDefaultOffComposerAdapterResult): CheckResult {
  const violations: DecisionSupportDefaultOffAdapterViolationType[] = [];
  if (routeResult.userVisibleOutputAttempted) violations.push("user_visible_output_attempted");
  if (composerResult.userVisibleOutputAttempted) violations.push("user_visible_output_attempted");
  if (composerResult.payload.userVisibleNow) violations.push("user_visible_output_attempted");
  if (composerResult.payload.sections.some((s) => s.userVisibleNow)) violations.push("user_visible_output_attempted");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkNoProductionEligibility(routeResult: DecisionSupportDefaultOffRouteAdapterResult, composerResult: DecisionSupportDefaultOffComposerAdapterResult): CheckResult {
  const violations: DecisionSupportDefaultOffAdapterViolationType[] = [];
  if (composerResult.payload.productionEligibleNow) violations.push("production_wiring_attempted");
  if (routeResult.routeGuardContract.blocksProductionEligibility !== true) violations.push("production_wiring_attempted");
  if (composerResult.composerGuardContract.blocksProductionEligibility !== true) violations.push("production_wiring_attempted");
  if (routeResult.productionWiringAttempted) violations.push("production_wiring_attempted");
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

const RAW_INPUT_LIKE_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{7,}\d/;

function checkNoLeaks(composerResult: DecisionSupportDefaultOffComposerAdapterResult): CheckResult {
  const violations: DecisionSupportDefaultOffAdapterViolationType[] = [];
  for (const s of composerResult.payload.sections) {
    if (s.containsRawInput) violations.push("raw_input_leak");
    if (s.containsFullCandidate) violations.push("full_candidate_leak");
    if (s.containsPii) violations.push("pii_leak");
    if (s.containsProjectNameRaw) violations.push("project_name_leak");
    if (RAW_INPUT_LIKE_PATTERN.test(s.body)) violations.push("pii_leak");
  }
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

function checkNoSideEffects(routeResult: DecisionSupportDefaultOffRouteAdapterResult, composerResult: DecisionSupportDefaultOffComposerAdapterResult): CheckResult {
  const violations: DecisionSupportDefaultOffAdapterViolationType[] = [];
  if (composerResult.payload.persistedNow) violations.push("real_persistence_attempted");
  if (composerResult.payload.executableNow) violations.push("action_execution_attempted");
  if (composerResult.payload.externalSideEffectsAllowed) violations.push("external_call_attempted");
  if (composerResult.realPersistenceAttempted) violations.push("real_persistence_attempted");
  if (composerResult.dbWriteAttempted) violations.push("db_write_attempted");
  if (composerResult.supabaseWriteAttempted) violations.push("supabase_write_attempted");
  if (composerResult.externalCallAttempted) violations.push("external_call_attempted");
  if (composerResult.actionExecutionAttempted) violations.push("action_execution_attempted");
  if (composerResult.featureFlagAttempted) violations.push("feature_flag_activation_attempted");
  if (composerResult.endpointChangeAttempted) violations.push("endpoint_wiring_attempted");
  if (composerResult.composerChangeAttempted) violations.push("composer_wiring_attempted");
  if (routeResult.routerChangeAttempted) violations.push("router_wiring_attempted");
  for (const s of composerResult.payload.sections) {
    if (s.containsExecutableInstruction) violations.push("action_execution_attempted");
    if (s.containsPersistenceInstruction) violations.push("real_persistence_attempted");
  }
  return { passed: violations.length === 0, violations: [...new Set(violations)] };
}

const CRITICAL_VIOLATIONS = new Set<DecisionSupportDefaultOffAdapterViolationType>([
  "adapter_enabled_now",
  "router_wiring_attempted",
  "composer_wiring_attempted",
  "endpoint_wiring_attempted",
  "feature_flag_activation_attempted",
  "user_visible_output_attempted",
  "production_wiring_attempted",
  "real_persistence_attempted",
  "db_write_attempted",
  "supabase_write_attempted",
  "external_call_attempted",
  "action_execution_attempted",
  "task_creation_attempted",
  "email_or_draft_creation_attempted",
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
]);

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export type DecisionSupportDefaultOffRouteComposerAdapterValidationOptions = {
  config?: Partial<DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig>;
};

/**
 * Validates a single route/composer adapter simulation pair against every Sprint 36R gate: route guard
 * contract compliance, composer guard contract compliance, default-off compliance, isolated no-op
 * compliance, no-visibility-attempt, no-production-eligibility, no-leak guarantee, and no-side-effects
 * guarantee. Every `*Attempted` field on the underlying route/composer results is always the literal
 * `false` — this adapter never attempts a real side effect, so there is nothing to detect beyond the
 * simulation's own declared fields.
 */
export function validateDecisionSupportDefaultOffRouteComposerAdapter(
  routeResult: DecisionSupportDefaultOffRouteAdapterResult,
  composerResult: DecisionSupportDefaultOffComposerAdapterResult,
  options: DecisionSupportDefaultOffRouteComposerAdapterValidationOptions = {},
): DecisionSupportDefaultOffRouteComposerAdapterValidationResult {
  const config = createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig(options.config);

  const routeGuard = checkRouteGuard(routeResult);
  const composerGuard = checkComposerGuard(composerResult);
  const defaultOff = checkDefaultOff(config, routeResult, composerResult);
  const isolatedNoOp = checkIsolatedNoOp(routeResult, composerResult);
  const noVisibilityAttempt = checkNoVisibilityAttempt(routeResult, composerResult);
  const noProductionEligibility = checkNoProductionEligibility(routeResult, composerResult);
  const noLeaks = checkNoLeaks(composerResult);
  const noSideEffects = checkNoSideEffects(routeResult, composerResult);

  const allChecks = [routeGuard, composerGuard, defaultOff, isolatedNoOp, noVisibilityAttempt, noProductionEligibility, noLeaks, noSideEffects];
  const violations = dedupe(allChecks.flatMap((c) => c.violations));

  const hasCriticalViolation = violations.some((v) => CRITICAL_VIOLATIONS.has(v));

  let qaStatus: DecisionSupportDefaultOffAdapterQaStatus;
  let riskLevel: DecisionSupportDefaultOffAdapterRiskLevel;
  let status: DecisionSupportDefaultOffAdapterStatus;
  if (violations.length === 0) {
    qaStatus = "pass";
    riskLevel = "low";
    status = "accepted";
  } else if (hasCriticalViolation) {
    qaStatus = "blocked";
    riskLevel = "critical";
    status = "blocked";
  } else {
    qaStatus = "fail";
    riskLevel = "high";
    status = "rejected";
  }

  const valid = violations.length === 0;
  const safeForProductionWiringReadinessReview = valid;
  const recommendation = valid
    ? "No action needed — this adapter simulation passes every Sprint 36R gate."
    : `Fix the following before this adapter simulation can be accepted: ${violations.join(", ")}.`;

  return {
    caseId: routeResult.caseId,
    valid,
    status,
    qaStatus,
    riskLevel,
    violations,
    routeGuardPassed: routeGuard.passed,
    composerGuardPassed: composerGuard.passed,
    defaultOffPassed: defaultOff.passed,
    isolatedNoOpPassed: isolatedNoOp.passed,
    noVisibilityAttemptPassed: noVisibilityAttempt.passed,
    noProductionEligibilityPassed: noProductionEligibility.passed,
    noLeaksPassed: noLeaks.passed,
    noSideEffectsPassed: noSideEffects.passed,
    safeForProductionWiringReadinessReview,
    recommendation,
  } satisfies DecisionSupportDefaultOffRouteComposerAdapterValidationResult;
}

// ─── Adapter run ────────────────────────────────────────────────────────────────────

function buildCaseResult(dryRunCaseResult: DecisionSupportUserVisibleDryRunEvaluationCaseResult, config: DecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig): DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult {
  const routeResult = simulateDecisionSupportDefaultOffRouteAdapter(dryRunCaseResult, { config });
  const composerResult = simulateDecisionSupportDefaultOffComposerAdapter(dryRunCaseResult, routeResult, { config });
  const validation = validateDecisionSupportDefaultOffRouteComposerAdapter(routeResult, composerResult, { config });

  const warnings = [...routeResult.warnings, ...composerResult.warnings];
  if (!validation.valid) {
    warnings.push(`Case ${dryRunCaseResult.caseId}: adapter ${validation.status} (${validation.qaStatus}) — ${validation.recommendation}`);
  }

  return {
    caseId: dryRunCaseResult.caseId,
    sourcePreviewId: dryRunCaseResult.preview.previewId,
    sourcePreviewKind: dryRunCaseResult.preview.previewKind,
    adapterKind: routeResult.adapterKind,
    routeResult,
    composerResult,
    validation,
    adapterAccepted: validation.status === "accepted",
    adapterRejected: validation.status === "rejected",
    adapterBlocked: validation.status === "blocked",
    safeForProductionWiringReadinessReview: validation.safeForProductionWiringReadinessReview,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings,
  } satisfies DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult;
}

/**
 * Runs the full Sprint 36R default-off route/composer integration adapter: reuses (or builds) the
 * Sprint 35R user-visible dry run evaluation harness against the same corpus (default: that harness's
 * own small self-contained synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for the full Sprint
 * 18R corpus), simulates a route adapter and a composer adapter for every case, validates every pair, and
 * consolidates the Sprint 36R allowed/prohibited actions. Never shows anything to a user, never persists
 * anything real, and never touches the router, composer, or endpoint.
 */
export function runDecisionSupportDefaultOffRouteComposerIntegrationAdapter(
  options: DecisionSupportDefaultOffRouteComposerIntegrationAdapterOptions = {},
): DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult {
  const config = createDecisionSupportDefaultOffRouteComposerIntegrationAdapterConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;

  const harness = options.harness ?? runDecisionSupportUserVisibleDryRunEvaluationHarness({ cases: options.cases, now });
  const harnessSummary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(harness);

  const caseResults = harness.caseResults.map((c) => buildCaseResult(c, config));

  const allowedNextActions = listDecisionSupportDefaultOffRouteComposerIntegrationAdapterAllowedNextActions();
  const prohibitedActions = listDecisionSupportDefaultOffRouteComposerIntegrationAdapterProhibitedActions();

  const warnings: string[] = [];
  if (harnessSummary.decision !== "ready_for_default_off_route_composer_integration_adapter") {
    warnings.push(`Sprint 35R user-visible dry run evaluation harness decision is "${harnessSummary.decision}", not "ready_for_default_off_route_composer_integration_adapter" — this adapter cannot recommend Sprint 37R until that is resolved.`);
  }
  if (harnessSummary.previewAcceptedCount !== harnessSummary.totalCases) {
    warnings.push("Not every Sprint 35R preview is accepted — this adapter cannot recommend Sprint 37R until that is resolved.");
  }
  if (harnessSummary.safeForDefaultOffRouteComposerAdapterCount !== harnessSummary.totalCases) {
    warnings.push("Not every Sprint 35R case is safeForDefaultOffRouteComposerAdapter — this adapter cannot recommend Sprint 37R until that is resolved.");
  }
  for (const caseResult of caseResults) warnings.push(...caseResult.warnings);

  return {
    config,
    harness,
    harnessSummary,
    caseResults,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

const REPRESENTATIVE_LIMIT = 8;

function average(values: number[]): number {
  if (values.length === 0) return 100;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

const VISIBILITY_VIOLATIONS = new Set<DecisionSupportDefaultOffAdapterViolationType>(["user_visible_output_attempted"]);

const PRODUCTION_WIRING_VIOLATIONS = new Set<DecisionSupportDefaultOffAdapterViolationType>([
  "production_wiring_attempted",
  "router_wiring_attempted",
  "composer_wiring_attempted",
  "endpoint_wiring_attempted",
  "feature_flag_activation_attempted",
  "adapter_enabled_now",
]);

const LEAKAGE_OR_SIDE_EFFECT_VIOLATIONS = new Set<DecisionSupportDefaultOffAdapterViolationType>([
  "raw_input_leak",
  "full_candidate_leak",
  "pii_leak",
  "project_name_leak",
  "real_persistence_attempted",
  "db_write_attempted",
  "supabase_write_attempted",
  "external_call_attempted",
  "action_execution_attempted",
  "task_creation_attempted",
  "email_or_draft_creation_attempted",
]);

function computeDecision(fields: {
  totalCases: number;
  adapterEvaluatedCount: number;
  adapterAcceptedCount: number;
  adapterRejectedCount: number;
  adapterBlockedCount: number;
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
  minRouteGuardScoreObserved: number;
  minComposerGuardScoreObserved: number;
  violationCount: number;
  criticalViolationCount: number;
  visibilityViolationCount: number;
  productionWiringViolationCount: number;
  leakageOrSideEffectViolationCount: number;
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
  sprint35HarnessDecision: string | undefined;
}): DecisionSupportDefaultOffRouteComposerIntegrationAdapterDecision {
  const anyAttempted =
    fields.routerChangeAttemptedCount > 0 ||
    fields.composerChangeAttemptedCount > 0 ||
    fields.endpointChangeAttemptedCount > 0 ||
    fields.featureFlagAttemptedCount > 0 ||
    fields.userVisibleOutputAttemptedCount > 0 ||
    fields.productionWiringAttemptedCount > 0 ||
    fields.realPersistenceAttemptedCount > 0 ||
    fields.dbWriteAttemptedCount > 0 ||
    fields.supabaseWriteAttemptedCount > 0 ||
    fields.externalCallAttemptedCount > 0 ||
    fields.actionExecutionAttemptedCount > 0 ||
    fields.taskCreationAttemptedCount > 0 ||
    fields.emailDraftCreationAttemptedCount > 0;

  if (fields.leakageOrSideEffectViolationCount > 0) return "blocked_by_leakage_or_side_effect_risk";

  if (fields.visibilityViolationCount > 0 || fields.safeForUserVisibleOutputNowCount > 0 || fields.safeForProductionCount > 0) {
    return "blocked_by_visibility_risk";
  }

  if (fields.productionWiringViolationCount > 0 || anyAttempted) return "blocked_by_production_wiring_risk";

  const defaultOffGap = fields.defaultOffPassedCount !== fields.totalCases || fields.isolatedNoOpPassedCount !== fields.totalCases;
  if (defaultOffGap) return "blocked_by_default_off_gap";

  if (fields.routeGuardPassedCount !== fields.totalCases || fields.adapterRejectedCount > 0 || fields.qaFailCount > 0) {
    return "blocked_by_route_contract_gap";
  }
  if (fields.composerGuardPassedCount !== fields.totalCases) {
    return "blocked_by_composer_contract_gap";
  }

  const allClean =
    fields.totalCases > 0 &&
    fields.adapterEvaluatedCount === fields.totalCases &&
    fields.adapterAcceptedCount === fields.totalCases &&
    fields.adapterRejectedCount === 0 &&
    fields.adapterBlockedCount === 0 &&
    fields.qaPassCount === fields.totalCases &&
    fields.qaWarningCount === 0 &&
    fields.qaFailCount === 0 &&
    fields.qaBlockedCount === 0 &&
    fields.safeForProductionWiringReadinessReviewCount === fields.totalCases &&
    fields.safeForUserVisibleOutputNowCount === 0 &&
    fields.safeForProductionCount === 0 &&
    fields.routeGuardPassedCount === fields.totalCases &&
    fields.composerGuardPassedCount === fields.totalCases &&
    fields.defaultOffPassedCount === fields.totalCases &&
    fields.isolatedNoOpPassedCount === fields.totalCases &&
    fields.noVisibilityAttemptPassedCount === fields.totalCases &&
    fields.noProductionEligibilityPassedCount === fields.totalCases &&
    fields.noLeaksPassedCount === fields.totalCases &&
    fields.noSideEffectsPassedCount === fields.totalCases &&
    fields.averageRouteGuardScore >= 90 &&
    fields.averageComposerGuardScore >= 90 &&
    fields.minRouteGuardScoreObserved >= 85 &&
    fields.minComposerGuardScoreObserved >= 85 &&
    fields.violationCount === 0 &&
    fields.criticalViolationCount === 0 &&
    fields.visibilityViolationCount === 0 &&
    fields.productionWiringViolationCount === 0 &&
    fields.leakageOrSideEffectViolationCount === 0 &&
    !anyAttempted &&
    fields.sprint35HarnessDecision === "ready_for_default_off_route_composer_integration_adapter";

  return allClean ? "ready_for_production_wiring_readiness_feature_flag_gate" : "continue_default_off_adapter_only";
}

function recommendedNextSprintFor(decision: DecisionSupportDefaultOffRouteComposerIntegrationAdapterDecision): string {
  switch (decision) {
    case "ready_for_production_wiring_readiness_feature_flag_gate":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_route_contract_gap":
      return "Sprint 36R — Default-Off Route/Composer Integration Adapter (Route Guard Hardening)";
    case "blocked_by_composer_contract_gap":
      return "Sprint 36R — Default-Off Route/Composer Integration Adapter (Composer Guard Hardening)";
    case "blocked_by_default_off_gap":
      return "Sprint 36R — Default-Off Route/Composer Integration Adapter (Default-Off Hardening)";
    case "blocked_by_visibility_risk":
      return "Sprint 36R — Default-Off Route/Composer Integration Adapter (Visibility Risk Hardening)";
    case "blocked_by_production_wiring_risk":
      return "Sprint 36R — Default-Off Route/Composer Integration Adapter (Production Wiring Risk Hardening)";
    case "blocked_by_leakage_or_side_effect_risk":
      return "Sprint 36R — Default-Off Route/Composer Integration Adapter (Leakage/Side Effect Hardening)";
    case "continue_default_off_adapter_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

/**
 * Turns a `runDecisionSupportDefaultOffRouteComposerIntegrationAdapter()` result — or a bare
 * `DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult[]` plus
 * `options.sprint35HarnessDecision` — into a review-ready report: per-adapter-kind counts, QA status
 * counts, safety counts (every production-side-effect count expected zero), score averages/minimums, a
 * decision, and a recommended next sprint. Pure — takes already-computed case results rather than
 * re-running anything.
 */
export function summarizeDecisionSupportDefaultOffRouteComposerIntegrationAdapter(
  adapterOrCaseResults: DecisionSupportDefaultOffRouteComposerIntegrationAdapterResult | DecisionSupportDefaultOffRouteComposerIntegrationAdapterCaseResult[],
  options: DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummaryOptions = {},
): DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummary {
  const caseResults = Array.isArray(adapterOrCaseResults) ? adapterOrCaseResults : adapterOrCaseResults.caseResults;
  const sprint35HarnessDecision = Array.isArray(adapterOrCaseResults) ? options.sprint35HarnessDecision : (options.sprint35HarnessDecision ?? adapterOrCaseResults.harnessSummary.decision);
  const adapterWarnings = Array.isArray(adapterOrCaseResults) ? [] : adapterOrCaseResults.warnings;

  const totalCases = caseResults.length;

  const adapterEvaluatedCount = totalCases;
  const adapterAcceptedCount = caseResults.filter((c) => c.adapterAccepted).length;
  const adapterRejectedCount = caseResults.filter((c) => c.adapterRejected).length;
  const adapterBlockedCount = caseResults.filter((c) => c.adapterBlocked).length;

  const clarificationGateAdapterCount = caseResults.filter((c) => c.adapterKind === "clarification_gate_adapter").length;
  const routePreservationAdapterCount = caseResults.filter((c) => c.adapterKind === "route_preservation_adapter").length;
  const unsupportedBoundaryAdapterCount = caseResults.filter((c) => c.adapterKind === "unsupported_boundary_adapter").length;
  const shadowOnlyAdapterCount = caseResults.filter((c) => c.adapterKind === "shadow_only_adapter").length;
  const blockedUnsafeAdapterCount = caseResults.filter((c) => c.adapterKind === "blocked_unsafe_adapter").length;

  const qaPassCount = caseResults.filter((c) => c.validation.qaStatus === "pass").length;
  const qaWarningCount = caseResults.filter((c) => c.validation.qaStatus === "warning").length;
  const qaFailCount = caseResults.filter((c) => c.validation.qaStatus === "fail").length;
  const qaBlockedCount = caseResults.filter((c) => c.validation.qaStatus === "blocked").length;

  const safeForProductionWiringReadinessReviewCount = caseResults.filter((c) => c.safeForProductionWiringReadinessReview).length;
  const safeForUserVisibleOutputNowCount = caseResults.filter((c) => c.safeForUserVisibleOutputNow).length;
  const safeForProductionCount = caseResults.filter((c) => c.safeForProduction).length;

  const routeGuardPassedCount = caseResults.filter((c) => c.validation.routeGuardPassed).length;
  const composerGuardPassedCount = caseResults.filter((c) => c.validation.composerGuardPassed).length;
  const defaultOffPassedCount = caseResults.filter((c) => c.validation.defaultOffPassed).length;
  const isolatedNoOpPassedCount = caseResults.filter((c) => c.validation.isolatedNoOpPassed).length;
  const noVisibilityAttemptPassedCount = caseResults.filter((c) => c.validation.noVisibilityAttemptPassed).length;
  const noProductionEligibilityPassedCount = caseResults.filter((c) => c.validation.noProductionEligibilityPassed).length;
  const noLeaksPassedCount = caseResults.filter((c) => c.validation.noLeaksPassed).length;
  const noSideEffectsPassedCount = caseResults.filter((c) => c.validation.noSideEffectsPassed).length;

  const routeGuardScores = caseResults.map((c) => c.routeResult.routeGuardContract.routeGuardScore);
  const composerGuardScores = caseResults.map((c) => c.composerResult.composerGuardContract.composerGuardScore);
  const averageRouteGuardScore = average(routeGuardScores);
  const averageComposerGuardScore = average(composerGuardScores);
  const minRouteGuardScore = routeGuardScores.length > 0 ? Math.min(...routeGuardScores) : 0;
  const minComposerGuardScore = composerGuardScores.length > 0 ? Math.min(...composerGuardScores) : 0;

  const allViolations = caseResults.flatMap((c) => c.validation.violations);
  const violationCount = allViolations.length;
  const criticalViolationCount = caseResults.filter((c) => c.validation.riskLevel === "critical").flatMap((c) => c.validation.violations).length;
  const visibilityViolationCount = allViolations.filter((v) => VISIBILITY_VIOLATIONS.has(v)).length;
  const productionWiringViolationCount = allViolations.filter((v) => PRODUCTION_WIRING_VIOLATIONS.has(v)).length;
  const leakageOrSideEffectViolationCount = allViolations.filter((v) => LEAKAGE_OR_SIDE_EFFECT_VIOLATIONS.has(v)).length;

  const routerChangeAttemptedCount = caseResults.filter((c) => c.routeResult.routerChangeAttempted).length;
  const composerChangeAttemptedCount = caseResults.filter((c) => c.composerResult.composerChangeAttempted).length;
  const endpointChangeAttemptedCount = caseResults.filter((c) => c.composerResult.endpointChangeAttempted).length;
  const featureFlagAttemptedCount = caseResults.filter((c) => c.composerResult.featureFlagAttempted).length;
  const userVisibleOutputAttemptedCount = caseResults.filter((c) => c.routeResult.userVisibleOutputAttempted || c.composerResult.userVisibleOutputAttempted).length;
  const productionWiringAttemptedCount = caseResults.filter((c) => c.routeResult.productionWiringAttempted).length;
  const realPersistenceAttemptedCount = caseResults.filter((c) => c.composerResult.realPersistenceAttempted).length;
  const dbWriteAttemptedCount = caseResults.filter((c) => c.composerResult.dbWriteAttempted).length;
  const supabaseWriteAttemptedCount = caseResults.filter((c) => c.composerResult.supabaseWriteAttempted).length;
  const externalCallAttemptedCount = caseResults.filter((c) => c.composerResult.externalCallAttempted).length;
  const actionExecutionAttemptedCount = caseResults.filter((c) => c.composerResult.actionExecutionAttempted).length;
  const taskCreationAttemptedCount = 0;
  const emailDraftCreationAttemptedCount = 0;

  const decision = computeDecision({
    totalCases,
    adapterEvaluatedCount,
    adapterAcceptedCount,
    adapterRejectedCount,
    adapterBlockedCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    safeForProductionWiringReadinessReviewCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    routeGuardPassedCount,
    composerGuardPassedCount,
    defaultOffPassedCount,
    isolatedNoOpPassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    averageRouteGuardScore,
    averageComposerGuardScore,
    minRouteGuardScoreObserved: minRouteGuardScore,
    minComposerGuardScoreObserved: minComposerGuardScore,
    violationCount,
    criticalViolationCount,
    visibilityViolationCount,
    productionWiringViolationCount,
    leakageOrSideEffectViolationCount,
    routerChangeAttemptedCount,
    composerChangeAttemptedCount,
    endpointChangeAttemptedCount,
    featureFlagAttemptedCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    actionExecutionAttemptedCount,
    taskCreationAttemptedCount,
    emailDraftCreationAttemptedCount,
    sprint35HarnessDecision,
  });

  const warnings = [...adapterWarnings, ...caseResults.flatMap((c) => c.warnings)];

  return {
    totalCases,
    adapterEvaluatedCount,
    adapterAcceptedCount,
    adapterRejectedCount,
    adapterBlockedCount,
    clarificationGateAdapterCount,
    routePreservationAdapterCount,
    unsupportedBoundaryAdapterCount,
    shadowOnlyAdapterCount,
    blockedUnsafeAdapterCount,
    qaPassCount,
    qaWarningCount,
    qaFailCount,
    qaBlockedCount,
    safeForProductionWiringReadinessReviewCount,
    safeForUserVisibleOutputNowCount,
    safeForProductionCount,
    routeGuardPassedCount,
    composerGuardPassedCount,
    defaultOffPassedCount,
    isolatedNoOpPassedCount,
    noVisibilityAttemptPassedCount,
    noProductionEligibilityPassedCount,
    noLeaksPassedCount,
    noSideEffectsPassedCount,
    averageRouteGuardScore,
    averageComposerGuardScore,
    minRouteGuardScore,
    minComposerGuardScore,
    violationCount,
    criticalViolationCount,
    routerChangeAttemptedCount,
    composerChangeAttemptedCount,
    endpointChangeAttemptedCount,
    featureFlagAttemptedCount,
    userVisibleOutputAttemptedCount,
    productionWiringAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    actionExecutionAttemptedCount,
    taskCreationAttemptedCount,
    emailDraftCreationAttemptedCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeAcceptedAdapters: caseResults.filter((c) => c.adapterAccepted).slice(0, REPRESENTATIVE_LIMIT),
    rejectedAdapters: caseResults.filter((c) => c.adapterRejected),
    blockedAdapters: caseResults.filter((c) => c.adapterBlocked),
    warnings,
  } satisfies DecisionSupportDefaultOffRouteComposerIntegrationAdapterSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 36R default-off route/composer integration adapter — mirrors the
 * style of `explainDecisionSupportUserVisibleDryRunEvaluationHarness()` (Sprint 35R). See
 * `docs/conversational-brain-decision-support-default-off-route-composer-integration-adapter.md` for full
 * context.
 */
export function explainDecisionSupportDefaultOffRouteComposerIntegrationAdapter(): DecisionSupportDefaultOffRouteComposerIntegrationAdapterExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-default-off-route-composer-integration-adapter",
    purpose:
      "Connects every Sprint 35R-validated preview to a synthetic route guard contract and a synthetic composer guard contract, simulating how a " +
      "future route/composer wiring would behave — without ever touching the real router, composer, endpoint, feature flag, or persistence layer, " +
      "and without ever showing anything to a real user.",
    nonGoals: [
      "Wire the router, composer, or endpoint directly to live decision_support.",
      "Implement or activate a production feature flag.",
      "Show any output to a real user.",
      "Create a real database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action, create any real task, or send any real email/draft.",
      "Persist any real output.",
      "Call an LLM or an external API, or read an environment variable.",
    ],
    adapterProfile:
      'The "strict_default_off_route_composer_integration_adapter" profile: `defaultOff` is always true, `adapterEnabledNow` is always false, every ' +
      "allow* field (allowProductionWiring/allowRouterChange/allowComposerChange/allowEndpointChange/allowFeatureFlagImplementation/" +
      "allowFeatureFlagActivation/allowUserVisibleOutput/allowRealPersistence/allowDbWrite/allowSupabaseWrite/allowExternalCalls/" +
      "allowActionExecution/allowTaskCreation/allowEmailDraftCreation) is a literal false, forced regardless of any override a caller passes, and " +
      "every require* field is always true.",
    adapterModes: [
      "default_off_adapter_only (default): the full default-off route/composer integration adapter, covering every adapter kind.",
      "isolated_noop_route_simulation: emphasizes simulateDecisionSupportDefaultOffRouteAdapter() output.",
      "isolated_noop_composer_simulation: emphasizes simulateDecisionSupportDefaultOffComposerAdapter() output.",
      "route_guard_contract_review: emphasizes createDecisionSupportDefaultOffRouteGuardContract() output.",
      "composer_guard_contract_review: emphasizes createDecisionSupportDefaultOffComposerGuardContract() output.",
      "production_wiring_readiness_review: emphasizes safeForProductionWiringReadinessReview across every case.",
    ],
    adapterKindRules: [
      "clarification_first_preview (Sprint 35R preview kind) -> clarification_gate_adapter.",
      "route_preservation_preview -> route_preservation_adapter.",
      "unsupported_boundary_preview -> unsupported_boundary_adapter.",
      "shadow_only_internal_preview -> shadow_only_adapter.",
      "blocked_unsafe_preview -> blocked_unsafe_adapter (the safe fallback for any preview kind this adapter does not build a positive contract for).",
    ],
    routeGuardContractRules: [
      "clarification_gate_adapter simulates simulate_route_to_clarification_gate with requiresClarificationGate: true, routeGuardScore 95.",
      "route_preservation_adapter simulates simulate_preserve_existing_route with preservesExistingRoute: true, routeGuardScore 92.",
      "unsupported_boundary_adapter simulates simulate_preserve_unsupported with preservesUnsupportedBoundary: true, routeGuardScore 90.",
      "shadow_only_adapter simulates simulate_shadow_only with keepsShadowOnly: true, routeGuardScore 88.",
      "blocked_unsafe_adapter simulates simulate_block_unsafe with blocksUnsafe: true, routeGuardScore 85.",
      "Every contract is defaultOff: true, isolatedNoOpAdapter: true, routeWiringActiveNow: false, productionRouteChangeAllowedNow: false, blocksDirectDecision: true, blocksUserVisibleOutput: true, blocksProductionEligibility: true.",
    ],
    composerGuardContractRules: [
      "clarification_gate_adapter simulates simulate_composer_internal_preview_payload, composerGuardScore 95.",
      "route_preservation_adapter simulates simulate_composer_route_preservation_payload, composerGuardScore 92.",
      "unsupported_boundary_adapter simulates simulate_composer_unsupported_boundary_payload, composerGuardScore 90.",
      "shadow_only_adapter simulates simulate_composer_shadow_only_payload, composerGuardScore 88.",
      "blocked_unsafe_adapter simulates simulate_composer_blocked_payload, composerGuardScore 85.",
      "Every contract is defaultOff: true, isolatedNoOpAdapter: true, composerWiringActiveNow: false, productionComposerChangeAllowedNow: false, internalPayloadOnly: true, userVisibleNow: false, persistedNow: false, executableNow: false, blocksDirectDecision: true, blocksExecution: true, blocksPersistence: true, blocksExternalCalls: true, blocksProductionEligibility: true.",
    ],
    routeAdapterSimulationRules: [
      "Builds the route guard contract for the dry-run case result's preview kind, then confirms routeGuardPassed/defaultOffPassed/isolatedNoOpPassed/safeForComposerAdapterSimulation.",
      "Always routeWiringActiveNow: false, routerChangeAttempted: false, productionWiringAttempted: false, userVisibleOutputAttempted: false.",
    ],
    composerAdapterSimulationRules: [
      "Builds the composer guard contract from the route result's adapter kind, then builds an internal-only payload from the preview's display sections.",
      "Every payload section is internalOnly: true, userVisibleNow: false, and carries no raw input, full candidate, PII, project name, executable instruction, or persistence instruction.",
      "Always composerWiringActiveNow: false, composerChangeAttempted: false, endpointChangeAttempted: false, featureFlagAttempted: false, userVisibleOutputAttempted: false, realPersistenceAttempted: false, dbWriteAttempted: false, supabaseWriteAttempted: false, externalCallAttempted: false, actionExecutionAttempted: false.",
    ],
    adapterValidationRules: [
      "routeGuardPassed and composerGuardPassed check every contract invariant plus the routeGuardScore/composerGuardScore floor (>= 85).",
      "defaultOffPassed checks the config, both results, and the payload all stay defaultOff: true / adapterEnabledNow: false.",
      "isolatedNoOpPassed checks both guard contracts stay isolatedNoOpAdapter: true.",
      "noVisibilityAttemptPassed, noProductionEligibilityPassed, noLeaksPassed, and noSideEffectsPassed apply to every adapter kind.",
      "qaStatus is blocked if any leak/side-effect/wiring/visibility violation is present, else fail if any other violation is present, else pass.",
    ],
    adapterRunRules: [
      "Reuses (or accepts) the Sprint 35R user-visible dry run evaluation harness against the same corpus rather than re-deriving it.",
      "Simulates exactly one route adapter and one composer adapter per Sprint 35R case result, then validates every pair.",
      "Never shows output to a user, never persists output, and never touches the router/composer/endpoint.",
    ],
    decisionRule:
      "ready_for_production_wiring_readiness_feature_flag_gate requires: totalCases > 0, adapterAcceptedCount === totalCases, every rejected/" +
      "blocked count at zero, qaPassCount === totalCases, every gate-pass count === totalCases, averageRouteGuardScore >= 90, " +
      "averageComposerGuardScore >= 90, every minimum score at or above its floor, every violation/attempted count at zero, and the Sprint 35R " +
      "harness decision === ready_for_default_off_route_composer_integration_adapter. Otherwise, in priority order: " +
      "blocked_by_leakage_or_side_effect_risk if any leak/side-effect violation is present; else blocked_by_visibility_risk if any user-visible-" +
      "output violation or a nonzero safeForUserVisibleOutputNow/safeForProduction count is observed; else blocked_by_production_wiring_risk if " +
      "any production-wiring violation or attempted-count is nonzero; else blocked_by_default_off_gap if defaultOffPassedCount/" +
      "isolatedNoOpPassedCount is short of totalCases; else blocked_by_route_contract_gap if routeGuardPassedCount is short of totalCases or any " +
      "adapter is rejected; else blocked_by_composer_contract_gap if composerGuardPassedCount is short of totalCases; else " +
      "continue_default_off_adapter_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyUserVisibleOutputIsNotShown:
      "Every composer payload carries userVisibleNow: false and every case result carries safeForUserVisibleOutputNow: false — a future " +
      "production wiring readiness review (Sprint 37R) must review this adapter's output before it could ever reach a real user.",
    whyRouterIsNotChanged: "brainRouter.ts is production code. This adapter only simulates a route guard contract offline — it never imports or modifies the router.",
    whyComposerIsNotChanged: "responseComposer.ts is production code. This adapter never imports or modifies the composer.",
    whyEndpointIsNotChanged: "POST /api/command-center/chat is production code. This adapter never imports or modifies the endpoint or its handlers.",
    whyFeatureFlagIsNotCreated: "No production feature flag exists for decision_support, and none is created by this adapter — flipping one on is a production activation decision, not an adapter decision.",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review (reused transitively via the Sprint 35R/34R/33R/32R/31R plans) still resolves to " +
      "do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR " +
      "policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by simulating route/composer guard contracts.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseStorageIsNotCreated: "This adapter never writes anything real — every payload stays persistedNow: false, productionEligibleNow: false.",
    whyStorageAdapterIsNotCreated: "This adapter reuses the existing Sprint 28R fake adapter's evaluation (via the Sprint 35R/34R/33R/32R/31R plans) as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this adapter does not build.",
    expectedSprint37Path:
      "If every adapter simulation stays qaStatus: pass, safeForProductionWiringReadinessReview: true, every violation/attempted count stays at " +
      "zero, averageRouteGuardScore stays >= 90, averageComposerGuardScore stays >= 90, and the Sprint 35R user-visible dry run evaluation harness " +
      "stays ready_for_default_off_route_composer_integration_adapter, Sprint 37R can build a production wiring readiness review and a default-off " +
      "feature flag gate contract — still without activating a production feature flag, and still without showing anything to a real user until " +
      "that future gate is explicitly turned on for a real workspace.",
  };
}
