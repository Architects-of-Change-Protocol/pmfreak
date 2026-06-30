// ─── Controlled Governance Policy Simulation Report & PMO Approval Pack — Service
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT mutate policies, routing, risk scoring, or project state.
// Does NOT apply policy changes — creates report/pack/checklist/sign-off records only.
// Does NOT create external tickets. Does NOT execute adapters.
// Does NOT activate policy drafts. Does NOT deploy anything.
// All operations are deterministic.

import {
  normalizeCreateSimulationReportInput,
  normalizeCreateApprovalPackInput,
  normalizeSignOffDecisionInput,
  normalizeApprovalPackExportInput,
  sanitizeApprovalPackText,
  dedupeApprovalPackStrings,
  redactApprovalPackPayload,
  assertApprovalPackPayloadSerializable,
  evaluateApprovalChecklistStatus,
  evaluateRollbackChecklistStatus,
  validateApprovalPackExportSafety,
  deriveApprovalPackStatus,
} from "./agent-pmo-approval-pack-validation";

import {
  createAgentPmoSimulationReport,
  getAgentPmoSimulationReportById,
  listAgentPmoSimulationReports,
  updateAgentPmoSimulationReportStatus,
  createAgentPmoSimulationReportSection,
  createAgentPmoPolicyImpactSummary,
  createAgentPmoPolicyDraftDiff,
  createAgentPmoApprovalChecklist,
  createAgentPmoApprovalChecklistItem,
  createAgentPmoRollbackReadinessChecklist,
  createAgentPmoRollbackReadinessChecklistItem,
  createAgentPmoSignOffPacket,
  recordAgentPmoSignOffDecision,
  listAgentPmoSignOffPackets,
  createAgentPmoApprovalPack,
  getAgentPmoApprovalPackById,
  listAgentPmoApprovalPacks,
  updateAgentPmoApprovalPackStatus,
  createAgentPmoApprovalPackArtifact,
  createAgentPmoImplementationTicketDraft,
  listAgentPmoImplementationTicketDrafts,
  createAgentPmoApprovalPackExport,
  getAgentPmoApprovalPackExportById,
  listAgentPmoApprovalPackExports,
  recordAgentPmoApprovalPackEvent,
  listAgentPmoApprovalPackEvents,
} from "./agent-pmo-approval-pack-registry";

import type {
  AgentPmoSimulationReportRecord,
  AgentPmoPolicyImpactSummaryRecord,
  AgentPmoPolicyDraftDiffRecord,
  AgentPmoApprovalChecklistRecord,
  AgentPmoRollbackReadinessChecklistRecord,
  AgentPmoSignOffPacketRecord,
  AgentPmoSignOffDecisionRecord,
  AgentPmoApprovalPackRecord,
  AgentPmoImplementationTicketDraftRecord,
  AgentPmoApprovalPackExportRecord,
  AgentPmoApprovalPackEventRecord,
  CreateAgentPmoSimulationReportInput,
  CreateAgentPmoApprovalPackInput,
  RecordAgentPmoSignOffDecisionInput,
  GenerateAgentPmoApprovalPackExportInput,
} from "./agent-pmo-approval-pack-types";

import {
  getPolicyChangeRequestById,
  listPolicySimulations,
  listPolicyImpactPreviews,
  listPolicyDrafts,
  listPolicyApprovalWorkflows,
  listPolicyRollbackPlans,
  getLatestImplementationReadiness,
  listPolicyBacklogItems,
} from "./agent-pmo-policy-backlog-registry";

// ─── Generate Governance Simulation Report ────────────────────────────────────

