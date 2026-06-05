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

  const overdueTasks = activeTasks.filter(t =>
    t.planned_finish_date && new Date(t.planned_finish_date) < now
  ).length;

  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_DAYS * 86400000);
  const dueSoonTasks = activeTasks.filter(t =>
    t.planned_finish_date &&
    new Date(t.planned_finish_date) >= now &&
    new Date(t.planned_finish_date) <= dueSoonCutoff
  ).length;

  const delayedTasks = activeTasks.filter(t =>
    t.schedule_status === "delayed" ||
    (t.forecast_finish_date && t.planned_finish_date &&
      new Date(t.forecast_finish_date) > new Date(t.planned_finish_date))
  ).length;

  // At-risk: schedule_status=at_risk OR (has blocking dep and planned_finish within 7 days)
  const blockedTaskIds = new Set(
    input.dependencies
      .filter(d => (d.status === "active" || d.status === "proposed"))
      .map(d => d.successor_task_id)
  );

  const atRiskTasks = activeTasks.filter(t =>
    t.schedule_status === "at_risk" ||
    (blockedTaskIds.has(t.id) &&
      t.planned_finish_date &&
      new Date(t.planned_finish_date) <= dueSoonCutoff)
  ).length;

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

  // Schedule confidence: weighted composite
  const scheduleConfidence = computeConfidence({
    totalTasks,
    scheduledTasks,
    milestones: input.milestones,
    delayedTasks,
    blockedMilestones,
    atRiskTasks,
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
  delayedTasks: number;
  blockedMilestones: number;
  atRiskTasks: number;
}): number {
  if (params.totalTasks === 0 && params.milestones.length === 0) return 0;

  let score = 100;

  // Penalize for unscheduled tasks
  const taskScheduleRate = params.totalTasks > 0
    ? params.scheduledTasks / params.totalTasks
    : 1;
  score *= taskScheduleRate;

  // Penalize for milestones without target dates
  const milestonesWithDates = params.milestones.filter(m => m.target_date !== null).length;
  const milestoneRate = params.milestones.length > 0
    ? milestonesWithDates / params.milestones.length
    : 1;
  score *= (0.7 + 0.3 * milestoneRate);

  // Penalize for delayed/at-risk work
  const problemTasks = params.delayedTasks + params.atRiskTasks + params.blockedMilestones;
  const totalProblems = params.totalTasks + params.milestones.length;
  if (totalProblems > 0) {
    const problemRate = problemTasks / totalProblems;
    score *= Math.max(0, 1 - problemRate);
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}
