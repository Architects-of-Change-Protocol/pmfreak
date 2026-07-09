// AOC PMFreak Read-Only Connector v1 — PMFreak read models
//
// These are connector snapshots of PMFreak data as read by the connector.
// They are not AOC governance models. Reading a record here never implies
// governance approval, evidence certification, approval validity, billing
// entitlement, or compliance status — see pmfreak-read-only-claim-safety.ts.

export type AocPMFreakProjectStatus =
  | "draft"
  | "active"
  | "at_risk"
  | "blocked"
  | "pending_acceptance"
  | "ready_for_billing_review"
  | "closed"
  | "unknown";

export type AocPMFreakProjectPhase =
  | "initiation"
  | "planning"
  | "execution"
  | "monitoring"
  | "closure"
  | "billing"
  | "unknown";

export type AocPMFreakProjectReadModel = {
  projectId: string;
  workspaceId: string;
  tenantId?: string;
  customerId?: string;

  projectName?: string;

  projectStatus?: AocPMFreakProjectStatus;

  phase?: AocPMFreakProjectPhase;

  milestoneIds: string[];
  taskIds: string[];
  riskIds: string[];
  evidenceReferenceIds: string[];
  approvalReferenceIds: string[];
  actionProposalIds: string[];

  sourceUpdatedAt?: string;
  sourceUrl?: string;

  metadata: Record<string, unknown>;
};

export type AocPMFreakAgentRole =
  | "planning_agent"
  | "risk_agent"
  | "evidence_agent"
  | "client_communication_agent"
  | "billing_readiness_agent"
  | "change_control_agent"
  | "unknown";

export type AocPMFreakAgentStatus = "active" | "inactive" | "suspended" | "unknown";

export type AocPMFreakAgentReadModel = {
  agentId: string;
  agentDisplayName?: string;

  role?: AocPMFreakAgentRole;

  status?: AocPMFreakAgentStatus;

  workspaceIds: string[];
  projectIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};

export type AocPMFreakMilestoneStatus =
  | "not_started"
  | "in_progress"
  | "delivered"
  | "pending_acceptance"
  | "accepted"
  | "billing_review"
  | "billing_ready"
  | "blocked"
  | "unknown";

export type AocPMFreakMilestoneReadModel = {
  milestoneId: string;
  projectId: string;
  title?: string;

  status?: AocPMFreakMilestoneStatus;

  evidenceReferenceIds: string[];
  approvalReferenceIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};

export type AocPMFreakTaskStatus = "todo" | "in_progress" | "blocked" | "done" | "unknown";

export type AocPMFreakTaskReadModel = {
  taskId: string;
  projectId: string;
  milestoneId?: string;
  title?: string;

  status?: AocPMFreakTaskStatus;

  assigneeAgentId?: string;

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};

export type AocPMFreakRiskSeverity = "low" | "medium" | "high" | "critical" | "unknown";

export type AocPMFreakRiskStatus = "open" | "mitigating" | "escalated" | "closed" | "unknown";

export type AocPMFreakRiskReadModel = {
  riskId: string;
  projectId: string;
  title?: string;

  severity?: AocPMFreakRiskSeverity;

  status?: AocPMFreakRiskStatus;

  evidenceReferenceIds: string[];
  approvalReferenceIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};

export type AocPMFreakEvidenceKind =
  | "project_status_source"
  | "schedule_baseline"
  | "dependency_record"
  | "risk_record"
  | "mitigation_record"
  | "deliverable_evidence"
  | "customer_acceptance_record"
  | "pm_approval_record"
  | "change_request_record"
  | "billing_milestone_record"
  | "client_communication_draft"
  | "meeting_minutes"
  | "scope_statement"
  | "contract_reference"
  | "unknown";

// Note: `present` only records whether the connector observed a reference
// to this evidence in the source system. It is not an evidence
// certification — see pmfreak-read-only-claim-safety.ts.
export type AocPMFreakEvidenceReferenceReadModel = {
  evidenceReferenceId: string;
  projectId: string;
  milestoneId?: string;
  riskId?: string;
  actionProposalId?: string;

  evidenceKind?: AocPMFreakEvidenceKind;

  present: boolean;

  sourceUpdatedAt?: string;

  redacted: boolean;

  metadata: Record<string, unknown>;
};

export type AocPMFreakApprovalKind =
  | "pm_approval"
  | "project_sponsor_approval"
  | "customer_validation"
  | "commercial_review"
  | "contract_review"
  | "billing_review"
  | "legal_review"
  | "security_review"
  | "executive_approval"
  | "unknown";

// Note: `present` only records whether the connector observed a reference
// to this approval in the source system. It is not an approval validity
// certification — see pmfreak-read-only-claim-safety.ts.
export type AocPMFreakApprovalReferenceReadModel = {
  approvalReferenceId: string;
  projectId: string;
  milestoneId?: string;
  riskId?: string;
  actionProposalId?: string;

  approvalKind?: AocPMFreakApprovalKind;

  present: boolean;

  sourceUpdatedAt?: string;

  redacted: boolean;

  metadata: Record<string, unknown>;
};

export type AocPMFreakActionProposalCategory =
  | "schedule"
  | "risk"
  | "evidence"
  | "communication"
  | "billing"
  | "change_control"
  | "unknown";

export type AocPMFreakActionProposalStatus =
  | "draft"
  | "proposed"
  | "pending_aoc_review"
  | "aoc_reviewed"
  | "cancelled"
  | "unknown";

// Note: reading an action proposal never approves or authorizes it. This
// connector does not execute actions — see pmfreak-read-only-claim-safety.ts.
export type AocPMFreakActionProposalReadModel = {
  actionProposalId: string;
  projectId: string;
  agentId: string;
  passportId?: string;

  proposedActionId?: string;

  category?: AocPMFreakActionProposalCategory;

  status?: AocPMFreakActionProposalStatus;

  contextFlags: string[];

  evidenceReferenceIds: string[];
  approvalReferenceIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};
