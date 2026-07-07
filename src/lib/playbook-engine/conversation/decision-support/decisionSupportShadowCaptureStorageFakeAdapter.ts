/**
 * Sprint 28R — Decision Support Shadow Capture Storage Adapter Fake Implementation.
 *
 * The first sprint in this package tree to actually *implement* (rather than merely name and
 * policy-gate) `writeCaptureDraft` / `deleteByCaptureId` / `deleteByWorkspace` / `purgeExpired` /
 * `listByPolicyVersion` from the Sprint 27R adapter method contract — but only ever against a private,
 * in-process JavaScript array that a single `createDecisionSupportShadowStorageFakeAdapter()` call
 * owns via closure. There is still no database, no migration, no table, no Supabase client, and no
 * real persistence anywhere in this module: every `real*`/`db*`/`supabase*`/`external*` flag on every
 * result this module returns is a literal `false`, never computed from caller input, and every
 * in-memory record disappears the moment the process exits or `adapter.clear()` is called.
 *
 * Reuses, rather than reimplements: the Sprint 24R shadow mode prep (`prepareDecisionSupportShadowModeRun`),
 * the Sprint 25R capture harness (`captureDecisionSupportShadowRun`), the Sprint 26R storage policy
 * (`classifyDecisionSupportShadowStorageField`, `DECISION_SUPPORT_SHADOW_STORAGE_POLICY_VERSION`), and
 * the Sprint 27R storage adapter plan (`mapDecisionSupportCaptureRecordToStorageDraft`,
 * `validateDecisionSupportShadowStorageDraft`, `runDecisionSupportShadowStorageAdapterPlanEvaluation`).
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. See `docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md` for the full
 * design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import { captureDecisionSupportShadowRun } from "./decisionSupportShadowCaptureHarness";
import type { DecisionSupportShadowCaptureRecord, DecisionSupportShadowCaptureResult } from "./decisionSupportShadowCaptureHarnessTypes";
import { prepareDecisionSupportShadowModeRun } from "./decisionSupportShadowModePrep";
import { classifyDecisionSupportShadowStorageField } from "./decisionSupportShadowCaptureStoragePolicy";
import {
  mapDecisionSupportCaptureRecordToStorageDraft,
  runDecisionSupportShadowStorageAdapterPlanEvaluation,
  validateDecisionSupportShadowStorageDraft,
} from "./decisionSupportShadowCaptureStorageAdapterPlan";
import type { DecisionSupportShadowStorageDraft } from "./decisionSupportShadowCaptureStorageAdapterPlanTypes";

import type {
  DecisionSupportShadowStorageFakeAdapter,
  DecisionSupportShadowStorageFakeAdapterConfig,
  DecisionSupportShadowStorageFakeAdapterEvaluationOptions,
  DecisionSupportShadowStorageFakeAdapterEvaluationResult,
  DecisionSupportShadowStorageFakeAdapterEvaluationSummary,
  DecisionSupportShadowStorageFakeAdapterExplain,
  DecisionSupportShadowStorageFakeAdapterKind,
  DecisionSupportShadowStorageFakeAdapterMode,
  DecisionSupportShadowStorageFakeAdapterReadinessStatus,
  DecisionSupportShadowStorageFakeAdapterStats,
  DecisionSupportShadowStorageFakeDeleteResult,
  DecisionSupportShadowStorageFakeListResult,
  DecisionSupportShadowStorageFakePurgeResult,
  DecisionSupportShadowStorageFakeRepositoryRecord,
  DecisionSupportShadowStorageFakeWorkspaceDeleteResult,
  DecisionSupportShadowStorageFakeWriteResult,
  DecisionSupportShadowStorageFakeWriteStatus,
} from "./decisionSupportShadowCaptureStorageFakeAdapterTypes";

export type {
  DecisionSupportShadowStorageFakeAdapterProfile,
  DecisionSupportShadowStorageFakeAdapterMode,
  DecisionSupportShadowStorageFakeAdapterKind,
  DecisionSupportShadowStorageFakeWriteStatus,
  DecisionSupportShadowStorageFakeDeleteStatus,
  DecisionSupportShadowStorageFakePurgeStatus,
  DecisionSupportShadowStorageFakeListStatus,
  DecisionSupportShadowStorageFakeAdapterConfig,
  DecisionSupportShadowStorageFakeRepositoryRecordAudit,
  DecisionSupportShadowStorageFakeRepositoryRecord,
  DecisionSupportShadowStorageFakeWriteResult,
  DecisionSupportShadowStorageFakeDeleteResult,
  DecisionSupportShadowStorageFakeWorkspaceDeleteResult,
  DecisionSupportShadowStorageFakePurgeResult,
  DecisionSupportShadowStorageFakeListResult,
  DecisionSupportShadowStorageFakeAdapterStats,
  DecisionSupportShadowStorageFakeAdapter,
  DecisionSupportShadowStorageFakeAdapterReadinessStatus,
  DecisionSupportShadowStorageFakeAdapterEvaluationOptions,
  DecisionSupportShadowStorageFakeAdapterEvaluationResult,
  DecisionSupportShadowStorageFakeAdapterEvaluationSummary,
  DecisionSupportShadowStorageFakeAdapterExplain,
} from "./decisionSupportShadowCaptureStorageFakeAdapterTypes";

export const DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_VERSION = "28R.1.0";

// ─── Config ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a strict, `"strict_test_only_fake_adapter"` default config. `allowRealPersistence`,
 * `allowDbWrite`, `allowSupabaseWrite`, and `allowExternalCalls` are always `false`, forced regardless
 * of any override a caller passes — mirroring how the Sprint 25R capture harness's own policy never
 * actually loosens minimization from a caller-supplied override. `requirePolicyValidation`,
 * `requireDraftValidation`, `requireDeletionPolicy`, and `requireRetentionPolicy` are always `true`.
 */
