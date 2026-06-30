// ─── PMO Controlled Policy Version Activation & Rollback Gate — Registry ──────
// Pure in-memory store. Does not use Supabase.
// Audit entries, gate decisions, and events are append-only.
// Does NOT activate policy without explicit approval.
// Does NOT execute adapters, mutate projects, or call external APIs.

import { randomUUID } from "node:crypto";
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
  AgentPmoPolicyActivationRequestStatus,
  AgentPmoPolicyActivationPreconditionStatus,
  AgentPmoPolicyActivationGateStatus,
  AgentPmoPolicyActivationGateDecisionType,
  AgentPmoControlledPolicyVersionStatus,
  AgentPmoPolicyActivationExecutionStatus,
  AgentPmoPolicyRollbackRequestStatus,
  AgentPmoPolicyRollbackGateStatus,
  AgentPmoPolicyRollbackGateDecisionType,
  AgentPmoPolicyRollbackExecutionStatus,
  AgentPmoPolicyRollbackVerificationStatus,
  AgentPmoPolicyActivationAuditEntryType,
  AgentPmoPostActivationMonitoringHookType,
  AgentPmoPostActivationMonitoringHookStatus,
  AgentPmoPolicyActivationExportFormat,
  AgentPmoPolicyActivationExportStatus,
  AgentPmoPolicyActivationEventType,
} from "./agent-pmo-policy-activation-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const activationRequestStore = new Map<string, AgentPmoPolicyActivationRequestRecord>();
const preconditionStore = new Map<string, AgentPmoPolicyActivationPreconditionRecord>();
const activationGateStore = new Map<string, AgentPmoPolicyActivationGateRecord>();
const activationGateDecisionStore: AgentPmoPolicyActivationGateDecisionRecord[] = [];
const controlledPolicyVersionStore = new Map<string, AgentPmoControlledPolicyVersionRecord>();
const activePolicyPointerStore = new Map<string, AgentPmoActivePolicyPointerRecord>();
const activationExecutionStore = new Map<string, AgentPmoPolicyActivationExecutionRecord>();
const rollbackRequestStore = new Map<string, AgentPmoPolicyRollbackRequestRecord>();
const rollbackGateStore = new Map<string, AgentPmoPolicyRollbackGateRecord>();
const rollbackGateDecisionStore: AgentPmoPolicyRollbackGateDecisionRecord[] = [];
const rollbackExecutionStore = new Map<string, AgentPmoPolicyRollbackExecutionRecord>();
const rollbackVerificationStore = new Map<string, AgentPmoPolicyRollbackVerificationRecord>();
const auditEntryStore: AgentPmoPolicyActivationAuditEntryRecord[] = [];
const monitoringHookStore = new Map<string, AgentPmoPostActivationMonitoringHookRecord>();
const exportStore = new Map<string, AgentPmoPolicyActivationExportRecord>();
const eventStore: AgentPmoPolicyActivationEventRecord[] = [];

export function _clearPolicyActivationStores(): void {
  activationRequestStore.clear();
  preconditionStore.clear();
  activationGateStore.clear();
  activationGateDecisionStore.length = 0;
  controlledPolicyVersionStore.clear();
  activePolicyPointerStore.clear();
  activationExecutionStore.clear();
  rollbackRequestStore.clear();
  rollbackGateStore.clear();
  rollbackGateDecisionStore.length = 0;
  rollbackExecutionStore.clear();
  rollbackVerificationStore.clear();
  auditEntryStore.length = 0;
  monitoringHookStore.clear();
  exportStore.clear();
  eventStore.length = 0;
}

// ─── Activation Requests ──────────────────────────────────────────────────────

