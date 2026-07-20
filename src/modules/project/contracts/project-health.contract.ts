"use client";

import useSWR from "swr";
import type { ProjectHealth } from "@/lib/projects/project-health";

export type { ProjectHealth };

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload as T;
}

/**
 * GetProjectHealth (06-query-catalog.md) — Eventual consistency
 * (04-canonical-application-architecture.md §24); composed from RAID +
 * schedule + critical-path, backs both the Attention Required and Execution
 * Health Command Center zones (08-command-center-experience.md §1) since
 * both draw from the same underlying computation.
 */
export function useProjectHealth(projectId: string | null) {
  const key = projectId ? `/api/projects/${projectId}/health` : null;
  const { data, error, isLoading, mutate } = useSWR<{ health: ProjectHealth }>(key, fetchJson, {
    refreshInterval: 60_000,
  });
  return { health: data?.health ?? null, error, isLoading, mutate };
}
