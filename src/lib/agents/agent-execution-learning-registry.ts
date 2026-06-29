// ─── Controlled Execution Learning Signals & Governance Feedback Loop — Registry
// Pure in-memory store. Does not use Supabase.
// Events are append-only. Records are not hard-deleted.
// Privacy filters are append-only.
// Governance feedback does not mutate policies.

import { randomUUID } from "node:crypto";
import { redactLearningSignalPayload } from "./agent-execution-learning-validation";
import type {
  AgentExecutionLearningSignalRecord,
  AgentExecutionLearningExtractionRecord,
  AgentExecutionLearningPrivacyFilterRecord,
  AgentExecutionGovernanceFeedbackRecord,
  AgentExecutionRiskCalibrationSignalRecord,
  AgentExecutionEvidenceQualitySignalRecord,
  AgentExecutionAdapterPerformanceSignalRecord,
  AgentExecutionReviewDecisionPatternRecord,
  AgentExecutionReviewRoutingFeedbackRecord,
  AgentExecutionWorkspaceLearningSummaryRecord,
  AgentExecutionAggregateLearningSignalRecord,
  AgentExecutionLearningEventRecord,
  AgentExecutionLearningSignalStatus,
  AgentExecutionGovernanceFeedbackStatus,
  AgentExecutionLearningExtractionStatus,
  AgentExecutionLearningEventType,
  AgentExecutionLearningSourceType,
  CreateAgentExecutionLearningSignalInput,
  AgentExecutionLearningSignalListFilters,
} from "./agent-execution-learning-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const signalStore = new Map<string, AgentExecutionLearningSignalRecord>();
const extractionStore = new Map<string, AgentExecutionLearningExtractionRecord>();
const privacyFilterStore: AgentExecutionLearningPrivacyFilterRecord[] = [];
const governanceFeedbackStore = new Map<string, AgentExecutionGovernanceFeedbackRecord>();
const riskCalibrationStore = new Map<string, AgentExecutionRiskCalibrationSignalRecord>();
const evidenceQualityStore = new Map<string, AgentExecutionEvidenceQualitySignalRecord>();
const adapterPerformanceStore = new Map<string, AgentExecutionAdapterPerformanceSignalRecord>();
const reviewDecisionPatternStore = new Map<string, AgentExecutionReviewDecisionPatternRecord>();
const reviewRoutingFeedbackStore = new Map<string, AgentExecutionReviewRoutingFeedbackRecord>();
const workspaceLearningSummaryStore = new Map<string, AgentExecutionWorkspaceLearningSummaryRecord>();
const aggregateSignalStore = new Map<string, AgentExecutionAggregateLearningSignalRecord>();
const learningEventStore: AgentExecutionLearningEventRecord[] = [];

export function _clearLearningStores(): void {
  signalStore.clear();
  extractionStore.clear();
  privacyFilterStore.length = 0;
  governanceFeedbackStore.clear();
  riskCalibrationStore.clear();
  evidenceQualityStore.clear();
  adapterPerformanceStore.clear();
  reviewDecisionPatternStore.clear();
  reviewRoutingFeedbackStore.clear();
  workspaceLearningSummaryStore.clear();
  aggregateSignalStore.clear();
  learningEventStore.length = 0;
}

// ─── Learning Signal CRUD ─────────────────────────────────────────────────────

export async function createAgentExecutionLearningSignal(
  input: CreateAgentExecutionLearningSignalInput & {
    privacyClassification: import("./agent-execution-learning-types").AgentExecutionLearningPrivacyClassification;
    retentionClass: import("./agent-execution-learning-types").AgentExecutionLearningRetentionClass;
    safeSignalPayload: Record<string, unknown> | null;
  },
): Promise<AgentExecutionLearningSignalRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionLearningSignalRecord = {
    id,
    workspaceId: input.workspaceId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    outcomeId: input.outcomeId ?? null,
    reviewId: input.reviewId ?? null,
    decisionId: input.decisionId ?? null,
    dispatchAttemptId: input.dispatchAttemptId ?? null,
    adapterKey: input.adapterKey ?? null,
    toolKey: input.toolKey ?? null,
    actionType: input.actionType ?? null,
    signalType: input.signalType,
    signalCategory: input.signalCategory,
    signalValue: input.signalValue,
    signalWeight: input.signalWeight ?? 50,
    confidenceScore: input.confidenceScore ?? 40,
    privacyClassification: input.privacyClassification,
    retentionClass: input.retentionClass,
    status: "active",
    signalPayload: null, // Never store raw payload
    safeSignalPayload: input.safeSignalPayload,
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  signalStore.set(id, record);
  return record;
}

