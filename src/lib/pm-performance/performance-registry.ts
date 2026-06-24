import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import {
  PM_PERFORMANCE_SNAPSHOT_SELECTABLE_COLUMNS,
  PM_PERFORMANCE_METRIC_SELECTABLE_COLUMNS,
  PM_PERFORMANCE_EVIDENCE_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  PMPerformanceSnapshotRow,
  PMPerformanceMetricRow,
  PMPerformanceEvidenceRow,
} from "@/lib/db/database-contract";

import { calculatePMGovernanceScore } from "./engines/governance-score";
import { calculatePMExecutionScore } from "./engines/execution-score";
import { calculatePMPredictionAccuracy } from "./engines/prediction-accuracy";
import { calculatePMDecisionEffectiveness } from "./engines/decision-effectiveness";
import { calculatePMPortfolioHealth, CRITICAL_PROJECT_THRESHOLD } from "./engines/portfolio-health";
import { calculatePMOverallPerformance } from "./engines/overall-performance";
import { classifyPMPerformanceStatus } from "./engines/status-classification";
import { calculateEvidenceConfidence, deriveConfidenceRecommendations } from "./evidence-confidence";

import type {
  PMPerformanceResult,
  PMPerformanceRisk,
  GeneratePMPerformanceSnapshotInput,
  GenerateWorkspacePMPerformanceSnapshotsInput,
  GetPMPerformanceSnapshotInput,
  GetLatestPMPerformanceSnapshotInput,
  ListPMPerformanceSnapshotsInput,
  ListLatestPMPerformanceSnapshotsInput,
  ListAtRiskPMPerformanceSnapshotsInput,
  PMPerformanceStatus,
} from "./types";

// ─── Column selectors ─────────────────────────────────────────────────────────

const SNAPSHOT_COLS = PM_PERFORMANCE_SNAPSHOT_SELECTABLE_COLUMNS.join(",");
const METRIC_COLS   = PM_PERFORMANCE_METRIC_SELECTABLE_COLUMNS.join(",");
const EVIDENCE_COLS = PM_PERFORMANCE_EVIDENCE_SELECTABLE_COLUMNS.join(",");

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
function notFound<T>(resource = "Resource"): PMPerformanceResult<T> {
  return { ok: false, error: `${resource} not found.`, failureClass: "not_found" };
}
function persistFailed<T>(action: string): PMPerformanceResult<T> {
  return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
}

// ─── generatePMPerformanceSnapshot ───────────────────────────────────────────

