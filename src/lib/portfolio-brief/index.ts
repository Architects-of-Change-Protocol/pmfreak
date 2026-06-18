// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Brief Foundation — Public API
// ─────────────────────────────────────────────────────────────────────────────

export type {
  PortfolioFactType,
  PortfolioFact,
  PortfolioBriefSectionType,
  PortfolioBriefSection,
  PortfolioTimelineHighlight,
  PortfolioEvidenceSummary,
  PortfolioBriefCoverageMetrics,
  PortfolioBriefHealth,
  PortfolioBrief,
  PortfolioBriefExport,
  PortfolioBriefSectionReason,
  PortfolioBriefExplanation,
  PortfolioBriefResult,
  PortfolioBriefEventType,
} from "./types";

export { ALL_PORTFOLIO_SECTION_TYPES } from "./types";

export {
  buildPortfolioSummary,
  buildProjectOverview,
  buildProgramOverview,
  buildWorkstreamOverview,
  buildPortfolioDependencyOverview,
  buildPortfolioRiskOverview,
  buildPortfolioBlockerOverview,
  buildPortfolioEscalationOverview,
  buildCrossProjectOverview,
  buildPortfolioDeliveryOverview,
  buildPortfolioTimelineHighlights,
  buildPortfolioEvidenceSummary,
  buildPortfolioSections,
} from "./portfolio-brief-sections";

export {
  buildPortfolioBrief,
  explainPortfolioBrief,
  getPortfolioBriefHealth,
} from "./portfolio-brief-builder";

export { exportPortfolioBrief } from "./portfolio-brief-export";
