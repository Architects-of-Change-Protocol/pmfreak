// ─── Controlled Execution Finalization & Adapter Dispatch Gate — Registry ──────
// Pure in-memory store. Does not use Supabase.
// Events and dispatch attempts are append-only. Records are not hard-deleted.
// Locks are released, not deleted. Idempotency records are reused, not duplicated.

import { randomUUID } from "node:crypto";
import {
  dedupeDispatchStrings,
  redactExecutionDispatchPayload,
} from "./agent-execution-dispatch-validation";
import type {
  AgentExecutionFinalizationRecord,
  AgentExecutionFinalizationStatus,
  AgentExecutionDispatchReadiness,
  AgentExecutionDispatchGateRecord,
  AgentExecutionDispatchGateStatus,
  AgentExecutionDispatchLockRecord,
  AgentExecutionLockStatus,
  AgentExecutionDispatchIdempotencyRecord,
  AgentExecutionIdempotencyStatus,
  AgentExecutionDispatchAttemptRecord,
  AgentExecutionDispatchAttemptStatus,
  AgentExecutionFinalConfirmationRecord,
  AgentExecutionFinalConfirmationRequirement,
  AgentExecutionFinalConfirmationStatus,
  AgentExecutionDispatchEventRecord,
  AgentExecutionDispatchEventType,
  AgentExecutionSideEffectMode,
  AgentExecutionFinalizationListFilters,
  CreateAgentExecutionFinalizationInput,
} from "./agent-execution-dispatch-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const finalizationStore = new Map<string, AgentExecutionFinalizationRecord>();
const dispatchGateStore = new Map<string, AgentExecutionDispatchGateRecord>();
const lockStore = new Map<string, AgentExecutionDispatchLockRecord>();
const idempotencyStore = new Map<string, AgentExecutionDispatchIdempotencyRecord>();
const attemptStore = new Map<string, AgentExecutionDispatchAttemptRecord[]>();
const confirmationStore = new Map<string, AgentExecutionFinalConfirmationRecord>();
const eventStore = new Map<string, AgentExecutionDispatchEventRecord[]>();

export function _clearDispatchStores(): void {
  finalizationStore.clear();
  dispatchGateStore.clear();
  lockStore.clear();
  idempotencyStore.clear();
  attemptStore.clear();
  confirmationStore.clear();
  eventStore.clear();
}

// ─── Finalization CRUD ────────────────────────────────────────────────────────

export async function createAgentExecutionFinalization(
  input: CreateAgentExecutionFinalizationInput,
): Promise<AgentExecutionFinalizationRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionFinalizationRecord = {
    id,
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    actionConversionId: input.actionConversionId ?? null,
    actionDraftId: null,
    reviewItemId: null,
    sourceResultId: null,
    sourceEvidenceId: null,
    status: "created",
    readiness: "not_ready",
    executionMode: "dry_run",
    riskLevel: "medium",
    selectedToolKey: null,
    selectedAdapterKey: null,
    sideEffectMode: "none",
    confirmationRequirement: "not_required",
    confirmationStatus: "not_required",
    approvalVerified: false,
    lockStatus: "available",
    idempotencyStatus: "new",
    dispatchGateId: null,
    latestDispatchAttemptId: null,
    adapterExecutionId: null,
    resultId: null,
    evidenceIds: [],
    blockingReasons: [],
    warnings: [],
    finalizationPayload: null,
    safeFinalizationPayload: null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  finalizationStore.set(id, record);
  return record;
}

