// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Brief — Builder
//
// Transforms a ConstitutionalBrief into a PortfolioBrief.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// All content is sourced exclusively from the ConstitutionalBrief.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type { ConstitutionalBrief } from "@/lib/constitutional-brief";
import {
  buildPortfolioSummary,
  buildProjectOverview,
  buildProgramOverview,
  buildWorkstreamOverview,
  buildPortfolioDependencyOverview,
  buildPortfolioRiskOverview,
  buildPortfolioBlockerOverview,
  buildPortfolioEscalationOverview,
  buildCrossProjectOverview,
  buildPortfolioDeliveryOverview,
  buildPortfolioTimelineHighlights,
  buildPortfolioEvidenceSummary,
  buildPortfolioSections,
} from "./portfolio-brief-sections";
import type {
  PortfolioBrief,
  PortfolioBriefHealth,
  PortfolioBriefCoverageMetrics,
  PortfolioBriefExplanation,
  PortfolioBriefSectionReason,
  PortfolioBriefResult,
  PortfolioBriefSectionType,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function portfolioBriefId(
  workspaceId: string,
  pmUserId: string,
  contextType: string,
  contextId: string,
  generatedAt: string
): string {
  return `pf-brief:${workspaceId}:${pmUserId}:${contextType}:${contextId}:${generatedAt}`;
}

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitPortfolioBriefEvent(
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
    rawReferenceTable: "portfolio_brief",
    rawReferenceId: briefId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── buildPortfolioBrief ──────────────────────────────────────────────────────

export async function buildPortfolioBrief(
  constitutionalBrief: ConstitutionalBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<PortfolioBriefResult<PortfolioBrief>> {
  const { workspaceId, pmUserId, contextType, contextId } = constitutionalBrief;

  const generatedAt = new Date().toISOString();
  const id = portfolioBriefId(
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt
  );

  const portfolioSummary = buildPortfolioSummary(constitutionalBrief);

  const projectFacts = buildProjectOverview(constitutionalBrief);
  const programFacts = buildProgramOverview(constitutionalBrief);
  const workstreamFacts = buildWorkstreamOverview(constitutionalBrief);
  const dependencyFacts = buildPortfolioDependencyOverview(constitutionalBrief);
  const riskFacts = buildPortfolioRiskOverview(constitutionalBrief);
  const blockerFacts = buildPortfolioBlockerOverview(constitutionalBrief);
  const escalationFacts = buildPortfolioEscalationOverview(constitutionalBrief);
  const crossProjectFacts = buildCrossProjectOverview(constitutionalBrief);
  const deliveryFacts = buildPortfolioDeliveryOverview(constitutionalBrief);
  const timelineHighlights = buildPortfolioTimelineHighlights(constitutionalBrief);
  const evidenceSummary = buildPortfolioEvidenceSummary(
    constitutionalBrief,
    projectFacts,
    programFacts,
    workstreamFacts,
    dependencyFacts,
    riskFacts,
    blockerFacts,
    escalationFacts
  );

  const sections = buildPortfolioSections(
    constitutionalBrief,
    projectFacts,
    programFacts,
    workstreamFacts,
    dependencyFacts,
    riskFacts,
    blockerFacts,
    escalationFacts,
    crossProjectFacts,
    deliveryFacts,
    timelineHighlights,
    evidenceSummary
  );

  const brief: PortfolioBrief = {
    id,
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt,
    sourceConstitutionalBrief: constitutionalBrief,
    portfolioSummary,
    sections,
    projectFacts,
    programFacts,
    workstreamFacts,
    dependencyFacts,
    riskFacts,
    blockerFacts,
    escalationFacts,
    contradictions: constitutionalBrief.contradictions,
    unknowns: constitutionalBrief.unknowns,
    timelineHighlights,
    evidenceSummary,
    metadata: {},
  };

  await emitPortfolioBriefEvent(
    workspaceId,
    actorId,
    "PORTFOLIO_BRIEF_GENERATED",
    id,
    correlationId,
    causationId,
    {
      pmUserId,
      contextType,
      contextId,
      sectionCount: sections.length,
      projectFactCount: projectFacts.length,
      programFactCount: programFacts.length,
      workstreamFactCount: workstreamFacts.length,
      dependencyFactCount: dependencyFacts.length,
      riskFactCount: riskFacts.length,
      blockerFactCount: blockerFacts.length,
      escalationFactCount: escalationFacts.length,
      timelineCount: timelineHighlights.length,
      contradictionCount: constitutionalBrief.contradictions.length,
      unknownCount: constitutionalBrief.unknowns.length,
      sourceConstitutionalBriefId: constitutionalBrief.id,
    }
  );

  return { ok: true, data: brief };
}

// ─── explainPortfolioBrief ────────────────────────────────────────────────────

export async function explainPortfolioBrief(
  brief: PortfolioBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<PortfolioBriefResult<PortfolioBriefExplanation>> {
  const sectionReasons: PortfolioBriefSectionReason[] = brief.sections.map(
    (s) => ({
      sectionType: s.sectionType,
      reason: portfolioSectionExplanation(s.sectionType, s.records.length),
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

  await emitPortfolioBriefEvent(
    brief.workspaceId,
    actorId,
    "PORTFOLIO_BRIEF_EXPLAINED",
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
      portfolioBrief: brief,
      sectionReasons,
      sourceBrief: brief.sourceConstitutionalBrief,
      evidenceTrace: brief.sourceConstitutionalBrief.evidenceTrace,
      lineage,
      unknowns: brief.unknowns,
    },
  };
}

function portfolioSectionExplanation(
  sectionType: PortfolioBriefSectionType,
  recordCount: number
): string {
  switch (sectionType) {
    case "portfolio_summary":
      return "Always included. Provides count-based summary of constitutional brief content for portfolio audiences.";
    case "project_overview":
      return `Included because ${recordCount} project ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "program_overview":
      return `Included because ${recordCount} program ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "workstream_overview":
      return `Included because ${recordCount} workstream ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "dependency_overview":
      return `Included because ${recordCount} dependency ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief.`;
    case "risk_overview":
      return `Included because ${recordCount} risk ${recordCount === 1 ? "record was" : "records were"} found in the constitutional brief. Not scored.`;
    case "blocker_overview":
      return `Included because ${recordCount} ${recordCount === 1 ? "blocker was" : "blockers were"} found in the constitutional brief.`;
    case "escalation_overview":
      return `Included because ${recordCount} escalation ${recordCount === 1 ? "reference was" : "references were"} found in the constitutional brief.`;
    case "cross_project_overview":
      return `Included because ${recordCount} cross-project ${recordCount === 1 ? "relationship was" : "relationships were"} found in the constitutional brief.`;
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

// ─── getPortfolioBriefHealth ──────────────────────────────────────────────────

export function getPortfolioBriefHealth(
  brief: PortfolioBrief
): PortfolioBriefHealth {
  const coverageMetrics: PortfolioBriefCoverageMetrics = {
    hasProjectFacts: brief.projectFacts.length > 0,
    hasProgramFacts: brief.programFacts.length > 0,
    hasWorkstreamFacts: brief.workstreamFacts.length > 0,
    hasDependencyFacts: brief.dependencyFacts.length > 0,
    hasRiskFacts: brief.riskFacts.length > 0,
    hasBlockerFacts: brief.blockerFacts.length > 0,
    hasEscalationFacts: brief.escalationFacts.length > 0,
    hasDeliveryFacts:
      brief.sections.some((s) => s.sectionType === "delivery_overview") &&
      (brief.sections.find((s) => s.sectionType === "delivery_overview")
        ?.records.length ?? 0) > 0,
    hasContradictions: brief.contradictions.length > 0,
    hasTimelineHighlights: brief.timelineHighlights.length > 0,
    hasUnknowns: brief.unknowns.length > 0,
  };

  return {
    sectionCount: brief.sections.length,
    projectFactCount: brief.projectFacts.length,
    programFactCount: brief.programFacts.length,
    workstreamFactCount: brief.workstreamFacts.length,
    dependencyFactCount: brief.dependencyFacts.length,
    riskFactCount: brief.riskFacts.length,
    blockerFactCount: brief.blockerFacts.length,
    escalationFactCount: brief.escalationFacts.length,
    timelineCount: brief.timelineHighlights.length,
    contradictionCount: brief.contradictions.length,
    unknownCount: brief.unknowns.length,
    coverageMetrics,
  };
}
