// ─── Agent Execution Request Runtime — Service ────────────────────────────────

import {
  createAgentExecutionRequest,
  getAgentExecutionRequestById,
  updateAgentExecutionRequestState,
  updateAgentExecutionPreflightResult,
  completeAgentExecutionRequest,
  failAgentExecutionRequest,
  recordAgentExecutionEvent,
} from "./agent-execution-registry";
import {
  normalizeCreateAgentExecutionRequestInput,
  redactExecutionPayload,
} from "./agent-execution-validation";
import type {
  AgentExecutionRequestRecord,
  AgentExecutionPreflightResult,
  AgentExecutionState,
  CreateAgentExecutionRequestInput,
  AgentExecutionTransitionInput,
  CompleteAgentExecutionInput,
  FailAgentExecutionInput,
} from "./agent-execution-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function tryRecordAuditEvent(args: {
  workspaceId: string;
  title: string;
  eventType: string;
  correlationId?: string | null;
  toolKey?: string | null;
}) {
  try {
    const { recordAgentAuditEvent } = await import("./agent-observability-service");
    await recordAgentAuditEvent({
      workspaceId: args.workspaceId,
      category: "execution" as never,
      eventType: args.eventType as never,
      sourceType: "agent_execution_runtime" as never,
      scopeType: "workspace",
      title: args.title,
      correlationId: args.correlationId ?? null,
      toolKey: args.toolKey ?? null,
    });
  } catch {
    // Observability is non-fatal
  }
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function createGovernedAgentExecutionRequest(
  input: CreateAgentExecutionRequestInput,
): Promise<AgentExecutionRequestRecord> {
  const normalized = normalizeCreateAgentExecutionRequestInput(input);
  const safePayload = normalized.inputPayload
    ? redactExecutionPayload(normalized.inputPayload)
    : null;

  const record = await createAgentExecutionRequest({
    ...normalized,
    inputPayload: normalized.inputPayload,
  });

  // Update safe payload separately if needed - it's stored in the registry
  // Record creation event
  try {
    await recordAgentExecutionEvent({
      workspaceId: record.workspaceId,
      executionRequestId: record.id,
      eventType: "execution_request_created",
      fromState: null,
      toState: "draft",
      message: `Execution request created for tool: ${record.toolKey}`,
    });
  } catch {
    // Non-fatal
  }

  void tryRecordAuditEvent({
    workspaceId: record.workspaceId,
    title: `Execution request created: ${record.title}`,
    eventType: "execution_request_created",
    correlationId: record.correlationId,
    toolKey: record.toolKey,
  });

  void safePayload; // suppress unused warning

  return record;
}

export async function runAgentExecutionPreflight(input: {
  workspaceId: string;
  executionRequestId: string;
  actorId?: string | null;
}): Promise<AgentExecutionPreflightResult> {
  const record = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!record) throw new Error(`Execution request not found: ${input.executionRequestId}`);

  // Check if expired
  if (record.expiresAt && new Date(record.expiresAt) <= new Date()) {
    await updateAgentExecutionRequestState({
      workspaceId: input.workspaceId,
      executionRequestId: input.executionRequestId,
      toState: "expired",
      actorId: input.actorId,
      message: "Request expired before preflight",
      eventType: "execution_expired",
    });
    throw new Error("Execution request has expired");
  }

  // Transition to pending_preflight
  await updateAgentExecutionRequestState({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    toState: "pending_preflight",
    actorId: input.actorId,
    message: "Starting preflight checks",
    eventType: "execution_preflight_started",
  });

  const checks: Array<{ name: string; passed: boolean; message: string | null }> = [];
  let requiresApproval = false;
  let blocked = false;

  // Check: tool exists
  let toolFound = false;
  try {
    const { getAgentToolByKey } = await import("./agent-tool-registry");
    const tool = await getAgentToolByKey(input.workspaceId, record.toolKey);
    toolFound = !!tool;
  } catch {
    toolFound = false;
  }

  if (!toolFound) {
    checks.push({ name: "tool_not_found", passed: false, message: `Tool not found: ${record.toolKey}` });
    blocked = true;
  } else {
    checks.push({ name: "tool_exists", passed: true, message: null });
  }

  // Check: risk level requires approval
  if (record.riskLevel === "high" || record.riskLevel === "critical") {
    requiresApproval = true;
    checks.push({ name: "risk_level_requires_approval", passed: true, message: `Risk level ${record.riskLevel} requires approval` });
  }

  // Check: mode requires approval
  if (record.executionMode === "approval_required") {
    requiresApproval = true;
    checks.push({ name: "mode_requires_approval", passed: true, message: "Execution mode requires approval" });
  }

  // Determine next state
  let nextState: AgentExecutionState;
  let preflightStatus: "passed" | "failed";

  if (blocked) {
    nextState = "blocked";
    preflightStatus = "failed";
  } else if (requiresApproval) {
    nextState = "pending_approval";
    preflightStatus = "passed";
  } else {
    nextState = "ready_for_execution";
    preflightStatus = "passed";
  }

  const result: AgentExecutionPreflightResult = {
    status: preflightStatus,
    checks,
    requiresApproval,
    nextState,
    message: blocked ? "Preflight blocked" : requiresApproval ? "Awaiting approval" : "Ready to execute",
  };

  await updateAgentExecutionPreflightResult({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    preflightStatus,
    preflightResult: { ...result, requiresApproval },
    toState: nextState,
    actorId: input.actorId,
  });

  const eventType = blocked
    ? "execution_blocked"
    : requiresApproval
    ? "execution_pending_approval"
    : "execution_preflight_passed";

  try {
    await recordAgentExecutionEvent({
      workspaceId: input.workspaceId,
      executionRequestId: input.executionRequestId,
      eventType,
      fromState: "pending_preflight",
      toState: nextState,
      actorId: input.actorId,
      message: result.message,
    });
  } catch {
    // Non-fatal
  }

  return result;
}

