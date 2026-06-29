// ─── Agent Observability & Audit Trail — Types ────────────────────────────────

export type AgentAuditEventCategory =
  | "agent"
  | "tool"
  | "approval"
  | "memory"
  | "context"
  | "decision"
  | "governance"
  | "reporting"
  | "security"
  | "system"
  | "execution";

export type AgentAuditEventType =
  | "agent_registered"
  | "agent_updated"
  | "tool_eligibility_checked"
  | "tool_request_created"
  | "tool_request_approved"
  | "tool_request_rejected"
  | "tool_request_cancelled"
  | "tool_request_revoked"
  | "memory_created"
  | "memory_accessed"
  | "memory_marked_stale"
  | "memory_expired"
  | "memory_revoked"
  | "memory_archived"
  | "context_policy_created"
  | "context_policy_updated"
  | "decision_recorded"
  | "recommendation_recorded"
  | "classification_recorded"
  | "governance_event_recorded"
  | "report_generated"
  | "access_denied"
  | "policy_denied"
  | "sensitive_payload_rejected"
  | "audit_export_created"
  | "execution_request_created"
  | "execution_request_updated"
  | "execution_preflight_started"
  | "execution_preflight_passed"
  | "execution_preflight_failed"
  | "execution_blocked"
  | "execution_pending_approval"
  | "execution_approved"
  | "execution_ready"
  | "execution_dry_run_completed"
  | "execution_draft_completed"
  | "execution_cancelled"
  | "execution_expired"
  | "execution_failed"
  | "adapter_eligibility_checked"
  | "adapter_execution_created"
  | "adapter_execution_started"
  | "adapter_execution_succeeded"
  | "adapter_execution_failed"
  | "adapter_execution_refused"
  | "adapter_execution_cancelled"
  | "result_created"
  | "result_ready_for_review"
  | "result_superseded"
  | "result_archived"
  | "result_discarded"
  | "evidence_created"
  | "evidence_linked"
  | "confidence_calculated"
  | "lineage_recorded"
  | "retention_policy_applied"
  | "result_export_metadata_created"
  | "review_queue_created"
  | "review_item_created"
  | "review_item_assigned"
  | "review_item_opened"
  | "review_item_decision_recorded"
  | "review_item_accepted"
  | "review_item_rejected"
  | "review_item_more_evidence_requested"
  | "review_item_archived"
  | "review_item_escalated"
  | "review_item_deferred"
  | "review_item_action_drafted"
  | "review_assignment_created"
  | "review_assignment_completed"
  | "action_draft_created"
  | "action_draft_updated"
  | "action_draft_cancelled"
  | "action_conversion_created"
  | "action_conversion_preflight_started"
  | "action_conversion_preflight_passed"
  | "action_conversion_preflight_failed"
  | "action_conversion_approval_required"
  | "action_conversion_approval_not_required"
  | "action_conversion_approval_bridge_created"
  | "action_conversion_approval_satisfied"
  | "action_conversion_execution_request_created"
  | "action_conversion_blocked"
  | "action_conversion_cancelled"
  | "action_conversion_completed"
  | "execution_finalization_created"
  | "execution_dispatch_readiness_checked"
  | "execution_dispatch_readiness_passed"
  | "execution_dispatch_readiness_failed"
  | "execution_dispatch_approval_verified"
  | "execution_dispatch_final_confirmation_required"
  | "execution_dispatch_final_confirmation_recorded"
  | "execution_dispatch_lock_acquired"
  | "execution_dispatch_lock_released"
  | "execution_dispatch_idempotency_checked"
  | "execution_dispatch_gate_created"
  | "execution_dispatch_allowed"
  | "execution_dispatch_blocked"
  | "execution_dispatch_adapter_selected"
  | "execution_dispatch_started"
  | "execution_dispatch_succeeded"
  | "execution_dispatch_failed"
  | "execution_dispatch_result_reconciled"
  | "execution_dispatch_completed"
  | "execution_dispatch_cancelled"
  | "execution_outcome_created"
  | "execution_outcome_reconciled"
  | "execution_outcome_evidence_completeness_scored"
  | "execution_outcome_comparison_complete"
  | "execution_outcome_confidence_scored"
  | "execution_outcome_review_requirement_determined"
  | "execution_outcome_human_review_created"
  | "execution_outcome_decision_recorded"
  | "execution_outcome_failed_dispatch_triaged"
  | "execution_outcome_correction_loop_created"
  | "execution_outcome_archived";

export type AgentAuditSeverity =
  | "info"
  | "notice"
  | "warning"
  | "high"
  | "critical";

export type AgentAuditOutcome =
  | "success"
  | "denied"
  | "pending"
  | "failed"
  | "cancelled"
  | "revoked"
  | "expired";

export type AgentAuditSourceType =
  | "agent_specification"
  | "agent_tool_registry"
  | "agent_tool_approval"
  | "agent_memory_context"
  | "agent_execution_runtime"
  | "pmo_governance"
  | "pmo_command_center"
  | "executive_reporting"
  | "system"
  | "api"
  | "agent_tool_adapter_layer"
  | "agent_execution_results_evidence_layer"
  | "agent_human_review_action_inbox"
  | "agent_controlled_action_conversion_approval_bridge"
  | "agent_controlled_execution_finalization_adapter_dispatch_gate"
  | "agent_controlled_execution_result_reconciliation_human_outcome_review";

