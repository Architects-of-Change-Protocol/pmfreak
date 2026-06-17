import type { PersonalPatternCategory, PersonalPatternConfidence } from "@/lib/personal-patterns/types";

export type { PersonalPatternCategory, PersonalPatternConfidence };

// ─── Candidate status lifecycle ───────────────────────────────────────────────

export type PersonalPatternCandidateStatus = "candidate" | "promoted" | "rejected" | "archived";

// ─── Extraction event types ───────────────────────────────────────────────────

export type PersonalPatternExtractionEventType =
  | "PERSONAL_PATTERN_EXTRACTION_RUN_STARTED"
  | "PERSONAL_PATTERN_EXTRACTION_RUN_COMPLETED"
  | "PERSONAL_PATTERN_CANDIDATE_CREATED"
  | "PERSONAL_PATTERN_CANDIDATE_PROMOTED"
  | "PERSONAL_PATTERN_CANDIDATE_REJECTED"
  | "PERSONAL_PATTERN_CANDIDATE_ARCHIVED";

// ─── Minimum observation threshold ────────────────────────────────────────────

export const PERSONAL_EXTRACTION_MINIMUM_OCCURRENCES = 3;

// ─── Source types ─────────────────────────────────────────────────────────────

export type PersonalPatternCandidateSourceType =
  | "platform_event"
  | "decision"
  | "decision_effectiveness"
  | "personal_memory"
  | "personal_pattern"
  | "personal_effectiveness"
  | "organizational_pattern"
  | "organizational_memory"
  | "outcome"
  | "risk"
  | "task"
  | "milestone";

export type PersonalPatternCandidateRelationshipType =
  | "supports"
  | "contradicts"
  | "caused_by"
  | "derived_from"
  | "reviewed_during"
  | "supersedes"
  | "related_to";

// ─── DB record types ──────────────────────────────────────────────────────────

export type PersonalPatternCandidate = {
  id: string;
  workspace_id: string;
  pm_user_id: string;
  candidate_category: PersonalPatternCategory;
  candidate_title: string;
  candidate_summary: string;
  confidence: PersonalPatternConfidence;
  status: PersonalPatternCandidateStatus;
  observation_count: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type PersonalPatternCandidateSource = {
  id: string;
  candidate_id: string;
  source_type: PersonalPatternCandidateSourceType;
  source_id: string;
  relationship_type: PersonalPatternCandidateRelationshipType;
  created_at: string;
};

export type PersonalPatternExtractionRun = {
  id: string;
  workspace_id: string;
  pm_user_id: string;
  started_at: string;
  completed_at: string | null;
  candidate_count: number;
  rule_count: number;
  metadata: Record<string, unknown>;
};

// ─── Rule definition ──────────────────────────────────────────────────────────

export type PersonalPatternExtractionRule = {
  id: string;
  name: string;
  description: string;
  candidateCategory: PersonalPatternCategory;
  minimumOccurrences: number;
  confidenceWhenMet: PersonalPatternConfidence;
};

// ─── Extraction runtime types ─────────────────────────────────────────────────

export type PersonalPatternCandidateObservation = {
  ruleId: string;
  groupKey: string;
  occurrenceCount: number;
  sourceType: PersonalPatternCandidateSourceType;
  sourceIds: string[];
  candidateTitle: string;
  candidateSummary: string;
  candidateCategory: PersonalPatternCategory;
  confidence: PersonalPatternConfidence;
};

export type PersonalPatternExtractionResult = {
  runId: string;
  workspaceId: string;
  pmUserId: string;
  rulesEvaluated: number;
  candidatesCreated: number;
  candidatesSkipped: number;
  observations: PersonalPatternCandidateObservation[];
};

// ─── Explanation ──────────────────────────────────────────────────────────────

export type PersonalPatternCandidateExplanation = {
  candidate: PersonalPatternCandidate;
  rulesTriggered: PersonalPatternExtractionRule[];
  observations: PersonalPatternCandidateObservation[];
  sourceEvents: PersonalPatternCandidateSource[];
  sourceDecisions: PersonalPatternCandidateSource[];
  sourceOutcomes: PersonalPatternCandidateSource[];
  sourcePersonalMemory: PersonalPatternCandidateSource[];
  sourcePersonalPatterns: PersonalPatternCandidateSource[];
  sourcePersonalEffectiveness: PersonalPatternCandidateSource[];
};

// ─── Export ───────────────────────────────────────────────────────────────────

export type PersonalPatternCandidateExport = {
  candidate: PersonalPatternCandidate;
  rules: PersonalPatternExtractionRule[];
  observations: PersonalPatternCandidateObservation[];
  sources: PersonalPatternCandidateSource[];
  lineage: { promotedPatternId: string | null };
};

// ─── Health ───────────────────────────────────────────────────────────────────

export type PersonalPatternCandidateHealth = {
  runCount: number;
  candidateCount: number;
  promotedCount: number;
  rejectedCount: number;
  archivedCount: number;
  averageCandidatesPerRun: number;
};

// ─── Result ───────────────────────────────────────────────────────────────────

export type PersonalExtractionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      failureClass:
        | "validation_failed"
        | "not_found"
        | "persistence_failed"
        | "event_emission_failed"
        | "governance_violation";
    };
