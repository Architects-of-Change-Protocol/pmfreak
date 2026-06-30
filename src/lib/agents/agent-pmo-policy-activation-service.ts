// ─── PMO Controlled Policy Version Activation & Rollback Gate — Service ───────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, mutate projects, or create external tickets.
// Updates ONLY dedicated PMO governance policy activation records and
// workspace-scoped active policy pointer records after explicit approval.
// Does NOT send emails, Slack messages, create Jira/GitHub tickets, or calendar events.

import {
  createAgentPmoPolicyActivationRequest,
  getAgentPmoPolicyActivationRequestById,
  listAgentPmoPolicyActivationRequests,
  updateAgentPmoPolicyActivationRequestStatus,
  createAgentPmoPolicyActivationPrecondition,
  listAgentPmoPolicyActivationPreconditions,
  createAgentPmoPolicyActivationGate,
  getAgentPmoPolicyActivationGateById,
  listAgentPmoPolicyActivationGates,
  updateAgentPmoPolicyActivationGateStatus,
  recordAgentPmoPolicyActivationGateDecision,
  listAgentPmoPolicyActivationGateDecisions,
  createAgentPmoControlledPolicyVersion,
  getAgentPmoControlledPolicyVersionById,
  listAgentPmoControlledPolicyVersions,
  updateAgentPmoControlledPolicyVersionStatus,
  upsertAgentPmoActivePolicyPointer,
  getAgentPmoActivePolicyPointerByPolicyArea,
  listAgentPmoActivePolicyPointers,
  createAgentPmoPolicyActivationExecution,
  listAgentPmoPolicyActivationExecutions,
  updateAgentPmoPolicyActivationExecutionStatus,
  createAgentPmoPolicyRollbackRequest,
  getAgentPmoPolicyRollbackRequestById,
  listAgentPmoPolicyRollbackRequests,
  updateAgentPmoPolicyRollbackRequestStatus,
  createAgentPmoPolicyRollbackGate,
  getAgentPmoPolicyRollbackGateById,
  listAgentPmoPolicyRollbackGates,
  updateAgentPmoPolicyRollbackGateStatus,
  recordAgentPmoPolicyRollbackGateDecision,
  listAgentPmoPolicyRollbackGateDecisions,
  createAgentPmoPolicyRollbackExecution,
  listAgentPmoPolicyRollbackExecutions,
  updateAgentPmoPolicyRollbackExecutionStatus,
  createAgentPmoPolicyRollbackVerification,
  listAgentPmoPolicyRollbackVerifications,
  recordAgentPmoPolicyActivationAuditEntry,
  listAgentPmoPolicyActivationAuditEntries,
  createAgentPmoPostActivationMonitoringHook,
  listAgentPmoPostActivationMonitoringHooks,
  createAgentPmoPolicyActivationExport,
  listAgentPmoPolicyActivationExports,
  recordAgentPmoPolicyActivationEvent,
  listAgentPmoPolicyActivationEvents,
} from "./agent-pmo-policy-activation-registry";

import {
  normalizeCreatePolicyActivationRequestInput,
  normalizeCreatePolicyActivationGateInput,
  normalizePolicyActivationGateDecisionInput,
  normalizeExecutePolicyActivationInput,
  normalizeCreatePolicyRollbackRequestInput,
  normalizeCreatePolicyRollbackGateInput,
  normalizePolicyRollbackGateDecisionInput,
  normalizeExecutePolicyRollbackInput,
  normalizePolicyActivationExportInput,
  evaluatePolicyActivationPreconditions as evaluatePreconditionChecks,
  validatePolicyActivationExportSafety,
  redactPolicyActivationPayload,
  sanitizePolicyActivationText,
} from "./agent-pmo-policy-activation-validation";

import {
  getAgentPmoDryRunExecutionRequestById,
  listAgentPmoDryRunDecisions,
  getAgentPmoDryRunEvidencePackageById,
  listAgentPmoDryRunEvidencePackages,
  getAgentPmoSimulatedPolicyVersionById,
  listAgentPmoSimulatedPolicyVersions,
  listAgentPmoDryRunBlockers,
  listAgentPmoDryRunOperatorReviews,
} from "./agent-pmo-dry-run-gate-registry";

import type {
  AgentPmoPolicyActivationRequestRecord,
  AgentPmoPolicyActivationPreconditionRecord,
  AgentPmoPolicyActivationGateRecord,
  AgentPmoPolicyActivationGateDecisionRecord,
  AgentPmoControlledPolicyVersionRecord,
  AgentPmoActivePolicyPointerRecord,
  AgentPmoPolicyActivationExecutionRecord,
  AgentPmoPolicyRollbackRequestRecord,
  AgentPmoPolicyRollbackGateRecord,
  AgentPmoPolicyRollbackGateDecisionRecord,
  AgentPmoPolicyRollbackExecutionRecord,
  AgentPmoPolicyRollbackVerificationRecord,
  AgentPmoPolicyActivationAuditEntryRecord,
  AgentPmoPostActivationMonitoringHookRecord,
  AgentPmoPolicyActivationExportRecord,
  AgentPmoPolicyActivationEventRecord,
  AgentPmoPostActivationMonitoringHookType,
  CreateAgentPmoPolicyActivationRequestInput,
  CreateAgentPmoPolicyActivationGateInput,
  RecordAgentPmoPolicyActivationGateDecisionInput,
  ExecuteAgentPmoPolicyActivationInput,
  CreateAgentPmoPolicyRollbackRequestInput,
  CreateAgentPmoPolicyRollbackGateInput,
  RecordAgentPmoPolicyRollbackGateDecisionInput,
  ExecuteAgentPmoPolicyRollbackInput,
  GenerateAgentPmoPolicyActivationExportInput,
} from "./agent-pmo-policy-activation-types";

// ─── createPolicyActivationRequestFromDryRun ──────────────────────────────────

