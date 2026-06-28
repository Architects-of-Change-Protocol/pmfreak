// ─── Agent Memory & Context — Service ────────────────────────────────────────

import { normalizeCreateAgentMemoryInput, normalizeCreateAgentContextPolicyInput } from "./agent-memory-validation";
import { evaluateMemoryPolicy, calculateExpiration, isSensitivityAllowed, getSensitivityRank } from "./agent-memory-policy";
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

// In-memory fallback used when RLS blocks policy creation for non-admin members.
// Provides safe conservative defaults without requiring a DB write.
const DEFAULT_POLICY_FALLBACK: Omit<AgentContextPolicyRecord, "id" | "workspaceId" | "createdAt" | "updatedAt" | "createdBy"> = {
  policyKey: DEFAULT_POLICY_KEY,
  displayName: "Default Agent Context Policy",
  description: null,
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
  status: "active",
};

export async function ensureDefaultAgentContextPolicy(workspaceId: string): Promise<AgentContextPolicyRecord> {
  // Try to read first (always allowed for members)
  const existing = await getAgentContextPolicyByKey(workspaceId, DEFAULT_POLICY_KEY);
  if (existing) return existing;

  // Attempt to create (requires admin — may fail for regular members)
  try {
    return await upsertAgentContextPolicy(normalizeCreateAgentContextPolicyInput({
      workspaceId,
      policyKey: DEFAULT_POLICY_KEY,
      displayName: DEFAULT_POLICY_FALLBACK.displayName,
      description: DEFAULT_POLICY_FALLBACK.description,
      allowedScopeTypes: DEFAULT_POLICY_FALLBACK.allowedScopeTypes,
      allowedMemoryKinds: DEFAULT_POLICY_FALLBACK.allowedMemoryKinds,
      maxSensitivity: DEFAULT_POLICY_FALLBACK.maxSensitivity,
      defaultRetentionPolicy: DEFAULT_POLICY_FALLBACK.defaultRetentionPolicy,
      defaultRetentionDays: DEFAULT_POLICY_FALLBACK.defaultRetentionDays,
      allowCrossProjectMemory: DEFAULT_POLICY_FALLBACK.allowCrossProjectMemory,
      allowCrossPmMemory: DEFAULT_POLICY_FALLBACK.allowCrossPmMemory,
      allowPortfolioMemory: DEFAULT_POLICY_FALLBACK.allowPortfolioMemory,
      allowRestrictedMemory: DEFAULT_POLICY_FALLBACK.allowRestrictedMemory,
      requireApprovalForConfidential: DEFAULT_POLICY_FALLBACK.requireApprovalForConfidential,
      requireApprovalForRestricted: DEFAULT_POLICY_FALLBACK.requireApprovalForRestricted,
      hideExpiredMemory: DEFAULT_POLICY_FALLBACK.hideExpiredMemory,
    }));
  } catch {
    // RLS denied creation (non-admin member) — return in-memory default so creation can proceed
    const now = new Date().toISOString();
    return { id: "default", workspaceId, createdBy: null, createdAt: now, updatedAt: now, ...DEFAULT_POLICY_FALLBACK };
  }
}

export async function createGovernedAgentMemory(
  input: CreateAgentMemoryInput & { policyKey?: string; createdBy?: string | null }
): Promise<AgentMemoryRecord> {
  const normalized = normalizeCreateAgentMemoryInput(input);

  const policyKey = input.policyKey ?? DEFAULT_POLICY_KEY;
  let policy = await getAgentContextPolicyByKey(normalized.workspaceId, policyKey);
  if (!policy) {
    policy = await ensureDefaultAgentContextPolicy(normalized.workspaceId);
  }

  // Apply policy defaults for retention when the caller did not explicitly set them
  const effectiveRetentionPolicy = normalized.retentionPolicy === "short_term" && !input.retentionPolicy
    ? policy.defaultRetentionPolicy
    : normalized.retentionPolicy;
  const effectiveRetentionDays = normalized.retentionDays == null && effectiveRetentionPolicy === "short_term"
    ? (policy.defaultRetentionDays ?? 30)
    : normalized.retentionDays;

  const evaluation = evaluateMemoryPolicy({ policy, memory: { ...normalized, retentionPolicy: effectiveRetentionPolicy } });

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

  const expiresAt = normalized.expiresAt ?? calculateExpiration({
    retentionPolicy: effectiveRetentionPolicy ?? "short_term",
    retentionDays: effectiveRetentionDays,
    createdAt: new Date(),
  });

  // Insert with the correct initial status — never insert active then update to stale,
  // as the update may fail under RLS for non-admin members.
  const initialStatus = evaluation.requiresApproval ? "stale" : "active";

  const memory = await createAgentMemory({
    ...normalized,
    retentionPolicy: effectiveRetentionPolicy,
    retentionDays: effectiveRetentionDays,
    expiresAt,
    initialStatus,
  } as Parameters<typeof createAgentMemory>[0]);

  await recordAgentMemoryEvent({
    workspaceId: normalized.workspaceId,
    memoryId: memory.id,
    eventType: "memory_created",
    actorId: normalized.createdBy ?? null,
    eventPayload: {
      scopeType: memory.scopeType,
      memoryKind: memory.memoryKind,
      sensitivity: memory.sensitivity,
      requiresApproval: evaluation.requiresApproval,
    },
  });

  return memory;
}

