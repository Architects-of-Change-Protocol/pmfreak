// ─── PMO Controlled Policy Implementation Planning Workspace — Validation ─
// Does NOT call LLMs, external APIs, or send communications.
// All functions are deterministic.

import type {
  AgentPmoImplementationPlanningWorkspaceStatus,
  AgentPmoImplementationPlanDraftStatus,
  AgentPmoImplementationTaskType,
  AgentPmoImplementationTaskStatus,
  AgentPmoPreImplementationChecklistStatus,
  AgentPmoStakeholderRole,
  AgentPmoStakeholderReadinessStatus,
  AgentPmoChangeWindowType,
  AgentPmoChangeWindowStatus,
  AgentPmoImplementationRiskType,
  AgentPmoImplementationRiskStatus,
  AgentPmoImplementationRiskSeverity,
  AgentPmoRollbackRehearsalType,
  AgentPmoRollbackRehearsalStatus,
  AgentPmoImplementationGatePrerequisiteType,
  AgentPmoImplementationGatePrerequisiteStatus,
  AgentPmoImplementationPlanningDecisionType,
  AgentPmoImplementationPlanningExportFormat,
  AgentPmoImplementationPlanningExportStatus,
  AgentPmoImplementationPlanningEventType,
  CreateAgentPmoImplementationPlanningWorkspaceInput,
  CreateAgentPmoImplementationPlanDraftInput,
  RecordAgentPmoImplementationPlanningDecisionInput,
  GenerateAgentPmoImplementationPlanningExportInput,
} from "./agent-pmo-implementation-planning-types";

// ─── Enum Arrays ──────────────────────────────────────────────────────────────

const IMPLEMENTATION_PLANNING_WORKSPACE_STATUSES: AgentPmoImplementationPlanningWorkspaceStatus[] = [
  "created", "planning", "under_review", "changes_requested",
  "approved_for_dry_run_planning", "blocked", "archived",
];

const IMPLEMENTATION_PLAN_DRAFT_STATUSES: AgentPmoImplementationPlanDraftStatus[] = [
  "created", "draft", "under_review", "approved_for_dry_run_planning",
  "changes_requested", "blocked", "archived",
];

const IMPLEMENTATION_TASK_TYPES: AgentPmoImplementationTaskType[] = [
  "policy_version_preparation", "configuration_review", "runtime_mapping_review",
  "safety_check", "test_plan_preparation", "stakeholder_review",
  "change_window_preparation", "rollback_preparation", "dry_run_preparation",
  "documentation_update",
];

const IMPLEMENTATION_TASK_STATUSES: AgentPmoImplementationTaskStatus[] = [
  "planned", "ready_for_planning_review", "blocked", "deferred", "removed",
];

const PRE_IMPLEMENTATION_CHECKLIST_STATUSES: AgentPmoPreImplementationChecklistStatus[] = [
  "not_started", "pending", "passed", "failed", "blocked", "not_applicable",
];

const STAKEHOLDER_ROLES: AgentPmoStakeholderRole[] = [
  "pmo_owner", "security_owner", "operations_owner", "data_governance_owner",
  "executive_sponsor", "implementation_owner", "rollback_owner",
];

const STAKEHOLDER_READINESS_STATUSES: AgentPmoStakeholderReadinessStatus[] = [
  "not_required", "pending", "acknowledged", "changes_requested", "blocked", "waived",
];

const CHANGE_WINDOW_TYPES: AgentPmoChangeWindowType[] = [
  "standard", "maintenance", "emergency_planning", "low_traffic", "business_hours", "after_hours",
];

const CHANGE_WINDOW_STATUSES: AgentPmoChangeWindowStatus[] = [
  "draft", "proposed", "under_review", "approved_for_dry_run_planning", "rejected", "blocked", "archived",
];

const IMPLEMENTATION_RISK_TYPES: AgentPmoImplementationRiskType[] = [
  "policy_behavior_risk", "routing_risk", "scoring_risk", "evidence_requirement_risk",
  "adapter_governance_risk", "operational_risk", "rollback_risk", "stakeholder_risk",
  "data_safety_risk", "compliance_risk",
];

const IMPLEMENTATION_RISK_STATUSES: AgentPmoImplementationRiskStatus[] = [
  "open", "mitigated", "accepted", "transferred", "blocked", "closed",
];

