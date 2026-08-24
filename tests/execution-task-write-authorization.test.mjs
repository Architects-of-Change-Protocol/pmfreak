// PMF-003 — Execution-task/dependency mutation endpoints authorize on
// "read" not "write". See docs/audits/pmfreak-post-merge-backlog.json and
// docs/audits/remediation/pmf-003-execution-task-write-authorization.md.
//
// Behavioral, close-to-real-flow tests (same DI pattern as the billing
// routes and /api/vault/intake — see tests/billing-checkout-session-route.test.mjs
// and tests/vault-intake-authorization.test.ts): dependencies (auth,
// project-access, Supabase) are injected via each route's/service's
// exported handle*/deps parameter — the real route/service logic runs
// unmodified.
//
// The injected `requireProjectAccess` fake models the real, live
// authorization boundary confirmed by the independent decision brief
// (docs/audits/pmfreak-remediation-decision-brief.md §5, §7): the live,
// DB-default WORKSPACE_ROLES rank (owner > admin > pm > viewer — see
// src/lib/workspace-access.ts) grants "read" to any workspace member but
// "write" only to pm/admin/owner, and workspace scope is always resolved
// from the project row server-side (never trusted from the client), so a
// write-capable member of workspace A is denied for a project owned by
// workspace B. This directly exercises the actual defect class: the route
// asks the real guard for the wrong permission tier ("read" instead of
// "write"), not a bug in the guard's own role/tenant logic (which is
// unmodified, real production behavior in every other route in this repo).

import test from "node:test";
import assert from "node:assert/strict";
import { AccessDeniedError } from "../src/lib/governance/authority/runtime/access-guards-bridge.ts";
import { handleUpdateExecutionTask } from "../src/app/api/execution-tasks/update/route.ts";
import { handleUpdateExecutionTaskDependency } from "../src/app/api/execution-task-dependencies/update/route.ts";
import { handleMaterializeExecutionTaskDependencies } from "../src/app/api/execution-task-dependencies/materialize/route.ts";
import { createExecutionTaskDependency } from "../src/lib/execution-tasks/dependencies/create-dependency.ts";

const ROLE_RANK = { viewer: 1, pm: 2, admin: 3, owner: 4 };

// Faithful model of the live authorization boundary (see file header):
// denies cross-tenant regardless of role/permission, then denies "write"
// for any role ranked below "pm". This is the exact rule the fix depends
// on — it is what makes these tests fail pre-fix and pass post-fix.
function makeRequireProjectAccess({ actorWorkspaceId, actorRole, projectWorkspaceMap }) {
  const calls = [];
  const fn = async (projectId, permission) => {
    calls.push({ projectId, permission });
    const projectWorkspaceId = projectWorkspaceMap[projectId];
    if (projectWorkspaceId !== actorWorkspaceId) {
      throw new AccessDeniedError("Access denied.", { reason: "cross_tenant" });
    }
    const required = permission === "write" ? ROLE_RANK.pm : ROLE_RANK.viewer;
    if ((ROLE_RANK[actorRole] ?? 0) < required) {
      throw new AccessDeniedError("Access denied.", { reason: "insufficient_role" });
    }
    return { allowed: true };
  };
  fn.calls = calls;
  return fn;
}

function makeAuth(user) {
  return async () => {
    if (!user) throw new AccessDeniedError("Unauthorized.", { reason: "unauthorized" });
    return { user };
  };
}

const VIEWER = { id: "user-viewer", companyId: "workspace-a", email: "viewer@example.com" };
const PM = { id: "user-pm", companyId: "workspace-a", email: "pm@example.com" };

// ── Generic in-memory fake Supabase (PostgREST-shaped) client ───────────────
// Supports exactly the query-builder surface the four routes/service under
// test use: select/eq/in/or/order/maybeSingle/single/insert/update, plus
// being awaitable directly (for the cycle-detection "all deps" query).

