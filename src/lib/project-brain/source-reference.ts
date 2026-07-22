// ─────────────────────────────────────────────────────────────────────────────
// Project Brain — Source Reference Adapters
// Sprint 0: Birth of the Project Brain
//
// Pure adapters from the two existing evidence pipelines into the reusable
// `ProjectBrainSourceReference` shape. No storage, no DB access, no
// duplication of `project_evidence` / `evidence_items` — these functions only
// reshape rows that a caller already fetched from those tables.
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectBrainSourceReference, SourceAuthorityLevel } from "./types";

// ─── Pipeline B: `evidence_items` (governed operational evidence) ─────────
// See supabase/migrations/20260611000000_operational_evidence_decision_loop.sql

export type EvidenceItemSourceType =
  | "manual_note"
  | "email"
  | "meeting_minutes"
  | "ticket"
  | "conversation"
  | "document_reference";

export type EvidenceItemSourceRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  source_type: EvidenceItemSourceType;
  title: string;
  content?: string | null;
  source_reference?: string | null;
  created_by?: string | null;
  created_at: string;
};

// Direct records of what was actually said/written are primary; human
// paraphrase/recollection of an event is secondary until independently
// verified. Matches NON_NEGOTIABLE_PRINCIPLES "evidence_before_assertion".
const EVIDENCE_ITEM_AUTHORITY: Record<EvidenceItemSourceType, SourceAuthorityLevel> = {
  document_reference: "primary",
  email: "primary",
  meeting_minutes: "primary",
  ticket: "secondary",
  conversation: "secondary",
  manual_note: "secondary",
};

export function sourceReferenceFromEvidenceItem(
  row: EvidenceItemSourceRow,
  opts?: { href?: string | null; excerptLength?: number },
): ProjectBrainSourceReference {
  const authorityLevel = EVIDENCE_ITEM_AUTHORITY[row.source_type];
  const excerptLength = opts?.excerptLength ?? 240;
  return {
    evidenceId: row.id,
    sourceSystem: "evidence_items",
    title: row.title,
    evidenceType: row.source_type,
    recordedAt: row.created_at,
    excerpt: row.content ? row.content.slice(0, excerptLength) : null,
    author: row.created_by ?? null,
    authorityLevel,
    isPrimary: authorityLevel === "primary",
    href: opts?.href ?? null,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
  };
}

// ─── Pipeline A: `project_evidence` (raw upload + extraction) ─────────────
// See supabase/migrations/20260605000000_project_evidence.sql

export type ProjectEvidenceSourceRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  file_name: string;
  file_type: string;
  uploaded_by?: string | null;
  uploaded_at: string;
  status: "uploaded" | "processing" | "processed" | "failed";
};

export function sourceReferenceFromProjectEvidence(
  row: ProjectEvidenceSourceRow,
  opts?: { href?: string | null; excerpt?: string | null },
): ProjectBrainSourceReference {
  // Uploaded original documents (contracts, emails, invoices, decks) are the
  // source of record — always primary, regardless of extraction status. If
  // extraction hasn't completed the caller simply omits `excerpt`.
  return {
    evidenceId: row.id,
    sourceSystem: "project_evidence",
    title: row.file_name,
    evidenceType: row.file_type,
    recordedAt: row.uploaded_at,
    excerpt: opts?.excerpt ?? null,
    author: row.uploaded_by ?? null,
    authorityLevel: "primary",
    isPrimary: true,
    href: opts?.href ?? null,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
  };
}
