// ─────────────────────────────────────────────────────────────────────────────
// Execution Reality Engine — Reality Registry (Service Layer)
//
// All business logic for the execution reality lifecycle lives here.
// Realities are observed records of actual execution — they never modify
// the original projection (Rule 7: reality never modifies history).
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { dbFindExecutionProjectionById } from "@/lib/execution-projections/execution-projection-repository";
import {
  dbListExecutionProjectionTasks,
  dbListExecutionProjectionParticipants,
} from "@/lib/execution-projections/execution-projection-repository";
import {
  dbCreateExecutionReality,
  dbFindExecutionRealityById,
  dbListExecutionRealities,
  dbUpdateExecutionReality,
  dbCreateExecutionObservation,
  dbListExecutionObservations,
  dbCreateExecutionVariance,
  dbListExecutionVariances,
  dbCreateExecutionDrift,
  dbListExecutionDrifts,
} from "./execution-reality-repository";
import { calculateExecutionVariance, calculateVarianceSeverity } from "./variance-engine";
import { detectExecutionDrift } from "./drift-engine";
import { calculateProjectionAccuracy } from "./accuracy-engine";
import { calculateRealityConfidence } from "./confidence-engine";
import { calculateExecutionHealth } from "./health-engine";
import { generateProjectionFeedback, generateRecommendationRealityFeedback } from "./feedback-engine";
import { getExecutionRealityLineage as buildRealityLineage } from "./lineage";
import { explainExecutionReality } from "./explain";
import type {
  ExecutionRealityResult,
  ExecutionRealityRow,
  ExecutionObservationRow,
  ExecutionVarianceRow,
  ExecutionDriftRow,
  ExecutionRealityEventType,
  CreateRealityInput,
  RecordObservationInput,
  ValidateRealityInput,
  CompleteRealityInput,
  ArchiveRealityInput,
  GetRealityInput,
  ListRealitiesInput,
  RealityWithDetails,
  ProjectionAccuracyResult,
  RealityConfidenceResult,
  ExecutionHealthResult,
  ProjectionFeedback,
  RecommendationRealityFeedback,
  RealityLineage,
  RealityExplanation,
  VarianceResult,
  DriftResult,
} from "./types";
import type {
  GovernanceActionRow,
  GovernanceSignalRow,
} from "@/lib/db/database-contract";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(error: string): ExecutionRealityResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

async function emitRealityEvent(
  reality: ExecutionRealityRow,
  eventType: ExecutionRealityEventType,
  actorId: string,
  extraPayload?: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId:       reality.workspace_id,
    actorId,
    actorType:         "system",
    eventType,
    eventCategory:     "governance",
    source:            "system",
    correlationId:     reality.projection_id,
    causationId:       reality.id,
    rawReferenceTable: "execution_realities",
    rawReferenceId:    reality.id,
    learningEligible:  true,
    eventPayload: {
      reality_id:      reality.id,
      projection_id:   reality.projection_id,
      status:          reality.status,
      actual_risk:     reality.actual_risk,
      confidence_score: reality.confidence_score,
      ...extraPayload,
    },
  });
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createExecutionReality(
  input: CreateRealityInput
): Promise<ExecutionRealityResult<RealityWithDetails>> {
  if (!validUuid(input.workspaceId))  return validation("Invalid workspaceId.");
  if (!validUuid(input.projectionId)) return validation("Invalid projectionId.");
  if (!validUuid(input.actorId))      return validation("Invalid actorId.");
  if (!input.realityTitle?.trim())    return validation("realityTitle is required.");
  if (input.actualEffortHours < 0)    return validation("actualEffortHours must be >= 0.");
  if (input.actualDurationDays < 0)   return validation("actualDurationDays must be >= 0.");

  // Rule 1: Reality must originate from a projection
  const projResult = await dbFindExecutionProjectionById(input.projectionId, input.workspaceId);
  if (!projResult.ok) return { ok: false, error: projResult.error, failureClass: projResult.failureClass };

  const projection = projResult.data;
  if (projection.workspace_id !== input.workspaceId) {
    return validation("Projection does not belong to this workspace.");
  }

  // Initial confidence based on zero observations, not yet validated
  const initialConfidence = calculateRealityConfidence({
    observationCount: 0,
    isValidated:      false,
  });

  const realityResult = await dbCreateExecutionReality({
    workspaceId:           input.workspaceId,
    projectionId:          input.projectionId,
    realityTitle:          input.realityTitle,
    realityDescription:    input.realityDescription ?? "",
    actualEffortHours:     input.actualEffortHours,
    actualDurationDays:    input.actualDurationDays,
    actualRisk:            input.actualRisk,
    actualTaskCount:       input.actualTaskCount,
    actualParticipantCount: input.actualParticipantCount,
    confidenceScore:       initialConfidence.score,
  });
  if (!realityResult.ok) return realityResult;

  const reality = realityResult.data;

  await emitRealityEvent(reality, "EXECUTION_REALITY_CREATED", input.actorId, {
    projection_id: projection.id,
    actual_effort: input.actualEffortHours,
    actual_duration: input.actualDurationDays,
  });

  return {
    ok: true,
    data: { ...reality, observations: [], variances: [], drifts: [] },
  };
}

