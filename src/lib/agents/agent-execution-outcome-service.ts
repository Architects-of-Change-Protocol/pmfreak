// ─── Controlled Execution Result Reconciliation & Human Outcome Review — Service
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT send emails, Slack messages, or create tickets.
// Does NOT mutate projects. Does NOT execute adapters.
// All operations are deterministic.

import {
  createAgentExecutionOutcome,
  getAgentExecutionOutcomeById,
  getAgentExecutionOutcomeByExecutionRequestId,
  listAgentExecutionOutcomes,
  updateAgentExecutionOutcomeStatus,
  createAgentExecutionOutcomeReconciliation,
  getAgentExecutionOutcomeReconciliationByOutcomeId,
  createAgentExecutionOutcomeComparison,
  getAgentExecutionOutcomeComparisonByOutcomeId,
  createAgentExecutionEvidenceCompleteness,
  getAgentExecutionEvidenceCompletenessByOutcomeId,
  createAgentExecutionOutcomeConfidence,
  getAgentExecutionOutcomeConfidenceByOutcomeId,
  createAgentExecutionHumanOutcomeReview,
  getAgentExecutionHumanOutcomeReviewByOutcomeId,
  getAgentExecutionHumanOutcomeReviewById,
  updateAgentExecutionHumanOutcomeReviewStatus,
  createAgentExecutionFailedDispatchTriage,
  getAgentExecutionFailedDispatchTriageByOutcomeId,
  createAgentExecutionCorrectionLoop,
  updateAgentExecutionCorrectionLoopStatus,
  getAgentExecutionCorrectionLoopByOutcomeId,
  recordAgentExecutionOutcomeEvent,
  listAgentExecutionOutcomeEvents,
} from "./agent-execution-outcome-registry";
import {
  normalizeCreateAgentExecutionOutcomeInput,
  normalizeReconcileDispatchOutcomeInput,
  normalizeCreateHumanOutcomeReviewInput,
  normalizeRecordHumanOutcomeDecisionInput,
  calculateEvidenceCompleteness,
  compareIntendedVsActualOutcome,
  calculateOutcomeConfidence,
  determineOutcomeReviewRequirement,
  redactExecutionOutcomePayload,
} from "./agent-execution-outcome-validation";
import type {
  AgentExecutionOutcomeRecord,
  AgentExecutionOutcomeReconciliationRecord,
  AgentExecutionOutcomeComparisonRecord,
  AgentExecutionEvidenceCompletenessRecord,
  AgentExecutionOutcomeConfidenceRecord,
  AgentExecutionHumanOutcomeReviewRecord,
  AgentExecutionFailedDispatchTriageRecord,
  AgentExecutionCorrectionLoopRecord,
  CreateAgentExecutionOutcomeInput,
  ReconcileDispatchOutcomeInput,
  CreateHumanOutcomeReviewInput,
  RecordHumanOutcomeDecisionInput,
  AgentExecutionOutcomeListFilters,
  AgentExecutionFailureCategory,
  AgentExecutionCorrectionType,
} from "./agent-execution-outcome-types";

// ─── Audit Helper ─────────────────────────────────────────────────────────────

