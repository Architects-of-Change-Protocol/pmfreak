/**
 * Sprint 26R — Decision Support Shadow Capture Storage Policy / Default-Off Persistence Plan: types.
 *
 * Pure type definitions for an offline, deterministic **policy** — not a storage implementation —
 * that classifies every field a Sprint 25R `DecisionSupportShadowCaptureRecord` could ever carry into
 * a future persistent store: what is allowed, what is prohibited forever, what requires an explicit
 * exception, and what stays in-memory/test-only. It also models a strict retention policy, a strict
 * deletion policy, and a default-off persistence plan naming (never implementing) a future feature
 * flag.
 *
 * This module is not imported by the router, composer, any production handler, or the gateway. It
 * has no production wiring, no database client, no Supabase client, and no feature-flag read — see
 * `docs/conversational-brain-decision-support-shadow-storage-policy.md` for the full scope and
 * non-goals. This is policy/planning/evaluation, not storage/DB/migration/Supabase/feature-flag
 * implementation.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStoragePolicyProfile = "strict_default_off";

export type DecisionSupportShadowStoragePolicyMode =
  | "policy_only"
  | "dry_run_readiness_evaluation"
  | "test_memory_readiness_evaluation";

// ─── Field classification ─────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFieldCategory =
  | "identity"
  | "input"
  | "candidate_summary"
  | "safety"
  | "audit"
  | "routing"
  | "retention"
  | "prohibited_sensitive"
  | "operational_metadata";

export type DecisionSupportShadowStorageFieldDecision =
  | "allowed"
  | "prohibited"
  | "allowed_with_hashing"
  | "allowed_with_redaction"
  | "allowed_with_minimization"
  | "allowed_only_test_memory"
  | "allowed_only_future_default_off"
  | "requires_explicit_policy_exception";

export type DecisionSupportShadowStorageFieldRisk = "low" | "medium" | "high" | "critical";

export type DecisionSupportShadowStorageFieldPolicy = {
  fieldName: string;
  category: DecisionSupportShadowStorageFieldCategory;
  decision: DecisionSupportShadowStorageFieldDecision;
  risk: DecisionSupportShadowStorageFieldRisk;
  reason: string;
  requiredTransformations: string[];
  allowedInFuturePersistentStorage: boolean;
  allowedInTestMemoryOnly: boolean;
  prohibitedAlways: boolean;
};

// ─── Retention / deletion policy ──────────────────────────────────────────────────────

export type DecisionSupportShadowStorageRetentionMode = "ephemeral_only" | "short_lived_default_off";

export type DecisionSupportShadowStorageDeletionTrigger = "ttl_expiry" | "manual_purge" | "workspace_purge" | "policy_violation";

export type DecisionSupportShadowStorageRetentionPolicy = {
  retentionMode: DecisionSupportShadowStorageRetentionMode;
  defaultRetentionDays: number;
  maximumRetentionDays: number;
  deletionRequired: true;
  deletionTrigger: DecisionSupportShadowStorageDeletionTrigger;
  requiresDeletionAudit: true;
  notes: string[];
};

export type DecisionSupportShadowStorageDeletionPolicy = {
  hardDeleteRequired: true;
  softDeleteAllowed: false;
  deletionAuditMetadataOnly: true;
  deleteByCaptureIdRequired: true;
  deleteByWorkspaceRequired: true;
  deleteByPolicyVersionRequired: true;
  deleteRawPayloadIfEverIntroduced: true;
  notes: string[];
};

// ─── Readiness gates ───────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageReadinessGate =
  | "storage_default_off"
  | "no_db_migration"
  | "no_storage_adapter"
  | "no_supabase_write"
  | "no_raw_input"
  | "no_full_candidate"
  | "no_user_visible_output"
  | "input_hash_only"
  | "input_preview_policy"
  | "candidate_summary_only"
  | "retention_policy_defined"
  | "deletion_policy_defined"
  | "tenant_isolation_required"
  | "access_control_required"
  | "feature_flag_required"
  | "audit_metadata_required"
  | "policy_version_required"
  | "capture_harness_clean"
  | "shadow_mode_clean"
  | "adapter_unchanged"
  | "router_unchanged";

export type DecisionSupportShadowStorageReadinessGateSeverity = "info" | "warning" | "blocking";

export type DecisionSupportShadowStorageReadinessGateResult = {
  gate: DecisionSupportShadowStorageReadinessGate;
  passed: boolean;
  severity: DecisionSupportShadowStorageReadinessGateSeverity;
  reason: string;
  requiredBeforeStorageImplementation: boolean;
};

// ─── Default-off persistence plan ─────────────────────────────────────────────────────

export type DecisionSupportShadowStorageDefaultOffPersistencePlan = {
  kind: "decision_support_shadow_storage_policy_plan";
  profile: DecisionSupportShadowStoragePolicyProfile;
  mode: DecisionSupportShadowStoragePolicyMode;
  persistenceDefaultEnabled: false;
  requiresFeatureFlag: true;
  requiredFeatureFlagName: "ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE";
  featureFlagDefault: false;
  storageAdapterImplemented: false;
  dbMigrationImplemented: false;
  supabaseWriteImplemented: false;
  productionRouteChanged: false;
  allowedFields: DecisionSupportShadowStorageFieldPolicy[];
  prohibitedFields: DecisionSupportShadowStorageFieldPolicy[];
  exceptionRequiredFields: DecisionSupportShadowStorageFieldPolicy[];
  retentionPolicy: DecisionSupportShadowStorageRetentionPolicy;
  deletionPolicy: DecisionSupportShadowStorageDeletionPolicy;
  readinessGates: DecisionSupportShadowStorageReadinessGateResult[];
  warnings: string[];
  limitations: string[];
};

// ─── Assessable capture-record-like shape ─────────────────────────────────────────────

/**
 * A loosely-typed (plain `boolean`, not literal `false`) stand-in for a Sprint 25R
 * `DecisionSupportShadowCaptureRecord` — used so `assessDecisionSupportShadowCaptureRecordForStorage()`
 * can be exercised directly against synthetic, policy-violating records (e.g. `rawInputRetained:
 * true`, or an ad hoc `rawInput` string field) without those cases needing to satisfy the harness's
 * own strict literal-`false` record type. A real capture record (or `DecisionSupportShadowCaptureResult`)
 * is always a valid value of this type; the reverse is not guaranteed, by design.
 */
