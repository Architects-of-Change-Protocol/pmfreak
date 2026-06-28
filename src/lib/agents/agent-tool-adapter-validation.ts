// ─── Agent Tool Execution Adapter Layer — Validation ─────────────────────────

import type {
  AgentToolAdapterExecutionMode,
  AgentToolAdapterStatus,
  AgentToolAdapterExecutionStatus,
  AgentToolAdapterOutputType,
  AgentToolAdapterRiskPolicy,
  AgentToolAdapterSideEffectPolicy,
  AgentToolAdapterExecutionEventType,
  AgentToolAdapterDefinition,
} from "./agent-tool-adapter-types";

// ─── Type Validators ──────────────────────────────────────────────────────────

export function validateAgentToolAdapterExecutionMode(value: string): value is AgentToolAdapterExecutionMode {
  return value === "dry_run" || value === "draft_only";
}

export function validateAgentToolAdapterStatus(value: string): value is AgentToolAdapterStatus {
  return ["registered", "enabled", "disabled", "deprecated"].includes(value);
}

export function validateAgentToolAdapterExecutionStatus(value: string): value is AgentToolAdapterExecutionStatus {
  return ["queued", "running", "succeeded", "failed", "refused", "cancelled"].includes(value);
}

export function validateAgentToolAdapterOutputType(value: string): value is AgentToolAdapterOutputType {
  return [
    "noop", "simulation", "draft_email", "draft_task", "draft_project_update",
    "draft_report", "recommendation", "structured_summary", "risk_analysis", "governance_note",
  ].includes(value);
}

export function validateAgentToolAdapterRiskPolicy(value: string): value is AgentToolAdapterRiskPolicy {
  return ["low_only", "medium_or_lower", "high_with_approval", "critical_blocked"].includes(value);
}

export function validateAgentToolAdapterSideEffectPolicy(value: string): value is AgentToolAdapterSideEffectPolicy {
  return ["none", "internal_draft_only", "internal_record_only", "external_disabled"].includes(value);
}

export function validateAgentToolAdapterExecutionEventType(value: string): value is AgentToolAdapterExecutionEventType {
  return [
    "adapter_execution_created",
    "adapter_eligibility_checked",
    "adapter_execution_started",
    "adapter_execution_succeeded",
    "adapter_execution_failed",
    "adapter_execution_refused",
    "adapter_execution_cancelled",
  ].includes(value);
}

// ─── Normalize / Validate Definition ─────────────────────────────────────────

export function normalizeAgentToolAdapterDefinition(input: AgentToolAdapterDefinition): AgentToolAdapterDefinition {
  if (!input.adapterKey || typeof input.adapterKey !== "string" || input.adapterKey.trim() === "") {
    throw new Error("AgentToolAdapterDefinition: adapterKey must be a non-empty string");
  }
  if (!input.displayName || input.displayName.trim() === "") {
    throw new Error("AgentToolAdapterDefinition: displayName must be a non-empty string");
  }
  if (!validateAgentToolAdapterStatus(input.status)) {
    throw new Error(`AgentToolAdapterDefinition: invalid status "${input.status}"`);
  }
  if (!Array.isArray(input.supportedToolKeys) || input.supportedToolKeys.length === 0) {
    throw new Error("AgentToolAdapterDefinition: supportedToolKeys must be a non-empty array");
  }
  if (!Array.isArray(input.supportedExecutionModes) || input.supportedExecutionModes.length === 0) {
    throw new Error("AgentToolAdapterDefinition: supportedExecutionModes must be a non-empty array");
  }
  for (const mode of input.supportedExecutionModes) {
    if (!validateAgentToolAdapterExecutionMode(mode)) {
      throw new Error(`AgentToolAdapterDefinition: invalid execution mode "${mode}"`);
    }
  }
  if (!Array.isArray(input.outputTypes) || input.outputTypes.length === 0) {
    throw new Error("AgentToolAdapterDefinition: outputTypes must be a non-empty array");
  }
  for (const ot of input.outputTypes) {
    if (!validateAgentToolAdapterOutputType(ot)) {
      throw new Error(`AgentToolAdapterDefinition: invalid outputType "${ot}"`);
    }
  }
  if (!validateAgentToolAdapterRiskPolicy(input.riskPolicy)) {
    throw new Error(`AgentToolAdapterDefinition: invalid riskPolicy "${input.riskPolicy}"`);
  }
  if (!validateAgentToolAdapterSideEffectPolicy(input.sideEffectPolicy)) {
    throw new Error(`AgentToolAdapterDefinition: invalid sideEffectPolicy "${input.sideEffectPolicy}"`);
  }
  if (input.externalSideEffectsEnabled === true) {
    throw new Error("AgentToolAdapterDefinition: externalSideEffectsEnabled must be false — external side effects are not permitted");
  }

  // Deduplicate supportedToolKeys
  const deduped = Array.from(new Set(input.supportedToolKeys));

  return {
    ...input,
    adapterKey: input.adapterKey.trim(),
    displayName: input.displayName.trim(),
    supportedToolKeys: deduped,
  };
}

// ─── Serialization Safety ─────────────────────────────────────────────────────

export function assertAdapterOutputSerializable(value: unknown): void {
  try {
    JSON.stringify(value);
  } catch {
    throw new Error("Adapter output is not JSON-serializable");
  }
  // Reject undefined values buried in objects
  const str = JSON.stringify(value);
  if (str === undefined) {
    throw new Error("Adapter output is not JSON-serializable");
  }
}

// ─── Payload Redaction ────────────────────────────────────────────────────────

const REDACTED_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token", "session_cookie", "cookie",
]);

export function redactAdapterPayload(
  value: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (value === null) return null;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (REDACTED_KEYS.has(k)) {
      result[k] = "[REDACTED]";
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result[k] = redactAdapterPayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}
