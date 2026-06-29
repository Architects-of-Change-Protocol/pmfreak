// ─── Controlled Execution Learning Signals & Governance Feedback Loop — Service
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT store raw payloads, free text decision notes, or identifiers in signals.
// Does NOT mutate policies, routing, or scoring values.
// Does NOT execute adapters. Does NOT retry dispatch.
// All operations are deterministic.
//
// INVARIANT: Never store raw payload fields, free text summaries, or
//   decision notes of any kind in signals.
// INVARIANT: Privacy filter runs before every signal creation.
// INVARIANT: generateGovernanceFeedbackFromSignals creates feedback RECORDS only.

import {
  createAgentExecutionLearningSignal,
  getAgentExecutionLearningSignalById,
  listAgentExecutionLearningSignals,
  updateAgentExecutionLearningSignalStatus,
  createAgentExecutionLearningExtraction,
  updateAgentExecutionLearningExtraction,
  createAgentExecutionLearningPrivacyFilter,
  createAgentExecutionGovernanceFeedback,
  updateAgentExecutionGovernanceFeedbackStatus,
  listAgentExecutionGovernanceFeedback,
  createAgentExecutionRiskCalibrationSignal,
  createAgentExecutionEvidenceQualitySignal,
  createAgentExecutionAdapterPerformanceSignal,
  createAgentExecutionReviewDecisionPattern,
  createAgentExecutionReviewRoutingFeedback,
  createAgentExecutionWorkspaceLearningSummary,
  createAgentExecutionAggregateLearningSignal,
  recordAgentExecutionLearningEvent,
  listAgentExecutionLearningEvents,
} from "./agent-execution-learning-registry";
import {
  normalizeCreateAgentExecutionLearningSignalInput,
  normalizeExtractLearningSignalsInput,
  normalizeGenerateGovernanceFeedbackInput,
  normalizeGenerateWorkspaceLearningSummaryInput,
  evaluateLearningPrivacyFilter,
  deriveRiskCalibrationDirection,
  deriveGovernanceFeedbackSeverity,
  calculateSignalWeight,
  calculateLearningConfidence,
  dedupeLearningStrings,
} from "./agent-execution-learning-validation";
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
  CreateAgentExecutionLearningSignalInput,
  ExtractLearningSignalsInput,
  GenerateGovernanceFeedbackInput,
  GenerateWorkspaceLearningSummaryInput,
  AgentExecutionLearningSignalListFilters,
  AgentExecutionLearningSignalType,
  AgentExecutionLearningSignalCategory,
  AgentExecutionGovernanceFeedbackStatus,
} from "./agent-execution-learning-types";

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
      sourceType: "agent_controlled_execution_learning_signals_governance_feedback_loop" as never,
      scopeType: "workspace",
      title: args.title,
      actorId: args.actorId ?? null,
    });
  } catch {
    // Non-fatal
  }
}

// ─── Privacy-Safe Signal Creation ─────────────────────────────────────────────

export async function runLearningPrivacyFilter(input: {
  workspaceId: string;
  sourceType: import("./agent-execution-learning-types").AgentExecutionLearningSourceType;
  sourceId: string;
  candidateSignalType: AgentExecutionLearningSignalType;
  signalValue: string;
  signalPayload: Record<string, unknown> | null;
}): Promise<AgentExecutionLearningPrivacyFilterRecord> {
  const result = evaluateLearningPrivacyFilter({
    workspaceId: input.workspaceId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    candidateSignalType: input.candidateSignalType,
    signalValue: input.signalValue,
    signalPayload: input.signalPayload,
  });

  const filterRecord = await createAgentExecutionLearningPrivacyFilter({
    workspaceId: input.workspaceId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    candidateSignalType: input.candidateSignalType,
    containsRawPayload: result.containsRawPayload,
    containsFreeText: result.containsFreeText,
    containsSensitiveKey: result.containsSensitiveKey,
    containsCustomerIdentifier: result.containsCustomerIdentifier,
    containsProjectIdentifier: result.containsProjectIdentifier,
    safeToStore: result.safeToStore,
    redactionApplied: result.redactionApplied,
    privacyClassification: result.privacyClassification,
    retentionClass: result.retentionClass,
    filterReasons: result.filterReasons,
  });

  await recordAgentExecutionLearningEvent({
    workspaceId: input.workspaceId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    eventType: "learning_signal_privacy_checked",
    message: result.safeToStore ? "Privacy check passed" : `Privacy check blocked: ${result.filterReasons.join(", ")}`,
  });

  return filterRecord;
}

