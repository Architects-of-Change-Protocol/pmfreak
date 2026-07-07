/**
 * Sprint 29R — Decision Support Shadow Capture Storage Adapter Persistence Readiness Review.
 *
 * A pure, offline, deterministic **readiness review** — not an implementation — that decides whether
 * PMFreak is ready to move toward any form of real persistence for the shadow capture pipeline built
 * across Sprint 24R (shadow mode prep), Sprint 25R (capture harness), Sprint 26R (storage policy),
 * Sprint 27R (storage adapter plan), and Sprint 28R (fake adapter). It re-runs those sprints' own
 * reused evaluation functions, assesses 19 readiness domains against the resulting metrics (plus a
 * fixed set of domains — schema proposal, migration proposal, deletion/purge, retention, tenant/
 * workspace isolation, access control, audit trail, observability, rollback, security review,
 * production wiring, feature flagging, data subject rights — that this review can only ever assess as
 * not-yet-built, since nothing in this package tree implements them), and produces a decision matrix.
 *
 * By construction, this module never creates a database, migration file, SQL file, table, Supabase
 * write, real storage adapter, or real repository, and it does not import the router, composer, any
 * production handler, or the gateway. See
 * `docs/conversational-brain-decision-support-shadow-persistence-readiness.md` for the full design
 * writeup.
 */

import type { DecisionClarificationCase } from "../classifier/decisionClarificationArchitectureReview";
import {
  runDecisionSupportShadowCaptureHarnessEvaluation,
  summarizeDecisionSupportShadowCaptureHarnessEvaluation,
} from "./decisionSupportShadowCaptureHarness";
import {
  runDecisionSupportShadowStoragePolicyEvaluation,
  summarizeDecisionSupportShadowStoragePolicyEvaluation,
} from "./decisionSupportShadowCaptureStoragePolicy";
import {
  runDecisionSupportShadowStorageAdapterPlanEvaluation,
  summarizeDecisionSupportShadowStorageAdapterPlanEvaluation,
} from "./decisionSupportShadowCaptureStorageAdapterPlan";
import {
  runDecisionSupportShadowStorageFakeAdapterEvaluation,
  summarizeDecisionSupportShadowStorageFakeAdapterEvaluation,
} from "./decisionSupportShadowCaptureStorageFakeAdapter";

import type {
  DecisionSupportShadowPersistenceReadinessBlocker,
  DecisionSupportShadowPersistenceReadinessDecision,
  DecisionSupportShadowPersistenceReadinessDecisionMatrix,
  DecisionSupportShadowPersistenceReadinessDomain,
  DecisionSupportShadowPersistenceReadinessDomainAssessment,
  DecisionSupportShadowPersistenceReadinessEvaluationSummary,
  DecisionSupportShadowPersistenceReadinessExplain,
  DecisionSupportShadowPersistenceReadinessInputMetrics,
  DecisionSupportShadowPersistenceReadinessOptions,
  DecisionSupportShadowPersistenceReadinessPrerequisite,
  DecisionSupportShadowPersistenceReadinessReview,
  DecisionSupportShadowPersistenceReadinessRiskLevel,
  DecisionSupportShadowPersistenceReadinessStatus,
} from "./decisionSupportShadowCapturePersistenceReadinessTypes";

export type {
  DecisionSupportShadowPersistenceReadinessProfile,
  DecisionSupportShadowPersistenceReadinessMode,
  DecisionSupportShadowPersistenceReadinessDecision,
  DecisionSupportShadowPersistenceReadinessDomain,
  DecisionSupportShadowPersistenceReadinessRiskLevel,
  DecisionSupportShadowPersistenceReadinessStatus,
  DecisionSupportShadowPersistenceReadinessBlocker,
  DecisionSupportShadowPersistenceReadinessPrerequisite,
  DecisionSupportShadowPersistenceReadinessDomainAssessment,
  DecisionSupportShadowPersistenceReadinessDecisionMatrix,
  DecisionSupportShadowPersistenceReadinessCaptureHarnessMetrics,
  DecisionSupportShadowPersistenceReadinessStoragePolicyMetrics,
  DecisionSupportShadowPersistenceReadinessAdapterPlanMetrics,
  DecisionSupportShadowPersistenceReadinessFakeAdapterMetrics,
  DecisionSupportShadowPersistenceReadinessInputMetrics,
  DecisionSupportShadowPersistenceReadinessReview,
  DecisionSupportShadowPersistenceReadinessOptions,
  DecisionSupportShadowPersistenceReadinessEvaluationSummary,
  DecisionSupportShadowPersistenceReadinessExplain,
} from "./decisionSupportShadowCapturePersistenceReadinessTypes";

export const DECISION_SUPPORT_SHADOW_PERSISTENCE_READINESS_VERSION = "29R.1.0";

const RECOMMENDED_NEXT_SPRINT = "Sprint 30R — Controlled Shadow Replay Evaluation";

// ─── Helpers ────────────────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type RequirementFlags = { realPersistence?: boolean; migrationFile?: boolean; defaultOffPrototype?: boolean };

function makeBlocker(
  id: string,
  domain: DecisionSupportShadowPersistenceReadinessDomain,
  severity: "warning" | "blocking" | "critical",
  title: string,
  description: string,
  reqs: RequirementFlags = {},
  recommendedResolutionSprint?: string,
): DecisionSupportShadowPersistenceReadinessBlocker {
  return {
    id,
    domain,
    severity,
    title,
    description,
    requiredBeforeRealPersistence: reqs.realPersistence ?? false,
    requiredBeforeMigrationFile: reqs.migrationFile ?? false,
    requiredBeforeDefaultOffPrototype: reqs.defaultOffPrototype ?? false,
    ...(recommendedResolutionSprint ? { recommendedResolutionSprint } : {}),
  };
}

function makePrerequisite(
  id: string,
  domain: DecisionSupportShadowPersistenceReadinessDomain,
  title: string,
  description: string,
  satisfied: boolean,
  evidence: string[],
  reqs: RequirementFlags = {},
): DecisionSupportShadowPersistenceReadinessPrerequisite {
  return {
    id,
    domain,
    title,
    description,
    satisfied,
    evidence: [...evidence],
    requiredBeforeRealPersistence: reqs.realPersistence ?? false,
    requiredBeforeMigrationFile: reqs.migrationFile ?? false,
    requiredBeforeDefaultOffPrototype: reqs.defaultOffPrototype ?? false,
  };
}

// ─── Domains ────────────────────────────────────────────────────────────────────────────

const ALL_DOMAINS: DecisionSupportShadowPersistenceReadinessDomain[] = [
  "storage_policy",
  "capture_harness",
  "storage_draft_mapping",
  "fake_adapter",
  "schema_proposal",
  "migration_proposal",
  "deletion_purge",
  "retention",
  "tenant_workspace_isolation",
  "access_control",
  "audit_trail",
  "observability",
  "rollback",
  "security_review",
  "production_wiring",
  "feature_flagging",
  "data_subject_rights",
  "privacy_minimization",
  "test_coverage",
];

/** Returns a fresh copy of every readiness domain this review assesses, in a fixed order. */
export function listDecisionSupportShadowPersistenceReadinessDomains(): DecisionSupportShadowPersistenceReadinessDomain[] {
  return [...ALL_DOMAINS];
}

// ─── Default synthetic corpus ───────────────────────────────────────────────────────────

/**
 * A minimal, self-contained synthetic corpus (not imported from `tests/fixtures/`, mirroring how
 * Sprint 28R's `buildBaseValidDraft()` builds its own synthetic input rather than depending on a test
 * fixture) — used only when `createDecisionSupportShadowPersistenceReadinessInputMetrics()` is called
 * with no corpus. Callers who want the full Sprint 18R corpus's metrics (the ones this sprint's
 * baseline numbers describe) pass `DECISION_CLARIFICATION_CASES` explicitly.
 */