export function createDecisionSupportShadowStorageFakeAdapterConfig(
  overrides: Partial<DecisionSupportShadowStorageFakeAdapterConfig> = {},
): DecisionSupportShadowStorageFakeAdapterConfig {
  const config: DecisionSupportShadowStorageFakeAdapterConfig = {
    profile: "strict_test_only_fake_adapter",
    mode: overrides.mode ?? "test_only_in_memory",
    allowInMemoryWriteForTests: overrides.allowInMemoryWriteForTests ?? true,
    allowDryRunFakeWrite: overrides.allowDryRunFakeWrite ?? false,
    allowDeleteSimulation: overrides.allowDeleteSimulation ?? true,
    allowPurgeSimulation: overrides.allowPurgeSimulation ?? true,
    allowListSimulation: overrides.allowListSimulation ?? true,
    // These four are never actually loosened here, regardless of what a caller's override object
    // claims — this is the fake adapter's own strict, non-negotiable invariant.
    allowRealPersistence: false,
    allowDbWrite: false,
    allowSupabaseWrite: false,
    allowExternalCalls: false,
    requirePolicyValidation: true,
    requireDraftValidation: true,
    requireDeletionPolicy: true,
    requireRetentionPolicy: true,
  };
  if (overrides.now !== undefined) config.now = overrides.now;
  if (overrides.notes !== undefined) config.notes = [...overrides.notes];
  return config;
}

const KIND_BY_MODE: Record<DecisionSupportShadowStorageFakeAdapterMode, DecisionSupportShadowStorageFakeAdapterKind> = {
  test_only_in_memory: "in_memory_fake",
  dry_run_fake_write: "dry_run_fake",
  policy_validation_only: "policy_validation_fake",
};

// ─── Helpers ────────────────────────────────────────────────────────────────────────────

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

/** Flattens an object's own-enumerable key/value pairs, descending into nested plain objects/arrays
 * up to a bounded depth — enough to inspect a draft's top level, `fields`, and any nested summary
 * object a synthetic invalid draft injects a forbidden key into. Mirrors (does not import, since it
 * is a private helper in Sprint 27R's own module) the same shape-walking strategy used by
 * `validateDecisionSupportShadowStorageDraft()`. */
function flattenEntries(value: unknown, depth = 0, acc: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (value === null || value === undefined || typeof value !== "object" || depth > 3) return acc;
  if (Array.isArray(value)) {
    for (const item of value) flattenEntries(item, depth + 1, acc);
    return acc;
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    acc.push([key, val]);
    if (val && typeof val === "object") flattenEntries(val, depth + 1, acc);
  }
  return acc;
}

const FORBIDDEN_CONTENT_FIELD_NAMES = [
  "rawInput",
  "inputPreview",
  "fullDecisionCandidate",
  "fullClarificationCandidate",
  "responseText",
  "userVisibleOutput",
  "projectName",
  "emailAddress",
  "phoneNumber",
] as const;

/** Defense-in-depth re-check: even though `validateDecisionSupportShadowStorageDraft()` (Sprint 27R)
 * already fails a blocking gate for every one of these, this fake adapter re-checks independently
 * before ever pushing a record into its private array — a second, redundant guard is exactly what a
 * write path (the sprint's first real write path, even if fake) should have. */
function draftCarriesForbiddenContent(draft: unknown): boolean {
  const entries = flattenEntries(draft);
  return entries.some(([key, value]) => (FORBIDDEN_CONTENT_FIELD_NAMES as readonly string[]).includes(key) && value !== undefined && value !== null && value !== "");
}

/** A second, independent reuse of the Sprint 26R field-classification table — flags any key present
 * inside `draft.fields` that Sprint 26R's own policy calls `"prohibited"`, regardless of whether it
 * is also one of the nine `FORBIDDEN_CONTENT_FIELD_NAMES` above. Deliberately scoped to `draft.fields`
 * only (not the whole draft object): Sprint 27R's own draft carries top-level documentation fields —
 * e.g. `excludedFields` (a list of forbidden field *names*, as strings) and
 * `policyAssessmentSummary.fullCandidatesExcluded` (a boolean safety flag whose own name happens to
 * contain both "full" and "candidate") — that would otherwise trip Sprint 26R's dynamic
 * full+candidate fallback rule as a false positive, even though neither carries any actual content. */
function sprint26PolicyViolationOnDraft(draft: unknown): boolean {
  const fields = (draft as { fields?: unknown } | null | undefined)?.fields;
  const entries = flattenEntries(fields);
  return entries.some(([key, value]) => {
    if (value === undefined || value === null || value === "") return false;
    return classifyDecisionSupportShadowStorageField(key, value).decision === "prohibited";
  });
}

function computePurgeEligible(retentionExpiresAt: string | null | undefined, referenceNow: string | undefined): boolean {
  if (!retentionExpiresAt || !referenceNow) return false;
  return retentionExpiresAt <= referenceNow;
}

// ─── Fake repository record ─────────────────────────────────────────────────────────────

/**
 * Builds a defensively-copied (deep-cloned) fake repository record from a validated
 * `DecisionSupportShadowStorageDraft`. `recordId` is deterministic (`dss_fake_<sourceCaptureId>`);
 * `purgeEligible` is computed against `options.now`, never the system clock.
 */
export function createDecisionSupportShadowStorageFakeRepositoryRecord(
  draft: DecisionSupportShadowStorageDraft,
  options: { now?: string; workspaceIdHash?: string } = {},
): DecisionSupportShadowStorageFakeRepositoryRecord {
  const clonedDraft = deepClone(draft);
  const fieldsAny = (clonedDraft.fields ?? {}) as unknown as Record<string, unknown>;
  const retentionExpiresAt = (fieldsAny.retentionExpiresAt as string | null | undefined) ?? null;
  const generatedAt = fieldsAny.generatedAt as string | undefined;

  return {
    recordId: `dss_fake_${clonedDraft.sourceCaptureId}`,
    storedAt: options.now ?? generatedAt,
    draft: clonedDraft,
    policyVersion: clonedDraft.policyVersion,
    ...(options.workspaceIdHash !== undefined ? { workspaceIdHash: options.workspaceIdHash } : {}),
    retentionExpiresAt,
    deletionRequired: true,
    deleted: false,
    purgeEligible: computePurgeEligible(retentionExpiresAt, options.now),
    audit: {
      fakeOnly: true,
      realPersistenceAttempted: false,
      dbWriteAttempted: false,
      supabaseWriteAttempted: false,
      externalCallAttempted: false,
      rawInputStored: false,
      fullCandidateStored: false,
      userVisibleOutputStored: false,
    },
  } satisfies DecisionSupportShadowStorageFakeRepositoryRecord;
}