export async function createPrivacySafeLearningSignal(
  input: CreateAgentExecutionLearningSignalInput,
): Promise<AgentExecutionLearningSignalRecord | null> {
  const normalized = normalizeCreateAgentExecutionLearningSignalInput(input);

  const filterResult = evaluateLearningPrivacyFilter({
    workspaceId: normalized.workspaceId,
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
    candidateSignalType: normalized.signalType,
    signalValue: normalized.signalValue,
    signalPayload: normalized.signalPayload ?? null,
  });

  await createAgentExecutionLearningPrivacyFilter({
    workspaceId: normalized.workspaceId,
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
    candidateSignalType: normalized.signalType,
    containsRawPayload: filterResult.containsRawPayload,
    containsFreeText: filterResult.containsFreeText,
    containsSensitiveKey: filterResult.containsSensitiveKey,
    containsCustomerIdentifier: filterResult.containsCustomerIdentifier,
    containsProjectIdentifier: filterResult.containsProjectIdentifier,
    safeToStore: filterResult.safeToStore,
    redactionApplied: filterResult.redactionApplied,
    privacyClassification: filterResult.privacyClassification,
    retentionClass: filterResult.retentionClass,
    filterReasons: filterResult.filterReasons,
  });

  if (!filterResult.safeToStore) {
    await recordAgentExecutionLearningEvent({
      workspaceId: normalized.workspaceId,
      sourceType: normalized.sourceType,
      sourceId: normalized.sourceId,
      eventType: "learning_signal_privacy_blocked",
      message: `Signal blocked: ${filterResult.filterReasons.join(", ")}`,
    });
    return null;
  }

  const signal = await createAgentExecutionLearningSignal({
    ...normalized,
    privacyClassification: filterResult.privacyClassification,
    retentionClass: filterResult.retentionClass,
    safeSignalPayload: filterResult.safePayload,
  });

  await recordAgentExecutionLearningEvent({
    workspaceId: normalized.workspaceId,
    signalId: signal.id,
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
    eventType: "learning_signal_created",
    message: `Learning signal created: ${signal.signalType}`,
  });

  await tryAuditEvent({
    workspaceId: normalized.workspaceId,
    title: `Learning signal created: ${signal.signalType}`,
    eventType: "execution_learning_signal_created",
    actorId: normalized.createdBy,
  });

  return signal;
}

// ─── Extract from Outcome ─────────────────────────────────────────────────────
// INVARIANT: Only reads categorical/enum/score/count/boolean fields.
// NEVER reads raw payload fields or free text summary fields.

