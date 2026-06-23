import type {
  ExecutionRealityRow,
  VarianceResult,
  DriftResult,
  RealityExplanation,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Explain Capability
//
// Produces a human-readable explanation of an execution reality,
// covering projection, observation, variance, drift, accuracy, and health.
// ─────────────────────────────────────────────────────────────────────────────

export function explainExecutionReality(
  reality:           ExecutionRealityRow,
  variances:         VarianceResult[],
  drifts:            DriftResult[],
  accuracy:          number,
  executionHealth:   number,
  realityConfidence: number
): RealityExplanation {
  const mainVar = variances.length > 0
    ? variances.reduce((m, v) => Math.abs(v.variancePercentage) > Math.abs(m.variancePercentage) ? v : m)
    : null;

  const observation = `Observed ${reality.actual_effort_hours}h of effort over ${reality.actual_duration_days} days at ${reality.actual_risk} risk with ${reality.actual_task_count} tasks.`;

  const variance = mainVar
    ? `Largest variance: ${mainVar.varianceType} at ${mainVar.variancePercentage > 0 ? "+" : ""}${mainVar.variancePercentage.toFixed(1)}% (${mainVar.severity} severity).`
    : "No significant variance detected.";

  const drift = drifts.length > 0
    ? `${drifts.length} drift(s) detected: ${drifts.map(d => `${d.driftType} (${d.severity})`).join(", ")}.`
    : "No execution drift detected.";

  return {
    realityId:         reality.id,
    projectionId:      reality.projection_id,
    observation,
    variance,
    drift,
    accuracy,
    executionHealth,
    realityConfidence,
  };
}
