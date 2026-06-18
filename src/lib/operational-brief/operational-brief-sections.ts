// ─────────────────────────────────────────────────────────────────────────────
// Operational Brief — Section Builder
//
// Builds OperationalBriefSection entries from a ConstitutionalBrief.
// No AI. No ML. No scoring. No ranking. No prediction.
// Sections are built deterministically from existing constitutional knowledge.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalBrief } from "@/lib/constitutional-brief";
import type {
  OperationalBriefSection,
  OperationalBriefSectionType,
  OperationalFact,
  OperationalFactType,
  OperationalTimelineHighlight,
  OperationalEvidenceSummary,
} from "./types";

// ─── ID generators ───────────────────────────────────────────────────────────

function sectionId(
  contextId: string,
  sectionType: OperationalBriefSectionType
): string {
  return `op:${contextId}:${sectionType}`;
}

function factId(contextId: string, factType: OperationalFactType): string {
  return `op-fact:${contextId}:${factType}`;
}

// ─── Section factory ──────────────────────────────────────────────────────────

function makeSection(
  contextId: string,
  sectionType: OperationalBriefSectionType,
  title: string,
  summary: string,
  records: Record<string, unknown>[] = [],
  evidence: Record<string, unknown>[] = [],
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }> = []
): OperationalBriefSection {
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

// ─── buildOperationalSummary ──────────────────────────────────────────────────
// Uses counts only. No recommendations. No conclusions. No predictions.

export function buildOperationalSummary(brief: ConstitutionalBrief): string {
  const { sections, evidenceTrace, contradictions } = brief;

  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const executionCount =
    (sectionsByType.get("relevant_memories")?.records.length ?? 0) +
    (sectionsByType.get("relevant_patterns")?.records.length ?? 0);

  const taskCount = sectionsByType.get("relevant_effectiveness")?.records.length ?? 0;
  const milestoneCount = sectionsByType.get("timeline")?.records.length ?? 0;
  const dependencyCount = sectionsByType.get("bridge_relationships")?.records.length ?? 0;
  const riskCount = contradictions.length;
  const blockerCount = sectionsByType.get("outstanding_unknowns")?.records.length ?? 0;
  const evidenceCount = evidenceTrace.length;
  const contradictionCount = contradictions.length;

  const parts: string[] = [];
  if (executionCount > 0)
    parts.push(
      `${executionCount} execution ${executionCount === 1 ? "record" : "records"}`
    );
  if (taskCount > 0)
    parts.push(`${taskCount} task ${taskCount === 1 ? "record" : "records"}`);
  if (milestoneCount > 0)
    parts.push(
      `${milestoneCount} milestone ${milestoneCount === 1 ? "record" : "records"}`
    );
  if (dependencyCount > 0)
    parts.push(
      `${dependencyCount} dependency ${dependencyCount === 1 ? "record" : "records"}`
    );
  if (riskCount > 0)
    parts.push(`${riskCount} risk ${riskCount === 1 ? "record" : "records"}`);
  if (blockerCount > 0)
    parts.push(
      `${blockerCount} ${blockerCount === 1 ? "blocker" : "blockers"}`
    );

  const mainClause =
    parts.length > 0 ? parts.join(", ") : "no operational records";

  const evidenceClause =
    evidenceCount > 0
      ? ` supported by ${evidenceCount} evidence ${evidenceCount === 1 ? "reference" : "references"}`
      : "";

  const contradictionClause =
    contradictionCount > 0
      ? ` and ${contradictionCount} explicit ${contradictionCount === 1 ? "contradiction" : "contradictions"}`
      : "";

  return `This operational brief contains ${mainClause}${evidenceClause}${contradictionClause}.`;
}

// ─── buildExecutionOverview ───────────────────────────────────────────────────
// Extracts only explicitly available execution information.
// No inference. No task generation. No next-step generation.

export function buildExecutionOverview(brief: ConstitutionalBrief): OperationalFact[] {
  const facts: OperationalFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const memorySection = sectionsByType.get("relevant_memories");
  if (memorySection && memorySection.records.length > 0) {
    facts.push({
      id: factId(contextId, "execution"),
      factType: "execution",
      summary: `${memorySection.records.length} execution ${memorySection.records.length === 1 ? "record" : "records"} from constitutional brief memories.`,
      sourceCount: memorySection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "memory").length,
      lineage: memorySection.lineage,
    });
  }

  const patternSection = sectionsByType.get("relevant_patterns");
  if (patternSection && patternSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "coordination"),
      factType: "coordination",
      summary: `${patternSection.records.length} coordination ${patternSection.records.length === 1 ? "record" : "records"} from constitutional brief patterns.`,
      sourceCount: patternSection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "pattern").length,
      lineage: patternSection.lineage,
    });
  }

  return facts;
}

