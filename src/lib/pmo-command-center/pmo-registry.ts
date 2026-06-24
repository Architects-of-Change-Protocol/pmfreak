import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import {
  PMO_COMMAND_CENTER_SNAPSHOT_SELECTABLE_COLUMNS,
  PMO_ATTENTION_ITEM_SELECTABLE_COLUMNS,
  PMO_RECOMMENDATION_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  PMOCommandCenterSnapshotRow,
  PMOAttentionItemRow,
  PMORecommendationRow,
} from "@/lib/db/database-contract";

import { calculatePMOHealth, classifyPMOStatus } from "./engines/pmo-health-engine";
import { calculateOrganizationalCapacity } from "./engines/organizational-capacity-engine";
import { calculateGovernanceMaturity } from "./engines/governance-maturity-engine";
import { calculatePMORiskIndex } from "./engines/pmo-risk-engine";
import { generateAttentionQueue } from "./engines/attention-queue-engine";
import { generateExecutiveRecommendations } from "./engines/recommendation-engine";
import { identifyPMOHotspots } from "./engines/hotspot-engine";

import type {
  PMOCommandCenterResult,
  GeneratePMOSnapshotInput,
  GetPMOSnapshotInput,
  ListPMOSnapshotsInput,
  PMOSnapshotResult,
  PMSummary,
  ProjectSummary,
} from "./types";

// ─── Column selectors ─────────────────────────────────────────────────────────

const SNAPSHOT_COLS     = PMO_COMMAND_CENTER_SNAPSHOT_SELECTABLE_COLUMNS.join(",");
const ATTENTION_COLS    = PMO_ATTENTION_ITEM_SELECTABLE_COLUMNS.join(",");
const RECOMMEND_COLS    = PMO_RECOMMENDATION_SELECTABLE_COLUMNS.join(",");

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

// ─── generatePMOSnapshot ─────────────────────────────────────────────────────