export async function approveAgentExecutionRequest(input: {
  workspaceId: string;
  executionRequestId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentExecutionRequestRecord> {
  const record = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!record) throw new Error(`Execution request not found: ${input.executionRequestId}`);

  return updateAgentExecutionRequestState({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    toState: "approved",
    actorId: input.actorId,
    message: input.message ?? "Approved",
    eventType: "execution_approved",
  });
}

export async function markAgentExecutionReady(input: {
  workspaceId: string;
  executionRequestId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentExecutionRequestRecord> {
  const record = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!record) throw new Error(`Execution request not found: ${input.executionRequestId}`);

  return updateAgentExecutionRequestState({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    toState: "ready_for_execution",
    actorId: input.actorId,
    message: input.message ?? "Ready for execution",
    eventType: "execution_ready",
  });
}

export async function completeDryRunExecution(
  input: CompleteAgentExecutionInput,
): Promise<AgentExecutionRequestRecord> {
  const record = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!record) throw new Error(`Execution request not found: ${input.executionRequestId}`);
  if (record.executionMode !== "dry_run") {
    throw new Error("completeDryRunExecution can only be called for dry_run mode requests");
  }

  const completed = await completeAgentExecutionRequest(input);

  try {
    await recordAgentExecutionEvent({
      workspaceId: input.workspaceId,
      executionRequestId: input.executionRequestId,
      eventType: "execution_dry_run_completed",
      fromState: record.executionState,
      toState: "completed",
      actorId: input.actorId,
      message: input.message ?? "Dry run completed",
    });
  } catch {
    // Non-fatal
  }

  return completed;
}

export async function completeDraftOnlyExecution(
  input: CompleteAgentExecutionInput,
): Promise<AgentExecutionRequestRecord> {
  const record = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!record) throw new Error(`Execution request not found: ${input.executionRequestId}`);
  if (record.executionMode !== "draft_only") {
    throw new Error("completeDraftOnlyExecution can only be called for draft_only mode requests");
  }

  const completed = await completeAgentExecutionRequest(input);

  try {
    await recordAgentExecutionEvent({
      workspaceId: input.workspaceId,
      executionRequestId: input.executionRequestId,
      eventType: "execution_draft_completed",
      fromState: record.executionState,
      toState: "completed",
      actorId: input.actorId,
      message: input.message ?? "Draft completed",
    });
  } catch {
    // Non-fatal
  }

  return completed;
}

export async function cancelAgentExecutionRequest(input: {
  workspaceId: string;
  executionRequestId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentExecutionRequestRecord> {
  return updateAgentExecutionRequestState({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    toState: "cancelled",
    actorId: input.actorId,
    message: input.message ?? "Cancelled",
    eventType: "execution_cancelled",
  });
}

export async function expireAgentExecutionRequest(input: {
  workspaceId: string;
  executionRequestId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentExecutionRequestRecord> {
  return updateAgentExecutionRequestState({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    toState: "expired",
    actorId: input.actorId,
    message: input.message ?? "Expired",
    eventType: "execution_expired",
  });
}

export async function failAgentExecution(
  input: FailAgentExecutionInput,
): Promise<AgentExecutionRequestRecord> {
  const record = await failAgentExecutionRequest(input);

  try {
    await recordAgentExecutionEvent({
      workspaceId: input.workspaceId,
      executionRequestId: input.executionRequestId,
      eventType: "execution_failed",
      toState: "failed",
      actorId: input.actorId,
      message: input.message ?? input.errorMessage ?? "Execution failed",
    });
  } catch {
    // Non-fatal
  }

  return record;
}
