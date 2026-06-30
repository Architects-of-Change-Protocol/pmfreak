// ─── PMO Controlled Policy Implementation Planning Workspace — Types ─
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT apply policies, change routing, change risk scoring.
// Does NOT activate policy drafts, run dry-runs, or execute rollback.
// Does NOT mutate live policies.
// All operations are deterministic — planning workspace only.

// ─── Union Types ──────────────────────────────────────────────────────────────

export type AgentPmoImplementationPlanningWorkspaceStatus =
  | "created"
  | "planning"
  | "under_review"
  | "changes_requested"
  | "approved_for_dry_run_planning"
  | "blocked"
  | "archived";

export type AgentPmoImplementationPlanDraftStatus =
  | "created"
  | "draft"
  | "under_review"
  | "approved_for_dry_run_planning"
  | "changes_requested"
  | "blocked"
  | "archived";

export type AgentPmoImplementationTaskType =
  | "policy_version_preparation"
  | "configuration_review"
  | "runtime_mapping_review"
  | "safety_check"
  | "test_plan_preparation"
  | "stakeholder_review"
  | "change_window_preparation"
  | "rollback_preparation"
  | "dry_run_preparation"
  | "documentation_update";

export type AgentPmoImplementationTaskStatus =
  | "planned"
  | "ready_for_planning_review"
  | "blocked"
  | "deferred"
  | "removed";

export type AgentPmoPreImplementationChecklistStatus =
  | "not_started"
  | "pending"
  | "passed"
  | "failed"
  | "blocked"
  | "not_applicable";

export type AgentPmoStakeholderRole =
  | "pmo_owner"
  | "security_owner"
  | "operations_owner"
  | "data_governance_owner"
  | "executive_sponsor"
  | "implementation_owner"
  | "rollback_owner";

export type AgentPmoStakeholderReadinessStatus =
  | "not_required"
  | "pending"
  | "acknowledged"
  | "changes_requested"
  | "blocked"
  | "waived";

export type AgentPmoChangeWindowType =
  | "standard"
  | "maintenance"
  | "emergency_planning"
  | "low_traffic"
  | "business_hours"
  | "after_hours";

export type AgentPmoChangeWindowStatus =
  | "draft"
  | "proposed"
  | "under_review"
  | "approved_for_dry_run_planning"
  | "rejected"
  | "blocked"
  | "archived";

export type AgentPmoImplementationRiskType =
  | "policy_behavior_risk"
  | "routing_risk"
  | "scoring_risk"
  | "evidence_requirement_risk"
  | "adapter_governance_risk"
  | "operational_risk"
  | "rollback_risk"
  | "stakeholder_risk"
  | "data_safety_risk"
  | "compliance_risk";

export type AgentPmoImplementationRiskStatus =
  | "open"
  | "mitigated"
  | "accepted"
  | "transferred"
  | "blocked"
  | "closed";

export type AgentPmoImplementationRiskSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AgentPmoRollbackRehearsalType =
  | "tabletop"
  | "configuration_review"
  | "version_revert_review"
  | "routing_restore_review"
  | "scoring_restore_review"
  | "evidence_requirement_restore_review"
  | "adapter_governance_review";

export type AgentPmoRollbackRehearsalStatus =
  | "created"
  | "planned"
  | "ready_for_review"
  | "reviewed"
  | "blocked"
  | "archived";

export type AgentPmoImplementationGatePrerequisiteType =
  | "approval_pack_exists"
  | "approval_pack_signed_off"
  | "implementation_plan_approved"
  | "task_breakdown_reviewed"
  | "stakeholders_acknowledged"
  | "change_window_reviewed"
  | "risk_register_reviewed"
  | "rollback_rehearsal_ready"
  | "validation_checklist_passed"
  | "security_review_complete"
  | "operations_review_complete"
  | "data_governance_review_complete";

export type AgentPmoImplementationGatePrerequisiteStatus =
  | "pending"
  | "satisfied"
  | "failed"
  | "blocked"
  | "waived"
  | "not_applicable";

export type AgentPmoImplementationPlanningDecisionType =
  | "approve_plan_for_dry_run_planning"
  | "request_changes"
  | "block_plan"
  | "waive_prerequisite"
  | "archive_planning_workspace";

export type AgentPmoImplementationPlanningExportFormat =
  | "markdown"
  | "json"
  | "csv";

export type AgentPmoImplementationPlanningExportStatus =
  | "created"
  | "generated"
  | "failed"
  | "downloaded"
  | "archived";

