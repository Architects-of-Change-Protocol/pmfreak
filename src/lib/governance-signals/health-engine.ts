// ─────────────────────────────────────────────────────────────────────────────
// Governance Health Engine
//
// Calculates a 0–100 workspace governance health score.
// Factors:
//   - Active signal count and severity distribution
//   - Critical signal penalty (heavy)
//   - High signal penalty (moderate)
//   - Medium/low signal penalty (mild)
//   - Resolved signal bonus (rewards resolution culture)
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceSignalRow } from "@/lib/db/database-contract";
import type { GovernanceHealthScore } from "./types";

const CRITICAL_PENALTY = 25;
const HIGH_PENALTY     = 10;
const MEDIUM_PENALTY   = 5;
const LOW_PENALTY      = 2;
const RESOLVED_BONUS   = 1;

export function calculateGovernanceHealth(
  workspaceId: string,
  signals: GovernanceSignalRow[]
): GovernanceHealthScore {
  const activeSignals   = signals.filter((s) => s.status === "active" || s.status === "acknowledged");
  const resolvedSignals = signals.filter((s) => s.status === "resolved");

  const criticalSignals = activeSignals.filter((s) => s.severity === "critical").length;
  const highSignals     = activeSignals.filter((s) => s.severity === "high").length;
  const mediumSignals   = activeSignals.filter((s) => s.severity === "medium").length;
  const lowSignals      = activeSignals.filter((s) => s.severity === "low").length;

  const penalty =
    criticalSignals * CRITICAL_PENALTY +
    highSignals     * HIGH_PENALTY +
    mediumSignals   * MEDIUM_PENALTY +
    lowSignals      * LOW_PENALTY;

  const bonus = Math.min(10, resolvedSignals.length * RESOLVED_BONUS);

  const raw = 100 - penalty + bonus;
  const score = Math.max(0, Math.min(100, raw));

  return {
    workspaceId,
    score,
    activeSignals:   activeSignals.length,
    criticalSignals,
    highSignals,
    mediumSignals,
    lowSignals,
    resolvedSignals: resolvedSignals.length,
    calculatedAt:    new Date().toISOString(),
  };
}
