import type {
  PMCapacitySnapshotRow,
  PMCapacityMetricRow,
  PMCapacityEvidenceRow,
  PMCapacityStatus,
  PMBurnRisk,
} from "@/lib/db/database-contract";

export type {
  PMCapacitySnapshotRow,
  PMCapacityMetricRow,
  PMCapacityEvidenceRow,
  PMCapacityStatus,
  PMBurnRisk,
};

// ─── Result Type ──────────────────────────────────────────────────────────────

export type PMCapacityResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type PMCapacityEventType =
  | "PM_CAPACITY_SNAPSHOT_GENERATED"
  | "PM_WORKSPACE_CAPACITY_SNAPSHOTS_GENERATED"
  | "PM_CAPACITY_NEAR_LIMIT"
  | "PM_CAPACITY_AT_LIMIT"
  | "PM_CAPACITY_OVERLOADED"
  | "PM_CAPACITY_CALCULATED"
  | "PM_LOAD_CALCULATED"
  | "PM_UTILIZATION_CALCULATED"
  | "PM_BURN_RISK_CALCULATED"
  | "PM_OVERLOAD_DETECTED"
  | "PM_CAPACITY_RECOMMENDATION_GENERATED"
  | "PM_CAPACITY_COMPARED"
  | "PM_CAPACITY_LINEAGE_GENERATED";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PM_CAPACITY_STATUS_THRESHOLDS = {
  underutilized: 60,   // < 60% → underutilized
  healthy:       90,   // 60–89% → healthy
  busy:          110,  // 90–109% → busy
  overloaded:    130,  // 110–129% → overloaded
                       // 130%+ → critical
} as const;

export const PM_BURN_RISK_THRESHOLDS = {
  none:     50,
  low:      70,
  medium:   90,
  high:     115,
  // critical: >= 115
} as const;

export const PM_CAPACITY_STATUSES: PMCapacityStatus[] = [
  "underutilized",
  "healthy",
  "busy",
  "overloaded",
  "critical",
];

export const PM_BURN_RISK_LEVELS: PMBurnRisk[] = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
];

// ─── Capacity Domain Names ────────────────────────────────────────────────────

export type PMCapacityDomain =
  | "project_count"
  | "critical_projects"
  | "warning_projects"
  | "attention_allocation"
  | "execution_drift"
  | "open_decisions"
  | "open_commitments"
  | "escalations"
  | "meetings_load"
  | "administrative_load";

// ─── Engine Input Types ───────────────────────────────────────────────────────

export type CalculatePMCapacityInput = {
  capacityLimit: number;
  activeProjectsLimit: number;
  role: string;
  experienceLevel: string;
};

export type CalculatePMLoadInput = {
  projectCount: number;
  criticalProjectCount: number;
  openDecisionCount: number;
  openCommitmentCount: number;
  executionDriftCount: number;
  attentionAllocationScore: number;
  escalationCount: number;
};

export type CalculatePMUtilizationInput = {
  load: number;
  capacity: number;
};

export type CalculatePMBurnRiskInput = {
  utilizationPercentage: number;
  criticalProjectCount: number;
  escalationCount: number;
  executionDriftCount: number;
  openDecisionCount: number;
};

export type DetectPMOverloadInput = {
  utilizationPercentage: number;
};

export type GenerateCapacityRecommendationsInput = {
  utilizationPercentage: number;
  capacityStatus: PMCapacityStatus;
  burnRisk: PMBurnRisk;
};

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GeneratePMCapacitySnapshotInput = {
  workspaceId: string;
  pmId: string;
  actorId?: string;
};

export type GenerateWorkspacePMCapacitySnapshotsInput = {
  workspaceId: string;
  actorId?: string;
};

export type GetPMCapacitySnapshotInput = {
  workspaceId: string;
  snapshotId: string;
};

export type ListPMCapacitySnapshotsInput = {
  workspaceId: string;
  pmId?: string;
  status?: PMCapacityStatus;
  risk?: PMBurnRisk;
  limit?: number;
};

export type ListLatestPMCapacitySnapshotsInput = {
  workspaceId: string;
};

export type ListOverloadedProjectManagersInput = {
  workspaceId: string;
};

// Assignment-based capacity status (stored in snapshot_payload; distinct from multi-domain capacity_status)
export type AssignmentCapacityStatus =
  | "underutilized"
  | "healthy"
  | "near_capacity"
  | "at_capacity"
  | "overloaded";

export type AssignmentOverloadRisk = "low" | "medium" | "high" | "critical";

export type AssignmentBreakdown = {
  primary: number;
  secondary: number;
  program: number;
  observer: number;
};

export type AssignmentCapacityRecommendation = {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
};

export type AssignmentCapacityEvidence = {
  profile: {
    pm_profile_id: string | null;
    active_projects_limit: number;
  };
  assignments: Array<{
    assignment_id: string;
    project_id: string;
    assignment_type: string;
    assigned_at: string;
  }>;
  counting_rule: {
    counted_assignment_types: string[];
    excluded_assignment_types: string[];
  };
};

// Enriched payload stored in snapshot_payload.assignment_capacity
export type AssignmentCapacityPayload = {
  active_assignment_count: number;
  counted_assignment_count: number;
  observer_assignment_count: number;
  active_projects_limit: number;
  assignment_capacity_utilization: number;
  assignment_capacity_status: AssignmentCapacityStatus;
  assignment_overload_risk: AssignmentOverloadRisk;
  assignment_breakdown: AssignmentBreakdown;
  recommendations: AssignmentCapacityRecommendation[];
  evidence: AssignmentCapacityEvidence;
};

export type GeneratePMCapacityProfileInput = {
  workspaceId: string;
  pmId: string;
};

export type ComparePMCapacityInput = {
  workspaceId: string;
  pmAId: string;
  pmBId: string;
};

export type GetPMCapacityLineageInput = {
  workspaceId: string;
  pmId: string;
};

// ─── Composite Output Types ───────────────────────────────────────────────────

export type PMCapacityProfile = {
  pm: {
    id: string;
    name: string;
    email: string;
  };
  capacity: number;
  load: number;
  utilization: number;
  burnRisk: PMBurnRisk;
  status: PMCapacityStatus;
  overload: boolean;
  recommendedAction: string;
  evidence: {
    projectCount: number;
    criticalProjectCount: number;
    openDecisionCount: number;
    openCommitmentCount: number;
    escalationCount: number;
    executionDriftCount: number;
  };
  generatedAt: string;
};

export type PMCapacityComparison = {
  pmA: {
    id: string;
    name: string;
    utilization: number;
    status: PMCapacityStatus;
    burnRisk: PMBurnRisk;
  };
  pmB: {
    id: string;
    name: string;
    utilization: number;
    status: PMCapacityStatus;
    burnRisk: PMBurnRisk;
  };
  difference: number;
  moreLoaded: "a" | "b" | "equal";
};

export type PMCapacityLineage = {
  pm: { id: string; name: string; email: string };
  assignments: Array<{
    id: string;
    projectId: string;
    assignmentType: string;
    assignedAt: string;
  }>;
  projects: Array<{ id: string }>;
  portfolio: {
    capacityLimit: number;
    activeProjectsLimit: number;
    role: string;
    experienceLevel: string;
  } | null;
  performanceSnapshot: {
    id: string;
    overallScore: number;
    status: string;
    generatedAt: string;
  } | null;
  capacitySnapshot: {
    id: string;
    capacityScore: number;
    loadScore: number;
    utilizationPercentage: number;
    burnRisk: PMBurnRisk;
    capacityStatus: PMCapacityStatus;
    generatedAt: string;
  } | null;
};
