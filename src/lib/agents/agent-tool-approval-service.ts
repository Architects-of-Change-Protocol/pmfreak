// ─── Agent Tool Approval — Service ───────────────────────────────────────────

import { checkAgentToolEligibility, getAgentToolByKey } from "./agent-tool-service";
import { requiresApprovalForTool } from "./agent-tool-approval-policy";
import {
  validateCreateAgentToolRequestInput,
  validateDecideAgentToolApprovalInput,
} from "./agent-tool-approval-validation";
import {
  createAgentToolRequest,
  getAgentToolRequestById,
  listAgentToolRequests,
  updateAgentToolRequestStatus,
  recordAgentToolApproval,
  listApprovalsForRequest,
  recordAgentToolApprovalEvent,
  revokeAgentToolApprovalRecord,
} from "./agent-tool-approval-registry";
import type {
  AgentToolRequestRecord,
  AgentToolApprovalRecord,
  AgentToolApprovalEventRecord,
  AgentToolAuthorizationResult,
  AgentToolAuthorizationState,
  CreateAgentToolRequestInput,
  DecideAgentToolApprovalInput,
  AgentToolRequestListFilters,
} from "./agent-tool-approval-types";

// ─── Request authorization ────────────────────────────────────────────────────

/**
 * Submit a request for human approval to use a tool.
 * Validates the input, checks tool eligibility (with allowApprovalRequiredTools=true),
 * confirms approval is actually required, then creates the request and event records.
 */
export async function requestAgentToolAuthorization(
  input: CreateAgentToolRequestInput
): Promise<{ ok: true; request: AgentToolRequestRecord } | { ok: false; error: string }> {
  const validationError = validateCreateAgentToolRequestInput(input);
  if (validationError) return { ok: false, error: validationError };

  // Check eligibility with approval bypass so we can see the tool exists
  const eligibility = await checkAgentToolEligibility({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    agentType: input.agentType,
    toolKey: input.toolKey,
    allowApprovalRequiredTools: true,
  });

  if (!eligibility.eligible) {
    return {
      ok: false,
      error: `Tool is not eligible: ${eligibility.message} (${eligibility.reasonCode})`,
    };
  }

  // Fetch tool to check approval policy
  const tool = await getAgentToolByKey(input.workspaceId, input.toolKey);
  if (!tool) return { ok: false, error: "Tool not found after eligibility check." };

  const policy = requiresApprovalForTool(tool);
  if (!policy.required) {
    return {
      ok: false,
      error: `Tool '${input.toolKey}' does not require human approval. Use it directly.`,
    };
  }

  const request = await createAgentToolRequest({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    agentType: input.agentType,
    toolId: tool.id,
    toolKey: input.toolKey,
    requestReason: input.requestReason,
    requestContext: input.requestContext,
    requestedBy: input.requestedBy,
    expiresAt: input.expiresAt,
  });

  await recordAgentToolApprovalEvent({
    requestId: request.id,
    workspaceId: input.workspaceId,
    eventType: "request_created",
    actor: input.requestedBy ?? null,
    note: input.requestReason ?? null,
    metadata: { toolKey: input.toolKey, agentId: input.agentId, agentType: input.agentType },
  });

  return { ok: true, request };
}

// ─── Decide on a request ──────────────────────────────────────────────────────

/**
 * Approve or reject a pending tool request.
 * Records the approval decision and emits the appropriate event.
 */
export async function decideAgentToolApproval(
  input: DecideAgentToolApprovalInput
): Promise<{ ok: true; request: AgentToolRequestRecord; approval: AgentToolApprovalRecord } | { ok: false; error: string }> {
  const validationError = validateDecideAgentToolApprovalInput(input);
  if (validationError) return { ok: false, error: validationError };

  const request = await getAgentToolRequestById(input.workspaceId, input.requestId);
  if (!request) return { ok: false, error: "Request not found." };
  if (request.status !== "pending") {
    return { ok: false, error: `Request is not pending — current status: ${request.status}` };
  }

  // Check expiry
  if (request.expiresAt && new Date(request.expiresAt) <= new Date()) {
    await updateAgentToolRequestStatus(input.workspaceId, input.requestId, "expired");
    await recordAgentToolApprovalEvent({
      requestId: input.requestId,
      workspaceId: input.workspaceId,
      eventType: "request_expired",
      actor: null,
      note: "Request expired before decision was recorded.",
    });
    return { ok: false, error: "Request has expired." };
  }

  const approval = await recordAgentToolApproval({
    requestId: input.requestId,
    workspaceId: input.workspaceId,
    decision: input.decision,
    decidedBy: input.decidedBy,
    decisionNote: input.decisionNote,
  });

  const newStatus = input.decision === "approved" ? "approved" : "rejected";
  const updatedRequest = await updateAgentToolRequestStatus(
    input.workspaceId,
    input.requestId,
    newStatus
  );

  await recordAgentToolApprovalEvent({
    requestId: input.requestId,
    workspaceId: input.workspaceId,
    eventType: input.decision === "approved" ? "request_approved" : "request_rejected",
    actor: input.decidedBy,
    note: input.decisionNote ?? null,
    metadata: { approvalId: approval.id, decision: input.decision },
  });

  return { ok: true, request: updatedRequest, approval };
}

