/**
 * P2-12 — PM Execution Center canonical action-to-outcome read model.
 *
 * This module is an EXPERIENCE / READ MODEL over the canonical P2 operational flow,
 * exactly like P2-11's `attention-read-model.ts`. It owns no records, defines no second
 * Action/Task/Outcome/Observation aggregate, mints no identity and adds no status. It
 * only joins what `GET /api/operational-flow` already returns and projects the stages a
 * PM continues after a Decision has been recorded.
 *
 * Every link below is a real persisted reference — never a timestamp guess, title match
 * or array-order assumption:
 *
 *   Decision       operational_decision_records.id
 *   -> Action      material_action_proposals.source_decision_id
 *   -> Task        execution_tasks.source_payload.sourceActionId  (P2-07 unique index)
 *   -> Execution   internal_task_executions.task_id
 *   -> Outcome     canonical_task_outcomes.task_id
 *   -> Observation canonical_outcome_observations.outcome_id
 *   -> Lineage     CompleteLineageProjection.outcomeId            (P2-10)
 *
 * Deliberately framework-free (no React, no SWR) so the domain boundaries — above all
 * "Task completion is not Outcome achievement" — are exercised as real behaviour in
 * tests rather than asserted by scanning source text.
 */

import type { CompleteLineageProjection, OperationalSummary } from "@/lib/operational-flow/types";

type AnyRecord = Record<string, unknown>;

/** Decision statuses P2-06 accepts as a source for a Material Action. Read from the
 *  server rule in `proposeGovernedMaterialAction` — never widened here. */
export const ACTION_ELIGIBLE_DECISION_STATUSES: readonly string[] = ["accepted", "modified"];

/** Governance states P2-07 accepts before an Action may become a Task. Read from
 *  `dispatch_governed_action_to_internal_task` — never widened here. */
export const TASK_ELIGIBLE_GOVERNANCE_STATES: readonly string[] = ["authorized", "not_required"];

/** Canonical internal execution commands (P2-08 `InternalExecutionCommand`). No UI-only
 *  command is invented, and no command is renamed into a friendlier concept. */
export const EXECUTION_COMMANDS: readonly string[] = ["queue", "start", "block", "fail", "retry", "complete"];

/** Terminal execution states after which internal work is finished. Completion here says
 *  nothing whatsoever about the Outcome — see `boundary` below. */
export const COMPLETED_EXECUTION_STATES: readonly string[] = ["completed"];

export type ExecutionStageKey = "material_action" | "task" | "execution" | "outcome" | "observation" | "review";

/** P2-06 classification inputs. `classifyPMFreakMaterialAction` derives `materiality`
 *  from exactly these four, and materiality drives the governance state, so none of them
 *  may be assumed on the PM's behalf — they are supplied by the authorized human. */
export const MATERIAL_ACTION_CLASSES: readonly string[] = [
  "ordinary_business_write",
  "external_write",
  "authority_mutation",
  "material_agent_action",
  "knowledge_elevation",
  "policy_classified",
];
export const MATERIAL_ACTION_RISKS: readonly string[] = ["low", "medium", "high", "critical", "unknown"];
export const MATERIAL_ACTION_REVERSIBILITY: readonly string[] = ["reversible", "partially_reversible", "irreversible", "unknown"];
export const MATERIAL_ACTION_SIDE_EFFECTS: readonly string[] = ["internal", "external", "authority", "knowledge", "unknown"];

/** P2-09 `missing_data_state`. Never defaulted to COMPLETE on the PM's behalf. */
export const MISSING_DATA_STATES: readonly string[] = ["COMPLETE", "PARTIAL", "UNKNOWN"];

/** The human-supplied P2-06 classification for one governed action. */
export type MaterialActionDraft = {
  actionType: string;
  intendedEffect: string;
  actionClass: string;
  risk: string;
  reversibility: string;
  sideEffect: string;
};

