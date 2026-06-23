import type { DecisionRecommendation, DecisionComparativeAnalysis, OperationalDecisionSupport } from "./types";

// ─── generateOperationalDecisionSupport ──────────────────────────────────────
// Generates human-actionable decision support from recommendation + comparative analysis.

export function generateOperationalDecisionSupport(input: {
  decisionId:    string;
  recommendation: DecisionRecommendation;
  comparative:   DecisionComparativeAnalysis;
}): OperationalDecisionSupport {
  const because: string[] = [];

  because.push(`Highest overall score among evaluated alternatives (${input.recommendation.score}/100).`);

  if (input.comparative.ranked.length > 1) {
    const second = input.comparative.ranked[1];
    const diff   = input.recommendation.score - second.score;
    because.push(
      `Outperforms next option (${second.optionName}) by ${diff} points — clear decisional advantage.`
    );
  }

  because.push(input.recommendation.rationale);

  if (input.recommendation.confidence >= 0.7) {
    because.push(`High confidence (${Math.round(input.recommendation.confidence * 100)}%) — recommendation is well-supported by available evidence.`);
  } else if (input.recommendation.confidence >= 0.4) {
    because.push(`Moderate confidence (${Math.round(input.recommendation.confidence * 100)}%) — consider gathering additional evidence before committing.`);
  } else {
    because.push(`Low confidence (${Math.round(input.recommendation.confidence * 100)}%) — recommendation is indicative; human judgement is essential.`);
  }

  return {
    decisionId:        input.decisionId,
    recommendedOption: input.recommendation.optionName,
    because,
    confidence:        input.recommendation.confidence,
    score:             input.recommendation.score,
  };
}
