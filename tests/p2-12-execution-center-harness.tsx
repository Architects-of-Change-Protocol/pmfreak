/**
 * P2-12 acceptance harness.
 *
 * Executed by `tests/p2-12-pm-execution-center-action-to-outcome.test.mjs` through tsx, which is
 * how this repository runs real behaviour (rather than source scanning) against TypeScript
 * modules. It builds canonical-shaped OperationalSummary fixtures, runs them through the real
 * P2-12 execution read model and the real Command Center components, and prints one JSON
 * document of observable results for the test file to assert on.
 *
 * Every fixture mirrors the persisted column names of the verified P2 contract:
 *   material_action_proposals.source_decision_id
 *   material_action_governance_evaluations.governance_state / can_execute
 *   execution_tasks.source_payload.{source,sourceActionId}
 *   internal_task_executions.task_id
 *   canonical_task_outcomes.task_id / state
 *   canonical_outcome_observations.outcome_id / observation_state / missing_data_state
 */

import { renderToStaticMarkup } from "react-dom/server";
import type { OperationalSummary } from "@/lib/operational-flow/types";
import {
  buildExecutionChains,
  findExecutionChainByDecisionId,
  readSourceActionId,
  observationIdempotencyKey,
  canonicalObservationPayload,
  canonicalMaterialActionDraft,
  chainStages,
  describeGovernanceState,
  dispatchBlockReason,
  allowedExecutionCommands,
  GOVERNANCE_REVALIDATED_COMMANDS,
  sha256Hex,
  isObservationEligibleEvidence,
  ACTION_ELIGIBLE_DECISION_STATUSES,
  TASK_ELIGIBLE_GOVERNANCE_STATES,
  EXECUTION_COMMANDS,
  EXECUTION_TRANSITIONS,
  MATERIAL_ACTION_WINDOW_MS,
  MATERIAL_ACTION_CLASSES,
  MATERIAL_ACTION_RISKS,
  MATERIAL_ACTION_REVERSIBILITY,
  MATERIAL_ACTION_SIDE_EFFECTS,
  MISSING_DATA_STATES,
  type GovernedActionBranch,
  type GovernedExecutionChain,
} from "../src/modules/workspace/presentation/command-center/execution-read-model";
import {
  clearSubmissionAttempt,
  loadSubmissionAttempt,
  materialActionAttemptKey,
  peekSubmissionAttempt,
  reconcileSubmissionAttempt,
  rememberSubmittedKey,
} from "../src/modules/workspace/presentation/command-center/submission-attempt";
import { ExecutionChainPanel } from "../src/modules/workspace/presentation/command-center/execution-chain-panel";
import { ExecutionQueue } from "../src/modules/workspace/presentation/command-center/execution-queue";

const ACTOR = "actor-pm";
const OTHER_ACTOR = "actor-someone-else";

const markup = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

type Overrides = Partial<OperationalSummary>;

/** A canonical-shaped summary. Every id is stable and every link is a real column. */
function summary(overrides: Overrides = {}): OperationalSummary {
  return {
    sources: [],
    rawInputs: [],
    normalizedEvents: [],
    evidence: [{ id: "ev-1", title: "Client confirmation email" }],
    signals: [],
    risksIssues: [],
    governanceEvents: [],
    recommendations: [{ id: "rec-1", recommendation: "Obtain formal scope confirmation." }],
    decisions: [],
    evidenceLinks: [{ decision_record_id: "dec-1", evidence_item_id: "ev-1" }],
    materialActions: [],
    materialActionEvaluations: [],
    outcomes: [],
    observations: [],
    tasks: [],
    executions: [],
    lineages: [],
    assurance: {} as OperationalSummary["assurance"],
    actor: { role: "owner", userId: ACTOR, canCreateEvidence: true },
    ...overrides,
  };
}

const decision = (over: Record<string, unknown> = {}) => ({
  id: "dec-1",
  decision_status: "accepted",
  decided_by: ACTOR,
  recommendation_id: "rec-1",
  rationale: "P2-12 harness rationale",
  created_at: "2026-08-17T10:00:00Z",
  ...over,
});

const action = (over: Record<string, unknown> = {}) => ({
  id: "act-1",
  source_decision_id: "dec-1",
  // P2-06 persists the proposer; P2-07 refuses dispatch by anyone else.
  proposed_by: ACTOR,
  action_class: "external_write",
  materiality: "material",
  proposal_digest: "sha256:abcdef0123456789abcdef",
  correlation_id: "corr-1",
  causation_id: "dec-1",
  proposal: { actionType: "governed_project_change", evidenceReferenceIds: ["ev-1"] },
  created_at: "2026-08-17T10:02:00Z",
  persisted_at: "2026-08-17T10:02:00Z",
  // Still inside its authorization window at NOW.
  expires_at: "2026-08-17T13:00:00Z",
  ...over,
});

/** An Action whose authorization window has closed. P2-07 denies dispatch with
 *  failureClass `expired`, so the chain can only continue via a replacement Action. */
const expiredAction = (over: Record<string, unknown> = {}) =>
  action({ expires_at: "2026-08-17T11:00:00Z", ...over });

