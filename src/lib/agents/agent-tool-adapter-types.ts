// ─── Agent Tool Execution Adapter Layer — Types ───────────────────────────────

export type AgentToolAdapterExecutionMode = "dry_run" | "draft_only";

export type AgentToolAdapterStatus = "registered" | "enabled" | "disabled" | "deprecated";

export type AgentToolAdapterExecutionStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "refused"
  | "cancelled";

export type AgentToolAdapterOutputType =
  | "noop"
  | "simulation"
  | "draft_email"
  | "draft_task"
  | "draft_project_update"
  | "draft_report"
  | "recommendation"
  | "structured_summary"
  | "risk_analysis"
  | "governance_note";

export type AgentToolAdapterRiskPolicy =
  | "low_only"
  | "medium_or_lower"
  | "high_with_approval"
  | "critical_blocked";

export type AgentToolAdapterSideEffectPolicy =
  | "none"
  | "internal_draft_only"
  | "internal_record_only"
  | "external_disabled";

export type AgentToolAdapterDefinition = {
  adapterKey: string;
  displayName: string;
  description: string;
  status: AgentToolAdapterStatus;
  supportedToolKeys: string[];
  supportedExecutionModes: AgentToolAdapterExecutionMode[];
  supportedScopeTypes: string[];
  outputTypes: AgentToolAdapterOutputType[];
  riskPolicy: AgentToolAdapterRiskPolicy;
  sideEffectPolicy: AgentToolAdapterSideEffectPolicy;
  requiresApprovalByDefault: boolean;
  supportsDryRun: boolean;
  supportsDraftOnly: boolean;
  externalSideEffectsPossible: boolean;
  externalSideEffectsEnabled: boolean;
  version: string;
  owner: string | null;
  policyNotes: string[];
};

export type AgentToolAdapterRunInput = {
  workspaceId: string;
  executionRequestId: string;
  adapterKey?: string | null;
  actorId?: string | null;
  forceDryRun?: boolean;
};

export type AgentToolAdapterRunResult = {
  executionRequestId: string;
  adapterKey: string;
  toolKey: string;
  executionMode: AgentToolAdapterExecutionMode;
  status: AgentToolAdapterExecutionStatus;
  outputType: AgentToolAdapterOutputType;
  outputPayload: Record<string, unknown> | null;
  evidenceRefs: string[];
  warnings: string[];
  refusalReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string;
};

export type AgentToolAdapterEligibilityResult = {
  eligible: boolean;
  adapterKey: string | null;
  reasonCode:
    | "eligible"
    | "execution_request_not_found"
    | "execution_request_not_ready"
    | "unsupported_execution_mode"
    | "unsupported_tool_key"
    | "unsupported_scope_type"
    | "adapter_not_found"
    | "adapter_disabled"
    | "risk_policy_denied"
    | "approval_required"
    | "external_side_effects_disabled"
    | "payload_not_safe";
  message: string;
  checks: Array<{ key: string; passed: boolean; message: string }>;
};

export type AgentToolAdapterExecutionRecord = {
  id: string;
  workspaceId: string;
  executionRequestId: string;
  adapterKey: string;
  toolKey: string;
  executionMode: AgentToolAdapterExecutionMode;
  executionStatus: AgentToolAdapterExecutionStatus;
  outputType: AgentToolAdapterOutputType;
  inputSnapshot: Record<string, unknown> | null;
  safeInputSnapshot: Record<string, unknown> | null;
  outputPayload: Record<string, unknown> | null;
  evidenceRefs: string[];
  warnings: string[];
  refusalReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  actorId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentToolAdapterExecutionEventType =
  | "adapter_execution_created"
  | "adapter_eligibility_checked"
  | "adapter_execution_started"
  | "adapter_execution_succeeded"
  | "adapter_execution_failed"
  | "adapter_execution_refused"
  | "adapter_execution_cancelled";

export type AgentToolAdapterExecutionEventRecord = {
  id: string;
  workspaceId: string;
  adapterExecutionId: string;
  executionRequestId: string;
  eventType: AgentToolAdapterExecutionEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};
