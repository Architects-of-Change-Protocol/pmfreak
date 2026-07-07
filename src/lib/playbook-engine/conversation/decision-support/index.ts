/**
 * Sprint 19R — Decision Support Candidate Handler: isolated barrel.
 *
 * Exports types, the pure analyzer, and the candidate handler for this package only. This barrel is
 * not re-exported from `src/lib/playbook-engine/conversation/index.ts` (the production barrel) and
 * is not imported by the router, composer, any production handler, or the gateway — see
 * `docs/conversational-brain-decision-support-candidate-handler.md`.
 */

export type {
  DecisionSupportInput,
  DecisionSupportInputSource,
  DecisionSupportContext,
  DecisionSupportDecisionType,
  DecisionSupportOption,
  DecisionSupportImpact,
  DecisionSupportReversibility,
  DecisionSupportTradeoff,
  DecisionSupportRisk,
  DecisionSupportRiskLevel,
  DecisionSupportEvidenceNeed,
  DecisionSupportEvidenceNeedPriority,
  DecisionSupportConfidence,
  DecisionSupportRecommendation,
  DecisionSupportSafety,
  DecisionSupportAuditMetadata,
  DecisionSupportCandidateResult,
} from "./decisionSupportCandidateTypes";

export {
  normalizeDecisionSupportInput,
  detectDecisionType,
  detectDecisionTypeWithDetail,
  extractDecisionOptions,
  identifyDecisionTradeoffs,
  identifyDecisionRisks,
  identifyEvidenceNeeds,
  buildDecisionStatement,
  estimateDecisionConfidence,
  explainDecisionSupportAnalysis,
} from "./decisionSupportAnalyzer";
export type { DecisionTypeDetectionDetail, DecisionSupportAnalysisExplain } from "./decisionSupportAnalyzer";

export {
  handleDecisionSupportCandidate,
  formatDecisionSupportCandidateResponse,
  explainDecisionSupportCandidateHandler,
  DECISION_SUPPORT_CANDIDATE_HANDLER_VERSION,
} from "./decisionSupportCandidateHandler";
export type {
  FormatDecisionSupportCandidateResponseOptions,
  DecisionSupportCandidateHandlerExplain,
} from "./decisionSupportCandidateHandler";

export {
  runDecisionSupportShadowMappingEvaluation,
  summarizeDecisionSupportShadowMappingEvaluation,
  explainDecisionSupportShadowMappingEvaluation,
} from "./decisionSupportShadowMappingEvaluation";
export type {
  DecisionSupportShadowMappingOptions,
  DecisionSupportShadowMappingInput,
  DecisionSupportShadowEligibility,
  DecisionSupportShadowCollisionType,
  DecisionSupportShadowIntegrationMode,
  DecisionSupportShadowMappingResult,
  DecisionSupportShadowMappingCategorySummary,
  DecisionSupportShadowMappingNextSprintRecommendation,
  DecisionSupportShadowMappingSummary,
  DecisionSupportShadowMappingExplain,
} from "./decisionSupportShadowMappingTypes";

export {
  ALL_DECISION_SUPPORT_ADAPTER_MAPPING_STRATEGIES,
  listDecisionSupportAdapterMappingStrategies,
  simulateDecisionSupportAdapterMapping,
  runDecisionSupportAdapterMappingPlan,
  summarizeDecisionSupportAdapterMappingPlan,
  explainDecisionSupportAdapterMappingPlan,
} from "./decisionSupportAdapterMappingPlan";
export type {
  DecisionSupportAdapterMappingStrategy,
  DecisionSupportAdapterMappingPlanOptions,
  DecisionSupportAdapterMappingPlanInput,
  DecisionSupportAdapterMappingSimulatedIntent,
  DecisionSupportAdapterMappingRiskLevel,
  DecisionSupportAdapterMappingOutcome,
  DecisionSupportAdapterMappingResult,
  DecisionSupportAdapterMappingStrategySummary,
  DecisionSupportAdapterMappingNextSprintRecommendation,
  DecisionSupportAdapterMappingPlanSummary,
  DecisionSupportAdapterMappingPlanExplain,
} from "./decisionSupportAdapterMappingPlanTypes";

export {
  DECISION_SUPPORT_SHADOW_MODE_PREP_VERSION,
  prepareDecisionSupportShadowModeRun,
  evaluateDecisionSupportShadowModeRun,
  runDecisionSupportShadowModePrepEvaluation,
  summarizeDecisionSupportShadowModePrepEvaluation,
  explainDecisionSupportShadowModePrep,
} from "./decisionSupportShadowModePrep";
export type {
  DecisionSupportShadowModeStrategy,
  DecisionSupportShadowModeStatus,
  DecisionSupportShadowModeCandidateKind,
  DecisionSupportShadowModeGate,
  DecisionSupportShadowModeGateSeverity,
  DecisionSupportShadowModeGateResult,
  DecisionSupportShadowModeInputSource,
  DecisionSupportShadowModeInput,
  DecisionSupportShadowModeContext,
  DecisionSupportShadowModeAuditMetadata,
  DecisionSupportShadowModeRun,
  DecisionSupportShadowModeEvaluationResult,
  DecisionSupportShadowModeNextSprintRecommendation,
  DecisionSupportShadowModePrepEvaluationOptions,
  DecisionSupportShadowModePrepEvaluationSummary,
  DecisionSupportShadowModePrepExplain,
} from "./decisionSupportShadowModePrep";

export {
  DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_VERSION,
  createDecisionSupportShadowCapturePolicy,
  sanitizeDecisionSupportShadowInput,
  createDecisionSupportShadowInputHash,
  summarizeDecisionSupportShadowCandidate,
  createDecisionSupportShadowCaptureRecord,
  createInMemoryDecisionSupportShadowCaptureSink,
  captureDecisionSupportShadowRun,
  runDecisionSupportShadowCaptureHarnessEvaluation,
  summarizeDecisionSupportShadowCaptureHarnessEvaluation,
  explainDecisionSupportShadowCaptureHarness,
} from "./decisionSupportShadowCaptureHarness";
export type {
  DecisionSupportShadowCaptureMode,
  DecisionSupportShadowCaptureStatus,
  DecisionSupportShadowCaptureRecordKind,
  DecisionSupportShadowCaptureSinkKind,
  DecisionSupportShadowCaptureGate,
  DecisionSupportShadowCaptureGateSeverity,
  DecisionSupportShadowCaptureGateResult,
  DecisionSupportShadowCaptureInputPolicy,
  DecisionSupportShadowCapturePolicyOverrides,
  DecisionSupportShadowCaptureContext,
  DecisionSupportShadowCaptureCandidateKind,
  DecisionSupportShadowCaptureCandidateSummary,
  DecisionSupportShadowCaptureSafetySnapshot,
  DecisionSupportShadowCaptureAuditMetadata,
  DecisionSupportShadowCaptureRecord,
  DecisionSupportShadowCaptureSink,
  DecisionSupportShadowCaptureResult,
  DecisionSupportShadowCaptureHarnessOptions,
  DecisionSupportShadowCaptureNextSprintRecommendation,
  DecisionSupportShadowCaptureHarnessEvaluationSummary,
  DecisionSupportShadowCaptureHarnessExplain,
} from "./decisionSupportShadowCaptureHarness";
