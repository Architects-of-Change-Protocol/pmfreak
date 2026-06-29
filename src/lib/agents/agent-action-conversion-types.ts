// ─── Agent Controlled Action Conversion & Approval Bridge — Types ──────────────
// Does NOT call LLMs, external APIs, or send communications.

export type AgentActionConversionStatus =
  | "created"
  | "preflight_pending"
  | "preflight_passed"
  | "preflight_failed"
  | "approval_required"
  | "approval_not_required"
  | "approval_pending"
  | "approval_satisfied"
  | "execution_request_created"
  | "blocked"
  | "cancelled"
  | "completed";

export type AgentActionConversionReadiness =
  | "not_ready"
  | "ready"
  | "blocked"
  | "requires_approval"
  | "converted";

export type AgentActionConversionRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AgentActionConversionPreflightStatus =
  | "not_run"
  | "running"
  | "passed"
  | "failed"
  | "warning";

export type AgentActionConversionPreflightCheckType =
  | "action_draft_exists"
  | "review_item_exists"
  | "review_item_accepted"
  | "review_decision_exists"
  | "action_draft_convertible"
  | "action_draft_not_converted"
  | "source_result_linked"
  | "source_evidence_linked"
  | "target_scope_known"
  | "safe_payload_present"
  | "risk_level_known"
  | "owner_or_role_known"
  | "approval_requirement_evaluated"
  | "tool_mapping_exists"
  | "execution_mode_safe"
  | "no_external_side_effects";

export type AgentActionApprovalRequirement =
  | "not_required"
  | "required"
  | "required_high_risk"
  | "required_critical_risk"
  | "required_external_side_effect"
  | "required_policy";

export type AgentActionApprovalBridgeStatus =
  | "not_required"
  | "required"
  | "pending"
  | "satisfied"
  | "rejected"
  | "cancelled"
  | "expired";

export type AgentActionExecutionRequestCreationStatus =
  | "not_started"
  | "ready"
  | "created"
  | "failed"
  | "blocked";

export type AgentActionConversionEventType =
  | "conversion_created"
  | "preflight_started"
  | "preflight_passed"
  | "preflight_failed"
  | "approval_requirement_evaluated"
  | "approval_required"
  | "approval_not_required"
  | "approval_bridge_created"
  | "approval_satisfied"
  | "execution_request_created"
  | "conversion_blocked"
  | "conversion_cancelled"
  | "conversion_completed";

export type AgentActionDraftToExecutionMapping = {
  actionType: string;
  toolKey: string;
  adapterKey: string | null;
  executionMode: "dry_run" | "draft_only" | "approval_required";
  requiresApproval: boolean;
  defaultScopeType: string | null;
  description: string;
};

export type AgentActionConversionRecord = {
  id: string;
  workspaceId: string;
  actionDraftId: string;
  reviewItemId: string | null;
  reviewDecisionId: string | null;
  sourceResultId: string | null;
  sourceEvidenceId: string | null;
  executionRequestId: string | null;
  approvalBridgeId: string | null;
  actionType: string;
  status: AgentActionConversionStatus;
  readiness: AgentActionConversionReadiness;
  riskLevel: AgentActionConversionRiskLevel;
  targetScopeType: string | null;
  targetScopeId: string | null;
  ownerId: string | null;
  ownerRole: string | null;
  approvalRequirement: AgentActionApprovalRequirement;
  executionRequestCreationStatus: AgentActionExecutionRequestCreationStatus;
  blockingReasons: string[];
  warnings: string[];
  conversionPayload: Record<string, unknown> | null;
  safeConversionPayload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentActionConversionPreflightRecord = {
  id: string;
  workspaceId: string;
  conversionId: string;
  status: AgentActionConversionPreflightStatus;
  readinessScore: number;
  checks: AgentActionConversionPreflightCheckResult[];
  blockingReasons: string[];
  warnings: string[];
  approvalRequired: boolean;
  approvalRequirement: AgentActionApprovalRequirement;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentActionConversionPreflightCheckResult = {
  checkType: AgentActionConversionPreflightCheckType;
  passed: boolean;
  severity: "info" | "warning" | "blocking";
  message: string;
  metadata?: Record<string, unknown>;
};

export type AgentActionApprovalBridgeRecord = {
  id: string;
  workspaceId: string;
  conversionId: string;
  actionDraftId: string;
  approvalRequirement: AgentActionApprovalRequirement;
  status: AgentActionApprovalBridgeStatus;
  approvalPolicyKey: string | null;
  requiredApproverRole: string | null;
  requiredApproverUserId: string | null;
  approvalRequestId: string | null;
  approvalReason: string;
  riskJustification: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentActionConversionEventRecord = {
  id: string;
  workspaceId: string;
  conversionId: string | null;
  actionDraftId: string | null;
  approvalBridgeId: string | null;
  executionRequestId: string | null;
  eventType: AgentActionConversionEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};

export type CreateAgentActionConversionInput = {
  workspaceId: string;
  actionDraftId: string;
  ownerId?: string | null;
  ownerRole?: string | null;
  createdBy?: string | null;
};

export type RunAgentActionConversionPreflightInput = {
  workspaceId: string;
  conversionId: string;
  actorId?: string | null;
};

export type CreateAgentActionApprovalBridgeInput = {
  workspaceId: string;
  conversionId: string;
  approvalRequirement: AgentActionApprovalRequirement;
  approvalPolicyKey?: string | null;
  requiredApproverRole?: string | null;
  requiredApproverUserId?: string | null;
  approvalRequestId?: string | null;
  approvalReason: string;
  riskJustification?: string | null;
  createdBy?: string | null;
};

export type CreateExecutionRequestFromActionDraftInput = {
  workspaceId: string;
  conversionId: string;
  actorId?: string | null;
};

export type AgentActionConversionListFilters = {
  status?: AgentActionConversionStatus;
  readiness?: AgentActionConversionReadiness;
  actionDraftId?: string;
  reviewItemId?: string;
  sourceResultId?: string;
  executionRequestId?: string;
  approvalRequirement?: AgentActionApprovalRequirement;
  riskLevel?: AgentActionConversionRiskLevel;
  ownerId?: string;
  ownerRole?: string;
  limit?: number;
};