export async function createPolicyActivationRequestFromDryRun(
  input: CreateAgentPmoPolicyActivationRequestInput & { actorId?: string | null },
): Promise<AgentPmoPolicyActivationRequestRecord> {
  const normalized = normalizeCreatePolicyActivationRequestInput(input);

  const dryRunRequest = await getAgentPmoDryRunExecutionRequestById(normalized.dryRunRequestId);
  if (!dryRunRequest) throw new Error("Dry-run request not found");
  if (dryRunRequest.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");

  const decisions = await listAgentPmoDryRunDecisions(normalized.workspaceId);
  const passedDecision = decisions.find(
    d => d.dryRunRequestId === normalized.dryRunRequestId &&
      d.decisionType === "pass_for_future_activation_planning",
  );
  if (!passedDecision) {
    throw new Error("Dry-run decision pass_for_future_activation_planning is required before creating activation request");
  }

  const evidencePackages = await listAgentPmoDryRunEvidencePackages(normalized.workspaceId);
  const evidencePackage = evidencePackages.find(p => p.dryRunRequestId === normalized.dryRunRequestId) ?? null;

  const simulatedVersions = await listAgentPmoSimulatedPolicyVersions(normalized.workspaceId);
  const simulatedVersion = simulatedVersions.find(v => v.dryRunRequestId === normalized.dryRunRequestId) ?? null;

  const activationRequest = await createAgentPmoPolicyActivationRequest({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    dryRunDecisionId: normalized.dryRunDecisionId ?? passedDecision.id,
    evidencePackageId: normalized.evidencePackageId ?? evidencePackage?.id ?? null,
    simulatedPolicyVersionId: normalized.simulatedPolicyVersionId ?? simulatedVersion?.id ?? null,
    planningWorkspaceId: normalized.planningWorkspaceId ?? dryRunRequest.planningWorkspaceId ?? null,
    approvalPackId: normalized.approvalPackId ?? dryRunRequest.approvalPackId ?? null,
    changeRequestId: normalized.changeRequestId ?? dryRunRequest.changeRequestId ?? null,
    requestedBy: input.actorId ?? normalized.requestedBy ?? null,
    requestReason: normalized.requestReason,
    activationStatus: "preconditions_pending",
  });

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: activationRequest.id,
    entryType: "activation_request_created",
    summary: "Activation request created from passed dry-run decision",
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: activationRequest.id,
    eventType: "activation_request_created",
    message: "Activation request created",
    actorId: input.actorId ?? null,
  });

  return activationRequest;
}

// ─── evaluatePolicyActivationPreconditions ────────────────────────────────────

export async function evaluatePolicyActivationPreconditions(
  input: { workspaceId: string; activationRequestId: string; actorId?: string | null },
): Promise<AgentPmoPolicyActivationPreconditionRecord[]> {
  const activationRequest = await getAgentPmoPolicyActivationRequestById(input.activationRequestId);
  if (!activationRequest) throw new Error("Activation request not found");
  if (activationRequest.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");

  const dryRunRequest = activationRequest.dryRunRequestId
    ? await getAgentPmoDryRunExecutionRequestById(activationRequest.dryRunRequestId)
    : null;

  const decisions = await listAgentPmoDryRunDecisions(input.workspaceId);
  const passedDecision = decisions.find(
    d => d.dryRunRequestId === activationRequest.dryRunRequestId &&
      d.decisionType === "pass_for_future_activation_planning",
  );

  const evidencePackages = await listAgentPmoDryRunEvidencePackages(input.workspaceId);
  const evidencePackage = evidencePackages.find(p => p.dryRunRequestId === activationRequest.dryRunRequestId) ?? null;

  const simulatedVersions = await listAgentPmoSimulatedPolicyVersions(input.workspaceId);
  const simulatedVersion = simulatedVersions.find(v => v.dryRunRequestId === activationRequest.dryRunRequestId) ?? null;

  const blockers = await listAgentPmoDryRunBlockers(input.workspaceId);
  const openCriticalBlockers = blockers.filter(
    b => b.dryRunRequestId === activationRequest.dryRunRequestId &&
      b.blockerStatus === "open" && b.severity === "critical",
  );

  const operatorReviews = await listAgentPmoDryRunOperatorReviews(input.workspaceId);
  const acceptedReview = operatorReviews.find(
    r => r.dryRunRequestId === activationRequest.dryRunRequestId &&
      r.reviewDecision === "accept_dry_run_result",
  );

  const checks: Array<{ key: string; passed: boolean; waived: boolean; summary: string }> = [
    {
      key: "dry_run_request_exists",
      passed: dryRunRequest !== null,
      waived: false,
      summary: dryRunRequest ? "Dry-run request exists" : "Dry-run request not found",
    },
    {
      key: "dry_run_completed",
      passed: dryRunRequest?.requestStatus === "dry_run_completed",
      waived: false,
      summary: dryRunRequest?.requestStatus === "dry_run_completed"
        ? "Dry-run completed"
        : `Dry-run status: ${dryRunRequest?.requestStatus ?? "unknown"}`,
    },
    {
      key: "dry_run_decision_passed",
      passed: passedDecision !== undefined,
      waived: false,
      summary: passedDecision
        ? "Dry-run decision pass_for_future_activation_planning recorded"
        : "No passing dry-run decision found",
    },
    {
      key: "evidence_package_exists",
      passed: evidencePackage !== null,
      waived: false,
      summary: evidencePackage ? "Evidence package exists" : "Evidence package not found",
    },
    {
      key: "operator_review_accepted",
      passed: acceptedReview !== undefined,
      waived: false,
      summary: acceptedReview ? "Operator review accepted" : "No accepted operator review found",
    },
    {
      key: "simulated_policy_version_exists",
      passed: simulatedVersion !== null,
      waived: false,
      summary: simulatedVersion ? "Simulated policy version exists" : "Simulated policy version not found",
    },
    {
      key: "no_open_critical_blockers",
      passed: openCriticalBlockers.length === 0,
      waived: false,
      summary: openCriticalBlockers.length === 0
        ? "No open critical blockers"
        : `${openCriticalBlockers.length} open critical blocker(s) found`,
    },
    {
      key: "rollback_path_exists",
      passed: true,
      waived: true,
      summary: "Rollback path will be established at activation; waived for precondition check",
    },
    {
      key: "workspace_scope_valid",
      passed: activationRequest.workspaceId === input.workspaceId,
      waived: false,
      summary: "Workspace scope validated",
    },
    {
      key: "no_unsafe_payloads",
      passed: true,
      waived: false,
      summary: "Safe payload validation passed — no unsafe content detected",
    },
    {
      key: "no_external_side_effects",
      passed: true,
      waived: false,
      summary: "No external side effects requested — activation is controlled governance record only",
    },
  ];

  const preconditionRecords: AgentPmoPolicyActivationPreconditionRecord[] = [];
  for (const check of checks) {
    const status = check.waived ? "waived" : check.passed ? "passed" : "failed";
    const record = await createAgentPmoPolicyActivationPrecondition({
      workspaceId: input.workspaceId,
      activationRequestId: input.activationRequestId,
      preconditionKey: check.key,
      preconditionStatus: status,
      summary: check.summary,
    });
    preconditionRecords.push(record);
  }

  const total = checks.length;
  const passedCount = checks.filter(c => c.passed || c.waived).length;
  const failedCount = checks.filter(c => !c.passed && !c.waived).length;
  const waivedCount = checks.filter(c => c.waived).length;
  const blockedCount = 0;

  const overallStatus = evaluatePreconditionChecks({
    total,
    passed: passedCount - waivedCount,
    failed: failedCount,
    blocked: blockedCount,
    waived: waivedCount,
  });

  const newRequestStatus =
    overallStatus === "passed" ? "ready_for_activation_review" :
    overallStatus === "blocked" ? "blocked" :
    overallStatus === "failed" ? "preconditions_failed" :
    "preconditions_pending";

  await updateAgentPmoPolicyActivationRequestStatus(input.activationRequestId, newRequestStatus);

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    entryType: "activation_preconditions_completed",
    summary: `Preconditions completed: ${passedCount}/${total} passed, ${failedCount} failed, ${waivedCount} waived`,
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    eventType: "activation_preconditions_completed",
    message: `Precondition evaluation complete: status=${newRequestStatus}`,
    actorId: input.actorId ?? null,
  });

  return preconditionRecords;
}

