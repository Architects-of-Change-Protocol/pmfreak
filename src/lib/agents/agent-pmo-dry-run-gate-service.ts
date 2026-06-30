// ─── PMO Controlled Policy Implementation Gate & Dry-Run Change Executor — Service ─
// Does NOT call LLMs, AI providers, or embedding services.
// Does NOT call external APIs (no HTTP calls, no network I/O).
// Does NOT send email, slack, jira, or calendar events.
// Does NOT apply policies, change routing, change risk scoring.
// Does NOT activate policy drafts or execute rollback.
// Does NOT mutate live policies or runtime systems.
// Does NOT execute adapters or dispatch to external systems.
// All operations are deterministic — dry-run simulation only.

import {
  createAgentPmoDryRunExecutionRequest,
  getAgentPmoDryRunExecutionRequestById,
  listAgentPmoDryRunExecutionRequests,
  updateAgentPmoDryRunExecutionRequestStatus,
  createAgentPmoDryRunPreflightValidation,
  getAgentPmoDryRunPreflightValidationById,
  listAgentPmoDryRunPreflightValidations,
  updateAgentPmoDryRunPreflightValidationStatus,
  createAgentPmoDryRunGateApproval,
  getAgentPmoDryRunGateApprovalById,
  listAgentPmoDryRunGateApprovals,
  updateAgentPmoDryRunGateApprovalStatus,
  recordAgentPmoDryRunGateDecision,
  listAgentPmoDryRunGateDecisions,
  createAgentPmoDryRunChangeSet,
  getAgentPmoDryRunChangeSetById,
  listAgentPmoDryRunChangeSets,
  createAgentPmoDryRunChangeSetItem,
  listAgentPmoDryRunChangeSetItems,
  createAgentPmoSimulatedPolicyVersion,
  getAgentPmoSimulatedPolicyVersionById,
  listAgentPmoSimulatedPolicyVersions,
  updateAgentPmoSimulatedPolicyVersionStatus,
  createAgentPmoDryRunSimulationExecution,
  getAgentPmoDryRunSimulationExecutionById,
  listAgentPmoDryRunSimulationExecutions,
  updateAgentPmoDryRunSimulationExecutionStatus,
  createAgentPmoDryRunSimulatedImpact,
  listAgentPmoDryRunSimulatedImpacts,
  createAgentPmoDryRunEvidencePackage,
  getAgentPmoDryRunEvidencePackageById,
  listAgentPmoDryRunEvidencePackages,
  updateAgentPmoDryRunEvidencePackageStatus,
  createAgentPmoDryRunEvidenceSection,
  listAgentPmoDryRunEvidenceSections,
  createAgentPmoDryRunBlocker,
  listAgentPmoDryRunBlockers,
  updateAgentPmoDryRunBlockerStatus,
  recordAgentPmoDryRunOperatorReview,
  listAgentPmoDryRunOperatorReviews,
  recordAgentPmoDryRunDecision,
  listAgentPmoDryRunDecisions,
  createAgentPmoDryRunExport,
  getAgentPmoDryRunExportById,
  listAgentPmoDryRunExports,
  recordAgentPmoDryRunEvent,
  listAgentPmoDryRunEvents,
} from "./agent-pmo-dry-run-gate-registry";

import {
  normalizeCreateDryRunRequestInput,
  normalizeCreateDryRunGateApprovalInput,
  normalizeDryRunGateDecisionInput,
  normalizeDryRunOperatorReviewInput,
  normalizeDryRunDecisionInput,
  normalizeDryRunExportInput,
  evaluateDryRunPreflightStatus,
  evaluateDryRunImpactLevel,
  validateDryRunExportSafety,
  redactDryRunPayload,
  sanitizeDryRunText,
} from "./agent-pmo-dry-run-gate-validation";

import type {
  AgentPmoDryRunExecutionRequestRecord,
  AgentPmoDryRunPreflightValidationRecord,
  AgentPmoDryRunGateApprovalRecord,
  AgentPmoDryRunGateDecisionRecord,
  AgentPmoDryRunChangeSetRecord,
  AgentPmoDryRunChangeSetItemRecord,
  AgentPmoSimulatedPolicyVersionRecord,
  AgentPmoDryRunSimulationExecutionRecord,
  AgentPmoDryRunSimulatedImpactRecord,
  AgentPmoDryRunEvidencePackageRecord,
  AgentPmoDryRunEvidenceSectionRecord,
  AgentPmoDryRunBlockerRecord,
  AgentPmoDryRunOperatorReviewRecord,
  AgentPmoDryRunDecisionRecord,
  AgentPmoDryRunExportRecord,
  AgentPmoDryRunEventRecord,
  CreateAgentPmoDryRunExecutionRequestInput,
  CreateAgentPmoDryRunGateApprovalInput,
  RecordAgentPmoDryRunGateDecisionInput,
  RecordAgentPmoDryRunOperatorReviewInput,
  RecordAgentPmoDryRunDecisionInput,
  GenerateAgentPmoDryRunExportInput,
  AgentPmoDryRunImpactDomain,
} from "./agent-pmo-dry-run-gate-types";

// ─── Dry-Run Execution Request from Planning Workspace ────────────────────────

export async function createDryRunExecutionRequestFromPlanningWorkspace(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId?: string | null;
  changeRequestId?: string | null;
  requestReason: string;
  actorId?: string | null;
}): Promise<AgentPmoDryRunExecutionRequestRecord> {
  const normalized = normalizeCreateDryRunRequestInput({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    approvalPackId: input.approvalPackId,
    changeRequestId: input.changeRequestId,
    requestReason: input.requestReason,
    requestedBy: input.actorId,
  });

  const request = await createAgentPmoDryRunExecutionRequest({
    workspaceId: normalized.workspaceId,
    planningWorkspaceId: normalized.planningWorkspaceId,
    approvalPackId: normalized.approvalPackId ?? null,
    changeRequestId: normalized.changeRequestId ?? null,
    requestedBy: normalized.requestedBy ?? null,
    requestReason: normalized.requestReason,
    requestStatus: "preflight_pending",
    safeRequestPayload: redactDryRunPayload({
      planningWorkspaceId: normalized.planningWorkspaceId,
      approvalPackId: normalized.approvalPackId ?? null,
    }),
  });

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: request.id,
    eventType: "dry_run_request_created",
    message: "Dry-run execution request created from planning workspace",
    actorId: input.actorId ?? null,
  });

  return request;
}