export async function extractLearningSignalsFromOutcome(
  outcome: {
    id: string;
    workspaceId: string;
    status: string;
    outcomeType: string;
    matchStatus: string;
    confidenceLevel: string;
    evidenceCompletenessLevel: string;
    reviewRequirement: string;
    reviewStatus: string;
    adapterKey?: string | null;
    // Only categorical/enum/score/count/boolean fields — no free text or payload
  },
  actorId?: string | null,
): Promise<AgentExecutionLearningSignalRecord[]> {
  const { id: outcomeId, workspaceId } = outcome;
  const signals: AgentExecutionLearningSignalRecord[] = [];

  const extraction = await createAgentExecutionLearningExtraction({
    workspaceId,
    sourceType: "execution_outcome",
    sourceId: outcomeId,
    createdBy: actorId,
  });

  await updateAgentExecutionLearningExtraction(extraction.id, { status: "running" });

  let extracted = 0;
  let blocked = 0;
  const blockingReasons: string[] = [];

  // Signal: outcome accepted or rejected
  if (outcome.reviewStatus === "approved") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "execution_outcome",
      sourceId: outcomeId,
      outcomeId,
      adapterKey: outcome.adapterKey ?? null,
      signalType: "outcome_accepted",
      signalCategory: "outcome",
      signalValue: outcome.outcomeType,
      signalWeight: calculateSignalWeight({ humanDecisionType: "approve" }),
      confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: true }),
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else { blocked++; blockingReasons.push("outcome_accepted_blocked"); }
  } else if (outcome.reviewStatus === "rejected") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "execution_outcome",
      sourceId: outcomeId,
      outcomeId,
      adapterKey: outcome.adapterKey ?? null,
      signalType: "outcome_rejected",
      signalCategory: "outcome",
      signalValue: outcome.outcomeType,
      signalWeight: calculateSignalWeight({ humanDecisionType: "reject" }),
      confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: true }),
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else { blocked++; blockingReasons.push("outcome_rejected_blocked"); }
  }

  // Signal: match status
  if (outcome.matchStatus === "matched") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "execution_outcome",
      sourceId: outcomeId,
      outcomeId,
      adapterKey: outcome.adapterKey ?? null,
      signalType: "intended_actual_matched",
      signalCategory: "outcome",
      signalValue: outcome.matchStatus,
      signalWeight: 50,
      confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: false }),
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else { blocked++; }
  } else if (outcome.matchStatus === "mismatch") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "execution_outcome",
      sourceId: outcomeId,
      outcomeId,
      adapterKey: outcome.adapterKey ?? null,
      signalType: "intended_actual_mismatched",
      signalCategory: "outcome",
      signalValue: outcome.matchStatus,
      signalWeight: calculateSignalWeight({ humanDecisionType: "reject" }),
      confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: false }),
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else { blocked++; }
  }

  // Signal: confidence level
  if (outcome.confidenceLevel === "low") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "execution_outcome",
      sourceId: outcomeId,
      outcomeId,
      adapterKey: outcome.adapterKey ?? null,
      signalType: "confidence_low",
      signalCategory: "confidence",
      signalValue: outcome.confidenceLevel,
      signalWeight: calculateSignalWeight({ confidenceLevel: "low" }),
      confidenceScore: 50,
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else { blocked++; }
  } else if (outcome.confidenceLevel === "high") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "execution_outcome",
      sourceId: outcomeId,
      outcomeId,
      adapterKey: outcome.adapterKey ?? null,
      signalType: "confidence_high",
      signalCategory: "confidence",
      signalValue: outcome.confidenceLevel,
      signalWeight: 50,
      confidenceScore: 70,
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else { blocked++; }
  }

  // Signal: evidence completeness
  if (outcome.evidenceCompletenessLevel === "none" || outcome.evidenceCompletenessLevel === "minimal") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "execution_outcome",
      sourceId: outcomeId,
      outcomeId,
      adapterKey: outcome.adapterKey ?? null,
      signalType: "evidence_missing",
      signalCategory: "evidence",
      signalValue: outcome.evidenceCompletenessLevel,
      signalWeight: calculateSignalWeight({ evidenceCompletenessLevel: "none" }),
      confidenceScore: 50,
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else { blocked++; }
  } else if (outcome.evidenceCompletenessLevel === "complete") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "execution_outcome",
      sourceId: outcomeId,
      outcomeId,
      adapterKey: outcome.adapterKey ?? null,
      signalType: "evidence_complete",
      signalCategory: "evidence",
      signalValue: outcome.evidenceCompletenessLevel,
      signalWeight: 50,
      confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: false, evidenceCompletenessLevel: "complete" }),
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else { blocked++; }
  }

  const finalStatus = blocked > 0 && extracted === 0 ? "privacy_blocked" : blocked > 0 ? "partial" : "succeeded";
  await updateAgentExecutionLearningExtraction(extraction.id, {
    status: finalStatus,
    signalsExtracted: extracted,
    signalsSkipped: 0,
    privacyPassed: extracted,
    privacyBlocked: blocked,
    blockingReasons,
  });

  await recordAgentExecutionLearningEvent({
    workspaceId,
    extractionId: extraction.id,
    sourceType: "execution_outcome",
    sourceId: outcomeId,
    eventType: finalStatus === "succeeded" ? "learning_extraction_succeeded" : "learning_extraction_failed",
    message: `Extracted ${extracted} signals, blocked ${blocked}`,
    actorId,
  });

  return signals;
}

// ─── Extract from Human Outcome Review ───────────────────────────────────────
// INVARIANT: Reads only categorical fields — never free text decision notes.