const DEFAULT_SYNTHETIC_CORPUS: DecisionClarificationCase[] = [
  {
    id: "psr-synthetic-01",
    input: "Deberiamos usar Postgres o Mongo para el nuevo servicio de facturacion del equipo?",
    architectureCategory: "decision_support_clear",
    desiredFutureRoute: "decision_support",
    currentSafeMappedIntent: "unsupported",
    targetKind: "future_architecture",
    rationale: "A synthetic default-corpus case, used only when no corpus is supplied to createDecisionSupportShadowPersistenceReadinessInputMetrics().",
    riskLevel: "medium",
    requiresNewHandler: true,
    requiresClarification: false,
    shouldExecuteAction: false,
  },
  {
    id: "psr-synthetic-02",
    input: "no estoy seguro que alternativa conviene mas para este proyecto",
    architectureCategory: "clarification_clear",
    desiredFutureRoute: "needs_clarification",
    currentSafeMappedIntent: "general_pm_advice",
    targetKind: "clarification_strategy",
    rationale: "A second synthetic default-corpus case, used only when no corpus is supplied.",
    riskLevel: "medium",
    requiresNewHandler: false,
    requiresClarification: true,
    shouldExecuteAction: false,
  },
];

// ─── Input metrics ──────────────────────────────────────────────────────────────────────

/**
 * Runs the Sprint 25R capture harness, Sprint 26R storage policy, Sprint 27R adapter plan, and
 * Sprint 28R fake adapter evaluations (in that order, each reusing that sprint's own `run*`/
 * `summarize*` pair exactly as-is) against `cases` (defaulting to a minimal, self-contained synthetic
 * corpus when omitted), and collects the subset of each summary's metrics this review needs. Never
 * creates a database, migration, storage adapter, or Supabase write — every evaluation here is the
 * same pure, offline evaluation those sprints already ship.
 */
export function createDecisionSupportShadowPersistenceReadinessInputMetrics(
  cases: DecisionClarificationCase[] = DEFAULT_SYNTHETIC_CORPUS,
  options: { now?: string } = {},
): DecisionSupportShadowPersistenceReadinessInputMetrics {
  const now = options.now;

  const captureHarnessResults = runDecisionSupportShadowCaptureHarnessEvaluation(cases, { now, context: { mode: "dry_run" } });
  const captureHarnessSummary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(captureHarnessResults);

  const storagePolicyResults = runDecisionSupportShadowStoragePolicyEvaluation(cases, { now });
  const storagePolicySummary = summarizeDecisionSupportShadowStoragePolicyEvaluation(storagePolicyResults);

  const adapterPlanResults = runDecisionSupportShadowStorageAdapterPlanEvaluation(cases, { now });
  const adapterPlanSummary = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(adapterPlanResults);

  const fakeAdapterResults = runDecisionSupportShadowStorageFakeAdapterEvaluation(cases, { now });
  const fakeAdapterSummary = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(fakeAdapterResults);

  return {
    captureHarness: {
      acceptableCaptureRate: captureHarnessSummary.acceptableCaptureRate,
      allBlockingGatesPassedRate: captureHarnessSummary.allBlockingGatesPassedRate,
      rawInputRetainedCount: captureHarnessSummary.rawInputRetainedCount,
      fullDecisionCandidateRetainedCount: captureHarnessSummary.fullDecisionCandidateRetainedCount,
      fullClarificationCandidateRetainedCount: captureHarnessSummary.fullClarificationCandidateRetainedCount,
      userVisibleOutputRetainedCount: captureHarnessSummary.userVisibleOutputRetainedCount,
      dbWriteAttemptedCount: captureHarnessSummary.dbWriteAttemptedCount,
      supabaseWriteAttemptedCount: captureHarnessSummary.supabaseWriteAttemptedCount,
    },
    storagePolicy: {
      rawInputViolationCount: storagePolicySummary.rawInputViolationCount,
      fullCandidateViolationCount: storagePolicySummary.fullCandidateViolationCount,
      userVisibleOutputViolationCount: storagePolicySummary.userVisibleOutputViolationCount,
      dbWriteViolationCount: storagePolicySummary.dbWriteViolationCount,
      supabaseWriteViolationCount: storagePolicySummary.supabaseWriteViolationCount,
      sideEffectViolationCount: storagePolicySummary.sideEffectViolationCount,
      captureHarnessCleanRate: storagePolicySummary.captureHarnessCleanRate,
      blockingReadinessGateFailureCount: storagePolicySummary.blockingReadinessGateFailureCount,
    },
    adapterPlan: {
      totalDraftsCreated: adapterPlanSummary.totalDraftsCreated,
      validDraftRate: adapterPlanSummary.validDraftRate,
      invalidDraftCount: adapterPlanSummary.invalidDraftCount,
      writeAttemptedCount: adapterPlanSummary.writeAttemptedCount,
      realPersistenceAttemptedCount: adapterPlanSummary.realPersistenceAttemptedCount,
      dbWriteAttemptedCount: adapterPlanSummary.dbWriteAttemptedCount,
      supabaseWriteAttemptedCount: adapterPlanSummary.supabaseWriteAttemptedCount,
      rawInputIncludedCount: adapterPlanSummary.rawInputIncludedCount,
      inputPreviewIncludedCount: adapterPlanSummary.inputPreviewIncludedCount,
      fullCandidateIncludedCount: adapterPlanSummary.fullCandidateIncludedCount,
      userVisibleOutputIncludedCount: adapterPlanSummary.userVisibleOutputIncludedCount,
      projectNameIncludedCount: adapterPlanSummary.projectNameIncludedCount,
      emailAddressIncludedCount: adapterPlanSummary.emailAddressIncludedCount,
      phoneNumberIncludedCount: adapterPlanSummary.phoneNumberIncludedCount,
      migrationCreated: false,
      tableCreated: false,
      storageAdapterRealImplemented: false,
    },
    fakeAdapter: {
      totalDraftsCreated: fakeAdapterSummary.totalDraftsCreated,
      fakeWriteAcceptedRate: fakeAdapterSummary.fakeWriteAcceptedRate,
      fakeWriteRejectedCount: fakeAdapterSummary.fakeWriteRejectedCount,
      invalidDraftRejectedCount: fakeAdapterSummary.invalidDraftRejectedCount,
      realPersistenceAttemptedCount: fakeAdapterSummary.realPersistenceAttemptedCount,
      dbWriteAttemptedCount: fakeAdapterSummary.dbWriteAttemptedCount,
      supabaseWriteAttemptedCount: fakeAdapterSummary.supabaseWriteAttemptedCount,
      externalCallAttemptedCount: fakeAdapterSummary.externalCallAttemptedCount,
      rawInputStoredCount: fakeAdapterSummary.rawInputStoredCount,
      inputPreviewStoredCount: fakeAdapterSummary.inputPreviewStoredCount,
      fullCandidateStoredCount: fakeAdapterSummary.fullCandidateStoredCount,
      userVisibleOutputStoredCount: fakeAdapterSummary.userVisibleOutputStoredCount,
      projectNameStoredCount: fakeAdapterSummary.projectNameStoredCount,
      emailAddressStoredCount: fakeAdapterSummary.emailAddressStoredCount,
      phoneNumberStoredCount: fakeAdapterSummary.phoneNumberStoredCount,
      validDraftRate: fakeAdapterSummary.validDraftRate,
      fakeAdapterSafetyRate: fakeAdapterSummary.fakeAdapterSafetyRate,
    },
  } satisfies DecisionSupportShadowPersistenceReadinessInputMetrics;
}

