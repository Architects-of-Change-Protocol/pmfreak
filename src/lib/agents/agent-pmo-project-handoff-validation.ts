// ─── PMO Controlled Project Intelligence Handoff — Validation ────────────────
// Does NOT call LLMs, external APIs, or send communications.
// All functions are deterministic and safe.

import type {
  AgentPmoProjectHandoffRequestStatus,
  AgentPmoProjectHandoffReason,
  AgentPmoProjectHandoffUrgency,
  AgentPmoProjectContextValidationStatus,
  AgentPmoProjectHandoffGateStatus,
  AgentPmoProjectHandoffGateDecisionType,
  AgentPmoProjectHandoffPackStatus,
  AgentPmoProjectMemorySnapshotCategory,
  AgentPmoProjectMemorySnapshotStatus,
  AgentPmoProjectHealthStatus,
  AgentPmoProjectHandoffSnapshotItemType,
  AgentPmoProjectHandoffSnapshotItemStatus,
  AgentPmoProjectHandoffSnapshotItemSeverity,
  AgentPmoStakeholderContextType,
  AgentPmoStakeholderContextStatus,
  AgentPmoOutgoingPmNoteType,
  AgentPmoOutgoingPmNoteStatus,
  AgentPmoIncomingPmAcceptanceStatus,
  AgentPmoIncomingPmAcceptanceDecision,
  AgentPmoProjectAssignmentSource,
  AgentPmoHandoffContinuityCheckType,
  AgentPmoHandoffContinuityCheckStatus,
  AgentPmoProjectHandoffExportFormat,
  AgentPmoProjectHandoffExportStatus,
  AgentPmoProjectHandoffAuditEventType,
  CreateAgentPmoProjectHandoffRequestInput,
  CreateAgentPmoProjectHandoffGateInput,
  RecordAgentPmoProjectHandoffGateDecisionInput,
  CreateAgentPmoProjectHandoffPackInput,
  RecordAgentPmoOutgoingPmNoteInput,
  RecordAgentPmoIncomingPmAcceptanceInput,
  CompleteAgentPmoProjectHandoffInput,
  GenerateAgentPmoProjectHandoffExportInput,
  AgentPmoProjectContextValidationRecord,
  AgentPmoProjectHandoffGateRecord,
  AgentPmoIncomingPmAcceptanceRecord,
  AgentPmoProjectHandoffRequestRecord,
  AgentPmoProjectMemorySnapshotRecord,
} from "./agent-pmo-project-handoff-types";

// ─── Enum Arrays ──────────────────────────────────────────────────────────────

const HANDOFF_REQUEST_STATUSES: AgentPmoProjectHandoffRequestStatus[] = [
  "created", "context_validation_pending", "context_validation_failed",
  "ready_for_pmo_review", "pmo_review_required", "pmo_approved", "pmo_rejected",
  "handoff_pack_pending", "handoff_pack_created", "outgoing_pm_notes_pending",
  "incoming_pm_review_required", "incoming_pm_accepted", "incoming_pm_rejected",
  "assignment_update_pending", "handoff_completed", "continuity_monitoring",
  "blocked", "archived",
];

const HANDOFF_REASONS: AgentPmoProjectHandoffReason[] = [
  "workload_rebalance", "pm_unavailable", "vacation_coverage", "role_change",
  "performance_intervention", "client_escalation", "project_complexity",
  "strategic_reassignment", "delivery_risk", "pm_departure",
  "temporary_coverage", "other",
];

const HANDOFF_URGENCIES: AgentPmoProjectHandoffUrgency[] = [
  "low", "normal", "high", "critical",
];

const CONTEXT_VALIDATION_STATUSES: AgentPmoProjectContextValidationStatus[] = [
  "pending", "passed", "failed", "blocked", "waived",
];

const GATE_STATUSES: AgentPmoProjectHandoffGateStatus[] = [
  "created", "under_review", "approved_for_handoff", "rejected",
  "changes_requested", "blocked", "archived",
];

