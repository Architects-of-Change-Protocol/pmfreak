"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/pmfreak/ui/drawer";
import { TaskStatusControl } from "./task-status-control";
import { TaskPriorityControl } from "./task-priority-control";
import { TaskAssigneeControl, type AssignableMemberOption } from "./task-assignee-control";
import { TaskDueDateControl } from "./task-due-date-control";
import { fetchTaskDetail, patchExecutionTask, type TaskDetailPermissions } from "@/lib/execution-tasks/client";
import type { ExecutionTaskEventRow, ExecutionTaskRow, ExecutionTaskStatus, ExecutionTaskPriority } from "@/lib/db/database-contract";

function deriveTaskSource(task: ExecutionTaskRow): string | null {
  const payload = task.source_payload as { source?: unknown } | null;
  if (payload && typeof payload.source === "string" && payload.source === "manual") return "Manual";
  if (task.task_draft_id) return "Recommendation";
  return null;
}

const EVENT_FIELD_LABEL: Record<string, string> = {
  task_created: "Task created",
  task_title_changed: "Title changed",
  task_description_changed: "Description changed",
  task_status_changed: "Status changed",
  status_changed: "Status changed",
  task_completed: "Marked done",
  task_cancelled: "Cancelled",
  task_priority_changed: "Priority changed",
  task_assignee_changed: "Assignee changed",
  owner_changed: "Assignee changed",
  task_due_date_changed: "Due date changed",
  due_date_changed: "Due date changed",
  progress_updated: "Progress updated",
};

function describeEvent(event: ExecutionTaskEventRow): string {
  return EVENT_FIELD_LABEL[event.event_type] ?? event.event_type;
}

/**
 * Full task read/edit surface, reused by both the Daily Execution
 * Workspace and (via an "Open" affordance) ProjectTaskList — a single
 * drawer implementation rather than a per-surface variant. Title and
 * description autosave on blur (only when changed); status, priority,
 * assignee, and due date autosave immediately, matching the inline-select
 * pattern already used by ProjectTaskList's quick status control. There is
 * never an "unsaved changes" state to warn about on close as a result.
 */