// ─── Get authorization state ──────────────────────────────────────────────────

/**
 * Return the current authorization state for a given agent+tool combination.
 * Looks up the most recent non-cancelled request and its approval if any.
 */
export async function getAgentToolAuthorizationState(
  workspaceId: string,
  agentId: string,
  toolKey: string
): Promise<AgentToolAuthorizationResult> {
  const notRequested: AgentToolAuthorizationResult = {
    state: "not_requested",
    requestId: null,
    approvalId: null,
    toolKey,
    agentId,
    decidedBy: null,
    decidedAt: null,
    revokedAt: null,
  };

  const requests = await listAgentToolRequests(workspaceId, { agentId, toolKey });
  if (requests.length === 0) return notRequested;

  // Most recent non-cancelled request
  const active = requests.find((r) => r.status !== "cancelled");
  if (!active) return notRequested;

  // Check expiry on pending
  if (active.status === "pending") {
    if (active.expiresAt && new Date(active.expiresAt) <= new Date()) {
      return {
        state: "expired",
        requestId: active.id,
        approvalId: null,
        toolKey,
        agentId,
        decidedBy: null,
        decidedAt: null,
        revokedAt: null,
      };
    }
    return {
      state: "pending",
      requestId: active.id,
      approvalId: null,
      toolKey,
      agentId,
      decidedBy: null,
      decidedAt: null,
      revokedAt: null,
    };
  }

  if (active.status === "rejected") {
    const approvals = await listApprovalsForRequest(workspaceId, active.id);
    const rejection = approvals.find((a) => a.decision === "rejected");
    return {
      state: "rejected",
      requestId: active.id,
      approvalId: rejection?.id ?? null,
      toolKey,
      agentId,
      decidedBy: rejection?.decidedBy ?? null,
      decidedAt: rejection?.decidedAt ?? null,
      revokedAt: null,
    };
  }

  if (active.status === "expired") {
    return {
      state: "expired",
      requestId: active.id,
      approvalId: null,
      toolKey,
      agentId,
      decidedBy: null,
      decidedAt: null,
      revokedAt: null,
    };
  }

  if (active.status === "approved") {
    const approvals = await listApprovalsForRequest(workspaceId, active.id);
    const approval = approvals.find((a) => a.decision === "approved");

    if (approval?.revokedAt) {
      return {
        state: "revoked",
        requestId: active.id,
        approvalId: approval.id,
        toolKey,
        agentId,
        decidedBy: approval.decidedBy,
        decidedAt: approval.decidedAt,
        revokedAt: approval.revokedAt,
      };
    }

    return {
      state: "authorized",
      requestId: active.id,
      approvalId: approval?.id ?? null,
      toolKey,
      agentId,
      decidedBy: approval?.decidedBy ?? null,
      decidedAt: approval?.decidedAt ?? null,
      revokedAt: null,
    };
  }

  return notRequested;
}

// ─── Cancel a request ─────────────────────────────────────────────────────────

export async function cancelAgentToolRequest(
  workspaceId: string,
  requestId: string,
  cancelledBy?: string | null
): Promise<{ ok: true; request: AgentToolRequestRecord } | { ok: false; error: string }> {
  const request = await getAgentToolRequestById(workspaceId, requestId);
  if (!request) return { ok: false, error: "Request not found." };
  if (request.status !== "pending") {
    return { ok: false, error: `Only pending requests can be cancelled — current status: ${request.status}` };
  }

  const updated = await updateAgentToolRequestStatus(workspaceId, requestId, "cancelled");

  await recordAgentToolApprovalEvent({
    requestId,
    workspaceId,
    eventType: "request_cancelled",
    actor: cancelledBy ?? null,
    note: null,
    metadata: {},
  });

  return { ok: true, request: updated };
}

// ─── Revoke an approval ───────────────────────────────────────────────────────

export async function revokeAgentToolApproval(
  workspaceId: string,
  requestId: string,
  revokedBy: string,
  revocationNote?: string | null
): Promise<{ ok: true; approval: AgentToolApprovalRecord } | { ok: false; error: string }> {
  const request = await getAgentToolRequestById(workspaceId, requestId);
  if (!request) return { ok: false, error: "Request not found." };
  if (request.status !== "approved") {
    return { ok: false, error: `Only approved requests can have their approval revoked — current status: ${request.status}` };
  }

  const approvals = await listApprovalsForRequest(workspaceId, requestId);
  const approval = approvals.find((a) => a.decision === "approved" && !a.revokedAt);
  if (!approval) return { ok: false, error: "No active approval found for this request." };

  const revoked = await revokeAgentToolApprovalRecord(
    workspaceId,
    approval.id,
    revokedBy,
    revocationNote
  );

  await recordAgentToolApprovalEvent({
    requestId,
    workspaceId,
    eventType: "approval_revoked",
    actor: revokedBy,
    note: revocationNote ?? null,
    metadata: { approvalId: approval.id },
  });

  return { ok: true, approval: revoked };
}

// ─── Re-exports for convenience ───────────────────────────────────────────────

export {
  getAgentToolRequestById,
  listAgentToolRequests,
  listApprovalsForRequest,
  listApprovalEventsForRequest,
} from "./agent-tool-approval-registry";
