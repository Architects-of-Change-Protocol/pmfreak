// ─────────────────────────────────────────────────────────────────────────────
// Governance Brief Foundation — Public API
// ─────────────────────────────────────────────────────────────────────────────

export type {
  GovernanceBriefSectionType,
  GovernanceFactType,
  GovernanceAuthorityFact,
  GovernanceBriefSection,
  GovernanceEvidenceSummary,
  GovernanceTimelineHighlight,
  GovernanceBriefCoverageMetrics,
  GovernanceBriefHealth,
  GovernanceBrief,
  GovernanceBriefExport,
  GovernanceBriefSectionReason,
  GovernanceBriefExplanation,
  GovernanceBriefResult,
  GovernanceBriefEventType,
} from "./types";

export { ALL_GOVERNANCE_SECTION_TYPES } from "./types";

export {
  buildGovernanceSummary,
  buildAuthorityOverview,
  buildDelegationOverview,
  buildCapabilityOverview,
  buildTrustOverview,
  buildPolicyOverview,
  buildGovernanceTimelineHighlights,
  buildGovernanceEvidenceSummary,
  buildGovernanceSections,
} from "./governance-brief-sections";

export {
  buildGovernanceBrief,
  explainGovernanceBrief,
  getGovernanceBriefHealth,
} from "./governance-brief-builder";

export { exportGovernanceBrief } from "./governance-brief-export";
