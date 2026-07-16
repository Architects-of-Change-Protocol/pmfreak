import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PmoRow, PmoStatus, PmoType, ProjectRow } from "@/lib/db/database-contract";
import { PMO_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";

export type { PmoRow, PmoStatus, PmoType };

export type PmoWithProjects = PmoRow & {
  projects: Pick<ProjectRow, "id" | "name" | "status">[];
};

const PMO_COLUMNS = PMO_SELECTABLE_COLUMNS.join(", ");

export const PMO_TYPES: readonly PmoType[] = [
  "company_pmo",
  "team_portfolio",
  "independent",
  "client_portfolio",
  "improvement_program",
  "personal",
] as const;

export function normalizePmoType(value: unknown): PmoType | null {
  return PMO_TYPES.includes(value as PmoType) ? (value as PmoType) : null;
}

export async function listPmos(workspaceId: string, opts?: { includeArchived?: boolean }): Promise<PmoRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pmos")
    .select(PMO_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (!opts?.includeArchived) query = query.eq("status", "active");
  const { data, error } = await query;
  if (error) throw new Error(`Unable to list PMOs: ${error.message}`);
  return (data ?? []) as unknown as PmoRow[];
}

export async function listPmosWithProjects(workspaceId: string, opts?: { includeArchived?: boolean }): Promise<PmoWithProjects[]> {
  const supabase = await createSupabaseServerClient();
  const pmos = await listPmos(workspaceId, opts);

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status, pmo_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Unable to list projects for PMOs: ${error.message}`);

  type ProjectSlice = { id: string; name: string; status: ProjectRow["status"]; pmo_id: string | null };
  const byPmo = new Map<string, ProjectSlice[]>();
  for (const project of (projects ?? []) as ProjectSlice[]) {
    if (!project.pmo_id) continue;
    const bucket = byPmo.get(project.pmo_id) ?? [];
    bucket.push(project);
    byPmo.set(project.pmo_id, bucket);
  }

  return pmos.map((pmo) => ({
    ...pmo,
    projects: (byPmo.get(pmo.id) ?? []).map(({ id, name, status }) => ({ id, name, status })),
  }));
}

export async function getPmoById(workspaceId: string, pmoId: string): Promise<PmoRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("pmos")
    .select(PMO_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("id", pmoId)
    .maybeSingle();
  return (data as unknown as PmoRow) ?? null;
}

export type CreatePmoInput = {
  workspaceId: string;
  name: string;
  description?: string | null;
  pmoType?: PmoType;
  icon?: string | null;
  color?: string | null;
  createdByUserId: string;
};

export async function createPmo(input: CreatePmoInput): Promise<PmoRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pmos")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      description: input.description ?? null,
      pmo_type: input.pmoType ?? "company_pmo",
      icon: input.icon ?? null,
      color: input.color ?? null,
      created_by_user_id: input.createdByUserId,
    })
    .select(PMO_COLUMNS)
    .single();
  if (error || !data) throw new Error(`Unable to create PMO: ${error?.message ?? "unknown"}`);
  return data as unknown as PmoRow;
}

export type UpdatePmoInput = Partial<{
  name: string;
  description: string | null;
  pmoType: PmoType;
  icon: string | null;
  color: string | null;
  status: PmoStatus;
}>;

export async function updatePmo(workspaceId: string, pmoId: string, input: UpdatePmoInput): Promise<PmoRow> {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.pmoType !== undefined) patch.pmo_type = input.pmoType;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase
    .from("pmos")
    .update(patch)
    .eq("workspace_id", workspaceId)
    .eq("id", pmoId)
    .select(PMO_COLUMNS)
    .single();
  if (error || !data) throw new Error(`Unable to update PMO: ${error?.message ?? "unknown"}`);
  return data as unknown as PmoRow;
}

/**
 * Hard-deletes a PMO. Projects keep existing (pmo_id becomes NULL via
 * ON DELETE SET NULL) so no project data is ever lost by deleting a PMO;
 * callers should offer "move projects first" in the UI.
 */
export async function deletePmo(workspaceId: string, pmoId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("pmos").delete().eq("workspace_id", workspaceId).eq("id", pmoId);
  if (error) throw new Error(`Unable to delete PMO: ${error.message}`);
}

export async function duplicatePmo(workspaceId: string, pmoId: string, createdByUserId: string): Promise<PmoRow> {
  const source = await getPmoById(workspaceId, pmoId);
  if (!source) throw new Error("PMO not found.");
  return createPmo({
    workspaceId,
    name: `${source.name} (copy)`,
    description: source.description,
    pmoType: source.pmo_type,
    icon: source.icon,
    color: source.color,
    createdByUserId,
  });
}

/** Moves a project into a PMO (or out of any PMO with pmoId = null). Both must live in the same workspace. */
export async function moveProjectToPmo(workspaceId: string, projectId: string, pmoId: string | null): Promise<void> {
  const supabase = await createSupabaseServerClient();

  if (pmoId) {
    const target = await getPmoById(workspaceId, pmoId);
    if (!target) throw new Error("Target PMO not found in this workspace.");
  }

  const { error } = await supabase
    .from("projects")
    .update({ pmo_id: pmoId, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", projectId);
  if (error) throw new Error(`Unable to move project: ${error.message}`);
}

/**
 * Returns the workspace's default PMO (oldest active), creating one when the
 * workspace has none yet. Used to keep legacy single-PMO flows working.
 */
export async function ensureDefaultPmo(workspaceId: string, userId: string, preferredName?: string): Promise<PmoRow> {
  const existing = await listPmos(workspaceId);
  if (existing.length > 0) return existing[0];
  return createPmo({
    workspaceId,
    name: preferredName?.trim() || "General PMO",
    createdByUserId: userId,
  });
}
