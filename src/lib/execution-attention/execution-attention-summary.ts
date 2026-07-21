import type { ExecutionTaskRow } from "@/lib/db/database-contract";
import { isTaskDueToday, isTaskOverdue } from "./classify-task-attention";
import type { ClassifiedExecutionTask, ExecutionAttentionSummary } from "./types";

/**
 * Real counts only — every number here is a length of an actual filtered
 * array, never a percentage, score, or "health" figure. Each count also
 * doubles as the corresponding quick filter's predicate (see
 * matchesAttentionFilter), so "3 overdue" always means exactly the 3 tasks
 * the Overdue filter would show.
 */
export function summarizeExecutionAttention<T extends ExecutionTaskRow>(
  classified: ClassifiedExecutionTask<T>[],
  now: Date,
): ExecutionAttentionSummary {
  let needsAttention = 0;
  let inProgress = 0;
  let dueToday = 0;
  let overdue = 0;
  let blocked = 0;
  let unassigned = 0;

  for (const entry of classified) {
    if (entry.attention.requiresAttention) needsAttention += 1;
    if (entry.task.status === "in_progress") inProgress += 1;
    if (isTaskDueToday(entry.task, now)) dueToday += 1;
    if (isTaskOverdue(entry.task, now)) overdue += 1;
    if (entry.task.status === "blocked") blocked += 1;
    if (entry.attention.reasons.includes("unassigned")) unassigned += 1;
  }

  return { needsAttention, inProgress, dueToday, overdue, blocked, unassigned };
}
