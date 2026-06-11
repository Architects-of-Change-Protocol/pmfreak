import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import type { ProjectMilestoneRow, ProjectMilestoneType, ProjectMilestoneStatus } from "@/lib/db/database-contract";
import { PROJECT_MILESTONE_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";

const MILESTONE_SELECT = PROJECT_MILESTONE_SELECTABLE_COLUMNS.join(",");

const VALID_TYPES: ProjectMilestoneType[] = [
  "kickoff", "discovery", "design", "approval", "delivery",
  "deployment", "training", "acceptance", "go_live", "handover", "other",
];

const VALID_STATUSES: ProjectMilestoneStatus[] = [
  "planned", "at_risk", "blocked", "completed", "cancelled",
];

export type MilestoneResult =
  | { ok: true; milestone: ProjectMilestoneRow }
  | { ok: false; error: string; failureClass: string };

export async function createProjectMilestone(input: {
  projectId: string;
  title: string;
  description?: string | null;
  milestoneType?: ProjectMilestoneType;
  targetDate?: string | null;
  baselineDate?: string | null;
  forecastDate?: string | null;
  sourceType?: string;
  sourcePayload?: Record<string, unknown>;
  confidenceScore?: number | null;
}): Promise<MilestoneResult> {
  let userId: string;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  try {
    await requireProjectAccess(input.projectId, "read");
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization failed.", failureClass: "unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id,workspace_id")
    .eq("id", input.projectId)
    .maybeSingle<{ id: string; workspace_id: string }>();

  if (!project) {
    return { ok: false, error: "Project not found.", failureClass: "not_found" };
  }

  const workspaceId = project.workspace_id;

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "title is required.", failureClass: "validation_failed" };
  }

  const milestoneType = input.milestoneType ?? "delivery";
  if (!VALID_TYPES.includes(milestoneType)) {
    return { ok: false, error: `Invalid milestone_type: ${milestoneType}`, failureClass: "validation_failed" };
  }

  if (input.targetDate) {
    const d = new Date(input.targetDate);
    if (isNaN(d.getTime())) {
      return { ok: false, error: "targetDate is not a valid date.", failureClass: "validation_failed" };
    }
  }

  const { data, error } = await supabase
    .from("project_milestones")
    .insert({
      workspace_id: workspaceId,
      project_id: input.projectId,
      title,
      description: input.description ?? null,
      milestone_type: milestoneType,
      status: "planned",
      target_date: input.targetDate ?? null,
      baseline_date: input.baselineDate ?? null,
      forecast_date: input.forecastDate ?? null,
      confidence_score: input.confidenceScore ?? null,
      source_type: input.sourceType ?? "manual",
      source_payload: input.sourcePayload ?? {},
      created_by: userId,
    })
    .select(MILESTONE_SELECT)
    .single<ProjectMilestoneRow>();

  if (error || !data) {
    return { ok: false, error: "Failed to create milestone.", failureClass: "persistence_failed" };
  }

  return { ok: true, milestone: data };
}

export async function updateProjectMilestone(input: {
  milestoneId: string;
  title?: string;
  description?: string | null;
  status?: ProjectMilestoneStatus;
  targetDate?: string | null;
  baselineDate?: string | null;
  forecastDate?: string | null;
  confidenceScore?: number | null;
}): Promise<MilestoneResult> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("project_milestones")
    .select(MILESTONE_SELECT)
    .eq("id", input.milestoneId)
    .maybeSingle<ProjectMilestoneRow>();

  if (!existing) {
    return { ok: false, error: "Milestone not found.", failureClass: "not_found" };
  }

  try {
    await requireProjectAccess(existing.project_id, "read");
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization failed.", failureClass: "unauthorized" };
  }

  if (input.status && !VALID_STATUSES.includes(input.status)) {
    return { ok: false, error: `Invalid status: ${input.status}`, failureClass: "validation_failed" };
  }

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) updates.status = input.status;
  if (input.targetDate !== undefined) updates.target_date = input.targetDate;
  if (input.baselineDate !== undefined) updates.baseline_date = input.baselineDate;
  if (input.forecastDate !== undefined) updates.forecast_date = input.forecastDate;
  if (input.confidenceScore !== undefined) updates.confidence_score = input.confidenceScore;

  const { data, error } = await supabase
    .from("project_milestones")
    .update(updates)
    .eq("id", input.milestoneId)
    .select(MILESTONE_SELECT)
    .single<ProjectMilestoneRow>();

  if (error || !data) {
    return { ok: false, error: "Failed to update milestone.", failureClass: "persistence_failed" };
  }

  return { ok: true, milestone: data };
}

export async function completeProjectMilestone(input: {
  milestoneId: string;
}): Promise<MilestoneResult> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("project_milestones")
    .select(MILESTONE_SELECT)
    .eq("id", input.milestoneId)
    .maybeSingle<ProjectMilestoneRow>();

  if (!existing) {
    return { ok: false, error: "Milestone not found.", failureClass: "not_found" };
  }

  try {
    await requireProjectAccess(existing.project_id, "read");
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization failed.", failureClass: "unauthorized" };
  }

  const { data, error } = await supabase
    .from("project_milestones")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", input.milestoneId)
    .select(MILESTONE_SELECT)
    .single<ProjectMilestoneRow>();

  if (error || !data) {
    return { ok: false, error: "Failed to complete milestone.", failureClass: "persistence_failed" };
  }

  return { ok: true, milestone: data };
}

export async function cancelProjectMilestone(input: {
  milestoneId: string;
}): Promise<MilestoneResult> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("project_milestones")
    .select(MILESTONE_SELECT)
    .eq("id", input.milestoneId)
    .maybeSingle<ProjectMilestoneRow>();

  if (!existing) {
    return { ok: false, error: "Milestone not found.", failureClass: "not_found" };
  }

  try {
    await requireProjectAccess(existing.project_id, "read");
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization failed.", failureClass: "unauthorized" };
  }

  const { data, error } = await supabase
    .from("project_milestones")
    .update({ status: "cancelled" })
    .eq("id", input.milestoneId)
    .select(MILESTONE_SELECT)
    .single<ProjectMilestoneRow>();

  if (error || !data) {
    return { ok: false, error: "Failed to cancel milestone.", failureClass: "persistence_failed" };
  }

  return { ok: true, milestone: data };
}

export async function listProjectMilestones(input: {
  projectId: string;
}): Promise<{ ok: true; milestones: ProjectMilestoneRow[] } | { ok: false; error: string; failureClass: string }> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return { ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" };
  }

  try {
    await requireProjectAccess(input.projectId, "read");
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return { ok: false, error: "Access denied.", failureClass: "unauthorized" };
    }
    return { ok: false, error: "Authorization failed.", failureClass: "unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("project_milestones")
    .select(MILESTONE_SELECT)
    .eq("project_id", input.projectId)
    .order("target_date", { ascending: true, nullsFirst: false })
    .overrideTypes<ProjectMilestoneRow[], { merge: false }>();

  if (error) {
    return { ok: false, error: "Failed to load milestones.", failureClass: "persistence_failed" };
  }

  return { ok: true, milestones: data ?? [] };
}
