// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Learning Engine — Type Definitions
// EPIC 2 Sprint 3: Institutional Learning Engine
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ConstitutionalLearningEvidenceRow,
  ConstitutionalLearningPatternRow,
  ConstitutionalLearningRecommendationRow,
  LearningPatternType,
} from "@/lib/db/database-contract";

export type {
  LearningPatternType,
  ConstitutionalLearningPatternRow,
  ConstitutionalLearningEvidenceRow,
  ConstitutionalLearningRecommendationRow,
};

// ─── Result ──────────────────────────────────────────────────────────────────

export type LearningResult<T> =
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

// ─── Audit event types ────────────────────────────────────────────────────────

export type ConstitutionalLearningEventType =
  | "CONSTITUTIONAL_LEARNING_PATTERN_CREATED"
  | "CONSTITUTIONAL_LEARNING_PATTERN_DISCOVERED"
  | "CONSTITUTIONAL_LEARNING_PATTERN_UPDATED"
  | "CONSTITUTIONAL_LEARNING_RECOMMENDATION_GENERATED"
  | "CONSTITUTIONAL_LEARNING_CONFIDENCE_CALCULATED"
  | "CONSTITUTIONAL_LEARNING_LINEAGE_GENERATED";

// ─── Correlation ──────────────────────────────────────────────────────────────

export type PatternCorrelation = {
  patternKey: string;
  patternType: LearningPatternType;
  correlatedWith: string;
  correlatedType: LearningPatternType;
  frequency: number;
  confidence: number;
};

// ─── Discovery result ─────────────────────────────────────────────────────────

export type DiscoveryResult = {
  patternsCreated: number;
  patternsUpdated: number;
  evidenceRecorded: number;
  patterns: ConstitutionalLearningPatternRow[];
};

// ─── Confidence breakdown ─────────────────────────────────────────────────────

export type LearningConfidenceBreakdown = {
  frequency: number;
  coverage: number;
  consistency: number;
  evidenceStrength: number;
  overall: number;
};

// ─── Learning Lineage ─────────────────────────────────────────────────────────

export type LearningLineage = {
  artifact: {
    id: string;
    workspace_id: string;
    artifact_type: string;
    title: string;
    storage_provider: string;
    storage_reference: string;
    checksum: string;
    created_at: string;
  };
  memoryRecord: {
    id: string;
    workspace_id: string;
    artifact_id: string;
    memory_type: string;
    title: string;
    canonical_text: string;
    summary: string | null;
    created_at: string;
    created_by: string;
  };
  digest: {
    id: string;
    workspace_id: string;
    memory_record_id: string;
    digest_status: string;
    digest_payload: Record<string, unknown>;
    confidence_score: number | null;
    created_at: string;
  };
  learningPattern: ConstitutionalLearningPatternRow;
};

// ─── Aggregation input ────────────────────────────────────────────────────────

export type AggregateDigestsInput = {
  workspaceId: string;
  actorId: string;
  digestIds?: string[];
};

// ─── Pattern inputs ───────────────────────────────────────────────────────────

export type CreateLearningPatternInput = {
  workspaceId: string;
  actorId: string;
  patternType: LearningPatternType;
  patternKey: string;
  description: string;
  initialConfidence?: number;
};

export type GetLearningPatternInput = {
  patternId: string;
  workspaceId: string;
};

export type ListLearningPatternsInput = {
  workspaceId: string;
  patternType?: LearningPatternType;
  minConfidence?: number;
  minOccurrences?: number;
};

export type GetLearningLineageInput = {
  patternId: string;
  workspaceId: string;
};

export type GenerateRecommendationsInput = {
  patternId: string;
  workspaceId: string;
  actorId: string;
};