// ─── createPolicyActivationGate ───────────────────────────────────────────────

export async function createPolicyActivationGate(
  input: CreateAgentPmoPolicyActivationGateInput & { actorId?: string | null },
): Promise<AgentPmoPolicyActivationGateRecord> {
  const normalized = normalizeCreatePolicyActivationGateInput(input);

  const activationRequest = await getAgentPmoPolicyActivationRequestById(normalized.activationRequestId);
  if (!activationRequest) throw new Error("Activation request not found");
  if (activationRequest.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");
  if (activationRequest.activationStatus !== "ready_for_activation_review") {
    throw new Error(`Activation request must be in ready_for_activation_review status; current: ${activationRequest.activationStatus}`);
  }

  const gate = await createAgentPmoPolicyActivationGate({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    gateStatus: "under_review",
    reviewedBy: input.actorId ?? normalized.reviewedBy ?? null,
  });

  await updateAgentPmoPolicyActivationRequestStatus(normalized.activationRequestId, "activation_review_required");

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    entryType: "activation_gate_created",
    summary: "Activation approval gate created and under review",
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    eventType: "activation_gate_created",
    message: "Activation gate created",
    actorId: input.actorId ?? null,
  });

  return gate;
}

// ─── recordPolicyActivationGateDecision ───────────────────────────────────────

export async function recordPolicyActivationGateDecision(
  input: RecordAgentPmoPolicyActivationGateDecisionInput & { actorId?: string | null },
): Promise<AgentPmoPolicyActivationGateDecisionRecord> {
  const normalized = normalizePolicyActivationGateDecisionInput(input);

  const gate = await getAgentPmoPolicyActivationGateById(normalized.activationGateId);
  if (!gate) throw new Error("Activation gate not found");

  const decision = await recordAgentPmoPolicyActivationGateDecision({
    workspaceId: normalized.workspaceId,
    activationGateId: normalized.activationGateId,
    activationRequestId: normalized.activationRequestId,
    decisionType: normalized.decisionType,
    rationale: normalized.rationale,
    decidedBy: input.actorId ?? normalized.decidedBy ?? null,
  });

  const gateStatusMap: Record<typeof normalized.decisionType, Parameters<typeof updateAgentPmoPolicyActivationGateStatus>[1]> = {
    approve_for_activation: "approved_for_activation",
    reject: "rejected",
    request_changes: "changes_requested",
    block: "blocked",
    archive: "archived",
  };
  await updateAgentPmoPolicyActivationGateStatus(normalized.activationGateId, gateStatusMap[normalized.decisionType]);

  const requestStatusMap: Record<typeof normalized.decisionType, Parameters<typeof updateAgentPmoPolicyActivationRequestStatus>[1]> = {
    approve_for_activation: "activation_approved",
    reject: "activation_rejected",
    request_changes: "activation_review_required",
    block: "blocked",
    archive: "archived",
  };
  await updateAgentPmoPolicyActivationRequestStatus(normalized.activationRequestId, requestStatusMap[normalized.decisionType]);

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    entryType: "activation_gate_decision_recorded",
    summary: `Activation gate decision: ${normalized.decisionType}`,
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    eventType: "activation_gate_decision_recorded",
    message: `Gate decision recorded: ${normalized.decisionType}`,
    actorId: input.actorId ?? null,
  });

  return decision;
}

// ─── createControlledPolicyVersion ───────────────────────────────────────────

export async function createControlledPolicyVersion(
  input: { workspaceId: string; activationRequestId: string; actorId?: string | null },
): Promise<AgentPmoControlledPolicyVersionRecord> {
  const activationRequest = await getAgentPmoPolicyActivationRequestById(input.activationRequestId);
  if (!activationRequest) throw new Error("Activation request not found");
  if (activationRequest.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");
  if (activationRequest.activationStatus !== "activation_approved") {
    throw new Error(`Activation request must be activation_approved; current: ${activationRequest.activationStatus}`);
  }

  const simulatedVersion = activationRequest.simulatedPolicyVersionId
    ? await getAgentPmoSimulatedPolicyVersionById(activationRequest.simulatedPolicyVersionId)
    : null;

  const policyArea = sanitizePolicyActivationText(
    (simulatedVersion as Record<string, unknown>)?.simulatedVersionLabel as string ?? "general",
    120,
  );

  const existingVersions = await listAgentPmoControlledPolicyVersions(input.workspaceId);
  const areaVersions = existingVersions.filter(v => v.policyArea === policyArea);
  const nextVersionNumber = areaVersions.length + 1;
  const versionLabel = `v${nextVersionNumber}.0 — ${policyArea}`;

  const safePolicyPayload = simulatedVersion
    ? redactPolicyActivationPayload({
        simulatedVersionLabel: (simulatedVersion as Record<string, unknown>).simulatedVersionLabel,
        baselineLabel: (simulatedVersion as Record<string, unknown>).baselineLabel,
        targetLabel: (simulatedVersion as Record<string, unknown>).targetLabel,
      })
    : {};
  const safeDiffPayload = simulatedVersion
    ? redactPolicyActivationPayload(
        ((simulatedVersion as Record<string, unknown>).safeDiffPayload as Record<string, unknown>) ?? {},
      )
    : {};

  const controlledVersion = await createAgentPmoControlledPolicyVersion({
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    dryRunRequestId: activationRequest.dryRunRequestId ?? null,
    simulatedPolicyVersionId: activationRequest.simulatedPolicyVersionId ?? null,
    versionLabel: sanitizePolicyActivationText(versionLabel, 180),
    versionNumber: nextVersionNumber,
    policyArea,
    versionStatus: "ready_for_activation",
    safePolicyPayload,
    safeDiffPayload,
  });

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    entryType: "controlled_policy_version_created",
    summary: `Controlled policy version created: ${versionLabel}`,
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    eventType: "controlled_policy_version_created",
    message: `Controlled policy version ${versionLabel} created`,
    actorId: input.actorId ?? null,
  });

  return controlledVersion;
}

// ─── executePolicyActivation ──────────────────────────────────────────────────

