/**
 * Materialization layer (Phase 2) — read-only query services over the three tables Phase 1
 * persists (`playbook_snapshots`, `playbook_recommendations`, `playbook_audit_events`). Every
 * function here only reads; `materialization-status-service.ts` is the only Phase 2 file that
 * writes. No UI calls any of this yet — this is the service layer a future UI will call.
 *
 * What this file never does, by design (Phase 2 scope):
 *  - write to any table — every exported function only ever `.select()`s.
 *  - reference `recommended_actions`, `task_drafts`, `platform_events`, `raid_items`, or
 *    `constitutional_decisions` — different domains, out of scope for this phase.
 */

import {
  buildPlaybookProjectBrainView,
  toPlaybookAuditEventView,
  toPlaybookRecommendationView,
  toPlaybookSnapshotDetailView,
  toPlaybookSnapshotListItemView,
} from "./materialization-view-models";
import type {
  PlaybookAuditEventView,
  PlaybookProjectBrainView,
  PlaybookRecommendationView,
  PlaybookSnapshotDetailView,
  PlaybookSnapshotListItemView,
} from "./materialization-view-models";
import type {
  MaterializationQueryReadDbClient,
  MaterializationResult,
  PlaybookAuditEventRelatedEntityType,
  PlaybookAuditEventRow,
  PlaybookRecommendationRow,
  PlaybookRecommendationRowStatus,
  PlaybookSnapshotRow,
} from "./materialization-types";

const SNAPSHOT_LIST_COLUMNS =
  "id,workspace_id,project_id,fingerprint,playbook_id,playbook_version,status,generated_at,source_context_hash,missing_evidence_summary,approval_required_summary,next_best_actions,demo_summary,content_stale,created_at,updated_at";

const SNAPSHOT_DETAIL_COLUMNS =
  "id,workspace_id,project_id,fingerprint,playbook_id,playbook_version,status,generated_at,source_context_hash,rules_summary,missing_evidence_summary,approval_required_summary,next_best_actions,demo_summary,snapshot_payload,content_stale,created_at,updated_at";

const RECOMMENDATION_COLUMNS =
  "id,workspace_id,project_id,snapshot_id,fingerprint,playbook_rule_id,title,status,severity,phase,detected_situation,recommended_action,approval_required,evidence_used,missing_evidence,suggested_actions,explanation,content_stale,viewed_at,accepted_at,dismissed_at,approved_at,executed_at,reviewed_by,approved_by,created_at,updated_at";

const AUDIT_EVENT_COLUMNS =
  "id,workspace_id,project_id,snapshot_id,related_entity_type,related_entity_id,fingerprint,event_type,actor_type,actor_id,severity,summary,evidence_used,missing_evidence,approval_required,metadata,created_at";

const DEFAULT_LIST_LIMIT = 50;

/** Recommendations fetched to compute `PlaybookProjectBrainView` counts must never be paginated —
 * an undercounted page would silently under-report `recommendationCountsByStatus`. This is a
 * safety cap, not a page size; projects are expected to hold far fewer recommendations than this. */
const BRAIN_VIEW_RECOMMENDATION_FETCH_LIMIT = 5000;

function requireWorkspaceAndProject(
  workspaceId: string,
  projectId: string,
): { ok: false; error: string; failureClass: "validation_failed" } | null {
  if (!workspaceId || workspaceId.trim().length === 0) {
    return { ok: false, error: "workspaceId is required.", failureClass: "validation_failed" };
  }
  if (!projectId || projectId.trim().length === 0) {
    return { ok: false, error: "projectId is required.", failureClass: "validation_failed" };
  }
  return null;
}

function persistenceFailure(error: string): { ok: false; error: string; failureClass: "persistence_failed" } {
  return { ok: false, error, failureClass: "persistence_failed" };
}

/**
 * Keyset-style pagination over an already-fetched, already-sorted array: `cursor` is the `id` of
 * the last item from the previous page. There is no DB-level `OFFSET`/`LIMIT` involved — every
 * list function here fetches its full filtered result set (bounded by workspace+project scope)
 * and windows it in memory, because `listPlaybookRecommendations`'s multi-key priority sort
 * (§ below) cannot be expressed as a single-column SQL `ORDER BY`.
 */
