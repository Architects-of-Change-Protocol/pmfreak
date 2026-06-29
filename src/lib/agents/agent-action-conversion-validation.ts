// ─── Agent Controlled Action Conversion & Approval Bridge — Validation ─────────
// Deterministic helpers only. No LLM calls. No external APIs.

import type {
  AgentActionConversionStatus,
  AgentActionConversionReadiness,
  AgentActionConversionRiskLevel,
  AgentActionConversionPreflightStatus,
  AgentActionConversionPreflightCheckType,
  AgentActionApprovalRequirement,
  AgentActionApprovalBridgeStatus,
  AgentActionExecutionRequestCreationStatus,
  AgentActionConversionEventType,
  AgentActionConversionPreflightCheckResult,
  AgentActionDraftToExecutionMapping,
  CreateAgentActionConversionInput,
  CreateAgentActionApprovalBridgeInput,
} from "./agent-action-conversion-types";

// ─── Status / Enum Validators ──────────────────────────────────────────────────

const CONVERSION_STATUSES: AgentActionConversionStatus[] = [
  "created", "preflight_pending", "preflight_passed", "preflight_failed",
  "approval_required", "approval_not_required", "approval_pending",
  "approval_satisfied", "execution_request_created", "blocked", "cancelled", "completed",
];

const CONVERSION_READINESS_VALUES: AgentActionConversionReadiness[] = [
  "not_ready", "ready", "blocked", "requires_approval", "converted",
];

const RISK_LEVELS: AgentActionConversionRiskLevel[] = [
  "low", "medium", "high", "critical",
];

const PREFLIGHT_STATUSES: AgentActionConversionPreflightStatus[] = [
  "not_run", "running", "passed", "failed", "warning",
];

const PREFLIGHT_CHECK_TYPES: AgentActionConversionPreflightCheckType[] = [
  "action_draft_exists", "review_item_exists", "review_item_accepted",
  "review_decision_exists", "action_draft_convertible", "action_draft_not_converted",
  "source_result_linked", "source_evidence_linked", "target_scope_known",
  "safe_payload_present", "risk_level_known", "owner_or_role_known",
  "approval_requirement_evaluated", "tool_mapping_exists", "execution_mode_safe",
  "no_external_side_effects",
];

const APPROVAL_REQUIREMENTS: AgentActionApprovalRequirement[] = [
  "not_required", "required", "required_high_risk", "required_critical_risk",
  "required_external_side_effect", "required_policy",
];

const APPROVAL_BRIDGE_STATUSES: AgentActionApprovalBridgeStatus[] = [
  "not_required", "required", "pending", "satisfied", "rejected", "cancelled", "expired",
];

const EXECUTION_REQUEST_CREATION_STATUSES: AgentActionExecutionRequestCreationStatus[] = [
  "not_started", "ready", "created", "failed", "blocked",
];

const CONVERSION_EVENT_TYPES: AgentActionConversionEventType[] = [
  "conversion_created", "preflight_started", "preflight_passed", "preflight_failed",
  "approval_requirement_evaluated", "approval_required", "approval_not_required",
  "approval_bridge_created", "approval_satisfied", "execution_request_created",
  "conversion_blocked", "conversion_cancelled", "conversion_completed",
];

export function validateAgentActionConversionStatus(value: string): value is AgentActionConversionStatus {
  return (CONVERSION_STATUSES as string[]).includes(value);
}

export function validateAgentActionConversionReadiness(value: string): value is AgentActionConversionReadiness {
  return (CONVERSION_READINESS_VALUES as string[]).includes(value);
}

export function validateAgentActionConversionRiskLevel(value: string): value is AgentActionConversionRiskLevel {
  return (RISK_LEVELS as string[]).includes(value);
}

export function validateAgentActionConversionPreflightStatus(value: string): value is AgentActionConversionPreflightStatus {
  return (PREFLIGHT_STATUSES as string[]).includes(value);
}

