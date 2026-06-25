// ─── PMO Executive Reporting & Alerts ────────────────────────────────────────
//
// Generates executive-facing PMO reports and alert payloads by aggregating
// existing read models. Read-only with respect to PM / governance /
// intervention state. Does not recalculate capacity or performance, does not
// mutate intervention statuses, does not send external notifications, and does
// not generate PDFs.
// ─────────────────────────────────────────────────────────────────────────────

import { getPMOCommandCenter } from "@/lib/pmo-command-center";
import { generatePMOGovernanceComplianceSnapshot } from "@/lib/pmo-governance-compliance";
import { createPlatformEvent } from "@/lib/platform-events/create-event";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PMO_EXECUTIVE_REPORT_SELECTABLE_COLUMNS,
  PMO_ALERT_PAYLOAD_SELECTABLE_COLUMNS,
  PMO_INTERVENTION_ACTION_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  PMOExecutiveReportRow,
  PMOAlertPayloadRow,
  PMOInterventionActionRow,
} from "@/lib/db/database-contract";
import type { PMOCommandCenterView } from "@/lib/pmo-command-center";
import type { PMOGovernanceComplianceSnapshot } from "@/lib/pmo-governance-compliance";

import {
  INTERVENTION_STALE_DAYS,
  EXECUTIVE_STATUS_ORDER,
  EXECUTIVE_RISK_ORDER,
  ALERT_SEVERITY_ORDER,
} from "./types";
import type {
  AlertSeverity,
  AlertType,
  ExecutiveRisk,
  ExecutiveStatus,
  ExecutiveReportKeyMetrics,
  ExecutiveReportSection,
  ExecutiveReportSummary,
  GeneratePMOAlertPayloadsParams,
  GeneratePMOAlertPayloadsResult,
  GeneratePMOExecutiveReportParams,
  GetPMOExecutiveReportParams,
  ListPMOAlertPayloadsParams,
  ListPMOExecutiveReportsParams,
  MarkPMOAlertPayloadReviewedParams,
  PMOAlertDraft,
  PMOAlertPayload,
  PMOExecutiveReport,
  PMOExecutiveReportingResult,
  ReportType,
} from "./types";

// ─── Column selection ─────────────────────────────────────────────────────────

const REPORT_COLUMNS = PMO_EXECUTIVE_REPORT_SELECTABLE_COLUMNS.join(",");
const ALERT_COLUMNS = PMO_ALERT_PAYLOAD_SELECTABLE_COLUMNS.join(",");
const INTERVENTION_COLUMNS = PMO_INTERVENTION_ACTION_SELECTABLE_COLUMNS.join(",");

const OPEN_INTERVENTION_STATUSES = ["proposed", "approved", "in_progress"];
const OPEN_ALERT_STATUSES = ["new"];

// ─── Row → domain mappers ─────────────────────────────────────────────────────

function rowToReport(row: PMOExecutiveReportRow): PMOExecutiveReport {
  const payload = (row.report_payload ?? {}) as Record<string, unknown>;
  const alerts = Array.isArray(payload.alerts) ? (payload.alerts as PMOAlertDraft[]) : [];
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    reportType: row.report_type as ReportType,
    reportPeriodStart: row.report_period_start,
    reportPeriodEnd: row.report_period_end,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    executiveStatus: row.executive_status as ExecutiveStatus,
    executiveRisk: row.executive_risk as ExecutiveRisk,
    reportTitle: row.report_title,
    executiveSummary: (row.executive_summary as ExecutiveReportSummary | null) ?? null,
    keyMetrics: (row.key_metrics as ExecutiveReportKeyMetrics | null) ?? null,
    sections: Array.isArray(row.sections) ? (row.sections as ExecutiveReportSection[]) : [],
    sourceRefs: row.source_refs,
    reportPayload: row.report_payload,
    alerts,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAlert(row: PMOAlertPayloadRow): PMOAlertPayload {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    alertType: row.alert_type as AlertType,
    severity: row.severity as AlertSeverity,
    status: row.status as PMOAlertPayload["status"],
    title: row.title,
    message: row.message,
    targetType: (row.target_type as PMOAlertPayload["targetType"]) ?? null,
    targetId: row.target_id,
    pmId: row.pm_id,
    projectId: row.project_id,
    sourceType: (row.source_type as PMOAlertPayload["sourceType"]) ?? null,
    sourceId: row.source_id,
    sourceRef: row.source_ref,
    payload: row.payload,
    recommendedAction: row.recommended_action,
    createdBy: row.created_by,
    createdAt: row.created_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
  };
}

// ─── Report titles ────────────────────────────────────────────────────────────

const REPORT_TITLES: Record<ReportType, string> = {
  daily_pmo_brief: "Daily PMO Brief",
  weekly_pmo_review: "Weekly PMO Review",
  executive_risk_summary: "Executive Risk Summary",
  governance_compliance_report: "Governance Compliance Report",
  intervention_status_report: "Intervention Status Report",
  board_ready_summary: "Board-Ready PMO Summary",
};

// ─── Intervention rollup (pure) ───────────────────────────────────────────────

export interface InterventionRollup {
  open: number;
  pending_approval: number;
  critical_pending_approval: number;
  high_pending_approval: number;
  in_progress: number;
  stale_in_progress: number;
  critical_pending: PMOInterventionActionRow[];
  high_pending: PMOInterventionActionRow[];
  stale: PMOInterventionActionRow[];
}