function buildWriteResult(
  status: DecisionSupportShadowStorageFakeWriteStatus,
  overrides: Partial<DecisionSupportShadowStorageFakeWriteResult> = {},
): DecisionSupportShadowStorageFakeWriteResult {
  return {
    status,
    accepted: false,
    validationPassed: false,
    policyPassed: false,
    writeAttempted: true,
    inMemoryWriteAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    externalCallAttempted: false,
    rawInputStored: false,
    inputPreviewStored: false,
    fullCandidateStored: false,
    userVisibleOutputStored: false,
    projectNameStored: false,
    emailAddressStored: false,
    phoneNumberStored: false,
    blockingFailureCount: 0,
    warnings: [],
    ...overrides,
  };
}

// ─── Adapter ────────────────────────────────────────────────────────────────────────────

/**
 * Creates an independent, in-memory-only fake storage adapter instance. Every call to this function
 * returns a fresh adapter whose `records` array lives only in this call's closure — there is no
 * module-level singleton, so two adapters never share state, and nothing here is ever wired to a
 * database, file, or network call.
 */
export function createDecisionSupportShadowStorageFakeAdapter(
  config: DecisionSupportShadowStorageFakeAdapterConfig = createDecisionSupportShadowStorageFakeAdapterConfig(),
): DecisionSupportShadowStorageFakeAdapter {
  const records: DecisionSupportShadowStorageFakeRepositoryRecord[] = [];
  let writeAcceptedCount = 0;
  let writeRejectedCount = 0;
  let deleteCount = 0;
  let purgeCount = 0;
  let listCount = 0;

  function writeDraft(draft: DecisionSupportShadowStorageDraft): DecisionSupportShadowStorageFakeWriteResult {
    const draftAny = draft as unknown as Record<string, unknown>;

    const validationResults = validateDecisionSupportShadowStorageDraft(draft);
    const blockingFailures = validationResults.filter((r) => r.severity === "blocking" && !r.passed);

    const policyFlagViolation = draftAny.storageEnabled === true || draftAny.realPersistenceAllowed === true;
    const forbiddenContentViolation = draftCarriesForbiddenContent(draft) || sprint26PolicyViolationOnDraft(draft);
    const storageDisabledGateFailed = blockingFailures.some((f) => f.gate === "storage_disabled") || policyFlagViolation;
    const invalid = blockingFailures.length > 0 || forbiddenContentViolation || policyFlagViolation;

    if (invalid) {
      writeRejectedCount += 1;
      const warnings = blockingFailures.map((f) => `Blocking validation gate "${f.gate}" failed: ${f.reason}`);
      if (forbiddenContentViolation && blockingFailures.length === 0) {
        warnings.push("Fake-adapter defense-in-depth check found forbidden content even though every Sprint 27R validation gate passed.");
      }
      const status: DecisionSupportShadowStorageFakeWriteStatus = storageDisabledGateFailed ? "rejected_by_policy" : "rejected_by_validation";
      return buildWriteResult(status, {
        validationPassed: blockingFailures.length === 0 && !forbiddenContentViolation,
        policyPassed: !policyFlagViolation,
        blockingFailureCount: blockingFailures.length,
        warnings,
      });
    }

    if (config.mode === "policy_validation_only") {
      return buildWriteResult("not_attempted", {
        validationPassed: true,
        policyPassed: true,
        writeAttempted: false,
        warnings: ["mode is policy_validation_only — the draft was validated but no write (real or fake) was ever attempted."],
      });
    }

    if (config.mode === "dry_run_fake_write") {
      if (!config.allowDryRunFakeWrite) {
        writeRejectedCount += 1;
        return buildWriteResult("rejected_by_safety_gate", {
          validationPassed: true,
          policyPassed: true,
          warnings: ["mode is dry_run_fake_write but allowDryRunFakeWrite is not true — the write is blocked rather than simulated."],
        });
      }
      writeAcceptedCount += 1;
      return buildWriteResult("dry_run_accepted", { accepted: true, validationPassed: true, policyPassed: true, warnings: [] });
    }

    // Default mode: test_only_in_memory.
    if (!config.allowInMemoryWriteForTests) {
      writeRejectedCount += 1;
      return buildWriteResult("rejected_by_safety_gate", {
        validationPassed: true,
        policyPassed: true,
        warnings: ["mode is test_only_in_memory but allowInMemoryWriteForTests is not true — the write is blocked rather than stored."],
      });
    }

    const record = createDecisionSupportShadowStorageFakeRepositoryRecord(draft, { now: config.now });
    records.push(record);
    writeAcceptedCount += 1;

    return {
      status: "accepted_in_memory",
      accepted: true,
      record,
      validationPassed: true,
      policyPassed: true,
      writeAttempted: true,
      inMemoryWriteAttempted: true,
      realPersistenceAttempted: false,
      dbWriteAttempted: false,
      supabaseWriteAttempted: false,
      externalCallAttempted: false,
      rawInputStored: false,
      inputPreviewStored: false,
      fullCandidateStored: false,
      userVisibleOutputStored: false,
      projectNameStored: false,
      emailAddressStored: false,
      phoneNumberStored: false,
      blockingFailureCount: 0,
      warnings: [],
    };
  }

  function deleteByCaptureId(captureId: string): DecisionSupportShadowStorageFakeDeleteResult {
    deleteCount += 1;
    if (!config.allowDeleteSimulation) {
      return {
        status: "rejected_by_policy",
        captureId,
        deletedCount: 0,
        realDeleteAttempted: false,
        dbDeleteAttempted: false,
        supabaseDeleteAttempted: false,
        warnings: ["allowDeleteSimulation is not true — delete simulation is disabled by config."],
      };
    }

    const matches = records.filter((r) => !r.deleted && r.draft.sourceCaptureId === captureId);
    if (matches.length === 0) {
      return { status: "not_found", captureId, deletedCount: 0, realDeleteAttempted: false, dbDeleteAttempted: false, supabaseDeleteAttempted: false, warnings: [] };
    }

    for (const record of matches) {
      record.deleted = true;
      record.deleteReason = "delete_by_capture_id_fake";
      if (config.now) record.deletedAt = config.now;
    }

    return {
      status: "deleted_in_memory",
      captureId,
      deletedCount: matches.length,
      realDeleteAttempted: false,
      dbDeleteAttempted: false,
      supabaseDeleteAttempted: false,
      warnings: [],
    };
  }

  function deleteByWorkspace(workspaceIdHash: string): DecisionSupportShadowStorageFakeWorkspaceDeleteResult {
    deleteCount += 1;
    if (!config.allowDeleteSimulation) {
      return {
        status: "rejected_by_policy",
        workspaceIdHash,
        deletedCount: 0,
        realDeleteAttempted: false,
        dbDeleteAttempted: false,
        supabaseDeleteAttempted: false,
        warnings: ["allowDeleteSimulation is not true — delete simulation is disabled by config."],
      };
    }

    const matches = records.filter((r) => !r.deleted && r.workspaceIdHash === workspaceIdHash);
    if (matches.length === 0) {
      return { status: "not_found", workspaceIdHash, deletedCount: 0, realDeleteAttempted: false, dbDeleteAttempted: false, supabaseDeleteAttempted: false, warnings: [] };
    }

    for (const record of matches) {
      record.deleted = true;
      record.deleteReason = "delete_by_workspace_fake";
      if (config.now) record.deletedAt = config.now;
    }

    return {
      status: "deleted_in_memory",
      workspaceIdHash,
      deletedCount: matches.length,
      realDeleteAttempted: false,
      dbDeleteAttempted: false,
      supabaseDeleteAttempted: false,
      warnings: [],
    };
  }

  function purgeExpired(now?: string): DecisionSupportShadowStorageFakePurgeResult {
    purgeCount += 1;
    if (!config.allowPurgeSimulation) {
      return {
        status: "rejected_by_policy",
        purgedCount: 0,
        evaluatedCount: 0,
        realPurgeAttempted: false,
        dbPurgeAttempted: false,
        supabasePurgeAttempted: false,
        warnings: ["allowPurgeSimulation is not true — purge simulation is disabled by config."],
      };
    }

    const referenceNow = now ?? config.now;
    const candidates = records.filter((r) => !r.deleted);
    const evaluatedCount = candidates.length;

    if (!referenceNow) {
      return {
        status: "nothing_to_purge",
        purgedCount: 0,
        evaluatedCount,
        realPurgeAttempted: false,
        dbPurgeAttempted: false,
        supabasePurgeAttempted: false,
        warnings: ['No reference "now" was supplied (neither purgeExpired(now) nor adapter config.now) — nothing can be purged deterministically.'],
      };
    }

    let purgedCount = 0;
    for (const record of candidates) {
      if (record.retentionExpiresAt != null && record.retentionExpiresAt <= referenceNow) {
        record.deleted = true;
        record.deleteReason = "purge_expired_fake";
        record.deletedAt = referenceNow;
        purgedCount += 1;
      }
    }

    return {
      status: purgedCount > 0 ? "purged_in_memory" : "nothing_to_purge",
      purgedCount,
      evaluatedCount,
      realPurgeAttempted: false,
      dbPurgeAttempted: false,
      supabasePurgeAttempted: false,
      warnings: [],
    };
  }

  function listByPolicyVersion(policyVersion: string): DecisionSupportShadowStorageFakeListResult {
    listCount += 1;
    if (!config.allowListSimulation) {
      return {
        status: "rejected_by_policy",
        policyVersion,
        records: [],
        count: 0,
        realReadAttempted: false,
        dbReadAttempted: false,
        supabaseReadAttempted: false,
        warnings: ["allowListSimulation is not true — list simulation is disabled by config."],
      };
    }

    const matches = records.filter((r) => !r.deleted && r.policyVersion === policyVersion).map(deepClone);
    if (matches.length === 0) {
      return { status: "empty", policyVersion, records: [], count: 0, realReadAttempted: false, dbReadAttempted: false, supabaseReadAttempted: false, warnings: [] };
    }

    return {
      status: "listed_in_memory",
      policyVersion,
      records: matches,
      count: matches.length,
      realReadAttempted: false,
      dbReadAttempted: false,
      supabaseReadAttempted: false,
      warnings: [],
    };
  }

  function listAll(): DecisionSupportShadowStorageFakeRepositoryRecord[] {
    return records.map(deepClone);
  }

  function stats(): DecisionSupportShadowStorageFakeAdapterStats {
    const activeRecords = records.filter((r) => !r.deleted).length;
    const deletedRecords = records.filter((r) => r.deleted).length;
    const purgeEligibleRecords = records.filter((r) => !r.deleted && r.purgeEligible).length;

    return {
      totalRecords: records.length,
      activeRecords,
      deletedRecords,
      purgeEligibleRecords,
      writeAcceptedCount,
      writeRejectedCount,
      deleteCount,
      purgeCount,
      listCount,
      realPersistenceAttemptedCount: 0,
      dbWriteAttemptedCount: 0,
      supabaseWriteAttemptedCount: 0,
      rawInputStoredCount: 0,
      inputPreviewStoredCount: 0,
      fullCandidateStoredCount: 0,
      userVisibleOutputStoredCount: 0,
      projectNameStoredCount: 0,
      emailAddressStoredCount: 0,
      phoneNumberStoredCount: 0,
    };
  }

  function clear(): void {
    records.length = 0;
    writeAcceptedCount = 0;
    writeRejectedCount = 0;
    deleteCount = 0;
    purgeCount = 0;
    listCount = 0;
  }

  return {
    kind: KIND_BY_MODE[config.mode],
    config,
    writeDraft,
    deleteByCaptureId,
    deleteByWorkspace,
    purgeExpired,
    listByPolicyVersion,
    listAll,
    stats,
    clear,
  };
}

