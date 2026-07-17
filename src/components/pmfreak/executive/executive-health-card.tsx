import type { ProjectHealthScore } from "@/lib/executive-health";

export function ExecutiveHealthCard({ health, coherence }: { health: ProjectHealthScore; coherence: number }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm uppercase tracking-[0.2em] text-slate-500">Global Health Score</h2>
      <p className="mt-2 text-4xl font-semibold text-slate-900">{health.overall}</p>
      <p className="mt-1 text-xs text-slate-500">Operational coherence: {coherence}</p>
    </section>
  );
}
