import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PMO_COMMAND_CENTER_SNAPSHOT_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type { PMOCommandCenterSnapshotRow } from "@/lib/db/database-contract";
import { createPlatformEvent } from "@/lib/platform-events/create-event";

import type {
  PMOCommandCenterResult,
  GetPMOLineageInput,
  PMOLineage,
  PMSummary,
  ProjectSummary,
} from "./types";

// ─── Column selectors ─────────────────────────────────────────────────────────

const SNAPSHOT_COLS = PMO_COMMAND_CENTER_SNAPSHOT_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function validation<T>(msg: string): PMOCommandCenterResult<T> {
  return { ok: false, error: msg, failureClass: "validation" };
}
function notFound<T>(resource = "Resource"): PMOCommandCenterResult<T> {
  return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
}
function persistFailed<T>(action: string): PMOCommandCenterResult<T> {
  return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
}

// ─── getPMOLineage ────────────────────────────────────────────────────────────
//
// Reconstructs the full lineage chain:
//   Project → Portfolio → PM → Performance → Capacity → Compliance → PMO Snapshot

export async function getPMOLineage(
  input: GetPMOLineageInput
): Promise<PMOCommandCenterResult<PMOLineage>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // 1. Fetch the PMO snapshot
  const { data: snapshot, error: snapError } = await supabase
    .from("pmo_command_center_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("id", input.snapshotId)
    .eq("workspace_id", input.workspaceId)
    .single<PMOCommandCenterSnapshotRow>();

  if (snapError || !snapshot) return notFound("PMO snapshot");

  // 2. Fetch PMs
  const { data: pms, error: pmError } = await supabase
    .from("project_managers")
    .select("id,display_name,email,status")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active");

  if (pmError) return persistFailed("fetch project managers for lineage");
  const pmList = pms ?? [];

  // 3. Fetch projects
  const { data: projects } = await supabase
    .from("projects")
    .select("id,name,status")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active");

  const projectList = projects ?? [];

  // 4. Map PM assignments to projects
  const { data: assignments } = await supabase
    .from("pm_assignments")
    .select("pm_id,project_id")
    .eq("workspace_id", input.workspaceId)
    .is("removed_at", null);

  const assignmentMap = new Map<string, string>();
  for (const a of (assignments ?? [])) {
    if (!assignmentMap.has(a.project_id)) {
      assignmentMap.set(a.project_id, a.pm_id);
    }
  }

  // 5. Build project summaries with health scores
  const { data: osSnapshots } = await supabase
    .from("project_os_snapshots")
    .select("project_id,operating_health_score,created_at")
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  const healthMap = new Map<string, number>();
  for (const s of (osSnapshots ?? [])) {
    if (!healthMap.has(s.project_id)) {
      healthMap.set(s.project_id, s.operating_health_score ?? 50);
    }
  }

  const projectSummaries: ProjectSummary[] = projectList.map((p: { id: string; name: string; status: string }) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    healthScore: healthMap.get(p.id) ?? 50,
    pmId: assignmentMap.get(p.id) ?? null,
    portfolioId: null,
  }));

  // 6. Fetch portfolios count
  const { data: portfolios } = await supabase
    .from("programs")
    .select("id")
    .eq("workspace_id", input.workspaceId);
  const portfolioCount = (portfolios ?? []).length;

  // 7. Build PM lineage entries (each linked to their latest snapshots)
  const pmLineage: PMOLineage["pms"] = [];

  for (const pm of pmList) {
    const { data: perfSnap } = await supabase
      .from("pm_performance_snapshots")
      .select("id,overall_score")
      .eq("workspace_id", input.workspaceId)
      .eq("pm_id", pm.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: capSnap } = await supabase
      .from("pm_capacity_snapshots")
      .select("id,capacity_score,utilization_percentage")
      .eq("workspace_id", input.workspaceId)
      .eq("pm_id", pm.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: compSnap } = await supabase
      .from("governance_compliance_snapshots")
      .select("id,overall_score")
      .eq("workspace_id", input.workspaceId)
      .eq("pm_id", pm.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pmProjects = projectSummaries.filter((p) => p.pmId === pm.id);
    const utilization = capSnap?.utilization_percentage ?? 0;

    const pmSummary: PMSummary = {
      id:                   pm.id,
      name:                 pm.display_name,
      email:                pm.email,
      performanceScore:     perfSnap?.overall_score ?? 50,
      capacityScore:        capSnap?.capacity_score ?? 50,
      utilizationPercentage: utilization,
      complianceScore:      compSnap?.overall_score ?? 50,
      status:               utilization >= 110 ? "overloaded" : utilization >= 90 ? "warning" : "healthy",
      projectCount:         pmProjects.length,
    };

    pmLineage.push({
      pm:                   pmSummary,
      performanceSnapshotId: perfSnap?.id ?? null,
      capacitySnapshotId:    capSnap?.id  ?? null,
      complianceSnapshotId:  compSnap?.id ?? null,
    });
  }

  // 8. Emit lineage event
  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           null,
    actorType:         "system",
    eventType:         "PMO_LINEAGE_GENERATED",
    eventCategory:     "governance",
    source:            "system",
    correlationId:     snapshot.id,
    causationId:       null,
    rawReferenceTable: "pmo_command_center_snapshots",
    rawReferenceId:    snapshot.id,
    eventPayload: {
      snapshot_id:     snapshot.id,
      pm_count:        pmList.length,
      project_count:   projectList.length,
      portfolio_count: portfolioCount,
    },
  });

  return {
    ok: true,
    data: {
      snapshot,
      pms:            pmLineage,
      projects:       projectSummaries,
      portfolioCount,
      generatedAt:    new Date().toISOString(),
    },
  };
}
