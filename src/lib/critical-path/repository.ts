import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXECUTION_TASK_SELECTABLE_COLUMNS,
  PROJECT_MILESTONE_SELECTABLE_COLUMNS,
  type ExecutionTaskRow,
  type ProjectMilestoneRow,
} from "@/lib/db/database-contract";
import { computeCriticalMilestones } from "./milestones";
import { computeProjectForecast } from "./forecast";
import { computeTaskVariance } from "./variance";
import type {
  CriticalTask,
  CriticalMilestone,
  CriticalPathSummary,
  ProjectForecast,
  ScheduleVariance,
} from "./types";

const TASK_SELECT = EXECUTION_TASK_SELECTABLE_COLUMNS.join(",");
const MILESTONE_SELECT = PROJECT_MILESTONE_SELECTABLE_COLUMNS.join(",");

export type CriticalPathData = {
  summary: CriticalPathSummary;
  forecast: ProjectForecast;
  criticalTasks: CriticalTask[];
  criticalMilestones: CriticalMilestone[];
  path: string[];
  tasks: ExecutionTaskRow[];
  topVarianceTasks: ScheduleVariance[];
};

export async function getProjectCriticalPath(projectId: string): Promise<
  { ok: true; data: CriticalPathData } | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient();

  const [tasksResult, milestonesResult] = await Promise.all([
    supabase.from("execution_tasks").select(TASK_SELECT).eq("project_id", projectId),
    supabase.from("project_milestones").select(MILESTONE_SELECT).eq("project_id", projectId),
  ]);

  if (tasksResult.error || milestonesResult.error) {
    return { ok: false, error: "Failed to load critical path data." };
  }

  const tasks = (tasksResult.data ?? []) as ExecutionTaskRow[];
  const milestones = (milestonesResult.data ?? []) as ProjectMilestoneRow[];

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
    tasks.map((t) => [t.id, { isCritical: t.is_critical, criticalityScore: t.criticality_score ?? 0 }]),
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

  const scheduleConfidence = computeScheduleConfidence(tasks, forecast);

  const summary: CriticalPathSummary = {
    totalTasks: tasks.length,
    criticalTaskCount: criticalTasks.length,
    criticalMilestoneCount: criticalMilestones.filter((m) => m.isCritical || m.isDelayed).length,
    projectDurationDays: maxCriticalFinish,
    forecastVarianceDays: forecast.varianceDays,
    scheduleConfidence,
  };

  return { ok: true, data: { summary, forecast, criticalTasks, criticalMilestones, path, tasks, topVarianceTasks } };
}

function computeScheduleConfidence(tasks: ExecutionTaskRow[], forecast: ProjectForecast): number {
  if (tasks.length === 0) return 0;
  const scheduled = tasks.filter((t) => t.planned_finish_date).length;
  const scheduledRatio = scheduled / tasks.length;
  const variancePenalty = Math.min(50, Math.max(0, forecast.varianceDays) * 2);
  return Math.max(0, Math.round(scheduledRatio * 100 - variancePenalty));
}
