import type {
  ProjectMilestoneRow,
  ExecutionTaskRow,
  ExecutionTaskDependencyRow,
  ProjectMilestoneType,
  ProjectMilestoneStatus,
  TaskScheduleStatus,
} from "@/lib/db/database-contract";

export type { ProjectMilestoneType, ProjectMilestoneStatus, TaskScheduleStatus };
export type { ProjectMilestoneRow };

export type ScheduledExecutionTaskRow = ExecutionTaskRow;

export type ScheduleSignalSeverity = "info" | "warning" | "critical";

export type ScheduleSignal = {
  severity: ScheduleSignalSeverity;
  code: string;
  message: string;
  taskId?: string;
  milestoneId?: string;
};

export type ScheduleHealth = {
  totalTasks: number;
  scheduledTasks: number;
  unscheduledTasks: number;
  delayedTasks: number;
  atRiskTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  milestoneCount: number;
  blockedMilestones: number;
  atRiskMilestones: number;
  completedMilestones: number;
  scheduleConfidence: number;
  signals: ScheduleSignal[];
};

export type ScheduleSummary = {
  milestones: ProjectMilestoneRow[];
  tasks: ScheduledExecutionTaskRow[];
  dependencies: ExecutionTaskDependencyRow[];
  health: ScheduleHealth;
};
