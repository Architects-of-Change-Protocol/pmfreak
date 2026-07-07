/**
 * Sprint 29R — Decision Support Shadow Capture Storage Adapter Persistence Readiness Review: types.
 *
 * Pure type definitions for an offline, deterministic **readiness review** — not an implementation —
 * that decides whether PMFreak is ready to move toward any form of real persistence for the shadow
 * capture pipeline built across Sprint 24R-28R. This module only ever reads already-computed
 * Sprint 24R-28R evaluation results and metrics; it creates no database, migration, SQL file, table,
 * Supabase write, real storage adapter, or real repository, and it does not touch the router,
 * composer, any production handler, or the gateway.
 *
 * See `docs/conversational-brain-decision-support-shadow-persistence-readiness.md` for the full scope
 * and non-goals.
 */

// ─── Profile / mode ─────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessProfile = "strict_default_off_persistence_readiness_review";

export type DecisionSupportShadowPersistenceReadinessMode =
  | "review_only"
  | "fake_adapter_metric_review"
  | "migration_readiness_review"
  | "default_off_prototype_readiness_review";

// ─── Decision ───────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessDecision =
  | "do_not_build_real_persistence_yet"
  | "ready_for_migration_proposal_only"
  | "ready_for_default_off_persistence_prototype"
  | "blocked_by_safety_or_policy_gap";

// ─── Domains ────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessDomain =
  | "storage_policy"
  | "capture_harness"
  | "storage_draft_mapping"
  | "fake_adapter"
  | "schema_proposal"
  | "migration_proposal"
  | "deletion_purge"
  | "retention"
  | "tenant_workspace_isolation"
  | "access_control"
  | "audit_trail"
  | "observability"
  | "rollback"
  | "security_review"
  | "production_wiring"
  | "feature_flagging"
  | "data_subject_rights"
  | "privacy_minimization"
  | "test_coverage";

// ─── Status / risk ──────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessRiskLevel = "low" | "medium" | "high" | "critical";

export type DecisionSupportShadowPersistenceReadinessStatus = "ready" | "partially_ready" | "not_ready" | "blocked";

// ─── Blocker / prerequisite ─────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessBlocker = {
  id: string;
  domain: DecisionSupportShadowPersistenceReadinessDomain;
  severity: "warning" | "blocking" | "critical";
  title: string;
  description: string;
  requiredBeforeRealPersistence: boolean;
  requiredBeforeMigrationFile: boolean;
  requiredBeforeDefaultOffPrototype: boolean;
  recommendedResolutionSprint?: string;
};

export type DecisionSupportShadowPersistenceReadinessPrerequisite = {
  id: string;
  domain: DecisionSupportShadowPersistenceReadinessDomain;
  title: string;
  description: string;
  satisfied: boolean;
  evidence: string[];
  requiredBeforeRealPersistence: boolean;
  requiredBeforeMigrationFile: boolean;
  requiredBeforeDefaultOffPrototype: boolean;
};

// ─── Domain assessment ──────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessDomainAssessment = {
  domain: DecisionSupportShadowPersistenceReadinessDomain;
  status: DecisionSupportShadowPersistenceReadinessStatus;
  riskLevel: DecisionSupportShadowPersistenceReadinessRiskLevel;
  score: number;
  blockers: DecisionSupportShadowPersistenceReadinessBlocker[];
  prerequisites: DecisionSupportShadowPersistenceReadinessPrerequisite[];
  evidence: string[];
  recommendation: string;
};

// ─── Decision matrix ────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessDecisionMatrix = {
  decision: DecisionSupportShadowPersistenceReadinessDecision;
  allowedNextActions: string[];
  prohibitedNextActions: string[];
  requiredBeforeNextStage: string[];
  rationale: string[];
  recommendedNextSprint: string;
};

// ─── Input metrics ──────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessCaptureHarnessMetrics = {
  acceptableCaptureRate: number;
  allBlockingGatesPassedRate: number;
  rawInputRetainedCount: number;
  fullDecisionCandidateRetainedCount: number;
  fullClarificationCandidateRetainedCount: number;
  userVisibleOutputRetainedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
};