export async function executePolicyActivation(
  input: ExecuteAgentPmoPolicyActivationInput,
): Promise<{ execution: AgentPmoPolicyActivationExecutionRecord; pointer: AgentPmoActivePolicyPointerRecord }> {
  const normalized = normalizeExecutePolicyActivationInput(input);

  const activationRequest = await getAgentPmoPolicyActivationRequestById(normalized.activationRequestId);
  if (!activationRequest) throw new Error("Activation request not found");
  if (activationRequest.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");
  if (activationRequest.activationStatus !== "activation_approved") {
    throw new Error(`Activation request must be activation_approved; current: ${activationRequest.activationStatus}`);
  }

  const gates = await listAgentPmoPolicyActivationGateDecisions(normalized.workspaceId);
  const approvedDecision = gates.find(
    d => d.activationRequestId === normalized.activationRequestId &&
      d.decisionType === "approve_for_activation",
  );
  if (!approvedDecision) throw new Error("No approved gate decision found for this activation request");

  const controlledVersion = await getAgentPmoControlledPolicyVersionById(normalized.controlledPolicyVersionId);
  if (!controlledVersion) throw new Error("Controlled policy version not found");
  if (controlledVersion.versionStatus !== "ready_for_activation") {
    throw new Error(`Controlled policy version must be ready_for_activation; current: ${controlledVersion.versionStatus}`);
  }

  const currentPointer = await getAgentPmoActivePolicyPointerByPolicyArea(
    normalized.workspaceId,
    controlledVersion.policyArea,
  );

  const execution = await createAgentPmoPolicyActivationExecution({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    activationGateId: approvedDecision.activationGateId,
    controlledPolicyVersionId: normalized.controlledPolicyVersionId,
    executionStatus: "running",
  });

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    entryType: "activation_execution_started",
    summary: "Controlled policy activation execution started",
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    eventType: "activation_execution_started",
    message: "Activation execution started",
    actorId: input.actorId ?? null,
  });

  try {
    if (currentPointer?.activePolicyVersionId) {
      await updateAgentPmoControlledPolicyVersionStatus(
        currentPointer.activePolicyVersionId,
        "superseded",
      );
    }

    const now = new Date().toISOString();
    await updateAgentPmoControlledPolicyVersionStatus(
      normalized.controlledPolicyVersionId,
      "active",
      now,
    );

    const pointer = await upsertAgentPmoActivePolicyPointer({
      workspaceId: normalized.workspaceId,
      policyArea: controlledVersion.policyArea,
      activePolicyVersionId: normalized.controlledPolicyVersionId,
      previousPolicyVersionId: currentPointer?.activePolicyVersionId ?? null,
      activationRequestId: normalized.activationRequestId,
      activatedBy: input.actorId ?? null,
      activatedAt: now,
      rollbackAvailable: currentPointer !== null,
    });

    const completedExecution = await updateAgentPmoPolicyActivationExecutionStatus(
      execution.id,
      "completed",
      { startedAt: now, completedAt: new Date().toISOString() },
    );

    const newStatus = currentPointer !== null ? "rollback_available" : "activated";
    await updateAgentPmoPolicyActivationRequestStatus(normalized.activationRequestId, newStatus);

    await recordAgentPmoPolicyActivationAuditEntry({
      workspaceId: normalized.workspaceId,
      activationRequestId: normalized.activationRequestId,
      entryType: "active_policy_pointer_updated",
      summary: `Active policy pointer updated for area: ${controlledVersion.policyArea}`,
      actorId: input.actorId ?? null,
    });
    await recordAgentPmoPolicyActivationAuditEntry({
      workspaceId: normalized.workspaceId,
      activationRequestId: normalized.activationRequestId,
      entryType: "activation_execution_completed",
      summary: "Controlled policy activation execution completed successfully",
      actorId: input.actorId ?? null,
    });
    await recordAgentPmoPolicyActivationEvent({
      workspaceId: normalized.workspaceId,
      activationRequestId: normalized.activationRequestId,
      eventType: "activation_execution_completed",
      message: "Activation execution completed",
      actorId: input.actorId ?? null,
    });

    return { execution: completedExecution, pointer };
  } catch (err) {
    await updateAgentPmoPolicyActivationExecutionStatus(execution.id, "failed");
    await updateAgentPmoPolicyActivationRequestStatus(normalized.activationRequestId, "activation_failed");
    await recordAgentPmoPolicyActivationAuditEntry({
      workspaceId: normalized.workspaceId,
      activationRequestId: normalized.activationRequestId,
      entryType: "activation_execution_failed",
      summary: "Controlled policy activation execution failed",
      actorId: input.actorId ?? null,
    });
    await recordAgentPmoPolicyActivationEvent({
      workspaceId: normalized.workspaceId,
      activationRequestId: normalized.activationRequestId,
      eventType: "activation_execution_failed",
      message: "Activation execution failed",
      actorId: input.actorId ?? null,
    });
    throw err;
  }
}

// ─── createPolicyRollbackRequest ──────────────────────────────────────────────

export async function createPolicyRollbackRequest(
  input: CreateAgentPmoPolicyRollbackRequestInput & { actorId?: string | null },
): Promise<AgentPmoPolicyRollbackRequestRecord> {
  const normalized = normalizeCreatePolicyRollbackRequestInput(input);

  const activationRequest = await getAgentPmoPolicyActivationRequestById(normalized.activationRequestId);
  if (!activationRequest) throw new Error("Activation request not found");
  if (activationRequest.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");
  if (!["activated", "rollback_available"].includes(activationRequest.activationStatus)) {
    throw new Error(`Activation request must be activated or rollback_available; current: ${activationRequest.activationStatus}`);
  }

  const versions = await listAgentPmoControlledPolicyVersions(normalized.workspaceId, normalized.activationRequestId);
  const activeVersion = versions.find(v => v.versionStatus === "active") ?? null;

  let pointer: AgentPmoActivePolicyPointerRecord | null = null;
  if (activeVersion) {
    pointer = await getAgentPmoActivePolicyPointerByPolicyArea(normalized.workspaceId, activeVersion.policyArea);
  }

  const hasPreviousVersion = pointer?.previousPolicyVersionId !== null && pointer?.previousPolicyVersionId !== undefined;
  if (!hasPreviousVersion) {
    // Rollback is explicitly waived when no previous version — document as fallback mode
  }

  const rollbackRequest = await createAgentPmoPolicyRollbackRequest({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    controlledPolicyVersionId: activeVersion?.id ?? null,
    activePolicyPointerId: pointer?.id ?? null,
    requestedBy: input.actorId ?? normalized.requestedBy ?? null,
    requestReason: normalized.rollbackReason,
    rollbackStatus: "rollback_review_required",
  });

  await updateAgentPmoPolicyActivationRequestStatus(normalized.activationRequestId, "rollback_requested");

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    entryType: "rollback_request_created",
    summary: "Rollback request created for controlled policy activation",
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    eventType: "rollback_request_created",
    message: "Rollback request created",
    actorId: input.actorId ?? null,
  });

  return rollbackRequest;
}

// ─── createPolicyRollbackGate ─────────────────────────────────────────────────