export async function getAgentExecutionLearningSignalById(
  workspaceId: string,
  signalId: string,
): Promise<AgentExecutionLearningSignalRecord | null> {
  const record = signalStore.get(signalId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

export async function listAgentExecutionLearningSignals(
  workspaceId: string,
  filters: AgentExecutionLearningSignalListFilters = {},
): Promise<AgentExecutionLearningSignalRecord[]> {
  let results = [...signalStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  if (filters.signalType) results = results.filter((r) => r.signalType === filters.signalType);
  if (filters.signalCategory) results = results.filter((r) => r.signalCategory === filters.signalCategory);
  if (filters.sourceType) results = results.filter((r) => r.sourceType === filters.sourceType);
  if (filters.outcomeId) results = results.filter((r) => r.outcomeId === filters.outcomeId);
  if (filters.adapterKey) results = results.filter((r) => r.adapterKey === filters.adapterKey);
  if (filters.actionType) results = results.filter((r) => r.actionType === filters.actionType);
  if (filters.privacyClassification) results = results.filter((r) => r.privacyClassification === filters.privacyClassification);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentExecutionLearningSignalStatus(
  workspaceId: string,
  signalId: string,
  status: AgentExecutionLearningSignalStatus,
): Promise<AgentExecutionLearningSignalRecord | null> {
  const record = signalStore.get(signalId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = { ...record, status, updatedAt: new Date().toISOString() };
  signalStore.set(signalId, updated);
  return updated;
}

// ─── Learning Extraction ──────────────────────────────────────────────────────

export async function createAgentExecutionLearningExtraction(input: {
  workspaceId: string;
  sourceType: AgentExecutionLearningSourceType;
  sourceId: string;
  createdBy?: string | null;
}): Promise<AgentExecutionLearningExtractionRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionLearningExtractionRecord = {
    id,
    workspaceId: input.workspaceId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    status: "created",
    signalsExtracted: 0,
    signalsSkipped: 0,
    privacyPassed: 0,
    privacyBlocked: 0,
    blockingReasons: [],
    warnings: [],
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  extractionStore.set(id, record);
  return record;
}

export async function updateAgentExecutionLearningExtraction(
  extractionId: string,
  updates: Partial<Pick<AgentExecutionLearningExtractionRecord,
    "status" | "signalsExtracted" | "signalsSkipped" | "privacyPassed" | "privacyBlocked" | "blockingReasons" | "warnings"
  >>,
): Promise<AgentExecutionLearningExtractionRecord | null> {
  const record = extractionStore.get(extractionId);
  if (!record) return null;
  const updated = { ...record, ...updates, updatedAt: new Date().toISOString() };
  extractionStore.set(extractionId, updated);
  return updated;
}

// ─── Privacy Filter ───────────────────────────────────────────────────────────

export async function createAgentExecutionLearningPrivacyFilter(input: {
  workspaceId: string;
  sourceType: AgentExecutionLearningSourceType;
  sourceId: string;
  candidateSignalType: import("./agent-execution-learning-types").AgentExecutionLearningSignalType;
  containsRawPayload: boolean;
  containsFreeText: boolean;
  containsSensitiveKey: boolean;
  containsCustomerIdentifier: boolean;
  containsProjectIdentifier: boolean;
  safeToStore: boolean;
  redactionApplied: boolean;
  privacyClassification: import("./agent-execution-learning-types").AgentExecutionLearningPrivacyClassification;
  retentionClass: import("./agent-execution-learning-types").AgentExecutionLearningRetentionClass;
  filterReasons: string[];
}): Promise<AgentExecutionLearningPrivacyFilterRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionLearningPrivacyFilterRecord = {
    id,
    ...input,
    createdAt: now,
  };
  privacyFilterStore.push(record);
  return record;
}

// ─── Governance Feedback ──────────────────────────────────────────────────────

export async function createAgentExecutionGovernanceFeedback(input: {
  workspaceId: string;
  feedbackType: import("./agent-execution-learning-types").AgentExecutionGovernanceFeedbackType;
  feedbackCategory: import("./agent-execution-learning-types").AgentExecutionLearningSignalCategory;
  severity: import("./agent-execution-learning-types").AgentExecutionGovernanceFeedbackSeverity;
  recommendation: string;
  confidenceScore: number;
  sourceSignalIds: string[];
  ownerRole?: string | null;
}): Promise<AgentExecutionGovernanceFeedbackRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionGovernanceFeedbackRecord = {
    id,
    workspaceId: input.workspaceId,
    feedbackType: input.feedbackType,
    feedbackCategory: input.feedbackCategory,
    severity: input.severity,
    status: "created",
    recommendation: input.recommendation,
    confidenceScore: input.confidenceScore,
    sourceSignalIds: input.sourceSignalIds,
    ownerRole: input.ownerRole ?? null,
    reviewedBy: null,
    reviewedAt: null,
    reviewRationale: null,
    createdAt: now,
    updatedAt: now,
  };
  governanceFeedbackStore.set(id, record);
  return record;
}

export async function updateAgentExecutionGovernanceFeedbackStatus(
  workspaceId: string,
  feedbackId: string,
  status: AgentExecutionGovernanceFeedbackStatus,
  reviewedBy?: string | null,
): Promise<AgentExecutionGovernanceFeedbackRecord | null> {
  const record = governanceFeedbackStore.get(feedbackId);
  if (!record || record.workspaceId !== workspaceId) return null;
  const updated = {
    ...record,
    status,
    reviewedBy: reviewedBy ?? record.reviewedBy,
    reviewedAt: reviewedBy ? new Date().toISOString() : record.reviewedAt,
    updatedAt: new Date().toISOString(),
  };
  governanceFeedbackStore.set(feedbackId, updated);
  return updated;
}

export async function listAgentExecutionGovernanceFeedback(
  workspaceId: string,
  filters: { status?: AgentExecutionGovernanceFeedbackStatus; limit?: number } = {},
): Promise<AgentExecutionGovernanceFeedbackRecord[]> {
  let results = [...governanceFeedbackStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters.status) results = results.filter((r) => r.status === filters.status);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function getAgentExecutionGovernanceFeedbackById(
  workspaceId: string,
  feedbackId: string,
): Promise<AgentExecutionGovernanceFeedbackRecord | null> {
  const record = governanceFeedbackStore.get(feedbackId);
  if (!record || record.workspaceId !== workspaceId) return null;
  return record;
}

// ─── Risk Calibration Signal ──────────────────────────────────────────────────

export async function createAgentExecutionRiskCalibrationSignal(input: {
  workspaceId: string;
  sourceSignalId?: string | null;
  outcomeId?: string | null;
  actionType?: string | null;
  adapterKey?: string | null;
  originalRiskLevel?: "low" | "medium" | "high" | "critical" | null;
  observedRiskLevel?: "low" | "medium" | "high" | "critical" | null;
  humanDecisionType?: string | null;
  calibrationDirection: import("./agent-execution-learning-types").AgentExecutionRiskCalibrationDirection;
  confidenceScore: number;
}): Promise<AgentExecutionRiskCalibrationSignalRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionRiskCalibrationSignalRecord = {
    id,
    workspaceId: input.workspaceId,
    sourceSignalId: input.sourceSignalId ?? null,
    outcomeId: input.outcomeId ?? null,
    actionType: input.actionType ?? null,
    adapterKey: input.adapterKey ?? null,
    originalRiskLevel: input.originalRiskLevel ?? null,
    observedRiskLevel: input.observedRiskLevel ?? null,
    humanDecisionType: input.humanDecisionType ?? null,
    calibrationDirection: input.calibrationDirection,
    confidenceScore: input.confidenceScore,
    createdAt: now,
  };
  riskCalibrationStore.set(id, record);
  return record;
}

// ─── Evidence Quality Signal ──────────────────────────────────────────────────

export async function createAgentExecutionEvidenceQualitySignal(input: {
  workspaceId: string;
  sourceSignalId?: string | null;
  actionType?: string | null;
  adapterKey?: string | null;
  requiredEvidenceType?: string | null;
  availableEvidenceType?: string | null;
  missingEvidenceType?: string | null;
  evidenceCompletenessLevel?: string | null;
  frequency: number;
  trendDirection: import("./agent-execution-learning-types").AgentExecutionTrendDirection;
}): Promise<AgentExecutionEvidenceQualitySignalRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionEvidenceQualitySignalRecord = {
    id,
    workspaceId: input.workspaceId,
    sourceSignalId: input.sourceSignalId ?? null,
    actionType: input.actionType ?? null,
    adapterKey: input.adapterKey ?? null,
    requiredEvidenceType: input.requiredEvidenceType ?? null,
    availableEvidenceType: input.availableEvidenceType ?? null,
    missingEvidenceType: input.missingEvidenceType ?? null,
    evidenceCompletenessLevel: input.evidenceCompletenessLevel ?? null,
    frequency: input.frequency,
    trendDirection: input.trendDirection,
    createdAt: now,
  };
  evidenceQualityStore.set(id, record);
  return record;
}

// ─── Adapter Performance Signal ───────────────────────────────────────────────

export async function createAgentExecutionAdapterPerformanceSignal(input: {
  workspaceId: string;
  adapterKey: string;
  toolKey?: string | null;
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
  trendDirection: import("./agent-execution-learning-types").AgentExecutionTrendDirection;
}): Promise<AgentExecutionAdapterPerformanceSignalRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionAdapterPerformanceSignalRecord = {
    id,
    workspaceId: input.workspaceId,
    adapterKey: input.adapterKey,
    toolKey: input.toolKey ?? null,
    successCount: input.successCount,
    failureCount: input.failureCount,
    missingEvidenceCount: input.missingEvidenceCount,
    correctionCount: input.correctionCount,
    retryRecommendationCount: input.retryRecommendationCount,
    humanAcceptanceCount: input.humanAcceptanceCount,
    humanRejectionCount: input.humanRejectionCount,
    lowConfidenceCount: input.lowConfidenceCount,
    mediumConfidenceCount: input.mediumConfidenceCount,
    highConfidenceCount: input.highConfidenceCount,
    trendDirection: input.trendDirection,
    createdAt: now,
  };
  adapterPerformanceStore.set(id, record);
  return record;
}

// ─── Review Decision Pattern ──────────────────────────────────────────────────

export async function createAgentExecutionReviewDecisionPattern(input: {
  workspaceId: string;
  decisionType: string;
  reviewRequirement?: string | null;
  riskLevel?: string | null;
  actionType?: string | null;
  adapterKey?: string | null;
  confidenceLevel?: string | null;
  evidenceCompletenessLevel?: string | null;
  count: number;
  trendDirection: import("./agent-execution-learning-types").AgentExecutionTrendDirection;
}): Promise<AgentExecutionReviewDecisionPatternRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionReviewDecisionPatternRecord = {
    id,
    workspaceId: input.workspaceId,
    decisionType: input.decisionType,
    reviewRequirement: input.reviewRequirement ?? null,
    riskLevel: input.riskLevel ?? null,
    actionType: input.actionType ?? null,
    adapterKey: input.adapterKey ?? null,
    confidenceLevel: input.confidenceLevel ?? null,
    evidenceCompletenessLevel: input.evidenceCompletenessLevel ?? null,
    count: input.count,
    trendDirection: input.trendDirection,
    createdAt: now,
  };
  reviewDecisionPatternStore.set(id, record);
  return record;
}

