import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PM_ASSIGNMENT_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type { PMAssignmentRow } from "@/lib/db/database-contract";
import type {
  PMRegistryResult,
  AssignProjectManagerInput,
  UnassignProjectManagerInput,
  ListProjectManagerProjectsInput,
  PMAssignmentType,
} from "./types";

const ASSIGN_COLS = PM_ASSIGNMENT_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): PMRegistryResult<T> {
  return { ok: false, error: "Assignment not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): PMRegistryResult<T> {
  return { ok: false, error: `Unable to ${action} assignment.`, failureClass: "persistence_failed" };
}
function validation<T>(msg: string): PMRegistryResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}

export async function assignProjectManager(
  input: AssignProjectManagerInput
): Promise<PMRegistryResult<PMAssignmentRow>> {
  if (!input.workspaceId) return validation("workspaceId is required.");
  if (!input.pmId) return validation("pmId is required.");
  if (!input.projectId) return validation("projectId is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_assignments")
    .insert({
      workspace_id: input.workspaceId,
      pm_id: input.pmId,
      project_id: input.projectId,
      assignment_type: input.assignmentType,
      assigned_at: new Date().toISOString(),
    })
    .select(ASSIGN_COLS)
    .single<PMAssignmentRow>();

  if (error) {
    if (error.code === "23505") {
      if (input.assignmentType === "primary") {
        return validation("This project already has a primary PM. Unassign the current primary first.");
      }
      return validation("This PM is already assigned to this project with the same assignment type.");
    }
    return persistFailed("create");
  }
  if (!data) return persistFailed("create");
  return { ok: true, data };
}

export async function unassignProjectManager(
  input: UnassignProjectManagerInput
): Promise<PMRegistryResult<PMAssignmentRow>> {
  if (!input.workspaceId) return validation("workspaceId is required.");
  if (!input.pmId) return validation("pmId is required.");
  if (!input.projectId) return validation("projectId is required.");

  const supabase = await createSupabaseServerClient();

  // Find the active assignment
  const { data: existing, error: findError } = await supabase
    .from("pm_assignments")
    .select(ASSIGN_COLS)
    .eq("workspace_id", input.workspaceId)
    .eq("pm_id", input.pmId)
    .eq("project_id", input.projectId)
    .eq("assignment_type", input.assignmentType)
    .is("removed_at", null)
    .single<PMAssignmentRow>();

  if (findError || !existing) return notFound();

  const { data, error } = await supabase
    .from("pm_assignments")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("workspace_id", input.workspaceId)
    .select(ASSIGN_COLS)
    .single<PMAssignmentRow>();

  if (error || !data) return persistFailed("remove");
  return { ok: true, data };
}

export async function listProjectManagerProjects(
  input: ListProjectManagerProjectsInput
): Promise<PMRegistryResult<PMAssignmentRow[]>> {
  if (!input.workspaceId) return validation("workspaceId is required.");
  if (!input.pmId) return validation("pmId is required.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pm_assignments")
    .select(ASSIGN_COLS)
    .eq("workspace_id", input.workspaceId)
    .eq("pm_id", input.pmId)
    .order("assigned_at", { ascending: false });

  if (!input.includeRemoved) {
    query = query.is("removed_at", null);
  }

  const { data, error } = await query.returns<PMAssignmentRow[]>();
  if (error) return persistFailed("list");
  return { ok: true, data: data ?? [] };
}

export async function listProjectAssignments(
  workspaceId: string,
  projectId: string,
  activeOnly = true
): Promise<PMRegistryResult<PMAssignmentRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pm_assignments")
    .select(ASSIGN_COLS)
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("assignment_type");

  if (activeOnly) {
    query = query.is("removed_at", null);
  }

  const { data, error } = await query.returns<PMAssignmentRow[]>();
  if (error) return persistFailed("list");
  return { ok: true, data: data ?? [] };
}

export async function getActiveAssignment(
  workspaceId: string,
  pmId: string,
  projectId: string,
  assignmentType: PMAssignmentType
): Promise<PMRegistryResult<PMAssignmentRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_assignments")
    .select(ASSIGN_COLS)
    .eq("workspace_id", workspaceId)
    .eq("pm_id", pmId)
    .eq("project_id", projectId)
    .eq("assignment_type", assignmentType)
    .is("removed_at", null)
    .single<PMAssignmentRow>();

  if (error || !data) return notFound();
  return { ok: true, data };
}