export function buildInterventionRollup(
  rows: PMOInterventionActionRow[],
  nowIso: string,
  staleDays = INTERVENTION_STALE_DAYS,
): InterventionRollup {
  const nowMs = new Date(nowIso).getTime();
  const staleMs = staleDays * 24 * 60 * 60 * 1000;

  const open = rows.filter((r) => OPEN_INTERVENTION_STATUSES.includes(r.status));
  const pendingApproval = open.filter(
    (r) => r.status === "proposed" && r.approval_status === "pending",
  );
  const criticalPending = pendingApproval.filter((r) => r.priority === "critical");
  const highPending = pendingApproval.filter((r) => r.priority === "high");
  const inProgress = rows.filter((r) => r.status === "in_progress");
  const stale = inProgress.filter((r) => {
    const updated = new Date(r.updated_at).getTime();
    return Number.isFinite(updated) && nowMs - updated >= staleMs;
  });

  return {
    open: open.length,
    pending_approval: pendingApproval.length,
    critical_pending_approval: criticalPending.length,
    high_pending_approval: highPending.length,
    in_progress: inProgress.length,
    stale_in_progress: stale.length,
    critical_pending: criticalPending,
    high_pending: highPending,
    stale,
  };
}

// ─── Executive status derivation (pure) ───────────────────────────────────────
//
// critical > attention_required > watch > healthy

export function deriveExecutiveStatus(
  view: PMOCommandCenterView | null,
  snapshot: PMOGovernanceComplianceSnapshot | null,
  rollup: InterventionRollup,
): ExecutiveStatus {
  const candidates: ExecutiveStatus[] = ["healthy"];

  const pmoStatus = view?.pmo_operational_status ?? null;
  if (pmoStatus === "critical") candidates.push("critical");
  else if (pmoStatus === "performance_pressure" || pmoStatus === "capacity_pressure") {
    candidates.push("attention_required");
  } else if (pmoStatus === "evidence_gap" || pmoStatus === "watch") {
    candidates.push("watch");
  }

  const compliance = snapshot?.compliance_status ?? null;
  if (compliance === "critical") candidates.push("critical");
  else if (compliance === "non_compliant") candidates.push("attention_required");
  else if (compliance === "watch") candidates.push("watch");

  if ((snapshot?.summary.critical_violations ?? 0) > 0) candidates.push("critical");
  else if ((snapshot?.summary.high_violations ?? 0) > 0) candidates.push("attention_required");

  if (rollup.critical_pending_approval > 0) candidates.push("attention_required");
  if (rollup.stale_in_progress > 0) candidates.push("attention_required");

  return pickHighest(candidates, EXECUTIVE_STATUS_ORDER);
}

// ─── Executive risk derivation (pure) ─────────────────────────────────────────
//
// critical > high > medium > low

export function deriveExecutiveRisk(
  view: PMOCommandCenterView | null,
  snapshot: PMOGovernanceComplianceSnapshot | null,
  rollup: InterventionRollup,
): ExecutiveRisk {
  const candidates: ExecutiveRisk[] = ["low"];

  const complianceRisk = snapshot?.compliance_risk ?? null;
  if (complianceRisk) candidates.push(complianceRisk as ExecutiveRisk);

  const pmoStatus = view?.pmo_operational_status ?? null;
  if (pmoStatus === "critical") candidates.push("critical");
  else if (pmoStatus === "performance_pressure" || pmoStatus === "capacity_pressure") {
    candidates.push("high");
  } else if (pmoStatus === "evidence_gap" || pmoStatus === "watch") {
    candidates.push("medium");
  }

  if ((snapshot?.summary.critical_violations ?? 0) > 0) candidates.push("critical");
  else if ((snapshot?.summary.high_violations ?? 0) > 0) candidates.push("high");

  if (rollup.critical_pending_approval > 0) candidates.push("high");
  else if (rollup.high_pending_approval > 0 || rollup.stale_in_progress > 0) {
    candidates.push("medium");
  }

  return pickHighest(candidates, EXECUTIVE_RISK_ORDER);
}

function pickHighest<T>(candidates: T[], order: T[]): T {
  let best = order[order.length - 1];
  let bestRank = order.length - 1;
  for (const c of candidates) {
    const rank = order.indexOf(c);
    if (rank >= 0 && rank < bestRank) {
      bestRank = rank;
      best = c;
    }
  }
  return best;
}

// ─── Key metrics (pure) ───────────────────────────────────────────────────────

export function buildKeyMetrics(
  view: PMOCommandCenterView | null,
  snapshot: PMOGovernanceComplianceSnapshot | null,
  rollup: InterventionRollup,
  alerts: PMOAlertDraft[],
): ExecutiveReportKeyMetrics {
  const es = view?.executive_summary ?? null;
  const cap = view?.capacity_overview ?? null;
  const perf = view?.performance_overview ?? null;
  const ev = view?.evidence_confidence_overview ?? null;

  return {
    total_pms: es?.total_pms ?? 0,
    active_pms: es?.active_pms ?? 0,
    critical_pms: es?.critical_pms ?? 0,
    pmo_operational_status: view?.pmo_operational_status ?? "healthy",
    average_capacity_utilization: cap?.average_capacity_utilization ?? null,
    overloaded_pms: cap?.overloaded_count ?? 0,
    pms_missing_capacity_snapshot: cap?.pms_missing_capacity_snapshot ?? 0,
    average_performance_score: perf?.average_performance_score ?? null,
    warning_pms: perf?.warning_count ?? 0,
    critical_performance_pms: perf?.critical_count ?? 0,
    pms_missing_performance_snapshot: perf?.pms_missing_performance_snapshot ?? 0,
    low_evidence_confidence_pms:
      (ev?.low_confidence_count ?? 0) + (ev?.very_low_confidence_count ?? 0),
    compliance_score: snapshot?.compliance_score ?? null,
    compliance_status: snapshot?.compliance_status ?? null,
    compliance_risk: snapshot?.compliance_risk ?? null,
    total_governance_violations: snapshot?.summary.total_violations ?? 0,
    critical_governance_violations: snapshot?.summary.critical_violations ?? 0,
    high_governance_violations: snapshot?.summary.high_violations ?? 0,
    open_interventions: rollup.open,
    pending_approval_interventions: rollup.pending_approval,
    critical_pending_approvals: rollup.critical_pending_approval,
    high_pending_approvals: rollup.high_pending_approval,
    in_progress_interventions: rollup.in_progress,
    stale_in_progress_interventions: rollup.stale_in_progress,
    total_alerts: alerts.length,
    critical_alerts: alerts.filter((a) => a.severity === "critical").length,
    high_alerts: alerts.filter((a) => a.severity === "high").length,
  };
}

