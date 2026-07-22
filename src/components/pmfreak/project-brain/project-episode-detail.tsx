"use client";

// The full disclosure shape for one ProjectEpisode: what happened, what
// changed, the evidence behind it, any open questions it left, its
// relationship to earlier memory, and its integrity metadata. Never renders
// a raw database id — only the id-derived React key uses one, not visible
// text. Follows the same text-first, no-color-only-signal approach as
// project-brain-statement-card.tsx.

import { labelForEpisodeActor, labelForEpisodeType } from "@/lib/project-brain/episodic-memory/episode-language";
import type { ProjectEpisode } from "@/lib/project-brain/episodic-memory/types";
import { formatConfidenceCaption } from "@/lib/project-brain/language";

const STATUS_LABEL: Record<ProjectEpisode["status"], string> = {
  recorded: "Recorded",
  superseded: "Superseded",
  retracted: "Retracted",
  invalid: "Invalid",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ProjectEpisodeDetail({
  episode,
  relatedEpisodes = [],
}: {
  episode: ProjectEpisode;
  /** Resolved by the caller — this component never fetches or looks up episodes itself. */
  relatedEpisodes?: ProjectEpisode[];
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-400">
          {labelForEpisodeType(episode.type)} · <time dateTime={episode.occurredAt}>{formatTimestamp(episode.occurredAt)}</time> · {labelForEpisodeActor(episode.actor)} ·{" "}
          <span aria-label={`Episode status: ${STATUS_LABEL[episode.status]}`}>{STATUS_LABEL[episode.status]}</span>
        </p>
      </div>

      <div>
        <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">What happened</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-700">{episode.summary}</p>
      </div>

      {episode.knowledgeTransitions.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">What changed</p>
          <ul className="mt-1.5 space-y-2">
            {episode.knowledgeTransitions.map((t) => (
              <li key={t.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                <p className="text-xs font-medium text-slate-800">{t.subjectLabel}</p>
                <p className="mt-0.5 text-xs text-zinc-600" aria-label={`${t.subjectLabel} moved from ${t.fromState} to ${t.toState}`}>
                  {t.fromState} <span aria-hidden="true">→</span> {t.toState}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{t.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">Evidence</p>
        {episode.sourceReferences.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-400">No sources yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {episode.sourceReferences.map((source) => (
              <li key={source.evidenceId} className="text-xs text-cyan-700">
                {source.href ? (
                  <a href={source.href} className="hover:underline">
                    {source.title} · {source.evidenceType}
                    {source.isPrimary ? "" : " (secondary)"}
                  </a>
                ) : (
                  <span>
                    {source.title} · {source.evidenceType}
                    {source.isPrimary ? "" : " (secondary)"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {episode.openQuestions.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">Open questions</p>
          <ul className="mt-1.5 space-y-1">
            {episode.openQuestions.map((gap) => (
              <li key={gap.id} className="text-xs italic text-zinc-500">
                &ldquo;{gap.question}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {relatedEpisodes.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">Related memory</p>
          <ul className="mt-1.5 space-y-1">
            {relatedEpisodes.map((related) => (
              <li key={related.id} className="text-xs text-zinc-600">
                {labelForEpisodeType(related.type)} — {formatTimestamp(related.occurredAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {episode.statements.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">Confidence</p>
          <ul className="mt-1.5 space-y-1">
            {episode.statements.map((statement) => (
              <li key={statement.id} className="text-[11px] text-zinc-500">
                {formatConfidenceCaption(statement.confidence)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-slate-100 pt-2.5">
        <p className="text-[10px] text-zinc-400">Constitution version {episode.constitutionVersion}</p>
      </div>
    </div>
  );
}
