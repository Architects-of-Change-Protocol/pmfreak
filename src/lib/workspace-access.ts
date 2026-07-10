import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const WORKSPACE_ROLES = ["owner", "admin", "pm", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

const roleRank: Record<WorkspaceRole, number> = { owner: 4, admin: 3, pm: 2, viewer: 1 };

export async function requireWorkspaceRole(workspaceId: string, minimumRole: WorkspaceRole) {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: WorkspaceRole }>();

  if (!data?.role || roleRank[data.role] < roleRank[minimumRole]) {
    throw new Error("Insufficient workspace permissions.");
  }

  return { user, role: data.role };
}

export const canManageWorkspace = (role: WorkspaceRole) => role === "owner" || role === "admin";
export const canInviteMembers = (role: WorkspaceRole) => role === "owner" || role === "admin";

/**
 * Safely coerces an untrusted value (client body/formData, invite record, historical
 * metadata) into a WorkspaceRole. Returns null instead of throwing so callers must
 * explicitly decide the fail-closed behavior. Trims and lowercases before matching
 * against the closed WORKSPACE_ROLES set, so "ADMIN" normalizes to "admin" but
 * "superadmin" / "__proto__" / anything outside the set is rejected, never coerced.
 */
export function normalizeWorkspaceRole(value: unknown): WorkspaceRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (WORKSPACE_ROLES as readonly string[]).includes(normalized) ? (normalized as WorkspaceRole) : null;
}

/**
 * Roles that may ever be assigned through an invite. "owner" is deliberately excluded:
 * no public/normal invite flow may grant workspace ownership (see
 * docs/security/invite-workspace-role-boundary.md). Owner is only ever assigned by the
 * workspace-creation bootstrap (ensureWorkspaceMembership in src/lib/workspaces.ts, which
 * hardcodes "owner" server-side for the creator of a brand-new workspace) — never through
 * this invite path.
 */
export const INVITABLE_WORKSPACE_ROLES: readonly WorkspaceRole[] = ["admin", "pm", "viewer"];

/**
 * Authorization policy for "can actorRole invite/assign targetRole": actor must already
 * be able to invite at all (owner/admin), and the target role must be one of the
 * invitable roles (never "owner", regardless of actor). This is the single source of
 * truth for invite-role policy — invite creation must call this instead of only
 * checking targetRole against the full WORKSPACE_ROLES set.
 */
export function canAssignWorkspaceRole(input: { actorRole: WorkspaceRole; targetRole: WorkspaceRole }): boolean {
  if (!canInviteMembers(input.actorRole)) return false;
  return (INVITABLE_WORKSPACE_ROLES as readonly string[]).includes(input.targetRole);
}

/**
 * Billing policy: owner and admin can manage billing (create checkout sessions,
 * open the billing portal, change plans). pm and viewer cannot. This is the
 * authorization boundary for the `billing.manage` action — see
 * `docs/security/billing-authorization-boundary.md`.
 */
export const canManageBilling = (role: WorkspaceRole) => role === "owner" || role === "admin";

export type BillingManageDenialReason = "workspace_missing" | "insufficient_role";

export class WorkspaceMembershipError extends Error {
  readonly reason: BillingManageDenialReason;

  constructor(reason: BillingManageDenialReason, message: string) {
    super(message);
    this.name = "WorkspaceMembershipError";
    this.reason = reason;
  }
}

export type BillingManageMembership = { userId: string; workspaceId: string; role: WorkspaceRole };

/**
 * Authoritative, server-side gate for `billing.manage` actions (checkout session
 * creation, billing portal access, plan changes). The role is read directly from
 * `workspace_memberships` — it is never taken from `AuthUserContext.role`,
 * `user_metadata.role`, or any client-supplied field, all of which are
 * client-influenced or historically untrustworthy. Fails closed: a missing
 * workspace, missing membership, or unrecognized/insufficient role is denied.
 *
 * `getSupabaseClient` defaults to the real server client; tests inject a fake
 * to exercise this function's real logic without a live database.
 */
export async function requireBillingManageMembership(
  input: { userId: string; workspaceId: string },
  getSupabaseClient: () => Promise<Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">> = createSupabaseServerClient,
): Promise<BillingManageMembership> {
  const supabase = await getSupabaseClient();
  const { data } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle<{ role: string }>();

  const role = data?.role;
  if (!role || !WORKSPACE_ROLES.includes(role as WorkspaceRole)) {
    throw new WorkspaceMembershipError("workspace_missing", "No active workspace membership found for this user.");
  }

  if (!canManageBilling(role as WorkspaceRole)) {
    throw new WorkspaceMembershipError("insufficient_role", `Workspace role "${role}" is not authorized to manage billing.`);
  }

  return { userId: input.userId, workspaceId: input.workspaceId, role: role as WorkspaceRole };
}

export type WorkspaceInviteActor = { userId: string; workspaceId: string; role: WorkspaceRole };

/**
 * Authoritative, server-side gate for "who may create a workspace invite": the actor's
 * role is read directly from `workspace_memberships` — never from `AuthUserContext.role`,
 * `user_metadata.role`, or any client-supplied field — and must satisfy `canInviteMembers`
 * (owner/admin only). Fails closed on a missing membership or insufficient role.
 *
 * This is deliberately a small, directly-testable DB lookup rather than a call through
 * the generic AOC governance pipeline (`requireGovernancePermission` in
 * src/lib/security/access-guards.ts): that pipeline's role vocabulary
 * (src/lib/security/rbac.ts) uses a different casing ("PM" vs the DB's "pm") than the
 * WORKSPACE_ROLES used here, so it cannot be relied on as the sole authority for this
 * decision. See docs/security/invite-workspace-role-boundary.md.
 *
 * `getSupabaseClient` defaults to the real server client; tests inject a fake to
 * exercise this function's real logic without a live database.
 */
export async function requireWorkspaceInviteActor(
  input: { userId: string; workspaceId: string },
  getSupabaseClient: () => Promise<Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">> = createSupabaseServerClient,
): Promise<WorkspaceInviteActor> {
  const supabase = await getSupabaseClient();
  const { data } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle<{ role: string }>();

  const role = data?.role;
  if (!role || !WORKSPACE_ROLES.includes(role as WorkspaceRole)) {
    throw new WorkspaceMembershipError("workspace_missing", "No active workspace membership found for this user.");
  }

  if (!canInviteMembers(role as WorkspaceRole)) {
    throw new WorkspaceMembershipError("insufficient_role", `Workspace role "${role}" is not authorized to invite members.`);
  }

  return { userId: input.userId, workspaceId: input.workspaceId, role: role as WorkspaceRole };
}
