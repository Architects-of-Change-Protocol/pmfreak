"use client";

import type { DrawerContent } from "./types";
import { CloseIcon } from "./icons";

export function DetailDrawer({ content, onClose }: { content: DrawerContent | null; onClose: () => void }) {
  const open = content !== null;
  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={content?.title ?? "Detail"}
        className={`absolute right-0 top-0 h-full w-full max-w-sm border-l border-white/10 bg-[#0b0b0e] shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {content && (
          <div className="flex h-full flex-col overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold leading-snug text-zinc-100">{content.title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-lg p-1 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Why this matters</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">{content.why}</p>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Evidence</p>
              <ul className="mt-1.5 space-y-1">
                {content.evidence.map((item) => (
                  <li key={item} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-300">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-300">Suggested next step</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">{content.nextStep}</p>
            </div>

            {(content.actions ?? []).length > 0 && (
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                {(content.actions ?? []).map((action, i) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      i === 0
                        ? "border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
                        : "border-white/10 text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
            {content.note && <p className="mt-3 text-[11px] text-amber-300">{content.note}</p>}
            {(content.actions ?? []).length > 0 && (
              <p className="mt-3 text-[11px] text-zinc-500">Sensitive actions are routed for approval.</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
