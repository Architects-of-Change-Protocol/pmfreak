// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Brief — Section Builder
//
// Builds PortfolioBriefSection entries from a ConstitutionalBrief.
// No AI. No ML. No scoring. No ranking. No prediction.
// Sections are built deterministically from existing constitutional knowledge.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalBrief } from "@/lib/constitutional-brief";
import type {
  PortfolioBriefSection,
  PortfolioBriefSectionType,
  PortfolioFact,
  PortfolioFactType,
  PortfolioTimelineHighlight,
  PortfolioEvidenceSummary,
} from "./types";

// ─── ID generators ───────────────────────────────────────────────────────────

function sectionId(
  contextId: string,
  sectionType: PortfolioBriefSectionType
): string {
  return `pf:${contextId}:${sectionType}`;
}

function factId(contextId: string, factType: PortfolioFactType): string {
  return `pf-fact:${contextId}:${factType}`;
}

// ─── Section factory ──────────────────────────────────────────────────────────

function makeSection(
  contextId: string,
  sectionType: PortfolioBriefSectionType,
  title: string,
  summary: string,
  records: Record<string, unknown>[] = [],
  evidence: Record<string, unknown>[] = [],
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }> = []
): PortfolioBriefSection {
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

// ─── buildPortfolioSummary ────────────────────────────────────────────────────
// Uses counts only. No recommendations. No conclusions. No predictions.
// No ranking. No prioritization.

export function buildPortfolioSummary(brief: ConstitutionalBrief): string {
  const { sections, evidenceTrace, contradictions } = brief;

  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const projectCount =
    (sectionsByType.get("relevant_memories")?.records.length ?? 0) +
    (sectionsByType.get("relevant_patterns")?.records.length ?? 0);

  const dependencyCount =
    sectionsByType.get("bridge_relationships")?.records.length ?? 0;

  const riskCount = contradictions.length;
  const blockerCount =
    sectionsByType.get("outstanding_unknowns")?.records.length ?? 0;

  const escalationCount = evidenceTrace.filter(
    (e) =>
      e.recordType === "escalation" ||
      e.reasonIncluded.toLowerCase().includes("escalation")
  ).length;

  const contradictionCount = contradictions.length;
  const evidenceCount = evidenceTrace.length;

  const parts: string[] = [];
  if (projectCount > 0)
    parts.push(
      `${projectCount} project-related ${projectCount === 1 ? "record" : "records"}`
    );
  if (dependencyCount > 0)
    parts.push(
      `${dependencyCount} cross-project ${dependencyCount === 1 ? "dependency" : "dependencies"}`
    );
  if (riskCount > 0)
    parts.push(`${riskCount} risk ${riskCount === 1 ? "record" : "records"}`);
  if (blockerCount > 0)
    parts.push(
      `${blockerCount} ${blockerCount === 1 ? "blocker" : "blockers"}`
    );
  if (escalationCount > 0)
    parts.push(
      `${escalationCount} ${escalationCount === 1 ? "escalation" : "escalations"}`
    );

  const mainClause =
    parts.length > 0 ? parts.join(", ") : "no portfolio records";

  const evidenceClause =
    evidenceCount > 0
      ? ` supported by ${evidenceCount} evidence ${evidenceCount === 1 ? "reference" : "references"}`
      : "";

  const contradictionClause =
    contradictionCount > 0
      ? ` and ${contradictionCount} explicit ${contradictionCount === 1 ? "contradiction" : "contradictions"}`
      : "";

  return `This portfolio brief contains ${mainClause}${evidenceClause}${contradictionClause}.`;
}

// ─── buildProjectOverview ─────────────────────────────────────────────────────
// Includes only explicitly referenced projects, project records, project evidence.
// Does not infer project status. Does not calculate project health.
// Does not rank projects.

export function buildProjectOverview(brief: ConstitutionalBrief): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const memorySection = sectionsByType.get("relevant_memories");
  if (memorySection && memorySection.records.length > 0) {
    facts.push({
      id: factId(contextId, "project"),
      factType: "project",
      summary: `${memorySection.records.length} project ${memorySection.records.length === 1 ? "record" : "records"} from constitutional brief memories.`,
      sourceCount: memorySection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "memory").length,
      lineage: memorySection.lineage,
    });
  }

  return facts;
}

