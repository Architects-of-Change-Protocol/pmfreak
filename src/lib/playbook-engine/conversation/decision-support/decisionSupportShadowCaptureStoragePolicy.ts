/**
 * Sprint 26R — Decision Support Shadow Capture Storage Policy / Default-Off Persistence Plan.
 *
 * A pure, offline, deterministic **policy** module: it classifies every field a Sprint 25R
 * `DecisionSupportShadowCaptureRecord` could ever carry into a future persistent store (allowed,
 * prohibited, or requires-explicit-exception), models a strict retention policy and a strict deletion
 * policy, and assembles a "default-off persistence plan" that *names* (never implements) a future
 * feature flag. It also assesses real Sprint 25R capture records — produced via the reused
 * `runDecisionSupportShadowCaptureHarnessEvaluation()` — against that policy to prove the harness's
 * output is storage-clean today.
 *
 * This is **policy/planning/evaluation**, not storage implementation: no database client, no
 * Supabase client, no migration, no storage adapter, no feature-flag read, and no router/composer/
 * handler/endpoint import exists anywhere in this module. See
 * `docs/conversational-brain-decision-support-shadow-storage-policy.md` for the full design writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import {
  captureDecisionSupportShadowRun,
  createInMemoryDecisionSupportShadowCaptureSink,
  runDecisionSupportShadowCaptureHarnessEvaluation,
} from "./decisionSupportShadowCaptureHarness";
import type { DecisionSupportShadowCaptureResult } from "./decisionSupportShadowCaptureHarnessTypes";
import { prepareDecisionSupportShadowModeRun } from "./decisionSupportShadowModePrep";

import type {
  DecisionSupportShadowStorageCaptureRecordLike,
  DecisionSupportShadowStorageDefaultOffPersistencePlan,
  DecisionSupportShadowStorageDeletionPolicy,
  DecisionSupportShadowStorageFieldAssessment,
  DecisionSupportShadowStorageFieldCategory,
  DecisionSupportShadowStorageFieldDecision,
  DecisionSupportShadowStorageFieldPolicy,
  DecisionSupportShadowStorageFieldRisk,
  DecisionSupportShadowStorageNextSprintRecommendation,
  DecisionSupportShadowStorageObservedValueKind,
  DecisionSupportShadowStoragePolicyEvaluationOptions,
  DecisionSupportShadowStoragePolicyEvaluationSummary,
  DecisionSupportShadowStoragePolicyExplain,
  DecisionSupportShadowStoragePolicyMode,
  DecisionSupportShadowStoragePolicyProfile,
  DecisionSupportShadowStorageReadinessGate,
  DecisionSupportShadowStorageReadinessGateResult,
  DecisionSupportShadowStorageReadinessStatus,
  DecisionSupportShadowStorageRecordAssessment,
  DecisionSupportShadowStorageRetentionPolicy,
} from "./decisionSupportShadowCaptureStoragePolicyTypes";

export type {
  DecisionSupportShadowStoragePolicyProfile,
  DecisionSupportShadowStoragePolicyMode,
  DecisionSupportShadowStorageFieldCategory,
  DecisionSupportShadowStorageFieldDecision,
  DecisionSupportShadowStorageFieldRisk,
  DecisionSupportShadowStorageFieldPolicy,
  DecisionSupportShadowStorageRetentionMode,
  DecisionSupportShadowStorageDeletionTrigger,
  DecisionSupportShadowStorageRetentionPolicy,
  DecisionSupportShadowStorageDeletionPolicy,
  DecisionSupportShadowStorageReadinessGate,
  DecisionSupportShadowStorageReadinessGateSeverity,
  DecisionSupportShadowStorageReadinessGateResult,
  DecisionSupportShadowStorageDefaultOffPersistencePlan,
  DecisionSupportShadowStorageObservedValueKind,
  DecisionSupportShadowStorageCaptureRecordLike,
  DecisionSupportShadowStorageFieldAssessment,
  DecisionSupportShadowStorageRecordAssessment,
  DecisionSupportShadowStorageReadinessStatus,
  DecisionSupportShadowStorageNextSprintRecommendation,
  DecisionSupportShadowStoragePolicyEvaluationOptions,
  DecisionSupportShadowStoragePolicyEvaluationSummary,
  DecisionSupportShadowStoragePolicyExplain,
} from "./decisionSupportShadowCaptureStoragePolicyTypes";

export const DECISION_SUPPORT_SHADOW_STORAGE_POLICY_VERSION = "26R.1.0";

const REQUIRED_FEATURE_FLAG_NAME = "ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE" as const;

// ─── Field classification table ────────────────────────────────────────────────────────

type FieldPolicySeed = Omit<DecisionSupportShadowStorageFieldPolicy, "requiredTransformations" | "allowedInFuturePersistentStorage" | "allowedInTestMemoryOnly" | "prohibitedAlways">;

const ALLOWED_IN_FUTURE_PERSISTENT_STORAGE: ReadonlySet<DecisionSupportShadowStorageFieldDecision> = new Set([
  "allowed",
  "allowed_with_hashing",
  "allowed_with_redaction",
  "allowed_with_minimization",
  "allowed_only_future_default_off",
]);

function requiredTransformationsFor(decision: DecisionSupportShadowStorageFieldDecision): string[] {
  switch (decision) {
    case "allowed":
      return [];
    case "allowed_with_hashing":
      return ["Hash before persisting — never store the raw value."];
    case "allowed_with_redaction":
      return ["Redact potentially sensitive substrings before persisting."];
    case "allowed_with_minimization":
      return ["Reduce to structural counts/labels only — never persist full text."];
    case "allowed_only_test_memory":
      return ["Restrict to in-process, test-only memory — never write to real storage."];
    case "allowed_only_future_default_off":
      return ["Gate behind the future default-off feature flag before persisting."];
    case "requires_explicit_policy_exception":
      return ["Obtain an explicit, documented policy exception before any persistence."];
    case "prohibited":
      return ["Never persist under any circumstance."];
    default:
      return [];
  }
}

function finalizeFieldPolicy(seed: FieldPolicySeed): DecisionSupportShadowStorageFieldPolicy {
  return {
    ...seed,
    requiredTransformations: requiredTransformationsFor(seed.decision),
    allowedInFuturePersistentStorage: ALLOWED_IN_FUTURE_PERSISTENT_STORAGE.has(seed.decision),
    allowedInTestMemoryOnly: seed.decision !== "prohibited",
    prohibitedAlways: seed.decision === "prohibited",
  };
}

/**
 * Known-good capture-record fields — everything `decisionSupportShadowCaptureHarness.ts` actually
 * puts on a `DecisionSupportShadowCaptureRecord`/`DecisionSupportShadowCaptureResult`, plus the
 * boolean side-effect flags that mirror the harness's own safety snapshot. None of these ever carry
 * raw input, full candidate text, or user-visible output — see the harness's minimization policy.
 */
