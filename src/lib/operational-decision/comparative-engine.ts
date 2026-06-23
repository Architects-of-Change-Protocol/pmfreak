import type { DecisionEvaluationScores, DecisionComparativeAnalysis, OptionComparison } from "./types";

// ─── compareDecisionOptions ───────────────────────────────────────────────────
// Produces a ranked comparison of all evaluated alternatives.

export function compareDecisionOptions(
  evaluations: Array<{ optionName: string; scores: DecisionEvaluationScores }>
): DecisionComparativeAnalysis {
  if (evaluations.length === 0) {
    return { ranked: [], topOption: "", spread: 0 };
  }

  const sorted = [...evaluations].sort((a, b) => b.scores.overallScore - a.scores.overallScore);
  const topScore = sorted[0].scores.overallScore;
  const bottomScore = sorted[sorted.length - 1].scores.overallScore;

  const ranked: OptionComparison[] = sorted.map((e, i) => ({
    optionName:             e.optionName,
    score:                  e.scores.overallScore,
    rank:                   i + 1,
    scoreDifferenceFromTop: topScore - e.scores.overallScore,
  }));

  return {
    ranked,
    topOption: sorted[0].optionName,
    spread:    topScore - bottomScore,
  };
}
