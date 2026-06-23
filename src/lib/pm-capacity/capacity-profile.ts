import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";

import { calculatePMCapacity } from "./engines/capacity-engine";
import { calculatePMLoad } from "./engines/load-engine";
import { calculatePMUtilization } from "./engines/utilization-engine";
import { calculatePMBurnRisk } from "./engines/burn-risk-engine";
import { detectPMOverload } from "./engines/overload-detection";
import { generateCapacityRecommendations } from "./engines/recommendation-engine";

import type {
  PMCapacityResult,
  GeneratePMCapacityProfileInput,
  PMCapacityProfile,
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
function notFound<T>(resource = "Resource"): PMCapacityResult<T> {
  return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
}

// ─── generatePMCapacityProfile ────────────────────────────────────────────────

export async function generatePMCapacityProfile(
  input: GeneratePMCapacityProfileInput
): Promise<PMCapacityResult<PMCapacityProfile>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: pm, error: pmError } = await supabase
    .from("project_managers")
    .select("id,display_name,email,status")
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (pmError || !pm) return notFound("Project Manager");
  if (pm.status !== "active") return validation("Cannot generate a capacity profile for an inactive PM.");

  const { data: profile } = await supabase
    .from("pm_profiles")
    .select("role,experience_level,capacity_limit,active_projects_limit")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  const capacityLimit       = profile?.capacity_limit       ?? 100;
  const activeProjectsLimit = profile?.active_projects_limit ?? 5;
  const role                = profile?.role                 ?? "project_manager";
  const experienceLevel     = profile?.experience_level     ?? "mid";

  const { data: assignments } = await supabase
    .from("pm_assignments")
    .select("project_id")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .is("removed_at", null);

  const projectIds: string[] = Array.from(new Set((assignments ?? []).map((a: { project_id: string }) => a.project_id as string)));
  const projectCount = projectIds.length;

  let criticalProjectCount = 0;
  for (const pid of projectIds) {
    const { data: snap } = await supabase
      .from("project_os_snapshots")
      .select("operating_health_score")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", pid)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snap && Number(snap.operating_health_score) < 45) criticalProjectCount++;
  }

  const now = new Date().toISOString();

  const [
    { count: openDecisionCount },
    { count: openCommitmentCount },
    { count: executionDriftCount },
    { count: escalationCount },
  ] = await Promise.all([
    supabase
      .from("operational_decisions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .in("status", ["open", "pending"])
      .in("project_id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("governance_commitments")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .in("status", ["open", "pending"]),
    supabase
      .from("execution_tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .neq("status", "completed")
      .lt("due_date", now)
      .in("project_id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("governance_violations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", input.workspaceId)
      .eq("status", "open")
      .in("action_entity_id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const { data: portfolioSnap } = await supabase
    .from("personal_portfolio_snapshots")
    .select("portfolio_health_score")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const attentionAllocationScore = portfolioSnap
    ? Math.max(0, 100 - Number(portfolioSnap.portfolio_health_score))
    : 50;

  const capacityScore = calculatePMCapacity({ capacityLimit, activeProjectsLimit, role, experienceLevel });

  const loadScore = calculatePMLoad({
    projectCount,
    criticalProjectCount,
    openDecisionCount:    openDecisionCount    ?? 0,
    openCommitmentCount:  openCommitmentCount  ?? 0,
    executionDriftCount:  executionDriftCount  ?? 0,
    attentionAllocationScore,
    escalationCount:      escalationCount      ?? 0,
  });

  const utilizationPercentage = calculatePMUtilization({ load: loadScore, capacity: capacityScore });
  const burnRisk              = calculatePMBurnRisk({
    utilizationPercentage,
    criticalProjectCount,
    escalationCount:     escalationCount     ?? 0,
    executionDriftCount: executionDriftCount ?? 0,
    openDecisionCount:   openDecisionCount   ?? 0,
  });
  const capacityStatus        = detectPMOverload({ utilizationPercentage });
  const recommendation        = generateCapacityRecommendations({ utilizationPercentage, capacityStatus, burnRisk });

  const profile_result: PMCapacityProfile = {
    pm: { id: pm.id, name: pm.display_name, email: pm.email },
    capacity:          capacityScore,
    load:              loadScore,
    utilization:       utilizationPercentage,
    burnRisk,
    status:            capacityStatus,
    overload:          capacityStatus === "overloaded" || capacityStatus === "critical",
    recommendedAction: recommendation.action,
    evidence: {
      projectCount,
      criticalProjectCount,
      openDecisionCount:   openDecisionCount   ?? 0,
      openCommitmentCount: openCommitmentCount ?? 0,
      escalationCount:     escalationCount     ?? 0,
      executionDriftCount: executionDriftCount ?? 0,
    },
    generatedAt: new Date().toISOString(),
  };

  await createPlatformEvent({
    workspaceId:   input.workspaceId,
    projectId:     null,
    actorId:       null,
    actorType:     "system",
    eventType:     "PM_CAPACITY_CALCULATED",
    eventCategory: "governance",
    source:        "system",
    correlationId: null,
    causationId:   null,
    eventPayload: {
      pm_id:                  input.pmId,
      capacity_score:         capacityScore,
      load_score:             loadScore,
      utilization_percentage: utilizationPercentage,
      burn_risk:              burnRisk,
      capacity_status:        capacityStatus,
    },
  });

  return { ok: true, data: profile_result };
}
