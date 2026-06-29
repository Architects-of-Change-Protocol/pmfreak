// ─── Controlled Execution Learning Signals & Governance Feedback Loop — Types ──
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT store raw payloads, free text rationale, or identifiers in signals.
// Does NOT mutate policies, routing, or scoring values.
// All operations are deterministic.

export type AgentExecutionLearningSignalStatus =
  | "created" | "privacy_pending" | "privacy_passed" | "privacy_blocked"
  | "active" | "archived" | "invalidated";

export type AgentExecutionLearningSignalType =
  | "outcome_accepted" | "outcome_rejected" | "correction_requested"
  | "retry_recommended" | "evidence_missing" | "evidence_complete"
  | "confidence_low" | "confidence_high" | "intended_actual_matched"
  | "intended_actual_mismatched" | "dispatch_failed" | "triage_retryable"
  | "triage_escalated" | "risk_underestimated" | "risk_overestimated"
  | "risk_aligned" | "adapter_quality_positive" | "adapter_quality_negative"
  | "review_route_effective" | "review_route_ineffective";

export type AgentExecutionLearningSignalCategory =
  | "outcome" | "evidence" | "confidence" | "risk" | "adapter" | "review"
  | "triage" | "governance";

export type AgentExecutionLearningSourceType =
  | "execution_outcome" | "outcome_reconciliation" | "outcome_comparison"
  | "evidence_completeness" | "outcome_confidence" | "human_outcome_review"
  | "failed_dispatch_triage" | "correction_loop" | "review_decision"
  | "dispatch_attempt";

export type AgentExecutionLearningPrivacyClassification =
  | "safe" | "redacted" | "blocked_sensitive" | "blocked_raw_payload"
  | "blocked_identifier" | "blocked_free_text" | "unknown";

export type AgentExecutionLearningRetentionClass =
  | "signal_only" | "summary_only" | "redacted_metadata" | "blocked";

export type AgentExecutionLearningExtractionStatus =
  | "created" | "running" | "succeeded" | "partial" | "failed"
  | "privacy_blocked" | "cancelled";

export type AgentExecutionGovernanceFeedbackStatus =
  | "created" | "open" | "reviewed" | "accepted" | "rejected" | "archived";

export type AgentExecutionGovernanceFeedbackType =
  | "risk_calibration" | "evidence_requirement" | "adapter_quality"
  | "review_routing" | "human_review_policy" | "triage_policy"
  | "governance_observation";

export type AgentExecutionGovernanceFeedbackSeverity =
  | "info" | "low" | "medium" | "high" | "critical";

export type AgentExecutionRiskCalibrationDirection =
  | "underestimated" | "overestimated" | "aligned" | "unknown";

export type AgentExecutionTrendDirection =
  | "improving" | "worsening" | "stable" | "insufficient_data";

export type AgentExecutionRouteEffectiveness =
  | "effective" | "ineffective" | "unknown";

export type AgentExecutionLearningEventType =
  | "learning_signal_created" | "learning_signal_privacy_checked"
  | "learning_signal_privacy_passed" | "learning_signal_privacy_blocked"
  | "learning_extraction_started" | "learning_extraction_succeeded"
  | "learning_extraction_failed" | "governance_feedback_created"
  | "risk_calibration_signal_created" | "evidence_quality_signal_created"
  | "adapter_performance_signal_created" | "review_decision_pattern_created"
  | "review_routing_feedback_created" | "workspace_learning_summary_created"
  | "aggregate_signal_created" | "learning_signal_archived";