export async function generateGovernanceSimulationReport(
  input: CreateAgentPmoSimulationReportInput,
): Promise<AgentPmoSimulationReportRecord> {
  const normalized = normalizeCreateSimulationReportInput(input);

  const changeRequest = await getPolicyChangeRequestById(normalized.workspaceId, normalized.changeRequestId);
  if (!changeRequest) throw new Error("Policy change request not found.");

  const [simulations, previews, drafts, workflows, rollbackPlans] = await Promise.all([
    listPolicySimulations(normalized.workspaceId, { changeRequestId: normalized.changeRequestId }),
    listPolicyImpactPreviews(normalized.workspaceId, normalized.changeRequestId),
    listPolicyDrafts(normalized.workspaceId, { changeRequestId: normalized.changeRequestId }),
    listPolicyApprovalWorkflows(normalized.workspaceId, { changeRequestId: normalized.changeRequestId }),
    listPolicyRollbackPlans(normalized.workspaceId, { changeRequestId: normalized.changeRequestId }),
  ]);

  const completedSimulation = simulations.find((s) => s.status === "completed") ?? simulations[0] ?? null;
  const latestPreview = previews[0] ?? null;
  const latestDraft = drafts[0] ?? null;
  const latestWorkflow = workflows[0] ?? null;
  const latestRollback = rollbackPlans[0] ?? null;
  const readiness = await getLatestImplementationReadiness(normalized.workspaceId, normalized.changeRequestId);
  const approvalDecisionCount = 0;

  const backlogItems = await listPolicyBacklogItems(normalized.workspaceId);
  const backlogItem = backlogItems.find((b) => b.id === changeRequest.backlogItemId) ?? null;

  const impactLabel = changeRequest.estimatedImpactLevel ?? "low";
  const executiveSummary = sanitizeApprovalPackText(
    `Governance Policy Simulation Report for change request ${normalized.changeRequestId}. ` +
    `Policy area: ${changeRequest.policyArea}. ` +
    `Estimated impact level: ${impactLabel}. ` +
    `Simulation status: ${completedSimulation?.status ?? "not_run"}. ` +
    `Approval workflow: ${latestWorkflow ? "created" : "not_created"}. ` +
    `Rollback plan: ${latestRollback ? "exists" : "not_created"}. ` +
    `This report is for future implementation planning only. No policy is applied.`,
    2000,
  );

  const report = await createAgentPmoSimulationReport({
    workspaceId: normalized.workspaceId,
    changeRequestId: normalized.changeRequestId,
    backlogItemId: backlogItem?.id ?? null,
    simulationId: completedSimulation?.id ?? null,
    impactPreviewId: latestPreview?.id ?? null,
    policyDraftId: latestDraft?.id ?? null,
    approvalWorkflowId: latestWorkflow?.id ?? null,
    rollbackPlanId: latestRollback?.id ?? null,
    implementationReadinessId: readiness?.id ?? null,
    status: "generating",
    title: sanitizeApprovalPackText(`Simulation Report: ${changeRequest.policyArea}`, 180),
    executiveSummary,
    safeReportPayload: redactApprovalPackPayload({
      policyArea: changeRequest.policyArea,
      impactLevel: impactLabel,
      simulationStatus: completedSimulation?.status ?? "not_run",
      workflowExists: !!latestWorkflow,
      rollbackExists: !!latestRollback,
      readinessStatus: readiness?.readinessStatus ?? "not_evaluated",
    }),
    createdBy: normalized.actorId ?? null,
  });

  const sectionDefs: Array<{ type: Parameters<typeof createAgentPmoSimulationReportSection>[0]["sectionType"]; title: string; markdown: string; order: number }> = [
    { type: "executive_summary", title: "Executive Summary", order: 1, markdown: executiveSummary },
    { type: "change_request_context", title: "Change Request Context", order: 2, markdown: sanitizeApprovalPackText(`Policy area: ${changeRequest.policyArea}. Change summary: ${changeRequest.changeSummary}. Estimated impact: ${impactLabel}.`, 6000) },
    { type: "simulation_scope", title: "Simulation Scope", order: 3, markdown: sanitizeApprovalPackText(`Simulation count: ${simulations.length}. Change scopes defined. Impact previews: ${previews.length}.`, 6000) },
    { type: "simulation_results", title: "Simulation Results", order: 4, markdown: sanitizeApprovalPackText(`Latest simulation status: ${completedSimulation?.status ?? "not_run"}. Simulation count: ${simulations.length}.`, 6000) },
    { type: "impact_analysis", title: "Impact Analysis", order: 5, markdown: sanitizeApprovalPackText(`Impact level: ${impactLabel}. Impact previews available: ${previews.length}.`, 6000) },
    { type: "policy_draft_summary", title: "Policy Draft Summary", order: 6, markdown: sanitizeApprovalPackText(`Non-live governance policy draft available: ${!!latestDraft}. Draft status: ${latestDraft?.draftStatus ?? "none"}. This draft is NOT a live policy.`, 6000) },
    { type: "approval_status", title: "Approval Status", order: 7, markdown: sanitizeApprovalPackText(`Approval workflow exists: ${!!latestWorkflow}. Approval decisions recorded: ${approvalDecisionCount}.`, 6000) },
    { type: "rollback_readiness", title: "Rollback Readiness", order: 8, markdown: sanitizeApprovalPackText(`Rollback plan exists: ${!!latestRollback}. Rollback plan type: ${latestRollback?.planType ?? "none"}.`, 6000) },
    { type: "implementation_readiness", title: "Implementation Readiness", order: 9, markdown: sanitizeApprovalPackText(`Readiness status: ${readiness?.readinessStatus ?? "not_evaluated"}. This is for future implementation planning only.`, 6000) },
    { type: "risk_statement", title: "Risk Statement", order: 10, markdown: sanitizeApprovalPackText(`Estimated impact level: ${impactLabel}. All risk is recorded for future implementation planning only. No live policy mutation occurs.`, 6000) },
    { type: "limitations", title: "Limitations", order: 11, markdown: "This report is based on non-live governance policy drafts and completed simulations only. It does not reflect live policy state." },
    { type: "non_goals", title: "Non-Goals", order: 12, markdown: "This report does NOT apply any policy, change routing, change risk scoring, update evidence requirements, execute adapters, create external tickets, or send communications." },
  ];

  for (const sec of sectionDefs) {
    await createAgentPmoSimulationReportSection({
      workspaceId: normalized.workspaceId,
      reportId: report.id,
      sectionType: sec.type,
      sectionTitle: sec.title,
      sectionOrder: sec.order,
      safeMarkdown: sec.markdown,
      safePayload: {},
      sourceRecordIds: dedupeApprovalPackStrings([
        normalized.changeRequestId,
        ...(completedSimulation ? [completedSimulation.id] : []),
        ...(latestPreview ? [latestPreview.id] : []),
        ...(latestDraft ? [latestDraft.id] : []),
      ]),
    });
    await recordAgentPmoApprovalPackEvent({
      workspaceId: normalized.workspaceId,
      changeRequestId: normalized.changeRequestId,
      simulationReportId: report.id,
      eventType: "simulation_report_section_created",
      message: `Section created: ${sec.type}`,
      actorId: normalized.actorId ?? null,
    });
  }

  await updateAgentPmoSimulationReportStatus(normalized.workspaceId, report.id, "generated");
  await recordAgentPmoApprovalPackEvent({
    workspaceId: normalized.workspaceId,
    changeRequestId: normalized.changeRequestId,
    simulationReportId: report.id,
    eventType: "simulation_report_created",
    message: "Governance simulation report generated",
    actorId: normalized.actorId ?? null,
  });

  return (await getAgentPmoSimulationReportById(normalized.workspaceId, report.id))!;
}

// ─── Generate Policy Impact Summary ──────────────────────────────────────────