export async function generatePMOSnapshot(
  input: GeneratePMOSnapshotInput
): Promise<PMOCommandCenterResult<PMOSnapshotResult>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // 1. Fetch PMs
  const { data: pms, error: pmError } = await supabase
    .from("project_managers")
    .select("id,display_name,email,status")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active");

  if (pmError) return persistFailed("fetch project managers");
  const pmList = pms ?? [];

  // 2. Fetch portfolios (programs table)
  const { data: portfolios } = await supabase
    .from("programs")
    .select("id")
    .eq("workspace_id", input.workspaceId);
  const portfolioCount = (portfolios ?? []).length;

  // 3. Fetch projects with health scores
  const { data: projects } = await supabase
    .from("projects")
    .select("id,name,status")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active");
  const projectList = projects ?? [];

  // 4. Fetch latest OS snapshots for project health
  const projectHealthMap = new Map<string, number>();
  if (projectList.length > 0) {
    const projectIds = projectList.map((p: { id: string }) => p.id);
    const { data: osSnapshots } = await supabase
      .from("project_os_snapshots")
      .select("project_id,operating_health_score,created_at")
      .eq("workspace_id", input.workspaceId)
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    for (const snap of (osSnapshots ?? [])) {
      if (!projectHealthMap.has(snap.project_id)) {
        projectHealthMap.set(snap.project_id, snap.operating_health_score ?? 50);
      }
    }
  }

  const projectSummaries: ProjectSummary[] = projectList.map((p: { id: string; name: string; status: string }) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    healthScore: projectHealthMap.get(p.id) ?? 50,
    pmId: null,
    portfolioId: null,
  }));

  // 5. Assign PM to projects via pm_assignments
  if (projectList.length > 0) {
    const projectIds = projectList.map((p: { id: string }) => p.id);
    const { data: assignments } = await supabase
      .from("pm_assignments")
      .select("pm_id,project_id")
      .eq("workspace_id", input.workspaceId)
      .is("removed_at", null)
      .in("project_id", projectIds);

    for (const a of (assignments ?? [])) {
      const ps = projectSummaries.find((p) => p.id === a.project_id);
      if (ps && !ps.pmId) ps.pmId = a.pm_id;
    }
  }

  // 6. Get latest performance/capacity/compliance snapshots per PM
  const pmSummaries: PMSummary[] = [];

  let totalPerformanceScore = 0;
  let totalCapacityScore    = 0;
  let totalComplianceScore  = 0;
  let totalUtilization      = 0;
  let totalCapacityPoints   = 0;
  let totalLoadPoints       = 0;
  let overloadedCount       = 0;
  let warningCapacityCount  = 0;
  let healthyCount          = 0;
  let totalGovernanceDebt   = 0;
  const totalHotspots       = 0;
  let totalGapCount         = 0;
  const escalationCount     = 0;

  for (const pm of pmList) {
    // Performance
    const { data: perfSnap } = await supabase
      .from("pm_performance_snapshots")
      .select("overall_score")
      .eq("workspace_id", input.workspaceId)
      .eq("pm_id", pm.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const performanceScore = perfSnap?.overall_score ?? 50;

    // Capacity
    const { data: capSnap } = await supabase
      .from("pm_capacity_snapshots")
      .select("capacity_score,load_score,utilization_percentage")
      .eq("workspace_id", input.workspaceId)
      .eq("pm_id", pm.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const capacityScore        = capSnap?.capacity_score         ?? 50;
    const utilizationPct       = capSnap?.utilization_percentage ?? 0;
    const loadScore            = capSnap?.load_score             ?? 50;

    totalCapacityPoints += capacityScore;
    totalLoadPoints     += loadScore;

    if (utilizationPct >= 110) overloadedCount++;
    else if (utilizationPct >= 90) warningCapacityCount++;
    else healthyCount++;

    // Compliance
    const { data: compSnap } = await supabase
      .from("governance_compliance_snapshots")
      .select("overall_score")
      .eq("workspace_id", input.workspaceId)
      .eq("pm_id", pm.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const complianceScore = compSnap?.overall_score ?? 50;

    // Governance gaps for this PM
    const { data: gaps } = await supabase
      .from("governance_compliance_gaps")
      .select("severity")
      .eq("workspace_id", input.workspaceId);

    const pmGaps      = gaps ?? [];
    const criticalGap = pmGaps.filter((g: { severity: string }) => g.severity === "critical" || g.severity === "high").length;
    totalGovernanceDebt += criticalGap;
    totalGapCount       += pmGaps.length;

    // PM project count
    const pmProjects = projectSummaries.filter((p) => p.pmId === pm.id);

    // PM status
    let status: "overloaded" | "warning" | "healthy" = "healthy";
    if (utilizationPct >= 110)     status = "overloaded";
    else if (utilizationPct >= 90) status = "warning";

    totalPerformanceScore += performanceScore;
    totalCapacityScore    += capacityScore;
    totalComplianceScore  += complianceScore;
    totalUtilization      += utilizationPct;

    pmSummaries.push({
      id: pm.id,
      name: pm.display_name,
      email: pm.email,
      performanceScore,
      capacityScore,
      utilizationPercentage: utilizationPct,
      complianceScore,
      status,
      projectCount: pmProjects.length,
    });
  }

  const pmCount = pmList.length;
  const avgPerf       = pmCount > 0 ? totalPerformanceScore / pmCount : 0;
  const avgCap        = pmCount > 0 ? totalCapacityScore    / pmCount : 0;
  const avgComp       = pmCount > 0 ? totalComplianceScore  / pmCount : 0;
  const avgUtil       = pmCount > 0 ? totalUtilization      / pmCount : 0;

  // 7. Project health score
  const avgProjectHealth = projectSummaries.length > 0
    ? projectSummaries.reduce((s, p) => s + p.healthScore, 0) / projectSummaries.length
    : 100;

  const criticalProjects = projectSummaries.filter((p) => p.healthScore < 50).length;
  const warningProjects  = projectSummaries.filter((p) => p.healthScore >= 50 && p.healthScore < 70).length;
  const healthyProjects  = projectSummaries.filter((p) => p.healthScore >= 70).length;

  // 8. Calculate commitments and drift (execution)
  const { data: commitments } = await supabase
    .from("governance_commitments")
    .select("id,status")
    .eq("workspace_id", input.workspaceId);

  const commitmentList   = commitments ?? [];
  const totalCommitments = commitmentList.length;

  const { data: tasks } = await supabase
    .from("execution_tasks")
    .select("id,status,due_date,completed_at")
    .eq("workspace_id", input.workspaceId);

  const nowStr   = new Date().toISOString();
  const taskList = tasks ?? [];
  const driftCount = taskList.filter(
    (t: { status: string; due_date: string | null }) =>
      t.status !== "completed" && t.due_date !== null && t.due_date < nowStr
  ).length;

  // Execution score: inversion of drift rate
  const driftRate     = totalCommitments > 0 ? driftCount / totalCommitments : 0;
  const executionScore = Math.round(Math.max(0, 100 - driftRate * 100));

  // 9. Compute engines
  const healthScore = calculatePMOHealth({
    avgPerformanceScore: avgPerf,
    avgCapacityScore:    avgCap,
    avgComplianceScore:  avgComp,
    projectHealthScore:  avgProjectHealth,
  });

  const capacityScore = calculateOrganizationalCapacity({
    pmCount,
    overloadedPMCount:    overloadedCount,
    warningPMCount:       warningCapacityCount,
    healthyPMCount:       healthyCount,
    avgUtilizationPercentage: avgUtil,
    totalCapacity:        totalCapacityPoints,
    totalLoad:            totalLoadPoints,
  });

  const governanceScore = calculateGovernanceMaturity({
    avgComplianceScore:    avgComp,
    totalGovernanceDebt,
    hotspotCount:          totalHotspots,
    criticalGapCount:      totalGapCount,
    highGapCount:          0,
  });

  const riskScore = calculatePMORiskIndex({
    criticalProjectCount: criticalProjects,
    totalProjectCount:    projectSummaries.length,
    executionDriftCount:  driftCount,
    totalCommitmentCount: totalCommitments,
    governanceGapCount:   totalGapCount,
    overloadedPMCount:    overloadedCount,
    pmCount,
    escalationCount,
  });

  // 10. Persist snapshot
  const snapshotPayload = {
    pmo_status:         classifyPMOStatus(healthScore),
    pm_summaries:       pmSummaries.map((p) => ({ id: p.id, name: p.name, status: p.status, utilization: p.utilizationPercentage })),
    project_health_avg: avgProjectHealth,
    portfolio_count:    portfolioCount,
    overloaded_pms:     overloadedCount,
    warning_pms:        warningCapacityCount,
    healthy_pms:        healthyCount,
    avg_utilization:    avgUtil,
    drift_count:        driftCount,
    commitment_count:   totalCommitments,
    governance_debt:    totalGovernanceDebt,
  };

  const { data: snapshot, error: snapError } = await supabase
    .from("pmo_command_center_snapshots")
    .insert({
      workspace_id:         input.workspaceId,
      overall_health_score: healthScore,
      capacity_score:       capacityScore,
      governance_score:     governanceScore,
      execution_score:      executionScore,
      risk_score:           riskScore,
      project_count:        projectSummaries.length,
      portfolio_count:      portfolioCount,
      pm_count:             pmCount,
      critical_projects:    criticalProjects,
      warning_projects:     warningProjects,
      healthy_projects:     healthyProjects,
      snapshot_payload:     snapshotPayload,
      generated_at:         new Date().toISOString(),
    })
    .select(SNAPSHOT_COLS)
    .single<PMOCommandCenterSnapshotRow>();

  if (snapError || !snapshot) return persistFailed("generate PMO snapshot");

  // 11. Attention queue
  const attentionItems = generateAttentionQueue({
    pms:             pmSummaries,
    projects:        projectSummaries,
    riskScore,
    governanceScore,
  });

  const attentionRows: PMOAttentionItemRow[] = [];
  if (attentionItems.length > 0) {
    const toInsert = attentionItems.map((item) => ({
      workspace_id:       input.workspaceId,
      snapshot_id:        snapshot.id,
      entity_type:        item.entityType,
      entity_id:          validUuid(item.entityId) ? item.entityId : snapshot.id,
      priority:           item.priority,
      title:              item.title,
      description:        item.description,
      recommended_action: item.recommendedAction,
    }));

    const { data: insertedAttention } = await supabase
      .from("pmo_attention_items")
      .insert(toInsert)
      .select(ATTENTION_COLS)
      .returns<PMOAttentionItemRow[]>();

    attentionRows.push(...(insertedAttention ?? []));
  }

  // 12. Executive recommendations
  const recommendations = generateExecutiveRecommendations({
    pms:                  pmSummaries,
    projects:             projectSummaries,
    healthScore,
    capacityScore,
    governanceScore,
    riskScore,
    overloadedPMCount:    overloadedCount,
    criticalProjectCount: criticalProjects,
  });

  const recommendationRows: PMORecommendationRow[] = [];
  if (recommendations.length > 0) {
    const toInsert = recommendations.map((r) => ({
      workspace_id:        input.workspaceId,
      snapshot_id:         snapshot.id,
      recommendation_type: r.type,
      recommendation:      r.recommendation,
      confidence_score:    r.confidence,
      impact_score:        r.impact,
    }));

    const { data: insertedRecs } = await supabase
      .from("pmo_recommendations")
      .insert(toInsert)
      .select(RECOMMEND_COLS)
      .returns<PMORecommendationRow[]>();

    recommendationRows.push(...(insertedRecs ?? []));
  }

  // 13. Hotspots
  const hotspots = identifyPMOHotspots({ pms: pmSummaries, projects: projectSummaries, governanceScore, riskScore });

  // 14. Audit events
  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           input.actorId ?? null,
    actorType:         input.actorId ? "user" : "system",
    eventType:         "PMO_SNAPSHOT_GENERATED",
    eventCategory:     "governance",
    source:            input.actorId ? "user_action" : "system",
    correlationId:     snapshot.id,
    causationId:       null,
    rawReferenceTable: "pmo_command_center_snapshots",
    rawReferenceId:    snapshot.id,
    eventPayload: {
      snapshot_id:      snapshot.id,
      overall_health:   healthScore,
      capacity_score:   capacityScore,
      governance_score: governanceScore,
      risk_score:       riskScore,
      pm_count:         pmCount,
      project_count:    projectSummaries.length,
      critical_projects: criticalProjects,
    },
  });

  const subEvents: Array<{ type: string; payload: Record<string, unknown> }> = [
    { type: "PMO_HEALTH_CALCULATED",               payload: { score: healthScore } },
    { type: "PMO_CAPACITY_CALCULATED",             payload: { score: capacityScore, overloaded_pms: overloadedCount } },
    { type: "PMO_GOVERNANCE_MATURITY_CALCULATED",  payload: { score: governanceScore, debt: totalGovernanceDebt } },
    { type: "PMO_RISK_INDEX_CALCULATED",           payload: { score: riskScore } },
    { type: "PMO_ATTENTION_QUEUE_GENERATED",       payload: { count: attentionItems.length } },
    { type: "PMO_RECOMMENDATIONS_GENERATED",       payload: { count: recommendations.length } },
  ];

  for (const ev of subEvents) {
    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           input.actorId ?? null,
      actorType:         input.actorId ? "user" : "system",
      eventType:         ev.type,
      eventCategory:     "governance",
      source:            "system",
      correlationId:     snapshot.id,
      causationId:       snapshot.id,
      rawReferenceTable: "pmo_command_center_snapshots",
      rawReferenceId:    snapshot.id,
      eventPayload:      { snapshot_id: snapshot.id, ...ev.payload },
    });
  }

  if (hotspots.length > 0) {
    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           input.actorId ?? null,
      actorType:         input.actorId ? "user" : "system",
      eventType:         "PMO_HOTSPOT_IDENTIFIED",
      eventCategory:     "governance",
      source:            "system",
      correlationId:     snapshot.id,
      causationId:       snapshot.id,
      rawReferenceTable: "pmo_command_center_snapshots",
      rawReferenceId:    snapshot.id,
      eventPayload:      { snapshot_id: snapshot.id, hotspot_count: hotspots.length, hotspots },
    });
  }

  return { ok: true, data: { snapshot, attentionItems: attentionRows, recommendations: recommendationRows } };
}

