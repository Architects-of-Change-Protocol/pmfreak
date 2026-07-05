/**
 * Materialization layer (Phase 1) — pure mappers.
 *
 * Every function here is pure: no DB client, no Supabase import, no side
 * effects. They only reshape in-memory Playbook Engine artifacts
 * (`PlaybookGovernanceSnapshot`, `PlaybookRecommendation`, `PlaybookAuditEvent`)
 * into the row shapes `materialization-service.ts` writes to Postgres, and
 * decide (also purely) when an existing row's human-set status must be
 * preserved instead of overwritten.
 */

import type { PlaybookGovernanceSnapshot } from "./governance-snapshot-types";
import type { PlaybookRecommendation } from "./recommendation-engine";
import type { PlaybookAuditEvent } from "./playbook-audit-types";
import type {
  PlaybookAuditEventInsert,
  PlaybookRecommendationInsert,
  PlaybookRecommendationRowStatus,
  PlaybookSnapshotInsert,
} from "./materialization-types";

/** Every `PlaybookRecommendationRowStatus` a human (or a governed transition
 * triggered on their behalf) has moved the row into — i.e. every status
 * except the initial, freely-regenerable `"new"`. Mirrors
 * `IMMUTABLE_STATUSES` in `src/lib/task-drafts/materialize-task-draft.ts`,
 * generalized to the full 9-state `PlaybookRecommendationStatus` graph. */
export const RECOMMENDATION_HUMAN_STATUSES: readonly PlaybookRecommendationRowStatus[] = [
  "viewed",
  "accepted",
  "dismissed",
  "converted_to_task",
  "converted_to_draft",
  "requires_approval",
  "approved",
  "executed",
];

/**
 * True when an existing `playbook_recommendations` row has already left its
 * initial `"new"` status. The materialization layer must never overwrite
 * `status`, the human-decision timestamps, or content-bearing columns for
 * such a row — at most it may flag `content_stale`.
 *
 * Pure: takes only the fields it needs, never touches a DB.
 */
export function shouldPreserveHumanState(existingRow: { status: string } | null | undefined): boolean {
  if (!existingRow) return false;
  return (RECOMMENDATION_HUMAN_STATUSES as readonly string[]).includes(existingRow.status);
}

/** Stable subset of a `PlaybookRecommendation`'s content-bearing fields,
 * excluding volatile bookkeeping (`id`, `fingerprint`, `status`, `createdAt`,
 * `updatedAt`) that changes on every regeneration even when nothing a human
 * would call "the content" actually changed. Used to detect whether a
 * preserved (human-owned) recommendation row's stored content has drifted
 * from what the engine would generate today. */
export function recommendationContentSignature(recommendation: PlaybookRecommendation): string {
  return JSON.stringify({
    title: recommendation.title,
    detectedSituation: recommendation.detectedSituation,
    phase: recommendation.phase,
    severity: recommendation.severity,
    confidence: recommendation.confidence,
    evidenceUsed: recommendation.evidenceUsed,
    missingEvidence: recommendation.missingEvidence,
    recommendedAction: recommendation.recommendedAction,
    suggestedActions: recommendation.suggestedActions,
    approvalRequired: recommendation.approvalRequired,
    hasApprovalSensitiveActions: recommendation.hasApprovalSensitiveActions,
    explanation: recommendation.explanation,
  });
}

/**
 * Maps a `PlaybookGovernanceSnapshot` to the row `playbook_snapshots.insert()`
 * needs. Always represents a brand-new snapshot version — the service layer
 * decides whether to actually insert it (a snapshot is immutable once
 * persisted; an unchanged fingerprint is a pure no-op, never a partial
 * update).
 */