// ─── buildProgramOverview ─────────────────────────────────────────────────────
// Includes only explicitly referenced programs, program records, program evidence.
// Does not infer program health. Does not forecast program outcomes.

export function buildProgramOverview(brief: ConstitutionalBrief): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const patternSection = sectionsByType.get("relevant_patterns");
  if (patternSection && patternSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "program"),
      factType: "program",
      summary: `${patternSection.records.length} program ${patternSection.records.length === 1 ? "record" : "records"} from constitutional brief patterns.`,
      sourceCount: patternSection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "pattern").length,
      lineage: patternSection.lineage,
    });
  }

  return facts;
}

// ─── buildWorkstreamOverview ──────────────────────────────────────────────────
// Includes only explicitly referenced workstreams, workstream records, workstream evidence.
// Does not infer workstream relationships.

export function buildWorkstreamOverview(brief: ConstitutionalBrief): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const effectivenessSection = sectionsByType.get("relevant_effectiveness");
  if (effectivenessSection && effectivenessSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "workstream"),
      factType: "workstream",
      summary: `${effectivenessSection.records.length} workstream ${effectivenessSection.records.length === 1 ? "record" : "records"} from constitutional brief effectiveness records.`,
      sourceCount: effectivenessSection.records.length,
      evidenceCount: evidenceTrace.filter(
        (e) => e.recordType === "effectiveness"
      ).length,
      lineage: effectivenessSection.lineage,
    });
  }

  return facts;
}

// ─── buildPortfolioDependencyOverview ────────────────────────────────────────
// Includes only explicitly referenced dependencies, cross-project dependency records.
// Does not infer dependency risk. Does not create dependency scores.

export function buildPortfolioDependencyOverview(
  brief: ConstitutionalBrief
): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const bridgeSection = sectionsByType.get("bridge_relationships");
  if (bridgeSection && bridgeSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "dependency"),
      factType: "dependency",
      summary: `${bridgeSection.records.length} cross-project dependency ${bridgeSection.records.length === 1 ? "record" : "records"} from constitutional brief bridge relationships.`,
      sourceCount: bridgeSection.records.length,
      evidenceCount: evidenceTrace.filter(
        (e) => e.recordType === "bridge_relationship"
      ).length,
      lineage: bridgeSection.lineage,
    });
  }

  return facts;
}

// ─── buildPortfolioRiskOverview ───────────────────────────────────────────────
// Includes only explicitly referenced risks.
// Does not score risks. Does not predict impact. Does not recommend mitigation.

export function buildPortfolioRiskOverview(
  brief: ConstitutionalBrief
): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, contradictions } = brief;

  if (contradictions.length > 0) {
    facts.push({
      id: factId(contextId, "risk"),
      factType: "risk",
      summary: `${contradictions.length} risk ${contradictions.length === 1 ? "record" : "records"} from constitutional brief contradictions. Not scored. Not ranked.`,
      sourceCount: contradictions.length,
      evidenceCount: 0,
      lineage: [],
    });
  }

  return facts;
}

// ─── buildPortfolioBlockerOverview ────────────────────────────────────────────
// Includes only explicitly available blocker information.
// Does not infer blockers.

export function buildPortfolioBlockerOverview(
  brief: ConstitutionalBrief
): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, sections } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const unknownsSection = sectionsByType.get("outstanding_unknowns");
  if (unknownsSection && unknownsSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "blocker"),
      factType: "blocker",
      summary: `${unknownsSection.records.length} ${unknownsSection.records.length === 1 ? "blocker" : "blockers"} from constitutional brief outstanding unknowns.`,
      sourceCount: unknownsSection.records.length,
      evidenceCount: 0,
      lineage: unknownsSection.lineage,
    });
  }

  return facts;
}

