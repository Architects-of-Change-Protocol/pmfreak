import type { DecisionEvaluationScores } from "./types";

// ─── calculateDecisionConfidence ──────────────────────────────────────────────
// Estimates confidence in the recommended decision (0.0–1.0).
// Based on: evaluation spread, consequence confidence, data completeness.

export function calculateDecisionConfidence(input: {
  evaluations:           Array<{ optionName: string; scores: DecisionEvaluationScores }>;
  escalationProbability: number;
  impactScore:           number;
  alternativeCount:      number;
}): number {
  if (input.evaluations.length === 0) return 0;

  const scores     = input.evaluations.map((e) => e.scores.overallScore);
  const topScore   = Math.max(...scores);
  const secondBest = scores.length > 1 ? Math.max(...scores.filter((s) => s < topScore || scores.indexOf(s) !== scores.indexOf(topScore))) : 0;

  // Clear winner increases confidence
  const spread           = topScore - secondBest;
  const spreadConfidence = Math.min(spread / 30, 0.35);

  // Higher escalation probability = more data to evaluate → higher confidence
  const escalationConfidence = input.escalationProbability * 0.25;

  // High impact score means the situation is well-defined
  const impactConfidence = (input.impactScore / 100) * 0.20;

  // More alternatives evaluated = more thorough analysis
  const completenessConfidence = Math.min(input.alternativeCount / 3, 1) * 0.20;

  const raw = spreadConfidence + escalationConfidence + impactConfidence + completenessConfidence;
  return Math.max(0, Math.min(1, parseFloat(raw.toFixed(3))));
}
