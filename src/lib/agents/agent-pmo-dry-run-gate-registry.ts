// ─── PMO Controlled Policy Implementation Gate & Dry-Run Change Executor — Registry ─
// Pure in-memory store. Does not use Supabase.
// Events, decisions, and operator reviews are append-only.
// Does NOT apply policies, change routing, change risk scoring.
// Does NOT activate policy drafts or execute rollback.
// Does NOT mutate live policies or runtime systems.

import { randomUUID } from "node:crypto";
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
  AgentPmoDryRunRequestStatus,
  AgentPmoDryRunPreflightStatus,
  AgentPmoDryRunGateApprovalStatus,
  AgentPmoDryRunGateDecisionType,
  AgentPmoDryRunChangeType,
  AgentPmoSimulatedPolicyVersionStatus,
  AgentPmoDryRunExecutionStatus,
  AgentPmoDryRunImpactDomain,
  AgentPmoDryRunImpactLevel,
  AgentPmoDryRunEvidencePackageStatus,
  AgentPmoDryRunEvidenceSectionType,
  AgentPmoDryRunBlockerType,
  AgentPmoDryRunBlockerStatus,
  AgentPmoDryRunBlockerSeverity,
  AgentPmoDryRunOperatorReviewStatus,
  AgentPmoDryRunOperatorReviewDecision,
  AgentPmoDryRunDecisionType,
  AgentPmoDryRunDecisionStatus,
  AgentPmoDryRunExportFormat,
  AgentPmoDryRunExportStatus,
  AgentPmoDryRunEventType,
} from "./agent-pmo-dry-run-gate-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const dryRunRequestStore = new Map<string, AgentPmoDryRunExecutionRequestRecord>();
const preflightValidationStore = new Map<string, AgentPmoDryRunPreflightValidationRecord>();
const gateApprovalStore = new Map<string, AgentPmoDryRunGateApprovalRecord>();
const gateDecisionStore: AgentPmoDryRunGateDecisionRecord[] = [];
const changeSetStore = new Map<string, AgentPmoDryRunChangeSetRecord>();
const changeSetItemStore = new Map<string, AgentPmoDryRunChangeSetItemRecord>();
const simulatedPolicyVersionStore = new Map<string, AgentPmoSimulatedPolicyVersionRecord>();
const simulationExecutionStore = new Map<string, AgentPmoDryRunSimulationExecutionRecord>();
const simulatedImpactStore = new Map<string, AgentPmoDryRunSimulatedImpactRecord>();
const evidencePackageStore = new Map<string, AgentPmoDryRunEvidencePackageRecord>();
const evidenceSectionStore = new Map<string, AgentPmoDryRunEvidenceSectionRecord>();
const blockerStore = new Map<string, AgentPmoDryRunBlockerRecord>();
const operatorReviewStore: AgentPmoDryRunOperatorReviewRecord[] = [];
const dryRunDecisionStore: AgentPmoDryRunDecisionRecord[] = [];
const exportStore = new Map<string, AgentPmoDryRunExportRecord>();
const eventStore: AgentPmoDryRunEventRecord[] = [];

export function _clearDryRunGateStores(): void {
  dryRunRequestStore.clear();
  preflightValidationStore.clear();
  gateApprovalStore.clear();
  gateDecisionStore.length = 0;
  changeSetStore.clear();
  changeSetItemStore.clear();
  simulatedPolicyVersionStore.clear();
  simulationExecutionStore.clear();
  simulatedImpactStore.clear();
  evidencePackageStore.clear();
  evidenceSectionStore.clear();
  blockerStore.clear();
  operatorReviewStore.length = 0;
  dryRunDecisionStore.length = 0;
  exportStore.clear();
  eventStore.length = 0;
}

// ─── Dry-Run Execution Requests ───────────────────────────────────────────────

export async function createAgentPmoDryRunExecutionRequest(input: {
  workspaceId: string;
  planningWorkspaceId: string;
  approvalPackId?: string | null;
  changeRequestId?: string | null;
  requestedBy?: string | null;
  requestReason: string;
  requestStatus?: AgentPmoDryRunRequestStatus;
  safeRequestPayload?: Record<string, unknown>;
}): Promise<AgentPmoDryRunExecutionRequestRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoDryRunExecutionRequestRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    planningWorkspaceId: input.planningWorkspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId ?? null,
    requestedBy: input.requestedBy ?? null,
    requestReason: input.requestReason,
    requestStatus: input.requestStatus ?? "created",
    requestVersion: 1,
    safeRequestPayload: input.safeRequestPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  dryRunRequestStore.set(record.id, record);
  return record;
}

