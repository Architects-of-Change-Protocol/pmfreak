// Compact right-rail echo of the Project Brain Brief's "What I Need Next"
// section (project-brain-introduction.tsx) — same structured gaps, same
// first-person voice, just condensed to a glance. No hardcoded/generic gaps
// live here anymore: every gap comes from derive-initial-response.ts, which
// only produces one when real project state (or its real absence) supports it.
import type { ProjectBrainKnowledgeGap } from "@/lib/project-brain/types";

export function KnowledgeGapsPanel({ gaps }: { gaps: ProjectBrainKnowledgeGap[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-5">
      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Current Knowledge Gaps</p>
      {gaps.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-400">No open knowledge gaps identified.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {gaps.map((gap) => (
            <li key={gap.id} className="flex items-start gap-2.5 text-xs italic leading-relaxed text-zinc-500">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400/70" />
              <span>&ldquo;{gap.question}&rdquo;</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-zinc-400">Every piece of evidence you add helps close a gap.</p>
    </div>
  );
}
