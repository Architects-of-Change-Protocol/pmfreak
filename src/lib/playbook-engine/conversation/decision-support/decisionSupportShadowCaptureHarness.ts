/**
 * Sprint 25R — Decision Support Shadow Capture Harness.
 *
 * A pure, offline, deterministic capture harness that turns a Sprint 24R
 * `DecisionSupportShadowModeRun` into a minimized, redacted "capture record" — proving what a future
 * shadow capture *would* look like without ever writing a database, calling Supabase, showing
 * anything to a user, or executing any action.
 *
 * This is a capture *harness*, not a storage implementation. Two modes exist:
 *
 * - `"dry_run"` (the default): computes a capture record preview, never writes it anywhere.
 *   `sinkKind` stays `"none"`.
 * - `"test_only_in_memory"`: requires the caller to also pass `allowInMemoryCaptureForTests: true`
 *   and `policyAcknowledged: true` — writes the same minimized record into an in-memory sink the
 *   caller supplies. Nothing here is a real persistence layer: the sink is a plain in-process array
 *   that exists only for this module's own tests, is never wired to a database, file, or network
 *   call, and disappears the moment the process exits.
 *
 * Every capture is minimized before it exists: raw input is never retained (only a sanitized,
 * truncated, redacted preview plus a local deterministic hash), and neither the decision candidate's
 * full recommendation text nor the clarification candidate's full response text is ever retained —
 * only structural counts/flags (option counts, confidence, missing slots, route-option intents,
 * question counts). A dedicated set of capture gates blocks the capture outright (no record written
 * anywhere, `captureStatus: "capture_blocked_by_gate"`) if a caller forces `allowPersistence`,
 * `allowDbWrite`, `allowSupabaseWrite`, `allowUserVisibleOutput`, `allowExecution`, or any
 * `retainRawInput`/`retainFull*Candidate`/`retainUserVisibleOutput` policy override to `true`, or
 * uses `test_only_in_memory` mode without both `allowInMemoryCaptureForTests` and
 * `policyAcknowledged`.
 *
 * Reuses, rather than reimplements: the Sprint 24R Shadow Mode Prep contract
 * (`prepareDecisionSupportShadowModeRun` / `evaluateDecisionSupportShadowModeRun` /
 * `runDecisionSupportShadowModePrepEvaluation`), which itself reuses the Sprint 19R candidate handler
 * and Sprint 22R clarification strategy.
 *
 * Like every module in this package tree, this does not call the router, composer, or any
 * production handler; does not touch `POST /api/command-center/chat`; does not read/write a
 * database, call Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not
 * activate a feature flag; and does not connect `decision_support` to the router. See
 * `docs/conversational-brain-decision-support-shadow-capture-harness.md` for the full design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import {
  evaluateDecisionSupportShadowModeRun,
  prepareDecisionSupportShadowModeRun,
  runDecisionSupportShadowModePrepEvaluation,
} from "./decisionSupportShadowModePrep";
import type { DecisionSupportShadowModeInput, DecisionSupportShadowModeRun } from "./decisionSupportShadowModePrepTypes";

import type {
  DecisionSupportShadowCaptureCandidateKind,
  DecisionSupportShadowCaptureCandidateSummary,
  DecisionSupportShadowCaptureContext,
  DecisionSupportShadowCaptureGate,
  DecisionSupportShadowCaptureGateResult,
  DecisionSupportShadowCaptureHarnessEvaluationSummary,
  DecisionSupportShadowCaptureHarnessExplain,
  DecisionSupportShadowCaptureHarnessOptions,
  DecisionSupportShadowCaptureInputPolicy,
  DecisionSupportShadowCaptureMode,
  DecisionSupportShadowCaptureNextSprintRecommendation,
  DecisionSupportShadowCapturePolicyOverrides,
  DecisionSupportShadowCaptureRecord,
  DecisionSupportShadowCaptureResult,
  DecisionSupportShadowCaptureSafetySnapshot,
  DecisionSupportShadowCaptureSink,
  DecisionSupportShadowCaptureStatus,
} from "./decisionSupportShadowCaptureHarnessTypes";

export type {
  DecisionSupportShadowCaptureMode,
  DecisionSupportShadowCaptureStatus,
  DecisionSupportShadowCaptureRecordKind,
  DecisionSupportShadowCaptureSinkKind,
  DecisionSupportShadowCaptureGate,
  DecisionSupportShadowCaptureGateSeverity,
  DecisionSupportShadowCaptureGateResult,
  DecisionSupportShadowCaptureInputPolicy,
  DecisionSupportShadowCapturePolicyOverrides,
  DecisionSupportShadowCaptureContext,
  DecisionSupportShadowCaptureCandidateKind,
  DecisionSupportShadowCaptureCandidateSummary,
  DecisionSupportShadowCaptureSafetySnapshot,
  DecisionSupportShadowCaptureAuditMetadata,
  DecisionSupportShadowCaptureRecord,
  DecisionSupportShadowCaptureSink,
  DecisionSupportShadowCaptureResult,
  DecisionSupportShadowCaptureHarnessOptions,
  DecisionSupportShadowCaptureNextSprintRecommendation,
  DecisionSupportShadowCaptureHarnessEvaluationSummary,
  DecisionSupportShadowCaptureHarnessExplain,
} from "./decisionSupportShadowCaptureHarnessTypes";

export const DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_VERSION = "25R.1.0";

const DEFAULT_MAX_INPUT_PREVIEW_CHARS = 120;

// ─── Policy ───────────────────────────────────────────────────────────────────────────

/**
 * Returns the default, maximally-minimizing capture policy: no raw input, no full candidate, and
 * no user-visible output is ever retained; input is always hashed and redacted before preview.
 * `overrides` exists only so tests can force a policy field to `true` to prove that doing so blocks
 * the capture — it never loosens minimization in this module's own default behavior.
 */
