// ─── PMO Controlled Policy Version Activation & Rollback Gate — Types ─────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, mutate projects, or create external tickets.
// Does NOT send emails, Slack messages, or create calendar events.
// Does NOT activate policy without explicit approval gate.
// Does NOT rollback without explicit rollback gate.
// All operations update only dedicated PMO governance policy activation records.

// ─── Union Types ──────────────────────────────────────────────────────────────

export type AgentPmoPolicyActivationRequestStatus =
  | "created"
  | "preconditions_pending"
  | "preconditions_failed"
  | "ready_for_activation_review"
  | "activation_review_required"
  | "activation_approved"
  | "activation_rejected"
  | "activation_running"
  | "activated"
  | "activation_failed"
  | "rollback_available"
  | "rollback_requested"
  | "rolled_back"
  | "blocked"
  | "archived";

export type AgentPmoPolicyActivationPreconditionStatus =
  | "pending"
  | "passed"
  | "failed"
  | "blocked"
  | "waived";

export type AgentPmoPolicyActivationGateStatus =
  | "created"
  | "under_review"
  | "approved_for_activation"
  | "rejected"
  | "changes_requested"
  | "blocked"
  | "archived";

export type AgentPmoPolicyActivationGateDecisionType =
  | "approve_for_activation"
  | "reject"
  | "request_changes"
  | "block"
  | "archive";

export type AgentPmoControlledPolicyVersionStatus =
  | "created"
  | "ready_for_activation"
  | "active"
  | "superseded"
  | "rolled_back"
  | "blocked"
  | "archived";

export type AgentPmoPolicyActivationExecutionStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "archived";

export type AgentPmoPolicyRollbackRequestStatus =
  | "created"
  | "rollback_review_required"
  | "rollback_approved"
  | "rollback_rejected"
  | "rollback_running"
  | "rolled_back"
  | "rollback_failed"
  | "verification_pending"
  | "verified"
  | "blocked"
  | "archived";

export type AgentPmoPolicyRollbackGateStatus =
  | "created"
  | "under_review"
  | "approved_for_rollback"
  | "rejected"
  | "changes_requested"
  | "blocked"
  | "archived";

export type AgentPmoPolicyRollbackGateDecisionType =
  | "approve_for_rollback"
  | "reject"
  | "request_changes"
  | "block"
  | "archive";

export type AgentPmoPolicyRollbackExecutionStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "archived";

export type AgentPmoPolicyRollbackVerificationStatus =
  | "created"
  | "pending"
  | "passed"
  | "failed"
  | "blocked"
  | "waived"
  | "archived";

export type AgentPmoPolicyActivationAuditEntryType =
  | "activation_request_created"
  | "activation_preconditions_created"
  | "activation_preconditions_completed"
  | "activation_gate_created"
  | "activation_gate_decision_recorded"
  | "controlled_policy_version_created"
  | "active_policy_pointer_updated"
  | "activation_execution_created"
  | "activation_execution_started"
  | "activation_execution_completed"
  | "activation_execution_failed"
  | "rollback_request_created"
  | "rollback_gate_created"
  | "rollback_gate_decision_recorded"
  | "rollback_execution_created"
  | "rollback_execution_started"
  | "rollback_execution_completed"
  | "rollback_execution_failed"
  | "rollback_verification_created"
  | "rollback_verification_completed"
  | "post_activation_monitoring_hook_created"
  | "activation_export_created"
  | "activation_request_archived";

export type AgentPmoPostActivationMonitoringHookType =
  | "policy_behavior_monitor"
  | "routing_effect_monitor"
  | "scoring_effect_monitor"
  | "evidence_requirement_monitor"
  | "approval_gate_monitor"
  | "dispatch_gate_monitor"
  | "operator_workload_monitor"
  | "rollback_readiness_monitor"
  | "data_safety_monitor"
  | "compliance_monitor";

export type AgentPmoPostActivationMonitoringHookStatus =
  | "created"
  | "active"
  | "paused"
  | "completed"
  | "blocked"
  | "archived";