// ─── Metric-dependent domain assessments ───────────────────────────────────────────────

function assessStoragePolicy(metrics: DecisionSupportShadowPersistenceReadinessInputMetrics): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  const m = metrics.storagePolicy;
  const clean =
    m.rawInputViolationCount === 0 &&
    m.fullCandidateViolationCount === 0 &&
    m.userVisibleOutputViolationCount === 0 &&
    m.dbWriteViolationCount === 0 &&
    m.supabaseWriteViolationCount === 0 &&
    m.sideEffectViolationCount === 0 &&
    m.captureHarnessCleanRate === 100 &&
    m.blockingReadinessGateFailureCount === 0;

  const evidence = [
    `rawInputViolationCount=${m.rawInputViolationCount}`,
    `fullCandidateViolationCount=${m.fullCandidateViolationCount}`,
    `userVisibleOutputViolationCount=${m.userVisibleOutputViolationCount}`,
    `dbWriteViolationCount=${m.dbWriteViolationCount}`,
    `supabaseWriteViolationCount=${m.supabaseWriteViolationCount}`,
    `sideEffectViolationCount=${m.sideEffectViolationCount}`,
    `captureHarnessCleanRate=${m.captureHarnessCleanRate}%`,
    `blockingReadinessGateFailureCount=${m.blockingReadinessGateFailureCount}`,
  ];

  return {
    domain: "storage_policy",
    status: clean ? "ready" : "not_ready",
    riskLevel: clean ? "low" : "high",
    score: clean ? 100 : 40,
    blockers: clean
      ? []
      : [
          makeBlocker(
            "psr-blk-storage-policy-violation",
            "storage_policy",
            "critical",
            "Storage policy violation detected",
            "At least one storage-policy violation counter or blocking readiness gate failure was observed against the corpus.",
            { realPersistence: true },
          ),
        ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-storage-policy-clean",
        "storage_policy",
        "Storage policy stays clean",
        "Zero violation counts and a 100% capture-harness-clean rate, sustained across every evaluation run.",
        clean,
        evidence,
      ),
    ],
    evidence,
    recommendation: clean
      ? "Sprint 26R storage policy stays clean against this corpus — no action required before Sprint 30R."
      : "Resolve the storage policy violation before any further persistence readiness work.",
  };
}

function assessCaptureHarness(metrics: DecisionSupportShadowPersistenceReadinessInputMetrics): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  const m = metrics.captureHarness;
  const clean =
    m.acceptableCaptureRate === 100 &&
    m.allBlockingGatesPassedRate === 100 &&
    m.rawInputRetainedCount === 0 &&
    m.fullDecisionCandidateRetainedCount === 0 &&
    m.fullClarificationCandidateRetainedCount === 0 &&
    m.userVisibleOutputRetainedCount === 0 &&
    m.dbWriteAttemptedCount === 0 &&
    m.supabaseWriteAttemptedCount === 0;

  const evidence = [
    `acceptableCaptureRate=${m.acceptableCaptureRate}%`,
    `allBlockingGatesPassedRate=${m.allBlockingGatesPassedRate}%`,
    `rawInputRetainedCount=${m.rawInputRetainedCount}`,
    `fullDecisionCandidateRetainedCount=${m.fullDecisionCandidateRetainedCount}`,
    `fullClarificationCandidateRetainedCount=${m.fullClarificationCandidateRetainedCount}`,
    `userVisibleOutputRetainedCount=${m.userVisibleOutputRetainedCount}`,
    `dbWriteAttemptedCount=${m.dbWriteAttemptedCount}`,
    `supabaseWriteAttemptedCount=${m.supabaseWriteAttemptedCount}`,
  ];

  return {
    domain: "capture_harness",
    status: clean ? "ready" : "not_ready",
    riskLevel: clean ? "low" : "high",
    score: clean ? 100 : 40,
    blockers: clean
      ? []
      : [
          makeBlocker(
            "psr-blk-capture-harness-violation",
            "capture_harness",
            "critical",
            "Capture harness violation detected",
            "At least one capture-harness retention/side-effect counter was non-zero, or the acceptable/blocking-gate rate was below 100%.",
            { realPersistence: true },
          ),
        ],
    prerequisites: [makePrerequisite("psr-pre-capture-harness-clean", "capture_harness", "Capture harness stays clean", "100% acceptable/blocking-gate rate and zero retention/side-effect counters.", clean, evidence)],
    evidence,
    recommendation: clean
      ? "Sprint 25R capture harness stays clean against this corpus — no action required before Sprint 30R."
      : "Resolve the capture harness violation before any further persistence readiness work.",
  };
}

function assessStorageDraftMapping(metrics: DecisionSupportShadowPersistenceReadinessInputMetrics): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  const m = metrics.adapterPlan;
  const clean =
    m.totalDraftsCreated > 0 &&
    m.validDraftRate === 100 &&
    m.invalidDraftCount === 0 &&
    m.rawInputIncludedCount === 0 &&
    m.inputPreviewIncludedCount === 0 &&
    m.fullCandidateIncludedCount === 0 &&
    m.userVisibleOutputIncludedCount === 0 &&
    m.projectNameIncludedCount === 0 &&
    m.emailAddressIncludedCount === 0 &&
    m.phoneNumberIncludedCount === 0;

  const evidence = [
    `totalDraftsCreated=${m.totalDraftsCreated}`,
    `validDraftRate=${m.validDraftRate}%`,
    `invalidDraftCount=${m.invalidDraftCount}`,
    `rawInputIncludedCount=${m.rawInputIncludedCount}`,
    `inputPreviewIncludedCount=${m.inputPreviewIncludedCount}`,
    `fullCandidateIncludedCount=${m.fullCandidateIncludedCount}`,
    `userVisibleOutputIncludedCount=${m.userVisibleOutputIncludedCount}`,
    `projectNameIncludedCount=${m.projectNameIncludedCount}`,
    `emailAddressIncludedCount=${m.emailAddressIncludedCount}`,
    `phoneNumberIncludedCount=${m.phoneNumberIncludedCount}`,
  ];

  return {
    domain: "storage_draft_mapping",
    status: clean ? "ready" : "not_ready",
    riskLevel: clean ? "low" : "high",
    score: clean ? 100 : 40,
    blockers: clean
      ? []
      : [
          makeBlocker(
            "psr-blk-storage-draft-mapping-violation",
            "storage_draft_mapping",
            "critical",
            "Storage draft mapping violation detected",
            "At least one Sprint 27R storage draft carried a forbidden field, or the valid-draft rate was below 100%.",
            { realPersistence: true },
          ),
        ],
    prerequisites: [makePrerequisite("psr-pre-storage-draft-mapping-clean", "storage_draft_mapping", "Every storage draft stays policy-clean", "100% valid-draft rate and zero forbidden-field inclusion counts.", clean, evidence)],
    evidence,
    recommendation: clean
      ? "Sprint 27R storage draft mapping stays clean against this corpus — no action required before Sprint 30R."
      : "Resolve the storage draft mapping violation before any further persistence readiness work.",
  };
}

