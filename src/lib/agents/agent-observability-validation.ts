// ─── Agent Observability & Audit Trail — Validation ──────────────────────────

import type {
  AgentAuditEventCategory,
  AgentAuditEventType,
  AgentAuditSeverity,
  AgentAuditOutcome,
  AgentAuditSourceType,
  AgentAuditScopeType,
  AgentDecisionType,
  AgentDecisionStatus,
  AgentAuditExportFormat,
  CreateAgentAuditEventInput,
  CreateAgentDecisionEventInput,
} from "./agent-observability-types";

const AUDIT_EVENT_CATEGORIES: AgentAuditEventCategory[] = [
  "agent", "tool", "approval", "memory", "context",
  "decision", "governance", "reporting", "security", "system", "execution",
];

const AUDIT_EVENT_TYPES: AgentAuditEventType[] = [
  "agent_registered", "agent_updated",
  "tool_eligibility_checked", "tool_request_created", "tool_request_approved",
  "tool_request_rejected", "tool_request_cancelled", "tool_request_revoked",
  "memory_created", "memory_accessed", "memory_marked_stale", "memory_expired",
  "memory_revoked", "memory_archived",
  "context_policy_created", "context_policy_updated",
  "decision_recorded", "recommendation_recorded", "classification_recorded",
  "governance_event_recorded", "report_generated",
  "access_denied", "policy_denied", "sensitive_payload_rejected", "audit_export_created",
  "execution_request_created", "execution_request_updated",
  "execution_preflight_started", "execution_preflight_passed", "execution_preflight_failed",
  "execution_blocked", "execution_pending_approval", "execution_approved",
  "execution_ready", "execution_dry_run_completed", "execution_draft_completed",
  "execution_cancelled", "execution_expired", "execution_failed",
];

const AUDIT_SEVERITIES: AgentAuditSeverity[] = ["info", "notice", "warning", "high", "critical"];

const AUDIT_OUTCOMES: AgentAuditOutcome[] = [
  "success", "denied", "pending", "failed", "cancelled", "revoked", "expired",
];

const AUDIT_SOURCE_TYPES: AgentAuditSourceType[] = [
  "agent_specification", "agent_tool_registry", "agent_tool_approval",
  "agent_memory_context", "agent_execution_runtime", "pmo_governance", "pmo_command_center",
  "executive_reporting", "system", "api",
];

const AUDIT_SCOPE_TYPES: AgentAuditScopeType[] = [
  "workspace", "portfolio", "project", "pm", "agent",
  "tool_request", "approval_request", "memory_record", "context_policy", "report",
];

const DECISION_TYPES: AgentDecisionType[] = [
  "classification", "recommendation", "risk_assessment",
  "intervention_suggestion", "summary", "governance_assessment", "next_action",
];

const DECISION_STATUSES: AgentDecisionStatus[] = [
  "draft", "proposed", "accepted", "rejected", "superseded", "archived",
];

const EXPORT_FORMATS: AgentAuditExportFormat[] = ["json", "csv", "markdown"];

const SENSITIVE_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token", "session_cookie", "cookie",
]);

const MAX_PAYLOAD_BYTES = 50 * 1024; // 50 KB

export function validateAgentAuditEventCategory(value: string): value is AgentAuditEventCategory {
  return (AUDIT_EVENT_CATEGORIES as string[]).includes(value);
}

export function validateAgentAuditEventType(value: string): value is AgentAuditEventType {
  return (AUDIT_EVENT_TYPES as string[]).includes(value);
}

export function validateAgentAuditSeverity(value: string): value is AgentAuditSeverity {
  return (AUDIT_SEVERITIES as string[]).includes(value);
}

export function validateAgentAuditOutcome(value: string): value is AgentAuditOutcome {
  return (AUDIT_OUTCOMES as string[]).includes(value);
}

export function validateAgentAuditSourceType(value: string): value is AgentAuditSourceType {
  return (AUDIT_SOURCE_TYPES as string[]).includes(value);
}

export function validateAgentAuditScopeType(value: string): value is AgentAuditScopeType {
  return (AUDIT_SCOPE_TYPES as string[]).includes(value);
}

