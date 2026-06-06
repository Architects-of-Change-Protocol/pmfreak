export type PortfolioSummary = {
  projectCount: number;
  activeProjectCount: number;
  blockedProjectCount: number;
  delayedProjectCount: number;
  criticalProjectCount: number;

  portfolioHealthScore: number;
  portfolioRiskScore: number;

  criticalPathProjectCount: number;

  overdueTaskCount: number;
  blockedTaskCount: number;

  unresolvedRaidCount: number;

  lastUpdatedAt: string;
};

export type PortfolioProjectHealth = {
  projectId: string;
  projectName: string;

  healthScore: number;
  riskScore: number;

  blockedTaskCount: number;
  overdueTaskCount: number;

  criticalTaskCount: number;

  criticalPathLength: number;

  unresolvedRaidCount: number;

  scheduleVarianceDays: number;

  requiresExecutiveAttention: boolean;
};

export type DependencyRiskLevel = "low" | "medium" | "high" | "critical";

export type PortfolioDependencyRisk = {
  sourceProjectId: string;
  targetProjectId: string;

  dependencyCount: number;

  riskLevel: DependencyRiskLevel;
};

export type PortfolioEntityType = "task" | "milestone" | "project";

export type PortfolioBottleneck = {
  entityType: PortfolioEntityType;
  entityId: string;
  entityLabel: string;

  blockingCount: number;

  impactScore: number;
};

export type PortfolioIntelligence = {
  summary: PortfolioSummary;
  projects: PortfolioProjectHealth[];
  bottlenecks: PortfolioBottleneck[];
  dependencyRisks: PortfolioDependencyRisk[];
  executiveAttention: PortfolioProjectHealth[];
};