export async function generatePMPerformanceSnapshot(
  input: GeneratePMPerformanceSnapshotInput
): Promise<PMPerformanceResult<PMPerformanceSnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // 1. Verify PM exists in workspace
  const { data: pm, error: pmError } = await supabase
    .from("project_managers")
    .select("id,display_name,email,status")
    .eq("id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (pmError || !pm) return notFound("Project Manager");

  // 2. Get active assignments
  const { data: assignments } = await supabase
    .from("pm_assignments")
    .select("id,project_id,assignment_type,assigned_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .is("removed_at", null);

  const projectIds: string[] = [...new Set((assignments ?? []).map((a: { project_id: string }) => a.project_id))];

  // Rule 7: No evaluating PMs without active assignments
  if (projectIds.length === 0) {
    return validation("Cannot generate a performance snapshot for a PM with no active assignments.");
  }

  // 3. Fetch latest project_os_snapshot per assigned project
  const osSnapshotsByProject: Record<string, {
    id: string;
    operating_health_score: number;
    governance_health_score: number;
    execution_health_score: number;
  }> = {};

  for (const pid of projectIds) {
    const { data: snap } = await supabase
      .from("project_os_snapshots")
      .select("id,operating_health_score,governance_health_score,execution_health_score")
      .eq("workspace_id", input.workspaceId)
      .eq("project_id", pid)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snap) osSnapshotsByProject[pid] = snap;
  }

  const osSnapshots = Object.values(osSnapshotsByProject);

  // 4. Governance: open violations on assigned projects
  const { count: openViolationCount } = await supabase
    .from("governance_violations")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", input.workspaceId)
    .eq("status", "open")
    .in("action_entity_id", projectIds);

  // 5. Execution: task stats across assigned projects
  const { data: allTasks } = await supabase
    .from("execution_tasks")
    .select("id,status,due_date,completed_at")
    .eq("workspace_id", input.workspaceId)
    .in("project_id", projectIds);

  const tasks = allTasks ?? [];
  const now = new Date().toISOString();
  const totalTasks     = tasks.length;
  const completedTasks = tasks.filter((t: { status: string }) => t.status === "completed").length;
  const overdueTasks   = tasks.filter(
    (t: { status: string; due_date: string | null; completed_at: string | null }) =>
      t.status !== "completed" && t.due_date !== null && t.due_date < now
  ).length;

  // 6. Read latest PM Capacity snapshot (read-only context — never mutated here)
  const { data: latestCapacitySnap } = await supabase
    .from("pm_capacity_snapshots")
    .select("id,capacity_status,burn_risk,utilization_percentage,snapshot_payload,generated_at")
    .eq("pm_id", input.pmId)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const capacityContext = latestCapacitySnap
    ? {
        capacity_snapshot_id: latestCapacitySnap.id,
        capacity_status:      latestCapacitySnap.capacity_status,
        burn_risk:            latestCapacitySnap.burn_risk,
        utilization_percentage: latestCapacitySnap.utilization_percentage,
        generated_at:         latestCapacitySnap.generated_at,
        assignment_capacity:  (latestCapacitySnap.snapshot_payload as Record<string, unknown>)?.assignment_capacity ?? null,
      }
    : null;

  // 7. Execution realities (prediction accuracy)
  const { data: realities } = await supabase
    .from("execution_realities")
    .select("id,confidence_score")
    .eq("workspace_id", input.workspaceId)
    .in("status", ["validated", "completed"]);

  const realityList = realities ?? [];

  // 8. Decision outcomes (decision effectiveness)
  const { data: outcomes } = await supabase
    .from("operational_decision_outcomes")
    .select("id,effectiveness_score,outcome_status")
    .eq("workspace_id", input.workspaceId);

  const outcomeList = outcomes ?? [];

  // ─── Calculate scores ────────────────────────────────────────────────────

  const governanceScore = calculatePMGovernanceScore({
    governanceHealthScores: osSnapshots.map((s) => Number(s.governance_health_score)),
    openViolationCount: openViolationCount ?? 0,
    pendingEscalationCount: 0,
  });

  const executionScore = calculatePMExecutionScore({
    executionHealthScores: osSnapshots.map((s) => Number(s.execution_health_score)),
    totalTasks,
    completedTasks,
    overdueTasks,
  });

  const predictionAccuracyScore = calculatePMPredictionAccuracy({
    confidenceScores: realityList.map((r: { confidence_score: number }) => Number(r.confidence_score)),
    varianceValues: [],
  });

  const successfulOutcomes   = outcomeList.filter((o: { outcome_status: string }) => o.outcome_status === "successful").length;
  const unsuccessfulOutcomes = outcomeList.filter((o: { outcome_status: string }) => o.outcome_status === "unsuccessful").length;

  const decisionEffectivenessScore = calculatePMDecisionEffectiveness({
    effectivenessScores: outcomeList.map((o: { effectiveness_score: number }) => Number(o.effectiveness_score)),
    successfulOutcomes,
    unsuccessfulOutcomes,
    totalOutcomes: outcomeList.length,
  });

  const criticalProjectCount = osSnapshots.filter(
    (s) => Number(s.operating_health_score) < CRITICAL_PROJECT_THRESHOLD
  ).length;

  const portfolioHealthScore = calculatePMPortfolioHealth({
    operatingHealthScores: osSnapshots.map((s) => Number(s.operating_health_score)),
    criticalProjectCount,
  });

  const overallScore = calculatePMOverallPerformance({
    governance: governanceScore,
    execution:  executionScore,
    prediction: predictionAccuracyScore,
    decision:   decisionEffectivenessScore,
    portfolio:  portfolioHealthScore,
  });

  const performanceStatus = classifyPMPerformanceStatus(overallScore);

  // ─── Evidence confidence ─────────────────────────────────────────────────

  const evidenceAvailability = {
    project_os_snapshots: osSnapshots.length > 0,
    execution_tasks:      tasks.length > 0,
    execution_realities:  realityList.length > 0,
    decision_outcomes:    outcomeList.length > 0,
    capacity_context:     latestCapacitySnap !== null,
  };
  const evidenceConfidence = calculateEvidenceConfidence(evidenceAvailability);
  const confidenceRecommendations = deriveConfidenceRecommendations(evidenceConfidence);

  // ─── Performance risk ────────────────────────────────────────────────────

  let baseRisk: PMPerformanceRisk =
    overallScore >= 75 ? "low"      :
    overallScore >= 60 ? "medium"   :
    overallScore >= 45 ? "high"     :
    "critical";

  // Capacity overload elevates risk one level
  const capacityStatus = (capacityContext as { capacity_status?: string } | null)?.capacity_status ?? null;
  const isOverloaded = capacityStatus === "overloaded" || capacityStatus === "at_capacity";
  if (isOverloaded) {
    if (baseRisk === "low")    baseRisk = "medium";
    else if (baseRisk === "medium") baseRisk = "high";
    else if (baseRisk === "high")   baseRisk = "critical";
  }
  const performanceRisk: PMPerformanceRisk = baseRisk;

  // ─── Persist snapshot ────────────────────────────────────────────────────

  const capacityContextWithPresence = latestCapacitySnap
    ? { ...capacityContext, present: true as const, source: "pm_capacity" as const }
    : { present: false as const, source: "pm_capacity" as const };

  const snapshotPayload = {
    pm_name: pm.display_name,
    pm_email: pm.email,
    pm_status: pm.status,
    assigned_project_count: projectIds.length,
    os_snapshot_count: osSnapshots.length,
    task_count: totalTasks,
    completed_task_count: completedTasks,
    overdue_task_count: overdueTasks,
    reality_count: realityList.length,
    outcome_count: outcomeList.length,
    domain_scores: {
      governance: governanceScore,
      execution: executionScore,
      prediction: predictionAccuracyScore,
      decision: decisionEffectivenessScore,
      portfolio: portfolioHealthScore,
    },
    performance_risk: performanceRisk,
    evidence_confidence: evidenceConfidence,
    score_interpretation: evidenceConfidence.score_interpretation,
    confidence_recommendations: confidenceRecommendations,
    capacity_context: capacityContextWithPresence,
  };

  const { data: snapshot, error: snapError } = await supabase
    .from("pm_performance_snapshots")
    .insert({
      workspace_id:                 input.workspaceId,
      pm_id:                        input.pmId,
      governance_score:             governanceScore,
      execution_score:              executionScore,
      prediction_accuracy_score:    predictionAccuracyScore,
      decision_effectiveness_score: decisionEffectivenessScore,
      portfolio_health_score:       portfolioHealthScore,
      overall_score:                overallScore,
      performance_status:           performanceStatus,
      snapshot_payload:             snapshotPayload,
      generated_at:                 new Date().toISOString(),
    })
    .select(SNAPSHOT_COLS)
    .single<PMPerformanceSnapshotRow>();

  if (snapError || !snapshot) return persistFailed("generate performance snapshot");

  // ─── Persist metrics ─────────────────────────────────────────────────────

  const domainMetrics = [
    { domain: "governance" as const, name: "governance_health",       value: governanceScore,             weight: 0.20 },
    { domain: "execution"  as const, name: "execution_health",        value: executionScore,              weight: 0.25 },
    { domain: "prediction" as const, name: "prediction_accuracy",     value: predictionAccuracyScore,     weight: 0.15 },
    { domain: "decision"   as const, name: "decision_effectiveness",  value: decisionEffectivenessScore,  weight: 0.20 },
    { domain: "portfolio"  as const, name: "portfolio_health",        value: portfolioHealthScore,        weight: 0.20 },
    { domain: "overall"    as const, name: "overall_performance",     value: overallScore,                weight: 1.00 },
  ];

  const metricsToInsert = domainMetrics.map((m) => ({
    workspace_id:            input.workspaceId,
    performance_snapshot_id: snapshot.id,
    metric_domain:           m.domain,
    metric_name:             m.name,
    metric_value:            m.value,
    metric_weight:           m.weight,
    metric_status:           classifyPMPerformanceStatus(m.value),
  }));

  await supabase.from("pm_performance_metrics").insert(metricsToInsert);

  // ─── Persist evidence ────────────────────────────────────────────────────

  const evidenceToInsert: Array<{
    workspace_id: string;
    performance_snapshot_id: string;
    source_entity_type: string;
    source_entity_id: string;
    evidence_type: string;
    contribution_weight: number;
  }> = [];

  for (const snap of osSnapshots) {
    evidenceToInsert.push({
      workspace_id:            input.workspaceId,
      performance_snapshot_id: snapshot.id,
      source_entity_type:      "project_os_snapshot",
      source_entity_id:        snap.id,
      evidence_type:           "portfolio_health",
      contribution_weight:     1 / osSnapshots.length,
    });
  }

  for (const reality of realityList) {
    evidenceToInsert.push({
      workspace_id:            input.workspaceId,
      performance_snapshot_id: snapshot.id,
      source_entity_type:      "execution_reality",
      source_entity_id:        reality.id,
      evidence_type:           "prediction_accuracy",
      contribution_weight:     realityList.length > 0 ? 1 / realityList.length : 1,
    });
  }

  for (const outcome of outcomeList) {
    evidenceToInsert.push({
      workspace_id:            input.workspaceId,
      performance_snapshot_id: snapshot.id,
      source_entity_type:      "operational_decision_outcome",
      source_entity_id:        outcome.id,
      evidence_type:           "decision_outcome",
      contribution_weight:     outcomeList.length > 0 ? 1 / outcomeList.length : 1,
    });
  }

  if (evidenceToInsert.length > 0) {
    await supabase.from("pm_performance_evidence").insert(evidenceToInsert);
  }

  // ─── Emit audit event ────────────────────────────────────────────────────

  await createPlatformEvent({
    workspaceId:       input.workspaceId,
    projectId:         null,
    actorId:           input.actorId ?? null,
    actorType:         input.actorId ? "user" : "system",
    eventType:         "PM_PERFORMANCE_SNAPSHOT_GENERATED",
    eventCategory:     "governance",
    source:            input.actorId ? "user_action" : "system",
    correlationId:     snapshot.id,
    causationId:       null,
    rawReferenceTable: "pm_performance_snapshots",
    rawReferenceId:    snapshot.id,
    eventPayload: {
      pm_id:                  input.pmId,
      snapshot_id:            snapshot.id,
      overall_score:          overallScore,
      status:                 performanceStatus,
      performance_risk:       performanceRisk,
      project_count:          projectIds.length,
      evidence_completeness:  evidenceConfidence.evidence_completeness,
      confidence_level:       evidenceConfidence.confidence_level,
      score_interpretation:   evidenceConfidence.score_interpretation,
      missing_source_count:   evidenceConfidence.missing_source_count,
    },
  });

  return { ok: true, data: snapshot };
}

