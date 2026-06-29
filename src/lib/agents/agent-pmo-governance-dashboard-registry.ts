// ─── Controlled PMO Governance Intelligence Dashboard — Registry ──────────────
// Pure in-memory store. Does not use Supabase.
// Snapshots are append-only. Events are append-only.
// Reports are not hard-deleted. Proposals are not applied automatically.

import { randomUUID } from "node:crypto";
import type {
  AgentPmoGovernanceDashboardSnapshotRecord,
  AgentPmoGovernanceInsightCardRecord,
  AgentPmoRiskCalibrationInsightRecord,
  AgentPmoEvidenceQualityInsightRecord,
  AgentPmoAdapterPerformanceInsightRecord,
  AgentPmoReviewRoutingInsightRecord,
  AgentPmoGovernanceFeedbackQueueRecord,
  AgentPmoPolicyProposalRecord,
  AgentPmoGovernanceReportExportRecord,
  AgentPmoGovernanceDashboardEventRecord,
  AgentPmoGovernanceFeedbackQueueStatus,
  AgentPmoPolicyProposalDecision,
  AgentPmoPolicyProposalStatus,
  AgentPmoGovernanceDashboardEventType,
  AgentPmoGovernanceInsightStatus,
} from "./agent-pmo-governance-dashboard-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const snapshotStore: AgentPmoGovernanceDashboardSnapshotRecord[] = [];
const insightCardStore = new Map<string, AgentPmoGovernanceInsightCardRecord>();
const riskCalibrationInsightStore = new Map<string, AgentPmoRiskCalibrationInsightRecord>();
const evidenceQualityInsightStore = new Map<string, AgentPmoEvidenceQualityInsightRecord>();
const adapterPerformanceInsightStore = new Map<string, AgentPmoAdapterPerformanceInsightRecord>();
const reviewRoutingInsightStore = new Map<string, AgentPmoReviewRoutingInsightRecord>();
const feedbackQueueStore = new Map<string, AgentPmoGovernanceFeedbackQueueRecord>();
const policyProposalStore = new Map<string, AgentPmoPolicyProposalRecord>();
const reportExportStore = new Map<string, AgentPmoGovernanceReportExportRecord>();
const dashboardEventStore: AgentPmoGovernanceDashboardEventRecord[] = [];

export function _clearDashboardStores(): void {
  snapshotStore.length = 0;
  insightCardStore.clear();
  riskCalibrationInsightStore.clear();
  evidenceQualityInsightStore.clear();
  adapterPerformanceInsightStore.clear();
  reviewRoutingInsightStore.clear();
  feedbackQueueStore.clear();
  policyProposalStore.clear();
  reportExportStore.clear();
  dashboardEventStore.length = 0;
}

// ─── Snapshots (append-only) ──────────────────────────────────────────────────

export async function createGovernanceDashboardSnapshot(input: {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  totalLearningSignals?: number;
  activeLearningSignals?: number;
  privacyBlockedSignals?: number;
  openGovernanceFeedback?: number;
  riskCalibrationCount?: number;
  evidenceQualityIssueCount?: number;
  adapterQualityIssueCount?: number;
  reviewRoutingIssueCount?: number;
  policyProposalCount?: number;
  topCardsJson?: Record<string, unknown>;
  safeSnapshotPayload?: Record<string, unknown> | null;
  createdBy?: string | null;
}): Promise<AgentPmoGovernanceDashboardSnapshotRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoGovernanceDashboardSnapshotRecord = {
    id,
    workspaceId: input.workspaceId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: "active",
    totalLearningSignals: input.totalLearningSignals ?? 0,
    activeLearningSignals: input.activeLearningSignals ?? 0,
    privacyBlockedSignals: input.privacyBlockedSignals ?? 0,
    openGovernanceFeedback: input.openGovernanceFeedback ?? 0,
    riskCalibrationCount: input.riskCalibrationCount ?? 0,
    evidenceQualityIssueCount: input.evidenceQualityIssueCount ?? 0,
    adapterQualityIssueCount: input.adapterQualityIssueCount ?? 0,
    reviewRoutingIssueCount: input.reviewRoutingIssueCount ?? 0,
    policyProposalCount: input.policyProposalCount ?? 0,
    topCardsJson: input.topCardsJson ?? {},
    safeSnapshotPayload: input.safeSnapshotPayload ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  snapshotStore.push(record);
  return record;
}