export async function getAgentPmoDryRunExecutionRequestById(id: string): Promise<AgentPmoDryRunExecutionRequestRecord | null> {
  return dryRunRequestStore.get(id) ?? null;
}

export async function listAgentPmoDryRunExecutionRequests(
  workspaceId: string,
  opts?: { status?: AgentPmoDryRunRequestStatus; limit?: number }
): Promise<AgentPmoDryRunExecutionRequestRecord[]> {
  let results = Array.from(dryRunRequestStore.values()).filter(r => r.workspaceId === workspaceId);
  if (opts?.status) results = results.filter(r => r.requestStatus === opts.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.limit) results = results.slice(0, opts.limit);
  return results;
}

export async function updateAgentPmoDryRunExecutionRequestStatus(
  id: string,
  status: AgentPmoDryRunRequestStatus
): Promise<AgentPmoDryRunExecutionRequestRecord | null> {
  const record = dryRunRequestStore.get(id);
  if (!record) return null;
  const updated = { ...record, requestStatus: status, updatedAt: new Date().toISOString() };
  dryRunRequestStore.set(id, updated);
  return updated;
}

// ─── Pre-Flight Validations ───────────────────────────────────────────────────

export async function createAgentPmoDryRunPreflightValidation(input: {
  workspaceId: string;
  dryRunRequestId: string;
  preflightStatus?: AgentPmoDryRunPreflightStatus;
  checksTotal?: number;
  checksPassed?: number;
  checksFailed?: number;
  checksBlocked?: number;
  safePreflightPayload?: Record<string, unknown>;
}): Promise<AgentPmoDryRunPreflightValidationRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoDryRunPreflightValidationRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    preflightStatus: input.preflightStatus ?? "pending",
    checksTotal: Math.max(0, input.checksTotal ?? 0),
    checksPassed: Math.max(0, input.checksPassed ?? 0),
    checksFailed: Math.max(0, input.checksFailed ?? 0),
    checksBlocked: Math.max(0, input.checksBlocked ?? 0),
    safePreflightPayload: input.safePreflightPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  preflightValidationStore.set(record.id, record);
  return record;
}

export async function getAgentPmoDryRunPreflightValidationById(id: string): Promise<AgentPmoDryRunPreflightValidationRecord | null> {
  return preflightValidationStore.get(id) ?? null;
}

