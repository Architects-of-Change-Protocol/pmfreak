import type {
  OutcomeComparison,
  OperationalDecisionOutcomeRow,
} from "./types";

// ─── compareDecisionOutcomes ──────────────────────────────────────────────────

export function compareDecisionOutcomes(
  outcomeA: OperationalDecisionOutcomeRow,
  outcomeB: OperationalDecisionOutcomeRow
): OutcomeComparison {
  const diff = outcomeA.effectiveness_score - outcomeB.effectiveness_score;

  let winner: "a" | "b" | "tie";
  if (Math.abs(diff) < 0.5) {
    winner = "tie";
  } else {
    winner = diff > 0 ? "a" : "b";
  }

  const ranking = [
    { outcomeId: outcomeA.id, rank: 0, effectivenessScore: outcomeA.effectiveness_score },
    { outcomeId: outcomeB.id, rank: 0, effectivenessScore: outcomeB.effectiveness_score },
  ]
    .sort((x, y) => y.effectivenessScore - x.effectivenessScore)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  return {
    outcomeA,
    outcomeB,
    effectivenessDifference: diff,
    winner,
    ranking,
  };
}
