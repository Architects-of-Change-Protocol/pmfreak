import type { ExecutionTaskRow } from "@/lib/db/database-contract";
import { isTaskUpcoming } from "./classify-task-attention";
import type { ExecutionSection, TaskAttentionClassification } from "./types";

/**
 * Section placement is derived, never stored. Needs Attention always wins
 * over In Progress — a blocked or overdue in-progress task is work that
 * needs a decision, not routine ongoing work, so it does not also show up
 * as "in progress" in a second place.
 */
export function resolveExecutionSection(
  task: ExecutionTaskRow,
  attention: TaskAttentionClassification,
  now: Date,
): ExecutionSection {
  if (task.status === "completed" || task.status === "cancelled") return "completed";
  if (attention.requiresAttention) return "needs_attention";
  if (task.status === "in_progress") return "in_progress";
  if (isTaskUpcoming(task, now)) return "upcoming";
  return "backlog";
}
