"use client";

import Link from "next/link";
import type { ProjectListItem } from "./types";
import { StatusBadge } from "./status-badge";
import { MenuIcon, ReportIcon, ShareIcon, UploadIcon } from "./icons";

export function ProjectTopBar({
  project,
  onOpenProjects,
  onOpenAgents,
}: {
  project: ProjectListItem;
  onOpenProjects: () => void;
  onOpenAgents: () => void;
}) {
  const warnings = project.badges.find((b) => b.tone === "danger")?.label;
  const tasks = project.badges.find((b) => b.tone === "task")?.label;
  const approvals = project.badges.find((b) => b.tone === "approval")?.label;
  const healthLabel = project.healthy ? "Healthy" : warnings ? "At Risk" : project.hasIntelligence ? "On Track" : "Monitoring";
  const healthTone = project.healthy ? "success" : warnings ? "danger" : "info";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/70 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenProjects}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 xl:hidden"
          aria-label="Open projects"
        >
          <MenuIcon />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-slate-900">
            {project.code} {project.fullName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={healthTone as "success" | "danger" | "info"}>Health: {healthLabel}</StatusBadge>
            {warnings && <StatusBadge tone="danger">{warnings} warnings</StatusBadge>}
            {tasks && <StatusBadge tone="task">{tasks} tasks</StatusBadge>}
            {approvals && <StatusBadge tone="approval">{approvals} approval</StatusBadge>}
            <span className="text-[11px] text-slate-400">Last updated: 8 min ago</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`/upload?projectId=${encodeURIComponent(project.id)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <UploadIcon className="h-3.5 w-3.5" /> Upload
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <ReportIcon className="h-3.5 w-3.5" /> Generate Report
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <ShareIcon className="h-3.5 w-3.5" /> Share
        </button>
        <button
          type="button"
          onClick={onOpenAgents}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 xl:hidden"
          aria-label="Open agents and notifications"
        >
          <MenuIcon />
        </button>
      </div>
    </header>
  );
}