// ─── Review Routing Feedback ──────────────────────────────────────────────────

export async function createAgentExecutionReviewRoutingFeedback(input: {
  workspaceId: string;
  assignedRole?: string | null;
  assignedTo?: string | null;
  reviewPriority?: string | null;
  decisionType?: string | null;
  routeEffectiveness: import("./agent-execution-learning-types").AgentExecutionRouteEffectiveness;
  suggestedRouteAdjustment?: string | null;
}): Promise<AgentExecutionReviewRoutingFeedbackRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionReviewRoutingFeedbackRecord = {
    id,
    workspaceId: input.workspaceId,
    assignedRole: input.assignedRole ?? null,
    assignedTo: input.assignedTo ?? null,
    reviewPriority: input.reviewPriority ?? null,
    decisionType: input.decisionType ?? null,
    routeEffectiveness: input.routeEffectiveness,
    suggestedRouteAdjustment: input.suggestedRouteAdjustment ?? null,
    createdAt: now,
  };
  reviewRoutingFeedbackStore.set(id, record);
  return record;
}

// ─── Workspace Learning Summary ───────────────────────────────────────────────

export async function createAgentExecutionWorkspaceLearningSummary(input: {
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
}): Promise<AgentExecutionWorkspaceLearningSummaryRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionWorkspaceLearningSummaryRecord = {
    id,
    ...input,
    createdAt: now,
  };
  workspaceLearningSummaryStore.set(id, record);
  return record;
}