function assessFakeAdapter(metrics: DecisionSupportShadowPersistenceReadinessInputMetrics): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  const m = metrics.fakeAdapter;
  const clean =
    m.fakeWriteAcceptedRate === 100 &&
    m.fakeWriteRejectedCount === 0 &&
    m.invalidDraftRejectedCount > 0 &&
    m.realPersistenceAttemptedCount === 0 &&
    m.dbWriteAttemptedCount === 0 &&
    m.supabaseWriteAttemptedCount === 0 &&
    m.externalCallAttemptedCount === 0 &&
    m.rawInputStoredCount === 0 &&
    m.inputPreviewStoredCount === 0 &&
    m.fullCandidateStoredCount === 0 &&
    m.userVisibleOutputStoredCount === 0 &&
    m.projectNameStoredCount === 0 &&
    m.emailAddressStoredCount === 0 &&
    m.phoneNumberStoredCount === 0 &&
    m.validDraftRate === 100 &&
    m.fakeAdapterSafetyRate === 100;

  const evidence = [
    `fakeWriteAcceptedRate=${m.fakeWriteAcceptedRate}%`,
    `fakeWriteRejectedCount=${m.fakeWriteRejectedCount}`,
    `invalidDraftRejectedCount=${m.invalidDraftRejectedCount}`,
    `realPersistenceAttemptedCount=${m.realPersistenceAttemptedCount}`,
    `dbWriteAttemptedCount=${m.dbWriteAttemptedCount}`,
    `supabaseWriteAttemptedCount=${m.supabaseWriteAttemptedCount}`,
    `externalCallAttemptedCount=${m.externalCallAttemptedCount}`,
    `validDraftRate=${m.validDraftRate}%`,
    `fakeAdapterSafetyRate=${m.fakeAdapterSafetyRate}%`,
  ];

  return {
    domain: "fake_adapter",
    status: clean ? "ready" : "not_ready",
    riskLevel: clean ? "low" : "high",
    score: clean ? 100 : 40,
    blockers: clean
      ? []
      : [
          makeBlocker(
            "psr-blk-fake-adapter-violation",
            "fake_adapter",
            "critical",
            "Fake adapter safety violation detected",
            "At least one real/db/supabase/external/forbidden-content-stored counter was non-zero, or a synthetic invalid draft was incorrectly accepted.",
            { realPersistence: true },
          ),
        ],
    prerequisites: [makePrerequisite("psr-pre-fake-adapter-clean", "fake_adapter", "Fake adapter stays safe", "100% fake-write-accepted/valid-draft/safety rate, every synthetic invalid draft rejected, every real/db/supabase/external counter at zero.", clean, evidence)],
    evidence,
    recommendation: clean
      ? "Sprint 28R fake adapter stays safe against this corpus — no action required before Sprint 30R."
      : "Resolve the fake adapter safety violation before any further persistence readiness work.",
  };
}

function assessPrivacyMinimization(metrics: DecisionSupportShadowPersistenceReadinessInputMetrics): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  const counters = [
    metrics.captureHarness.rawInputRetainedCount,
    metrics.captureHarness.fullDecisionCandidateRetainedCount,
    metrics.captureHarness.fullClarificationCandidateRetainedCount,
    metrics.captureHarness.userVisibleOutputRetainedCount,
    metrics.adapterPlan.rawInputIncludedCount,
    metrics.adapterPlan.inputPreviewIncludedCount,
    metrics.adapterPlan.fullCandidateIncludedCount,
    metrics.adapterPlan.userVisibleOutputIncludedCount,
    metrics.adapterPlan.projectNameIncludedCount,
    metrics.adapterPlan.emailAddressIncludedCount,
    metrics.adapterPlan.phoneNumberIncludedCount,
    metrics.fakeAdapter.rawInputStoredCount,
    metrics.fakeAdapter.inputPreviewStoredCount,
    metrics.fakeAdapter.fullCandidateStoredCount,
    metrics.fakeAdapter.userVisibleOutputStoredCount,
    metrics.fakeAdapter.projectNameStoredCount,
    metrics.fakeAdapter.emailAddressStoredCount,
    metrics.fakeAdapter.phoneNumberStoredCount,
  ];
  const clean = counters.every((c) => c === 0);
  const evidence = [
    `sum of every raw/full-candidate/user-visible-output/project-name/email/phone counter across capture harness, adapter plan, and fake adapter = ${counters.reduce((a, b) => a + b, 0)}`,
  ];

  return {
    domain: "privacy_minimization",
    status: clean ? "ready" : "not_ready",
    riskLevel: clean ? "low" : "critical",
    score: clean ? 100 : 20,
    blockers: clean
      ? []
      : [
          makeBlocker(
            "psr-blk-privacy-minimization-violation",
            "privacy_minimization",
            "critical",
            "A raw/full-candidate/user-visible-output/PII counter is non-zero",
            "At least one raw input, full candidate, user-visible output, project name, email address, or phone number counter was observed as non-zero across capture, draft, or fake-adapter evaluation.",
            { realPersistence: true },
          ),
        ],
    prerequisites: [makePrerequisite("psr-pre-privacy-minimization-clean", "privacy_minimization", "Every raw/full/PII counter stays zero", "Every raw-content and personal-contact-information counter across capture harness, adapter plan, and fake adapter stays at zero.", clean, evidence, { realPersistence: true })],
    evidence,
    recommendation: clean
      ? "Privacy minimization holds across every layer of this pipeline — no raw content or personal contact information is ever retained."
      : "At least one privacy-minimization counter is non-zero — this must be resolved before any further persistence readiness work.",
  };
}

function assessTestCoverage(metrics: DecisionSupportShadowPersistenceReadinessInputMetrics): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  const metricsExist = metrics.fakeAdapter.totalDraftsCreated > 0 && metrics.adapterPlan.totalDraftsCreated > 0;
  const evidence = [
    `Sprint 27R adapterPlan.totalDraftsCreated=${metrics.adapterPlan.totalDraftsCreated}`,
    `Sprint 28R fakeAdapter.totalDraftsCreated=${metrics.fakeAdapter.totalDraftsCreated}`,
    "Sprint 24R-28R each ship their own passing test suite (tests/playbook-engine-conversation-decision-support-shadow-*.test.mjs).",
  ];

  return {
    domain: "test_coverage",
    status: metricsExist ? "ready" : "not_ready",
    riskLevel: metricsExist ? "low" : "medium",
    score: metricsExist ? 100 : 50,
    blockers: metricsExist
      ? []
      : [makeBlocker("psr-blk-test-coverage-missing-metrics", "test_coverage", "warning", "Sprint 24R-28R metrics are missing or empty", "No drafts were produced by the adapter plan or fake adapter evaluation against this corpus — the relevant test suites may not be exercising real cases.")],
    prerequisites: [makePrerequisite("psr-pre-test-coverage-suites-pass", "test_coverage", "Sprint 24R-28R suites pass and produce metrics", "Every Sprint 24R-28R test suite passes and produces non-empty evaluation metrics.", metricsExist, evidence)],
    evidence,
    recommendation: metricsExist
      ? "Sprint 24R-28R metrics exist and are non-empty — test coverage for the shadow capture pipeline is in place."
      : "Investigate why the Sprint 27R/28R evaluations produced no drafts against this corpus.",
  };
}

// ─── Fixed (not-yet-built) domain assessments ───────────────────────────────────────────

function assessSchemaProposal(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "schema_proposal",
    status: "partially_ready",
    riskLevel: "medium",
    score: 70,
    blockers: [
      makeBlocker(
        "psr-blk-schema-proposal-no-security-review",
        "schema_proposal",
        "warning",
        "Schema proposal must not become a migration without security review",
        "Sprint 27R's createDecisionSupportShadowStorageSchemaProposal() documents a proposal-only schema; it must not be converted into a real migration until a formal security/privacy review exists.",
        { migrationFile: true },
        "Sprint 30R — Controlled Shadow Replay Evaluation",
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-schema-proposal-security-review",
        "schema_proposal",
        "A security review of the proposed schema exists",
        "A formal security/privacy review of every proposed column, index, and constraint.",
        false,
        ["Sprint 27R schema proposal exists as a plain TypeScript object (status: proposal_only, migrationCreated: false, tableCreated: false)."],
        { migrationFile: true },
      ),
    ],
    evidence: ["Sprint 27R createDecisionSupportShadowStorageSchemaProposal() exists and is proposal_only.", "No migration file or table has ever been created from this proposal."],
    recommendation: "The schema proposal is a sound starting point, but it must not be turned into a migration until a security review exists.",
  };
}

