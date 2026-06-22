import { createPlatformEvent } from "@/lib/platform-events";
import {
  dbCreateGovernanceSignal,
  dbCreateSignalEvidence,
  dbFindGovernanceSignalById,
  dbListGovernanceSignals,
  dbListActiveSignalsByWorkspace,
  dbUpdateGovernanceSignalStatus,
} from "./governance-signal-repository";
import { detectGovernanceSignals } from "./detection-engine";
import { generateSignalRecommendations } from "./recommendation-engine";
import { correlateSignals } from "./correlation-engine";
import { calculateGovernanceHealth } from "./health-engine";
import type {
  GovernanceSignalResult,
  GovernanceSignalRow,
  GovernanceSignalEventType,
  DetectSignalInput,
  AcknowledgeSignalInput,
  ResolveSignalInput,
  DismissSignalInput,
  ListSignalsInput,
  DetectGovernanceSignalsInput,
  SignalCorrelation,
  GovernanceHealthScore,
  DetectionSummary,
  GovernanceSignalType,
} from "./types";
import { GOVERNANCE_SIGNAL_TYPES, GOVERNANCE_SIGNAL_SEVERITIES, GOVERNANCE_SIGNAL_STATUSES, GOVERNANCE_SIGNAL_SOURCES } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): GovernanceSignalResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitSignalEvent(
  signal: GovernanceSignalRow,
  eventType: GovernanceSignalEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>,
  actorType: "user" | "system" = "system"
): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  const event = await createPlatformEvent({
    workspaceId: signal.workspace_id,
    actorId,
    actorType,
    eventType,
    eventCategory: "governance",
    source: actorType === "user" ? "user_action" : "system",
    correlationId: signal.id,
    causationId: null,
    rawReferenceTable: "governance_signals",
    rawReferenceId: signal.id,
    learningEligible: true,
    eventPayload: {
      signalId: signal.id,
      signalType: signal.signal_type,
      severity: signal.severity,
      status: signal.status,
      confidenceScore: signal.confidence_score,
      ...extraPayload,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: signal };
}

// ─── detectSignal ─────────────────────────────────────────────────────────────

export async function detectSignal(
  input: DetectSignalInput
): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  if (!validUuid(input.workspaceId))     return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId))         return validation("actorId must be a UUID.");
  if (!validUuid(input.sourceEntityId))  return validation("sourceEntityId must be a UUID.");
  if (!GOVERNANCE_SIGNAL_TYPES.includes(input.signalType)) {
    return validation(`signalType must be one of: ${GOVERNANCE_SIGNAL_TYPES.join(", ")}.`);
  }
  if (!GOVERNANCE_SIGNAL_SOURCES.includes(input.signalSource)) {
    return validation(`signalSource must be one of: ${GOVERNANCE_SIGNAL_SOURCES.join(", ")}.`);
  }
  if (!GOVERNANCE_SIGNAL_SEVERITIES.includes(input.severity)) {
    return validation(`severity must be one of: ${GOVERNANCE_SIGNAL_SEVERITIES.join(", ")}.`);
  }
  if (!required(input.sourceEntityType)) return validation("sourceEntityType is required.");
  if (!required(input.title))            return validation("title is required.");
  if (input.title.trim().length > 300)   return validation("title must be 300 characters or fewer.");
  if (!required(input.description))      return validation("description is required.");
  if (
    typeof input.confidenceScore !== "number" ||
    input.confidenceScore < 0 ||
    input.confidenceScore > 1
  ) {
    return validation("confidenceScore must be a number between 0.0 and 1.0.");
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    return validation("At least one evidence item is required (Rule 2).");
  }

  // Create signal
  const signalResult = await dbCreateGovernanceSignal({
    workspaceId: input.workspaceId,
    signalType: input.signalType,
    signalSource: input.signalSource,
    sourceEntityType: input.sourceEntityType.trim(),
    sourceEntityId: input.sourceEntityId,
    title: input.title.trim(),
    description: input.description.trim(),
    severity: input.severity,
    confidenceScore: input.confidenceScore,
  });
  if (!signalResult.ok) return signalResult;

  const signal = signalResult.data;

  // Persist evidence
  for (const ev of input.evidence) {
    if (!validUuid(ev.referenceEntityId)) continue;
    await dbCreateSignalEvidence({
      workspaceId: input.workspaceId,
      signalId: signal.id,
      evidenceType: ev.evidenceType,
      referenceEntityType: ev.referenceEntityType,
      referenceEntityId: ev.referenceEntityId,
      contributionWeight: Math.min(1.0, Math.max(0.0, ev.contributionWeight)),
    });
  }

  // Associate recommendations
  await generateSignalRecommendations({
    workspaceId: input.workspaceId,
    signalId: signal.id,
    signalType: input.signalType,
  });

  return emitSignalEvent(signal, "GOVERNANCE_SIGNAL_DETECTED", input.actorId, {
    sourceEntityType: signal.source_entity_type,
    sourceEntityId: signal.source_entity_id,
    evidenceCount: input.evidence.length,
  });
}

