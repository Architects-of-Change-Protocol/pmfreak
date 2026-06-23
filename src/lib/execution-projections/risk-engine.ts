import type { ExecutionProjectionRisk, ProjectionRiskResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Risk Engine
//
// Calculates projected execution risk based on:
//   - Commitment priority
//   - Signal severity
//   - Dependency count
//   - Historical effectiveness
//   - Recommendation confidence
// ─────────────────────────────────────────────────────────────────────────────

type RiskInput = {
  commitmentPriority: "low" | "medium" | "high" | "critical";
  signalSeverity?:    "low" | "medium" | "high" | "critical" | null;
  dependencyCount:    number;
  historicalEffectiveness?: number | null; // 0.0–1.0
  recommendationConfidence?: number | null; // 0.0–1.0
};

const PRIORITY_SCORE: Record<string, number> = {
  low:      0,
  medium:   1,
  high:     2,
  critical: 3,
};

const SEVERITY_SCORE: Record<string, number> = {
  low:      0,
  medium:   1,
  high:     2,
  critical: 3,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function calculateProjectionRisk(input: RiskInput): ProjectionRiskResult {
  const factors: string[] = [];
  let score = 0;

  // Priority contribution (0–3)
  const priorityScore = PRIORITY_SCORE[input.commitmentPriority] ?? 1;
  score += priorityScore;
  factors.push(`commitment_priority:${input.commitmentPriority}`);

  // Signal severity contribution (0–3)
  if (input.signalSeverity) {
    const severityScore = SEVERITY_SCORE[input.signalSeverity] ?? 0;
    score += severityScore;
    factors.push(`signal_severity:${input.signalSeverity}`);
  }

  // Dependency count contribution
  if (input.dependencyCount >= 5) {
    score += 2;
    factors.push("dependency_count:high");
  } else if (input.dependencyCount >= 3) {
    score += 1;
    factors.push("dependency_count:medium");
  } else {
    factors.push("dependency_count:low");
  }

  // Low historical effectiveness increases risk
  if (input.historicalEffectiveness != null) {
    if (input.historicalEffectiveness < 0.4) {
      score += 2;
      factors.push("historical_effectiveness:low");
    } else if (input.historicalEffectiveness < 0.6) {
      score += 1;
      factors.push("historical_effectiveness:medium");
    } else {
      factors.push("historical_effectiveness:high");
    }
  }

  // Low recommendation confidence increases risk
  if (input.recommendationConfidence != null) {
    if (input.recommendationConfidence < 0.4) {
      score += 2;
      factors.push("recommendation_confidence:low");
    } else if (input.recommendationConfidence < 0.6) {
      score += 1;
      factors.push("recommendation_confidence:medium");
    } else {
      factors.push("recommendation_confidence:high");
    }
  }

  // Map score to risk level
  const clamped = clamp(score, 0, 12);
  let risk: ExecutionProjectionRisk;
  if (clamped <= 1) {
    risk = "low";
  } else if (clamped <= 4) {
    risk = "medium";
  } else if (clamped <= 7) {
    risk = "high";
  } else {
    risk = "critical";
  }

  return { risk, factors };
}
