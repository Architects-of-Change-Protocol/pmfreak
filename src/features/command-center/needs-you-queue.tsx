import type { NeedsYouItem } from "./types";
import { StatusBadge } from "./status-badge";

export function NeedsYouQueue({ items, onSelect }: { items: NeedsYouItem[]; onSelect: (item: NeedsYouItem) => void }) {
  return (
    <div>
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Needs You</p>
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
