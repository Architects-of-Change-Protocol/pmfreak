"use client";

import { useState } from "react";
import { EVIDENCE_SOURCE_CATEGORIES, NotesIcon, type EvidenceSourceCategoryId } from "./intelligence-inbox-icons";

// "note" is a valid sourceType (manual paste/note captures) but deliberately
// isn't one of the droppable categories in EVIDENCE_SOURCE_CATEGORIES — that
// list represents what the drop zone accepts, not what a manual capture is
// labeled. Handled here instead of folding it into the drop-zone catalog.
const NOTE_CATEGORY = { id: "note" as const, label: "Notes", Icon: NotesIcon };

// Every state here maps 1:1 to a real, persisted backend fact — never a
// fixed-timer simulation. "uploading" is the in-flight fetch to /api/upload.
// "stored"/"processing"/"processed"/"failed" mirror project_evidence.status
// exactly (see evidence-processor.ts). There is no "learned" state: the
// system has never run — and does not yet claim to run — any operation that
// identifies decisions, risks, or stakeholders from evidence content, so no
// UI label may imply that it has.
export type EvidenceProcessingState = "uploading" | "stored" | "processing" | "processed" | "failed";

export type EvidenceTimelineItem = {
  id: string;
  /** The server-side project_evidence row id, when this item is backed by a real upload — used to poll its real processing status. Absent for manual text captures, which are already fully persisted by the time they're added. */
  evidenceId?: string;
  sourceType: EvidenceSourceCategoryId;
  title: string;
  uploader: string;
  timestampMs: number;
  processingState: EvidenceProcessingState;
};

const STATUS_LABEL: Record<EvidenceProcessingState, string> = {
  uploading: "Uploading…",
  stored: "Stored in Project Memory",
  processing: "Reading contents…",
  processed: "Content extracted",
  failed: "Failed",
};

const STATUS_TONE: Record<EvidenceProcessingState, string> = {
  uploading: "border-cyan-200 bg-cyan-50 text-cyan-700",
  stored: "border-slate-200 bg-slate-50 text-slate-600",
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
  const [showAnalysis, setShowAnalysis] = useState(false);
  const category =
    item.sourceType === "note"
      ? NOTE_CATEGORY
      : (EVIDENCE_SOURCE_CATEGORIES.find((c) => c.id === item.sourceType) ?? EVIDENCE_SOURCE_CATEGORIES[1]);
  const Icon = category.Icon;
  const isPersisted = item.processingState === "stored" || item.processingState === "processing" || item.processingState === "processed";

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
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${STATUS_TONE[item.processingState]}`}>
          {STATUS_LABEL[item.processingState]}
        </span>
      </div>

      {isPersisted && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowAnalysis((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 transition hover:text-cyan-700"
          >
            <span className={`inline-block transition-transform ${showAnalysis ? "rotate-90" : ""}`}>›</span>
            Project Brain Analysis
          </button>
          {showAnalysis && (
            <p className="text-xs text-zinc-400">
              No operational analysis is available for this evidence yet.
            </p>
          )}
        </div>
      )}

      {item.processingState === "failed" && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-rose-600">
          The evidence was stored, but its contents could not be read.
        </p>
      )}
    </div>
  );
}
