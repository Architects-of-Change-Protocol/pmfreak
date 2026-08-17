import type { NeedsYouItem } from "./types";
import { StatusBadge } from "./status-badge";
import { SectionEmptyState, SectionLoadingState } from "./section-empty-state";

export function NeedsYouQueue({
  items,
  onSelect,
  loading = false,
  errorMessage = null,
  onRetry,
  onAddNotes,
}: {
  items: NeedsYouItem[];
  onSelect: (item: NeedsYouItem) => void;
  /** True while the operational flow for the active project is still loading. */
  loading?: boolean;
  /** Set when project attention could not be loaded. Shown instead of a misleading empty state. */
  errorMessage?: string | null;
  /** Safe retry for the failed load. */
  onRetry?: () => void;
  /** Opens the notes intake — the real way to generate project signals. */
  onAddNotes?: () => void;
}) {
  const showEmpty = !loading && !errorMessage && items.length === 0;
  return (
    <section aria-labelledby="needs-you-heading">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id="needs-you-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Needs You
        </h2>
      </div>

      {/* Loading and failure are announced, so the state change is not visual-only. */}
      <div role="status" aria-live="polite">
        {loading && items.length === 0 && <SectionLoadingState label="Checking what needs your attention…" />}
        {errorMessage && (
          <div className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-3">
            <p className="text-sm text-rose-200">{errorMessage}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {showEmpty && (
        <SectionEmptyState
          title="No human decisions currently require attention."
          description="When project evidence produces a governed recommendation that needs a human decision, it appears here."
          ctaLabel="Add project notes"
          onCta={onAddNotes}
        />
      )}

      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/20 hover:bg-white/[0.05] focus:border-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
              <span className="truncate text-sm text-zinc-200">{item.title}</span>
              <StatusBadge tone={item.badge.tone}>{item.badge.label}</StatusBadge>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
