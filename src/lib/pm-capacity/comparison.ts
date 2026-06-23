import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";

import type {
  PMCapacityResult,
  ComparePMCapacityInput,
  PMCapacityComparison,
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
function notFound<T>(resource: string): PMCapacityResult<T> {
  return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
}

// ─── comparePMCapacity ────────────────────────────────────────────────────────

export async function comparePMCapacity(
  input: ComparePMCapacityInput
): Promise<PMCapacityResult<PMCapacityComparison>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmAId))       return validation("pmAId must be a valid UUID.");
  if (!validUuid(input.pmBId))       return validation("pmBId must be a valid UUID.");
  if (input.pmAId === input.pmBId)   return validation("pmAId and pmBId must be different.");

  const supabase = await createSupabaseServerClient();

  const [pmAResult, pmBResult] = await Promise.all([
    supabase
      .from("project_managers")
      .select("id,display_name")
      .eq("id", input.pmAId)
      .eq("workspace_id", input.workspaceId)
      .single(),
    supabase
      .from("project_managers")
      .select("id,display_name")
      .eq("id", input.pmBId)
      .eq("workspace_id", input.workspaceId)
      .single(),
  ]);

  if (pmAResult.error || !pmAResult.data) return notFound("PM A");
  if (pmBResult.error || !pmBResult.data) return notFound("PM B");

  const [snapAResult, snapBResult] = await Promise.all([
    supabase
      .from("pm_capacity_snapshots")
      .select("utilization_percentage,capacity_status,burn_risk")
      .eq("pm_id", input.pmAId)
      .eq("workspace_id", input.workspaceId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pm_capacity_snapshots")
      .select("utilization_percentage,capacity_status,burn_risk")
      .eq("pm_id", input.pmBId)
      .eq("workspace_id", input.workspaceId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const utilizationA  = snapAResult.data ? Number(snapAResult.data.utilization_percentage) : 0;
  const utilizationB  = snapBResult.data ? Number(snapBResult.data.utilization_percentage) : 0;
  const statusA       = (snapAResult.data?.capacity_status ?? "healthy") as PMCapacityStatus;
  const statusB       = (snapBResult.data?.capacity_status ?? "healthy") as PMCapacityStatus;
  const burnRiskA     = (snapAResult.data?.burn_risk       ?? "none")    as PMBurnRisk;
  const burnRiskB     = (snapBResult.data?.burn_risk       ?? "none")    as PMBurnRisk;

  const difference   = Math.round((utilizationA - utilizationB) * 100) / 100;
  const moreLoaded: "a" | "b" | "equal" =
    difference > 0 ? "a" : difference < 0 ? "b" : "equal";

  const comparison: PMCapacityComparison = {
    pmA: { id: input.pmAId, name: pmAResult.data.display_name, utilization: utilizationA, status: statusA, burnRisk: burnRiskA },
    pmB: { id: input.pmBId, name: pmBResult.data.display_name, utilization: utilizationB, status: statusB, burnRisk: burnRiskB },
    difference,
    moreLoaded,
  };

  await createPlatformEvent({
    workspaceId:   input.workspaceId,
    projectId:     null,
    actorId:       null,
    actorType:     "system",
    eventType:     "PM_CAPACITY_COMPARED",
    eventCategory: "governance",
    source:        "system",
    correlationId: null,
    causationId:   null,
    eventPayload: {
      pm_a_id:         input.pmAId,
      pm_b_id:         input.pmBId,
      utilization_a:   utilizationA,
      utilization_b:   utilizationB,
      difference,
      more_loaded:     moreLoaded,
    },
  });

  return { ok: true, data: comparison };
}
