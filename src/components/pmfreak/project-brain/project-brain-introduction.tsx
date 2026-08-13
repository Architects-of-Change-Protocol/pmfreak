"use client";

// The first thing a user sees after Project Brain activation, and the
// coherent state a returning user sees on every later visit — never gated
// on a one-time "just activated" flag (see command-center-client.tsx). Built
// entirely from a validated ProjectBrainResponse (derive-initial-response.ts
// -> guardrails.validateResponse); nothing here is invented in the component.

import { ProjectBrainStatementCard } from "./project-brain-statement-card";
import { PROJECT_BRAIN_FALLBACK_MESSAGE } from "@/lib/project-brain/validate-response-pipeline";
import type { ProjectBrainKnowledgeGap, ProjectBrainResponse } from "@/lib/project-brain/types";

const PRIORITY_TONE: Record<ProjectBrainKnowledgeGap["priority"], string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

function KnowledgeGapRequestCard({ gap, onAddEvidence }: { gap: ProjectBrainKnowledgeGap; onAddEvidence?: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{gap.title}</p>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${PRIORITY_TONE[gap.priority]}`}>
          {gap.priority}
        </span>
      </div>
      <p className="mt-1.5 text-xs italic text-zinc-500">&ldquo;{gap.question}&rdquo;</p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-600">
        <span className="font-medium text-zinc-500">Why it matters: </span>
        {gap.reason}
      </p>
      {gap.suggestedEvidenceTypes.length > 0 && (
        <p className="mt-1.5 text-[11px] text-zinc-400">
          <span className="font-medium">Suggested evidence:</span> {gap.suggestedEvidenceTypes.join(", ")}
        </p>
      )}
      {onAddEvidence && (
        <button
          type="button"
          onClick={onAddEvidence}
          className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50/80 px-3 py-1.5 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-50"
        >
          Add Evidence
        </button>
      )}
    </div>
  );
}

export type RecentMemorySummary = {
  /** Episodes whose occurredAt falls within the caller's own "recent" window — this component does no time math itself. */
  newEpisodeCount: number;
  latestEpisodeTitle?: string | null;
  latestEpisodeAt?: string | null;
  openQuestionCount: number;
};

export function ProjectBrainIntroduction({
  projectName,
  response,
  recentMemory,
  onAddEvidence,
  onCaptureContext,
}: {
  projectName: string;
  /** null when the validation pipeline rejected the derived response — render the honest fallback instead. */
  response: ProjectBrainResponse | null;
  /** Real, already-computed episode counts (Sprint 1) — omitted entirely when the caller has none to report, never zero-filled to look busy. */
  recentMemory?: RecentMemorySummary | null;
  onAddEvidence?: () => void;
  onCaptureContext?: () => void;
}) {
  if (!response) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Brain — Online</p>
        <p className="mt-3 text-sm text-slate-700">{PROJECT_BRAIN_FALLBACK_MESSAGE}</p>
      </section>
    );
  }

  const knownStatements = response.statements.filter((s) => s.epistemicType === "FACT" || s.epistemicType === "REPORTED");
  const unresolvedStatements = response.statements.filter((s) => s.epistemicType === "UNKNOWN" || s.epistemicType === "OPEN_QUESTION");
  const recommendations = response.statements.filter((s) => s.epistemicType === "RECOMMENDATION");

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Brain</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Online — {projectName}
          </p>
        </div>
        <div className="flex gap-2">
          {onAddEvidence && (
            <button
              type="button"
              onClick={onAddEvidence}
              className="rounded-xl border border-cyan-200/60 bg-cyan-400/[0.08] px-4 py-2 text-xs font-semibold text-cyan-900 transition hover:bg-cyan-400/[0.16]"
            >
              Add Evidence
            </button>
          )}
          {onCaptureContext && (
            <button
              type="button"
              onClick={onCaptureContext}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:border-cyan-200 hover:text-cyan-900"
            >
              Capture Context
            </button>
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-zinc-500">
        Based on the project context currently available, here is what I know, what I don&apos;t, and what would help next.
      </p>

      {recentMemory && (recentMemory.newEpisodeCount > 0 || recentMemory.latestEpisodeTitle) && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">What Changed Recently</p>
          <div className="mt-1.5 space-y-1 text-xs text-zinc-600">
            {recentMemory.newEpisodeCount > 0 && (
              <p>
                {recentMemory.newEpisodeCount} new episode{recentMemory.newEpisodeCount === 1 ? "" : "s"} {recentMemory.newEpisodeCount === 1 ? "was" : "were"} added to Project Memory.
              </p>
            )}
            {recentMemory.latestEpisodeTitle && (
              <p>
                Latest memory: {recentMemory.latestEpisodeTitle}
                {recentMemory.latestEpisodeAt ? ` (${new Date(recentMemory.latestEpisodeAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })})` : ""}.
              </p>
            )}
            {recentMemory.openQuestionCount > 0 && (
              <p>
                {recentMemory.openQuestionCount} open question{recentMemory.openQuestionCount === 1 ? "" : "s"} recorded.
              </p>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-zinc-400">What I Know</p>
        {knownStatements.length === 0 ? (
          <p className="text-xs text-zinc-400">No authoritative source is available yet.</p>
        ) : (
          <div className="space-y-2.5">
            {knownStatements.map((statement) => (
              <ProjectBrainStatementCard key={statement.id} statement={statement} />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-zinc-400">What I Do Not Know</p>
        {unresolvedStatements.length === 0 ? (
          <p className="text-xs text-zinc-400">No open questions identified yet.</p>
        ) : (
          <div className="space-y-2.5">
            {unresolvedStatements.map((statement) => (
              <ProjectBrainStatementCard key={statement.id} statement={statement} />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-zinc-400">What I Need Next</p>
        {response.knowledgeGaps.length === 0 ? (
          <p className="text-xs text-zinc-400">Add evidence to improve project understanding.</p>
        ) : (
          <div className="space-y-2.5">
            {response.knowledgeGaps.map((gap) => (
              <KnowledgeGapRequestCard key={gap.id} gap={gap} onAddEvidence={onAddEvidence} />
            ))}
          </div>
        )}
        {recommendations.length > 0 && (
          <div className="mt-2.5 space-y-2.5">
            {recommendations.map((statement) => (
              <ProjectBrainStatementCard key={statement.id} statement={statement} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
