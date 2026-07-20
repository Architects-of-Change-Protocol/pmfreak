"use client";

import useSWR from "swr";

export type RecommendationStatus = "proposed" | "accepted" | "rejected" | "deferred" | "converted_to_task";

export type RecommendationSummary = {
  id: string;
  workspace_id: string;
  project_id: string;
  raid_item_id: string | null;
  title: string;
  description: string;
  recommended_action_type: string;
  status: RecommendationStatus;
  confidence_score: number;
  impact_level: string;
  rationale: Record<string, unknown> | null;
  recommended_owner: string | null;
  recommended_due_window: string | null;
  evidence_summary: Record<string, unknown> | null;
  source_signal_id: string | null;
  fingerprint: string;
  created_at: string;
  updated_at: string;
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload as T;
}

/** ListRecommendations (06-query-catalog.md) — reuses the existing, already-wired /api/recommended-actions endpoint verbatim. */
export function useRecommendations(projectId: string | null, status?: RecommendationStatus) {
  const key = projectId ? `/api/recommended-actions?projectId=${encodeURIComponent(projectId)}${status ? `&status=${status}` : ""}` : null;
  const { data, error, isLoading, mutate } = useSWR<{ recommendedActions: RecommendationSummary[] }>(key, fetchJson);
  return { recommendations: data?.recommendedActions ?? [], error, isLoading, mutate };
}

/** ApproveRecommendation / RejectRecommendation (06-command-catalog.md) — governed, never optimistic (07-frontend-state-and-data-architecture.md §10). */
export async function decideRecommendation(input: {
  actionId: string;
  decision: "accepted" | "rejected" | "deferred";
  reason?: string;
}): Promise<{ ok: true; decisionId: string } | { ok: false; error: string }> {
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch("/api/recommended-actions/decision", {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) return { ok: false, error: payload.error ?? "Unable to record decision." };
  return { ok: true, decisionId: payload.decisionId };
}
