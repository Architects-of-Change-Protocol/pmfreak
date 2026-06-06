import type { ExecutionTaskRow } from "@/lib/db/database-contract";

export function resolveTaskDuration(task: ExecutionTaskRow): number {
  if (task.planned_start_date && task.planned_finish_date) {
    const start = new Date(task.planned_start_date).getTime();
    const finish = new Date(task.planned_finish_date).getTime();
    const days = Math.round((finish - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, days);
  }
  return 1;
}
