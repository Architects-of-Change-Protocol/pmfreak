// ─── Agent Controlled Action Conversion & Approval Bridge — Service ────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters. Does NOT mutate projects.
// Does NOT send emails, Slack messages, or create tickets.
// All operations are deterministic.

import {
  createAgentActionConversion,
  getAgentActionConversionById,
  listAgentActionConversions,
  updateAgentActionConversionStatus,
  createAgentActionConversionPreflight,
  getLatestAgentActionConversionPreflight,
  createAgentActionApprovalBridge,
  getAgentActionApprovalBridgeById,
  getAgentActionApprovalBridgeByConversionId,
  updateAgentActionApprovalBridgeStatus,
  recordAgentActionConversionEvent,
} from "./agent-action-conversion-registry";
import {
  calculateActionConversionReadiness,
  evaluateApprovalRequirement,
  redactActionConversionPayload,
  getActionDraftToExecutionMapping,
} from "./agent-action-conversion-validation";
import type {
  AgentActionConversionRecord,
  AgentActionConversionPreflightRecord,
  AgentActionApprovalBridgeRecord,
  AgentActionDraftToExecutionMapping,
  AgentActionConversionRiskLevel,
} from "./agent-action-conversion-types";

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
      sourceType: "agent_controlled_action_conversion_approval_bridge" as never,
      scopeType: "workspace",
      title: args.title,
      actorId: args.actorId ?? null,
    });
  } catch {
    // audit is best-effort
  }
}

// ─── Re-export mapping from validation (authoritative source) ─────────────────

export { getActionDraftToExecutionMapping } from "./agent-action-conversion-validation";

// ─── Risk Level Determination ─────────────────────────────────────────────────

function determineRiskLevel(
  actionType: string,
  reviewItemRiskLevel?: string | null,
): AgentActionConversionRiskLevel {
  if (reviewItemRiskLevel === "critical") return "critical";
  if (reviewItemRiskLevel === "high") return "high";
  if (actionType === "draft_risk_escalation") return "high";
  if (actionType === "draft_email") return "medium";
  if (reviewItemRiskLevel === "medium") return "medium";
  return "low";
}

// ─── createConversionFromActionDraft ──────────────────────────────────────────

