import type { ConsequenceSeverity, ConsequenceImpactHorizon } from "./types";

// ─── calculateImpactHorizon ───────────────────────────────────────────────────
// Maps severity to the expected time window before consequences materialise.

export function calculateImpactHorizon(severity: ConsequenceSeverity): ConsequenceImpactHorizon {
  const map: Record<ConsequenceSeverity, ConsequenceImpactHorizon> = {
    critical: "24h",
    high:     "48h",
    medium:   "7d",
    low:      "14d",
    systemic: "30d",
  };
  return map[severity];
}