/** The human-supplied P2-09 evidence quality for one observation. */
export type ObservationQuality = {
  confidenceScore: number;
  missingDataState: string;
};

/**
 * One governed continuation operation the PM can request. Each maps 1:1 onto an
 * operation that already existed before P2-12; none collapses two canonical transitions.
 */
export type ExecutionOperation =
  | { kind: "material_action"; decisionId: string; draft: MaterialActionDraft; justification: string }
  | { kind: "task"; actionId: string }
  | { kind: "execution"; taskId: string; command: "queue" | "start" | "complete" }
  | { kind: "outcome"; taskId: string; expectedResult: string; correlationId: string }
  | {
      kind: "observation";
      outcomeId: string;
      observationState: string;
      summary: string;
      evidenceReferenceIds: string[];
      quality: ObservationQuality;
      correlationId: string;
      /** Per-submission-attempt token folded into the idempotency key. */
      attemptNonce: string;
    };

export type ObservationSubmission = {
  outcomeId: string;
  observationState: string;
  summary: string;
  evidenceReferenceIds: string[];
  /** Opaque per-submission-attempt token — see `createAttemptTracker`. */
  attemptNonce: string;
};

/**
 * Canonical deterministic serialization of an Observation submission.
 *
 * A JSON array (not a delimiter-joined string) so a summary containing the delimiter
 * cannot collide with a different submission — the encoding is unambiguous.
 *
 * `summary` is trimmed and nothing else: the server stores `btrim(p_summary)` and
 * compares against it, so trimming keeps key and stored content in step. Collapsing
 * internal whitespace would map two server-distinct summaries onto one key and turn a
 * legitimate new observation into a spurious `idempotency_conflict`.
 *
 * Evidence ids are sorted because the set, not its order, is what identifies the claim.
 *
 * `attemptNonce` is included because canonical Observations are a TEMPORAL STREAM: the
 * same Outcome may legitimately receive two Observations at different times carrying an
 * identical state, summary and evidence set (there is no content uniqueness constraint,
 * `observed_at` is a distinct per-event fact, and each Observation re-evaluates the
 * Outcome). Content alone would therefore be over-deduplication — a later honest
 * re-observation would silently reconcile to the first and be lost. `observed_at` is
 * deliberately NOT part of the identity: it is the fact being recorded, and including it
 * would break retry stability.
 */
export function canonicalObservationPayload(input: ObservationSubmission): string {
  return JSON.stringify([
    input.outcomeId,
    input.observationState,
    input.summary.trim(),
    [...input.evidenceReferenceIds].sort(),
    input.attemptNonce,
  ]);
}

export type AttemptTracker = {
  /** Returns the current attempt token, minting one on first use. */
  begin: () => string;
  /** Called only after the server has accepted the submission. */
  succeed: () => void;
  current: () => string | null;
};

/**
 * Tracks one submission attempt so a retry keeps its idempotency identity while a later
 * genuine submission gets a new one.
 *
 * Retained on failure — including a canonical `idempotency_conflict`, which is an
 * integrity signal that must stay visible and fail closed rather than silently rotating
 * into a second write. Cleared only on success, so the next submission mints a fresh
 * token.
 *
 * The token is opaque and client-owned: it is not a canonical entity id, not a
 * correlation id, not a causation id, and is never persisted as domain identity — it
 * only ever contributes to the idempotency key digest.
 */
export function createAttemptTracker(mint: () => string = () => crypto.randomUUID()): AttemptTracker {
  let attempt: string | null = null;
  return {
    begin() {
      if (attempt === null) attempt = mint();
      return attempt;
    },
    succeed() {
      attempt = null;
    },
    current() {
      return attempt;
    },
  };
}

