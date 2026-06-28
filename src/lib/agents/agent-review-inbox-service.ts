// ─── Agent Human Review & Action Inbox — Service ──────────────────────────────
// Does NOT call LLMs, external APIs, or send communications.
// All operations are deterministic in-memory.

import {
  createAgentReviewQueue,
  getAgentReviewQueueByKey,
  listAgentReviewQueues,
  createAgentReviewItem,
  getAgentReviewItemById,
  updateAgentReviewItemStatus,
  createAgentReviewAssignment,
  createAgentReviewDecision,
  listAgentReviewItems,
  createAgentReviewActionDraft,
  updateAgentReviewActionDraftStatus,
  recordAgentReviewEvent,
} from "./agent-review-inbox-registry";
import type {
  AgentReviewQueueRecord,
  AgentReviewItemRecord,
  AgentReviewAssignmentRecord,
  AgentReviewDecisionRecord,
  AgentReviewActionDraftRecord,
  AgentReviewInboxSummary,
  AgentReviewItemStatus,
  AgentReviewPriority,
  CreateAgentReviewItemInput,
  AgentReviewItemListFilters,
} from "./agent-review-inbox-types";

// ─── Audit Helper ─────────────────────────────────────────────────────────────

async function tryAuditEvent(args: {
  workspaceId: string;
  title: string;
  eventType: string;
  actorId?: string | null;
}) {
  try {
    const { recordAgentAuditEvent } = await import("./agent-observability-service");
    await recordAgentAuditEvent({
      workspaceId: args.workspaceId,
      category: "execution" as never,
      eventType: args.eventType as never,
      sourceType: "agent_human_review_action_inbox" as never,
      scopeType: "workspace",
      title: args.title,
      actorId: args.actorId ?? null,
    });
  } catch {
    // audit is best-effort
  }
}

// ─── Default Queues ───────────────────────────────────────────────────────────

const DEFAULT_QUEUES: Array<{ queueKey: string; queueType: "personal" | "project" | "pmo_governance" | "risk" | "compliance" | "executive"; name: string; description: string }> = [
  { queueKey: "personal_review", queueType: "personal", name: "Personal Review", description: "Items assigned for personal review" },
  { queueKey: "project_review", queueType: "project", name: "Project Review", description: "Project-level items for review" },
  { queueKey: "pmo_governance", queueType: "pmo_governance", name: "PMO Governance", description: "Governance-level items requiring PMO review" },
  { queueKey: "risk_review", queueType: "risk", name: "Risk Review", description: "Items flagged for risk assessment" },
  { queueKey: "compliance_review", queueType: "compliance", name: "Compliance Review", description: "Compliance-related review items" },
  { queueKey: "executive_review", queueType: "executive", name: "Executive Review", description: "High-level executive review items" },
];

export async function createDefaultReviewQueues(workspaceId: string, createdBy?: string | null): Promise<AgentReviewQueueRecord[]> {
  const queues: AgentReviewQueueRecord[] = [];
  for (const q of DEFAULT_QUEUES) {
    const existing = await getAgentReviewQueueByKey(workspaceId, q.queueKey);
    if (existing) {
      queues.push(existing);
      continue;
    }
    const queue = await createAgentReviewQueue({
      workspaceId,
      queueKey: q.queueKey,
      queueType: q.queueType,
      name: q.name,
      description: q.description,
      createdBy: createdBy ?? null,
    });
    await recordAgentReviewEvent({ workspaceId, eventType: "review_queue_created", queueId: queue.id, actorId: createdBy });
    await tryAuditEvent({ workspaceId, title: `Default review queue created: ${q.name}`, eventType: "review_queue_created", actorId: createdBy });
    queues.push(queue);
  }
  return queues;
}

// ─── Queue Routing ────────────────────────────────────────────────────────────

async function resolveQueueId(workspaceId: string, queueKey: string): Promise<string> {
  let queue = await getAgentReviewQueueByKey(workspaceId, queueKey);
  if (!queue) {
    // auto-create default queues if missing
    await createDefaultReviewQueues(workspaceId);
    queue = await getAgentReviewQueueByKey(workspaceId, queueKey);
  }
  if (!queue) throw new Error(`Queue not found: ${queueKey}`);
  return queue.id;
}