// ─── acknowledgeSignal ────────────────────────────────────────────────────────

export async function acknowledgeSignal(
  input: AcknowledgeSignalInput
): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  if (!validUuid(input.signalId))     return validation("signalId must be a UUID.");
  if (!validUuid(input.workspaceId))  return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId))      return validation("actorId must be a UUID.");

  const current = await dbFindGovernanceSignalById(input.signalId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status !== "active") {
    return validation(`Signal can only be acknowledged from 'active' status (current: ${current.data.status}).`);
  }

  const result = await dbUpdateGovernanceSignalStatus(input.signalId, input.workspaceId, {
    status: "acknowledged",
    acknowledged_at: new Date().toISOString(),
    acknowledged_by: input.actorId,
  });
  if (!result.ok) return result;

  return emitSignalEvent(result.data, "GOVERNANCE_SIGNAL_ACKNOWLEDGED", input.actorId, undefined, "user");
}

// ─── resolveSignal ────────────────────────────────────────────────────────────

export async function resolveSignal(
  input: ResolveSignalInput
): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  if (!validUuid(input.signalId))    return validation("signalId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const current = await dbFindGovernanceSignalById(input.signalId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status === "resolved" || current.data.status === "dismissed") {
    return validation(`Signal is already ${current.data.status}.`);
  }

  const result = await dbUpdateGovernanceSignalStatus(input.signalId, input.workspaceId, {
    status: "resolved",
    resolved_at: new Date().toISOString(),
    resolved_by: input.actorId,
  });
  if (!result.ok) return result;

  return emitSignalEvent(result.data, "GOVERNANCE_SIGNAL_RESOLVED", input.actorId, undefined, "user");
}

// ─── dismissSignal ────────────────────────────────────────────────────────────

export async function dismissSignal(
  input: DismissSignalInput
): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  if (!validUuid(input.signalId))    return validation("signalId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");
  if (!required(input.dismissedReason)) return validation("dismissedReason is required for audit trail.");

  const current = await dbFindGovernanceSignalById(input.signalId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.status === "resolved" || current.data.status === "dismissed") {
    return validation(`Signal is already ${current.data.status}.`);
  }

  const result = await dbUpdateGovernanceSignalStatus(input.signalId, input.workspaceId, {
    status: "dismissed",
    dismissed_at: new Date().toISOString(),
    dismissed_by: input.actorId,
    dismissed_reason: input.dismissedReason.trim(),
  });
  if (!result.ok) return result;

  return emitSignalEvent(result.data, "GOVERNANCE_SIGNAL_DISMISSED", input.actorId, {
    dismissedReason: input.dismissedReason.trim(),
  }, "user");
}

// ─── getSignal ────────────────────────────────────────────────────────────────

