// ─── Agent Memory & Context — Registry (DB layer) ────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import type {
  AgentContextPolicyRecord,
  AgentMemoryRecord,
  AgentMemoryEventRecord,
  AgentMemoryStatus,
  AgentMemoryEventType,
  AgentContextScopeType,
  AgentMemoryKind,
  AgentContextSensitivity,
  CreateAgentMemoryInput,
  CreateAgentContextPolicyInput,
  AgentMemoryListFilters,
} from "./agent-memory-types";

// ─── Row types ────────────────────────────────────────────────────────────────

type PolicyRow = {
  id: string;
  workspace_id: string;
  policy_key: string;
  display_name: string;
  description: string | null;
  allowed_scope_types_json: unknown;
  allowed_memory_kinds_json: unknown;
  max_sensitivity: string;
  default_retention_policy: string;
  default_retention_days: number | null;
  allow_cross_project_memory: boolean;
  allow_cross_pm_memory: boolean;
  allow_portfolio_memory: boolean;
  allow_restricted_memory: boolean;
  require_approval_for_confidential: boolean;
  require_approval_for_restricted: boolean;
  hide_expired_memory: boolean;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type MemoryRow = {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  agent_type: string | null;
  scope_type: string;
  scope_id: string | null;
  memory_kind: string;
  title: string;
  content: string | null;
  summary: string | null;
  source_type: string;
  source_id: string | null;
  source_uri: string | null;
  provenance_json: unknown;
  sensitivity: string;
  retention_policy: string;
  retention_days: number | null;
  status: string;
  expires_at: string | null;
  stale_at: string | null;
  last_accessed_at: string | null;
  last_refreshed_at: string | null;
  access_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  workspace_id: string;
  memory_id: string | null;
  event_type: string;
  actor_id: string | null;
  event_payload_json: unknown;
  created_at: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapPolicy(row: PolicyRow): AgentContextPolicyRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    policyKey: row.policy_key,
    displayName: row.display_name,
    description: row.description,
    allowedScopeTypes: (Array.isArray(row.allowed_scope_types_json) ? row.allowed_scope_types_json : []) as AgentContextScopeType[],
    allowedMemoryKinds: (Array.isArray(row.allowed_memory_kinds_json) ? row.allowed_memory_kinds_json : []) as AgentMemoryKind[],
    maxSensitivity: row.max_sensitivity as AgentContextSensitivity,
    defaultRetentionPolicy: row.default_retention_policy as AgentContextPolicyRecord["defaultRetentionPolicy"],
    defaultRetentionDays: row.default_retention_days,
    allowCrossProjectMemory: row.allow_cross_project_memory,
    allowCrossPmMemory: row.allow_cross_pm_memory,
    allowPortfolioMemory: row.allow_portfolio_memory,
    allowRestrictedMemory: row.allow_restricted_memory,
    requireApprovalForConfidential: row.require_approval_for_confidential,
    requireApprovalForRestricted: row.require_approval_for_restricted,
    hideExpiredMemory: row.hide_expired_memory,
    status: row.status as AgentContextPolicyRecord["status"],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMemory(row: MemoryRow): AgentMemoryRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    agentType: row.agent_type,
    scopeType: row.scope_type as AgentContextScopeType,
    scopeId: row.scope_id,
    memoryKind: row.memory_kind as AgentMemoryKind,
    title: row.title,
    content: row.content,
    summary: row.summary,
    sourceType: row.source_type as AgentMemoryRecord["sourceType"],
    sourceId: row.source_id,
    sourceUri: row.source_uri,
    provenance: (row.provenance_json as Record<string, unknown>) ?? null,
    sensitivity: row.sensitivity as AgentContextSensitivity,
    retentionPolicy: row.retention_policy as AgentMemoryRecord["retentionPolicy"],
    retentionDays: row.retention_days,
    status: row.status as AgentMemoryStatus,
    expiresAt: row.expires_at,
    staleAt: row.stale_at,
    lastAccessedAt: row.last_accessed_at,
    lastRefreshedAt: row.last_refreshed_at,
    accessCount: row.access_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: EventRow): AgentMemoryEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    memoryId: row.memory_id,
    eventType: row.event_type as AgentMemoryEventType,
    actorId: row.actor_id,
    eventPayload: (row.event_payload_json as Record<string, unknown>) ?? null,
    createdAt: row.created_at,
  };
}

// ─── Context Policy ───────────────────────────────────────────────────────────

export async function createAgentContextPolicy(input: CreateAgentContextPolicyInput): Promise<AgentContextPolicyRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const id = randomUUID();

  const { data, error } = await supabase
    .from("agent_context_policies")
    .insert({
      id,
      workspace_id: input.workspaceId,
      policy_key: input.policyKey,
      display_name: input.displayName,
      description: input.description ?? null,
      allowed_scope_types_json: JSON.stringify(input.allowedScopeTypes ?? []),
      allowed_memory_kinds_json: JSON.stringify(input.allowedMemoryKinds ?? []),
      max_sensitivity: input.maxSensitivity ?? "internal",
      default_retention_policy: input.defaultRetentionPolicy ?? "short_term",
      default_retention_days: input.defaultRetentionDays ?? null,
      allow_cross_project_memory: input.allowCrossProjectMemory ?? false,
      allow_cross_pm_memory: input.allowCrossPmMemory ?? false,
      allow_portfolio_memory: input.allowPortfolioMemory ?? true,
      allow_restricted_memory: input.allowRestrictedMemory ?? false,
      require_approval_for_confidential: input.requireApprovalForConfidential ?? true,
      require_approval_for_restricted: input.requireApprovalForRestricted ?? true,
      hide_expired_memory: input.hideExpiredMemory ?? true,
      status: "active",
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create context policy: ${error.message}`);
  return mapPolicy(data as unknown as PolicyRow);
}

export async function upsertAgentContextPolicy(input: CreateAgentContextPolicyInput): Promise<AgentContextPolicyRecord> {
  const existing = await getAgentContextPolicyByKey(input.workspaceId, input.policyKey);
  if (existing) return existing;
  return createAgentContextPolicy(input);
}

export async function getAgentContextPolicyByKey(workspaceId: string, policyKey: string): Promise<AgentContextPolicyRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_context_policies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("policy_key", policyKey)
    .maybeSingle();

  if (error) throw new Error(`Failed to get context policy: ${error.message}`);
  if (!data) return null;
  return mapPolicy(data as unknown as PolicyRow);
}

export async function listAgentContextPolicies(workspaceId: string): Promise<AgentContextPolicyRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_context_policies")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list context policies: ${error.message}`);
  return (data ?? []).map((r) => mapPolicy(r as unknown as PolicyRow));
}

