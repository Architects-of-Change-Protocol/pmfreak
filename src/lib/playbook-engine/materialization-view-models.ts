/**
 * Materialization layer (Phase 2) — pure view models.
 *
 * Every function here is pure: no DB client, no Supabase import, no side effects. They only
 * reshape persisted `playbook_*` rows (produced by `materialization-service.ts`/
 * `materialization-query-service.ts`) into UI-ready shapes. No UI consumes these yet — Phase 2
 * only builds the service layer a future UI will call.
 */

import type {
  PlaybookAuditEventRelatedEntityType,
  PlaybookAuditEventRow,
  PlaybookRecommendationRow,
  PlaybookRecommendationRowStatus,
  PlaybookSnapshotRow,
} from "./materialization-types";

export type PlaybookSnapshotListItemView = {
  id: string;
  fingerprint: string;
  playbookId: string;
  playbookVersion: string;
  status: PlaybookSnapshotRow["status"];
  generatedAt: string;
  sourceContextHash: string | null;
  approvalRequiredCount: number;
  missingEvidenceCount: number;
  contentStale: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlaybookSnapshotDetailView = PlaybookSnapshotListItemView & {
  rulesSummary: Record<string, unknown>;
  missingEvidenceSummary: unknown[];
  approvalRequiredSummary: Record<string, unknown>;
  nextBestActions: unknown[];
  demoSummary: Record<string, unknown>;
  recommendations: PlaybookRecommendationView[];
  auditEvents: PlaybookAuditEventView[];
};

export type PlaybookRecommendationView = {
  id: string;
  workspaceId: string;
  projectId: string;
  snapshotId: string | null;
  fingerprint: string;
  playbookRuleId: string;
  title: string;
  status: PlaybookRecommendationRowStatus;
  severity: "low" | "medium" | "high" | "critical";
  phase: string | null;
  detectedSituation: string | null;
  recommendedAction: string | null;
  approvalRequired: boolean;
  evidenceUsed: unknown[];
  missingEvidence: unknown[];
  suggestedActions: unknown[];
  explanation: Record<string, unknown>;
  contentStale: boolean;
  viewedAt: string | null;
  acceptedAt: string | null;
  dismissedAt: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlaybookAuditEventView = {
  id: string;
  workspaceId: string;
  projectId: string;
  snapshotId: string | null;
  relatedEntityType: PlaybookAuditEventRelatedEntityType;
  relatedEntityId: string;
  fingerprint: string;
  eventType: string;
  actorType: "system" | "ai" | "user";
  actorId: string | null;
  severity: "info" | "low" | "medium" | "high" | "critical";
  summary: string;
  evidenceUsed: unknown[];
  missingEvidence: unknown[];
  approvalRequired: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/** One entry per `PlaybookRecommendationRowStatus`, always present (zero-filled) so a UI can
 * render every status bucket without checking for `undefined`. */
export type PlaybookRecommendationStatusCounts = Record<PlaybookRecommendationRowStatus, number>;

/** One entry per severity, always present (zero-filled). */
export type PlaybookRecommendationSeverityCounts = Record<"low" | "medium" | "high" | "critical", number>;

export type PlaybookProjectBrainView = {
  workspaceId: string;
  projectId: string;
  latestSnapshot: PlaybookSnapshotListItemView | null;
  recommendationCountsByStatus: PlaybookRecommendationStatusCounts;
  recommendationCountsBySeverity: PlaybookRecommendationSeverityCounts;
  approvalRequiredCount: number;
  staleRecommendationCount: number;
  latestAuditEvents: PlaybookAuditEventView[];
  /** Deduplicated union of every `missingEvidence` entry across all recommendations passed in. */
  missingEvidenceSummary: string[];
  nextBestActions: unknown[];
  /** Governed, hardcoded disclaimers about what this phase of materialization does not do yet —
   * never derived from data, so they can't drift silently as the read layer evolves. */
  readOnlyWarnings: string[];
};

function approvalRequiredCountFromSummary(summary: Record<string, unknown>): number {
  const count = (summary as { count?: unknown }).count;
  return typeof count === "number" ? count : 0;
}

export function toPlaybookSnapshotListItemView(row: PlaybookSnapshotRow): PlaybookSnapshotListItemView {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    playbookId: row.playbook_id,
    playbookVersion: row.playbook_version,
    status: row.status,
    generatedAt: row.generated_at,
    sourceContextHash: row.source_context_hash,
    approvalRequiredCount: approvalRequiredCountFromSummary(row.approval_required_summary),
    missingEvidenceCount: Array.isArray(row.missing_evidence_summary) ? row.missing_evidence_summary.length : 0,
    contentStale: row.content_stale,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPlaybookRecommendationView(row: PlaybookRecommendationRow): PlaybookRecommendationView {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    snapshotId: row.snapshot_id,
    fingerprint: row.fingerprint,
    playbookRuleId: row.playbook_rule_id,
    title: row.title,
    status: row.status,
    severity: row.severity,
    phase: row.phase,
    detectedSituation: row.detected_situation,
    recommendedAction: row.recommended_action,
    approvalRequired: row.approval_required,
    evidenceUsed: row.evidence_used,
    missingEvidence: row.missing_evidence,
    suggestedActions: row.suggested_actions,
    explanation: row.explanation,
    contentStale: row.content_stale,
    viewedAt: row.viewed_at,
    acceptedAt: row.accepted_at,
    dismissedAt: row.dismissed_at,
    approvedAt: row.approved_at,
    executedAt: row.executed_at,
    reviewedBy: row.reviewed_by,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPlaybookAuditEventView(row: PlaybookAuditEventRow): PlaybookAuditEventView {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    snapshotId: row.snapshot_id,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    fingerprint: row.fingerprint,
    eventType: row.event_type,
    actorType: row.actor_type,
    actorId: row.actor_id,
    severity: row.severity,
    summary: row.summary,
    evidenceUsed: row.evidence_used,
    missingEvidence: row.missing_evidence,
    approvalRequired: row.approval_required,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function toPlaybookSnapshotDetailView(
  row: PlaybookSnapshotRow,
  recommendations: PlaybookRecommendationView[],
  auditEvents: PlaybookAuditEventView[],
): PlaybookSnapshotDetailView {
  return {
    ...toPlaybookSnapshotListItemView(row),
    rulesSummary: row.rules_summary,
    missingEvidenceSummary: row.missing_evidence_summary,
    approvalRequiredSummary: row.approval_required_summary,
    nextBestActions: row.next_best_actions,
    demoSummary: row.demo_summary,
    recommendations,
    auditEvents,
  };
}

const RECOMMENDATION_STATUSES: readonly PlaybookRecommendationRowStatus[] = [
  "new",
  "viewed",
  "accepted",
  "dismissed",
  "converted_to_task",
  "converted_to_draft",
  "requires_approval",
  "approved",
  "executed",
];

const RECOMMENDATION_SEVERITIES = ["low", "medium", "high", "critical"] as const;

/** Governed, hardcoded — never derived from data, so these can't silently drift as the read layer
 * evolves. Mirrors the deferrals already stated in materialization-service.ts and the Phase 1/2
 * design docs. */
export const PLAYBOOK_READ_ONLY_WARNINGS: readonly string[] = [
  "Communication drafts are not persisted yet — they only exist inside snapshot_payload.",
  "Operational drafts are not persisted yet — they only exist inside snapshot_payload.",
  "Closure/billing assessments are not persisted yet — they only exist inside snapshot_payload.",
  "Platform events materialization is deferred — playbook_audit_events never writes to platform_events.",
  "No actions are executed automatically — every recommendation status change is a human-recorded decision, never a real execution.",
];

export type BuildPlaybookProjectBrainViewInput = {
  workspaceId: string;
  projectId: string;
  latestSnapshot: PlaybookSnapshotListItemView | null;
  /** `latestSnapshot.nextBestActions`, passed separately because `PlaybookSnapshotListItemView`
   * intentionally omits it (and every other heavier snapshot field) to keep list responses light
   * — see `toPlaybookSnapshotListItemView`. Defaults to `[]` when there is no latest snapshot. */
  nextBestActions?: unknown[];
  recommendations: PlaybookRecommendationView[];
  latestAuditEvents: PlaybookAuditEventView[];
};

/**
 * Pure aggregation over already-fetched view models — never touches a DB itself. The caller
 * (`materialization-query-service.ts`) is responsible for fetching `latestSnapshot`,
 * `recommendations` (all of them for the project, not just the latest snapshot's — a preserved,
 * human-touched recommendation keeps the `snapshot_id` of whichever snapshot last regenerated its
 * content while `status` was still `'new'`, so scoping to only the latest snapshot would silently
 * drop recommendations a human is still actively working) and `latestAuditEvents`.
 */
export function buildPlaybookProjectBrainView(input: BuildPlaybookProjectBrainViewInput): PlaybookProjectBrainView {
  const recommendationCountsByStatus = Object.fromEntries(
    RECOMMENDATION_STATUSES.map((status) => [status, 0]),
  ) as PlaybookRecommendationStatusCounts;
  const recommendationCountsBySeverity = Object.fromEntries(
    RECOMMENDATION_SEVERITIES.map((severity) => [severity, 0]),
  ) as PlaybookRecommendationSeverityCounts;

  let approvalRequiredCount = 0;
  let staleRecommendationCount = 0;
  const missingEvidenceSet = new Set<string>();

  for (const recommendation of input.recommendations) {
    recommendationCountsByStatus[recommendation.status] += 1;
    recommendationCountsBySeverity[recommendation.severity] += 1;
    if (recommendation.approvalRequired) approvalRequiredCount += 1;
    if (recommendation.contentStale) staleRecommendationCount += 1;
    for (const entry of recommendation.missingEvidence) {
      missingEvidenceSet.add(String(entry));
    }
  }

  return {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    latestSnapshot: input.latestSnapshot,
    recommendationCountsByStatus,
    recommendationCountsBySeverity,
    approvalRequiredCount,
    staleRecommendationCount,
    latestAuditEvents: input.latestAuditEvents,
    missingEvidenceSummary: Array.from(missingEvidenceSet),
    nextBestActions: input.nextBestActions ?? [],
    readOnlyWarnings: [...PLAYBOOK_READ_ONLY_WARNINGS],
  };
}
