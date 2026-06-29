// ─── Controlled Execution Finalization & Adapter Dispatch Gate — Types ─────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Only finalizes governed execution requests and dispatches to safe deterministic adapters
// in dry-run or draft-only modes when readiness, approval, confirmation, lock, and idempotency checks pass.

export type AgentExecutionFinalizationStatus =
  | "created"
  | "readiness_pending"
  | "readiness_passed"
  | "readiness_failed"
  | "confirmation_required"
  | "confirmation_satisfied"
  | "dispatch_ready"
  | "dispatch_blocked"
  | "dispatch_started"
  | "dispatch_succeeded"
  | "dispatch_failed"
  | "result_reconciled"
  | "cancelled"
  | "completed";

export type AgentExecutionDispatchReadiness =
  | "not_ready"
  | "ready"
  | "blocked"
  | "requires_confirmation"
  | "dispatching"
  | "dispatched"
  | "reconciled";

export type AgentExecutionDispatchGateStatus =
  | "created"
  | "allowed"
  | "blocked"
  | "confirmation_required"
  | "locked"
  | "idempotent_replay"
  | "dispatching"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentExecutionLockStatus =
  | "available"
  | "acquired"
  | "released"
  | "expired"
  | "blocked";

export type AgentExecutionIdempotencyStatus =
  | "new"
  | "in_progress"
  | "completed"
  | "replayed"
  | "conflict"
  | "failed";

export type AgentExecutionDispatchAttemptStatus =
  | "created"
  | "started"
  | "adapter_succeeded"
  | "adapter_failed"
  | "result_reconciled"
  | "blocked"
  | "cancelled";

export type AgentExecutionFinalConfirmationRequirement =
  | "not_required"
  | "required"
  | "required_high_risk"
  | "required_critical_risk"
  | "required_side_effect_potential"
  | "required_policy";

export type AgentExecutionFinalConfirmationStatus =
  | "not_required"
  | "required"
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "cancelled";

export type AgentExecutionSideEffectMode =
  | "none"
  | "draft_only"
  | "dry_run"
  | "side_effect_potential"
  | "side_effect_blocked";

export type AgentExecutionDispatchEventType =
  | "finalization_created"
  | "readiness_checked"
  | "readiness_passed"
  | "readiness_failed"
  | "approval_verified"
  | "final_confirmation_required"
  | "final_confirmation_recorded"
  | "lock_acquired"
  | "lock_released"
  | "idempotency_checked"
  | "dispatch_gate_created"
  | "dispatch_allowed"
  | "dispatch_blocked"
  | "adapter_selected"
  | "adapter_dispatch_started"
  | "adapter_dispatch_succeeded"
  | "adapter_dispatch_failed"
  | "result_reconciled"
  | "dispatch_completed"
  | "dispatch_cancelled";

export type AgentExecutionDispatchCheckType =
  | "execution_request_exists"
  | "workspace_matches"
  | "execution_request_dispatchable"
  | "execution_mode_safe"
  | "approval_ready"
  | "approval_bridge_satisfied"
  | "conversion_linkage_valid"
  | "adapter_mapping_exists"
  | "adapter_eligible"
  | "side_effect_mode_allowed"
  | "final_confirmation_satisfied"
  | "execution_lock_available"
  | "idempotency_key_valid"
  | "no_prior_successful_dispatch"
  | "payload_safe"
  | "scope_known"
  | "risk_level_known";

export type AgentExecutionDispatchCheckResult = {
  checkType: AgentExecutionDispatchCheckType;
  passed: boolean;
  severity: "info" | "warning" | "blocking";
  message: string;
  metadata?: Record<string, unknown>;
};

