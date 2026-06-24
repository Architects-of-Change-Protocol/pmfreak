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

// ─── PMO Command Center Read Aggregation — Sprint PM Dossier Layer ─────────────
// This section supports the PM-dossier-based read aggregation feature.
// It does NOT recalculate capacity or performance.

export type PMOOperationalStatus =
  | "healthy"
  | "watch"
  | "capacity_pressure"
  | "performance_pressure"
  | "evidence_gap"
  | "critical";

export interface PMOExecutiveSummary {
  total_pms: number;
  active_pms: number;
  inactive_pms: number;
  suspended_pms: number;
  healthy_pms: number;
  watch_pms: number;
  capacity_risk_pms: number;
  performance_risk_pms: number;
  insufficient_evidence_pms: number;
  critical_pms: number;
  pmo_operational_status: PMOOperationalStatus;
  top_pmo_risk: string | null;
  top_recommendation: string | null;
  generated_at: string;
}

export interface PMOPMCounts {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  by_operational_status: Record<string, number>;
}

export interface PMOPMRef {
  pm_id: string;
  display_name: string;
  capacity_utilization?: number | null;
  capacity_status?: string | null;
  performance_score?: number | null;
  performance_status?: string | null;
  evidence_confidence_level?: string | null;
}

export interface PMOCapacityOverview {
  pms_with_capacity_snapshot: number;
  pms_missing_capacity_snapshot: number;
  average_capacity_utilization: number | null;
  underutilized_count: number;
  healthy_capacity_count: number;
  near_capacity_count: number;
  at_capacity_count: number;
  overloaded_count: number;
  total_counted_assignments: number;
  total_observer_assignments: number;
  highest_utilization_pm: PMOPMRef | null;
  overloaded_pms: PMOPMRef[];
  underutilized_pms: PMOPMRef[];
  capacity_recommendations: string[];
}

export interface PMOPerformanceOverview {
  pms_with_performance_snapshot: number;
  pms_missing_performance_snapshot: number;
  average_performance_score: number | null;
  excellent_count: number;
  strong_count: number;
  stable_count: number;
  warning_count: number;
  critical_count: number;
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;
  critical_risk_count: number;
  top_performers: PMOPMRef[];
  at_risk_pms: PMOPMRef[];
  critical_pms: PMOPMRef[];
  performance_recommendations: string[];
}

export interface PMOEvidenceConfidenceOverview {
  pms_with_evidence_confidence: number;
  pms_missing_evidence_confidence: number;
  average_evidence_completeness: number | null;
  high_confidence_count: number;
  medium_confidence_count: number;
  low_confidence_count: number;
  very_low_confidence_count: number;
  low_confidence_pms: PMOPMRef[];
  common_missing_sources: Array<{ source: string; missing_count: number }>;
  common_neutral_baseline_domains: Array<{ domain: string; count: number }>;
  evidence_recommendations: string[];
}

export interface PMOAttentionItem {
  pm_id: string;
  display_name: string;
  email: string;
  operational_status: string;
  capacity_status: string | null;
  performance_status: string | null;
  performance_risk: string | null;
  evidence_confidence_level: string | null;
  top_recommendation: string | null;
  dossier_url: string;
}

export interface PMOAttentionQueues {
  critical_attention: PMOAttentionItem[];
  capacity_attention: PMOAttentionItem[];
  performance_attention: PMOAttentionItem[];
  evidence_attention: PMOAttentionItem[];
  underutilized_capacity: PMOAttentionItem[];
  high_performers: PMOAttentionItem[];
}

export interface PMORecommendation {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  source: string;
  pm_id: string | null;
  pm_name: string | null;
  operational_status: string | null;
  created_from: string;
}

export interface PMODossierRow {
  pm_id: string;
  display_name: string;
  email: string;
  pm_status: string;
  role: string | null;
  operational_status: string;
  active_assignment_count: number;
  counted_assignment_count: number;
  capacity_status: string | null;
  capacity_utilization: number | null;
  performance_status: string | null;
  performance_risk: string | null;
  overall_performance_score: number | null;
  evidence_confidence_level: string | null;
  evidence_completeness: number | null;
  top_recommendation: string | null;
  dossier_url: string;
}

export interface PMOEventTimelineItem {
  event_type: string;
  occurred_at: string;
  actor_user_id: string | null;
  source: string | null;
  pm_id: string | null;
  pm_name: string | null;
  summary: string;
  payload_excerpt: Record<string, unknown>;
}

export interface PMOCommandCenterView {
  workspace_id: string;
  generated_at: string;
  executive_summary: PMOExecutiveSummary;
  pmo_operational_status: PMOOperationalStatus;
  pm_counts: PMOPMCounts;
  capacity_overview: PMOCapacityOverview;
  performance_overview: PMOPerformanceOverview;
  evidence_confidence_overview: PMOEvidenceConfidenceOverview;
  attention_queues: PMOAttentionQueues;
  recommendation_queue: PMORecommendation[];
  pm_dossiers: PMODossierRow[];
  event_timeline: PMOEventTimelineItem[];
  actions: Array<{ type: string; label: string; url: string }>;
}

export interface GetPMOCommandCenterViewInput {
  workspaceId: string;
  actorId?: string;
}
