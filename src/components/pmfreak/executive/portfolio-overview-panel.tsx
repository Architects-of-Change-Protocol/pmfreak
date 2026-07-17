import type { PortfolioIntelligence } from "@/lib/portfolio/types";

type Props = Omit<PortfolioIntelligence, "summary"> & {
  summary: PortfolioIntelligence["summary"];
};

export function PortfolioOverviewPanel({
  summary,
  projects,
  bottlenecks,
  dependencyRisks,
  executiveAttention,
}: Props) {
  const healthColor =
    summary.portfolioHealthScore >= 70
      ? "text-emerald-700"
      : summary.portfolioHealthScore >= 40
        ? "text-amber-700"
        : "text-rose-700";

  const riskColor =
    summary.portfolioRiskScore <= 30
      ? "text-emerald-700"
      : summary.portfolioRiskScore <= 60
        ? "text-amber-700"
        : "text-rose-700";

  const riskBadge = (level: string) => {
    const styles: Record<string, string> = {
      critical: "border-rose-400/30 bg-rose-400/[0.08] text-rose-700",
      high: "border-orange-400/30 bg-orange-400/[0.08] text-orange-700",
      medium: "border-amber-400/30 bg-amber-400/[0.08] text-amber-700",
      low: "border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-600",
    };
    return styles[level] ?? styles.low;
  };

  const projectNameById = new Map(projects.map((p) => [p.projectId, p.projectName]));

  return (
    <section className="space-y-4" data-testid="portfolio-overview-panel">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-purple-600">Portfolio Intelligence</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Portfolio Overview</h2>
      </header>

      {/* Portfolio Health & Risk */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Portfolio Health</p>
          <p className={`mt-1 text-3xl font-semibold ${healthColor}`}>{summary.portfolioHealthScore}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">0–100 composite score</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Portfolio Risk</p>
          <p className={`mt-1 text-3xl font-semibold ${riskColor}`}>{summary.portfolioRiskScore}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">higher = worse</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Active Projects</p>
          <p className="mt-1 text-3xl font-semibold text-slate-800">{summary.activeProjectCount}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400">of {summary.projectCount} total</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-600">Executive Attention</p>
          <p className={`mt-1 text-3xl font-semibold ${executiveAttention.length > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {executiveAttention.length}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-400">projects need attention</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Executive Attention Queue */}
        {executiveAttention.length > 0 && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.04] p-4" data-testid="executive-attention-queue">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-rose-700">Executive Attention Queue</p>
            <div className="mt-3 space-y-2">
              {executiveAttention.slice(0, 5).map((p) => (
                <div key={p.projectId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-800 text-sm">{p.projectName}</p>
                    <div className="flex shrink-0 gap-1.5 text-[10px]">
                      <span className={`rounded border px-1.5 py-0.5 ${p.healthScore < 50 ? "border-rose-400/25 bg-rose-400/[0.08] text-rose-700" : "border-slate-200 text-zinc-500"}`}>
                        H:{p.healthScore}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 ${p.riskScore > 70 ? "border-rose-400/25 bg-rose-400/[0.08] text-rose-700" : "border-slate-200 text-zinc-500"}`}>
                        R:{p.riskScore}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                    {p.blockedTaskCount > 0 && (
                      <span className="text-amber-600">{p.blockedTaskCount} blocked tasks</span>
                    )}
                    {p.overdueTaskCount > 0 && (
                      <span className="text-rose-600">{p.overdueTaskCount} overdue</span>
                    )}
                    {p.scheduleVarianceDays > 0 && (
                      <span className="text-orange-600">+{p.scheduleVarianceDays}d variance</span>
                    )}
                    {p.unresolvedRaidCount > 0 && (
                      <span>{p.unresolvedRaidCount} open RAID</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Bottlenecks */}
        {bottlenecks.length > 0 && (
          <div className="rounded-2xl border border-orange-400/20 bg-orange-400/[0.03] p-4" data-testid="portfolio-bottlenecks-panel">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-orange-700">Portfolio Bottlenecks</p>
            <div className="mt-3 space-y-2">
              {bottlenecks.slice(0, 5).map((b) => (
                <div key={b.entityId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-700 truncate">{b.entityLabel || b.entityId}</p>
                    <span className="shrink-0 rounded border border-orange-400/20 px-1.5 py-0.5 text-[9px] uppercase text-orange-700">{b.entityType}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-zinc-500">
                    <span>Blocking {b.blockingCount}</span>
                    <span>Impact {b.impactScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cross-Project Dependency Risk */}
      {dependencyRisks.length > 0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.03] p-4" data-testid="cross-project-risks">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-700">Cross-Project Dependency Risk</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dependencyRisks.slice(0, 6).map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-zinc-500 truncate">
                    {projectNameById.get(r.sourceProjectId) ?? r.sourceProjectId.slice(0, 8)}
                    {" → "}
                    {projectNameById.get(r.targetProjectId) ?? r.targetProjectId.slice(0, 8)}
                  </p>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[8px] uppercase font-semibold ${riskBadge(r.riskLevel)}`}>
                    {r.riskLevel}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-zinc-400">
                  {r.dependencyCount} {r.dependencyCount === 1 ? "dependency" : "dependencies"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
