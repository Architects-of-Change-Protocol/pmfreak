// ─── PMO Controlled Project Intelligence Handoff — Registry ──────────────────
// Pure in-memory store. Does not use Supabase.
// Audit events, gate decisions, outgoing notes, and assignment history are append-only.
// Does NOT delete project memory, mutate external systems, or call external APIs.

import { randomUUID } from "node:crypto";
import type {
  AgentPmoProjectHandoffRequestRecord,
  AgentPmoProjectContextValidationRecord,
  AgentPmoProjectHandoffGateRecord,
  AgentPmoProjectHandoffGateDecisionRecord,
  AgentPmoProjectHandoffPackRecord,
  AgentPmoProjectMemorySnapshotRecord,
  AgentPmoProjectStatusSnapshotRecord,
  AgentPmoProjectHandoffSnapshotItemRecord,
  AgentPmoStakeholderContextSnapshotRecord,
  AgentPmoOutgoingPmNoteRecord,
  AgentPmoIncomingPmAcceptanceRecord,
  AgentPmoControlledProjectAssignmentPointerRecord,
  AgentPmoProjectAssignmentHistoryRecord,
  AgentPmoHandoffContinuityCheckRecord,
  AgentPmoProjectHandoffExportRecord,
  AgentPmoProjectHandoffAuditEventRecord,
  AgentPmoProjectHandoffRequestStatus,
  AgentPmoProjectContextValidationStatus,
  AgentPmoProjectHandoffGateStatus,
  AgentPmoProjectHandoffPackStatus,
  AgentPmoProjectMemorySnapshotStatus,
  AgentPmoProjectHandoffSnapshotItemStatus,
  AgentPmoOutgoingPmNoteStatus,
  AgentPmoIncomingPmAcceptanceStatus,
  AgentPmoHandoffContinuityCheckStatus,
  AgentPmoProjectHandoffAuditEventType,
} from "./agent-pmo-project-handoff-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const handoffRequestStore = new Map<string, AgentPmoProjectHandoffRequestRecord>();
const contextValidationStore: AgentPmoProjectContextValidationRecord[] = [];
const handoffGateStore = new Map<string, AgentPmoProjectHandoffGateRecord>();
const handoffGateDecisionStore: AgentPmoProjectHandoffGateDecisionRecord[] = [];
const handoffPackStore = new Map<string, AgentPmoProjectHandoffPackRecord>();
const memorySnapshotStore: AgentPmoProjectMemorySnapshotRecord[] = [];
const statusSnapshotStore: AgentPmoProjectStatusSnapshotRecord[] = [];
const snapshotItemStore: AgentPmoProjectHandoffSnapshotItemRecord[] = [];
const stakeholderContextStore: AgentPmoStakeholderContextSnapshotRecord[] = [];
const outgoingPmNoteStore: AgentPmoOutgoingPmNoteRecord[] = [];
const incomingPmAcceptanceStore: AgentPmoIncomingPmAcceptanceRecord[] = [];
const assignmentPointerStore = new Map<string, AgentPmoControlledProjectAssignmentPointerRecord>();
const assignmentHistoryStore: AgentPmoProjectAssignmentHistoryRecord[] = [];
const continuityCheckStore: AgentPmoHandoffContinuityCheckRecord[] = [];
const handoffExportStore = new Map<string, AgentPmoProjectHandoffExportRecord>();
const auditEventStore: AgentPmoProjectHandoffAuditEventRecord[] = [];

const now = () => new Date().toISOString();

// ─── Handoff Requests ─────────────────────────────────────────────────────────

