import type {
  ExecutionRealityRow,
  ExecutionVarianceRow,
  ExecutionObservationRow,
  ExecutionDriftRow,
} from "@/lib/db/database-contract";

export type {
  ExecutionRealityRow,
  ExecutionVarianceRow,
  ExecutionObservationRow,
  ExecutionDriftRow,
};

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type ExecutionRealityStatus =
  | "observed"
  | "validated"
  | "completed"
  | "archived";

export type ExecutionRealityRisk = "low" | "medium" | "high" | "critical";

export type ExecutionVarianceType =
  | "effort"
  | "duration"
  | "risk"
  | "tasks"
  | "participants";

export type ExecutionVarianceSeverity = "low" | "medium" | "high" | "critical";

export type ExecutionDriftType = "schedule" | "effort" | "resource" | "risk";

export type ExecutionDriftSeverity = "none" | "emerging" | "persistent" | "critical";

// ─── Constants ────────────────────────────────────────────────────────────────

export const EXECUTION_REALITY_STATUSES: ExecutionRealityStatus[] = [
  "observed",
  "validated",
  "completed",
  "archived",
];

export const EXECUTION_REALITY_RISK_LEVELS: ExecutionRealityRisk[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const EXECUTION_VARIANCE_TYPES: ExecutionVarianceType[] = [
  "effort",
  "duration",
  "risk",
  "tasks",
  "participants",
];

export const EXECUTION_VARIANCE_SEVERITIES: ExecutionVarianceSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const EXECUTION_DRIFT_TYPES: ExecutionDriftType[] = [
  "schedule",
  "effort",
  "resource",
  "risk",
];

export const EXECUTION_DRIFT_SEVERITIES: ExecutionDriftSeverity[] = [
  "none",
  "emerging",
  "persistent",
  "critical",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type ExecutionRealityResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type ExecutionRealityEventType =
  | "EXECUTION_REALITY_CREATED"
  | "EXECUTION_OBSERVATION_RECORDED"
  | "EXECUTION_REALITY_VALIDATED"
  | "EXECUTION_REALITY_COMPLETED"
  | "EXECUTION_REALITY_ARCHIVED"
  | "EXECUTION_VARIANCE_CALCULATED"
  | "EXECUTION_DRIFT_DETECTED"
  | "EXECUTION_ACCURACY_CALCULATED"
  | "EXECUTION_HEALTH_CALCULATED"
  | "EXECUTION_REALITY_LINEAGE_GENERATED";

// ─── Service Input Types ──────────────────────────────────────────────────────

export type CreateRealityInput = {
  workspaceId: string;
  projectionId: string;
  realityTitle: string;
  realityDescription?: string;
  actualEffortHours: number;
  actualDurationDays: number;
  actualRisk: ExecutionRealityRisk;
  actualTaskCount: number;
  actualParticipantCount: number;
  actorId: string;
};

export type RecordObservationInput = {
  workspaceId: string;
  realityId: string;
  observationType: string;
  observationValue: string;
  observationSource: string;
  observedBy?: string;
  actorId: string;
};

export type ValidateRealityInput = {
  workspaceId: string;
  realityId: string;
  actorId: string;
};

export type CompleteRealityInput = {
  workspaceId: string;
  realityId: string;
  actorId: string;
};

export type ArchiveRealityInput = {
  workspaceId: string;
  realityId: string;
  actorId: string;
};

export type GetRealityInput = {
  workspaceId: string;
  realityId: string;
};

export type ListRealitiesInput = {
  workspaceId: string;
  status?: ExecutionRealityStatus;
  risk?: ExecutionRealityRisk;
  projectionId?: string;
  fromDate?: string;
  toDate?: string;
};

// ─── View / Output Types ──────────────────────────────────────────────────────

export type RealityWithDetails = ExecutionRealityRow & {
  observations: ExecutionObservationRow[];
  variances: ExecutionVarianceRow[];
  drifts: ExecutionDriftRow[];
};

export type VarianceResult = {
  varianceType: ExecutionVarianceType;
  projectedValue: number;
  actualValue: number;
  variancePercentage: number;
  severity: ExecutionVarianceSeverity;
};

export type DriftResult = {
  driftType: ExecutionDriftType;
  severity: ExecutionDriftSeverity;
  description: string;
};

export type ProjectionAccuracyResult = {
  score: number;
  effortAccuracy: number;
  durationAccuracy: number;
  riskMatched: boolean;
  factors: string[];
};

export type RealityConfidenceResult = {
  score: number;
  observationCount: number;
  validationStatus: boolean;
  factors: string[];
};

export type ExecutionHealthResult = {
  score: number;
  varianceSeverity: string;
  driftCount: number;
  projectionAccuracy: number;
  riskLevel: ExecutionRealityRisk;
  factors: string[];
};

export type ProjectionFeedback = {
  projectionId: string;
  accuracy: number;
  mainVariance: ExecutionVarianceType | null;
  recommendation: string;
};

export type RecommendationRealityFeedback = {
  projectionId: string;
  realityId: string;
  expectedEffect: string;
  actualEffect: string;
  effectiveness: "low" | "medium" | "high";
};

export type RealityLineage = {
  realityId: string;
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
      | "execution_projection"
      | "execution_reality";
    entityType: string;
    entityId: string | null;
    label: string;
  }>;
};

export type RealityExplanation = {
  realityId: string;
  projectionId: string;
  observation: string;
  variance: string;
  drift: string;
  accuracy: number;
  executionHealth: number;
  realityConfidence: number;
};