// ─── Executive summary (pure) ─────────────────────────────────────────────────

export function buildExecutiveSummary(
  status: ExecutiveStatus,
  risk: ExecutiveRisk,
  metrics: ExecutiveReportKeyMetrics,
  view: PMOCommandCenterView | null,
  snapshot: PMOGovernanceComplianceSnapshot | null,
): ExecutiveReportSummary {
  const headline =
    status === "critical"
      ? "PMO is in a critical state requiring immediate executive intervention."
      : status === "attention_required"
        ? "PMO requires leadership attention on one or more governance or operational fronts."
        : status === "watch"
          ? "PMO is stable but with items on watch."
          : "PMO is healthy across operational and governance dimensions.";

  const statusSummary = `Operational status: ${metrics.pmo_operational_status}. ${metrics.total_pms} PM(s) tracked, ${metrics.critical_pms} in critical state.`;

  const riskSummary = `Executive risk assessed as ${risk}. ${metrics.overloaded_pms} overloaded PM(s); ${metrics.critical_performance_pms} with critical performance.`;

  const governanceSummary = snapshot
    ? `Compliance ${snapshot.compliance_status} (${snapshot.compliance_score}/100), risk ${snapshot.compliance_risk}. ${metrics.total_governance_violations} violation(s): ${metrics.critical_governance_violations} critical, ${metrics.high_governance_violations} high.`
    : "Governance compliance snapshot unavailable.";

  const interventionSummary = `${metrics.open_interventions} open intervention(s); ${metrics.pending_approval_interventions} pending approval (${metrics.critical_pending_approvals} critical, ${metrics.high_pending_approvals} high); ${metrics.stale_in_progress_interventions} stale in-progress.`;

  const evidenceSummary = `${metrics.low_evidence_confidence_pms} PM(s) with low evidence confidence; ${metrics.pms_missing_capacity_snapshot} missing capacity snapshot; ${metrics.pms_missing_performance_snapshot} missing performance snapshot.`;

  const leadership: string[] = [];
  if (metrics.critical_pms > 0) {
    leadership.push(`${metrics.critical_pms} PM(s) in critical state — immediate review.`);
  }
  if (metrics.critical_governance_violations > 0) {
    leadership.push(`${metrics.critical_governance_violations} critical governance violation(s).`);
  }
  if (metrics.critical_pending_approvals > 0) {
    leadership.push(`${metrics.critical_pending_approvals} critical intervention(s) awaiting approval.`);
  }
  if (metrics.stale_in_progress_interventions > 0) {
    leadership.push(`${metrics.stale_in_progress_interventions} intervention(s) stale (no progress in ${INTERVENTION_STALE_DAYS}+ days).`);
  }
  const topRec = view?.executive_summary.top_recommendation ?? null;
  if (topRec) leadership.push(`Top recommendation: ${topRec}`);

  return {
    headline,
    status_summary: statusSummary,
    risk_summary: riskSummary,
    governance_summary: governanceSummary,
    intervention_summary: interventionSummary,
    evidence_summary: evidenceSummary,
    leadership_attention: leadership,
  };
}

// ─── Report sections (pure) ───────────────────────────────────────────────────

function statusFromBoolean(critical: boolean, attention: boolean): ExecutiveStatus | "informational" {
  if (critical) return "critical";
  if (attention) return "attention_required";
  return "informational";
}

