"use client";

import { TASK_PRIORITY_LABELS, TASK_PRIORITY_ORDER, TASK_STATUS_LABELS } from "@/lib/execution-tasks/task-labels";
import type { ExecutionTaskPriority, ExecutionTaskStatus } from "@/lib/db/database-contract";
import type { ExecutionTaskSortMode } from "@/lib/execution-attention";
import type { AssignableMemberOption } from "./task-assignee-control";

export type ExecutionFiltersState = {
  projectId: string;
  assignee: string; // "" (anyone) | "me" | "unassigned" | a member userId
  status: ExecutionTaskStatus | "";
  priority: ExecutionTaskPriority | "";
  search: string;
  sort: ExecutionTaskSortMode;
};

const STATUS_OPTIONS: ExecutionTaskStatus[] = ["not_started", "in_progress", "blocked", "completed", "cancelled"];
const SORT_OPTIONS: Array<{ value: ExecutionTaskSortMode; label: string }> = [
  { value: "attention", label: "Attention" },
  { value: "due_date", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "updated_at", label: "Last updated" },
  { value: "project", label: "Project" },
];

/**
 * Combinable filters — all state is lifted to the parent, which mirrors it
 * into the URL query string (see daily-execution-client.tsx), so the view
 * is shareable and refresh-safe.
 */
export function ExecutionFilters({
  filters,
  projects,
  members,
  onChange,
}: {
  filters: ExecutionFiltersState;
  projects: Array<{ id: string; name: string }>;
  members: AssignableMemberOption[];
  onChange: (next: Partial<ExecutionFiltersState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="execution-filters">
      <div>
        <label htmlFor="execution-filter-search" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Search
        </label>
        <input
          id="execution-filter-search"
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Task or project…"
          className="mt-1 block w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
        />
      </div>

      <div>
        <label htmlFor="execution-filter-project" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Project
        </label>
        <select
          id="execution-filter-project"
          value={filters.projectId}
          onChange={(event) => onChange({ projectId: event.target.value })}
          className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="execution-filter-assignee" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Assignee
        </label>
        <select
          id="execution-filter-assignee"
          value={filters.assignee}
          onChange={(event) => onChange({ assignee: event.target.value })}
          className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.displayName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="execution-filter-status" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Status
        </label>
        <select
          id="execution-filter-status"
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value as ExecutionTaskStatus | "" })}
          className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
        >
          <option value="">Any status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="execution-filter-priority" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Priority
        </label>
        <select
          id="execution-filter-priority"
          value={filters.priority}
          onChange={(event) => onChange({ priority: event.target.value as ExecutionTaskPriority | "" })}
          className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
        >
          <option value="">Any priority</option>
          {TASK_PRIORITY_ORDER.map((priority) => (
            <option key={priority} value={priority}>
              {TASK_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="execution-filter-sort" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
          Sort
        </label>
        <select
          id="execution-filter-sort"
          value={filters.sort}
          onChange={(event) => onChange({ sort: event.target.value as ExecutionTaskSortMode })}
          className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {(filters.projectId || filters.assignee || filters.status || filters.priority || filters.search) && (
        <button
          type="button"
          onClick={() => onChange({ projectId: "", assignee: "", status: "", priority: "", search: "" })}
          className="text-xs font-medium text-cyan-800 underline-offset-2 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
