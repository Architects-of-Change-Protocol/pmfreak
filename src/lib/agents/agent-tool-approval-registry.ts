// ─── Agent Tool Approval — Registry (DB layer) ───────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import type {
  AgentToolRequestRecord,
  AgentToolApprovalRecord,
  AgentToolApprovalEventRecord,
  AgentToolRequestStatus,
  AgentToolApprovalDecision,
  AgentToolApprovalEventType,
  AgentToolRequestListFilters,
} from "./agent-tool-approval-types";

// ─── Row types ────────────────────────────────────────────────────────────────

type AgentToolRequestRow = {
  id: string;
  workspace_id: string;
  agent_id: string;
  agent_type: string;
  tool_id: string;
  tool_key: string;
  status: string;
  request_reason: string | null;
  request_context_json: string;
  requested_by: string | null;
  requested_at: string;
  expires_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type AgentToolApprovalRow = {
  id: string;
  request_id: string;
  workspace_id: string;
  decision: string;
  decided_by: string;
  decision_note: string | null;
  decided_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_note: string | null;
  created_at: string;
  updated_at: string;
};

type AgentToolApprovalEventRow = {
  id: string;
  request_id: string;
  workspace_id: string;
  event_type: string;
  actor: string | null;
  note: string | null;
  metadata_json: string;
  created_at: string;
};

// ─── Row → Domain ─────────────────────────────────────────────────────────────

function requestRowToRecord(row: AgentToolRequestRow): AgentToolRequestRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    agentType: row.agent_type,
    toolId: row.tool_id,
    toolKey: row.tool_key,
    status: row.status as AgentToolRequestStatus,
    requestReason: row.request_reason,
    requestContext: JSON.parse(row.request_context_json ?? "{}"),
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function approvalRowToRecord(row: AgentToolApprovalRow): AgentToolApprovalRecord {
  return {
    id: row.id,
    requestId: row.request_id,
    workspaceId: row.workspace_id,
    decision: row.decision as AgentToolApprovalDecision,
    decidedBy: row.decided_by,
    decisionNote: row.decision_note,
    decidedAt: row.decided_at,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    revocationNote: row.revocation_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function eventRowToRecord(row: AgentToolApprovalEventRow): AgentToolApprovalEventRecord {
  return {
    id: row.id,
    requestId: row.request_id,
    workspaceId: row.workspace_id,
    eventType: row.event_type as AgentToolApprovalEventType,
    actor: row.actor,
    note: row.note,
    metadata: JSON.parse(row.metadata_json ?? "{}"),
    createdAt: row.created_at,
  };
}

// ─── Column lists ─────────────────────────────────────────────────────────────

export const AGENT_TOOL_REQUEST_COLUMNS = [
  "id","workspace_id","agent_id","agent_type","tool_id","tool_key","status",
  "request_reason","request_context_json","requested_by","requested_at",
  "expires_at","resolved_at","created_at","updated_at",
] as const;

export const AGENT_TOOL_APPROVAL_COLUMNS = [
  "id","request_id","workspace_id","decision","decided_by","decision_note",
  "decided_at","revoked_at","revoked_by","revocation_note","created_at","updated_at",
] as const;

export const AGENT_TOOL_APPROVAL_EVENT_COLUMNS = [
  "id","request_id","workspace_id","event_type","actor","note","metadata_json","created_at",
] as const;

const REQ_COLS = AGENT_TOOL_REQUEST_COLUMNS.join(",");
const APR_COLS = AGENT_TOOL_APPROVAL_COLUMNS.join(",");
const EVT_COLS = AGENT_TOOL_APPROVAL_EVENT_COLUMNS.join(",");

// ─── agent_tool_requests ──────────────────────────────────────────────────────

export async function createAgentToolRequest(input: {
  workspaceId: string;
  agentId: string;
  agentType: string;
  toolId: string;
  toolKey: string;
  requestReason?: string | null;
  requestContext?: Record<string, unknown>;
  requestedBy?: string | null;
  expiresAt?: string | null;
}): Promise<AgentToolRequestRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const id = randomUUID();
  const { data, error } = await supabase
    .from("agent_tool_requests")
    .insert({
      id,
      workspace_id: input.workspaceId,
      agent_id: input.agentId,
      agent_type: input.agentType,
      tool_id: input.toolId,
      tool_key: input.toolKey,
      status: "pending",
      request_reason: input.requestReason ?? null,
      request_context_json: JSON.stringify(input.requestContext ?? {}),
      requested_by: input.requestedBy ?? null,
      requested_at: now,
      expires_at: input.expiresAt ?? null,
      resolved_at: null,
      created_at: now,
      updated_at: now,
    })
    .select(REQ_COLS)
    .single();
  if (error) throw new Error(`createAgentToolRequest failed: ${error.message}`);
  return requestRowToRecord(data as unknown as AgentToolRequestRow);
}

export async function getAgentToolRequestById(
  workspaceId: string,
  requestId: string
): Promise<AgentToolRequestRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_tool_requests")
    .select(REQ_COLS)
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(`getAgentToolRequestById failed: ${error.message}`);
  return data ? requestRowToRecord(data as unknown as AgentToolRequestRow) : null;
}

export async function listAgentToolRequests(
  workspaceId: string,
  filters: AgentToolRequestListFilters = {}
): Promise<AgentToolRequestRecord[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("agent_tool_requests")
    .select(REQ_COLS)
    .eq("workspace_id", workspaceId);

  if (filters.agentId) q = q.eq("agent_id", filters.agentId);
  if (filters.toolKey) q = q.eq("tool_key", filters.toolKey);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.requestedBy) q = q.eq("requested_by", filters.requestedBy);

  q = q.order("requested_at", { ascending: false });

  if (filters.limit) q = q.limit(filters.limit);
  if (filters.offset) q = q.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1);

  const { data, error } = await q;
  if (error) throw new Error(`listAgentToolRequests failed: ${error.message}`);
  return (data ?? []).map((r: unknown) => requestRowToRecord(r as AgentToolRequestRow));
}

