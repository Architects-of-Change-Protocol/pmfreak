import type { ProjectHealth } from "../contracts/project-health.contract";

/** "3 active" risks/issues/dependencies breakdown (Fase 4 mockup). */
export function RiskSummary({ raid }: { raid: ProjectHealth["raid"] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Risks</h3>
      <p className="text-sm text-slate-100">
        {raid.riskCount} active{raid.criticalRiskCount > 0 ? ` (${raid.criticalRiskCount} critical)` : ""}
      </p>
      <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Dependencies</h3>
      <p className="text-sm text-slate-100">{raid.dependencyCount} blocker(s)</p>
    </div>
  );
}
