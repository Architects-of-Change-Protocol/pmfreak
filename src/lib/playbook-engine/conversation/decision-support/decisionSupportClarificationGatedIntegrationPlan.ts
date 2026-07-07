/**
 * Sprint 31R — Clarification-Gated Decision Support Integration Plan.
 *
 * A pure, offline, deterministic **integration plan** — not an implementation — that answers how
 * `decision_support` would eventually be integrated behind a clarification gate: which cases must pass
 * through the clarification gate, which must preserve an existing route, which must stay unsupported,
 * what would block any integration, what contract a future gated adapter would need, what route guard
 * must exist before any user-visible output, what handoff would exist between the classifier, the
 * clarification strategy, and decision support, what must be simulated without touching
 * router/composer/endpoint, and what must pass before any real implementation.
 *
 * Reuses, rather than reimplements: the Sprint 30R controlled shadow replay evaluation
 * (`runDecisionSupportShadowControlledReplayEvaluation`, `summarizeDecisionSupportShadowControlledReplayEvaluation`),
 * the Sprint 29R persistence readiness review (`buildDecisionSupportShadowPersistenceReadinessReview`,
 * `summarizeDecisionSupportShadowPersistenceReadinessReview`, `createDecisionSupportShadowPersistenceReadinessInputMetrics`),
 * the Sprint 28R fake adapter evaluation (`runDecisionSupportShadowStorageFakeAdapterEvaluation`), the
 * Sprint 27R storage adapter plan evaluation (`runDecisionSupportShadowStorageAdapterPlanEvaluation`),
 * the Sprint 26R storage policy evaluation (`runDecisionSupportShadowStoragePolicyEvaluation`), the
 * Sprint 25R capture harness evaluation (`runDecisionSupportShadowCaptureHarnessEvaluation`), and the
 * Sprint 22R clarification response evaluation (`runClarificationResponseEvaluation`,
 * `summarizeClarificationResponseEvaluation`, `toDecisionClarificationEvaluationCases`) — evidence that
 * the clarification gate this plan relies on is backed by an existing, already-tested strategy, not a
 * new one built for this sprint.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. It never shows any decision-support output to a user. See
 * `docs/conversational-brain-decision-support-clarification-gated-integration-plan.md` for the full
 * design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";

import {
  runDecisionSupportShadowControlledReplayEvaluation,
  summarizeDecisionSupportShadowControlledReplayEvaluation,
} from "./decisionSupportShadowControlledReplay";
import {
  buildDecisionSupportShadowPersistenceReadinessReview,
  createDecisionSupportShadowPersistenceReadinessInputMetrics,
  summarizeDecisionSupportShadowPersistenceReadinessReview,
} from "./decisionSupportShadowCapturePersistenceReadiness";
import { runDecisionSupportShadowStorageFakeAdapterEvaluation, summarizeDecisionSupportShadowStorageFakeAdapterEvaluation } from "./decisionSupportShadowCaptureStorageFakeAdapter";
import { runDecisionSupportShadowStorageAdapterPlanEvaluation, summarizeDecisionSupportShadowStorageAdapterPlanEvaluation } from "./decisionSupportShadowCaptureStorageAdapterPlan";
import { runDecisionSupportShadowStoragePolicyEvaluation, summarizeDecisionSupportShadowStoragePolicyEvaluation } from "./decisionSupportShadowCaptureStoragePolicy";
import { runDecisionSupportShadowCaptureHarnessEvaluation, summarizeDecisionSupportShadowCaptureHarnessEvaluation } from "./decisionSupportShadowCaptureHarness";
import {
  runClarificationResponseEvaluation,
  summarizeClarificationResponseEvaluation,
  toDecisionClarificationEvaluationCases,
} from "../clarification/clarificationResponseEvaluation";

import type {
  DecisionSupportClarificationGatedIntegrationActionPolicy,
  DecisionSupportClarificationGatedIntegrationActionStatus,
  DecisionSupportClarificationGatedIntegrationCaseAssessment,
  DecisionSupportClarificationGatedIntegrationPlanConfig,
  DecisionSupportClarificationGatedIntegrationPlanDecision,
  DecisionSupportClarificationGatedIntegrationPlanExplain,
  DecisionSupportClarificationGatedIntegrationPlanOptions,
  DecisionSupportClarificationGatedIntegrationPlanResult,
  DecisionSupportClarificationGatedIntegrationPlanSummary,
  DecisionSupportClarificationGatedIntegrationPlanSummaryOptions,
  DecisionSupportClarificationGatedIntegrationRouteKind,
  DecisionSupportClarificationGatedIntegrationSourceCase,
  DecisionSupportClarificationGatedIntegrationStage,
  DecisionSupportClarificationGateRequirement,
  DecisionSupportClarificationGateSeverity,
  DecisionSupportClarificationGateStatus,
  DecisionSupportClarificationGateType,
  DecisionSupportClarificationGatedRouteContract,
} from "./decisionSupportClarificationGatedIntegrationPlanTypes";
import type { DecisionSupportShadowControlledReplayDecision } from "./decisionSupportShadowControlledReplayTypes";

export type {
  DecisionSupportClarificationGatedIntegrationPlanProfile,
  DecisionSupportClarificationGatedIntegrationPlanMode,
  DecisionSupportClarificationGatedIntegrationPlanDecision,
  DecisionSupportClarificationGatedIntegrationRouteKind,
  DecisionSupportClarificationGatedIntegrationStage,
  DecisionSupportClarificationGateType,
  DecisionSupportClarificationGateStatus,
  DecisionSupportClarificationGateSeverity,
  DecisionSupportClarificationGatedIntegrationActionStatus,
  DecisionSupportClarificationGatedIntegrationPlanConfig,
  DecisionSupportClarificationGatedIntegrationActionPolicy,
  DecisionSupportClarificationGateRequirement,
  DecisionSupportClarificationGatedRouteContract,
  DecisionSupportClarificationGatedIntegrationCaseAssessment,
  DecisionSupportClarificationGatedIntegrationSourceCase,
  DecisionSupportClarificationGatedIntegrationPlanOptions,
  DecisionSupportClarificationGatedIntegrationPlanResult,
  DecisionSupportClarificationGatedIntegrationPlanSummaryOptions,
  DecisionSupportClarificationGatedIntegrationPlanSummary,
  DecisionSupportClarificationGatedIntegrationPlanExplain,
} from "./decisionSupportClarificationGatedIntegrationPlanTypes";

export const DECISION_SUPPORT_CLARIFICATION_GATED_INTEGRATION_PLAN_VERSION = "31R.1.0";

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan";
const RECOMMENDED_NEXT_SPRINT_THIS_SPRINT = "Sprint 31R — Clarification-Gated Decision Support Integration Plan";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_clarification_gated_integration_plan"` default config. The nine
 * `allow*` real-side-effect fields (`allowProductionWiring`/`allowRouterChange`/`allowComposerChange`/
 * `allowEndpointChange`/`allowUserVisibleDecisionSupport`/`allowRealPersistence`/`allowDbWrite`/
 * `allowSupabaseWrite`/`allowExternalCalls`) are always `false`, forced regardless of any override a
 * caller passes — mirroring how the Sprint 30R controlled replay's own config never actually loosens
 * its six `allow*` real-side-effect flags from an override. The five `require*` fields are always
 * `true`.
 */
