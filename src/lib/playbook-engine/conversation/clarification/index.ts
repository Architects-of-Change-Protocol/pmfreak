/**
 * Sprint 22R — Clarification Response Strategy: isolated barrel.
 *
 * Exports types, the pure analyzer, the candidate strategy, and the offline evaluator for this
 * package only. This barrel is not re-exported from `src/lib/playbook-engine/conversation/index.ts`
 * (the production barrel) and is not imported by the router, composer, any production handler, or
 * the gateway — see `docs/conversational-brain-clarification-response-strategy.md`.
 */

export type {
  ClarificationResponseInputSource,
  ClarificationAvailableContext,
  ClarificationResponseInput,
  ClarificationStrategyType,
  ClarificationMissingSlot,
  ClarificationRouteOptionIntent,
  ClarificationRouteOptionPriority,
  ClarificationRouteOption,
  ClarificationQuestion,
  ClarificationResponseTone,
  ClarificationResponseSafety,
  ClarificationResponseAuditMetadata,
  ClarificationAmbiguityLevel,
  ClarificationResponseCandidateResult,
} from "./clarificationResponseTypes";

export {
  normalizeClarificationInput,
  detectClarificationStrategyType,
  detectClarificationStrategyTypeWithDetail,
  detectClarificationSignals,
  inferMissingSlots,
  inferSuggestedRouteOptions,
  buildClarificationQuestions,
  estimateAmbiguityLevel,
  explainClarificationResponseAnalysis,
} from "./clarificationResponseAnalyzer";
export type {
  ClarificationTypeDetectionDetail,
  ClarificationQuestionSet,
  ClarificationResponseAnalysisExplain,
} from "./clarificationResponseAnalyzer";

export {
  handleClarificationResponseCandidate,
  formatClarificationResponseCandidate,
  explainClarificationResponseStrategy,
  CLARIFICATION_RESPONSE_STRATEGY_VERSION,
} from "./clarificationResponseStrategy";
export type {
  FormatClarificationResponseCandidateOptions,
  ClarificationResponseStrategyExplain,
} from "./clarificationResponseStrategy";

export {
  runClarificationResponseEvaluation,
  summarizeClarificationResponseEvaluation,
  explainClarificationResponseEvaluation,
  toDecisionClarificationEvaluationCases,
  toGeneralPmBoundaryEvaluationCases,
  toCustomFixtureEvaluationCases,
} from "./clarificationResponseEvaluation";
export type {
  ClarificationResponseEvaluationSourceCorpus,
  ClarificationCustomFixtureCase,
  ClarificationResponseEvaluationCase,
  ClarificationResponseEvaluationOptions,
  ClarificationResponseEvaluationResult,
  ClarificationResponseNextSprintRecommendation,
  ClarificationResponseEvaluationSummary,
  ClarificationResponseEvaluationExplain,
} from "./clarificationResponseEvaluation";