export function createDecisionSupportShadowCapturePolicy(
  overrides: DecisionSupportShadowCapturePolicyOverrides = {},
): DecisionSupportShadowCaptureInputPolicy {
  return {
    // The four retain*/false fields are never actually loosened here, regardless of what a caller's
    // override object claims — forcing one of them to true is instead surfaced as a failing gate by
    // computeCaptureGateResults(), which reads the raw `overrides` object directly.
    retainRawInput: false,
    retainFullDecisionCandidate: false,
    retainFullClarificationCandidate: false,
    retainUserVisibleOutput: false,
    maxInputPreviewChars: overrides.maxInputPreviewChars ?? DEFAULT_MAX_INPUT_PREVIEW_CHARS,
    hashInput: true,
    redactPotentialEmails: true,
    redactPotentialPhoneNumbers: true,
    redactProjectId: overrides.redactProjectId ?? true,
  } satisfies DecisionSupportShadowCaptureInputPolicy;
}

// ─── Sanitization ─────────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+\d[\d\s-]{5,}\d)|\b\d{3,4}-\d{3,4}\b|\b\d{7,}\b/g;

function collapseWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/**
 * Deterministically sanitizes raw input into a safe preview: collapses whitespace, redacts anything
 * that looks like an email or a phone number, then truncates to `policy.maxInputPreviewChars`. Never
 * returns the untouched raw input for anything long enough or sensitive enough to matter — this is
 * the only representation of the input a capture record ever stores.
 */
export function sanitizeDecisionSupportShadowInput(input: string, policy: DecisionSupportShadowCaptureInputPolicy = createDecisionSupportShadowCapturePolicy()): string {
  let sanitized = collapseWhitespace(input);

  if (policy.redactPotentialEmails) {
    sanitized = sanitized.replace(EMAIL_REGEX, "[redacted-email]");
  }
  if (policy.redactPotentialPhoneNumbers) {
    sanitized = sanitized.replace(PHONE_REGEX, "[redacted-phone]");
  }

  const maxChars = policy.maxInputPreviewChars;
  if (sanitized.length > maxChars) {
    sanitized = `${sanitized.slice(0, maxChars).trimEnd()}…`;
  }

  return sanitized;
}

// ─── Hashing ──────────────────────────────────────────────────────────────────────────

/**
 * A small, dependency-free, deterministic 32-bit string hash (FNV-1a variant) — same input always
 * produces the same hash, different input very likely produces a different one. Not cryptographic;
 * this is a stable local fingerprint for dedup/audit purposes only, never a security boundary.
 */
function stableHash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Builds a stable, local-only, non-cryptographic hash of the raw input — `"dssh_<8-hex-chars>"`.
 * Never derived from or containing the raw input itself in the output; used so two captures of the
 * same underlying message can be correlated without ever storing that message.
 */
export function createDecisionSupportShadowInputHash(input: string): string {
  const hash = stableHash32(input);
  return `dssh_${hash.toString(16).padStart(8, "0")}`;
}

// ─── Candidate summary ────────────────────────────────────────────────────────────────

function evaluateDecisionCandidateSummarySafety(run: DecisionSupportShadowModeRun): boolean {
  const candidate = run.decisionCandidate;
  if (!candidate) return true;
  const safety = candidate.safety;
  return (
    safety.shouldExecuteAction === false &&
    safety.shouldCreateTask === false &&
    safety.shouldSendEmail === false &&
    safety.shouldWriteToDb === false &&
    safety.requiresHumanConfirmation === true &&
    safety.productionRoutingEnabled === false
  );
}

function evaluateClarificationCandidateSummarySafety(run: DecisionSupportShadowModeRun): boolean {
  const candidate = run.clarificationCandidate;
  if (!candidate) return true;
  const safety = candidate.safety;
  return (
    safety.shouldExecuteAction === false &&
    safety.shouldCreateTask === false &&
    safety.shouldSendEmail === false &&
    safety.shouldWriteToDb === false &&
    safety.requiresUserReply === true &&
    safety.productionRoutingEnabled === false
  );
}

/**
 * Reduces a shadow mode run's candidate (if any) to a minimized structural summary: counts,
 * confidence/ambiguity levels, missing slots, and route-option intents — never the full
 * recommendation/response text. Pure — reads only what `prepareDecisionSupportShadowModeRun()`
 * already computed.
 */
export function summarizeDecisionSupportShadowCandidate(run: DecisionSupportShadowModeRun): DecisionSupportShadowCaptureCandidateSummary {
  if (run.candidateKind === "decision_support_candidate" && run.decisionCandidate) {
    const candidate = run.decisionCandidate;
    return {
      candidateKind: "decision_support_candidate",
      status: run.status,
      decisionType: candidate.detectedDecisionType,
      decisionConfidence: candidate.recommendation.confidence,
      decisionOptionCount: candidate.options.length,
      decisionEvidenceNeededCount: candidate.evidenceNeeded.length,
      decisionRiskCount: candidate.risks.length,
      decisionWarningCount: candidate.warnings.length,
      safetyPass: evaluateDecisionCandidateSummarySafety(run),
    };
  }

  if (run.candidateKind === "clarification_response_candidate" && run.clarificationCandidate) {
    const candidate = run.clarificationCandidate;
    return {
      candidateKind: "clarification_response_candidate",
      status: run.status,
      clarificationStrategyType: candidate.strategyType,
      clarificationAmbiguityLevel: candidate.ambiguityLevel,
      clarificationMissingSlots: [...candidate.missingSlots],
      clarificationRouteOptionIntents: candidate.suggestedRouteOptions.map((option) => option.intent),
      clarificationQuestionCount: 1 + candidate.secondaryQuestions.length,
      safetyPass: evaluateClarificationCandidateSummarySafety(run),
    };
  }

  if (run.candidateKind === "existing_route_preserved") {
    return { candidateKind: "existing_route_preserved", status: run.status, safetyPass: true };
  }

  return { candidateKind: "none", status: run.status, safetyPass: true };
}