function createFakeSupabase(seedTables = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(seedTables)) tables[name] = rows.map((r) => ({ ...r }));

  function ensureTable(name) {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  }

  function makeBuilder(tableName) {
    const filters = [];
    let mode = "select";
    let insertPayload = null;
    let updatePayload = null;

    const builder = {
      select() { return builder; },
      eq(col, val) { filters.push((r) => r[col] === val); return builder; },
      in(col, vals) { filters.push((r) => vals.includes(r[col])); return builder; },
      or(expr) {
        const clauses = expr.split(",").map((c) => {
          const [col, , val] = c.split(".");
          return (r) => String(r[col]) === val;
        });
        filters.push((r) => clauses.some((fn) => fn(r)));
        return builder;
      },
      order() { return builder; },
      insert(payload) {
        mode = "insert";
        insertPayload = Array.isArray(payload) ? payload : [payload];
        return builder;
      },
      update(payload) {
        mode = "update";
        updatePayload = payload;
        return builder;
      },
      async maybeSingle() {
        const result = apply();
        return { data: result[0] ?? null, error: null };
      },
      async single() {
        const result = apply();
        return result[0] ? { data: result[0], error: null } : { data: null, error: { message: "no rows" } };
      },
      then(resolve, reject) {
        try {
          resolve({ data: apply(), error: null });
        } catch (e) {
          if (reject) reject(e); else resolve({ data: null, error: { message: String(e) } });
        }
      },
    };

    function apply() {
      const table = ensureTable(tableName);
      if (mode === "insert") {
        const inserted = insertPayload.map((p, i) => ({
          id: p.id ?? `${tableName}-${table.length + i + 1}`,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          ...p,
        }));
        table.push(...inserted);
        return inserted;
      }
      if (mode === "update") {
        const matched = table.filter((r) => filters.every((f) => f(r)));
        for (const r of matched) Object.assign(r, updatePayload);
        return matched;
      }
      return table.filter((r) => filters.every((f) => f(r)));
    }

    return builder;
  }

  return { from: (name) => makeBuilder(name), tables };
}

