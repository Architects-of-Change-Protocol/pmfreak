// ─── Agent Tool Approval Layer — Types ───────────────────────────────────────

export type AgentToolRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export type AgentToolApprovalDecision = "approved" | "rejected";

export type AgentToolApprovalEventType =
  | "request_created"
  | "request_approved"
  | "request_rejected"
  | "request_cancelled"
  | "request_expired"
  | "approval_revoked";

export type AgentToolAuthorizationState =
  | "authorized"
  | "pending"
  | "rejected"
  | "revoked"
  | "not_requested"
  | "expired";

// ─── Records ──────────────────────────────────────────────────────────────────

export type AgentToolRequestRecord = {
  id: string;
  workspaceId: string;
  agentId: string;
  agentType: string;
  toolId: string;
  toolKey: string;
  status: AgentToolRequestStatus;
  requestReason: string | null;
  requestContext: Record<string, unknown>;
  requestedBy: string | null;
  requestedAt: string;
  expiresAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentToolApprovalRecord = {
  id: string;
  requestId: string;
  workspaceId: string;
  decision: AgentToolApprovalDecision;
  decidedBy: string;
  decisionNote: string | null;
  decidedAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentToolApprovalEventRecord = {
  id: string;
  requestId: string;
  workspaceId: string;
  eventType: AgentToolApprovalEventType;
  actor: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type CreateAgentToolRequestInput = {
  workspaceId: string;
  agentId: string;
  agentType: string;
  toolKey: string;
  requestReason?: string | null;
  requestContext?: Record<string, unknown>;
  requestedBy?: string | null;
  expiresAt?: string | null;
};

export type DecideAgentToolApprovalInput = {
  requestId: string;
  workspaceId: string;
  decision: AgentToolApprovalDecision;
  decidedBy: string;
  decisionNote?: string | null;
};

// ─── Results ──────────────────────────────────────────────────────────────────

export type AgentToolAuthorizationResult = {
  state: AgentToolAuthorizationState;
  requestId: string | null;
  approvalId: string | null;
  toolKey: string;
  agentId: string;
  decidedBy: string | null;
  decidedAt: string | null;
  revokedAt: string | null;
};

// ─── Filters ─────────────────────────────────────────────────────────────────

export type AgentToolRequestListFilters = {
  agentId?: string;
  toolKey?: string;
  status?: AgentToolRequestStatus;
  requestedBy?: string;
  limit?: number;
  offset?: number;
};
