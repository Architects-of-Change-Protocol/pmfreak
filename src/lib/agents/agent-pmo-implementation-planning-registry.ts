// ─── PMO Controlled Policy Implementation Planning Workspace — Registry ─
// Pure in-memory store. Does not use Supabase.
// Events are append-only. Decisions are append-only.
// Does NOT apply policies, change routing, change risk scoring.
// Does NOT activate policy drafts, run dry-runs, or execute rollback.

import { randomUUID } from "node:crypto";
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
  AgentPmoImplementationPlanningWorkspaceStatus,
  AgentPmoImplementationPlanDraftStatus,
  AgentPmoImplementationTaskStatus,
  AgentPmoPreImplementationChecklistStatus,
  AgentPmoStakeholderReadinessStatus,
  AgentPmoChangeWindowStatus,
  AgentPmoImplementationRiskStatus,
  AgentPmoRollbackRehearsalStatus,
  AgentPmoImplementationGatePrerequisiteStatus,
  AgentPmoImplementationPlanningEventType,
} from "./agent-pmo-implementation-planning-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const planningWorkspaceStore = new Map<string, AgentPmoImplementationPlanningWorkspaceRecord>();
const planDraftStore = new Map<string, AgentPmoImplementationPlanDraftRecord>();
const taskBreakdownStore = new Map<string, AgentPmoImplementationTaskBreakdownRecord>();
const checklistStore = new Map<string, AgentPmoPreImplementationChecklistRecord>();
const checklistItemStore = new Map<string, AgentPmoPreImplementationChecklistItemRecord>();
const stakeholderReadinessStore = new Map<string, AgentPmoStakeholderReadinessRecord>();
const changeWindowPlanStore = new Map<string, AgentPmoChangeWindowPlanRecord>();
const implementationRiskStore = new Map<string, AgentPmoImplementationRiskRecord>();
const rollbackRehearsalPlanStore = new Map<string, AgentPmoRollbackRehearsalPlanRecord>();
const gatePrerequisiteStore = new Map<string, AgentPmoImplementationGatePrerequisiteRecord>();
const planningDecisionStore: AgentPmoImplementationPlanningDecisionRecord[] = [];
const planningExportStore = new Map<string, AgentPmoImplementationPlanningExportRecord>();
const planningEventStore: AgentPmoImplementationPlanningEventRecord[] = [];

export function _clearImplementationPlanningStores(): void {
  planningWorkspaceStore.clear();
  planDraftStore.clear();
  taskBreakdownStore.clear();
  checklistStore.clear();
  checklistItemStore.clear();
  stakeholderReadinessStore.clear();
  changeWindowPlanStore.clear();
  implementationRiskStore.clear();
  rollbackRehearsalPlanStore.clear();
  gatePrerequisiteStore.clear();
  planningDecisionStore.length = 0;
  planningExportStore.clear();
  planningEventStore.length = 0;
}

// ─── Planning Workspaces ──────────────────────────────────────────────────────

