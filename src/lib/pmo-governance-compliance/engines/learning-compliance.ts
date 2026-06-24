import type { LearningComplianceInput } from "../types";

const DEFAULT_WHEN_NO_DATA = 75;
const MEMORY_WEIGHT        = 0.30;
const DIGEST_WEIGHT        = 0.30;
const LEARNING_WEIGHT      = 0.20;
const TRACE_WEIGHT         = 0.20;

export function calculateLearningCompliance(input: LearningComplianceInput): number {
  const { totalMemories, digestCount, learningCount, recommendationsWithTrace, totalRecommendations } = input;

  if (totalMemories === 0 && totalRecommendations === 0) return DEFAULT_WHEN_NO_DATA;

  const memoryPresence  = totalMemories          > 0 ? 1.0 : 0.0;
  const digestRate      = totalMemories          > 0 ? Math.min(digestCount   / totalMemories, 1.0) : 0.75;
  const learningRate    = totalMemories          > 0 ? Math.min(learningCount / totalMemories, 1.0) : 0.75;
  const traceRate       = totalRecommendations   > 0 ? recommendationsWithTrace / totalRecommendations : 0.75;

  const score =
    memoryPresence * MEMORY_WEIGHT   * 100 +
    digestRate     * DIGEST_WEIGHT   * 100 +
    learningRate   * LEARNING_WEIGHT * 100 +
    traceRate      * TRACE_WEIGHT    * 100;

  return Math.max(0, Math.min(100, Math.round(score)));
}
