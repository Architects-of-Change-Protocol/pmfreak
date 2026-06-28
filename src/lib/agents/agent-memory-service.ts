// ─── Agent Memory & Context — Service ────────────────────────────────────────

import { normalizeCreateAgentMemoryInput, normalizeCreateAgentContextPolicyInput } from "./agent-memory-validation";
import { evaluateMemoryPolicy, calculateExpiration, isSensitivityAllowed } from "./agent-memory-policy";
import {
  upsertAgentContextPolicy,
  getAgentContextPolicyByKey,
  createAgentMemory,
  getAgentMemoryById,
  listAgentMemories,
  updateAgentMemoryStatus,
  markAgentMemoryAccessed,
  recordAgentMemoryEvent,
} from "./agent-memory-registry";
import type {
  AgentContextPolicyRecord,
  AgentMemoryRecord,
  AgentMemoryAccessResult,
  AgentMemoryAccessCheckInput,
  AgentContextScopeType,
  AgentContextSensitivity,
  CreateAgentMemoryInput,
} from "./agent-memory-types";

const DEFAULT_POLICY_KEY = "default_agent_context_policy";

export async function ensureDefaultAgentContextPolicy(workspaceId: string): Promise<AgentContextPolicyRecord> {
  return upsertAgentContextPolicy(normalizeCreateAgentContextPolicyInput({
    workspaceId,
    policyKey: DEFAULT_POLICY_KEY,
    displayName: "Default Agent Context Policy",
    description: "Workspace default policy governing agent memory scope, sensitivity, and retention.",
    allowedScopeTypes: ["workspace", "portfolio", "project", "pm", "agent", "tool_request", "approval_request"],
    allowedMemoryKinds: ["fact", "summary", "decision", "risk", "issue", "preference", "constraint", "lesson_learned", "operating_context", "evidence_reference"],
    maxSensitivity: "confidential",
    defaultRetentionPolicy: "short_term",
    defaultRetentionDays: 30,
    allowCrossProjectMemory: false,
    allowCrossPmMemory: false,
    allowPortfolioMemory: true,
    allowRestrictedMemory: false,
    requireApprovalForConfidential: true,
    requireApprovalForRestricted: true,
    hideExpiredMemory: true,
  }));
}

export async function createGovernedAgentMemory(
  input: CreateAgentMemoryInput & { policyKey?: string }
): Promise<AgentMemoryRecord> {
  const normalized = normalizeCreateAgentMemoryInput(input);

  const policyKey = input.policyKey ?? DEFAULT_POLICY_KEY;
  let policy = await getAgentContextPolicyByKey(normalized.workspaceId, policyKey);
  if (!policy) {
    policy = await ensureDefaultAgentContextPolicy(normalized.workspaceId);
  }

  const evaluation = evaluateMemoryPolicy({ policy, memory: normalized });

  await recordAgentMemoryEvent({
    workspaceId: normalized.workspaceId,
    eventType: "memory_policy_evaluated",
    eventPayload: {
      policyKey,
      reasonCode: evaluation.reasonCode,
      allowed: evaluation.allowed,
      requiresApproval: evaluation.requiresApproval,
    },
  });

  if (!evaluation.allowed && !evaluation.requiresApproval) {
    throw new Error(`Memory creation denied by policy: ${evaluation.message} (${evaluation.reasonCode})`);
  }

  // If approval required, create memory as stale (pending governance review)
  const initialStatus = evaluation.requiresApproval ? "stale" : undefined;

  const expiresAt = normalized.expiresAt ?? calculateExpiration({
    retentionPolicy: normalized.retentionPolicy ?? "short_term",
    retentionDays: normalized.retentionDays,
    createdAt: new Date(),
  });

  const memory = await createAgentMemory({ ...normalized, expiresAt } as Parameters<typeof createAgentMemory>[0]);

  if (initialStatus === "stale") {
    await updateAgentMemoryStatus({ workspaceId: normalized.workspaceId, memoryId: memory.id, status: "stale" });
  }

  await recordAgentMemoryEvent({
    workspaceId: normalized.workspaceId,
    memoryId: memory.id,
    eventType: "memory_created",
    actorId: normalized.createdBy ?? null,
    eventPayload: { scopeType: memory.scopeType, memoryKind: memory.memoryKind, sensitivity: memory.sensitivity },
  });

  if (initialStatus === "stale") {
    return { ...memory, status: "stale" };
  }
  return memory;
}

