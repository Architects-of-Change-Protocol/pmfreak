import type { DecisionEvaluationScores } from "./types";

// ─── calculateDecisionScore ───────────────────────────────────────────────────
// Aggregates evaluation scores into a single decision quality score (0–100).
// The score represents how good the best available decision is.

export function calculateDecisionScore(
  evaluations: Array<{ optionName: string; scores: DecisionEvaluationScores }>
): number {
  if (evaluations.length === 0) return 0;
  const best = Math.max(...evaluations.map((e) => e.scores.overallScore));
  return Math.max(0, Math.min(100, best));
}

// ─── scoreToLabel ─────────────────────────────────────────────────────────────

export function scoreToLabel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 80) return "critical"; // high urgency to act on recommendation
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}
