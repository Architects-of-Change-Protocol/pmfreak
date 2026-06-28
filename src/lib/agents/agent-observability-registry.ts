// ─── Agent Observability & Audit Trail — Registry (DB layer) ─────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import { redactAuditPayload } from "./agent-observability-validation";
import type {
  AgentAuditEventRecord,
  AgentDecisionEventRecord,
  AgentAuditExportRecord,
  CreateAgentAuditEventInput,
  CreateAgentDecisionEventInput,
  AgentAuditListFilters,
  AgentDecisionType,
  AgentDecisionStatus,
  AgentAuditScopeType,
  AgentAuditExportFormat,
} from "./agent-observability-types";

// ─── Row types ────────────────────────────────────────────────────────────────

type AuditEventRow = {
  id: string;
  workspace_id: string;
  correlation_id: string | null;
  category: string;
  event_type: string;
  severity: string;
  outcome: string;
  source_type: string;
  scope_type: string;
  scope_id: string | null;
  agent_id: string | null;
  agent_type: string | null;
  actor_id: string | null;
  project_id: string | null;
  pm_id: string | null;
  portfolio_id: string | null;
  tool_key: string | null;
  tool_request_id: string | null;
  approval_request_id: string | null;
  memory_id: string | null;
  context_policy_id: string | null;
  report_id: string | null;
  title: string;
  message: string | null;
  reason_code: string | null;
  payload_json: unknown;
  redacted_payload_json: unknown;
  evidence_refs_json: unknown;
  occurred_at: string;
  created_at: string;
};

