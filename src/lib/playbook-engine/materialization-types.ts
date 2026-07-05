/**
 * Materialization layer (Phase 1) — types only, no DB access, no side effects.
 *
 * Persists the read-only / governed layer of a `PlaybookGovernanceSnapshot`
 * (`governance-snapshot-engine.ts`) into `playbook_snapshots`,
 * `playbook_recommendations`, and `playbook_audit_events`. The Playbook
 * Engine itself (every other file in this directory) stays a pure, in-memory
 * generator — this module and its siblings (`materialization-mappers.ts`,
 * `materialization-service.ts`) are the only ones in this directory allowed
 * to talk to a database.
 *
 * Phase 1 scope only: no communication/operational draft persistence, no
 * closure/billing persistence, no real conversion to RAID/decisions/tasks,
 * no `platform_events` materialization, no auto-approval, no auto-execution.
 */

import type {
  PlaybookAuditEventRow,
  PlaybookRecommendationRow,
  PlaybookSnapshotRow,
} from "@/lib/db/database-contract";

export type {
  PlaybookAuditEventRelatedEntityType,
  PlaybookAuditEventRow,
  PlaybookRecommendationRow,
  PlaybookRecommendationRowStatus,
  PlaybookSnapshotRow,
  PlaybookSnapshotStatus,
} from "@/lib/db/database-contract";

/** Row shape accepted by `.insert()` for `playbook_snapshots` — every column
 * except the ones the database itself assigns (`id`, `created_at`,
 * `updated_at`). */
export type PlaybookSnapshotInsert = Omit<PlaybookSnapshotRow, "id" | "created_at" | "updated_at">;

/** Row shape accepted by `.insert()` for `playbook_recommendations`. */
export type PlaybookRecommendationInsert = Omit<PlaybookRecommendationRow, "id" | "created_at" | "updated_at">;

/** Row shape accepted by `.insert()` for `playbook_audit_events`. */
export type PlaybookAuditEventInsert = Omit<PlaybookAuditEventRow, "id" | "created_at">;

/**
 * Minimal, structurally-typed subset of the supabase-js query builder this
 * layer actually uses. A real `SupabaseClient` satisfies this interface
 * without modification; tests can satisfy it with a small in-memory fake
 * repository instead of a real database (see
 * `tests/playbook-engine-materialization.test.mjs`).
 */
export type MaterializationQueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

export interface MaterializationQueryBuilder<T> {
  select(columns: string): MaterializationQueryBuilder<T>;
  eq(column: string, value: unknown): MaterializationQueryBuilder<T>;
  insert(row: Record<string, unknown>): MaterializationQueryBuilder<T>;
  update(row: Record<string, unknown>): MaterializationQueryBuilder<T>;
  maybeSingle(): MaterializationQueryResult<T>;
  single(): MaterializationQueryResult<T>;
}

export interface MaterializationDbClient {
  from<T = Record<string, unknown>>(table: string): MaterializationQueryBuilder<T>;
}

export type MaterializationFailureClass = "validation_failed" | "persistence_failed";

export type MaterializationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: MaterializationFailureClass };

/** What a snapshot's own upsert reports back, so the caller/service can tell
 * whether it created a brand-new snapshot row or reused an existing one for
 * the same fingerprint (a true no-op — content is deterministic per
 * fingerprint, so there is never anything to refresh on a repeat run). */
export type PlaybookSnapshotMaterializationOutcome = {
  row: PlaybookSnapshotRow;
  created: boolean;
};

/** What a single recommendation's upsert reports back. `preserved` is `true`
 * when the existing row had already left `status: "new"` and the
 * materialization layer therefore left its status/timestamps untouched
 * (content may still have been flagged `content_stale`). */
export type PlaybookRecommendationMaterializationOutcome = {
  row: PlaybookRecommendationRow;
  created: boolean;
  preserved: boolean;
  contentStale: boolean;
};

/** What a single audit event's insert reports back. `deduplicated: true`
 * means a row with this fingerprint already existed and nothing was
 * inserted. */
export type PlaybookAuditEventMaterializationOutcome = {
  row: PlaybookAuditEventRow;
  created: boolean;
  deduplicated: boolean;
};

export type MaterializePlaybookGovernanceSnapshotOptions = {
  /** Optional hash of the `ProjectContextFacts` used to generate the
   * snapshot, stored verbatim in `playbook_snapshots.source_context_hash`.
   * Purely informational — never computed or verified by this layer. */
  sourceContextHash?: string | null;
};

export type MaterializePlaybookGovernanceSnapshotInput = {
  /** Any client structurally compatible with `MaterializationDbClient` — a
   * real `SupabaseClient`, or a test fake. */
  supabase: MaterializationDbClient;
  /** The in-memory snapshot produced by `generatePlaybookGovernanceSnapshot()`
   * (`governance-snapshot-engine.ts`). Never mutated. */
  snapshot: import("./governance-snapshot-types").PlaybookGovernanceSnapshot;
  /** Reserved for a future phase where materialization can be attributed to
   * a specific human actor (e.g. a manually triggered re-evaluation). Not
   * written to any column in Phase 1. */
  actorId?: string | null;
  options?: MaterializePlaybookGovernanceSnapshotOptions;
};

export type PlaybookGovernanceSnapshotMaterializationViewModel = {
  snapshot: PlaybookSnapshotRow;
  snapshotCreated: boolean;
  recommendations: PlaybookRecommendationMaterializationOutcome[];
  auditEvents: PlaybookAuditEventMaterializationOutcome[];
};

export type MaterializePlaybookGovernanceSnapshotResult = MaterializationResult<PlaybookGovernanceSnapshotMaterializationViewModel>;
