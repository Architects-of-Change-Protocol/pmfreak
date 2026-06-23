import type { ProjectionConfidenceResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Engine
//
// Calculates projection confidence (0.0–1.0) based on:
//   - Historical similarity (how often this action type has been projected)
//   - Learning evidence (quality of patterns from prior commitments)
//   - Recommendation confidence
//   - Signal confidence
// ─────────────────────────────────────────────────────────────────────────────

type ConfidenceInput = {
  historicalSimilarity?:     number | null; // 0.0–1.0
  learningEvidence?:         number | null; // 0.0–1.0
  recommendationConfidence?: number | null; // 0.0–1.0
  signalConfidence?:         number | null; // 0.0–1.0
  actionTypeKnown:           boolean;
};

function clamp(v: number): number {
  return Math.max(0.0, Math.min(1.0, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function calculateProjectionConfidence(input: ConfidenceInput): ProjectionConfidenceResult {
  const factors: string[] = [];
  let score = 0.5; // baseline: moderate confidence

  // Known action type gives a solid baseline
  if (input.actionTypeKnown) {
    score += 0.15;
    factors.push("action_type:known");
  } else {
    score -= 0.10;
    factors.push("action_type:unknown");
  }

  // Historical similarity
  if (input.historicalSimilarity != null) {
    score += (input.historicalSimilarity - 0.5) * 0.30;
    factors.push(`historical_similarity:${input.historicalSimilarity.toFixed(2)}`);
  }

  // Learning evidence
  if (input.learningEvidence != null) {
    score += (input.learningEvidence - 0.5) * 0.20;
    factors.push(`learning_evidence:${input.learningEvidence.toFixed(2)}`);
  }

  // Recommendation confidence
  if (input.recommendationConfidence != null) {
    score += (input.recommendationConfidence - 0.5) * 0.20;
    factors.push(`recommendation_confidence:${input.recommendationConfidence.toFixed(2)}`);
  }

  // Signal confidence
  if (input.signalConfidence != null) {
    score += (input.signalConfidence - 0.5) * 0.15;
    factors.push(`signal_confidence:${input.signalConfidence.toFixed(2)}`);
  }

  return { score: round3(clamp(score)), factors };
}
