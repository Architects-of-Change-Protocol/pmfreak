/**
 * Sprint 25R — Decision Support Shadow Capture Harness: types.
 *
 * Pure type definitions for an offline, deterministic, test-only capture harness that turns a
 * Sprint 24R `DecisionSupportShadowModeRun` into a minimized, redacted "capture record" — without
 * writing a database, calling Supabase, showing anything to a user, or executing any action. This is
 * a capture *harness*, not a storage implementation: the only sink this sprint ships is an in-memory,
 * test-only sink that a caller must explicitly opt into.
 *
 * This module is not imported by the router, composer, any production handler, or the gateway. It
 * has no production wiring — see `docs/conversational-brain-decision-support-shadow-capture-harness.md`
 * for the full scope and non-goals. Nothing in this package tree calls fetch, a database, Supabase,
 * Gmail, or an LLM.
 */

import type { DecisionSupportShadowModeCandidateKind, DecisionSupportShadowModeStatus } from "./decisionSupportShadowModePrepTypes";

// ─── Mode / status / kind ────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureMode = "dry_run" | "test_only_in_memory";

export type DecisionSupportShadowCaptureStatus =
  | "capture_disabled"
  | "capture_preview_generated"
  | "in_memory_capture_recorded"
  | "capture_blocked_by_gate"
  | "capture_not_applicable";

export type DecisionSupportShadowCaptureRecordKind = "decision_support_shadow_capture_record";

export type DecisionSupportShadowCaptureSinkKind = "none" | "in_memory_test_only";

// ─── Gates ────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureGate =
  | "capture_default_off"
  | "test_only_mode"
  | "no_db_persistence"
  | "no_supabase"
  | "no_user_visible_output"
  | "no_execution"
  | "no_raw_input_retention"
  | "candidate_minimized"
  | "shadow_run_acceptable"
  | "capture_policy_acknowledged"
  | "adapter_unchanged"
  | "router_unchanged";

export type DecisionSupportShadowCaptureGateSeverity = "info" | "warning" | "blocking";

export type DecisionSupportShadowCaptureGateResult = {
  gate: DecisionSupportShadowCaptureGate;
  passed: boolean;
  reason: string;
  severity: DecisionSupportShadowCaptureGateSeverity;
};

// ─── Input minimization policy ───────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureInputPolicy = {
  retainRawInput: false;
  retainFullDecisionCandidate: false;
  retainFullClarificationCandidate: false;
  retainUserVisibleOutput: false;
  maxInputPreviewChars: number;
  hashInput: true;
  redactPotentialEmails: true;
  redactPotentialPhoneNumbers: true;
  redactProjectId?: boolean;
};

/**
 * Loosely-typed (plain `boolean`, not literal `false`) override bag used only to exercise the
 * "blocked behavior" gates in tests — a caller forcing one of these to `true` does not weaken
 * minimization; it fails `no_raw_input_retention`/`candidate_minimized` and blocks the capture. See
 * `createDecisionSupportShadowCapturePolicy()` in `decisionSupportShadowCaptureHarness.ts`.
 */
export type DecisionSupportShadowCapturePolicyOverrides = {
  retainRawInput?: boolean;
  retainFullDecisionCandidate?: boolean;
  retainFullClarificationCandidate?: boolean;
  retainUserVisibleOutput?: boolean;
  maxInputPreviewChars?: number;
  hashInput?: boolean;
  redactPotentialEmails?: boolean;
  redactPotentialPhoneNumbers?: boolean;
  redactProjectId?: boolean;
};

// ─── Context ──────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*` field here defaults to `false`/`undefined` and documents a
 * *forbidden-unless-forced* toggle: this sprint never sets any of them to `true` itself, but the
 * capture gates in `decisionSupportShadowCaptureHarness.ts` are tested against a caller forcing them
 * to `true` (plain `boolean`, not literal `false`, precisely so that forcing-to-true compiles) to
 * prove that doing so blocks the capture rather than enabling it. See "Blocking behavior" in
 * `docs/conversational-brain-decision-support-shadow-capture-harness.md`.
 */
