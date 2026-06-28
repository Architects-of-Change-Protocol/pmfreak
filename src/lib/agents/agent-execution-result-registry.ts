// ─── Agent Execution Results & Evidence Layer — Registry ──────────────────────
// NOTE: Pure in-memory store. Does not use Supabase.

import { randomUUID } from "node:crypto";
import {
  normalizeCreateAgentExecutionResultInput,
  normalizeCreateAgentExecutionEvidenceInput,
  redactResultPayload,
  redactEvidencePayload,
  calculateDeterministicEvidenceHash,
} from "./agent-execution-result-validation";
import type {
  AgentExecutionResultRecord,
  AgentExecutionEvidenceRecord,
  AgentExecutionResultLineageRecord,
  AgentExecutionResultEventRecord,
  AgentExecutionResultStatus,
  AgentExecutionResultReviewState,
  AgentExecutionEvidenceType,
  AgentExecutionEvidenceSource,
  AgentExecutionResultEventType,
  CreateAgentExecutionResultInput,
  CreateAgentExecutionEvidenceInput,
  AgentExecutionResultListFilters,
} from "./agent-execution-result-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const resultStore = new Map<string, AgentExecutionResultRecord>();
const evidenceStore = new Map<string, AgentExecutionEvidenceRecord>();
const lineageStore = new Map<string, AgentExecutionResultLineageRecord[]>();
const resultEventStore = new Map<string, AgentExecutionResultEventRecord[]>();

// ─── Result CRUD ──────────────────────────────────────────────────────────────