// ─── Create Item from Execution Result ────────────────────────────────────────

export async function createReviewItemFromExecutionResult(args: {
  workspaceId: string;
  executionResultId: string;
  actorId?: string | null;
}): Promise<AgentReviewItemRecord> {
  const { getAgentExecutionResultById } = await import("./agent-execution-result-registry");
  const result = await getAgentExecutionResultById(args.workspaceId, args.executionResultId);
  if (!result) throw new Error(`Execution result not found: ${args.executionResultId}`);

  // Route to queue based on result type and confidence
  let queueKey = "project_review";
  if (result.resultType === "risk_analysis") {
    queueKey = "risk_review";
  } else if (result.resultType === "governance_note") {
    queueKey = "pmo_governance";
  } else if (result.confidenceScore < 50) {
    queueKey = "pmo_governance";
  }

  // Route high-risk to executive if risk level is high/critical
  const riskLevel = result.confidenceScore < 30 ? "high" : result.confidenceScore < 60 ? "medium" : "low";
  if (riskLevel === "high" && result.resultType === "risk_analysis") {
    queueKey = "pmo_governance";
  }

  const queueId = await resolveQueueId(args.workspaceId, queueKey);

  const input: CreateAgentReviewItemInput = {
    workspaceId: args.workspaceId,
    queueId,
    sourceType: "execution_result",
    sourceId: args.executionResultId,
    title: result.title,
    summary: result.summary ?? undefined,
    confidenceScore: result.confidenceScore,
    riskLevel: riskLevel === "high" ? "high" : riskLevel === "medium" ? "medium" : "low",
    createdBy: args.actorId ?? null,
  };

  const item = await createAgentReviewItem(input);
  await recordAgentReviewEvent({ workspaceId: args.workspaceId, eventType: "review_item_created", reviewItemId: item.id, actorId: args.actorId });
  await tryAuditEvent({ workspaceId: args.workspaceId, title: `Review item created from execution result: ${item.title}`, eventType: "review_item_created", actorId: args.actorId });
  return item;
}

// ─── Create Item from Evidence ────────────────────────────────────────────────

export async function createReviewItemFromEvidence(args: {
  workspaceId: string;
  evidenceId: string;
  actorId?: string | null;
}): Promise<AgentReviewItemRecord> {
  const { getAgentExecutionEvidenceById } = await import("./agent-execution-result-registry");
  const evidence = await getAgentExecutionEvidenceById(args.workspaceId, args.evidenceId);
  if (!evidence) throw new Error(`Evidence item not found: ${args.evidenceId}`);

  const queueId = await resolveQueueId(args.workspaceId, "project_review");

  const item = await createAgentReviewItem({
    workspaceId: args.workspaceId,
    queueId,
    sourceType: "evidence_item",
    sourceId: args.evidenceId,
    title: evidence.title,
    createdBy: args.actorId ?? null,
  });
  await recordAgentReviewEvent({ workspaceId: args.workspaceId, eventType: "review_item_created", reviewItemId: item.id, actorId: args.actorId });
  return item;
}

// ─── Item Lifecycle ───────────────────────────────────────────────────────────

export async function assignReviewItem(args: {
  workspaceId: string;
  reviewItemId: string;
  assignedTo: string;
  assignedBy?: string | null;
  note?: string | null;
}): Promise<AgentReviewAssignmentRecord> {
  const item = await getAgentReviewItemById(args.workspaceId, args.reviewItemId);
  if (!item) throw new Error(`Review item not found: ${args.reviewItemId}`);

  const assignment = await createAgentReviewAssignment({
    workspaceId: args.workspaceId,
    reviewItemId: args.reviewItemId,
    assignedTo: args.assignedTo,
    assignedBy: args.assignedBy,
    note: args.note,
  });

  await updateAgentReviewItemStatus({ workspaceId: args.workspaceId, reviewItemId: args.reviewItemId, itemStatus: "assigned", assignedTo: args.assignedTo });
  await recordAgentReviewEvent({ workspaceId: args.workspaceId, eventType: "review_item_assigned", reviewItemId: args.reviewItemId, actorId: args.assignedBy });
  await tryAuditEvent({ workspaceId: args.workspaceId, title: `Review item assigned: ${item.title}`, eventType: "review_item_assigned", actorId: args.assignedBy });
  return assignment;
}

