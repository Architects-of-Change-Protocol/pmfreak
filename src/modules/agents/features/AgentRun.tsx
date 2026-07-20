"use client";

import { ZoneFrame } from "@/platform/components";
import { useAgentRun } from "../contracts/agents.contract";
import { AgentRunTimeline } from "../presentation/AgentRunTimeline";

/** Agent Run detail (03-screen-catalog.md's Agent Center; 08-ai-interaction-patterns.md §4). */
export function AgentRun({ workspaceId, runId }: { workspaceId: string; runId: string }) {
  const { run, error, isLoading } = useAgentRun(workspaceId, runId);

  return (
    <ZoneFrame title="Agent Run" isLoading={isLoading} error={error} isEmpty={!run} emptyMessage="Agent run not found.">
      {run ? <AgentRunTimeline run={run} /> : null}
    </ZoneFrame>
  );
}
