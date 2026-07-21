/** Honest empty state for a Command Center section: what it means, why it is
 *  empty, and what the user can do now. Never renders placeholder data. */
export function SectionEmptyState({
  title,
  description,
  ctaLabel,
  onCta,
}: {
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-3">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-2.5 rounded-lg border border-sky-200 bg-sky-50/60 px-2.5 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

/** Muted placeholder while a section's real data is still loading. */
export function SectionLoadingState({ label }: { label: string }) {
  return <p className="mt-2 rounded-xl border border-slate-200 bg-white/60 px-3 py-2.5 text-xs text-slate-400">{label}</p>;
}
