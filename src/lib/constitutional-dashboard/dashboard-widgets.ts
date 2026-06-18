// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Dashboard — Widget builders
//
// Builds ConstitutionalWidget instances from existing brief artifacts.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExecutiveBrief } from "@/lib/executive-brief";
import type { GovernanceBrief } from "@/lib/governance-brief";
import type { OperationalBrief } from "@/lib/operational-brief";
import type { PortfolioBrief } from "@/lib/portfolio-brief";
import type {
  ConstitutionalWidget,
  ConstitutionalWidgetType,
  DashboardTimelineEntry,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function widgetId(widgetType: ConstitutionalWidgetType, sourceBriefId: string): string {
  return `widget:${widgetType}:${sourceBriefId}`;
}

// ─── Executive Brief Widget ───────────────────────────────────────────────────

export function buildExecutiveBriefWidget(brief: ExecutiveBrief): ConstitutionalWidget {
  return {
    id: widgetId("executive_brief", brief.id),
    widgetType: "executive_brief",
    title: "Executive Brief",
    summary: brief.executiveSummary,
    sourceBriefs: [brief.id],
    evidence: brief.sections.flatMap((s) => s.evidence),
    lineage: brief.sections.flatMap((s) => s.lineage),
    metadata: {
      sectionCount: brief.sections.length,
      factCount: brief.keyFacts.length,
      contextType: brief.contextType,
      contextId: brief.contextId,
    },
  };
}

// ─── Governance Brief Widget ──────────────────────────────────────────────────

export function buildGovernanceBriefWidget(brief: GovernanceBrief): ConstitutionalWidget {
  return {
    id: widgetId("governance_brief", brief.id),
    widgetType: "governance_brief",
    title: "Governance Brief",
    summary: brief.governanceSummary,
    sourceBriefs: [brief.id],
    evidence: brief.sections.flatMap((s) => s.evidence),
    lineage: brief.sections.flatMap((s) => s.lineage),
    metadata: {
      sectionCount: brief.sections.length,
      authorityFactCount: brief.authorityFacts.length,
      delegationFactCount: brief.delegationFacts.length,
      contextType: brief.contextType,
      contextId: brief.contextId,
    },
  };
}

// ─── Operational Brief Widget ─────────────────────────────────────────────────

export function buildOperationalBriefWidget(brief: OperationalBrief): ConstitutionalWidget {
  return {
    id: widgetId("operational_brief", brief.id),
    widgetType: "operational_brief",
    title: "Operational Brief",
    summary: brief.operationalSummary,
    sourceBriefs: [brief.id],
    evidence: brief.sections.flatMap((s) => s.evidence),
    lineage: brief.sections.flatMap((s) => s.lineage),
    metadata: {
      sectionCount: brief.sections.length,
      executionFactCount: brief.executionFacts.length,
      riskFactCount: brief.riskFacts.length,
      contextType: brief.contextType,
      contextId: brief.contextId,
    },
  };
}

// ─── Portfolio Brief Widget ───────────────────────────────────────────────────

export function buildPortfolioBriefWidget(brief: PortfolioBrief): ConstitutionalWidget {
  return {
    id: widgetId("portfolio_brief", brief.id),
    widgetType: "portfolio_brief",
    title: "Portfolio Brief",
    summary: brief.portfolioSummary,
    sourceBriefs: [brief.id],
    evidence: brief.sections.flatMap((s) => s.evidence),
    lineage: brief.sections.flatMap((s) => s.lineage),
    metadata: {
      sectionCount: brief.sections.length,
      projectFactCount: brief.projectFacts.length,
      riskFactCount: brief.riskFacts.length,
      contextType: brief.contextType,
      contextId: brief.contextId,
    },
  };
}

// ─── Evidence Summary Widget ──────────────────────────────────────────────────

export function buildEvidenceSummaryWidget(
  briefIds: string[],
  evidenceCount: number,
  contradictionCount: number,
  unknownCount: number
): ConstitutionalWidget {
  return {
    id: `widget:evidence_summary:${briefIds.join("+")}`,
    widgetType: "evidence_summary",
    title: "Evidence Summary",
    summary: `${briefIds.length} brief(s) referenced. ${evidenceCount} evidence item(s). ${contradictionCount} contradiction(s). ${unknownCount} unknown(s).`,
    sourceBriefs: briefIds,
    evidence: [],
    lineage: [],
    metadata: {
      briefCount: briefIds.length,
      evidenceCount,
      contradictionCount,
      unknownCount,
    },
  };
}

// ─── Timeline Widget ──────────────────────────────────────────────────────────

export function buildTimelineWidget(
  briefIds: string[],
  timeline: DashboardTimelineEntry[]
): ConstitutionalWidget {
  return {
    id: `widget:timeline:${briefIds.join("+")}`,
    widgetType: "timeline",
    title: "Timeline",
    summary: `${timeline.length} timeline event(s) across ${briefIds.length} brief(s).`,
    sourceBriefs: briefIds,
    evidence: [],
    lineage: [],
    metadata: {
      entryCount: timeline.length,
    },
  };
}

// ─── Contradictions Widget ────────────────────────────────────────────────────

export function buildContradictionsWidget(
  briefIds: string[],
  contradictionCount: number
): ConstitutionalWidget {
  return {
    id: `widget:contradictions:${briefIds.join("+")}`,
    widgetType: "contradictions",
    title: "Contradictions",
    summary: `${contradictionCount} contradiction(s) surfaced from source briefs. Not resolved.`,
    sourceBriefs: briefIds,
    evidence: [],
    lineage: [],
    metadata: { contradictionCount },
  };
}

// ─── Unknowns Widget ──────────────────────────────────────────────────────────

export function buildUnknownsWidget(
  briefIds: string[],
  unknownCount: number
): ConstitutionalWidget {
  return {
    id: `widget:unknowns:${briefIds.join("+")}`,
    widgetType: "unknowns",
    title: "Unknowns",
    summary: `${unknownCount} unknown(s) documented in source briefs. Not inferred.`,
    sourceBriefs: briefIds,
    evidence: [],
    lineage: [],
    metadata: { unknownCount },
  };
}

// ─── Knowledge Domains Widget ─────────────────────────────────────────────────

export function buildKnowledgeDomainsWidget(
  briefIds: string[],
  domains: string[]
): ConstitutionalWidget {
  return {
    id: `widget:knowledge_domains:${briefIds.join("+")}`,
    widgetType: "knowledge_domains",
    title: "Knowledge Domains",
    summary: `${domains.length} knowledge domain(s) covered across ${briefIds.length} brief(s).`,
    sourceBriefs: briefIds,
    evidence: [],
    lineage: [],
    metadata: { domains, domainCount: domains.length },
  };
}

// ─── Timeline extraction helpers ──────────────────────────────────────────────

export function extractTimelineFromExecutiveBrief(brief: ExecutiveBrief): DashboardTimelineEntry[] {
  return brief.timelineHighlights.map((t) => ({
    timestamp: t.timestamp,
    recordType: t.recordType,
    recordId: t.recordId,
    summary: t.summary,
    source: t.source,
  }));
}

export function extractTimelineFromGovernanceBrief(brief: GovernanceBrief): DashboardTimelineEntry[] {
  return brief.timelineHighlights.map((t) => ({
    timestamp: t.timestamp,
    recordType: t.recordType,
    recordId: t.recordId,
    summary: t.summary,
    source: t.source,
  }));
}

export function extractTimelineFromOperationalBrief(brief: OperationalBrief): DashboardTimelineEntry[] {
  return brief.timelineHighlights.map((t) => ({
    timestamp: t.timestamp,
    recordType: t.recordType,
    recordId: t.recordId,
    summary: t.summary,
    source: t.source,
  }));
}

export function extractTimelineFromPortfolioBrief(brief: PortfolioBrief): DashboardTimelineEntry[] {
  return brief.timelineHighlights.map((t) => ({
    timestamp: t.timestamp,
    recordType: t.recordType,
    recordId: t.recordId,
    summary: t.summary,
    source: t.source,
  }));
}
