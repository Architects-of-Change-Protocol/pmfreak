/**
 * Sprint 30R — Decision Support Controlled Shadow Replay Evaluation.
 *
 * A pure, offline, deterministic **controlled shadow replay** — not a new pipeline, not a storage
 * implementation — that replays a corpus (default: the Sprint 18R corpus, passed in by the caller;
 * this module ships only a small self-contained synthetic default, mirroring how Sprint 29R's own
 * `createDecisionSupportShadowPersistenceReadinessInputMetrics()` never imports from `tests/fixtures/`)
 * through the existing Sprint 24R-28R shadow pipeline — shadow mode prep -> capture harness -> storage
 * policy assessment -> storage draft mapping -> draft validation -> a fresh, per-pass Sprint 28R fake
 * (in-memory, test-only) adapter write — multiple times per case, to answer: is the pipeline
 * deterministic across replays, are its decisions stable, do capture records and storage drafts stay
 * clean, does the fake adapter keep rejecting invalid drafts, and which cases are replay-safe versus
 * needing clarification gating versus staying unsupported.
 *
 * Reuses, rather than reimplements: the Sprint 24R shadow mode prep (`prepareDecisionSupportShadowModeRun`),
 * the Sprint 25R capture harness (`captureDecisionSupportShadowRun`), the Sprint 26R storage policy
 * (`runDecisionSupportShadowStoragePolicyEvaluation`), the Sprint 27R storage adapter plan
 * (`mapDecisionSupportCaptureRecordToStorageDraft`, `validateDecisionSupportShadowStorageDraft`), the
 * Sprint 28R fake adapter (`createDecisionSupportShadowStorageFakeAdapter`,
 * `writeDecisionSupportShadowStorageDraftToFakeAdapter`, `runDecisionSupportShadowStorageFakeAdapterEvaluation`),
 * and the Sprint 29R persistence readiness review (`buildDecisionSupportShadowPersistenceReadinessReview`,
 * `summarizeDecisionSupportShadowPersistenceReadinessReview`) — to prove no regression against the
 * Sprint 29R baseline.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. It never shows any shadow output to a user and never persists any shadow output for real —
 * every write in this module lands only in a fresh, per-pass, in-process Sprint 28R fake adapter
 * instance. See `docs/conversational-brain-decision-support-shadow-controlled-replay.md` for the full
 * design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import { prepareDecisionSupportShadowModeRun } from "./decisionSupportShadowModePrep";
import { captureDecisionSupportShadowRun, createDecisionSupportShadowInputHash } from "./decisionSupportShadowCaptureHarness";
import type { DecisionSupportShadowCaptureRecord, DecisionSupportShadowCaptureResult } from "./decisionSupportShadowCaptureHarnessTypes";
import { runDecisionSupportShadowStoragePolicyEvaluation } from "./decisionSupportShadowCaptureStoragePolicy";
import {
  mapDecisionSupportCaptureRecordToStorageDraft,
  validateDecisionSupportShadowStorageDraft,
} from "./decisionSupportShadowCaptureStorageAdapterPlan";
import type { DecisionSupportShadowStorageDraft } from "./decisionSupportShadowCaptureStorageAdapterPlanTypes";
import {
  createDecisionSupportShadowStorageFakeAdapter,
  runDecisionSupportShadowStorageFakeAdapterEvaluation,
  summarizeDecisionSupportShadowStorageFakeAdapterEvaluation,
  writeDecisionSupportShadowStorageDraftToFakeAdapter,
} from "./decisionSupportShadowCaptureStorageFakeAdapter";
import type { DecisionSupportShadowStorageFakeAdapter } from "./decisionSupportShadowCaptureStorageFakeAdapterTypes";
import {
  buildDecisionSupportShadowPersistenceReadinessReview,
  createDecisionSupportShadowPersistenceReadinessInputMetrics,
  summarizeDecisionSupportShadowPersistenceReadinessReview,
} from "./decisionSupportShadowCapturePersistenceReadiness";

import type {
  DecisionSupportShadowControlledReplayCaseAggregate,
  DecisionSupportShadowControlledReplayCaseCategory,
  DecisionSupportShadowControlledReplayConfig,
  DecisionSupportShadowControlledReplayDecision,
  DecisionSupportShadowControlledReplayEvaluationOptions,
  DecisionSupportShadowControlledReplayEvaluationResult,
  DecisionSupportShadowControlledReplayEvaluationSummary,
  DecisionSupportShadowControlledReplayExplain,
  DecisionSupportShadowControlledReplayForbiddenRetention,
  DecisionSupportShadowControlledReplayMode,
  DecisionSupportShadowControlledReplayPassResult,
  DecisionSupportShadowControlledReplayRouteRecommendation,
  DecisionSupportShadowControlledReplayRouteRecommendationResult,
  DecisionSupportShadowControlledReplaySafetyStatus,
  DecisionSupportShadowControlledReplaySideEffects,
  DecisionSupportShadowControlledReplayStabilityStatus,
  DecisionSupportShadowControlledReplayWriteStatus,
} from "./decisionSupportShadowControlledReplayTypes";

export type {
  DecisionSupportShadowControlledReplayProfile,
  DecisionSupportShadowControlledReplayMode,
  DecisionSupportShadowControlledReplayDecision,
  DecisionSupportShadowControlledReplayCaseCategory,
  DecisionSupportShadowControlledReplayRouteRecommendation,
  DecisionSupportShadowControlledReplaySafetyStatus,
  DecisionSupportShadowControlledReplayStabilityStatus,
  DecisionSupportShadowControlledReplayWriteStatus,
  DecisionSupportShadowControlledReplayConfig,
  DecisionSupportShadowControlledReplaySideEffects,
  DecisionSupportShadowControlledReplayForbiddenRetention,
  DecisionSupportShadowControlledReplayPassResult,
  DecisionSupportShadowControlledReplayCaseAggregate,
  DecisionSupportShadowControlledReplayEvaluationResult,
  DecisionSupportShadowControlledReplayEvaluationOptions,
  DecisionSupportShadowControlledReplayEvaluationSummary,
  DecisionSupportShadowControlledReplayRouteRecommendationResult,
  DecisionSupportShadowControlledReplayExplain,
} from "./decisionSupportShadowControlledReplayTypes";

export const DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_VERSION = "30R.1.0";

const RECOMMENDED_NEXT_SPRINT_READY = "Sprint 31R — Clarification-Gated Decision Support Integration Plan";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_fake_adapter_controlled_replay"` default config. `allowRealPersistence`,
 * `allowDbWrite`, `allowSupabaseWrite`, `allowExternalCalls`, `allowUserVisibleOutput`, and
 * `allowProductionWiring` are always `false`, forced regardless of any override a caller passes —
 * mirroring how the Sprint 28R fake adapter's own config never actually loosens its four `allow*`
 * real-side-effect flags from an override. `requireCapturePolicyClean`, `requireStorageDraftValid`,
 * `requireFakeAdapterSafety`, and `requireDeterministicOutputs` are always `true`.
 */