const GATE_DECISION_TYPES: AgentPmoProjectHandoffGateDecisionType[] = [
  "approve_for_handoff", "reject", "request_changes", "block", "archive",
];

const PACK_STATUSES: AgentPmoProjectHandoffPackStatus[] = [
  "created", "assembled", "pmo_review_ready", "accepted",
  "changes_requested", "blocked", "archived",
];

const MEMORY_SNAPSHOT_CATEGORIES: AgentPmoProjectMemorySnapshotCategory[] = [
  "project_summary", "delivery_history", "key_decisions", "risks", "blockers",
  "dependencies", "milestones", "stakeholders", "client_commitments",
  "commercial_notes", "technical_notes", "governance_notes", "open_questions",
  "next_actions", "lessons_learned",
];

const MEMORY_SNAPSHOT_STATUSES: AgentPmoProjectMemorySnapshotStatus[] = [
  "created", "assembled", "review_ready", "accepted", "changes_requested",
  "blocked", "archived",
];

const HEALTH_STATUSES: AgentPmoProjectHealthStatus[] = [
  "unknown", "green", "yellow", "red", "blocked", "not_applicable",
];

const SNAPSHOT_ITEM_TYPES: AgentPmoProjectHandoffSnapshotItemType[] = [
  "risk", "blocker", "open_decision", "dependency", "commitment", "milestone",
  "action_item", "stakeholder_issue", "commercial_item", "technical_item",
  "governance_item",
];

const SNAPSHOT_ITEM_STATUSES: AgentPmoProjectHandoffSnapshotItemStatus[] = [
  "open", "in_progress", "pending_review", "resolved", "accepted",
  "blocked", "closed", "unknown",
];

const SNAPSHOT_ITEM_SEVERITIES: AgentPmoProjectHandoffSnapshotItemSeverity[] = [
  "low", "medium", "high", "critical", "unknown",
];

const STAKEHOLDER_CONTEXT_TYPES: AgentPmoStakeholderContextType[] = [
  "client_sponsor", "client_project_owner", "client_technical_owner",
  "internal_pmo_owner", "internal_delivery_owner", "internal_engineering_owner",
  "vendor_contact", "commercial_owner", "support_contact", "other",
];

const STAKEHOLDER_CONTEXT_STATUSES: AgentPmoStakeholderContextStatus[] = [
  "active", "inactive", "unknown", "not_applicable",
];

const OUTGOING_PM_NOTE_TYPES: AgentPmoOutgoingPmNoteType[] = [
  "delivery_context", "client_context", "technical_context", "commercial_context",
  "risk_context", "blocker_context", "decision_context", "team_context",
  "personal_warning", "recommended_next_step", "other",
];

const OUTGOING_PM_NOTE_STATUSES: AgentPmoOutgoingPmNoteStatus[] = [
  "draft", "submitted", "reviewed", "changes_requested", "accepted", "archived",
];

const INCOMING_PM_ACCEPTANCE_STATUSES: AgentPmoIncomingPmAcceptanceStatus[] = [
  "created", "under_review", "accepted", "rejected", "changes_requested",
  "blocked", "archived",
];

const INCOMING_PM_ACCEPTANCE_DECISIONS: AgentPmoIncomingPmAcceptanceDecision[] = [
  "accept_handoff", "request_changes", "reject_handoff", "block_handoff", "archive",
];

const ASSIGNMENT_SOURCES: AgentPmoProjectAssignmentSource[] = [
  "controlled_handoff", "initial_assignment_snapshot",
  "manual_import_reference", "system_reference", "unknown",
];

const CONTINUITY_CHECK_TYPES: AgentPmoHandoffContinuityCheckType[] = [
  "incoming_pm_acknowledged", "critical_risks_reviewed", "critical_blockers_reviewed",
  "upcoming_milestones_reviewed", "open_decisions_reviewed", "stakeholder_context_reviewed",
  "client_commitments_reviewed", "first_status_update_completed",
  "handoff_pack_reviewed", "assignment_pointer_verified",
];

