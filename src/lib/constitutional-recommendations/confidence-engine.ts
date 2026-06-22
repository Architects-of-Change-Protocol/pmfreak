// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Confidence Engine
// Calculates recommendation confidence from pattern confidence, occurrence
// count, consistency, and evidence weight.
// ─────────────────────────────────────────────────────────────────────────────

import type { RecommendationConfidenceBreakdown } from "./types";

export type RecommendationConfidenceInput = {
  patternConfidence: number;
  occurrenceCount: number;
  avgContributionWeight: number;
  evidenceCount: number;
};

// patternConfidence (40%): inherited from the learning pattern
function weightPatternConfidence(patternConfidence: number): number {
  return Math.min(1.0, Math.max(0.0, patternConfidence));
}

// occurrenceWeight (30%): scales with how many times the pattern appeared
function weightOccurrence(occurrenceCount: number): number {
  if (occurrenceCount <= 1) return 0.2;
  if (occurrenceCount <= 3) return 0.4;
  if (occurrenceCount <= 7) return 0.6;
  if (occurrenceCount <= 15) return 0.8;
  return 1.0;
}

// consistencyWeight (20%): reflects average contribution weight from evidence
function weightConsistency(avgContributionWeight: number): number {
  return Math.min(1.0, Math.max(0.0, avgContributionWeight));
}

// evidenceWeight (10%): how many distinct learning patterns support this recommendation
function weightEvidence(evidenceCount: number): number {
  if (evidenceCount <= 0) return 0.0;
  if (evidenceCount === 1) return 0.4;
  if (evidenceCount <= 3) return 0.65;
  if (evidenceCount <= 5) return 0.85;
  return 1.0;
}

export function calculateRecommendationConfidence(
  input: RecommendationConfidenceInput,
): RecommendationConfidenceBreakdown {
  const patternConfidenceW = weightPatternConfidence(input.patternConfidence);
  const occurrenceWeightW = weightOccurrence(input.occurrenceCount);
  const consistencyWeightW = weightConsistency(input.avgContributionWeight);
  const evidenceWeightW = weightEvidence(input.evidenceCount);

  const overall = round3(
    patternConfidenceW * 0.40 +
    occurrenceWeightW * 0.30 +
    consistencyWeightW * 0.20 +
    evidenceWeightW * 0.10,
  );

  return {
    patternConfidence: round3(patternConfidenceW),
    occurrenceWeight: round3(occurrenceWeightW),
    consistencyWeight: round3(consistencyWeightW),
    evidenceWeight: round3(evidenceWeightW),
    overall,
  };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