export type AgentExecutionLearningSignalRecord = {
  id: string;
  workspaceId: string;
  sourceType: AgentExecutionLearningSourceType;
  sourceId: string;
  outcomeId: string | null;
  reviewId: string | null;
  decisionId: string | null;
  dispatchAttemptId: string | null;
  adapterKey: string | null;
  toolKey: string | null;
  actionType: string | null;
  signalType: AgentExecutionLearningSignalType;
  signalCategory: AgentExecutionLearningSignalCategory;
  signalValue: string;
  signalWeight: number;
  confidenceScore: number;
  privacyClassification: AgentExecutionLearningPrivacyClassification;
  retentionClass: AgentExecutionLearningRetentionClass;
  status: AgentExecutionLearningSignalStatus;
  signalPayload: Record<string, unknown> | null;
  safeSignalPayload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionLearningExtractionRecord = {
  id: string;
  workspaceId: string;
  sourceType: AgentExecutionLearningSourceType;
  sourceId: string;
  status: AgentExecutionLearningExtractionStatus;
  signalsExtracted: number;
  signalsSkipped: number;
  privacyPassed: number;
  privacyBlocked: number;
  blockingReasons: string[];
  warnings: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionLearningPrivacyFilterRecord = {
  id: string;
  workspaceId: string;
  sourceType: AgentExecutionLearningSourceType;
  sourceId: string;
  candidateSignalType: AgentExecutionLearningSignalType;
  containsRawPayload: boolean;
  containsFreeText: boolean;
  containsSensitiveKey: boolean;
  containsCustomerIdentifier: boolean;
  containsProjectIdentifier: boolean;
  safeToStore: boolean;
  redactionApplied: boolean;
  privacyClassification: AgentExecutionLearningPrivacyClassification;
  retentionClass: AgentExecutionLearningRetentionClass;
  filterReasons: string[];
  createdAt: string;
};

export type AgentExecutionGovernanceFeedbackRecord = {
  id: string;
  workspaceId: string;
  feedbackType: AgentExecutionGovernanceFeedbackType;
  feedbackCategory: AgentExecutionLearningSignalCategory;
  severity: AgentExecutionGovernanceFeedbackSeverity;
  status: AgentExecutionGovernanceFeedbackStatus;
  recommendation: string;
  confidenceScore: number;
  sourceSignalIds: string[];
  ownerRole: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewRationale: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionRiskCalibrationSignalRecord = {
  id: string;
  workspaceId: string;
  sourceSignalId: string | null;
  outcomeId: string | null;
  actionType: string | null;
  adapterKey: string | null;
  originalRiskLevel: "low" | "medium" | "high" | "critical" | null;
  observedRiskLevel: "low" | "medium" | "high" | "critical" | null;
  humanDecisionType: string | null;
  calibrationDirection: AgentExecutionRiskCalibrationDirection;
  confidenceScore: number;
  createdAt: string;
};

export type AgentExecutionEvidenceQualitySignalRecord = {
  id: string;
  workspaceId: string;
  sourceSignalId: string | null;
  actionType: string | null;
  adapterKey: string | null;
  requiredEvidenceType: string | null;
  availableEvidenceType: string | null;
  missingEvidenceType: string | null;
  evidenceCompletenessLevel: string | null;
  frequency: number;
  trendDirection: AgentExecutionTrendDirection;
  createdAt: string;
};

export type AgentExecutionAdapterPerformanceSignalRecord = {
  id: string;
  workspaceId: string;
  adapterKey: string;
  toolKey: string | null;
  successCount: number;
  failureCount: number;
  missingEvidenceCount: number;
  correctionCount: number;
  retryRecommendationCount: number;
  humanAcceptanceCount: number;
  humanRejectionCount: number;
  lowConfidenceCount: number;
  mediumConfidenceCount: number;
  highConfidenceCount: number;
  trendDirection: AgentExecutionTrendDirection;
  createdAt: string;
};

export type AgentExecutionReviewDecisionPatternRecord = {
  id: string;
  workspaceId: string;
  decisionType: string;
  reviewRequirement: string | null;
  riskLevel: string | null;
  actionType: string | null;
  adapterKey: string | null;
  confidenceLevel: string | null;
  evidenceCompletenessLevel: string | null;
  count: number;
  trendDirection: AgentExecutionTrendDirection;
  createdAt: string;
};

export type AgentExecutionReviewRoutingFeedbackRecord = {
  id: string;
  workspaceId: string;
  assignedRole: string | null;
  assignedTo: string | null;
  reviewPriority: string | null;
  decisionType: string | null;
  routeEffectiveness: AgentExecutionRouteEffectiveness;
  suggestedRouteAdjustment: string | null;
  createdAt: string;
};

export type AgentExecutionWorkspaceLearningSummaryRecord = {
  id: string;
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  totalSignals: number;
  governanceFeedbackCount: number;
  riskCalibrationCount: number;
  evidenceQualityCount: number;
  adapterPerformanceCount: number;
  reviewPatternCount: number;
  topSignalsJson: Record<string, unknown>;
  recommendationsJson: Record<string, unknown>;
  confidenceScore: number;
  createdAt: string;
};

export type AgentExecutionAggregateLearningSignalRecord = {
  id: string;
  aggregateScope: "workspace" | "global_disabled";
  workspaceId: string | null;
  signalType: AgentExecutionLearningSignalType;
  signalCategory: AgentExecutionLearningSignalCategory;
  count: number;
  thresholdMet: boolean;
  privacySafe: boolean;
  createdAt: string;
};

export type AgentExecutionLearningEventRecord = {
  id: string;
  workspaceId: string | null;
  signalId: string | null;
  extractionId: string | null;
  feedbackId: string | null;
  sourceType: AgentExecutionLearningSourceType | null;
  sourceId: string | null;
  eventType: AgentExecutionLearningEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};

export type CreateAgentExecutionLearningSignalInput = {
  workspaceId: string;
  sourceType: AgentExecutionLearningSourceType;
  sourceId: string;
  outcomeId?: string | null;
  reviewId?: string | null;
  decisionId?: string | null;
  dispatchAttemptId?: string | null;
  adapterKey?: string | null;
  toolKey?: string | null;
  actionType?: string | null;
  signalType: AgentExecutionLearningSignalType;
  signalCategory: AgentExecutionLearningSignalCategory;
  signalValue: string;
  signalWeight?: number;
  confidenceScore?: number;
  signalPayload?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type ExtractLearningSignalsInput = {
  workspaceId: string;
  sourceType: AgentExecutionLearningSourceType;
  sourceId: string;
  actorId?: string | null;
};

export type GenerateGovernanceFeedbackInput = {
  workspaceId: string;
  sourceSignalIds?: string[];
  actorId?: string | null;
};

export type GenerateWorkspaceLearningSummaryInput = {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  actorId?: string | null;
};

export type AgentExecutionLearningSignalListFilters = {
  status?: AgentExecutionLearningSignalStatus;
  signalType?: AgentExecutionLearningSignalType;
  signalCategory?: AgentExecutionLearningSignalCategory;
  sourceType?: AgentExecutionLearningSourceType;
  outcomeId?: string;
  adapterKey?: string;
  actionType?: string;
  privacyClassification?: AgentExecutionLearningPrivacyClassification;
  limit?: number;
};