export async function extractLearningSignalsFromHumanOutcomeReview(
  review: {
    id: string;
    workspaceId: string;
    decisionType: string | null;
    reviewRequirement: string;
    reviewStatus: string;
    priority: string | null;
    riskLevel: string | null;
    assignedRole: string | null;
    outcomeId: string | null;
    adapterKey?: string | null;
    // Only categorical/enum fields — no free text fields
  },
  actorId?: string | null,
): Promise<AgentExecutionLearningSignalRecord[]> {
  const { id: reviewId, workspaceId } = review;
  const signals: AgentExecutionLearningSignalRecord[] = [];

  const extraction = await createAgentExecutionLearningExtraction({
    workspaceId,
    sourceType: "human_outcome_review",
    sourceId: reviewId,
    createdBy: actorId,
  });

  await updateAgentExecutionLearningExtraction(extraction.id, { status: "running" });

  let extracted = 0;
  let blocked = 0;

  if (review.decisionType === "approve") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "human_outcome_review",
      sourceId: reviewId,
      reviewId,
      outcomeId: review.outcomeId ?? null,
      adapterKey: review.adapterKey ?? null,
      signalType: "outcome_accepted",
      signalCategory: "outcome",
      signalValue: review.decisionType,
      signalWeight: calculateSignalWeight({ humanDecisionType: "approve", riskLevel: review.riskLevel ?? undefined }),
      confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: true }),
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else blocked++;
  } else if (review.decisionType === "reject") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "human_outcome_review",
      sourceId: reviewId,
      reviewId,
      outcomeId: review.outcomeId ?? null,
      adapterKey: review.adapterKey ?? null,
      signalType: "outcome_rejected",
      signalCategory: "outcome",
      signalValue: review.decisionType,
      signalWeight: calculateSignalWeight({ humanDecisionType: "reject", riskLevel: review.riskLevel ?? undefined }),
      confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: true }),
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else blocked++;
  } else if (review.decisionType === "request_correction") {
    const sig = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "human_outcome_review",
      sourceId: reviewId,
      reviewId,
      outcomeId: review.outcomeId ?? null,
      adapterKey: review.adapterKey ?? null,
      signalType: "correction_requested",
      signalCategory: "outcome",
      signalValue: review.decisionType,
      signalWeight: calculateSignalWeight({ humanDecisionType: "request_correction", riskLevel: review.riskLevel ?? undefined }),
      confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: true }),
      createdBy: actorId,
    });
    if (sig) { signals.push(sig); extracted++; } else blocked++;
  }

  const finalStatus = blocked > 0 && extracted === 0 ? "privacy_blocked" : "succeeded";
  await updateAgentExecutionLearningExtraction(extraction.id, {
    status: finalStatus,
    signalsExtracted: extracted,
    privacyPassed: extracted,
    privacyBlocked: blocked,
  });

  return signals;
}

// ─── Extract from Correction Loop ─────────────────────────────────────────────
// INVARIANT: Reads only categorical fields — no free text or raw payload.

export async function extractLearningSignalsFromCorrectionLoop(
  loop: {
    id: string;
    workspaceId: string;
    correctionType: string;
    status: string;
    retryRecommended: boolean;
    outcomeId: string | null;
    adapterKey?: string | null;
    // Only categorical/enum/boolean fields — no free text fields or payload
  },
  actorId?: string | null,
): Promise<AgentExecutionLearningSignalRecord[]> {
  const { id: loopId, workspaceId } = loop;
  const signals: AgentExecutionLearningSignalRecord[] = [];

  const extraction = await createAgentExecutionLearningExtraction({
    workspaceId,
    sourceType: "correction_loop",
    sourceId: loopId,
    createdBy: actorId,
  });

  await updateAgentExecutionLearningExtraction(extraction.id, { status: "running" });

  let extracted = 0;
  let blocked = 0;

  const sig = await createPrivacySafeLearningSignal({
    workspaceId,
    sourceType: "correction_loop",
    sourceId: loopId,
    outcomeId: loop.outcomeId ?? null,
    adapterKey: loop.adapterKey ?? null,
    signalType: "correction_requested",
    signalCategory: "outcome",
    signalValue: loop.correctionType,
    signalWeight: calculateSignalWeight({ humanDecisionType: "request_correction" }),
    confidenceScore: calculateLearningConfidence({ sourceAvailable: true, privacySafe: true, humanDecisionPresent: true }),
    createdBy: actorId,
  });
  if (sig) { signals.push(sig); extracted++; } else blocked++;

  if (loop.retryRecommended) {
    const sig2 = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "correction_loop",
      sourceId: loopId,
      outcomeId: loop.outcomeId ?? null,
      adapterKey: loop.adapterKey ?? null,
      signalType: "retry_recommended",
      signalCategory: "triage",
      signalValue: loop.correctionType,
      signalWeight: 60,
      confidenceScore: 60,
      createdBy: actorId,
    });
    if (sig2) { signals.push(sig2); extracted++; } else blocked++;
  }

  await updateAgentExecutionLearningExtraction(extraction.id, {
    status: "succeeded",
    signalsExtracted: extracted,
    privacyPassed: extracted,
    privacyBlocked: blocked,
  });

  return signals;
}

// ─── Extract from Failed Dispatch Triage ──────────────────────────────────────
// INVARIANT: Reads only categorical fields — no free text error descriptions.