type DecisionEventRow = {
  id: string;
  workspace_id: string;
  audit_event_id: string | null;
  correlation_id: string | null;
  agent_id: string | null;
  agent_type: string | null;
  decision_type: string;
  status: string;
  scope_type: string;
  scope_id: string | null;
  project_id: string | null;
  pm_id: string | null;
  portfolio_id: string | null;
  title: string;
  summary: string | null;
  rationale: string | null;
  confidence_score: number | null;
  risk_level: string | null;
  evidence_refs_json: unknown;
  decision_payload_json: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ExportRow = {
  id: string;
  workspace_id: string;
  export_format: string;
  filter_payload_json: unknown;
  artifact_title: string;
  artifact_content: string;
  artifact_metadata_json: unknown;
  created_by: string | null;
  created_at: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapAuditEventRow(row: AuditEventRow): AgentAuditEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    correlationId: row.correlation_id,
    category: row.category as AgentAuditEventRecord["category"],
    eventType: row.event_type as AgentAuditEventRecord["eventType"],
    severity: row.severity as AgentAuditEventRecord["severity"],
    outcome: row.outcome as AgentAuditEventRecord["outcome"],
    sourceType: row.source_type as AgentAuditEventRecord["sourceType"],
    scopeType: row.scope_type as AgentAuditEventRecord["scopeType"],
    scopeId: row.scope_id,
    agentId: row.agent_id,
    agentType: row.agent_type,
    actorId: row.actor_id,
    projectId: row.project_id,
    pmId: row.pm_id,
    portfolioId: row.portfolio_id,
    toolKey: row.tool_key,
    toolRequestId: row.tool_request_id,
    approvalRequestId: row.approval_request_id,
    memoryId: row.memory_id,
    contextPolicyId: row.context_policy_id,
    reportId: row.report_id,
    title: row.title,
    message: row.message,
    reasonCode: row.reason_code,
    payload: row.payload_json ? (row.payload_json as Record<string, unknown>) : null,
    redactedPayload: row.redacted_payload_json ? (row.redacted_payload_json as Record<string, unknown>) : null,
    evidenceRefs: Array.isArray(row.evidence_refs_json) ? (row.evidence_refs_json as string[]) : [],
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

function mapDecisionEventRow(row: DecisionEventRow): AgentDecisionEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    auditEventId: row.audit_event_id,
    correlationId: row.correlation_id,
    agentId: row.agent_id,
    agentType: row.agent_type,
    decisionType: row.decision_type as AgentDecisionType,
    status: row.status as AgentDecisionStatus,
    scopeType: row.scope_type as AgentAuditScopeType,
    scopeId: row.scope_id,
    projectId: row.project_id,
    pmId: row.pm_id,
    portfolioId: row.portfolio_id,
    title: row.title,
    summary: row.summary,
    rationale: row.rationale,
    confidenceScore: row.confidence_score,
    riskLevel: row.risk_level,
    evidenceRefs: Array.isArray(row.evidence_refs_json) ? (row.evidence_refs_json as string[]) : [],
    decisionPayload: row.decision_payload_json ? (row.decision_payload_json as Record<string, unknown>) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExportRow(row: ExportRow): AgentAuditExportRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    exportFormat: row.export_format as AgentAuditExportFormat,
    filterPayload: row.filter_payload_json ? (row.filter_payload_json as Record<string, unknown>) : null,
    artifactTitle: row.artifact_title,
    artifactContent: row.artifact_content,
    artifactMetadata: row.artifact_metadata_json ? (row.artifact_metadata_json as Record<string, unknown>) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ─── Audit Events ─────────────────────────────────────────────────────────────

export async function createAgentAuditEvent(
  input: CreateAgentAuditEventInput,
): Promise<AgentAuditEventRecord> {
  const supabase = await createSupabaseServerClient();
  const redacted = redactAuditPayload(input.payload ?? null);

  const { data, error } = await supabase
    .from("agent_audit_events")
    .insert({
      id: randomUUID(),
      workspace_id: input.workspaceId,
      correlation_id: input.correlationId ?? null,
      category: input.category,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      outcome: input.outcome ?? "success",
      source_type: input.sourceType,
      scope_type: input.scopeType,
      scope_id: input.scopeId ?? null,
      agent_id: input.agentId ?? null,
      agent_type: input.agentType ?? null,
      actor_id: input.actorId ?? null,
      project_id: input.projectId ?? null,
      pm_id: input.pmId ?? null,
      portfolio_id: input.portfolioId ?? null,
      tool_key: input.toolKey ?? null,
      tool_request_id: input.toolRequestId ?? null,
      approval_request_id: input.approvalRequestId ?? null,
      memory_id: input.memoryId ?? null,
      context_policy_id: input.contextPolicyId ?? null,
      report_id: input.reportId ?? null,
      title: input.title,
      message: input.message ?? null,
      reason_code: input.reasonCode ?? null,
      payload_json: redacted,
      redacted_payload_json: redacted,
      evidence_refs_json: input.evidenceRefs ?? [],
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create audit event: ${error.message}`);
  return mapAuditEventRow(data as AuditEventRow);
}

export async function getAgentAuditEventById(
  workspaceId: string,
  eventId: string,
): Promise<AgentAuditEventRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_audit_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", eventId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get audit event: ${error.message}`);
  }
  return data ? mapAuditEventRow(data as AuditEventRow) : null;
}

export async function listAgentAuditEvents(
  workspaceId: string,
  filters?: AgentAuditListFilters,
): Promise<AgentAuditEventRecord[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("agent_audit_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false });

  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.eventType) query = query.eq("event_type", filters.eventType);
  if (filters?.severity) query = query.eq("severity", filters.severity);
  if (filters?.outcome) query = query.eq("outcome", filters.outcome);
  if (filters?.sourceType) query = query.eq("source_type", filters.sourceType);
  if (filters?.scopeType) query = query.eq("scope_type", filters.scopeType);
  if (filters?.scopeId) query = query.eq("scope_id", filters.scopeId);
  if (filters?.agentId) query = query.eq("agent_id", filters.agentId);
  if (filters?.agentType) query = query.eq("agent_type", filters.agentType);
  if (filters?.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters?.projectId) query = query.eq("project_id", filters.projectId);
  if (filters?.pmId) query = query.eq("pm_id", filters.pmId);
  if (filters?.portfolioId) query = query.eq("portfolio_id", filters.portfolioId);
  if (filters?.toolKey) query = query.eq("tool_key", filters.toolKey);
  if (filters?.correlationId) query = query.eq("correlation_id", filters.correlationId);
  if (filters?.occurredFrom) query = query.gte("occurred_at", filters.occurredFrom);
  if (filters?.occurredTo) query = query.lte("occurred_at", filters.occurredTo);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list audit events: ${error.message}`);
  return (data ?? []).map(row => mapAuditEventRow(row as AuditEventRow));
}

// ─── Decision Events ──────────────────────────────────────────────────────────

export async function createAgentDecisionEvent(
  input: CreateAgentDecisionEventInput,
): Promise<AgentDecisionEventRecord> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("agent_decision_events")
    .insert({
      id: randomUUID(),
      workspace_id: input.workspaceId,
      audit_event_id: input.auditEventId ?? null,
      correlation_id: input.correlationId ?? null,
      agent_id: input.agentId ?? null,
      agent_type: input.agentType ?? null,
      decision_type: input.decisionType,
      status: input.status ?? "draft",
      scope_type: input.scopeType,
      scope_id: input.scopeId ?? null,
      project_id: input.projectId ?? null,
      pm_id: input.pmId ?? null,
      portfolio_id: input.portfolioId ?? null,
      title: input.title,
      summary: input.summary ?? null,
      rationale: input.rationale ?? null,
      confidence_score: input.confidenceScore ?? null,
      risk_level: input.riskLevel ?? null,
      evidence_refs_json: input.evidenceRefs ?? [],
      decision_payload_json: input.decisionPayload ?? null,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create decision event: ${error.message}`);
  return mapDecisionEventRow(data as DecisionEventRow);
}

export async function getAgentDecisionEventById(
  workspaceId: string,
  decisionId: string,
): Promise<AgentDecisionEventRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_decision_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", decisionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get decision event: ${error.message}`);
  }
  return data ? mapDecisionEventRow(data as DecisionEventRow) : null;
}

