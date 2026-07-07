import type { DecisionSupportShadowPersistenceReadinessEvaluationSummary } from "./decisionSupportShadowCapturePersistenceReadinessTypes";
import type { DecisionSupportShadowStorageFakeAdapterEvaluationSummary } from "./decisionSupportShadowCaptureStorageFakeAdapterTypes";

/**
 * Sprint 30R — Decision Support Controlled Shadow Replay Evaluation: types.
 *
 * Pure type definitions for an offline, deterministic **controlled shadow replay** — not a new
 * pipeline, not a storage implementation — that replays the Sprint 18R corpus through the existing
 * Sprint 24R-29R shadow pipeline (shadow mode prep -> capture harness -> storage policy -> storage
 * draft mapping -> draft validation -> fake adapter write) multiple times per case, using only the
 * Sprint 28R fake (in-memory, test-only) adapter, to prove the pipeline is deterministic, stable, and
 * safe across repeated runs.
 *
 * This module is not imported by the router, composer, any production handler, or the gateway. It has
 * no production wiring, no database client, no Supabase client, and no feature-flag read — see
 * `docs/conversational-brain-decision-support-shadow-controlled-replay.md` for the full scope and
 * non-goals. This is replay/evaluation, not persistence/storage/adapter implementation.
 */

// ─── Profile / mode ───────────────────────────────────────────────────────────────────

export type DecisionSupportShadowControlledReplayProfile = "strict_fake_adapter_controlled_replay";

export type DecisionSupportShadowControlledReplayMode =
  | "single_pass_replay"
  | "multi_pass_replay"
  | "determinism_check"
  | "drift_check"
  | "safety_regression_check";

// ─── Decision ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowControlledReplayDecision =
  | "ready_for_clarification_gated_integration_plan"
  | "continue_shadow_replay_only"
  | "blocked_by_replay_drift"
  | "blocked_by_safety_regression"
  | "blocked_by_fake_adapter_regression";

// ─── Case category / route recommendation / statuses ─────────────────────────────────

export type DecisionSupportShadowControlledReplayCaseCategory =
  | "decision_candidate"
  | "clarification_candidate"
  | "existing_route_preserved"
  | "unsupported_or_not_applicable";

export type DecisionSupportShadowControlledReplayRouteRecommendation =
  | "clarification_gated_decision_support"
  | "keep_existing_route"
  | "keep_unsupported"
  | "shadow_only"
  | "needs_more_replay";

export type DecisionSupportShadowControlledReplaySafetyStatus = "safe" | "warning" | "unsafe" | "blocked";

export type DecisionSupportShadowControlledReplayStabilityStatus = "stable" | "minor_drift" | "major_drift" | "not_deterministic";

export type DecisionSupportShadowControlledReplayWriteStatus =
  | "fake_write_accepted"
  | "fake_write_rejected"
  | "not_written"
  | "blocked_before_write";

// ─── Config ───────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field that could ever enable a real side effect
 * (`allowRealPersistence`/`allowDbWrite`/`allowSupabaseWrite`/`allowExternalCalls`/
 * `allowUserVisibleOutput`/`allowProductionWiring`) is a literal `false` — see
 * `createDecisionSupportShadowControlledReplayConfig()`, which forces every one of them to `false`
 * regardless of what a caller's `overrides` object claims, mirroring how the Sprint 28R fake adapter's
 * own config never actually loosens its four `allow*` real-side-effect flags from an override.
 */
export type DecisionSupportShadowControlledReplayConfig = {
  profile: "strict_fake_adapter_controlled_replay";
  mode: DecisionSupportShadowControlledReplayMode;
  replayPasses: number;
  allowFakeAdapterWrites: boolean;
  allowRealPersistence: false;
  allowDbWrite: false;
  allowSupabaseWrite: false;
  allowExternalCalls: false;
  allowUserVisibleOutput: false;
  allowProductionWiring: false;
  requireCapturePolicyClean: true;
  requireStorageDraftValid: true;
  requireFakeAdapterSafety: true;
  requireDeterministicOutputs: true;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  notes?: string[];
};

// ─── Pass result ──────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowControlledReplaySideEffects = {
  realPersistenceAttempted: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  userVisibleOutputAttempted: false;
  productionWiringAttempted: false;
};

export type DecisionSupportShadowControlledReplayForbiddenRetention = {
  rawInputRetained: false;
  inputPreviewRetained: false;
  fullCandidateRetained: false;
  userVisibleOutputRetained: false;
  projectNameRetained: false;
  emailAddressRetained: false;
  phoneNumberRetained: false;
};

export type DecisionSupportShadowControlledReplayPassResult = {
  passIndex: number;
  caseId: string;
  category: DecisionSupportShadowControlledReplayCaseCategory;
  inputHash: string;
  architectureCategory?: string;
  desiredFutureRoute?: string;
  targetKind?: string;
  captureCreated: boolean;
  capturePolicyClean: boolean;
  storageDraftCreated: boolean;
  storageDraftValid: boolean;
  fakeWriteStatus: DecisionSupportShadowControlledReplayWriteStatus;
  fakeWriteAccepted: boolean;
  fakeRecordId?: string;
  routeRecommendation: DecisionSupportShadowControlledReplayRouteRecommendation;
  safetyStatus: DecisionSupportShadowControlledReplaySafetyStatus;
  warnings: string[];
  sideEffects: DecisionSupportShadowControlledReplaySideEffects;
  forbiddenRetention: DecisionSupportShadowControlledReplayForbiddenRetention;
};