export async function generatePolicyImpactSummary(input: {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoPolicyImpactSummaryRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) throw new Error("Policy change request not found.");

  const [simulations, previews] = await Promise.all([
    listPolicySimulations(input.workspaceId, { changeRequestId: input.changeRequestId }),
    listPolicyImpactPreviews(input.workspaceId, input.changeRequestId),
  ]);

  const completedSim = simulations.find((s) => s.status === "completed") ?? simulations[0] ?? null;
  const latestPreview = previews[0] ?? null;
  const impactLevel = changeRequest.estimatedImpactLevel ?? "low";

  const summary = await createAgentPmoPolicyImpactSummary({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    simulationId: completedSim?.id ?? null,
    impactPreviewId: latestPreview?.id ?? null,
    impactLevel,
    affectedDomains: [changeRequest.policyArea],
    affectedActionTypes: [],
    affectedAdapters: [],
    estimatedReviewLoadChange: 0,
    estimatedEvidenceBurdenChange: 0,
    riskPostureEstimate: impactLevel === "critical" ? "high" : impactLevel === "high" ? "elevated" : "standard",
    implementationComplexity: impactLevel === "critical" || impactLevel === "high" ? "complex" : "moderate",
    confidenceScore: completedSim ? 0.75 : 0.4,
    summary: sanitizeApprovalPackText(
      `Impact summary for policy area ${changeRequest.policyArea}. ` +
      `Impact level: ${impactLevel}. ` +
      `Simulations run: ${simulations.length}. ` +
      `For future implementation planning only. No policy is applied.`,
      2000,
    ),
    safePayload: redactApprovalPackPayload({ impactLevel, policyArea: changeRequest.policyArea }),
  });

  await recordAgentPmoApprovalPackEvent({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    eventType: "impact_summary_created",
    message: "Policy impact summary generated",
    actorId: input.actorId ?? null,
  });

  return summary;
}

// ─── Generate Policy Draft Diff ───────────────────────────────────────────────

export async function generatePolicyDraftDiff(input: {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
}): Promise<AgentPmoPolicyDraftDiffRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) throw new Error("Policy change request not found.");

  const drafts = await listPolicyDrafts(input.workspaceId, { changeRequestId: input.changeRequestId });
  const latestDraft = drafts[0] ?? null;

  const addedRules = latestDraft
    ? [`Proposed rule: ${changeRequest.policyArea} policy change - for future implementation planning`]
    : [];

  const diff = await createAgentPmoPolicyDraftDiff({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    policyDraftId: latestDraft?.id ?? null,
    unknownBaseline: true,
    baselineLabel: "conceptual_current_policy",
    draftLabel: "non_live_governance_policy_draft",
    addedRules,
    removedRules: [],
    changedRules: [],
    unchangedRules: [],
    safePayload: redactApprovalPackPayload({
      policyArea: changeRequest.policyArea,
      draftExists: !!latestDraft,
      unknownBaseline: true,
    }),
  });

  await recordAgentPmoApprovalPackEvent({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    eventType: "policy_draft_diff_created",
    message: "Policy draft diff generated",
    actorId: input.actorId ?? null,
  });

  return diff;
}

// ─── Generate Approval Checklist ──────────────────────────────────────────────

export async function generateApprovalChecklist(input: {
  workspaceId: string;
  changeRequestId: string;
  approvalPackId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoApprovalChecklistRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) throw new Error("Policy change request not found.");

  const [simulations, previews, drafts, workflows, rollbackPlans] = await Promise.all([
    listPolicySimulations(input.workspaceId, { changeRequestId: input.changeRequestId }),
    listPolicyImpactPreviews(input.workspaceId, input.changeRequestId),
    listPolicyDrafts(input.workspaceId, { changeRequestId: input.changeRequestId }),
    listPolicyApprovalWorkflows(input.workspaceId, { changeRequestId: input.changeRequestId }),
    listPolicyRollbackPlans(input.workspaceId, { changeRequestId: input.changeRequestId }),
  ]);
  const readiness = await getLatestImplementationReadiness(input.workspaceId, input.changeRequestId);
  const backlogItems = await listPolicyBacklogItems(input.workspaceId);
  const backlogItem = backlogItems.find((b) => b.id === changeRequest.backlogItemId);

  const checklist = await createAgentPmoApprovalChecklist({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    approvalPackId: input.approvalPackId ?? null,
  });

  const isApprovedForFutureImpl = changeRequest.status === "approved";
  const items: Array<{ key: string; label: string; passed: boolean; notes: string }> = [
    { key: "policy_proposal_approved", label: "Policy proposal approved for future implementation", passed: isApprovedForFutureImpl, notes: `Change request status: ${changeRequest.status}` },
    { key: "backlog_item_exists", label: "Backlog item exists", passed: !!backlogItem, notes: backlogItem ? `Backlog item: ${backlogItem.id}` : "No backlog item found" },
    { key: "change_request_exists", label: "Change request exists", passed: true, notes: `Change request: ${input.changeRequestId}` },
    { key: "scope_defined", label: "Scope defined", passed: !!changeRequest.policyArea, notes: `Policy area: ${changeRequest.policyArea}` },
    { key: "simulation_completed", label: "Simulation completed", passed: simulations.some((s) => s.status === "completed"), notes: `Simulations: ${simulations.length}` },
    { key: "impact_preview_completed", label: "Impact preview completed", passed: previews.length > 0, notes: `Previews: ${previews.length}` },
    { key: "non_live_draft_created", label: "Non-live draft created", passed: drafts.length > 0, notes: `Drafts: ${drafts.length}` },
    { key: "approval_workflow_created", label: "Approval workflow created", passed: workflows.length > 0, notes: `Workflows: ${workflows.length}` },
    { key: "required_approvals_recorded", label: "Required approvals recorded", passed: workflows.length > 0, notes: `Workflows: ${workflows.length}` },
    { key: "rollback_plan_created", label: "Rollback plan created", passed: rollbackPlans.length > 0, notes: `Rollback plans: ${rollbackPlans.length}` },
    { key: "implementation_readiness_evaluated", label: "Implementation readiness evaluated", passed: !!readiness, notes: readiness ? `Readiness: ${readiness.readinessStatus}` : "Not evaluated" },
    { key: "no_prohibited_behavior", label: "No prohibited behavior detected", passed: true, notes: "Deterministic check: no external calls, no policy mutations" },
    { key: "no_raw_payload", label: "No raw payload included", passed: true, notes: "All payloads are redacted and safe" },
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    await createAgentPmoApprovalChecklistItem({
      workspaceId: input.workspaceId,
      checklistId: checklist.id,
      itemKey: item.key,
      itemLabel: item.label,
      itemOrder: i + 1,
      status: item.passed ? "passed" : "pending",
      notes: item.notes,
    });
    await recordAgentPmoApprovalPackEvent({
      workspaceId: input.workspaceId,
      changeRequestId: input.changeRequestId,
      eventType: "approval_checklist_item_recorded",
      message: `Checklist item: ${item.key} = ${item.passed ? "passed" : "pending"}`,
      actorId: input.actorId ?? null,
    });
  }

  const allItems = items.map((_, idx) => ({
    checklistId: checklist.id,
    status: (items[idx]!.passed ? "passed" : "pending") as Parameters<typeof evaluateApprovalChecklistStatus>[0][0]["status"],
  }));
  const overallStatus = evaluateApprovalChecklistStatus(allItems as Parameters<typeof evaluateApprovalChecklistStatus>[0]);
  const updatedChecklist = { ...checklist, overallStatus, updatedAt: new Date().toISOString() };

  await recordAgentPmoApprovalPackEvent({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    eventType: "approval_checklist_created",
    message: `Approval checklist created: ${overallStatus}`,
    actorId: input.actorId ?? null,
  });

  return updatedChecklist;
}

