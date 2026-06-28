// ─── Agent Tool Execution Adapter Layer — Service ─────────────────────────────
// NOTE: This service is purely in-memory. It does NOT use Supabase.
// It simulates DB operations using in-memory Maps for testing and runtime use
// without a database dependency.

import { randomUUID } from "node:crypto";
// NOTE: agent-execution-registry and agent-execution-service are loaded lazily
// via dynamic imports so this module can be loaded in test environments without Supabase.
import {
  selectAgentToolAdapterForExecutionRequest,
  evaluateAgentToolAdapterEligibility,
  getAgentToolAdapterByKey,
} from "./agent-tool-adapter-registry";
import { redactAdapterPayload, assertAdapterOutputSerializable } from "./agent-tool-adapter-validation";
import type {
  AgentToolAdapterRunInput,
  AgentToolAdapterRunResult,
  AgentToolAdapterExecutionRecord,
  AgentToolAdapterExecutionEventRecord,
  AgentToolAdapterExecutionEventType,
  AgentToolAdapterExecutionMode,
  AgentToolAdapterOutputType,
  AgentToolAdapterExecutionStatus,
} from "./agent-tool-adapter-types";
import type { AgentExecutionRequestRecord } from "./agent-execution-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const adapterExecutionStore = new Map<string, AgentToolAdapterExecutionRecord>();
const adapterExecutionEventStore = new Map<string, AgentToolAdapterExecutionEventRecord[]>();

// ─── Audit Helper ─────────────────────────────────────────────────────────────

async function tryAuditEvent(args: {
  workspaceId: string;
  title: string;
  eventType: string;
  toolKey?: string | null;
  actorId?: string | null;
}) {
  try {
    const { recordAgentAuditEvent } = await import("./agent-observability-service");
    await recordAgentAuditEvent({
      workspaceId: args.workspaceId,
      category: "execution" as never,
      eventType: args.eventType as never,
      sourceType: "agent_tool_adapter_layer" as never,
      scopeType: "workspace",
      title: args.title,
      toolKey: args.toolKey ?? null,
      actorId: args.actorId ?? null,
    });
  } catch {
    // Observability is non-fatal
  }
}

// ─── Output Generation ────────────────────────────────────────────────────────

export function generateAdapterOutput(
  adapterKey: string,
  outputType: AgentToolAdapterOutputType,
  req: AgentExecutionRequestRecord,
  payload: Record<string, unknown> | null
): Record<string, unknown> {
  switch (adapterKey) {
    case "noop_adapter":
      return { type: "noop", message: "No operation performed.", wouldExecute: false };

    case "draft_email_adapter":
      return {
        type: "draft_email",
        subject: "Draft: " + (payload?.title ?? "Email"),
        body: "Draft generated from safe execution request input.",
        recipients: [],
        sendStatus: "not_sent",
        requiresHumanReview: true,
      };

    case "draft_task_adapter":
      return {
        type: "draft_task",
        title: payload?.title ?? "Draft Task",
        description: payload?.description ?? "Task draft.",
        status: "draft",
        requiresHumanReview: true,
      };

    case "draft_project_update_adapter":
      return {
        type: "draft_project_update",
        summary: payload?.summary ?? payload?.description ?? "Project update draft.",
        status: "draft",
        appliedToProject: false,
        requiresHumanReview: true,
      };

    case "executive_summary_adapter":
      return {
        type: "structured_summary",
        summary: payload?.summary ?? "Executive summary draft.",
        sections: [],
        status: "draft",
        requiresHumanReview: true,
      };

    case "risk_analysis_adapter":
      return {
        type: "risk_analysis",
        riskLevel: req.riskLevel,
        findings: [],
        recommendations: [],
        status: "draft",
        requiresHumanReview: true,
      };

    default:
      return { type: "noop", message: "No operation performed.", wouldExecute: false };
  }
}

// ─── Evidence Refs ────────────────────────────────────────────────────────────

function buildEvidenceRefs(req: AgentExecutionRequestRecord, adapterKey: string): string[] {
  const refs: string[] = [
    `execution_request:${req.id}`,
    `adapter:${adapterKey}`,
    `tool:${req.toolKey}`,
    `mode:${req.executionMode}`,
    `scope:${req.scopeType}:${req.scopeId ?? "workspace"}`,
  ];
  if (req.approvalRequestId) {
    refs.push(`approval_request:${req.approvalRequestId}`);
  }
  for (const memId of req.memoryIds ?? []) {
    refs.push(`memory:${memId}`);
  }
  return refs;
}