export function governanceSnapshotToSnapshotRow(
  snapshot: PlaybookGovernanceSnapshot,
  options: { sourceContextHash?: string | null } = {},
): PlaybookSnapshotInsert {
  return {
    workspace_id: snapshot.workspaceId,
    project_id: snapshot.projectId,
    fingerprint: snapshot.fingerprint,
    playbook_id: snapshot.playbookId,
    playbook_version: String(snapshot.playbookVersion),
    status: "generated",
    generated_at: snapshot.createdAt,
    source_context_hash: options.sourceContextHash ?? null,
    rules_summary: snapshot.rulesEvaluationSummary,
    missing_evidence_summary: snapshot.missingEvidenceSummary,
    approval_required_summary: {
      count: snapshot.approvalRequiredSummary.length,
      items: snapshot.approvalRequiredSummary,
    },
    next_best_actions: snapshot.nextBestActions,
    demo_summary: { narrative: snapshot.demoSummary },
    snapshot_payload: buildSnapshotPayload(snapshot),
    content_stale: false,
  };
}

/**
 * Everything from the snapshot that does not yet have its own table in
 * Phase 1 (communication drafts, operational drafts, closure/billing
 * assessment, the constitution draft) — kept here, in the snapshot's own
 * JSONB payload, so it is not lost, without inventing tables/persistence for
 * domains this phase explicitly defers.
 */
function buildSnapshotPayload(snapshot: PlaybookGovernanceSnapshot): Record<string, unknown> {
  return {
    constitutionDraft: snapshot.constitutionDraft,
    communicationDrafts: snapshot.communicationDrafts,
    operationalDrafts: snapshot.operationalDrafts,
    closureBillingAssessment: snapshot.closureBillingAssessment,
    createdAt: snapshot.createdAt,
  };
}

/**
 * Maps a `PlaybookRecommendation` to the row `playbook_recommendations`
 * needs for a brand-new row (`status: "new"` — the only status a freshly
 * generated recommendation may ever start at). Never call this to build an
 * update for a row whose human status must be preserved; the service layer
 * branches on `shouldPreserveHumanState` before ever reaching here for an
 * update.
 */
export function recommendationToRecommendationRow(
  recommendation: PlaybookRecommendation,
  snapshotId: string | null,
): PlaybookRecommendationInsert {
  return {
    workspace_id: recommendation.workspaceId,
    project_id: recommendation.projectId,
    snapshot_id: snapshotId,
    fingerprint: recommendation.fingerprint,
    playbook_rule_id: recommendation.playbookRuleId,
    title: recommendation.title,
    status: "new",
    severity: recommendation.severity,
    phase: recommendation.phase,
    detected_situation: recommendation.detectedSituation,
    recommended_action: recommendation.recommendedAction,
    approval_required: recommendation.approvalRequired,
    evidence_used: recommendation.evidenceUsed,
    missing_evidence: recommendation.missingEvidence,
    suggested_actions: recommendation.suggestedActions,
    explanation: recommendation.explanation,
    recommendation_payload: recommendation,
    content_stale: false,
    viewed_at: null,
    accepted_at: null,
    dismissed_at: null,
    approved_at: null,
    executed_at: null,
    reviewed_by: null,
    approved_by: null,
  };
}

/**
 * Maps a `PlaybookAuditEvent` to the row `playbook_audit_events` needs.
 * Append-only: the service layer only ever inserts this, never updates it
 * (see the migration — there is no update/delete RLS policy for this table).
 */
export function auditEventToAuditEventRow(
  event: PlaybookAuditEvent,
  snapshotId: string | null,
): PlaybookAuditEventInsert {
  return {
    workspace_id: event.workspaceId,
    project_id: event.projectId,
    snapshot_id: snapshotId,
    related_entity_type: event.relatedEntityType,
    related_entity_id: event.relatedEntityId,
    fingerprint: event.fingerprint,
    event_type: event.eventType,
    actor_type: event.actorType,
    actor_id: event.actorId,
    severity: event.severity,
    summary: event.summary,
    evidence_used: event.evidenceUsed,
    missing_evidence: event.missingEvidence,
    approval_required: event.approvalRequired,
    metadata: event.metadata,
    audit_payload: event,
  };
}