// ─── Case aggregate ───────────────────────────────────────────────────────────────────

export type DecisionSupportShadowControlledReplayCaseAggregate = {
  caseId: string;
  category: DecisionSupportShadowControlledReplayCaseCategory;
  passes: DecisionSupportShadowControlledReplayPassResult[];
  passCount: number;
  stable: boolean;
  stabilityStatus: DecisionSupportShadowControlledReplayStabilityStatus;
  driftReasons: string[];
  safePassCount: number;
  unsafePassCount: number;
  fakeWriteAcceptedCount: number;
  fakeWriteRejectedCount: number;
  routeRecommendation: DecisionSupportShadowControlledReplayRouteRecommendation;
  finalSafetyStatus: DecisionSupportShadowControlledReplaySafetyStatus;
  requiresClarificationGate: boolean;
  shouldRemainShadowOnly: boolean;
  shouldRemainUnsupported: boolean;
  shouldUseExistingRoute: boolean;
};

// ─── Evaluation result / summary ──────────────────────────────────────────────────────

export type DecisionSupportShadowControlledReplayEvaluationResult = {
  config: DecisionSupportShadowControlledReplayConfig;
  passResults: DecisionSupportShadowControlledReplayPassResult[];
  aggregates: DecisionSupportShadowControlledReplayCaseAggregate[];
  /** A Sprint 29R persistence-readiness review + summary, recomputed against the same corpus this
   * replay ran over — reused, not re-derived, so this evaluation can prove no regression against the
   * Sprint 29R baseline (see `docs/conversational-brain-decision-support-shadow-controlled-replay.md`). */
  persistenceReadinessSummary: DecisionSupportShadowPersistenceReadinessEvaluationSummary;
  /** A Sprint 28R fake adapter evaluation + summary, recomputed against the same corpus this replay
   * ran over — reused, not re-derived, so this evaluation can prove the fake adapter's own
   * write/reject behavior has not regressed. */
  fakeAdapterBaselineSummary: DecisionSupportShadowStorageFakeAdapterEvaluationSummary;
};

export type DecisionSupportShadowControlledReplayEvaluationOptions = {
  config?: Partial<DecisionSupportShadowControlledReplayConfig>;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

export type DecisionSupportShadowControlledReplayEvaluationSummary = {
  totalCases: number;
  replayPasses: number;
  totalPassResults: number;
  stableCaseCount: number;
  unstableCaseCount: number;
  deterministicReplayRate: number;
  safeCaseCount: number;
  unsafeCaseCount: number;
  safeReplayRate: number;
  captureCreatedCount: number;
  capturePolicyCleanCount: number;
  storageDraftCreatedCount: number;
  storageDraftValidCount: number;
  fakeWriteAcceptedCount: number;
  fakeWriteRejectedCount: number;
  fakeWriteAcceptedRate: number;
  clarificationGatedRecommendationCount: number;
  existingRouteRecommendationCount: number;
  unsupportedRecommendationCount: number;
  shadowOnlyRecommendationCount: number;
  realPersistenceAttemptedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  externalCallAttemptedCount: number;
  userVisibleOutputAttemptedCount: number;
  productionWiringAttemptedCount: number;
  rawInputRetainedCount: number;
  inputPreviewRetainedCount: number;
  fullCandidateRetainedCount: number;
  userVisibleOutputRetainedCount: number;
  projectNameRetainedCount: number;
  emailAddressRetainedCount: number;
  phoneNumberRetainedCount: number;
  decision: DecisionSupportShadowControlledReplayDecision;
  recommendedNextSprint: string;
  representativeStableCases: DecisionSupportShadowControlledReplayCaseAggregate[];
  unstableCases: DecisionSupportShadowControlledReplayCaseAggregate[];
  unsafeCases: DecisionSupportShadowControlledReplayCaseAggregate[];
  warnings: string[];
};

// ─── Route recommendation result ─────────────────────────────────────────────────────

export type DecisionSupportShadowControlledReplayRouteRecommendationResult = {
  routeRecommendation: DecisionSupportShadowControlledReplayRouteRecommendation;
  requiresClarificationGate: boolean;
  shouldRemainShadowOnly: boolean;
  shouldRemainUnsupported: boolean;
  shouldUseExistingRoute: boolean;
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowControlledReplayExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  replayProfile: string;
  replayModes: string[];
  replayCorpus: string;
  replayPassPipeline: string[];
  determinismCheck: string;
  driftCheck: string;
  safetyRegressionCheck: string;
  fakeAdapterWriteValidation: string;
  routeRecommendationLogic: string[];
  decisionRule: string;
  allowedNextActions: string[];
  prohibitedNextActions: string[];
  whyDbIsNotCreated: string;
  whyMigrationIsNotCreated: string;
  whySqlFileIsNotCreated: string;
  whyStorageAdapterIsNotCreated: string;
  whyRepositoryIsNotCreated: string;
  whyProductionIsNotChanged: string;
  expectedSprint31Path: string;
};