// ─── Pre-Flight Validation ────────────────────────────────────────────────────

export async function runDryRunPreflightValidation(input: {
  workspaceId: string;
  dryRunRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoDryRunPreflightValidationRecord> {
  const request = await getAgentPmoDryRunExecutionRequestById(input.dryRunRequestId);
  if (!request) throw new Error("Dry-run execution request not found");
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");

  const checks = {
    planning_workspace_exists: !!request.planningWorkspaceId,
    approval_pack_exists: !!request.approvalPackId,
    request_reason_provided: request.requestReason.length > 0,
    workspace_id_valid: !!request.workspaceId,
    no_live_mutation_requested: true,
    no_external_side_effects: true,
    no_unsafe_payload_detected: true,
  };

  let passed = 0;
  let failed = 0;
  let blocked = 0;

  const blockingChecks = new Set(["planning_workspace_exists", "request_reason_provided", "workspace_id_valid"]);
  for (const [key, value] of Object.entries(checks)) {
    if (value === true) passed++;
    else if (value === false) {
      if (blockingChecks.has(key)) {
        blocked++;
      } else {
        failed++;
      }
    }
  }
  const total = Object.keys(checks).length;

  const preflightStatus = evaluateDryRunPreflightStatus({ total, passed, failed, blocked });

  const preflight = await createAgentPmoDryRunPreflightValidation({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    preflightStatus,
    checksTotal: total,
    checksPassed: passed,
    checksFailed: failed,
    checksBlocked: blocked,
    safePreflightPayload: redactDryRunPayload({ checksPerformed: Object.keys(checks).length }),
  });

  if (preflightStatus === "failed") {
    await createAgentPmoDryRunBlocker({
      workspaceId: input.workspaceId,
      dryRunRequestId: input.dryRunRequestId,
      blockerType: "preflight_failed",
      severity: "high",
      summary: sanitizeDryRunText(`Pre-flight validation failed: ${failed} check(s) failed`, 2000),
    });
    await updateAgentPmoDryRunExecutionRequestStatus(input.dryRunRequestId, "preflight_failed");
  } else if (preflightStatus === "blocked") {
    await createAgentPmoDryRunBlocker({
      workspaceId: input.workspaceId,
      dryRunRequestId: input.dryRunRequestId,
      blockerType: "preflight_failed",
      severity: "critical",
      summary: sanitizeDryRunText(`Pre-flight validation blocked: ${blocked} check(s) blocked`, 2000),
    });
    await updateAgentPmoDryRunExecutionRequestStatus(input.dryRunRequestId, "blocked");
  } else if (preflightStatus === "passed") {
    await updateAgentPmoDryRunExecutionRequestStatus(input.dryRunRequestId, "ready_for_gate_review");
  }

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    eventType: "dry_run_preflight_completed",
    message: `Pre-flight validation completed with status: ${preflightStatus}`,
    actorId: input.actorId ?? null,
  });

  return preflight;
}

// ─── Gate Approval ────────────────────────────────────────────────────────────

