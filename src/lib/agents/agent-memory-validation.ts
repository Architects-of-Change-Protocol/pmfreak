// ─── Agent Memory & Context — Validation ─────────────────────────────────────

import type {
  AgentContextScopeType,
  AgentMemoryKind,
  AgentMemoryStatus,
  AgentContextSensitivity,
  AgentContextSourceType,
  AgentMemoryRetentionPolicy,
  AgentMemoryEventType,
  AgentContextPolicyStatus,
  CreateAgentMemoryInput,
  CreateAgentContextPolicyInput,
} from "./agent-memory-types";

const CONTEXT_SCOPE_TYPES = new Set<AgentContextScopeType>([
  "workspace", "portfolio", "project", "pm", "agent", "tool_request", "approval_request",
]);
const MEMORY_KINDS = new Set<AgentMemoryKind>([
  "fact", "summary", "decision", "risk", "issue", "preference", "constraint",
  "lesson_learned", "operating_context", "evidence_reference",
]);
const MEMORY_STATUSES = new Set<AgentMemoryStatus>([
  "active", "stale", "expired", "revoked", "archived",
]);
const SENSITIVITIES = new Set<AgentContextSensitivity>([
  "public", "internal", "confidential", "restricted",
]);
const SOURCE_TYPES = new Set<AgentContextSourceType>([
  "manual", "project_record", "pm_profile", "capacity_snapshot", "performance_snapshot",
  "governance_event", "tool_request", "approval_decision", "executive_report",
  "uploaded_artifact", "meeting_notes", "system_generated",
]);
const RETENTION_POLICIES = new Set<AgentMemoryRetentionPolicy>([
  "session_only", "short_term", "project_lifetime", "workspace_lifetime", "custom",
]);
const EVENT_TYPES = new Set<AgentMemoryEventType>([
  "memory_created", "memory_updated", "memory_accessed", "memory_policy_evaluated",
  "memory_marked_stale", "memory_expired", "memory_revoked", "memory_archived",
  "sensitivity_changed", "retention_changed", "source_refreshed",
]);
const POLICY_STATUSES = new Set<AgentContextPolicyStatus>(["active", "disabled"]);

const SENSITIVE_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token",
]);

export function validateAgentContextScopeType(value: string): value is AgentContextScopeType {
  return CONTEXT_SCOPE_TYPES.has(value as AgentContextScopeType);
}

export function validateAgentMemoryKind(value: string): value is AgentMemoryKind {
  return MEMORY_KINDS.has(value as AgentMemoryKind);
}

export function validateAgentMemoryStatus(value: string): value is AgentMemoryStatus {
  return MEMORY_STATUSES.has(value as AgentMemoryStatus);
}

export function validateAgentContextSensitivity(value: string): value is AgentContextSensitivity {
  return SENSITIVITIES.has(value as AgentContextSensitivity);
}

export function validateAgentContextSourceType(value: string): value is AgentContextSourceType {
  return SOURCE_TYPES.has(value as AgentContextSourceType);
}

export function validateAgentMemoryRetentionPolicy(value: string): value is AgentMemoryRetentionPolicy {
  return RETENTION_POLICIES.has(value as AgentMemoryRetentionPolicy);
}

export function validateAgentMemoryEventType(value: string): value is AgentMemoryEventType {
  return EVENT_TYPES.has(value as AgentMemoryEventType);
}

export function validateAgentContextPolicyStatus(value: string): value is AgentContextPolicyStatus {
  return POLICY_STATUSES.has(value as AgentContextPolicyStatus);
}

export function assertAgentMemoryPayloadSerializable(value: unknown): void {
  if (value === null || value === undefined) return;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provenance/event payload must be a plain object.");
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[-_]/g, "");
    for (const bad of SENSITIVE_KEYS) {
      if (normalized.includes(bad.toLowerCase().replace(/[-_]/g, ""))) {
        throw new Error(`Payload contains sensitive-looking key: "${key}". Remove secrets from memory/event payloads.`);
      }
    }
  }
  try {
    JSON.stringify(value);
  } catch {
    throw new Error("Provenance/event payload is not JSON-serializable.");
  }
}

