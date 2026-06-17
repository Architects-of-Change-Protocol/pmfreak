import type { PatternCategory, PatternConfidence } from "@/lib/organizational-patterns/types";

export type { PatternCategory, PatternConfidence };

// ─── Candidate status lifecycle ───────────────────────────────────────────────

export type PatternCandidateStatus = "candidate" | "promoted" | "rejected" | "archived";

// ─── Extraction event types ───────────────────────────────────────────────────

export type PatternExtractionEventType =
  | "PATTERN_EXTRACTION_RUN_STARTED"
  | "PATTERN_EXTRACTION_RUN_COMPLETED"
  | "PATTERN_CANDIDATE_CREATED"
  | "PATTERN_CANDIDATE_PROMOTED"
  | "PATTERN_CANDIDATE_REJECTED"
  | "PATTERN_CANDIDATE_ARCHIVED";

// ─── Governance capability vocabulary ────────────────────────────────────────

export const PATTERN_EXTRACTION_CAPABILITIES = [
  "PATTERN_EXTRACTION_RUN",
  "PATTERN_CANDIDATE_CREATE",
  "PATTERN_CANDIDATE_REVIEW",
  "PATTERN_CANDIDATE_PROMOTE",
  "PATTERN_CANDIDATE_REJECT",
  "PATTERN_CANDIDATE_EXPORT",
] as const;
export type PatternExtractionCapability = (typeof PATTERN_EXTRACTION_CAPABILITIES)[number];

// ─── Minimum observation threshold ────────────────────────────────────────────

export const EXTRACTION_MINIMUM_OCCURRENCES = 3;

// ─── DB record types ──────────────────────────────────────────────────────────

export type PatternCandidate = {
  id: string;
  workspace_id: string;
  pattern_category: PatternCategory;
  candidate_title: string;
  candidate_summary: string;
  observation_count: number;
  confidence: PatternConfidence;
  status: PatternCandidateStatus;
  rule_id: string;
  promoted_pattern_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type PatternCandidateSource = {
  id: string;
  candidate_id: string;
  source_type: "platform_event" | "project_decision" | "decision_outcome" | "raid_item" | "organizational_memory" | "other";
  source_id: string;
  source_label: string;
  created_at: string;
};

export type PatternExtractionRun = {
  id: string;
  workspace_id: string;
  started_at: string;
  completed_at: string | null;
  candidate_count: number;
  rule_count: number;
  metadata: Record<string, unknown>;
};

// ─── Rule definition ──────────────────────────────────────────────────────────

export type PatternCandidateRule = {
  id: string;
  name: string;
  description: string;
  patternCategory: PatternCategory;
  minimumOccurrences: number;
  confidenceWhenMet: PatternConfidence;
};

// ─── Extraction runtime types ─────────────────────────────────────────────────

export type PatternExtractionObservation = {
  ruleId: string;
  groupKey: string;
  occurrenceCount: number;
  sourceType: PatternCandidateSource["source_type"];
  sourceIds: string[];
  sourceLabels: string[];
  candidateTitle: string;
  candidateSummary: string;
  patternCategory: PatternCategory;
  confidence: PatternConfidence;
};

export type PatternCandidateSummary = {
  candidate: PatternCandidate;
  sources: PatternCandidateSource[];
};

export type PatternExtractionResult = {
  runId: string;
  workspaceId: string;
  rulesEvaluated: number;
  candidatesCreated: number;
  candidatesSkipped: number;
  observations: PatternExtractionObservation[];
};

// ─── Explanation & export ─────────────────────────────────────────────────────

export type PatternCandidateExplanation = {
  candidate: PatternCandidate;
  rulesTriggered: PatternCandidateRule[];
  observations: PatternExtractionObservation[];
  sourceEvents: PatternCandidateSource[];
  sourceDecisions: PatternCandidateSource[];
  sourceOutcomes: PatternCandidateSource[];
  sourcePatterns: PatternCandidateSource[];
};

export type PatternCandidateExport = {
  candidate: PatternCandidate;
  rules: PatternCandidateRule[];
  observations: PatternExtractionObservation[];
  sources: PatternCandidateSource[];
  lineage: { promotedPatternId: string | null };
};

// ─── Health ───────────────────────────────────────────────────────────────────

export type PatternExtractionHealth = {
  runCount: number;
  candidateCount: number;
  promotedCount: number;
  rejectedCount: number;
  archivedCount: number;
  averageCandidatesPerRun: number;
};

// ─── Result ───────────────────────────────────────────────────────────────────

export type ExtractionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" };
