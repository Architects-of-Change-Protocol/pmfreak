/**
 * Sprint 27R — Decision Support Shadow Capture Storage Adapter Plan: types.
 *
 * Pure type definitions for an offline, deterministic **adapter plan/contract** — not a storage
 * implementation — that designs what a future Shadow Capture Storage Adapter would look like: its
 * interface/method contract, a proposed (never-created) schema, a proposed (never-created) migration,
 * a safe storage-draft mapper built on top of the Sprint 26R storage policy, a storage-draft validator,
 * and a no-op contract simulation. Nothing here creates a database, a migration file, a table, a real
 * storage adapter, or a real repository.
 *
 * This module is not imported by the router, composer, any production handler, or the gateway. It has
 * no production wiring, no database client, no Supabase client, and no feature-flag read — see
 * `docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md` for the full scope and
 * non-goals. This is adapter/schema/migration *planning*, not implementation.
 */

// ─── Profile / mode / kind ─────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageAdapterPlanProfile = "strict_default_off_adapter_plan";

export type DecisionSupportShadowStorageAdapterPlanMode =
  | "contract_only"
  | "schema_proposal_only"
  | "dry_run_mapping_evaluation"
  | "test_noop_adapter_simulation";

export type DecisionSupportShadowStorageAdapterKind = "none" | "contract_only" | "noop_simulation" | "future_default_off_adapter";

// ─── Method contract ────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageAdapterMethodName =
  | "validatePolicy"
  | "mapCaptureRecordToStorageDraft"
  | "validateStorageDraft"
  | "writeCaptureDraft"
  | "deleteByCaptureId"
  | "deleteByWorkspace"
  | "purgeExpired"
  | "listByPolicyVersion";

export type DecisionSupportShadowStorageAdapterMethodPolicy = {
  methodName: DecisionSupportShadowStorageAdapterMethodName;
  allowedInSprint27: boolean;
  futureOnly: boolean;
  mustBeDefaultOff: boolean;
  mustNotWriteRealStorage: boolean;
  requiresPolicyValidation: boolean;
  requiresTenantIsolation: boolean;
  requiresAccessControl: boolean;
  requiresDeletionPath: boolean;
  reason: string;
};

// ─── Schema proposal ────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageColumnType = "text" | "boolean" | "integer" | "json_minimized" | "timestamp" | "enum" | "hash";

export type DecisionSupportShadowStorageColumnDecision =
  | "proposed_allowed"
  | "proposed_allowed_with_hashing"
  | "proposed_allowed_with_minimization"
  | "proposed_excluded"
  | "proposed_exception_only"
  | "proposed_future_only";

export type DecisionSupportShadowStorageSchemaColumnRisk = "low" | "medium" | "high" | "critical";

export type DecisionSupportShadowStorageSchemaColumn = {
  columnName: string;
  sourceField?: string;
  columnType: DecisionSupportShadowStorageColumnType;
  decision: DecisionSupportShadowStorageColumnDecision;
  nullable: boolean;
  indexed: boolean;
  unique: boolean;
  policyDecision: string;
  risk: DecisionSupportShadowStorageSchemaColumnRisk;
  reason: string;
};

export type DecisionSupportShadowStorageSchemaProposalStatus = "proposal_only";

export type DecisionSupportShadowStorageSchemaProposal = {
  tableName: "decision_support_shadow_captures";
  status: DecisionSupportShadowStorageSchemaProposalStatus;
  migrationCreated: false;
  tableCreated: false;
  columns: DecisionSupportShadowStorageSchemaColumn[];
  prohibitedColumns: string[];
  requiredIndexes: string[];
  requiredConstraints: string[];
  notes: string[];
};

// ─── Migration proposal ─────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageMigrationProposal = {
  status: "proposal_only";
  migrationFileCreated: false;
  migrationShouldNotBeCreatedInSprint27: true;
  proposedMigrationName: string;
  proposedTableName: "decision_support_shadow_captures";
  requiredPreconditions: string[];
  prohibitedMigrationContents: string[];
  rollbackRequirements: string[];
  deletionRequirements: string[];
  notes: string[];
};

// ─── Storage draft ──────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageDraftFields = {
  captureId?: string;
  sourceRunIdHash?: string;
  generatedAt?: string;
  mode?: string;
  sinkKind?: string;
  inputHash?: string;
  architectureCategory?: string;
  desiredFutureRoute?: string;
  targetKind?: string;
  sourceStatus?: string;
  sourceCandidateKind?: string;
  captureStatus?: string;
  candidateSummary?: Record<string, unknown>;
  safetySnapshot?: Record<string, unknown>;
  gateSummary?: Record<string, unknown>;
  auditSummary?: Record<string, unknown>;
  allBlockingGatesPassed?: boolean;
  retentionMode?: string;
  retentionExpiresAt: null;
  deletionRequired?: boolean;
};

export type DecisionSupportShadowStoragePolicyAssessmentSummary = {
  rawInputExcluded: true;
  inputPreviewExcluded: true;
  fullCandidatesExcluded: true;
  userVisibleOutputExcluded: true;
  projectNameExcluded: true;
  emailAddressExcluded: true;
  phoneNumberExcluded: true;
};

