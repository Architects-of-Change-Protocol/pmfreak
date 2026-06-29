// ─── PMO Governance Proposal Review & Controlled Policy Change Backlog — Validation
// Does NOT call LLMs, external APIs, or send communications.
// All functions are deterministic.

import type {
  AgentPmoPolicyBacklogItemStatus,
  AgentPmoPolicyBacklogItemType,
  AgentPmoPolicyBacklogPriority,
  AgentPmoPolicyChangeRequestStatus,
  AgentPmoPolicyChangeScopeType,
  AgentPmoPolicySimulationStatus,
  AgentPmoPolicyImpactLevel,
  AgentPmoGovernancePolicyDraftType,
  AgentPmoGovernancePolicyDraftStatus,
  AgentPmoPolicyApprovalStage,
  AgentPmoPolicyApprovalStatus,
  AgentPmoPolicyApprovalDecisionType,
  AgentPmoPolicyImplementationReadinessStatus,
  AgentPmoPolicyRollbackPlanType,
  AgentPmoPolicyRollbackPlanStatus,
  AgentPmoPolicyBacklogEventType,
  CreatePolicyBacklogItemInput,
  CreatePolicyChangeRequestInput,
  PolicyApprovalDecisionInput,
} from "./agent-pmo-policy-backlog-types";

// ─── Enum Arrays ──────────────────────────────────────────────────────────────

const POLICY_BACKLOG_ITEM_STATUSES: AgentPmoPolicyBacklogItemStatus[] = [
  "created", "open", "analysis", "simulation_ready", "simulation_completed",
  "approval_ready", "approved_for_future_implementation", "rejected", "archived",
];

const POLICY_BACKLOG_ITEM_TYPES: AgentPmoPolicyBacklogItemType[] = [
  "risk_policy", "evidence_requirement", "adapter_quality_review", "review_routing",
  "human_review_policy", "triage_policy", "approval_policy", "governance_process",
];

const POLICY_BACKLOG_PRIORITIES: AgentPmoPolicyBacklogPriority[] = [
  "low", "normal", "high", "urgent",
];

const POLICY_CHANGE_REQUEST_STATUSES: AgentPmoPolicyChangeRequestStatus[] = [
  "draft", "open", "simulation_pending", "simulation_completed", "approval_pending",
  "approved", "rejected", "deferred", "archived",
];

const POLICY_CHANGE_SCOPE_TYPES: AgentPmoPolicyChangeScopeType[] = [
  "risk_scoring", "evidence_requirements", "human_review_policy", "review_routing",
  "triage_policy", "adapter_governance", "dispatch_gate_policy", "approval_policy",
  "governance_reporting",
];

const POLICY_SIMULATION_STATUSES: AgentPmoPolicySimulationStatus[] = [
  "created", "running", "completed", "failed", "cancelled",
];

const POLICY_IMPACT_LEVELS: AgentPmoPolicyImpactLevel[] = [
  "none", "low", "medium", "high", "critical",
];

const GOVERNANCE_POLICY_DRAFT_TYPES: AgentPmoGovernancePolicyDraftType[] = [
  "risk_policy_draft", "evidence_requirement_draft", "review_routing_draft",
  "human_review_policy_draft", "triage_policy_draft", "adapter_governance_draft",
  "approval_policy_draft",
];

const GOVERNANCE_POLICY_DRAFT_STATUSES: AgentPmoGovernancePolicyDraftStatus[] = [
  "created", "open", "under_review", "approved_for_future_implementation", "rejected", "archived",
];

const POLICY_APPROVAL_STAGES: AgentPmoPolicyApprovalStage[] = [
  "pmo_review", "security_review", "operations_review", "executive_review",
  "data_governance_review", "final_pmo_approval",
];

const POLICY_APPROVAL_STATUSES: AgentPmoPolicyApprovalStatus[] = [
  "not_started", "pending", "approved", "rejected", "changes_requested", "skipped", "cancelled",
];

const POLICY_APPROVAL_DECISION_TYPES: AgentPmoPolicyApprovalDecisionType[] = [
  "approve", "reject", "request_changes", "skip", "cancel",
];

const POLICY_IMPLEMENTATION_READINESS_STATUSES: AgentPmoPolicyImplementationReadinessStatus[] = [
  "not_ready", "simulation_required", "approval_required", "rollback_required",
  "ready_for_future_implementation", "blocked",
];