export async function createAgentPmoProjectHandoffRequest(
  data: Omit<AgentPmoProjectHandoffRequestRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoProjectHandoffRequestRecord> {
  const record: AgentPmoProjectHandoffRequestRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  handoffRequestStore.set(record.id, record);
  return record;
}

export async function getAgentPmoProjectHandoffRequestById(
  id: string,
): Promise<AgentPmoProjectHandoffRequestRecord | null> {
  return handoffRequestStore.get(id) ?? null;
}

export async function listAgentPmoProjectHandoffRequests(
  workspaceId: string,
): Promise<AgentPmoProjectHandoffRequestRecord[]> {
  return [...handoffRequestStore.values()].filter((r) => r.workspaceId === workspaceId);
}

export async function updateAgentPmoProjectHandoffRequestStatus(
  id: string,
  status: AgentPmoProjectHandoffRequestStatus,
): Promise<AgentPmoProjectHandoffRequestRecord | null> {
  const record = handoffRequestStore.get(id);
  if (!record) return null;
  const updated = { ...record, status, updatedAt: now() };
  handoffRequestStore.set(id, updated);
  return updated;
}

// ─── Context Validations ──────────────────────────────────────────────────────

export async function createAgentPmoProjectContextValidation(
  data: Omit<AgentPmoProjectContextValidationRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoProjectContextValidationRecord> {
  const record: AgentPmoProjectContextValidationRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  contextValidationStore.push(record);
  return record;
}

export async function listAgentPmoProjectContextValidations(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoProjectContextValidationRecord[]> {
  return contextValidationStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

export async function updateAgentPmoProjectContextValidationStatus(
  id: string,
  status: AgentPmoProjectContextValidationStatus,
): Promise<AgentPmoProjectContextValidationRecord | null> {
  const idx = contextValidationStore.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = { ...contextValidationStore[idx], status, updatedAt: now() };
  contextValidationStore[idx] = updated;
  return updated;
}

// ─── Handoff Gates ────────────────────────────────────────────────────────────

export async function createAgentPmoProjectHandoffGate(
  data: Omit<AgentPmoProjectHandoffGateRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoProjectHandoffGateRecord> {
  const record: AgentPmoProjectHandoffGateRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  handoffGateStore.set(record.id, record);
  return record;
}

export async function getAgentPmoProjectHandoffGateById(
  id: string,
): Promise<AgentPmoProjectHandoffGateRecord | null> {
  return handoffGateStore.get(id) ?? null;
}

export async function listAgentPmoProjectHandoffGates(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoProjectHandoffGateRecord[]> {
  return [...handoffGateStore.values()].filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

export async function updateAgentPmoProjectHandoffGateStatus(
  id: string,
  gateStatus: AgentPmoProjectHandoffGateStatus,
): Promise<AgentPmoProjectHandoffGateRecord | null> {
  const record = handoffGateStore.get(id);
  if (!record) return null;
  const updated = { ...record, gateStatus, updatedAt: now() };
  handoffGateStore.set(id, updated);
  return updated;
}

// ─── Gate Decisions (append-only) ────────────────────────────────────────────

export async function recordAgentPmoProjectHandoffGateDecision(
  data: Omit<AgentPmoProjectHandoffGateDecisionRecord, "id" | "createdAt">,
): Promise<AgentPmoProjectHandoffGateDecisionRecord> {
  const record: AgentPmoProjectHandoffGateDecisionRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
  };
  handoffGateDecisionStore.push(record);
  return record;
}

export async function listAgentPmoProjectHandoffGateDecisions(
  workspaceId: string,
  handoffGateId?: string,
): Promise<AgentPmoProjectHandoffGateDecisionRecord[]> {
  return handoffGateDecisionStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffGateId === undefined || r.handoffGateId === handoffGateId),
  );
}

// ─── Handoff Packs ────────────────────────────────────────────────────────────

export async function createAgentPmoProjectHandoffPack(
  data: Omit<AgentPmoProjectHandoffPackRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoProjectHandoffPackRecord> {
  const record: AgentPmoProjectHandoffPackRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  handoffPackStore.set(record.id, record);
  return record;
}

export async function getAgentPmoProjectHandoffPackById(
  id: string,
): Promise<AgentPmoProjectHandoffPackRecord | null> {
  return handoffPackStore.get(id) ?? null;
}

export async function listAgentPmoProjectHandoffPacks(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoProjectHandoffPackRecord[]> {
  return [...handoffPackStore.values()].filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

export async function updateAgentPmoProjectHandoffPackStatus(
  id: string,
  packStatus: AgentPmoProjectHandoffPackStatus,
): Promise<AgentPmoProjectHandoffPackRecord | null> {
  const record = handoffPackStore.get(id);
  if (!record) return null;
  const updated = { ...record, packStatus, updatedAt: now() };
  handoffPackStore.set(id, updated);
  return updated;
}

// ─── Memory Snapshots ─────────────────────────────────────────────────────────

export async function createAgentPmoProjectMemorySnapshot(
  data: Omit<AgentPmoProjectMemorySnapshotRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoProjectMemorySnapshotRecord> {
  const record: AgentPmoProjectMemorySnapshotRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  memorySnapshotStore.push(record);
  return record;
}

export async function listAgentPmoProjectMemorySnapshots(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoProjectMemorySnapshotRecord[]> {
  return memorySnapshotStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

export async function updateAgentPmoProjectMemorySnapshotStatus(
  id: string,
  snapshotStatus: AgentPmoProjectMemorySnapshotStatus,
): Promise<AgentPmoProjectMemorySnapshotRecord | null> {
  const idx = memorySnapshotStore.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = { ...memorySnapshotStore[idx], snapshotStatus, updatedAt: now() };
  memorySnapshotStore[idx] = updated;
  return updated;
}

// ─── Status Snapshots ─────────────────────────────────────────────────────────

export async function createAgentPmoProjectStatusSnapshot(
  data: Omit<AgentPmoProjectStatusSnapshotRecord, "id" | "createdAt">,
): Promise<AgentPmoProjectStatusSnapshotRecord> {
  const record: AgentPmoProjectStatusSnapshotRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
  };
  statusSnapshotStore.push(record);
  return record;
}

export async function listAgentPmoProjectStatusSnapshots(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoProjectStatusSnapshotRecord[]> {
  return statusSnapshotStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

// ─── Snapshot Items ───────────────────────────────────────────────────────────

export async function createAgentPmoProjectHandoffSnapshotItem(
  data: Omit<AgentPmoProjectHandoffSnapshotItemRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoProjectHandoffSnapshotItemRecord> {
  const record: AgentPmoProjectHandoffSnapshotItemRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  snapshotItemStore.push(record);
  return record;
}

export async function listAgentPmoProjectHandoffSnapshotItems(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoProjectHandoffSnapshotItemRecord[]> {
  return snapshotItemStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

export async function updateAgentPmoProjectHandoffSnapshotItemStatus(
  id: string,
  itemStatus: AgentPmoProjectHandoffSnapshotItemStatus,
): Promise<AgentPmoProjectHandoffSnapshotItemRecord | null> {
  const idx = snapshotItemStore.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = { ...snapshotItemStore[idx], itemStatus, updatedAt: now() };
  snapshotItemStore[idx] = updated;
  return updated;
}

// ─── Stakeholder Context ──────────────────────────────────────────────────────

export async function createAgentPmoStakeholderContextSnapshot(
  data: Omit<AgentPmoStakeholderContextSnapshotRecord, "id" | "createdAt">,
): Promise<AgentPmoStakeholderContextSnapshotRecord> {
  const record: AgentPmoStakeholderContextSnapshotRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
  };
  stakeholderContextStore.push(record);
  return record;
}

export async function listAgentPmoStakeholderContextSnapshots(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoStakeholderContextSnapshotRecord[]> {
  return stakeholderContextStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

// ─── Outgoing PM Notes (append-only) ─────────────────────────────────────────

export async function recordAgentPmoOutgoingPmNote(
  data: Omit<AgentPmoOutgoingPmNoteRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoOutgoingPmNoteRecord> {
  const record: AgentPmoOutgoingPmNoteRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  outgoingPmNoteStore.push(record);
  return record;
}

export async function listAgentPmoOutgoingPmNotes(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoOutgoingPmNoteRecord[]> {
  return outgoingPmNoteStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

export async function updateAgentPmoOutgoingPmNoteStatus(
  id: string,
  noteStatus: AgentPmoOutgoingPmNoteStatus,
): Promise<AgentPmoOutgoingPmNoteRecord | null> {
  const idx = outgoingPmNoteStore.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = { ...outgoingPmNoteStore[idx], noteStatus, updatedAt: now() };
  outgoingPmNoteStore[idx] = updated;
  return updated;
}

// ─── Incoming PM Acceptance (append-only) ────────────────────────────────────

export async function recordAgentPmoIncomingPmAcceptance(
  data: Omit<AgentPmoIncomingPmAcceptanceRecord, "id" | "createdAt">,
): Promise<AgentPmoIncomingPmAcceptanceRecord> {
  const record: AgentPmoIncomingPmAcceptanceRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
  };
  incomingPmAcceptanceStore.push(record);
  return record;
}

export async function listAgentPmoIncomingPmAcceptances(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoIncomingPmAcceptanceRecord[]> {
  return incomingPmAcceptanceStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

export async function updateAgentPmoIncomingPmAcceptanceStatus(
  id: string,
  acceptanceStatus: AgentPmoIncomingPmAcceptanceStatus,
): Promise<AgentPmoIncomingPmAcceptanceRecord | null> {
  const idx = incomingPmAcceptanceStore.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const updated = { ...incomingPmAcceptanceStore[idx], acceptanceStatus };
  incomingPmAcceptanceStore[idx] = updated;
  return updated;
}

// ─── Assignment Pointer (upsert) ──────────────────────────────────────────────

export async function upsertAgentPmoControlledProjectAssignmentPointer(
  data: Omit<AgentPmoControlledProjectAssignmentPointerRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoControlledProjectAssignmentPointerRecord> {
  const key = `${data.workspaceId}::${data.projectId}`;
  const existing = assignmentPointerStore.get(key);
  if (existing) {
    const updated: AgentPmoControlledProjectAssignmentPointerRecord = {
      ...existing,
      activePmId: data.activePmId,
      previousPmId: existing.activePmId,
      handoffRequestId: data.handoffRequestId,
      handoffCompletedById: data.handoffCompletedById,
      handoffCompletedAt: data.handoffCompletedAt,
      assignmentVersion: existing.assignmentVersion + 1,
      handoffReason: data.handoffReason,
      safeAssignmentPayload: data.safeAssignmentPayload,
      updatedAt: now(),
    };
    assignmentPointerStore.set(key, updated);
    return updated;
  }
  const record: AgentPmoControlledProjectAssignmentPointerRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  assignmentPointerStore.set(key, record);
  return record;
}

export async function getAgentPmoControlledProjectAssignmentPointerByProject(
  workspaceId: string,
  projectId: string,
): Promise<AgentPmoControlledProjectAssignmentPointerRecord | null> {
  return assignmentPointerStore.get(`${workspaceId}::${projectId}`) ?? null;
}

export async function listAgentPmoControlledProjectAssignmentPointers(
  workspaceId: string,
): Promise<AgentPmoControlledProjectAssignmentPointerRecord[]> {
  return [...assignmentPointerStore.values()].filter((r) => r.workspaceId === workspaceId);
}

// ─── Assignment History (append-only) ────────────────────────────────────────

export async function recordAgentPmoProjectAssignmentHistory(
  data: Omit<AgentPmoProjectAssignmentHistoryRecord, "id" | "createdAt">,
): Promise<AgentPmoProjectAssignmentHistoryRecord> {
  const record: AgentPmoProjectAssignmentHistoryRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
  };
  assignmentHistoryStore.push(record);
  return record;
}

export async function listAgentPmoProjectAssignmentHistory(
  workspaceId: string,
  projectId?: string,
): Promise<AgentPmoProjectAssignmentHistoryRecord[]> {
  return assignmentHistoryStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (projectId === undefined || r.projectId === projectId),
  );
}

// ─── Continuity Checks ────────────────────────────────────────────────────────

export async function createAgentPmoHandoffContinuityCheck(
  data: Omit<AgentPmoHandoffContinuityCheckRecord, "id" | "createdAt" | "updatedAt">,
): Promise<AgentPmoHandoffContinuityCheckRecord> {
  const record: AgentPmoHandoffContinuityCheckRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
  };
  continuityCheckStore.push(record);
  return record;
}

export async function listAgentPmoHandoffContinuityChecks(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoHandoffContinuityCheckRecord[]> {
  return continuityCheckStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

export async function updateAgentPmoHandoffContinuityCheckStatus(
  id: string,
  checkStatus: AgentPmoHandoffContinuityCheckStatus,
  rationale?: string,
): Promise<AgentPmoHandoffContinuityCheckRecord | null> {
  const idx = continuityCheckStore.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const terminal = ["passed", "failed", "blocked", "waived", "not_applicable"];
  const updated: AgentPmoHandoffContinuityCheckRecord = {
    ...continuityCheckStore[idx],
    checkStatus,
    rationale: rationale ?? continuityCheckStore[idx].rationale,
    completedAt: terminal.includes(checkStatus) ? now() : null,
    updatedAt: now(),
  };
  continuityCheckStore[idx] = updated;
  return updated;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export async function createAgentPmoProjectHandoffExport(
  data: Omit<AgentPmoProjectHandoffExportRecord, "id" | "createdAt">,
): Promise<AgentPmoProjectHandoffExportRecord> {
  const record: AgentPmoProjectHandoffExportRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
  };
  handoffExportStore.set(record.id, record);
  return record;
}

export async function getAgentPmoProjectHandoffExportById(
  id: string,
): Promise<AgentPmoProjectHandoffExportRecord | null> {
  return handoffExportStore.get(id) ?? null;
}

export async function listAgentPmoProjectHandoffExports(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoProjectHandoffExportRecord[]> {
  return [...handoffExportStore.values()].filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

// ─── Audit Events (append-only) ───────────────────────────────────────────────

export async function recordAgentPmoProjectHandoffAuditEvent(
  data: Omit<AgentPmoProjectHandoffAuditEventRecord, "id" | "createdAt">,
): Promise<AgentPmoProjectHandoffAuditEventRecord> {
  const record: AgentPmoProjectHandoffAuditEventRecord = {
    ...data,
    id: randomUUID(),
    createdAt: now(),
  };
  auditEventStore.push(record);
  return record;
}

export async function listAgentPmoProjectHandoffAuditEvents(
  workspaceId: string,
  handoffRequestId?: string,
): Promise<AgentPmoProjectHandoffAuditEventRecord[]> {
  return auditEventStore.filter(
    (r) =>
      r.workspaceId === workspaceId &&
      (handoffRequestId === undefined || r.handoffRequestId === handoffRequestId),
  );
}

// ─── Test Utilities ───────────────────────────────────────────────────────────

export function _clearProjectHandoffStores(): void {
  handoffRequestStore.clear();
  contextValidationStore.length = 0;
  handoffGateStore.clear();
  handoffGateDecisionStore.length = 0;
  handoffPackStore.clear();
  memorySnapshotStore.length = 0;
  statusSnapshotStore.length = 0;
  snapshotItemStore.length = 0;
  stakeholderContextStore.length = 0;
  outgoingPmNoteStore.length = 0;
  incomingPmAcceptanceStore.length = 0;
  assignmentPointerStore.clear();
  assignmentHistoryStore.length = 0;
  continuityCheckStore.length = 0;
  handoffExportStore.clear();
  auditEventStore.length = 0;
}
