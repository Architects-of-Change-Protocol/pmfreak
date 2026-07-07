/**
 * Sprint 24R — Decision Support Shadow Mode Prep.
 *
 * A pure, read-only, offline, deterministic contract for how a future `decision_support` shadow
 * mode would run under the Sprint 23R-recommended `hybrid_shadow_then_clarify` strategy: confident,
 * safe decision_support candidates go to a shadow (never-shown) candidate; everything else — low
 * confidence, missing options/evidence, or a clarification-desired message — goes to a shadow
 * clarification candidate instead; `existing_route_should_win` cases are always preserved untouched.
 *
 * This module prepares the *contract* for shadow mode. It does not activate shadow mode: every run
 * hard-codes `shouldReturnCandidateToUser: false`, `shouldPersistShadowResult: false`,
 * `shouldExecuteAction: false`, `shouldSendEmail: false`, `shouldCreateTask: false`, and
 * `shouldWriteToDb: false` — these are literal constants, never computed from caller input. A
 * caller that forces `featureFlagEnabled`, `allowUserVisibleOutput`, `allowPersistence`,
 * `allowExecution`, or `allowProductionRouteChange` to `true` does not enable anything: every
 * blocking safety gate fails, the run's status becomes `"blocked_by_safety_gate"`, and every side
 * effect stays `false`.
 *
 * Reuses, rather than reimplements: the Sprint 19R Decision Support Candidate Handler
 * (`handleDecisionSupportCandidate`), the Sprint 22R Clarification Response Strategy
 * (`handleClarificationResponseCandidate`), and the Sprint 23R Adapter Mapping Plan's
 * `hybrid_shadow_then_clarify` strategy shape (`runDecisionSupportAdapterMappingPlan`) against the
 * Sprint 18R corpus.
 *
 * Like every module in this package tree, this does not call the router, composer, or any
 * production handler; does not touch `POST /api/command-center/chat`; does not read/write a
 * database, call Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not
 * activate a feature flag; and does not connect `decision_support` to the router. See
 * `docs/conversational-brain-decision-support-shadow-mode-prep.md` for the full design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import { handleDecisionSupportCandidate } from "./decisionSupportCandidateHandler";
import type { DecisionSupportCandidateResult } from "./decisionSupportCandidateTypes";
import { handleClarificationResponseCandidate } from "../clarification/clarificationResponseStrategy";
import { normalizeClarificationInput } from "../clarification/clarificationResponseAnalyzer";
import type { ClarificationResponseCandidateResult } from "../clarification/clarificationResponseTypes";
import { runDecisionSupportAdapterMappingPlan } from "./decisionSupportAdapterMappingPlan";
import type { DecisionSupportAdapterMappingResult } from "./decisionSupportAdapterMappingPlanTypes";

import type {
  DecisionSupportShadowModeAuditMetadata,
  DecisionSupportShadowModeCandidateKind,
  DecisionSupportShadowModeContext,
  DecisionSupportShadowModeEvaluationResult,
  DecisionSupportShadowModeGate,
  DecisionSupportShadowModeGateResult,
  DecisionSupportShadowModeInput,
  DecisionSupportShadowModeNextSprintRecommendation,
  DecisionSupportShadowModePrepEvaluationOptions,
  DecisionSupportShadowModePrepEvaluationSummary,
  DecisionSupportShadowModePrepExplain,
  DecisionSupportShadowModeRun,
  DecisionSupportShadowModeStatus,
  DecisionSupportShadowModeStrategy,
} from "./decisionSupportShadowModePrepTypes";

export type {
  DecisionSupportShadowModeStrategy,
  DecisionSupportShadowModeStatus,
  DecisionSupportShadowModeCandidateKind,
  DecisionSupportShadowModeGate,
  DecisionSupportShadowModeGateSeverity,
  DecisionSupportShadowModeGateResult,
  DecisionSupportShadowModeInputSource,
  DecisionSupportShadowModeInput,
  DecisionSupportShadowModeContext,
  DecisionSupportShadowModeAuditMetadata,
  DecisionSupportShadowModeRun,
  DecisionSupportShadowModeEvaluationResult,
  DecisionSupportShadowModeNextSprintRecommendation,
  DecisionSupportShadowModePrepEvaluationOptions,
  DecisionSupportShadowModePrepEvaluationSummary,
  DecisionSupportShadowModePrepExplain,
} from "./decisionSupportShadowModePrepTypes";

export const DECISION_SUPPORT_SHADOW_MODE_PREP_VERSION = "24R.1.0";

const STRATEGY: DecisionSupportShadowModeStrategy = "hybrid_shadow_then_clarify";

// ─── Candidate safety (mirrors decisionSupportShadowMappingEvaluation.ts / decisionSupportAdapterMappingPlan.ts) ───

function evaluateDecisionCandidateSafety(result: DecisionSupportCandidateResult): boolean {
  if (result.kind !== "decision_support_candidate_result") return false;
  if (!result.decisionStatement || result.decisionStatement.trim().length === 0) return false;
  if (result.options.length < 1) return false;
  if (result.tradeoffs.length < 1) return false;
  if (result.risks.length < 1) return false;
  if (result.evidenceNeeded.length < 1) return false;
  if (!result.recommendation.recommendedPath || result.recommendation.recommendedPath.trim().length === 0) return false;
  if (!result.recommendation.suggestedNextStep || result.recommendation.suggestedNextStep.trim().length === 0) return false;

  const safety = result.safety;
  if (safety.shouldExecuteAction !== false) return false;
  if (safety.shouldCreateTask !== false) return false;
  if (safety.shouldSendEmail !== false) return false;
  if (safety.shouldWriteToDb !== false) return false;
  if (safety.requiresHumanConfirmation !== true) return false;
  if (safety.productionRoutingEnabled !== false) return false;

  return true;
}

function evaluateClarificationCandidateSafety(result: ClarificationResponseCandidateResult): boolean {
  if (result.kind !== "clarification_response_candidate_result") return false;
  if (result.responseText.trim().length === 0) return false;
  if (!result.primaryQuestion.question || result.primaryQuestion.question.trim().length === 0) return false;
  if (result.suggestedRouteOptions.length === 0) return false;
  if (result.secondaryQuestions.length > 3) return false;

  const safety = result.safety;
  if (safety.shouldExecuteAction !== false) return false;
  if (safety.shouldCreateTask !== false) return false;
  if (safety.shouldSendEmail !== false) return false;
  if (safety.shouldWriteToDb !== false) return false;
  if (safety.requiresUserReply !== true) return false;
  if (safety.productionRoutingEnabled !== false) return false;

  return true;
}

// ─── Candidate routing decision (hybrid_shadow_then_clarify) ────────────────────────

type CandidateDecision = {
  status: DecisionSupportShadowModeStatus;
  candidateKind: DecisionSupportShadowModeCandidateKind;
  decisionCandidate?: DecisionSupportCandidateResult;
  clarificationCandidate?: ClarificationResponseCandidateResult;
  isExistingRouteCase: boolean;
};

function isExistingRouteInput(input: DecisionSupportShadowModeInput): boolean {
  return input.targetKind === "existing_production_route" || input.architectureCategory === "existing_route_should_win";
}

function isClarificationDesiredInput(input: DecisionSupportShadowModeInput): boolean {
  return input.desiredFutureRoute === "needs_clarification" || Boolean(input.architectureCategory?.startsWith("clarification_"));
}

function buildClarificationCandidate(input: DecisionSupportShadowModeInput): ClarificationResponseCandidateResult {
  return handleClarificationResponseCandidate({
    input: input.input,
    projectId: input.projectId,
    projectName: input.projectName,
    conversationId: input.conversationId,
    source: "architecture_review",
    now: input.now,
  });
}

/**
 * Implements `hybrid_shadow_then_clarify` (Sprint 23R §"Why hybrid_shadow_then_clarify is
 * recommended"): existing routes are always preserved untouched; a decision_support-desired case
 * runs the Sprint 19R candidate handler and shadow-routes to it only when the result is safe and
 * confidence is medium/high, falling back to the Sprint 22R clarification strategy otherwise; a
 * clarification-desired case always uses the clarification strategy; everything else is
 * not_applicable. Never executes an action, never shows anything to a user.
 */