export function createDecisionSupportClarificationGatedIntegrationPlanConfig(
  overrides: Partial<DecisionSupportClarificationGatedIntegrationPlanConfig> = {},
): DecisionSupportClarificationGatedIntegrationPlanConfig {
  const config: DecisionSupportClarificationGatedIntegrationPlanConfig = {
    profile: "strict_clarification_gated_integration_plan",
    mode: overrides.mode ?? "plan_only",
    // These nine are never actually loosened here, regardless of what a caller's override object
    // claims — this is the integration plan's own strict, non-negotiable invariant.
    allowProductionWiring: false,
    allowRouterChange: false,
    allowComposerChange: false,
    allowEndpointChange: false,
    allowUserVisibleDecisionSupport: false,
    allowRealPersistence: false,
    allowDbWrite: false,
    allowSupabaseWrite: false,
    allowExternalCalls: false,
    requireClarificationGate: true,
    requireExistingRoutePreservation: true,
    requireUnsupportedPreservation: true,
    requireShadowReplayClean: true,
    requireSafeResponseDryRunBeforeVisibility: true,
  };
  if (overrides.now !== undefined) config.now = overrides.now;
  if (overrides.notes !== undefined) config.notes = [...overrides.notes];
  return config;
}

// ─── Action policies ────────────────────────────────────────────────────────────────────

type ActionPolicySeed = {
  actionName: string;
  stage: DecisionSupportClarificationGatedIntegrationStage;
  allowedInSprint31: boolean;
  futureOnly: boolean;
  prohibitedInSprint31: boolean;
  requiresClarificationGate: boolean;
  requiresUserVisibleDryRun: boolean;
  requiresProductionReview: boolean;
  reason: string;
};

const ACTION_POLICY_SEEDS: ActionPolicySeed[] = [
  {
    actionName: "classifierDetectsDecisionSupportBoundary",
    stage: "classifier_detection",
    allowedInSprint31: true,
    futureOnly: false,
    prohibitedInSprint31: false,
    requiresClarificationGate: true,
    requiresUserVisibleDryRun: false,
    requiresProductionReview: false,
    reason: "Detecting that a message falls in the decision_support/needs_clarification boundary is pure classification — the Sprint 18R/21R corpora already exercise this offline, and it produces no visible output on its own.",
  },
  {
    actionName: "routeToClarificationGate",
    stage: "clarification_gate",
    allowedInSprint31: true,
    futureOnly: false,
    prohibitedInSprint31: false,
    requiresClarificationGate: true,
    requiresUserVisibleDryRun: false,
    requiresProductionReview: false,
    reason: "Routing a detected candidate into the clarification gate (rather than directly to a decision answer) is the entire point of this plan — it can be simulated offline using the existing Sprint 22R clarification response strategy.",
  },
  {
    actionName: "generateDecisionSupportCandidate",
    stage: "decision_support_candidate",
    allowedInSprint31: true,
    futureOnly: false,
    prohibitedInSprint31: false,
    requiresClarificationGate: true,
    requiresUserVisibleDryRun: true,
    requiresProductionReview: false,
    reason: "Generating a decision_support candidate (via the existing, isolated Sprint 19R candidate handler) is safe offline evidence-gathering, but the candidate must never be shown to a user until a Sprint 32R user-visible dry run reviews it.",
  },
  {
    actionName: "composeUserVisibleDecisionSupportResponse",
    stage: "safe_response_draft",
    allowedInSprint31: false,
    futureOnly: true,
    prohibitedInSprint31: true,
    requiresClarificationGate: true,
    requiresUserVisibleDryRun: true,
    requiresProductionReview: true,
    reason: "Composing a response the user would actually see requires the Sprint 32R Response QA / user-visible dry run plan first — Sprint 31R only plans for it, it never drafts user-facing text for real.",
  },
  {
    actionName: "wireRouterToDecisionSupport",
    stage: "production_wiring",
    allowedInSprint31: false,
    futureOnly: true,
    prohibitedInSprint31: true,
    requiresClarificationGate: true,
    requiresUserVisibleDryRun: true,
    requiresProductionReview: true,
    reason: "brainRouter.ts is production code — wiring it to decision_support is explicitly out of scope until every prior gate (clarification, dry run, production review) has passed.",
  },
  {
    actionName: "wireComposerToDecisionSupport",
    stage: "production_wiring",
    allowedInSprint31: false,
    futureOnly: true,
    prohibitedInSprint31: true,
    requiresClarificationGate: true,
    requiresUserVisibleDryRun: true,
    requiresProductionReview: true,
    reason: "responseComposer.ts is production code — the same production-review bar applies as for the router.",
  },
  {
    actionName: "enableProductionFeatureFlag",
    stage: "production_wiring",
    allowedInSprint31: false,
    futureOnly: true,
    prohibitedInSprint31: true,
    requiresClarificationGate: true,
    requiresUserVisibleDryRun: true,
    requiresProductionReview: true,
    reason: "No production feature flag exists for decision_support, and none is created by this plan — flipping one on is a production activation decision, not a planning decision.",
  },
  {
    actionName: "persistDecisionSupportShadowOutput",
    stage: "production_wiring",
    allowedInSprint31: false,
    futureOnly: true,
    prohibitedInSprint31: true,
    requiresClarificationGate: false,
    requiresUserVisibleDryRun: false,
    requiresProductionReview: true,
    reason: "Sprint 29R already found tenant isolation, access control, retention, and audit all missing — real persistence stays blocked independent of clarification gating or user-visible dry-run readiness.",
  },
  {
    actionName: "executeDecisionSupportAction",
    stage: "production_wiring",
    allowedInSprint31: false,
    futureOnly: true,
    prohibitedInSprint31: true,
    requiresClarificationGate: true,
    requiresUserVisibleDryRun: true,
    requiresProductionReview: true,
    reason: "decision_support never executes an action, real or simulated, for any input in this corpus (shouldExecuteAction is false for every Sprint 18R case) — this remains true for every sprint in this tree, including this one.",
  },
];

function statusFor(seed: ActionPolicySeed): DecisionSupportClarificationGatedIntegrationActionStatus {
  if (seed.allowedInSprint31) return "allowed_in_plan";
  if (seed.futureOnly) return "future_only";
  if (seed.prohibitedInSprint31) return "prohibited";
  return "blocked";
}

/** Returns a fresh copy of every Sprint 31R integration action policy. */
export function listDecisionSupportClarificationGatedIntegrationActionPolicies(): DecisionSupportClarificationGatedIntegrationActionPolicy[] {
  return ACTION_POLICY_SEEDS.map((seed) => ({
    actionName: seed.actionName,
    stage: seed.stage,
    status: statusFor(seed),
    allowedInSprint31: seed.allowedInSprint31,
    futureOnly: seed.futureOnly,
    prohibitedInSprint31: seed.prohibitedInSprint31,
    requiresClarificationGate: seed.requiresClarificationGate,
    requiresUserVisibleDryRun: seed.requiresUserVisibleDryRun,
    requiresProductionReview: seed.requiresProductionReview,
    reason: seed.reason,
  }));
}