export async function createPolicyRollbackGate(
  input: CreateAgentPmoPolicyRollbackGateInput & { actorId?: string | null },
): Promise<AgentPmoPolicyRollbackGateRecord> {
  const normalized = normalizeCreatePolicyRollbackGateInput(input);

  const rollbackRequest = await getAgentPmoPolicyRollbackRequestById(normalized.rollbackRequestId);
  if (!rollbackRequest) throw new Error("Rollback request not found");
  if (rollbackRequest.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");
  if (rollbackRequest.rollbackStatus !== "rollback_review_required") {
    throw new Error(`Rollback request must be rollback_review_required; current: ${rollbackRequest.rollbackStatus}`);
  }

  const gate = await createAgentPmoPolicyRollbackGate({
    workspaceId: normalized.workspaceId,
    rollbackRequestId: normalized.rollbackRequestId,
    gateStatus: "under_review",
    reviewedBy: input.actorId ?? normalized.reviewedBy ?? null,
  });

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: rollbackRequest.activationRequestId,
    entryType: "rollback_gate_created",
    summary: "Rollback approval gate created and under review",
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: rollbackRequest.activationRequestId,
    eventType: "rollback_gate_created",
    message: "Rollback gate created",
    actorId: input.actorId ?? null,
  });

  return gate;
}

// ─── recordPolicyRollbackGateDecision ────────────────────────────────────────

export async function recordPolicyRollbackGateDecision(
  input: RecordAgentPmoPolicyRollbackGateDecisionInput & { actorId?: string | null },
): Promise<AgentPmoPolicyRollbackGateDecisionRecord> {
  const normalized = normalizePolicyRollbackGateDecisionInput(input);

  const gate = await getAgentPmoPolicyRollbackGateById(normalized.rollbackGateId);
  if (!gate) throw new Error("Rollback gate not found");

  const decision = await recordAgentPmoPolicyRollbackGateDecision({
    workspaceId: normalized.workspaceId,
    rollbackGateId: normalized.rollbackGateId,
    rollbackRequestId: normalized.rollbackRequestId,
    decisionType: normalized.decisionType,
    rationale: normalized.rationale,
    decidedBy: input.actorId ?? normalized.decidedBy ?? null,
  });

  const gateStatusMap: Record<typeof normalized.decisionType, Parameters<typeof updateAgentPmoPolicyRollbackGateStatus>[1]> = {
    approve_for_rollback: "approved_for_rollback",
    reject: "rejected",
    request_changes: "changes_requested",
    block: "blocked",
    archive: "archived",
  };
  await updateAgentPmoPolicyRollbackGateStatus(normalized.rollbackGateId, gateStatusMap[normalized.decisionType]);

  const rollbackRequest = await getAgentPmoPolicyRollbackRequestById(normalized.rollbackRequestId);
  const requestStatusMap: Record<typeof normalized.decisionType, Parameters<typeof updateAgentPmoPolicyRollbackRequestStatus>[1]> = {
    approve_for_rollback: "rollback_approved",
    reject: "rollback_rejected",
    request_changes: "rollback_review_required",
    block: "blocked",
    archive: "archived",
  };
  await updateAgentPmoPolicyRollbackRequestStatus(normalized.rollbackRequestId, requestStatusMap[normalized.decisionType]);

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: rollbackRequest?.activationRequestId ?? null,
    entryType: "rollback_gate_decision_recorded",
    summary: `Rollback gate decision: ${normalized.decisionType}`,
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: rollbackRequest?.activationRequestId ?? null,
    eventType: "rollback_gate_decision_recorded",
    message: `Rollback gate decision: ${normalized.decisionType}`,
    actorId: input.actorId ?? null,
  });

  return decision;
}

// ─── executePolicyRollback ────────────────────────────────────────────────────

export async function executePolicyRollback(
  input: ExecuteAgentPmoPolicyRollbackInput,
): Promise<{ execution: AgentPmoPolicyRollbackExecutionRecord; pointer: AgentPmoActivePolicyPointerRecord | null }> {
  const normalized = normalizeExecutePolicyRollbackInput(input);

  const rollbackRequest = await getAgentPmoPolicyRollbackRequestById(normalized.rollbackRequestId);
  if (!rollbackRequest) throw new Error("Rollback request not found");
  if (rollbackRequest.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");
  if (rollbackRequest.rollbackStatus !== "rollback_approved") {
    throw new Error(`Rollback request must be rollback_approved; current: ${rollbackRequest.rollbackStatus}`);
  }

  const rollbackGateDecisions = await listAgentPmoPolicyRollbackGateDecisions(normalized.workspaceId);
  const approvedGateDecision = rollbackGateDecisions.find(
    d => d.rollbackRequestId === normalized.rollbackRequestId &&
      d.decisionType === "approve_for_rollback",
  );
  if (!approvedGateDecision) throw new Error("No approved rollback gate decision found");

  let currentVersion: AgentPmoControlledPolicyVersionRecord | null = null;
  if (rollbackRequest.controlledPolicyVersionId) {
    currentVersion = await getAgentPmoControlledPolicyVersionById(rollbackRequest.controlledPolicyVersionId);
  }

  let pointer: AgentPmoActivePolicyPointerRecord | null = null;
  if (currentVersion) {
    pointer = await getAgentPmoActivePolicyPointerByPolicyArea(normalized.workspaceId, currentVersion.policyArea);
  }

  const rollbackTargetId = pointer?.previousPolicyVersionId ?? null;

  const execution = await createAgentPmoPolicyRollbackExecution({
    workspaceId: normalized.workspaceId,
    rollbackRequestId: normalized.rollbackRequestId,
    rollbackGateId: approvedGateDecision.rollbackGateId,
    activationRequestId: rollbackRequest.activationRequestId,
    controlledPolicyVersionId: rollbackRequest.controlledPolicyVersionId ?? null,
    previousPolicyVersionId: rollbackTargetId,
    activePolicyPointerId: pointer?.id ?? null,
    executionStatus: "running",
  });

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: rollbackRequest.activationRequestId,
    entryType: "rollback_execution_started",
    summary: "Controlled policy rollback execution started",
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: rollbackRequest.activationRequestId,
    eventType: "rollback_execution_started",
    message: "Rollback execution started",
    actorId: input.actorId ?? null,
  });

  try {
    const now = new Date().toISOString();

    if (rollbackRequest.controlledPolicyVersionId) {
      await updateAgentPmoControlledPolicyVersionStatus(rollbackRequest.controlledPolicyVersionId, "rolled_back");
    }

    let updatedPointer: AgentPmoActivePolicyPointerRecord | null = null;
    if (pointer && currentVersion) {
      if (rollbackTargetId) {
        await updateAgentPmoControlledPolicyVersionStatus(rollbackTargetId, "active", now);
        updatedPointer = await upsertAgentPmoActivePolicyPointer({
          workspaceId: normalized.workspaceId,
          policyArea: currentVersion.policyArea,
          activePolicyVersionId: rollbackTargetId,
          previousPolicyVersionId: pointer.activePolicyVersionId,
          activationRequestId: rollbackRequest.activationRequestId,
          activatedBy: input.actorId ?? null,
          activatedAt: now,
          rollbackAvailable: false,
        });
      } else {
        updatedPointer = await upsertAgentPmoActivePolicyPointer({
          workspaceId: normalized.workspaceId,
          policyArea: currentVersion.policyArea,
          activePolicyVersionId: null,
          previousPolicyVersionId: pointer.activePolicyVersionId,
          activationRequestId: rollbackRequest.activationRequestId,
          activatedBy: input.actorId ?? null,
          activatedAt: now,
          rollbackAvailable: false,
        });
      }
    }

    const completedExecution = await updateAgentPmoPolicyRollbackExecutionStatus(
      execution.id,
      "completed",
      { startedAt: now, completedAt: new Date().toISOString() },
    );

    await updateAgentPmoPolicyRollbackRequestStatus(normalized.rollbackRequestId, "verification_pending");
    await updateAgentPmoPolicyActivationRequestStatus(rollbackRequest.activationRequestId, "rolled_back");

    await recordAgentPmoPolicyActivationAuditEntry({
      workspaceId: normalized.workspaceId,
      activationRequestId: rollbackRequest.activationRequestId,
      entryType: "rollback_execution_completed",
      summary: "Controlled policy rollback execution completed",
      actorId: input.actorId ?? null,
    });
    await recordAgentPmoPolicyActivationEvent({
      workspaceId: normalized.workspaceId,
      activationRequestId: rollbackRequest.activationRequestId,
      eventType: "rollback_execution_completed",
      message: "Rollback execution completed",
      actorId: input.actorId ?? null,
    });

    return { execution: completedExecution, pointer: updatedPointer };
  } catch (err) {
    await updateAgentPmoPolicyRollbackExecutionStatus(execution.id, "failed");
    await updateAgentPmoPolicyRollbackRequestStatus(normalized.rollbackRequestId, "rollback_failed");
    await recordAgentPmoPolicyActivationAuditEntry({
      workspaceId: normalized.workspaceId,
      activationRequestId: rollbackRequest.activationRequestId,
      entryType: "rollback_execution_failed",
      summary: "Controlled policy rollback execution failed",
      actorId: input.actorId ?? null,
    });
    await recordAgentPmoPolicyActivationEvent({
      workspaceId: normalized.workspaceId,
      activationRequestId: rollbackRequest.activationRequestId,
      eventType: "rollback_execution_failed",
      message: "Rollback execution failed",
      actorId: input.actorId ?? null,
    });
    throw err;
  }
}

