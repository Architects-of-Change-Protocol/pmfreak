import type { ProjectHealth } from "../contracts/project-health.contract";

/** AI Insights + Decisions Needed (Fase 4 mockup). */
export function AIInsightCard({ health }: { health: ProjectHealth }) {
  return (
    <div>
      <span className="w-fit rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: "var(--pmf-ai-accent)", backgroundColor: "var(--pmf-ai-accent-bg)" }}>
        AI-generated
      </span>
      <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">AI Insights</h3>
      <p className="text-sm text-slate-100">
        {health.forecast.varianceDays > 0
          ? `Potential delay: ${health.forecast.varianceDays} day(s), based on ${health.schedule.delayedTasks} delayed and ${health.schedule.atRiskTasks} at-risk task(s).`
          : "No delay currently forecast."}
      </p>
      <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Decisions Needed</h3>
      <p className="text-sm text-slate-100">{health.decisionsNeeded}</p>
    </div>
  );
}
