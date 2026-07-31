"use client";

import Link from "next/link";
import type { ProjectListItem, RepositoryItem } from "./types";
import { StatusBadge } from "./status-badge";
import { REPOSITORY_ICONS } from "./icons";
import { MenuIcon, UploadIcon } from "./icons";

export function ProjectTopBar({
  project,
  sources = [],
  onOpenProjects,
  onOpenAgents,
  onSourceClick,
  onAttach,
  lastUpdatedLabel,
}: {
  project: ProjectListItem;
  /** Sources of truth currently attached to this conversation (documents, decisions, evidence, ...). */
  sources?: RepositoryItem[];
  onOpenProjects: () => void;
  onOpenAgents: () => void;
  /** Opens the detail drawer for a given attached source. */
  onSourceClick?: (source: RepositoryItem) => void;
  /** Opens the notes/context intake — the way new context gets attached. */
  onAttach?: () => void;
  /** Human-readable timestamp of the newest real operational record. Omitted when no data exists. */
  lastUpdatedLabel?: string;
}) {
  const warnings = project.badges.find((b) => b.tone === "danger")?.label;
  const tasks = project.badges.find((b) => b.tone === "task")?.label;
  const approvals = project.badges.find((b) => b.tone === "approval")?.label;
  const healthLabel = project.healthy ? "Healthy" : warnings ? "At Risk" : project.hasIntelligence ? "On Track" : "Awaiting data";
  const healthTone = project.healthy ? "success" : warnings ? "danger" : "info";
  const activeSources = sources.filter((source) => (source.count ?? 0) > 0);

  return (
    <header className="border-b border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenProjects}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 xl:hidden"
            aria-label="Open projects"
          >
            <MenuIcon />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-zinc-100">
              {project.code} {project.fullName}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={healthTone as "success" | "danger" | "info"}>Health: {healthLabel}</StatusBadge>
              {warnings && <StatusBadge tone="danger">{warnings} warnings</StatusBadge>}
              {tasks && <StatusBadge tone="task">{tasks} tasks</StatusBadge>}
              {approvals && <StatusBadge tone="approval">{approvals} approval</StatusBadge>}
              {lastUpdatedLabel && <span className="text-[11px] text-zinc-500">Last updated: {lastUpdatedLabel}</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`/upload?projectId=${encodeURIComponent(project.id)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5"
          >
            <UploadIcon className="h-3.5 w-3.5" /> Upload
          </Link>
          <button
            type="button"
            onClick={onOpenAgents}
            className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/5 xl:hidden"
            aria-label="Open agents and notifications"
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {/* Attached context — every source of truth this conversation is currently grounded in. */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 sm:px-5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Context:</span>
        {activeSources.length === 0 && <span className="text-[11px] text-zinc-600">No sources attached yet</span>}
        {activeSources.map((source) => {
          const Icon = REPOSITORY_ICONS[source.icon];
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => onSourceClick?.(source)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400 transition hover:border-sky-500/25 hover:bg-sky-500/[0.06] hover:text-sky-300"
            >
              <Icon className="h-3 w-3 shrink-0" />
              {source.label}
              <span className="text-zinc-600">{source.count}</span>
            </button>
          );
        })}
        {onAttach && (
          <button
            type="button"
            onClick={onAttach}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-1 text-[11px] text-zinc-500 transition hover:border-white/30 hover:text-zinc-300"
          >
            + Attach
          </button>
        )}
      </div>
    </header>
  );
}
