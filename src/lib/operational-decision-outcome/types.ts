import type {
  OperationalDecisionOutcomeRow,
  OperationalOutcomeObservationRow,
  OperationalOutcomeEffectRow,
  OperationalLearningFeedbackRow,
  OutcomeStatus,
  RecommendationQuality,
  OutcomeObservationType,
  OutcomeEffectType,
  LearningFeedbackType,
} from "@/lib/db/database-contract";

export type {
  OperationalDecisionOutcomeRow,
  OperationalOutcomeObservationRow,
  OperationalOutcomeEffectRow,
  OperationalLearningFeedbackRow,
  OutcomeStatus,
  RecommendationQuality,
  OutcomeObservationType,
  OutcomeEffectType,
  LearningFeedbackType,
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const OUTCOME_STATUSES: OutcomeStatus[] = [
  "pending",
  "observed",
  "evaluated",
  "successful",
  "partially_successful",
  "unsuccessful",
  "archived",
];

export const RECOMMENDATION_QUALITIES: RecommendationQuality[] = [
  "poor",
  "fair",
  "good",
  "very_good",
  "excellent",
];

export const OUTCOME_OBSERVATION_TYPES: OutcomeObservationType[] = [
  "governance_health",
  "execution_health",
  "risk_reduction",
  "authority_recovery",
  "ratification_speed",
  "commitment_completion",
  "projection_accuracy",
  "recommendation_effectiveness",
];

export const OUTCOME_EFFECT_TYPES: OutcomeEffectType[] = [
  "governance_health",
  "execution_health",
  "risk_reduction",
  "authority_recovery",
  "ratification_speed",
  "commitment_completion",
  "projection_accuracy",
  "recommendation_effectiveness",
];

export const LEARNING_FEEDBACK_TYPES: LearningFeedbackType[] = [
  "decision_pattern",
  "effectiveness_signal",
  "quality_signal",
  "risk_insight",
  "governance_insight",
  "recommendation_calibration",
];

// ─── Effectiveness Level ──────────────────────────────────────────────────────

export type EffectivenessLevel = "very_low" | "low" | "medium" | "high" | "excellent";

export const EFFECTIVENESS_LEVELS: EffectivenessLevel[] = [
  "very_low",
  "low",
  "medium",
  "high",
  "excellent",
];

// ─── Result type ──────────────────────────────────────────────────────────────

export type OutcomeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" };

// ─── Event types ──────────────────────────────────────────────────────────────

export type DecisionOutcomeEventType =
  | "OPERATIONAL_DECISION_OUTCOME_CREATED"
  | "OPERATIONAL_OUTCOME_OBSERVATION_RECORDED"
  | "OPERATIONAL_DECISION_OUTCOME_EVALUATED"
  | "OPERATIONAL_DECISION_OUTCOME_COMPLETED"
  | "OPERATIONAL_DECISION_OUTCOME_ARCHIVED"
  | "OPERATIONAL_DECISION_EFFECTIVENESS_CALCULATED"
  | "OPERATIONAL_RECOMMENDATION_QUALITY_CALCULATED"
  | "OPERATIONAL_OUTCOME_LEARNING_GENERATED"
  | "OPERATIONAL_RECOMMENDATION_EVOLUTION_UPDATED"
  | "OPERATIONAL_DECISION_OUTCOME_LINEAGE_GENERATED";

// ─── Variance result ──────────────────────────────────────────────────────────

export type OutcomeVarianceResult = {
  expected: number;
  actual: number;
  variance: number;
  variancePercentage: string;
};

// ─── Recommendation evolution ─────────────────────────────────────────────────

export type RecommendationEvolutionRecord = {
  decisionId: string;
  workspaceId: string;
  effectivenessScore: number;
  effectivenessLevel: EffectivenessLevel;
  recommendationQuality: RecommendationQuality;
  shouldRecommendAgain: boolean;
  evidenceCount: number;
  updatedAt: string;
};

// ─── Outcome comparison ───────────────────────────────────────────────────────

export type OutcomeComparison = {
  outcomeA: OperationalDecisionOutcomeRow;
  outcomeB: OperationalDecisionOutcomeRow;
  effectivenessDifference: number;
  winner: "a" | "b" | "tie";
  ranking: Array<{ outcomeId: string; rank: number; effectivenessScore: number }>;
};

// ─── Evidence validation ──────────────────────────────────────────────────────

export type EvidenceValidationResult = {
  outcomeId: string;
  observationCount: number;
  effectCount: number;
  learningCount: number;
  isValid: boolean;
  validationStatus: "valid" | "insufficient_observations" | "insufficient_effects" | "no_learning";
  missingRequirements: string[];
};

// ─── Outcome lineage layer ────────────────────────────────────────────────────

export type OutcomeLineageLayer = {
  layer:
    | "constitution"
    | "memory"
    | "learning"
    | "recommendation"
    | "signal"
    | "action"
    | "commitment"
    | "projection"
    | "reality"
    | "snapshot"
    | "focus_item"
    | "consequence"
    | "decision"
    | "outcome";
  entityType: string;
  entityId: string | null;
  label: string;
  count: number;
};

export type OutcomeLineage = {
  outcomeId: string;
  decisionId: string;
  workspaceId: string;
  chain: OutcomeLineageLayer[];
  generatedAt: string;
};

// ─── Full outcome analysis ────────────────────────────────────────────────────

export type OutcomeAnalysis = {
  outcome: OperationalDecisionOutcomeRow;
  observations: OperationalOutcomeObservationRow[];
  effects: OperationalOutcomeEffectRow[];
  learning: OperationalLearningFeedbackRow[];
  effectivenessLevel: EffectivenessLevel;
  variance: OutcomeVarianceResult;
};

// ─── Outcome explanation ──────────────────────────────────────────────────────

export type OutcomeExplanation = {
  outcomeId: string;
  decisionId: string;
  outcomeStatus: OutcomeStatus;
  effectivenessScore: number;
  effectivenessLevel: EffectivenessLevel;
  recommendationQuality: RecommendationQuality;
  variance: OutcomeVarianceResult;
  learningCount: number;
  observationCount: number;
  shouldRecommendAgain: boolean;
  lineage: OutcomeLineage;
  generatedAt: string;
};

// ─── Service input types ──────────────────────────────────────────────────────

export type CreateDecisionOutcomeInput = {
  workspaceId: string;
  decisionId: string;
  expectedImpactScore: number;
  actorId: string;
};

export type RecordOutcomeObservationInput = {
  workspaceId: string;
  outcomeId: string;
  observationType: OutcomeObservationType;
  observationValue: number;
  observationSource: string;
  observedBy: string;
};

export type EvaluateDecisionOutcomeInput = {
  workspaceId: string;
  outcomeId: string;
  actorId: string;
};

export type CompleteDecisionOutcomeInput = {
  workspaceId: string;
  outcomeId: string;
  actorId: string;
};

export type ArchiveDecisionOutcomeInput = {
  workspaceId: string;
  outcomeId: string;
  actorId: string;
};

export type GetDecisionOutcomeInput = {
  workspaceId: string;
  outcomeId: string;
};

export type ListDecisionOutcomesInput = {
  workspaceId: string;
  decisionId?: string;
  status?: OutcomeStatus;
  minEffectivenessScore?: number;
  recommendationQuality?: RecommendationQuality;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export type CompareDecisionOutcomesInput = {
  workspaceId: string;
  outcomeIdA: string;
  outcomeIdB: string;
};

export type GetOutcomeLineageInput = {
  workspaceId: string;
  outcomeId: string;
  actorId: string;
};

export type ExplainDecisionOutcomesInput = {
  workspaceId: string;
  outcomeId: string;
};