export async function listAgentDecisionEvents(
  workspaceId: string,
  filters?: {
    decisionType?: AgentDecisionType;
    status?: AgentDecisionStatus;
    agentId?: string;
    agentType?: string;
    scopeType?: AgentAuditScopeType;
    scopeId?: string;
    projectId?: string;
    pmId?: string;
    portfolioId?: string;
    correlationId?: string;
    limit?: number;
  },
): Promise<AgentDecisionEventRecord[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("agent_decision_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (filters?.decisionType) query = query.eq("decision_type", filters.decisionType);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.agentId) query = query.eq("agent_id", filters.agentId);
  if (filters?.agentType) query = query.eq("agent_type", filters.agentType);
  if (filters?.scopeType) query = query.eq("scope_type", filters.scopeType);
  if (filters?.scopeId) query = query.eq("scope_id", filters.scopeId);
  if (filters?.projectId) query = query.eq("project_id", filters.projectId);
  if (filters?.pmId) query = query.eq("pm_id", filters.pmId);
  if (filters?.portfolioId) query = query.eq("portfolio_id", filters.portfolioId);
  if (filters?.correlationId) query = query.eq("correlation_id", filters.correlationId);
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list decision events: ${error.message}`);
  return (data ?? []).map(row => mapDecisionEventRow(row as DecisionEventRow));
}

export async function updateAgentDecisionStatus(input: {
  workspaceId: string;
  decisionId: string;
  status: AgentDecisionStatus;
  actorId?: string | null;
  reason?: string | null;
}): Promise<AgentDecisionEventRecord> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("agent_decision_events")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.decisionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update decision status: ${error.message}`);
  if (!data) throw new Error("Decision event not found");
  return mapDecisionEventRow(data as DecisionEventRow);
}

// ─── Audit Exports ────────────────────────────────────────────────────────────

export async function createAgentAuditExport(input: {
  workspaceId: string;
  exportFormat: AgentAuditExportFormat;
  filterPayload?: Record<string, unknown> | null;
  artifactTitle: string;
  artifactContent: string;
  artifactMetadata?: Record<string, unknown> | null;
  createdBy?: string | null;
}): Promise<AgentAuditExportRecord> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("agent_audit_exports")
    .insert({
      id: randomUUID(),
      workspace_id: input.workspaceId,
      export_format: input.exportFormat,
      filter_payload_json: input.filterPayload ?? null,
      artifact_title: input.artifactTitle,
      artifact_content: input.artifactContent,
      artifact_metadata_json: input.artifactMetadata ?? null,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create audit export: ${error.message}`);
  return mapExportRow(data as ExportRow);
}

export async function getAgentAuditExportById(
  workspaceId: string,
  exportId: string,
): Promise<AgentAuditExportRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agent_audit_exports")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", exportId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get audit export: ${error.message}`);
  }
  return data ? mapExportRow(data as ExportRow) : null;
}

export async function listAgentAuditExports(
  workspaceId: string,
  limit?: number,
): Promise<AgentAuditExportRecord[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("agent_audit_exports")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list audit exports: ${error.message}`);
  return (data ?? []).map(row => mapExportRow(row as ExportRow));
}
