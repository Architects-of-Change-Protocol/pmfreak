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
  | "execution_outcome_archived"
  | "execution_learning_signal_created"
  | "execution_learning_signal_privacy_checked"
  | "execution_learning_signal_privacy_passed"
  | "execution_learning_signal_privacy_blocked"
  | "execution_learning_extraction_started"
  | "execution_learning_extraction_succeeded"
  | "execution_learning_extraction_failed"
  | "execution_governance_feedback_created"
  | "execution_risk_calibration_signal_created"
  | "execution_evidence_quality_signal_created"
  | "execution_adapter_performance_signal_created"
  | "execution_review_decision_pattern_created"
  | "execution_review_routing_feedback_created"
  | "execution_workspace_learning_summary_created"
  | "execution_aggregate_signal_created"
  | "execution_learning_signal_archived"
  | "pmo_governance_dashboard_snapshot_created"
  | "pmo_governance_insight_card_created"
  | "pmo_governance_feedback_reviewed"
  | "pmo_governance_policy_proposal_created"
  | "pmo_governance_policy_proposal_reviewed"
  | "pmo_governance_report_export_created"
  | "pmo_governance_report_export_downloaded"
  | "pmo_governance_dashboard_filter_applied"
  | "pmo_governance_dashboard_summary_viewed"
  | "pmo_policy_backlog_item_created"
  | "pmo_policy_change_request_created"
  | "pmo_policy_change_scope_created"
  | "pmo_policy_simulation_created"
  | "pmo_policy_simulation_completed"
  | "pmo_policy_impact_preview_created"
  | "pmo_policy_draft_created"
  | "pmo_policy_approval_workflow_created"
  | "pmo_policy_approval_decision_recorded"
  | "pmo_policy_rollback_plan_created"
  | "pmo_policy_implementation_readiness_evaluated"
  | "pmo_policy_change_request_archived"
  | "pmo_approval_pack_created"
  | "pmo_approval_pack_assembling"
  | "pmo_approval_pack_assembled"
  | "pmo_simulation_report_created"
  | "pmo_simulation_report_section_created"
  | "pmo_impact_summary_created"
  | "pmo_policy_draft_diff_created"
  | "pmo_approval_checklist_created"
  | "pmo_approval_checklist_item_recorded"
  | "pmo_rollback_checklist_created"
  | "pmo_rollback_checklist_item_recorded"
  | "pmo_signoff_packet_created"
  | "pmo_signoff_decision_recorded"
  | "pmo_implementation_ticket_draft_created"
  | "pmo_approval_pack_export_created"
  | "pmo_approval_pack_archived"
  | "pmo_implementation_planning_workspace_created"
  | "pmo_implementation_plan_draft_created"
  | "pmo_implementation_task_breakdown_created"
  | "pmo_pre_implementation_checklist_created"
  | "pmo_pre_implementation_checklist_item_recorded"
  | "pmo_stakeholder_readiness_recorded"
  | "pmo_change_window_plan_created"
  | "pmo_implementation_risk_registered"
  | "pmo_rollback_rehearsal_plan_created"
  | "pmo_implementation_gate_prerequisite_recorded"
  | "pmo_implementation_planning_decision_recorded"
  | "pmo_implementation_planning_export_created"
  | "pmo_implementation_planning_workspace_archived"
  | "pmo_dry_run_request_created"
  | "pmo_dry_run_preflight_created"
  | "pmo_dry_run_preflight_completed"
  | "pmo_dry_run_gate_approval_created"
  | "pmo_dry_run_gate_decision_recorded"
  | "pmo_dry_run_change_set_created"
  | "pmo_simulated_policy_version_created"
  | "pmo_dry_run_execution_created"
  | "pmo_dry_run_execution_started"
  | "pmo_dry_run_execution_completed"
  | "pmo_dry_run_execution_failed"
  | "pmo_dry_run_simulated_impact_recorded"
  | "pmo_dry_run_evidence_package_created"
  | "pmo_dry_run_blocker_recorded"
  | "pmo_dry_run_operator_review_recorded"
  | "pmo_dry_run_decision_recorded"
  | "pmo_dry_run_export_created"
  | "pmo_dry_run_request_archived"
  | "pmo_policy_activation_request_created"
  | "pmo_policy_activation_preconditions_created"
  | "pmo_policy_activation_preconditions_completed"
  | "pmo_policy_activation_gate_created"
  | "pmo_policy_activation_gate_decision_recorded"
  | "pmo_controlled_policy_version_created"
  | "pmo_active_policy_pointer_updated"
  | "pmo_policy_activation_execution_created"
  | "pmo_policy_activation_execution_started"
  | "pmo_policy_activation_execution_completed"
  | "pmo_policy_activation_execution_failed"
  | "pmo_policy_rollback_request_created"
  | "pmo_policy_rollback_gate_created"
  | "pmo_policy_rollback_gate_decision_recorded"
  | "pmo_policy_rollback_execution_created"
  | "pmo_policy_rollback_execution_started"
  | "pmo_policy_rollback_execution_completed"
  | "pmo_policy_rollback_execution_failed"
  | "pmo_policy_rollback_verification_created"
  | "pmo_policy_rollback_verification_completed"
  | "pmo_post_activation_monitoring_hook_created"
  | "pmo_policy_activation_export_created"
  | "pmo_policy_activation_request_archived"
  | "pmo_project_handoff_request_created"
  | "pmo_project_handoff_context_validation_created"
  | "pmo_project_handoff_context_validation_completed"
  | "pmo_project_handoff_gate_created"
  | "pmo_project_handoff_gate_decision_recorded"
  | "pmo_project_handoff_pack_created"
  | "pmo_project_memory_snapshot_created"
  | "pmo_project_status_snapshot_created"
  | "pmo_project_handoff_snapshot_item_created"
  | "pmo_project_stakeholder_context_snapshot_created"
  | "pmo_outgoing_pm_note_recorded"
  | "pmo_incoming_pm_acceptance_recorded"
  | "pmo_project_assignment_pointer_updated"
  | "pmo_project_assignment_history_recorded"
  | "pmo_project_handoff_continuity_check_created"
  | "pmo_project_handoff_continuity_check_completed"
  | "pmo_project_handoff_export_created"
  | "pmo_project_handoff_request_archived"
  | "pmo_runtime_hardening_run_created"
  | "pmo_runtime_hardening_run_started"
  | "pmo_runtime_hardening_run_completed"
  | "pmo_layer_integration_audit_recorded"
  | "pmo_route_contract_audit_recorded"
  | "pmo_database_contract_audit_recorded"
  | "pmo_rls_policy_audit_recorded"
  | "pmo_workspace_isolation_check_recorded"
  | "pmo_observability_coverage_check_recorded"
  | "pmo_export_safety_check_recorded"
  | "pmo_idempotency_check_recorded"
  | "pmo_error_handling_check_recorded"
  | "pmo_ui_dashboard_integration_check_recorded"
  | "pmo_ci_smoke_check_recorded"
  | "pmo_production_readiness_gate_created"
  | "pmo_production_readiness_decision_recorded"
  | "pmo_runtime_hardening_blocker_recorded"
  | "pmo_runtime_remediation_item_recorded"
  | "pmo_runtime_hardening_export_created"
  | "pmo_runtime_hardening_run_archived"
  | "beta_readiness_plan_created"
  | "beta_workspace_readiness_recorded"
  | "demo_data_bundle_created"
  | "demo_data_bundle_validated"
  | "demo_project_scenario_created"
  | "demo_governance_scenario_created"
  | "demo_handoff_scenario_created"
  | "beta_onboarding_checklist_created"
  | "beta_onboarding_checklist_item_recorded"
  | "beta_user_readiness_recorded"
  | "beta_invitation_readiness_recorded"
  | "beta_admin_readiness_recorded"
  | "tenant_readiness_validation_recorded"
  | "beta_readiness_gate_created"
  | "beta_readiness_decision_recorded"
  | "beta_readiness_blocker_recorded"
  | "beta_readiness_remediation_recorded"
  | "beta_readiness_export_created"
  | "beta_readiness_plan_archived";

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
  | "agent_controlled_execution_result_reconciliation_human_outcome_review"
  | "agent_controlled_execution_learning_signals_governance_feedback_loop"
  | "agent_controlled_pmo_governance_intelligence_dashboard"
  | "agent_pmo_governance_proposal_review_controlled_policy_change_backlog"
  | "agent_controlled_governance_policy_simulation_report_pmo_approval_pack"
  | "agent_controlled_policy_implementation_planning_workspace"
  | "agent_controlled_policy_implementation_gate_dry_run_change_executor"
  | "agent_controlled_policy_version_activation_rollback_gate"
  | "agent_controlled_project_intelligence_handoff"
  | "agent_end_to_end_governance_runtime_integration_production_hardening"
  | "agent_beta_onboarding_demo_data_tenant_readiness";

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
