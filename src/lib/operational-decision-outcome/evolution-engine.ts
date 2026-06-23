import type {
  RecommendationEvolutionRecord,
  EffectivenessLevel,
  RecommendationQuality,
  OperationalLearningFeedbackRow,
} from "./types";
import { classifyEffectivenessLevel } from "./effectiveness-engine";
import { calculateRecommendationQuality } from "./quality-engine";

// ─── updateRecommendationEffectiveness ───────────────────────────────────────
// Synthesises historical learning records for a decision into an evolution
// snapshot that future recommendation engines can consume.

export function updateRecommendationEffectiveness(params: {
  decisionId: string;
  workspaceId: string;
  effectivenessScore: number;
  learningRecords: OperationalLearningFeedbackRow[];
}): RecommendationEvolutionRecord {
  const { decisionId, workspaceId, effectivenessScore, learningRecords } = params;

  const effectivenessLevel: EffectivenessLevel = classifyEffectivenessLevel(effectivenessScore);
  const recommendationQuality: RecommendationQuality = calculateRecommendationQuality(effectivenessScore);

  // Majority vote on shouldRecommendAgain across all learning records.
  const recommendCount = learningRecords.filter(l => l.should_recommend_again).length;
  const shouldRecommendAgain = learningRecords.length === 0
    ? effectivenessScore >= 60
    : recommendCount > learningRecords.length / 2;

  return {
    decisionId,
    workspaceId,
    effectivenessScore,
    effectivenessLevel,
    recommendationQuality,
    shouldRecommendAgain,
    evidenceCount: learningRecords.length,
    updatedAt: new Date().toISOString(),
  };
}
