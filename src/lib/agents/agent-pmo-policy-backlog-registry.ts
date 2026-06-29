// ─── PMO Governance Proposal Review & Controlled Policy Change Backlog — Registry
// Pure in-memory store. Does not use Supabase.
// Backlog items are append-only. Events are append-only.
// Approval decisions are append-only. Drafts are versioned.
// Proposals are NOT applied automatically.

import { randomUUID } from "node:crypto";
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
  AgentPmoPolicyBacklogEventRecord,
  AgentPmoPolicyBacklogItemStatus,
  AgentPmoPolicyChangeRequestStatus,
  AgentPmoPolicySimulationStatus,
  AgentPmoGovernancePolicyDraftStatus,
  AgentPmoPolicyApprovalStage,
  AgentPmoPolicyApprovalStatus,
  AgentPmoPolicyApprovalDecisionType,
  AgentPmoPolicyRollbackPlanStatus,
  AgentPmoPolicyBacklogEventType,
} from "./agent-pmo-policy-backlog-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const backlogItemStore = new Map<string, AgentPmoPolicyBacklogItemRecord>();
const changeRequestStore = new Map<string, AgentPmoPolicyChangeRequestRecord>();
const changeScopeStore = new Map<string, AgentPmoPolicyChangeScopeRecord>();
const simulationStore = new Map<string, AgentPmoPolicySimulationRecord>();
const impactPreviewStore = new Map<string, AgentPmoPolicyImpactPreviewRecord>();
const policyDraftStore = new Map<string, AgentPmoGovernancePolicyDraftRecord>();
const approvalWorkflowStore = new Map<string, AgentPmoPolicyApprovalWorkflowRecord>();
const approvalDecisionStore: AgentPmoPolicyApprovalDecisionRecord[] = [];
const implementationReadinessStore = new Map<string, AgentPmoPolicyImplementationReadinessRecord>();
const rollbackPlanStore = new Map<string, AgentPmoPolicyRollbackPlanRecord>();
const policyBacklogEventStore: AgentPmoPolicyBacklogEventRecord[] = [];

export function _clearPolicyBacklogStores(): void {
  backlogItemStore.clear();
  changeRequestStore.clear();
  changeScopeStore.clear();
  simulationStore.clear();
  impactPreviewStore.clear();
  policyDraftStore.clear();
  approvalWorkflowStore.clear();
  approvalDecisionStore.length = 0;
  implementationReadinessStore.clear();
  rollbackPlanStore.clear();
  policyBacklogEventStore.length = 0;
}

// ─── Backlog Items ────────────────────────────────────────────────────────────

export async function createPolicyBacklogItem(input: {
  workspaceId: string;
  sourceProposalId?: string | null;
  itemType: AgentPmoPolicyBacklogItemRecord["itemType"];
  itemCategory: string;
  priority?: AgentPmoPolicyBacklogItemRecord["priority"];
  status?: AgentPmoPolicyBacklogItemStatus;
  title: string;
  description: string;
  sourceSignalCount?: number;
  sourceFeedbackIds?: string[];
  sourceSignalIds?: string[];
  relatedAdapterKeys?: string[];
  estimatedImpactLevel?: AgentPmoPolicyBacklogItemRecord["estimatedImpactLevel"];
  createdBy?: string | null;
}): Promise<AgentPmoPolicyBacklogItemRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoPolicyBacklogItemRecord = {
    id,
    workspaceId: input.workspaceId,
    sourceProposalId: input.sourceProposalId ?? null,
    itemType: input.itemType,
    itemCategory: input.itemCategory,
    priority: input.priority ?? "normal",
    status: input.status ?? "created",
    title: input.title,
    description: input.description,
    sourceSignalCount: input.sourceSignalCount ?? 0,
    sourceFeedbackIds: input.sourceFeedbackIds ?? [],
    sourceSignalIds: input.sourceSignalIds ?? [],
    relatedAdapterKeys: input.relatedAdapterKeys ?? [],
    estimatedImpactLevel: input.estimatedImpactLevel ?? "low",
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  backlogItemStore.set(id, record);
  return record;
}