async function tryAuditEvent(args: {
  workspaceId: string;
  title: string;
  eventType: string;
  actorId?: string | null;
}) {
  try {
    const { recordAgentAuditEvent } = await import("./agent-observability-service");
    await recordAgentAuditEvent({
      workspaceId: args.workspaceId,
      category: "execution" as never,
      eventType: args.eventType as never,
      sourceType: "agent_controlled_execution_result_reconciliation_human_outcome_review" as never,
      scopeType: "workspace",
      title: args.title,
      actorId: args.actorId ?? null,
    });
  } catch {
    // Audit events are non-blocking
  }
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function createOutcomeFromDispatchAttempt(
  input: CreateAgentExecutionOutcomeInput,
): Promise<AgentExecutionOutcomeRecord> {
  const normalized = normalizeCreateAgentExecutionOutcomeInput(input);
  const outcome = await createAgentExecutionOutcome(normalized);

  await recordAgentExecutionOutcomeEvent({
    workspaceId: outcome.workspaceId,
    outcomeId: outcome.id,
    executionRequestId: outcome.executionRequestId,
    eventType: "outcome_created",
    message: `Outcome created for execution request ${outcome.executionRequestId}`,
    actorId: input.createdBy ?? null,
  });

  await tryAuditEvent({
    workspaceId: outcome.workspaceId,
    title: `Execution outcome created for request ${outcome.executionRequestId}`,
    eventType: "execution_outcome_created",
    actorId: input.createdBy ?? null,
  });

  return outcome;
}

export async function reconcileDispatchOutcome(
  input: ReconcileDispatchOutcomeInput,
): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  reconciliation: AgentExecutionOutcomeReconciliationRecord;
}> {
  const normalized = normalizeReconcileDispatchOutcomeInput(input);
  const outcome = await getAgentExecutionOutcomeById(normalized.workspaceId, normalized.outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${normalized.outcomeId}`);

  await updateAgentExecutionOutcomeStatus({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    status: "reconciling",
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    executionRequestId: outcome.executionRequestId,
    eventType: "reconciliation_started",
    message: "Reconciliation started",
    actorId: normalized.actorId ?? null,
  });

  // Determine reconciliation facts from outcome fields
  const dispatchSucceeded = outcome.outcomeType === "dispatch_success" || outcome.outcomeType === "adapter_success" || outcome.outcomeType === "partial_success";
  const adapterExecutionExists = !!outcome.adapterExecutionId;
  const resultExists = !!outcome.resultId;
  const evidenceCount = 0; // Determined from registry links
  const lineageComplete = dispatchSucceeded && adapterExecutionExists && resultExists;

  const reconciliationNotes: string[] = [];
  if (!dispatchSucceeded) reconciliationNotes.push("Dispatch did not succeed");
  if (!adapterExecutionExists) reconciliationNotes.push("No adapter execution record linked");
  if (!resultExists) reconciliationNotes.push("No result record linked");

  const reconciliation = await createAgentExecutionOutcomeReconciliation({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    executionRequestId: outcome.executionRequestId,
    finalizationId: outcome.finalizationId,
    dispatchAttemptId: outcome.dispatchAttemptId,
    dispatchSucceeded,
    adapterExecutionExists,
    resultExists,
    evidenceCount,
    lineageComplete,
    reconciliationNotes,
  });

  const updatedOutcome = await updateAgentExecutionOutcomeStatus({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    status: "reconciled",
    patch: { blockingReasons: reconciliationNotes.filter((n) => n.startsWith("Dispatch") || n.startsWith("No adapter")) },
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    executionRequestId: outcome.executionRequestId,
    reconciliationId: reconciliation.id,
    eventType: "reconciliation_complete",
    message: "Reconciliation complete",
    actorId: normalized.actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: `Dispatch outcome reconciled for request ${outcome.executionRequestId}`,
    eventType: "execution_outcome_reconciled",
    actorId: normalized.actorId ?? null,
  });

  return { outcome: updatedOutcome, reconciliation };
}

export async function scoreOutcomeEvidenceCompleteness(
  workspaceId: string,
  outcomeId: string,
): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  evidenceCompleteness: AgentExecutionEvidenceCompletenessRecord;
}> {
  const outcome = await getAgentExecutionOutcomeById(workspaceId, outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${outcomeId}`);

  const reconciliation = await getAgentExecutionOutcomeReconciliationByOutcomeId(workspaceId, outcomeId);

  const params = {
    dispatchSucceeded: reconciliation?.dispatchSucceeded ?? false,
    adapterExecutionExists: reconciliation?.adapterExecutionExists ?? !!outcome.adapterExecutionId,
    resultExists: reconciliation?.resultExists ?? !!outcome.resultId,
    evidenceCount: reconciliation?.evidenceCount ?? 0,
    lineageComplete: reconciliation?.lineageComplete ?? false,
  };

  const result = calculateEvidenceCompleteness(params);

  const evidenceCompleteness = await createAgentExecutionEvidenceCompleteness({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    ...result,
  });

  const updatedOutcome = await updateAgentExecutionOutcomeStatus({
    workspaceId,
    outcomeId,
    status: "evidence_review",
    patch: { evidenceCompletenessLevel: result.level },
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    eventType: "evidence_completeness_scored",
    message: `Evidence completeness scored: ${result.level} (${result.completenessScore})`,
  });

  return { outcome: updatedOutcome, evidenceCompleteness };
}

