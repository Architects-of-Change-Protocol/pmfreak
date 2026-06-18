// ─────────────────────────────────────────────────────────────────────────────
// Governance Brief — Section Builder
//
// Builds GovernanceBriefSection entries from a ConstitutionalBrief.
// No AI. No ML. No scoring. No ranking. No prediction.
// Sections are built deterministically from existing constitutional knowledge.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalBrief } from "@/lib/constitutional-brief";
import type {
  GovernanceBriefSection,
  GovernanceBriefSectionType,
  GovernanceAuthorityFact,
  GovernanceTimelineHighlight,
  GovernanceEvidenceSummary,
} from "./types";

// ─── ID helpers ───────────────────────────────────────────────────────────────

function sectionId(
  contextId: string,
  sectionType: GovernanceBriefSectionType
): string {
  return `gov:${contextId}:${sectionType}`;
}

// ─── Section factory ──────────────────────────────────────────────────────────

function makeSection(
  contextId: string,
  sectionType: GovernanceBriefSectionType,
  title: string,
  summary: string,
  records: Record<string, unknown>[] = [],
  evidence: Record<string, unknown>[] = [],
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }> = []
): GovernanceBriefSection {
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

// ─── buildGovernanceSummary ───────────────────────────────────────────────────
// Uses counts only. No conclusions. No recommendations. No predictions.

export function buildGovernanceSummary(brief: ConstitutionalBrief): string {
  const { sections, evidenceTrace, contradictions } = brief;

  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const authorityCount =
    (sectionsByType.get("relevant_knowledge")?.records.length ?? 0) +
    (sectionsByType.get("relevant_memories")?.records.length ?? 0);

  const capabilityCount =
    (sectionsByType.get("relevant_patterns")?.records.length ?? 0) +
    (sectionsByType.get("relevant_effectiveness")?.records.length ?? 0);

  const delegationCount =
    sectionsByType.get("bridge_relationships")?.records.length ?? 0;

  const trustCount = delegationCount;

  const evidenceClause =
    evidenceTrace.length > 0
      ? ` supported by ${evidenceTrace.length} evidence ${evidenceTrace.length === 1 ? "reference" : "references"}`
      : "";

  const contradictionClause =
    contradictions.length > 0
      ? ` and ${contradictions.length} explicit ${contradictions.length === 1 ? "contradiction" : "contradictions"}`
      : "";

  return (
    `This governance brief contains ${authorityCount} authority-related ${authorityCount === 1 ? "record" : "records"},` +
    ` ${capabilityCount} capability ${capabilityCount === 1 ? "record" : "records"},` +
    ` ${delegationCount} delegation ${delegationCount === 1 ? "relationship" : "relationships"},` +
    ` ${trustCount} trust ${trustCount === 1 ? "relationship" : "relationships"}` +
    contradictionClause +
    evidenceClause +
    "."
  );
}

// ─── buildAuthorityOverview ───────────────────────────────────────────────────
// Extracts only explicitly available authority information.
// No inference. No hierarchy generation. No missing authority assumptions.

export function buildAuthorityOverview(
  brief: ConstitutionalBrief
): GovernanceAuthorityFact[] {
  const facts: GovernanceAuthorityFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const knowledgeSection = sectionsByType.get("relevant_knowledge");
  if (knowledgeSection && knowledgeSection.records.length > 0) {
    facts.push({
      id: `gov-fact:${contextId}:authority`,
      factType: "authority",
      summary: `${knowledgeSection.records.length} knowledge ${knowledgeSection.records.length === 1 ? "record" : "records"} available as authority context.`,
      sourceCount: knowledgeSection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "knowledge")
        .length,
      lineage: knowledgeSection.lineage,
    });
  }

  const memorySection = sectionsByType.get("relevant_memories");
  if (memorySection && memorySection.records.length > 0) {
    facts.push({
      id: `gov-fact:${contextId}:approval`,
      factType: "approval",
      summary: `${memorySection.records.length} memory ${memorySection.records.length === 1 ? "record" : "records"} available as approval history context.`,
      sourceCount: memorySection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "memory")
        .length,
      lineage: memorySection.lineage,
    });
  }

  return facts;
}

// ─── buildDelegationOverview ──────────────────────────────────────────────────
// Only if explicitly present. No inference.

