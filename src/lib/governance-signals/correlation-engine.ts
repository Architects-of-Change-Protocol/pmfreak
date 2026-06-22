// ─────────────────────────────────────────────────────────────────────────────
// Signal Correlation Engine
//
// Identifies relationships between co-existing active signals.
// Correlations are derived from known governance causality patterns:
//   approval_delay   → delivery_drift        (0.80)
//   authority_gap    → governance_violation  (0.82)
//   escalation_gap   → governance_violation  (0.75)
//   amendment_backlog→ ratification_stall    (0.78)
//   recommendation_ignored → governance_violation (0.70)
//   risk_accumulation→ delivery_drift        (0.76)
//   decision_bottleneck → delivery_drift     (0.72)
//   ratification_stall  → delivery_drift     (0.74)
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceSignalRow } from "@/lib/db/database-contract";
import type { GovernanceSignalType, SignalCorrelation } from "./types";

type CorrelationRule = {
  from: GovernanceSignalType;
  to: GovernanceSignalType;
  confidence: number;
  reason: string;
};

const CORRELATION_RULES: CorrelationRule[] = [
  {
    from: "approval_delay",
    to: "delivery_drift",
    confidence: 0.80,
    reason: "Approval delays cascade into delivery timeline drift.",
  },
  {
    from: "authority_gap",
    to: "governance_violation",
    confidence: 0.82,
    reason: "Absent authority creates conditions for undetected governance violations.",
  },
  {
    from: "escalation_gap",
    to: "governance_violation",
    confidence: 0.75,
    reason: "Unescalated high-severity issues frequently produce governance violations.",
  },
  {
    from: "amendment_backlog",
    to: "ratification_stall",
    confidence: 0.78,
    reason: "Amendment backlogs block ratification processes downstream.",
  },
  {
    from: "recommendation_ignored",
    to: "governance_violation",
    confidence: 0.70,
    reason: "Repeatedly ignored recommendations indicate systemic governance gaps.",
  },
  {
    from: "risk_accumulation",
    to: "delivery_drift",
    confidence: 0.76,
    reason: "Accumulated unmitigated risks directly affect delivery timelines.",
  },
  {
    from: "decision_bottleneck",
    to: "delivery_drift",
    confidence: 0.72,
    reason: "Decision bottlenecks stall execution and cause delivery drift.",
  },
  {
    from: "ratification_stall",
    to: "delivery_drift",
    confidence: 0.74,
    reason: "Stalled ratification prevents authorized execution and causes drift.",
  },
];

export function correlateSignals(activeSignals: GovernanceSignalRow[]): SignalCorrelation[] {
  const correlations: SignalCorrelation[] = [];

  for (const rule of CORRELATION_RULES) {
    const fromSignals = activeSignals.filter((s) => s.signal_type === rule.from);
    const toSignals   = activeSignals.filter((s) => s.signal_type === rule.to);

    for (const from of fromSignals) {
      for (const to of toSignals) {
        if (from.id === to.id) continue;
        correlations.push({
          signalId:          from.id,
          signalType:        from.signal_type as GovernanceSignalType,
          relatedSignalId:   to.id,
          relatedSignalType: to.signal_type as GovernanceSignalType,
          correlationReason: rule.reason,
          confidence:        rule.confidence,
        });
      }
    }
  }

  return correlations;
}
