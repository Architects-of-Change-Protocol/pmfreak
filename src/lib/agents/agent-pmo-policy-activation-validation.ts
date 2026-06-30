// ─── PMO Controlled Policy Version Activation & Rollback Gate — Validation ────
// Does NOT call LLMs, external APIs, or send communications.
// All functions are deterministic.

import type {
  AgentPmoPolicyActivationRequestStatus,
  AgentPmoPolicyActivationPreconditionStatus,
  AgentPmoPolicyActivationGateStatus,
  AgentPmoPolicyActivationGateDecisionType,
  AgentPmoControlledPolicyVersionStatus,
  AgentPmoPolicyActivationExecutionStatus,
  AgentPmoPolicyRollbackRequestStatus,
  AgentPmoPolicyRollbackGateStatus,
  AgentPmoPolicyRollbackGateDecisionType,
  AgentPmoPolicyRollbackExecutionStatus,
  AgentPmoPolicyRollbackVerificationStatus,
  AgentPmoPolicyActivationAuditEntryType,
  AgentPmoPostActivationMonitoringHookType,
  AgentPmoPostActivationMonitoringHookStatus,
  AgentPmoPolicyActivationExportFormat,
  AgentPmoPolicyActivationExportStatus,
  AgentPmoPolicyActivationEventType,
  CreateAgentPmoPolicyActivationRequestInput,
  CreateAgentPmoPolicyActivationGateInput,
  RecordAgentPmoPolicyActivationGateDecisionInput,
  ExecuteAgentPmoPolicyActivationInput,
  CreateAgentPmoPolicyRollbackRequestInput,
  CreateAgentPmoPolicyRollbackGateInput,
  RecordAgentPmoPolicyRollbackGateDecisionInput,
  ExecuteAgentPmoPolicyRollbackInput,
  GenerateAgentPmoPolicyActivationExportInput,
} from "./agent-pmo-policy-activation-types";

// ─── Enum Arrays ──────────────────────────────────────────────────────────────

const ACTIVATION_REQUEST_STATUSES: AgentPmoPolicyActivationRequestStatus[] = [
  "created", "preconditions_pending", "preconditions_failed",
  "ready_for_activation_review", "activation_review_required",
  "activation_approved", "activation_rejected", "activation_running",
  "activated", "activation_failed", "rollback_available",
  "rollback_requested", "rolled_back", "blocked", "archived",
];

const ACTIVATION_PRECONDITION_STATUSES: AgentPmoPolicyActivationPreconditionStatus[] = [
  "pending", "passed", "failed", "blocked", "waived",
];

const ACTIVATION_GATE_STATUSES: AgentPmoPolicyActivationGateStatus[] = [
  "created", "under_review", "approved_for_activation", "rejected",
  "changes_requested", "blocked", "archived",
];

const ACTIVATION_GATE_DECISION_TYPES: AgentPmoPolicyActivationGateDecisionType[] = [
  "approve_for_activation", "reject", "request_changes", "block", "archive",
];

const CONTROLLED_POLICY_VERSION_STATUSES: AgentPmoControlledPolicyVersionStatus[] = [
  "created", "ready_for_activation", "active", "superseded", "rolled_back",
  "blocked", "archived",
];

const ACTIVATION_EXECUTION_STATUSES: AgentPmoPolicyActivationExecutionStatus[] = [
  "created", "running", "completed", "failed", "blocked", "archived",
];

const ROLLBACK_REQUEST_STATUSES: AgentPmoPolicyRollbackRequestStatus[] = [
  "created", "rollback_review_required", "rollback_approved", "rollback_rejected",
  "rollback_running", "rolled_back", "rollback_failed", "verification_pending",
  "verified", "blocked", "archived",
];

const ROLLBACK_GATE_STATUSES: AgentPmoPolicyRollbackGateStatus[] = [
  "created", "under_review", "approved_for_rollback", "rejected",
  "changes_requested", "blocked", "archived",
];

const ROLLBACK_GATE_DECISION_TYPES: AgentPmoPolicyRollbackGateDecisionType[] = [
  "approve_for_rollback", "reject", "request_changes", "block", "archive",
];

