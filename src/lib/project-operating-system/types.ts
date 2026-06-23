import type {
  ProjectOSSnapshotRow,
  ProjectOSAttentionItemRow,
  ProjectOSContextLinkRow,
  ProjectOSAttentionType,
  ProjectOSAttentionSeverity,
  ProjectOSSnapshotStatus,
} from "@/lib/db/database-contract";

export type {
  ProjectOSSnapshotRow,
  ProjectOSAttentionItemRow,
  ProjectOSContextLinkRow,
  ProjectOSAttentionType,
  ProjectOSAttentionSeverity,
  ProjectOSSnapshotStatus,
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const PROJECT_OS_SNAPSHOT_STATUSES: ProjectOSSnapshotStatus[] = [
  "generated",
  "validated",
  "archived",
];

export const PROJECT_OS_ATTENTION_TYPES: ProjectOSAttentionType[] = [
  "critical_signal",
  "overdue_commitment",
  "execution_drift",
  "governance_violation",
  "ratification_stall",
  "authority_gap",
  "low_health_score",
  "ignored_recommendation",
  "projection_variance",
];

export const PROJECT_OS_ATTENTION_SEVERITIES: ProjectOSAttentionSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type ProjectOSResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type ProjectOSEventType =
  | "PROJECT_OS_SNAPSHOT_GENERATED"
  | "PROJECT_OS_SNAPSHOT_VALIDATED"
  | "PROJECT_OS_SNAPSHOT_ARCHIVED"
  | "PROJECT_OS_HEALTH_CALCULATED"
  | "PROJECT_OS_ATTENTION_ITEM_CREATED"
  | "PROJECT_OS_CONTEXT_COMPOSED"
  | "PROJECT_OS_LINEAGE_GENERATED";

// ─── Snapshot Payload ─────────────────────────────────────────────────────────

export type ProjectOSConstitutionSummary = {
  status: string;
  version: number;
  ratified: boolean;
};

export type ProjectOSGovernanceSummary = {
  active_signals: number;
  critical_signals: number;
  unresolved_violations: number;
  governance_health: number;
};

export type ProjectOSExecutionSummary = {
  active_commitments: number;
  overdue_commitments: number;
  execution_health: number;
  projection_accuracy: number;
};

export type ProjectOSMemorySummary = {
  artifacts: number;
  memory_records: number;
  digests: number;
  learning_patterns: number;
};

export type ProjectOSRecommendationSummary = {
  active_recommendations: number;
  high_confidence_recommendations: number;
  ignored_recommendations: number;
};

export type ProjectOSSnapshotPayload = {
  project: {
    project_id: string;
    workspace_id: string;
  };
  constitution: ProjectOSConstitutionSummary;
  governance: ProjectOSGovernanceSummary;
  execution: ProjectOSExecutionSummary;
  memory: ProjectOSMemorySummary;
  recommendations: ProjectOSRecommendationSummary;
  attention: string[];
};

// ─── Health Score ─────────────────────────────────────────────────────────────

export type ProjectOSHealthScore = {
  projectId: string;
  workspaceId: string;
  operatingHealthScore: number;
  governanceHealthScore: number;
  executionHealthScore: number;
  memoryHealthScore: number;
  recommendationHealthScore: number;
  calculatedAt: string;
  breakdown: {
    governanceWeight: number;
    executionWeight: number;
    memoryWeight: number;
    recommendationWeight: number;
  };
};

// ─── Attention Item (runtime) ─────────────────────────────────────────────────

export type DetectedAttentionItem = {
  attentionType: ProjectOSAttentionType;
  attentionSeverity: ProjectOSAttentionSeverity;
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description: string;
  recommendedAction?: string;
};

// ─── Operating Context ────────────────────────────────────────────────────────

export type ProjectOSOperatingContext = {
  projectId: string;
  workspaceId: string;
  constitution: ProjectOSConstitutionSummary | null;
  signals: Array<{
    id: string;
    signalType: string;
    severity: string;
    status: string;
    title: string;
  }>;
  actions: Array<{
    id: string;
    actionType: string;
    status: string;
    title: string;
  }>;
  commitments: Array<{
    id: string;
    status: string;
    title: string;
    dueDate: string | null;
    isOverdue: boolean;
  }>;
  projections: Array<{
    id: string;
    status: string;
    projectionAccuracy: number | null;
  }>;
  realities: Array<{
    id: string;
    status: string;
    observedAt: string;
  }>;
  recommendations: Array<{
    id: string;
    recommendationType: string;
    confidenceScore: number;
    status: string;
  }>;
  learningPatterns: Array<{
    id: string;
    patternType: string;
    confidence: number;
  }>;
  attentionItems: DetectedAttentionItem[];
  composedAt: string;
};

// ─── Lineage ──────────────────────────────────────────────────────────────────

export type ProjectOSLineageLayer = {
  layer:
    | "constitution"
    | "memory"
    | "digest"
    | "learning"
    | "recommendation"
    | "signal"
    | "action"
    | "commitment"
    | "projection"
    | "reality"
    | "snapshot";
  entityType: string;
  entityId: string | null;
  label: string;
  count: number;
};

export type ProjectOSLineage = {
  projectId: string;
  workspaceId: string;
  chain: ProjectOSLineageLayer[];
  generatedAt: string;
};

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GenerateProjectOSSnapshotInput = {
  workspaceId: string;
  projectId: string;
  actorId: string;
};

export type GetProjectOSSnapshotInput = {
  workspaceId: string;
  snapshotId: string;
};

export type ListProjectOSSnapshotsInput = {
  workspaceId: string;
  projectId?: string;
  status?: ProjectOSSnapshotStatus;
  fromDate?: string;
  toDate?: string;
  minHealthScore?: number;
  maxHealthScore?: number;
  limit?: number;
};

export type ValidateProjectOSSnapshotInput = {
  workspaceId: string;
  snapshotId: string;
  actorId: string;
};

export type ArchiveProjectOSSnapshotInput = {
  workspaceId: string;
  snapshotId: string;
  actorId: string;
};

export type GetProjectOperatingContextInput = {
  workspaceId: string;
  projectId: string;
  actorId: string;
};

export type GetProjectOSLineageInput = {
  workspaceId: string;
  projectId: string;
  actorId: string;
};