export async function extractLearningSignalsFromFailedDispatchTriage(
  triage: {
    id: string;
    workspaceId: string;
    failureCategory: string;
    retryable: boolean;
    suggestedRetryMode: string | null;
    requiresHumanReview: boolean;
    requiresCorrection: boolean;
    requiresEscalation: boolean;
    outcomeId: string | null;
    adapterKey?: string | null;
    // Only categorical/enum/boolean fields — no free text error descriptions
  },
  actorId?: string | null,
): Promise<AgentExecutionLearningSignalRecord[]> {
  const { id: triageId, workspaceId } = triage;
  const signals: AgentExecutionLearningSignalRecord[] = [];

  const extraction = await createAgentExecutionLearningExtraction({
    workspaceId,
    sourceType: "failed_dispatch_triage",
    sourceId: triageId,
    createdBy: actorId,
  });

  await updateAgentExecutionLearningExtraction(extraction.id, { status: "running" });

  let extracted = 0;
  let blocked = 0;

  const sig = await createPrivacySafeLearningSignal({
    workspaceId,
    sourceType: "failed_dispatch_triage",
    sourceId: triageId,
    outcomeId: triage.outcomeId ?? null,
    adapterKey: triage.adapterKey ?? null,
    signalType: "dispatch_failed",
    signalCategory: "triage",
    signalValue: triage.failureCategory,
    signalWeight: 65,
    confidenceScore: 60,
    createdBy: actorId,
  });
  if (sig) { signals.push(sig); extracted++; } else blocked++;

  if (triage.retryable) {
    const sig2 = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "failed_dispatch_triage",
      sourceId: triageId,
      outcomeId: triage.outcomeId ?? null,
      adapterKey: triage.adapterKey ?? null,
      signalType: "triage_retryable",
      signalCategory: "triage",
      signalValue: triage.suggestedRetryMode ?? triage.failureCategory,
      signalWeight: 55,
      confidenceScore: 60,
      createdBy: actorId,
    });
    if (sig2) { signals.push(sig2); extracted++; } else blocked++;
  }

  if (triage.requiresEscalation) {
    const sig3 = await createPrivacySafeLearningSignal({
      workspaceId,
      sourceType: "failed_dispatch_triage",
      sourceId: triageId,
      outcomeId: triage.outcomeId ?? null,
      adapterKey: triage.adapterKey ?? null,
      signalType: "triage_escalated",
      signalCategory: "triage",
      signalValue: triage.failureCategory,
      signalWeight: 75,
      confidenceScore: 65,
      createdBy: actorId,
    });
    if (sig3) { signals.push(sig3); extracted++; } else blocked++;
  }

  await updateAgentExecutionLearningExtraction(extraction.id, {
    status: "succeeded",
    signalsExtracted: extracted,
    privacyPassed: extracted,
    privacyBlocked: blocked,
  });

  return signals;
}

// ─── Governance Feedback ──────────────────────────────────────────────────────
// INVARIANT: Creates feedback RECORDS only. Does NOT mutate policies.

export async function generateGovernanceFeedbackFromSignals(
  input: GenerateGovernanceFeedbackInput,
): Promise<AgentExecutionGovernanceFeedbackRecord[]> {
  const normalized = normalizeGenerateGovernanceFeedbackInput(input);
  const { workspaceId, sourceSignalIds, actorId } = normalized;

  const signals = sourceSignalIds && sourceSignalIds.length > 0
    ? await Promise.all(sourceSignalIds.map((id) => getAgentExecutionLearningSignalById(workspaceId, id)))
    : await listAgentExecutionLearningSignals(workspaceId, { status: "active", limit: 100 });

  const validSignals = signals.filter(Boolean) as AgentExecutionLearningSignalRecord[];
  const feedbackRecords: AgentExecutionGovernanceFeedbackRecord[] = [];

  // Group by category
  const byCategory = new Map<string, AgentExecutionLearningSignalRecord[]>();
  for (const sig of validSignals) {
    const cat = sig.signalCategory;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(sig);
  }

  for (const [category, catSignals] of byCategory) {
    if (catSignals.length === 0) continue;

    const avgWeight = catSignals.reduce((s, c) => s + c.signalWeight, 0) / catSignals.length;
    const avgConf = catSignals.reduce((s, c) => s + c.confidenceScore, 0) / catSignals.length;
    const severity = deriveGovernanceFeedbackSeverity({ signalWeight: avgWeight, confidenceScore: avgConf });

    // Determine feedback type from category
    let feedbackType: import("./agent-execution-learning-types").AgentExecutionGovernanceFeedbackType = "governance_observation";
    if (category === "risk") feedbackType = "risk_calibration";
    else if (category === "evidence") feedbackType = "evidence_requirement";
    else if (category === "adapter") feedbackType = "adapter_quality";
    else if (category === "review") feedbackType = "review_routing";
    else if (category === "triage") feedbackType = "triage_policy";

    const recommendation = `${catSignals.length} signal(s) observed in category: ${category}. Average weight: ${Math.round(avgWeight)}.`;

    const feedback = await createAgentExecutionGovernanceFeedback({
      workspaceId,
      feedbackType,
      feedbackCategory: category as AgentExecutionLearningSignalCategory,
      severity,
      recommendation,
      confidenceScore: Math.round(avgConf),
      sourceSignalIds: catSignals.map((s) => s.id),
    });

    feedbackRecords.push(feedback);

    await recordAgentExecutionLearningEvent({
      workspaceId,
      feedbackId: feedback.id,
      eventType: "governance_feedback_created",
      message: `Governance feedback created: ${feedbackType} (${severity})`,
      actorId,
    });
  }

  return feedbackRecords;
}

