// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Context Engine — TypeScript types
//
// Selects relevant constitutional knowledge for a specific operational context.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Selection is deterministic, auditable, exportable, and explainable.
// ─────────────────────────────────────────────────────────────────────────────

import type { KnowledgeDomain, ConstitutionalContradiction } from "@/lib/constitutional-intelligence";

// ─── Context Types ────────────────────────────────────────────────────────────

export type ContextType =
  | "decision"
  | "project"
  | "stakeholder"
  | "risk"
  | "milestone"
  | "task"
  | "escalation"
  | "meeting"
  | "outcome"
  | "governance-review";

export const ALL_CONTEXT_TYPES: ContextType[] = [
  "decision",
  "project",
  "stakeholder",
  "risk",
  "milestone",
  "task",
  "escalation",
  "meeting",
  "outcome",
  "governance-review",
];

// ─── Context Request ──────────────────────────────────────────────────────────

export type ConstitutionalContextRequest = {
  workspaceId: string;
  pmUserId: string;
  contextType: ContextType;
  contextId: string;
  relatedIds: string[];
  knowledgeDomains: KnowledgeDomain[];
  maxResults: number;
};

// ─── Timeline Entry ───────────────────────────────────────────────────────────

export type ConstitutionalTimelineEntry = {
  timestamp: string;
  recordType: string;
  recordId: string;
  summary: string;
  source: string;
};

// ─── Context Package ──────────────────────────────────────────────────────────

export type ConstitutionalContextPackage = {
  workspaceId: string;
  pmUserId: string;
  contextType: ContextType;
  contextId: string;
  generatedAt: string;
  memories: Record<string, unknown>[];
  patterns: Record<string, unknown>[];
  effectivenessRecords: Record<string, unknown>[];
  bridgeRelationships: Record<string, unknown>[];
  contradictions: ConstitutionalContradiction[];
  evidence: Record<string, unknown>[];
  timeline: ConstitutionalTimelineEntry[];
  knowledgeDomains: KnowledgeDomain[];
};

// ─── Context Explanation ──────────────────────────────────────────────────────

export type ConstitutionalContextSelectionReason = {
  recordType: string;
  recordId: string;
  reason: string;
  matchedField: string;
  matchedValue: string;
};

export type ConstitutionalContextExplanation = {
  contextType: ContextType;
  contextId: string;
  selectedRecords: Array<{ recordType: string; recordId: string }>;
  selectionReasons: ConstitutionalContextSelectionReason[];
  sourceRelationships: Array<{
    fromType: string;
    fromId: string;
    relationshipType: string;
    toType: string;
    toId: string;
  }>;
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
    resolvedAt: string;
  }>;
};

// ─── Context Export ───────────────────────────────────────────────────────────

export type ConstitutionalContextExport = {
  package: ConstitutionalContextPackage;
  exportedAt: string;
  format: "json";
};

// ─── Context Health ───────────────────────────────────────────────────────────

export type ConstitutionalContextCoverageMetrics = {
  totalContextsGenerated: number;
  contextTypeBreakdown: Record<ContextType, number>;
  averageMemoriesPerContext: number;
  averagePatternsPerContext: number;
  averageEffectivenessPerContext: number;
  averageBridgesPerContext: number;
};

export type ConstitutionalContextHealth = {
  contextCount: number;
  averageRecordsPerContext: number;
  averageEvidencePerContext: number;
  averageContradictionsPerContext: number;
  coverageMetrics: ConstitutionalContextCoverageMetrics;
};

// ─── Result ───────────────────────────────────────────────────────────────────

export type ConstitutionalContextResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ────────────────────────────────────────────────────────

export type ConstitutionalContextEventType =
  | "CONTEXT_PACKAGE_GENERATED"
  | "CONTEXT_PACKAGE_EXPLAINED"
  | "CONTEXT_PACKAGE_EXPORTED";
