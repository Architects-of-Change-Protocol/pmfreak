// ─── Agent Human Review & Action Inbox — Registry ─────────────────────────────
// NOTE: Pure in-memory store. Does not use Supabase.

import { randomUUID } from "node:crypto";
import {
  normalizeCreateAgentReviewQueueInput,
  normalizeCreateAgentReviewItemInput,
  normalizeCreateAgentReviewDecisionInput,
  normalizeCreateAgentReviewActionDraftInput,
  redactReviewPayload,
} from "./agent-review-inbox-validation";
import type {
  AgentReviewQueueRecord,
  AgentReviewItemRecord,
  AgentReviewAssignmentRecord,
  AgentReviewDecisionRecord,
  AgentReviewActionDraftRecord,
  AgentReviewEventRecord,
  AgentReviewItemStatus,
  AgentReviewAssignmentStatus,
  AgentReviewActionDraftStatus,
  AgentReviewEventType,
  AgentReviewItemListFilters,
  CreateAgentReviewQueueInput,
  CreateAgentReviewItemInput,
  CreateAgentReviewDecisionInput,
  CreateAgentReviewActionDraftInput,
} from "./agent-review-inbox-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const queueStore = new Map<string, AgentReviewQueueRecord>();
const itemStore = new Map<string, AgentReviewItemRecord>();
const assignmentStore = new Map<string, AgentReviewAssignmentRecord>();
const decisionStore = new Map<string, AgentReviewDecisionRecord[]>();
const actionDraftStore = new Map<string, AgentReviewActionDraftRecord>();
const eventStore = new Map<string, AgentReviewEventRecord[]>();

export function _clearReviewStores(): void {
  queueStore.clear();
  itemStore.clear();
  assignmentStore.clear();
  decisionStore.clear();
  actionDraftStore.clear();
  eventStore.clear();
}

// ─── Queue CRUD ───────────────────────────────────────────────────────────────

