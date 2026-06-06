import type { ExecutionTaskRow } from "@/lib/db/database-contract";
import type { ProjectForecast } from "./types";

export function computeProjectForecast(tasks: ExecutionTaskRow[]): ProjectForecast {
  let plannedFinishMs: number | null = null;
  let forecastFinishMs: number | null = null;

  for (const task of tasks) {
    if (task.planned_finish_date) {
      const t = new Date(task.planned_finish_date).getTime();
      if (plannedFinishMs === null || t > plannedFinishMs) plannedFinishMs = t;
    }
    if (task.forecast_finish_date) {
      const t = new Date(task.forecast_finish_date).getTime();
      if (forecastFinishMs === null || t > forecastFinishMs) forecastFinishMs = t;
    }
  }

  const plannedFinish = plannedFinishMs ? new Date(plannedFinishMs).toISOString() : null;
  const forecastFinish = forecastFinishMs ? new Date(forecastFinishMs).toISOString() : null;

  let varianceDays = 0;
  if (plannedFinishMs !== null && forecastFinishMs !== null) {
    varianceDays = Math.round((forecastFinishMs - plannedFinishMs) / (1000 * 60 * 60 * 24));
  }

  return { plannedFinish, forecastFinish, varianceDays };
}
