// ─── PM Detail Intelligence — PM Operating Dossier Service ───────────────────
//
// Aggregates PM identity, profile, assignments, capacity, performance,
// evidence confidence, project breakdown, recommendations, and event timeline
// into a single unified read model.
//
// This module reads from existing domain services. It does not recalculate
// capacity or performance, and does not mutate any records.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProjectManager, getProjectManagerProfile, listProjectManagerProjects } from "@/lib/pm-registry";
import { listPMCapacitySnapshots } from "@/lib/pm-capacity";
import { listPMPerformanceSnapshots } from "@/lib/pm-performance";
import { PLATFORM_EVENT_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { PMAssignmentRow, PMProfileRow, ProjectManagerRow } from "@/lib/pm-registry";
import type { PMCapacitySnapshotRow } from "@/lib/pm-capacity";
import type { PMPerformanceSnapshotRow } from "@/lib/pm-performance";
import type { PlatformEventRow } from "@/lib/platform-events/types";

import type {
  GetPMOperatingDossierInput,
  PMDetailIntelligenceResult,
  PMOperatingDossier,
  PMDossierIdentity,
  PMDossierProfile,
  PMDossierAssignments,
  PMDossierAssignmentRow,
  PMExecutiveSummary,
  PMDossierCapacity,
  PMDossierPerformance,
  PMDossierEvidence,
  PMProjectBreakdownRow,
  PMDossierRecommendation,
  PMDossierRecommendationSeverity,
  PMEventTimelineItem,
  PMDossierAction,
  PMOperationalStatus,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CAPACITY_COUNTED_TYPES = new Set(["primary", "secondary", "program"]);

const PM_TIMELINE_EVENT_TYPES = [
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

const SEVERITY_ORDER: PMDossierRecommendationSeverity[] = ["critical", "high", "medium", "low"];

// ─── Identity builder ─────────────────────────────────────────────────────────

function buildPMIdentity(pm: ProjectManagerRow): PMDossierIdentity {
  return {
    pm_id: pm.id,
    workspace_id: pm.workspace_id,
    display_name: pm.display_name,
    email: pm.email,
    status: pm.status,
    joined_at: (pm as Record<string, unknown>).joined_at as string | null ?? null,
    created_at: pm.created_at,
    updated_at: pm.updated_at,
  };
}

// ─── Profile builder ──────────────────────────────────────────────────────────

function buildPMProfile(profile: PMProfileRow | null): PMDossierProfile {
  if (!profile) {
    return { present: false, message: "No PM profile has been configured yet." };
  }
  return {
    present: true,
    role: profile.role,
    experience_level: profile.experience_level,
    capacity_limit: profile.capacity_limit,
    active_projects_limit: profile.active_projects_limit,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  };
}

// ─── Assignment grouping ──────────────────────────────────────────────────────

function buildPMAssignments(rows: PMAssignmentRow[]): PMDossierAssignments {
  const mapped: PMDossierAssignmentRow[] = rows.map((a) => ({
    assignment_id: a.id,
    project_id: a.project_id,
    project_name: null,
    project_status: null,
    assignment_type: a.assignment_type,
    assigned_at: a.assigned_at,
    removed_at: a.removed_at ?? null,
    capacity_counted: CAPACITY_COUNTED_TYPES.has(a.assignment_type),
  }));

  const active = mapped.filter((a) => a.removed_at === null);
  const historical = mapped.filter((a) => a.removed_at !== null);

  const activeByType = {
    primary:   active.filter((a) => a.assignment_type === "primary"),
    secondary: active.filter((a) => a.assignment_type === "secondary"),
    program:   active.filter((a) => a.assignment_type === "program"),
    observer:  active.filter((a) => a.assignment_type === "observer"),
  };

  return {
    active,
    historical,
    by_type: activeByType,
    counts: {
      active_total:     active.length,
      historical_total: historical.length,
      primary:          activeByType.primary.length,
      secondary:        activeByType.secondary.length,
      program:          activeByType.program.length,
      observer:         activeByType.observer.length,
    },
  };
}

// ─── Capacity section builder ─────────────────────────────────────────────────

function buildPMCapacitySection(snapshot: PMCapacitySnapshotRow | null): PMDossierCapacity {
  if (!snapshot) {
    return { present: false, message: "No capacity snapshot has been generated for this Project Manager yet." };
  }

  const payload = snapshot.snapshot_payload as Record<string, unknown>;
  const ac = payload?.assignment_capacity as Record<string, unknown> | null | undefined;

  const capacityStatus = (ac?.assignment_capacity_status as string | undefined) ?? snapshot.capacity_status;
  const overloadRisk = (ac?.assignment_overload_risk as string | undefined) ?? snapshot.burn_risk;
  const activeProjectsLimit = (ac?.active_projects_limit as number | undefined) ?? (payload?.active_projects_limit as number | undefined) ?? null;
  const activeAssignmentCount = (ac?.active_assignment_count as number | undefined) ?? null;
  const countedAssignmentCount = (ac?.counted_assignment_count as number | undefined) ?? null;
  const observerAssignmentCount = (ac?.observer_assignment_count as number | undefined) ?? null;
  const capacityUtilization = (ac?.assignment_capacity_utilization as number | undefined) ?? null;
  const assignmentBreakdown = (ac?.assignment_breakdown as Record<string, number> | undefined) ?? null;
  const recommendations = (ac?.recommendations as Array<{ type: string; severity: string; message: string }> | undefined) ?? [];

  return {
    present: true,
    snapshot_id: snapshot.id,
    generated_at: snapshot.generated_at,
    capacity_status: capacityStatus,
    overload_risk: overloadRisk,
    active_projects_limit: activeProjectsLimit,
    active_assignment_count: activeAssignmentCount,
    counted_assignment_count: countedAssignmentCount,
    observer_assignment_count: observerAssignmentCount,
    capacity_utilization: capacityUtilization,
    assignment_breakdown: assignmentBreakdown,
    recommendations,
    source: "pm_capacity",
  };
}

// ─── Performance section builder ──────────────────────────────────────────────

function buildPMPerformanceSection(snapshot: PMPerformanceSnapshotRow | null): PMDossierPerformance {
  if (!snapshot) {
    return { present: false, message: "No performance snapshot has been generated for this Project Manager yet." };
  }

  const payload = snapshot.snapshot_payload as Record<string, unknown>;
  const performanceRisk = (payload?.performance_risk as string | undefined) ?? null;
  const assignedProjectCount = (payload?.assigned_project_count as number | undefined) ?? null;
  const activeProjectCount = (payload?.active_project_count as number | undefined) ?? null;
  const capacityContext = (payload?.capacity_context as Record<string, unknown> | undefined) ?? null;

  return {
    present: true,
    snapshot_id: snapshot.id,
    generated_at: snapshot.generated_at,
    overall_performance_score: Number(snapshot.overall_score),
    performance_status: snapshot.performance_status,
    performance_risk: performanceRisk,
    assigned_project_count: assignedProjectCount,
    active_project_count: activeProjectCount,
    governance_score: Number(snapshot.governance_score),
    execution_score: Number(snapshot.execution_score),
    prediction_score: Number(snapshot.prediction_accuracy_score),
    decision_score: Number(snapshot.decision_effectiveness_score),
    portfolio_score: Number(snapshot.portfolio_health_score),
    capacity_context: capacityContext,
    recommendations: [],
    source: "pm_performance",
  };
}

// ─── Evidence confidence builder ──────────────────────────────────────────────

function buildPMEvidenceConfidenceSection(snapshot: PMPerformanceSnapshotRow | null): PMDossierEvidence {
  if (!snapshot) {
    return { present: false, message: "Evidence confidence is not available yet." };
  }

  const payload = snapshot.snapshot_payload as Record<string, unknown>;
  const ec = payload?.evidence_confidence as Record<string, unknown> | undefined;

  if (!ec) {
    return { present: false, message: "Evidence confidence is not available yet." };
  }

  const confidenceLevel = (ec.confidence_level as string) ?? "very_low";
  const evidenceCompleteness = (ec.evidence_completeness as number) ?? 0;
  const availableSourceCount = (ec.available_source_count as number) ?? 0;
  const missingSourceCount = (ec.missing_source_count as number) ?? 0;
  const totalSourceCount = (ec.total_source_count as number) ?? 5;
  const availableSources = (ec.available_sources as string[]) ?? [];
  const missingSources = (ec.missing_sources as string[]) ?? [];
  const neutralBaselineDomains = (ec.neutral_baseline_domains as string[]) ?? [];
  const scoreInterpretation = (ec.score_interpretation as string) ?? "low_confidence_provisional";
  const missingSourcePolicy = (ec.missing_source_policy as string) ?? null;

  const isLowConfidence = confidenceLevel === "low" || confidenceLevel === "very_low";

  const result: PMDossierEvidence & { present: true } = {
    present: true,
    evidence_completeness: evidenceCompleteness,
    confidence_level: confidenceLevel,
    available_source_count: availableSourceCount,
    missing_source_count: missingSourceCount,
    total_source_count: totalSourceCount,
    available_sources: availableSources,
    missing_sources: missingSources,
    neutral_baseline_domains: neutralBaselineDomains,
    score_interpretation: scoreInterpretation,
    missing_source_policy: missingSourcePolicy,
    confidence_recommendations: [],
  };

  if (isLowConfidence) {
    result.warning = "Performance score is provisional due to limited evidence.";
  }

  return result;
}

// ─── Project breakdown builder ────────────────────────────────────────────────

function buildPMPortfolioBreakdown(assignments: PMAssignmentRow[]): PMProjectBreakdownRow[] {
  return assignments.map((a) => ({
    project_id: a.project_id,
    project_name: null,
    project_status: null,
    assignment_type: a.assignment_type,
    assigned_at: a.assigned_at,
    removed_at: a.removed_at ?? null,
    active: a.removed_at === null,
    capacity_counted: CAPACITY_COUNTED_TYPES.has(a.assignment_type),
    latest_health_status: "not_available",
    performance_contribution: "not_enough_data",
    evidence_status: "not_enough_data",
  }));
}

// ─── Recommendation consolidation ─────────────────────────────────────────────

function buildPMRecommendations(
  capacitySection: PMDossierCapacity,
  performanceSection: PMDossierPerformance,
  evidenceSection: PMDossierEvidence,
  operationalStatus: PMOperationalStatus,
): PMDossierRecommendation[] {
  const raw: PMDossierRecommendation[] = [];

  if (capacitySection.present) {
    for (const r of capacitySection.recommendations) {
      raw.push({
        type: r.type,
        severity: r.severity as PMDossierRecommendationSeverity,
        message: r.message,
        source: "pm_capacity",
      });
    }
  }

  if (evidenceSection.present) {
    for (const r of evidenceSection.confidence_recommendations) {
      raw.push({
        type: (r as Record<string, string>).type ?? "evidence_confidence",
        severity: (r as Record<string, string>).severity as PMDossierRecommendationSeverity ?? "medium",
        message: (r as Record<string, string>).message ?? "",
        source: "evidence_confidence",
      });
    }

    if (evidenceSection.confidence_level === "very_low") {
      raw.push({
        type: "insufficient_performance_evidence",
        severity: "high",
        message: "PM performance score is highly provisional due to limited evidence. Improve data coverage before using this score for executive action.",
        source: "evidence_confidence",
      });
    } else if (evidenceSection.confidence_level === "low") {
      raw.push({
        type: "increase_evidence_coverage",
        severity: "medium",
        message: "PM performance score has limited evidence coverage. Generate or connect more execution, decision and project evidence before making major decisions.",
        source: "evidence_confidence",
      });
    }
  }

  if (operationalStatus === "critical") {
    raw.push({
      type: "critical_pm_intervention_required",
      severity: "critical",
      message: "This PM requires immediate PMO review. Critical capacity or performance conditions are present.",
      source: "pm_detail_intelligence",
    });
  } else if (operationalStatus === "capacity_risk") {
    raw.push({
      type: "monitor_workload",
      severity: "high",
      message: "Monitor workload before assigning additional ownership.",
      source: "pm_detail_intelligence",
    });
  } else if (operationalStatus === "performance_risk") {
    raw.push({
      type: "performance_intervention",
      severity: "high",
      message: "PM performance requires attention. PMO review recommended.",
      source: "pm_detail_intelligence",
    });
  } else if (operationalStatus === "watch") {
    raw.push({
      type: "monitor_pm_status",
      severity: "medium",
      message: "Monitor PM status before assigning new projects.",
      source: "pm_detail_intelligence",
    });
  }

  const deduped = deduplicateRecommendations(raw);
  const sorted = sortRecommendationsBySeverity(deduped);

  if (sorted.length === 0) {
    return [{
      type: "no_action_required",
      severity: "low",
      message: "No immediate PMO action is required based on the latest available evidence.",
      source: "pm_detail_intelligence",
    }];
  }

  return sorted;
}

function deduplicateRecommendations(recs: PMDossierRecommendation[]): PMDossierRecommendation[] {
  const seen = new Set<string>();
  return recs.filter((r) => {
    const key = `${r.type}::${r.message}::${r.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortRecommendationsBySeverity(recs: PMDossierRecommendation[]): PMDossierRecommendation[] {
  return [...recs].sort((a, b) => {
    return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  });
}

// ─── Operational status derivation ───────────────────────────────────────────

function derivePMOperationalStatus(
  capacitySection: PMDossierCapacity,
  performanceSection: PMDossierPerformance,
  evidenceSection: PMDossierEvidence,
): PMOperationalStatus {
  const capStatus = capacitySection.present ? capacitySection.capacity_status : null;
  const overloadRisk = capacitySection.present ? capacitySection.overload_risk : null;
  const perfStatus = performanceSection.present ? performanceSection.performance_status : null;
  const perfRisk = performanceSection.present ? performanceSection.performance_risk : null;
  const confLevel = evidenceSection.present ? evidenceSection.confidence_level : null;
  const scoreInterp = evidenceSection.present ? evidenceSection.score_interpretation : null;

  // critical
  if (
    capStatus === "overloaded" ||
    capStatus === "critical" ||
    perfStatus === "critical" ||
    perfRisk === "critical"
  ) {
    return "critical";
  }

  // performance_risk
  if (perfStatus === "warning" || perfRisk === "high") {
    return "performance_risk";
  }

  // capacity_risk
  if (
    capStatus === "near_capacity" ||
    capStatus === "at_capacity" ||
    capStatus === "busy" ||
    overloadRisk === "high"
  ) {
    return "capacity_risk";
  }

  // insufficient_evidence
  if (
    confLevel === "low" ||
    confLevel === "very_low" ||
    scoreInterp === "low_confidence_provisional"
  ) {
    return "insufficient_evidence";
  }

  // watch
  if (
    perfStatus === "stable" ||
    perfRisk === "medium" ||
    capStatus === "near_capacity" ||
    confLevel === "medium"
  ) {
    return "watch";
  }

  // healthy
  return "healthy";
}

// ─── Executive summary builder ────────────────────────────────────────────────

function buildPMExecutiveSummary(
  pm: ProjectManagerRow,
  profile: PMDossierProfile,
  assignments: PMDossierAssignments,
  capacitySection: PMDossierCapacity,
  performanceSection: PMDossierPerformance,
  evidenceSection: PMDossierEvidence,
  operationalStatus: PMOperationalStatus,
  recommendations: PMDossierRecommendation[],
): PMExecutiveSummary {
  const countedActive = assignments.active.filter((a) => a.capacity_counted).length;

  return {
    pm_name: pm.display_name,
    pm_status: pm.status,
    role: profile.present ? profile.role : null,
    experience_level: profile.present ? profile.experience_level : null,
    active_assignment_count: assignments.counts.active_total,
    counted_assignment_count: countedActive,
    capacity_status: capacitySection.present ? capacitySection.capacity_status : null,
    overload_risk: capacitySection.present ? capacitySection.overload_risk : null,
    performance_status: performanceSection.present ? performanceSection.performance_status : null,
    performance_risk: performanceSection.present ? performanceSection.performance_risk : null,
    evidence_confidence_level: evidenceSection.present ? evidenceSection.confidence_level : null,
    evidence_completeness: evidenceSection.present ? evidenceSection.evidence_completeness : null,
    operational_status: operationalStatus,
    top_recommendation: recommendations[0]?.message ?? null,
    last_capacity_generated_at: capacitySection.present ? capacitySection.generated_at : null,
    last_performance_generated_at: performanceSection.present ? performanceSection.generated_at : null,
  };
}

// ─── Event timeline builder ───────────────────────────────────────────────────

function buildEventSummary(event: PlatformEventRow): string {
  const p = event.event_payload as Record<string, unknown>;
  switch (event.event_type) {
    case "PROJECT_MANAGER_REGISTERED":
      return "Project Manager registered in the workspace.";
    case "PROJECT_MANAGER_UPDATED":
      return "Project Manager profile was updated.";
    case "PROJECT_MANAGER_PROFILE_UPDATED":
      return "PM governance profile was updated.";
    case "PROJECT_MANAGER_ASSIGNED": {
      const projectId = p.project_id as string | undefined;
      const assignmentType = p.assignment_type as string | undefined;
      return `Assigned as ${assignmentType ?? "PM"} to project${projectId ? ` ${projectId}` : ""}.`;
    }
    case "PROJECT_MANAGER_UNASSIGNED":
      return "PM assignment was removed and preserved as history.";
    case "PM_CAPACITY_SNAPSHOT_GENERATED": {
      const counted = p.counted_assignment_count as number | undefined;
      const limit = p.active_projects_limit as number | undefined;
      const status = p.assignment_capacity_status as string | undefined ?? p.capacity_status as string | undefined;
      const parts: string[] = ["Capacity snapshot generated."];
      if (counted !== undefined && limit !== undefined) {
        parts.push(`Counted assignments: ${counted} / ${limit}.`);
      }
      if (status) parts.push(`Status: ${status}.`);
      return parts.join(" ");
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
      return "Workspace-wide performance snapshots generated.";
    default:
      return `${event.event_type.replace(/_/g, " ").toLowerCase()} event recorded.`;
  }
}

function buildPMAuditTimeline(events: PlatformEventRow[]): PMEventTimelineItem[] {
  return events.map((e) => {
    const payload = e.event_payload as Record<string, unknown>;
    const excerpt: Record<string, unknown> = {};
    const safeKeys = ["pm_id", "project_id", "assignment_type", "capacity_status", "performance_status", "performance_risk", "snapshot_id"];
    for (const k of safeKeys) {
      if (payload[k] !== undefined) excerpt[k] = payload[k];
    }

    return {
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      actor_user_id: e.actor_id,
      source: e.source,
      summary: buildEventSummary(e),
      payload_excerpt: excerpt,
    };
  });
}

// ─── PM event query helper ────────────────────────────────────────────────────

async function fetchPMEvents(workspaceId: string, pmId: string, limit = 20): Promise<PlatformEventRow[]> {
  const supabase = await createSupabaseServerClient();
  const cols = PLATFORM_EVENT_SELECTABLE_COLUMNS.join(",");

  const { data, error } = await supabase
    .from("platform_events")
    .select(cols)
    .eq("workspace_id", workspaceId)
    .in("event_type", PM_TIMELINE_EVENT_TYPES)
    .contains("event_payload", { pm_id: pmId })
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("pm_detail_intelligence.event_timeline.failed", { workspaceId, pmId, error: error.message });
    return [];
  }

  return (data as unknown as PlatformEventRow[]) ?? [];
}

// ─── Actions builder ──────────────────────────────────────────────────────────

function buildPMActions(pmId: string): PMDossierAction[] {
  return [
    {
      type: "generate_capacity_snapshot",
      label: "Generate Capacity Snapshot",
      api_endpoint: `/api/pm-capacity/${pmId}/snapshot`,
      method: "POST",
    },
    {
      type: "generate_performance_snapshot",
      label: "Generate Performance Snapshot",
      api_endpoint: `/api/pm-performance/${pmId}/snapshot`,
      method: "POST",
    },
    {
      type: "refresh_dossier",
      label: "Refresh Dossier",
      api_endpoint: `/api/pm-registry/${pmId}/intelligence`,
      method: "GET",
    },
    {
      type: "edit_pm_profile",
      label: "Edit PM Profile",
      href: `/pm-registry/${pmId}/profile`,
    },
    {
      type: "assign_project",
      label: "Assign Project",
      href: `/pm-registry/${pmId}/assignments`,
    },
    {
      type: "view_pm_capacity",
      label: "View PM Capacity",
      href: `/pm-capacity/${pmId}`,
    },
    {
      type: "view_pm_performance",
      label: "View PM Performance",
      href: `/pm-performance/${pmId}`,
    },
  ];
}

// ─── Main service function ────────────────────────────────────────────────────

export async function getPMOperatingDossier(
  input: GetPMOperatingDossierInput,
): Promise<PMDetailIntelligenceResult<PMOperatingDossier>> {
  const { workspaceId, pmId } = input;

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PM_DETAIL_WORKSPACE_REQUIRED" };
  }
  if (!pmId?.trim()) {
    return { ok: false, error: "pmId is required.", failureClass: "PM_DETAIL_PM_NOT_FOUND" };
  }

  // 1. Fetch PM, profile, assignments in parallel
  const [pmResult, profileResult, assignmentResult] = await Promise.all([
    getProjectManager(pmId, workspaceId),
    getProjectManagerProfile({ workspaceId, pmId }),
    listProjectManagerProjects({ workspaceId, pmId, includeRemoved: true }),
  ]);

  if (!pmResult.ok) {
    if (pmResult.failureClass === "not_found") {
      return { ok: false, error: "Project Manager not found.", failureClass: "PM_DETAIL_PM_NOT_FOUND" };
    }
    return { ok: false, error: "Failed to load Project Manager.", failureClass: "PM_DETAIL_DOSSIER_FAILED" };
  }

  const pm = pmResult.data;

  // Cross-workspace guard
  if (pm.workspace_id !== workspaceId) {
    return { ok: false, error: "Access denied.", failureClass: "PM_DETAIL_CROSS_WORKSPACE_ACCESS" };
  }

  const profileRow = profileResult.ok ? profileResult.data : null;
  const assignmentRows = assignmentResult.ok ? assignmentResult.data : [];

  // 2. Fetch capacity and performance snapshots in parallel
  const [capacityResult, performanceResult] = await Promise.all([
    listPMCapacitySnapshots({ workspaceId, pmId, limit: 1 }),
    listPMPerformanceSnapshots({ workspaceId, pmId, limit: 1 }),
  ]);

  const latestCapacitySnapshot = (capacityResult.ok && capacityResult.data.length > 0)
    ? capacityResult.data[0]
    : null;

  const latestPerformanceSnapshot = (performanceResult.ok && performanceResult.data.length > 0)
    ? performanceResult.data[0]
    : null;

  // 3. Build sections
  const profile = buildPMProfile(profileRow);
  const assignments = buildPMAssignments(assignmentRows);
  const capacitySection = buildPMCapacitySection(latestCapacitySnapshot);
  const performanceSection = buildPMPerformanceSection(latestPerformanceSnapshot);
  const evidenceSection = buildPMEvidenceConfidenceSection(latestPerformanceSnapshot);
  const projectBreakdown = buildPMPortfolioBreakdown(assignmentRows);
  const operationalStatus = derivePMOperationalStatus(capacitySection, performanceSection, evidenceSection);
  const recommendations = buildPMRecommendations(capacitySection, performanceSection, evidenceSection, operationalStatus);
  const executiveSummary = buildPMExecutiveSummary(pm, profile, assignments, capacitySection, performanceSection, evidenceSection, operationalStatus, recommendations);

  // 4. Fetch event timeline
  const eventRows = await fetchPMEvents(workspaceId, pmId, 20);
  const eventTimeline = buildPMAuditTimeline(eventRows);

  // 5. Build actions
  const actions = buildPMActions(pmId);

  const dossier: PMOperatingDossier = {
    pm: buildPMIdentity(pm),
    profile,
    executive_summary: executiveSummary,
    assignments,
    capacity: capacitySection,
    performance: performanceSection,
    evidence_confidence: evidenceSection,
    project_breakdown: projectBreakdown,
    recommendations,
    event_timeline: eventTimeline,
    actions,
    generated_at: new Date().toISOString(),
  };

  return { ok: true, data: dossier };
}