function decideCandidates(input: DecisionSupportShadowModeInput): CandidateDecision {
  const isExistingRouteCase = isExistingRouteInput(input);
  if (isExistingRouteCase) {
    return { status: "existing_route_preserved", candidateKind: "existing_route_preserved", isExistingRouteCase };
  }

  if (input.desiredFutureRoute === "decision_support") {
    const decisionCandidate = handleDecisionSupportCandidate({
      input: input.input,
      projectId: input.projectId,
      projectName: input.projectName,
      conversationId: input.conversationId,
      availableContext: input.availableContext,
      source: "architecture_review",
      now: input.now,
    });

    const safe = evaluateDecisionCandidateSafety(decisionCandidate);
    const confidence = decisionCandidate.recommendation.confidence;

    if (safe && (confidence === "medium" || confidence === "high")) {
      return { status: "shadow_candidate_generated", candidateKind: "decision_support_candidate", decisionCandidate, isExistingRouteCase };
    }

    const clarificationCandidate = buildClarificationCandidate(input);
    return {
      status: "clarification_candidate_generated",
      candidateKind: "clarification_response_candidate",
      decisionCandidate,
      clarificationCandidate,
      isExistingRouteCase,
    };
  }

  if (isClarificationDesiredInput(input)) {
    const clarificationCandidate = buildClarificationCandidate(input);
    return { status: "clarification_candidate_generated", candidateKind: "clarification_response_candidate", clarificationCandidate, isExistingRouteCase };
  }

  return { status: "not_applicable", candidateKind: "none", isExistingRouteCase };
}

// ─── Safety gates ─────────────────────────────────────────────────────────────────────

