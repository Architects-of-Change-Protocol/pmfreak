import type {
  PMPerformanceSnapshotRow,
  PMPerformanceMetricRow,
  PMPerformanceEvidenceRow,
  PMPerformanceStatus,
  PMPerformanceDomain,
  PMPerformanceMetricStatus,
} from "@/lib/db/database-contract";

export type {
  PMPerformanceSnapshotRow,
  PMPerformanceMetricRow,
  PMPerformanceEvidenceRow,
  PMPerformanceStatus,
  PMPerformanceDomain,
  PMPerformanceMetricStatus,
};

// ─── Result Type ──────────────────────────────────────────────────────────────

export type PMPerformanceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type PMPerformanceEventType =
  | "PM_PERFORMANCE_SNAPSHOT_GENERATED"
  | "PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED"
  | "PM_SCORECARD_GENERATED"
  | "PM_GOVERNANCE_SCORE_CALCULATED"
  | "PM_EXECUTION_SCORE_CALCULATED"
  | "PM_PREDICTION_ACCURACY_CALCULATED"
  | "PM_DECISION_EFFECTIVENESS_CALCULATED"
  | "PM_PORTFOLIO_HEALTH_CALCULATED"
  | "PM_OVERALL_PERFORMANCE_CALCULATED"
  | "PM_PERFORMANCE_COMPARED"
  | "PM_PERFORMANCE_LINEAGE_GENERATED";

// ─── Performance Risk ─────────────────────────────────────────────────────────

export type PMPerformanceRisk = "low" | "medium" | "high" | "critical";

// ─── Evidence Confidence (re-exported from evidence-confidence.ts) ────────────

export type { ConfidenceLevel, ScoreInterpretation, EvidenceConfidence, EvidenceSourceAvailability } from "./evidence-confidence";
export { calculateEvidenceConfidence, deriveConfidenceRecommendations, EVIDENCE_TOTAL_SOURCE_COUNT } from "./evidence-confidence";

// ─── Constants ────────────────────────────────────────────────────────────────

export const PM_PERFORMANCE_RISK_THRESHOLDS = {
  low:    75,
  medium: 60,
  high:   45,
} as const;

export const PM_PERFORMANCE_WEIGHTS = {
  governance: 0.20,
  execution:  0.25,
  prediction: 0.15,
  decision:   0.20,
  portfolio:  0.20,
} as const;

export const PM_PERFORMANCE_STATUS_THRESHOLDS = {
  excellent: 90,
  strong:    80,
  stable:    65,
  warning:   45,
} as const;

export const PM_PERFORMANCE_STATUSES: PMPerformanceStatus[] = [
  "excellent",
  "strong",
  "stable",
  "warning",
  "critical",
];

export const PM_PERFORMANCE_DOMAINS: PMPerformanceDomain[] = [
  "governance",
  "execution",
  "prediction",
  "decision",
  "portfolio",
  "overall",
];

// ─── Engine Input Types ───────────────────────────────────────────────────────

export type GovernanceScoreInput = {
  governanceHealthScores: number[];
  openViolationCount: number;
  pendingEscalationCount: number;
};

export type ExecutionScoreInput = {
  executionHealthScores: number[];
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
};

export type PredictionAccuracyInput = {
  confidenceScores: number[];
  varianceValues: number[];
};

export type DecisionEffectivenessInput = {
  effectivenessScores: number[];
  successfulOutcomes: number;
  unsuccessfulOutcomes: number;
  totalOutcomes: number;
};

export type PortfolioHealthInput = {
  operatingHealthScores: number[];
  criticalProjectCount: number;
};

export type OverallPerformanceInput = {
  governance: number;
  execution: number;
  prediction: number;
  decision: number;
  portfolio: number;
};

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GeneratePMPerformanceSnapshotInput = {
  workspaceId: string;
  pmId: string;
  actorId?: string;
};

export type GetPMPerformanceSnapshotInput = {
  workspaceId: string;
  snapshotId: string;
};

export type GetLatestPMPerformanceSnapshotInput = {
  workspaceId: string;
  pmId: string;
};

export type ListPMPerformanceSnapshotsInput = {
  workspaceId: string;
  pmId?: string;
  status?: PMPerformanceStatus;
  limit?: number;
};

export type ListLatestPMPerformanceSnapshotsInput = {
  workspaceId: string;
};

export type ListAtRiskPMPerformanceSnapshotsInput = {
  workspaceId: string;
};

export type GenerateWorkspacePMPerformanceSnapshotsInput = {
  workspaceId: string;
  actorId?: string;
};

export type GeneratePMScorecardInput = {
  workspaceId: string;
  pmId: string;
};

export type ComparePMPerformanceInput = {
  workspaceId: string;
  pmAId: string;
  pmBId: string;
};

export type GetPMPerformanceLineageInput = {
  workspaceId: string;
  pmId: string;
};

// ─── Composite Output Types ───────────────────────────────────────────────────

export type PMScorecard = {
  pm: {
    id: string;
    name: string;
    email: string;
  };
  scores: {
    governance: number;
    execution: number;
    prediction: number;
    decision: number;
    portfolio: number;
    overall: number;
  };
  status: PMPerformanceStatus;
  evidence: {
    projects: number;
    snapshots: number;
    outcomes: number;
  };
  explanation: {
    summary: string;
    strengths: string[];
    attentionAreas: string[];
    supportedBy: string[];
  };
  generatedAt: string;
};

export type PMPerformanceComparison = {
  pmA: {
    id: string;
    name: string;
    overallScore: number;
    status: PMPerformanceStatus;
  };
  pmB: {
    id: string;
    name: string;
    overallScore: number;
    status: PMPerformanceStatus;
  };
  difference: number;
  stronger: "a" | "b" | "equal";
};

export type PMPerformanceLineage = {
  pm: { id: string; name: string; email: string };
  assignments: Array<{
    id: string;
    projectId: string;
    assignmentType: string;
    assignedAt: string;
  }>;
  projects: Array<{ id: string }>;
  projectOsSnapshots: Array<{
    id: string;
    projectId: string;
    operatingHealthScore: number;
    governanceHealthScore: number;
    executionHealthScore: number;
  }>;
  executionRealities: Array<{
    id: string;
    confidenceScore: number;
    status: string;
  }>;
  decisionOutcomes: Array<{
    id: string;
    outcomeStatus: string;
    effectivenessScore: number;
  }>;
  performanceSnapshot: {
    id: string;
    overallScore: number;
    status: PMPerformanceStatus;
    generatedAt: string;
  } | null;
};
