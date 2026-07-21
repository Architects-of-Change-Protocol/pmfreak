"use client";

import { useState } from "react";
import { TaskStatusControl } from "./task-status-control";
import { TaskAssigneeControl, type AssignableMemberOption } from "./task-assignee-control";
import { TaskDueDateControl } from "./task-due-date-control";
import { TaskAttentionBadges } from "./task-attention-badge";
import { TASK_PRIORITY_LABELS } from "@/lib/execution-tasks/task-labels";
import { patchExecutionTask } from "@/lib/execution-tasks/client";
import type { TaskAttentionReason } from "@/lib/execution-attention";
import type { ExecutionTaskPriority, ExecutionTaskRow as ExecutionTaskRowType, ExecutionTaskStatus } from "@/lib/db/database-contract";

export type ExecutionTaskRowData = ExecutionTaskRowType & { project_name?: string };

/**
 * The single task row used by the Daily Execution Workspace list (and,
 * via the same props shape, reusable anywhere a compact task summary with
 * quick actions is needed). Clicking the title opens Task Detail; the
 * three quick controls (status, assignee, due date) autosave immediately,
 * matching ProjectTaskList's existing inline-status pattern.
 */
export function ExecutionTaskRow({
  task,
  attentionReasons,
  members,
  canEdit,
  showProject,
  onOpenDetail,
  onTaskUpdated,
}: {
  task: ExecutionTaskRowData;
  attentionReasons: TaskAttentionReason[];
  members: AssignableMemberOption[];
  canEdit: boolean;
  showProject: boolean;
  onOpenDetail: (taskId: string) => void;
  onTaskUpdated: (task: ExecutionTaskRowType) => void;
}) {
  const [busyField, setBusyField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(field: string, patch: Record<string, unknown>) {
    setBusyField(field);
    setError(null);
    const result = await patchExecutionTask(task.id, patch);
    setBusyField(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onTaskUpdated(result.task);
  }

  return (
    <li
      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      data-testid={`execution-task-row-${task.id}`}
    >
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpenDetail(task.id)}
          className="text-left text-sm font-medium text-slate-900 hover:text-cyan-800 hover:underline"
          data-testid={`execution-task-open-${task.id}`}
        >
          {task.title}
        </button>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {showProject && task.project_name && <span>{task.project_name}</span>}
          <span>{TASK_PRIORITY_LABELS[task.priority]}</span>
        </p>
        <div className="mt-1.5">
          <TaskAttentionBadges reasons={attentionReasons} />
        </div>
        {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TaskStatusControl
          status={task.status}
          canEdit={canEdit}
          busy={busyField === "status"}
          label={`Status for ${task.title}`}
          onChange={(next: ExecutionTaskStatus) => void apply("status", { status: next })}
        />
        <TaskAssigneeControl
          assigneeId={task.owner_user_id}
          ownerName={task.owner_name}
          members={members}
          canEdit={canEdit}
          busy={busyField === "assigneeId"}
          label={`Assignee for ${task.title}`}
          onChange={(next) => void apply("assigneeId", { assigneeId: next })}
        />
        <TaskDueDateControl
          dueDate={task.due_date}
          canEdit={canEdit}
          busy={busyField === "dueDate"}
          label={`Due date for ${task.title}`}
          onChange={(next) => void apply("dueDate", { dueDate: next })}
        />
      </div>
    </li>
  );
}

export type { ExecutionTaskPriority };
