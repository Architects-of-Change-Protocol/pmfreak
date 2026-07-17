type TrendDirection = "up" | "down" | "stable" | "warning";

const TREND_COLOR: Record<TrendDirection, string> = {
  up:      "text-emerald-600",
  down:    "text-red-600",
  stable:  "text-slate-500",
  warning: "text-amber-600",
};

export function ShellMetric({
  label,
  value,
  delta,
  trend,
  className = "",
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: TrendDirection;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-400">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-slate-800">{value}</span>
      {delta && trend && (
        <span className={`text-[10px] ${TREND_COLOR[trend]}`}>{delta}</span>
      )}
    </div>
  );
}
