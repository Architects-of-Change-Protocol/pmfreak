/**
 * Materialization layer (Phase 2) — human-recorded status transitions for a persisted
 * `playbook_recommendations` row. Delegates every transition-validity decision to the existing,
 * pure `recommendation-state.ts` state machine; this file only ever persists the result and
 * records a `playbook_audit_events` row alongside it. It never executes the recommendation's
 * `recommendedAction`, never creates a real task/draft/RAID item/decision, and never writes to
 * `platform_events`.
 *
 * `mark_executed` is intentionally blocked in this phase — see `MARK_EXECUTED_BLOCKED_REASON`
 * below. Every other action in `PlaybookRecommendationStatusAction` is a pure bookkeeping
 * transition: `converted_to_task`/`converted_to_draft` mark status only, they never create the
 * task or draft they name.
 */

import { createHash } from "node:crypto";

import {
  acceptRecommendation,
  approveRecommendation,
  dismissRecommendation,
  markRecommendationConvertedToDraft,
  markRecommendationConvertedToTask,
  markRecommendationRequiresApproval,
  markRecommendationViewed,
} from "./recommendation-state";
import { toPlaybookAuditEventView, toPlaybookRecommendationView } from "./materialization-view-models";
import type { PlaybookAuditEventView, PlaybookRecommendationView } from "./materialization-view-models";
import type { PlaybookRecommendation } from "./recommendation-engine";
import type { PlaybookEngineResult } from "./types";
import type {
  MaterializationDbClient,
  MaterializationFailureClass,
  MaterializationResult,
  PlaybookAuditEventRow,
  PlaybookRecommendationRow,
  PlaybookRecommendationRowStatus,
} from "./materialization-types";

const RECOMMENDATION_COLUMNS =
  "id,workspace_id,project_id,snapshot_id,fingerprint,playbook_rule_id,title,status,severity,phase,detected_situation,recommended_action,approval_required,evidence_used,missing_evidence,suggested_actions,explanation,recommendation_payload,content_stale,viewed_at,accepted_at,dismissed_at,approved_at,executed_at,reviewed_by,approved_by,created_at,updated_at";

const AUDIT_EVENT_COLUMNS =
  "id,workspace_id,project_id,snapshot_id,related_entity_type,related_entity_id,fingerprint,event_type,actor_type,actor_id,severity,summary,evidence_used,missing_evidence,approval_required,metadata,audit_payload,created_at";

export type PlaybookRecommendationStatusAction =
  | "mark_viewed"
  | "accept"
  | "dismiss"
  | "require_approval"
  | "approve"
  | "mark_converted_to_task"
  | "mark_converted_to_draft"
  | "mark_executed";

export type UpdatePlaybookRecommendationStatusInput = {
  db: MaterializationDbClient;
  workspaceId: string;
  projectId: string;
  /** Either `recommendationId` or `fingerprint` is required to identify the row. */
  recommendationId?: string;
  fingerprint?: string;
  action: PlaybookRecommendationStatusAction;
  actorId: string;
  reason?: string;
  /** Injected clock for deterministic tests. Defaults to `new Date().toISOString()`. */
  now?: string;
};

export type UpdatePlaybookRecommendationStatusResult = MaterializationResult<{
  recommendation: PlaybookRecommendationView;
  auditEvent: PlaybookAuditEventView;
  /** `false` when an identical prior call (same recommendation/transition/actor/reason/now)
   * already recorded this exact audit event — see `recommendationStateChangeFingerprint`. */
  auditEventCreated: boolean;
}>;

export const MARK_EXECUTED_BLOCKED_REASON =
  "mark_executed is blocked in Materialization Phase 2. Recording a real execution requires a future phase that wires an actual action-execution adapter and re-verifies the approval gate at execution time — this phase only supports non-executing status transitions.";

function validationFailure(error: string): { ok: false; error: string; failureClass: "validation_failed" } {
  return { ok: false, error, failureClass: "validation_failed" };
}

function persistenceFailure(error: string): { ok: false; error: string; failureClass: "persistence_failed" } {
  return { ok: false, error, failureClass: "persistence_failed" };
}

/** Reconstructs the engine-shaped `PlaybookRecommendation` the pure `recommendation-state.ts`
 * functions expect. `recommendation_payload` holds the full object captured while the row was
 * still `status: 'new'` (materialization-mappers.ts never rewrites it once a human moves the row
 * past `'new'`), so `status`/`approvalRequired`/identity fields are overridden here from the row
 * itself — the row, not the payload, is the source of truth for current state. */
