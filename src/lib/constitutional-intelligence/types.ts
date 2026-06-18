// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Intelligence — TypeScript types
//
// Aggregates and explains already-existing constitutional records.
// No AI. No ML. No embeddings. No scoring. No ranking. No prediction.
// Every conclusion is traceable to explicit events, decisions, outcomes,
// memories, patterns, effectiveness records, and bridge relationships.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Knowledge Domains ───────────────────────────────────────────────────────

export type KnowledgeDomain =
  | "execution"
  | "delivery"
  | "stakeholders"
  | "risk"
  | "governance"
  | "communication"
  | "planning"
  | "escalation"
  | "decision-making"
  | "coordination"
  | "quality"
  | "operational";

export const ALL_KNOWLEDGE_DOMAINS: KnowledgeDomain[] = [
  "execution",
  "delivery",
  "stakeholders",
  "risk",
  "governance",
  "communication",
  "planning",
  "escalation",
  "decision-making",
  "coordination",
  "quality",
  "operational",
];

// ─── Contradiction ────────────────────────────────────────────────────────────

export type ContradictionSourceType =
  | "organizational_memory"
  | "organizational_pattern"
  | "decision_effectiveness"
  | "pattern_candidate"
  | "personal_memory"
  | "personal_pattern"
  | "personal_effectiveness"
  | "personal_pattern_candidate"
  | "bridge_relationship";

export type ConstitutionalContradiction = {
  id: string;
  sourceAType: ContradictionSourceType;
  sourceAId: string;
  sourceAStatement: string;
  sourceBType: ContradictionSourceType;
  sourceBId: string;
  sourceBStatement: string;
  detectedAt: string;
  relationshipType: "contradicts";
  bridgeId: string | null;
};

// ─── Domain Knowledge Entry ───────────────────────────────────────────────────

export type DomainKnowledgeEntry = {
  domain: KnowledgeDomain;
  organizationalMemoryIds: string[];
  organizationalPatternIds: string[];
  decisionEffectivenessIds: string[];
  patternCandidateIds: string[];
  personalMemoryIds: string[];
  personalPatternIds: string[];
  personalEffectivenessIds: string[];
  personalPatternCandidateIds: string[];
  bridgeRelationshipIds: string[];
  evidenceCount: number;
};

// ─── Coverage Metrics ─────────────────────────────────────────────────────────

export type ConstitutionalCoverageMetrics = {
  domainCoverage: Record<KnowledgeDomain, number>;
  organizationalMemoryCoverage: number;
  organizationalPatternCoverage: number;
  decisionEffectivenessCoverage: number;
  patternCandidateCoverage: number;
  personalMemoryCoverage: number;
  personalPatternCoverage: number;
  personalEffectivenessCoverage: number;
  personalPatternCandidateCoverage: number;
  bridgeRelationshipCoverage: number;
};

// ─── Intelligence Snapshot ────────────────────────────────────────────────────

export type ConstitutionalIntelligenceSnapshot = {
  workspaceId: string;
  pmUserId: string;
  generatedAt: string;
  organizationalMemory: Record<string, unknown>[];
  organizationalPatterns: Record<string, unknown>[];
  decisionEffectiveness: Record<string, unknown>[];
  patternCandidates: Record<string, unknown>[];
  personalMemory: Record<string, unknown>[];
  personalPatterns: Record<string, unknown>[];
  personalEffectiveness: Record<string, unknown>[];
  personalPatternCandidates: Record<string, unknown>[];
  bridgeRelationships: Record<string, unknown>[];
  contradictions: ConstitutionalContradiction[];
  knowledgeDomains: DomainKnowledgeEntry[];
  evidenceCount: number;
};

// ─── Knowledge Explanation ────────────────────────────────────────────────────

export type ConstitutionalKnowledgeExplanation = {
  knowledge: Record<string, unknown>;
  sourceType: ContradictionSourceType;
  sourceId: string;
  sources: Array<{
    sourceType: string;
    sourceId: string;
    relationshipType: string;
  }>;
  lineage: Array<{
    recordType: string;
    recordId: string;
    relationship: string;
    resolvedAt: string;
  }>;
  supportingEvidence: Record<string, unknown>[];
  contradictions: ConstitutionalContradiction[];
};

// ─── Export ───────────────────────────────────────────────────────────────────

export type ConstitutionalKnowledgeExport = {
  snapshot: ConstitutionalIntelligenceSnapshot;
  exportedAt: string;
  format: "json";
};

// ─── Health ───────────────────────────────────────────────────────────────────

export type ConstitutionalKnowledgeHealth = {
  memoryCount: number;
  patternCount: number;
  effectivenessCount: number;
  bridgeCount: number;
  candidateCount: number;
  contradictionCount: number;
  evidenceCount: number;
  coverageMetrics: ConstitutionalCoverageMetrics;
};

// ─── Result ───────────────────────────────────────────────────────────────────

export type ConstitutionalIntelligenceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Audit event types ────────────────────────────────────────────────────────

export type ConstitutionalIntelligenceEventType =
  | "CONSTITUTIONAL_INTELLIGENCE_ACCESSED"
  | "CONSTITUTIONAL_KNOWLEDGE_EXPLAINED"
  | "CONSTITUTIONAL_KNOWLEDGE_EXPORTED";
