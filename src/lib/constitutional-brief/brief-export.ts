// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Brief — Export
//
// Exports a ConstitutionalBrief as a JSON-serializable structure.
// No AI. No ML. No scoring. No ranking. No prediction. No PDF.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type {
  ConstitutionalBrief,
  ConstitutionalBriefExport,
  ConstitutionalBriefResult,
} from "./types";

// ─── exportConstitutionalBrief ────────────────────────────────────────────────

export async function exportConstitutionalBrief(
  brief: ConstitutionalBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<ConstitutionalBriefResult<ConstitutionalBriefExport>> {
  const exportedAt = new Date().toISOString();

  await createPlatformEvent({
    workspaceId: brief.workspaceId,
    actorId,
    actorType: actorId ? "user" : "system",
    eventType: "CONSTITUTIONAL_BRIEF_EXPORTED",
    eventCategory: "governance",
    source: actorId ? "user_action" : "system",
    correlationId: correlationId ?? brief.id,
    causationId,
    rawReferenceTable: "constitutional_brief",
    rawReferenceId: brief.id,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: {
      pmUserId: brief.pmUserId,
      contextType: brief.contextType,
      contextId: brief.contextId,
      sectionCount: brief.sections.length,
      evidenceTraceCount: brief.evidenceTrace.length,
      contradictionCount: brief.contradictions.length,
      unknownCount: brief.unknowns.length,
      exportedAt,
    },
  });

  return {
    ok: true,
    data: {
      brief,
      sourceContextPackage: brief.sourceContextPackage,
      evidenceTrace: brief.evidenceTrace,
      timeline: brief.timeline,
      contradictions: brief.contradictions,
      unknowns: brief.unknowns,
      exportedAt,
      format: "json",
    },
  };
}