const BLOCKING_GATES = new Set<DecisionSupportShadowModeGate>([
  "default_off",
  "no_production_route",
  "no_user_visible_output",
  "no_persistence",
  "no_execution",
  "existing_route_preservation",
  "candidate_handler_safety",
  "clarification_safety",
]);

function confidenceGatePassed(candidateKind: DecisionSupportShadowModeCandidateKind, decisionCandidate?: DecisionSupportCandidateResult): boolean {
  if (!decisionCandidate) return true;
  const confidence = decisionCandidate.recommendation.confidence;
  if (confidence === "low") return candidateKind === "clarification_response_candidate";
  return candidateKind === "decision_support_candidate" || candidateKind === "clarification_response_candidate";
}

function computeGateResults(params: {
  context: DecisionSupportShadowModeContext;
  decision: CandidateDecision;
}): DecisionSupportShadowModeGateResult[] {
  const { context, decision } = params;
  const featureFlagEnabled = context.featureFlagEnabled === true;
  const allowProductionRouteChange = context.allowProductionRouteChange === true;
  const allowUserVisibleOutput = context.allowUserVisibleOutput === true;
  const allowPersistence = context.allowPersistence === true;
  const allowExecution = context.allowExecution === true;

  const existingRoutePreservationPassed =
    !decision.isExistingRouteCase ||
    (decision.candidateKind === "existing_route_preserved" && !decision.decisionCandidate && !decision.clarificationCandidate);

  const candidateHandlerSafetyPassed = !decision.decisionCandidate || evaluateDecisionCandidateSafety(decision.decisionCandidate);
  const clarificationSafetyPassed = !decision.clarificationCandidate || evaluateClarificationCandidateSafety(decision.clarificationCandidate);

  const gates: DecisionSupportShadowModeGateResult[] = [
    {
      gate: "default_off",
      passed: !featureFlagEnabled,
      reason: featureFlagEnabled
        ? "context.featureFlagEnabled was forced true — Sprint 24R never activates a real feature flag; this is treated as a safety violation."
        : "featureFlagEnabled is not true — shadow mode stays default-off, as designed.",
      severity: "blocking",
    },
    {
      gate: "no_production_route",
      passed: !allowProductionRouteChange,
      reason: allowProductionRouteChange
        ? "context.allowProductionRouteChange was forced true — this module never changes a production route."
        : "allowProductionRouteChange is not true — no production route is ever changed.",
      severity: "blocking",
    },
    {
      gate: "no_user_visible_output",
      passed: !allowUserVisibleOutput,
      reason: allowUserVisibleOutput
        ? "context.allowUserVisibleOutput was forced true — no candidate is ever shown to a user in this sprint."
        : "allowUserVisibleOutput is not true — no candidate is ever shown to a user.",
      severity: "blocking",
    },
    {
      gate: "no_persistence",
      passed: !allowPersistence,
      reason: allowPersistence
        ? "context.allowPersistence was forced true — no shadow output is ever persisted in this sprint."
        : "allowPersistence is not true — no shadow output is ever persisted.",
      severity: "blocking",
    },
    {
      gate: "no_execution",
      passed: !allowExecution,
      reason: allowExecution
        ? "context.allowExecution was forced true — no action, task, or email is ever executed in this sprint."
        : "allowExecution is not true — no action, task, or email is ever executed.",
      severity: "blocking",
    },
    {
      gate: "existing_route_preservation",
      passed: existingRoutePreservationPassed,
      reason: existingRoutePreservationPassed
        ? "existing_route_should_win cases never generate a decision or clarification candidate."
        : "An existing_route_should_win case unexpectedly generated a decision or clarification candidate.",
      severity: "blocking",
    },
    {
      gate: "candidate_handler_safety",
      passed: candidateHandlerSafetyPassed,
      reason: candidateHandlerSafetyPassed
        ? "No decision candidate was generated, or it passed every Sprint 19R/20R safety/structural check."
        : "The decision candidate failed one or more Sprint 19R/20R safety/structural checks.",
      severity: "blocking",
    },
    {
      gate: "clarification_safety",
      passed: clarificationSafetyPassed,
      reason: clarificationSafetyPassed
        ? "No clarification candidate was generated, or it passed every Sprint 22R safety/acceptability check."
        : "The clarification candidate failed one or more Sprint 22R safety/acceptability checks.",
      severity: "blocking",
    },
    {
      gate: "confidence_gate",
      passed: confidenceGatePassed(decision.candidateKind, decision.decisionCandidate),
      reason:
        "Medium/high-confidence decision_support candidates route to a shadow decision candidate; low-confidence " +
        "candidates route to a shadow clarification candidate instead.",
      severity: "warning",
    },
    {
      gate: "missing_context_gate",
      passed: true,
      reason: "No decision or clarification candidate is ever shown to the user in this sprint, regardless of confidence or missing context.",
      severity: "warning",
    },
    {
      gate: "adapter_unchanged",
      passed: true,
      reason: "This module does not import intentCompatibilityAdapter.ts.",
      severity: "info",
    },
    {
      gate: "router_unchanged",
      passed: true,
      reason: "This module does not import brainRouter.ts, responseComposer.ts, any handlers/*.ts, or conversationalBrainGateway.ts.",
      severity: "info",
    },
  ];

  return gates;
}

