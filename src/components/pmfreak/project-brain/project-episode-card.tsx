"use client";

// A compact, expandable list item for one ProjectEpisode — the building
// block of the episode-driven Project Memory timeline
// (project-intelligence-inbox.tsx). Every visual signal (type, status) has a
// text label alongside it, never color alone. Expanding reveals the full
// ProjectEpisodeDetail disclosure inline, following the same
// disclosure-triangle pattern already used by EvidenceTimelineCard.

import { useState } from "react";
import { labelForEpisodeActor, labelForEpisodeType } from "@/lib/project-brain/episodic-memory/episode-language";
import type { ProjectEpisode, ProjectEpisodeType } from "@/lib/project-brain/episodic-memory/types";
import { ProjectEpisodeDetail } from "./project-episode-detail";

const TYPE_TONE: Partial<Record<ProjectEpisodeType, string>> = {
  project_created: "border-slate-200 bg-slate-50 text-slate-600",
  brain_activated: "border-slate-200 bg-slate-50 text-slate-600",
  context_recorded: "border-sky-200 bg-sky-50 text-sky-700",
  evidence_received: "border-cyan-200 bg-cyan-50 text-cyan-700",
  evidence_stored: "border-cyan-200 bg-cyan-50 text-cyan-700",
  evidence_processing_failed: "border-rose-200 bg-rose-50 text-rose-700",
  knowledge_recorded: "border-emerald-200 bg-emerald-50 text-emerald-700",
  knowledge_updated: "border-indigo-200 bg-indigo-50 text-indigo-700",
  knowledge_confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  knowledge_superseded: "border-indigo-200 bg-indigo-50 text-indigo-700",
  knowledge_retracted: "border-rose-200 bg-rose-50 text-rose-700",
  question_opened: "border-purple-200 bg-purple-50 text-purple-700",
  question_resolved: "border-purple-200 bg-purple-50 text-purple-700",
  gap_identified: "border-amber-200 bg-amber-50 text-amber-700",
  gap_resolved: "border-amber-200 bg-amber-50 text-amber-700",
  status_changed: "border-slate-200 bg-slate-50 text-slate-600",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ProjectEpisodeCard({
  episode,
  relatedEpisodes = [],
  liveStatusLabel,
}: {
  episode: ProjectEpisode;
  relatedEpisodes?: ProjectEpisode[];
  /** Live processing status (e.g. "Uploading…", "Content extracted") for an evidence_stored episode still in flight — cross-referenced from the caller's own live upload state, never derived here. */
  liveStatusLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const tone = TYPE_TONE[episode.type] ?? "border-slate-200 bg-slate-50 text-slate-600";
  const sourceCount = episode.sourceReferences.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${tone}`}>
            {labelForEpisodeType(episode.type)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{episode.title}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              <time dateTime={episode.occurredAt}>{formatTime(episode.occurredAt)}</time> · {labelForEpisodeActor(episode.actor)}
              {sourceCount > 0 ? ` · ${sourceCount} source${sourceCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        {episode.status !== "recorded" && (
          <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-indigo-700">
            {episode.status}
          </span>
        )}
        {liveStatusLabel && (
          <span className="shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-cyan-700">
            {liveStatusLabel}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-zinc-600">{episode.summary}</p>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 transition hover:text-cyan-700"
      >
        <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true">
          ›
        </span>
        {expanded ? "Hide details" : "View details"}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ProjectEpisodeDetail episode={episode} relatedEpisodes={relatedEpisodes} />
        </div>
      )}
    </div>
  );
}
