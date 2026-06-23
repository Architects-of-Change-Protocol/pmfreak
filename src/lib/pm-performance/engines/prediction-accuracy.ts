import type { PredictionAccuracyInput } from "../types";

const VARIANCE_PENALTY_MULTIPLIER = 10;
const VARIANCE_PENALTY_MAX = 25;
const DEFAULT_WHEN_NO_DATA = 75;

export function calculatePMPredictionAccuracy(input: PredictionAccuracyInput): number {
  const { confidenceScores, varianceValues } = input;

  if (confidenceScores.length === 0) return DEFAULT_WHEN_NO_DATA;

  // confidence_score in the DB is stored as 0.0–1.0; multiply by 100
  const avgConfidence =
    (confidenceScores.reduce((sum, s) => sum + s, 0) / confidenceScores.length) * 100;

  const avgVariance =
    varianceValues.length > 0
      ? varianceValues.reduce((sum, v) => sum + Math.abs(v), 0) / varianceValues.length
      : 0;

  const variancePenalty = Math.min(avgVariance * VARIANCE_PENALTY_MULTIPLIER, VARIANCE_PENALTY_MAX);

  return Math.max(0, Math.min(100, Math.round(avgConfidence - variancePenalty)));
}
