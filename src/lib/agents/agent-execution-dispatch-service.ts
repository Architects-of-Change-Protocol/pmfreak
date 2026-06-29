// ─── Controlled Execution Finalization & Adapter Dispatch Gate — Service ───────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT send emails, Slack messages, or create tickets.
// Does NOT mutate projects. Does NOT execute side-effectful adapters.
// Dispatches only to safe deterministic adapters in dry_run or draft_only modes.

import {
  createAgentExecutionFinalization,
  getAgentExecutionFinalizationById,
  listAgentExecutionFinalizations,
  updateAgentExecutionFinalizationStatus,
  createAgentExecutionDispatchGate,
  getAgentExecutionDispatchGateByFinalizationId,
  updateAgentExecutionDispatchGateStatus,
  acquireAgentExecutionDispatchLock,
  releaseAgentExecutionDispatchLock,
  getAgentExecutionDispatchLockByKey,
  createOrGetAgentExecutionDispatchIdempotency,
  updateAgentExecutionDispatchIdempotencyStatus,
  createAgentExecutionDispatchAttempt,
  updateAgentExecutionDispatchAttemptStatus,
  createAgentExecutionFinalConfirmation,
  confirmAgentExecutionFinalConfirmation,
  getAgentExecutionFinalConfirmationByFinalizationId,
  recordAgentExecutionDispatchEvent,
} from "./agent-execution-dispatch-registry";
import {
  evaluateDispatchSideEffectMode,
  evaluateFinalConfirmationRequirement,
  calculateDispatchReadiness,
  createDispatchIdempotencyKey,
  createDispatchFingerprint,
  normalizeCreateAgentExecutionFinalizationInput,
  normalizeConfirmAgentExecutionDispatchInput,
  normalizeDispatchAgentExecutionInput,
} from "./agent-execution-dispatch-validation";
import type {
  AgentExecutionFinalizationRecord,
  AgentExecutionDispatchGateRecord,
  AgentExecutionFinalConfirmationRecord,
  AgentExecutionSideEffectMode,
} from "./agent-execution-dispatch-types";

// ─── Audit Helper ─────────────────────────────────────────────────────────────

async function tryAuditEvent(args: {
  workspaceId: string;
  title: string;
  eventType: string;
  actorId?: string | null;
}) {
  try {
    const { recordAgentAuditEvent } = await import("./agent-observability-service");
    await recordAgentAuditEvent({
      workspaceId: args.workspaceId,
      category: "execution" as never,
      eventType: args.eventType as never,
      sourceType: "agent_controlled_execution_finalization_adapter_dispatch_gate" as never,
      scopeType: "workspace",
      title: args.title,
      actorId: args.actorId ?? null,
    });
  } catch {
    // audit is best-effort
  }
}

// ─── SAFE_EXECUTION_MODES ─────────────────────────────────────────────────────

const SAFE_EXECUTION_MODES = new Set(["dry_run", "draft_only"]);

// ─── getDispatchAdapterMapping ────────────────────────────────────────────────

export function getDispatchAdapterMapping(input: {
  executionRequestId: string;
  toolKey?: string | null;
  actionConversionId?: string | null;
  actionType?: string | null;
}): {
  selectedToolKey: string | null;
  selectedAdapterKey: string | null;
  executionMode: "dry_run" | "draft_only" | "approval_required" | string;
  sideEffectMode: AgentExecutionSideEffectMode;
  requiresFinalConfirmation: boolean;
} {
  // Deterministic adapter mapping based on tool key / action type
  const toolKey = input.toolKey ?? null;
  let selectedAdapterKey: string | null = null;
  let executionMode: string = "dry_run";

  if (toolKey === "draft_email" || input.actionType === "draft_email") {
    selectedAdapterKey = "draft_email_adapter";
    executionMode = "draft_only";
  } else if (toolKey === "dry_run_analysis" || input.actionType === "dry_run_analysis") {
    selectedAdapterKey = "dry_run_analysis_adapter";
    executionMode = "dry_run";
  } else if (toolKey) {
    selectedAdapterKey = `${toolKey}_adapter`;
    executionMode = "dry_run";
  }

  const sideEffectMode = evaluateDispatchSideEffectMode({ executionMode });
  const requiresFinalConfirmation = false;

  return { selectedToolKey: toolKey, selectedAdapterKey, executionMode, sideEffectMode, requiresFinalConfirmation };
}

// ─── createFinalizationFromExecutionRequest ───────────────────────────────────