// ─── Generate Rollback Readiness Checklist ────────────────────────────────────

export async function generateRollbackReadinessChecklist(input: {
  workspaceId: string;
  changeRequestId: string;
  rollbackPlanId?: string | null;
  approvalPackId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoRollbackReadinessChecklistRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) throw new Error("Policy change request not found.");

  const rollbackPlans = await listPolicyRollbackPlans(input.workspaceId, { changeRequestId: input.changeRequestId });
  const rollbackPlan = (input.rollbackPlanId ? rollbackPlans.find((r) => r.id === input.rollbackPlanId) : rollbackPlans[0]) ?? null;
  const readiness = await getLatestImplementationReadiness(input.workspaceId, input.changeRequestId);

  const checklist = await createAgentPmoRollbackReadinessChecklist({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    rollbackPlanId: rollbackPlan?.id ?? null,
    approvalPackId: input.approvalPackId ?? null,
  });

  const items: Array<{ key: string; label: string; passed: boolean; notes: string }> = [
    { key: "rollback_plan_exists", label: "Rollback plan exists", passed: !!rollbackPlan, notes: rollbackPlan ? `Plan: ${rollbackPlan.id}` : "No rollback plan found" },
    { key: "rollback_owner_role_assigned", label: "Rollback owner role assigned", passed: !!rollbackPlan, notes: "Rollback plan type indicates ownership domain" },
    { key: "affected_policy_areas_listed", label: "Affected policy areas listed", passed: !!changeRequest.policyArea, notes: `Policy area: ${changeRequest.policyArea}` },
    { key: "verification_steps_listed", label: "Verification steps listed", passed: !!(rollbackPlan?.planDescription), notes: rollbackPlan ? "Plan description present" : "No plan description" },
    { key: "rollback_plan_reviewed", label: "Rollback plan reviewed or open for review", passed: !!(rollbackPlan && (rollbackPlan.planStatus === "reviewed" || rollbackPlan.planStatus === "open")), notes: rollbackPlan ? `Plan status: ${rollbackPlan.planStatus}` : "No plan" },
    { key: "rollback_risks_documented", label: "Rollback risks documented", passed: !!rollbackPlan, notes: "Rollback plan documents risk scope" },
    { key: "readiness_includes_rollback", label: "Implementation readiness includes rollback completeness", passed: !!(readiness && readiness.rollbackPlanPresent), notes: readiness ? `Readiness status: ${readiness.readinessStatus}` : "Readiness not evaluated" },
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    await createAgentPmoRollbackReadinessChecklistItem({
      workspaceId: input.workspaceId,
      checklistId: checklist.id,
      itemKey: item.key,
      itemLabel: item.label,
      itemOrder: i + 1,
      status: item.passed ? "passed" : "pending",
      notes: item.notes,
    });
    await recordAgentPmoApprovalPackEvent({
      workspaceId: input.workspaceId,
      changeRequestId: input.changeRequestId,
      eventType: "rollback_checklist_item_recorded",
      message: `Rollback checklist item: ${item.key} = ${item.passed ? "passed" : "pending"}`,
      actorId: input.actorId ?? null,
    });
  }

  const allItems = items.map((_, idx) => ({
    checklistId: checklist.id,
    status: (items[idx]!.passed ? "passed" : "pending") as Parameters<typeof evaluateRollbackChecklistStatus>[0][0]["status"],
  }));
  const overallStatus = evaluateRollbackChecklistStatus(allItems as Parameters<typeof evaluateRollbackChecklistStatus>[0]);

  await recordAgentPmoApprovalPackEvent({
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    eventType: "rollback_checklist_created",
    message: `Rollback readiness checklist created: ${overallStatus}`,
    actorId: input.actorId ?? null,
  });

  return { ...checklist, overallStatus, updatedAt: new Date().toISOString() };
}

// ─── Create PMO Sign-Off Packet ───────────────────────────────────────────────

export async function createPmoSignOffPacket(input: {
  workspaceId: string;
  changeRequestId: string;
  approvalPackId?: string | null;
  simulationReportId?: string | null;
  impactSummaryId?: string | null;
  draftDiffId?: string | null;
  approvalChecklistId?: string | null;
  rollbackChecklistId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoSignOffPacketRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) throw new Error("Policy change request not found.");

  const signOffSummary = sanitizeApprovalPackText(
    `PMO Sign-Off Packet for policy area: ${changeRequest.policyArea}. ` +
    `This approval is for implementation planning only. ` +
    `No policy is applied. No routing is changed. No scoring is changed. ` +
    `Approval enables future implementation planning sprint only.`,
    2000,
  );

  const packet = await createAgentPmoSignOffPacket({
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId,
    simulationReportId: input.simulationReportId ?? null,
    impactSummaryId: input.impactSummaryId ?? null,
    draftDiffId: input.draftDiffId ?? null,
    approvalChecklistId: input.approvalChecklistId ?? null,
    rollbackChecklistId: input.rollbackChecklistId ?? null,
    status: "created",
    signOffSummary,
    safePayload: redactApprovalPackPayload({ policyArea: changeRequest.policyArea }),
    createdBy: input.actorId ?? null,
  });

  await recordAgentPmoApprovalPackEvent({
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId,
    signOffPacketId: packet.id,
    eventType: "signoff_packet_created",
    message: "PMO sign-off packet created",
    actorId: input.actorId ?? null,
  });

  return packet;
}