export type AgentPmoPolicyActivationExportFormat =
  | "markdown"
  | "json"
  | "csv";

export type AgentPmoPolicyActivationExportStatus =
  | "created"
  | "generated"
  | "failed"
  | "downloaded"
  | "archived";

export type AgentPmoPolicyActivationEventType =
  | "activation_request_created"
  | "activation_preconditions_created"
  | "activation_preconditions_completed"
  | "activation_gate_created"
  | "activation_gate_decision_recorded"
  | "controlled_policy_version_created"
  | "active_policy_pointer_updated"
  | "activation_execution_created"
  | "activation_execution_started"
  | "activation_execution_completed"
  | "activation_execution_failed"
  | "rollback_request_created"
  | "rollback_gate_created"
  | "rollback_gate_decision_recorded"
  | "rollback_execution_created"
  | "rollback_execution_started"
  | "rollback_execution_completed"
  | "rollback_execution_failed"
  | "rollback_verification_created"
  | "rollback_verification_completed"
  | "post_activation_monitoring_hook_created"
  | "activation_export_created"
  | "activation_request_archived";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentPmoPolicyActivationRequestRecord = {
  id: string;
  workspaceId: string;
  dryRunRequestId: string;
  dryRunDecisionId: string | null;
  evidencePackageId: string | null;
  simulatedPolicyVersionId: string | null;
  planningWorkspaceId: string | null;
  approvalPackId: string | null;
  changeRequestId: string | null;
  requestedBy: string | null;
  requestReason: string;
  activationStatus: AgentPmoPolicyActivationRequestStatus;
  requestVersion: number;
  safeRequestPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyActivationPreconditionRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string;
  preconditionKey: string;
  preconditionStatus: AgentPmoPolicyActivationPreconditionStatus;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyActivationGateRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string;
  gateStatus: AgentPmoPolicyActivationGateStatus;
  reviewedBy: string | null;
  safeGatePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyActivationGateDecisionRecord = {
  id: string;
  workspaceId: string;
  activationGateId: string;
  activationRequestId: string;
  decisionType: AgentPmoPolicyActivationGateDecisionType;
  rationale: string;
  decidedBy: string | null;
  createdAt: string;
};

export type AgentPmoControlledPolicyVersionRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string;
  dryRunRequestId: string | null;
  simulatedPolicyVersionId: string | null;
  versionLabel: string;
  versionNumber: number;
  policyArea: string;
  versionStatus: AgentPmoControlledPolicyVersionStatus;
  safePolicyPayload: Record<string, unknown>;
  safeDiffPayload: Record<string, unknown>;
  createdAt: string;
  activatedAt: string | null;
  updatedAt: string;
};

