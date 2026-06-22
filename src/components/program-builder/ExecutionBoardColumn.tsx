import type { ProgramBoardCard, ProgramBoardColumn } from "@/lib/program-builder-client";
import { ExecutionCard } from "./ExecutionCard";

const COLUMN_LABELS: Record<ProgramBoardColumn, string> = {
  BACKLOG:     "Backlog",
  READY:       "Ready",
  IN_PROGRESS: "In Progress",
  IN_REVIEW:   "In Review",
  DONE:        "Done",
};

const COLUMN_ACCENT: Record<ProgramBoardColumn, string> = {
  BACKLOG:     "border-zinc-400/20",
  READY:       "border-cyan-400/20",
  IN_PROGRESS: "border-indigo-400/20",
  IN_REVIEW:   "border-amber-400/20",
  DONE:        "border-emerald-400/20",
};

const COLUMN_HEADER: Record<ProgramBoardColumn, string> = {
  BACKLOG:     "text-zinc-400",
  READY:       "text-cyan-300",
  IN_PROGRESS: "text-indigo-300",
  IN_REVIEW:   "text-amber-300",
  DONE:        "text-emerald-300",
};

type Props = {
  column: ProgramBoardColumn;
  cards: ProgramBoardCard[];
  onMove: (cardId: string, targetColumn: ProgramBoardColumn) => Promise<void>;
  movingCardId: string | null;
};

export function ExecutionBoardColumn({ column, cards, onMove, movingCardId }: Props) {
  return (
    <div className={`flex min-w-[220px] flex-1 flex-col rounded-2xl border ${COLUMN_ACCENT[column]} bg-white/[0.01] p-3`}>
      <div className="mb-3 flex items-center justify-between">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${COLUMN_HEADER[column]}`}>
          {COLUMN_LABELS[column]}
        </p>
        <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] text-zinc-500">
          {cards.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {cards.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/[0.06] py-8">
            <p className="text-[10px] text-zinc-700">No cards</p>
          </div>
        ) : (
          cards.map((card) => (
            <ExecutionCard
              key={card.id}
              card={card}
              onMove={onMove}
              moving={movingCardId === card.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
