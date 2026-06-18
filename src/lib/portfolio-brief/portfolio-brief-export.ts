// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Brief — Export
//
// Exports a PortfolioBrief as a JSON-serializable structure.
// No AI. No ML. No scoring. No ranking. No prediction. JSON only.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type {
  PortfolioBrief,
  PortfolioBriefExport,
  PortfolioBriefResult,
} from "./types";

// ─── exportPortfolioBrief ─────────────────────────────────────────────────────

export async function exportPortfolioBrief(
  brief: PortfolioBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<PortfolioBriefResult<PortfolioBriefExport>> {
  const exportedAt = new Date().toISOString();

  await createPlatformEvent({
    workspaceId: brief.workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType: "PORTFOLIO_BRIEF_EXPORTED",
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? brief.id,
    causationId,
    rawReferenceTable: "portfolio_brief",
    rawReferenceId: brief.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      pmUserId: brief.pmUserId,
      contextType: brief.contextType,
      contextId: brief.contextId,
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
      sourceConstitutionalBriefId: brief.sourceConstitutionalBrief.id,
      exportedAt,
    },
  });

  return {
    ok: true,
    data: {
      portfolioBrief: brief,
      sourceConstitutionalBrief: brief.sourceConstitutionalBrief,
      projectFacts: brief.projectFacts,
      programFacts: brief.programFacts,
      workstreamFacts: brief.workstreamFacts,
      dependencyFacts: brief.dependencyFacts,
      riskFacts: brief.riskFacts,
      blockerFacts: brief.blockerFacts,
      escalationFacts: brief.escalationFacts,
      timelineHighlights: brief.timelineHighlights,
      evidenceSummary: brief.evidenceSummary,
      contradictions: brief.contradictions,
      unknowns: brief.unknowns,
      exportedAt,
      format: "json",
    },
  };
}
