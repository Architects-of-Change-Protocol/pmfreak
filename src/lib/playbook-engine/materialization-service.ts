/**
 * Materialization layer (Phase 1) — the only file in this directory allowed
 * to talk to a database (besides `materialization-types.ts`, which is types
 * only). Persists a `PlaybookGovernanceSnapshot` into `playbook_snapshots`,
 * `playbook_recommendations`, and `playbook_audit_events`, idempotently, by
 * fingerprint, while preserving any human decision already recorded on a
 * `playbook_recommendations` row.
 *
 * What this file never does, by design (Phase 1 scope):
 *  - write to `recommended_actions` or `task_drafts` — different domains,
 *    see docs/playbook-engine-materialization-design.md §6.
 *  - write to `platform_events` — deferred until the `event_payload`/
 *    `payload` schema divergence across existing migrations is resolved
 *    (design doc §8).
 *  - write to `raid_items`, `constitutional_decisions`, or any
 *    closure/billing/communication/operational draft table.
 *  - approve or execute anything — `approval_required` is only ever
 *    OR-merged (can turn true, never false) and a preserved row's status is
 *    never advanced automatically.
 */

import {
  auditEventToAuditEventRow,
  governanceSnapshotToSnapshotRow,
  recommendationContentSignature,
  recommendationToRecommendationRow,
  shouldPreserveHumanState,
} from "./materialization-mappers";
import type { PlaybookAuditEvent } from "./playbook-audit-types";
import type { PlaybookRecommendation } from "./recommendation-engine";
import type {
  MaterializationDbClient,
  MaterializationResult,
  MaterializePlaybookGovernanceSnapshotInput,
  MaterializePlaybookGovernanceSnapshotResult,
  PlaybookAuditEventMaterializationOutcome,
  PlaybookAuditEventRow,
  PlaybookRecommendationMaterializationOutcome,
  PlaybookRecommendationRow,
  PlaybookSnapshotMaterializationOutcome,
  PlaybookSnapshotRow,
} from "./materialization-types";
import type { PlaybookGovernanceSnapshot } from "./governance-snapshot-types";

const SNAPSHOT_COLUMNS =
  "id,workspace_id,project_id,fingerprint,playbook_id,playbook_version,status,generated_at,source_context_hash,rules_summary,missing_evidence_summary,approval_required_summary,next_best_actions,demo_summary,snapshot_payload,content_stale,created_at,updated_at";

const RECOMMENDATION_COLUMNS =
  "id,workspace_id,project_id,snapshot_id,fingerprint,playbook_rule_id,title,status,severity,phase,detected_situation,recommended_action,approval_required,evidence_used,missing_evidence,suggested_actions,explanation,recommendation_payload,content_stale,viewed_at,accepted_at,dismissed_at,approved_at,executed_at,reviewed_by,approved_by,created_at,updated_at";

const AUDIT_EVENT_COLUMNS =
  "id,workspace_id,project_id,snapshot_id,related_entity_type,related_entity_id,fingerprint,event_type,actor_type,actor_id,severity,summary,evidence_used,missing_evidence,approval_required,metadata,audit_payload,created_at";

function persistenceFailure<T>(error: string): MaterializationResult<T> {
  return { ok: false, error, failureClass: "persistence_failed" };
}

