"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth";
import { canAssignWorkspaceRole, normalizeWorkspaceRole, requireWorkspaceRole } from "@/lib/workspace-access";
import { inviteWorkspaceMember } from "@/lib/workspace-team";
import { buildAbuseKey, enforceAbuseLimit } from "@/lib/security/abuse-protection";

export async function sendInviteAction(formData: FormData) {
  const user = await requireAuthUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const email = String(formData.get("email") ?? "");
  const requestedRole = normalizeWorkspaceRole(formData.get("role"));

  // requireWorkspaceRole reads the actor's role directly from workspace_memberships —
  // never from display role / user_metadata.role / any client-supplied field.
  const access = await requireWorkspaceRole(workspaceId, "admin");
  if (!requestedRole || !canAssignWorkspaceRole({ actorRole: access.role, targetRole: requestedRole })) {
    throw new Error("You are not authorized to invite a member at that role.");
  }

  // Abuse protection is separate from the authorization check above: a real
  // admin/owner can still spam invites. Two policies apply — an overall
  // per-actor rate limit, and a tighter per-workspace+email cooldown so the
  // same address can't be re-invited repeatedly. See
  // docs/security/abuse-protection-boundary.md ("workspace.invite_create").
  const actorLimit = await enforceAbuseLimit({
    scope: "workspace.invite_create",
    identifier: user.id,
    limit: 20,
    windowSeconds: 3600,
  });
  if (!actorLimit.allowed) {
    throw new Error("Too many invites sent. Please wait a moment and try again.");
  }
  const emailCooldown = await enforceAbuseLimit({
    scope: "workspace.invite_create",
    action: "per_email_cooldown",
    identifier: buildAbuseKey([workspaceId, email.trim().toLowerCase()]),
    limit: 1,
    windowSeconds: 300,
  });
  if (!emailCooldown.allowed) {
    throw new Error("An invite was already sent to this address recently. Please wait before resending.");
  }

  // inviteWorkspaceMember re-validates actor and target role itself (requireWorkspaceInviteActor
  // + canAssignWorkspaceRole) — this check is a fast-fail, not the sole gate.
  await inviteWorkspaceMember({ workspaceId, companyId: user.companyId, inviterUserId: user.id, email, role: requestedRole, routeId: "/team/actions.sendInviteAction" });
  revalidatePath("/team");
}
