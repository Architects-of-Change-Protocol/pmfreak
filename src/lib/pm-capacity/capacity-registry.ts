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
  GenerateWorkspacePMCapacitySnapshotsInput,
  GetPMCapacitySnapshotInput,
  ListPMCapacitySnapshotsInput,
  ListLatestPMCapacitySnapshotsInput,
  ListOverloadedProjectManagersInput,
  AssignmentCapacityStatus,
  AssignmentOverloadRisk,
  AssignmentCapacityRecommendation,
  AssignmentCapacityEvidence,
  AssignmentBreakdown,
  AssignmentCapacityPayload,
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

// ─── Assignment-capacity helpers ─────────────────────────────────────────────

const COUNTED_ASSIGNMENT_TYPES = ["primary", "secondary", "program"] as const;
const EXCLUDED_ASSIGNMENT_TYPES = ["observer"] as const;

function deriveAssignmentCapacityStatus(utilization: number): AssignmentCapacityStatus {
  if (utilization > 1.0)        return "overloaded";
  if (utilization === 1.0)      return "at_capacity";
  if (utilization >= 0.75)      return "near_capacity";
  if (utilization >= 0.40)      return "healthy";
  return "underutilized";
}

function deriveAssignmentOverloadRisk(utilization: number): AssignmentOverloadRisk {
  if (utilization > 1.0)   return "critical";
  if (utilization === 1.0) return "high";
  if (utilization >= 0.75) return "medium";
  return "low";
}

function generateAssignmentRecommendations(
  status: AssignmentCapacityStatus
): AssignmentCapacityRecommendation[] {
  switch (status) {
    case "underutilized":
      return [{ type: "available_capacity", severity: "low", message: "PM has available capacity and may be considered for additional ownership." }];
    case "healthy":
      return [{ type: "maintain_load", severity: "low", message: "PM load is within healthy operating range." }];
    case "near_capacity":
      return [{ type: "monitor_capacity", severity: "medium", message: "PM is approaching capacity. Review before assigning additional projects." }];
    case "at_capacity":
      return [{ type: "hold_new_assignments", severity: "high", message: "PM is at configured capacity. Avoid additional workload-counting assignments." }];
    case "overloaded":
      return [{ type: "rebalance_load", severity: "critical", message: "PM exceeds configured capacity. Rebalance assignments or increase capacity with explicit approval." }];
  }
}