export type AgentPmoActivePolicyPointerRecord = {
  id: string;
  workspaceId: string;
  policyArea: string;
  activePolicyVersionId: string | null;
  previousPolicyVersionId: string | null;
  activationRequestId: string | null;
  activatedBy: string | null;
  activatedAt: string | null;
  rollbackAvailable: boolean;
  safePointerPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyActivationExecutionRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string;
  activationGateId: string | null;
  controlledPolicyVersionId: string | null;
  activePolicyPointerId: string | null;
  executionStatus: AgentPmoPolicyActivationExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  safeExecutionPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyRollbackRequestRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string;
  controlledPolicyVersionId: string | null;
  activePolicyPointerId: string | null;
  requestedBy: string | null;
  requestReason: string;
  rollbackStatus: AgentPmoPolicyRollbackRequestStatus;
  safeRollbackRequestPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyRollbackGateRecord = {
  id: string;
  workspaceId: string;
  rollbackRequestId: string;
  gateStatus: AgentPmoPolicyRollbackGateStatus;
  reviewedBy: string | null;
  safeGatePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyRollbackGateDecisionRecord = {
  id: string;
  workspaceId: string;
  rollbackGateId: string;
  rollbackRequestId: string;
  decisionType: AgentPmoPolicyRollbackGateDecisionType;
  rationale: string;
  decidedBy: string | null;
  createdAt: string;
};

export type AgentPmoPolicyRollbackExecutionRecord = {
  id: string;
  workspaceId: string;
  rollbackRequestId: string;
  rollbackGateId: string | null;
  activationRequestId: string | null;
  controlledPolicyVersionId: string | null;
  previousPolicyVersionId: string | null;
  activePolicyPointerId: string | null;
  executionStatus: AgentPmoPolicyRollbackExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  safeRollbackPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyRollbackVerificationRecord = {
  id: string;
  workspaceId: string;
  rollbackExecutionId: string;
  rollbackRequestId: string | null;
  verificationStatus: AgentPmoPolicyRollbackVerificationStatus;
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  safeVerificationPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyActivationAuditEntryRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string | null;
  entryType: AgentPmoPolicyActivationAuditEntryType;
  summary: string;
  actorId: string | null;
  safeAuditPayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoPostActivationMonitoringHookRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string;
  hookType: AgentPmoPostActivationMonitoringHookType;
  hookStatus: AgentPmoPostActivationMonitoringHookStatus;
  summary: string;
  safeHookPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyActivationExportRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string;
  exportFormat: AgentPmoPolicyActivationExportFormat;
  exportStatus: AgentPmoPolicyActivationExportStatus;
  safeExportContent: string;
  exportSizeBytes: number;
  safetyValidationPassed: boolean;
  createdBy: string | null;
  createdAt: string;
};

export type AgentPmoPolicyActivationEventRecord = {
  id: string;
  workspaceId: string;
  activationRequestId: string | null;
  eventType: AgentPmoPolicyActivationEventType;
  message: string | null;
  safeEventPayload: Record<string, unknown>;
  actorId: string | null;
  createdAt: string;
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export type CreateAgentPmoPolicyActivationRequestInput = {
  workspaceId: string;
  dryRunRequestId: string;
  dryRunDecisionId?: string | null;
  evidencePackageId?: string | null;
  simulatedPolicyVersionId?: string | null;
  planningWorkspaceId?: string | null;
  approvalPackId?: string | null;
  changeRequestId?: string | null;
  requestedBy?: string | null;
  requestReason: string;
};

export type CreateAgentPmoPolicyActivationGateInput = {
  workspaceId: string;
  activationRequestId: string;
  reviewedBy?: string | null;
};

export type RecordAgentPmoPolicyActivationGateDecisionInput = {
  workspaceId: string;
  activationGateId: string;
  activationRequestId: string;
  decisionType: AgentPmoPolicyActivationGateDecisionType;
  rationale: string;
  decidedBy?: string | null;
};

export type ExecuteAgentPmoPolicyActivationInput = {
  workspaceId: string;
  activationRequestId: string;
  controlledPolicyVersionId: string;
  executionRationale: string;
  actorId?: string | null;
};

export type CreateAgentPmoPolicyRollbackRequestInput = {
  workspaceId: string;
  activationRequestId: string;
  rollbackReason: string;
  requestedBy?: string | null;
};

export type CreateAgentPmoPolicyRollbackGateInput = {
  workspaceId: string;
  rollbackRequestId: string;
  reviewedBy?: string | null;
};

export type RecordAgentPmoPolicyRollbackGateDecisionInput = {
  workspaceId: string;
  rollbackGateId: string;
  rollbackRequestId: string;
  decisionType: AgentPmoPolicyRollbackGateDecisionType;
  rationale: string;
  decidedBy?: string | null;
};

export type ExecuteAgentPmoPolicyRollbackInput = {
  workspaceId: string;
  rollbackRequestId: string;
  rollbackRationale: string;
  actorId?: string | null;
};

export type GenerateAgentPmoPolicyActivationExportInput = {
  workspaceId: string;
  activationRequestId: string;
  exportFormat: AgentPmoPolicyActivationExportFormat;
  generatedBy?: string | null;
};
