import type { ExecutionTaskPriority, ExecutionTaskStatus } from "@/lib/db/database-contract";

/**
 * The single UI label mapping for execution_tasks' DB enum values — every
 * surface that displays a task's status or priority imports this rather
 * than re-deriving its own labels.
 */

export const TASK_STATUS_LABELS: Record<ExecutionTaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Done",
  cancelled: "Cancelled",
};

export const TASK_PRIORITY_LABELS: Record<ExecutionTaskPriority, string> = {
  low: "Low",
  medium: "Normal",
  high: "High",
  critical: "Critical",
};

export const TASK_PRIORITY_ORDER: readonly ExecutionTaskPriority[] = ["low", "medium", "high", "critical"];
