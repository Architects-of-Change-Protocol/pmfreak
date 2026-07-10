// Perilla 4 — Workspace Member Role Update / Owner Transfer Hardening.
//
// Behavioral tests for the trust boundary around *updating* an existing
// `workspace_memberships.role` row — as opposed to creating one (Perilla 3,
// tests/invite-workspace-role-boundary.test.mjs). No update-role or
// remove-member endpoint/UI exists in this codebase yet; this perilla adds
// the authoritative server-side helpers and orchestrating function so that,
// whenever such an endpoint is built, it can only ever change
// `workspace_memberships.role` through this hardened path.
//
// - normalizeWorkspaceRole / canUpdateWorkspaceMemberRole / isWorkspaceRolePromotion /
//   requireWorkspaceRoleUpdateActor / requireWorkspaceRoleUpdateTarget / countWorkspaceOwners
//   (src/lib/workspace-access.ts) are pure or DB-injectable — exercised directly, the same
//   pattern as tests/billing-authorization-workspace-membership.test.mjs and
//   tests/invite-workspace-role-boundary.test.mjs.
// - updateWorkspaceMemberRole (src/lib/workspace-team.ts) is exercised against a fake
//   in-memory Supabase client injected via its getSupabaseClient parameter — the real
//   validation/policy/update logic runs unmodified, no live database needed.

import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_ROLES,
  normalizeWorkspaceRole,
  compareWorkspaceRolePrivilege,
  isWorkspaceRolePromotion,
  canUpdateWorkspaceMemberRole,
  requireWorkspaceRoleUpdateActor,
  requireWorkspaceRoleUpdateTarget,
  countWorkspaceOwners,
  WorkspaceMembershipError,
} from "../src/lib/workspace-access.ts";
import { updateWorkspaceMemberRole, WorkspaceRoleUpdateError } from "../src/lib/workspace-team.ts";

// ─────────────────────────────────────────────────────────────────────────────
// compareWorkspaceRolePrivilege / isWorkspaceRolePromotion (pure)
// ─────────────────────────────────────────────────────────────────────────────

test("compareWorkspaceRolePrivilege: owner > admin > pm > viewer", () => {
  assert.ok(compareWorkspaceRolePrivilege("owner") > compareWorkspaceRolePrivilege("admin"));
  assert.ok(compareWorkspaceRolePrivilege("admin") > compareWorkspaceRolePrivilege("pm"));
  assert.ok(compareWorkspaceRolePrivilege("pm") > compareWorkspaceRolePrivilege("viewer"));
});

test("isWorkspaceRolePromotion: viewer->pm, pm->admin, admin->owner are promotions", () => {
  assert.equal(isWorkspaceRolePromotion({ currentRole: "viewer", targetRole: "pm" }), true);
  assert.equal(isWorkspaceRolePromotion({ currentRole: "pm", targetRole: "admin" }), true);
  assert.equal(isWorkspaceRolePromotion({ currentRole: "admin", targetRole: "owner" }), true);
});

