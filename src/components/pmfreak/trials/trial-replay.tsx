import type { TrialEvaluation, TrialScenario } from "@/lib/trials/trial-model";

export function TrialReplay({ scenario, evaluation, trustState }: { scenario: TrialScenario; evaluation: TrialEvaluation; trustState: string }) {
  return <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><h4 className="font-semibold text-slate-900">{scenario.title}</h4><p className="text-slate-700">Scenario: {scenario.prompt}</p><p className="text-slate-800">PM response: {evaluation.pmResponse}</p><p className="text-slate-800">PMFreak response: {evaluation.pmfreakResponse}</p><p className="text-slate-700">Trust state: {trustState}</p><p className="text-slate-600">Notes: {evaluation.notes ?? "-"}</p></article>;
}
