// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Adaptation Engine — Sprint 5
// Adjusts recommendation confidence_score using observed effectiveness.
// Rule 7: confidence_adjusted never exceeds 1.0.
// Rule 8: confidence_adjusted never falls below 0.0.
// ─────────────────────────────────────────────────────────────────────────────

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export type ConfidenceAdaptationInput = {
  originalConfidence: number;
  observedEffectiveness: number;
  applicationsCount: number;
};

export type ConfidenceAdaptationResult = {
  originalConfidence: number;
  observedEffectiveness: number;
  confidenceAdjustment: number;
  newConfidence: number;
  rule: "high_effectiveness" | "low_effectiveness" | "medium_effectiveness";
};

// Rule A: effectiveness > 0.80 → increase confidence
// Rule B: effectiveness < 0.50 → reduce confidence
// Rule C: 0.50–0.80 → maintain stability (minor adjustment)
export function adaptRecommendationConfidence(
  input: ConfidenceAdaptationInput,
): ConfidenceAdaptationResult {
  const { originalConfidence, observedEffectiveness, applicationsCount } = input;

  // Weight of adaptation scales with evidence volume (more applications = more trust)
  const evidenceWeight = Math.min(1.0, applicationsCount / 10);

  let adjustment: number;
  let rule: ConfidenceAdaptationResult["rule"];

  if (observedEffectiveness > 0.80) {
    // High effectiveness: push confidence toward effectiveness, bounded by evidence
    const delta = (observedEffectiveness - originalConfidence) * 0.30 * evidenceWeight;
    adjustment = round3(delta);
    rule = "high_effectiveness";
  } else if (observedEffectiveness < 0.50) {
    // Low effectiveness: reduce confidence proportionally
    const delta = (observedEffectiveness - originalConfidence) * 0.40 * evidenceWeight;
    adjustment = round3(delta); // negative
    rule = "low_effectiveness";
  } else {
    // Medium effectiveness: nudge toward effectiveness with dampening
    const delta = (observedEffectiveness - originalConfidence) * 0.10 * evidenceWeight;
    adjustment = round3(delta);
    rule = "medium_effectiveness";
  }

  const newConfidence = round3(
    Math.min(1.0, Math.max(0.0, originalConfidence + adjustment)),
  );

  return {
    originalConfidence: round3(originalConfidence),
    observedEffectiveness: round3(observedEffectiveness),
    confidenceAdjustment: adjustment,
    newConfidence,
    rule,
  };
}
