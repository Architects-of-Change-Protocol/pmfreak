import type { ExecutionTaskRow, ProjectMilestoneRow, ExecutionTaskDependencyRow } from "@/lib/db/database-contract";
import type { PortfolioBottleneck } from "./types";
import type { PortfolioDependencyRisk } from "./types";

export type BottleneckInput = {
  allTasks: ExecutionTaskRow[];
  allMilestones: ProjectMilestoneRow[];
  allDependencies: ExecutionTaskDependencyRow[];
  dependencyRisks: PortfolioDependencyRisk[];
};

export function computePortfolioBottlenecks(input: BottleneckInput): PortfolioBottleneck[] {
  const bottlenecks: PortfolioBottleneck[] = [
    ...computeTaskBottlenecks(input.allTasks, input.allDependencies),
    ...computeMilestoneBottlenecks(input.allMilestones, input.allTasks),
    ...computeProjectBottlenecks(input.dependencyRisks),
  ];

  return bottlenecks.sort((a, b) => b.impactScore - a.impactScore);
}

function computeTaskBottlenecks(
  tasks: ExecutionTaskRow[],
  dependencies: ExecutionTaskDependencyRow[],
): PortfolioBottleneck[] {
  const activeDeps = dependencies.filter(
    (d) => d.status === "active" || d.status === "proposed",
  );

  // Count successors per task (how many tasks this one blocks)
  const successorCounts = new Map<string, number>();
  for (const dep of activeDeps) {
    successorCounts.set(
      dep.predecessor_task_id,
      (successorCounts.get(dep.predecessor_task_id) ?? 0) + 1,
    );
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const bottlenecks: PortfolioBottleneck[] = [];

  for (const [taskId, count] of successorCounts) {
    if (count < 2) continue;
    const task = taskMap.get(taskId);
    if (!task) continue;

    const criticalMultiplier = task.is_critical ? 2 : 1;
    const blockedMultiplier = task.status === "blocked" ? 1.5 : 1;
    const impactScore = Math.round(count * criticalMultiplier * blockedMultiplier * 10);

    bottlenecks.push({
      entityType: "task",
      entityId: taskId,
      entityLabel: task.title,
      blockingCount: count,
      impactScore,
    });
  }

  return bottlenecks;
}

function computeMilestoneBottlenecks(
  milestones: ProjectMilestoneRow[],
  tasks: ExecutionTaskRow[],
): PortfolioBottleneck[] {
  // Count tasks gated by each milestone
  const milestoneCounts = new Map<string, number>();
  for (const task of tasks) {
    if (task.milestone_id) {
      milestoneCounts.set(task.milestone_id, (milestoneCounts.get(task.milestone_id) ?? 0) + 1);
    }
  }

  const bottlenecks: PortfolioBottleneck[] = [];

  for (const milestone of milestones) {
    const count = milestoneCounts.get(milestone.id) ?? 0;
    if (count < 2) continue;

    const riskMultiplier =
      milestone.status === "blocked" ? 2 : milestone.status === "at_risk" ? 1.5 : 1;
    const impactScore = Math.round(count * riskMultiplier * 8);

    bottlenecks.push({
      entityType: "milestone",
      entityId: milestone.id,
      entityLabel: milestone.title,
      blockingCount: count,
      impactScore,
    });
  }

  return bottlenecks;
}

function computeProjectBottlenecks(
  dependencyRisks: PortfolioDependencyRisk[],
): PortfolioBottleneck[] {
  // Aggregate per source project
  const projectBlocking = new Map<string, number>();
  for (const risk of dependencyRisks) {
    projectBlocking.set(
      risk.sourceProjectId,
      (projectBlocking.get(risk.sourceProjectId) ?? 0) + risk.dependencyCount,
    );
  }

  const bottlenecks: PortfolioBottleneck[] = [];

  for (const [projectId, totalBlocking] of projectBlocking) {
    if (totalBlocking < 2) continue;

    const riskMultiplier =
      dependencyRisks.find((r) => r.sourceProjectId === projectId)?.riskLevel === "critical"
        ? 3
        : dependencyRisks.find((r) => r.sourceProjectId === projectId)?.riskLevel === "high"
          ? 2
          : 1;

    const impactScore = Math.round(totalBlocking * riskMultiplier * 15);

    bottlenecks.push({
      entityType: "project",
      entityId: projectId,
      entityLabel: projectId,
      blockingCount: totalBlocking,
      impactScore,
    });
  }

  return bottlenecks;
}
