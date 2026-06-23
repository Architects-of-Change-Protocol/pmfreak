import type { ExecutionHealthResult, ExecutionRealityRisk, ExecutionVarianceSeverity, DriftResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Execution Health Engine
//
// Computes an overall execution health score (0–100) from:
//   - worst variance severity
//   - number of detected drifts
//   - projection accuracy
//   - risk level
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_PENALTY: Record<ExecutionVarianceSeverity, number> = {
  low:      5,
  medium:   15,
  high:     30,
  critical: 50,
};

const RISK_PENALTY: Record<ExecutionRealityRisk, number> = {
  low:      0,
  medium:   5,
  high:     15,
  critical: 25,
};

export function calculateExecutionHealth(input: {
  worstVarianceSeverity: ExecutionVarianceSeverity;
  drifts: DriftResult[];
  projectionAccuracy: number;
  riskLevel: ExecutionRealityRisk;
}): ExecutionHealthResult {
  const { worstVarianceSeverity, drifts, projectionAccuracy, riskLevel } = input;

  const variancePenalty = SEVERITY_PENALTY[worstVarianceSeverity] ?? 0;
  const driftPenalty    = Math.min(30, drifts.length * 8);
  const accuracyScore   = (projectionAccuracy / 100) * 40;
  const riskPenalty     = RISK_PENALTY[riskLevel] ?? 0;

  const baseScore = 60 + accuracyScore;
  const score     = Math.max(0, Math.min(100, Math.round(baseScore - variancePenalty - driftPenalty - riskPenalty)));

  const factors: string[] = [];
  if (variancePenalty > 15) factors.push(`High variance detected (${worstVarianceSeverity}).`);
  if (drifts.length > 0)    factors.push(`${drifts.length} drift(s) detected.`);
  if (projectionAccuracy < 60) factors.push(`Projection accuracy is low (${projectionAccuracy}%).`);
  if (riskLevel === "high" || riskLevel === "critical") factors.push(`Elevated risk level: ${riskLevel}.`);
  if (factors.length === 0) factors.push("Execution is healthy and within expected bounds.");

  return {
    score,
    varianceSeverity: worstVarianceSeverity,
    driftCount:       drifts.length,
    projectionAccuracy,
    riskLevel,
    factors,
  };
}
