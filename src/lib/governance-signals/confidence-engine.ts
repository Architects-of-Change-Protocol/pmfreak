// ─────────────────────────────────────────────────────────────────────────────
// Signal Confidence Engine
//
// Calculates a 0.0–1.0 confidence score for a detected signal based on:
//   40% — Pattern Match: how precisely the observation matches the signal rule
//   30% — Evidence Strength: volume and quality of supporting evidence
//   20% — Historical Frequency: how often this type has occurred before
//   10% — Current Context: contextual adjustment factors
// ─────────────────────────────────────────────────────────────────────────────

export type ConfidenceFactors = {
  patternMatch: number;       // 0.0–1.0 — rule match precision
  evidenceStrength: number;   // 0.0–1.0 — derived from evidence count/weight
  historicalFrequency: number;// 0.0–1.0 — prior occurrences of this type
  currentContext: number;     // 0.0–1.0 — contextual boosters/reducers
};

export type ConfidenceResult = {
  score: number;
  factors: ConfidenceFactors;
};

function clamp(v: number): number {
  return Math.min(1.0, Math.max(0.0, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function calculateSignalConfidence(factors: ConfidenceFactors): ConfidenceResult {
  const score = round3(
    clamp(factors.patternMatch)        * 0.40 +
    clamp(factors.evidenceStrength)    * 0.30 +
    clamp(factors.historicalFrequency) * 0.20 +
    clamp(factors.currentContext)      * 0.10,
  );
  return { score, factors };
}

// ─── Evidence Strength Derivation ─────────────────────────────────────────────

export function deriveEvidenceStrength(evidence: Array<{ contributionWeight: number }>): number {
  if (evidence.length === 0) return 0.0;
  const avgWeight = evidence.reduce((s, e) => s + e.contributionWeight, 0) / evidence.length;
  // Scale by evidence count — more pieces of evidence = stronger
  const countFactor = Math.min(1.0, evidence.length / 5);
  return round3(avgWeight * 0.70 + countFactor * 0.30);
}

// ─── Historical Frequency Derivation ─────────────────────────────────────────

export function deriveHistoricalFrequency(priorOccurrences: number): number {
  // 0 prior → 0.2 (small base for new detections)
  // 1 prior → 0.4
  // 3 prior → 0.7
  // 5+ prior → 1.0
  if (priorOccurrences === 0) return 0.20;
  return round3(Math.min(1.0, 0.20 + priorOccurrences * 0.16));
}

// ─── Context Adjustment ───────────────────────────────────────────────────────

export function deriveContextAdjustment(options: {
  durationDays: number;
  isCriticalEntity: boolean;
  hasRelatedActiveSignals: boolean;
}): number {
  let base = 0.50;
  // Longer duration increases confidence that the issue is real
  if (options.durationDays >= 14) base += 0.30;
  else if (options.durationDays >= 7) base += 0.20;
  else if (options.durationDays >= 3) base += 0.10;

  if (options.isCriticalEntity) base += 0.10;
  if (options.hasRelatedActiveSignals) base += 0.10;

  return round3(Math.min(1.0, base));
}
