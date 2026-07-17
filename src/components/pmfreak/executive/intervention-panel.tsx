import type { ExecutiveInterventionRecommendation } from "@/lib/intervention-engine";

export function InterventionPanel({ interventions }: { interventions: ExecutiveInterventionRecommendation[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Interventions</h2>
      <div className="mt-3 space-y-2">
        {interventions.map((intervention) => (
          <div key={intervention.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">{intervention.action}</p>
            <p className="text-xs text-slate-600">{intervention.whyTriggered}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
