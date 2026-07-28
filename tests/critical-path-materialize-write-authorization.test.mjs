// PMF-003B — POST /api/critical-path/materialize authorizes on "read" not
// "write". Same defect class as PMF-003 (docs/audits/remediation/
// pmf-003-execution-task-write-authorization.md), discovered as residual
// debt in PR #557 but in a different module (src/lib/critical-path/*), so
// it gets its own test file rather than extending
// tests/execution-task-write-authorization.test.mjs: the mutation under
// test (materializeCriticalPath, a project-wide DAG recompute that
// overwrites execution_tasks scheduling columns) has no per-resource id of
// its own — it is invoked by projectId alone — so its fixtures and
// DOI-injection shape differ enough from the four PMF-003 call sites that
// sharing a file would blur the boundary rather than clarify it.
//
// Same DI pattern as tests/execution-task-write-authorization.test.mjs and
// tests/billing-checkout-session-route.test.mjs: dependencies (auth,
// project-access, the materialize service) are injected via the route's
// exported handleMaterializeCriticalPath(request, deps) — the real route
// logic runs unmodified. The injected requireProjectAccess fake models the
// real, live authorization boundary (src/lib/workspace-access.ts): the
// DB-default WORKSPACE_ROLES rank (owner > admin > pm > viewer) grants
// "read" to any workspace member but "write" only to pm/admin/owner, and
// workspace scope is always resolved server-side from the real project
// row (never trusted from the client). This exercises the actual defect:
// the route asks the real guard for the wrong permission tier.

import test from "node:test";
import assert from "node:assert/strict";
import { AccessDeniedError } from "../src/aoc/enterprise/runtime/access-guards-bridge.ts";
import { handleMaterializeCriticalPath } from "../src/app/api/critical-path/materialize/route.ts";

const ROLE_RANK = { viewer: 1, pm: 2, admin: 3, owner: 4 };

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

function jsonRequest(body) {
  return new Request("http://localhost/api/critical-path/materialize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeMaterialize({ succeed = true, result } = {}) {
  const calls = [];
  const fn = async (input) => {
    calls.push(input);
    if (!succeed) return { ok: false, error: "boom", failureClass: "unexpected_error" };
    return result ?? { ok: true, criticalTaskIds: ["task-1", "task-2"], projectFinish: 42 };
  };
  fn.calls = calls;
  return fn;
}

// ── 9.1 Viewer denial ────────────────────────────────────────────────────

test("PMF-003B 1a. viewer denial: live viewer role cannot materialize critical-path state", async () => {
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "viewer",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const materializeCriticalPath = makeMaterialize();
  const response = await handleMaterializeCriticalPath(
    jsonRequest({ projectId: "project-a" }),
    { requireAuthenticatedUser: makeAuth(VIEWER), requireProjectAccess, materializeCriticalPath },
  );
  assert.equal(response.status, 403);
  assert.equal(materializeCriticalPath.calls.length, 0, "no materialization must run on denial");
});

// ── 9.2 Writer success ───────────────────────────────────────────────────

test("PMF-003B 1b. write-capable success: a pm can materialize critical-path state", async () => {
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const materializeCriticalPath = makeMaterialize();
  const response = await handleMaterializeCriticalPath(
    jsonRequest({ projectId: "project-a" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, materializeCriticalPath },
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.criticalTaskIds, ["task-1", "task-2"]);
  assert.equal(body.projectFinish, 42);
  assert.equal(materializeCriticalPath.calls.length, 1, "materialization must run exactly once");
  assert.deepEqual(materializeCriticalPath.calls[0], { projectId: "project-a" });
});

// ── 9.3 Cross-tenant denial ──────────────────────────────────────────────

test("PMF-003B 1c. cross-tenant denial: a pm in workspace A cannot materialize a project owned by workspace B", async () => {
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-b": "workspace-b" },
  });
  const materializeCriticalPath = makeMaterialize();
  const response = await handleMaterializeCriticalPath(
    jsonRequest({ projectId: "project-b" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, materializeCriticalPath },
  );
  assert.equal(response.status, 403);
  assert.equal(materializeCriticalPath.calls.length, 0, "no mutation on cross-tenant denial");
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes("workspace-b"), "response must not disclose the foreign workspace id");
  assert.equal(body.error, "Access denied.", "denial must use the canonical non-disclosing message");
});

// ── 9.4 Unauthenticated denial ───────────────────────────────────────────

test("PMF-003B 1d. unauthenticated denial: request never reaches authorization or materialization", async () => {
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const materializeCriticalPath = makeMaterialize();
  const response = await handleMaterializeCriticalPath(
    jsonRequest({ projectId: "project-a" }),
    { requireAuthenticatedUser: makeAuth(null), requireProjectAccess, materializeCriticalPath },
  );
  assert.equal(response.status, 401);
  assert.equal(requireProjectAccess.calls.length, 0, "authorization must not be evaluated before authentication");
  assert.equal(materializeCriticalPath.calls.length, 0);
});

// ── 9.5 Direct-object injection ──────────────────────────────────────────
// The endpoint accepts only one client-supplied identifier (projectId) — it
// has no secondary resource id (task/dependency) to load and derive scope
// from, unlike the PMF-003 update routes. The injection surface here is a
// spoofed extra scope claim in the body; the fix must prove the route
// ignores it and derives scope solely through requireProjectAccess's
// server-side resolution of the real project's workspace.

test("PMF-003B 1e. direct-object injection: an extraneous client-supplied workspaceId claim is ignored; scope comes only from the server-resolved project", async () => {
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-b": "workspace-b" },
  });
  const materializeCriticalPath = makeMaterialize();
  const response = await handleMaterializeCriticalPath(
    jsonRequest({ projectId: "project-b", workspaceId: "workspace-a" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, materializeCriticalPath },
  );
  assert.equal(response.status, 403, "a spoofed workspaceId in the body must not grant access to a foreign project");
  assert.deepEqual(requireProjectAccess.calls.map((c) => c.projectId), ["project-b"], "authorization must be evaluated against the actual target project, not any client-asserted workspace");
  assert.equal(materializeCriticalPath.calls.length, 0);
});

// ── 9.6 Repeat-call behavior ──────────────────────────────────────────────
// materializeCriticalPath recomputes the full DAG and unconditionally
// overwrites execution_tasks scheduling columns every call — there is no
// version check or do-nothing-if-unchanged guard. Document the existing
// contract: repeated authorized calls are each independently permitted and
// each independently re-run the computation (not blocked, not deduped).

test("PMF-003B 1f. repeat-call: two consecutive authorized calls are each independently permitted and each re-run materialization (existing non-deduping contract)", async () => {
  const requireProjectAccess = makeRequireProjectAccess({
    actorWorkspaceId: "workspace-a",
    actorRole: "pm",
    projectWorkspaceMap: { "project-a": "workspace-a" },
  });
  const materializeCriticalPath = makeMaterialize();
  const first = await handleMaterializeCriticalPath(
    jsonRequest({ projectId: "project-a" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, materializeCriticalPath },
  );
  const second = await handleMaterializeCriticalPath(
    jsonRequest({ projectId: "project-a" }),
    { requireAuthenticatedUser: makeAuth(PM), requireProjectAccess, materializeCriticalPath },
  );
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(materializeCriticalPath.calls.length, 2, "each call independently re-runs the recompute; no idempotency guard exists");
});
