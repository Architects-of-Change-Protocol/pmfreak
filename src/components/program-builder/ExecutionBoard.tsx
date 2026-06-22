"use client";

import { useEffect, useState, useCallback } from "react";
import { getExecutionBoard, moveProgramCard } from "@/lib/program-builder-client";
import type { ProgramExecutionBoard, ProgramBoardColumn, ProgramBoardCard } from "@/lib/program-builder-client";
import { ExecutionBoardColumn } from "./ExecutionBoardColumn";
import { ProgramErrorState } from "./ProgramErrorState";

const COLUMNS: ProgramBoardColumn[] = ["BACKLOG", "READY", "IN_PROGRESS", "IN_REVIEW", "DONE"];

type Props = { programId: string };

export function ExecutionBoard({ programId }: Props) {
  const [board, setBoard] = useState<ProgramExecutionBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    const result = await getExecutionBoard(programId);
    if (!result.ok) { setError(result.error); return; }
    setBoard(result.data);
  }, [programId]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await getExecutionBoard(programId);
      if (!active) return;
      if (!result.ok) { setError(result.error); } else { setBoard(result.data); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [programId]);

  const handleMove = async (cardId: string, targetColumn: ProgramBoardColumn) => {
    setMovingCardId(cardId);
    setMoveError(null);
    const result = await moveProgramCard(programId, cardId, targetColumn);
    if (!result.ok) {
      setMoveError(result.error);
    } else {
      setToast(`Moved to ${targetColumn.replace(/_/g, " ").toLowerCase()}`);
      setTimeout(() => setToast(null), 2500);
      await loadBoard();
    }
    setMovingCardId(null);
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-3">
        {COLUMNS.map((col) => (
          <div key={col} className="min-w-[220px] flex-1 animate-pulse rounded-2xl border border-white/10 bg-white/[0.01] h-64" />
        ))}
      </div>
    );
  }

  if (error) return <ProgramErrorState message={error} />;
  if (!board) return null;

  const colCards: Record<ProgramBoardColumn, ProgramBoardCard[]> = {
    BACKLOG:     board.backlog,
    READY:       board.ready,
    IN_PROGRESS: board.inProgress,
    IN_REVIEW:   board.inReview,
    DONE:        board.done,
  };

  return (
    <div className="relative">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 shadow-lg">
          {toast}
        </div>
      )}

      {moveError && (
        <div className="mb-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-2.5 text-sm text-rose-300 flex justify-between">
          <span>{moveError}</span>
          <button onClick={() => setMoveError(null)} className="text-rose-400/60 hover:text-rose-300">✕</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-[11px] text-zinc-400">
        <p className="text-zinc-500">
          The board is a live execution projection of Program Cards. Moving a card updates its execution state.
        </p>
        <div className="ml-auto flex flex-wrap gap-x-4">
          <span>Total: <strong className="text-slate-200">{board.stats.totalCards}</strong></span>
          <span>Done: <strong className="text-emerald-300">{board.stats.doneCount}</strong></span>
          <span>{board.stats.completionPercentage}% complete</span>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {COLUMNS.map((col) => {
          const cards: ProgramBoardCard[] = colCards[col];
          return (
            <ExecutionBoardColumn
              key={col}
              column={col}
              cards={cards}
              onMove={handleMove}
              movingCardId={movingCardId}
            />
          );
        })}
      </div>
    </div>
  );
}