export async function createDryRunGateApproval(input: CreateAgentPmoDryRunGateApprovalInput & { actorId?: string | null }): Promise<AgentPmoDryRunGateApprovalRecord> {
  const normalized = normalizeCreateDryRunGateApprovalInput({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    reviewedBy: input.reviewedBy,
  });

  const request = await getAgentPmoDryRunExecutionRequestById(normalized.dryRunRequestId);
  if (!request) throw new Error("Dry-run execution request not found");
  if (request.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");
  if (request.requestStatus !== "ready_for_gate_review") {
    throw new Error(`Request must be in ready_for_gate_review status, current: ${request.requestStatus}`);
  }

  const approval = await createAgentPmoDryRunGateApproval({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    gateApprovalStatus: "under_review",
    reviewedBy: normalized.reviewedBy ?? null,
  });

  await updateAgentPmoDryRunExecutionRequestStatus(normalized.dryRunRequestId, "gate_review_required");

  await recordAgentPmoDryRunEvent({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    eventType: "dry_run_gate_approval_created",
    message: "Dry-run gate approval created — awaiting human review",
    actorId: input.actorId ?? null,
  });

  return approval;
}

// ─── Gate Decision ────────────────────────────────────────────────────────────

export async function recordDryRunGateDecision(input: RecordAgentPmoDryRunGateDecisionInput & { actorId?: string | null }): Promise<AgentPmoDryRunGateDecisionRecord> {
  const normalized = normalizeDryRunGateDecisionInput({
    workspaceId: input.workspaceId,
    gateApprovalId: input.gateApprovalId,
    dryRunRequestId: input.dryRunRequestId,
    decisionType: input.decisionType,
    rationale: input.rationale,
    decidedBy: input.decidedBy,
  });

  const approval = await getAgentPmoDryRunGateApprovalById(normalized.gateApprovalId);
  if (!approval) throw new Error("Gate approval not found");
  if (approval.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");
  if (approval.dryRunRequestId !== normalized.dryRunRequestId) throw new Error("Gate approval does not belong to the specified dry-run request");

  const decision = await recordAgentPmoDryRunGateDecision({
    workspaceId: normalized.workspaceId,
    gateApprovalId: normalized.gateApprovalId,
    dryRunRequestId: normalized.dryRunRequestId,
    decisionType: normalized.decisionType,
    rationale: normalized.rationale,
    decidedBy: normalized.decidedBy ?? null,
  });

  const statusMap: Record<string, Parameters<typeof updateAgentPmoDryRunGateApprovalStatus>[1]> = {
    approve_for_dry_run_only: "approved_for_dry_run_only",
    reject: "rejected",
    request_changes: "changes_requested",
    block: "blocked",
    archive: "archived",
  };
  await updateAgentPmoDryRunGateApprovalStatus(normalized.gateApprovalId, statusMap[normalized.decisionType]);

  const requestStatusMap: Record<string, Parameters<typeof updateAgentPmoDryRunExecutionRequestStatus>[1]> = {
    approve_for_dry_run_only: "gate_approved",
    reject: "gate_rejected",
    request_changes: "gate_review_required",
    block: "blocked",
    archive: "archived",
  };
  await updateAgentPmoDryRunExecutionRequestStatus(normalized.dryRunRequestId, requestStatusMap[normalized.decisionType]);

  await recordAgentPmoDryRunEvent({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    eventType: "dry_run_gate_decision_recorded",
    message: `Gate decision recorded: ${normalized.decisionType}. This does not authorize live activation.`,
    actorId: input.actorId ?? null,
  });

  return decision;
}

// ─── Change Set Generation ────────────────────────────────────────────────────

export async function generateDryRunChangeSet(input: {
  workspaceId: string;
  dryRunRequestId: string;
  actorId?: string | null;
}): Promise<{ changeSet: AgentPmoDryRunChangeSetRecord; items: AgentPmoDryRunChangeSetItemRecord[] }> {
  const request = await getAgentPmoDryRunExecutionRequestById(input.dryRunRequestId);
  if (!request) throw new Error("Dry-run execution request not found");
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");
  if (request.requestStatus !== "gate_approved") {
    throw new Error(`Request must be in gate_approved status, current: ${request.requestStatus}`);
  }

  const changeTypes: Array<{ changeType: Parameters<typeof createAgentPmoDryRunChangeSetItem>[0]["changeType"]; summary: string }> = [
    { changeType: "policy_rule_addition", summary: "Simulated: policy rule addition from planning workspace" },
    { changeType: "policy_rule_update", summary: "Simulated: policy rule update from planning workspace" },
    { changeType: "routing_rule_simulation", summary: "Simulated: routing rule impact (no actual routing change)" },
    { changeType: "scoring_rule_simulation", summary: "Simulated: scoring rule impact (no actual scoring change)" },
    { changeType: "evidence_requirement_simulation", summary: "Simulated: evidence requirement impact (no actual change)" },
    { changeType: "rollback_path_simulation", summary: "Simulated: rollback path from rehearsal plan (no actual rollback)" },
  ];

  const changeSet = await createAgentPmoDryRunChangeSet({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    planningWorkspaceId: request.planningWorkspaceId,
    approvalPackId: request.approvalPackId ?? null,
    changeRequestId: request.changeRequestId ?? null,
    simulatedChangeCount: changeTypes.length,
    policyArea: "governance_policy",
    safeChangeSummary: sanitizeDryRunText(
      `Simulated change set with ${changeTypes.length} items. No live changes applied.`,
      4000
    ),
    safeChangeSetPayload: redactDryRunPayload({ simulatedOnly: true, changeCount: changeTypes.length }),
  });

  const items: AgentPmoDryRunChangeSetItemRecord[] = [];
  for (const ct of changeTypes) {
    const item = await createAgentPmoDryRunChangeSetItem({
      workspaceId: input.workspaceId,
      changeSetId: changeSet.id,
      dryRunRequestId: input.dryRunRequestId,
      changeType: ct.changeType,
      safeChangeSummary: sanitizeDryRunText(ct.summary, 2000),
      safeChangePayload: redactDryRunPayload({ simulatedOnly: true }),
    });
    items.push(item);
  }

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    eventType: "dry_run_change_set_created",
    message: `Dry-run change set created with ${changeTypes.length} simulated items. Change set is NOT applied.`,
    actorId: input.actorId ?? null,
  });

  return { changeSet, items };
}

// ─── Simulated Policy Version ─────────────────────────────────────────────────

export async function generateSimulatedPolicyVersion(input: {
  workspaceId: string;
  dryRunRequestId: string;
  changeSetId: string;
  actorId?: string | null;
}): Promise<AgentPmoSimulatedPolicyVersionRecord> {
  const request = await getAgentPmoDryRunExecutionRequestById(input.dryRunRequestId);
  if (!request) throw new Error("Dry-run execution request not found");
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");

  const changeSet = await getAgentPmoDryRunChangeSetById(input.changeSetId);
  if (!changeSet) throw new Error("Change set not found");

  const version = await createAgentPmoSimulatedPolicyVersion({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    changeSetId: input.changeSetId,
    simulatedVersionLabel: `simulated_dry_run_${new Date().toISOString().slice(0, 10)}`,
    baselineLabel: "conceptual_current_policy",
    targetLabel: "simulated_future_policy_version",
    unknownBaseline: true,
    simulatedPolicyPayload: redactDryRunPayload({
      simulatedOnly: true,
      changeCount: changeSet.simulatedChangeCount,
      limitation: "Baseline is unknown — this is a conceptual simulation only",
    }),
    safeDiffPayload: redactDryRunPayload({
      simulatedOnly: true,
      diffSummary: `${changeSet.simulatedChangeCount} simulated changes`,
    }),
    status: "simulated",
  });

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    eventType: "simulated_policy_version_created",
    message: "Simulated policy version created. This is NOT a live policy version.",
    actorId: input.actorId ?? null,
  });

  return version;
}

// ─── Dry-Run Simulation Execution ─────────────────────────────────────────────