const POLICY_ROLLBACK_PLAN_TYPES: AgentPmoPolicyRollbackPlanType[] = [
  "manual_rollback", "version_revert", "policy_disable", "routing_restore",
  "scoring_restore", "evidence_requirement_restore",
];

const POLICY_ROLLBACK_PLAN_STATUSES: AgentPmoPolicyRollbackPlanStatus[] = [
  "created", "open", "reviewed", "approved", "rejected", "archived",
];

const POLICY_BACKLOG_EVENT_TYPES: AgentPmoPolicyBacklogEventType[] = [
  "policy_backlog_item_created", "policy_change_request_created", "policy_change_scope_created",
  "policy_simulation_created", "policy_simulation_completed", "policy_impact_preview_created",
  "policy_draft_created", "policy_approval_workflow_created", "policy_approval_decision_recorded",
  "policy_rollback_plan_created", "policy_implementation_readiness_evaluated",
  "policy_change_request_archived",
];

// ─── Blocked Field Names ──────────────────────────────────────────────────────

const BLOCKED_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token", "session_cookie", "cookie",
  "raw_payload", "payload", "outcomePayload", "safeOutcomePayload",
  "intendedSummary", "actualSummary", "rationale_from_learning", "failureMessage",
  "correctionReason", "customer", "client", "project_name",
  "email", "phone", "address",
]);

const BLOCKED_TERMS = [
  "raw_payload", "outcomePayload", "safeOutcomePayload",
  "intendedSummary", "actualSummary", "failureMessage", "correctionReason",
  "rationale_from_learning",
];

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateAgentPmoPolicyBacklogItemStatus(v: unknown): v is AgentPmoPolicyBacklogItemStatus {
  return POLICY_BACKLOG_ITEM_STATUSES.includes(v as AgentPmoPolicyBacklogItemStatus);
}

export function validateAgentPmoPolicyBacklogItemType(v: unknown): v is AgentPmoPolicyBacklogItemType {
  return POLICY_BACKLOG_ITEM_TYPES.includes(v as AgentPmoPolicyBacklogItemType);
}

export function validateAgentPmoPolicyBacklogPriority(v: unknown): v is AgentPmoPolicyBacklogPriority {
  return POLICY_BACKLOG_PRIORITIES.includes(v as AgentPmoPolicyBacklogPriority);
}

export function validateAgentPmoPolicyChangeRequestStatus(v: unknown): v is AgentPmoPolicyChangeRequestStatus {
  return POLICY_CHANGE_REQUEST_STATUSES.includes(v as AgentPmoPolicyChangeRequestStatus);
}

export function validateAgentPmoPolicyChangeScopeType(v: unknown): v is AgentPmoPolicyChangeScopeType {
  return POLICY_CHANGE_SCOPE_TYPES.includes(v as AgentPmoPolicyChangeScopeType);
}

export function validateAgentPmoPolicySimulationStatus(v: unknown): v is AgentPmoPolicySimulationStatus {
  return POLICY_SIMULATION_STATUSES.includes(v as AgentPmoPolicySimulationStatus);
}

export function validateAgentPmoPolicyImpactLevel(v: unknown): v is AgentPmoPolicyImpactLevel {
  return POLICY_IMPACT_LEVELS.includes(v as AgentPmoPolicyImpactLevel);
}

export function validateAgentPmoGovernancePolicyDraftType(v: unknown): v is AgentPmoGovernancePolicyDraftType {
  return GOVERNANCE_POLICY_DRAFT_TYPES.includes(v as AgentPmoGovernancePolicyDraftType);
}

export function validateAgentPmoGovernancePolicyDraftStatus(v: unknown): v is AgentPmoGovernancePolicyDraftStatus {
  return GOVERNANCE_POLICY_DRAFT_STATUSES.includes(v as AgentPmoGovernancePolicyDraftStatus);
}

export function validateAgentPmoPolicyApprovalStage(v: unknown): v is AgentPmoPolicyApprovalStage {
  return POLICY_APPROVAL_STAGES.includes(v as AgentPmoPolicyApprovalStage);
}

export function validateAgentPmoPolicyApprovalStatus(v: unknown): v is AgentPmoPolicyApprovalStatus {
  return POLICY_APPROVAL_STATUSES.includes(v as AgentPmoPolicyApprovalStatus);
}

export function validateAgentPmoPolicyApprovalDecisionType(v: unknown): v is AgentPmoPolicyApprovalDecisionType {
  return POLICY_APPROVAL_DECISION_TYPES.includes(v as AgentPmoPolicyApprovalDecisionType);
}

