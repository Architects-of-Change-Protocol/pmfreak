// ─── PMO Controlled Policy Implementation Planning Workspace — Service ─
// Does NOT call LLMs (no openai, anthropic, gemini, embeddings).
// Does NOT call fetch() or external APIs.
// Does NOT send email, slack, jira, or calendar events.
// Does NOT apply policies, change routing, change risk scoring.
// Does NOT activate policy drafts, run dry-runs, or execute rollback.
// Does NOT mutate live policies.
// Does NOT create external tickets.
// All operations are deterministic — planning workspace only.

import {
  createAgentPmoImplementationPlanningWorkspace,
  getAgentPmoImplementationPlanningWorkspaceById,
  updateAgentPmoImplementationPlanningWorkspaceStatus,
  listAgentPmoImplementationPlanningWorkspaces,
  createAgentPmoImplementationPlanDraft,
  listAgentPmoImplementationPlanDrafts,
  createAgentPmoImplementationTaskBreakdown,
  listAgentPmoImplementationTaskBreakdowns,
  createAgentPmoPreImplementationChecklist,
  updateAgentPmoPreImplementationChecklistCounts,
  createAgentPmoPreImplementationChecklistItem,
  listAgentPmoPreImplementationChecklistItems,
  createAgentPmoStakeholderReadiness,
  listAgentPmoStakeholderReadiness,
  createAgentPmoChangeWindowPlan,
  listAgentPmoChangeWindowPlans,
  createAgentPmoImplementationRisk,
  listAgentPmoImplementationRisks,
  createAgentPmoRollbackRehearsalPlan,
  listAgentPmoRollbackRehearsalPlans,
  createAgentPmoImplementationGatePrerequisite,
  listAgentPmoImplementationGatePrerequisites,
  recordAgentPmoImplementationPlanningDecision,
  listAgentPmoImplementationPlanningDecisions,
  createAgentPmoImplementationPlanningExport,
  getAgentPmoImplementationPlanningExportById,
  listAgentPmoImplementationPlanningExports,
  recordAgentPmoImplementationPlanningEvent,
  listAgentPmoImplementationPlanningEvents,
} from "./agent-pmo-implementation-planning-registry";

import {
  normalizeCreateImplementationPlanningWorkspaceInput,
  normalizeCreateImplementationPlanDraftInput,
  normalizePlanningDecisionInput,
  normalizeImplementationPlanningExportInput,
  evaluatePreImplementationChecklistStatus,
  deriveImplementationPlanningWorkspaceStatus,
  validateImplementationPlanningExportSafety,
} from "./agent-pmo-implementation-planning-validation";

import type {
  AgentPmoImplementationPlanningWorkspaceRecord,
  AgentPmoImplementationPlanDraftRecord,
  AgentPmoImplementationTaskBreakdownRecord,
  AgentPmoPreImplementationChecklistRecord,
  AgentPmoPreImplementationChecklistItemRecord,
  AgentPmoStakeholderReadinessRecord,
  AgentPmoChangeWindowPlanRecord,
  AgentPmoImplementationRiskRecord,
  AgentPmoRollbackRehearsalPlanRecord,
  AgentPmoImplementationGatePrerequisiteRecord,
  AgentPmoImplementationPlanningDecisionRecord,
  AgentPmoImplementationPlanningExportRecord,
  AgentPmoImplementationPlanningEventRecord,
  RecordAgentPmoImplementationPlanningDecisionInput,
  GenerateAgentPmoImplementationPlanningExportInput,
  AgentPmoImplementationTaskType,
  AgentPmoImplementationGatePrerequisiteType,
} from "./agent-pmo-implementation-planning-types";

// ─── Task definitions ─────────────────────────────────────────────────────────

