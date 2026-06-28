// ─── Agent Execution Request Runtime — Registry (DB layer) ───────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import { assertAgentExecutionTransition } from "./agent-execution-state-machine";
import type {
  AgentExecutionRequestRecord,
  AgentExecutionEventRecord,
  AgentExecutionMode,
  AgentExecutionState,
  AgentExecutionRiskLevel,
  AgentExecutionScopeType,
  AgentExecutionSourceType,
  AgentExecutionPreflightStatus,
  AgentExecutionEventType,
  CreateAgentExecutionRequestInput,
  AgentExecutionListFilters,
  CompleteAgentExecutionInput,
  FailAgentExecutionInput,
} from "./agent-execution-types";

// ─── Row types ────────────────────────────────────────────────────────────────

type AgentExecutionRequestRow = {
  id: string;
  workspace_id: string;
  correlation_id: string | null;
  agent_id: string | null;
  agent_type: string | null;
  tool_key: string;
  execution_mode: string;
  execution_state: string;
  risk_level: string;
  scope_type: string;
  scope_id: string | null;
  source_type: string;
  source_id: string | null;
  title: string;
  description: string | null;
  input_payload_json: unknown;
  safe_input_payload_json: unknown;
  preflight_status: string;
  preflight_result_json: unknown;
  requires_approval: boolean;
  approval_request_id: string | null;
  memory_ids_json: unknown;
  evidence_refs_json: unknown;
  result_payload_json: unknown;
  error_code: string | null;
  error_message: string | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type AgentExecutionEventRow = {
  id: string;
  workspace_id: string;
  execution_request_id: string;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  actor_id: string | null;
  message: string | null;
  event_payload_json: unknown;
  created_at: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapRequest(row: AgentExecutionRequestRow): AgentExecutionRequestRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    correlationId: row.correlation_id,
    agentId: row.agent_id,
    agentType: row.agent_type,
    toolKey: row.tool_key,
    executionMode: row.execution_mode as AgentExecutionMode,
    executionState: row.execution_state as AgentExecutionState,
    riskLevel: row.risk_level as AgentExecutionRiskLevel,
    scopeType: row.scope_type as AgentExecutionScopeType,
    scopeId: row.scope_id,
    sourceType: row.source_type as AgentExecutionSourceType,
    sourceId: row.source_id,
    title: row.title,
    description: row.description,
    inputPayload: (row.input_payload_json as Record<string, unknown>) ?? null,
    safeInputPayload: (row.safe_input_payload_json as Record<string, unknown>) ?? null,
    preflightStatus: row.preflight_status as AgentExecutionPreflightStatus,
    preflightResult: (row.preflight_result_json as Record<string, unknown>) ?? null,
    requiresApproval: row.requires_approval,
    approvalRequestId: row.approval_request_id,
    memoryIds: (Array.isArray(row.memory_ids_json) ? row.memory_ids_json : []) as string[],
    evidenceRefs: (Array.isArray(row.evidence_refs_json) ? row.evidence_refs_json : []) as string[],
    resultPayload: (row.result_payload_json as Record<string, unknown>) ?? null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    requestedBy: row.requested_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: AgentExecutionEventRow): AgentExecutionEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    executionRequestId: row.execution_request_id,
    eventType: row.event_type as AgentExecutionEventType,
    fromState: row.from_state as AgentExecutionState | null,
    toState: row.to_state as AgentExecutionState | null,
    actorId: row.actor_id,
    message: row.message,
    eventPayload: (row.event_payload_json as Record<string, unknown>) ?? null,
    createdAt: row.created_at,
  };
}

// ─── Execution Request CRUD ───────────────────────────────────────────────────

export async function createAgentExecutionRequest(
  input: CreateAgentExecutionRequestInput,
): Promise<AgentExecutionRequestRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const id = randomUUID();

  const { data, error } = await supabase
    .from("agent_execution_requests")
    .insert({
      id,
      workspace_id: input.workspaceId,
      correlation_id: input.correlationId ?? null,
      agent_id: input.agentId ?? null,
      agent_type: input.agentType ?? null,
      tool_key: input.toolKey,
      execution_mode: input.executionMode,
      execution_state: "draft",
      risk_level: input.riskLevel ?? "medium",
      scope_type: input.scopeType,
      scope_id: input.scopeId ?? null,
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      title: input.title,
      description: input.description ?? null,
      input_payload_json: input.inputPayload ? JSON.stringify(input.inputPayload) : null,
      safe_input_payload_json: null,
      preflight_status: "not_started",
      preflight_result_json: null,
      requires_approval: false,
      approval_request_id: null,
      memory_ids_json: JSON.stringify(input.memoryIds ?? []),
      evidence_refs_json: JSON.stringify(input.evidenceRefs ?? []),
      result_payload_json: null,
      error_code: null,
      error_message: null,
      requested_by: input.requestedBy ?? null,
      approved_by: null,
      approved_at: null,
      expires_at: input.expiresAt ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create agent execution request: ${error.message}`);
  return mapRequest(data as unknown as AgentExecutionRequestRow);
}

export async function getAgentExecutionRequestById(
  workspaceId: string,
  id: string,
): Promise<AgentExecutionRequestRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_execution_requests")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to get agent execution request: ${error.message}`);
  if (!data) return null;
  return mapRequest(data as unknown as AgentExecutionRequestRow);
}

