// ─── PMO Executive Reporting & Alerts — Public API ───────────────────────────

export type {
  PMOExecutiveReportRow,
  PMOAlertPayloadRow,
  ExecutiveStatus,
  ExecutiveRisk,
  ReportType,
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertTargetType,
  AlertSourceType,
  ExecutiveReportSection,
  ExecutiveReportSummary,
  ExecutiveReportKeyMetrics,
  PMOAlertPayload,
  PMOAlertDraft,
  PMOExecutiveReport,
  GeneratePMOExecutiveReportParams,
  GeneratePMOAlertPayloadsParams,
  GeneratePMOAlertPayloadsResult,
  ListPMOExecutiveReportsParams,
  GetPMOExecutiveReportParams,
  ListPMOAlertPayloadsParams,
  MarkPMOAlertPayloadReviewedParams,
  PMOExecutiveReportingResult,
  PMOExecutiveReportingEventType,
} from "./types";

export {
  INTERVENTION_STALE_DAYS,
  EXECUTIVE_STATUS_ORDER,
  EXECUTIVE_RISK_ORDER,
  ALERT_SEVERITY_ORDER,
} from "./types";

export {
  generatePMOExecutiveReport,
  listPMOExecutiveReports,
  getPMOExecutiveReport,
  generatePMOAlertPayloads,
  listPMOAlertPayloads,
  markPMOAlertPayloadReviewed,
  // Pure derivation helpers (exported for testing / direct use)
  buildInterventionRollup,
  deriveExecutiveStatus,
  deriveExecutiveRisk,
  buildKeyMetrics,
  buildExecutiveSummary,
  buildReportSections,
  buildAlertDrafts,
  filterBySeverityThreshold,
  alertDedupKey,
} from "./pmo-executive-reporting";

export type { InterventionRollup } from "./pmo-executive-reporting";
