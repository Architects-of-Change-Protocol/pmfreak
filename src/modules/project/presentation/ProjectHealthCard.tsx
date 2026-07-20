import { HealthIndicator } from "@/platform/components";
import type { ProjectHealth } from "../contracts/project-health.contract";
import { RiskSummary } from "./RiskSummary";
import { TimelineVariance } from "./TimelineVariance";
import { AIInsightCard } from "./AIInsightCard";

/**
 * "Is this project healthy?" — Fase 4's answer, not a traditional dashboard.
 * Composes the Health Indicator with Risk, Timeline, and AI Insight
 * sections into one scannable card.
 */
export function ProjectHealthCard({ health }: { health: ProjectHealth }) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-slate-500/25 p-5">
      <HealthIndicator percentage={health.overallScore} band={health.band} label="Project health" />
      <TimelineVariance forecast={health.forecast} schedule={health.schedule} />
      <RiskSummary raid={health.raid} />
      <AIInsightCard health={health} />
    </div>
  );
}
