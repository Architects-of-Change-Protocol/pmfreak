// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Brief Foundation — Public API
// ─────────────────────────────────────────────────────────────────────────────

export type {
  BriefSectionType,
  ConstitutionalBrief,
  ConstitutionalBriefSection,
  ConstitutionalBriefEvidenceTraceEntry,
  ConstitutionalBriefUnknown,
  ConstitutionalBriefHealth,
  ConstitutionalBriefCoverageMetrics,
  ConstitutionalBriefExport,
  ConstitutionalBriefExplanation,
  ConstitutionalBriefSectionReason,
  ConstitutionalBriefResult,
  ConstitutionalBriefEventType,
} from "./types";

export { ALL_BRIEF_SECTION_TYPES } from "./types";

export {
  buildBriefSummary,
  buildEvidenceTrace,
  buildConstitutionalBrief,
  explainConstitutionalBrief,
  getConstitutionalBriefHealth,
} from "./brief-builder";

export { buildBriefSections, buildBriefUnknowns } from "./brief-sections";

export { exportConstitutionalBrief } from "./brief-export";
