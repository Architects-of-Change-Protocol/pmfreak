import type { ExecutionScoreInput } from "../types";

const COMPLETION_BONUS_MAX = 10;
const OVERDUE_PENALTY_PER = 2;
const OVERDUE_PENALTY_MAX = 20;
const DEFAULT_WHEN_NO_DATA = 75;

export function calculatePMExecutionScore(input: ExecutionScoreInput): number {
  const { executionHealthScores, totalTasks, completedTasks, overdueTasks } = input;

  if (executionHealthScores.length === 0) return DEFAULT_WHEN_NO_DATA;

  const avgHealth =
    executionHealthScores.reduce((sum, s) => sum + s, 0) / executionHealthScores.length;

  const completionBonus =
    totalTasks > 0 ? (completedTasks / totalTasks) * COMPLETION_BONUS_MAX : 0;

  const overduePenalty = Math.min(overdueTasks * OVERDUE_PENALTY_PER, OVERDUE_PENALTY_MAX);

  return Math.max(0, Math.min(100, Math.round(avgHealth + completionBonus - overduePenalty)));
}