function paginateById<T extends { id: string }>(
  rows: readonly T[],
  cursor: string | null,
  limit: number | null | undefined,
): { items: T[]; nextCursor: string | null } {
  const effectiveLimit = limit && limit > 0 ? limit : DEFAULT_LIST_LIMIT;
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = rows.findIndex((row) => row.id === cursor);
    startIndex = cursorIndex === -1 ? 0 : cursorIndex + 1;
  }
  const items = rows.slice(startIndex, startIndex + effectiveLimit);
  const hasMore = startIndex + items.length < rows.length;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}

// ─── playbook_snapshots ───────────────────────────────────────────────────────

export type ListPlaybookSnapshotsInput = {
  db: MaterializationQueryReadDbClient;
  workspaceId: string;
  projectId: string;
  status?: PlaybookSnapshotRow["status"];
  limit?: number;
  cursor?: string | null;
};

export type ListPlaybookSnapshotsResult = MaterializationResult<{
  items: PlaybookSnapshotListItemView[];
  nextCursor: string | null;
}>;

/** Never selects `snapshot_payload` or `rules_summary` (the two heaviest, explainability-only
 * JSONB blobs) — those only ever load through `getPlaybookSnapshot`'s detail view. */
export async function listPlaybookSnapshots(input: ListPlaybookSnapshotsInput): Promise<ListPlaybookSnapshotsResult> {
  const invalid = requireWorkspaceAndProject(input.workspaceId, input.projectId);
  if (invalid) return invalid;

  let query = input.db
    .from<PlaybookSnapshotRow>("playbook_snapshots")
    .select(SNAPSHOT_LIST_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId);
  if (input.status) query = query.eq("status", input.status);
  query = query.order("generated_at", { ascending: false });

  const { data, error } = await query;
  if (error) return persistenceFailure("Unable to list playbook snapshots.");

  const { items, nextCursor } = paginateById(data ?? [], input.cursor ?? null, input.limit);
  return { ok: true, data: { items: items.map(toPlaybookSnapshotListItemView), nextCursor } };
}

export type GetPlaybookSnapshotInput = {
  db: MaterializationQueryReadDbClient;
  workspaceId: string;
  projectId: string;
  /** If neither `snapshotId` nor `fingerprint` is given, returns the most recently generated
   * snapshot for the project (`ORDER BY generated_at DESC` — the "Project Brain" default view). */
  snapshotId?: string;
  fingerprint?: string;
};

export type GetPlaybookSnapshotResult = MaterializationResult<PlaybookSnapshotDetailView>;

