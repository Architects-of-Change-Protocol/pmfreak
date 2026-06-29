// ─── PMO Governance Proposal Review & Controlled Policy Change Backlog — Types ─
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT store raw payloads, free text rationale, or identifiers.
// Does NOT mutate policies, routing, or scoring values.
// Does NOT apply policy changes — only creates backlog/draft/simulation records.
// All operations are deterministic.

export type AgentPmoPolicyBacklogItemStatus =
  | "created" | "open" | "analysis" | "simulation_ready" | "simulation_completed"
  | "approval_ready" | "approved_for_future_implementation" | "rejected" | "archived";

export type AgentPmoPolicyBacklogItemType =
  | "risk_policy" | "evidence_requirement" | "adapter_quality_review" | "review_routing"
  | "human_review_policy" | "triage_policy" | "approval_policy" | "governance_process";

export type AgentPmoPolicyBacklogPriority = "low" | "normal" | "high" | "urgent";

export type AgentPmoPolicyChangeRequestStatus =
  | "draft" | "open" | "simulation_pending" | "simulation_completed" | "approval_pending"
  | "approved" | "rejected" | "deferred" | "archived";

export type AgentPmoPolicyChangeScopeType =
  | "risk_scoring" | "evidence_requirements" | "human_review_policy" | "review_routing"
  | "triage_policy" | "adapter_governance" | "dispatch_gate_policy" | "approval_policy"
  | "governance_reporting";

export type AgentPmoPolicySimulationStatus =
  | "created" | "running" | "completed" | "failed" | "cancelled";

export type AgentPmoPolicyImpactLevel = "none" | "low" | "medium" | "high" | "critical";

export type AgentPmoGovernancePolicyDraftType =
  | "risk_policy_draft" | "evidence_requirement_draft" | "review_routing_draft"
  | "human_review_policy_draft" | "triage_policy_draft" | "adapter_governance_draft"
  | "approval_policy_draft";

export type AgentPmoGovernancePolicyDraftStatus =
  | "created" | "open" | "under_review" | "approved_for_future_implementation" | "rejected" | "archived";

export type AgentPmoPolicyApprovalStage =
  | "pmo_review" | "security_review" | "operations_review" | "executive_review"
  | "data_governance_review" | "final_pmo_approval";

export type AgentPmoPolicyApprovalStatus =
  | "not_started" | "pending" | "approved" | "rejected" | "changes_requested" | "skipped" | "cancelled";

export type AgentPmoPolicyApprovalDecisionType =
  | "approve" | "reject" | "request_changes" | "skip" | "cancel";

export type AgentPmoPolicyImplementationReadinessStatus =
  | "not_ready" | "simulation_required" | "approval_required" | "rollback_required"
  | "ready_for_future_implementation" | "blocked";

export type AgentPmoPolicyRollbackPlanType =
  | "manual_rollback" | "version_revert" | "policy_disable" | "routing_restore"
  | "scoring_restore" | "evidence_requirement_restore";

export type AgentPmoPolicyRollbackPlanStatus =
  | "created" | "open" | "reviewed" | "approved" | "rejected" | "archived";