export async function getPolicyBacklogItemById(
  workspaceId: string,
  itemId: string,
): Promise<AgentPmoPolicyBacklogItemRecord | null> {
  const record = backlogItemStore.get(itemId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listPolicyBacklogItems(
  workspaceId: string,
  filters: { status?: AgentPmoPolicyBacklogItemStatus; itemType?: string; priority?: string; limit?: number } = {},
): Promise<AgentPmoPolicyBacklogItemRecord[]> {
  let results = [...backlogItemStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  if (filters.itemType) results = results.filter((r) => r.itemType === filters.itemType);
  if (filters.priority) results = results.filter((r) => r.priority === filters.priority);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updatePolicyBacklogItemStatus(
  workspaceId: string,
  itemId: string,
  status: AgentPmoPolicyBacklogItemStatus,
): Promise<AgentPmoPolicyBacklogItemRecord | null> {
  const record = backlogItemStore.get(itemId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  backlogItemStore.set(itemId, updated);
  return updated;
}

// ─── Change Requests ──────────────────────────────────────────────────────────

export async function createPolicyChangeRequest(input: {
  workspaceId: string;
  backlogItemId: string;
  status?: AgentPmoPolicyChangeRequestStatus;
  policyArea: string;
  changeSummary: string;
  changeRationale: string;
  estimatedImpactLevel?: AgentPmoPolicyChangeRequestRecord["estimatedImpactLevel"];
  createdBy?: string | null;
}): Promise<AgentPmoPolicyChangeRequestRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoPolicyChangeRequestRecord = {
    id,
    workspaceId: input.workspaceId,
    backlogItemId: input.backlogItemId,
    status: input.status ?? "draft",
    policyArea: input.policyArea,
    changeSummary: input.changeSummary,
    changeRationale: input.changeRationale,
    estimatedImpactLevel: input.estimatedImpactLevel ?? "low",
    simulationCount: 0,
    approvalWorkflowId: null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  changeRequestStore.set(id, record);
  return record;
}

export async function getPolicyChangeRequestById(
  workspaceId: string,
  changeRequestId: string,
): Promise<AgentPmoPolicyChangeRequestRecord | null> {
  const record = changeRequestStore.get(changeRequestId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listPolicyChangeRequests(
  workspaceId: string,
  filters: { status?: AgentPmoPolicyChangeRequestStatus; backlogItemId?: string; limit?: number } = {},
): Promise<AgentPmoPolicyChangeRequestRecord[]> {
  let results = [...changeRequestStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  if (filters.backlogItemId) results = results.filter((r) => r.backlogItemId === filters.backlogItemId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updatePolicyChangeRequestStatus(
  workspaceId: string,
  changeRequestId: string,
  status: AgentPmoPolicyChangeRequestStatus,
  updates?: { approvalWorkflowId?: string; simulationCount?: number },
): Promise<AgentPmoPolicyChangeRequestRecord | null> {
  const record = changeRequestStore.get(changeRequestId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated: AgentPmoPolicyChangeRequestRecord = {
    ...record,
    status,
    approvalWorkflowId: updates?.approvalWorkflowId ?? record.approvalWorkflowId,
    simulationCount: updates?.simulationCount ?? record.simulationCount,
    updatedAt: new Date().toISOString(),
  };
  changeRequestStore.set(changeRequestId, updated);
  return updated;
}

// ─── Change Scopes ────────────────────────────────────────────────────────────

export async function createPolicyChangeScope(input: {
  workspaceId: string;
  changeRequestId: string;
  scopeType: AgentPmoPolicyChangeScopeRecord["scopeType"];
  scopeDescription: string;
  affectedPolicyKeys?: string[];
  affectedAdapterKeys?: string[];
  estimatedRecordsAffected?: number;
}): Promise<AgentPmoPolicyChangeScopeRecord> {
  const id = randomUUID();
  const record: AgentPmoPolicyChangeScopeRecord = {
    id,
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    scopeType: input.scopeType,
    scopeDescription: input.scopeDescription,
    affectedPolicyKeys: input.affectedPolicyKeys ?? [],
    affectedAdapterKeys: input.affectedAdapterKeys ?? [],
    estimatedRecordsAffected: input.estimatedRecordsAffected ?? 0,
    createdAt: new Date().toISOString(),
  };
  changeScopeStore.set(id, record);
  return record;
}

export async function listPolicyChangeScopes(
  workspaceId: string,
  changeRequestId: string,
): Promise<AgentPmoPolicyChangeScopeRecord[]> {
  return [...changeScopeStore.values()].filter(
    (r) => r.workspaceId === workspaceId && r.changeRequestId === changeRequestId,
  );
}

// ─── Simulations ──────────────────────────────────────────────────────────────

export async function createPolicySimulation(input: {
  workspaceId: string;
  changeRequestId: string;
  status?: AgentPmoPolicySimulationStatus;
  simulationLabel: string;
  signalCountUsed?: number;
  estimatedAffectedCount?: number;
  estimatedApprovalRateChange?: number;
  estimatedRejectionRateChange?: number;
  estimatedReviewVolumeChange?: number;
  impactLevel?: AgentPmoPolicySimulationRecord["impactLevel"];
  safeSimulationSummary?: string;
}): Promise<AgentPmoPolicySimulationRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoPolicySimulationRecord = {
    id,
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    status: input.status ?? "created",
    simulationLabel: input.simulationLabel,
    signalCountUsed: input.signalCountUsed ?? 0,
    estimatedAffectedCount: input.estimatedAffectedCount ?? 0,
    estimatedApprovalRateChange: input.estimatedApprovalRateChange ?? 0,
    estimatedRejectionRateChange: input.estimatedRejectionRateChange ?? 0,
    estimatedReviewVolumeChange: input.estimatedReviewVolumeChange ?? 0,
    impactLevel: input.impactLevel ?? "none",
    safeSimulationSummary: input.safeSimulationSummary ?? "",
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  simulationStore.set(id, record);
  return record;
}

export async function getPolicySimulationById(
  workspaceId: string,
  simulationId: string,
): Promise<AgentPmoPolicySimulationRecord | null> {
  const record = simulationStore.get(simulationId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listPolicySimulations(
  workspaceId: string,
  filters: { changeRequestId?: string; status?: AgentPmoPolicySimulationStatus; limit?: number } = {},
): Promise<AgentPmoPolicySimulationRecord[]> {
  let results = [...simulationStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.changeRequestId) results = results.filter((r) => r.changeRequestId === filters.changeRequestId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function completePolicySimulation(
  workspaceId: string,
  simulationId: string,
  updates: {
    estimatedAffectedCount: number;
    estimatedApprovalRateChange: number;
    estimatedRejectionRateChange: number;
    estimatedReviewVolumeChange: number;
    impactLevel: AgentPmoPolicySimulationRecord["impactLevel"];
    safeSimulationSummary: string;
  },
): Promise<AgentPmoPolicySimulationRecord | null> {
  const record = simulationStore.get(simulationId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const now = new Date().toISOString();
  const updated: AgentPmoPolicySimulationRecord = {
    ...record,
    ...updates,
    status: "completed",
    completedAt: now,
    updatedAt: now,
  };
  simulationStore.set(simulationId, updated);
  return updated;
}

// ─── Impact Previews ──────────────────────────────────────────────────────────

export async function createPolicyImpactPreview(input: {
  workspaceId: string;
  changeRequestId: string;
  simulationId?: string | null;
  impactLevel: AgentPmoPolicyImpactPreviewRecord["impactLevel"];
  affectedAreaCount?: number;
  estimatedSignalCount?: number;
  deterministicSummary: string;
  safeImpactJson?: Record<string, unknown>;
}): Promise<AgentPmoPolicyImpactPreviewRecord> {
  const id = randomUUID();
  const record: AgentPmoPolicyImpactPreviewRecord = {
    id,
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    simulationId: input.simulationId ?? null,
    impactLevel: input.impactLevel,
    affectedAreaCount: input.affectedAreaCount ?? 0,
    estimatedSignalCount: input.estimatedSignalCount ?? 0,
    deterministicSummary: input.deterministicSummary,
    safeImpactJson: input.safeImpactJson ?? {},
    createdAt: new Date().toISOString(),
  };
  impactPreviewStore.set(id, record);
  return record;
}

export async function listPolicyImpactPreviews(
  workspaceId: string,
  changeRequestId: string,
): Promise<AgentPmoPolicyImpactPreviewRecord[]> {
  return [...impactPreviewStore.values()].filter(
    (r) => r.workspaceId === workspaceId && r.changeRequestId === changeRequestId,
  );
}

// ─── Policy Drafts (versioned) ────────────────────────────────────────────────

export async function createVersionedPolicyDraft(input: {
  workspaceId: string;
  changeRequestId: string;
  draftType: AgentPmoGovernancePolicyDraftRecord["draftType"];
  draftStatus?: AgentPmoGovernancePolicyDraftStatus;
  draftTitle: string;
  draftSummary: string;
  approvalWorkflowId?: string | null;
  createdBy?: string | null;
}): Promise<AgentPmoGovernancePolicyDraftRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  // Determine next draft_version
  const existingDrafts = [...policyDraftStore.values()].filter(
    (d) => d.workspaceId === input.workspaceId && d.changeRequestId === input.changeRequestId,
  );
  const maxVersion = existingDrafts.reduce((max, d) => Math.max(max, d.draftVersion), 0);
  const draftVersion = maxVersion + 1;

  const record: AgentPmoGovernancePolicyDraftRecord = {
    id,
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    draftType: input.draftType,
    draftStatus: input.draftStatus ?? "created",
    draftVersion,
    draftTitle: input.draftTitle,
    draftSummary: input.draftSummary,
    isLivePolicy: false,
    approvalWorkflowId: input.approvalWorkflowId ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  policyDraftStore.set(id, record);
  return record;
}

export async function getPolicyDraftById(
  workspaceId: string,
  draftId: string,
): Promise<AgentPmoGovernancePolicyDraftRecord | null> {
  const record = policyDraftStore.get(draftId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listPolicyDrafts(
  workspaceId: string,
  filters: { changeRequestId?: string; draftStatus?: AgentPmoGovernancePolicyDraftStatus; limit?: number } = {},
): Promise<AgentPmoGovernancePolicyDraftRecord[]> {
  let results = [...policyDraftStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.changeRequestId) results = results.filter((r) => r.changeRequestId === filters.changeRequestId);
  if (filters.draftStatus) results = results.filter((r) => r.draftStatus === filters.draftStatus);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updatePolicyDraftStatus(
  workspaceId: string,
  draftId: string,
  draftStatus: AgentPmoGovernancePolicyDraftStatus,
): Promise<AgentPmoGovernancePolicyDraftRecord | null> {
  const record = policyDraftStore.get(draftId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, draftStatus, updatedAt: new Date().toISOString() };
  policyDraftStore.set(draftId, updated);
  return updated;
}

// ─── Approval Workflows ───────────────────────────────────────────────────────

export async function createPolicyApprovalWorkflow(input: {
  workspaceId: string;
  changeRequestId: string;
  currentStage?: AgentPmoPolicyApprovalStage;
  overallStatus?: AgentPmoPolicyApprovalStatus;
  requiredStages?: AgentPmoPolicyApprovalStage[];
  createdBy?: string | null;
}): Promise<AgentPmoPolicyApprovalWorkflowRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoPolicyApprovalWorkflowRecord = {
    id,
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    currentStage: input.currentStage ?? "pmo_review",
    overallStatus: input.overallStatus ?? "pending",
    requiredStages: input.requiredStages ?? ["pmo_review", "final_pmo_approval"],
    completedStages: [],
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  approvalWorkflowStore.set(id, record);
  return record;
}

export async function getPolicyApprovalWorkflowById(
  workspaceId: string,
  workflowId: string,
): Promise<AgentPmoPolicyApprovalWorkflowRecord | null> {
  const record = approvalWorkflowStore.get(workflowId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listPolicyApprovalWorkflows(
  workspaceId: string,
  filters: { changeRequestId?: string; overallStatus?: AgentPmoPolicyApprovalStatus; limit?: number } = {},
): Promise<AgentPmoPolicyApprovalWorkflowRecord[]> {
  let results = [...approvalWorkflowStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.changeRequestId) results = results.filter((r) => r.changeRequestId === filters.changeRequestId);
  if (filters.overallStatus) results = results.filter((r) => r.overallStatus === filters.overallStatus);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updatePolicyApprovalWorkflowStage(
  workspaceId: string,
  workflowId: string,
  currentStage: AgentPmoPolicyApprovalStage,
  overallStatus: AgentPmoPolicyApprovalStatus,
  completedStage?: AgentPmoPolicyApprovalStage,
): Promise<AgentPmoPolicyApprovalWorkflowRecord | null> {
  const record = approvalWorkflowStore.get(workflowId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const completedStages = completedStage && !record.completedStages.includes(completedStage)
    ? [...record.completedStages, completedStage]
    : record.completedStages;
  const updated: AgentPmoPolicyApprovalWorkflowRecord = {
    ...record,
    currentStage,
    overallStatus,
    completedStages,
    updatedAt: new Date().toISOString(),
  };
  approvalWorkflowStore.set(workflowId, updated);
  return updated;
}

// ─── Approval Decisions (append-only) ────────────────────────────────────────

export async function recordPolicyApprovalDecision(input: {
  workspaceId: string;
  workflowId: string;
  stage: AgentPmoPolicyApprovalStage;
  decisionType: AgentPmoPolicyApprovalDecisionType;
  status: AgentPmoPolicyApprovalStatus;
  decidedBy?: string | null;
  decisionNote?: string | null;
}): Promise<AgentPmoPolicyApprovalDecisionRecord> {
  const id = randomUUID();
  const record: AgentPmoPolicyApprovalDecisionRecord = {
    id,
    workspaceId: input.workspaceId,
    workflowId: input.workflowId,
    stage: input.stage,
    decisionType: input.decisionType,
    status: input.status,
    decidedBy: input.decidedBy ?? null,
    decisionNote: input.decisionNote ?? null,
    createdAt: new Date().toISOString(),
  };
  approvalDecisionStore.push(record);
  return record;
}

export async function listPolicyApprovalDecisions(
  workspaceId: string,
  workflowId: string,
): Promise<AgentPmoPolicyApprovalDecisionRecord[]> {
  return approvalDecisionStore.filter(
    (r) => r.workspaceId === workspaceId && r.workflowId === workflowId,
  );
}

// ─── Implementation Readiness ─────────────────────────────────────────────────

export async function createImplementationReadiness(input: {
  workspaceId: string;
  changeRequestId: string;
  readinessStatus: AgentPmoPolicyImplementationReadinessRecord["readinessStatus"];
  simulationCompleted: boolean;
  approvalCompleted: boolean;
  rollbackPlanPresent: boolean;
  blockedReasons?: string[];
}): Promise<AgentPmoPolicyImplementationReadinessRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoPolicyImplementationReadinessRecord = {
    id,
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    readinessStatus: input.readinessStatus,
    simulationCompleted: input.simulationCompleted,
    approvalCompleted: input.approvalCompleted,
    rollbackPlanPresent: input.rollbackPlanPresent,
    blockedReasons: input.blockedReasons ?? [],
    evaluatedAt: now,
    createdAt: now,
  };
  implementationReadinessStore.set(id, record);
  return record;
}

export async function getLatestImplementationReadiness(
  workspaceId: string,
  changeRequestId: string,
): Promise<AgentPmoPolicyImplementationReadinessRecord | null> {
  const results = [...implementationReadinessStore.values()]
    .filter((r) => r.workspaceId === workspaceId && r.changeRequestId === changeRequestId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results[0] ?? null;
}

// ─── Rollback Plans ───────────────────────────────────────────────────────────

export async function createPolicyRollbackPlan(input: {
  workspaceId: string;
  changeRequestId: string;
  planType: AgentPmoPolicyRollbackPlanRecord["planType"];
  planStatus?: AgentPmoPolicyRollbackPlanStatus;
  planDescription: string;
  affectedPolicyKeys?: string[];
  estimatedRollbackMinutes?: number;
  createdBy?: string | null;
}): Promise<AgentPmoPolicyRollbackPlanRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoPolicyRollbackPlanRecord = {
    id,
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    planType: input.planType,
    planStatus: input.planStatus ?? "created",
    planDescription: input.planDescription,
    affectedPolicyKeys: input.affectedPolicyKeys ?? [],
    estimatedRollbackMinutes: input.estimatedRollbackMinutes ?? 30,
    reviewedBy: null,
    reviewedAt: null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  rollbackPlanStore.set(id, record);
  return record;
}

export async function getPolicyRollbackPlanById(
  workspaceId: string,
  planId: string,
): Promise<AgentPmoPolicyRollbackPlanRecord | null> {
  const record = rollbackPlanStore.get(planId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listPolicyRollbackPlans(
  workspaceId: string,
  filters: { changeRequestId?: string; planStatus?: AgentPmoPolicyRollbackPlanStatus; limit?: number } = {},
): Promise<AgentPmoPolicyRollbackPlanRecord[]> {
  let results = [...rollbackPlanStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.changeRequestId) results = results.filter((r) => r.changeRequestId === filters.changeRequestId);
  if (filters.planStatus) results = results.filter((r) => r.planStatus === filters.planStatus);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updatePolicyRollbackPlanStatus(
  workspaceId: string,
  planId: string,
  planStatus: AgentPmoPolicyRollbackPlanStatus,
  reviewedBy?: string | null,
): Promise<AgentPmoPolicyRollbackPlanRecord | null> {
  const record = rollbackPlanStore.get(planId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated: AgentPmoPolicyRollbackPlanRecord = {
    ...record,
    planStatus,
    reviewedBy: reviewedBy ?? record.reviewedBy,
    reviewedAt: reviewedBy ? new Date().toISOString() : record.reviewedAt,
    updatedAt: new Date().toISOString(),
  };
  rollbackPlanStore.set(planId, updated);
  return updated;
}

// ─── Events (append-only) ─────────────────────────────────────────────────────

export async function recordPolicyBacklogEvent(input: {
  workspaceId?: string | null;
  backlogItemId?: string | null;
  changeRequestId?: string | null;
  simulationId?: string | null;
  draftId?: string | null;
  workflowId?: string | null;
  eventType: AgentPmoPolicyBacklogEventType;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
  actorId?: string | null;
}): Promise<AgentPmoPolicyBacklogEventRecord> {
  const id = randomUUID();
  const record: AgentPmoPolicyBacklogEventRecord = {
    id,
    workspaceId: input.workspaceId ?? "",
    backlogItemId: input.backlogItemId ?? null,
    changeRequestId: input.changeRequestId ?? null,
    simulationId: input.simulationId ?? null,
    draftId: input.draftId ?? null,
    workflowId: input.workflowId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    eventPayload: input.eventPayload ?? null,
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  policyBacklogEventStore.push(record);
  return record;
}

export async function listPolicyBacklogEvents(input: {
  workspaceId: string;
  eventType?: AgentPmoPolicyBacklogEventType;
  changeRequestId?: string;
  limit?: number;
}): Promise<AgentPmoPolicyBacklogEventRecord[]> {
  let results = policyBacklogEventStore.filter((e) => e.workspaceId === input.workspaceId);
  if (input.eventType) results = results.filter((e) => e.eventType === input.eventType);
  if (input.changeRequestId) results = results.filter((e) => e.changeRequestId === input.changeRequestId);
  results = [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (input.limit) results = results.slice(0, input.limit);
  return results;
}