export function buildReportSections(
  view: PMOCommandCenterView | null,
  snapshot: PMOGovernanceComplianceSnapshot | null,
  rollup: InterventionRollup,
  metrics: ExecutiveReportKeyMetrics,
  alerts: PMOAlertDraft[],
): ExecutiveReportSection[] {
  const sections: ExecutiveReportSection[] = [];

  // 1. PMO Operating Status
  sections.push({
    key: "pmo_operating_status",
    title: "PMO Operating Status",
    status: statusFromBoolean(
      metrics.pmo_operational_status === "critical",
      metrics.pmo_operational_status === "performance_pressure" ||
        metrics.pmo_operational_status === "capacity_pressure",
    ),
    summary: view
      ? `Operational status ${metrics.pmo_operational_status} across ${metrics.total_pms} PM(s).`
      : "PMO Command Center data unavailable.",
    highlights: [
      `${metrics.critical_pms} critical PM(s)`,
      `${metrics.overloaded_pms} overloaded PM(s)`,
      `Avg utilization: ${metrics.average_capacity_utilization ?? "n/a"}`,
    ],
    metrics: {
      total_pms: metrics.total_pms,
      active_pms: metrics.active_pms,
      critical_pms: metrics.critical_pms,
      overloaded_pms: metrics.overloaded_pms,
      operational_status: metrics.pmo_operational_status,
    },
  });

  // 2. Governance Compliance
  sections.push({
    key: "governance_compliance",
    title: "Governance Compliance",
    status: statusFromBoolean(
      metrics.critical_governance_violations > 0 || snapshot?.compliance_status === "critical",
      metrics.high_governance_violations > 0 || snapshot?.compliance_status === "non_compliant",
    ),
    summary: snapshot
      ? `Compliance ${snapshot.compliance_status} at ${snapshot.compliance_score}/100 (risk ${snapshot.compliance_risk}).`
      : "Governance compliance snapshot unavailable.",
    highlights: [
      `${metrics.total_governance_violations} total violation(s)`,
      `${metrics.critical_governance_violations} critical`,
      `${metrics.high_governance_violations} high`,
    ],
    metrics: {
      compliance_score: metrics.compliance_score,
      compliance_status: metrics.compliance_status,
      compliance_risk: metrics.compliance_risk,
      total_violations: metrics.total_governance_violations,
      critical_violations: metrics.critical_governance_violations,
      high_violations: metrics.high_governance_violations,
    },
  });

  // 3. Intervention Action Loop
  sections.push({
    key: "intervention_action_loop",
    title: "Intervention Action Loop",
    status: statusFromBoolean(
      rollup.critical_pending_approval > 0,
      rollup.high_pending_approval > 0 || rollup.stale_in_progress > 0,
    ),
    summary: `${metrics.open_interventions} open intervention(s); ${metrics.pending_approval_interventions} awaiting approval.`,
    highlights: [
      `${metrics.critical_pending_approvals} critical pending approval`,
      `${metrics.high_pending_approvals} high pending approval`,
      `${metrics.stale_in_progress_interventions} stale in-progress`,
    ],
    metrics: {
      open: metrics.open_interventions,
      pending_approval: metrics.pending_approval_interventions,
      critical_pending_approvals: metrics.critical_pending_approvals,
      high_pending_approvals: metrics.high_pending_approvals,
      in_progress: metrics.in_progress_interventions,
      stale_in_progress: metrics.stale_in_progress_interventions,
    },
  });

  // 4. Executive Attention Queue
  const attentionCount =
    (view?.attention_queues.critical_attention.length ?? 0) +
    rollup.critical_pending_approval +
    metrics.critical_governance_violations;
  sections.push({
    key: "executive_attention_queue",
    title: "Executive Attention Queue",
    status: statusFromBoolean(attentionCount > 0, metrics.high_alerts > 0),
    summary: `${attentionCount} item(s) flagged for executive attention.`,
    highlights: (view?.attention_queues.critical_attention ?? [])
      .slice(0, 5)
      .map((i) => `${i.display_name}: ${i.operational_status}`),
    metrics: {
      critical_attention: view?.attention_queues.critical_attention.length ?? 0,
      critical_pending_approvals: rollup.critical_pending_approval,
      critical_violations: metrics.critical_governance_violations,
    },
  });

  // 5. Evidence & Confidence
  sections.push({
    key: "evidence_and_confidence",
    title: "Evidence & Confidence",
    status: statusFromBoolean(
      false,
      metrics.low_evidence_confidence_pms > 0 ||
        metrics.pms_missing_capacity_snapshot > 0 ||
        metrics.pms_missing_performance_snapshot > 0,
    ),
    summary: `${metrics.low_evidence_confidence_pms} PM(s) with low evidence confidence.`,
    highlights: [
      `${metrics.pms_missing_capacity_snapshot} missing capacity snapshot`,
      `${metrics.pms_missing_performance_snapshot} missing performance snapshot`,
    ],
    metrics: {
      low_evidence_confidence_pms: metrics.low_evidence_confidence_pms,
      missing_capacity_snapshot: metrics.pms_missing_capacity_snapshot,
      missing_performance_snapshot: metrics.pms_missing_performance_snapshot,
    },
  });

  // 6. Recommended Next Actions
  const recommendations: string[] = [];
  if (metrics.critical_pending_approvals > 0) {
    recommendations.push("Review and approve critical pending interventions.");
  }
  if (metrics.critical_governance_violations > 0) {
    recommendations.push("Resolve critical governance violations.");
  }
  if (metrics.pms_missing_capacity_snapshot > 0) {
    recommendations.push("Generate missing capacity snapshots.");
  }
  if (metrics.pms_missing_performance_snapshot > 0) {
    recommendations.push("Generate missing performance snapshots.");
  }
  if (metrics.stale_in_progress_interventions > 0) {
    recommendations.push("Follow up on stale in-progress interventions.");
  }
  if (recommendations.length === 0) {
    recommendations.push("No critical actions required. Maintain governance cadence.");
  }
  sections.push({
    key: "recommended_next_actions",
    title: "Recommended Next Actions",
    status: "informational",
    summary: `${recommendations.length} recommended next action(s).`,
    highlights: recommendations,
    metrics: { recommended_actions: recommendations.length, alerts: alerts.length },
  });

  return sections;
}

// ─── Alert draft generation (pure) ────────────────────────────────────────────