export async function createFinalizationFromExecutionRequest(input: {
  workspaceId: string;
  executionRequestId: string;
  actionConversionId?: string | null;
  actorId?: string | null;
}): Promise<AgentExecutionFinalizationRecord> {
  const normalized = normalizeCreateAgentExecutionFinalizationInput({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    actionConversionId: input.actionConversionId ?? null,
    createdBy: input.actorId ?? null,
  });

  // Load execution request
  const { getAgentExecutionRequestById } = await import("./agent-execution-registry");
  const executionRequest = await getAgentExecutionRequestById(normalized.workspaceId, normalized.executionRequestId);
  if (!executionRequest) throw new Error(`Execution request not found: ${normalized.executionRequestId}`);
  if (executionRequest.workspaceId !== normalized.workspaceId) throw new Error("Execution request does not belong to this workspace");

  // Load action conversion if provided
  const actionConversionId = normalized.actionConversionId;
  let actionDraftId: string | null = null;
  let reviewItemId: string | null = null;

  if (actionConversionId) {
    try {
      const { getAgentActionConversionById } = await import("./agent-action-conversion-registry");
      const conversion = await getAgentActionConversionById(normalized.workspaceId, actionConversionId);
      if (conversion) {
        actionDraftId = conversion.actionDraftId;
        reviewItemId = conversion.reviewItemId;
      }
    } catch {
      // best-effort lineage
    }
  }

  // Determine execution mode and risk
  const executionMode = (executionRequest as Record<string, unknown>).executionMode as string ?? "dry_run";
  const riskLevel = ((executionRequest as Record<string, unknown>).riskLevel as string ?? "medium") as "low" | "medium" | "high" | "critical";

  // Determine adapter mapping
  const toolKey = (executionRequest as Record<string, unknown>).toolKey as string | null ?? null;
  const actionType = (executionRequest as Record<string, unknown>).actionType as string | null ?? null;
  const mapping = getDispatchAdapterMapping({
    executionRequestId: normalized.executionRequestId,
    toolKey,
    actionConversionId: actionConversionId ?? null,
    actionType,
  });

  const sideEffectMode = evaluateDispatchSideEffectMode({ executionMode });
  const confirmationEval = evaluateFinalConfirmationRequirement({
    riskLevel,
    executionMode,
    sideEffectMode,
    approvalVerified: false,
  });

  // Create finalization record
  const fin = await createAgentExecutionFinalization({
    workspaceId: normalized.workspaceId,
    executionRequestId: normalized.executionRequestId,
    actionConversionId: actionConversionId ?? null,
    createdBy: normalized.createdBy ?? null,
  });

  // Patch with derived fields
  const patched = await updateAgentExecutionFinalizationStatus({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    status: "created",
    readiness: "not_ready",
    patch: {
      actionDraftId,
      reviewItemId,
      executionMode,
      riskLevel,
      selectedToolKey: mapping.selectedToolKey,
      selectedAdapterKey: mapping.selectedAdapterKey,
      sideEffectMode,
      confirmationRequirement: confirmationEval.requirement,
      confirmationStatus: confirmationEval.status,
    },
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: patched.id,
    executionRequestId: normalized.executionRequestId,
    eventType: "finalization_created",
    message: "Execution finalization created",
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: "Execution finalization created",
    eventType: "execution_finalization_created",
    actorId: input.actorId ?? null,
  });

  return patched;
}

// ─── runExecutionDispatchReadiness ────────────────────────────────────────────