// ─── Prepare ──────────────────────────────────────────────────────────────────────────

function deterministicIdFrom(normalizedInput: string): string {
  return `shadow-${normalizedInput.replace(/\s+/g, "-").slice(0, 48)}`;
}

/**
 * Prepares a single Decision Support Shadow Mode run for `hybrid_shadow_then_clarify`: decides which
 * candidate (if any) would be generated, evaluates every safety gate, and — if any blocking gate
 * fails (including a caller forcing `featureFlagEnabled`/`allowUserVisibleOutput`/
 * `allowPersistence`/`allowExecution`/`allowProductionRouteChange` to `true`) — forces the run to
 * `"blocked_by_safety_gate"` with `candidateKind: "none"` and no candidate attached. Every side
 * effect field (`shouldReturnCandidateToUser`, `shouldPersistShadowResult`, `shouldExecuteAction`,
 * `shouldSendEmail`, `shouldCreateTask`, `shouldWriteToDb`) is a literal `false`, never computed from
 * caller input. Pure and deterministic — never calls fetch, a database, Supabase, Gmail, or an LLM.
 */
export function prepareDecisionSupportShadowModeRun(
  input: DecisionSupportShadowModeInput,
  context: DecisionSupportShadowModeContext = {},
): DecisionSupportShadowModeRun {
  if (!input || typeof input.input !== "string" || input.input.trim().length === 0) {
    throw new Error("prepareDecisionSupportShadowModeRun: input.input must be a non-empty string.");
  }

  const normalizedInput = normalizeClarificationInput(input.input);
  const id = input.id ?? deterministicIdFrom(normalizedInput);

  const decision = decideCandidates(input);
  const gateResults = computeGateResults({ context, decision });
  const blockingGateFailures = gateResults.filter((g) => BLOCKING_GATES.has(g.gate) && !g.passed);
  const allBlockingGatesPassed = blockingGateFailures.length === 0;

  const finalStatus: DecisionSupportShadowModeStatus = allBlockingGatesPassed ? decision.status : "blocked_by_safety_gate";
  const finalCandidateKind: DecisionSupportShadowModeCandidateKind = allBlockingGatesPassed ? decision.candidateKind : "none";
  const decisionCandidate = allBlockingGatesPassed ? decision.decisionCandidate : undefined;
  const clarificationCandidate = allBlockingGatesPassed ? decision.clarificationCandidate : undefined;

  const preservesExistingRoute =
    !decision.isExistingRouteCase ||
    (decision.candidateKind === "existing_route_preserved" && !decision.decisionCandidate && !decision.clarificationCandidate);

  const warnings: string[] = [];
  for (const failure of blockingGateFailures) {
    warnings.push(`Blocking safety gate "${failure.gate}" failed: ${failure.reason}`);
  }
  if (decisionCandidate) warnings.push(...decisionCandidate.warnings);
  if (clarificationCandidate) warnings.push(...clarificationCandidate.warnings);

  const auditMetadata: DecisionSupportShadowModeAuditMetadata = {
    shadowModeVersion: DECISION_SUPPORT_SHADOW_MODE_PREP_VERSION,
    generatedAt: input.now,
    strategySource: "sprint_23_adapter_mapping_plan",
    adapterMappingRealChanged: false,
    routerChanged: false,
    composerChanged: false,
    endpointChanged: false,
    limitations: [
      "This is a prep contract, not an activated shadow mode — no request path calls this module today.",
      "Reuses the Sprint 19R candidate handler and Sprint 22R clarification strategy as-is; does not harden either.",
      "Does not implement a persistent, multi-turn clarification loop — each call is a single, stateless turn.",
      "Does not persist any shadow output — a future Sprint 25R shadow capture harness would need its own storage design.",
    ],
  };

  return {
    kind: "decision_support_shadow_mode_run",
    id,
    input: input.input,
    normalizedInput,
    strategy: STRATEGY,
    status: finalStatus,
    candidateKind: finalCandidateKind,
    desiredFutureRoute: input.desiredFutureRoute,
    architectureCategory: input.architectureCategory,
    targetKind: input.targetKind,
    decisionCandidate,
    clarificationCandidate,
    gateResults,
    allBlockingGatesPassed,
    isDefaultOff: true,
    userVisibleOutputAllowed: false,
    persistenceAllowed: false,
    executionAllowed: false,
    productionRouteChangeAllowed: false,
    shouldReturnCandidateToUser: false,
    shouldPersistShadowResult: false,
    shouldExecuteAction: false,
    shouldSendEmail: false,
    shouldCreateTask: false,
    shouldWriteToDb: false,
    preservesExistingRoute,
    warnings,
    auditMetadata,
  } satisfies DecisionSupportShadowModeRun;
}