export type AgentPmoPolicyBacklogEventType =
  | "policy_backlog_item_created" | "policy_change_request_created" | "policy_change_scope_created"
  | "policy_simulation_created" | "policy_simulation_completed" | "policy_impact_preview_created"
  | "policy_draft_created" | "policy_approval_workflow_created" | "policy_approval_decision_recorded"
  | "policy_rollback_plan_created" | "policy_implementation_readiness_evaluated"
  | "policy_change_request_archived";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentPmoPolicyBacklogItemRecord = {
  id: string;
  workspaceId: string;
  sourceProposalId: string | null;
  itemType: AgentPmoPolicyBacklogItemType;
  itemCategory: string;
  priority: AgentPmoPolicyBacklogPriority;
  status: AgentPmoPolicyBacklogItemStatus;
  title: string;
  description: string;
  sourceSignalCount: number;
  sourceFeedbackIds: string[];
  sourceSignalIds: string[];
  relatedAdapterKeys: string[];
  estimatedImpactLevel: AgentPmoPolicyImpactLevel;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyChangeRequestRecord = {
  id: string;
  workspaceId: string;
  backlogItemId: string;
  status: AgentPmoPolicyChangeRequestStatus;
  policyArea: string;
  changeSummary: string;
  changeRationale: string;
  estimatedImpactLevel: AgentPmoPolicyImpactLevel;
  simulationCount: number;
  approvalWorkflowId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyChangeScopeRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  scopeType: AgentPmoPolicyChangeScopeType;
  scopeDescription: string;
  affectedPolicyKeys: string[];
  affectedAdapterKeys: string[];
  estimatedRecordsAffected: number;
  createdAt: string;
};

export type AgentPmoPolicySimulationRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  status: AgentPmoPolicySimulationStatus;
  simulationLabel: string;
  signalCountUsed: number;
  estimatedAffectedCount: number;
  estimatedApprovalRateChange: number;
  estimatedRejectionRateChange: number;
  estimatedReviewVolumeChange: number;
  impactLevel: AgentPmoPolicyImpactLevel;
  safeSimulationSummary: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyImpactPreviewRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  simulationId: string | null;
  impactLevel: AgentPmoPolicyImpactLevel;
  affectedAreaCount: number;
  estimatedSignalCount: number;
  deterministicSummary: string;
  safeImpactJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoGovernancePolicyDraftRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  draftType: AgentPmoGovernancePolicyDraftType;
  draftStatus: AgentPmoGovernancePolicyDraftStatus;
  draftVersion: number;
  draftTitle: string;
  draftSummary: string;
  isLivePolicy: false;
  approvalWorkflowId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyApprovalWorkflowRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  currentStage: AgentPmoPolicyApprovalStage;
  overallStatus: AgentPmoPolicyApprovalStatus;
  requiredStages: AgentPmoPolicyApprovalStage[];
  completedStages: AgentPmoPolicyApprovalStage[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyApprovalDecisionRecord = {
  id: string;
  workspaceId: string;
  workflowId: string;
  stage: AgentPmoPolicyApprovalStage;
  decisionType: AgentPmoPolicyApprovalDecisionType;
  status: AgentPmoPolicyApprovalStatus;
  decidedBy: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export type AgentPmoPolicyImplementationReadinessRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  readinessStatus: AgentPmoPolicyImplementationReadinessStatus;
  simulationCompleted: boolean;
  approvalCompleted: boolean;
  rollbackPlanPresent: boolean;
  blockedReasons: string[];
  evaluatedAt: string;
  createdAt: string;
};

export type AgentPmoPolicyRollbackPlanRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  planType: AgentPmoPolicyRollbackPlanType;
  planStatus: AgentPmoPolicyRollbackPlanStatus;
  planDescription: string;
  affectedPolicyKeys: string[];
  estimatedRollbackMinutes: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyBacklogEventRecord = {
  id: string;
  workspaceId: string;
  backlogItemId: string | null;
  changeRequestId: string | null;
  simulationId: string | null;
  draftId: string | null;
  workflowId: string | null;
  eventType: AgentPmoPolicyBacklogEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export type CreatePolicyBacklogItemInput = {
  workspaceId: string;
  sourceProposalId?: string | null;
  itemType: AgentPmoPolicyBacklogItemType;
  itemCategory: string;
  priority?: AgentPmoPolicyBacklogPriority;
  title: string;
  description: string;
  sourceFeedbackIds?: string[];
  sourceSignalIds?: string[];
  relatedAdapterKeys?: string[];
  createdBy?: string | null;
};

export type CreatePolicyChangeRequestInput = {
  workspaceId: string;
  backlogItemId: string;
  policyArea: string;
  changeSummary: string;
  changeRationale: string;
  createdBy?: string | null;
};

export type PolicyApprovalDecisionInput = {
  workspaceId: string;
  workflowId: string;
  stage: AgentPmoPolicyApprovalStage;
  decisionType: AgentPmoPolicyApprovalDecisionType;
  decisionNote?: string | null;
  decidedBy?: string | null;
};
