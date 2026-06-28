// ─── Agent Human Review & Action Inbox — Validation ───────────────────────────

import type {
  AgentReviewQueueType,
  AgentReviewQueueStatus,
  AgentReviewItemSourceType,
  AgentReviewItemStatus,
  AgentReviewPriority,
  AgentReviewRiskLevel,
  AgentReviewAssignmentStatus,
  AgentReviewDecisionType,
  AgentReviewActionDraftType,
  AgentReviewActionDraftStatus,
  AgentReviewEventType,
  CreateAgentReviewQueueInput,
  CreateAgentReviewItemInput,
  CreateAgentReviewDecisionInput,
  CreateAgentReviewActionDraftInput,
} from "./agent-review-inbox-types";

const QUEUE_TYPES: AgentReviewQueueType[] = [
  "personal", "team", "project", "pmo_governance", "risk", "compliance", "executive", "system",
];
const QUEUE_STATUSES: AgentReviewQueueStatus[] = ["active", "paused", "archived"];
const SOURCE_TYPES: AgentReviewItemSourceType[] = [
  "execution_result", "evidence_item", "execution_request", "adapter_execution", "manual",
];
const ITEM_STATUSES: AgentReviewItemStatus[] = [
  "queued", "assigned", "in_review", "needs_more_evidence", "accepted", "rejected",
  "archived", "escalated", "deferred", "action_drafted", "completed",
];
const PRIORITIES: AgentReviewPriority[] = ["low", "normal", "high", "urgent"];
const RISK_LEVELS: AgentReviewRiskLevel[] = ["low", "medium", "high", "critical"];
const ASSIGNMENT_STATUSES: AgentReviewAssignmentStatus[] = [
  "assigned", "accepted", "declined", "completed", "reassigned", "cancelled",
];
const DECISION_TYPES: AgentReviewDecisionType[] = [
  "accept", "reject", "request_more_evidence", "archive", "escalate",
  "mark_duplicate", "defer", "convert_to_action_draft",
];
const ACTION_DRAFT_TYPES: AgentReviewActionDraftType[] = [
  "draft_email", "draft_task", "draft_project_update", "draft_risk_escalation",
  "draft_status_report", "draft_governance_note", "draft_follow_up", "manual_action",
];
const ACTION_DRAFT_STATUSES: AgentReviewActionDraftStatus[] = [
  "draft", "ready_for_approval", "approval_requested", "approved", "rejected", "cancelled", "converted",
];
const EVENT_TYPES: AgentReviewEventType[] = [
  "review_queue_created", "review_queue_paused", "review_queue_archived",
  "review_item_created", "review_item_queued", "review_item_assigned", "review_item_opened",
  "review_item_accepted", "review_item_rejected", "review_item_more_evidence_requested",
  "review_item_archived", "review_item_escalated", "review_item_deferred",
  "review_item_action_drafted", "review_item_completed",
  "review_assignment_created", "review_assignment_accepted", "review_assignment_declined",
  "review_assignment_completed", "review_assignment_cancelled",
  "review_decision_recorded",
  "action_draft_created", "action_draft_updated", "action_draft_ready_for_approval",
  "action_draft_cancelled", "action_draft_converted",
];

export function validateAgentReviewQueueType(v: unknown): v is AgentReviewQueueType {
  return typeof v === "string" && (QUEUE_TYPES as string[]).includes(v);
}

export function validateAgentReviewQueueStatus(v: unknown): v is AgentReviewQueueStatus {
  return typeof v === "string" && (QUEUE_STATUSES as string[]).includes(v);
}

export function validateAgentReviewItemSourceType(v: unknown): v is AgentReviewItemSourceType {
  return typeof v === "string" && (SOURCE_TYPES as string[]).includes(v);
}

export function validateAgentReviewItemStatus(v: unknown): v is AgentReviewItemStatus {
  return typeof v === "string" && (ITEM_STATUSES as string[]).includes(v);
}

export function validateAgentReviewPriority(v: unknown): v is AgentReviewPriority {
  return typeof v === "string" && (PRIORITIES as string[]).includes(v);
}

export function validateAgentReviewRiskLevel(v: unknown): v is AgentReviewRiskLevel {
  return typeof v === "string" && (RISK_LEVELS as string[]).includes(v);
}

export function validateAgentReviewAssignmentStatus(v: unknown): v is AgentReviewAssignmentStatus {
  return typeof v === "string" && (ASSIGNMENT_STATUSES as string[]).includes(v);
}

export function validateAgentReviewDecisionType(v: unknown): v is AgentReviewDecisionType {
  return typeof v === "string" && (DECISION_TYPES as string[]).includes(v);
}

export function validateAgentReviewActionDraftType(v: unknown): v is AgentReviewActionDraftType {
  return typeof v === "string" && (ACTION_DRAFT_TYPES as string[]).includes(v);
}

