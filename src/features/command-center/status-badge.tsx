import type { ReactNode } from "react";
import type { StatusTone } from "./types";

const TONE_STYLES: Record<StatusTone, { dot: string; bg: string; text: string; border: string }> = {
  danger: { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  task: { dot: "bg-sky-500", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  approval: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  insight: { dot: "bg-violet-500", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  success: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  info: { dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

export const TONE_LABELS: Record<StatusTone, string> = {
  danger: "Warning",
  task: "Task",
  approval: "Approval",
  insight: "Insight",
  success: "Done",
  info: "Info",
};

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const c = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5 ${c.bg} ${c.text} ${c.border}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
      {children}
    </span>
  );
}

export function StatusDot({ tone, pulse = false }: { tone: StatusTone; pulse?: boolean }) {
  const c = TONE_STYLES[tone];
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${c.dot}`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
    </span>
  );
}

export function toneStyles(tone: StatusTone) {
  return TONE_STYLES[tone];
}

/** Marks a section as showing illustrative example content rather than real project data. */
export function PreviewTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-violet-600">
      Example
    </span>
  );
}
