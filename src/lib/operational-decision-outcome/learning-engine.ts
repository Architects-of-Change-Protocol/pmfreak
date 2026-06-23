import type {
  EffectivenessLevel,
  LearningFeedbackType,
  RecommendationQuality,
  OutcomeStatus,
} from "./types";

export type LearningFeedbackInput = {
  decisionId: string;
  decisionCategory: string;
  effectivenessScore: number;
  effectivenessLevel: EffectivenessLevel;
  recommendationQuality: RecommendationQuality;
  outcomeStatus: OutcomeStatus;
};

export type GeneratedLearning = {
  learningType: LearningFeedbackType;
  learningSummary: string;
  confidenceScore: number;
  shouldRecommendAgain: boolean;
};

// ─── generateOutcomeLearning ──────────────────────────────────────────────────

export function generateOutcomeLearning(input: LearningFeedbackInput): GeneratedLearning {
  const { decisionCategory, effectivenessScore, effectivenessLevel, recommendationQuality, outcomeStatus } = input;

  const shouldRecommendAgain = effectivenessScore >= 60;

  const confidenceScore = Math.round(
    Math.min(
      0.5 + (effectivenessScore / 100) * 0.5,
      1
    ) * 1000
  ) / 1000;

  let learningType: LearningFeedbackType;
  let learningSummary: string;

  if (effectivenessLevel === "excellent" || effectivenessLevel === "high") {
    learningType = "decision_pattern";
    learningSummary =
      `${decisionCategory} decisions of this type produced ${effectivenessLevel} effectiveness ` +
      `(score: ${effectivenessScore}). Outcome status: ${outcomeStatus}. ` +
      `Recommendation quality rated ${recommendationQuality}. ` +
      `This pattern is confirmed as a strong decision archetype for future reuse.`;
  } else if (effectivenessLevel === "medium") {
    learningType = "quality_signal";
    learningSummary =
      `${decisionCategory} decision achieved medium effectiveness (score: ${effectivenessScore}). ` +
      `Outcome status: ${outcomeStatus}. Recommendation quality: ${recommendationQuality}. ` +
      `Future recommendations in this category should incorporate additional evidence before recommending.`;
  } else {
    learningType = "effectiveness_signal";
    learningSummary =
      `${decisionCategory} decision produced ${effectivenessLevel} effectiveness ` +
      `(score: ${effectivenessScore}). Outcome status: ${outcomeStatus}. ` +
      `Recommendation quality: ${recommendationQuality}. ` +
      `This outcome should calibrate future recommendations downward for similar contexts.`;
  }

  return { learningType, learningSummary, confidenceScore, shouldRecommendAgain };
}