function rowToEngineRecommendation(row: PlaybookRecommendationRow): PlaybookRecommendation {
  const payload = (row.recommendation_payload ?? {}) as unknown as PlaybookRecommendation;
  return {
    ...payload,
    id: row.id,
    fingerprint: row.fingerprint,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    title: row.title,
    status: row.status,
    approvalRequired: row.approval_required,
  };
}

function applyTransition(
  action: Exclude<PlaybookRecommendationStatusAction, "mark_executed">,
  recommendation: PlaybookRecommendation,
): PlaybookEngineResult<PlaybookRecommendation> {
  switch (action) {
    case "mark_viewed":
      return markRecommendationViewed(recommendation);
    case "accept":
      return acceptRecommendation(recommendation);
    case "dismiss":
      return dismissRecommendation(recommendation);
    case "require_approval":
      return markRecommendationRequiresApproval(recommendation);
    case "approve":
      return approveRecommendation(recommendation);
    case "mark_converted_to_task":
      return markRecommendationConvertedToTask(recommendation);
    case "mark_converted_to_draft":
      return markRecommendationConvertedToDraft(recommendation);
  }
}

/** Only status/timestamp/reviewed_by/approved_by columns are ever written here — never content
 * (`title`, `severity`, `evidence_used`, `suggested_actions`, `recommendation_payload`, …) and
 * never `approval_required` (this service cannot relax or tighten an approval gate, only record
 * decisions made under whatever gate is already persisted). */
function buildRowUpdate(
  action: Exclude<PlaybookRecommendationStatusAction, "mark_executed">,
  nextStatus: PlaybookRecommendationRowStatus,
  actorId: string,
  nowIso: string,
): Partial<
  Pick<PlaybookRecommendationRow, "status" | "viewed_at" | "accepted_at" | "dismissed_at" | "approved_at" | "reviewed_by" | "approved_by">
> {
  const update: Partial<
    Pick<PlaybookRecommendationRow, "status" | "viewed_at" | "accepted_at" | "dismissed_at" | "approved_at" | "reviewed_by" | "approved_by">
  > = { status: nextStatus };

  switch (action) {
    case "mark_viewed":
      update.viewed_at = nowIso;
      update.reviewed_by = actorId;
      break;
    case "accept":
      update.accepted_at = nowIso;
      update.reviewed_by = actorId;
      break;
    case "dismiss":
      update.dismissed_at = nowIso;
      update.reviewed_by = actorId;
      break;
    case "require_approval":
      update.reviewed_by = actorId;
      break;
    case "approve":
      update.approved_at = nowIso;
      update.approved_by = actorId;
      break;
    case "mark_converted_to_task":
    case "mark_converted_to_draft":
      update.reviewed_by = actorId;
      break;
  }
  return update;
}

/** Deterministic per (recommendation, transition, actor, reason, timestamp) — calling
 * `updatePlaybookRecommendationStatus` twice with identical inputs (e.g. a retried request)
 * produces the same fingerprint, so the audit-event insert below dedupes it instead of writing a
 * second row. Distinct from `auditRecommendationStateChanged` in `playbook-audit-engine.ts`
 * (which fingerprints only on fingerprint+fromStatus+toStatus, for the engine's own
 * generation-time recording) because idempotency here must also account for *who* made the
 * decision and *when*, not just what changed. */
function recommendationStateChangeFingerprint(
  recommendationId: string,
  previousStatus: string,
  nextStatus: string,
  actorId: string,
  reason: string | null,
  nowIso: string,
): string {
  return createHash("sha256")
    .update(`${recommendationId}:${previousStatus}:${nextStatus}:${actorId}:${reason ?? ""}:${nowIso}`)
    .digest("hex");
}

type RecommendationStateChangeAuditInput = {
  recommendationId: string;
  workspaceId: string;
  projectId: string;
  title: string;
  previousStatus: string;
  nextStatus: string;
  actorId: string;
  reason: string | null;
  nowIso: string;
};

