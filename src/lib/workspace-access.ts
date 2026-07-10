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
