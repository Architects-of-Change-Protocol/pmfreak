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

export {
  DECISION_SUPPORT_SHADOW_STORAGE_POLICY_VERSION,
  createDecisionSupportShadowStoragePolicyProfile,
  classifyDecisionSupportShadowStorageField,
  listDecisionSupportShadowStorageFieldPolicies,
  createDecisionSupportShadowStorageRetentionPolicy,
  createDecisionSupportShadowStorageDeletionPolicy,
  createDecisionSupportShadowDefaultOffPersistencePlan,
  assessDecisionSupportShadowCaptureRecordForStorage,
  runDecisionSupportShadowStoragePolicyEvaluation,
  summarizeDecisionSupportShadowStoragePolicyEvaluation,
  explainDecisionSupportShadowStoragePolicy,
} from "./decisionSupportShadowCaptureStoragePolicy";
export type {
  DecisionSupportShadowStoragePolicyProfile,
  DecisionSupportShadowStoragePolicyMode,
  DecisionSupportShadowStorageFieldCategory,
  DecisionSupportShadowStorageFieldDecision,
  DecisionSupportShadowStorageFieldRisk,
  DecisionSupportShadowStorageFieldPolicy,
  DecisionSupportShadowStorageRetentionMode,
  DecisionSupportShadowStorageDeletionTrigger,
  DecisionSupportShadowStorageRetentionPolicy,
  DecisionSupportShadowStorageDeletionPolicy,
  DecisionSupportShadowStorageReadinessGate,
  DecisionSupportShadowStorageReadinessGateSeverity,
  DecisionSupportShadowStorageReadinessGateResult,
  DecisionSupportShadowStorageDefaultOffPersistencePlan,
  DecisionSupportShadowStorageObservedValueKind,
  DecisionSupportShadowStorageCaptureRecordLike,
  DecisionSupportShadowStorageFieldAssessment,
  DecisionSupportShadowStorageRecordAssessment,
  DecisionSupportShadowStorageReadinessStatus,
  DecisionSupportShadowStorageNextSprintRecommendation,
  DecisionSupportShadowStoragePolicyEvaluationOptions,
  DecisionSupportShadowStoragePolicyEvaluationSummary,
  DecisionSupportShadowStoragePolicyExplain,
} from "./decisionSupportShadowCaptureStoragePolicy";

export {
  DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_VERSION,
  createDecisionSupportShadowStorageAdapterPlanProfile,
  listDecisionSupportShadowStorageAdapterMethodPolicies,
  createDecisionSupportShadowStorageSchemaProposal,
  createDecisionSupportShadowStorageMigrationProposal,
  mapDecisionSupportCaptureRecordToStorageDraft,
  validateDecisionSupportShadowStorageDraft,
  simulateDecisionSupportShadowStorageAdapter,
  runDecisionSupportShadowStorageAdapterPlanEvaluation,
  summarizeDecisionSupportShadowStorageAdapterPlanEvaluation,
  explainDecisionSupportShadowStorageAdapterPlan,
} from "./decisionSupportShadowCaptureStorageAdapterPlan";
export type {
  DecisionSupportShadowStorageAdapterPlanProfile,
  DecisionSupportShadowStorageAdapterPlanMode,
  DecisionSupportShadowStorageAdapterKind,
  DecisionSupportShadowStorageAdapterMethodName,
  DecisionSupportShadowStorageAdapterMethodPolicy,
  DecisionSupportShadowStorageColumnType,
  DecisionSupportShadowStorageColumnDecision,
  DecisionSupportShadowStorageSchemaColumnRisk,
  DecisionSupportShadowStorageSchemaColumn,
  DecisionSupportShadowStorageSchemaProposalStatus,
  DecisionSupportShadowStorageSchemaProposal,
  DecisionSupportShadowStorageMigrationProposal,
  DecisionSupportShadowStorageDraftFields,
  DecisionSupportShadowStoragePolicyAssessmentSummary,
  DecisionSupportShadowStorageDraft,
  DecisionSupportShadowStorageDraftValidationGate,
  DecisionSupportShadowStorageDraftValidationSeverity,
  DecisionSupportShadowStorageDraftValidationResult,
  DecisionSupportShadowStorageDraftValidationOptions,
  DecisionSupportShadowStorageAdapterSimulationResult,
  DecisionSupportShadowStorageAdapterPlanEvaluationResult,
  DecisionSupportShadowStorageAdapterPlanReadinessStatus,
  DecisionSupportShadowStorageAdapterPlanNextSprintRecommendation,
  DecisionSupportShadowStorageAdapterPlanEvaluationOptions,
  DecisionSupportShadowStorageAdapterPlanEvaluationSummary,
  DecisionSupportShadowStorageAdapterPlanExplain,
} from "./decisionSupportShadowCaptureStorageAdapterPlan";

export {
  DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_VERSION,
  createDecisionSupportShadowStorageFakeAdapterConfig,
  createDecisionSupportShadowStorageFakeAdapter,
  createDecisionSupportShadowStorageFakeRepositoryRecord,
  writeDecisionSupportShadowStorageDraftToFakeAdapter,
  deleteDecisionSupportShadowStorageDraftByCaptureIdFake,
  deleteDecisionSupportShadowStorageDraftByWorkspaceFake,
  purgeExpiredDecisionSupportShadowStorageDraftsFake,
  listDecisionSupportShadowStorageDraftsByPolicyVersionFake,
  runDecisionSupportShadowStorageFakeAdapterEvaluation,
  summarizeDecisionSupportShadowStorageFakeAdapterEvaluation,
  explainDecisionSupportShadowStorageFakeAdapter,
} from "./decisionSupportShadowCaptureStorageFakeAdapter";
export type {
  DecisionSupportShadowStorageFakeAdapterProfile,
  DecisionSupportShadowStorageFakeAdapterMode,
  DecisionSupportShadowStorageFakeAdapterKind,
  DecisionSupportShadowStorageFakeWriteStatus,
  DecisionSupportShadowStorageFakeDeleteStatus,
  DecisionSupportShadowStorageFakePurgeStatus,
  DecisionSupportShadowStorageFakeListStatus,
  DecisionSupportShadowStorageFakeAdapterConfig,
  DecisionSupportShadowStorageFakeRepositoryRecordAudit,
  DecisionSupportShadowStorageFakeRepositoryRecord,
  DecisionSupportShadowStorageFakeWriteResult,
  DecisionSupportShadowStorageFakeDeleteResult,
  DecisionSupportShadowStorageFakeWorkspaceDeleteResult,
  DecisionSupportShadowStorageFakePurgeResult,
  DecisionSupportShadowStorageFakeListResult,
  DecisionSupportShadowStorageFakeAdapterStats,
  DecisionSupportShadowStorageFakeAdapter,
  DecisionSupportShadowStorageFakeAdapterReadinessStatus,
  DecisionSupportShadowStorageFakeAdapterEvaluationOptions,
  DecisionSupportShadowStorageFakeAdapterEvaluationResult,
  DecisionSupportShadowStorageFakeAdapterEvaluationSummary,
  DecisionSupportShadowStorageFakeAdapterExplain,
} from "./decisionSupportShadowCaptureStorageFakeAdapter";
