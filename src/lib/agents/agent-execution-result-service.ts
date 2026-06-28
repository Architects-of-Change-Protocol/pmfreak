// ─── Agent Execution Results & Evidence Layer — Service ───────────────────────
// Does NOT call LLMs, external APIs, embeddings, or send communications.
// All operations are deterministic in-memory or in-store.

import {
  createAgentExecutionResult,
  getAgentExecutionResultById,
  createAgentExecutionEvidence,
  linkEvidenceToResult,
  recordAgentExecutionResultLineage,
  recordAgentExecutionResultEvent,
  updateAgentExecutionResultStatus,
  listAgentExecutionEvidence,
  _setResultRecord,
} from "./agent-execution-result-registry";
import {
  calculateExecutionConfidence,
} from "./agent-execution-result-validation";
import type {
  AgentExecutionResultRecord,
  AgentExecutionEvidenceRecord,
  AgentExecutionConfidenceResult,
  CreateAgentExecutionResultInput,
  CreateAgentExecutionEvidenceInput,
  AgentExecutionResultType,
  AgentExecutionResultArtifactType,
  AgentExecutionRetentionPolicy,
} from "./agent-execution-result-types";

// ─── Result Type Mapping ──────────────────────────────────────────────────────

function mapAdapterOutputTypeToResultType(
  outputType: string,
  status: string,
): AgentExecutionResultType {
  if (status === "refused") return "adapter_refusal";
  if (status === "failed" || status === "cancelled") return "adapter_failure";
  const map: Record<string, AgentExecutionResultType> = {
    noop: "noop",
    simulation: "simulation",
    draft_email: "draft_email",
    draft_task: "draft_task",
    draft_project_update: "draft_project_update",
    draft_report: "draft_report",
    structured_summary: "structured_summary",
    risk_analysis: "risk_analysis",
    recommendation: "recommendation",
    governance_note: "governance_note",
  };
  return map[outputType] ?? "noop";
}

function mapResultTypeToArtifactType(resultType: AgentExecutionResultType): AgentExecutionResultArtifactType {
  const map: Record<AgentExecutionResultType, AgentExecutionResultArtifactType> = {
    draft_email: "draft_email",
    draft_task: "draft_task",
    draft_project_update: "inline_json",
    draft_report: "draft_report",
    structured_summary: "markdown",
    risk_analysis: "risk_register_entry",
    recommendation: "governance_note",
    governance_note: "governance_note",
    noop: "inline_json",
    simulation: "inline_json",
    adapter_refusal: "governance_note",
    adapter_failure: "governance_note",
    execution_failure: "governance_note",
  };
  return map[resultType];
}

function mapResultTypeToRetentionPolicy(resultType: AgentExecutionResultType): AgentExecutionRetentionPolicy {
  if (resultType === "risk_analysis" || resultType === "governance_note" || resultType === "recommendation") {
    return "long_lived";
  }
  return "standard";
}

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
      sourceType: "agent_execution_results_evidence_layer" as never,
      scopeType: "workspace",
      title: args.title,
      actorId: args.actorId ?? null,
    });
  } catch {
    // audit is best-effort
  }
}

// ─── Public Service Functions ──────────────────────────────────────────────────