export async function checkAgentMemoryAccess(input: AgentMemoryAccessCheckInput): Promise<AgentMemoryAccessResult> {
  const memory = await getAgentMemoryById(input.workspaceId, input.memoryId);

  if (!memory) {
    return { memoryId: input.memoryId, accessState: "denied", allowed: false, reasonCode: "memory_not_found", message: "Memory record not found." };
  }

  if (memory.status === "expired") {
    return { memoryId: input.memoryId, accessState: "expired", allowed: false, reasonCode: "memory_expired", message: "Memory has expired and cannot be used." };
  }
  if (memory.status === "revoked") {
    return { memoryId: input.memoryId, accessState: "revoked", allowed: false, reasonCode: "memory_revoked", message: "Memory has been revoked." };
  }
  if (memory.status === "stale") {
    return { memoryId: input.memoryId, accessState: "stale", allowed: false, reasonCode: "memory_stale", message: "Memory is stale and requires refresh before use." };
  }

  if (input.allowedSensitivity) {
    if (!isSensitivityAllowed({ memorySensitivity: memory.sensitivity, allowedSensitivity: input.allowedSensitivity })) {
      return {
        memoryId: input.memoryId,
        accessState: "denied",
        allowed: false,
        reasonCode: "sensitivity_not_allowed",
        message: `Memory sensitivity "${memory.sensitivity}" exceeds allowed level "${input.allowedSensitivity}".`,
        sensitivity: memory.sensitivity,
      };
    }
  }

  // Mark access
  await markAgentMemoryAccessed({ workspaceId: input.workspaceId, memoryId: input.memoryId, actorId: null });
  await recordAgentMemoryEvent({
    workspaceId: input.workspaceId,
    memoryId: input.memoryId,
    eventType: "memory_accessed",
    eventPayload: { agentType: input.agentType ?? null, scopeType: input.scopeType ?? null },
  });

  return { memoryId: input.memoryId, accessState: "allowed", allowed: true, reasonCode: "allowed", message: "Memory access granted.", sensitivity: memory.sensitivity };
}

export async function listAvailableMemoryForAgent(input: {
  workspaceId: string;
  agentId?: string | null;
  agentType?: string | null;
  scopeType?: AgentContextScopeType;
  scopeId?: string | null;
  allowedSensitivity?: AgentContextSensitivity;
  includeStale?: boolean;
  limit?: number;
}): Promise<AgentMemoryRecord[]> {
  const records = await listAgentMemories(input.workspaceId, {
    agentId: input.agentId ?? undefined,
    agentType: input.agentType ?? undefined,
    scopeType: input.scopeType,
    scopeId: input.scopeId ?? undefined,
    limit: input.limit,
  });

  return records.filter((m) => {
    if (m.status === "archived") return false;
    if (m.status === "stale" && !input.includeStale) return false;
    if (input.allowedSensitivity && !isSensitivityAllowed({ memorySensitivity: m.sensitivity, allowedSensitivity: input.allowedSensitivity })) return false;
    if (m.sensitivity === "restricted") return false;
    return true;
  });
}

async function changeMemoryStatus(input: {
  workspaceId: string;
  memoryId: string;
  actorId?: string | null;
  reason?: string | null;
  status: "stale" | "expired" | "revoked" | "archived";
  eventType: "memory_marked_stale" | "memory_expired" | "memory_revoked" | "memory_archived";
}): Promise<AgentMemoryRecord> {
  const updated = await updateAgentMemoryStatus({
    workspaceId: input.workspaceId,
    memoryId: input.memoryId,
    status: input.status,
    actorId: input.actorId,
    reason: input.reason,
  });
  await recordAgentMemoryEvent({
    workspaceId: input.workspaceId,
    memoryId: input.memoryId,
    eventType: input.eventType,
    actorId: input.actorId ?? null,
    eventPayload: input.reason ? { reason: input.reason } : undefined,
  });
  return updated;
}

export async function markMemoryStale(input: { workspaceId: string; memoryId: string; actorId?: string | null; reason?: string | null }): Promise<AgentMemoryRecord> {
  return changeMemoryStatus({ ...input, status: "stale", eventType: "memory_marked_stale" });
}

export async function expireMemory(input: { workspaceId: string; memoryId: string; actorId?: string | null; reason?: string | null }): Promise<AgentMemoryRecord> {
  return changeMemoryStatus({ ...input, status: "expired", eventType: "memory_expired" });
}

export async function revokeMemory(input: { workspaceId: string; memoryId: string; actorId?: string | null; reason?: string | null }): Promise<AgentMemoryRecord> {
  return changeMemoryStatus({ ...input, status: "revoked", eventType: "memory_revoked" });
}

export async function archiveMemory(input: { workspaceId: string; memoryId: string; actorId?: string | null; reason?: string | null }): Promise<AgentMemoryRecord> {
  return changeMemoryStatus({ ...input, status: "archived", eventType: "memory_archived" });
}