export function validateAgentPmoPolicyImplementationReadinessStatus(v: unknown): v is AgentPmoPolicyImplementationReadinessStatus {
  return POLICY_IMPLEMENTATION_READINESS_STATUSES.includes(v as AgentPmoPolicyImplementationReadinessStatus);
}

export function validateAgentPmoPolicyRollbackPlanType(v: unknown): v is AgentPmoPolicyRollbackPlanType {
  return POLICY_ROLLBACK_PLAN_TYPES.includes(v as AgentPmoPolicyRollbackPlanType);
}

export function validateAgentPmoPolicyRollbackPlanStatus(v: unknown): v is AgentPmoPolicyRollbackPlanStatus {
  return POLICY_ROLLBACK_PLAN_STATUSES.includes(v as AgentPmoPolicyRollbackPlanStatus);
}

export function validateAgentPmoPolicyBacklogEventType(v: unknown): v is AgentPmoPolicyBacklogEventType {
  return POLICY_BACKLOG_EVENT_TYPES.includes(v as AgentPmoPolicyBacklogEventType);
}

// ─── Payload Serialization ────────────────────────────────────────────────────

export function assertPolicyBacklogPayloadSerializable(value: unknown): void {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 20 * 1024) {
      throw new Error("Policy backlog payload exceeds 20KB limit");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("20KB")) throw e;
    throw new Error("Policy backlog payload is not JSON-serializable");
  }
}

// ─── Redaction ────────────────────────────────────────────────────────────────

export function redactPolicyBacklogPayload(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (value === null) return null;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!BLOCKED_KEYS.has(k)) {
      result[k] = v;
    }
  }
  return result;
}

// ─── Text Sanitization ────────────────────────────────────────────────────────

export function sanitizePolicyBacklogText(value: string, maxLength = 240): string {
  return value.slice(0, maxLength);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export function dedupePolicyBacklogStrings(values: string[]): string[] {
  return [...new Set(values)];
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeCreatePolicyBacklogItemInput(
  input: CreatePolicyBacklogItemInput,
): CreatePolicyBacklogItemInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.itemType) throw new Error("itemType is required");
  if (!input.title) throw new Error("title is required");
  if (!input.description) throw new Error("description is required");
  return {
    ...input,
    title: sanitizePolicyBacklogText(input.title, 240),
    description: sanitizePolicyBacklogText(input.description, 2000),
    priority: input.priority ?? "normal",
    sourceFeedbackIds: dedupePolicyBacklogStrings(input.sourceFeedbackIds ?? []),
    sourceSignalIds: dedupePolicyBacklogStrings(input.sourceSignalIds ?? []),
    relatedAdapterKeys: dedupePolicyBacklogStrings(input.relatedAdapterKeys ?? []),
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeCreatePolicyChangeRequestInput(
  input: CreatePolicyChangeRequestInput,
): CreatePolicyChangeRequestInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.backlogItemId) throw new Error("backlogItemId is required");
  if (!input.policyArea) throw new Error("policyArea is required");
  if (!input.changeSummary) throw new Error("changeSummary is required");
  if (!input.changeRationale) throw new Error("changeRationale is required");
  return {
    ...input,
    changeSummary: sanitizePolicyBacklogText(input.changeSummary, 1000),
    changeRationale: sanitizePolicyBacklogText(input.changeRationale, 4000),
    createdBy: input.createdBy ?? null,
  };
}

export function normalizePolicyApprovalDecisionInput(
  input: PolicyApprovalDecisionInput,
): PolicyApprovalDecisionInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.workflowId) throw new Error("workflowId is required");
  if (!input.stage) throw new Error("stage is required");
  if (!input.decisionType) throw new Error("decisionType is required");
  return {
    ...input,
    decisionNote: input.decisionNote ? sanitizePolicyBacklogText(input.decisionNote, 2000) : null,
    decidedBy: input.decidedBy ?? null,
  };
}

// ─── Derived Values ───────────────────────────────────────────────────────────

export function derivePolicyBacklogPriority(input: {
  itemType: AgentPmoPolicyBacklogItemType;
  estimatedImpactLevel?: AgentPmoPolicyImpactLevel;
  sourceSignalCount?: number;
}): AgentPmoPolicyBacklogPriority {
  const { estimatedImpactLevel, sourceSignalCount } = input;
  if (estimatedImpactLevel === "critical") return "urgent";
  if (estimatedImpactLevel === "high") return "high";
  if ((sourceSignalCount ?? 0) >= 10) return "high";
  if (estimatedImpactLevel === "medium") return "normal";
  if ((sourceSignalCount ?? 0) >= 3) return "normal";
  return "low";
}

