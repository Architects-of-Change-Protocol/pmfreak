import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { generateDemoGovernanceSnapshot } from "../src/lib/playbook-engine/index.ts";
import {
  governanceSnapshotToSnapshotRow,
  recommendationToRecommendationRow,
  auditEventToAuditEventRow,
  shouldPreserveHumanState,
  recommendationContentSignature,
  RECOMMENDATION_HUMAN_STATUSES,
} from "../src/lib/playbook-engine/materialization-mappers.ts";
import { materializePlaybookGovernanceSnapshot } from "../src/lib/playbook-engine/materialization-service.ts";

const migration = fs.readFileSync("supabase/migrations/20260816000000_playbook_engine_materialization_phase1.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const mappersSource = fs.readFileSync("src/lib/playbook-engine/materialization-mappers.ts", "utf8");
const serviceSource = fs.readFileSync("src/lib/playbook-engine/materialization-service.ts", "utf8");
const typesSource = fs.readFileSync("src/lib/playbook-engine/materialization-types.ts", "utf8");
const contractCheckScript = fs.readFileSync("scripts/check-db-schema-contract.mjs", "utf8");

// Forbidden-table assertions below check *runtime code*, not documentation —
// this file's own doc comments intentionally name the tables/functions this
// layer must never touch, so comments are stripped before scanning.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const serviceCodeOnly = stripComments(serviceSource);
const mappersCodeOnly = stripComments(mappersSource);

// ─── Migration ──────────────────────────────────────────────────────────────────

test("migration creates playbook_snapshots, playbook_recommendations, playbook_audit_events", () => {
  assert.match(migration, /create table if not exists public\.playbook_snapshots/);
  assert.match(migration, /create table if not exists public\.playbook_recommendations/);
  assert.match(migration, /create table if not exists public\.playbook_audit_events/);
});

test("playbook_snapshots migration has all required columns", () => {
  for (const col of [
    "id", "workspace_id", "project_id", "fingerprint", "playbook_id", "playbook_version",
    "status", "generated_at", "source_context_hash", "rules_summary", "missing_evidence_summary",
    "approval_required_summary", "next_best_actions", "demo_summary", "snapshot_payload",
    "content_stale", "created_at", "updated_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${col}\\b`), `column ${col} missing from migration`);
  }
});

test("playbook_snapshots migration has unique(workspace_id, project_id, fingerprint) and required indexes", () => {
  assert.match(migration, /playbook_snapshots_workspace_project_fingerprint_uidx/);
  assert.match(migration, /playbook_snapshots_workspace_project_idx/);
  assert.match(migration, /playbook_snapshots_project_generated_at_idx/);
});

test("playbook_recommendations migration enforces the 9-state status constraint", () => {
  assert.match(migration, /status text not null default 'new' check \(status in \(/);
  for (const s of [
    "new", "viewed", "accepted", "dismissed", "converted_to_task",
    "converted_to_draft", "requires_approval", "approved", "executed",
  ]) {
    assert.match(migration, new RegExp(`'${s}'`), `status value '${s}' missing`);
  }
});

test("playbook_recommendations migration has required indexes", () => {
  assert.match(migration, /playbook_recommendations_workspace_project_fingerprint_uidx/);
  assert.match(migration, /playbook_recommendations_snapshot_idx/);
  assert.match(migration, /playbook_recommendations_workspace_project_status_idx/);
  assert.match(migration, /playbook_recommendations_project_severity_idx/);
});

test("playbook_audit_events migration has required columns and indexes", () => {
  for (const col of [
    "related_entity_type", "related_entity_id", "fingerprint", "event_type",
    "actor_type", "actor_id", "severity", "summary", "evidence_used",
    "missing_evidence", "approval_required", "metadata", "audit_payload", "created_at",
  ]) {
    assert.match(migration, new RegExp(`\\b${col}\\b`), `column ${col} missing from migration`);
  }
  assert.match(migration, /playbook_audit_events_workspace_project_fingerprint_uidx/);
  assert.match(migration, /playbook_audit_events_snapshot_idx/);
  assert.match(migration, /playbook_audit_events_workspace_project_created_at_idx/);
  assert.match(migration, /playbook_audit_events_event_type_idx/);
  assert.match(migration, /playbook_audit_events_related_entity_idx/);
});

test("playbook_audit_events migration has no update or delete policy (append-only, immutable)", () => {
  const section = migration.slice(migration.indexOf("create table if not exists public.playbook_audit_events"));
  assert.doesNotMatch(section, /for update/);
  assert.doesNotMatch(section, /for delete/);
  assert.match(section, /for insert/);
  assert.match(section, /for select/);
});

test("all three tables enable RLS scoped to workspace membership", () => {
  const matches = migration.match(/is_workspace_member\(workspace_id\)/g) ?? [];
  assert.ok(matches.length >= 6, "expected is_workspace_member checks across snapshots/recommendations/audit_events policies");
});

// ─── Database contract ────────────────────────────────────────────────────────

test("database contract declares row types and selectable columns for all three tables", () => {
  for (const typeName of ["PlaybookSnapshotRow", "PlaybookRecommendationRow", "PlaybookAuditEventRow"]) {
    assert.match(contract, new RegExp(`export type ${typeName}`), `contract must declare ${typeName}`);
  }
  for (const constName of [
    "PLAYBOOK_SNAPSHOT_SELECTABLE_COLUMNS",
    "PLAYBOOK_RECOMMENDATION_SELECTABLE_COLUMNS",
    "PLAYBOOK_AUDIT_EVENT_SELECTABLE_COLUMNS",
  ]) {
    assert.match(contract, new RegExp(constName), `contract must declare ${constName}`);
  }
});

test("check-db-schema-contract.mjs registers the three new tables", () => {
  assert.match(contractCheckScript, /playbook_snapshots: extractDeclaredColumns\("PLAYBOOK_SNAPSHOT_SELECTABLE_COLUMNS"\)/);
  assert.match(contractCheckScript, /playbook_recommendations: extractDeclaredColumns\("PLAYBOOK_RECOMMENDATION_SELECTABLE_COLUMNS"\)/);
  assert.match(contractCheckScript, /playbook_audit_events: extractDeclaredColumns\("PLAYBOOK_AUDIT_EVENT_SELECTABLE_COLUMNS"\)/);
});

// ─── Boundary: materialization layer never touches out-of-scope domains ──────────

test("materialization service never references recommended_actions, task_drafts, or platform_events", () => {
  for (const forbidden of ["recommended_actions", "task_drafts", "platform_events", "createPlatformEvent", "raid_items", "constitutional_decisions"]) {
    assert.doesNotMatch(serviceCodeOnly, new RegExp(forbidden), `materialization-service.ts must not reference ${forbidden}`);
    assert.doesNotMatch(mappersCodeOnly, new RegExp(forbidden), `materialization-mappers.ts must not reference ${forbidden}`);
  }
});

test("materialization service never writes communication/operational/closure/billing draft tables", () => {
  for (const forbidden of [
    "playbook_communication_drafts",
    "playbook_operational_drafts",
    "playbook_closure_billing_assessments",
    "playbook_closure_blockers",
    "playbook_billing_blockers",
  ]) {
    assert.doesNotMatch(serviceCodeOnly, new RegExp(forbidden));
  }
});

test("materialization service only ever calls .from() on the three Phase 1 tables", () => {
  const fromCalls = [...serviceCodeOnly.matchAll(/\.from<[^>]*>\("([a-z_]+)"\)/g)].map((m) => m[1]);
  assert.ok(fromCalls.length > 0, "expected at least one .from() call");
  for (const table of fromCalls) {
    assert.ok(
      ["playbook_snapshots", "playbook_recommendations", "playbook_audit_events"].includes(table),
      `unexpected table referenced: ${table}`,
    );
  }
});

// ─── Mapper tests (pure) ──────────────────────────────────────────────────────

function firstFixtureSnapshot() {
  const result = generateDemoGovernanceSnapshot("pending_reception_billing_blocker");
  assert.equal(result.ok, true, "demo scenario must generate successfully");
  return result.data;
}

test("governanceSnapshotToSnapshotRow produces a row with workspace_id/project_id/fingerprint", () => {
  const snapshot = firstFixtureSnapshot();
  const row = governanceSnapshotToSnapshotRow(snapshot);
  assert.equal(row.workspace_id, snapshot.workspaceId);
  assert.equal(row.project_id, snapshot.projectId);
  assert.equal(row.fingerprint, snapshot.fingerprint);
  assert.equal(row.playbook_id, snapshot.playbookId);
  assert.equal(row.playbook_version, String(snapshot.playbookVersion));
  assert.equal(row.status, "generated");
  assert.equal(row.content_stale, false);
});

test("governanceSnapshotToSnapshotRow accepts an optional sourceContextHash", () => {
  const snapshot = firstFixtureSnapshot();
  const row = governanceSnapshotToSnapshotRow(snapshot, { sourceContextHash: "abc123" });
  assert.equal(row.source_context_hash, "abc123");
  const rowWithoutHash = governanceSnapshotToSnapshotRow(snapshot);
  assert.equal(rowWithoutHash.source_context_hash, null);
});

test("recommendationToRecommendationRow produces a row with status 'new' by default", () => {
  const snapshot = firstFixtureSnapshot();
  assert.ok(snapshot.recommendations.length > 0, "fixture must generate at least one recommendation");
  const recommendation = snapshot.recommendations[0];
  const row = recommendationToRecommendationRow(recommendation, "snapshot-id-1");
  assert.equal(row.status, "new");
  assert.equal(row.workspace_id, recommendation.workspaceId);
  assert.equal(row.project_id, recommendation.projectId);
  assert.equal(row.fingerprint, recommendation.fingerprint);
  assert.equal(row.snapshot_id, "snapshot-id-1");
  assert.equal(row.viewed_at, null);
  assert.equal(row.dismissed_at, null);
});

test("auditEventToAuditEventRow produces a row with relatedEntityType/relatedEntityId", () => {
  const snapshot = firstFixtureSnapshot();
  assert.ok(snapshot.auditEvents.length > 0, "fixture must generate at least one audit event");
  const event = snapshot.auditEvents[0];
  const row = auditEventToAuditEventRow(event, "snapshot-id-1");
  assert.equal(row.related_entity_type, event.relatedEntityType);
  assert.equal(row.related_entity_id, event.relatedEntityId);
  assert.equal(row.fingerprint, event.fingerprint);
  assert.equal(row.event_type, event.eventType);
  assert.equal(row.snapshot_id, "snapshot-id-1");
});

test("shouldPreserveHumanState is true for dismissed/approved/executed and false for new", () => {
  assert.equal(shouldPreserveHumanState({ status: "dismissed" }), true);
  assert.equal(shouldPreserveHumanState({ status: "approved" }), true);
  assert.equal(shouldPreserveHumanState({ status: "executed" }), true);
  assert.equal(shouldPreserveHumanState({ status: "viewed" }), true);
  assert.equal(shouldPreserveHumanState({ status: "accepted" }), true);
  assert.equal(shouldPreserveHumanState({ status: "converted_to_task" }), true);
  assert.equal(shouldPreserveHumanState({ status: "converted_to_draft" }), true);
  assert.equal(shouldPreserveHumanState({ status: "requires_approval" }), true);
  assert.equal(shouldPreserveHumanState({ status: "new" }), false);
  assert.equal(shouldPreserveHumanState(null), false);
  assert.equal(shouldPreserveHumanState(undefined), false);
});

test("RECOMMENDATION_HUMAN_STATUSES covers exactly the 8 non-'new' statuses", () => {
  assert.equal(RECOMMENDATION_HUMAN_STATUSES.length, 8);
  assert.ok(!RECOMMENDATION_HUMAN_STATUSES.includes("new"));
});

test("recommendationContentSignature ignores volatile id/status/timestamps but reflects content changes", () => {
  const snapshot = firstFixtureSnapshot();
  const recommendation = snapshot.recommendations[0];
  const clonedSameContent = { ...recommendation, id: "different-id", updatedAt: "2099-01-01T00:00:00.000Z", status: "viewed" };
  assert.equal(recommendationContentSignature(recommendation), recommendationContentSignature(clonedSameContent));

  const clonedDifferentContent = { ...recommendation, title: `${recommendation.title} (updated)` };
  assert.notEqual(recommendationContentSignature(recommendation), recommendationContentSignature(clonedDifferentContent));
});

// ─── Mock repository tests (no real DB) ──────────────────────────────────────────

function createFakeSupabase(seed = {}) {
  const store = {
    playbook_snapshots: [...(seed.playbook_snapshots ?? [])],
    playbook_recommendations: [...(seed.playbook_recommendations ?? [])],
    playbook_audit_events: [...(seed.playbook_audit_events ?? [])],
  };
  let idCounter = 1;
  const calledTables = new Set();

  function nextId() {
    return `fake-id-${idCounter++}`;
  }

  function rowMatches(row, filters) {
    return filters.every(([col, val]) => row[col] === val);
  }

  function makeBuilder(table) {
    let filters = [];
    let pendingInsert = null;
    let pendingUpdate = null;

    const builder = {
      select() {
        return builder;
      },
      eq(col, val) {
        filters.push([col, val]);
        return builder;
      },
      insert(row) {
        pendingInsert = row;
        return builder;
      },
      update(row) {
        pendingUpdate = row;
        return builder;
      },
      async maybeSingle() {
        return terminal();
      },
      async single() {
        const result = terminal();
        if (!pendingInsert && !pendingUpdate && result.data === null) {
          return { data: null, error: { message: `not found in ${table}` } };
        }
        return result;
      },
    };

    function terminal() {
      if (pendingInsert) {
        const now = new Date().toISOString();
        const full = { id: nextId(), created_at: now, ...pendingInsert };
        if (table !== "playbook_audit_events") full.updated_at = now;
        store[table].push(full);
        return { data: full, error: null };
      }
      if (pendingUpdate) {
        const idx = store[table].findIndex((row) => rowMatches(row, filters));
        if (idx === -1) return { data: null, error: null };
        store[table][idx] = { ...store[table][idx], ...pendingUpdate, updated_at: new Date().toISOString() };
        return { data: store[table][idx], error: null };
      }
      const found = store[table].find((row) => rowMatches(row, filters));
      return { data: found ?? null, error: null };
    }

    return builder;
  }

  return {
    store,
    calledTables,
    from(table) {
      calledTables.add(table);
      return makeBuilder(table);
    },
  };
}

test("materialization is idempotent with the same fingerprint (no duplicate rows, no content change)", async () => {
  const snapshot = firstFixtureSnapshot();
  const supabase = createFakeSupabase();

  const first = await materializePlaybookGovernanceSnapshot({ supabase, snapshot });
  assert.equal(first.ok, true);
  assert.equal(first.data.snapshotCreated, true);

  const second = await materializePlaybookGovernanceSnapshot({ supabase, snapshot });
  assert.equal(second.ok, true);
  assert.equal(second.data.snapshotCreated, false, "re-running with the same fingerprint must not create a new snapshot row");
  assert.equal(second.data.snapshot.id, first.data.snapshot.id);

  assert.equal(supabase.store.playbook_snapshots.length, 1);
  assert.equal(supabase.store.playbook_recommendations.length, snapshot.recommendations.length);
  assert.equal(supabase.store.playbook_audit_events.length, snapshot.auditEvents.length);

  for (const outcome of second.data.recommendations) {
    assert.equal(outcome.created, false);
  }
  for (const outcome of second.data.auditEvents) {
    assert.equal(outcome.created, false);
    assert.equal(outcome.deduplicated, true);
  }
});

test("materialization preserves a dismissed recommendation's status and timestamps", async () => {
  const snapshot = firstFixtureSnapshot();
  const recommendation = snapshot.recommendations[0];
  const dismissedAt = "2026-01-01T00:00:00.000Z";

  const supabase = createFakeSupabase({
    playbook_recommendations: [
      {
        id: "existing-rec-1",
        workspace_id: recommendation.workspaceId,
        project_id: recommendation.projectId,
        snapshot_id: null,
        fingerprint: recommendation.fingerprint,
        playbook_rule_id: recommendation.playbookRuleId,
        title: recommendation.title,
        status: "dismissed",
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
        viewed_at: dismissedAt,
        accepted_at: null,
        dismissed_at: dismissedAt,
        approved_at: null,
        executed_at: null,
        reviewed_by: null,
        approved_by: null,
        created_at: dismissedAt,
        updated_at: dismissedAt,
      },
    ],
  });

  const result = await materializePlaybookGovernanceSnapshot({ supabase, snapshot });
  assert.equal(result.ok, true);

  const persisted = result.data.recommendations.find((r) => r.row.fingerprint === recommendation.fingerprint);
  assert.ok(persisted);
  assert.equal(persisted.preserved, true);
  assert.equal(persisted.row.status, "dismissed");
  assert.equal(persisted.row.dismissed_at, dismissedAt);
  assert.equal(persisted.row.id, "existing-rec-1");
});

test("materialization never relaxes approval_required, even while status is still 'new'", async () => {
  const snapshot = firstFixtureSnapshot();
  const recommendation = { ...snapshot.recommendations[0], approvalRequired: false };

  const supabase = createFakeSupabase({
    playbook_recommendations: [
      {
        id: "existing-rec-2",
        workspace_id: recommendation.workspaceId,
        project_id: recommendation.projectId,
        snapshot_id: null,
        fingerprint: recommendation.fingerprint,
        playbook_rule_id: recommendation.playbookRuleId,
        title: recommendation.title,
        status: "new",
        severity: recommendation.severity,
        phase: recommendation.phase,
        detected_situation: recommendation.detectedSituation,
        recommended_action: recommendation.recommendedAction,
        approval_required: true,
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
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const snapshotWithMutatedRecommendation = { ...snapshot, recommendations: [recommendation, ...snapshot.recommendations.slice(1)] };
  const result = await materializePlaybookGovernanceSnapshot({ supabase, snapshot: snapshotWithMutatedRecommendation });
  assert.equal(result.ok, true);

  const persisted = result.data.recommendations.find((r) => r.row.fingerprint === recommendation.fingerprint);
  assert.ok(persisted);
  assert.equal(persisted.row.approval_required, true, "approval_required must never flip from true to false");
});

test("materialization marks content_stale when a preserved recommendation's payload changes", async () => {
  const snapshot = firstFixtureSnapshot();
  const originalRecommendation = snapshot.recommendations[0];
  const updatedRecommendation = { ...originalRecommendation, title: `${originalRecommendation.title} — changed evidence` };

  const supabase = createFakeSupabase({
    playbook_recommendations: [
      {
        id: "existing-rec-3",
        workspace_id: originalRecommendation.workspaceId,
        project_id: originalRecommendation.projectId,
        snapshot_id: null,
        fingerprint: originalRecommendation.fingerprint,
        playbook_rule_id: originalRecommendation.playbookRuleId,
        title: originalRecommendation.title,
        status: "accepted",
        severity: originalRecommendation.severity,
        phase: originalRecommendation.phase,
        detected_situation: originalRecommendation.detectedSituation,
        recommended_action: originalRecommendation.recommendedAction,
        approval_required: originalRecommendation.approvalRequired,
        evidence_used: originalRecommendation.evidenceUsed,
        missing_evidence: originalRecommendation.missingEvidence,
        suggested_actions: originalRecommendation.suggestedActions,
        explanation: originalRecommendation.explanation,
        recommendation_payload: originalRecommendation,
        content_stale: false,
        viewed_at: "2026-01-01T00:00:00.000Z",
        accepted_at: "2026-01-01T00:00:00.000Z",
        dismissed_at: null,
        approved_at: null,
        executed_at: null,
        reviewed_by: null,
        approved_by: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const snapshotWithChangedRecommendation = {
    ...snapshot,
    recommendations: [updatedRecommendation, ...snapshot.recommendations.slice(1)],
  };
  const result = await materializePlaybookGovernanceSnapshot({ supabase, snapshot: snapshotWithChangedRecommendation });
  assert.equal(result.ok, true);

  const persisted = result.data.recommendations.find((r) => r.row.fingerprint === originalRecommendation.fingerprint);
  assert.ok(persisted);
  assert.equal(persisted.preserved, true);
  assert.equal(persisted.row.status, "accepted", "status must remain untouched");
  assert.equal(persisted.row.title, originalRecommendation.title, "content must remain untouched");
  assert.equal(persisted.contentStale, true);
  assert.equal(persisted.row.content_stale, true);
});

test("audit events deduplicate by fingerprint (no duplicate insert on rerun)", async () => {
  const snapshot = firstFixtureSnapshot();
  const event = snapshot.auditEvents[0];

  const supabase = createFakeSupabase({
    playbook_audit_events: [
      {
        id: "existing-event-1",
        workspace_id: event.workspaceId,
        project_id: event.projectId,
        snapshot_id: null,
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
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const result = await materializePlaybookGovernanceSnapshot({ supabase, snapshot });
  assert.equal(result.ok, true);

  const persisted = result.data.auditEvents.find((e) => e.row.fingerprint === event.fingerprint);
  assert.ok(persisted);
  assert.equal(persisted.created, false);
  assert.equal(persisted.deduplicated, true);
  assert.equal(persisted.row.id, "existing-event-1");

  const duplicates = supabase.store.playbook_audit_events.filter((row) => row.fingerprint === event.fingerprint);
  assert.equal(duplicates.length, 1, "must never insert a second row for the same audit event fingerprint");
});

test("mock repository run never calls .from() on recommended_actions, task_drafts, or platform_events", async () => {
  const snapshot = firstFixtureSnapshot();
  const supabase = createFakeSupabase();
  const result = await materializePlaybookGovernanceSnapshot({ supabase, snapshot });
  assert.equal(result.ok, true);

  assert.ok(supabase.calledTables.has("playbook_snapshots"));
  assert.ok(supabase.calledTables.has("playbook_recommendations"));
  for (const forbidden of ["recommended_actions", "task_drafts", "platform_events"]) {
    assert.ok(!supabase.calledTables.has(forbidden));
  }
});

test("materialization rejects a snapshot missing workspaceId or projectId", async () => {
  const snapshot = firstFixtureSnapshot();
  const supabase = createFakeSupabase();

  const missingWorkspace = await materializePlaybookGovernanceSnapshot({ supabase, snapshot: { ...snapshot, workspaceId: "" } });
  assert.equal(missingWorkspace.ok, false);
  assert.equal(missingWorkspace.failureClass, "validation_failed");

  const missingProject = await materializePlaybookGovernanceSnapshot({ supabase, snapshot: { ...snapshot, projectId: "" } });
  assert.equal(missingProject.ok, false);
  assert.equal(missingProject.failureClass, "validation_failed");
});

// ─── Types file sanity ────────────────────────────────────────────────────────

test("materialization-types.ts declares the DB client duck-type and result types", () => {
  assert.match(typesSource, /export interface MaterializationDbClient/);
  assert.match(typesSource, /export interface MaterializationQueryBuilder/);
  assert.match(typesSource, /export type MaterializePlaybookGovernanceSnapshotInput/);
  assert.match(typesSource, /export type MaterializePlaybookGovernanceSnapshotResult/);
});