// ─── Evaluate a single run ────────────────────────────────────────────────────────────

function computeIsAcceptableShadowPrepRun(run: DecisionSupportShadowModeRun): boolean {
  if (!run.allBlockingGatesPassed) return false;
  if (!run.preservesExistingRoute) return false;
  if (run.shouldReturnCandidateToUser) return false;
  if (run.shouldPersistShadowResult) return false;
  if (run.shouldExecuteAction) return false;
  if (run.shouldSendEmail) return false;
  if (run.shouldCreateTask) return false;
  if (run.shouldWriteToDb) return false;
  if (!run.isDefaultOff) return false;
  if (run.userVisibleOutputAllowed) return false;
  if (run.persistenceAllowed) return false;
  if (run.executionAllowed) return false;
  if (run.productionRouteChangeAllowed) return false;
  return true;
}

/**
 * Turns a `prepareDecisionSupportShadowModeRun()` result into an evaluation-ready record: gate
 * failure counts, whether the run is an "acceptable shadow prep run" (every blocking gate passed,
 * existing routes preserved, and every side-effect flag stays `false`), and whether a candidate of
 * each kind was generated. Pure — takes an already-computed run rather than re-running anything.
 */
export function evaluateDecisionSupportShadowModeRun(run: DecisionSupportShadowModeRun): DecisionSupportShadowModeEvaluationResult {
  const gateFailures = run.gateResults.filter((g) => !g.passed);
  const blockingGateFailureCount = gateFailures.filter((g) => BLOCKING_GATES.has(g.gate)).length;

  return {
    id: run.id,
    input: run.input,
    desiredFutureRoute: run.desiredFutureRoute,
    architectureCategory: run.architectureCategory,
    targetKind: run.targetKind,
    runStatus: run.status,
    candidateKind: run.candidateKind,
    allBlockingGatesPassed: run.allBlockingGatesPassed,
    gateFailureCount: gateFailures.length,
    blockingGateFailureCount,
    preservesExistingRoute: run.preservesExistingRoute,
    decisionCandidateGenerated: Boolean(run.decisionCandidate) && run.candidateKind === "decision_support_candidate",
    clarificationCandidateGenerated: Boolean(run.clarificationCandidate) && run.candidateKind === "clarification_response_candidate",
    shouldReturnCandidateToUser: false,
    shouldPersistShadowResult: false,
    shouldExecuteAction: false,
    shouldSendEmail: false,
    shouldCreateTask: false,
    shouldWriteToDb: false,
    isAcceptableShadowPrepRun: computeIsAcceptableShadowPrepRun(run),
    warnings: run.warnings,
  } satisfies DecisionSupportShadowModeEvaluationResult;
}

// ─── Evaluation over a corpus ─────────────────────────────────────────────────────────

function toShadowModeInput(architectureCase: DecisionClarificationCase): DecisionSupportShadowModeInput {
  return {
    id: architectureCase.id,
    input: architectureCase.input,
    architectureCategory: architectureCase.architectureCategory,
    desiredFutureRoute: architectureCase.desiredFutureRoute,
    targetKind: architectureCase.targetKind,
    currentProductionMappedIntent: architectureCase.currentSafeMappedIntent,
    source: "architecture_review",
  };
}

const HYBRID_SIMULATED_INTENT_BY_CANDIDATE_KIND: Partial<Record<DecisionSupportShadowModeCandidateKind, DecisionSupportAdapterMappingResult["simulatedMappedIntent"]>> = {
  decision_support_candidate: "decision_support_candidate",
  clarification_response_candidate: "clarification_response_candidate",
  existing_route_preserved: "current_existing_route",
};

/**
 * Cross-checks this run's routing decision against the Sprint 23R Adapter Mapping Plan's own
 * `hybrid_shadow_then_clarify` simulation for the same case — reusing, not re-deriving, Sprint 23R's
 * already-validated evidence. Purely informational: appends a warning on mismatch, never changes
 * `status`, `candidateKind`, or any gate result.
 */
function crossCheckAgainstAdapterMappingPlan(run: DecisionSupportShadowModeRun, planResult: DecisionSupportAdapterMappingResult): void {
  if (run.status === "blocked_by_safety_gate" || run.status === "not_applicable") return;
  const expected = HYBRID_SIMULATED_INTENT_BY_CANDIDATE_KIND[run.candidateKind];
  if (expected && planResult.simulatedMappedIntent !== expected) {
    run.warnings.push(
      `Cross-check against the Sprint 23R hybrid_shadow_then_clarify simulation disagrees: expected simulatedMappedIntent ` +
        `"${expected}" but the adapter mapping plan produced "${planResult.simulatedMappedIntent}" for this case.`,
    );
  }
}