export async function createConversionFromActionDraft(input: {
  workspaceId: string;
  actionDraftId: string;
  ownerId?: string | null;
  ownerRole?: string | null;
  actorId?: string | null;
}): Promise<AgentActionConversionRecord> {
  const { getAgentReviewActionDraftById, getAgentReviewItemById, listAgentReviewDecisions } =
    await import("./agent-review-inbox-registry");

  const actionDraft = await getAgentReviewActionDraftById(input.workspaceId, input.actionDraftId);
  if (!actionDraft) throw new Error(`Action draft not found: ${input.actionDraftId}`);
  if (actionDraft.workspaceId !== input.workspaceId) {
    throw new Error("Action draft does not belong to this workspace");
  }
  const nonConvertibleStatuses = ["cancelled", "rejected"];
  if (nonConvertibleStatuses.includes(actionDraft.draftStatus)) {
    throw new Error(`Action draft status '${actionDraft.draftStatus}' is not convertible`);
  }

  let reviewItem = null;
  if (actionDraft.reviewItemId) {
    reviewItem = await getAgentReviewItemById(input.workspaceId, actionDraft.reviewItemId);
  }
  if (!reviewItem) throw new Error("Review item not found for action draft");

  const acceptedStatuses = ["accepted", "action_drafted"];
  if (!acceptedStatuses.includes(reviewItem.itemStatus)) {
    throw new Error(
      `Review item status '${reviewItem.itemStatus}' must be accepted or action_drafted for conversion`,
    );
  }

  // Prevent duplicate active conversion for same action draft
  const existing = await listAgentActionConversions(input.workspaceId, {
    actionDraftId: input.actionDraftId,
  });
  const activeConversion = existing.find(
    (c) => !["cancelled", "blocked"].includes(c.status),
  );
  if (activeConversion) {
    throw new Error(
      `An active conversion already exists for action draft ${input.actionDraftId}: ${activeConversion.id}`,
    );
  }

  const decisions = await listAgentReviewDecisions(input.workspaceId, reviewItem.id);
  const latestDecision = decisions[decisions.length - 1] ?? null;

  const mapping = getActionDraftToExecutionMapping(actionDraft.draftType);
  const riskLevel = determineRiskLevel(actionDraft.draftType, reviewItem.riskLevel);

  const ownerId = input.ownerId ?? reviewItem.assignedTo ?? actionDraft.createdBy ?? null;
  const ownerRole = input.ownerRole ?? reviewItem.assignedTo ?? null;

  const approvalEval = evaluateApprovalRequirement({
    riskLevel,
    actionType: actionDraft.draftType,
    requiresApproval: mapping?.requiresApproval ?? true,
    targetScopeType: mapping?.defaultScopeType ?? null,
    hasExternalSideEffectPotential: false,
    ownerOrRoleKnown: !!(ownerId || ownerRole),
  });

  const record = await createAgentActionConversion({
    workspaceId: input.workspaceId,
    actionDraftId: input.actionDraftId,
    ownerId,
    ownerRole,
    createdBy: input.actorId ?? null,
  });

  const safePayload = redactActionConversionPayload(
    actionDraft.safeDraftPayload ?? null,
  );

  const updated = await updateAgentActionConversionStatus({
    workspaceId: input.workspaceId,
    conversionId: record.id,
    status: "created",
    readiness: "not_ready",
    patch: {
      reviewItemId: reviewItem.id,
      reviewDecisionId: latestDecision?.id ?? null,
      sourceResultId: reviewItem.sourceId ?? null,
      actionType: actionDraft.draftType,
      riskLevel,
      targetScopeType: mapping?.defaultScopeType ?? null,
      approvalRequirement: approvalEval.approvalRequirement,
      safeConversionPayload: safePayload,
    },
  });

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: updated.id,
    actionDraftId: input.actionDraftId,
    eventType: "conversion_created",
    message: `Conversion created for action draft type '${actionDraft.draftType}'`,
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: `Action conversion created for draft type '${actionDraft.draftType}'`,
    eventType: "action_conversion_created",
    actorId: input.actorId,
  });

  return updated;
}

// ─── runActionConversionPreflight ─────────────────────────────────────────────

