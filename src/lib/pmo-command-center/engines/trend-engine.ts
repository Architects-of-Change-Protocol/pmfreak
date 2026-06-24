import type { PMOCommandCenterSnapshotRow, PMOTrend, PMOTrendDirection } from "../types";

// ─── calculatePMOTrends ───────────────────────────────────────────────────────

export function calculatePMOTrends(
  snapshots: PMOCommandCenterSnapshotRow[]
): PMOTrend | null {
  if (snapshots.length < 2) return null;

  // Snapshots are ordered newest-first
  const current  = snapshots[0];
  const previous = snapshots[snapshots.length - 1];

  return {
    health: buildTrend(current.overall_health_score, previous.overall_health_score),
    capacity: buildTrend(current.capacity_score, previous.capacity_score),
    governance: buildTrend(current.governance_score, previous.governance_score),
    risk: buildTrend(current.risk_score, previous.risk_score),
    snapshotsCompared: snapshots.length,
  };
}

function buildTrend(
  current: number,
  previous: number
): { current: number; previous: number; delta: number; direction: PMOTrendDirection } {
  const delta     = Math.round((current - previous) * 100) / 100;
  const direction = trendDirection(delta);
  return { current, previous, delta, direction };
}

function trendDirection(delta: number): PMOTrendDirection {
  if (delta > 1)  return "improving";
  if (delta < -1) return "deteriorating";
  return "stable";
}