// ─── Allowed / prohibited actions ────────────────────────────────────────────────────

const ALLOWED_NEXT_ACTIONS: string[] = [
  "Plan a user-visible dry run for decision_support responses (Sprint 32R).",
  "Design a Decision Support Response QA plan for Sprint 32R.",
  "Review the clarification-gated route contract for every case category.",
  "Evaluate a safe response draft before any user-visible output.",
  "Review route preservation for existing_route_preserved and unsupported_preserved cases.",
  "Continue controlled shadow replay if any gate or route contract gap is found.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Wire decision_support into production (production wiring).",
  "Make a router change to route decision_support live.",
  "Make a composer change to render decision_support output.",
  "Make an endpoint change to accept decision_support requests.",
  "Show user-visible decision support output to any user.",
  "Implement real persistence for decision_support shadow data.",
  "Perform a real DB write.",
  "Perform a real Supabase write.",
  "Create a migration file.",
  "Create a SQL file.",
  "Enable a production feature flag.",
  "Implement a real repository.",
  "Implement a real storage adapter.",
  "Execute any action for real (action execution).",
  "Create a real email, task, or draft (email/task/draft creation).",
];

/** Returns a fresh copy of every action this sprint allows next. */
export function listDecisionSupportClarificationGatedIntegrationAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportClarificationGatedIntegrationProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Route contracts ────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedRouteContractOptions = {
  inputCategory?: string;
};

const CLARIFICATION_GATED_REQUIRED_GATE_TYPES: DecisionSupportClarificationGateType[] = [
  "must_clarify_before_decision",
  "must_confirm_context",
  "must_confirm_missing_slots",
  "must_not_show_decision_output",
];

const EXISTING_ROUTE_REQUIRED_GATE_TYPES: DecisionSupportClarificationGateType[] = [
  "must_preserve_existing_route",
  "must_not_show_decision_output",
];

const UNSUPPORTED_REQUIRED_GATE_TYPES: DecisionSupportClarificationGateType[] = [
  "must_keep_unsupported",
  "must_not_show_decision_output",
];

const SHADOW_ONLY_REQUIRED_GATE_TYPES: DecisionSupportClarificationGateType[] = [
  "must_remain_shadow_only",
  "must_not_show_decision_output",
];

const CLARIFICATION_GATED_PROHIBITED_BEHAVIORS: string[] = [
  "Show a direct decision answer to the user without clarification.",
  "Execute any action for real.",
  "Create a task.",
  "Create an email or draft.",
  "Persist any output for real.",
  "Wire the router to decision_support.",
  "Wire the composer to decision_support.",
  "Wire the endpoint to decision_support.",
];

const EXISTING_ROUTE_PROHIBITED_BEHAVIORS: string[] = [
  "Replace the existing production route with a decision_support route.",
  "Show any decision_support output for this case.",
  "Wire the router, composer, or endpoint to decision_support for this case.",
];

const UNSUPPORTED_PROHIBITED_BEHAVIORS: string[] = [
  "Route this case to decision_support.",
  "Show any decision_support output for this case.",
  "Wire the router, composer, or endpoint to decision_support for this case.",
];

const SHADOW_ONLY_PROHIBITED_BEHAVIORS: string[] = [
  "Recommend clarification-gated integration, existing-route preservation, or unsupported preservation for an unstable/unsafe case.",
  "Show any decision_support output for this case.",
  "Wire the router, composer, or endpoint to decision_support for this case.",
];

/**
 * Builds the Sprint 31R route contract for a given integration route kind. Every contract carries
 * `allowsDirectDecisionOutput: false` and `allowsProductionWiring: false` as literal types — no
 * route kind may ever show a decision answer directly or wire anything into production.
 */
export function createDecisionSupportClarificationGatedRouteContract(
  routeKind: DecisionSupportClarificationGatedIntegrationRouteKind,
  options: DecisionSupportClarificationGatedRouteContractOptions = {},
): DecisionSupportClarificationGatedRouteContract {
  const inputCategory = options.inputCategory ?? routeKind;

  switch (routeKind) {
    case "clarification_gated_decision_support":
      return {
        routeKind,
        inputCategory,
        preservesExistingRoute: false,
        preservesUnsupportedBehavior: false,
        requiresClarificationGate: true,
        allowsDirectDecisionOutput: false,
        allowsUserVisibleDryRun: true,
        allowsProductionWiring: false,
        requiredGateTypes: [...CLARIFICATION_GATED_REQUIRED_GATE_TYPES],
        prohibitedBehaviors: [...CLARIFICATION_GATED_PROHIBITED_BEHAVIORS],
        expectedNextStage: "user_visible_dry_run_plan",
        rationale: [
          "This case's replay route recommendation is clarification_gated_decision_support — it requires clarification before any decision answer.",
          "The existing Sprint 22R clarification response strategy already satisfies the clarification gate for this kind of case.",
          "A future decision_support candidate may only ever reach a user after a Sprint 32R user-visible dry run reviews it.",
        ],
      };
    case "existing_route_preserved":
      return {
        routeKind,
        inputCategory,
        preservesExistingRoute: true,
        preservesUnsupportedBehavior: false,
        requiresClarificationGate: false,
        allowsDirectDecisionOutput: false,
        allowsUserVisibleDryRun: false,
        allowsProductionWiring: false,
        requiredGateTypes: [...EXISTING_ROUTE_REQUIRED_GATE_TYPES],
        prohibitedBehaviors: [...EXISTING_ROUTE_PROHIBITED_BEHAVIORS],
        expectedNextStage: "preserve_existing_behavior",
        rationale: [
          "This case's replay route recommendation is keep_existing_route — an existing production route already serves it correctly.",
          "No clarification gate is required because decision_support never becomes a candidate for this case.",
        ],
      };
    case "unsupported_preserved":
      return {
        routeKind,
        inputCategory,
        preservesExistingRoute: false,
        preservesUnsupportedBehavior: true,
        requiresClarificationGate: false,
        allowsDirectDecisionOutput: false,
        allowsUserVisibleDryRun: false,
        allowsProductionWiring: false,
        requiredGateTypes: [...UNSUPPORTED_REQUIRED_GATE_TYPES],
        prohibitedBehaviors: [...UNSUPPORTED_PROHIBITED_BEHAVIORS],
        expectedNextStage: "preserve_unsupported_behavior",
        rationale: [
          "This case's replay route recommendation is keep_unsupported — the Sprint 10R safe fallback must keep handling it exactly as today.",
        ],
      };
    case "shadow_only":
    default:
      return {
        routeKind: "shadow_only",
        inputCategory,
        preservesExistingRoute: false,
        preservesUnsupportedBehavior: false,
        requiresClarificationGate: false,
        allowsDirectDecisionOutput: false,
        allowsUserVisibleDryRun: false,
        allowsProductionWiring: false,
        requiredGateTypes: [...SHADOW_ONLY_REQUIRED_GATE_TYPES],
        prohibitedBehaviors: [...SHADOW_ONLY_PROHIBITED_BEHAVIORS],
        expectedNextStage: "continue_shadow_only",
        rationale: [
          "This case's replay route recommendation is shadow_only (or unrecognized) — a replay that is not proven stable and safe must never be recommended for any stronger guarantee.",
        ],
      };
  }
}

