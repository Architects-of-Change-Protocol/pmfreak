// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Dashboard Foundation — TypeScript types
//
// Composes existing constitutional artifacts (Executive, Governance,
// Operational, Portfolio Briefs) into a deterministic, auditable dashboard.
//
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every widget is traceable to a source brief.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import type { ConstitutionalBriefUnknown } from "@/lib/constitutional-brief";
import type { ExecutiveBrief } from "@/lib/executive-brief";
import type { GovernanceBrief } from "@/lib/governance-brief";
import type { OperationalBrief } from "@/lib/operational-brief";
import type { PortfolioBrief } from "@/lib/portfolio-brief";

// ─── Dashboard Type ───────────────────────────────────────────────────────────

export type ConstitutionalDashboardType =
  | "executive"
  | "governance"
  | "operational"
  | "portfolio"
  | "workspace"
  | "mixed";

export const ALL_DASHBOARD_TYPES: ConstitutionalDashboardType[] = [
  "executive",
  "governance",
  "operational",
  "portfolio",
  "workspace",
  "mixed",
];

// ─── Widget Type ──────────────────────────────────────────────────────────────

export type ConstitutionalWidgetType =
  | "executive_brief"
  | "governance_brief"
  | "operational_brief"
  | "portfolio_brief"
  | "evidence_summary"
  | "timeline"
  | "contradictions"
  | "unknowns"
  | "knowledge_domains";

export const ALL_WIDGET_TYPES: ConstitutionalWidgetType[] = [
  "executive_brief",
  "governance_brief",
  "operational_brief",
  "portfolio_brief",
  "evidence_summary",
  "timeline",
  "contradictions",
  "unknowns",
  "knowledge_domains",
];

// ─── Widget ───────────────────────────────────────────────────────────────────

export type ConstitutionalWidget = {
  id: string;
  widgetType: ConstitutionalWidgetType;
  title: string;
  summary: string;
  sourceBriefs: string[];
  evidence: Record<string, unknown>[];
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
  metadata: Record<string, unknown>;
};

// ─── Brief Reference ──────────────────────────────────────────────────────────

export type DashboardBriefReference = {
  briefId: string;
  briefType: "executive" | "governance" | "operational" | "portfolio";
  workspaceId: string;
  pmUserId: string;
  generatedAt: string;
};

// ─── Timeline Entry ───────────────────────────────────────────────────────────

export type DashboardTimelineEntry = {
  timestamp: string;
  recordType: string;
  recordId: string;
  summary: string;
  source: string;
};

// ─── Evidence Summary ─────────────────────────────────────────────────────────

export type DashboardEvidenceSummary = {
  briefCount: number;
  widgetCount: number;
  evidenceCount: number;
  contradictionCount: number;
  unknownCount: number;
};

// ─── Coverage Metrics ─────────────────────────────────────────────────────────

export type DashboardCoverageMetrics = {
  hasExecutiveBriefs: boolean;
  hasGovernanceBriefs: boolean;
  hasOperationalBriefs: boolean;
  hasPortfolioBriefs: boolean;
  hasTimeline: boolean;
  hasContradictions: boolean;
  hasUnknowns: boolean;
};

// ─── Health ───────────────────────────────────────────────────────────────────

export type DashboardHealth = {
  widgetCount: number;
  briefCount: number;
  timelineCount: number;
  contradictionCount: number;
  unknownCount: number;
  coverageMetrics: DashboardCoverageMetrics;
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type ConstitutionalDashboard = {
  id: string;
  workspaceId: string;
  pmUserId: string;
  generatedAt: string;
  dashboardType: ConstitutionalDashboardType;
  widgets: ConstitutionalWidget[];
  briefReferences: DashboardBriefReference[];
  evidenceSummary: DashboardEvidenceSummary;
  timelineSummary: DashboardTimelineEntry[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  metadata: Record<string, unknown>;
};

// ─── Input Brief ─────────────────────────────────────────────────────────────

export type DashboardInputBrief =
  | { briefType: "executive"; brief: ExecutiveBrief }
  | { briefType: "governance"; brief: GovernanceBrief }
  | { briefType: "operational"; brief: OperationalBrief }
  | { briefType: "portfolio"; brief: PortfolioBrief };

// ─── Export ───────────────────────────────────────────────────────────────────

export type ConstitutionalDashboardExport = {
  dashboard: ConstitutionalDashboard;
  widgets: ConstitutionalWidget[];
  briefReferences: DashboardBriefReference[];
  evidenceSummary: DashboardEvidenceSummary;
  timelineSummary: DashboardTimelineEntry[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  exportedAt: string;
  format: "json";
};

// ─── Explanation ──────────────────────────────────────────────────────────────

export type DashboardWidgetReason = {
  widgetId: string;
  widgetType: ConstitutionalWidgetType;
  reason: string;
  sourceBriefCount: number;
};

export type ConstitutionalDashboardExplanation = {
  dashboard: ConstitutionalDashboard;
  widgetReasons: DashboardWidgetReason[];
  sourceBriefs: DashboardBriefReference[];
  evidence: Record<string, unknown>[];
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
  unknowns: ConstitutionalBriefUnknown[];
};

// ─── Result ───────────────────────────────────────────────────────────────────

export type DashboardResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ────────────────────────────────────────────────────────

export type ConstitutionalDashboardEventType =
  | "CONSTITUTIONAL_DASHBOARD_GENERATED"
  | "CONSTITUTIONAL_DASHBOARD_EXPLAINED"
  | "CONSTITUTIONAL_DASHBOARD_EXPORTED";