/**
 * Deterministic SHA-256 over the canonical submission, via the platform Web Crypto
 * primitive — no dependency, no truncation (`idempotency_key` is unbounded `text`).
 *
 * P2-09 makes `(workspace_id, project_id, idempotency_key)` unique and replays an
 * identical submission as `existing`, so the key must be a function of WHAT is being
 * recorded — never of when it was clicked. A timestamp-derived key would make every
 * retry a second canonical Observation, which is exactly what the contract prevents.
 * The same idiom the server itself uses (`'internal-execution:' || task_id`).
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Idempotency identity for one logical Observation submission. Identical content
 * reconciles to the existing row; genuinely different content is a new observation.
 */
export async function observationIdempotencyKey(input: ObservationSubmission): Promise<string> {
  return `p2-12:observation:${input.outcomeId}:${await sha256Hex(canonicalObservationPayload(input))}`;
}

export type ExecutionStageState = "not_started" | "present" | "complete";

export type ExecutionStage = {
  key: ExecutionStageKey;
  label: string;
  state: ExecutionStageState;
  /** True only when the canonical prerequisite exists AND the actor could legitimately
   *  advance it. Never true merely because the UI wants a complete demo. */
  actionable: boolean;
  /** Plain-language reason the stage cannot be advanced. Text, never colour alone. */
  blockedReason: string | null;
  /** What advancing this stage actually persists. */
  effect: string;
};

export type GovernedActionView = {
  actionId: string;
  actionClass: string | null;
  actionType: string | null;
  materiality: string | null;
  governanceState: string;
  /** P2-06 persists `canExecute: false`. Authorization is not execution. */
  canExecute: boolean;
  proposalDigestShort: string | null;
  sourceDecisionId: string | null;
  correlationId: string | null;
  causationId: string | null;
  evaluatedAt: string | null;
  policyDecisionReference: string | null;
  grantReferences: string[];
  evidenceReferenceIds: string[];
  revoked: boolean;
};

export type GovernedTaskView = {
  taskId: string;
  title: string;
  status: string;
  sourceActionId: string | null;
  createdAt: string | null;
  completedAt: string | null;
};

