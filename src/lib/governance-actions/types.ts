import type {
  GovernanceActionRow,
  GovernanceActionEvidenceRow,
  GovernanceActionAssignmentRow,
} from "@/lib/db/database-contract";

export type {
  GovernanceActionRow,
  GovernanceActionEvidenceRow,
  GovernanceActionAssignmentRow,
};

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type GovernanceActionType =
  | "create_escalation"
  | "request_ratification"
  | "request_approval"
  | "create_delegation"
  | "assign_authority"
  | "review_amendment"
  | "review_decision"
  | "review_risk"
  | "initiate_governance_review"
  | "close_signal"
  | "reassess_recommendation"
  | "other";

export type GovernanceActionPriority = "low" | "medium" | "high" | "critical";

export type GovernanceActionStatus =
  | "generated"
  | "reviewed"
  | "approved"
  | "rejected"
  | "expired"
  | "completed";

export type GovernanceActionAssignmentStatus =
  | "assigned"
  | "accepted"
  | "completed"
  | "declined";

// ─── Constants ────────────────────────────────────────────────────────────────

export const GOVERNANCE_ACTION_TYPES: GovernanceActionType[] = [
  "create_escalation",
  "request_ratification",
  "request_approval",
  "create_delegation",
  "assign_authority",
  "review_amendment",
  "review_decision",
  "review_risk",
  "initiate_governance_review",
  "close_signal",
  "reassess_recommendation",
  "other",
];

export const GOVERNANCE_ACTION_PRIORITIES: GovernanceActionPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const GOVERNANCE_ACTION_STATUSES: GovernanceActionStatus[] = [
  "generated",
  "reviewed",
  "approved",
  "rejected",
  "expired",
  "completed",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type GovernanceActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type GovernanceActionEventType =
  | "GOVERNANCE_ACTION_GENERATED"
  | "GOVERNANCE_ACTION_ASSIGNED"
  | "GOVERNANCE_ACTION_APPROVED"
  | "GOVERNANCE_ACTION_REJECTED"
  | "GOVERNANCE_ACTION_COMPLETED"
  | "GOVERNANCE_ACTION_EXPIRED"
  | "GOVERNANCE_ACTION_CONFIDENCE_CALCULATED"
  | "GOVERNANCE_ACTION_PRIORITY_CALCULATED"
  | "GOVERNANCE_ACTION_AUTHORITY_VALIDATED"
  | "GOVERNANCE_ACTION_LINEAGE_GENERATED";

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GenerateActionInput = {
  workspaceId: string;
  signalId: string;
  actionType: GovernanceActionType;
  title: string;
  description: string;
  recommendedOwnerType: string;
  recommendedOwnerId?: string | null;
  justification: string;
  confidenceScore: number;
  actionPriority: GovernanceActionPriority;
  recommendedDueDate: string;
  actorId: string;
};

export type GenerateActionsForSignalInput = {
  workspaceId: string;
  signalId: string;
  signalType: string;
  signalSeverity: string;
  confidenceScore: number;
  actorId: string;
};

export type AssignActionInput = {
  workspaceId: string;
  actionId: string;
  assignedTo: string;
  actorId: string;
};

export type ApproveActionInput = {
  workspaceId: string;
  actionId: string;
  actorId: string;
};

export type RejectActionInput = {
  workspaceId: string;
  actionId: string;
  actorId: string;
};

export type CompleteActionInput = {
  workspaceId: string;
  actionId: string;
  actorId: string;
};

export type ExpireActionInput = {
  workspaceId: string;
  actionId: string;
  actorId: string;
};

export type GetActionInput = {
  workspaceId: string;
  actionId: string;
};

export type ListActionsInput = {
  workspaceId: string;
  status?: GovernanceActionStatus;
  priority?: GovernanceActionPriority;
  actionType?: GovernanceActionType;
  signalId?: string;
  ownerId?: string;
  fromDate?: string;
  toDate?: string;
};

export type GenerateGovernanceActionsInput = {
  workspaceId: string;
  actorId: string;
};

// ─── Output / View Types ──────────────────────────────────────────────────────

export type ActionWithEvidence = GovernanceActionRow & {
  evidence: GovernanceActionEvidenceRow[];
  assignments: GovernanceActionAssignmentRow[];
};

export type AuthorityValidationResult = {
  actionType: GovernanceActionType;
  requiredAuthorityType: string;
  recommendedActor: string | null;
  authorized: boolean;
  reason: string;
};

export type InterventionSimulation = {
  actionType: GovernanceActionType;
  expectedEffect: string;
  confidence: number;
  estimatedResolutionDays: number;
};

export type ActionLineage = {
  actionId: string;
  actionType: GovernanceActionType;
  chain: Array<{
    layer:
      | "artifact"
      | "memory"
      | "digest"
      | "learning_pattern"
      | "recommendation"
      | "signal"
      | "action";
    entityType: string;
    entityId: string | null;
    label: string;
  }>;
};

export type ActionCandidate = {
  actionType: GovernanceActionType;
  actionPriority: GovernanceActionPriority;
  title: string;
  description: string;
  recommendedOwnerType: string;
  justification: string;
  confidenceScore: number;
  recommendedDueDate: string;
};

export type GenerateActionsResult = {
  workspaceId: string;
  actionsGenerated: number;
  actionsByType: Partial<Record<GovernanceActionType, number>>;
  generatedAt: string;
};