// ─── Risk Calibration Signals ─────────────────────────────────────────────────

export async function generateRiskCalibrationSignals(
  workspaceId: string,
  signals: AgentExecutionLearningSignalRecord[],
): Promise<AgentExecutionRiskCalibrationSignalRecord[]> {
  const results: AgentExecutionRiskCalibrationSignalRecord[] = [];

  for (const sig of signals) {
    if (sig.signalCategory !== "risk" && sig.signalCategory !== "outcome") continue;

    const calibrationDirection = deriveRiskCalibrationDirection({
      originalRiskLevel: null,
      correctionRequested: sig.signalType === "correction_requested",
      retryRecommended: sig.signalType === "retry_recommended",
      reviewDecisionType: sig.signalType === "outcome_rejected" ? "reject"
        : sig.signalType === "outcome_accepted" ? "approve" : null,
    });

    const record = await createAgentExecutionRiskCalibrationSignal({
      workspaceId,
      sourceSignalId: sig.id,
      outcomeId: sig.outcomeId,
      actionType: sig.actionType,
      adapterKey: sig.adapterKey,
      calibrationDirection,
      confidenceScore: sig.confidenceScore,
    });

    results.push(record);

    await recordAgentExecutionLearningEvent({
      workspaceId,
      signalId: sig.id,
      eventType: "risk_calibration_signal_created",
      message: `Risk calibration: ${calibrationDirection}`,
    });
  }

  return results;
}

// ─── Evidence Quality Signals ─────────────────────────────────────────────────

export async function generateEvidenceQualitySignals(
  workspaceId: string,
  signals: AgentExecutionLearningSignalRecord[],
): Promise<AgentExecutionEvidenceQualitySignalRecord[]> {
  const results: AgentExecutionEvidenceQualitySignalRecord[] = [];
  const evidenceSignals = signals.filter((s) => s.signalCategory === "evidence");

  if (evidenceSignals.length === 0) return results;

  const missingCount = evidenceSignals.filter((s) => s.signalType === "evidence_missing").length;
  const completeCount = evidenceSignals.filter((s) => s.signalType === "evidence_complete").length;
  const trend: import("./agent-execution-learning-types").AgentExecutionTrendDirection =
    completeCount > missingCount ? "improving"
    : missingCount > completeCount ? "worsening"
    : evidenceSignals.length === 0 ? "insufficient_data"
    : "stable";

  const record = await createAgentExecutionEvidenceQualitySignal({
    workspaceId,
    frequency: evidenceSignals.length,
    trendDirection: trend,
    evidenceCompletenessLevel: missingCount > 0 ? "partial" : "complete",
  });

  results.push(record);

  await recordAgentExecutionLearningEvent({
    workspaceId,
    eventType: "evidence_quality_signal_created",
    message: `Evidence quality: ${trend} (${evidenceSignals.length} signals)`,
  });

  return results;
}

// ─── Adapter Performance Signals ──────────────────────────────────────────────

