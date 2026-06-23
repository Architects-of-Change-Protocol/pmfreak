import type { OutcomeVarianceResult } from "./types";

// ─── calculateOutcomeVariance ─────────────────────────────────────────────────
// Computes the difference between expected and actual impact scores.
// variance is expressed as a signed decimal (positive = over-performed).

export function calculateOutcomeVariance(
  expectedImpactScore: number,
  actualImpactScore: number
): OutcomeVarianceResult {
  const variance = actualImpactScore - expectedImpactScore;

  const variancePercentage = expectedImpactScore > 0 && variance !== 0
    ? `${variance > 0 ? "+" : ""}${((variance / expectedImpactScore) * 100).toFixed(1)}%`
    : "0%";

  return {
    expected: expectedImpactScore,
    actual: actualImpactScore,
    variance,
    variancePercentage,
  };
}

// ─── classifyOutcomeByEffectiveness ──────────────────────────────────────────
// Converts effectiveness score to terminal outcome_status.
//
//  90+    → successful
//  70–89  → partially_successful
//  0–69   → unsuccessful

export function classifyOutcomeByEffectiveness(
  effectivenessScore: number
): "successful" | "partially_successful" | "unsuccessful" {
  if (effectivenessScore >= 90) return "successful";
  if (effectivenessScore >= 70) return "partially_successful";
  return "unsuccessful";
}
