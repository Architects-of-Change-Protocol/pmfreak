// ─── PMO Governance Proposal Review & Controlled Policy Change Backlog — Service
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT mutate policies, routing, risk scoring, or project state.
// Does NOT apply policy changes — creates backlog/draft/simulation records only.
// Draft policies are NOT live policies.
// All operations are deterministic.

import type {
  AgentPmoPolicyBacklogItemRecord,
  AgentPmoPolicyChangeRequestRecord,
  AgentPmoPolicyChangeScopeRecord,
  AgentPmoPolicySimulationRecord,
  AgentPmoPolicyImpactPreviewRecord,
  AgentPmoGovernancePolicyDraftRecord,
  AgentPmoPolicyApprovalWorkflowRecord,
  AgentPmoPolicyApprovalDecisionRecord,
  AgentPmoPolicyImplementationReadinessRecord,
  AgentPmoPolicyRollbackPlanRecord,
  PolicyApprovalDecisionInput,
} from "./agent-pmo-policy-backlog-types";

import {
  derivePolicyChangeScopeType,
  derivePolicyImpactLevel,
  evaluatePolicyImplementationReadiness,
  sanitizePolicyBacklogText,
  dedupePolicyBacklogStrings,
  derivePolicyBacklogPriority,
} from "./agent-pmo-policy-backlog-validation";

import {
  createPolicyBacklogItem,
  getPolicyBacklogItemById,
  listPolicyBacklogItems,
  updatePolicyBacklogItemStatus,
  createPolicyChangeRequest,
  getPolicyChangeRequestById,
  listPolicyChangeRequests,
  updatePolicyChangeRequestStatus,
  createPolicyChangeScope,
  listPolicyChangeScopes,
  createPolicySimulation,
  getPolicySimulationById,
  listPolicySimulations,
  completePolicySimulation,
  createPolicyImpactPreview,
  listPolicyImpactPreviews,
  createVersionedPolicyDraft,
  listPolicyDrafts,
  createPolicyApprovalWorkflow,
  getPolicyApprovalWorkflowById,
  listPolicyApprovalWorkflows,
  updatePolicyApprovalWorkflowStage,
  recordPolicyApprovalDecision,
  listPolicyApprovalDecisions,
  createImplementationReadiness,
  getLatestImplementationReadiness,
  createPolicyRollbackPlan,
  listPolicyRollbackPlans,
  recordPolicyBacklogEvent,
  listPolicyBacklogEvents,
} from "./agent-pmo-policy-backlog-registry";

import {
  getPolicyProposalById,
} from "./agent-pmo-governance-dashboard-registry";

import {
  listAgentExecutionLearningSignals,
} from "./agent-execution-learning-registry";

// ─── Create Backlog Item from Approved Proposal ───────────────────────────────