const evaluation = (over: Record<string, unknown> = {}) => ({
  action_id: "act-1",
  governance_state: "authorized",
  // P2-07 requires `can_commit_action` alongside an eligible state; an eligible state on
  // its own is not enough.
  can_commit_action: true,
  can_execute: false,
  evaluated_at: "2026-08-17T10:05:00Z",
  // The evaluation's own horizon, separate from the Action's `expires_at`. Still open at NOW.
  valid_until: "2026-08-17T13:00:00Z",
  // Authorized material work must retain the policy decision and grant evidence that
  // made it allowable.
  policy_decision_reference: "pmfreak-governance-event:gov-1",
  grant_references: ["workspace-role-grant:owner:actor-pm"],
  ...over,
});

const task = (over: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "Obtain formal scope confirmation",
  status: "in_progress",
  created_at: "2026-08-17T10:10:00Z",
  completed_at: null,
  source_payload: { source: "governed_action", sourceActionId: "act-1" },
  ...over,
});

const execution = (over: Record<string, unknown> = {}) => ({
  id: "exec-1",
  task_id: "task-1",
  source_action_id: "act-1",
  status: "completed",
  attempt_count: 1,
  provider_key: "pmfreak/internal-state-machine:v1",
  // P2-08 refuses a transition by anyone other than the dispatching actor.
  dispatched_by: ACTOR,
  queued_at: "2026-08-17T10:11:00Z",
  started_at: "2026-08-17T10:12:00Z",
  completed_at: "2026-08-17T10:20:00Z",
  ...over,
});

const outcome = (over: Record<string, unknown> = {}) => ({
  id: "out-1",
  task_id: "task-1",
  source_action_id: "act-1",
  internal_execution_id: "exec-1",
  state: "expected",
  expected_result: "The client confirms the revised scope in writing.",
  ...over,
});

const observation = (over: Record<string, unknown> = {}) => ({
  id: "obs-1",
  outcome_id: "out-1",
  task_id: "task-1",
  observation_state: "inconclusive",
  summary: "The client replied without confirming scope.",
  evidence_reference_ids: ["ev-1"],
  confidence_score: 0.4,
  missing_data_state: "PARTIAL",
  recorded_at: "2026-08-17T11:00:00Z",
  idempotency_key: "p2-12:observation:out-1:persisted-key",
  ...over,
});

/** A fixed clock: expiry is a real comparison against persisted `expires_at`, so the
 *  scenarios must not drift with wall time. */
const NOW = new Date("2026-08-17T12:00:00Z");

const chainsOf = (s: OperationalSummary): GovernedExecutionChain[] => buildExecutionChains(s, NOW);
const one = (s: OperationalSummary): GovernedExecutionChain => chainsOf(s)[0];
const branchOf = (chain: GovernedExecutionChain, index = 0): GovernedActionBranch | null =>
  chain.branches[index] ?? null;
/** `material_action` is a chain-level stage (proposing or replacing); every other stage
 *  belongs to one canonical Action's branch. */
const stageOf = (chain: GovernedExecutionChain, key: string, index = 0) =>
  key === "material_action"
    ? chain.proposalStage
    : branchOf(chain, index)?.stages.find((entry) => entry.key === key) ?? null;

// ── Scenarios ────────────────────────────────────────────────────────────────

/** Decision recorded, nothing downstream requested yet. */
const decidedOnly = summary({ decisions: [decision()] });

/** Rejected Decision — legitimately stops here. */
const rejected = summary({ decisions: [decision({ decision_status: "rejected" })] });

/** Non-terminal Decision — authorizes nothing downstream and is not a chain at all. */
const escalated = summary({ decisions: [decision({ decision_status: "escalated" })] });

/** Decision recorded by a different actor — P2-06 refuses this source. */
const foreignActor = summary({ decisions: [decision({ decided_by: OTHER_ACTOR })] });

/** Decision with no evidence snapshot — P2-06 requires one. */
const noEvidenceLink = summary({ decisions: [decision()], evidenceLinks: [] });

/** Action awaiting approval — P2-07 will not dispatch it. */
const requiresApproval = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation({ governance_state: "requires_approval" })],
});

/** Action denied outright. */
const deniedAction = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation({ governance_state: "denied" })],
});

/** Authorized Action, no Task yet. */
const authorized = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
});

/** THE P2-12 invariant: internal work completed, no Outcome defined. */
const workDoneNoOutcome = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  tasks: [task({ status: "completed", completed_at: "2026-08-17T10:20:00Z" })],
  executions: [execution()],
});

/** Work completed and an Outcome exists, but it is still only `expected`. */
const workDoneOutcomeExpected = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  tasks: [task({ status: "completed" })],
  executions: [execution()],
  outcomes: [outcome()],
});

/** An inconclusive Observation must stay inconclusive. */
const inconclusive = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  tasks: [task({ status: "completed" })],
  executions: [execution()],
  outcomes: [outcome({ state: "inconclusive" })],
  observations: [observation()],
  lineages: [
    {
      outcomeId: "out-1",
      taskId: "task-1",
      expectedResult: "The client confirms the revised scope in writing.",
      outcomeState: "inconclusive",
      observationsCount: 1,
      latestObservationState: "inconclusive",
      lineageStatus: "inconclusive",
      hasCorrelationOnly: true,
      steps: [
        { kind: "evidence", id: "ev-1", title: "Evidence", status: "present", summary: "", entity: null, correlationId: null, causationId: null, isFixture: false, fixtureLabel: null, gapReason: null, occurredAt: null, recordedAt: null, actorId: null },
        { kind: "observation", id: "obs-1", title: "Observation", status: "present", summary: "", entity: null, correlationId: null, causationId: null, isFixture: false, fixtureLabel: null, gapReason: null, occurredAt: null, recordedAt: null, actorId: null },
        { kind: "raw_input", id: null, title: "Raw input", status: "missing", summary: "", entity: null, correlationId: null, causationId: null, isFixture: false, fixtureLabel: null, gapReason: "No raw input recorded for this chain", occurredAt: null, recordedAt: null, actorId: null },
      ],
      transitions: [],
      auditEvents: [],
      gaps: ["No raw input recorded for this chain"],
      disputes: [],
      isFixture: false,
      fixtureLabel: null,
    },
  ] as OperationalSummary["lineages"],
});

