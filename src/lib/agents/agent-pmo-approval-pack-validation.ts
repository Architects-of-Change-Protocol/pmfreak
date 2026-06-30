// ─── Controlled Governance Policy Simulation Report & PMO Approval Pack — Validation
// Pure validation helpers. No side effects. No external calls.
// Does not mutate policies, routing, scoring, or project state.

import type {
  AgentPmoSimulationReportStatus,
  AgentPmoSimulationReportSectionType,
  AgentPmoPolicyDiffChangeType,
  AgentPmoChecklistStatus,
  AgentPmoApprovalPackStatus,
  AgentPmoSignOffStatus,
  AgentPmoSignOffDecisionType,
  AgentPmoApprovalPackArtifactType,
  AgentPmoImplementationTicketDraftStatus,
  AgentPmoImplementationTicketDraftType,
  AgentPmoApprovalPackExportFormat,
  AgentPmoApprovalPackExportStatus,
  AgentPmoApprovalPackEventType,
  CreateAgentPmoSimulationReportInput,
  CreateAgentPmoApprovalPackInput,
  RecordAgentPmoSignOffDecisionInput,
  GenerateAgentPmoApprovalPackExportInput,
  AgentPmoApprovalChecklistItemRecord,
  AgentPmoRollbackReadinessChecklistItemRecord,
  AgentPmoApprovalPackRecord,
} from "./agent-pmo-approval-pack-types";

// ─── Blocked Content Patterns ─────────────────────────────────────────────────

const BLOCKED_PAYLOAD_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "private_key", "credential", "client_secret", "refresh_token", "access_token",
  "session_cookie", "cookie", "raw_payload", "payload", "outcomePayload",
  "safeOutcomePayload", "intendedSummary", "actualSummary", "rationale_from_learning",
  "failureMessage", "correctionReason", "customer", "client", "project_name",
  "email", "phone", "address",
]);

const FORBIDDEN_EXECUTABLE_TERMS = [
  "applyPolicy", "mutatePolicy", "updateLivePolicy", "changeLiveRouting",
  "updateLiveScoring", "executePolicyChange", "activatePolicy", "deployPolicy",
  "createJiraTicket", "createGithubIssue", "sendApprovalEmail",
  "sendSlackNotification", "implementPolicy",
];

// ─── Union Type Validators ────────────────────────────────────────────────────

export function validateAgentPmoSimulationReportStatus(v: string): AgentPmoSimulationReportStatus {
  const valid: AgentPmoSimulationReportStatus[] = [
    "created", "generating", "generated", "review_ready", "signed_off", "archived", "failed",
  ];
  if (valid.includes(v as AgentPmoSimulationReportStatus)) return v as AgentPmoSimulationReportStatus;
  return "created";
}

export function validateAgentPmoSimulationReportSectionType(v: string): AgentPmoSimulationReportSectionType {
  const valid: AgentPmoSimulationReportSectionType[] = [
    "executive_summary", "change_request_context", "simulation_scope", "historical_record_sample",
    "simulation_results", "impact_analysis", "policy_draft_summary", "approval_status",
    "rollback_readiness", "implementation_readiness", "risk_statement", "limitations", "non_goals",
  ];
  if (valid.includes(v as AgentPmoSimulationReportSectionType)) return v as AgentPmoSimulationReportSectionType;
  return "executive_summary";
}

export function validateAgentPmoPolicyDiffChangeType(v: string): AgentPmoPolicyDiffChangeType {
  const valid: AgentPmoPolicyDiffChangeType[] = ["added", "removed", "changed", "unchanged", "unknown"];
  if (valid.includes(v as AgentPmoPolicyDiffChangeType)) return v as AgentPmoPolicyDiffChangeType;
  return "unknown";
}

export function validateAgentPmoChecklistStatus(v: string): AgentPmoChecklistStatus {
  const valid: AgentPmoChecklistStatus[] = [
    "not_started", "pending", "passed", "failed", "blocked", "not_applicable",
  ];
  if (valid.includes(v as AgentPmoChecklistStatus)) return v as AgentPmoChecklistStatus;
  return "not_started";
}

export function validateAgentPmoApprovalPackStatus(v: string): AgentPmoApprovalPackStatus {
  const valid: AgentPmoApprovalPackStatus[] = [
    "created", "assembling", "assembled", "review_ready", "signed_off",
    "changes_requested", "archived", "failed",
  ];
  if (valid.includes(v as AgentPmoApprovalPackStatus)) return v as AgentPmoApprovalPackStatus;
  return "created";
}

