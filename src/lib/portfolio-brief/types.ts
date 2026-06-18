// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Brief Foundation — TypeScript types
//
// Transforms a ConstitutionalBrief into a structured PortfolioBrief designed
// for portfolio-level visibility across projects, programs, workstreams,
// dependencies, risks, blockers, escalations, and cross-project relationships.
//
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every statement is traceable to the source ConstitutionalBrief.
// ─────────────────────────────────────────────────────────────────────────────

import type { ContextType } from "@/lib/constitutional-context";
import type { ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import type {
  ConstitutionalBrief,
  ConstitutionalBriefEvidenceTraceEntry,
  ConstitutionalBriefUnknown,
} from "@/lib/constitutional-brief";

// ─── Portfolio Fact Type ──────────────────────────────────────────────────────

export type PortfolioFactType =
  | "project"
  | "program"
  | "workstream"
  | "dependency"
  | "risk"
  | "blocker"
  | "escalation"
  | "coordination"
  | "delivery"
  | "timeline"
  | "contradiction"
  | "unknown";

// ─── Portfolio Fact ───────────────────────────────────────────────────────────

export type PortfolioFact = {
  id: string;
  factType: PortfolioFactType;
  summary: string;
  sourceCount: number;
  evidenceCount: number;
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
};

// ─── Portfolio Brief Section Types ────────────────────────────────────────────

export type PortfolioBriefSectionType =
  | "portfolio_summary"
  | "project_overview"
  | "program_overview"
  | "workstream_overview"
  | "dependency_overview"
  | "risk_overview"
  | "blocker_overview"
  | "escalation_overview"
  | "cross_project_overview"
  | "delivery_overview"
  | "contradictions"
  | "timeline_highlights"
  | "evidence_summary"
  | "unknowns";

export const ALL_PORTFOLIO_SECTION_TYPES: PortfolioBriefSectionType[] = [
  "portfolio_summary",
  "project_overview",
  "program_overview",
  "workstream_overview",
  "dependency_overview",
  "risk_overview",
  "blocker_overview",
  "escalation_overview",
  "cross_project_overview",
  "delivery_overview",
  "contradictions",
  "timeline_highlights",
  "evidence_summary",
  "unknowns",
];

// ─── Portfolio Brief Section ──────────────────────────────────────────────────

export type PortfolioBriefSection = {
  id: string;
  sectionType: PortfolioBriefSectionType;
  title: string;
  summary: string;
  records: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
};

// ─── Portfolio Timeline Highlight ─────────────────────────────────────────────

export type PortfolioTimelineHighlight = {
  timestamp: string;
  recordType: string;
  recordId: string;
  summary: string;
  source: string;
};

// ─── Portfolio Evidence Summary ───────────────────────────────────────────────

export type PortfolioEvidenceSummary = {
  recordCount: number;
  evidenceCount: number;
  projectCount: number;
  programCount: number;
  workstreamCount: number;
  dependencyCount: number;
  riskCount: number;
  blockerCount: number;
  escalationCount: number;
  contradictionCount: number;
};

// ─── Coverage Metrics ─────────────────────────────────────────────────────────

export type PortfolioBriefCoverageMetrics = {
  hasProjectFacts: boolean;
  hasProgramFacts: boolean;
  hasWorkstreamFacts: boolean;
  hasDependencyFacts: boolean;
  hasRiskFacts: boolean;
  hasBlockerFacts: boolean;
  hasEscalationFacts: boolean;
  hasDeliveryFacts: boolean;
  hasContradictions: boolean;
  hasTimelineHighlights: boolean;
  hasUnknowns: boolean;
};

// ─── Health ───────────────────────────────────────────────────────────────────

export type PortfolioBriefHealth = {
  sectionCount: number;
  projectFactCount: number;
  programFactCount: number;
  workstreamFactCount: number;
  dependencyFactCount: number;
  riskFactCount: number;
  blockerFactCount: number;
  escalationFactCount: number;
  timelineCount: number;
  contradictionCount: number;
  unknownCount: number;
  coverageMetrics: PortfolioBriefCoverageMetrics;
};

// ─── Portfolio Brief ──────────────────────────────────────────────────────────

export type PortfolioBrief = {
  id: string;
  workspaceId: string;
  pmUserId: string;
  contextType: ContextType;
  contextId: string;
  generatedAt: string;
  sourceConstitutionalBrief: ConstitutionalBrief;
  portfolioSummary: string;
  sections: PortfolioBriefSection[];
  projectFacts: PortfolioFact[];
  programFacts: PortfolioFact[];
  workstreamFacts: PortfolioFact[];
  dependencyFacts: PortfolioFact[];
  riskFacts: PortfolioFact[];
  blockerFacts: PortfolioFact[];
  escalationFacts: PortfolioFact[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  timelineHighlights: PortfolioTimelineHighlight[];
  evidenceSummary: PortfolioEvidenceSummary;
  metadata: Record<string, unknown>;
};

// ─── Export ───────────────────────────────────────────────────────────────────

export type PortfolioBriefExport = {
  portfolioBrief: PortfolioBrief;
  sourceConstitutionalBrief: ConstitutionalBrief;
  projectFacts: PortfolioFact[];
  programFacts: PortfolioFact[];
  workstreamFacts: PortfolioFact[];
  dependencyFacts: PortfolioFact[];
  riskFacts: PortfolioFact[];
  blockerFacts: PortfolioFact[];
  escalationFacts: PortfolioFact[];
  timelineHighlights: PortfolioTimelineHighlight[];
  evidenceSummary: PortfolioEvidenceSummary;
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  exportedAt: string;
  format: "json";
};

// ─── Explanation ──────────────────────────────────────────────────────────────

export type PortfolioBriefSectionReason = {
  sectionType: PortfolioBriefSectionType;
  reason: string;
  recordCount: number;
};

export type PortfolioBriefExplanation = {
  portfolioBrief: PortfolioBrief;
  sectionReasons: PortfolioBriefSectionReason[];
  sourceBrief: ConstitutionalBrief;
  evidenceTrace: ConstitutionalBriefEvidenceTraceEntry[];
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
  unknowns: ConstitutionalBriefUnknown[];
};

// ─── Result ───────────────────────────────────────────────────────────────────

export type PortfolioBriefResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ────────────────────────────────────────────────────────

export type PortfolioBriefEventType =
  | "PORTFOLIO_BRIEF_GENERATED"
  | "PORTFOLIO_BRIEF_EXPLAINED"
  | "PORTFOLIO_BRIEF_EXPORTED";
