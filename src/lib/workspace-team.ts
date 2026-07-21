import { requireSeatAvailability } from "@/lib/feature-gates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { requireGovernancePermission } from "@/lib/security/access-guards";
import { requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createWorkspaceInviteToken, hashWorkspaceInviteToken, resolveInviteTtlHours } from "@/lib/security/invite-tokens";
import {
  canAssignWorkspaceRole,
  canUpdateWorkspaceMemberRole,
  countWorkspaceOwners,
  normalizeWorkspaceRole,
  requireWorkspaceInviteActor,
  requireWorkspaceRoleUpdateActor,
  requireWorkspaceRoleUpdateTarget,
  type WorkspaceRole,
  type WorkspaceRoleUpdateDecision,
} from "@/lib/workspace-access";

type MinimalSupabaseClient = {
  from: ReturnType<typeof createSupabaseServiceRoleClient>["from"];
};

export type WorkspaceInviteDenialReason =
  | "invalid_token"
  | "invalid_role"
  | "email_mismatch"
  | "expired"
  | "revoked"
  | "already_used";

export class WorkspaceInviteError extends Error {
  readonly reason: WorkspaceInviteDenialReason;

  constructor(reason: WorkspaceInviteDenialReason, message: string) {
    super(message);
    this.name = "WorkspaceInviteError";
    this.reason = reason;
  }
}

export async function getWorkspaceSeatSnapshot(input: { workspaceId: string; companyId: string; actorUserId: string; routeId: string }) {
  await requireGovernancePermission(input.workspaceId, "manage_members");
  // SCOPED_CLIENT: RLS policy added in 20260515100000_rls_governance_fixes.sql
  const supabase = await createSupabaseServerClient();
  const [{ count: activeSeats }, { count: pendingInvites }] = await Promise.all([
    supabase.from("workspace_memberships").select("user_id", { head: true, count: "exact" }).eq("workspace_id", input.workspaceId),
    supabase
      .from("workspace_invitations")
      .select("id", { head: true, count: "exact" })
      .eq("workspace_id", input.workspaceId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);

  const usedSeats = (activeSeats ?? 0) + (pendingInvites ?? 0);
  const seatGate = await requireSeatAvailability(input.companyId, usedSeats);
  return { activeSeats: activeSeats ?? 0, pendingInvites: pendingInvites ?? 0, usedSeats, seatGate };
}

/**
 * Creates a workspace invitation. The invited role is validated server-side against the
 * actor's own workspace role via `requireWorkspaceInviteActor` + `canAssignWorkspaceRole`
 * (src/lib/workspace-access.ts) — this is the authoritative gate and does not depend on
 * the caller having already checked the actor's permissions. "owner" can never be the
 * invited role through this path, regardless of the actor's own role (see
 * docs/security/invite-workspace-role-boundary.md).
 *
 * Token handling (Perilla 11): only sha256(token) is persisted (`token_hash`).
 * The plaintext token exists exactly once — in the returned `acceptPath` — and
 * is never written to the database, audit events, or logs. Losing the returned
 * value means regenerating the invitation; it cannot be recovered.
 */
export async function inviteWorkspaceMember(input: {
  workspaceId: string;
  companyId: string;
  inviterUserId: string;
  email: string;
  role: unknown;
  routeId: string;
}): Promise<{ acceptPath: string; expiresAt: string }> {
  const actor = await requireWorkspaceInviteActor({ userId: input.inviterUserId, workspaceId: input.workspaceId });

  const targetRole = normalizeWorkspaceRole(input.role);
  if (!targetRole || !canAssignWorkspaceRole({ actorRole: actor.role, targetRole })) {
    throw new Error("You are not authorized to invite a member at that role.");
  }

  // Additional governance pipeline check (audit trail + seat accounting side effects).
  // Not the authoritative actor gate — requireWorkspaceInviteActor above is.
  await requireGovernancePermission(input.workspaceId, "manage_members");
  // SCOPED_CLIENT: RLS policy added in 20260515100000_rls_governance_fixes.sql
  const supabase = await createSupabaseServerClient();
  const normalizedEmail = input.email.trim().toLowerCase();

  const { data: duplicate } = await supabase
    .from("workspace_invitations")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ id: string }>();
  if (duplicate?.id) throw new Error("An active invitation already exists for this email.");

  const snapshot = await getWorkspaceSeatSnapshot({ workspaceId: input.workspaceId, companyId: input.companyId, actorUserId: input.inviterUserId, routeId: input.routeId });
  if (!snapshot.seatGate.ok) throw new Error(`Seat limit reached (${snapshot.seatGate.seatLimit}).`);

  const token = createWorkspaceInviteToken();
  const expiresAt = new Date(Date.now() + resolveInviteTtlHours() * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: input.workspaceId,
    company_id: input.companyId,
    email: normalizedEmail,
    role: targetRole,
    token_hash: hashWorkspaceInviteToken(token),
    invited_by_user_id: input.inviterUserId,
    expires_at: expiresAt,
    status: "pending",
  });
  if (error) throw new Error(error.message);

  await supabase.from("workspace_audit_events").insert({
    workspace_id: input.workspaceId,
    actor_user_id: input.inviterUserId,
    event_type: "invitation_sent",
    payload: { email: normalizedEmail, role: targetRole, expiresAt },
  });

  return { acceptPath: `/accept-invite/${encodeURIComponent(token)}`, expiresAt };
}