const TASK_DEFINITIONS: Array<{
  taskType: AgentPmoImplementationTaskType;
  title: string;
  description: string;
  taskOrder: number;
}> = [
  {
    taskType: "policy_version_preparation",
    title: "Policy Version Preparation",
    description: "Prepare and document the target policy version for dry-run planning. Verify version identifiers and policy diff documentation.",
    taskOrder: 1,
  },
  {
    taskType: "configuration_review",
    title: "Configuration Review",
    description: "Review all configuration parameters that would be affected by this policy change. Document current and target configuration values.",
    taskOrder: 2,
  },
  {
    taskType: "runtime_mapping_review",
    title: "Runtime Mapping Review",
    description: "Review runtime mappings, adapter registrations, and routing configurations that may be affected. Document current state.",
    taskOrder: 3,
  },
  {
    taskType: "safety_check",
    title: "Safety Check",
    description: "Perform a safety review to ensure no live policy mutations, no external side effects, and no unsafe payload exposure in the plan.",
    taskOrder: 4,
  },
  {
    taskType: "test_plan_preparation",
    title: "Test Plan Preparation",
    description: "Prepare a test plan for the dry-run phase. Define test scenarios, expected outcomes, and validation criteria.",
    taskOrder: 5,
  },
  {
    taskType: "stakeholder_review",
    title: "Stakeholder Review",
    description: "Confirm all required stakeholders have acknowledged the implementation plan and provided readiness status.",
    taskOrder: 6,
  },
  {
    taskType: "change_window_preparation",
    title: "Change Window Preparation",
    description: "Finalize the proposed change window, timezone, business impact estimate, and operational constraints.",
    taskOrder: 7,
  },
  {
    taskType: "rollback_preparation",
    title: "Rollback Preparation",
    description: "Prepare rollback rehearsal plans and verify rollback procedures are documented and reviewed.",
    taskOrder: 8,
  },
  {
    taskType: "dry_run_preparation",
    title: "Dry-Run Preparation",
    description: "Prepare all artifacts needed for the dry-run phase. This task must be completed before dry-run execution can be authorized.",
    taskOrder: 9,
  },
  {
    taskType: "documentation_update",
    title: "Documentation Update",
    description: "Update all relevant documentation including implementation plan, risk register, and stakeholder communications.",
    taskOrder: 10,
  },
];

// ─── Checklist item definitions ───────────────────────────────────────────────

const CHECKLIST_ITEM_DEFINITIONS: Array<{ itemKey: string; itemLabel: string }> = [
  { itemKey: "approval_pack_exists", itemLabel: "Approval pack exists and is linked" },
  { itemKey: "approval_pack_signed_off", itemLabel: "Approval pack has been signed off" },
  { itemKey: "implementation_plan_draft_exists", itemLabel: "Implementation plan draft exists" },
  { itemKey: "policy_scope_reviewed", itemLabel: "Policy scope has been reviewed" },
  { itemKey: "simulation_report_reviewed", itemLabel: "Simulation report has been reviewed" },
  { itemKey: "impact_summary_reviewed", itemLabel: "Impact summary has been reviewed" },
  { itemKey: "policy_draft_diff_reviewed", itemLabel: "Policy draft diff has been reviewed" },
  { itemKey: "approval_checklist_reviewed", itemLabel: "Approval checklist has been reviewed" },
  { itemKey: "rollback_checklist_reviewed", itemLabel: "Rollback checklist has been reviewed" },
  { itemKey: "task_breakdown_exists", itemLabel: "Task breakdown has been generated" },
  { itemKey: "stakeholder_readiness_evaluated", itemLabel: "Stakeholder readiness has been evaluated" },
  { itemKey: "change_window_proposed", itemLabel: "Change window has been proposed" },
  { itemKey: "risk_register_created", itemLabel: "Risk register has been created" },
  { itemKey: "rollback_rehearsal_plan_created", itemLabel: "Rollback rehearsal plan has been created" },
  { itemKey: "gate_prerequisites_evaluated", itemLabel: "Gate prerequisites have been evaluated" },
  { itemKey: "no_live_policy_mutation", itemLabel: "Confirmed: no live policy mutation in this plan" },
  { itemKey: "no_external_side_effects", itemLabel: "Confirmed: no external side effects in this plan" },
  { itemKey: "no_unsafe_payload_exposure", itemLabel: "Confirmed: no unsafe payload exposure in this export" },
];

// ─── Service Functions ────────────────────────────────────────────────────────

