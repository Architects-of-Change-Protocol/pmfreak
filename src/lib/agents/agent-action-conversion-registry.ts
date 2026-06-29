// ─── Agent Controlled Action Conversion & Approval Bridge — Registry ───────────
// NOTE: Pure in-memory store. Does not use Supabase.
// Events and preflights are append-only. Records are not hard-deleted.

import { randomUUID } from "node:crypto";
import {
  normalizeCreateAgentActionConversionInput,
  normalizeCreateAgentActionApprovalBridgeInput,
  redactActionConversionPayload,
} from "./agent-action-conversion-validation";
import type {
  AgentActionConversionRecord,
  AgentActionConversionPreflightRecord,
  AgentActionApprovalBridgeRecord,
  AgentActionConversionEventRecord,
  AgentActionConversionStatus,
  AgentActionConversionReadiness,
  AgentActionConversionPreflightStatus,
  AgentActionApprovalBridgeStatus,
  AgentActionConversionEventType,
  AgentActionConversionPreflightCheckResult,
  AgentActionApprovalRequirement,
  AgentActionConversionListFilters,
  CreateAgentActionConversionInput,
  CreateAgentActionApprovalBridgeInput,
} from "./agent-action-conversion-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const conversionStore = new Map<string, AgentActionConversionRecord>();
const preflightStore = new Map<string, AgentActionConversionPreflightRecord[]>();
const bridgeStore = new Map<string, AgentActionApprovalBridgeRecord>();
const eventStore = new Map<string, AgentActionConversionEventRecord[]>();

export function _clearActionConversionStores(): void {
  conversionStore.clear();
  preflightStore.clear();
  bridgeStore.clear();
  eventStore.clear();
}

// ─── Conversion CRUD ──────────────────────────────────────────────────────────