export async function getAgentExecutionFinalizationById(
  workspaceId: string,
  finalizationId: string,
): Promise<AgentExecutionFinalizationRecord | null> {
  const r = finalizationStore.get(finalizationId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function getAgentExecutionFinalizationByExecutionRequestId(
  workspaceId: string,
  executionRequestId: string,
): Promise<AgentExecutionFinalizationRecord | null> {
  for (const r of finalizationStore.values()) {
    if (r.workspaceId === workspaceId && r.executionRequestId === executionRequestId) return r;
  }
  return null;
}

export async function listAgentExecutionFinalizations(
  workspaceId: string,
  filters?: AgentExecutionFinalizationListFilters,
): Promise<AgentExecutionFinalizationRecord[]> {
  let results = [...finalizationStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters?.status) results = results.filter((r) => r.status === filters.status);
  if (filters?.readiness) results = results.filter((r) => r.readiness === filters.readiness);
  if (filters?.executionRequestId) results = results.filter((r) => r.executionRequestId === filters.executionRequestId);
  if (filters?.actionConversionId) results = results.filter((r) => r.actionConversionId === filters.actionConversionId);
  if (filters?.selectedAdapterKey) results = results.filter((r) => r.selectedAdapterKey === filters.selectedAdapterKey);
  if (filters?.selectedToolKey) results = results.filter((r) => r.selectedToolKey === filters.selectedToolKey);
  if (filters?.confirmationStatus) results = results.filter((r) => r.confirmationStatus === filters.confirmationStatus);
  if (filters?.lockStatus) results = results.filter((r) => r.lockStatus === filters.lockStatus);
  if (filters?.idempotencyStatus) results = results.filter((r) => r.idempotencyStatus === filters.idempotencyStatus);
  if (filters?.riskLevel) results = results.filter((r) => r.riskLevel === filters.riskLevel);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters?.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentExecutionFinalizationStatus(input: {
  workspaceId: string;
  finalizationId: string;
  status: AgentExecutionFinalizationStatus;
  readiness?: AgentExecutionDispatchReadiness;
  blockingReasons?: string[];
  warnings?: string[];
  actorId?: string | null;
  message?: string | null;
  patch?: Partial<AgentExecutionFinalizationRecord>;
}): Promise<AgentExecutionFinalizationRecord> {
  const r = finalizationStore.get(input.finalizationId);
  if (!r || r.workspaceId !== input.workspaceId) throw new Error(`Finalization not found: ${input.finalizationId}`);
  const updated: AgentExecutionFinalizationRecord = {
    ...r,
    ...input.patch,
    status: input.status,
    readiness: input.readiness ?? r.readiness,
    blockingReasons: input.blockingReasons !== undefined ? dedupeDispatchStrings(input.blockingReasons) : r.blockingReasons,
    warnings: input.warnings !== undefined ? dedupeDispatchStrings(input.warnings) : r.warnings,
    updatedAt: new Date().toISOString(),
  };
  finalizationStore.set(input.finalizationId, updated);
  return updated;
}

// ─── Dispatch Gate ────────────────────────────────────────────────────────────

export async function createAgentExecutionDispatchGate(input: {
  workspaceId: string;
  finalizationId: string;
  executionRequestId: string;
  selectedToolKey?: string | null;
  selectedAdapterKey?: string | null;
  executionMode: string;
  sideEffectMode: AgentExecutionSideEffectMode;
  dispatchAllowed: boolean;
  requiresFinalConfirmation: boolean;
  confirmationStatus: AgentExecutionFinalConfirmationStatus;
  blockingReasons?: string[];
  warnings?: string[];
  createdBy?: string | null;
}): Promise<AgentExecutionDispatchGateRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionDispatchGateRecord = {
    id,
    workspaceId: input.workspaceId,
    finalizationId: input.finalizationId,
    executionRequestId: input.executionRequestId,
    status: "created",
    selectedToolKey: input.selectedToolKey ?? null,
    selectedAdapterKey: input.selectedAdapterKey ?? null,
    executionMode: input.executionMode,
    sideEffectMode: input.sideEffectMode,
    dispatchAllowed: input.dispatchAllowed,
    requiresFinalConfirmation: input.requiresFinalConfirmation,
    confirmationStatus: input.confirmationStatus,
    lockId: null,
    idempotencyId: null,
    blockingReasons: dedupeDispatchStrings(input.blockingReasons ?? []),
    warnings: dedupeDispatchStrings(input.warnings ?? []),
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  dispatchGateStore.set(id, record);
  return record;
}

export async function getAgentExecutionDispatchGateById(
  workspaceId: string,
  dispatchGateId: string,
): Promise<AgentExecutionDispatchGateRecord | null> {
  const r = dispatchGateStore.get(dispatchGateId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function getAgentExecutionDispatchGateByFinalizationId(
  workspaceId: string,
  finalizationId: string,
): Promise<AgentExecutionDispatchGateRecord | null> {
  for (const r of dispatchGateStore.values()) {
    if (r.workspaceId === workspaceId && r.finalizationId === finalizationId) return r;
  }
  return null;
}

export async function updateAgentExecutionDispatchGateStatus(input: {
  workspaceId: string;
  dispatchGateId: string;
  status: AgentExecutionDispatchGateStatus;
  dispatchAllowed?: boolean;
  blockingReasons?: string[];
  warnings?: string[];
  actorId?: string | null;
  message?: string | null;
  patch?: Partial<AgentExecutionDispatchGateRecord>;
}): Promise<AgentExecutionDispatchGateRecord> {
  const r = dispatchGateStore.get(input.dispatchGateId);
  if (!r || r.workspaceId !== input.workspaceId) throw new Error(`Dispatch gate not found: ${input.dispatchGateId}`);
  const updated: AgentExecutionDispatchGateRecord = {
    ...r,
    ...input.patch,
    status: input.status,
    dispatchAllowed: input.dispatchAllowed !== undefined ? input.dispatchAllowed : r.dispatchAllowed,
    blockingReasons: input.blockingReasons !== undefined ? dedupeDispatchStrings(input.blockingReasons) : r.blockingReasons,
    warnings: input.warnings !== undefined ? dedupeDispatchStrings(input.warnings) : r.warnings,
    updatedAt: new Date().toISOString(),
  };
  dispatchGateStore.set(input.dispatchGateId, updated);
  return updated;
}

// ─── Execution Lock ───────────────────────────────────────────────────────────

export async function acquireAgentExecutionDispatchLock(input: {
  workspaceId: string;
  executionRequestId: string;
  finalizationId?: string | null;
  lockKey: string;
  acquiredBy?: string | null;
  expiresAt?: string | null;
}): Promise<AgentExecutionDispatchLockRecord> {
  const existing = lockStore.get(`${input.workspaceId}:${input.lockKey}`);
  if (existing && existing.status === "acquired") {
    throw new Error(`Lock already acquired for key: ${input.lockKey}`);
  }
  const now = new Date().toISOString();
  const id = existing?.id ?? randomUUID();
  const record: AgentExecutionDispatchLockRecord = {
    id,
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    finalizationId: input.finalizationId ?? null,
    lockKey: input.lockKey,
    status: "acquired",
    acquiredBy: input.acquiredBy ?? null,
    acquiredAt: now,
    expiresAt: input.expiresAt ?? null,
    releasedAt: null,
    releaseReason: null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  lockStore.set(`${input.workspaceId}:${input.lockKey}`, record);
  return record;
}

export async function releaseAgentExecutionDispatchLock(input: {
  workspaceId: string;
  lockId: string;
  releasedBy?: string | null;
  releaseReason?: string | null;
}): Promise<AgentExecutionDispatchLockRecord> {
  for (const [key, r] of lockStore.entries()) {
    if (r.id === input.lockId && r.workspaceId === input.workspaceId) {
      const now = new Date().toISOString();
      const updated: AgentExecutionDispatchLockRecord = {
        ...r,
        status: "released",
        releasedAt: now,
        releaseReason: input.releaseReason ?? null,
        updatedAt: now,
      };
      lockStore.set(key, updated);
      return updated;
    }
  }
  throw new Error(`Lock not found: ${input.lockId}`);
}

export async function getAgentExecutionDispatchLockByKey(
  workspaceId: string,
  lockKey: string,
): Promise<AgentExecutionDispatchLockRecord | null> {
  return lockStore.get(`${workspaceId}:${lockKey}`) ?? null;
}

// ─── Idempotency ──────────────────────────────────────────────────────────────

export async function createOrGetAgentExecutionDispatchIdempotency(input: {
  workspaceId: string;
  executionRequestId: string;
  finalizationId?: string | null;
  idempotencyKey: string;
  idempotencyFingerprint: string;
}): Promise<AgentExecutionDispatchIdempotencyRecord> {
  const storeKey = `${input.workspaceId}:${input.idempotencyKey}`;
  const existing = idempotencyStore.get(storeKey);
  if (existing) return existing;
  const now = new Date().toISOString();
  const record: AgentExecutionDispatchIdempotencyRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    finalizationId: input.finalizationId ?? null,
    idempotencyKey: input.idempotencyKey,
    idempotencyFingerprint: input.idempotencyFingerprint,
    status: "new",
    firstDispatchAttemptId: null,
    latestDispatchAttemptId: null,
    resultId: null,
    createdAt: now,
    updatedAt: now,
  };
  idempotencyStore.set(storeKey, record);
  return record;
}

export async function updateAgentExecutionDispatchIdempotencyStatus(input: {
  workspaceId: string;
  idempotencyId: string;
  status: AgentExecutionIdempotencyStatus;
  latestDispatchAttemptId?: string | null;
  resultId?: string | null;
}): Promise<AgentExecutionDispatchIdempotencyRecord> {
  for (const [key, r] of idempotencyStore.entries()) {
    if (r.id === input.idempotencyId && r.workspaceId === input.workspaceId) {
      const updated: AgentExecutionDispatchIdempotencyRecord = {
        ...r,
        status: input.status,
        latestDispatchAttemptId: input.latestDispatchAttemptId !== undefined ? input.latestDispatchAttemptId : r.latestDispatchAttemptId,
        firstDispatchAttemptId: r.firstDispatchAttemptId ?? (input.latestDispatchAttemptId ?? r.firstDispatchAttemptId),
        resultId: input.resultId !== undefined ? input.resultId : r.resultId,
        updatedAt: new Date().toISOString(),
      };
      idempotencyStore.set(key, updated);
      return updated;
    }
  }
  throw new Error(`Idempotency record not found: ${input.idempotencyId}`);
}

// ─── Dispatch Attempts ────────────────────────────────────────────────────────

export async function createAgentExecutionDispatchAttempt(input: {
  workspaceId: string;
  finalizationId: string;
  dispatchGateId?: string | null;
  executionRequestId: string;
  adapterKey?: string | null;
  toolKey?: string | null;
  executionMode: string;
  attemptNumber?: number;
  actorId?: string | null;
}): Promise<AgentExecutionDispatchAttemptRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const existingAttempts = attemptStore.get(input.finalizationId) ?? [];
  const record: AgentExecutionDispatchAttemptRecord = {
    id,
    workspaceId: input.workspaceId,
    finalizationId: input.finalizationId,
    dispatchGateId: input.dispatchGateId ?? null,
    executionRequestId: input.executionRequestId,
    adapterKey: input.adapterKey ?? null,
    toolKey: input.toolKey ?? null,
    executionMode: input.executionMode,
    status: "created",
    attemptNumber: input.attemptNumber ?? existingAttempts.length + 1,
    startedAt: null,
    completedAt: null,
    adapterExecutionId: null,
    resultId: null,
    evidenceIds: [],
    errorMessage: null,
    blockingReasons: [],
    warnings: [],
    actorId: input.actorId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  attemptStore.set(input.finalizationId, [...existingAttempts, record]);
  return record;
}

export async function updateAgentExecutionDispatchAttemptStatus(input: {
  workspaceId: string;
  dispatchAttemptId: string;
  status: AgentExecutionDispatchAttemptStatus;
  adapterExecutionId?: string | null;
  resultId?: string | null;
  evidenceIds?: string[];
  errorMessage?: string | null;
  blockingReasons?: string[];
  warnings?: string[];
}): Promise<AgentExecutionDispatchAttemptRecord> {
  for (const [finId, attempts] of attemptStore.entries()) {
    const idx = attempts.findIndex((a) => a.id === input.dispatchAttemptId && a.workspaceId === input.workspaceId);
    if (idx !== -1) {
      const a = attempts[idx];
      const now = new Date().toISOString();
      const isTerminal = ["adapter_succeeded","adapter_failed","result_reconciled","blocked","cancelled"].includes(input.status);
      const updated: AgentExecutionDispatchAttemptRecord = {
        ...a,
        status: input.status,
        startedAt: a.startedAt ?? (input.status === "started" ? now : null),
        completedAt: isTerminal ? now : a.completedAt,
        adapterExecutionId: input.adapterExecutionId !== undefined ? input.adapterExecutionId : a.adapterExecutionId,
        resultId: input.resultId !== undefined ? input.resultId : a.resultId,
        evidenceIds: input.evidenceIds !== undefined ? input.evidenceIds : a.evidenceIds,
        errorMessage: input.errorMessage !== undefined ? input.errorMessage : a.errorMessage,
        blockingReasons: input.blockingReasons !== undefined ? dedupeDispatchStrings(input.blockingReasons) : a.blockingReasons,
        warnings: input.warnings !== undefined ? dedupeDispatchStrings(input.warnings) : a.warnings,
        updatedAt: now,
      };
      const newAttempts = [...attempts];
      newAttempts[idx] = updated;
      attemptStore.set(finId, newAttempts);
      return updated;
    }
  }
  throw new Error(`Dispatch attempt not found: ${input.dispatchAttemptId}`);
}

// ─── Final Confirmation ───────────────────────────────────────────────────────

export async function createAgentExecutionFinalConfirmation(input: {
  workspaceId: string;
  finalizationId: string;
  executionRequestId: string;
  requirement: AgentExecutionFinalConfirmationRequirement;
  status: AgentExecutionFinalConfirmationStatus;
  rationale?: string | null;
}): Promise<AgentExecutionFinalConfirmationRecord> {
  const now = new Date().toISOString();
  const record: AgentExecutionFinalConfirmationRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    finalizationId: input.finalizationId,
    executionRequestId: input.executionRequestId,
    requirement: input.requirement,
    status: input.status,
    confirmedBy: null,
    confirmedAt: null,
    rationale: input.rationale ?? null,
    createdAt: now,
    updatedAt: now,
  };
  confirmationStore.set(input.finalizationId, record);
  return record;
}

export async function confirmAgentExecutionFinalConfirmation(input: {
  workspaceId: string;
  confirmationId: string;
  confirmedBy?: string | null;
  rationale: string;
}): Promise<AgentExecutionFinalConfirmationRecord> {
  for (const [key, r] of confirmationStore.entries()) {
    if (r.id === input.confirmationId && r.workspaceId === input.workspaceId) {
      const now = new Date().toISOString();
      const updated: AgentExecutionFinalConfirmationRecord = {
        ...r,
        status: "confirmed",
        confirmedBy: input.confirmedBy ?? null,
        confirmedAt: now,
        rationale: input.rationale,
        updatedAt: now,
      };
      confirmationStore.set(key, updated);
      return updated;
    }
  }
  throw new Error(`Final confirmation not found: ${input.confirmationId}`);
}

export async function getAgentExecutionFinalConfirmationByFinalizationId(
  workspaceId: string,
  finalizationId: string,
): Promise<AgentExecutionFinalConfirmationRecord | null> {
  const r = confirmationStore.get(finalizationId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

// ─── Dispatch Events ──────────────────────────────────────────────────────────

export async function recordAgentExecutionDispatchEvent(input: {
  workspaceId: string;
  finalizationId?: string | null;
  dispatchGateId?: string | null;
  dispatchAttemptId?: string | null;
  executionRequestId?: string | null;
  adapterExecutionId?: string | null;
  resultId?: string | null;
  eventType: AgentExecutionDispatchEventType;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
  actorId?: string | null;
}): Promise<AgentExecutionDispatchEventRecord> {
  const record: AgentExecutionDispatchEventRecord = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    finalizationId: input.finalizationId ?? null,
    dispatchGateId: input.dispatchGateId ?? null,
    dispatchAttemptId: input.dispatchAttemptId ?? null,
    executionRequestId: input.executionRequestId ?? null,
    adapterExecutionId: input.adapterExecutionId ?? null,
    resultId: input.resultId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    eventPayload: input.eventPayload ? redactExecutionDispatchPayload(input.eventPayload) : null,
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  const key = input.finalizationId ?? `workspace:${input.workspaceId}`;
  const existing = eventStore.get(key) ?? [];
  eventStore.set(key, [...existing, record]);
  return record;
}

export async function listAgentExecutionDispatchEvents(input: {
  workspaceId: string;
  finalizationId?: string;
  dispatchGateId?: string;
  dispatchAttemptId?: string;
  executionRequestId?: string;
  eventType?: AgentExecutionDispatchEventType;
  limit?: number;
}): Promise<AgentExecutionDispatchEventRecord[]> {
  let all: AgentExecutionDispatchEventRecord[] = [];
  for (const events of eventStore.values()) {
    all.push(...events.filter((e) => e.workspaceId === input.workspaceId));
  }
  if (input.finalizationId) all = all.filter((e) => e.finalizationId === input.finalizationId);
  if (input.dispatchGateId) all = all.filter((e) => e.dispatchGateId === input.dispatchGateId);
  if (input.dispatchAttemptId) all = all.filter((e) => e.dispatchAttemptId === input.dispatchAttemptId);
  if (input.executionRequestId) all = all.filter((e) => e.executionRequestId === input.executionRequestId);
  if (input.eventType) all = all.filter((e) => e.eventType === input.eventType);
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (input.limit) all = all.slice(0, input.limit);
  return all;
}
