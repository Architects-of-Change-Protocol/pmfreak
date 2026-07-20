import type { Severity } from "./types";

const SEVERITY_CONFIG: Record<Severity, { icon: string; label: string; color: string; bg: string }> = {
  critical: { icon: "\u{1F534}", label: "Critical", color: "var(--pmf-severity-critical)", bg: "var(--pmf-severity-critical-bg)" },
  warning: { icon: "\u{1F7E1}", label: "At Risk", color: "var(--pmf-severity-warning)", bg: "var(--pmf-severity-warning-bg)" },
  ok: { icon: "\u{1F7E2}", label: "On Track", color: "var(--pmf-severity-ok)", bg: "var(--pmf-severity-ok-bg)" },
  neutral: { icon: "⚪", label: "Unknown", color: "var(--pmf-severity-neutral)", bg: "var(--pmf-severity-neutral-bg)" },
};

/**
 * Renders a Risk/Issue's severity with a redundant, non-color signal
 * (icon + text label) — 08-command-center-experience.md §1,
 * 08-accessibility-guidelines.md §4. One meaning, reused everywhere
 * (08-design-system.md §5 rule 1) — never a per-screen "severity chip".
 */
export function RiskBadge({ severity, label }: { severity: Severity; label?: string }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ color: config.color, backgroundColor: config.bg, borderColor: config.color }}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{label ?? config.label}</span>
    </span>
  );
}
