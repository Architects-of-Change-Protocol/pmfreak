// Guided Workspace Onboarding — evidence collection.
//
// Exercises collectWorkspaceActivationEvidence against a fake Supabase
// client. Verifies tenancy scoping (every probe filters by workspace_id),
// honest exclusions (archived projects, non-user chat messages, non-pending
// invitations) and fail-closed behavior (query errors read as "absent",
// never as fabricated progress).

import test from "node:test";
import assert from "node:assert/strict";
import { collectWorkspaceActivationEvidence } from "../src/lib/workspace-activation/evaluate-workspace-activation.ts";

/**
 * Fake PostgREST-ish builder: records filters, resolves with the configured
 * rows for the table. Thenable like the real builder.
 */
function makeFakeClient(tables, recorded = []) {
  return {
    from(table) {
      const state = { table, filters: [], limited: null };
      recorded.push(state);
      const rowsFor = () => {
        const provider = tables[table];
        const rows = typeof provider === "function" ? provider(state) : (provider ?? []);
        if (rows instanceof Error) return { data: null, error: rows };
        return { data: rows, error: null };
      };
      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          state.filters.push(["eq", column, value]);
          return builder;
        },
        neq(column, value) {
          state.filters.push(["neq", column, value]);
          return builder;
        },
        limit(n) {
          state.limited = n;
          return builder;
        },
        maybeSingle: async () => {
          const { data, error } = rowsFor();
          if (error) return { data: null, error };
          return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
        },
        then(resolve, reject) {
          return Promise.resolve(rowsFor()).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

const collect = (tables, recorded) =>
  collectWorkspaceActivationEvidence({
    workspaceId: "ws-1",
    userId: "user-1",
    role: "owner",
    getClient: async () => makeFakeClient(tables, recorded),
  });

test("empty workspace yields all-absent evidence (nothing fabricated)", async () => {
  const evidence = await collect({});
  assert.equal(evidence.pmoExists, false);
  assert.equal(evidence.projectExists, false);
  assert.equal(evidence.taskExists, false);
  assert.equal(evidence.milestoneExists, false);
  assert.equal(evidence.raidItemExists, false);
  assert.equal(evidence.governanceSignalExists, false);
  assert.equal(evidence.recommendedActionExists, false);
  assert.equal(evidence.userMessageExists, false);
  assert.equal(evidence.pendingInviteExists, false);
  assert.equal(evidence.memberCount, 0);
  assert.equal(evidence.insightsFirstViewedAt, null);
});

test("every table probe is scoped to the workspace (tenancy isolation)", async () => {
  const recorded = [];
  await collect({}, recorded);
  const workspaceScoped = recorded.filter((q) => q.table !== "workspaces");
  assert.ok(workspaceScoped.length >= 10, "expected all evidence probes to run");
  for (const query of workspaceScoped) {
    const scope = query.filters.find(([op, col]) => op === "eq" && col === "workspace_id");
    assert.ok(scope, `${query.table} probe must filter by workspace_id`);
    assert.equal(scope[2], "ws-1");
  }
  const workspaceProbe = recorded.find((q) => q.table === "workspaces");
  assert.ok(
    workspaceProbe.filters.some(([op, col, v]) => op === "eq" && col === "id" && v === "ws-1"),
    "workspaces probe must filter by id",
  );
});

test("archived projects are excluded from project evidence", async () => {
  const recorded = [];
  const evidence = await collect({ projects: [{ id: "p1" }] }, recorded);
  assert.equal(evidence.projectExists, true);
  const projectQuery = recorded.find((q) => q.table === "projects");
  assert.ok(
    projectQuery.filters.some(([op, col, v]) => op === "neq" && col === "status" && v === "archived"),
    "projects probe must exclude archived",
  );
});

test("only pending invitations count as invite evidence", async () => {
  const recorded = [];
  const evidence = await collect({ workspace_invitations: [{ id: "i1" }] }, recorded);
  assert.equal(evidence.pendingInviteExists, true);
  const inviteQuery = recorded.find((q) => q.table === "workspace_invitations");
  assert.ok(
    inviteQuery.filters.some(([op, col, v]) => op === "eq" && col === "status" && v === "pending"),
    "invitation probe must require status=pending",
  );
});

test("only user-authored messages count as conversation evidence", async () => {
  const recorded = [];
  const evidence = await collect({ context_messages: [{ id: "m1" }] }, recorded);
  assert.equal(evidence.userMessageExists, true);
  const messageQuery = recorded.find((q) => q.table === "context_messages");
  assert.ok(
    messageQuery.filters.some(([op, col, v]) => op === "eq" && col === "role" && v === "user"),
    "message probe must require role=user",
  );
});

test("only active PMOs count as PMO evidence", async () => {
  const recorded = [];
  const evidence = await collect({ pmos: [{ id: "pmo1" }] }, recorded);
  assert.equal(evidence.pmoExists, true);
  const pmoQuery = recorded.find((q) => q.table === "pmos");
  assert.ok(
    pmoQuery.filters.some(([op, col, v]) => op === "eq" && col === "status" && v === "active"),
    "pmo probe must require status=active",
  );
});

test("memberCount reflects real membership rows (capped probe)", async () => {
  const evidence = await collect({ workspace_memberships: [{ user_id: "a" }, { user_id: "b" }] });
  assert.equal(evidence.memberCount, 2);
});

test("query errors fail closed: evidence reads absent, never present", async () => {
  const failing = new Error("boom");
  const evidence = await collect({
    projects: () => failing,
    execution_tasks: () => failing,
    pmos: () => failing,
    workspaces: () => failing,
    workspace_memberships: () => failing,
  });
  assert.equal(evidence.projectExists, false);
  assert.equal(evidence.taskExists, false);
  assert.equal(evidence.pmoExists, false);
  assert.equal(evidence.ownerType, null);
  assert.equal(evidence.memberCount, 0);
});

test("real data flows through: tasks, milestones, raid, signals, recommendations", async () => {
  const evidence = await collect({
    execution_tasks: [{ id: "t1" }],
    project_milestones: [{ id: "ms1" }],
    raid_items: [{ id: "r1" }],
    governance_signals: [{ id: "g1" }],
    recommended_actions: [{ id: "ra1" }],
    workspaces: [{ owner_type: "personal" }],
  });
  assert.equal(evidence.taskExists, true);
  assert.equal(evidence.milestoneExists, true);
  assert.equal(evidence.raidItemExists, true);
  assert.equal(evidence.governanceSignalExists, true);
  assert.equal(evidence.recommendedActionExists, true);
  assert.equal(evidence.ownerType, "personal");
});
