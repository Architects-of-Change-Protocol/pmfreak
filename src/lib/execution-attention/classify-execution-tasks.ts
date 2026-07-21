import type { ExecutionTaskRow } from "@/lib/db/database-contract";
import { classifyTaskAttention } from "./classify-task-attention";
import { resolveExecutionSection } from "./resolve-execution-section";
import type { ClassifiedExecutionTask } from "./types";

/**
 * Attaches attention + section to every task, independently per task (no
 * cross-task comparison). Order of the input is preserved — callers use
 * sortExecutionTasks separately to order the result.
 */
export function classifyExecutionTasks<T extends ExecutionTaskRow>(
  tasks: T[],
  now: Date,
): ClassifiedExecutionTask<T>[] {
  return tasks.map((task) => {
    const attention = classifyTaskAttention(task, now);
    const section = resolveExecutionSection(task, attention, now);
    return { task, attention, section };
  });
}
