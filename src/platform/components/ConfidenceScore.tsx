/**
 * Renders an AI confidence value adjacent to its basis, never in isolation
 * and never mapped to color alone (08-ai-interaction-patterns.md §2.1,
 * 08-accessibility-guidelines.md §4). PMFreak never suppresses a
 * Recommendation for low confidence — a low value is flagged, not hidden.
 */
export function ConfidenceScore({ confidence, basis, lowConfidenceThreshold = 50 }: { confidence: number; basis: string; lowConfidenceThreshold?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(confidence)));
  const isLow = clamped < lowConfidenceThreshold;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-slate-100">{clamped}%</span>
        {isLow ? (
          <span className="rounded-full border border-slate-400/40 px-2 py-0.5 text-[11px] font-medium text-slate-300">Low confidence</span>
        ) : null}
      </div>
      <span className="text-xs text-slate-400">{basis}</span>
    </div>
  );
}
