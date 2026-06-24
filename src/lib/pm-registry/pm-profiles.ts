import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PM_PROFILE_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type { PMProfileRow } from "@/lib/db/database-contract";
import { recordPMProfileUpdatedEvent } from "@/lib/platform-events/domain-events";
import { generatePMCapacitySnapshot } from "@/lib/pm-capacity/capacity-registry";
import type {
  PMRegistryResult,
  GetProjectManagerProfileInput,
  UpdatePMProfileInput,
  PMRole,
  PMExperienceLevel,
} from "./types";

const PROFILE_COLS = PM_PROFILE_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): PMRegistryResult<T> {
  return { ok: false, error: "PM profile not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): PMRegistryResult<T> {
  return { ok: false, error: `Unable to ${action} PM profile.`, failureClass: "persistence_failed" };
}
function validation<T>(msg: string): PMRegistryResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}

export async function getProjectManagerProfile(
  input: GetProjectManagerProfileInput
): Promise<PMRegistryResult<PMProfileRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_profiles")
    .select(PROFILE_COLS)
    .eq("workspace_id", input.workspaceId)
    .eq("pm_id", input.pmId)
    .single<PMProfileRow>();

  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function upsertPMProfile(
  input: UpdatePMProfileInput
): Promise<PMRegistryResult<PMProfileRow>> {
  if (!input.workspaceId) return validation("workspaceId is required.");
  if (!input.pmId) return validation("pmId is required.");

  if (
    input.capacityLimit !== undefined &&
    (input.capacityLimit < 0 || input.capacityLimit > 100)
  ) {
    return validation("capacityLimit must be between 0 and 100.");
  }
  if (
    input.activeProjectsLimit !== undefined &&
    input.activeProjectsLimit < 1
  ) {
    return validation("activeProjectsLimit must be at least 1.");
  }

  const now = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_profiles")
    .upsert(
      {
        workspace_id: input.workspaceId,
        pm_id: input.pmId,
        role: input.role ?? "project_manager",
        experience_level: input.experienceLevel ?? "mid",
        capacity_limit: input.capacityLimit ?? 100,
        active_projects_limit: input.activeProjectsLimit ?? 5,
        updated_at: now,
      },
      { onConflict: "workspace_id,pm_id" }
    )
    .select(PROFILE_COLS)
    .single<PMProfileRow>();

  if (error || !data) return persistFailed("upsert");
  if (input.actorId) {
    void recordPMProfileUpdatedEvent({ workspaceId: input.workspaceId, pmId: input.pmId, actorId: input.actorId });
  }
  // Regenerate capacity snapshot when active_projects_limit is explicitly set —
  // the limit is the denominator of assignment capacity utilization.
  if (input.activeProjectsLimit !== undefined) {
    void generatePMCapacitySnapshot({
      workspaceId: input.workspaceId,
      pmId: input.pmId,
      actorId: input.actorId,
    });
  }
  return { ok: true, data };
}

export async function updatePMProfile(
  input: UpdatePMProfileInput
): Promise<PMRegistryResult<PMProfileRow>> {
  if (!input.workspaceId) return validation("workspaceId is required.");
  if (!input.pmId) return validation("pmId is required.");

  const existing = await getProjectManagerProfile({
    workspaceId: input.workspaceId,
    pmId: input.pmId,
  });
  if (!existing.ok) return existing;

  const updates: Partial<{
    role: PMRole;
    experience_level: PMExperienceLevel;
    capacity_limit: number;
    active_projects_limit: number;
    updated_at: string;
  }> = { updated_at: new Date().toISOString() };

  if (input.role !== undefined) updates.role = input.role;
  if (input.experienceLevel !== undefined) updates.experience_level = input.experienceLevel;
  if (input.capacityLimit !== undefined) {
    if (input.capacityLimit < 0 || input.capacityLimit > 100) {
      return validation("capacityLimit must be between 0 and 100.");
    }
    updates.capacity_limit = input.capacityLimit;
  }
  if (input.activeProjectsLimit !== undefined) {
    if (input.activeProjectsLimit < 1) {
      return validation("activeProjectsLimit must be at least 1.");
    }
    updates.active_projects_limit = input.activeProjectsLimit;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_profiles")
    .update(updates)
    .eq("workspace_id", input.workspaceId)
    .eq("pm_id", input.pmId)
    .select(PROFILE_COLS)
    .single<PMProfileRow>();

  if (error || !data) return persistFailed("update");
  // Regenerate capacity snapshot only when active_projects_limit changed —
  // it is the denominator of assignment capacity utilization.
  const limitChanged =
    input.activeProjectsLimit !== undefined &&
    input.activeProjectsLimit !== existing.data.active_projects_limit;
  if (limitChanged) {
    void generatePMCapacitySnapshot({
      workspaceId: input.workspaceId,
      pmId: input.pmId,
      actorId: input.actorId,
    });
  }
  return { ok: true, data };
}
