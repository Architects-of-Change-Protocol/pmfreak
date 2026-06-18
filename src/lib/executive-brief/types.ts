// ─────────────────────────────────────────────────────────────────────────────
// Executive Brief Foundation — TypeScript types
//
// Transforms a ConstitutionalBrief into a structured ExecutiveBrief designed
// for executive consumption.
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

// ─── Executive Section Types ───────────────────────────────────────────────

export type ExecutiveBriefSectionType =
  | "executive_summary"
  | "key_facts"
  | "knowledge_domains"
  | "contradictions"
  | "timeline_highlights"
  | "evidence_summary"
  | "unknowns";

export const ALL_EXECUTIVE_SECTION_TYPES: ExecutiveBriefSectionType[] = [
  "executive_summary",
  "key_facts",
  "knowledge_domains",
  "contradictions",
  "timeline_highlights",
  "evidence_summary",
  "unknowns",
];

// ─── Executive Fact ────────────────────────────────────────────────────────

export type ExecutiveFactType =
  | "memory"
  | "pattern"
  | "effectiveness"
  | "bridge"
  | "contradiction"
  | "timeline"
  | "domain";

export type ExecutiveFact = {
  id: string;
  factType: ExecutiveFactType;
  summary: string;
  sourceCount: number;
  evidenceCount: number;
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
};

// ─── Executive Brief Section ───────────────────────────────────────────────

export type ExecutiveBriefSection = {
  id: string;
  sectionType: ExecutiveBriefSectionType;
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

// ─── Evidence Summary ──────────────────────────────────────────────────────

export type ExecutiveEvidenceSummary = {
  recordCount: number;
  evidenceCount: number;
  domainCoverage: string[];
  contradictionCount: number;
};

// ─── Timeline Highlight ────────────────────────────────────────────────────

export type ExecutiveTimelineHighlight = {
  timestamp: string;
  recordType: string;
  recordId: string;
  summary: string;
  source: string;
};

// ─── Coverage Metrics ──────────────────────────────────────────────────────

export type ExecutiveBriefCoverageMetrics = {
  hasKeyFacts: boolean;
  hasKnowledgeDomains: boolean;
  hasContradictions: boolean;
  hasTimelineHighlights: boolean;
  hasEvidenceSummary: boolean;
  hasUnknowns: boolean;
};

// ─── Health ────────────────────────────────────────────────────────────────

export type ExecutiveBriefHealth = {
  sectionCount: number;
  factCount: number;
  timelineCount: number;
  domainCount: number;
  contradictionCount: number;
  unknownCount: number;
  coverageMetrics: ExecutiveBriefCoverageMetrics;
};

// ─── Executive Brief ───────────────────────────────────────────────────────

export type ExecutiveBrief = {
  id: string;
  workspaceId: string;
  pmUserId: string;
  contextType: ContextType;
  contextId: string;
  generatedAt: string;
  sourceConstitutionalBrief: ConstitutionalBrief;
  executiveSummary: string;
  sections: ExecutiveBriefSection[];
  keyFacts: ExecutiveFact[];
  knowledgeDomains: string[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  timelineHighlights: ExecutiveTimelineHighlight[];
  evidenceSummary: ExecutiveEvidenceSummary;
  metadata: Record<string, unknown>;
};

// ─── Export ────────────────────────────────────────────────────────────────

export type ExecutiveBriefExport = {
  executiveBrief: ExecutiveBrief;
  sourceConstitutionalBrief: ConstitutionalBrief;
  keyFacts: ExecutiveFact[];
  timelineHighlights: ExecutiveTimelineHighlight[];
  evidenceSummary: ExecutiveEvidenceSummary;
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  exportedAt: string;
  format: "json";
};

// ─── Explanation ───────────────────────────────────────────────────────────

export type ExecutiveBriefSectionReason = {
  sectionType: ExecutiveBriefSectionType;
  reason: string;
  recordCount: number;
};

export type ExecutiveBriefExplanation = {
  executiveBrief: ExecutiveBrief;
  sectionReasons: ExecutiveBriefSectionReason[];
  sourceBrief: ConstitutionalBrief;
  evidenceTrace: ConstitutionalBriefEvidenceTraceEntry[];
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
  unknowns: ConstitutionalBriefUnknown[];
};

// ─── Result ────────────────────────────────────────────────────────────────

export type ExecutiveBriefResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ─────────────────────────────────────────────────────

export type ExecutiveBriefEventType =
  | "EXECUTIVE_BRIEF_GENERATED"
  | "EXECUTIVE_BRIEF_EXPLAINED"
  | "EXECUTIVE_BRIEF_EXPORTED";