export async function createImplementationPlanningWorkspaceFromApprovalPack(input: {
  workspaceId: string;
  approvalPackId: string;
  title: string;
  summary: string;
  planningOwnerRole?: AgentPmoImplementationPlanningWorkspaceRecord["planningOwnerRole"];
  changeRequestId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoImplementationPlanningWorkspaceRecord> {
  const normalized = normalizeCreateImplementationPlanningWorkspaceInput(input);
  const workspace = await createAgentPmoImplementationPlanningWorkspace({
    workspaceId: normalized.workspaceId,
    approvalPackId: normalized.approvalPackId,
    changeRequestId: normalized.changeRequestId ?? null,
    planningOwnerRole: normalized.planningOwnerRole ?? null,
    title: normalized.title,
    summary: normalized.summary,
    status: "created",
    createdBy: normalized.actorId ?? null,
  });
  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: normalized.workspaceId,
    planningWorkspaceId: workspace.id,
    eventType: "implementation_planning_workspace_created",
    message: `Implementation planning workspace created: ${workspace.title}`,
    eventPayload: { planningWorkspaceId: workspace.id, approvalPackId: normalized.approvalPackId },
    actorId: normalized.actorId ?? null,
  });
  return workspace;
}

export async function createImplementationPlanDraft(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  implementationObjective: string;
  implementationScope: string;
  nonGoals: string;
  assumptions?: string;
  constraints?: string;
  actorId?: string | null;
}): Promise<AgentPmoImplementationPlanDraftRecord> {
  const normalized = normalizeCreateImplementationPlanDraftInput(input);
  const draft = await createAgentPmoImplementationPlanDraft({
    workspaceId: normalized.workspaceId,
    planningWorkspaceId: normalized.planningWorkspaceId,
    implementationObjective: normalized.implementationObjective,
    implementationScope: normalized.implementationScope,
    nonGoals: normalized.nonGoals,
    assumptions: normalized.assumptions,
    constraints: normalized.constraints,
    status: "created",
    createdBy: normalized.actorId ?? null,
  });
  await updateAgentPmoImplementationPlanningWorkspaceStatus(
    normalized.workspaceId,
    normalized.planningWorkspaceId,
    "planning",
  );
  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: normalized.workspaceId,
    planningWorkspaceId: normalized.planningWorkspaceId,
    planDraftId: draft.id,
    eventType: "implementation_plan_draft_created",
    message: `Implementation plan draft v${draft.planVersion} created`,
    eventPayload: { planDraftId: draft.id, planVersion: draft.planVersion },
    actorId: normalized.actorId ?? null,
  });
  return draft;
}

export async function generateImplementationTaskBreakdown(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  planDraftId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoImplementationTaskBreakdownRecord[]> {
  const existing = await listAgentPmoImplementationTaskBreakdowns(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId });
  if (existing.length > 0) return existing;

  const tasks: AgentPmoImplementationTaskBreakdownRecord[] = [];
  for (const def of TASK_DEFINITIONS) {
    const task = await createAgentPmoImplementationTaskBreakdown({
      workspaceId: input.workspaceId,
      planningWorkspaceId: input.planningWorkspaceId,
      planDraftId: input.planDraftId ?? null,
      taskType: def.taskType,
      status: "planned",
      taskOrder: def.taskOrder,
      title: def.title,
      description: def.description,
    });
    tasks.push(task);
  }
  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    planDraftId: input.planDraftId ?? null,
    eventType: "implementation_task_breakdown_created",
    message: `Implementation task breakdown created with ${tasks.length} tasks`,
    eventPayload: { taskCount: tasks.length },
    actorId: input.actorId ?? null,
  });
  return tasks;
}

