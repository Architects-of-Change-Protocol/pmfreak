/**
 * Sprint 27R — Decision Support Shadow Capture Storage Adapter Plan.
 *
 * A pure, offline, deterministic **adapter plan/contract** module: it designs what a future Shadow
 * Capture Storage Adapter would look like — its method contract, a proposed (never-created) schema, a
 * proposed (never-created) migration, a safe storage-draft mapper built on the Sprint 26R storage
 * policy, a storage-draft validator, and a no-op contract simulation — without creating a database, a
 * migration file, a table, a real storage adapter, or a real repository.
 *
 * Every method on the future adapter is *named and policy-gated*, not implemented:
 * `validatePolicy` / `mapCaptureRecordToStorageDraft` / `validateStorageDraft` are allowed this sprint
 * (they exist here, as pure functions, and do exactly what their name says); `writeCaptureDraft`,
 * `deleteByCaptureId`, `deleteByWorkspace`, `purgeExpired`, and `listByPolicyVersion` are all
 * `futureOnly: true` — this sprint documents their contract and safety requirements but implements
 * none of them, real or fake.
 *
 * Reuses, rather than reimplements: the Sprint 26R storage policy (`createDecisionSupportShadowDefaultOffPersistencePlan`,
 * `DECISION_SUPPORT_SHADOW_STORAGE_POLICY_VERSION`, `createDecisionSupportShadowStorageRetentionPolicy`),
 * the Sprint 25R capture harness (`runDecisionSupportShadowCaptureHarnessEvaluation`,
 * `createInMemoryDecisionSupportShadowCaptureSink`, `createDecisionSupportShadowInputHash`), and the
 * Sprint 18R decision/clarification corpus type.
 *
 * Like every module in this package tree, this does not call the router, composer, or any production
 * handler; does not touch `POST /api/command-center/chat`; does not read/write a database, call
 * Supabase, send email, create a task, or call an LLM; does not use `fetch`; does not read an
 * environment variable or activate a feature flag; and does not connect `decision_support` to the
 * router. See
 * `docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md` for the full design
 * writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import {
  createDecisionSupportShadowInputHash,
  createInMemoryDecisionSupportShadowCaptureSink,
  runDecisionSupportShadowCaptureHarnessEvaluation,
} from "./decisionSupportShadowCaptureHarness";
import type { DecisionSupportShadowCaptureRecord, DecisionSupportShadowCaptureResult } from "./decisionSupportShadowCaptureHarnessTypes";
import {
  DECISION_SUPPORT_SHADOW_STORAGE_POLICY_VERSION,
  createDecisionSupportShadowStorageRetentionPolicy,
} from "./decisionSupportShadowCaptureStoragePolicy";

import type {
  DecisionSupportShadowStorageAdapterKind,
  DecisionSupportShadowStorageAdapterMethodName,
  DecisionSupportShadowStorageAdapterMethodPolicy,
  DecisionSupportShadowStorageAdapterPlanEvaluationOptions,
  DecisionSupportShadowStorageAdapterPlanEvaluationResult,
  DecisionSupportShadowStorageAdapterPlanEvaluationSummary,
  DecisionSupportShadowStorageAdapterPlanExplain,
  DecisionSupportShadowStorageAdapterPlanMode,
  DecisionSupportShadowStorageAdapterPlanNextSprintRecommendation,
  DecisionSupportShadowStorageAdapterPlanProfile,
  DecisionSupportShadowStorageAdapterPlanReadinessStatus,
  DecisionSupportShadowStorageAdapterSimulationResult,
  DecisionSupportShadowStorageColumnDecision,
  DecisionSupportShadowStorageColumnType,
  DecisionSupportShadowStorageDraft,
  DecisionSupportShadowStorageDraftFields,
  DecisionSupportShadowStorageDraftValidationGate,
  DecisionSupportShadowStorageDraftValidationOptions,
  DecisionSupportShadowStorageDraftValidationResult,
  DecisionSupportShadowStorageDraftValidationSeverity,
  DecisionSupportShadowStorageMigrationProposal,
  DecisionSupportShadowStoragePolicyAssessmentSummary,
  DecisionSupportShadowStorageSchemaColumn,
  DecisionSupportShadowStorageSchemaProposal,
} from "./decisionSupportShadowCaptureStorageAdapterPlanTypes";

export type {
  DecisionSupportShadowStorageAdapterPlanProfile,
  DecisionSupportShadowStorageAdapterPlanMode,
  DecisionSupportShadowStorageAdapterKind,
  DecisionSupportShadowStorageAdapterMethodName,
  DecisionSupportShadowStorageAdapterMethodPolicy,
  DecisionSupportShadowStorageColumnType,
  DecisionSupportShadowStorageColumnDecision,
  DecisionSupportShadowStorageSchemaColumnRisk,
  DecisionSupportShadowStorageSchemaColumn,
  DecisionSupportShadowStorageSchemaProposalStatus,
  DecisionSupportShadowStorageSchemaProposal,
  DecisionSupportShadowStorageMigrationProposal,
  DecisionSupportShadowStorageDraftFields,
  DecisionSupportShadowStoragePolicyAssessmentSummary,
  DecisionSupportShadowStorageDraft,
  DecisionSupportShadowStorageDraftValidationGate,
  DecisionSupportShadowStorageDraftValidationSeverity,
  DecisionSupportShadowStorageDraftValidationResult,
  DecisionSupportShadowStorageDraftValidationOptions,
  DecisionSupportShadowStorageAdapterSimulationResult,
  DecisionSupportShadowStorageAdapterPlanEvaluationResult,
  DecisionSupportShadowStorageAdapterPlanReadinessStatus,
  DecisionSupportShadowStorageAdapterPlanNextSprintRecommendation,
  DecisionSupportShadowStorageAdapterPlanEvaluationOptions,
  DecisionSupportShadowStorageAdapterPlanEvaluationSummary,
  DecisionSupportShadowStorageAdapterPlanExplain,
} from "./decisionSupportShadowCaptureStorageAdapterPlanTypes";

export const DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_VERSION = "27R.1.0";

const PROPOSED_TABLE_NAME = "decision_support_shadow_captures" as const;

// ─── Plan profile ───────────────────────────────────────────────────────────────────────

/**
 * The strict `"strict_default_off_adapter_plan"` profile — no storage adapter, migration, table, or
 * Supabase write is ever implemented by this sprint, regardless of `mode`.
 */
