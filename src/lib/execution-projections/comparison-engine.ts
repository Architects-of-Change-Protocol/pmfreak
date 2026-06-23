import type { ExecutionProjectionRow } from "./types";
import type { ProjectionComparison } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Projection Comparison Engine
//
// Compares two projections and reports differences in effort, duration,
// risk, and confidence.
// ─────────────────────────────────────────────────────────────────────────────

export function compareExecutionProjections(
  a: ExecutionProjectionRow,
  b: ExecutionProjectionRow
): ProjectionComparison {
  const effortDiff   = b.estimated_effort_hours  - a.estimated_effort_hours;
  const durationDiff = b.estimated_duration_days - a.estimated_duration_days;
  const confDiff     = Math.round((b.confidence_score - a.confidence_score) * 1000) / 1000;

  const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const riskA = riskOrder[a.projected_risk] ?? 0;
  const riskB = riskOrder[b.projected_risk] ?? 0;
  let riskComparison: string;
  if (riskA === riskB) {
    riskComparison = "equal";
  } else if (riskB > riskA) {
    riskComparison = `b_higher_by_${riskB - riskA}`;
  } else {
    riskComparison = `a_higher_by_${riskA - riskB}`;
  }

  return {
    projectionA:             a.id,
    projectionB:             b.id,
    effortDifferenceHours:   effortDiff,
    durationDifferenceDays:  durationDiff,
    riskComparison,
    confidenceDifference:    confDiff,
  };
}