export async function runActionConversionPreflight(input: {
  workspaceId: string;
  conversionId: string;
  actorId?: string | null;
}): Promise<AgentActionConversionPreflightRecord> {
  const { getAgentReviewActionDraftById, getAgentReviewItemById, listAgentReviewDecisions } =
    await import("./agent-review-inbox-registry");

  const conversion = await getAgentActionConversionById(input.workspaceId, input.conversionId);
  if (!conversion) throw new Error(`Conversion not found: ${input.conversionId}`);

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    actionDraftId: conversion.actionDraftId,
    eventType: "preflight_started",
    message: "Conversion preflight started",
    actorId: input.actorId ?? null,
  });

  const actionDraft = await getAgentReviewActionDraftById(input.workspaceId, conversion.actionDraftId);
  const reviewItem = conversion.reviewItemId
    ? await getAgentReviewItemById(input.workspaceId, conversion.reviewItemId)
    : null;
  const decisions = reviewItem
    ? await listAgentReviewDecisions(input.workspaceId, reviewItem.id)
    : [];

  const mapping = getActionDraftToExecutionMapping(conversion.actionType);
  const safeExecutionModes = ["dry_run", "draft_only", "approval_required"];
  const executionModeSafe = mapping
    ? safeExecutionModes.includes(mapping.executionMode)
    : false;

  const acceptedStatuses = ["accepted", "action_drafted"];
  const convertibleDraftStatuses = ["draft", "ready_for_approval", "approval_requested"];

  const readinessInput = {
    actionDraftExists: !!actionDraft,
    reviewItemExists: !!reviewItem,
    reviewItemAccepted: !!reviewItem && acceptedStatuses.includes(reviewItem.itemStatus),
    reviewDecisionExists: decisions.length > 0,
    actionDraftConvertible: !!actionDraft && convertibleDraftStatuses.includes(actionDraft.draftStatus),
    actionDraftAlreadyConverted: actionDraft?.draftStatus === "converted",
    sourceResultLinked: !!conversion.sourceResultId,
    sourceEvidenceLinked: !!conversion.sourceEvidenceId,
    targetScopeKnown: !!conversion.targetScopeType,
    safePayloadPresent: !!conversion.safeConversionPayload,
    riskLevelKnown: !!conversion.riskLevel,
    ownerOrRoleKnown: !!(conversion.ownerId || conversion.ownerRole),
    toolMappingExists: !!mapping,
    executionModeSafe,
  };

  const result = calculateActionConversionReadiness(readinessInput);

  const approvalEval = evaluateApprovalRequirement({
    riskLevel: conversion.riskLevel,
    actionType: conversion.actionType,
    requiresApproval: mapping?.requiresApproval ?? true,
    targetScopeType: conversion.targetScopeType,
    hasExternalSideEffectPotential: false,
    ownerOrRoleKnown: readinessInput.ownerOrRoleKnown,
  });

  const preflightStatus = result.blockingReasons.length > 0 ? "failed" : "passed";

  const preflight = await createAgentActionConversionPreflight({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    status: preflightStatus,
    readinessScore: result.readinessScore,
    checks: result.checks,
    blockingReasons: result.blockingReasons,
    warnings: result.warnings,
    approvalRequired: approvalEval.approvalRequired,
    approvalRequirement: approvalEval.approvalRequirement,
    createdBy: input.actorId ?? null,
  });

  const newStatus = preflightStatus === "passed" ? "preflight_passed" : "preflight_failed";
  const newReadiness = result.readiness;

  await updateAgentActionConversionStatus({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    status: newStatus,
    readiness: newReadiness,
    blockingReasons: result.blockingReasons,
    warnings: result.warnings,
    patch: { approvalRequirement: approvalEval.approvalRequirement },
  });

  const eventType = preflightStatus === "passed" ? "preflight_passed" : "preflight_failed";
  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    actionDraftId: conversion.actionDraftId,
    eventType,
    message: `Preflight ${preflightStatus}. Score: ${result.readinessScore}`,
    actorId: input.actorId ?? null,
  });

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    actionDraftId: conversion.actionDraftId,
    eventType: "approval_requirement_evaluated",
    message: `Approval requirement: ${approvalEval.approvalRequirement}`,
    eventPayload: { approvalRequired: approvalEval.approvalRequired, approvalRequirement: approvalEval.approvalRequirement },
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: `Action conversion preflight ${preflightStatus}`,
    eventType: preflightStatus === "passed"
      ? "action_conversion_preflight_passed"
      : "action_conversion_preflight_failed",
    actorId: input.actorId,
  });

  return preflight;
}

// ─── evaluateActionApprovalBridge ─────────────────────────────────────────────