export function createDecisionSupportShadowStorageAdapterPlanProfile(mode: DecisionSupportShadowStorageAdapterPlanMode = "contract_only") {
  return {
    profile: "strict_default_off_adapter_plan" as const,
    mode,
    storageEnabled: false as const,
    realPersistenceAllowed: false as const,
    storageAdapterImplemented: false as const,
    dbMigrationImplemented: false as const,
    tableCreated: false as const,
    supabaseWriteImplemented: false as const,
    productionRouteChanged: false as const,
  };
}

// ─── Adapter method contract ─────────────────────────────────────────────────────────────

const METHOD_POLICY_SEEDS: DecisionSupportShadowStorageAdapterMethodPolicy[] = [
  {
    methodName: "validatePolicy",
    allowedInSprint27: true,
    futureOnly: false,
    mustBeDefaultOff: false,
    mustNotWriteRealStorage: true,
    requiresPolicyValidation: true,
    requiresTenantIsolation: false,
    requiresAccessControl: false,
    requiresDeletionPath: false,
    reason: "A pure check against the Sprint 26R storage policy — implemented this sprint as validateDecisionSupportShadowStorageDraft(); never writes anywhere.",
  },
  {
    methodName: "mapCaptureRecordToStorageDraft",
    allowedInSprint27: true,
    futureOnly: false,
    mustBeDefaultOff: false,
    mustNotWriteRealStorage: true,
    requiresPolicyValidation: true,
    requiresTenantIsolation: false,
    requiresAccessControl: false,
    requiresDeletionPath: false,
    reason: "A pure mapper from a Sprint 25R capture record to a policy-clean storage draft — implemented this sprint; never writes anywhere.",
  },
  {
    methodName: "validateStorageDraft",
    allowedInSprint27: true,
    futureOnly: false,
    mustBeDefaultOff: false,
    mustNotWriteRealStorage: true,
    requiresPolicyValidation: true,
    requiresTenantIsolation: false,
    requiresAccessControl: false,
    requiresDeletionPath: false,
    reason: "A pure validator running every draft-validation gate — implemented this sprint; never writes anywhere.",
  },
  {
    methodName: "writeCaptureDraft",
    allowedInSprint27: false,
    futureOnly: true,
    mustBeDefaultOff: true,
    mustNotWriteRealStorage: true,
    requiresPolicyValidation: true,
    requiresTenantIsolation: true,
    requiresAccessControl: true,
    requiresDeletionPath: true,
    reason: "Would perform the first real (or fake, in Sprint 28R) write — not implemented in Sprint 27R, real or fake; requires tenant isolation, access control, and a deletion path to exist first.",
  },
  {
    methodName: "deleteByCaptureId",
    allowedInSprint27: false,
    futureOnly: true,
    mustBeDefaultOff: true,
    mustNotWriteRealStorage: true,
    requiresPolicyValidation: false,
    requiresTenantIsolation: false,
    requiresAccessControl: true,
    requiresDeletionPath: true,
    reason: "A deletion path — named and required as a precondition of writeCaptureDraft, not implemented until a real or fake write path exists.",
  },
  {
    methodName: "deleteByWorkspace",
    allowedInSprint27: false,
    futureOnly: true,
    mustBeDefaultOff: true,
    mustNotWriteRealStorage: true,
    requiresPolicyValidation: false,
    requiresTenantIsolation: true,
    requiresAccessControl: true,
    requiresDeletionPath: true,
    reason: "Requires tenant/workspace isolation, which this sprint does not implement — named only.",
  },
  {
    methodName: "purgeExpired",
    allowedInSprint27: false,
    futureOnly: true,
    mustBeDefaultOff: true,
    mustNotWriteRealStorage: true,
    requiresPolicyValidation: false,
    requiresTenantIsolation: false,
    requiresAccessControl: false,
    requiresDeletionPath: true,
    reason: "Requires a retention/TTL job, which this sprint does not implement — named only.",
  },
  {
    methodName: "listByPolicyVersion",
    allowedInSprint27: false,
    futureOnly: true,
    mustBeDefaultOff: true,
    mustNotWriteRealStorage: true,
    requiresPolicyValidation: false,
    requiresTenantIsolation: false,
    requiresAccessControl: true,
    requiresDeletionPath: false,
    reason: "A read path over real storage — requires access control, which this sprint does not implement — named only.",
  },
];

/** Returns fresh copies of every future adapter method's policy. */
export function listDecisionSupportShadowStorageAdapterMethodPolicies(): DecisionSupportShadowStorageAdapterMethodPolicy[] {
  return METHOD_POLICY_SEEDS.map((seed) => ({ ...seed }));
}

// ─── Schema proposal ──────────────────────────────────────────────────────────────────────

type ColumnSeed = {
  columnName: string;
  sourceField?: string;
  columnType: DecisionSupportShadowStorageColumnType;
  decision: DecisionSupportShadowStorageColumnDecision;
  nullable: boolean;
  indexed: boolean;
  unique: boolean;
  policyDecision: string;
  risk: DecisionSupportShadowStorageSchemaColumn["risk"];
  reason: string;
};

