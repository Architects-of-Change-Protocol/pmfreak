import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";

import type {
  PMPerformanceResult,
  GetPMPerformanceLineageInput,
  PMPerformanceLineage,
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
function notFound<T>(): PMPerformanceResult<T> {
  return { ok: false, error: "Project Manager not found.", failureClass: "not_found" };
}

// ─── getPMPerformanceLineage ──────────────────────────────────────────────────

export async function getPMPerformanceLineage(
  input: GetPMPerformanceLineageInput
): Promise<PMPerformanceResult<PMPerformanceLineage>> {
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
  const projectIds = [...new Set(assignmentList.map((a: { project_id: string }) => a.project_id))];

  // 3. Projects (just IDs; project names may not exist in a minimal fetch)
  const projects = projectIds.map((id) => ({ id }));

  // 4. Latest OS snapshot per project
  const osSnapshots: PMPerformanceLineage["projectOsSnapshots"] = [];
  for (const pid of projectIds) {
    const { data: snap } = await supabase
      .from("project_os_snapshots")
      .select("id,operating_health_score,governance_health_score,execution_health_score")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", pid)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snap) {
      osSnapshots.push({
        id:                   snap.id,
        projectId:            pid,
        operatingHealthScore: Number(snap.operating_health_score),
        governanceHealthScore: Number(snap.governance_health_score),
        executionHealthScore:  Number(snap.execution_health_score),
      });
    }
  }

  // 5. Execution realities
  const { data: realities } = await supabase
    .from("execution_realities")
    .select("id,confidence_score,status")
    .eq("workspace_id", input.workspaceId)
    .in("status", ["validated", "completed"]);

  const executionRealities: PMPerformanceLineage["executionRealities"] = (realities ?? []).map(
    (r: { id: string; confidence_score: number; status: string }) => ({
      id:              r.id,
      confidenceScore: Number(r.confidence_score),
      status:          r.status,
    })
  );

  // 6. Decision outcomes
  const { data: outcomes } = await supabase
    .from("operational_decision_outcomes")
    .select("id,outcome_status,effectiveness_score")
    .eq("workspace_id", input.workspaceId);

  const decisionOutcomes: PMPerformanceLineage["decisionOutcomes"] = (outcomes ?? []).map(
    (o: { id: string; outcome_status: string; effectiveness_score: number }) => ({
      id:               o.id,
      outcomeStatus:    o.outcome_status,
      effectivenessScore: Number(o.effectiveness_score),
    })
  );

  // 7. Latest performance snapshot
  const { data: snap } = await supabase
    .from("pm_performance_snapshots")
    .select("id,overall_score,performance_status,generated_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const performanceSnapshot = snap
    ? {
        id:           snap.id,
        overallScore: Number(snap.overall_score),
        status:       snap.performance_status as PMPerformanceLineage["performanceSnapshot"] extends { status: infer S } ? S : never,
        generatedAt:  snap.generated_at,
      }
    : null;

  const lineage: PMPerformanceLineage = {
    pm: { id: pm.id, name: pm.display_name, email: pm.email },
    assignments: assignmentList.map((a: { id: string; project_id: string; assignment_type: string; assigned_at: string }) => ({
      id:             a.id,
      projectId:      a.project_id,
      assignmentType: a.assignment_type,
      assignedAt:     a.assigned_at,
    })),
    projects,
    projectOsSnapshots: osSnapshots,
    executionRealities,
    decisionOutcomes,
    performanceSnapshot,
  };

  await createPlatformEvent({
    workspaceId:   input.workspaceId,
    projectId:     null,
    actorId:       null,
    actorType:     "system",
    eventType:     "PM_PERFORMANCE_LINEAGE_GENERATED",
    eventCategory: "governance",
    source:        "system",
    correlationId: null,
    causationId:   null,
    eventPayload: {
      pm_id:            input.pmId,
      assignment_count: assignmentList.length,
      project_count:    projectIds.length,
      snapshot_count:   osSnapshots.length,
      reality_count:    executionRealities.length,
      outcome_count:    decisionOutcomes.length,
      has_perf_snapshot: performanceSnapshot !== null,
    },
  });

  return { ok: true, data: lineage };
}
