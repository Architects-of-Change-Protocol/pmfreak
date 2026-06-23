// ─── Service Functions ────────────────────────────────────────────────────────

export {
  generateOperationalDecision,
  getOperationalDecision,
  listOperationalDecisions,
  validateOperationalDecision,
  archiveOperationalDecision,
  getOperationalDecisionAnalysis,
  getOperationalDecisionLineageForDecision,
} from "./decision-registry";

// ─── Engines ──────────────────────────────────────────────────────────────────

export { generateDecisionAlternatives }       from "./alternative-engine";
export { evaluateDecisionOptions }            from "./evaluation-engine";
export { calculateDecisionScore, scoreToLabel } from "./scoring-engine";
export { calculateDecisionConfidence }        from "./confidence-engine";
export { analyzeDecisionTradeoffs }           from "./tradeoff-engine";
export { selectRecommendedDecision }          from "./recommendation-engine";
export { compareDecisionOptions }             from "./comparative-engine";
export { generateOperationalDecisionSupport } from "./decision-support-engine";
export { getOperationalDecisionLineage }      from "./lineage-engine";

// ─── Explain ──────────────────────────────────────────────────────────────────

export { explainOperationalDecisions } from "./explain";

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  DecisionResult,
  DecisionEventType,
  DecisionCategory,
  DecisionStatus,
  DecisionOptionType,
  DecisionEffortLevel,
  DecisionRiskLevel,
  DecisionTradeoffType,
  OperationalDecisionRow,
  OperationalDecisionOptionRow,
  OperationalDecisionEvaluationRow,
  OperationalDecisionTradeoffRow,
  DecisionAlternative,
  DecisionEvaluationInput,
  DecisionEvaluationScores,
  DecisionTradeoff,
  DecisionRecommendation,
  OptionComparison,
  DecisionComparativeAnalysis,
  OperationalDecisionSupport,
  DecisionLineageLayer,
  OperationalDecisionLineage,
  OperationalDecisionAnalysis,
  GenerateDecisionInput,
  GetDecisionInput,
  ListDecisionsInput,
  ValidateDecisionInput,
  ArchiveDecisionInput,
  GetDecisionLineageInput,
  ExplainDecisionInput,
} from "./types";
