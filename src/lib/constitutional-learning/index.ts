// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Learning Engine — Public API
// EPIC 2 Sprint 3: Institutional Learning Engine
// ─────────────────────────────────────────────────────────────────────────────

export {
  createLearningPattern,
  getLearningPattern,
  listLearningPatterns,
  aggregateDigestsForLearning,
  discoverLearningPatterns,
  calculatePatternConfidence,
  generateRecommendations,
  discoverCorrelationsForWorkspace,
  getLearningLineage,
} from "./learning-registry";

export { explainInstitutionalLearning } from "./explain-capability";
export type { InstitutionalLearningExplanation } from "./explain-capability";

export type {
  LearningResult,
  LearningPatternType,
  ConstitutionalLearningPatternRow,
  ConstitutionalLearningEvidenceRow,
  ConstitutionalLearningRecommendationRow,
  PatternCorrelation,
  DiscoveryResult,
  LearningConfidenceBreakdown,
  LearningLineage,
  CreateLearningPatternInput,
  AggregateDigestsInput,
  ListLearningPatternsInput,
  GetLearningPatternInput,
  GetLearningLineageInput,
  GenerateRecommendationsInput,
} from "./types";
