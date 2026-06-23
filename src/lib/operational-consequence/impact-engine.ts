import type { ConsequenceSeverity, ImpactCalculationInput } from "./types";

// ─── calculateImpactScore ─────────────────────────────────────────────────────
// Produces a 0–100 score from multiple operational factors.

export function calculateImpactScore(input: ImpactCalculationInput): number {
  const priorityWeight: Record<string, number> = {
    critical: 30,
    high:     22,
    medium:   14,
    low:       6,
  };

  const base      = (input.focusScore / 100) * 25;
  const priority  = priorityWeight[input.operationalPriority] ?? 6;
  const deps      = Math.min(input.dependencyCount * 2, 20);
  const gov       = (input.governanceImpact / 100) * 10;
  const exec      = (input.executionImpact  / 100) * 10;
  const history   = (input.historicalSimilarity / 100) * 5;

  const raw = base + priority + deps + gov + exec + history;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─── calculateConsequenceSeverity ────────────────────────────────────────────

export function calculateConsequenceSeverity(impactScore: number): ConsequenceSeverity {
  if (impactScore >= 90) return "systemic";
  if (impactScore >= 70) return "critical";
  if (impactScore >= 50) return "high";
  if (impactScore >= 30) return "medium";
  return "low";
}