export async function evaluateActionApprovalBridge(input: {
  workspaceId: string;
  conversionId: string;
  actorId?: string | null;
}): Promise<AgentActionApprovalBridgeRecord | null> {
  let conversion = await getAgentActionConversionById(input.workspaceId, input.conversionId);
  if (!conversion) throw new Error(`Conversion not found: ${input.conversionId}`);

  let preflight = await getLatestAgentActionConversionPreflight(
    input.workspaceId,
    input.conversionId,
  );
  if (!preflight) {
    preflight = await runActionConversionPreflight({
      workspaceId: input.workspaceId,
      conversionId: input.conversionId,
      actorId: input.actorId,
    });
  }

  conversion = await getAgentActionConversionById(input.workspaceId, input.conversionId);
  if (!conversion) throw new Error("Conversion disappeared after preflight");

  if (!preflight.approvalRequired) {
    await updateAgentActionConversionStatus({
      workspaceId: input.workspaceId,
      conversionId: input.conversionId,
      status: "approval_not_required",
      readiness: conversion.readiness === "blocked" ? "blocked" : "ready",
    });
    await recordAgentActionConversionEvent({
      workspaceId: input.workspaceId,
      conversionId: input.conversionId,
      actionDraftId: conversion.actionDraftId,
      eventType: "approval_not_required",
      message: "Approval is not required for this conversion",
      actorId: input.actorId ?? null,
    });
    await tryAuditEvent({
      workspaceId: input.workspaceId,
      title: "Action conversion approval not required",
      eventType: "action_conversion_approval_not_required",
      actorId: input.actorId,
    });
    return null;
  }

  const existingBridge = await getAgentActionApprovalBridgeByConversionId(
    input.workspaceId,
    input.conversionId,
  );
  if (existingBridge) return existingBridge;

  const requiredApproverRole = preflight.approvalRequirement === "required_critical_risk"
    ? "executive"
    : preflight.approvalRequirement === "required_high_risk"
    ? "pmo_lead"
    : "project_manager";

  const policyKey = `${conversion.actionType}_${conversion.riskLevel}_approval`;

  const bridge = await createAgentActionApprovalBridge({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    approvalRequirement: preflight.approvalRequirement,
    approvalPolicyKey: policyKey,
    requiredApproverRole,
    approvalReason: `Action type '${conversion.actionType}' with risk level '${conversion.riskLevel}' requires approval`,
    riskJustification: `Risk level determined to be ${conversion.riskLevel} based on action type and context`,
    createdBy: input.actorId ?? null,
  });

  await updateAgentActionConversionStatus({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    status: "approval_required",
    readiness: "requires_approval",
    patch: { approvalBridgeId: bridge.id },
  });

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    actionDraftId: conversion.actionDraftId,
    approvalBridgeId: bridge.id,
    eventType: "approval_bridge_created",
    message: `Approval bridge created. Required approver role: ${requiredApproverRole}`,
    actorId: input.actorId ?? null,
  });

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    actionDraftId: conversion.actionDraftId,
    approvalBridgeId: bridge.id,
    eventType: "approval_required",
    message: `Approval required: ${preflight.approvalRequirement}`,
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: "Action conversion approval bridge created",
    eventType: "action_conversion_approval_bridge_created",
    actorId: input.actorId,
  });

  return bridge;
}

// ─── markApprovalBridgeSatisfied ──────────────────────────────────────────────

export async function markApprovalBridgeSatisfied(input: {
  workspaceId: string;
  approvalBridgeId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentActionApprovalBridgeRecord> {
  const bridge = await getAgentActionApprovalBridgeById(
    input.workspaceId,
    input.approvalBridgeId,
  );
  if (!bridge) throw new Error(`Approval bridge not found: ${input.approvalBridgeId}`);

  const updatedBridge = await updateAgentActionApprovalBridgeStatus({
    workspaceId: input.workspaceId,
    approvalBridgeId: input.approvalBridgeId,
    status: "satisfied",
    actorId: input.actorId,
    message: input.message,
  });

  await updateAgentActionConversionStatus({
    workspaceId: input.workspaceId,
    conversionId: bridge.conversionId,
    status: "approval_satisfied",
    readiness: "ready",
  });

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: bridge.conversionId,
    actionDraftId: bridge.actionDraftId,
    approvalBridgeId: input.approvalBridgeId,
    eventType: "approval_satisfied",
    message: input.message ?? "Approval bridge marked as satisfied",
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: "Action conversion approval satisfied",
    eventType: "action_conversion_approval_satisfied",
    actorId: input.actorId,
  });

  return updatedBridge;
}

// ─── createExecutionRequestFromActionDraft ────────────────────────────────────