function assessMigrationProposal(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "migration_proposal",
    status: "partially_ready",
    riskLevel: "high",
    score: 50,
    blockers: [
      makeBlocker(
        "psr-blk-migration-proposal-prereqs-missing",
        "migration_proposal",
        "blocking",
        "Migration file must not be created before tenant isolation, access control, deletion, rollback, and security review exist",
        "Sprint 27R's createDecisionSupportShadowStorageMigrationProposal() documents required preconditions that are not yet satisfied — a migration file created today would ship ungoverned, undeletable data.",
        { realPersistence: true, migrationFile: true },
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-migration-proposal-preconditions",
        "migration_proposal",
        "Every documented migration precondition is satisfied",
        "Tenant isolation, access control, a deletion path, a purge path, a rollback plan, and a security review all exist and pass.",
        false,
        ["Sprint 27R createDecisionSupportShadowStorageMigrationProposal() documents 11 required preconditions, none of which this review can yet confirm as satisfied."],
        { realPersistence: true, migrationFile: true },
      ),
    ],
    evidence: ["migrationFileCreated: false", "migrationShouldNotBeCreatedInSprint27: true (still true through Sprint 29R)"],
    recommendation: "Do not create a migration file. Revisit once tenant isolation, access control, deletion/purge, rollback, and security review all exist.",
  };
}

function assessDeletionPurge(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "deletion_purge",
    status: "partially_ready",
    riskLevel: "medium",
    score: 70,
    blockers: [
      makeBlocker("psr-blk-deletion-purge-no-real-delete", "deletion_purge", "blocking", "Real deletion path missing", "Only the Sprint 28R fake adapter's in-memory deleteByCaptureId/deleteByWorkspace exist — no real, cross-process deletion path exists.", { realPersistence: true }),
      makeBlocker("psr-blk-deletion-purge-no-real-purge", "deletion_purge", "blocking", "Real purge path missing", "Only the Sprint 28R fake adapter's in-memory purgeExpired exists — no real, cross-process purge path exists.", { realPersistence: true }),
    ],
    prerequisites: [
      makePrerequisite("psr-pre-deletion-purge-real-delete", "deletion_purge", "A real deletion path exists", "deleteByCaptureId/deleteByWorkspace implemented against real, durable storage.", false, ["Sprint 28R fake adapter deleteByCaptureId/deleteByWorkspace are in-memory only."], { realPersistence: true }),
      makePrerequisite("psr-pre-deletion-purge-real-purge", "deletion_purge", "A real purge path exists", "purgeExpired implemented against real, durable storage.", false, ["Sprint 28R fake adapter purgeExpired is in-memory only."], { realPersistence: true }),
    ],
    evidence: ["Sprint 28R fake adapter deleteByCaptureId/deleteByWorkspace/purgeExpired are implemented and tested against an in-memory array only."],
    recommendation: "The fake adapter proves the delete/purge contract works; a real deletion and purge path must exist before any real persistence.",
  };
}

function assessRetention(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "retention",
    status: "partially_ready",
    riskLevel: "medium",
    score: 70,
    blockers: [
      makeBlocker(
        "psr-blk-retention-no-enforcement",
        "retention",
        "blocking",
        "Real retention enforcement missing",
        "Sprint 26R models an ephemeral_only retention policy and Sprint 28R's fake adapter computes purgeEligible against a caller-supplied time, but no real, scheduled retention/TTL enforcement job exists.",
        { realPersistence: true },
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-retention-enforcement",
        "retention",
        "Real retention enforcement exists",
        "A scheduled job (or equivalent) that purges expired records against real storage, not merely a fake adapter call.",
        false,
        ["Sprint 26R retention policy: ephemeral_only, defaultRetentionDays: 0, maximumRetentionDays: 0.", "Sprint 28R fake adapter purgeExpired is in-memory only, never scheduled."],
        { realPersistence: true },
      ),
    ],
    evidence: ["Sprint 26R createDecisionSupportShadowStorageRetentionPolicy() models retention.", "Sprint 28R fake adapter proves the purge contract, not real enforcement."],
    recommendation: "Retention is well modeled; real, scheduled enforcement must exist before any real persistence.",
  };
}

function assessTenantWorkspaceIsolation(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "tenant_workspace_isolation",
    status: "not_ready",
    riskLevel: "high",
    score: 30,
    blockers: [
      makeBlocker("psr-blk-tenant-isolation-no-model", "tenant_workspace_isolation", "critical", "No real tenant/workspace isolation model", "No design or implementation exists for isolating shadow capture records by tenant/workspace.", { realPersistence: true }),
      makeBlocker("psr-blk-tenant-isolation-no-rls", "tenant_workspace_isolation", "critical", "No RLS model", "No row-level-security model has been designed for a future decision_support_shadow_captures table.", { realPersistence: true }),
      makeBlocker("psr-blk-tenant-isolation-no-ownership", "tenant_workspace_isolation", "critical", "No workspace ownership enforcement", "No mechanism exists to enforce that a record can only be read/deleted by its owning workspace.", { realPersistence: true }),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-tenant-isolation-design",
        "tenant_workspace_isolation",
        "A tenant/workspace isolation model, RLS model, and ownership enforcement are designed",
        "Documented design (not yet implementation) for isolating records by tenant/workspace, an RLS policy sketch, and an ownership-enforcement mechanism.",
        false,
        ["No tenant/workspace isolation design exists anywhere in this package tree as of Sprint 29R."],
        { realPersistence: true },
      ),
    ],
    evidence: ["Sprint 27R's DecisionSupportShadowStorageDraft has no workspaceIdHash field by default.", "Sprint 28R fake adapter's deleteByWorkspace is structurally implemented but never exercised with a real workspace boundary."],
    recommendation: "Design (do not implement) a tenant/workspace isolation model, an RLS model, and ownership enforcement before any real persistence.",
  };
}

function assessAccessControl(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "access_control",
    status: "not_ready",
    riskLevel: "high",
    score: 30,
    blockers: [
      makeBlocker("psr-blk-access-control-no-model", "access_control", "critical", "No admin/read/write access-control model", "No design or implementation exists for who may read, write, or administer shadow capture records.", { realPersistence: true }),
      makeBlocker("psr-blk-access-control-no-role-based-visibility", "access_control", "critical", "No role-based visibility model", "No mechanism exists to restrict visibility of a shadow capture record by role.", { realPersistence: true }),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-access-control-design",
        "access_control",
        "An admin/read/write access-control model and role-based visibility model are designed",
        "Documented design for who may read/write/administer records and how visibility is restricted by role.",
        false,
        ["No access-control design exists anywhere in this package tree as of Sprint 29R."],
        { realPersistence: true },
      ),
    ],
    evidence: ["No access-control checks exist on any function in this package tree — every function is a pure, offline evaluation with no caller identity."],
    recommendation: "Design an access-control model and a role-based visibility model before any real persistence.",
  };
}