type ResolvedWorkspaceInvite = {
  inviteId: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
};

async function resolveValidWorkspaceInvite(token: string, supabase: MinimalSupabaseClient): Promise<ResolvedWorkspaceInvite> {
  const trimmedToken = token.trim();
  if (!trimmedToken) throw new WorkspaceInviteError("invalid_token", "Invite token is required.");

  // Lookup is by sha256(token) — the table stores only `token_hash`, never the
  // plaintext. Legacy plaintext-token rows (pre-hashing) have no token_hash and
  // were revoked by 20260820000000_workspace_invite_token_hashing.sql, so a
  // legacy plaintext token can never resolve to an invite again.
  const { data: invite } = await supabase
    .from("workspace_invitations")
    .select("id, workspace_id, email, role, status, expires_at")
    .eq("token_hash", hashWorkspaceInviteToken(trimmedToken))
    .maybeSingle<{ id: string; workspace_id: string; email: string; role: string; status: string; expires_at: string }>();

  if (!invite) throw new WorkspaceInviteError("invalid_token", "Invite not found.");

  const role = normalizeWorkspaceRole(invite.role);
  if (!role) throw new WorkspaceInviteError("invalid_role", "Invite has an invalid role.");

  if (invite.status === "revoked") throw new WorkspaceInviteError("revoked", "Invitation has been revoked.");
  if (invite.status === "accepted") throw new WorkspaceInviteError("already_used", "Invitation has already been accepted.");
  if (invite.status !== "pending") throw new WorkspaceInviteError("expired", "Invitation is no longer active.");

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    await supabase.from("workspace_invitations").update({ status: "expired" }).eq("id", invite.id).eq("status", "pending");
    throw new WorkspaceInviteError("expired", "Invitation has expired.");
  }

  return { inviteId: invite.id, workspaceId: invite.workspace_id, email: invite.email, role };
}

function assertInviteBelongsToAuthenticatedEmail(input: { inviteEmail: string; userEmail: string }) {
  const inviteEmail = input.inviteEmail.trim().toLowerCase();
  const userEmail = input.userEmail.trim().toLowerCase();
  if (!userEmail || inviteEmail !== userEmail) {
    throw new WorkspaceInviteError("email_mismatch", "This invitation was issued to a different email address.");
  }
}

export type AcceptedWorkspaceInvite = { workspaceId: string; role: WorkspaceRole; inviteId: string };

/**
 * Accepts a workspace invitation. This is the sole path by which a `workspace_memberships`
 * row is created from an invite, and it deliberately accepts only `token`, `userId`, and
 * `userEmail` — there is no `role`/`workspaceId`/`workspaceRole` parameter, so a caller
 * cannot smuggle an elevated role or a different target workspace in even by accident.
 * The assigned role and workspace always come from the server-side invite record
 * resolved by `resolveValidWorkspaceInvite`.
 *
 * Fails closed on: invalid/unknown token, invalid stored role, email mismatch, revoked,
 * expired, or already-used invites. The pending→accepted transition is a single
 * conditional UPDATE (`.eq("status", "pending")`) whose result is checked before any
 * membership write, so a concurrent replay of the same token can win the race at most
 * once — the loser gets `already_used` and never reaches the membership upsert.
 */
