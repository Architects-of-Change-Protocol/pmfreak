import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectMethodology, ProjectRow, ProjectStatus } from "@/lib/db/database-contract";
import { PROJECT_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import { getPmoById } from "@/lib/pmos/pmo-service";

const PROJECT_COLUMNS = PROJECT_SELECTABLE_COLUMNS.join(", ");

export const PROJECT_METHODOLOGIES: readonly ProjectMethodology[] = ["predictive", "agile", "hybrid", "kanban", "other"] as const;
export const PROJECT_STATUSES: readonly ProjectStatus[] = ["active", "archived", "completed"] as const;

export function normalizeProjectMethodology(value: unknown): ProjectMethodology | null {
  return PROJECT_METHODOLOGIES.includes(value as ProjectMethodology) ? (value as ProjectMethodology) : null;
}

export function normalizeProjectStatus(value: unknown): ProjectStatus | null {
  return PROJECT_STATUSES.includes(value as ProjectStatus) ? (value as ProjectStatus) : null;
}

/**
 * Looks up a project's own workspace_id without pre-knowing it — the
 * authoritative source for scope derivation (never trust a caller-supplied
 * or cookie-derived workspaceId for an entity that carries its own). Callers
 * must still independently verify the caller may access the project.
 */
export async function getProjectWorkspaceId(projectId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("projects").select("workspace_id").eq("id", projectId).maybeSingle<{ workspace_id: string }>();
  return data?.workspace_id ?? null;
}

export async function getProjectInWorkspace(workspaceId: string, projectId: string): Promise<ProjectRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .maybeSingle();
  return (data as unknown as ProjectRow) ?? null;
}

export type UpdateProjectInput = Partial<{
  name: string;
  description: string | null;
  status: ProjectStatus;
  methodology: ProjectMethodology | null;
  icon: string | null;
  color: string | null;
  pmoId: string | null;
  ownerUserId: string;
}>;

export async function updateProject(workspaceId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectRow> {
  const supabase = await createSupabaseServerClient();

  if (input.pmoId) {
    const pmo = await getPmoById(workspaceId, input.pmoId);
    if (!pmo) throw new Error("Target PMO not found in this workspace.");
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.methodology !== undefined) patch.methodology = input.methodology;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.pmoId !== undefined) patch.pmo_id = input.pmoId;
  if (input.ownerUserId !== undefined) patch.user_id = input.ownerUserId;

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("workspace_id", workspaceId)
    .eq("id", projectId)
    .select(PROJECT_COLUMNS)
    .single();
  if (error || !data) throw new Error(`Unable to update project: ${error?.message ?? "unknown"}`);
  return data as unknown as ProjectRow;
}

export async function deleteProject(workspaceId: string, projectId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("projects").delete().eq("workspace_id", workspaceId).eq("id", projectId);
  if (error) throw new Error(`Unable to delete project: ${error.message}`);
}

/**
 * Duplicates a project's shell (identity, PMO, methodology, look) without its
 * operational history — conversations, memory, and evidence stay with the
 * original context by design (context isolation).
 */
export async function duplicateProject(workspaceId: string, projectId: string, createdByUserId: string): Promise<ProjectRow> {
  const source = await getProjectInWorkspace(workspaceId, projectId);
  if (!source) throw new Error("Project not found.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: createdByUserId,
      workspace_id: workspaceId,
      pmo_id: source.pmo_id,
      name: `${source.name} (copy)`,
      description: source.description,
      methodology: source.methodology,
      icon: source.icon,
      color: source.color,
      onboarding_payload: source.onboarding_payload,
    })
    .select(PROJECT_COLUMNS)
    .single();
  if (error || !data) throw new Error(`Unable to duplicate project: ${error?.message ?? "unknown"}`);
  return data as unknown as ProjectRow;
}
