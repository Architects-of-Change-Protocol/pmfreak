import type { TrendMovement } from "@/lib/trend-analysis";

export function TrendGraph({ trends }: { trends: TrendMovement[] }) {
  return <div className="grid gap-2 md:grid-cols-2">{trends.map((t) => <article key={t.metric} className="rounded-lg border border-slate-700 bg-white p-3 text-sm text-slate-800"><p className="font-semibold">{t.metric}</p><p>{t.direction} · Δ {t.delta} · volatility {t.volatility}</p></article>)}</div>;
}