// ─── buildPortfolioEscalationOverview ────────────────────────────────────────
// Includes only explicitly referenced escalations.
// Does not recommend escalation. Does not infer escalation paths.

export function buildPortfolioEscalationOverview(
  brief: ConstitutionalBrief
): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, evidenceTrace } = brief;

  const escalationEvidence = evidenceTrace.filter(
    (e) =>
      e.recordType === "escalation" ||
      e.reasonIncluded.toLowerCase().includes("escalation")
  );

  if (escalationEvidence.length > 0) {
    facts.push({
      id: factId(contextId, "escalation"),
      factType: "escalation",
      summary: `${escalationEvidence.length} escalation ${escalationEvidence.length === 1 ? "reference" : "references"} from constitutional brief evidence.`,
      sourceCount: escalationEvidence.length,
      evidenceCount: escalationEvidence.length,
      lineage: [],
    });
  }

  return facts;
}

// ─── buildCrossProjectOverview ────────────────────────────────────────────────
// Shows explicitly documented relationships between projects, programs, workstreams,
// dependencies, risks, and blockers. No inferred relationships.

export function buildCrossProjectOverview(
  brief: ConstitutionalBrief
): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const bridgeSection = sectionsByType.get("bridge_relationships");
  if (bridgeSection && bridgeSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "coordination"),
      factType: "coordination",
      summary: `${bridgeSection.records.length} cross-project ${bridgeSection.records.length === 1 ? "relationship" : "relationships"} from constitutional brief bridge relationships.`,
      sourceCount: bridgeSection.records.length,
      evidenceCount: evidenceTrace.filter(
        (e) => e.recordType === "bridge_relationship"
      ).length,
      lineage: bridgeSection.lineage,
    });
  }

  return facts;
}

// ─── buildPortfolioDeliveryOverview ──────────────────────────────────────────
// Includes only explicitly referenced delivery records, outcome records, milestones.
// Does not forecast delivery. Does not calculate confidence.
// Does not generate portfolio health scores.

export function buildPortfolioDeliveryOverview(
  brief: ConstitutionalBrief
): PortfolioFact[] {
  const facts: PortfolioFact[] = [];
  const { contextId, evidenceTrace } = brief;

  const deliveryEvidence = evidenceTrace.filter(
    (e) =>
      e.recordType === "delivery" ||
      e.reasonIncluded.toLowerCase().includes("delivery")
  );

  if (deliveryEvidence.length > 0) {
    facts.push({
      id: factId(contextId, "delivery"),
      factType: "delivery",
      summary: `${deliveryEvidence.length} delivery ${deliveryEvidence.length === 1 ? "reference" : "references"} from constitutional brief evidence. Not forecasted.`,
      sourceCount: deliveryEvidence.length,
      evidenceCount: deliveryEvidence.length,
      lineage: [],
    });
  }

  return facts;
}

// ─── buildPortfolioTimelineHighlights ────────────────────────────────────────
// Reuses constitutional brief timeline. Sorted chronologically.
// Does not invent chronology. Does not infer missing events.

