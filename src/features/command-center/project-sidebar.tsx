"use client";

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
  repositoryPreview = false,
}: {
  workspaceName: string;
  projects: ProjectListItem[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  repository: RepositoryItem[];
  memory: MemoryItem[];
  repositoryPreview?: boolean;
}) {
  const [memoryOpen, setMemoryOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div>
        <p className="text-sm font-semibold tracking-tight text-slate-900">PMFreak</p>
        <p className="mt-0.5 text-xs text-slate-400">Workspace: {workspaceName}</p>
      </div>

      <nav aria-label="Projects">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Projects</p>
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
                      ? "border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-sky-50 shadow-[0_2px_10px_rgba(244,114,182,0.12)]"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-slate-800">{project.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{project.code}</p>
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

      <ProjectRepository items={repository} preview={repositoryPreview} />
      <ProjectMemory items={memory} open={memoryOpen} onToggle={() => setMemoryOpen((v) => !v)} />
    </div>
  );
}
