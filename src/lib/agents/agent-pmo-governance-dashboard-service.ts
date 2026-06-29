// ─── Controlled PMO Governance Intelligence Dashboard — Service ───────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT mutate policies, routing, risk scoring, or project state.
// All operations are deterministic.

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
  AgentPmoGovernanceFeedbackQueueStatus,
  CreatePmoPolicyProposalInput,
  ReviewPmoPolicyProposalInput,
  GenerateGovernanceReportExportInput,
} from "./agent-pmo-governance-dashboard-types";

import {
  deriveGovernanceInsightSeverity,
  deriveGovernanceActionability,
  validateGovernanceReportExportSafety,
  sanitizeGovernanceDashboardText,
} from "./agent-pmo-governance-dashboard-validation";

import {
  createGovernanceDashboardSnapshot,
  listGovernanceDashboardSnapshots,
  createGovernanceInsightCard,
  listGovernanceInsightCards,
  createRiskCalibrationInsight,
  listRiskCalibrationInsights,
  createEvidenceQualityInsight,
  listEvidenceQualityInsights,
  createAdapterPerformanceInsight,
  listAdapterPerformanceInsights,
  createReviewRoutingInsight,
  listReviewRoutingInsights,
  createFeedbackQueueItem,
  listFeedbackQueueItems,
  updateFeedbackQueueItemStatus,
  createPolicyProposal,
  getPolicyProposalById,
  listPolicyProposals,
  recordPolicyProposalReview,
  createReportExport,
  getReportExportById,
  listReportExports,
  incrementReportExportDownloadCount,
  recordDashboardEvent,
  listDashboardEvents,
} from "./agent-pmo-governance-dashboard-registry";

import {
  listAgentExecutionLearningSignals,
  listAgentExecutionGovernanceFeedback,
} from "./agent-execution-learning-registry";

// ─── Snapshot Generation ──────────────────────────────────────────────────────

export async function generatePmoGovernanceDashboardSnapshot(input: {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  actorId?: string | null;
}): Promise<AgentPmoGovernanceDashboardSnapshotRecord> {
  const signals = await listAgentExecutionLearningSignals(input.workspaceId);
  const feedback = await listAgentExecutionGovernanceFeedback(input.workspaceId);

  const totalLearningSignals = signals.length;
  const activeLearningSignals = signals.filter((s) => s.status === "active").length;
  const privacyBlockedSignals = signals.filter((s) => s.status === "privacy_blocked").length;
  const openGovernanceFeedback = feedback.filter((f) => f.status === "open" || f.status === "created").length;

  const existingRiskInsights = await listRiskCalibrationInsights(input.workspaceId);
  const existingEvidenceInsights = await listEvidenceQualityInsights(input.workspaceId);
  const existingAdapterInsights = await listAdapterPerformanceInsights(input.workspaceId);
  const existingRoutingInsights = await listReviewRoutingInsights(input.workspaceId);
  const existingProposals = await listPolicyProposals(input.workspaceId);

  const snapshot = await createGovernanceDashboardSnapshot({
    workspaceId: input.workspaceId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalLearningSignals,
    activeLearningSignals,
    privacyBlockedSignals,
    openGovernanceFeedback,
    riskCalibrationCount: existingRiskInsights.length,
    evidenceQualityIssueCount: existingEvidenceInsights.filter((e) => e.missingEvidenceCount > 0).length,
    adapterQualityIssueCount: existingAdapterInsights.filter((a) => a.failureCount > a.successCount).length,
    reviewRoutingIssueCount: existingRoutingInsights.filter((r) => r.routeEffectiveness === "ineffective").length,
    policyProposalCount: existingProposals.length,
    topCardsJson: {},
    safeSnapshotPayload: null,
    createdBy: input.actorId ?? null,
  });

  await recordDashboardEvent({
    workspaceId: input.workspaceId,
    snapshotId: snapshot.id,
    eventType: "dashboard_snapshot_created",
    actorId: input.actorId ?? null,
  });

  return snapshot;
}

// ─── Insight Card Generation ──────────────────────────────────────────────────

