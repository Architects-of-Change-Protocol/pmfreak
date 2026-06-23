// ─── Status ───────────────────────────────────────────────────────────────────

export type PersonalPortfolioStatus = "active" | "archived";

export type PersonalPortfolioSnapshotStatus = "generated" | "validated" | "archived";

// ─── Attention ────────────────────────────────────────────────────────────────

export type PersonalPortfolioAttentionType =
  | "critical_signal"
  | "overdue_commitment"
  | "execution_drift"
  | "authority_gap"
  | "low_health_score"
  | "neglect_risk"
  | "capacity_conflict"
  | "escalation_pending";

export type PersonalPortfolioAttentionSeverity = "low" | "medium" | "high" | "critical";

// ─── Database rows ─────────────────────────────────────────────────────────────

export type PersonalPortfolioRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: PersonalPortfolioStatus;
  created_at: string;
  updated_at: string;
};

export type PersonalPortfolioProjectRow = {
  id: string;
  workspace_id: string;
  portfolio_id: string;
  project_id: string;
  added_at: string;
};

export type PersonalPortfolioSnapshotRow = {
  id: string;
  workspace_id: string;
  portfolio_id: string;
  snapshot_status: PersonalPortfolioSnapshotStatus;
  total_projects: number;
  healthy_projects: number;
  warning_projects: number;
  critical_projects: number;
  overall_health: number;
  ranked_project_ids: string[];
  attention_allocation: Record<string, number>;
  neglect_consequences: Record<string, NeglectConsequence>;
  command_center_payload: PersonalCommandCenterPayload;
  snapshot_payload: Record<string, unknown>;
  generated_at: string;
  created_at: string;
};

export type PersonalPortfolioAttentionItemRow = {
  id: string;
  workspace_id: string;
  snapshot_id: string;
  project_id: string;
  attention_type: PersonalPortfolioAttentionType;
  severity: PersonalPortfolioAttentionSeverity;
  title: string;
  description: string | null;
  recommended_action: string | null;
  created_at: string;
};

// ─── Sprint 1: Portfolio Foundation ──────────────────────────────────────────

export type PortfolioProjectMetric = {
  projectId: string;
  projectName: string;
  healthScore: number;
  riskScore: number;
  blockedTaskCount: number;
  overdueTaskCount: number;
  openDecisionsCount: number;
  openCommitmentsCount: number;
  criticalFocusCount: number;
  attentionItems: string[];
  status: "healthy" | "warning" | "critical";
};

export type PersonalPortfolioSnapshot = {
  id: string;
  portfolioId: string;
  workspaceId: string;
  snapshotStatus: PersonalPortfolioSnapshotStatus;
  totalProjects: number;
  healthyProjects: number;
  warningProjects: number;
  criticalProjects: number;
  overallHealth: number;
  rankedProjectIds: string[];
  attentionAllocation: Record<string, number>;
  neglectConsequences: Record<string, NeglectConsequence>;
  commandCenterPayload: PersonalCommandCenterPayload;
  attentionItems: PersonalPortfolioAttentionItemRow[];
  generatedAt: string;
};

// ─── Sprint 2: Prioritization ─────────────────────────────────────────────────

export type ProjectPriorityScore = {
  projectId: string;
  projectName: string;
  score: number;
  rank: number;
  breakdown: {
    healthContribution: number;
    riskContribution: number;
    driftContribution: number;
    decisionsContribution: number;
    commitmentsContribution: number;
    criticalFocusContribution: number;
  };
};

export type PortfolioRanking = {
  portfolioId: string;
  rankedProjects: ProjectPriorityScore[];
  generatedAt: string;
};

// ─── Sprint 3: Attention Allocation ──────────────────────────────────────────

export type ProjectAttentionAllocation = {
  projectId: string;
  projectName: string;
  attentionPercentage: number;
  priorityScore: number;
  justification: string;
};

export type AttentionAllocationPlan = {
  portfolioId: string;
  totalProjects: number;
  allocations: ProjectAttentionAllocation[];
  generatedAt: string;
};

// ─── Sprint 4: Neglect Consequence Engine ────────────────────────────────────

export type NeglectSeverity = "low" | "medium" | "high" | "critical";

export type NeglectConsequence = {
  projectId: string;
  projectName: string;
  blockedDeliverables: number;
  healthImpact: number;
  escalationProbability: number;
  severity: NeglectSeverity;
  riskDescription: string;
};

export type NeglectAnalysis = {
  portfolioId: string;
  consequences: NeglectConsequence[];
  mostCriticalProjectId: string | null;
  generatedAt: string;
};

// ─── Sprint 5: Personal Command Center ───────────────────────────────────────

export type CommandCenterFocusItem = {
  attentionType: PersonalPortfolioAttentionType;
  projectId: string;
  projectName: string;
  severity: PersonalPortfolioAttentionSeverity;
  title: string;
};

export type CommandCenterAgendaItem = {
  rank: number;
  projectId: string;
  projectName: string;
  attentionPercentage: number;
  topPriority: string;
};

export type PersonalCommandCenterPayload = {
  ownerId: string;
  totalProjects: number;
  immediateAttention: CommandCenterFocusItem[];
  highAttention: CommandCenterFocusItem[];
  recommendedOrder: CommandCenterAgendaItem[];
  todaySummary: string;
  generatedAt: string;
};

// ─── Result type ──────────────────────────────────────────────────────────────

export type PersonalPortfolioResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event types ──────────────────────────────────────────────────────────────

export type PersonalPortfolioEventType =
  | "PERSONAL_PORTFOLIO_CREATED"
  | "PERSONAL_PORTFOLIO_ARCHIVED"
  | "PERSONAL_PORTFOLIO_PROJECT_ADDED"
  | "PERSONAL_PORTFOLIO_PROJECT_REMOVED"
  | "PERSONAL_PORTFOLIO_SNAPSHOT_GENERATED"
  | "PERSONAL_PORTFOLIO_SNAPSHOT_VALIDATED"
  | "PERSONAL_PORTFOLIO_SNAPSHOT_ARCHIVED"
  | "PERSONAL_PORTFOLIO_PRIORITIZED"
  | "PERSONAL_PORTFOLIO_ATTENTION_ALLOCATED"
  | "PERSONAL_PORTFOLIO_NEGLECT_ANALYZED"
  | "PERSONAL_PORTFOLIO_COMMAND_CENTER_GENERATED";