// ─── Memory Records ───────────────────────────────────────────────────────────

export async function createAgentMemory(input: CreateAgentMemoryInput & { expiresAt?: string | null }): Promise<AgentMemoryRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const id = randomUUID();

  const { data, error } = await supabase
    .from("agent_memory_records")
    .insert({
      id,
      workspace_id: input.workspaceId,
      agent_id: input.agentId ?? null,
      agent_type: input.agentType ?? null,
      scope_type: input.scopeType,
      scope_id: input.scopeId ?? null,
      memory_kind: input.memoryKind,
      title: input.title,
      content: input.content ?? null,
      summary: input.summary ?? null,
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      source_uri: input.sourceUri ?? null,
      provenance_json: input.provenance ? JSON.stringify(input.provenance) : null,
      sensitivity: input.sensitivity ?? "internal",
      retention_policy: input.retentionPolicy ?? "short_term",
      retention_days: input.retentionDays ?? null,
      status: "active",
      expires_at: input.expiresAt ?? null,
      stale_at: input.staleAt ?? null,
      last_accessed_at: null,
      last_refreshed_at: null,
      access_count: 0,
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create memory record: ${error.message}`);
  return mapMemory(data as unknown as MemoryRow);
}

export async function getAgentMemoryById(workspaceId: string, memoryId: string): Promise<AgentMemoryRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_memory_records")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", memoryId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get memory record: ${error.message}`);
  if (!data) return null;
  return mapMemory(data as unknown as MemoryRow);
}

export async function listAgentMemories(workspaceId: string, filters?: AgentMemoryListFilters): Promise<AgentMemoryRecord[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("agent_memory_records")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.scopeType) query = query.eq("scope_type", filters.scopeType);
  if (filters?.scopeId) query = query.eq("scope_id", filters.scopeId);
  if (filters?.agentId) query = query.eq("agent_id", filters.agentId);
  if (filters?.agentType) query = query.eq("agent_type", filters.agentType);
  if (filters?.memoryKind) query = query.eq("memory_kind", filters.memoryKind);
  if (filters?.sensitivity) query = query.eq("sensitivity", filters.sensitivity);

  if (!filters?.includeExpired) {
    query = query.neq("status", "expired");
  }
  if (!filters?.includeRevoked) {
    query = query.neq("status", "revoked");
  }
  if (!filters?.status) {
    query = query.neq("status", "archived");
  }

  if (filters?.limit) query = query.limit(filters.limit);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list memory records: ${error.message}`);
  return (data ?? []).map((r) => mapMemory(r as unknown as MemoryRow));
}

export async function updateAgentMemoryStatus(input: {
  workspaceId: string;
  memoryId: string;
  status: AgentMemoryStatus;
  actorId?: string | null;
  reason?: string | null;
}): Promise<AgentMemoryRecord> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_memory_records")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.memoryId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update memory status: ${error.message}`);
  return mapMemory(data as unknown as MemoryRow);
}

export async function markAgentMemoryAccessed(input: {
  workspaceId: string;
  memoryId: string;
  actorId?: string | null;
}): Promise<AgentMemoryRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  // Increment access_count and update last_accessed_at
  const existing = await getAgentMemoryById(input.workspaceId, input.memoryId);
  if (!existing) throw new Error("Memory record not found.");

  const { data, error } = await supabase
    .from("agent_memory_records")
    .update({
      last_accessed_at: now,
      access_count: existing.accessCount + 1,
      updated_at: now,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.memoryId)
    .select()
    .single();

  if (error) throw new Error(`Failed to mark memory accessed: ${error.message}`);
  return mapMemory(data as unknown as MemoryRow);
}

// ─── Memory Events ────────────────────────────────────────────────────────────

export async function recordAgentMemoryEvent(input: {
  workspaceId: string;
  memoryId?: string | null;
  eventType: AgentMemoryEventType;
  actorId?: string | null;
  eventPayload?: Record<string, unknown> | null;
}): Promise<AgentMemoryEventRecord> {
  const supabase = await createSupabaseServerClient();
  const id = randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agent_memory_events")
    .insert({
      id,
      workspace_id: input.workspaceId,
      memory_id: input.memoryId ?? null,
      event_type: input.eventType,
      actor_id: input.actorId ?? null,
      event_payload_json: input.eventPayload ? JSON.stringify(input.eventPayload) : null,
      created_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record memory event: ${error.message}`);
  return mapEvent(data as unknown as EventRow);
}

export async function listAgentMemoryEvents(workspaceId: string, memoryId: string): Promise<AgentMemoryEventRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_memory_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("memory_id", memoryId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list memory events: ${error.message}`);
  return (data ?? []).map((r) => mapEvent(r as unknown as EventRow));
}
