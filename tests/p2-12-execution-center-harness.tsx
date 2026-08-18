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
  createAttemptTracker,
  canonicalObservationPayload,
  sha256Hex,
  isObservationEligibleEvidence,
  ACTION_ELIGIBLE_DECISION_STATUSES,
  TASK_ELIGIBLE_GOVERNANCE_STATES,
  EXECUTION_COMMANDS,
  MATERIAL_ACTION_CLASSES,
  MATERIAL_ACTION_RISKS,
  MATERIAL_ACTION_REVERSIBILITY,
  MATERIAL_ACTION_SIDE_EFFECTS,
  MISSING_DATA_STATES,
  type GovernedExecutionChain,
} from "../src/modules/workspace/presentation/command-center/execution-read-model";
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
  action_class: "external_write",
  materiality: "material",
  proposal_digest: "sha256:abcdef0123456789abcdef",
  correlation_id: "corr-1",
  causation_id: "dec-1",
  proposal: { actionType: "governed_project_change", evidenceReferenceIds: ["ev-1"] },
  ...over,
});

const evaluation = (over: Record<string, unknown> = {}) => ({
  action_id: "act-1",
  governance_state: "authorized",
  can_execute: false,
  evaluated_at: "2026-08-17T10:05:00Z",
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
  ...over,
});

const one = (s: OperationalSummary): GovernedExecutionChain => buildExecutionChains(s)[0];
const stageOf = (chain: GovernedExecutionChain, key: string) => chain.stages.find((entry) => entry.key === key)!;

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

    // Attempt lifecycle, exercised as real behaviour with a deterministic mint.
    let minted = 0;
    const tracker = createAttemptTracker(() => `nonce-${++minted}`);
    const firstUse = tracker.begin();
    const retryWhileFailed = tracker.begin();        // request failed: token retained
    const heldAfterFailure = tracker.current();
    tracker.succeed();                                // server accepted the submission
    const clearedAfterSuccess = tracker.current();
    const nextSubmission = tracker.begin();           // a later observation

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
        retryReusesAttempt: firstUse === retryWhileFailed,
        retainedAfterFailure: heldAfterFailure === firstUse,
        clearedAfterSuccess,
        nextSubmissionIsNew: nextSubmission !== firstUse,
        mintCount: minted,
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
    actionCorrelationId: one(authorized).action?.correlationId,
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
    chains: buildExecutionChains(decidedOnly).length,
    id: one(decidedOnly).id,
    actionStage: stageOf(one(decidedOnly), "material_action"),
    taskStage: stageOf(one(decidedOnly), "task"),
    boundary: one(decidedOnly).boundary,
    action: one(decidedOnly).action,
    lineage: one(decidedOnly).lineage,
  },

  rejected: {
    chains: buildExecutionChains(rejected).length,
    actionStage: stageOf(one(rejected), "material_action"),
  },

  escalated: { chains: buildExecutionChains(escalated).length },

  foreignActor: { actionStage: stageOf(one(foreignActor), "material_action") },
  noEvidenceLink: { actionStage: stageOf(one(noEvidenceLink), "material_action") },
  requiresApproval: {
    taskStage: stageOf(one(requiresApproval), "task"),
    governanceState: one(requiresApproval).action?.governanceState,
  },
  deniedAction: { taskStage: stageOf(one(deniedAction), "task") },

  authorized: {
    taskStage: stageOf(one(authorized), "task"),
    canExecute: one(authorized).action?.canExecute,
    task: one(authorized).task,
    boundary: one(authorized).boundary,
  },

  workDoneNoOutcome: {
    boundary: one(workDoneNoOutcome).boundary,
    outcomeStage: stageOf(one(workDoneNoOutcome), "outcome"),
    observationStage: stageOf(one(workDoneNoOutcome), "observation"),
    reviewStage: stageOf(one(workDoneNoOutcome), "review"),
    lineage: one(workDoneNoOutcome).lineage,
    outcome: one(workDoneNoOutcome).outcome,
    observations: one(workDoneNoOutcome).observations.length,
  },

  workDoneOutcomeExpected: {
    boundary: one(workDoneOutcomeExpected).boundary,
    outcomeState: one(workDoneOutcomeExpected).outcome?.state,
  },

  inconclusive: {
    boundary: one(inconclusive).boundary,
    observationState: one(inconclusive).observations[0]?.observationState,
    missingDataState: one(inconclusive).observations[0]?.missingDataState,
    lineageStatus: one(inconclusive).lineage?.lineageStatus,
    hasCorrelationOnly: one(inconclusive).lineage?.hasCorrelationOnly,
    gaps: one(inconclusive).lineage?.gaps,
    missingStep: one(inconclusive).lineage?.steps.find((step) => step.id === null)?.gapReason,
  },

  achieved: { boundary: one(achieved).boundary },

  viewer: {
    stages: one(viewer).stages.map((stage) => ({ key: stage.key, actionable: stage.actionable, blockedReason: stage.blockedReason })),
    anyActionable: one(viewer).stages.some((stage) => stage.actionable),
  },

  foreignTask: {
    task: one(foreignTask).task,
    taskStageActionable: stageOf(one(foreignTask), "task").actionable,
    executions: one(foreignTask).executions.length,
  },

  ungovernedTask: {
    task: one(ungovernedTask).task,
    readSourceActionId: readSourceActionId({ source_payload: { source: "raid_item", sourceActionId: "act-1" } }),
  },

  lookup: {
    found: Boolean(findExecutionChainByDecisionId(buildExecutionChains(authorized), "dec-1")),
    foreign: Boolean(findExecutionChainByDecisionId(buildExecutionChains(authorized), "dec-from-other-project")),
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
      <ExecutionQueue chains={buildExecutionChains(workDoneNoOutcome)} onSelect={() => {}} />
    ),
    queueEmpty: markup(<ExecutionQueue chains={[]} onSelect={() => {}} />),
  },
};

  console.log(JSON.stringify(result));
}

void main();