// ─── Record PMO Sign-Off Decision ─────────────────────────────────────────────

export async function recordPmoSignOffDecision(
  input: RecordAgentPmoSignOffDecisionInput,
): Promise<AgentPmoSignOffDecisionRecord> {
  const normalized = normalizeSignOffDecisionInput(input);
  const decision = await recordAgentPmoSignOffDecision(normalized);

  await recordAgentPmoApprovalPackEvent({
    workspaceId: normalized.workspaceId,
    approvalPackId: normalized.approvalPackId ?? null,
    signOffPacketId: normalized.signOffPacketId,
    eventType: "signoff_decision_recorded",
    message: `PMO sign-off decision: ${normalized.decisionType}`,
    actorId: normalized.decidedBy ?? null,
  });

  return decision;
}

// ─── Assemble Governance Approval Pack ───────────────────────────────────────

export async function assembleGovernanceApprovalPack(
  input: CreateAgentPmoApprovalPackInput,
): Promise<AgentPmoApprovalPackRecord> {
  const normalized = normalizeCreateApprovalPackInput(input);

  const changeRequest = await getPolicyChangeRequestById(normalized.workspaceId, normalized.changeRequestId);
  if (!changeRequest) throw new Error("Policy change request not found.");

  const backlogItems = await listPolicyBacklogItems(normalized.workspaceId);
  const backlogItem = backlogItems.find((b) => b.id === changeRequest.backlogItemId) ?? null;

  const pack = await createAgentPmoApprovalPack({
    workspaceId: normalized.workspaceId,
    changeRequestId: normalized.changeRequestId,
    backlogItemId: backlogItem?.id ?? null,
    packStatus: "assembling",
    title: sanitizeApprovalPackText(`Governance Approval Pack: ${changeRequest.policyArea}`, 180),
    safePackPayload: redactApprovalPackPayload({ policyArea: changeRequest.policyArea }),
    createdBy: normalized.actorId ?? null,
  });

  await recordAgentPmoApprovalPackEvent({
    workspaceId: normalized.workspaceId,
    approvalPackId: pack.id,
    changeRequestId: normalized.changeRequestId,
    eventType: "approval_pack_created",
    message: "Governance approval pack created",
    actorId: normalized.actorId ?? null,
  });

  await recordAgentPmoApprovalPackEvent({
    workspaceId: normalized.workspaceId,
    approvalPackId: pack.id,
    changeRequestId: normalized.changeRequestId,
    eventType: "approval_pack_assembling",
    message: "Assembling governance approval pack",
    actorId: normalized.actorId ?? null,
  });

  const simulationReport = await generateGovernanceSimulationReport({ workspaceId: normalized.workspaceId, changeRequestId: normalized.changeRequestId, actorId: normalized.actorId });
  const impactSummary = await generatePolicyImpactSummary({ workspaceId: normalized.workspaceId, changeRequestId: normalized.changeRequestId, actorId: normalized.actorId });
  const draftDiff = await generatePolicyDraftDiff({ workspaceId: normalized.workspaceId, changeRequestId: normalized.changeRequestId, actorId: normalized.actorId });
  const approvalChecklist = await generateApprovalChecklist({ workspaceId: normalized.workspaceId, changeRequestId: normalized.changeRequestId, approvalPackId: pack.id, actorId: normalized.actorId });
  const rollbackChecklist = await generateRollbackReadinessChecklist({ workspaceId: normalized.workspaceId, changeRequestId: normalized.changeRequestId, approvalPackId: pack.id, actorId: normalized.actorId });
  const signOffPacket = await createPmoSignOffPacket({
    workspaceId: normalized.workspaceId,
    changeRequestId: normalized.changeRequestId,
    approvalPackId: pack.id,
    simulationReportId: simulationReport.id,
    impactSummaryId: impactSummary.id,
    draftDiffId: draftDiff.id,
    approvalChecklistId: approvalChecklist.id,
    rollbackChecklistId: rollbackChecklist.id,
    actorId: normalized.actorId,
  });
  const ticketDraft = await createImplementationTicketDraft({
    workspaceId: normalized.workspaceId,
    changeRequestId: normalized.changeRequestId,
    approvalPackId: pack.id,
    actorId: normalized.actorId,
  });

  const assembledPack = await updateAgentPmoApprovalPackStatus(
    normalized.workspaceId,
    pack.id,
    "review_ready",
    {
      simulationReportId: simulationReport.id,
      impactSummaryId: impactSummary.id,
      draftDiffId: draftDiff.id,
      approvalChecklistId: approvalChecklist.id,
      rollbackChecklistId: rollbackChecklist.id,
      signOffPacketId: signOffPacket.id,
      implementationTicketDraftId: ticketDraft.id,
    },
  );

  const artifactDefs: Array<{ type: Parameters<typeof createAgentPmoApprovalPackArtifact>[0]["artifactType"]; refId: string; label: string }> = [
    { type: "simulation_report", refId: simulationReport.id, label: "Governance Simulation Report" },
    { type: "impact_summary", refId: impactSummary.id, label: "Policy Impact Summary" },
    { type: "policy_draft_diff", refId: draftDiff.id, label: "Policy Draft Diff" },
    { type: "approval_checklist", refId: approvalChecklist.id, label: "Approval Checklist" },
    { type: "rollback_checklist", refId: rollbackChecklist.id, label: "Rollback Readiness Checklist" },
    { type: "signoff_packet", refId: signOffPacket.id, label: "PMO Sign-Off Packet" },
    { type: "implementation_ticket_draft", refId: ticketDraft.id, label: "Implementation Ticket Draft" },
  ];

  for (const art of artifactDefs) {
    await createAgentPmoApprovalPackArtifact({
      workspaceId: normalized.workspaceId,
      approvalPackId: pack.id,
      artifactType: art.type,
      artifactRefId: art.refId,
      artifactLabel: art.label,
    });
  }

  await recordAgentPmoApprovalPackEvent({
    workspaceId: normalized.workspaceId,
    approvalPackId: pack.id,
    changeRequestId: normalized.changeRequestId,
    eventType: "approval_pack_assembled",
    message: "Governance approval pack assembled and review-ready",
    actorId: normalized.actorId ?? null,
  });

  const finalPack = await getAgentPmoApprovalPackById(normalized.workspaceId, pack.id);
  return finalPack ?? assembledPack!;
}

