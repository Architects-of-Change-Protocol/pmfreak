import type { RealityConfidenceResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Reality Confidence Engine
//
// Estimates confidence in the quality of observed reality data.
// Based on observation count, validation status, and source reliability.
// Score range: 0.0–1.0
// ─────────────────────────────────────────────────────────────────────────────

export function calculateRealityConfidence(input: {
  observationCount: number;
  isValidated: boolean;
  sourceReliability?: number;
}): RealityConfidenceResult {
  const { observationCount, isValidated, sourceReliability = 0.7 } = input;

  // Observation count contributes up to 0.5
  const obsScore = Math.min(1.0, observationCount / 5) * 0.5;

  // Validation status contributes 0.3
  const valScore = isValidated ? 0.3 : 0.0;

  // Source reliability contributes 0.2
  const srcScore = Math.max(0, Math.min(1, sourceReliability)) * 0.2;

  const raw = obsScore + valScore + srcScore;
  const score = Math.round(raw * 1000) / 1000;

  const factors: string[] = [];
  if (observationCount === 0) factors.push("No observations recorded.");
  else if (observationCount < 3) factors.push(`Only ${observationCount} observation(s) — limited evidence.`);
  if (!isValidated) factors.push("Reality has not been validated.");
  if (sourceReliability < 0.5) factors.push("Source reliability is low.");
  if (factors.length === 0) factors.push("Confidence is well-supported by evidence.");

  return {
    score:            Math.min(1.0, Math.max(0, score)),
    observationCount,
    validationStatus: isValidated,
    factors,
  };
}