export function validateAgentActionConversionPreflightCheckType(value: string): value is AgentActionConversionPreflightCheckType {
  return (PREFLIGHT_CHECK_TYPES as string[]).includes(value);
}

export function validateAgentActionApprovalRequirement(value: string): value is AgentActionApprovalRequirement {
  return (APPROVAL_REQUIREMENTS as string[]).includes(value);
}

export function validateAgentActionApprovalBridgeStatus(value: string): value is AgentActionApprovalBridgeStatus {
  return (APPROVAL_BRIDGE_STATUSES as string[]).includes(value);
}

export function validateAgentActionExecutionRequestCreationStatus(value: string): value is AgentActionExecutionRequestCreationStatus {
  return (EXECUTION_REQUEST_CREATION_STATUSES as string[]).includes(value);
}

export function validateAgentActionConversionEventType(value: string): value is AgentActionConversionEventType {
  return (CONVERSION_EVENT_TYPES as string[]).includes(value);
}

// ─── Payload Safety ───────────────────────────────────────────────────────────

const SECRET_KEYS = [
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token", "session_cookie", "cookie",
];

export function assertActionConversionPayloadSerializable(value: unknown): void {
  try {
    JSON.stringify(value);
  } catch {
    throw new Error("Conversion payload is not JSON serializable");
  }
  const str = JSON.stringify(value);
  if (str.length > 100 * 1024) {
    throw new Error("Conversion payload exceeds 100 KB limit");
  }
}

