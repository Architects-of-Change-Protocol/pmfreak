"use client";

import { useState } from "react";
import { parseRoadmapSource } from "@/lib/program-builder-client";
import type { ProgramRoadmapSourceRow, ProgramRoadmapParseResultRow } from "@/lib/program-builder-client";
import type { ProgramRoadmapParseResult, ProgramRoadmapParseWarning, ProgramRoadmapParseError, ParsedProgramEpic, ParsedProgramSprint } from "@/lib/program-roadmap-parser/types";

type Props = {
  programId: string;
  source: ProgramRoadmapSourceRow | null;
  onParsed: (row: ProgramRoadmapParseResultRow, parsed: ProgramRoadmapParseResult) => void;
};

const STATUS_STYLE = {
  VALID:               { badge: "border-emerald-300/40 bg-emerald-300/10 text-emerald-200", label: "Valid" },
  VALID_WITH_WARNINGS: { badge: "border-amber-300/40 bg-amber-300/10 text-amber-200",   label: "Valid with Warnings" },
  INVALID:             { badge: "border-rose-300/40 bg-rose-300/10 text-rose-200",       label: "Invalid" },
} as const;

export function ParseResultPanel({ programId, source, onParsed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseRow, setParseRow] = useState<ProgramRoadmapParseResultRow | null>(null);
  const [parsed, setParsed] = useState<ProgramRoadmapParseResult | null>(null);

  const handleParse = async () => {
    if (!source) return;
    setLoading(true);
    setError(null);
    const result = await parseRoadmapSource(programId, source.id);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setParseRow(result.data.parseResult);
    setParsed(result.data.parsed);
    onParsed(result.data.parseResult, result.data.parsed);
    setLoading(false);
  };

  const canParse = !!source;
  const statusInfo = parseRow ? (STATUS_STYLE[parseRow.status as keyof typeof STATUS_STYLE] ?? STATUS_STYLE.INVALID) : null;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-zinc-500">
        Parsing reads the roadmap and validates epics, sprints, prompts, warnings, and errors without creating work yet.
      </p>

      <button
        onClick={() => void handleParse()}
        disabled={!canParse || loading}
        className="w-full rounded-xl border border-cyan-300/40 bg-cyan-400/[0.1] px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/[0.18] disabled:opacity-40"
      >
        {loading ? "Parsing…" : "Parse Roadmap"}
      </button>

      {!canParse && (
        <p className="text-[11px] text-zinc-500">Save a roadmap source first to enable parsing.</p>
      )}

      {error && (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {parseRow && parsed && statusInfo && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusInfo.badge}`}>
              {statusInfo.label}
            </span>
            <span className="text-[11px] text-zinc-400">Epics: <strong className="text-slate-200">{parseRow.epic_count}</strong></span>
            <span className="text-[11px] text-zinc-400">Sprints: <strong className="text-slate-200">{parseRow.sprint_count}</strong></span>
            <span className="text-[11px] text-zinc-400">Warnings: <strong className={parseRow.warning_count > 0 ? "text-amber-300" : "text-slate-200"}>{parseRow.warning_count}</strong></span>
            <span className="text-[11px] text-zinc-400">Errors: <strong className={parseRow.error_count > 0 ? "text-rose-300" : "text-slate-200"}>{parseRow.error_count}</strong></span>
            {parsed.stats && (
              <span className="text-[11px] text-zinc-400">
                Prompts: <strong className="text-slate-200">{parsed.epics.flatMap((e: ParsedProgramEpic) => e.sprints).filter((s: ParsedProgramSprint) => s.prompt).length}</strong>
              </span>
            )}
          </div>

          {parsed.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">Warnings</p>
              <ul className="mt-2 space-y-1">
                {parsed.warnings.map((w: ProgramRoadmapParseWarning, i: number) => (
                  <li key={i} className="text-[11px] text-amber-200/80">
                    {w.line != null && <span className="mr-2 text-zinc-500">L{w.line}</span>}
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.errors.length > 0 && (
            <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.04] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-300">Errors</p>
              <ul className="mt-2 space-y-1">
                {parsed.errors.map((e: ProgramRoadmapParseError, i: number) => (
                  <li key={i} className="text-[11px] text-rose-200/80">
                    {e.line != null && <span className="mr-2 text-zinc-500">L{e.line}</span>}
                    {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.epics.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Structure Preview</p>
              <ul className="space-y-2">
                {parsed.epics.map((epic: ParsedProgramEpic) => (
                  <li key={epic.number}>
                    <p className="text-[11px] font-semibold text-slate-200">
                      EPIC {epic.number} — {epic.title}
                    </p>
                    <ul className="mt-1 ml-4 space-y-0.5">
                      {epic.sprints.map((sprint: ParsedProgramSprint) => (
                        <li key={sprint.number} className="flex items-center gap-2 text-[11px] text-zinc-400">
                          <span>Sprint {sprint.number} — {sprint.title}</span>
                          {sprint.prompt && (
                            <span className="rounded-sm border border-indigo-300/30 bg-indigo-300/10 px-1.5 py-px text-[9px] text-indigo-300">
                              Prompt detected
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
