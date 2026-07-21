"use client";

import { useState } from "react";
import useSWR from "swr";
import { AddTaskCta } from "@/components/pmfreak/empty-states/add-task-cta";
import { isValidStatusTransition } from "@/lib/execution-tasks/lifecycle";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, formatTaskDueDate } from "@/lib/execution-tasks/task-labels";
import type { ExecutionTaskRow, ExecutionTaskStatus } from "@/lib/db/database-contract";

type TaskListEnvelope = { ok: boolean; tasks?: ExecutionTaskRow[] };

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed ${url}`);
  return response.json();
};

const NEXT_STATUSES: ExecutionTaskStatus[] = ["not_started", "in_progress", "blocked", "completed", "cancelled"];

function TaskRow({ task, canEdit, onStatusChanged }: { task: ExecutionTaskRow; canEdit: boolean; onStatusChanged: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(next: ExecutionTaskStatus) {
    setUpdating(true);
    setError(null);
    try {
      const response = await fetch("/api/execution-tasks/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status: next }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Unable to update task.");
        return;
      }
      onStatusChanged();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUpdating(false);
    }
  }

  const availableNext = NEXT_STATUSES.filter((status) => status === task.status || isValidStatusTransition(task.status, status));

  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
      data-testid={`project-task-${task.id}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{task.title}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
          {task.owner_name && <span>{task.owner_name}</span>}
          {task.due_date && <span>Due {formatTaskDueDate(task.due_date)}</span>}
          <span>{TASK_PRIORITY_LABELS[task.priority]}</span>
        </p>
        {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        {canEdit ? (
          <select
            aria-label={`Status for ${task.title}`}
            value={task.status}
            disabled={updating || availableNext.length <= 1}
            onChange={(event) => handleStatusChange(event.target.value as ExecutionTaskStatus)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
          >
            {availableNext.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
            {TASK_STATUS_LABELS[task.status]}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * First Execution View for a project: the real execution_tasks that belong
 * to it, with an inline status control (spec's Not started → In progress →
 * Done path). No fabricated metrics — a task with no owner/date/etc. simply
 * omits that field rather than printing a placeholder.
 */
export function ProjectTaskList({ projectId, canCreateTask }: { projectId: string; canCreateTask: boolean }) {
  const { data, error, isLoading, mutate: revalidate } = useSWR<TaskListEnvelope>(
    `/api/execution-tasks?projectId=${projectId}`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="project-task-list-loading">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3" data-testid="project-task-list-error">
        <p className="text-sm text-rose-800">Unable to load project tasks.</p>
        <button
          type="button"
          onClick={() => void revalidate()}
          className="mt-2 text-xs font-semibold text-rose-800 underline-offset-2 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const tasks = data?.tasks ?? [];

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center" data-testid="project-task-list-empty">
        <p className="text-sm font-semibold text-slate-900">No work has been added yet</p>
        <p className="mt-1 text-sm text-slate-500">Add the first task to begin tracking execution for this project.</p>
        {canCreateTask ? (
          <div className="mt-4">
            <AddTaskCta label="Add first task" projectId={projectId} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            A project manager or workspace administrator must add the first task.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="project-task-list">
      <ul className="space-y-2">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} canEdit={canCreateTask} onStatusChanged={() => void revalidate()} />
        ))}
      </ul>
      {canCreateTask && (
        <AddTaskCta
          label="Add another task"
          projectId={projectId}
          className="text-xs font-medium text-cyan-800 underline-offset-2 hover:underline"
        />
      )}
    </div>
  );
}
