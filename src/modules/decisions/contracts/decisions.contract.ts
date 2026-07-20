"use client";

import useSWR from "swr";
import type { DecisionEvidenceRelationship, DecisionLineage, DecisionRecord, DecisionSummary, DecisionType } from "@/lib/decision-governance/types";

export type { DecisionRecord, DecisionSummary, DecisionLineage, DecisionType, DecisionEvidenceRelationship };

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload as T;
}

/** ListDecisions (06-query-catalog.md). */
export function useProjectDecisions(projectId: string | null) {
  const key = projectId ? `/api/projects/${projectId}/decisions` : null;
  const { data, error, isLoading, mutate } = useSWR<{ decisions: DecisionSummary[] }>(key, fetchJson);
  return { decisions: data?.decisions ?? [], error, isLoading, mutate };
}

/** GetDecisionDetails (06-query-catalog.md) — Decision + full lineage for the DecisionCard/EvidenceViewer. */
export function useDecision(decisionId: string | null) {
  const key = decisionId ? `/api/decisions/${decisionId}` : null;
  const { data, error, isLoading, mutate } = useSWR<{ decision: DecisionRecord; lineage: DecisionLineage }>(key, fetchJson);
  return { decision: data?.decision ?? null, lineage: data?.lineage ?? null, error, isLoading, mutate };
}

/** RecordDecision (06-command-catalog.md) — never rendered optimistically (irreversible/governance-relevant). */
export async function createDecision(
  projectId: string,
  input: {
    decisionType: DecisionType;
    title: string;
    summary: string;
    decisionRationale?: string | null;
    recommendationId?: string | null;
    evidenceLinks?: Array<{ evidenceId: string; evidenceType: string; relationshipType: DecisionEvidenceRelationship }>;
  },
): Promise<{ ok: true; decision: DecisionRecord } | { ok: false; error: string }> {
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch(`/api/projects/${projectId}/decisions`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
  const payload = await response.json();
  if (!response.ok) return { ok: false, error: payload.error ?? "Unable to record decision." };
  return { ok: true, decision: payload.decision as DecisionRecord };
}

async function transitionDecision(decisionId: string, action: "approve" | "reject", rationale?: string) {
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch(`/api/decisions/${decisionId}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ rationale }),
  });
  const payload = await response.json();
  if (!response.ok) return { ok: false as const, error: payload.error ?? `Unable to ${action} decision.` };
  return { ok: true as const, decision: payload.decision as DecisionRecord };
}

export const approveDecision = (decisionId: string, rationale?: string) => transitionDecision(decisionId, "approve", rationale);
export const rejectDecision = (decisionId: string, rationale?: string) => transitionDecision(decisionId, "reject", rationale);
