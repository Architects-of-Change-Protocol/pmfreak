"use client";

import { AgentStatus, ZoneFrame } from "@/platform/components";
import { useAgentRegistry } from "../contracts/agents.contract";

function relativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(deltaMs / (1000 * 60 * 60));
  if (hours < 1) return "less than an hour ago";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} day(s) ago`;
}

/** Agent Center — By-Agent view (03-screen-catalog.md §12), project-scoped for this slice. */
export function AgentRegistry({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const { agents, error, isLoading } = useAgentRegistry(workspaceId);

  return (
    <ZoneFrame title="Agents" isLoading={isLoading} error={error} isEmpty={agents.length === 0} emptyMessage="No Agent activity yet for this scope.">
      <div className="grid gap-4 sm:grid-cols-2">
        {agents.map((agent) => (
          <AgentStatus
            key={agent.agentType}
            name={agent.name}
            status={agent.status}
            capabilities={agent.capabilities}
            lastRun={agent.lastRun ? { relativeTime: relativeTime(agent.lastRun.createdAt), href: `/w/${workspaceId}/p/${projectId}/agents/runs/${agent.lastRun.runId}` } : null}
          />
        ))}
      </div>
    </ZoneFrame>
  );
}