const ROLLBACK_EXECUTION_STATUSES: AgentPmoPolicyRollbackExecutionStatus[] = [
  "created", "running", "completed", "failed", "blocked", "archived",
];

const ROLLBACK_VERIFICATION_STATUSES: AgentPmoPolicyRollbackVerificationStatus[] = [
  "created", "pending", "passed", "failed", "blocked", "waived", "archived",
];

const ACTIVATION_AUDIT_ENTRY_TYPES: AgentPmoPolicyActivationAuditEntryType[] = [
  "activation_request_created", "activation_preconditions_created",
  "activation_preconditions_completed", "activation_gate_created",
  "activation_gate_decision_recorded", "controlled_policy_version_created",
  "active_policy_pointer_updated", "activation_execution_created",
  "activation_execution_started", "activation_execution_completed",
  "activation_execution_failed", "rollback_request_created",
  "rollback_gate_created", "rollback_gate_decision_recorded",
  "rollback_execution_created", "rollback_execution_started",
  "rollback_execution_completed", "rollback_execution_failed",
  "rollback_verification_created", "rollback_verification_completed",
  "post_activation_monitoring_hook_created", "activation_export_created",
  "activation_request_archived",
];

const MONITORING_HOOK_TYPES: AgentPmoPostActivationMonitoringHookType[] = [
  "policy_behavior_monitor", "routing_effect_monitor", "scoring_effect_monitor",
  "evidence_requirement_monitor", "approval_gate_monitor", "dispatch_gate_monitor",
  "operator_workload_monitor", "rollback_readiness_monitor", "data_safety_monitor",
  "compliance_monitor",
];

const MONITORING_HOOK_STATUSES: AgentPmoPostActivationMonitoringHookStatus[] = [
  "created", "active", "paused", "completed", "blocked", "archived",
];

const ACTIVATION_EXPORT_FORMATS: AgentPmoPolicyActivationExportFormat[] = [
  "markdown", "json", "csv",
];

const ACTIVATION_EXPORT_STATUSES: AgentPmoPolicyActivationExportStatus[] = [
  "created", "generated", "failed", "downloaded", "archived",
];

const ACTIVATION_EVENT_TYPES: AgentPmoPolicyActivationEventType[] = [
  "activation_request_created", "activation_preconditions_created",
  "activation_preconditions_completed", "activation_gate_created",
  "activation_gate_decision_recorded", "controlled_policy_version_created",
  "active_policy_pointer_updated", "activation_execution_created",
  "activation_execution_started", "activation_execution_completed",
  "activation_execution_failed", "rollback_request_created",
  "rollback_gate_created", "rollback_gate_decision_recorded",
  "rollback_execution_created", "rollback_execution_started",
  "rollback_execution_completed", "rollback_execution_failed",
  "rollback_verification_created", "rollback_verification_completed",
  "post_activation_monitoring_hook_created", "activation_export_created",
  "activation_request_archived",
];

// ─── Blocked Keys ─────────────────────────────────────────────────────────────

const BLOCKED_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "private_key", "credential", "client_secret", "refresh_token", "access_token",
  "session_cookie", "cookie", "raw_payload", "payload", "outcomePayload",
  "safeOutcomePayload", "intendedSummary", "actualSummary", "rationale_from_learning",
  "failureMessage", "correctionReason", "customer", "client", "project_name",
  "email", "phone", "address",
]);

const FORBIDDEN_EXECUTABLE_PATTERNS = [
  "sendEmail", "sendSlack", "createJiraTicket", "createGithubIssue",
  "createCalendarEvent", "scheduleChangeWindow", "dispatchExecutionToAdapter",
  "executeAdapter", "runAdapter", "updateProject", "mutateProject",
  "runExternalApi", "callExternalApi", "callOpenAI", "callAnthropic",
  "callGemini", "createEmbedding", "trainModel", "fineTuneModel",
  "executeRollbackExternally", "externalRollback", "externalActivation",
];

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateAgentPmoPolicyActivationRequestStatus(s: string): boolean {
  return ACTIVATION_REQUEST_STATUSES.includes(s as AgentPmoPolicyActivationRequestStatus);
}