export async function generatePreImplementationChecklist(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId?: string | null;
  actorId?: string | null;
}): Promise<{ checklist: AgentPmoPreImplementationChecklistRecord; items: AgentPmoPreImplementationChecklistItemRecord[] }> {
  const checklist = await createAgentPmoPreImplementationChecklist({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    approvalPackId: input.approvalPackId ?? null,
    status: "not_started",
    totalItems: CHECKLIST_ITEM_DEFINITIONS.length,
  });

  const items: AgentPmoPreImplementationChecklistItemRecord[] = [];
  for (const def of CHECKLIST_ITEM_DEFINITIONS) {
    const item = await createAgentPmoPreImplementationChecklistItem({
      workspaceId: input.workspaceId,
      checklistId: checklist.id,
      itemKey: def.itemKey,
      itemLabel: def.itemLabel,
      status: "not_started",
    });
    items.push(item);
    await recordAgentPmoImplementationPlanningEvent({
      workspaceId: input.workspaceId,
      planningWorkspaceId: input.planningWorkspaceId,
      checklistId: checklist.id,
      eventType: "implementation_planning_checklist_item_recorded",
      message: `Checklist item recorded: ${def.itemKey}`,
      eventPayload: { itemKey: def.itemKey, checklistId: checklist.id },
      actorId: input.actorId ?? null,
    });
  }

  const overallStatus = evaluatePreImplementationChecklistStatus(items);
  const passedItems = items.filter((i) => i.status === "passed").length;
  const failedItems = items.filter((i) => i.status === "failed").length;
  const blockedItems = items.filter((i) => i.status === "blocked").length;

  const updatedChecklist = await updateAgentPmoPreImplementationChecklistCounts(
    input.workspaceId,
    checklist.id,
    { totalItems: items.length, passedItems, failedItems, blockedItems, status: overallStatus },
  );

  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    checklistId: checklist.id,
    eventType: "implementation_planning_checklist_created",
    message: `Pre-implementation checklist created with ${items.length} items`,
    eventPayload: { checklistId: checklist.id, totalItems: items.length },
    actorId: input.actorId ?? null,
  });

  return { checklist: updatedChecklist ?? checklist, items };
}

export async function recordStakeholderReadiness(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  stakeholderRole: AgentPmoStakeholderReadinessRecord["stakeholderRole"];
  status: AgentPmoStakeholderReadinessRecord["status"];
  rationale?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoStakeholderReadinessRecord> {
  const record = await createAgentPmoStakeholderReadiness({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    stakeholderRole: input.stakeholderRole,
    status: input.status,
    rationale: input.rationale ?? null,
    acknowledgedBy: input.status === "acknowledged" ? (input.actorId ?? null) : null,
  });
  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    eventType: "stakeholder_readiness_recorded",
    message: `Stakeholder readiness recorded: ${input.stakeholderRole} = ${input.status}`,
    eventPayload: { stakeholderRole: input.stakeholderRole, status: input.status },
    actorId: input.actorId ?? null,
  });
  return record;
}

export async function proposeChangeWindowPlan(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  windowType: AgentPmoChangeWindowPlanRecord["windowType"];
  changeRequestId?: string | null;
  proposedStartAt?: string | null;
  proposedEndAt?: string | null;
  timezone?: string | null;
  businessImpactEstimate?: string | null;
  operationalConstraints?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoChangeWindowPlanRecord> {
  const plan = await createAgentPmoChangeWindowPlan({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    changeRequestId: input.changeRequestId ?? null,
    windowType: input.windowType,
    status: "draft",
    proposedStartAt: input.proposedStartAt ?? null,
    proposedEndAt: input.proposedEndAt ?? null,
    timezone: input.timezone ?? null,
    businessImpactEstimate: input.businessImpactEstimate ?? null,
    operationalConstraints: input.operationalConstraints ?? null,
    approvalRequired: true,
    createdBy: input.actorId ?? null,
  });
  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    eventType: "change_window_plan_created",
    message: `Change window plan created: ${input.windowType}`,
    eventPayload: { changeWindowId: plan.id, windowType: input.windowType },
    actorId: input.actorId ?? null,
  });
  return plan;
}

export async function registerImplementationRisk(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  riskType: AgentPmoImplementationRiskRecord["riskType"];
  severity: AgentPmoImplementationRiskRecord["severity"];
  riskSummary: string;
  mitigationSummary?: string | null;
  ownerRole?: AgentPmoImplementationRiskRecord["ownerRole"];
  actorId?: string | null;
}): Promise<AgentPmoImplementationRiskRecord> {
  const risk = await createAgentPmoImplementationRisk({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    riskType: input.riskType,
    severity: input.severity,
    status: "open",
    riskSummary: input.riskSummary,
    mitigationSummary: input.mitigationSummary ?? null,
    ownerRole: input.ownerRole ?? null,
    createdBy: input.actorId ?? null,
  });
  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    eventType: "implementation_risk_registered",
    message: `Implementation risk registered: ${input.riskType} (${input.severity})`,
    eventPayload: { riskId: risk.id, riskType: input.riskType, severity: input.severity },
    actorId: input.actorId ?? null,
  });
  return risk;
}

