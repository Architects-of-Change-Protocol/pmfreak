// ─────────────────────────────────────────────────────────────────────────────
// Executive Brief — Builder
//
// Transforms a ConstitutionalBrief into an ExecutiveBrief.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// All content is sourced exclusively from the ConstitutionalBrief.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type { ConstitutionalBrief } from "@/lib/constitutional-brief";
import {
  buildExecutiveSummary,
  buildKeyFacts,
  buildTimelineHighlights,
  buildEvidenceSummary,
  buildExecutiveSections,
} from "./executive-brief-sections";
import type {
  ExecutiveBrief,
  ExecutiveBriefHealth,
  ExecutiveBriefCoverageMetrics,
  ExecutiveBriefExplanation,
  ExecutiveBriefSectionReason,
  ExecutiveBriefResult,
  ExecutiveBriefSectionType,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function executiveBriefId(
  workspaceId: string,
  pmUserId: string,
  contextType: string,
  contextId: string,
  generatedAt: string
): string {
  return `exec-brief:${workspaceId}:${pmUserId}:${contextType}:${contextId}:${generatedAt}`;
}

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitExecutiveBriefEvent(
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
    rawReferenceTable: "executive_brief",
    rawReferenceId: briefId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── buildExecutiveBrief ──────────────────────────────────────────────────────

export async function buildExecutiveBrief(
  constitutionalBrief: ConstitutionalBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<ExecutiveBriefResult<ExecutiveBrief>> {
  const { workspaceId, pmUserId, contextType, contextId } = constitutionalBrief;

  const generatedAt = new Date().toISOString();
  const id = executiveBriefId(
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt
  );

  const executiveSummary = buildExecutiveSummary(constitutionalBrief);
  const keyFacts = buildKeyFacts(constitutionalBrief);
  const timelineHighlights = buildTimelineHighlights(constitutionalBrief);
  const evidenceSummary = buildEvidenceSummary(constitutionalBrief);
  const sections = buildExecutiveSections(
    constitutionalBrief,
    keyFacts,
    timelineHighlights,
    evidenceSummary
  );

  const brief: ExecutiveBrief = {
    id,
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt,
    sourceConstitutionalBrief: constitutionalBrief,
    executiveSummary,
    sections,
    keyFacts,
    knowledgeDomains: [...constitutionalBrief.knowledgeDomains],
    contradictions: constitutionalBrief.contradictions,
    unknowns: constitutionalBrief.unknowns,
    timelineHighlights,
    evidenceSummary,
    metadata: {},
  };

  await emitExecutiveBriefEvent(
    workspaceId,
    actorId,
    "EXECUTIVE_BRIEF_GENERATED",
    id,
    correlationId,
    causationId,
    {
      pmUserId,
      contextType,
      contextId,
      sectionCount: sections.length,
      factCount: keyFacts.length,
      timelineCount: timelineHighlights.length,
      contradictionCount: constitutionalBrief.contradictions.length,
      unknownCount: constitutionalBrief.unknowns.length,
      sourceConstitutionalBriefId: constitutionalBrief.id,
    }
  );

  return { ok: true, data: brief };
}

// ─── explainExecutiveBrief ────────────────────────────────────────────────────

export async function explainExecutiveBrief(
  brief: ExecutiveBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<ExecutiveBriefResult<ExecutiveBriefExplanation>> {
  const sectionReasons: ExecutiveBriefSectionReason[] = brief.sections.map(
    (s) => ({
      sectionType: s.sectionType,
      reason: executiveSectionExplanation(s.sectionType, s.records.length),
      recordCount: s.records.length,
    })
  );

  const lineage = brief.sourceConstitutionalBrief.sourceContextPackage.bridgeRelationships.map(
    (b) => ({
      recordType: "bridge_relationship",
      recordId: (b["id"] as string) ?? "",
      relationship: (b["relationship_type"] as string) ?? "related_to",
    })
  );

  await emitExecutiveBriefEvent(
    brief.workspaceId,
    actorId,
    "EXECUTIVE_BRIEF_EXPLAINED",
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
      executiveBrief: brief,
      sectionReasons,
      sourceBrief: brief.sourceConstitutionalBrief,
      evidenceTrace: brief.sourceConstitutionalBrief.evidenceTrace,
      lineage,
      unknowns: brief.unknowns,
    },
  };
}

function executiveSectionExplanation(
  sectionType: ExecutiveBriefSectionType,
  recordCount: number
): string {
  switch (sectionType) {
    case "executive_summary":
      return "Always included. Provides count-based summary of constitutional brief content.";
    case "key_facts":
      return `Included because ${recordCount} constitutional content ${recordCount === 1 ? "area was" : "areas were"} found in the source brief.`;
    case "knowledge_domains":
      return "Included because knowledge domains were present in the constitutional brief.";
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

// ─── getExecutiveBriefHealth ──────────────────────────────────────────────────

export function getExecutiveBriefHealth(
  brief: ExecutiveBrief
): ExecutiveBriefHealth {
  const coverageMetrics: ExecutiveBriefCoverageMetrics = {
    hasKeyFacts: brief.keyFacts.length > 0,
    hasKnowledgeDomains: brief.knowledgeDomains.length > 0,
    hasContradictions: brief.contradictions.length > 0,
    hasTimelineHighlights: brief.timelineHighlights.length > 0,
    hasEvidenceSummary: brief.evidenceSummary.evidenceCount > 0,
    hasUnknowns: brief.unknowns.length > 0,
  };

  return {
    sectionCount: brief.sections.length,
    factCount: brief.keyFacts.length,
    timelineCount: brief.timelineHighlights.length,
    domainCount: brief.knowledgeDomains.length,
    contradictionCount: brief.contradictions.length,
    unknownCount: brief.unknowns.length,
    coverageMetrics,
  };
}
