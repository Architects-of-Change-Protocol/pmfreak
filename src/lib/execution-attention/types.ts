import type { ExecutionTaskPriority, ExecutionTaskRow, ExecutionTaskStatus } from "@/lib/db/database-contract";

/**
 * Attention reasons are limited to what can be derived from real,
 * already-persisted execution_tasks columns. "stale_in_progress" is
 * deliberately not implemented — it needs a product-approved staleness
 * threshold that does not exist yet (see docs/architecture/
 * daily-execution-workspace.md, Known gaps). "at_risk" is intentionally
 * absent — there is no stable, evidence-backed definition for it.
 */
export type TaskAttentionReason =
  | "overdue"
  | "due_today"
  | "blocked"
  | "high_priority"
  | "unassigned";

export type TaskAttentionSeverity = "critical" | "high" | "normal";

export type TaskAttentionClassification = {
  requiresAttention: boolean;
  reasons: TaskAttentionReason[];
  severity: TaskAttentionSeverity;
  /** Lower sorts first within the Needs Attention section. Deterministic, not an opaque score. */
  sortRank: number;
};

export type ExecutionSection =
  | "needs_attention"
  | "in_progress"
  | "upcoming"
  | "backlog"
  | "completed";

export type ExecutionTaskSortMode = "attention" | "due_date" | "priority" | "updated_at" | "project";

export type ClassifiedExecutionTask<T extends ExecutionTaskRow = ExecutionTaskRow> = {
  task: T;
  attention: TaskAttentionClassification;
  section: ExecutionSection;
};

export type ExecutionAttentionSummary = {
  needsAttention: number;
  inProgress: number;
  dueToday: number;
  overdue: number;
  blocked: number;
  unassigned: number;
};

export type { ExecutionTaskPriority, ExecutionTaskRow, ExecutionTaskStatus };
