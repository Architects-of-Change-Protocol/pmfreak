"use client";

import Link from "next/link";
import { useState } from "react";
import { RoadmapSourceEditor } from "./RoadmapSourceEditor";
import { ParseResultPanel } from "./ParseResultPanel";
import { MaterializationPanel } from "./MaterializationPanel";
import type { ProgramRoadmapSourceRow, ProgramRoadmapParseResultRow, MaterializeResponse } from "@/lib/program-builder-client";
import type { ProgramRoadmapParseResult } from "@/lib/program-roadmap-parser/types";

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { step: 1 as Step, label: "Roadmap Source" },
  { step: 2 as Step, label: "Parse" },
  { step: 3 as Step, label: "Materialize" },
  { step: 4 as Step, label: "Open Board" },
];

type Props = { programId: string };

export function ProgramBuilderView({ programId }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [source, setSource] = useState<ProgramRoadmapSourceRow | null>(null);
  const [parseRow, setParseRow] = useState<ProgramRoadmapParseResultRow | null>(null);
  const [materialized, setMaterialized] = useState<MaterializeResponse | null>(null);

  const handleSourceSaved = (src: ProgramRoadmapSourceRow) => {
    setSource(src);
    setCurrentStep(2);
  };

  const handleParsed = (row: ProgramRoadmapParseResultRow, _parsed: ProgramRoadmapParseResult) => {
    setParseRow(row);
    if (row.status !== "INVALID") setCurrentStep(3);
  };

  const handleMaterialized = (response: MaterializeResponse) => {
    setMaterialized(response);
    setCurrentStep(4);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Program Builder</p>
        <p className="mt-1 text-sm text-zinc-300">Turn a structured roadmap into an executable board.</p>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map(({ step, label }, idx) => {
          const isCompleted = currentStep > step;
          const isActive = currentStep === step;
          return (
            <div key={step} className="flex items-center gap-2">
              <button
                onClick={() => { if (isCompleted || isActive) setCurrentStep(step); }}
                disabled={!isCompleted && !isActive}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-indigo-300/50 bg-indigo-400/15 text-indigo-100"
                    : isCompleted
                    ? "border-emerald-300/30 bg-emerald-400/[0.06] text-emerald-300"
                    : "border-white/10 bg-white/[0.01] text-zinc-600 cursor-not-allowed"
                }`}
              >
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                  isCompleted ? "bg-emerald-400/20 text-emerald-300" : isActive ? "bg-indigo-400/20 text-indigo-200" : "bg-white/5 text-zinc-600"
                }`}>{isCompleted ? "✓" : step}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <span className="text-zinc-700">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 md:p-6">
        {currentStep === 1 && (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-100">Step 1 — Roadmap Source</h3>
            <RoadmapSourceEditor programId={programId} onSaved={handleSourceSaved} />
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-100">Step 2 — Parse Roadmap</h3>
            <ParseResultPanel programId={programId} source={source} onParsed={handleParsed} />
            {parseRow && parseRow.status !== "INVALID" && (
              <button
                onClick={() => setCurrentStep(3)}
                className="mt-4 rounded-lg border border-indigo-300/30 bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-400/20"
              >
                Continue to Materialize →
              </button>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h3 className="mb-4 text-sm font-semibold text-slate-100">Step 3 — Materialize Program</h3>
            <MaterializationPanel programId={programId} parseRow={parseRow} onMaterialized={handleMaterialized} />
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-100">Step 4 — Open Board</h3>
            {materialized && (
              <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-300">
                Program materialized: {materialized.epicsCreated} epics · {materialized.sprintsCreated} sprints · {materialized.cardsCreated} cards
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/programs/${programId}/board`}
                className="rounded-xl border border-cyan-300/40 bg-cyan-400/[0.1] px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/[0.18]"
              >
                Open Execution Board
              </Link>
              <Link
                href={`/programs/${programId}/board`}
                className="rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07]"
              >
                View generated backlog
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
