import type { OperationalDelta } from "@/lib/operational-diff";

export function OperationalDeltas({ deltas }: { deltas: OperationalDelta[] }) {
  return <div className="space-y-2">{deltas.map((d) => <div key={d.domain} className="rounded-lg border border-slate-700 bg-white p-3 text-sm text-slate-800">{d.domain}: confidence {d.previousConfidence} → {d.currentConfidence} ({d.confidenceDelta}), completion {d.previousCompletion} → {d.currentCompletion} ({d.completionDelta}), missing fields Δ {d.missingDataDelta}</div>)}</div>;
}
