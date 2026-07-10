// Perilla 2 — Billing Authorization Must Use Workspace Membership Role.
//
// These tests exercise the real `requireBillingManageMembership` helper
// (src/lib/workspace-access.ts) against a fake injected Supabase client —
// they run the actual DB-query-and-decide logic, not a source-text/regex
// check, and don't depend on any experimental Node test-runner API.

import test from "node:test";
import assert from "node:assert/strict";
import { requireBillingManageMembership, WorkspaceMembershipError, canManageBilling, WORKSPACE_ROLES } from "../src/lib/workspace-access.ts";

function makeSupabaseClient(row) {
  return {
    from(table) {
      assert.equal(table, "workspace_memberships", "must query workspace_memberships directly");
      return {
        select(columns) {
          assert.equal(columns, "role");
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: row }),
      };
    },
  };
}

const requireMembership = (input, row) => requireBillingManageMembership(input, async () => makeSupabaseClient(row));

test("canManageBilling: owner and admin allowed, pm and viewer denied", () => {
  assert.equal(canManageBilling("owner"), true);
  assert.equal(canManageBilling("admin"), true);
  assert.equal(canManageBilling("pm"), false);
  assert.equal(canManageBilling("viewer"), false);
});

test("requireBillingManageMembership: owner membership resolves and returns the validated role", async () => {
  const membership = await requireMembership({ userId: "u-owner", workspaceId: "w-1" }, { role: "owner" });
  assert.deepEqual(membership, { userId: "u-owner", workspaceId: "w-1", role: "owner" });
});

test("requireBillingManageMembership: admin membership resolves and returns the validated role", async () => {
  const membership = await requireMembership({ userId: "u-admin", workspaceId: "w-1" }, { role: "admin" });
  assert.deepEqual(membership, { userId: "u-admin", workspaceId: "w-1", role: "admin" });
});

test("requireBillingManageMembership: pm membership is denied", async () => {
  await assert.rejects(
    () => requireMembership({ userId: "u-pm", workspaceId: "w-1" }, { role: "pm" }),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "insufficient_role");
      return true;
    },
  );
});

test("requireBillingManageMembership: viewer membership is denied", async () => {
  await assert.rejects(
    () => requireMembership({ userId: "u-viewer", workspaceId: "w-1" }, { role: "viewer" }),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "insufficient_role");
      return true;
    },
  );
});

test("requireBillingManageMembership: missing membership row fails closed (workspace_missing)", async () => {
  await assert.rejects(
    () => requireMembership({ userId: "u-nobody", workspaceId: "w-does-not-exist" }, undefined),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "workspace_missing");
      return true;
    },
  );
});

test("requireBillingManageMembership: unrecognized/garbage role value is denied, not silently trusted", async () => {
  await assert.rejects(() => requireMembership({ userId: "u-1", workspaceId: "w-1" }, { role: "superadmin" }), WorkspaceMembershipError);
});

test("requireBillingManageMembership: role casing is not normalized — mismatched casing is denied, never upgraded to trusted", async () => {
  await assert.rejects(() => requireMembership({ userId: "u-1", workspaceId: "w-1" }, { role: "Owner" }), WorkspaceMembershipError);
});

test("requireBillingManageMembership: role is read from workspace_memberships, never from a caller-supplied role", async () => {
  // Even if a caller tries to smuggle an elevated role in, the function signature only accepts
  // userId/workspaceId (plus the injected client) — there is no role/actorRole parameter to spoof.
  await assert.rejects(
    () => requireMembership({ userId: "u-1", workspaceId: "w-1", role: "owner", actorRole: "owner" }, { role: "viewer" }),
    WorkspaceMembershipError,
  );
});

test("WORKSPACE_ROLES is the exact closed set backing the fail-closed check", () => {
  assert.deepEqual([...WORKSPACE_ROLES], ["owner", "admin", "pm", "viewer"]);
});
