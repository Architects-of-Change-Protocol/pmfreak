/**
 * P2-20 — Closed-Loop Audit Export Compatibility Gate.
 *
 * ONE canonical, redacted, gap-aware audit export contract over the VERIFIED P2
 * operational-flow lineage. This module owns NO persisted state and NO aggregate of
 * its own: it is a composition/redaction layer over
 * `getCompleteLineageProjection()` and `reconstructAuditTrail()`
 * (src/lib/operational-flow/operational-flow-service.ts).
 *
 * Every type below is derived from existing repository types — `LineageStepNode`,
 * `LineageTransition`, `CompleteLineageProjection`, `AuditReconstructionItem` — rather
 * than inventing an unrelated schema. Where a field is narrowed (entities become an
 * allowlisted, redacted field map) the narrowing is explicit and reported in
 * `AuditExportPackage.redaction`.
 *
 * Non-goals, restated so they cannot drift:
 *  - This is NOT a second canonical lineage model. It never re-derives lineage.
 *  - It never upgrades `correlation_only` to `causation`.
 *  - It never treats Task completion as Outcome achievement.
 *  - It exports AOC governance REFERENCES/projections only; PMFreak does not own
 *    AOC policy, authority, grants, obligations, delegation or revocation proof.
 */

import type {
  CanonicalOutcomeObservationState,
  CanonicalTaskOutcomeState,
  CompleteLineageProjection,
  EvidenceAssertionType,
  LineageLinkStatus,
  LineageStepKind,
  LineageTransition,
  MissingDataState,
} from "@/lib/operational-flow/types";

/** Canonical export format identifier. Bump only with a forward-compatible contract change. */
export const CANONICAL_AUDIT_EXPORT_FORMAT = "pmfreak.canonical-audit-export.v1" as const;

/** Legacy decision-governance compatibility envelope identifier. */
export const LEGACY_DECISION_AUDIT_COMPATIBILITY_FORMAT =
  "pmfreak.legacy-decision-audit-compatibility.v1" as const;

/** Marker written wherever a value was withheld. Matches src/lib/security/redaction.ts. */
export const REDACTION_MARKER = "[redacted]" as const;

/**
 * How an exported audit record came to be associated with the requested lineage.
 * This is the SELECTION basis, deliberately distinct from the record's own stored
 * `relationship` (which classifies its causation/correlation pointers).
 */
export type AuditExportAssociationBasis =
  | "direct_reference"
  | "causation"
  | "correlation_only"
  | "reconstruction"
  | "unlinked";

export type AuditExportRequestedScope = {
  workspaceId: string;
  projectId: string;
  /** Narrower canonical entity the auditor asked for, or null for project scope. */
  outcomeId: string | null;
  taskId: string | null;
  correlationId: string | null;
  auditRecordLimit: number;
};

/**
 * A lineage step with its raw entity replaced by an allowlisted, redacted field map.
 * All P2-10 step semantics (status, gapReason, occurredAt vs recordedAt, actor, fixture,
 * confidence/missing-data) are carried through verbatim.
 */
export type AuditExportStep = {
  kind: LineageStepKind;
  id: string | null;
  title: string;
  status: LineageLinkStatus;
  summary: string;
  correlationId: string | null;
  causationId: string | null;
  isFixture: boolean;
  fixtureLabel: string | null;
  gapReason: string | null;
  occurredAt: string | null;
  recordedAt: string | null;
  actorId: string | null;
  evidenceAssertionType: EvidenceAssertionType | null;
  confidenceScore: number | null;
  missingDataState: MissingDataState | null;
  /** Allowlisted, redacted subset of the canonical row. `null` when the step is a gap. */
  entityFields: Record<string, unknown> | null;
  /** Column names present on the canonical row but withheld by the export allowlist. */
  withheldEntityFields: string[];
};

/**
 * AOC governance artifact REFERENCES as persisted by PMFreak on
 * material_action_governance_evaluations. No AOC-owned policy state, grant, authority,
 * obligation, delegation or revocation proof is copied or manufactured here.
 */
