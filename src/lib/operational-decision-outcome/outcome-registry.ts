import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dbCreateOutcome,
  dbFindOutcomeById,
  dbListOutcomes,
  dbUpdateOutcome,
  dbCreateObservation,
  dbListObservations,
  dbCreateEffect,
  dbListEffects,
  dbCreateLearning,
  dbListLearning,
} from "./outcome-repository";
import { calculateDecisionEffectiveness, classifyEffectivenessLevel } from "./effectiveness-engine";
import { calculateRecommendationQuality } from "./quality-engine";
import { calculateOutcomeVariance, classifyOutcomeByEffectiveness } from "./variance-engine";
import { generateOutcomeLearning } from "./learning-engine";
import { updateRecommendationEffectiveness } from "./evolution-engine";
import { compareDecisionOutcomes } from "./comparison-engine";
import { validateOutcomeEvidence } from "./evidence-engine";
import { getDecisionOutcomeLineage } from "./lineage-engine";
import type {
  OutcomeResult,
  OperationalDecisionOutcomeRow,
  OperationalOutcomeObservationRow,
  OperationalLearningFeedbackRow,
  OutcomeAnalysis,
  OutcomeComparison,
  EvidenceValidationResult,
  OutcomeLineage,
  RecommendationEvolutionRecord,
  DecisionOutcomeEventType,
  CreateDecisionOutcomeInput,
  RecordOutcomeObservationInput,
  EvaluateDecisionOutcomeInput,
  CompleteDecisionOutcomeInput,
  ArchiveDecisionOutcomeInput,
  GetDecisionOutcomeInput,
  ListDecisionOutcomesInput,
  CompareDecisionOutcomesInput,
  GetOutcomeLineageInput,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(msg: string): OutcomeResult<T> {
  return { ok: false, error: msg, failureClass: "validation_failed" };
}

async function emitOutcomeEvent(
  workspaceId: string,
  outcomeId: string,
  decisionId: string,
  eventType: DecisionOutcomeEventType,
  actorId: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "system",
    eventType,
    eventCategory: "outcome",
    source: "system",
    correlationId: outcomeId,
    rawReferenceTable: "operational_decision_outcomes",
    rawReferenceId: outcomeId,
    learningEligible: true,
    eventPayload: { outcomeId, decisionId, ...extra },
  });
}

async function resolveDecisionCategory(
  decisionId: string,
  workspaceId: string
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("operational_decisions")
    .select("decision_category, decision_score")
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .single();
  return (data?.decision_category as string) ?? "governance";
}

async function resolveDecisionScore(
  decisionId: string,
  workspaceId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("operational_decisions")
    .select("decision_score")
    .eq("id", decisionId)
    .eq("workspace_id", workspaceId)
    .single();
  return (data?.decision_score as number) ?? 50;
}

// ─── createDecisionOutcome ────────────────────────────────────────────────────

export async function createDecisionOutcome(
  input: CreateDecisionOutcomeInput
): Promise<OutcomeResult<OperationalDecisionOutcomeRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId))  return validation("decisionId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");
  if (input.expectedImpactScore < 0 || input.expectedImpactScore > 100) {
    return validation("expectedImpactScore must be between 0 and 100.");
  }

  // Verify decision exists in workspace
  const supabase = await createSupabaseServerClient();
  const { data: decision, error: decErr } = await supabase
    .from("operational_decisions")
    .select("id")
    .eq("id", input.decisionId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (decErr || !decision) {
    return { ok: false, error: "Decision not found.", failureClass: "not_found" };
  }

  const result = await dbCreateOutcome({
    workspaceId: input.workspaceId,
    decisionId: input.decisionId,
    expectedImpactScore: input.expectedImpactScore,
  });
  if (!result.ok) return result;

  await emitOutcomeEvent(
    input.workspaceId,
    result.data.id,
    input.decisionId,
    "OPERATIONAL_DECISION_OUTCOME_CREATED",
    input.actorId,
    { expectedImpactScore: input.expectedImpactScore }
  );

  return result;
}

// ─── recordOutcomeObservation ─────────────────────────────────────────────────

