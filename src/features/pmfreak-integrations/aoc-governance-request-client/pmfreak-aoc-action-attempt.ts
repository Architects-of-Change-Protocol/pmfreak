export type PMFreakAocActionCategory =
  | "schedule"
  | "risk"
  | "evidence"
  | "communication"
  | "billing"
  | "change_control"
  | "project_governance"
  | "unknown";

export type PMFreakAocActionAttemptStatus =
  | "draft"
  | "proposed"
  | "pending_aoc_governance"
  | "aoc_decision_received"
  | "cancelled";

export type PMFreakAocAgentActionAttemptRole =
  | "planning_agent"
  | "risk_agent"
  | "evidence_agent"
  | "client_communication_agent"
  | "billing_readiness_agent"
  | "change_control_agent"
  | "unknown";

// Represents a proposed PMFreak agent action only. It does not mean the
// action is allowed, that it was executed, that it is legally authorized,
// that an invoice is valid, or that customer acceptance is certified.
export type PMFreakAocAgentActionAttempt = {
  actionAttemptId: string;

  agentId: string;
  agentRole: PMFreakAocAgentActionAttemptRole;

  passportId?: string;

  projectId: string;
  workspaceId?: string;
  tenantId?: string;
  customerId?: string;

  actionId: string;
  actionCategory: PMFreakAocActionCategory;
  actionTitle: string;
  actionDescription?: string;

  targetMilestoneId?: string;
  targetTaskId?: string;
  targetRiskId?: string;
  targetChangeRequestId?: string;

  status: PMFreakAocActionAttemptStatus;

  contextFlags: string[];

  evidenceReferenceIds: string[];
  approvalReferenceIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};