export async function generateAdapterPerformanceSignals(
  workspaceId: string,
  signals: AgentExecutionLearningSignalRecord[],
): Promise<AgentExecutionAdapterPerformanceSignalRecord[]> {
  const results: AgentExecutionAdapterPerformanceSignalRecord[] = [];

  // Group by adapterKey
  const byAdapter = new Map<string, AgentExecutionLearningSignalRecord[]>();
  for (const sig of signals) {
    if (!sig.adapterKey) continue;
    if (!byAdapter.has(sig.adapterKey)) byAdapter.set(sig.adapterKey, []);
    byAdapter.get(sig.adapterKey)!.push(sig);
  }

  for (const [adapterKey, adapterSignals] of byAdapter) {
    const successCount = adapterSignals.filter((s) => s.signalType === "outcome_accepted").length;
    const failureCount = adapterSignals.filter((s) => s.signalType === "dispatch_failed").length;
    const missingEvidenceCount = adapterSignals.filter((s) => s.signalType === "evidence_missing").length;
    const correctionCount = adapterSignals.filter((s) => s.signalType === "correction_requested").length;
    const retryRecommendationCount = adapterSignals.filter((s) => s.signalType === "retry_recommended").length;
    const humanAcceptanceCount = adapterSignals.filter((s) => s.signalType === "outcome_accepted").length;
    const humanRejectionCount = adapterSignals.filter((s) => s.signalType === "outcome_rejected").length;
    const lowConfidenceCount = adapterSignals.filter((s) => s.signalType === "confidence_low").length;
    const highConfidenceCount = adapterSignals.filter((s) => s.signalType === "confidence_high").length;
    const mediumConfidenceCount = adapterSignals.length - lowConfidenceCount - highConfidenceCount;

    const trend: import("./agent-execution-learning-types").AgentExecutionTrendDirection =
      successCount > failureCount ? "improving"
      : failureCount > successCount ? "worsening"
      : "stable";

    const record = await createAgentExecutionAdapterPerformanceSignal({
      workspaceId,
      adapterKey,
      successCount,
      failureCount,
      missingEvidenceCount,
      correctionCount,
      retryRecommendationCount,
      humanAcceptanceCount,
      humanRejectionCount,
      lowConfidenceCount,
      mediumConfidenceCount: Math.max(0, mediumConfidenceCount),
      highConfidenceCount,
      trendDirection: trend,
    });

    results.push(record);

    await recordAgentExecutionLearningEvent({
      workspaceId,
      eventType: "adapter_performance_signal_created",
      message: `Adapter performance: ${adapterKey} trend=${trend}`,
    });
  }

  return results;
}

// ─── Review Decision Patterns ─────────────────────────────────────────────────

export async function generateReviewDecisionPatterns(
  workspaceId: string,
  signals: AgentExecutionLearningSignalRecord[],
): Promise<AgentExecutionReviewDecisionPatternRecord[]> {
  const results: AgentExecutionReviewDecisionPatternRecord[] = [];

  // Group by signalType as decisionType proxy
  const byType = new Map<string, AgentExecutionLearningSignalRecord[]>();
  for (const sig of signals) {
    if (sig.signalCategory !== "outcome" && sig.signalCategory !== "review") continue;
    const key = sig.signalType;
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(sig);
  }

  for (const [decisionType, typeSigs] of byType) {
    if (typeSigs.length === 0) continue;
    const trend: import("./agent-execution-learning-types").AgentExecutionTrendDirection =
      typeSigs.length >= 5 ? "stable" : "insufficient_data";

    const record = await createAgentExecutionReviewDecisionPattern({
      workspaceId,
      decisionType,
      count: typeSigs.length,
      trendDirection: trend,
    });

    results.push(record);

    await recordAgentExecutionLearningEvent({
      workspaceId,
      eventType: "review_decision_pattern_created",
      message: `Review pattern: ${decisionType} count=${typeSigs.length}`,
    });
  }

  return results;
}

// ─── Review Routing Feedback ──────────────────────────────────────────────────

export async function generateReviewRoutingFeedback(
  workspaceId: string,
  signals: AgentExecutionLearningSignalRecord[],
): Promise<AgentExecutionReviewRoutingFeedbackRecord[]> {
  const results: AgentExecutionReviewRoutingFeedbackRecord[] = [];
  const reviewSignals = signals.filter((s) => s.signalCategory === "review");

  if (reviewSignals.length === 0) return results;

  const effectiveCount = reviewSignals.filter((s) => s.signalType === "review_route_effective").length;
  const ineffectiveCount = reviewSignals.filter((s) => s.signalType === "review_route_ineffective").length;
  const effectiveness: import("./agent-execution-learning-types").AgentExecutionRouteEffectiveness =
    effectiveCount > ineffectiveCount ? "effective"
    : ineffectiveCount > effectiveCount ? "ineffective"
    : "unknown";

  const record = await createAgentExecutionReviewRoutingFeedback({
    workspaceId,
    routeEffectiveness: effectiveness,
    suggestedRouteAdjustment: effectiveness === "ineffective" ? "review_routing_requires_assessment" : null,
  });

  results.push(record);

  await recordAgentExecutionLearningEvent({
    workspaceId,
    eventType: "review_routing_feedback_created",
    message: `Review routing: ${effectiveness}`,
  });

  return results;
}

// ─── Workspace Learning Summary ───────────────────────────────────────────────