async function upsertPlaybookSnapshot(
  supabase: MaterializationDbClient,
  snapshot: PlaybookGovernanceSnapshot,
  sourceContextHash: string | null,
): Promise<MaterializationResult<PlaybookSnapshotMaterializationOutcome>> {
  const { data: existing, error: selectError } = await supabase
    .from<PlaybookSnapshotRow>("playbook_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .eq("workspace_id", snapshot.workspaceId)
    .eq("project_id", snapshot.projectId)
    .eq("fingerprint", snapshot.fingerprint)
    .maybeSingle();

  if (selectError) return persistenceFailure("Unable to check for an existing playbook snapshot.");

  // Fingerprint is a deterministic hash of every governed artifact in the
  // snapshot — an existing row for the same fingerprint always has identical
  // content, so this is a true no-op, never a partial update.
  if (existing) {
    return { ok: true, data: { row: existing, created: false } };
  }

  const insertRow = governanceSnapshotToSnapshotRow(snapshot, { sourceContextHash });
  const { data: inserted, error: insertError } = await supabase
    .from<PlaybookSnapshotRow>("playbook_snapshots")
    .insert(insertRow)
    .select(SNAPSHOT_COLUMNS)
    .single();

  if (insertError || !inserted) return persistenceFailure("Unable to create playbook snapshot.");

  return { ok: true, data: { row: inserted, created: true } };
}

async function upsertPlaybookRecommendation(
  supabase: MaterializationDbClient,
  snapshotId: string,
  recommendation: PlaybookRecommendation,
): Promise<MaterializationResult<PlaybookRecommendationMaterializationOutcome>> {
  const { data: existing, error: selectError } = await supabase
    .from<PlaybookRecommendationRow>("playbook_recommendations")
    .select(RECOMMENDATION_COLUMNS)
    .eq("workspace_id", recommendation.workspaceId)
    .eq("project_id", recommendation.projectId)
    .eq("fingerprint", recommendation.fingerprint)
    .maybeSingle();

  if (selectError) return persistenceFailure("Unable to check for an existing playbook recommendation.");

  if (!existing) {
    const insertRow = recommendationToRecommendationRow(recommendation, snapshotId);
    const { data: inserted, error: insertError } = await supabase
      .from<PlaybookRecommendationRow>("playbook_recommendations")
      .insert(insertRow)
      .select(RECOMMENDATION_COLUMNS)
      .single();

    if (insertError || !inserted) return persistenceFailure("Unable to create playbook recommendation.");

    return { ok: true, data: { row: inserted, created: true, preserved: false, contentStale: false } };
  }

  if (shouldPreserveHumanState(existing)) {
    // A human has already moved this recommendation past "new" — never touch
    // status, timestamps, or content-bearing columns (including
    // approval_required). At most, flag content_stale so the UI can say
    // "this was generated from newer evidence" without discarding the
    // decision.
    const existingRecommendation = (existing.recommendation_payload ?? null) as PlaybookRecommendation | null;
    const contentStale = existingRecommendation
      ? recommendationContentSignature(existingRecommendation) !== recommendationContentSignature(recommendation)
      : true;

    if (contentStale === existing.content_stale) {
      return { ok: true, data: { row: existing, created: false, preserved: true, contentStale } };
    }

    const { data: updated, error: updateError } = await supabase
      .from<PlaybookRecommendationRow>("playbook_recommendations")
      .update({ content_stale: contentStale })
      .eq("id", existing.id)
      .select(RECOMMENDATION_COLUMNS)
      .single();

    if (updateError || !updated) return persistenceFailure("Unable to flag playbook recommendation as stale.");

    return { ok: true, data: { row: updated, created: false, preserved: true, contentStale } };
  }

  // status === "new": nobody has decided anything yet, content is free to
  // refresh. approval_required is still never relaxed — only OR-merged, so a
  // previously-true value can never flip back to false.
  const insertRow = recommendationToRecommendationRow(recommendation, snapshotId);
  const approvalRequired = existing.approval_required || insertRow.approval_required;

  const { data: updated, error: updateError } = await supabase
    .from<PlaybookRecommendationRow>("playbook_recommendations")
    .update({
      snapshot_id: snapshotId,
      title: insertRow.title,
      severity: insertRow.severity,
      phase: insertRow.phase,
      detected_situation: insertRow.detected_situation,
      recommended_action: insertRow.recommended_action,
      approval_required: approvalRequired,
      evidence_used: insertRow.evidence_used,
      missing_evidence: insertRow.missing_evidence,
      suggested_actions: insertRow.suggested_actions,
      explanation: insertRow.explanation,
      recommendation_payload: insertRow.recommendation_payload,
      content_stale: false,
    })
    .eq("id", existing.id)
    .select(RECOMMENDATION_COLUMNS)
    .single();

  if (updateError || !updated) return persistenceFailure("Unable to refresh playbook recommendation.");

  return { ok: true, data: { row: updated, created: false, preserved: false, contentStale: false } };
}

async function insertPlaybookAuditEventIfNew(
  supabase: MaterializationDbClient,
  snapshotId: string,
  event: PlaybookAuditEvent,
): Promise<MaterializationResult<PlaybookAuditEventMaterializationOutcome>> {
  const { data: existing, error: selectError } = await supabase
    .from<PlaybookAuditEventRow>("playbook_audit_events")
    .select(AUDIT_EVENT_COLUMNS)
    .eq("workspace_id", event.workspaceId)
    .eq("project_id", event.projectId)
    .eq("fingerprint", event.fingerprint)
    .maybeSingle();

  if (selectError) return persistenceFailure("Unable to check for an existing playbook audit event.");

  // Append-only, deduplicated by fingerprint — never updated once inserted.
  if (existing) {
    return { ok: true, data: { row: existing, created: false, deduplicated: true } };
  }

  const insertRow = auditEventToAuditEventRow(event, snapshotId);
  const { data: inserted, error: insertError } = await supabase
    .from<PlaybookAuditEventRow>("playbook_audit_events")
    .insert(insertRow)
    .select(AUDIT_EVENT_COLUMNS)
    .single();

  if (insertError || !inserted) return persistenceFailure("Unable to create playbook audit event.");

  return { ok: true, data: { row: inserted, created: true, deduplicated: false } };
}

/**
 * Persists a `PlaybookGovernanceSnapshot` (Phase 1 scope: snapshot header +
 * recommendations + audit events only). Never generates anything itself —
 * the caller must have already run `generatePlaybookGovernanceSnapshot()`.
 * Idempotent: calling this twice with an unchanged snapshot produces no new
 * rows and no content changes to any row a human has already touched.
 */
export async function materializePlaybookGovernanceSnapshot(
  input: MaterializePlaybookGovernanceSnapshotInput,
): Promise<MaterializePlaybookGovernanceSnapshotResult> {
  const { supabase, snapshot, options = {} } = input;

  if (!snapshot.workspaceId || snapshot.workspaceId.trim().length === 0) {
    return { ok: false, error: "snapshot.workspaceId is required.", failureClass: "validation_failed" };
  }
  if (!snapshot.projectId || snapshot.projectId.trim().length === 0) {
    return { ok: false, error: "snapshot.projectId is required.", failureClass: "validation_failed" };
  }

  const snapshotOutcome = await upsertPlaybookSnapshot(supabase, snapshot, options.sourceContextHash ?? null);
  if (!snapshotOutcome.ok) return snapshotOutcome;

  const snapshotId = snapshotOutcome.data.row.id;

  const recommendations: PlaybookRecommendationMaterializationOutcome[] = [];
  for (const recommendation of snapshot.recommendations) {
    const outcome = await upsertPlaybookRecommendation(supabase, snapshotId, recommendation);
    if (!outcome.ok) return outcome;
    recommendations.push(outcome.data);
  }

  const auditEvents: PlaybookAuditEventMaterializationOutcome[] = [];
  for (const event of snapshot.auditEvents) {
    const outcome = await insertPlaybookAuditEventIfNew(supabase, snapshotId, event);
    if (!outcome.ok) return outcome;
    auditEvents.push(outcome.data);
  }

  return {
    ok: true,
    data: {
      snapshot: snapshotOutcome.data.row,
      snapshotCreated: snapshotOutcome.data.created,
      recommendations,
      auditEvents,
    },
  };
}
