// ─────────────────────────────────────────────────────────────────────────────
// Signal Severity Engine
//
// Calculates the severity of a detected signal based on:
//   - Impact: how broadly the signal affects governance
//   - Duration: how long the condition has been active
//   - Governance Risk: intrinsic risk level of the signal type
//   - Historical Outcome: prior outcomes of this signal type
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceSignalSeverity, GovernanceSignalType } from "./types";

type SeverityFactors = {
  signalType: GovernanceSignalType;
  durationDays: number;
  hasHistoricalNegativeOutcome: boolean;
  affectedEntityCount?: number;
};

// Baseline risk levels per signal type
const TYPE_BASELINE_SEVERITY: Record<GovernanceSignalType, GovernanceSignalSeverity> = {
  governance_violation:    "critical",
  authority_gap:           "high",
  escalation_gap:          "high",
  approval_delay:          "medium",
  ratification_stall:      "medium",
  decision_bottleneck:     "medium",
  amendment_backlog:       "medium",
  risk_accumulation:       "medium",
  recommendation_ignored:  "low",
  delivery_drift:          "low",
};

function severityToNumber(s: GovernanceSignalSeverity): number {
  switch (s) {
    case "low":      return 1;
    case "medium":   return 2;
    case "high":     return 3;
    case "critical": return 4;
  }
}

function numberToSeverity(n: number): GovernanceSignalSeverity {
  if (n >= 4) return "critical";
  if (n === 3) return "high";
  if (n === 2) return "medium";
  return "low";
}

export function calculateSignalSeverity(factors: SeverityFactors): GovernanceSignalSeverity {
  let score = severityToNumber(TYPE_BASELINE_SEVERITY[factors.signalType]);

  // Duration escalation
  if (factors.durationDays >= 15) score += 2;
  else if (factors.durationDays >= 8)  score += 1;
  else if (factors.durationDays >= 3)  score += 0; // no escalation yet

  // Historical negative outcome escalates
  if (factors.hasHistoricalNegativeOutcome) score += 1;

  // Broad impact (many affected entities) escalates
  if ((factors.affectedEntityCount ?? 0) >= 5) score += 1;

  return numberToSeverity(score);
}

export function durationDaysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / 86_400_000);
}
