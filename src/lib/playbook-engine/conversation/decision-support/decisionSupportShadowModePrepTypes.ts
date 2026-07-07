/**
 * Sprint 24R — Decision Support Shadow Mode Prep: types.
 *
 * Pure type definitions for an offline, deterministic contract that documents *how* a future
 * `decision_support` shadow mode would run under the Sprint 23R-recommended
 * `hybrid_shadow_then_clarify` strategy — without activating shadow mode, without connecting
 * `decision_support` to the router, and without changing production in any way.
 *
 * This module is not imported by the router, composer, any production handler, or the gateway. It
 * has no production wiring — see `docs/conversational-brain-decision-support-shadow-mode-prep.md`
 * for the full scope and non-goals. Nothing in this package tree calls fetch, a database, Supabase,
 * Gmail, or an LLM.
 */

import type { DecisionClarificationArchitectureCategory, DecisionClarificationDesiredFutureRoute, DecisionClarificationTargetKind } from "../classifier/decisionClarificationArchitectureReview";
import type { DecisionSupportCandidateResult, DecisionSupportContext } from "./decisionSupportCandidateTypes";
import type { ClarificationResponseCandidateResult } from "../clarification/clarificationResponseTypes";

// ─── Strategy ──────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowModeStrategy = "hybrid_shadow_then_clarify";

// ─── Status / candidate kind ─────────────────────────────────────────────────────────

export type DecisionSupportShadowModeStatus =
  | "disabled"
  | "prep_only"
  | "shadow_eligible"
  | "shadow_candidate_generated"
  | "clarification_candidate_generated"
  | "existing_route_preserved"
  | "blocked_by_safety_gate"
  | "not_applicable";

export type DecisionSupportShadowModeCandidateKind =
  | "decision_support_candidate"
  | "clarification_response_candidate"
  | "existing_route_preserved"
  | "none";

// ─── Safety gates ─────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowModeGate =
  | "default_off"
  | "no_production_route"
  | "no_user_visible_output"
  | "no_persistence"
  | "no_execution"
  | "existing_route_preservation"
  | "candidate_handler_safety"
  | "clarification_safety"
  | "confidence_gate"
  | "missing_context_gate"
  | "adapter_unchanged"
  | "router_unchanged";

export type DecisionSupportShadowModeGateSeverity = "info" | "warning" | "blocking";

export type DecisionSupportShadowModeGateResult = {
  gate: DecisionSupportShadowModeGate;
  passed: boolean;
  reason: string;
  severity: DecisionSupportShadowModeGateSeverity;
};

// ─── Input ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowModeInputSource = "manual_test" | "architecture_review" | "adapter_mapping_plan" | "future_shadow";

export type DecisionSupportShadowModeInput = {
  /** Stable identifier for this run. When omitted, a deterministic id is derived from the
   * normalized input text — this module never uses randomness or the system clock to build one. */
  id?: string;
  input: string;
  projectId?: string;
  projectName?: string;
  conversationId?: string;
  /** Optional known facts, passed straight through to the Sprint 19R candidate handler — used only
   * to raise its confidence estimate; never fetched, always caller-supplied. */
  availableContext?: DecisionSupportContext;
  architectureCategory?: DecisionClarificationArchitectureCategory;
  desiredFutureRoute?: DecisionClarificationDesiredFutureRoute;
  targetKind?: DecisionClarificationTargetKind;
  currentProductionMappedIntent?: string;
  source?: DecisionSupportShadowModeInputSource;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

// ─── Context ─────────────────────────────────────────────────────────────────────────

/**
 * Every `allow*`/`featureFlagEnabled` field here defaults to `false`/`undefined` and documents a
 * *forbidden-unless-forced* toggle: this sprint never sets any of them to `true` itself, but the
 * safety gates in `decisionSupportShadowModePrep.ts` are tested against a caller forcing them to
 * `true` to prove that doing so blocks every side effect rather than enabling it. See
 * "Default-off policy" in `docs/conversational-brain-decision-support-shadow-mode-prep.md`.
 */
export type DecisionSupportShadowModeContext = {
  availableProjectContext?: unknown;
  adapterMappingStrategy?: DecisionSupportShadowModeStrategy;
  featureFlagEnabled?: boolean;
  allowUserVisibleOutput?: boolean;
  allowPersistence?: boolean;
  allowExecution?: boolean;
  allowProductionRouteChange?: boolean;
  notes?: string[];
};

// ─── Audit metadata ───────────────────────────────────────────────────────────────────

export type DecisionSupportShadowModeAuditMetadata = {
  shadowModeVersion: string;
  generatedAt?: string;
  strategySource: "sprint_23_adapter_mapping_plan";
  adapterMappingRealChanged: false;
  routerChanged: false;
  composerChanged: false;
  endpointChanged: false;
  limitations: string[];
};

// ─── Run result ───────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowModeRun = {
  kind: "decision_support_shadow_mode_run";
  id: string;
  input: string;
  normalizedInput: string;
  strategy: DecisionSupportShadowModeStrategy;
  status: DecisionSupportShadowModeStatus;
  candidateKind: DecisionSupportShadowModeCandidateKind;
  /** Carried through from `DecisionSupportShadowModeInput` for audit/evaluation convenience —
   * unaffected by anything this module computes. */
  desiredFutureRoute?: DecisionClarificationDesiredFutureRoute;
  architectureCategory?: DecisionClarificationArchitectureCategory;
  targetKind?: DecisionClarificationTargetKind;
  decisionCandidate?: DecisionSupportCandidateResult;
  clarificationCandidate?: ClarificationResponseCandidateResult;
  gateResults: DecisionSupportShadowModeGateResult[];
  allBlockingGatesPassed: boolean;
  isDefaultOff: true;
  userVisibleOutputAllowed: false;
  persistenceAllowed: false;
  executionAllowed: false;
  productionRouteChangeAllowed: false;
  shouldReturnCandidateToUser: false;
  shouldPersistShadowResult: false;
  shouldExecuteAction: false;
  shouldSendEmail: false;
  shouldCreateTask: false;
  shouldWriteToDb: false;
  preservesExistingRoute: boolean;
  warnings: string[];
  auditMetadata: DecisionSupportShadowModeAuditMetadata;
};