export function buildDelegationOverview(
  brief: ConstitutionalBrief
): GovernanceAuthorityFact[] {
  const facts: GovernanceAuthorityFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const bridgeSection = sectionsByType.get("bridge_relationships");
  if (bridgeSection && bridgeSection.records.length > 0) {
    facts.push({
      id: `gov-fact:${contextId}:delegation`,
      factType: "delegation",
      summary: `${bridgeSection.records.length} bridge ${bridgeSection.records.length === 1 ? "relationship" : "relationships"} available as delegation context.`,
      sourceCount: bridgeSection.records.length,
      evidenceCount: evidenceTrace.filter(
        (e) => e.recordType === "bridge_relationship"
      ).length,
      lineage: bridgeSection.lineage,
    });
  }

  return facts;
}

// ─── buildCapabilityOverview ──────────────────────────────────────────────────
// Only if explicitly present. No inference.

export function buildCapabilityOverview(
  brief: ConstitutionalBrief
): GovernanceAuthorityFact[] {
  const facts: GovernanceAuthorityFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const patternSection = sectionsByType.get("relevant_patterns");
  if (patternSection && patternSection.records.length > 0) {
    facts.push({
      id: `gov-fact:${contextId}:capability`,
      factType: "capability",
      summary: `${patternSection.records.length} pattern ${patternSection.records.length === 1 ? "record" : "records"} available as capability context.`,
      sourceCount: patternSection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "pattern")
        .length,
      lineage: patternSection.lineage,
    });
  }

  const effectivenessSection = sectionsByType.get("relevant_effectiveness");
  if (effectivenessSection && effectivenessSection.records.length > 0) {
    facts.push({
      id: `gov-fact:${contextId}:capability-effectiveness`,
      factType: "capability",
      summary: `${effectivenessSection.records.length} effectiveness ${effectivenessSection.records.length === 1 ? "record" : "records"} available as capability lineage context.`,
      sourceCount: effectivenessSection.records.length,
      evidenceCount: evidenceTrace.filter(
        (e) => e.recordType === "effectiveness"
      ).length,
      lineage: effectivenessSection.lineage,
    });
  }

  return facts;
}

// ─── buildTrustOverview ───────────────────────────────────────────────────────
// Only if explicitly present.
// Does not calculate trust scores. Does not create trust ratings. Does not infer trust.

export function buildTrustOverview(
  brief: ConstitutionalBrief
): GovernanceAuthorityFact[] {
  const facts: GovernanceAuthorityFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const bridgeSection = sectionsByType.get("bridge_relationships");
  if (bridgeSection && bridgeSection.records.length > 0) {
    facts.push({
      id: `gov-fact:${contextId}:trust`,
      factType: "trust",
      summary: `${bridgeSection.records.length} bridge ${bridgeSection.records.length === 1 ? "relationship" : "relationships"} available as trust context.`,
      sourceCount: bridgeSection.records.length,
      evidenceCount: evidenceTrace.filter(
        (e) => e.recordType === "bridge_relationship"
      ).length,
      lineage: bridgeSection.lineage,
    });
  }

  return facts;
}

// ─── buildPolicyOverview ──────────────────────────────────────────────────────
// Only if explicitly present.

export function buildPolicyOverview(
  brief: ConstitutionalBrief
): GovernanceAuthorityFact[] {
  const facts: GovernanceAuthorityFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const knowledgeSection = sectionsByType.get("relevant_knowledge");
  if (knowledgeSection && knowledgeSection.records.length > 0) {
    facts.push({
      id: `gov-fact:${contextId}:policy`,
      factType: "policy",
      summary: `${knowledgeSection.records.length} knowledge ${knowledgeSection.records.length === 1 ? "record" : "records"} available as policy context.`,
      sourceCount: knowledgeSection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "knowledge")
        .length,
      lineage: knowledgeSection.lineage,
    });
  }

  return facts;
}

// ─── buildGovernanceTimelineHighlights ────────────────────────────────────────
// Reuses constitutional brief timeline. Sorted chronologically.
// No invented events. No inferred chronology.

