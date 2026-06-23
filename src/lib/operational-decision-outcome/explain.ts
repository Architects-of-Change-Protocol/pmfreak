import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dbFindOutcomeById,
  dbListObservations,
  dbListEffects,
  dbListLearning,
} from "./outcome-repository";
import { classifyEffectivenessLevel } from "./effectiveness-engine";
import { calculateOutcomeVariance } from "./variance-engine";
import { getDecisionOutcomeLineage } from "./lineage-engine";
import type {
  OutcomeResult,
  OutcomeExplanation,
  ExplainDecisionOutcomesInput,
} from "./types";

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

// ─── explainDecisionOutcomes ──────────────────────────────────────────────────

export async function explainDecisionOutcomes(
  input: ExplainDecisionOutcomesInput
): Promise<OutcomeResult<OutcomeExplanation>> {
  if (!validUuid(input.workspaceId)) {
    return { ok: false, error: "workspaceId must be a UUID.", failureClass: "validation_failed" };
  }
  if (!validUuid(input.outcomeId)) {
    return { ok: false, error: "outcomeId must be a UUID.", failureClass: "validation_failed" };
  }

  const [outcomeResult, observationsResult, effectsResult, learningResult] = await Promise.all([
    dbFindOutcomeById(input.outcomeId, input.workspaceId),
    dbListObservations(input.outcomeId, input.workspaceId),
    dbListEffects(input.outcomeId, input.workspaceId),
    dbListLearning(input.outcomeId, input.workspaceId),
  ]);

  if (!outcomeResult.ok)      return outcomeResult;
  if (!observationsResult.ok) return observationsResult;
  if (!effectsResult.ok)      return effectsResult;
  if (!learningResult.ok)     return learningResult;

  const outcome      = outcomeResult.data;
  const observations = observationsResult.data;
  const effects      = effectsResult.data;
  const learning     = learningResult.data;

  const effectivenessLevel = classifyEffectivenessLevel(outcome.effectiveness_score);
  const variance = calculateOutcomeVariance(outcome.expected_impact_score, outcome.actual_impact_score);

  const shouldRecommendAgain = learning.length > 0
    ? learning.filter(l => l.should_recommend_again).length > learning.length / 2
    : outcome.effectiveness_score >= 60;

  const lineageResult = await getDecisionOutcomeLineage({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    decisionId: outcome.decision_id,
  });

  if (!lineageResult.ok) return lineageResult;

  return {
    ok: true,
    data: {
      outcomeId: outcome.id,
      decisionId: outcome.decision_id,
      outcomeStatus: outcome.outcome_status,
      effectivenessScore: outcome.effectiveness_score,
      effectivenessLevel,
      recommendationQuality: outcome.recommendation_quality,
      variance,
      learningCount: learning.length,
      observationCount: observations.length,
      shouldRecommendAgain,
      lineage: lineageResult.data,
      generatedAt: new Date().toISOString(),
    },
  };
}