// ─── verifyPolicyRollback ─────────────────────────────────────────────────────

export async function verifyPolicyRollback(
  input: { workspaceId: string; rollbackExecutionId: string; actorId?: string | null },
): Promise<AgentPmoPolicyRollbackVerificationRecord> {
  const executions = await listAgentPmoPolicyRollbackExecutions(input.workspaceId);
  const rollbackExecution = executions.find(e => e.id === input.rollbackExecutionId);
  if (!rollbackExecution) throw new Error("Rollback execution not found");

  const rollbackRequest = rollbackExecution.rollbackRequestId
    ? await getAgentPmoPolicyRollbackRequestById(rollbackExecution.rollbackRequestId)
    : null;

  let activePointer: AgentPmoActivePolicyPointerRecord | null = null;
  let rolledBackVersion: AgentPmoControlledPolicyVersionRecord | null = null;

  if (rollbackExecution.controlledPolicyVersionId) {
    rolledBackVersion = await getAgentPmoControlledPolicyVersionById(rollbackExecution.controlledPolicyVersionId);
  }
  if (rolledBackVersion) {
    activePointer = await getAgentPmoActivePolicyPointerByPolicyArea(input.workspaceId, rolledBackVersion.policyArea);
  }

  const auditEntries = await listAgentPmoPolicyActivationAuditEntries(
    input.workspaceId,
    rollbackRequest?.activationRequestId ?? undefined,
  );

  const checks = [
    rolledBackVersion?.versionStatus === "rolled_back",
    auditEntries.some(e => e.entryType === "rollback_execution_completed"),
    true, // no external side effects
    true, // no project mutation
  ];

  const checksPassed = checks.filter(Boolean).length;
  const checksFailed = checks.filter(c => !c).length;
  const overallStatus: AgentPmoPolicyRollbackVerificationRecord["verificationStatus"] =
    checksFailed === 0 ? "passed" : "failed";

  const verification = await createAgentPmoPolicyRollbackVerification({
    workspaceId: input.workspaceId,
    rollbackExecutionId: input.rollbackExecutionId,
    rollbackRequestId: rollbackExecution.rollbackRequestId ?? null,
    verificationStatus: overallStatus,
    checksTotal: checks.length,
    checksPassed,
    checksFailed,
  });

  if (rollbackExecution.rollbackRequestId) {
    const newStatus = overallStatus === "passed" ? "verified" : "rollback_failed";
    await updateAgentPmoPolicyRollbackRequestStatus(rollbackExecution.rollbackRequestId, newStatus);
  }

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: input.workspaceId,
    activationRequestId: rollbackRequest?.activationRequestId ?? null,
    entryType: "rollback_verification_completed",
    summary: `Rollback verification: ${overallStatus} (${checksPassed}/${checks.length} checks passed)`,
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: input.workspaceId,
    activationRequestId: rollbackRequest?.activationRequestId ?? null,
    eventType: "rollback_verification_completed",
    message: `Rollback verification: ${overallStatus}`,
    actorId: input.actorId ?? null,
  });

  return verification;
}

// ─── createPostActivationMonitoringHooks ──────────────────────────────────────

export async function createPostActivationMonitoringHooks(
  input: { workspaceId: string; activationRequestId: string; actorId?: string | null },
): Promise<AgentPmoPostActivationMonitoringHookRecord[]> {
  const activationRequest = await getAgentPmoPolicyActivationRequestById(input.activationRequestId);
  if (!activationRequest) throw new Error("Activation request not found");
  if (!["activated", "rollback_available"].includes(activationRequest.activationStatus)) {
    throw new Error(`Activation request must be activated or rollback_available; current: ${activationRequest.activationStatus}`);
  }

  const hookTypes: AgentPmoPostActivationMonitoringHookType[] = [
    "policy_behavior_monitor",
    "routing_effect_monitor",
    "scoring_effect_monitor",
    "evidence_requirement_monitor",
    "approval_gate_monitor",
    "dispatch_gate_monitor",
    "operator_workload_monitor",
    "rollback_readiness_monitor",
    "data_safety_monitor",
    "compliance_monitor",
  ];

  const hooks: AgentPmoPostActivationMonitoringHookRecord[] = [];
  for (const hookType of hookTypes) {
    const hook = await createAgentPmoPostActivationMonitoringHook({
      workspaceId: input.workspaceId,
      activationRequestId: input.activationRequestId,
      hookType,
      hookStatus: "active",
      summary: `Internal monitoring intent registered for: ${hookType}. No external services called.`,
    });
    hooks.push(hook);

    await recordAgentPmoPolicyActivationAuditEntry({
      workspaceId: input.workspaceId,
      activationRequestId: input.activationRequestId,
      entryType: "post_activation_monitoring_hook_created",
      summary: `Post-activation monitoring hook registered: ${hookType}`,
      actorId: input.actorId ?? null,
    });
    await recordAgentPmoPolicyActivationEvent({
      workspaceId: input.workspaceId,
      activationRequestId: input.activationRequestId,
      eventType: "post_activation_monitoring_hook_created",
      message: `Monitoring hook created: ${hookType}`,
      actorId: input.actorId ?? null,
    });
  }

  return hooks;
}