export async function recordOutcomeObservation(
  input: RecordOutcomeObservationInput
): Promise<OutcomeResult<OperationalOutcomeObservationRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");
  if (!validUuid(input.observedBy))  return validation("observedBy must be a UUID.");
  if (!input.observationSource?.trim()) return validation("observationSource is required.");

  const outcomeCheck = await dbFindOutcomeById(input.outcomeId, input.workspaceId);
  if (!outcomeCheck.ok) return outcomeCheck;

  if (outcomeCheck.data.outcome_status === "archived") {
    return validation("Cannot add observations to an archived outcome.");
  }

  const result = await dbCreateObservation({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    observationType: input.observationType,
    observationValue: input.observationValue,
    observationSource: input.observationSource,
    observedBy: input.observedBy,
    observedAt: new Date().toISOString(),
  });
  if (!result.ok) return result;

  // Transition to "observed" if still pending
  if (outcomeCheck.data.outcome_status === "pending") {
    await dbUpdateOutcome(input.outcomeId, input.workspaceId, {
      outcome_status: "observed",
      observed_at: new Date().toISOString(),
    });
  }

  await emitOutcomeEvent(
    input.workspaceId,
    input.outcomeId,
    outcomeCheck.data.decision_id,
    "OPERATIONAL_OUTCOME_OBSERVATION_RECORDED",
    input.observedBy,
    { observationType: input.observationType, observationValue: input.observationValue }
  );

  return result;
}

// ─── evaluateDecisionOutcome ──────────────────────────────────────────────────

export async function evaluateDecisionOutcome(
  input: EvaluateDecisionOutcomeInput
): Promise<OutcomeResult<OperationalDecisionOutcomeRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const current = await dbFindOutcomeById(input.outcomeId, input.workspaceId);
  if (!current.ok) return current;

  const allowedStatuses = ["observed", "pending"];
  if (!allowedStatuses.includes(current.data.outcome_status)) {
    return validation(
      `Outcome can only be evaluated from 'observed' or 'pending' status (current: ${current.data.outcome_status}).`
    );
  }

  const [observationsResult, effectsResult] = await Promise.all([
    dbListObservations(input.outcomeId, input.workspaceId),
    dbListEffects(input.outcomeId, input.workspaceId),
  ]);

  if (!observationsResult.ok) return observationsResult;
  if (!effectsResult.ok) return effectsResult;

  const observations = observationsResult.data;
  const effects = effectsResult.data;

  // Derive actual impact score from observations (average of all observation values)
  const actualImpactScore = observations.length > 0
    ? Math.round(
        (observations.reduce((s, o) => s + o.observation_value, 0) / observations.length) * 100
      ) / 100
    : 0;

  const effectivenessScore = calculateDecisionEffectiveness({
    expectedImpactScore: current.data.expected_impact_score,
    actualImpactScore,
    observations,
    effects,
  });

  const recommendationQuality = calculateRecommendationQuality(effectivenessScore);
  const variance = calculateOutcomeVariance(current.data.expected_impact_score, actualImpactScore);

  const updated = await dbUpdateOutcome(input.outcomeId, input.workspaceId, {
    outcome_status: "evaluated",
    actual_impact_score: actualImpactScore,
    effectiveness_score: effectivenessScore,
    recommendation_quality: recommendationQuality,
    outcome_variance: variance.variance,
    evaluated_at: new Date().toISOString(),
  });
  if (!updated.ok) return updated;

  await emitOutcomeEvent(
    input.workspaceId, input.outcomeId, current.data.decision_id,
    "OPERATIONAL_DECISION_OUTCOME_EVALUATED", input.actorId,
    { effectivenessScore, recommendationQuality, outcomeVariance: variance.variance }
  );

  await emitOutcomeEvent(
    input.workspaceId, input.outcomeId, current.data.decision_id,
    "OPERATIONAL_DECISION_EFFECTIVENESS_CALCULATED", input.actorId,
    { effectivenessScore, effectivenessLevel: classifyEffectivenessLevel(effectivenessScore) }
  );

  await emitOutcomeEvent(
    input.workspaceId, input.outcomeId, current.data.decision_id,
    "OPERATIONAL_RECOMMENDATION_QUALITY_CALCULATED", input.actorId,
    { recommendationQuality }
  );

  // Generate learning feedback
  const decisionCategory = await resolveDecisionCategory(current.data.decision_id, input.workspaceId);
  const effectivenessLevel = classifyEffectivenessLevel(effectivenessScore);
  const learning = generateOutcomeLearning({
    decisionId: current.data.decision_id,
    decisionCategory,
    effectivenessScore,
    effectivenessLevel,
    recommendationQuality,
    outcomeStatus: "evaluated",
  });

  await dbCreateLearning({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    learningType: learning.learningType,
    learningSummary: learning.learningSummary,
    confidenceScore: learning.confidenceScore,
    shouldRecommendAgain: learning.shouldRecommendAgain,
  });

  await emitOutcomeEvent(
    input.workspaceId, input.outcomeId, current.data.decision_id,
    "OPERATIONAL_OUTCOME_LEARNING_GENERATED", input.actorId,
    {
      learningType: learning.learningType,
      shouldRecommendAgain: learning.shouldRecommendAgain,
      confidenceScore: learning.confidenceScore,
    }
  );

  // Recommendation evolution update
  const allLearning = await dbListLearning(input.outcomeId, input.workspaceId);
  if (allLearning.ok) {
    await emitOutcomeEvent(
      input.workspaceId, input.outcomeId, current.data.decision_id,
      "OPERATIONAL_RECOMMENDATION_EVOLUTION_UPDATED", input.actorId,
      {
        decisionId: current.data.decision_id,
        effectivenessScore,
        shouldRecommendAgain: learning.shouldRecommendAgain,
      }
    );
  }

  return updated;
}