// ─── Record Observation ───────────────────────────────────────────────────────

export async function recordExecutionObservation(
  input: RecordObservationInput
): Promise<ExecutionRealityResult<ExecutionObservationRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.realityId))   return validation("Invalid realityId.");
  if (!validUuid(input.actorId))     return validation("Invalid actorId.");
  if (!input.observationType?.trim()) return validation("observationType is required.");
  if (!input.observationValue?.trim()) return validation("observationValue is required.");

  const found = await dbFindExecutionRealityById(input.realityId, input.workspaceId);
  if (!found.ok) return found;

  if (found.data.status === "archived") {
    return validation("Cannot record observations on an archived reality.");
  }

  const obsResult = await dbCreateExecutionObservation({
    workspaceId:        input.workspaceId,
    realityId:          input.realityId,
    observationType:    input.observationType,
    observationValue:   input.observationValue,
    observationSource:  input.observationSource,
    observedBy:         input.observedBy ?? null,
  });
  if (!obsResult.ok) return obsResult;

  // Update confidence after new observation
  const allObs = await dbListExecutionObservations(input.realityId, input.workspaceId);
  const obsCount = allObs.ok ? allObs.data.length : 1;
  const newConf = calculateRealityConfidence({
    observationCount: obsCount,
    isValidated:      found.data.status === "validated" || found.data.status === "completed",
  });
  await dbUpdateExecutionReality(input.realityId, input.workspaceId, {
    confidence_score: newConf.score,
  });

  await emitRealityEvent(found.data, "EXECUTION_OBSERVATION_RECORDED", input.actorId, {
    observation_type:  input.observationType,
    observation_count: obsCount,
  });

  return obsResult;
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export async function validateExecutionReality(
  input: ValidateRealityInput
): Promise<ExecutionRealityResult<ExecutionRealityRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.realityId))   return validation("Invalid realityId.");

  const found = await dbFindExecutionRealityById(input.realityId, input.workspaceId);
  if (!found.ok) return found;

  if (found.data.status !== "observed") {
    return validation(`Cannot validate a reality with status '${found.data.status}'.`);
  }

  // Rule 2: Reality must have observations before validation
  const obs = await dbListExecutionObservations(input.realityId, input.workspaceId);
  if (!obs.ok || obs.data.length === 0) {
    return validation("Reality has no observations — cannot validate.");
  }

  const newConf = calculateRealityConfidence({
    observationCount: obs.data.length,
    isValidated:      true,
  });

  const updated = await dbUpdateExecutionReality(input.realityId, input.workspaceId, {
    status:          "validated",
    validated_at:    new Date().toISOString(),
    confidence_score: newConf.score,
  });
  if (!updated.ok) return updated;

  await emitRealityEvent(updated.data, "EXECUTION_REALITY_VALIDATED", input.actorId, {
    observation_count: obs.data.length,
    confidence_score:  newConf.score,
  });

  return updated;
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export async function completeExecutionReality(
  input: CompleteRealityInput
): Promise<ExecutionRealityResult<ExecutionRealityRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.realityId))   return validation("Invalid realityId.");

  const found = await dbFindExecutionRealityById(input.realityId, input.workspaceId);
  if (!found.ok) return found;

  if (found.data.status !== "validated") {
    return validation(`Cannot complete a reality with status '${found.data.status}'.`);
  }

  const updated = await dbUpdateExecutionReality(input.realityId, input.workspaceId, {
    status:       "completed",
    completed_at: new Date().toISOString(),
  });
  if (!updated.ok) return updated;

  await emitRealityEvent(updated.data, "EXECUTION_REALITY_COMPLETED", input.actorId);
  return updated;
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveExecutionReality(
  input: ArchiveRealityInput
): Promise<ExecutionRealityResult<ExecutionRealityRow>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.realityId))   return validation("Invalid realityId.");

  const found = await dbFindExecutionRealityById(input.realityId, input.workspaceId);
  if (!found.ok) return found;

  if (found.data.status === "archived") {
    return validation("Reality is already archived.");
  }

  const updated = await dbUpdateExecutionReality(input.realityId, input.workspaceId, {
    status:      "archived",
    archived_at: new Date().toISOString(),
  });
  if (!updated.ok) return updated;

  await emitRealityEvent(updated.data, "EXECUTION_REALITY_ARCHIVED", input.actorId);
  return updated;
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getExecutionReality(
  input: GetRealityInput
): Promise<ExecutionRealityResult<RealityWithDetails>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(input.realityId))   return validation("Invalid realityId.");

  const found = await dbFindExecutionRealityById(input.realityId, input.workspaceId);
  if (!found.ok) return found;

  const [obs, vars, drifts] = await Promise.all([
    dbListExecutionObservations(input.realityId, input.workspaceId),
    dbListExecutionVariances(input.realityId, input.workspaceId),
    dbListExecutionDrifts(input.realityId, input.workspaceId),
  ]);

  return {
    ok: true,
    data: {
      ...found.data,
      observations: obs.ok   ? obs.data   : [],
      variances:    vars.ok  ? vars.data  : [],
      drifts:       drifts.ok ? drifts.data : [],
    },
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listExecutionRealities(
  input: ListRealitiesInput
): Promise<ExecutionRealityResult<ExecutionRealityRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("Invalid workspaceId.");
  return dbListExecutionRealities(input);
}