// ─── Clarification gate requirements ─────────────────────────────────────────────────────

export type DecisionSupportClarificationGateRequirementsOptions = Record<string, never>;

type GateSeed = {
  gateType: DecisionSupportClarificationGateType;
  status: DecisionSupportClarificationGateStatus;
  severity: DecisionSupportClarificationGateSeverity;
  missingSlotsRequired: boolean;
  contextConfirmationRequired: boolean;
  userConfirmationRequired: boolean;
  blocksDirectDecisionOutput: boolean;
  evidence: string[];
  recommendation: string;
};

const CLARIFICATION_GATED_GATE_SEEDS: GateSeed[] = [
  {
    gateType: "must_clarify_before_decision",
    status: "satisfied_by_existing_clarification_strategy",
    severity: "blocking",
    missingSlotsRequired: true,
    contextConfirmationRequired: true,
    userConfirmationRequired: true,
    blocksDirectDecisionOutput: true,
    evidence: [
      "handleClarificationResponseCandidate() (Sprint 22R) already produces a primary question plus route options for every clarification-shaped case.",
    ],
    recommendation: "Route this case through the existing Sprint 22R clarification response strategy before any decision output.",
  },
  {
    gateType: "must_confirm_context",
    status: "satisfied_by_existing_clarification_strategy",
    severity: "blocking",
    missingSlotsRequired: false,
    contextConfirmationRequired: true,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: [
      "inferMissingSlots()/inferSuggestedRouteOptions() (Sprint 22R) already infer available context and flag what is missing.",
    ],
    recommendation: "Confirm project/source context via the existing clarification strategy before generating a decision_support candidate.",
  },
  {
    gateType: "must_confirm_missing_slots",
    status: "satisfied_by_existing_clarification_strategy",
    severity: "blocking",
    missingSlotsRequired: true,
    contextConfirmationRequired: false,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: [
      "ClarificationMissingSlot enumeration (Sprint 22R) already covers project/intent/source_context/desired_output/decision_options and more.",
    ],
    recommendation: "Ask for every missing slot the Sprint 22R strategy identifies before considering a decision answer complete.",
  },
  {
    gateType: "must_not_show_decision_output",
    status: "required",
    severity: "critical",
    missingSlotsRequired: false,
    contextConfirmationRequired: false,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: [
      "No route guard exists yet in front of decision_support output — this gate remains required, not yet satisfied, until Sprint 32R builds one.",
    ],
    recommendation: "Do not show any decision_support output to a user until a Sprint 32R route guard exists and a user-visible dry run has reviewed it.",
  },
];

const EXISTING_ROUTE_GATE_SEEDS: GateSeed[] = [
  {
    gateType: "must_preserve_existing_route",
    status: "required",
    severity: "blocking",
    missingSlotsRequired: false,
    contextConfirmationRequired: false,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: ["The Sprint 30R replay classified this case as existing_route_preserved — an existing production route already handles it."],
    recommendation: "Leave the existing production route untouched for this case; decision_support must never intercept it.",
  },
  {
    gateType: "must_not_show_decision_output",
    status: "required",
    severity: "critical",
    missingSlotsRequired: false,
    contextConfirmationRequired: false,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: ["decision_support is never a candidate for this case — there is no decision output to show."],
    recommendation: "Confirm no decision_support output path exists for this case, now or in any future integration.",
  },
];

const UNSUPPORTED_GATE_SEEDS: GateSeed[] = [
  {
    gateType: "must_keep_unsupported",
    status: "required",
    severity: "blocking",
    missingSlotsRequired: false,
    contextConfirmationRequired: false,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: ["The Sprint 30R replay classified this case as unsupported_or_not_applicable — the Sprint 10R safe fallback already handles it."],
    recommendation: "Keep this case mapped to the Sprint 10R unsupported safe fallback; do not route it to decision_support.",
  },
  {
    gateType: "must_not_show_decision_output",
    status: "required",
    severity: "critical",
    missingSlotsRequired: false,
    contextConfirmationRequired: false,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: ["decision_support is never a candidate for this case — there is no decision output to show."],
    recommendation: "Confirm no decision_support output path exists for this case, now or in any future integration.",
  },
];

const SHADOW_ONLY_GATE_SEEDS: GateSeed[] = [
  {
    gateType: "must_remain_shadow_only",
    status: "required",
    severity: "blocking",
    missingSlotsRequired: false,
    contextConfirmationRequired: false,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: ["The Sprint 30R replay could not prove this case stable and safe — shadow_only overrides every other route recommendation."],
    recommendation: "Keep replaying this case in shadow mode until it is proven stable and safe before assigning it any stronger route kind.",
  },
  {
    gateType: "must_not_show_decision_output",
    status: "required",
    severity: "critical",
    missingSlotsRequired: false,
    contextConfirmationRequired: false,
    userConfirmationRequired: false,
    blocksDirectDecisionOutput: true,
    evidence: ["An unstable/unsafe replay must never produce user-visible output."],
    recommendation: "Confirm no decision_support output path exists for this case while it remains shadow-only.",
  },
];

function gateSeedsFor(routeKind: DecisionSupportClarificationGatedIntegrationRouteKind): GateSeed[] {
  switch (routeKind) {
    case "clarification_gated_decision_support":
      return CLARIFICATION_GATED_GATE_SEEDS;
    case "existing_route_preserved":
      return EXISTING_ROUTE_GATE_SEEDS;
    case "unsupported_preserved":
      return UNSUPPORTED_GATE_SEEDS;
    case "shadow_only":
    default:
      return SHADOW_ONLY_GATE_SEEDS;
  }
}

/**
 * Builds the Sprint 31R clarification gate requirements for a given integration route kind:
 * `clarification_gated_decision_support` gets 4 gates (`must_clarify_before_decision`,
 * `must_confirm_context`, `must_confirm_missing_slots`, `must_not_show_decision_output`); every other
 * route kind gets its own 2 gates, always including `must_not_show_decision_output`.
 */
export function createDecisionSupportClarificationGateRequirements(
  routeKind: DecisionSupportClarificationGatedIntegrationRouteKind,
  _options: DecisionSupportClarificationGateRequirementsOptions = {},
): DecisionSupportClarificationGateRequirement[] {
  return gateSeedsFor(routeKind).map((seed) => ({
    gateId: `${routeKind}__${seed.gateType}`,
    gateType: seed.gateType,
    status: seed.status,
    severity: seed.severity,
    appliesToRouteKind: routeKind,
    missingSlotsRequired: seed.missingSlotsRequired,
    contextConfirmationRequired: seed.contextConfirmationRequired,
    userConfirmationRequired: seed.userConfirmationRequired,
    blocksDirectDecisionOutput: seed.blocksDirectDecisionOutput,
    evidence: [...seed.evidence],
    recommendation: seed.recommendation,
  }));
}

// ─── Classification ─────────────────────────────────────────────────────────────────────