export type DecisionSupportShadowPersistenceReadinessStoragePolicyMetrics = {
  rawInputViolationCount: number;
  fullCandidateViolationCount: number;
  userVisibleOutputViolationCount: number;
  dbWriteViolationCount: number;
  supabaseWriteViolationCount: number;
  sideEffectViolationCount: number;
  captureHarnessCleanRate: number;
  blockingReadinessGateFailureCount: number;
};

export type DecisionSupportShadowPersistenceReadinessAdapterPlanMetrics = {
  totalDraftsCreated: number;
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
  migrationCreated: false;
  tableCreated: false;
  storageAdapterRealImplemented: false;
};

export type DecisionSupportShadowPersistenceReadinessFakeAdapterMetrics = {
  totalDraftsCreated: number;
  fakeWriteAcceptedRate: number;
  fakeWriteRejectedCount: number;
  invalidDraftRejectedCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  rawInputStoredCount: number;
  inputPreviewStoredCount: number;
  fullCandidateStoredCount: number;
  userVisibleOutputStoredCount: number;
  projectNameStoredCount: number;
  emailAddressStoredCount: number;
  phoneNumberStoredCount: number;
  validDraftRate: number;
  fakeAdapterSafetyRate: number;
};

export type DecisionSupportShadowPersistenceReadinessInputMetrics = {
  captureHarness: DecisionSupportShadowPersistenceReadinessCaptureHarnessMetrics;
  storagePolicy: DecisionSupportShadowPersistenceReadinessStoragePolicyMetrics;
  adapterPlan: DecisionSupportShadowPersistenceReadinessAdapterPlanMetrics;
  fakeAdapter: DecisionSupportShadowPersistenceReadinessFakeAdapterMetrics;
};

// ─── Review ─────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessReview = {
  kind: "decision_support_shadow_persistence_readiness_review";
  profile: "strict_default_off_persistence_readiness_review";
  mode: DecisionSupportShadowPersistenceReadinessMode;
  generatedAt?: string;
  inputMetrics: DecisionSupportShadowPersistenceReadinessInputMetrics;
  domainAssessments: DecisionSupportShadowPersistenceReadinessDomainAssessment[];
  blockers: DecisionSupportShadowPersistenceReadinessBlocker[];
  prerequisites: DecisionSupportShadowPersistenceReadinessPrerequisite[];
  decisionMatrix: DecisionSupportShadowPersistenceReadinessDecisionMatrix;
  decision: DecisionSupportShadowPersistenceReadinessDecision;
  readinessScore: number;
  realPersistenceAllowedNow: false;
  migrationFileAllowedNow: false;
  sqlFileAllowedNow: false;
  defaultOffPrototypeAllowedNow: boolean;
  recommendedNextSprint: string;
  warnings: string[];
};

// ─── Options ────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessOptions = {
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  mode?: DecisionSupportShadowPersistenceReadinessMode;
  inputMetrics?: DecisionSupportShadowPersistenceReadinessInputMetrics;
};

// ─── Summary ────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessEvaluationSummary = {
  readinessScore: number;
  assessedDomainCount: number;
  readyDomainCount: number;
  partiallyReadyDomainCount: number;
  notReadyDomainCount: number;
  blockedDomainCount: number;
  blockerCount: number;
  criticalBlockerCount: number;
  blockingBlockerCount: number;
  warningBlockerCount: number;
  satisfiedPrerequisiteCount: number;
  unsatisfiedPrerequisiteCount: number;
  realPersistenceAllowedNow: false;
  migrationFileAllowedNow: false;
  sqlFileAllowedNow: false;
  defaultOffPrototypeAllowedNow: boolean;
  decision: DecisionSupportShadowPersistenceReadinessDecision;
  recommendedNextSprint: string;
  recommendation: string;
  strongestReadyDomains: string[];
  weakestDomains: string[];
  requiredBeforeRealPersistence: string[];
  prohibitedNextActions: string[];
};

// ─── Explain ────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowPersistenceReadinessExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  reviewProfile: string;
  domains: string[];
  decisionRule: string;
  allowedNextActions: string[];
  prohibitedNextActions: string[];
  requiredBeforeRealPersistence: string[];
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whySqlFileIsNotCreated: string;
  whySupabaseWriteIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  whyRepositoryIsNotCreated: string;
  expectedSprint30Path: string;
};
