// ─────────────────────────────────────────────────────────────────────────────
// Executive Brief — Section Builder
//
// Builds ExecutiveBriefSection entries from a ConstitutionalBrief.
// No AI. No ML. No scoring. No ranking. No prediction.
// Sections are built deterministically from existing constitutional knowledge.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalBrief } from "@/lib/constitutional-brief";
import type {
  ExecutiveBriefSection,
  ExecutiveBriefSectionType,
  ExecutiveFact,
  ExecutiveTimelineHighlight,
  ExecutiveEvidenceSummary,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function sectionId(
  contextId: string,
  sectionType: ExecutiveBriefSectionType
): string {
  return `exec:${contextId}:${sectionType}`;
}

// ─── Section factory ──────────────────────────────────────────────────────────

function makeSection(
  contextId: string,
  sectionType: ExecutiveBriefSectionType,
  title: string,
  summary: string,
  records: Record<string, unknown>[] = [],
  evidence: Record<string, unknown>[] = [],
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }> = []
): ExecutiveBriefSection {
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

// ─── buildExecutiveSummary ────────────────────────────────────────────────────
// Uses counts only from the constitutional brief.
// No conclusions. No recommendations. No predictions.

export function buildExecutiveSummary(brief: ConstitutionalBrief): string {
  const {
    contextType,
    sections,
    evidenceTrace,
    contradictions,
    knowledgeDomains,
  } = brief;

  const totalRecords = sections.reduce((sum, s) => sum + s.records.length, 0);

  const domainClause =
    knowledgeDomains.length > 0
      ? `, ${knowledgeDomains.join(", ")} ${knowledgeDomains.length === 1 ? "domain" : "domains"}`
      : "";

  const evidenceClause =
    evidenceTrace.length > 0
      ? ` supported by ${evidenceTrace.length} evidence ${evidenceTrace.length === 1 ? "reference" : "references"}`
      : "";

  const contradictionClause =
    contradictions.length > 0
      ? ` and ${contradictions.length} explicit ${contradictions.length === 1 ? "contradiction" : "contradictions"}`
      : "";

  return (
    `This executive brief contains ${totalRecords} constitutional ${totalRecords === 1 ? "record" : "records"}` +
    ` across ${sections.length} ${sections.length === 1 ? "section" : "sections"}` +
    domainClause +
    evidenceClause +
    contradictionClause +
    "."
  );
}

// ─── buildKeyFacts ────────────────────────────────────────────────────────────
// Builds key facts from the constitutional brief sections.
// Each fact maps to one content area. No new facts invented.

export function buildKeyFacts(brief: ConstitutionalBrief): ExecutiveFact[] {
  const facts: ExecutiveFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;

  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const memorySection = sectionsByType.get("relevant_memories");
  if (memorySection && memorySection.records.length > 0) {
    facts.push({
      id: `fact:${contextId}:memory`,
      factType: "memory",
      summary: `${memorySection.records.length} memory ${memorySection.records.length === 1 ? "record" : "records"} in constitutional brief.`,
      sourceCount: memorySection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "memory")
        .length,
      lineage: [],
    });
  }

  const patternSection = sectionsByType.get("relevant_patterns");
  if (patternSection && patternSection.records.length > 0) {
    facts.push({
      id: `fact:${contextId}:pattern`,
      factType: "pattern",
      summary: `${patternSection.records.length} pattern ${patternSection.records.length === 1 ? "record" : "records"} in constitutional brief.`,
      sourceCount: patternSection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "pattern")
        .length,
      lineage: [],
    });
  }

  const effectivenessSection = sectionsByType.get("relevant_effectiveness");
  if (effectivenessSection && effectivenessSection.records.length > 0) {
    facts.push({
      id: `fact:${contextId}:effectiveness`,
      factType: "effectiveness",
      summary: `${effectivenessSection.records.length} effectiveness ${effectivenessSection.records.length === 1 ? "record" : "records"} in constitutional brief.`,
      sourceCount: effectivenessSection.records.length,
      evidenceCount: evidenceTrace.filter(
        (e) => e.recordType === "effectiveness"
      ).length,
      lineage: [],
    });
  }

  const bridgeSection = sectionsByType.get("bridge_relationships");
  if (bridgeSection && bridgeSection.records.length > 0) {
    const bridgeLineage = bridgeSection.lineage;
    facts.push({
      id: `fact:${contextId}:bridge`,
      factType: "bridge",
      summary: `${bridgeSection.records.length} bridge ${bridgeSection.records.length === 1 ? "relationship" : "relationships"} in constitutional brief.`,
      sourceCount: bridgeSection.records.length,
      evidenceCount: evidenceTrace.filter(
        (e) => e.recordType === "bridge_relationship"
      ).length,
      lineage: bridgeLineage,
    });
  }

  const contradictionSection = sectionsByType.get("contradictions");
  if (contradictionSection && contradictionSection.records.length > 0) {
    facts.push({
      id: `fact:${contextId}:contradiction`,
      factType: "contradiction",
      summary: `${contradictionSection.records.length} ${contradictionSection.records.length === 1 ? "contradiction" : "contradictions"} in constitutional brief. Not resolved.`,
      sourceCount: contradictionSection.records.length,
      evidenceCount: 0,
      lineage: [],
    });
  }

  const timelineSection = sectionsByType.get("timeline");
  if (timelineSection && timelineSection.records.length > 0) {
    facts.push({
      id: `fact:${contextId}:timeline`,
      factType: "timeline",
      summary: `${timelineSection.records.length} chronological ${timelineSection.records.length === 1 ? "event" : "events"} in constitutional brief.`,
      sourceCount: timelineSection.records.length,
      evidenceCount: 0,
      lineage: [],
    });
  }

  if (brief.knowledgeDomains.length > 0) {
    facts.push({
      id: `fact:${contextId}:domain`,
      factType: "domain",
      summary: `${brief.knowledgeDomains.length} knowledge ${brief.knowledgeDomains.length === 1 ? "domain" : "domains"} in constitutional brief.`,
      sourceCount: brief.knowledgeDomains.length,
      evidenceCount: 0,
      lineage: [],
    });
  }

  return facts;
}