export async function createExecutionRequestFromActionDraft(input: {
  workspaceId: string;
  conversionId: string;
  actorId?: string | null;
}): Promise<AgentActionConversionRecord> {
  let conversion = await getAgentActionConversionById(input.workspaceId, input.conversionId);
  if (!conversion) throw new Error(`Conversion not found: ${input.conversionId}`);

  let preflight = await getLatestAgentActionConversionPreflight(
    input.workspaceId,
    input.conversionId,
  );
  if (!preflight) {
    preflight = await runActionConversionPreflight({
      workspaceId: input.workspaceId,
      conversionId: input.conversionId,
      actorId: input.actorId,
    });
  }

  if (preflight.status === "failed") {
    await updateAgentActionConversionStatus({
      workspaceId: input.workspaceId,
      conversionId: input.conversionId,
      status: "blocked",
      readiness: "blocked",
      blockingReasons: preflight.blockingReasons,
    });
    await recordAgentActionConversionEvent({
      workspaceId: input.workspaceId,
      conversionId: input.conversionId,
      actionDraftId: conversion.actionDraftId,
      eventType: "conversion_blocked",
      message: "Conversion blocked due to failed preflight",
      actorId: input.actorId ?? null,
    });
    throw new Error(
      `Conversion blocked: preflight failed. Reasons: ${preflight.blockingReasons.join("; ")}`,
    );
  }

  if (preflight.approvalRequired) {
    const bridge = await getAgentActionApprovalBridgeByConversionId(
      input.workspaceId,
      input.conversionId,
    );
    if (!bridge || bridge.status !== "satisfied") {
      const reason = !bridge
        ? "Approval bridge has not been created"
        : `Approval bridge status is '${bridge.status}', must be 'satisfied'`;
      throw new Error(`Conversion blocked: approval required but not satisfied. ${reason}`);
    }
  }

  const mapping = getActionDraftToExecutionMapping(conversion.actionType);
  if (!mapping) {
    throw new Error(`No tool mapping found for action type: ${conversion.actionType}`);
  }

  const safeExecutionModes = ["dry_run", "draft_only", "approval_required"];
  if (!safeExecutionModes.includes(mapping.executionMode)) {
    throw new Error(`Unsafe execution mode: ${mapping.executionMode}`);
  }

  // Reload conversion after potential status updates above
  conversion = (await getAgentActionConversionById(input.workspaceId, input.conversionId))!;

  // Build execution request using existing runtime
  // NOTE: The execution registry uses Supabase; in test environments this will
  // fail gracefully. The conversion record still captures the intent.
  let executionRequestId: string | null = null;
  try {
    const { createAgentExecutionRequest } = await import("./agent-execution-registry");
    const execRequest = await createAgentExecutionRequest({
      workspaceId: input.workspaceId,
      toolKey: mapping.toolKey,
      executionMode: mapping.executionMode,
      scopeType: (conversion.targetScopeType ?? "workspace") as never,
      scopeId: conversion.targetScopeId ?? undefined,
      riskLevel: conversion.riskLevel as never,
      sourceType: "agent",
      title: `Controlled execution request from action draft conversion ${input.conversionId}`,
      description: `Auto-generated governed execution request. Action type: ${conversion.actionType}. Conversion: ${input.conversionId}.`,
      inputPayload: {
        conversionId: input.conversionId,
        actionDraftId: conversion.actionDraftId,
        reviewItemId: conversion.reviewItemId,
        reviewDecisionId: conversion.reviewDecisionId,
        sourceResultId: conversion.sourceResultId,
        sourceEvidenceId: conversion.sourceEvidenceId,
        approvalBridgeId: conversion.approvalBridgeId,
      },
      requestedBy: input.actorId ?? undefined,
    });
    executionRequestId = execRequest.id;
  } catch {
    // Execution registry may not be available in test/dry-run contexts.
    // Document limitation: execution request creation requires Supabase connection.
    // The conversion record is still updated to reflect intent.
  }

  if (!executionRequestId) {
    const blockedConversion = await updateAgentActionConversionStatus({
      workspaceId: input.workspaceId,
      conversionId: input.conversionId,
      status: "blocked",
      readiness: "not_ready",
      blockingReasons: ["execution_request_creation_failed"],
      patch: {
        executionRequestId: null,
        executionRequestCreationStatus: "failed",
      },
    });

    await recordAgentActionConversionEvent({
      workspaceId: input.workspaceId,
      conversionId: input.conversionId,
      actionDraftId: conversion.actionDraftId,
      executionRequestId: null,
      eventType: "conversion_blocked",
      message: "Execution request creation failed; conversion is blocked and requires remediation",
      actorId: input.actorId ?? null,
    });

    await tryAuditEvent({
      workspaceId: input.workspaceId,
      title: "Action conversion blocked — execution request creation failed",
      eventType: "action_conversion_blocked",
      actorId: input.actorId,
    });

    return blockedConversion;
  }

  const updatedConversion = await updateAgentActionConversionStatus({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    status: "execution_request_created",
    readiness: "converted",
    patch: {
      executionRequestId,
      executionRequestCreationStatus: "created",
    },
  });

  // Update action draft status to converted if registry supports it
  try {
    const { updateAgentReviewActionDraftStatus } = await import("./agent-review-inbox-registry");
    await updateAgentReviewActionDraftStatus({
      workspaceId: input.workspaceId,
      actionDraftId: conversion.actionDraftId,
      draftStatus: "converted",
    });
  } catch {
    // Safe update is best-effort if registry doesn't support this status transition
  }

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    actionDraftId: conversion.actionDraftId,
    executionRequestId,
    eventType: "execution_request_created",
    message: `Governed execution request created: ${executionRequestId}`,
    actorId: input.actorId ?? null,
  });

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    actionDraftId: conversion.actionDraftId,
    executionRequestId,
    eventType: "conversion_completed",
    message: "Controlled action conversion completed",
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: "Action conversion execution request created",
    eventType: "action_conversion_execution_request_created",
    actorId: input.actorId,
  });

  return updatedConversion;
}