export async function createAgentPmoPolicyActivationRequest(input: {
  workspaceId: string;
  dryRunRequestId: string;
  dryRunDecisionId?: string | null;
  evidencePackageId?: string | null;
  simulatedPolicyVersionId?: string | null;
  planningWorkspaceId?: string | null;
  approvalPackId?: string | null;
  changeRequestId?: string | null;
  requestedBy?: string | null;
  requestReason: string;
  activationStatus?: AgentPmoPolicyActivationRequestStatus;
  safeRequestPayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyActivationRequestRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPolicyActivationRequestRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    dryRunRequestId: input.dryRunRequestId,
    dryRunDecisionId: input.dryRunDecisionId ?? null,
    evidencePackageId: input.evidencePackageId ?? null,
    simulatedPolicyVersionId: input.simulatedPolicyVersionId ?? null,
    planningWorkspaceId: input.planningWorkspaceId ?? null,
    approvalPackId: input.approvalPackId ?? null,
    changeRequestId: input.changeRequestId ?? null,
    requestedBy: input.requestedBy ?? null,
    requestReason: input.requestReason,
    activationStatus: input.activationStatus ?? "preconditions_pending",
    requestVersion: 1,
    safeRequestPayload: input.safeRequestPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  activationRequestStore.set(record.id, record);
  return record;
}

export async function getAgentPmoPolicyActivationRequestById(
  id: string,
): Promise<AgentPmoPolicyActivationRequestRecord | null> {
  return activationRequestStore.get(id) ?? null;
}

export async function listAgentPmoPolicyActivationRequests(
  workspaceId: string,
): Promise<AgentPmoPolicyActivationRequestRecord[]> {
  return [...activationRequestStore.values()].filter(r => r.workspaceId === workspaceId);
}

export async function updateAgentPmoPolicyActivationRequestStatus(
  id: string,
  status: AgentPmoPolicyActivationRequestStatus,
): Promise<AgentPmoPolicyActivationRequestRecord> {
  const record = activationRequestStore.get(id);
  if (!record) throw new Error(`Activation request not found: ${id}`);
  const updated = { ...record, activationStatus: status, updatedAt: new Date().toISOString() };
  activationRequestStore.set(id, updated);
  return updated;
}

// ─── Activation Preconditions ─────────────────────────────────────────────────

export async function createAgentPmoPolicyActivationPrecondition(input: {
  workspaceId: string;
  activationRequestId: string;
  preconditionKey: string;
  preconditionStatus: AgentPmoPolicyActivationPreconditionStatus;
  summary: string;
}): Promise<AgentPmoPolicyActivationPreconditionRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPolicyActivationPreconditionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    preconditionKey: input.preconditionKey,
    preconditionStatus: input.preconditionStatus,
    summary: input.summary,
    createdAt: now,
    updatedAt: now,
  };
  preconditionStore.set(record.id, record);
  return record;
}