function assessAuditTrail(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "audit_trail",
    status: "partially_ready",
    riskLevel: "medium",
    score: 70,
    blockers: [
      makeBlocker(
        "psr-blk-audit-trail-no-policy",
        "audit_trail",
        "blocking",
        "Real audit trail policy missing",
        "Every capture record already carries structural auditMetadata, but no policy exists yet for what a real, durable audit trail (who read/wrote/deleted what, when) must capture.",
        { realPersistence: true },
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-audit-trail-policy",
        "audit_trail",
        "A real audit trail policy exists",
        "A documented policy for durable, queryable audit records of every real read/write/delete/purge.",
        false,
        ["Sprint 25R-28R structural auditMetadata exists on every in-memory record, but no durable audit trail policy exists."],
        { realPersistence: true },
      ),
    ],
    evidence: ["Every Sprint 25R capture record and Sprint 28R fake repository record already carries structural auditMetadata."],
    recommendation: "Structural audit metadata already exists; a real, durable audit trail policy must be designed before any real persistence.",
  };
}

function assessObservability(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "observability",
    status: "not_ready",
    riskLevel: "medium",
    score: 40,
    blockers: [
      makeBlocker(
        "psr-blk-observability-no-runtime-metrics",
        "observability",
        "blocking",
        "No runtime metrics/alerts for writes, deletes, purges, violations",
        "No monitoring/alerting exists for a real storage adapter's write/delete/purge counts or policy violations.",
        { realPersistence: true },
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-observability-design",
        "observability",
        "Runtime metrics/alerts are designed",
        "A design for emitting and alerting on write/delete/purge counts and policy violations against real storage.",
        false,
        ["Only in-process, pull-based stats() counters exist (Sprint 28R) — nothing is emitted or alerted on."],
        { realPersistence: true },
      ),
    ],
    evidence: ["Sprint 28R adapter.stats() is pull-based and in-process only — no metrics are ever emitted."],
    recommendation: "Design runtime observability (metrics + alerts) before any real persistence.",
  };
}

function assessRollback(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "rollback",
    status: "not_ready",
    riskLevel: "high",
    score: 30,
    blockers: [
      makeBlocker("psr-blk-rollback-no-tested-plan", "rollback", "blocking", "No tested rollback plan", "Sprint 27R documents rollback requirements for a future migration, but no rollback plan has ever been tested.", { realPersistence: true }),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-rollback-tested-plan",
        "rollback",
        "A tested rollback plan exists",
        "A migration rollback plan that has actually been exercised (e.g. against a staging environment), not merely documented.",
        false,
        ["Sprint 27R createDecisionSupportShadowStorageMigrationProposal().rollbackRequirements documents requirements but nothing has been tested."],
        { realPersistence: true },
      ),
    ],
    evidence: ["Sprint 27R rollbackRequirements: drop table safely, remove indexes, preserve deletion audit metadata only if explicitly approved, prove no raw payload exists before rollback — documented, not tested."],
    recommendation: "Test a rollback plan (in a non-production environment) before any real persistence.",
  };
}

function assessSecurityReview(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "security_review",
    status: "not_ready",
    riskLevel: "critical",
    score: 20,
    blockers: [
      makeBlocker(
        "psr-blk-security-review-required",
        "security_review",
        "critical",
        "Formal security/privacy review required before migration or real persistence",
        "No formal, independent security/privacy review of the shadow capture storage design has been performed.",
        { realPersistence: true, migrationFile: true },
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-security-review-performed",
        "security_review",
        "A formal security/privacy review has been performed",
        "An independent reviewer has assessed the full storage policy, schema proposal, migration proposal, and access-control design.",
        false,
        ["No security/privacy review has been performed as of Sprint 29R."],
        { realPersistence: true, migrationFile: true },
      ),
    ],
    evidence: ["No security/privacy review artifact exists anywhere in this package tree."],
    recommendation: "Commission a formal security/privacy review before any migration file or real persistence.",
  };
}

function assessProductionWiring(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "production_wiring",
    status: "partially_ready",
    riskLevel: "medium",
    score: 60,
    blockers: [
      makeBlocker(
        "psr-blk-production-wiring-prohibited",
        "production_wiring",
        "blocking",
        "Production wiring prohibited until a later integration plan exists",
        "decision_support is not connected to the router/composer/endpoint, and must stay disconnected until a dedicated integration plan and rollout review exists.",
        { defaultOffPrototype: true },
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-production-wiring-integration-plan",
        "production_wiring",
        "A production integration plan exists",
        "A reviewed plan for how (and whether) decision_support would ever connect to the router/composer/endpoint.",
        false,
        ["No production integration plan exists as of Sprint 29R."],
        { defaultOffPrototype: true },
      ),
    ],
    evidence: ["production untouched", "router/composer/handlers/endpoint untouched through Sprint 29R"],
    recommendation: "Production remains untouched, as required; a dedicated integration plan must exist before any future wiring.",
  };
}

function assessFeatureFlagging(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "feature_flagging",
    status: "not_ready",
    riskLevel: "high",
    score: 30,
    blockers: [
      makeBlocker(
        "psr-blk-feature-flagging-design-review-required",
        "feature_flagging",
        "blocking",
        "Default-off feature flag design must be reviewed before prototype",
        "Sprint 26R only names (never implements) ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE — no implementation or review of a real, default-off flag exists.",
        { defaultOffPrototype: true },
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-feature-flagging-reviewed-design",
        "feature_flagging",
        "A reviewed, default-off feature flag design exists",
        "A reviewed design (not yet implementation) for a real feature flag, confirmed default-off, gating any future prototype.",
        false,
        ["Sprint 26R only documents requiredFeatureFlagName/featureFlagDefault; no flag is read or implemented anywhere."],
        { defaultOffPrototype: true },
      ),
    ],
    evidence: ["Sprint 26R names ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE, featureFlagDefault: false — named only, never implemented or read."],
    recommendation: "Review a default-off feature flag design before any default-off persistence prototype.",
  };
}

function assessDataSubjectRights(): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  return {
    domain: "data_subject_rights",
    status: "not_ready",
    riskLevel: "high",
    score: 25,
    blockers: [
      makeBlocker(
        "psr-blk-dsr-no-policy",
        "data_subject_rights",
        "critical",
        "No DSR/delete/export policy for persisted shadow records",
        "No policy exists for how a data subject could request deletion or export of any future persisted shadow capture record.",
        { realPersistence: true },
      ),
    ],
    prerequisites: [
      makePrerequisite(
        "psr-pre-dsr-policy-defined",
        "data_subject_rights",
        "A DSR/delete/export policy is defined",
        "A documented policy for handling data-subject deletion/export requests against real persisted shadow capture records.",
        false,
        ["No DSR/delete/export policy exists anywhere in this package tree as of Sprint 29R."],
        { realPersistence: true },
      ),
    ],
    evidence: ["Sprint 26R deletion policy covers capture-id/workspace/policy-version deletion, but not an end-user-initiated DSR request flow."],
    recommendation: "Define a DSR/delete/export policy before any real persistence.",
  };
}

// ─── Domain assessment dispatch ─────────────────────────────────────────────────────────

/**
 * Assesses a single readiness domain. The four sprint-metric-driven domains (`storage_policy`,
 * `capture_harness`, `storage_draft_mapping`, `fake_adapter`) plus `privacy_minimization` and
 * `test_coverage` are computed from `inputMetrics`; every other domain reflects a fixed, currently
 * not-yet-built assessment — this review can only report that these domains are not yet designed or
 * implemented, since nothing in this package tree builds them.
 */