// ─── cancelActionConversion ───────────────────────────────────────────────────

export async function cancelActionConversion(input: {
  workspaceId: string;
  conversionId: string;
  actorId?: string | null;
  message?: string | null;
}): Promise<AgentActionConversionRecord> {
  const conversion = await getAgentActionConversionById(input.workspaceId, input.conversionId);
  if (!conversion) throw new Error(`Conversion not found: ${input.conversionId}`);

  const terminalStatuses = ["execution_request_created", "completed"];
  if (terminalStatuses.includes(conversion.status)) {
    // Do not cancel terminal conversions per convention
    return conversion;
  }

  const updated = await updateAgentActionConversionStatus({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    status: "cancelled",
    readiness: "blocked",
  });

  await recordAgentActionConversionEvent({
    workspaceId: input.workspaceId,
    conversionId: input.conversionId,
    actionDraftId: conversion.actionDraftId,
    eventType: "conversion_cancelled",
    message: input.message ?? "Conversion cancelled",
    actorId: input.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: input.workspaceId,
    title: "Action conversion cancelled",
    eventType: "action_conversion_cancelled",
    actorId: input.actorId,
  });

  return updated;
}

// ─── buildActionConversionSummary ─────────────────────────────────────────────

export async function buildActionConversionSummary(input: {
  workspaceId: string;
  ownerId?: string;
  ownerRole?: string;
}): Promise<Record<string, unknown>> {
  const all = await listAgentActionConversions(input.workspaceId);

  const count = (status: string) => all.filter((c) => c.status === status).length;
  const readinessCount = (r: string) => all.filter((c) => c.readiness === r).length;
  const riskCount = (l: string) => all.filter((c) => c.riskLevel === l).length;

  const ownedByUser = input.ownerId
    ? all.filter((c) => c.ownerId === input.ownerId).length
    : undefined;
  const ownedByRole = input.ownerRole
    ? all.filter((c) => c.ownerRole === input.ownerRole).length
    : undefined;

  const pending = all
    .filter((c) => !["cancelled", "blocked", "execution_request_created", "completed"].includes(c.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    total: all.length,
    created: count("created"),
    preflightPending: count("preflight_pending"),
    preflightPassed: count("preflight_passed"),
    preflightFailed: count("preflight_failed"),
    approvalRequired: count("approval_required"),
    approvalPending: count("approval_pending"),
    approvalSatisfied: count("approval_satisfied"),
    executionRequestCreated: count("execution_request_created"),
    blocked: count("blocked") + readinessCount("blocked"),
    cancelled: count("cancelled"),
    completed: count("completed"),
    highRisk: riskCount("high"),
    criticalRisk: riskCount("critical"),
    ownedByUser,
    ownedByRole,
    oldestPendingConversion: pending[0] ?? null,
  };
}