export async function createAgentPmoImplementationPlanningWorkspace(input: {
  workspaceId: string;
  approvalPackId: string | null;
  changeRequestId?: string | null;
  signoffPacketId?: string | null;
  implementationTicketDraftId?: string | null;
  planningOwnerRole?: AgentPmoImplementationPlanningWorkspaceRecord["planningOwnerRole"];
  status?: AgentPmoImplementationPlanningWorkspaceStatus;
  title: string;
  summary: string;
  safePlanningPayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoImplementationPlanningWorkspaceRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoImplementationPlanningWorkspaceRecord = {
    id,
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId ?? null,
    signoffPacketId: input.signoffPacketId ?? null,
    implementationTicketDraftId: input.implementationTicketDraftId ?? null,
    planningOwnerRole: input.planningOwnerRole ?? null,
    planningVersion: 1,
    status: input.status ?? "created",
    title: input.title,
    summary: input.summary,
    safePlanningPayload: input.safePlanningPayload ?? {},
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  planningWorkspaceStore.set(id, record);
  return record;
}

export async function getAgentPmoImplementationPlanningWorkspaceById(
  workspaceId: string,
  planningWorkspaceId: string,
): Promise<AgentPmoImplementationPlanningWorkspaceRecord | null> {
  const record = planningWorkspaceStore.get(planningWorkspaceId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listAgentPmoImplementationPlanningWorkspaces(
  workspaceId: string,
  filters: { status?: AgentPmoImplementationPlanningWorkspaceStatus; limit?: number } = {},
): Promise<AgentPmoImplementationPlanningWorkspaceRecord[]> {
  let results = [...planningWorkspaceStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoImplementationPlanningWorkspaceStatus(
  workspaceId: string,
  planningWorkspaceId: string,
  status: AgentPmoImplementationPlanningWorkspaceStatus,
): Promise<AgentPmoImplementationPlanningWorkspaceRecord | null> {
  const record = planningWorkspaceStore.get(planningWorkspaceId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  planningWorkspaceStore.set(planningWorkspaceId, updated);
  return updated;
}

// ─── Plan Drafts ──────────────────────────────────────────────────────────────

export async function createAgentPmoImplementationPlanDraft(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId?: string | null;
  changeRequestId?: string | null;
  status?: AgentPmoImplementationPlanDraftStatus;
  implementationObjective: string;
  implementationScope: string;
  nonGoals: string;
  assumptions?: string;
  constraints?: string;
  safePlanPayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoImplementationPlanDraftRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const existing = [...planDraftStore.values()].filter(
    (d) => d.workspaceId === input.workspaceId && d.planningWorkspaceId === input.planningWorkspaceId,
  );
  const planVersion = existing.length + 1;
  const record: AgentPmoImplementationPlanDraftRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId ?? null,
    planVersion,
    status: input.status ?? "created",
    implementationObjective: input.implementationObjective,
    implementationScope: input.implementationScope,
    nonGoals: input.nonGoals,
    assumptions: input.assumptions ?? "",
    constraints: input.constraints ?? "",
    safePlanPayload: input.safePlanPayload ?? {},
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  planDraftStore.set(id, record);
  return record;
}

export async function getAgentPmoImplementationPlanDraftById(
  workspaceId: string,
  planDraftId: string,
): Promise<AgentPmoImplementationPlanDraftRecord | null> {
  const record = planDraftStore.get(planDraftId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listAgentPmoImplementationPlanDrafts(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; status?: AgentPmoImplementationPlanDraftStatus; limit?: number } = {},
): Promise<AgentPmoImplementationPlanDraftRecord[]> {
  let results = [...planDraftStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoImplementationPlanDraftStatus(
  workspaceId: string,
  planDraftId: string,
  status: AgentPmoImplementationPlanDraftStatus,
): Promise<AgentPmoImplementationPlanDraftRecord | null> {
  const record = planDraftStore.get(planDraftId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  planDraftStore.set(planDraftId, updated);
  return updated;
}

// ─── Task Breakdowns ──────────────────────────────────────────────────────────

export async function createAgentPmoImplementationTaskBreakdown(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  planDraftId?: string | null;
  taskType: AgentPmoImplementationTaskBreakdownRecord["taskType"];
  status?: AgentPmoImplementationTaskStatus;
  taskOrder: number;
  title: string;
  description: string;
  ownerRole?: AgentPmoImplementationTaskBreakdownRecord["ownerRole"];
  blockingReason?: string | null;
  safeTaskPayload?: Record<string, unknown>;
}): Promise<AgentPmoImplementationTaskBreakdownRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoImplementationTaskBreakdownRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    planDraftId: input.planDraftId ?? null,
    taskType: input.taskType,
    status: input.status ?? "planned",
    taskOrder: input.taskOrder,
    title: input.title,
    description: input.description,
    ownerRole: input.ownerRole ?? null,
    blockingReason: input.blockingReason ?? null,
    safeTaskPayload: input.safeTaskPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  taskBreakdownStore.set(id, record);
  return record;
}

export async function listAgentPmoImplementationTaskBreakdowns(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; planDraftId?: string; limit?: number } = {},
): Promise<AgentPmoImplementationTaskBreakdownRecord[]> {
  let results = [...taskBreakdownStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  if (filters.planDraftId) results = results.filter((r) => r.planDraftId === filters.planDraftId);
  results.sort((a, b) => a.taskOrder - b.taskOrder);
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoImplementationTaskStatus(
  workspaceId: string,
  taskId: string,
  status: AgentPmoImplementationTaskStatus,
  blockingReason?: string | null,
): Promise<AgentPmoImplementationTaskBreakdownRecord | null> {
  const record = taskBreakdownStore.get(taskId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = {
    ...record,
    status,
    blockingReason: blockingReason ?? record.blockingReason,
    updatedAt: new Date().toISOString(),
  };
  taskBreakdownStore.set(taskId, updated);
  return updated;
}

// ─── Pre-Implementation Checklists ────────────────────────────────────────────

export async function createAgentPmoPreImplementationChecklist(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId?: string | null;
  status?: AgentPmoPreImplementationChecklistStatus;
  totalItems?: number;
  passedItems?: number;
  failedItems?: number;
  blockedItems?: number;
}): Promise<AgentPmoPreImplementationChecklistRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoPreImplementationChecklistRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    approvalPackId: input.approvalPackId ?? null,
    status: input.status ?? "not_started",
    totalItems: input.totalItems ?? 0,
    passedItems: input.passedItems ?? 0,
    failedItems: input.failedItems ?? 0,
    blockedItems: input.blockedItems ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  checklistStore.set(id, record);
  return record;
}

export async function updateAgentPmoPreImplementationChecklistCounts(
  workspaceId: string,
  checklistId: string,
  counts: { totalItems: number; passedItems: number; failedItems: number; blockedItems: number; status: AgentPmoPreImplementationChecklistStatus },
): Promise<AgentPmoPreImplementationChecklistRecord | null> {
  const record = checklistStore.get(checklistId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, ...counts, updatedAt: new Date().toISOString() };
  checklistStore.set(checklistId, updated);
  return updated;
}

export async function createAgentPmoPreImplementationChecklistItem(input: {
  workspaceId: string;
  checklistId: string;
  itemKey: string;
  itemLabel: string;
  status?: AgentPmoPreImplementationChecklistStatus;
  sourceRecordId?: string | null;
  blockingReason?: string | null;
}): Promise<AgentPmoPreImplementationChecklistItemRecord> {
  const id = randomUUID();
  const record: AgentPmoPreImplementationChecklistItemRecord = {
    id,
    workspaceId: input.workspaceId,
    checklistId: input.checklistId,
    itemKey: input.itemKey,
    itemLabel: input.itemLabel,
    status: input.status ?? "not_started",
    sourceRecordId: input.sourceRecordId ?? null,
    blockingReason: input.blockingReason ?? null,
    createdAt: new Date().toISOString(),
  };
  checklistItemStore.set(id, record);
  return record;
}

export async function listAgentPmoPreImplementationChecklistItems(
  workspaceId: string,
  checklistId: string,
): Promise<AgentPmoPreImplementationChecklistItemRecord[]> {
  return [...checklistItemStore.values()].filter(
    (r) => r.workspaceId === workspaceId && r.checklistId === checklistId,
  );
}

// ─── Stakeholder Readiness ────────────────────────────────────────────────────

export async function createAgentPmoStakeholderReadiness(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  stakeholderRole: AgentPmoStakeholderReadinessRecord["stakeholderRole"];
  status?: AgentPmoStakeholderReadinessStatus;
  rationale?: string | null;
  acknowledgedBy?: string | null;
}): Promise<AgentPmoStakeholderReadinessRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoStakeholderReadinessRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    stakeholderRole: input.stakeholderRole,
    status: input.status ?? "pending",
    rationale: input.rationale ?? null,
    acknowledgedBy: input.acknowledgedBy ?? null,
    acknowledgedAt: input.acknowledgedBy ? now : null,
    createdAt: now,
    updatedAt: now,
  };
  stakeholderReadinessStore.set(id, record);
  return record;
}

export async function listAgentPmoStakeholderReadiness(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; limit?: number } = {},
): Promise<AgentPmoStakeholderReadinessRecord[]> {
  let results = [...stakeholderReadinessStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoStakeholderReadinessStatus(
  workspaceId: string,
  readinessId: string,
  status: AgentPmoStakeholderReadinessStatus,
  acknowledgedBy?: string | null,
): Promise<AgentPmoStakeholderReadinessRecord | null> {
  const record = stakeholderReadinessStore.get(readinessId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const now = new Date().toISOString();
  const updated: AgentPmoStakeholderReadinessRecord = {
    ...record,
    status,
    acknowledgedBy: acknowledgedBy ?? record.acknowledgedBy,
    acknowledgedAt: acknowledgedBy ? now : record.acknowledgedAt,
    updatedAt: now,
  };
  stakeholderReadinessStore.set(readinessId, updated);
  return updated;
}

// ─── Change Window Plans ──────────────────────────────────────────────────────

export async function createAgentPmoChangeWindowPlan(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  changeRequestId?: string | null;
  windowType: AgentPmoChangeWindowPlanRecord["windowType"];
  status?: AgentPmoChangeWindowStatus;
  proposedStartAt?: string | null;
  proposedEndAt?: string | null;
  timezone?: string | null;
  businessImpactEstimate?: string | null;
  operationalConstraints?: string | null;
  approvalRequired?: boolean;
  safeWindowPayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoChangeWindowPlanRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoChangeWindowPlanRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    changeRequestId: input.changeRequestId ?? null,
    windowType: input.windowType,
    status: input.status ?? "draft",
    proposedStartAt: input.proposedStartAt ?? null,
    proposedEndAt: input.proposedEndAt ?? null,
    timezone: input.timezone ?? null,
    businessImpactEstimate: input.businessImpactEstimate ?? null,
    operationalConstraints: input.operationalConstraints ?? null,
    approvalRequired: input.approvalRequired ?? true,
    safeWindowPayload: input.safeWindowPayload ?? {},
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  changeWindowPlanStore.set(id, record);
  return record;
}

export async function listAgentPmoChangeWindowPlans(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; limit?: number } = {},
): Promise<AgentPmoChangeWindowPlanRecord[]> {
  let results = [...changeWindowPlanStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoChangeWindowStatus(
  workspaceId: string,
  changeWindowId: string,
  status: AgentPmoChangeWindowStatus,
): Promise<AgentPmoChangeWindowPlanRecord | null> {
  const record = changeWindowPlanStore.get(changeWindowId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  changeWindowPlanStore.set(changeWindowId, updated);
  return updated;
}

// ─── Implementation Risks ─────────────────────────────────────────────────────

export async function createAgentPmoImplementationRisk(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  riskType: AgentPmoImplementationRiskRecord["riskType"];
  severity: AgentPmoImplementationRiskRecord["severity"];
  status?: AgentPmoImplementationRiskStatus;
  riskSummary: string;
  mitigationSummary?: string | null;
  ownerRole?: AgentPmoImplementationRiskRecord["ownerRole"];
  safeRiskPayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoImplementationRiskRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoImplementationRiskRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    riskType: input.riskType,
    severity: input.severity,
    status: input.status ?? "open",
    riskSummary: input.riskSummary,
    mitigationSummary: input.mitigationSummary ?? null,
    ownerRole: input.ownerRole ?? null,
    safeRiskPayload: input.safeRiskPayload ?? {},
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  implementationRiskStore.set(id, record);
  return record;
}

export async function listAgentPmoImplementationRisks(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; status?: AgentPmoImplementationRiskStatus; limit?: number } = {},
): Promise<AgentPmoImplementationRiskRecord[]> {
  let results = [...implementationRiskStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoImplementationRiskStatus(
  workspaceId: string,
  riskId: string,
  status: AgentPmoImplementationRiskStatus,
): Promise<AgentPmoImplementationRiskRecord | null> {
  const record = implementationRiskStore.get(riskId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  implementationRiskStore.set(riskId, updated);
  return updated;
}

// ─── Rollback Rehearsal Plans ─────────────────────────────────────────────────

export async function createAgentPmoRollbackRehearsalPlan(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  rollbackPlanId?: string | null;
  rehearsalType: AgentPmoRollbackRehearsalPlanRecord["rehearsalType"];
  status?: AgentPmoRollbackRehearsalStatus;
  rehearsalSummary: string;
  verificationSteps?: string[];
  expectedEvidence?: string[];
  blockingReasons?: string[];
  safeRehearsalPayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoRollbackRehearsalPlanRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoRollbackRehearsalPlanRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    rollbackPlanId: input.rollbackPlanId ?? null,
    rehearsalType: input.rehearsalType,
    status: input.status ?? "created",
    rehearsalSummary: input.rehearsalSummary,
    verificationSteps: input.verificationSteps ?? [],
    expectedEvidence: input.expectedEvidence ?? [],
    blockingReasons: input.blockingReasons ?? [],
    safeRehearsalPayload: input.safeRehearsalPayload ?? {},
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  rollbackRehearsalPlanStore.set(id, record);
  return record;
}

export async function listAgentPmoRollbackRehearsalPlans(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; limit?: number } = {},
): Promise<AgentPmoRollbackRehearsalPlanRecord[]> {
  let results = [...rollbackRehearsalPlanStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoRollbackRehearsalStatus(
  workspaceId: string,
  rehearsalPlanId: string,
  status: AgentPmoRollbackRehearsalStatus,
): Promise<AgentPmoRollbackRehearsalPlanRecord | null> {
  const record = rollbackRehearsalPlanStore.get(rehearsalPlanId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  rollbackRehearsalPlanStore.set(rehearsalPlanId, updated);
  return updated;
}

// ─── Gate Prerequisites ───────────────────────────────────────────────────────

export async function createAgentPmoImplementationGatePrerequisite(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  prerequisiteType: AgentPmoImplementationGatePrerequisiteRecord["prerequisiteType"];
  status?: AgentPmoImplementationGatePrerequisiteStatus;
  rationale?: string | null;
  sourceRecordId?: string | null;
  createdBy?: string | null;
}): Promise<AgentPmoImplementationGatePrerequisiteRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoImplementationGatePrerequisiteRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    prerequisiteType: input.prerequisiteType,
    status: input.status ?? "pending",
    rationale: input.rationale ?? null,
    sourceRecordId: input.sourceRecordId ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  gatePrerequisiteStore.set(id, record);
  return record;
}

export async function listAgentPmoImplementationGatePrerequisites(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; limit?: number } = {},
): Promise<AgentPmoImplementationGatePrerequisiteRecord[]> {
  let results = [...gatePrerequisiteStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoImplementationGatePrerequisiteStatus(
  workspaceId: string,
  prerequisiteId: string,
  status: AgentPmoImplementationGatePrerequisiteStatus,
  rationale?: string | null,
): Promise<AgentPmoImplementationGatePrerequisiteRecord | null> {
  const record = gatePrerequisiteStore.get(prerequisiteId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = {
    ...record,
    status,
    rationale: rationale ?? record.rationale,
    updatedAt: new Date().toISOString(),
  };
  gatePrerequisiteStore.set(prerequisiteId, updated);
  return updated;
}

// ─── Planning Decisions (append-only) ────────────────────────────────────────

export async function recordAgentPmoImplementationPlanningDecision(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  decision: AgentPmoImplementationPlanningDecisionRecord["decision"];
  rationale: string;
  decidedBy?: string | null;
}): Promise<AgentPmoImplementationPlanningDecisionRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoImplementationPlanningDecisionRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    decision: input.decision,
    rationale: input.rationale,
    decidedBy: input.decidedBy ?? null,
    decidedAt: now,
    createdAt: now,
  };
  planningDecisionStore.push(record);
  return record;
}

export async function listAgentPmoImplementationPlanningDecisions(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; limit?: number } = {},
): Promise<AgentPmoImplementationPlanningDecisionRecord[]> {
  let results = planningDecisionStore.filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  results = [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

// ─── Planning Exports ─────────────────────────────────────────────────────────

export async function createAgentPmoImplementationPlanningExport(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  exportFormat: AgentPmoImplementationPlanningExportRecord["exportFormat"];
  status?: AgentPmoImplementationPlanningExportRecord["status"];
  fileName: string;
  contentType: string;
  contentText?: string | null;
  contentJson?: Record<string, unknown> | null;
  safeExportPayload?: Record<string, unknown>;
  generatedBy?: string | null;
}): Promise<AgentPmoImplementationPlanningExportRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoImplementationPlanningExportRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    exportFormat: input.exportFormat,
    status: input.status ?? "created",
    fileName: input.fileName,
    contentType: input.contentType,
    contentText: input.contentText ?? null,
    contentJson: input.contentJson ?? null,
    safeExportPayload: input.safeExportPayload ?? {},
    generatedBy: input.generatedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  planningExportStore.set(id, record);
  return record;
}

export async function getAgentPmoImplementationPlanningExportById(
  workspaceId: string,
  exportId: string,
): Promise<AgentPmoImplementationPlanningExportRecord | null> {
  const record = planningExportStore.get(exportId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listAgentPmoImplementationPlanningExports(
  workspaceId: string,
  filters: { planningWorkspaceId?: string; limit?: number } = {},
): Promise<AgentPmoImplementationPlanningExportRecord[]> {
  let results = [...planningExportStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.planningWorkspaceId) results = results.filter((r) => r.planningWorkspaceId === filters.planningWorkspaceId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentPmoImplementationPlanningExportStatus(
  workspaceId: string,
  exportId: string,
  status: AgentPmoImplementationPlanningExportRecord["status"],
): Promise<AgentPmoImplementationPlanningExportRecord | null> {
  const record = planningExportStore.get(exportId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  planningExportStore.set(exportId, updated);
  return updated;
}

// ─── Events (append-only) ─────────────────────────────────────────────────────

export async function recordAgentPmoImplementationPlanningEvent(input: {
  workspaceId: string;
  planningWorkspaceId?: string | null;
  planDraftId?: string | null;
  checklistId?: string | null;
  exportId?: string | null;
  eventType: AgentPmoImplementationPlanningEventType;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
  actorId?: string | null;
}): Promise<AgentPmoImplementationPlanningEventRecord> {
  const id = randomUUID();
  const record: AgentPmoImplementationPlanningEventRecord = {
    id,
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId ?? null,
    planDraftId: input.planDraftId ?? null,
    checklistId: input.checklistId ?? null,
    exportId: input.exportId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    eventPayload: input.eventPayload ?? null,
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  planningEventStore.push(record);
  return record;
}

export async function listAgentPmoImplementationPlanningEvents(input: {
  workspaceId: string;
  planningWorkspaceId?: string;
  eventType?: AgentPmoImplementationPlanningEventType;
  limit?: number;
}): Promise<AgentPmoImplementationPlanningEventRecord[]> {
  let results = planningEventStore.filter((e) => e.workspaceId === input.workspaceId);
  if (input.planningWorkspaceId) results = results.filter((e) => e.planningWorkspaceId === input.planningWorkspaceId);
  if (input.eventType) results = results.filter((e) => e.eventType === input.eventType);
  results = [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (input.limit) results = results.slice(0, input.limit);
  return results;
}
