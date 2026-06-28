// ─── Agent Human Review & Action Inbox — Types ────────────────────────────────

export type AgentReviewQueueType =
  | "personal"
  | "team"
  | "project"
  | "pmo_governance"
  | "risk"
  | "compliance"
  | "executive"
  | "system";

export type AgentReviewQueueStatus =
  | "active"
  | "paused"
  | "archived";

export type AgentReviewItemSourceType =
  | "execution_result"
  | "evidence_item"
  | "execution_request"
  | "adapter_execution"
  | "manual";

export type AgentReviewItemStatus =
  | "queued"
  | "assigned"
  | "in_review"
  | "needs_more_evidence"
  | "accepted"
  | "rejected"
  | "archived"
  | "escalated"
  | "deferred"
  | "action_drafted"
  | "completed";

export type AgentReviewPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type AgentReviewRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AgentReviewAssignmentStatus =
  | "assigned"
  | "accepted"
  | "declined"
  | "completed"
  | "reassigned"
  | "cancelled";

export type AgentReviewDecisionType =
  | "accept"
  | "reject"
  | "request_more_evidence"
  | "archive"
  | "escalate"
  | "mark_duplicate"
  | "defer"
  | "convert_to_action_draft";

export type AgentReviewActionDraftType =
  | "draft_email"
  | "draft_task"
  | "draft_project_update"
  | "draft_risk_escalation"
  | "draft_status_report"
  | "draft_governance_note"
  | "draft_follow_up"
  | "manual_action";

export type AgentReviewActionDraftStatus =
  | "draft"
  | "ready_for_approval"
  | "approval_requested"
  | "approved"
  | "rejected"
  | "cancelled"
  | "converted";

export type AgentReviewEventType =
  | "review_queue_created"
  | "review_queue_paused"
  | "review_queue_archived"
  | "review_item_created"
  | "review_item_queued"
  | "review_item_assigned"
  | "review_item_opened"
  | "review_item_accepted"
  | "review_item_rejected"
  | "review_item_more_evidence_requested"
  | "review_item_archived"
  | "review_item_escalated"
  | "review_item_deferred"
  | "review_item_action_drafted"
  | "review_item_completed"
  | "review_assignment_created"
  | "review_assignment_accepted"
  | "review_assignment_declined"
  | "review_assignment_completed"
  | "review_assignment_cancelled"
  | "review_decision_recorded"
  | "action_draft_created"
  | "action_draft_updated"
  | "action_draft_ready_for_approval"
  | "action_draft_cancelled"
  | "action_draft_converted";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentReviewQueueRecord = {
  id: string;
  workspaceId: string;
  queueKey: string;
  queueType: AgentReviewQueueType;
  queueStatus: AgentReviewQueueStatus;
  name: string;
  description: string | null;
  defaultAssigneeId: string | null;
  visibility: string;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentReviewItemRecord = {
  id: string;
  workspaceId: string;
  queueId: string;
  sourceType: AgentReviewItemSourceType;
  sourceId: string | null;
  itemStatus: AgentReviewItemStatus;
  priority: AgentReviewPriority;
  riskLevel: AgentReviewRiskLevel;
  title: string;
  summary: string | null;
  confidenceScore: number;
  assignedTo: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  dueAt: string | null;
  tags: string[];
  payload: Record<string, unknown> | null;
  safePayload: Record<string, unknown> | null;
  visibility: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentReviewAssignmentRecord = {
  id: string;
  workspaceId: string;
  reviewItemId: string;
  assignedTo: string;
  assignedBy: string | null;
  assignmentStatus: AgentReviewAssignmentStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentReviewDecisionRecord = {
  id: string;
  workspaceId: string;
  reviewItemId: string;
  decisionType: AgentReviewDecisionType;
  decidedBy: string | null;
  rationale: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type AgentReviewActionDraftRecord = {
  id: string;
  workspaceId: string;
  reviewItemId: string | null;
  draftType: AgentReviewActionDraftType;
  draftStatus: AgentReviewActionDraftStatus;
  title: string;
  summary: string | null;
  draftPayload: Record<string, unknown> | null;
  safeDraftPayload: Record<string, unknown> | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentReviewEventRecord = {
  id: string;
  workspaceId: string;
  reviewItemId: string | null;
  queueId: string | null;
  actionDraftId: string | null;
  eventType: AgentReviewEventType;
  actorId: string | null;
  payload: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export type CreateAgentReviewQueueInput = {
  workspaceId: string;
  queueKey: string;
  queueType: AgentReviewQueueType;
  name: string;
  description?: string | null;
  defaultAssigneeId?: string | null;
  visibility?: string;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type CreateAgentReviewItemInput = {
  workspaceId: string;
  queueId: string;
  sourceType: AgentReviewItemSourceType;
  sourceId?: string | null;
  priority?: AgentReviewPriority;
  riskLevel?: AgentReviewRiskLevel;
  title: string;
  summary?: string | null;
  confidenceScore?: number;
  dueAt?: string | null;
  tags?: string[];
  payload?: Record<string, unknown> | null;
  visibility?: string;
  createdBy?: string | null;
};

export type CreateAgentReviewDecisionInput = {
  workspaceId: string;
  reviewItemId: string;
  decisionType: AgentReviewDecisionType;
  decidedBy?: string | null;
  rationale?: string | null;
  payload?: Record<string, unknown> | null;
};

export type CreateAgentReviewActionDraftInput = {
  workspaceId: string;
  reviewItemId?: string | null;
  draftType: AgentReviewActionDraftType;
  title: string;
  summary?: string | null;
  draftPayload?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type AgentReviewItemListFilters = {
  queueId?: string;
  itemStatus?: AgentReviewItemStatus;
  priority?: AgentReviewPriority;
  riskLevel?: AgentReviewRiskLevel;
  sourceType?: AgentReviewItemSourceType;
  assignedTo?: string;
  limit?: number;
};

export type AgentReviewInboxSummary = {
  workspaceId: string;
  totalItems: number;
  byStatus: Record<AgentReviewItemStatus, number>;
  byPriority: Record<AgentReviewPriority, number>;
  byQueue: Record<string, number>;
  generatedAt: string;
};
