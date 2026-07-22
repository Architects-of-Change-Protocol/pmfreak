// "Project Understanding" is the one metric tied to something real (how many
// items the Project Brain has finished thinking about) — everything below it
// is an honest placeholder until extraction ships. None of these are file or
// storage statistics; they describe what the brain does and doesn't grasp.
const CONFIDENCE_METRICS = [
  "Decision Coverage",
  "Stakeholder Confidence",
  "Timeline Confidence",
  "Governance Confidence",
  "Delivery Confidence",
];

const AWARENESS_SIGNALS = [
  "Detected Risks",
  "Detected Decisions",
  "Known Stakeholders",
  "Known Systems",
  "Known Vendors",
  "Known Milestones",
  "Known Deliverables",
];

export function OperationalMemoryPanel({
  evidenceCount,
  understandingPercent,
}: {
  evidenceCount: number;
  understandingPercent: number;
}) {
  return (
    <aside className="h-fit space-y-5 rounded-2xl border border-slate-200 bg-white/90 p-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Understanding</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-slate-900 transition-all duration-700">
            {understandingPercent}%
          </span>
          <span className="text-xs text-zinc-400">{evidenceCount === 0 ? "Not started" : "Growing"}</span>
        </div>
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400 transition-[width] duration-700 ease-out"
            style={{ width: `${understandingPercent}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
          {evidenceCount === 0
            ? "Your Project Brain knows almost nothing yet."
            : "Grows as your Project Brain reviews more evidence — not a real confidence score yet."}
        </p>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Operational Confidence</p>
        <dl className="mt-2.5 space-y-2">
          {CONFIDENCE_METRICS.map((label) => (
            <div key={label} className="flex items-center justify-between">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-300">Not yet known</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Operational Awareness</p>
        <dl className="mt-2.5 space-y-2">
          {AWARENESS_SIGNALS.map((label) => (
            <div key={label} className="flex items-center justify-between">
              <dt className="text-xs text-zinc-500">{label}</dt>
              <dd className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-300">Not yet known</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
