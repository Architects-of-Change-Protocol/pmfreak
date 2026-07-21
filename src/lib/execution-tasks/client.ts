"use client";

import type { ExecutionTaskEventRow, ExecutionTaskRow } from "@/lib/db/database-contract";

/**
 * Shared client-side mutation/fetch helpers for the Task Detail drawer and
 * Daily Execution Workspace — the single place that calls PATCH
 * /api/execution-tasks/:taskId, so status/assignee/due-date/priority edits
 * from every surface go through the same request shape and error handling.
 */

export type TaskDetailPermissions = { canEdit: boolean; canAssign: boolean; canDelete: boolean };

export type TaskDetailEnvelope = {
  ok: boolean;
  data?: { task: ExecutionTaskRow; permissions: TaskDetailPermissions; activity: ExecutionTaskEventRow[] };
  error?: string;
};

export type PatchExecutionTaskInput = Partial<{
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
}>;

export type PatchExecutionTaskResult =
  | { ok: true; task: ExecutionTaskRow }
  | { ok: false; error: string; fieldErrors?: Array<{ field: string; message: string }> };

export async function fetchTaskDetail(taskId: string): Promise<TaskDetailEnvelope> {
  const response = await fetch(`/api/execution-tasks/${encodeURIComponent(taskId)}`, { cache: "no-store" });
  return response.json();
}

export async function patchExecutionTask(taskId: string, patch: PatchExecutionTaskInput): Promise<PatchExecutionTaskResult> {
  try {
    const response = await fetch(`/api/execution-tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = (await response.json()) as { ok: boolean; task?: ExecutionTaskRow; error?: string; fieldErrors?: Array<{ field: string; message: string }> };
    if (!json.ok || !json.task) {
      return { ok: false, error: json.error ?? "Unable to update task.", fieldErrors: json.fieldErrors };
    }
    return { ok: true, task: json.task };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
