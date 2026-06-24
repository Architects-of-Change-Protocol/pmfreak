// ─── PMO Command Center — PM Dossier Read Aggregation Service ─────────────────
//
// Aggregates PM operating dossiers into a unified PMO executive view.
// This module reads from existing domain services. It does not recalculate
// capacity or performance, and does not mutate any records.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listProjectManagers } from "@/lib/pm-registry";
import { getPMOperatingDossier } from "@/lib/pm-detail-intelligence";
import { PLATFORM_EVENT_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { PMOperatingDossier } from "@/lib/pm-detail-intelligence";
import type { PlatformEventRow } from "@/lib/platform-events/types";

import type {
  GetPMOCommandCenterViewInput,
  PMOCommandCenterView,
  PMOCommandCenterResult,
  PMOOperationalStatus,
  PMOExecutiveSummary,
  PMOPMCounts,
  PMOPMRef,
  PMOCapacityOverview,
  PMOPerformanceOverview,
  PMOEvidenceConfidenceOverview,
  PMOAttentionQueues,
  PMOAttentionItem,
  PMORecommendation,
  PMODossierRow,
  PMOEventTimelineItem,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PMO_TIMELINE_EVENT_TYPES = [
  "PROJECT_MANAGER_REGISTERED",
  "PROJECT_MANAGER_UPDATED",
  "PROJECT_MANAGER_PROFILE_UPDATED",
  "PROJECT_MANAGER_ASSIGNED",
  "PROJECT_MANAGER_UNASSIGNED",
  "PM_CAPACITY_SNAPSHOT_GENERATED",
  "PM_CAPACITY_NEAR_LIMIT",
  "PM_CAPACITY_AT_LIMIT",
  "PM_CAPACITY_OVERLOADED",
  "PM_PERFORMANCE_SNAPSHOT_GENERATED",
  "PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED",
];

const SEVERITY_ORDER: Array<PMORecommendation["severity"]> = ["critical", "high", "medium", "low"];

// ─── Dossier loader ───────────────────────────────────────────────────────────

async function listWorkspacePMOperatingDossiers(
  workspaceId: string,
  actorId?: string,
): Promise<PMOperatingDossier[]> {
  const listResult = await listProjectManagers(workspaceId);
  if (!listResult.ok) return [];

  const settled = await Promise.allSettled(
    listResult.data.map((pm) =>
      getPMOperatingDossier({ workspaceId, pmId: pm.id, actorId })
    )
  );

  const dossiers: PMOperatingDossier[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value.ok) {
      dossiers.push(result.value.data);
    }
  }
  return dossiers;
}

// ─── Operational status derivation ───────────────────────────────────────────

export function derivePMOOperationalStatus(dossiers: PMOperatingDossier[]): PMOOperationalStatus {
  if (dossiers.length === 0) return "healthy";

  const statuses = dossiers.map((d) => d.executive_summary.operational_status);

  if (statuses.includes("critical")) return "critical";

  const perfRiskCount = statuses.filter((s) => s === "performance_risk").length;
  if (perfRiskCount > 0) return "performance_pressure";

  const capRiskCount = statuses.filter((s) => s === "capacity_risk").length;
  if (capRiskCount > 0) return "capacity_pressure";

  const evidenceGapCount = statuses.filter((s) => s === "insufficient_evidence").length;
  if (evidenceGapCount > 0) return "evidence_gap";

  const watchCount = statuses.filter((s) => s === "watch").length;
  if (watchCount > 0) return "watch";

  return "healthy";
}

// ─── PM Counts ────────────────────────────────────────────────────────────────

export function buildPMOPMCounts(dossiers: PMOperatingDossier[]): PMOPMCounts {
  const byStatus: Record<string, number> = {};
  for (const d of dossiers) {
    const s = d.executive_summary.operational_status;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  return {
    total: dossiers.length,
    active: dossiers.filter((d) => d.pm.status === "active").length,
    inactive: dossiers.filter((d) => d.pm.status === "inactive").length,
    suspended: dossiers.filter((d) => d.pm.status === "suspended").length,
    by_operational_status: byStatus,
  };
}

// ─── Capacity Overview ────────────────────────────────────────────────────────

export function buildPMOCapacityOverview(dossiers: PMOperatingDossier[]): PMOCapacityOverview {
  const withCap = dossiers.filter((d) => d.capacity.present);
  const withoutCap = dossiers.filter((d) => !d.capacity.present);

  let totalUtil = 0;
  let utilCount = 0;
  let totalCounted = 0;
  let totalObserver = 0;
  let underutilized = 0;
  let healthyCap = 0;
  let nearCap = 0;
  let atCap = 0;
  let overloaded = 0;

  let highestUtil: PMOPMRef | null = null;
  let highestUtilVal = -1;
  const overloadedPMs: PMOPMRef[] = [];
  const underutilizedPMs: PMOPMRef[] = [];
  const recommendations: string[] = [];

  for (const d of withCap) {
    const cap = d.capacity;
    if (!cap.present) continue;

    const util = cap.capacity_utilization ?? null;
    if (util !== null) {
      totalUtil += util;
      utilCount++;
      if (util > highestUtilVal) {
        highestUtilVal = util;
        highestUtil = {
          pm_id: d.pm.pm_id,
          display_name: d.pm.display_name,
          capacity_utilization: util,
          capacity_status: cap.capacity_status,
        };
      }
    }

    totalCounted += cap.counted_assignment_count ?? 0;
    totalObserver += cap.observer_assignment_count ?? 0;

    const status = cap.capacity_status;
    const pmRef: PMOPMRef = {
      pm_id: d.pm.pm_id,
      display_name: d.pm.display_name,
      capacity_utilization: util,
      capacity_status: status,
    };

    if (status === "underutilized") {
      underutilized++;
      underutilizedPMs.push(pmRef);
    } else if (status === "healthy") {
      healthyCap++;
    } else if (status === "near_capacity" || status === "busy") {
      nearCap++;
    } else if (status === "at_capacity") {
      atCap++;
    } else if (status === "overloaded" || status === "critical") {
      overloaded++;
      overloadedPMs.push(pmRef);
    }

    for (const r of cap.recommendations) {
      if (!recommendations.includes(r.message)) {
        recommendations.push(r.message);
      }
    }
  }

  if (overloaded > 0) {
    recommendations.unshift(`${overloaded} PM(s) are overloaded — review workload before new assignments.`);
  }
  if (underutilized > 0 && underutilized >= Math.ceil(dossiers.length / 2)) {
    recommendations.push(`${underutilized} PM(s) are underutilized — consider rebalancing assignments.`);
  }

  return {
    pms_with_capacity_snapshot: withCap.length,
    pms_missing_capacity_snapshot: withoutCap.length,
    average_capacity_utilization: utilCount > 0 ? totalUtil / utilCount : null,
    underutilized_count: underutilized,
    healthy_capacity_count: healthyCap,
    near_capacity_count: nearCap,
    at_capacity_count: atCap,
    overloaded_count: overloaded,
    total_counted_assignments: totalCounted,
    total_observer_assignments: totalObserver,
    highest_utilization_pm: highestUtil,
    overloaded_pms: overloadedPMs,
    underutilized_pms: underutilizedPMs,
    capacity_recommendations: recommendations.slice(0, 10),
  };
}

// ─── Performance Overview ─────────────────────────────────────────────────────

export function buildPMOPerformanceOverview(dossiers: PMOperatingDossier[]): PMOPerformanceOverview {
  const withPerf = dossiers.filter((d) => d.performance.present);
  const withoutPerf = dossiers.filter((d) => !d.performance.present);

  let totalScore = 0;
  let scoreCount = 0;
  let excellent = 0;
  let strong = 0;
  let stable = 0;
  let warning = 0;
  let criticalPerf = 0;
  let lowRisk = 0;
  let medRisk = 0;
  let highRisk = 0;
  let criticalRisk = 0;

  const topPerformers: PMOPMRef[] = [];
  const atRiskPMs: PMOPMRef[] = [];
  const criticalPMs: PMOPMRef[] = [];
  const recommendations: string[] = [];

  for (const d of withPerf) {
    const perf = d.performance;
    if (!perf.present) continue;

    const score = perf.overall_performance_score;
    totalScore += score;
    scoreCount++;

    const pmRef: PMOPMRef = {
      pm_id: d.pm.pm_id,
      display_name: d.pm.display_name,
      performance_score: score,
      performance_status: perf.performance_status,
    };

    const status = perf.performance_status;
    if (status === "excellent") { excellent++; topPerformers.push(pmRef); }
    else if (status === "strong") { strong++; topPerformers.push(pmRef); }
    else if (status === "stable") { stable++; }
    else if (status === "warning") { warning++; atRiskPMs.push(pmRef); }
    else if (status === "critical") { criticalPerf++; criticalPMs.push(pmRef); }

    const risk = perf.performance_risk;
    if (risk === "low") lowRisk++;
    else if (risk === "medium") medRisk++;
    else if (risk === "high") highRisk++;
    else if (risk === "critical") criticalRisk++;

    for (const r of perf.recommendations) {
      if (!recommendations.includes(r)) recommendations.push(r);
    }
  }

  if (criticalPerf > 0) {
    recommendations.unshift(`${criticalPerf} PM(s) have critical performance — immediate PMO review required.`);
  }
  if (warning > 0) {
    recommendations.push(`${warning} PM(s) have warning-level performance — schedule check-ins.`);
  }

  return {
    pms_with_performance_snapshot: withPerf.length,
    pms_missing_performance_snapshot: withoutPerf.length,
    average_performance_score: scoreCount > 0 ? totalScore / scoreCount : null,
    excellent_count: excellent,
    strong_count: strong,
    stable_count: stable,
    warning_count: warning,
    critical_count: criticalPerf,
    low_risk_count: lowRisk,
    medium_risk_count: medRisk,
    high_risk_count: highRisk,
    critical_risk_count: criticalRisk,
    top_performers: topPerformers.slice(0, 5),
    at_risk_pms: atRiskPMs,
    critical_pms: criticalPMs,
    performance_recommendations: recommendations.slice(0, 10),
  };
}

// ─── Evidence Confidence Overview ─────────────────────────────────────────────

export function buildPMOEvidenceConfidenceOverview(dossiers: PMOperatingDossier[]): PMOEvidenceConfidenceOverview {
  const withEvidence = dossiers.filter((d) => d.evidence_confidence.present);
  const withoutEvidence = dossiers.filter((d) => !d.evidence_confidence.present);

  let totalCompleteness = 0;
  let completenessCount = 0;
  let highConf = 0;
  let medConf = 0;
  let lowConf = 0;
  let veryLowConf = 0;

  const lowConfPMs: PMOPMRef[] = [];
  const missingSources: Record<string, number> = {};
  const neutralDomains: Record<string, number> = {};
  const recommendations: string[] = [];

  for (const d of withEvidence) {
    const ev = d.evidence_confidence;
    if (!ev.present) continue;

    totalCompleteness += ev.evidence_completeness;
    completenessCount++;

    const level = ev.confidence_level;
    if (level === "high") highConf++;
    else if (level === "medium") medConf++;
    else if (level === "low") {
      lowConf++;
      lowConfPMs.push({ pm_id: d.pm.pm_id, display_name: d.pm.display_name, evidence_confidence_level: level });
    } else if (level === "very_low") {
      veryLowConf++;
      lowConfPMs.push({ pm_id: d.pm.pm_id, display_name: d.pm.display_name, evidence_confidence_level: level });
    }

    for (const src of ev.missing_sources) {
      missingSources[src] = (missingSources[src] ?? 0) + 1;
    }
    for (const domain of ev.neutral_baseline_domains) {
      neutralDomains[domain] = (neutralDomains[domain] ?? 0) + 1;
    }
  }

  const commonMissingSources = Object.entries(missingSources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source, missing_count]) => ({ source, missing_count }));

  const commonNeutralDomains = Object.entries(neutralDomains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => ({ domain, count }));

  if (veryLowConf > 0) {
    recommendations.push(`${veryLowConf} PM(s) have very low evidence confidence — performance scores are provisional.`);
  }
  if (lowConf > 0) {
    recommendations.push(`${lowConf} PM(s) have low evidence confidence — expand data coverage.`);
  }
  if (commonMissingSources.length > 0) {
    const top = commonMissingSources[0];
    recommendations.push(`Most common missing source: "${top.source}" (${top.missing_count} PMs). Connecting this source will improve evidence quality.`);
  }

  return {
    pms_with_evidence_confidence: withEvidence.length,
    pms_missing_evidence_confidence: withoutEvidence.length,
    average_evidence_completeness: completenessCount > 0 ? totalCompleteness / completenessCount : null,
    high_confidence_count: highConf,
    medium_confidence_count: medConf,
    low_confidence_count: lowConf,
    very_low_confidence_count: veryLowConf,
    low_confidence_pms: lowConfPMs,
    common_missing_sources: commonMissingSources,
    common_neutral_baseline_domains: commonNeutralDomains,
    evidence_recommendations: recommendations.slice(0, 10),
  };
}

