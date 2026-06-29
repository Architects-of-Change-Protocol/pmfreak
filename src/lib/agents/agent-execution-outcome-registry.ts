// ─── Controlled Execution Result Reconciliation & Human Outcome Review — Registry
// Pure in-memory store. Does not use Supabase.
// Events are append-only. Records are not hard-deleted.

import { randomUUID } from "node:crypto";
import {
  dedupeOutcomeStrings,
  redactExecutionOutcomePayload,
} from "./agent-execution-outcome-validation";
import type {
  AgentExecutionOutcomeRecord,
  AgentExecutionOutcomeStatus,
  AgentExecutionOutcomeType,
  AgentExecutionOutcomeMatchStatus,
  AgentExecutionEvidenceCompletenessLevel,
  AgentExecutionOutcomeConfidenceLevel,
  AgentExecutionOutcomeReviewRequirement,
  AgentExecutionOutcomeReviewStatus,
  AgentExecutionOutcomeDecisionType,
  AgentExecutionFailureCategory,
  AgentExecutionCorrectionType,
  AgentExecutionCorrectionStatus,
  AgentExecutionOutcomeEventType,
  AgentExecutionOutcomeReconciliationRecord,
  AgentExecutionOutcomeComparisonRecord,
  AgentExecutionEvidenceCompletenessRecord,
  AgentExecutionOutcomeConfidenceRecord,
  AgentExecutionHumanOutcomeReviewRecord,
  AgentExecutionFailedDispatchTriageRecord,
  AgentExecutionCorrectionLoopRecord,
  AgentExecutionOutcomeEventRecord,
  CreateAgentExecutionOutcomeInput,
  AgentExecutionOutcomeListFilters,
} from "./agent-execution-outcome-types";

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

const outcomeStore = new Map<string, AgentExecutionOutcomeRecord>();
const reconciliationStore = new Map<string, AgentExecutionOutcomeReconciliationRecord>();
const comparisonStore = new Map<string, AgentExecutionOutcomeComparisonRecord>();
const evidenceCompletenessStore = new Map<string, AgentExecutionEvidenceCompletenessRecord>();
const confidenceStore = new Map<string, AgentExecutionOutcomeConfidenceRecord>();
const humanReviewStore = new Map<string, AgentExecutionHumanOutcomeReviewRecord>();
const triageStore = new Map<string, AgentExecutionFailedDispatchTriageRecord>();
const correctionLoopStore = new Map<string, AgentExecutionCorrectionLoopRecord>();
const eventStore = new Map<string, AgentExecutionOutcomeEventRecord[]>();

export function _clearOutcomeStores(): void {
  outcomeStore.clear();
  reconciliationStore.clear();
  comparisonStore.clear();
  evidenceCompletenessStore.clear();
  confidenceStore.clear();
  humanReviewStore.clear();
  triageStore.clear();
  correctionLoopStore.clear();
  eventStore.clear();
}

// ─── Outcome CRUD ─────────────────────────────────────────────────────────────

export async function createAgentExecutionOutcome(
  input: CreateAgentExecutionOutcomeInput,
): Promise<AgentExecutionOutcomeRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionOutcomeRecord = {
    id,
    workspaceId: input.workspaceId,
    executionRequestId: input.executionRequestId,
    finalizationId: input.finalizationId ?? null,
    dispatchAttemptId: input.dispatchAttemptId ?? null,
    dispatchGateId: input.dispatchGateId ?? null,
    adapterExecutionId: input.adapterExecutionId ?? null,
    resultId: input.resultId ?? null,
    status: "created",
    outcomeType: input.outcomeType ?? "noop",
    matchStatus: "undetermined",
    evidenceCompletenessLevel: "none",
    confidenceScore: 0,
    confidenceLevel: "low",
    reviewRequirement: "not_required",
    reviewStatus: "not_required",
    intendedOutcomeSummary: input.intendedOutcomeSummary ?? null,
    actualOutcomeSummary: input.actualOutcomeSummary ?? null,
    mismatchReasons: [],
    blockingReasons: [],
    warnings: [],
    outcomePayload: input.outcomePayload ?? null,
    safeOutcomePayload: redactExecutionOutcomePayload(input.outcomePayload ?? null),
    createdBy: input.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };
  outcomeStore.set(id, record);
  return record;
}