// ─── Aggregate Learning Signal ────────────────────────────────────────────────

export async function createAgentExecutionAggregateLearningSignal(input: {
  aggregateScope: "workspace" | "global_disabled";
  workspaceId?: string | null;
  signalType: import("./agent-execution-learning-types").AgentExecutionLearningSignalType;
  signalCategory: import("./agent-execution-learning-types").AgentExecutionLearningSignalCategory;
  count: number;
  thresholdMet: boolean;
  privacySafe: boolean;
}): Promise<AgentExecutionAggregateLearningSignalRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionAggregateLearningSignalRecord = {
    id,
    aggregateScope: input.aggregateScope,
    workspaceId: input.workspaceId ?? null,
    signalType: input.signalType,
    signalCategory: input.signalCategory,
    count: input.count,
    thresholdMet: input.thresholdMet,
    privacySafe: input.privacySafe,
    createdAt: now,
  };
  aggregateSignalStore.set(id, record);
  return record;
}

// ─── Learning Events ──────────────────────────────────────────────────────────

export async function recordAgentExecutionLearningEvent(input: {
  workspaceId?: string | null;
  signalId?: string | null;
  extractionId?: string | null;
  feedbackId?: string | null;
  sourceType?: AgentExecutionLearningSourceType | null;
  sourceId?: string | null;
  eventType: AgentExecutionLearningEventType;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
  actorId?: string | null;
}): Promise<AgentExecutionLearningEventRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionLearningEventRecord = {
    id,
    workspaceId: input.workspaceId ?? null,
    signalId: input.signalId ?? null,
    extractionId: input.extractionId ?? null,
    feedbackId: input.feedbackId ?? null,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    eventPayload: input.eventPayload ?? null,
    actorId: input.actorId ?? null,
    createdAt: now,
  };
  learningEventStore.push(record);
  return record;
}

export async function listAgentExecutionLearningEvents(
  workspaceId: string,
  filters: { signalId?: string; extractionId?: string; feedbackId?: string; limit?: number } = {},
): Promise<AgentExecutionLearningEventRecord[]> {
  let results = learningEventStore.filter((e) => e.workspaceId === workspaceId);
  if (filters.signalId) results = results.filter((e) => e.signalId === filters.signalId);
  if (filters.extractionId) results = results.filter((e) => e.extractionId === filters.extractionId);
  if (filters.feedbackId) results = results.filter((e) => e.feedbackId === filters.feedbackId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters.limit) results = results.slice(0, filters.limit);
  return results;
}