const IMPLEMENTATION_RISK_SEVERITIES: AgentPmoImplementationRiskSeverity[] = [
  "low", "medium", "high", "critical",
];

const ROLLBACK_REHEARSAL_TYPES: AgentPmoRollbackRehearsalType[] = [
  "tabletop", "configuration_review", "version_revert_review", "routing_restore_review",
  "scoring_restore_review", "evidence_requirement_restore_review", "adapter_governance_review",
];

const ROLLBACK_REHEARSAL_STATUSES: AgentPmoRollbackRehearsalStatus[] = [
  "created", "planned", "ready_for_review", "reviewed", "blocked", "archived",
];

const IMPLEMENTATION_GATE_PREREQUISITE_TYPES: AgentPmoImplementationGatePrerequisiteType[] = [
  "approval_pack_exists", "approval_pack_signed_off", "implementation_plan_approved",
  "task_breakdown_reviewed", "stakeholders_acknowledged", "change_window_reviewed",
  "risk_register_reviewed", "rollback_rehearsal_ready", "validation_checklist_passed",
  "security_review_complete", "operations_review_complete", "data_governance_review_complete",
];

const IMPLEMENTATION_GATE_PREREQUISITE_STATUSES: AgentPmoImplementationGatePrerequisiteStatus[] = [
  "pending", "satisfied", "failed", "blocked", "waived", "not_applicable",
];

const IMPLEMENTATION_PLANNING_DECISION_TYPES: AgentPmoImplementationPlanningDecisionType[] = [
  "approve_plan_for_dry_run_planning", "request_changes", "block_plan",
  "waive_prerequisite", "archive_planning_workspace",
];

const IMPLEMENTATION_PLANNING_EXPORT_FORMATS: AgentPmoImplementationPlanningExportFormat[] = [
  "markdown", "json", "csv",
];

const IMPLEMENTATION_PLANNING_EXPORT_STATUSES: AgentPmoImplementationPlanningExportStatus[] = [
  "created", "generated", "failed", "downloaded", "archived",
];