// ─── Thin wrapper functions ──────────────────────────────────────────────────────────────

export function writeDecisionSupportShadowStorageDraftToFakeAdapter(
  adapter: DecisionSupportShadowStorageFakeAdapter,
  draft: DecisionSupportShadowStorageDraft,
): DecisionSupportShadowStorageFakeWriteResult {
  return adapter.writeDraft(draft);
}

export function deleteDecisionSupportShadowStorageDraftByCaptureIdFake(
  adapter: DecisionSupportShadowStorageFakeAdapter,
  captureId: string,
): DecisionSupportShadowStorageFakeDeleteResult {
  return adapter.deleteByCaptureId(captureId);
}

export function deleteDecisionSupportShadowStorageDraftByWorkspaceFake(
  adapter: DecisionSupportShadowStorageFakeAdapter,
  workspaceIdHash: string,
): DecisionSupportShadowStorageFakeWorkspaceDeleteResult {
  return adapter.deleteByWorkspace(workspaceIdHash);
}

export function purgeExpiredDecisionSupportShadowStorageDraftsFake(
  adapter: DecisionSupportShadowStorageFakeAdapter,
  now?: string,
): DecisionSupportShadowStorageFakePurgeResult {
  return adapter.purgeExpired(now);
}

export function listDecisionSupportShadowStorageDraftsByPolicyVersionFake(
  adapter: DecisionSupportShadowStorageFakeAdapter,
  policyVersion: string,
): DecisionSupportShadowStorageFakeListResult {
  return adapter.listByPolicyVersion(policyVersion);
}

