import type { DecisionEffectivenessInput } from "../types";

const SUCCESS_BONUS_MULTIPLIER = 10;
const FAILURE_PENALTY_MULTIPLIER = 15;
const DEFAULT_WHEN_NO_DATA = 75;

export function calculatePMDecisionEffectiveness(input: DecisionEffectivenessInput): number {
  const { effectivenessScores, successfulOutcomes, unsuccessfulOutcomes, totalOutcomes } = input;

  const hasScores = effectivenessScores.length > 0;
  const hasOutcomes = totalOutcomes > 0;

  if (!hasScores && !hasOutcomes) return DEFAULT_WHEN_NO_DATA;

  // effectiveness_score in DB is numeric(5,2) on a 0–100 scale
  const avgEffectiveness = hasScores
    ? effectivenessScores.reduce((sum, s) => sum + s, 0) / effectivenessScores.length
    : DEFAULT_WHEN_NO_DATA;

  const successRate = hasOutcomes ? successfulOutcomes / totalOutcomes : 0.75;
  const failureRate = hasOutcomes ? unsuccessfulOutcomes / totalOutcomes : 0;

  const successBonus   = successRate * SUCCESS_BONUS_MULTIPLIER;
  const failurePenalty = failureRate * FAILURE_PENALTY_MULTIPLIER;

  return Math.max(0, Math.min(100, Math.round(avgEffectiveness + successBonus - failurePenalty)));
}
