import type { ExecutionTaskRow } from "@/lib/db/database-contract";
import { isTaskDueToday, isTaskOverdue } from "./classify-task-attention";
import type { TaskAttentionClassification } from "./types";

export type ExecutionAttentionFilter = "needs_attention" | "overdue" | "due_today" | "blocked" | "unassigned";

export const EXECUTION_ATTENTION_FILTERS: readonly ExecutionAttentionFilter[] = [
  "needs_attention",
  "overdue",
  "due_today",
  "blocked",
  "unassigned",
];

/** The same predicate the summary counters use — a summary chip's count and its filter always agree. */
export function matchesAttentionFilter<T extends ExecutionTaskRow>(
  task: T,
  attention: TaskAttentionClassification,
  filter: ExecutionAttentionFilter,
  now: Date,
): boolean {
  switch (filter) {
    case "needs_attention":
      return attention.requiresAttention;
    case "overdue":
      return isTaskOverdue(task, now);
    case "due_today":
      return isTaskDueToday(task, now);
    case "blocked":
      return task.status === "blocked";
    case "unassigned":
      return attention.reasons.includes("unassigned");
    default:
      return true;
  }
}