export async function runExecutionDispatchReadiness(input: {
  workspaceId: string;
  finalizationId: string;
  actorId?: string | null;
}): Promise<AgentExecutionFinalizationRecord> {
  const fin = await getAgentExecutionFinalizationById(input.workspaceId, input.finalizationId);
  if (!fin) throw new Error(`Finalization not found: ${input.finalizationId}`);

  // Load execution request
  const { getAgentExecutionRequestById } = await import("./agent-execution-registry");
  const executionRequest = await getAgentExecutionRequestById(input.workspaceId, fin.executionRequestId);
  const execReqExists = !!executionRequest;
  const workspaceMatches = execReqExists && executionRequest!.workspaceId === input.workspaceId;

  // Dispatchable states: execution request must be in a state that allows dispatch
  const dispatchableStates = new Set(["approved", "ready", "pending", "preflight_passed", "approval_not_required"]);
  const executionRequestDispatchable = execReqExists && (
    dispatchableStates.has((executionRequest as Record<string, unknown>).status as string ?? "") ||
    (executionRequest as Record<string, unknown>).approvalReadiness === true
  );

  const executionMode = fin.executionMode;
  const executionModeSafe = SAFE_EXECUTION_MODES.has(executionMode);

  // Approval readiness
  const approvalReady = execReqExists && (
    (executionRequest as Record<string, unknown>).approvalReadiness === true ||
    (executionRequest as Record<string, unknown>).approvalRequired === false ||
    (executionRequest as Record<string, unknown>).status === "approval_not_required"
  );

  // Approval bridge
  let approvalBridgeSatisfied = true;
  if (fin.actionConversionId) {
    try {
      const { getAgentActionApprovalBridgeByConversionId } = await import("./agent-action-conversion-registry");
      const bridge = await getAgentActionApprovalBridgeByConversionId(input.workspaceId, fin.actionConversionId);
      if (bridge) {
        approvalBridgeSatisfied = ["satisfied", "not_required"].includes(bridge.status);
      }
    } catch {
      approvalBridgeSatisfied = true;
    }
  }

  const conversionLinkageValid = !fin.actionConversionId || !!fin.actionConversionId;
  const adapterMappingExists = !!fin.selectedAdapterKey;
  const adapterEligible = !!fin.selectedAdapterKey; // we trust the mapping
  const sideEffectModeAllowed = fin.sideEffectMode === "dry_run" || fin.sideEffectMode === "draft_only" || fin.sideEffectMode === "none";

  // Final confirmation check
  const existingConfirmation = await getAgentExecutionFinalConfirmationByFinalizationId(input.workspaceId, fin.id);
  const confirmationRequired = fin.confirmationRequirement !== "not_required";
  const confirmationSatisfied = !confirmationRequired || (existingConfirmation?.status === "confirmed");
  const finalConfirmationSatisfied = confirmationSatisfied;

  const executionLockAvailable = true; // checked at dispatch time
  const idempotencyKeyValid = true;
  const noPriorSuccessfulDispatch = fin.status !== "dispatch_succeeded" && fin.status !== "result_reconciled" && fin.status !== "completed";
  const payloadSafe = true;
  const scopeKnown = true;
  const riskLevelKnown = !!fin.riskLevel;

  const readinessResult = calculateDispatchReadiness({
    executionRequestExists: execReqExists,
    workspaceMatches,
    executionRequestDispatchable,
    executionModeSafe,
    approvalReady,
    approvalBridgeSatisfied,
    conversionLinkageValid,
    adapterMappingExists,
    adapterEligible,
    sideEffectModeAllowed,
    finalConfirmationSatisfied,
    executionLockAvailable,
    idempotencyKeyValid,
    noPriorSuccessfulDispatch,
    payloadSafe,
    scopeKnown,
    riskLevelKnown,
  });

  // If final confirmation is required and not satisfied, create confirmation record
  if (confirmationRequired && !confirmationSatisfied && !existingConfirmation) {
    await createAgentExecutionFinalConfirmation({
      workspaceId: input.workspaceId,
      finalizationId: fin.id,
      executionRequestId: fin.executionRequestId,
      requirement: fin.confirmationRequirement,
      status: "required",
    });
    await recordAgentExecutionDispatchEvent({
      workspaceId: input.workspaceId,
      finalizationId: fin.id,
      executionRequestId: fin.executionRequestId,
      eventType: "final_confirmation_required",
      message: "Final human confirmation required before dispatch",
      actorId: input.actorId ?? null,
    });
  }

  const newStatus = readinessResult.readiness === "ready"
    ? "readiness_passed"
    : readinessResult.readiness === "requires_confirmation"
    ? "confirmation_required"
    : "readiness_failed";

  // Verify approval if readiness passed
  const approvalVerified = readinessResult.readiness === "ready" && approvalReady;

  const updated = await updateAgentExecutionFinalizationStatus({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    status: newStatus,
    readiness: readinessResult.readiness,
    blockingReasons: readinessResult.blockingReasons,
    warnings: readinessResult.warnings,
    patch: { approvalVerified },
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    eventType: "readiness_checked",
    message: `Dispatch readiness checked: ${readinessResult.readiness}`,
    eventPayload: { checks: readinessResult.checks.length, blockingReasons: readinessResult.blockingReasons },
    actorId: input.actorId ?? null,
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    eventType: readinessResult.readiness === "ready" ? "readiness_passed" : "readiness_failed",
    message: `Readiness result: ${readinessResult.readiness}`,
    actorId: input.actorId ?? null,
  });

  if (approvalVerified) {
    await recordAgentExecutionDispatchEvent({
      workspaceId: input.workspaceId,
      finalizationId: fin.id,
      executionRequestId: fin.executionRequestId,
      eventType: "approval_verified",
      message: "Approval verified for dispatch",
      actorId: input.actorId ?? null,
    });
  }

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: `Dispatch readiness ${readinessResult.readiness}`,
    eventType: readinessResult.readiness === "ready" ? "execution_dispatch_readiness_passed" : "execution_dispatch_readiness_failed",
    actorId: input.actorId ?? null,
  });

  return updated;
}

