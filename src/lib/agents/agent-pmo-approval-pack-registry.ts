// ─── Controlled Governance Policy Simulation Report & PMO Approval Pack — Registry
// Pure in-memory store. Does not use Supabase.
// Approval packs are NOT hard-deleted. Sign-off decisions are append-only.
// Artifacts are append-only. Implementation ticket drafts are internal only.
// Does NOT apply policy. Does NOT call external APIs.

import { randomUUID } from "node:crypto";
import type {
  AgentPmoSimulationReportRecord,
  AgentPmoSimulationReportSectionRecord,
  AgentPmoPolicyImpactSummaryRecord,
  AgentPmoPolicyDraftDiffRecord,
  AgentPmoApprovalChecklistRecord,
  AgentPmoApprovalChecklistItemRecord,
  AgentPmoRollbackReadinessChecklistRecord,
  AgentPmoRollbackReadinessChecklistItemRecord,
  AgentPmoSignOffPacketRecord,
  AgentPmoSignOffDecisionRecord,
  AgentPmoApprovalPackRecord,
  AgentPmoApprovalPackArtifactRecord,
  AgentPmoImplementationTicketDraftRecord,
  AgentPmoApprovalPackExportRecord,
  AgentPmoApprovalPackEventRecord,
  AgentPmoSimulationReportStatus,
  AgentPmoApprovalPackStatus,
  AgentPmoSignOffStatus,
  AgentPmoImplementationTicketDraftStatus,
  AgentPmoApprovalPackExportStatus,
  AgentPmoApprovalPackEventType,
  AgentPmoApprovalPackArtifactType,
  AgentPmoSimulationReportSectionType,
  AgentPmoSignOffDecisionType,
  AgentPmoApprovalPackExportFormat,
  AgentPmoChecklistStatus,
} from "./agent-pmo-approval-pack-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const simulationReportStore = new Map<string, AgentPmoSimulationReportRecord>();
const reportSectionStore: AgentPmoSimulationReportSectionRecord[] = [];
const impactSummaryStore = new Map<string, AgentPmoPolicyImpactSummaryRecord>();
const draftDiffStore = new Map<string, AgentPmoPolicyDraftDiffRecord>();
const approvalChecklistStore = new Map<string, AgentPmoApprovalChecklistRecord>();
const approvalChecklistItemStore: AgentPmoApprovalChecklistItemRecord[] = [];
const rollbackChecklistStore = new Map<string, AgentPmoRollbackReadinessChecklistRecord>();
const rollbackChecklistItemStore: AgentPmoRollbackReadinessChecklistItemRecord[] = [];
const signOffPacketStore = new Map<string, AgentPmoSignOffPacketRecord>();
const signOffDecisionStore: AgentPmoSignOffDecisionRecord[] = [];
const approvalPackStore = new Map<string, AgentPmoApprovalPackRecord>();
const approvalPackArtifactStore: AgentPmoApprovalPackArtifactRecord[] = [];
const implTicketDraftStore = new Map<string, AgentPmoImplementationTicketDraftRecord>();
const approvalPackExportStore = new Map<string, AgentPmoApprovalPackExportRecord>();
const approvalPackEventStore: AgentPmoApprovalPackEventRecord[] = [];

export function _clearApprovalPackStores(): void {
  simulationReportStore.clear();
  reportSectionStore.length = 0;
  impactSummaryStore.clear();
  draftDiffStore.clear();
  approvalChecklistStore.clear();
  approvalChecklistItemStore.length = 0;
  rollbackChecklistStore.clear();
  rollbackChecklistItemStore.length = 0;
  signOffPacketStore.clear();
  signOffDecisionStore.length = 0;
  approvalPackStore.clear();
  approvalPackArtifactStore.length = 0;
  implTicketDraftStore.clear();
  approvalPackExportStore.clear();
  approvalPackEventStore.length = 0;
}

// ─── Simulation Reports ───────────────────────────────────────────────────────