/** Achieved only when the canonical Outcome itself says so. */
const achieved = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  tasks: [task({ status: "completed" })],
  executions: [execution()],
  outcomes: [outcome({ state: "achieved" })],
  observations: [observation({ observation_state: "achieved", missing_data_state: "COMPLETE" })],
});

/** A read-only actor: every stage must fail closed. */
const viewer = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  actor: { role: "viewer", userId: ACTOR, canCreateEvidence: false },
});

/** A Task belonging to a DIFFERENT Action must never attach to this chain. */
const foreignTask = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  tasks: [task({ id: "task-other", source_payload: { source: "governed_action", sourceActionId: "act-999" } })],
});

/** A task not produced by the governed path carries no sourceActionId link at all. */
const ungovernedTask = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  tasks: [task({ id: "task-raid", source_payload: { source: "raid_item", sourceActionId: "act-1" } })],
});

/** F2/F9 — an expired authorization with no Task. The chain must offer a governed
 *  replacement rather than sitting permanently stuck. */
const expiredNoTask = summary({
  decisions: [decision()],
  materialActions: [expiredAction()],
  materialActionEvaluations: [evaluation()],
});

/** F2/F9 — the expired Action is preserved and a NEW canonical Action carries the chain.
 *  `source_decision_id` is not unique, so both are legitimate persisted rows. */
const expiredPlusReplacement = summary({
  decisions: [decision()],
  materialActions: [
    expiredAction(),
    action({
      id: "act-2",
      correlation_id: "corr-2",
      persisted_at: "2026-08-17T11:30:00Z",
      created_at: "2026-08-17T11:30:00Z",
      expires_at: "2026-08-17T13:30:00Z",
    }),
  ],
  materialActionEvaluations: [evaluation(), evaluation({ action_id: "act-2", evaluated_at: "2026-08-17T11:31:00Z" })],
});

/** F9 — two Actions on one Decision, each with its own Task and its own downstream work.
 *  Neither may be discarded. */
const twoActionsTwoTasks = summary({
  decisions: [decision()],
  materialActions: [
    action(),
    action({ id: "act-2", correlation_id: "corr-2", persisted_at: "2026-08-17T11:30:00Z" }),
  ],
  materialActionEvaluations: [evaluation(), evaluation({ action_id: "act-2" })],
  tasks: [
    task({ status: "completed" }),
    task({ id: "task-2", status: "in_progress", source_payload: { source: "governed_action", sourceActionId: "act-2" } }),
  ],
  executions: [execution(), execution({ id: "exec-2", task_id: "task-2", status: "running", completed_at: null })],
  outcomes: [outcome()],
  observations: [observation()],
});

/** F6 — another writable member opens an Action proposed by someone else. P2-07 answers
 *  `governed_action_actor_mismatch`, so the control must not be offered. */
const otherWritableMember = summary({
  decisions: [decision({ decided_by: OTHER_ACTOR })],
  materialActions: [action({ proposed_by: OTHER_ACTOR })],
  materialActionEvaluations: [evaluation()],
  actor: { role: "admin", userId: ACTOR, canCreateEvidence: true },
});

/** F3 — every persisted execution state, so the offered commands can be compared with the
 *  canonical P2-08 transition table. */
const executionAt = (status: string | null, taskStatus = "in_progress") =>
  summary({
    decisions: [decision()],
    materialActions: [action()],
    materialActionEvaluations: [evaluation()],
    tasks: [task({ status: taskStatus })],
    executions: status === null
      ? []
      : [execution({ status, completed_at: status === "completed" ? "2026-08-17T10:20:00Z" : null })],
  });

const noExecutionNotStarted = executionAt(null, "not_started");
const noExecutionInProgress = executionAt(null, "in_progress");
const execQueued = executionAt("queued");
const execRunning = executionAt("running");
const execBlocked = executionAt("blocked");
const execFailed = executionAt("failed");
const execCompleted = executionAt("completed", "completed");

/** F3 — an execution dispatched by another actor. P2-08 answers
 *  `internal_execution_actor_mismatch`. */
const foreignExecutionActor = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  tasks: [task()],
  executions: [execution({ status: "queued", dispatched_by: OTHER_ACTOR, completed_at: null })],
});

/** F5 — the Outcome gate at each prerequisite state. `ensure_expected_task_outcome`
 *  requires a completed Task AND a completed internal execution. */
const outcomeGate = (taskStatus: string, executionStatus: string) =>
  summary({
    decisions: [decision()],
    materialActions: [action()],
    materialActionEvaluations: [evaluation()],
    tasks: [task({ status: taskStatus })],
    executions: [execution({ status: executionStatus, completed_at: executionStatus === "completed" ? "2026-08-17T10:20:00Z" : null })],
  });

/** F10 — governance states that explicitly do NOT authorize dispatch. */
const degradedAction = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation({ governance_state: "degraded" })],
});
const unavailableAction = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation({ governance_state: "unavailable" })],
});
const revokedAction = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation({ governance_state: "revoked" })],
});