export async function createPolicyBacklogItemFromProposal(input: {
  workspaceId: string;
  proposalId: string;
  actorId?: string | null;
}): Promise<AgentPmoPolicyBacklogItemRecord> {
  const proposal = await getPolicyProposalById(input.workspaceId, input.proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${input.proposalId}`);
  }
  if (proposal.status !== "approved_for_future_implementation") {
    throw new Error(
      `Proposal must be approved_for_future_implementation to create a backlog item. Current status: ${proposal.status}`,
    );
  }

  const signals = await listAgentExecutionLearningSignals(input.workspaceId);
  const sourceSignalCount = signals.length;
  const estimatedImpactLevel = derivePolicyImpactLevel({
    estimatedAffectedCount: sourceSignalCount,
    estimatedApprovalRateChange: 0,
    estimatedRejectionRateChange: 0,
  });
  const priority = derivePolicyBacklogPriority({
    itemType: proposal.proposalType as AgentPmoPolicyBacklogItemRecord["itemType"],
    estimatedImpactLevel,
    sourceSignalCount,
  });

  const item = await createPolicyBacklogItem({
    workspaceId: input.workspaceId,
    sourceProposalId: proposal.id,
    itemType: proposal.proposalType as AgentPmoPolicyBacklogItemRecord["itemType"],
    itemCategory: proposal.proposalCategory,
    priority,
    status: "open",
    title: sanitizePolicyBacklogText(`Policy Backlog: ${proposal.proposalType}`, 240),
    description: sanitizePolicyBacklogText(proposal.proposedChangeSummary, 2000),
    sourceSignalCount,
    sourceFeedbackIds: dedupePolicyBacklogStrings(proposal.sourceFeedbackIds ?? []),
    sourceSignalIds: dedupePolicyBacklogStrings(proposal.sourceSignalIds ?? []),
    estimatedImpactLevel,
    createdBy: input.actorId ?? null,
  });

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    backlogItemId: item.id,
    eventType: "policy_backlog_item_created",
    actorId: input.actorId ?? null,
  });

  return item;
}

// ─── Create Change Request from Backlog Item ──────────────────────────────────

export async function createPolicyChangeRequestFromBacklogItem(input: {
  workspaceId: string;
  backlogItemId: string;
  actorId?: string | null;
}): Promise<{
  changeRequest: AgentPmoPolicyChangeRequestRecord;
  scope: AgentPmoPolicyChangeScopeRecord;
}> {
  const item = await getPolicyBacklogItemById(input.workspaceId, input.backlogItemId);
  if (!item) {
    throw new Error(`Backlog item not found: ${input.backlogItemId}`);
  }

  const scopeType = derivePolicyChangeScopeType({ itemType: item.itemType });

  const changeRequest = await createPolicyChangeRequest({
    workspaceId: input.workspaceId,
    backlogItemId: item.id,
    status: "open",
    policyArea: item.itemType,
    changeSummary: sanitizePolicyBacklogText(item.description, 1000),
    changeRationale: sanitizePolicyBacklogText(
      `Backlog item of type ${item.itemType} promoted to change request for governance review.`,
      4000,
    ),
    estimatedImpactLevel: item.estimatedImpactLevel,
    createdBy: input.actorId ?? null,
  });

  const scope = await createPolicyChangeScope({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    scopeType,
    scopeDescription: sanitizePolicyBacklogText(`Scope for ${item.itemType} policy area.`, 500),
    affectedPolicyKeys: [],
    affectedAdapterKeys: dedupePolicyBacklogStrings(item.relatedAdapterKeys),
    estimatedRecordsAffected: item.sourceSignalCount,
  });

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    backlogItemId: item.id,
    changeRequestId: changeRequest.id,
    eventType: "policy_change_request_created",
    actorId: input.actorId ?? null,
  });

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    eventType: "policy_change_scope_created",
    actorId: input.actorId ?? null,
  });

  return { changeRequest, scope };
}

// ─── Run Policy Change Simulation (deterministic, no AI) ─────────────────────

export async function runPolicyChangeSimulation(input: {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoPolicySimulationRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) {
    throw new Error(`Change request not found: ${input.changeRequestId}`);
  }

  const signals = await listAgentExecutionLearningSignals(input.workspaceId);
  const signalCountUsed = signals.length;

  // Deterministic computation from historical signal counts
  const estimatedAffectedCount = Math.max(1, Math.floor(signalCountUsed * 0.35));
  const estimatedApprovalRateChange = signalCountUsed > 0
    ? Math.round(((signalCountUsed % 10) - 5) * 0.5 * 10) / 10
    : 0;
  const estimatedRejectionRateChange = signalCountUsed > 0
    ? Math.round(((signalCountUsed % 7) - 3) * 0.3 * 10) / 10
    : 0;
  const estimatedReviewVolumeChange = signalCountUsed > 0
    ? Math.round((signalCountUsed % 5) * 2.0 * 10) / 10
    : 0;

  const impactLevel = derivePolicyImpactLevel({
    estimatedAffectedCount,
    estimatedApprovalRateChange,
    estimatedRejectionRateChange,
  });

  const safeSimulationSummary = sanitizePolicyBacklogText(
    `Deterministic simulation for ${changeRequest.policyArea} policy area. ` +
    `Estimated ${estimatedAffectedCount} records affected. ` +
    `Approval rate change: ${estimatedApprovalRateChange}%. ` +
    `Rejection rate change: ${estimatedRejectionRateChange}%. ` +
    `Impact level: ${impactLevel}. ` +
    `No AI was used. This simulation is based on historical signal counts only.`,
    2000,
  );

  const simulation = await createPolicySimulation({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    status: "running",
    simulationLabel: `sim-${changeRequest.policyArea}-${Date.now()}`,
    signalCountUsed,
  });

  const completed = await completePolicySimulation(input.workspaceId, simulation.id, {
    estimatedAffectedCount,
    estimatedApprovalRateChange,
    estimatedRejectionRateChange,
    estimatedReviewVolumeChange,
    impactLevel,
    safeSimulationSummary,
  });

  // Update change request simulation count
  const currentSims = await listPolicySimulations(input.workspaceId, {
    changeRequestId: changeRequest.id,
    status: "completed",
  });
  await updatePolicyChangeRequestStatus(
    input.workspaceId,
    changeRequest.id,
    "simulation_completed",
    { simulationCount: currentSims.length },
  );

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    simulationId: simulation.id,
    eventType: "policy_simulation_created",
    actorId: input.actorId ?? null,
  });

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    simulationId: simulation.id,
    eventType: "policy_simulation_completed",
    actorId: input.actorId ?? null,
  });

  return completed ?? simulation;
}

// ─── Generate Policy Impact Preview ──────────────────────────────────────────

export async function generatePolicyImpactPreview(input: {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoPolicyImpactPreviewRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) {
    throw new Error(`Change request not found: ${input.changeRequestId}`);
  }

  const simulations = await listPolicySimulations(input.workspaceId, {
    changeRequestId: input.changeRequestId,
    status: "completed",
  });
  const latestSim = simulations[0] ?? null;

  const scopes = await listPolicyChangeScopes(input.workspaceId, input.changeRequestId);
  const affectedAreaCount = scopes.length;
  const estimatedSignalCount = latestSim?.signalCountUsed ?? 0;

  const impactLevel = latestSim?.impactLevel ?? changeRequest.estimatedImpactLevel;

  const deterministicSummary = sanitizePolicyBacklogText(
    `Impact preview for ${changeRequest.policyArea}. ` +
    `${affectedAreaCount} policy area(s) in scope. ` +
    `${estimatedSignalCount} historical signals used. ` +
    `Estimated impact level: ${impactLevel}. ` +
    `This preview is deterministic and does not involve AI or live policy changes.`,
    2000,
  );

  const safeImpactJson: Record<string, unknown> = {
    changeRequestId: changeRequest.id,
    policyArea: changeRequest.policyArea,
    impactLevel,
    affectedAreaCount,
    estimatedSignalCount,
    simulationCount: simulations.length,
    estimatedAffectedCount: latestSim?.estimatedAffectedCount ?? 0,
    estimatedApprovalRateChange: latestSim?.estimatedApprovalRateChange ?? 0,
    estimatedRejectionRateChange: latestSim?.estimatedRejectionRateChange ?? 0,
  };

  const preview = await createPolicyImpactPreview({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    simulationId: latestSim?.id ?? null,
    impactLevel,
    affectedAreaCount,
    estimatedSignalCount,
    deterministicSummary,
    safeImpactJson,
  });

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    simulationId: latestSim?.id ?? null,
    eventType: "policy_impact_preview_created",
    actorId: input.actorId ?? null,
  });

  return preview;
}

// ─── Create Versioned Governance Policy Draft (NOT a live policy) ─────────────

export async function createVersionedGovernancePolicyDraft(input: {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoGovernancePolicyDraftRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) {
    throw new Error(`Change request not found: ${input.changeRequestId}`);
  }

  const draftTypeMap: Record<string, AgentPmoGovernancePolicyDraftRecord["draftType"]> = {
    risk_policy: "risk_policy_draft",
    evidence_requirement: "evidence_requirement_draft",
    review_routing: "review_routing_draft",
    human_review_policy: "human_review_policy_draft",
    triage_policy: "triage_policy_draft",
    adapter_quality_review: "adapter_governance_draft",
    approval_policy: "approval_policy_draft",
    governance_process: "risk_policy_draft",
  };
  const draftType = draftTypeMap[changeRequest.policyArea] ?? "risk_policy_draft";

  const draftSummary = sanitizePolicyBacklogText(
    `DRAFT ONLY — NOT A LIVE POLICY. ` +
    `This is a non-live governance policy draft for ${changeRequest.policyArea}. ` +
    `It must not be applied, activated, or deployed without further PMO approval. ` +
    `Change summary: ${changeRequest.changeSummary}`,
    2000,
  );

  const draft = await createVersionedPolicyDraft({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    draftType,
    draftStatus: "created",
    draftTitle: sanitizePolicyBacklogText(`Draft: ${changeRequest.policyArea} policy`, 240),
    draftSummary,
    createdBy: input.actorId ?? null,
  });

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    draftId: draft.id,
    eventType: "policy_draft_created",
    actorId: input.actorId ?? null,
  });

  return draft;
}

// ─── Create Policy Approval Workflow ──────────────────────────────────────────

export async function createPolicyApprovalWorkflowForRequest(input: {
  workspaceId: string;
  changeRequestId: string;
  requiredStages?: AgentPmoPolicyApprovalWorkflowRecord["requiredStages"];
  actorId?: string | null;
}): Promise<AgentPmoPolicyApprovalWorkflowRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) {
    throw new Error(`Change request not found: ${input.changeRequestId}`);
  }

  const requiredStages = input.requiredStages ?? ["pmo_review", "final_pmo_approval"];

  const workflow = await createPolicyApprovalWorkflow({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    currentStage: requiredStages[0] ?? "pmo_review",
    overallStatus: "pending",
    requiredStages,
    createdBy: input.actorId ?? null,
  });

  await updatePolicyChangeRequestStatus(
    input.workspaceId,
    changeRequest.id,
    "approval_pending",
    { approvalWorkflowId: workflow.id },
  );

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    workflowId: workflow.id,
    eventType: "policy_approval_workflow_created",
    actorId: input.actorId ?? null,
  });

  return workflow;
}

// ─── Record Approval Decision ─────────────────────────────────────────────────

export async function recordPolicyApprovalDecisionForWorkflow(
  input: PolicyApprovalDecisionInput,
): Promise<AgentPmoPolicyApprovalDecisionRecord> {
  const workflow = await getPolicyApprovalWorkflowById(input.workspaceId, input.workflowId);
  if (!workflow) {
    throw new Error(`Approval workflow not found: ${input.workflowId}`);
  }

  const statusMap: Record<AgentPmoPolicyApprovalDecisionRecord["decisionType"], AgentPmoPolicyApprovalDecisionRecord["status"]> = {
    approve: "approved",
    reject: "rejected",
    request_changes: "changes_requested",
    skip: "skipped",
    cancel: "cancelled",
  };

  const status = statusMap[input.decisionType];

  const decision = await recordPolicyApprovalDecision({
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    stage: input.stage,
    decisionType: input.decisionType,
    status,
    decidedBy: input.decidedBy ?? null,
    decisionNote: input.decisionNote ?? null,
  });

  // Advance workflow
  let newOverallStatus: AgentPmoPolicyApprovalWorkflowRecord["overallStatus"] = workflow.overallStatus;
  let nextStage = workflow.currentStage;
  if (input.decisionType === "reject") {
    newOverallStatus = "rejected";
  } else if (input.decisionType === "cancel") {
    newOverallStatus = "cancelled";
  } else if (input.decisionType === "approve" || input.decisionType === "skip") {
    const completedStages = [...workflow.completedStages, input.stage];
    const remainingStages = workflow.requiredStages.filter(
      (s) => !completedStages.includes(s),
    );
    if (remainingStages.length === 0) {
      newOverallStatus = "approved";
    } else {
      nextStage = remainingStages[0];
    }
  }

  await updatePolicyApprovalWorkflowStage(
    input.workspaceId,
    input.workflowId,
    nextStage,
    newOverallStatus,
    input.decisionType === "approve" || input.decisionType === "skip" ? input.stage : undefined,
  );

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    changeRequestId: workflow.changeRequestId,
    eventType: "policy_approval_decision_recorded",
    actorId: input.decidedBy ?? null,
  });

  return decision;
}

// ─── Evaluate Policy Implementation Readiness ─────────────────────────────────

export async function evaluatePolicyImplementationReadinessForRequest(input: {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoPolicyImplementationReadinessRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) {
    throw new Error(`Change request not found: ${input.changeRequestId}`);
  }

  const simulations = await listPolicySimulations(input.workspaceId, {
    changeRequestId: input.changeRequestId,
    status: "completed",
  });
  const simulationCompleted = simulations.length > 0;

  const workflows = await listPolicyApprovalWorkflows(input.workspaceId, {
    changeRequestId: input.changeRequestId,
  });
  const approvalCompleted = workflows.some((w) => w.overallStatus === "approved");

  const rollbackPlans = await listPolicyRollbackPlans(input.workspaceId, {
    changeRequestId: input.changeRequestId,
  });
  const rollbackPlanPresent = rollbackPlans.length > 0;

  const blockedReasons: string[] = [];
  if (!simulationCompleted) blockedReasons.push("No completed simulation found.");
  if (!approvalCompleted) blockedReasons.push("No approved workflow found.");
  if (!rollbackPlanPresent) blockedReasons.push("No rollback plan found.");

  const readinessStatus = evaluatePolicyImplementationReadiness({
    simulationCompleted,
    approvalCompleted,
    rollbackPlanPresent,
    blockedReasons: [],
  });

  const readiness = await createImplementationReadiness({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    readinessStatus,
    simulationCompleted,
    approvalCompleted,
    rollbackPlanPresent,
    blockedReasons,
  });

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    eventType: "policy_implementation_readiness_evaluated",
    actorId: input.actorId ?? null,
  });

  return readiness;
}

// ─── Create Rollback Plan ─────────────────────────────────────────────────────

export async function createGovernancePolicyRollbackPlan(input: {
  workspaceId: string;
  changeRequestId: string;
  planType: AgentPmoPolicyRollbackPlanRecord["planType"];
  planDescription?: string;
  affectedPolicyKeys?: string[];
  estimatedRollbackMinutes?: number;
  actorId?: string | null;
}): Promise<AgentPmoPolicyRollbackPlanRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) {
    throw new Error(`Change request not found: ${input.changeRequestId}`);
  }

  const plan = await createPolicyRollbackPlan({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    planType: input.planType,
    planStatus: "created",
    planDescription: sanitizePolicyBacklogText(
      input.planDescription ?? `Rollback plan for ${changeRequest.policyArea} policy change.`,
      2000,
    ),
    affectedPolicyKeys: dedupePolicyBacklogStrings(input.affectedPolicyKeys ?? []),
    estimatedRollbackMinutes: input.estimatedRollbackMinutes ?? 30,
    createdBy: input.actorId ?? null,
  });

  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: changeRequest.id,
    eventType: "policy_rollback_plan_created",
    actorId: input.actorId ?? null,
  });

  return plan;
}

// ─── Archive Change Request ───────────────────────────────────────────────────

export async function archivePolicyChangeRequest(input: {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoPolicyChangeRequestRecord> {
  const updated = await updatePolicyChangeRequestStatus(
    input.workspaceId,
    input.changeRequestId,
    "archived",
  );
  if (!updated) {
    throw new Error(`Change request not found: ${input.changeRequestId}`);
  }
  await recordPolicyBacklogEvent({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    eventType: "policy_change_request_archived",
    actorId: input.actorId ?? null,
  });
  return updated;
}

// ─── Full Backlog Summary ──────────────────────────────────────────────────────

export async function buildPolicyBacklogSummary(workspaceId: string): Promise<Record<string, unknown>> {
  const items = await listPolicyBacklogItems(workspaceId, { limit: 100 });
  const changeRequests = await listPolicyChangeRequests(workspaceId, { limit: 100 });
  const drafts = await listPolicyDrafts(workspaceId, { limit: 100 });
  const workflows = await listPolicyApprovalWorkflows(workspaceId, { limit: 100 });
  const simulations = await listPolicySimulations(workspaceId, { limit: 100 });

  return {
    totalBacklogItems: items.length,
    openBacklogItems: items.filter((i) => i.status === "open").length,
    urgentBacklogItems: items.filter((i) => i.priority === "urgent").length,
    totalChangeRequests: changeRequests.length,
    openChangeRequests: changeRequests.filter((r) => r.status === "open").length,
    simulationsCompleted: simulations.filter((s) => s.status === "completed").length,
    draftCount: drafts.length,
    approvedWorkflows: workflows.filter((w) => w.overallStatus === "approved").length,
    pendingWorkflows: workflows.filter((w) => w.overallStatus === "pending").length,
    approvedForFutureImplementation: items.filter(
      (i) => i.status === "approved_for_future_implementation",
    ).length,
  };
}

// ─── Get Full Backlog Data ────────────────────────────────────────────────────

export async function getPolicyBacklogData(input: {
  workspaceId: string;
  actorId?: string | null;
}): Promise<{
  backlogItems: AgentPmoPolicyBacklogItemRecord[];
  changeRequests: AgentPmoPolicyChangeRequestRecord[];
  simulations: AgentPmoPolicySimulationRecord[];
  drafts: AgentPmoGovernancePolicyDraftRecord[];
  workflows: AgentPmoPolicyApprovalWorkflowRecord[];
  summary: Record<string, unknown>;
}> {
  const [backlogItems, changeRequests, simulations, drafts, workflows, summary] = await Promise.all([
    listPolicyBacklogItems(input.workspaceId),
    listPolicyChangeRequests(input.workspaceId),
    listPolicySimulations(input.workspaceId),
    listPolicyDrafts(input.workspaceId),
    listPolicyApprovalWorkflows(input.workspaceId),
    buildPolicyBacklogSummary(input.workspaceId),
  ]);

  return { backlogItems, changeRequests, simulations, drafts, workflows, summary };
}

export {
  getPolicyBacklogItemById,
  getPolicyChangeRequestById,
  getPolicySimulationById,
  getPolicyApprovalWorkflowById,
  listPolicyBacklogItems,
  listPolicyChangeRequests,
  listPolicySimulations,
  listPolicyDrafts,
  listPolicyApprovalWorkflows,
  listPolicyApprovalDecisions,
  listPolicyImpactPreviews,
  listPolicyRollbackPlans,
  listPolicyBacklogEvents,
};
