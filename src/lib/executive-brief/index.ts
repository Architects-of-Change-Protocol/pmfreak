// ─────────────────────────────────────────────────────────────────────────────
// Executive Brief Foundation — Public API
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ExecutiveBriefSectionType,
  ExecutiveFactType,
  ExecutiveFact,
  ExecutiveBriefSection,
  ExecutiveEvidenceSummary,
  ExecutiveTimelineHighlight,
  ExecutiveBriefCoverageMetrics,
  ExecutiveBriefHealth,
  ExecutiveBrief,
  ExecutiveBriefExport,
  ExecutiveBriefSectionReason,
  ExecutiveBriefExplanation,
  ExecutiveBriefResult,
  ExecutiveBriefEventType,
} from "./types";

export { ALL_EXECUTIVE_SECTION_TYPES } from "./types";

export {
  buildExecutiveSummary,
  buildKeyFacts,
  buildTimelineHighlights,
  buildEvidenceSummary,
  buildExecutiveSections,
} from "./executive-brief-sections";

export {
  buildExecutiveBrief,
  explainExecutiveBrief,
  getExecutiveBriefHealth,
} from "./executive-brief-builder";

export { exportExecutiveBrief } from "./executive-brief-export";