// ─── Variance Engine ─────────────────────────────────────────────────────────

export async function calculateAndPersistVariances(
  realityId: string,
  workspaceId: string,
  actorId: string
): Promise<ExecutionRealityResult<ExecutionVarianceRow[]>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const projResult = await dbFindExecutionProjectionById(reality.projection_id, workspaceId);
  if (!projResult.ok) return { ok: false, error: projResult.error, failureClass: projResult.failureClass };
  const projection = projResult.data;

  const [tasksResult, partsResult] = await Promise.all([
    dbListExecutionProjectionTasks(projection.id, workspaceId),
    dbListExecutionProjectionParticipants(projection.id, workspaceId),
  ]);

  const projectedTaskCount        = tasksResult.ok  ? tasksResult.data.length  : 0;
  const projectedParticipantCount = partsResult.ok  ? partsResult.data.length  : 0;

  const variances = calculateExecutionVariance(projection, reality, projectedTaskCount, projectedParticipantCount);

  const saved: ExecutionVarianceRow[] = [];
  for (const v of variances) {
    const r = await dbCreateExecutionVariance({
      workspaceId,
      realityId,
      varianceType:       v.varianceType,
      projectedValue:     v.projectedValue,
      actualValue:        v.actualValue,
      variancePercentage: v.variancePercentage,
      severity:           v.severity,
    });
    if (r.ok) saved.push(r.data);
  }

  const worstSeverity = variances.reduce<string>((max, v) => {
    const rank = { low: 0, medium: 1, high: 2, critical: 3 };
    return (rank[v.severity as keyof typeof rank] ?? 0) > (rank[max as keyof typeof rank] ?? 0) ? v.severity : max;
  }, "low");

  await emitRealityEvent(reality, "EXECUTION_VARIANCE_CALCULATED", actorId, {
    variance_count:   variances.length,
    worst_severity:   worstSeverity,
  });

  return { ok: true, data: saved };
}

// ─── Drift Engine ─────────────────────────────────────────────────────────────

export async function detectAndPersistDrifts(
  realityId: string,
  workspaceId: string,
  actorId: string
): Promise<ExecutionRealityResult<ExecutionDriftRow[]>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const projResult = await dbFindExecutionProjectionById(reality.projection_id, workspaceId);
  if (!projResult.ok) return { ok: false, error: projResult.error, failureClass: projResult.failureClass };
  const projection = projResult.data;

  const partsResult = await dbListExecutionProjectionParticipants(projection.id, workspaceId);
  const projectedParticipantCount = partsResult.ok ? partsResult.data.length : 0;

  const drifts = detectExecutionDrift(projection, reality, projectedParticipantCount);

  const saved: ExecutionDriftRow[] = [];
  for (const d of drifts) {
    if (d.severity === "none") continue;
    const r = await dbCreateExecutionDrift({
      workspaceId,
      realityId,
      driftType:   d.driftType,
      severity:    d.severity,
      description: d.description,
    });
    if (r.ok) saved.push(r.data);
  }

  if (saved.length > 0) {
    await emitRealityEvent(reality, "EXECUTION_DRIFT_DETECTED", actorId, {
      drift_count: saved.length,
      drift_types: saved.map(d => d.drift_type),
    });
  }

  return { ok: true, data: saved };
}

