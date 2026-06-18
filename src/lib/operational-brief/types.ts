// ─────────────────────────────────────────────────────────────────────────────
// Operational Brief Foundation — TypeScript types
//
// Transforms a ConstitutionalBrief into a structured OperationalBrief designed
// for execution, delivery, coordination, risks, dependencies, milestones,
// blockers, and task-level operational visibility.
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

// ─── Operational Fact Type ────────────────────────────────────────────────────

export type OperationalFactType =
  | "execution"
  | "task"
  | "milestone"
  | "dependency"
  | "risk"
  | "blocker"
  | "escalation"
  | "coordination"
  | "delivery"
  | "timeline"
  | "contradiction"
  | "unknown";

// ─── Operational Fact ─────────────────────────────────────────────────────────

export type OperationalFact = {
  id: string;
  factType: OperationalFactType;
  summary: string;
  sourceCount: number;
  evidenceCount: number;
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
};

// ─── Operational Section Types ────────────────────────────────────────────────

export type OperationalBriefSectionType =
  | "operational_summary"
  | "execution_overview"
  | "task_overview"
  | "milestone_overview"
  | "dependency_overview"
  | "risk_overview"
  | "blocker_overview"
  | "escalation_overview"
  | "coordination_overview"
  | "delivery_overview"
  | "contradictions"
  | "timeline_highlights"
  | "evidence_summary"
  | "unknowns";

export const ALL_OPERATIONAL_SECTION_TYPES: OperationalBriefSectionType[] = [
  "operational_summary",
  "execution_overview",
  "task_overview",
  "milestone_overview",
  "dependency_overview",
  "risk_overview",
  "blocker_overview",
  "escalation_overview",
  "coordination_overview",
  "delivery_overview",
  "contradictions",
  "timeline_highlights",
  "evidence_summary",
  "unknowns",
];

// ─── Operational Brief Section ────────────────────────────────────────────────

export type OperationalBriefSection = {
  id: string;
  sectionType: OperationalBriefSectionType;
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

// ─── Operational Timeline Highlight ──────────────────────────────────────────

export type OperationalTimelineHighlight = {
  timestamp: string;
  recordType: string;
  recordId: string;
  summary: string;
  source: string;
};

// ─── Operational Evidence Summary ─────────────────────────────────────────────

export type OperationalEvidenceSummary = {
  recordCount: number;
  evidenceCount: number;
  executionCount: number;
  taskCount: number;
  milestoneCount: number;
  dependencyCount: number;
  riskCount: number;
  blockerCount: number;
  escalationCount: number;
  coordinationCount: number;
  deliveryCount: number;
  contradictionCount: number;
};

// ─── Coverage Metrics ─────────────────────────────────────────────────────────

export type OperationalBriefCoverageMetrics = {
  hasExecutionFacts: boolean;
  hasTaskFacts: boolean;
  hasMilestoneFacts: boolean;
  hasDependencyFacts: boolean;
  hasRiskFacts: boolean;
  hasBlockerFacts: boolean;
  hasEscalationFacts: boolean;
  hasCoordinationFacts: boolean;
  hasDeliveryFacts: boolean;
  hasContradictions: boolean;
  hasTimelineHighlights: boolean;
  hasUnknowns: boolean;
};

// ─── Health ───────────────────────────────────────────────────────────────────

export type OperationalBriefHealth = {
  sectionCount: number;
  executionFactCount: number;
  riskFactCount: number;
  dependencyFactCount: number;
  milestoneFactCount: number;
  blockerFactCount: number;
  coordinationFactCount: number;
  timelineCount: number;
  contradictionCount: number;
  unknownCount: number;
  coverageMetrics: OperationalBriefCoverageMetrics;
};

// ─── Operational Brief ────────────────────────────────────────────────────────

export type OperationalBrief = {
  id: string;
  workspaceId: string;
  pmUserId: string;
  contextType: ContextType;
  contextId: string;
  generatedAt: string;
  sourceConstitutionalBrief: ConstitutionalBrief;
  operationalSummary: string;
  sections: OperationalBriefSection[];
  executionFacts: OperationalFact[];
  riskFacts: OperationalFact[];
  dependencyFacts: OperationalFact[];
  milestoneFacts: OperationalFact[];
  blockerFacts: OperationalFact[];
  coordinationFacts: OperationalFact[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  timelineHighlights: OperationalTimelineHighlight[];
  evidenceSummary: OperationalEvidenceSummary;
  metadata: Record<string, unknown>;
};

// ─── Export ───────────────────────────────────────────────────────────────────

export type OperationalBriefExport = {
  operationalBrief: OperationalBrief;
  sourceConstitutionalBrief: ConstitutionalBrief;
  executionFacts: OperationalFact[];
  riskFacts: OperationalFact[];
  dependencyFacts: OperationalFact[];
  milestoneFacts: OperationalFact[];
  blockerFacts: OperationalFact[];
  coordinationFacts: OperationalFact[];
  timelineHighlights: OperationalTimelineHighlight[];
  evidenceSummary: OperationalEvidenceSummary;
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  exportedAt: string;
  format: "json";
};

// ─── Explanation ──────────────────────────────────────────────────────────────

export type OperationalBriefSectionReason = {
  sectionType: OperationalBriefSectionType;
  reason: string;
  recordCount: number;
};

export type OperationalBriefExplanation = {
  operationalBrief: OperationalBrief;
  sectionReasons: OperationalBriefSectionReason[];
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

export type OperationalBriefResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ────────────────────────────────────────────────────────

export type OperationalBriefEventType =
  | "OPERATIONAL_BRIEF_GENERATED"
  | "OPERATIONAL_BRIEF_EXPLAINED"
  | "OPERATIONAL_BRIEF_EXPORTED";
