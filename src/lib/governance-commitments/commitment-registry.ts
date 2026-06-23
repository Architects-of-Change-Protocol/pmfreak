// ─────────────────────────────────────────────────────────────────────────────
// Governance Commitment Engine — Commitment Registry (Service Layer)
//
// All business logic for the governance commitment lifecycle lives here.
// Commitments are human obligations, never automatic executions.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import {
  dbCreateGovernanceCommitment,
  dbFindGovernanceCommitmentById,
  dbListGovernanceCommitments,
  dbUpdateGovernanceCommitment,
  dbListActiveCommitmentsForBreach,
  dbCreateCommitmentHistory,
  dbListCommitmentHistory,
  dbCreateCommitmentDelegation,
  dbListCommitmentDelegations,
  dbCreateCommitmentEvidence,
  dbListCommitmentEvidence,
} from "./governance-commitment-repository";
import { transitionCommitmentStatus } from "./lifecycle-engine";
import { calculateCommitmentAccountability } from "./accountability-engine";
import { calculateCommitmentHealth } from "./health-engine";
import { detectCommitmentBreaches } from "./breach-engine";
import { validateCommitmentDelegation } from "./delegation-engine";
import { forecastCommitmentOutcome } from "./forecast-engine";
import { getCommitmentLineage } from "./lineage";
import type {
  GovernanceCommitmentResult,
  GovernanceCommitmentRow,
  GovernanceCommitmentHistoryRow,
  GovernanceCommitmentDelegationRow,
  GovernanceCommitmentEvidenceRow,
  GovernanceCommitmentEventType,
  CreateCommitmentInput,
  AcceptCommitmentInput,
  RejectCommitmentInput,
  ActivateCommitmentInput,
  CompleteCommitmentInput,
  CancelCommitmentInput,
  BreachCommitmentInput,
  ExpireCommitmentInput,
  DelegateCommitmentInput,
  GetCommitmentInput,
  ListCommitmentsInput,
  AttachEvidenceInput,
  CommitmentWithDetails,
  CommitmentAccountability,
  CommitmentHealthScore,
  CommitmentBreachReport,
  CommitmentForecast,
  CommitmentLineage,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): GovernanceCommitmentResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitCommitmentEvent(
  commitment: GovernanceCommitmentRow,
  eventType: GovernanceCommitmentEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId:       commitment.workspace_id,
    actorId,
    actorType:         "system",
    eventType,
    eventCategory:     "governance",
    source:            "system",
    correlationId:     commitment.action_id,
    causationId:       commitment.id,
    rawReferenceTable: "governance_commitments",
    rawReferenceId:    commitment.id,
    learningEligible:  true,
    eventPayload: {
      commitment_id: commitment.id,
      action_id:     commitment.action_id,
      owner_id:      commitment.owner_id,
      priority:      commitment.priority,
      status:        commitment.status,
      ...extraPayload,
    },
  });
}

