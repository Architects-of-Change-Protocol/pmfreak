"use client";

import useSWR from "swr";

export type EvidenceStatus = "uploaded" | "processing" | "processed" | "failed";

export type EvidenceRecord = {
  id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  uploaded_at: string;
  status: EvidenceStatus;
};

export type EvidenceContent = {
  id: string;
  evidence_id: string;
  content_hash: string;
  word_count: number;
  processing_duration_ms: number;
};

async function fetchJson<T>(input: string): Promise<T> {
  const response = await fetch(input, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload as T;
}

/**
 * Evidence list — reuses the existing, already-wired
 * GET /api/project-evidence and /api/project-evidence-content endpoints
 * verbatim rather than adding a redundant new route.
 */
export function useProjectEvidence(projectId: string | null) {
  const evidenceKey = projectId ? `/api/project-evidence?projectId=${encodeURIComponent(projectId)}` : null;
  const contentKey = projectId ? `/api/project-evidence-content?projectId=${encodeURIComponent(projectId)}` : null;

  const evidenceResult = useSWR<{ evidence: EvidenceRecord[] }>(evidenceKey, fetchJson);
  const contentResult = useSWR<{ content: EvidenceContent[] }>(contentKey, fetchJson);

  const contentByEvidenceId = new Map((contentResult.data?.content ?? []).map((item) => [item.evidence_id, item]));
  const evidence = (evidenceResult.data?.evidence ?? []).map((item) => ({ ...item, extraction: contentByEvidenceId.get(item.id) ?? null }));

  return {
    evidence,
    error: evidenceResult.error ?? contentResult.error,
    isLoading: evidenceResult.isLoading || contentResult.isLoading,
  };
}