export async function createResultFromAdapterExecution(input: {
  workspaceId: string;
  executionRequestId: string;
  adapterExecutionId: string;
  actorId?: string | null;
}): Promise<AgentExecutionResultRecord> {
  // Load execution request
  const { getAgentExecutionRequestById } = await import("./agent-execution-registry");
  const execRequest = await getAgentExecutionRequestById(input.workspaceId, input.executionRequestId);
  if (!execRequest) {
    throw new Error(`Execution request not found: ${input.executionRequestId}`);
  }
  if (execRequest.workspaceId !== input.workspaceId) {
    throw new Error("Workspace mismatch on execution request");
  }

  // Load adapter execution
  const { getAgentToolAdapterExecutionById } = await import("./agent-tool-adapter-service");
  const adapterExec = await getAgentToolAdapterExecutionById(input.workspaceId, input.adapterExecutionId);
  if (!adapterExec) {
    throw new Error(`Adapter execution not found: ${input.adapterExecutionId}`);
  }
  if (adapterExec.workspaceId !== input.workspaceId) {
    throw new Error("Workspace mismatch on adapter execution");
  }

  const resultType = mapAdapterOutputTypeToResultType(adapterExec.outputType, adapterExec.executionStatus);
  const artifactType = mapResultTypeToArtifactType(resultType);
  const retentionPolicy = mapResultTypeToRetentionPolicy(resultType);
  const succeeded = adapterExec.executionStatus === "succeeded";

  const title = execRequest.title
    ? `Result: ${execRequest.title}`
    : `Result from ${adapterExec.adapterKey} adapter`;

  const summary = adapterExec.refusalReason
    ?? adapterExec.errorMessage
    ?? (succeeded ? `Adapter ${adapterExec.adapterKey} completed successfully` : null);

  // Create result
  const result = await createAgentExecutionResult({
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    adapterExecutionId: input.adapterExecutionId,
    agentId: execRequest.agentId,
    agentType: execRequest.agentType,
    toolKey: adapterExec.toolKey,
    adapterKey: adapterExec.adapterKey,
    executionMode: adapterExec.executionMode,
    scopeType: execRequest.scopeType ?? "workspace",
    scopeId: execRequest.scopeId ?? null,
    resultType,
    title,
    summary,
    resultPayload: adapterExec.outputPayload,
    artifactType,
    artifactMetadata: {
      adapterKey: adapterExec.adapterKey,
      toolKey: adapterExec.toolKey,
      executionMode: adapterExec.executionMode,
      executionStatus: adapterExec.executionStatus,
      completedAt: adapterExec.completedAt,
      warnings: adapterExec.warnings,
    },
    retentionPolicy,
    createdBy: input.actorId ?? null,
  });

  await recordAgentExecutionResultEvent({
    workspaceId: input.workspaceId,
    resultId: result.id,
    eventType: "result_created",
    message: `Result created from adapter execution ${input.adapterExecutionId}`,
    actorId: input.actorId ?? null,
  });

  // Create evidence items
  const evidenceItems: AgentExecutionEvidenceRecord[] = [];

  // 1. execution_request evidence
  const reqEvidence = await createAgentExecutionEvidence({
    workspaceId: input.workspaceId,
    resultId: result.id,
    executionRequestId: input.executionRequestId,
    evidenceType: "execution_request",
    evidenceSource: "agent_execution_runtime",
    scopeType: execRequest.scopeType ?? "workspace",
    scopeId: execRequest.scopeId ?? null,
    title: `Execution Request: ${execRequest.toolKey}`,
    summary: `Governed execution request ${input.executionRequestId}`,
    evidencePayload: { executionRequestId: input.executionRequestId, toolKey: execRequest.toolKey, executionMode: execRequest.executionMode, riskLevel: execRequest.riskLevel },
    evidenceRef: input.executionRequestId,
    confidenceWeight: 30,
    retentionPolicy,
    createdBy: input.actorId ?? null,
  });
  evidenceItems.push(reqEvidence);

  // 2. adapter_execution evidence
  const adapterEvidence = await createAgentExecutionEvidence({
    workspaceId: input.workspaceId,
    resultId: result.id,
    executionRequestId: input.executionRequestId,
    adapterExecutionId: input.adapterExecutionId,
    evidenceType: "adapter_execution",
    evidenceSource: "agent_tool_adapter_layer",
    title: `Adapter Execution: ${adapterExec.adapterKey}`,
    summary: `Adapter execution ${input.adapterExecutionId} status: ${adapterExec.executionStatus}`,
    evidencePayload: { adapterExecutionId: input.adapterExecutionId, adapterKey: adapterExec.adapterKey, executionStatus: adapterExec.executionStatus, outputType: adapterExec.outputType },
    evidenceRef: input.adapterExecutionId,
    confidenceWeight: 30,
    retentionPolicy,
    createdBy: input.actorId ?? null,
  });
  evidenceItems.push(adapterEvidence);

  // 3. output_snapshot evidence
  if (adapterExec.outputPayload) {
    const outEvidence = await createAgentExecutionEvidence({
      workspaceId: input.workspaceId,
      resultId: result.id,
      executionRequestId: input.executionRequestId,
      adapterExecutionId: input.adapterExecutionId,
      evidenceType: "output_snapshot",
      evidenceSource: "agent_tool_adapter_layer",
      title: `Output Snapshot: ${adapterExec.outputType}`,
      summary: `Adapter output of type ${adapterExec.outputType}`,
      evidencePayload: adapterExec.outputPayload,
      confidenceWeight: 20,
      retentionPolicy,
      createdBy: input.actorId ?? null,
    });
    evidenceItems.push(outEvidence);
  }

  // 4. scope_reference evidence if scope exists
  if (execRequest.scopeId) {
    const scopeEvidence = await createAgentExecutionEvidence({
      workspaceId: input.workspaceId,
      resultId: result.id,
      executionRequestId: input.executionRequestId,
      evidenceType: "scope_reference",
      evidenceSource: "agent_execution_runtime",
      scopeType: execRequest.scopeType ?? "workspace",
      scopeId: execRequest.scopeId,
      title: `Scope Reference: ${execRequest.scopeType} ${execRequest.scopeId}`,
      evidenceRef: execRequest.scopeId,
      confidenceWeight: 10,
      retentionPolicy,
      createdBy: input.actorId ?? null,
    });
    evidenceItems.push(scopeEvidence);
  }

  // 5. approval evidence if approvalRequestId exists
  if (execRequest.approvalRequestId) {
    const approvalEvidence = await createAgentExecutionEvidence({
      workspaceId: input.workspaceId,
      resultId: result.id,
      executionRequestId: input.executionRequestId,
      evidenceType: "approval",
      evidenceSource: "agent_approval",
      title: `Approval: ${execRequest.approvalRequestId}`,
      evidenceRef: execRequest.approvalRequestId,
      evidencePayload: { approvalRequestId: execRequest.approvalRequestId },
      confidenceWeight: 20,
      retentionPolicy,
      createdBy: input.actorId ?? null,
    });
    evidenceItems.push(approvalEvidence);
  }

  // 6. memory evidence
  if (Array.isArray(execRequest.memoryIds) && execRequest.memoryIds.length > 0) {
    for (const memId of execRequest.memoryIds) {
      const memEvidence = await createAgentExecutionEvidence({
        workspaceId: input.workspaceId,
        resultId: result.id,
        executionRequestId: input.executionRequestId,
        evidenceType: "memory",
        evidenceSource: "agent_memory_context",
        title: `Memory Reference: ${memId}`,
        evidenceRef: memId,
        confidenceWeight: 5,
        retentionPolicy,
        createdBy: input.actorId ?? null,
      });
      evidenceItems.push(memEvidence);
    }
  }

  // Record evidence_created events and link to result
  await recordAgentExecutionResultEvent({
    workspaceId: input.workspaceId,
    resultId: result.id,
    eventType: "evidence_created",
    message: `${evidenceItems.length} evidence items created`,
    eventPayload: { count: evidenceItems.length },
    actorId: input.actorId ?? null,
  });

  // Link evidence IDs to result
  let linked = result;
  for (const ev of evidenceItems) {
    linked = await linkEvidenceToResult({
      workspaceId: input.workspaceId,
      resultId: result.id,
      evidenceId: ev.id,
      actorId: input.actorId ?? null,
    });
  }

  // Record lineage
  await recordAgentExecutionResultLineage({ workspaceId: input.workspaceId, resultId: result.id, lineageType: "execution_request", lineageRef: input.executionRequestId });
  await recordAgentExecutionResultLineage({ workspaceId: input.workspaceId, resultId: result.id, lineageType: "adapter_execution", lineageRef: input.adapterExecutionId });
  for (const ev of evidenceItems) {
    await recordAgentExecutionResultLineage({ workspaceId: input.workspaceId, resultId: result.id, lineageType: "evidence", lineageRef: ev.id });
  }
  if (execRequest.scopeId) {
    await recordAgentExecutionResultLineage({ workspaceId: input.workspaceId, resultId: result.id, lineageType: "scope", lineageRef: execRequest.scopeId });
  }

  await recordAgentExecutionResultEvent({
    workspaceId: input.workspaceId,
    resultId: result.id,
    eventType: "lineage_recorded",
    message: "Lineage recorded",
    actorId: input.actorId ?? null,
  });

  // Calculate confidence
  const confidence = calculateExecutionConfidence({
    executionRequestExists: true,
    adapterExecutionExists: true,
    adapterSucceeded: succeeded,
    approvalPresent: !!execRequest.approvalRequestId,
    requiredApprovalSatisfied: !!execRequest.approvalRequestId && !!execRequest.approvedBy,
    inputSnapshotPresent: !!(adapterExec as Record<string, unknown>).inputSnapshot,
    outputPayloadPresent: !!adapterExec.outputPayload,
    evidenceCount: evidenceItems.length,
    auditTrailPresent: true,
    scopeKnown: !!execRequest.scopeType,
    hasErrors: !!(adapterExec.errorCode || adapterExec.errorMessage),
    hasRefusal: adapterExec.executionStatus === "refused",
  });

  // Update result with confidence and evidence IDs
  const now = new Date().toISOString();
  const finalResult = await getAgentExecutionResultById(input.workspaceId, result.id);
  if (finalResult) {
    // Directly mutate store via registry update
    const updated: AgentExecutionResultRecord = {
      ...finalResult,
      confidenceScore: confidence.confidenceScore,
      confidenceLevel: confidence.confidenceLevel,
      confidenceReasons: confidence.confidenceReasons,
      reviewState: succeeded && evidenceItems.length >= 2 ? "ready" : "not_ready",
      updatedAt: now,
    };
    _setResultRecord(result.id, updated);

    await recordAgentExecutionResultEvent({
      workspaceId: input.workspaceId,
      resultId: result.id,
      eventType: "confidence_calculated",
      message: `Confidence: ${confidence.confidenceScore} (${confidence.confidenceLevel})`,
      eventPayload: { ...confidence },
      actorId: input.actorId ?? null,
    });

    if (updated.reviewState === "ready") {
      await recordAgentExecutionResultEvent({
        workspaceId: input.workspaceId,
        resultId: result.id,
        eventType: "result_ready_for_review",
        message: "Result is ready for review",
        actorId: input.actorId ?? null,
      });
    }

    await tryAuditEvent({ workspaceId: input.workspaceId, title: `Result created: ${updated.title}`, eventType: "result_created", actorId: input.actorId });

    return updated;
  }

  return linked;
}

