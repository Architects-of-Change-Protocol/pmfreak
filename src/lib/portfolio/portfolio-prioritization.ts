import type { PortfolioProjectHealth } from "./types";

const HEALTH_THRESHOLD = 50;
const RISK_THRESHOLD = 70;
const BLOCKED_TASK_THRESHOLD = 3;
const SCHEDULE_VARIANCE_THRESHOLD = 14;
const CRITICAL_PATH_THRESHOLD = 5;

export function computeRequiresExecutiveAttention(project: PortfolioProjectHealth): boolean {
  return (
    project.healthScore < HEALTH_THRESHOLD ||
    project.riskScore > RISK_THRESHOLD ||
    project.blockedTaskCount > BLOCKED_TASK_THRESHOLD ||
    project.scheduleVarianceDays > SCHEDULE_VARIANCE_THRESHOLD ||
    project.criticalPathLength > CRITICAL_PATH_THRESHOLD
  );
}

export function computeExecutiveAttentionQueue(
  projects: PortfolioProjectHealth[],
): PortfolioProjectHealth[] {
  return projects
    .filter((p) => p.requiresExecutiveAttention)
    .sort((a, b) => {
      const scoreA = priorityScore(a);
      const scoreB = priorityScore(b);
      return scoreB - scoreA;
    });
}

function priorityScore(p: PortfolioProjectHealth): number {
  return (
    (100 - p.healthScore) * 0.4 +
    p.riskScore * 0.3 +
    Math.min(100, p.blockedTaskCount * 10) * 0.15 +
    Math.min(100, p.scheduleVarianceDays * 2) * 0.15
  );
}