/** F6-adjacent — the P2-07 dispatch gates an eligible governance state alone does not
 *  satisfy. Each denies dispatch server-side, so none may be offered as a control. */
const staleEvaluation = summary({
  decisions: [decision()],
  materialActions: [action()],
  // `valid_until` has passed even though the Action's own `expires_at` has not:
  // `governance_evaluation_stale`.
  materialActionEvaluations: [evaluation({ valid_until: "2026-08-17T11:00:00Z" })],
});
const cannotCommitAction = summary({
  decisions: [decision()],
  materialActions: [action()],
  // Authorized, but P2-06 did not permit committing it: `governed_action_not_dispatchable`.
  materialActionEvaluations: [evaluation({ can_commit_action: false })],
});
const missingGrantEvidence = summary({
  decisions: [decision()],
  materialActions: [action()],
  // Authorized without the policy/grant evidence that made it allowable:
  // `policy_or_grant_reference_missing`.
  materialActionEvaluations: [evaluation({ policy_decision_reference: null, grant_references: [] })],
});
const unevaluatedAction = summary({
  decisions: [decision()],
  materialActions: [action()],
  // No evaluation row at all: `governance_evaluation_missing`.
  materialActionEvaluations: [],
});

/** F3-adjacent — the authorization lapsed AFTER the Task and execution existed.
 *  `p2_08_validate_execution_governance` re-runs the whole P2-07 gate for `queue`/`start`/
 *  `retry`, but not for `block`/`fail`/`complete`: recording that work stopped is not
 *  authorizing new work, and must stay possible. */
const lapsedMidFlight = (executionStatus: string) =>
  summary({
    decisions: [decision()],
    materialActions: [expiredAction()],
    materialActionEvaluations: [evaluation()],
    tasks: [task()],
    executions: [execution({ status: executionStatus, completed_at: null })],
  });

/** F3-adjacent — a Task created by its proposer, opened by a different writable member.
 *  The execution gate checks the ACTION's proposer before authorizing new work. */
const foreignProposerQueue = summary({
  decisions: [decision({ decided_by: OTHER_ACTOR })],
  materialActions: [action({ proposed_by: OTHER_ACTOR })],
  materialActionEvaluations: [evaluation()],
  tasks: [task({ status: "not_started" })],
});

/** F4 — a persisted Observation carrying the idempotency key a pending attempt submitted. */
const observedWithKey = summary({
  decisions: [decision()],
  materialActions: [action()],
  materialActionEvaluations: [evaluation()],
  tasks: [task({ status: "completed" })],
  executions: [execution()],
  outcomes: [outcome()],
  observations: [observation({ idempotency_key: "p2-12:observation:out-1:landed" })],
});

const noop = async () => {};
const evidenceOptions = [{ id: "ev-1", title: "Client confirmation email" }];