// ─── Accuracy ─────────────────────────────────────────────────────────────────

export async function getProjectionAccuracy(
  realityId: string,
  workspaceId: string,
  actorId: string
): Promise<ExecutionRealityResult<ProjectionAccuracyResult>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const projResult = await dbFindExecutionProjectionById(reality.projection_id, workspaceId);
  if (!projResult.ok) return { ok: false, error: projResult.error, failureClass: projResult.failureClass };
  const projection = projResult.data;

  const varsResult = await dbListExecutionVariances(realityId, workspaceId);
  const variances: VarianceResult[] = (varsResult.ok ? varsResult.data : []).map(v => ({
    varianceType:       v.variance_type,
    projectedValue:     v.projected_value,
    actualValue:        v.actual_value,
    variancePercentage: v.variance_percentage,
    severity:           v.severity,
  }));

  const accuracy = calculateProjectionAccuracy(variances, projection.projected_risk, reality.actual_risk);

  await emitRealityEvent(reality, "EXECUTION_ACCURACY_CALCULATED", actorId, {
    accuracy_score: accuracy.score,
  });

  return { ok: true, data: accuracy };
}

// ─── Confidence ───────────────────────────────────────────────────────────────

export async function getRealityConfidence(
  realityId: string,
  workspaceId: string
): Promise<ExecutionRealityResult<RealityConfidenceResult>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const obsResult = await dbListExecutionObservations(realityId, workspaceId);
  const obsCount  = obsResult.ok ? obsResult.data.length : 0;

  const confidence = calculateRealityConfidence({
    observationCount: obsCount,
    isValidated:      reality.status === "validated" || reality.status === "completed",
  });

  return { ok: true, data: confidence };
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getExecutionHealth(
  realityId: string,
  workspaceId: string,
  actorId: string
): Promise<ExecutionRealityResult<ExecutionHealthResult>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const [varsResult, driftsResult, projResult] = await Promise.all([
    dbListExecutionVariances(realityId, workspaceId),
    dbListExecutionDrifts(realityId, workspaceId),
    dbFindExecutionProjectionById(reality.projection_id, workspaceId),
  ]);

  const variances: VarianceResult[] = (varsResult.ok ? varsResult.data : []).map(v => ({
    varianceType:       v.variance_type,
    projectedValue:     v.projected_value,
    actualValue:        v.actual_value,
    variancePercentage: v.variance_percentage,
    severity:           v.severity,
  }));

  const drifts: DriftResult[] = (driftsResult.ok ? driftsResult.data : []).map(d => ({
    driftType:   d.drift_type,
    severity:    d.severity,
    description: d.description,
  }));

  const projRisk    = projResult.ok ? projResult.data.projected_risk : reality.actual_risk;
  const accuracy    = calculateProjectionAccuracy(variances, projRisk, reality.actual_risk);

  const worstSev = variances.reduce<string>((max, v) => {
    const rank = { low: 0, medium: 1, high: 2, critical: 3 };
    return (rank[v.severity as keyof typeof rank] ?? 0) > (rank[max as keyof typeof rank] ?? 0) ? v.severity : max;
  }, "low");

  const health = calculateExecutionHealth({
    worstVarianceSeverity: worstSev as "low" | "medium" | "high" | "critical",
    drifts,
    projectionAccuracy:    accuracy.score,
    riskLevel:             reality.actual_risk,
  });

  await emitRealityEvent(reality, "EXECUTION_HEALTH_CALCULATED", actorId, {
    health_score: health.score,
    drift_count:  drifts.length,
  });

  return { ok: true, data: health };
}

// ─── Learning Feedback ────────────────────────────────────────────────────────

export async function getProjectionFeedback(
  realityId: string,
  workspaceId: string
): Promise<ExecutionRealityResult<ProjectionFeedback>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const projResult = await dbFindExecutionProjectionById(reality.projection_id, workspaceId);
  if (!projResult.ok) return { ok: false, error: projResult.error, failureClass: projResult.failureClass };
  const projection = projResult.data;

  const varsResult = await dbListExecutionVariances(realityId, workspaceId);
  const variances: VarianceResult[] = (varsResult.ok ? varsResult.data : []).map(v => ({
    varianceType:       v.variance_type,
    projectedValue:     v.projected_value,
    actualValue:        v.actual_value,
    variancePercentage: v.variance_percentage,
    severity:           v.severity,
  }));

  const accuracy = calculateProjectionAccuracy(variances, projection.projected_risk, reality.actual_risk);

  const feedback = generateProjectionFeedback({
    projectionId:  projection.id,
    accuracy:      accuracy.score,
    variances,
    projectedRisk: projection.projected_risk as "low" | "medium" | "high" | "critical",
    actualRisk:    reality.actual_risk,
  });

  return { ok: true, data: feedback };
}