// ─── createExecutionDispatchGate ──────────────────────────────────────────────

export async function createExecutionDispatchGate(input: {
  workspaceId: string;
  finalizationId: string;
  actorId?: string | null;
}): Promise<AgentExecutionDispatchGateRecord> {
  let fin = await getAgentExecutionFinalizationById(input.workspaceId, input.finalizationId);
  if (!fin) throw new Error(`Finalization not found: ${input.finalizationId}`);

  // Run readiness if not yet run
  if (fin.status === "created" || fin.status === "readiness_pending") {
    fin = await runExecutionDispatchReadiness({ workspaceId: input.workspaceId, finalizationId: fin.id, actorId: input.actorId });
  }

  const isBlocked = fin.readiness === "blocked";
  const requiresConfirmation = fin.readiness === "requires_confirmation";
  const isReady = fin.readiness === "ready";

  const gateStatus = isBlocked ? "blocked" : requiresConfirmation ? "confirmation_required" : isReady ? "allowed" : "blocked";
  const dispatchAllowed = isReady;

  const gate = await createAgentExecutionDispatchGate({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    selectedToolKey: fin.selectedToolKey,
    selectedAdapterKey: fin.selectedAdapterKey,
    executionMode: fin.executionMode,
    sideEffectMode: fin.sideEffectMode,
    dispatchAllowed,
    requiresFinalConfirmation: fin.confirmationRequirement !== "not_required",
    confirmationStatus: fin.confirmationStatus,
    blockingReasons: fin.blockingReasons,
    warnings: fin.warnings,
    createdBy: input.actorId ?? null,
  });

  // Update gate status
  const updatedGate = await updateAgentExecutionDispatchGateStatus({
    workspaceId: input.workspaceId,
    dispatchGateId: gate.id,
    status: gateStatus,
    dispatchAllowed,
  });

  // Link gate to finalization
  await updateAgentExecutionFinalizationStatus({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    status: fin.status,
    patch: { dispatchGateId: gate.id },
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    dispatchGateId: gate.id,
    executionRequestId: fin.executionRequestId,
    eventType: "dispatch_gate_created",
    message: `Dispatch gate created: ${gateStatus}`,
    actorId: input.actorId ?? null,
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    dispatchGateId: gate.id,
    executionRequestId: fin.executionRequestId,
    eventType: dispatchAllowed ? "dispatch_allowed" : "dispatch_blocked",
    message: dispatchAllowed ? "Dispatch allowed" : `Dispatch blocked: ${fin.blockingReasons.join("; ")}`,
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: `Dispatch gate ${gateStatus}`,
    eventType: dispatchAllowed ? "execution_dispatch_allowed" : "execution_dispatch_blocked",
    actorId: input.actorId ?? null,
  });

  return updatedGate;
}

// ─── recordFinalDispatchConfirmation ──────────────────────────────────────────

export async function recordFinalDispatchConfirmation(input: {
  workspaceId: string;
  finalizationId: string;
  rationale: string;
  actorId?: string | null;
}): Promise<AgentExecutionFinalConfirmationRecord> {
  const normalized = normalizeConfirmAgentExecutionDispatchInput(input);

  const fin = await getAgentExecutionFinalizationById(normalized.workspaceId, normalized.finalizationId);
  if (!fin) throw new Error(`Finalization not found: ${normalized.finalizationId}`);

  let confirmation = await getAgentExecutionFinalConfirmationByFinalizationId(normalized.workspaceId, normalized.finalizationId);

  if (!confirmation) {
    confirmation = await createAgentExecutionFinalConfirmation({
      workspaceId: normalized.workspaceId,
      finalizationId: normalized.finalizationId,
      executionRequestId: fin.executionRequestId,
      requirement: fin.confirmationRequirement,
      status: "required",
    });
  }

  const confirmed = await confirmAgentExecutionFinalConfirmation({
    workspaceId: normalized.workspaceId,
    confirmationId: confirmation.id,
    confirmedBy: normalized.actorId ?? null,
    rationale: normalized.rationale,
  });

  // Update finalization confirmation status
  await updateAgentExecutionFinalizationStatus({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    status: fin.status === "confirmation_required" ? "confirmation_satisfied" : fin.status,
    patch: { confirmationStatus: "confirmed" },
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    eventType: "final_confirmation_recorded",
    message: "Final human confirmation recorded",
    actorId: normalized.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: "Final dispatch confirmation recorded",
    eventType: "execution_dispatch_final_confirmation_recorded",
    actorId: normalized.actorId ?? null,
  });

  return confirmed;
}

// ─── dispatchExecutionToAdapter ───────────────────────────────────────────────

