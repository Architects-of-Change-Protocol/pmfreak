import type { TrialScenarioCategory } from "@/lib/trials/trial-model";
import type { TrialMetrics } from "@/lib/trials/evaluation-engine";

export function TrialDashboard({ metrics, strongestCategories, weakestCategories, englishAverage, spanishAverage, confidenceTrend }: { metrics: TrialMetrics; strongestCategories: TrialScenarioCategory[]; weakestCategories: TrialScenarioCategory[]; englishAverage: number; spanishAverage: number; confidenceTrend: string[]; }) {
  return <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800"><p>Total completed trials: {metrics.totalTrials}</p><p>Average PMFreak trust score: {metrics.averageTrust.toFixed(2)}</p><p>Strongest categories: {strongestCategories.join(", ") || "n/a"}</p><p>Weakest categories: {weakestCategories.join(", ") || "n/a"}</p><p>Confidence trend: {confidenceTrend.join(" → ") || "n/a"}</p><p>Language split: English {englishAverage.toFixed(1)} / Spanish {spanishAverage.toFixed(1)}</p></section>;
}