export async function createRollbackRehearsalPlan(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  rollbackPlanId?: string | null;
  rehearsalType: AgentPmoRollbackRehearsalPlanRecord["rehearsalType"];
  rehearsalSummary: string;
  verificationSteps?: string[];
  expectedEvidence?: string[];
  actorId?: string | null;
}): Promise<AgentPmoRollbackRehearsalPlanRecord> {
  const plan = await createAgentPmoRollbackRehearsalPlan({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    rollbackPlanId: input.rollbackPlanId ?? null,
    rehearsalType: input.rehearsalType,
    status: "created",
    rehearsalSummary: input.rehearsalSummary,
    verificationSteps: input.verificationSteps ?? [],
    expectedEvidence: input.expectedEvidence ?? [],
    createdBy: input.actorId ?? null,
  });
  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    eventType: "rollback_rehearsal_plan_created",
    message: `Rollback rehearsal plan created: ${input.rehearsalType}`,
    eventPayload: { rehearsalPlanId: plan.id, rehearsalType: input.rehearsalType },
    actorId: input.actorId ?? null,
  });
  return plan;
}

export async function evaluateImplementationGatePrerequisites(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  actorId?: string | null;
}): Promise<AgentPmoImplementationGatePrerequisiteRecord[]> {
  const GATE_PREREQUISITE_TYPES: AgentPmoImplementationGatePrerequisiteType[] = [
    "approval_pack_exists",
    "approval_pack_signed_off",
    "implementation_plan_approved",
    "task_breakdown_reviewed",
    "stakeholders_acknowledged",
    "change_window_reviewed",
    "risk_register_reviewed",
    "rollback_rehearsal_ready",
    "validation_checklist_passed",
    "security_review_complete",
    "operations_review_complete",
    "data_governance_review_complete",
  ];

  const prerequisites: AgentPmoImplementationGatePrerequisiteRecord[] = [];
  for (const prereqType of GATE_PREREQUISITE_TYPES) {
    const prereq = await createAgentPmoImplementationGatePrerequisite({
      workspaceId: input.workspaceId,
      planningWorkspaceId: input.planningWorkspaceId,
      prerequisiteType: prereqType,
      status: "pending",
      createdBy: input.actorId ?? null,
    });
    prerequisites.push(prereq);
    await recordAgentPmoImplementationPlanningEvent({
      workspaceId: input.workspaceId,
      planningWorkspaceId: input.planningWorkspaceId,
      eventType: "implementation_gate_prerequisite_recorded",
      message: `Gate prerequisite recorded: ${prereqType}`,
      eventPayload: { prerequisiteId: prereq.id, prerequisiteType: prereqType },
      actorId: input.actorId ?? null,
    });
  }

  const derivedStatus = deriveImplementationPlanningWorkspaceStatus(prerequisites);
  await updateAgentPmoImplementationPlanningWorkspaceStatus(
    input.workspaceId,
    input.planningWorkspaceId,
    derivedStatus,
  );

  return prerequisites;
}

export async function recordImplementationPlanningDecision(
  input: RecordAgentPmoImplementationPlanningDecisionInput,
): Promise<AgentPmoImplementationPlanningDecisionRecord> {
  const normalized = normalizePlanningDecisionInput(input);
  const decision = await recordAgentPmoImplementationPlanningDecision({
    workspaceId: normalized.workspaceId,
    planningWorkspaceId: normalized.planningWorkspaceId,
    decision: normalized.decision,
    rationale: normalized.rationale,
    decidedBy: normalized.decidedBy ?? null,
  });

  // Update workspace status based on decision
  const statusMap: Record<string, AgentPmoImplementationPlanningWorkspaceRecord["status"]> = {
    approve_plan_for_dry_run_planning: "approved_for_dry_run_planning",
    request_changes: "changes_requested",
    block_plan: "blocked",
    archive_planning_workspace: "archived",
  };
  const newStatus = statusMap[normalized.decision];
  if (newStatus) {
    await updateAgentPmoImplementationPlanningWorkspaceStatus(
      normalized.workspaceId,
      normalized.planningWorkspaceId,
      newStatus,
    );
  }

  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: normalized.workspaceId,
    planningWorkspaceId: normalized.planningWorkspaceId,
    eventType: "implementation_planning_decision_recorded",
    message: `Implementation planning decision recorded: ${normalized.decision}`,
    eventPayload: { decisionId: decision.id, decision: normalized.decision },
    actorId: normalized.decidedBy ?? null,
  });
  return decision;
}

