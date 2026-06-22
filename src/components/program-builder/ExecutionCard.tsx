"use client";

import type { ProgramBoardCard, ProgramBoardColumn } from "@/lib/program-builder-client";

const VALID_TRANSITIONS: Record<ProgramBoardColumn, ProgramBoardColumn[]> = {
  BACKLOG:     ["READY"],
  READY:       ["BACKLOG", "IN_PROGRESS"],
  IN_PROGRESS: ["READY", "IN_REVIEW"],
  IN_REVIEW:   ["IN_PROGRESS", "DONE"],
  DONE:        ["IN_PROGRESS"],
};

const MOVE_LABELS: Record<string, string> = {
  READY:       "Move to Ready",
  BACKLOG:     "Move to Backlog",
  IN_PROGRESS: "Start",
  IN_REVIEW:   "Send to Review",
  DONE:        "Complete",
};

const DONE_REOPEN_LABEL = "Reopen";

const CARD_TYPE_BADGE: Record<string, string> = {
  EPIC:        "border-violet-300/30 bg-violet-300/10 text-violet-200",
  SPRINT:      "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
  TASK:        "border-slate-300/30 bg-slate-300/10 text-slate-300",
  PROMPT:      "border-indigo-300/30 bg-indigo-300/10 text-indigo-200",
  MILESTONE:   "border-amber-300/30 bg-amber-300/10 text-amber-200",
  DELIVERABLE: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  CUSTOM:      "border-zinc-300/30 bg-zinc-300/10 text-zinc-300",
};

type Props = {
  card: ProgramBoardCard;
  onMove: (cardId: string, targetColumn: ProgramBoardColumn) => Promise<void>;
  moving: boolean;
};

export function ExecutionCard({ card, onMove, moving }: Props) {
  const transitions = VALID_TRANSITIONS[card.board_column] ?? [];
  const typeBadge = CARD_TYPE_BADGE[card.type] ?? CARD_TYPE_BADGE.CUSTOM;
  const { context } = card;

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3 transition hover:border-white/20">
      <div className="flex flex-wrap items-start justify-between gap-1">
        <span className={`rounded-full border px-2 py-px text-[9px] font-semibold uppercase tracking-[0.14em] ${typeBadge}`}>
          {card.type}
        </span>
        {card.materialization_type && (
          <span className="text-[9px] uppercase tracking-[0.1em] text-zinc-600">
            {card.materialization_type.toLowerCase()}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] font-medium leading-4 text-slate-100">{card.title}</p>

      {card.prompt_body && (
        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-zinc-500">{card.prompt_body}</p>
      )}

      {(context.epic || context.sprint || context.source) ? (
        <div className="mt-1.5 space-y-0.5">
          {context.epic && (
            <p className="text-[9px] text-zinc-500">
              Epic {context.epic.number} — {context.epic.title}
            </p>
          )}
          {context.sprint && (
            <p className="text-[9px] text-zinc-500">
              Sprint {context.sprint.number} — {context.sprint.title}
            </p>
          )}
          {context.source && (
            <p className="text-[9px] text-zinc-600">
              Source: {context.source.title ?? context.source.sourceType} v{context.source.version}
            </p>
          )}
          {context.origin?.materializationSource && (
            <p className="text-[9px] text-zinc-700">
              Origin: {context.origin.materializationSource}
              {context.origin.sourceLineNumber != null && ` · Line ${context.origin.sourceLineNumber}`}
            </p>
          )}
        </div>
      ) : (
        !card.epic_id && !card.sprint_id && (
          <p className="mt-1.5 text-[9px] text-zinc-700">No source context available</p>
        )
      )}

      {transitions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {transitions.map((col) => {
            const label = col === "IN_PROGRESS" && card.board_column === "DONE"
              ? DONE_REOPEN_LABEL
              : (MOVE_LABELS[col] ?? col.replace(/_/g, " "));
            return (
              <button
                key={col}
                disabled={moving}
                onClick={() => void onMove(card.id, col)}
                className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-40"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
