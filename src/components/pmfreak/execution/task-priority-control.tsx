"use client";

import { TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER } from "@/lib/execution-tasks/task-labels";
import type { ExecutionTaskPriority } from "@/lib/db/database-contract";

export function TaskPriorityControl({
  priority,
  canEdit,
  busy,
  onChange,
  label,
  size = "sm",
}: {
  priority: ExecutionTaskPriority;
  canEdit: boolean;
  busy?: boolean;
  onChange: (next: ExecutionTaskPriority) => void;
  label: string;
  size?: "sm" | "md";
}) {
  if (!canEdit) {
    return (
      <span className="text-xs text-slate-600" data-testid="task-priority-readonly">
        {TASK_PRIORITY_LABELS[priority]}
      </span>
    );
  }

  return (
    <select
      aria-label={label}
      value={priority}
      disabled={busy}
      onChange={(event) => onChange(event.target.value as ExecutionTaskPriority)}
      data-testid="task-priority-control"
      className={`rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
      }`}
    >
      {TASK_PRIORITY_ORDER.map((p) => (
        <option key={p} value={p}>
          {TASK_PRIORITY_LABELS[p]}
        </option>
      ))}
    </select>
  );
}
