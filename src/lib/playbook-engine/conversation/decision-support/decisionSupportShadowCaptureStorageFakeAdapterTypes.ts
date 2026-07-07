/**
 * Sprint 28R — Decision Support Shadow Capture Storage Adapter Fake Implementation: types.
 *
 * Pure type definitions for a **fake (in-memory, test-only) storage adapter** — the first sprint in
 * this package tree to actually implement `writeCaptureDraft`/`deleteByCaptureId`/`deleteByWorkspace`/
 * `purgeExpired`/`listByPolicyVersion` (all `futureOnly` in Sprint 27R), but only ever against a
 * private, in-process JavaScript array created and owned by a single adapter instance. There is still
 * no database, no migration, no table, no Supabase client, and no real persistence anywhere in this
 * module: every `real*`/`db*`/`supabase*`/`external*` flag on every result type here is a literal
 * `false`, never computed from caller input.
 *
 * This module is not imported by the router, composer, any production handler, or the gateway. It has
 * no production wiring, no database client, no Supabase client, and no feature-flag read — see
 * `docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md` for the full scope and
 * non-goals.
 */

import type { DecisionSupportShadowStorageDraft } from "./decisionSupportShadowCaptureStorageAdapterPlanTypes";

// ─── Profile / mode / kind ──────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeAdapterProfile = "strict_test_only_fake_adapter";

export type DecisionSupportShadowStorageFakeAdapterMode = "test_only_in_memory" | "dry_run_fake_write" | "policy_validation_only";

export type DecisionSupportShadowStorageFakeAdapterKind = "in_memory_fake" | "dry_run_fake" | "policy_validation_fake";

// ─── Statuses ───────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeWriteStatus =
  | "accepted_in_memory"
  | "dry_run_accepted"
  | "rejected_by_validation"
  | "rejected_by_policy"
  | "rejected_by_safety_gate"
  | "not_attempted";

export type DecisionSupportShadowStorageFakeDeleteStatus = "deleted_in_memory" | "not_found" | "rejected_by_policy" | "not_attempted";

export type DecisionSupportShadowStorageFakePurgeStatus = "purged_in_memory" | "nothing_to_purge" | "rejected_by_policy" | "not_attempted";

export type DecisionSupportShadowStorageFakeListStatus = "listed_in_memory" | "empty" | "rejected_by_policy";

// ─── Config ─────────────────────────────────────────────────────────────────────────────

/**
 * The fake adapter's configuration. `allowRealPersistence`/`allowDbWrite`/`allowSupabaseWrite`/
 * `allowExternalCalls` are always `false` — `createDecisionSupportShadowStorageFakeAdapterConfig()`
 * forces these four to `false` regardless of what a caller's `overrides` object claims, mirroring how
 * the Sprint 25R capture harness's own policy never actually loosens minimization from an override.
 */
export type DecisionSupportShadowStorageFakeAdapterConfig = {
  profile: "strict_test_only_fake_adapter";
  mode: DecisionSupportShadowStorageFakeAdapterMode;
  allowInMemoryWriteForTests: boolean;
  allowDryRunFakeWrite: boolean;
  allowDeleteSimulation: boolean;
  allowPurgeSimulation: boolean;
  allowListSimulation: boolean;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  requirePolicyValidation: true;
  requireDraftValidation: true;
  requireDeletionPolicy: true;
  requireRetentionPolicy: true;
  now?: string;
  notes?: string[];
};

// ─── Fake repository record ─────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeRepositoryRecordAudit = {
  fakeOnly: true;
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  rawInputStored: false;
  fullCandidateStored: false;
  userVisibleOutputStored: false;
};

export type DecisionSupportShadowStorageFakeRepositoryRecord = {
  recordId: string;
  storedAt?: string;
  draft: DecisionSupportShadowStorageDraft;
  policyVersion: string;
  workspaceIdHash?: string;
  retentionExpiresAt?: string | null;
  deletionRequired: true;
  deleted: boolean;
  deletedAt?: string;
  deleteReason?: string;
  purgeEligible: boolean;
  audit: DecisionSupportShadowStorageFakeRepositoryRecordAudit;
};

// ─── Write result ───────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeWriteResult = {
  status: DecisionSupportShadowStorageFakeWriteStatus;
  accepted: boolean;
  record?: DecisionSupportShadowStorageFakeRepositoryRecord;
  validationPassed: boolean;
  policyPassed: boolean;
  writeAttempted: boolean;
  inMemoryWriteAttempted: boolean;
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  rawInputStored: false;
  inputPreviewStored: false;
  fullCandidateStored: false;
  userVisibleOutputStored: false;
  projectNameStored: false;
  emailAddressStored: false;
  phoneNumberStored: false;
  blockingFailureCount: number;
  warnings: string[];
};

// ─── Delete results ─────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeDeleteResult = {
  status: DecisionSupportShadowStorageFakeDeleteStatus;
  captureId: string;
  deletedCount: number;
  realDeleteAttempted: false;
  dbDeleteAttempted: false;
  supabaseDeleteAttempted: false;
  warnings: string[];
};

