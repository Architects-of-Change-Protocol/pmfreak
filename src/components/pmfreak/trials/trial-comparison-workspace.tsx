"use client";

import type { TrialEvaluation } from "@/lib/trials/trial-model";
import type { TrialExecutionResult } from "@/lib/trials/trial-executor";

type Props = {
  pmResponse: string;
  execution: TrialExecutionResult;
  evaluation: Partial<TrialEvaluation>;
  onScoreChange: (field: keyof TrialEvaluation, value: string | number) => void;
};

export function TrialComparisonWorkspace({ pmResponse, execution, evaluation, onScoreChange }: Props) {
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2"><article><h4 className="text-xs uppercase text-slate-600">Your PM reasoning</h4><p className="text-sm text-slate-900">{pmResponse}</p></article><article><h4 className="text-xs uppercase text-slate-600">PMFreak reasoning</h4><p className="text-sm text-slate-900">{execution.pmfreakResponse}</p></article></div><div className="text-xs text-slate-700">Confidence: {execution.runtimeConfidence} · Concepts: {execution.normalizedConcepts.join(", ") || "none"} · Contradiction: {execution.contradiction} · Imprint: {execution.imprintContext}</div><div className="grid gap-2 md:grid-cols-5">{(["usefulnessScore", "prioritizationScore", "escalationJudgmentScore", "framingScore", "trustScore"] as const).map((field) => <label key={field} className="text-xs text-slate-800">{field}<input min={1} max={5} type="number" className="mt-1 w-full rounded border border-slate-200 bg-slate-50 p-1" value={(evaluation[field] as number | undefined) ?? ""} onChange={(e) => onScoreChange(field, Number(e.target.value))} /></label>)}</div></section>;
}