// ─── Refused Result Builder ───────────────────────────────────────────────────

function refusedResult(args: {
  executionRequestId: string;
  adapterKey: string;
  toolKey: string;
  executionMode: AgentToolAdapterExecutionMode;
  refusalReason: string;
  errorCode?: string;
}): AgentToolAdapterRunResult {
  const now = new Date().toISOString();
  return {
    executionRequestId: args.executionRequestId,
    adapterKey: args.adapterKey,
    toolKey: args.toolKey,
    executionMode: args.executionMode,
    status: "refused",
    outputType: "noop",
    outputPayload: null,
    evidenceRefs: [],
    warnings: [],
    refusalReason: args.refusalReason,
    errorCode: args.errorCode ?? "REFUSED",
    errorMessage: args.refusalReason,
    startedAt: now,
    completedAt: now,
  };
}

// ─── Execution Record CRUD ────────────────────────────────────────────────────

export async function createAgentToolAdapterExecution(
  data: Omit<AgentToolAdapterExecutionRecord, "id" | "createdAt" | "updatedAt">
): Promise<AgentToolAdapterExecutionRecord> {
  const now = new Date().toISOString();
  const record: AgentToolAdapterExecutionRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  adapterExecutionStore.set(record.id, record);
  return record;
}

export async function updateAgentToolAdapterExecution(
  id: string,
  updates: Partial<Omit<AgentToolAdapterExecutionRecord, "id" | "createdAt">>
): Promise<AgentToolAdapterExecutionRecord | null> {
  const existing = adapterExecutionStore.get(id);
  if (!existing) return null;
  const updated: AgentToolAdapterExecutionRecord = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  adapterExecutionStore.set(id, updated);
  return updated;
}

export async function getAgentToolAdapterExecutionById(
  _workspaceId: string,
  id: string
): Promise<AgentToolAdapterExecutionRecord | null> {
  return adapterExecutionStore.get(id) ?? null;
}

export async function listAgentToolAdapterExecutions(
  workspaceId: string,
  filters?: { executionRequestId?: string; adapterKey?: string; executionStatus?: AgentToolAdapterExecutionStatus; limit?: number }
): Promise<AgentToolAdapterExecutionRecord[]> {
  let results = Array.from(adapterExecutionStore.values()).filter((r) => r.workspaceId === workspaceId);
  if (filters?.executionRequestId) {
    results = results.filter((r) => r.executionRequestId === filters.executionRequestId);
  }
  if (filters?.adapterKey) {
    results = results.filter((r) => r.adapterKey === filters.adapterKey);
  }
  if (filters?.executionStatus) {
    results = results.filter((r) => r.executionStatus === filters.executionStatus);
  }
  if (filters?.limit) {
    results = results.slice(0, filters.limit);
  }
  return results;
}

// ─── Event Record CRUD ────────────────────────────────────────────────────────

export async function recordAgentToolAdapterExecutionEvent(
  data: Omit<AgentToolAdapterExecutionEventRecord, "id" | "createdAt">
): Promise<AgentToolAdapterExecutionEventRecord> {
  const record: AgentToolAdapterExecutionEventRecord = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const existing = adapterExecutionEventStore.get(data.adapterExecutionId) ?? [];
  existing.push(record);
  adapterExecutionEventStore.set(data.adapterExecutionId, existing);
  return record;
}

export async function listAgentToolAdapterExecutionEvents(
  _workspaceId: string,
  adapterExecutionId: string
): Promise<AgentToolAdapterExecutionEventRecord[]> {
  return adapterExecutionEventStore.get(adapterExecutionId) ?? [];
}

// ─── Core: runAgentToolAdapter ────────────────────────────────────────────────