export function buildAlertDrafts(
  view: PMOCommandCenterView | null,
  snapshot: PMOGovernanceComplianceSnapshot | null,
  rollup: InterventionRollup,
): PMOAlertDraft[] {
  const drafts: PMOAlertDraft[] = [];

  // ── PMO Command Center–derived alerts ───────────────────────────────────────
  if (view) {
    const pmoStatus = view.pmo_operational_status;
    if (pmoStatus === "critical") {
      drafts.push({
        alertType: "pmo_status_critical",
        severity: "critical",
        title: "PMO operational status is critical",
        message: `One or more PMs are in a critical state. ${view.executive_summary.critical_pms} critical PM(s).`,
        targetType: "workspace",
        targetId: view.workspace_id,
        pmId: null,
        projectId: null,
        sourceType: "pmo_command_center",
        sourceId: view.workspace_id,
        sourceRef: { pmo_operational_status: pmoStatus },
        payload: { critical_pms: view.executive_summary.critical_pms },
        recommendedAction: "Review critical PMs in the PMO Command Center.",
      });
    }

    if (pmoStatus === "capacity_pressure" || view.capacity_overview.overloaded_count > 0) {
      drafts.push({
        alertType: "pmo_capacity_pressure",
        severity: "high",
        title: "PMO capacity pressure detected",
        message: `${view.capacity_overview.overloaded_count} PM(s) overloaded; avg utilization ${view.capacity_overview.average_capacity_utilization ?? "n/a"}.`,
        targetType: "workspace",
        targetId: view.workspace_id,
        pmId: null,
        projectId: null,
        sourceType: "pmo_command_center",
        sourceId: view.workspace_id,
        sourceRef: { overloaded_count: view.capacity_overview.overloaded_count },
        payload: { overloaded_count: view.capacity_overview.overloaded_count },
        recommendedAction: "Rebalance assignments before adding new work.",
      });
    }

    if (pmoStatus === "performance_pressure" || view.performance_overview.critical_count > 0) {
      drafts.push({
        alertType: "pmo_performance_pressure",
        severity: "high",
        title: "PMO performance pressure detected",
        message: `${view.performance_overview.critical_count} PM(s) with critical performance; ${view.performance_overview.warning_count} with warnings.`,
        targetType: "workspace",
        targetId: view.workspace_id,
        pmId: null,
        projectId: null,
        sourceType: "pmo_command_center",
        sourceId: view.workspace_id,
        sourceRef: { critical_count: view.performance_overview.critical_count },
        payload: { critical_count: view.performance_overview.critical_count },
        recommendedAction: "Schedule performance reviews for at-risk PMs.",
      });
    }

    // Evidence / snapshot gaps
    if (
      view.evidence_confidence_overview.low_confidence_count +
        view.evidence_confidence_overview.very_low_confidence_count >
      0
    ) {
      drafts.push({
        alertType: "evidence_confidence_low",
        severity: "medium",
        title: "Low evidence confidence",
        message: `${view.evidence_confidence_overview.low_confidence_count + view.evidence_confidence_overview.very_low_confidence_count} PM(s) have low evidence confidence.`,
        targetType: "workspace",
        targetId: view.workspace_id,
        pmId: null,
        projectId: null,
        sourceType: "pmo_command_center",
        sourceId: view.workspace_id,
        sourceRef: null,
        payload: null,
        recommendedAction: "Expand data coverage to improve confidence.",
      });
    }

    if (view.capacity_overview.pms_missing_capacity_snapshot > 0) {
      drafts.push({
        alertType: "missing_capacity_snapshot",
        severity: "medium",
        title: "Missing capacity snapshots",
        message: `${view.capacity_overview.pms_missing_capacity_snapshot} PM(s) are missing a capacity snapshot.`,
        targetType: "workspace",
        targetId: view.workspace_id,
        pmId: null,
        projectId: null,
        sourceType: "pmo_command_center",
        sourceId: view.workspace_id,
        sourceRef: null,
        payload: { missing: view.capacity_overview.pms_missing_capacity_snapshot },
        recommendedAction: "Generate capacity snapshots for the affected PMs.",
      });
    }

    if (view.performance_overview.pms_missing_performance_snapshot > 0) {
      drafts.push({
        alertType: "missing_performance_snapshot",
        severity: "medium",
        title: "Missing performance snapshots",
        message: `${view.performance_overview.pms_missing_performance_snapshot} PM(s) are missing a performance snapshot.`,
        targetType: "workspace",
        targetId: view.workspace_id,
        pmId: null,
        projectId: null,
        sourceType: "pmo_command_center",
        sourceId: view.workspace_id,
        sourceRef: null,
        payload: { missing: view.performance_overview.pms_missing_performance_snapshot },
        recommendedAction: "Generate performance snapshots for the affected PMs.",
      });
    }
  }

  // ── Governance compliance–derived alerts ────────────────────────────────────
  if (snapshot) {
    if (snapshot.compliance_status === "critical" || snapshot.compliance_risk === "critical") {
      drafts.push({
        alertType: "governance_compliance_critical",
        severity: "critical",
        title: "Governance compliance is critical",
        message: `Compliance ${snapshot.compliance_status} at ${snapshot.compliance_score}/100 (risk ${snapshot.compliance_risk}).`,
        targetType: "workspace",
        targetId: snapshot.workspace_id,
        pmId: null,
        projectId: null,
        sourceType: "pmo_governance_compliance",
        sourceId: snapshot.snapshot_id,
        sourceRef: { compliance_status: snapshot.compliance_status },
        payload: { compliance_score: snapshot.compliance_score },
        recommendedAction: "Address critical governance gaps immediately.",
      });
    }

    for (const v of snapshot.violations) {
      if (v.severity === "critical") {
        drafts.push({
          alertType: "governance_violation_critical",
          severity: "critical",
          title: `Critical governance violation: ${v.violation_type}`,
          message: v.message,
          targetType: v.pm_id ? "pm" : v.project_id ? "project" : "workspace",
          targetId: v.pm_id ?? v.project_id ?? snapshot.workspace_id,
          pmId: v.pm_id ?? null,
          projectId: v.project_id ?? null,
          sourceType: "pmo_governance_compliance",
          sourceId: v.violation_id,
          sourceRef: { violation_type: v.violation_type, domain: v.domain },
          payload: null,
          recommendedAction: v.recommendation,
        });
      } else if (v.severity === "high") {
        drafts.push({
          alertType: "governance_violation_high",
          severity: "high",
          title: `High governance violation: ${v.violation_type}`,
          message: v.message,
          targetType: v.pm_id ? "pm" : v.project_id ? "project" : "workspace",
          targetId: v.pm_id ?? v.project_id ?? snapshot.workspace_id,
          pmId: v.pm_id ?? null,
          projectId: v.project_id ?? null,
          sourceType: "pmo_governance_compliance",
          sourceId: v.violation_id,
          sourceRef: { violation_type: v.violation_type, domain: v.domain },
          payload: null,
          recommendedAction: v.recommendation,
        });
      }
    }
  }

  // ── Intervention–derived alerts ─────────────────────────────────────────────
  for (const r of rollup.critical_pending) {
    drafts.push({
      alertType: "intervention_critical_pending_approval",
      severity: "critical",
      title: "Critical intervention pending approval",
      message: r.action_title,
      targetType: (r.target_type as PMOAlertDraft["targetType"]) ?? "workspace",
      targetId: r.target_id ?? r.workspace_id,
      pmId: r.pm_id,
      projectId: r.project_id,
      sourceType: "pmo_intervention",
      sourceId: r.id,
      sourceRef: { action_type: r.action_type, priority: r.priority },
      payload: null,
      recommendedAction: "Review and approve or reject this intervention.",
    });
  }

  for (const r of rollup.high_pending) {
    drafts.push({
      alertType: "intervention_high_pending_approval",
      severity: "high",
      title: "High-priority intervention pending approval",
      message: r.action_title,
      targetType: (r.target_type as PMOAlertDraft["targetType"]) ?? "workspace",
      targetId: r.target_id ?? r.workspace_id,
      pmId: r.pm_id,
      projectId: r.project_id,
      sourceType: "pmo_intervention",
      sourceId: r.id,
      sourceRef: { action_type: r.action_type, priority: r.priority },
      payload: null,
      recommendedAction: "Review and approve or reject this intervention.",
    });
  }

  for (const r of rollup.stale) {
    drafts.push({
      alertType: "intervention_in_progress_stale",
      severity: "medium",
      title: "Intervention stale in progress",
      message: `${r.action_title} has had no progress in ${INTERVENTION_STALE_DAYS}+ days.`,
      targetType: (r.target_type as PMOAlertDraft["targetType"]) ?? "workspace",
      targetId: r.target_id ?? r.workspace_id,
      pmId: r.pm_id,
      projectId: r.project_id,
      sourceType: "pmo_intervention",
      sourceId: r.id,
      sourceRef: { action_type: r.action_type, status: r.status },
      payload: null,
      recommendedAction: "Follow up on this in-progress intervention.",
    });
  }

  return drafts;
}

