import { isTerminalStatus } from "@/lib/execution-tasks/lifecycle";
import type { ExecutionTaskRow } from "@/lib/db/database-contract";
import type { TaskAttentionClassification, TaskAttentionReason, TaskAttentionSeverity } from "./types";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Calendar-day comparison in the caller's local timezone (the `now` the
 * caller passes in — browser-local when called from client components).
 * Never compares raw ISO strings or UTC millis directly, so a due_date
 * stored as a UTC midnight timestamp does not read as "yesterday" for a
 * user west of UTC.
 */
function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isTaskOverdue(task: ExecutionTaskRow, now: Date): boolean {
  if (isTerminalStatus(task.status)) return false;
  if (!task.due_date) return false;
  const due = new Date(task.due_date);
  if (Number.isNaN(due.getTime())) return false;
  return startOfDay(due) < startOfDay(now);
}

export function isTaskDueToday(task: ExecutionTaskRow, now: Date): boolean {
  if (isTerminalStatus(task.status)) return false;
  if (!task.due_date) return false;
  const due = new Date(task.due_date);
  if (Number.isNaN(due.getTime())) return false;
  return isSameCalendarDay(due, now);
}

export function isTaskUpcoming(task: ExecutionTaskRow, now: Date): boolean {
  if (isTerminalStatus(task.status)) return false;
  if (!task.due_date) return false;
  const due = new Date(task.due_date);
  if (Number.isNaN(due.getTime())) return false;
  return startOfDay(due) > startOfDay(now);
}

/**
 * Deterministic, evidence-only classification — no AI, no opaque score.
 * Every reason maps directly to a persisted column (status, priority,
 * owner_user_id, due_date). Archived/completed/cancelled tasks never
 * require attention, regardless of how overdue their due_date is.
 */
export function classifyTaskAttention(task: ExecutionTaskRow, now: Date): TaskAttentionClassification {
  if (isTerminalStatus(task.status)) {
    return { requiresAttention: false, reasons: [], severity: "normal", sortRank: 900 };
  }

  const overdue = isTaskOverdue(task, now);
  const dueToday = isTaskDueToday(task, now);
  const blocked = task.status === "blocked";
  const highPriority = task.priority === "high" || task.priority === "critical";
  const unassigned = task.owner_user_id === null;

  const reasons: TaskAttentionReason[] = [];
  if (overdue) reasons.push("overdue");
  if (dueToday) reasons.push("due_today");
  if (blocked) reasons.push("blocked");
  if (highPriority) reasons.push("high_priority");
  if (unassigned) reasons.push("unassigned");

  const requiresAttention = reasons.length > 0;

  let severity: TaskAttentionSeverity = "normal";
  let sortRank = 800;

  if (overdue && blocked) {
    severity = "critical";
    sortRank = 0;
  } else if (overdue && task.priority === "critical") {
    severity = "critical";
    sortRank = 10;
  } else if (overdue) {
    severity = "high";
    sortRank = 20;
  } else if (blocked) {
    severity = "high";
    sortRank = 30;
  } else if (dueToday && highPriority) {
    severity = "high";
    sortRank = 40;
  } else if (dueToday) {
    severity = "normal";
    sortRank = 50;
  } else if (highPriority) {
    severity = "normal";
    sortRank = 60;
  } else if (unassigned) {
    severity = "normal";
    sortRank = 70;
  }

  return { requiresAttention, reasons, severity, sortRank };
}
