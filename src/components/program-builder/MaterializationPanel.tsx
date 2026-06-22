"use client";

import Link from "next/link";
import { useState } from "react";
import { materializeProgram } from "@/lib/program-builder-client";
import type { ProgramRoadmapParseResultRow, MaterializeResponse } from "@/lib/program-builder-client";

type Props = {
  programId: string;
  parseRow: ProgramRoadmapParseResultRow | null;
  onMaterialized: (response: MaterializeResponse) => void;
};

export function MaterializationPanel({ programId, parseRow, onMaterialized }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [result, setResult] = useState<MaterializeResponse | null>(null);

  const canMaterialize =
    parseRow?.status === "VALID" || parseRow?.status === "VALID_WITH_WARNINGS";

  const handleMaterialize = async () => {
    if (!parseRow) return;
    setLoading(true);
    setError(null);
    setAlreadyExists(false);
    const res = await materializeProgram(programId, parseRow.id);
    if (!res.ok) {
      if (res.status === 409) { setAlreadyExists(true); } else { setError(res.error); }
      setLoading(false);
      return;
    }
    setResult(res.data);
    onMaterialized(res.data);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-zinc-500">
        Materialization converts the parsed roadmap into real Epics, Sprints, and Cards.
      </p>

      <button
        onClick={() => void handleMaterialize()}
        disabled={!canMaterialize || loading}
        className="w-full rounded-xl border border-violet-300/40 bg-violet-400/[0.1] px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/[0.18] disabled:opacity-40"
      >
        {loading ? "Materializing…" : "Materialize Program"}
      </button>

      {!parseRow && (
        <p className="text-[11px] text-zinc-500">Parse the roadmap first to enable materialization.</p>
      )}

      {parseRow?.status === "INVALID" && (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-300">
          Cannot materialize: roadmap has parse errors. Fix errors and re-parse.
        </p>
      )}

      {alreadyExists && (
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <p className="text-sm text-amber-200">
            This parse result has already been materialized. Open the board to continue execution.
          </p>
          <Link
            href={`/programs/${programId}/board`}
            className="mt-2 inline-block rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
          >
            Open Board →
          </Link>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-4 space-y-3">
          <p className="font-semibold text-emerald-300">Materialization completed.</p>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Epics</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-100">{result.epicsCreated}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Sprints</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-100">{result.sprintsCreated}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Cards</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-100">{result.cardsCreated}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Skipped</p>
              <p className="mt-0.5 text-lg font-semibold text-slate-100">{result.skippedCards}</p>
            </div>
          </div>
          {result.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">Warnings</p>
              <ul className="mt-1 space-y-0.5">
                {result.warnings.map((w: string, i: number) => (
                  <li key={i} className="text-[11px] text-amber-200/80">{w}</li>
                ))}
              </ul>
            </div>
          )}
          <Link
            href={`/programs/${programId}/board`}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
          >
            Open Execution Board →
          </Link>
        </div>
      )}
    </div>
  );
}