export async function executeDryRunSimulation(input: {
  workspaceId: string;
  dryRunRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoDryRunSimulationExecutionRecord> {
  const request = await getAgentPmoDryRunExecutionRequestById(input.dryRunRequestId);
  if (!request) throw new Error("Dry-run execution request not found");
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");
  if (request.requestStatus !== "gate_approved") {
    throw new Error(`Request must be in gate_approved status, current: ${request.requestStatus}`);
  }

  const preflights = await listAgentPmsDryRunPreflightValidations(input.workspaceId, input.dryRunRequestId);
  const preflight = preflights[0] ?? null;
  if (!preflight) {
    throw new Error("Pre-flight validation is required before executing a dry-run simulation");
  }
  if (preflight.preflightStatus !== "passed" && preflight.preflightStatus !== "waived") {
    throw new Error(`Pre-flight must be passed or waived, current: ${preflight.preflightStatus}`);
  }

  const changeSets = await listAgentPmoDryRunChangeSets(input.workspaceId, input.dryRunRequestId);
  const changeSet = changeSets[0] ?? null;

  const simVersions = await listAgentPmoSimulatedPolicyVersions(input.workspaceId, input.dryRunRequestId);
  const simVersion = simVersions[0] ?? null;

  const gateApprovals = await listAgentPmoDryRunGateApprovals(input.workspaceId, input.dryRunRequestId);
  const gateApproval = gateApprovals[0] ?? null;

  const execution = await createAgentPmoDryRunSimulationExecution({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    preflightValidationId: preflight?.id ?? null,
    gateApprovalId: gateApproval?.id ?? null,
    changeSetId: changeSet?.id ?? null,
    simulatedPolicyVersionId: simVersion?.id ?? null,
    executionStatus: "running",
    safeExecutionPayload: redactDryRunPayload({ simulatedOnly: true }),
  });

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    eventType: "dry_run_execution_started",
    message: "Dry-run simulation execution started. No external systems are being called.",
    actorId: input.actorId ?? null,
  });

  const now = new Date().toISOString();
  const completed = await updateAgentPmoDryRunSimulationExecutionStatus(execution.id, "completed", {
    startedAt: now,
    completedAt: new Date().toISOString(),
    safeExecutionPayload: redactDryRunPayload({
      simulatedOnly: true,
      outcome: "dry_run_simulation_completed",
      noLiveMutation: true,
      noAdaptersCalled: true,
      noExternalAPICalls: true,
    }),
  });

  await updateAgentPmoDryRunExecutionRequestStatus(input.dryRunRequestId, "dry_run_completed");

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    eventType: "dry_run_execution_completed",
    message: "Dry-run simulation execution completed. No live policy was mutated.",
    actorId: input.actorId ?? null,
  });

  return completed ?? execution;
}

async function listAgentPmsDryRunPreflightValidations(workspaceId: string, dryRunRequestId: string) {
  return listAgentPmoDryRunPreflightValidations(workspaceId, dryRunRequestId);
}

// ─── Simulated Impacts ────────────────────────────────────────────────────────