// ─── buildTaskOverview ────────────────────────────────────────────────────────
// Includes only explicitly referenced tasks.
// No task creation. No status inference. No ownership inference.

export function buildTaskOverview(brief: ConstitutionalBrief): OperationalFact[] {
  const facts: OperationalFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const effectivenessSection = sectionsByType.get("relevant_effectiveness");
  if (effectivenessSection && effectivenessSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "task"),
      factType: "task",
      summary: `${effectivenessSection.records.length} task ${effectivenessSection.records.length === 1 ? "record" : "records"} from constitutional brief effectiveness records.`,
      sourceCount: effectivenessSection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "effectiveness").length,
      lineage: effectivenessSection.lineage,
    });
  }

  return facts;
}

// ─── buildMilestoneOverview ───────────────────────────────────────────────────
// Includes only explicitly referenced milestones.
// No health inference. No date forecasting. No delivery prediction.

export function buildMilestoneOverview(brief: ConstitutionalBrief): OperationalFact[] {
  const facts: OperationalFact[] = [];
  const { contextId, sections } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const timelineSection = sectionsByType.get("timeline");
  if (timelineSection && timelineSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "milestone"),
      factType: "milestone",
      summary: `${timelineSection.records.length} milestone ${timelineSection.records.length === 1 ? "record" : "records"} from constitutional brief timeline.`,
      sourceCount: timelineSection.records.length,
      evidenceCount: 0,
      lineage: timelineSection.lineage,
    });
  }

  return facts;
}

// ─── buildDependencyOverview ──────────────────────────────────────────────────
// Includes only explicitly referenced dependencies.
// No risk inference. No mitigation generation.

export function buildDependencyOverview(brief: ConstitutionalBrief): OperationalFact[] {
  const facts: OperationalFact[] = [];
  const { contextId, sections, evidenceTrace } = brief;
  const sectionsByType = new Map(sections.map((s) => [s.sectionType, s]));

  const bridgeSection = sectionsByType.get("bridge_relationships");
  if (bridgeSection && bridgeSection.records.length > 0) {
    facts.push({
      id: factId(contextId, "dependency"),
      factType: "dependency",
      summary: `${bridgeSection.records.length} dependency ${bridgeSection.records.length === 1 ? "record" : "records"} from constitutional brief bridge relationships.`,
      sourceCount: bridgeSection.records.length,
      evidenceCount: evidenceTrace.filter((e) => e.recordType === "bridge_relationship").length,
      lineage: bridgeSection.lineage,
    });
  }

  return facts;
}

// ─── buildRiskOverview ────────────────────────────────────────────────────────
// Includes only explicitly referenced risks.
// No risk scoring. No impact prediction. No mitigation recommendation.

export function buildRiskOverview(brief: ConstitutionalBrief): OperationalFact[] {
  const facts: OperationalFact[] = [];
  const { contextId, contradictions } = brief;

  if (contradictions.length > 0) {
    facts.push({
      id: factId(contextId, "risk"),
      factType: "risk",
      summary: `${contradictions.length} risk ${contradictions.length === 1 ? "record" : "records"} from constitutional brief contradictions.`,
      sourceCount: contradictions.length,
      evidenceCount: 0,
      lineage: [],
    });
  }

  return facts;
}