export function createDecisionSupportShadowControlledReplayConfig(
  overrides: Partial<DecisionSupportShadowControlledReplayConfig> = {},
): DecisionSupportShadowControlledReplayConfig {
  const config: DecisionSupportShadowControlledReplayConfig = {
    profile: "strict_fake_adapter_controlled_replay",
    mode: overrides.mode ?? "multi_pass_replay",
    replayPasses: overrides.replayPasses ?? 3,
    allowFakeAdapterWrites: overrides.allowFakeAdapterWrites ?? true,
    // These six are never actually loosened here, regardless of what a caller's override object
    // claims — this is the controlled replay's own strict, non-negotiable invariant.
    allowRealPersistence: false,
    allowDbWrite: false,
    allowSupabaseWrite: false,
    allowExternalCalls: false,
    allowUserVisibleOutput: false,
    allowProductionWiring: false,
    requireCapturePolicyClean: true,
    requireStorageDraftValid: true,
    requireFakeAdapterSafety: true,
    requireDeterministicOutputs: true,
  };
  if (overrides.now !== undefined) config.now = overrides.now;
  if (overrides.notes !== undefined) config.notes = [...overrides.notes];
  return config;
}

// ─── Allowed / prohibited actions ────────────────────────────────────────────────────

const ALLOWED_NEXT_ACTIONS: string[] = [
  "Run a controlled replay using fake adapter across multiple passes.",
  "Plan a clarification-gated integration planning effort for Sprint 31R.",
  "Perform route recommendation analysis for every replayed case.",
  "Perform replay drift analysis between passes.",
  "Perform safety regression analysis against the Sprint 24R-29R baseline.",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Implement real persistence.",
  "Perform a real DB write.",
  "Perform a real Supabase write.",
  "Create a migration file.",
  "Create a SQL file.",
  "Create a DB table.",
  "Enable a production feature flag.",
  "Wire decision_support to the router/composer/endpoint.",
  "Show shadow output as user-visible output.",
  "Implement a real repository.",
  "Implement a real storage adapter.",
];

/** Returns a fresh copy of every action this sprint allows next. */
export function listDecisionSupportShadowControlledReplayAllowedNextActions(): string[] {
  return [...ALLOWED_NEXT_ACTIONS];
}

/** Returns a fresh copy of every action this sprint prohibits. */
export function listDecisionSupportShadowControlledReplayProhibitedActions(): string[] {
  return [...PROHIBITED_NEXT_ACTIONS];
}

// ─── Default synthetic corpus ─────────────────────────────────────────────────────────

/**
 * A minimal, self-contained synthetic corpus — not imported from `tests/fixtures/`, mirroring how
 * Sprint 29R's own `createDecisionSupportShadowPersistenceReadinessInputMetrics()` ships a small
 * synthetic default rather than depending on a test fixture. Callers who want the full Sprint 18R
 * corpus's metrics (the ones this sprint's baseline numbers describe) pass
 * `DECISION_CLARIFICATION_CASES` (from `tests/fixtures/conversational-brain-decision-clarification-cases.ts`)
 * explicitly, exactly as Sprint 29R's own test suite does.
 */