export function validateAgentPmoPolicyActivationPreconditionStatus(s: string): boolean {
  return ACTIVATION_PRECONDITION_STATUSES.includes(s as AgentPmoPolicyActivationPreconditionStatus);
}

export function validateAgentPmoPolicyActivationGateStatus(s: string): boolean {
  return ACTIVATION_GATE_STATUSES.includes(s as AgentPmoPolicyActivationGateStatus);
}

export function validateAgentPmoPolicyActivationGateDecisionType(s: string): boolean {
  return ACTIVATION_GATE_DECISION_TYPES.includes(s as AgentPmoPolicyActivationGateDecisionType);
}

export function validateAgentPmoControlledPolicyVersionStatus(s: string): boolean {
  return CONTROLLED_POLICY_VERSION_STATUSES.includes(s as AgentPmoControlledPolicyVersionStatus);
}

export function validateAgentPmoPolicyActivationExecutionStatus(s: string): boolean {
  return ACTIVATION_EXECUTION_STATUSES.includes(s as AgentPmoPolicyActivationExecutionStatus);
}

export function validateAgentPmoPolicyRollbackRequestStatus(s: string): boolean {
  return ROLLBACK_REQUEST_STATUSES.includes(s as AgentPmoPolicyRollbackRequestStatus);
}

export function validateAgentPmoPolicyRollbackGateStatus(s: string): boolean {
  return ROLLBACK_GATE_STATUSES.includes(s as AgentPmoPolicyRollbackGateStatus);
}

export function validateAgentPmoPolicyRollbackGateDecisionType(s: string): boolean {
  return ROLLBACK_GATE_DECISION_TYPES.includes(s as AgentPmoPolicyRollbackGateDecisionType);
}

export function validateAgentPmoPolicyRollbackExecutionStatus(s: string): boolean {
  return ROLLBACK_EXECUTION_STATUSES.includes(s as AgentPmoPolicyRollbackExecutionStatus);
}

export function validateAgentPmoPolicyRollbackVerificationStatus(s: string): boolean {
  return ROLLBACK_VERIFICATION_STATUSES.includes(s as AgentPmoPolicyRollbackVerificationStatus);
}

export function validateAgentPmoPolicyActivationAuditEntryType(s: string): boolean {
  return ACTIVATION_AUDIT_ENTRY_TYPES.includes(s as AgentPmoPolicyActivationAuditEntryType);
}

export function validateAgentPmoPostActivationMonitoringHookType(s: string): boolean {
  return MONITORING_HOOK_TYPES.includes(s as AgentPmoPostActivationMonitoringHookType);
}

export function validateAgentPmoPostActivationMonitoringHookStatus(s: string): boolean {
  return MONITORING_HOOK_STATUSES.includes(s as AgentPmoPostActivationMonitoringHookStatus);
}

export function validateAgentPmoPolicyActivationExportFormat(s: string): boolean {
  return ACTIVATION_EXPORT_FORMATS.includes(s as AgentPmoPolicyActivationExportFormat);
}

export function validateAgentPmoPolicyActivationExportStatus(s: string): boolean {
  return ACTIVATION_EXPORT_STATUSES.includes(s as AgentPmoPolicyActivationExportStatus);
}

export function validateAgentPmoPolicyActivationEventType(s: string): boolean {
  return ACTIVATION_EVENT_TYPES.includes(s as AgentPmoPolicyActivationEventType);
}

// ─── Payload Safety ───────────────────────────────────────────────────────────

export function assertPolicyActivationPayloadSerializable(payload: unknown): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
    if (serialized.length > 50 * 1024) {
      throw new Error("Policy activation payload exceeds 50KB limit");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("50KB")) throw err;
    throw new Error("Policy activation payload is not JSON-serializable");
  }
  for (const pattern of FORBIDDEN_EXECUTABLE_PATTERNS) {
    if (serialized.includes(pattern)) {
      throw new Error(`Policy activation payload contains forbidden executable semantic: ${pattern}`);
    }
  }
  if (typeof payload === "object" && payload !== null) {
    for (const key of Object.keys(payload as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      for (const blockedKey of BLOCKED_KEYS) {
        if (keyLower.includes(blockedKey.toLowerCase())) {
          throw new Error(`Policy activation payload contains blocked content pattern in key: ${key}`);
        }
      }
    }
  }
}

