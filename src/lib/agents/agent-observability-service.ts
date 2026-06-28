// ─── Agent Observability & Audit Trail — Service ──────────────────────────────

import { normalizeCreateAgentAuditEventInput, normalizeCreateAgentDecisionEventInput } from "./agent-observability-validation";
import {
  createAgentAuditEvent,
  getAgentAuditEventById,
  listAgentAuditEvents,
  createAgentDecisionEvent,
  updateAgentDecisionStatus,
  createAgentAuditExport,
} from "./agent-observability-registry";
import type {
  AgentAuditEventRecord,
  AgentDecisionEventRecord,
  AgentAuditExportRecord,
  AgentTimelineEntry,
  CreateAgentAuditEventInput,
  CreateAgentDecisionEventInput,
  CreateAgentAuditExportInput,
  AgentAuditListFilters,
  AgentAuditScopeType,
  AgentAuditOutcome,
} from "./agent-observability-types";

// ─── Core audit event recording ───────────────────────────────────────────────

export async function recordAgentAuditEvent(
  input: CreateAgentAuditEventInput,
): Promise<AgentAuditEventRecord> {
  const normalized = normalizeCreateAgentAuditEventInput(input);
  return createAgentAuditEvent(normalized);
}

// ─── Decision recording ───────────────────────────────────────────────────────