export async function createAgentExecutionResult(input: CreateAgentExecutionResultInput): Promise<AgentExecutionResultRecord> {
  const normalized = normalizeCreateAgentExecutionResultInput(input);
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionResultRecord = {
    id,
    workspaceId: normalized.workspaceId,
    executionRequestId: normalized.executionRequestId,
    adapterExecutionId: normalized.adapterExecutionId ?? null,
    agentId: normalized.agentId ?? null,
    agentType: normalized.agentType ?? null,
    toolKey: normalized.toolKey,
    adapterKey: normalized.adapterKey ?? null,
    executionMode: normalized.executionMode,
    scopeType: normalized.scopeType,
    scopeId: normalized.scopeId ?? null,
    resultType: normalized.resultType,
    resultStatus: "created",
    reviewState: "not_ready",
    title: normalized.title,
    summary: normalized.summary ?? null,
    resultPayload: normalized.resultPayload ?? null,
    safeResultPayload: redactResultPayload(normalized.resultPayload ?? null),
    artifactType: normalized.artifactType ?? "inline_json",
    artifactMetadata: normalized.artifactMetadata ?? null,
    confidenceScore: 0,
    confidenceLevel: "low",
    confidenceReasons: [],
    evidenceIds: normalized.evidenceIds ?? [],
    lineageRefs: normalized.lineageRefs ?? [],
    retentionPolicy: normalized.retentionPolicy ?? "standard",
    expiresAt: null,
    createdBy: normalized.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  resultStore.set(id, record);
  return record;
}

export async function getAgentExecutionResultById(workspaceId: string, resultId: string): Promise<AgentExecutionResultRecord | null> {
  const record = resultStore.get(resultId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listAgentExecutionResults(workspaceId: string, filters?: AgentExecutionResultListFilters): Promise<AgentExecutionResultRecord[]> {
  let results = Array.from(resultStore.values()).filter(r => r.workspaceId === workspaceId);
  if (filters?.resultStatus) results = results.filter(r => r.resultStatus === filters.resultStatus);
  if (filters?.reviewState) results = results.filter(r => r.reviewState === filters.reviewState);
  if (filters?.resultType) results = results.filter(r => r.resultType === filters.resultType);
  if (filters?.toolKey) results = results.filter(r => r.toolKey === filters.toolKey);
  if (filters?.adapterKey) results = results.filter(r => r.adapterKey === filters.adapterKey);
  if (filters?.executionRequestId) results = results.filter(r => r.executionRequestId === filters.executionRequestId);
  if (filters?.adapterExecutionId) results = results.filter(r => r.adapterExecutionId === filters.adapterExecutionId);
  if (filters?.scopeType) results = results.filter(r => r.scopeType === filters.scopeType);
  if (filters?.scopeId) results = results.filter(r => r.scopeId === filters.scopeId);
  if (filters?.confidenceLevel) results = results.filter(r => r.confidenceLevel === filters.confidenceLevel);
  if (filters?.retentionPolicy) results = results.filter(r => r.retentionPolicy === filters.retentionPolicy);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters?.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentExecutionResultStatus(input: {
  workspaceId: string;
  resultId: string;
  resultStatus: AgentExecutionResultStatus;
  reviewState?: AgentExecutionResultReviewState;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentExecutionResultRecord> {
  const existing = resultStore.get(input.resultId);
  if (!existing || existing.workspaceId !== input.workspaceId) {
    throw new Error(`AgentExecutionResult not found: ${input.resultId}`);
  }
  const now = new Date().toISOString();
  const updated: AgentExecutionResultRecord = {
    ...existing,
    resultStatus: input.resultStatus,
    reviewState: input.reviewState ?? existing.reviewState,
    updatedAt: now,
  };
  resultStore.set(input.resultId, updated);
  await recordAgentExecutionResultEvent({
    workspaceId: input.workspaceId,
    resultId: input.resultId,
    eventType: ("result_" + input.resultStatus) as AgentExecutionResultEventType,
    message: input.message ?? null,
    actorId: input.actorId ?? null,
  });
  return updated;
}

// ─── Evidence CRUD ────────────────────────────────────────────────────────────

export async function createAgentExecutionEvidence(input: CreateAgentExecutionEvidenceInput): Promise<AgentExecutionEvidenceRecord> {
  const normalized = normalizeCreateAgentExecutionEvidenceInput(input);
  const now = new Date().toISOString();
  const id = randomUUID();
  const hash = calculateDeterministicEvidenceHash(normalized.evidencePayload ?? null);
  const record: AgentExecutionEvidenceRecord = {
    id,
    workspaceId: normalized.workspaceId,
    resultId: normalized.resultId ?? null,
    executionRequestId: normalized.executionRequestId ?? null,
    adapterExecutionId: normalized.adapterExecutionId ?? null,
    evidenceType: normalized.evidenceType,
    evidenceSource: normalized.evidenceSource,
    scopeType: normalized.scopeType ?? null,
    scopeId: normalized.scopeId ?? null,
    title: normalized.title,
    summary: normalized.summary ?? null,
    evidencePayload: normalized.evidencePayload ?? null,
    safeEvidencePayload: redactEvidencePayload(normalized.evidencePayload ?? null),
    evidenceRef: normalized.evidenceRef ?? null,
    evidenceHash: hash,
    confidenceWeight: normalized.confidenceWeight ?? 0,
    retentionPolicy: normalized.retentionPolicy ?? "standard",
    createdBy: normalized.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  evidenceStore.set(id, record);
  return record;
}

export async function getAgentExecutionEvidenceById(workspaceId: string, evidenceId: string): Promise<AgentExecutionEvidenceRecord | null> {
  const record = evidenceStore.get(evidenceId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listAgentExecutionEvidence(input: {
  workspaceId: string;
  resultId?: string;
  executionRequestId?: string;
  adapterExecutionId?: string;
  evidenceType?: AgentExecutionEvidenceType;
  evidenceSource?: AgentExecutionEvidenceSource;
  scopeType?: string;
  scopeId?: string;
  limit?: number;
}): Promise<AgentExecutionEvidenceRecord[]> {
  let records = Array.from(evidenceStore.values()).filter(e => e.workspaceId === input.workspaceId);
  if (input.resultId) records = records.filter(e => e.resultId === input.resultId);
  if (input.executionRequestId) records = records.filter(e => e.executionRequestId === input.executionRequestId);
  if (input.adapterExecutionId) records = records.filter(e => e.adapterExecutionId === input.adapterExecutionId);
  if (input.evidenceType) records = records.filter(e => e.evidenceType === input.evidenceType);
  if (input.evidenceSource) records = records.filter(e => e.evidenceSource === input.evidenceSource);
  if (input.scopeType) records = records.filter(e => e.scopeType === input.scopeType);
  if (input.scopeId) records = records.filter(e => e.scopeId === input.scopeId);
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (input.limit) records = records.slice(0, input.limit);
  return records;
}

export async function linkEvidenceToResult(input: {
  workspaceId: string;
  resultId: string;
  evidenceId: string;
  actorId?: string | null;
}): Promise<AgentExecutionResultRecord> {
  const result = resultStore.get(input.resultId);
  if (!result || result.workspaceId !== input.workspaceId) {
    throw new Error(`AgentExecutionResult not found: ${input.resultId}`);
  }
  const evidence = evidenceStore.get(input.evidenceId);
  if (!evidence || evidence.workspaceId !== input.workspaceId) {
    throw new Error(`AgentExecutionEvidence not found: ${input.evidenceId}`);
  }
  const now = new Date().toISOString();
  const evidenceIds = [...new Set([...result.evidenceIds, input.evidenceId])];
  const updated: AgentExecutionResultRecord = { ...result, evidenceIds, updatedAt: now };
  resultStore.set(input.resultId, updated);

  // update evidence to point at result
  if (!evidence.resultId) {
    const updatedEvidence: AgentExecutionEvidenceRecord = { ...evidence, resultId: input.resultId, updatedAt: now };
    evidenceStore.set(input.evidenceId, updatedEvidence);
  }

  await recordAgentExecutionResultEvent({
    workspaceId: input.workspaceId,
    resultId: input.resultId,
    evidenceId: input.evidenceId,
    eventType: "evidence_linked",
    actorId: input.actorId ?? null,
  });
  return updated;
}

// ─── Lineage ──────────────────────────────────────────────────────────────────

export async function recordAgentExecutionResultLineage(input: {
  workspaceId: string;
  resultId: string;
  lineageType: AgentExecutionResultLineageRecord["lineageType"];
  lineageRef: string;
  lineagePayload?: Record<string, unknown> | null;
}): Promise<AgentExecutionResultLineageRecord> {
  const id = randomUUID();
  const record: AgentExecutionResultLineageRecord = {
    id,
    workspaceId: input.workspaceId,
    resultId: input.resultId,
    lineageType: input.lineageType,
    lineageRef: input.lineageRef,
    lineagePayload: input.lineagePayload ?? null,
    createdAt: new Date().toISOString(),
  };
  const existing = lineageStore.get(input.resultId) ?? [];
  lineageStore.set(input.resultId, [...existing, record]);
  return record;
}

export async function listAgentExecutionResultLineage(input: {
  workspaceId: string;
  resultId: string;
  lineageType?: AgentExecutionResultLineageRecord["lineageType"];
}): Promise<AgentExecutionResultLineageRecord[]> {
  let records = (lineageStore.get(input.resultId) ?? []).filter(l => l.workspaceId === input.workspaceId);
  if (input.lineageType) records = records.filter(l => l.lineageType === input.lineageType);
  return records;
}

// ─── Result Events ────────────────────────────────────────────────────────────

export async function recordAgentExecutionResultEvent(input: {
  workspaceId: string;
  resultId?: string | null;
  evidenceId?: string | null;
  eventType: AgentExecutionResultEventType;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
  actorId?: string | null;
}): Promise<AgentExecutionResultEventRecord> {
  const id = randomUUID();
  const record: AgentExecutionResultEventRecord = {
    id,
    workspaceId: input.workspaceId,
    resultId: input.resultId ?? null,
    evidenceId: input.evidenceId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    eventPayload: input.eventPayload ?? null,
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  const key = input.resultId ?? "__global__";
  const existing = resultEventStore.get(key) ?? [];
  resultEventStore.set(key, [...existing, record]);
  return record;
}

export async function listAgentExecutionResultEvents(input: {
  workspaceId: string;
  resultId?: string;
  evidenceId?: string;
  eventType?: AgentExecutionResultEventType;
  limit?: number;
}): Promise<AgentExecutionResultEventRecord[]> {
  const key = input.resultId ?? "__global__";
  let records = (resultEventStore.get(key) ?? []).filter(e => e.workspaceId === input.workspaceId);
  if (input.evidenceId) records = records.filter(e => e.evidenceId === input.evidenceId);
  if (input.eventType) records = records.filter(e => e.eventType === input.eventType);
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (input.limit) records = records.slice(0, input.limit);
  return records;
}

// Direct store update (avoids dynamic re-import in service)
export function _setResultRecord(id: string, record: AgentExecutionResultRecord): void {
  resultStore.set(id, record);
}

// Export store accessors for testing
export function _getResultStore() { return resultStore; }
export function _getEvidenceStore() { return evidenceStore; }
export function _clearResultStores() {
  resultStore.clear();
  evidenceStore.clear();
  lineageStore.clear();
  resultEventStore.clear();
}