export async function runAgentToolAdapter(input: AgentToolAdapterRunInput): Promise<AgentToolAdapterRunResult> {
  const { workspaceId, executionRequestId, actorId, forceDryRun } = input;

  // 1. Load execution request (dynamic import to avoid Supabase dependency at module load time)
  let req: AgentExecutionRequestRecord | null = null;
  try {
    const { getAgentExecutionRequestById } = await import("./agent-execution-registry");
    req = await getAgentExecutionRequestById(workspaceId, executionRequestId);
  } catch {
    // DB not available — treat as not found
  }

  if (!req) {
    return refusedResult({
      executionRequestId,
      adapterKey: input.adapterKey ?? "unknown",
      toolKey: "unknown",
      executionMode: "dry_run",
      refusalReason: "Execution request not found",
      errorCode: "EXECUTION_REQUEST_NOT_FOUND",
    });
  }

  // 2. State check
  if (req.executionState !== "ready_for_execution") {
    return refusedResult({
      executionRequestId,
      adapterKey: input.adapterKey ?? "unknown",
      toolKey: req.toolKey,
      executionMode: "dry_run",
      refusalReason: `Execution request is not ready for execution (state: ${req.executionState})`,
      errorCode: "EXECUTION_REQUEST_NOT_READY",
    });
  }

  // 3. Execution mode check
  const effectiveMode: AgentToolAdapterExecutionMode = forceDryRun ? "dry_run" : (req.executionMode as AgentToolAdapterExecutionMode);
  if (effectiveMode !== "dry_run" && effectiveMode !== "draft_only") {
    return refusedResult({
      executionRequestId,
      adapterKey: input.adapterKey ?? "unknown",
      toolKey: req.toolKey,
      executionMode: "dry_run",
      refusalReason: `Execution mode "${req.executionMode}" is not supported by the adapter layer`,
      errorCode: "UNSUPPORTED_EXECUTION_MODE",
    });
  }

  // 4. Select adapter
  const adapter = input.adapterKey
    ? getAgentToolAdapterByKey(input.adapterKey)
    : selectAgentToolAdapterForExecutionRequest({
        toolKey: req.toolKey,
        executionMode: effectiveMode,
        scopeType: req.scopeType,
        riskLevel: req.riskLevel,
        requiresApproval: req.requiresApproval,
        approvalRequestId: req.approvalRequestId,
      });

  // 5. Evaluate eligibility
  const eligibility = evaluateAgentToolAdapterEligibility({ adapter, executionRequest: req });

  if (!eligibility.eligible) {
    // Create refused record
    const now = new Date().toISOString();
    const execRecord = await createAgentToolAdapterExecution({
      workspaceId,
      executionRequestId,
      adapterKey: adapter?.adapterKey ?? input.adapterKey ?? "unknown",
      toolKey: req.toolKey,
      executionMode: effectiveMode,
      executionStatus: "refused",
      outputType: "noop",
      inputSnapshot: null,
      safeInputSnapshot: null,
      outputPayload: null,
      evidenceRefs: [],
      warnings: [],
      refusalReason: eligibility.message,
      errorCode: eligibility.reasonCode.toUpperCase(),
      errorMessage: eligibility.message,
      actorId: actorId ?? null,
      startedAt: now,
      completedAt: now,
    });

    await recordAgentToolAdapterExecutionEvent({
      workspaceId,
      adapterExecutionId: execRecord.id,
      executionRequestId,
      eventType: "adapter_execution_refused",
      message: eligibility.message,
      eventPayload: { reasonCode: eligibility.reasonCode, checks: eligibility.checks },
      actorId: actorId ?? null,
    });

    await tryAuditEvent({
      workspaceId,
      title: `Adapter execution refused: ${eligibility.reasonCode}`,
      eventType: "adapter_execution_refused",
      toolKey: req.toolKey,
      actorId,
    });

    return refusedResult({
      executionRequestId,
      adapterKey: adapter?.adapterKey ?? input.adapterKey ?? "unknown",
      toolKey: req.toolKey,
      executionMode: effectiveMode,
      refusalReason: eligibility.message,
      errorCode: eligibility.reasonCode.toUpperCase(),
    });
  }

  // 6. Eligible — run adapter
  const startedAt = new Date().toISOString();
  const adapterDef = adapter!;

  // Build input snapshot
  const inputSnapshot: Record<string, unknown> = {
    executionRequestId: req.id,
    toolKey: req.toolKey,
    executionMode: effectiveMode,
    riskLevel: req.riskLevel,
    scopeType: req.scopeType,
    scopeId: req.scopeId,
    inputPayload: req.inputPayload,
  };
  const safeInputSnapshot = redactAdapterPayload(inputSnapshot);

  // Create queued record
  const execRecord = await createAgentToolAdapterExecution({
    workspaceId,
    executionRequestId,
    adapterKey: adapterDef.adapterKey,
    toolKey: req.toolKey,
    executionMode: effectiveMode,
    executionStatus: "queued",
    outputType: adapterDef.outputTypes[0],
    inputSnapshot,
    safeInputSnapshot,
    outputPayload: null,
    evidenceRefs: [],
    warnings: [],
    refusalReason: null,
    errorCode: null,
    errorMessage: null,
    actorId: actorId ?? null,
    startedAt,
    completedAt: null,
  });

  await recordAgentToolAdapterExecutionEvent({
    workspaceId,
    adapterExecutionId: execRecord.id,
    executionRequestId,
    eventType: "adapter_execution_created",
    message: `Adapter execution queued for "${adapterDef.adapterKey}"`,
    eventPayload: null,
    actorId: actorId ?? null,
  });

  // Update to running
  await updateAgentToolAdapterExecution(execRecord.id, { executionStatus: "running" });
  await recordAgentToolAdapterExecutionEvent({
    workspaceId,
    adapterExecutionId: execRecord.id,
    executionRequestId,
    eventType: "adapter_execution_started",
    message: `Adapter execution started`,
    eventPayload: null,
    actorId: actorId ?? null,
  });

  // Generate output
  let outputPayload: Record<string, unknown>;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;
  let finalStatus: AgentToolAdapterExecutionStatus = "succeeded";

  try {
    const payload = req.inputPayload as Record<string, unknown> | null;
    outputPayload = generateAdapterOutput(adapterDef.adapterKey, adapterDef.outputTypes[0], req, payload);
    assertAdapterOutputSerializable(outputPayload);
  } catch (err) {
    finalStatus = "failed";
    errorCode = "OUTPUT_GENERATION_FAILED";
    errorMessage = err instanceof Error ? err.message : String(err);
    outputPayload = { type: "noop", message: "Output generation failed." };
  }

  const evidenceRefs = buildEvidenceRefs(req, adapterDef.adapterKey);
  const completedAt = new Date().toISOString();

  await updateAgentToolAdapterExecution(execRecord.id, {
    executionStatus: finalStatus,
    outputPayload,
    evidenceRefs,
    errorCode,
    errorMessage,
    completedAt,
  });

  const finalEventType: AgentToolAdapterExecutionEventType =
    finalStatus === "succeeded" ? "adapter_execution_succeeded" : "adapter_execution_failed";

  await recordAgentToolAdapterExecutionEvent({
    workspaceId,
    adapterExecutionId: execRecord.id,
    executionRequestId,
    eventType: finalEventType,
    message: finalStatus === "succeeded" ? "Adapter execution succeeded" : errorMessage,
    eventPayload: finalStatus === "succeeded" ? { outputType: adapterDef.outputTypes[0] } : { errorCode, errorMessage },
    actorId: actorId ?? null,
  });

  // Complete the execution request (non-fatal if DB unavailable)
  try {
    const { completeDryRunExecution, completeDraftOnlyExecution } = await import("./agent-execution-service");
    if (effectiveMode === "dry_run") {
      await completeDryRunExecution({
        workspaceId,
        executionRequestId,
        resultPayload: outputPayload,
      });
    } else {
      await completeDraftOnlyExecution({
        workspaceId,
        executionRequestId,
        resultPayload: outputPayload,
      });
    }
  } catch {
    // Non-fatal — DB may not be available
  }

  await tryAuditEvent({
    workspaceId,
    title: `Adapter execution ${finalStatus}: ${adapterDef.adapterKey}`,
    eventType: finalStatus === "succeeded" ? "adapter_execution_succeeded" : "adapter_execution_failed",
    toolKey: req.toolKey,
    actorId,
  });

  return {
    executionRequestId,
    adapterKey: adapterDef.adapterKey,
    toolKey: req.toolKey,
    executionMode: effectiveMode,
    status: finalStatus,
    outputType: adapterDef.outputTypes[0],
    outputPayload,
    evidenceRefs,
    warnings: [],
    refusalReason: null,
    errorCode,
    errorMessage,
    startedAt,
    completedAt,
  };
}

// ─── Convenience Wrappers ─────────────────────────────────────────────────────

export async function runDryRunAdapter(input: AgentToolAdapterRunInput): Promise<AgentToolAdapterRunResult> {
  return runAgentToolAdapter({ ...input, forceDryRun: true });
}

export async function runDraftOnlyAdapter(input: AgentToolAdapterRunInput): Promise<AgentToolAdapterRunResult> {
  return runAgentToolAdapter({ ...input, forceDryRun: false });
}