export type AuditExportGovernanceReference = {
  evaluationId: string | null;
  actionId: string | null;
  contractVersion: string | null;
  evaluatorKind: string | null;
  governanceState: string | null;
  /** Integrity classification applied by the verified P2-10 governance-state mapping. */
  governanceIntegrity: LineageLinkStatus;
  policyDecisionReference: string | null;
  grantReferences: string[];
  obligationReferences: string[];
  approvalReferences: string[];
  reasonCodes: string[];
  evaluatedAt: string | null;
  recordedAt: string | null;
  validUntil: string | null;
  canCommitAction: boolean | null;
  canExecute: boolean | null;
  /** Always false: PMFreak stores a projection, it does not own the governance evidence. */
  pmfreakOwnsGovernanceEvidence: false;
  authorityOwner: "AOC-E";
};

/** Stable canonical identifiers for the represented chain. Never synthesised. */
export type AuditExportCanonicalReferences = {
  sourceId: string | null;
  rawInputId: string | null;
  normalizedEventId: string | null;
  evidenceId: string | null;
  findingId: string | null;
  recommendationId: string | null;
  decisionId: string | null;
  materialActionId: string | null;
  taskId: string | null;
  internalExecutionId: string | null;
  outcomeId: string | null;
  observationIds: string[];
  governanceEvaluationIds: string[];
};

/**
 * Outcome semantics, held apart from Task state on purpose.
 * `isAchieved` is derived from the canonical outcome state ALONE — never from task status,
 * execution status, or the presence of a completed task.
 */
export type AuditExportOutcomeAssessment = {
  outcomeState: CanonicalTaskOutcomeState;
  latestObservationState: CanonicalOutcomeObservationState | null;
  observationsCount: number;
  isAchieved: boolean;
  achievementBasis:
    | "canonical_outcome_state_achieved"
    | "canonical_outcome_state_not_achieved"
    | "unobserved_no_canonical_observation";
  taskStatus: string | null;
  taskCompletionImpliesOutcomeAchievement: false;
  note: string;
};

export type AuditExportAuditRecord = {
  id: string;
  eventType: string;
  eventCategory: string;
  actorId: string | null;
  actorType: string;
  occurredAt: string;
  recordedAt: string;
  correlationId: string | null;
  causationId: string | null;
  rawReferenceTable: string | null;
  rawReferenceId: string | null;
  /** Redacted event payload. Audit-relevant keys survive; secret-shaped values do not. */
  payload: Record<string, unknown>;
  /** Redacted metadata, including P2-10 reconstruction labelling where applicable. */
  metadata: Record<string, unknown>;
  /** Stored causation/correlation classification, carried through verbatim. */
  relationship: "causation" | "correlation_only" | "unlinked";
  /** How this record was SELECTED for the requested scope — not its stored relationship. */
  associationBasis: AuditExportAssociationBasis;
  associationExplanation: string;
  /** True only for records the verified P2-10 semantics rebuild from a canonical row. */
  isReconstructed: boolean;
  reconstructedFrom: string | null;
};