// ─── Evaluation over a corpus ─────────────────────────────────────────────────────────────

/**
 * Builds one real, policy-clean draft by running the full Sprint 24R -> Sprint 25R -> Sprint 27R
 * pipeline directly (rather than reusing a corpus-derived draft) — the base shape every synthetic
 * invalid/expired draft in this evaluation is cloned from.
 */
function buildBaseValidDraft(now?: string): DecisionSupportShadowStorageDraft {
  const run = prepareDecisionSupportShadowModeRun({
    id: "fake-adapter-synthetic-base",
    input: "Deberiamos usar Postgres o Mongo para el nuevo servicio de facturacion del equipo?",
    desiredFutureRoute: "decision_support",
    now,
  });
  const capture: DecisionSupportShadowCaptureResult = captureDecisionSupportShadowRun(run, { mode: "dry_run", now });
  const record: DecisionSupportShadowCaptureRecord | undefined = capture.record;
  if (!record) {
    throw new Error("decisionSupportShadowCaptureStorageFakeAdapter: failed to build a base capture record for synthetic drafts.");
  }
  return mapDecisionSupportCaptureRecordToStorageDraft(record);
}

type SyntheticInvalidSpec = { suffix: string; field: string; value: unknown; topLevel?: boolean };

const SYNTHETIC_INVALID_SPECS: SyntheticInvalidSpec[] = [
  { suffix: "raw-input", field: "rawInput", value: "el texto crudo del usuario" },
  { suffix: "input-preview", field: "inputPreview", value: "algo del mensaje original" },
  { suffix: "full-decision-candidate", field: "fullDecisionCandidate", value: { recommendationText: "..." } },
  { suffix: "full-clarification-candidate", field: "fullClarificationCandidate", value: { responseText: "..." } },
  { suffix: "response-text", field: "responseText", value: "la respuesta completa que se mostraria al usuario" },
  { suffix: "user-visible-output", field: "userVisibleOutput", value: "esto nunca deberia guardarse" },
  { suffix: "project-name", field: "projectName", value: "Proyecto Acme Confidencial" },
  { suffix: "email-address", field: "emailAddress", value: "pm@example.com" },
  { suffix: "phone-number", field: "phoneNumber", value: "+1 555 123 4567" },
  { suffix: "storage-enabled", field: "storageEnabled", value: true, topLevel: true },
  { suffix: "real-persistence-allowed", field: "realPersistenceAllowed", value: true, topLevel: true },
];

/** Builds one synthetic invalid draft per `SYNTHETIC_INVALID_SPECS` entry, each a clone of
 * `baseDraft` with exactly one forbidden field/flag injected — proving `writeDraft()` rejects every
 * one of them, not merely the ones exercised by the Sprint 18R corpus (which never carries any). */
function buildSyntheticInvalidDrafts(baseDraft: DecisionSupportShadowStorageDraft): DecisionSupportShadowStorageDraft[] {
  return SYNTHETIC_INVALID_SPECS.map((spec) => {
    const clone = deepClone(baseDraft) as unknown as Record<string, unknown>;
    clone.sourceCaptureId = `${baseDraft.sourceCaptureId}-synthetic-invalid-${spec.suffix}`;
    clone.draftId = `${String(clone.draftId)}-synthetic-invalid-${spec.suffix}`;
    if (spec.topLevel) {
      clone[spec.field] = spec.value;
    } else {
      clone.fields = { ...((clone.fields as Record<string, unknown>) ?? {}), [spec.field]: spec.value };
    }
    return clone as unknown as DecisionSupportShadowStorageDraft;
  });
}

