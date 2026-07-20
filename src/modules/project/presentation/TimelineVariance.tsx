import type { ProjectHealth } from "../contracts/project-health.contract";

/**
 * Timeline variance / delay forecast (Fase 4 mockup: "Potential delay: 14 days").
 * The bar is decorative — the same information is stated as text below it,
 * so a screen-reader user never depends on the visualization alone
 * (08-accessibility-guidelines.md §2).
 */
export function TimelineVariance({ forecast, schedule }: { forecast: ProjectHealth["forecast"]; schedule: ProjectHealth["schedule"] }) {
  const completionRatio = schedule.totalTasks > 0 ? (schedule.totalTasks - schedule.unscheduledTasks) / schedule.totalTasks : 0;
  const percent = Math.round(completionRatio * 100);

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Timeline</h3>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-500/20" aria-hidden="true">
        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-sm text-slate-300">{percent}% scheduled</p>
      {forecast.varianceDays !== 0 ? (
        <p className="mt-2 text-sm text-slate-100">
          Potential delay: {Math.abs(forecast.varianceDays)} day(s) {forecast.varianceDays > 0 ? "behind" : "ahead of"} baseline
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-100">On baseline — no forecast variance detected.</p>
      )}
    </div>
  );
}
