export type GovernanceRiskDomain =
  | "scope"
  | "timeline"
  | "cost"
  | "quality"
  | "resource"
  | "risk"
  | "stakeholder"
  | "governance";

export type GovernanceRiskSeverity = "low" | "medium" | "high" | "critical";

export type OperationalGovernanceRisk = {
  title: string;
  severity: GovernanceRiskSeverity;
  rationale: string;
  recommendedMitigation: string;
  relatedDomain: GovernanceRiskDomain;
};

export type DetectedRaidOverview = {
  topRisks: string[];
  topIssues: string[];
  keyDependencies: string[];
  keyAssumptions: string[];
  snapshot: { risks: number; issues: number; dependencies: number; assumptions: number };
  healthScore: number;
};

export type OperationalGovernanceBrief = {
  briefId: string;
  workspaceId: string;
  projectId: string;
  generatedAt: string;
  confidenceScore: number;
  topExecutionRisks: OperationalGovernanceRisk[];
  detectedRaidOverview: DetectedRaidOverview;
  governanceGaps: string[];
  recommendedNextAction: string;
  agentAssignments: Array<{
    agentId: GovernanceRiskDomain;
    label: string;
    priority: "primary" | "supporting";
    reason: string;
  }>;
  firstInterventionSuggestion: string;
  sourceSummary: {
    pmoGovernanceAvailable: boolean;
    projectOnboardingPayloadAvailable: boolean;
    workspaceRuntimeStateAvailable: boolean;
    signalsEvaluated: string[];
  };
};

export type GenerateOperationalGovernanceBriefInput = {
  workspaceId: string;
  projectId: string;
  pmoGovernance?: Record<string, unknown> | null;
  projectOnboardingPayload?: Record<string, unknown> | null;
  workspaceRuntimeState?: Record<string, unknown> | null;
  detectedRaidOverview?: DetectedRaidOverview | null;
  generatedAt?: string;
  briefId?: string;
};