/**
 * Classifies a Sprint 30R controlled replay aggregate (or pass result) into one of the four Sprint
 * 31R integration route kinds, from its already-computed `routeRecommendation`:
 * `clarification_gated_decision_support` -> `clarification_gated_decision_support`; `keep_existing_route`
 * -> `existing_route_preserved`; `keep_unsupported` -> `unsupported_preserved`; anything else
 * (`shadow_only`, `needs_more_replay`, or an unrecognized value) -> `shadow_only`, the safe fallback.
 * Pure — never re-runs the replay itself.
 */
export function classifyDecisionSupportClarificationGatedRouteKind(
  replayAggregateOrCase: DecisionSupportClarificationGatedIntegrationSourceCase,
): DecisionSupportClarificationGatedIntegrationRouteKind {
  switch (replayAggregateOrCase.routeRecommendation) {
    case "clarification_gated_decision_support":
      return "clarification_gated_decision_support";
    case "keep_existing_route":
      return "existing_route_preserved";
    case "keep_unsupported":
      return "unsupported_preserved";
    case "shadow_only":
    case "needs_more_replay":
    default:
      return "shadow_only";
  }
}

// ─── Case assessment ──────────────────────────────────────────────────────────────────────

export type DecisionSupportClarificationGatedIntegrationCaseAssessmentOptions = Record<string, never>;

function hasAllRequiredGateTypes(
  gateRequirements: DecisionSupportClarificationGateRequirement[],
  requiredGateTypes: DecisionSupportClarificationGateType[],
): boolean {
  const presentTypes = new Set(gateRequirements.map((g) => g.gateType));
  return requiredGateTypes.every((gateType) => presentTypes.has(gateType));
}

function anyGateMissingOrBlocked(gateRequirements: DecisionSupportClarificationGateRequirement[]): boolean {
  return gateRequirements.some((g) => g.status === "missing" || g.status === "blocked");
}

/**
 * Assesses a single Sprint 30R controlled replay aggregate (or pass result) for the Sprint 31R
 * integration plan: classifies its route kind, builds its route contract and gate requirements, and
 * decides `gateReady`/`safeForIntegrationPlan`/`safeForUserVisibleDryRun` (always `safeForProduction:
 * false`, always `directDecisionOutputBlocked: true`). Per route kind:
 *
 * - `clarification_gated_decision_support`: `gateReady` true only if all 4 required gate types are
 *   present and none is `missing`/`blocked`; `safeForIntegrationPlan`/`safeForUserVisibleDryRun` true.
 * - `existing_route_preserved`: `gateReady` false (no clarification gate applies — nothing to be
 *   "ready" for); `safeForIntegrationPlan`/`safeForUserVisibleDryRun` true; `shouldPreserveExistingRoute` true.
 * - `unsupported_preserved`: `gateReady` false; `safeForIntegrationPlan` true, `safeForUserVisibleDryRun`
 *   false (nothing to show — decision_support is never a candidate); `shouldPreserveUnsupported` true.
 * - `shadow_only`: `gateReady` false; `safeForIntegrationPlan` true (as shadow-only-safe, i.e. safe to
 *   *plan* for, not to expose), `safeForUserVisibleDryRun` false; `shouldRemainShadowOnly` true.
 */
export function assessDecisionSupportClarificationGatedIntegrationCase(
  replayAggregateOrCase: DecisionSupportClarificationGatedIntegrationSourceCase,
  _options: DecisionSupportClarificationGatedIntegrationCaseAssessmentOptions = {},
): DecisionSupportClarificationGatedIntegrationCaseAssessment {
  const routeKind = classifyDecisionSupportClarificationGatedRouteKind(replayAggregateOrCase);
  const routeContract = createDecisionSupportClarificationGatedRouteContract(routeKind, {
    inputCategory: replayAggregateOrCase.category,
  });
  const gateRequirements = createDecisionSupportClarificationGateRequirements(routeKind);

  const warnings: string[] = [];
  if (anyGateMissingOrBlocked(gateRequirements)) {
    warnings.push(`Case ${replayAggregateOrCase.caseId}: at least one clarification gate is missing or blocked.`);
  }

  let gateReady = false;
  let safeForIntegrationPlan = true;
  let safeForUserVisibleDryRun = false;
  let shouldPreserveExistingRoute = false;
  let shouldPreserveUnsupported = false;
  let shouldRemainShadowOnly = false;
  let shouldUseClarificationGate = false;

  switch (routeKind) {
    case "clarification_gated_decision_support":
      gateReady = hasAllRequiredGateTypes(gateRequirements, routeContract.requiredGateTypes) && !anyGateMissingOrBlocked(gateRequirements);
      safeForUserVisibleDryRun = true;
      shouldUseClarificationGate = true;
      if (!gateReady) warnings.push(`Case ${replayAggregateOrCase.caseId}: clarification gate is not yet ready.`);
      break;
    case "existing_route_preserved":
      safeForUserVisibleDryRun = true;
      shouldPreserveExistingRoute = true;
      break;
    case "unsupported_preserved":
      safeForUserVisibleDryRun = false;
      shouldPreserveUnsupported = true;
      break;
    case "shadow_only":
    default:
      safeForUserVisibleDryRun = false;
      shouldRemainShadowOnly = true;
      warnings.push(`Case ${replayAggregateOrCase.caseId}: replay did not recommend a route stronger than shadow_only.`);
      break;
  }

  return {
    caseId: replayAggregateOrCase.caseId,
    sourceCategory: replayAggregateOrCase.category ?? "unknown",
    replayRouteRecommendation: replayAggregateOrCase.routeRecommendation,
    routeKind,
    routeContract,
    gateRequirements,
    gateReady,
    safeForIntegrationPlan,
    safeForUserVisibleDryRun,
    safeForProduction: false,
    shouldPreserveExistingRoute,
    shouldPreserveUnsupported,
    shouldRemainShadowOnly,
    shouldUseClarificationGate,
    directDecisionOutputBlocked: true,
    warnings,
  } satisfies DecisionSupportClarificationGatedIntegrationCaseAssessment;
}

// ─── Default synthetic corpus ─────────────────────────────────────────────────────────

/**
 * A minimal, self-contained synthetic corpus — not imported from `tests/fixtures/`, mirroring how
 * Sprint 29R/30R's own default corpora never depend on a test fixture. Callers who want the full
 * Sprint 18R corpus's documented numbers pass `DECISION_CLARIFICATION_CASES` explicitly.
 */