export async function generateDryRunSimulatedImpacts(input: {
  workspaceId: string;
  dryRunRequestId: string;
  dryRunExecutionId: string;
  actorId?: string | null;
}): Promise<AgentPmoDryRunSimulatedImpactRecord[]> {
  const execution = await getAgentPmoDryRunSimulationExecutionById(input.dryRunExecutionId);
  if (!execution) throw new Error("Dry-run simulation execution not found");
  if (execution.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");
  if (execution.dryRunRequestId !== input.dryRunRequestId) throw new Error("Execution does not belong to the specified dry-run request");

  const domains: AgentPmoDryRunImpactDomain[] = [
    "policy_behavior",
    "review_routing",
    "risk_scoring",
    "evidence_requirements",
    "approval_gates",
    "dispatch_gates",
    "operator_workload",
    "rollback_readiness",
    "data_safety",
    "compliance",
  ];

  const domainDescriptions: Record<AgentPmoDryRunImpactDomain, { affectedCount: number; summary: string }> = {
    policy_behavior: { affectedCount: 1, summary: "Simulated: policy behavior would change upon activation (no actual change)" },
    review_routing: { affectedCount: 0, summary: "Simulated: review routing impact assessed (no actual routing change)" },
    risk_scoring: { affectedCount: 0, summary: "Simulated: risk scoring impact assessed (no actual scoring change)" },
    evidence_requirements: { affectedCount: 0, summary: "Simulated: evidence requirement impact assessed (no actual change)" },
    approval_gates: { affectedCount: 0, summary: "Simulated: approval gate impact assessed (no actual gate change)" },
    dispatch_gates: { affectedCount: 0, summary: "Simulated: dispatch gate impact assessed (no actual gate change)" },
    operator_workload: { affectedCount: 1, summary: "Simulated: operator workload impact assessed" },
    rollback_readiness: { affectedCount: 1, summary: "Simulated: rollback readiness assessed from rehearsal plan" },
    data_safety: { affectedCount: 0, summary: "Simulated: data safety impact assessed — no unsafe changes detected" },
    compliance: { affectedCount: 0, summary: "Simulated: compliance impact assessed" },
  };

  const impacts: AgentPmoDryRunSimulatedImpactRecord[] = [];
  for (const domain of domains) {
    const info = domainDescriptions[domain];
    const impactLevel = evaluateDryRunImpactLevel(info.affectedCount, domain);
    const impact = await createAgentPmoDryRunSimulatedImpact({
      workspaceId: input.workspaceId,
      dryRunExecutionId: input.dryRunExecutionId,
      dryRunRequestId: input.dryRunRequestId,
      impactDomain: domain,
      impactLevel,
      impactSummary: sanitizeDryRunText(info.summary, 2000),
      affectedCount: info.affectedCount,
      safeImpactPayload: redactDryRunPayload({ simulatedOnly: true, domain }),
    });
    impacts.push(impact);

    await recordAgentPmoDryRunEvent({
      workspaceId: input.workspaceId,
      dryRunRequestId: input.dryRunRequestId,
      eventType: "simulated_impact_recorded",
      message: `Simulated impact recorded for domain: ${domain}`,
      actorId: input.actorId ?? null,
    });
  }

  return impacts;
}

// ─── Evidence Package ─────────────────────────────────────────────────────────

export async function assembleDryRunEvidencePackage(input: {
  workspaceId: string;
  dryRunRequestId: string;
  actorId?: string | null;
}): Promise<{ package: AgentPmoDryRunEvidencePackageRecord; sections: AgentPmoDryRunEvidenceSectionRecord[] }> {
  const request = await getAgentPmoDryRunExecutionRequestById(input.dryRunRequestId);
  if (!request) throw new Error("Dry-run execution request not found");
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");

  const preflights = await listAgentPmoDryRunPreflightValidations(input.workspaceId, input.dryRunRequestId);
  const gateApprovals = await listAgentPmoDryRunGateApprovals(input.workspaceId, input.dryRunRequestId);
  const gateDecisions = await listAgentPmoDryRunGateDecisions(input.workspaceId, input.dryRunRequestId);
  const changeSets = await listAgentPmoDryRunChangeSets(input.workspaceId, input.dryRunRequestId);
  const simVersions = await listAgentPmoSimulatedPolicyVersions(input.workspaceId, input.dryRunRequestId);
  const executions = await listAgentPmoDryRunSimulationExecutions(input.workspaceId, input.dryRunRequestId);
  const impacts = await listAgentPmoDryRunSimulatedImpacts(input.workspaceId, executions[0]?.id);
  const blockers = await listAgentPmoDryRunBlockers(input.workspaceId, input.dryRunRequestId);
  const reviews = await listAgentPmoDryRunOperatorReviews(input.workspaceId, input.dryRunRequestId);

  const pkg = await createAgentPmoDryRunEvidencePackage({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    packageStatus: "assembling" as Parameters<typeof createAgentPmoDryRunEvidencePackage>[0]["packageStatus"],
    safePackagePayload: redactDryRunPayload({ simulatedOnly: true }),
  });

  const sectionDefs: Array<{ sectionType: Parameters<typeof createAgentPmoDryRunEvidenceSection>[0]["sectionType"]; content: string; markdown: string }> = [
    {
      sectionType: "preflight_summary",
      content: sanitizeDryRunText(`Pre-flight validations: ${preflights.length}. Status: ${preflights[0]?.preflightStatus ?? "not run"}`, 4000),
      markdown: sanitizeDryRunText(`## Pre-flight Summary\n\nValidations run: ${preflights.length}. Status: ${preflights[0]?.preflightStatus ?? "not run"}`, 8000),
    },
    {
      sectionType: "gate_approval_summary",
      content: sanitizeDryRunText(`Gate approvals: ${gateApprovals.length}. Decisions: ${gateDecisions.length}. Last decision: ${gateDecisions[0]?.decisionType ?? "none"}`, 4000),
      markdown: sanitizeDryRunText(`## Gate Approval Summary\n\nApprovals: ${gateApprovals.length}. Decisions: ${gateDecisions.length}.`, 8000),
    },
    {
      sectionType: "planning_workspace_summary",
      content: sanitizeDryRunText(`Planning workspace: ${request.planningWorkspaceId}. Request status: ${request.requestStatus}`, 4000),
      markdown: sanitizeDryRunText(`## Planning Workspace Summary\n\nRequest status: ${request.requestStatus}`, 8000),
    },
    {
      sectionType: "change_set_summary",
      content: sanitizeDryRunText(`Change sets: ${changeSets.length}. Total simulated changes: ${changeSets.reduce((sum, cs) => sum + cs.simulatedChangeCount, 0)}`, 4000),
      markdown: sanitizeDryRunText(`## Change Set Summary\n\nChange sets: ${changeSets.length}. Simulated changes only.`, 8000),
    },
    {
      sectionType: "simulated_policy_version_summary",
      content: sanitizeDryRunText(`Simulated policy versions: ${simVersions.length}. These are NOT live policy versions.`, 4000),
      markdown: sanitizeDryRunText(`## Simulated Policy Version Summary\n\nVersions simulated: ${simVersions.length}. None are live.`, 8000),
    },
    {
      sectionType: "simulated_impact_summary",
      content: sanitizeDryRunText(`Simulated impacts: ${impacts.length} domains assessed. No actual system changes.`, 4000),
      markdown: sanitizeDryRunText(`## Simulated Impact Summary\n\nDomains assessed: ${impacts.length}. No runtime changes made.`, 8000),
    },
    {
      sectionType: "blocker_summary",
      content: sanitizeDryRunText(`Blockers: ${blockers.length} recorded. Open: ${blockers.filter(b => b.blockerStatus === "open").length}.`, 4000),
      markdown: sanitizeDryRunText(`## Blocker Summary\n\nTotal blockers: ${blockers.length}. Open: ${blockers.filter(b => b.blockerStatus === "open").length}.`, 8000),
    },
    {
      sectionType: "operator_review_summary",
      content: sanitizeDryRunText(`Operator reviews: ${reviews.length}. Last decision: ${reviews[0]?.reviewDecision ?? "none"}.`, 4000),
      markdown: sanitizeDryRunText(`## Operator Review Summary\n\nReviews recorded: ${reviews.length}.`, 8000),
    },
    {
      sectionType: "non_goals",
      content: "This dry-run does not apply policies, change routing, change scoring, execute adapters, or create external tickets.",
      markdown: "## Non-Goals\n\nThis dry-run does NOT: apply policies, activate policy versions, change review routing, change risk scoring, change evidence requirements, execute adapters, call external APIs, create Jira tickets, create GitHub issues, send communications, mutate projects, or execute rollback.",
    },
    {
      sectionType: "limitations",
      content: "Baseline policy state is unknown. Simulated impacts are deterministic estimates only. No real governance data was read.",
      markdown: "## Limitations\n\nBaseline policy state is unknown. Simulated impacts are deterministic estimates based on planning artifacts only. This is a conceptual simulation. No live governance data was read or mutated.",
    },
  ];

  const sections: AgentPmoDryRunEvidenceSectionRecord[] = [];
  for (const def of sectionDefs) {
    const section = await createAgentPmoDryRunEvidenceSection({
      workspaceId: input.workspaceId,
      evidencePackageId: pkg.id,
      dryRunRequestId: input.dryRunRequestId,
      sectionType: def.sectionType,
      safeSectionContent: def.content,
      safeMarkdown: def.markdown,
    });
    sections.push(section);
  }

  await updateAgentPmoDryRunEvidencePackageStatus(pkg.id, "assembled");

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    eventType: "dry_run_evidence_package_created",
    message: `Evidence package assembled with ${sections.length} sections. Safe summarized data only.`,
    actorId: input.actorId ?? null,
  });

  const assembled = await getAgentPmoDryRunEvidencePackageById(pkg.id);
  return { package: assembled ?? pkg, sections };
}