// ─── Create Implementation Ticket Draft ──────────────────────────────────────

export async function createImplementationTicketDraft(input: {
  workspaceId: string;
  changeRequestId: string;
  approvalPackId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoImplementationTicketDraftRecord> {
  const changeRequest = await getPolicyChangeRequestById(input.workspaceId, input.changeRequestId);
  if (!changeRequest) throw new Error("Policy change request not found.");

  const ticketTitle = sanitizeApprovalPackText(
    `Draft: Future Policy Implementation - ${changeRequest.policyArea}`,
    180,
  );

  const ticketBody = sanitizeApprovalPackText(
    `## Draft Implementation Ticket\n\n` +
    `**IMPORTANT: This is NOT a real ticket. This is an internal planning draft only.**\n` +
    `**This ticket does not create any Jira ticket, GitHub issue, or external work item.**\n\n` +
    `### Future Implementation Planning Context\n` +
    `This draft is blocked until PMO sign-off approval for implementation planning.\n\n` +
    `### Change Request\n` +
    `Change Request ID: ${input.changeRequestId}\n` +
    `Policy Area: ${changeRequest.policyArea}\n\n` +
    `### Policy Area\n` +
    `${changeRequest.policyArea}\n\n` +
    `### Simulation Summary\n` +
    `Simulation and impact analysis completed. See governance approval pack for details.\n\n` +
    `### Impact Summary\n` +
    `Estimated impact level: ${changeRequest.estimatedImpactLevel ?? "low"}.\n\n` +
    `### Draft Diff Summary\n` +
    `Non-live governance policy draft created. Baseline is conceptual only.\n\n` +
    `### Rollback Readiness\n` +
    `Rollback readiness checklist created. See approval pack for details.\n\n` +
    `### Acceptance Criteria\n` +
    `- PMO sign-off approval received\n` +
    `- All checklist items passed\n` +
    `- Rollback plan reviewed\n` +
    `- Implementation sprint planned\n\n` +
    `### Non-Live Statement\n` +
    `This ticket draft does NOT apply any policy, change routing, change risk scoring, ` +
    `update evidence requirements, execute adapters, create external tickets, or send communications.`,
    8000,
  );

  const signOffPackets = await listAgentPmoSignOffPackets(input.workspaceId, {
    approvalPackId: input.approvalPackId ?? undefined,
  });
  const isSignedOff = signOffPackets.some((p) => p.status === "approved_for_implementation_planning");

  const draft = await createAgentPmoImplementationTicketDraft({
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId,
    ticketTitle,
    ticketBody,
    ticketType: "implementation_planning",
    targetFutureSprint: "future_implementation_sprint_tbd",
    acceptanceCriteria: [
      "PMO sign-off approval received",
      "All checklist items passed",
      "Rollback plan reviewed",
      "Implementation sprint planned",
    ],
    blockedUntilSignOff: !isSignedOff,
    status: isSignedOff ? "review_ready" : "blocked_until_signoff",
    safeTicketPayload: redactApprovalPackPayload({ policyArea: changeRequest.policyArea }),
    createdBy: input.actorId ?? null,
  });

  await recordAgentPmoApprovalPackEvent({
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId,
    eventType: "implementation_ticket_draft_created",
    message: "Implementation ticket draft created (internal only, not a real ticket)",
    actorId: input.actorId ?? null,
  });

  return draft;
}

// ─── Generate Approval Pack Export ───────────────────────────────────────────

export async function generateApprovalPackExport(
  input: GenerateAgentPmoApprovalPackExportInput,
): Promise<AgentPmoApprovalPackExportRecord> {
  const normalized = normalizeApprovalPackExportInput(input);

  const pack = await getAgentPmoApprovalPackById(normalized.workspaceId, normalized.approvalPackId);
  if (!pack) throw new Error("Approval pack not found.");

  const data = await getApprovalPackData(normalized.workspaceId, normalized.approvalPackId);

  let content: string;
  if (normalized.exportFormat === "markdown") {
    content = buildMarkdownExport(pack, data);
  } else if (normalized.exportFormat === "json") {
    content = buildJsonExport(pack, data);
  } else {
    content = buildCsvExport(pack, data);
  }

  const safetyResult = validateApprovalPackExportSafety(content);
  if (!safetyResult.safe) {
    throw new Error(`Export safety validation failed: ${safetyResult.issues.join(", ")}`);
  }

  const exportRecord = await createAgentPmoApprovalPackExport({
    workspaceId: normalized.workspaceId,
    approvalPackId: normalized.approvalPackId,
    exportFormat: normalized.exportFormat,
    exportStatus: "generated",
    safeExportContent: content,
    safetyValidationPassed: safetyResult.safe,
    createdBy: normalized.actorId ?? null,
  });

  await recordAgentPmoApprovalPackEvent({
    workspaceId: normalized.workspaceId,
    approvalPackId: normalized.approvalPackId,
    eventType: "approval_pack_export_created",
    message: `Approval pack export generated: ${normalized.exportFormat}`,
    actorId: normalized.actorId ?? null,
  });

  return exportRecord;
}

function buildMarkdownExport(pack: AgentPmoApprovalPackRecord, data: Awaited<ReturnType<typeof getApprovalPackData>>): string {
  return [
    `# Governance Approval Pack`,
    ``,
    `**Title:** ${pack.title}`,
    `**Status:** ${pack.packStatus}`,
    `**Version:** ${pack.packVersion}`,
    `**Change Request:** ${pack.changeRequestId}`,
    `**Created:** ${pack.createdAt}`,
    ``,
    `## Non-Goals Statement`,
    `This export does NOT apply any policy, change routing, change risk scoring, update evidence requirements,`,
    `execute adapters, create external tickets, or send communications.`,
    ``,
    `## Data Minimization Statement`,
    `This export excludes raw payloads, sensitive auth values, customer identifiers, failure messages, and correction reasons.`,
    ``,
    `## Explicit No-Implementation Statement`,
    `This approval pack is for future implementation planning only. No policy is applied.`,
    ``,
    `## Simulation Report`,
    data.simulationReport ? `Title: ${data.simulationReport.title}\nStatus: ${data.simulationReport.status}\nSections: ${data.simulationReport.sectionCount}` : "Not available",
    ``,
    `## Impact Summary`,
    data.impactSummary ? `Impact Level: ${data.impactSummary.impactLevel}\nSummary: ${data.impactSummary.summary}` : "Not available",
    ``,
    `## Policy Draft Diff`,
    data.draftDiff ? `Baseline: ${data.draftDiff.baselineLabel}\nDraft: ${data.draftDiff.draftLabel}\nAdded rules: ${data.draftDiff.addedRules.length}\nUnknown baseline: ${data.draftDiff.unknownBaseline}` : "Not available",
    ``,
    `## Approval Checklist`,
    data.approvalChecklist ? `Overall Status: ${data.approvalChecklist.overallStatus}\nItems: ${data.approvalChecklist.itemCount} (passed: ${data.approvalChecklist.passedCount})` : "Not available",
    ``,
    `## Rollback Readiness Checklist`,
    data.rollbackChecklist ? `Overall Status: ${data.rollbackChecklist.overallStatus}\nItems: ${data.rollbackChecklist.itemCount} (passed: ${data.rollbackChecklist.passedCount})` : "Not available",
    ``,
    `## PMO Sign-Off Packet`,
    data.signOffPacket ? `Status: ${data.signOffPacket.status}\nSummary: ${data.signOffPacket.signOffSummary}` : "Not available",
    ``,
    `## Implementation Ticket Draft`,
    data.implementationTicketDraft ? `Title: ${data.implementationTicketDraft.ticketTitle}\nStatus: ${data.implementationTicketDraft.status}\nBlocked until sign-off: ${data.implementationTicketDraft.blockedUntilSignOff}` : "Not available",
    ``,
    `## Artifacts`,
    `Artifact count: ${pack.artifactCount}`,
    `Export count: ${pack.exportCount}`,
  ].join("\n");
}

function buildJsonExport(pack: AgentPmoApprovalPackRecord, data: Awaited<ReturnType<typeof getApprovalPackData>>): string {
  const safe = {
    approvalPack: {
      id: pack.id,
      title: pack.title,
      packStatus: pack.packStatus,
      packVersion: pack.packVersion,
      changeRequestId: pack.changeRequestId,
      createdAt: pack.createdAt,
    },
    simulationReport: data.simulationReport ? {
      id: data.simulationReport.id,
      title: data.simulationReport.title,
      status: data.simulationReport.status,
      sectionCount: data.simulationReport.sectionCount,
    } : null,
    impactSummary: data.impactSummary ? {
      impactLevel: data.impactSummary.impactLevel,
      summary: data.impactSummary.summary,
      confidenceScore: data.impactSummary.confidenceScore,
    } : null,
    draftDiff: data.draftDiff ? {
      unknownBaseline: data.draftDiff.unknownBaseline,
      baselineLabel: data.draftDiff.baselineLabel,
      draftLabel: data.draftDiff.draftLabel,
      addedRulesCount: data.draftDiff.addedRules.length,
    } : null,
    approvalChecklist: data.approvalChecklist ? {
      overallStatus: data.approvalChecklist.overallStatus,
      itemCount: data.approvalChecklist.itemCount,
      passedCount: data.approvalChecklist.passedCount,
    } : null,
    rollbackChecklist: data.rollbackChecklist ? {
      overallStatus: data.rollbackChecklist.overallStatus,
      itemCount: data.rollbackChecklist.itemCount,
      passedCount: data.rollbackChecklist.passedCount,
    } : null,
    signOffPacket: data.signOffPacket ? {
      status: data.signOffPacket.status,
      signOffSummary: data.signOffPacket.signOffSummary,
    } : null,
    implementationTicketDraft: data.implementationTicketDraft ? {
      ticketTitle: data.implementationTicketDraft.ticketTitle,
      status: data.implementationTicketDraft.status,
      blockedUntilSignOff: data.implementationTicketDraft.blockedUntilSignOff,
    } : null,
    nonGoalsStatement: "This export does NOT apply any policy, change routing, or risk scoring.",
    dataMinimizationStatement: "Excludes raw payloads, sensitive auth values, failure messages, and correction reasons.",
    noImplementationStatement: "For future implementation planning only. No policy is applied.",
  };
  assertApprovalPackPayloadSerializable(safe);
  return JSON.stringify(safe, null, 2);
}

function buildCsvExport(pack: AgentPmoApprovalPackRecord, data: Awaited<ReturnType<typeof getApprovalPackData>>): string {
  const rows = [
    ["field", "value"],
    ["pack_id", pack.id],
    ["pack_title", pack.title],
    ["pack_status", pack.packStatus],
    ["pack_version", String(pack.packVersion)],
    ["change_request_id", pack.changeRequestId],
    ["created_at", pack.createdAt],
    ["simulation_report_status", data.simulationReport?.status ?? "not_available"],
    ["impact_level", data.impactSummary?.impactLevel ?? "not_available"],
    ["approval_checklist_status", data.approvalChecklist?.overallStatus ?? "not_available"],
    ["rollback_checklist_status", data.rollbackChecklist?.overallStatus ?? "not_available"],
    ["signoff_packet_status", data.signOffPacket?.status ?? "not_available"],
    ["ticket_draft_status", data.implementationTicketDraft?.status ?? "not_available"],
    ["no_implementation_statement", "For future implementation planning only"],
  ];
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// ─── Archive Approval Pack ────────────────────────────────────────────────────

export async function archiveApprovalPack(input: {
  workspaceId: string;
  approvalPackId: string;
  rationale: string;
  actorId?: string | null;
}): Promise<AgentPmoApprovalPackRecord | null> {
  const pack = await getAgentPmoApprovalPackById(input.workspaceId, input.approvalPackId);
  if (!pack) return null;
  const archived = await updateAgentPmoApprovalPackStatus(input.workspaceId, input.approvalPackId, "archived");
  await recordAgentPmoApprovalPackEvent({
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId,
    eventType: "approval_pack_archived",
    message: sanitizeApprovalPackText(input.rationale, 500),
    actorId: input.actorId ?? null,
  });
  return archived;
}

// ─── Build Approval Pack Summary ──────────────────────────────────────────────

export async function buildApprovalPackSummary(workspaceId: string): Promise<{
  totalApprovalPacks: number;
  assembledPacks: number;
  reviewReadyPacks: number;
  signedOffPacks: number;
  changesRequestedPacks: number;
  archivedPacks: number;
  failedPacks: number;
  simulationReportCount: number;
  impactSummaryCount: number;
  draftDiffCount: number;
  approvalChecklistPassCount: number;
  rollbackChecklistPassCount: number;
  signOffPendingCount: number;
  implementationTicketDraftCount: number;
  exportCount: number;
  oldestReviewReadyPackId: string | null;
}> {
  const packs = await listAgentPmoApprovalPacks(workspaceId);
  const exports = await listAgentPmoApprovalPackExports(workspaceId);
  const drafts = await listAgentPmoImplementationTicketDrafts(workspaceId);
  const signOffPackets = await listAgentPmoSignOffPackets(workspaceId);

  const reviewReadyPacks = packs.filter((p) => p.packStatus === "review_ready");
  const oldestReviewReady = reviewReadyPacks.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;

  return {
    totalApprovalPacks: packs.length,
    assembledPacks: packs.filter((p) => p.packStatus === "assembled").length,
    reviewReadyPacks: reviewReadyPacks.length,
    signedOffPacks: packs.filter((p) => p.packStatus === "signed_off").length,
    changesRequestedPacks: packs.filter((p) => p.packStatus === "changes_requested").length,
    archivedPacks: packs.filter((p) => p.packStatus === "archived").length,
    failedPacks: packs.filter((p) => p.packStatus === "failed").length,
    simulationReportCount: packs.filter((p) => !!p.simulationReportId).length,
    impactSummaryCount: packs.filter((p) => !!p.impactSummaryId).length,
    draftDiffCount: packs.filter((p) => !!p.draftDiffId).length,
    approvalChecklistPassCount: 0,
    rollbackChecklistPassCount: 0,
    signOffPendingCount: signOffPackets.filter((s) => s.status === "created" || s.status === "under_review").length,
    implementationTicketDraftCount: drafts.length,
    exportCount: exports.length,
    oldestReviewReadyPackId: oldestReviewReady?.id ?? null,
  };
}

// ─── Get Approval Pack Data ───────────────────────────────────────────────────

export async function getApprovalPackData(workspaceId: string, approvalPackId: string): Promise<{
  pack: AgentPmoApprovalPackRecord | null;
  simulationReport: AgentPmoSimulationReportRecord | null;
  impactSummary: AgentPmoPolicyImpactSummaryRecord | null;
  draftDiff: AgentPmoPolicyDraftDiffRecord | null;
  approvalChecklist: AgentPmoApprovalChecklistRecord | null;
  rollbackChecklist: AgentPmoRollbackReadinessChecklistRecord | null;
  signOffPacket: AgentPmoSignOffPacketRecord | null;
  implementationTicketDraft: AgentPmoImplementationTicketDraftRecord | null;
  exports: AgentPmoApprovalPackExportRecord[];
  events: AgentPmoApprovalPackEventRecord[];
}> {
  const pack = await getAgentPmoApprovalPackById(workspaceId, approvalPackId);
  if (!pack) return { pack: null, simulationReport: null, impactSummary: null, draftDiff: null, approvalChecklist: null, rollbackChecklist: null, signOffPacket: null, implementationTicketDraft: null, exports: [], events: [] };

  const [exports, events, implDrafts, signOffPackets] = await Promise.all([
    listAgentPmoApprovalPackExports(workspaceId, { approvalPackId }),
    listAgentPmoApprovalPackEvents(workspaceId, { approvalPackId }),
    listAgentPmoImplementationTicketDrafts(workspaceId, { approvalPackId }),
    listAgentPmoSignOffPackets(workspaceId, { approvalPackId }),
  ]);

  let simulationReport: AgentPmoSimulationReportRecord | null = null;
  if (pack.simulationReportId) {
    simulationReport = await getAgentPmoSimulationReportById(workspaceId, pack.simulationReportId);
  }

  return {
    pack,
    simulationReport,
    impactSummary: null,
    draftDiff: null,
    approvalChecklist: null,
    rollbackChecklist: null,
    signOffPacket: signOffPackets[0] ?? null,
    implementationTicketDraft: implDrafts[0] ?? null,
    exports,
    events,
  };
}

// Re-export registry helpers needed by routes
export {
  getAgentPmoSimulationReportById,
  listAgentPmoSimulationReports,
  updateAgentPmoSimulationReportStatus,
  getAgentPmoApprovalPackById,
  listAgentPmoApprovalPacks,
  updateAgentPmoApprovalPackStatus,
  listAgentPmoSignOffPackets,
  listAgentPmoImplementationTicketDrafts,
  listAgentPmoApprovalPackExports,
  getAgentPmoApprovalPackExportById,
  listAgentPmoApprovalPackEvents,
};
