// ─────────────────────────────────────────────────────────────────────────────
// Governance Brief Foundation — TypeScript types
//
// Transforms a ConstitutionalBrief into a GovernanceBrief designed for
// governance, authority, delegation, capability, trust, and constitutional
// oversight audiences.
//
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every brief section is traceable to the source ConstitutionalBrief.
// ─────────────────────────────────────────────────────────────────────────────

import type { ContextType } from "@/lib/constitutional-context";
import type { ConstitutionalContradiction } from "@/lib/constitutional-intelligence";
import type {
  ConstitutionalBrief,
  ConstitutionalBriefEvidenceTraceEntry,
  ConstitutionalBriefUnknown,
} from "@/lib/constitutional-brief";

// ─── Governance Section Types ─────────────────────────────────────────────────

export type GovernanceBriefSectionType =
  | "governance_summary"
  | "authority_overview"
  | "approval_overview"
  | "delegation_overview"
  | "capability_overview"
  | "trust_overview"
  | "policy_overview"
  | "contradictions"
  | "timeline_highlights"
  | "evidence_summary"
  | "unknowns";

export const ALL_GOVERNANCE_SECTION_TYPES: GovernanceBriefSectionType[] = [
  "governance_summary",
  "authority_overview",
  "approval_overview",
  "delegation_overview",
  "capability_overview",
  "trust_overview",
  "policy_overview",
  "contradictions",
  "timeline_highlights",
  "evidence_summary",
  "unknowns",
];

// ─── Governance Authority Fact ────────────────────────────────────────────────

export type GovernanceFactType =
  | "authority"
  | "approval"
  | "delegation"
  | "capability"
  | "trust"
  | "policy"
  | "contradiction"
  | "timeline";

export type GovernanceAuthorityFact = {
  id: string;
  factType: GovernanceFactType;
  summary: string;
  sourceCount: number;
  evidenceCount: number;
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
  }>;
};

// ─── Governance Brief Section ─────────────────────────────────────────────────

export type GovernanceBriefSection = {
  id: string;
  sectionType: GovernanceBriefSectionType;
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

// ─── Governance Evidence Summary ──────────────────────────────────────────────

export type GovernanceEvidenceSummary = {
  recordCount: number;
  evidenceCount: number;
  authorityCount: number;
  capabilityCount: number;
  delegationCount: number;
  trustCount: number;
  contradictionCount: number;
};

// ─── Timeline Highlight ───────────────────────────────────────────────────────

export type GovernanceTimelineHighlight = {
  timestamp: string;
  recordType: string;
  recordId: string;
  summary: string;
  source: string;
};

// ─── Coverage Metrics ─────────────────────────────────────────────────────────

export type GovernanceBriefCoverageMetrics = {
  hasAuthorityFacts: boolean;
  hasCapabilityFacts: boolean;
  hasDelegationFacts: boolean;
  hasTrustFacts: boolean;
  hasContradictions: boolean;
  hasTimelineHighlights: boolean;
  hasEvidenceSummary: boolean;
  hasUnknowns: boolean;
};

// ─── Health ───────────────────────────────────────────────────────────────────

export type GovernanceBriefHealth = {
  sectionCount: number;
  authorityFactCount: number;
  capabilityFactCount: number;
  delegationFactCount: number;
  trustFactCount: number;
  timelineCount: number;
  contradictionCount: number;
  unknownCount: number;
  coverageMetrics: GovernanceBriefCoverageMetrics;
};

// ─── Governance Brief ─────────────────────────────────────────────────────────

export type GovernanceBrief = {
  id: string;
  workspaceId: string;
  pmUserId: string;
  contextType: ContextType;
  contextId: string;
  generatedAt: string;
  sourceConstitutionalBrief: ConstitutionalBrief;
  governanceSummary: string;
  sections: GovernanceBriefSection[];
  authorityFacts: GovernanceAuthorityFact[];
  capabilityFacts: GovernanceAuthorityFact[];
  delegationFacts: GovernanceAuthorityFact[];
  trustFacts: GovernanceAuthorityFact[];
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  timelineHighlights: GovernanceTimelineHighlight[];
  evidenceSummary: GovernanceEvidenceSummary;
  metadata: Record<string, unknown>;
};

// ─── Export ───────────────────────────────────────────────────────────────────

export type GovernanceBriefExport = {
  governanceBrief: GovernanceBrief;
  sourceConstitutionalBrief: ConstitutionalBrief;
  authorityFacts: GovernanceAuthorityFact[];
  capabilityFacts: GovernanceAuthorityFact[];
  delegationFacts: GovernanceAuthorityFact[];
  trustFacts: GovernanceAuthorityFact[];
  timelineHighlights: GovernanceTimelineHighlight[];
  evidenceSummary: GovernanceEvidenceSummary;
  contradictions: ConstitutionalContradiction[];
  unknowns: ConstitutionalBriefUnknown[];
  exportedAt: string;
  format: "json";
};

// ─── Explanation ──────────────────────────────────────────────────────────────

export type GovernanceBriefSectionReason = {
  sectionType: GovernanceBriefSectionType;
  reason: string;
  recordCount: number;
};

export type GovernanceBriefExplanation = {
  governanceBrief: GovernanceBrief;
  sectionReasons: GovernanceBriefSectionReason[];
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

export type GovernanceBriefResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit Event Types ────────────────────────────────────────────────────────

export type GovernanceBriefEventType =
  | "GOVERNANCE_BRIEF_GENERATED"
  | "GOVERNANCE_BRIEF_EXPLAINED"
  | "GOVERNANCE_BRIEF_EXPORTED";