export async function createAgentReviewQueue(input: CreateAgentReviewQueueInput): Promise<AgentReviewQueueRecord> {
  const normalized = normalizeCreateAgentReviewQueueInput(input);
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentReviewQueueRecord = {
    id,
    workspaceId: normalized.workspaceId,
    queueKey: normalized.queueKey,
    queueType: normalized.queueType,
    queueStatus: "active",
    name: normalized.name,
    description: normalized.description,
    defaultAssigneeId: normalized.defaultAssigneeId,
    visibility: normalized.visibility,
    metadata: normalized.metadata,
    createdBy: normalized.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  queueStore.set(id, record);
  return record;
}

export async function getAgentReviewQueueById(workspaceId: string, queueId: string): Promise<AgentReviewQueueRecord | null> {
  const r = queueStore.get(queueId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function getAgentReviewQueueByKey(workspaceId: string, queueKey: string): Promise<AgentReviewQueueRecord | null> {
  for (const r of queueStore.values()) {
    if (r.workspaceId === workspaceId && r.queueKey === queueKey) return r;
  }
  return null;
}

export async function listAgentReviewQueues(workspaceId: string): Promise<AgentReviewQueueRecord[]> {
  return Array.from(queueStore.values()).filter(r => r.workspaceId === workspaceId);
}

// ─── Item CRUD ────────────────────────────────────────────────────────────────

export async function createAgentReviewItem(input: CreateAgentReviewItemInput): Promise<AgentReviewItemRecord> {
  const normalized = normalizeCreateAgentReviewItemInput(input);
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentReviewItemRecord = {
    id,
    workspaceId: normalized.workspaceId,
    queueId: normalized.queueId,
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
    itemStatus: "queued",
    priority: normalized.priority,
    riskLevel: normalized.riskLevel,
    title: normalized.title,
    summary: normalized.summary,
    confidenceScore: normalized.confidenceScore,
    assignedTo: null,
    reviewedBy: null,
    reviewedAt: null,
    dueAt: normalized.dueAt,
    tags: normalized.tags,
    payload: normalized.payload,
    safePayload: redactReviewPayload(normalized.payload),
    visibility: normalized.visibility,
    createdBy: normalized.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  itemStore.set(id, record);
  return record;
}

export async function getAgentReviewItemById(workspaceId: string, reviewItemId: string): Promise<AgentReviewItemRecord | null> {
  const r = itemStore.get(reviewItemId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function listAgentReviewItems(workspaceId: string, filters?: AgentReviewItemListFilters): Promise<AgentReviewItemRecord[]> {
  let results = Array.from(itemStore.values()).filter(r => r.workspaceId === workspaceId);
  if (filters?.queueId) results = results.filter(r => r.queueId === filters.queueId);
  if (filters?.itemStatus) results = results.filter(r => r.itemStatus === filters.itemStatus);
  if (filters?.priority) results = results.filter(r => r.priority === filters.priority);
  if (filters?.riskLevel) results = results.filter(r => r.riskLevel === filters.riskLevel);
  if (filters?.sourceType) results = results.filter(r => r.sourceType === filters.sourceType);
  if (filters?.assignedTo) results = results.filter(r => r.assignedTo === filters.assignedTo);
  if (filters?.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentReviewItemStatus(args: {
  workspaceId: string;
  reviewItemId: string;
  itemStatus: AgentReviewItemStatus;
  assignedTo?: string | null;
  reviewedBy?: string | null;
}): Promise<AgentReviewItemRecord> {
  const r = itemStore.get(args.reviewItemId);
  if (!r || r.workspaceId !== args.workspaceId) throw new Error(`Review item not found: ${args.reviewItemId}`);
  const now = new Date().toISOString();
  const updated: AgentReviewItemRecord = {
    ...r,
    itemStatus: args.itemStatus,
    assignedTo: args.assignedTo !== undefined ? args.assignedTo : r.assignedTo,
    reviewedBy: args.reviewedBy !== undefined ? args.reviewedBy : r.reviewedBy,
    reviewedAt: args.reviewedBy ? now : r.reviewedAt,
    updatedAt: now,
  };
  itemStore.set(args.reviewItemId, updated);
  return updated;
}

// ─── Assignment CRUD ──────────────────────────────────────────────────────────

export async function createAgentReviewAssignment(args: {
  workspaceId: string;
  reviewItemId: string;
  assignedTo: string;
  assignedBy?: string | null;
  note?: string | null;
}): Promise<AgentReviewAssignmentRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentReviewAssignmentRecord = {
    id,
    workspaceId: args.workspaceId,
    reviewItemId: args.reviewItemId,
    assignedTo: args.assignedTo,
    assignedBy: args.assignedBy ?? null,
    assignmentStatus: "assigned",
    note: args.note ?? null,
    createdAt: now,
    updatedAt: now,
  };
  assignmentStore.set(id, record);
  return record;
}

export async function updateAgentReviewAssignmentStatus(args: {
  workspaceId: string;
  assignmentId: string;
  assignmentStatus: AgentReviewAssignmentStatus;
}): Promise<AgentReviewAssignmentRecord> {
  const r = assignmentStore.get(args.assignmentId);
  if (!r || r.workspaceId !== args.workspaceId) throw new Error(`Assignment not found: ${args.assignmentId}`);
  const updated: AgentReviewAssignmentRecord = { ...r, assignmentStatus: args.assignmentStatus, updatedAt: new Date().toISOString() };
  assignmentStore.set(args.assignmentId, updated);
  return updated;
}

export async function listAgentReviewAssignments(workspaceId: string, reviewItemId: string): Promise<AgentReviewAssignmentRecord[]> {
  return Array.from(assignmentStore.values()).filter(r => r.workspaceId === workspaceId && r.reviewItemId === reviewItemId);
}

// ─── Decision CRUD (append-only) ──────────────────────────────────────────────

export async function createAgentReviewDecision(input: CreateAgentReviewDecisionInput): Promise<AgentReviewDecisionRecord> {
  const normalized = normalizeCreateAgentReviewDecisionInput(input);
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentReviewDecisionRecord = {
    id,
    workspaceId: normalized.workspaceId,
    reviewItemId: normalized.reviewItemId,
    decisionType: normalized.decisionType,
    decidedBy: normalized.decidedBy,
    rationale: normalized.rationale,
    payload: normalized.payload,
    createdAt: now,
  };
  const list = decisionStore.get(normalized.reviewItemId) ?? [];
  list.push(record);
  decisionStore.set(normalized.reviewItemId, list);
  return record;
}

export async function listAgentReviewDecisions(workspaceId: string, reviewItemId: string): Promise<AgentReviewDecisionRecord[]> {
  return (decisionStore.get(reviewItemId) ?? []).filter(r => r.workspaceId === workspaceId);
}

// ─── Action Draft CRUD ────────────────────────────────────────────────────────

export async function createAgentReviewActionDraft(input: CreateAgentReviewActionDraftInput): Promise<AgentReviewActionDraftRecord> {
  const normalized = normalizeCreateAgentReviewActionDraftInput(input);
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentReviewActionDraftRecord = {
    id,
    workspaceId: normalized.workspaceId,
    reviewItemId: normalized.reviewItemId,
    draftType: normalized.draftType,
    draftStatus: "draft",
    title: normalized.title,
    summary: normalized.summary,
    draftPayload: normalized.draftPayload,
    safeDraftPayload: redactReviewPayload(normalized.draftPayload),
    createdBy: normalized.createdBy,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  actionDraftStore.set(id, record);
  return record;
}

export async function getAgentReviewActionDraftById(workspaceId: string, actionDraftId: string): Promise<AgentReviewActionDraftRecord | null> {
  const r = actionDraftStore.get(actionDraftId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function listAgentReviewActionDrafts(workspaceId: string, reviewItemId?: string): Promise<AgentReviewActionDraftRecord[]> {
  return Array.from(actionDraftStore.values()).filter(r => {
    if (r.workspaceId !== workspaceId) return false;
    if (reviewItemId && r.reviewItemId !== reviewItemId) return false;
    return true;
  });
}

export async function updateAgentReviewActionDraftStatus(args: {
  workspaceId: string;
  actionDraftId: string;
  draftStatus: AgentReviewActionDraftStatus;
  approvedBy?: string | null;
}): Promise<AgentReviewActionDraftRecord> {
  const r = actionDraftStore.get(args.actionDraftId);
  if (!r || r.workspaceId !== args.workspaceId) throw new Error(`Action draft not found: ${args.actionDraftId}`);
  const now = new Date().toISOString();
  const updated: AgentReviewActionDraftRecord = {
    ...r,
    draftStatus: args.draftStatus,
    approvedBy: args.approvedBy !== undefined ? args.approvedBy : r.approvedBy,
    approvedAt: args.approvedBy ? now : r.approvedAt,
    updatedAt: now,
  };
  actionDraftStore.set(args.actionDraftId, updated);
  return updated;
}

// ─── Events (append-only) ─────────────────────────────────────────────────────

export async function recordAgentReviewEvent(args: {
  workspaceId: string;
  eventType: AgentReviewEventType;
  reviewItemId?: string | null;
  queueId?: string | null;
  actionDraftId?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<AgentReviewEventRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentReviewEventRecord = {
    id,
    workspaceId: args.workspaceId,
    reviewItemId: args.reviewItemId ?? null,
    queueId: args.queueId ?? null,
    actionDraftId: args.actionDraftId ?? null,
    eventType: args.eventType,
    actorId: args.actorId ?? null,
    payload: args.payload ?? null,
    occurredAt: now,
    createdAt: now,
  };
  const key = args.reviewItemId ?? args.queueId ?? args.actionDraftId ?? "__global";
  const list = eventStore.get(key) ?? [];
  list.push(record);
  eventStore.set(key, list);
  return record;
}

export async function listAgentReviewEvents(workspaceId: string, reviewItemId: string): Promise<AgentReviewEventRecord[]> {
  return (eventStore.get(reviewItemId) ?? []).filter(r => r.workspaceId === workspaceId);
}