// ─── Evaluation ───────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowModeEvaluationResult = {
  id: string;
  input: string;
  desiredFutureRoute?: DecisionClarificationDesiredFutureRoute;
  architectureCategory?: DecisionClarificationArchitectureCategory;
  targetKind?: DecisionClarificationTargetKind;
  runStatus: DecisionSupportShadowModeStatus;
  candidateKind: DecisionSupportShadowModeCandidateKind;
  allBlockingGatesPassed: boolean;
  gateFailureCount: number;
  blockingGateFailureCount: number;
  preservesExistingRoute: boolean;
  decisionCandidateGenerated: boolean;
  clarificationCandidateGenerated: boolean;
  shouldReturnCandidateToUser: false;
  shouldPersistShadowResult: false;
  shouldExecuteAction: false;
  shouldSendEmail: false;
  shouldCreateTask: false;
  shouldWriteToDb: false;
  isAcceptableShadowPrepRun: boolean;
  warnings: string[];
};

export type DecisionSupportShadowModeNextSprintRecommendation =
  | "Sprint 25R — Shadow Mode Safety Hardening"
  | "Sprint 25R — Shadow Mode Side-Effect Hardening"
  | "Sprint 25R — Existing Route Preservation Hardening"
  | "Sprint 25R — Decision Support Confidence Context Plan"
  | "Sprint 25R — Decision Support Shadow Capture Harness";

export type DecisionSupportShadowModePrepEvaluationOptions = {
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
  context?: DecisionSupportShadowModeContext;
};

export type DecisionSupportShadowModePrepEvaluationSummary = {
  totalCases: number;
  evaluatedCases: number;
  shadowEligibleCount: number;
  decisionCandidateGeneratedCount: number;
  clarificationCandidateGeneratedCount: number;
  existingRoutePreservedCount: number;
  blockedBySafetyGateCount: number;
  notApplicableCount: number;
  acceptableShadowPrepRunCount: number;
  acceptableShadowPrepRunRate: number;
  allBlockingGatesPassedCount: number;
  allBlockingGatesPassedRate: number;
  defaultOffCount: number;
  userVisibleOutputAllowedCount: number;
  persistenceAllowedCount: number;
  executionAllowedCount: number;
  productionRouteChangeAllowedCount: number;
  shouldReturnCandidateToUserCount: number;
  shouldPersistShadowResultCount: number;
  shouldExecuteActionCount: number;
  shouldSendEmailCount: number;
  shouldCreateTaskCount: number;
  shouldWriteToDbCount: number;
  byStatus: Record<DecisionSupportShadowModeStatus, number>;
  byCandidateKind: Record<DecisionSupportShadowModeCandidateKind, number>;
  byFailedGate: Record<DecisionSupportShadowModeGate, number>;
  representativeDecisionCandidates: DecisionSupportShadowModeEvaluationResult[];
  representativeClarificationCandidates: DecisionSupportShadowModeEvaluationResult[];
  weakShadowPrepRuns: DecisionSupportShadowModeEvaluationResult[];
  recommendedNextSprint: DecisionSupportShadowModeNextSprintRecommendation;
  recommendation: string;
};

// ─── Explain ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportShadowModePrepExplain = {
  capability: string;
  purpose: string;
  nonGoals: string[];
  strategy: DecisionSupportShadowModeStrategy;
  defaultOffPolicy: string;
  safetyGates: string[];
  existingRoutePreservation: string;
  whyUserVisibleOutputIsForbidden: string;
  whyPersistenceIsForbidden: string;
  whyFeatureFlagIsNotImplementedYet: string;
  whyProductionIsNotChanged: string;
  expectedSprint25Path: string;
};