const CONTINUITY_CHECK_STATUSES: AgentPmoHandoffContinuityCheckStatus[] = [
  "pending", "passed", "failed", "blocked", "waived", "not_applicable",
];

const EXPORT_FORMATS: AgentPmoProjectHandoffExportFormat[] = [
  "markdown", "json", "csv",
];

const EXPORT_STATUSES: AgentPmoProjectHandoffExportStatus[] = [
  "created", "generated", "failed", "downloaded", "archived",
];

const AUDIT_EVENT_TYPES: AgentPmoProjectHandoffAuditEventType[] = [
  "handoff_request_created", "handoff_context_validation_created",
  "handoff_context_validation_completed", "handoff_pmo_gate_created",
  "handoff_pmo_gate_decision_recorded", "handoff_pack_created",
  "project_memory_snapshot_created", "project_status_snapshot_created",
  "handoff_snapshot_item_created", "stakeholder_context_snapshot_created",
  "outgoing_pm_note_recorded", "incoming_pm_acceptance_recorded",
  "controlled_assignment_pointer_updated", "project_assignment_history_recorded",
  "handoff_continuity_check_created", "handoff_continuity_check_completed",
  "handoff_export_created", "handoff_request_archived",
];

// ─── Blocked Patterns ─────────────────────────────────────────────────────────

const BLOCKED_FIELD_PATTERNS = [
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "private_key", "credential", "client_secret", "refresh_token", "access_token",
  "session_cookie", "cookie", "raw_payload", "outcomePayload", "safeOutcomePayload",
  "intendedSummary", "actualSummary", "rationale_from_learning", "failureMessage",
  "correctionReason", "unredacted_email", "unredacted_phone", "private_address",
  "personal_identifier",
];