export async function checkAgentMemoryAccess(input: AgentMemoryAccessCheckInput & {
  policy?: AgentContextPolicyRecord | null;
}): Promise<AgentMemoryAccessResult> {
  const memory = await getAgentMemoryById(input.workspaceId, input.memoryId);

  if (!memory) {
    return { memoryId: input.memoryId, accessState: "denied", allowed: false, reasonCode: "memory_not_found", message: "Memory record not found." };
  }

  // Enforce status denials
  if (memory.status === "expired") {
    return { memoryId: input.memoryId, accessState: "expired", allowed: false, reasonCode: "memory_expired", message: "Memory has expired and cannot be used." };
  }
  if (memory.status === "revoked") {
    return { memoryId: input.memoryId, accessState: "revoked", allowed: false, reasonCode: "memory_revoked", message: "Memory has been revoked." };
  }
  if (memory.status === "archived") {
    return { memoryId: input.memoryId, accessState: "denied", allowed: false, reasonCode: "memory_revoked", message: "Memory has been archived and is not available for active use." };
  }
  if (memory.status === "stale") {
    return { memoryId: input.memoryId, accessState: "stale", allowed: false, reasonCode: "memory_stale", message: "Memory is stale and requires refresh before use." };
  }

  // Enforce wall-clock expiry even if status is still 'active' (no sweep job yet)
  if (memory.expiresAt && new Date(memory.expiresAt) <= new Date()) {
    return { memoryId: input.memoryId, accessState: "expired", allowed: false, reasonCode: "memory_expired", message: "Memory has passed its retention expiry and cannot be used." };
  }

  // Load policy to enforce cross-scope and sensitivity rules server-side
  const policy = input.policy ?? await getAgentContextPolicyByKey(input.workspaceId, DEFAULT_POLICY_KEY);

  // Sensitivity ceiling: use the lesser of caller-requested and policy max
  const callerCeiling = input.allowedSensitivity ?? policy?.maxSensitivity ?? "confidential";
  const effectiveCeiling = policy
    ? (getSensitivityRank(callerCeiling) <= getSensitivityRank(policy.maxSensitivity) ? callerCeiling : policy.maxSensitivity)
    : callerCeiling;

  if (!isSensitivityAllowed({ memorySensitivity: memory.sensitivity, allowedSensitivity: effectiveCeiling })) {
    return {
      memoryId: input.memoryId,
      accessState: "denied",
      allowed: false,
      reasonCode: "sensitivity_not_allowed",
      message: `Memory sensitivity "${memory.sensitivity}" exceeds allowed level "${effectiveCeiling}".`,
      sensitivity: memory.sensitivity,
    };
  }

  // Scope cross-boundary checks
  if (policy) {
    if (input.scopeType && input.scopeType !== memory.scopeType) {
      // Caller is accessing from a different scope than the memory was created for
      if (memory.scopeType === "project" && !policy.allowCrossProjectMemory) {
        return { memoryId: input.memoryId, accessState: "denied", allowed: false, reasonCode: "scope_not_allowed", message: "Cross-project memory access is not permitted by policy." };
      }
      if (memory.scopeType === "pm" && !policy.allowCrossPmMemory) {
        return { memoryId: input.memoryId, accessState: "denied", allowed: false, reasonCode: "scope_not_allowed", message: "Cross-PM memory access is not permitted by policy." };
      }
    }
    if (memory.scopeType === "portfolio" && !policy.allowPortfolioMemory) {
      return { memoryId: input.memoryId, accessState: "denied", allowed: false, reasonCode: "scope_not_allowed", message: "Portfolio memory access is not permitted by policy." };
    }
  }

  // Record access — best-effort; RLS may block the UPDATE for non-admin members
  try {
    await markAgentMemoryAccessed({ workspaceId: input.workspaceId, memoryId: input.memoryId, actorId: null });
  } catch {
    // Access tracking failure does not deny access; log and continue
    console.warn(`[checkAgentMemoryAccess] Could not record access for memory ${input.memoryId} (RLS or connectivity issue).`);
  }

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
  const now = new Date();
  const records = await listAgentMemories(input.workspaceId, {
    agentId: input.agentId ?? undefined,
    agentType: input.agentType ?? undefined,
    scopeType: input.scopeType,
    scopeId: input.scopeId ?? undefined,
    limit: input.limit,
  });

  return records.filter((m) => {
    if (m.status === "archived" || m.status === "revoked" || m.status === "expired") return false;
    if (m.status === "stale" && !input.includeStale) return false;
    // Wall-clock expiry check
    if (m.expiresAt && new Date(m.expiresAt) <= now) return false;
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