export function TaskDetailDrawer({
  taskId,
  members,
  onClose,
  onTaskUpdated,
}: {
  taskId: string;
  members: AssignableMemberOption[];
  onClose: () => void;
  onTaskUpdated?: (task: ExecutionTaskRow) => void;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [task, setTask] = useState<ExecutionTaskRow | null>(null);
  const [permissions, setPermissions] = useState<TaskDetailPermissions>({ canEdit: false, canAssign: false, canDelete: false });
  const [activity, setActivity] = useState<ExecutionTaskEventRow[]>([]);

  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  async function load() {
    setState("loading");
    const envelope = await fetchTaskDetail(taskId);
    if (!envelope.ok || !envelope.data) {
      setState("error");
      return;
    }
    setTask(envelope.data.task);
    setPermissions(envelope.data.permissions);
    setActivity(envelope.data.activity);
    setTitleDraft(envelope.data.task.title);
    setDescriptionDraft(envelope.data.task.description);
    setState("ok");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function applyPatch(field: string, patch: Record<string, unknown>) {
    setSavingField(field);
    setFieldError(null);
    const result = await patchExecutionTask(taskId, patch);
    if (!result.ok) {
      setFieldError(result.error);
      setSavingField(null);
      return;
    }
    setTask(result.task);
    onTaskUpdated?.(result.task);
    setSavingField(null);
    // Refresh activity so the new event shows immediately — never
    // synthesized client-side.
    const envelope = await fetchTaskDetail(taskId);
    if (envelope.ok && envelope.data) setActivity(envelope.data.activity);
  }

  function handleTitleBlur() {
    if (!task) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleError("Task title is required.");
      setTitleDraft(task.title);
      return;
    }
    setTitleError(null);
    if (trimmed === task.title) return;
    void applyPatch("title", { title: trimmed });
  }

  function handleDescriptionBlur() {
    if (!task) return;
    const trimmed = descriptionDraft.trim();
    if (trimmed === task.description) return;
    void applyPatch("description", { description: trimmed || null });
  }

  if (state === "loading") {
    return (
      <Drawer title="Task" onClose={onClose} testId="task-detail-drawer-loading">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </Drawer>
    );
  }

  if (state === "error" || !task) {
    return (
      <Drawer title="Task" onClose={onClose} testId="task-detail-drawer-error">
        <p className="text-sm text-rose-800">Unable to load this task.</p>
        <button type="button" onClick={() => void load()} className="mt-2 text-xs font-semibold text-rose-800 underline-offset-2 hover:underline">
          Retry
        </button>
      </Drawer>
    );
  }

  const source = deriveTaskSource(task);
  const canEdit = permissions.canEdit;

  return (
    <Drawer title="Task details" onClose={onClose} testId="task-detail-drawer">
      <div className="space-y-5" data-testid="task-detail-drawer-content">
        {fieldError && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {fieldError}
          </p>
        )}

        <div>
          <label htmlFor="task-detail-title" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Title
          </label>
          {canEdit ? (
            <input
              id="task-detail-title"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={handleTitleBlur}
              aria-invalid={Boolean(titleError)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
            />
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-900">{task.title}</p>
          )}
          {titleError && <p className="mt-1 text-xs text-rose-700">{titleError}</p>}
          {savingField === "title" && <p className="mt-1 text-xs text-slate-400">Saving…</p>}
        </div>

        <p className="text-xs text-slate-500" data-testid="task-detail-project">
          Project: <span className="font-medium text-slate-700">{(task as ExecutionTaskRow & { project_name?: string }).project_name ?? task.project_id}</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
            <div className="mt-1">
              <TaskStatusControl
                status={task.status}
                canEdit={canEdit}
                busy={savingField === "status"}
                label="Task status"
                size="md"
                onChange={(next: ExecutionTaskStatus) => void applyPatch("status", { status: next })}
              />
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Priority</span>
            <div className="mt-1">
              <TaskPriorityControl
                priority={task.priority}
                canEdit={canEdit}
                busy={savingField === "priority"}
                label="Task priority"
                size="md"
                onChange={(next: ExecutionTaskPriority) => void applyPatch("priority", { priority: next })}
              />
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Assignee</span>
            <div className="mt-1">
              <TaskAssigneeControl
                assigneeId={task.owner_user_id}
                ownerName={task.owner_name}
                members={members}
                canEdit={permissions.canAssign}
                busy={savingField === "assigneeId"}
                label="Task assignee"
                size="md"
                onChange={(next) => void applyPatch("assigneeId", { assigneeId: next })}
              />
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Due date</span>
            <div className="mt-1">
              <TaskDueDateControl
                dueDate={task.due_date}
                canEdit={canEdit}
                busy={savingField === "dueDate"}
                label="Task due date"
                size="md"
                onChange={(next) => void applyPatch("dueDate", { dueDate: next })}
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="task-detail-description" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Description
          </label>
          {canEdit ? (
            <textarea
              id="task-detail-description"
              rows={5}
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="No description yet."
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{task.description || "No description."}</p>
          )}
          {savingField === "description" && <p className="mt-1 text-xs text-slate-400">Saving…</p>}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-xs text-slate-500">
          {source && (
            <div>
              <dt className="uppercase tracking-wide">Source</dt>
              <dd className="mt-0.5 text-slate-700">{source}</dd>
            </div>
          )}
          <div>
            <dt className="uppercase tracking-wide">Created</dt>
            <dd className="mt-0.5 text-slate-700">{new Date(task.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Updated</dt>
            <dd className="mt-0.5 text-slate-700">{new Date(task.updated_at).toLocaleString()}</dd>
          </div>
        </dl>

        {!canEdit && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" data-testid="task-detail-readonly-note">
            Read-only — only project managers and workspace administrators can edit this task.
          </p>
        )}

        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Activity</h3>
          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400" data-testid="task-detail-activity-empty">
              No recorded activity yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2" data-testid="task-detail-activity-list">
              {[...activity].reverse().map((event) => (
                <li key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">{describeEvent(event)}</p>
                  <p className="mt-0.5 text-slate-400">{new Date(event.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
