// ─── Agent Execution Request Runtime — Types ───────────────────────────────────

export type AgentExecutionMode =
  | "dry_run"
  | "draft_only"
  | "approval_required"
  | "approved_execution";

export type AgentExecutionState =
  | "draft"
  | "pending_preflight"
  | "preflight_failed"
  | "blocked"
  | "pending_approval"
  | "approved"
  | "ready_for_execution"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export type AgentExecutionRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AgentExecutionScopeType =
  | "workspace"
  | "portfolio"
  | "project"
  | "pm"
  | "agent"
  | "tool_request"
  | "approval_request"
  | "memory_record";

export type AgentExecutionSourceType =
  | "api"
  | "agent"
  | "scheduler"
  | "webhook"
  | "system"
  | "user";

export type AgentExecutionEventType =
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
  | "execution_state_transition";

export type AgentExecutionPreflightStatus =
  | "not_started"
  | "in_progress"
  | "passed"
  | "failed"
  | "skipped";

export type AgentExecutionRequestRecord = {
  id: string;
  workspaceId: string;
  correlationId: string | null;
  agentId: string | null;
  agentType: string | null;
  toolKey: string;
  executionMode: AgentExecutionMode;
  executionState: AgentExecutionState;
  riskLevel: AgentExecutionRiskLevel;
  scopeType: AgentExecutionScopeType;
  scopeId: string | null;
  sourceType: AgentExecutionSourceType;
  sourceId: string | null;
  title: string;
  description: string | null;
  inputPayload: Record<string, unknown> | null;
  safeInputPayload: Record<string, unknown> | null;
  preflightStatus: AgentExecutionPreflightStatus;
  preflightResult: Record<string, unknown> | null;
  requiresApproval: boolean;
  approvalRequestId: string | null;
  memoryIds: string[];
  evidenceRefs: string[];
  resultPayload: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionEventRecord = {
  id: string;
  workspaceId: string;
  executionRequestId: string;
  eventType: AgentExecutionEventType;
  fromState: AgentExecutionState | null;
  toState: AgentExecutionState | null;
  actorId: string | null;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  createdAt: string;
};

export type CreateAgentExecutionRequestInput = {
  workspaceId: string;
  correlationId?: string | null;
  agentId?: string | null;
  agentType?: string | null;
  toolKey: string;
  executionMode: AgentExecutionMode;
  riskLevel?: AgentExecutionRiskLevel;
  scopeType: AgentExecutionScopeType;
  scopeId?: string | null;
  sourceType: AgentExecutionSourceType;
  sourceId?: string | null;
  title: string;
  description?: string | null;
  inputPayload?: Record<string, unknown> | null;
  memoryIds?: string[];
  evidenceRefs?: string[];
  requestedBy?: string | null;
  expiresAt?: string | null;
};

export type AgentExecutionListFilters = {
  executionState?: AgentExecutionState;
  executionMode?: AgentExecutionMode;
  riskLevel?: AgentExecutionRiskLevel;
  scopeType?: AgentExecutionScopeType;
  scopeId?: string;
  agentId?: string;
  agentType?: string;
  toolKey?: string;
  requestedBy?: string;
  limit?: number;
};

export type AgentExecutionPreflightResult = {
  status: AgentExecutionPreflightStatus;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string | null;
  }>;
  requiresApproval: boolean;
  nextState: AgentExecutionState;
  message: string | null;
};

export type AgentExecutionTransitionInput = {
  workspaceId: string;
  executionRequestId: string;
  toState: AgentExecutionState;
  actorId?: string | null;
  message?: string | null;
  eventType?: AgentExecutionEventType;
  eventPayload?: Record<string, unknown> | null;
};

export type CompleteAgentExecutionInput = {
  workspaceId: string;
  executionRequestId: string;
  resultPayload?: Record<string, unknown> | null;
  actorId?: string | null;
  message?: string | null;
};

export type FailAgentExecutionInput = {
  workspaceId: string;
  executionRequestId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  actorId?: string | null;
  message?: string | null;
};
