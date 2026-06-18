// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Dashboard — Builder
//
// Composes existing constitutional brief artifacts into a deterministic
// ConstitutionalDashboard. No AI. No ML. No scoring. No ranking. No prediction.
// Every widget traces back to a source brief.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import type { ExecutiveBrief } from "@/lib/executive-brief";
import type { GovernanceBrief } from "@/lib/governance-brief";
import type { OperationalBrief } from "@/lib/operational-brief";
import type { PortfolioBrief } from "@/lib/portfolio-brief";
import type { ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import type { ConstitutionalBriefUnknown } from "@/lib/constitutional-brief";
import {
  buildExecutiveBriefWidget,
  buildGovernanceBriefWidget,
  buildOperationalBriefWidget,
  buildPortfolioBriefWidget,
  buildEvidenceSummaryWidget,
  buildTimelineWidget,
  buildContradictionsWidget,
  buildUnknownsWidget,
  buildKnowledgeDomainsWidget,
  extractTimelineFromExecutiveBrief,
  extractTimelineFromGovernanceBrief,
  extractTimelineFromOperationalBrief,
  extractTimelineFromPortfolioBrief,
} from "./dashboard-widgets";
import type {
  ConstitutionalDashboard,
  ConstitutionalDashboardType,
  ConstitutionalWidget,
  DashboardBriefReference,
  DashboardEvidenceSummary,
  DashboardHealth,
  DashboardCoverageMetrics,
  DashboardResult,
  DashboardInputBrief,
  DashboardTimelineEntry,
  ConstitutionalDashboardExplanation,
  DashboardWidgetReason,
  ConstitutionalWidgetType,
} from "./types";

// ─── ID generator ─────────────────────────────────────────────────────────────

function dashboardId(
  workspaceId: string,
  pmUserId: string,
  dashboardType: string,
  generatedAt: string
): string {
  return `dashboard:${dashboardType}:${workspaceId}:${pmUserId}:${generatedAt}`;
}

// ─── Audit event helper ───────────────────────────────────────────────────────

async function emitDashboardEvent(
  workspaceId: string,
  actorId: string | null,
  eventType: string,
  dashId: string,
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
    correlationId: correlationId ?? dashId,
    causationId,
    rawReferenceTable: "constitutional_dashboard",
    rawReferenceId: dashId,
    learningEligible: false,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── Brief reference builder ──────────────────────────────────────────────────

function makeBriefReference(
  brief: ExecutiveBrief | GovernanceBrief | OperationalBrief | PortfolioBrief,
  briefType: "executive" | "governance" | "operational" | "portfolio"
): DashboardBriefReference {
  return {
    briefId: brief.id,
    briefType,
    workspaceId: brief.workspaceId,
    pmUserId: brief.pmUserId,
    generatedAt: brief.generatedAt,
  };
}

// ─── Timeline summary builder ─────────────────────────────────────────────────

export function buildDashboardTimelineSummary(
  entries: DashboardTimelineEntry[]
): DashboardTimelineEntry[] {
  return [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ─── Evidence summary builder ─────────────────────────────────────────────────

export function buildDashboardEvidenceSummary(
  briefCount: number,
  widgetCount: number,
  evidenceCount: number,
  contradictionCount: number,
  unknownCount: number
): DashboardEvidenceSummary {
  return {
    briefCount,
    widgetCount,
    evidenceCount,
    contradictionCount,
    unknownCount,
  };
}

// ─── Core dashboard assembler ─────────────────────────────────────────────────

function assembleDashboard(
  workspaceId: string,
  pmUserId: string,
  dashboardType: ConstitutionalDashboardType,
  widgets: ConstitutionalWidget[],
  briefReferences: DashboardBriefReference[],
  contradictions: ConstitutionalContradiction[],
  unknowns: ConstitutionalBriefUnknown[],
  rawTimeline: DashboardTimelineEntry[]
): ConstitutionalDashboard {
  const generatedAt = new Date().toISOString();
  const id = dashboardId(workspaceId, pmUserId, dashboardType, generatedAt);

  const timelineSummary = buildDashboardTimelineSummary(rawTimeline);
  const allEvidence = widgets.flatMap((w) => w.evidence);
  const evidenceSummary = buildDashboardEvidenceSummary(
    briefReferences.length,
    widgets.length,
    allEvidence.length,
    contradictions.length,
    unknowns.length
  );

  return {
    id,
    workspaceId,
    pmUserId,
    generatedAt,
    dashboardType,
    widgets,
    briefReferences,
    evidenceSummary,
    timelineSummary,
    contradictions,
    unknowns,
    metadata: {},
  };
}

// ─── buildExecutiveDashboard ──────────────────────────────────────────────────

export function buildExecutiveDashboard(
  workspaceId: string,
  pmUserId: string,
  briefs: ExecutiveBrief[]
): ConstitutionalDashboard {
  const briefRefs = briefs.map((b) => makeBriefReference(b, "executive"));
  const briefIds = briefs.map((b) => b.id);

  const briefWidgets = briefs.map(buildExecutiveBriefWidget);
  const timeline = briefs.flatMap(extractTimelineFromExecutiveBrief);
  const contradictions = briefs.flatMap((b) => b.contradictions);
  const unknowns = briefs.flatMap((b) => b.unknowns);
  const domains = [...new Set(briefs.flatMap((b) => b.knowledgeDomains))];
  const allEvidence = briefWidgets.flatMap((w) => w.evidence);

  const supportWidgets: ConstitutionalWidget[] = [
    buildEvidenceSummaryWidget(briefIds, allEvidence.length, contradictions.length, unknowns.length),
    buildTimelineWidget(briefIds, buildDashboardTimelineSummary(timeline)),
    buildContradictionsWidget(briefIds, contradictions.length),
  ];

  const widgets = [...briefWidgets, ...supportWidgets];

  return assembleDashboard(
    workspaceId, pmUserId, "executive",
    widgets, briefRefs, contradictions, unknowns, timeline
  );
}

// ─── buildGovernanceDashboard ─────────────────────────────────────────────────

export function buildGovernanceDashboard(
  workspaceId: string,
  pmUserId: string,
  briefs: GovernanceBrief[]
): ConstitutionalDashboard {
  const briefRefs = briefs.map((b) => makeBriefReference(b, "governance"));
  const briefIds = briefs.map((b) => b.id);

  const briefWidgets = briefs.map(buildGovernanceBriefWidget);
  const timeline = briefs.flatMap(extractTimelineFromGovernanceBrief);
  const contradictions = briefs.flatMap((b) => b.contradictions);
  const unknowns = briefs.flatMap((b) => b.unknowns);
  const allEvidence = briefWidgets.flatMap((w) => w.evidence);

  const supportWidgets: ConstitutionalWidget[] = [
    buildEvidenceSummaryWidget(briefIds, allEvidence.length, contradictions.length, unknowns.length),
    buildTimelineWidget(briefIds, buildDashboardTimelineSummary(timeline)),
    buildContradictionsWidget(briefIds, contradictions.length),
    buildUnknownsWidget(briefIds, unknowns.length),
  ];

  const widgets = [...briefWidgets, ...supportWidgets];

  return assembleDashboard(
    workspaceId, pmUserId, "governance",
    widgets, briefRefs, contradictions, unknowns, timeline
  );
}

// ─── buildOperationalDashboard ────────────────────────────────────────────────

export function buildOperationalDashboard(
  workspaceId: string,
  pmUserId: string,
  briefs: OperationalBrief[]
): ConstitutionalDashboard {
  const briefRefs = briefs.map((b) => makeBriefReference(b, "operational"));
  const briefIds = briefs.map((b) => b.id);

  const briefWidgets = briefs.map(buildOperationalBriefWidget);
  const timeline = briefs.flatMap(extractTimelineFromOperationalBrief);
  const contradictions = briefs.flatMap((b) => b.contradictions);
  const unknowns = briefs.flatMap((b) => b.unknowns);
  const allEvidence = briefWidgets.flatMap((w) => w.evidence);

  const supportWidgets: ConstitutionalWidget[] = [
    buildEvidenceSummaryWidget(briefIds, allEvidence.length, contradictions.length, unknowns.length),
    buildTimelineWidget(briefIds, buildDashboardTimelineSummary(timeline)),
    buildContradictionsWidget(briefIds, contradictions.length),
    buildUnknownsWidget(briefIds, unknowns.length),
  ];

  const widgets = [...briefWidgets, ...supportWidgets];

  return assembleDashboard(
    workspaceId, pmUserId, "operational",
    widgets, briefRefs, contradictions, unknowns, timeline
  );
}

// ─── buildPortfolioDashboard ──────────────────────────────────────────────────

export function buildPortfolioDashboard(
  workspaceId: string,
  pmUserId: string,
  briefs: PortfolioBrief[]
): ConstitutionalDashboard {
  const briefRefs = briefs.map((b) => makeBriefReference(b, "portfolio"));
  const briefIds = briefs.map((b) => b.id);

  const briefWidgets = briefs.map(buildPortfolioBriefWidget);
  const timeline = briefs.flatMap(extractTimelineFromPortfolioBrief);
  const contradictions = briefs.flatMap((b) => b.contradictions);
  const unknowns = briefs.flatMap((b) => b.unknowns);
  const allEvidence = briefWidgets.flatMap((w) => w.evidence);

  const supportWidgets: ConstitutionalWidget[] = [
    buildEvidenceSummaryWidget(briefIds, allEvidence.length, contradictions.length, unknowns.length),
    buildTimelineWidget(briefIds, buildDashboardTimelineSummary(timeline)),
    buildContradictionsWidget(briefIds, contradictions.length),
    buildUnknownsWidget(briefIds, unknowns.length),
  ];

  const widgets = [...briefWidgets, ...supportWidgets];

  return assembleDashboard(
    workspaceId, pmUserId, "portfolio",
    widgets, briefRefs, contradictions, unknowns, timeline
  );
}

// ─── buildWorkspaceDashboard ──────────────────────────────────────────────────

export function buildWorkspaceDashboard(
  workspaceId: string,
  pmUserId: string,
  executiveBriefs: ExecutiveBrief[],
  governanceBriefs: GovernanceBrief[],
  operationalBriefs: OperationalBrief[],
  portfolioBriefs: PortfolioBrief[]
): ConstitutionalDashboard {
  const execRefs = executiveBriefs.map((b) => makeBriefReference(b, "executive"));
  const govRefs = governanceBriefs.map((b) => makeBriefReference(b, "governance"));
  const opRefs = operationalBriefs.map((b) => makeBriefReference(b, "operational"));
  const portRefs = portfolioBriefs.map((b) => makeBriefReference(b, "portfolio"));
  const briefRefs = [...execRefs, ...govRefs, ...opRefs, ...portRefs];

  const briefIds = briefRefs.map((r) => r.briefId);

  const execWidgets = executiveBriefs.map(buildExecutiveBriefWidget);
  const govWidgets = governanceBriefs.map(buildGovernanceBriefWidget);
  const opWidgets = operationalBriefs.map(buildOperationalBriefWidget);
  const portWidgets = portfolioBriefs.map(buildPortfolioBriefWidget);

  const timeline: DashboardTimelineEntry[] = [
    ...executiveBriefs.flatMap(extractTimelineFromExecutiveBrief),
    ...governanceBriefs.flatMap(extractTimelineFromGovernanceBrief),
    ...operationalBriefs.flatMap(extractTimelineFromOperationalBrief),
    ...portfolioBriefs.flatMap(extractTimelineFromPortfolioBrief),
  ];

  const contradictions: ConstitutionalContradiction[] = [
    ...executiveBriefs.flatMap((b) => b.contradictions),
    ...governanceBriefs.flatMap((b) => b.contradictions),
    ...operationalBriefs.flatMap((b) => b.contradictions),
    ...portfolioBriefs.flatMap((b) => b.contradictions),
  ];

  const unknowns: ConstitutionalBriefUnknown[] = [
    ...executiveBriefs.flatMap((b) => b.unknowns),
    ...governanceBriefs.flatMap((b) => b.unknowns),
    ...operationalBriefs.flatMap((b) => b.unknowns),
    ...portfolioBriefs.flatMap((b) => b.unknowns),
  ];

  const domains = [
    ...new Set(executiveBriefs.flatMap((b) => b.knowledgeDomains)),
  ];

  const briefWidgets = [...execWidgets, ...govWidgets, ...opWidgets, ...portWidgets];
  const allEvidence = briefWidgets.flatMap((w) => w.evidence);

  const supportWidgets: ConstitutionalWidget[] = [
    buildEvidenceSummaryWidget(briefIds, allEvidence.length, contradictions.length, unknowns.length),
    buildTimelineWidget(briefIds, buildDashboardTimelineSummary(timeline)),
    buildContradictionsWidget(briefIds, contradictions.length),
    buildUnknownsWidget(briefIds, unknowns.length),
    buildKnowledgeDomainsWidget(briefIds, domains),
  ];

  const widgets = [...briefWidgets, ...supportWidgets];

  return assembleDashboard(
    workspaceId, pmUserId, "workspace",
    widgets, briefRefs, contradictions, unknowns, timeline
  );
}

// ─── buildMixedDashboard ──────────────────────────────────────────────────────

export function buildMixedDashboard(
  workspaceId: string,
  pmUserId: string,
  inputBriefs: DashboardInputBrief[]
): ConstitutionalDashboard {
  const briefRefs: DashboardBriefReference[] = [];
  const briefWidgets: ConstitutionalWidget[] = [];
  const timeline: DashboardTimelineEntry[] = [];
  const contradictions: ConstitutionalContradiction[] = [];
  const unknowns: ConstitutionalBriefUnknown[] = [];

  for (const input of inputBriefs) {
    if (input.briefType === "executive") {
      briefRefs.push(makeBriefReference(input.brief, "executive"));
      briefWidgets.push(buildExecutiveBriefWidget(input.brief));
      timeline.push(...extractTimelineFromExecutiveBrief(input.brief));
      contradictions.push(...input.brief.contradictions);
      unknowns.push(...input.brief.unknowns);
    } else if (input.briefType === "governance") {
      briefRefs.push(makeBriefReference(input.brief, "governance"));
      briefWidgets.push(buildGovernanceBriefWidget(input.brief));
      timeline.push(...extractTimelineFromGovernanceBrief(input.brief));
      contradictions.push(...input.brief.contradictions);
      unknowns.push(...input.brief.unknowns);
    } else if (input.briefType === "operational") {
      briefRefs.push(makeBriefReference(input.brief, "operational"));
      briefWidgets.push(buildOperationalBriefWidget(input.brief));
      timeline.push(...extractTimelineFromOperationalBrief(input.brief));
      contradictions.push(...input.brief.contradictions);
      unknowns.push(...input.brief.unknowns);
    } else if (input.briefType === "portfolio") {
      briefRefs.push(makeBriefReference(input.brief, "portfolio"));
      briefWidgets.push(buildPortfolioBriefWidget(input.brief));
      timeline.push(...extractTimelineFromPortfolioBrief(input.brief));
      contradictions.push(...input.brief.contradictions);
      unknowns.push(...input.brief.unknowns);
    }
  }

  const briefIds = briefRefs.map((r) => r.briefId);
  const allEvidence = briefWidgets.flatMap((w) => w.evidence);

  const supportWidgets: ConstitutionalWidget[] = [
    buildEvidenceSummaryWidget(briefIds, allEvidence.length, contradictions.length, unknowns.length),
    buildTimelineWidget(briefIds, buildDashboardTimelineSummary(timeline)),
    buildContradictionsWidget(briefIds, contradictions.length),
    buildUnknownsWidget(briefIds, unknowns.length),
  ];

  const widgets = [...briefWidgets, ...supportWidgets];

  return assembleDashboard(
    workspaceId, pmUserId, "mixed",
    widgets, briefRefs, contradictions, unknowns, timeline
  );
}

// ─── buildConstitutionalDashboard ─────────────────────────────────────────────

export async function buildConstitutionalDashboard(
  workspaceId: string,
  pmUserId: string,
  dashboardType: ConstitutionalDashboardType,
  briefs: DashboardInputBrief[],
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<DashboardResult<ConstitutionalDashboard>> {
  const dashboard = buildMixedDashboard(workspaceId, pmUserId, briefs);

  const finalDashboard: ConstitutionalDashboard = {
    ...dashboard,
    dashboardType,
  };

  await emitDashboardEvent(
    workspaceId,
    actorId,
    "CONSTITUTIONAL_DASHBOARD_GENERATED",
    finalDashboard.id,
    correlationId,
    causationId,
    {
      pmUserId,
      dashboardType,
      widgetCount: finalDashboard.widgets.length,
      briefCount: finalDashboard.briefReferences.length,
      contradictionCount: finalDashboard.contradictions.length,
      unknownCount: finalDashboard.unknowns.length,
      timelineCount: finalDashboard.timelineSummary.length,
    }
  );

  return { ok: true, data: finalDashboard };
}

// ─── explainConstitutionalDashboard ───────────────────────────────────────────

export async function explainConstitutionalDashboard(
  dashboard: ConstitutionalDashboard,
  actorId: string | null = null,
  correlationId: string | null = null,
  causationId: string | null = null
): Promise<DashboardResult<ConstitutionalDashboardExplanation>> {
  const widgetReasons: DashboardWidgetReason[] = dashboard.widgets.map((w) => ({
    widgetId: w.id,
    widgetType: w.widgetType,
    reason: widgetExplanation(w.widgetType, w.sourceBriefs.length),
    sourceBriefCount: w.sourceBriefs.length,
  }));

  const lineage = dashboard.widgets.flatMap((w) => w.lineage);

  await emitDashboardEvent(
    dashboard.workspaceId,
    actorId,
    "CONSTITUTIONAL_DASHBOARD_EXPLAINED",
    dashboard.id,
    correlationId ?? dashboard.id,
    causationId,
    {
      pmUserId: dashboard.pmUserId,
      dashboardType: dashboard.dashboardType,
      widgetCount: dashboard.widgets.length,
      briefCount: dashboard.briefReferences.length,
    }
  );

  return {
    ok: true,
    data: {
      dashboard,
      widgetReasons,
      sourceBriefs: dashboard.briefReferences,
      evidence: dashboard.widgets.flatMap((w) => w.evidence),
      lineage,
      unknowns: dashboard.unknowns,
    },
  };
}

function widgetExplanation(widgetType: ConstitutionalWidgetType, sourceBriefCount: number): string {
  switch (widgetType) {
    case "executive_brief":
      return `Included because ${sourceBriefCount} executive brief(s) were provided as input.`;
    case "governance_brief":
      return `Included because ${sourceBriefCount} governance brief(s) were provided as input.`;
    case "operational_brief":
      return `Included because ${sourceBriefCount} operational brief(s) were provided as input.`;
    case "portfolio_brief":
      return `Included because ${sourceBriefCount} portfolio brief(s) were provided as input.`;
    case "evidence_summary":
      return "Always included. Summarizes evidence counts from source briefs.";
    case "timeline":
      return "Always included. Composes timelines from source briefs chronologically.";
    case "contradictions":
      return "Always included. Surfaces contradictions from source briefs. Not resolved.";
    case "unknowns":
      return "Always included. Surfaces unknowns from source briefs. Not inferred.";
    case "knowledge_domains":
      return "Included when knowledge domains are present across source briefs.";
    default:
      return "Included from source brief data.";
  }
}

// ─── getDashboardHealth ───────────────────────────────────────────────────────

export function getDashboardHealth(dashboard: ConstitutionalDashboard): DashboardHealth {
  const coverageMetrics: DashboardCoverageMetrics = {
    hasExecutiveBriefs: dashboard.briefReferences.some((r) => r.briefType === "executive"),
    hasGovernanceBriefs: dashboard.briefReferences.some((r) => r.briefType === "governance"),
    hasOperationalBriefs: dashboard.briefReferences.some((r) => r.briefType === "operational"),
    hasPortfolioBriefs: dashboard.briefReferences.some((r) => r.briefType === "portfolio"),
    hasTimeline: dashboard.timelineSummary.length > 0,
    hasContradictions: dashboard.contradictions.length > 0,
    hasUnknowns: dashboard.unknowns.length > 0,
  };

  return {
    widgetCount: dashboard.widgets.length,
    briefCount: dashboard.briefReferences.length,
    timelineCount: dashboard.timelineSummary.length,
    contradictionCount: dashboard.contradictions.length,
    unknownCount: dashboard.unknowns.length,
    coverageMetrics,
  };
}
