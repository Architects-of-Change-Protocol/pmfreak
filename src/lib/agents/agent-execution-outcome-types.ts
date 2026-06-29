// ─── Controlled Execution Result Reconciliation & Human Outcome Review — Types ──
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Reconciles dispatch outcomes, scores evidence completeness, compares intended vs
// actual outcomes, calculates confidence, and routes to human outcome review where
// required. All operations are deterministic.

export type AgentExecutionOutcomeStatus =
  | "created"
  | "reconciling"
  | "reconciled"
  | "evidence_review"
  | "comparison_pending"
  | "comparison_complete"
  | "confidence_scored"
  | "review_required"
  | "review_in_progress"
  | "review_complete"
  | "correction_required"
  | "correction_in_progress"
  | "correction_complete"
  | "archived"
  | "failed";

export type AgentExecutionOutcomeType =
  | "dispatch_success"
  | "dispatch_failure"
  | "adapter_success"
  | "adapter_failure"
  | "partial_success"
  | "noop"
  | "blocked"
  | "cancelled"
  | "reconciliation_failure";

export type AgentExecutionOutcomeMatchStatus =
  | "matched"
  | "partial_match"
  | "mismatch"
  | "undetermined"
  | "no_intended_outcome";

export type AgentExecutionEvidenceCompletenessLevel =
  | "none"
  | "minimal"
  | "partial"
  | "sufficient"
  | "complete";

export type AgentExecutionOutcomeConfidenceLevel =
  | "low"
  | "medium"
  | "high";

export type AgentExecutionOutcomeReviewRequirement =
  | "not_required"
  | "required_low_confidence"
  | "required_mismatch"
  | "required_failure"
  | "required_correction"
  | "required_policy";

export type AgentExecutionOutcomeReviewStatus =
  | "not_required"
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected"
  | "deferred"
  | "cancelled";

export type AgentExecutionOutcomeDecisionType =
  | "approve"
  | "reject"
  | "request_correction"
  | "archive"
  | "escalate"
  | "defer";

export type AgentExecutionFailureCategory =
  | "dispatch_blocked"
  | "adapter_refused"
  | "adapter_error"
  | "idempotency_conflict"
  | "lock_unavailable"
  | "confirmation_rejected"
  | "evidence_insufficient"
  | "reconciliation_error"
  | "unknown";

export type AgentExecutionCorrectionType =
  | "retry_dispatch"
  | "re_evaluate_readiness"
  | "update_evidence"
  | "manual_override"
  | "escalate_to_human"
  | "cancel_execution";

export type AgentExecutionCorrectionStatus =
  | "created"
  | "in_progress"
  | "applied"
  | "failed"
  | "cancelled";

export type AgentExecutionOutcomeEventType =
  | "outcome_created"
  | "reconciliation_started"
  | "reconciliation_complete"
  | "evidence_completeness_scored"
  | "comparison_started"
  | "comparison_complete"
  | "confidence_scored"
  | "review_requirement_determined"
  | "human_review_created"
  | "human_review_decision_recorded"
  | "failed_dispatch_triaged"
  | "correction_loop_created"
  | "correction_loop_applied"
  | "outcome_archived";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentExecutionOutcomeRecord = {
  id: string;
  workspaceId: string;
  executionRequestId: string;
  finalizationId: string | null;
  dispatchAttemptId: string | null;
  dispatchGateId: string | null;
  adapterExecutionId: string | null;
  resultId: string | null;
  status: AgentExecutionOutcomeStatus;
  outcomeType: AgentExecutionOutcomeType;
  matchStatus: AgentExecutionOutcomeMatchStatus;
  evidenceCompletenessLevel: AgentExecutionEvidenceCompletenessLevel;
  confidenceScore: number;
  confidenceLevel: AgentExecutionOutcomeConfidenceLevel;
  reviewRequirement: AgentExecutionOutcomeReviewRequirement;
  reviewStatus: AgentExecutionOutcomeReviewStatus;
  intendedOutcomeSummary: string | null;
  actualOutcomeSummary: string | null;
  mismatchReasons: string[];
  blockingReasons: string[];
  warnings: string[];
  outcomePayload: Record<string, unknown> | null;
  safeOutcomePayload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionOutcomeReconciliationRecord = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  finalizationId: string | null;
  dispatchAttemptId: string | null;
  dispatchSucceeded: boolean;
  adapterExecutionExists: boolean;
  resultExists: boolean;
  evidenceCount: number;
  lineageComplete: boolean;
  reconciliationNotes: string[];
  reconciliationPayload: Record<string, unknown> | null;
  reconciledAt: string;
  createdAt: string;
};