export async function createResultFromPayload(input: CreateAgentExecutionResultInput): Promise<AgentExecutionResultRecord> {
  const result = await createAgentExecutionResult(input);
  await recordAgentExecutionResultEvent({
    workspaceId: input.workspaceId,
    resultId: result.id,
    eventType: "result_created",
    message: "Result created from payload",
    actorId: input.createdBy ?? null,
  });
  await tryAuditEvent({ workspaceId: input.workspaceId, title: `Result created: ${result.title}`, eventType: "result_created", actorId: input.createdBy });
  return result;
}

export async function createEvidenceForExecutionResult(input: CreateAgentExecutionEvidenceInput): Promise<AgentExecutionEvidenceRecord> {
  const evidence = await createAgentExecutionEvidence(input);
  await recordAgentExecutionResultEvent({
    workspaceId: input.workspaceId,
    resultId: input.resultId ?? null,
    evidenceId: evidence.id,
    eventType: "evidence_created",
    message: `Evidence created: ${evidence.title}`,
    actorId: input.createdBy ?? null,
  });
  return evidence;
}

export async function calculateResultConfidence(input: {
  workspaceId: string;
  resultId: string;
}): Promise<AgentExecutionConfidenceResult> {
  const result = await getAgentExecutionResultById(input.workspaceId, input.resultId);
  if (!result) throw new Error(`Result not found: ${input.resultId}`);

  const evidenceItems = await listAgentExecutionEvidence({ workspaceId: input.workspaceId, resultId: input.resultId });

  const adapterSucceeded = result.resultType !== "adapter_refusal" && result.resultType !== "adapter_failure" && result.resultType !== "execution_failure";
  const hasRefusal = result.resultType === "adapter_refusal";
  const hasErrors = result.resultType === "adapter_failure" || result.resultType === "execution_failure";

  const hasApprovalEvidence = evidenceItems.some(e => e.evidenceType === "approval");
  const hasOutputEvidence = evidenceItems.some(e => e.evidenceType === "output_snapshot");
  const hasInputEvidence = evidenceItems.some(e => e.evidenceType === "input_snapshot");

  return calculateExecutionConfidence({
    executionRequestExists: !!result.executionRequestId,
    adapterExecutionExists: !!result.adapterExecutionId,
    adapterSucceeded,
    approvalPresent: hasApprovalEvidence,
    requiredApprovalSatisfied: hasApprovalEvidence,
    inputSnapshotPresent: hasInputEvidence,
    outputPayloadPresent: hasOutputEvidence || !!result.resultPayload,
    evidenceCount: evidenceItems.length,
    auditTrailPresent: true,
    scopeKnown: !!result.scopeType,
    hasErrors,
    hasRefusal,
  });
}

