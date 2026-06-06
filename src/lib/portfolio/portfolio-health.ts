import type { ExecutionTaskRow, ProjectMilestoneRow, RaidItemRow, ExecutionTaskDependencyRow } from "@/lib/db/database-contract";

export type ProjectHealthInput = {
  tasks: ExecutionTaskRow[];
  milestones: ProjectMilestoneRow[];
  raidItems: RaidItemRow[];
  dependencies: ExecutionTaskDependencyRow[];
  nowMs?: number;
};

// 30% schedule + 25% execution + 20% dependency + 15% RAID + 10% milestone
export function computeProjectHealthScore(input: ProjectHealthInput): number {
  const { tasks, milestones, raidItems, dependencies, nowMs } = input;

  const scheduleScore = computeScheduleHealth(tasks, nowMs);
  const executionScore = computeExecutionHealth(tasks);
  const dependencyScore = computeDependencyHealth(dependencies, tasks);
  const raidScore = computeRaidHealth(raidItems);
  const milestoneScore = computeMilestoneHealth(milestones);

  const weighted =
    scheduleScore * 0.30 +
    executionScore * 0.25 +
    dependencyScore * 0.20 +
    raidScore * 0.15 +
    milestoneScore * 0.10;

  return Math.round(Math.min(100, Math.max(0, weighted)));
}

function computeScheduleHealth(tasks: ExecutionTaskRow[], nowMs = 0): number {
  if (tasks.length === 0) return 100;
  const now = nowMs;
  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      t.status !== "completed" &&
      t.status !== "cancelled" &&
      new Date(t.due_date).getTime() < now,
  ).length;
  const delayed = tasks.filter((t) => t.schedule_status === "delayed" || t.schedule_status === "at_risk").length;
  const penalty = ((overdue * 10) + (delayed * 5)) / tasks.length;
  return Math.max(0, 100 - penalty * 100);
}

function computeExecutionHealth(tasks: ExecutionTaskRow[]): number {
  if (tasks.length === 0) return 100;
  const active = tasks.filter((t) => t.status !== "cancelled");
  if (active.length === 0) return 100;
  const blocked = active.filter((t) => t.status === "blocked").length;
  const completed = active.filter((t) => t.status === "completed").length;
  const blockedRatio = blocked / active.length;
  const completionRatio = completed / active.length;
  return Math.max(0, (1 - blockedRatio) * 60 + completionRatio * 40) * 100 / 100;
}

function computeDependencyHealth(
  dependencies: ExecutionTaskDependencyRow[],
  tasks: ExecutionTaskRow[],
): number {
  const activeDeps = dependencies.filter((d) => d.status === "active" || d.status === "proposed");
  if (activeDeps.length === 0) return 100;
  const blockedTasks = new Set(tasks.filter((t) => t.status === "blocked").map((t) => t.id));
  const riskyDeps = activeDeps.filter(
    (d) => blockedTasks.has(d.predecessor_task_id) || blockedTasks.has(d.successor_task_id),
  ).length;
  const ratio = riskyDeps / activeDeps.length;
  return Math.max(0, Math.round((1 - ratio) * 100));
}

function computeRaidHealth(raidItems: RaidItemRow[]): number {
  const unresolved = raidItems.filter((r) => r.status === "open" || r.status === "monitoring").length;
  if (unresolved === 0) return 100;
  const penalty = Math.min(100, unresolved * 8);
  return Math.max(0, 100 - penalty);
}

function computeMilestoneHealth(milestones: ProjectMilestoneRow[]): number {
  if (milestones.length === 0) return 100;
  const blocked = milestones.filter((m) => m.status === "blocked" || m.status === "at_risk").length;
  const ratio = blocked / milestones.length;
  return Math.max(0, Math.round((1 - ratio) * 100));
}
