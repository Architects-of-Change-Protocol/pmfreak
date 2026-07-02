import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import type { CommandCenterType, OwnerType } from "@/lib/command-center/command-center-types";

export type WorkspaceRow = {
  id: string;
  name: string;
};

export type CommandCenterRow = {
  id: string;
  name: string;
  commandCenterType: CommandCenterType | null;
  ownerType: OwnerType | null;
};

/**
 * A workspace only counts as a real, user-configured Command Center once it
 * has a command_center_type. Workspaces without one are auto-bootstrap rows
 * (see ensureUserWorkspace) that the user has not yet turned into a Command
 * Center — first-launch UX treats those as "no Command Center exists yet".
 */
export async function getCommandCenterById(workspaceId: string): Promise<CommandCenterRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspaces")
    .select("id, name, command_center_type, owner_type")
    .eq("id", workspaceId)
    .maybeSingle<{ id: string; name: string; command_center_type: CommandCenterType | null; owner_type: OwnerType | null }>();

  if (!data) return null;
  return { id: data.id, name: data.name, commandCenterType: data.command_center_type, ownerType: data.owner_type };
}

export async function getUserCommandCenters(userId: string): Promise<CommandCenterRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: memberships } = await supabase
    .from("workspace_memberships")
    .select("workspace_id")
    .eq("user_id", userId);

  const workspaceIds = (memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id);
  if (workspaceIds.length === 0) return [];

  type Row = { id: string; name: string; command_center_type: CommandCenterType | null; owner_type: OwnerType | null };

  const { data: workspaceRows } = await supabase
    .from("workspaces")
    .select("id, name, command_center_type, owner_type")
    .in("id", workspaceIds)
    .returns<Row[]>();

  return (workspaceRows ?? [])
    .filter((w) => w.command_center_type !== null)
    .map((w) => ({
      id: w.id,
      name: w.name,
      commandCenterType: w.command_center_type,
      ownerType: w.owner_type,
    }));
}

export type WorkspaceContext = {
  workspaceId: string;
  role: "owner" | "admin" | "pm" | "viewer";
};

// PRIVILEGED_ACCESS: Workspace bootstrap runs before the user has any membership; RLS (which restricts access to existing members) would block workspace creation and initial membership writes.
// AUDIT_REF: service-role-risk-register.md
async function ensureWorkspaceMembership(userId: string, workspaceId: string, role: WorkspaceContext["role"] = "owner") {
  const supabase = createSupabaseServiceRoleClient({ routeId: "lib.workspaces", operation: "ensure_membership", reason: "workspace_bootstrap", systemActor: "system", actorUserId: userId, workspaceId });
  const { error } = await supabase.from("workspace_memberships").upsert({ workspace_id: workspaceId, user_id: userId, role }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });
  if (error) throw new Error(`Unable to ensure workspace membership: ${error.message}`);
}

export async function ensureUserWorkspace(userId: string) {
  const supabase = createSupabaseServiceRoleClient({ routeId: "lib.workspaces", operation: "ensure_workspace", reason: "workspace_bootstrap", systemActor: "system", actorUserId: userId });

  const { data: existingMembership } = await supabase
    .from("workspace_memberships")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ workspace_id: string; role: WorkspaceContext["role"] }>();

  if (existingMembership?.workspace_id) {
    return { workspaceId: existingMembership.workspace_id, role: existingMembership.role, created: false };
  }

  const { data: createdWorkspace, error: createError } = await supabase
    .from("workspaces")
    .insert({ name: "Workspace", created_by_user_id: userId })
    .select("id")
    .single<{ id: string }>();

  if (createError || !createdWorkspace?.id) {
    console.error("[workspace-init] failed to create workspace", { userId, reason: createError?.message ?? "unknown" });
    throw new Error("Unable to initialize workspace.");
  }

  await ensureWorkspaceMembership(userId, createdWorkspace.id, "owner");

  return { workspaceId: createdWorkspace.id, role: "owner" as const, created: true };
}

export async function getActiveWorkspaceContext(userId: string): Promise<WorkspaceContext> {
  const ensured = await ensureUserWorkspace(userId);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("workspace_memberships")
    .select("workspace_id, role")
    .eq("workspace_id", ensured.workspaceId)
    .eq("user_id", userId)
    .maybeSingle<{ workspace_id: string; role: WorkspaceContext["role"] }>();

  if (!data?.workspace_id) throw new Error("Workspace membership required.");

  return { workspaceId: data.workspace_id, role: data.role };
}

export async function getUserWorkspaces(userId: string): Promise<WorkspaceRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("workspace_memberships")
    .select("workspaces(id, name)")
    .eq("user_id", userId);

  return (data ?? []).flatMap((row) => {
    const related = row.workspaces as WorkspaceRow | WorkspaceRow[] | null;
    if (!related) return [];
    return Array.isArray(related) ? related : [related];
  });
}