// ─── Severity filter (pure) ───────────────────────────────────────────────────

export function filterBySeverityThreshold(
  drafts: PMOAlertDraft[],
  threshold?: AlertSeverity,
): PMOAlertDraft[] {
  if (!threshold) return drafts;
  const maxRank = ALERT_SEVERITY_ORDER.indexOf(threshold);
  return drafts.filter((d) => ALERT_SEVERITY_ORDER.indexOf(d.severity) <= maxRank);
}

// ─── Dedup key (pure) ─────────────────────────────────────────────────────────

export function alertDedupKey(
  workspaceId: string,
  d: Pick<PMOAlertDraft, "alertType" | "severity" | "targetType" | "targetId" | "sourceType" | "sourceId">,
): string {
  return [
    workspaceId,
    d.alertType,
    d.severity,
    d.targetType ?? "",
    d.targetId ?? "",
    d.sourceType ?? "",
    d.sourceId ?? "",
  ].join("|");
}

// ─── Shared source gathering ──────────────────────────────────────────────────

async function gatherSources(
  workspaceId: string,
  actorId: string | null,
  nowIso: string,
): Promise<{
  view: PMOCommandCenterView | null;
  snapshot: PMOGovernanceComplianceSnapshot | null;
  interventions: PMOInterventionActionRow[];
  rollup: InterventionRollup;
}> {
  let view: PMOCommandCenterView | null = null;
  try {
    const viewResult = await getPMOCommandCenter({ workspaceId, actorId: actorId ?? undefined });
    if (viewResult.ok) view = viewResult.data;
  } catch {
    view = null;
  }

  let snapshot: PMOGovernanceComplianceSnapshot | null = null;
  try {
    const snapshotResult = await generatePMOGovernanceComplianceSnapshot({
      workspaceId,
      actorId: actorId ?? undefined,
      generatedAt: nowIso,
    });
    if (snapshotResult.ok) snapshot = snapshotResult.data;
  } catch {
    snapshot = null;
  }

  let interventions: PMOInterventionActionRow[] = [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("pmo_intervention_actions")
      .select(INTERVENTION_COLUMNS)
      .eq("workspace_id", workspaceId)
      .returns<PMOInterventionActionRow[]>();
    interventions = data ?? [];
  } catch {
    interventions = [];
  }

  const rollup = buildInterventionRollup(interventions, nowIso);
  return { view, snapshot, interventions, rollup };
}

// ─── generatePMOExecutiveReport ───────────────────────────────────────────────