export async function compareOutcomeIntendedVsActual(
  workspaceId: string,
  outcomeId: string,
): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  comparison: AgentExecutionOutcomeComparisonRecord;
}> {
  const outcome = await getAgentExecutionOutcomeById(workspaceId, outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${outcomeId}`);

  const reconciliation = await getAgentExecutionOutcomeReconciliationByOutcomeId(workspaceId, outcomeId);
  const dispatchSucceeded = reconciliation?.dispatchSucceeded ?? (outcome.outcomeType === "dispatch_success" || outcome.outcomeType === "adapter_success");

  await recordAgentExecutionOutcomeEvent({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    eventType: "comparison_started",
    message: "Comparison of intended vs actual outcome started",
  });

  const result = compareIntendedVsActualOutcome({
    intendedOutcomeSummary: outcome.intendedOutcomeSummary,
    actualOutcomeSummary: outcome.actualOutcomeSummary,
    outcomeType: outcome.outcomeType,
    dispatchSucceeded,
  });

  const comparison = await createAgentExecutionOutcomeComparison({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    ...result,
    intendedOutcomeSummary: outcome.intendedOutcomeSummary,
    actualOutcomeSummary: outcome.actualOutcomeSummary,
  });

  const updatedOutcome = await updateAgentExecutionOutcomeStatus({
    workspaceId,
    outcomeId,
    status: "comparison_complete",
    patch: {
      matchStatus: result.matchStatus,
      mismatchReasons: result.mismatchReasons,
    },
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    comparisonId: comparison.id,
    eventType: "comparison_complete",
    message: `Comparison complete: ${result.matchStatus}`,
  });

  return { outcome: updatedOutcome, comparison };
}

export async function scoreOutcomeConfidence(
  workspaceId: string,
  outcomeId: string,
): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  confidence: AgentExecutionOutcomeConfidenceRecord;
}> {
  const outcome = await getAgentExecutionOutcomeById(workspaceId, outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${outcomeId}`);

  const reconciliation = await getAgentExecutionOutcomeReconciliationByOutcomeId(workspaceId, outcomeId);

  const result = calculateOutcomeConfidence({
    dispatchSucceeded: reconciliation?.dispatchSucceeded ?? false,
    adapterExecutionExists: reconciliation?.adapterExecutionExists ?? !!outcome.adapterExecutionId,
    resultExists: reconciliation?.resultExists ?? !!outcome.resultId,
    evidenceCompletenessLevel: outcome.evidenceCompletenessLevel,
    lineageComplete: reconciliation?.lineageComplete ?? false,
    matchStatus: outcome.matchStatus,
    outcomeType: outcome.outcomeType,
  });

  const confidence = await createAgentExecutionOutcomeConfidence({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    ...result,
    confidenceReasons: result.confidenceReasons,
  });

  const updatedOutcome = await updateAgentExecutionOutcomeStatus({
    workspaceId,
    outcomeId,
    status: "confidence_scored",
    patch: {
      confidenceScore: result.confidenceScore,
      confidenceLevel: result.confidenceLevel,
    },
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    eventType: "confidence_scored",
    message: `Confidence scored: ${result.confidenceLevel} (${result.confidenceScore})`,
  });

  return { outcome: updatedOutcome, confidence };
}

export async function determineHumanOutcomeReview(
  workspaceId: string,
  outcomeId: string,
): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  reviewRequirement: string;
  reviewStatus: string;
  priority: string;
}> {
  const outcome = await getAgentExecutionOutcomeById(workspaceId, outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${outcomeId}`);

  const comparison = await getAgentExecutionOutcomeComparisonByOutcomeId(workspaceId, outcomeId);

  const result = determineOutcomeReviewRequirement({
    confidenceLevel: outcome.confidenceLevel,
    matchStatus: outcome.matchStatus,
    outcomeType: outcome.outcomeType,
    requiresCorrection: comparison?.requiresCorrection ?? false,
  });

  const updatedOutcome = await updateAgentExecutionOutcomeStatus({
    workspaceId,
    outcomeId,
    status: result.reviewRequirement === "not_required" ? "confidence_scored" : "review_required",
    patch: {
      reviewRequirement: result.reviewRequirement,
      reviewStatus: result.reviewStatus,
    },
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    eventType: "review_requirement_determined",
    message: `Review requirement: ${result.reviewRequirement}`,
  });

  return {
    outcome: updatedOutcome,
    reviewRequirement: result.reviewRequirement,
    reviewStatus: result.reviewStatus,
    priority: result.priority,
  };
}

export async function createHumanOutcomeReview(
  input: CreateHumanOutcomeReviewInput,
): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  humanReview: AgentExecutionHumanOutcomeReviewRecord;
}> {
  const normalized = normalizeCreateHumanOutcomeReviewInput(input);
  const outcome = await getAgentExecutionOutcomeById(normalized.workspaceId, normalized.outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${normalized.outcomeId}`);

  const humanReview = await createAgentExecutionHumanOutcomeReview({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    executionRequestId: outcome.executionRequestId,
    reviewRequirement: outcome.reviewRequirement,
    priority: normalized.priority ?? "normal",
    title: normalized.title ?? "Human Outcome Review",
    summary: normalized.summary ?? null,
    dueAt: normalized.dueAt ?? null,
    createdBy: normalized.createdBy ?? null,
  });

  const updatedOutcome = await updateAgentExecutionOutcomeStatus({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    status: "review_in_progress",
    patch: { reviewStatus: "in_progress" },
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    executionRequestId: outcome.executionRequestId,
    humanReviewId: humanReview.id,
    eventType: "human_review_created",
    message: `Human outcome review created: ${humanReview.title}`,
    actorId: normalized.createdBy ?? null,
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: `Human outcome review created for ${outcome.executionRequestId}`,
    eventType: "execution_outcome_human_review_created",
    actorId: normalized.createdBy ?? null,
  });

  return { outcome: updatedOutcome, humanReview };
}

