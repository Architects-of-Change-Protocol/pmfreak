// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Effectiveness Engine — Sprint 5
// Calculates composite effectiveness scores from outcomes and feedback.
// Scale: 0.0 (completely ineffective) → 1.0 (fully effective).
// ─────────────────────────────────────────────────────────────────────────────

import type { RecommendationOutcomeStatus } from "./types";

export type OutcomeInput = {
  outcomeStatus: RecommendationOutcomeStatus;
  effectivenessScore: number;
};

export type FeedbackInput = {
  rating: number; // 1–5
};

export type EffectivenessScoreInput = {
  outcomes: OutcomeInput[];
  feedbacks: FeedbackInput[];
};

export type EffectivenessCalculation = {
  applicationsCount: number;
  successfulCount: number;
  failedCount: number;
  neutralCount: number;
  successRate: number;
  failureRate: number;
  neutralRate: number;
  averageEffectiveness: number;
};

// Translate outcome_status into a numeric contribution
function outcomeStatusWeight(status: RecommendationOutcomeStatus): number {
  switch (status) {
    case "successful": return 1.0;
    case "neutral":    return 0.5;
    case "failed":     return 0.0;
    case "unknown":    return 0.3;
  }
}

// Translate feedback rating (1–5) to 0.0–1.0
function feedbackWeight(rating: number): number {
  return Math.min(1.0, Math.max(0.0, (rating - 1) / 4));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function calculateEffectivenessScore(input: EffectivenessScoreInput): EffectivenessCalculation {
  const { outcomes, feedbacks } = input;

  const applicationsCount = outcomes.length;
  const successfulCount = outcomes.filter((o) => o.outcomeStatus === "successful").length;
  const failedCount = outcomes.filter((o) => o.outcomeStatus === "failed").length;
  const neutralCount = outcomes.filter((o) => o.outcomeStatus === "neutral").length;

  const successRate = applicationsCount > 0 ? round3(successfulCount / applicationsCount) : 0;
  const failureRate = applicationsCount > 0 ? round3(failedCount / applicationsCount) : 0;
  const neutralRate = applicationsCount > 0 ? round3(neutralCount / applicationsCount) : 0;

  // Outcome quality: average of individual outcome effectiveness scores
  const outcomeQuality =
    outcomes.length > 0
      ? round3(outcomes.reduce((s, o) => s + o.effectivenessScore, 0) / outcomes.length)
      : 0;

  // Status-based success rate (40%)
  const statusComponent = successRate * 0.40;

  // Outcome quality from recorded scores (30%)
  const qualityComponent = outcomeQuality * 0.30;

  // Feedback rating average (20%)
  const feedbackAvg =
    feedbacks.length > 0
      ? feedbacks.reduce((s, f) => s + feedbackWeight(f.rating), 0) / feedbacks.length
      : 0;
  const feedbackComponent = feedbackAvg * 0.20;

  // Outcome consistency: low variance in status means consistent (10%)
  const consistencyComponent =
    applicationsCount === 0 ? 0 : applicationsCount > 1 ? (1.0 - failureRate) * 0.10 : 0.05;

  const averageEffectiveness = round3(
    statusComponent + qualityComponent + feedbackComponent + consistencyComponent,
  );

  return {
    applicationsCount,
    successfulCount,
    failedCount,
    neutralCount,
    successRate,
    failureRate,
    neutralRate,
    averageEffectiveness,
  };
}

// Compute the initial effectiveness_score for a single outcome row
export function computeOutcomeEffectivenessScore(
  outcomeStatus: RecommendationOutcomeStatus,
  observedValue: number | null,
  expectedValue: number | null,
): number {
  const statusBase = outcomeStatusWeight(outcomeStatus);

  // If both values are present, use relative improvement to refine the score
  if (observedValue !== null && expectedValue !== null && expectedValue !== 0) {
    const ratio = Math.max(0, observedValue / expectedValue);
    // Blend status weight (70%) with value ratio (30%), capped at 1.0
    return round3(Math.min(1.0, statusBase * 0.70 + Math.min(1.0, ratio) * 0.30));
  }

  return round3(statusBase);
}
