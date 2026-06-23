import type {
  ExecutionRealityRow,
  ExecutionDriftType,
  ExecutionDriftSeverity,
  DriftResult,
} from "./types";
import type { ExecutionProjectionRow } from "@/lib/db/database-contract";

// ─────────────────────────────────────────────────────────────────────────────
// Drift Detection Engine
//
// Detects persistent misalignment between projected and actual execution.
// Drift represents a qualitative, sustained deviation — not just a one-time gap.
// ─────────────────────────────────────────────────────────────────────────────

const RISK_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function driftSeverityFromPct(pct: number): ExecutionDriftSeverity {
  if (pct <= 0)  return "none";
  if (pct < 15)  return "emerging";
  if (pct < 40)  return "persistent";
  return "critical";
}

export function detectExecutionDrift(
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
    | "actual_participant_count"
  >,
  projectedParticipantCount: number
): DriftResult[] {
  const drifts: DriftResult[] = [];

  // Schedule Drift: actual_duration_days > estimated_duration_days
  if (reality.actual_duration_days > projection.estimated_duration_days) {
    const overrun = projection.estimated_duration_days > 0
      ? ((reality.actual_duration_days - projection.estimated_duration_days) / projection.estimated_duration_days) * 100
      : 100;
    drifts.push({
      driftType:   "schedule",
      severity:    driftSeverityFromPct(overrun),
      description: `Actual duration (${reality.actual_duration_days}d) exceeds projected duration (${projection.estimated_duration_days}d) by ${Math.round(overrun)}%.`,
    });
  }

  // Effort Drift: actual_effort_hours > estimated_effort_hours
  if (reality.actual_effort_hours > projection.estimated_effort_hours) {
    const overrun = projection.estimated_effort_hours > 0
      ? ((reality.actual_effort_hours - projection.estimated_effort_hours) / projection.estimated_effort_hours) * 100
      : 100;
    drifts.push({
      driftType:   "effort",
      severity:    driftSeverityFromPct(overrun),
      description: `Actual effort (${reality.actual_effort_hours}h) exceeds projected effort (${projection.estimated_effort_hours}h) by ${Math.round(overrun)}%.`,
    });
  }

  // Resource Drift: actual_participants > projected_participants
  if (reality.actual_participant_count > projectedParticipantCount) {
    const overrun = projectedParticipantCount > 0
      ? ((reality.actual_participant_count - projectedParticipantCount) / projectedParticipantCount) * 100
      : 100;
    drifts.push({
      driftType:   "resource",
      severity:    driftSeverityFromPct(overrun),
      description: `Actual participants (${reality.actual_participant_count}) exceeds projected (${projectedParticipantCount}) by ${Math.round(overrun)}%.`,
    });
  }

  // Risk Drift: actual_risk rank > projected_risk rank
  const projRank = RISK_RANK[projection.projected_risk] ?? 1;
  const actRank  = RISK_RANK[reality.actual_risk] ?? 1;
  if (actRank > projRank) {
    const rankOverrun = ((actRank - projRank) / projRank) * 100;
    drifts.push({
      driftType:   "risk",
      severity:    driftSeverityFromPct(rankOverrun),
      description: `Actual risk (${reality.actual_risk}) escalated beyond projected risk (${projection.projected_risk}).`,
    });
  }

  return drifts;
}