export async function recordHumanOutcomeDecision(
  input: RecordHumanOutcomeDecisionInput,
): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  humanReview: AgentExecutionHumanOutcomeReviewRecord;
}> {
  const normalized = normalizeRecordHumanOutcomeDecisionInput(input);
  const outcome = await getAgentExecutionOutcomeById(normalized.workspaceId, normalized.outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${normalized.outcomeId}`);

  const reviewStatusMap: Record<string, "approved" | "rejected" | "deferred"> = {
    approve: "approved",
    reject: "rejected",
    request_correction: "rejected",
    archive: "approved",
    escalate: "deferred",
    defer: "deferred",
  };
  const newReviewStatus = reviewStatusMap[normalized.decisionType] ?? "approved";

  const updatedReview = await updateAgentExecutionHumanOutcomeReviewStatus({
    workspaceId: normalized.workspaceId,
    reviewId: normalized.humanReviewId,
    reviewStatus: newReviewStatus,
    decisionType: normalized.decisionType,
    decisionRationale: normalized.decisionRationale ?? null,
    decidedBy: normalized.decidedBy ?? null,
  });

  const outcomeStatusMap: Record<string, "review_complete" | "correction_required" | "archived"> = {
    approve: "review_complete",
    reject: "correction_required",
    request_correction: "correction_required",
    archive: "archived",
    escalate: "review_complete",
    defer: "review_complete",
  };
  const newOutcomeStatus = outcomeStatusMap[normalized.decisionType] ?? "review_complete";

  const updatedOutcome = await updateAgentExecutionOutcomeStatus({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    status: newOutcomeStatus,
    patch: { reviewStatus: newReviewStatus },
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId: normalized.workspaceId,
    outcomeId: normalized.outcomeId,
    executionRequestId: outcome.executionRequestId,
    humanReviewId: normalized.humanReviewId,
    eventType: "human_review_decision_recorded",
    message: `Human outcome decision recorded: ${normalized.decisionType}`,
    actorId: normalized.decidedBy ?? null,
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: `Human outcome decision: ${normalized.decisionType} for ${outcome.executionRequestId}`,
    eventType: "execution_outcome_decision_recorded",
    actorId: normalized.decidedBy ?? null,
  });

  return { outcome: updatedOutcome, humanReview: updatedReview };
}

export async function createFailedDispatchTriage(input: {
  workspaceId: string;
  outcomeId: string;
  failureCategory: AgentExecutionFailureCategory;
  failureMessage?: string | null;
  blockingReasons?: string[];
  triageNotes?: string[];
  recommendedCorrectionType?: AgentExecutionCorrectionType | null;
  triagePayload?: Record<string, unknown> | null;
}): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  triage: AgentExecutionFailedDispatchTriageRecord;
}> {
  const outcome = await getAgentExecutionOutcomeById(input.workspaceId, input.outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${input.outcomeId}`);

  const triage = await createAgentExecutionFailedDispatchTriage({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: outcome.executionRequestId,
    finalizationId: outcome.finalizationId,
    dispatchAttemptId: outcome.dispatchAttemptId,
    failureCategory: input.failureCategory,
    failureMessage: input.failureMessage ?? null,
    blockingReasons: input.blockingReasons ?? [],
    triageNotes: input.triageNotes ?? [],
    recommendedCorrectionType: input.recommendedCorrectionType ?? null,
    triagePayload: input.triagePayload ?? null,
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: outcome.executionRequestId,
    eventType: "failed_dispatch_triaged",
    message: `Failed dispatch triaged: ${input.failureCategory}`,
  });

  return { outcome, triage };
}

