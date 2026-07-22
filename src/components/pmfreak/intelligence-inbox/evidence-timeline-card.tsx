"use client";

import { useState } from "react";
import { EVIDENCE_SOURCE_CATEGORIES, type EvidenceSourceCategoryId } from "./intelligence-inbox-icons";

// The Project Brain's reasoning pass over one piece of evidence — not a file
// upload status. "learned" and "failed" are terminal; everything else is a
// transient "thinking" stage the UI walks through automatically.
export type EvidenceProcessingState = "receiving" | "reading" | "extracting" | "updating" | "learned" | "failed";

export type EvidenceTimelineItem = {
  id: string;
  sourceType: EvidenceSourceCategoryId;
  title: string;
  uploader: string;
  timestampMs: number;
  processingState: EvidenceProcessingState;
};

const THINKING_LABEL: Partial<Record<EvidenceProcessingState, string>> = {
  receiving: "Receiving evidence…",
  reading: "Reading…",
  extracting: "Extracting operational signals…",
  updating: "Updating project memory…",
};

// The story categories shown by default once the brain finishes with an
// item, plus the reserved ones tucked behind a toggle. No extraction runs
// yet, so every value is "—" — this only reserves the shape for later.
const STORY_CATEGORIES = ["Decisions", "Action Items", "Risks", "Stakeholders"];
const RESERVED_CATEGORIES = [
  "Dependencies",
  "Milestones",
  "Deadlines",
  "Financial Signals",
  "Governance Signals",
  "Questions",
  "Unknowns",
  "References",
];

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EvidenceTimelineCard({ item }: { item: EvidenceTimelineItem }) {
  const [showReserved, setShowReserved] = useState(false);
  const category = EVIDENCE_SOURCE_CATEGORIES.find((c) => c.id === item.sourceType) ?? EVIDENCE_SOURCE_CATEGORIES[1];
  const Icon = category.Icon;
  const isThinking = item.processingState !== "learned" && item.processingState !== "failed";

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
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${
            item.processingState === "learned"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : item.processingState === "failed"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-cyan-200 bg-cyan-50 text-cyan-700"
          }`}
        >
          {item.processingState === "learned" ? "Learned" : item.processingState === "failed" ? "Failed" : "Thinking"}
        </span>
      </div>

      {isThinking && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-400/[0.04] px-3 py-2">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cyan-400" />
          <p className="text-xs font-medium text-cyan-800">{THINKING_LABEL[item.processingState]}</p>
        </div>
      )}

      {item.processingState === "learned" && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-zinc-400">Project Brain is learning from this evidence:</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STORY_CATEGORIES.map((label) => (
              <div key={label} className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">{label}</p>
                <p className="mt-0.5 text-xs text-zinc-300">—</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowReserved((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 transition hover:text-cyan-700"
          >
            <span className={`inline-block transition-transform ${showReserved ? "rotate-90" : ""}`}>›</span>
            {showReserved ? "Hide reserved signals" : "Show more reserved signals"}
          </button>

          {showReserved && (
            <div className="grid gap-2 sm:grid-cols-4">
              {RESERVED_CATEGORIES.map((label) => (
                <div key={label} className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-2.5 py-2">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">{label}</p>
                  <p className="mt-0.5 text-xs text-zinc-300">—</p>
                </div>
              ))}
            </div>
          )}

          <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <span className="text-emerald-500">✓</span>
            Project Memory Updated
          </p>
        </div>
      )}

      {item.processingState === "failed" && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-rose-600">
          The Project Brain couldn&apos;t process this evidence. Try adding it again.
        </p>
      )}
    </div>
  );
}