// ─── Attention Queues ─────────────────────────────────────────────────────────

export function buildPMOAttentionQueues(dossiers: PMOperatingDossier[]): PMOAttentionQueues {
  const criticalAttention: PMOAttentionItem[] = [];
  const capacityAttention: PMOAttentionItem[] = [];
  const performanceAttention: PMOAttentionItem[] = [];
  const evidenceAttention: PMOAttentionItem[] = [];
  const underutilizedCapacity: PMOAttentionItem[] = [];
  const highPerformers: PMOAttentionItem[] = [];

  for (const d of dossiers) {
    const es = d.executive_summary;
    const item: PMOAttentionItem = {
      pm_id: d.pm.pm_id,
      display_name: d.pm.display_name,
      email: d.pm.email,
      operational_status: es.operational_status,
      capacity_status: es.capacity_status,
      performance_status: es.performance_status,
      performance_risk: es.performance_risk,
      evidence_confidence_level: es.evidence_confidence_level,
      top_recommendation: es.top_recommendation,
      dossier_url: `/pm-registry/${d.pm.pm_id}`,
    };

    if (es.operational_status === "critical") {
      criticalAttention.push(item);
    }

    if (
      es.capacity_status === "overloaded" ||
      es.capacity_status === "critical" ||
      es.capacity_status === "at_capacity" ||
      es.capacity_status === "near_capacity"
    ) {
      capacityAttention.push(item);
    }

    if (
      es.performance_status === "critical" ||
      es.performance_status === "warning" ||
      es.performance_risk === "critical" ||
      es.performance_risk === "high"
    ) {
      performanceAttention.push(item);
    }

    if (
      es.evidence_confidence_level === "very_low" ||
      es.evidence_confidence_level === "low"
    ) {
      evidenceAttention.push(item);
    }

    if (es.capacity_status === "underutilized") {
      underutilizedCapacity.push(item);
    }

    if (
      es.performance_status === "excellent" ||
      es.performance_status === "strong"
    ) {
      highPerformers.push(item);
    }
  }

  return {
    critical_attention: criticalAttention,
    capacity_attention: capacityAttention,
    performance_attention: performanceAttention,
    evidence_attention: evidenceAttention,
    underutilized_capacity: underutilizedCapacity,
    high_performers: highPerformers,
  };
}

