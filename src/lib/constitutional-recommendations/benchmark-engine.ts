// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Benchmark Engine — Sprint 5
// Compares effectiveness across multiple recommendations.
// ─────────────────────────────────────────────────────────────────────────────

import type { RecommendationBenchmark } from "./types";

export type BenchmarkInput = {
  recommendationId: string;
  recommendationKey: string;
  title: string;
  averageEffectiveness: number;
  applicationsCount: number;
  confidenceScore: number;
};

export function benchmarkRecommendations(
  entries: BenchmarkInput[],
): RecommendationBenchmark[] {
  return entries
    .map((e) => ({
      recommendationId: e.recommendationId,
      recommendationKey: e.recommendationKey,
      title: e.title,
      averageEffectiveness: e.averageEffectiveness,
      applicationsCount: e.applicationsCount,
      confidenceScore: e.confidenceScore,
    }))
    .sort((a, b) => b.averageEffectiveness - a.averageEffectiveness);
}