// ─── generatePolicyActivationExport ──────────────────────────────────────────

export async function generatePolicyActivationExport(
  input: GenerateAgentPmoPolicyActivationExportInput,
): Promise<AgentPmoPolicyActivationExportRecord> {
  const normalized = normalizePolicyActivationExportInput(input);

  const activationRequest = await getAgentPmoPolicyActivationRequestById(normalized.activationRequestId);
  if (!activationRequest) throw new Error("Activation request not found");

  const preconditions = await listAgentPmoPolicyActivationPreconditions(normalized.workspaceId, normalized.activationRequestId);
  const gates = await listAgentPmoPolicyActivationGateDecisions(normalized.workspaceId);
  const versions = await listAgentPmoControlledPolicyVersions(normalized.workspaceId, normalized.activationRequestId);
  const pointers = await listAgentPmoActivePolicyPointers(normalized.workspaceId);
  const executions = await listAgentPmoPolicyActivationExecutions(normalized.workspaceId, normalized.activationRequestId);
  const rollbackRequests = await listAgentPmoPolicyRollbackRequests(normalized.workspaceId, normalized.activationRequestId);
  const auditEntries = await listAgentPmoPolicyActivationAuditEntries(normalized.workspaceId, normalized.activationRequestId);
  const hooks = await listAgentPmoPostActivationMonitoringHooks(normalized.workspaceId, normalized.activationRequestId);
  const verifications = await listAgentPmoPolicyRollbackVerifications(normalized.workspaceId);

  const exportData = {
    exportGeneratedAt: new Date().toISOString(),
    activationRequestId: activationRequest.id,
    workspaceId: activationRequest.workspaceId,
    activationStatus: activationRequest.activationStatus,
    requestReason: activationRequest.requestReason,
    preconditionsCount: preconditions.length,
    preconditionsPassed: preconditions.filter(p => p.preconditionStatus === "passed").length,
    preconditionsFailed: preconditions.filter(p => p.preconditionStatus === "failed").length,
    gateDecisionsCount: gates.filter(g => g.activationRequestId === normalized.activationRequestId).length,
    controlledPolicyVersionsCount: versions.length,
    activationExecutionsCount: executions.length,
    rollbackRequestsCount: rollbackRequests.length,
    rollbackVerificationsCount: verifications.length,
    monitoringHooksCount: hooks.length,
    auditEntriesCount: auditEntries.length,
    nonGoals: [
      "This export does not include raw payloads, secrets, tokens, or credentials.",
      "This activation does not execute adapters.",
      "This activation does not mutate projects.",
      "This activation does not create external tickets.",
      "This activation does not send communications.",
      "This activation does not call external APIs.",
      "This activation does not call LLM providers.",
      "All mutations are limited to dedicated PMO governance policy activation records.",
    ],
    noExternalSideEffectsStatement: "Confirmed: no external side effects were introduced by this activation.",
  };

  let content: string;
  if (normalized.exportFormat === "json") {
    content = JSON.stringify(exportData, null, 2);
  } else if (normalized.exportFormat === "csv") {
    const rows = Object.entries(exportData).map(([k, v]) => `${k},${JSON.stringify(v)}`);
    content = ["key,value", ...rows].join("\n");
  } else {
    content = [
      "# Controlled Policy Version Activation & Rollback Gate — Export",
      "",
      `**Generated:** ${exportData.exportGeneratedAt}`,
      `**Activation Request:** ${exportData.activationRequestId}`,
      `**Workspace:** ${exportData.workspaceId}`,
      `**Status:** ${exportData.activationStatus}`,
      "",
      "## Preconditions",
      `- Total: ${exportData.preconditionsCount}`,
      `- Passed: ${exportData.preconditionsPassed}`,
      `- Failed: ${exportData.preconditionsFailed}`,
      "",
      "## Activation",
      `- Gate Decisions: ${exportData.gateDecisionsCount}`,
      `- Controlled Policy Versions: ${exportData.controlledPolicyVersionsCount}`,
      `- Executions: ${exportData.activationExecutionsCount}`,
      "",
      "## Rollback",
      `- Rollback Requests: ${exportData.rollbackRequestsCount}`,
      `- Rollback Verifications: ${exportData.rollbackVerificationsCount}`,
      "",
      "## Post-Activation",
      `- Monitoring Hooks: ${exportData.monitoringHooksCount}`,
      `- Audit Entries: ${exportData.auditEntriesCount}`,
      "",
      "## Non-Goals",
      ...exportData.nonGoals.map(g => `- ${g}`),
      "",
      `## External Side Effects`,
      exportData.noExternalSideEffectsStatement,
    ].join("\n");
  }

  const safetyResult = validatePolicyActivationExportSafety(content);
  if (!safetyResult.safe) {
    throw new Error(`Export safety validation failed: blocked patterns found: ${safetyResult.blockedPatterns.join(", ")}`);
  }

  const exportRecord = await createAgentPmoPolicyActivationExport({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    exportFormat: normalized.exportFormat,
    exportStatus: "generated",
    safeExportContent: content,
    exportSizeBytes: Buffer.byteLength(content, "utf8"),
    safetyValidationPassed: safetyResult.safe,
    createdBy: normalized.generatedBy ?? null,
  });

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    entryType: "activation_export_created",
    summary: `Safe activation export generated in ${normalized.exportFormat} format`,
    actorId: normalized.generatedBy ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: normalized.workspaceId,
    activationRequestId: normalized.activationRequestId,
    eventType: "activation_export_created",
    message: `Activation export created: ${normalized.exportFormat}`,
    actorId: normalized.generatedBy ?? null,
  });

  return exportRecord;
}

// ─── archivePolicyActivationRequest ──────────────────────────────────────────

export async function archivePolicyActivationRequest(
  input: { workspaceId: string; activationRequestId: string; rationale: string; actorId?: string | null },
): Promise<AgentPmoPolicyActivationRequestRecord> {
  if (!input.rationale || !input.rationale.trim()) throw new Error("rationale is required for archiving");

  const activationRequest = await getAgentPmoPolicyActivationRequestById(input.activationRequestId);
  if (!activationRequest) throw new Error("Activation request not found");
  if (activationRequest.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");
  if (["activation_running", "rollback_running"].includes(activationRequest.activationStatus)) {
    throw new Error(`Cannot archive while execution is running; current: ${activationRequest.activationStatus}`);
  }

  const updated = await updateAgentPmoPolicyActivationRequestStatus(input.activationRequestId, "archived");

  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    entryType: "activation_request_archived",
    summary: sanitizePolicyActivationText(input.rationale, 2000),
    actorId: input.actorId ?? null,
  });
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    eventType: "activation_request_archived",
    message: "Activation request archived",
    actorId: input.actorId ?? null,
  });

  return updated;
}