export async function getAgentExecutionOutcomeById(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionOutcomeRecord | null> {
  const r = outcomeStore.get(outcomeId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function getAgentExecutionOutcomeByExecutionRequestId(
  workspaceId: string,
  executionRequestId: string,
): Promise<AgentExecutionOutcomeRecord | null> {
  for (const r of outcomeStore.values()) {
    if (r.workspaceId === workspaceId && r.executionRequestId === executionRequestId) return r;
  }
  return null;
}

export async function listAgentExecutionOutcomes(
  workspaceId: string,
  filters?: AgentExecutionOutcomeListFilters,
): Promise<AgentExecutionOutcomeRecord[]> {
  let results = [...outcomeStore.values()].filter((r) => r.workspaceId === workspaceId);
  if (filters?.status) results = results.filter((r) => r.status === filters.status);
  if (filters?.outcomeType) results = results.filter((r) => r.outcomeType === filters.outcomeType);
  if (filters?.matchStatus) results = results.filter((r) => r.matchStatus === filters.matchStatus);
  if (filters?.confidenceLevel) results = results.filter((r) => r.confidenceLevel === filters.confidenceLevel);
  if (filters?.reviewStatus) results = results.filter((r) => r.reviewStatus === filters.reviewStatus);
  if (filters?.reviewRequirement) results = results.filter((r) => r.reviewRequirement === filters.reviewRequirement);
  if (filters?.executionRequestId) results = results.filter((r) => r.executionRequestId === filters.executionRequestId);
  if (filters?.finalizationId) results = results.filter((r) => r.finalizationId === filters.finalizationId);
  if (filters?.dispatchAttemptId) results = results.filter((r) => r.dispatchAttemptId === filters.dispatchAttemptId);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filters?.limit) results = results.slice(0, filters.limit);
  return results;
}

export async function updateAgentExecutionOutcomeStatus(input: {
  workspaceId: string;
  outcomeId: string;
  status: AgentExecutionOutcomeStatus;
  patch?: Partial<AgentExecutionOutcomeRecord>;
}): Promise<AgentExecutionOutcomeRecord> {
  const r = outcomeStore.get(input.outcomeId);
  if (!r || r.workspaceId !== input.workspaceId) throw new Error(`Outcome not found: ${input.outcomeId}`);
  const updated: AgentExecutionOutcomeRecord = {
    ...r,
    ...input.patch,
    status: input.status,
    mismatchReasons: dedupeOutcomeStrings(input.patch?.mismatchReasons ?? r.mismatchReasons),
    blockingReasons: dedupeOutcomeStrings(input.patch?.blockingReasons ?? r.blockingReasons),
    warnings: dedupeOutcomeStrings(input.patch?.warnings ?? r.warnings),
    updatedAt: new Date().toISOString(),
  };
  outcomeStore.set(input.outcomeId, updated);
  return updated;
}

// ─── Reconciliation CRUD ──────────────────────────────────────────────────────

export async function createAgentExecutionOutcomeReconciliation(input: {
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
  reconciliationPayload?: Record<string, unknown> | null;
}): Promise<AgentExecutionOutcomeReconciliationRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionOutcomeReconciliationRecord = {
    id,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: input.executionRequestId,
    finalizationId: input.finalizationId,
    dispatchAttemptId: input.dispatchAttemptId,
    dispatchSucceeded: input.dispatchSucceeded,
    adapterExecutionExists: input.adapterExecutionExists,
    resultExists: input.resultExists,
    evidenceCount: input.evidenceCount,
    lineageComplete: input.lineageComplete,
    reconciliationNotes: dedupeOutcomeStrings(input.reconciliationNotes),
    reconciliationPayload: input.reconciliationPayload ?? null,
    reconciledAt: now,
    createdAt: now,
  };
  reconciliationStore.set(id, record);
  return record;
}

export async function getAgentExecutionOutcomeReconciliationByOutcomeId(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionOutcomeReconciliationRecord | null> {
  for (const r of reconciliationStore.values()) {
    if (r.workspaceId === workspaceId && r.outcomeId === outcomeId) return r;
  }
  return null;
}

// ─── Comparison CRUD ──────────────────────────────────────────────────────────

export async function createAgentExecutionOutcomeComparison(input: {
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  matchStatus: AgentExecutionOutcomeMatchStatus;
  intendedOutcomeSummary: string | null;
  actualOutcomeSummary: string | null;
  mismatchReasons: string[];
  confidenceImpact: number;
  requiresCorrection: boolean;
}): Promise<AgentExecutionOutcomeComparisonRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionOutcomeComparisonRecord = {
    id,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: input.executionRequestId,
    matchStatus: input.matchStatus,
    intendedOutcomeSummary: input.intendedOutcomeSummary,
    actualOutcomeSummary: input.actualOutcomeSummary,
    mismatchReasons: dedupeOutcomeStrings(input.mismatchReasons),
    confidenceImpact: input.confidenceImpact,
    requiresCorrection: input.requiresCorrection,
    comparedAt: now,
    createdAt: now,
  };
  comparisonStore.set(id, record);
  return record;
}

export async function getAgentExecutionOutcomeComparisonByOutcomeId(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionOutcomeComparisonRecord | null> {
  for (const r of comparisonStore.values()) {
    if (r.workspaceId === workspaceId && r.outcomeId === outcomeId) return r;
  }
  return null;
}

// ─── Evidence Completeness CRUD ───────────────────────────────────────────────

export async function createAgentExecutionEvidenceCompleteness(input: {
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  completenessScore: number;
  level: AgentExecutionEvidenceCompletenessLevel;
  presentTypes: string[];
  missingTypes: string[];
  blockingGaps: string[];
  warnings: string[];
}): Promise<AgentExecutionEvidenceCompletenessRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionEvidenceCompletenessRecord = {
    id,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: input.executionRequestId,
    completenessScore: input.completenessScore,
    level: input.level,
    presentTypes: input.presentTypes,
    missingTypes: input.missingTypes,
    blockingGaps: input.blockingGaps,
    warnings: input.warnings,
    scoredAt: now,
    createdAt: now,
  };
  evidenceCompletenessStore.set(id, record);
  return record;
}

export async function getAgentExecutionEvidenceCompletenessByOutcomeId(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionEvidenceCompletenessRecord | null> {
  for (const r of evidenceCompletenessStore.values()) {
    if (r.workspaceId === workspaceId && r.outcomeId === outcomeId) return r;
  }
  return null;
}

// ─── Confidence CRUD ──────────────────────────────────────────────────────────

export async function createAgentExecutionOutcomeConfidence(input: {
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  confidenceScore: number;
  confidenceLevel: AgentExecutionOutcomeConfidenceLevel;
  confidenceReasons: string[];
}): Promise<AgentExecutionOutcomeConfidenceRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionOutcomeConfidenceRecord = {
    id,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: input.executionRequestId,
    confidenceScore: input.confidenceScore,
    confidenceLevel: input.confidenceLevel,
    confidenceReasons: input.confidenceReasons,
    scoredAt: now,
    createdAt: now,
  };
  confidenceStore.set(id, record);
  return record;
}

export async function getAgentExecutionOutcomeConfidenceByOutcomeId(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionOutcomeConfidenceRecord | null> {
  for (const r of confidenceStore.values()) {
    if (r.workspaceId === workspaceId && r.outcomeId === outcomeId) return r;
  }
  return null;
}

// ─── Human Review CRUD ────────────────────────────────────────────────────────

export async function createAgentExecutionHumanOutcomeReview(input: {
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  reviewRequirement: AgentExecutionOutcomeReviewRequirement;
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  summary: string | null;
  dueAt: string | null;
  createdBy: string | null;
}): Promise<AgentExecutionHumanOutcomeReviewRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionHumanOutcomeReviewRecord = {
    id,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: input.executionRequestId,
    reviewRequirement: input.reviewRequirement,
    reviewStatus: "pending",
    priority: input.priority,
    title: input.title,
    summary: input.summary,
    decidedBy: null,
    decisionType: null,
    decisionRationale: null,
    decidedAt: null,
    dueAt: input.dueAt,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  humanReviewStore.set(id, record);
  return record;
}

export async function getAgentExecutionHumanOutcomeReviewByOutcomeId(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionHumanOutcomeReviewRecord | null> {
  for (const r of humanReviewStore.values()) {
    if (r.workspaceId === workspaceId && r.outcomeId === outcomeId) return r;
  }
  return null;
}

export async function getAgentExecutionHumanOutcomeReviewById(
  workspaceId: string,
  reviewId: string,
): Promise<AgentExecutionHumanOutcomeReviewRecord | null> {
  const r = humanReviewStore.get(reviewId);
  if (!r || r.workspaceId !== workspaceId) return null;
  return r;
}

export async function updateAgentExecutionHumanOutcomeReviewStatus(input: {
  workspaceId: string;
  reviewId: string;
  reviewStatus: AgentExecutionOutcomeReviewStatus;
  decisionType?: AgentExecutionOutcomeDecisionType | null;
  decisionRationale?: string | null;
  decidedBy?: string | null;
}): Promise<AgentExecutionHumanOutcomeReviewRecord> {
  const r = humanReviewStore.get(input.reviewId);
  if (!r || r.workspaceId !== input.workspaceId) throw new Error(`Human review not found: ${input.reviewId}`);
  const now = new Date().toISOString();
  const updated: AgentExecutionHumanOutcomeReviewRecord = {
    ...r,
    reviewStatus: input.reviewStatus,
    decisionType: input.decisionType !== undefined ? input.decisionType : r.decisionType,
    decisionRationale: input.decisionRationale !== undefined ? input.decisionRationale : r.decisionRationale,
    decidedBy: input.decidedBy !== undefined ? input.decidedBy : r.decidedBy,
    decidedAt: input.decisionType ? now : r.decidedAt,
    updatedAt: now,
  };
  humanReviewStore.set(input.reviewId, updated);
  return updated;
}

// ─── Triage CRUD ──────────────────────────────────────────────────────────────

export async function createAgentExecutionFailedDispatchTriage(input: {
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
  triagePayload?: Record<string, unknown> | null;
}): Promise<AgentExecutionFailedDispatchTriageRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionFailedDispatchTriageRecord = {
    id,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: input.executionRequestId,
    finalizationId: input.finalizationId,
    dispatchAttemptId: input.dispatchAttemptId,
    failureCategory: input.failureCategory,
    failureMessage: input.failureMessage,
    blockingReasons: dedupeOutcomeStrings(input.blockingReasons),
    triageNotes: dedupeOutcomeStrings(input.triageNotes),
    recommendedCorrectionType: input.recommendedCorrectionType,
    triagePayload: input.triagePayload ?? null,
    triagedAt: now,
    createdAt: now,
  };
  triageStore.set(id, record);
  return record;
}

export async function getAgentExecutionFailedDispatchTriageByOutcomeId(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionFailedDispatchTriageRecord | null> {
  for (const r of triageStore.values()) {
    if (r.workspaceId === workspaceId && r.outcomeId === outcomeId) return r;
  }
  return null;
}

// ─── Correction Loop CRUD ─────────────────────────────────────────────────────

export async function createAgentExecutionCorrectionLoop(input: {
  workspaceId: string;
  outcomeId: string;
  executionRequestId: string;
  correctionType: AgentExecutionCorrectionType;
  correctionRationale: string | null;
  correctionPayload?: Record<string, unknown> | null;
}): Promise<AgentExecutionCorrectionLoopRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionCorrectionLoopRecord = {
    id,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: input.executionRequestId,
    correctionType: input.correctionType,
    correctionStatus: "created",
    correctionRationale: input.correctionRationale,
    appliedBy: null,
    appliedAt: null,
    correctionPayload: input.correctionPayload ?? null,
    createdAt: now,
    updatedAt: now,
  };
  correctionLoopStore.set(id, record);
  return record;
}

export async function updateAgentExecutionCorrectionLoopStatus(input: {
  workspaceId: string;
  correctionLoopId: string;
  correctionStatus: AgentExecutionCorrectionStatus;
  appliedBy?: string | null;
}): Promise<AgentExecutionCorrectionLoopRecord> {
  const r = correctionLoopStore.get(input.correctionLoopId);
  if (!r || r.workspaceId !== input.workspaceId) throw new Error(`Correction loop not found: ${input.correctionLoopId}`);
  const now = new Date().toISOString();
  const updated: AgentExecutionCorrectionLoopRecord = {
    ...r,
    correctionStatus: input.correctionStatus,
    appliedBy: input.appliedBy !== undefined ? input.appliedBy : r.appliedBy,
    appliedAt: input.correctionStatus === "applied" ? now : r.appliedAt,
    updatedAt: now,
  };
  correctionLoopStore.set(input.correctionLoopId, updated);
  return updated;
}

export async function getAgentExecutionCorrectionLoopByOutcomeId(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionCorrectionLoopRecord | null> {
  for (const r of correctionLoopStore.values()) {
    if (r.workspaceId === workspaceId && r.outcomeId === outcomeId) return r;
  }
  return null;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function recordAgentExecutionOutcomeEvent(input: {
  workspaceId: string;
  outcomeId: string | null;
  executionRequestId?: string | null;
  reconciliationId?: string | null;
  comparisonId?: string | null;
  humanReviewId?: string | null;
  correctionLoopId?: string | null;
  eventType: AgentExecutionOutcomeEventType;
  message?: string | null;
  eventPayload?: Record<string, unknown> | null;
  actorId?: string | null;
}): Promise<AgentExecutionOutcomeEventRecord> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentExecutionOutcomeEventRecord = {
    id,
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: input.executionRequestId ?? null,
    reconciliationId: input.reconciliationId ?? null,
    comparisonId: input.comparisonId ?? null,
    humanReviewId: input.humanReviewId ?? null,
    correctionLoopId: input.correctionLoopId ?? null,
    eventType: input.eventType,
    message: input.message ?? null,
    eventPayload: input.eventPayload ?? null,
    actorId: input.actorId ?? null,
    createdAt: now,
  };
  const key = input.outcomeId ?? "__global__";
  const existing = eventStore.get(key) ?? [];
  eventStore.set(key, [...existing, record]);
  return record;
}

export async function listAgentExecutionOutcomeEvents(
  workspaceId: string,
  outcomeId: string,
): Promise<AgentExecutionOutcomeEventRecord[]> {
  return (eventStore.get(outcomeId) ?? []).filter((e) => e.workspaceId === workspaceId);
}
