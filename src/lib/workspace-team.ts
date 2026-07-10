import crypto from "node:crypto";
import { requireSeatAvailability } from "@/lib/feature-gates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { requireGovernancePermission } from "@/lib/security/access-guards";
import {
  canAssignWorkspaceRole,
  normalizeWorkspaceRole,
  requireWorkspaceInviteActor,
  type WorkspaceRole,
} from "@/lib/workspace-access";

const INVITE_TTL_DAYS = 7;

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
 */
export async function inviteWorkspaceMember(input: {
  workspaceId: string;
  companyId: string;
  inviterUserId: string;
  email: string;
  role: unknown;
  routeId: string;
}) {
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

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: input.workspaceId,
    company_id: input.companyId,
    email: normalizedEmail,
    role: targetRole,
    token,
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

  const { data: invite } = await supabase
    .from("workspace_invitations")
    .select("id, workspace_id, email, role, status, expires_at")
    .eq("token", trimmedToken)
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
