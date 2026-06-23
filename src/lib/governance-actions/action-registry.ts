// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Action Registry (Service Layer)
//
// All business logic for the governance action lifecycle lives here.
// Actions are suggested, never executed automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import {
  dbCreateGovernanceAction,
  dbFindGovernanceActionById,
  dbListGovernanceActions,
  dbUpdateGovernanceAction,
  dbCreateActionEvidence,
  dbListActionEvidence,
  dbCreateActionAssignment,
  dbListActionAssignments,
  dbCountGeneratedActionsForSignal,
} from "./governance-action-repository";
import { generateActionsForSignalType } from "./generation-engine";
import { getActionLineage } from "./lineage";
import type {
  GovernanceActionResult,
  GovernanceActionRow,
  GovernanceActionEvidenceRow,
  GovernanceActionAssignmentRow,
  GovernanceActionEventType,
  GenerateActionInput,
  GenerateActionsForSignalInput,
  AssignActionInput,
  ApproveActionInput,
  RejectActionInput,
  CompleteActionInput,
  ExpireActionInput,
  GetActionInput,
  ListActionsInput,
  GenerateGovernanceActionsInput,
  ActionWithEvidence,
  ActionLineage,
  GenerateActionsResult,
} from "./types";
import type { GovernanceSignalType } from "@/lib/governance-signals/types";
import { dbListActiveSignalsByWorkspace } from "@/lib/governance-signals/governance-signal-repository";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): GovernanceActionResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitActionEvent(
  action: GovernanceActionRow,
  eventType: GovernanceActionEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId:       action.workspace_id,
    actorId,
    actorType:         "system",
    eventType,
    eventCategory:     "governance",
    source:            "system",
    correlationId:     action.signal_id,
    causationId:       action.id,
    rawReferenceTable: "governance_actions",
    rawReferenceId:    action.id,
    learningEligible:  true,
    eventPayload: {
      action_id:       action.id,
      signal_id:       action.signal_id,
      action_type:     action.action_type,
      action_priority: action.action_priority,
      action_status:   action.action_status,
      ...extraPayload,
    },
  });
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export async function generateAction(
  input: GenerateActionInput
): Promise<GovernanceActionResult<GovernanceActionRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.signalId))    return validation("Invalid signalId.");
  if (!required(input.title))        return validation("title is required.");
  if (!required(input.description))  return validation("description is required.");
  if (!required(input.justification)) return validation("justification is required.");
  if (!required(input.recommendedOwnerType)) return validation("recommendedOwnerType is required.");
  if (input.confidenceScore < 0 || input.confidenceScore > 1)
    return validation("confidenceScore must be between 0 and 1.");

  const result = await dbCreateGovernanceAction({
    workspaceId:           input.workspaceId,
    signalId:              input.signalId,
    actionType:            input.actionType,
    actionPriority:        input.actionPriority,
    title:                 input.title,
    description:           input.description,
    recommendedOwnerType:  input.recommendedOwnerType,
    recommendedOwnerId:    input.recommendedOwnerId ?? null,
    recommendedDueDate:    input.recommendedDueDate,
    justification:         input.justification,
    confidenceScore:       input.confidenceScore,
  });
  if (!result.ok) return result;

  await dbCreateActionEvidence({
    workspaceId:        input.workspaceId,
    actionId:           result.data.id,
    signalId:           input.signalId,
    contributionWeight: 1.0,
  });

  await emitActionEvent(result.data, "GOVERNANCE_ACTION_GENERATED", input.actorId, {
    confidence_score: input.confidenceScore,
    priority:         input.actionPriority,
  });
  await emitActionEvent(result.data, "GOVERNANCE_ACTION_CONFIDENCE_CALCULATED", input.actorId, {
    confidence_score: input.confidenceScore,
  });
  await emitActionEvent(result.data, "GOVERNANCE_ACTION_PRIORITY_CALCULATED", input.actorId, {
    priority: input.actionPriority,
  });

  return result;
}