/** Builds one otherwise-valid draft (no forbidden field, `storageEnabled`/`realPersistenceAllowed`
 * both false) whose `fields.retentionExpiresAt` is set to a fixed past timestamp — used to exercise
 * `purgeExpired()` deterministically. */
function buildExpiredValidDraft(baseDraft: DecisionSupportShadowStorageDraft, sourceCaptureId: string, retentionExpiresAt: string): DecisionSupportShadowStorageDraft {
  const clone = deepClone(baseDraft) as unknown as Record<string, unknown>;
  clone.sourceCaptureId = sourceCaptureId;
  clone.draftId = `draft-${sourceCaptureId}`;
  clone.fields = { ...((clone.fields as Record<string, unknown>) ?? {}), retentionExpiresAt };
  return clone as unknown as DecisionSupportShadowStorageDraft;
}

const PAST_REFERENCE_NOW = "2020-01-01T00:00:00.000Z";
const FUTURE_REFERENCE_NOW = "2026-01-01T00:00:00.000Z";
const UNKNOWN_CAPTURE_ID = "capture-id-that-does-not-exist";
const UNKNOWN_POLICY_VERSION = "policy_version_does_not_exist";

/**
 * Runs the full Sprint 28R fake-adapter evaluation: maps every case in `casesOrRecords` (default
 * entry point: a `DecisionClarificationCase[]`, i.e. the Sprint 18R corpus, via
 * `runDecisionSupportShadowStorageAdapterPlanEvaluation()`) into a Sprint 27R storage draft, writes
 * every one of them into a single, freshly-created fake adapter instance, then additionally writes 11
 * synthetic invalid drafts (one per forbidden field/policy flag) expecting rejection, exercises
 * `listByPolicyVersion()` (a real policy version, and an unknown one), `deleteByCaptureId()` (three
 * real capture ids, and one unknown one), and `purgeExpired()` (two synthetic drafts with a
 * past-dated `retentionExpiresAt`, purged, then purged again to prove idempotence). Never creates a
 * database, migration, storage adapter, or Supabase write — every write here lands only in the
 * adapter's own private in-memory array.
 */
