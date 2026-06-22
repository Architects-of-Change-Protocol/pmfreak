// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Type Definitions
// EPIC 2 Sprint 4: Sovereign Recommendation Engine
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ConstitutionalRecommendationRow,
  ConstitutionalRecommendationEvidenceRow,
  ConstitutionalRecommendationApplicationRow,
  RecommendationType,
  RecommendationScope,
  RecommendationStatus,
  RecommendationApplicationEntityType,
  RecommendationApplicationStatus,
} from "@/lib/db/database-contract";

export type {
  ConstitutionalRecommendationRow,
  ConstitutionalRecommendationEvidenceRow,
  ConstitutionalRecommendationApplicationRow,
  RecommendationType,
  RecommendationScope,
  RecommendationStatus,
  RecommendationApplicationEntityType,
  RecommendationApplicationStatus,
};

// ─── Result ──────────────────────────────────────────────────────────────────

export type RecommendationResult<T> =
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

export type ConstitutionalRecommendationEventType =
  | "CONSTITUTIONAL_RECOMMENDATION_CREATED"
  | "CONSTITUTIONAL_RECOMMENDATION_GENERATED"
  | "CONSTITUTIONAL_RECOMMENDATION_VALIDATED"
  | "CONSTITUTIONAL_RECOMMENDATION_PUBLISHED"
  | "CONSTITUTIONAL_RECOMMENDATION_RETIRED"
  | "CONSTITUTIONAL_RECOMMENDATION_APPLIED"
  | "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_CALCULATED"
  | "CONSTITUTIONAL_RECOMMENDATION_LINEAGE_GENERATED"
  | "CONSTITUTIONAL_RECOMMENDATION_JUSTIFIED";

// ─── Confidence breakdown ─────────────────────────────────────────────────────

export type RecommendationConfidenceBreakdown = {
  patternConfidence: number;
  occurrenceWeight: number;
  consistencyWeight: number;
  evidenceWeight: number;
  overall: number;
};

// ─── Applicability ────────────────────────────────────────────────────────────

export type ApplicabilityLevel = "high" | "medium" | "low";

export type RecommendationApplicability = {
  level: ApplicabilityLevel;
  score: number;
  rationale: string[];
};

// ─── Justification ────────────────────────────────────────────────────────────

export type RecommendationJustification = {
  recommendation: string;
  because: string;
  evidence: string;
  confidence: number;
  patternKey: string;
  patternType: string;
};

// ─── Lineage ─────────────────────────────────────────────────────────────────

export type RecommendationLineage = {
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
  learningPattern: {
    id: string;
    workspace_id: string;
    pattern_type: string;
    pattern_key: string;
    description: string;
    confidence_score: number;
    occurrence_count: number;
    created_at: string;
    updated_at: string;
  };
  recommendation: ConstitutionalRecommendationRow;
};

// ─── Generation input ─────────────────────────────────────────────────────────

export type GenerateRecommendationsFromPatternsInput = {
  workspaceId: string;
  actorId: string;
  patternIds?: string[];
  minPatternConfidence?: number;
};

// ─── Create input ─────────────────────────────────────────────────────────────

export type CreateRecommendationInput = {
  workspaceId: string;
  actorId: string;
  recommendationKey: string;
  recommendationType: RecommendationType;
  recommendationScope: RecommendationScope;
  title: string;
  description: string;
  recommendationText: string;
  initialConfidence?: number;
};

// ─── Lifecycle inputs ─────────────────────────────────────────────────────────

export type RecommendationIdInput = {
  recommendationId: string;
  workspaceId: string;
  actorId: string;
};

export type ApplyRecommendationInput = {
  recommendationId: string;
  workspaceId: string;
  actorId: string;
  entityType: RecommendationApplicationEntityType;
  entityId: string;
};

// ─── List input ───────────────────────────────────────────────────────────────

export type ListRecommendationsInput = {
  workspaceId: string;
  type?: RecommendationType;
  scope?: RecommendationScope;
  status?: RecommendationStatus;
  minConfidence?: number;
};

// ─── Applicability context ────────────────────────────────────────────────────

export type ApplicabilityContext = {
  presentRiskKeys?: string[];
  observedPatternKeys?: string[];
  projectType?: string;
  constitutionStatus?: string;
};
