// ─────────────────────────────────────────────────────────────────────────────
// Governance Brief — Export
//
// Exports a GovernanceBrief as a JSON-serializable structure.
// No AI. No ML. No scoring. No ranking. No prediction. No PDF.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type {
  GovernanceBrief,
  GovernanceBriefExport,
  GovernanceBriefResult,
} from "./types";

// ─── exportGovernanceBrief ────────────────────────────────────────────────────

export async function exportGovernanceBrief(
  brief: GovernanceBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<GovernanceBriefResult<GovernanceBriefExport>> {
  const exportedAt = new Date().toISOString();

  await createPlatformEvent({
    workspaceId: brief.workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType: "GOVERNANCE_BRIEF_EXPORTED",
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? brief.id,
    causationId,
    rawReferenceTable: "governance_brief",
    rawReferenceId: brief.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      pmUserId: brief.pmUserId,
      contextType: brief.contextType,
      contextId: brief.contextId,
      sectionCount: brief.sections.length,
      authorityFactCount: brief.authorityFacts.length,
      capabilityFactCount: brief.capabilityFacts.length,
      delegationFactCount: brief.delegationFacts.length,
      trustFactCount: brief.trustFacts.length,
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
      governanceBrief: brief,
      sourceConstitutionalBrief: brief.sourceConstitutionalBrief,
      authorityFacts: brief.authorityFacts,
      capabilityFacts: brief.capabilityFacts,
      delegationFacts: brief.delegationFacts,
      trustFacts: brief.trustFacts,
      timelineHighlights: brief.timelineHighlights,
      evidenceSummary: brief.evidenceSummary,
      contradictions: brief.contradictions,
      unknowns: brief.unknowns,
      exportedAt,
      format: "json",
    },
  };
}
