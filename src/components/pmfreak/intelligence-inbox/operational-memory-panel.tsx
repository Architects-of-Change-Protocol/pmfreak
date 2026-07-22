// Evidence Items is the one real, non-extracted count (items captured this
// session). Everything else is a placeholder until AI extraction ships —
// per the Project Intelligence Inbox spec, these are not to be faked.
export function OperationalMemoryPanel({ evidenceCount }: { evidenceCount: number }) {
  const placeholderMetrics = [
    { label: "Decisions", value: 0 },
    { label: "Risks", value: 0 },
    { label: "Tasks", value: 0 },
    { label: "Stakeholders", value: 0 },
    { label: "Dependencies", value: 0 },
  ];

  return (
    <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5">
      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Operational Memory</p>

      <div className="flex items-center justify-between rounded-xl border border-cyan-200/50 bg-cyan-400/[0.05] px-3.5 py-3">
        <span className="text-xs font-medium text-cyan-900">Evidence Items</span>
        <span className="text-lg font-semibold text-cyan-900">{evidenceCount}</span>
      </div>

      <dl className="space-y-2.5">
        {placeholderMetrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between">
            <dt className="text-xs text-zinc-500">{m.label}</dt>
            <dd className="text-sm font-semibold text-slate-900">{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Memory Confidence</span>
          <span className="font-semibold text-slate-900">0%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-0 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400" />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
          Confidence grows as AI cross-references more evidence. Not driven by extraction yet.
        </p>
      </div>
    </aside>
  );
}