const DEFAULT_SYNTHETIC_CORPUS: DecisionClarificationCase[] = [
  {
    id: "cgip-synthetic-01",
    input: "Deberiamos elegir Kafka o SQS para el bus de eventos del producto?",
    architectureCategory: "decision_support_clear",
    desiredFutureRoute: "decision_support",
    currentSafeMappedIntent: "unsupported",
    targetKind: "future_architecture",
    rationale: "A synthetic default-corpus case, used only when no corpus is supplied to the integration plan functions.",
    riskLevel: "medium",
    requiresNewHandler: true,
    requiresClarification: false,
    shouldExecuteAction: false,
  },
  {
    id: "cgip-synthetic-02",
    input: "no tengo claro cual alternativa conviene mas aca",
    architectureCategory: "clarification_clear",
    desiredFutureRoute: "needs_clarification",
    currentSafeMappedIntent: "general_pm_advice",
    targetKind: "clarification_strategy",
    rationale: "A second synthetic default-corpus case, used only when no corpus is supplied.",
    riskLevel: "medium",
    requiresNewHandler: false,
    requiresClarification: true,
    shouldExecuteAction: false,
  },
  {
    id: "cgip-synthetic-03",
    input: "cual es el estado actual del proyecto Orion?",
    architectureCategory: "existing_route_should_win",
    desiredFutureRoute: "project_status_question",
    currentSafeMappedIntent: "project_status_question",
    targetKind: "existing_production_route",
    rationale: "A synthetic existing-route-preserved case, used only when no corpus is supplied.",
    riskLevel: "low",
    requiresNewHandler: false,
    requiresClarification: false,
    shouldExecuteAction: false,
  },
];

// ─── Build plan ─────────────────────────────────────────────────────────────────────────

function hasRouteContractGap(assessment: DecisionSupportClarificationGatedIntegrationCaseAssessment): boolean {
  const { routeKind, routeContract } = assessment;
  if (routeContract.allowsDirectDecisionOutput !== false) return true;
  if (routeContract.allowsProductionWiring !== false) return true;
  if (routeKind === "clarification_gated_decision_support" && !routeContract.requiresClarificationGate) return true;
  if (routeKind === "existing_route_preserved" && !routeContract.preservesExistingRoute) return true;
  if (routeKind === "unsupported_preserved" && !routeContract.preservesUnsupportedBehavior) return true;
  return false;
}

/**
 * Runs the full Sprint 31R clarification-gated integration plan: reuses the Sprint 30R controlled
 * shadow replay evaluation, the Sprint 29R persistence readiness review, and the Sprint 22R
 * clarification response evaluation (plus the Sprint 25R-28R layer evaluations) against the same
 * corpus (default: a small self-contained synthetic corpus — pass `DECISION_CLARIFICATION_CASES` for
 * the full Sprint 18R corpus), assesses every replayed case, and consolidates the Sprint 31R action
 * policies and allowed/prohibited actions. Never executes a production action, writes anything real,
 * or touches the router, composer, or endpoint.
 */