// ─── buildTimelineHighlights ──────────────────────────────────────────────────
// Condenses constitutional brief timeline entries.
// Sorted chronologically. No invented events. No inferred chronology.

export function buildTimelineHighlights(
  brief: ConstitutionalBrief
): ExecutiveTimelineHighlight[] {
  const sorted = [...brief.timeline].sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return ta - tb;
  });

  return sorted.map((t) => ({
    timestamp: t.timestamp,
    recordType: t.recordType,
    recordId: t.recordId,
    summary: t.summary,
    source: t.source,
  }));
}

// ─── buildEvidenceSummary ─────────────────────────────────────────────────────

export function buildEvidenceSummary(
  brief: ConstitutionalBrief
): ExecutiveEvidenceSummary {
  const recordCount = brief.sections.reduce(
    (sum, s) => sum + s.records.length,
    0
  );

  return {
    recordCount,
    evidenceCount: brief.evidenceTrace.length,
    domainCoverage: [...brief.knowledgeDomains],
    contradictionCount: brief.contradictions.length,
  };
}

// ─── buildExecutiveSections ───────────────────────────────────────────────────

export function buildExecutiveSections(
  brief: ConstitutionalBrief,
  keyFacts: ExecutiveFact[],
  timelineHighlights: ExecutiveTimelineHighlight[],
  evidenceSummary: ExecutiveEvidenceSummary
): ExecutiveBriefSection[] {
  const { contextId } = brief;
  const sections: ExecutiveBriefSection[] = [];

  // executive_summary — always present
  const summaryText = buildExecutiveSummary(brief);
  sections.push(
    makeSection(
      contextId,
      "executive_summary",
      "Executive Summary",
      summaryText
    )
  );

  // key_facts
  if (keyFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "key_facts",
        "Key Facts",
        `${keyFacts.length} constitutional fact ${keyFacts.length === 1 ? "area" : "areas"} from the source brief.`,
        keyFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // knowledge_domains
  if (brief.knowledgeDomains.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "knowledge_domains",
        "Knowledge Domains",
        `Knowledge domains: ${brief.knowledgeDomains.join(", ")}.`,
        []
      )
    );
  }

  // contradictions — reused from constitutional brief, not resolved
  if (brief.contradictions.length > 0) {
    const contradictionRecords = brief.contradictions.map((c) => ({
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
        `${brief.contradictions.length} ${brief.contradictions.length === 1 ? "contradiction" : "contradictions"} from constitutional brief. Not resolved. Not judged.`,
        contradictionRecords
      )
    );
  }

  // timeline_highlights
  if (timelineHighlights.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "timeline_highlights",
        "Timeline Highlights",
        `${timelineHighlights.length} chronological ${timelineHighlights.length === 1 ? "event" : "events"} from constitutional brief.`,
        timelineHighlights.map((t) => ({
          timestamp: t.timestamp,
          recordType: t.recordType,
          recordId: t.recordId,
          summary: t.summary,
          source: t.source,
        }))
      )
    );
  }

  // evidence_summary — always present
  sections.push(
    makeSection(
      contextId,
      "evidence_summary",
      "Evidence Summary",
      `${evidenceSummary.recordCount} total records, ${evidenceSummary.evidenceCount} evidence references, ` +
        `${evidenceSummary.contradictionCount} contradictions, ${evidenceSummary.domainCoverage.length} domains.`,
      [
        {
          recordCount: evidenceSummary.recordCount,
          evidenceCount: evidenceSummary.evidenceCount,
          domainCoverage: evidenceSummary.domainCoverage,
          contradictionCount: evidenceSummary.contradictionCount,
        },
      ]
    )
  );

  // unknowns — reused from constitutional brief
  if (brief.unknowns.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "unknowns",
        "Unknowns",
        `${brief.unknowns.length} unknown ${brief.unknowns.length === 1 ? "area" : "areas"} from constitutional brief.`,
        brief.unknowns.map((u) => ({ area: u.area, description: u.description }))
      )
    );
  }

  return sections;
}