export type InternalExecutionView = {
  executionId: string;
  taskId: string | null;
  sourceActionId: string | null;
  status: string;
  attemptCount: number | null;
  providerKey: string | null;
  failureClass: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type ExpectedOutcomeView = {
  outcomeId: string;
  taskId: string | null;
  sourceActionId: string | null;
  internalExecutionId: string | null;
  state: string;
  expectedResult: string | null;
};

export type OutcomeObservationView = {
  observationId: string;
  outcomeId: string | null;
  taskId: string | null;
  observationState: string;
  missingDataState: string | null;
  confidenceScore: number | null;
  summary: string | null;
  evidenceReferenceIds: string[];
  recordedAt: string | null;
};

/**
 * The P2-12 invariant, derived from persisted rows only.
 *
 * `completedWorkWithoutAchievedOutcome` is the honest state after internal execution
 * finishes and before evidence says anything: the work is done, the Outcome is not
 * achieved, and nothing may present it as achieved.
 */
export type OutcomeBoundary = {
  executionCompleted: boolean;
  taskCompleted: boolean;
  outcomeExists: boolean;
  outcomeState: string | null;
  outcomeAchieved: boolean;
  observationCount: number;
  completedWorkWithoutAchievedOutcome: boolean;
  statement: string;
};

export type GovernedExecutionChain = {
  kind: "governed_execution_chain";
  /** Stable identity derived from the canonical Decision — never random. */
  id: string;
  decisionId: string;
  decisionStatus: string;
  decisionTerminal: boolean;
  decidedBy: string | null;
  decisionRecordedAt: string | null;
  rationale: string | null;
  recommendationId: string | null;
  title: string;
  action: GovernedActionView | null;
  task: GovernedTaskView | null;
  executions: InternalExecutionView[];
  latestExecution: InternalExecutionView | null;
  outcome: ExpectedOutcomeView | null;
  observations: OutcomeObservationView[];
  /** P2-10 projection for this chain's Outcome. Null when no Outcome exists yet — the
   *  absence is reported, never synthesised. */
  lineage: CompleteLineageProjection | null;
  stages: ExecutionStage[];
  boundary: OutcomeBoundary;
};

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function shortDigest(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  const bare = text.startsWith("sha256:") ? text.slice(7) : text;
  return `${bare.slice(0, 16)}…`;
}

export function isActionEligibleDecisionStatus(status: unknown): boolean {
  return ACTION_ELIGIBLE_DECISION_STATUSES.includes(String(status));
}

/** Reads the governed Action -> Task link exactly as P2-07 persists it. */
export function readSourceActionId(task: AnyRecord): string | null {
  const payload = task.source_payload as AnyRecord | null | undefined;
  if (!payload || payload.source !== "governed_action") return null;
  return str(payload.sourceActionId);
}

/**
 * Evidence P2-09 will accept as the basis of an Observation.
 *
 * `record_canonical_outcome_observation` refuses anything that is not canonical,
 * provenance-bearing LIVE evidence (`observation_evidence_scope_invalid`). Offering
 * ineligible evidence would put a control on screen that the server always denies, so
 * the same predicate is mirrored here — and when nothing qualifies the experience says
 * so rather than failing at submit time.
 */
export function isObservationEligibleEvidence(row: AnyRecord, evaluatedAt: Date = new Date()): boolean {
  if (str(row.normalized_event_id) === null) return false;
  if (str(row.fixture_state) !== "LIVE") return false;
  if (str(row.freshness_state) !== "CURRENT") return false;
  if (str(row.lifecycle) !== "RECORDED") return false;
  if (str(row.rejection_reason) !== null) return false;
  if (str(row.degraded_reason) !== null) return false;
  if (str(row.evaluated_at) === null) return false;
  const staleAt = str(row.stale_at);
  if (staleAt && new Date(staleAt) <= evaluatedAt) return false;
  return true;
}

function buildActionView(action: AnyRecord, evaluation: AnyRecord | undefined): GovernedActionView {
  const proposal = (action.proposal ?? {}) as AnyRecord;
  const governanceState = str(evaluation?.governance_state) ?? "proposed";
  return {
    actionId: String(action.id),
    actionClass: str(action.action_class),
    actionType: str(proposal.actionType),
    materiality: str(action.materiality),
    governanceState,
    canExecute: evaluation?.can_execute === true,
    proposalDigestShort: shortDigest(action.proposal_digest),
    sourceDecisionId: str(action.source_decision_id),
    correlationId: str(action.correlation_id),
    causationId: str(action.causation_id),
    evaluatedAt: str(evaluation?.evaluated_at),
    policyDecisionReference: str(evaluation?.policy_decision_reference),
    grantReferences: strList(evaluation?.grant_references),
    evidenceReferenceIds: strList(proposal.evidenceReferenceIds),
    revoked: governanceState === "revoked",
  };
}

function buildBoundary(input: {
  latestExecution: InternalExecutionView | null;
  task: GovernedTaskView | null;
  outcome: ExpectedOutcomeView | null;
  observations: OutcomeObservationView[];
}): OutcomeBoundary {
  const executionCompleted = Boolean(input.latestExecution && COMPLETED_EXECUTION_STATES.includes(input.latestExecution.status));
  const taskCompleted = Boolean(input.task && ["completed", "done"].includes(String(input.task.status)));
  const outcomeState = input.outcome?.state ?? null;
  // `achieved` is the only canonical achieved state. Every other value the contract
  // allows — `expected`, `observing`, `partially_achieved`, `not_achieved`, `disputed`,
  // `inconclusive`, `superseded` — is NOT achievement and must never be shown as one.
  const outcomeAchieved = outcomeState === "achieved";
  const workFinished = executionCompleted || taskCompleted;
  const completedWorkWithoutAchievedOutcome = workFinished && !outcomeAchieved;

  let statement: string;
  if (!workFinished) {
    statement = "Internal work has not finished, so no outcome conclusion is available.";
  } else if (!input.outcome) {
    statement = "Internal work completed. No expected Outcome has been defined yet, so nothing has been achieved.";
  } else if (input.observations.length === 0) {
    statement = "Internal work completed. The Outcome has no evidence-backed Observation yet, so achievement is still unknown.";
  } else if (outcomeAchieved) {
    statement = "Internal work completed and an evidence-backed Observation supports the expected Outcome.";
  } else {
    statement = `Internal work completed. The Outcome is "${String(outcomeState)}" — completing the work did not achieve it.`;
  }

  return {
    executionCompleted,
    taskCompleted,
    outcomeExists: Boolean(input.outcome),
    outcomeState,
    outcomeAchieved,
    observationCount: input.observations.length,
    completedWorkWithoutAchievedOutcome,
    statement,
  };
}

function buildStages(input: {
  decisionStatus: string;
  decisionIsOwnedByActor: boolean;
  hasEvidenceLink: boolean;
  canWrite: boolean;
  action: GovernedActionView | null;
  task: GovernedTaskView | null;
  latestExecution: InternalExecutionView | null;
  outcome: ExpectedOutcomeView | null;
  observations: OutcomeObservationView[];
  lineage: CompleteLineageProjection | null;
}): ExecutionStage[] {
  const eligibleStatus = isActionEligibleDecisionStatus(input.decisionStatus);

  // ---- Material Action -----------------------------------------------------
  let actionBlocked: string | null = null;
  if (!input.canWrite) actionBlocked = "Your role cannot record governed operations in this project.";
  else if (!eligibleStatus) actionBlocked = `A ${String(input.decisionStatus).replaceAll("_", " ")} Decision does not authorize a material action.`;
  else if (!input.decisionIsOwnedByActor) actionBlocked = "Only the person who recorded this Decision can request its material action.";
  else if (!input.hasEvidenceLink) actionBlocked = "This Decision has no linked evidence snapshot, which a material action requires.";

  // ---- Task ----------------------------------------------------------------
  let taskBlocked: string | null = null;
  if (!input.action) taskBlocked = "No governed Material Action exists yet.";
  else if (input.action.revoked) taskBlocked = "This Action's authorization was revoked.";
  else if (!TASK_ELIGIBLE_GOVERNANCE_STATES.includes(input.action.governanceState)) {
    taskBlocked = `Governance evaluated this Action as "${input.action.governanceState.replaceAll("_", " ")}", so it cannot become work.`;
  } else if (!input.canWrite) taskBlocked = "Your role cannot record governed operations in this project.";

  // ---- Execution -----------------------------------------------------------
  let executionBlocked: string | null = null;
  if (!input.task) executionBlocked = "No canonical Task exists yet.";
  else if (!input.canWrite) executionBlocked = "Your role cannot record governed operations in this project.";

  // ---- Expected Outcome ----------------------------------------------------
  let outcomeBlocked: string | null = null;
  if (!input.task) outcomeBlocked = "An expected Outcome is defined against a canonical Task.";
  else if (!input.canWrite) outcomeBlocked = "Your role cannot record governed operations in this project.";

  // ---- Observation ---------------------------------------------------------
  let observationBlocked: string | null = null;
  if (!input.outcome) observationBlocked = "No expected Outcome exists to observe.";
  else if (!input.canWrite) observationBlocked = "Your role cannot record governed operations in this project.";

  const executionState: ExecutionStageState = input.latestExecution
    ? COMPLETED_EXECUTION_STATES.includes(input.latestExecution.status) ? "complete" : "present"
    : "not_started";

  return [
    {
      key: "material_action",
      label: "Governed material action",
      state: input.action ? "present" : "not_started",
      actionable: actionBlocked === null && !input.action,
      blockedReason: actionBlocked,
      effect: "Records a governed authorization to act. It does not execute anything and does not create a Task.",
    },
    {
      key: "task",
      label: "Canonical internal task",
      state: input.task ? "present" : "not_started",
      actionable: taskBlocked === null && !input.task,
      blockedReason: taskBlocked,
      effect: "Turns the authorized Action into one canonical internal Task. Retrying reconciles to the same Task.",
    },
    {
      key: "execution",
      label: "Internal execution",
      state: executionState,
      actionable: executionBlocked === null,
      blockedReason: executionBlocked,
      effect: "Records internal execution state against the Task. It does not decide whether the Outcome happened.",
    },
    {
      key: "outcome",
      label: "Expected outcome",
      state: input.outcome ? "present" : "not_started",
      actionable: outcomeBlocked === null && !input.outcome,
      blockedReason: outcomeBlocked,
      effect: "Defines what this work is expected to achieve. Defining it does not claim it happened.",
    },
    {
      key: "observation",
      label: "Evidence-backed observation",
      state: input.observations.length > 0 ? "present" : "not_started",
      actionable: observationBlocked === null,
      blockedReason: observationBlocked,
      effect: "Records what evidence says actually happened, including missing, disputed or inconclusive.",
    },
    {
      key: "review",
      label: "Outcome review and lineage",
      state: input.lineage ? "present" : "not_started",
      actionable: false,
      blockedReason: input.lineage
        ? null
        : input.outcome
          ? "Complete lineage for this outcome is not available yet."
          : "Complete lineage becomes available once an expected Outcome exists.",
      effect: "Shows the canonical chain behind the conclusion, including gaps and disputes.",
    },
  ];
}

/**
 * Projects one execution chain per persisted Decision.
 *
 * Non-terminal Decisions (escalated / needs_more_evidence) are deliberately excluded:
 * they leave the Recommendation open and authorize nothing downstream. Rejected
 * Decisions ARE included so the PM can see that they legitimately stop here, rather
 * than the surface quietly hiding them.
 */
export function buildExecutionChains(summary: OperationalSummary | undefined): GovernedExecutionChain[] {
  if (!summary) return [];

  const actionsByDecision = new Map<string, AnyRecord>();
  for (const action of summary.materialActions ?? []) {
    const decisionId = str(action.source_decision_id);
    if (decisionId && !actionsByDecision.has(decisionId)) actionsByDecision.set(decisionId, action);
  }

  // Newest evaluation wins: P2-06 appends an evaluation row per governance transition.
  const evaluationByAction = new Map<string, AnyRecord>();
  for (const evaluation of summary.materialActionEvaluations ?? []) {
    const actionId = str(evaluation.action_id);
    if (actionId && !evaluationByAction.has(actionId)) evaluationByAction.set(actionId, evaluation);
  }

  const taskByActionId = new Map<string, AnyRecord>();
  for (const task of summary.tasks ?? []) {
    const sourceActionId = readSourceActionId(task);
    if (sourceActionId && !taskByActionId.has(sourceActionId)) taskByActionId.set(sourceActionId, task);
  }

  const evidenceLinkedDecisionIds = new Set(
    (summary.evidenceLinks ?? []).map((link) => String(link.decision_record_id))
  );

  const recommendationTitleById = new Map(
    (summary.recommendations ?? []).map((row) => [String(row.id), str(row.recommendation)])
  );

  const actorUserId = str(summary.actor?.userId);
  const canWrite = summary.actor?.canCreateEvidence === true;

  const chains: GovernedExecutionChain[] = [];

  for (const decision of summary.decisions ?? []) {
    const decisionId = String(decision.id);
    const decisionStatus = String(decision.decision_status);
    const terminal = ["accepted", "rejected", "modified"].includes(decisionStatus);
    if (!terminal) continue;

    const actionRow = actionsByDecision.get(decisionId);
    const action = actionRow ? buildActionView(actionRow, evaluationByAction.get(String(actionRow.id))) : null;

    const taskRow = action ? taskByActionId.get(action.actionId) : undefined;
    const task: GovernedTaskView | null = taskRow
      ? {
          taskId: String(taskRow.id),
          title: str(taskRow.title) ?? "Governed task",
          status: String(taskRow.status ?? "unknown"),
          sourceActionId: readSourceActionId(taskRow),
          createdAt: str(taskRow.created_at),
          completedAt: str(taskRow.completed_at),
        }
      : null;

    const executions: InternalExecutionView[] = (summary.executions ?? [])
      .filter((row) => task && str(row.task_id) === task.taskId)
      .map((row) => ({
        executionId: String(row.id),
        taskId: str(row.task_id),
        sourceActionId: str(row.source_action_id),
        status: String(row.status ?? "unknown"),
        attemptCount: num(row.attempt_count),
        providerKey: str(row.provider_key),
        failureClass: str(row.failure_class),
        queuedAt: str(row.queued_at),
        startedAt: str(row.started_at),
        completedAt: str(row.completed_at),
      }))
      .sort((a, b) => String(b.queuedAt ?? "").localeCompare(String(a.queuedAt ?? "")));
    const latestExecution = executions[0] ?? null;

    const outcomeRow = task ? (summary.outcomes ?? []).find((row) => str(row.task_id) === task.taskId) : undefined;
    const outcome: ExpectedOutcomeView | null = outcomeRow
      ? {
          outcomeId: String(outcomeRow.id),
          taskId: str(outcomeRow.task_id),
          sourceActionId: str(outcomeRow.source_action_id),
          internalExecutionId: str(outcomeRow.internal_execution_id),
          state: String(outcomeRow.state ?? "unknown"),
          expectedResult: str(outcomeRow.expected_result),
        }
      : null;

    const observations: OutcomeObservationView[] = outcome
      ? (summary.observations ?? [])
          .filter((row) => str(row.outcome_id) === outcome.outcomeId)
          .map((row) => ({
            observationId: String(row.id),
            outcomeId: str(row.outcome_id),
            taskId: str(row.task_id),
            observationState: String(row.observation_state ?? "unknown"),
            missingDataState: str(row.missing_data_state),
            confidenceScore: num(row.confidence_score),
            summary: str(row.summary),
            evidenceReferenceIds: strList(row.evidence_reference_ids),
            recordedAt: str(row.recorded_at),
          }))
          .sort((a, b) => String(b.recordedAt ?? "").localeCompare(String(a.recordedAt ?? "")))
      : [];

    const lineage = outcome
      ? (summary.lineages ?? []).find((projection) => projection.outcomeId === outcome.outcomeId) ?? null
      : null;

    const boundary = buildBoundary({ latestExecution, task, outcome, observations });

    chains.push({
      kind: "governed_execution_chain",
      id: `governed-chain-${decisionId}`,
      decisionId,
      decisionStatus,
      decisionTerminal: terminal,
      decidedBy: str(decision.decided_by),
      decisionRecordedAt: str(decision.created_at),
      rationale: str(decision.rationale),
      recommendationId: str(decision.recommendation_id),
      title:
        (decision.recommendation_id ? recommendationTitleById.get(String(decision.recommendation_id)) : null) ??
        str(decision.decision) ??
        "Recorded decision",
      action,
      task,
      executions,
      latestExecution,
      outcome,
      observations,
      lineage,
      stages: buildStages({
        decisionStatus,
        decisionIsOwnedByActor: Boolean(actorUserId) && str(decision.decided_by) === actorUserId,
        hasEvidenceLink: evidenceLinkedDecisionIds.has(decisionId),
        canWrite,
        action,
        task,
        latestExecution,
        outcome,
        observations,
        lineage,
      }),
      boundary,
    });
  }

  return chains;
}

export function findExecutionChainByDecisionId(
  chains: GovernedExecutionChain[],
  decisionId: string
): GovernedExecutionChain | undefined {
  return chains.find((chain) => chain.decisionId === decisionId);
}

/** Chains a PM can still move forward. Used for ordering only — never to hide a chain. */
export function selectAdvanceableChains(chains: GovernedExecutionChain[]): GovernedExecutionChain[] {
  return chains.filter((chain) => chain.stages.some((stage) => stage.actionable));
}
