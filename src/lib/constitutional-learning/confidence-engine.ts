// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Learning — Confidence Engine
// Calculates pattern confidence based on frequency, coverage, consistency,
// and evidence strength.
// ─────────────────────────────────────────────────────────────────────────────

import type { LearningConfidenceBreakdown } from "./types";

export type ConfidenceInput = {
  occurrenceCount: number;
  totalDigests: number;
  avgContributionWeight: number;
  patternTypeCount: number;
};

// Frequency: how often this pattern appears relative to all digests
function calculateFrequency(occurrenceCount: number, totalDigests: number): number {
  if (totalDigests === 0) return 0;
  const ratio = occurrenceCount / totalDigests;
  // Sigmoid-like scaling: patterns seen in >50% of digests score near 1.0
  return Math.min(1.0, ratio * 2);
}

// Coverage: how broadly the pattern is evidenced across digest types
function calculateCoverage(occurrenceCount: number): number {
  if (occurrenceCount <= 1) return 0.2;
  if (occurrenceCount <= 3) return 0.4;
  if (occurrenceCount <= 7) return 0.65;
  if (occurrenceCount <= 15) return 0.8;
  return 1.0;
}

// Consistency: measured by the average contribution weight from evidence rows
function calculateConsistency(avgContributionWeight: number): number {
  return Math.min(1.0, avgContributionWeight);
}

// Evidence strength: how many distinct pattern types co-occur
function calculateEvidenceStrength(patternTypeCount: number): number {
  if (patternTypeCount <= 1) return 0.3;
  if (patternTypeCount <= 2) return 0.55;
  if (patternTypeCount <= 4) return 0.75;
  return 1.0;
}

export function calculateLearningConfidence(
  input: ConfidenceInput,
): LearningConfidenceBreakdown {
  const frequency = calculateFrequency(input.occurrenceCount, input.totalDigests);
  const coverage = calculateCoverage(input.occurrenceCount);
  const consistency = calculateConsistency(input.avgContributionWeight);
  const evidenceStrength = calculateEvidenceStrength(input.patternTypeCount);

  const overall = round3(
    frequency * 0.35 +
    coverage * 0.30 +
    consistency * 0.20 +
    evidenceStrength * 0.15,
  );

  return {
    frequency: round3(frequency),
    coverage: round3(coverage),
    consistency: round3(consistency),
    evidenceStrength: round3(evidenceStrength),
    overall,
  };
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
