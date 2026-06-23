import type { ProjectionAccuracyResult, ExecutionVarianceType, VarianceResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Projection Accuracy Engine
//
// Measures how accurate the original projection was against observed reality.
// Score range: 0–100 (100 = perfect prediction).
// ─────────────────────────────────────────────────────────────────────────────

export function calculateProjectionAccuracy(
  variances: VarianceResult[],
  projectedRisk: string,
  actualRisk: string
): ProjectionAccuracyResult {
  const effortVar   = variances.find(v => v.varianceType === "effort");
  const durationVar = variances.find(v => v.varianceType === "duration");

  const effortAccuracy   = effortVar   ? Math.max(0, 100 - Math.abs(effortVar.variancePercentage))   : 100;
  const durationAccuracy = durationVar ? Math.max(0, 100 - Math.abs(durationVar.variancePercentage)) : 100;
  const riskMatched      = projectedRisk === actualRisk;
  const riskBonus        = riskMatched ? 100 : 50;

  const score = Math.round((effortAccuracy * 0.40) + (durationAccuracy * 0.40) + (riskBonus * 0.20));

  const factors: string[] = [];
  if (effortAccuracy < 75)   factors.push(`Effort accuracy: ${Math.round(effortAccuracy)}%`);
  if (durationAccuracy < 75) factors.push(`Duration accuracy: ${Math.round(durationAccuracy)}%`);
  if (!riskMatched)          factors.push(`Risk mismatch: projected ${projectedRisk}, actual ${actualRisk}`);
  if (factors.length === 0)  factors.push("Projection closely matched reality.");

  return {
    score:            Math.min(100, Math.max(0, score)),
    effortAccuracy:   Math.round(effortAccuracy),
    durationAccuracy: Math.round(durationAccuracy),
    riskMatched,
    factors,
  };
}

export function identifyMainVariance(variances: VarianceResult[]): ExecutionVarianceType | null {
  if (variances.length === 0) return null;
  return variances.reduce((max, v) =>
    Math.abs(v.variancePercentage) > Math.abs(max.variancePercentage) ? v : max
  ).varianceType;
}
