// Perilla 3 — Invite Acceptance / Workspace Role Assignment Hardening.
//
// Behavioral tests for the trust boundary around workspace_memberships.role:
// who may create an invite, what role an invite may carry, and how acceptance
// validates the token/email/role before ever writing a membership row.
//
// - normalizeWorkspaceRole / canAssignWorkspaceRole / requireWorkspaceInviteActor
//   (src/lib/workspace-access.ts) are pure or DB-injectable — exercised directly,
//   the same pattern as tests/billing-authorization-workspace-membership.test.mjs.
// - acceptWorkspaceInvite (src/lib/workspace-team.ts) is exercised against a fake
//   in-memory Supabase client injected via its getSupabaseClient parameter — the
//   real validation/claim/upsert logic runs unmodified, no live database needed.

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  WORKSPACE_ROLES,
  INVITABLE_WORKSPACE_ROLES,
  normalizeWorkspaceRole,
  canAssignWorkspaceRole,
  canInviteMembers,
  requireWorkspaceInviteActor,
  WorkspaceMembershipError,
} from "../src/lib/workspace-access.ts";
import { acceptWorkspaceInvite, WorkspaceInviteError } from "../src/lib/workspace-team.ts";

// ─────────────────────────────────────────────────────────────────────────────
// normalizeWorkspaceRole / canAssignWorkspaceRole (pure)
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeWorkspaceRole: valid roles pass through unchanged", () => {
  for (const role of WORKSPACE_ROLES) assert.equal(normalizeWorkspaceRole(role), role);
});

test("normalizeWorkspaceRole: casing is normalized safely (test #13)", () => {
  assert.equal(normalizeWorkspaceRole("ADMIN"), "admin");
  assert.equal(normalizeWorkspaceRole("Viewer"), "viewer");
  assert.equal(normalizeWorkspaceRole("  owner  "), "owner");
});

test("normalizeWorkspaceRole: unknown/garbage/prototype-pollution-shaped values are rejected, never coerced (test #13)", () => {
  assert.equal(normalizeWorkspaceRole("superadmin"), null);
  assert.equal(normalizeWorkspaceRole("__proto__"), null);
  assert.equal(normalizeWorkspaceRole("constructor"), null);
  assert.equal(normalizeWorkspaceRole(""), null);
  assert.equal(normalizeWorkspaceRole(null), null);
  assert.equal(normalizeWorkspaceRole(undefined), null);
  assert.equal(normalizeWorkspaceRole(123), null);
  assert.equal(normalizeWorkspaceRole(true), null);
  assert.equal(normalizeWorkspaceRole({ toString: () => "owner" }), null);
  assert.equal(normalizeWorkspaceRole(["owner"]), null);
});

test("INVITABLE_WORKSPACE_ROLES excludes owner", () => {
  assert.deepEqual([...INVITABLE_WORKSPACE_ROLES].sort(), ["admin", "pm", "viewer"]);
});

test("canAssignWorkspaceRole: owner assignment is blocked in the normal invite flow regardless of actor (test #12)", () => {
  assert.equal(canAssignWorkspaceRole({ actorRole: "owner", targetRole: "owner" }), false);
  assert.equal(canAssignWorkspaceRole({ actorRole: "admin", targetRole: "owner" }), false);
});

test("canAssignWorkspaceRole: owner/admin actors can assign admin/pm/viewer (test #11)", () => {
  for (const actorRole of ["owner", "admin"]) {
    for (const targetRole of ["admin", "pm", "viewer"]) {
      assert.equal(canAssignWorkspaceRole({ actorRole, targetRole }), true, `${actorRole} -> ${targetRole}`);
    }
  }
});

test("canAssignWorkspaceRole: pm/viewer actors cannot assign any role, including to themselves (test #10)", () => {
  for (const actorRole of ["pm", "viewer"]) {
    for (const targetRole of WORKSPACE_ROLES) {
      assert.equal(canAssignWorkspaceRole({ actorRole, targetRole }), false, `${actorRole} -> ${targetRole}`);
    }
  }
});

