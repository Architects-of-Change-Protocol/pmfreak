export const SIGNAL_TYPES = [
  "scope_creep", "schedule_risk", "cost_risk", "quality_risk", "stakeholder_blocker",
  "missing_approval", "decision_needed", "delivery_impediment", "billing_risk", "governance_gap",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];
export type Severity = "low" | "medium" | "high" | "critical";
export type DecisionStatus = "accepted" | "rejected" | "modified" | "escalated" | "needs_more_evidence";

export type DetectedSignal = {
  signalType: SignalType;
  severity: Severity;
  confidenceScore: number;
  summary: string;
  rationale: string;
};

export type GovernanceEvaluation = {
  ruleKey: string;
  authorityRequired: string;
  evidenceRequired: boolean;
  governanceStatus: "compliant" | "warning" | "violation" | "decision_required";
  explanation: string;
};

export type OperationalAssuranceSummary = {
  scope: "project";
  workspaceId: string;
  projectId: string;
  asOf: string;
  totalGovernanceEvents: number;
  decisionRequiredCount: number;
  violationsCount: number;
  openRecommendations: number;
  unresolvedRisksIssues: number;
  evidenceLinkedDecisionsCount: number;
  evidenceWithoutSignalCount: number;
  incompleteChainCount: number;
};

export type OperationalSummary = {
  evidence: Array<Record<string, unknown>>;
  signals: Array<Record<string, unknown>>;
  risksIssues: Array<Record<string, unknown>>;
  governanceEvents: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  evidenceLinks: Array<Record<string, unknown>>;
  assurance: OperationalAssuranceSummary;
  actor: { role: string | null; canCreateEvidence: boolean };
};