function jsonRequest(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── 1. /api/execution-tasks/update ──────────────────────────────────────────

function seedTask(overrides = {}) {
  return {
    id: "task-1",
    workspace_id: "workspace-a",
    project_id: "project-a",
    task_draft_id: null,
    recommended_action_id: null,
    raid_item_id: null,
    title: "Ship the thing",
    description: "",
    status: "not_started",
    priority: "medium",
    owner_user_id: null,
    owner_name: null,
    start_date: null,
    due_date: null,
    completed_at: null,
    progress_percent: 0,
    acceptance_criteria: [],
    checklist: [],
    confidence_score: null,
    source_payload: {},
    created_by: "user-pm",
    ...overrides,
  };
}

test("PMF-003 1a. viewer denial: live viewer role cannot reassign a task via /api/execution-tasks/update", async () => {
  const supabase = createFakeSupabase({ execution_tasks: [seedTask()] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "viewer",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const response = await handleUpdateExecutionTask(
    jsonRequest("http://localhost/api/execution-tasks/update", { taskId: "task-1", ownerUserId: "user-viewer" }),
    { requireAuthenticatedUser: makeAuth(VIEWER), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(response.status, 403);
  assert.equal(supabase.tables.execution_tasks[0].owner_user_id, null, "task must not be mutated on denial");
  assert.equal((supabase.tables.execution_task_events ?? []).length, 0, "no audit event on denial");
});

test("PMF-003 1b. write-capable success: a pm can reassign a task via /api/execution-tasks/update", async () => {
  const supabase = createFakeSupabase({ execution_tasks: [seedTask()] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const response = await handleUpdateExecutionTask(
    jsonRequest("http://localhost/api/execution-tasks/update", { taskId: "task-1", ownerUserId: "user-pm" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(response.status, 200);
  assert.equal(supabase.tables.execution_tasks[0].owner_user_id, "user-pm");
  assert.equal(supabase.tables.execution_task_events.length, 1, "audit event recorded on success");
  assert.equal(supabase.tables.execution_task_events[0].event_type, "owner_changed");
});

test("PMF-003 1c. cross-tenant denial: a pm in workspace A cannot mutate a task owned by workspace B", async () => {
  const supabase = createFakeSupabase({ execution_tasks: [seedTask({ id: "task-b", workspace_id: "workspace-b", project_id: "project-b" })] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-b": "workspace-b" },
  });
  const response = await handleUpdateExecutionTask(
    jsonRequest("http://localhost/api/execution-tasks/update", { taskId: "task-b", ownerUserId: "user-pm" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(response.status, 403);
  assert.equal(supabase.tables.execution_tasks[0].owner_user_id, null);
  assert.equal((supabase.tables.execution_task_events ?? []).length, 0);
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes("workspace-b"), "response must not disclose the foreign workspace id");
});

test("PMF-003 1d. unauthenticated denial: request never reaches the task table", async () => {
  const supabase = createFakeSupabase({ execution_tasks: [seedTask()] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const response = await handleUpdateExecutionTask(
    jsonRequest("http://localhost/api/execution-tasks/update", { taskId: "task-1", ownerUserId: "user-pm" }),
    { requireAuthenticatedUser: makeAuth(null), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(response.status, 401);
  assert.equal(requireProjectAccess.calls.length, 0, "authorization must not be evaluated before authentication");
  assert.equal(supabase.tables.execution_tasks[0].owner_user_id, null);
});

test("PMF-003 1e. direct-object injection: project scope for the permission check is derived from the loaded task row, never from the request body", async () => {
  const supabase = createFakeSupabase({ execution_tasks: [seedTask()] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a", "project-spoofed": "workspace-a" },
  });
  await handleUpdateExecutionTask(
    jsonRequest("http://localhost/api/execution-tasks/update", { taskId: "task-1", projectId: "project-spoofed", ownerUserId: "user-pm" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.deepEqual(requireProjectAccess.calls.map((c) => c.projectId), ["project-a"], "must ignore any client-supplied projectId and use the DB-resolved one");
});

// ── 2. /api/execution-task-dependencies/update ──────────────────────────────

function seedDependency(overrides = {}) {
  return {
    id: "dep-1",
    workspace_id: "workspace-a",
    project_id: "project-a",
    predecessor_task_id: "task-1",
    successor_task_id: "task-2",
    dependency_type: "finish_to_start",
    status: "proposed",
    lag_days: 0,
    reason: null,
    source_type: "manual",
    source_payload: {},
    confidence_score: null,
    created_by: "user-pm",
    ...overrides,
  };
}

test("PMF-003 2a. viewer denial: live viewer role cannot transition a dependency via /api/execution-task-dependencies/update", async () => {
  const supabase = createFakeSupabase({ execution_task_dependencies: [seedDependency()] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "viewer",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const response = await handleUpdateExecutionTaskDependency(
    jsonRequest("http://localhost/api/execution-task-dependencies/update", { dependencyId: "dep-1", status: "active" }),
    { requireAuthenticatedUser: makeAuth(VIEWER), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(response.status, 403);
  assert.equal(supabase.tables.execution_task_dependencies[0].status, "proposed");
  assert.equal((supabase.tables.execution_task_events ?? []).length, 0);
});

test("PMF-003 2b. write-capable success: a pm can transition a dependency via /api/execution-task-dependencies/update", async () => {
  const supabase = createFakeSupabase({ execution_task_dependencies: [seedDependency()] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const response = await handleUpdateExecutionTaskDependency(
    jsonRequest("http://localhost/api/execution-task-dependencies/update", { dependencyId: "dep-1", status: "active" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(response.status, 200);
  assert.equal(supabase.tables.execution_task_dependencies[0].status, "active");
  assert.equal(supabase.tables.execution_task_events.length, 1);
});

test("PMF-003 2c. cross-tenant denial: a pm in workspace A cannot transition a dependency owned by workspace B", async () => {
  const supabase = createFakeSupabase({ execution_task_dependencies: [seedDependency({ id: "dep-b", workspace_id: "workspace-b", project_id: "project-b" })] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-b": "workspace-b" },
  });
  const response = await handleUpdateExecutionTaskDependency(
    jsonRequest("http://localhost/api/execution-task-dependencies/update", { dependencyId: "dep-b", status: "active" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(response.status, 403);
  assert.equal(supabase.tables.execution_task_dependencies[0].status, "proposed");
});

test("PMF-003 2d. unauthenticated denial: request never reaches the dependency table", async () => {
  const supabase = createFakeSupabase({ execution_task_dependencies: [seedDependency()] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const response = await handleUpdateExecutionTaskDependency(
    jsonRequest("http://localhost/api/execution-task-dependencies/update", { dependencyId: "dep-1", status: "active" }),
    { requireAuthenticatedUser: makeAuth(null), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(response.status, 401);
  assert.equal(requireProjectAccess.calls.length, 0);
});

// ── 3. /api/execution-task-dependencies/materialize ─────────────────────────

test("PMF-003 3a. viewer denial: live viewer role cannot bulk-materialize dependencies", async () => {
  const supabase = createFakeSupabase({ projects: [{ id: "project-a", workspace_id: "workspace-a" }] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "viewer",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  let materializeCalled = false;
  const response = await handleMaterializeExecutionTaskDependencies(
    jsonRequest("http://localhost/api/execution-task-dependencies/materialize", { projectId: "project-a" }),
    {
      requireAuthenticatedUser: makeAuth(VIEWER),
      requireProjectAccess,
      createSupabaseServerClient: async () => supabase,
      materializeInferredExecutionTaskDependencies: async () => { materializeCalled = true; return { ok: true, inserted: 0, skipped: 0 }; },
    },
  );
  assert.equal(response.status, 403);
  assert.equal(materializeCalled, false, "bulk write must not run on denial");
});

test("PMF-003 3b. write-capable success: a pm can bulk-materialize dependencies", async () => {
  const supabase = createFakeSupabase({ projects: [{ id: "project-a", workspace_id: "workspace-a" }] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  let materializeCalled = false;
  const response = await handleMaterializeExecutionTaskDependencies(
    jsonRequest("http://localhost/api/execution-task-dependencies/materialize", { projectId: "project-a" }),
    {
      requireAuthenticatedUser: makeAuth(PM),
      requireProjectAccess,
      createSupabaseServerClient: async () => supabase,
      materializeInferredExecutionTaskDependencies: async () => { materializeCalled = true; return { ok: true, inserted: 3, skipped: 0 }; },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(materializeCalled, true);
});

test("PMF-003 3c. cross-tenant denial: a pm in workspace A cannot materialize dependencies for a project owned by workspace B", async () => {
  const supabase = createFakeSupabase({ projects: [{ id: "project-b", workspace_id: "workspace-b" }] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-b": "workspace-b" },
  });
  let materializeCalled = false;
  const response = await handleMaterializeExecutionTaskDependencies(
    jsonRequest("http://localhost/api/execution-task-dependencies/materialize", { projectId: "project-b" }),
    {
      requireAuthenticatedUser: makeAuth(PM),
      requireProjectAccess,
      createSupabaseServerClient: async () => supabase,
      materializeInferredExecutionTaskDependencies: async () => { materializeCalled = true; return { ok: true, inserted: 0, skipped: 0 }; },
    },
  );
  assert.equal(response.status, 403);
  assert.equal(materializeCalled, false);
});

test("PMF-003 3d. unauthenticated denial: request never reaches the project table", async () => {
  const supabase = createFakeSupabase({ projects: [{ id: "project-a", workspace_id: "workspace-a" }] });
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const response = await handleMaterializeExecutionTaskDependencies(
    jsonRequest("http://localhost/api/execution-task-dependencies/materialize", { projectId: "project-a" }),
    {
      requireAuthenticatedUser: makeAuth(null),
      requireProjectAccess,
      createSupabaseServerClient: async () => supabase,
      materializeInferredExecutionTaskDependencies: async () => { throw new Error("must not be reached"); },
    },
  );
  assert.equal(response.status, 401);
  assert.equal(requireProjectAccess.calls.length, 0);
});

// ── 4. createExecutionTaskDependency (POST /api/execution-task-dependencies) ─

function seedDependencyTasks() {
  return {
    execution_tasks: [
      seedTask({ id: "task-1", project_id: "project-a", workspace_id: "workspace-a" }),
      seedTask({ id: "task-2", project_id: "project-a", workspace_id: "workspace-a" }),
      seedTask({ id: "task-b1", project_id: "project-b", workspace_id: "workspace-b" }),
      seedTask({ id: "task-b2", project_id: "project-b", workspace_id: "workspace-b" }),
    ],
  };
}

test("PMF-003 4a. viewer denial: live viewer role cannot create a dependency", async () => {
  const supabase = createFakeSupabase(seedDependencyTasks());
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "viewer",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const result = await createExecutionTaskDependency(
    { predecessorTaskId: "task-1", successorTaskId: "task-2" },
    { requireAuthenticatedUser: makeAuth(VIEWER), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "unauthorized");
  assert.equal((supabase.tables.execution_task_dependencies ?? []).length, 0, "no dependency must be created on denial");
  assert.equal((supabase.tables.execution_task_events ?? []).length, 0);
});

test("PMF-003 4b. write-capable success: a pm can create a dependency", async () => {
  const supabase = createFakeSupabase(seedDependencyTasks());
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const result = await createExecutionTaskDependency(
    { predecessorTaskId: "task-1", successorTaskId: "task-2" },
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(result.ok, true);
  assert.equal(supabase.tables.execution_task_dependencies.length, 1);
  assert.ok(supabase.tables.execution_task_events.length >= 1, "audit event(s) recorded on success");
});

test("PMF-003 4c. cross-tenant denial: a pm in workspace A cannot create a dependency between tasks owned by workspace B", async () => {
  const supabase = createFakeSupabase(seedDependencyTasks());
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-b": "workspace-b" },
  });
  const result = await createExecutionTaskDependency(
    { predecessorTaskId: "task-b1", successorTaskId: "task-b2" },
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "unauthorized");
  assert.equal((supabase.tables.execution_task_dependencies ?? []).length, 0);
});

test("PMF-003 4d. unauthenticated denial: request never loads task rows", async () => {
  const supabase = createFakeSupabase(seedDependencyTasks());
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const result = await createExecutionTaskDependency(
    { predecessorTaskId: "task-1", successorTaskId: "task-2" },
    { requireAuthenticatedUser: makeAuth(null), requireProjectAccess, createSupabaseServerClient: async () => supabase },
  );
  assert.equal(result.ok, false);
  assert.equal(result.failureClass, "unauthenticated");
  assert.equal(requireProjectAccess.calls.length, 0);
});