export function buildGovernanceTimelineHighlights(
  brief: ConstitutionalBrief
): GovernanceTimelineHighlight[] {
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

// ─── buildGovernanceEvidenceSummary ───────────────────────────────────────────

export function buildGovernanceEvidenceSummary(
  brief: ConstitutionalBrief
): GovernanceEvidenceSummary {
  const { sections, evidenceTrace, contradictions } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const recordCount = sections.reduce((sum, s) => sum + s.records.length, 0);

  const authorityCount =
    (sectionsByType.get("relevant_knowledge")?.records.length ?? 0) +
    (sectionsByType.get("relevant_memories")?.records.length ?? 0);

  const capabilityCount =
    (sectionsByType.get("relevant_patterns")?.records.length ?? 0) +
    (sectionsByType.get("relevant_effectiveness")?.records.length ?? 0);

  const delegationCount =
    sectionsByType.get("bridge_relationships")?.records.length ?? 0;

  const trustCount = delegationCount;

  return {
    recordCount,
    evidenceCount: evidenceTrace.length,
    authorityCount,
    capabilityCount,
    delegationCount,
    trustCount,
    contradictionCount: contradictions.length,
  };
}

// ─── buildGovernanceSections ──────────────────────────────────────────────────

export function buildGovernanceSections(
  brief: ConstitutionalBrief,
  authorityFacts: GovernanceAuthorityFact[],
  capabilityFacts: GovernanceAuthorityFact[],
  delegationFacts: GovernanceAuthorityFact[],
  trustFacts: GovernanceAuthorityFact[],
  policyFacts: GovernanceAuthorityFact[],
  timelineHighlights: GovernanceTimelineHighlight[],
  evidenceSummary: GovernanceEvidenceSummary
): GovernanceBriefSection[] {
  const { contextId } = brief;
  const sections: GovernanceBriefSection[] = [];

  // governance_summary — always present
  const summaryText = buildGovernanceSummary(brief);
  sections.push(
    makeSection(
      contextId,
      "governance_summary",
      "Governance Summary",
      summaryText
    )
  );

  // authority_overview
  if (authorityFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "authority_overview",
        "Authority Overview",
        `${authorityFacts.length} authority-related ${authorityFacts.length === 1 ? "fact" : "facts"} from the source brief.`,
        authorityFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        })),
        [],
        authorityFacts.flatMap((f) => f.lineage)
      )
    );
  }

  // approval_overview — derived from authority facts with approval factType
  const approvalFacts = authorityFacts.filter((f) => f.factType === "approval");
  if (approvalFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "approval_overview",
        "Approval Overview",
        `${approvalFacts.length} approval ${approvalFacts.length === 1 ? "record" : "records"} from the source brief.`,
        approvalFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        })),
        [],
        approvalFacts.flatMap((f) => f.lineage)
      )
    );
  }

  // delegation_overview
  if (delegationFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "delegation_overview",
        "Delegation Overview",
        `${delegationFacts.length} delegation ${delegationFacts.length === 1 ? "record" : "records"} from the source brief.`,
        delegationFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        })),
        [],
        delegationFacts.flatMap((f) => f.lineage)
      )
    );
  }

  // capability_overview
  if (capabilityFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "capability_overview",
        "Capability Overview",
        `${capabilityFacts.length} capability ${capabilityFacts.length === 1 ? "record" : "records"} from the source brief.`,
        capabilityFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        })),
        [],
        capabilityFacts.flatMap((f) => f.lineage)
      )
    );
  }

  // trust_overview
  if (trustFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "trust_overview",
        "Trust Overview",
        `${trustFacts.length} trust ${trustFacts.length === 1 ? "record" : "records"} from the source brief. No trust scores. No trust ratings.`,
        trustFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        })),
        [],
        trustFacts.flatMap((f) => f.lineage)
      )
    );
  }

  // policy_overview
  if (policyFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "policy_overview",
        "Policy Overview",
        `${policyFacts.length} policy ${policyFacts.length === 1 ? "record" : "records"} from the source brief.`,
        policyFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        })),
        [],
        policyFacts.flatMap((f) => f.lineage)
      )
    );
  }

  // contradictions — reused from constitutional brief, not resolved, not judged
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
        `${evidenceSummary.authorityCount} authority records, ${evidenceSummary.capabilityCount} capability records, ` +
        `${evidenceSummary.delegationCount} delegation records, ${evidenceSummary.trustCount} trust records, ` +
        `${evidenceSummary.contradictionCount} contradictions.`,
      [
        {
          recordCount: evidenceSummary.recordCount,
          evidenceCount: evidenceSummary.evidenceCount,
          authorityCount: evidenceSummary.authorityCount,
          capabilityCount: evidenceSummary.capabilityCount,
          delegationCount: evidenceSummary.delegationCount,
          trustCount: evidenceSummary.trustCount,
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
