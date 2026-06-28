// ─── Agent Execution Request Runtime — Validation ─────────────────────────────

import type {
  AgentExecutionMode,
  AgentExecutionState,
  AgentExecutionRiskLevel,
  AgentExecutionScopeType,
  AgentExecutionSourceType,
  AgentExecutionEventType,
  AgentExecutionPreflightStatus,
  CreateAgentExecutionRequestInput,
} from "./agent-execution-types";

const EXECUTION_MODES: AgentExecutionMode[] = [
  "dry_run", "draft_only", "approval_required", "approved_execution",
];

const EXECUTION_STATES: AgentExecutionState[] = [
  "draft", "pending_preflight", "preflight_failed", "blocked",
  "pending_approval", "approved", "ready_for_execution", "executing",
  "completed", "failed", "cancelled", "expired",
];

const EXECUTION_RISK_LEVELS: AgentExecutionRiskLevel[] = [
  "low", "medium", "high", "critical",
];

const EXECUTION_SCOPE_TYPES: AgentExecutionScopeType[] = [
  "workspace", "portfolio", "project", "pm", "agent",
  "tool_request", "approval_request", "memory_record",
];

const EXECUTION_SOURCE_TYPES: AgentExecutionSourceType[] = [
  "api", "agent", "scheduler", "webhook", "system", "user",
];

const EXECUTION_EVENT_TYPES: AgentExecutionEventType[] = [
  "execution_request_created",
  "execution_request_updated",
  "execution_preflight_started",
  "execution_preflight_passed",
  "execution_preflight_failed",
  "execution_blocked",
  "execution_pending_approval",
  "execution_approved",
  "execution_ready",
  "execution_dry_run_completed",
  "execution_draft_completed",
  "execution_cancelled",
  "execution_expired",
  "execution_failed",
  "execution_state_transition",
];

const EXECUTION_PREFLIGHT_STATUSES: AgentExecutionPreflightStatus[] = [
  "not_started", "in_progress", "passed", "failed", "skipped",
];

const SENSITIVE_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token", "session_cookie", "cookie",
]);

const MAX_PAYLOAD_BYTES = 50 * 1024; // 50 KB

export function validateAgentExecutionMode(value: string): value is AgentExecutionMode {
  return (EXECUTION_MODES as string[]).includes(value);
}

export function validateAgentExecutionState(value: string): value is AgentExecutionState {
  return (EXECUTION_STATES as string[]).includes(value);
}

export function validateAgentExecutionRiskLevel(value: string): value is AgentExecutionRiskLevel {
  return (EXECUTION_RISK_LEVELS as string[]).includes(value);
}

export function validateAgentExecutionScopeType(value: string): value is AgentExecutionScopeType {
  return (EXECUTION_SCOPE_TYPES as string[]).includes(value);
}

export function validateAgentExecutionSourceType(value: string): value is AgentExecutionSourceType {
  return (EXECUTION_SOURCE_TYPES as string[]).includes(value);
}

export function validateAgentExecutionEventType(value: string): value is AgentExecutionEventType {
  return (EXECUTION_EVENT_TYPES as string[]).includes(value);
}

export function validateAgentExecutionPreflightStatus(value: string): value is AgentExecutionPreflightStatus {
  return (EXECUTION_PREFLIGHT_STATUSES as string[]).includes(value);
}

export function assertExecutionPayloadSerializable(value: unknown): void {
  if (value === null || value === undefined) return;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_PAYLOAD_BYTES) {
      throw new Error(`Execution payload exceeds maximum size of ${MAX_PAYLOAD_BYTES} bytes`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("maximum size")) throw err;
    throw new Error("Execution payload is not JSON-serializable");
  }
}

export function redactExecutionPayload(
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
      result[k] = redactExecutionPayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function normalizeCreateAgentExecutionRequestInput(
  input: CreateAgentExecutionRequestInput,
): CreateAgentExecutionRequestInput {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.toolKey) throw new Error("toolKey is required");
  if (!input.executionMode || !validateAgentExecutionMode(input.executionMode)) {
    throw new Error(`Invalid execution mode: ${input.executionMode}`);
  }
  if (!input.scopeType || !validateAgentExecutionScopeType(input.scopeType)) {
    throw new Error(`Invalid scope type: ${input.scopeType}`);
  }
  if (!input.sourceType || !validateAgentExecutionSourceType(input.sourceType)) {
    throw new Error(`Invalid source type: ${input.sourceType}`);
  }

  const title = (input.title ?? "").trim();
  if (!title) throw new Error("title is required");

  const riskLevel = input.riskLevel ?? "medium";
  if (!validateAgentExecutionRiskLevel(riskLevel)) {
    throw new Error(`Invalid risk level: ${riskLevel}`);
  }

  // Validate expiresAt is in the future
  if (input.expiresAt) {
    const expiresDate = new Date(input.expiresAt);
    if (isNaN(expiresDate.getTime())) throw new Error("expiresAt is not a valid date");
    if (expiresDate <= new Date()) throw new Error("expiresAt must be in the future");
  }

  if (input.inputPayload) assertExecutionPayloadSerializable(input.inputPayload);

  const rawMemoryIds = input.memoryIds ?? [];
  const memoryIds = [...new Set(rawMemoryIds.filter(Boolean))];

  const rawEvidenceRefs = input.evidenceRefs ?? [];
  const evidenceRefs = [...new Set(rawEvidenceRefs.filter(Boolean))];

  return {
    ...input,
    title,
    riskLevel,
    memoryIds,
    evidenceRefs,
  };
}
