// ─── PMO Controlled Policy Implementation Gate & Dry-Run Change Executor — Types ─
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT apply policies, change routing, change risk scoring.
// Does NOT activate policy drafts or execute rollback.
// Does NOT mutate live policies.
// All operations are deterministic — dry-run simulation only.

// ─── Union Types ──────────────────────────────────────────────────────────────

export type AgentPmoDryRunRequestStatus =
  | "created"
  | "preflight_pending"
  | "preflight_failed"
  | "ready_for_gate_review"
  | "gate_review_required"
  | "gate_approved"
  | "gate_rejected"
  | "dry_run_running"
  | "dry_run_completed"
  | "dry_run_failed"
  | "blocked"
  | "archived";

export type AgentPmoDryRunPreflightStatus =
  | "pending"
  | "passed"
  | "failed"
  | "blocked"
  | "waived";

export type AgentPmoDryRunGateApprovalStatus =
  | "created"
  | "under_review"
  | "approved_for_dry_run_only"
  | "rejected"
  | "changes_requested"
  | "blocked"
  | "archived";

export type AgentPmoDryRunGateDecisionType =
  | "approve_for_dry_run_only"
  | "reject"
  | "request_changes"
  | "block"
  | "archive";

export type AgentPmoDryRunChangeType =
  | "policy_rule_addition"
  | "policy_rule_update"
  | "policy_rule_removal"
  | "routing_rule_simulation"
  | "scoring_rule_simulation"
  | "evidence_requirement_simulation"
  | "approval_gate_simulation"
  | "dispatch_gate_simulation"
  | "rollback_path_simulation";

export type AgentPmoSimulatedPolicyVersionStatus =
  | "created"
  | "simulated"
  | "review_ready"
  | "blocked"
  | "archived";

export type AgentPmoDryRunExecutionStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "archived";

export type AgentPmoDryRunImpactDomain =
  | "policy_behavior"
  | "review_routing"
  | "risk_scoring"
  | "evidence_requirements"
  | "approval_gates"
  | "dispatch_gates"
  | "operator_workload"
  | "rollback_readiness"
  | "data_safety"
  | "compliance";

export type AgentPmoDryRunImpactLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown";

export type AgentPmoDryRunEvidencePackageStatus =
  | "created"
  | "assembled"
  | "review_ready"
  | "accepted"
  | "rejected"
  | "archived";

export type AgentPmoDryRunEvidenceSectionType =
  | "preflight_summary"
  | "gate_approval_summary"
  | "planning_workspace_summary"
  | "change_set_summary"
  | "simulated_policy_version_summary"
  | "simulated_impact_summary"
  | "blocker_summary"
  | "operator_review_summary"
  | "non_goals"
  | "limitations";

export type AgentPmoDryRunBlockerType =
  | "missing_planning_workspace"
  | "planning_not_approved"
  | "approval_pack_not_signed_off"
  | "preflight_failed"
  | "gate_rejected"
  | "unsafe_payload_detected"
  | "missing_rollback_rehearsal"
  | "stakeholder_not_ready"
  | "risk_not_reviewed"
  | "change_window_not_reviewed"
  | "simulated_policy_invalid"
  | "simulated_impact_too_high"
  | "unknown_baseline"
  | "validation_failed";

export type AgentPmoDryRunBlockerStatus =
  | "open"
  | "resolved"
  | "accepted"
  | "waived"
  | "blocked"
  | "archived";

export type AgentPmoDryRunBlockerSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AgentPmoDryRunOperatorReviewStatus =
  | "created"
  | "under_review"
  | "accepted"
  | "changes_requested"
  | "rejected"
  | "blocked"
  | "archived";

export type AgentPmoDryRunOperatorReviewDecision =
  | "accept_dry_run_result"
  | "request_changes"
  | "reject_dry_run_result"
  | "block_future_activation"
  | "archive";

export type AgentPmoDryRunDecisionType =
  | "pass_for_future_activation_planning"
  | "fail"
  | "blocked"
  | "request_changes"
  | "archive";

export type AgentPmoDryRunDecisionStatus =
  | "created"
  | "recorded"
  | "archived";

export type AgentPmoDryRunExportFormat =
  | "markdown"
  | "json"
  | "csv";

export type AgentPmoDryRunExportStatus =
  | "created"
  | "generated"
  | "safety_validated"
  | "available"
  | "archived";