export async function openReviewItem(args: {
  workspaceId: string;
  reviewItemId: string;
  actorId?: string | null;
}): Promise<AgentReviewItemRecord> {
  const item = await getAgentReviewItemById(args.workspaceId, args.reviewItemId);
  if (!item) throw new Error(`Review item not found: ${args.reviewItemId}`);

  const updated = await updateAgentReviewItemStatus({ workspaceId: args.workspaceId, reviewItemId: args.reviewItemId, itemStatus: "in_review" });
  await recordAgentReviewEvent({ workspaceId: args.workspaceId, eventType: "review_item_opened", reviewItemId: args.reviewItemId, actorId: args.actorId });
  await tryAuditEvent({ workspaceId: args.workspaceId, title: `Review item opened: ${item.title}`, eventType: "review_item_opened", actorId: args.actorId });
  return updated;
}

export async function recordReviewDecision(args: {
  workspaceId: string;
  reviewItemId: string;
  decisionType: "accept" | "reject" | "request_more_evidence" | "archive" | "escalate" | "mark_duplicate" | "defer" | "convert_to_action_draft";
  decidedBy?: string | null;
  rationale?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<AgentReviewDecisionRecord> {
  const item = await getAgentReviewItemById(args.workspaceId, args.reviewItemId);
  if (!item) throw new Error(`Review item not found: ${args.reviewItemId}`);

  const decision = await createAgentReviewDecision({
    workspaceId: args.workspaceId,
    reviewItemId: args.reviewItemId,
    decisionType: args.decisionType,
    decidedBy: args.decidedBy,
    rationale: args.rationale,
    payload: args.payload,
  });

  // Map decision type to item status
  const statusMap: Record<string, AgentReviewItemStatus> = {
    accept: "accepted",
    reject: "rejected",
    request_more_evidence: "needs_more_evidence",
    archive: "archived",
    escalate: "escalated",
    mark_duplicate: "archived",
    defer: "deferred",
    convert_to_action_draft: "action_drafted",
  };

  const newStatus = statusMap[args.decisionType] ?? item.itemStatus;
  await updateAgentReviewItemStatus({
    workspaceId: args.workspaceId,
    reviewItemId: args.reviewItemId,
    itemStatus: newStatus,
    reviewedBy: args.decidedBy,
  });

  const eventTypeMap: Record<string, string> = {
    accept: "review_item_accepted",
    reject: "review_item_rejected",
    request_more_evidence: "review_item_more_evidence_requested",
    archive: "review_item_archived",
    escalate: "review_item_escalated",
    defer: "review_item_deferred",
    convert_to_action_draft: "review_item_action_drafted",
    mark_duplicate: "review_item_archived",
  };

  const eventType = eventTypeMap[args.decisionType] ?? "review_decision_recorded";
  await recordAgentReviewEvent({ workspaceId: args.workspaceId, eventType: eventType as never, reviewItemId: args.reviewItemId, actorId: args.decidedBy });
  await tryAuditEvent({ workspaceId: args.workspaceId, title: `Review decision: ${args.decisionType}`, eventType: eventType, actorId: args.decidedBy });

  return decision;
}

// ─── Convert to Action Draft ──────────────────────────────────────────────────

export async function convertReviewItemToActionDraft(args: {
  workspaceId: string;
  reviewItemId: string;
  actorId?: string | null;
  title?: string;
}): Promise<AgentReviewActionDraftRecord> {
  const item = await getAgentReviewItemById(args.workspaceId, args.reviewItemId);
  if (!item) throw new Error(`Review item not found: ${args.reviewItemId}`);
  if (item.itemStatus !== "accepted" && item.itemStatus !== "action_drafted") {
    throw new Error(`Cannot convert review item to action draft: item must be in accepted status, current status: ${item.itemStatus}`);
  }

  // Map source type to action draft type
  const sourceTypeMap: Record<string, string> = {
    execution_result: "draft_task",
    evidence_item: "draft_follow_up",
    execution_request: "draft_task",
    adapter_execution: "draft_task",
    manual: "manual_action",
  };
  const draftType = (sourceTypeMap[item.sourceType] ?? "manual_action") as never;

  const draft = await createAgentReviewActionDraft({
    workspaceId: args.workspaceId,
    reviewItemId: args.reviewItemId,
    draftType,
    title: args.title ?? item.title,
    summary: item.summary ?? undefined,
    createdBy: args.actorId ?? null,
  });

  await recordAgentReviewEvent({ workspaceId: args.workspaceId, eventType: "action_draft_created", reviewItemId: args.reviewItemId, actionDraftId: draft.id, actorId: args.actorId });
  await tryAuditEvent({ workspaceId: args.workspaceId, title: `Action draft created from review item: ${draft.title}`, eventType: "action_draft_created", actorId: args.actorId });
  return draft;
}

export async function markActionDraftReadyForApproval(args: {
  workspaceId: string;
  actionDraftId: string;
  actorId?: string | null;
}): Promise<AgentReviewActionDraftRecord> {
  const draft = await updateAgentReviewActionDraftStatus({ workspaceId: args.workspaceId, actionDraftId: args.actionDraftId, draftStatus: "ready_for_approval" });
  await recordAgentReviewEvent({ workspaceId: args.workspaceId, eventType: "action_draft_ready_for_approval", actionDraftId: args.actionDraftId, actorId: args.actorId });
  return draft;
}

export async function cancelActionDraft(args: {
  workspaceId: string;
  actionDraftId: string;
  actorId?: string | null;
}): Promise<AgentReviewActionDraftRecord> {
  const draft = await updateAgentReviewActionDraftStatus({ workspaceId: args.workspaceId, actionDraftId: args.actionDraftId, draftStatus: "cancelled" });
  await recordAgentReviewEvent({ workspaceId: args.workspaceId, eventType: "action_draft_cancelled", actionDraftId: args.actionDraftId, actorId: args.actorId });
  return draft;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function buildReviewInboxSummary(workspaceId: string): Promise<AgentReviewInboxSummary> {
  const items = await listAgentReviewItems(workspaceId);
  const queues = await listAgentReviewQueues(workspaceId);

  const byStatus: Record<AgentReviewItemStatus, number> = {
    queued: 0, assigned: 0, in_review: 0, needs_more_evidence: 0,
    accepted: 0, rejected: 0, archived: 0, escalated: 0, deferred: 0,
    action_drafted: 0, completed: 0,
  };
  const byPriority: Record<AgentReviewPriority, number> = { low: 0, normal: 0, high: 0, urgent: 0 };
  const byQueue: Record<string, number> = {};

  for (const item of items) {
    byStatus[item.itemStatus] = (byStatus[item.itemStatus] ?? 0) + 1;
    byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
    byQueue[item.queueId] = (byQueue[item.queueId] ?? 0) + 1;
  }

  // Map queue ids to names
  const namedByQueue: Record<string, number> = {};
  for (const queue of queues) {
    if (byQueue[queue.id]) {
      namedByQueue[queue.queueKey] = byQueue[queue.id];
    }
  }

  return {
    workspaceId,
    totalItems: items.length,
    byStatus,
    byPriority,
    byQueue: namedByQueue,
    generatedAt: new Date().toISOString(),
  };
}

// ─── List Helpers (passthrough for routes) ───────────────────────────────────

export async function listReviewQueues(workspaceId: string): Promise<AgentReviewQueueRecord[]> {
  return listAgentReviewQueues(workspaceId);
}

export async function listReviewItems(workspaceId: string, filters?: AgentReviewItemListFilters): Promise<AgentReviewItemRecord[]> {
  return listAgentReviewItems(workspaceId, filters);
}
