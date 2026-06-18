// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Dashboard Foundation — Public API
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ConstitutionalDashboardType,
  ConstitutionalWidgetType,
  ConstitutionalWidget,
  DashboardBriefReference,
  DashboardTimelineEntry,
  DashboardEvidenceSummary,
  DashboardCoverageMetrics,
  DashboardHealth,
  ConstitutionalDashboard,
  DashboardInputBrief,
  ConstitutionalDashboardExport,
  DashboardWidgetReason,
  ConstitutionalDashboardExplanation,
  DashboardResult,
  ConstitutionalDashboardEventType,
} from "./types";

export { ALL_DASHBOARD_TYPES, ALL_WIDGET_TYPES } from "./types";

export {
  buildExecutiveBriefWidget,
  buildGovernanceBriefWidget,
  buildOperationalBriefWidget,
  buildPortfolioBriefWidget,
  buildEvidenceSummaryWidget,
  buildTimelineWidget,
  buildContradictionsWidget,
  buildUnknownsWidget,
  buildKnowledgeDomainsWidget,
  extractTimelineFromExecutiveBrief,
  extractTimelineFromGovernanceBrief,
  extractTimelineFromOperationalBrief,
  extractTimelineFromPortfolioBrief,
} from "./dashboard-widgets";

export {
  buildDashboardTimelineSummary,
  buildDashboardEvidenceSummary,
  buildExecutiveDashboard,
  buildGovernanceDashboard,
  buildOperationalDashboard,
  buildPortfolioDashboard,
  buildWorkspaceDashboard,
  buildMixedDashboard,
  buildConstitutionalDashboard,
  explainConstitutionalDashboard,
  getDashboardHealth,
} from "./dashboard-builder";

export { exportConstitutionalDashboard } from "./dashboard-export";