const ALLOWED_FIELD_SEEDS: FieldPolicySeed[] = [
  { fieldName: "captureId", category: "identity", decision: "allowed", risk: "low", reason: "A deterministic, opaque capture identifier — never derived from or containing sensitive content." },
  { fieldName: "sourceRunId", category: "identity", decision: "allowed_with_hashing", risk: "medium", reason: "Correlates a capture to its source shadow-mode run; hashing avoids leaking any identifier structure tied to a specific conversation." },
  { fieldName: "generatedAt", category: "audit", decision: "allowed", risk: "low", reason: "A timestamp, injected by the caller — carries no user content." },
  { fieldName: "mode", category: "operational_metadata", decision: "allowed", risk: "low", reason: "The capture mode (dry_run / test_only_in_memory) — operational metadata only." },
  { fieldName: "sinkKind", category: "operational_metadata", decision: "allowed", risk: "low", reason: "Which sink (if any) received the record — operational metadata only." },
  { fieldName: "inputHash", category: "input", decision: "allowed_with_hashing", risk: "low", reason: "A stable, local, non-cryptographic hash of the raw input — never reveals or reconstructs the original text." },
  { fieldName: "inputPreview", category: "input", decision: "requires_explicit_policy_exception", risk: "high", reason: "A sanitized/truncated/redacted preview of user text — still derived from real PM conversation content. Not allowed in future persistent storage by default; allowed only in test memory, and only with an explicit, documented policy exception for any real persistence." },
  { fieldName: "rawInputRetained", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — persisting it (always false today) documents that raw input was NOT retained; the flag itself carries no content." },
  { fieldName: "fullDecisionCandidateRetained", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag documenting that the full decision candidate text was NOT retained." },
  { fieldName: "fullClarificationCandidateRetained", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag documenting that the full clarification candidate text was NOT retained." },
  { fieldName: "userVisibleOutputRetained", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag documenting that no user-visible output was retained." },
  { fieldName: "architectureCategory", category: "routing", decision: "allowed", risk: "low", reason: "A closed-vocabulary architecture-review label — never free text." },
  { fieldName: "desiredFutureRoute", category: "routing", decision: "allowed", risk: "low", reason: "A closed-vocabulary future-route label — never free text." },
  { fieldName: "targetKind", category: "routing", decision: "allowed", risk: "low", reason: "A closed-vocabulary target-kind label — never free text." },
  { fieldName: "sourceStatus", category: "routing", decision: "allowed", risk: "low", reason: "The Sprint 24R shadow-mode-run status — a closed-vocabulary label." },
  { fieldName: "sourceCandidateKind", category: "routing", decision: "allowed", risk: "low", reason: "Which candidate kind (if any) the source run produced — a closed-vocabulary label." },
  { fieldName: "captureStatus", category: "operational_metadata", decision: "allowed", risk: "low", reason: "The capture harness's own status label — operational metadata only." },
  { fieldName: "candidateSummary", category: "candidate_summary", decision: "allowed_with_minimization", risk: "medium", reason: "Structural counts/levels/labels only (option counts, confidence, missing slots, route-option intents, question counts) — never the full recommendation/response text. Medium risk because it is still derived from message content, even though minimized." },
  { fieldName: "safetySnapshot", category: "safety", decision: "allowed", risk: "low", reason: "A fixed bag of literal-false safety flags plus one boolean carried from the source run — no content." },
  { fieldName: "gateResults", category: "audit", decision: "allowed_with_minimization", risk: "medium", reason: "Gate name/passed/severity/reason strings — the `reason` strings are static, developer-authored text, but should still be minimized (kept as-is, not extended with any user content) before persistence." },
  { fieldName: "warnings", category: "audit", decision: "allowed_with_redaction", risk: "medium", reason: "Warning strings mostly describe gate failures, but any warning that ever echoes part of the input must be redacted before persistence." },
  { fieldName: "auditMetadata", category: "audit", decision: "allowed", risk: "low", reason: "Version/strategy-source/policy labels and literal-false integration flags — no user content." },
  { fieldName: "allBlockingGatesPassed", category: "safety", decision: "allowed", risk: "low", reason: "A boolean summary of whether every blocking capture gate passed — no content." },
  { fieldName: "dbWriteAttempted", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — must always observe as false; true is a policy violation, not a storage concern about the flag itself." },
  { fieldName: "supabaseWriteAttempted", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — must always observe as false; true is a policy violation." },
  { fieldName: "shouldExecuteAction", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — must always observe as false; true is a policy violation." },
  { fieldName: "shouldSendEmail", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — must always observe as false; true is a policy violation." },
  { fieldName: "shouldCreateTask", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — must always observe as false; true is a policy violation." },
  { fieldName: "shouldWriteToDb", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — must always observe as false; true is a policy violation." },
  { fieldName: "shouldReturnCandidateToUser", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — must always observe as false; true is a policy violation." },
  { fieldName: "shouldPersistShadowResult", category: "safety", decision: "allowed", risk: "low", reason: "A boolean safety flag — must always observe as false; true is a policy violation." },
];

/**
 * Fields that must never reach a capture record, and never reach any future persistent store, under
 * any circumstance — raw/full/user-facing text, and direct personal-contact fields. Matched by exact
 * field name; see `classifyDecisionSupportShadowStorageField()` for the additional dynamic rules
 * (fields ending in `Raw`, containing `full`+`candidate`, or containing `responseText`).
 */
const PROHIBITED_FIELD_SEEDS: FieldPolicySeed[] = [
  { fieldName: "rawInput", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw user input — the exact content the capture harness's minimization policy exists to avoid retaining." },
  { fieldName: "input", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Unlabeled raw input — same risk as rawInput." },
  { fieldName: "fullInput", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Full raw input — same risk as rawInput." },
  { fieldName: "prompt", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "The user's raw prompt text." },
  { fieldName: "originalUserText", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Explicitly the original, unminimized user text." },
  { fieldName: "fullDecisionCandidate", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "The complete Sprint 19R decision candidate, including recommendation text — only its structural summary is ever allowed." },
  { fieldName: "fullClarificationCandidate", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "The complete Sprint 22R clarification candidate, including response text — only its structural summary is ever allowed." },
  { fieldName: "decisionCandidate.responseText", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Full decision candidate response text." },
  { fieldName: "decisionCandidate.recommendationText", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Full decision candidate recommendation text." },
  { fieldName: "decisionCandidate.fullRecommendation", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Full decision candidate recommendation payload." },
  { fieldName: "clarificationCandidate.responseText", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Full clarification candidate response text." },
  { fieldName: "userVisibleOutput", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Anything ever shown to a user — this capture harness never shows anything to a user, and storage must not either." },
  { fieldName: "emailAddress", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Direct personal-contact information." },
  { fieldName: "phoneNumber", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Direct personal-contact information." },
  { fieldName: "projectName", category: "prohibited_sensitive", decision: "prohibited", risk: "high", reason: "Identifies a specific customer/workspace project by name — a re-identification risk even without message content." },
  { fieldName: "conversationMessages", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw conversation history." },
  { fieldName: "recentMessages", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw recent conversation history." },
  { fieldName: "attachedContextRaw", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw attached context of unknown sensitivity." },
  { fieldName: "rawEvidence", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw evidence text supplied as decision-support context." },
  { fieldName: "rawEmailBody", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw email content." },
  { fieldName: "rawMeetingTranscript", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw meeting transcript content." },
  { fieldName: "rawDocumentContent", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw document content." },
  { fieldName: "rawCustomerData", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Raw customer data of unspecified shape." },
  { fieldName: "responseText", category: "prohibited_sensitive", decision: "prohibited", risk: "critical", reason: "Generic full response text — the same risk as fullDecisionCandidate/fullClarificationCandidate response fields." },
];

const FIELD_POLICY_TABLE: ReadonlyMap<string, DecisionSupportShadowStorageFieldPolicy> = new Map(
  [...ALLOWED_FIELD_SEEDS, ...PROHIBITED_FIELD_SEEDS].map((seed) => [seed.fieldName, finalizeFieldPolicy(seed)]),
);

function clonePolicy(policy: DecisionSupportShadowStorageFieldPolicy): DecisionSupportShadowStorageFieldPolicy {
  return { ...policy, requiredTransformations: [...policy.requiredTransformations] };
}

// ─── Field classification ───────────────────────────────────────────────────────────────

/**
 * Deterministically classifies a field name into a `DecisionSupportShadowStorageFieldPolicy`. Looks
 * up the known-field table first; falls back to three dynamic prohibition rules (a name ending in
 * `"Raw"`, containing `"responseText"`, or containing both `"full"` and `"candidate"`); otherwise
 * defaults to `"requires_explicit_policy_exception"` (an unrecognized field is never silently
 * allowed). `value` is accepted for future observation-based auditing but never changes the
 * classification — classification is a pure function of `fieldName` alone.
 */
export function classifyDecisionSupportShadowStorageField(fieldName: string, _value?: unknown): DecisionSupportShadowStorageFieldPolicy {
  const known = FIELD_POLICY_TABLE.get(fieldName);
  if (known) return clonePolicy(known);

  if (/Raw$/.test(fieldName)) {
    return finalizeFieldPolicy({
      fieldName,
      category: "prohibited_sensitive",
      decision: "prohibited",
      risk: "critical",
      reason: `Field name "${fieldName}" ends with "Raw" — treated as raw/unprocessed sensitive content and prohibited by default.`,
    });
  }

  if (/responseText/i.test(fieldName)) {
    return finalizeFieldPolicy({
      fieldName,
      category: "prohibited_sensitive",
      decision: "prohibited",
      risk: "critical",
      reason: `Field name "${fieldName}" contains "responseText" — treated as full candidate/user-facing text and prohibited by default.`,
    });
  }

  if (/full/i.test(fieldName) && /candidate/i.test(fieldName)) {
    return finalizeFieldPolicy({
      fieldName,
      category: "prohibited_sensitive",
      decision: "prohibited",
      risk: "critical",
      reason: `Field name "${fieldName}" references a full candidate — treated as un-minimized candidate text and prohibited by default.`,
    });
  }

  return finalizeFieldPolicy({
    fieldName,
    category: "operational_metadata",
    decision: "requires_explicit_policy_exception",
    risk: "high",
    reason: `Field name "${fieldName}" is not in the known-field policy table — no classification exists yet, so it defaults to requiring an explicit, documented policy exception before any persistence.`,
  });
}

/** Returns the full, known-field policy table (allowed + prohibited seeds) as fresh objects. */
export function listDecisionSupportShadowStorageFieldPolicies(): DecisionSupportShadowStorageFieldPolicy[] {
  return [...FIELD_POLICY_TABLE.values()].map(clonePolicy);
}

// ─── Retention / deletion policy ────────────────────────────────────────────────────────

/**
 * The current-sprint retention policy: `ephemeral_only`, zero retention days — nothing is persisted
 * outside a test-only, in-process array. Documents (in `notes`, never in the numeric fields
 * themselves) the *future* default-off prototype proposal of 7/30 days, gated on prerequisites this
 * sprint does not implement.
 */
export function createDecisionSupportShadowStorageRetentionPolicy(): DecisionSupportShadowStorageRetentionPolicy {
  return {
    retentionMode: "ephemeral_only",
    defaultRetentionDays: 0,
    maximumRetentionDays: 0,
    deletionRequired: true,
    deletionTrigger: "ttl_expiry",
    requiresDeletionAudit: true,
    notes: [
      "Current sprint (26R): retentionMode is ephemeral_only, defaultRetentionDays and maximumRetentionDays are both 0 — nothing is persisted outside the Sprint 25R in-memory, test-only sink.",
      "A future default-off storage prototype could propose defaultRetentionDays: 7 / maximumRetentionDays: 30 — but only once a real feature flag exists (default off), a storage adapter exists, a deletion job exists, a policy version is stored alongside every record, tenant isolation exists, and an admin purge path exists.",
      "persistenceDefaultEnabled stays false regardless of any future retention-day proposal — retention days only matter once persistence is explicitly, deliberately turned on.",
    ],
  };
}

/**
 * The deletion policy: hard delete only (no soft delete), deletable by capture id, workspace, and
 * policy version, with deletion-audit metadata retained (never full record content). Documents that
 * any raw payload or full candidate ever appearing in storage by a future bug must be purged.
 */
export function createDecisionSupportShadowStorageDeletionPolicy(): DecisionSupportShadowStorageDeletionPolicy {
  return {
    hardDeleteRequired: true,
    softDeleteAllowed: false,
    deletionAuditMetadataOnly: true,
    deleteByCaptureIdRequired: true,
    deleteByWorkspaceRequired: true,
    deleteByPolicyVersionRequired: true,
    deleteRawPayloadIfEverIntroduced: true,
    notes: [
      "If any raw payload (rawInput, prompt, conversationMessages, etc.) ever appears in a persisted record due to a future bug, it must be purged — not merely soft-deleted or flagged.",
      "If any full candidate (fullDecisionCandidate, fullClarificationCandidate, any *responseText field) ever appears in a persisted record due to a future bug, it must be purged the same way.",
      "Deletion must be testable before a storage prototype exists — a purge path (by capture id, by workspace, and by policy version) must exist before any real persistence is implemented, not added afterward.",
      "Deletion audit records may retain only metadata (which capture id, which workspace, when, by what trigger) — never the deleted record's own content.",
    ],
  };
}

// ─── Policy profile / default-off persistence plan ──────────────────────────────────────

type CorePolicyProfileFields = {
  profile: DecisionSupportShadowStoragePolicyProfile;
  mode: DecisionSupportShadowStoragePolicyMode;
  persistenceDefaultEnabled: false;
  requiresFeatureFlag: true;
  requiredFeatureFlagName: typeof REQUIRED_FEATURE_FLAG_NAME;
  featureFlagDefault: false;
  storageAdapterImplemented: false;
  dbMigrationImplemented: false;
  supabaseWriteImplemented: false;
  productionRouteChanged: false;
};

function buildCorePolicyProfileFields(mode: DecisionSupportShadowStoragePolicyMode): CorePolicyProfileFields {
  return {
    profile: "strict_default_off",
    mode,
    persistenceDefaultEnabled: false,
    requiresFeatureFlag: true,
    requiredFeatureFlagName: REQUIRED_FEATURE_FLAG_NAME,
    featureFlagDefault: false,
    storageAdapterImplemented: false,
    dbMigrationImplemented: false,
    supabaseWriteImplemented: false,
    productionRouteChanged: false,
  };
}

/**
 * Returns the strict `"strict_default_off"` policy profile's core fields — persistence stays
 * disabled by default, a feature flag is required (named but not implemented), and no storage
 * adapter/migration/Supabase write exists.
 */
export function createDecisionSupportShadowStoragePolicyProfile(mode: DecisionSupportShadowStoragePolicyMode = "policy_only"): CorePolicyProfileFields {
  return buildCorePolicyProfileFields(mode);
}

const ALL_READINESS_GATES: DecisionSupportShadowStorageReadinessGate[] = [
  "storage_default_off",
  "no_db_migration",
  "no_storage_adapter",
  "no_supabase_write",
  "no_raw_input",
  "no_full_candidate",
  "no_user_visible_output",
  "input_hash_only",
  "input_preview_policy",
  "candidate_summary_only",
  "retention_policy_defined",
  "deletion_policy_defined",
  "tenant_isolation_required",
  "access_control_required",
  "feature_flag_required",
  "audit_metadata_required",
  "policy_version_required",
  "capture_harness_clean",
  "shadow_mode_clean",
  "adapter_unchanged",
  "router_unchanged",
];

type ReadinessGateParams = {
  captureHarnessClean: boolean;
  shadowModeClean: boolean;
  assumeFuturePrerequisitesSatisfied: boolean;
};

function computeReadinessGates(params: ReadinessGateParams): DecisionSupportShadowStorageReadinessGateResult[] {
  const { captureHarnessClean, shadowModeClean, assumeFuturePrerequisitesSatisfied } = params;
  const futurePrereq = assumeFuturePrerequisitesSatisfied;

  const gates: DecisionSupportShadowStorageReadinessGateResult[] = [
    {
      gate: "storage_default_off",
      passed: true,
      severity: "blocking",
      reason: "persistenceDefaultEnabled is a literal false — no real storage is enabled by default.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "no_db_migration",
      passed: true,
      severity: "blocking",
      reason: "No database migration file exists or is created by this module.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "no_storage_adapter",
      passed: true,
      severity: "blocking",
      reason: "No storage adapter/repository implementation exists — storageAdapterImplemented is a literal false.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "no_supabase_write",
      passed: true,
      severity: "blocking",
      reason: "No Supabase client is imported or called — supabaseWriteImplemented is a literal false.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "no_raw_input",
      passed: captureHarnessClean,
      severity: "blocking",
      reason: captureHarnessClean
        ? "Every evaluated Sprint 25R capture record carries rawInputRetained: false."
        : "At least one evaluated capture record retained raw input.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "no_full_candidate",
      passed: captureHarnessClean,
      severity: "blocking",
      reason: captureHarnessClean
        ? "Every evaluated Sprint 25R capture record carries fullDecisionCandidateRetained/fullClarificationCandidateRetained: false."
        : "At least one evaluated capture record retained a full candidate.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "no_user_visible_output",
      passed: captureHarnessClean,
      severity: "blocking",
      reason: captureHarnessClean
        ? "Every evaluated Sprint 25R capture record carries userVisibleOutputRetained: false."
        : "At least one evaluated capture record retained user-visible output.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "input_hash_only",
      passed: true,
      severity: "warning",
      reason: 'Only inputHash (a local, non-cryptographic hash) is allowed in future persistent storage by default; inputPreview is not.',
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "input_preview_policy",
      passed: true,
      severity: "warning",
      reason: "inputPreview is classified requires_explicit_policy_exception — this plan does not propose persisting it, so nothing is blocked; any future exception request would need separate, explicit review.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "candidate_summary_only",
      passed: true,
      severity: "blocking",
      reason: "Only the minimized candidateSummary is ever a persistence candidate — full decision/clarification candidate text is prohibited.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "retention_policy_defined",
      passed: true,
      severity: "blocking",
      reason: "createDecisionSupportShadowStorageRetentionPolicy() always returns a defined retention policy.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "deletion_policy_defined",
      passed: true,
      severity: "blocking",
      reason: "createDecisionSupportShadowStorageDeletionPolicy() always returns a defined deletion policy.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "tenant_isolation_required",
      passed: futurePrereq,
      severity: "warning",
      reason: futurePrereq
        ? "Tenant/project isolation is modeled as satisfied in this test-only scenario."
        : "No tenant/project isolation mechanism exists yet for shadow capture storage — required before any real storage implementation.",
      requiredBeforeStorageImplementation: true,
    },
    {
      gate: "access_control_required",
      passed: futurePrereq,
      severity: "warning",
      reason: futurePrereq
        ? "Access control is modeled as satisfied in this test-only scenario."
        : "No access-control mechanism exists yet for shadow capture storage — required before any real storage implementation.",
      requiredBeforeStorageImplementation: true,
    },
    {
      gate: "feature_flag_required",
      passed: futurePrereq,
      severity: "warning",
      reason: futurePrereq
        ? "A real, default-off feature flag is modeled as implemented in this test-only scenario."
        : `The future flag "${REQUIRED_FEATURE_FLAG_NAME}" is only named by this plan, not implemented — required before any real storage implementation.`,
      requiredBeforeStorageImplementation: true,
    },
    {
      gate: "audit_metadata_required",
      passed: true,
      severity: "blocking",
      reason: "Every Sprint 25R capture record already carries auditMetadata — the audit trail this policy relies on already exists.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "policy_version_required",
      passed: futurePrereq,
      severity: "warning",
      reason: futurePrereq
        ? "Policy version tracking is modeled as satisfied in this test-only scenario."
        : "No stored/queryable policy-version field exists yet on any persisted record — required before any real storage implementation.",
      requiredBeforeStorageImplementation: true,
    },
    {
      gate: "capture_harness_clean",
      passed: captureHarnessClean,
      severity: "blocking",
      reason: captureHarnessClean
        ? "Sprint 25R shadow capture harness metrics are clean (100% acceptable, zero retention/side-effect violations)."
        : "Sprint 25R shadow capture harness metrics are not clean — fix before designing storage.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "shadow_mode_clean",
      passed: shadowModeClean,
      severity: "blocking",
      reason: shadowModeClean
        ? "Sprint 24R shadow mode prep metrics are clean (100% acceptable, zero blocked-by-safety-gate runs)."
        : "Sprint 24R shadow mode prep metrics are not clean — fix before designing storage.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "adapter_unchanged",
      passed: true,
      severity: "info",
      reason: "This module does not import intentCompatibilityAdapter.ts.",
      requiredBeforeStorageImplementation: false,
    },
    {
      gate: "router_unchanged",
      passed: true,
      severity: "info",
      reason: "This module does not import brainRouter.ts, responseComposer.ts, any handlers/*.ts, or conversationalBrainGateway.ts.",
      requiredBeforeStorageImplementation: false,
    },
  ];

  return gates;
}

export type DecisionSupportShadowStorageDefaultOffPersistencePlanOptions = {
  mode?: DecisionSupportShadowStoragePolicyMode;
  /** Whether the Sprint 25R capture harness's own metrics are clean; defaults to true (this
   * sprint reuses Sprint 25R's harness, which is documented clean). Callers evaluating a live
   * corpus should pass the freshly-computed value instead of relying on the default. */
  captureHarnessClean?: boolean;
  /** Whether the Sprint 24R shadow mode prep's own metrics are clean; defaults to true, same
   * rationale as `captureHarnessClean`. */
  shadowModeClean?: boolean;
  /** Test-only: when true, models tenant isolation / access control / the feature flag / policy
   * versioning as already satisfied, to exercise the `ready_for_default_off_storage_prototype`
   * readiness status. Never set true by this sprint's own default plan. */
  assumeFuturePrerequisitesSatisfied?: boolean;
};

/**
 * Assembles the full Sprint 26R default-off persistence plan: the strict policy profile, every known
 * field's classification bucketed into allowed/prohibited/exception-required, the retention policy,
 * the deletion policy, and every readiness gate. `persistenceDefaultEnabled`, `storageAdapterImplemented`,
 * `dbMigrationImplemented`, and `supabaseWriteImplemented` are always `false` — this function only
 * ever *plans*, never implements, persistence.
 */
export function createDecisionSupportShadowDefaultOffPersistencePlan(
  options: DecisionSupportShadowStorageDefaultOffPersistencePlanOptions = {},
): DecisionSupportShadowStorageDefaultOffPersistencePlan {
  const core = buildCorePolicyProfileFields(options.mode ?? "policy_only");
  const allFieldPolicies = listDecisionSupportShadowStorageFieldPolicies();

  const allowedFields = allFieldPolicies.filter((f) => ALLOWED_IN_FUTURE_PERSISTENT_STORAGE.has(f.decision));
  const prohibitedFields = allFieldPolicies.filter((f) => f.decision === "prohibited");
  const exceptionRequiredFields = allFieldPolicies.filter(
    (f) => f.decision === "requires_explicit_policy_exception" || f.decision === "allowed_only_test_memory",
  );

  const retentionPolicy = createDecisionSupportShadowStorageRetentionPolicy();
  const deletionPolicy = createDecisionSupportShadowStorageDeletionPolicy();

  const readinessGates = computeReadinessGates({
    captureHarnessClean: options.captureHarnessClean ?? true,
    shadowModeClean: options.shadowModeClean ?? true,
    assumeFuturePrerequisitesSatisfied: options.assumeFuturePrerequisitesSatisfied ?? false,
  });

  return {
    kind: "decision_support_shadow_storage_policy_plan",
    ...core,
    allowedFields,
    prohibitedFields,
    exceptionRequiredFields,
    retentionPolicy,
    deletionPolicy,
    readinessGates,
    warnings: [
      "inputPreview requires an explicit policy exception before any future persistent storage — none is granted by this plan.",
      `Real persistence requires implementing (not just naming) the "${REQUIRED_FEATURE_FLAG_NAME}" feature flag, default off.`,
      "Tenant isolation, access control, and policy-version storage are named prerequisites this sprint does not implement.",
    ],
    limitations: [
      "This is a policy/plan, not a storage implementation — no database, migration, storage adapter, or Supabase write exists.",
      "No real feature flag is created or read — requiredFeatureFlagName only documents the future flag's name.",
      "Reuses the Sprint 25R capture harness and Sprint 24R shadow mode prep exactly as-is; does not harden either.",
      "Does not decide whether/how a capture record should ever reach a user — that remains explicitly out of scope.",
    ],
  } satisfies DecisionSupportShadowStorageDefaultOffPersistencePlan;
}

// ─── Record assessment ───────────────────────────────────────────────────────────────────

const KNOWN_RECORD_FIELD_NAMES = ALLOWED_FIELD_SEEDS.map((s) => s.fieldName);

function kindOf(fieldName: string, value: unknown): DecisionSupportShadowStorageObservedValueKind {
  if (value === undefined) return "absent";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object" && value !== null) {
    return fieldName === "candidateSummary" || fieldName === "safetySnapshot" ? "summary_only" : "object";
  }
  return "absent";
}

const SAFETY_FLAG_FIELDS = new Set([
  "rawInputRetained",
  "fullDecisionCandidateRetained",
  "fullClarificationCandidateRetained",
  "userVisibleOutputRetained",
  "dbWriteAttempted",
  "supabaseWriteAttempted",
  "shouldExecuteAction",
  "shouldSendEmail",
  "shouldCreateTask",
  "shouldWriteToDb",
  "shouldReturnCandidateToUser",
  "shouldPersistShadowResult",
]);

function assessKnownField(fieldName: string, value: unknown): DecisionSupportShadowStorageFieldAssessment {
  const policy = classifyDecisionSupportShadowStorageField(fieldName, value);
  const observedInCaptureRecord = value !== undefined;
  const observedValueKind = kindOf(fieldName, value);

  let violation = false;
  let violationReason: string | undefined;

  if (SAFETY_FLAG_FIELDS.has(fieldName)) {
    violation = value === true;
    if (violation) violationReason = `${fieldName} observed as true — this must always be false; treat any true value as a blocking policy violation.`;
  } else if (policy.decision === "prohibited" && observedInCaptureRecord) {
    violation = true;
    violationReason = `"${fieldName}" is a permanently prohibited field and was observed on the record.`;
  }

  const recommendedAction = violation
    ? "Do not persist this record — a prohibited field or a forced-true safety flag was observed."
    : policy.decision === "prohibited"
      ? "Field absent, as required — never persist if it ever appears."
      : policy.decision === "requires_explicit_policy_exception"
        ? "Do not persist by default; requires an explicit, documented policy exception."
        : policy.requiredTransformations.length > 0
          ? `Allowed for future persistence only after: ${policy.requiredTransformations.join("; ")}`
          : "Allowed as-is for future persistence.";

  return {
    fieldName,
    observedInCaptureRecord,
    observedValueKind,
    policyDecision: policy.decision,
    risk: policy.risk,
    violation,
    ...(violationReason ? { violationReason } : {}),
    recommendedAction,
  };
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Assesses a single capture-record-like object against a storage policy plan (defaulting to
 * `createDecisionSupportShadowDefaultOffPersistencePlan()`). Walks every known allowed field plus
 * any extra own-enumerable key the record carries, classifying each and flagging violations —
 * including a synthetic record carrying a prohibited field name (e.g. `rawInput`) directly, which is
 * exactly how this function's own tests exercise the "policy violation" branches without ever
 * touching a real database.
 */
export function assessDecisionSupportShadowCaptureRecordForStorage(
  record: DecisionSupportShadowStorageCaptureRecordLike,
  plan: DecisionSupportShadowStorageDefaultOffPersistencePlan = createDecisionSupportShadowDefaultOffPersistencePlan(),
): DecisionSupportShadowStorageRecordAssessment {
  const fieldAssessments: DecisionSupportShadowStorageFieldAssessment[] = [];

  for (const fieldName of KNOWN_RECORD_FIELD_NAMES) {
    fieldAssessments.push(assessKnownField(fieldName, (record as Record<string, unknown>)[fieldName]));
  }

  const knownSet = new Set(KNOWN_RECORD_FIELD_NAMES);
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (knownSet.has(key) || key === "kind") continue;
    if (isEmptyValue(value)) continue;
    const policy = classifyDecisionSupportShadowStorageField(key, value);
    if (policy.decision === "prohibited") {
      fieldAssessments.push({
        fieldName: key,
        observedInCaptureRecord: true,
        observedValueKind: kindOf(key, value),
        policyDecision: policy.decision,
        risk: policy.risk,
        violation: true,
        violationReason: `"${key}" is a permanently prohibited field and was observed on the record with a non-empty value.`,
        recommendedAction: "Do not persist this record — a prohibited field was observed.",
      });
    }
  }

  const dbAuditWrite = (record.auditMetadata as { dbWriteAttempted?: boolean } | undefined)?.dbWriteAttempted === true;
  const supabaseAuditWrite = (record.auditMetadata as { supabaseWriteAttempted?: boolean } | undefined)?.supabaseWriteAttempted === true;

  const has = (fieldName: string) => fieldAssessments.some((f) => f.fieldName === fieldName && f.violation);

  const rawInputViolation = has("rawInputRetained") || has("rawInput") || has("input") || has("fullInput") || has("prompt") || has("originalUserText");
  const fullCandidateViolation =
    has("fullDecisionCandidateRetained") ||
    has("fullClarificationCandidateRetained") ||
    has("fullDecisionCandidate") ||
    has("fullClarificationCandidate") ||
    fieldAssessments.some((f) => f.violation && /full/i.test(f.fieldName) && /candidate/i.test(f.fieldName)) ||
    fieldAssessments.some((f) => f.violation && /responseText/i.test(f.fieldName));
  const userVisibleOutputViolation = has("userVisibleOutputRetained") || has("userVisibleOutput");
  const dbWriteViolation = has("dbWriteAttempted") || dbAuditWrite;
  const supabaseWriteViolation = has("supabaseWriteAttempted") || supabaseAuditWrite;
  const sideEffectViolation =
    has("shouldExecuteAction") ||
    has("shouldSendEmail") ||
    has("shouldCreateTask") ||
    has("shouldWriteToDb") ||
    has("shouldReturnCandidateToUser") ||
    has("shouldPersistShadowResult");

  const prohibitedFieldObservedCount = fieldAssessments.filter((f) => f.policyDecision === "prohibited" && f.observedInCaptureRecord && f.violation).length;

  const retentionPolicySatisfied = Boolean(plan.retentionPolicy);
  const deletionPolicySatisfied = Boolean(plan.deletionPolicy);

  const storageReady =
    !rawInputViolation &&
    !fullCandidateViolation &&
    !userVisibleOutputViolation &&
    !dbWriteViolation &&
    !supabaseWriteViolation &&
    !sideEffectViolation &&
    retentionPolicySatisfied &&
    deletionPolicySatisfied;

  const warnings: string[] = [];
  const inputPreviewAssessment = fieldAssessments.find((f) => f.fieldName === "inputPreview");
  if (inputPreviewAssessment?.observedInCaptureRecord) {
    warnings.push("inputPreview observed on this record — persisting it would require an explicit policy exception, not granted by this plan.");
  }
  const gatesFailedAssessment = fieldAssessments.find((f) => f.fieldName === "allBlockingGatesPassed");
  if (gatesFailedAssessment && gatesFailedAssessment.observedValueKind === "boolean" && !storageReadyGateValueIsTrue(record)) {
    warnings.push("allBlockingGatesPassed observed as false on the source record — this record should not be treated as storage-ready.");
  }

  return {
    captureId: record.captureId,
    sourceRunId: record.sourceRunId,
    captureStatus: record.captureStatus ?? "unknown",
    sourceCandidateKind: record.sourceCandidateKind ?? "none",
    mode: record.mode ?? "dry_run",
    fieldAssessments,
    prohibitedFieldObservedCount,
    rawInputViolation,
    fullCandidateViolation,
    userVisibleOutputViolation,
    dbWriteViolation,
    supabaseWriteViolation,
    sideEffectViolation,
    retentionPolicySatisfied,
    deletionPolicySatisfied,
    storageReady,
    warnings,
  } satisfies DecisionSupportShadowStorageRecordAssessment;
}

function storageReadyGateValueIsTrue(record: DecisionSupportShadowStorageCaptureRecordLike): boolean {
  return record.allBlockingGatesPassed !== false;
}

// ─── Evaluation over a corpus ─────────────────────────────────────────────────────────────

function resultToAssessableRecord(result: DecisionSupportShadowCaptureResult): DecisionSupportShadowStorageCaptureRecordLike {
  const record = result.record;
  return {
    captureId: record?.captureId,
    sourceRunId: record?.sourceRunId ?? result.id,
    captureStatus: result.captureStatus,
    sourceCandidateKind: result.sourceCandidateKind,
    mode: result.mode,
    sinkKind: record?.sinkKind ?? result.sinkKind,
    generatedAt: record?.generatedAt,
    inputHash: record?.inputHash,
    inputPreview: record?.inputPreview,
    rawInputRetained: result.rawInputRetained,
    fullDecisionCandidateRetained: result.fullDecisionCandidateRetained,
    fullClarificationCandidateRetained: result.fullClarificationCandidateRetained,
    userVisibleOutputRetained: result.userVisibleOutputRetained,
    architectureCategory: record?.architectureCategory,
    desiredFutureRoute: record?.desiredFutureRoute,
    targetKind: record?.targetKind,
    sourceStatus: record?.sourceStatus,
    candidateSummary: record?.candidateSummary,
    safetySnapshot: record?.safetySnapshot,
    gateResults: record?.gateResults,
    allBlockingGatesPassed: record?.allBlockingGatesPassed,
    warnings: result.warnings,
    auditMetadata: record?.auditMetadata,
    dbWriteAttempted: result.dbWriteAttempted,
    supabaseWriteAttempted: result.supabaseWriteAttempted,
    shouldExecuteAction: result.shouldExecuteAction,
    shouldSendEmail: result.shouldSendEmail,
    shouldCreateTask: result.shouldCreateTask,
    shouldWriteToDb: result.shouldWriteToDb,
    shouldReturnCandidateToUser: result.shouldReturnCandidateToUser,
    shouldPersistShadowResult: result.shouldPersistShadowResult,
  };
}

function looksLikeDecisionClarificationCase(item: unknown): item is DecisionClarificationCase {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.input === "string" && candidate.captureStatus === undefined && candidate.kind === undefined;
}

function looksLikeCaptureResult(item: unknown): item is DecisionSupportShadowCaptureResult {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Record<string, unknown>;
  return typeof candidate.captureStatus === "string" && "recordCreated" in candidate;
}

function toAssessableRecords(
  recordsOrCases: DecisionClarificationCase[] | DecisionSupportShadowCaptureResult[] | DecisionSupportShadowStorageCaptureRecordLike[],
  options: DecisionSupportShadowStoragePolicyEvaluationOptions,
): DecisionSupportShadowStorageCaptureRecordLike[] {
  if (recordsOrCases.length === 0) return [];

  if (looksLikeDecisionClarificationCase(recordsOrCases[0])) {
    const cases = recordsOrCases as DecisionClarificationCase[];
    const dryRunResults = runDecisionSupportShadowCaptureHarnessEvaluation(cases, { now: options.now, context: { mode: "dry_run" } });
    const passes = [dryRunResults];

    if (options.includeTestMemoryPass) {
      const sink = createInMemoryDecisionSupportShadowCaptureSink();
      const inMemoryResults = runDecisionSupportShadowCaptureHarnessEvaluation(cases, {
        now: options.now,
        context: { mode: "test_only_in_memory", allowInMemoryCaptureForTests: true, policyAcknowledged: true },
        sink,
      });
      passes.push(inMemoryResults);
    }

    return passes.flat().map(resultToAssessableRecord);
  }

  if (looksLikeCaptureResult(recordsOrCases[0])) {
    return (recordsOrCases as DecisionSupportShadowCaptureResult[]).map(resultToAssessableRecord);
  }

  return recordsOrCases as DecisionSupportShadowStorageCaptureRecordLike[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

const RECOMMENDED_NEXT_SPRINT: DecisionSupportShadowStorageNextSprintRecommendation = "Sprint 27R — Shadow Capture Storage Adapter Plan";

function computeStorageReadinessStatus(
  anyViolation: boolean,
  blockingReadinessGateFailureCount: number,
  plan: DecisionSupportShadowStorageDefaultOffPersistencePlan,
): DecisionSupportShadowStorageReadinessStatus {
  if (anyViolation) return "blocked_by_policy_violation";
  if (blockingReadinessGateFailureCount > 0) return "not_ready_for_real_storage";
  const warningGatesUnsatisfied = plan.readinessGates.some((g) => g.severity === "warning" && !g.passed);
  return warningGatesUnsatisfied ? "ready_for_storage_adapter_design" : "ready_for_default_off_storage_prototype";
}

function recommendationFor(status: DecisionSupportShadowStorageReadinessStatus): string {
  switch (status) {
    case "blocked_by_policy_violation":
      return "At least one evaluated capture record violated the storage policy (raw input, a full candidate, user-visible output, a DB/Supabase write, or a side effect) — fix the offending capture path before any storage design work.";
    case "not_ready_for_real_storage":
      return "A blocking readiness gate failed (harness/shadow-mode metrics not clean, or a core no-DB/no-adapter/no-Supabase/retention/deletion guarantee is unmet) — resolve it before designing a storage adapter.";
    case "ready_for_storage_adapter_design":
      return "Every capture record is policy-clean and every blocking readiness gate passes. Tenant isolation, access control, the real feature flag, and policy-version storage remain named prerequisites, not yet implemented — Sprint 27R can design (not yet build) a storage adapter around this policy.";
    case "ready_for_default_off_storage_prototype":
      return "Every capture record is policy-clean, every blocking readiness gate passes, and every warning-severity prerequisite is modeled as satisfied in this test-only scenario — a default-off storage prototype could be designed next, still gated behind the named feature flag.";
    default:
      return "";
  }
}

/**
 * Runs the storage policy over a corpus. Accepts either a `DecisionClarificationCase[]` (the default:
 * generates capture records via the reused Sprint 25R harness, `dry_run` by default, plus
 * `test_only_in_memory` when `options.includeTestMemoryPass` is true), an already-computed
 * `DecisionSupportShadowCaptureResult[]`, or an array of capture-record-like objects (used by this
 * module's own synthetic-violation tests). Never creates a database, migration, storage adapter, or
 * Supabase write — every "record" here is either a Sprint 25R in-memory capture or a plain object.
 */
export function runDecisionSupportShadowStoragePolicyEvaluation(
  recordsOrCases: DecisionClarificationCase[] | DecisionSupportShadowCaptureResult[] | DecisionSupportShadowStorageCaptureRecordLike[],
  options: DecisionSupportShadowStoragePolicyEvaluationOptions = {},
): DecisionSupportShadowStorageRecordAssessment[] {
  const plan =
    options.plan ??
    createDecisionSupportShadowDefaultOffPersistencePlan({
      mode: options.includeTestMemoryPass ? "test_memory_readiness_evaluation" : "dry_run_readiness_evaluation",
    });
  const assessableRecords = toAssessableRecords(recordsOrCases, options);
  return assessableRecords.map((r) => assessDecisionSupportShadowCaptureRecordForStorage(r, plan));
}

const REPRESENTATIVE_LIMIT = 8;
const WEAK_LIMIT = 5;

/**
 * Turns a `runDecisionSupportShadowStoragePolicyEvaluation()` result array into a review-ready
 * report: field-classification counts, violation counts (expected zero against the Sprint 18R
 * corpus), retention/deletion policy presence, readiness-gate pass rate, a storage readiness status,
 * and a Sprint 27R recommendation. Pure — takes an already-computed result array plus the plan used
 * to produce it, rather than re-running anything.
 */
export function summarizeDecisionSupportShadowStoragePolicyEvaluation(
  results: DecisionSupportShadowStorageRecordAssessment[],
  plan: DecisionSupportShadowStorageDefaultOffPersistencePlan = createDecisionSupportShadowDefaultOffPersistencePlan(),
): DecisionSupportShadowStoragePolicyEvaluationSummary {
  const totalCaptureRecords = results.length;
  const assessedRecords = results.length;

  const rawInputViolationCount = results.filter((r) => r.rawInputViolation).length;
  const fullCandidateViolationCount = results.filter((r) => r.fullCandidateViolation).length;
  const userVisibleOutputViolationCount = results.filter((r) => r.userVisibleOutputViolation).length;
  const dbWriteViolationCount = results.filter((r) => r.dbWriteViolation).length;
  const supabaseWriteViolationCount = results.filter((r) => r.supabaseWriteViolation).length;
  const sideEffectViolationCount = results.filter((r) => r.sideEffectViolation).length;
  const prohibitedFieldObservedCount = results.reduce((sum, r) => sum + r.prohibitedFieldObservedCount, 0);

  const retentionPolicyDefinedCount = results.filter((r) => r.retentionPolicySatisfied).length;
  const deletionPolicyDefinedCount = results.filter((r) => r.deletionPolicySatisfied).length;

  const captureHarnessCleanCount = results.filter((r) => r.storageReady).length;
  const captureHarnessCleanRate = rateOf(captureHarnessCleanCount, totalCaptureRecords);

  const readinessGatePassCount = plan.readinessGates.filter((g) => g.passed).length;
  const readinessGatePassRate = rateOf(readinessGatePassCount, plan.readinessGates.length);
  const blockingReadinessGateFailureCount = plan.readinessGates.filter((g) => g.severity === "blocking" && !g.passed).length;

  const anyViolation =
    rawInputViolationCount > 0 ||
    fullCandidateViolationCount > 0 ||
    userVisibleOutputViolationCount > 0 ||
    dbWriteViolationCount > 0 ||
    supabaseWriteViolationCount > 0 ||
    sideEffectViolationCount > 0;

  const storageReadinessStatus = computeStorageReadinessStatus(anyViolation, blockingReadinessGateFailureCount, plan);

  const weakRecordAssessments = results.filter((r) => !r.storageReady).slice(0, WEAK_LIMIT);

  return {
    totalCaptureRecords,
    assessedRecords,
    allowedFieldCount: plan.allowedFields.length,
    prohibitedFieldCount: plan.prohibitedFields.length,
    exceptionRequiredFieldCount: plan.exceptionRequiredFields.length,
    prohibitedFieldObservedCount,
    rawInputViolationCount,
    fullCandidateViolationCount,
    userVisibleOutputViolationCount,
    dbWriteViolationCount,
    supabaseWriteViolationCount,
    sideEffectViolationCount,
    retentionPolicyDefinedCount,
    deletionPolicyDefinedCount,
    captureHarnessCleanCount,
    captureHarnessCleanRate,
    readinessGatePassCount,
    readinessGatePassRate,
    blockingReadinessGateFailureCount,
    storageReadinessStatus,
    recommendedNextSprint: RECOMMENDED_NEXT_SPRINT,
    recommendation: recommendationFor(storageReadinessStatus),
    representativeAllowedFields: plan.allowedFields.slice(0, REPRESENTATIVE_LIMIT).map((f) => f.fieldName),
    representativeProhibitedFields: plan.prohibitedFields.slice(0, REPRESENTATIVE_LIMIT).map((f) => f.fieldName),
    representativePolicyExceptions: plan.exceptionRequiredFields.slice(0, REPRESENTATIVE_LIMIT).map((f) => f.fieldName),
    weakRecordAssessments,
  } satisfies DecisionSupportShadowStoragePolicyEvaluationSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 26R storage policy — mirrors the style of
 * `explainDecisionSupportShadowCaptureHarness()` (Sprint 25R). See
 * `docs/conversational-brain-decision-support-shadow-storage-policy.md` for full context.
 */
export function explainDecisionSupportShadowStoragePolicy(): DecisionSupportShadowStoragePolicyExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-shadow-storage-policy",
    purpose:
      "Classifies every field a Sprint 25R DecisionSupportShadowCaptureRecord could ever carry into a future persistent store (allowed, " +
      "prohibited, or requires-explicit-exception), models a strict retention policy and a strict deletion policy, and assembles a " +
      "default-off persistence plan that names — but never implements — a future feature flag. Also assesses real Sprint 25R capture " +
      "records against that policy to prove today's harness output is storage-clean.",
    nonGoals: [
      "Implement a real storage/persistence layer, database, migration, or Supabase write.",
      "Implement a real feature flag — only requiredFeatureFlagName is documented.",
      "Connect shadow capture (or this policy) to the router or request path.",
      "Change production behavior in any way.",
      "Show any capture record to a user.",
      "Persist any capture record outside the Sprint 25R in-memory, test-only sink.",
      "Harden the Sprint 19R/22R/24R/25R contracts this module reuses.",
      "Implement tenant isolation, access control, or policy-version storage — these are named prerequisites, not built here.",
    ],
    policyProfile:
      'The "strict_default_off" profile: persistenceDefaultEnabled is a literal false, requiresFeatureFlag is true, ' +
      'featureFlagDefault is false, and storageAdapterImplemented/dbMigrationImplemented/supabaseWriteImplemented/' +
      "productionRouteChanged are all literal false — regardless of mode or evaluation results.",
    fieldClassification: [
      "allowed: no transformation required (e.g. captureId, mode, sinkKind, architectureCategory, safety boolean flags).",
      "allowed_with_hashing: must be hashed before persisting (e.g. inputHash, sourceRunId).",
      "allowed_with_redaction: must be redacted before persisting (e.g. warnings).",
      "allowed_with_minimization: must stay reduced to structural counts/labels (e.g. candidateSummary, gateResults).",
      "allowed_only_test_memory: never real storage, only an in-process test array.",
      "allowed_only_future_default_off: only ever behind the named, still-unimplemented feature flag.",
      "requires_explicit_policy_exception: not allowed by default (e.g. inputPreview) — needs documented, explicit review.",
      "prohibited: never persisted under any circumstance, always (e.g. rawInput, fullDecisionCandidate, userVisibleOutput, emailAddress, phoneNumber, projectName).",
    ],
    prohibitedFields: PROHIBITED_FIELD_SEEDS.map((s) => s.fieldName),
    allowedFields: ALLOWED_FIELD_SEEDS.filter((s) => s.decision !== "requires_explicit_policy_exception").map((s) => s.fieldName),
    exceptionFields: ALLOWED_FIELD_SEEDS.filter((s) => s.decision === "requires_explicit_policy_exception").map((s) => s.fieldName),
    retentionPolicy:
      "ephemeral_only, defaultRetentionDays: 0, maximumRetentionDays: 0, deletionRequired: true — a future default-off prototype could " +
      "propose 7/30 days, but only once a feature flag, storage adapter, deletion job, policy versioning, tenant isolation, and admin " +
      "purge all exist; persistenceDefaultEnabled stays false regardless.",
    deletionPolicy:
      "hardDeleteRequired: true, softDeleteAllowed: false, deletionAuditMetadataOnly: true, deletable by capture id/workspace/policy " +
      "version, and any raw payload or full candidate that ever appears via a future bug must be purged — deletion must be testable " +
      "before a storage prototype exists.",
    defaultOffFeatureFlagPlan:
      `requiredFeatureFlagName: "${REQUIRED_FEATURE_FLAG_NAME}", featureFlagDefault: false — named only; no config file, environment ` +
      "variable, or feature-flag service reads or activates it in this sprint.",
    readinessGates: ALL_READINESS_GATES,
    whyDbIsNotCreated:
      "No storage adapter, retention job, deletion job, tenant isolation, access control, or policy-version storage exists yet — " +
      "writing to a real database today would create ungoverned, undeletable data.",
    whyMigrationIsNotCreated:
      "A migration presumes a settled schema; this sprint's field classification (allowed/prohibited/exception-required) is the " +
      "schema-shaping decision that must exist before any migration is written.",
    whyStorageAdapterIsNotCreated:
      "A storage adapter presumes a settled retention/deletion policy and a real, default-off feature flag gating it — this sprint " +
      "defines the policy and names the flag, but implements neither.",
    expectedSprint27Path:
      "If storageReadinessStatus stays ready_for_storage_adapter_design (or better) against the Sprint 18R corpus, with zero policy " +
      "violations and 100% readinessGatePassRate among blocking gates, Sprint 27R can design (not yet build) a storage adapter plan " +
      "around this policy — still default-off, still no real database/Supabase/feature-flag/router change.",
  };
}
