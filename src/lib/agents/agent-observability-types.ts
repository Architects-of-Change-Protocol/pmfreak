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
  | "system";

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
  | "audit_export_created";

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
  | "pmo_governance"
  | "pmo_command_center"
  | "executive_reporting"
  | "system"
  | "api";

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
