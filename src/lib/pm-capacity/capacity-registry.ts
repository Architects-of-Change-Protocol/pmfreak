import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import {
  PM_CAPACITY_SNAPSHOT_SELECTABLE_COLUMNS,
  PM_CAPACITY_METRIC_SELECTABLE_COLUMNS,
  PM_CAPACITY_EVIDENCE_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  PMCapacitySnapshotRow,
  PMCapacityStatus,
  PMBurnRisk,
} from "@/lib/db/database-contract";

import { calculatePMCapacity } from "./engines/capacity-engine";
import { calculatePMLoad } from "./engines/load-engine";
import { calculatePMUtilization } from "./engines/utilization-engine";
import { calculatePMBurnRisk } from "./engines/burn-risk-engine";
import { detectPMOverload } from "./engines/overload-detection";
import { generateCapacityRecommendations } from "./engines/recommendation-engine";

import type {
  PMCapacityResult,
  GeneratePMCapacitySnapshotInput,
  GetPMCapacitySnapshotInput,
  ListPMCapacitySnapshotsInput,
} from "./types";

// ─── Column selectors ─────────────────────────────────────────────────────────

const SNAPSHOT_COLS = PM_CAPACITY_SNAPSHOT_SELECTABLE_COLUMNS.join(",");

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
function persistFailed<T>(action: string): PMCapacityResult<T> {
  return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
}

// ─── generatePMCapacitySnapshot ──────────────────────────────────────────────