// ─── Capture gates ────────────────────────────────────────────────────────────────────

const BLOCKING_CAPTURE_GATES = new Set<DecisionSupportShadowCaptureGate>([
  "capture_default_off",
  "test_only_mode",
  "no_db_persistence",
  "no_supabase",
  "no_user_visible_output",
  "no_execution",
  "no_raw_input_retention",
  "candidate_minimized",
  "shadow_run_acceptable",
  "capture_policy_acknowledged",
]);

function isShadowRunAcceptable(run: DecisionSupportShadowModeRun): boolean {
  return (
    run.allBlockingGatesPassed === true &&
    run.shouldReturnCandidateToUser === false &&
    run.shouldPersistShadowResult === false &&
    run.shouldExecuteAction === false &&
    run.shouldSendEmail === false &&
    run.shouldCreateTask === false &&
    run.shouldWriteToDb === false
  );
}

function computeCaptureGateResults(params: {
  context: DecisionSupportShadowCaptureContext;
  policyOverrides: DecisionSupportShadowCaptureContext["policy"];
  mode: DecisionSupportShadowCaptureMode;
  run: DecisionSupportShadowModeRun;
}): DecisionSupportShadowCaptureGateResult[] {
  const { context, policyOverrides, mode, run } = params;

  const knownModes: DecisionSupportShadowCaptureMode[] = ["dry_run", "test_only_in_memory"];
  const modeIsKnown = knownModes.includes(mode);

  const allowInMemory = context.allowInMemoryCaptureForTests === true;
  const policyAcknowledged = context.policyAcknowledged === true;
  const allowDbWrite = context.allowDbWrite === true;
  const allowPersistence = context.allowPersistence === true;
  const allowSupabaseWrite = context.allowSupabaseWrite === true;
  const allowUserVisibleOutput = context.allowUserVisibleOutput === true;
  const allowExecution = context.allowExecution === true;

  const retainRawInputForced = policyOverrides?.retainRawInput === true;
  const retainFullDecisionForced = policyOverrides?.retainFullDecisionCandidate === true;
  const retainFullClarificationForced = policyOverrides?.retainFullClarificationCandidate === true;
  const retainUserVisibleOutputForced = policyOverrides?.retainUserVisibleOutput === true;

  const testOnlyModePassed = mode === "dry_run" || (mode === "test_only_in_memory" && allowInMemory);
  const capturePolicyAcknowledgedPassed = mode === "dry_run" || policyAcknowledged;
  const candidateMinimizedPassed = !retainFullDecisionForced && !retainFullClarificationForced && !retainUserVisibleOutputForced;
  const shadowRunAcceptablePassed = isShadowRunAcceptable(run);

  const gates: DecisionSupportShadowCaptureGateResult[] = [
    {
      gate: "capture_default_off",
      passed: modeIsKnown,
      reason: modeIsKnown
        ? `mode "${mode}" is a recognized offline capture mode.`
        : `mode "${String(mode)}" is not a recognized offline capture mode — capture defaults to blocked, never to a production write.`,
      severity: "blocking",
    },
    {
      gate: "test_only_mode",
      passed: testOnlyModePassed,
      reason: testOnlyModePassed
        ? "mode is dry_run, or test_only_in_memory with allowInMemoryCaptureForTests explicitly true."
        : "test_only_in_memory was requested without allowInMemoryCaptureForTests: true — the in-memory sink is opt-in only.",
      severity: "blocking",
    },
    {
      gate: "no_db_persistence",
      passed: !allowDbWrite && !allowPersistence,
      reason: allowDbWrite || allowPersistence
        ? "context.allowDbWrite/allowPersistence was forced true — this module never writes a database."
        : "allowDbWrite and allowPersistence are not true — no database write is ever attempted.",
      severity: "blocking",
    },
    {
      gate: "no_supabase",
      passed: !allowSupabaseWrite,
      reason: allowSupabaseWrite
        ? "context.allowSupabaseWrite was forced true — this module never calls Supabase."
        : "allowSupabaseWrite is not true — Supabase is never called.",
      severity: "blocking",
    },
    {
      gate: "no_user_visible_output",
      passed: !allowUserVisibleOutput && !retainUserVisibleOutputForced,
      reason: allowUserVisibleOutput || retainUserVisibleOutputForced
        ? "context.allowUserVisibleOutput or policy.retainUserVisibleOutput was forced true — no capture record is ever shown to a user."
        : "allowUserVisibleOutput is not true and retainUserVisibleOutput is not forced — no capture record is ever shown to a user.",
      severity: "blocking",
    },
    {
      gate: "no_execution",
      passed: !allowExecution,
      reason: allowExecution
        ? "context.allowExecution was forced true — no action, task, or email is ever executed by this module."
        : "allowExecution is not true — no action, task, or email is ever executed.",
      severity: "blocking",
    },
    {
      gate: "no_raw_input_retention",
      passed: !retainRawInputForced,
      reason: retainRawInputForced
        ? "policy.retainRawInput was forced true — raw input is never retained regardless; the capture is blocked instead."
        : "retainRawInput is false — only a sanitized preview and a local hash are ever kept.",
      severity: "blocking",
    },
    {
      gate: "candidate_minimized",
      passed: candidateMinimizedPassed,
      reason: candidateMinimizedPassed
        ? "Neither the full decision candidate, the full clarification candidate, nor user-visible output is retained — only structural summaries."
        : "A retainFull*/retainUserVisibleOutput policy override was forced true — the capture is blocked rather than storing full candidate text.",
      severity: "blocking",
    },
    {
      gate: "shadow_run_acceptable",
      passed: shadowRunAcceptablePassed,
      reason: shadowRunAcceptablePassed
        ? "The source Sprint 24R shadow mode run passed every blocking gate and carries every side-effect flag as false."
        : "The source Sprint 24R shadow mode run did not pass every blocking gate, or carried a non-false side-effect flag.",
      severity: "blocking",
    },
    {
      gate: "capture_policy_acknowledged",
      passed: capturePolicyAcknowledgedPassed,
      reason: capturePolicyAcknowledgedPassed
        ? "mode is dry_run (no acknowledgement required), or test_only_in_memory with policyAcknowledged: true."
        : "test_only_in_memory was requested without policyAcknowledged: true.",
      severity: "blocking",
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

// ─── Capture record ───────────────────────────────────────────────────────────────────

function deterministicCaptureIdFrom(runId: string, mode: DecisionSupportShadowCaptureMode): string {
  return `capture-${mode}-${runId}`;
}

const SAFETY_SNAPSHOT: DecisionSupportShadowCaptureSafetySnapshot = {
  sourceShadowRunAllBlockingGatesPassed: true,
  shouldReturnCandidateToUser: false,
  shouldPersistShadowResult: false,
  shouldExecuteAction: false,
  shouldSendEmail: false,
  shouldCreateTask: false,
  shouldWriteToDb: false,
  userVisibleOutputAllowed: false,
  persistenceAllowed: false,
  executionAllowed: false,
  productionRouteChangeAllowed: false,
};

/**
 * Builds a `DecisionSupportShadowCaptureRecord` for a shadow mode run: a sanitized input preview, a
 * local input hash, a minimized candidate summary, a safety snapshot, and every capture gate result
 * — but never the raw input, never the full decision/clarification candidate, and never any
 * user-visible output. `sinkKind`/`mode`/`captureStatus` reflect what the caller requested; this
 * function itself never writes anywhere — see `captureDecisionSupportShadowRun()` for the sink-write
 * decision.
 */
export function createDecisionSupportShadowCaptureRecord(
  run: DecisionSupportShadowModeRun,
  context: DecisionSupportShadowCaptureContext = {},
): DecisionSupportShadowCaptureRecord {
  const mode: DecisionSupportShadowCaptureMode = context.mode ?? "dry_run";
  const policy = createDecisionSupportShadowCapturePolicy(context.policy);

  const gateResults = computeCaptureGateResults({ context, policyOverrides: context.policy, mode, run });
  const blockingFailures = gateResults.filter((g) => BLOCKING_CAPTURE_GATES.has(g.gate) && !g.passed);
  const allBlockingGatesPassed = blockingFailures.length === 0;

  const candidateSummary = summarizeDecisionSupportShadowCandidate(run);

  let captureStatus: DecisionSupportShadowCaptureStatus;
  if (!allBlockingGatesPassed) {
    captureStatus = "capture_blocked_by_gate";
  } else if (run.status === "not_applicable") {
    captureStatus = "capture_not_applicable";
  } else if (mode === "test_only_in_memory") {
    captureStatus = "in_memory_capture_recorded";
  } else {
    captureStatus = "capture_preview_generated";
  }

  const sinkKind = allBlockingGatesPassed && mode === "test_only_in_memory" ? "in_memory_test_only" : "none";

  const warnings: string[] = [];
  for (const failure of blockingFailures) {
    warnings.push(`Blocking capture gate "${failure.gate}" failed: ${failure.reason}`);
  }
  warnings.push(...run.warnings);

  return {
    kind: "decision_support_shadow_capture_record",
    captureId: deterministicCaptureIdFrom(run.id, mode),
    sourceRunId: run.id,
    generatedAt: context.now,
    mode,
    sinkKind,
    inputHash: createDecisionSupportShadowInputHash(run.input),
    inputPreview: sanitizeDecisionSupportShadowInput(run.input, policy),
    rawInputRetained: false,
    fullDecisionCandidateRetained: false,
    fullClarificationCandidateRetained: false,
    userVisibleOutputRetained: false,
    architectureCategory: run.architectureCategory,
    desiredFutureRoute: run.desiredFutureRoute,
    targetKind: run.targetKind,
    sourceStatus: run.status,
    sourceCandidateKind: run.candidateKind,
    captureStatus,
    candidateSummary,
    safetySnapshot: { ...SAFETY_SNAPSHOT, sourceShadowRunAllBlockingGatesPassed: run.allBlockingGatesPassed },
    gateResults,
    allBlockingGatesPassed,
    warnings,
    auditMetadata: {
      captureHarnessVersion: DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_VERSION,
      strategySource: "sprint_24_shadow_mode_prep",
      storagePolicy: "no_persistence",
      adapterMappingRealChanged: false,
      routerChanged: false,
      composerChanged: false,
      endpointChanged: false,
      dbWriteAttempted: false,
      supabaseWriteAttempted: false,
      externalCallAttempted: false,
      limitations: [
        "This is a capture harness, not a storage implementation — the only sink is an in-memory, test-only array.",
        "Reuses the Sprint 24R shadow mode prep contract as-is; does not harden it.",
        "Does not implement a retention policy, a schema migration, or any real persistence — that is the explicit Sprint 26R candidate.",
      ],
    },
  } satisfies DecisionSupportShadowCaptureRecord;
}

// ─── In-memory sink ───────────────────────────────────────────────────────────────────

/**
 * Creates a fresh, empty, in-process, test-only capture sink. Not backed by a database, file, or
 * network call of any kind — its contents live only in this JS array and vanish when the process
 * exits or `clear()` is called. Never wired to any production code path.
 */
export function createInMemoryDecisionSupportShadowCaptureSink(): DecisionSupportShadowCaptureSink {
  const records: DecisionSupportShadowCaptureRecord[] = [];

  return {
    kind: "in_memory_test_only",
    records,
    write(record: DecisionSupportShadowCaptureRecord): DecisionSupportShadowCaptureRecord {
      records.push(record);
      return record;
    },
    list(): DecisionSupportShadowCaptureRecord[] {
      return [...records];
    },
    clear(): void {
      records.length = 0;
    },
    count(): number {
      return records.length;
    },
  } satisfies DecisionSupportShadowCaptureSink;
}

// ─── Capture ──────────────────────────────────────────────────────────────────────────

function computeIsAcceptableCapture(result: Pick<DecisionSupportShadowCaptureResult, "captureStatus" | "rawInputRetained" | "fullDecisionCandidateRetained" | "fullClarificationCandidateRetained" | "userVisibleOutputRetained" | "dbWriteAttempted" | "supabaseWriteAttempted" | "shouldReturnCandidateToUser" | "shouldPersistShadowResult" | "shouldExecuteAction" | "shouldSendEmail" | "shouldCreateTask" | "shouldWriteToDb">): boolean {
  if (result.captureStatus === "capture_disabled") return false;
  if (result.rawInputRetained) return false;
  if (result.fullDecisionCandidateRetained) return false;
  if (result.fullClarificationCandidateRetained) return false;
  if (result.userVisibleOutputRetained) return false;
  if (result.dbWriteAttempted) return false;
  if (result.supabaseWriteAttempted) return false;
  if (result.shouldReturnCandidateToUser) return false;
  if (result.shouldPersistShadowResult) return false;
  if (result.shouldExecuteAction) return false;
  if (result.shouldSendEmail) return false;
  if (result.shouldCreateTask) return false;
  if (result.shouldWriteToDb) return false;
  return true;
}

/**
 * Captures a single Sprint 24R shadow mode run: builds a minimized `DecisionSupportShadowCaptureRecord`,
 * and — only when every blocking capture gate passes and `mode === "test_only_in_memory"` — writes it
 * into the supplied in-memory sink. In `"dry_run"` mode (the default), or whenever any blocking gate
 * fails, nothing is ever written anywhere: `recordCreated` reflects only whether a record was
 * computed, `sinkKind`/`captureStatus` reflect whether (and where) it was actually written. Never
 * calls a database, Supabase, an external service, `fetch`, or an LLM; never shows anything to a
 * user; never executes an action.
 */
export function captureDecisionSupportShadowRun(
  run: DecisionSupportShadowModeRun,
  context: DecisionSupportShadowCaptureContext = {},
  sink?: DecisionSupportShadowCaptureSink,
): DecisionSupportShadowCaptureResult {
  const mode: DecisionSupportShadowCaptureMode = context.mode ?? "dry_run";
  const record = createDecisionSupportShadowCaptureRecord(run, context);

  const gateFailures = record.gateResults.filter((g) => !g.passed);
  const blockingGateFailureCount = gateFailures.filter((g) => BLOCKING_CAPTURE_GATES.has(g.gate)).length;

  const shouldWriteToSink = record.allBlockingGatesPassed && mode === "test_only_in_memory" && Boolean(sink);
  if (shouldWriteToSink && sink) {
    sink.write(record);
  }

  const recordCreated = record.captureStatus !== "capture_blocked_by_gate";

  const base = {
    id: run.id,
    input: run.input,
    sourceRunStatus: run.status,
    sourceCandidateKind: run.candidateKind,
    captureStatus: record.captureStatus,
    mode,
    sinkKind: record.sinkKind,
    recordCreated,
    record: recordCreated ? record : undefined,
    gateFailureCount: gateFailures.length,
    blockingGateFailureCount,
    rawInputRetained: false as const,
    fullDecisionCandidateRetained: false as const,
    fullClarificationCandidateRetained: false as const,
    userVisibleOutputRetained: false as const,
    dbWriteAttempted: false as const,
    supabaseWriteAttempted: false as const,
    shouldReturnCandidateToUser: false as const,
    shouldPersistShadowResult: false as const,
    shouldExecuteAction: false as const,
    shouldSendEmail: false as const,
    shouldCreateTask: false as const,
    shouldWriteToDb: false as const,
    warnings: record.warnings,
  };

  return {
    ...base,
    isAcceptableCapture: computeIsAcceptableCapture(base),
  } satisfies DecisionSupportShadowCaptureResult;
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

/**
 * Runs `captureDecisionSupportShadowRun()` over every case in a `DecisionClarificationCase[]`
 * corpus (default: the Sprint 18R corpus, when the caller passes it in) — first preparing each
 * case's Sprint 24R shadow mode run via `prepareDecisionSupportShadowModeRun()`, then capturing it.
 * Pure — never mutates `cases`, never calls the router, composer, any production handler, a
 * database, Supabase, or any external service, never calls `fetch` or an LLM, and never activates a
 * feature flag.
 */
export function runDecisionSupportShadowCaptureHarnessEvaluation(
  cases: DecisionClarificationCase[],
  options: DecisionSupportShadowCaptureHarnessOptions = {},
): DecisionSupportShadowCaptureResult[] {
  return cases.map((architectureCase) => {
    const input = toShadowModeInput(architectureCase);
    if (options.now) input.now = options.now;
    const run = prepareDecisionSupportShadowModeRun(input, {});
    const context: DecisionSupportShadowCaptureContext = { ...options.context, now: options.now ?? options.context?.now };
    return captureDecisionSupportShadowRun(run, context, options.sink);
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

const ALL_CAPTURE_STATUSES: DecisionSupportShadowCaptureStatus[] = [
  "capture_disabled",
  "capture_preview_generated",
  "in_memory_capture_recorded",
  "capture_blocked_by_gate",
  "capture_not_applicable",
];

const ALL_CANDIDATE_KINDS: DecisionSupportShadowCaptureCandidateKind[] = [
  "decision_support_candidate",
  "clarification_response_candidate",
  "existing_route_preserved",
  "none",
];

const ALL_CAPTURE_GATES: DecisionSupportShadowCaptureGate[] = [
  "capture_default_off",
  "test_only_mode",
  "no_db_persistence",
  "no_supabase",
  "no_user_visible_output",
  "no_execution",
  "no_raw_input_retention",
  "candidate_minimized",
  "shadow_run_acceptable",
  "capture_policy_acknowledged",
  "adapter_unchanged",
  "router_unchanged",
];

const REPRESENTATIVE_LIMIT = 5;

function computeRecommendedNextSprint(summary: {
  acceptableCaptureRate: number;
  rawInputRetainedCount: number;
  fullDecisionCandidateRetainedCount: number;
  fullClarificationCandidateRetainedCount: number;
  userVisibleOutputRetainedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  shouldExecuteActionCount: number;
  shouldSendEmailCount: number;
  shouldCreateTaskCount: number;
  shouldWriteToDbCount: number;
  shouldReturnCandidateToUserCount: number;
  shouldPersistShadowResultCount: number;
  inMemoryCaptureRecordedCount: number;
}): { recommendedNextSprint: DecisionSupportShadowCaptureNextSprintRecommendation; recommendation: string } {
  if (summary.acceptableCaptureRate < 100) {
    return {
      recommendedNextSprint: "Sprint 26R — Shadow Capture Harness Hardening",
      recommendation: `acceptableCaptureRate is ${summary.acceptableCaptureRate}%, below 100% — harden the failing gate(s) before designing a storage policy.`,
    };
  }

  const retentionViolationCount =
    summary.rawInputRetainedCount +
    summary.fullDecisionCandidateRetainedCount +
    summary.fullClarificationCandidateRetainedCount +
    summary.userVisibleOutputRetainedCount;

  if (retentionViolationCount > 0) {
    return {
      recommendedNextSprint: "Sprint 26R — Shadow Capture Privacy Hardening",
      recommendation: `${retentionViolationCount} capture(s) retained raw input, a full candidate, or user-visible output — fix minimization before designing a storage policy.`,
    };
  }

  const sideEffectCount =
    summary.dbWriteAttemptedCount +
    summary.supabaseWriteAttemptedCount +
    summary.shouldExecuteActionCount +
    summary.shouldSendEmailCount +
    summary.shouldCreateTaskCount +
    summary.shouldWriteToDbCount +
    summary.shouldReturnCandidateToUserCount +
    summary.shouldPersistShadowResultCount;

  if (sideEffectCount > 0) {
    return {
      recommendedNextSprint: "Sprint 26R — Shadow Capture Side-Effect Hardening",
      recommendation: `${sideEffectCount} capture(s) carried a non-zero side-effect flag — harden the offending code path before designing a storage policy.`,
    };
  }

  if (summary.inMemoryCaptureRecordedCount === 0) {
    return {
      recommendedNextSprint: "Sprint 26R — In-Memory Shadow Capture Validation",
      recommendation: "Dry-run capture is clean, but no case was ever captured in test_only_in_memory mode — validate the in-memory sink path before designing a storage policy.",
    };
  }

  return {
    recommendedNextSprint: "Sprint 26R — Shadow Capture Storage Policy / Default-Off Persistence Plan",
    recommendation:
      "Every metric is clean in both dry_run and test_only_in_memory modes: 100% acceptable captures, zero retention violations, zero side effects, and the in-memory sink path is validated — " +
      "the harness is ready for a Sprint 26R storage/retention policy design (still default-off, still no real persistence).",
  };
}

/**
 * Turns a `runDecisionSupportShadowCaptureHarnessEvaluation()` result array into a review-ready
 * report: counts by capture status/candidate kind/failed gate, retention/side-effect counts
 * (expected to be zero everywhere), representative capture records, weak captures, and a Sprint 26R
 * recommendation. Pure — takes an already-computed result array rather than re-running anything.
 */
export function summarizeDecisionSupportShadowCaptureHarnessEvaluation(
  results: DecisionSupportShadowCaptureResult[],
): DecisionSupportShadowCaptureHarnessEvaluationSummary {
  const totalCases = results.length;

  const byCaptureStatus = Object.fromEntries(ALL_CAPTURE_STATUSES.map((s) => [s, 0])) as Record<DecisionSupportShadowCaptureStatus, number>;
  const byCandidateKind = Object.fromEntries(ALL_CANDIDATE_KINDS.map((c) => [c, 0])) as Record<DecisionSupportShadowCaptureCandidateKind, number>;
  const byFailedGate = Object.fromEntries(ALL_CAPTURE_GATES.map((g) => [g, 0])) as Record<DecisionSupportShadowCaptureGate, number>;

  let capturePreviewGeneratedCount = 0;
  let inMemoryCaptureRecordedCount = 0;
  let captureBlockedByGateCount = 0;
  let captureNotApplicableCount = 0;
  let acceptableCaptureCount = 0;
  let allBlockingGatesPassedCount = 0;
  let decisionCandidateCaptureCount = 0;
  let clarificationCandidateCaptureCount = 0;
  let existingRouteCaptureCount = 0;

  for (const r of results) {
    byCaptureStatus[r.captureStatus] += 1;
    const candidateKind = r.record?.sourceCandidateKind ?? "none";
    byCandidateKind[candidateKind] += 1;

    if (r.captureStatus === "capture_preview_generated") capturePreviewGeneratedCount += 1;
    if (r.captureStatus === "in_memory_capture_recorded") inMemoryCaptureRecordedCount += 1;
    if (r.captureStatus === "capture_blocked_by_gate") captureBlockedByGateCount += 1;
    if (r.captureStatus === "capture_not_applicable") captureNotApplicableCount += 1;
    if (r.isAcceptableCapture) acceptableCaptureCount += 1;
    if (r.record?.allBlockingGatesPassed) allBlockingGatesPassedCount += 1;

    if (candidateKind === "decision_support_candidate") decisionCandidateCaptureCount += 1;
    if (candidateKind === "clarification_response_candidate") clarificationCandidateCaptureCount += 1;
    if (candidateKind === "existing_route_preserved") existingRouteCaptureCount += 1;

    for (const gateResult of r.record?.gateResults ?? []) {
      if (!gateResult.passed) byFailedGate[gateResult.gate] += 1;
    }
  }

  const captureAttemptCount = totalCases;
  const rawInputRetainedCount = results.filter((r) => r.rawInputRetained).length;
  const fullDecisionCandidateRetainedCount = results.filter((r) => r.fullDecisionCandidateRetained).length;
  const fullClarificationCandidateRetainedCount = results.filter((r) => r.fullClarificationCandidateRetained).length;
  const userVisibleOutputRetainedCount = results.filter((r) => r.userVisibleOutputRetained).length;
  const dbWriteAttemptedCount = results.filter((r) => r.dbWriteAttempted).length;
  const supabaseWriteAttemptedCount = results.filter((r) => r.supabaseWriteAttempted).length;
  const shouldReturnCandidateToUserCount = results.filter((r) => r.shouldReturnCandidateToUser).length;
  const shouldPersistShadowResultCount = results.filter((r) => r.shouldPersistShadowResult).length;
  const shouldExecuteActionCount = results.filter((r) => r.shouldExecuteAction).length;
  const shouldSendEmailCount = results.filter((r) => r.shouldSendEmail).length;
  const shouldCreateTaskCount = results.filter((r) => r.shouldCreateTask).length;
  const shouldWriteToDbCount = results.filter((r) => r.shouldWriteToDb).length;

  const representativeCaptureRecords = results.filter((r) => r.recordCreated).slice(0, REPRESENTATIVE_LIMIT);
  const weakCaptures = results.filter((r) => !r.isAcceptableCapture).slice(0, REPRESENTATIVE_LIMIT);

  const acceptableCaptureRate = rateOf(acceptableCaptureCount, totalCases);

  const { recommendedNextSprint, recommendation } = computeRecommendedNextSprint({
    acceptableCaptureRate,
    rawInputRetainedCount,
    fullDecisionCandidateRetainedCount,
    fullClarificationCandidateRetainedCount,
    userVisibleOutputRetainedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    shouldExecuteActionCount,
    shouldSendEmailCount,
    shouldCreateTaskCount,
    shouldWriteToDbCount,
    shouldReturnCandidateToUserCount,
    shouldPersistShadowResultCount,
    inMemoryCaptureRecordedCount,
  });

  return {
    totalCases,
    evaluatedRuns: totalCases,
    captureAttemptCount,
    capturePreviewGeneratedCount,
    inMemoryCaptureRecordedCount,
    captureBlockedByGateCount,
    captureNotApplicableCount,
    acceptableCaptureCount,
    acceptableCaptureRate,
    allBlockingGatesPassedCount,
    allBlockingGatesPassedRate: rateOf(allBlockingGatesPassedCount, totalCases),
    rawInputRetainedCount,
    fullDecisionCandidateRetainedCount,
    fullClarificationCandidateRetainedCount,
    userVisibleOutputRetainedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    shouldReturnCandidateToUserCount,
    shouldPersistShadowResultCount,
    shouldExecuteActionCount,
    shouldSendEmailCount,
    shouldCreateTaskCount,
    shouldWriteToDbCount,
    decisionCandidateCaptureCount,
    clarificationCandidateCaptureCount,
    existingRouteCaptureCount,
    byCaptureStatus,
    byCandidateKind,
    byFailedGate,
    representativeCaptureRecords,
    weakCaptures,
    recommendedNextSprint,
    recommendation,
  } satisfies DecisionSupportShadowCaptureHarnessEvaluationSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 25R shadow capture harness — mirrors the style of
 * `explainDecisionSupportShadowModePrep()` (Sprint 24R). See
 * `docs/conversational-brain-decision-support-shadow-capture-harness.md` for full context.
 */
export function explainDecisionSupportShadowCaptureHarness(): DecisionSupportShadowCaptureHarnessExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-shadow-capture-harness",
    purpose:
      "Turns a Sprint 24R DecisionSupportShadowModeRun into a minimized, redacted, offline capture record — proving what a future shadow " +
      "capture would look like without writing a database, calling Supabase, showing anything to a user, or executing any action. Two " +
      "modes: dry_run (preview only, never written anywhere) and test_only_in_memory (written to an explicit, caller-supplied, " +
      "in-process array — opt-in via allowInMemoryCaptureForTests + policyAcknowledged).",
    nonGoals: [
      "Implement a real storage/persistence layer.",
      "Connect shadow capture to the router or request path.",
      "Activate a real feature flag.",
      "Change production behavior in any way.",
      "Show any capture record to a user.",
      "Persist any capture record outside an explicit, in-process, test-only array.",
      "Design a retention or deletion policy — that is the explicit Sprint 26R candidate.",
      "Harden the Sprint 19R candidate handler, Sprint 22R clarification strategy, or Sprint 24R shadow mode prep contract.",
    ],
    captureModes: [
      "dry_run (default): computes a capture record preview; sinkKind stays 'none'; nothing is ever written anywhere.",
      "test_only_in_memory: requires allowInMemoryCaptureForTests: true AND policyAcknowledged: true; writes the same minimized record " +
        "into an in-memory sink the caller supplies. The sink is a plain in-process array, never a database, file, or network call.",
    ],
    defaultDryRunPolicy:
      "When mode is omitted or 'dry_run', captureStatus is 'capture_preview_generated' (or 'capture_not_applicable' for a not_applicable " +
      "source run), sinkKind is 'none', recordCreated is true, and every retention/side-effect flag on the result is a literal false.",
    testOnlyInMemoryPolicy:
      "When mode is 'test_only_in_memory' and both allowInMemoryCaptureForTests and policyAcknowledged are true, the same minimized " +
      "record is written into the supplied sink; captureStatus becomes 'in_memory_capture_recorded', sinkKind becomes " +
      "'in_memory_test_only'. Omitting either flag fails the test_only_mode or capture_policy_acknowledged blocking gate instead, and " +
      "nothing is written.",
    noPersistencePolicy:
      "No database, Supabase, file, or network write ever happens in this module — dbWriteAttempted/supabaseWriteAttempted/ " +
      "externalCallAttempted are literal false constants on every record's auditMetadata, never computed from caller input.",
    minimizationPolicy:
      "createDecisionSupportShadowCapturePolicy() always returns retainRawInput/retainFullDecisionCandidate/ " +
      "retainFullClarificationCandidate/retainUserVisibleOutput: false, regardless of any override a caller passes — forcing one of " +
      "those to true does not loosen minimization, it fails the no_raw_input_retention or candidate_minimized blocking gate and blocks " +
      "the capture instead.",
    sanitizationPolicy:
      "sanitizeDecisionSupportShadowInput() deterministically collapses whitespace, redacts email-shaped and phone-number-shaped " +
      "substrings, and truncates to maxInputPreviewChars (default 120) — the only representation of the input ever stored in a " +
      "capture record, alongside a local, non-cryptographic, stable hash (createDecisionSupportShadowInputHash()).",
    captureGates: [
      "capture_default_off / test_only_mode: blocking; fail if mode is unrecognized, or test_only_in_memory is requested without " +
        "allowInMemoryCaptureForTests: true.",
      "no_db_persistence / no_supabase: blocking; fail if allowDbWrite/allowPersistence/allowSupabaseWrite is forced true.",
      "no_user_visible_output: blocking; fails if allowUserVisibleOutput or policy.retainUserVisibleOutput is forced true.",
      "no_execution: blocking; fails if allowExecution is forced true.",
      "no_raw_input_retention / candidate_minimized: blocking; fail if any retainRawInput/retainFull*Candidate/retainUserVisibleOutput " +
        "policy override is forced true.",
      "shadow_run_acceptable: blocking; fails if the source Sprint 24R shadow mode run did not pass every blocking gate or carries a " +
        "non-false side-effect flag.",
      "capture_policy_acknowledged: blocking; fails if test_only_in_memory is requested without policyAcknowledged: true.",
      "adapter_unchanged / router_unchanged: informational; always true because this module imports neither.",
    ],
    whyRawInputIsNotRetained:
      "A capture record exists to prove capture behavior, not to store user messages verbatim — retaining raw input would create an " +
      "un-redacted copy of potentially sensitive PM conversation content with no retention or deletion policy. Only a sanitized, " +
      "truncated, redacted preview and a local hash are kept.",
    whyFullCandidatesAreNotRetained:
      "The Sprint 19R decision candidate's recommendation text and the Sprint 22R clarification candidate's response text can both " +
      "restate or elaborate on the original message. Retaining either in full would reintroduce the same sensitive-content risk raw " +
      "input retention avoids — the capture record keeps only structural counts/flags (option counts, confidence, missing slots, " +
      "route-option intents, question counts) instead.",
    whyDbSupabaseAreForbidden:
      "No retention policy, schema review, or deletion mechanism exists yet for shadow capture output — writing it to a real database " +
      "or Supabase today would create ungoverned data. Designing that governance is the explicit Sprint 26R candidate.",
    whyUserVisibleOutputIsForbidden:
      "This sprint captures for offline evaluation only; it has not made any decision about whether or how a capture record should ever " +
      "reach a user, and doing so is a separate, deliberate integration decision out of scope here.",
    expectedSprint26Path:
      "If acceptableCaptureRate and allBlockingGatesPassedRate stay at 100% in both dry_run and test_only_in_memory modes, and every " +
      "retention/side-effect count stays at 0, Sprint 26R can design a real (still default-off) storage/retention policy for shadow " +
      "capture output — not an activation of persistence, and not a router integration.",
  };
}
