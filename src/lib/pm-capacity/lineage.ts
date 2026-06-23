import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";

import type {
  PMCapacityResult,
  GetPMCapacityLineageInput,
  PMCapacityLineage,
  PMCapacityStatus,
  PMBurnRisk,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(msg: string): PMCapacityResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}
function notFound<T>(): PMCapacityResult<T> {
  return { ok: false, error: "Project Manager not found.", failureClass: "not_found" };
}

// ─── getPMCapacityLineage ─────────────────────────────────────────────────────

export async function getPMCapacityLineage(
  input: GetPMCapacityLineageInput
): Promise<PMCapacityResult<PMCapacityLineage>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // 1. PM
  const { data: pm, error: pmError } = await supabase
    .from("project_managers")
    .select("id,display_name,email")
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (pmError || !pm) return notFound();

  // 2. Assignments
  const { data: assignments } = await supabase
    .from("pm_assignments")
    .select("id,project_id,assignment_type,assigned_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .is("removed_at", null)
    .order("assigned_at", { ascending: false });

  const assignmentList = assignments ?? [];
  const projectIds: string[] = Array.from(new Set(assignmentList.map((a: { project_id: string }) => a.project_id as string)));
  const projects: Array<{ id: string }> = projectIds.map((id) => ({ id }));

  // 3. Profile (Portfolio)
  const { data: profile } = await supabase
    .from("pm_profiles")
    .select("role,experience_level,capacity_limit,active_projects_limit")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  const portfolioData = profile
    ? {
        capacityLimit:       profile.capacity_limit        ?? 100,
        activeProjectsLimit: profile.active_projects_limit ?? 5,
        role:                profile.role                  ?? "project_manager",
        experienceLevel:     profile.experience_level      ?? "mid",
      }
    : null;

  // 4. Latest performance snapshot
  const { data: perfSnap } = await supabase
    .from("pm_performance_snapshots")
    .select("id,overall_score,performance_status,generated_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const performanceSnapshot = perfSnap
    ? {
        id:          perfSnap.id,
        overallScore: Number(perfSnap.overall_score),
        status:      perfSnap.performance_status,
        generatedAt: perfSnap.generated_at,
      }
    : null;

  // 5. Latest capacity snapshot
  const { data: capSnap } = await supabase
    .from("pm_capacity_snapshots")
    .select("id,capacity_score,load_score,utilization_percentage,burn_risk,capacity_status,generated_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const capacitySnapshot = capSnap
    ? {
        id:                     capSnap.id,
        capacityScore:          Number(capSnap.capacity_score),
        loadScore:              Number(capSnap.load_score),
        utilizationPercentage:  Number(capSnap.utilization_percentage),
        burnRisk:               capSnap.burn_risk as PMBurnRisk,
        capacityStatus:         capSnap.capacity_status as PMCapacityStatus,
        generatedAt:            capSnap.generated_at,
      }
    : null;

  const lineage: PMCapacityLineage = {
    pm: { id: pm.id, name: pm.display_name, email: pm.email },
    assignments: assignmentList.map((a: { id: string; project_id: string; assignment_type: string; assigned_at: string }) => ({
      id:             a.id,
      projectId:      a.project_id,
      assignmentType: a.assignment_type,
      assignedAt:     a.assigned_at,
    })),
    projects,
    portfolio:           portfolioData,
    performanceSnapshot,
    capacitySnapshot,
  };

  await createPlatformEvent({
    workspaceId:   input.workspaceId,
    projectId:     null,
    actorId:       null,
    actorType:     "system",
    eventType:     "PM_CAPACITY_LINEAGE_GENERATED",
    eventCategory: "governance",
    source:        "system",
    correlationId: null,
    causationId:   null,
    eventPayload: {
      pm_id:              input.pmId,
      assignment_count:   assignmentList.length,
      project_count:      projectIds.length,
      has_profile:        portfolioData !== null,
      has_perf_snapshot:  performanceSnapshot !== null,
      has_cap_snapshot:   capacitySnapshot !== null,
    },
  });

  return { ok: true, data: lineage };
}
