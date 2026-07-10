// Perilla 2 — Billing Authorization Must Use Workspace Membership Role.
//
// These tests exercise the real `requireBillingManageMembership` helper
// (src/lib/workspace-access.ts) against a mocked Supabase client — they run
// the actual DB-query-and-decide logic, not a source-text/regex check.

import test from "node:test";
import assert from "node:assert/strict";
import { mockModuleExports } from "./mock-module-compat-test-helpers.mjs";

const supabaseState = { row: undefined };

function makeSupabaseStub() {
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
        maybeSingle: async () => ({ data: supabaseState.row }),
      };
    },
  };
}

await mockModuleExports("@/lib/supabase/server", {
  createSupabaseServerClient: async () => makeSupabaseStub(),
});

await mockModuleExports("@/lib/auth", {
  requireAuthUser: async () => {
    throw new Error("requireAuthUser should not be called by requireBillingManageMembership");
  },
});

const { requireBillingManageMembership, WorkspaceMembershipError, canManageBilling, WORKSPACE_ROLES } = await import(
  "../src/lib/workspace-access.ts"
);

test.beforeEach(() => {
  supabaseState.row = undefined;
});

test("canManageBilling: owner and admin allowed, pm and viewer denied", () => {
  assert.equal(canManageBilling("owner"), true);
  assert.equal(canManageBilling("admin"), true);
  assert.equal(canManageBilling("pm"), false);
  assert.equal(canManageBilling("viewer"), false);
});

test("requireBillingManageMembership: owner membership resolves and returns the validated role", async () => {
  supabaseState.row = { role: "owner" };
  const membership = await requireBillingManageMembership({ userId: "u-owner", workspaceId: "w-1" });
  assert.deepEqual(membership, { userId: "u-owner", workspaceId: "w-1", role: "owner" });
});

test("requireBillingManageMembership: admin membership resolves and returns the validated role", async () => {
  supabaseState.row = { role: "admin" };
  const membership = await requireBillingManageMembership({ userId: "u-admin", workspaceId: "w-1" });
  assert.deepEqual(membership, { userId: "u-admin", workspaceId: "w-1", role: "admin" });
});

test("requireBillingManageMembership: pm membership is denied", async () => {
  supabaseState.row = { role: "pm" };
  await assert.rejects(
    () => requireBillingManageMembership({ userId: "u-pm", workspaceId: "w-1" }),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "insufficient_role");
      return true;
    },
  );
});

test("requireBillingManageMembership: viewer membership is denied", async () => {
  supabaseState.row = { role: "viewer" };
  await assert.rejects(
    () => requireBillingManageMembership({ userId: "u-viewer", workspaceId: "w-1" }),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "insufficient_role");
      return true;
    },
  );
});

test("requireBillingManageMembership: missing membership row fails closed (workspace_missing)", async () => {
  supabaseState.row = undefined;
  await assert.rejects(
    () => requireBillingManageMembership({ userId: "u-nobody", workspaceId: "w-does-not-exist" }),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "workspace_missing");
      return true;
    },
  );
});

test("requireBillingManageMembership: unrecognized/garbage role value is denied, not silently trusted", async () => {
  supabaseState.row = { role: "superadmin" };
  await assert.rejects(() => requireBillingManageMembership({ userId: "u-1", workspaceId: "w-1" }), WorkspaceMembershipError);
});

test("requireBillingManageMembership: role casing is not normalized — mismatched casing is denied, never upgraded to trusted", async () => {
  supabaseState.row = { role: "Owner" };
  await assert.rejects(() => requireBillingManageMembership({ userId: "u-1", workspaceId: "w-1" }), WorkspaceMembershipError);
});

test("requireBillingManageMembership: role is read from workspace_memberships, never from a caller-supplied role", async () => {
  supabaseState.row = { role: "viewer" };
  // Even if a caller tries to smuggle an elevated role in, the function signature only accepts
  // userId/workspaceId — there is no role/actorRole parameter for a caller to spoof.
  await assert.rejects(
    () => requireBillingManageMembership({ userId: "u-1", workspaceId: "w-1", role: "owner", actorRole: "owner" }),
    WorkspaceMembershipError,
  );
});

test("WORKSPACE_ROLES is the exact closed set backing the fail-closed check", () => {
  assert.deepEqual([...WORKSPACE_ROLES], ["owner", "admin", "pm", "viewer"]);
});