export function validateAgentPmoSignOffStatus(v: string): AgentPmoSignOffStatus {
  const valid: AgentPmoSignOffStatus[] = [
    "created", "under_review", "approved_for_implementation_planning",
    "rejected", "changes_requested", "archived",
  ];
  if (valid.includes(v as AgentPmoSignOffStatus)) return v as AgentPmoSignOffStatus;
  return "created";
}

export function validateAgentPmoSignOffDecisionType(v: string): AgentPmoSignOffDecisionType {
  const valid: AgentPmoSignOffDecisionType[] = [
    "approve_for_implementation_planning", "reject", "request_changes", "archive",
  ];
  if (valid.includes(v as AgentPmoSignOffDecisionType)) return v as AgentPmoSignOffDecisionType;
  return "reject";
}

export function validateAgentPmoApprovalPackArtifactType(v: string): AgentPmoApprovalPackArtifactType {
  const valid: AgentPmoApprovalPackArtifactType[] = [
    "simulation_report", "impact_summary", "policy_draft_diff", "approval_checklist",
    "rollback_checklist", "signoff_packet", "implementation_ticket_draft", "export_bundle",
  ];
  if (valid.includes(v as AgentPmoApprovalPackArtifactType)) return v as AgentPmoApprovalPackArtifactType;
  return "simulation_report";
}

export function validateAgentPmoImplementationTicketDraftStatus(v: string): AgentPmoImplementationTicketDraftStatus {
  const valid: AgentPmoImplementationTicketDraftStatus[] = [
    "created", "review_ready", "blocked_until_signoff", "archived",
  ];
  if (valid.includes(v as AgentPmoImplementationTicketDraftStatus)) return v as AgentPmoImplementationTicketDraftStatus;
  return "created";
}

export function validateAgentPmoImplementationTicketDraftType(v: string): AgentPmoImplementationTicketDraftType {
  const valid: AgentPmoImplementationTicketDraftType[] = [
    "implementation_planning", "future_sprint_candidate", "policy_change_preparation",
  ];
  if (valid.includes(v as AgentPmoImplementationTicketDraftType)) return v as AgentPmoImplementationTicketDraftType;
  return "implementation_planning";
}

export function validateAgentPmoApprovalPackExportFormat(v: string): AgentPmoApprovalPackExportFormat {
  const valid: AgentPmoApprovalPackExportFormat[] = ["markdown", "json", "csv"];
  if (valid.includes(v as AgentPmoApprovalPackExportFormat)) return v as AgentPmoApprovalPackExportFormat;
  return "markdown";
}

export function validateAgentPmoApprovalPackExportStatus(v: string): AgentPmoApprovalPackExportStatus {
  const valid: AgentPmoApprovalPackExportStatus[] = [
    "created", "generating", "generated", "failed", "archived",
  ];
  if (valid.includes(v as AgentPmoApprovalPackExportStatus)) return v as AgentPmoApprovalPackExportStatus;
  return "created";
}

export function validateAgentPmoApprovalPackEventType(v: string): AgentPmoApprovalPackEventType {
  const valid: AgentPmoApprovalPackEventType[] = [
    "approval_pack_created", "approval_pack_assembling", "approval_pack_assembled",
    "simulation_report_created", "simulation_report_section_created", "impact_summary_created",
    "policy_draft_diff_created", "approval_checklist_created", "approval_checklist_item_recorded",
    "rollback_checklist_created", "rollback_checklist_item_recorded", "signoff_packet_created",
    "signoff_decision_recorded", "implementation_ticket_draft_created",
    "approval_pack_export_created", "approval_pack_archived",
  ];
  if (valid.includes(v as AgentPmoApprovalPackEventType)) return v as AgentPmoApprovalPackEventType;
  return "approval_pack_created";
}

// ─── Payload Safety ───────────────────────────────────────────────────────────

export function assertApprovalPackPayloadSerializable(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (json.length > 50 * 1024) {
    throw new Error("Approval pack payload exceeds 50 KB limit.");
  }
}