export type DecisionSupportShadowStorageDraft = {
  kind: "decision_support_shadow_storage_draft";
  draftId: string;
  sourceCaptureId: string;
  policyVersion: string;
  storageAdapterPlanProfile: DecisionSupportShadowStorageAdapterPlanProfile;
  storageEnabled: false;
  realPersistenceAllowed: false;
  proposedTableName: "decision_support_shadow_captures";
  fields: DecisionSupportShadowStorageDraftFields;
  excludedFields: string[];
  policyAssessmentSummary: DecisionSupportShadowStoragePolicyAssessmentSummary;
  warnings: string[];
};

// ─── Storage draft validation ───────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageDraftValidationGate =
  | "storage_disabled"
  | "policy_profile_attached"
  | "policy_version_attached"
  | "no_raw_input"
  | "no_input_preview"
  | "no_full_candidate"
  | "no_user_visible_output"
  | "no_project_name"
  | "no_email_address"
  | "no_phone_number"
  | "candidate_summary_minimized"
  | "safety_snapshot_only"
  | "audit_summary_only"
  | "retention_policy_attached"
  | "deletion_policy_attached"
  | "schema_proposal_only"
  | "migration_not_created"
  | "table_not_created"
  | "adapter_not_real"
  | "no_db_write"
  | "no_supabase_write"
  | "router_unchanged"
  | "adapter_mapping_unchanged";

export type DecisionSupportShadowStorageDraftValidationSeverity = "info" | "warning" | "blocking";

export type DecisionSupportShadowStorageDraftValidationResult = {
  gate: DecisionSupportShadowStorageDraftValidationGate;
  passed: boolean;
  severity: DecisionSupportShadowStorageDraftValidationSeverity;
  reason: string;
};

export type DecisionSupportShadowStorageDraftValidationOptions = {
  /** Test-only escape hatch letting a synthetic draft carry a forbidden shape (e.g. an
   * ad hoc `rawInput` key) so `no_raw_input`/etc. gates can be exercised directly — this module's
   * own default drafts (from `mapDecisionSupportCaptureRecordToStorageDraft`) never need it. */
  routerTouched?: boolean;
  adapterMappingTouched?: boolean;
};

// ─── No-op adapter simulation ───────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageAdapterSimulationResult = {
  kind: "decision_support_shadow_storage_adapter_simulation_result";
  inputCaptureId?: string;
  draftCreated: boolean;
  draftValid: boolean;
  writeAttempted: false;
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  noopWriteAccepted: boolean;
  validationResults: DecisionSupportShadowStorageDraftValidationResult[];
  blockingFailureCount: number;
  warnings: string[];
};

// ─── Evaluation ─────────────────────────────────────────────────────────────────────────

/** One capture record's full pass through the plan: its mapped draft, the draft's validation
 * results, and the no-op simulation result — the unit `runDecisionSupportShadowStorageAdapterPlanEvaluation()`
 * produces per record, and `summarizeDecisionSupportShadowStorageAdapterPlanEvaluation()` aggregates. */
export type DecisionSupportShadowStorageAdapterPlanEvaluationResult = {
  captureId: string;
  draft: DecisionSupportShadowStorageDraft;
  validationResults: DecisionSupportShadowStorageDraftValidationResult[];
  simulation: DecisionSupportShadowStorageAdapterSimulationResult;
};

export type DecisionSupportShadowStorageAdapterPlanReadinessStatus =
  | "ready_for_noop_adapter_implementation"
  | "ready_for_fake_adapter_implementation"
  | "not_ready_for_adapter_implementation"
  | "blocked_by_policy_violation";

export type DecisionSupportShadowStorageAdapterPlanNextSprintRecommendation = "Sprint 28R — Shadow Capture Storage Adapter Fake Implementation";

export type DecisionSupportShadowStorageAdapterPlanEvaluationOptions = {
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  includeTestMemoryPass?: boolean;
};

export type DecisionSupportShadowStorageAdapterPlanEvaluationSummary = {
  totalCaptureRecords: number;
  totalDraftsCreated: number;
  validDraftCount: number;
  validDraftRate: number;
  invalidDraftCount: number;
  writeAttemptedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  rawInputIncludedCount: number;
  inputPreviewIncludedCount: number;
  fullCandidateIncludedCount: number;
  userVisibleOutputIncludedCount: number;
  projectNameIncludedCount: number;
  emailAddressIncludedCount: number;
  phoneNumberIncludedCount: number;
  schemaProposalColumnCount: number;
  prohibitedColumnCount: number;
  migrationCreated: false;
  tableCreated: false;
  storageAdapterRealImplemented: false;
  readinessStatus: DecisionSupportShadowStorageAdapterPlanReadinessStatus;
  recommendedNextSprint: DecisionSupportShadowStorageAdapterPlanNextSprintRecommendation;
  recommendation: string;
  representativeValidDrafts: DecisionSupportShadowStorageDraft[];
  weakDrafts: DecisionSupportShadowStorageDraft[];
  blockingValidationFailures: DecisionSupportShadowStorageDraftValidationResult[];
};

// ─── Explain ────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageAdapterPlanExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  planProfile: string;
  methodPolicies: string[];
  schemaProposal: string;
  migrationProposal: string;
  storageDraftMappingPolicy: string;
  storageDraftValidationGates: string[];
  noopSimulation: string;
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  whyWriteCaptureDraftIsFutureOnly: string;
  expectedSprint28Path: string;
};