export async function acceptWorkspaceInvite(
  input: { token: string; userId: string; userEmail: string },
  getSupabaseClient: () => Promise<MinimalSupabaseClient> = async () =>
    createSupabaseServiceRoleClient({
      routeId: "lib.workspace-team.acceptWorkspaceInvite",
      operation: "accept_invite",
      reason: "existing_privileged_flow",
      systemActor: "system",
      actorUserId: input.userId,
    }),
): Promise<AcceptedWorkspaceInvite> {
  const supabase = await getSupabaseClient();
  const invite = await resolveValidWorkspaceInvite(input.token, supabase);

  assertInviteBelongsToAuthenticatedEmail({ inviteEmail: invite.email, userEmail: input.userEmail });

  const { data: claimed } = await supabase
    .from("workspace_invitations")
    .update({ status: "accepted", accepted_by_user_id: input.userId, accepted_at: new Date().toISOString() })
    .eq("id", invite.inviteId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (!claimed?.id) throw new WorkspaceInviteError("already_used", "Invitation has already been used.");

  const { error: memberError } = await supabase
    .from("workspace_memberships")
    .upsert({ workspace_id: invite.workspaceId, user_id: input.userId, role: invite.role }, { onConflict: "workspace_id,user_id" });
  if (memberError) throw new Error(memberError.message);

  await supabase.from("workspace_audit_events").insert({
    workspace_id: invite.workspaceId,
    actor_user_id: input.userId,
    event_type: "invitation_accepted",
    payload: { invitationId: invite.inviteId },
  });

  return { workspaceId: invite.workspaceId, role: invite.role, inviteId: invite.inviteId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace member role update (Perilla 4).
// ─────────────────────────────────────────────────────────────────────────────

export class WorkspaceRoleUpdateError extends Error {
  readonly reason: WorkspaceRoleUpdateDecision;

  constructor(reason: WorkspaceRoleUpdateDecision, message: string) {
    super(message);
    this.name = "WorkspaceRoleUpdateError";
    this.reason = reason;
  }
}

export type UpdatedWorkspaceMemberRole = { workspaceId: string; targetUserId: string; role: WorkspaceRole };

/**
 * Updates an existing workspace member's role. This is the sole authorized path to change
 * `workspace_memberships.role` for a member who already has a row — as opposed to creating
 * one, which is `ensureWorkspaceMembership` (workspace-creation bootstrap) or
 * `acceptWorkspaceInvite` (invite acceptance) above. Every decision-relevant value is
 * resolved server-side, never trusted from a client-supplied field:
 *
 *  - `requestedTargetRole` — `normalizeWorkspaceRole(input.requestedRole)`; fails closed
 *    (`deny_invalid_role`) on anything outside the closed `WORKSPACE_ROLES` set, before any
 *    database call.
 *  - `actorRole` — `requireWorkspaceRoleUpdateActor` reads the caller's OWN row from
 *    `workspace_memberships`. Callers must pass the authenticated session user's id as
 *    `actorUserId`; this function has no `body.actorRole`/`isOwner`/`isAdmin` parameter for
 *    anything else to smuggle a role through.
 *  - `currentTargetRole` — `requireWorkspaceRoleUpdateTarget` reads the target's row; fails
 *    closed (`deny_target_not_member`) if the target has no membership in this workspace.
 *  - `isLastOwner` — `countWorkspaceOwners`, only queried when the target currently holds
 *    `"owner"` (avoids an unnecessary query for the common non-owner case).
 *
 * `canUpdateWorkspaceMemberRole` (src/lib/workspace-access.ts) is the sole policy gate — the
 * `UPDATE` only runs when it returns `"allow"`. See
 * docs/security/workspace-role-update-boundary.md.
 *
 * A single privileged client is used for the whole operation (actor lookup, target lookup,
 * owner count, and the update itself): `workspace_memberships` has no RLS policy permitting
 * client-side UPDATEs at all (see 20260515100000_rls_governance_fixes.sql — read-only SELECT
 * policies), so the write must go through the service role regardless of actor role, and using
 * one privileged client for every read in this flow avoids a visibility mismatch where an
 * RLS-scoped client could resolve "target not found" for a real member simply because the
 * *actor* lacks read visibility into other members' rows.
 */
export async function updateWorkspaceMemberRole(
  input: { workspaceId: string; actorUserId: string; targetUserId: string; requestedRole: unknown },
  getSupabaseClient: () => Promise<MinimalSupabaseClient> = async () =>
    createSupabaseServiceRoleClient({
      routeId: "lib.workspace-team.updateWorkspaceMemberRole",
      operation: "update_member_role",
      reason: "existing_privileged_flow",
      systemActor: "system",
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
    }),
): Promise<UpdatedWorkspaceMemberRole> {
  const requestedTargetRole = normalizeWorkspaceRole(input.requestedRole);
  if (!requestedTargetRole) {
    throw new WorkspaceRoleUpdateError("deny_invalid_role", "Requested role is not a recognized workspace role.");
  }

  const supabase = await getSupabaseClient();
  const asSupabaseClient = async () => supabase;

  const actor = await requireWorkspaceRoleUpdateActor({ userId: input.actorUserId, workspaceId: input.workspaceId }, asSupabaseClient).catch(
    () => null,
  );
  if (!actor) {
    throw new WorkspaceRoleUpdateError("deny_actor_insufficient_role", "No active workspace membership found for the requesting user.");
  }

  const target = await requireWorkspaceRoleUpdateTarget(
    { workspaceId: input.workspaceId, targetUserId: input.targetUserId },
    asSupabaseClient,
  ).catch(() => null);
  if (!target) {
    throw new WorkspaceRoleUpdateError("deny_target_not_member", "Target user is not an active member of this workspace.");
  }

  let isLastOwner = false;
  if (target.role === "owner") {
    const ownerCount = await countWorkspaceOwners({ workspaceId: input.workspaceId }, asSupabaseClient);
    isLastOwner = ownerCount <= 1;
  }

  const decision = canUpdateWorkspaceMemberRole({
    actorRole: actor.role,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    currentTargetRole: target.role,
    requestedTargetRole,
    isLastOwner,
  });

  if (decision !== "allow") throw new WorkspaceRoleUpdateError(decision, `Role update denied: ${decision}`);

  const { error } = await supabase
    .from("workspace_memberships")
    .update({ role: requestedTargetRole })
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.targetUserId);
  if (error) throw new Error(error.message);

  await supabase.from("workspace_audit_events").insert({
    workspace_id: input.workspaceId,
    actor_user_id: input.actorUserId,
    event_type: "member_role_updated",
    payload: { targetUserId: input.targetUserId, previousRole: target.role, newRole: requestedTargetRole },
  });

  return { workspaceId: input.workspaceId, targetUserId: input.targetUserId, role: requestedTargetRole };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace member listing for assignment (Quick Add Task assignee selector).
// ─────────────────────────────────────────────────────────────────────────────

export type AssignableWorkspaceMember = {
  userId: string;
  displayName: string;
  email: string | null;
  role: WorkspaceRole;
};

/**
 * Lists real members of a workspace for use in an assignee selector — never
 * a fabricated directory. Requires the caller to already be a member of the
 * workspace being listed (requireWorkspaceMember) as the authorization gate,
 * then reads the roster and resolves display name/email via the
 * service-role client. The roster read itself must also go through the
 * service-role client, not the caller's RLS-scoped one: workspace_memberships'
 * SELECT policies only let a non-admin read their OWN row
 * (users_can_read_own_workspace_memberships) — owners/admins can read the
 * full roster, everyone else cannot (20260515100000_rls_governance_fixes.sql).
 * A PM (the activation step's minimumActionRole for adding tasks) would
 * otherwise see only themself here. auth.admin.getUserById is likewise the
 * only source for another user's display name/email, since this codebase
 * has no `profiles` table (see getCompanyIdByUserId in feature-gates.ts for
 * the same pattern).
 */
export async function listWorkspaceMembersForAssignment(workspaceId: string): Promise<AssignableWorkspaceMember[]> {
  await requireWorkspaceMember(workspaceId);

  const admin = createSupabaseServiceRoleClient({
    routeId: "lib.workspace-team.listWorkspaceMembersForAssignment",
    operation: "resolve_member_display_names",
    reason: "assignee_selector",
    systemActor: "system",
    workspaceId,
  });

  const { data: memberships, error } = await admin
    .from("workspace_memberships")
    .select("user_id, role")
    .eq("workspace_id", workspaceId);
  if (error || !memberships) return [];

  const resolved = await Promise.all(
    memberships.map(async (membership) => {
      const role = normalizeWorkspaceRole(membership.role);
      if (!role) return null;
      const { data, error: userError } = await admin.auth.admin.getUserById(membership.user_id);
      if (userError || !data.user) return null;
      const metadata = data.user.user_metadata ?? {};
      const displayName = typeof metadata.full_name === "string" && metadata.full_name.trim() ? metadata.full_name : (data.user.email ?? "Workspace member");
      return { userId: membership.user_id, displayName, email: data.user.email ?? null, role } satisfies AssignableWorkspaceMember;
    }),
  );

  return resolved.filter((member): member is AssignableWorkspaceMember => member !== null);
}
