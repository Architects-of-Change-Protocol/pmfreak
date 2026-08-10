/** Canonical PMFreak business lineage contracts. No type in this module mutates persistence. */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

declare const canonicalIdBrand: unique symbol;
export type CanonicalId<K extends CanonicalObjectKind> = string & {
  readonly [canonicalIdBrand]: K;
};

export const CANONICAL_OBJECT_KINDS = ["recommendation", "decision", "action", "task", "outcome"] as const;
export type CanonicalObjectKind = (typeof CANONICAL_OBJECT_KINDS)[number];

export type RecommendationId = CanonicalId<"recommendation">;
export type DecisionId = CanonicalId<"decision">;
export type ActionId = CanonicalId<"action">;
export type TaskId = CanonicalId<"task">;
export type OutcomeId = CanonicalId<"outcome">;

export type CanonicalIdByKind = {
  recommendation: RecommendationId;
  decision: DecisionId;
  action: ActionId;
  task: TaskId;
  outcome: OutcomeId;
};

export type CanonicalIdParseResult<K extends CanonicalObjectKind> =
  | { ok: true; value: CanonicalIdByKind[K] }
  | { ok: false; code: "invalid_canonical_id"; kind: K; received: unknown };

export function parseCanonicalId<K extends CanonicalObjectKind>(kind: K, value: unknown): CanonicalIdParseResult<K> {
  if (typeof value === "string" && UUID_PATTERN.test(value)) {
    return { ok: true, value: value as CanonicalIdByKind[K] };
  }
  return { ok: false, code: "invalid_canonical_id", kind, received: value };
}

export const LEGACY_REFERENCE_KINDS = [
  "operational_recommendation",
  "recommended_action",
  "recommended_action_decision",
  "operational_decision_record",
  "project_decision",
  "task_draft",
  "execution_task",
  "agent_decision",
  "agent_execution_outcome",
  "operational_decision_outcome",
] as const;
export type LegacyReferenceKind = (typeof LEGACY_REFERENCE_KINDS)[number];

export type LegacyReference = Readonly<{
  kind: LegacyReferenceKind;
  id: string;
  workspaceId: string;
  projectId: string | null;
}>;

export type CanonicalReference<K extends CanonicalObjectKind = CanonicalObjectKind> = Readonly<{
  kind: K;
  id: CanonicalIdByKind[K];
  workspaceId: string;
  projectId: string;
  legacyReferences: readonly LegacyReference[];
}>;

export const RECOMMENDATION_STATES = ["draft", "proposed", "accepted", "rejected", "deferred", "expired", "superseded"] as const;
export const DECISION_STATES = ["draft", "recorded", "pending_approval", "approved", "rejected", "deferred", "superseded", "expired"] as const;
export const ACTION_STATES = ["requested", "authorized", "denied", "revoked", "committed", "cancelled", "expired"] as const;
export const TASK_STATES = ["proposed", "ready", "in_progress", "blocked", "completed", "failed", "cancelled"] as const;
export const OUTCOME_STATES = ["expected", "observing", "achieved", "partially_achieved", "not_achieved", "disputed", "inconclusive", "superseded"] as const;

export type RecommendationState = (typeof RECOMMENDATION_STATES)[number];
export type DecisionState = (typeof DECISION_STATES)[number];
export type ActionState = (typeof ACTION_STATES)[number];
export type TaskState = (typeof TASK_STATES)[number];
export type OutcomeState = (typeof OUTCOME_STATES)[number];

export type StateByKind = {
  recommendation: RecommendationState;
  decision: DecisionState;
  action: ActionState;
  task: TaskState;
  outcome: OutcomeState;
};

export const CANONICAL_TRANSITIONS = {
  recommendation: {
    draft: ["proposed"], proposed: ["accepted", "rejected", "deferred", "expired", "superseded"],
    accepted: ["superseded"], rejected: [], deferred: ["proposed", "expired", "superseded"], expired: [], superseded: [],
  },
  decision: {
    draft: ["recorded"], recorded: ["pending_approval", "approved", "rejected", "deferred", "superseded", "expired"],
    pending_approval: ["approved", "rejected", "deferred", "expired"], approved: ["superseded", "expired"],
    rejected: [], deferred: ["recorded", "expired", "superseded"], superseded: [], expired: [],
  },
  action: {
    requested: ["authorized", "denied", "cancelled", "expired"], authorized: ["committed", "revoked", "cancelled", "expired"],
    denied: [], revoked: [], committed: ["revoked", "cancelled"], cancelled: [], expired: [],
  },
  task: {
    proposed: ["ready", "cancelled"], ready: ["in_progress", "blocked", "cancelled"],
    in_progress: ["blocked", "completed", "failed", "cancelled"], blocked: ["ready", "in_progress", "failed", "cancelled"],
    completed: [], failed: ["ready", "cancelled"], cancelled: [],
  },
  outcome: {
    expected: ["observing", "superseded"], observing: ["achieved", "partially_achieved", "not_achieved", "disputed", "inconclusive", "superseded"],
    achieved: ["disputed", "superseded"], partially_achieved: ["disputed", "superseded"], not_achieved: ["disputed", "superseded"],
    disputed: ["observing", "superseded"], inconclusive: ["observing", "superseded"], superseded: [],
  },
} as const satisfies { [K in CanonicalObjectKind]: { [S in StateByKind[K]]: readonly StateByKind[K][] } };

