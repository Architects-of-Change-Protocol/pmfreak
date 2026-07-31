"use client";

import Link from "next/link";
import { useState } from "react";
import type { MemoryItem, ProjectListItem, RepositoryItem } from "./types";
import { StatusBadge } from "./status-badge";
import { ProjectMemory, ProjectRepository } from "./project-repository";

export function ProjectSidebar({
  workspaceName,
  projects,
  selectedProjectId,
  onSelectProject,
  repository,
  memory,
  onAddNotes,
}: {
  workspaceName: string;
  projects: ProjectListItem[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  repository: RepositoryItem[];
  memory: MemoryItem[];
  /** Opens the notes intake — surfaced by the repository/memory empty states. */
  onAddNotes?: () => void;
}) {
  const [memoryOpen, setMemoryOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div>
        <p className="text-sm font-semibold tracking-tight text-zinc-100">PMFreak</p>
        <p className="mt-0.5 text-xs text-zinc-500">Workspace: {workspaceName}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Link
          href="/create-command-center"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06]"
        >
          <span className="text-zinc-500">+</span> New Command Center
        </Link>
        <Link
          href="/projects/new"
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06]"
        >
          <span className="text-zinc-500">+</span> Create Project
        </Link>
      </div>

      <nav aria-label="Projects">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Projects</p>
        <ul className="mt-2 space-y-1">
          {projects.map((project) => {
            const isSelected = project.id === selectedProjectId;
            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                  aria-current={isSelected ? "true" : undefined}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    isSelected
                      ? "border-sky-500/25 bg-gradient-to-br from-sky-500/10 via-white/[0.02] to-violet-500/10 shadow-[0_2px_16px_rgba(56,189,248,0.08)]"
                      : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-zinc-100">{project.name}</p>
                  <p className="truncate text-[11px] text-zinc-500">{project.code}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {project.healthy && (
                      <StatusBadge tone="success">Healthy</StatusBadge>
                    )}
                    {project.badges.map((badge, i) => (
                      <StatusBadge key={`${project.id}-${i}`} tone={badge.tone}>
                        {badge.label}
                      </StatusBadge>
                    ))}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <ProjectRepository items={repository} onAddNotes={onAddNotes} />
      <ProjectMemory items={memory} open={memoryOpen} onToggle={() => setMemoryOpen((v) => !v)} onAddNotes={onAddNotes} />
    </div>
  );
}
