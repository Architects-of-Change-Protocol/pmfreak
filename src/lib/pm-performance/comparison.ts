import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";

import type {
  PMPerformanceResult,
  ComparePMPerformanceInput,
  PMPerformanceComparison,
  PMPerformanceStatus,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(msg: string): PMPerformanceResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}
function notFound<T>(resource: string): PMPerformanceResult<T> {
  return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
}

// ─── comparePMPerformance ─────────────────────────────────────────────────────

export async function comparePMPerformance(
  input: ComparePMPerformanceInput
): Promise<PMPerformanceResult<PMPerformanceComparison>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmAId))       return validation("pmAId must be a valid UUID.");
  if (!validUuid(input.pmBId))       return validation("pmBId must be a valid UUID.");
  if (input.pmAId === input.pmBId)   return validation("pmAId and pmBId must be different.");

  const supabase = await createSupabaseServerClient();

  // Fetch both PMs
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

  // Fetch latest snapshot for each PM
  const [snapAResult, snapBResult] = await Promise.all([
    supabase
      .from("pm_performance_snapshots")
      .select("overall_score,performance_status")
      .eq("pm_id", input.pmAId)
      .eq("workspace_id", input.workspaceId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pm_performance_snapshots")
      .select("overall_score,performance_status")
      .eq("pm_id", input.pmBId)
      .eq("workspace_id", input.workspaceId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const scoreA = snapAResult.data ? Number(snapAResult.data.overall_score) : 0;
  const scoreB = snapBResult.data ? Number(snapBResult.data.overall_score) : 0;
  const statusA = (snapAResult.data?.performance_status ?? "critical") as PMPerformanceStatus;
  const statusB = (snapBResult.data?.performance_status ?? "critical") as PMPerformanceStatus;

  const difference = Math.round((scoreA - scoreB) * 100) / 100;
  const stronger: "a" | "b" | "equal" =
    difference > 0 ? "a" : difference < 0 ? "b" : "equal";

  const comparison: PMPerformanceComparison = {
    pmA: { id: input.pmAId, name: pmAResult.data.display_name, overallScore: scoreA, status: statusA },
    pmB: { id: input.pmBId, name: pmBResult.data.display_name, overallScore: scoreB, status: statusB },
    difference,
    stronger,
  };

  await createPlatformEvent({
    workspaceId:   input.workspaceId,
    projectId:     null,
    actorId:       null,
    actorType:     "system",
    eventType:     "PM_PERFORMANCE_COMPARED",
    eventCategory: "governance",
    source:        "system",
    correlationId: null,
    causationId:   null,
    eventPayload: {
      pm_a_id:    input.pmAId,
      pm_b_id:    input.pmBId,
      score_a:    scoreA,
      score_b:    scoreB,
      difference,
      stronger,
    },
  });

  return { ok: true, data: comparison };
}