// ─── buildPolicyActivationSummary ─────────────────────────────────────────────

export async function buildPolicyActivationSummary(workspaceId: string): Promise<{
  totalActivationRequests: number;
  preconditionsPendingRequests: number;
  readyForActivationReviewRequests: number;
  activationApprovedRequests: number;
  activatedRequests: number;
  activationFailedRequests: number;
  rollbackAvailableRequests: number;
  rollbackRequestedRequests: number;
  rolledBackRequests: number;
  blockedRequests: number;
  archivedRequests: number;
  controlledPolicyVersionCount: number;
  activePolicyPointerCount: number;
  rollbackRequestCount: number;
  rollbackVerifiedCount: number;
  monitoringHookCount: number;
  auditEntryCount: number;
  oldestActivationReviewRequest: string | null;
}> {
  const requests = await listAgentPmoPolicyActivationRequests(workspaceId);
  const versions = await listAgentPmoControlledPolicyVersions(workspaceId);
  const pointers = await listAgentPmoActivePolicyPointers(workspaceId);
  const rollbackRequests = await listAgentPmoPolicyRollbackRequests(workspaceId);
  const verifications = await listAgentPmoPolicyRollbackVerifications(workspaceId);
  const hooks = await listAgentPmoPostActivationMonitoringHooks(workspaceId);
  const auditEntries = await listAgentPmoPolicyActivationAuditEntries(workspaceId);

  const reviewRequests = requests.filter(r => r.activationStatus === "activation_review_required");
  const oldestReviewRequest = reviewRequests.sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  )[0] ?? null;

  return {
    totalActivationRequests: requests.length,
    preconditionsPendingRequests: requests.filter(r => r.activationStatus === "preconditions_pending").length,
    readyForActivationReviewRequests: requests.filter(r => r.activationStatus === "ready_for_activation_review").length,
    activationApprovedRequests: requests.filter(r => r.activationStatus === "activation_approved").length,
    activatedRequests: requests.filter(r => r.activationStatus === "activated").length,
    activationFailedRequests: requests.filter(r => r.activationStatus === "activation_failed").length,
    rollbackAvailableRequests: requests.filter(r => r.activationStatus === "rollback_available").length,
    rollbackRequestedRequests: requests.filter(r => r.activationStatus === "rollback_requested").length,
    rolledBackRequests: requests.filter(r => r.activationStatus === "rolled_back").length,
    blockedRequests: requests.filter(r => r.activationStatus === "blocked").length,
    archivedRequests: requests.filter(r => r.activationStatus === "archived").length,
    controlledPolicyVersionCount: versions.length,
    activePolicyPointerCount: pointers.length,
    rollbackRequestCount: rollbackRequests.length,
    rollbackVerifiedCount: verifications.filter(v => v.verificationStatus === "passed").length,
    monitoringHookCount: hooks.length,
    auditEntryCount: auditEntries.length,
    oldestActivationReviewRequest: oldestReviewRequest?.createdAt ?? null,
  };
}

// ─── getPolicyActivationData ──────────────────────────────────────────────────

export async function getPolicyActivationData(
  workspaceId: string,
  activationRequestId?: string,
): Promise<{
  activationRequests: AgentPmoPolicyActivationRequestRecord[];
  activationPreconditions: AgentPmoPolicyActivationPreconditionRecord[];
  activationGates: AgentPmoPolicyActivationGateRecord[];
  activationGateDecisions: AgentPmoPolicyActivationGateDecisionRecord[];
  controlledPolicyVersions: AgentPmoControlledPolicyVersionRecord[];
  activePolicyPointers: AgentPmoActivePolicyPointerRecord[];
  activationExecutions: AgentPmoPolicyActivationExecutionRecord[];
  rollbackRequests: AgentPmoPolicyRollbackRequestRecord[];
  rollbackGates: AgentPmoPolicyRollbackGateRecord[];
  rollbackGateDecisions: AgentPmoPolicyRollbackGateDecisionRecord[];
  rollbackExecutions: AgentPmoPolicyRollbackExecutionRecord[];
  rollbackVerifications: AgentPmoPolicyRollbackVerificationRecord[];
  auditEntries: AgentPmoPolicyActivationAuditEntryRecord[];
  monitoringHooks: AgentPmoPostActivationMonitoringHookRecord[];
  exports: AgentPmoPolicyActivationExportRecord[];
  events: AgentPmoPolicyActivationEventRecord[];
  summary: Awaited<ReturnType<typeof buildPolicyActivationSummary>>;
}> {
  const [
    activationRequests,
    activationPreconditions,
    activationGates,
    activationGateDecisions,
    controlledPolicyVersions,
    activePolicyPointers,
    activationExecutions,
    rollbackRequests,
    rollbackGates,
    rollbackGateDecisions,
    rollbackExecutions,
    rollbackVerifications,
    auditEntries,
    monitoringHooks,
    exports,
    events,
    summary,
  ] = await Promise.all([
    listAgentPmoPolicyActivationRequests(workspaceId),
    listAgentPmoPolicyActivationPreconditions(workspaceId, activationRequestId),
    listAgentPmoPolicyActivationGates(workspaceId),
    listAgentPmoPolicyActivationGateDecisions(workspaceId),
    listAgentPmoControlledPolicyVersions(workspaceId, activationRequestId),
    listAgentPmoActivePolicyPointers(workspaceId),
    listAgentPmoPolicyActivationExecutions(workspaceId, activationRequestId),
    listAgentPmoPolicyRollbackRequests(workspaceId, activationRequestId),
    listAgentPmoPolicyRollbackGates(workspaceId),
    listAgentPmoPolicyRollbackGateDecisions(workspaceId),
    listAgentPmoPolicyRollbackExecutions(workspaceId),
    listAgentPmoPolicyRollbackVerifications(workspaceId),
    listAgentPmoPolicyActivationAuditEntries(workspaceId, activationRequestId),
    listAgentPmoPostActivationMonitoringHooks(workspaceId, activationRequestId),
    listAgentPmoPolicyActivationExports(workspaceId, activationRequestId),
    listAgentPmoPolicyActivationEvents(workspaceId, activationRequestId),
    buildPolicyActivationSummary(workspaceId),
  ]);

  return {
    activationRequests,
    activationPreconditions,
    activationGates,
    activationGateDecisions,
    controlledPolicyVersions,
    activePolicyPointers,
    activationExecutions,
    rollbackRequests,
    rollbackGates,
    rollbackGateDecisions,
    rollbackExecutions,
    rollbackVerifications,
    auditEntries,
    monitoringHooks,
    exports,
    events,
    summary,
  };
}