test("canInviteMembers / canAssignWorkspaceRole agree on who may invite at all", () => {
  for (const role of WORKSPACE_ROLES) {
    assert.equal(canAssignWorkspaceRole({ actorRole: role, targetRole: "viewer" }), canInviteMembers(role));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// requireWorkspaceInviteActor (DB-injectable, mirrors requireBillingManageMembership)
// ─────────────────────────────────────────────────────────────────────────────

function fakeMembershipClient(row) {
  return {
    from(table) {
      assert.equal(table, "workspace_memberships", "actor gate must query workspace_memberships directly");
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

const requireActor = (input, row) => requireWorkspaceInviteActor(input, async () => fakeMembershipClient(row));

test("requireWorkspaceInviteActor: owner/admin membership resolves and returns the validated role (test #11)", async () => {
  assert.deepEqual(await requireActor({ userId: "u-owner", workspaceId: "w-1" }, { role: "owner" }), { userId: "u-owner", workspaceId: "w-1", role: "owner" });
  assert.deepEqual(await requireActor({ userId: "u-admin", workspaceId: "w-1" }, { role: "admin" }), { userId: "u-admin", workspaceId: "w-1", role: "admin" });
});

test("requireWorkspaceInviteActor: pm/viewer membership is denied — normal user cannot create invite (test #10)", async () => {
  for (const role of ["pm", "viewer"]) {
    await assert.rejects(
      () => requireActor({ userId: "u-1", workspaceId: "w-1" }, { role }),
      (error) => {
        assert.ok(error instanceof WorkspaceMembershipError);
        assert.equal(error.reason, "insufficient_role");
        return true;
      },
    );
  }
});

test("requireWorkspaceInviteActor: missing membership fails closed", async () => {
  await assert.rejects(
    () => requireActor({ userId: "u-nobody", workspaceId: "w-does-not-exist" }, undefined),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "workspace_missing");
      return true;
    },
  );
});

test("requireWorkspaceInviteActor: unrecognized/garbage role value fails closed, never silently trusted", async () => {
  await assert.rejects(() => requireActor({ userId: "u-1", workspaceId: "w-1" }, { role: "superadmin" }), WorkspaceMembershipError);
});

test("requireWorkspaceInviteActor: user_metadata.role / display role cannot influence this decision — only workspace_memberships is read (tests #14, #15)", async () => {
  // The function signature only accepts userId/workspaceId; even if a caller tries to
  // smuggle a spoofed role/displayRole/metadata field in, nothing reads it — the real
  // workspace_memberships row (here: viewer) is the only thing that decides the outcome.
  await assert.rejects(
    () =>
      requireActor(
        { userId: "u-1", workspaceId: "w-1", role: "owner", actorRole: "owner", displayRole: "admin", userMetadataRole: "admin" },
        { role: "viewer" },
      ),
    (error) => {
      assert.ok(error instanceof WorkspaceMembershipError);
      assert.equal(error.reason, "insufficient_role");
      return true;
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// acceptWorkspaceInvite — fake in-memory Supabase client
// ─────────────────────────────────────────────────────────────────────────────

// Perilla 11: the table stores sha256(token) in `token_hash`, never the
// plaintext — fixtures carry the hash of the token the test presents.
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function baseInvite(overrides = {}) {
  return {
    id: "invite-1",
    workspace_id: "workspace.demo",
    email: "user@example.com",
    role: "viewer",
    status: "pending",
    token_hash: sha256("valid-token"),
    expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    ...overrides,
  };
}

function makeFakeSupabase(invite) {
  const state = { invite: invite ? { ...invite } : null, memberships: [], auditEvents: [] };

  function invitationsBuilder() {
    const builder = {
      _filters: {},
      _patch: null,
      select() {
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
      gt() {
        return this;
      },
      _matches() {
        if (!state.invite) return false;
        return Object.entries(this._filters).every(([key, value]) => String(state.invite[key]) === String(value));
      },
      _execute() {
        if (!this._matches()) return { data: null, error: null };
        if (this._patch) {
          Object.assign(state.invite, this._patch);
          return { data: { id: state.invite.id }, error: null };
        }
        return { data: { ...state.invite }, error: null };
      },
      async maybeSingle() {
        return this._execute();
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
      if (table === "workspace_invitations") return invitationsBuilder();
      if (table === "workspace_memberships") {
        return {
          async upsert(row) {
            state.memberships.push(row);
            return { error: null };
          },
        };
      }
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

async function callAccept(input, invite) {
  const client = makeFakeSupabase(invite);
  try {
    const result = await acceptWorkspaceInvite(input, async () => client);
    return { ok: true, result, client };
  } catch (error) {
    return { ok: false, error, client };
  }
}

test("acceptWorkspaceInvite: client-supplied role/isOwner/workspaceRole fields are ignored — membership role always comes from the invite record (tests #1, #2, #16)", async () => {
  const invite = baseInvite({ role: "viewer" });
  const outcome = await callAccept(
    { token: "valid-token", userId: "u-1", userEmail: "user@example.com", role: "owner", workspaceRole: "admin", isOwner: true, isAdmin: true },
    invite,
  );
  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.role, "viewer");
  assert.equal(outcome.client.state.memberships.length, 1);
  assert.equal(outcome.client.state.memberships[0].role, "viewer");
});

test("acceptWorkspaceInvite: invalid/unknown token fails closed — no membership created (test #3)", async () => {
  const outcome = await callAccept({ token: "does-not-exist", userId: "u-1", userEmail: "user@example.com" }, null);
  assert.equal(outcome.ok, false);
  assert.ok(outcome.error instanceof WorkspaceInviteError);
  assert.equal(outcome.error.reason, "invalid_token");
  assert.equal(outcome.client.state.memberships.length, 0);
});

test("acceptWorkspaceInvite: empty token fails closed", async () => {
  const outcome = await callAccept({ token: "   ", userId: "u-1", userEmail: "user@example.com" }, baseInvite());
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "invalid_token");
});

test("acceptWorkspaceInvite: expired invite fails closed and marks status expired server-side — no membership created (test #4)", async () => {
  const invite = baseInvite({ expires_at: new Date(Date.now() - 1000).toISOString() });
  const outcome = await callAccept({ token: "valid-token", userId: "u-1", userEmail: "user@example.com" }, invite);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "expired");
  assert.equal(outcome.client.state.memberships.length, 0);
  assert.equal(outcome.client.state.invite.status, "expired");
});

test("acceptWorkspaceInvite: revoked invite fails closed — no membership created (test #5)", async () => {
  const invite = baseInvite({ status: "revoked" });
  const outcome = await callAccept({ token: "valid-token", userId: "u-1", userEmail: "user@example.com" }, invite);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "revoked");
  assert.equal(outcome.client.state.memberships.length, 0);
});

test("acceptWorkspaceInvite: already-accepted invite fails closed — no replay, no membership created (test #6)", async () => {
  const invite = baseInvite({ status: "accepted", role: "admin" });
  const outcome = await callAccept({ token: "valid-token", userId: "attacker", userEmail: "user@example.com" }, invite);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "already_used");
  assert.equal(outcome.client.state.memberships.length, 0);
});

test("acceptWorkspaceInvite: a used token cannot replay elevation against an existing membership (test #17)", async () => {
  const invite = baseInvite({ status: "accepted", role: "admin" });
  const client = makeFakeSupabase(invite);
  client.state.memberships.push({ workspace_id: invite.workspace_id, user_id: "u-1", role: "viewer" });

  const outcome = await acceptWorkspaceInvite({ token: "valid-token", userId: "u-1", userEmail: "user@example.com" }, async () => client).then(
    (result) => ({ ok: true, result }),
    (error) => ({ ok: false, error }),
  );

  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "already_used");
  assert.equal(client.state.memberships.length, 1, "no new membership row written");
  assert.equal(client.state.memberships[0].role, "viewer", "existing membership role must not be escalated");
});

test("acceptWorkspaceInvite: replaying the same token after a successful accept is rejected, not re-accepted (single-use)", async () => {
  const invite = baseInvite();
  const client = makeFakeSupabase(invite);
  const first = await acceptWorkspaceInvite({ token: "valid-token", userId: "u-1", userEmail: "user@example.com" }, async () => client);
  assert.equal(first.role, "viewer");
  assert.equal(client.state.memberships.length, 1);

  await assert.rejects(
    () => acceptWorkspaceInvite({ token: "valid-token", userId: "u-1", userEmail: "user@example.com" }, async () => client),
    (error) => {
      assert.ok(error instanceof WorkspaceInviteError);
      assert.equal(error.reason, "already_used");
      return true;
    },
  );
  assert.equal(client.state.memberships.length, 1, "replay must not create a second membership row");
});

test("acceptWorkspaceInvite: email mismatch fails closed and does not consume the invite (test #7)", async () => {
  const invite = baseInvite({ email: "invited@example.com" });
  const outcome = await callAccept({ token: "valid-token", userId: "attacker", userEmail: "attacker@example.com" }, invite);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "email_mismatch");
  assert.equal(outcome.client.state.memberships.length, 0);
  assert.equal(outcome.client.state.invite.status, "pending", "a wrong-email attempt must not burn the invite for the real invitee");
});

test("acceptWorkspaceInvite: email match is case-insensitive but still required", async () => {
  const invite = baseInvite({ email: "User@Example.com" });
  const outcome = await callAccept({ token: "valid-token", userId: "u-1", userEmail: "user@example.com" }, invite);
  assert.equal(outcome.ok, true);
});

test("acceptWorkspaceInvite: client-supplied workspaceId is ignored — membership always uses the invite's own workspace (test #8)", async () => {
  const invite = baseInvite({ workspace_id: "workspace.safe" });
  const outcome = await callAccept({ token: "valid-token", userId: "u-1", userEmail: "user@example.com", workspaceId: "workspace.attacker" }, invite);
  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.workspaceId, "workspace.safe");
  assert.equal(outcome.client.state.memberships[0].workspace_id, "workspace.safe");
});

test("acceptWorkspaceInvite: normal valid acceptance succeeds with the invite's role (test #9)", async () => {
  for (const role of ["admin", "pm", "viewer"]) {
    const invite = baseInvite({ id: `invite-${role}`, role, token_hash: sha256(`token-${role}`) });
    const outcome = await callAccept({ token: `token-${role}`, userId: `u-${role}`, userEmail: "user@example.com" }, invite);
    assert.equal(outcome.ok, true, role);
    assert.equal(outcome.result.role, role);
    assert.equal(outcome.client.state.invite.status, "accepted");
    assert.equal(outcome.client.state.invite.accepted_by_user_id, `u-${role}`);
    assert.ok(outcome.client.state.auditEvents.some((event) => event.event_type === "invitation_accepted"));
  }
});

test("acceptWorkspaceInvite: an invite record with an invalid/garbage stored role fails closed (test #13)", async () => {
  const invite = baseInvite({ role: "superadmin" });
  const outcome = await callAccept({ token: "valid-token", userId: "u-1", userEmail: "user@example.com" }, invite);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.error.reason, "invalid_role");
  assert.equal(outcome.client.state.memberships.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Workspace creator owner flow is separate from invite acceptance (test #18)
// ─────────────────────────────────────────────────────────────────────────────

test("workspace creator owner assignment is a hardcoded server-side literal, not client-derived (source scan)", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/lib/workspaces.ts", import.meta.url), "utf8");
  // createWorkspace (the explicit "New Workspace" flow) still assigns owner
  // via the same ensureWorkspaceMembership helper with a literal string.
  assert.match(
    source,
    /ensureWorkspaceMembership\(userId, created\.id, "owner"\)/,
    "createWorkspace must assign owner via a literal string, never a variable derived from client input",
  );
  // PMF-004: first-login bootstrap (ensureUserWorkspace) now creates its
  // workspace+membership atomically via the ensure_user_workspace RPC
  // (20260831000000_pmo_command_center_activation_idempotency.sql) instead
  // of a raw check-then-insert, closing a concurrent-duplicate-workspace
  // race. The owner-role assignment moved into that SQL function, still as
  // a hardcoded literal, never a parameter.
  assert.match(
    source,
    /supabase\.rpc\("ensure_user_workspace"/,
    "first-login bootstrap must call the advisory-lock-guarded RPC, not a raw insert",
  );
  const migration = await fs.readFile(
    new URL("../supabase/migrations/20260831000000_pmo_command_center_activation_idempotency.sql", import.meta.url),
    "utf8",
  );
  const fn = migration.slice(migration.indexOf("create function ensure_user_workspace"));
  assert.match(
    fn,
    /values \(v_workspace\.id, p_user_id, 'owner'\)/,
    "ensure_user_workspace must assign owner via a literal string, never a parameter derived from client input",
  );
  assert.doesNotMatch(fn, /p_role/, "ensure_user_workspace must not accept a caller-supplied role parameter");
});