test("isWorkspaceRolePromotion: demotions and lateral moves are not promotions", () => {
  assert.equal(isWorkspaceRolePromotion({ currentRole: "admin", targetRole: "pm" }), false);
  assert.equal(isWorkspaceRolePromotion({ currentRole: "pm", targetRole: "pm" }), false);
  assert.equal(isWorkspaceRolePromotion({ currentRole: "owner", targetRole: "admin" }), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// canUpdateWorkspaceMemberRole (pure policy) — required test cases 1-11, 15
// ─────────────────────────────────────────────────────────────────────────────

function decide(overrides = {}) {
  return canUpdateWorkspaceMemberRole({
    actorRole: "owner",
    actorUserId: "actor-1",
    targetUserId: "target-1",
    currentTargetRole: "viewer",
    requestedTargetRole: "pm",
    isLastOwner: false,
    ...overrides,
  });
}

test("case 1: viewer actor cannot update roles", () => {
  for (const targetRole of ["pm", "admin"]) {
    assert.equal(decide({ actorRole: "viewer", requestedTargetRole: targetRole }), "deny_actor_insufficient_role");
  }
});

test("case 2: pm actor cannot update roles", () => {
  for (const targetRole of ["admin", "viewer"]) {
    assert.equal(decide({ actorRole: "pm", currentTargetRole: "admin", requestedTargetRole: targetRole }), "deny_actor_insufficient_role");
  }
});

test("case 3: admin actor cannot assign owner", () => {
  assert.equal(decide({ actorRole: "admin", requestedTargetRole: "owner" }), "deny_owner_assignment_requires_transfer");
});

test("case 4: owner actor cannot assign owner via normal role update", () => {
  assert.equal(decide({ actorRole: "owner", requestedTargetRole: "owner" }), "deny_owner_assignment_requires_transfer");
});

test("case 5: owner can assign admin/pm/viewer to non-owner members", () => {
  for (const currentTargetRole of ["pm", "viewer", "admin"]) {
    for (const requestedTargetRole of ["admin", "pm", "viewer"]) {
      assert.equal(decide({ actorRole: "owner", currentTargetRole, requestedTargetRole }), "allow", `${currentTargetRole} -> ${requestedTargetRole}`);
    }
  }
});

test("case 6: admin can only manage pm/viewer targets, and only set pm/viewer", () => {
  assert.equal(decide({ actorRole: "admin", currentTargetRole: "pm", requestedTargetRole: "viewer" }), "allow");
  assert.equal(decide({ actorRole: "admin", currentTargetRole: "viewer", requestedTargetRole: "pm" }), "allow");
  assert.equal(decide({ actorRole: "admin", currentTargetRole: "viewer", requestedTargetRole: "admin" }), "deny_target_role_not_assignable");
  assert.equal(decide({ actorRole: "admin", currentTargetRole: "admin", requestedTargetRole: "pm" }), "deny_actor_insufficient_role");
  assert.equal(decide({ actorRole: "admin", currentTargetRole: "owner", requestedTargetRole: "admin", isLastOwner: false }), "deny_owner_role_change_requires_transfer");
  assert.equal(decide({ actorRole: "admin", currentTargetRole: "owner", requestedTargetRole: "pm", isLastOwner: true }), "deny_last_owner_protected");
});

test("case 7: self-promotion is denied", () => {
  assert.equal(
    decide({ actorUserId: "u-1", targetUserId: "u-1", currentTargetRole: "pm", requestedTargetRole: "admin", actorRole: "admin" }),
    "deny_self_promotion",
  );
});

test("case 8: self owner-assignment is denied (owner-assignment check wins over self-promotion)", () => {
  assert.equal(
    decide({ actorUserId: "u-1", targetUserId: "u-1", currentTargetRole: "admin", requestedTargetRole: "owner", actorRole: "owner" }),
    "deny_owner_assignment_requires_transfer",
  );
});

test("self-demotion/lateral self-change is denied too — no self-service role-change flow in this perilla", () => {
  assert.equal(
    decide({ actorUserId: "u-1", targetUserId: "u-1", currentTargetRole: "admin", requestedTargetRole: "pm", actorRole: "owner" }),
    "deny_self_role_update",
  );
});

test("case 9: last owner downgrade is denied", () => {
  for (const requestedTargetRole of ["admin", "viewer"]) {
    assert.equal(
      decide({ actorRole: "owner", targetUserId: "other-owner", currentTargetRole: "owner", requestedTargetRole, isLastOwner: true }),
      "deny_last_owner_protected",
    );
  }
});

test("case 11: non-last-owner downgrade is still denied — no owner-transfer flow exists to route it through", () => {
  assert.equal(
    decide({ actorRole: "owner", targetUserId: "other-owner", currentTargetRole: "owner", requestedTargetRole: "admin", isLastOwner: false }),
    "deny_owner_role_change_requires_transfer",
  );
});

test("case 15: invalid/garbage target role fails closed via normalizeWorkspaceRole before canUpdateWorkspaceMemberRole is ever reached", () => {
  for (const value of ["superadmin", "founder", "__proto__", "constructor", "", null, undefined]) {
    assert.equal(normalizeWorkspaceRole(value), null, JSON.stringify(value));
  }
  assert.equal(normalizeWorkspaceRole("  OWNER  "), "owner", "casing/whitespace normalization still applies for otherwise-valid roles");
});

test("admin cannot change an owner's role even to a non-owner value", () => {
  assert.equal(decide({ actorRole: "admin", currentTargetRole: "owner", requestedTargetRole: "pm", isLastOwner: false }), "deny_owner_role_change_requires_transfer");
});

// ─────────────────────────────────────────────────────────────────────────────
// requireWorkspaceRoleUpdateActor / requireWorkspaceRoleUpdateTarget / countWorkspaceOwners
// (DB-injectable, mirrors requireWorkspaceInviteActor / requireBillingManageMembership)
// ─────────────────────────────────────────────────────────────────────────────

function fakeMembershipLookupClient(row) {
  return {
    from(table) {
      assert.equal(table, "workspace_memberships");
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

test("requireWorkspaceRoleUpdateActor: resolves any valid role, including pm/viewer — insufficiency is decided later by policy, not by this lookup", async () => {
  for (const role of WORKSPACE_ROLES) {
    const result = await requireWorkspaceRoleUpdateActor({ userId: "u-1", workspaceId: "w-1" }, async () => fakeMembershipLookupClient({ role }));
    assert.deepEqual(result, { userId: "u-1", workspaceId: "w-1", role });
  }
});

test("requireWorkspaceRoleUpdateActor: missing membership fails closed (workspaceId manipulation, test #17)", async () => {
  await assert.rejects(
    () => requireWorkspaceRoleUpdateActor({ userId: "u-1", workspaceId: "workspace.attacker" }, async () => fakeMembershipLookupClient(undefined)),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "workspace_missing");
      return true;
    },
  );
});

test("requireWorkspaceRoleUpdateActor: unrecognized stored role fails closed", async () => {
  await assert.rejects(
    () => requireWorkspaceRoleUpdateActor({ userId: "u-1", workspaceId: "w-1" }, async () => fakeMembershipLookupClient({ role: "superadmin" })),
    WorkspaceMembershipError,
  );
});

test("requireWorkspaceRoleUpdateTarget: target not a member fails closed (test #16)", async () => {
  await assert.rejects(
    () => requireWorkspaceRoleUpdateTarget({ workspaceId: "w-1", targetUserId: "ghost" }, async () => fakeMembershipLookupClient(undefined)),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "workspace_missing");
      return true;
    },
  );
});

test("countWorkspaceOwners: counts only role='owner' rows in the workspace", async () => {
  const client = {
    from(table) {
      assert.equal(table, "workspace_memberships");
      const filters = {};
      return {
        select(columns, opts) {
          assert.equal(columns, "user_id");
          assert.deepEqual(opts, { head: true, count: "exact" });
          return this;
        },
        eq(column, value) {
          filters[column] = value;
          return this;
        },
        then(resolve) {
          assert.equal(filters.workspace_id, "w-1");
          assert.equal(filters.role, "owner");
          resolve({ count: 2, error: null });
        },
      };
    },
  };
  assert.equal(await countWorkspaceOwners({ workspaceId: "w-1" }, async () => client), 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// updateWorkspaceMemberRole — fake in-memory Supabase client (real orchestration)
// ─────────────────────────────────────────────────────────────────────────────

function makeFakeSupabase(memberships) {
  const state = { memberships: memberships.map((m) => ({ ...m })), auditEvents: [] };

  function membershipsBuilder() {
    const builder = {
      _filters: {},
      _patch: null,
      _isCount: false,
      select(_columns, opts) {
        if (opts?.count) this._isCount = true;
        return this;
      },
      update(patch) {
        this._patch = patch;
        return this;
      },
      eq(column, value) {
        this._filters[column] = value;
        return this;
      },
      _matches() {
        return state.memberships.filter((m) => Object.entries(this._filters).every(([key, value]) => String(m[key]) === String(value)));
      },
      async maybeSingle() {
        const rows = this._matches();
        return { data: rows[0] ? { ...rows[0] } : null, error: null };
      },
      _execute() {
        if (this._patch) {
          const rows = this._matches();
          rows.forEach((row) => Object.assign(row, this._patch));
          return { data: rows.map((r) => ({ ...r })), error: null };
        }
        if (this._isCount) {
          return { data: null, count: this._matches().length, error: null };
        }
        return { data: this._matches().map((r) => ({ ...r })), error: null };
      },
      then(resolve, reject) {
        try {
          resolve(this._execute());
        } catch (error) {
          reject(error);
        }
      },
    };
    return builder;
  }

  return {
    state,
    from(table) {
      if (table === "workspace_memberships") return membershipsBuilder();
      if (table === "workspace_audit_events") {
        return {
          async insert(row) {
            state.auditEvents.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

async function callUpdate(input, memberships) {
  const client = makeFakeSupabase(memberships);
  try {
    const result = await updateWorkspaceMemberRole(input, async () => client);
    return { ok: true, result, client };
  } catch (error) {
    return { ok: false, error, client };
  }
}

test("valid role update works: owner downgrades a viewer to pm (test #19)", async () => {
  const outcome = await callUpdate(
    { workspaceId: "w-1", actorUserId: "owner-1", targetUserId: "target-1", requestedRole: "pm" },
    [
      { workspace_id: "w-1", user_id: "owner-1", role: "owner" },
      { workspace_id: "w-1", user_id: "target-1", role: "viewer" },
    ],
  );
  assert.equal(outcome.ok, true);
  assert.deepEqual(outcome.result, { workspaceId: "w-1", targetUserId: "target-1", role: "pm" });
  assert.equal(outcome.client.state.memberships.find((m) => m.user_id === "target-1").role, "pm");
  assert.ok(outcome.client.state.auditEvents.some((e) => e.event_type === "member_role_updated"));
});

test("update happens only after authorization: denied requests never call update (test #18)", async () => {
  const outcome = await callUpdate(
    { workspaceId: "w-1", actorUserId: "viewer-1", targetUserId: "target-1", requestedRole: "admin" },
    [
      { workspace_id: "w-1", user_id: "viewer-1", role: "viewer" },
      { workspace_id: "w-1", user_id: "target-1", role: "pm" },
    ],
  );
  assert.equal(outcome.ok, false);
  assert.ok(outcome.error instanceof WorkspaceRoleUpdateError);
  assert.equal(outcome.error.reason, "deny_actor_insufficient_role");
  assert.equal(outcome.client.state.memberships.find((m) => m.user_id === "target-1").role, "pm", "target role must be unchanged");
  assert.equal(outcome.client.state.auditEvents.length, 0);
});

test("test #12: body.actorRole/isOwner do not authorize the update — real actor membership (viewer) always wins", async () => {
  const outcome = await callUpdate(
    { workspaceId: "workspace.demo", actorUserId: "u-viewer", targetUserId: "target.demo", requestedRole: "admin", actorRole: "owner", isOwner: true },
    [
      { workspace_id: "workspace.demo", user_id: "u-viewer", role: "viewer" },
      { workspace_id: "workspace.demo", user_id: "target.demo", role: "pm" },
    ],
  );
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "deny_actor_insufficient_role");
  assert.equal(outcome.client.state.memberships.find((m) => m.user_id === "target.demo").role, "pm");
});

test("test #13/#14: user_metadata.role / display role fields on the input are structurally irrelevant — only workspace_memberships is read", async () => {
  // updateWorkspaceMemberRole's signature only reads workspaceId/actorUserId/targetUserId/requestedRole;
  // extra fields are ignored even if present, because nothing in the function reads them.
  const outcome = await callUpdate(
    {
      workspaceId: "w-1",
      actorUserId: "u-1",
      targetUserId: "target-1",
      requestedRole: "admin",
      userMetadataRole: "owner",
      displayRole: "admin",
      AuthUserContextRole: "admin",
    },
    [
      { workspace_id: "w-1", user_id: "u-1", role: "viewer" },
      { workspace_id: "w-1", user_id: "target-1", role: "pm" },
    ],
  );
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "deny_actor_insufficient_role");
});

test("test #15: invalid target role fails closed before any DB call", async () => {
  for (const requestedRole of ["superadmin", "founder", "__proto__", "", null]) {
    const outcome = await callUpdate(
      { workspaceId: "w-1", actorUserId: "owner-1", targetUserId: "target-1", requestedRole },
      [
        { workspace_id: "w-1", user_id: "owner-1", role: "owner" },
        { workspace_id: "w-1", user_id: "target-1", role: "viewer" },
      ],
    );
    assert.equal(outcome.ok, false, JSON.stringify(requestedRole));
    assert.equal(outcome.error.reason, "deny_invalid_role");
    assert.equal(outcome.client.state.memberships.find((m) => m.user_id === "target-1").role, "viewer");
  }
});

test("test #16: target not a workspace member fails closed", async () => {
  const outcome = await callUpdate(
    { workspaceId: "w-1", actorUserId: "owner-1", targetUserId: "ghost", requestedRole: "pm" },
    [{ workspace_id: "w-1", user_id: "owner-1", role: "owner" }],
  );
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "deny_target_not_member");
});

test("test #17: workspaceId manipulated to a workspace the actor does not belong to fails closed", async () => {
  const outcome = await callUpdate(
    { workspaceId: "workspace.attacker", actorUserId: "owner-1", targetUserId: "target-1", requestedRole: "admin" },
    [
      { workspace_id: "workspace.safe", user_id: "owner-1", role: "owner" },
      { workspace_id: "workspace.attacker", user_id: "target-1", role: "viewer" },
    ],
  );
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "deny_actor_insufficient_role");
  assert.equal(outcome.client.state.memberships.find((m) => m.user_id === "target-1").role, "viewer");
});

test("last owner downgrade denied end-to-end, owner count query only fires for an owner target", async () => {
  const outcome = await callUpdate(
    { workspaceId: "w-1", actorUserId: "owner-1", targetUserId: "owner-1", requestedRole: "admin" },
    [{ workspace_id: "w-1", user_id: "owner-1", role: "owner" }],
  );
  assert.equal(outcome.ok, false);
  // Self-target owner change: owner-role-change check fires before the self-update check,
  // and with only one owner in the fixture this resolves to deny_last_owner_protected.
  assert.equal(outcome.error.reason, "deny_last_owner_protected");
  assert.equal(outcome.client.state.memberships[0].role, "owner");
});

test("owner count query is skipped entirely for non-owner targets", async () => {
  const client = makeFakeSupabase([
    { workspace_id: "w-1", user_id: "owner-1", role: "owner" },
    { workspace_id: "w-1", user_id: "target-1", role: "viewer" },
  ]);
  let countQueried = false;
  const originalFrom = client.from.bind(client);
  client.from = (table) => {
    const builder = originalFrom(table);
    if (table === "workspace_memberships") {
      const originalSelect = builder.select.bind(builder);
      builder.select = (columns, opts) => {
        if (opts?.count) countQueried = true;
        return originalSelect(columns, opts);
      };
    }
    return builder;
  };

  const result = await updateWorkspaceMemberRole({ workspaceId: "w-1", actorUserId: "owner-1", targetUserId: "target-1", requestedRole: "pm" }, async () => client);
  assert.equal(result.role, "pm");
  assert.equal(countQueried, false, "countWorkspaceOwners must not be queried when target is not currently an owner");
});

test("response shape does not leak membership metadata beyond workspaceId/targetUserId/role", async () => {
  const outcome = await callUpdate(
    { workspaceId: "w-1", actorUserId: "owner-1", targetUserId: "target-1", requestedRole: "admin" },
    [
      { workspace_id: "w-1", user_id: "owner-1", role: "owner" },
      { workspace_id: "w-1", user_id: "target-1", role: "viewer" },
    ],
  );
  assert.equal(outcome.ok, true);
  assert.deepEqual(Object.keys(outcome.result).sort(), ["role", "targetUserId", "workspaceId"]);
});

test("audit event actor_user_id is always the server-resolved actorUserId, not a client-supplied field", async () => {
  const outcome = await callUpdate(
    { workspaceId: "w-1", actorUserId: "owner-1", targetUserId: "target-1", requestedRole: "admin", actorUserIdOverride: "someone-else" },
    [
      { workspace_id: "w-1", user_id: "owner-1", role: "owner" },
      { workspace_id: "w-1", user_id: "target-1", role: "viewer" },
    ],
  );
  assert.equal(outcome.ok, true);
  const event = outcome.client.state.auditEvents.find((e) => e.event_type === "member_role_updated");
  assert.equal(event.actor_user_id, "owner-1");
  assert.equal(event.payload.previousRole, "viewer");
  assert.equal(event.payload.newRole, "admin");
});