export async function generateImplementationPlanningExport(
  input: GenerateAgentPmoImplementationPlanningExportInput,
): Promise<AgentPmoImplementationPlanningExportRecord> {
  const normalized = normalizeImplementationPlanningExportInput(input);

  // Gather all data
  const workspace = await getAgentPmoImplementationPlanningWorkspaceById(
    normalized.workspaceId,
    normalized.planningWorkspaceId,
  );
  const drafts = await listAgentPmoImplementationPlanDrafts(normalized.workspaceId, { planningWorkspaceId: normalized.planningWorkspaceId });
  const tasks = await listAgentPmoImplementationTaskBreakdowns(normalized.workspaceId, { planningWorkspaceId: normalized.planningWorkspaceId });
  const risks = await listAgentPmoImplementationRisks(normalized.workspaceId, { planningWorkspaceId: normalized.planningWorkspaceId });
  const decisions = await listAgentPmoImplementationPlanningDecisions(normalized.workspaceId, { planningWorkspaceId: normalized.planningWorkspaceId });

  let contentText: string | null = null;
  let contentJson: Record<string, unknown> | null = null;
  let contentType = "text/plain";
  let fileName = `implementation-planning-export-${normalized.planningWorkspaceId}`;

  if (normalized.exportFormat === "markdown") {
    contentType = "text/markdown";
    fileName += ".md";
    contentText = buildMarkdownExport(workspace, drafts, tasks, risks, decisions);
  } else if (normalized.exportFormat === "json") {
    contentType = "application/json";
    fileName += ".json";
    contentJson = {
      exportType: "implementation_planning_workspace",
      disclaimer: "THIS EXPORT IS A PLANNING DOCUMENT ONLY. NO POLICY IMPLEMENTATION IS AUTHORIZED.",
      nonGoals: "This export does not apply policies, change routing, change risk scoring, update evidence requirements, execute adapters, retry dispatch, call LLMs, create embeddings, train models, call external APIs, mutate projects, create external tickets, create calendar events, send communications, run dry-runs, execute rollback, or activate policy drafts.",
      workspace,
      planDrafts: drafts,
      taskBreakdown: tasks,
      riskRegister: risks,
      decisions,
    };
    contentText = JSON.stringify(contentJson, null, 2);
  } else if (normalized.exportFormat === "csv") {
    contentType = "text/csv";
    fileName += ".csv";
    contentText = buildCsvExport(tasks, risks);
  }

  // Safety validation
  if (contentText && !validateImplementationPlanningExportSafety(contentText)) {
    const exportRecord = await createAgentPmoImplementationPlanningExport({
      workspaceId: normalized.workspaceId,
      planningWorkspaceId: normalized.planningWorkspaceId,
      exportFormat: normalized.exportFormat,
      status: "failed",
      fileName,
      contentType,
      contentText: null,
      contentJson: null,
      generatedBy: normalized.generatedBy ?? null,
    });
    return exportRecord;
  }

  const exportRecord = await createAgentPmoImplementationPlanningExport({
    workspaceId: normalized.workspaceId,
    planningWorkspaceId: normalized.planningWorkspaceId,
    exportFormat: normalized.exportFormat,
    status: "generated",
    fileName,
    contentType,
    contentText,
    contentJson,
    generatedBy: normalized.generatedBy ?? null,
  });

  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: normalized.workspaceId,
    planningWorkspaceId: normalized.planningWorkspaceId,
    exportId: exportRecord.id,
    eventType: "implementation_planning_export_created",
    message: `Implementation planning export created: ${normalized.exportFormat}`,
    eventPayload: { exportId: exportRecord.id, exportFormat: normalized.exportFormat },
    actorId: normalized.generatedBy ?? null,
  });

  return exportRecord;
}

