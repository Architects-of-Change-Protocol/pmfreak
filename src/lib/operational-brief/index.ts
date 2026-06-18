// ─────────────────────────────────────────────────────────────────────────────
// Operational Brief Foundation — Public API
// ─────────────────────────────────────────────────────────────────────────────

export type {
  OperationalFactType,
  OperationalFact,
  OperationalBriefSectionType,
  OperationalBriefSection,
  OperationalTimelineHighlight,
  OperationalEvidenceSummary,
  OperationalBriefCoverageMetrics,
  OperationalBriefHealth,
  OperationalBrief,
  OperationalBriefExport,
  OperationalBriefSectionReason,
  OperationalBriefExplanation,
  OperationalBriefResult,
  OperationalBriefEventType,
} from "./types";

export { ALL_OPERATIONAL_SECTION_TYPES } from "./types";

export {
  buildOperationalSummary,
  buildExecutionOverview,
  buildTaskOverview,
  buildMilestoneOverview,
  buildDependencyOverview,
  buildRiskOverview,
  buildBlockerOverview,
  buildEscalationOverview,
  buildCoordinationOverview,
  buildDeliveryOverview,
  buildOperationalTimelineHighlights,
  buildOperationalEvidenceSummary,
  buildOperationalSections,
} from "./operational-brief-sections";

export {
  buildOperationalBrief,
  explainOperationalBrief,
  getOperationalBriefHealth,
} from "./operational-brief-builder";

export { exportOperationalBrief } from "./operational-brief-export";