export type DecisionSupportShadowStorageCaptureRecordLike = {
  captureId?: string;
  sourceRunId?: string;
  captureStatus?: string;
  sourceCandidateKind?: string;
  mode?: string;
  sinkKind?: string;
  generatedAt?: string;
  inputHash?: string;
  inputPreview?: string;
  rawInputRetained?: boolean;
  fullDecisionCandidateRetained?: boolean;
  fullClarificationCandidateRetained?: boolean;
  userVisibleOutputRetained?: boolean;
  architectureCategory?: string;
  desiredFutureRoute?: string;
  targetKind?: string;
  sourceStatus?: string;
  candidateSummary?: Record<string, unknown>;
  safetySnapshot?: Record<string, unknown>;
  gateResults?: unknown[];
  allBlockingGatesPassed?: boolean;
  warnings?: string[];
  auditMetadata?: Record<string, unknown>;
  dbWriteAttempted?: boolean;
  supabaseWriteAttempted?: boolean;
  shouldExecuteAction?: boolean;
  shouldSendEmail?: boolean;
  shouldCreateTask?: boolean;
  shouldWriteToDb?: boolean;
  shouldReturnCandidateToUser?: boolean;
  shouldPersistShadowResult?: boolean;
  /** Escape hatch so synthetic test records can carry an arbitrary prohibited field name
   * (e.g. `rawInput`, `fullDecisionCandidate`, `emailAddress`) for classification testing. */
  [extraField: string]: unknown;
};

// ─── Field / record assessment ────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageObservedValueKind = "absent" | "boolean" | "number" | "string" | "array" | "object" | "summary_only";

export type DecisionSupportShadowStorageFieldAssessment = {
  fieldName: string;
  observedInCaptureRecord: boolean;
  observedValueKind: DecisionSupportShadowStorageObservedValueKind;
  policyDecision: DecisionSupportShadowStorageFieldDecision;
  risk: DecisionSupportShadowStorageFieldRisk;
  violation: boolean;
  violationReason?: string;
  recommendedAction: string;
};

export type DecisionSupportShadowStorageRecordAssessment = {
  captureId?: string;
  sourceRunId?: string;
  captureStatus: string;
  sourceCandidateKind: string;
  mode: string;
  fieldAssessments: DecisionSupportShadowStorageFieldAssessment[];
  prohibitedFieldObservedCount: number;
  rawInputViolation: boolean;
  fullCandidateViolation: boolean;
  userVisibleOutputViolation: boolean;
  dbWriteViolation: boolean;
  supabaseWriteViolation: boolean;
  sideEffectViolation: boolean;
  retentionPolicySatisfied: boolean;
  deletionPolicySatisfied: boolean;
  storageReady: boolean;
  warnings: string[];
};

// ─── Evaluation summary ────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageReadinessStatus =
  | "not_ready_for_real_storage"
  | "ready_for_storage_adapter_design"
  | "ready_for_default_off_storage_prototype"
  | "blocked_by_policy_violation";

export type DecisionSupportShadowStorageNextSprintRecommendation = "Sprint 27R — Shadow Capture Storage Adapter Plan";

export type DecisionSupportShadowStoragePolicyEvaluationOptions = {
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  plan?: DecisionSupportShadowStorageDefaultOffPersistencePlan;
  /** When true, additionally evaluates a `test_only_in_memory` capture pass alongside the default
   * `dry_run` pass. This module never reads the system clock or an environment variable to decide
   * this — the caller sets it explicitly. */
  includeTestMemoryPass?: boolean;
};

export type DecisionSupportShadowStoragePolicyEvaluationSummary = {
  totalCaptureRecords: number;
  assessedRecords: number;
  allowedFieldCount: number;
  prohibitedFieldCount: number;
  exceptionRequiredFieldCount: number;
  prohibitedFieldObservedCount: number;
  rawInputViolationCount: number;
  fullCandidateViolationCount: number;
  userVisibleOutputViolationCount: number;
  dbWriteViolationCount: number;
  supabaseWriteViolationCount: number;
  sideEffectViolationCount: number;
  retentionPolicyDefinedCount: number;
  deletionPolicyDefinedCount: number;
  captureHarnessCleanCount: number;
  captureHarnessCleanRate: number;
  readinessGatePassCount: number;
  readinessGatePassRate: number;
  blockingReadinessGateFailureCount: number;
  storageReadinessStatus: DecisionSupportShadowStorageReadinessStatus;
  recommendedNextSprint: DecisionSupportShadowStorageNextSprintRecommendation;
  recommendation: string;
  representativeAllowedFields: string[];
  representativeProhibitedFields: string[];
  representativePolicyExceptions: string[];
  weakRecordAssessments: DecisionSupportShadowStorageRecordAssessment[];
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStoragePolicyExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  policyProfile: string;
  fieldClassification: string[];
  prohibitedFields: string[];
  allowedFields: string[];
  exceptionFields: string[];
  retentionPolicy: string;
  deletionPolicy: string;
  defaultOffFeatureFlagPlan: string;
  readinessGates: string[];
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  expectedSprint27Path: string;
};
