// ─── Agent Execution Results & Evidence Layer — Types ─────────────────────────

export type AgentExecutionResultType =
  | "noop"
  | "simulation"
  | "draft_email"
  | "draft_task"
  | "draft_project_update"
  | "draft_report"
  | "structured_summary"
  | "risk_analysis"
  | "recommendation"
  | "governance_note"
  | "adapter_refusal"
  | "adapter_failure"
  | "execution_failure";

export type AgentExecutionResultStatus =
  | "created"
  | "ready_for_review"
  | "superseded"
  | "archived"
  | "discarded"
  | "failed";

export type AgentExecutionEvidenceType =
  | "execution_request"
  | "adapter_execution"
  | "approval"
  | "memory"
  | "audit_event"
  | "input_snapshot"
  | "output_snapshot"
  | "scope_reference"
  | "tool_reference"
  | "manual_note"
  | "artifact_metadata";

export type AgentExecutionEvidenceSource =
  | "agent_execution_runtime"
  | "agent_tool_adapter_layer"
  | "agent_memory_context"
  | "agent_observability"
  | "agent_approval"
  | "manual"
  | "system";

export type AgentExecutionConfidenceLevel =
  | "low"
  | "medium"
  | "high";

export type AgentExecutionResultReviewState =
  | "not_ready"
  | "ready"
  | "reviewed"
  | "rejected"
  | "accepted"
  | "needs_more_evidence";

export type AgentExecutionRetentionPolicy =
  | "standard"
  | "short_lived"
  | "long_lived"
  | "legal_hold"
  | "delete_eligible";

export type AgentExecutionResultArtifactType =
  | "inline_json"
  | "markdown"
  | "draft_email"
  | "draft_task"
  | "draft_report"
  | "risk_register_entry"
  | "governance_note"
  | "external_reference";

export type AgentExecutionResultRecord = {
  id: string;
  workspaceId: string;
  executionRequestId: string;
  adapterExecutionId: string | null;
  agentId: string | null;
  agentType: string | null;
  toolKey: string;
  adapterKey: string | null;
  executionMode: string;
  scopeType: string;
  scopeId: string | null;
  resultType: AgentExecutionResultType;
  resultStatus: AgentExecutionResultStatus;
  reviewState: AgentExecutionResultReviewState;
  title: string;
  summary: string | null;
  resultPayload: Record<string, unknown> | null;
  safeResultPayload: Record<string, unknown> | null;
  artifactType: AgentExecutionResultArtifactType;
  artifactMetadata: Record<string, unknown> | null;
  confidenceScore: number;
  confidenceLevel: AgentExecutionConfidenceLevel;
  confidenceReasons: string[];
  evidenceIds: string[];
  lineageRefs: string[];
  retentionPolicy: AgentExecutionRetentionPolicy;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionEvidenceRecord = {
  id: string;
  workspaceId: string;
  resultId: string | null;
  executionRequestId: string | null;
  adapterExecutionId: string | null;
  evidenceType: AgentExecutionEvidenceType;
  evidenceSource: AgentExecutionEvidenceSource;
  scopeType: string | null;
  scopeId: string | null;
  title: string;
  summary: string | null;
  evidencePayload: Record<string, unknown> | null;
  safeEvidencePayload: Record<string, unknown> | null;
  evidenceRef: string | null;
  evidenceHash: string | null;
  confidenceWeight: number;
  retentionPolicy: AgentExecutionRetentionPolicy;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionResultLineageRecord = {
  id: string;
  workspaceId: string;
  resultId: string;
  lineageType:
    | "execution_request"
    | "adapter_execution"
    | "evidence"
    | "approval"
    | "memory"
    | "audit"
    | "scope"
    | "artifact";
  lineageRef: string;
  lineagePayload: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentExecutionResultEventType =
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
  | "result_export_metadata_created";

export type AgentExecutionResultEventRecord = {
  id: string;
  workspaceId: string;
  resultId: string | null;
  evidenceId: string | null;
  eventType: AgentExecutionResultEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};

export type CreateAgentExecutionResultInput = {
  workspaceId: string;
  executionRequestId: string;
  adapterExecutionId?: string | null;
  agentId?: string | null;
  agentType?: string | null;
  toolKey: string;
  adapterKey?: string | null;
  executionMode: string;
  scopeType: string;
  scopeId?: string | null;
  resultType: AgentExecutionResultType;
  title: string;
  summary?: string | null;
  resultPayload?: Record<string, unknown> | null;
  artifactType?: AgentExecutionResultArtifactType;
  artifactMetadata?: Record<string, unknown> | null;
  evidenceIds?: string[];
  lineageRefs?: string[];
  retentionPolicy?: AgentExecutionRetentionPolicy;
  createdBy?: string | null;
};

export type CreateAgentExecutionEvidenceInput = {
  workspaceId: string;
  resultId?: string | null;
  executionRequestId?: string | null;
  adapterExecutionId?: string | null;
  evidenceType: AgentExecutionEvidenceType;
  evidenceSource: AgentExecutionEvidenceSource;
  scopeType?: string | null;
  scopeId?: string | null;
  title: string;
  summary?: string | null;
  evidencePayload?: Record<string, unknown> | null;
  evidenceRef?: string | null;
  confidenceWeight?: number;
  retentionPolicy?: AgentExecutionRetentionPolicy;
  createdBy?: string | null;
};

export type AgentExecutionConfidenceResult = {
  confidenceScore: number;
  confidenceLevel: AgentExecutionConfidenceLevel;
  confidenceReasons: string[];
};

export type AgentExecutionResultListFilters = {
  resultStatus?: AgentExecutionResultStatus;
  reviewState?: AgentExecutionResultReviewState;
  resultType?: AgentExecutionResultType;
  toolKey?: string;
  adapterKey?: string;
  executionRequestId?: string;
  adapterExecutionId?: string;
  scopeType?: string;
  scopeId?: string;
  confidenceLevel?: AgentExecutionConfidenceLevel;
  retentionPolicy?: AgentExecutionRetentionPolicy;
  limit?: number;
};