export type TransitionResult<K extends CanonicalObjectKind> =
  | { ok: true; kind: K; from: StateByKind[K]; to: StateByKind[K] }
  | { ok: false; code: "illegal_canonical_transition"; kind: K; from: StateByKind[K]; to: StateByKind[K]; allowed: readonly StateByKind[K][] };

export function validateCanonicalTransition<K extends CanonicalObjectKind>(kind: K, from: StateByKind[K], to: StateByKind[K]): TransitionResult<K> {
  // The kind/state relationship is enforced by the public generic signature and
  // by CANONICAL_TRANSITIONS' `satisfies` clause. TypeScript cannot preserve
  // that correlation when indexing the union of transition maps.
  const transitions = CANONICAL_TRANSITIONS[kind] as unknown as Record<string, readonly StateByKind[K][]>;
  const allowed = transitions[from] ?? [];
  return allowed.includes(to)
    ? { ok: true, kind, from, to }
    : { ok: false, code: "illegal_canonical_transition", kind, from, to, allowed };
}

export type AuditContext = Readonly<{
  actorId: string;
  actorType: "user" | "agent" | "system";
  workspaceId: string;
  projectId: string;
  occurredAt: string;
  recordedAt: string;
  correlationId: string;
  causationId: string | null;
  evidenceReferences: readonly string[];
  aocPolicyDecisionReference: string | null;
  aocGrantReference: string | null;
}>;

type CanonicalRecord<K extends CanonicalObjectKind> = Readonly<{
  reference: CanonicalReference<K>;
  state: StateByKind[K];
  createdAt: string;
  updatedAt: string;
  audit: AuditContext;
}>;

export type RecommendationContract = CanonicalRecord<"recommendation"> & Readonly<{
  findingReferences: readonly string[];
  evidenceReferences: readonly string[];
  options: readonly Readonly<{ id: string; label: string; tradeoffs: readonly string[] }>[];
  recommendedOptionId: string | null;
  confidence: "low" | "medium" | "high" | "unavailable";
  missingInformation: readonly string[];
  urgency: "low" | "medium" | "high" | "immediate";
  decisionWindowEndsAt: string | null;
  authorityRequired: string;
  evaluatedAt: string;
  producedBy: Readonly<{ actorId: string; actorType: "user" | "agent" | "system"; engineVersion: string | null }>;
}>;

export type DecisionContract = CanonicalRecord<"decision"> & Readonly<{
  recommendationId: RecommendationId | null;
  selectedOptionId: string | null;
  decisionActorId: string;
  businessAuthority: string;
  rationale: string;
  evidenceSnapshotReferences: readonly string[];
  approvalState: "not_required" | "pending" | "approved" | "rejected";
  obligationReferences: readonly string[];
  decidedAt: string;
}>;

export type ActionContract = CanonicalRecord<"action"> & Readonly<{
  decisionId: DecisionId;
  requestedOperation: string;
  materiality: "ordinary_business" | "material_aoc_governed";
  businessAuthorityResult: "allowed" | "denied";
  aocPolicyDecisionReference: string | null;
  obligationReferences: readonly string[];
  grantReference: string | null;
  requestedAt: string;
  authorizedAt: string | null;
  deniedAt: string | null;
  revokedAt: string | null;
  idempotencyKey: string;
}>;

export type TaskContract = CanonicalRecord<"task"> & Readonly<{
  actionId: ActionId | null;
  systemOfRecord: "pmfreak_internal";
  providerReference: string | null;
  ownerId: string | null;
  commitment: string;
  idempotencyKey: string;
  startedAt: string | null;
  completedAt: string | null;
}>;

export type OutcomeContract = CanonicalRecord<"outcome"> & Readonly<{
  expectedResult: string;
  decisionId: DecisionId;
  actionId: ActionId | null;
  taskId: TaskId | null;
  observationState: "unobserved" | "observing" | "observed" | "disputed";
  evidenceReferences: readonly string[];
  observerId: string | null;
  observedAt: string | null;
  confidence: "low" | "medium" | "high" | "inconclusive";
  disputeReason: string | null;
}>;

export type CanonicalLineage = Readonly<{
  recommendation: CanonicalReference<"recommendation">;
  decision: CanonicalReference<"decision"> | null;
  action: CanonicalReference<"action"> | null;
  task: CanonicalReference<"task"> | null;
  outcome: CanonicalReference<"outcome"> | null;
}>;
