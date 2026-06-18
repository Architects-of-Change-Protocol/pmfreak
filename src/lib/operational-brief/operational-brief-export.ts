// ─────────────────────────────────────────────────────────────────────────────
// Operational Brief — Export
//
// Exports an OperationalBrief as a JSON-serializable structure.
// No AI. No ML. No scoring. No ranking. No prediction. JSON only.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type {
  OperationalBrief,
  OperationalBriefExport,
  OperationalBriefResult,
} from "./types";

// ─── exportOperationalBrief ───────────────────────────────────────────────────

export async function exportOperationalBrief(
  brief: OperationalBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<OperationalBriefResult<OperationalBriefExport>> {
  const exportedAt = new Date().toISOString();

  await createPlatformEvent({
    workspaceId: brief.workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType: "OPERATIONAL_BRIEF_EXPORTED",
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? brief.id,
    causationId,
    rawReferenceTable: "operational_brief",
    rawReferenceId: brief.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      pmUserId: brief.pmUserId,
      contextType: brief.contextType,
      contextId: brief.contextId,
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
      sourceConstitutionalBriefId: brief.sourceConstitutionalBrief.id,
      exportedAt,
    },
  });

  return {
    ok: true,
    data: {
      operationalBrief: brief,
      sourceConstitutionalBrief: brief.sourceConstitutionalBrief,
      executionFacts: brief.executionFacts,
      riskFacts: brief.riskFacts,
      dependencyFacts: brief.dependencyFacts,
      milestoneFacts: brief.milestoneFacts,
      blockerFacts: brief.blockerFacts,
      coordinationFacts: brief.coordinationFacts,
      timelineHighlights: brief.timelineHighlights,
      evidenceSummary: brief.evidenceSummary,
      contradictions: brief.contradictions,
      unknowns: brief.unknowns,
      exportedAt,
      format: "json",
    },
  };
}
