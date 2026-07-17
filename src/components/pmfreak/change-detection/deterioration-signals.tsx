import type { DeteriorationSignal, ImprovementSignal } from "@/lib/change-detection";

export function DeteriorationSignals({ deterioration, improvements }: { deterioration: DeteriorationSignal[]; improvements: ImprovementSignal[] }) {
  return <div className="grid gap-3 md:grid-cols-2"><section className="rounded-lg border border-rose-700/40 bg-white p-3"><h3 className="text-sm font-semibold text-rose-800">Deterioration alerts</h3><ul className="mt-2 space-y-1 text-xs text-slate-800">{deterioration.map((s) => <li key={s.metric}>{s.metric}: {s.reason}</li>)}</ul></section><section className="rounded-lg border border-emerald-700/40 bg-white p-3"><h3 className="text-sm font-semibold text-emerald-800">Improvement alerts</h3><ul className="mt-2 space-y-1 text-xs text-slate-800">{improvements.map((s) => <li key={s.metric}>{s.metric}: {s.reason}</li>)}</ul></section></div>;
}
