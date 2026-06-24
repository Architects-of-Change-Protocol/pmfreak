import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROJECT_MANAGER_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type { ProjectManagerRow } from "@/lib/db/database-contract";
import { recordPMRegisteredEvent, recordPMUpdatedEvent } from "@/lib/platform-events/domain-events";
import type {
  PMRegistryResult,
  RegisterProjectManagerInput,
  UpdateProjectManagerInput,
  ProjectManagerStatus,
} from "./types";

const PM_COLS = PROJECT_MANAGER_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): PMRegistryResult<T> {
  return { ok: false, error: "Project Manager not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): PMRegistryResult<T> {
  return { ok: false, error: `Unable to ${action} project manager.`, failureClass: "persistence_failed" };
}
function validation<T>(msg: string): PMRegistryResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}

export async function registerProjectManager(
  input: RegisterProjectManagerInput
): Promise<PMRegistryResult<ProjectManagerRow>> {
  if (!input.workspaceId) return validation("workspaceId is required.");
  if (!input.displayName?.trim()) return validation("displayName is required.");
  if (!input.email?.trim()) return validation("email is required.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_managers")
    .insert({
      workspace_id: input.workspaceId,
      display_name: input.displayName.trim(),
      email: input.email.trim().toLowerCase(),
      user_id: input.userId ?? null,
      joined_at: input.joinedAt ?? new Date().toISOString(),
      status: "active",
    })
    .select(PM_COLS)
    .single<ProjectManagerRow>();

  if (error) {
    if (error.code === "23505") {
      return validation(`A project manager with email ${input.email} already exists in this workspace.`);
    }
    return persistFailed("register");
  }
  if (!data) return persistFailed("register");
  if (input.actorId) {
    void recordPMRegisteredEvent({ workspaceId: input.workspaceId, pmId: data.id, actorId: input.actorId });
  }
  return { ok: true, data };
}

export async function updateProjectManager(
  input: UpdateProjectManagerInput
): Promise<PMRegistryResult<ProjectManagerRow>> {
  if (!input.workspaceId) return validation("workspaceId is required.");
  if (!input.pmId) return validation("pmId is required.");

  const updates: Partial<{
    display_name: string;
    email: string;
    status: ProjectManagerStatus;
    updated_at: string;
  }> = { updated_at: new Date().toISOString() };

  if (input.displayName !== undefined) {
    if (!input.displayName.trim()) return validation("displayName cannot be empty.");
    updates.display_name = input.displayName.trim();
  }
  if (input.email !== undefined) {
    if (!input.email.trim()) return validation("email cannot be empty.");
    updates.email = input.email.trim().toLowerCase();
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_managers")
    .update(updates)
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .select(PM_COLS)
    .single<ProjectManagerRow>();

  if (error) return persistFailed("update");
  if (!data) return notFound();
  if (input.actorId) {
    void recordPMUpdatedEvent({
      workspaceId: input.workspaceId,
      pmId: input.pmId,
      actorId: input.actorId,
      ...(input.status !== undefined ? { newStatus: input.status } : {}),
    });
  }
  return { ok: true, data };
}

export async function getProjectManager(
  pmId: string,
  workspaceId: string
): Promise<PMRegistryResult<ProjectManagerRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_managers")
    .select(PM_COLS)
    .eq("id", pmId)
    .eq("workspace_id", workspaceId)
    .single<ProjectManagerRow>();

  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function listProjectManagers(
  workspaceId: string,
  status?: ProjectManagerStatus
): Promise<PMRegistryResult<ProjectManagerRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("project_managers")
    .select(PM_COLS)
    .eq("workspace_id", workspaceId)
    .order("display_name");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.returns<ProjectManagerRow[]>();
  if (error) return persistFailed("list");
  return { ok: true, data: data ?? [] };
}
