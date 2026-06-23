// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Confidence Engine
//
// Calculates action confidence from signal confidence, recommendation
// confidence, learning pattern confidence, and historical effectiveness.
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export type ActionConfidenceFactors = {
  signalConfidence: number;        // 0.0–1.0
  recommendationConfidence: number; // 0.0–1.0 (0 if no linked recommendation)
  learningConfidence: number;      // 0.0–1.0 (0 if no learning pattern)
  historicalEffectiveness: number; // 0.0–1.0 (prior success rate for this action type)
};

export type ActionConfidenceResult = {
  score: number;
  reasoning: string[];
};

// Weights must sum to 1.0
const WEIGHT_SIGNAL          = 0.40;
const WEIGHT_RECOMMENDATION  = 0.25;
const WEIGHT_LEARNING        = 0.20;
const WEIGHT_HISTORICAL      = 0.15;

export function calculateActionConfidence(
  factors: ActionConfidenceFactors
): ActionConfidenceResult {
  const reasoning: string[] = [];

  const s = clamp(factors.signalConfidence);
  const r = clamp(factors.recommendationConfidence);
  const l = clamp(factors.learningConfidence);
  const h = clamp(factors.historicalEffectiveness);

  const score = round3(
    s * WEIGHT_SIGNAL +
    r * WEIGHT_RECOMMENDATION +
    l * WEIGHT_LEARNING +
    h * WEIGHT_HISTORICAL
  );

  reasoning.push(
    `Signal confidence: ${s.toFixed(3)} × ${WEIGHT_SIGNAL} = ${(s * WEIGHT_SIGNAL).toFixed(3)}`
  );
  reasoning.push(
    `Recommendation confidence: ${r.toFixed(3)} × ${WEIGHT_RECOMMENDATION} = ${(r * WEIGHT_RECOMMENDATION).toFixed(3)}`
  );
  reasoning.push(
    `Learning confidence: ${l.toFixed(3)} × ${WEIGHT_LEARNING} = ${(l * WEIGHT_LEARNING).toFixed(3)}`
  );
  reasoning.push(
    `Historical effectiveness: ${h.toFixed(3)} × ${WEIGHT_HISTORICAL} = ${(h * WEIGHT_HISTORICAL).toFixed(3)}`
  );
  reasoning.push(`Composite confidence score: ${score.toFixed(3)}`);

  return { score, reasoning };
}
