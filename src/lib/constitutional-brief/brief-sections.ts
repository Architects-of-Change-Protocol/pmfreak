// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Brief — Section Builder
//
// Builds ConstitutionalBriefSection entries from a ConstitutionalContextPackage.
// No AI. No ML. No scoring. No ranking. No prediction.
// Sections are built deterministically from explicit package fields.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalContextPackage } from "@/lib/constitutional-context";
import type {
  ConstitutionalBriefSection,
  ConstitutionalBriefUnknown,
  BriefSectionType,
} from "./types";

// ─── ID generator ────────────────────────────────────────────────────────────
// Deterministic section ID derived from contextId and section type.

function sectionId(contextId: string, sectionType: BriefSectionType): string {
  return `${contextId}:${sectionType}`;
}

// ─── Section factory ──────────────────────────────────────────────────────────

function makeSection(
  contextId: string,
  sectionType: BriefSectionType,
  title: string,
  summary: string,
  records: Record<string, unknown>[],
  evidence: Record<string, unknown>[] = [],
  lineage: Array<{ recordType: string; recordId: string; relationship: string }> = []
): ConstitutionalBriefSection {
  return {
    id: sectionId(contextId, sectionType),
    sectionType,
    title,
    summary,
    records,
    evidence,
    lineage,
  };
}

// ─── buildBriefSections ───────────────────────────────────────────────────────

export function buildBriefSections(
  contextPackage: ConstitutionalContextPackage
): ConstitutionalBriefSection[] {
  const {
    contextId,
    contextType,
    memories,
    patterns,
    effectivenessRecords,
    bridgeRelationships,
    contradictions,
    evidence,
    timeline,
    knowledgeDomains,
  } = contextPackage;

  const sections: ConstitutionalBriefSection[] = [];

  // context_summary — always present
  sections.push(
    makeSection(
      contextId,
      "context_summary",
      "Context Summary",
      `${contextType} context with ${memories.length} memories, ${patterns.length} patterns, ` +
        `${effectivenessRecords.length} effectiveness records, ${bridgeRelationships.length} bridge relationships, ` +
        `${contradictions.length} contradictions across ${knowledgeDomains.length} domains.`,
      [],
      evidence
    )
  );

  // relevant_memories
  if (memories.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "relevant_memories",
        "Relevant Memories",
        `${memories.length} memory record${memories.length === 1 ? "" : "s"} linked to this context.`,
        memories
      )
    );
  }

  // relevant_patterns
  if (patterns.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "relevant_patterns",
        "Relevant Patterns",
        `${patterns.length} pattern record${patterns.length === 1 ? "" : "s"} linked to this context.`,
        patterns
      )
    );
  }

  // relevant_effectiveness
  if (effectivenessRecords.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "relevant_effectiveness",
        "Relevant Effectiveness Records",
        `${effectivenessRecords.length} effectiveness record${effectivenessRecords.length === 1 ? "" : "s"} linked to this context.`,
        effectivenessRecords
      )
    );
  }

  // bridge_relationships
  if (bridgeRelationships.length > 0) {
    const lineage = bridgeRelationships.map((b) => ({
      recordType: "bridge_relationship",
      recordId: (b["id"] as string) ?? "",
      relationship: (b["relationship_type"] as string) ?? "related_to",
    }));
    sections.push(
      makeSection(
        contextId,
        "bridge_relationships",
        "Bridge Relationships",
        `${bridgeRelationships.length} bridge relationship${bridgeRelationships.length === 1 ? "" : "s"} connecting personal and organizational knowledge.`,
        bridgeRelationships,
        [],
        lineage
      )
    );
  }

  // relevant_knowledge — knowledge domains
  if (knowledgeDomains.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "relevant_knowledge",
        "Relevant Knowledge Domains",
        `Knowledge domains: ${knowledgeDomains.join(", ")}.`,
        []
      )
    );
  }

  // contradictions
  if (contradictions.length > 0) {
    const contradictionRecords = contradictions.map((c) => ({
      id: c.id,
      sourceAType: c.sourceAType,
      sourceAId: c.sourceAId,
      sourceAStatement: c.sourceAStatement,
      sourceBType: c.sourceBType,
      sourceBId: c.sourceBId,
      sourceBStatement: c.sourceBStatement,
      detectedAt: c.detectedAt,
      relationshipType: c.relationshipType,
      bridgeId: c.bridgeId,
    }));
    sections.push(
      makeSection(
        contextId,
        "contradictions",
        "Contradictions",
        `${contradictions.length} contradiction${contradictions.length === 1 ? "" : "s"} detected. Not resolved. Both sides included without judgment.`,
        contradictionRecords
      )
    );
  }

  // evidence_trace
  if (evidence.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "evidence_trace",
        "Evidence Trace",
        `${evidence.length} evidence record${evidence.length === 1 ? "" : "s"} supporting this context.`,
        evidence
      )
    );
  }

  // timeline
  if (timeline.length > 0) {
    const timelineRecords = timeline.map((t) => ({
      timestamp: t.timestamp,
      recordType: t.recordType,
      recordId: t.recordId,
      summary: t.summary,
      source: t.source,
    }));
    sections.push(
      makeSection(
        contextId,
        "timeline",
        "Timeline",
        `${timeline.length} chronological event${timeline.length === 1 ? "" : "s"} from the source context package.`,
        timelineRecords
      )
    );
  }

  return sections;
}

// ─── buildBriefUnknowns ───────────────────────────────────────────────────────
// Captures what is missing from the context package.
// Unknowns are constitutional transparency, not failures.

export function buildBriefUnknowns(
  contextPackage: ConstitutionalContextPackage
): ConstitutionalBriefUnknown[] {
  const unknowns: ConstitutionalBriefUnknown[] = [];

  if (contextPackage.memories.length === 0) {
    unknowns.push({
      area: "memories",
      description: "No linked memories found in the context package.",
    });
  }

  if (contextPackage.patterns.length === 0) {
    unknowns.push({
      area: "patterns",
      description: "No linked patterns found in the context package.",
    });
  }

  if (contextPackage.effectivenessRecords.length === 0) {
    unknowns.push({
      area: "effectiveness_records",
      description: "No relevant effectiveness records found in the context package.",
    });
  }

  if (contextPackage.bridgeRelationships.length === 0) {
    unknowns.push({
      area: "bridge_relationships",
      description: "No explicit bridge relationships found in the context package.",
    });
  }

  if (contextPackage.contradictions.length === 0) {
    unknowns.push({
      area: "contradictions",
      description: "No contradictions found in the context package.",
    });
  }

  if (contextPackage.evidence.length === 0) {
    unknowns.push({
      area: "evidence_trace",
      description: "No evidence trace found in the context package.",
    });
  }

  return unknowns;
}