export type DecisionSupportShadowCaptureContext = {
  mode?: DecisionSupportShadowCaptureMode;
  allowInMemoryCaptureForTests?: boolean;
  allowPersistence?: boolean;
  allowDbWrite?: boolean;
  allowSupabaseWrite?: boolean;
  allowUserVisibleOutput?: boolean;
  allowExecution?: boolean;
  policyAcknowledged?: boolean;
  now?: string;
  notes?: string[];
  policy?: DecisionSupportShadowCapturePolicyOverrides;
};

// ─── Candidate summary ────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureCandidateKind =
  | "decision_support_candidate"
  | "clarification_response_candidate"
  | "existing_route_preserved"
  | "none";

export type DecisionSupportShadowCaptureCandidateSummary = {
  candidateKind: DecisionSupportShadowCaptureCandidateKind;
  status: string;
  decisionType?: string;
  decisionConfidence?: "low" | "medium" | "high";
  decisionOptionCount?: number;
  decisionEvidenceNeededCount?: number;
  decisionRiskCount?: number;
  decisionWarningCount?: number;
  clarificationStrategyType?: string;
  clarificationAmbiguityLevel?: "low" | "medium" | "high";
  clarificationMissingSlots?: string[];
  clarificationRouteOptionIntents?: string[];
  clarificationQuestionCount?: number;
  safetyPass: boolean;
};

// ─── Safety snapshot ──────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureSafetySnapshot = {
  sourceShadowRunAllBlockingGatesPassed: boolean;
  shouldReturnCandidateToUser: false;
  shouldPersistShadowResult: false;
  shouldExecuteAction: false;
  shouldSendEmail: false;
  shouldCreateTask: false;
  shouldWriteToDb: false;
  userVisibleOutputAllowed: false;
  persistenceAllowed: false;
  executionAllowed: false;
  productionRouteChangeAllowed: false;
};

// ─── Audit metadata ───────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureAuditMetadata = {
  captureHarnessVersion: string;
  strategySource: "sprint_24_shadow_mode_prep";
  storagePolicy: "no_persistence";
  adapterMappingRealChanged: false;
  routerChanged: false;
  composerChanged: false;
  endpointChanged: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  externalCallAttempted: false;
  limitations: string[];
};

// ─── Capture record ───────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureRecord = {
  kind: "decision_support_shadow_capture_record";
  captureId: string;
  sourceRunId: string;
  generatedAt?: string;
  mode: DecisionSupportShadowCaptureMode;
  sinkKind: DecisionSupportShadowCaptureSinkKind;
  inputHash: string;
  inputPreview: string;
  rawInputRetained: false;
  fullDecisionCandidateRetained: false;
  fullClarificationCandidateRetained: false;
  userVisibleOutputRetained: false;
  architectureCategory?: string;
  desiredFutureRoute?: string;
  targetKind?: string;
  sourceStatus: DecisionSupportShadowModeStatus;
  sourceCandidateKind: DecisionSupportShadowModeCandidateKind;
  captureStatus: DecisionSupportShadowCaptureStatus;
  candidateSummary: DecisionSupportShadowCaptureCandidateSummary;
  safetySnapshot: DecisionSupportShadowCaptureSafetySnapshot;
  gateResults: DecisionSupportShadowCaptureGateResult[];
  allBlockingGatesPassed: boolean;
  warnings: string[];
  auditMetadata: DecisionSupportShadowCaptureAuditMetadata;
};

// ─── Sink ─────────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureSink = {
  kind: "in_memory_test_only";
  records: DecisionSupportShadowCaptureRecord[];
  write(record: DecisionSupportShadowCaptureRecord): DecisionSupportShadowCaptureRecord;
  list(): DecisionSupportShadowCaptureRecord[];
  clear(): void;
  count(): number;
};

