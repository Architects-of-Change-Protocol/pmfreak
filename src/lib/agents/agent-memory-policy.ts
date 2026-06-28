// ─── Agent Memory & Context — Policy ─────────────────────────────────────────

import type {
  AgentContextSensitivity,
  AgentMemoryRetentionPolicy,
  AgentContextPolicyRecord,
  AgentMemoryRecord,
  CreateAgentMemoryInput,
} from "./agent-memory-types";

const SENSITIVITY_RANK: Record<AgentContextSensitivity, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  restricted: 3,
};

export function getSensitivityRank(sensitivity: AgentContextSensitivity): number {
  return SENSITIVITY_RANK[sensitivity];
}

export function isSensitivityAllowed(input: {
  memorySensitivity: AgentContextSensitivity;
  allowedSensitivity: AgentContextSensitivity;
}): boolean {
  return getSensitivityRank(input.memorySensitivity) <= getSensitivityRank(input.allowedSensitivity);
}

export function calculateExpiration(input: {
  retentionPolicy: AgentMemoryRetentionPolicy;
  retentionDays?: number | null;
  createdAt?: Date;
}): string | null {
  const base = input.createdAt ?? new Date();

  switch (input.retentionPolicy) {
    case "session_only":
      // Expire 24 hours after creation as a safe default
      return new Date(base.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case "short_term": {
      const days = input.retentionDays ?? 30;
      return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    }
    case "custom": {
      if (!input.retentionDays) return null;
      return new Date(base.getTime() + input.retentionDays * 24 * 60 * 60 * 1000).toISOString();
    }
    case "project_lifetime":
    case "workspace_lifetime":
      return null;
    default:
      return null;
  }
}

type PolicyEvaluationResult = {
  allowed: boolean;
  requiresApproval: boolean;
  reasonCode:
    | "allowed"
    | "scope_not_allowed"
    | "memory_kind_not_allowed"
    | "sensitivity_not_allowed"
    | "restricted_not_allowed"
    | "confidential_requires_approval"
    | "restricted_requires_approval"
    | "cross_project_not_allowed"
    | "cross_pm_not_allowed";
  message: string;
};

export function evaluateMemoryPolicy(input: {
  policy: AgentContextPolicyRecord;
  memory: AgentMemoryRecord | CreateAgentMemoryInput;
  agentType?: string | null;
}): PolicyEvaluationResult {
  const { policy, memory } = input;

  if (policy.allowedScopeTypes.length > 0 && !policy.allowedScopeTypes.includes(memory.scopeType)) {
    return { allowed: false, requiresApproval: false, reasonCode: "scope_not_allowed", message: `Scope type "${memory.scopeType}" is not permitted by policy.` };
  }

  if (policy.allowedMemoryKinds.length > 0 && !policy.allowedMemoryKinds.includes(memory.memoryKind)) {
    return { allowed: false, requiresApproval: false, reasonCode: "memory_kind_not_allowed", message: `Memory kind "${memory.memoryKind}" is not permitted by policy.` };
  }

  const sensitivity = memory.sensitivity ?? "internal";
  if (!isSensitivityAllowed({ memorySensitivity: sensitivity, allowedSensitivity: policy.maxSensitivity })) {
    return { allowed: false, requiresApproval: false, reasonCode: "sensitivity_not_allowed", message: `Sensitivity "${sensitivity}" exceeds policy maximum "${policy.maxSensitivity}".` };
  }

  if (sensitivity === "restricted" && !policy.allowRestrictedMemory) {
    return { allowed: false, requiresApproval: false, reasonCode: "restricted_not_allowed", message: "Restricted memory is not permitted by this policy." };
  }

  if (sensitivity === "restricted" && policy.requireApprovalForRestricted) {
    return { allowed: false, requiresApproval: true, reasonCode: "restricted_requires_approval", message: "Restricted memory requires approval per policy." };
  }

  if (sensitivity === "confidential" && policy.requireApprovalForConfidential) {
    return { allowed: false, requiresApproval: true, reasonCode: "confidential_requires_approval", message: "Confidential memory requires approval per policy." };
  }

  if (memory.scopeType === "project" && !policy.allowCrossProjectMemory) {
    // Only block if there's an explicit cross-project access attempt (scope differs)
    // Basic project memory creation is always allowed — cross-project is flagged at access time
  }

  if (memory.scopeType === "pm" && !policy.allowCrossPmMemory) {
    // Same — cross-PM access is evaluated at retrieval, not creation
  }

  return { allowed: true, requiresApproval: false, reasonCode: "allowed", message: "Memory is permitted by policy." };
}
