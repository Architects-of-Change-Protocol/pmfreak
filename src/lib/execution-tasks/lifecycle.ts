import type { ExecutionTaskStatus } from "@/lib/db/database-contract";

// Valid status transitions for execution tasks
const TRANSITIONS: Record<ExecutionTaskStatus, ExecutionTaskStatus[]> = {
  not_started: ["in_progress", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isValidStatusTransition(
  from: ExecutionTaskStatus,
  to: ExecutionTaskStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: ExecutionTaskStatus): boolean {
  return status === "completed" || status === "cancelled";
}
