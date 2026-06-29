// ─── Controlled PMO Governance Intelligence Dashboard — Types ─────────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT store raw payloads, free text rationale, or identifiers.
// Does NOT mutate policies, routing, or scoring values.
// All operations are deterministic.

export type AgentPmoGovernanceDashboardSnapshotStatus =
  | "created" | "active" | "archived";

export type AgentPmoGovernanceInsightCardType =
  | "risk_calibration"
  | "evidence_quality"
  | "adapter_performance"
  | "review_routing"
  | "governance_feedback"
  | "privacy_health"
  | "learning_signal_volume"
  | "policy_proposal"
  | "workspace_summary";

export type AgentPmoGovernanceInsightSeverity =
  | "info" | "low" | "medium" | "high" | "critical";

export type AgentPmoGovernanceInsightStatus =
  | "created" | "open" | "reviewed" | "archived";

export type AgentPmoGovernanceTrendDirection =
  | "improving" | "worsening" | "stable" | "insufficient_data";

export type AgentPmoGovernanceActionability =
  | "informational"
  | "review_recommended"
  | "proposal_recommended"
  | "pmo_attention_required";

export type AgentPmoGovernanceFeedbackQueueStatus =
  | "open" | "reviewed" | "accepted" | "rejected" | "archived";

export type AgentPmoPolicyProposalType =
  | "risk_policy"
  | "evidence_requirement"
  | "adapter_quality_review"
  | "review_routing"
  | "human_review_policy"
  | "triage_policy"
  | "governance_process";

export type AgentPmoPolicyProposalStatus =
  | "created" | "open" | "under_review" | "approved_for_future_implementation" | "rejected" | "archived";

export type AgentPmoPolicyProposalDecision =
  | "approve_for_future_implementation" | "reject" | "archive" | "request_more_review";

export type AgentPmoGovernanceReportExportFormat =
  | "markdown" | "json" | "csv";

export type AgentPmoGovernanceReportExportStatus =
  | "created" | "generated" | "failed" | "downloaded" | "archived";

export type AgentPmoGovernanceDashboardEventType =
  | "dashboard_snapshot_created"
  | "insight_card_created"
  | "governance_feedback_reviewed"
  | "policy_proposal_created"
  | "policy_proposal_reviewed"
  | "governance_report_export_created"
  | "governance_report_export_downloaded"
  | "dashboard_filter_applied"
  | "dashboard_summary_viewed";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentPmoGovernanceDashboardSnapshotRecord = {
  id: string;
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  status: AgentPmoGovernanceDashboardSnapshotStatus;
  totalLearningSignals: number;
  activeLearningSignals: number;
  privacyBlockedSignals: number;
  openGovernanceFeedback: number;
  riskCalibrationCount: number;
  evidenceQualityIssueCount: number;
  adapterQualityIssueCount: number;
  reviewRoutingIssueCount: number;
  policyProposalCount: number;
  topCardsJson: Record<string, unknown>;
  safeSnapshotPayload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoGovernanceInsightCardRecord = {
  id: string;
  workspaceId: string;
  snapshotId: string | null;
  cardType: AgentPmoGovernanceInsightCardType;
  title: string;
  severity: AgentPmoGovernanceInsightSeverity;
  status: AgentPmoGovernanceInsightStatus;
  summary: string;
  metricValue: number | null;
  trendDirection: AgentPmoGovernanceTrendDirection;
  actionability: AgentPmoGovernanceActionability;
  sourceSignalIds: string[];
  sourceFeedbackIds: string[];
  sourceLearningSummaryId: string | null;
  safeCardPayload: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoRiskCalibrationInsightRecord = {
  id: string;
  workspaceId: string;
  snapshotId: string | null;
  underestimatedCount: number;
  overestimatedCount: number;
  alignedCount: number;
  unknownCount: number;
  topActionTypes: string[];
  topAdapterKeys: string[];
  recommendedReviewPosture: "maintain" | "increase_review" | "decrease_review" | "investigate";
  confidenceScore: number;
  createdAt: string;
};

export type AgentPmoEvidenceQualityInsightRecord = {
  id: string;
  workspaceId: string;
  snapshotId: string | null;
  missingEvidenceCount: number;
  topMissingEvidenceTypes: string[];
  affectedActionTypes: string[];
  affectedAdapterKeys: string[];
  completenessDistribution: Record<string, number>;
  recommendedEvidencePosture: "maintain" | "tighten" | "investigate";
  confidenceScore: number;
  createdAt: string;
};

export type AgentPmoAdapterPerformanceInsightRecord = {
  id: string;
  workspaceId: string;
  snapshotId: string | null;
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
  trendDirection: AgentPmoGovernanceTrendDirection;
  createdAt: string;
};

export type AgentPmoReviewRoutingInsightRecord = {
  id: string;
  workspaceId: string;
  snapshotId: string | null;
  assignedRole: string | null;
  routeEffectiveness: "effective" | "ineffective" | "unknown";
  reviewPriority: string | null;
  decisionPattern: string | null;
  suggestedRouteAdjustment: string | null;
  confidenceScore: number;
  createdAt: string;
};

export type AgentPmoGovernanceFeedbackQueueRecord = {
  id: string;
  workspaceId: string;
  feedbackId: string;
  feedbackType: string;
  feedbackCategory: string;
  severity: AgentPmoGovernanceInsightSeverity;
  status: AgentPmoGovernanceFeedbackQueueStatus;
  recommendation: string;
  sourceSignalCount: number;
  ownerRole: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewRationale: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoPolicyProposalRecord = {
  id: string;
  workspaceId: string;
  proposalType: AgentPmoPolicyProposalType;
  proposalCategory: string;
  sourceFeedbackIds: string[];
  sourceSignalIds: string[];
  proposedChangeSummary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: AgentPmoPolicyProposalStatus;
  reviewDecision: AgentPmoPolicyProposalDecision | null;
  reviewRationale: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoGovernanceReportExportRecord = {
  id: string;
  workspaceId: string;
  snapshotId: string | null;
  exportFormat: AgentPmoGovernanceReportExportFormat;
  status: AgentPmoGovernanceReportExportStatus;
  periodStart: string;
  periodEnd: string;
  fileName: string;
  contentType: string;
  contentText: string | null;
  contentJson: Record<string, unknown> | null;
  safeExportPayload: Record<string, unknown> | null;
  generatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoGovernanceDashboardEventRecord = {
  id: string;
  workspaceId: string;
  snapshotId: string | null;
  cardId: string | null;
  feedbackQueueId: string | null;
  policyProposalId: string | null;
  exportId: string | null;
  eventType: AgentPmoGovernanceDashboardEventType;
  message: string | null;
  eventPayload: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export type CreateGovernanceDashboardSnapshotInput = {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  createdBy?: string | null;
};

export type CreatePmoPolicyProposalInput = {
  workspaceId: string;
  proposalType: AgentPmoPolicyProposalType;
  proposalCategory: string;
  sourceFeedbackIds?: string[];
  sourceSignalIds?: string[];
  proposedChangeSummary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  createdBy?: string | null;
};

export type ReviewPmoPolicyProposalInput = {
  workspaceId: string;
  proposalId: string;
  decision: AgentPmoPolicyProposalDecision;
  reviewRationale: string;
  reviewedBy?: string | null;
};

export type GenerateGovernanceReportExportInput = {
  workspaceId: string;
  snapshotId?: string | null;
  periodStart: string;
  periodEnd: string;
  exportFormat: AgentPmoGovernanceReportExportFormat;
  generatedBy?: string | null;
};
