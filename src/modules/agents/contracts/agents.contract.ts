"use client";

import useSWR from "swr";
import type { AgentExecutionRequestRecord } from "@/lib/agents/agent-execution-types";

export type { AgentExecutionRequestRecord };

export type AgentRegistryEntry = {
  agentType: string;
  name: string;
  status: "active" | "disabled";
  capabilities: string[];
  lastRun: { runId: string; createdAt: string } | null;
};

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload as T;
}

/** Agent Registry (03-screen-catalog.md Agent Center, By-Agent view). */
export function useAgentRegistry(workspaceId: string | null) {
  const key = workspaceId ? `/api/agents?workspaceId=${encodeURIComponent(workspaceId)}` : null;
  const { data, error, isLoading } = useSWR<{ agents: AgentRegistryEntry[] }>(key, fetchJson);
  return { agents: data?.agents ?? [], error, isLoading };
}

/** ListAgentRuns (06-query-catalog.md). */
export function useAgentRuns(workspaceId: string | null, agentType?: string) {
  const key = workspaceId ? `/api/workspaces/${workspaceId}/agent-runs${agentType ? `?agent_id=${encodeURIComponent(agentType)}` : ""}` : null;
  const { data, error, isLoading } = useSWR<{ runs: AgentExecutionRequestRecord[] }>(key, fetchJson);
  return { runs: data?.runs ?? [], error, isLoading };
}

/** GetAgentRun (06-query-catalog.md). */
export function useAgentRun(workspaceId: string | null, runId: string | null) {
  const key = workspaceId && runId ? `/api/agent-runs/${runId}?workspaceId=${encodeURIComponent(workspaceId)}` : null;
  const { data, error, isLoading } = useSWR<{ run: AgentExecutionRequestRecord }>(key, fetchJson);
  return { run: data?.run ?? null, error, isLoading };
}
