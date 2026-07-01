"use client";

import type { DrawerAction, DrawerContent } from "./types";
import { CloseIcon } from "./icons";

const DEFAULT_ACTIONS: DrawerAction[] = [
  { label: "Draft update", onClick: () => {} },
  { label: "Create task", onClick: () => {} },
  { label: "Mark reviewed", onClick: () => {} },
  { label: "Ask agent", onClick: () => {} },
];

export function DetailDrawer({ content, onClose }: { content: DrawerContent | null; onClose: () => void }) {
  const open = content !== null;
  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/20 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={content?.title ?? "Detail"}
        className={`absolute right-0 top-0 h-full w-full max-w-sm border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {content && (
          <div className="flex h-full flex-col overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold leading-snug text-slate-900">{content.title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Why this matters</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{content.why}</p>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Evidence</p>
              <ul className="mt-1.5 space-y-1">
                {content.evidence.map((item) => (
                  <li key={item} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Suggested next step</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{content.nextStep}</p>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              {(content.actions ?? DEFAULT_ACTIONS).map((action, i) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    i === 0
                      ? "border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-50"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
            {content.note && <p className="mt-3 text-[11px] text-amber-700">{content.note}</p>}
            <p className="mt-3 text-[11px] text-slate-400">Sensitive actions are routed for approval.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