/** Platform event retained by the verified P2-10 projection for one lineage. */
export type AuditExportLineageEvent = {
  id: string | null;
  eventType: string | null;
  eventCategory: string | null;
  occurredAt: string | null;
  recordedAt: string | null;
  correlationId: string | null;
  causationId: string | null;
  rawReferenceTable: string | null;
  rawReferenceId: string | null;
  actorId: string | null;
  actorType: string | null;
  /** How THIS event was selected for THIS lineage by the verified projection filter. */
  associationBasis: AuditExportAssociationBasis;
  associationExplanation: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type AuditExportLineage = {
  outcomeId: string;
  taskId: string;
  expectedResult: string;
  lineageStatus: CompleteLineageProjection["lineageStatus"];
  hasCorrelationOnly: boolean;
  isFixture: boolean;
  fixtureLabel: string | null;
  canonicalReferences: AuditExportCanonicalReferences;
  outcomeAssessment: AuditExportOutcomeAssessment;
  steps: AuditExportStep[];
  /** Carried through verbatim from the verified projection. Never re-classified. */
  transitions: LineageTransition[];
  governanceReferences: AuditExportGovernanceReference[];
  lineageEvents: AuditExportLineageEvent[];
  gaps: string[];
  disputes: string[];
};

export type AuditExportIntegrity = {
  /** Worst status across every exported lineage. `complete` only when all are complete. */
  overallStatus: CompleteLineageProjection["lineageStatus"];
  lineageCount: number;
  completeLineageCount: number;
  gapCount: number;
  disputeCount: number;
  hasCorrelationOnly: boolean;
  containsFixture: boolean;
  /**
   * False whenever any lineage carries a gap/dispute or a non-complete status. An export
   * with missing provenance stays exportable, but never reports itself intact.
   */
  isComplete: boolean;
  /**
   * Honest bound on platform-event association. The verified P2-10 projection associates
   * outcome-scoped events by correlation id and by raw-reference match only; no emitter
   * proves exhaustiveness, so completeness of the event side is not asserted.
   */
  eventAssociationComplete: false;
  notes: string[];
};

export type AuditExportRedactionReport = {
  policyVersion: "pmfreak.audit-export-redaction.v1";
  strategy: "entity_field_allowlist_plus_bounded_recursive_value_redaction";
  marker: typeof REDACTION_MARKER;
  /** Categories never emitted, whatever the stored key name. */
  redactedCategories: string[];
  /** Column names withheld by the allowlist, aggregated across the package. */
  withheldEntityFields: string[];
  /** Payload/metadata keys whose values were replaced by the marker. */
  redactedPayloadKeys: string[];
  preservedAuditFields: string[];
};

export type AuditExportAocBoundary = {
  identityIntegrityCapabilityOwner: "AOC-P";
  policyAuthorityObligationOwner: "AOC-E";
  pmBusinessObjectOwner: "PMFreak";
  /** Invariant. P2-20 never enables remote AOC decision writeback. */
  allowDecisionWriteback: false;
  exportedArtifacts: "references_and_status_projections_only";
  note: string;
};

export type AuditExportCompatibility = {
  canonicalSource: string;
  /** Legacy models deliberately NOT fused into this export. */
  legacyModelsNotMerged: string[];
  legacyCompatibilityEntryPoint: string;
  notes: string[];
};

export type AuditExportPackage = {
  exportFormat: typeof CANONICAL_AUDIT_EXPORT_FORMAT;
  exportVersion: 1;
  generatedAt: string;
  requestedScope: AuditExportRequestedScope;
  lineages: AuditExportLineage[];
  auditRecords: AuditExportAuditRecord[];
  integrity: AuditExportIntegrity;
  redaction: AuditExportRedactionReport;
  aocBoundary: AuditExportAocBoundary;
  compatibility: AuditExportCompatibility;
};

/**
 * Bounded legacy envelope. It carries the legacy decision-centric package through
 * unchanged (IDs preserved, redacted) and states plainly that it is NOT canonical PM
 * lineage. No canonical lineage is invented for a legacy record.
 */
export type LegacyDecisionAuditCompatibilityPackage = {
  exportFormat: typeof LEGACY_DECISION_AUDIT_COMPATIBILITY_FORMAT;
  exportVersion: 1;
  generatedAt: string;
  legacyModel: "project_decisions";
  legacyDecisionId: string;
  /** Always false: project_decisions has no relationship to the canonical P2 chain. */
  canonicalLineageSupported: false;
  canonicalExportFormat: typeof CANONICAL_AUDIT_EXPORT_FORMAT;
  compatibilityGaps: string[];
  /** The legacy package, IDs preserved, redacted. Never reinterpreted as canonical. */
  legacyPackage: Record<string, unknown>;
  redaction: AuditExportRedactionReport;
  notes: string[];
};