function buildMarkdownExport(
  workspace: AgentPmoImplementationPlanningWorkspaceRecord | null,
  drafts: AgentPmoImplementationPlanDraftRecord[],
  tasks: AgentPmoImplementationTaskBreakdownRecord[],
  risks: AgentPmoImplementationRiskRecord[],
  decisions: AgentPmoImplementationPlanningDecisionRecord[],
): string {
  const lines: string[] = [
    "# Implementation Planning Workspace Export",
    "",
    "> **THIS EXPORT IS A PLANNING DOCUMENT ONLY. NO POLICY IMPLEMENTATION IS AUTHORIZED.**",
    "",
    "## NON-GOALS",
    "",
    "This document does NOT:",
    "- Apply policies or activate policy drafts",
    "- Change routing, risk scoring, or evidence requirements",
    "- Execute adapters, retry dispatch, or run dry-runs",
    "- Execute rollback or authorize any live system changes",
    "- Call LLMs, create embeddings, or train models",
    "- Call external APIs or create external tickets",
    "- Send communications, create calendar events, or mutate projects",
    "",
    "---",
    "",
  ];

  if (workspace) {
    lines.push("## Workspace");
    lines.push(`- **Title:** ${workspace.title}`);
    lines.push(`- **Status:** ${workspace.status}`);
    lines.push(`- **Summary:** ${workspace.summary}`);
    lines.push(`- **Planning Version:** ${workspace.planningVersion}`);
    lines.push("");
  }

  if (drafts.length > 0) {
    lines.push("## Implementation Plan Drafts");
    for (const draft of drafts) {
      lines.push(`### Plan v${draft.planVersion} (${draft.status})`);
      lines.push(`**Objective:** ${draft.implementationObjective}`);
      lines.push(`**Scope:** ${draft.implementationScope}`);
      lines.push(`**Non-Goals:** ${draft.nonGoals}`);
      if (draft.assumptions) lines.push(`**Assumptions:** ${draft.assumptions}`);
      if (draft.constraints) lines.push(`**Constraints:** ${draft.constraints}`);
      lines.push("");
    }
  }

  if (tasks.length > 0) {
    lines.push("## Task Breakdown");
    for (const task of tasks) {
      lines.push(`${task.taskOrder}. **${task.title}** (${task.status})`);
      lines.push(`   ${task.description}`);
    }
    lines.push("");
  }

  if (risks.length > 0) {
    lines.push("## Risk Register");
    for (const risk of risks) {
      lines.push(`- **${risk.riskType}** [${risk.severity}/${risk.status}]: ${risk.riskSummary}`);
      if (risk.mitigationSummary) lines.push(`  - Mitigation: ${risk.mitigationSummary}`);
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Decisions");
    for (const decision of decisions) {
      lines.push(`- **${decision.decision}** (${decision.decidedAt}): ${decision.rationale}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*THIS EXPORT IS A PLANNING DOCUMENT ONLY. NO POLICY IMPLEMENTATION IS AUTHORIZED.*");

  return lines.join("\n");
}

function buildCsvExport(
  tasks: AgentPmoImplementationTaskBreakdownRecord[],
  risks: AgentPmoImplementationRiskRecord[],
): string {
  const lines: string[] = [
    "type,key,status,summary",
    ...tasks.map((t) => `task,${t.taskType},${t.status},${JSON.stringify(t.title)}`),
    ...risks.map((r) => `risk,${r.riskType},${r.status},${JSON.stringify(r.riskSummary)}`),
  ];
  return lines.join("\n");
}

export async function archiveImplementationPlanningWorkspace(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  rationale: string;
  actorId?: string | null;
}): Promise<AgentPmoImplementationPlanningWorkspaceRecord | null> {
  const workspace = await updateAgentPmoImplementationPlanningWorkspaceStatus(
    input.workspaceId,
    input.planningWorkspaceId,
    "archived",
  );
  await recordAgentPmoImplementationPlanningEvent({
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    eventType: "implementation_planning_workspace_archived",
    message: `Implementation planning workspace archived`,
    eventPayload: { planningWorkspaceId: input.planningWorkspaceId },
    actorId: input.actorId ?? null,
  });
  return workspace;
}

export async function buildImplementationPlanningSummary(workspaceId: string): Promise<{
  totalWorkspaces: number;
  byStatus: Record<string, number>;
  totalDrafts: number;
  totalTasks: number;
  totalRisks: number;
  totalDecisions: number;
  totalExports: number;
  totalEvents: number;
}> {
  const workspaces = await listAgentPmoImplementationPlanningWorkspaces(workspaceId);
  const drafts = await listAgentPmoImplementationPlanDrafts(workspaceId);
  const tasks = await listAgentPmoImplementationTaskBreakdowns(workspaceId);
  const risks = await listAgentPmoImplementationRisks(workspaceId);
  const decisions = await listAgentPmoImplementationPlanningDecisions(workspaceId);
  const exports = await listAgentPmoImplementationPlanningExports(workspaceId);
  const events = await listAgentPmoImplementationPlanningEvents({ workspaceId });

  const byStatus: Record<string, number> = {};
  for (const ws of workspaces) {
    byStatus[ws.status] = (byStatus[ws.status] ?? 0) + 1;
  }

  return {
    totalWorkspaces: workspaces.length,
    byStatus,
    totalDrafts: drafts.length,
    totalTasks: tasks.length,
    totalRisks: risks.length,
    totalDecisions: decisions.length,
    totalExports: exports.length,
    totalEvents: events.length,
  };
}

export async function getImplementationPlanningData(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  actorId?: string | null;
}): Promise<{
  workspace: AgentPmoImplementationPlanningWorkspaceRecord | null;
  planDrafts: AgentPmoImplementationPlanDraftRecord[];
  taskBreakdown: AgentPmoImplementationTaskBreakdownRecord[];
  stakeholderReadiness: AgentPmoStakeholderReadinessRecord[];
  changeWindowPlans: AgentPmoChangeWindowPlanRecord[];
  riskRegister: AgentPmoImplementationRiskRecord[];
  rollbackRehearsalPlans: AgentPmoRollbackRehearsalPlanRecord[];
  gatePrerequisites: AgentPmoImplementationGatePrerequisiteRecord[];
  decisions: AgentPmoImplementationPlanningDecisionRecord[];
  exports: AgentPmoImplementationPlanningExportRecord[];
  events: AgentPmoImplementationPlanningEventRecord[];
  summary: Awaited<ReturnType<typeof buildImplementationPlanningSummary>>;
}> {
  const [
    workspace,
    planDrafts,
    taskBreakdown,
    stakeholderReadiness,
    changeWindowPlans,
    riskRegister,
    rollbackRehearsalPlans,
    gatePrerequisites,
    decisions,
    exports,
    events,
    summary,
  ] = await Promise.all([
    getAgentPmoImplementationPlanningWorkspaceById(input.workspaceId, input.planningWorkspaceId),
    listAgentPmoImplementationPlanDrafts(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoImplementationTaskBreakdowns(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoStakeholderReadiness(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoChangeWindowPlans(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoImplementationRisks(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoRollbackRehearsalPlans(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoImplementationGatePrerequisites(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoImplementationPlanningDecisions(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoImplementationPlanningExports(input.workspaceId, { planningWorkspaceId: input.planningWorkspaceId }),
    listAgentPmoImplementationPlanningEvents({ workspaceId: input.workspaceId, planningWorkspaceId: input.planningWorkspaceId }),
    buildImplementationPlanningSummary(input.workspaceId),
  ]);

  return {
    workspace,
    planDrafts,
    taskBreakdown,
    stakeholderReadiness,
    changeWindowPlans,
    riskRegister,
    rollbackRehearsalPlans,
    gatePrerequisites,
    decisions,
    exports,
    events,
    summary,
  };
}

// Re-export registry helpers needed by routes
export {
  getAgentPmoImplementationPlanningWorkspaceById,
  listAgentPmoImplementationPlanningWorkspaces,
  updateAgentPmoImplementationPlanningWorkspaceStatus,
  getAgentPmoImplementationPlanningExportById,
  listAgentPmoImplementationPlanningExports,
  listAgentPmoImplementationPlanDrafts,
  updateAgentPmoImplementationPlanDraftStatus,
  listAgentPmoImplementationTaskBreakdowns,
  updateAgentPmoImplementationTaskStatus,
  listAgentPmoStakeholderReadiness,
  updateAgentPmoStakeholderReadinessStatus,
  listAgentPmoChangeWindowPlans,
  updateAgentPmoChangeWindowStatus,
  listAgentPmoImplementationRisks,
  updateAgentPmoImplementationRiskStatus,
  listAgentPmoRollbackRehearsalPlans,
  updateAgentPmoRollbackRehearsalStatus,
  listAgentPmoImplementationGatePrerequisites,
  updateAgentPmoImplementationGatePrerequisiteStatus,
  listAgentPmoImplementationPlanningDecisions,
  listAgentPmoImplementationPlanningEvents,
} from "./agent-pmo-implementation-planning-registry";
