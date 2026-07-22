"use client";

// Renders one ProjectBrainStatement in the voice and disclosure shape the
// constitution defines (src/lib/project-brain/constitution.ts): the epistemic
// type is always visible before the text, sources are named and linked (never
// "based on project data"), and confidence is always shown next to what it's
// confidence in — never a bare number. Follows the card conventions
// established by EvidenceTimelineCard (rounded-2xl, soft shadow, cyan/amber/
// emerald/rose accent language) so a Project Brain message reads as the same
// product surface as the Intelligence Inbox it will eventually appear inside.

import {
  descriptionForEpistemicType,
  formatConfidenceCaption,
  labelForEpistemicType,
} from "@/lib/project-brain/language";
import type { EpistemicType, ProjectBrainStatement } from "@/lib/project-brain/types";

const EPISTEMIC_BADGE_CLASSES: Record<EpistemicType, string> = {
  FACT: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REPORTED: "border-sky-200 bg-sky-50 text-sky-700",
  INFERENCE: "border-indigo-200 bg-indigo-50 text-indigo-700",
  ASSUMPTION: "border-amber-200 bg-amber-50 text-amber-700",
  OPEN_QUESTION: "border-purple-200 bg-purple-50 text-purple-700",
  CONTRADICTION: "border-rose-200 bg-rose-50 text-rose-700",
  RECOMMENDATION: "border-cyan-200 bg-cyan-50 text-cyan-700",
  UNKNOWN: "border-slate-200 bg-slate-50 text-slate-600",
};

// Uncertain/unresolved types are voiced like KnowledgeGapsPanel's admitted
// gaps (italic, muted) rather than as confident assertions.
const ADMITTED_UNCERTAINTY_TYPES = new Set<EpistemicType>(["OPEN_QUESTION", "UNKNOWN"]);

export function ProjectBrainStatementCard({ statement }: { statement: ProjectBrainStatement }) {
  const badgeClass = EPISTEMIC_BADGE_CLASSES[statement.epistemicType];
  const isAdmittedUncertainty = ADMITTED_UNCERTAINTY_TYPES.has(statement.epistemicType);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <span
          title={descriptionForEpistemicType(statement.epistemicType)}
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${badgeClass}`}
        >
          {labelForEpistemicType(statement.epistemicType)}
        </span>
        <span className="shrink-0 text-[11px] text-zinc-400">{formatConfidenceCaption(statement.confidence)}</span>
      </div>

      <p className={`mt-3 text-sm leading-relaxed ${isAdmittedUncertainty ? "italic text-zinc-500" : "text-slate-800"}`}>
        {statement.text}
      </p>

      {statement.epistemicType === "REPORTED" && statement.reportedBy ? (
        <p className="mt-1.5 text-[11px] text-zinc-400">Reported by {statement.reportedBy}</p>
      ) : null}

      {statement.epistemicType === "INFERENCE" && statement.inferenceBasis ? (
        <p className="mt-1.5 text-[11px] text-zinc-400">Reasoning: {statement.inferenceBasis}</p>
      ) : null}

      {statement.epistemicType === "CONTRADICTION" && statement.contradictingClaims?.length ? (
        <ul className="mt-2 space-y-1 border-l-2 border-rose-100 pl-3">
          {statement.contradictingClaims.map((claim) => (
            <li key={claim.sourceEvidenceId} className="text-[11px] text-rose-700">
              {claim.claim}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">Evidence</p>
        {statement.sources.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-400">No sources yet.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {statement.sources.map((source) => {
              const label = `${source.title} · ${source.evidenceType}${source.isPrimary ? "" : " (secondary)"}`;
              return (
                <li key={source.evidenceId} className="text-xs text-cyan-700">
                  {source.href ? (
                    <a href={source.href} className="hover:underline">
                      {label}
                    </a>
                  ) : (
                    <span>{label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {statement.epistemicType === "RECOMMENDATION" ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-400/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-cyan-800">
          Human approval required
        </p>
      ) : null}
    </div>
  );
}