export function redactPolicyActivationPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    const kLower = k.toLowerCase();
    let blocked = false;
    for (const blockedKey of BLOCKED_KEYS) {
      if (kLower.includes(blockedKey.toLowerCase())) {
        blocked = true;
        break;
      }
    }
    if (!blocked) result[k] = v;
  }
  return result;
}

export function sanitizePolicyActivationText(text: string, maxLength: number): string {
  return text.trim().slice(0, maxLength);
}

export function dedupePolicyActivationStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeCreatePolicyActivationRequestInput(
  input: CreateAgentPmoPolicyActivationRequestInput,
): CreateAgentPmoPolicyActivationRequestInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.dryRunRequestId) throw new Error("dryRunRequestId is required");
  if (!input.requestReason || !input.requestReason.trim()) throw new Error("requestReason is required");
  return {
    ...input,
    requestReason: sanitizePolicyActivationText(input.requestReason, 2000),
  };
}

export function normalizeCreatePolicyActivationGateInput(
  input: CreateAgentPmoPolicyActivationGateInput,
): CreateAgentPmoPolicyActivationGateInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.activationRequestId) throw new Error("activationRequestId is required");
  return input;
}

export function normalizePolicyActivationGateDecisionInput(
  input: RecordAgentPmoPolicyActivationGateDecisionInput,
): RecordAgentPmoPolicyActivationGateDecisionInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.activationGateId) throw new Error("activationGateId is required");
  if (!input.activationRequestId) throw new Error("activationRequestId is required");
  if (!validateAgentPmoPolicyActivationGateDecisionType(input.decisionType)) {
    throw new Error(`Invalid decisionType: ${input.decisionType}`);
  }
  if (!input.rationale || !input.rationale.trim()) throw new Error("rationale is required");
  return {
    ...input,
    rationale: sanitizePolicyActivationText(input.rationale, 4000),
  };
}

export function normalizeExecutePolicyActivationInput(
  input: ExecuteAgentPmoPolicyActivationInput,
): ExecuteAgentPmoPolicyActivationInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.activationRequestId) throw new Error("activationRequestId is required");
  if (!input.controlledPolicyVersionId) throw new Error("controlledPolicyVersionId is required");
  if (!input.executionRationale || !input.executionRationale.trim()) throw new Error("executionRationale is required");
  return {
    ...input,
    executionRationale: sanitizePolicyActivationText(input.executionRationale, 4000),
  };
}

export function normalizeCreatePolicyRollbackRequestInput(
  input: CreateAgentPmoPolicyRollbackRequestInput,
): CreateAgentPmoPolicyRollbackRequestInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.activationRequestId) throw new Error("activationRequestId is required");
  if (!input.rollbackReason || !input.rollbackReason.trim()) throw new Error("rollbackReason is required");
  return {
    ...input,
    rollbackReason: sanitizePolicyActivationText(input.rollbackReason, 4000),
  };
}

export function normalizeCreatePolicyRollbackGateInput(
  input: CreateAgentPmoPolicyRollbackGateInput,
): CreateAgentPmoPolicyRollbackGateInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.rollbackRequestId) throw new Error("rollbackRequestId is required");
  return input;
}

export function normalizePolicyRollbackGateDecisionInput(
  input: RecordAgentPmoPolicyRollbackGateDecisionInput,
): RecordAgentPmoPolicyRollbackGateDecisionInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.rollbackGateId) throw new Error("rollbackGateId is required");
  if (!input.rollbackRequestId) throw new Error("rollbackRequestId is required");
  if (!validateAgentPmoPolicyRollbackGateDecisionType(input.decisionType)) {
    throw new Error(`Invalid decisionType: ${input.decisionType}`);
  }
  if (!input.rationale || !input.rationale.trim()) throw new Error("rationale is required");
  return {
    ...input,
    rationale: sanitizePolicyActivationText(input.rationale, 4000),
  };
}

