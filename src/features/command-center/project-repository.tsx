import type { MemoryItem, RepositoryItem } from "./types";
import { REPOSITORY_ICONS } from "./icons";
import { PreviewTag } from "./status-badge";

export function ProjectRepository({ items, preview = false }: { items: RepositoryItem[]; preview?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Project Repository</p>
        {preview && <PreviewTag />}
      </div>
      <p className="mt-1 px-1 text-[11px] leading-relaxed text-slate-400">
        {preview ? "Example of what shows up here once notes are added." : "Everything the project knows lives here."}
      </p>
      <ul className="mt-2 space-y-0.5">
        {items.map((item) => {
          const Icon = REPOSITORY_ICONS[item.icon];
          return (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-100"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== undefined && <span className="shrink-0 text-xs text-slate-400">{item.count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProjectMemory({ items, open, onToggle }: { items: MemoryItem[]; open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-slate-600"
      >
        <span>Project Memory</span>
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-100"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