export async function generatePMOExecutiveReport(
  params: GeneratePMOExecutiveReportParams,
): Promise<PMOExecutiveReportingResult<PMOExecutiveReport>> {
  const { workspaceId } = params;
  const actorId = params.actorId ?? null;
  const reportType: ReportType = params.reportType ?? "daily_pmo_brief";
  const generatedAt = params.generatedAt ?? new Date().toISOString();

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_EXECUTIVE_REPORTING_WORKSPACE_REQUIRED" };
  }

  try {
    const { view, snapshot, rollup } = await gatherSources(workspaceId, actorId, generatedAt);

    const alertDrafts = buildAlertDrafts(view, snapshot, rollup);
    const executiveStatus = deriveExecutiveStatus(view, snapshot, rollup);
    const executiveRisk = deriveExecutiveRisk(view, snapshot, rollup);
    const keyMetrics = buildKeyMetrics(view, snapshot, rollup, alertDrafts);
    const executiveSummary = buildExecutiveSummary(executiveStatus, executiveRisk, keyMetrics, view, snapshot);
    const sections = buildReportSections(view, snapshot, rollup, keyMetrics, alertDrafts);
    const reportTitle = REPORT_TITLES[reportType];

    const sourceRefs = {
      pmo_command_center: Boolean(view),
      governance_compliance_snapshot_id: snapshot?.snapshot_id ?? null,
      intervention_actions_evaluated: rollup.open + rollup.in_progress,
    };

    const reportPayload = {
      executive_status: executiveStatus,
      executive_risk: executiveRisk,
      executive_summary: executiveSummary,
      key_metrics: keyMetrics,
      sections,
      alerts: alertDrafts,
      source_refs: sourceRefs,
    };

    const supabase = await createSupabaseServerClient();
    const { data: insertedRow, error: insertErr } = await supabase
      .from("pmo_executive_reports")
      .insert({
        workspace_id: workspaceId,
        report_type: reportType,
        report_period_start: params.periodStart ?? null,
        report_period_end: params.periodEnd ?? null,
        generated_at: generatedAt,
        generated_by: actorId,
        executive_status: executiveStatus,
        executive_risk: executiveRisk,
        report_title: reportTitle,
        executive_summary: executiveSummary,
        key_metrics: keyMetrics,
        sections,
        source_refs: sourceRefs,
        report_payload: reportPayload,
      })
      .select(REPORT_COLUMNS)
      .single<PMOExecutiveReportRow>();

    if (insertErr || !insertedRow) {
      console.error("pmo_executive_reports.insert.failed", { workspaceId, error: insertErr?.message });
      return { ok: false, error: "Failed to persist executive report.", failureClass: "PMO_EXECUTIVE_REPORTING_PERSISTENCE_FAILED" };
    }

    const report = rowToReport(insertedRow);

    createPlatformEvent({
      workspaceId,
      actorId,
      actorType: actorId ? "user" : "system",
      eventType: "PMO_EXECUTIVE_REPORT_GENERATED",
      eventCategory: "governance",
      source: actorId ? "user_action" : "system",
      visibility: "workspace",
      sensitivityLevel: "internal",
      learningEligible: false,
      correlationId: report.id,
      eventPayload: {
        workspace_id: workspaceId,
        report_id: report.id,
        report_type: reportType,
        executive_status: executiveStatus,
        executive_risk: executiveRisk,
        alert_count: alertDrafts.length,
        generated_at: generatedAt,
      },
    }).catch(() => undefined);

    return { ok: true, data: report };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("pmo_executive_reporting.generate.failed", { workspaceId, error: msg });
    return { ok: false, error: "Failed to generate executive report.", failureClass: "PMO_EXECUTIVE_REPORTING_GENERATION_FAILED" };
  }
}

// ─── listPMOExecutiveReports ──────────────────────────────────────────────────

export async function listPMOExecutiveReports(
  params: ListPMOExecutiveReportsParams,
): Promise<PMOExecutiveReportingResult<PMOExecutiveReport[]>> {
  const { workspaceId, reportType, limit } = params;

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_EXECUTIVE_REPORTING_WORKSPACE_REQUIRED" };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pmo_executive_reports")
    .select(REPORT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("generated_at", { ascending: false });

  if (reportType) query = query.eq("report_type", reportType);
  if (limit && limit > 0) query = query.limit(limit);

  const { data, error } = await query.returns<PMOExecutiveReportRow[]>();

  if (error) {
    console.error("pmo_executive_reports.list.failed", { workspaceId, error: error.message });
    return { ok: false, error: "Failed to list executive reports.", failureClass: "PMO_EXECUTIVE_REPORTING_LIST_FAILED" };
  }

  return { ok: true, data: (data ?? []).map(rowToReport) };
}

// ─── getPMOExecutiveReport ────────────────────────────────────────────────────

export async function getPMOExecutiveReport(
  params: GetPMOExecutiveReportParams,
): Promise<PMOExecutiveReportingResult<PMOExecutiveReport>> {
  const { workspaceId, reportId } = params;

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_EXECUTIVE_REPORTING_WORKSPACE_REQUIRED" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pmo_executive_reports")
    .select(REPORT_COLUMNS)
    .eq("id", reportId)
    .eq("workspace_id", workspaceId)
    .single<PMOExecutiveReportRow>();

  if (error || !data) {
    return { ok: false, error: "Executive report not found.", failureClass: "PMO_EXECUTIVE_REPORTING_REPORT_NOT_FOUND" };
  }

  return { ok: true, data: rowToReport(data) };
}

// ─── generatePMOAlertPayloads ─────────────────────────────────────────────────