export function validateAgentDecisionType(value: string): value is AgentDecisionType {
  return (DECISION_TYPES as string[]).includes(value);
}

export function validateAgentDecisionStatus(value: string): value is AgentDecisionStatus {
  return (DECISION_STATUSES as string[]).includes(value);
}

export function validateAgentAuditExportFormat(value: string): value is AgentAuditExportFormat {
  return (EXPORT_FORMATS as string[]).includes(value);
}

export function assertAuditPayloadSerializable(value: unknown): void {
  if (value === null || value === undefined) return;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_PAYLOAD_BYTES) {
      throw new Error(`Audit payload exceeds maximum size of ${MAX_PAYLOAD_BYTES} bytes`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("maximum size")) throw err;
    throw new Error("Audit payload is not JSON-serializable");
  }
}

export function redactAuditPayload(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!value) return null;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const keyLower = k.toLowerCase().replace(/_/g, "");
    const isSensitive = SENSITIVE_KEYS.has(k) || SENSITIVE_KEYS.has(keyLower) ||
      [...SENSITIVE_KEYS].some(s => keyLower.includes(s.replace(/_/g, "")));
    if (isSensitive) {
      result[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result[k] = redactAuditPayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function normalizeCreateAgentAuditEventInput(
  input: CreateAgentAuditEventInput,
): CreateAgentAuditEventInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.category || !validateAgentAuditEventCategory(input.category)) {
    throw new Error(`Invalid audit event category: ${input.category}`);
  }
  if (!input.eventType || !validateAgentAuditEventType(input.eventType)) {
    throw new Error(`Invalid audit event type: ${input.eventType}`);
  }
  if (!input.sourceType || !validateAgentAuditSourceType(input.sourceType)) {
    throw new Error(`Invalid audit source type: ${input.sourceType}`);
  }
  if (!input.scopeType || !validateAgentAuditScopeType(input.scopeType)) {
    throw new Error(`Invalid audit scope type: ${input.scopeType}`);
  }
  const severity = input.severity ?? "info";
  if (!validateAgentAuditSeverity(severity)) throw new Error(`Invalid severity: ${severity}`);
  const outcome = input.outcome ?? "success";
  if (!validateAgentAuditOutcome(outcome)) throw new Error(`Invalid outcome: ${outcome}`);

  const title = (input.title ?? "").trim();
  if (!title) throw new Error("title is required");
  if (title.length > 240) throw new Error("title must be 240 characters or fewer");

  const message = input.message ? input.message.trim().slice(0, 4000) : null;
  const reasonCode = input.reasonCode ? input.reasonCode.trim().slice(0, 160) : null;

  if (input.payload) assertAuditPayloadSerializable(input.payload);

  const rawRefs = input.evidenceRefs ?? [];
  const evidenceRefs = [...new Set(rawRefs.filter(Boolean))];

  return {
    ...input,
    severity,
    outcome,
    title,
    message: message || null,
    reasonCode: reasonCode || null,
    evidenceRefs,
  };
}

export function normalizeCreateAgentDecisionEventInput(
  input: CreateAgentDecisionEventInput,
): CreateAgentDecisionEventInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.decisionType || !validateAgentDecisionType(input.decisionType)) {
    throw new Error(`Invalid decision type: ${input.decisionType}`);
  }
  if (!input.scopeType || !validateAgentAuditScopeType(input.scopeType)) {
    throw new Error(`Invalid scope type: ${input.scopeType}`);
  }
  const status = input.status ?? "draft";
  if (!validateAgentDecisionStatus(status)) throw new Error(`Invalid decision status: ${status}`);

  const title = (input.title ?? "").trim();
  if (!title) throw new Error("title is required");
  if (title.length > 240) throw new Error("title must be 240 characters or fewer");

  if (input.confidenceScore !== null && input.confidenceScore !== undefined) {
    if (input.confidenceScore < 0 || input.confidenceScore > 1) {
      throw new Error("confidenceScore must be between 0 and 1");
    }
  }

  if (input.decisionPayload) assertAuditPayloadSerializable(input.decisionPayload);

  const rawRefs = input.evidenceRefs ?? [];
  const evidenceRefs = [...new Set(rawRefs.filter(Boolean))];

  return { ...input, status, title, evidenceRefs };
}