export async function markResultReadyForReview(input: {
  workspaceId: string;
  resultId: string;
  actorId?: string | null;
}): Promise<AgentExecutionResultRecord> {
  const result = await updateAgentExecutionResultStatus({
    workspaceId: input.workspaceId,
    resultId: input.resultId,
    resultStatus: "ready_for_review",
    reviewState: "ready",
    actorId: input.actorId ?? null,
    message: "Marked ready for review",
  });
  await tryAuditEvent({ workspaceId: input.workspaceId, title: `Result ready for review: ${result.title}`, eventType: "result_ready_for_review", actorId: input.actorId });
  return result;
}

export async function archiveExecutionResult(input: {
  workspaceId: string;
  resultId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentExecutionResultRecord> {
  const result = await updateAgentExecutionResultStatus({
    workspaceId: input.workspaceId,
    resultId: input.resultId,
    resultStatus: "archived",
    reviewState: "reviewed",
    actorId: input.actorId ?? null,
    message: input.message ?? "Archived",
  });
  await tryAuditEvent({ workspaceId: input.workspaceId, title: `Result archived: ${result.title}`, eventType: "result_archived", actorId: input.actorId });
  return result;
}

export async function supersedeExecutionResult(input: {
  workspaceId: string;
  resultId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentExecutionResultRecord> {
  const result = await updateAgentExecutionResultStatus({
    workspaceId: input.workspaceId,
    resultId: input.resultId,
    resultStatus: "superseded",
    actorId: input.actorId ?? null,
    message: input.message ?? "Superseded",
  });
  await tryAuditEvent({ workspaceId: input.workspaceId, title: `Result superseded: ${result.title}`, eventType: "result_superseded", actorId: input.actorId });
  return result;
}

export async function buildExecutionResultExportMetadata(input: {
  workspaceId: string;
  resultId: string;
}): Promise<Record<string, unknown>> {
  const result = await getAgentExecutionResultById(input.workspaceId, input.resultId);
  if (!result) throw new Error(`Result not found: ${input.resultId}`);

  const evidence = await listAgentExecutionEvidence({ workspaceId: input.workspaceId, resultId: input.resultId });
  const confidence = await calculateResultConfidence({ workspaceId: input.workspaceId, resultId: input.resultId });

  await recordAgentExecutionResultEvent({
    workspaceId: input.workspaceId,
    resultId: input.resultId,
    eventType: "result_export_metadata_created",
    message: "Export metadata built",
  });

  return {
    exportGeneratedAt: new Date().toISOString(),
    resultId: result.id,
    workspaceId: result.workspaceId,
    resultType: result.resultType,
    resultStatus: result.resultStatus,
    reviewState: result.reviewState,
    title: result.title,
    summary: result.summary,
    toolKey: result.toolKey,
    adapterKey: result.adapterKey,
    executionMode: result.executionMode,
    scopeType: result.scopeType,
    scopeId: result.scopeId,
    artifactType: result.artifactType,
    confidenceScore: confidence.confidenceScore,
    confidenceLevel: confidence.confidenceLevel,
    confidenceReasons: confidence.confidenceReasons,
    evidenceCount: evidence.length,
    evidenceIds: result.evidenceIds,
    lineageRefs: result.lineageRefs,
    retentionPolicy: result.retentionPolicy,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    safeResultPayload: result.safeResultPayload,
  };
}