// ─── Blocker Recording ────────────────────────────────────────────────────────

export async function recordDryRunBlocker(input: {
  workspaceId: string;
  dryRunRequestId: string;
  blockerType: Parameters<typeof createAgentPmoDryRunBlocker>[0]["blockerType"];
  severity?: Parameters<typeof createAgentPmoDryRunBlocker>[0]["severity"];
  summary?: string;
  actorId?: string | null;
}): Promise<AgentPmoDryRunBlockerRecord> {
  const blocker = await createAgentPmoDryRunBlocker({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    blockerType: input.blockerType,
    severity: input.severity ?? "medium",
    summary: sanitizeDryRunText(input.summary ?? "", 2000),
  });

  if ((blocker.severity === "high" || blocker.severity === "critical") && blocker.blockerStatus === "open") {
    const request = await getAgentPmoDryRunExecutionRequestById(input.dryRunRequestId);
    if (request && request.workspaceId === input.workspaceId && request.requestStatus !== "archived") {
      await updateAgentPmoDryRunExecutionRequestStatus(input.dryRunRequestId, "blocked");
    }
  }

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    eventType: "dry_run_blocker_recorded",
    message: `Blocker recorded: ${input.blockerType} (severity: ${blocker.severity})`,
    actorId: input.actorId ?? null,
  });

  return blocker;
}

// ─── Operator Review ──────────────────────────────────────────────────────────

export async function recordDryRunOperatorReview(input: RecordAgentPmoDryRunOperatorReviewInput & { actorId?: string | null }): Promise<AgentPmoDryRunOperatorReviewRecord> {
  const normalized = normalizeDryRunOperatorReviewInput({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    evidencePackageId: input.evidencePackageId,
    reviewDecision: input.reviewDecision,
    reviewRationale: input.reviewRationale,
    reviewedBy: input.reviewedBy,
  });

  const review = await recordAgentPmoDryRunOperatorReview({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    evidencePackageId: normalized.evidencePackageId ?? null,
    reviewStatus: "accepted",
    reviewDecision: normalized.reviewDecision,
    reviewRationale: sanitizeDryRunText(normalized.reviewRationale ?? "", 4000),
    reviewedBy: normalized.reviewedBy ?? null,
  });

  await recordAgentPmoDryRunEvent({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    eventType: "dry_run_operator_review_recorded",
    message: `Operator review recorded: ${normalized.reviewDecision}. Accepting a dry-run result does not activate policy.`,
    actorId: input.actorId ?? null,
  });

  return review;
}

// ─── Dry-Run Decision ─────────────────────────────────────────────────────────