export async function recordAgentDecision(
  input: CreateAgentDecisionEventInput & { createAuditEvent?: boolean },
): Promise<{ decision: AgentDecisionEventRecord; auditEvent: AgentAuditEventRecord | null }> {
  const normalized = normalizeCreateAgentDecisionEventInput(input);
  const decision = await createAgentDecisionEvent(normalized);

  let auditEvent: AgentAuditEventRecord | null = null;
  if (input.createAuditEvent) {
    try {
      const auditInput = normalizeCreateAgentAuditEventInput({
        workspaceId: normalized.workspaceId,
        correlationId: normalized.correlationId,
        category: "decision",
        eventType: "decision_recorded",
        severity: "notice",
        outcome: "success",
        sourceType: "api",
        scopeType: normalized.scopeType,
        scopeId: normalized.scopeId,
        agentId: normalized.agentId,
        agentType: normalized.agentType,
        projectId: normalized.projectId,
        pmId: normalized.pmId,
        portfolioId: normalized.portfolioId,
        title: `Decision recorded: ${normalized.title}`,
        message: normalized.summary ?? null,
        evidenceRefs: normalized.evidenceRefs,
      });
      auditEvent = await createAgentAuditEvent(auditInput);
    } catch {
      // audit event failure is non-fatal for the decision record
    }
  }

  return { decision, auditEvent };
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export async function getAgentTimeline(input: {
  workspaceId: string;
  correlationId?: string;
  agentId?: string;
  agentType?: string;
  projectId?: string;
  pmId?: string;
  portfolioId?: string;
  scopeType?: AgentAuditScopeType;
  scopeId?: string;
  limit?: number;
}): Promise<AgentTimelineEntry[]> {
  const limit = input.limit ?? 50;
  const filters: AgentAuditListFilters = {
    correlationId: input.correlationId,
    agentId: input.agentId,
    agentType: input.agentType,
    projectId: input.projectId,
    pmId: input.pmId,
    portfolioId: input.portfolioId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    limit,
  };

  const events = await listAgentAuditEvents(input.workspaceId, filters);

  const auditEntries: AgentTimelineEntry[] = events.map(e => ({
    id: e.id,
    source: "audit_event" as const,
    occurredAt: e.occurredAt,
    category: e.category,
    eventType: e.eventType,
    title: e.title,
    message: e.message,
    severity: e.severity,
    outcome: e.outcome,
    correlationId: e.correlationId,
    relatedId: e.toolRequestId ?? e.approvalRequestId ?? e.memoryId ?? null,
  }));

  return auditEntries.sort((a, b) =>
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  ).slice(0, limit);
}

// ─── Workspace summary ────────────────────────────────────────────────────────

export async function getWorkspaceAgentAuditSummary(input: {
  workspaceId: string;
  occurredFrom?: string;
  occurredTo?: string;
}): Promise<{
  totalEvents: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  byOutcome: Record<string, number>;
  highRiskCount: number;
  deniedCount: number;
  criticalCount: number;
}> {
  const events = await listAgentAuditEvents(input.workspaceId, {
    occurredFrom: input.occurredFrom,
    occurredTo: input.occurredTo,
    limit: 5000,
  });

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};

  for (const e of events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
    byOutcome[e.outcome] = (byOutcome[e.outcome] ?? 0) + 1;
  }

  return {
    totalEvents: events.length,
    byCategory,
    bySeverity,
    byOutcome,
    highRiskCount: (bySeverity["high"] ?? 0),
    deniedCount: (byOutcome["denied"] ?? 0),
    criticalCount: (bySeverity["critical"] ?? 0),
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCSVArtifact(events: AgentAuditEventRecord[]): string {
  const header = [
    "occurredAt", "category", "eventType", "severity", "outcome",
    "sourceType", "scopeType", "scopeId", "agentType", "actorId",
    "projectId", "pmId", "toolKey", "title", "reasonCode", "correlationId",
  ].join(",");

  const rows = events.map(e =>
    [
      e.occurredAt, e.category, e.eventType, e.severity, e.outcome,
      e.sourceType, e.scopeType, e.scopeId, e.agentType, e.actorId,
      e.projectId, e.pmId, e.toolKey, e.title, e.reasonCode, e.correlationId,
    ].map(escapeCSV).join(","),
  );

  return [header, ...rows].join("\n");
}

function buildMarkdownArtifact(
  events: AgentAuditEventRecord[],
  metadata: { workspaceId: string; filters?: AgentAuditListFilters; generatedAt: string },
): string {
  const lines: string[] = [
    "# Agent Audit Trail",
    "",
    `**Generated at:** ${metadata.generatedAt}`,
    `**Workspace:** ${metadata.workspaceId}`,
  ];

  if (metadata.filters) {
    const filterDesc = Object.entries(metadata.filters)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (filterDesc) lines.push(`**Filters:** ${filterDesc}`);
  }

  lines.push("", "## Summary", "");
  lines.push(`Total events: **${events.length}**`);

  lines.push("", "## Events", "");

  for (const e of events) {
    lines.push(`### ${e.title}`);
    lines.push(`- **Timestamp:** ${e.occurredAt}`);
    lines.push(`- **Category:** ${e.category}`);
    lines.push(`- **Event type:** ${e.eventType}`);
    lines.push(`- **Severity:** ${e.severity}`);
    lines.push(`- **Outcome:** ${e.outcome}`);
    if (e.message) lines.push(`- **Message:** ${e.message}`);
    if (e.correlationId) lines.push(`- **Correlation ID:** ${e.correlationId}`);
    if (e.evidenceRefs.length > 0) lines.push(`- **Evidence:** ${e.evidenceRefs.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

export async function exportAgentAuditTrail(
  input: CreateAgentAuditExportInput,
): Promise<AgentAuditExportRecord> {
  const { workspaceId, exportFormat, filters, createdBy } = input;
  const artifactTitle = input.artifactTitle ?? `Agent Audit Export — ${new Date().toISOString()}`;

  const events = await listAgentAuditEvents(workspaceId, filters);

  const generatedAt = new Date().toISOString();
  let artifactContent: string;

  if (exportFormat === "json") {
    artifactContent = JSON.stringify(
      {
        metadata: { generatedAt, workspaceId, filters },
        events: events.map(e => ({ ...e, payload: e.redactedPayload })),
      },
      null,
      2,
    );
  } else if (exportFormat === "csv") {
    artifactContent = buildCSVArtifact(events);
  } else {
    artifactContent = buildMarkdownArtifact(events, { workspaceId, filters, generatedAt });
  }

  const exportRecord = await createAgentAuditExport({
    workspaceId,
    exportFormat,
    filterPayload: filters ? (filters as unknown as Record<string, unknown>) : null,
    artifactTitle,
    artifactContent,
    artifactMetadata: { generatedAt, eventCount: events.length },
    createdBy: createdBy ?? null,
  });

  // record audit event for the export itself (non-fatal)
  try {
    await recordAgentAuditEvent({
      workspaceId,
      category: "system",
      eventType: "audit_export_created",
      severity: "notice",
      outcome: "success",
      sourceType: "api",
      scopeType: "workspace",
      title: `Audit export created: ${artifactTitle}`,
      message: `Format: ${exportFormat}. Events: ${events.length}.`,
      evidenceRefs: [exportRecord.id],
    });
  } catch {
    // non-fatal
  }

  return exportRecord;
}

// ─── Cross-layer helpers ───────────────────────────────────────────────────────

export async function recordToolRequestAuditEvent(input: {
  workspaceId: string;
  toolRequestId: string;
  toolKey: string;
  agentId?: string | null;
  agentType?: string | null;
  actorId?: string | null;
  projectId?: string | null;
  correlationId?: string | null;
  eventType:
    | "tool_request_created"
    | "tool_request_approved"
    | "tool_request_rejected"
    | "tool_request_cancelled"
    | "tool_request_revoked";
  outcome: AgentAuditOutcome;
  title?: string;
  message?: string | null;
  reasonCode?: string | null;
}): Promise<AgentAuditEventRecord> {
  return recordAgentAuditEvent({
    workspaceId: input.workspaceId,
    correlationId: input.correlationId ?? null,
    category: "tool",
    eventType: input.eventType,
    severity: input.eventType === "tool_request_rejected" || input.eventType === "tool_request_revoked" ? "warning" : "notice",
    outcome: input.outcome,
    sourceType: "agent_tool_approval",
    scopeType: "tool_request",
    scopeId: input.toolRequestId,
    agentId: input.agentId ?? null,
    agentType: input.agentType ?? null,
    actorId: input.actorId ?? null,
    projectId: input.projectId ?? null,
    toolKey: input.toolKey,
    toolRequestId: input.toolRequestId,
    title: input.title ?? `Tool request ${input.eventType.replace("tool_request_", "")}: ${input.toolKey}`,
    message: input.message ?? null,
    reasonCode: input.reasonCode ?? null,
    evidenceRefs: [`tool_request:${input.toolRequestId}`],
  });
}

export async function recordMemoryAuditEvent(input: {
  workspaceId: string;
  memoryId: string;
  agentId?: string | null;
  agentType?: string | null;
  actorId?: string | null;
  projectId?: string | null;
  correlationId?: string | null;
  eventType:
    | "memory_created"
    | "memory_accessed"
    | "memory_marked_stale"
    | "memory_expired"
    | "memory_revoked"
    | "memory_archived";
  outcome: AgentAuditOutcome;
  title?: string;
  message?: string | null;
  reasonCode?: string | null;
}): Promise<AgentAuditEventRecord> {
  const isHighRisk = input.eventType === "memory_revoked";
  return recordAgentAuditEvent({
    workspaceId: input.workspaceId,
    correlationId: input.correlationId ?? null,
    category: "memory",
    eventType: input.eventType,
    severity: isHighRisk ? "warning" : "info",
    outcome: input.outcome,
    sourceType: "agent_memory_context",
    scopeType: "memory_record",
    scopeId: input.memoryId,
    agentId: input.agentId ?? null,
    agentType: input.agentType ?? null,
    actorId: input.actorId ?? null,
    projectId: input.projectId ?? null,
    memoryId: input.memoryId,
    title: input.title ?? `Memory ${input.eventType.replace("memory_", "")}: ${input.memoryId}`,
    message: input.message ?? null,
    reasonCode: input.reasonCode ?? null,
    evidenceRefs: [`memory:${input.memoryId}`],
  });
}
