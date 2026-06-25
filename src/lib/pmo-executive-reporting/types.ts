// ─── PMO Executive Reporting & Alerts — Types ────────────────────────────────
//
// Executive-facing read model. Reports and alert payloads are derived
// deterministically from existing PMO read aggregations:
//   - PMO Command Center view
//   - PMO Operating Discipline (governance compliance) snapshot
//   - PMO Intervention actions
//
// This module is read-only with respect to PM/governance/intervention state.
// It does NOT recalculate capacity or performance, does NOT mutate intervention
// statuses, and does NOT send external notifications or generate PDFs.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PMOExecutiveReportRow,
  PMOAlertPayloadRow,
} from "@/lib/db/database-contract";

export type { PMOExecutiveReportRow, PMOAlertPayloadRow };

// ── Executive status / risk ───────────────────────────────────────────────────

export type ExecutiveStatus =
  | "healthy"
  | "watch"
  | "attention_required"
  | "critical";

export type ExecutiveRisk = "low" | "medium" | "high" | "critical";

// ── Report types ──────────────────────────────────────────────────────────────

export type ReportType =
  | "daily_pmo_brief"
  | "weekly_pmo_review"
  | "executive_risk_summary"
  | "governance_compliance_report"
  | "intervention_status_report"
  | "board_ready_summary";

// ── Alert types ───────────────────────────────────────────────────────────────

export type AlertType =
  | "pmo_status_critical"
  | "pmo_capacity_pressure"
  | "pmo_performance_pressure"
  | "governance_compliance_critical"
  | "governance_violation_critical"
  | "governance_violation_high"
  | "intervention_critical_pending_approval"
  | "intervention_high_pending_approval"
  | "intervention_in_progress_stale"
  | "evidence_confidence_low"
  | "missing_capacity_snapshot"
  | "missing_performance_snapshot"
  | "executive_attention_required";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertStatus = "new" | "reviewed" | "archived";

export type AlertTargetType = "pm" | "project" | "workspace";

export type AlertSourceType =
  | "pmo_command_center"
  | "pmo_governance_compliance"
  | "pmo_intervention"
  | "pmo_executive_reporting";

// ── Report section ────────────────────────────────────────────────────────────

export interface ExecutiveReportSection {
  key: string;
  title: string;
  status: ExecutiveStatus | "informational";
  summary: string;
  highlights: string[];
  metrics: Record<string, number | string | null>;
}

// ── Executive summary block ───────────────────────────────────────────────────

export interface ExecutiveReportSummary {
  headline: string;
  status_summary: string;
  risk_summary: string;
  governance_summary: string;
  intervention_summary: string;
  evidence_summary: string;
  leadership_attention: string[];
}

// ── Key metrics block ─────────────────────────────────────────────────────────

export interface ExecutiveReportKeyMetrics {
  total_pms: number;
  active_pms: number;
  critical_pms: number;
  pmo_operational_status: string;
  average_capacity_utilization: number | null;
  overloaded_pms: number;
  pms_missing_capacity_snapshot: number;
  average_performance_score: number | null;
  warning_pms: number;
  critical_performance_pms: number;
  pms_missing_performance_snapshot: number;
  low_evidence_confidence_pms: number;
  compliance_score: number | null;
  compliance_status: string | null;
  compliance_risk: string | null;
  total_governance_violations: number;
  critical_governance_violations: number;
  high_governance_violations: number;
  open_interventions: number;
  pending_approval_interventions: number;
  critical_pending_approvals: number;
  high_pending_approvals: number;
  in_progress_interventions: number;
  stale_in_progress_interventions: number;
  total_alerts: number;
  critical_alerts: number;
  high_alerts: number;
}

// ── Alert payload (domain) ────────────────────────────────────────────────────

export interface PMOAlertPayload {
  id: string;
  workspaceId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  targetType: AlertTargetType | null;
  targetId: string | null;
  pmId: string | null;
  projectId: string | null;
  sourceType: AlertSourceType | null;
  sourceId: string | null;
  sourceRef: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  recommendedAction: string | null;
  createdBy: string | null;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

// Draft alert produced by the generator before persistence.
export interface PMOAlertDraft {
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  targetType: AlertTargetType | null;
  targetId: string | null;
  pmId: string | null;
  projectId: string | null;
  sourceType: AlertSourceType | null;
  sourceId: string | null;
  sourceRef: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  recommendedAction: string | null;
}

// ── Executive report (domain) ─────────────────────────────────────────────────

export interface PMOExecutiveReport {
  id: string;
  workspaceId: string;
  reportType: ReportType;
  reportPeriodStart: string | null;
  reportPeriodEnd: string | null;
  generatedAt: string;
  generatedBy: string | null;
  executiveStatus: ExecutiveStatus;
  executiveRisk: ExecutiveRisk;
  reportTitle: string | null;
  executiveSummary: ExecutiveReportSummary | null;
  keyMetrics: ExecutiveReportKeyMetrics | null;
  sections: ExecutiveReportSection[];
  sourceRefs: Record<string, unknown> | null;
  reportPayload: Record<string, unknown> | null;
  alerts: PMOAlertDraft[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Service input types ───────────────────────────────────────────────────────

export interface GeneratePMOExecutiveReportParams {
  workspaceId: string;
  actorId?: string | null;
  reportType?: ReportType;
  generatedAt?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface GeneratePMOAlertPayloadsParams {
  workspaceId: string;
  actorId?: string | null;
  generatedAt?: string;
  severityThreshold?: AlertSeverity;
}

export interface ListPMOExecutiveReportsParams {
  workspaceId: string;
  reportType?: ReportType;
  limit?: number;
}

export interface GetPMOExecutiveReportParams {
  workspaceId: string;
  reportId: string;
}

export interface ListPMOAlertPayloadsParams {
  workspaceId: string;
  severity?: AlertSeverity;
  status?: AlertStatus;
  limit?: number;
}

export interface MarkPMOAlertPayloadReviewedParams {
  workspaceId: string;
  alertId: string;
  actorId: string;
  reviewedAt?: string;
}

// ── Generation results ────────────────────────────────────────────────────────

export interface GeneratePMOAlertPayloadsResult {
  created_alerts: PMOAlertPayload[];
  skipped_duplicates: number;
  existing_open_alerts: number;
  generated_at: string;
}

// ── Result type ───────────────────────────────────────────────────────────────

export type PMOExecutiveReportingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ── Event types ───────────────────────────────────────────────────────────────

export type PMOExecutiveReportingEventType =
  | "PMO_EXECUTIVE_REPORT_GENERATED"
  | "PMO_ALERT_PAYLOAD_GENERATED"
  | "PMO_ALERT_PAYLOAD_REVIEWED";

// ── Constants ─────────────────────────────────────────────────────────────────

export const INTERVENTION_STALE_DAYS = 7;

export const EXECUTIVE_STATUS_ORDER: ExecutiveStatus[] = [
  "critical",
  "attention_required",
  "watch",
  "healthy",
];

export const EXECUTIVE_RISK_ORDER: ExecutiveRisk[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export const ALERT_SEVERITY_ORDER: AlertSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];
