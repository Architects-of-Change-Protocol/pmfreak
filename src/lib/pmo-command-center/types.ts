import type {
  PMOCommandCenterSnapshotRow,
  PMOAttentionItemRow,
  PMORecommendationRow,
  PMOStatus,
  PMOAttentionPriority,
  PMOAttentionEntityType,
  PMORecommendationType,
  PMOImpactScore,
} from "@/lib/db/database-contract";

export type {
  PMOCommandCenterSnapshotRow,
  PMOAttentionItemRow,
  PMORecommendationRow,
  PMOStatus,
  PMOAttentionPriority,
  PMOAttentionEntityType,
  PMORecommendationType,
  PMOImpactScore,
};

// ─── Result Type ──────────────────────────────────────────────────────────────

export type PMOCommandCenterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type PMOCommandCenterEventType =
  | "PMO_SNAPSHOT_GENERATED"
  | "PMO_HEALTH_CALCULATED"
  | "PMO_CAPACITY_CALCULATED"
  | "PMO_GOVERNANCE_MATURITY_CALCULATED"
  | "PMO_RISK_INDEX_CALCULATED"
  | "PMO_ATTENTION_QUEUE_GENERATED"
  | "PMO_RECOMMENDATIONS_GENERATED"
  | "PMO_HOTSPOT_IDENTIFIED"
  | "PMO_TREND_CALCULATED"
  | "PMO_LINEAGE_GENERATED";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PMO_HEALTH_WEIGHTS = {
  performance:  0.30,
  capacity:     0.25,
  compliance:   0.25,
  projectHealth: 0.20,
} as const;

export const PMO_RISK_WEIGHTS = {
  criticalProjects: 0.35,
  executionDrift:   0.25,
  governanceGaps:   0.20,
  overloadedPMs:    0.15,
  escalations:      0.05,
} as const;

export const PMO_STATUS_THRESHOLDS = {
  excellent: 90,
  healthy:   75,
  stable:    60,
  warning:   45,
} as const;

export const PMO_STATUSES: PMOStatus[] = [
  "excellent",
  "healthy",
  "stable",
  "warning",
  "critical",
];

export const PMO_ATTENTION_PRIORITIES: PMOAttentionPriority[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export const PMO_RECOMMENDATION_TYPES: PMORecommendationType[] = [
  "capacity",
  "governance",
  "execution",
  "portfolio",
  "staffing",
  "risk",
];

// ─── Engine Input Types ───────────────────────────────────────────────────────

export type PMOHealthInput = {
  avgPerformanceScore: number;
  avgCapacityScore: number;
  avgComplianceScore: number;
  projectHealthScore: number;
};

export type OrganizationalCapacityInput = {
  pmCount: number;
  overloadedPMCount: number;
  warningPMCount: number;
  healthyPMCount: number;
  avgUtilizationPercentage: number;
  totalCapacity: number;
  totalLoad: number;
};

export type GovernanceMaturityInput = {
  avgComplianceScore: number;
  totalGovernanceDebt: number;
  hotspotCount: number;
  criticalGapCount: number;
  highGapCount: number;
};

export type PMORiskInput = {
  criticalProjectCount: number;
  totalProjectCount: number;
  executionDriftCount: number;
  totalCommitmentCount: number;
  governanceGapCount: number;
  overloadedPMCount: number;
  pmCount: number;
  escalationCount: number;
};

// ─── PM Summary for Snapshot ──────────────────────────────────────────────────

export type PMSummary = {
  id: string;
  name: string;
  email: string;
  performanceScore: number;
  capacityScore: number;
  utilizationPercentage: number;
  complianceScore: number;
  status: "overloaded" | "warning" | "healthy";
  projectCount: number;
};

// ─── Project Summary for Snapshot ────────────────────────────────────────────

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  healthScore: number;
  pmId: string | null;
  portfolioId: string | null;
};

// ─── Hotspot Types ────────────────────────────────────────────────────────────

export type PMOHotspotType = "capacity" | "governance" | "execution" | "portfolio";

export type PMOHotspot = {
  type: PMOHotspotType;
  entityId: string;
  entityName: string;
  severity: PMOAttentionPriority;
  description: string;
  metric: string;
  value: number;
};

// ─── Trend Types ──────────────────────────────────────────────────────────────

export type PMOTrendDirection = "improving" | "stable" | "deteriorating";

export type PMOTrend = {
  health: { current: number; previous: number; delta: number; direction: PMOTrendDirection };
  capacity: { current: number; previous: number; delta: number; direction: PMOTrendDirection };
  governance: { current: number; previous: number; delta: number; direction: PMOTrendDirection };
  risk: { current: number; previous: number; delta: number; direction: PMOTrendDirection };
  snapshotsCompared: number;
};

// ─── Attention Item ───────────────────────────────────────────────────────────

export type AttentionItem = {
  priority: PMOAttentionPriority;
  entityType: PMOAttentionEntityType;
  entityId: string;
  title: string;
  description: string;
  recommendedAction: string;
};

// ─── Executive Recommendation ─────────────────────────────────────────────────

export type ExecutiveRecommendation = {
  type: PMORecommendationType;
  recommendation: string;
  confidence: number;
  impact: PMOImpactScore;
};

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GeneratePMOSnapshotInput = {
  workspaceId: string;
  actorId?: string;
};

export type GetPMOSnapshotInput = {
  workspaceId: string;
  snapshotId: string;
};

export type ListPMOSnapshotsInput = {
  workspaceId: string;
  minHealth?: number;
  maxHealth?: number;
  minRisk?: number;
  maxRisk?: number;
  minCapacity?: number;
  from?: string;
  to?: string;
  limit?: number;
};

export type GetPMOLineageInput = {
  workspaceId: string;
  snapshotId: string;
};

// ─── Composite Output Types ───────────────────────────────────────────────────

export type PMODashboardModel = {
  pmo: {
    health: number;
    governance: number;
    capacity: number;
    execution: number;
    risk: number;
    status: PMOStatus;
  };
  projects: {
    total: number;
    critical: number;
    warning: number;
    healthy: number;
  };
  pms: {
    total: number;
    overloaded: number;
    warning: number;
    healthy: number;
  };
  portfolios: {
    total: number;
  };
  attention: AttentionItem[];
  recommendations: ExecutiveRecommendation[];
  hotspots: PMOHotspot[];
  generatedAt: string;
};

export type PMOSnapshotResult = {
  snapshot: PMOCommandCenterSnapshotRow;
  attentionItems: PMOAttentionItemRow[];
  recommendations: PMORecommendationRow[];
};

export type PMOLineage = {
  snapshot: PMOCommandCenterSnapshotRow;
  pms: Array<{
    pm: PMSummary;
    performanceSnapshotId: string | null;
    capacitySnapshotId: string | null;
    complianceSnapshotId: string | null;
  }>;
  projects: ProjectSummary[];
  portfolioCount: number;
  generatedAt: string;
};