export async function recordDryRunDecision(input: RecordAgentPmoDryRunDecisionInput & { actorId?: string | null }): Promise<AgentPmoDryRunDecisionRecord> {
  const normalized = normalizeDryRunDecisionInput({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    decisionType: input.decisionType,
    rationale: input.rationale,
    decidedBy: input.decidedBy,
  });

  const dryRunRequest = await getAgentPmoDryRunExecutionRequestById(normalized.dryRunRequestId);
  if (!dryRunRequest) throw new Error("Dry-run execution request not found");
  if (dryRunRequest.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");

  const blockers = await listAgentPmoDryRunBlockers(normalized.workspaceId, normalized.dryRunRequestId);
  const openCriticalBlockers = blockers.filter(b => b.blockerStatus === "open" && b.severity === "critical");

  const decision = await recordAgentPmoDryRunDecision({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    decisionType: normalized.decisionType,
    decisionStatus: "recorded",
    rationale: normalized.rationale,
    decidedBy: normalized.decidedBy ?? null,
  });

  const requestStatusMap: Record<string, Parameters<typeof updateAgentPmoDryRunExecutionRequestStatus>[1]> = {
    pass_for_future_activation_planning: openCriticalBlockers.length > 0 ? "blocked" : "dry_run_completed",
    fail: "dry_run_failed",
    blocked: "blocked",
    request_changes: "ready_for_gate_review",
    archive: "archived",
  };
  await updateAgentPmoDryRunExecutionRequestStatus(normalized.dryRunRequestId, requestStatusMap[normalized.decisionType] ?? "dry_run_completed");

  await recordAgentPmoDryRunEvent({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    eventType: "dry_run_decision_recorded",
    message: `Dry-run decision recorded: ${normalized.decisionType}. pass_for_future_activation_planning does NOT activate policy.`,
    actorId: input.actorId ?? null,
  });

  return decision;
}

// ─── Export Generation ────────────────────────────────────────────────────────

export async function generateDryRunExport(input: GenerateAgentPmoDryRunExportInput & { actorId?: string | null }): Promise<AgentPmoDryRunExportRecord> {
  const normalized = normalizeDryRunExportInput({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    exportFormat: input.exportFormat,
    generatedBy: input.generatedBy,
  });

  const request = await getAgentPmoDryRunExecutionRequestById(normalized.dryRunRequestId);
  if (!request) throw new Error("Dry-run execution request not found");
  if (request.workspaceId !== normalized.workspaceId) throw new Error("Workspace mismatch");

  const preflights = await listAgentPmoDryRunPreflightValidations(normalized.workspaceId, normalized.dryRunRequestId);
  const gateApprovals = await listAgentPmoDryRunGateApprovals(normalized.workspaceId, normalized.dryRunRequestId);
  const changeSets = await listAgentPmoDryRunChangeSets(normalized.workspaceId, normalized.dryRunRequestId);
  const simVersions = await listAgentPmoSimulatedPolicyVersions(normalized.workspaceId, normalized.dryRunRequestId);
  const executions = await listAgentPmoDryRunSimulationExecutions(normalized.workspaceId, normalized.dryRunRequestId);
  const blockers = await listAgentPmoDryRunBlockers(normalized.workspaceId, normalized.dryRunRequestId);
  const decisions = await listAgentPmoDryRunDecisions(normalized.workspaceId, normalized.dryRunRequestId);

  const NON_GOALS_STATEMENT = "This dry-run does NOT apply policies, activate policy versions, change routing, change scoring, execute adapters, call external APIs, create tickets, send communications, mutate projects, or execute rollback.";
  const NO_LIVE_IMPL_STATEMENT = "No live implementation has occurred. This export is for dry-run evidence purposes only.";

  let content: string;
  if (normalized.exportFormat === "json") {
    content = JSON.stringify({
      requestId: normalized.dryRunRequestId,
      workspaceId: normalized.workspaceId,
      requestStatus: request.requestStatus,
      preflightCount: preflights.length,
      gateApprovalCount: gateApprovals.length,
      changeSetCount: changeSets.length,
      simulatedVersionCount: simVersions.length,
      executionCount: executions.length,
      blockerCount: blockers.length,
      decisionCount: decisions.length,
      lastDecision: decisions[0]?.decisionType ?? null,
      nonGoals: NON_GOALS_STATEMENT,
      noLiveImplementation: NO_LIVE_IMPL_STATEMENT,
    }, null, 2);
  } else if (normalized.exportFormat === "csv") {
    content = [
      "field,value",
      `requestId,${normalized.dryRunRequestId}`,
      `requestStatus,${request.requestStatus}`,
      `preflightCount,${preflights.length}`,
      `changeSetCount,${changeSets.length}`,
      `blockerCount,${blockers.length}`,
      `lastDecision,${decisions[0]?.decisionType ?? "none"}`,
    ].join("\n");
  } else {
    content = [
      "# Dry-Run Gate Export",
      "",
      `**Request ID:** ${normalized.dryRunRequestId}`,
      `**Status:** ${request.requestStatus}`,
      `**Pre-flight validations:** ${preflights.length}`,
      `**Gate approvals:** ${gateApprovals.length}`,
      `**Change sets (simulated):** ${changeSets.length}`,
      `**Simulated policy versions:** ${simVersions.length}`,
      `**Executions:** ${executions.length}`,
      `**Blockers:** ${blockers.length}`,
      `**Last decision:** ${decisions[0]?.decisionType ?? "none"}`,
      "",
      "## Non-Goals",
      NON_GOALS_STATEMENT,
      "",
      "## Statement",
      NO_LIVE_IMPL_STATEMENT,
    ].join("\n");
  }

  const safetyResult = validateDryRunExportSafety(content);
  if (!safetyResult.safe) {
    throw new Error(`Export safety validation failed. Blocked patterns detected: ${safetyResult.blockedPatterns.join(", ")}`);
  }

  const exportRecord = await createAgentPmoDryRunExport({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    exportFormat: normalized.exportFormat,
    exportStatus: "available",
    safeExportContent: content,
    safetyValidationPassed: safetyResult.safe,
    createdBy: normalized.generatedBy ?? null,
  });

  await recordAgentPmoDryRunEvent({
    workspaceId: normalized.workspaceId,
    dryRunRequestId: normalized.dryRunRequestId,
    eventType: "dry_run_export_created",
    message: `Dry-run export created in ${normalized.exportFormat} format. Safety validation passed.`,
    actorId: input.actorId ?? null,
  });

  return exportRecord;
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveDryRunExecutionRequest(input: {
  workspaceId: string;
  dryRunRequestId: string;
  rationale: string;
  actorId?: string | null;
}): Promise<AgentPmoDryRunExecutionRequestRecord> {
  if (!input.rationale?.trim()) throw new Error("Rationale is required to archive a dry-run request");

  const request = await getAgentPmoDryRunExecutionRequestById(input.dryRunRequestId);
  if (!request) throw new Error("Dry-run execution request not found");
  if (request.workspaceId !== input.workspaceId) throw new Error("Workspace mismatch");

  const updated = await updateAgentPmoDryRunExecutionRequestStatus(input.dryRunRequestId, "archived");

  await recordAgentPmoDryRunEvent({
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    eventType: "dry_run_request_archived",
    message: sanitizeDryRunText(`Dry-run request archived.`, 2000),
    actorId: input.actorId ?? null,
  });

  return updated ?? request;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function buildDryRunGateSummary(workspaceId: string): Promise<{
  totalRequests: number;
  preflightPending: number;
  preflightFailed: number;
  gateReviewRequired: number;
  gateApproved: number;
  dryRunCompleted: number;
  dryRunFailed: number;
  blocked: number;
  archived: number;
  changeSetCount: number;
  simulatedPolicyVersionCount: number;
  simulatedImpactCount: number;
  evidencePackageCount: number;
  openBlockerCount: number;
  criticalBlockerCount: number;
  operatorReviewCount: number;
  passDecisionCount: number;
}> {
  const requests = await listAgentPmoDryRunExecutionRequests(workspaceId);
  const changeSets = await listAgentPmoDryRunChangeSets(workspaceId);
  const simVersions = await listAgentPmoSimulatedPolicyVersions(workspaceId);
  const evidencePackages = await listAgentPmoDryRunEvidencePackages(workspaceId);
  const blockers = await listAgentPmoDryRunBlockers(workspaceId);
  const operatorReviews = await listAgentPmoDryRunOperatorReviews(workspaceId);
  const decisions = await listAgentPmoDryRunDecisions(workspaceId);

  const executions = await Promise.all(
    requests.map(r => listAgentPmoDryRunSimulationExecutions(workspaceId, r.id))
  );
  const allExecutions = executions.flat();
  const allImpacts = await Promise.all(
    allExecutions.map(e => listAgentPmoDryRunSimulatedImpacts(workspaceId, e.id))
  );

  return {
    totalRequests: requests.length,
    preflightPending: requests.filter(r => r.requestStatus === "preflight_pending").length,
    preflightFailed: requests.filter(r => r.requestStatus === "preflight_failed").length,
    gateReviewRequired: requests.filter(r => r.requestStatus === "gate_review_required").length,
    gateApproved: requests.filter(r => r.requestStatus === "gate_approved").length,
    dryRunCompleted: requests.filter(r => r.requestStatus === "dry_run_completed").length,
    dryRunFailed: requests.filter(r => r.requestStatus === "dry_run_failed").length,
    blocked: requests.filter(r => r.requestStatus === "blocked").length,
    archived: requests.filter(r => r.requestStatus === "archived").length,
    changeSetCount: changeSets.length,
    simulatedPolicyVersionCount: simVersions.length,
    simulatedImpactCount: allImpacts.flat().length,
    evidencePackageCount: evidencePackages.length,
    openBlockerCount: blockers.filter(b => b.blockerStatus === "open").length,
    criticalBlockerCount: blockers.filter(b => b.severity === "critical" && b.blockerStatus === "open").length,
    operatorReviewCount: operatorReviews.length,
    passDecisionCount: decisions.filter(d => d.decisionType === "pass_for_future_activation_planning").length,
  };
}

// ─── Get All Dry-Run Gate Data ────────────────────────────────────────────────

export async function getDryRunGateData(workspaceId: string, dryRunRequestId: string): Promise<{
  request: AgentPmoDryRunExecutionRequestRecord | null;
  preflightValidations: AgentPmoDryRunPreflightValidationRecord[];
  gateApprovals: AgentPmoDryRunGateApprovalRecord[];
  gateDecisions: AgentPmoDryRunGateDecisionRecord[];
  changeSets: AgentPmoDryRunChangeSetRecord[];
  changeSetItems: AgentPmoDryRunChangeSetItemRecord[];
  simulatedPolicyVersions: AgentPmoSimulatedPolicyVersionRecord[];
  simulationExecutions: AgentPmoDryRunSimulationExecutionRecord[];
  simulatedImpacts: AgentPmoDryRunSimulatedImpactRecord[];
  evidencePackages: AgentPmoDryRunEvidencePackageRecord[];
  evidenceSections: AgentPmoDryRunEvidenceSectionRecord[];
  blockers: AgentPmoDryRunBlockerRecord[];
  operatorReviews: AgentPmoDryRunOperatorReviewRecord[];
  decisions: AgentPmoDryRunDecisionRecord[];
  exports: AgentPmoDryRunExportRecord[];
  events: AgentPmoDryRunEventRecord[];
  summary: Awaited<ReturnType<typeof buildDryRunGateSummary>>;
}> {
  const request = await getAgentPmoDryRunExecutionRequestById(dryRunRequestId);
  if (!request || request.workspaceId !== workspaceId) throw new Error("Dry-run execution request not found");
  const preflightValidations = await listAgentPmoDryRunPreflightValidations(workspaceId, dryRunRequestId);
  const gateApprovals = await listAgentPmoDryRunGateApprovals(workspaceId, dryRunRequestId);
  const gateDecisions = await listAgentPmoDryRunGateDecisions(workspaceId, dryRunRequestId);
  const changeSets = await listAgentPmoDryRunChangeSets(workspaceId, dryRunRequestId);
  const changeSetItems = changeSets.length > 0
    ? await listAgentPmoDryRunChangeSetItems(workspaceId, changeSets[0].id)
    : [];
  const simulatedPolicyVersions = await listAgentPmoSimulatedPolicyVersions(workspaceId, dryRunRequestId);
  const simulationExecutions = await listAgentPmoDryRunSimulationExecutions(workspaceId, dryRunRequestId);
  const simulatedImpacts = simulationExecutions.length > 0
    ? await listAgentPmoDryRunSimulatedImpacts(workspaceId, simulationExecutions[0].id)
    : [];
  const evidencePackages = await listAgentPmoDryRunEvidencePackages(workspaceId, dryRunRequestId);
  const evidenceSections = evidencePackages.length > 0
    ? await listAgentPmoDryRunEvidenceSections(workspaceId, evidencePackages[0].id)
    : [];
  const blockers = await listAgentPmoDryRunBlockers(workspaceId, dryRunRequestId);
  const operatorReviews = await listAgentPmoDryRunOperatorReviews(workspaceId, dryRunRequestId);
  const decisions = await listAgentPmoDryRunDecisions(workspaceId, dryRunRequestId);
  const exports = await listAgentPmoDryRunExports(workspaceId, dryRunRequestId);
  const events = await listAgentPmoDryRunEvents(workspaceId, dryRunRequestId);
  const summary = await buildDryRunGateSummary(workspaceId);

  return {
    request,
    preflightValidations,
    gateApprovals,
    gateDecisions,
    changeSets,
    changeSetItems,
    simulatedPolicyVersions,
    simulationExecutions,
    simulatedImpacts,
    evidencePackages,
    evidenceSections,
    blockers,
    operatorReviews,
    decisions,
    exports,
    events,
    summary,
  };
}
