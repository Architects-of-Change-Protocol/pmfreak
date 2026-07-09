// PMFreak AOC Read-Only Integration Surface v1 — PMFreak read models
//
// These are surface snapshots of PMFreak's own data as exposed through
// this integration surface. They are not AOC governance models. Reading a
// record here never implies governance approval, evidence certification,
// approval validity, billing entitlement, or compliance status — see
// pmfreak-aoc-read-only-claim-safety.ts.

export type PMFreakProjectStatus =
  | "draft"
  | "active"
  | "at_risk"
  | "blocked"
  | "pending_acceptance"
  | "ready_for_billing_review"
  | "closed"
  | "unknown";

export type PMFreakProjectPhase =
  | "initiation"
  | "planning"
  | "execution"
  | "monitoring"
  | "closure"
  | "billing"
  | "unknown";

export type PMFreakProjectReadModel = {
  projectId: string;
  workspaceId: string;
  tenantId?: string;
  customerId?: string;

  projectName?: string;

  projectStatus?: PMFreakProjectStatus;

  phase?: PMFreakProjectPhase;

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

export type PMFreakAgentRole =
  | "planning_agent"
  | "risk_agent"
  | "evidence_agent"
  | "client_communication_agent"
  | "billing_readiness_agent"
  | "change_control_agent"
  | "unknown";

export type PMFreakAgentStatus = "active" | "inactive" | "suspended" | "unknown";

export type PMFreakAgentReadModel = {
  agentId: string;
  agentDisplayName?: string;

  role?: PMFreakAgentRole;

  status?: PMFreakAgentStatus;

  workspaceIds: string[];
  projectIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};

export type PMFreakMilestoneStatus =
  | "not_started"
  | "in_progress"
  | "delivered"
  | "pending_acceptance"
  | "accepted"
  | "billing_review"
  | "billing_ready"
  | "blocked"
  | "unknown";

export type PMFreakMilestoneReadModel = {
  milestoneId: string;
  projectId: string;
  title?: string;

  status?: PMFreakMilestoneStatus;

  evidenceReferenceIds: string[];
  approvalReferenceIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};

export type PMFreakTaskStatus = "todo" | "in_progress" | "blocked" | "done" | "unknown";

export type PMFreakTaskReadModel = {
  taskId: string;
  projectId: string;
  milestoneId?: string;
  title?: string;

  status?: PMFreakTaskStatus;

  assigneeAgentId?: string;

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};

export type PMFreakRiskSeverity = "low" | "medium" | "high" | "critical" | "unknown";

export type PMFreakRiskStatus = "open" | "mitigating" | "escalated" | "closed" | "unknown";

export type PMFreakRiskReadModel = {
  riskId: string;
  projectId: string;
  title?: string;

  severity?: PMFreakRiskSeverity;

  status?: PMFreakRiskStatus;

  evidenceReferenceIds: string[];
  approvalReferenceIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};

export type PMFreakEvidenceKind =
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

// Note: `present` only records whether this surface observed a reference
// to this evidence in PMFreak's own source data. It is not an evidence
// certification — see pmfreak-aoc-read-only-claim-safety.ts.
export type PMFreakEvidenceReferenceReadModel = {
  evidenceReferenceId: string;
  projectId: string;
  milestoneId?: string;
  riskId?: string;
  actionProposalId?: string;

  evidenceKind?: PMFreakEvidenceKind;

  present: boolean;

  sourceUpdatedAt?: string;

  redacted: boolean;

  metadata: Record<string, unknown>;
};

export type PMFreakApprovalKind =
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

// Note: `present` only records whether this surface observed a reference
// to this approval in PMFreak's own source data. It is not an approval
// validity certification — see pmfreak-aoc-read-only-claim-safety.ts.
export type PMFreakApprovalReferenceReadModel = {
  approvalReferenceId: string;
  projectId: string;
  milestoneId?: string;
  riskId?: string;
  actionProposalId?: string;

  approvalKind?: PMFreakApprovalKind;

  present: boolean;

  sourceUpdatedAt?: string;

  redacted: boolean;

  metadata: Record<string, unknown>;
};

export type PMFreakActionProposalCategory =
  | "schedule"
  | "risk"
  | "evidence"
  | "communication"
  | "billing"
  | "change_control"
  | "unknown";

export type PMFreakActionProposalStatus =
  | "draft"
  | "proposed"
  | "pending_aoc_review"
  | "aoc_reviewed"
  | "cancelled"
  | "unknown";

// Note: exposing an action proposal through this surface never approves or
// authorizes it. This surface does not execute actions — see
// pmfreak-aoc-read-only-claim-safety.ts.
export type PMFreakActionProposalReadModel = {
  actionProposalId: string;
  projectId: string;
  agentId: string;
  passportId?: string;

  proposedActionId?: string;

  category?: PMFreakActionProposalCategory;

  status?: PMFreakActionProposalStatus;

  contextFlags: string[];

  evidenceReferenceIds: string[];
  approvalReferenceIds: string[];

  sourceUpdatedAt?: string;

  metadata: Record<string, unknown>;
};