// ─── Recommendation Queue ─────────────────────────────────────────────────────

export function buildPMORecommendationQueue(dossiers: PMOperatingDossier[]): PMORecommendation[] {
  const raw: PMORecommendation[] = [];

  for (const d of dossiers) {
    for (const rec of d.recommendations) {
      raw.push({
        type: rec.type,
        severity: rec.severity,
        message: rec.message,
        source: rec.source,
        pm_id: d.pm.pm_id,
        pm_name: d.pm.display_name,
        operational_status: d.executive_summary.operational_status,
        created_from: d.generated_at,
      });
    }
  }

  // Deduplicate by pm_id + type + message
  const seen = new Set<string>();
  const deduped = raw.filter((r) => {
    const key = `${r.pm_id ?? ""}::${r.type}::${r.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const OPERATIONAL_ORDER: Record<string, number> = {
    critical: 0,
    performance_risk: 1,
    capacity_risk: 2,
    insufficient_evidence: 3,
    watch: 4,
    healthy: 5,
  };

  return deduped.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severityDiff !== 0) return severityDiff;
    const aOp = OPERATIONAL_ORDER[a.operational_status ?? ""] ?? 99;
    const bOp = OPERATIONAL_ORDER[b.operational_status ?? ""] ?? 99;
    return aOp - bOp;
  });
}

// ─── Dossier Rows ─────────────────────────────────────────────────────────────

export function buildPMODossierRows(dossiers: PMOperatingDossier[]): PMODossierRow[] {
  return dossiers.map((d) => {
    const es = d.executive_summary;
    return {
      pm_id: d.pm.pm_id,
      display_name: d.pm.display_name,
      email: d.pm.email,
      pm_status: d.pm.status,
      role: es.role,
      operational_status: es.operational_status,
      active_assignment_count: es.active_assignment_count,
      counted_assignment_count: es.counted_assignment_count,
      capacity_status: es.capacity_status,
      capacity_utilization: d.capacity.present ? d.capacity.capacity_utilization : null,
      performance_status: es.performance_status,
      performance_risk: es.performance_risk,
      overall_performance_score: d.performance.present ? d.performance.overall_performance_score : null,
      evidence_confidence_level: es.evidence_confidence_level,
      evidence_completeness: es.evidence_completeness,
      top_recommendation: es.top_recommendation,
      dossier_url: `/pm-registry/${d.pm.pm_id}`,
    };
  });
}

// ─── Executive Summary ────────────────────────────────────────────────────────

export function buildPMOExecutiveSummary(
  dossiers: PMOperatingDossier[],
  pmoStatus: PMOOperationalStatus,
  capacityOverview: ReturnType<typeof buildPMOCapacityOverview>,
  performanceOverview: ReturnType<typeof buildPMOPerformanceOverview>,
  recommendationQueue: PMORecommendation[],
  generatedAt: string,
): PMOExecutiveSummary {
  const statuses = dossiers.map((d) => d.executive_summary.operational_status);

  const topRec = recommendationQueue[0]?.message ?? null;

  const topRisk =
    pmoStatus === "critical" ? "One or more PMs are in critical state — immediate intervention required." :
    pmoStatus === "performance_pressure" ? "Performance risks across one or more PMs require PMO attention." :
    pmoStatus === "capacity_pressure" ? "Capacity pressure detected — monitor workloads before new assignments." :
    pmoStatus === "evidence_gap" ? "Evidence confidence gaps limit visibility into PM performance." :
    pmoStatus === "watch" ? "Some PMs are in watch status — monitor closely." :
    null;

  return {
    total_pms: dossiers.length,
    active_pms: dossiers.filter((d) => d.pm.status === "active").length,
    inactive_pms: dossiers.filter((d) => d.pm.status === "inactive").length,
    suspended_pms: dossiers.filter((d) => d.pm.status === "suspended").length,
    healthy_pms: statuses.filter((s) => s === "healthy").length,
    watch_pms: statuses.filter((s) => s === "watch").length,
    capacity_risk_pms: statuses.filter((s) => s === "capacity_risk").length,
    performance_risk_pms: statuses.filter((s) => s === "performance_risk").length,
    insufficient_evidence_pms: statuses.filter((s) => s === "insufficient_evidence").length,
    critical_pms: statuses.filter((s) => s === "critical").length,
    pmo_operational_status: pmoStatus,
    top_pmo_risk: topRisk,
    top_recommendation: topRec,
    generated_at: generatedAt,
  };
}

// ─── Event Timeline ───────────────────────────────────────────────────────────

async function buildPMOEventTimeline(
  workspaceId: string,
  dossiers: PMOperatingDossier[],
): Promise<PMOEventTimelineItem[]> {
  const supabase = await createSupabaseServerClient();
  const cols = PLATFORM_EVENT_SELECTABLE_COLUMNS.join(",");

  const { data, error } = await supabase
    .from("platform_events")
    .select(cols)
    .eq("workspace_id", workspaceId)
    .in("event_type", PMO_TIMELINE_EVENT_TYPES)
    .order("occurred_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("pmo_command_center.event_timeline.failed", { workspaceId, error: error.message });
    return [];
  }

  const pmNameMap = new Map<string, string>();
  for (const d of dossiers) {
    pmNameMap.set(d.pm.pm_id, d.pm.display_name);
  }

  const rows = (data as unknown as PlatformEventRow[]) ?? [];

  return rows.map((e) => {
    const payload = e.event_payload as Record<string, unknown>;
    const pmId = (payload.pm_id as string | undefined) ?? null;
    const pmName = pmId ? (pmNameMap.get(pmId) ?? null) : null;

    const excerpt: Record<string, unknown> = {};
    const safeKeys = ["pm_id", "project_id", "assignment_type", "capacity_status", "performance_status", "performance_risk", "snapshot_id"];
    for (const k of safeKeys) {
      if (payload[k] !== undefined) excerpt[k] = payload[k];
    }

    const summary = buildEventSummary(e);

    return {
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      actor_user_id: e.actor_id,
      source: e.source,
      pm_id: pmId,
      pm_name: pmName,
      summary,
      payload_excerpt: excerpt,
    };
  });
}

function buildEventSummary(event: PlatformEventRow): string {
  const p = event.event_payload as Record<string, unknown>;
  switch (event.event_type) {
    case "PROJECT_MANAGER_REGISTERED":
      return "Project Manager registered in the workspace.";
    case "PROJECT_MANAGER_UPDATED":
      return "Project Manager record was updated.";
    case "PROJECT_MANAGER_PROFILE_UPDATED":
      return "PM governance profile was updated.";
    case "PROJECT_MANAGER_ASSIGNED": {
      const type = p.assignment_type as string | undefined;
      return `PM assigned as ${type ?? "PM"} to a project.`;
    }
    case "PROJECT_MANAGER_UNASSIGNED":
      return "PM assignment was removed and preserved as history.";
    case "PM_CAPACITY_SNAPSHOT_GENERATED": {
      const status = p.assignment_capacity_status as string | undefined ?? p.capacity_status as string | undefined;
      return `Capacity snapshot generated${status ? ` — status: ${status}` : ""}.`;
    }
    case "PM_CAPACITY_NEAR_LIMIT":
      return "PM is near capacity.";
    case "PM_CAPACITY_AT_LIMIT":
      return "PM is at capacity.";
    case "PM_CAPACITY_OVERLOADED":
      return "PM is overloaded.";
    case "PM_PERFORMANCE_SNAPSHOT_GENERATED": {
      const status = p.performance_status as string | undefined;
      const risk = p.performance_risk as string | undefined;
      const parts = ["Performance snapshot generated."];
      if (status) parts.push(`Status: ${status}.`);
      if (risk) parts.push(`Risk: ${risk}.`);
      return parts.join(" ");
    }
    case "PM_WORKSPACE_PERFORMANCE_SNAPSHOTS_GENERATED":
      return "Workspace-wide performance snapshots were generated.";
    default:
      return `${event.event_type.replace(/_/g, " ").toLowerCase()} event recorded.`;
  }
}

// ─── Main service function ────────────────────────────────────────────────────

export async function getPMOCommandCenter(
  input: GetPMOCommandCenterViewInput,
): Promise<PMOCommandCenterResult<PMOCommandCenterView>> {
  const { workspaceId, actorId } = input;

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_COMMAND_CENTER_WORKSPACE_REQUIRED" };
  }

  try {
    const dossiers = await listWorkspacePMOperatingDossiers(workspaceId, actorId);

    const generatedAt = new Date().toISOString();
    const pmoStatus = derivePMOOperationalStatus(dossiers);
    const pmCounts = buildPMOPMCounts(dossiers);
    const capacityOverview = buildPMOCapacityOverview(dossiers);
    const performanceOverview = buildPMOPerformanceOverview(dossiers);
    const evidenceConfidenceOverview = buildPMOEvidenceConfidenceOverview(dossiers);
    const attentionQueues = buildPMOAttentionQueues(dossiers);
    const recommendationQueue = buildPMORecommendationQueue(dossiers);
    const pmDossiers = buildPMODossierRows(dossiers);
    const executiveSummary = buildPMOExecutiveSummary(
      dossiers,
      pmoStatus,
      capacityOverview,
      performanceOverview,
      recommendationQueue,
      generatedAt,
    );
    const eventTimeline = await buildPMOEventTimeline(workspaceId, dossiers);

    const view: PMOCommandCenterView = {
      workspace_id: workspaceId,
      generated_at: generatedAt,
      executive_summary: executiveSummary,
      pmo_operational_status: pmoStatus,
      pm_counts: pmCounts,
      capacity_overview: capacityOverview,
      performance_overview: performanceOverview,
      evidence_confidence_overview: evidenceConfidenceOverview,
      attention_queues: attentionQueues,
      recommendation_queue: recommendationQueue,
      pm_dossiers: pmDossiers,
      event_timeline: eventTimeline,
      actions: [
        { type: "view_pm_registry", label: "View PM Registry", url: "/pm-registry" },
        { type: "view_pm_capacity", label: "View PM Capacity", url: "/pm-capacity" },
        { type: "view_pm_performance", label: "View PM Performance", url: "/pm-performance" },
      ],
    };

    return { ok: true, data: view };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("pmo_command_center.failed", { workspaceId, error: msg });
    return { ok: false, error: "Failed to build PMO Command Center.", failureClass: "PMO_COMMAND_CENTER_FAILED" };
  }
}