export async function generatePmoGovernanceInsightCards(input: {
  workspaceId: string;
  snapshotId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoGovernanceInsightCardRecord[]> {
  const signals = await listAgentExecutionLearningSignals(input.workspaceId);
  const feedback = await listAgentExecutionGovernanceFeedback(input.workspaceId);
  const riskInsights = await listRiskCalibrationInsights(input.workspaceId);
  const evidenceInsights = await listEvidenceQualityInsights(input.workspaceId);
  const adapterInsights = await listAdapterPerformanceInsights(input.workspaceId);
  const routingInsights = await listReviewRoutingInsights(input.workspaceId);
  const proposals = await listPolicyProposals(input.workspaceId);
  const privacyBlocked = signals.filter((s) => s.status === "privacy_blocked").length;

  const cardDefs: Array<{
    cardType: AgentPmoGovernanceInsightCardRecord["cardType"];
    title: string;
    summary: string;
    metricValue: number;
  }> = [
    {
      cardType: "learning_signal_volume",
      title: "Learning Signal Volume",
      summary: `${signals.length} governance learning signals recorded in this workspace.`,
      metricValue: signals.length,
    },
    {
      cardType: "privacy_health",
      title: "Privacy Health",
      summary: `${privacyBlocked} signals privacy-blocked. ${signals.length - privacyBlocked} signals active and privacy-safe.`,
      metricValue: privacyBlocked,
    },
    {
      cardType: "governance_feedback",
      title: "Governance Feedback Queue",
      summary: `${feedback.length} governance feedback records. ${feedback.filter((f) => f.status === "open" || f.status === "created").length} open items require PMO attention.`,
      metricValue: feedback.filter((f) => f.status === "open" || f.status === "created").length,
    },
    {
      cardType: "risk_calibration",
      title: "Risk Calibration",
      summary: `${riskInsights.length} risk calibration insights recorded.`,
      metricValue: riskInsights.filter((r) => r.underestimatedCount > r.alignedCount).length,
    },
    {
      cardType: "evidence_quality",
      title: "Evidence Quality",
      summary: `${evidenceInsights.length} evidence quality insights. ${evidenceInsights.filter((e) => e.missingEvidenceCount > 0).length} evidence gaps detected.`,
      metricValue: evidenceInsights.filter((e) => e.missingEvidenceCount > 0).length,
    },
    {
      cardType: "adapter_performance",
      title: "Adapter Performance",
      summary: `${adapterInsights.length} adapter performance insights recorded.`,
      metricValue: adapterInsights.filter((a) => a.failureCount > a.successCount).length,
    },
    {
      cardType: "review_routing",
      title: "Review Routing",
      summary: `${routingInsights.length} review routing insights. ${routingInsights.filter((r) => r.routeEffectiveness === "ineffective").length} ineffective routing patterns detected.`,
      metricValue: routingInsights.filter((r) => r.routeEffectiveness === "ineffective").length,
    },
    {
      cardType: "policy_proposal",
      title: "Policy Proposals",
      summary: `${proposals.length} governance policy proposals. ${proposals.filter((p) => p.status === "open" || p.status === "under_review").length} require PMO review.`,
      metricValue: proposals.filter((p) => p.status === "open" || p.status === "under_review").length,
    },
    {
      cardType: "workspace_summary",
      title: "Workspace Governance Summary",
      summary: `Governance intelligence summary: ${signals.length} signals, ${feedback.length} feedback items, ${proposals.length} proposals.`,
      metricValue: signals.length,
    },
  ];

  const cards: AgentPmoGovernanceInsightCardRecord[] = [];

  for (const def of cardDefs) {
    const severity = deriveGovernanceInsightSeverity({
      cardType: def.cardType,
      metricValue: def.metricValue,
      sourceCount: def.metricValue,
    });
    const actionability = deriveGovernanceActionability({
      severity,
      cardType: def.cardType,
      sourceCount: def.metricValue,
    });
    const card = await createGovernanceInsightCard({
      workspaceId: input.workspaceId,
      snapshotId: input.snapshotId ?? null,
      cardType: def.cardType,
      title: sanitizeGovernanceDashboardText(def.title, 160),
      severity,
      summary: sanitizeGovernanceDashboardText(def.summary, 600),
      metricValue: def.metricValue,
      trendDirection: "insufficient_data",
      actionability,
      createdBy: input.actorId ?? null,
    });
    cards.push(card);
    await recordDashboardEvent({
      workspaceId: input.workspaceId,
      snapshotId: input.snapshotId ?? null,
      cardId: card.id,
      eventType: "insight_card_created",
      actorId: input.actorId ?? null,
    });
  }

  return cards;
}

// ─── Risk Calibration Insights ────────────────────────────────────────────────

export async function generatePmoRiskCalibrationInsights(input: {
  workspaceId: string;
  snapshotId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoRiskCalibrationInsightRecord[]> {
  const signals = await listAgentExecutionLearningSignals(input.workspaceId);
  const riskSignals = signals.filter((s) => s.signalCategory === "risk");

  const underestimatedCount = riskSignals.filter((s) => s.signalType === "risk_underestimated").length;
  const overestimatedCount = riskSignals.filter((s) => s.signalType === "risk_overestimated").length;
  const alignedCount = riskSignals.filter((s) => s.signalType === "risk_aligned").length;
  const unknownCount = riskSignals.length - underestimatedCount - overestimatedCount - alignedCount;

  let recommendedReviewPosture: AgentPmoRiskCalibrationInsightRecord["recommendedReviewPosture"] = "maintain";
  if (underestimatedCount > alignedCount) recommendedReviewPosture = "increase_review";
  else if (overestimatedCount > alignedCount) recommendedReviewPosture = "investigate";
  else if (riskSignals.length === 0) recommendedReviewPosture = "investigate";

  const insight = await createRiskCalibrationInsight({
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    underestimatedCount,
    overestimatedCount,
    alignedCount,
    unknownCount: Math.max(0, unknownCount),
    topActionTypes: [],
    topAdapterKeys: [],
    recommendedReviewPosture,
    confidenceScore: riskSignals.length > 0 ? Math.min(100, riskSignals.length * 10) : 0,
  });

  return [insight];
}

// ─── Evidence Quality Insights ────────────────────────────────────────────────

export async function generatePmoEvidenceQualityInsights(input: {
  workspaceId: string;
  snapshotId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoEvidenceQualityInsightRecord[]> {
  const signals = await listAgentExecutionLearningSignals(input.workspaceId);
  const evidenceSignals = signals.filter((s) => s.signalCategory === "evidence");
  const missingEvidenceCount = evidenceSignals.filter((s) => s.signalType === "evidence_missing").length;

  let recommendedEvidencePosture: AgentPmoEvidenceQualityInsightRecord["recommendedEvidencePosture"] = "maintain";
  if (missingEvidenceCount > 3) recommendedEvidencePosture = "tighten";
  else if (evidenceSignals.length === 0) recommendedEvidencePosture = "investigate";

  const insight = await createEvidenceQualityInsight({
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    missingEvidenceCount,
    topMissingEvidenceTypes: [],
    affectedActionTypes: [],
    affectedAdapterKeys: [],
    completenessDistribution: {},
    recommendedEvidencePosture,
    confidenceScore: evidenceSignals.length > 0 ? Math.min(100, evidenceSignals.length * 10) : 0,
  });

  return [insight];
}

// ─── Adapter Performance Insights ─────────────────────────────────────────────

export async function generatePmoAdapterPerformanceInsights(input: {
  workspaceId: string;
  snapshotId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoAdapterPerformanceInsightRecord[]> {
  const signals = await listAgentExecutionLearningSignals(input.workspaceId);
  const adapterSignals = signals.filter((s) => s.signalCategory === "adapter" && s.adapterKey);

  const adapterKeys = [...new Set(adapterSignals.map((s) => s.adapterKey as string))];
  if (adapterKeys.length === 0) {
    const insight = await createAdapterPerformanceInsight({
      workspaceId: input.workspaceId,
      snapshotId: input.snapshotId ?? null,
      adapterKey: "none",
      trendDirection: "insufficient_data",
    });
    return [insight];
  }

  const insights: AgentPmoAdapterPerformanceInsightRecord[] = [];
  for (const adapterKey of adapterKeys) {
    const keySignals = adapterSignals.filter((s) => s.adapterKey === adapterKey);
    const positiveCount = keySignals.filter((s) => s.signalType === "adapter_quality_positive").length;
    const negativeCount = keySignals.filter((s) => s.signalType === "adapter_quality_negative").length;
    const insight = await createAdapterPerformanceInsight({
      workspaceId: input.workspaceId,
      snapshotId: input.snapshotId ?? null,
      adapterKey,
      successCount: positiveCount,
      failureCount: negativeCount,
      trendDirection: negativeCount > positiveCount ? "worsening" : positiveCount > 0 ? "stable" : "insufficient_data",
    });
    insights.push(insight);
  }
  return insights;
}

// ─── Review Routing Insights ──────────────────────────────────────────────────

export async function generatePmoReviewRoutingInsights(input: {
  workspaceId: string;
  snapshotId?: string | null;
  actorId?: string | null;
}): Promise<AgentPmoReviewRoutingInsightRecord[]> {
  const signals = await listAgentExecutionLearningSignals(input.workspaceId);
  const routingSignals = signals.filter((s) => s.signalCategory === "review");
  const effectiveCount = routingSignals.filter((s) => s.signalType === "review_route_effective").length;
  const ineffectiveCount = routingSignals.filter((s) => s.signalType === "review_route_ineffective").length;

  const overallEffectiveness: AgentPmoReviewRoutingInsightRecord["routeEffectiveness"] =
    routingSignals.length === 0
      ? "unknown"
      : ineffectiveCount > effectiveCount
      ? "ineffective"
      : "effective";

  const insight = await createReviewRoutingInsight({
    workspaceId: input.workspaceId,
    snapshotId: input.snapshotId ?? null,
    routeEffectiveness: overallEffectiveness,
    confidenceScore: routingSignals.length > 0 ? Math.min(100, routingSignals.length * 10) : 0,
  });

  return [insight];
}

// ─── Feedback Queue ───────────────────────────────────────────────────────────

export async function buildPmoGovernanceFeedbackQueue(input: {
  workspaceId: string;
  actorId?: string | null;
}): Promise<AgentPmoGovernanceFeedbackQueueRecord[]> {
  const feedbackRecords = await listAgentExecutionGovernanceFeedback(input.workspaceId);
  const existingQueue = await listFeedbackQueueItems(input.workspaceId);
  const existingFeedbackIds = new Set(existingQueue.map((q) => q.feedbackId));

  const newItems: AgentPmoGovernanceFeedbackQueueRecord[] = [];
  for (const fb of feedbackRecords) {
    if (existingFeedbackIds.has(fb.id)) continue;
    const severityVal = fb.severity as AgentPmoGovernanceFeedbackQueueRecord["severity"];
    const item = await createFeedbackQueueItem({
      workspaceId: input.workspaceId,
      feedbackId: fb.id,
      feedbackType: fb.feedbackType,
      feedbackCategory: fb.feedbackType,
      severity: severityVal ?? "info",
      recommendation: sanitizeGovernanceDashboardText(fb.recommendation ?? "Review governance feedback.", 1000),
      sourceSignalCount: 0,
    });
    newItems.push(item);
  }

  return [...existingQueue, ...newItems];
}

export async function reviewPmoGovernanceFeedbackQueueItem(input: {
  workspaceId: string;
  queueItemId: string;
  status: AgentPmoGovernanceFeedbackQueueStatus;
  reviewRationale: string;
  actorId?: string | null;
}): Promise<AgentPmoGovernanceFeedbackQueueRecord> {
  const updated = await updateFeedbackQueueItemStatus(
    input.workspaceId,
    input.queueItemId,
    input.status,
    input.actorId ?? null,
    sanitizeGovernanceDashboardText(input.reviewRationale, 4000),
  );
  if (!updated) {
    throw new Error(`Feedback queue item not found: ${input.queueItemId}`);
  }
  await recordDashboardEvent({
    workspaceId: input.workspaceId,
    feedbackQueueId: input.queueItemId,
    eventType: "governance_feedback_reviewed",
    actorId: input.actorId ?? null,
  });
  return updated;
}

// ─── Policy Proposals ─────────────────────────────────────────────────────────

export async function createPmoPolicyProposalFromFeedback(input: {
  workspaceId: string;
  feedbackId: string;
  feedbackType?: string;
  recommendation?: string;
  proposalCategory?: string;
  actorId?: string | null;
}): Promise<AgentPmoPolicyProposalRecord> {
  const feedbackType = input.feedbackType ?? "governance_observation";
  const proposalTypeMap: Record<string, AgentPmoPolicyProposalRecord["proposalType"]> = {
    risk_calibration: "risk_policy",
    evidence_requirement: "evidence_requirement",
    adapter_quality: "adapter_quality_review",
    review_routing: "review_routing",
    human_review_policy: "human_review_policy",
    triage_policy: "triage_policy",
  };
  const proposalType: AgentPmoPolicyProposalRecord["proposalType"] =
    proposalTypeMap[feedbackType] ?? "governance_process";

  const summary = sanitizeGovernanceDashboardText(
    input.recommendation ?? "Governance policy review recommended based on feedback signals.",
    1000,
  );

  const proposal = await createPolicyProposal({
    workspaceId: input.workspaceId,
    proposalType,
    proposalCategory: input.proposalCategory ?? feedbackType,
    sourceFeedbackIds: [input.feedbackId],
    proposedChangeSummary: summary,
    riskLevel: "medium",
    status: "open",
    createdBy: input.actorId ?? null,
  });

  await recordDashboardEvent({
    workspaceId: input.workspaceId,
    policyProposalId: proposal.id,
    eventType: "policy_proposal_created",
    actorId: input.actorId ?? null,
  });

  return proposal;
}

export async function createPmoPolicyProposal(input: CreatePmoPolicyProposalInput): Promise<AgentPmoPolicyProposalRecord> {
  const proposal = await createPolicyProposal({
    workspaceId: input.workspaceId,
    proposalType: input.proposalType,
    proposalCategory: input.proposalCategory,
    sourceFeedbackIds: input.sourceFeedbackIds ?? [],
    sourceSignalIds: input.sourceSignalIds ?? [],
    proposedChangeSummary: input.proposedChangeSummary,
    riskLevel: input.riskLevel,
    status: "open",
    createdBy: input.createdBy ?? null,
  });
  await recordDashboardEvent({
    workspaceId: input.workspaceId,
    policyProposalId: proposal.id,
    eventType: "policy_proposal_created",
    actorId: input.createdBy ?? null,
  });
  return proposal;
}

export async function reviewPmoPolicyProposal(input: ReviewPmoPolicyProposalInput): Promise<AgentPmoPolicyProposalRecord> {
  const updated = await recordPolicyProposalReview(
    input.workspaceId,
    input.proposalId,
    input.decision,
    input.reviewedBy ?? null,
    sanitizeGovernanceDashboardText(input.reviewRationale, 4000),
  );
  if (!updated) {
    throw new Error(`Policy proposal not found: ${input.proposalId}`);
  }
  await recordDashboardEvent({
    workspaceId: input.workspaceId,
    policyProposalId: input.proposalId,
    eventType: "policy_proposal_reviewed",
    actorId: input.reviewedBy ?? null,
  });
  return updated;
}

// ─── Report Export ────────────────────────────────────────────────────────────

export async function generatePmoGovernanceReportExport(
  input: GenerateGovernanceReportExportInput,
): Promise<AgentPmoGovernanceReportExportRecord> {
  const snapshots = await listGovernanceDashboardSnapshots(input.workspaceId, { limit: 1 });
  const latestSnapshot = input.snapshotId
    ? snapshots.find((s) => s.id === input.snapshotId) ?? null
    : snapshots[0] ?? null;

  const cards = await listGovernanceInsightCards(input.workspaceId, { limit: 20 });
  const riskInsights = await listRiskCalibrationInsights(input.workspaceId, { limit: 5 });
  const evidenceInsights = await listEvidenceQualityInsights(input.workspaceId, { limit: 5 });
  const adapterInsights = await listAdapterPerformanceInsights(input.workspaceId, { limit: 10 });
  const routingInsights = await listReviewRoutingInsights(input.workspaceId, { limit: 5 });
  const feedbackQueue = await listFeedbackQueueItems(input.workspaceId, { limit: 20 });
  const proposals = await listPolicyProposals(input.workspaceId, { limit: 20 });

  const safeReport = {
    workspaceId: input.workspaceId,
    period: { start: input.periodStart, end: input.periodEnd },
    generatedAt: new Date().toISOString(),
    snapshot: latestSnapshot
      ? {
          id: latestSnapshot.id,
          totalLearningSignals: latestSnapshot.totalLearningSignals,
          activeLearningSignals: latestSnapshot.activeLearningSignals,
          privacyBlockedSignals: latestSnapshot.privacyBlockedSignals,
          openGovernanceFeedback: latestSnapshot.openGovernanceFeedback,
          riskCalibrationCount: latestSnapshot.riskCalibrationCount,
          evidenceQualityIssueCount: latestSnapshot.evidenceQualityIssueCount,
          adapterQualityIssueCount: latestSnapshot.adapterQualityIssueCount,
          reviewRoutingIssueCount: latestSnapshot.reviewRoutingIssueCount,
          policyProposalCount: latestSnapshot.policyProposalCount,
        }
      : null,
    insightCards: cards.map((c) => ({
      cardType: c.cardType,
      title: c.title,
      severity: c.severity,
      summary: c.summary,
      metricValue: c.metricValue,
      trendDirection: c.trendDirection,
      actionability: c.actionability,
    })),
    riskCalibration: riskInsights.map((r) => ({
      underestimatedCount: r.underestimatedCount,
      overestimatedCount: r.overestimatedCount,
      alignedCount: r.alignedCount,
      recommendedReviewPosture: r.recommendedReviewPosture,
    })),
    evidenceQuality: evidenceInsights.map((e) => ({
      missingEvidenceCount: e.missingEvidenceCount,
      recommendedEvidencePosture: e.recommendedEvidencePosture,
    })),
    adapterPerformance: adapterInsights.map((a) => ({
      adapterKey: a.adapterKey,
      successCount: a.successCount,
      failureCount: a.failureCount,
      trendDirection: a.trendDirection,
    })),
    reviewRouting: routingInsights.map((r) => ({
      routeEffectiveness: r.routeEffectiveness,
      confidenceScore: r.confidenceScore,
    })),
    feedbackQueueSummary: {
      total: feedbackQueue.length,
      open: feedbackQueue.filter((f) => f.status === "open").length,
      reviewed: feedbackQueue.filter((f) => f.status === "reviewed").length,
      accepted: feedbackQueue.filter((f) => f.status === "accepted").length,
      rejected: feedbackQueue.filter((f) => f.status === "rejected").length,
    },
    policyProposals: proposals.map((p) => ({
      proposalType: p.proposalType,
      proposalCategory: p.proposalCategory,
      proposedChangeSummary: p.proposedChangeSummary,
      riskLevel: p.riskLevel,
      status: p.status,
      reviewDecision: p.reviewDecision,
    })),
    privacyStatement:
      "This report contains no raw payloads, customer identifiers, project identifiers, user free text, rationale, failure messages, correction reasons, secrets, or tokens.",
    nonGoalsStatement:
      "This report does not imply automatic policy mutation, routing mutation, risk scoring mutation, or AI-generated recommendations. Approved policy proposals are future backlog candidates only.",
  };

  const safetyCheck = validateGovernanceReportExportSafety({ contentJson: safeReport });

  let contentText: string | null = null;
  if (input.exportFormat === "markdown") {
    contentText = buildMarkdownReport(safeReport);
  } else if (input.exportFormat === "csv") {
    contentText = buildCsvReport(safeReport);
  }

  const fileName = `governance-report-${input.workspaceId}-${input.periodStart.slice(0, 10)}.${input.exportFormat}`;
  const contentType =
    input.exportFormat === "markdown" ? "text/markdown" : input.exportFormat === "csv" ? "text/csv" : "application/json";

  const exportRecord = await createReportExport({
    workspaceId: input.workspaceId,
    snapshotId: latestSnapshot?.id ?? null,
    exportFormat: input.exportFormat,
    status: safetyCheck.safe ? "generated" : "failed",
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    fileName,
    contentType,
    contentText,
    contentJson: input.exportFormat === "json" ? safeReport : null,
    safeExportPayload: safeReport,
    generatedBy: input.generatedBy ?? null,
  });

  await recordDashboardEvent({
    workspaceId: input.workspaceId,
    snapshotId: latestSnapshot?.id ?? null,
    exportId: exportRecord.id,
    eventType: "governance_report_export_created",
    actorId: input.generatedBy ?? null,
  });

  return exportRecord;
}

function buildMarkdownReport(report: {
  workspaceId: string;
  period: { start: string; end: string };
  generatedAt: string;
  snapshot: { totalLearningSignals: number; privacyBlockedSignals: number } | null;
  feedbackQueueSummary: { total: number; open: number };
  policyProposals: Array<{ proposalType: string; status: string }>;
  privacyStatement: string;
  nonGoalsStatement: string;
}): string {
  return [
    "# PMO Governance Intelligence Report",
    `**Workspace:** ${report.workspaceId}`,
    `**Period:** ${report.period.start} — ${report.period.end}`,
    `**Generated:** ${report.generatedAt}`,
    "",
    "## Summary",
    report.snapshot
      ? `- Total Learning Signals: ${report.snapshot.totalLearningSignals}\n- Privacy Blocked: ${report.snapshot.privacyBlockedSignals}`
      : "- No snapshot data available.",
    "",
    "## Feedback Queue",
    `- Total: ${report.feedbackQueueSummary.total} | Open: ${report.feedbackQueueSummary.open}`,
    "",
    "## Policy Proposals",
    report.policyProposals.length > 0
      ? report.policyProposals.map((p) => `- [${p.status}] ${p.proposalType}`).join("\n")
      : "No policy proposals.",
    "",
    "## Privacy Statement",
    report.privacyStatement,
    "",
    "## Non-Goals",
    report.nonGoalsStatement,
  ].join("\n");
}

function buildCsvReport(report: {
  workspaceId: string;
  period: { start: string; end: string };
  policyProposals: Array<{ proposalType: string; status: string; riskLevel: string }>;
}): string {
  const rows = [
    ["workspaceId", "periodStart", "periodEnd", "proposalType", "status", "riskLevel"],
    ...report.policyProposals.map((p) => [
      report.workspaceId,
      report.period.start,
      report.period.end,
      p.proposalType,
      p.status,
      p.riskLevel,
    ]),
  ];
  return rows.map((row) => row.join(",")).join("\n");
}

export async function downloadPmoGovernanceReportExport(input: {
  workspaceId: string;
  exportId: string;
  actorId?: string | null;
}): Promise<AgentPmoGovernanceReportExportRecord> {
  const record = await getReportExportById(input.workspaceId, input.exportId);
  if (!record) throw new Error(`Export not found: ${input.exportId}`);
  const updated = await incrementReportExportDownloadCount(input.workspaceId, input.exportId);
  await recordDashboardEvent({
    workspaceId: input.workspaceId,
    exportId: input.exportId,
    eventType: "governance_report_export_downloaded",
    actorId: input.actorId ?? null,
  });
  return updated ?? record;
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export async function buildPmoGovernanceDashboardSummary(workspaceId: string): Promise<Record<string, unknown>> {
  const snapshots = await listGovernanceDashboardSnapshots(workspaceId, { limit: 1 });
  const latestSnapshot = snapshots[0] ?? null;
  const cards = await listGovernanceInsightCards(workspaceId, { limit: 50 });
  const feedbackQueue = await listFeedbackQueueItems(workspaceId, { limit: 100 });
  const proposals = await listPolicyProposals(workspaceId, { limit: 100 });
  const exports = await listReportExports(workspaceId, { limit: 20 });

  const severityOrder: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  const highestSeverityCard = cards.reduce(
    (best, c) =>
      !best || (severityOrder[c.severity] ?? 0) > (severityOrder[best.severity] ?? 0) ? c : best,
    null as AgentPmoGovernanceInsightCardRecord | null,
  );

  return {
    latestSnapshotId: latestSnapshot?.id ?? null,
    totalSignals: latestSnapshot?.totalLearningSignals ?? 0,
    activeSignals: latestSnapshot?.activeLearningSignals ?? 0,
    privacyBlockedSignals: latestSnapshot?.privacyBlockedSignals ?? 0,
    openFeedbackCount: feedbackQueue.filter((f) => f.status === "open").length,
    riskCalibrationIssueCount: latestSnapshot?.riskCalibrationCount ?? 0,
    evidenceQualityIssueCount: latestSnapshot?.evidenceQualityIssueCount ?? 0,
    adapterQualityIssueCount: latestSnapshot?.adapterQualityIssueCount ?? 0,
    reviewRoutingIssueCount: latestSnapshot?.reviewRoutingIssueCount ?? 0,
    openPolicyProposals: proposals.filter((p) => p.status === "open" || p.status === "under_review").length,
    approvedForFutureProposals: proposals.filter((p) => p.status === "approved_for_future_implementation").length,
    exportsGenerated: exports.length,
    highestSeverityCard: highestSeverityCard?.severity ?? "info",
    oldestOpenFeedbackId:
      feedbackQueue
        .filter((f) => f.status === "open")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id ?? null,
  };
}

// ─── Full Dashboard Data ──────────────────────────────────────────────────────

export async function getPmoGovernanceDashboardData(input: {
  workspaceId: string;
  periodStart?: string;
  periodEnd?: string;
  actorId?: string | null;
}): Promise<{
  snapshot: AgentPmoGovernanceDashboardSnapshotRecord | null;
  cards: AgentPmoGovernanceInsightCardRecord[];
  riskCalibration: AgentPmoRiskCalibrationInsightRecord[];
  evidenceQuality: AgentPmoEvidenceQualityInsightRecord[];
  adapterPerformance: AgentPmoAdapterPerformanceInsightRecord[];
  reviewRouting: AgentPmoReviewRoutingInsightRecord[];
  feedbackQueue: AgentPmoGovernanceFeedbackQueueRecord[];
  policyProposals: AgentPmoPolicyProposalRecord[];
  reportExports: AgentPmoGovernanceReportExportRecord[];
  summary: Record<string, unknown>;
}> {
  const snapshots = await listGovernanceDashboardSnapshots(input.workspaceId, { limit: 1 });
  const snapshot = snapshots[0] ?? null;
  const [
    cards,
    riskCalibration,
    evidenceQuality,
    adapterPerformance,
    reviewRouting,
    feedbackQueue,
    policyProposals,
    reportExports,
    summary,
  ] = await Promise.all([
    listGovernanceInsightCards(input.workspaceId),
    listRiskCalibrationInsights(input.workspaceId),
    listEvidenceQualityInsights(input.workspaceId),
    listAdapterPerformanceInsights(input.workspaceId),
    listReviewRoutingInsights(input.workspaceId),
    listFeedbackQueueItems(input.workspaceId),
    listPolicyProposals(input.workspaceId),
    listReportExports(input.workspaceId),
    buildPmoGovernanceDashboardSummary(input.workspaceId),
  ]);

  await recordDashboardEvent({
    workspaceId: input.workspaceId,
    eventType: "dashboard_summary_viewed",
    actorId: input.actorId ?? null,
  });

  return {
    snapshot,
    cards,
    riskCalibration,
    evidenceQuality,
    adapterPerformance,
    reviewRouting,
    feedbackQueue,
    policyProposals,
    reportExports,
    summary,
  };
}

export {
  getPolicyProposalById,
  getReportExportById,
  listGovernanceDashboardSnapshots,
  listPolicyProposals,
  listReportExports,
  listDashboardEvents,
};
