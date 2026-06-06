import type { ExecutionTaskRow, ProjectMilestoneRow, RaidItemRow, ExecutionTaskDependencyRow } from "@/lib/db/database-contract";

export type ProjectRiskInput = {
  tasks: ExecutionTaskRow[];
  milestones: ProjectMilestoneRow[];
  raidItems: RaidItemRow[];
  dependencies: ExecutionTaskDependencyRow[];
  crossProjectDependencyCount: number;
  nowMs?: number;
};

// Returns 0-100; higher = worse
export function computeProjectRiskScore(input: ProjectRiskInput): number {
  const { tasks, milestones, raidItems, dependencies, crossProjectDependencyCount, nowMs = 0 } = input;

  const active = tasks.filter((t) => t.status !== "cancelled");
  const now = nowMs;

  const blocked = active.filter((t) => t.status === "blocked").length;
  const overdue = active.filter(
    (t) => t.due_date && t.status !== "completed" && new Date(t.due_date).getTime() < now,
  ).length;
  const criticalCount = active.filter((t) => t.is_critical).length;
  const openRaid = raidItems.filter((r) => r.status === "open" || r.status === "monitoring").length;
  const blockedMilestones = milestones.filter((m) => m.status === "blocked").length;
  const activeDeps = dependencies.filter((d) => d.status === "active" || d.status === "proposed").length;

  const blockedRatio = active.length > 0 ? blocked / active.length : 0;
  const overdueRatio = active.length > 0 ? overdue / active.length : 0;
  const criticalDensity = active.length > 0 ? criticalCount / active.length : 0;
  const raidPenalty = Math.min(1, openRaid / 10);
  const dependencyConcentration = Math.min(1, (activeDeps + crossProjectDependencyCount) / 20);
  const milestonePenalty = milestones.length > 0 ? blockedMilestones / milestones.length : 0;

  const score =
    blockedRatio * 30 +
    overdueRatio * 25 +
    criticalDensity * 15 +
    raidPenalty * 15 +
    dependencyConcentration * 10 +
    milestonePenalty * 5;

  return Math.round(Math.min(100, Math.max(0, score * 100)));
}

export function computeScheduleVarianceDays(tasks: ExecutionTaskRow[]): number {
  const variances = tasks
    .filter((t) => t.variance_days !== null && t.variance_days !== undefined)
    .map((t) => t.variance_days as number);
  if (variances.length === 0) return 0;
  return Math.round(variances.reduce((a, b) => a + b, 0) / variances.length);
}