function buildAssignmentCapacityPayload(
  assignments: Array<{ id: string; project_id: string; assignment_type: string; assigned_at: string }>,
  activeProjectsLimit: number,
  pmProfileId: string | null
): AssignmentCapacityPayload {
  const breakdown: AssignmentBreakdown = { primary: 0, secondary: 0, program: 0, observer: 0 };
  for (const a of assignments) {
    if (a.assignment_type === "primary")   breakdown.primary++;
    else if (a.assignment_type === "secondary") breakdown.secondary++;
    else if (a.assignment_type === "program")   breakdown.program++;
    else if (a.assignment_type === "observer")  breakdown.observer++;
  }

  const countedCount  = breakdown.primary + breakdown.secondary + breakdown.program;
  const observerCount = breakdown.observer;
  const activeCount   = assignments.length;
  const utilization   = activeProjectsLimit > 0 ? countedCount / activeProjectsLimit : 0;
  const status        = deriveAssignmentCapacityStatus(utilization);
  const risk          = deriveAssignmentOverloadRisk(utilization);

  const evidence: AssignmentCapacityEvidence = {
    profile: { pm_profile_id: pmProfileId, active_projects_limit: activeProjectsLimit },
    assignments: assignments.map((a) => ({
      assignment_id:   a.id,
      project_id:      a.project_id,
      assignment_type: a.assignment_type,
      assigned_at:     a.assigned_at,
    })),
    counting_rule: {
      counted_assignment_types:  [...COUNTED_ASSIGNMENT_TYPES],
      excluded_assignment_types: [...EXCLUDED_ASSIGNMENT_TYPES],
    },
  };

  return {
    active_assignment_count:          activeCount,
    counted_assignment_count:         countedCount,
    observer_assignment_count:        observerCount,
    active_projects_limit:            activeProjectsLimit,
    assignment_capacity_utilization:  utilization,
    assignment_capacity_status:       status,
    assignment_overload_risk:         risk,
    assignment_breakdown:             breakdown,
    recommendations:                  generateAssignmentRecommendations(status),
    evidence,
  };
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

  // 1b. Get previous latest snapshot for transition detection (before generating new one)
  const { data: prevSnapshots } = await supabase
    .from("pm_capacity_snapshots")
    .select("id,snapshot_payload,generated_at")
    .eq("workspace_id", input.workspaceId)
    .eq("pm_id", input.pmId)
    .order("generated_at", { ascending: false })
    .limit(1);

  const prevSnapshotPayload = prevSnapshots?.[0]?.snapshot_payload as Record<string, unknown> | null | undefined;
  const prevAssignmentCapacity = prevSnapshotPayload?.assignment_capacity as Record<string, unknown> | null | undefined;
  const prevAssignmentStatus = (prevAssignmentCapacity?.assignment_capacity_status ?? null) as string | null;

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

  // ─── Assignment-capacity payload ─────────────────────────────────────────

  const assignmentCapacity = buildAssignmentCapacityPayload(
    assignmentList as Array<{ id: string; project_id: string; assignment_type: string; assigned_at: string }>,
    activeProjectsLimit,
    profile?.id ?? null
  );

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
    // Assignment-based capacity (counting rule: primary+secondary+program count, observer does not)
    assignment_capacity: assignmentCapacity,
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
      pm_id:                           input.pmId,
      snapshot_id:                     snapshot.id,
      capacity_score:                  capacityScore,
      load_score:                      loadScore,
      utilization_percentage:          utilizationPercentage,
      burn_risk:                       burnRisk,
      capacity_status:                 capacityStatus,
      recommended_action:              recommendation.action,
      project_count:                   projectCount,
      active_projects_limit:           activeProjectsLimit,
      counted_assignment_count:        assignmentCapacity.counted_assignment_count,
      observer_assignment_count:       assignmentCapacity.observer_assignment_count,
      assignment_capacity_utilization: assignmentCapacity.assignment_capacity_utilization,
      assignment_capacity_status:      assignmentCapacity.assignment_capacity_status,
      assignment_overload_risk:        assignmentCapacity.assignment_overload_risk,
      generated_at:                    snapshot.generated_at,
      source:                          "pm_capacity",
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

  // ─── Threshold alert events ───────────────────────────────────────────────
  // Emit only when status transitions into a threshold state (or on first snapshot).
  // Skipped for underutilized/healthy — only near_capacity, at_capacity, overloaded alert.

  const newAssignmentStatus = assignmentCapacity.assignment_capacity_status;
  const thresholdStatuses: string[] = ["near_capacity", "at_capacity", "overloaded"];
  const statusChanged = newAssignmentStatus !== prevAssignmentStatus;
  const isFirstSnapshot = prevAssignmentStatus === null;

  if (thresholdStatuses.includes(newAssignmentStatus) && (statusChanged || isFirstSnapshot)) {
    const thresholdEventType =
      newAssignmentStatus === "near_capacity" ? "PM_CAPACITY_NEAR_LIMIT" :
      newAssignmentStatus === "at_capacity"   ? "PM_CAPACITY_AT_LIMIT"   :
      "PM_CAPACITY_OVERLOADED";

    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           input.actorId ?? null,
      actorType:         input.actorId ? "user" : "system",
      eventType:         thresholdEventType,
      eventCategory:     "governance",
      source:            input.actorId ? "user_action" : "system",
      correlationId:     snapshot.id,
      causationId:       snapshot.id,
      rawReferenceTable: "pm_capacity_snapshots",
      rawReferenceId:    snapshot.id,
      eventPayload: {
        workspace_id:             input.workspaceId,
        actor_user_id:            input.actorId ?? null,
        pm_id:                    input.pmId,
        snapshot_id:              snapshot.id,
        active_projects_limit:    activeProjectsLimit,
        counted_assignment_count: assignmentCapacity.counted_assignment_count,
        capacity_utilization:     assignmentCapacity.assignment_capacity_utilization,
        capacity_status:          newAssignmentStatus,
        overload_risk:            assignmentCapacity.assignment_overload_risk,
        previous_capacity_status: prevAssignmentStatus,
        generated_at:             snapshot.generated_at,
        source:                   "pm_capacity",
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

// ─── listLatestPMCapacitySnapshots ────────────────────────────────────────────
// Returns one (latest) snapshot per PM for a workspace.

export async function listLatestPMCapacitySnapshots(
  input: ListLatestPMCapacitySnapshotsInput
): Promise<PMCapacityResult<PMCapacitySnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_capacity_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .returns<PMCapacitySnapshotRow[]>();

  if (error) return persistFailed("list latest capacity snapshots");

  // Deduplicate: keep most recent snapshot per pm_id (results already ordered desc)
  const seen = new Set<string>();
  const latest: PMCapacitySnapshotRow[] = [];
  for (const row of (data ?? [])) {
    if (!seen.has(row.pm_id)) {
      seen.add(row.pm_id);
      latest.push(row);
    }
  }

  return { ok: true, data: latest };
}

// ─── listOverloadedProjectManagers ───────────────────────────────────────────
// Returns latest snapshots where capacity_status is overloaded/critical or
// burn_risk is high/critical.

export async function listOverloadedProjectManagers(
  input: ListOverloadedProjectManagersInput
): Promise<PMCapacityResult<PMCapacitySnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const latestResult = await listLatestPMCapacitySnapshots({ workspaceId: input.workspaceId });
  if (!latestResult.ok) return latestResult;

  // Filter by assignment-based capacity status/risk from snapshot_payload (source of truth).
  // Falls back to multi-domain capacity_status/burn_risk if assignment_capacity is absent.
  const OVERLOADED_ASSIGNMENT_STATUSES = new Set(["at_capacity", "overloaded"]);
  const HIGH_RISK_LEVELS = new Set(["high", "critical"]);

  const overloaded = latestResult.data.filter((s) => {
    const ac = (s.snapshot_payload as Record<string, unknown> | null)?.assignment_capacity as Record<string, unknown> | null | undefined;
    if (ac) {
      return (
        OVERLOADED_ASSIGNMENT_STATUSES.has(ac.assignment_capacity_status as string) ||
        HIGH_RISK_LEVELS.has(ac.assignment_overload_risk as string)
      );
    }
    // Fallback for snapshots without assignment_capacity (pre-activation snapshots)
    return (
      s.capacity_status === "overloaded" ||
      s.capacity_status === "critical" ||
      s.burn_risk === "high" ||
      s.burn_risk === "critical"
    );
  });

  return { ok: true, data: overloaded };
}

// ─── generateWorkspacePMCapacitySnapshots ─────────────────────────────────────
// Generates one capacity snapshot per active PM in the workspace.

export async function generateWorkspacePMCapacitySnapshots(
  input: GenerateWorkspacePMCapacitySnapshotsInput
): Promise<PMCapacityResult<{
  generated: PMCapacitySnapshotRow[];
  totalPMs: number;
  successCount: number;
  failureCount: number;
}>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: pms, error: pmError } = await supabase
    .from("project_managers")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active");

  if (pmError) return persistFailed("list project managers for workspace snapshot generation");

  const pmList = pms ?? [];
  const generated: PMCapacitySnapshotRow[] = [];
  let failureCount = 0;

  for (const pm of pmList) {
    const result = await generatePMCapacitySnapshot({
      workspaceId: input.workspaceId,
      pmId: pm.id,
      actorId: input.actorId,
    });
    if (result.ok) {
      generated.push(result.data);
    } else {
      failureCount++;
    }
  }

  const successCount = generated.length;

  if (successCount > 0) {
    const statuses = generated.map((s) => s.capacity_status);
    const healthyCount      = statuses.filter((s) => s === "healthy").length;
    const nearCapacityCount = statuses.filter((s) => s === "busy").length;
    const atCapacityCount   = statuses.filter((s) => s === "overloaded").length;
    const overloadedCount   = statuses.filter((s) => s === "critical").length;
    const avgUtil           = generated.reduce((sum, s) => sum + Number(s.utilization_percentage), 0) / successCount;

    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           input.actorId ?? null,
      actorType:         input.actorId ? "user" : "system",
      eventType:         "PM_WORKSPACE_CAPACITY_SNAPSHOTS_GENERATED",
      eventCategory:     "governance",
      source:            input.actorId ? "user_action" : "system",
      correlationId:     null,
      causationId:       null,
      rawReferenceTable: "pm_capacity_snapshots",
      rawReferenceId:    null,
      eventPayload: {
        workspace_id:             input.workspaceId,
        actor_user_id:            input.actorId ?? null,
        generated_snapshot_count: successCount,
        total_pm_count:           pmList.length,
        healthy_count:            healthyCount,
        near_capacity_count:      nearCapacityCount,
        at_capacity_count:        atCapacityCount,
        overloaded_count:         overloadedCount,
        average_utilization:      Math.round(avgUtil * 100) / 100,
        generated_at:             new Date().toISOString(),
        source:                   "pm_capacity",
      },
    });
  }

  return {
    ok: true,
    data: {
      generated,
      totalPMs:     pmList.length,
      successCount,
      failureCount,
    },
  };
}