export function derivePolicyChangeScopeType(input: {
  itemType: AgentPmoPolicyBacklogItemType;
}): AgentPmoPolicyChangeScopeType {
  const map: Record<AgentPmoPolicyBacklogItemType, AgentPmoPolicyChangeScopeType> = {
    risk_policy: "risk_scoring",
    evidence_requirement: "evidence_requirements",
    adapter_quality_review: "adapter_governance",
    review_routing: "review_routing",
    human_review_policy: "human_review_policy",
    triage_policy: "triage_policy",
    approval_policy: "approval_policy",
    governance_process: "governance_reporting",
  };
  return map[input.itemType];
}

export function derivePolicyImpactLevel(input: {
  estimatedAffectedCount: number;
  estimatedApprovalRateChange: number;
  estimatedRejectionRateChange: number;
}): AgentPmoPolicyImpactLevel {
  const { estimatedAffectedCount, estimatedApprovalRateChange, estimatedRejectionRateChange } = input;
  const maxRateChange = Math.max(Math.abs(estimatedApprovalRateChange), Math.abs(estimatedRejectionRateChange));
  if (estimatedAffectedCount >= 1000 && maxRateChange >= 20) return "critical";
  if (estimatedAffectedCount >= 500 || maxRateChange >= 15) return "high";
  if (estimatedAffectedCount >= 100 || maxRateChange >= 5) return "medium";
  if (estimatedAffectedCount >= 10 || maxRateChange >= 1) return "low";
  return "none";
}

export function evaluatePolicyImplementationReadiness(input: {
  simulationCompleted: boolean;
  approvalCompleted: boolean;
  rollbackPlanPresent: boolean;
  blockedReasons?: string[];
}): AgentPmoPolicyImplementationReadinessStatus {
  const blocked = input.blockedReasons ?? [];
  if (blocked.length > 0) return "blocked";
  if (!input.rollbackPlanPresent) return "rollback_required";
  if (!input.simulationCompleted) return "simulation_required";
  if (!input.approvalCompleted) return "approval_required";
  return "ready_for_future_implementation";
}

// ─── Export enum arrays for test introspection ────────────────────────────────

export const POLICY_BACKLOG_ITEM_STATUS_VALUES = POLICY_BACKLOG_ITEM_STATUSES;
export const POLICY_BACKLOG_ITEM_TYPE_VALUES = POLICY_BACKLOG_ITEM_TYPES;
export const POLICY_BACKLOG_PRIORITY_VALUES = POLICY_BACKLOG_PRIORITIES;
export const POLICY_CHANGE_REQUEST_STATUS_VALUES = POLICY_CHANGE_REQUEST_STATUSES;
export const POLICY_CHANGE_SCOPE_TYPE_VALUES = POLICY_CHANGE_SCOPE_TYPES;
export const POLICY_SIMULATION_STATUS_VALUES = POLICY_SIMULATION_STATUSES;
export const POLICY_IMPACT_LEVEL_VALUES = POLICY_IMPACT_LEVELS;
export const GOVERNANCE_POLICY_DRAFT_TYPE_VALUES = GOVERNANCE_POLICY_DRAFT_TYPES;
export const GOVERNANCE_POLICY_DRAFT_STATUS_VALUES = GOVERNANCE_POLICY_DRAFT_STATUSES;
export const POLICY_APPROVAL_STAGE_VALUES = POLICY_APPROVAL_STAGES;
export const POLICY_APPROVAL_STATUS_VALUES = POLICY_APPROVAL_STATUSES;
export const POLICY_APPROVAL_DECISION_TYPE_VALUES = POLICY_APPROVAL_DECISION_TYPES;
export const POLICY_IMPLEMENTATION_READINESS_STATUS_VALUES = POLICY_IMPLEMENTATION_READINESS_STATUSES;
export const POLICY_ROLLBACK_PLAN_TYPE_VALUES = POLICY_ROLLBACK_PLAN_TYPES;
export const POLICY_ROLLBACK_PLAN_STATUS_VALUES = POLICY_ROLLBACK_PLAN_STATUSES;
export const POLICY_BACKLOG_EVENT_TYPE_VALUES = POLICY_BACKLOG_EVENT_TYPES;