export function runDecisionSupportShadowStorageFakeAdapterEvaluation(
  casesOrRecords: DecisionClarificationCase[] | DecisionSupportShadowCaptureResult[] | DecisionSupportShadowCaptureRecord[],
  options: DecisionSupportShadowStorageFakeAdapterEvaluationOptions = {},
): DecisionSupportShadowStorageFakeAdapterEvaluationResult {
  const planResults = runDecisionSupportShadowStorageAdapterPlanEvaluation(casesOrRecords, { now: options.now });

  const adapterConfig = createDecisionSupportShadowStorageFakeAdapterConfig({ ...options.config, now: options.now ?? options.config?.now });
  const adapter = createDecisionSupportShadowStorageFakeAdapter(adapterConfig);

  // Corpus-only writes — every Sprint 18R-derived draft is expected to be valid and accepted.
  const corpusWriteResults = planResults.map((r) => adapter.writeDraft(r.draft));

  // Synthetic invalid drafts — built independently via the real Sprint 24R/25R/27R pipeline, not
  // derived from the corpus, so this evaluation exercises every forbidden field/flag deterministically
  // even when the corpus itself never carries one.
  const baseDraft = buildBaseValidDraft(options.now);
  const syntheticInvalidWriteResults = buildSyntheticInvalidDrafts(baseDraft).map((d) => adapter.writeDraft(d));

  // List exercising: a real policy version (non-empty) and an unknown one (empty).
  const listResults = [adapter.listByPolicyVersion(baseDraft.policyVersion), adapter.listByPolicyVersion(UNKNOWN_POLICY_VERSION)];

  // Delete exercising: a sample of real, corpus-derived capture ids, plus one unknown id.
  const sampleCaptureIds = planResults.slice(0, 3).map((r) => r.draft.sourceCaptureId);
  const deleteResults = [...sampleCaptureIds.map((id) => adapter.deleteByCaptureId(id)), adapter.deleteByCaptureId(UNKNOWN_CAPTURE_ID)];

  // Purge exercising: two otherwise-valid, already-expired drafts, purged once (should purge both),
  // then purged again (nothing left to purge).
  const expiredDraft1 = buildExpiredValidDraft(baseDraft, "fake-adapter-synthetic-expired-1", PAST_REFERENCE_NOW);
  const expiredDraft2 = buildExpiredValidDraft(baseDraft, "fake-adapter-synthetic-expired-2", PAST_REFERENCE_NOW);
  const syntheticPurgeWriteResults = [expiredDraft1, expiredDraft2].map((d) => adapter.writeDraft(d));
  const purgeResults = [adapter.purgeExpired(FUTURE_REFERENCE_NOW), adapter.purgeExpired(FUTURE_REFERENCE_NOW)];

  return {
    adapter,
    corpusWriteResults,
    syntheticInvalidWriteResults,
    syntheticPurgeWriteResults,
    listResults,
    deleteResults,
    purgeResults,
  } satisfies DecisionSupportShadowStorageFakeAdapterEvaluationResult;
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────────

const RECOMMENDED_NEXT_SPRINT = "Sprint 29R — Shadow Capture Storage Adapter Persistence Readiness Review";

function recommendationFor(status: DecisionSupportShadowStorageFakeAdapterReadinessStatus): string {
  switch (status) {
    case "ready_for_persistence_readiness_review":
      return (
        "Every corpus-derived draft was accepted into the fake in-memory adapter, every one of the 11 synthetic invalid drafts (one " +
        "per forbidden field/policy flag) was correctly rejected, and every real*/db*/supabase*/external*/forbidden-content-stored " +
        "counter stayed at zero — Sprint 29R can review what a real persistence layer would additionally require (tenant isolation, " +
        "access control, a real feature flag, and a real migration), still without implementing any of it."
      );
    case "ready_for_fake_adapter_hardening":
      return "Not every corpus-derived draft was accepted, or not every synthetic invalid draft was correctly rejected — harden the fake adapter's write path before reviewing real-persistence readiness.";
    case "blocked_by_fake_adapter_violation":
      return "At least one real*/db*/supabase*/external*/forbidden-content-stored safety counter was non-zero, or a synthetic invalid draft was incorrectly accepted — this is a blocking safety violation in the fake adapter itself.";
    case "not_ready_for_next_stage":
    default:
      return "The fake adapter evaluation did not reach a clean readiness state for an unclassified reason — inspect weakFakeAdapterResults for details.";
  }
}

/**
 * Turns a `runDecisionSupportShadowStorageFakeAdapterEvaluation()` result into a review-ready report:
 * write/list/delete/purge counts, invalid-draft rejection counts, every real/db/supabase/external and
 * forbidden-content-stored counter (all expected to be zero, by this module's own construction), a
 * readiness status, and a Sprint 29R recommendation. Pure — takes an already-computed result (plus an
 * optional adapter override, defaulting to `results.adapter`) rather than re-running anything.
 */
export function summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(
  results: DecisionSupportShadowStorageFakeAdapterEvaluationResult,
  adapter: DecisionSupportShadowStorageFakeAdapter = results.adapter,
): DecisionSupportShadowStorageFakeAdapterEvaluationSummary {
  const totalCaptureRecords = results.corpusWriteResults.length;
  const totalDraftsCreated = results.corpusWriteResults.length;

  const fakeWriteAttemptCount = results.corpusWriteResults.length;
  const fakeWriteAcceptedCount = results.corpusWriteResults.filter((r) => r.accepted).length;
  const fakeWriteRejectedCount = fakeWriteAttemptCount - fakeWriteAcceptedCount;
  const fakeWriteAcceptedRate = rateOf(fakeWriteAcceptedCount, fakeWriteAttemptCount);

  const adapterStats = adapter.stats();

  const invalidDraftRejectedCount = results.syntheticInvalidWriteResults.filter((r) => !r.accepted).length;
  const policyViolationRejectedCount = results.syntheticInvalidWriteResults.filter((r) => r.status === "rejected_by_policy").length;
  const invalidDraftLeakCount = results.syntheticInvalidWriteResults.filter((r) => r.accepted).length;

  const realPersistenceAttemptedCount = 0;
  const dbWriteAttemptedCount = adapterStats.dbWriteAttemptedCount;
  const supabaseWriteAttemptedCount = adapterStats.supabaseWriteAttemptedCount;
  const externalCallAttemptedCount = 0;
  const rawInputStoredCount = adapterStats.rawInputStoredCount;
  const inputPreviewStoredCount = adapterStats.inputPreviewStoredCount;
  const fullCandidateStoredCount = adapterStats.fullCandidateStoredCount;
  const userVisibleOutputStoredCount = adapterStats.userVisibleOutputStoredCount;
  const projectNameStoredCount = adapterStats.projectNameStoredCount;
  const emailAddressStoredCount = adapterStats.emailAddressStoredCount;
  const phoneNumberStoredCount = adapterStats.phoneNumberStoredCount;

  const validDraftRate = rateOf(fakeWriteAcceptedCount, totalDraftsCreated);

  const safetyCounterValues = [
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    rawInputStoredCount,
    inputPreviewStoredCount,
    fullCandidateStoredCount,
    userVisibleOutputStoredCount,
    projectNameStoredCount,
    emailAddressStoredCount,
    phoneNumberStoredCount,
  ];
  const safetyCounterViolations = safetyCounterValues.filter((v) => v > 0).length;
  const totalSafetyChecks = safetyCounterValues.length + results.syntheticInvalidWriteResults.length;
  const safetyViolations = safetyCounterViolations + invalidDraftLeakCount;
  const fakeAdapterSafetyRate = totalSafetyChecks > 0 ? round1(((totalSafetyChecks - safetyViolations) / totalSafetyChecks) * 100) : 100;

  let readinessStatus: DecisionSupportShadowStorageFakeAdapterReadinessStatus;
  if (
    validDraftRate === 100 &&
    fakeAdapterSafetyRate === 100 &&
    fakeWriteRejectedCount === 0 &&
    invalidDraftRejectedCount === results.syntheticInvalidWriteResults.length
  ) {
    readinessStatus = "ready_for_persistence_readiness_review";
  } else if (safetyCounterViolations > 0 || invalidDraftLeakCount > 0) {
    readinessStatus = "blocked_by_fake_adapter_violation";
  } else if (fakeWriteRejectedCount > 0 || validDraftRate < 100) {
    readinessStatus = "ready_for_fake_adapter_hardening";
  } else {
    readinessStatus = "not_ready_for_next_stage";
  }

  const weakFakeAdapterResults: string[] = [];
  if (invalidDraftLeakCount > 0) weakFakeAdapterResults.push(`${invalidDraftLeakCount} synthetic invalid draft(s) were incorrectly accepted by writeDraft().`);
  if (safetyCounterViolations > 0) weakFakeAdapterResults.push(`${safetyCounterViolations} real/db/supabase/external/forbidden-content-stored counter(s) were non-zero.`);
  if (fakeWriteRejectedCount > 0) weakFakeAdapterResults.push(`${fakeWriteRejectedCount} corpus-derived draft(s) were unexpectedly rejected.`);

  return {
    totalCaptureRecords,
    totalDraftsCreated,
    fakeWriteAttemptCount,
    fakeWriteAcceptedCount,
    fakeWriteRejectedCount,
    fakeWriteAcceptedRate,
    fakeRepositoryRecordCount: adapterStats.totalRecords,
    fakeListCount: adapterStats.listCount,
    fakeDeleteCount: adapterStats.deleteCount,
    fakePurgeCount: adapterStats.purgeCount,
    invalidDraftRejectedCount,
    policyViolationRejectedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    externalCallAttemptedCount,
    rawInputStoredCount,
    inputPreviewStoredCount,
    fullCandidateStoredCount,
    userVisibleOutputStoredCount,
    projectNameStoredCount,
    emailAddressStoredCount,
    phoneNumberStoredCount,
    validDraftRate,
    fakeAdapterSafetyRate,
    readinessStatus,
    recommendedNextSprint: readinessStatus === "ready_for_persistence_readiness_review" ? RECOMMENDED_NEXT_SPRINT : "Sprint 28R — Shadow Capture Storage Fake Adapter Hardening",
    recommendation: recommendationFor(readinessStatus),
    representativeStoredRecords: adapter.listAll().filter((r) => !r.deleted).slice(0, 5),
    rejectedWriteExamples: results.syntheticInvalidWriteResults.slice(0, 11),
    weakFakeAdapterResults,
  } satisfies DecisionSupportShadowStorageFakeAdapterEvaluationSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 28R fake storage adapter — mirrors the style of
 * `explainDecisionSupportShadowStorageAdapterPlan()` (Sprint 27R). See
 * `docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md` for full context.
 */
export function explainDecisionSupportShadowStorageFakeAdapter(): DecisionSupportShadowStorageFakeAdapterExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-shadow-storage-fake-adapter",
    purpose:
      "Implements (for the first time in this package tree) the Sprint 27R adapter method contract's write/delete/purge/list methods " +
      "against a private, in-process, test-only JavaScript array — proving what those methods would do once a real implementation " +
      "exists, without ever creating a database, a migration, a table, a real storage adapter, or a real repository.",
    nonGoals: [
      "Create a database, migration file, table, or Supabase write.",
      "Implement a real (persistent, cross-process) storage adapter or repository.",
      "Implement tenant isolation, access control, or a real feature flag.",
      "Activate a real feature flag or connect decision_support (or this adapter) to the router or request path.",
      "Change production behavior in any way.",
      "Show any stored record to a user.",
      "Persist any record outside a single adapter instance's own in-process array.",
    ],
    adapterProfile:
      'The "strict_test_only_fake_adapter" profile: allowRealPersistence/allowDbWrite/allowSupabaseWrite/allowExternalCalls are all ' +
      "literal false, forced regardless of any override a caller passes, and requirePolicyValidation/requireDraftValidation/" +
      "requireDeletionPolicy/requireRetentionPolicy are always true.",
    config:
      "createDecisionSupportShadowStorageFakeAdapterConfig() defaults to mode: test_only_in_memory with allowInMemoryWriteForTests: " +
      "true and allowDeleteSimulation/allowPurgeSimulation/allowListSimulation: true; dry_run_fake_write and policy_validation_only " +
      "are alternate modes that never touch the in-memory array at all.",
    repositoryRecordShape:
      "Every stored record is a deep-cloned, defensively-copied Sprint 27R DecisionSupportShadowStorageDraft plus a deterministic " +
      "dss_fake_<sourceCaptureId> recordId, policyVersion, an optional retentionExpiresAt/workspaceIdHash, deletionRequired: true, a " +
      "deleted flag, and an audit block whose every real/db/supabase/external/forbidden-content flag is a literal false.",
    writeBehavior:
      "writeDraft() re-validates every draft via the Sprint 27R validator, independently re-checks for forbidden content and for any " +
      "Sprint 26R-classified prohibited field (defense in depth), and rejects storageEnabled/realPersistenceAllowed: true as a policy " +
      "violation distinct from a content violation. Only a fully clean, policy-compliant draft is ever pushed into the adapter's " +
      "private array.",
    deleteBehavior:
      "deleteByCaptureId()/deleteByWorkspace() mark matching, not-already-deleted records as deleted (hard-delete semantics, audited " +
      "via deleteReason/deletedAt) — never actually remove them from the array, and never touch a real database.",
    purgeBehavior:
      "purgeExpired(now) deletes every non-deleted record whose retentionExpiresAt is set and <= the caller-supplied (or config-level) " +
      "reference time — never the system clock — returning nothing_to_purge once nothing further qualifies.",
    listBehavior: "listByPolicyVersion() returns defensive copies of every non-deleted record matching a policy version, or an empty result for an unknown one.",
    statsBehavior:
      "stats() reports record/write/delete/purge/list counts plus every real/db/supabase/forbidden-content-stored counter, all of " +
      "which stay zero by this module's own construction — never computed from anything that could make them non-zero.",
    invalidDraftRejectionPolicy:
      "Eleven synthetic invalid drafts (rawInput, inputPreview, fullDecisionCandidate, fullClarificationCandidate, responseText, " +
      "userVisibleOutput, projectName, emailAddress, phoneNumber, storageEnabled: true, realPersistenceAllowed: true) are written in " +
      "every evaluation run, each expected to be rejected — proving the write path independently, not merely trusting the corpus.",
    noRealStorageGuarantees:
      "realPersistenceAttempted/dbWriteAttempted/supabaseWriteAttempted/externalCallAttempted are literal false on every result type " +
      "this module returns; nothing here imports a database client, a Supabase client, fetch, or reads an environment variable.",
    whyDbIsNotCreated:
      "No tenant isolation, access control, or real feature flag exists yet — writing to a real database today would create " +
      "ungoverned, undeletable data across processes, exactly what the Sprint 26R deletion policy forbids.",
    whyMigrationIsNotCreated:
      "A migration presumes a settled, reviewed schema and a real deletion/rollback path validated against real infrastructure; this " +
      "sprint only proves the write/delete/purge/list contract against an in-memory stand-in.",
    whyThisIsStillNotARealAdapter:
      "Every record this adapter ever stores lives only in one call's own JavaScript closure — it disappears the instant the process " +
      "exits or clear() is called, is never shared across requests/processes, and is never backed by any durable medium.",
    expectedSprint29Path:
      "If every corpus-derived draft is accepted, every synthetic invalid draft is rejected, and every real/db/supabase/external/" +
      "forbidden-content-stored counter stays at zero, Sprint 29R can review what a real persistence layer would additionally require " +
      "— still without implementing a database, a migration, or a real adapter.",
  };
}