export async function getSignal(
  signalId: string,
  workspaceId: string
): Promise<GovernanceSignalResult<GovernanceSignalRow>> {
  if (!validUuid(signalId))    return validation("signalId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  return dbFindGovernanceSignalById(signalId, workspaceId);
}

// ─── listSignals ──────────────────────────────────────────────────────────────

export async function listSignals(
  input: ListSignalsInput
): Promise<GovernanceSignalResult<GovernanceSignalRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.severity && !GOVERNANCE_SIGNAL_SEVERITIES.includes(input.severity)) {
    return validation(`severity must be one of: ${GOVERNANCE_SIGNAL_SEVERITIES.join(", ")}.`);
  }
  if (input.status && !GOVERNANCE_SIGNAL_STATUSES.includes(input.status)) {
    return validation(`status must be one of: ${GOVERNANCE_SIGNAL_STATUSES.join(", ")}.`);
  }
  if (input.signalType && !GOVERNANCE_SIGNAL_TYPES.includes(input.signalType)) {
    return validation(`signalType must be one of: ${GOVERNANCE_SIGNAL_TYPES.join(", ")}.`);
  }
  if (input.source && !GOVERNANCE_SIGNAL_SOURCES.includes(input.source)) {
    return validation(`source must be one of: ${GOVERNANCE_SIGNAL_SOURCES.join(", ")}.`);
  }
  return dbListGovernanceSignals(input);
}

// ─── detectGovernanceSignalsForWorkspace ──────────────────────────────────────

export async function detectGovernanceSignalsForWorkspace(
  input: DetectGovernanceSignalsInput
): Promise<GovernanceSignalResult<DetectionSummary>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const candidates = await detectGovernanceSignals(input.workspaceId);

  const signalsByType: Record<GovernanceSignalType, number> = {
    approval_delay: 0,
    authority_gap: 0,
    escalation_gap: 0,
    decision_bottleneck: 0,
    amendment_backlog: 0,
    ratification_stall: 0,
    risk_accumulation: 0,
    recommendation_ignored: 0,
    governance_violation: 0,
    delivery_drift: 0,
  };

  let signalsDetected = 0;

  for (const candidate of candidates) {
    const result = await detectSignal({
      workspaceId: input.workspaceId,
      signalType: candidate.signalType,
      signalSource: candidate.signalSource,
      sourceEntityType: candidate.sourceEntityType,
      sourceEntityId: candidate.sourceEntityId,
      title: candidate.title,
      description: candidate.description,
      severity: candidate.severity,
      confidenceScore: candidate.confidenceScore,
      evidence: candidate.evidence,
      actorId: input.actorId,
    });

    if (result.ok) {
      signalsByType[candidate.signalType] = (signalsByType[candidate.signalType] ?? 0) + 1;
      signalsDetected++;
    }
  }

  return {
    ok: true,
    data: {
      workspaceId: input.workspaceId,
      signalsDetected,
      signalsByType,
      detectedAt: new Date().toISOString(),
    },
  };
}

// ─── correlateWorkspaceSignals ────────────────────────────────────────────────

export async function correlateWorkspaceSignals(
  workspaceId: string,
  actorId: string
): Promise<GovernanceSignalResult<SignalCorrelation[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId))     return validation("actorId must be a UUID.");

  const signalsResult = await dbListActiveSignalsByWorkspace(workspaceId);
  if (!signalsResult.ok) return signalsResult;

  const correlations = correlateSignals(signalsResult.data);

  if (correlations.length > 0) {
    await createPlatformEvent({
      workspaceId,
      actorId,
      actorType: "system",
      eventType: "GOVERNANCE_SIGNAL_CORRELATED",
      eventCategory: "governance",
      source: "system",
      learningEligible: true,
      eventPayload: {
        correlationCount: correlations.length,
        activeSignalCount: signalsResult.data.length,
      },
    });
  }

  return { ok: true, data: correlations };
}

// ─── getGovernanceHealth ──────────────────────────────────────────────────────

export async function getGovernanceHealth(
  workspaceId: string,
  actorId: string
): Promise<GovernanceSignalResult<GovernanceHealthScore>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId))     return validation("actorId must be a UUID.");

  const signalsResult = await dbListGovernanceSignals({ workspaceId });
  if (!signalsResult.ok) return signalsResult;

  const health = calculateGovernanceHealth(workspaceId, signalsResult.data);

  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "system",
    eventType: "GOVERNANCE_HEALTH_CALCULATED",
    eventCategory: "governance",
    source: "system",
    learningEligible: true,
    eventPayload: {
      score: health.score,
      activeSignals: health.activeSignals,
      criticalSignals: health.criticalSignals,
    },
  });

  return { ok: true, data: health };
}
