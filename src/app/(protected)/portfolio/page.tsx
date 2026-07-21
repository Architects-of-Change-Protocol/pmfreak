"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { WorkspaceContextBanner } from "@/components/pmfreak/workspace/workspace-context-banner";
import { EmptyPortfolio } from "@/components/pmfreak/empty-states";
import type { WorkspaceActivationResult } from "@/lib/workspace-activation/types";

type PortfolioProject = {
  projectId: string;
  projectName: string;
  healthScore: number;
  riskScore: number;
  blockedTaskCount: number;
  overdueTaskCount: number;
  criticalTaskCount: number;
  unresolvedRaidCount: number;
  requiresExecutiveAttention: boolean;
};

const healthBadge = (healthScore: number) => {
  if (healthScore < 50) {
    return "bg-rose-300/20 text-rose-900 border-rose-300/40";
  }

  if (healthScore < 75) {
    return "bg-amber-300/20 text-amber-900 border-amber-300/40";
  }

  return "bg-emerald-300/20 text-emerald-900 border-emerald-300/40";
};

const activationFetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed ${url}`);
  return response.json() as Promise<{ ok: boolean; data?: { activation: WorkspaceActivationResult } }>;
};

export default function PortfolioPage() {
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The activation contract already carries per-step permission (real
  // membership role, resolved server-side) — reuse it so a viewer never sees
  // a create CTA they cannot execute.
  const activation = useSWR("/api/workspace-activation", activationFetcher);
  const projectStep = activation.data?.data?.activation.steps.find((s) => s.id === "project_created");
  const canCreateProjects = projectStep ? projectStep.actionAllowed : true;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/portfolio");
        const payload = (await response.json()) as { ok?: boolean; projects?: PortfolioProject[]; error?: string };

        if (!response.ok || !payload.ok || !Array.isArray(payload.projects)) {
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

    return projects.filter((project) => project.projectName.toLowerCase().includes(term));
  }, [projects, search]);

  const isEmpty = !isLoading && !error && projects.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <main className="mx-auto w-full max-w-5xl space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_40px_90px_-60px_rgba(15,23,42,0.35)] md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-700">Portfolio</p>
            <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
            <p className="mt-2 text-sm text-slate-700">Project health, risk, and execution pressure.</p>
          </div>
          <Link
            href="/upload"
            className="inline-flex h-10 items-center justify-center rounded-full border border-cyan-300/60 px-5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-300/10"
          >
            Back to Upload
          </Link>
        </div>
        <WorkspaceContextBanner lens="Portfolio" />

        {!isEmpty && (
          <section className="space-y-3">
            <label htmlFor="quick-search" className="text-sm text-slate-800">
              Quick search
            </label>
            <input
              id="quick-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-600 focus:ring focus:ring-cyan-300/60"
            />
          </section>
        )}

        {isLoading ? <p className="text-sm text-slate-700">Loading portfolio...</p> : null}
        {error ? <p className="text-sm text-rose-800">{error}</p> : null}

        {isEmpty ? <EmptyPortfolio canCreate={canCreateProjects} /> : null}

        {!isLoading && !error && projects.length > 0 ? (
          <section className="space-y-3">
            {filteredProjects.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                No projects match your search.
              </p>
            ) : (
              filteredProjects.map((project) => (
                <article key={project.projectId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{project.projectName}</h2>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${healthBadge(project.healthScore)}`}>
                      Health {project.healthScore}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                    <p>Risk score: {project.riskScore}</p>
                    <p>Blocked tasks: {project.blockedTaskCount}</p>
                    <p>Overdue tasks: {project.overdueTaskCount}</p>
                    <p>Open RAID items: {project.unresolvedRaidCount}</p>
                  </div>
                  {project.requiresExecutiveAttention && (
                    <p className="mt-3 inline-flex rounded-full border border-amber-300/40 bg-amber-300/20 px-3 py-1 text-xs font-semibold text-amber-900">
                      Executive attention required
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