const SCHEMA_COLUMN_SEEDS: ColumnSeed[] = [
  { columnName: "capture_id", sourceField: "captureId", columnType: "text", decision: "proposed_allowed", nullable: false, indexed: true, unique: true, policyDecision: "allowed", risk: "low", reason: "A deterministic, opaque capture identifier." },
  { columnName: "source_run_id_hash", sourceField: "sourceRunIdHash", columnType: "hash", decision: "proposed_allowed_with_hashing", nullable: true, indexed: false, unique: false, policyDecision: "allowed_with_hashing", risk: "medium", reason: "Hashed correlation id — never the raw sourceRunId." },
  { columnName: "generated_at", sourceField: "generatedAt", columnType: "timestamp", decision: "proposed_allowed", nullable: true, indexed: true, unique: false, policyDecision: "allowed", risk: "low", reason: "Caller-supplied timestamp — no content." },
  { columnName: "mode", sourceField: "mode", columnType: "enum", decision: "proposed_allowed", nullable: false, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Capture mode — operational metadata only." },
  { columnName: "sink_kind", sourceField: "sinkKind", columnType: "enum", decision: "proposed_allowed", nullable: false, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Which sink (if any) received the record — operational metadata only." },
  { columnName: "input_hash", sourceField: "inputHash", columnType: "hash", decision: "proposed_allowed_with_hashing", nullable: false, indexed: true, unique: false, policyDecision: "allowed_with_hashing", risk: "low", reason: "A stable, local, non-cryptographic hash of the raw input." },
  { columnName: "architecture_category", sourceField: "architectureCategory", columnType: "enum", decision: "proposed_allowed", nullable: true, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Closed-vocabulary routing label." },
  { columnName: "desired_future_route", sourceField: "desiredFutureRoute", columnType: "enum", decision: "proposed_allowed", nullable: true, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Closed-vocabulary routing label." },
  { columnName: "target_kind", sourceField: "targetKind", columnType: "enum", decision: "proposed_allowed", nullable: true, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Closed-vocabulary routing label." },
  { columnName: "source_status", sourceField: "sourceStatus", columnType: "enum", decision: "proposed_allowed", nullable: false, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Sprint 24R shadow-mode-run status label." },
  { columnName: "source_candidate_kind", sourceField: "sourceCandidateKind", columnType: "enum", decision: "proposed_allowed", nullable: false, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Which candidate kind (if any) the source run produced." },
  { columnName: "capture_status", sourceField: "captureStatus", columnType: "enum", decision: "proposed_allowed", nullable: false, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "The capture harness's own status label." },
  { columnName: "candidate_summary_json_minimized", sourceField: "candidateSummary", columnType: "json_minimized", decision: "proposed_allowed_with_minimization", nullable: true, indexed: false, unique: false, policyDecision: "allowed_with_minimization", risk: "medium", reason: "Structural counts/labels only — never full recommendation/response text." },
  { columnName: "safety_snapshot_json", sourceField: "safetySnapshot", columnType: "json_minimized", decision: "proposed_allowed", nullable: true, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "A fixed bag of literal-false safety flags — no content." },
  { columnName: "gate_summary_json_minimized", sourceField: "gateSummary", columnType: "json_minimized", decision: "proposed_allowed_with_minimization", nullable: true, indexed: false, unique: false, policyDecision: "allowed_with_minimization", risk: "medium", reason: "Gate count/failed-gate-names/blocking-failure-count only — never full gate reason text." },
  { columnName: "audit_summary_json", sourceField: "auditSummary", columnType: "json_minimized", decision: "proposed_allowed", nullable: true, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Version/strategy-source/policy labels and literal-false integration flags — no user content." },
  { columnName: "all_blocking_gates_passed", sourceField: "allBlockingGatesPassed", columnType: "boolean", decision: "proposed_allowed", nullable: false, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "A boolean summary — no content." },
  { columnName: "policy_version", sourceField: "policyVersion", columnType: "text", decision: "proposed_allowed", nullable: false, indexed: true, unique: false, policyDecision: "allowed", risk: "low", reason: "Which storage policy version produced this draft." },
  { columnName: "retention_mode", sourceField: "retentionMode", columnType: "enum", decision: "proposed_allowed", nullable: false, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Closed-vocabulary retention mode label." },
  { columnName: "retention_expires_at", sourceField: "retentionExpiresAt", columnType: "timestamp", decision: "proposed_future_only", nullable: true, indexed: true, unique: false, policyDecision: "allowed_only_future_default_off", risk: "low", reason: "Always null in Sprint 27R — only meaningful once a real retention job exists." },
  { columnName: "deletion_required", sourceField: "deletionRequired", columnType: "boolean", decision: "proposed_allowed", nullable: false, indexed: false, unique: false, policyDecision: "allowed", risk: "low", reason: "Must always be true — enforced by the deletion policy, not a caller choice." },
];

const PROHIBITED_SCHEMA_COLUMNS: string[] = [
  "raw_input",
  "input",
  "input_preview",
  "full_input",
  "prompt",
  "original_user_text",
  "full_decision_candidate",
  "full_clarification_candidate",
  "decision_response_text",
  "clarification_response_text",
  "recommendation_text",
  "user_visible_output",
  "project_name",
  "email_address",
  "phone_number",
  "recent_messages",
  "conversation_messages",
  "raw_evidence",
  "raw_email_body",
  "raw_meeting_transcript",
  "raw_document_content",
  "raw_customer_data",
];

const REQUIRED_SCHEMA_INDEXES: string[] = [
  "idx_decision_support_shadow_captures_capture_id",
  "idx_decision_support_shadow_captures_input_hash",
  "idx_decision_support_shadow_captures_policy_version",
  "idx_decision_support_shadow_captures_generated_at",
  "idx_decision_support_shadow_captures_retention_expires_at",
];

const REQUIRED_SCHEMA_CONSTRAINTS: string[] = [
  "no nullable capture_id",
  "no nullable input_hash",
  "no nullable policy_version",
  "no raw payload columns",
  "deletion_required must be true",
  "storage_enabled must default false in future implementation",
  "feature flag must remain default false",
];

/**
 * Returns the Sprint 27R schema proposal: a plain TypeScript object describing what a future
 * `decision_support_shadow_captures` table *could* look like — allowed columns, prohibited columns,
 * required indexes, and required constraints. Not a migration, not SQL, not a runtime schema — no
 * migration file, table, or database is ever created by this function.
 */
export function createDecisionSupportShadowStorageSchemaProposal(): DecisionSupportShadowStorageSchemaProposal {
  return {
    tableName: PROPOSED_TABLE_NAME,
    status: "proposal_only",
    migrationCreated: false,
    tableCreated: false,
    columns: SCHEMA_COLUMN_SEEDS.map((seed) => ({ ...seed })),
    prohibitedColumns: [...PROHIBITED_SCHEMA_COLUMNS],
    requiredIndexes: [...REQUIRED_SCHEMA_INDEXES],
    requiredConstraints: [...REQUIRED_SCHEMA_CONSTRAINTS],
    notes: [
      "This is a TypeScript object proposal only — no migration file, SQL file, or runtime schema is created by this sprint.",
      "Every column here maps 1:1 to a DecisionSupportShadowStorageDraft field already produced by mapDecisionSupportCaptureRecordToStorageDraft().",
      "prohibitedColumns names every raw/full/user-facing/personal-contact field this plan refuses to ever schema, mirroring the Sprint 26R prohibited-field table.",
    ],
  };
}

// ─── Migration proposal ───────────────────────────────────────────────────────────────────

/**
 * Returns the Sprint 27R migration proposal: documentation of what a future migration *would* need to
 * satisfy, as a plain object — `migrationFileCreated` and `migrationShouldNotBeCreatedInSprint27` are
 * both fixed, never computed from any input, and no migration/SQL file exists anywhere in this
 * package tree.
 */
export function createDecisionSupportShadowStorageMigrationProposal(): DecisionSupportShadowStorageMigrationProposal {
  return {
    status: "proposal_only",
    migrationFileCreated: false,
    migrationShouldNotBeCreatedInSprint27: true,
    proposedMigrationName: "add_decision_support_shadow_captures_default_off",
    proposedTableName: PROPOSED_TABLE_NAME,
    requiredPreconditions: [
      "storage policy remains clean (Sprint 26R zero violations, sustained)",
      "no raw input retention",
      "no full candidate retention",
      "no user visible output retention",
      "fake adapter tests pass (Sprint 28R)",
      "deletion path designed",
      "purge path designed",
      "tenant isolation model designed",
      "access control model designed",
      "feature flag default-off plan reviewed",
      "migration rollback plan reviewed",
    ],
    prohibitedMigrationContents: [
      "raw_input column",
      "input_preview column unless explicit exception and redaction policy",
      "full_candidate columns",
      "responseText columns",
      "email/phone/projectName columns",
      "user_visible_output column",
      "any raw payload",
      "any enabled-by-default flag",
    ],
    rollbackRequirements: [
      "drop table safely",
      "remove indexes",
      "preserve deletion audit metadata only if explicitly approved",
      "prove no raw payload exists before rollback",
    ],
    deletionRequirements: [
      "delete by capture_id",
      "delete by workspace/tenant",
      "purge expired",
      "purge policy violations",
      "purge raw payloads if ever introduced by bug",
    ],
    notes: [
      "No migration file, SQL file, or table is created by this sprint — this object exists purely to document what a future migration must satisfy.",
      "migrationShouldNotBeCreatedInSprint27 is a literal true, never computed — Sprint 28R (fake adapter) still does not create a real migration.",
    ],
  };
}

// ─── Storage draft mapping ────────────────────────────────────────────────────────────────

const EXCLUDED_DRAFT_FIELD_NAMES: string[] = [
  "rawInput",
  "inputPreview",
  "fullDecisionCandidate",
  "fullClarificationCandidate",
  "responseText",
  "recommendationText",
  "userVisibleOutput",
  "projectName",
  "emailAddress",
  "phoneNumber",
  "rawEvidence",
];

const POLICY_ASSESSMENT_SUMMARY: DecisionSupportShadowStoragePolicyAssessmentSummary = {
  rawInputExcluded: true,
  inputPreviewExcluded: true,
  fullCandidatesExcluded: true,
  userVisibleOutputExcluded: true,
  projectNameExcluded: true,
  emailAddressExcluded: true,
  phoneNumberExcluded: true,
};

function buildGateSummary(gateResults: DecisionSupportShadowCaptureRecord["gateResults"]): Record<string, unknown> {
  const failed = (gateResults ?? []).filter((g) => !g.passed);
  return {
    gateCount: (gateResults ?? []).length,
    failedGateNames: failed.map((g) => g.gate),
    blockingFailureCount: failed.filter((g) => g.severity === "blocking").length,
  };
}

function buildAuditSummary(auditMetadata: DecisionSupportShadowCaptureRecord["auditMetadata"]): Record<string, unknown> {
  return {
    captureHarnessVersion: auditMetadata.captureHarnessVersion,
    strategySource: auditMetadata.strategySource,
    storagePolicy: auditMetadata.storagePolicy,
    adapterMappingRealChanged: auditMetadata.adapterMappingRealChanged,
    routerChanged: auditMetadata.routerChanged,
    composerChanged: auditMetadata.composerChanged,
    endpointChanged: auditMetadata.endpointChanged,
    dbWriteAttempted: auditMetadata.dbWriteAttempted,
    supabaseWriteAttempted: auditMetadata.supabaseWriteAttempted,
    externalCallAttempted: auditMetadata.externalCallAttempted,
  };
}

export type DecisionSupportShadowStorageDraftMapOptions = {
  policyVersion?: string;
  draftIdPrefix?: string;
};

/**
 * Maps a Sprint 25R `DecisionSupportShadowCaptureRecord` into a policy-clean
 * `DecisionSupportShadowStorageDraft`: only the allowed/minimized/hashed fields the Sprint 26R storage
 * policy would ever let into future persistent storage. Never includes raw input, `inputPreview`, a
 * full decision/clarification candidate, user-visible output, a project name, an email address, or a
 * phone number — those are always excluded, and their absence is asserted, not merely assumed. Sets
 * `storageEnabled`/`realPersistenceAllowed` to a literal `false` — this function never writes
 * anywhere, it only computes what a draft *would* look like.
 */
export function mapDecisionSupportCaptureRecordToStorageDraft(
  record: DecisionSupportShadowCaptureRecord,
  options: DecisionSupportShadowStorageDraftMapOptions = {},
): DecisionSupportShadowStorageDraft {
  const retentionPolicy = createDecisionSupportShadowStorageRetentionPolicy();
  const policyVersion = options.policyVersion ?? DECISION_SUPPORT_SHADOW_STORAGE_POLICY_VERSION;

  const warnings: string[] = [];
  if (record.inputPreview) {
    warnings.push("inputPreview was observed on the source capture record — excluded entirely from the storage draft, not persisted even hashed.");
  }

  const fields: DecisionSupportShadowStorageDraftFields = {
    captureId: record.captureId,
    sourceRunIdHash: record.sourceRunId ? createDecisionSupportShadowInputHash(record.sourceRunId) : undefined,
    generatedAt: record.generatedAt,
    mode: record.mode,
    sinkKind: record.sinkKind,
    inputHash: record.inputHash,
    architectureCategory: record.architectureCategory,
    desiredFutureRoute: record.desiredFutureRoute,
    targetKind: record.targetKind,
    sourceStatus: record.sourceStatus,
    sourceCandidateKind: record.sourceCandidateKind,
    captureStatus: record.captureStatus,
    candidateSummary: record.candidateSummary ? { ...record.candidateSummary } : undefined,
    safetySnapshot: record.safetySnapshot ? { ...record.safetySnapshot } : undefined,
    gateSummary: buildGateSummary(record.gateResults),
    auditSummary: record.auditMetadata ? buildAuditSummary(record.auditMetadata) : undefined,
    allBlockingGatesPassed: record.allBlockingGatesPassed,
    retentionMode: retentionPolicy.retentionMode,
    retentionExpiresAt: null,
    deletionRequired: true,
  };

  return {
    kind: "decision_support_shadow_storage_draft",
    draftId: `${options.draftIdPrefix ?? "draft"}-${record.captureId}`,
    sourceCaptureId: record.captureId,
    policyVersion,
    storageAdapterPlanProfile: "strict_default_off_adapter_plan",
    storageEnabled: false,
    realPersistenceAllowed: false,
    proposedTableName: PROPOSED_TABLE_NAME,
    fields,
    excludedFields: [...EXCLUDED_DRAFT_FIELD_NAMES],
    policyAssessmentSummary: { ...POLICY_ASSESSMENT_SUMMARY },
    warnings,
  };
}

// ─── Storage draft validation ─────────────────────────────────────────────────────────────

const FORBIDDEN_KEY_GROUPS: Record<string, string[]> = {
  no_raw_input: ["rawInput", "input", "fullInput", "originalUserText", "prompt"],
  no_input_preview: ["inputPreview"],
  no_full_candidate: ["fullDecisionCandidate", "fullClarificationCandidate", "responseText", "recommendationText"],
  no_user_visible_output: ["userVisibleOutput"],
  no_project_name: ["projectName"],
  no_email_address: ["emailAddress"],
  no_phone_number: ["phoneNumber"],
};

const SAFETY_SIDE_EFFECT_FIELDS = [
  "shouldReturnCandidateToUser",
  "shouldPersistShadowResult",
  "shouldExecuteAction",
  "shouldSendEmail",
  "shouldCreateTask",
  "shouldWriteToDb",
  "userVisibleOutputAllowed",
  "persistenceAllowed",
  "executionAllowed",
  "productionRouteChangeAllowed",
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+\d[\d\s-]{5,}\d)|\b\d{3,4}-\d{3,4}\b|\b\d{7,}\b/;

/** Flattens an object's own-enumerable key/value pairs, descending into nested plain objects (not
 * arrays of primitives) up to two levels — enough to inspect `draft`, `draft.fields`, and
 * `draft.fields.<subObject>` in one pass, including any extra key a synthetic test draft injects. */
function flattenEntries(value: unknown, depth = 0, acc: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (value === null || value === undefined || typeof value !== "object" || depth > 2) return acc;
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

function hasForbiddenKey(root: unknown, names: string[]): boolean {
  const entries = flattenEntries(root);
  return entries.some(([key, value]) => names.includes(key) && value !== undefined && value !== null && value !== "");
}

function anyStringMatches(root: unknown, pattern: RegExp): boolean {
  const entries = flattenEntries(root);
  return entries.some(([, value]) => typeof value === "string" && pattern.test(value));
}

function gate(
  gateName: DecisionSupportShadowStorageDraftValidationGate,
  passed: boolean,
  severity: DecisionSupportShadowStorageDraftValidationSeverity,
  reason: string,
): DecisionSupportShadowStorageDraftValidationResult {
  return { gate: gateName, passed, severity, reason };
}

/**
 * Runs every draft-validation gate against a `DecisionSupportShadowStorageDraft`. Accepts a loosely
 * shaped value at runtime (TypeScript's structural typing does not prevent a synthetic test draft
 * from carrying an extra forbidden key like `rawInput`) so this module's own tests can prove each gate
 * actually catches a policy-violating draft, not merely trust its declared type. Never writes
 * anywhere — this is a pure check.
 */
export function validateDecisionSupportShadowStorageDraft(
  draft: DecisionSupportShadowStorageDraft,
  options: DecisionSupportShadowStorageDraftValidationOptions = {},
): DecisionSupportShadowStorageDraftValidationResult[] {
  const schemaProposal = createDecisionSupportShadowStorageSchemaProposal();
  const migrationProposal = createDecisionSupportShadowStorageMigrationProposal();

  const fields = (draft.fields ?? {}) as Record<string, unknown>;
  const candidateSummary = fields.candidateSummary as Record<string, unknown> | undefined;
  const safetySnapshot = fields.safetySnapshot as Record<string, unknown> | undefined;
  const auditSummary = fields.auditSummary as Record<string, unknown> | undefined;

  const candidateSummaryMinimized =
    candidateSummary != null && !hasForbiddenKey(candidateSummary, [...FORBIDDEN_KEY_GROUPS.no_full_candidate]);

  const safetySnapshotSideEffectsClean =
    safetySnapshot != null && SAFETY_SIDE_EFFECT_FIELDS.every((f) => safetySnapshot[f] !== true);

  const auditSummaryClean =
    auditSummary != null &&
    !hasForbiddenKey(auditSummary, [...FORBIDDEN_KEY_GROUPS.no_raw_input, ...FORBIDDEN_KEY_GROUPS.no_full_candidate, ...FORBIDDEN_KEY_GROUPS.no_user_visible_output]) &&
    auditSummary.dbWriteAttempted !== true &&
    auditSummary.supabaseWriteAttempted !== true;

  const results: DecisionSupportShadowStorageDraftValidationResult[] = [
    gate("storage_disabled", draft.storageEnabled === false && draft.realPersistenceAllowed === false, "blocking",
      "storageEnabled and realPersistenceAllowed must both be a literal false."),
    gate("policy_profile_attached", Boolean(draft.storageAdapterPlanProfile), "blocking",
      "draft.storageAdapterPlanProfile must be present."),
    gate("policy_version_attached", Boolean(draft.policyVersion), "blocking",
      "draft.policyVersion must be present."),
    gate("no_raw_input", !hasForbiddenKey(draft, FORBIDDEN_KEY_GROUPS.no_raw_input), "blocking",
      "No rawInput/input/fullInput/originalUserText/prompt key may appear anywhere on the draft."),
    gate("no_input_preview", !hasForbiddenKey(draft, FORBIDDEN_KEY_GROUPS.no_input_preview), "blocking",
      "No inputPreview key may appear anywhere on the draft."),
    gate("no_full_candidate", !hasForbiddenKey(draft, FORBIDDEN_KEY_GROUPS.no_full_candidate), "blocking",
      "No fullDecisionCandidate/fullClarificationCandidate/responseText/recommendationText key may appear anywhere on the draft."),
    gate("no_user_visible_output", !hasForbiddenKey(draft, FORBIDDEN_KEY_GROUPS.no_user_visible_output), "blocking",
      "No userVisibleOutput key may appear anywhere on the draft."),
    gate("no_project_name", !hasForbiddenKey(draft, FORBIDDEN_KEY_GROUPS.no_project_name), "blocking",
      "No projectName key may appear anywhere on the draft."),
    gate("no_email_address", !hasForbiddenKey(draft, FORBIDDEN_KEY_GROUPS.no_email_address) && !anyStringMatches(draft, EMAIL_REGEX), "blocking",
      "No emailAddress key, and no string value shaped like an email address, may appear anywhere on the draft."),
    gate("no_phone_number", !hasForbiddenKey(draft, FORBIDDEN_KEY_GROUPS.no_phone_number) && !anyStringMatches(draft, PHONE_REGEX), "blocking",
      "No phoneNumber key, and no string value shaped like a phone number, may appear anywhere on the draft."),
    gate("candidate_summary_minimized", candidateSummaryMinimized, "blocking",
      candidateSummary == null
        ? "draft.fields.candidateSummary is missing."
        : "draft.fields.candidateSummary must not carry a full candidate/response-text key."),
    gate("safety_snapshot_only", safetySnapshotSideEffectsClean, "blocking",
      safetySnapshot == null
        ? "draft.fields.safetySnapshot is missing."
        : "Every side-effect flag on draft.fields.safetySnapshot must be false."),
    gate("audit_summary_only", auditSummaryClean, "blocking",
      auditSummary == null
        ? "draft.fields.auditSummary is missing."
        : "draft.fields.auditSummary must carry no raw payload key, and dbWriteAttempted/supabaseWriteAttempted must both be false."),
    gate("retention_policy_attached", Boolean(fields.retentionMode) && fields.deletionRequired === true, "blocking",
      "draft.fields.retentionMode must be present and draft.fields.deletionRequired must be true."),
    gate("deletion_policy_attached", fields.deletionRequired === true, "blocking",
      "draft.fields.deletionRequired must be true."),
    gate("schema_proposal_only", schemaProposal.status === "proposal_only", "info",
      "createDecisionSupportShadowStorageSchemaProposal() always returns status: proposal_only."),
    gate("migration_not_created", migrationProposal.migrationFileCreated === false, "info",
      "createDecisionSupportShadowStorageMigrationProposal() always returns migrationFileCreated: false."),
    gate("table_not_created", schemaProposal.tableCreated === false, "info",
      "createDecisionSupportShadowStorageSchemaProposal() always returns tableCreated: false."),
    gate("adapter_not_real", true, "info",
      "This module ships no real storage adapter — only a contract plan and a no-op simulation."),
    gate("no_db_write", auditSummary ? auditSummary.dbWriteAttempted !== true : true, "info",
      "No database write is ever attempted by this module."),
    gate("no_supabase_write", auditSummary ? auditSummary.supabaseWriteAttempted !== true : true, "info",
      "No Supabase write is ever attempted by this module."),
    gate("router_unchanged", options.routerTouched !== true, "info",
      "This module does not import brainRouter.ts, responseComposer.ts, any handlers/*.ts, or conversationalBrainGateway.ts."),
    gate("adapter_mapping_unchanged", options.adapterMappingTouched !== true, "info",
      "This module does not import or modify intentCompatibilityAdapter.ts."),
  ];

  return results;
}

// ─── No-op adapter simulation ─────────────────────────────────────────────────────────────

/**
 * Simulates the future adapter's contract for a single draft, without ever writing anywhere: runs
 * `validateDecisionSupportShadowStorageDraft()`, and reports `noopWriteAccepted: true` only if every
 * blocking validation gate passes. This is **not** a real adapter and not even a fake one — it is a
 * contract simulation proving what a `writeCaptureDraft` call *would* decide, while
 * `writeAttempted`/`realPersistenceAttempted`/`dbWriteAttempted`/`supabaseWriteAttempted` stay a
 * literal `false` unconditionally.
 */
export function simulateDecisionSupportShadowStorageAdapter(
  draft: DecisionSupportShadowStorageDraft,
  options: DecisionSupportShadowStorageDraftValidationOptions = {},
): DecisionSupportShadowStorageAdapterSimulationResult {
  const validationResults = validateDecisionSupportShadowStorageDraft(draft, options);
  const blockingFailures = validationResults.filter((r) => r.severity === "blocking" && !r.passed);
  const draftValid = blockingFailures.length === 0;

  return {
    kind: "decision_support_shadow_storage_adapter_simulation_result",
    inputCaptureId: draft.sourceCaptureId,
    draftCreated: true,
    draftValid,
    writeAttempted: false,
    realPersistenceAttempted: false,
    dbWriteAttempted: false,
    supabaseWriteAttempted: false,
    noopWriteAccepted: draftValid,
    validationResults,
    blockingFailureCount: blockingFailures.length,
    warnings: blockingFailures.map((f) => `Blocking validation gate "${f.gate}" failed: ${f.reason}`),
  };
}

// ─── Evaluation over a corpus ─────────────────────────────────────────────────────────────

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

function toCaptureRecords(
  recordsOrCases: DecisionClarificationCase[] | DecisionSupportShadowCaptureResult[] | DecisionSupportShadowCaptureRecord[],
  options: DecisionSupportShadowStorageAdapterPlanEvaluationOptions,
): DecisionSupportShadowCaptureRecord[] {
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

    return passes
      .flat()
      .map((r) => r.record)
      .filter((r): r is DecisionSupportShadowCaptureRecord => Boolean(r));
  }

  if (looksLikeCaptureResult(recordsOrCases[0])) {
    return (recordsOrCases as DecisionSupportShadowCaptureResult[])
      .map((r) => r.record)
      .filter((r): r is DecisionSupportShadowCaptureRecord => Boolean(r));
  }

  return recordsOrCases as DecisionSupportShadowCaptureRecord[];
}

/**
 * Runs the full Sprint 27R plan over a corpus: generates capture records (via the reused Sprint 25R
 * harness, by default `dry_run`, plus `test_only_in_memory` when `options.includeTestMemoryPass` is
 * true), maps each to a storage draft, validates the draft, and runs the no-op contract simulation.
 * Accepts a `DecisionClarificationCase[]` (the default entry point), an already-computed
 * `DecisionSupportShadowCaptureResult[]`, or a `DecisionSupportShadowCaptureRecord[]` directly (used by
 * this module's own synthetic-record tests). Never creates a database, migration, storage adapter, or
 * Supabase write.
 */
export function runDecisionSupportShadowStorageAdapterPlanEvaluation(
  recordsOrCases: DecisionClarificationCase[] | DecisionSupportShadowCaptureResult[] | DecisionSupportShadowCaptureRecord[],
  options: DecisionSupportShadowStorageAdapterPlanEvaluationOptions = {},
): DecisionSupportShadowStorageAdapterPlanEvaluationResult[] {
  const records = toCaptureRecords(recordsOrCases, options);
  return records.map((record) => {
    const draft = mapDecisionSupportCaptureRecordToStorageDraft(record);
    const validationResults = validateDecisionSupportShadowStorageDraft(draft);
    const simulation = simulateDecisionSupportShadowStorageAdapter(draft);
    return { captureId: draft.sourceCaptureId, draft, validationResults, simulation } satisfies DecisionSupportShadowStorageAdapterPlanEvaluationResult;
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function rateOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0;
}

function failedGateCount(result: DecisionSupportShadowStorageAdapterPlanEvaluationResult, gateName: DecisionSupportShadowStorageDraftValidationGate): boolean {
  return result.validationResults.some((v) => v.gate === gateName && !v.passed);
}

const RECOMMENDED_NEXT_SPRINT: DecisionSupportShadowStorageAdapterPlanNextSprintRecommendation = "Sprint 28R — Shadow Capture Storage Adapter Fake Implementation";

const REPRESENTATIVE_LIMIT = 8;
const WEAK_LIMIT = 5;
const BLOCKING_FAILURE_LIMIT = 10;

function computeReadinessStatus(
  anyPolicyViolation: boolean,
  validDraftRate: number,
  usesInMemorySink: boolean,
): DecisionSupportShadowStorageAdapterPlanReadinessStatus {
  if (anyPolicyViolation) return "blocked_by_policy_violation";
  if (validDraftRate < 100) return "not_ready_for_adapter_implementation";
  return usesInMemorySink ? "ready_for_fake_adapter_implementation" : "ready_for_noop_adapter_implementation";
}

function recommendationFor(status: DecisionSupportShadowStorageAdapterPlanReadinessStatus): string {
  switch (status) {
    case "blocked_by_policy_violation":
      return "At least one mapped draft carried raw input, an input preview, a full candidate, user-visible output, a project name, an email address, or a phone number — fix the offending capture path before any adapter implementation.";
    case "not_ready_for_adapter_implementation":
      return "At least one draft failed a blocking validation gate that is not a raw-content violation — resolve it before designing a fake adapter implementation.";
    case "ready_for_fake_adapter_implementation":
      return "Every draft is policy-clean and every blocking validation gate passes, including a test_only_in_memory pass — Sprint 28R can implement a fake (in-memory) adapter against this exact contract.";
    case "ready_for_noop_adapter_implementation":
      return "Every draft is policy-clean and every blocking validation gate passes in dry_run — Sprint 28R can implement at least a no-op adapter against this contract; a test_only_in_memory pass would additionally validate readiness for a fake in-memory implementation.";
    default:
      return "";
  }
}

/**
 * Turns a `runDecisionSupportShadowStorageAdapterPlanEvaluation()` result array into a review-ready
 * report: draft validity counts, per-forbidden-field inclusion counts (expected zero against the
 * Sprint 18R corpus), schema/migration invariants, a readiness status, and a Sprint 28R
 * recommendation. Pure — takes an already-computed result array rather than re-running anything.
 */
export function summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(
  results: DecisionSupportShadowStorageAdapterPlanEvaluationResult[],
): DecisionSupportShadowStorageAdapterPlanEvaluationSummary {
  const totalCaptureRecords = results.length;
  const totalDraftsCreated = results.filter((r) => Boolean(r.draft)).length;

  const validDraftCount = results.filter((r) => r.simulation.draftValid).length;
  const validDraftRate = rateOf(validDraftCount, totalCaptureRecords);
  const invalidDraftCount = totalCaptureRecords - validDraftCount;

  const writeAttemptedCount = results.filter((r) => r.simulation.writeAttempted).length;
  const realPersistenceAttemptedCount = results.filter((r) => r.simulation.realPersistenceAttempted).length;
  const dbWriteAttemptedCount = results.filter((r) => r.simulation.dbWriteAttempted).length;
  const supabaseWriteAttemptedCount = results.filter((r) => r.simulation.supabaseWriteAttempted).length;

  const rawInputIncludedCount = results.filter((r) => failedGateCount(r, "no_raw_input")).length;
  const inputPreviewIncludedCount = results.filter((r) => failedGateCount(r, "no_input_preview")).length;
  const fullCandidateIncludedCount = results.filter((r) => failedGateCount(r, "no_full_candidate")).length;
  const userVisibleOutputIncludedCount = results.filter((r) => failedGateCount(r, "no_user_visible_output")).length;
  const projectNameIncludedCount = results.filter((r) => failedGateCount(r, "no_project_name")).length;
  const emailAddressIncludedCount = results.filter((r) => failedGateCount(r, "no_email_address")).length;
  const phoneNumberIncludedCount = results.filter((r) => failedGateCount(r, "no_phone_number")).length;

  const schemaProposal = createDecisionSupportShadowStorageSchemaProposal();

  const anyPolicyViolation =
    rawInputIncludedCount > 0 ||
    inputPreviewIncludedCount > 0 ||
    fullCandidateIncludedCount > 0 ||
    userVisibleOutputIncludedCount > 0 ||
    projectNameIncludedCount > 0 ||
    emailAddressIncludedCount > 0 ||
    phoneNumberIncludedCount > 0;

  const usesInMemorySink = results.some((r) => r.draft.fields.sinkKind === "in_memory_test_only");

  const readinessStatus = computeReadinessStatus(anyPolicyViolation, validDraftRate, usesInMemorySink);

  const representativeValidDrafts = results.filter((r) => r.simulation.draftValid).slice(0, REPRESENTATIVE_LIMIT).map((r) => r.draft);
  const weakDrafts = results.filter((r) => !r.simulation.draftValid).slice(0, WEAK_LIMIT).map((r) => r.draft);
  const blockingValidationFailures = results
    .flatMap((r) => r.validationResults.filter((v) => v.severity === "blocking" && !v.passed))
    .slice(0, BLOCKING_FAILURE_LIMIT);

  return {
    totalCaptureRecords,
    totalDraftsCreated,
    validDraftCount,
    validDraftRate,
    invalidDraftCount,
    writeAttemptedCount,
    realPersistenceAttemptedCount,
    dbWriteAttemptedCount,
    supabaseWriteAttemptedCount,
    rawInputIncludedCount,
    inputPreviewIncludedCount,
    fullCandidateIncludedCount,
    userVisibleOutputIncludedCount,
    projectNameIncludedCount,
    emailAddressIncludedCount,
    phoneNumberIncludedCount,
    schemaProposalColumnCount: schemaProposal.columns.length,
    prohibitedColumnCount: schemaProposal.prohibitedColumns.length,
    migrationCreated: false,
    tableCreated: false,
    storageAdapterRealImplemented: false,
    readinessStatus,
    recommendedNextSprint: RECOMMENDED_NEXT_SPRINT,
    recommendation: recommendationFor(readinessStatus),
    representativeValidDrafts,
    weakDrafts,
    blockingValidationFailures,
  } satisfies DecisionSupportShadowStorageAdapterPlanEvaluationSummary;
}

// ─── Explain ──────────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 27R storage adapter plan — mirrors the style of
 * `explainDecisionSupportShadowStoragePolicy()` (Sprint 26R). See
 * `docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md` for full context.
 */
export function explainDecisionSupportShadowStorageAdapterPlan(): DecisionSupportShadowStorageAdapterPlanExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-shadow-storage-adapter-plan",
    purpose:
      "Designs what a future Shadow Capture Storage Adapter would look like — its method contract, a proposed schema, a proposed " +
      "migration, a safe storage-draft mapper built on the Sprint 26R storage policy, a storage-draft validator, and a no-op contract " +
      "simulation — without creating a database, a migration file, a table, a real storage adapter, or a real repository.",
    nonGoals: [
      "Create a database, migration file, table, or Supabase write.",
      "Implement a real or fake storage adapter/repository.",
      "Implement writeCaptureDraft, deleteByCaptureId, deleteByWorkspace, purgeExpired, or listByPolicyVersion — all future-only.",
      "Activate a real feature flag.",
      "Connect decision_support (or this plan) to the router or request path.",
      "Change production behavior in any way.",
      "Show any storage draft to a user.",
      "Persist any storage draft outside this evaluation's in-process return value.",
    ],
    planProfile:
      'The "strict_default_off_adapter_plan" profile: storageEnabled/realPersistenceAllowed/storageAdapterImplemented/' +
      "dbMigrationImplemented/tableCreated/supabaseWriteImplemented/productionRouteChanged are all literal false, regardless of mode.",
    methodPolicies: METHOD_POLICY_SEEDS.map((m) => `${m.methodName}: allowedInSprint27=${m.allowedInSprint27}, futureOnly=${m.futureOnly} — ${m.reason}`),
    schemaProposal:
      `A proposal-only, never-created "${PROPOSED_TABLE_NAME}" table with ${SCHEMA_COLUMN_SEEDS.length} allowed/minimized/hashed ` +
      `columns and ${PROHIBITED_SCHEMA_COLUMNS.length} explicitly prohibited columns — a plain TypeScript object, not a migration or SQL file.`,
    migrationProposal:
      'proposedMigrationName: "add_decision_support_shadow_captures_default_off" — documented preconditions, prohibited contents, ' +
      "rollback requirements, and deletion requirements, with migrationFileCreated/migrationShouldNotBeCreatedInSprint27 fixed at " +
      "false/true respectively; no migration or SQL file exists anywhere in this package tree.",
    storageDraftMappingPolicy:
      "mapDecisionSupportCaptureRecordToStorageDraft() only ever includes captureId, a hashed sourceRunId, generatedAt, mode, " +
      "sinkKind, inputHash, routing labels, a minimized candidateSummary/gateSummary, safetySnapshot, auditSummary, " +
      "allBlockingGatesPassed, retentionMode, a null retentionExpiresAt, and deletionRequired: true — never rawInput, inputPreview, a " +
      "full candidate, userVisibleOutput, projectName, emailAddress, or phoneNumber.",
    storageDraftValidationGates: [
      "storage_disabled / policy_profile_attached / policy_version_attached: blocking; core plan invariants.",
      "no_raw_input / no_input_preview / no_full_candidate / no_user_visible_output / no_project_name / no_email_address / " +
        "no_phone_number: blocking; fail if the corresponding forbidden key or content pattern appears anywhere on the draft.",
      "candidate_summary_minimized / safety_snapshot_only / audit_summary_only: blocking; the three structured summaries must exist " +
        "and stay minimized/side-effect-free/raw-payload-free.",
      "retention_policy_attached / deletion_policy_attached: blocking; retentionMode must be set and deletionRequired must be true.",
      "schema_proposal_only / migration_not_created / table_not_created / adapter_not_real / no_db_write / no_supabase_write / " +
        "router_unchanged / adapter_mapping_unchanged: informational; always true by this module's own construction.",
    ],
    noopSimulation:
      "simulateDecisionSupportShadowStorageAdapter() validates a draft and reports noopWriteAccepted only if every blocking gate " +
      "passes — writeAttempted/realPersistenceAttempted/dbWriteAttempted/supabaseWriteAttempted stay a literal false unconditionally. " +
      "This is a contract simulation, not a real or fake adapter.",
    whyDbIsNotCreated:
      "No tenant isolation, access control, or deletion path exists yet for a real write — writing to a real database today would " +
      "create ungoverned, undeletable data, exactly what Sprint 26R's deletion policy forbids.",
    whyMigrationIsNotCreated:
      "A migration presumes a settled, reviewed schema and a real deletion/rollback path; this sprint only proposes the schema and " +
      "documents (never implements) the migration's requirements.",
    whyStorageAdapterIsNotCreated:
      "A real (or even fake) adapter presumes writeCaptureDraft exists; this sprint keeps writeCaptureDraft, deleteByCaptureId, " +
      "deleteByWorkspace, purgeExpired, and listByPolicyVersion all futureOnly — named and policy-gated, not implemented.",
    whyWriteCaptureDraftIsFutureOnly:
      "writeCaptureDraft would perform the first real (or fake) write. It requires tenant isolation, access control, and a deletion " +
      "path to exist first — none of which this sprint builds — so it stays futureOnly: true, allowedInSprint27: false.",
    expectedSprint28Path:
      "If validDraftRate stays at 100% and every forbidden-field inclusion count stays at 0 against the Sprint 18R corpus, Sprint 28R " +
      "can implement a fake (in-memory, still never touching a real database) adapter against this exact contract — still default-off, " +
      "still no router/composer/production change.",
  };
}