async function fetchSnapshotRow(
  input: Pick<GetPlaybookSnapshotInput, "db" | "workspaceId" | "projectId" | "snapshotId" | "fingerprint">,
): Promise<MaterializationResult<PlaybookSnapshotRow | null>> {
  if (input.snapshotId) {
    const { data, error } = await input.db
      .from<PlaybookSnapshotRow>("playbook_snapshots")
      .select(SNAPSHOT_DETAIL_COLUMNS)
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .eq("id", input.snapshotId)
      .maybeSingle();
    if (error) return persistenceFailure("Unable to load playbook snapshot by id.");
    return { ok: true, data };
  }

  if (input.fingerprint) {
    const { data, error } = await input.db
      .from<PlaybookSnapshotRow>("playbook_snapshots")
      .select(SNAPSHOT_DETAIL_COLUMNS)
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", input.projectId)
      .eq("fingerprint", input.fingerprint)
      .maybeSingle();
    if (error) return persistenceFailure("Unable to load playbook snapshot by fingerprint.");
    return { ok: true, data };
  }

  const { data, error } = await input.db
    .from<PlaybookSnapshotRow>("playbook_snapshots")
    .select(SNAPSHOT_DETAIL_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .order("generated_at", { ascending: false });
  if (error) return persistenceFailure("Unable to load the latest playbook snapshot.");
  return { ok: true, data: (data ?? [])[0] ?? null };
}

/** Loads a snapshot plus every recommendation and audit event linked to it (`snapshot_id`),
 * always scoped to `workspaceId`/`projectId`. */
export async function getPlaybookSnapshot(input: GetPlaybookSnapshotInput): Promise<GetPlaybookSnapshotResult> {
  const invalid = requireWorkspaceAndProject(input.workspaceId, input.projectId);
  if (invalid) return invalid;

  const snapshotOutcome = await fetchSnapshotRow(input);
  if (!snapshotOutcome.ok) return snapshotOutcome;
  const snapshot = snapshotOutcome.data;
  if (!snapshot) return { ok: false, error: "Playbook snapshot not found.", failureClass: "not_found" };

  const { data: recommendationRows, error: recommendationError } = await input.db
    .from<PlaybookRecommendationRow>("playbook_recommendations")
    .select(RECOMMENDATION_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .eq("snapshot_id", snapshot.id)
    .order("created_at", { ascending: false });
  if (recommendationError) return persistenceFailure("Unable to load recommendations for this playbook snapshot.");

  const { data: auditEventRows, error: auditEventError } = await input.db
    .from<PlaybookAuditEventRow>("playbook_audit_events")
    .select(AUDIT_EVENT_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId)
    .eq("snapshot_id", snapshot.id)
    .order("created_at", { ascending: false });
  if (auditEventError) return persistenceFailure("Unable to load audit events for this playbook snapshot.");

  return {
    ok: true,
    data: toPlaybookSnapshotDetailView(
      snapshot,
      (recommendationRows ?? []).map(toPlaybookRecommendationView),
      (auditEventRows ?? []).map(toPlaybookAuditEventView),
    ),
  };
}

// ─── playbook_recommendations ─────────────────────────────────────────────────

export type ListPlaybookRecommendationsInput = {
  db: MaterializationQueryReadDbClient;
  workspaceId: string;
  projectId: string;
  snapshotId?: string;
  status?: PlaybookRecommendationRowStatus;
  severity?: "low" | "medium" | "high" | "critical";
  approvalRequired?: boolean;
  contentStale?: boolean;
  limit?: number;
  cursor?: string | null;
};

export type ListPlaybookRecommendationsResult = MaterializationResult<{
  items: PlaybookRecommendationView[];
  nextCursor: string | null;
}>;

const SEVERITY_SORT_PRIORITY: Record<"low" | "medium" | "high" | "critical", number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Lower sorts first. Unresolved/actionable statuses surface ahead of settled/terminal ones, so a
 * human reviewing the list sees what still needs a decision before what's already been decided. */
const STATUS_SORT_PRIORITY: Record<PlaybookRecommendationRowStatus, number> = {
  new: 0,
  viewed: 1,
  requires_approval: 2,
  accepted: 3,
  approved: 4,
  converted_to_task: 5,
  converted_to_draft: 6,
  dismissed: 7,
  executed: 8,
};

/** Approval-required first, then severity (critical→low), then status (pending→settled), then
 * newest first. Not expressible as a single SQL `ORDER BY` on this schema (severity/status are
 * plain text columns, not enums with a matching sort order), so this runs in memory after the
 * DB-filtered fetch. */
function compareRecommendationsForReview(a: PlaybookRecommendationRow, b: PlaybookRecommendationRow): number {
  if (a.approval_required !== b.approval_required) return a.approval_required ? -1 : 1;
  const severityDelta = SEVERITY_SORT_PRIORITY[a.severity] - SEVERITY_SORT_PRIORITY[b.severity];
  if (severityDelta !== 0) return severityDelta;
  const statusDelta = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
  if (statusDelta !== 0) return statusDelta;
  return b.created_at.localeCompare(a.created_at);
}

export async function listPlaybookRecommendations(
  input: ListPlaybookRecommendationsInput,
): Promise<ListPlaybookRecommendationsResult> {
  const invalid = requireWorkspaceAndProject(input.workspaceId, input.projectId);
  if (invalid) return invalid;

  let query = input.db
    .from<PlaybookRecommendationRow>("playbook_recommendations")
    .select(RECOMMENDATION_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId);
  if (input.snapshotId) query = query.eq("snapshot_id", input.snapshotId);
  if (input.status) query = query.eq("status", input.status);
  if (input.severity) query = query.eq("severity", input.severity);
  if (input.approvalRequired !== undefined) query = query.eq("approval_required", input.approvalRequired);
  if (input.contentStale !== undefined) query = query.eq("content_stale", input.contentStale);
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return persistenceFailure("Unable to list playbook recommendations.");

  const sorted = [...(data ?? [])].sort(compareRecommendationsForReview);
  const { items, nextCursor } = paginateById(sorted, input.cursor ?? null, input.limit);
  return { ok: true, data: { items: items.map(toPlaybookRecommendationView), nextCursor } };
}

// ─── playbook_audit_events ────────────────────────────────────────────────────

export type ListPlaybookAuditEventsInput = {
  db: MaterializationQueryReadDbClient;
  workspaceId: string;
  projectId: string;
  snapshotId?: string;
  eventType?: string;
  relatedEntityType?: PlaybookAuditEventRelatedEntityType;
  relatedEntityId?: string;
  limit?: number;
  cursor?: string | null;
};

export type ListPlaybookAuditEventsResult = MaterializationResult<{
  items: PlaybookAuditEventView[];
  nextCursor: string | null;
}>;

export async function listPlaybookAuditEvents(
  input: ListPlaybookAuditEventsInput,
): Promise<ListPlaybookAuditEventsResult> {
  const invalid = requireWorkspaceAndProject(input.workspaceId, input.projectId);
  if (invalid) return invalid;

  let query = input.db
    .from<PlaybookAuditEventRow>("playbook_audit_events")
    .select(AUDIT_EVENT_COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("project_id", input.projectId);
  if (input.snapshotId) query = query.eq("snapshot_id", input.snapshotId);
  if (input.eventType) query = query.eq("event_type", input.eventType);
  if (input.relatedEntityType) query = query.eq("related_entity_type", input.relatedEntityType);
  if (input.relatedEntityId) query = query.eq("related_entity_id", input.relatedEntityId);
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return persistenceFailure("Unable to list playbook audit events.");

  const { items, nextCursor } = paginateById(data ?? [], input.cursor ?? null, input.limit);
  return { ok: true, data: { items: items.map(toPlaybookAuditEventView), nextCursor } };
}

// ─── Project Brain (composed view) ────────────────────────────────────────────

export type GetPlaybookProjectBrainViewInput = {
  db: MaterializationQueryReadDbClient;
  workspaceId: string;
  projectId: string;
  /** How many of the most recent audit events to embed. Defaults to 10. */
  auditEventLimit?: number;
};

export type GetPlaybookProjectBrainViewResult = MaterializationResult<PlaybookProjectBrainView>;

/**
 * Composes the three read functions above into the single aggregate view a "Project Brain"
 * screen would need. Recommendation counts are computed over every recommendation for the
 * project — not just the latest snapshot's — because a preserved (human-touched) recommendation
 * keeps the `snapshot_id` of whichever snapshot last regenerated it while still `status: 'new'`;
 * scoping to only the latest snapshot would silently drop recommendations a human is still
 * actively working through.
 */
export async function getPlaybookProjectBrainView(
  input: GetPlaybookProjectBrainViewInput,
): Promise<GetPlaybookProjectBrainViewResult> {
  const invalid = requireWorkspaceAndProject(input.workspaceId, input.projectId);
  if (invalid) return invalid;

  const snapshotOutcome = await getPlaybookSnapshot({ db: input.db, workspaceId: input.workspaceId, projectId: input.projectId });
  if (!snapshotOutcome.ok && snapshotOutcome.failureClass !== "not_found") return snapshotOutcome;
  const latestSnapshot = snapshotOutcome.ok ? snapshotOutcome.data : null;

  const recommendationsOutcome = await listPlaybookRecommendations({
    db: input.db,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    limit: BRAIN_VIEW_RECOMMENDATION_FETCH_LIMIT,
  });
  if (!recommendationsOutcome.ok) return recommendationsOutcome;

  const auditEventsOutcome = await listPlaybookAuditEvents({
    db: input.db,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    limit: input.auditEventLimit ?? 10,
  });
  if (!auditEventsOutcome.ok) return auditEventsOutcome;

  return {
    ok: true,
    data: buildPlaybookProjectBrainView({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      latestSnapshot,
      nextBestActions: latestSnapshot?.nextBestActions ?? [],
      recommendations: recommendationsOutcome.data.items,
      latestAuditEvents: auditEventsOutcome.data.items,
    }),
  };
}
