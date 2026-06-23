import type {
  GovernanceCommitmentRow,
  GovernanceCommitmentHistoryRow,
  GovernanceCommitmentDelegationRow,
  GovernanceCommitmentEvidenceRow,
} from "@/lib/db/database-contract";

export type {
  GovernanceCommitmentRow,
  GovernanceCommitmentHistoryRow,
  GovernanceCommitmentDelegationRow,
  GovernanceCommitmentEvidenceRow,
};

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type GovernanceCommitmentStatus =
  | "pending_acceptance"
  | "accepted"
  | "rejected"
  | "active"
  | "completed"
  | "breached"
  | "cancelled"
  | "delegated"
  | "expired";

export type GovernanceCommitmentPriority = "low" | "medium" | "high" | "critical";

export type GovernanceCommitmentOutcome = "successful" | "partial" | "failed" | "unknown";

export type GovernanceCommitmentDelegationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

// ─── Constants ────────────────────────────────────────────────────────────────

export const GOVERNANCE_COMMITMENT_STATUSES: GovernanceCommitmentStatus[] = [
  "pending_acceptance",
  "accepted",
  "rejected",
  "active",
  "completed",
  "breached",
  "cancelled",
  "delegated",
  "expired",
];

export const GOVERNANCE_COMMITMENT_PRIORITIES: GovernanceCommitmentPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const GOVERNANCE_COMMITMENT_OUTCOMES: GovernanceCommitmentOutcome[] = [
  "successful",
  "partial",
  "failed",
  "unknown",
];

export const GOVERNANCE_COMMITMENT_TERMINAL_STATUSES: GovernanceCommitmentStatus[] = [
  "completed",
  "breached",
  "cancelled",
  "expired",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type GovernanceCommitmentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type GovernanceCommitmentEventType =
  | "GOVERNANCE_COMMITMENT_CREATED"
  | "GOVERNANCE_COMMITMENT_ACCEPTED"
  | "GOVERNANCE_COMMITMENT_REJECTED"
  | "GOVERNANCE_COMMITMENT_ACTIVATED"
  | "GOVERNANCE_COMMITMENT_COMPLETED"
  | "GOVERNANCE_COMMITMENT_CANCELLED"
  | "GOVERNANCE_COMMITMENT_BREACHED"
  | "GOVERNANCE_COMMITMENT_EXPIRED"
  | "GOVERNANCE_COMMITMENT_DELEGATED"
  | "GOVERNANCE_COMMITMENT_FORECAST_GENERATED"
  | "GOVERNANCE_COMMITMENT_HEALTH_CALCULATED"
  | "GOVERNANCE_COMMITMENT_LINEAGE_GENERATED";

// ─── Service Input Types ──────────────────────────────────────────────────────

export type CreateCommitmentInput = {
  workspaceId: string;
  actionId: string;
  commitmentTitle: string;
  commitmentDescription: string;
  ownerId: string;
  ownerType: string;
  priority: GovernanceCommitmentPriority;
  dueDate: string;
  actorId: string;
};

export type AcceptCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
  actorId: string;
};

export type RejectCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
  reason: string;
  actorId: string;
};

export type ActivateCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
  actorId: string;
};

export type CompleteCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
  outcome: GovernanceCommitmentOutcome;
  actorId: string;
};

export type CancelCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
  reason: string;
  actorId: string;
};

export type BreachCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
  reason: string;
  actorId: string;
};

export type ExpireCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
  actorId: string;
};

export type DelegateCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
  delegatedTo: string;
  reason: string;
  actorId: string;
};

export type GetCommitmentInput = {
  workspaceId: string;
  commitmentId: string;
};

export type ListCommitmentsInput = {
  workspaceId: string;
  status?: GovernanceCommitmentStatus;
  ownerId?: string;
  priority?: GovernanceCommitmentPriority;
  fromDueDate?: string;
  toDueDate?: string;
  actionId?: string;
};

export type AttachEvidenceInput = {
  workspaceId: string;
  commitmentId: string;
  artifactId?: string | null;
  memoryRecordId?: string | null;
  description: string;
  actorId: string;
};

// ─── Output / View Types ──────────────────────────────────────────────────────

export type CommitmentWithDetails = GovernanceCommitmentRow & {
  history: GovernanceCommitmentHistoryRow[];
  delegations: GovernanceCommitmentDelegationRow[];
  evidence: GovernanceCommitmentEvidenceRow[];
};

export type CommitmentAccountability = {
  commitmentId: string;
  owner: string;
  accepted: boolean;
  completed: boolean;
  overdue: boolean;
  daysLate: number;
  status: GovernanceCommitmentStatus;
};

export type CommitmentHealthScore = {
  workspaceId: string;
  score: number;
  totalCommitments: number;
  completed: number;
  breached: number;
  overdue: number;
  delegated: number;
  active: number;
  pendingAcceptance: number;
  calculatedAt: string;
};

export type CommitmentBreachReport = {
  workspaceId: string;
  breaches: Array<{
    commitmentId: string;
    title: string;
    ownerId: string;
    dueDate: string;
    status: GovernanceCommitmentStatus;
    daysOverdue: number;
  }>;
  detectedAt: string;
};

export type DelegationValidationResult = {
  valid: boolean;
  reason: string;
};

export type CommitmentForecast = {
  commitmentId: string;
  probabilityOfCompletion: number;
  riskOfBreach: number;
  forecastedAt: string;
};

export type CommitmentLineage = {
  commitmentId: string;
  chain: Array<{
    layer:
      | "artifact"
      | "memory"
      | "digest"
      | "learning_pattern"
      | "recommendation"
      | "signal"
      | "action"
      | "commitment";
    entityType: string;
    entityId: string | null;
    label: string;
  }>;
};