async function insertRecommendationStateChangeAuditEvent(
  db: MaterializationDbClient,
  input: RecommendationStateChangeAuditInput,
): Promise<MaterializationResult<{ row: PlaybookAuditEventRow; created: boolean }>> {
  const fingerprint = recommendationStateChangeFingerprint(
    input.recommendationId,
    input.previousStatus,
    input.nextStatus,
    input.actorId,
    input.reason,
    input.nowIso,
  );

  const { data: existing, error: selectError } = await db
    .from<PlaybookAuditEventRow>("playbook_audit_events")
    .select(AUDIT_EVENT_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .eq("fingerprint", fingerprint)
    .maybeSingle();
  if (selectError) return persistenceFailure("Unable to check for an existing playbook audit event.");
  if (existing) return { ok: true, data: { row: existing, created: false } };

  const summary = input.reason
    ? `La recomendación '${input.title}' pasó de '${input.previousStatus}' a '${input.nextStatus}' (motivo: ${input.reason}).`
    : `La recomendación '${input.title}' pasó de '${input.previousStatus}' a '${input.nextStatus}'.`;

  const insertRow = {
    workspace_id: input.workspaceId,
    project_id: input.projectId,
    snapshot_id: null,
    related_entity_type: "recommendation" as const,
    related_entity_id: input.recommendationId,
    fingerprint,
    event_type: "recommendation_state_changed" as const,
    actor_type: "user" as const,
    actor_id: input.actorId,
    severity: "info" as const,
    summary,
    evidence_used: [],
    missing_evidence: [],
    approval_required: input.nextStatus === "requires_approval",
    metadata: { previousStatus: input.previousStatus, nextStatus: input.nextStatus, reason: input.reason },
    audit_payload: {
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      reason: input.reason,
      actorId: input.actorId,
    },
  };

  const { data: inserted, error: insertError } = await db
    .from<PlaybookAuditEventRow>("playbook_audit_events")
    .insert(insertRow)
    .select(AUDIT_EVENT_COLUMNS)
    .single();
  if (insertError || !inserted) {
    return persistenceFailure("Unable to create playbook audit event for recommendation state change.");
  }

  return { ok: true, data: { row: inserted, created: true } };
}

/**
 * Persists a human decision about a `playbook_recommendations` row: validates the transition via
 * `recommendation-state.ts`, updates only status/timestamp/reviewed_by/approved_by columns, and
 * records a `recommendation_state_changed` audit event. Never touches content columns, never
 * relaxes `approval_required`, never writes to `recommended_actions`, `task_drafts`,
 * `raid_items`, `constitutional_decisions`, or `platform_events`.
 */
export async function updatePlaybookRecommendationStatus(
  input: UpdatePlaybookRecommendationStatusInput,
): Promise<UpdatePlaybookRecommendationStatusResult> {
  const { db, workspaceId, projectId, recommendationId, fingerprint, action, actorId, reason } = input;

  if (!workspaceId || workspaceId.trim().length === 0) return validationFailure("workspaceId is required.");
  if (!projectId || projectId.trim().length === 0) return validationFailure("projectId is required.");
  if (!recommendationId && !fingerprint) {
    return validationFailure("Either recommendationId or fingerprint is required.");
  }
  if (!actorId || actorId.trim().length === 0) return validationFailure("actorId is required.");

  if (action === "mark_executed") {
    return { ok: false, error: MARK_EXECUTED_BLOCKED_REASON, failureClass: "governance_violation" };
  }

  let query = db
    .from<PlaybookRecommendationRow>("playbook_recommendations")
    .select(RECOMMENDATION_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId);
  query = recommendationId ? query.eq("id", recommendationId) : query.eq("fingerprint", fingerprint as string);

  const { data: existing, error: selectError } = await query.maybeSingle();
  if (selectError) return persistenceFailure("Unable to load the playbook recommendation.");
  if (!existing) return { ok: false, error: "Playbook recommendation not found.", failureClass: "not_found" };

  const engineRecommendation = rowToEngineRecommendation(existing);
  const transitionResult = applyTransition(action, engineRecommendation);
  if (!transitionResult.ok) {
    const failureClass: MaterializationFailureClass =
      transitionResult.failureClass === "governance_violation" ? "governance_violation" : "validation_failed";
    return { ok: false, error: transitionResult.error, failureClass };
  }

  const previousStatus = existing.status;
  const nextStatus = transitionResult.data.status;
  const nowIso = input.now ?? new Date().toISOString();

  const rowUpdate = buildRowUpdate(action, nextStatus, actorId, nowIso);
  const { data: updatedRow, error: updateError } = await db
    .from<PlaybookRecommendationRow>("playbook_recommendations")
    .update(rowUpdate)
    .eq("id", existing.id)
    .select(RECOMMENDATION_COLUMNS)
    .single();
  if (updateError || !updatedRow) return persistenceFailure("Unable to update the playbook recommendation status.");

  const auditOutcome = await insertRecommendationStateChangeAuditEvent(db, {
    recommendationId: existing.id,
    workspaceId,
    projectId,
    title: existing.title,
    previousStatus,
    nextStatus,
    actorId,
    reason: reason ?? null,
    nowIso,
  });
  if (!auditOutcome.ok) return auditOutcome;

  return {
    ok: true,
    data: {
      recommendation: toPlaybookRecommendationView(updatedRow),
      auditEvent: toPlaybookAuditEventView(auditOutcome.data.row),
      auditEventCreated: auditOutcome.data.created,
    },
  };
}
