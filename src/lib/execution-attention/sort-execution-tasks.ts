import { TASK_PRIORITY_ORDER } from "@/lib/execution-tasks/task-labels";
import type { ExecutionTaskRow } from "@/lib/db/database-contract";
import type { ClassifiedExecutionTask, ExecutionTaskSortMode } from "./types";

// TASK_PRIORITY_ORDER is ascending (low..critical) — using the index
// directly as the rank means a descending sort puts critical first.
const PRIORITY_RANK: Record<string, number> = Object.fromEntries(
  TASK_PRIORITY_ORDER.map((priority, index) => [priority, index]),
);

function compareTitle<T extends ExecutionTaskRow>(a: ClassifiedExecutionTask<T>, b: ClassifiedExecutionTask<T>): number {
  return a.task.title.localeCompare(b.task.title);
}

function compareDueDateAsc<T extends ExecutionTaskRow>(a: ClassifiedExecutionTask<T>, b: ClassifiedExecutionTask<T>): number {
  if (a.task.due_date && b.task.due_date) return a.task.due_date < b.task.due_date ? -1 : a.task.due_date > b.task.due_date ? 1 : 0;
  if (a.task.due_date) return -1;
  if (b.task.due_date) return 1;
  return 0;
}

function projectSortKey(task: ExecutionTaskRow): string {
  const withName = task as ExecutionTaskRow & { project_name?: string };
  return withName.project_name ?? task.project_id;
}

/**
 * Deterministic comparators only — no opaque score. "attention" is the
 * default: sortRank (see classifyTaskAttention) breaks ties by due date
 * then title, so output order never depends on input order or an AI call.
 */
export function sortExecutionTasks<T extends ExecutionTaskRow>(
  classified: ClassifiedExecutionTask<T>[],
  mode: ExecutionTaskSortMode = "attention",
): ClassifiedExecutionTask<T>[] {
  const copy = [...classified];

  switch (mode) {
    case "attention":
      return copy.sort((a, b) => {
        const rankDiff = a.attention.sortRank - b.attention.sortRank;
        if (rankDiff !== 0) return rankDiff;
        const dueDiff = compareDueDateAsc(a, b);
        if (dueDiff !== 0) return dueDiff;
        return compareTitle(a, b);
      });
    case "due_date":
      return copy.sort((a, b) => {
        const dueDiff = compareDueDateAsc(a, b);
        if (dueDiff !== 0) return dueDiff;
        return compareTitle(a, b);
      });
    case "priority":
      return copy.sort((a, b) => {
        const rankDiff = (PRIORITY_RANK[b.task.priority] ?? 0) - (PRIORITY_RANK[a.task.priority] ?? 0);
        if (rankDiff !== 0) return rankDiff;
        const dueDiff = compareDueDateAsc(a, b);
        if (dueDiff !== 0) return dueDiff;
        return compareTitle(a, b);
      });
    case "updated_at":
      return copy.sort((a, b) => {
        if (a.task.updated_at === b.task.updated_at) return compareTitle(a, b);
        return a.task.updated_at > b.task.updated_at ? -1 : 1;
      });
    case "project":
      return copy.sort((a, b) => {
        const projectDiff = projectSortKey(a.task).localeCompare(projectSortKey(b.task));
        if (projectDiff !== 0) return projectDiff;
        return compareTitle(a, b);
      });
    default:
      return copy;
  }
}
