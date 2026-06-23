import type {
  ExecutionRealityRow,
  ExecutionVarianceType,
  ExecutionVarianceSeverity,
  VarianceResult,
} from "./types";
import type { ExecutionProjectionRow } from "@/lib/db/database-contract";

// ─────────────────────────────────────────────────────────────────────────────
// Variance Engine
//
// Calculates the difference between projected and actual execution values.
// Rule: variance_percentage = ((actual - projected) / projected) * 100
// Severity thresholds: 0–10% low, 10–25% medium, 25–50% high, 50%+ critical
// ─────────────────────────────────────────────────────────────────────────────

export function calculateVarianceSeverity(pct: number): ExecutionVarianceSeverity {
  const abs = Math.abs(pct);
  if (abs < 10)  return "low";
  if (abs < 25)  return "medium";
  if (abs < 50)  return "high";
  return "critical";
}

function variancePct(projected: number, actual: number): number {
  if (projected === 0) return actual === 0 ? 0 : 100;
  return ((actual - projected) / projected) * 100;
}

const RISK_RANK: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function calculateExecutionVariance(
  projection: Pick<
    ExecutionProjectionRow,
    | "estimated_effort_hours"
    | "estimated_duration_days"
    | "projected_risk"
  >,
  reality: Pick<
    ExecutionRealityRow,
    | "actual_effort_hours"
    | "actual_duration_days"
    | "actual_risk"
    | "actual_task_count"
    | "actual_participant_count"
  >,
  projectedTaskCount: number,
  projectedParticipantCount: number
): VarianceResult[] {
  const results: VarianceResult[] = [];

  // Effort variance
  const effortPct = variancePct(projection.estimated_effort_hours, reality.actual_effort_hours);
  results.push({
    varianceType:       "effort",
    projectedValue:     projection.estimated_effort_hours,
    actualValue:        reality.actual_effort_hours,
    variancePercentage: Math.round(effortPct * 100) / 100,
    severity:           calculateVarianceSeverity(effortPct),
  });

  // Duration variance
  const durationPct = variancePct(projection.estimated_duration_days, reality.actual_duration_days);
  results.push({
    varianceType:       "duration",
    projectedValue:     projection.estimated_duration_days,
    actualValue:        reality.actual_duration_days,
    variancePercentage: Math.round(durationPct * 100) / 100,
    severity:           calculateVarianceSeverity(durationPct),
  });

  // Risk variance (ordinal → numeric mapping)
  const projectedRiskRank = RISK_RANK[projection.projected_risk] ?? 1;
  const actualRiskRank    = RISK_RANK[reality.actual_risk] ?? 1;
  const riskPct = variancePct(projectedRiskRank, actualRiskRank);
  results.push({
    varianceType:       "risk",
    projectedValue:     projectedRiskRank,
    actualValue:        actualRiskRank,
    variancePercentage: Math.round(riskPct * 100) / 100,
    severity:           calculateVarianceSeverity(riskPct),
  });

  // Tasks variance
  const tasksPct = variancePct(projectedTaskCount, reality.actual_task_count);
  results.push({
    varianceType:       "tasks",
    projectedValue:     projectedTaskCount,
    actualValue:        reality.actual_task_count,
    variancePercentage: Math.round(tasksPct * 100) / 100,
    severity:           calculateVarianceSeverity(tasksPct),
  });

  // Participants variance
  const partPct = variancePct(projectedParticipantCount, reality.actual_participant_count);
  results.push({
    varianceType:       "participants",
    projectedValue:     projectedParticipantCount,
    actualValue:        reality.actual_participant_count,
    variancePercentage: Math.round(partPct * 100) / 100,
    severity:           calculateVarianceSeverity(partPct),
  });

  return results;
}
