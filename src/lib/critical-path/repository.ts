import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXECUTION_TASK_SELECTABLE_COLUMNS,
  EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS,
  PROJECT_MILESTONE_SELECTABLE_COLUMNS,
  type ExecutionTaskRow,
  type ExecutionTaskDependencyRow,
  type ProjectMilestoneRow,
} from "@/lib/db/database-contract";
import { computeCriticalMilestones } from "./milestones";
import { computeProjectForecast } from "./forecast";
import { computeTaskVariance } from "./variance";
import { buildCriticalSubgraphFromMaps } from "./critical-subgraph";
import { computeTopologyFromSubgraph } from "./compute-critical-path";
import type {
  CriticalTask,
  CriticalMilestone,
  CriticalPathSummary,
  ProjectForecast,
  ScheduleVariance,
  CriticalPathSegment,
  CriticalPathBranchPoint,
  CriticalPathTopology,
} from "./types";

const TASK_SELECT = EXECUTION_TASK_SELECTABLE_COLUMNS.join(",");
const DEP_SELECT = EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS.join(",");
const MILESTONE_SELECT = PROJECT_MILESTONE_SELECTABLE_COLUMNS.join(",");

export type CriticalPathData = {
  summary: CriticalPathSummary;
  forecast: ProjectForecast;
  criticalTasks: CriticalTask[];
  criticalMilestones: CriticalMilestone[];
  path: string[];
  tasks: ExecutionTaskRow[];
  topVarianceTasks: ScheduleVariance[];
  criticalPaths: CriticalPathSegment[];
  criticalSegments: CriticalPathSegment[];
  branchPoints: CriticalPathBranchPoint[];
  topology: CriticalPathTopology;
};

export async function getProjectCriticalPath(projectId: string): Promise<
  { ok: true; data: CriticalPathData } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();

  const [tasksResult, depsResult, milestonesResult] = await Promise.all([
    supabase.from("execution_tasks").select(TASK_SELECT).eq("project_id", projectId).overrideTypes<ExecutionTaskRow[], { merge: false }>(),
    supabase
      .from("execution_task_dependencies")
      .select(DEP_SELECT)
      .eq("project_id", projectId)
      .eq("status", "active")
      .overrideTypes<ExecutionTaskDependencyRow[], { merge: false }>(),
    supabase.from("project_milestones").select(MILESTONE_SELECT).eq("project_id", projectId).overrideTypes<ProjectMilestoneRow[], { merge: false }>(),
  ]);

  if (tasksResult.error || depsResult.error || milestonesResult.error) {
    return { ok: false, error: "Failed to load critical path data." };
  }

  const tasks = tasksResult.data ?? [];
  const deps = depsResult.data ?? [];
  const milestones = milestonesResult.data ?? [];

  const criticalTasks: CriticalTask[] = tasks
    .filter((t) => t.is_critical)
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      totalFloat: t.total_float ?? 0,
      freeFloat: t.free_float ?? 0,
      earlyStart: t.early_start ?? 0,
      earlyFinish: t.early_finish ?? 0,
      lateStart: t.late_start ?? 0,
      lateFinish: t.late_finish ?? 0,
      criticalityScore: t.criticality_score ?? 0,
      varianceDays: t.variance_days ?? 0,
    }));

  const criticalityMap = new Map(
    tasks.map((t) => [
      t.id,
      { isCritical: t.is_critical, criticalityScore: t.criticality_score ?? 0 },
    ]),
  );

  const criticalMilestones = computeCriticalMilestones(milestones, tasks, criticalityMap);
  const forecast = computeProjectForecast(tasks);

  const path = criticalTasks
    .sort((a, b) => a.earlyStart - b.earlyStart)
    .map((t) => t.taskId);

  const maxCriticalFinish = criticalTasks.reduce((m, t) => Math.max(m, t.earlyFinish), 0);

  const topVarianceTasks: ScheduleVariance[] = tasks
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      plannedFinish: t.planned_finish_date,
      forecastFinish: t.forecast_finish_date,
      varianceDays: computeTaskVariance(t),
    }))
    .filter((v) => v.varianceDays !== 0)
    .sort((a, b) => b.varianceDays - a.varianceDays)
    .slice(0, 10);

  // Build successor/predecessor maps from active deps for topology computation
  const taskSet = new Set(tasks.map((t) => t.id));
  const successorMap = new Map<string, string[]>();
  const predecessorMap = new Map<string, string[]>();
  for (const t of tasks) {
    successorMap.set(t.id, []);
    predecessorMap.set(t.id, []);
  }
  for (const dep of deps) {
    if (!taskSet.has(dep.predecessor_task_id) || !taskSet.has(dep.successor_task_id)) continue;
    successorMap.get(dep.predecessor_task_id)!.push(dep.successor_task_id);
    predecessorMap.get(dep.successor_task_id)!.push(dep.predecessor_task_id);
  }

  const criticalSet = new Set(criticalTasks.map((t) => t.taskId));
  const subgraph = buildCriticalSubgraphFromMaps(successorMap, predecessorMap, criticalSet);
  const { criticalPaths, criticalSegments, branchPoints, topology } =
    computeTopologyFromSubgraph(subgraph);

  const scheduleConfidence = computeScheduleConfidence(tasks, forecast);

  const summary: CriticalPathSummary = {
    totalTasks: tasks.length,
    criticalTaskCount: criticalTasks.length,
    criticalMilestoneCount: criticalMilestones.filter((m) => m.isCritical || m.isDelayed).length,
    projectDurationDays: maxCriticalFinish,
    forecastVarianceDays: forecast.varianceDays,
    scheduleConfidence,
    criticalPathCount: criticalPaths.length,
    criticalComponentCount: topology.criticalComponentCount,
    hasMultipleCriticalPaths: topology.hasMultipleCriticalPaths,
    hasCriticalBranches: topology.hasCriticalBranches,
  };

  return {
    ok: true,
    data: {
      summary,
      forecast,
      criticalTasks,
      criticalMilestones,
      path,
      tasks,
      topVarianceTasks,
      criticalPaths,
      criticalSegments,
      branchPoints,
      topology,
    },
  };
}

function computeScheduleConfidence(tasks: ExecutionTaskRow[], forecast: ProjectForecast): number {
  if (tasks.length === 0) return 0;
  const scheduled = tasks.filter((t) => t.planned_finish_date).length;
  const scheduledRatio = scheduled / tasks.length;
  const variancePenalty = Math.min(50, Math.max(0, forecast.varianceDays) * 2);
  return Math.max(0, Math.round(scheduledRatio * 100 - variancePenalty));
}