export async function generateActionsForSignal(
  input: GenerateActionsForSignalInput
): Promise<GovernanceActionResult<GovernanceActionRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.signalId))    return validation("Invalid signalId.");

  const existingCount = await dbCountGeneratedActionsForSignal(
    input.workspaceId,
    input.signalId
  );
  if (existingCount > 0) {
    // Idempotent: already has active actions for this signal
    const listed = await dbListGovernanceActions({
      workspaceId: input.workspaceId,
      signalId:    input.signalId,
    });
    return listed;
  }

  const candidates = generateActionsForSignalType({
    signalType:      input.signalType as GovernanceSignalType,
    signalTitle:     input.signalId,
    signalSeverity:  input.signalSeverity,
    confidenceScore: input.confidenceScore,
  });

  if (candidates.length === 0) {
    return { ok: true, data: [] };
  }

  const created: GovernanceActionRow[] = [];
  for (const candidate of candidates) {
    const r = await generateAction({
      workspaceId:           input.workspaceId,
      signalId:              input.signalId,
      actionType:            candidate.actionType,
      title:                 candidate.title,
      description:           candidate.description,
      recommendedOwnerType:  candidate.recommendedOwnerType,
      justification:         candidate.justification,
      confidenceScore:       candidate.confidenceScore,
      actionPriority:        candidate.actionPriority,
      recommendedDueDate:    candidate.recommendedDueDate,
      actorId:               input.actorId,
    });
    if (r.ok) created.push(r.data);
  }

  return { ok: true, data: created };
}

export async function assignAction(
  input: AssignActionInput
): Promise<GovernanceActionResult<GovernanceActionAssignmentRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.actionId))    return validation("Invalid actionId.");
  if (!validUuid(input.assignedTo))  return validation("Invalid assignedTo.");

  const actionResult = await dbFindGovernanceActionById(input.actionId, input.workspaceId);
  if (!actionResult.ok) return actionResult as GovernanceActionResult<never>;

  const action = actionResult.data;
  if (action.action_status === "completed" || action.action_status === "expired" || action.action_status === "rejected") {
    return validation(`Cannot assign action with status '${action.action_status}'.`);
  }

  const assignment = await dbCreateActionAssignment({
    workspaceId: input.workspaceId,
    actionId:    input.actionId,
    assignedTo:  input.assignedTo,
  });
  if (!assignment.ok) return assignment;

  if (action.action_status === "generated") {
    await dbUpdateGovernanceAction(input.actionId, input.workspaceId, {
      action_status: "reviewed",
    });
  }

  await emitActionEvent(action, "GOVERNANCE_ACTION_ASSIGNED", input.actorId, {
    assigned_to: input.assignedTo,
  });
  await emitActionEvent(action, "GOVERNANCE_ACTION_AUTHORITY_VALIDATED", input.actorId, {
    assigned_to: input.assignedTo,
  });

  return assignment;
}

export async function approveAction(
  input: ApproveActionInput
): Promise<GovernanceActionResult<GovernanceActionRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.actionId))    return validation("Invalid actionId.");

  const actionResult = await dbFindGovernanceActionById(input.actionId, input.workspaceId);
  if (!actionResult.ok) return actionResult;

  const action = actionResult.data;
  if (action.action_status === "completed" || action.action_status === "expired") {
    return validation(`Cannot approve action with status '${action.action_status}'.`);
  }

  const updated = await dbUpdateGovernanceAction(input.actionId, input.workspaceId, {
    action_status: "approved",
  });
  if (!updated.ok) return updated;

  await emitActionEvent(updated.data, "GOVERNANCE_ACTION_APPROVED", input.actorId);
  return updated;
}

export async function rejectAction(
  input: RejectActionInput
): Promise<GovernanceActionResult<GovernanceActionRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.actionId))    return validation("Invalid actionId.");

  const actionResult = await dbFindGovernanceActionById(input.actionId, input.workspaceId);
  if (!actionResult.ok) return actionResult;

  const action = actionResult.data;
  if (action.action_status === "completed" || action.action_status === "expired") {
    return validation(`Cannot reject action with status '${action.action_status}'.`);
  }

  const updated = await dbUpdateGovernanceAction(input.actionId, input.workspaceId, {
    action_status: "rejected",
  });
  if (!updated.ok) return updated;

  await emitActionEvent(updated.data, "GOVERNANCE_ACTION_REJECTED", input.actorId);
  return updated;
}

