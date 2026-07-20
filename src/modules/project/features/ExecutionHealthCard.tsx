"use client";

import { HealthIndicator, ZoneFrame } from "@/platform/components";
import { useProjectHealth } from "../contracts/project-health.contract";

/** Execution Health zone (08-command-center-experience.md §1) — always last, never the largest zone. */
export function ExecutionHealthCard({ projectId }: { projectId: string }) {
  const { health, error, isLoading, mutate } = useProjectHealth(projectId);
  const onTrack = health ? Math.max(0, health.schedule.totalTasks - health.schedule.delayedTasks - health.schedule.atRiskTasks - health.schedule.overdueTasks) : 0;

  return (
    <ZoneFrame title="Execution Health" isLoading={isLoading} error={error} isEmpty={false} emptyMessage="" onRetry={() => mutate()}>
      {health ? (
        <div className="flex flex-col gap-3">
          <HealthIndicator percentage={health.overallScore} band={health.band} label="Project health" />
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-slate-400">On track</dt>
              <dd className="font-semibold text-slate-100">{onTrack}</dd>
            </div>
            <div>
              <dt className="text-slate-400">At risk</dt>
              <dd className="font-semibold text-slate-100">{health.schedule.atRiskTasks}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Delayed</dt>
              <dd className="font-semibold text-slate-100">{health.schedule.delayedTasks}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </ZoneFrame>
  );
}