export type AgentExecutionOutcomeComparisonRecord = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  matchStatus: AgentExecutionOutcomeMatchStatus;
  intendedOutcomeSummary: string | null;
  actualOutcomeSummary: string | null;
  mismatchReasons: string[];
  confidenceImpact: number;
  requiresCorrection: boolean;
  comparedAt: string;
  createdAt: string;
};

export type AgentExecutionEvidenceCompletenessRecord = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  completenessScore: number;
  level: AgentExecutionEvidenceCompletenessLevel;
  presentTypes: string[];
  missingTypes: string[];
  blockingGaps: string[];
  warnings: string[];
  scoredAt: string;
  createdAt: string;
};

export type AgentExecutionOutcomeConfidenceRecord = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  confidenceScore: number;
  confidenceLevel: AgentExecutionOutcomeConfidenceLevel;
  confidenceReasons: string[];
  scoredAt: string;
  createdAt: string;
};

export type AgentExecutionHumanOutcomeReviewRecord = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  reviewRequirement: AgentExecutionOutcomeReviewRequirement;
  reviewStatus: AgentExecutionOutcomeReviewStatus;
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  summary: string | null;
  decidedBy: string | null;
  decisionType: AgentExecutionOutcomeDecisionType | null;
  decisionRationale: string | null;
  decidedAt: string | null;
  dueAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionFailedDispatchTriageRecord = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  finalizationId: string | null;
  dispatchAttemptId: string | null;
  failureCategory: AgentExecutionFailureCategory;
  failureMessage: string | null;
  blockingReasons: string[];
  triageNotes: string[];
  recommendedCorrectionType: AgentExecutionCorrectionType | null;
  triagePayload: Record<string, unknown> | null;
  triagedAt: string;
  createdAt: string;
};

export type AgentExecutionCorrectionLoopRecord = {
  id: string;
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  correctionType: AgentExecutionCorrectionType;
  correctionStatus: AgentExecutionCorrectionStatus;
  correctionRationale: string | null;
  appliedBy: string | null;
  appliedAt: string | null;
  correctionPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentExecutionOutcomeEventRecord = {
  id: string;
  workspaceId: string;
  outcomeId: string | null;
  executionRequestId: string | null;
  reconciliationId: string | null;
  comparisonId: string | null;
  humanReviewId: string | null;
  correctionLoopId: string | null;
  eventType: AgentExecutionOutcomeEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export type CreateAgentExecutionOutcomeInput = {
  workspaceId: string;
  executionRequestId: string;
  finalizationId?: string | null;
  dispatchAttemptId?: string | null;
  dispatchGateId?: string | null;
  adapterExecutionId?: string | null;
  resultId?: string | null;
  outcomeType?: AgentExecutionOutcomeType;
  intendedOutcomeSummary?: string | null;
  actualOutcomeSummary?: string | null;
  outcomePayload?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type ReconcileDispatchOutcomeInput = {
  workspaceId: string;
  outcomeId: string;
  actorId?: string | null;
};

export type CreateHumanOutcomeReviewInput = {
  workspaceId: string;
  outcomeId: string;
  priority?: "low" | "normal" | "high" | "urgent";
  title?: string;
  summary?: string | null;
  dueAt?: string | null;
  createdBy?: string | null;
};

export type RecordHumanOutcomeDecisionInput = {
  workspaceId: string;
  outcomeId: string;
  humanReviewId: string;
  decisionType: AgentExecutionOutcomeDecisionType;
  decisionRationale?: string | null;
  decidedBy?: string | null;
};

export type AgentExecutionOutcomeListFilters = {
  status?: AgentExecutionOutcomeStatus;
  outcomeType?: AgentExecutionOutcomeType;
  matchStatus?: AgentExecutionOutcomeMatchStatus;
  confidenceLevel?: AgentExecutionOutcomeConfidenceLevel;
  reviewStatus?: AgentExecutionOutcomeReviewStatus;
  reviewRequirement?: AgentExecutionOutcomeReviewRequirement;
  executionRequestId?: string;
  finalizationId?: string;
  dispatchAttemptId?: string;
  limit?: number;
};