// ─── completeDecisionOutcome ──────────────────────────────────────────────────

export async function completeDecisionOutcome(
  input: CompleteDecisionOutcomeInput
): Promise<OutcomeResult<OperationalDecisionOutcomeRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const current = await dbFindOutcomeById(input.outcomeId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.outcome_status !== "evaluated") {
    return validation(
      `Outcome must be evaluated before completion (current: ${current.data.outcome_status}).`
    );
  }

  const terminalStatus = classifyOutcomeByEffectiveness(current.data.effectiveness_score);

  const result = await dbUpdateOutcome(input.outcomeId, input.workspaceId, {
    outcome_status: terminalStatus,
  });
  if (!result.ok) return result;

  await emitOutcomeEvent(
    input.workspaceId, input.outcomeId, current.data.decision_id,
    "OPERATIONAL_DECISION_OUTCOME_COMPLETED", input.actorId,
    { terminalStatus, effectivenessScore: current.data.effectiveness_score }
  );

  return result;
}

// ─── archiveDecisionOutcome ───────────────────────────────────────────────────

export async function archiveDecisionOutcome(
  input: ArchiveDecisionOutcomeInput
): Promise<OutcomeResult<OperationalDecisionOutcomeRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const current = await dbFindOutcomeById(input.outcomeId, input.workspaceId);
  if (!current.ok) return current;

  if (current.data.outcome_status === "archived") {
    return validation("Outcome is already archived.");
  }

  const result = await dbUpdateOutcome(input.outcomeId, input.workspaceId, {
    outcome_status: "archived",
  });
  if (!result.ok) return result;

  await emitOutcomeEvent(
    input.workspaceId, input.outcomeId, current.data.decision_id,
    "OPERATIONAL_DECISION_OUTCOME_ARCHIVED", input.actorId
  );

  return result;
}

// ─── getDecisionOutcome ───────────────────────────────────────────────────────

export async function getDecisionOutcome(
  input: GetDecisionOutcomeInput
): Promise<OutcomeResult<OperationalDecisionOutcomeRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");
  return dbFindOutcomeById(input.outcomeId, input.workspaceId);
}

// ─── listDecisionOutcomes ─────────────────────────────────────────────────────

export async function listDecisionOutcomes(
  input: ListDecisionOutcomesInput
): Promise<OutcomeResult<OperationalDecisionOutcomeRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (input.decisionId && !validUuid(input.decisionId)) {
    return validation("decisionId must be a UUID.");
  }
  return dbListOutcomes(input);
}

// ─── getOutcomeAnalysis ───────────────────────────────────────────────────────