// ─── getPMOSnapshot ───────────────────────────────────────────────────────────

export async function getPMOSnapshot(
  input: GetPMOSnapshotInput
): Promise<PMOCommandCenterResult<PMOSnapshotResult>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: snapshot, error } = await supabase
    .from("pmo_command_center_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("id", input.snapshotId)
    .eq("workspace_id", input.workspaceId)
    .single<PMOCommandCenterSnapshotRow>();

  if (error || !snapshot) return notFound("PMO snapshot");

  const { data: attentionItems } = await supabase
    .from("pmo_attention_items")
    .select(ATTENTION_COLS)
    .eq("snapshot_id", input.snapshotId)
    .eq("workspace_id", input.workspaceId)
    .order("priority", { ascending: true })
    .returns<PMOAttentionItemRow[]>();

  const { data: recommendations } = await supabase
    .from("pmo_recommendations")
    .select(RECOMMEND_COLS)
    .eq("snapshot_id", input.snapshotId)
    .eq("workspace_id", input.workspaceId)
    .order("confidence_score", { ascending: false })
    .returns<PMORecommendationRow[]>();

  return {
    ok: true,
    data: {
      snapshot,
      attentionItems:  attentionItems  ?? [],
      recommendations: recommendations ?? [],
    },
  };
}

// ─── listPMOSnapshots ─────────────────────────────────────────────────────────

export async function listPMOSnapshots(
  input: ListPMOSnapshotsInput
): Promise<PMOCommandCenterResult<PMOCommandCenterSnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pmo_command_center_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false });

  if (typeof input.minHealth === "number") {
    query = query.gte("overall_health_score", input.minHealth);
  }
  if (typeof input.maxHealth === "number") {
    query = query.lte("overall_health_score", input.maxHealth);
  }
  if (typeof input.minRisk === "number") {
    query = query.gte("risk_score", input.minRisk);
  }
  if (typeof input.maxRisk === "number") {
    query = query.lte("risk_score", input.maxRisk);
  }
  if (typeof input.minCapacity === "number") {
    query = query.gte("capacity_score", input.minCapacity);
  }
  if (input.from) {
    query = query.gte("generated_at", input.from);
  }
  if (input.to) {
    query = query.lte("generated_at", input.to);
  }
  if (input.limit && input.limit > 0) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query.returns<PMOCommandCenterSnapshotRow[]>();
  if (error) return persistFailed("list PMO snapshots");
  return { ok: true, data: data ?? [] };
}