export type AgentPmoImplementationPlanningEventType =
  | "implementation_planning_workspace_created"
  | "implementation_plan_draft_created"
  | "implementation_task_breakdown_created"
  | "implementation_planning_checklist_created"
  | "implementation_planning_checklist_item_recorded"
  | "stakeholder_readiness_recorded"
  | "change_window_plan_created"
  | "implementation_risk_registered"
  | "rollback_rehearsal_plan_created"
  | "implementation_gate_prerequisite_recorded"
  | "implementation_planning_decision_recorded"
  | "implementation_planning_export_created"
  | "implementation_planning_workspace_archived";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentPmoImplementationPlanningWorkspaceRecord = {
  id: string;
  workspaceId: string;
  approvalPackId: string | null;
  changeRequestId: string | null;
  signoffPacketId: string | null;
  implementationTicketDraftId: string | null;
  planningOwnerRole: AgentPmoStakeholderRole | null;
  planningVersion: number;
  status: AgentPmoImplementationPlanningWorkspaceStatus;
  title: string;
  summary: string;
  safePlanningPayload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoImplementationPlanDraftRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId: string | null;
  changeRequestId: string | null;
  planVersion: number;
  status: AgentPmoImplementationPlanDraftStatus;
  implementationObjective: string;
  implementationScope: string;
  nonGoals: string;
  assumptions: string;
  constraints: string;
  safePlanPayload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoImplementationTaskBreakdownRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  planDraftId: string | null;
  taskType: AgentPmoImplementationTaskType;
  status: AgentPmoImplementationTaskStatus;
  taskOrder: number;
  title: string;
  description: string;
  ownerRole: AgentPmoStakeholderRole | null;
  blockingReason: string | null;
  safeTaskPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPreImplementationChecklistRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId: string | null;
  status: AgentPmoPreImplementationChecklistStatus;
  totalItems: number;
  passedItems: number;
  failedItems: number;
  blockedItems: number;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPreImplementationChecklistItemRecord = {
  id: string;
  workspaceId: string;
  checklistId: string;
  itemKey: string;
  itemLabel: string;
  status: AgentPmoPreImplementationChecklistStatus;
  sourceRecordId: string | null;
  blockingReason: string | null;
  createdAt: string;
};

export type AgentPmoStakeholderReadinessRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  stakeholderRole: AgentPmoStakeholderRole;
  status: AgentPmoStakeholderReadinessStatus;
  rationale: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoChangeWindowPlanRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  changeRequestId: string | null;
  windowType: AgentPmoChangeWindowType;
  status: AgentPmoChangeWindowStatus;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  timezone: string | null;
  businessImpactEstimate: string | null;
  operationalConstraints: string | null;
  approvalRequired: boolean;
  safeWindowPayload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoImplementationRiskRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  riskType: AgentPmoImplementationRiskType;
  severity: AgentPmoImplementationRiskSeverity;
  status: AgentPmoImplementationRiskStatus;
  riskSummary: string;
  mitigationSummary: string | null;
  ownerRole: AgentPmoStakeholderRole | null;
  safeRiskPayload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoRollbackRehearsalPlanRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  rollbackPlanId: string | null;
  rehearsalType: AgentPmoRollbackRehearsalType;
  status: AgentPmoRollbackRehearsalStatus;
  rehearsalSummary: string;
  verificationSteps: string[];
  expectedEvidence: string[];
  blockingReasons: string[];
  safeRehearsalPayload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoImplementationGatePrerequisiteRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  prerequisiteType: AgentPmoImplementationGatePrerequisiteType;
  status: AgentPmoImplementationGatePrerequisiteStatus;
  rationale: string | null;
  sourceRecordId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoImplementationPlanningDecisionRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  decision: AgentPmoImplementationPlanningDecisionType;
  rationale: string;
  decidedBy: string | null;
  decidedAt: string;
  createdAt: string;
};

export type AgentPmoImplementationPlanningExportRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  exportFormat: AgentPmoImplementationPlanningExportFormat;
  status: AgentPmoImplementationPlanningExportStatus;
  fileName: string;
  contentType: string;
  contentText: string | null;
  contentJson: Record<string, unknown> | null;
  safeExportPayload: Record<string, unknown>;
  generatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoImplementationPlanningEventRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string | null;
  planDraftId: string | null;
  checklistId: string | null;
  exportId: string | null;
  eventType: AgentPmoImplementationPlanningEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export type CreateAgentPmoImplementationPlanningWorkspaceInput = {
  workspaceId: string;
  approvalPackId: string;
  title: string;
  summary: string;
  planningOwnerRole?: AgentPmoStakeholderRole | null;
  changeRequestId?: string | null;
  actorId?: string | null;
};

export type CreateAgentPmoImplementationPlanDraftInput = {
  workspaceId: string;
  planningWorkspaceId: string;
  implementationObjective: string;
  implementationScope: string;
  nonGoals: string;
  assumptions?: string;
  constraints?: string;
  actorId?: string | null;
};

export type RecordAgentPmoImplementationPlanningDecisionInput = {
  workspaceId: string;
  planningWorkspaceId: string;
  decision: AgentPmoImplementationPlanningDecisionType;
  rationale: string;
  decidedBy?: string | null;
};

export type GenerateAgentPmoImplementationPlanningExportInput = {
  workspaceId: string;
  planningWorkspaceId: string;
  exportFormat: AgentPmoImplementationPlanningExportFormat;
  generatedBy?: string | null;
};
