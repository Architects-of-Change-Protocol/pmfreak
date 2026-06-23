import type { ProjectionTaskTemplate, ProjectionEffortEstimate } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Effort Engine
//
// Calculates estimated effort from a list of projection task templates.
// Hours per day is fixed at 6 (governance work is not 8h/day due to overhead).
// ─────────────────────────────────────────────────────────────────────────────

const GOVERNANCE_HOURS_PER_DAY = 6;

export function calculateProjectionEffort(tasks: ProjectionTaskTemplate[]): ProjectionEffortEstimate {
  const taskCount      = tasks.length;
  const estimatedHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  const estimatedDays  = Math.max(1, Math.ceil(estimatedHours / GOVERNANCE_HOURS_PER_DAY));
  return { taskCount, estimatedHours, estimatedDays };
}