export function buildPortfolioTimelineHighlights(
  brief: ConstitutionalBrief
): PortfolioTimelineHighlight[] {
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

// ─── buildPortfolioEvidenceSummary ────────────────────────────────────────────

export function buildPortfolioEvidenceSummary(
  brief: ConstitutionalBrief,
  projectFacts: PortfolioFact[],
  programFacts: PortfolioFact[],
  workstreamFacts: PortfolioFact[],
  dependencyFacts: PortfolioFact[],
  riskFacts: PortfolioFact[],
  blockerFacts: PortfolioFact[],
  escalationFacts: PortfolioFact[]
): PortfolioEvidenceSummary {
  const recordCount = brief.sections.reduce((sum, s) => sum + s.records.length, 0);

  return {
    recordCount,
    evidenceCount: brief.evidenceTrace.length,
    projectCount: projectFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    programCount: programFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    workstreamCount: workstreamFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    dependencyCount: dependencyFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    riskCount: riskFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    blockerCount: blockerFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    escalationCount: escalationFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    contradictionCount: brief.contradictions.length,
  };
}

// ─── buildPortfolioSections ───────────────────────────────────────────────────

export function buildPortfolioSections(
  brief: ConstitutionalBrief,
  projectFacts: PortfolioFact[],
  programFacts: PortfolioFact[],
  workstreamFacts: PortfolioFact[],
  dependencyFacts: PortfolioFact[],
  riskFacts: PortfolioFact[],
  blockerFacts: PortfolioFact[],
  escalationFacts: PortfolioFact[],
  crossProjectFacts: PortfolioFact[],
  deliveryFacts: PortfolioFact[],
  timelineHighlights: PortfolioTimelineHighlight[],
  evidenceSummary: PortfolioEvidenceSummary
): PortfolioBriefSection[] {
  const { contextId } = brief;
  const sections: PortfolioBriefSection[] = [];

  // portfolio_summary — always present
  const summaryText = buildPortfolioSummary(brief);
  sections.push(
    makeSection(contextId, "portfolio_summary", "Portfolio Summary", summaryText)
  );

  // project_overview
  if (projectFacts.length > 0) {
    const total = projectFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "project_overview",
        "Project Overview",
        `${total} project ${total === 1 ? "record" : "records"} from constitutional brief.`,
        projectFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // program_overview
  if (programFacts.length > 0) {
    const total = programFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "program_overview",
        "Program Overview",
        `${total} program ${total === 1 ? "record" : "records"} from constitutional brief.`,
        programFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // workstream_overview
  if (workstreamFacts.length > 0) {
    const total = workstreamFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "workstream_overview",
        "Workstream Overview",
        `${total} workstream ${total === 1 ? "record" : "records"} from constitutional brief.`,
        workstreamFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // dependency_overview
  if (dependencyFacts.length > 0) {
    const total = dependencyFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "dependency_overview",
        "Dependency Overview",
        `${total} cross-project dependency ${total === 1 ? "record" : "records"} from constitutional brief.`,
        dependencyFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // risk_overview
  if (riskFacts.length > 0) {
    const total = riskFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "risk_overview",
        "Risk Overview",
        `${total} risk ${total === 1 ? "record" : "records"} from constitutional brief. Not scored. Not ranked.`,
        riskFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // blocker_overview
  if (blockerFacts.length > 0) {
    const total = blockerFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "blocker_overview",
        "Blocker Overview",
        `${total} ${total === 1 ? "blocker" : "blockers"} from constitutional brief.`,
        blockerFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // escalation_overview
  if (escalationFacts.length > 0) {
    const total = escalationFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "escalation_overview",
        "Escalation Overview",
        `${total} escalation ${total === 1 ? "reference" : "references"} from constitutional brief.`,
        escalationFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // cross_project_overview
  if (crossProjectFacts.length > 0) {
    const total = crossProjectFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "cross_project_overview",
        "Cross-Project Overview",
        `${total} cross-project ${total === 1 ? "relationship" : "relationships"} from constitutional brief.`,
        crossProjectFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // delivery_overview
  if (deliveryFacts.length > 0) {
    const total = deliveryFacts.reduce((s, f) => s + f.sourceCount, 0);
    sections.push(
      makeSection(
        contextId,
        "delivery_overview",
        "Delivery Overview",
        `${total} delivery ${total === 1 ? "reference" : "references"} from constitutional brief. Not forecasted.`,
        deliveryFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
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
      `${evidenceSummary.recordCount} total records, ${evidenceSummary.evidenceCount} evidence references, ${evidenceSummary.contradictionCount} contradictions.`,
      [
        {
          recordCount: evidenceSummary.recordCount,
          evidenceCount: evidenceSummary.evidenceCount,
          projectCount: evidenceSummary.projectCount,
          programCount: evidenceSummary.programCount,
          workstreamCount: evidenceSummary.workstreamCount,
          dependencyCount: evidenceSummary.dependencyCount,
          riskCount: evidenceSummary.riskCount,
          blockerCount: evidenceSummary.blockerCount,
          escalationCount: evidenceSummary.escalationCount,
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