export type AgentAuditScopeType =
  | "workspace"
  | "portfolio"
  | "project"
  | "pm"
  | "agent"
  | "tool_request"
  | "approval_request"
  | "memory_record"
  | "context_policy"
  | "report";

export type AgentDecisionType =
  | "classification"
  | "recommendation"
  | "risk_assessment"
  | "intervention_suggestion"
  | "summary"
  | "governance_assessment"
  | "next_action";

export type AgentDecisionStatus =
  | "draft"
  | "proposed"
  | "accepted"
  | "rejected"
  | "superseded"
  | "archived";

export type AgentAuditExportFormat =
  | "json"
  | "csv"
  | "markdown";

export type AgentAuditEventRecord = {
  id: string;
  workspaceId: string;
  correlationId: string | null;
  category: AgentAuditEventCategory;
  eventType: AgentAuditEventType;
  severity: AgentAuditSeverity;
  outcome: AgentAuditOutcome;
  sourceType: AgentAuditSourceType;
  scopeType: AgentAuditScopeType;
  scopeId: string | null;
  agentId: string | null;
  agentType: string | null;
  actorId: string | null;
  projectId: string | null;
  pmId: string | null;
  portfolioId: string | null;
  toolKey: string | null;
  toolRequestId: string | null;
  approvalRequestId: string | null;
  memoryId: string | null;
  contextPolicyId: string | null;
  reportId: string | null;
  title: string;
  message: string | null;
  reasonCode: string | null;
  payload: Record<string, unknown> | null;
  redactedPayload: Record<string, unknown> | null;
  evidenceRefs: string[];
  occurredAt: string;
  createdAt: string;
};

export type AgentDecisionEventRecord = {
  id: string;
  workspaceId: string;
  auditEventId: string | null;
  correlationId: string | null;
  agentId: string | null;
  agentType: string | null;
  decisionType: AgentDecisionType;
  status: AgentDecisionStatus;
  scopeType: AgentAuditScopeType;
  scopeId: string | null;
  projectId: string | null;
  pmId: string | null;
  portfolioId: string | null;
  title: string;
  summary: string | null;
  rationale: string | null;
  confidenceScore: number | null;
  riskLevel: string | null;
  evidenceRefs: string[];
  decisionPayload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentAuditExportRecord = {
  id: string;
  workspaceId: string;
  exportFormat: AgentAuditExportFormat;
  filterPayload: Record<string, unknown> | null;
  artifactTitle: string;
  artifactContent: string;
  artifactMetadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
};

export type CreateAgentAuditEventInput = {
  workspaceId: string;
  correlationId?: string | null;
  category: AgentAuditEventCategory;
  eventType: AgentAuditEventType;
  severity?: AgentAuditSeverity;
  outcome?: AgentAuditOutcome;
  sourceType: AgentAuditSourceType;
  scopeType: AgentAuditScopeType;
  scopeId?: string | null;
  agentId?: string | null;
  agentType?: string | null;
  actorId?: string | null;
  projectId?: string | null;
  pmId?: string | null;
  portfolioId?: string | null;
  toolKey?: string | null;
  toolRequestId?: string | null;
  approvalRequestId?: string | null;
  memoryId?: string | null;
  contextPolicyId?: string | null;
  reportId?: string | null;
  title: string;
  message?: string | null;
  reasonCode?: string | null;
  payload?: Record<string, unknown> | null;
  evidenceRefs?: string[];
  occurredAt?: string | null;
};

export type CreateAgentDecisionEventInput = {
  workspaceId: string;
  auditEventId?: string | null;
  correlationId?: string | null;
  agentId?: string | null;
  agentType?: string | null;
  decisionType: AgentDecisionType;
  status?: AgentDecisionStatus;
  scopeType: AgentAuditScopeType;
  scopeId?: string | null;
  projectId?: string | null;
  pmId?: string | null;
  portfolioId?: string | null;
  title: string;
  summary?: string | null;
  rationale?: string | null;
  confidenceScore?: number | null;
  riskLevel?: string | null;
  evidenceRefs?: string[];
  decisionPayload?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type AgentAuditListFilters = {
  category?: AgentAuditEventCategory;
  eventType?: AgentAuditEventType;
  severity?: AgentAuditSeverity;
  outcome?: AgentAuditOutcome;
  sourceType?: AgentAuditSourceType;
  scopeType?: AgentAuditScopeType;
  scopeId?: string;
  agentId?: string;
  agentType?: string;
  actorId?: string;
  projectId?: string;
  pmId?: string;
  portfolioId?: string;
  toolKey?: string;
  correlationId?: string;
  occurredFrom?: string;
  occurredTo?: string;
  limit?: number;
};

export type AgentTimelineEntry = {
  id: string;
  source: "audit_event" | "tool_request" | "approval_event" | "memory_event" | "decision_event";
  occurredAt: string;
  category: string;
  eventType: string;
  title: string;
  message: string | null;
  severity?: string | null;
  outcome?: string | null;
  correlationId?: string | null;
  relatedId?: string | null;
};

export type CreateAgentAuditExportInput = {
  workspaceId: string;
  exportFormat: AgentAuditExportFormat;
  filters?: AgentAuditListFilters;
  artifactTitle?: string;
  createdBy?: string | null;
};