export async function createAgentPmoSimulationReport(input: {
  workspaceId: string;
  changeRequestId: string;
  backlogItemId?: string | null;
  simulationId?: string | null;
  impactPreviewId?: string | null;
  policyDraftId?: string | null;
  approvalWorkflowId?: string | null;
  rollbackPlanId?: string | null;
  implementationReadinessId?: string | null;
  status?: AgentPmoSimulationReportStatus;
  reportVersion?: number;
  title: string;
  executiveSummary: string;
  safeReportPayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoSimulationReportRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoSimulationReportRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    backlogItemId: input.backlogItemId ?? null,
    simulationId: input.simulationId ?? null,
    impactPreviewId: input.impactPreviewId ?? null,
    policyDraftId: input.policyDraftId ?? null,
    approvalWorkflowId: input.approvalWorkflowId ?? null,
    rollbackPlanId: input.rollbackPlanId ?? null,
    implementationReadinessId: input.implementationReadinessId ?? null,
    status: input.status ?? "created",
    reportVersion: input.reportVersion ?? 1,
    title: input.title,
    executiveSummary: input.executiveSummary,
    safeReportPayload: input.safeReportPayload ?? {},
    sectionCount: 0,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  simulationReportStore.set(record.id, record);
  return record;
}

export async function getAgentPmoSimulationReportById(
  workspaceId: string,
  reportId: string,
): Promise<AgentPmoSimulationReportRecord | null> {
  const r = simulationReportStore.get(reportId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function listAgentPmoSimulationReports(
  workspaceId: string,
  opts?: { changeRequestId?: string; limit?: number },
): Promise<AgentPmoSimulationReportRecord[]> {
  let results = [...simulationReportStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (opts?.changeRequestId) results = results.filter((r) => r.changeRequestId === opts.changeRequestId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.limit) results = results.slice(0, opts.limit);
  return results;
}

export async function updateAgentPmoSimulationReportStatus(
  workspaceId: string,
  reportId: string,
  status: AgentPmoSimulationReportStatus,
): Promise<AgentPmoSimulationReportRecord | null> {
  const r = simulationReportStore.get(reportId);
  if (!r || r.workspaceId !== workspaceId) return null;
  const updated = { ...r, status, updatedAt: new Date().toISOString() };
  simulationReportStore.set(reportId, updated);
  return updated;
}

// ─── Simulation Report Sections ───────────────────────────────────────────────

export async function createAgentPmoSimulationReportSection(input: {
  workspaceId: string;
  reportId: string;
  sectionType: AgentPmoSimulationReportSectionType;
  sectionTitle: string;
  sectionOrder: number;
  safeMarkdown: string;
  safePayload?: Record<string, unknown>;
  sourceRecordIds?: string[];
}): Promise<AgentPmoSimulationReportSectionRecord> {
  const record: AgentPmoSimulationReportSectionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    reportId: input.reportId,
    sectionType: input.sectionType,
    sectionTitle: input.sectionTitle,
    sectionOrder: input.sectionOrder,
    safeMarkdown: input.safeMarkdown,
    safePayload: input.safePayload ?? {},
    sourceRecordIds: input.sourceRecordIds ?? [],
    createdAt: new Date().toISOString(),
  };
  reportSectionStore.push(record);
  const report = simulationReportStore.get(input.reportId);
  if (report) {
    simulationReportStore.set(input.reportId, {
      ...report,
      sectionCount: report.sectionCount + 1,
      updatedAt: new Date().toISOString(),
    });
  }
  return record;
}

// ─── Policy Impact Summary ────────────────────────────────────────────────────

export async function createAgentPmoPolicyImpactSummary(input: {
  workspaceId: string;
  changeRequestId: string;
  simulationId?: string | null;
  impactPreviewId?: string | null;
  impactLevel: string;
  affectedDomains?: string[];
  affectedActionTypes?: string[];
  affectedAdapters?: string[];
  estimatedReviewLoadChange?: number;
  estimatedEvidenceBurdenChange?: number;
  riskPostureEstimate: string;
  implementationComplexity: string;
  confidenceScore?: number;
  summary: string;
  safePayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyImpactSummaryRecord> {
  const record: AgentPmoPolicyImpactSummaryRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    simulationId: input.simulationId ?? null,
    impactPreviewId: input.impactPreviewId ?? null,
    impactLevel: input.impactLevel,
    affectedDomains: input.affectedDomains ?? [],
    affectedActionTypes: input.affectedActionTypes ?? [],
    affectedAdapters: input.affectedAdapters ?? [],
    estimatedReviewLoadChange: Math.max(0, input.estimatedReviewLoadChange ?? 0),
    estimatedEvidenceBurdenChange: Math.max(0, input.estimatedEvidenceBurdenChange ?? 0),
    riskPostureEstimate: input.riskPostureEstimate,
    implementationComplexity: input.implementationComplexity,
    confidenceScore: Math.min(1, Math.max(0, input.confidenceScore ?? 0.5)),
    summary: input.summary,
    safePayload: input.safePayload ?? {},
    createdAt: new Date().toISOString(),
  };
  impactSummaryStore.set(record.id, record);
  return record;
}

// ─── Policy Draft Diff ────────────────────────────────────────────────────────

export async function createAgentPmoPolicyDraftDiff(input: {
  workspaceId: string;
  changeRequestId: string;
  policyDraftId?: string | null;
  unknownBaseline: boolean;
  baselineLabel?: string;
  draftLabel?: string;
  addedRules?: string[];
  removedRules?: string[];
  changedRules?: string[];
  unchangedRules?: string[];
  safePayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyDraftDiffRecord> {
  const addedRules = input.addedRules ?? [];
  const removedRules = input.removedRules ?? [];
  const changedRules = input.changedRules ?? [];
  const unchangedRules = input.unchangedRules ?? [];
  const record: AgentPmoPolicyDraftDiffRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    policyDraftId: input.policyDraftId ?? null,
    unknownBaseline: input.unknownBaseline,
    baselineLabel: input.baselineLabel ?? "conceptual_current_policy",
    draftLabel: input.draftLabel ?? "non_live_governance_policy_draft",
    addedRules,
    removedRules,
    changedRules,
    unchangedRules,
    totalRuleCount: addedRules.length + removedRules.length + changedRules.length + unchangedRules.length,
    safePayload: input.safePayload ?? {},
    createdAt: new Date().toISOString(),
  };
  draftDiffStore.set(record.id, record);
  return record;
}

// ─── Approval Checklist ───────────────────────────────────────────────────────

export async function createAgentPmoApprovalChecklist(input: {
  workspaceId: string;
  changeRequestId: string;
  approvalPackId?: string | null;
  overallStatus?: AgentPmoChecklistStatus;
  safePayload?: Record<string, unknown>;
}): Promise<AgentPmoApprovalChecklistRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoApprovalChecklistRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    approvalPackId: input.approvalPackId ?? null,
    overallStatus: input.overallStatus ?? "not_started",
    itemCount: 0,
    passedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    safePayload: input.safePayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  approvalChecklistStore.set(record.id, record);
  return record;
}

export async function createAgentPmoApprovalChecklistItem(input: {
  workspaceId: string;
  checklistId: string;
  itemKey: string;
  itemLabel: string;
  itemOrder: number;
  status: AgentPmoChecklistStatus;
  notes?: string;
}): Promise<AgentPmoApprovalChecklistItemRecord> {
  const record: AgentPmoApprovalChecklistItemRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    checklistId: input.checklistId,
    itemKey: input.itemKey,
    itemLabel: input.itemLabel,
    itemOrder: input.itemOrder,
    status: input.status,
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  };
  approvalChecklistItemStore.push(record);
  const cl = approvalChecklistStore.get(input.checklistId);
  if (cl) {
    const items = approvalChecklistItemStore.filter((i) => i.checklistId === input.checklistId);
    approvalChecklistStore.set(input.checklistId, {
      ...cl,
      itemCount: items.length,
      passedCount: items.filter((i) => i.status === "passed").length,
      failedCount: items.filter((i) => i.status === "failed" || i.status === "blocked").length,
      pendingCount: items.filter((i) => i.status === "pending").length,
      updatedAt: new Date().toISOString(),
    });
  }
  return record;
}

// ─── Rollback Readiness Checklist ─────────────────────────────────────────────

export async function createAgentPmoRollbackReadinessChecklist(input: {
  workspaceId: string;
  changeRequestId: string;
  rollbackPlanId?: string | null;
  approvalPackId?: string | null;
  overallStatus?: AgentPmoChecklistStatus;
  safePayload?: Record<string, unknown>;
}): Promise<AgentPmoRollbackReadinessChecklistRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoRollbackReadinessChecklistRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    rollbackPlanId: input.rollbackPlanId ?? null,
    approvalPackId: input.approvalPackId ?? null,
    overallStatus: input.overallStatus ?? "not_started",
    itemCount: 0,
    passedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    safePayload: input.safePayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  rollbackChecklistStore.set(record.id, record);
  return record;
}

export async function createAgentPmoRollbackReadinessChecklistItem(input: {
  workspaceId: string;
  checklistId: string;
  itemKey: string;
  itemLabel: string;
  itemOrder: number;
  status: AgentPmoChecklistStatus;
  notes?: string;
}): Promise<AgentPmoRollbackReadinessChecklistItemRecord> {
  const record: AgentPmoRollbackReadinessChecklistItemRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    checklistId: input.checklistId,
    itemKey: input.itemKey,
    itemLabel: input.itemLabel,
    itemOrder: input.itemOrder,
    status: input.status,
    notes: input.notes ?? "",
    createdAt: new Date().toISOString(),
  };
  rollbackChecklistItemStore.push(record);
  const cl = rollbackChecklistStore.get(input.checklistId);
  if (cl) {
    const items = rollbackChecklistItemStore.filter((i) => i.checklistId === input.checklistId);
    rollbackChecklistStore.set(input.checklistId, {
      ...cl,
      itemCount: items.length,
      passedCount: items.filter((i) => i.status === "passed").length,
      failedCount: items.filter((i) => i.status === "failed" || i.status === "blocked").length,
      pendingCount: items.filter((i) => i.status === "pending").length,
      updatedAt: new Date().toISOString(),
    });
  }
  return record;
}

// ─── Sign-Off Packet ──────────────────────────────────────────────────────────

export async function createAgentPmoSignOffPacket(input: {
  workspaceId: string;
  approvalPackId?: string | null;
  changeRequestId: string;
  simulationReportId?: string | null;
  impactSummaryId?: string | null;
  draftDiffId?: string | null;
  approvalChecklistId?: string | null;
  rollbackChecklistId?: string | null;
  status?: AgentPmoSignOffStatus;
  packetVersion?: number;
  signOffSummary: string;
  safePayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoSignOffPacketRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoSignOffPacketRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId,
    simulationReportId: input.simulationReportId ?? null,
    impactSummaryId: input.impactSummaryId ?? null,
    draftDiffId: input.draftDiffId ?? null,
    approvalChecklistId: input.approvalChecklistId ?? null,
    rollbackChecklistId: input.rollbackChecklistId ?? null,
    status: input.status ?? "created",
    packetVersion: input.packetVersion ?? 1,
    signOffSummary: input.signOffSummary,
    safePayload: input.safePayload ?? {},
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  signOffPacketStore.set(record.id, record);
  return record;
}

export async function recordAgentPmoSignOffDecision(input: {
  workspaceId: string;
  signOffPacketId: string;
  approvalPackId?: string | null;
  decisionType: AgentPmoSignOffDecisionType;
  rationale: string;
  decidedBy?: string | null;
}): Promise<AgentPmoSignOffDecisionRecord> {
  const packet = signOffPacketStore.get(input.signOffPacketId);
  if (!packet || packet.workspaceId !== input.workspaceId) {
    throw new Error("Sign-off packet not found.");
  }
  const record: AgentPmoSignOffDecisionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    signOffPacketId: input.signOffPacketId,
    approvalPackId: input.approvalPackId ?? null,
    decisionType: input.decisionType,
    rationale: input.rationale,
    decidedBy: input.decidedBy ?? null,
    createdAt: new Date().toISOString(),
  };
  signOffDecisionStore.push(record);

  let newPacketStatus: AgentPmoSignOffStatus = "under_review";
  if (input.decisionType === "approve_for_implementation_planning") newPacketStatus = "approved_for_implementation_planning";
  else if (input.decisionType === "reject") newPacketStatus = "rejected";
  else if (input.decisionType === "request_changes") newPacketStatus = "changes_requested";
  else if (input.decisionType === "archive") newPacketStatus = "archived";
  signOffPacketStore.set(input.signOffPacketId, { ...packet, status: newPacketStatus, updatedAt: new Date().toISOString() });

  if (input.approvalPackId && input.decisionType === "approve_for_implementation_planning") {
    const pack = approvalPackStore.get(input.approvalPackId);
    if (pack && pack.workspaceId === input.workspaceId) {
      approvalPackStore.set(input.approvalPackId, { ...pack, packStatus: "signed_off", updatedAt: new Date().toISOString() });
    }
  }

  return record;
}

export async function getAgentPmoSignOffPacketById(
  workspaceId: string,
  packetId: string,
): Promise<AgentPmoSignOffPacketRecord | null> {
  const r = signOffPacketStore.get(packetId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function listAgentPmoSignOffPackets(
  workspaceId: string,
  opts?: { approvalPackId?: string; limit?: number },
): Promise<AgentPmoSignOffPacketRecord[]> {
  let results = [...signOffPacketStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (opts?.approvalPackId) results = results.filter((r) => r.approvalPackId === opts.approvalPackId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.limit) results = results.slice(0, opts.limit);
  return results;
}

// ─── Approval Pack ────────────────────────────────────────────────────────────

export async function createAgentPmoApprovalPack(input: {
  workspaceId: string;
  changeRequestId: string;
  backlogItemId?: string | null;
  simulationReportId?: string | null;
  impactSummaryId?: string | null;
  draftDiffId?: string | null;
  approvalChecklistId?: string | null;
  rollbackChecklistId?: string | null;
  signOffPacketId?: string | null;
  implementationTicketDraftId?: string | null;
  packStatus?: AgentPmoApprovalPackStatus;
  packVersion?: number;
  title: string;
  safePackPayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoApprovalPackRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoApprovalPackRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    changeRequestId: input.changeRequestId,
    backlogItemId: input.backlogItemId ?? null,
    simulationReportId: input.simulationReportId ?? null,
    impactSummaryId: input.impactSummaryId ?? null,
    draftDiffId: input.draftDiffId ?? null,
    approvalChecklistId: input.approvalChecklistId ?? null,
    rollbackChecklistId: input.rollbackChecklistId ?? null,
    signOffPacketId: input.signOffPacketId ?? null,
    implementationTicketDraftId: input.implementationTicketDraftId ?? null,
    packStatus: input.packStatus ?? "created",
    packVersion: input.packVersion ?? 1,
    title: input.title,
    safePackPayload: input.safePackPayload ?? {},
    artifactCount: 0,
    exportCount: 0,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  approvalPackStore.set(record.id, record);
  return record;
}

export async function getAgentPmoApprovalPackById(
  workspaceId: string,
  packId: string,
): Promise<AgentPmoApprovalPackRecord | null> {
  const r = approvalPackStore.get(packId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function listAgentPmoApprovalPacks(
  workspaceId: string,
  opts?: { changeRequestId?: string; packStatus?: AgentPmoApprovalPackStatus; limit?: number },
): Promise<AgentPmoApprovalPackRecord[]> {
  let results = [...approvalPackStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (opts?.changeRequestId) results = results.filter((r) => r.changeRequestId === opts.changeRequestId);
  if (opts?.packStatus) results = results.filter((r) => r.packStatus === opts.packStatus);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.limit) results = results.slice(0, opts.limit);
  return results;
}

export async function updateAgentPmoApprovalPackStatus(
  workspaceId: string,
  packId: string,
  packStatus: AgentPmoApprovalPackStatus,
  updates?: Partial<Pick<AgentPmoApprovalPackRecord, "simulationReportId" | "impactSummaryId" | "draftDiffId" | "approvalChecklistId" | "rollbackChecklistId" | "signOffPacketId" | "implementationTicketDraftId">>,
): Promise<AgentPmoApprovalPackRecord | null> {
  const r = approvalPackStore.get(packId);
  if (!r || r.workspaceId !== workspaceId) return null;
  const updated = { ...r, ...updates, packStatus, updatedAt: new Date().toISOString() };
  approvalPackStore.set(packId, updated);
  return updated;
}

// ─── Approval Pack Artifacts ──────────────────────────────────────────────────

export async function createAgentPmoApprovalPackArtifact(input: {
  workspaceId: string;
  approvalPackId: string;
  artifactType: AgentPmoApprovalPackArtifactType;
  artifactRefId?: string | null;
  artifactLabel: string;
}): Promise<AgentPmoApprovalPackArtifactRecord> {
  const record: AgentPmoApprovalPackArtifactRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId,
    artifactType: input.artifactType,
    artifactRefId: input.artifactRefId ?? null,
    artifactLabel: input.artifactLabel,
    createdAt: new Date().toISOString(),
  };
  approvalPackArtifactStore.push(record);
  const pack = approvalPackStore.get(input.approvalPackId);
  if (pack) {
    approvalPackStore.set(input.approvalPackId, {
      ...pack,
      artifactCount: pack.artifactCount + 1,
      updatedAt: new Date().toISOString(),
    });
  }
  return record;
}

// ─── Implementation Ticket Draft ──────────────────────────────────────────────

export async function createAgentPmoImplementationTicketDraft(input: {
  workspaceId: string;
  approvalPackId?: string | null;
  changeRequestId: string;
  ticketTitle: string;
  ticketBody: string;
  ticketType?: AgentPmoImplementationTicketDraftRecord["ticketType"];
  targetFutureSprint?: string;
  acceptanceCriteria?: string[];
  blockedUntilSignOff?: boolean;
  status?: AgentPmoImplementationTicketDraftStatus;
  safeTicketPayload?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<AgentPmoImplementationTicketDraftRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoImplementationTicketDraftRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId,
    ticketTitle: input.ticketTitle,
    ticketBody: input.ticketBody,
    ticketType: input.ticketType ?? "implementation_planning",
    targetFutureSprint: input.targetFutureSprint ?? "future_sprint_tbd",
    acceptanceCriteria: input.acceptanceCriteria ?? [],
    blockedUntilSignOff: input.blockedUntilSignOff ?? true,
    status: input.status ?? "created",
    safeTicketPayload: input.safeTicketPayload ?? {},
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  implTicketDraftStore.set(record.id, record);
  return record;
}

export async function updateAgentPmoImplementationTicketDraftStatus(
  workspaceId: string,
  draftId: string,
  status: AgentPmoImplementationTicketDraftStatus,
): Promise<AgentPmoImplementationTicketDraftRecord | null> {
  const r = implTicketDraftStore.get(draftId);
  if (!r || r.workspaceId !== workspaceId) return null;
  const updated = { ...r, status, updatedAt: new Date().toISOString() };
  implTicketDraftStore.set(draftId, updated);
  return updated;
}

export async function listAgentPmoImplementationTicketDrafts(
  workspaceId: string,
  opts?: { changeRequestId?: string; approvalPackId?: string; limit?: number },
): Promise<AgentPmoImplementationTicketDraftRecord[]> {
  let results = [...implTicketDraftStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (opts?.changeRequestId) results = results.filter((r) => r.changeRequestId === opts.changeRequestId);
  if (opts?.approvalPackId) results = results.filter((r) => r.approvalPackId === opts.approvalPackId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.limit) results = results.slice(0, opts.limit);
  return results;
}

// ─── Approval Pack Exports ────────────────────────────────────────────────────

export async function createAgentPmoApprovalPackExport(input: {
  workspaceId: string;
  approvalPackId: string;
  exportFormat: AgentPmoApprovalPackExportFormat;
  exportStatus?: AgentPmoApprovalPackExportStatus;
  safeExportContent: string;
  safetyValidationPassed: boolean;
  createdBy?: string | null;
}): Promise<AgentPmoApprovalPackExportRecord> {
  const record: AgentPmoApprovalPackExportRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    approvalPackId: input.approvalPackId,
    exportFormat: input.exportFormat,
    exportStatus: input.exportStatus ?? "generated",
    safeExportContent: input.safeExportContent,
    exportSizeBytes: Buffer.byteLength(input.safeExportContent, "utf8"),
    safetyValidationPassed: input.safetyValidationPassed,
    createdBy: input.createdBy ?? null,
    createdAt: new Date().toISOString(),
  };
  approvalPackExportStore.set(record.id, record);
  const pack = approvalPackStore.get(input.approvalPackId);
  if (pack) {
    approvalPackStore.set(input.approvalPackId, {
      ...pack,
      exportCount: pack.exportCount + 1,
      updatedAt: new Date().toISOString(),
    });
  }
  return record;
}

export async function getAgentPmoApprovalPackExportById(
  workspaceId: string,
  exportId: string,
): Promise<AgentPmoApprovalPackExportRecord | null> {
  const r = approvalPackExportStore.get(exportId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function listAgentPmoApprovalPackExports(
  workspaceId: string,
  opts?: { approvalPackId?: string; limit?: number },
): Promise<AgentPmoApprovalPackExportRecord[]> {
  let results = [...approvalPackExportStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (opts?.approvalPackId) results = results.filter((r) => r.approvalPackId === opts.approvalPackId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.limit) results = results.slice(0, opts.limit);
  return results;
}

// ─── Approval Pack Events ─────────────────────────────────────────────────────

export async function recordAgentPmoApprovalPackEvent(input: {
  workspaceId?: string | null;
  approvalPackId?: string | null;
  changeRequestId?: string | null;
  simulationReportId?: string | null;
  signOffPacketId?: string | null;
  eventType: AgentPmoApprovalPackEventType;
  message?: string | null;
  safeEventPayload?: Record<string, unknown>;
  actorId?: string | null;
}): Promise<AgentPmoApprovalPackEventRecord> {
  const record: AgentPmoApprovalPackEventRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId ?? null,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId ?? null,
    simulationReportId: input.simulationReportId ?? null,
    signOffPacketId: input.signOffPacketId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    safeEventPayload: input.safeEventPayload ?? {},
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  approvalPackEventStore.push(record);
  return record;
}

export async function listAgentPmoApprovalPackEvents(
  workspaceId: string,
  opts?: { approvalPackId?: string; limit?: number },
): Promise<AgentPmoApprovalPackEventRecord[]> {
  let results = approvalPackEventStore.filter((e) => e.workspaceId === workspaceId);
  if (opts?.approvalPackId) results = results.filter((e) => e.approvalPackId === opts.approvalPackId);
  results = [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.limit) results = results.slice(0, opts.limit);
  return results;
}