export async function generatePMCapacitySnapshot(
  input: GeneratePMCapacitySnapshotInput
): Promise<PMCapacityResult<PMCapacitySnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // 1. Verify PM exists in workspace and is active (Rule 6)
  const { data: pm, error: pmError } = await supabase
    .from("project_managers")
    .select("id,display_name,email,status")
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (pmError || !pm) return notFound("Project Manager");
  if (pm.status !== "active") return validation("Cannot generate a capacity snapshot for an inactive PM.");

  // 2. Get PM profile for capacity configuration
  const { data: profile } = await supabase
    .from("pm_profiles")
    .select("id,role,experience_level,capacity_limit,active_projects_limit")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  const capacityLimit       = profile?.capacity_limit       ?? 100;
  const activeProjectsLimit = profile?.active_projects_limit ?? 5;
  const role                = profile?.role                 ?? "project_manager";
  const experienceLevel     = profile?.experience_level     ?? "mid";

  // 3. Get active assignments
  const { data: assignments } = await supabase
    .from("pm_assignments")
    .select("id,project_id,assignment_type,assigned_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .is("removed_at", null);

  const assignmentList = assignments ?? [];
  const projectIds: string[] = Array.from(new Set(assignmentList.map((a: { project_id: string }) => a.project_id as string)));
  const projectCount = projectIds.length;

  // 4. Get latest project OS snapshots to detect critical/warning projects
  let criticalProjectCount = 0;
  const osSnapshotIds: string[] = [];

  for (const pid of projectIds) {
    const { data: snap } = await supabase
      .from("project_os_snapshots")
      .select("id,operating_health_score")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", pid)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snap) {
      osSnapshotIds.push(snap.id);
      if (Number(snap.operating_health_score) < 45) criticalProjectCount++;
    }
  }

  // 5. Open decisions count
  const { count: openDecisionCount } = await supabase
    .from("operational_decisions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", input.workspaceId)
    .in("status", ["open", "pending"])
    .in("project_id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

  // 6. Open commitments count
  const { count: openCommitmentCount } = await supabase
    .from("governance_commitments")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", input.workspaceId)
    .in("status", ["open", "pending"]);

  // 7. Execution drift: overdue tasks
  const now = new Date().toISOString();
  const { count: executionDriftCount } = await supabase
    .from("execution_tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", input.workspaceId)
    .neq("status", "completed")
    .lt("due_date", now)
    .in("project_id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

  // 8. Escalations count
  const { count: escalationCount } = await supabase
    .from("governance_violations")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", input.workspaceId)
    .eq("status", "open")
    .in("action_entity_id", projectIds.length > 0 ? projectIds : ["00000000-0000-0000-0000-000000000000"]);

  // 9. Personal portfolio for attention allocation
  const { data: portfolioSnap } = await supabase
    .from("personal_portfolio_snapshots")
    .select("id,portfolio_health_score")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const attentionAllocationScore = portfolioSnap
    ? Math.max(0, 100 - Number(portfolioSnap.portfolio_health_score))
    : 50;

  // 10. Latest performance snapshot
  const { data: perfSnap } = await supabase
    .from("pm_performance_snapshots")
    .select("id,overall_score,performance_status,generated_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ─── Calculate capacity, load, utilization ────────────────────────────────

  const capacityScore = calculatePMCapacity({
    capacityLimit,
    activeProjectsLimit,
    role,
    experienceLevel,
  });

  const loadScore = calculatePMLoad({
    projectCount,
    criticalProjectCount,
    openDecisionCount:    openDecisionCount    ?? 0,
    openCommitmentCount:  openCommitmentCount  ?? 0,
    executionDriftCount:  executionDriftCount  ?? 0,
    attentionAllocationScore,
    escalationCount:      escalationCount      ?? 0,
  });

  const utilizationPercentage = calculatePMUtilization({
    load:     loadScore,
    capacity: capacityScore,
  });

  const burnRisk = calculatePMBurnRisk({
    utilizationPercentage,
    criticalProjectCount,
    escalationCount:     escalationCount     ?? 0,
    executionDriftCount: executionDriftCount ?? 0,
    openDecisionCount:   openDecisionCount   ?? 0,
  });

  const capacityStatus = detectPMOverload({ utilizationPercentage });

  const recommendation = generateCapacityRecommendations({
    utilizationPercentage,
    capacityStatus,
    burnRisk,
  });

  // ─── Persist snapshot ────────────────────────────────────────────────────

  const snapshotPayload = {
    pm_name:               pm.display_name,
    pm_email:              pm.email,
    pm_status:             pm.status,
    role,
    experience_level:      experienceLevel,
    capacity_limit:        capacityLimit,
    active_projects_limit: activeProjectsLimit,
    project_count:         projectCount,
    critical_project_count: criticalProjectCount,
    open_decision_count:   openDecisionCount    ?? 0,
    open_commitment_count: openCommitmentCount  ?? 0,
    execution_drift_count: executionDriftCount  ?? 0,
    escalation_count:      escalationCount      ?? 0,
    attention_allocation_score: attentionAllocationScore,
    performance_snapshot_id: perfSnap?.id ?? null,
    recommendation_reason: recommendation.reason,
  };

  const { data: snapshot, error: snapError } = await supabase
    .from("pm_capacity_snapshots")
    .insert({
      workspace_id:           input.workspaceId,
      pm_id:                  input.pmId,
      capacity_score:         capacityScore,
      load_score:             loadScore,
      utilization_percentage: utilizationPercentage,
      burn_risk:              burnRisk,
      capacity_status:        capacityStatus,
      recommended_action:     recommendation.action,
      snapshot_payload:       snapshotPayload,
      generated_at:           new Date().toISOString(),
    })
    .select(SNAPSHOT_COLS)
    .single<PMCapacitySnapshotRow>();

  if (snapError || !snapshot) return persistFailed("generate capacity snapshot");

  // ─── Persist metrics ─────────────────────────────────────────────────────

  const domainMetrics = [
    { name: "project_count",         value: projectCount,                   weight: 0.20, status: capacityStatus },
    { name: "critical_projects",     value: criticalProjectCount,            weight: 0.15, status: capacityStatus },
    { name: "open_decisions",        value: openDecisionCount   ?? 0,        weight: 0.10, status: capacityStatus },
    { name: "open_commitments",      value: openCommitmentCount ?? 0,        weight: 0.10, status: capacityStatus },
    { name: "execution_drift",       value: executionDriftCount ?? 0,        weight: 0.15, status: capacityStatus },
    { name: "escalations",           value: escalationCount     ?? 0,        weight: 0.15, status: capacityStatus },
    { name: "attention_allocation",  value: attentionAllocationScore,        weight: 0.15, status: capacityStatus },
  ];

  const metricsToInsert = domainMetrics.map((m) => ({
    workspace_id:        input.workspaceId,
    capacity_snapshot_id: snapshot.id,
    metric_name:         m.name,
    metric_value:        m.value,
    metric_weight:       m.weight,
    metric_status:       m.status,
  }));

  await supabase.from("pm_capacity_metrics").insert(metricsToInsert);

  // ─── Persist evidence ────────────────────────────────────────────────────

  const evidenceToInsert: Array<{
    workspace_id: string;
    capacity_snapshot_id: string;
    source_entity_type: string;
    source_entity_id: string;
    evidence_type: string;
    contribution_weight: number;
  }> = [];

  for (const snapId of osSnapshotIds) {
    evidenceToInsert.push({
      workspace_id:         input.workspaceId,
      capacity_snapshot_id: snapshot.id,
      source_entity_type:   "project_os_snapshot",
      source_entity_id:     snapId,
      evidence_type:        "project_health",
      contribution_weight:  osSnapshotIds.length > 0 ? 1 / osSnapshotIds.length : 1,
    });
  }

  if (perfSnap) {
    evidenceToInsert.push({
      workspace_id:         input.workspaceId,
      capacity_snapshot_id: snapshot.id,
      source_entity_type:   "pm_performance_snapshot",
      source_entity_id:     perfSnap.id,
      evidence_type:        "performance_context",
      contribution_weight:  1,
    });
  }

  if (portfolioSnap) {
    evidenceToInsert.push({
      workspace_id:         input.workspaceId,
      capacity_snapshot_id: snapshot.id,
      source_entity_type:   "personal_portfolio_snapshot",
      source_entity_id:     portfolioSnap.id,
      evidence_type:        "attention_allocation",
      contribution_weight:  1,
    });
  }

  if (evidenceToInsert.length > 0) {
    await supabase.from("pm_capacity_evidence").insert(evidenceToInsert);
  }

  // ─── Emit audit events ───────────────────────────────────────────────────

  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           input.actorId ?? null,
    actorType:         input.actorId ? "user" : "system",
    eventType:         "PM_CAPACITY_SNAPSHOT_GENERATED",
    eventCategory:     "governance",
    source:            input.actorId ? "user_action" : "system",
    correlationId:     snapshot.id,
    causationId:       null,
    rawReferenceTable: "pm_capacity_snapshots",
    rawReferenceId:    snapshot.id,
    eventPayload: {
      pm_id:                  input.pmId,
      snapshot_id:            snapshot.id,
      capacity_score:         capacityScore,
      load_score:             loadScore,
      utilization_percentage: utilizationPercentage,
      burn_risk:              burnRisk,
      capacity_status:        capacityStatus,
      recommended_action:     recommendation.action,
      project_count:          projectCount,
    },
  });

  if (capacityStatus === "overloaded" || capacityStatus === "critical") {
    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           null,
      actorType:         "system",
      eventType:         "PM_OVERLOAD_DETECTED",
      eventCategory:     "governance",
      source:            "system",
      correlationId:     snapshot.id,
      causationId:       snapshot.id,
      rawReferenceTable: "pm_capacity_snapshots",
      rawReferenceId:    snapshot.id,
      eventPayload: {
        pm_id:                  input.pmId,
        capacity_status:        capacityStatus,
        utilization_percentage: utilizationPercentage,
        burn_risk:              burnRisk,
      },
    });
  }

  return { ok: true, data: snapshot };
}

// ─── getPMCapacitySnapshot ────────────────────────────────────────────────────

export async function getPMCapacitySnapshot(
  input: GetPMCapacitySnapshotInput
): Promise<PMCapacityResult<PMCapacitySnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_capacity_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("id", input.snapshotId)
    .eq("workspace_id", input.workspaceId)
    .single<PMCapacitySnapshotRow>();

  if (error || !data) return notFound("Capacity snapshot");
  return { ok: true, data };
}

// ─── listPMCapacitySnapshots ──────────────────────────────────────────────────

export async function listPMCapacitySnapshots(
  input: ListPMCapacitySnapshotsInput
): Promise<PMCapacityResult<PMCapacitySnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pm_capacity_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false });

  if (input.pmId) {
    if (!validUuid(input.pmId)) return validation("pmId must be a valid UUID.");
    query = query.eq("pm_id", input.pmId);
  }

  if (input.status) {
    query = query.eq("capacity_status", input.status);
  }

  if (input.risk) {
    query = query.eq("burn_risk", input.risk);
  }

  if (input.limit && input.limit > 0) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query.returns<PMCapacitySnapshotRow[]>();
  if (error) return persistFailed("list capacity snapshots");
  return { ok: true, data: data ?? [] };
}
