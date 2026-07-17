"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceContextBanner } from "@/components/pmfreak/workspace/workspace-context-banner";

type PortfolioProject = {
  id: string;
  projectName: string;
  uploadDate: string;
  complexity: "Low" | "Medium" | "High";
  riskCount: number;
  sourceFileNames: string[];
};

const complexityBadge = (complexity: PortfolioProject["complexity"]) => {
  if (complexity === "High") {
    return "bg-rose-300/20 text-rose-900 border-rose-300/40";
  }

  if (complexity === "Medium") {
    return "bg-amber-300/20 text-amber-900 border-amber-300/40";
  }

  return "bg-emerald-300/20 text-emerald-900 border-emerald-300/40";
};

export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/portfolio");
        const payload = (await response.json()) as { projects?: PortfolioProject[]; error?: string };

        if (!response.ok || !payload.projects) {
          setError(payload.error ?? "Unable to load portfolio data.");
          setProjects([]);
          return;
        }

        setProjects(payload.projects);
      } catch {
        setError("Unable to load portfolio data.");
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return projects;
    }

    return projects.filter((project) => {
      const fileNames = project.sourceFileNames.join(" ").toLowerCase();
      return project.projectName.toLowerCase().includes(term) || fileNames.includes(term);
    });
  }, [projects, search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-16 text-slate-900">
      <main className="mx-auto w-full max-w-5xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl backdrop-blur-xl md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-700">Portfolio</p>
            <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
            <p className="mt-2 text-sm text-slate-700">Project history, risk, and complexity.</p>
          </div>
          <Link
            href="/upload"
            className="inline-flex h-10 items-center justify-center rounded-full border border-cyan-300/60 px-5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-300/10"
          >
            Back to Upload
          </Link>
        </div>
        <WorkspaceContextBanner lens="Portfolio" />

        <section className="space-y-3">
          <label htmlFor="quick-search" className="text-sm text-slate-800">
            Quick search
          </label>
          <input
            id="quick-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project name or source file"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-600 focus:ring focus:ring-cyan-300/60"
          />
        </section>

        {isLoading ? <p className="text-sm text-slate-700">Loading portfolio...</p> : null}
        {error ? <p className="text-sm text-rose-800">{error}</p> : null}

        {!isLoading && !error ? (
          <section className="space-y-3">
            {filteredProjects.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                No analyzed projects found.
              </p>
            ) : (
              filteredProjects.map((project) => (
                <article key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{project.projectName}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${complexityBadge(project.complexity)}`}>
                      {project.complexity}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                    <p>Upload date: {new Date(project.uploadDate).toLocaleString()}</p>
                    <p>Risk count: {project.riskCount}</p>
                  </div>
                </article>
              ))
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