const IMPLEMENTATION_PLANNING_EVENT_TYPES: AgentPmoImplementationPlanningEventType[] = [
  "implementation_planning_workspace_created", "implementation_plan_draft_created",
  "implementation_task_breakdown_created", "implementation_planning_checklist_created",
  "implementation_planning_checklist_item_recorded", "stakeholder_readiness_recorded",
  "change_window_plan_created", "implementation_risk_registered",
  "rollback_rehearsal_plan_created", "implementation_gate_prerequisite_recorded",
  "implementation_planning_decision_recorded", "implementation_planning_export_created",
  "implementation_planning_workspace_archived",
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

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateAgentPmoImplementationPlanningWorkspaceStatus(s: string): boolean {
  return IMPLEMENTATION_PLANNING_WORKSPACE_STATUSES.includes(s as AgentPmoImplementationPlanningWorkspaceStatus);
}

export function validateAgentPmoImplementationPlanDraftStatus(s: string): boolean {
  return IMPLEMENTATION_PLAN_DRAFT_STATUSES.includes(s as AgentPmoImplementationPlanDraftStatus);
}

export function validateAgentPmoImplementationTaskType(s: string): boolean {
  return IMPLEMENTATION_TASK_TYPES.includes(s as AgentPmoImplementationTaskType);
}

export function validateAgentPmoImplementationTaskStatus(s: string): boolean {
  return IMPLEMENTATION_TASK_STATUSES.includes(s as AgentPmoImplementationTaskStatus);
}

export function validateAgentPmoPreImplementationChecklistStatus(s: string): boolean {
  return PRE_IMPLEMENTATION_CHECKLIST_STATUSES.includes(s as AgentPmoPreImplementationChecklistStatus);
}

export function validateAgentPmoStakeholderRole(s: string): boolean {
  return STAKEHOLDER_ROLES.includes(s as AgentPmoStakeholderRole);
}

export function validateAgentPmoStakeholderReadinessStatus(s: string): boolean {
  return STAKEHOLDER_READINESS_STATUSES.includes(s as AgentPmoStakeholderReadinessStatus);
}

export function validateAgentPmoChangeWindowType(s: string): boolean {
  return CHANGE_WINDOW_TYPES.includes(s as AgentPmoChangeWindowType);
}

export function validateAgentPmoChangeWindowStatus(s: string): boolean {
  return CHANGE_WINDOW_STATUSES.includes(s as AgentPmoChangeWindowStatus);
}

export function validateAgentPmoImplementationRiskType(s: string): boolean {
  return IMPLEMENTATION_RISK_TYPES.includes(s as AgentPmoImplementationRiskType);
}

export function validateAgentPmoImplementationRiskStatus(s: string): boolean {
  return IMPLEMENTATION_RISK_STATUSES.includes(s as AgentPmoImplementationRiskStatus);
}

export function validateAgentPmoImplementationRiskSeverity(s: string): boolean {
  return IMPLEMENTATION_RISK_SEVERITIES.includes(s as AgentPmoImplementationRiskSeverity);
}

export function validateAgentPmoRollbackRehearsalType(s: string): boolean {
  return ROLLBACK_REHEARSAL_TYPES.includes(s as AgentPmoRollbackRehearsalType);
}

export function validateAgentPmoRollbackRehearsalStatus(s: string): boolean {
  return ROLLBACK_REHEARSAL_STATUSES.includes(s as AgentPmoRollbackRehearsalStatus);
}

export function validateAgentPmoImplementationGatePrerequisiteType(s: string): boolean {
  return IMPLEMENTATION_GATE_PREREQUISITE_TYPES.includes(s as AgentPmoImplementationGatePrerequisiteType);
}

export function validateAgentPmoImplementationGatePrerequisiteStatus(s: string): boolean {
  return IMPLEMENTATION_GATE_PREREQUISITE_STATUSES.includes(s as AgentPmoImplementationGatePrerequisiteStatus);
}

export function validateAgentPmoImplementationPlanningDecisionType(s: string): boolean {
  return IMPLEMENTATION_PLANNING_DECISION_TYPES.includes(s as AgentPmoImplementationPlanningDecisionType);
}

export function validateAgentPmoImplementationPlanningExportFormat(s: string): boolean {
  return IMPLEMENTATION_PLANNING_EXPORT_FORMATS.includes(s as AgentPmoImplementationPlanningExportFormat);
}

export function validateAgentPmoImplementationPlanningExportStatus(s: string): boolean {
  return IMPLEMENTATION_PLANNING_EXPORT_STATUSES.includes(s as AgentPmoImplementationPlanningExportStatus);
}

export function validateAgentPmoImplementationPlanningEventType(s: string): boolean {
  return IMPLEMENTATION_PLANNING_EVENT_TYPES.includes(s as AgentPmoImplementationPlanningEventType);
}

// ─── Payload Safety ───────────────────────────────────────────────────────────

export function assertImplementationPlanningPayloadSerializable(payload: unknown): void {
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length > 50 * 1024) {
      throw new Error("Implementation planning payload exceeds 50KB limit");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("50KB")) throw err;
    throw new Error("Implementation planning payload is not JSON-serializable");
  }
}

export function redactImplementationPlanningPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!BLOCKED_KEYS.has(k)) {
      result[k] = v;
    }
  }
  return result;
}

// ─── Text Sanitization ────────────────────────────────────────────────────────

export function sanitizeImplementationPlanningText(text: string): string {
  return text.trim().slice(0, 4000);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export function dedupeImplementationPlanningStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalizeCreateImplementationPlanningWorkspaceInput(
  input: CreateAgentPmoImplementationPlanningWorkspaceInput,
): CreateAgentPmoImplementationPlanningWorkspaceInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.approvalPackId) throw new Error("approvalPackId is required");
  if (!input.title || !input.title.trim()) throw new Error("title is required");
  if (!input.summary || !input.summary.trim()) throw new Error("summary is required");
  if (input.planningOwnerRole && !validateAgentPmoStakeholderRole(input.planningOwnerRole)) {
    throw new Error(`Invalid planningOwnerRole: ${input.planningOwnerRole}`);
  }
  return {
    ...input,
    title: sanitizeImplementationPlanningText(input.title),
    summary: sanitizeImplementationPlanningText(input.summary),
  };
}

