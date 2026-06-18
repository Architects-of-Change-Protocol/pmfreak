// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Brief Foundation — TypeScript types
//
// Organizes a ConstitutionalContextPackage into a structured, exportable,
// auditable ConstitutionalBrief.
//
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every brief section is traceable to records in the source context package.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ConstitutionalContextPackage,
  ConstitutionalTimelineEntry,
  ContextType,
} from "@/lib/constitutional-context";
import type {
  ConstitutionalContradiction,
  KnowledgeDomain,
} from "@/lib/constitutional-intelligence";

// ─── Section Types ─────────────────────────────────────────────────────────

export type BriefSectionType =
  | "context_summary"
  | "relevant_knowledge"
  | "relevant_memories"
  | "relevant_patterns"
  | "relevant_effectiveness"
  | "bridge_relationships"
  | "contradictions"
  | "evidence_trace"
  | "timeline"
  | "outstanding_unknowns";

export const ALL_BRIEF_SECTION_TYPES: BriefSectionType[] = [
  "context_summary",
  "relevant_knowledge",
  "relevant_memories",
  "relevant_patterns",
  "relevant_effectiveness",
  "bridge_relationships",
  "contradictions",
  "evidence_trace",
  "timeline",
  "outstanding_unknowns",
];

// ─── Section ───────────────────────────────────────────────────────────────

export type ConstitutionalBriefSection = {
  id: string;
  sectionType: BriefSectionType;
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

// ─── Evidence Trace Entry ──────────────────────────────────────────────────

export type ConstitutionalBriefEvidenceTraceEntry = {
  recordType: string;
  recordId: string;
  source: string;
  lineage: string;
  reasonIncluded: string;
};

// ─── Unknown ───────────────────────────────────────────────────────────────

export type ConstitutionalBriefUnknown = {
  area: string;
  description: string;
};

// ─── Coverage Metrics ──────────────────────────────────────────────────────

export type ConstitutionalBriefCoverageMetrics = {
  hasMemories: boolean;
  hasPatterns: boolean;
  hasEffectivenessRecords: boolean;
  hasBridgeRelationships: boolean;
  hasContradictions: boolean;
  hasEvidence: boolean;
  hasTimeline: boolean;
  hasKnowledgeDomains: boolean;
};

// ─── Health ────────────────────────────────────────────────────────────────

export type ConstitutionalBriefHealth = {
  sectionCount: number;
  recordCount: number;
  evidenceTraceCount: number;
  contradictionCount: number;
  unknownCount: number;
  domainCount: number;
  coverageMetrics: ConstitutionalBriefCoverageMetrics;
};

// ─── Brief ─────────────────────────────────────────────────────────────────

export type ConstitutionalBrief = {
  id: string;
  workspaceId: string;
  pmUserId: string;
  contextType: ContextType;
  contextId: string;
  generatedAt: string;
  sourceContextPackage: ConstitutionalContextPackage;
  summary: string;
  sections: ConstitutionalBriefSection[];
  evidenceTrace: ConstitutionalBriefEvidenceTraceEntry[];
  timeline: ConstitutionalTimelineEntry[];
  contradictions: ConstitutionalContradiction[];
  knowledgeDomains: KnowledgeDomain[];
  unknowns: ConstitutionalBriefUnknown[];
  metadata: Record<string, unknown>;
};

// ─── Export ────────────────────────────────────────────────────────────────

export type ConstitutionalBriefExport = {
  brief: ConstitutionalBrief;
  sourceContextPackage: ConstitutionalContextPackage;
  evidenceTrace: ConstitutionalBriefEvidenceTraceEntry[];
  timeline: ConstitutionalTimelineEntry[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  exportedAt: string;
  format: "json";
};

// ─── Explanation ───────────────────────────────────────────────────────────

export type ConstitutionalBriefSectionReason = {
  sectionType: BriefSectionType;
  reason: string;
  recordCount: number;
};

export type ConstitutionalBriefExplanation = {
  brief: ConstitutionalBrief;
  sectionReasons: ConstitutionalBriefSectionReason[];
  sourceContextPackage: ConstitutionalContextPackage;
  evidenceTrace: ConstitutionalBriefEvidenceTraceEntry[];
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
  unknowns: ConstitutionalBriefUnknown[];
};

// ─── Result ────────────────────────────────────────────────────────────────

export type ConstitutionalBriefResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ─────────────────────────────────────────────────────

export type ConstitutionalBriefEventType =
  | "CONSTITUTIONAL_BRIEF_GENERATED"
  | "CONSTITUTIONAL_BRIEF_EXPLAINED"
  | "CONSTITUTIONAL_BRIEF_EXPORTED";