export type DecisionSupportShadowStorageFakeWorkspaceDeleteResult = {
  status: DecisionSupportShadowStorageFakeDeleteStatus;
  workspaceIdHash: string;
  deletedCount: number;
  realDeleteAttempted: false;
  dbDeleteAttempted: false;
  supabaseDeleteAttempted: false;
  warnings: string[];
};

// ─── Purge result ───────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakePurgeResult = {
  status: DecisionSupportShadowStorageFakePurgeStatus;
  purgedCount: number;
  evaluatedCount: number;
  realPurgeAttempted: false;
  dbPurgeAttempted: false;
  supabasePurgeAttempted: false;
  warnings: string[];
};

// ─── List result ────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeListResult = {
  status: DecisionSupportShadowStorageFakeListStatus;
  policyVersion: string;
  records: DecisionSupportShadowStorageFakeRepositoryRecord[];
  count: number;
  realReadAttempted: false;
  dbReadAttempted: false;
  supabaseReadAttempted: false;
  warnings: string[];
};

// ─── Stats ──────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeAdapterStats = {
  totalRecords: number;
  activeRecords: number;
  deletedRecords: number;
  purgeEligibleRecords: number;
  writeAcceptedCount: number;
  writeRejectedCount: number;
  deleteCount: number;
  purgeCount: number;
  listCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  rawInputStoredCount: number;
  inputPreviewStoredCount: number;
  fullCandidateStoredCount: number;
  userVisibleOutputStoredCount: number;
  projectNameStoredCount: number;
  emailAddressStoredCount: number;
  phoneNumberStoredCount: number;
};

// ─── Adapter ────────────────────────────────────────────────────────────────────────────

/**
 * A fake, in-memory-only storage adapter instance. Every instance returned by
 * `createDecisionSupportShadowStorageFakeAdapter()` owns its own private `records` array via closure
 * — there is no module-level singleton, so two adapter instances never share state.
 */
export type DecisionSupportShadowStorageFakeAdapter = {
  kind: DecisionSupportShadowStorageFakeAdapterKind;
  config: DecisionSupportShadowStorageFakeAdapterConfig;
  writeDraft(draft: DecisionSupportShadowStorageDraft): DecisionSupportShadowStorageFakeWriteResult;
  deleteByCaptureId(captureId: string): DecisionSupportShadowStorageFakeDeleteResult;
  deleteByWorkspace(workspaceIdHash: string): DecisionSupportShadowStorageFakeWorkspaceDeleteResult;
  purgeExpired(now?: string): DecisionSupportShadowStorageFakePurgeResult;
  listByPolicyVersion(policyVersion: string): DecisionSupportShadowStorageFakeListResult;
  listAll(): DecisionSupportShadowStorageFakeRepositoryRecord[];
  stats(): DecisionSupportShadowStorageFakeAdapterStats;
  clear(): void;
};

// ─── Evaluation ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeAdapterReadinessStatus =
  | "ready_for_fake_adapter_hardening"
  | "ready_for_persistence_readiness_review"
  | "not_ready_for_next_stage"
  | "blocked_by_fake_adapter_violation";

export type DecisionSupportShadowStorageFakeAdapterEvaluationOptions = {
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  config?: Partial<DecisionSupportShadowStorageFakeAdapterConfig>;
};

export type DecisionSupportShadowStorageFakeAdapterEvaluationResult = {
  adapter: DecisionSupportShadowStorageFakeAdapter;
  corpusWriteResults: DecisionSupportShadowStorageFakeWriteResult[];
  syntheticInvalidWriteResults: DecisionSupportShadowStorageFakeWriteResult[];
  syntheticPurgeWriteResults: DecisionSupportShadowStorageFakeWriteResult[];
  listResults: DecisionSupportShadowStorageFakeListResult[];
  deleteResults: DecisionSupportShadowStorageFakeDeleteResult[];
  purgeResults: DecisionSupportShadowStorageFakePurgeResult[];
};

export type DecisionSupportShadowStorageFakeAdapterEvaluationSummary = {
  totalCaptureRecords: number;
  totalDraftsCreated: number;
  fakeWriteAttemptCount: number;
  fakeWriteAcceptedCount: number;
  fakeWriteRejectedCount: number;
  fakeWriteAcceptedRate: number;
  fakeRepositoryRecordCount: number;
  fakeListCount: number;
  fakeDeleteCount: number;
  fakePurgeCount: number;
  invalidDraftRejectedCount: number;
  policyViolationRejectedCount: number;
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
  readinessStatus: DecisionSupportShadowStorageFakeAdapterReadinessStatus;
  recommendedNextSprint: string;
  recommendation: string;
  representativeStoredRecords: DecisionSupportShadowStorageFakeRepositoryRecord[];
  rejectedWriteExamples: DecisionSupportShadowStorageFakeWriteResult[];
  weakFakeAdapterResults: string[];
};

// ─── Explain ────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowStorageFakeAdapterExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  adapterProfile: string;
  config: string;
  repositoryRecordShape: string;
  writeBehavior: string;
  deleteBehavior: string;
  purgeBehavior: string;
  listBehavior: string;
  statsBehavior: string;
  invalidDraftRejectionPolicy: string;
  noRealStorageGuarantees: string;
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whyThisIsStillNotARealAdapter: string;
  expectedSprint29Path: string;
};