export function buildDecisionSupportClarificationGatedIntegrationPlan(
  options: DecisionSupportClarificationGatedIntegrationPlanOptions = {},
): DecisionSupportClarificationGatedIntegrationPlanResult {
  const config = createDecisionSupportClarificationGatedIntegrationPlanConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;
  const cases = options.cases ?? DEFAULT_SYNTHETIC_CORPUS;

  // 1-2. Sprint 30R controlled shadow replay evaluation (reused, not re-derived).
  const replayEvaluation = runDecisionSupportShadowControlledReplayEvaluation(cases, { now });
  const replaySummary = summarizeDecisionSupportShadowControlledReplayEvaluation(replayEvaluation);

  // 3. Sprint 29R persistence readiness review (reused, not re-derived), against the same corpus.
  const persistenceReadinessInputMetrics = createDecisionSupportShadowPersistenceReadinessInputMetrics(cases, { now });
  const persistenceReadinessReview = buildDecisionSupportShadowPersistenceReadinessReview({ now, inputMetrics: persistenceReadinessInputMetrics });
  const persistenceReadinessSummary = summarizeDecisionSupportShadowPersistenceReadinessReview(persistenceReadinessReview);

  // Sprint 25R-28R layer evaluations (reused, not re-derived), against the same corpus — evidence
  // that every layer this plan depends on is still clean.
  const captureHarnessResults = runDecisionSupportShadowCaptureHarnessEvaluation(cases, { now, context: { mode: "dry_run" } });
  const captureHarnessEvaluationSummary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(captureHarnessResults);

  const storagePolicyResults = runDecisionSupportShadowStoragePolicyEvaluation(cases, { now });
  const storagePolicyEvaluationSummary = summarizeDecisionSupportShadowStoragePolicyEvaluation(storagePolicyResults);

  const adapterPlanResults = runDecisionSupportShadowStorageAdapterPlanEvaluation(cases, { now });
  const storageAdapterPlanEvaluationSummary = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(adapterPlanResults);

  const fakeAdapterResult = runDecisionSupportShadowStorageFakeAdapterEvaluation(cases, { now });
  const fakeAdapterEvaluationSummary = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(fakeAdapterResult);

  // Sprint 22R clarification response evaluation (reused, not re-derived) — evidence that the
  // clarification gate this plan relies on is backed by an existing, already-tested strategy.
  const clarificationResults = runClarificationResponseEvaluation(toDecisionClarificationEvaluationCases(cases), { now });
  const clarificationResponseEvaluationSummary = summarizeClarificationResponseEvaluation(clarificationResults);

  // 4-5. Assess every replayed case.
  const assessments = replayEvaluation.aggregates.map((aggregate) => assessDecisionSupportClarificationGatedIntegrationCase(aggregate));

  // 6-7. Action policies + consolidated allowed/prohibited actions.
  const actionPolicies = listDecisionSupportClarificationGatedIntegrationActionPolicies();
  const allowedNextActions = listDecisionSupportClarificationGatedIntegrationAllowedNextActions();
  const prohibitedActions = listDecisionSupportClarificationGatedIntegrationProhibitedActions();

  const warnings: string[] = [];
  if (replaySummary.decision !== "ready_for_clarification_gated_integration_plan") {
    warnings.push(
      `Sprint 30R controlled replay decision is "${replaySummary.decision}", not "ready_for_clarification_gated_integration_plan" — this plan cannot recommend Sprint 32R until that is resolved.`,
    );
  }
  if (persistenceReadinessSummary.decision === "blocked_by_safety_or_policy_gap") {
    warnings.push("Sprint 29R persistence readiness review is blocked_by_safety_or_policy_gap — a regression from its documented baseline.");
  }
  for (const assessment of assessments) warnings.push(...assessment.warnings);

  return {
    config,
    replayEvaluation,
    replaySummary,
    persistenceReadinessSummary,
    fakeAdapterEvaluationSummary,
    storageAdapterPlanEvaluationSummary,
    storagePolicyEvaluationSummary,
    captureHarnessEvaluationSummary,
    clarificationResponseEvaluationSummary,
    assessments,
    actionPolicies,
    allowedNextActions,
    prohibitedActions,
    warnings,
  } satisfies DecisionSupportClarificationGatedIntegrationPlanResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

const REPRESENTATIVE_LIMIT = 8;

function computeDecision(fields: {
  totalCases: number;
  gateMissingCaseCount: number;
  routeContractGapCount: number;
  safeForIntegrationPlanCount: number;
  directDecisionOutputBlockedCount: number;
  safeForProductionCount: number;
  productionWiringAttemptedCount: number;
  routerChangeAttemptedCount: number;
  composerChangeAttemptedCount: number;
  endpointChangeAttemptedCount: number;
  userVisibleDecisionSupportAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  sprint30ReplayDecision: DecisionSupportShadowControlledReplayDecision | undefined;
}): DecisionSupportClarificationGatedIntegrationPlanDecision {
  if (fields.gateMissingCaseCount > 0) return "blocked_by_missing_clarification_gate";
  if (fields.routeContractGapCount > 0) return "blocked_by_route_contract_gap";

  const anyProductionOrWiringAttempted =
    fields.productionWiringAttemptedCount > 0 ||
    fields.routerChangeAttemptedCount > 0 ||
    fields.composerChangeAttemptedCount > 0 ||
    fields.endpointChangeAttemptedCount > 0 ||
    fields.userVisibleDecisionSupportAttemptedCount > 0 ||
    fields.realPersistenceAttemptedCount > 0 ||
    fields.dbWriteAttemptedCount > 0 ||
    fields.supabaseWriteAttemptedCount > 0 ||
    fields.externalCallAttemptedCount > 0;
  if (anyProductionOrWiringAttempted) return "blocked_by_production_wiring_risk";

  if (fields.safeForProductionCount > 0 || fields.sprint30ReplayDecision === "blocked_by_safety_regression") {
    return "blocked_by_safety_regression";
  }

  const allClean =
    fields.totalCases > 0 &&
    fields.safeForIntegrationPlanCount === fields.totalCases &&
    fields.directDecisionOutputBlockedCount === fields.totalCases &&
    fields.safeForProductionCount === 0 &&
    fields.sprint30ReplayDecision === "ready_for_clarification_gated_integration_plan";

  return allClean ? "ready_for_user_visible_dry_run_plan" : "continue_shadow_only";
}

function recommendedNextSprintFor(decision: DecisionSupportClarificationGatedIntegrationPlanDecision): string {
  switch (decision) {
    case "ready_for_user_visible_dry_run_plan":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_missing_clarification_gate":
      return "Sprint 31R — Clarification-Gated Decision Support Integration Plan (Clarification Gate Hardening)";
    case "blocked_by_route_contract_gap":
      return "Sprint 31R — Clarification-Gated Decision Support Integration Plan (Route Contract Hardening)";
    case "blocked_by_safety_regression":
      return "Sprint 31R — Clarification-Gated Decision Support Integration Plan (Safety Regression Hardening)";
    case "blocked_by_production_wiring_risk":
      return "Sprint 31R — Clarification-Gated Decision Support Integration Plan (Production Wiring Risk Hardening)";
    case "continue_shadow_only":
    default:
      return `${RECOMMENDED_NEXT_SPRINT_THIS_SPRINT} (continue)`;
  }
}

/**
 * Turns a `buildDecisionSupportClarificationGatedIntegrationPlan()` result — or a bare
 * `DecisionSupportClarificationGatedIntegrationCaseAssessment[]` plus
 * `options.sprint30ReplayDecision` — into a review-ready report: per-route-kind counts, gate
 * readiness, safety counts (every production-side-effect count expected zero), a decision, and a
 * recommended next sprint. Pure — takes an already-computed plan rather than re-running anything.
 */
export function summarizeDecisionSupportClarificationGatedIntegrationPlan(
  planOrAssessments: DecisionSupportClarificationGatedIntegrationPlanResult | DecisionSupportClarificationGatedIntegrationCaseAssessment[],
  options: DecisionSupportClarificationGatedIntegrationPlanSummaryOptions = {},
): DecisionSupportClarificationGatedIntegrationPlanSummary {
  const assessments = Array.isArray(planOrAssessments) ? planOrAssessments : planOrAssessments.assessments;
  const sprint30ReplayDecision = Array.isArray(planOrAssessments)
    ? options.sprint30ReplayDecision
    : (options.sprint30ReplayDecision ?? planOrAssessments.replaySummary.decision);
  const planWarnings = Array.isArray(planOrAssessments) ? [] : planOrAssessments.warnings;

  const totalCases = assessments.length;

  const clarificationGatedCases = assessments.filter((a) => a.routeKind === "clarification_gated_decision_support");
  const existingRouteCases = assessments.filter((a) => a.routeKind === "existing_route_preserved");
  const unsupportedCases = assessments.filter((a) => a.routeKind === "unsupported_preserved");
  const shadowOnlyCases = assessments.filter((a) => a.routeKind === "shadow_only");

  const clarificationGatedCaseCount = clarificationGatedCases.length;
  const existingRoutePreservedCaseCount = existingRouteCases.length;
  const unsupportedPreservedCaseCount = unsupportedCases.length;
  const shadowOnlyCaseCount = shadowOnlyCases.length;

  const gateReadyCaseCount = assessments.filter((a) => a.gateReady).length;
  const gateMissingCaseCount = assessments.filter((a) => a.gateRequirements.some((g) => g.status === "missing")).length;

  const safeForIntegrationPlanCount = assessments.filter((a) => a.safeForIntegrationPlan).length;
  const safeForUserVisibleDryRunCount = assessments.filter((a) => a.safeForUserVisibleDryRun).length;
  const safeForProductionCount = assessments.filter((a) => a.safeForProduction).length;
  const directDecisionOutputBlockedCount = assessments.filter((a) => a.directDecisionOutputBlocked).length;

  const routeContractGapCount = assessments.filter(hasRouteContractGap).length;

  const decision = computeDecision({
    totalCases,
    gateMissingCaseCount,
    routeContractGapCount,
    safeForIntegrationPlanCount,
    directDecisionOutputBlockedCount,
    safeForProductionCount,
    productionWiringAttemptedCount: 0,
    routerChangeAttemptedCount: 0,
    composerChangeAttemptedCount: 0,
    endpointChangeAttemptedCount: 0,
    userVisibleDecisionSupportAttemptedCount: 0,
    realPersistenceAttemptedCount: 0,
    dbWriteAttemptedCount: 0,
    supabaseWriteAttemptedCount: 0,
    externalCallAttemptedCount: 0,
    sprint30ReplayDecision,
  });

  const warnings = [...planWarnings, ...assessments.flatMap((a) => a.warnings)];

  return {
    totalCases,
    clarificationGatedCaseCount,
    existingRoutePreservedCaseCount,
    unsupportedPreservedCaseCount,
    shadowOnlyCaseCount,
    gateReadyCaseCount,
    gateMissingCaseCount,
    safeForIntegrationPlanCount,
    safeForUserVisibleDryRunCount,
    safeForProductionCount,
    directDecisionOutputBlockedCount,
    productionWiringAttemptedCount: 0,
    routerChangeAttemptedCount: 0,
    composerChangeAttemptedCount: 0,
    endpointChangeAttemptedCount: 0,
    userVisibleDecisionSupportAttemptedCount: 0,
    realPersistenceAttemptedCount: 0,
    dbWriteAttemptedCount: 0,
    supabaseWriteAttemptedCount: 0,
    externalCallAttemptedCount: 0,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeClarificationGatedCases: clarificationGatedCases.slice(0, REPRESENTATIVE_LIMIT),
    preservedExistingRouteCases: existingRouteCases,
    preservedUnsupportedCases: unsupportedCases,
    blockedCases: assessments.filter((a) => !a.safeForIntegrationPlan || a.routeKind === "shadow_only" || hasRouteContractGap(a)),
    warnings,
  } satisfies DecisionSupportClarificationGatedIntegrationPlanSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 31R clarification-gated decision support integration plan —
 * mirrors the style of `explainDecisionSupportShadowControlledReplayEvaluation()` (Sprint 30R). See
 * `docs/conversational-brain-decision-support-clarification-gated-integration-plan.md` for full context.
 */
export function explainDecisionSupportClarificationGatedIntegrationPlan(): DecisionSupportClarificationGatedIntegrationPlanExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-clarification-gated-integration-plan",
    purpose:
      "Plans how decision_support would eventually be integrated behind a clarification gate — which cases must pass through " +
      "clarification, which must preserve an existing route, which must stay unsupported, what would block any integration, what " +
      "contract a future gated adapter would need, and what must be simulated without touching router/composer/endpoint — without " +
      "implementing any real integration, without changing production, and without ever showing decision_support output to a user.",
    nonGoals: [
      "Implement real integration of decision_support into production.",
      "Change the router, composer, or endpoint.",
      "Activate decision_support in production.",
      "Show decision_support output to a user.",
      "Create a real feature flag, database, migration, SQL file, Supabase write, real repository, or real storage adapter.",
      "Execute any real action.",
    ],
    planProfile:
      'The "strict_clarification_gated_integration_plan" profile: allowProductionWiring/allowRouterChange/allowComposerChange/' +
      "allowEndpointChange/allowUserVisibleDecisionSupport/allowRealPersistence/allowDbWrite/allowSupabaseWrite/allowExternalCalls " +
      "are all literal false, forced regardless of any override a caller passes, and requireClarificationGate/" +
      "requireExistingRoutePreservation/requireUnsupportedPreservation/requireShadowReplayClean/" +
      "requireSafeResponseDryRunBeforeVisibility are always true.",
    planModes: [
      "plan_only (default): the full integration plan, covering every route kind.",
      "route_contract_review: emphasizes createDecisionSupportClarificationGatedRouteContract() output.",
      "clarification_gate_review: emphasizes createDecisionSupportClarificationGateRequirements() output.",
      "adapter_handoff_review: emphasizes the classifier -> clarification strategy -> decision support handoff.",
      "user_visible_dry_run_readiness_review: emphasizes safeForUserVisibleDryRun across every case.",
    ],
    actionPolicyRules: [
      "classifierDetectsDecisionSupportBoundary, routeToClarificationGate, and generateDecisionSupportCandidate are allowed in Sprint 31R (offline, no user-visible output).",
      "composeUserVisibleDecisionSupportResponse, wireRouterToDecisionSupport, wireComposerToDecisionSupport, enableProductionFeatureFlag, persistDecisionSupportShadowOutput, and executeDecisionSupportAction are all future-only and prohibited in Sprint 31R.",
    ],
    routeKindClassification: [
      "clarification_gated_decision_support -> replay routeRecommendation === clarification_gated_decision_support.",
      "existing_route_preserved -> replay routeRecommendation === keep_existing_route.",
      "unsupported_preserved -> replay routeRecommendation === keep_unsupported.",
      "shadow_only -> replay routeRecommendation === shadow_only, needs_more_replay, or any unrecognized value (safe fallback).",
    ],
    routeContractRules: [
      "Every route contract carries allowsDirectDecisionOutput: false and allowsProductionWiring: false — no route kind may ever show a decision answer directly or wire into production.",
      "clarification_gated_decision_support additionally allows a future user-visible dry run (allowsUserVisibleDryRun: true) once Sprint 32R reviews it.",
      "existing_route_preserved/unsupported_preserved/shadow_only never allow a user-visible dry run — decision_support is never a candidate for them.",
    ],
    gateRequirementRules: [
      "clarification_gated_decision_support requires 4 gates: must_clarify_before_decision, must_confirm_context, and must_confirm_missing_slots (all satisfied_by_existing_clarification_strategy, blocking), plus must_not_show_decision_output (required, critical).",
      "existing_route_preserved requires must_preserve_existing_route + must_not_show_decision_output.",
      "unsupported_preserved requires must_keep_unsupported + must_not_show_decision_output.",
      "shadow_only requires must_remain_shadow_only + must_not_show_decision_output.",
      "Every gate requirement blocks direct decision output (blocksDirectDecisionOutput: true).",
    ],
    caseAssessmentRules: [
      "gateReady is true only for clarification_gated_decision_support cases whose 4 required gate types are all present and none missing/blocked.",
      "safeForIntegrationPlan is true for every route kind — planning offline is always safe.",
      "safeForUserVisibleDryRun is true only for clarification_gated_decision_support and existing_route_preserved cases.",
      "safeForProduction is a literal false for every case, and directDecisionOutputBlocked is a literal true for every case.",
    ],
    decisionRule:
      "ready_for_user_visible_dry_run_plan requires: totalCases > 0, safeForIntegrationPlanCount === totalCases, " +
      "directDecisionOutputBlockedCount === totalCases, safeForProductionCount === 0, every production/wiring-attempted count at " +
      "zero, gateMissingCaseCount === 0, and the Sprint 30R replay decision === ready_for_clarification_gated_integration_plan. " +
      "Otherwise: blocked_by_missing_clarification_gate if any case's gate is missing; else blocked_by_route_contract_gap if any " +
      "route contract violates its own invariants; else blocked_by_production_wiring_risk if any production/wiring count is " +
      "nonzero; else blocked_by_safety_regression if any case is unexpectedly marked safe for production or the Sprint 30R replay " +
      "itself regressed on safety; else continue_shadow_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyRouterIsNotChanged:
      "brainRouter.ts is production code. This plan only simulates a future clarification-gated route offline — it never imports or modifies the router.",
    whyComposerIsNotChanged:
      "responseComposer.ts is production code. This plan never imports or modifies the composer — every response text stays confined to the Sprint 19R/22R candidate/strategy modules already isolated from production.",
    whyEndpointIsNotChanged:
      "POST /api/command-center/chat is production code. This plan never imports or modifies the endpoint or its handlers.",
    whyUserVisibleOutputIsNotShown:
      "Every case assessment carries directDecisionOutputBlocked: true and every route contract carries allowsDirectDecisionOutput: false — a Sprint 32R user-visible dry run must review any output before it could ever reach a real user.",
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review still resolves to do_not_build_real_persistence_yet — tenant isolation, access control, retention, audit, observability, rollback, security review, and DSR policy remain missing.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by planning an integration.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whyStorageAdapterIsNotCreated: "This plan reuses the existing Sprint 28R fake adapter's evaluation as evidence — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this plan does not build.",
    expectedSprint32Path:
      "If every case stays safeForIntegrationPlan/directDecisionOutputBlocked, no clarification gate is missing, no route contract " +
      "gap is found, no production/wiring action is attempted, and the Sprint 30R replay stays ready_for_clarification_gated_integration_plan, " +
      "Sprint 32R can design a Decision Support Response QA / User-Visible Dry Run Plan — still without wiring the router, without " +
      "wiring the composer, without activating a production feature flag, and without showing anything to a real user until that " +
      "dry run explicitly reviews it.",
  };
}