// ─── Recommendation Feedback ──────────────────────────────────────────────────

export async function getRecommendationFeedback(
  realityId: string,
  workspaceId: string
): Promise<ExecutionRealityResult<RecommendationRealityFeedback>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const projResult = await dbFindExecutionProjectionById(reality.projection_id, workspaceId);
  if (!projResult.ok) return { ok: false, error: projResult.error, failureClass: projResult.failureClass };
  const projection = projResult.data;

  const feedback = generateRecommendationRealityFeedback({
    projectionId:          projection.id,
    realityId:             reality.id,
    projectedEffortHours:  projection.estimated_effort_hours,
    actualEffortHours:     reality.actual_effort_hours,
    projectedDurationDays: projection.estimated_duration_days,
    actualDurationDays:    reality.actual_duration_days,
  });

  return { ok: true, data: feedback };
}

// ─── Lineage ──────────────────────────────────────────────────────────────────

export async function getRealityLineage(
  realityId: string,
  workspaceId: string,
  actorId: string,
  commitment: Parameters<typeof buildRealityLineage>[2],
  action: GovernanceActionRow,
  signal: GovernanceSignalRow
): Promise<ExecutionRealityResult<RealityLineage>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const projResult = await dbFindExecutionProjectionById(reality.projection_id, workspaceId);
  if (!projResult.ok) return { ok: false, error: projResult.error, failureClass: projResult.failureClass };
  const projection = projResult.data;

  const lineage = buildRealityLineage(reality, projection, commitment, action, signal);

  await emitRealityEvent(reality, "EXECUTION_REALITY_LINEAGE_GENERATED", actorId, {
    chain_length: lineage.chain.length,
  });

  return { ok: true, data: lineage };
}

// ─── Explain ──────────────────────────────────────────────────────────────────

export async function explainReality(
  realityId: string,
  workspaceId: string
): Promise<ExecutionRealityResult<RealityExplanation>> {
  if (!validUuid(workspaceId)) return validation("Invalid workspaceId.");
  if (!validUuid(realityId))   return validation("Invalid realityId.");

  const realityResult = await dbFindExecutionRealityById(realityId, workspaceId);
  if (!realityResult.ok) return realityResult;
  const reality = realityResult.data;

  const projResult = await dbFindExecutionProjectionById(reality.projection_id, workspaceId);
  if (!projResult.ok) return { ok: false, error: projResult.error, failureClass: projResult.failureClass };
  const projection = projResult.data;

  const [obsResult, varsResult, driftsResult] = await Promise.all([
    dbListExecutionObservations(realityId, workspaceId),
    dbListExecutionVariances(realityId, workspaceId),
    dbListExecutionDrifts(realityId, workspaceId),
  ]);

  const variances: VarianceResult[] = (varsResult.ok ? varsResult.data : []).map(v => ({
    varianceType:       v.variance_type,
    projectedValue:     v.projected_value,
    actualValue:        v.actual_value,
    variancePercentage: v.variance_percentage,
    severity:           v.severity,
  }));

  const drifts: DriftResult[] = (driftsResult.ok ? driftsResult.data : []).map(d => ({
    driftType:   d.drift_type,
    severity:    d.severity,
    description: d.description,
  }));

  const accuracy   = calculateProjectionAccuracy(variances, projection.projected_risk, reality.actual_risk);
  const obsCount   = obsResult.ok ? obsResult.data.length : 0;
  const confidence = calculateRealityConfidence({
    observationCount: obsCount,
    isValidated:      reality.status === "validated" || reality.status === "completed",
  });

  const worstSev = variances.reduce<string>((max, v) => {
    const rank = { low: 0, medium: 1, high: 2, critical: 3 };
    return (rank[v.severity as keyof typeof rank] ?? 0) > (rank[max as keyof typeof rank] ?? 0) ? v.severity : max;
  }, "low");

  const health = calculateExecutionHealth({
    worstVarianceSeverity: worstSev as "low" | "medium" | "high" | "critical",
    drifts,
    projectionAccuracy:    accuracy.score,
    riskLevel:             reality.actual_risk,
  });

  const explanation = explainExecutionReality(
    reality,
    variances,
    drifts,
    accuracy.score,
    health.score,
    confidence.score
  );

  return { ok: true, data: explanation };
}
