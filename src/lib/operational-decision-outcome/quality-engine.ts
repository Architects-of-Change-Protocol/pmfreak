import type { RecommendationQuality } from "./types";

// ─── calculateRecommendationQuality ──────────────────────────────────────────
// Maps effectiveness score (0–100) to a quality label.
//
//   0–20   → poor
//  21–40   → fair
//  41–60   → good
//  61–80   → very_good
//  81–100  → excellent

export function calculateRecommendationQuality(effectivenessScore: number): RecommendationQuality {
  if (effectivenessScore >= 81) return "excellent";
  if (effectivenessScore >= 61) return "very_good";
  if (effectivenessScore >= 41) return "good";
  if (effectivenessScore >= 21) return "fair";
  return "poor";
}
