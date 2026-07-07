/**
 * Sprint 30R — Decision Support Controlled Shadow Replay Evaluation: fixtures.
 *
 * Scenario descriptors used by
 * `tests/playbook-engine-conversation-decision-support-shadow-controlled-replay.test.mjs`. Each entry
 * documents one behavior this sprint must exhibit — some carry a `caseInput` (a real
 * `DecisionClarificationCase`-shaped object) that the test file replays through the actual pipeline;
 * others (e.g. "attempt to enable X blocked") describe a config/list-level invariant the test file
 * checks directly, and use `expectedRouteRecommendation`/`expectedStable`/`expectedSafetyStatus`/
 * `expectedFakeWriteStatus` as neutral placeholders since no case is actually replayed for them.
 *
 * This fixture never imports from `src/`, and is never imported by production code — it exists only
 * for this sprint's own test suite.
 */

import type { DecisionClarificationCase } from "../../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview";

export type DecisionSupportShadowControlledReplayCaseCategoryFixture =
  | "decision_candidate"
  | "clarification_candidate"
  | "existing_route_preserved"
  | "unsupported_or_not_applicable";

export type DecisionSupportShadowControlledReplayFixtureCase = {
  id: string;
  scenario: string;
  category: DecisionSupportShadowControlledReplayCaseCategoryFixture;
  expectedRouteRecommendation: string;
  expectedStable: boolean;
  expectedSafetyStatus: "safe" | "warning" | "unsafe" | "blocked";
  expectedFakeWriteStatus: "fake_write_accepted" | "fake_write_rejected" | "not_written" | "blocked_before_write";
  expectedForbiddenCountsZero: boolean;
  expectedSideEffectsZero: boolean;
  notes: string;
  /** Present only for scenarios that actually replay a case through the pipeline. */
  caseInput?: DecisionClarificationCase;
  /** Present only for the six "attempt to enable X blocked" config scenarios. */
  configOverrideField?:
    | "allowRealPersistence"
    | "allowDbWrite"
    | "allowSupabaseWrite"
    | "allowExternalCalls"
    | "allowUserVisibleOutput"
    | "allowProductionWiring";
};

const DECISION_CANDIDATE_CASE: DecisionClarificationCase = {
  id: "cr-fixture-decision-01",
  input: "Deberiamos migrar el pipeline de facturacion a microservicios o mantenerlo monolitico?",
  architectureCategory: "decision_support_clear",
  desiredFutureRoute: "decision_support",
  currentSafeMappedIntent: "unsupported",
  targetKind: "future_architecture",
  rationale: "A clear decision-support case: two options, a real tradeoff, no ambiguity about intent.",
  riskLevel: "medium",
  requiresNewHandler: true,
  requiresClarification: false,
  shouldExecuteAction: false,
};

const CLARIFICATION_CANDIDATE_CASE: DecisionClarificationCase = {
  id: "cr-fixture-clarification-01",
  input: "no se si conviene mas la opcion A o la opcion B para este caso",
  architectureCategory: "clarification_clear",
  desiredFutureRoute: "needs_clarification",
  currentSafeMappedIntent: "general_pm_advice",
  targetKind: "clarification_strategy",
  rationale: "A clear clarification case: the message itself signals uncertainty and needs a follow-up question.",
  riskLevel: "medium",
  requiresNewHandler: false,
  requiresClarification: true,
  shouldExecuteAction: false,
};

const EXISTING_ROUTE_CASE: DecisionClarificationCase = {
  id: "cr-fixture-existing-route-01",
  input: "cual es el estado actual del proyecto Fenix?",
  architectureCategory: "existing_route_should_win",
  desiredFutureRoute: "project_status_question",
  currentSafeMappedIntent: "project_status_question",
  targetKind: "existing_production_route",
  rationale: "An existing production route already serves this message correctly — it must be preserved untouched.",
  riskLevel: "low",
  requiresNewHandler: false,
  requiresClarification: false,
  shouldExecuteAction: false,
};

const UNSUPPORTED_CASE: DecisionClarificationCase = {
  id: "cr-fixture-unsupported-01",
  input: "mensaje sintetico que no corresponde a ninguna ruta futura reconocida",
  architectureCategory: "decision_support_vs_general_pm",
  desiredFutureRoute: "unsupported",
  currentSafeMappedIntent: "general_pm_advice",
  targetKind: "future_architecture",
  rationale: "A synthetic case with no existing-route/decision-support/clarification signal — must classify as unsupported_or_not_applicable.",
  riskLevel: "low",
  requiresNewHandler: false,
  requiresClarification: false,
  shouldExecuteAction: false,
};

