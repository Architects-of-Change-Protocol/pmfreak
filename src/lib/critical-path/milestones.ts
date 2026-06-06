import type { ProjectMilestoneRow, ExecutionTaskRow } from "@/lib/db/database-contract";
import type { CriticalMilestone } from "./types";
import type { CriticalityMap } from "./compute-critical-path";

export function computeCriticalMilestones(
  milestones: ProjectMilestoneRow[],
  tasks: ExecutionTaskRow[],
  criticalityMap: CriticalityMap,
): CriticalMilestone[] {
  const tasksByMilestone = new Map<string, ExecutionTaskRow[]>();
  for (const task of tasks) {
    if (task.milestone_id) {
      const list = tasksByMilestone.get(task.milestone_id) ?? [];
      list.push(task);
      tasksByMilestone.set(task.milestone_id, list);
    }
  }

  return milestones.map((milestone) => {
    const linkedTasks = tasksByMilestone.get(milestone.id) ?? [];
    const linkedTaskIds = linkedTasks.map((t) => t.id);

    const hasCriticalTask = linkedTasks.some((t) => criticalityMap.get(t.id)?.isCritical ?? false);
    const hasDelayedTask = linkedTasks.some((t) => {
      if (!t.forecast_finish_date || !t.planned_finish_date) return false;
      const variance = new Date(t.forecast_finish_date).getTime() - new Date(t.planned_finish_date).getTime();
      return variance > 0;
    });

    const isCritical = hasCriticalTask;
    const isAtRisk = !isCritical && hasDelayedTask;

    let varianceDays = 0;
    if (milestone.forecast_date && milestone.target_date) {
      varianceDays = Math.round(
        (new Date(milestone.forecast_date).getTime() - new Date(milestone.target_date).getTime()) /
          (1000 * 60 * 60 * 24),
      );
    }

    const isDelayed = varianceDays > 0;

    return {
      milestoneId: milestone.id,
      title: milestone.title,
      targetDate: milestone.target_date,
      forecastDate: milestone.forecast_date,
      varianceDays,
      isCritical,
      isAtRisk,
      isDelayed,
      linkedTaskIds,
    };
  });
}
