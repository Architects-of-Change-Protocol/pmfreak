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

/**
 * Formats a due_date (timestamptz, always midnight UTC for a date-only
 * value submitted via <input type="date">) as the calendar day the user
 * picked — never re-interpreted through the viewer's local timezone, which
 * would silently roll the displayed day back for anyone west of UTC.
 */
export function formatTaskDueDate(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString(undefined, { timeZone: "UTC" });
}