// ─── Capture result ───────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureResult = {
  id: string;
  input: string;
  sourceRunStatus: DecisionSupportShadowModeStatus;
  sourceCandidateKind: DecisionSupportShadowModeCandidateKind;
  captureStatus: DecisionSupportShadowCaptureStatus;
  mode: DecisionSupportShadowCaptureMode;
  sinkKind: DecisionSupportShadowCaptureSinkKind;
  recordCreated: boolean;
  record?: DecisionSupportShadowCaptureRecord;
  gateFailureCount: number;
  blockingGateFailureCount: number;
  rawInputRetained: false;
  fullDecisionCandidateRetained: false;
  fullClarificationCandidateRetained: false;
  userVisibleOutputRetained: false;
  dbWriteAttempted: false;
  supabaseWriteAttempted: false;
  shouldReturnCandidateToUser: false;
  shouldPersistShadowResult: false;
  shouldExecuteAction: false;
  shouldSendEmail: false;
  shouldCreateTask: false;
  shouldWriteToDb: false;
  isAcceptableCapture: boolean;
  warnings: string[];
};

// ─── Evaluation ───────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureHarnessOptions = {
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  context?: DecisionSupportShadowCaptureContext;
  sink?: DecisionSupportShadowCaptureSink;
};

export type DecisionSupportShadowCaptureNextSprintRecommendation =
  | "Sprint 26R — Shadow Capture Harness Hardening"
  | "Sprint 26R — Shadow Capture Privacy Hardening"
  | "Sprint 26R — Shadow Capture Side-Effect Hardening"
  | "Sprint 26R — In-Memory Shadow Capture Validation"
  | "Sprint 26R — Shadow Capture Storage Policy / Default-Off Persistence Plan";

export type DecisionSupportShadowCaptureHarnessEvaluationSummary = {
  totalCases: number;
  evaluatedRuns: number;
  captureAttemptCount: number;
  capturePreviewGeneratedCount: number;
  inMemoryCaptureRecordedCount: number;
  captureBlockedByGateCount: number;
  captureNotApplicableCount: number;
  acceptableCaptureCount: number;
  acceptableCaptureRate: number;
  allBlockingGatesPassedCount: number;
  allBlockingGatesPassedRate: number;
  rawInputRetainedCount: number;
  fullDecisionCandidateRetainedCount: number;
  fullClarificationCandidateRetainedCount: number;
  userVisibleOutputRetainedCount: number;
  dbWriteAttemptedCount: number;
  supabaseWriteAttemptedCount: number;
  shouldReturnCandidateToUserCount: number;
  shouldPersistShadowResultCount: number;
  shouldExecuteActionCount: number;
  shouldSendEmailCount: number;
  shouldCreateTaskCount: number;
  shouldWriteToDbCount: number;
  decisionCandidateCaptureCount: number;
  clarificationCandidateCaptureCount: number;
  existingRouteCaptureCount: number;
  byCaptureStatus: Record<DecisionSupportShadowCaptureStatus, number>;
  byCandidateKind: Record<DecisionSupportShadowCaptureCandidateKind, number>;
  byFailedGate: Record<DecisionSupportShadowCaptureGate, number>;
  representativeCaptureRecords: DecisionSupportShadowCaptureResult[];
  weakCaptures: DecisionSupportShadowCaptureResult[];
  recommendedNextSprint: DecisionSupportShadowCaptureNextSprintRecommendation;
  recommendation: string;
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowCaptureHarnessExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  captureModes: string[];
  defaultDryRunPolicy: string;
  testOnlyInMemoryPolicy: string;
  noPersistencePolicy: string;
  minimizationPolicy: string;
  sanitizationPolicy: string;
  captureGates: string[];
  whyRawInputIsNotRetained: string;
  whyFullCandidatesAreNotRetained: string;
  whyDbSupabaseAreForbidden: string;
  whyUserVisibleOutputIsForbidden: string;
  expectedSprint26Path: string;
};