export async function listGovernanceDashboardSnapshots(
  workspaceId: string,
  filters: { status?: string; limit?: number } = {},
): Promise<AgentPmoGovernanceDashboardSnapshotRecord[]> {
  let results = snapshotStore.filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results = [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function getGovernanceDashboardSnapshotById(
  workspaceId: string,
  snapshotId: string,
): Promise<AgentPmoGovernanceDashboardSnapshotRecord | null> {
  return snapshotStore.find((r) => r.id === snapshotId && r.workspaceId === workspaceId) ?? null;
}

// ─── Insight Cards ────────────────────────────────────────────────────────────

export async function createGovernanceInsightCard(input: {
  workspaceId: string;
  snapshotId?: string | null;
  cardType: AgentPmoGovernanceInsightCardRecord["cardType"];
  title: string;
  severity: AgentPmoGovernanceInsightCardRecord["severity"];
  status?: AgentPmoGovernanceInsightStatus;
  summary: string;
  metricValue?: number | null;
  trendDirection?: AgentPmoGovernanceInsightCardRecord["trendDirection"];
  actionability?: AgentPmoGovernanceInsightCardRecord["actionability"];
  sourceSignalIds?: string[];
  sourceFeedbackIds?: string[];
  sourceLearningSummaryId?: string | null;
  safeCardPayload?: Record<string, unknown> | null;
  createdBy?: string | null;
}): Promise<AgentPmoGovernanceInsightCardRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoGovernanceInsightCardRecord = {
    id,
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    cardType: input.cardType,
    title: input.title,
    severity: input.severity,
    status: input.status ?? "created",
    summary: input.summary,
    metricValue: input.metricValue ?? null,
    trendDirection: input.trendDirection ?? "insufficient_data",
    actionability: input.actionability ?? "informational",
    sourceSignalIds: input.sourceSignalIds ?? [],
    sourceFeedbackIds: input.sourceFeedbackIds ?? [],
    sourceLearningSummaryId: input.sourceLearningSummaryId ?? null,
    safeCardPayload: input.safeCardPayload ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  insightCardStore.set(id, record);
  return record;
}

export async function getGovernanceInsightCardById(
  workspaceId: string,
  cardId: string,
): Promise<AgentPmoGovernanceInsightCardRecord | null> {
  const record = insightCardStore.get(cardId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listGovernanceInsightCards(
  workspaceId: string,
  filters: { cardType?: string; severity?: string; status?: string; limit?: number } = {},
): Promise<AgentPmoGovernanceInsightCardRecord[]> {
  let results = [...insightCardStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.cardType) results = results.filter((r) => r.cardType === filters.cardType);
  if (filters.severity) results = results.filter((r) => r.severity === filters.severity);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateGovernanceInsightCardStatus(
  workspaceId: string,
  cardId: string,
  status: AgentPmoGovernanceInsightStatus,
): Promise<AgentPmoGovernanceInsightCardRecord | null> {
  const record = insightCardStore.get(cardId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  insightCardStore.set(cardId, updated);
  return updated;
}

// ─── Risk Calibration Insights ────────────────────────────────────────────────

export async function createRiskCalibrationInsight(input: {
  workspaceId: string;
  snapshotId?: string | null;
  underestimatedCount?: number;
  overestimatedCount?: number;
  alignedCount?: number;
  unknownCount?: number;
  topActionTypes?: string[];
  topAdapterKeys?: string[];
  recommendedReviewPosture?: AgentPmoRiskCalibrationInsightRecord["recommendedReviewPosture"];
  confidenceScore?: number;
}): Promise<AgentPmoRiskCalibrationInsightRecord> {
  const id = randomUUID();
  const record: AgentPmoRiskCalibrationInsightRecord = {
    id,
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    underestimatedCount: input.underestimatedCount ?? 0,
    overestimatedCount: input.overestimatedCount ?? 0,
    alignedCount: input.alignedCount ?? 0,
    unknownCount: input.unknownCount ?? 0,
    topActionTypes: input.topActionTypes ?? [],
    topAdapterKeys: input.topAdapterKeys ?? [],
    recommendedReviewPosture: input.recommendedReviewPosture ?? "maintain",
    confidenceScore: input.confidenceScore ?? 0,
    createdAt: new Date().toISOString(),
  };
  riskCalibrationInsightStore.set(id, record);
  return record;
}

export async function listRiskCalibrationInsights(
  workspaceId: string,
  filters: { limit?: number } = {},
): Promise<AgentPmoRiskCalibrationInsightRecord[]> {
  let results = [...riskCalibrationInsightStore.values()].filter((r) => r.workspaceId === workspaceId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

// ─── Evidence Quality Insights ────────────────────────────────────────────────

export async function createEvidenceQualityInsight(input: {
  workspaceId: string;
  snapshotId?: string | null;
  missingEvidenceCount?: number;
  topMissingEvidenceTypes?: string[];
  affectedActionTypes?: string[];
  affectedAdapterKeys?: string[];
  completenessDistribution?: Record<string, number>;
  recommendedEvidencePosture?: AgentPmoEvidenceQualityInsightRecord["recommendedEvidencePosture"];
  confidenceScore?: number;
}): Promise<AgentPmoEvidenceQualityInsightRecord> {
  const id = randomUUID();
  const record: AgentPmoEvidenceQualityInsightRecord = {
    id,
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    missingEvidenceCount: input.missingEvidenceCount ?? 0,
    topMissingEvidenceTypes: input.topMissingEvidenceTypes ?? [],
    affectedActionTypes: input.affectedActionTypes ?? [],
    affectedAdapterKeys: input.affectedAdapterKeys ?? [],
    completenessDistribution: input.completenessDistribution ?? {},
    recommendedEvidencePosture: input.recommendedEvidencePosture ?? "maintain",
    confidenceScore: input.confidenceScore ?? 0,
    createdAt: new Date().toISOString(),
  };
  evidenceQualityInsightStore.set(id, record);
  return record;
}

export async function listEvidenceQualityInsights(
  workspaceId: string,
  filters: { limit?: number } = {},
): Promise<AgentPmoEvidenceQualityInsightRecord[]> {
  let results = [...evidenceQualityInsightStore.values()].filter((r) => r.workspaceId === workspaceId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

// ─── Adapter Performance Insights ─────────────────────────────────────────────

export async function createAdapterPerformanceInsight(input: {
  workspaceId: string;
  snapshotId?: string | null;
  adapterKey: string;
  toolKey?: string | null;
  successCount?: number;
  failureCount?: number;
  missingEvidenceCount?: number;
  correctionCount?: number;
  retryRecommendationCount?: number;
  humanAcceptanceCount?: number;
  humanRejectionCount?: number;
  lowConfidenceCount?: number;
  mediumConfidenceCount?: number;
  highConfidenceCount?: number;
  trendDirection?: AgentPmoAdapterPerformanceInsightRecord["trendDirection"];
}): Promise<AgentPmoAdapterPerformanceInsightRecord> {
  const id = randomUUID();
  const record: AgentPmoAdapterPerformanceInsightRecord = {
    id,
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    adapterKey: input.adapterKey,
    toolKey: input.toolKey ?? null,
    successCount: input.successCount ?? 0,
    failureCount: input.failureCount ?? 0,
    missingEvidenceCount: input.missingEvidenceCount ?? 0,
    correctionCount: input.correctionCount ?? 0,
    retryRecommendationCount: input.retryRecommendationCount ?? 0,
    humanAcceptanceCount: input.humanAcceptanceCount ?? 0,
    humanRejectionCount: input.humanRejectionCount ?? 0,
    lowConfidenceCount: input.lowConfidenceCount ?? 0,
    mediumConfidenceCount: input.mediumConfidenceCount ?? 0,
    highConfidenceCount: input.highConfidenceCount ?? 0,
    trendDirection: input.trendDirection ?? "insufficient_data",
    createdAt: new Date().toISOString(),
  };
  adapterPerformanceInsightStore.set(id, record);
  return record;
}

export async function listAdapterPerformanceInsights(
  workspaceId: string,
  filters: { adapterKey?: string; limit?: number } = {},
): Promise<AgentPmoAdapterPerformanceInsightRecord[]> {
  let results = [...adapterPerformanceInsightStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.adapterKey) results = results.filter((r) => r.adapterKey === filters.adapterKey);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

// ─── Review Routing Insights ──────────────────────────────────────────────────

export async function createReviewRoutingInsight(input: {
  workspaceId: string;
  snapshotId?: string | null;
  assignedRole?: string | null;
  routeEffectiveness?: AgentPmoReviewRoutingInsightRecord["routeEffectiveness"];
  reviewPriority?: string | null;
  decisionPattern?: string | null;
  suggestedRouteAdjustment?: string | null;
  confidenceScore?: number;
}): Promise<AgentPmoReviewRoutingInsightRecord> {
  const id = randomUUID();
  const record: AgentPmoReviewRoutingInsightRecord = {
    id,
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    assignedRole: input.assignedRole ?? null,
    routeEffectiveness: input.routeEffectiveness ?? "unknown",
    reviewPriority: input.reviewPriority ?? null,
    decisionPattern: input.decisionPattern ?? null,
    suggestedRouteAdjustment: input.suggestedRouteAdjustment ?? null,
    confidenceScore: input.confidenceScore ?? 0,
    createdAt: new Date().toISOString(),
  };
  reviewRoutingInsightStore.set(id, record);
  return record;
}

export async function listReviewRoutingInsights(
  workspaceId: string,
  filters: { limit?: number } = {},
): Promise<AgentPmoReviewRoutingInsightRecord[]> {
  let results = [...reviewRoutingInsightStore.values()].filter((r) => r.workspaceId === workspaceId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

// ─── Feedback Queue ───────────────────────────────────────────────────────────

export async function createFeedbackQueueItem(input: {
  workspaceId: string;
  feedbackId: string;
  feedbackType: string;
  feedbackCategory: string;
  severity: AgentPmoGovernanceFeedbackQueueRecord["severity"];
  status?: AgentPmoGovernanceFeedbackQueueStatus;
  recommendation: string;
  sourceSignalCount?: number;
  ownerRole?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewRationale?: string | null;
}): Promise<AgentPmoGovernanceFeedbackQueueRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoGovernanceFeedbackQueueRecord = {
    id,
    workspaceId: input.workspaceId,
    feedbackId: input.feedbackId,
    feedbackType: input.feedbackType,
    feedbackCategory: input.feedbackCategory,
    severity: input.severity,
    status: input.status ?? "open",
    recommendation: input.recommendation,
    sourceSignalCount: input.sourceSignalCount ?? 0,
    ownerRole: input.ownerRole ?? null,
    reviewedBy: input.reviewedBy ?? null,
    reviewedAt: input.reviewedAt ?? null,
    reviewRationale: input.reviewRationale ?? null,
    createdAt: now,
    updatedAt: now,
  };
  feedbackQueueStore.set(id, record);
  return record;
}

export async function getFeedbackQueueItemById(
  workspaceId: string,
  queueItemId: string,
): Promise<AgentPmoGovernanceFeedbackQueueRecord | null> {
  const record = feedbackQueueStore.get(queueItemId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listFeedbackQueueItems(
  workspaceId: string,
  filters: { status?: AgentPmoGovernanceFeedbackQueueStatus; limit?: number } = {},
): Promise<AgentPmoGovernanceFeedbackQueueRecord[]> {
  let results = [...feedbackQueueStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateFeedbackQueueItemStatus(
  workspaceId: string,
  queueItemId: string,
  status: AgentPmoGovernanceFeedbackQueueStatus,
  reviewedBy?: string | null,
  reviewRationale?: string | null,
): Promise<AgentPmoGovernanceFeedbackQueueRecord | null> {
  const record = feedbackQueueStore.get(queueItemId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated: AgentPmoGovernanceFeedbackQueueRecord = {
    ...record,
    status,
    reviewedBy: reviewedBy ?? record.reviewedBy,
    reviewedAt: reviewedBy ? new Date().toISOString() : record.reviewedAt,
    reviewRationale: reviewRationale ?? record.reviewRationale,
    updatedAt: new Date().toISOString(),
  };
  feedbackQueueStore.set(queueItemId, updated);
  return updated;
}

// ─── Policy Proposals ─────────────────────────────────────────────────────────

export async function createPolicyProposal(input: {
  workspaceId: string;
  proposalType: AgentPmoPolicyProposalRecord["proposalType"];
  proposalCategory: string;
  sourceFeedbackIds?: string[];
  sourceSignalIds?: string[];
  proposedChangeSummary: string;
  riskLevel?: AgentPmoPolicyProposalRecord["riskLevel"];
  status?: AgentPmoPolicyProposalStatus;
  createdBy?: string | null;
}): Promise<AgentPmoPolicyProposalRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoPolicyProposalRecord = {
    id,
    workspaceId: input.workspaceId,
    proposalType: input.proposalType,
    proposalCategory: input.proposalCategory,
    sourceFeedbackIds: input.sourceFeedbackIds ?? [],
    sourceSignalIds: input.sourceSignalIds ?? [],
    proposedChangeSummary: input.proposedChangeSummary,
    riskLevel: input.riskLevel ?? "medium",
    status: input.status ?? "created",
    reviewDecision: null,
    reviewRationale: null,
    reviewedBy: null,
    reviewedAt: null,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  policyProposalStore.set(id, record);
  return record;
}

export async function getPolicyProposalById(
  workspaceId: string,
  proposalId: string,
): Promise<AgentPmoPolicyProposalRecord | null> {
  const record = policyProposalStore.get(proposalId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listPolicyProposals(
  workspaceId: string,
  filters: {
    status?: AgentPmoPolicyProposalStatus;
    proposalType?: string;
    limit?: number;
  } = {},
): Promise<AgentPmoPolicyProposalRecord[]> {
  let results = [...policyProposalStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  if (filters.proposalType) results = results.filter((r) => r.proposalType === filters.proposalType);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function recordPolicyProposalReview(
  workspaceId: string,
  proposalId: string,
  decision: AgentPmoPolicyProposalDecision,
  reviewedBy?: string | null,
  reviewRationale?: string | null,
): Promise<AgentPmoPolicyProposalRecord | null> {
  const record = policyProposalStore.get(proposalId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const statusMap: Record<AgentPmoPolicyProposalDecision, AgentPmoPolicyProposalStatus> = {
    approve_for_future_implementation: "approved_for_future_implementation",
    reject: "rejected",
    archive: "archived",
    request_more_review: "under_review",
  };
  const updated: AgentPmoPolicyProposalRecord = {
    ...record,
    status: statusMap[decision],
    reviewDecision: decision,
    reviewedBy: reviewedBy ?? record.reviewedBy,
    reviewedAt: new Date().toISOString(),
    reviewRationale: reviewRationale ?? record.reviewRationale,
    updatedAt: new Date().toISOString(),
  };
  policyProposalStore.set(proposalId, updated);
  return updated;
}

// ─── Report Exports ───────────────────────────────────────────────────────────

export async function createReportExport(input: {
  workspaceId: string;
  snapshotId?: string | null;
  exportFormat: AgentPmoGovernanceReportExportRecord["exportFormat"];
  status?: AgentPmoGovernanceReportExportRecord["status"];
  periodStart: string;
  periodEnd: string;
  fileName: string;
  contentType: string;
  contentText?: string | null;
  contentJson?: Record<string, unknown> | null;
  safeExportPayload?: Record<string, unknown> | null;
  generatedBy?: string | null;
}): Promise<AgentPmoGovernanceReportExportRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentPmoGovernanceReportExportRecord = {
    id,
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    exportFormat: input.exportFormat,
    status: input.status ?? "created",
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    fileName: input.fileName,
    contentType: input.contentType,
    contentText: input.contentText ?? null,
    contentJson: input.contentJson ?? null,
    safeExportPayload: input.safeExportPayload ?? null,
    generatedBy: input.generatedBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  reportExportStore.set(id, record);
  return record;
}

export async function getReportExportById(
  workspaceId: string,
  exportId: string,
): Promise<AgentPmoGovernanceReportExportRecord | null> {
  const record = reportExportStore.get(exportId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listReportExports(
  workspaceId: string,
  filters: { status?: string; limit?: number } = {},
): Promise<AgentPmoGovernanceReportExportRecord[]> {
  let results = [...reportExportStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function incrementReportExportDownloadCount(
  workspaceId: string,
  exportId: string,
): Promise<AgentPmoGovernanceReportExportRecord | null> {
  const record = reportExportStore.get(exportId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated: AgentPmoGovernanceReportExportRecord = {
    ...record,
    status: "downloaded",
    updatedAt: new Date().toISOString(),
  };
  reportExportStore.set(exportId, updated);
  return updated;
}

// ─── Dashboard Events (append-only) ──────────────────────────────────────────

export async function recordDashboardEvent(input: {
  workspaceId?: string | null;
  snapshotId?: string | null;
  cardId?: string | null;
  feedbackQueueId?: string | null;
  policyProposalId?: string | null;
  exportId?: string | null;
  eventType: AgentPmoGovernanceDashboardEventType;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
  actorId?: string | null;
}): Promise<AgentPmoGovernanceDashboardEventRecord> {
  const id = randomUUID();
  const record: AgentPmoGovernanceDashboardEventRecord = {
    id,
    workspaceId: input.workspaceId ?? "",
    snapshotId: input.snapshotId ?? null,
    cardId: input.cardId ?? null,
    feedbackQueueId: input.feedbackQueueId ?? null,
    policyProposalId: input.policyProposalId ?? null,
    exportId: input.exportId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    eventPayload: input.eventPayload ?? null,
    actorId: input.actorId ?? null,
    createdAt: new Date().toISOString(),
  };
  dashboardEventStore.push(record);
  return record;
}

export async function listDashboardEvents(input: {
  workspaceId: string;
  eventType?: AgentPmoGovernanceDashboardEventType;
  limit?: number;
}): Promise<AgentPmoGovernanceDashboardEventRecord[]> {
  let results = dashboardEventStore.filter((e) => e.workspaceId === input.workspaceId);
  if (input.eventType) results = results.filter((e) => e.eventType === input.eventType);
  results = [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (input.limit) results = results.slice(0, input.limit);
  return results;
}