export type AgentExecutionFinalizationRecord = {
  id: string;
  workspaceId: string;
  executionRequestId: string;
  actionConversionId: string | null;
  actionDraftId: string | null;
  reviewItemId: string | null;
  sourceResultId: string | null;
  sourceEvidenceId: string | null;
  status: AgentExecutionFinalizationStatus;
  readiness: AgentExecutionDispatchReadiness;
  executionMode: "dry_run" | "draft_only" | "approval_required" | string;
  riskLevel: "low" | "medium" | "high" | "critical";
  selectedToolKey: string | null;
  selectedAdapterKey: string | null;
  sideEffectMode: AgentExecutionSideEffectMode;
  confirmationRequirement: AgentExecutionFinalConfirmationRequirement;
  confirmationStatus: AgentExecutionFinalConfirmationStatus;
  approvalVerified: boolean;
  lockStatus: AgentExecutionLockStatus;
  idempotencyStatus: AgentExecutionIdempotencyStatus;
  dispatchGateId: string | null;
  latestDispatchAttemptId: string | null;
  adapterExecutionId: string | null;
  resultId: string | null;
  evidenceIds: string[];
  blockingReasons: string[];
  warnings: string[];
  finalizationPayload: Record<string, unknown> | null;
  safeFinalizationPayload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionDispatchGateRecord = {
  id: string;
  workspaceId: string;
  finalizationId: string;
  executionRequestId: string;
  status: AgentExecutionDispatchGateStatus;
  selectedToolKey: string | null;
  selectedAdapterKey: string | null;
  executionMode: string;
  sideEffectMode: AgentExecutionSideEffectMode;
  dispatchAllowed: boolean;
  requiresFinalConfirmation: boolean;
  confirmationStatus: AgentExecutionFinalConfirmationStatus;
  lockId: string | null;
  idempotencyId: string | null;
  blockingReasons: string[];
  warnings: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionDispatchLockRecord = {
  id: string;
  workspaceId: string;
  executionRequestId: string;
  finalizationId: string | null;
  lockKey: string;
  status: AgentExecutionLockStatus;
  acquiredBy: string | null;
  acquiredAt: string | null;
  expiresAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionDispatchIdempotencyRecord = {
  id: string;
  workspaceId: string;
  executionRequestId: string;
  finalizationId: string | null;
  idempotencyKey: string;
  idempotencyFingerprint: string;
  status: AgentExecutionIdempotencyStatus;
  firstDispatchAttemptId: string | null;
  latestDispatchAttemptId: string | null;
  resultId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionDispatchAttemptRecord = {
  id: string;
  workspaceId: string;
  finalizationId: string;
  dispatchGateId: string | null;
  executionRequestId: string;
  adapterKey: string | null;
  toolKey: string | null;
  executionMode: string;
  status: AgentExecutionDispatchAttemptStatus;
  attemptNumber: number;
  startedAt: string | null;
  completedAt: string | null;
  adapterExecutionId: string | null;
  resultId: string | null;
  evidenceIds: string[];
  errorMessage: string | null;
  blockingReasons: string[];
  warnings: string[];
  actorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionFinalConfirmationRecord = {
  id: string;
  workspaceId: string;
  finalizationId: string;
  executionRequestId: string;
  requirement: AgentExecutionFinalConfirmationRequirement;
  status: AgentExecutionFinalConfirmationStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionDispatchEventRecord = {
  id: string;
  workspaceId: string;
  finalizationId: string | null;
  dispatchGateId: string | null;
  dispatchAttemptId: string | null;
  executionRequestId: string | null;
  adapterExecutionId: string | null;
  resultId: string | null;
  eventType: AgentExecutionDispatchEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};

export type CreateAgentExecutionFinalizationInput = {
  workspaceId: string;
  executionRequestId: string;
  actionConversionId?: string | null;
  createdBy?: string | null;
};

export type RunAgentExecutionDispatchReadinessInput = {
  workspaceId: string;
  finalizationId: string;
  actorId?: string | null;
};

export type CreateAgentExecutionDispatchGateInput = {
  workspaceId: string;
  finalizationId: string;
  actorId?: string | null;
};

export type ConfirmAgentExecutionDispatchInput = {
  workspaceId: string;
  finalizationId: string;
  rationale: string;
  actorId?: string | null;
};

export type DispatchAgentExecutionInput = {
  workspaceId: string;
  finalizationId: string;
  idempotencyKey?: string | null;
  actorId?: string | null;
};

export type AgentExecutionFinalizationListFilters = {
  status?: AgentExecutionFinalizationStatus;
  readiness?: AgentExecutionDispatchReadiness;
  executionRequestId?: string;
  actionConversionId?: string;
  selectedAdapterKey?: string;
  selectedToolKey?: string;
  confirmationStatus?: AgentExecutionFinalConfirmationStatus;
  lockStatus?: AgentExecutionLockStatus;
  idempotencyStatus?: AgentExecutionIdempotencyStatus;
  riskLevel?: "low" | "medium" | "high" | "critical";
  limit?: number;
};
