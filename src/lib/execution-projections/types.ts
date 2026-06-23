import type {
  ExecutionProjectionRow,
  ExecutionProjectionTaskRow,
  ExecutionProjectionDependencyRow,
  ExecutionProjectionParticipantRow,
} from "@/lib/db/database-contract";

export type {
  ExecutionProjectionRow,
  ExecutionProjectionTaskRow,
  ExecutionProjectionDependencyRow,
  ExecutionProjectionParticipantRow,
};

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type ExecutionProjectionStatus =
  | "generated"
  | "validated"
  | "approved"
  | "rejected"
  | "archived";

export type ExecutionProjectionRisk = "low" | "medium" | "high" | "critical";

export type ExecutionProjectionDependencyType =
  | "decision"
  | "authority"
  | "ratification"
  | "amendment"
  | "resource";

// ─── Constants ────────────────────────────────────────────────────────────────

export const EXECUTION_PROJECTION_STATUSES: ExecutionProjectionStatus[] = [
  "generated",
  "validated",
  "approved",
  "rejected",
  "archived",
];

export const EXECUTION_PROJECTION_RISK_LEVELS: ExecutionProjectionRisk[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const EXECUTION_PROJECTION_DEPENDENCY_TYPES: ExecutionProjectionDependencyType[] = [
  "decision",
  "authority",
  "ratification",
  "amendment",
  "resource",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type ExecutionProjectionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type ExecutionProjectionEventType =
  | "EXECUTION_PROJECTION_GENERATED"
  | "EXECUTION_PROJECTION_VALIDATED"
  | "EXECUTION_PROJECTION_APPROVED"
  | "EXECUTION_PROJECTION_REJECTED"
  | "EXECUTION_PROJECTION_ARCHIVED"
  | "EXECUTION_PROJECTION_EFFORT_CALCULATED"
  | "EXECUTION_PROJECTION_RISK_CALCULATED"
  | "EXECUTION_PROJECTION_CONFIDENCE_CALCULATED"
  | "EXECUTION_PROJECTION_READINESS_CALCULATED"
  | "EXECUTION_PROJECTION_LINEAGE_GENERATED";

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GenerateProjectionInput = {
  workspaceId: string;
  commitmentId: string;
  actorId: string;
};

export type ValidateProjectionInput = {
  workspaceId: string;
  projectionId: string;
  actorId: string;
};

export type ApproveProjectionInput = {
  workspaceId: string;
  projectionId: string;
  actorId: string;
};

export type RejectProjectionInput = {
  workspaceId: string;
  projectionId: string;
  reason: string;
  actorId: string;
};

export type ArchiveProjectionInput = {
  workspaceId: string;
  projectionId: string;
  actorId: string;
};

export type GetProjectionInput = {
  workspaceId: string;
  projectionId: string;
};

export type ListProjectionsInput = {
  workspaceId: string;
  status?: ExecutionProjectionStatus;
  risk?: ExecutionProjectionRisk;
  commitmentId?: string;
  fromDate?: string;
  toDate?: string;
};

// ─── View / Output Types ──────────────────────────────────────────────────────

export type ProjectionWithDetails = ExecutionProjectionRow & {
  tasks: ExecutionProjectionTaskRow[];
  dependencies: ExecutionProjectionDependencyRow[];
  participants: ExecutionProjectionParticipantRow[];
};

export type ProjectionEffortEstimate = {
  taskCount: number;
  estimatedHours: number;
  estimatedDays: number;
};

export type ProjectionDependency = {
  dependencyType: ExecutionProjectionDependencyType;
  dependencyReference: string;
  criticality: "low" | "medium" | "high" | "critical";
};

export type ProjectionParticipant = {
  participantType: string;
  participantReference: string;
  responsibility: string;
};

export type ProjectionRiskResult = {
  risk: ExecutionProjectionRisk;
  factors: string[];
};

export type ProjectionConfidenceResult = {
  score: number;
  factors: string[];
};

export type ProjectionReadinessResult = {
  score: number;
  authorityReady: boolean;
  dependenciesReady: boolean;
  commitmentAccepted: boolean;
  recommendationValidated: boolean;
  governanceHealth: boolean;
};

export type ProjectionLineage = {
  projectionId: string;
  chain: Array<{
    layer:
      | "artifact"
      | "memory"
      | "digest"
      | "learning_pattern"
      | "recommendation"
      | "signal"
      | "action"
      | "commitment"
      | "execution_projection";
    entityType: string;
    entityId: string | null;
    label: string;
  }>;
};

export type ProjectionExplanation = {
  projectionId: string;
  generatedFrom: string;
  because: string;
  estimatedEffort: string;
  confidence: number;
  risk: ExecutionProjectionRisk;
};

export type ProjectionComparison = {
  projectionA: string;
  projectionB: string;
  effortDifferenceHours: number;
  durationDifferenceDays: number;
  riskComparison: string;
  confidenceDifference: number;
};

export type ProjectionTaskTemplate = {
  taskName: string;
  taskDescription: string;
  estimatedHours: number;
  sequenceOrder: number;
  ownerType: string;
};
