import type { PortfolioHealthInput } from "../types";

const CRITICAL_PROJECT_THRESHOLD = 45;
const CRITICAL_PENALTY_PER = 10;
const CRITICAL_PENALTY_MAX = 30;
const DEFAULT_WHEN_NO_DATA = 75;

export { CRITICAL_PROJECT_THRESHOLD };

export function calculatePMPortfolioHealth(input: PortfolioHealthInput): number {
  const { operatingHealthScores, criticalProjectCount } = input;

  if (operatingHealthScores.length === 0) return DEFAULT_WHEN_NO_DATA;

  const avgHealth =
    operatingHealthScores.reduce((sum, s) => sum + s, 0) / operatingHealthScores.length;

  const criticalPenalty = Math.min(criticalProjectCount * CRITICAL_PENALTY_PER, CRITICAL_PENALTY_MAX);

  return Math.max(0, Math.min(100, Math.round(avgHealth - criticalPenalty)));
}
