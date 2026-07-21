"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
import { QuickAddTaskModal } from "@/components/pmfreak/tasks/quick-add-task-modal";
import { EmptyExecution } from "@/components/pmfreak/empty-states/workspace-empty-state";
import { ExecutionSummary } from "./execution-summary";
import { ExecutionFilters, type ExecutionFiltersState } from "./execution-filters";
import { ExecutionTaskRow, type ExecutionTaskRowData } from "./execution-task-row";
import { TaskDetailDrawer } from "./task-detail-drawer";
import type { AssignableMemberOption } from "./task-assignee-control";
import {
  classifyExecutionTasks,
  sortExecutionTasks,
  summarizeExecutionAttention,
  matchesAttentionFilter,
  type ExecutionAttentionFilter,
  type ExecutionSection,
  type ExecutionTaskSortMode,
} from "@/lib/execution-attention";
import type { ExecutionTaskPriority, ExecutionTaskRow as ExecutionTaskRowRecord, ExecutionTaskStatus } from "@/lib/db/database-contract";

type DailyEnvelope = {
  ok: boolean;
  data?: { tasks: ExecutionTaskRowData[]; projects: Array<{ id: string; name: string }>; workspaceId: string; hasMore: boolean };
};

type MembersEnvelope = { ok: boolean; data?: AssignableMemberOption[] };

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed ${url}`);
  return response.json();
};

const SECTION_ORDER: ExecutionSection[] = ["needs_attention", "in_progress", "upcoming", "backlog", "completed"];
const SECTION_TITLE: Record<ExecutionSection, string> = {
  needs_attention: "Needs Attention",
  in_progress: "In Progress",
  upcoming: "Upcoming",
  backlog: "Backlog",
  completed: "Completed Recently",
};
const SECTION_PAGE_SIZE = 20;

function readFilters(params: URLSearchParams): ExecutionFiltersState {
  return {
    projectId: params.get("projectId") ?? "",
    assignee: params.get("assignee") ?? "",
    status: (params.get("status") as ExecutionTaskStatus | null) ?? "",
    priority: (params.get("priority") as ExecutionTaskPriority | null) ?? "",
    search: params.get("search") ?? "",
    sort: (params.get("sort") as ExecutionTaskSortMode | null) ?? "attention",
  };
}

/**
 * The Daily Execution Workspace: a single, workspace-wide task surface
 * organized around "what needs attention today" rather than a reporting
 * dashboard. Filters/search/sort live in the URL (shareable, refresh-safe,
 * back/forward works) — see readFilters/buildQueryString.
 */
export function DailyExecutionClient({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = readFilters(searchParams);
  const attentionFilter = (searchParams.get("attention") as ExecutionAttentionFilter | null) ?? null;
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<ExecutionSection>>(new Set());
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.projectId) params.set("projectId", filters.projectId);
    if (filters.assignee) params.set("assigneeId", filters.assignee);
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.search) params.set("search", filters.search);
    return params.toString();
  }, [filters]);

  const { data, error, isLoading, mutate: revalidate } = useSWR<DailyEnvelope>(`/api/execution-tasks/daily?${queryString}`, fetcher);

  const workspaceId = data?.data?.workspaceId;
  const { data: membersData } = useSWR<MembersEnvelope>(
    workspaceId ? `/api/workspace-team/members?workspaceId=${encodeURIComponent(workspaceId)}` : null,
    fetcher,
  );
  const members = membersData?.data ?? [];

  const updateFilters = useCallback(
    (patch: Partial<ExecutionFiltersState> & { attention?: ExecutionAttentionFilter | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...filters, ...patch };
      const setOrDelete = (key: string, value: string) => (value ? params.set(key, value) : params.delete(key));
      setOrDelete("projectId", merged.projectId);
      setOrDelete("assignee", merged.assignee);
      setOrDelete("status", merged.status);
      setOrDelete("priority", merged.priority);
      setOrDelete("search", merged.search);
      setOrDelete("sort", merged.sort === "attention" ? "" : merged.sort);
      if ("attention" in patch) setOrDelete("attention", patch.attention ?? "");
      router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    },
    [filters, pathname, router, searchParams],
  );

  function handleTaskUpdated(updated: ExecutionTaskRowRecord) {
    void revalidate((current) => {
      if (!current?.data) return current;
      return { ...current, data: { ...current.data, tasks: current.data.tasks.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)) } };
    }, { revalidate: true });
  }

  const now = useMemo(() => new Date(), [data]);
  const rawTasks = data?.data?.tasks ?? [];
  const classified = useMemo(() => classifyExecutionTasks(rawTasks, now), [rawTasks, now]);
  const summary = useMemo(() => summarizeExecutionAttention(classified, now), [classified, now]);

  const attentionFiltered = attentionFilter
    ? classified.filter((c) => matchesAttentionFilter(c.task, c.attention, attentionFilter, now))
    : classified;

  const sections = SECTION_ORDER.map((section) => {
    const inSection = attentionFiltered.filter((c) => c.section === section);
    return { section, tasks: sortExecutionTasks(inSection, filters.sort) };
  }).filter((s) => s.tasks.length > 0);

  const hasAnyFilterActive = Boolean(filters.projectId || filters.assignee || filters.status || filters.priority || filters.search || attentionFilter);
  const hasAnyRawTasks = rawTasks.length > 0;
  const projects = data?.data?.projects ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="daily-execution-loading">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
        ))}
      </div>
    );
  }

  if (error || data?.ok === false) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center" data-testid="daily-execution-error">
        <p className="text-sm text-rose-800">Unable to load execution work.</p>
        <button type="button" onClick={() => void revalidate()} className="mt-2 text-xs font-semibold text-rose-800 underline-offset-2 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!hasAnyRawTasks && !hasAnyFilterActive) {
    return <EmptyExecution hasProject={projects.length > 0} canCreate={canEdit} />;
  }

  return (
    <div className="space-y-5" data-testid="daily-execution-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ExecutionSummary summary={summary} activeFilter={attentionFilter} onFilterChange={(next) => updateFilters({ attention: next })} />
        {canEdit && (
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Add task
          </button>
        )}
      </div>

      <ExecutionFilters filters={filters} projects={projects} members={members} onChange={(patch) => updateFilters(patch)} />

      {sections.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center" data-testid="daily-execution-no-results">
          <p className="text-sm font-semibold text-slate-900">{filters.search ? "No tasks match your search" : "No tasks match the current filters."}</p>
          <button
            type="button"
            onClick={() => updateFilters({ projectId: "", assignee: "", status: "", priority: "", search: "", attention: null })}
            className="mt-3 text-xs font-semibold text-cyan-800 underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        sections.map(({ section, tasks }) => {
          const isCompleted = section === "completed";
          const isCollapsed = isCompleted ? !expandedSections.has(section) : false;
          const visible = expandedSections.has(section) ? tasks : tasks.slice(0, SECTION_PAGE_SIZE);
          return (
            <section key={section} data-testid={`execution-section-${section}`} className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections((prev) => {
                    const next = new Set(prev);
                    if (next.has(section)) next.delete(section);
                    else next.add(section);
                    return next;
                  })
                }
                className="flex w-full items-center justify-between text-left"
              >
                <h2 className="text-sm font-semibold text-slate-900">
                  {SECTION_TITLE[section]} <span className="font-normal text-slate-400">({tasks.length})</span>
                </h2>
                {isCompleted && <span className="text-xs text-slate-400">{isCollapsed ? "Show" : "Hide"}</span>}
              </button>
              {!isCollapsed && (
                <>
                  <ul className="space-y-2">
                    {visible.map(({ task, attention }) => (
                      <ExecutionTaskRow
                        key={task.id}
                        task={task}
                        attentionReasons={attention.reasons}
                        members={members}
                        canEdit={canEdit}
                        showProject={!filters.projectId}
                        onOpenDetail={setOpenTaskId}
                        onTaskUpdated={handleTaskUpdated}
                      />
                    ))}
                  </ul>
                  {tasks.length > SECTION_PAGE_SIZE && !expandedSections.has(section) && (
                    <button
                      type="button"
                      onClick={() => setExpandedSections((prev) => new Set(prev).add(section))}
                      className="text-xs font-medium text-cyan-800 underline-offset-2 hover:underline"
                    >
                      View all {tasks.length}
                    </button>
                  )}
                </>
              )}
            </section>
          );
        })
      )}

      {openTaskId && (
        <TaskDetailDrawer
          taskId={openTaskId}
          members={members}
          onClose={() => setOpenTaskId(null)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {quickAddOpen && (
        <QuickAddTaskModal
          onClose={() => setQuickAddOpen(false)}
          onCreated={() => {
            void revalidate();
          }}
        />
      )}
    </div>
  );
}