async function recordHistoryAndEmit(
  commitment: GovernanceCommitmentRow,
  previousStatus: string,
  newStatus: string,
  actorId: string,
  eventType: GovernanceCommitmentEventType,
  reason?: string | null,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await dbCreateCommitmentHistory({
    workspaceId:    commitment.workspace_id,
    commitmentId:   commitment.id,
    previousStatus,
    newStatus,
    changedBy:      actorId,
    reason:         reason ?? null,
  });
  await emitCommitmentEvent(commitment, eventType, actorId, extraPayload);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createCommitment(
  input: CreateCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  if (!validUuid(input.workspaceId))   return validation("Invalid workspaceId.");
  if (!validUuid(input.actionId))      return validation("Invalid actionId.");
  if (!validUuid(input.ownerId))       return validation("Invalid ownerId.");
  if (!required(input.commitmentTitle))       return validation("commitmentTitle is required.");
  if (!required(input.commitmentDescription)) return validation("commitmentDescription is required.");
  if (!required(input.ownerType))      return validation("ownerType is required.");
  if (!required(input.dueDate))        return validation("dueDate is required.");

  const result = await dbCreateGovernanceCommitment({
    workspaceId:           input.workspaceId,
    actionId:              input.actionId,
    commitmentTitle:       input.commitmentTitle,
    commitmentDescription: input.commitmentDescription,
    ownerId:               input.ownerId,
    ownerType:             input.ownerType,
    priority:              input.priority,
    dueDate:               input.dueDate,
  });
  if (!result.ok) return result;

  await recordHistoryAndEmit(
    result.data,
    "",
    "pending_acceptance",
    input.actorId,
    "GOVERNANCE_COMMITMENT_CREATED"
  );

  return result;
}

// ─── Accept ───────────────────────────────────────────────────────────────────

export async function acceptCommitment(
  input: AcceptCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  if (!validUuid(input.workspaceId))   return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId))  return validation("Invalid commitmentId.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found;

  const transition = transitionCommitmentStatus(found.data.status, "accepted");
  if (!transition.ok) return validation(transition.error);

  const now = new Date().toISOString();
  const updated = await dbUpdateGovernanceCommitment(input.commitmentId, input.workspaceId, {
    status:      "accepted",
    accepted_at: now,
  });
  if (!updated.ok) return updated;

  await recordHistoryAndEmit(
    updated.data,
    found.data.status,
    "accepted",
    input.actorId,
    "GOVERNANCE_COMMITMENT_ACCEPTED",
    null,
    { accepted_at: now }
  );

  return updated;
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectCommitment(
  input: RejectCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");
  if (!required(input.reason))        return validation("reason is required.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found;

  const transition = transitionCommitmentStatus(found.data.status, "rejected");
  if (!transition.ok) return validation(transition.error);

  const updated = await dbUpdateGovernanceCommitment(input.commitmentId, input.workspaceId, {
    status: "rejected",
  });
  if (!updated.ok) return updated;

  await recordHistoryAndEmit(
    updated.data,
    found.data.status,
    "rejected",
    input.actorId,
    "GOVERNANCE_COMMITMENT_REJECTED",
    input.reason
  );

  return updated;
}

// ─── Activate ─────────────────────────────────────────────────────────────────

export async function activateCommitment(
  input: ActivateCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found;

  const transition = transitionCommitmentStatus(found.data.status, "active");
  if (!transition.ok) return validation(transition.error);

  const now = new Date().toISOString();
  const updated = await dbUpdateGovernanceCommitment(input.commitmentId, input.workspaceId, {
    status:     "active",
    started_at: now,
  });
  if (!updated.ok) return updated;

  await recordHistoryAndEmit(
    updated.data,
    found.data.status,
    "active",
    input.actorId,
    "GOVERNANCE_COMMITMENT_ACTIVATED",
    null,
    { started_at: now }
  );

  return updated;
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export async function completeCommitment(
  input: CompleteCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found;

  const transition = transitionCommitmentStatus(found.data.status, "completed");
  if (!transition.ok) return validation(transition.error);

  const now = new Date().toISOString();
  const updated = await dbUpdateGovernanceCommitment(input.commitmentId, input.workspaceId, {
    status:       "completed",
    completed_at: now,
    outcome:      input.outcome,
  });
  if (!updated.ok) return updated;

  await recordHistoryAndEmit(
    updated.data,
    found.data.status,
    "completed",
    input.actorId,
    "GOVERNANCE_COMMITMENT_COMPLETED",
    null,
    { outcome: input.outcome, completed_at: now }
  );

  return updated;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelCommitment(
  input: CancelCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");
  if (!required(input.reason))        return validation("reason is required.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found;

  const transition = transitionCommitmentStatus(found.data.status, "cancelled");
  if (!transition.ok) return validation(transition.error);

  const now = new Date().toISOString();
  const updated = await dbUpdateGovernanceCommitment(input.commitmentId, input.workspaceId, {
    status:       "cancelled",
    cancelled_at: now,
  });
  if (!updated.ok) return updated;

  await recordHistoryAndEmit(
    updated.data,
    found.data.status,
    "cancelled",
    input.actorId,
    "GOVERNANCE_COMMITMENT_CANCELLED",
    input.reason,
    { cancelled_at: now }
  );

  return updated;
}

// ─── Breach ───────────────────────────────────────────────────────────────────

export async function breachCommitment(
  input: BreachCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");
  if (!required(input.reason))        return validation("reason is required.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found;

  const transition = transitionCommitmentStatus(found.data.status, "breached");
  if (!transition.ok) return validation(transition.error);

  const now = new Date().toISOString();
  const updated = await dbUpdateGovernanceCommitment(input.commitmentId, input.workspaceId, {
    status:     "breached",
    breached_at: now,
  });
  if (!updated.ok) return updated;

  await recordHistoryAndEmit(
    updated.data,
    found.data.status,
    "breached",
    input.actorId,
    "GOVERNANCE_COMMITMENT_BREACHED",
    input.reason,
    { breached_at: now }
  );

  return updated;
}

// ─── Expire ───────────────────────────────────────────────────────────────────

export async function expireCommitment(
  input: ExpireCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found;

  const transition = transitionCommitmentStatus(found.data.status, "expired");
  if (!transition.ok) return validation(transition.error);

  const now = new Date().toISOString();
  const updated = await dbUpdateGovernanceCommitment(input.commitmentId, input.workspaceId, {
    status:     "expired",
    expired_at: now,
  });
  if (!updated.ok) return updated;

  await recordHistoryAndEmit(
    updated.data,
    found.data.status,
    "expired",
    input.actorId,
    "GOVERNANCE_COMMITMENT_EXPIRED",
    null,
    { expired_at: now }
  );

  return updated;
}

// ─── Delegate ─────────────────────────────────────────────────────────────────

export async function delegateCommitment(
  input: DelegateCommitmentInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentDelegationRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");
  if (!validUuid(input.delegatedTo))  return validation("Invalid delegatedTo.");
  if (!required(input.reason))        return validation("reason is required.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found as GovernanceCommitmentResult<GovernanceCommitmentDelegationRow>;

  const existingDelegations = await dbListCommitmentDelegations(input.commitmentId, input.workspaceId);
  const delegations = existingDelegations.ok ? existingDelegations.data : [];

  const validation2 = validateCommitmentDelegation({
    commitment:          found.data,
    delegatedBy:         input.actorId,
    delegatedTo:         input.delegatedTo,
    existingDelegations: delegations,
  });
  if (!validation2.valid) {
    return { ok: false, error: validation2.reason, failureClass: "governance_violation" };
  }

  const transition = transitionCommitmentStatus(found.data.status, "delegated");
  if (!transition.ok) return validation(transition.error);

  const delegation = await dbCreateCommitmentDelegation({
    workspaceId:  input.workspaceId,
    commitmentId: input.commitmentId,
    delegatedBy:  input.actorId,
    delegatedTo:  input.delegatedTo,
    reason:       input.reason,
  });
  if (!delegation.ok) return delegation;

  const updated = await dbUpdateGovernanceCommitment(input.commitmentId, input.workspaceId, {
    status:   "delegated",
    owner_id: input.delegatedTo,
  });

  if (updated.ok) {
    await recordHistoryAndEmit(
      updated.data,
      found.data.status,
      "delegated",
      input.actorId,
      "GOVERNANCE_COMMITMENT_DELEGATED",
      input.reason,
      { delegated_to: input.delegatedTo }
    );
  }

  return delegation;
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getCommitment(
  input: GetCommitmentInput
): Promise<GovernanceCommitmentResult<CommitmentWithDetails>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found as GovernanceCommitmentResult<CommitmentWithDetails>;

  const [historyResult, delegationsResult, evidenceResult] = await Promise.all([
    dbListCommitmentHistory(input.commitmentId, input.workspaceId),
    dbListCommitmentDelegations(input.commitmentId, input.workspaceId),
    dbListCommitmentEvidence(input.commitmentId, input.workspaceId),
  ]);

  return {
    ok: true,
    data: {
      ...found.data,
      history:     historyResult.ok ? historyResult.data : [],
      delegations: delegationsResult.ok ? delegationsResult.data : [],
      evidence:    evidenceResult.ok ? evidenceResult.data : [],
    },
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listCommitments(
  input: ListCommitmentsInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  return dbListGovernanceCommitments(input);
}

// ─── Accountability ───────────────────────────────────────────────────────────

export async function getCommitmentAccountability(
  input: GetCommitmentInput & { actorId: string }
): Promise<GovernanceCommitmentResult<CommitmentAccountability>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found as GovernanceCommitmentResult<CommitmentAccountability>;

  return { ok: true, data: calculateCommitmentAccountability(found.data) };
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getCommitmentHealth(
  workspaceId: string,
  actorId: string
): Promise<GovernanceCommitmentResult<CommitmentHealthScore>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");

  const listed = await dbListGovernanceCommitments({ workspaceId });
  if (!listed.ok) return listed as GovernanceCommitmentResult<CommitmentHealthScore>;

  const score = calculateCommitmentHealth(workspaceId, listed.data);

  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType:         "system",
    eventType:         "GOVERNANCE_COMMITMENT_HEALTH_CALCULATED",
    eventCategory:     "governance",
    source:            "system",
    correlationId:     workspaceId,
    causationId:       workspaceId,
    rawReferenceTable: "governance_commitments",
    rawReferenceId:    null,
    learningEligible:  false,
    eventPayload: {
      workspace_id:   workspaceId,
      score:          score.score,
      total:          score.totalCommitments,
      completed:      score.completed,
      breached:       score.breached,
      overdue:        score.overdue,
      calculated_at:  score.calculatedAt,
    },
  });

  return { ok: true, data: score };
}

// ─── Breach Detection ─────────────────────────────────────────────────────────

export async function detectBreaches(
  workspaceId: string,
  actorId: string
): Promise<GovernanceCommitmentResult<CommitmentBreachReport>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");

  const now = new Date();
  const overdueResult = await dbListActiveCommitmentsForBreach(workspaceId, now.toISOString());
  if (!overdueResult.ok) return overdueResult as GovernanceCommitmentResult<CommitmentBreachReport>;

  const report = detectCommitmentBreaches(workspaceId, overdueResult.data, now);
  return { ok: true, data: report };
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export async function forecastCommitment(
  input: GetCommitmentInput & { actorId: string; signalSeverity?: string; historicalEffectiveness?: number }
): Promise<GovernanceCommitmentResult<CommitmentForecast>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found as GovernanceCommitmentResult<CommitmentForecast>;

  const forecast = forecastCommitmentOutcome(found.data, {
    signalSeverity:          input.signalSeverity,
    historicalEffectiveness: input.historicalEffectiveness,
  });

  await emitCommitmentEvent(found.data, "GOVERNANCE_COMMITMENT_FORECAST_GENERATED", input.actorId, {
    probability_of_completion: forecast.probabilityOfCompletion,
    risk_of_breach:            forecast.riskOfBreach,
    forecasted_at:             forecast.forecastedAt,
  });

  return { ok: true, data: forecast };
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export async function attachCommitmentEvidence(
  input: AttachEvidenceInput
): Promise<GovernanceCommitmentResult<GovernanceCommitmentEvidenceRow>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");
  if (!required(input.description))   return validation("description is required.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found as GovernanceCommitmentResult<GovernanceCommitmentEvidenceRow>;

  return dbCreateCommitmentEvidence({
    workspaceId:     input.workspaceId,
    commitmentId:    input.commitmentId,
    artifactId:      input.artifactId ?? null,
    memoryRecordId:  input.memoryRecordId ?? null,
    description:     input.description,
  });
}

// ─── Lineage ──────────────────────────────────────────────────────────────────

export async function getCommitmentLineageForCommitment(
  input: GetCommitmentInput & { actorId: string }
): Promise<GovernanceCommitmentResult<CommitmentLineage>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.commitmentId)) return validation("Invalid commitmentId.");

  const found = await dbFindGovernanceCommitmentById(input.commitmentId, input.workspaceId);
  if (!found.ok) return found as GovernanceCommitmentResult<CommitmentLineage>;

  const { dbFindGovernanceActionById } = await import("@/lib/governance-actions/governance-action-repository");
  const actionResult = await dbFindGovernanceActionById(found.data.action_id, input.workspaceId);
  if (!actionResult.ok) return actionResult as GovernanceCommitmentResult<CommitmentLineage>;

  const { dbFindGovernanceSignalById } = await import("@/lib/governance-signals/governance-signal-repository");
  const signalResult = await dbFindGovernanceSignalById(
    actionResult.data.signal_id,
    input.workspaceId
  );
  if (!signalResult.ok) return signalResult as GovernanceCommitmentResult<CommitmentLineage>;

  const lineage = getCommitmentLineage(found.data, actionResult.data, signalResult.data);

  await emitCommitmentEvent(found.data, "GOVERNANCE_COMMITMENT_LINEAGE_GENERATED", input.actorId);

  return { ok: true, data: lineage };
}