export function assessDecisionSupportShadowPersistenceReadinessDomain(
  domain: DecisionSupportShadowPersistenceReadinessDomain,
  inputMetrics: DecisionSupportShadowPersistenceReadinessInputMetrics,
  _options: DecisionSupportShadowPersistenceReadinessOptions = {},
): DecisionSupportShadowPersistenceReadinessDomainAssessment {
  switch (domain) {
    case "storage_policy":
      return assessStoragePolicy(inputMetrics);
    case "capture_harness":
      return assessCaptureHarness(inputMetrics);
    case "storage_draft_mapping":
      return assessStorageDraftMapping(inputMetrics);
    case "fake_adapter":
      return assessFakeAdapter(inputMetrics);
    case "schema_proposal":
      return assessSchemaProposal();
    case "migration_proposal":
      return assessMigrationProposal();
    case "deletion_purge":
      return assessDeletionPurge();
    case "retention":
      return assessRetention();
    case "tenant_workspace_isolation":
      return assessTenantWorkspaceIsolation();
    case "access_control":
      return assessAccessControl();
    case "audit_trail":
      return assessAuditTrail();
    case "observability":
      return assessObservability();
    case "rollback":
      return assessRollback();
    case "security_review":
      return assessSecurityReview();
    case "production_wiring":
      return assessProductionWiring();
    case "feature_flagging":
      return assessFeatureFlagging();
    case "data_subject_rights":
      return assessDataSubjectRights();
    case "privacy_minimization":
      return assessPrivacyMinimization(inputMetrics);
    case "test_coverage":
      return assessTestCoverage(inputMetrics);
    default: {
      const exhaustiveCheck: never = domain;
      throw new Error(`decisionSupportShadowCapturePersistenceReadiness: unknown domain "${String(exhaustiveCheck)}"`);
    }
  }
}

// ─── Decision matrix ────────────────────────────────────────────────────────────────────

const ALLOWED_NEXT_ACTIONS: string[] = [
  "Run a controlled shadow replay using the fake adapter.",
  "Design a tenant/workspace isolation model.",
  "Design an access-control model.",
  "Design a DSR/delete/export policy.",
  "Design a deletion/purge path.",
  "Design retention enforcement.",
  "Design a rollback plan.",
  "Design observability/alerts.",
  "Prepare a security review checklist.",
  "Discuss migration requirements (discussion only — no migration file).",
];

const PROHIBITED_NEXT_ACTIONS: string[] = [
  "Create a migration file.",
  "Create a SQL file.",
  "Create a DB table.",
  "Create Supabase writes.",
  "Implement a real repository.",
  "Implement a real storage adapter.",
  "Enable a production feature flag.",
  "Wire decision_support to the router/composer/endpoint.",
  "Show shadow output to a user.",
  "Persist shadow output for real.",
];

const REQUIRED_BEFORE_REAL_PERSISTENCE: string[] = [
  "Tenant/workspace isolation",
  "RLS model",
  "Workspace ownership enforcement",
  "Access-control model",
  "DSR/delete/export policy",
  "Real deletion path",
  "Real purge path",
  "Real retention enforcement",
  "Audit trail policy",
  "Observability/alerts",
  "Tested rollback plan",
  "Security/privacy review",
];

function computeDecision(assessments: DecisionSupportShadowPersistenceReadinessDomainAssessment[]): DecisionSupportShadowPersistenceReadinessDecision {
  if (assessments.some((a) => a.status === "blocked")) return "blocked_by_safety_or_policy_gap";

  const hasCriticalBlocker = assessments.some((a) => a.blockers.some((b) => b.severity === "critical"));
  const hasNotReady = assessments.some((a) => a.status === "not_ready");
  if (hasCriticalBlocker || hasNotReady) return "do_not_build_real_persistence_yet";

  const hasPartiallyReady = assessments.some((a) => a.status === "partially_ready");
  if (hasPartiallyReady) return "ready_for_migration_proposal_only";

  return "ready_for_default_off_persistence_prototype";
}

function buildRationale(
  assessments: DecisionSupportShadowPersistenceReadinessDomainAssessment[],
  decision: DecisionSupportShadowPersistenceReadinessDecision,
): string[] {
  const rationale: string[] = [];

  for (const a of assessments.filter((x) => x.status === "not_ready" || x.status === "blocked")) {
    rationale.push(`${a.domain} is ${a.status} (risk: ${a.riskLevel}, score: ${a.score}) — ${a.recommendation}`);
  }

  for (const b of assessments.flatMap((a) => a.blockers).filter((b) => b.severity === "critical")) {
    rationale.push(`Critical blocker in ${b.domain}: ${b.title}`);
  }

  if (decision === "do_not_build_real_persistence_yet") {
    rationale.push(
      "At least one domain is not_ready or carries a critical blocker — real persistence, a migration file, a SQL file, and a default-off prototype all stay disallowed.",
    );
  } else if (decision === "blocked_by_safety_or_policy_gap") {
    rationale.push("At least one domain is blocked — resolve the blocking safety/policy gap before any further readiness review.");
  }

  return rationale;
}

/**
 * Builds the decision matrix from either a full review (reading its `domainAssessments`) or an
 * already-computed `DecisionSupportShadowPersistenceReadinessDomainAssessment[]` directly.
 */
export function createDecisionSupportShadowPersistenceReadinessDecisionMatrix(
  reviewOrAssessments: DecisionSupportShadowPersistenceReadinessReview | DecisionSupportShadowPersistenceReadinessDomainAssessment[],
): DecisionSupportShadowPersistenceReadinessDecisionMatrix {
  const assessments = Array.isArray(reviewOrAssessments) ? reviewOrAssessments : reviewOrAssessments.domainAssessments;
  const decision = computeDecision(assessments);

  return {
    decision,
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    requiredBeforeNextStage: [...REQUIRED_BEFORE_REAL_PERSISTENCE],
    rationale: buildRationale(assessments, decision),
    recommendedNextSprint: RECOMMENDED_NEXT_SPRINT,
  } satisfies DecisionSupportShadowPersistenceReadinessDecisionMatrix;
}

// ─── Review ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the full Sprint 29R persistence readiness review: computes (or accepts caller-supplied)
 * input metrics, assesses every readiness domain, collects every blocker/prerequisite, builds the
 * decision matrix, and computes an overall readiness score (the plain average of every domain's
 * score). `realPersistenceAllowedNow`/`migrationFileAllowedNow`/`sqlFileAllowedNow` are always a
 * literal `false`; `defaultOffPrototypeAllowedNow` reflects the decision matrix.
 */
export function buildDecisionSupportShadowPersistenceReadinessReview(
  options: DecisionSupportShadowPersistenceReadinessOptions = {},
): DecisionSupportShadowPersistenceReadinessReview {
  const inputMetrics = options.inputMetrics ?? createDecisionSupportShadowPersistenceReadinessInputMetrics(DEFAULT_SYNTHETIC_CORPUS, { now: options.now });

  const domainAssessments = listDecisionSupportShadowPersistenceReadinessDomains().map((domain) =>
    assessDecisionSupportShadowPersistenceReadinessDomain(domain, inputMetrics, options),
  );

  const blockers = domainAssessments.flatMap((a) => a.blockers);
  const prerequisites = domainAssessments.flatMap((a) => a.prerequisites);
  const decisionMatrix = createDecisionSupportShadowPersistenceReadinessDecisionMatrix(domainAssessments);
  const readinessScore = round1(domainAssessments.reduce((sum, a) => sum + a.score, 0) / domainAssessments.length);

  const warnings = blockers.filter((b) => b.severity !== "critical").map((b) => `${b.domain}: ${b.title}`);

  return {
    kind: "decision_support_shadow_persistence_readiness_review",
    profile: "strict_default_off_persistence_readiness_review",
    mode: options.mode ?? "review_only",
    ...(options.now !== undefined ? { generatedAt: options.now } : {}),
    inputMetrics,
    domainAssessments,
    blockers,
    prerequisites,
    decisionMatrix,
    decision: decisionMatrix.decision,
    readinessScore,
    realPersistenceAllowedNow: false,
    migrationFileAllowedNow: false,
    sqlFileAllowedNow: false,
    defaultOffPrototypeAllowedNow: decisionMatrix.decision === "ready_for_default_off_persistence_prototype",
    recommendedNextSprint: decisionMatrix.recommendedNextSprint,
    warnings,
  } satisfies DecisionSupportShadowPersistenceReadinessReview;
}