export function normalizeExecutePolicyRollbackInput(
  input: ExecuteAgentPmoPolicyRollbackInput,
): ExecuteAgentPmoPolicyRollbackInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.rollbackRequestId) throw new Error("rollbackRequestId is required");
  if (!input.rollbackRationale || !input.rollbackRationale.trim()) throw new Error("rollbackRationale is required");
  return {
    ...input,
    rollbackRationale: sanitizePolicyActivationText(input.rollbackRationale, 4000),
  };
}

export function normalizePolicyActivationExportInput(
  input: GenerateAgentPmoPolicyActivationExportInput,
): GenerateAgentPmoPolicyActivationExportInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.activationRequestId) throw new Error("activationRequestId is required");
  if (!validateAgentPmoPolicyActivationExportFormat(input.exportFormat)) {
    throw new Error(`Invalid exportFormat: ${input.exportFormat}`);
  }
  return input;
}

// ─── Evaluation Functions ─────────────────────────────────────────────────────

export function evaluatePolicyActivationPreconditions(checks: {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  waived: number;
}): AgentPmoPolicyActivationPreconditionStatus {
  if (checks.blocked > 0) return "blocked";
  if (checks.failed > 0) return "failed";
  if (checks.passed + checks.waived === checks.total && checks.total > 0) return "passed";
  return "pending";
}

export function evaluatePolicyActivationGateReadiness(
  requestStatus: AgentPmoPolicyActivationRequestStatus,
): boolean {
  return requestStatus === "ready_for_activation_review";
}

export function evaluateRollbackReadiness(
  hasPreviousVersion: boolean,
  hasFallback: boolean,
  hasExplicitWaiver: boolean,
): boolean {
  return hasPreviousVersion || hasFallback || hasExplicitWaiver;
}

export function derivePolicyActivationRequestStatus(
  preconditionStatus: AgentPmoPolicyActivationPreconditionStatus | null,
  gateStatus: AgentPmoPolicyActivationGateStatus | null,
  executionStatus: AgentPmoPolicyActivationExecutionStatus | null,
): AgentPmoPolicyActivationRequestStatus {
  if (preconditionStatus === "blocked" || gateStatus === "blocked" || executionStatus === "blocked") {
    return "blocked";
  }
  if (executionStatus === "running") return "activation_running";
  if (executionStatus === "completed") return "activated";
  if (executionStatus === "failed") return "activation_failed";
  if (gateStatus === "approved_for_activation") return "activation_approved";
  if (gateStatus === "rejected") return "activation_rejected";
  if (gateStatus === "under_review" || gateStatus === "changes_requested") return "activation_review_required";
  if (preconditionStatus === "passed") return "ready_for_activation_review";
  if (preconditionStatus === "failed") return "preconditions_failed";
  if (preconditionStatus === "pending") return "preconditions_pending";
  return "created";
}

export function derivePolicyRollbackRequestStatus(
  gateStatus: AgentPmoPolicyRollbackGateStatus | null,
  executionStatus: AgentPmoPolicyRollbackExecutionStatus | null,
): AgentPmoPolicyRollbackRequestStatus {
  if (gateStatus === "blocked" || executionStatus === "blocked") return "blocked";
  if (executionStatus === "running") return "rollback_running";
  if (executionStatus === "completed") return "verification_pending";
  if (executionStatus === "failed") return "rollback_failed";
  if (gateStatus === "approved_for_rollback") return "rollback_approved";
  if (gateStatus === "rejected") return "rollback_rejected";
  return "rollback_review_required";
}

export function validatePolicyActivationExportSafety(
  content: string,
): { safe: boolean; blockedPatterns: string[] } {
  const blockedPatterns: string[] = [];
  for (const key of BLOCKED_KEYS) {
    if (content.includes(`"${key}"`) || content.includes(`${key}:`)) {
      blockedPatterns.push(key);
    }
  }
  for (const pattern of FORBIDDEN_EXECUTABLE_PATTERNS) {
    if (content.includes(pattern)) {
      blockedPatterns.push(pattern);
    }
  }
  return { safe: blockedPatterns.length === 0, blockedPatterns };
}
