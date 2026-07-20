import type { HealthBand } from "./types";

const BAND_CONFIG: Record<HealthBand, { label: string; color: string }> = {
  strong: { label: "On Track", color: "var(--pmf-health-band-strong)" },
  watch: { label: "Needs Attention", color: "var(--pmf-health-band-watch)" },
  "at-risk": { label: "At Risk", color: "var(--pmf-health-band-at-risk)" },
};

/**
 * Renders an entity's aggregate health as a percentage + qualitative band
 * text, always co-rendered — never color alone
 * (08-design-system.md §3, 08-accessibility-guidelines.md §4).
 * Wrapped in an ARIA live region so a severity change during an open view
 * (e.g. Command Center left open across a background refresh) is announced,
 * not only re-rendered visually (08-accessibility-guidelines.md §3).
 */
export function HealthIndicator({ percentage, band, label = "Health" }: { percentage: number; band: HealthBand; label?: string }) {
  const config = BAND_CONFIG[band];
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold" style={{ color: config.color }}>
          {clamped}%
        </span>
        <span className="text-sm font-medium" style={{ color: config.color }}>
          {config.label}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/40" aria-hidden="true">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${clamped}%`, backgroundColor: config.color }} />
      </div>
      <span className="sr-only">{`${label}: ${clamped}%, ${config.label}`}</span>
    </div>
  );
}
