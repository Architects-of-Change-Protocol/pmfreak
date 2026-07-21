"use client";

import { isValidStatusTransition } from "@/lib/execution-tasks/lifecycle";
import { TASK_STATUS_LABELS } from "@/lib/execution-tasks/task-labels";
import type { ExecutionTaskStatus } from "@/lib/db/database-contract";

const ALL_STATUSES: ExecutionTaskStatus[] = ["not_started", "in_progress", "blocked", "completed", "cancelled"];

/**
 * The single status control used by the Daily Execution row and Task
 * Detail — options are always the current status plus whatever
 * isValidStatusTransition allows from it, so an invalid transition can
 * never even be selected client-side (the server still re-validates).
 */
export function TaskStatusControl({
  status,
  canEdit,
  busy,
  onChange,
  label,
  size = "sm",
}: {
  status: ExecutionTaskStatus;
  canEdit: boolean;
  busy?: boolean;
  onChange: (next: ExecutionTaskStatus) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const availableNext = ALL_STATUSES.filter((s) => s === status || isValidStatusTransition(status, s));

  if (!canEdit) {
    return (
      <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600" data-testid="task-status-readonly">
        {TASK_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <select
      aria-label={label}
      value={status}
      disabled={busy || availableNext.length <= 1}
      onChange={(event) => onChange(event.target.value as ExecutionTaskStatus)}
      data-testid="task-status-control"
      className={`rounded-lg border border-slate-200 bg-white font-medium text-slate-700 disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
      }`}
    >
      {availableNext.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
