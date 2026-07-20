"use client";

import { RiskBadge, ZoneFrame } from "@/platform/components";
import type { Severity } from "@/platform/components/types";
import { useProjectHealth } from "../contracts/project-health.contract";

/**
 * Attention Required zone (08-command-center-experience.md §1) — open Risks
 * and blocking Dependencies, ranked severity then recency. Every item links
 * to its canonical home screen (ADR-PMF-070 Frontend Rule 3); this slice's
 * Execution Layer screens (Fase 9's out-of-scope RAID module) aren't built
 * yet, so items link to the Project Home page as the closest existing
 * canonical surface (documented gap, ADR-PMF-076).
 */
export function AttentionPanel({ projectId }: { projectId: string }) {
  const { health, error, isLoading, mutate } = useProjectHealth(projectId);
  const projectHref = `/projects/${projectId}`;

  const scheduleItems = (health?.schedule.signals ?? []).map((signal) => ({
    severity: (signal.severity === "critical" ? "critical" : signal.severity === "warning" ? "warning" : "neutral") as Severity,
    label: signal.message,
  }));

  const raidItems: Array<{ severity: Severity; label: string }> = [];
  if (health && health.raid.criticalRiskCount > 0) {
    raidItems.push({ severity: "critical", label: `${health.raid.criticalRiskCount} critical risk(s) require attention` });
  }
  if (health && health.raid.riskCount > 0) {
    raidItems.push({ severity: "warning", label: `${health.raid.riskCount} open risk(s)` });
  }
  if (health && health.raid.dependencyCount > 0) {
    raidItems.push({ severity: "warning", label: `${health.raid.dependencyCount} open dependency blocker(s)` });
  }

  const items = [...raidItems, ...scheduleItems];

  return (
    <ZoneFrame
      title="Attention Required"
      isLoading={isLoading}
      error={error}
      isEmpty={items.length === 0}
      emptyMessage="No open risks — this project is on track."
      onRetry={() => mutate()}
    >
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={index}>
            <a href={projectHref} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-500/10 focus-visible:bg-slate-500/10">
              <RiskBadge severity={item.severity} />
              <span className="text-sm text-slate-200">{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </ZoneFrame>
  );
}