async function buildIdempotency() {
    const base = {
      outcomeId: "out-1",
      observationState: "inconclusive",
      summary: " The client replied. ",
      evidenceReferenceIds: ["ev-2", "ev-1"],
      attemptNonce: "attempt-A",
    };
    const key = (over = {}) => observationIdempotencyKey({ ...base, ...over });
    const [
      first, second, reordered, trimmed, otherState, otherSummary, otherEvidence, otherOutcome, otherAttempt,
    ] = await Promise.all([
      key(), key(),
      key({ evidenceReferenceIds: ["ev-1", "ev-2"] }),
      key({ summary: "The client replied." }),
      key({ observationState: "achieved" }),
      key({ summary: "Something else." }),
      key({ evidenceReferenceIds: ["ev-3"] }),
      key({ outcomeId: "out-2" }),
      // Identical content, different submission attempt: a later genuine re-observation.
      key({ attemptNonce: "attempt-B" }),
    ]);

    // Attempt lifecycle, exercised as real behaviour against the durable store with a
    // deterministic mint and a controlled clock.
    let minted = 0;
    const mint = () => `nonce-${++minted}`;
    const attemptStoreKey = "harness:observation:out-1";
    const t0 = new Date("2026-08-17T12:00:00Z");
    const load = (now: Date) => loadSubmissionAttempt(attemptStoreKey, { ttlMs: 60_000, now, mint });

    clearSubmissionAttempt(attemptStoreKey);
    const firstUse = load(t0).attemptId;
    // The request failed (or its response was lost) and the component remounted: the
    // module holds no per-mount state, so the retry must resolve the SAME identity.
    const retryAfterRemount = load(new Date(t0.getTime() + 5_000)).attemptId;
    const heldAfterFailure = peekSubmissionAttempt(attemptStoreKey)?.attemptId ?? null;
    // Persisted state proves the submission landed even though the response never arrived.
    rememberSubmittedKey(attemptStoreKey, "p2-12:observation:out-1:landed");
    reconcileSubmissionAttempt(attemptStoreKey, ["p2-12:observation:out-1:landed"]);
    const clearedAfterReconcile = peekSubmissionAttempt(attemptStoreKey)?.attemptId ?? null;
    // A genuinely later observation therefore takes its own identity.
    const nextSubmission = load(new Date(t0.getTime() + 10_000)).attemptId;

    // An unrelated persisted key must NOT retire a pending attempt.
    clearSubmissionAttempt(attemptStoreKey);
    const pending = load(t0).attemptId;
    rememberSubmittedKey(attemptStoreKey, "p2-12:observation:out-1:mine");
    reconcileSubmissionAttempt(attemptStoreKey, ["p2-12:observation:out-1:someone-elses"]);
    const survivesUnrelatedKey = peekSubmissionAttempt(attemptStoreKey)?.attemptId === pending;

    // Past the window the submission is no longer "the same submission": a new identity
    // is minted, which is exactly the reauthorization path an expired Action needs.
    clearSubmissionAttempt(attemptStoreKey);
    const beforeExpiry = load(t0).attemptId;
    const afterExpiry = load(new Date(t0.getTime() + 61_000)).attemptId;
    clearSubmissionAttempt(attemptStoreKey);

    // A Material Action attempt carries ONE wall-clock reading, so the timestamps folded
    // into P2-06's proposal digest are identical across a retry.
    const draft = { actionType: "supplier contract amendment", intendedEffect: "Amend the scope", actionClass: "external_write", risk: "medium", reversibility: "reversible", sideEffect: "none" };
    const draftDigest = await sha256Hex(canonicalMaterialActionDraft(draft, "Recorded human decision."));
    // Correcting a mis-stated classification must be a NEW submission, not a conflicting
    // retry of the old identity.
    const correctedDigest = await sha256Hex(
      canonicalMaterialActionDraft({ ...draft, risk: "high" }, "Recorded human decision.")
    );
    const actionKey = materialActionAttemptKey("ws-1", "proj-1", "dec-1", draftDigest);
    const correctedKey = materialActionAttemptKey("ws-1", "proj-1", "dec-1", correctedDigest);
    clearSubmissionAttempt(correctedKey);
    clearSubmissionAttempt(actionKey);
    const actionFirst = loadSubmissionAttempt(actionKey, { ttlMs: MATERIAL_ACTION_WINDOW_MS, now: t0, mint });
    const actionRetry = loadSubmissionAttempt(actionKey, {
      ttlMs: MATERIAL_ACTION_WINDOW_MS,
      now: new Date(t0.getTime() + 30_000),
      mint,
    });
    clearSubmissionAttempt(actionKey);
    const actionAfterAccept = loadSubmissionAttempt(actionKey, {
      ttlMs: MATERIAL_ACTION_WINDOW_MS,
      now: new Date(t0.getTime() + 40_000),
      mint,
    });

    return {
      stable: first === second,
      reorderedEvidence: first === reordered,
      whitespaceNormalised: first === trimmed,
      differsOnState: first !== otherState,
      differsOnSummary: first !== otherSummary,
      differsOnEvidence: first !== otherEvidence,
      differsOnOutcome: first !== otherOutcome,
      differsOnAttempt: first !== otherAttempt,
      sample: first,
      digest: first.split(":").pop(),
      // Known-answer check against the platform primitive, so the digest is provably SHA-256.
      knownAnswer: (await sha256Hex("abc")) === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      canonicalPayload: canonicalObservationPayload(base),
      lifecycle: {
        retryReusesAttempt: firstUse === retryAfterRemount,
        retainedAfterFailure: heldAfterFailure === firstUse,
        clearedAfterReconcile,
        nextSubmissionIsNew: nextSubmission !== firstUse,
        survivesUnrelatedKey,
        newIdentityAfterWindow: beforeExpiry !== afterExpiry,
      },
      materialActionAttempt: {
        // Same attempt across a retry: same key, same createdAt, so the same digest.
        retryKeepsIdentity: actionFirst.attemptId === actionRetry.attemptId,
        retryKeepsTimestamp: actionFirst.startedAt === actionRetry.startedAt,
        // Once accepted, the next proposal for this Decision is a NEW submission.
        replacementIsNewIdentity: actionAfterAccept.attemptId !== actionFirst.attemptId,
        scopedKey: actionKey,
        windowMs: MATERIAL_ACTION_WINDOW_MS,
        // A corrected classification resolves to a DIFFERENT attempt, so the PM is never
        // locked into a conflicting digest by their own first answer.
        correctedDraftIsNewSubmission: correctedKey !== actionKey,
        correctedDraftAttemptId: loadSubmissionAttempt(correctedKey, {
          ttlMs: MATERIAL_ACTION_WINDOW_MS,
          now: new Date(t0.getTime() + 50_000),
          mint,
        }).attemptId,
        firstDraftAttemptId: actionFirst.attemptId,
      },
    };
  }