export const DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_CASES: DecisionSupportShadowControlledReplayFixtureCase[] = [
  // ─── Config: default strict config ──────────────────────────────────────────────────
  {
    id: "cr-config-default-strict",
    scenario: "config default strict",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "not_written",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes:
      "createDecisionSupportShadowControlledReplayConfig() with no overrides must return profile strict_fake_adapter_controlled_replay, " +
      "mode multi_pass_replay, replayPasses 3, allowFakeAdapterWrites true, and every allow*/require* safety field at its strict default.",
  },

  // ─── Config: attempts to enable forbidden actions are blocked (6 cases) ────────────
  {
    id: "cr-config-block-real-persistence",
    scenario: "attempt to enable real persistence blocked",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "not_written",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Passing { allowRealPersistence: true } to createDecisionSupportShadowControlledReplayConfig() must still yield allowRealPersistence: false.",
    configOverrideField: "allowRealPersistence",
  },
  {
    id: "cr-config-block-db-write",
    scenario: "attempt to enable DB write blocked",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "not_written",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Passing { allowDbWrite: true } must still yield allowDbWrite: false.",
    configOverrideField: "allowDbWrite",
  },
  {
    id: "cr-config-block-supabase-write",
    scenario: "attempt to enable Supabase write blocked",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "not_written",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Passing { allowSupabaseWrite: true } must still yield allowSupabaseWrite: false.",
    configOverrideField: "allowSupabaseWrite",
  },
  {
    id: "cr-config-block-external-calls",
    scenario: "attempt to enable external calls blocked",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "not_written",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Passing { allowExternalCalls: true } must still yield allowExternalCalls: false.",
    configOverrideField: "allowExternalCalls",
  },
  {
    id: "cr-config-block-user-visible-output",
    scenario: "attempt to enable user visible output blocked",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "not_written",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Passing { allowUserVisibleOutput: true } must still yield allowUserVisibleOutput: false.",
    configOverrideField: "allowUserVisibleOutput",
  },
  {
    id: "cr-config-block-production-wiring",
    scenario: "attempt to enable production wiring blocked",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "not_written",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Passing { allowProductionWiring: true } must still yield allowProductionWiring: false.",
    configOverrideField: "allowProductionWiring",
  },

  // ─── Case category / stability replay scenarios (4) ────────────────────────────────
  {
    id: "cr-category-decision-candidate-stable",
    scenario: "decision candidate replay stable",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "A decision_support-desired case must classify as decision_candidate and stay stable across 3 replay passes.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-category-clarification-candidate-stable",
    scenario: "clarification candidate replay stable",
    category: "clarification_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "A needs_clarification-desired case must classify as clarification_candidate and stay stable across 3 replay passes.",
    caseInput: CLARIFICATION_CANDIDATE_CASE,
  },
  {
    id: "cr-category-existing-route-stable",
    scenario: "existing route replay stable",
    category: "existing_route_preserved",
    expectedRouteRecommendation: "keep_existing_route",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "An existing_route_should_win case must classify as existing_route_preserved and stay stable across 3 replay passes.",
    caseInput: EXISTING_ROUTE_CASE,
  },
  {
    id: "cr-category-unsupported-stable",
    scenario: "unsupported replay stable",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "A case with no existing-route/decision-support/clarification signal must classify as unsupported_or_not_applicable and stay stable.",
    caseInput: UNSUPPORTED_CASE,
  },

  // ─── Capture / draft / fake write validity (3) ──────────────────────────────────────
  {
    id: "cr-capture-policy-clean",
    scenario: "capture policy clean",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Every replayed pass's capturePolicyClean must be true for a real, well-formed corpus case.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-storage-draft-valid",
    scenario: "storage draft valid",
    category: "clarification_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Every replayed pass's storageDraftValid must be true for a real, well-formed corpus case.",
    caseInput: CLARIFICATION_CANDIDATE_CASE,
  },
  {
    id: "cr-fake-write-accepted",
    scenario: "fake write accepted",
    category: "existing_route_preserved",
    expectedRouteRecommendation: "keep_existing_route",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Every replayed pass's fakeWriteStatus must be fake_write_accepted for a real, policy-clean corpus case.",
    caseInput: EXISTING_ROUTE_CASE,
  },

  // ─── Fake write rejected only for synthetic invalid (1) ─────────────────────────────
  {
    id: "cr-fake-write-rejected-synthetic-invalid-only",
    scenario: "fake write rejected only for synthetic invalid",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_rejected",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes:
      "The fake adapter must only ever reject a synthetic, hand-built invalid draft (e.g. one carrying rawInput/storageEnabled: true) — " +
      "never a real, policy-clean draft produced by replaying this fixture's decision-candidate case.",
    caseInput: DECISION_CANDIDATE_CASE,
  },

  // ─── Deterministic multi-pass replay (1) ────────────────────────────────────────────
  {
    id: "cr-deterministic-multi-pass",
    scenario: "deterministic multi-pass replay",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "Replaying the same case 3 times against 3 independent fake adapters must produce identical category/routing/safety fields every time.",
    caseInput: DECISION_CANDIDATE_CASE,
  },

  // ─── Forbidden retention (7) ─────────────────────────────────────────────────────────
  {
    id: "cr-no-raw-input-retained",
    scenario: "no raw input retained",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "forbiddenRetention.rawInputRetained must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-input-preview-retained",
    scenario: "no inputPreview retained",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "forbiddenRetention.inputPreviewRetained must be false on every pass result — the storage draft never carries inputPreview.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-full-candidate-retained",
    scenario: "no full candidate retained",
    category: "clarification_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "forbiddenRetention.fullCandidateRetained must be false on every pass result.",
    caseInput: CLARIFICATION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-user-visible-output-retained",
    scenario: "no user visible output retained",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "forbiddenRetention.userVisibleOutputRetained must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-project-name-retained",
    scenario: "no projectName retained",
    category: "existing_route_preserved",
    expectedRouteRecommendation: "keep_existing_route",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "forbiddenRetention.projectNameRetained must be false on every pass result.",
    caseInput: EXISTING_ROUTE_CASE,
  },
  {
    id: "cr-no-email-retained",
    scenario: "no email retained",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "forbiddenRetention.emailAddressRetained must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-phone-retained",
    scenario: "no phone retained",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "forbiddenRetention.phoneNumberRetained must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },

  // ─── Side effects (6) ────────────────────────────────────────────────────────────────
  {
    id: "cr-no-real-persistence-attempted",
    scenario: "no real persistence attempted",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "sideEffects.realPersistenceAttempted must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-db-attempted",
    scenario: "no DB attempted",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "sideEffects.dbWriteAttempted must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-supabase-attempted",
    scenario: "no Supabase attempted",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "sideEffects.supabaseWriteAttempted must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-external-call-attempted",
    scenario: "no external call attempted",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "sideEffects.externalCallAttempted must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-production-wiring-attempted",
    scenario: "no production wiring attempted",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "sideEffects.productionWiringAttempted must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },
  {
    id: "cr-no-user-visible-output-attempted",
    scenario: "no user-visible output attempted",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "sideEffects.userVisibleOutputAttempted must be false on every pass result.",
    caseInput: DECISION_CANDIDATE_CASE,
  },

  // ─── Route recommendations (4) ───────────────────────────────────────────────────────
  {
    id: "cr-route-clarification-gated",
    scenario: "clarification gated recommendation",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "recommendDecisionSupportShadowControlledReplayRoute({ category: 'decision_candidate', safetyStatus: 'safe' }) must return clarification_gated_decision_support.",
  },
  {
    id: "cr-route-keep-existing",
    scenario: "keep existing route recommendation",
    category: "existing_route_preserved",
    expectedRouteRecommendation: "keep_existing_route",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "recommendDecisionSupportShadowControlledReplayRoute({ category: 'existing_route_preserved', safetyStatus: 'safe' }) must return keep_existing_route.",
  },
  {
    id: "cr-route-keep-unsupported",
    scenario: "keep unsupported recommendation",
    category: "unsupported_or_not_applicable",
    expectedRouteRecommendation: "keep_unsupported",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes: "recommendDecisionSupportShadowControlledReplayRoute({ category: 'unsupported_or_not_applicable', safetyStatus: 'safe' }) must return keep_unsupported.",
  },
  {
    id: "cr-route-shadow-only-synthetic-drift",
    scenario: "shadow only when drift synthetic",
    category: "decision_candidate",
    expectedRouteRecommendation: "shadow_only",
    expectedStable: false,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes:
      "recommendDecisionSupportShadowControlledReplayRoute({ category: 'decision_candidate', stable: false, driftReasons: ['routeRecommendation'] }) " +
      "must return shadow_only regardless of category, and aggregateDecisionSupportShadowControlledReplayCaseResults() must mark a " +
      "hand-built two-pass, disagreeing-routeRecommendation case as unstable with routeRecommendation shadow_only.",
  },

  // ─── Final decision (2) ──────────────────────────────────────────────────────────────
  {
    id: "cr-decision-ready-for-integration-plan",
    scenario: "decision ready_for_clarification_gated_integration_plan",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes:
      "summarizeDecisionSupportShadowControlledReplayEvaluation() over the full Sprint 18R corpus (3 passes) must report " +
      "decision: ready_for_clarification_gated_integration_plan.",
  },
  {
    id: "cr-recommended-sprint-31r",
    scenario: "recommended Sprint 31R",
    category: "decision_candidate",
    expectedRouteRecommendation: "clarification_gated_decision_support",
    expectedStable: true,
    expectedSafetyStatus: "safe",
    expectedFakeWriteStatus: "fake_write_accepted",
    expectedForbiddenCountsZero: true,
    expectedSideEffectsZero: true,
    notes:
      "summarizeDecisionSupportShadowControlledReplayEvaluation() over the full Sprint 18R corpus (3 passes) must report " +
      'recommendedNextSprint: "Sprint 31R — Clarification-Gated Decision Support Integration Plan".',
  },
];