// ─── getPMPerformanceSnapshot ─────────────────────────────────────────────────

export async function getPMPerformanceSnapshot(
  input: GetPMPerformanceSnapshotInput
): Promise<PMPerformanceResult<PMPerformanceSnapshotRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.snapshotId))  return validation("snapshotId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_performance_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("id", input.snapshotId)
    .eq("workspace_id", input.workspaceId)
    .single<PMPerformanceSnapshotRow>();

  if (error || !data) return notFound("Performance snapshot");
  return { ok: true, data };
}

// ─── listPMPerformanceSnapshots ───────────────────────────────────────────────

export async function listPMPerformanceSnapshots(
  input: ListPMPerformanceSnapshotsInput
): Promise<PMPerformanceResult<PMPerformanceSnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pm_performance_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false });

  if (input.pmId) {
    if (!validUuid(input.pmId)) return validation("pmId must be a valid UUID.");
    query = query.eq("pm_id", input.pmId);
  }

  if (input.status) {
    query = query.eq("performance_status", input.status);
  }

  if (input.limit && input.limit > 0) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query.returns<PMPerformanceSnapshotRow[]>();
  if (error) return persistFailed("list performance snapshots");
  return { ok: true, data: data ?? [] };
}

// ─── getLatestPMPerformanceSnapshot ──────────────────────────────────────────