export async function completeAction(
  input: CompleteActionInput
): Promise<GovernanceActionResult<GovernanceActionRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.actionId))    return validation("Invalid actionId.");

  const actionResult = await dbFindGovernanceActionById(input.actionId, input.workspaceId);
  if (!actionResult.ok) return actionResult;

  const action = actionResult.data;
  if (action.action_status === "completed") return validation("Action already completed.");
  if (action.action_status === "expired")   return validation("Cannot complete an expired action.");

  const updated = await dbUpdateGovernanceAction(input.actionId, input.workspaceId, {
    action_status: "completed",
    completed_at:  new Date().toISOString(),
  });
  if (!updated.ok) return updated;

  await emitActionEvent(updated.data, "GOVERNANCE_ACTION_COMPLETED", input.actorId);
  return updated;
}

export async function expireAction(
  input: ExpireActionInput
): Promise<GovernanceActionResult<GovernanceActionRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.actionId))    return validation("Invalid actionId.");

  const actionResult = await dbFindGovernanceActionById(input.actionId, input.workspaceId);
  if (!actionResult.ok) return actionResult;

  const action = actionResult.data;
  if (action.action_status === "completed") return validation("Cannot expire a completed action.");
  if (action.action_status === "expired")   return validation("Action already expired.");

  const updated = await dbUpdateGovernanceAction(input.actionId, input.workspaceId, {
    action_status: "expired",
    expired_at:    new Date().toISOString(),
  });
  if (!updated.ok) return updated;

  await emitActionEvent(updated.data, "GOVERNANCE_ACTION_EXPIRED", input.actorId);
  return updated;
}

export async function getAction(
  input: GetActionInput
): Promise<GovernanceActionResult<ActionWithEvidence>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.actionId))    return validation("Invalid actionId.");

  const actionResult = await dbFindGovernanceActionById(input.actionId, input.workspaceId);
  if (!actionResult.ok) return actionResult as GovernanceActionResult<ActionWithEvidence>;

  const evidenceResult     = await dbListActionEvidence(input.actionId, input.workspaceId);
  const assignmentsResult  = await dbListActionAssignments(input.actionId, input.workspaceId);

  return {
    ok: true,
    data: {
      ...actionResult.data,
      evidence:    evidenceResult.ok ? evidenceResult.data : [],
      assignments: assignmentsResult.ok ? assignmentsResult.data : [],
    },
  };
}

export async function listActions(
  input: ListActionsInput
): Promise<GovernanceActionResult<GovernanceActionRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  return dbListGovernanceActions(input);
}

export async function generateGovernanceActions(
  input: GenerateGovernanceActionsInput
): Promise<GovernanceActionResult<GenerateActionsResult>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");

  const signalsResult = await dbListActiveSignalsByWorkspace(input.workspaceId);
  if (!signalsResult.ok) return signalsResult as GovernanceActionResult<GenerateActionsResult>;

  const signals = signalsResult.data;
  let totalGenerated = 0;
  const byType: Partial<Record<import("./types").GovernanceActionType, number>> = {};

  for (const signal of signals) {
    const result = await generateActionsForSignal({
      workspaceId:     input.workspaceId,
      signalId:        signal.id,
      signalType:      signal.signal_type,
      signalSeverity:  signal.severity,
      confidenceScore: signal.confidence_score,
      actorId:         input.actorId,
    });
    if (result.ok) {
      for (const action of result.data) {
        totalGenerated++;
        const t = action.action_type as import("./types").GovernanceActionType;
        byType[t] = (byType[t] ?? 0) + 1;
      }
    }
  }

  return {
    ok: true,
    data: {
      workspaceId:     input.workspaceId,
      actionsGenerated: totalGenerated,
      actionsByType:   byType,
      generatedAt:     new Date().toISOString(),
    },
  };
}

export async function getActionLineageForAction(
  input: GetActionInput & { actorId: string }
): Promise<GovernanceActionResult<ActionLineage>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.actionId))    return validation("Invalid actionId.");

  const actionResult = await dbFindGovernanceActionById(input.actionId, input.workspaceId);
  if (!actionResult.ok) return actionResult as GovernanceActionResult<ActionLineage>;

  const { dbFindGovernanceSignalById } = await import("@/lib/governance-signals/governance-signal-repository");
  const signalResult = await dbFindGovernanceSignalById(
    actionResult.data.signal_id,
    input.workspaceId
  );
  if (!signalResult.ok) return signalResult as GovernanceActionResult<ActionLineage>;

  const lineage = getActionLineage(actionResult.data, signalResult.data);

  await emitActionEvent(actionResult.data, "GOVERNANCE_ACTION_LINEAGE_GENERATED", input.actorId);

  return { ok: true, data: lineage };
}