export function normalizeCreateImplementationPlanDraftInput(
  input: CreateAgentPmoImplementationPlanDraftInput,
): CreateAgentPmoImplementationPlanDraftInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.planningWorkspaceId) throw new Error("planningWorkspaceId is required");
  if (!input.implementationObjective || !input.implementationObjective.trim()) {
    throw new Error("implementationObjective is required");
  }
  if (!input.implementationScope || !input.implementationScope.trim()) {
    throw new Error("implementationScope is required");
  }
  if (!input.nonGoals || !input.nonGoals.trim()) {
    throw new Error("nonGoals is required");
  }
  return {
    ...input,
    implementationObjective: sanitizeImplementationPlanningText(input.implementationObjective),
    implementationScope: sanitizeImplementationPlanningText(input.implementationScope),
    nonGoals: sanitizeImplementationPlanningText(input.nonGoals),
    assumptions: input.assumptions ? sanitizeImplementationPlanningText(input.assumptions) : "",
    constraints: input.constraints ? sanitizeImplementationPlanningText(input.constraints) : "",
  };
}

export function normalizePlanningDecisionInput(
  input: RecordAgentPmoImplementationPlanningDecisionInput,
): RecordAgentPmoImplementationPlanningDecisionInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.planningWorkspaceId) throw new Error("planningWorkspaceId is required");
  if (!validateAgentPmoImplementationPlanningDecisionType(input.decision)) {
    throw new Error(`Invalid decision: ${input.decision}`);
  }
  if (!input.rationale || !input.rationale.trim()) throw new Error("rationale is required");
  return {
    ...input,
    rationale: sanitizeImplementationPlanningText(input.rationale),
  };
}

export function normalizeImplementationPlanningExportInput(
  input: GenerateAgentPmoImplementationPlanningExportInput,
): GenerateAgentPmoImplementationPlanningExportInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.planningWorkspaceId) throw new Error("planningWorkspaceId is required");
  if (!validateAgentPmoImplementationPlanningExportFormat(input.exportFormat)) {
    throw new Error(`Invalid exportFormat: ${input.exportFormat}`);
  }
  return input;
}

// ─── Derived Status Helpers ───────────────────────────────────────────────────

export function evaluatePreImplementationChecklistStatus(
  items: { status: string }[],
): AgentPmoPreImplementationChecklistStatus {
  if (items.length === 0) return "not_started";
  if (items.some((i) => i.status === "blocked")) return "blocked";
  if (items.some((i) => i.status === "failed")) return "failed";
  if (items.every((i) => i.status === "passed" || i.status === "not_applicable")) return "passed";
  if (items.some((i) => i.status === "pending" || i.status === "not_started")) return "pending";
  return "pending";
}

export function evaluateStakeholderReadinessSummary(
  records: { status: string }[],
): { acknowledged: number; pending: number; blocked: number } {
  let acknowledged = 0;
  let pending = 0;
  let blocked = 0;
  for (const r of records) {
    if (r.status === "acknowledged" || r.status === "waived" || r.status === "not_required") {
      acknowledged++;
    } else if (r.status === "blocked") {
      blocked++;
    } else {
      pending++;
    }
  }
  return { acknowledged, pending, blocked };
}

export function evaluateGatePrerequisiteReadiness(
  prerequisites: { status: string; prerequisiteType: string }[],
): { allSatisfied: boolean; anyBlocked: boolean; anyFailed: boolean } {
  const anyBlocked = prerequisites.some((p) => p.status === "blocked");
  const anyFailed = prerequisites.some((p) => p.status === "failed");
  const allSatisfied = prerequisites.length > 0 && prerequisites.every(
    (p) => p.status === "satisfied" || p.status === "waived" || p.status === "not_applicable",
  );
  return { allSatisfied, anyBlocked, anyFailed };
}

export function deriveImplementationPlanningWorkspaceStatus(
  prerequisites: { status: string }[],
): AgentPmoImplementationPlanningWorkspaceStatus {
  if (prerequisites.some((p) => p.status === "blocked")) return "blocked";
  if (prerequisites.some((p) => p.status === "failed")) return "changes_requested";
  if (
    prerequisites.length > 0 &&
    prerequisites.every(
      (p) => p.status === "satisfied" || p.status === "waived" || p.status === "not_applicable",
    )
  ) {
    return "approved_for_dry_run_planning";
  }
  if (prerequisites.some((p) => p.status === "pending")) return "under_review";
  return "planning";
}

export function validateImplementationPlanningExportSafety(content: string): boolean {
  for (const key of BLOCKED_KEYS) {
    if (content.includes(`"${key}"`)) return false;
    if (content.includes(`${key}:`)) return false;
  }
  return true;
}