export function validateAgentReviewActionDraftStatus(v: unknown): v is AgentReviewActionDraftStatus {
  return typeof v === "string" && (ACTION_DRAFT_STATUSES as string[]).includes(v);
}

export function validateAgentReviewEventType(v: unknown): v is AgentReviewEventType {
  return typeof v === "string" && (EVENT_TYPES as string[]).includes(v);
}

// ─── Serialization ────────────────────────────────────────────────────────────

const MAX_PAYLOAD_BYTES = 100 * 1024;

export function assertReviewPayloadSerializable(payload: unknown): void {
  let json: string;
  try {
    json = JSON.stringify(payload);
  } catch {
    throw new Error("Review payload is not JSON serializable (circular or non-serializable value)");
  }
  if (json.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`Review payload exceeds max size of ${MAX_PAYLOAD_BYTES} bytes`);
  }
}

const REDACT_KEYS = new Set([
  "password", "secret", "token", "apiKey", "api_key", "authorization",
  "stripe_secret", "private_key", "credential", "client_secret",
  "refresh_token", "access_token", "session_cookie", "cookie",
]);

function redactObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactObject);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = REDACT_KEYS.has(k) ? "[REDACTED]" : redactObject(v);
  }
  return result;
}

export function redactReviewPayload(payload: unknown): Record<string, unknown> | null {
  if (payload === null || payload === undefined) return null;
  return redactObject(payload) as Record<string, unknown>;
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

export function normalizeCreateAgentReviewQueueInput(input: CreateAgentReviewQueueInput): Required<CreateAgentReviewQueueInput> {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.queueKey) throw new Error("queueKey is required");
  if (!validateAgentReviewQueueType(input.queueType)) throw new Error(`invalid queueType: ${input.queueType}`);
  if (!input.name) throw new Error("name is required");
  return {
    workspaceId: input.workspaceId,
    queueKey: input.queueKey.trim().slice(0, 160),
    queueType: input.queueType,
    name: input.name.trim().slice(0, 240),
    description: input.description ?? null,
    defaultAssigneeId: input.defaultAssigneeId ?? null,
    visibility: input.visibility ?? "workspace",
    metadata: input.metadata ?? null,
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeCreateAgentReviewItemInput(input: CreateAgentReviewItemInput): Required<CreateAgentReviewItemInput> {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.queueId) throw new Error("queueId is required");
  if (!validateAgentReviewItemSourceType(input.sourceType)) throw new Error(`invalid sourceType: ${input.sourceType}`);
  if (!input.title) throw new Error("title is required");
  const score = typeof input.confidenceScore === "number" ? Math.max(0, Math.min(100, input.confidenceScore)) : 0;
  return {
    workspaceId: input.workspaceId,
    queueId: input.queueId,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    priority: validateAgentReviewPriority(input.priority) ? input.priority : "normal",
    riskLevel: validateAgentReviewRiskLevel(input.riskLevel) ? input.riskLevel : "medium",
    title: input.title.trim().slice(0, 240),
    summary: input.summary ? input.summary.slice(0, 4000) : null,
    confidenceScore: score,
    dueAt: input.dueAt ?? null,
    tags: input.tags ?? [],
    payload: input.payload ?? null,
    visibility: input.visibility ?? "workspace",
    createdBy: input.createdBy ?? null,
  };
}

export function normalizeCreateAgentReviewDecisionInput(input: CreateAgentReviewDecisionInput): Required<CreateAgentReviewDecisionInput> {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!input.reviewItemId) throw new Error("reviewItemId is required");
  if (!validateAgentReviewDecisionType(input.decisionType)) throw new Error(`invalid decisionType: ${input.decisionType}`);
  return {
    workspaceId: input.workspaceId,
    reviewItemId: input.reviewItemId,
    decisionType: input.decisionType,
    decidedBy: input.decidedBy ?? null,
    rationale: input.rationale ? input.rationale.slice(0, 4000) : null,
    payload: input.payload ?? null,
  };
}

export function normalizeCreateAgentReviewActionDraftInput(input: CreateAgentReviewActionDraftInput): Required<CreateAgentReviewActionDraftInput> {
  if (!input.workspaceId) throw new Error("workspaceId is required");
  if (!validateAgentReviewActionDraftType(input.draftType)) throw new Error(`invalid draftType: ${input.draftType}`);
  if (!input.title) throw new Error("title is required");
  return {
    workspaceId: input.workspaceId,
    reviewItemId: input.reviewItemId ?? null,
    draftType: input.draftType,
    title: input.title.trim().slice(0, 240),
    summary: input.summary ? input.summary.slice(0, 4000) : null,
    draftPayload: input.draftPayload ?? null,
    createdBy: input.createdBy ?? null,
  };
}