export function normalizeCreateAgentMemoryInput(input: CreateAgentMemoryInput): CreateAgentMemoryInput {
  if (!input.workspaceId) throw new Error("workspaceId is required.");

  if (!validateAgentContextScopeType(input.scopeType)) {
    throw new Error(`Invalid scopeType: "${input.scopeType}".`);
  }
  if (!validateAgentMemoryKind(input.memoryKind)) {
    throw new Error(`Invalid memoryKind: "${input.memoryKind}".`);
  }
  if (!validateAgentContextSourceType(input.sourceType)) {
    throw new Error(`Invalid sourceType: "${input.sourceType}".`);
  }

  const title = input.title?.trim() ?? "";
  if (!title) throw new Error("title is required.");
  if (title.length > 200) throw new Error("title must be 200 characters or fewer.");

  if (input.content && input.content.length > 20000) {
    throw new Error("content must be 20,000 characters or fewer.");
  }
  if (input.summary && input.summary.length > 5000) {
    throw new Error("summary must be 5,000 characters or fewer.");
  }
  if (input.sourceUri && input.sourceUri.length > 2000) {
    throw new Error("sourceUri must be 2,000 characters or fewer.");
  }

  const sensitivity = input.sensitivity ?? "internal";
  if (!validateAgentContextSensitivity(sensitivity)) {
    throw new Error(`Invalid sensitivity: "${sensitivity}".`);
  }

  const retentionPolicy = input.retentionPolicy ?? "short_term";
  if (!validateAgentMemoryRetentionPolicy(retentionPolicy)) {
    throw new Error(`Invalid retentionPolicy: "${retentionPolicy}".`);
  }

  if (retentionPolicy === "custom" && !input.retentionDays) {
    throw new Error("retentionDays is required when retentionPolicy is 'custom'.");
  }
  if (input.retentionDays !== undefined && input.retentionDays !== null) {
    if (input.retentionDays <= 0) throw new Error("retentionDays must be a positive number.");
    if (input.retentionDays > 3650) throw new Error("retentionDays must not exceed 3650.");
  }

  if (input.expiresAt) {
    if (new Date(input.expiresAt) <= new Date()) {
      throw new Error("expiresAt must be a future timestamp.");
    }
  }
  if (input.staleAt) {
    if (new Date(input.staleAt) <= new Date()) {
      throw new Error("staleAt must be a future timestamp.");
    }
  }

  if (input.provenance) {
    assertAgentMemoryPayloadSerializable(input.provenance);
  }

  return {
    ...input,
    title,
    sensitivity,
    retentionPolicy,
  };
}

export function normalizeCreateAgentContextPolicyInput(input: CreateAgentContextPolicyInput): CreateAgentContextPolicyInput {
  if (!input.workspaceId) throw new Error("workspaceId is required.");

  const policyKey = input.policyKey?.trim() ?? "";
  if (!policyKey) throw new Error("policyKey is required.");
  if (policyKey.length > 120) throw new Error("policyKey must be 120 characters or fewer.");
  if (!/^[a-z0-9_]+$/.test(policyKey)) throw new Error("policyKey must be lowercase snake_case (a-z, 0-9, _).");

  if (!input.displayName?.trim()) throw new Error("displayName is required.");

  const maxSensitivity = input.maxSensitivity ?? "internal";
  if (!validateAgentContextSensitivity(maxSensitivity)) {
    throw new Error(`Invalid maxSensitivity: "${maxSensitivity}".`);
  }

  const defaultRetentionPolicy = input.defaultRetentionPolicy ?? "short_term";
  if (!validateAgentMemoryRetentionPolicy(defaultRetentionPolicy)) {
    throw new Error(`Invalid defaultRetentionPolicy: "${defaultRetentionPolicy}".`);
  }

  const allowedScopeTypes = [...new Set(input.allowedScopeTypes ?? [])];
  for (const s of allowedScopeTypes) {
    if (!validateAgentContextScopeType(s)) throw new Error(`Invalid scope type in allowedScopeTypes: "${s}".`);
  }

  const allowedMemoryKinds = [...new Set(input.allowedMemoryKinds ?? [])];
  for (const k of allowedMemoryKinds) {
    if (!validateAgentMemoryKind(k)) throw new Error(`Invalid memory kind in allowedMemoryKinds: "${k}".`);
  }

  return {
    ...input,
    policyKey,
    displayName: input.displayName.trim(),
    maxSensitivity,
    defaultRetentionPolicy,
    allowedScopeTypes,
    allowedMemoryKinds,
  };
}