export async function createOutcomeCorrectionLoop(input: {
  workspaceId: string;
  outcomeId: string;
  correctionType: AgentExecutionCorrectionType;
  correctionRationale?: string | null;
  correctionPayload?: Record<string, unknown> | null;
}): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  correctionLoop: AgentExecutionCorrectionLoopRecord;
}> {
  const outcome = await getAgentExecutionOutcomeById(input.workspaceId, input.outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${input.outcomeId}`);

  const correctionLoop = await createAgentExecutionCorrectionLoop({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: outcome.executionRequestId,
    correctionType: input.correctionType,
    correctionRationale: input.correctionRationale ?? null,
    correctionPayload: input.correctionPayload ?? null,
  });

  const updatedOutcome = await updateAgentExecutionOutcomeStatus({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    status: "correction_in_progress",
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId: input.workspaceId,
    outcomeId: input.outcomeId,
    executionRequestId: outcome.executionRequestId,
    correctionLoopId: correctionLoop.id,
    eventType: "correction_loop_created",
    message: `Correction loop created: ${input.correctionType}`,
  });

  return { outcome: updatedOutcome, correctionLoop };
}

export async function archiveOutcome(
  workspaceId: string,
  outcomeId: string,
  actorId?: string | null,
): Promise<AgentExecutionOutcomeRecord> {
  const outcome = await getAgentExecutionOutcomeById(workspaceId, outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${outcomeId}`);

  const updated = await updateAgentExecutionOutcomeStatus({
    workspaceId,
    outcomeId,
    status: "archived",
    patch: { reviewStatus: outcome.reviewStatus === "not_required" ? "not_required" : "cancelled" },
  });

  await recordAgentExecutionOutcomeEvent({
    workspaceId,
    outcomeId,
    executionRequestId: outcome.executionRequestId,
    eventType: "outcome_archived",
    message: "Outcome archived",
    actorId: actorId ?? null,
  });

  await tryAuditEvent({
    workspaceId,
    title: `Execution outcome archived for request ${outcome.executionRequestId}`,
    eventType: "execution_outcome_archived",
    actorId: actorId ?? null,
  });

  return updated;
}

export async function buildExecutionOutcomeSummary(
  workspaceId: string,
  outcomeId: string,
): Promise<{
  outcome: AgentExecutionOutcomeRecord;
  reconciliation: AgentExecutionOutcomeReconciliationRecord | null;
  comparison: AgentExecutionOutcomeComparisonRecord | null;
  evidenceCompleteness: AgentExecutionEvidenceCompletenessRecord | null;
  confidence: AgentExecutionOutcomeConfidenceRecord | null;
  humanReview: AgentExecutionHumanOutcomeReviewRecord | null;
  triage: AgentExecutionFailedDispatchTriageRecord | null;
  correctionLoop: AgentExecutionCorrectionLoopRecord | null;
  events: ReturnType<typeof listAgentExecutionOutcomeEvents> extends Promise<infer T> ? T : never;
}> {
  const outcome = await getAgentExecutionOutcomeById(workspaceId, outcomeId);
  if (!outcome) throw new Error(`Outcome not found: ${outcomeId}`);

  const [reconciliation, comparison, evidenceCompleteness, confidence, humanReview, triage, correctionLoop, events] =
    await Promise.all([
      getAgentExecutionOutcomeReconciliationByOutcomeId(workspaceId, outcomeId),
      getAgentExecutionOutcomeComparisonByOutcomeId(workspaceId, outcomeId),
      getAgentExecutionEvidenceCompletenessByOutcomeId(workspaceId, outcomeId),
      getAgentExecutionOutcomeConfidenceByOutcomeId(workspaceId, outcomeId),
      getAgentExecutionHumanOutcomeReviewByOutcomeId(workspaceId, outcomeId),
      getAgentExecutionFailedDispatchTriageByOutcomeId(workspaceId, outcomeId),
      getAgentExecutionCorrectionLoopByOutcomeId(workspaceId, outcomeId),
      listAgentExecutionOutcomeEvents(workspaceId, outcomeId),
    ]);

  return { outcome, reconciliation, comparison, evidenceCompleteness, confidence, humanReview, triage, correctionLoop, events };
}

// Re-export registry functions needed by routes
export {
  getAgentExecutionOutcomeById,
  listAgentExecutionOutcomes,
  listAgentExecutionOutcomeEvents,
};
