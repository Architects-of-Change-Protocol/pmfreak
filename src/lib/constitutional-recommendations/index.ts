// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Public API
// EPIC 2 Sprint 4: Sovereign Recommendation Engine
// EPIC 2 Sprint 5: Recommendation Effectiveness Engine
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

// ─── Sprint 5: Effectiveness Engine ──────────────────────────────────────────

export {
  recordRecommendationOutcome,
  calculateRecommendationEffectiveness,
  adjustRecommendationConfidence,
  getRecommendationEffectiveness,
  listRecommendationOutcomes,
  deprecateRecommendation,
} from "./outcome-registry";

export {
  submitRecommendationFeedback,
  listRecommendationFeedback,
} from "./feedback-registry";

export {
  benchmarkRecommendationsForWorkspace,
  rankRecommendationsForWorkspace,
} from "./benchmark-registry";

export { explainRecommendationEffectiveness } from "./effectiveness-explain-capability";
export type { RecommendationEffectivenessExplanation } from "./effectiveness-explain-capability";

export { calculateEffectivenessScore, computeOutcomeEffectivenessScore } from "./effectiveness-engine";
export { adaptRecommendationConfidence } from "./adaptation-engine";
export { benchmarkRecommendations } from "./benchmark-engine";
export { rankRecommendations } from "./ranking-engine";

export type {
  RecommendationResult,
  ConstitutionalRecommendationRow,
  ConstitutionalRecommendationEvidenceRow,
  ConstitutionalRecommendationApplicationRow,
  ConstitutionalRecommendationOutcomeRow,
  ConstitutionalRecommendationFeedbackRow,
  ConstitutionalRecommendationEffectivenessRow,
  RecommendationType,
  RecommendationScope,
  RecommendationStatus,
  RecommendationApplicationEntityType,
  RecommendationApplicationStatus,
  RecommendationOutcomeType,
  RecommendationOutcomeStatus,
  RecommendationFeedbackType,
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
  RecordOutcomeInput,
  SubmitFeedbackInput,
  CalculateEffectivenessInput,
  ListOutcomesInput,
  ListFeedbackInput,
  RecommendationEffectivenessBreakdown,
  RecommendationBenchmark,
  RecommendationRankEntry,
  RecommendationLineageWithOutcome,
  RecommendationJustificationWithEffectiveness,
} from "./types";