// ─── buildBlockerOverview ─────────────────────────────────────────────────────
// Includes only explicitly available blocker information.
// No blocker inference. No automatic classification.

export function buildBlockerOverview(brief: ConstitutionalBrief): OperationalFact[] {
  const facts: OperationalFact[] = [];
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

// ─── buildEscalationOverview ──────────────────────────────────────────────────
// Includes only explicitly referenced escalations.
// No escalation recommendation. No escalation path generation.

export function buildEscalationOverview(brief: ConstitutionalBrief): OperationalFact[] {
  const facts: OperationalFact[] = [];
  const { contextId, evidenceTrace } = brief;

  const escalationEvidence = evidenceTrace.filter(
    (e) => e.recordType === "escalation" || e.reasonIncluded.toLowerCase().includes("escalation")
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

// ─── buildCoordinationOverview ────────────────────────────────────────────────
// Includes only explicitly referenced coordination records.
// No stakeholder responsibility inference. No coordination recommendations.

export function buildCoordinationOverview(brief: ConstitutionalBrief): OperationalFact[] {
  return buildExecutionOverview(brief).filter((f) => f.factType === "coordination");
}

// ─── buildDeliveryOverview ────────────────────────────────────────────────────
// Includes only explicitly referenced delivery records.
// No delivery forecasting. No confidence scoring. No delivery scores.

export function buildDeliveryOverview(brief: ConstitutionalBrief): OperationalFact[] {
  const facts: OperationalFact[] = [];
  const { contextId, evidenceTrace } = brief;

  const deliveryEvidence = evidenceTrace.filter(
    (e) => e.recordType === "delivery" || e.reasonIncluded.toLowerCase().includes("delivery")
  );

  if (deliveryEvidence.length > 0) {
    facts.push({
      id: factId(contextId, "delivery"),
      factType: "delivery",
      summary: `${deliveryEvidence.length} delivery ${deliveryEvidence.length === 1 ? "reference" : "references"} from constitutional brief evidence.`,
      sourceCount: deliveryEvidence.length,
      evidenceCount: deliveryEvidence.length,
      lineage: [],
    });
  }

  return facts;
}

// ─── buildTimelineHighlights ──────────────────────────────────────────────────
// Reuses constitutional brief timeline. Sorted chronologically.
// No invented chronology. No inferred events.

export function buildOperationalTimelineHighlights(
  brief: ConstitutionalBrief
): OperationalTimelineHighlight[] {
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

// ─── buildOperationalEvidenceSummary ─────────────────────────────────────────

export function buildOperationalEvidenceSummary(
  brief: ConstitutionalBrief,
  executionFacts: OperationalFact[],
  taskFacts: OperationalFact[],
  milestoneFacts: OperationalFact[],
  dependencyFacts: OperationalFact[],
  riskFacts: OperationalFact[],
  blockerFacts: OperationalFact[],
  escalationFacts: OperationalFact[],
  coordinationFacts: OperationalFact[],
  deliveryFacts: OperationalFact[]
): OperationalEvidenceSummary {
  const recordCount = brief.sections.reduce((sum, s) => sum + s.records.length, 0);

  return {
    recordCount,
    evidenceCount: brief.evidenceTrace.length,
    executionCount: executionFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    taskCount: taskFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    milestoneCount: milestoneFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    dependencyCount: dependencyFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    riskCount: riskFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    blockerCount: blockerFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    escalationCount: escalationFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    coordinationCount: coordinationFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    deliveryCount: deliveryFacts.reduce((sum, f) => sum + f.sourceCount, 0),
    contradictionCount: brief.contradictions.length,
  };
}

// ─── buildOperationalSections ─────────────────────────────────────────────────

export function buildOperationalSections(
  brief: ConstitutionalBrief,
  executionFacts: OperationalFact[],
  taskFacts: OperationalFact[],
  milestoneFacts: OperationalFact[],
  dependencyFacts: OperationalFact[],
  riskFacts: OperationalFact[],
  blockerFacts: OperationalFact[],
  escalationFacts: OperationalFact[],
  coordinationFacts: OperationalFact[],
  deliveryFacts: OperationalFact[],
  timelineHighlights: OperationalTimelineHighlight[],
  evidenceSummary: OperationalEvidenceSummary
): OperationalBriefSection[] {
  const { contextId } = brief;
  const sections: OperationalBriefSection[] = [];

  // operational_summary — always present
  const summaryText = buildOperationalSummary(brief);
  sections.push(
    makeSection(contextId, "operational_summary", "Operational Summary", summaryText)
  );

  // execution_overview
  if (executionFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "execution_overview",
        "Execution Overview",
        `${executionFacts.reduce((s, f) => s + f.sourceCount, 0)} execution ${executionFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "record" : "records"} from constitutional brief.`,
        executionFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // task_overview
  if (taskFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "task_overview",
        "Task Overview",
        `${taskFacts.reduce((s, f) => s + f.sourceCount, 0)} task ${taskFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "record" : "records"} from constitutional brief.`,
        taskFacts.map((f) => ({
          id: f.id,
          factType: f.factType,
          summary: f.summary,
          sourceCount: f.sourceCount,
          evidenceCount: f.evidenceCount,
        }))
      )
    );
  }

  // milestone_overview
  if (milestoneFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "milestone_overview",
        "Milestone Overview",
        `${milestoneFacts.reduce((s, f) => s + f.sourceCount, 0)} milestone ${milestoneFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "record" : "records"} from constitutional brief.`,
        milestoneFacts.map((f) => ({
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
    sections.push(
      makeSection(
        contextId,
        "dependency_overview",
        "Dependency Overview",
        `${dependencyFacts.reduce((s, f) => s + f.sourceCount, 0)} dependency ${dependencyFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "record" : "records"} from constitutional brief.`,
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
    sections.push(
      makeSection(
        contextId,
        "risk_overview",
        "Risk Overview",
        `${riskFacts.reduce((s, f) => s + f.sourceCount, 0)} risk ${riskFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "record" : "records"} from constitutional brief. Not scored. Not ranked.`,
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
    sections.push(
      makeSection(
        contextId,
        "blocker_overview",
        "Blocker Overview",
        `${blockerFacts.reduce((s, f) => s + f.sourceCount, 0)} ${blockerFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "blocker" : "blockers"} from constitutional brief.`,
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
    sections.push(
      makeSection(
        contextId,
        "escalation_overview",
        "Escalation Overview",
        `${escalationFacts.reduce((s, f) => s + f.sourceCount, 0)} escalation ${escalationFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "reference" : "references"} from constitutional brief.`,
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

  // coordination_overview
  if (coordinationFacts.length > 0) {
    sections.push(
      makeSection(
        contextId,
        "coordination_overview",
        "Coordination Overview",
        `${coordinationFacts.reduce((s, f) => s + f.sourceCount, 0)} coordination ${coordinationFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "record" : "records"} from constitutional brief.`,
        coordinationFacts.map((f) => ({
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
    sections.push(
      makeSection(
        contextId,
        "delivery_overview",
        "Delivery Overview",
        `${deliveryFacts.reduce((s, f) => s + f.sourceCount, 0)} delivery ${deliveryFacts.reduce((s, f) => s + f.sourceCount, 0) === 1 ? "reference" : "references"} from constitutional brief. Not forecasted.`,
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
          executionCount: evidenceSummary.executionCount,
          taskCount: evidenceSummary.taskCount,
          milestoneCount: evidenceSummary.milestoneCount,
          dependencyCount: evidenceSummary.dependencyCount,
          riskCount: evidenceSummary.riskCount,
          blockerCount: evidenceSummary.blockerCount,
          escalationCount: evidenceSummary.escalationCount,
          coordinationCount: evidenceSummary.coordinationCount,
          deliveryCount: evidenceSummary.deliveryCount,
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
