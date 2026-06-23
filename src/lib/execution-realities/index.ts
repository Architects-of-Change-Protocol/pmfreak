// ─────────────────────────────────────────────────────────────────────────────
// Execution Reality Engine — Public API
// ─────────────────────────────────────────────────────────────────────────────

export {
  createExecutionReality,
  recordExecutionObservation,
  validateExecutionReality,
  completeExecutionReality,
  archiveExecutionReality,
  getExecutionReality,
  listExecutionRealities,
  calculateAndPersistVariances,
  detectAndPersistDrifts,
  getProjectionAccuracy,
  getRealityConfidence,
  getExecutionHealth,
  getProjectionFeedback,
  getRecommendationFeedback,
  getRealityLineage,
  explainReality,
} from "./reality-registry";

export { calculateExecutionVariance, calculateVarianceSeverity } from "./variance-engine";
export { detectExecutionDrift } from "./drift-engine";
export { calculateProjectionAccuracy, identifyMainVariance } from "./accuracy-engine";
export { calculateRealityConfidence } from "./confidence-engine";
export { calculateExecutionHealth } from "./health-engine";
export { generateProjectionFeedback, generateRecommendationRealityFeedback } from "./feedback-engine";
export { getExecutionRealityLineage } from "./lineage";
export { explainExecutionReality } from "./explain";

export type {
  ExecutionRealityStatus,
  ExecutionRealityRisk,
  ExecutionVarianceType,
  ExecutionVarianceSeverity,
  ExecutionDriftType,
  ExecutionDriftSeverity,
  ExecutionRealityResult,
  ExecutionRealityEventType,
  CreateRealityInput,
  RecordObservationInput,
  ValidateRealityInput,
  CompleteRealityInput,
  ArchiveRealityInput,
  GetRealityInput,
  ListRealitiesInput,
  RealityWithDetails,
  VarianceResult,
  DriftResult,
  ProjectionAccuracyResult,
  RealityConfidenceResult,
  ExecutionHealthResult,
  ProjectionFeedback,
  RecommendationRealityFeedback,
  RealityLineage,
  RealityExplanation,
} from "./types";
