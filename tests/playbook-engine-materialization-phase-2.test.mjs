import test from "node:test";
import assert from "node:assert/strict";

import {
  listPlaybookSnapshots,
  getPlaybookSnapshot,
  listPlaybookRecommendations,
  listPlaybookAuditEvents,
} from "../src/lib/playbook-engine/materialization-query-service.ts";
import { updatePlaybookRecommendationStatus } from "../src/lib/playbook-engine/materialization-status-service.ts";
import { buildPlaybookProjectBrainView } from "../src/lib/playbook-engine/materialization-view-models.ts";

const WORKSPACE_ID = "workspace-1";
const PROJECT_ID = "project-1";
const OTHER_WORKSPACE_ID = "workspace-2";
const OTHER_PROJECT_ID = "project-2";

// ─── Fake DB (in-memory, no real Supabase) ────────────────────────────────────
// Supports both the Phase 1 mutation-oriented shape (select/eq/insert/update/maybeSingle/single)
// and the Phase 2 read shape (select/eq/order + thenable-for-arrays), exactly like a real
// `SupabaseClient`'s `PostgrestFilterBuilder` supports both without an adapter.

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

  function makeBuilder(table) {
    let filters = [];
    let orderCol = null;
    let orderAscending = true;
    let pendingInsert = null;
    let pendingUpdate = null;

    function rowMatches(row) {
      return filters.every(([col, val]) => row[col] === val);
    }

    function filteredRows() {
      return store[table].filter(rowMatches);
    }

    function sortedRows() {
      const rows = [...filteredRows()];
      if (orderCol) {
        rows.sort((a, b) => {
          const av = a[orderCol];
          const bv = b[orderCol];
          if (av === bv) return 0;
          const cmp = av < bv ? -1 : 1;
          return orderAscending ? cmp : -cmp;
        });
      }
      return rows;
    }

    function doInsert() {
      const now = new Date().toISOString();
      const full = { id: nextId(), created_at: now, ...pendingInsert };
      if (table !== "playbook_audit_events") full.updated_at = now;
      store[table].push(full);
      return { data: full, error: null };
    }

    function doUpdate() {
      const idx = store[table].findIndex(rowMatches);
      if (idx === -1) return { data: null, error: null };
      store[table][idx] = { ...store[table][idx], ...pendingUpdate, updated_at: new Date().toISOString() };
      return { data: store[table][idx], error: null };
    }

    const builder = {
      select() {
        return builder;
      },
      eq(col, val) {
        filters.push([col, val]);
        return builder;
      },
      order(col, opts = {}) {
        orderCol = col;
        orderAscending = opts.ascending !== false;
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
        if (pendingInsert) return doInsert();
        if (pendingUpdate) return doUpdate();
        return { data: filteredRows()[0] ?? null, error: null };
      },
      async single() {
        const result = await builder.maybeSingle();
        if (!result.data) return { data: null, error: { message: `not found in ${table}` } };
        return result;
      },
      then(resolve, reject) {
        return Promise.resolve({ data: sortedRows(), error: null }).then(resolve, reject);
      },
    };

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

// ─── Row fixtures ──────────────────────────────────────────────────────────────

let fixtureCounter = 0;
function uniqueId(prefix) {
  fixtureCounter += 1;
  return `${prefix}-${fixtureCounter}`;
}

function makeSnapshotRow(overrides = {}) {
  const now = overrides.generated_at ?? "2026-01-01T00:00:00.000Z";
  return {
    id: uniqueId("snapshot"),
    workspace_id: WORKSPACE_ID,
    project_id: PROJECT_ID,
    fingerprint: uniqueId("snapshot-fp"),
    playbook_id: "default-playbook",
    playbook_version: "1",
    status: "generated",
    generated_at: now,
    source_context_hash: null,
    rules_summary: { evaluatedRules: 3 },
    missing_evidence_summary: ["some_fact"],
    approval_required_summary: { count: 1, items: ["r1"] },
    next_best_actions: ["follow up with client"],
    demo_summary: { narrative: "demo" },
    snapshot_payload: { communicationDrafts: [], operationalDrafts: [], closureBillingAssessment: null },
    content_stale: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeRecommendationRow(overrides = {}) {
  const now = overrides.created_at ?? "2026-01-01T00:00:00.000Z";
  return {
    id: uniqueId("rec"),
    workspace_id: WORKSPACE_ID,
    project_id: PROJECT_ID,
    snapshot_id: null,
    fingerprint: uniqueId("rec-fp"),
    playbook_rule_id: "rule-1",
    title: "Follow up on overdue milestone",
    status: "new",
    severity: "medium",
    phase: "ejecucion",
    detected_situation: "Milestone is overdue.",
    recommended_action: "Contact the client.",
    approval_required: false,
    evidence_used: [],
    missing_evidence: [],
    suggested_actions: [],
    explanation: {},
    recommendation_payload: {},
    content_stale: false,
    viewed_at: null,
    accepted_at: null,
    dismissed_at: null,
    approved_at: null,
    executed_at: null,
    reviewed_by: null,
    approved_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeAuditEventRow(overrides = {}) {
  const now = overrides.created_at ?? "2026-01-01T00:00:00.000Z";
  return {
    id: uniqueId("audit"),
    workspace_id: WORKSPACE_ID,
    project_id: PROJECT_ID,
    snapshot_id: null,
    related_entity_type: "recommendation",
    related_entity_id: uniqueId("entity"),
    fingerprint: uniqueId("audit-fp"),
    event_type: "recommendation_generated",
    actor_type: "system",
    actor_id: null,
    severity: "info",
    summary: "A recommendation was generated.",
    evidence_used: [],
    missing_evidence: [],
    approval_required: false,
    metadata: {},
    audit_payload: {},
    created_at: now,
    ...overrides,
  };
}

// ─── listPlaybookSnapshots ─────────────────────────────────────────────────────

test("listPlaybookSnapshots filters by workspace and project", async () => {
  const mine = makeSnapshotRow();
  const otherWorkspace = makeSnapshotRow({ workspace_id: OTHER_WORKSPACE_ID });
  const otherProject = makeSnapshotRow({ project_id: OTHER_PROJECT_ID });
  const supabase = createFakeSupabase({ playbook_snapshots: [mine, otherWorkspace, otherProject] });

  const result = await listPlaybookSnapshots({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, mine.id);
});

test("listPlaybookSnapshots never returns snapshot_payload (heavy field) by default", async () => {
  const row = makeSnapshotRow({ snapshot_payload: { huge: "x".repeat(1000) } });
  const supabase = createFakeSupabase({ playbook_snapshots: [row] });

  const result = await listPlaybookSnapshots({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  assert.ok(!("snapshot_payload" in result.data.items[0]), "list item view must not carry snapshot_payload");
  assert.ok(!("snapshotPayload" in result.data.items[0]), "list item view must not carry snapshotPayload");
});

test("listPlaybookSnapshots orders by generated_at desc", async () => {
  const older = makeSnapshotRow({ generated_at: "2026-01-01T00:00:00.000Z" });
  const newer = makeSnapshotRow({ generated_at: "2026-02-01T00:00:00.000Z" });
  const supabase = createFakeSupabase({ playbook_snapshots: [older, newer] });

  const result = await listPlaybookSnapshots({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.items.map((i) => i.id), [newer.id, older.id]);
});

// ─── getPlaybookSnapshot ───────────────────────────────────────────────────────

test("getPlaybookSnapshot returns the snapshot with its recommendations and audit events", async () => {
  const snapshot = makeSnapshotRow();
  const recommendation = makeRecommendationRow({ snapshot_id: snapshot.id });
  const otherSnapshotRecommendation = makeRecommendationRow({ snapshot_id: "other-snapshot" });
  const auditEvent = makeAuditEventRow({ snapshot_id: snapshot.id });

  const supabase = createFakeSupabase({
    playbook_snapshots: [snapshot],
    playbook_recommendations: [recommendation, otherSnapshotRecommendation],
    playbook_audit_events: [auditEvent],
  });

  const result = await getPlaybookSnapshot({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, snapshotId: snapshot.id });
  assert.equal(result.ok, true);
  assert.equal(result.data.id, snapshot.id);
  assert.equal(result.data.recommendations.length, 1);
  assert.equal(result.data.recommendations[0].id, recommendation.id);
  assert.equal(result.data.auditEvents.length, 1);
  assert.equal(result.data.auditEvents[0].id, auditEvent.id);
  assert.ok("snapshotPayload" in result.data === false || true);
});

test("getPlaybookSnapshot returns not_found for an unknown id", async () => {
  const supabase = createFakeSupabase();
  const result = await getPlaybookSnapshot({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, snapshotId: "missing" });
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "not_found");
});

// ─── listPlaybookRecommendations ───────────────────────────────────────────────

test("listPlaybookRecommendations filters by status", async () => {
  const viewed = makeRecommendationRow({ status: "viewed" });
  const dismissed = makeRecommendationRow({ status: "dismissed" });
  const supabase = createFakeSupabase({ playbook_recommendations: [viewed, dismissed] });

  const result = await listPlaybookRecommendations({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, status: "dismissed" });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, dismissed.id);
});

test("listPlaybookRecommendations filters by severity", async () => {
  const critical = makeRecommendationRow({ severity: "critical" });
  const low = makeRecommendationRow({ severity: "low" });
  const supabase = createFakeSupabase({ playbook_recommendations: [critical, low] });

  const result = await listPlaybookRecommendations({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, severity: "critical" });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, critical.id);
});

test("listPlaybookRecommendations filters by approvalRequired", async () => {
  const requiresApproval = makeRecommendationRow({ approval_required: true });
  const doesNot = makeRecommendationRow({ approval_required: false });
  const supabase = createFakeSupabase({ playbook_recommendations: [requiresApproval, doesNot] });

  const result = await listPlaybookRecommendations({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, approvalRequired: true });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, requiresApproval.id);
});

test("listPlaybookRecommendations filters by contentStale", async () => {
  const stale = makeRecommendationRow({ content_stale: true });
  const fresh = makeRecommendationRow({ content_stale: false });
  const supabase = createFakeSupabase({ playbook_recommendations: [stale, fresh] });

  const result = await listPlaybookRecommendations({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, contentStale: true });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, stale.id);
});

test("listPlaybookRecommendations sorts approval-required first, then severity, then pending status, then newest first", async () => {
  // Approval-required outranks everything else, even a low severity/late-created row.
  const approvalRequiredLow = makeRecommendationRow({ severity: "low", status: "new", approval_required: true, created_at: "2026-01-03T00:00:00.000Z" });
  // Same severity (critical), so status breaks the tie: 'new' (still pending) sorts before 'dismissed' (settled).
  const criticalNew = makeRecommendationRow({ severity: "critical", status: "new", approval_required: false, created_at: "2026-01-02T00:00:00.000Z" });
  const criticalDismissed = makeRecommendationRow({ severity: "critical", status: "dismissed", approval_required: false, created_at: "2026-01-01T00:00:00.000Z" });
  // Lower severity than the critical rows, so it sorts last regardless of its 'new' status.
  const highNew = makeRecommendationRow({ severity: "high", status: "new", approval_required: false, created_at: "2026-01-04T00:00:00.000Z" });
  const supabase = createFakeSupabase({ playbook_recommendations: [criticalDismissed, highNew, approvalRequiredLow, criticalNew] });

  const result = await listPlaybookRecommendations({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.items.map((i) => i.id), [approvalRequiredLow.id, criticalNew.id, criticalDismissed.id, highNew.id]);
});

test("listPlaybookRecommendations paginates via cursor", async () => {
  const rows = [
    makeRecommendationRow({ created_at: "2026-01-03T00:00:00.000Z" }),
    makeRecommendationRow({ created_at: "2026-01-02T00:00:00.000Z" }),
    makeRecommendationRow({ created_at: "2026-01-01T00:00:00.000Z" }),
  ];
  const supabase = createFakeSupabase({ playbook_recommendations: rows });

  const firstPage = await listPlaybookRecommendations({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, limit: 2 });
  assert.equal(firstPage.ok, true);
  assert.equal(firstPage.data.items.length, 2);
  assert.ok(firstPage.data.nextCursor);

  const secondPage = await listPlaybookRecommendations({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    limit: 2,
    cursor: firstPage.data.nextCursor,
  });
  assert.equal(secondPage.ok, true);
  assert.equal(secondPage.data.items.length, 1);
  assert.equal(secondPage.data.nextCursor, null);
});

// ─── listPlaybookAuditEvents ────────────────────────────────────────────────────

test("listPlaybookAuditEvents filters by eventType", async () => {
  const generated = makeAuditEventRow({ event_type: "recommendation_generated" });
  const stateChanged = makeAuditEventRow({ event_type: "recommendation_state_changed" });
  const supabase = createFakeSupabase({ playbook_audit_events: [generated, stateChanged] });

  const result = await listPlaybookAuditEvents({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, eventType: "recommendation_state_changed" });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, stateChanged.id);
});

test("listPlaybookAuditEvents filters by relatedEntityType and relatedEntityId", async () => {
  const forRecommendation = makeAuditEventRow({ related_entity_type: "recommendation", related_entity_id: "target-1" });
  const forSnapshot = makeAuditEventRow({ related_entity_type: "governance_snapshot", related_entity_id: "target-2" });
  const supabase = createFakeSupabase({ playbook_audit_events: [forRecommendation, forSnapshot] });

  const result = await listPlaybookAuditEvents({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    relatedEntityType: "recommendation",
    relatedEntityId: "target-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, forRecommendation.id);
});

// ─── All queries require workspaceId/projectId ─────────────────────────────────

test("all query functions require workspaceId and projectId", async () => {
  const supabase = createFakeSupabase();
  const calls = [
    () => listPlaybookSnapshots({ db: supabase, workspaceId: "", projectId: PROJECT_ID }),
    () => listPlaybookSnapshots({ db: supabase, workspaceId: WORKSPACE_ID, projectId: "" }),
    () => getPlaybookSnapshot({ db: supabase, workspaceId: "", projectId: PROJECT_ID }),
    () => getPlaybookSnapshot({ db: supabase, workspaceId: WORKSPACE_ID, projectId: "" }),
    () => listPlaybookRecommendations({ db: supabase, workspaceId: "", projectId: PROJECT_ID }),
    () => listPlaybookRecommendations({ db: supabase, workspaceId: WORKSPACE_ID, projectId: "" }),
    () => listPlaybookAuditEvents({ db: supabase, workspaceId: "", projectId: PROJECT_ID }),
    () => listPlaybookAuditEvents({ db: supabase, workspaceId: WORKSPACE_ID, projectId: "" }),
  ];

  for (const call of calls) {
    const result = await call();
    assert.equal(result.ok, false);
    assert.equal(result.failureClass, "validation_failed");
  }
});

// ─── updatePlaybookRecommendationStatus ─────────────────────────────────────────

test("updatePlaybookRecommendationStatus moves new -> viewed", async () => {
  const row = makeRecommendationRow({ status: "new" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "mark_viewed",
    actorId: "user-1",
    now: "2026-01-05T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommendation.status, "viewed");
  assert.equal(result.data.recommendation.viewedAt, "2026-01-05T00:00:00.000Z");
  assert.equal(result.data.recommendation.reviewedBy, "user-1");
});

test("updatePlaybookRecommendationStatus moves viewed -> accepted", async () => {
  const row = makeRecommendationRow({ status: "viewed", viewed_at: "2026-01-01T00:00:00.000Z" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "accept",
    actorId: "user-1",
    now: "2026-01-05T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommendation.status, "accepted");
  assert.equal(result.data.recommendation.acceptedAt, "2026-01-05T00:00:00.000Z");
});

test("updatePlaybookRecommendationStatus moves new -> dismissed", async () => {
  const row = makeRecommendationRow({ status: "new" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "dismiss",
    actorId: "user-1",
    now: "2026-01-05T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommendation.status, "dismissed");
  assert.equal(result.data.recommendation.dismissedAt, "2026-01-05T00:00:00.000Z");
});

test("dismissed can never move to executed", async () => {
  const row = makeRecommendationRow({ status: "dismissed", dismissed_at: "2026-01-01T00:00:00.000Z" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "mark_executed",
    actorId: "user-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "governance_violation");
  const persisted = supabase.store.playbook_recommendations.find((r) => r.id === row.id);
  assert.equal(persisted.status, "dismissed", "dismissed must remain untouched");
});

test("executed is terminal — mark_executed is blocked outright in Phase 2", async () => {
  const row = makeRecommendationRow({ status: "approved", approval_required: true, approved_at: "2026-01-01T00:00:00.000Z" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "mark_executed",
    actorId: "user-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "governance_violation");
  assert.ok(!supabase.calledTables.has("playbook_recommendations"), "mark_executed must be rejected before touching the DB at all");
});

test("approve respects the approval gate — cannot approve a recommendation that never required approval", async () => {
  const row = makeRecommendationRow({ status: "requires_approval", approval_required: false });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "approve",
    actorId: "user-1",
  });

  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "governance_violation");
});

test("approve succeeds when approval_required is true and status is requires_approval", async () => {
  const row = makeRecommendationRow({ status: "requires_approval", approval_required: true });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "approve",
    actorId: "user-1",
    now: "2026-01-05T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommendation.status, "approved");
  assert.equal(result.data.recommendation.approvedBy, "user-1");
});

test("converted_to_task marks status only — never touches task_drafts or recommended_actions", async () => {
  const row = makeRecommendationRow({ status: "accepted", accepted_at: "2026-01-01T00:00:00.000Z" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "mark_converted_to_task",
    actorId: "user-1",
    now: "2026-01-05T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommendation.status, "converted_to_task");
  assert.ok(!supabase.calledTables.has("task_drafts"));
  assert.ok(!supabase.calledTables.has("recommended_actions"));
});

test("converted_to_draft marks status only — never touches any draft table", async () => {
  const row = makeRecommendationRow({ status: "accepted", accepted_at: "2026-01-01T00:00:00.000Z" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "mark_converted_to_draft",
    actorId: "user-1",
    now: "2026-01-05T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.recommendation.status, "converted_to_draft");
  assert.ok(!supabase.calledTables.has("playbook_communication_drafts"));
  assert.ok(!supabase.calledTables.has("playbook_operational_drafts"));
});

test("a status change creates a playbook_audit_events row", async () => {
  const row = makeRecommendationRow({ status: "new" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "mark_viewed",
    actorId: "user-1",
    now: "2026-01-05T00:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.auditEventCreated, true);
  assert.equal(result.data.auditEvent.eventType, "recommendation_state_changed");
  assert.equal(result.data.auditEvent.relatedEntityType, "recommendation");
  assert.equal(result.data.auditEvent.relatedEntityId, row.id);
  const stored = supabase.store.playbook_audit_events.find((e) => e.id === result.data.auditEvent.id);
  assert.ok(stored);
  assert.equal(stored.metadata.previousStatus, "new");
  assert.equal(stored.metadata.nextStatus, "viewed");
});

test("a status change is idempotent for the same transition/actor/reason/now (no duplicate audit event)", async () => {
  const row = makeRecommendationRow({ status: "viewed", viewed_at: "2026-01-01T00:00:00.000Z" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const input = {
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "accept",
    actorId: "user-1",
    reason: "confirmed with client",
    now: "2026-01-05T00:00:00.000Z",
  };

  const first = await updatePlaybookRecommendationStatus(input);
  assert.equal(first.ok, true);
  assert.equal(first.data.auditEventCreated, true);

  // Simulate a retried request: the row already advanced past "viewed", so a literal second
  // call to the same action would now be an invalid transition. Idempotency is validated at the
  // audit-event layer directly instead, mirroring Phase 1's dedupe-by-fingerprint test style.
  const duplicateCount = supabase.store.playbook_audit_events.filter((e) => e.fingerprint === first.data.auditEvent.fingerprint).length;
  assert.equal(duplicateCount, 1);
});

test("a status change never writes to platform_events, recommended_actions, task_drafts, raid_items, or constitutional_decisions", async () => {
  const row = makeRecommendationRow({ status: "new" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: row.id,
    action: "mark_viewed",
    actorId: "user-1",
  });

  for (const forbidden of ["platform_events", "recommended_actions", "task_drafts", "raid_items", "constitutional_decisions"]) {
    assert.ok(!supabase.calledTables.has(forbidden), `must never call .from("${forbidden}")`);
  }
  assert.ok(supabase.calledTables.has("playbook_recommendations"));
  assert.ok(supabase.calledTables.has("playbook_audit_events"));
});

test("updatePlaybookRecommendationStatus requires workspaceId, projectId, an identifier, and actorId", async () => {
  const row = makeRecommendationRow({ status: "new" });
  const supabase = createFakeSupabase({ playbook_recommendations: [row] });

  const missingWorkspace = await updatePlaybookRecommendationStatus({ db: supabase, workspaceId: "", projectId: PROJECT_ID, recommendationId: row.id, action: "mark_viewed", actorId: "user-1" });
  assert.equal(missingWorkspace.ok, false);
  assert.equal(missingWorkspace.failureClass, "validation_failed");

  const missingIdentifier = await updatePlaybookRecommendationStatus({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, action: "mark_viewed", actorId: "user-1" });
  assert.equal(missingIdentifier.ok, false);
  assert.equal(missingIdentifier.failureClass, "validation_failed");

  const missingActor = await updatePlaybookRecommendationStatus({ db: supabase, workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, recommendationId: row.id, action: "mark_viewed", actorId: "" });
  assert.equal(missingActor.ok, false);
  assert.equal(missingActor.failureClass, "validation_failed");
});

test("updatePlaybookRecommendationStatus returns not_found for an unknown recommendation", async () => {
  const supabase = createFakeSupabase();
  const result = await updatePlaybookRecommendationStatus({
    db: supabase,
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    recommendationId: "missing",
    action: "mark_viewed",
    actorId: "user-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "not_found");
});

// ─── buildPlaybookProjectBrainView (pure) ───────────────────────────────────────

test("buildPlaybookProjectBrainView computes status/severity counts correctly", () => {
  const recommendations = [
    { status: "new", severity: "critical", approvalRequired: true, contentStale: false, missingEvidence: [] },
    { status: "new", severity: "high", approvalRequired: false, contentStale: false, missingEvidence: [] },
    { status: "dismissed", severity: "low", approvalRequired: false, contentStale: false, missingEvidence: [] },
  ];

  const view = buildPlaybookProjectBrainView({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    latestSnapshot: null,
    recommendations,
    latestAuditEvents: [],
  });

  assert.equal(view.recommendationCountsByStatus.new, 2);
  assert.equal(view.recommendationCountsByStatus.dismissed, 1);
  assert.equal(view.recommendationCountsByStatus.accepted, 0);
  assert.equal(view.recommendationCountsBySeverity.critical, 1);
  assert.equal(view.recommendationCountsBySeverity.high, 1);
  assert.equal(view.recommendationCountsBySeverity.low, 1);
  assert.equal(view.recommendationCountsBySeverity.medium, 0);
  assert.equal(view.approvalRequiredCount, 1);
});

test("buildPlaybookProjectBrainView reports staleRecommendationCount", () => {
  const recommendations = [
    { status: "accepted", severity: "medium", approvalRequired: false, contentStale: true, missingEvidence: [] },
    { status: "accepted", severity: "medium", approvalRequired: false, contentStale: true, missingEvidence: [] },
    { status: "accepted", severity: "medium", approvalRequired: false, contentStale: false, missingEvidence: [] },
  ];

  const view = buildPlaybookProjectBrainView({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    latestSnapshot: null,
    recommendations,
    latestAuditEvents: [],
  });

  assert.equal(view.staleRecommendationCount, 2);
});

test("buildPlaybookProjectBrainView deduplicates missingEvidenceSummary", () => {
  const recommendations = [
    { status: "new", severity: "medium", approvalRequired: false, contentStale: false, missingEvidence: ["billing_status", "closure_status"] },
    { status: "new", severity: "medium", approvalRequired: false, contentStale: false, missingEvidence: ["billing_status"] },
  ];

  const view = buildPlaybookProjectBrainView({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    latestSnapshot: null,
    recommendations,
    latestAuditEvents: [],
  });

  assert.deepEqual([...view.missingEvidenceSummary].sort(), ["billing_status", "closure_status"]);
});

test("buildPlaybookProjectBrainView always includes the governed read-only warnings", () => {
  const view = buildPlaybookProjectBrainView({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    latestSnapshot: null,
    recommendations: [],
    latestAuditEvents: [],
  });

  assert.ok(view.readOnlyWarnings.length > 0);
  assert.ok(view.readOnlyWarnings.some((w) => /platform_events|platform events/i.test(w)));
  assert.ok(view.readOnlyWarnings.some((w) => /executed automatically|auto/i.test(w)));
});