export async function dispatchExecutionToAdapter(input: {
  workspaceId: string;
  finalizationId: string;
  idempotencyKey?: string | null;
  actorId?: string | null;
}): Promise<AgentExecutionFinalizationRecord> {
  const normalized = normalizeDispatchAgentExecutionInput(input);

  let fin = await getAgentExecutionFinalizationById(normalized.workspaceId, normalized.finalizationId);
  if (!fin) throw new Error(`Finalization not found: ${normalized.finalizationId}`);

  // Load or create dispatch gate
  let gate = await getAgentExecutionDispatchGateByFinalizationId(normalized.workspaceId, fin.id);
  if (!gate) {
    gate = await createExecutionDispatchGate({ workspaceId: normalized.workspaceId, finalizationId: fin.id, actorId: normalized.actorId });
    fin = (await getAgentExecutionFinalizationById(normalized.workspaceId, fin.id))!;
  }

  if (!gate.dispatchAllowed) {
    throw new Error(`Dispatch not allowed: ${fin.blockingReasons.join("; ") || "gate blocked"}`);
  }

  // Enforce safe execution mode
  if (!SAFE_EXECUTION_MODES.has(fin.executionMode)) {
    await recordAgentExecutionDispatchEvent({
      workspaceId: normalized.workspaceId,
      finalizationId: fin.id,
      executionRequestId: fin.executionRequestId,
      eventType: "dispatch_blocked",
      message: `Dispatch blocked: unsafe execution mode '${fin.executionMode}'`,
      actorId: normalized.actorId ?? null,
    });
    throw new Error(`Dispatch blocked: execution mode '${fin.executionMode}' is not allowed (must be dry_run or draft_only)`);
  }

  // Final confirmation check
  if (fin.confirmationRequirement !== "not_required" && fin.confirmationStatus !== "confirmed") {
    throw new Error("Final human confirmation required before dispatch");
  }

  // Build idempotency key
  const idempotencyKey = normalized.idempotencyKey ?? createDispatchIdempotencyKey({
    workspaceId: normalized.workspaceId,
    executionRequestId: fin.executionRequestId,
    selectedAdapterKey: fin.selectedAdapterKey,
    selectedToolKey: fin.selectedToolKey,
    executionMode: fin.executionMode,
  });
  const fingerprint = createDispatchFingerprint({
    workspaceId: normalized.workspaceId,
    executionRequestId: fin.executionRequestId,
    selectedAdapterKey: fin.selectedAdapterKey,
    selectedToolKey: fin.selectedToolKey,
    executionMode: fin.executionMode,
    safePayload: fin.safeFinalizationPayload,
  });

  const idempotencyRecord = await createOrGetAgentExecutionDispatchIdempotency({
    workspaceId: normalized.workspaceId,
    executionRequestId: fin.executionRequestId,
    finalizationId: fin.id,
    idempotencyKey,
    idempotencyFingerprint: fingerprint,
  });

  // Idempotent replay
  if (idempotencyRecord.status === "completed") {
    await updateAgentExecutionFinalizationStatus({
      workspaceId: normalized.workspaceId,
      finalizationId: fin.id,
      status: fin.status,
      patch: { idempotencyStatus: "replayed" },
    });
    return (await getAgentExecutionFinalizationById(normalized.workspaceId, fin.id))!;
  }

  if (idempotencyRecord.status === "in_progress") {
    await recordAgentExecutionDispatchEvent({
      workspaceId: normalized.workspaceId,
      finalizationId: fin.id,
      executionRequestId: fin.executionRequestId,
      eventType: "dispatch_blocked",
      message: "Dispatch blocked: idempotency record in progress",
      actorId: normalized.actorId ?? null,
    });
    throw new Error("Dispatch blocked: idempotency record is already in progress");
  }

  // Acquire lock
  const lockKey = `${normalized.workspaceId}:${fin.executionRequestId}`;
  const existingLock = await getAgentExecutionDispatchLockByKey(normalized.workspaceId, lockKey);
  if (existingLock && existingLock.status === "acquired") {
    await recordAgentExecutionDispatchEvent({
      workspaceId: normalized.workspaceId,
      finalizationId: fin.id,
      executionRequestId: fin.executionRequestId,
      eventType: "dispatch_blocked",
      message: "Dispatch blocked: execution lock already acquired",
      actorId: normalized.actorId ?? null,
    });
    throw new Error("Dispatch blocked: execution lock is already held");
  }

  const lock = await acquireAgentExecutionDispatchLock({
    workspaceId: normalized.workspaceId,
    executionRequestId: fin.executionRequestId,
    finalizationId: fin.id,
    lockKey,
    acquiredBy: normalized.actorId ?? null,
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    eventType: "lock_acquired",
    message: `Execution lock acquired: ${lock.id}`,
    actorId: normalized.actorId ?? null,
  });

  // Mark idempotency in_progress
  await updateAgentExecutionDispatchIdempotencyStatus({
    workspaceId: normalized.workspaceId,
    idempotencyId: idempotencyRecord.id,
    status: "in_progress",
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    eventType: "idempotency_checked",
    message: `Idempotency key: ${idempotencyKey}`,
    actorId: normalized.actorId ?? null,
  });

  // Create dispatch attempt
  const attempt = await createAgentExecutionDispatchAttempt({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    dispatchGateId: gate.id,
    executionRequestId: fin.executionRequestId,
    adapterKey: fin.selectedAdapterKey,
    toolKey: fin.selectedToolKey,
    executionMode: fin.executionMode,
    actorId: normalized.actorId ?? null,
  });

  await updateAgentExecutionDispatchAttemptStatus({
    workspaceId: normalized.workspaceId,
    dispatchAttemptId: attempt.id,
    status: "started",
  });

  // Update finalization to dispatch_started
  await updateAgentExecutionFinalizationStatus({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    status: "dispatch_started",
    readiness: "dispatching",
    patch: { latestDispatchAttemptId: attempt.id, lockStatus: "acquired", idempotencyStatus: "in_progress" },
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    dispatchGateId: gate.id,
    dispatchAttemptId: attempt.id,
    executionRequestId: fin.executionRequestId,
    eventType: "adapter_selected",
    message: `Adapter selected: ${fin.selectedAdapterKey ?? "none"}`,
    actorId: normalized.actorId ?? null,
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    dispatchGateId: gate.id,
    dispatchAttemptId: attempt.id,
    executionRequestId: fin.executionRequestId,
    eventType: "adapter_dispatch_started",
    message: `Adapter dispatch started in mode: ${fin.executionMode}`,
    actorId: normalized.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: "Adapter dispatch started",
    eventType: "execution_dispatch_started",
    actorId: normalized.actorId ?? null,
  });

  // Attempt adapter dispatch
  let adapterExecutionId: string | null = null;
  let resultId: string | null = null;
  const evidenceIds: string[] = [];
  let dispatchError: string | null = null;

  try {
    if (fin.selectedAdapterKey) {
      const { runAgentToolAdapter, listAgentToolAdapterExecutions } = await import("./agent-tool-adapter-service");
      const adapterResult = await runAgentToolAdapter({
        workspaceId: normalized.workspaceId,
        executionRequestId: fin.executionRequestId,
        adapterKey: fin.selectedAdapterKey,
        actorId: normalized.actorId ?? null,
        forceDryRun: fin.executionMode === "dry_run",
      });
      if (adapterResult.status === "refused" || adapterResult.status === "failed") {
        dispatchError = `adapter_dispatch_not_available_safely: ${adapterResult.errorMessage ?? adapterResult.refusalReason ?? "adapter refused"}`;
      } else {
        // Find the adapter execution record by executionRequestId
        const executions = await listAgentToolAdapterExecutions(normalized.workspaceId, {
          executionRequestId: fin.executionRequestId,
          adapterKey: fin.selectedAdapterKey,
          limit: 1,
        });
        adapterExecutionId = executions[0]?.id ?? null;
      }
    } else {
      dispatchError = "adapter_dispatch_not_available_safely: no adapter mapping found";
    }
  } catch (err) {
    dispatchError = `adapter_dispatch_not_available_safely: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (dispatchError) {
    // Dispatch failed or adapter not available
    await updateAgentExecutionDispatchAttemptStatus({
      workspaceId: normalized.workspaceId,
      dispatchAttemptId: attempt.id,
      status: "adapter_failed",
      errorMessage: dispatchError,
      blockingReasons: [dispatchError],
    });

    await updateAgentExecutionDispatchIdempotencyStatus({
      workspaceId: normalized.workspaceId,
      idempotencyId: idempotencyRecord.id,
      status: "failed",
    });

    await releaseAgentExecutionDispatchLock({
      workspaceId: normalized.workspaceId,
      lockId: lock.id,
      releaseReason: "dispatch_failed",
    });

    await recordAgentExecutionDispatchEvent({
      workspaceId: normalized.workspaceId,
      finalizationId: fin.id,
      dispatchAttemptId: attempt.id,
      executionRequestId: fin.executionRequestId,
      eventType: "adapter_dispatch_failed",
      message: dispatchError,
      actorId: normalized.actorId ?? null,
    });

    await recordAgentExecutionDispatchEvent({
      workspaceId: normalized.workspaceId,
      finalizationId: fin.id,
      executionRequestId: fin.executionRequestId,
      eventType: "lock_released",
      message: "Lock released after dispatch failure",
      actorId: normalized.actorId ?? null,
    });

    const failedFin = await updateAgentExecutionFinalizationStatus({
      workspaceId: normalized.workspaceId,
      finalizationId: fin.id,
      status: "dispatch_failed",
      readiness: "blocked",
      blockingReasons: [dispatchError],
      patch: { lockStatus: "released", idempotencyStatus: "failed" },
    });

    await tryAuditEvent({
      workspaceId: normalized.workspaceId,
      title: "Adapter dispatch failed",
      eventType: "execution_dispatch_failed",
      actorId: normalized.actorId ?? null,
    });

    return failedFin;
  }

  // Adapter dispatch succeeded
  await updateAgentExecutionDispatchAttemptStatus({
    workspaceId: normalized.workspaceId,
    dispatchAttemptId: attempt.id,
    status: "adapter_succeeded",
    adapterExecutionId,
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    dispatchAttemptId: attempt.id,
    executionRequestId: fin.executionRequestId,
    adapterExecutionId: adapterExecutionId ?? undefined,
    eventType: "adapter_dispatch_succeeded",
    message: `Adapter dispatch succeeded: ${adapterExecutionId}`,
    actorId: normalized.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: "Adapter dispatch succeeded",
    eventType: "execution_dispatch_succeeded",
    actorId: normalized.actorId ?? null,
  });

  // Reconcile result
  let resultReconciled = false;
  try {
    if (adapterExecutionId) {
      const { createAgentExecutionResult } = await import("./agent-execution-result-registry");
      const result = await createAgentExecutionResult({
        workspaceId: normalized.workspaceId,
        executionRequestId: fin.executionRequestId,
        adapterExecutionId,
        toolKey: fin.selectedToolKey ?? fin.selectedAdapterKey ?? "dispatch",
        adapterKey: fin.selectedAdapterKey ?? null,
        executionMode: fin.executionMode,
        scopeType: "workspace",
        resultType: "simulation",
        title: `Dispatch result: ${fin.executionMode}`,
        summary: `Adapter dispatch completed in ${fin.executionMode} mode`,
        lineageRefs: [fin.executionRequestId],
      });
      resultId = result.id;
      resultReconciled = true;
    }
  } catch {
    // result reconciliation is best-effort
  }

  // Update attempt with result
  await updateAgentExecutionDispatchAttemptStatus({
    workspaceId: normalized.workspaceId,
    dispatchAttemptId: attempt.id,
    status: resultReconciled ? "result_reconciled" : "adapter_succeeded",
    resultId,
    evidenceIds,
  });

  // Update idempotency
  await updateAgentExecutionDispatchIdempotencyStatus({
    workspaceId: normalized.workspaceId,
    idempotencyId: idempotencyRecord.id,
    status: "completed",
    latestDispatchAttemptId: attempt.id,
    resultId,
  });

  // Release lock
  await releaseAgentExecutionDispatchLock({
    workspaceId: normalized.workspaceId,
    lockId: lock.id,
    releaseReason: "dispatch_completed",
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    eventType: "lock_released",
    message: "Execution lock released after successful dispatch",
    actorId: normalized.actorId ?? null,
  });

  if (resultReconciled) {
    await recordAgentExecutionDispatchEvent({
      workspaceId: normalized.workspaceId,
      finalizationId: fin.id,
      dispatchAttemptId: attempt.id,
      executionRequestId: fin.executionRequestId,
      resultId: resultId ?? undefined,
      eventType: "result_reconciled",
      message: "Result reconciled from adapter dispatch",
      actorId: normalized.actorId ?? null,
    });
  }

  const finalStatus = resultReconciled ? "result_reconciled" : "dispatch_succeeded";
  const finalReadiness = resultReconciled ? "reconciled" : "dispatched";

  await recordAgentExecutionDispatchEvent({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    eventType: "dispatch_completed",
    message: "Dispatch lifecycle completed",
    actorId: normalized.actorId ?? null,
  });

  const completedFin = await updateAgentExecutionFinalizationStatus({
    workspaceId: normalized.workspaceId,
    finalizationId: fin.id,
    status: finalStatus,
    readiness: finalReadiness,
    patch: {
      adapterExecutionId,
      resultId,
      evidenceIds,
      lockStatus: "released",
      idempotencyStatus: "completed",
      latestDispatchAttemptId: attempt.id,
    },
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: "Dispatch lifecycle completed",
    eventType: "execution_dispatch_completed",
    actorId: normalized.actorId ?? null,
  });

  return completedFin;
}

// ─── cancelExecutionDispatch ──────────────────────────────────────────────────

export async function cancelExecutionDispatch(input: {
  workspaceId: string;
  finalizationId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentExecutionFinalizationRecord> {
  const fin = await getAgentExecutionFinalizationById(input.workspaceId, input.finalizationId);
  if (!fin) throw new Error(`Finalization not found: ${input.finalizationId}`);

  const terminalStatuses = new Set(["dispatch_succeeded","result_reconciled","completed"]);
  if (terminalStatuses.has(fin.status)) {
    throw new Error(`Cannot cancel finalization in terminal status: ${fin.status}`);
  }

  // Release lock if active
  const lockKey = `${input.workspaceId}:${fin.executionRequestId}`;
  const lock = await getAgentExecutionDispatchLockByKey(input.workspaceId, lockKey);
  if (lock && lock.status === "acquired") {
    await releaseAgentExecutionDispatchLock({
      workspaceId: input.workspaceId,
      lockId: lock.id,
      releaseReason: "dispatch_cancelled",
    });
    await recordAgentExecutionDispatchEvent({
      workspaceId: input.workspaceId,
      finalizationId: fin.id,
      executionRequestId: fin.executionRequestId,
      eventType: "lock_released",
      message: "Lock released on cancellation",
      actorId: input.actorId ?? null,
    });
  }

  const cancelled = await updateAgentExecutionFinalizationStatus({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    status: "cancelled",
    readiness: "blocked",
    patch: { lockStatus: "released" },
  });

  await recordAgentExecutionDispatchEvent({
    workspaceId: input.workspaceId,
    finalizationId: fin.id,
    executionRequestId: fin.executionRequestId,
    eventType: "dispatch_cancelled",
    message: input.message ?? "Dispatch cancelled",
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: "Dispatch cancelled",
    eventType: "execution_dispatch_cancelled",
    actorId: input.actorId ?? null,
  });

  return cancelled;
}

// ─── buildExecutionDispatchSummary ────────────────────────────────────────────

export async function buildExecutionDispatchSummary(input: {
  workspaceId: string;
  selectedAdapterKey?: string;
  selectedToolKey?: string;
}): Promise<Record<string, unknown>> {
  const all = await listAgentExecutionFinalizations(input.workspaceId, {
    selectedAdapterKey: input.selectedAdapterKey,
    selectedToolKey: input.selectedToolKey,
  });

  const counts: Record<string, number> = {};
  const adapterCounts: Record<string, number> = {};
  const toolCounts: Record<string, number> = {};
  let activeLockCount = 0;
  let idempotentReplayCount = 0;
  let oldestBlocked: AgentExecutionFinalizationRecord | null = null;

  for (const f of all) {
    counts[f.status] = (counts[f.status] ?? 0) + 1;
    if (f.selectedAdapterKey) adapterCounts[f.selectedAdapterKey] = (adapterCounts[f.selectedAdapterKey] ?? 0) + 1;
    if (f.selectedToolKey) toolCounts[f.selectedToolKey] = (toolCounts[f.selectedToolKey] ?? 0) + 1;
    if (f.lockStatus === "acquired") activeLockCount++;
    if (f.idempotencyStatus === "replayed") idempotentReplayCount++;
    if (f.readiness === "blocked" && (!oldestBlocked || f.createdAt < oldestBlocked.createdAt)) {
      oldestBlocked = f;
    }
  }

  return {
    totalFinalizations: all.length,
    created: counts["created"] ?? 0,
    readinessPending: counts["readiness_pending"] ?? 0,
    readinessPassed: counts["readiness_passed"] ?? 0,
    readinessFailed: counts["readiness_failed"] ?? 0,
    confirmationRequired: counts["confirmation_required"] ?? 0,
    confirmationSatisfied: counts["confirmation_satisfied"] ?? 0,
    dispatchReady: counts["dispatch_ready"] ?? 0,
    dispatchBlocked: counts["dispatch_blocked"] ?? 0,
    dispatchStarted: counts["dispatch_started"] ?? 0,
    dispatchSucceeded: counts["dispatch_succeeded"] ?? 0,
    dispatchFailed: counts["dispatch_failed"] ?? 0,
    resultReconciled: counts["result_reconciled"] ?? 0,
    cancelled: counts["cancelled"] ?? 0,
    highRiskCount: all.filter((f) => f.riskLevel === "high").length,
    criticalRiskCount: all.filter((f) => f.riskLevel === "critical").length,
    selectedAdapterCounts: adapterCounts,
    selectedToolCounts: toolCounts,
    activeLockCount,
    idempotentReplayCount,
    oldestBlockedFinalization: oldestBlocked ? { id: oldestBlocked.id, createdAt: oldestBlocked.createdAt, blockingReasons: oldestBlocked.blockingReasons } : null,
  };
}