const FORBIDDEN_EXECUTABLE_PATTERNS = [
  "sendEmail", "sendSlack", "createJiraTicket", "createGithubIssue",
  "createCalendarEvent", "scheduleChangeWindow", "dispatchExecutionToAdapter",
  "executeAdapter", "runAdapter", "updateExternalProject", "mutateExternalProject",
  "deleteProjectMemory", "eraseProjectHistory", "overwriteProjectBrain",
  "callExternalApi", "callOpenAI", "callAnthropic", "callGemini",
  "createEmbedding", "trainModel", "fineTuneModel", "autoAssignProjectOwner",
];

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateAgentPmoProjectHandoffRequestStatus(v: unknown): v is AgentPmoProjectHandoffRequestStatus {
  return typeof v === "string" && (HANDOFF_REQUEST_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffReason(v: unknown): v is AgentPmoProjectHandoffReason {
  return typeof v === "string" && (HANDOFF_REASONS as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffUrgency(v: unknown): v is AgentPmoProjectHandoffUrgency {
  return typeof v === "string" && (HANDOFF_URGENCIES as string[]).includes(v);
}

export function validateAgentPmoProjectContextValidationStatus(v: unknown): v is AgentPmoProjectContextValidationStatus {
  return typeof v === "string" && (CONTEXT_VALIDATION_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffGateStatus(v: unknown): v is AgentPmoProjectHandoffGateStatus {
  return typeof v === "string" && (GATE_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffGateDecisionType(v: unknown): v is AgentPmoProjectHandoffGateDecisionType {
  return typeof v === "string" && (GATE_DECISION_TYPES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffPackStatus(v: unknown): v is AgentPmoProjectHandoffPackStatus {
  return typeof v === "string" && (PACK_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectMemorySnapshotCategory(v: unknown): v is AgentPmoProjectMemorySnapshotCategory {
  return typeof v === "string" && (MEMORY_SNAPSHOT_CATEGORIES as string[]).includes(v);
}

export function validateAgentPmoProjectMemorySnapshotStatus(v: unknown): v is AgentPmoProjectMemorySnapshotStatus {
  return typeof v === "string" && (MEMORY_SNAPSHOT_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectHealthStatus(v: unknown): v is AgentPmoProjectHealthStatus {
  return typeof v === "string" && (HEALTH_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffSnapshotItemType(v: unknown): v is AgentPmoProjectHandoffSnapshotItemType {
  return typeof v === "string" && (SNAPSHOT_ITEM_TYPES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffSnapshotItemStatus(v: unknown): v is AgentPmoProjectHandoffSnapshotItemStatus {
  return typeof v === "string" && (SNAPSHOT_ITEM_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffSnapshotItemSeverity(v: unknown): v is AgentPmoProjectHandoffSnapshotItemSeverity {
  return typeof v === "string" && (SNAPSHOT_ITEM_SEVERITIES as string[]).includes(v);
}

export function validateAgentPmoStakeholderContextType(v: unknown): v is AgentPmoStakeholderContextType {
  return typeof v === "string" && (STAKEHOLDER_CONTEXT_TYPES as string[]).includes(v);
}

export function validateAgentPmoStakeholderContextStatus(v: unknown): v is AgentPmoStakeholderContextStatus {
  return typeof v === "string" && (STAKEHOLDER_CONTEXT_STATUSES as string[]).includes(v);
}

export function validateAgentPmoOutgoingPmNoteType(v: unknown): v is AgentPmoOutgoingPmNoteType {
  return typeof v === "string" && (OUTGOING_PM_NOTE_TYPES as string[]).includes(v);
}

export function validateAgentPmoOutgoingPmNoteStatus(v: unknown): v is AgentPmoOutgoingPmNoteStatus {
  return typeof v === "string" && (OUTGOING_PM_NOTE_STATUSES as string[]).includes(v);
}

export function validateAgentPmoIncomingPmAcceptanceStatus(v: unknown): v is AgentPmoIncomingPmAcceptanceStatus {
  return typeof v === "string" && (INCOMING_PM_ACCEPTANCE_STATUSES as string[]).includes(v);
}

export function validateAgentPmoIncomingPmAcceptanceDecision(v: unknown): v is AgentPmoIncomingPmAcceptanceDecision {
  return typeof v === "string" && (INCOMING_PM_ACCEPTANCE_DECISIONS as string[]).includes(v);
}

export function validateAgentPmoProjectAssignmentSource(v: unknown): v is AgentPmoProjectAssignmentSource {
  return typeof v === "string" && (ASSIGNMENT_SOURCES as string[]).includes(v);
}

export function validateAgentPmoHandoffContinuityCheckType(v: unknown): v is AgentPmoHandoffContinuityCheckType {
  return typeof v === "string" && (CONTINUITY_CHECK_TYPES as string[]).includes(v);
}

export function validateAgentPmoHandoffContinuityCheckStatus(v: unknown): v is AgentPmoHandoffContinuityCheckStatus {
  return typeof v === "string" && (CONTINUITY_CHECK_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffExportFormat(v: unknown): v is AgentPmoProjectHandoffExportFormat {
  return typeof v === "string" && (EXPORT_FORMATS as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffExportStatus(v: unknown): v is AgentPmoProjectHandoffExportStatus {
  return typeof v === "string" && (EXPORT_STATUSES as string[]).includes(v);
}

export function validateAgentPmoProjectHandoffAuditEventType(v: unknown): v is AgentPmoProjectHandoffAuditEventType {
  return typeof v === "string" && (AUDIT_EVENT_TYPES as string[]).includes(v);
}

// ─── Payload Safety ───────────────────────────────────────────────────────────

export function assertProjectHandoffPayloadSerializable(payload: unknown): void {
  try {
    JSON.stringify(payload);
  } catch {
    throw new Error("Handoff payload is not JSON serializable");
  }
  const json = JSON.stringify(payload);
  if (json.length > 50 * 1024) {
    throw new Error("Handoff payload exceeds 50 KB limit");
  }
}

export function redactProjectHandoffPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    const keyLower = k.toLowerCase();
    const isBlocked = BLOCKED_FIELD_PATTERNS.some((p) => keyLower.includes(p.toLowerCase()));
    if (isBlocked) {
      redacted[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      redacted[k] = redactProjectHandoffPayload(v as Record<string, unknown>);
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

export function sanitizeProjectHandoffText(text: string, maxLen: number): string {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, maxLen).trim();
}

export function dedupeProjectHandoffStrings(items: string[]): string[] {
  return [...new Set(items)];
}

// ─── Input Normalizers ────────────────────────────────────────────────────────

export function normalizeCreateProjectHandoffRequestInput(
  raw: unknown,
): CreateAgentPmoProjectHandoffRequestInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid handoff request input");
  const r = raw as Record<string, unknown>;
  if (!r.workspaceId || typeof r.workspaceId !== "string") throw new Error("workspaceId required");
  if (!r.projectId || typeof r.projectId !== "string") throw new Error("projectId required");
  if (!r.incomingPmId || typeof r.incomingPmId !== "string") throw new Error("incomingPmId required");
  if (!validateAgentPmoProjectHandoffReason(r.handoffReason)) throw new Error("Valid handoffReason required");
  if (!validateAgentPmoProjectHandoffUrgency(r.handoffUrgency)) throw new Error("Valid handoffUrgency required");
  if (!r.requestReason || typeof r.requestReason !== "string") throw new Error("requestReason required");
  const currentPmId = typeof r.currentPmId === "string" ? r.currentPmId : null;
  if (currentPmId && currentPmId === r.incomingPmId) {
    throw new Error("currentPmId and incomingPmId must be different");
  }
  return {
    workspaceId: sanitizeProjectHandoffText(r.workspaceId, 500),
    projectId: sanitizeProjectHandoffText(r.projectId, 500),
    currentPmId: currentPmId ? sanitizeProjectHandoffText(currentPmId, 500) : null,
    incomingPmId: sanitizeProjectHandoffText(r.incomingPmId as string, 500),
    requestedById: typeof r.requestedById === "string" ? sanitizeProjectHandoffText(r.requestedById, 500) : null,
    handoffReason: r.handoffReason as AgentPmoProjectHandoffReason,
    handoffUrgency: r.handoffUrgency as AgentPmoProjectHandoffUrgency,
    requestReason: sanitizeProjectHandoffText(r.requestReason, 2000),
    effectiveDate: typeof r.effectiveDate === "string" ? r.effectiveDate : null,
  };
}

export function normalizeCreateProjectHandoffGateInput(
  raw: unknown,
): import("./agent-pmo-project-handoff-types").CreateAgentPmoProjectHandoffGateInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid gate input");
  const r = raw as Record<string, unknown>;
  if (!r.workspaceId || typeof r.workspaceId !== "string") throw new Error("workspaceId required");
  if (!r.handoffRequestId || typeof r.handoffRequestId !== "string") throw new Error("handoffRequestId required");
  return {
    workspaceId: r.workspaceId,
    handoffRequestId: r.handoffRequestId,
    reviewedById: typeof r.reviewedById === "string" ? r.reviewedById : null,
  };
}

export function normalizeProjectHandoffGateDecisionInput(
  raw: unknown,
): RecordAgentPmoProjectHandoffGateDecisionInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid gate decision input");
  const r = raw as Record<string, unknown>;
  if (!r.workspaceId || typeof r.workspaceId !== "string") throw new Error("workspaceId required");
  if (!r.handoffGateId || typeof r.handoffGateId !== "string") throw new Error("handoffGateId required");
  if (!r.handoffRequestId || typeof r.handoffRequestId !== "string") throw new Error("handoffRequestId required");
  if (!validateAgentPmoProjectHandoffGateDecisionType(r.decision)) throw new Error("Valid decision required");
  if (!r.rationale || typeof r.rationale !== "string") throw new Error("rationale required");
  return {
    workspaceId: r.workspaceId,
    handoffGateId: r.handoffGateId,
    handoffRequestId: r.handoffRequestId,
    decision: r.decision as AgentPmoProjectHandoffGateDecisionType,
    rationale: sanitizeProjectHandoffText(r.rationale, 4000),
    decidedById: typeof r.decidedById === "string" ? r.decidedById : null,
  };
}

export function normalizeCreateProjectHandoffPackInput(
  raw: unknown,
): CreateAgentPmoProjectHandoffPackInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid pack input");
  const r = raw as Record<string, unknown>;
  if (!r.workspaceId || typeof r.workspaceId !== "string") throw new Error("workspaceId required");
  if (!r.handoffRequestId || typeof r.handoffRequestId !== "string") throw new Error("handoffRequestId required");
  return { workspaceId: r.workspaceId, handoffRequestId: r.handoffRequestId };
}

export function normalizeOutgoingPmNoteInput(raw: unknown): RecordAgentPmoOutgoingPmNoteInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid outgoing PM note input");
  const r = raw as Record<string, unknown>;
  if (!r.workspaceId || typeof r.workspaceId !== "string") throw new Error("workspaceId required");
  if (!r.handoffRequestId || typeof r.handoffRequestId !== "string") throw new Error("handoffRequestId required");
  if (!validateAgentPmoOutgoingPmNoteType(r.noteType)) throw new Error("Valid noteType required");
  if (!r.noteText || typeof r.noteText !== "string") throw new Error("noteText required");
  return {
    workspaceId: r.workspaceId,
    handoffRequestId: r.handoffRequestId,
    noteType: r.noteType as AgentPmoOutgoingPmNoteType,
    noteText: sanitizeProjectHandoffText(r.noteText, 6000),
    status: validateAgentPmoOutgoingPmNoteStatus(r.status) ? r.status as AgentPmoOutgoingPmNoteStatus : "draft",
    authorId: typeof r.authorId === "string" ? r.authorId : null,
  };
}

export function normalizeIncomingPmAcceptanceInput(raw: unknown): RecordAgentPmoIncomingPmAcceptanceInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid incoming PM acceptance input");
  const r = raw as Record<string, unknown>;
  if (!r.workspaceId || typeof r.workspaceId !== "string") throw new Error("workspaceId required");
  if (!r.handoffRequestId || typeof r.handoffRequestId !== "string") throw new Error("handoffRequestId required");
  if (!r.incomingPmId || typeof r.incomingPmId !== "string") throw new Error("incomingPmId required");
  if (!validateAgentPmoIncomingPmAcceptanceDecision(r.decision)) throw new Error("Valid decision required");
  if (!r.rationale || typeof r.rationale !== "string") throw new Error("rationale required");
  return {
    workspaceId: r.workspaceId,
    handoffRequestId: r.handoffRequestId,
    handoffPackId: typeof r.handoffPackId === "string" ? r.handoffPackId : null,
    incomingPmId: r.incomingPmId,
    decision: r.decision as AgentPmoIncomingPmAcceptanceDecision,
    rationale: sanitizeProjectHandoffText(r.rationale, 4000),
  };
}

export function normalizeCompleteProjectHandoffInput(raw: unknown): CompleteAgentPmoProjectHandoffInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid complete handoff input");
  const r = raw as Record<string, unknown>;
  if (!r.workspaceId || typeof r.workspaceId !== "string") throw new Error("workspaceId required");
  if (!r.handoffRequestId || typeof r.handoffRequestId !== "string") throw new Error("handoffRequestId required");
  if (!r.completionRationale || typeof r.completionRationale !== "string") throw new Error("completionRationale required");
  return {
    workspaceId: r.workspaceId,
    handoffRequestId: r.handoffRequestId,
    completionRationale: sanitizeProjectHandoffText(r.completionRationale, 4000),
    completedById: typeof r.completedById === "string" ? r.completedById : null,
  };
}

export function normalizeProjectHandoffExportInput(raw: unknown): GenerateAgentPmoProjectHandoffExportInput {
  if (!raw || typeof raw !== "object") throw new Error("Invalid export input");
  const r = raw as Record<string, unknown>;
  if (!r.workspaceId || typeof r.workspaceId !== "string") throw new Error("workspaceId required");
  if (!r.handoffRequestId || typeof r.handoffRequestId !== "string") throw new Error("handoffRequestId required");
  if (!validateAgentPmoProjectHandoffExportFormat(r.exportFormat)) throw new Error("Valid exportFormat required");
  return {
    workspaceId: r.workspaceId,
    handoffRequestId: r.handoffRequestId,
    exportFormat: r.exportFormat as AgentPmoProjectHandoffExportFormat,
    createdById: typeof r.createdById === "string" ? r.createdById : null,
  };
}

// ─── Evaluation Functions ─────────────────────────────────────────────────────

export function evaluateProjectContextValidationStatus(
  validations: AgentPmoProjectContextValidationRecord[],
): AgentPmoProjectContextValidationStatus {
  if (validations.length === 0) return "pending";
  if (validations.some((v) => v.status === "blocked")) return "blocked";
  if (validations.some((v) => v.status === "failed")) return "failed";
  if (validations.every((v) => v.status === "passed" || v.status === "waived")) return "passed";
  return "pending";
}

export function evaluateProjectHandoffGateReadiness(
  gate: AgentPmoProjectHandoffGateRecord | null,
): boolean {
  return gate?.gateStatus === "approved_for_handoff";
}

export function evaluateIncomingPmAcceptanceReadiness(
  acceptance: AgentPmoIncomingPmAcceptanceRecord | null,
): boolean {
  return acceptance?.acceptanceStatus === "accepted";
}

export function evaluateProjectHandoffCompletionReadiness(opts: {
  requestStatus: AgentPmoProjectHandoffRequestStatus;
  gateApproved: boolean;
  packExists: boolean;
  memorySnapshotExists: boolean;
  incomingPmAccepted: boolean;
}): { ready: boolean; reason: string } {
  if (opts.requestStatus !== "incoming_pm_accepted") {
    return { ready: false, reason: "Handoff request must be in incoming_pm_accepted status" };
  }
  if (!opts.gateApproved) {
    return { ready: false, reason: "PMO handoff gate must be approved" };
  }
  if (!opts.packExists) {
    return { ready: false, reason: "Handoff pack must exist" };
  }
  if (!opts.memorySnapshotExists) {
    return { ready: false, reason: "Project memory snapshot must exist" };
  }
  if (!opts.incomingPmAccepted) {
    return { ready: false, reason: "Incoming PM must have accepted the handoff" };
  }
  return { ready: true, reason: "All handoff completion requirements met" };
}

export function evaluateHandoffContinuityReadiness(
  requestStatus: AgentPmoProjectHandoffRequestStatus,
): boolean {
  return requestStatus === "handoff_completed";
}

export function deriveProjectHandoffRequestStatus(
  validationStatus: AgentPmoProjectContextValidationStatus,
): AgentPmoProjectHandoffRequestStatus {
  switch (validationStatus) {
    case "passed": return "ready_for_pmo_review";
    case "failed": return "context_validation_failed";
    case "blocked": return "blocked";
    default: return "context_validation_pending";
  }
}

export function validateProjectHandoffExportSafety(content: string): { safe: boolean; reason: string } {
  const forbidden = [
    "password", "secret", "token=", "apiKey", "Bearer ", "private_key",
    "credential", "access_token", "refresh_token", "session_cookie",
  ];
  for (const pattern of forbidden) {
    if (content.toLowerCase().includes(pattern.toLowerCase())) {
      return { safe: false, reason: `Export contains potentially sensitive pattern: ${pattern}` };
    }
  }
  if (content.length > 10 * 1024 * 1024) {
    return { safe: false, reason: "Export content exceeds 10 MB safety limit" };
  }
  return { safe: true, reason: "Export passed safety validation" };
}