export async function updateAgentToolRequestStatus(
  workspaceId: string,
  requestId: string,
  status: AgentToolRequestStatus,
  resolvedAt?: string | null
): Promise<AgentToolRequestRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agent_tool_requests")
    .update({
      status,
      resolved_at: resolvedAt ?? (["approved","rejected","cancelled","expired"].includes(status) ? now : null),
      updated_at: now,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .select(REQ_COLS)
    .single();
  if (error) throw new Error(`updateAgentToolRequestStatus failed: ${error.message}`);
  return requestRowToRecord(data as unknown as AgentToolRequestRow);
}

// ─── agent_tool_approvals ─────────────────────────────────────────────────────

export async function recordAgentToolApproval(input: {
  requestId: string;
  workspaceId: string;
  decision: AgentToolApprovalDecision;
  decidedBy: string;
  decisionNote?: string | null;
}): Promise<AgentToolApprovalRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const id = randomUUID();
  const { data, error } = await supabase
    .from("agent_tool_approvals")
    .insert({
      id,
      request_id: input.requestId,
      workspace_id: input.workspaceId,
      decision: input.decision,
      decided_by: input.decidedBy,
      decision_note: input.decisionNote ?? null,
      decided_at: now,
      revoked_at: null,
      revoked_by: null,
      revocation_note: null,
      created_at: now,
      updated_at: now,
    })
    .select(APR_COLS)
    .single();
  if (error) throw new Error(`recordAgentToolApproval failed: ${error.message}`);
  return approvalRowToRecord(data as unknown as AgentToolApprovalRow);
}

export async function listApprovalsForRequest(
  workspaceId: string,
  requestId: string
): Promise<AgentToolApprovalRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_tool_approvals")
    .select(APR_COLS)
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .order("decided_at", { ascending: false });
  if (error) throw new Error(`listApprovalsForRequest failed: ${error.message}`);
  return (data ?? []).map((r: unknown) => approvalRowToRecord(r as AgentToolApprovalRow));
}

export async function revokeAgentToolApprovalRecord(
  workspaceId: string,
  approvalId: string,
  revokedBy: string,
  revocationNote?: string | null
): Promise<AgentToolApprovalRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("agent_tool_approvals")
    .update({
      revoked_at: now,
      revoked_by: revokedBy,
      revocation_note: revocationNote ?? null,
      updated_at: now,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", approvalId)
    .select(APR_COLS)
    .single();
  if (error) throw new Error(`revokeAgentToolApprovalRecord failed: ${error.message}`);
  return approvalRowToRecord(data as unknown as AgentToolApprovalRow);
}

// ─── agent_tool_approval_events ───────────────────────────────────────────────

export async function recordAgentToolApprovalEvent(input: {
  requestId: string;
  workspaceId: string;
  eventType: AgentToolApprovalEventType;
  actor?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AgentToolApprovalEventRecord> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const id = randomUUID();
  const { data, error } = await supabase
    .from("agent_tool_approval_events")
    .insert({
      id,
      request_id: input.requestId,
      workspace_id: input.workspaceId,
      event_type: input.eventType,
      actor: input.actor ?? null,
      note: input.note ?? null,
      metadata_json: JSON.stringify(input.metadata ?? {}),
      created_at: now,
    })
    .select(EVT_COLS)
    .single();
  if (error) throw new Error(`recordAgentToolApprovalEvent failed: ${error.message}`);
  return eventRowToRecord(data as unknown as AgentToolApprovalEventRow);
}

export async function listApprovalEventsForRequest(
  workspaceId: string,
  requestId: string
): Promise<AgentToolApprovalEventRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_tool_approval_events")
    .select(EVT_COLS)
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listApprovalEventsForRequest failed: ${error.message}`);
  return (data ?? []).map((r: unknown) => eventRowToRecord(r as AgentToolApprovalEventRow));
}