export async function listAgentPmoDryRunPreflightValidations(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunPreflightValidationRecord[]> {
  let results = Array.from(preflightValidationStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateAgentPmoDryRunPreflightValidationStatus(
  id: string,
  status: AgentPmoDryRunPreflightStatus
): Promise<AgentPmoDryRunPreflightValidationRecord | null> {
  const record = preflightValidationStore.get(id);
  if (!record) return null;
  const updated = { ...record, preflightStatus: status, updatedAt: new Date().toISOString() };
  preflightValidationStore.set(id, updated);
  return updated;
}

// ─── Gate Approvals ───────────────────────────────────────────────────────────

export async function createAgentPmoDryRunGateApproval(input: {
  workspaceId: string;
  dryRunRequestId: string;
  gateApprovalStatus?: AgentPmoDryRunGateApprovalStatus;
  reviewedBy?: string | null;
  safeApprovalPayload?: Record<string, unknown>;
}): Promise<AgentPmoDryRunGateApprovalRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoDryRunGateApprovalRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    gateApprovalStatus: input.gateApprovalStatus ?? "created",
    reviewedBy: input.reviewedBy ?? null,
    safeApprovalPayload: input.safeApprovalPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  gateApprovalStore.set(record.id, record);
  return record;
}

export async function getAgentPmoDryRunGateApprovalById(id: string): Promise<AgentPmoDryRunGateApprovalRecord | null> {
  return gateApprovalStore.get(id) ?? null;
}

export async function listAgentPmoDryRunGateApprovals(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunGateApprovalRecord[]> {
  let results = Array.from(gateApprovalStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateAgentPmoDryRunGateApprovalStatus(
  id: string,
  status: AgentPmoDryRunGateApprovalStatus
): Promise<AgentPmoDryRunGateApprovalRecord | null> {
  const record = gateApprovalStore.get(id);
  if (!record) return null;
  const updated = { ...record, gateApprovalStatus: status, updatedAt: new Date().toISOString() };
  gateApprovalStore.set(id, updated);
  return updated;
}

// ─── Gate Decisions (append-only) ────────────────────────────────────────────

export async function recordAgentPmoDryRunGateDecision(input: {
  workspaceId: string;
  gateApprovalId: string;
  dryRunRequestId: string;
  decisionType: AgentPmoDryRunGateDecisionType;
  rationale: string;
  decidedBy?: string | null;
}): Promise<AgentPmoDryRunGateDecisionRecord> {
  const record: AgentPmoDryRunGateDecisionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    gateApprovalId: input.gateApprovalId,
    dryRunRequestId: input.dryRunRequestId,
    decisionType: input.decisionType,
    rationale: input.rationale,
    decidedBy: input.decidedBy ?? null,
    createdAt: new Date().toISOString(),
  };
  gateDecisionStore.push(record);
  return record;
}

export async function listAgentPmoDryRunGateDecisions(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunGateDecisionRecord[]> {
  let results = gateDecisionStore.filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Change Sets ──────────────────────────────────────────────────────────────

export async function createAgentPmoDryRunChangeSet(input: {
  workspaceId: string;
  dryRunRequestId: string;
  planningWorkspaceId: string;
  approvalPackId?: string | null;
  changeRequestId?: string | null;
  simulatedChangeCount?: number;
  policyArea?: string | null;
  safeChangeSummary?: string;
  safeChangeSetPayload?: Record<string, unknown>;
}): Promise<AgentPmoDryRunChangeSetRecord> {
  const record: AgentPmoDryRunChangeSetRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    planningWorkspaceId: input.planningWorkspaceId,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId ?? null,
    simulatedChangeCount: Math.max(0, input.simulatedChangeCount ?? 0),
    policyArea: input.policyArea ?? null,
    safeChangeSummary: input.safeChangeSummary ?? "",
    safeChangeSetPayload: input.safeChangeSetPayload ?? {},
    createdAt: new Date().toISOString(),
  };
  changeSetStore.set(record.id, record);
  return record;
}

export async function getAgentPmoDryRunChangeSetById(id: string): Promise<AgentPmoDryRunChangeSetRecord | null> {
  return changeSetStore.get(id) ?? null;
}

export async function listAgentPmoDryRunChangeSets(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunChangeSetRecord[]> {
  let results = Array.from(changeSetStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Change Set Items ─────────────────────────────────────────────────────────

export async function createAgentPmoDryRunChangeSetItem(input: {
  workspaceId: string;
  changeSetId: string;
  dryRunRequestId: string;
  changeType: AgentPmoDryRunChangeType;
  safeChangeSummary?: string;
  safeChangePayload?: Record<string, unknown>;
}): Promise<AgentPmoDryRunChangeSetItemRecord> {
  const record: AgentPmoDryRunChangeSetItemRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    changeSetId: input.changeSetId,
    dryRunRequestId: input.dryRunRequestId,
    changeType: input.changeType,
    safeChangeSummary: input.safeChangeSummary ?? "",
    safeChangePayload: input.safeChangePayload ?? {},
    createdAt: new Date().toISOString(),
  };
  changeSetItemStore.set(record.id, record);
  return record;
}

export async function listAgentPmoDryRunChangeSetItems(
  workspaceId: string,
  changeSetId?: string
): Promise<AgentPmoDryRunChangeSetItemRecord[]> {
  let results = Array.from(changeSetItemStore.values()).filter(r => r.workspaceId === workspaceId);
  if (changeSetId) results = results.filter(r => r.changeSetId === changeSetId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Simulated Policy Versions ────────────────────────────────────────────────

export async function createAgentPmoSimulatedPolicyVersion(input: {
  workspaceId: string;
  dryRunRequestId: string;
  changeSetId?: string | null;
  simulatedVersionLabel: string;
  baselineLabel: string;
  targetLabel: string;
  unknownBaseline?: boolean;
  simulatedPolicyPayload?: Record<string, unknown>;
  safeDiffPayload?: Record<string, unknown>;
  status?: AgentPmoSimulatedPolicyVersionStatus;
}): Promise<AgentPmoSimulatedPolicyVersionRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoSimulatedPolicyVersionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    changeSetId: input.changeSetId ?? null,
    simulatedVersionLabel: input.simulatedVersionLabel,
    baselineLabel: input.baselineLabel,
    targetLabel: input.targetLabel,
    unknownBaseline: input.unknownBaseline ?? false,
    simulatedPolicyPayload: input.simulatedPolicyPayload ?? {},
    safeDiffPayload: input.safeDiffPayload ?? {},
    status: input.status ?? "created",
    createdAt: now,
    updatedAt: now,
  };
  simulatedPolicyVersionStore.set(record.id, record);
  return record;
}

export async function getAgentPmoSimulatedPolicyVersionById(id: string): Promise<AgentPmoSimulatedPolicyVersionRecord | null> {
  return simulatedPolicyVersionStore.get(id) ?? null;
}

export async function listAgentPmoSimulatedPolicyVersions(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoSimulatedPolicyVersionRecord[]> {
  let results = Array.from(simulatedPolicyVersionStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateAgentPmoSimulatedPolicyVersionStatus(
  id: string,
  status: AgentPmoSimulatedPolicyVersionStatus
): Promise<AgentPmoSimulatedPolicyVersionRecord | null> {
  const record = simulatedPolicyVersionStore.get(id);
  if (!record) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  simulatedPolicyVersionStore.set(id, updated);
  return updated;
}

// ─── Simulation Executions ────────────────────────────────────────────────────

export async function createAgentPmoDryRunSimulationExecution(input: {
  workspaceId: string;
  dryRunRequestId: string;
  preflightValidationId?: string | null;
  gateApprovalId?: string | null;
  changeSetId?: string | null;
  simulatedPolicyVersionId?: string | null;
  executionStatus?: AgentPmoDryRunExecutionStatus;
  safeExecutionPayload?: Record<string, unknown>;
}): Promise<AgentPmoDryRunSimulationExecutionRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoDryRunSimulationExecutionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    preflightValidationId: input.preflightValidationId ?? null,
    gateApprovalId: input.gateApprovalId ?? null,
    changeSetId: input.changeSetId ?? null,
    simulatedPolicyVersionId: input.simulatedPolicyVersionId ?? null,
    executionStatus: input.executionStatus ?? "created",
    startedAt: null,
    completedAt: null,
    safeExecutionPayload: input.safeExecutionPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  simulationExecutionStore.set(record.id, record);
  return record;
}

export async function getAgentPmoDryRunSimulationExecutionById(id: string): Promise<AgentPmoDryRunSimulationExecutionRecord | null> {
  return simulationExecutionStore.get(id) ?? null;
}

export async function listAgentPmoDryRunSimulationExecutions(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunSimulationExecutionRecord[]> {
  let results = Array.from(simulationExecutionStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateAgentPmoDryRunSimulationExecutionStatus(
  id: string,
  status: AgentPmoDryRunExecutionStatus,
  opts?: { startedAt?: string; completedAt?: string; safeExecutionPayload?: Record<string, unknown> }
): Promise<AgentPmoDryRunSimulationExecutionRecord | null> {
  const record = simulationExecutionStore.get(id);
  if (!record) return null;
  const updated: AgentPmoDryRunSimulationExecutionRecord = {
    ...record,
    executionStatus: status,
    startedAt: opts?.startedAt ?? record.startedAt,
    completedAt: opts?.completedAt ?? record.completedAt,
    safeExecutionPayload: opts?.safeExecutionPayload ?? record.safeExecutionPayload,
    updatedAt: new Date().toISOString(),
  };
  simulationExecutionStore.set(id, updated);
  return updated;
}

// ─── Simulated Impacts ────────────────────────────────────────────────────────

export async function createAgentPmoDryRunSimulatedImpact(input: {
  workspaceId: string;
  dryRunExecutionId: string;
  dryRunRequestId: string;
  impactDomain: AgentPmoDryRunImpactDomain;
  impactLevel?: AgentPmoDryRunImpactLevel;
  impactSummary?: string;
  affectedCount?: number;
  safeImpactPayload?: Record<string, unknown>;
}): Promise<AgentPmoDryRunSimulatedImpactRecord> {
  const record: AgentPmoDryRunSimulatedImpactRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunExecutionId: input.dryRunExecutionId,
    dryRunRequestId: input.dryRunRequestId,
    impactDomain: input.impactDomain,
    impactLevel: input.impactLevel ?? "unknown",
    impactSummary: input.impactSummary ?? "",
    affectedCount: Math.max(0, input.affectedCount ?? 0),
    safeImpactPayload: input.safeImpactPayload ?? {},
    createdAt: new Date().toISOString(),
  };
  simulatedImpactStore.set(record.id, record);
  return record;
}

export async function listAgentPmoDryRunSimulatedImpacts(
  workspaceId: string,
  dryRunExecutionId?: string
): Promise<AgentPmoDryRunSimulatedImpactRecord[]> {
  let results = Array.from(simulatedImpactStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunExecutionId) results = results.filter(r => r.dryRunExecutionId === dryRunExecutionId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Evidence Packages ────────────────────────────────────────────────────────

export async function createAgentPmoDryRunEvidencePackage(input: {
  workspaceId: string;
  dryRunRequestId: string;
  packageStatus?: AgentPmoDryRunEvidencePackageStatus;
  safePackagePayload?: Record<string, unknown>;
}): Promise<AgentPmoDryRunEvidencePackageRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoDryRunEvidencePackageRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    packageStatus: input.packageStatus ?? "created",
    safePackagePayload: input.safePackagePayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  evidencePackageStore.set(record.id, record);
  return record;
}

export async function getAgentPmoDryRunEvidencePackageById(id: string): Promise<AgentPmoDryRunEvidencePackageRecord | null> {
  return evidencePackageStore.get(id) ?? null;
}

export async function listAgentPmoDryRunEvidencePackages(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunEvidencePackageRecord[]> {
  let results = Array.from(evidencePackageStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateAgentPmoDryRunEvidencePackageStatus(
  id: string,
  status: AgentPmoDryRunEvidencePackageStatus
): Promise<AgentPmoDryRunEvidencePackageRecord | null> {
  const record = evidencePackageStore.get(id);
  if (!record) return null;
  const updated = { ...record, packageStatus: status, updatedAt: new Date().toISOString() };
  evidencePackageStore.set(id, updated);
  return updated;
}

// ─── Evidence Sections ────────────────────────────────────────────────────────

export async function createAgentPmoDryRunEvidenceSection(input: {
  workspaceId: string;
  evidencePackageId: string;
  dryRunRequestId: string;
  sectionType: AgentPmoDryRunEvidenceSectionType;
  safeSectionContent?: string;
  safeMarkdown?: string;
}): Promise<AgentPmoDryRunEvidenceSectionRecord> {
  const record: AgentPmoDryRunEvidenceSectionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    evidencePackageId: input.evidencePackageId,
    dryRunRequestId: input.dryRunRequestId,
    sectionType: input.sectionType,
    safeSectionContent: input.safeSectionContent ?? "",
    safeMarkdown: input.safeMarkdown ?? "",
    createdAt: new Date().toISOString(),
  };
  evidenceSectionStore.set(record.id, record);
  return record;
}

export async function listAgentPmoDryRunEvidenceSections(
  workspaceId: string,
  evidencePackageId?: string
): Promise<AgentPmoDryRunEvidenceSectionRecord[]> {
  let results = Array.from(evidenceSectionStore.values()).filter(r => r.workspaceId === workspaceId);
  if (evidencePackageId) results = results.filter(r => r.evidencePackageId === evidencePackageId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Blockers ─────────────────────────────────────────────────────────────────

export async function createAgentPmoDryRunBlocker(input: {
  workspaceId: string;
  dryRunRequestId: string;
  blockerType: AgentPmoDryRunBlockerType;
  blockerStatus?: AgentPmoDryRunBlockerStatus;
  severity?: AgentPmoDryRunBlockerSeverity;
  summary?: string;
}): Promise<AgentPmoDryRunBlockerRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoDryRunBlockerRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    blockerType: input.blockerType,
    blockerStatus: input.blockerStatus ?? "open",
    severity: input.severity ?? "medium",
    summary: input.summary ?? "",
    createdAt: now,
    updatedAt: now,
  };
  blockerStore.set(record.id, record);
  return record;
}

export async function getAgentPmoDryRunBlockerById(id: string): Promise<AgentPmoDryRunBlockerRecord | null> {
  return blockerStore.get(id) ?? null;
}

export async function listAgentPmoDryRunBlockers(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunBlockerRecord[]> {
  let results = Array.from(blockerStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateAgentPmoDryRunBlockerStatus(
  id: string,
  status: AgentPmoDryRunBlockerStatus
): Promise<AgentPmoDryRunBlockerRecord | null> {
  const record = blockerStore.get(id);
  if (!record) return null;
  const updated = { ...record, blockerStatus: status, updatedAt: new Date().toISOString() };
  blockerStore.set(id, updated);
  return updated;
}

// ─── Operator Reviews (append-only) ──────────────────────────────────────────

export async function recordAgentPmoDryRunOperatorReview(input: {
  workspaceId: string;
  dryRunRequestId: string;
  evidencePackageId?: string | null;
  reviewStatus?: AgentPmoDryRunOperatorReviewStatus;
  reviewDecision?: AgentPmoDryRunOperatorReviewDecision | null;
  reviewRationale?: string | null;
  reviewedBy?: string | null;
}): Promise<AgentPmoDryRunOperatorReviewRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoDryRunOperatorReviewRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    evidencePackageId: input.evidencePackageId ?? null,
    reviewStatus: input.reviewStatus ?? "created",
    reviewDecision: input.reviewDecision ?? null,
    reviewRationale: input.reviewRationale ?? null,
    reviewedBy: input.reviewedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  operatorReviewStore.push(record);
  return record;
}

export async function listAgentPmoDryRunOperatorReviews(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunOperatorReviewRecord[]> {
  let results = operatorReviewStore.filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Dry-Run Decisions (append-only) ─────────────────────────────────────────

export async function recordAgentPmoDryRunDecision(input: {
  workspaceId: string;
  dryRunRequestId: string;
  decisionType: AgentPmoDryRunDecisionType;
  decisionStatus?: AgentPmoDryRunDecisionStatus;
  rationale: string;
  decidedBy?: string | null;
}): Promise<AgentPmoDryRunDecisionRecord> {
  const record: AgentPmoDryRunDecisionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    decisionType: input.decisionType,
    decisionStatus: input.decisionStatus ?? "recorded",
    rationale: input.rationale,
    decidedBy: input.decidedBy ?? null,
    createdAt: new Date().toISOString(),
  };
  dryRunDecisionStore.push(record);
  return record;
}

export async function listAgentPmoDryRunDecisions(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunDecisionRecord[]> {
  let results = dryRunDecisionStore.filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function createAgentPmoDryRunExport(input: {
  workspaceId: string;
  dryRunRequestId: string;
  exportFormat: AgentPmoDryRunExportFormat;
  exportStatus?: AgentPmoDryRunExportStatus;
  safeExportContent?: string;
  safetyValidationPassed?: boolean;
  createdBy?: string | null;
}): Promise<AgentPmoDryRunExportRecord> {
  const content = input.safeExportContent ?? "";
  const record: AgentPmoDryRunExportRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    exportFormat: input.exportFormat,
    exportStatus: input.exportStatus ?? "created",
    safeExportContent: content,
    exportSizeBytes: Buffer.byteLength(content, "utf8"),
    safetyValidationPassed: input.safetyValidationPassed ?? false,
    createdBy: input.createdBy ?? null,
    createdAt: new Date().toISOString(),
  };
  exportStore.set(record.id, record);
  return record;
}

export async function getAgentPmoDryRunExportById(id: string): Promise<AgentPmoDryRunExportRecord | null> {
  return exportStore.get(id) ?? null;
}

export async function listAgentPmoDryRunExports(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunExportRecord[]> {
  let results = Array.from(exportStore.values()).filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Events (append-only) ────────────────────────────────────────────────────

export async function recordAgentPmoDryRunEvent(input: {
  workspaceId: string;
  dryRunRequestId?: string | null;
  eventType: AgentPmoDryRunEventType;
  message?: string | null;
  safeEventPayload?: Record<string, unknown>;
  actorId?: string | null;
}): Promise<AgentPmoDryRunEventRecord> {
  const record: AgentPmoDryRunEventRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    safeEventPayload: input.safeEventPayload ?? {},
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  eventStore.push(record);
  return record;
}

export async function listAgentPmoDryRunEvents(
  workspaceId: string,
  dryRunRequestId?: string
): Promise<AgentPmoDryRunEventRecord[]> {
  let results = eventStore.filter(r => r.workspaceId === workspaceId);
  if (dryRunRequestId) results = results.filter(r => r.dryRunRequestId === dryRunRequestId);
  return results.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