export async function getLatestPMPerformanceSnapshot(
  input: GetLatestPMPerformanceSnapshotInput
): Promise<PMPerformanceResult<PMPerformanceSnapshotRow | null>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");
  if (!validUuid(input.pmId))        return validation("pmId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_performance_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", input.workspaceId)
    .eq("pm_id", input.pmId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle<PMPerformanceSnapshotRow>();

  if (error) return persistFailed("get latest performance snapshot");
  return { ok: true, data: data ?? null };
}

// ─── listLatestPMPerformanceSnapshots ────────────────────────────────────────

export async function listLatestPMPerformanceSnapshots(
  input: ListLatestPMPerformanceSnapshotsInput
): Promise<PMPerformanceResult<PMPerformanceSnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pm_performance_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("generated_at", { ascending: false })
    .returns<PMPerformanceSnapshotRow[]>();

  if (error) return persistFailed("list latest performance snapshots");

  // Deduplicate to latest per PM
  const seen = new Set<string>();
  const latest: PMPerformanceSnapshotRow[] = [];
  for (const snap of (data ?? [])) {
    if (!seen.has(snap.pm_id)) {
      seen.add(snap.pm_id);
      latest.push(snap);
    }
  }
  return { ok: true, data: latest };
}

// ─── listAtRiskPMPerformanceSnapshots ────────────────────────────────────────