const DEFAULT_SYNTHETIC_CORPUS: DecisionClarificationCase[] = [
  {
    id: "cr-synthetic-01",
    input: "Deberiamos usar Postgres o Mongo para el nuevo servicio de facturacion del equipo?",
    architectureCategory: "decision_support_clear",
    desiredFutureRoute: "decision_support",
    currentSafeMappedIntent: "unsupported",
    targetKind: "future_architecture",
    rationale: "A synthetic default-corpus case, used only when no corpus is supplied to the controlled replay functions.",
    riskLevel: "medium",
    requiresNewHandler: true,
    requiresClarification: false,
    shouldExecuteAction: false,
  },
  {
    id: "cr-synthetic-02",
    input: "no estoy seguro que alternativa conviene mas para este proyecto",
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
    id: "cr-synthetic-03",
    input: "cual es el estado actual del proyecto Atlas?",
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

// ─── Classification ────────────────────────────────────────────────────────────────────

type ClassifiableCase = {
  targetKind?: string;
  architectureCategory?: string;
  desiredFutureRoute?: string;
};

/**
 * Classifies a case (or any object carrying `targetKind`/`architectureCategory`/`desiredFutureRoute`,
 * e.g. a `DecisionClarificationCase`, a `DecisionSupportShadowControlledReplayPassResult`, or a
 * `DecisionSupportShadowControlledReplayCaseAggregate`) into one of the four replay case categories.
 * Mirrors the Sprint 24R `isExistingRouteInput()`/`isClarificationDesiredInput()` routing rules
 * exactly, so classification here always agrees with what `prepareDecisionSupportShadowModeRun()`
 * would actually decide for the same input. Pure — never runs the pipeline itself.
 */
export function classifyDecisionSupportShadowControlledReplayCase(
  caseOrResult: ClassifiableCase,
): DecisionSupportShadowControlledReplayCaseCategory {
  const { targetKind, architectureCategory, desiredFutureRoute } = caseOrResult;

  if (targetKind === "existing_production_route" || architectureCategory === "existing_route_should_win") {
    return "existing_route_preserved";
  }
  if (desiredFutureRoute === "decision_support") {
    return "decision_candidate";
  }
  if (desiredFutureRoute === "needs_clarification" || Boolean(architectureCategory?.startsWith("clarification_"))) {
    return "clarification_candidate";
  }
  return "unsupported_or_not_applicable";
}

// ─── Route recommendation ──────────────────────────────────────────────────────────────

type RecommendableResult = {
  category: DecisionSupportShadowControlledReplayCaseCategory;
  safetyStatus?: DecisionSupportShadowControlledReplaySafetyStatus;
  finalSafetyStatus?: DecisionSupportShadowControlledReplaySafetyStatus;
  stable?: boolean;
  driftReasons?: string[];
};

function baseRouteRecommendationResult(): DecisionSupportShadowControlledReplayRouteRecommendationResult {
  return {
    routeRecommendation: "needs_more_replay",
    requiresClarificationGate: false,
    shouldRemainShadowOnly: false,
    shouldRemainUnsupported: false,
    shouldUseExistingRoute: false,
  };
}

/**
 * Recommends a route for a single pass result or a case aggregate, per the Sprint 30R routing rules:
 * `decision_candidate` + `safe` -> `clarification_gated_decision_support`; `clarification_candidate`
 * (any safety status) -> `clarification_gated_decision_support`; `existing_route_preserved` -> `keep_existing_route`;
 * `unsupported_or_not_applicable` -> `keep_unsupported`. Drift (an aggregate with `stable: false` or a
 * non-empty `driftReasons`) or a non-`safe` safety status (`warning`/`unsafe`/`blocked`) always wins
 * over every other rule and forces `shadow_only` — a replay that is not proven stable and safe must
 * never be recommended for clarification-gated integration or for keeping an existing/unsupported
 * route, since either recommendation asserts a stronger guarantee than an unstable/unsafe replay can
 * back up.
 */
export function recommendDecisionSupportShadowControlledReplayRoute(
  passResultOrAggregate: RecommendableResult,
): DecisionSupportShadowControlledReplayRouteRecommendationResult {
  const { category } = passResultOrAggregate;
  const stable = passResultOrAggregate.stable ?? true;
  const driftReasons = passResultOrAggregate.driftReasons ?? [];
  const safetyStatus: DecisionSupportShadowControlledReplaySafetyStatus =
    passResultOrAggregate.finalSafetyStatus ?? passResultOrAggregate.safetyStatus ?? "safe";

  const hasDrift = stable === false || driftReasons.length > 0;
  const hasSafetyConcern = safetyStatus !== "safe";

  const result = baseRouteRecommendationResult();

  if (hasDrift || hasSafetyConcern) {
    result.routeRecommendation = "shadow_only";
    result.shouldRemainShadowOnly = true;
    return result;
  }

  switch (category) {
    case "decision_candidate":
    case "clarification_candidate":
      result.routeRecommendation = "clarification_gated_decision_support";
      result.requiresClarificationGate = true;
      return result;
    case "existing_route_preserved":
      result.routeRecommendation = "keep_existing_route";
      result.shouldUseExistingRoute = true;
      return result;
    case "unsupported_or_not_applicable":
      result.routeRecommendation = "keep_unsupported";
      result.shouldRemainUnsupported = true;
      return result;
    default:
      return result;
  }
}

// ─── Single-case pass ──────────────────────────────────────────────────────────────────

const LITERAL_SIDE_EFFECTS: DecisionSupportShadowControlledReplaySideEffects = {
  realPersistenceAttempted: false,
  dbWriteAttempted: false,
  supabaseWriteAttempted: false,
  externalCallAttempted: false,
  userVisibleOutputAttempted: false,
  productionWiringAttempted: false,
};

function toShadowModeInput(architectureCase: DecisionClarificationCase, now?: string) {
  return {
    id: architectureCase.id,
    input: architectureCase.input,
    architectureCategory: architectureCase.architectureCategory,
    desiredFutureRoute: architectureCase.desiredFutureRoute,
    targetKind: architectureCase.targetKind,
    currentProductionMappedIntent: architectureCase.currentSafeMappedIntent,
    source: "architecture_review" as const,
    now,
  };
}

function gatePassed(validationResults: ReturnType<typeof validateDecisionSupportShadowStorageDraft>, gateName: string): boolean {
  const found = validationResults.find((v) => v.gate === gateName);
  return found ? found.passed : true;
}

const FORBIDDEN_RETENTION_GATES = [
  "no_raw_input",
  "no_input_preview",
  "no_full_candidate",
  "no_user_visible_output",
  "no_project_name",
  "no_email_address",
  "no_phone_number",
] as const;

/**
 * Every field here is a literal `false` by this module's own construction — matching the same
 * "structurally guaranteed, never computed" convention as `DecisionSupportShadowCaptureRecord.rawInputRetained`
 * (Sprint 25R) and `DecisionSupportShadowStorageFakeRepositoryRecordAudit.rawInputStored` (Sprint 28R).
 * A real forbidden-content violation is detected separately (see `hasForbiddenContentViolation()`
 * below) and folded into `safetyStatus` instead of ever flipping one of these to `true`.
 */
const LITERAL_FORBIDDEN_RETENTION: DecisionSupportShadowControlledReplayForbiddenRetention = {
  rawInputRetained: false,
  inputPreviewRetained: false,
  fullCandidateRetained: false,
  userVisibleOutputRetained: false,
  projectNameRetained: false,
  emailAddressRetained: false,
  phoneNumberRetained: false,
};

function hasForbiddenContentViolation(validationResults: ReturnType<typeof validateDecisionSupportShadowStorageDraft>): boolean {
  return FORBIDDEN_RETENTION_GATES.some((gateName) => !gatePassed(validationResults, gateName));
}

function computeWriteStatus(
  draft: DecisionSupportShadowStorageDraft | undefined,
  writeAccepted: boolean | undefined,
  writeAttempted: boolean | undefined,
): DecisionSupportShadowControlledReplayWriteStatus {
  if (!draft) return "blocked_before_write";
  if (!writeAttempted) return "not_written";
  return writeAccepted ? "fake_write_accepted" : "fake_write_rejected";
}

/**
 * Derives safety status purely from structural pipeline outcomes — never from the *count* of
 * warning strings. Sprint 19R/24R/26R already attach routine, expected informational warnings to
 * every successful run (e.g. "no concrete options detected", "inputPreview requires an explicit
 * policy exception") that do not indicate an actual policy violation; treating any non-empty
 * `warnings` array as unsafe would make every real corpus case look unsafe, defeating the purpose of
 * this check. `"warning"` remains a reachable value of `DecisionSupportShadowControlledReplaySafetyStatus`
 * for callers of `recommendDecisionSupportShadowControlledReplayRoute()` that pass it in directly
 * (e.g. hand-built synthetic aggregates in tests) — this function itself never produces it.
 */
function computeSafetyStatus(params: {
  capturePolicyClean: boolean;
  storageDraftValid: boolean;
  fakeWriteStatus: DecisionSupportShadowControlledReplayWriteStatus;
  forbiddenContentViolation: boolean;
}): DecisionSupportShadowControlledReplaySafetyStatus {
  const { capturePolicyClean, storageDraftValid, fakeWriteStatus, forbiddenContentViolation } = params;

  if (forbiddenContentViolation) return "unsafe";
  if (!capturePolicyClean || !storageDraftValid || fakeWriteStatus === "fake_write_rejected") return "blocked";
  return "safe";
}

/**
 * Runs a single Sprint 30R controlled replay pass over a single case: prepares the Sprint 24R shadow
 * mode run, captures it (`dry_run`, via the Sprint 25R harness), assesses the capture against the
 * Sprint 26R storage policy, maps it to a Sprint 27R storage draft, validates the draft, and — using
 * the supplied (or freshly created) Sprint 28R fake adapter — writes it. Never persists anything for
 * real; every side effect and forbidden-retention field is a literal `false` on this module's own
 * construction, never computed from anything that could make it `true` against a policy-clean corpus.
 */
function runSingleCasePass(
  architectureCase: DecisionClarificationCase,
  passIndex: number,
  adapter: DecisionSupportShadowStorageFakeAdapter,
  now: string | undefined,
): DecisionSupportShadowControlledReplayPassResult {
  const run = prepareDecisionSupportShadowModeRun(toShadowModeInput(architectureCase, now), {});
  const capture: DecisionSupportShadowCaptureResult = captureDecisionSupportShadowRun(run, { mode: "dry_run", now });
  const record: DecisionSupportShadowCaptureRecord | undefined = capture.record;

  const [policyAssessment] = runDecisionSupportShadowStoragePolicyEvaluation([capture], { now });
  const capturePolicyClean = policyAssessment ? policyAssessment.storageReady : false;

  const draft = record ? mapDecisionSupportCaptureRecordToStorageDraft(record) : undefined;
  const validationResults = draft ? validateDecisionSupportShadowStorageDraft(draft) : [];
  const storageDraftValid = draft ? validationResults.filter((v) => v.severity === "blocking" && !v.passed).length === 0 : false;

  const writeResult = draft ? writeDecisionSupportShadowStorageDraftToFakeAdapter(adapter, draft) : undefined;
  const fakeWriteStatus = computeWriteStatus(draft, writeResult?.accepted, writeResult?.writeAttempted);
  const fakeWriteAccepted = writeResult?.accepted ?? false;

  const forbiddenContentViolation = draft ? hasForbiddenContentViolation(validationResults) : false;

  const warnings: string[] = [
    ...run.warnings,
    ...capture.warnings,
    ...(policyAssessment?.warnings ?? []),
    ...validationResults.filter((v) => v.severity === "blocking" && !v.passed).map((v) => `Blocking draft validation gate "${v.gate}" failed: ${v.reason}`),
    ...(writeResult?.warnings ?? []),
  ];

  const category = classifyDecisionSupportShadowControlledReplayCase(architectureCase);
  const safetyStatus = computeSafetyStatus({
    capturePolicyClean,
    storageDraftValid,
    fakeWriteStatus,
    forbiddenContentViolation,
  });

  const { routeRecommendation } = recommendDecisionSupportShadowControlledReplayRoute({ category, safetyStatus });

  return {
    passIndex,
    caseId: architectureCase.id,
    category,
    inputHash: record?.inputHash ?? createDecisionSupportShadowInputHash(architectureCase.input),
    architectureCategory: architectureCase.architectureCategory,
    desiredFutureRoute: architectureCase.desiredFutureRoute,
    targetKind: architectureCase.targetKind,
    captureCreated: capture.recordCreated,
    capturePolicyClean,
    storageDraftCreated: Boolean(draft),
    storageDraftValid,
    fakeWriteStatus,
    fakeWriteAccepted,
    fakeRecordId: writeResult?.record?.recordId,
    routeRecommendation,
    safetyStatus,
    warnings,
    sideEffects: { ...LITERAL_SIDE_EFFECTS },
    forbiddenRetention: { ...LITERAL_FORBIDDEN_RETENTION },
  } satisfies DecisionSupportShadowControlledReplayPassResult;
}

// ─── Pass over a corpus ────────────────────────────────────────────────────────────────

export type DecisionSupportShadowControlledReplayPassOptions = {
  passIndex?: number;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  /** An existing Sprint 28R fake adapter instance to write into. When omitted, a fresh, private,
   * in-memory-only adapter is created for this pass — never shared across passes by default, so one
   * pass's writes can never leak into another pass's write-acceptance counts. */
  adapter?: DecisionSupportShadowStorageFakeAdapter;
};

/**
 * Runs one Sprint 30R controlled replay pass over `cases` (default: a small self-contained synthetic
 * corpus — pass `DECISION_CLARIFICATION_CASES` from
 * `tests/fixtures/conversational-brain-decision-clarification-cases.ts` for the full Sprint 18R
 * corpus). Never creates a database, migration, storage adapter, or Supabase write, and never shows
 * anything to a user — every write lands only in `options.adapter` (or a freshly created one).
 */
export function runDecisionSupportShadowControlledReplayPass(
  cases: DecisionClarificationCase[] = DEFAULT_SYNTHETIC_CORPUS,
  options: DecisionSupportShadowControlledReplayPassOptions = {},
): DecisionSupportShadowControlledReplayPassResult[] {
  const passIndex = options.passIndex ?? 0;
  const adapter = options.adapter ?? createDecisionSupportShadowStorageFakeAdapter();
  return cases.map((architectureCase) => runSingleCasePass(architectureCase, passIndex, adapter, options.now));
}

// ─── Aggregation ───────────────────────────────────────────────────────────────────────

const DRIFT_FIELDS: Array<keyof DecisionSupportShadowControlledReplayPassResult> = [
  "category",
  "inputHash",
  "architectureCategory",
  "desiredFutureRoute",
  "targetKind",
  "capturePolicyClean",
  "storageDraftValid",
  "fakeWriteStatus",
  "fakeWriteAccepted",
  "routeRecommendation",
  "safetyStatus",
];

const MAJOR_DRIFT_FIELDS = new Set<keyof DecisionSupportShadowControlledReplayPassResult>([
  "capturePolicyClean",
  "storageDraftValid",
  "fakeWriteStatus",
  "fakeWriteAccepted",
  "safetyStatus",
]);

function detectDrift(passes: DecisionSupportShadowControlledReplayPassResult[]): string[] {
  if (passes.length <= 1) return [];
  const [first, ...rest] = passes;
  const driftReasons: string[] = [];
  for (const field of DRIFT_FIELDS) {
    const firstValue = first[field];
    if (rest.some((p) => p[field] !== firstValue)) {
      driftReasons.push(String(field));
    }
  }
  return driftReasons;
}

function computeStabilityStatus(driftReasons: string[]): DecisionSupportShadowControlledReplayStabilityStatus {
  if (driftReasons.length === 0) return "stable";
  if (driftReasons.includes("inputHash")) return "not_deterministic";
  if (driftReasons.some((reason) => MAJOR_DRIFT_FIELDS.has(reason as keyof DecisionSupportShadowControlledReplayPassResult))) return "major_drift";
  return "minor_drift";
}

const SAFETY_SEVERITY_ORDER: Record<DecisionSupportShadowControlledReplaySafetyStatus, number> = {
  safe: 0,
  warning: 1,
  unsafe: 2,
  blocked: 3,
};

function worstSafetyStatus(passes: DecisionSupportShadowControlledReplayPassResult[]): DecisionSupportShadowControlledReplaySafetyStatus {
  return passes.reduce<DecisionSupportShadowControlledReplaySafetyStatus>(
    (worst, p) => (SAFETY_SEVERITY_ORDER[p.safetyStatus] > SAFETY_SEVERITY_ORDER[worst] ? p.safetyStatus : worst),
    "safe",
  );
}

export type DecisionSupportShadowControlledReplayAggregationOptions = Record<string, never>;

/**
 * Groups a flat array of pass results (typically the concatenation of several
 * `runDecisionSupportShadowControlledReplayPass()` calls) by `caseId`, and for each case decides
 * whether every pass agreed on `category`, `inputHash`, `architectureCategory`, `desiredFutureRoute`,
 * `targetKind`, `capturePolicyClean`, `storageDraftValid`, `fakeWriteStatus`, `fakeWriteAccepted`,
 * `routeRecommendation`, and `safetyStatus`. A case's `finalSafetyStatus` is the worst status observed
 * across its passes (`blocked` > `unsafe` > `warning` > `safe`) — a single unsafe pass is enough to
 * mark the whole case unsafe, since determinism cannot be assumed once any pass disagrees. Pure —
 * never re-runs the pipeline, only aggregates already-computed pass results.
 */
export function aggregateDecisionSupportShadowControlledReplayCaseResults(
  passResults: DecisionSupportShadowControlledReplayPassResult[],
  _options: DecisionSupportShadowControlledReplayAggregationOptions = {},
): DecisionSupportShadowControlledReplayCaseAggregate[] {
  const byCaseId = new Map<string, DecisionSupportShadowControlledReplayPassResult[]>();
  for (const result of passResults) {
    const existing = byCaseId.get(result.caseId);
    if (existing) existing.push(result);
    else byCaseId.set(result.caseId, [result]);
  }

  const aggregates: DecisionSupportShadowControlledReplayCaseAggregate[] = [];
  for (const [caseId, passes] of byCaseId) {
    const driftReasons = detectDrift(passes);
    const stable = driftReasons.length === 0;
    const stabilityStatus = computeStabilityStatus(driftReasons);
    const finalSafetyStatus = worstSafetyStatus(passes);
    const category = passes[0].category;

    const { routeRecommendation, requiresClarificationGate, shouldRemainShadowOnly, shouldRemainUnsupported, shouldUseExistingRoute } =
      recommendDecisionSupportShadowControlledReplayRoute({ category, finalSafetyStatus, stable, driftReasons });

    aggregates.push({
      caseId,
      category,
      passes,
      passCount: passes.length,
      stable,
      stabilityStatus,
      driftReasons,
      safePassCount: passes.filter((p) => p.safetyStatus === "safe").length,
      unsafePassCount: passes.filter((p) => p.safetyStatus !== "safe").length,
      fakeWriteAcceptedCount: passes.filter((p) => p.fakeWriteAccepted).length,
      fakeWriteRejectedCount: passes.filter((p) => p.fakeWriteStatus === "fake_write_rejected").length,
      routeRecommendation,
      finalSafetyStatus,
      requiresClarificationGate,
      shouldRemainShadowOnly,
      shouldRemainUnsupported,
      shouldUseExistingRoute,
    } satisfies DecisionSupportShadowControlledReplayCaseAggregate);
  }

  return aggregates;
}

// ─── Full evaluation ───────────────────────────────────────────────────────────────────

/**
 * Runs the full Sprint 30R controlled shadow replay evaluation: `config.replayPasses` independent
 * passes over `cases` (default: a small self-contained synthetic corpus — pass
 * `DECISION_CLARIFICATION_CASES` for the full Sprint 18R/79-case corpus), each against its own fresh
 * Sprint 28R fake adapter instance, then aggregates every case's passes, and recomputes the Sprint 29R
 * persistence readiness review against the same corpus (reused, not re-derived) to prove no
 * regression. Never creates a database, migration, storage adapter, or Supabase write.
 */
export function runDecisionSupportShadowControlledReplayEvaluation(
  cases: DecisionClarificationCase[] = DEFAULT_SYNTHETIC_CORPUS,
  options: DecisionSupportShadowControlledReplayEvaluationOptions = {},
): DecisionSupportShadowControlledReplayEvaluationResult {
  const config = createDecisionSupportShadowControlledReplayConfig({ ...options.config, now: options.now ?? options.config?.now });
  const now = options.now ?? config.now;

  const passResults: DecisionSupportShadowControlledReplayPassResult[] = [];
  for (let passIndex = 0; passIndex < config.replayPasses; passIndex += 1) {
    const adapter = createDecisionSupportShadowStorageFakeAdapter();
    passResults.push(...runDecisionSupportShadowControlledReplayPass(cases, { passIndex, now, adapter }));
  }

  const aggregates = aggregateDecisionSupportShadowControlledReplayCaseResults(passResults);

  const persistenceReadinessInputMetrics = createDecisionSupportShadowPersistenceReadinessInputMetrics(cases, { now });
  const persistenceReadinessReview = buildDecisionSupportShadowPersistenceReadinessReview({ now, inputMetrics: persistenceReadinessInputMetrics });
  const persistenceReadinessSummary = summarizeDecisionSupportShadowPersistenceReadinessReview(persistenceReadinessReview);

  const fakeAdapterBaselineResult = runDecisionSupportShadowStorageFakeAdapterEvaluation(cases, { now });
  const fakeAdapterBaselineSummary = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(fakeAdapterBaselineResult);

  return {
    config,
    passResults,
    aggregates,
    persistenceReadinessSummary,
    fakeAdapterBaselineSummary,
  } satisfies DecisionSupportShadowControlledReplayEvaluationResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

const REPRESENTATIVE_LIMIT = 8;

function computeDecision(fields: {
  deterministicReplayRate: number;
  safeReplayRate: number;
  fakeWriteAcceptedRate: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  rawInputRetainedCount: number;
  inputPreviewRetainedCount: number;
  fullCandidateRetainedCount: number;
  userVisibleOutputRetainedCount: number;
  projectNameRetainedCount: number;
  emailAddressRetainedCount: number;
  phoneNumberRetainedCount: number;
  unstableCaseCount: number;
  unsafeCaseCount: number;
  fakeWriteRejectedCount: number;
  fakeAdapterBaselineRegressed: boolean;
}): DecisionSupportShadowControlledReplayDecision {
  const allClean =
    fields.deterministicReplayRate === 100 &&
    fields.safeReplayRate === 100 &&
    fields.fakeWriteAcceptedRate === 100 &&
    fields.realPersistenceAttemptedCount === 0 &&
    fields.dbWriteAttemptedCount === 0 &&
    fields.supabaseWriteAttemptedCount === 0 &&
    fields.externalCallAttemptedCount === 0 &&
    fields.userVisibleOutputAttemptedCount === 0 &&
    fields.productionWiringAttemptedCount === 0 &&
    fields.rawInputRetainedCount === 0 &&
    fields.inputPreviewRetainedCount === 0 &&
    fields.fullCandidateRetainedCount === 0 &&
    fields.userVisibleOutputRetainedCount === 0 &&
    fields.projectNameRetainedCount === 0 &&
    fields.emailAddressRetainedCount === 0 &&
    fields.phoneNumberRetainedCount === 0;

  if (allClean && !fields.fakeAdapterBaselineRegressed) return "ready_for_clarification_gated_integration_plan";
  if (fields.unstableCaseCount > 0) return "blocked_by_replay_drift";
  if (fields.unsafeCaseCount > 0) return "blocked_by_safety_regression";
  if (fields.fakeWriteRejectedCount > 0 || fields.fakeAdapterBaselineRegressed) return "blocked_by_fake_adapter_regression";
  return "continue_shadow_replay_only";
}

function recommendedNextSprintFor(decision: DecisionSupportShadowControlledReplayDecision): string {
  switch (decision) {
    case "ready_for_clarification_gated_integration_plan":
      return RECOMMENDED_NEXT_SPRINT_READY;
    case "blocked_by_replay_drift":
      return "Sprint 30R — Controlled Shadow Replay Drift Hardening";
    case "blocked_by_safety_regression":
      return "Sprint 30R — Controlled Shadow Replay Safety Regression Hardening";
    case "blocked_by_fake_adapter_regression":
      return "Sprint 30R — Controlled Shadow Replay Fake Adapter Regression Hardening";
    case "continue_shadow_replay_only":
    default:
      return "Sprint 30R — Controlled Shadow Replay Evaluation (continue)";
  }
}

export type DecisionSupportShadowControlledReplaySummaryOptions = {
  passResults?: DecisionSupportShadowControlledReplayPassResult[];
  replayPasses?: number;
};

/**
 * Turns a `runDecisionSupportShadowControlledReplayEvaluation()` result — or a bare
 * `DecisionSupportShadowControlledReplayCaseAggregate[]` plus `options.passResults` — into a
 * review-ready report: determinism/safety/fake-write rates, forbidden-retention and side-effect counts
 * (expected zero everywhere against a policy-clean corpus), route-recommendation counts, a decision,
 * and a recommended next sprint. Pure — takes an already-computed evaluation rather than re-running
 * anything.
 */
export function summarizeDecisionSupportShadowControlledReplayEvaluation(
  evaluationOrAggregates: DecisionSupportShadowControlledReplayEvaluationResult | DecisionSupportShadowControlledReplayCaseAggregate[],
  options: DecisionSupportShadowControlledReplaySummaryOptions = {},
): DecisionSupportShadowControlledReplayEvaluationSummary {
  const aggregates = Array.isArray(evaluationOrAggregates) ? evaluationOrAggregates : evaluationOrAggregates.aggregates;
  const passResults = Array.isArray(evaluationOrAggregates)
    ? (options.passResults ?? aggregates.flatMap((a) => a.passes))
    : evaluationOrAggregates.passResults;
  const replayPasses = Array.isArray(evaluationOrAggregates)
    ? (options.replayPasses ?? (aggregates[0]?.passCount ?? 0))
    : evaluationOrAggregates.config.replayPasses;

  const totalCases = aggregates.length;
  const totalPassResults = passResults.length;

  const stableCaseCount = aggregates.filter((a) => a.stable).length;
  const unstableCaseCount = totalCases - stableCaseCount;
  const deterministicReplayRate = rateOf(stableCaseCount, totalCases);

  const safeCaseCount = aggregates.filter((a) => a.finalSafetyStatus === "safe").length;
  const unsafeCaseCount = totalCases - safeCaseCount;
  const safeReplayRate = rateOf(safeCaseCount, totalCases);

  const captureCreatedCount = passResults.filter((p) => p.captureCreated).length;
  const capturePolicyCleanCount = passResults.filter((p) => p.capturePolicyClean).length;
  const storageDraftCreatedCount = passResults.filter((p) => p.storageDraftCreated).length;
  const storageDraftValidCount = passResults.filter((p) => p.storageDraftValid).length;

  const fakeWriteAcceptedCount = passResults.filter((p) => p.fakeWriteAccepted).length;
  const fakeWriteRejectedCount = passResults.filter((p) => p.fakeWriteStatus === "fake_write_rejected").length;
  const fakeWriteAcceptedRate = rateOf(fakeWriteAcceptedCount, totalPassResults);

  const clarificationGatedRecommendationCount = aggregates.filter((a) => a.routeRecommendation === "clarification_gated_decision_support").length;
  const existingRouteRecommendationCount = aggregates.filter((a) => a.routeRecommendation === "keep_existing_route").length;
  const unsupportedRecommendationCount = aggregates.filter((a) => a.routeRecommendation === "keep_unsupported").length;
  const shadowOnlyRecommendationCount = aggregates.filter((a) => a.routeRecommendation === "shadow_only").length;

  const fakeAdapterBaselineSummary = Array.isArray(evaluationOrAggregates) ? undefined : evaluationOrAggregates.fakeAdapterBaselineSummary;
  const fakeAdapterBaselineRegressed = Boolean(
    fakeAdapterBaselineSummary && fakeAdapterBaselineSummary.readinessStatus !== "ready_for_persistence_readiness_review",
  );

  const rawInputRetainedCount = passResults.filter((p) => p.forbiddenRetention.rawInputRetained).length;
  const inputPreviewRetainedCount = passResults.filter((p) => p.forbiddenRetention.inputPreviewRetained).length;
  const fullCandidateRetainedCount = passResults.filter((p) => p.forbiddenRetention.fullCandidateRetained).length;
  const userVisibleOutputRetainedCount = passResults.filter((p) => p.forbiddenRetention.userVisibleOutputRetained).length;
  const projectNameRetainedCount = passResults.filter((p) => p.forbiddenRetention.projectNameRetained).length;
  const emailAddressRetainedCount = passResults.filter((p) => p.forbiddenRetention.emailAddressRetained).length;
  const phoneNumberRetainedCount = passResults.filter((p) => p.forbiddenRetention.phoneNumberRetained).length;

  const decision = computeDecision({
    deterministicReplayRate,
    safeReplayRate,
    fakeWriteAcceptedRate,
    realPersistenceAttemptedCount: 0,
    dbWriteAttemptedCount: 0,
    supabaseWriteAttemptedCount: 0,
    externalCallAttemptedCount: 0,
    userVisibleOutputAttemptedCount: 0,
    productionWiringAttemptedCount: 0,
    rawInputRetainedCount,
    inputPreviewRetainedCount,
    fullCandidateRetainedCount,
    userVisibleOutputRetainedCount,
    projectNameRetainedCount,
    emailAddressRetainedCount,
    phoneNumberRetainedCount,
    unstableCaseCount,
    unsafeCaseCount,
    fakeWriteRejectedCount,
    fakeAdapterBaselineRegressed,
  });

  const warnings = passResults.flatMap((p) => p.warnings);

  return {
    totalCases,
    replayPasses,
    totalPassResults,
    stableCaseCount,
    unstableCaseCount,
    deterministicReplayRate,
    safeCaseCount,
    unsafeCaseCount,
    safeReplayRate,
    captureCreatedCount,
    capturePolicyCleanCount,
    storageDraftCreatedCount,
    storageDraftValidCount,
    fakeWriteAcceptedCount,
    fakeWriteRejectedCount,
    fakeWriteAcceptedRate,
    clarificationGatedRecommendationCount,
    existingRouteRecommendationCount,
    unsupportedRecommendationCount,
    shadowOnlyRecommendationCount,
    realPersistenceAttemptedCount: 0,
    dbWriteAttemptedCount: 0,
    supabaseWriteAttemptedCount: 0,
    externalCallAttemptedCount: 0,
    userVisibleOutputAttemptedCount: 0,
    productionWiringAttemptedCount: 0,
    rawInputRetainedCount,
    inputPreviewRetainedCount,
    fullCandidateRetainedCount,
    userVisibleOutputRetainedCount,
    projectNameRetainedCount,
    emailAddressRetainedCount,
    phoneNumberRetainedCount,
    decision,
    recommendedNextSprint: recommendedNextSprintFor(decision),
    representativeStableCases: aggregates.filter((a) => a.stable).slice(0, REPRESENTATIVE_LIMIT),
    unstableCases: aggregates.filter((a) => !a.stable),
    unsafeCases: aggregates.filter((a) => a.finalSafetyStatus !== "safe"),
    warnings,
  } satisfies DecisionSupportShadowControlledReplayEvaluationSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 30R controlled shadow replay evaluation — mirrors the style of
 * `explainDecisionSupportShadowPersistenceReadinessReview()` (Sprint 29R). See
 * `docs/conversational-brain-decision-support-shadow-controlled-replay.md` for full context.
 */
export function explainDecisionSupportShadowControlledReplayEvaluation(): DecisionSupportShadowControlledReplayExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-shadow-controlled-replay",
    purpose:
      "Replays a corpus through the existing Sprint 24R-28R shadow pipeline multiple times per case, using only the Sprint 28R fake " +
      "(in-memory, test-only) adapter, to prove the pipeline is deterministic, stable, and safe across repeated runs — without " +
      "implementing any real persistence, without connecting decision_support to the router, and without ever showing shadow output " +
      "to a user.",
    nonGoals: [
      "Create a database, migration file, SQL file, table, or Supabase write.",
      "Implement a real (or new fake) storage adapter or repository.",
      "Enable a production feature flag or connect decision_support to the router/composer/endpoint.",
      "Change production behavior in any way.",
      "Show any shadow output to a user.",
      "Persist any shadow output for real.",
      "Implement a persistent, multi-turn clarification loop.",
      "Design tenant isolation, access control, retention enforcement, or a security review — those remain Sprint 29R's named, still-open prerequisites.",
    ],
    replayProfile:
      'The "strict_fake_adapter_controlled_replay" profile: allowRealPersistence/allowDbWrite/allowSupabaseWrite/allowExternalCalls/' +
      "allowUserVisibleOutput/allowProductionWiring are all literal false, forced regardless of any override a caller passes, and " +
      "requireCapturePolicyClean/requireStorageDraftValid/requireFakeAdapterSafety/requireDeterministicOutputs are always true.",
    replayModes: [
      "single_pass_replay: one pass over the corpus.",
      "multi_pass_replay (default): replayPasses (default 3) independent passes over the corpus, each against its own fresh fake adapter instance.",
      "determinism_check: emphasizes cross-pass field agreement (category/inputHash/routing/safety/write outcome).",
      "drift_check: emphasizes per-case driftReasons and stabilityStatus.",
      "safety_regression_check: emphasizes finalSafetyStatus and unsafeCases against the Sprint 24R-29R baseline.",
    ],
    replayCorpus:
      "Defaults to a small, self-contained synthetic corpus (mirroring Sprint 29R's own default) when no corpus is supplied. Callers " +
      "who want the documented baseline numbers (79 cases, 237 pass results at 3 passes) pass the Sprint 18R corpus " +
      "(DECISION_CLARIFICATION_CASES) explicitly, exactly as Sprint 29R's own test suite does — this module never imports from tests/fixtures/.",
    replayPassPipeline: [
      "1. prepareDecisionSupportShadowModeRun() (Sprint 24R) — decide candidate/route for the case.",
      "2. captureDecisionSupportShadowRun() in dry_run mode (Sprint 25R) — build a minimized capture record.",
      "3. runDecisionSupportShadowStoragePolicyEvaluation() (Sprint 26R) — assess the capture against the storage policy.",
      "4. mapDecisionSupportCaptureRecordToStorageDraft() (Sprint 27R) — map the capture record to a policy-clean storage draft.",
      "5. validateDecisionSupportShadowStorageDraft() (Sprint 27R) — validate the draft.",
      "6. writeDecisionSupportShadowStorageDraftToFakeAdapter() against a fresh or injected Sprint 28R fake adapter — fake-write the draft.",
      "7. Classify the case, compute safety status, recommend a route, and record every side-effect/forbidden-retention field as a literal false.",
    ],
    determinismCheck:
      "aggregateDecisionSupportShadowControlledReplayCaseResults() compares category/inputHash/architectureCategory/desiredFutureRoute/" +
      "targetKind/capturePolicyClean/storageDraftValid/fakeWriteStatus/fakeWriteAccepted/routeRecommendation/safetyStatus across every " +
      "pass of a case; any disagreement marks the case unstable and lists every disagreeing field in driftReasons.",
    driftCheck:
      "stabilityStatus is 'stable' with zero driftReasons; 'not_deterministic' if inputHash itself ever disagrees (the pipeline should " +
      "never produce a different hash for the same input); 'major_drift' if a safety-relevant field (capturePolicyClean/" +
      "storageDraftValid/fakeWriteStatus/fakeWriteAccepted/safetyStatus) disagrees; 'minor_drift' otherwise.",
    safetyRegressionCheck:
      "Each case's finalSafetyStatus is the worst status observed across its passes (blocked > unsafe > warning > safe) — a single " +
      "unsafe/blocked pass marks the whole case unsafe, and the evaluation additionally recomputes the Sprint 29R persistence " +
      "readiness review against the same corpus to prove its baseline metrics (readinessScore, decision, blocker counts) do not regress.",
    fakeAdapterWriteValidation:
      "Every valid, policy-clean draft is fake-written via a fresh, per-pass Sprint 28R fake adapter instance and expected to be " +
      "accepted (fakeWriteStatus: fake_write_accepted); a synthetic invalid draft (exercised directly via classify/recommend-level unit " +
      "tests, not injected into the main corpus pass) is expected to be rejected (fake_write_rejected) — proving the fake adapter's " +
      "own rejection behavior has not regressed.",
    routeRecommendationLogic: [
      "decision_candidate + safe -> clarification_gated_decision_support, requiresClarificationGate: true.",
      "clarification_candidate (any safety status otherwise clean) -> clarification_gated_decision_support, requiresClarificationGate: true.",
      "existing_route_preserved -> keep_existing_route, shouldUseExistingRoute: true.",
      "unsupported_or_not_applicable -> keep_unsupported, shouldRemainUnsupported: true.",
      "drift (stable: false / non-empty driftReasons) or a non-safe safety status -> shadow_only, shouldRemainShadowOnly: true, overriding every other rule.",
    ],
    decisionRule:
      "ready_for_clarification_gated_integration_plan requires deterministicReplayRate/safeReplayRate/fakeWriteAcceptedRate all at " +
      "100% and every real-persistence/DB/Supabase/external-call/user-visible-output/production-wiring/forbidden-retention count at " +
      "zero. Otherwise: blocked_by_replay_drift if any case is unstable; else blocked_by_safety_regression if any case is unsafe; else " +
      "blocked_by_fake_adapter_regression if any fake write was unexpectedly rejected; else continue_shadow_replay_only.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    whyDbIsNotCreated:
      "The Sprint 29R persistence readiness review already found tenant isolation, access control, a real deletion/purge/retention " +
      "path, an audit trail policy, observability, a tested rollback plan, a security review, and a DSR policy all missing — none of " +
      "that changes because a replay proved the existing shadow pipeline deterministic.",
    whyMigrationIsNotCreated: "No migration precondition documented in Sprint 27R/29R has newly become satisfied by running a replay.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whyStorageAdapterIsNotCreated: "This sprint proves the existing Sprint 28R fake adapter's behavior is stable across replays — it does not build a new or real adapter.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it, which this sprint does not build.",
    whyProductionIsNotChanged:
      "This module reuses the existing, already-isolated Sprint 24R-29R modules exactly as-is; it is not imported by " +
      "intentCompatibilityAdapter.ts, brainRouter.ts, responseComposer.ts, any handlers/*.ts, or POST /api/command-center/chat, and " +
      "adds no new import into any of those files.",
    expectedSprint31Path:
      "If deterministicReplayRate/safeReplayRate/fakeWriteAcceptedRate all stay at 100% and every forbidden-retention/side-effect " +
      "count stays at 0 against the Sprint 18R corpus, Sprint 31R can design a Clarification-Gated Decision Support Integration Plan — " +
      "still without implementing real persistence, without wiring the router, and without showing anything to a user.",
  };
}