export function redactApprovalPackPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (BLOCKED_PAYLOAD_KEYS.has(k)) {
      result[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result[k] = redactApprovalPackPayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function sanitizeApprovalPackText(text: string, maxLen = 6000): string {
  if (typeof text !== "string") return "";
  let s = text.trim();
  for (const term of FORBIDDEN_EXECUTABLE_TERMS) {
    s = s.replaceAll(term, "[BLOCKED]");
  }
  return s.slice(0, maxLen);
}

export function dedupeApprovalPackStrings(arr: string[]): string[] {
  return [...new Set((Array.isArray(arr) ? arr : []).filter((s) => typeof s === "string"))];
}

// ─── Input Normalizers ────────────────────────────────────────────────────────

export function normalizeCreateSimulationReportInput(input: CreateAgentPmoSimulationReportInput): CreateAgentPmoSimulationReportInput {
  if (!input.workspaceId) throw new Error("workspaceId required");
  if (!input.changeRequestId) throw new Error("changeRequestId required");
  return {
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    actorId: input.actorId ?? null,
  };
}

export function normalizeCreateApprovalPackInput(input: CreateAgentPmoApprovalPackInput): CreateAgentPmoApprovalPackInput {
  if (!input.workspaceId) throw new Error("workspaceId required");
  if (!input.changeRequestId) throw new Error("changeRequestId required");
  return {
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    actorId: input.actorId ?? null,
  };
}

export function normalizeSignOffDecisionInput(input: RecordAgentPmoSignOffDecisionInput): RecordAgentPmoSignOffDecisionInput {
  if (!input.workspaceId) throw new Error("workspaceId required");
  if (!input.signOffPacketId) throw new Error("signOffPacketId required");
  if (!input.rationale) throw new Error("rationale required");
  const rationale = sanitizeApprovalPackText(input.rationale, 4000);
  if (!rationale) throw new Error("rationale required");
  return {
    workspaceId: input.workspaceId,
    signOffPacketId: input.signOffPacketId,
    approvalPackId: input.approvalPackId ?? null,
    decisionType: validateAgentPmoSignOffDecisionType(input.decisionType),
    rationale,
    decidedBy: input.decidedBy ?? null,
  };
}

export function normalizeApprovalPackExportInput(input: GenerateAgentPmoApprovalPackExportInput): GenerateAgentPmoApprovalPackExportInput {
  if (!input.workspaceId) throw new Error("workspaceId required");
  if (!input.approvalPackId) throw new Error("approvalPackId required");
  return {
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId,
    exportFormat: validateAgentPmoApprovalPackExportFormat(input.exportFormat),
    actorId: input.actorId ?? null,
  };
}

// ─── Checklist Evaluation ─────────────────────────────────────────────────────

export function evaluateApprovalChecklistStatus(
  items: AgentPmoApprovalChecklistItemRecord[],
): AgentPmoChecklistStatus {
  if (items.length === 0) return "not_started";
  const statuses = items.map((i) => i.status);
  if (statuses.some((s) => s === "failed" || s === "blocked")) return "failed";
  if (statuses.every((s) => s === "passed" || s === "not_applicable")) return "passed";
  if (statuses.some((s) => s === "pending")) return "pending";
  return "not_started";
}

export function evaluateRollbackChecklistStatus(
  items: AgentPmoRollbackReadinessChecklistItemRecord[],
): AgentPmoChecklistStatus {
  if (items.length === 0) return "not_started";
  const statuses = items.map((i) => i.status);
  if (statuses.some((s) => s === "failed" || s === "blocked")) return "failed";
  if (statuses.every((s) => s === "passed" || s === "not_applicable")) return "passed";
  if (statuses.some((s) => s === "pending")) return "pending";
  return "not_started";
}

// ─── Export Safety Validation ─────────────────────────────────────────────────

const EXPORT_BLOCKED_PATTERNS = [
  /password/i, /secret/i, /\btoken\b/i, /apiKey/i, /api_key/i,
  /authorization/i, /private_key/i, /credential/i, /raw_payload/i,
  /outcomePayload/i, /failureMessage/i, /correctionReason/i,
  /actualSummary/i, /intendedSummary/i,
];

export function validateApprovalPackExportSafety(content: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];
  for (const pattern of EXPORT_BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(`Blocked pattern detected: ${pattern.source}`);
    }
  }
  return { safe: issues.length === 0, issues };
}

// ─── Pack Status Derivation ───────────────────────────────────────────────────

export function deriveApprovalPackStatus(pack: Partial<AgentPmoApprovalPackRecord>): AgentPmoApprovalPackStatus {
  if (!pack.simulationReportId || !pack.impactSummaryId || !pack.draftDiffId) return "assembling";
  if (!pack.approvalChecklistId || !pack.rollbackChecklistId) return "assembling";
  if (!pack.signOffPacketId) return "assembled";
  return "review_ready";
}