export async function generatePMOAlertPayloads(
  params: GeneratePMOAlertPayloadsParams,
): Promise<PMOExecutiveReportingResult<GeneratePMOAlertPayloadsResult>> {
  const { workspaceId } = params;
  const actorId = params.actorId ?? null;
  const generatedAt = params.generatedAt ?? new Date().toISOString();

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_EXECUTIVE_REPORTING_WORKSPACE_REQUIRED" };
  }

  try {
    const { view, snapshot, rollup } = await gatherSources(workspaceId, actorId, generatedAt);

    let drafts = buildAlertDrafts(view, snapshot, rollup);
    drafts = filterBySeverityThreshold(drafts, params.severityThreshold);

    const supabase = await createSupabaseServerClient();

    // Load existing open (new) alerts to build dedup index.
    const { data: existingRows } = await supabase
      .from("pmo_alert_payloads")
      .select(ALERT_COLUMNS)
      .eq("workspace_id", workspaceId)
      .in("status", OPEN_ALERT_STATUSES)
      .returns<PMOAlertPayloadRow[]>();

    const existing = existingRows ?? [];
    const openKeys = new Set<string>();
    for (const row of existing) {
      openKeys.add(
        alertDedupKey(workspaceId, {
          alertType: row.alert_type as AlertType,
          severity: row.severity as AlertSeverity,
          targetType: (row.target_type as PMOAlertDraft["targetType"]) ?? null,
          targetId: row.target_id,
          sourceType: (row.source_type as PMOAlertDraft["sourceType"]) ?? null,
          sourceId: row.source_id,
        }),
      );
    }

    const created: PMOAlertPayload[] = [];
    let skipped = 0;

    for (const draft of drafts) {
      const key = alertDedupKey(workspaceId, draft);
      if (openKeys.has(key)) {
        skipped += 1;
        continue;
      }

      const { data: insertedRow, error: insertErr } = await supabase
        .from("pmo_alert_payloads")
        .insert({
          workspace_id: workspaceId,
          alert_type: draft.alertType,
          severity: draft.severity,
          status: "new",
          title: draft.title,
          message: draft.message,
          target_type: draft.targetType,
          target_id: draft.targetId,
          pm_id: draft.pmId,
          project_id: draft.projectId,
          source_type: draft.sourceType,
          source_id: draft.sourceId,
          source_ref: draft.sourceRef,
          payload: draft.payload,
          recommended_action: draft.recommendedAction,
          created_by: actorId,
        })
        .select(ALERT_COLUMNS)
        .single<PMOAlertPayloadRow>();

      if (insertErr || !insertedRow) {
        console.error("pmo_alert_payloads.insert.failed", { workspaceId, alertType: draft.alertType, error: insertErr?.message });
        continue;
      }

      openKeys.add(key);
      const alert = rowToAlert(insertedRow);
      created.push(alert);

      createPlatformEvent({
        workspaceId,
        actorId,
        actorType: actorId ? "user" : "system",
        eventType: "PMO_ALERT_PAYLOAD_GENERATED",
        eventCategory: "governance",
        source: actorId ? "user_action" : "system",
        visibility: "workspace",
        sensitivityLevel: "internal",
        learningEligible: false,
        correlationId: alert.id,
        eventPayload: {
          workspace_id: workspaceId,
          alert_id: alert.id,
          alert_type: alert.alertType,
          severity: alert.severity,
          source_type: alert.sourceType,
          generated_at: generatedAt,
        },
      }).catch(() => undefined);
    }

    return {
      ok: true,
      data: {
        created_alerts: created,
        skipped_duplicates: skipped,
        existing_open_alerts: existing.length,
        generated_at: generatedAt,
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("pmo_executive_reporting.generate_alerts.failed", { workspaceId, error: msg });
    return { ok: false, error: "Failed to generate alert payloads.", failureClass: "PMO_EXECUTIVE_REPORTING_GENERATION_FAILED" };
  }
}

// ─── listPMOAlertPayloads ─────────────────────────────────────────────────────

export async function listPMOAlertPayloads(
  params: ListPMOAlertPayloadsParams,
): Promise<PMOExecutiveReportingResult<PMOAlertPayload[]>> {
  const { workspaceId, severity, status, limit } = params;

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_EXECUTIVE_REPORTING_WORKSPACE_REQUIRED" };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("pmo_alert_payloads")
    .select(ALERT_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("severity", { ascending: true })
    .order("created_at", { ascending: false });

  if (severity) query = query.eq("severity", severity);
  if (status) query = query.eq("status", status);
  if (limit && limit > 0) query = query.limit(limit);

  const { data, error } = await query.returns<PMOAlertPayloadRow[]>();

  if (error) {
    console.error("pmo_alert_payloads.list.failed", { workspaceId, error: error.message });
    return { ok: false, error: "Failed to list alert payloads.", failureClass: "PMO_EXECUTIVE_REPORTING_LIST_FAILED" };
  }

  return { ok: true, data: (data ?? []).map(rowToAlert) };
}

// ─── markPMOAlertPayloadReviewed ──────────────────────────────────────────────

export async function markPMOAlertPayloadReviewed(
  params: MarkPMOAlertPayloadReviewedParams,
): Promise<PMOExecutiveReportingResult<PMOAlertPayload>> {
  const { workspaceId, alertId, actorId } = params;
  const reviewedAt = params.reviewedAt ?? new Date().toISOString();

  if (!workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "PMO_EXECUTIVE_REPORTING_WORKSPACE_REQUIRED" };
  }
  if (!actorId?.trim()) {
    return { ok: false, error: "actorId is required.", failureClass: "PMO_EXECUTIVE_REPORTING_ACTOR_REQUIRED" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: updated, error: updateErr } = await supabase
    .from("pmo_alert_payloads")
    .update({
      status: "reviewed",
      reviewed_by: actorId,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq("id", alertId)
    .eq("workspace_id", workspaceId)
    .select(ALERT_COLUMNS)
    .single<PMOAlertPayloadRow>();

  if (updateErr || !updated) {
    return { ok: false, error: "Alert not found.", failureClass: "PMO_EXECUTIVE_REPORTING_ALERT_NOT_FOUND" };
  }

  const alert = rowToAlert(updated);

  createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType: "PMO_ALERT_PAYLOAD_REVIEWED",
    eventCategory: "governance",
    source: "user_action",
    visibility: "workspace",
    sensitivityLevel: "internal",
    learningEligible: false,
    correlationId: alert.id,
    eventPayload: {
      workspace_id: workspaceId,
      alert_id: alert.id,
      alert_type: alert.alertType,
      severity: alert.severity,
      reviewed_by: actorId,
      reviewed_at: reviewedAt,
    },
  }).catch(() => undefined);

  return { ok: true, data: alert };
}
