import type { ExecutionTaskRow, ProjectMilestoneRow, RaidItemRow, ExecutionTaskDependencyRow, ProjectRow } from "@/lib/db/database-contract";
import type { PortfolioSummary, PortfolioProjectHealth, PortfolioIntelligence } from "./types";
import { computeProjectHealthScore } from "./portfolio-health";
import { computeProjectRiskScore, computeScheduleVarianceDays } from "./portfolio-risk";
import { computeCrossProjectDependencies, buildCrossProjectDependencyCountMap, type TaskProjectMap } from "./portfolio-dependencies";
import { computePortfolioBottlenecks } from "./portfolio-bottlenecks";
import { computeRequiresExecutiveAttention, computeExecutiveAttentionQueue } from "./portfolio-prioritization";

export type ProjectDataBundle = {
  project: ProjectRow;
  tasks: ExecutionTaskRow[];
  milestones: ProjectMilestoneRow[];
  raidItems: RaidItemRow[];
  dependencies: ExecutionTaskDependencyRow[];
};

export function computePortfolioIntelligence(bundles: ProjectDataBundle[]): PortfolioIntelligence {
  const allTasks: ExecutionTaskRow[] = [];
  const allMilestones: ProjectMilestoneRow[] = [];
  const allDependencies: ExecutionTaskDependencyRow[] = [];

  for (const b of bundles) {
    allTasks.push(...b.tasks);
    allMilestones.push(...b.milestones);
    allDependencies.push(...b.dependencies);
  }

  const taskProjectMap: TaskProjectMap = new Map();
  for (const b of bundles) {
    for (const task of b.tasks) {
      taskProjectMap.set(task.id, b.project.id);
    }
  }

  const dependencyRisks = computeCrossProjectDependencies(allDependencies, taskProjectMap);
  const crossProjectCountMap = buildCrossProjectDependencyCountMap(dependencyRisks);

  const nowMs = Date.now();

  const projects: PortfolioProjectHealth[] = bundles.map((b) => {
    const activeTasks = b.tasks.filter((t) => t.status !== "cancelled");
    const blockedTaskCount = activeTasks.filter((t) => t.status === "blocked").length;
    const overdueTaskCount = activeTasks.filter(
      (t) =>
        t.due_date &&
        t.status !== "completed" &&
        new Date(t.due_date).getTime() < nowMs,
    ).length;
    const criticalTaskCount = activeTasks.filter((t) => t.is_critical).length;
    const unresolvedRaidCount = b.raidItems.filter(
      (r) => r.status === "open" || r.status === "monitoring",
    ).length;
    const scheduleVarianceDays = computeScheduleVarianceDays(b.tasks);
    const crossProjectDeps = crossProjectCountMap.get(b.project.id) ?? 0;

    const healthScore = computeProjectHealthScore({
      tasks: b.tasks,
      milestones: b.milestones,
      raidItems: b.raidItems,
      dependencies: b.dependencies,
      nowMs,
    });

    const riskScore = computeProjectRiskScore({
      tasks: b.tasks,
      milestones: b.milestones,
      raidItems: b.raidItems,
      dependencies: b.dependencies,
      crossProjectDependencyCount: crossProjectDeps,
      nowMs,
    });

    const criticalPathLength = b.tasks.filter((t) => t.is_critical).length;

    const projectHealth: PortfolioProjectHealth = {
      projectId: b.project.id,
      projectName: b.project.name,
      healthScore,
      riskScore,
      blockedTaskCount,
      overdueTaskCount,
      criticalTaskCount,
      criticalPathLength,
      unresolvedRaidCount,
      scheduleVarianceDays,
      requiresExecutiveAttention: false,
    };

    projectHealth.requiresExecutiveAttention = computeRequiresExecutiveAttention(projectHealth);
    return projectHealth;
  });

  const bottlenecks = computePortfolioBottlenecks({
    allTasks,
    allMilestones,
    allDependencies,
    dependencyRisks,
  });

  const executiveAttention = computeExecutiveAttentionQueue(projects);

  const portfolioHealthScore = projects.length === 0
    ? 100
    : Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / projects.length);

  const portfolioRiskScore = projects.length === 0
    ? 0
    : Math.round(projects.reduce((s, p) => s + p.riskScore, 0) / projects.length);

  const summary: PortfolioSummary = {
    projectCount: bundles.length,
    activeProjectCount: bundles.filter((b) => b.project.status === "active").length,
    blockedProjectCount: projects.filter((p) => p.blockedTaskCount > 0).length,
    delayedProjectCount: projects.filter((p) => p.scheduleVarianceDays > 0).length,
    criticalProjectCount: projects.filter((p) => p.criticalTaskCount > 0).length,
    portfolioHealthScore,
    portfolioRiskScore,
    criticalPathProjectCount: projects.filter((p) => p.criticalPathLength > 0).length,
    overdueTaskCount: allTasks.filter(
      (t) =>
        t.due_date &&
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        new Date(t.due_date).getTime() < nowMs,
    ).length,
    blockedTaskCount: allTasks.filter((t) => t.status === "blocked").length,
    unresolvedRaidCount: bundles.reduce(
      (s, b) => s + b.raidItems.filter((r) => r.status === "open" || r.status === "monitoring").length,
      0,
    ),
    lastUpdatedAt: new Date().toISOString(),
  };

  return { summary, projects, bottlenecks, dependencyRisks, executiveAttention };
}