/**
 * Runs `prepareDecisionSupportShadowModeRun()` + `evaluateDecisionSupportShadowModeRun()` over every
 * case in a `DecisionClarificationCase[]` corpus (default: the Sprint 18R corpus, when the caller
 * passes it in), cross-checking each run against the Sprint 23R Adapter Mapping Plan's own
 * `hybrid_shadow_then_clarify` simulation for the same case. Pure — never mutates `cases`, never
 * calls the router, composer, any production handler, a database, Supabase, or any external service,
 * never calls `fetch` or an LLM, and never activates a feature flag.
 */
export function runDecisionSupportShadowModePrepEvaluation(
  cases: DecisionClarificationCase[],
  options: DecisionSupportShadowModePrepEvaluationOptions = {},
): DecisionSupportShadowModeEvaluationResult[] {
  const hybridPlanResults = runDecisionSupportAdapterMappingPlan(cases, {
    strategies: ["hybrid_shadow_then_clarify"],
    now: options.now,
  });
  const hybridPlanById = new Map(hybridPlanResults.map((r) => [r.id, r]));

  return cases.map((architectureCase) => {
    const input = toShadowModeInput(architectureCase);
    if (options.now) input.now = options.now;
    const run = prepareDecisionSupportShadowModeRun(input, options.context ?? {});
    const planResult = hybridPlanById.get(architectureCase.id);
    if (planResult) crossCheckAgainstAdapterMappingPlan(run, planResult);
    return evaluateDecisionSupportShadowModeRun(run);
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

const ALL_STATUSES: DecisionSupportShadowModeStatus[] = [
  "disabled",
  "prep_only",
  "shadow_eligible",
  "shadow_candidate_generated",
  "clarification_candidate_generated",
  "existing_route_preserved",
  "blocked_by_safety_gate",
  "not_applicable",
];

const ALL_CANDIDATE_KINDS: DecisionSupportShadowModeCandidateKind[] = [
  "decision_support_candidate",
  "clarification_response_candidate",
  "existing_route_preserved",
  "none",
];

const ALL_GATES: DecisionSupportShadowModeGate[] = [
  "default_off",
  "no_production_route",
  "no_user_visible_output",
  "no_persistence",
  "no_execution",
  "existing_route_preservation",
  "candidate_handler_safety",
  "clarification_safety",
  "confidence_gate",
  "missing_context_gate",
  "adapter_unchanged",
  "router_unchanged",
];

const REPRESENTATIVE_LIMIT = 5;

function computeRecommendedNextSprint(summary: {
  acceptableShadowPrepRunRate: number;
  shouldExecuteActionCount: number;
  shouldSendEmailCount: number;
  shouldCreateTaskCount: number;
  shouldWriteToDbCount: number;
  shouldReturnCandidateToUserCount: number;
  shouldPersistShadowResultCount: number;
  existingRoutePreservedCount: number;
  existingRouteInputCount: number;
  decisionCandidateGeneratedCount: number;
  clarificationCandidateGeneratedCount: number;
}): { recommendedNextSprint: DecisionSupportShadowModeNextSprintRecommendation; recommendation: string } {
  const sideEffectCount =
    summary.shouldExecuteActionCount +
    summary.shouldSendEmailCount +
    summary.shouldCreateTaskCount +
    summary.shouldWriteToDbCount +
    summary.shouldReturnCandidateToUserCount +
    summary.shouldPersistShadowResultCount;

  if (summary.acceptableShadowPrepRunRate < 100) {
    return {
      recommendedNextSprint: "Sprint 25R — Shadow Mode Safety Hardening",
      recommendation: `acceptableShadowPrepRunRate is ${summary.acceptableShadowPrepRunRate}%, below 100% — harden the failing gate(s) before building a capture harness.`,
    };
  }

  if (sideEffectCount > 0) {
    return {
      recommendedNextSprint: "Sprint 25R — Shadow Mode Side-Effect Hardening",
      recommendation: `${sideEffectCount} run(s) carried a non-zero side-effect flag — harden the offending code path before building a capture harness.`,
    };
  }

  if (summary.existingRouteInputCount > 0 && summary.existingRoutePreservedCount !== summary.existingRouteInputCount) {
    return {
      recommendedNextSprint: "Sprint 25R — Existing Route Preservation Hardening",
      recommendation: "Not every existing_route_should_win case was preserved as existing_route_preserved — fix this before building a capture harness.",
    };
  }

  if (summary.decisionCandidateGeneratedCount === 0 && summary.clarificationCandidateGeneratedCount > 0) {
    return {
      recommendedNextSprint: "Sprint 25R — Decision Support Confidence Context Plan",
      recommendation:
        "No decision_support case reached a shadow candidate — every eligible case fell back to clarification, meaning low confidence " +
        "dominates. Plan how a future caller could supply availableContext to raise confidence before capturing shadow output.",
    };
  }

  return {
    recommendedNextSprint: "Sprint 25R — Decision Support Shadow Capture Harness",
    recommendation:
      "Every metric is clean: 100% acceptable shadow prep runs, zero side effects, existing routes fully preserved, and both decision " +
      "and clarification candidates were generated — the contract is ready for a real (still default-off) shadow capture harness.",
  };
}

/**
 * Turns a `runDecisionSupportShadowModePrepEvaluation()` result array into a review-ready report:
 * counts by status/candidateKind/failed gate, side-effect counts (expected to be zero everywhere),
 * representative decision/clarification candidates, weak runs, and a Sprint 25R recommendation.
 * Pure — takes an already-computed result array rather than re-running anything.
 */
export function summarizeDecisionSupportShadowModePrepEvaluation(
  results: DecisionSupportShadowModeEvaluationResult[],
): DecisionSupportShadowModePrepEvaluationSummary {
  const totalCases = results.length;

  const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<DecisionSupportShadowModeStatus, number>;
  const byCandidateKind = Object.fromEntries(ALL_CANDIDATE_KINDS.map((c) => [c, 0])) as Record<DecisionSupportShadowModeCandidateKind, number>;
  const byFailedGate = Object.fromEntries(ALL_GATES.map((g) => [g, 0])) as Record<DecisionSupportShadowModeGate, number>;

  let shadowEligibleCount = 0;
  let decisionCandidateGeneratedCount = 0;
  let clarificationCandidateGeneratedCount = 0;
  let existingRoutePreservedCount = 0;
  let existingRouteInputCount = 0;
  let blockedBySafetyGateCount = 0;
  let notApplicableCount = 0;
  let acceptableShadowPrepRunCount = 0;
  let allBlockingGatesPassedCount = 0;

  for (const r of results) {
    byStatus[r.runStatus] += 1;
    byCandidateKind[r.candidateKind] += 1;

    if (r.runStatus === "shadow_candidate_generated" || r.runStatus === "clarification_candidate_generated") shadowEligibleCount += 1;
    if (r.decisionCandidateGenerated) decisionCandidateGeneratedCount += 1;
    if (r.clarificationCandidateGenerated) clarificationCandidateGeneratedCount += 1;
    if (r.runStatus === "existing_route_preserved") existingRoutePreservedCount += 1;
    if (r.targetKind === "existing_production_route" || r.architectureCategory === "existing_route_should_win") existingRouteInputCount += 1;
    if (r.runStatus === "blocked_by_safety_gate") blockedBySafetyGateCount += 1;
    if (r.runStatus === "not_applicable") notApplicableCount += 1;
    if (r.isAcceptableShadowPrepRun) acceptableShadowPrepRunCount += 1;
    if (r.allBlockingGatesPassed) allBlockingGatesPassedCount += 1;
  }

  const shouldReturnCandidateToUserCount = results.filter((r) => r.shouldReturnCandidateToUser).length;
  const shouldPersistShadowResultCount = results.filter((r) => r.shouldPersistShadowResult).length;
  const shouldExecuteActionCount = results.filter((r) => r.shouldExecuteAction).length;
  const shouldSendEmailCount = results.filter((r) => r.shouldSendEmail).length;
  const shouldCreateTaskCount = results.filter((r) => r.shouldCreateTask).length;
  const shouldWriteToDbCount = results.filter((r) => r.shouldWriteToDb).length;

  const representativeDecisionCandidates = results.filter((r) => r.decisionCandidateGenerated).slice(0, REPRESENTATIVE_LIMIT);
  const representativeClarificationCandidates = results.filter((r) => r.clarificationCandidateGenerated).slice(0, REPRESENTATIVE_LIMIT);
  const weakShadowPrepRuns = results.filter((r) => !r.isAcceptableShadowPrepRun).slice(0, REPRESENTATIVE_LIMIT);

  const { recommendedNextSprint, recommendation } = computeRecommendedNextSprint({
    acceptableShadowPrepRunRate: rateOf(acceptableShadowPrepRunCount, totalCases),
    shouldExecuteActionCount,
    shouldSendEmailCount,
    shouldCreateTaskCount,
    shouldWriteToDbCount,
    shouldReturnCandidateToUserCount,
    shouldPersistShadowResultCount,
    existingRoutePreservedCount,
    existingRouteInputCount,
    decisionCandidateGeneratedCount,
    clarificationCandidateGeneratedCount,
  });

  return {
    totalCases,
    evaluatedCases: totalCases,
    shadowEligibleCount,
    decisionCandidateGeneratedCount,
    clarificationCandidateGeneratedCount,
    existingRoutePreservedCount,
    blockedBySafetyGateCount,
    notApplicableCount,
    acceptableShadowPrepRunCount,
    acceptableShadowPrepRunRate: rateOf(acceptableShadowPrepRunCount, totalCases),
    allBlockingGatesPassedCount,
    allBlockingGatesPassedRate: rateOf(allBlockingGatesPassedCount, totalCases),
    defaultOffCount: totalCases,
    userVisibleOutputAllowedCount: 0,
    persistenceAllowedCount: 0,
    executionAllowedCount: 0,
    productionRouteChangeAllowedCount: 0,
    shouldReturnCandidateToUserCount,
    shouldPersistShadowResultCount,
    shouldExecuteActionCount,
    shouldSendEmailCount,
    shouldCreateTaskCount,
    shouldWriteToDbCount,
    byStatus,
    byCandidateKind,
    byFailedGate,
    representativeDecisionCandidates,
    representativeClarificationCandidates,
    weakShadowPrepRuns,
    recommendedNextSprint,
    recommendation,
  } satisfies DecisionSupportShadowModePrepEvaluationSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 24R shadow mode prep contract — mirrors the style of
 * `explainDecisionSupportAdapterMappingPlan()` (Sprint 23R). See
 * `docs/conversational-brain-decision-support-shadow-mode-prep.md` for full context.
 */
export function explainDecisionSupportShadowModePrep(): DecisionSupportShadowModePrepExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-shadow-mode-prep",
    purpose:
      "Prepares the technical contract for a future decision_support shadow mode under the Sprint 23R-recommended " +
      "hybrid_shadow_then_clarify strategy: what inputs it takes, which eligibility/safety gates it applies, when " +
      "the Sprint 19R candidate handler or Sprint 22R clarification strategy runs, what metadata is captured, and " +
      "what is returned to an offline caller — without activating shadow mode, a feature flag, or any router change.",
    nonGoals: [
      "Activate shadow mode in the request path.",
      "Connect decision_support to the router.",
      "Implement adapter mapping for real.",
      "Implement a real feature flag.",
      "Change production behavior in any way.",
      "Show any shadow output to a user.",
      "Persist any shadow output.",
      "Implement a persistent, multi-turn clarification loop.",
      "Create a new Context Resolver, Router, or Composer.",
      "Calibrate general_pm_advice vocabulary.",
    ],
    strategy: STRATEGY,
    defaultOffPolicy:
      "isDefaultOff, userVisibleOutputAllowed, persistenceAllowed, executionAllowed, and productionRouteChangeAllowed are literal " +
      "constants (true/false) on every run, never computed from caller input. A caller forcing featureFlagEnabled or any allow* " +
      "context flag to true does not enable anything — it fails the corresponding blocking safety gate and the run becomes " +
      "'blocked_by_safety_gate' with every side-effect flag still false.",
    safetyGates: [
      "default_off, no_production_route, no_user_visible_output, no_persistence, no_execution: blocking gates that fail only if the " +
        "caller forces the corresponding context flag to true.",
      "existing_route_preservation: blocking; fails if an existing_route_should_win case ever generates a decision or clarification candidate.",
      "candidate_handler_safety / clarification_safety: blocking; fail if a generated candidate does not pass every Sprint 19R/22R " +
        "safety/structural check.",
      "confidence_gate / missing_context_gate: non-blocking (warning); document the internal routing invariant (medium/high confidence " +
        "-> shadow decision candidate, low confidence -> shadow clarification candidate) and that no candidate is ever user-visible.",
      "adapter_unchanged / router_unchanged: informational; always true because this module imports neither.",
    ],
    existingRoutePreservation:
      "Any input with targetKind === 'existing_production_route' or architectureCategory === 'existing_route_should_win' short-circuits " +
      "to status 'existing_route_preserved', candidateKind 'existing_route_preserved', with no decision or clarification candidate ever " +
      "computed for it — this is a structural guarantee of decideCandidates(), not a measured coincidence.",
    whyUserVisibleOutputIsForbidden:
      "Sprint 24R prepares the shadow mode contract; it does not validate the candidate handler or clarification strategy's output " +
      "quality against a live user yet. shouldReturnCandidateToUser is a literal false so no future caller can accidentally wire this " +
      "module's output straight to a user without an explicit, separate integration decision.",
    whyPersistenceIsForbidden:
      "No shadow capture harness exists yet (that is the explicit Sprint 25R candidate) — persisting shadow output today would create " +
      "storage with no retention policy, no schema review, and no way to redact or delete it. shouldPersistShadowResult is a literal " +
      "false until that harness is designed.",
    whyFeatureFlagIsNotImplementedYet:
      "Sprint 23R's feature_flag_default_off and hybrid_shadow_then_clarify strategies both plan for a future flag; this sprint " +
      "documents what that flag would gate (featureFlagEnabled in DecisionSupportShadowModeContext) without creating, reading, or " +
      "evaluating any real flag at runtime — no config file, environment variable, or feature-flag service is touched.",
    whyProductionIsNotChanged:
      "This module reuses the existing, already-isolated Sprint 19R/22R/23R modules; it is not imported by " +
      "intentCompatibilityAdapter.ts, brainRouter.ts, responseComposer.ts, any handlers/*.ts, or POST /api/command-center/chat, and adds " +
      "no new import into any of those files.",
    expectedSprint25Path:
      "If acceptableShadowPrepRunRate and allBlockingGatesPassedRate stay at 100%, every side-effect count stays at 0, and existing " +
      "routes are fully preserved, Sprint 25R can design a real (still default-off) Decision Support Shadow Capture Harness — a " +
      "persistence-and-retention design for shadow output, not an activation of shadow mode in the request path.",
  };
}
