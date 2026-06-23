import type { DecisionAlternative, DecisionEvaluationScores, DecisionRecommendation } from "./types";

// ─── selectRecommendedDecision ────────────────────────────────────────────────
// Selects the best alternative based on overall_score and produces a
// human-readable rationale explaining why it was chosen.

export function selectRecommendedDecision(input: {
  alternatives:  DecisionAlternative[];
  evaluations:   Array<{ optionName: string; scores: DecisionEvaluationScores }>;
  confidence:    number;
}): DecisionRecommendation | null {
  if (input.evaluations.length === 0) return null;

  const ranked   = [...input.evaluations].sort((a, b) => b.scores.overallScore - a.scores.overallScore);
  const best     = ranked[0];
  const alt      = input.alternatives.find((a) => a.optionName === best.optionName);

  if (!best || !alt) return null;

  const rationale = buildRationale(alt, best.scores, ranked);

  return {
    optionName: best.optionName,
    score:      best.scores.overallScore,
    confidence: input.confidence,
    rationale,
  };
}

// ─── buildRationale ───────────────────────────────────────────────────────────

function buildRationale(
  alt:     DecisionAlternative,
  scores:  DecisionEvaluationScores,
  ranked:  Array<{ optionName: string; scores: DecisionEvaluationScores }>
): string {
  const parts: string[] = [];

  parts.push(`Recommended: ${alt.optionName} (score: ${scores.overallScore}/100).`);
  parts.push(alt.optionDescription);

  const topDimension = getTopDimension(scores);
  parts.push(`Highest-scoring dimension: ${topDimension}.`);

  if (ranked.length > 1) {
    const second = ranked[1];
    const diff   = scores.overallScore - second.scores.overallScore;
    parts.push(
      `Leads next alternative (${second.optionName}) by ${diff} points.`
    );
  }

  if (alt.estimatedRisk === "low") {
    parts.push("Estimated risk is low — safe to proceed.");
  } else if (alt.estimatedRisk === "critical") {
    parts.push("Warning: estimated risk is critical — consider mitigations before proceeding.");
  }

  return parts.join(" ");
}

function getTopDimension(scores: DecisionEvaluationScores): string {
  const dims = [
    { name: "governance", value: scores.governanceScore },
    { name: "execution",  value: scores.executionScore  },
    { name: "risk",       value: scores.riskScore       },
    { name: "health",     value: scores.healthScore     },
  ];
  const top = dims.reduce((a, b) => (a.value >= b.value ? a : b));
  return top.name;
}
