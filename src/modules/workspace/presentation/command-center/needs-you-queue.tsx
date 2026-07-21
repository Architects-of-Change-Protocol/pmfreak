import type { NeedsYouItem } from "./types";
import { StatusBadge } from "./status-badge";
import { SectionEmptyState, SectionLoadingState } from "./section-empty-state";

export function NeedsYouQueue({
  items,
  onSelect,
  loading = false,
  onAddNotes,
}: {
  items: NeedsYouItem[];
  onSelect: (item: NeedsYouItem) => void;
  /** True while the operational flow for the active project is still loading. */
  loading?: boolean;
  /** Opens the notes intake — the real way to generate project signals. */
  onAddNotes?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Needs You</p>
      </div>
      {loading && items.length === 0 && <SectionLoadingState label="Checking for open decisions..." />}
      {!loading && items.length === 0 && (
        <SectionEmptyState
          title="Nothing requires your attention yet"
          description="When project evidence produces a recommendation that needs a human decision, it appears here."
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
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-slate-300 hover:shadow-[0_2px_10px_rgba(15,23,42,0.05)]"
            >
              <span className="truncate text-sm text-slate-700">{item.title}</span>
              <StatusBadge tone={item.badge.tone}>{item.badge.label}</StatusBadge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
