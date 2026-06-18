// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Brief — Builder
//
// Transforms a ConstitutionalContextPackage into a ConstitutionalBrief.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// All content is sourced exclusively from the context package.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type { ConstitutionalContextPackage } from "@/lib/constitutional-context";
import { buildBriefSections, buildBriefUnknowns } from "./brief-sections";
import type {
  ConstitutionalBrief,
  ConstitutionalBriefEvidenceTraceEntry,
  ConstitutionalBriefHealth,
  ConstitutionalBriefCoverageMetrics,
  ConstitutionalBriefExplanation,
  ConstitutionalBriefSectionReason,
  ConstitutionalBriefResult,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────
// Deterministic brief ID from workspace + pmUser + contextType + contextId.

function briefId(
  workspaceId: string,
  pmUserId: string,
  contextType: string,
  contextId: string,
  generatedAt: string
): string {
  return `brief:${workspaceId}:${pmUserId}:${contextType}:${contextId}:${generatedAt}`;
}

// ─── buildBriefSummary ────────────────────────────────────────────────────────
// Deterministic summary using counts only.
// No natural language conclusions beyond available counts.

export function buildBriefSummary(
  contextPackage: ConstitutionalContextPackage
): string {
  const {
    contextType,
    memories,
    patterns,
    effectivenessRecords,
    bridgeRelationships,
    contradictions,
    evidence,
    knowledgeDomains,
  } = contextPackage;

  const parts: string[] = [];

  if (memories.length > 0) {
    parts.push(`${memories.length} relevant ${memories.length === 1 ? "memory" : "memories"}`);
  }
  if (patterns.length > 0) {
    parts.push(`${patterns.length} ${patterns.length === 1 ? "pattern" : "patterns"}`);
  }
  if (effectivenessRecords.length > 0) {
    parts.push(`${effectivenessRecords.length} effectiveness ${effectivenessRecords.length === 1 ? "record" : "records"}`);
  }
  if (bridgeRelationships.length > 0) {
    parts.push(`${bridgeRelationships.length} bridge ${bridgeRelationships.length === 1 ? "relationship" : "relationships"}`);
  }

  const contentSummary =
    parts.length > 0 ? parts.join(", ") : "no linked records";

  const contradictionClause =
    contradictions.length > 0
      ? ` and ${contradictions.length} explicit ${contradictions.length === 1 ? "contradiction" : "contradictions"}`
      : "";

  const domainClause =
    knowledgeDomains.length > 0
      ? ` across ${knowledgeDomains.join(" and ")} ${knowledgeDomains.length === 1 ? "domain" : "domains"}`
      : "";

  const evidenceClause =
    evidence.length > 0 ? ` (${evidence.length} evidence ${evidence.length === 1 ? "record" : "records"})` : "";

  return (
    `This ${contextType} context contains ${contentSummary}` +
    contradictionClause +
    domainClause +
    evidenceClause +
    "."
  );
}

// ─── buildEvidenceTrace ───────────────────────────────────────────────────────
// Builds a flat evidence trace from all records in the context package.

export function buildEvidenceTrace(
  contextPackage: ConstitutionalContextPackage
): ConstitutionalBriefEvidenceTraceEntry[] {
  const entries: ConstitutionalBriefEvidenceTraceEntry[] = [];

  function addEntries(
    records: Record<string, unknown>[],
    recordType: string,
    reasonIncluded: string
  ) {
    for (const r of records) {
      const id = r["id"] as string | undefined;
      if (!id) continue;
      const source =
        (r["source"] as string | undefined) ??
        (r["source_type"] as string | undefined) ??
        "constitutional_knowledge";
      const lineage =
        (r["workspace_id"] as string | undefined)
          ? `workspace:${r["workspace_id"]}`
          : "unknown";
      entries.push({ recordType, recordId: id, source, lineage, reasonIncluded });
    }
  }

  addEntries(contextPackage.memories, "memory", "Linked memory from context package.");
  addEntries(contextPackage.patterns, "pattern", "Linked pattern from context package.");
  addEntries(contextPackage.effectivenessRecords, "effectiveness", "Linked effectiveness record from context package.");
  addEntries(contextPackage.bridgeRelationships, "bridge_relationship", "Explicit bridge relationship from context package.");
  addEntries(contextPackage.evidence, "evidence", "Evidence record selected by constitutional context engine.");

  return entries;
}

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitBriefEvent(
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
    rawReferenceTable: "constitutional_brief",
    rawReferenceId: briefId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── buildConstitutionalBrief ─────────────────────────────────────────────────

export async function buildConstitutionalBrief(
  contextPackage: ConstitutionalContextPackage,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<ConstitutionalBriefResult<ConstitutionalBrief>> {
  const {
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    contradictions,
    timeline,
    knowledgeDomains,
  } = contextPackage;

  const generatedAt = new Date().toISOString();
  const id = briefId(workspaceId, pmUserId, contextType, contextId, generatedAt);

  const summary = buildBriefSummary(contextPackage);
  const sections = buildBriefSections(contextPackage);
  const evidenceTrace = buildEvidenceTrace(contextPackage);
  const unknowns = buildBriefUnknowns(contextPackage);

  const brief: ConstitutionalBrief = {
    id,
    workspaceId,
    pmUserId,
    contextType,
    contextId,
    generatedAt,
    sourceContextPackage: contextPackage,
    summary,
    sections,
    evidenceTrace,
    timeline,
    contradictions,
    knowledgeDomains,
    unknowns,
    metadata: {},
  };

  await emitBriefEvent(
    workspaceId,
    actorId,
    "CONSTITUTIONAL_BRIEF_GENERATED",
    id,
    correlationId,
    causationId,
    {
      pmUserId,
      contextType,
      contextId,
      sectionCount: sections.length,
      evidenceTraceCount: evidenceTrace.length,
      contradictionCount: contradictions.length,
      unknownCount: unknowns.length,
    }
  );

  return { ok: true, data: brief };
}

// ─── explainConstitutionalBrief ───────────────────────────────────────────────

export async function explainConstitutionalBrief(
  brief: ConstitutionalBrief,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<ConstitutionalBriefResult<ConstitutionalBriefExplanation>> {
  const sectionReasons: ConstitutionalBriefSectionReason[] = brief.sections.map((s) => ({
    sectionType: s.sectionType,
    reason: sectionExplanation(s.sectionType, s.records.length),
    recordCount: s.records.length,
  }));

  const lineage = brief.sourceContextPackage.bridgeRelationships.map((b) => ({
    recordType: "bridge_relationship",
    recordId: (b["id"] as string) ?? "",
    relationship: (b["relationship_type"] as string) ?? "related_to",
  }));

  await emitBriefEvent(
    brief.workspaceId,
    actorId,
    "CONSTITUTIONAL_BRIEF_EXPLAINED",
    brief.id,
    correlationId ?? brief.id,
    causationId,
    {
      pmUserId: brief.pmUserId,
      contextType: brief.contextType,
      contextId: brief.contextId,
      sectionCount: brief.sections.length,
    }
  );

  return {
    ok: true,
    data: {
      brief,
      sectionReasons,
      sourceContextPackage: brief.sourceContextPackage,
      evidenceTrace: brief.evidenceTrace,
      lineage,
      unknowns: brief.unknowns,
    },
  };
}

function sectionExplanation(sectionType: string, recordCount: number): string {
  switch (sectionType) {
    case "context_summary":
      return "Always included. Provides counts of all content areas in the context package.";
    case "relevant_memories":
      return `Included because ${recordCount} linked ${recordCount === 1 ? "memory was" : "memories were"} found in the context package.`;
    case "relevant_patterns":
      return `Included because ${recordCount} linked ${recordCount === 1 ? "pattern was" : "patterns were"} found in the context package.`;
    case "relevant_effectiveness":
      return `Included because ${recordCount} effectiveness ${recordCount === 1 ? "record was" : "records were"} found in the context package.`;
    case "bridge_relationships":
      return `Included because ${recordCount} bridge ${recordCount === 1 ? "relationship was" : "relationships were"} found in the context package.`;
    case "relevant_knowledge":
      return "Included because knowledge domains were present in the context package.";
    case "contradictions":
      return `Included because ${recordCount} ${recordCount === 1 ? "contradiction was" : "contradictions were"} found in the context package. Not resolved.`;
    case "evidence_trace":
      return `Included because ${recordCount} evidence ${recordCount === 1 ? "record was" : "records were"} found in the context package.`;
    case "timeline":
      return `Included because ${recordCount} timeline ${recordCount === 1 ? "entry was" : "entries were"} found in the context package.`;
    case "outstanding_unknowns":
      return "Included to document what is missing from the context package. Unknowns are constitutional transparency.";
    default:
      return "Included from context package data.";
  }
}

// ─── getConstitutionalBriefHealth ─────────────────────────────────────────────

export function getConstitutionalBriefHealth(
  brief: ConstitutionalBrief
): ConstitutionalBriefHealth {
  const pkg = brief.sourceContextPackage;

  const coverageMetrics: ConstitutionalBriefCoverageMetrics = {
    hasMemories: pkg.memories.length > 0,
    hasPatterns: pkg.patterns.length > 0,
    hasEffectivenessRecords: pkg.effectivenessRecords.length > 0,
    hasBridgeRelationships: pkg.bridgeRelationships.length > 0,
    hasContradictions: pkg.contradictions.length > 0,
    hasEvidence: pkg.evidence.length > 0,
    hasTimeline: pkg.timeline.length > 0,
    hasKnowledgeDomains: pkg.knowledgeDomains.length > 0,
  };

  const recordCount = brief.sections.reduce((sum, s) => sum + s.records.length, 0);

  return {
    sectionCount: brief.sections.length,
    recordCount,
    evidenceTraceCount: brief.evidenceTrace.length,
    contradictionCount: brief.contradictions.length,
    unknownCount: brief.unknowns.length,
    domainCount: brief.knowledgeDomains.length,
    coverageMetrics,
  };
}