export async function getOutcomeAnalysis(
  input: GetDecisionOutcomeInput
): Promise<OutcomeResult<OutcomeAnalysis>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");

  const [outcomeR, obsR, effR, learnR] = await Promise.all([
    dbFindOutcomeById(input.outcomeId, input.workspaceId),
    dbListObservations(input.outcomeId, input.workspaceId),
    dbListEffects(input.outcomeId, input.workspaceId),
    dbListLearning(input.outcomeId, input.workspaceId),
  ]);

  if (!outcomeR.ok) return outcomeR;
  if (!obsR.ok)     return obsR;
  if (!effR.ok)     return effR;
  if (!learnR.ok)   return learnR;

  const outcome = outcomeR.data;
  const variance = calculateOutcomeVariance(outcome.expected_impact_score, outcome.actual_impact_score);
  const effectivenessLevel = classifyEffectivenessLevel(outcome.effectiveness_score);

  return {
    ok: true,
    data: {
      outcome,
      observations: obsR.data,
      effects: effR.data,
      learning: learnR.data,
      effectivenessLevel,
      variance,
    },
  };
}

// ─── compareDecisionOutcomesService ──────────────────────────────────────────

export async function compareDecisionOutcomesService(
  input: CompareDecisionOutcomesInput
): Promise<OutcomeResult<OutcomeComparison>> {
  if (!validUuid(input.workspaceId))  return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeIdA))   return validation("outcomeIdA must be a UUID.");
  if (!validUuid(input.outcomeIdB))   return validation("outcomeIdB must be a UUID.");

  const [aResult, bResult] = await Promise.all([
    dbFindOutcomeById(input.outcomeIdA, input.workspaceId),
    dbFindOutcomeById(input.outcomeIdB, input.workspaceId),
  ]);

  if (!aResult.ok) return aResult;
  if (!bResult.ok) return bResult;

  return {
    ok: true,
    data: compareDecisionOutcomes(aResult.data, bResult.data),
  };
}

// ─── validateOutcomeEvidenceService ──────────────────────────────────────────

export async function validateOutcomeEvidenceService(
  input: GetDecisionOutcomeInput
): Promise<OutcomeResult<EvidenceValidationResult>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");

  const [obsR, effR, learnR] = await Promise.all([
    dbListObservations(input.outcomeId, input.workspaceId),
    dbListEffects(input.outcomeId, input.workspaceId),
    dbListLearning(input.outcomeId, input.workspaceId),
  ]);

  if (!obsR.ok)   return obsR;
  if (!effR.ok)   return effR;
  if (!learnR.ok) return learnR;

  return {
    ok: true,
    data: validateOutcomeEvidence({
      outcomeId: input.outcomeId,
      observations: obsR.data,
      effects: effR.data,
      learning: learnR.data,
    }),
  };
}

// ─── getDecisionOutcomeLineageService ────────────────────────────────────────

export async function getDecisionOutcomeLineageService(
  input: GetOutcomeLineageInput
): Promise<OutcomeResult<OutcomeLineage>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");
  if (!validUuid(input.actorId))     return validation("actorId must be a UUID.");

  const outcomeResult = await dbFindOutcomeById(input.outcomeId, input.workspaceId);
  if (!outcomeResult.ok) return outcomeResult;

  const result = await getDecisionOutcomeLineage({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    decisionId: outcomeResult.data.decision_id,
  });

  if (result.ok) {
    await emitOutcomeEvent(
      input.workspaceId, input.outcomeId, outcomeResult.data.decision_id,
      "OPERATIONAL_DECISION_OUTCOME_LINEAGE_GENERATED", input.actorId,
      { layerCount: result.data.chain.length }
    );
  }

  return result;
}

// ─── updateRecommendationEffectivenessService ─────────────────────────────────

export async function updateRecommendationEffectivenessService(
  input: GetDecisionOutcomeInput
): Promise<OutcomeResult<RecommendationEvolutionRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.outcomeId))   return validation("outcomeId must be a UUID.");

  const [outcomeR, learnR] = await Promise.all([
    dbFindOutcomeById(input.outcomeId, input.workspaceId),
    dbListLearning(input.outcomeId, input.workspaceId),
  ]);

  if (!outcomeR.ok) return outcomeR;
  if (!learnR.ok)   return learnR;

  return {
    ok: true,
    data: updateRecommendationEffectiveness({
      decisionId: outcomeR.data.decision_id,
      workspaceId: input.workspaceId,
      effectivenessScore: outcomeR.data.effectiveness_score,
      learningRecords: learnR.data,
    }),
  };
}