export async function listAgentExecutionRequests(
  workspaceId: string,
  filters?: AgentExecutionListFilters,
): Promise<AgentExecutionRequestRecord[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("agent_execution_requests")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (filters?.executionState) query = query.eq("execution_state", filters.executionState);
  if (filters?.executionMode) query = query.eq("execution_mode", filters.executionMode);
  if (filters?.riskLevel) query = query.eq("risk_level", filters.riskLevel);
  if (filters?.scopeType) query = query.eq("scope_type", filters.scopeType);
  if (filters?.scopeId) query = query.eq("scope_id", filters.scopeId);
  if (filters?.agentId) query = query.eq("agent_id", filters.agentId);
  if (filters?.agentType) query = query.eq("agent_type", filters.agentType);
  if (filters?.toolKey) query = query.eq("tool_key", filters.toolKey);
  if (filters?.requestedBy) query = query.eq("requested_by", filters.requestedBy);
  if (filters?.limit) query = query.limit(filters.limit);

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list agent execution requests: ${error.message}`);
  return (data ?? []).map((r) => mapRequest(r as unknown as AgentExecutionRequestRow));
}

export async function updateAgentExecutionRequestState(input: {
  workspaceId: string;
  executionRequestId: string;
  toState: AgentExecutionState;
  actorId?: string | null;
  message?: string | null;
  eventType?: AgentExecutionEventType;
  eventPayload?: Record<string, unknown> | null;
}): Promise<AgentExecutionRequestRecord> {
  const existing = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!existing) throw new Error(`Execution request not found: ${input.executionRequestId}`);

  assertAgentExecutionTransition({ from: existing.executionState, to: input.toState });

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agent_execution_requests")
    .update({ execution_state: input.toState, updated_at: now })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.executionRequestId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update agent execution state: ${error.message}`);

  const updated = mapRequest(data as unknown as AgentExecutionRequestRow);

  await recordAgentExecutionEvent({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    eventType: input.eventType ?? "execution_state_transition",
    fromState: existing.executionState,
    toState: input.toState,
    actorId: input.actorId ?? null,
    message: input.message ?? null,
    eventPayload: input.eventPayload ?? null,
  });

  return updated;
}

export async function updateAgentExecutionPreflightResult(input: {
  workspaceId: string;
  executionRequestId: string;
  preflightStatus: AgentExecutionPreflightStatus;
  preflightResult: Record<string, unknown> | null;
  toState: AgentExecutionState;
  actorId?: string | null;
}): Promise<AgentExecutionRequestRecord> {
  const existing = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!existing) throw new Error(`Execution request not found: ${input.executionRequestId}`);

  assertAgentExecutionTransition({ from: existing.executionState, to: input.toState });

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const requiresApproval =
    input.preflightResult &&
    typeof input.preflightResult["requiresApproval"] === "boolean"
      ? input.preflightResult["requiresApproval"]
      : existing.requiresApproval;

  const { data, error } = await supabase
    .from("agent_execution_requests")
    .update({
      preflight_status: input.preflightStatus,
      preflight_result_json: input.preflightResult ? JSON.stringify(input.preflightResult) : null,
      execution_state: input.toState,
      requires_approval: requiresApproval,
      updated_at: now,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.executionRequestId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update preflight result: ${error.message}`);
  return mapRequest(data as unknown as AgentExecutionRequestRow);
}

export async function completeAgentExecutionRequest(
  input: CompleteAgentExecutionInput,
): Promise<AgentExecutionRequestRecord> {
  const existing = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!existing) throw new Error(`Execution request not found: ${input.executionRequestId}`);

  assertAgentExecutionTransition({ from: existing.executionState, to: "completed" });

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agent_execution_requests")
    .update({
      execution_state: "completed",
      result_payload_json: input.resultPayload ? JSON.stringify(input.resultPayload) : null,
      updated_at: now,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.executionRequestId)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete execution request: ${error.message}`);
  return mapRequest(data as unknown as AgentExecutionRequestRow);
}

export async function failAgentExecutionRequest(
  input: FailAgentExecutionInput,
): Promise<AgentExecutionRequestRecord> {
  const existing = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!existing) throw new Error(`Execution request not found: ${input.executionRequestId}`);

  assertAgentExecutionTransition({ from: existing.executionState, to: "failed" });

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agent_execution_requests")
    .update({
      execution_state: "failed",
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      updated_at: now,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.executionRequestId)
    .select()
    .single();

  if (error) throw new Error(`Failed to fail execution request: ${error.message}`);
  return mapRequest(data as unknown as AgentExecutionRequestRow);
}

// ─── Execution Events ─────────────────────────────────────────────────────────

export async function recordAgentExecutionEvent(input: {
  workspaceId: string;
  executionRequestId: string;
  eventType: AgentExecutionEventType;
  fromState?: AgentExecutionState | null;
  toState?: AgentExecutionState | null;
  actorId?: string | null;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
}): Promise<AgentExecutionEventRecord> {
  const supabase = await createSupabaseServerClient();
  const id = randomUUID();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agent_execution_events")
    .insert({
      id,
      workspace_id: input.workspaceId,
      execution_request_id: input.executionRequestId,
      event_type: input.eventType,
      from_state: input.fromState ?? null,
      to_state: input.toState ?? null,
      actor_id: input.actorId ?? null,
      message: input.message ?? null,
      event_payload_json: input.eventPayload ? JSON.stringify(input.eventPayload) : null,
      created_at: now,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record execution event: ${error.message}`);
  return mapEvent(data as unknown as AgentExecutionEventRow);
}

export async function listAgentExecutionEvents(
  workspaceId: string,
  executionRequestId: string,
): Promise<AgentExecutionEventRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_execution_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("execution_request_id", executionRequestId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list execution events: ${error.message}`);
  return (data ?? []).map((r) => mapEvent(r as unknown as AgentExecutionEventRow));
}
