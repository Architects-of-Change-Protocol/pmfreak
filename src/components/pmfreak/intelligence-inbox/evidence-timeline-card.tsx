"use client";

import { useState } from "react";
import { EVIDENCE_SOURCE_CATEGORIES, type EvidenceSourceCategoryId } from "./intelligence-inbox-icons";

export type EvidenceProcessingState = "queued" | "processing" | "processed" | "failed";

export type EvidenceTimelineItem = {
  id: string;
  sourceType: EvidenceSourceCategoryId;
  title: string;
  uploader: string;
  timestampMs: number;
  processingState: EvidenceProcessingState;
};

// Every category AI will eventually extract per evidence item. Rendered as
// placeholders only — no extraction runs yet, so every value is "—".
const INSIGHT_CATEGORIES = [
  "Detected Risks",
  "Detected Decisions",
  "Action Items",
  "Stakeholders",
  "Dependencies",
  "Milestones",
  "Deadlines",
  "Financial Signals",
  "Governance Signals",
  "Questions",
  "Unknowns",
  "References",
];

const STATE_LABEL: Record<EvidenceProcessingState, string> = {
  queued: "Queued",
  processing: "Processing",
  processed: "Learned",
  failed: "Failed",
};

const STATE_TONE: Record<EvidenceProcessingState, string> = {
  queued: "border-slate-200 bg-slate-50 text-zinc-500",
  processing: "border-cyan-200 bg-cyan-50 text-cyan-700",
  processed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EvidenceTimelineCard({ item }: { item: EvidenceTimelineItem }) {
  const [expanded, setExpanded] = useState(false);
  const category = EVIDENCE_SOURCE_CATEGORIES.find((c) => c.id === item.sourceType) ?? EVIDENCE_SOURCE_CATEGORIES[1];
  const Icon = category.Icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-200/50 bg-cyan-400/[0.06] text-cyan-700">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {category.label} · {item.uploader} · {formatTimestamp(item.timestampMs)}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${STATE_TONE[item.processingState]}`}>
          {STATE_LABEL[item.processingState]}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 transition hover:text-cyan-700"
      >
        <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
        {expanded ? "Hide extracted insights" : "Awaiting AI analysis · Show reserved insights"}
      </button>

      {expanded && (
        <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
          {INSIGHT_CATEGORIES.map((label) => (
            <div key={label} className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">{label}</p>
              <p className="mt-0.5 text-xs text-zinc-300">—</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
