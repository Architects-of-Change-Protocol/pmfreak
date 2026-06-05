import type {
  ProjectMilestoneRow,
  ExecutionTaskDependencyRow,
} from "@/lib/db/database-contract";
import type { ScheduledExecutionTaskRow, ScheduleHealth, ScheduleSignal } from "./types";

const TERMINAL_TASK_STATUSES = new Set(["completed", "cancelled"]);
const DUE_SOON_DAYS = 7;

export function computeScheduleHealth(input: {
  tasks: ScheduledExecutionTaskRow[];
  milestones: ProjectMilestoneRow[];
  dependencies: ExecutionTaskDependencyRow[];
  now?: Date;
}): ScheduleHealth {
  const now = input.now ?? new Date();
  const signals: ScheduleSignal[] = [];

  const activeTasks = input.tasks.filter(t => !TERMINAL_TASK_STATUSES.has(t.status));
  const totalTasks = activeTasks.length;

  const scheduledTasks = activeTasks.filter(t =>
    t.planned_finish_date !== null && t.schedule_status !== "unscheduled"
  ).length;
  const unscheduledTasks = totalTasks - scheduledTasks;

  const overdueTaskIds = new Set(
    activeTasks
      .filter(t => t.planned_finish_date && new Date(t.planned_finish_date) < now)
      .map(t => t.id)
  );
  const overdueTasks = overdueTaskIds.size;

  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_DAYS * 86400000);
  const dueSoonTasks = activeTasks.filter(t =>
    t.planned_finish_date &&
    new Date(t.planned_finish_date) >= now &&
    new Date(t.planned_finish_date) <= dueSoonCutoff
  ).length;

  const delayedTaskIds = new Set(
    activeTasks
      .filter(t =>
        t.schedule_status === "delayed" ||
        (t.forecast_finish_date && t.planned_finish_date &&
          new Date(t.forecast_finish_date) > new Date(t.planned_finish_date))
      )
      .map(t => t.id)
  );
  const delayedTasks = delayedTaskIds.size;

  // Only active dependencies block tasks; proposed dependencies are suggestions only.
  const blockedTaskIds = new Set(
    input.dependencies
      .filter(d => d.status === "active")
      .map(d => d.successor_task_id)
  );

  const atRiskTaskIds = new Set(
    activeTasks
      .filter(t =>
        t.schedule_status === "at_risk" ||
        (blockedTaskIds.has(t.id) &&
          t.planned_finish_date &&
          new Date(t.planned_finish_date) <= dueSoonCutoff)
      )
      .map(t => t.id)
  );
  const atRiskTasks = atRiskTaskIds.size;

  // Milestone health
  const milestoneCount = input.milestones.length;
  const activeMilestones = input.milestones.filter(m => m.status !== "completed" && m.status !== "cancelled");

  const blockedMilestones = input.milestones.filter(m => m.status === "blocked").length;

  // Milestone at risk: target_date < now and not completed/cancelled OR linked tasks delayed/blocked
  const linkedTasksByMilestone = new Map<string, ScheduledExecutionTaskRow[]>();
  for (const t of input.tasks) {
    if (t.milestone_id) {
      const existing = linkedTasksByMilestone.get(t.milestone_id) ?? [];
      existing.push(t);
      linkedTasksByMilestone.set(t.milestone_id, existing);
    }
  }

  const atRiskMilestones = activeMilestones.filter(m => {
    if (m.target_date && new Date(m.target_date) < now) return true;
    const linked = linkedTasksByMilestone.get(m.id) ?? [];
    return linked.some(t =>
      t.schedule_status === "delayed" ||
      t.schedule_status === "at_risk" ||
      t.status === "blocked"
    );
  }).length;

  const completedMilestones = input.milestones.filter(m => m.status === "completed").length;

  // Signals
  if (overdueTasks > 0) {
    signals.push({
      severity: "critical",
      code: "overdue_tasks",
      message: `${overdueTasks} task(s) past planned finish date.`,
    });
  }

  if (delayedTasks > 0) {
    signals.push({
      severity: "warning",
      code: "delayed_tasks",
      message: `${delayedTasks} task(s) are delayed.`,
    });
  }

  if (dueSoonTasks > 0) {
    signals.push({
      severity: "info",
      code: "due_soon",
      message: `${dueSoonTasks} task(s) due within ${DUE_SOON_DAYS} days.`,
    });
  }

  if (unscheduledTasks > 0) {
    signals.push({
      severity: "info",
      code: "unscheduled_tasks",
      message: `${unscheduledTasks} task(s) have no planned dates.`,
    });
  }

  if (atRiskMilestones > 0) {
    signals.push({
      severity: "warning",
      code: "at_risk_milestones",
      message: `${atRiskMilestones} milestone(s) are at risk.`,
    });
  }

  // Unique problem task IDs across all problem categories (union, no double counting)
  const uniqueProblemTaskIds = new Set([...delayedTaskIds, ...atRiskTaskIds, ...overdueTaskIds]);

  const scheduleConfidence = computeConfidence({
    totalTasks,
    scheduledTasks,
    milestones: input.milestones,
    uniqueProblemTaskCount: uniqueProblemTaskIds.size,
  });

  return {
    totalTasks,
    scheduledTasks,
    unscheduledTasks,
    delayedTasks,
    atRiskTasks,
    overdueTasks,
    dueSoonTasks,
    milestoneCount,
    blockedMilestones,
    atRiskMilestones,
    completedMilestones,
    scheduleConfidence,
    signals,
  };
}

function computeConfidence(params: {
  totalTasks: number;
  scheduledTasks: number;
  milestones: ProjectMilestoneRow[];
  uniqueProblemTaskCount: number;
}): number {
  if (params.totalTasks === 0 && params.milestones.length === 0) return 0;

  // Task schedule completeness: 45 points
  // Full weight if no tasks exist (nothing to schedule).
  const taskCompletenessScore = params.totalTasks > 0
    ? 45 * (params.scheduledTasks / params.totalTasks)
    : 45;

  // Milestone date completeness: 25 points
  // Full weight if no milestones exist.
  const milestonesWithDates = params.milestones.filter(m => m.target_date !== null).length;
  const milestoneCompletenessScore = params.milestones.length > 0
    ? 25 * (milestonesWithDates / params.milestones.length)
    : 25;

  // Execution health: 30 points
  // Penalizes unique problematic tasks (delayed, at-risk, overdue) once each.
  const uniqueProblemRate = params.uniqueProblemTaskCount / Math.max(params.totalTasks, 1);
  const executionHealthScore = 30 * (1 - uniqueProblemRate);

  const score = taskCompletenessScore + milestoneCompletenessScore + executionHealthScore;
  return Math.round(Math.max(0, Math.min(100, score)));
}
