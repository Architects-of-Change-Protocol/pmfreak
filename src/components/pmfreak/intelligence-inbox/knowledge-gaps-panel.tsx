// Voiced as the Project Brain's own uncertainty — creates the motivation to
// keep feeding it evidence. Static and generic today (no extraction runs to
// know which gaps are real), which is honest: it's a standing reminder of
// what any brand-new Project Brain can't yet know, not a live gap analysis.
const KNOWLEDGE_GAPS = [
  "I still don't know who owns delivery.",
  "I don't yet understand contractual milestones.",
  "I haven't identified project dependencies.",
  "I haven't seen enough communication history to assess risk.",
  "I still cannot estimate delivery confidence.",
];

export function KnowledgeGapsPanel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-5">
      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">What The Brain Doesn&apos;t Know Yet</p>
      <ul className="mt-3 space-y-2.5">
        {KNOWLEDGE_GAPS.map((gap) => (
          <li key={gap} className="flex items-start gap-2.5 text-xs italic leading-relaxed text-zinc-500">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400/70" />
            <span>&ldquo;{gap}&rdquo;</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-zinc-400">Every piece of evidence you add helps close a gap.</p>
    </div>
  );
}