export async function createAgentActionConversion(
  input: CreateAgentActionConversionInput,
): Promise<AgentActionConversionRecord> {
  const normalized = normalizeCreateAgentActionConversionInput(input);
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentActionConversionRecord = {
    id,
    workspaceId: normalized.workspaceId,
    actionDraftId: normalized.actionDraftId,
    reviewItemId: null,
    reviewDecisionId: null,
    sourceResultId: null,
    sourceEvidenceId: null,
    executionRequestId: null,
    approvalBridgeId: null,
    actionType: "unknown",
    status: "created",
    readiness: "not_ready",
    riskLevel: "medium",
    targetScopeType: null,
    targetScopeId: null,
    ownerId: normalized.ownerId ?? null,
    ownerRole: normalized.ownerRole ?? null,
    approvalRequirement: "not_required",
    executionRequestCreationStatus: "not_started",
    blockingReasons: [],
    warnings: [],
    conversionPayload: null,
    safeConversionPayload: null,
    createdBy: normalized.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  conversionStore.set(id, record);
  return record;
}

export async function getAgentActionConversionById(
  workspaceId: string,
  conversionId: string,
): Promise<AgentActionConversionRecord | null> {
  const r = conversionStore.get(conversionId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function getAgentActionConversionByActionDraftId(
  workspaceId: string,
  actionDraftId: string,
): Promise<AgentActionConversionRecord | null> {
  for (const r of conversionStore.values()) {
    if (r.workspaceId === workspaceId && r.actionDraftId === actionDraftId) return r;
  }
  return null;
}

export async function listAgentActionConversions(
  workspaceId: string,
  filters?: AgentActionConversionListFilters,
): Promise<AgentActionConversionRecord[]> {
  let results = Array.from(conversionStore.values()).filter(
    (r) => r.workspaceId === workspaceId,
  );
  if (filters?.status) results = results.filter((r) => r.status === filters.status);
  if (filters?.readiness) results = results.filter((r) => r.readiness === filters.readiness);
  if (filters?.actionDraftId) results = results.filter((r) => r.actionDraftId === filters.actionDraftId);
  if (filters?.reviewItemId) results = results.filter((r) => r.reviewItemId === filters.reviewItemId);
  if (filters?.sourceResultId) results = results.filter((r) => r.sourceResultId === filters.sourceResultId);
  if (filters?.executionRequestId) results = results.filter((r) => r.executionRequestId === filters.executionRequestId);
  if (filters?.approvalRequirement) results = results.filter((r) => r.approvalRequirement === filters.approvalRequirement);
  if (filters?.riskLevel) results = results.filter((r) => r.riskLevel === filters.riskLevel);
  if (filters?.ownerId) results = results.filter((r) => r.ownerId === filters.ownerId);
  if (filters?.ownerRole) results = results.filter((r) => r.ownerRole === filters.ownerRole);
  if (filters?.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentActionConversionStatus(input: {
  workspaceId: string;
  conversionId: string;
  status: AgentActionConversionStatus;
  readiness?: AgentActionConversionReadiness;
  blockingReasons?: string[];
  warnings?: string[];
  actorId?: string | null;
  message?: string | null;
  patch?: Partial<AgentActionConversionRecord>;
}): Promise<AgentActionConversionRecord> {
  const existing = conversionStore.get(input.conversionId);
  if (!existing || existing.workspaceId !== input.workspaceId) {
    throw new Error(`Conversion not found: ${input.conversionId}`);
  }
  const updated: AgentActionConversionRecord = {
    ...existing,
    ...(input.patch ?? {}),
    status: input.status,
    readiness: input.readiness ?? existing.readiness,
    blockingReasons: input.blockingReasons
      ? [...new Set(input.blockingReasons)]
      : existing.blockingReasons,
    warnings: input.warnings ? [...new Set(input.warnings)] : existing.warnings,
    updatedAt: new Date().toISOString(),
  };
  conversionStore.set(input.conversionId, updated);
  return updated;
}

// ─── Preflight (append-only) ──────────────────────────────────────────────────

export async function createAgentActionConversionPreflight(input: {
  workspaceId: string;
  conversionId: string;
  status: AgentActionConversionPreflightStatus;
  readinessScore: number;
  checks: AgentActionConversionPreflightCheckResult[];
  blockingReasons: string[];
  warnings: string[];
  approvalRequired: boolean;
  approvalRequirement: AgentActionApprovalRequirement;
  createdBy?: string | null;
}): Promise<AgentActionConversionPreflightRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentActionConversionPreflightRecord = {
    id,
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    status: input.status,
    readinessScore: Math.max(0, Math.min(100, input.readinessScore)),
    checks: input.checks,
    blockingReasons: [...new Set(input.blockingReasons)],
    warnings: [...new Set(input.warnings)],
    approvalRequired: input.approvalRequired,
    approvalRequirement: input.approvalRequirement,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  const existing = preflightStore.get(input.conversionId) ?? [];
  preflightStore.set(input.conversionId, [...existing, record]);
  return record;
}

export async function getLatestAgentActionConversionPreflight(
  workspaceId: string,
  conversionId: string,
): Promise<AgentActionConversionPreflightRecord | null> {
  const list = preflightStore.get(conversionId) ?? [];
  const filtered = list.filter((p) => p.workspaceId === workspaceId);
  if (filtered.length === 0) return null;
  return filtered[filtered.length - 1];
}

// ─── Approval Bridge CRUD ─────────────────────────────────────────────────────

export async function createAgentActionApprovalBridge(
  input: CreateAgentActionApprovalBridgeInput,
): Promise<AgentActionApprovalBridgeRecord> {
  const normalized = normalizeCreateAgentActionApprovalBridgeInput(input);
  const now = new Date().toISOString();
  const id = randomUUID();

  const conversion = conversionStore.get(normalized.conversionId);
  const actionDraftId = conversion?.actionDraftId ?? "";

  const record: AgentActionApprovalBridgeRecord = {
    id,
    workspaceId: normalized.workspaceId,
    conversionId: normalized.conversionId,
    actionDraftId,
    approvalRequirement: normalized.approvalRequirement,
    status: "required",
    approvalPolicyKey: normalized.approvalPolicyKey ?? null,
    requiredApproverRole: normalized.requiredApproverRole ?? null,
    requiredApproverUserId: normalized.requiredApproverUserId ?? null,
    approvalRequestId: normalized.approvalRequestId ?? null,
    approvalReason: normalized.approvalReason,
    riskJustification: normalized.riskJustification ?? null,
    createdBy: normalized.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  bridgeStore.set(id, record);
  return record;
}

export async function getAgentActionApprovalBridgeById(
  workspaceId: string,
  approvalBridgeId: string,
): Promise<AgentActionApprovalBridgeRecord | null> {
  const r = bridgeStore.get(approvalBridgeId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function getAgentActionApprovalBridgeByConversionId(
  workspaceId: string,
  conversionId: string,
): Promise<AgentActionApprovalBridgeRecord | null> {
  for (const r of bridgeStore.values()) {
    if (r.workspaceId === workspaceId && r.conversionId === conversionId) return r;
  }
  return null;
}

export async function updateAgentActionApprovalBridgeStatus(input: {
  workspaceId: string;
  approvalBridgeId: string;
  status: AgentActionApprovalBridgeStatus;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentActionApprovalBridgeRecord> {
  const existing = bridgeStore.get(input.approvalBridgeId);
  if (!existing || existing.workspaceId !== input.workspaceId) {
    throw new Error(`Approval bridge not found: ${input.approvalBridgeId}`);
  }
  const updated: AgentActionApprovalBridgeRecord = {
    ...existing,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  bridgeStore.set(input.approvalBridgeId, updated);
  return updated;
}

// ─── Events (append-only) ─────────────────────────────────────────────────────

export async function recordAgentActionConversionEvent(input: {
  workspaceId: string;
  conversionId?: string | null;
  actionDraftId?: string | null;
  approvalBridgeId?: string | null;
  executionRequestId?: string | null;
  eventType: AgentActionConversionEventType;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
  actorId?: string | null;
}): Promise<AgentActionConversionEventRecord> {
  const id = randomUUID();
  const record: AgentActionConversionEventRecord = {
    id,
    workspaceId: input.workspaceId,
    conversionId: input.conversionId ?? null,
    actionDraftId: input.actionDraftId ?? null,
    approvalBridgeId: input.approvalBridgeId ?? null,
    executionRequestId: input.executionRequestId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    eventPayload: input.eventPayload ?? null,
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  const key = input.conversionId ?? `__draft_${input.actionDraftId}`;
  const existing = eventStore.get(key) ?? [];
  eventStore.set(key, [...existing, record]);
  return record;
}

export async function listAgentActionConversionEvents(input: {
  workspaceId: string;
  conversionId?: string;
  actionDraftId?: string;
  approvalBridgeId?: string;
  executionRequestId?: string;
  eventType?: AgentActionConversionEventType;
  limit?: number;
}): Promise<AgentActionConversionEventRecord[]> {
  const allEvents: AgentActionConversionEventRecord[] = [];
  for (const events of eventStore.values()) {
    allEvents.push(...events.filter((e) => e.workspaceId === input.workspaceId));
  }
  let results = allEvents;
  if (input.conversionId) results = results.filter((e) => e.conversionId === input.conversionId);
  if (input.actionDraftId) results = results.filter((e) => e.actionDraftId === input.actionDraftId);
  if (input.approvalBridgeId) results = results.filter((e) => e.approvalBridgeId === input.approvalBridgeId);
  if (input.executionRequestId) results = results.filter((e) => e.executionRequestId === input.executionRequestId);
  if (input.eventType) results = results.filter((e) => e.eventType === input.eventType);
  if (input.limit) results = results.slice(0, input.limit);
  return results;
}