export async function generateWorkspaceLearningSummary(
  input: GenerateWorkspaceLearningSummaryInput,
): Promise<AgentExecutionWorkspaceLearningSummaryRecord> {
  const normalized = normalizeGenerateWorkspaceLearningSummaryInput(input);
  const { workspaceId, periodStart, periodEnd, actorId } = normalized;

  const signals = await listAgentExecutionLearningSignals(workspaceId, { limit: 1000 });
  const feedback = await listAgentExecutionGovernanceFeedback(workspaceId, { limit: 100 });

  // Count by type
  const typeCounts: Record<string, number> = {};
  for (const sig of signals) {
    typeCounts[sig.signalType] = (typeCounts[sig.signalType] ?? 0) + 1;
  }

  const topSignalsJson: Record<string, unknown> = { byType: typeCounts };
  const recommendationsJson: Record<string, unknown> = {
    governanceFeedbackCount: feedback.length,
    totalSignals: signals.length,
  };

  const confidenceScore = calculateLearningConfidence({
    sourceAvailable: signals.length > 0,
    privacySafe: true,
    humanDecisionPresent: signals.some((s) => s.signalType === "outcome_accepted" || s.signalType === "outcome_rejected"),
  });

  const summary = await createAgentExecutionWorkspaceLearningSummary({
    workspaceId,
    periodStart,
    periodEnd,
    totalSignals: signals.length,
    governanceFeedbackCount: feedback.length,
    riskCalibrationCount: signals.filter((s) => s.signalCategory === "risk").length,
    evidenceQualityCount: signals.filter((s) => s.signalCategory === "evidence").length,
    adapterPerformanceCount: signals.filter((s) => s.signalCategory === "adapter").length,
    reviewPatternCount: signals.filter((s) => s.signalCategory === "review").length,
    topSignalsJson,
    recommendationsJson,
    confidenceScore,
  });

  await recordAgentExecutionLearningEvent({
    workspaceId,
    eventType: "workspace_learning_summary_created",
    message: `Workspace summary: ${signals.length} signals, ${feedback.length} feedback`,
    actorId,
  });

  await tryAuditEvent({
    workspaceId,
    title: "Workspace learning summary generated",
    eventType: "execution_learning_signal_created",
    actorId,
  });

  return summary;
}

// ─── Aggregate Signal ─────────────────────────────────────────────────────────

export async function createPrivacySafeAggregateSignal(input: {
  workspaceId: string;
  signalType: AgentExecutionLearningSignalType;
  signalCategory: AgentExecutionLearningSignalCategory;
  count: number;
  threshold: number;
}): Promise<AgentExecutionAggregateLearningSignalRecord | null> {
  if (input.count < input.threshold) return null;

  const record = await createAgentExecutionAggregateLearningSignal({
    aggregateScope: "workspace",
    workspaceId: input.workspaceId,
    signalType: input.signalType,
    signalCategory: input.signalCategory,
    count: input.count,
    thresholdMet: true,
    privacySafe: true,
  });

  await recordAgentExecutionLearningEvent({
    workspaceId: input.workspaceId,
    eventType: "aggregate_signal_created",
    message: `Aggregate signal: ${input.signalType} count=${input.count}`,
  });

  return record;
}

// ─── Archive Signal ───────────────────────────────────────────────────────────

export async function archiveLearningSignal(
  workspaceId: string,
  signalId: string,
  actorId?: string | null,
): Promise<AgentExecutionLearningSignalRecord | null> {
  const updated = await updateAgentExecutionLearningSignalStatus(workspaceId, signalId, "archived");
  if (!updated) return null;

  await recordAgentExecutionLearningEvent({
    workspaceId,
    signalId,
    eventType: "learning_signal_archived",
    message: "Signal archived",
    actorId,
  });

  return updated;
}

// ─── Build Summary ────────────────────────────────────────────────────────────

export async function buildExecutionLearningSummary(workspaceId: string): Promise<{
  totalSignals: number;
  activeSignals: number;
  archivedSignals: number;
  blockedSignals: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}> {
  const signals = await listAgentExecutionLearningSignals(workspaceId, { limit: 1000 });

  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const sig of signals) {
    byCategory[sig.signalCategory] = (byCategory[sig.signalCategory] ?? 0) + 1;
    byType[sig.signalType] = (byType[sig.signalType] ?? 0) + 1;
  }

  return {
    totalSignals: signals.length,
    activeSignals: signals.filter((s) => s.status === "active").length,
    archivedSignals: signals.filter((s) => s.status === "archived").length,
    blockedSignals: signals.filter((s) => s.status === "privacy_blocked").length,
    byCategory,
    byType,
  };
}

// ─── Re-exports from registry for API route use ───────────────────────────────
export {
  getAgentExecutionLearningSignalById,
  listAgentExecutionLearningSignals,
  listAgentExecutionGovernanceFeedback,
  updateAgentExecutionGovernanceFeedbackStatus,
  listAgentExecutionLearningEvents,
  _clearLearningStores,
} from "./agent-execution-learning-registry";
