// ─────────────────────────────────────────────────────────────────────────────
// Executive Brief — Export
//
// Exports an ExecutiveBrief as a JSON-serializable structure.
// No AI. No ML. No scoring. No ranking. No prediction. No PDF.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type {
  ExecutiveBrief,
  ExecutiveBriefExport,
  ExecutiveBriefResult,
} from "./types";

// ─── exportExecutiveBrief ─────────────────────────────────────────────────────

export async function exportExecutiveBrief(
  brief: ExecutiveBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<ExecutiveBriefResult<ExecutiveBriefExport>> {
  const exportedAt = new Date().toISOString();

  await createPlatformEvent({
    workspaceId: brief.workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType: "EXECUTIVE_BRIEF_EXPORTED",
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? brief.id,
    causationId,
    rawReferenceTable: "executive_brief",
    rawReferenceId: brief.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      pmUserId: brief.pmUserId,
      contextType: brief.contextType,
      contextId: brief.contextId,
      sectionCount: brief.sections.length,
      factCount: brief.keyFacts.length,
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
      executiveBrief: brief,
      sourceConstitutionalBrief: brief.sourceConstitutionalBrief,
      keyFacts: brief.keyFacts,
      timelineHighlights: brief.timelineHighlights,
      evidenceSummary: brief.evidenceSummary,
      contradictions: brief.contradictions,
      unknowns: brief.unknowns,
      exportedAt,
      format: "json",
    },
  };
}
