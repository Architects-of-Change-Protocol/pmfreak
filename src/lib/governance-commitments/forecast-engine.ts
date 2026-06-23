// ─────────────────────────────────────────────────────────────────────────────
// Commitment Forecast Engine
//
// Estimates probability of completion and breach risk based on commitment
// attributes, historical data, and signal severity.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceCommitmentRow } from "./types";
import type { CommitmentForecast } from "./types";

const PRIORITY_COMPLETION_BASE: Record<string, number> = {
  critical: 0.55,
  high:     0.65,
  medium:   0.75,
  low:      0.85,
};

const STATUS_COMPLETION_MODIFIER: Record<string, number> = {
  accepted:           0.10,
  active:             0.20,
  pending_acceptance: -0.05,
  delegated:          -0.05,
};

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function forecastCommitmentOutcome(
  commitment: GovernanceCommitmentRow,
  opts: {
    historicalEffectiveness?: number;
    signalSeverity?: string;
  } = {},
  now: Date = new Date()
): CommitmentForecast {
  const base = PRIORITY_COMPLETION_BASE[commitment.priority] ?? 0.70;
  const statusMod = STATUS_COMPLETION_MODIFIER[commitment.status] ?? 0;

  const dueDate = new Date(commitment.due_date);
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / 86_400_000;
  const timeMod = daysUntilDue < 0 ? -0.20 : daysUntilDue < 1 ? -0.10 : 0;

  const severityMod =
    opts.signalSeverity === "critical" ? -0.15 :
    opts.signalSeverity === "high"     ? -0.10 :
    opts.signalSeverity === "medium"   ? -0.05 : 0;

  const historicalMod = opts.historicalEffectiveness != null
    ? (opts.historicalEffectiveness - 0.5) * 0.20
    : 0;

  const probabilityOfCompletion = round3(clamp(base + statusMod + timeMod + severityMod + historicalMod));
  const riskOfBreach = round3(clamp(1 - probabilityOfCompletion));

  return {
    commitmentId: commitment.id,
    probabilityOfCompletion,
    riskOfBreach,
    forecastedAt: now.toISOString(),
  };
}
