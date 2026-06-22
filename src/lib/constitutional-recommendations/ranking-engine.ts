// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Ranking Engine — Sprint 5
// Ranks recommendations by composite score: effectiveness, confidence,
// usage, and consistency.
// ─────────────────────────────────────────────────────────────────────────────

import type { RecommendationRankEntry } from "./types";

export type RankingInput = {
  recommendationId: string;
  recommendationKey: string;
  title: string;
  averageEffectiveness: number;
  confidenceScore: number;
  applicationsCount: number;
  successRate: number;
};

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function usageScore(applicationsCount: number): number {
  if (applicationsCount === 0) return 0.0;
  if (applicationsCount <= 5) return 0.3;
  if (applicationsCount <= 20) return 0.6;
  if (applicationsCount <= 50) return 0.85;
  return 1.0;
}

// rankScore = effectiveness (40%) + confidence (30%) + usage (20%) + consistency (10%)
function computeRankScore(entry: RankingInput): number {
  const effectivenessComponent = entry.averageEffectiveness * 0.40;
  const confidenceComponent = entry.confidenceScore * 0.30;
  const usageComponent = usageScore(entry.applicationsCount) * 0.20;
  const consistencyComponent = entry.successRate * 0.10;
  return round3(effectivenessComponent + confidenceComponent + usageComponent + consistencyComponent);
}

export function rankRecommendations(entries: RankingInput[]): RecommendationRankEntry[] {
  return entries
    .map((e) => ({
      rank: 0,
      recommendationId: e.recommendationId,
      recommendationKey: e.recommendationKey,
      title: e.title,
      rankScore: computeRankScore(e),
      averageEffectiveness: e.averageEffectiveness,
      confidenceScore: e.confidenceScore,
      applicationsCount: e.applicationsCount,
    }))
    .sort((a, b) => b.rankScore - a.rankScore)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}