export function redactActionConversionPayload(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!value) return null;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase();
    const isSecret = SECRET_KEYS.some((s) => lower.includes(s));
    if (isSecret) {
      result[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      result[k] = redactActionConversionPayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ─── Input Normalization ──────────────────────────────────────────────────────

export function normalizeCreateAgentActionConversionInput(
  input: CreateAgentActionConversionInput,
): CreateAgentActionConversionInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.actionDraftId?.trim()) throw new Error("actionDraftId is required");
  return {
    workspaceId: input.workspaceId.trim(),
    actionDraftId: input.actionDraftId.trim(),
    ownerId: input.ownerId ?? null,
    ownerRole: input.ownerRole ?? null,
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeCreateAgentActionApprovalBridgeInput(
  input: CreateAgentActionApprovalBridgeInput,
): CreateAgentActionApprovalBridgeInput {
  if (!input.workspaceId?.trim()) throw new Error("workspaceId is required");
  if (!input.conversionId?.trim()) throw new Error("conversionId is required");
  if (!input.approvalRequirement) throw new Error("approvalRequirement is required");
  if (!input.approvalReason?.trim()) throw new Error("approvalReason is required");
  if (input.approvalReason.length > 4000) throw new Error("approvalReason exceeds 4000 chars");
  if (input.riskJustification && input.riskJustification.length > 4000) {
    throw new Error("riskJustification exceeds 4000 chars");
  }
  return {
    workspaceId: input.workspaceId.trim(),
    conversionId: input.conversionId.trim(),
    approvalRequirement: input.approvalRequirement,
    approvalPolicyKey: input.approvalPolicyKey ?? null,
    requiredApproverRole: input.requiredApproverRole ?? null,
    requiredApproverUserId: input.requiredApproverUserId ?? null,
    approvalRequestId: input.approvalRequestId ?? null,
    approvalReason: input.approvalReason.trim(),
    riskJustification: input.riskJustification ?? null,
    createdBy: input.createdBy ?? null,
  };
}

// ─── Readiness Calculation ────────────────────────────────────────────────────

export function calculateActionConversionReadiness(input: {
  actionDraftExists: boolean;
  reviewItemExists: boolean;
  reviewItemAccepted: boolean;
  reviewDecisionExists: boolean;
  actionDraftConvertible: boolean;
  actionDraftAlreadyConverted: boolean;
  sourceResultLinked: boolean;
  sourceEvidenceLinked: boolean;
  targetScopeKnown: boolean;
  safePayloadPresent: boolean;
  riskLevelKnown: boolean;
  ownerOrRoleKnown: boolean;
  toolMappingExists: boolean;
  executionModeSafe: boolean;
}): {
  readinessScore: number;
  readiness: AgentActionConversionReadiness;
  blockingReasons: string[];
  warnings: string[];
  checks: AgentActionConversionPreflightCheckResult[];
} {
  const checks: AgentActionConversionPreflightCheckResult[] = [];
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  function addCheck(
    checkType: AgentActionConversionPreflightCheckType,
    passed: boolean,
    severity: "info" | "warning" | "blocking",
    message: string,
  ): void {
    checks.push({ checkType, passed, severity, message });
    if (!passed && severity === "blocking") blockingReasons.push(message);
    if (!passed && severity === "warning") warnings.push(message);
  }

  addCheck("action_draft_exists", input.actionDraftExists, "blocking", "Action draft must exist");
  addCheck("review_item_exists", input.reviewItemExists, "blocking", "Review item must exist");
  addCheck("review_item_accepted", input.reviewItemAccepted, "blocking", "Review item must be accepted or action_drafted");
  addCheck("review_decision_exists", input.reviewDecisionExists, "warning", "Review decision should exist for full lineage");
  addCheck("action_draft_convertible", input.actionDraftConvertible, "blocking", "Action draft must be in a convertible status (draft or ready_for_approval)");
  addCheck("action_draft_not_converted", !input.actionDraftAlreadyConverted, "blocking", "Action draft must not already have an active conversion");
  addCheck("source_result_linked", input.sourceResultLinked, "warning", "Source result linkage is recommended for evidence chain");
  addCheck("source_evidence_linked", input.sourceEvidenceLinked, "warning", "Source evidence linkage is recommended for confidence tracking");
  addCheck("target_scope_known", input.targetScopeKnown, "warning", "Target scope should be specified for precise execution");
  addCheck("safe_payload_present", input.safePayloadPresent, "info", "Safe conversion payload is present");
  addCheck("risk_level_known", input.riskLevelKnown, "blocking", "Risk level must be known before conversion");
  addCheck("owner_or_role_known", input.ownerOrRoleKnown, "warning", "Owner or owner role should be identified");
  addCheck("tool_mapping_exists", input.toolMappingExists, "blocking", "A tool mapping must exist for this action type");
  addCheck("execution_mode_safe", input.executionModeSafe, "blocking", "Execution mode must be dry_run, draft_only, or approval_required");
  addCheck("no_external_side_effects", true, "info", "No external side effects are attempted in this conversion");
  addCheck("approval_requirement_evaluated", true, "info", "Approval requirement has been evaluated");

  const passed = checks.filter((c) => c.passed).length;
  const raw = Math.round((passed / checks.length) * 100);
  const readinessScore = Math.max(0, Math.min(100, raw));

  const uniqueBlocking = [...new Set(blockingReasons)];
  const uniqueWarnings = [...new Set(warnings)];

  let readiness: AgentActionConversionReadiness;
  if (input.actionDraftAlreadyConverted) {
    readiness = "converted";
  } else if (uniqueBlocking.length > 0) {
    readiness = "blocked";
  } else {
    readiness = "ready";
  }

  return {
    readinessScore,
    readiness,
    blockingReasons: uniqueBlocking,
    warnings: uniqueWarnings,
    checks,
  };
}

// ─── Approval Requirement Evaluation ─────────────────────────────────────────

export function evaluateApprovalRequirement(input: {
  riskLevel: AgentActionConversionRiskLevel;
  actionType: string;
  requiresApproval: boolean;
  targetScopeType?: string | null;
  hasExternalSideEffectPotential: boolean;
  ownerOrRoleKnown: boolean;
}): {
  approvalRequired: boolean;
  approvalRequirement: AgentActionApprovalRequirement;
  approvalReason: string;
  requiredApproverRole: string | null;
} {
  if (input.hasExternalSideEffectPotential) {
    return {
      approvalRequired: true,
      approvalRequirement: "required_external_side_effect",
      approvalReason: "Action has potential for external side effects and requires explicit approval",
      requiredApproverRole: "pmo_lead",
    };
  }

  if (input.riskLevel === "critical") {
    return {
      approvalRequired: true,
      approvalRequirement: "required_critical_risk",
      approvalReason: "Critical risk level requires executive approval before conversion",
      requiredApproverRole: "executive",
    };
  }

  if (input.riskLevel === "high") {
    return {
      approvalRequired: true,
      approvalRequirement: "required_high_risk",
      approvalReason: "High risk level requires PMO lead approval before conversion",
      requiredApproverRole: "pmo_lead",
    };
  }

  if (input.requiresApproval) {
    return {
      approvalRequired: true,
      approvalRequirement: "required",
      approvalReason: `Action type '${input.actionType}' requires approval by policy`,
      requiredApproverRole: "project_manager",
    };
  }

  return {
    approvalRequired: false,
    approvalRequirement: "not_required",
    approvalReason: "Action type and risk level do not require additional approval",
    requiredApproverRole: null,
  };
}

// ─── Action Draft to Execution Mapping ────────────────────────────────────────
// Deterministic mapping. Does not call adapters. Does not execute actions.

const ACTION_TYPE_MAPPINGS: Record<string, AgentActionDraftToExecutionMapping> = {
  draft_email: {
    actionType: "draft_email",
    toolKey: "draft_email",
    adapterKey: "draft_email_adapter",
    executionMode: "draft_only",
    requiresApproval: true,
    defaultScopeType: "workspace",
    description: "Draft an email for human review and approval before sending",
  },
  draft_task: {
    actionType: "draft_task",
    toolKey: "draft_task",
    adapterKey: "draft_task_adapter",
    executionMode: "draft_only",
    requiresApproval: true,
    defaultScopeType: "project",
    description: "Draft a task for human review and approval before creation",
  },
  draft_project_update: {
    actionType: "draft_project_update",
    toolKey: "draft_project_update",
    adapterKey: "draft_project_update_adapter",
    executionMode: "draft_only",
    requiresApproval: true,
    defaultScopeType: "project",
    description: "Draft a project update for human review and approval",
  },
  draft_risk_escalation: {
    actionType: "draft_risk_escalation",
    toolKey: "risk_analysis",
    adapterKey: "risk_analysis_adapter",
    executionMode: "draft_only",
    requiresApproval: true,
    defaultScopeType: "project",
    description: "Draft a risk escalation for PMO governance review",
  },
  draft_status_report: {
    actionType: "draft_status_report",
    toolKey: "executive_summary",
    adapterKey: "executive_summary_adapter",
    executionMode: "draft_only",
    requiresApproval: false,
    defaultScopeType: "workspace",
    description: "Draft a status report for distribution after optional review",
  },
  draft_governance_note: {
    actionType: "draft_governance_note",
    toolKey: "executive_summary",
    adapterKey: "executive_summary_adapter",
    executionMode: "draft_only",
    requiresApproval: false,
    defaultScopeType: "workspace",
    description: "Draft a governance note for record-keeping",
  },
  draft_follow_up: {
    actionType: "draft_follow_up",
    toolKey: "draft_task",
    adapterKey: "draft_task_adapter",
    executionMode: "draft_only",
    requiresApproval: true,
    defaultScopeType: "project",
    description: "Draft a follow-up action item for human review and approval",
  },
  manual_action: {
    actionType: "manual_action",
    toolKey: "noop",
    adapterKey: "noop_adapter",
    executionMode: "dry_run",
    requiresApproval: true,
    defaultScopeType: null,
    description: "Manual action placeholder requiring explicit human approval",
  },
};

export function getActionDraftToExecutionMapping(
  actionType: string,
): AgentActionDraftToExecutionMapping | null {
  return ACTION_TYPE_MAPPINGS[actionType] ?? null;
}
