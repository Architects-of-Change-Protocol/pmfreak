// ─── Agent Memory & Context — Types ──────────────────────────────────────────

export type AgentContextScopeType =
  | "workspace"
  | "portfolio"
  | "project"
  | "pm"
  | "agent"
  | "tool_request"
  | "approval_request";

export type AgentMemoryKind =
  | "fact"
  | "summary"
  | "decision"
  | "risk"
  | "issue"
  | "preference"
  | "constraint"
  | "lesson_learned"
  | "operating_context"
  | "evidence_reference";

export type AgentMemoryStatus =
  | "active"
  | "stale"
  | "expired"
  | "revoked"
  | "archived";

export type AgentContextSensitivity =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export type AgentContextSourceType =
  | "manual"
  | "project_record"
  | "pm_profile"
  | "capacity_snapshot"
  | "performance_snapshot"
  | "governance_event"
  | "tool_request"
  | "approval_decision"
  | "executive_report"
  | "uploaded_artifact"
  | "meeting_notes"
  | "system_generated";

export type AgentMemoryRetentionPolicy =
  | "session_only"
  | "short_term"
  | "project_lifetime"
  | "workspace_lifetime"
  | "custom";

export type AgentMemoryEventType =
  | "memory_created"
  | "memory_updated"
  | "memory_accessed"
  | "memory_policy_evaluated"
  | "memory_marked_stale"
  | "memory_expired"
  | "memory_revoked"
  | "memory_archived"
  | "sensitivity_changed"
  | "retention_changed"
  | "source_refreshed";

export type AgentMemoryAccessState =
  | "allowed"
  | "denied"
  | "requires_approval"
  | "expired"
  | "revoked"
  | "stale";

export type AgentContextPolicyStatus = "active" | "disabled";

// ─── Records ──────────────────────────────────────────────────────────────────

export type AgentContextPolicyRecord = {
  id: string;
  workspaceId: string;
  policyKey: string;
  displayName: string;
  description: string | null;
  allowedScopeTypes: AgentContextScopeType[];
  allowedMemoryKinds: AgentMemoryKind[];
  maxSensitivity: AgentContextSensitivity;
  defaultRetentionPolicy: AgentMemoryRetentionPolicy;
  defaultRetentionDays: number | null;
  allowCrossProjectMemory: boolean;
  allowCrossPmMemory: boolean;
  allowPortfolioMemory: boolean;
  allowRestrictedMemory: boolean;
  requireApprovalForConfidential: boolean;
  requireApprovalForRestricted: boolean;
  hideExpiredMemory: boolean;
  status: AgentContextPolicyStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentMemoryRecord = {
  id: string;
  workspaceId: string;
  agentId: string | null;
  agentType: string | null;
  scopeType: AgentContextScopeType;
  scopeId: string | null;
  memoryKind: AgentMemoryKind;
  title: string;
  content: string | null;
  summary: string | null;
  sourceType: AgentContextSourceType;
  sourceId: string | null;
  sourceUri: string | null;
  provenance: Record<string, unknown> | null;
  sensitivity: AgentContextSensitivity;
  retentionPolicy: AgentMemoryRetentionPolicy;
  retentionDays: number | null;
  status: AgentMemoryStatus;
  expiresAt: string | null;
  staleAt: string | null;
  lastAccessedAt: string | null;
  lastRefreshedAt: string | null;
  accessCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentMemoryEventRecord = {
  id: string;
  workspaceId: string;
  memoryId: string | null;
  eventType: AgentMemoryEventType;
  actorId: string | null;
  eventPayload: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentContextWindowRecord = {
  id: string;
  workspaceId: string;
  agentId: string | null;
  agentType: string | null;
  scopeType: AgentContextScopeType;
  scopeId: string | null;
  windowKey: string;
  displayName: string;
  description: string | null;
  allowedMemoryKinds: AgentMemoryKind[];
  maxSensitivity: AgentContextSensitivity;
  retentionPolicy: AgentMemoryRetentionPolicy;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type CreateAgentMemoryInput = {
  workspaceId: string;
  agentId?: string | null;
  agentType?: string | null;
  scopeType: AgentContextScopeType;
  scopeId?: string | null;
  memoryKind: AgentMemoryKind;
  title: string;
  content?: string | null;
  summary?: string | null;
  sourceType: AgentContextSourceType;
  sourceId?: string | null;
  sourceUri?: string | null;
  provenance?: Record<string, unknown> | null;
  sensitivity?: AgentContextSensitivity;
  retentionPolicy?: AgentMemoryRetentionPolicy;
  retentionDays?: number | null;
  expiresAt?: string | null;
  staleAt?: string | null;
  createdBy?: string | null;
};

export type CreateAgentContextPolicyInput = {
  workspaceId: string;
  policyKey: string;
  displayName: string;
  description?: string | null;
  allowedScopeTypes?: AgentContextScopeType[];
  allowedMemoryKinds?: AgentMemoryKind[];
  maxSensitivity?: AgentContextSensitivity;
  defaultRetentionPolicy?: AgentMemoryRetentionPolicy;
  defaultRetentionDays?: number | null;
  allowCrossProjectMemory?: boolean;
  allowCrossPmMemory?: boolean;
  allowPortfolioMemory?: boolean;
  allowRestrictedMemory?: boolean;
  requireApprovalForConfidential?: boolean;
  requireApprovalForRestricted?: boolean;
  hideExpiredMemory?: boolean;
  createdBy?: string | null;
};

// ─── Filters & Access ─────────────────────────────────────────────────────────

export type AgentMemoryListFilters = {
  status?: AgentMemoryStatus;
  scopeType?: AgentContextScopeType;
  scopeId?: string;
  agentId?: string;
  agentType?: string;
  memoryKind?: AgentMemoryKind;
  sensitivity?: AgentContextSensitivity;
  includeExpired?: boolean;
  includeRevoked?: boolean;
  limit?: number;
};

export type AgentMemoryAccessCheckInput = {
  workspaceId: string;
  memoryId: string;
  agentId?: string | null;
  agentType?: string | null;
  scopeType?: AgentContextScopeType;
  scopeId?: string | null;
  allowedSensitivity?: AgentContextSensitivity;
};

export type AgentMemoryAccessResult = {
  memoryId: string;
  accessState: AgentMemoryAccessState;
  allowed: boolean;
  reasonCode:
    | "allowed"
    | "memory_not_found"
    | "memory_expired"
    | "memory_revoked"
    | "memory_stale"
    | "sensitivity_not_allowed"
    | "scope_not_allowed"
    | "policy_requires_approval"
    | "policy_denied";
  message: string;
  sensitivity?: AgentContextSensitivity;
};