export async function listAgentPmoPolicyActivationPreconditions(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoPolicyActivationPreconditionRecord[]> {
  return [...preconditionStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}

export async function updateAgentPmoPolicyActivationPreconditionStatus(
  id: string,
  status: AgentPmoPolicyActivationPreconditionStatus,
): Promise<AgentPmoPolicyActivationPreconditionRecord> {
  const record = preconditionStore.get(id);
  if (!record) throw new Error(`Activation precondition not found: ${id}`);
  const updated = { ...record, preconditionStatus: status, updatedAt: new Date().toISOString() };
  preconditionStore.set(id, updated);
  return updated;
}

// ─── Activation Gates ─────────────────────────────────────────────────────────

export async function createAgentPmoPolicyActivationGate(input: {
  workspaceId: string;
  activationRequestId: string;
  gateStatus?: AgentPmoPolicyActivationGateStatus;
  reviewedBy?: string | null;
  safeGatePayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyActivationGateRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPolicyActivationGateRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    gateStatus: input.gateStatus ?? "under_review",
    reviewedBy: input.reviewedBy ?? null,
    safeGatePayload: input.safeGatePayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  activationGateStore.set(record.id, record);
  return record;
}

export async function getAgentPmoPolicyActivationGateById(
  id: string,
): Promise<AgentPmoPolicyActivationGateRecord | null> {
  return activationGateStore.get(id) ?? null;
}

export async function listAgentPmoPolicyActivationGates(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoPolicyActivationGateRecord[]> {
  return [...activationGateStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}

export async function updateAgentPmoPolicyActivationGateStatus(
  id: string,
  status: AgentPmoPolicyActivationGateStatus,
): Promise<AgentPmoPolicyActivationGateRecord> {
  const record = activationGateStore.get(id);
  if (!record) throw new Error(`Activation gate not found: ${id}`);
  const updated = { ...record, gateStatus: status, updatedAt: new Date().toISOString() };
  activationGateStore.set(id, updated);
  return updated;
}

export async function recordAgentPmoPolicyActivationGateDecision(input: {
  workspaceId: string;
  activationGateId: string;
  activationRequestId: string;
  decisionType: AgentPmoPolicyActivationGateDecisionType;
  rationale: string;
  decidedBy?: string | null;
}): Promise<AgentPmoPolicyActivationGateDecisionRecord> {
  const record: AgentPmoPolicyActivationGateDecisionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationGateId: input.activationGateId,
    activationRequestId: input.activationRequestId,
    decisionType: input.decisionType,
    rationale: input.rationale,
    decidedBy: input.decidedBy ?? null,
    createdAt: new Date().toISOString(),
  };
  activationGateDecisionStore.push(record);
  return record;
}

export async function listAgentPmoPolicyActivationGateDecisions(
  workspaceId: string,
  activationGateId?: string,
): Promise<AgentPmoPolicyActivationGateDecisionRecord[]> {
  return activationGateDecisionStore.filter(r =>
    r.workspaceId === workspaceId &&
    (activationGateId === undefined || r.activationGateId === activationGateId),
  );
}

// ─── Controlled Policy Versions ───────────────────────────────────────────────

export async function createAgentPmoControlledPolicyVersion(input: {
  workspaceId: string;
  activationRequestId: string;
  dryRunRequestId?: string | null;
  simulatedPolicyVersionId?: string | null;
  versionLabel: string;
  versionNumber: number;
  policyArea: string;
  versionStatus?: AgentPmoControlledPolicyVersionStatus;
  safePolicyPayload?: Record<string, unknown>;
  safeDiffPayload?: Record<string, unknown>;
}): Promise<AgentPmoControlledPolicyVersionRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoControlledPolicyVersionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    dryRunRequestId: input.dryRunRequestId ?? null,
    simulatedPolicyVersionId: input.simulatedPolicyVersionId ?? null,
    versionLabel: input.versionLabel,
    versionNumber: input.versionNumber,
    policyArea: input.policyArea,
    versionStatus: input.versionStatus ?? "ready_for_activation",
    safePolicyPayload: input.safePolicyPayload ?? {},
    safeDiffPayload: input.safeDiffPayload ?? {},
    createdAt: now,
    activatedAt: null,
    updatedAt: now,
  };
  controlledPolicyVersionStore.set(record.id, record);
  return record;
}

export async function getAgentPmoControlledPolicyVersionById(
  id: string,
): Promise<AgentPmoControlledPolicyVersionRecord | null> {
  return controlledPolicyVersionStore.get(id) ?? null;
}

export async function listAgentPmoControlledPolicyVersions(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoControlledPolicyVersionRecord[]> {
  return [...controlledPolicyVersionStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}

export async function updateAgentPmoControlledPolicyVersionStatus(
  id: string,
  status: AgentPmoControlledPolicyVersionStatus,
  activatedAt?: string | null,
): Promise<AgentPmoControlledPolicyVersionRecord> {
  const record = controlledPolicyVersionStore.get(id);
  if (!record) throw new Error(`Controlled policy version not found: ${id}`);
  const updated = {
    ...record,
    versionStatus: status,
    activatedAt: activatedAt ?? record.activatedAt,
    updatedAt: new Date().toISOString(),
  };
  controlledPolicyVersionStore.set(id, updated);
  return updated;
}

// ─── Active Policy Pointers ───────────────────────────────────────────────────

export async function upsertAgentPmoActivePolicyPointer(input: {
  workspaceId: string;
  policyArea: string;
  activePolicyVersionId: string | null;
  previousPolicyVersionId?: string | null;
  activationRequestId?: string | null;
  activatedBy?: string | null;
  activatedAt?: string | null;
  rollbackAvailable?: boolean;
  safePointerPayload?: Record<string, unknown>;
}): Promise<AgentPmoActivePolicyPointerRecord> {
  const key = `${input.workspaceId}::${input.policyArea}`;
  const existing = activePolicyPointerStore.get(key);
  const now = new Date().toISOString();
  const record: AgentPmoActivePolicyPointerRecord = {
    id: existing?.id ?? randomUUID(),
    workspaceId: input.workspaceId,
    policyArea: input.policyArea,
    activePolicyVersionId: input.activePolicyVersionId,
    previousPolicyVersionId: input.previousPolicyVersionId ?? existing?.activePolicyVersionId ?? null,
    activationRequestId: input.activationRequestId ?? null,
    activatedBy: input.activatedBy ?? null,
    activatedAt: input.activatedAt ?? now,
    rollbackAvailable: input.rollbackAvailable ?? false,
    safePointerPayload: input.safePointerPayload ?? {},
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  activePolicyPointerStore.set(key, record);
  return record;
}

export async function getAgentPmoActivePolicyPointerByPolicyArea(
  workspaceId: string,
  policyArea: string,
): Promise<AgentPmoActivePolicyPointerRecord | null> {
  return activePolicyPointerStore.get(`${workspaceId}::${policyArea}`) ?? null;
}

export async function listAgentPmoActivePolicyPointers(
  workspaceId: string,
): Promise<AgentPmoActivePolicyPointerRecord[]> {
  return [...activePolicyPointerStore.values()].filter(r => r.workspaceId === workspaceId);
}

// ─── Activation Executions ────────────────────────────────────────────────────

export async function createAgentPmoPolicyActivationExecution(input: {
  workspaceId: string;
  activationRequestId: string;
  activationGateId?: string | null;
  controlledPolicyVersionId?: string | null;
  activePolicyPointerId?: string | null;
  executionStatus?: AgentPmoPolicyActivationExecutionStatus;
  safeExecutionPayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyActivationExecutionRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPolicyActivationExecutionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    activationGateId: input.activationGateId ?? null,
    controlledPolicyVersionId: input.controlledPolicyVersionId ?? null,
    activePolicyPointerId: input.activePolicyPointerId ?? null,
    executionStatus: input.executionStatus ?? "created",
    startedAt: null,
    completedAt: null,
    safeExecutionPayload: input.safeExecutionPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  activationExecutionStore.set(record.id, record);
  return record;
}

export async function getAgentPmoPolicyActivationExecutionById(
  id: string,
): Promise<AgentPmoPolicyActivationExecutionRecord | null> {
  return activationExecutionStore.get(id) ?? null;
}

export async function listAgentPmoPolicyActivationExecutions(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoPolicyActivationExecutionRecord[]> {
  return [...activationExecutionStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}

export async function updateAgentPmoPolicyActivationExecutionStatus(
  id: string,
  status: AgentPmoPolicyActivationExecutionStatus,
  timestamps?: { startedAt?: string | null; completedAt?: string | null },
): Promise<AgentPmoPolicyActivationExecutionRecord> {
  const record = activationExecutionStore.get(id);
  if (!record) throw new Error(`Activation execution not found: ${id}`);
  const updated = {
    ...record,
    executionStatus: status,
    startedAt: timestamps?.startedAt ?? record.startedAt,
    completedAt: timestamps?.completedAt ?? record.completedAt,
    updatedAt: new Date().toISOString(),
  };
  activationExecutionStore.set(id, updated);
  return updated;
}

// ─── Rollback Requests ────────────────────────────────────────────────────────

export async function createAgentPmoPolicyRollbackRequest(input: {
  workspaceId: string;
  activationRequestId: string;
  controlledPolicyVersionId?: string | null;
  activePolicyPointerId?: string | null;
  requestedBy?: string | null;
  requestReason: string;
  rollbackStatus?: AgentPmoPolicyRollbackRequestStatus;
  safeRollbackRequestPayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyRollbackRequestRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPolicyRollbackRequestRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    controlledPolicyVersionId: input.controlledPolicyVersionId ?? null,
    activePolicyPointerId: input.activePolicyPointerId ?? null,
    requestedBy: input.requestedBy ?? null,
    requestReason: input.requestReason,
    rollbackStatus: input.rollbackStatus ?? "rollback_review_required",
    safeRollbackRequestPayload: input.safeRollbackRequestPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  rollbackRequestStore.set(record.id, record);
  return record;
}

export async function getAgentPmoPolicyRollbackRequestById(
  id: string,
): Promise<AgentPmoPolicyRollbackRequestRecord | null> {
  return rollbackRequestStore.get(id) ?? null;
}

export async function listAgentPmoPolicyRollbackRequests(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoPolicyRollbackRequestRecord[]> {
  return [...rollbackRequestStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}

export async function updateAgentPmoPolicyRollbackRequestStatus(
  id: string,
  status: AgentPmoPolicyRollbackRequestStatus,
): Promise<AgentPmoPolicyRollbackRequestRecord> {
  const record = rollbackRequestStore.get(id);
  if (!record) throw new Error(`Rollback request not found: ${id}`);
  const updated = { ...record, rollbackStatus: status, updatedAt: new Date().toISOString() };
  rollbackRequestStore.set(id, updated);
  return updated;
}

// ─── Rollback Gates ───────────────────────────────────────────────────────────

export async function createAgentPmoPolicyRollbackGate(input: {
  workspaceId: string;
  rollbackRequestId: string;
  gateStatus?: AgentPmoPolicyRollbackGateStatus;
  reviewedBy?: string | null;
  safeGatePayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyRollbackGateRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPolicyRollbackGateRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    rollbackRequestId: input.rollbackRequestId,
    gateStatus: input.gateStatus ?? "under_review",
    reviewedBy: input.reviewedBy ?? null,
    safeGatePayload: input.safeGatePayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  rollbackGateStore.set(record.id, record);
  return record;
}

export async function getAgentPmoPolicyRollbackGateById(
  id: string,
): Promise<AgentPmoPolicyRollbackGateRecord | null> {
  return rollbackGateStore.get(id) ?? null;
}

export async function listAgentPmoPolicyRollbackGates(
  workspaceId: string,
  rollbackRequestId?: string,
): Promise<AgentPmoPolicyRollbackGateRecord[]> {
  return [...rollbackGateStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (rollbackRequestId === undefined || r.rollbackRequestId === rollbackRequestId),
  );
}

export async function updateAgentPmoPolicyRollbackGateStatus(
  id: string,
  status: AgentPmoPolicyRollbackGateStatus,
): Promise<AgentPmoPolicyRollbackGateRecord> {
  const record = rollbackGateStore.get(id);
  if (!record) throw new Error(`Rollback gate not found: ${id}`);
  const updated = { ...record, gateStatus: status, updatedAt: new Date().toISOString() };
  rollbackGateStore.set(id, updated);
  return updated;
}

export async function recordAgentPmoPolicyRollbackGateDecision(input: {
  workspaceId: string;
  rollbackGateId: string;
  rollbackRequestId: string;
  decisionType: AgentPmoPolicyRollbackGateDecisionType;
  rationale: string;
  decidedBy?: string | null;
}): Promise<AgentPmoPolicyRollbackGateDecisionRecord> {
  const record: AgentPmoPolicyRollbackGateDecisionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    rollbackGateId: input.rollbackGateId,
    rollbackRequestId: input.rollbackRequestId,
    decisionType: input.decisionType,
    rationale: input.rationale,
    decidedBy: input.decidedBy ?? null,
    createdAt: new Date().toISOString(),
  };
  rollbackGateDecisionStore.push(record);
  return record;
}

export async function listAgentPmoPolicyRollbackGateDecisions(
  workspaceId: string,
  rollbackGateId?: string,
): Promise<AgentPmoPolicyRollbackGateDecisionRecord[]> {
  return rollbackGateDecisionStore.filter(r =>
    r.workspaceId === workspaceId &&
    (rollbackGateId === undefined || r.rollbackGateId === rollbackGateId),
  );
}

// ─── Rollback Executions ──────────────────────────────────────────────────────

export async function createAgentPmoPolicyRollbackExecution(input: {
  workspaceId: string;
  rollbackRequestId: string;
  rollbackGateId?: string | null;
  activationRequestId?: string | null;
  controlledPolicyVersionId?: string | null;
  previousPolicyVersionId?: string | null;
  activePolicyPointerId?: string | null;
  executionStatus?: AgentPmoPolicyRollbackExecutionStatus;
  safeRollbackPayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyRollbackExecutionRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPolicyRollbackExecutionRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    rollbackRequestId: input.rollbackRequestId,
    rollbackGateId: input.rollbackGateId ?? null,
    activationRequestId: input.activationRequestId ?? null,
    controlledPolicyVersionId: input.controlledPolicyVersionId ?? null,
    previousPolicyVersionId: input.previousPolicyVersionId ?? null,
    activePolicyPointerId: input.activePolicyPointerId ?? null,
    executionStatus: input.executionStatus ?? "created",
    startedAt: null,
    completedAt: null,
    safeRollbackPayload: input.safeRollbackPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  rollbackExecutionStore.set(record.id, record);
  return record;
}

export async function getAgentPmoPolicyRollbackExecutionById(
  id: string,
): Promise<AgentPmoPolicyRollbackExecutionRecord | null> {
  return rollbackExecutionStore.get(id) ?? null;
}

export async function listAgentPmoPolicyRollbackExecutions(
  workspaceId: string,
  rollbackRequestId?: string,
): Promise<AgentPmoPolicyRollbackExecutionRecord[]> {
  return [...rollbackExecutionStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (rollbackRequestId === undefined || r.rollbackRequestId === rollbackRequestId),
  );
}

export async function updateAgentPmoPolicyRollbackExecutionStatus(
  id: string,
  status: AgentPmoPolicyRollbackExecutionStatus,
  timestamps?: { startedAt?: string | null; completedAt?: string | null },
): Promise<AgentPmoPolicyRollbackExecutionRecord> {
  const record = rollbackExecutionStore.get(id);
  if (!record) throw new Error(`Rollback execution not found: ${id}`);
  const updated = {
    ...record,
    executionStatus: status,
    startedAt: timestamps?.startedAt ?? record.startedAt,
    completedAt: timestamps?.completedAt ?? record.completedAt,
    updatedAt: new Date().toISOString(),
  };
  rollbackExecutionStore.set(id, updated);
  return updated;
}

// ─── Rollback Verifications ───────────────────────────────────────────────────

export async function createAgentPmoPolicyRollbackVerification(input: {
  workspaceId: string;
  rollbackExecutionId: string;
  rollbackRequestId?: string | null;
  verificationStatus: AgentPmoPolicyRollbackVerificationStatus;
  checksTotal: number;
  checksPassed: number;
  checksFailed: number;
  safeVerificationPayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyRollbackVerificationRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPolicyRollbackVerificationRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    rollbackExecutionId: input.rollbackExecutionId,
    rollbackRequestId: input.rollbackRequestId ?? null,
    verificationStatus: input.verificationStatus,
    checksTotal: input.checksTotal,
    checksPassed: input.checksPassed,
    checksFailed: input.checksFailed,
    safeVerificationPayload: input.safeVerificationPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  rollbackVerificationStore.set(record.id, record);
  return record;
}

export async function listAgentPmoPolicyRollbackVerifications(
  workspaceId: string,
  rollbackExecutionId?: string,
): Promise<AgentPmoPolicyRollbackVerificationRecord[]> {
  return [...rollbackVerificationStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (rollbackExecutionId === undefined || r.rollbackExecutionId === rollbackExecutionId),
  );
}

export async function updateAgentPmoPolicyRollbackVerificationStatus(
  id: string,
  status: AgentPmoPolicyRollbackVerificationStatus,
): Promise<AgentPmoPolicyRollbackVerificationRecord> {
  const record = rollbackVerificationStore.get(id);
  if (!record) throw new Error(`Rollback verification not found: ${id}`);
  const updated = { ...record, verificationStatus: status, updatedAt: new Date().toISOString() };
  rollbackVerificationStore.set(id, updated);
  return updated;
}

// ─── Activation Audit Entries ─────────────────────────────────────────────────

export async function recordAgentPmoPolicyActivationAuditEntry(input: {
  workspaceId: string;
  activationRequestId?: string | null;
  entryType: AgentPmoPolicyActivationAuditEntryType;
  summary: string;
  actorId?: string | null;
  safeAuditPayload?: Record<string, unknown>;
}): Promise<AgentPmoPolicyActivationAuditEntryRecord> {
  const record: AgentPmoPolicyActivationAuditEntryRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId ?? null,
    entryType: input.entryType,
    summary: input.summary,
    actorId: input.actorId ?? null,
    safeAuditPayload: input.safeAuditPayload ?? {},
    createdAt: new Date().toISOString(),
  };
  auditEntryStore.push(record);
  return record;
}

export async function listAgentPmoPolicyActivationAuditEntries(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoPolicyActivationAuditEntryRecord[]> {
  return auditEntryStore.filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}

// ─── Post-Activation Monitoring Hooks ─────────────────────────────────────────

export async function createAgentPmoPostActivationMonitoringHook(input: {
  workspaceId: string;
  activationRequestId: string;
  hookType: AgentPmoPostActivationMonitoringHookType;
  hookStatus?: AgentPmoPostActivationMonitoringHookStatus;
  summary: string;
  safeHookPayload?: Record<string, unknown>;
}): Promise<AgentPmoPostActivationMonitoringHookRecord> {
  const now = new Date().toISOString();
  const record: AgentPmoPostActivationMonitoringHookRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    hookType: input.hookType,
    hookStatus: input.hookStatus ?? "active",
    summary: input.summary,
    safeHookPayload: input.safeHookPayload ?? {},
    createdAt: now,
    updatedAt: now,
  };
  monitoringHookStore.set(record.id, record);
  return record;
}

export async function listAgentPmoPostActivationMonitoringHooks(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoPostActivationMonitoringHookRecord[]> {
  return [...monitoringHookStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}

export async function updateAgentPmoPostActivationMonitoringHookStatus(
  id: string,
  status: AgentPmoPostActivationMonitoringHookStatus,
): Promise<AgentPmoPostActivationMonitoringHookRecord> {
  const record = monitoringHookStore.get(id);
  if (!record) throw new Error(`Monitoring hook not found: ${id}`);
  const updated = { ...record, hookStatus: status, updatedAt: new Date().toISOString() };
  monitoringHookStore.set(id, updated);
  return updated;
}

// ─── Activation Exports ───────────────────────────────────────────────────────

export async function createAgentPmoPolicyActivationExport(input: {
  workspaceId: string;
  activationRequestId: string;
  exportFormat: AgentPmoPolicyActivationExportFormat;
  exportStatus?: AgentPmoPolicyActivationExportStatus;
  safeExportContent: string;
  exportSizeBytes: number;
  safetyValidationPassed: boolean;
  createdBy?: string | null;
}): Promise<AgentPmoPolicyActivationExportRecord> {
  const record: AgentPmoPolicyActivationExportRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId,
    exportFormat: input.exportFormat,
    exportStatus: input.exportStatus ?? "generated",
    safeExportContent: input.safeExportContent,
    exportSizeBytes: input.exportSizeBytes,
    safetyValidationPassed: input.safetyValidationPassed,
    createdBy: input.createdBy ?? null,
    createdAt: new Date().toISOString(),
  };
  exportStore.set(record.id, record);
  return record;
}

export async function getAgentPmoPolicyActivationExportById(
  id: string,
): Promise<AgentPmoPolicyActivationExportRecord | null> {
  return exportStore.get(id) ?? null;
}

export async function listAgentPmoPolicyActivationExports(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoPolicyActivationExportRecord[]> {
  return [...exportStore.values()].filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}

// ─── Activation Events ────────────────────────────────────────────────────────

export async function recordAgentPmoPolicyActivationEvent(input: {
  workspaceId: string;
  activationRequestId?: string | null;
  eventType: AgentPmoPolicyActivationEventType;
  message?: string | null;
  safeEventPayload?: Record<string, unknown>;
  actorId?: string | null;
}): Promise<AgentPmoPolicyActivationEventRecord> {
  const record: AgentPmoPolicyActivationEventRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    activationRequestId: input.activationRequestId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    safeEventPayload: input.safeEventPayload ?? {},
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  eventStore.push(record);
  return record;
}

export async function listAgentPmoPolicyActivationEvents(
  workspaceId: string,
  activationRequestId?: string,
): Promise<AgentPmoPolicyActivationEventRecord[]> {
  return eventStore.filter(r =>
    r.workspaceId === workspaceId &&
    (activationRequestId === undefined || r.activationRequestId === activationRequestId),
  );
}
