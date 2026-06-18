// ─────────────────────────────────────────────────────────────────────────────
// Operational Brief — Builder
//
// Transforms a ConstitutionalBrief into an OperationalBrief.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// All content is sourced exclusively from the ConstitutionalBrief.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type { ConstitutionalBrief } from "@/lib/constitutional-brief";
import {
  buildOperationalSummary,
  buildExecutionOverview,
  buildTaskOverview,
  buildMilestoneOverview,
  buildDependencyOverview,
  buildRiskOverview,
  buildBlockerOverview,
  buildEscalationOverview,
  buildCoordinationOverview,
  buildDeliveryOverview,
  buildOperationalTimelineHighlights,
  buildOperationalEvidenceSummary,
  buildOperationalSections,
} from "./operational-brief-sections";
import type {
  OperationalBrief,
  OperationalBriefHealth,
  OperationalBriefCoverageMetrics,
  OperationalBriefExplanation,
  OperationalBriefSectionReason,
  OperationalBriefResult,
  OperationalBriefSectionType,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function operationalBriefId(
  workspaceId: string,
  pmUserId: string,
  contextType: string,
  contextId: string,
  generatedAt: string
): string {
  return `op-brief:${workspaceId}:${pmUserId}:${contextType}:${contextId}:${generatedAt}`;
}

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitOperationalBriefEvent(
  workspaceId: string,
  actorId: string | null,
  eventType: string,
  briefId: string,
  correlationId: string | null,
  causationId: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  await createPlatformEvent({
    workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? briefId,
    causationId,
    rawReferenceTable: "operational_brief",
    rawReferenceId: briefId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── buildOperationalBrief ────────────────────────────────────────────────────

export async function buildOperationalBrief(
  constitutionalBrief: ConstitutionalBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<OperationalBriefResult<OperationalBrief>> {
  const { workspaceId, pmUserId, contextType, contextId } = constitutionalBrief;

  const generatedAt = new Date().toISOString();
  const id = operationalBriefId(
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt
  );

  const operationalSummary = buildOperationalSummary(constitutionalBrief);

  const executionFacts = buildExecutionOverview(constitutionalBrief).filter(
    (f) => f.factType === "execution"
  );
  const taskFacts = buildTaskOverview(constitutionalBrief);
  const milestoneFacts = buildMilestoneOverview(constitutionalBrief);
  const dependencyFacts = buildDependencyOverview(constitutionalBrief);
  const riskFacts = buildRiskOverview(constitutionalBrief);
  const blockerFacts = buildBlockerOverview(constitutionalBrief);
  const escalationFacts = buildEscalationOverview(constitutionalBrief);
  const coordinationFacts = buildCoordinationOverview(constitutionalBrief);
  const deliveryFacts = buildDeliveryOverview(constitutionalBrief);
  const timelineHighlights = buildOperationalTimelineHighlights(constitutionalBrief);
  const evidenceSummary = buildOperationalEvidenceSummary(
    constitutionalBrief,
    executionFacts,
    taskFacts,
    milestoneFacts,
    dependencyFacts,
    riskFacts,
    blockerFacts,
    escalationFacts,
    coordinationFacts,
    deliveryFacts
  );

  const sections = buildOperationalSections(
    constitutionalBrief,
    executionFacts,
    taskFacts,
    milestoneFacts,
    dependencyFacts,
    riskFacts,
    blockerFacts,
    escalationFacts,
    coordinationFacts,
    deliveryFacts,
    timelineHighlights,
    evidenceSummary
  );

  const brief: OperationalBrief = {
    id,
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt,
    sourceConstitutionalBrief: constitutionalBrief,
    operationalSummary,
    sections,
    executionFacts,
    riskFacts,
    dependencyFacts,
    milestoneFacts,
    blockerFacts,
    coordinationFacts,
    contradictions: constitutionalBrief.contradictions,
    unknowns: constitutionalBrief.unknowns,
    timelineHighlights,
    evidenceSummary,
    metadata: {},
  };

  await emitOperationalBriefEvent(
    workspaceId,
    actorId,
    "OPERATIONAL_BRIEF_GENERATED",
    id,
    correlationId,
    causationId,
    {
      pmUserId,
      contextType,
      contextId,
      sectionCount: sections.length,
      executionFactCount: executionFacts.length,
      riskFactCount: riskFacts.length,
      dependencyFactCount: dependencyFacts.length,
      milestoneFactCount: milestoneFacts.length,
      blockerFactCount: blockerFacts.length,
      coordinationFactCount: coordinationFacts.length,
      timelineCount: timelineHighlights.length,
      contradictionCount: constitutionalBrief.contradictions.length,
      unknownCount: constitutionalBrief.unknowns.length,
      sourceConstitutionalBriefId: constitutionalBrief.id,
    }
  );

  return { ok: true, data: brief };
}

// ─── explainOperationalBrief ──────────────────────────────────────────────────

export async function explainOperationalBrief(
  brief: OperationalBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<OperationalBriefResult<OperationalBriefExplanation>> {
  const sectionReasons: OperationalBriefSectionReason[] = brief.sections.map(
    (s) => ({
      sectionType: s.sectionType,
      reason: operationalSectionExplanation(s.sectionType, s.records.length),
      recordCount: s.records.length,
    })
  );

  const lineage =
    brief.sourceConstitutionalBrief.sourceContextPackage.bridgeRelationships.map(
      (b) => ({
        recordType: "bridge_relationship",
        recordId: (b["id"] as string) ?? "",
        relationship: (b["relationship_type"] as string) ?? "related_to",
      })
    );

  await emitOperationalBriefEvent(
    brief.workspaceId,
    actorId,
    "OPERATIONAL_BRIEF_EXPLAINED",
    brief.id,
    correlationId ?? brief.id,
    causationId,
    {
      pmUserId: brief.pmUserId,
      contextType: brief.contextType,
      contextId: brief.contextId,
      sectionCount: brief.sections.length,
      sourceConstitutionalBriefId: brief.sourceConstitutionalBrief.id,
    }
  );

  return {
    ok: true,
    data: {
      operationalBrief: brief,
      sectionReasons,
      sourceBrief: brief.sourceConstitutionalBrief,
      evidenceTrace: brief.sourceConstitutionalBrief.evidenceTrace,
      lineage,
      unknowns: brief.unknowns,
    },
  };
}

function operationalSectionExplanation(
  sectionType: OperationalBriefSectionType,
  recordCount: number
): string {
  switch (sectionType) {
    case "operational_summary":
      return "Always included. Provides count-based summary of constitutional brief content for operational audiences.";
    case "execution_overview":
      return `Included because ${recordCount} execution ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "task_overview":
      return `Included because ${recordCount} task ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "milestone_overview":
      return `Included because ${recordCount} milestone ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "dependency_overview":
      return `Included because ${recordCount} dependency ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "risk_overview":
      return `Included because ${recordCount} risk ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief. Not scored.`;
    case "blocker_overview":
      return `Included because ${recordCount} ${recordCount === 1 ? "blocker was" : "blockers were"} found in the constitutional brief.`;
    case "escalation_overview":
      return `Included because ${recordCount} escalation ${recordCount === 1 ? "reference was" : "references were"} found in the constitutional brief.`;
    case "coordination_overview":
      return `Included because ${recordCount} coordination ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "delivery_overview":
      return `Included because ${recordCount} delivery ${recordCount === 1 ? "reference was" : "references were"} found in the constitutional brief. Not forecasted.`;
    case "contradictions":
      return `Included because ${recordCount} ${recordCount === 1 ? "contradiction was" : "contradictions were"} found in the constitutional brief. Not resolved.`;
    case "timeline_highlights":
      return `Included because ${recordCount} timeline ${recordCount === 1 ? "entry was" : "entries were"} found in the constitutional brief.`;
    case "evidence_summary":
      return "Always included. Summarizes evidence counts from the constitutional brief.";
    case "unknowns":
      return `Included because ${recordCount} unknown ${recordCount === 1 ? "area was" : "areas were"} documented in the constitutional brief.`;
    default:
      return "Included from constitutional brief data.";
  }
}

// ─── getOperationalBriefHealth ────────────────────────────────────────────────

export function getOperationalBriefHealth(
  brief: OperationalBrief
): OperationalBriefHealth {
  const coverageMetrics: OperationalBriefCoverageMetrics = {
    hasExecutionFacts: brief.executionFacts.length > 0,
    hasTaskFacts: brief.milestoneFacts.length > 0,
    hasMilestoneFacts: brief.milestoneFacts.length > 0,
    hasDependencyFacts: brief.dependencyFacts.length > 0,
    hasRiskFacts: brief.riskFacts.length > 0,
    hasBlockerFacts: brief.blockerFacts.length > 0,
    hasEscalationFacts:
      brief.sections.some((s) => s.sectionType === "escalation_overview") &&
      brief.sections.find((s) => s.sectionType === "escalation_overview")!
        .records.length > 0,
    hasCoordinationFacts: brief.coordinationFacts.length > 0,
    hasDeliveryFacts:
      brief.sections.some((s) => s.sectionType === "delivery_overview") &&
      brief.sections.find((s) => s.sectionType === "delivery_overview")!
        .records.length > 0,
    hasContradictions: brief.contradictions.length > 0,
    hasTimelineHighlights: brief.timelineHighlights.length > 0,
    hasUnknowns: brief.unknowns.length > 0,
  };

  return {
    sectionCount: brief.sections.length,
    executionFactCount: brief.executionFacts.length,
    riskFactCount: brief.riskFacts.length,
    dependencyFactCount: brief.dependencyFacts.length,
    milestoneFactCount: brief.milestoneFacts.length,
    blockerFactCount: brief.blockerFacts.length,
    coordinationFactCount: brief.coordinationFacts.length,
    timelineCount: brief.timelineHighlights.length,
    contradictionCount: brief.contradictions.length,
    unknownCount: brief.unknowns.length,
    coverageMetrics,
  };
}