async function main() {
  const idempotencyResult = await buildIdempotency();
  const result = {
  contract: {
    actionEligibleStatuses: [...ACTION_ELIGIBLE_DECISION_STATUSES],
    taskEligibleGovernanceStates: [...TASK_ELIGIBLE_GOVERNANCE_STATES],
    executionCommands: [...EXECUTION_COMMANDS],
    executionTransitions: EXECUTION_TRANSITIONS,
    governanceRevalidatedCommands: [...GOVERNANCE_REVALIDATED_COMMANDS],
    materialActionClasses: [...MATERIAL_ACTION_CLASSES],
    materialActionRisks: [...MATERIAL_ACTION_RISKS],
    materialActionReversibility: [...MATERIAL_ACTION_REVERSIBILITY],
    materialActionSideEffects: [...MATERIAL_ACTION_SIDE_EFFECTS],
    missingDataStates: [...MISSING_DATA_STATES],
  },

  /** A. Idempotency identity is a deterministic SHA-256 of content, never of time. */
  idempotency: idempotencyResult,

  /** B. The chain's persisted correlation, carried from the Action. */
  correlation: {
    actionCorrelationId: branchOf(one(authorized))?.action.correlationId,
    executionCorrelationSource: "material_action_proposals.correlation_id",
  },

  /** C. Only evidence P2-09 will accept may be offered as the basis of an Observation. */
  evidenceEligibility: (() => {
    const live = {
      id: "ev-live",
      normalized_event_id: "ne-1",
      fixture_state: "LIVE",
      freshness_state: "CURRENT",
      lifecycle: "RECORDED",
      rejection_reason: null,
      degraded_reason: null,
      evaluated_at: "2026-08-17T10:00:00Z",
      stale_at: null,
    };
    const at = new Date("2026-08-17T12:00:00Z");
    return {
      live: isObservationEligibleEvidence(live, at),
      fixture: isObservationEligibleEvidence({ ...live, fixture_state: "DEMO_FIXTURE" }, at),
      noProvenance: isObservationEligibleEvidence({ ...live, normalized_event_id: null }, at),
      degraded: isObservationEligibleEvidence({ ...live, degraded_reason: "source degraded" }, at),
      rejected: isObservationEligibleEvidence({ ...live, rejection_reason: "rejected" }, at),
      stale: isObservationEligibleEvidence({ ...live, stale_at: "2026-08-17T11:00:00Z" }, at),
      notCurrent: isObservationEligibleEvidence({ ...live, freshness_state: "STALE" }, at),
      notRecorded: isObservationEligibleEvidence({ ...live, lifecycle: "DRAFT" }, at),
      unevaluated: isObservationEligibleEvidence({ ...live, evaluated_at: null }, at),
    };
  })(),

  decidedOnly: {
    chains: chainsOf(decidedOnly).length,
    id: one(decidedOnly).id,
    actionStage: stageOf(one(decidedOnly), "material_action"),
    taskStage: stageOf(one(decidedOnly), "task"),
    boundary: one(decidedOnly).boundary,
    branches: one(decidedOnly).branches.length,
    action: branchOf(one(decidedOnly))?.action ?? null,
    lineage: branchOf(one(decidedOnly))?.lineage ?? null,
    status: one(decidedOnly).status,
  },

  rejected: {
    chains: chainsOf(rejected).length,
    actionStage: stageOf(one(rejected), "material_action"),
    status: one(rejected).status,
    queue: markup(<ExecutionQueue chains={chainsOf(rejected)} onSelect={() => {}} />),
  },

  escalated: { chains: chainsOf(escalated).length },

  foreignActor: { actionStage: stageOf(one(foreignActor), "material_action") },
  noEvidenceLink: { actionStage: stageOf(one(noEvidenceLink), "material_action") },
  requiresApproval: {
    taskStage: stageOf(one(requiresApproval), "task"),
    governanceState: branchOf(one(requiresApproval))?.action.governanceState,
    status: one(requiresApproval).status,
    queue: markup(<ExecutionQueue chains={chainsOf(requiresApproval)} onSelect={() => {}} />),
  },
  deniedAction: { taskStage: stageOf(one(deniedAction), "task"), status: one(deniedAction).status },

  authorized: {
    taskStage: stageOf(one(authorized), "task"),
    canExecute: branchOf(one(authorized))?.action.canExecute,
    task: branchOf(one(authorized))?.task ?? null,
    boundary: one(authorized).boundary,
    proposalStage: one(authorized).proposalStage,
    status: one(authorized).status,
    queue: markup(<ExecutionQueue chains={chainsOf(authorized)} onSelect={() => {}} />),
  },

  workDoneNoOutcome: {
    boundary: one(workDoneNoOutcome).boundary,
    outcomeStage: stageOf(one(workDoneNoOutcome), "outcome"),
    observationStage: stageOf(one(workDoneNoOutcome), "observation"),
    reviewStage: stageOf(one(workDoneNoOutcome), "review"),
    lineage: branchOf(one(workDoneNoOutcome))?.lineage ?? null,
    outcome: branchOf(one(workDoneNoOutcome))?.outcome ?? null,
    observations: branchOf(one(workDoneNoOutcome))?.observations.length ?? 0,
  },

  workDoneOutcomeExpected: {
    boundary: one(workDoneOutcomeExpected).boundary,
    outcomeState: branchOf(one(workDoneOutcomeExpected))?.outcome?.state,
  },

  inconclusive: {
    boundary: one(inconclusive).boundary,
    observationState: branchOf(one(inconclusive))?.observations[0]?.observationState,
    missingDataState: branchOf(one(inconclusive))?.observations[0]?.missingDataState,
    lineageStatus: branchOf(one(inconclusive))?.lineage?.lineageStatus,
    hasCorrelationOnly: branchOf(one(inconclusive))?.lineage?.hasCorrelationOnly,
    gaps: branchOf(one(inconclusive))?.lineage?.gaps,
    missingStep: branchOf(one(inconclusive))?.lineage?.steps.find((step) => step.id === null)?.gapReason,
  },

  achieved: { boundary: one(achieved).boundary },

  viewer: {
    stages: chainStages(one(viewer)).map((stage) => ({ key: stage.key, actionable: stage.actionable, blockedReason: stage.blockedReason })),
    anyActionable: chainStages(one(viewer)).some((stage) => stage.actionable),
  },

  foreignTask: {
    task: branchOf(one(foreignTask))?.task ?? null,
    taskStageActionable: stageOf(one(foreignTask), "task")?.actionable,
    executions: branchOf(one(foreignTask))?.executions.length ?? 0,
  },

  ungovernedTask: {
    task: branchOf(one(ungovernedTask))?.task ?? null,
    readSourceActionId: readSourceActionId({ source_payload: { source: "raid_item", sourceActionId: "act-1" } }),
  },

  lookup: {
    found: Boolean(findExecutionChainByDecisionId(chainsOf(authorized), "dec-1")),
    foreign: Boolean(findExecutionChainByDecisionId(chainsOf(authorized), "dec-from-other-project")),
  },

  // ── F2 + F9: expired authorization recovery and multiple Actions per Decision ─────
  expiredNoTask: {
    branches: one(expiredNoTask).branches.length,
    expired: branchOf(one(expiredNoTask))?.action.expired,
    dispatchable: branchOf(one(expiredNoTask))?.action.dispatchable,
    taskStage: stageOf(one(expiredNoTask), "task"),
    // The recovery: the proposal stage reopens for a REPLACEMENT authorization.
    proposalStage: one(expiredNoTask).proposalStage,
    status: one(expiredNoTask).status,
    queue: markup(<ExecutionQueue chains={chainsOf(expiredNoTask)} onSelect={() => {}} />),
    rendered: markup(<ExecutionChainPanel chain={one(expiredNoTask)} onRun={noop} evidenceOptions={evidenceOptions} />),
  },

  expiredPlusReplacement: {
    branches: one(expiredPlusReplacement).branches.length,
    // Newest first, and the superseded Action is still fully present.
    branchIds: one(expiredPlusReplacement).branches.map((b) => b.id),
    actionIds: one(expiredPlusReplacement).branches.map((b) => b.action.actionId),
    expiredFlags: one(expiredPlusReplacement).branches.map((b) => b.action.expired),
    dispatchableFlags: one(expiredPlusReplacement).branches.map((b) => b.action.dispatchable),
    // A live branch exists, so no further replacement is offered.
    proposalStage: one(expiredPlusReplacement).proposalStage,
    status: one(expiredPlusReplacement).status,
    rendered: markup(
      <ExecutionChainPanel chain={one(expiredPlusReplacement)} onRun={noop} evidenceOptions={evidenceOptions} />
    ),
  },

  twoActionsTwoTasks: {
    branches: one(twoActionsTwoTasks).branches.length,
    actionIds: one(twoActionsTwoTasks).branches.map((b) => b.action.actionId),
    taskIds: one(twoActionsTwoTasks).branches.map((b) => b.task?.taskId ?? null),
    executionIds: one(twoActionsTwoTasks).branches.map((b) => b.latestExecution?.executionId ?? null),
    outcomeIds: one(twoActionsTwoTasks).branches.map((b) => b.outcome?.outcomeId ?? null),
    observationCounts: one(twoActionsTwoTasks).branches.map((b) => b.observations.length),
    proposalStage: one(twoActionsTwoTasks).proposalStage,
    rendered: markup(
      <ExecutionChainPanel chain={one(twoActionsTwoTasks)} onRun={noop} evidenceOptions={evidenceOptions} />
    ),
  },

  // ── F6: task dispatch is restricted to the Action's own proposer ──────────────────
  otherWritableMember: {
    canWrite: otherWritableMember.actor.canCreateEvidence,
    proposedBy: branchOf(one(otherWritableMember))?.action.proposedBy,
    governanceState: branchOf(one(otherWritableMember))?.action.governanceState,
    taskStage: stageOf(one(otherWritableMember), "task"),
    rendered: markup(
      <ExecutionChainPanel chain={one(otherWritableMember)} onRun={noop} evidenceOptions={evidenceOptions} />
    ),
  },
  ownerCanDispatch: { taskStage: stageOf(one(authorized), "task") },

  // ── F3: execution controls follow the persisted P2-08 state machine ───────────────
  executionStates: Object.fromEntries(
    (
      [
        ["none_not_started", noExecutionNotStarted],
        ["none_in_progress", noExecutionInProgress],
        ["queued", execQueued],
        ["running", execRunning],
        ["blocked", execBlocked],
        ["failed", execFailed],
        ["completed", execCompleted],
      ] as Array<[string, OperationalSummary]>
    ).map(([label, fixture]) => {
      const b = branchOf(one(fixture))!;
      return [
        label,
        {
          status: b.latestExecution?.status ?? null,
          taskStatus: b.task?.status ?? null,
          commands: [...b.offeredCommands],
          stage: b.stages.find((entry) => entry.key === "execution")!,
          rendered: markup(<ExecutionChainPanel chain={one(fixture)} onRun={noop} evidenceOptions={evidenceOptions} />),
        },
      ];
    })
  ),

  foreignExecutionActor: {
    dispatchedBy: branchOf(one(foreignExecutionActor))?.latestExecution?.dispatchedBy,
    stage: stageOf(one(foreignExecutionActor), "execution"),
  },

  // ── F5: an expected Outcome requires completed work ───────────────────────────────
  outcomeGate: Object.fromEntries(
    (
      [
        ["task_not_started_exec_queued", ["not_started", "queued"]],
        ["task_in_progress_exec_running", ["in_progress", "running"]],
        ["task_blocked_exec_blocked", ["blocked", "blocked"]],
        ["task_in_progress_exec_failed", ["in_progress", "failed"]],
        ["task_completed_exec_running", ["completed", "running"]],
        ["task_completed_exec_failed", ["completed", "failed"]],
        ["task_completed_exec_completed", ["completed", "completed"]],
      ] as Array<[string, [string, string]]>
    ).map(([label, [taskStatus, executionStatus]]) => {
      const chain = one(outcomeGate(taskStatus, executionStatus));
      const stage = branchOf(chain)!.stages.find((entry) => entry.key === "outcome")!;
      return [label, { actionable: stage.actionable, blockedReason: stage.blockedReason }];
    })
  ),

  // ── F10: the queue reports the persisted governance state, never a positive reading ─
  governanceLabels: {
    authorized: describeGovernanceState("authorized"),
    notRequired: describeGovernanceState("not_required"),
    requiresApproval: describeGovernanceState("requires_approval"),
    denied: describeGovernanceState("denied"),
    degraded: describeGovernanceState("degraded"),
    unavailable: describeGovernanceState("unavailable"),
    revoked: describeGovernanceState("revoked"),
    unknownState: describeGovernanceState("some_future_state"),
  },
  governanceQueues: Object.fromEntries(
    (
      [
        ["authorized", authorized],
        ["requiresApproval", requiresApproval],
        ["denied", deniedAction],
        ["degraded", degradedAction],
        ["unavailable", unavailableAction],
        ["revoked", revokedAction],
        ["expired", expiredNoTask],
      ] as Array<[string, OperationalSummary]>
    ).map(([label, fixture]) => [
      label,
      {
        detail: one(fixture).status.detail,
        badge: one(fixture).status.label,
        tone: one(fixture).status.tone,
      },
    ])
  ),

  // ── F6-adjacent: every P2-07 dispatch gate, not only the governance state ─────────
  dispatchGates: Object.fromEntries(
    (
      [
        ["authorized", authorized],
        ["stale_evaluation", staleEvaluation],
        ["cannot_commit", cannotCommitAction],
        ["missing_grant_evidence", missingGrantEvidence],
        ["unevaluated", unevaluatedAction],
        ["expired", expiredNoTask],
      ] as Array<[string, OperationalSummary]>
    ).map(([label, fixture]) => {
      const chain = one(fixture);
      const branch = branchOf(chain)!;
      return [
        label,
        {
          governanceState: branch.action.governanceState,
          hasEvaluation: branch.action.hasEvaluation,
          evaluationStale: branch.action.evaluationStale,
          canCommitAction: branch.action.canCommitAction,
          authorizationEvidenceComplete: branch.action.authorizationEvidenceComplete,
          dispatchable: branch.action.dispatchable,
          blockReason: dispatchBlockReason(branch.action),
          taskStage: branch.stages.find((entry) => entry.key === "task")!,
          executionStage: branch.stages.find((entry) => entry.key === "execution")!,
          offeredCommands: [...branch.offeredCommands],
          // A branch that cannot carry the chain must not block the replacement path.
          proposalStage: chain.proposalStage,
          status: chain.status,
          rendered: markup(<ExecutionChainPanel chain={chain} onRun={noop} evidenceOptions={evidenceOptions} />),
        },
      ];
    })
  ),

  // ── F3-adjacent: new work revalidates governance; stopping work does not ─────────
  lapsedMidFlight: Object.fromEntries(
    (["queued", "running", "blocked", "failed"] as string[]).map((status) => {
      const chain = one(lapsedMidFlight(status));
      const branch = branchOf(chain)!;
      return [
        status,
        {
          executionStatus: branch.latestExecution?.status ?? null,
          actionExpired: branch.action.expired,
          transitionTable: [...allowedExecutionCommands(status)],
          offeredCommands: [...branch.offeredCommands],
          stage: branch.stages.find((entry) => entry.key === "execution")!,
        },
      ];
    })
  ),
  foreignProposerQueue: {
    proposedBy: branchOf(one(foreignProposerQueue))?.action.proposedBy,
    taskStatus: branchOf(one(foreignProposerQueue))?.task?.status,
    transitionTable: [...allowedExecutionCommands(null)],
    offeredCommands: [...(branchOf(one(foreignProposerQueue))?.offeredCommands ?? [])],
    stage: stageOf(one(foreignProposerQueue), "execution"),
  },

  // ── F4: a persisted Observation carries the key its attempt submitted ─────────────
  observationReconciliation: {
    persistedKeys: branchOf(one(observedWithKey))?.observations.map((o) => o.idempotencyKey),
  },

  rendered: {
    workDoneNoOutcome: markup(
      <ExecutionChainPanel chain={one(workDoneNoOutcome)} onRun={noop} evidenceOptions={evidenceOptions} />
    ),
    viewer: markup(<ExecutionChainPanel chain={one(viewer)} onRun={noop} evidenceOptions={evidenceOptions} />),
    inconclusive: markup(
      <ExecutionChainPanel chain={one(inconclusive)} onRun={noop} evidenceOptions={evidenceOptions} />
    ),
    noEvidence: markup(<ExecutionChainPanel chain={one(workDoneOutcomeExpected)} onRun={noop} evidenceOptions={[]} />),
    decidedOnlyActionForm: markup(
      <ExecutionChainPanel chain={one(decidedOnly)} onRun={noop} evidenceOptions={evidenceOptions} />
    ),
    queuePopulated: markup(
      <ExecutionQueue chains={chainsOf(workDoneNoOutcome)} onSelect={() => {}} />
    ),
    queueEmpty: markup(<ExecutionQueue chains={[]} onSelect={() => {}} />),
  },
};

  console.log(JSON.stringify(result));
}

void main();