export async function listAtRiskPMPerformanceSnapshots(
  input: ListAtRiskPMPerformanceSnapshotsInput
): Promise<PMPerformanceResult<PMPerformanceSnapshotRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  // Get latest per PM first, then filter to warning/critical
  const latestResult = await listLatestPMPerformanceSnapshots(input);
  if (!latestResult.ok) return latestResult;

  const atRisk = latestResult.data.filter((s) => {
    if (s.performance_status === "warning" || s.performance_status === "critical") return true;
    const payload = s.snapshot_payload as Record<string, unknown> | null;
    const risk = payload?.performance_risk as string | undefined;
    return risk === "high" || risk === "critical";
  });
  return { ok: true, data: atRisk };
}

// ─── generateWorkspacePMPerformanceSnapshots ──────────────────────────────────

export async function generateWorkspacePMPerformanceSnapshots(
  input: GenerateWorkspacePMPerformanceSnapshotsInput
): Promise<PMPerformanceResult<{ generated: PMPerformanceSnapshotRow[]; skipped: number; total_pm_count: number }>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a valid UUID.");

  const supabase = await createSupabaseServerClient();

  // Get all active PMs in workspace
  const { data: pms, error: pmsError } = await supabase
    .from("project_managers")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active");

  if (pmsError) return persistFailed("list project managers for workspace snapshot generation");

  const pmList = pms ?? [];
  const generated: PMPerformanceSnapshotRow[] = [];
  let skipped = 0;

  for (const pm of pmList) {
    const result = await generatePMPerformanceSnapshot({
      workspaceId: input.workspaceId,
      pmId:        pm.id,
      actorId:     input.actorId,
    });
    if (result.ok) {
      generated.push(result.data);
    } else if (result.failureClass === "validation") {
      // PM has no assignments — skip silently
      skipped++;
    }
    // Other failures (persistence) are skipped with count
    else {
      skipped++;
    }
  }

  // Emit workspace-level event if any snapshots were generated
  if (generated.length > 0) {
    const scores = generated.map((s) => Number(s.overall_score));
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    await createPlatformEvent({
      workspaceId:       input.workspaceId,
      projectId:         null,
      actorId:           input.actorId ?? null,
      actorType:         input.actorId ? "user" : "system",
      eventType:         "PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED",
      eventCategory:     "governance",
      source:            input.actorId ? "user_action" : "system",
      correlationId:     null,
      causationId:       null,
      rawReferenceTable: "pm_performance_snapshots",
      rawReferenceId:    null,
      eventPayload: {
        workspace_id:             input.workspaceId,
        actor_user_id:            input.actorId ?? null,
        generated_snapshot_count: generated.length,
        skipped_count:            skipped,
        total_pm_count:           pmList.length,
        average_performance_score: Math.round(avgScore * 10) / 10,
        excellent_count: generated.filter((s) => s.performance_status === "excellent").length,
        strong_count:    generated.filter((s) => s.performance_status === "strong").length,
        stable_count:    generated.filter((s) => s.performance_status === "stable").length,
        warning_count:   generated.filter((s) => s.performance_status === "warning").length,
        critical_count:  generated.filter((s) => s.performance_status === "critical").length,
        source:          "pm_performance",
      },
    });
  }

  return { ok: true, data: { generated, skipped, total_pm_count: pmList.length } };
}
