import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PM_ASSIGNMENT_SELECTABLE_COLUMNS,
  PM_PROFILE_SELECTABLE_COLUMNS,
  PROJECT_MANAGER_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type { PMAssignmentRow, PMProfileRow, ProjectManagerRow } from "@/lib/db/database-contract";
import { recordPMAssignedEvent, recordPMUnassignedEvent } from "@/lib/platform-events/domain-events";
import { generatePMCapacitySnapshot } from "@/lib/pm-capacity/capacity-registry";
import type {
  PMRegistryResult,
  AssignProjectManagerInput,
  UnassignProjectManagerInput,
  ListProjectManagerProjectsInput,
  PMAssignmentType,
} from "./types";

// Assignment types that count toward a PM's active project load.
// Observer is excluded — it is a monitoring role, not an ownership commitment.
const CAPACITY_COUNTING_TYPES: PMAssignmentType[] = ["primary", "secondary", "program"];

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

  // Validate PM exists, belongs to workspace, and is active
  const PM_COLS = PROJECT_MANAGER_SELECTABLE_COLUMNS.join(",");
  const { data: pm } = await supabase
    .from("project_managers")
    .select(PM_COLS)
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single<ProjectManagerRow>();

  if (!pm) return validation("Project Manager not found in this workspace.");
  if (pm.status !== "active") {
    return validation(`Cannot assign a PM with status '${pm.status}'. Only active PMs may be assigned.`);
  }

  // Capacity enforcement: primary/secondary/program count toward active_projects_limit.
  // Observer does not count — it is a monitoring role, not an ownership commitment.
  if (CAPACITY_COUNTING_TYPES.includes(input.assignmentType)) {
    const PROFILE_COLS = PM_PROFILE_SELECTABLE_COLUMNS.join(",");
    const { data: profile } = await supabase
      .from("pm_profiles")
      .select(PROFILE_COLS)
      .eq("workspace_id", input.workspaceId)
      .eq("pm_id", input.pmId)
      .maybeSingle<PMProfileRow>();

    const limit = profile?.active_projects_limit ?? 5;

    const { count } = await supabase
      .from("pm_assignments")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("pm_id", input.pmId)
      .in("assignment_type", CAPACITY_COUNTING_TYPES)
      .is("removed_at", null);

    const currentCount = count ?? 0;
    if (currentCount >= limit) {
      return {
        ok: false,
        error: `PM has reached their active project limit (${currentCount}/${limit}). Unassign a project or increase the limit in their profile.`,
        failureClass: "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED",
        details: {
          current_count: currentCount,
          limit,
          attempted_assignment_type: input.assignmentType,
        },
      };
    }
  }

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
  if (input.actorId) {
    void recordPMAssignedEvent({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      pmId: input.pmId,
      assignmentId: data.id,
      assignmentType: input.assignmentType,
      actorId: input.actorId,
    });
  }
  // Non-blocking capacity refresh: regenerate snapshot to reflect new assignment.
  // Does not block or fail the assignment if snapshot generation fails.
  void generatePMCapacitySnapshot({
    workspaceId: input.workspaceId,
    pmId: input.pmId,
    actorId: input.actorId,
  });
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
  if (input.actorId) {
    void recordPMUnassignedEvent({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      pmId: input.pmId,
      assignmentId: data.id,
      assignmentType: input.assignmentType,
      actorId: input.actorId,
    });
  }
  // Non-blocking capacity refresh: regenerate snapshot to reflect removed assignment.
  void generatePMCapacitySnapshot({
    workspaceId: input.workspaceId,
    pmId: input.pmId,
    actorId: input.actorId,
  });
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