export type AgentPmoDryRunEventType =
  | "dry_run_request_created"
  | "dry_run_preflight_created"
  | "dry_run_preflight_completed"
  | "dry_run_gate_approval_created"
  | "dry_run_gate_decision_recorded"
  | "dry_run_change_set_created"
  | "simulated_policy_version_created"
  | "dry_run_execution_created"
  | "dry_run_execution_started"
  | "dry_run_execution_completed"
  | "dry_run_execution_failed"
  | "simulated_impact_recorded"
  | "dry_run_evidence_package_created"
  | "dry_run_blocker_recorded"
  | "dry_run_operator_review_recorded"
  | "dry_run_decision_recorded"
  | "dry_run_export_created"
  | "dry_run_request_archived";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentPmoDryRunExecutionRequestRecord = {
  id: string;
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId: string | null;
  changeRequestId: string | null;
  requestedBy: string | null;
  requestReason: string;
  requestStatus: AgentPmoDryRunRequestStatus;
  requestVersion: number;
  safeRequestPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoDryRunPreflightValidationRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  preflightStatus: AgentPmoDryRunPreflightStatus;
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  checksBlocked: number;
  safePreflightPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoDryRunGateApprovalRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  gateApprovalStatus: AgentPmoDryRunGateApprovalStatus;
  reviewedBy: string | null;
  safeApprovalPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoDryRunGateDecisionRecord = {
  id: string;
  workspaceId: string;
  gateApprovalId: string;
  dryRunRequestId: string;
  decisionType: AgentPmoDryRunGateDecisionType;
  rationale: string;
  decidedBy: string | null;
  createdAt: string;
};

export type AgentPmoDryRunChangeSetRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  planningWorkspaceId: string;
  approvalPackId: string | null;
  changeRequestId: string | null;
  simulatedChangeCount: number;
  policyArea: string | null;
  safeChangeSummary: string;
  safeChangeSetPayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoDryRunChangeSetItemRecord = {
  id: string;
  workspaceId: string;
  changeSetId: string;
  dryRunRequestId: string;
  changeType: AgentPmoDryRunChangeType;
  safeChangeSummary: string;
  safeChangePayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoSimulatedPolicyVersionRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  changeSetId: string | null;
  simulatedVersionLabel: string;
  baselineLabel: string;
  targetLabel: string;
  unknownBaseline: boolean;
  simulatedPolicyPayload: Record<string, unknown>;
  safeDiffPayload: Record<string, unknown>;
  status: AgentPmoSimulatedPolicyVersionStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoDryRunSimulationExecutionRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  preflightValidationId: string | null;
  gateApprovalId: string | null;
  changeSetId: string | null;
  simulatedPolicyVersionId: string | null;
  executionStatus: AgentPmoDryRunExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  safeExecutionPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoDryRunSimulatedImpactRecord = {
  id: string;
  workspaceId: string;
  dryRunExecutionId: string;
  dryRunRequestId: string;
  impactDomain: AgentPmoDryRunImpactDomain;
  impactLevel: AgentPmoDryRunImpactLevel;
  impactSummary: string;
  affectedCount: number;
  safeImpactPayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoDryRunEvidencePackageRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  packageStatus: AgentPmoDryRunEvidencePackageStatus;
  safePackagePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoDryRunEvidenceSectionRecord = {
  id: string;
  workspaceId: string;
  evidencePackageId: string;
  dryRunRequestId: string;
  sectionType: AgentPmoDryRunEvidenceSectionType;
  safeSectionContent: string;
  safeMarkdown: string;
  createdAt: string;
};

export type AgentPmoDryRunBlockerRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  blockerType: AgentPmoDryRunBlockerType;
  blockerStatus: AgentPmoDryRunBlockerStatus;
  severity: AgentPmoDryRunBlockerSeverity;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoDryRunOperatorReviewRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  evidencePackageId: string | null;
  reviewStatus: AgentPmoDryRunOperatorReviewStatus;
  reviewDecision: AgentPmoDryRunOperatorReviewDecision | null;
  reviewRationale: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoDryRunDecisionRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  decisionType: AgentPmoDryRunDecisionType;
  decisionStatus: AgentPmoDryRunDecisionStatus;
  rationale: string;
  decidedBy: string | null;
  createdAt: string;
};

export type AgentPmoDryRunExportRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  exportFormat: AgentPmoDryRunExportFormat;
  exportStatus: AgentPmoDryRunExportStatus;
  safeExportContent: string;
  exportSizeBytes: number;
  safetyValidationPassed: boolean;
  createdBy: string | null;
  createdAt: string;
};

export type AgentPmoDryRunEventRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string | null;
  eventType: AgentPmoDryRunEventType;
  message: string | null;
  safeEventPayload: Record<string, unknown>;
  actorId: string | null;
  createdAt: string;
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export type CreateAgentPmoDryRunExecutionRequestInput = {
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId?: string | null;
  changeRequestId?: string | null;
  requestReason: string;
  requestedBy?: string | null;
};

export type CreateAgentPmoDryRunGateApprovalInput = {
  workspaceId: string;
  dryRunRequestId: string;
  reviewedBy?: string | null;
};

export type RecordAgentPmoDryRunGateDecisionInput = {
  workspaceId: string;
  gateApprovalId: string;
  dryRunRequestId: string;
  decisionType: AgentPmoDryRunGateDecisionType;
  rationale: string;
  decidedBy?: string | null;
};

export type RecordAgentPmoDryRunOperatorReviewInput = {
  workspaceId: string;
  dryRunRequestId: string;
  evidencePackageId?: string | null;
  reviewDecision: AgentPmoDryRunOperatorReviewDecision;
  reviewRationale?: string | null;
  reviewedBy?: string | null;
};

export type RecordAgentPmoDryRunDecisionInput = {
  workspaceId: string;
  dryRunRequestId: string;
  decisionType: AgentPmoDryRunDecisionType;
  rationale: string;
  decidedBy?: string | null;
};

export type GenerateAgentPmoDryRunExportInput = {
  workspaceId: string;
  dryRunRequestId: string;
  exportFormat: AgentPmoDryRunExportFormat;
  generatedBy?: string | null;
};
