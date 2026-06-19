// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Digest Engine — Type Definitions
// EPIC 2 Sprint 2: Sovereign Project Vault
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ConstitutionalDigestClassificationRow,
  ConstitutionalDigestRow,
  DigestClassificationType,
  DigestPayload,
  DigestStatus,
} from "@/lib/db/database-contract";

export type {
  DigestStatus,
  DigestPayload,
  DigestClassificationType,
  ConstitutionalDigestRow,
  ConstitutionalDigestClassificationRow,
};

// ─── Result ──────────────────────────────────────────────────────────────────

export type DigestResult<T> =
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

// ─── Digest Categories ────────────────────────────────────────────────────────

export type DigestCategory =
  | "project_type"
  | "industry"
  | "decision_type"
  | "risk_category"
  | "issue_category"
  | "amendment_category"
  | "governance_category"
  | "delivery_pattern"
  | "outcome_pattern";

// ─── Pattern Types ────────────────────────────────────────────────────────────

export type DecisionPattern =
  | "schedule_change"
  | "scope_reduction"
  | "vendor_replacement"
  | "resource_reallocation"
  | "budget_adjustment"
  | "priority_change"
  | "approval_required"
  | "other";

export type RiskPattern =
  | "third_party_dependency"
  | "approval_delay"
  | "resource_shortage"
  | "technical_complexity"
  | "regulatory_compliance"
  | "budget_overrun"
  | "scope_creep"
  | "other";

export type GovernancePattern =
  | "authority_gap"
  | "late_escalation"
  | "decision_reversal"
  | "approval_bottleneck"
  | "delegation_conflict"
  | "quorum_failure"
  | "other";

export type OutcomePattern =
  | "successful_delivery"
  | "delivery_delay"
  | "cost_overrun"
  | "scope_reduction"
  | "cancelled"
  | "partial_delivery"
  | "other";

// ─── Audit event types ────────────────────────────────────────────────────────

export type ConstitutionalDigestEventType =
  | "CONSTITUTIONAL_DIGEST_CREATED"
  | "CONSTITUTIONAL_DIGEST_GENERATED"
  | "CONSTITUTIONAL_DIGEST_VALIDATED"
  | "CONSTITUTIONAL_DIGEST_PUBLISHED"
  | "CONSTITUTIONAL_DIGEST_ARCHIVED"
  | "CONSTITUTIONAL_DIGEST_ANONYMIZED"
  | "CONSTITUTIONAL_DIGEST_CLASSIFIED"
  | "CONSTITUTIONAL_DIGEST_PATTERN_EXTRACTED"
  | "CONSTITUTIONAL_DIGEST_CONFIDENCE_CALCULATED";

// ─── Input types ──────────────────────────────────────────────────────────────

export type CreateDigestInput = {
  workspaceId: string;
  memoryRecordId: string;
  createdBy: string;
};

export type GenerateDigestInput = {
  digestId: string;
  workspaceId: string;
  actorId: string;
};

export type ValidateDigestInput = {
  digestId: string;
  workspaceId: string;
  actorId: string;
};

export type PublishDigestInput = {
  digestId: string;
  workspaceId: string;
  actorId: string;
};

export type ArchiveDigestInput = {
  digestId: string;
  workspaceId: string;
  actorId: string;
};

export type ListDigestsInput = {
  workspaceId: string;
  industry?: string;
  projectType?: string;
  riskCategory?: string;
  decisionType?: string;
  status?: DigestStatus;
};

// ─── Lineage types ────────────────────────────────────────────────────────────

export type DigestLineage = {
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
  digest: ConstitutionalDigestRow;
};

// ─── Anonymization result ─────────────────────────────────────────────────────

export type AnonymizationResult = {
  anonymizedText: string;
  removedEntities: string[];
  normalizations: Array<{ original: string; normalized: string }>;
};

// ─── Extraction result ────────────────────────────────────────────────────────

export type PatternExtractionResult = {
  decisionPatterns: DecisionPattern[];
  riskPatterns: RiskPattern[];
  governancePatterns: GovernancePattern[];
  outcomePatterns: OutcomePattern[];
  industry: string | null;
  projectType: string | null;
};

// ─── Confidence breakdown ─────────────────────────────────────────────────────

export type ConfidenceBreakdown = {
  completeness: number;
  classificationCoverage: number;
  patternCoverage: number;
  traceability: number;
  overall: number;
};
