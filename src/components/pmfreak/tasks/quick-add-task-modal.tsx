"use client";

import { useEffect, useState } from "react";
import { mutate } from "swr";
import { Modal } from "@/components/pmfreak/ui/modal";
import { CreateProjectModal } from "@/components/pmfreak/projects/create-project-modal";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER } from "@/lib/execution-tasks/task-labels";
import type { ExecutionTaskPriority } from "@/lib/db/database-contract";

type ProjectOption = { id: string; name: string };
type MemberOption = { userId: string; displayName: string; email: string | null };
type CreatedTask = { id: string; title: string };

type FieldErrors = Partial<Record<"title" | "dueDate" | "priority", string>>;

/**
 * The canonical direct task-creation surface — every "Add task" CTA
 * (onboarding, project landing, execution empty state) opens this rather
 * than routing through Command Center / RAID. Writes the same
 * execution_tasks entity the advanced conversion pipeline writes.
 */
export function QuickAddTaskModal({
  projectId: preselectedProjectId,
  onClose,
  onCreated,
}: {
  /** When provided, the project field is fixed (no picker). */
  projectId?: string;
  onClose: () => void;
  onCreated?: (task: CreatedTask) => void;
}) {
  const [creatingProject, setCreatingProject] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[] | null>(preselectedProjectId ? null : []);
  const [loadingProjects, setLoadingProjects] = useState(!preselectedProjectId);
  const [projectId, setProjectId] = useState(preselectedProjectId ?? "");

  const [members, setMembers] = useState<MemberOption[]>([]);

  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ExecutionTaskPriority>("medium");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<CreatedTask | null>(null);

  useEffect(() => {
    if (preselectedProjectId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingProjects(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((json: { projects?: Array<{ id: string; name: string; status: string }> }) => {
        if (cancelled) return;
        const active = (json.projects ?? []).filter((p) => p.status !== "archived");
        setProjects(active);
        if (active.length === 1) setProjectId(active[0].id);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preselectedProjectId]);

  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMembers([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/workspace-team/members?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: MemberOption[] }) => {
        if (!cancelled && json.ok) setMembers(json.data ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function resetFormKeepingProject() {
    setTitle("");
    setAssigneeId("");
    setDueDate("");
    setPriority("medium");
    setDescription("");
    setCreated(null);
    setError(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/execution-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          description: description.trim() || null,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          priority,
        }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        task?: CreatedTask;
        error?: string;
        fieldErrors?: Array<{ field: string; message: string }>;
      };

      if (!json.ok || !json.task) {
        if (json.fieldErrors) {
          const next: FieldErrors = {};
          for (const fe of json.fieldErrors) {
            if (fe.field === "title" || fe.field === "dueDate" || fe.field === "priority") next[fe.field] = fe.message;
          }
          setFieldErrors(next);
        }
        setError(json.error ?? "Unable to create task.");
        return;
      }

      void mutate("/api/workspace-activation");
      void mutate((key) => typeof key === "string" && key.startsWith("/api/execution-tasks?projectId="));
      setCreated(json.task);
      onCreated?.(json.task);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!preselectedProjectId && !loadingProjects && (projects?.length ?? 0) === 0) {
    if (creatingProject) {
      return (
        <CreateProjectModal
          onClose={() => setCreatingProject(false)}
          onCreated={(project) => {
            setCreatingProject(false);
            setProjects((prev) => [...(prev ?? []), { id: project.id, name: project.name }]);
            setProjectId(project.id);
          }}
        />
      );
    }
    return (
      <Modal title="Add task" onClose={onClose} testId="quick-add-task-modal-blocked">
        <p className="text-sm text-slate-600">Create a project first — a task always belongs to a project.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => setCreatingProject(true)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Create a project first
          </button>
        </div>
      </Modal>
    );
  }

  if (created) {
    return (
      <Modal title="Task added" onClose={onClose} testId="quick-add-task-modal-success">
        <p className="text-sm text-slate-600" data-testid="quick-add-task-created-title">
          “{created.title}” was added to execution.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetFormKeepingProject}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Add another task
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add task" onClose={onClose} testId="quick-add-task-modal">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="quick-add-task-form">
        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}

        {!preselectedProjectId && (
          <div>
            <label htmlFor="quick-add-task-project" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Project
            </label>
            {loadingProjects ? (
              <p className="mt-1 text-xs text-slate-500">Loading projects…</p>
            ) : (
              <select
                id="quick-add-task-project"
                required
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
              >
                <option value="">Select a project…</option>
                {(projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div>
          <label htmlFor="quick-add-task-title" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Task title
          </label>
          <input
            id="quick-add-task-title"
            required
            autoFocus={Boolean(preselectedProjectId)}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Confirm migration scope"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? "quick-add-task-title-error" : undefined}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
          />
          {fieldErrors.title && (
            <p id="quick-add-task-title-error" className="mt-1 text-xs text-rose-700">
              {fieldErrors.title}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="quick-add-task-assignee" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Assignee
            </label>
            <select
              id="quick-add-task-assignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </select>
            {members.length === 0 && projectId && (
              <p className="mt-1 text-xs text-slate-400">Only you are currently available for assignment.</p>
            )}
          </div>
          <div>
            <label htmlFor="quick-add-task-priority" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Priority
            </label>
            <select
              id="quick-add-task-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ExecutionTaskPriority)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
            >
              {TASK_PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="quick-add-task-due-date" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Due date <span className="normal-case text-slate-400">(optional)</span>
          </label>
          <input
            id="quick-add-task-due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            aria-invalid={Boolean(fieldErrors.dueDate)}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
          />
          {fieldErrors.dueDate && <p className="mt-1 text-xs text-rose-700">{fieldErrors.dueDate}</p>}
        </div>

        <div>
          <label htmlFor="quick-add-task-description" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Description <span className="normal-case text-slate-400">(optional)</span>
          </label>
          <textarea
            id="quick-add-task-description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !projectId}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Adding task…" : "Add task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
