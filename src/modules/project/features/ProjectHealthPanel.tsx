"use client";

import { ZoneFrame } from "@/platform/components";
import { useProjectHealth } from "../contracts/project-health.contract";
import { ProjectHealthCard } from "../presentation/ProjectHealthCard";

export function ProjectHealthPanel({ projectId }: { projectId: string }) {
  const { health, error, isLoading, mutate } = useProjectHealth(projectId);

  return (
    <ZoneFrame title="Project Health" isLoading={isLoading} error={error} isEmpty={!health} emptyMessage="No health data available yet." onRetry={() => mutate()}>
      {health ? <ProjectHealthCard health={health} /> : null}
    </ZoneFrame>
  );
}