// ─── Summary ────────────────────────────────────────────────────────────────────────────

function recommendationForDecision(decision: DecisionSupportShadowPersistenceReadinessDecision): string {
  switch (decision) {
    case "do_not_build_real_persistence_yet":
      return (
        "The Sprint 24R-28R shadow capture pipeline stays clean and safe, but tenant/workspace isolation, access control, a real " +
        "deletion/purge/retention path, an audit trail policy, observability, a tested rollback plan, a security review, and a DSR " +
        "policy do not yet exist — do not build any real persistence, migration, or SQL file yet. Sprint 30R can run a controlled " +
        "shadow replay using the fake adapter while these prerequisites are designed."
      );
    case "ready_for_migration_proposal_only":
      return "Every blocking domain is at least partially ready and no domain is not_ready — a migration proposal (still no migration file) can be discussed next.";
    case "ready_for_default_off_persistence_prototype":
      return "Every readiness domain is ready — a default-off persistence prototype could be designed next, still gated behind an unimplemented feature flag.";
    case "blocked_by_safety_or_policy_gap":
      return "At least one domain is blocked by a safety or policy gap — resolve it before any further persistence readiness work.";
    default:
      return "";
  }
}

/**
 * Turns a `buildDecisionSupportShadowPersistenceReadinessReview()` result into a review-ready summary:
 * per-status domain counts, per-severity blocker counts, prerequisite satisfaction counts, the
 * decision, and the strongest/weakest domains. Pure — takes an already-computed review rather than
 * re-running anything.
 */
export function summarizeDecisionSupportShadowPersistenceReadinessReview(
  review: DecisionSupportShadowPersistenceReadinessReview,
): DecisionSupportShadowPersistenceReadinessEvaluationSummary {
  const readyDomainCount = review.domainAssessments.filter((a) => a.status === "ready").length;
  const partiallyReadyDomainCount = review.domainAssessments.filter((a) => a.status === "partially_ready").length;
  const notReadyDomainCount = review.domainAssessments.filter((a) => a.status === "not_ready").length;
  const blockedDomainCount = review.domainAssessments.filter((a) => a.status === "blocked").length;

  const criticalBlockerCount = review.blockers.filter((b) => b.severity === "critical").length;
  const blockingBlockerCount = review.blockers.filter((b) => b.severity === "blocking").length;
  const warningBlockerCount = review.blockers.filter((b) => b.severity === "warning").length;

  const satisfiedPrerequisiteCount = review.prerequisites.filter((p) => p.satisfied).length;
  const unsatisfiedPrerequisiteCount = review.prerequisites.length - satisfiedPrerequisiteCount;

  const strongestReadyDomains = [...review.domainAssessments]
    .filter((a) => a.status === "ready")
    .sort((a, b) => b.score - a.score)
    .map((a) => a.domain);

  const weakestDomains = [...review.domainAssessments]
    .filter((a) => a.status === "not_ready" || a.status === "blocked")
    .sort((a, b) => a.score - b.score)
    .map((a) => a.domain);

  return {
    readinessScore: review.readinessScore,
    assessedDomainCount: review.domainAssessments.length,
    readyDomainCount,
    partiallyReadyDomainCount,
    notReadyDomainCount,
    blockedDomainCount,
    blockerCount: review.blockers.length,
    criticalBlockerCount,
    blockingBlockerCount,
    warningBlockerCount,
    satisfiedPrerequisiteCount,
    unsatisfiedPrerequisiteCount,
    realPersistenceAllowedNow: false,
    migrationFileAllowedNow: false,
    sqlFileAllowedNow: false,
    defaultOffPrototypeAllowedNow: review.defaultOffPrototypeAllowedNow,
    decision: review.decision,
    recommendedNextSprint: review.recommendedNextSprint,
    recommendation: recommendationForDecision(review.decision),
    strongestReadyDomains,
    weakestDomains,
    requiredBeforeRealPersistence: [...REQUIRED_BEFORE_REAL_PERSISTENCE],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
  } satisfies DecisionSupportShadowPersistenceReadinessEvaluationSummary;
}

// ─── Explain ────────────────────────────────────────────────────────────────────────────

/**
 * Capability explanation for the Sprint 29R persistence readiness review — mirrors the style of
 * `explainDecisionSupportShadowStorageFakeAdapter()` (Sprint 28R). See
 * `docs/conversational-brain-decision-support-shadow-persistence-readiness.md` for full context.
 */
export function explainDecisionSupportShadowPersistenceReadinessReview(): DecisionSupportShadowPersistenceReadinessExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-shadow-persistence-readiness",
    purpose:
      "Reviews whether PMFreak is ready to move toward any form of real persistence for the Sprint 24R-28R shadow capture pipeline — " +
      "re-running each sprint's own reused evaluation, assessing 19 readiness domains, and producing a decision matrix — without " +
      "implementing any real persistence itself.",
    nonGoals: [
      "Create a database, migration file, SQL file, table, or Supabase write.",
      "Implement a real (or fake) storage adapter or repository.",
      "Implement tenant isolation, access control, a real feature flag, or a DSR policy.",
      "Connect decision_support (or this review) to the router or request path.",
      "Change production behavior in any way.",
      "Show any shadow capture record or output to a user.",
      "Persist any review result outside this evaluation's in-process return value.",
    ],
    reviewProfile:
      'The "strict_default_off_persistence_readiness_review" profile: realPersistenceAllowedNow/migrationFileAllowedNow/' +
      "sqlFileAllowedNow are always literal false, regardless of mode or domain assessment results.",
    domains: listDecisionSupportShadowPersistenceReadinessDomains(),
    decisionRule:
      "If any domain is blocked, the decision is blocked_by_safety_or_policy_gap. Else if any domain is not_ready or carries a " +
      "critical blocker, the decision is do_not_build_real_persistence_yet. Else if any domain is only partially_ready, the decision " +
      "is ready_for_migration_proposal_only. Otherwise the decision is ready_for_default_off_persistence_prototype.",
    allowedNextActions: [...ALLOWED_NEXT_ACTIONS],
    prohibitedNextActions: [...PROHIBITED_NEXT_ACTIONS],
    requiredBeforeRealPersistence: [...REQUIRED_BEFORE_REAL_PERSISTENCE],
    whyDbIsNotCreated:
      "Tenant/workspace isolation, access control, a real deletion/purge/retention path, an audit trail policy, observability, a " +
      "tested rollback plan, a security review, and a DSR policy do not yet exist — writing to a real database today would create " +
      "ungoverned, undeletable, unauditable, unreviewed data.",
    whyMigrationIsNotCreated:
      "Sprint 27R's migration proposal documents 11 required preconditions; this review confirms none of them are yet satisfied.",
    whySqlFileIsNotCreated: "No migration, table, or real storage adapter exists yet to generate SQL against.",
    whySupabaseWriteIsNotCreated: "No Supabase client is imported anywhere in this package tree, and no tenant isolation or access control exists to govern a Supabase write.",
    whyStorageAdapterIsNotCreated: "A real storage adapter presumes a real deletion/purge/retention path, access control, and observability all exist — none of them do yet.",
    whyRepositoryIsNotCreated: "A repository presumes a real storage adapter exists underneath it.",
    expectedSprint30Path:
      "Sprint 30R can run a Controlled Shadow Replay Evaluation using the Sprint 28R fake adapter, while tenant isolation, access " +
      "control, deletion/purge, retention, audit trail, observability, rollback, security review, and DSR policy design work " +
      "proceeds — still without creating any real persistence.",
  };
}
