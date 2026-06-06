import type { ExecutionTaskRow } from "@/lib/db/database-contract";

export function computeTaskVariance(task: ExecutionTaskRow): number {
  if (!task.forecast_finish_date || !task.planned_finish_date) return 0;
  const forecast = new Date(task.forecast_finish_date).getTime();
  const planned = new Date(task.planned_finish_date).getTime();
  return Math.round((forecast - planned) / (1000 * 60 * 60 * 24));
}
