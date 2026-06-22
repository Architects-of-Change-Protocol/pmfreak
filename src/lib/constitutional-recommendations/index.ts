// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Public API
// EPIC 2 Sprint 4: Sovereign Recommendation Engine
// ─────────────────────────────────────────────────────────────────────────────

export {
  createRecommendation,
  generateRecommendation,
  generateRecommendationsFromPatterns,
  validateRecommendation,
  publishRecommendation,
  retireRecommendation,
  applyRecommendation,
  getRecommendation,
  listRecommendations,
  calculateRecommendationConfidenceForId,
  getRecommendationJustification,
  getRecommendationLineage,
} from "./recommendation-registry";

export { evaluateRecommendationApplicability } from "./applicability-engine";

export { explainSovereignRecommendations } from "./explain-capability";
export type { SovereignRecommendationExplanation } from "./explain-capability";

export type {
  RecommendationResult,
  ConstitutionalRecommendationRow,
  ConstitutionalRecommendationEvidenceRow,
  ConstitutionalRecommendationApplicationRow,
  RecommendationType,
  RecommendationScope,
  RecommendationStatus,
  RecommendationApplicationEntityType,
  RecommendationApplicationStatus,
  RecommendationConfidenceBreakdown,
  ApplicabilityLevel,
  RecommendationApplicability,
  RecommendationJustification,
  RecommendationLineage,
  CreateRecommendationInput,
  RecommendationIdInput,
  ApplyRecommendationInput,
  ListRecommendationsInput,
  GenerateRecommendationsFromPatternsInput,
  ApplicabilityContext,
} from "./types";
