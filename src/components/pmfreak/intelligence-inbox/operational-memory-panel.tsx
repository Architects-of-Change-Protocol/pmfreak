// Every number here is a real count from either the evidence table or the
// validated ProjectBrainResponse — no heuristic percentage, no "Not yet
// known" placeholder dressed up as an analysis result. When there is
// genuinely nothing to report (operational analysis), that's stated plainly
// instead of being papered over with a fabricated metric.
import type { ProjectBrainResponse } from "@/lib/project-brain/types";

export function OperationalMemoryPanel({
  evidenceCount,
  response,
}: {
  evidenceCount: number;
  /** null while the derivation/guardrail pipeline hasn't produced a safe response yet. */
  response: ProjectBrainResponse | null;
}) {
  const knownCount = response?.statements.filter((s) => s.epistemicType === "FACT" || s.epistemicType === "REPORTED").length ?? 0;
  const unresolvedCount = response?.statements.filter((s) => s.epistemicType === "UNKNOWN" || s.epistemicType === "OPEN_QUESTION").length ?? 0;

  return (
    <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Memory</p>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">
          {evidenceCount} evidence item{evidenceCount === 1 ? "" : "s"} stored
        </p>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Brain Status</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Online
        </p>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Operational Analysis</p>
        <p className="mt-1.5 text-xs text-zinc-500">Not available yet.</p>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Current Knowledge</p>
        <dl className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-xs text-zinc-500">Setup facts</dt>
            <dd className="text-xs font-medium text-slate-700">{knownCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-xs text-zinc-500">Unresolved questions</dt>
            <dd className="text-xs font-medium text-slate-700">{unresolvedCount}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
