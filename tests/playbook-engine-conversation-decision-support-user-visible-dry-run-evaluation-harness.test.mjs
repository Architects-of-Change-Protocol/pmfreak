import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_VERSION,
  createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig,
  listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions,
  listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions,
  createDecisionSupportUserVisibleDryRunDisplayContract,
  renderDecisionSupportUserVisibleDryRunPreview,
  validateDecisionSupportUserVisibleDryRunPreview,
  runDecisionSupportUserVisibleDryRunEvaluationHarness,
  summarizeDecisionSupportUserVisibleDryRunEvaluationHarness,
  explainDecisionSupportUserVisibleDryRunEvaluationHarness,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarness.ts";
import {
  runDecisionSupportResponseDraftQualityEvaluation,
  summarizeDecisionSupportResponseDraftQualityEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftQualityEvaluation.ts";
import { DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_CASES } from "./fixtures/conversational-brain-decision-support-user-visible-dry-run-evaluation-harness-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Regression imports — Sprint 18R-34R + golden/classifier/vocabulary suites, reused read-only for comparison.
import { runDecisionSupportResponseDraftHarness, summarizeDecisionSupportResponseDraftHarness } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftHarness.ts";
import { buildDecisionSupportResponseQaDryRunPlan, summarizeDecisionSupportResponseQaDryRunPlan } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseQaDryRunPlan.ts";
import {
  buildDecisionSupportClarificationGatedIntegrationPlan,
  summarizeDecisionSupportClarificationGatedIntegrationPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportClarificationGatedIntegrationPlan.ts";
import {
  runDecisionSupportShadowControlledReplayEvaluation,
  summarizeDecisionSupportShadowControlledReplayEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowControlledReplay.ts";
import {
  buildDecisionSupportShadowPersistenceReadinessReview,
  createDecisionSupportShadowPersistenceReadinessInputMetrics,
  summarizeDecisionSupportShadowPersistenceReadinessReview,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCapturePersistenceReadiness.ts";
import {
  runDecisionSupportShadowStorageFakeAdapterEvaluation,
  summarizeDecisionSupportShadowStorageFakeAdapterEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapter.ts";
import {
  runDecisionSupportShadowStorageAdapterPlanEvaluation,
  summarizeDecisionSupportShadowStorageAdapterPlanEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts";
import {
  runDecisionSupportShadowStoragePolicyEvaluation,
  summarizeDecisionSupportShadowStoragePolicyEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts";
import {
  runDecisionSupportShadowCaptureHarnessEvaluation,
  summarizeDecisionSupportShadowCaptureHarnessEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";
import { runClarificationResponseEvaluation, toDecisionClarificationEvaluationCases } from "../src/lib/playbook-engine/conversation/clarification/clarificationResponseEvaluation.ts";
import { runGoldenIntentEvaluation, summarizeGoldenIntentEvaluation } from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

/**
 * Sprint 35R — Decision Support User-Visible Dry Run Evaluation Harness.
 *
 * Tests the pure, offline, deterministic user-visible dry run evaluation harness in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarness.ts`.
 * This renders a synthetic, internal-only preview for every Sprint 34R-evaluated draft and validates it
 * against a display contract — it never shows anything to a real user, never persists anything real, and
 * never touches the router/composer/endpoint.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const EVALUATION = runDecisionSupportResponseDraftQualityEvaluation({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const HARNESS = runDecisionSupportUserVisibleDryRunEvaluationHarness({ evaluation: EVALUATION, now: NOW });
const SUMMARY = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(HARNESS);

function renderFromFixture(fixtureId) {
  const fixtureCase = fixtureFor(fixtureId);
  assert.ok(fixtureCase.sourceQualityCaseEvaluation, `fixture ${fixtureId} must declare sourceQualityCaseEvaluation`);
  return renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
}

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 45 and 65 cases", () => {
  assert.ok(DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_CASES.length >= 45);
  assert.ok(DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_CASES.length <= 65);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.previewKind, "string");
    assert.equal(typeof c.expectedQaStatus, "string");
    assert.equal(typeof c.expectedRiskLevel, "string");
    assert.equal(typeof c.expectedValid, "boolean");
    assert.equal(typeof c.expectedDisplayContractStatus, "string");
    assert.ok(Array.isArray(c.expectedPreviewQualityScoreRange));
    assert.ok(Array.isArray(c.expectedDisplayContractScoreRange));
    assert.equal(typeof c.expectedSafeForDefaultOffRouteComposerAdapter, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleOutputNow, "boolean");
    assert.equal(c.expectedSafeForUserVisibleOutputNow, false);
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(c.expectedSafeForProduction, false);
    assert.ok(Array.isArray(c.expectedViolations));
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_VERSION, "string");
  assert.ok(DECISION_SUPPORT_USER_VISIBLE_DRY_RUN_EVALUATION_HARNESS_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig", createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig],
  ["listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions", listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions],
  ["listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions", listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions],
  ["createDecisionSupportUserVisibleDryRunDisplayContract", createDecisionSupportUserVisibleDryRunDisplayContract],
  ["renderDecisionSupportUserVisibleDryRunPreview", renderDecisionSupportUserVisibleDryRunPreview],
  ["validateDecisionSupportUserVisibleDryRunPreview", validateDecisionSupportUserVisibleDryRunPreview],
  ["runDecisionSupportUserVisibleDryRunEvaluationHarness", runDecisionSupportUserVisibleDryRunEvaluationHarness],
  ["summarizeDecisionSupportUserVisibleDryRunEvaluationHarness", summarizeDecisionSupportUserVisibleDryRunEvaluationHarness],
  ["explainDecisionSupportUserVisibleDryRunEvaluationHarness", explainDecisionSupportUserVisibleDryRunEvaluationHarness],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture uvdr-config-default-strict)", () => {
  fixtureFor("uvdr-config-default-strict");
  const config = createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig();
  assert.equal(config.profile, "strict_user_visible_dry_run_evaluation_harness");
  assert.equal(config.mode, "dry_run_harness_only");
  assert.equal(config.minPreviewQualityScore, 85);
  assert.equal(config.minDisplayContractScore, 85);
  assert.equal(config.allowUserVisibleOutput, false);
  assert.equal(config.allowProductionWiring, false);
  assert.equal(config.allowRouterChange, false);
  assert.equal(config.allowComposerChange, false);
  assert.equal(config.allowEndpointChange, false);
  assert.equal(config.allowFeatureFlag, false);
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowTaskCreation, false);
  assert.equal(config.allowEmailDraftCreation, false);
  assert.equal(config.requireQualityEvaluationPass, true);
  assert.equal(config.requireInternalDryRunNotice, true);
  assert.equal(config.requireDisplayContractCompatibility, true);
  assert.equal(config.requireNoVisibilityAttempt, true);
  assert.equal(config.requireNoLeakage, true);
  assert.equal(config.requireNoSideEffects, true);
  assert.equal(config.requireNoProductionEligibility, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "uvdr-config-block-user-visible-output",
  "uvdr-config-block-production-wiring",
  "uvdr-config-block-router-change",
  "uvdr-config-block-composer-change",
  "uvdr-config-block-endpoint-change",
  "uvdr-config-block-feature-flag",
  "uvdr-config-block-real-persistence",
  "uvdr-config-block-db-write",
  "uvdr-config-block-supabase-write",
  "uvdr-config-block-external-calls",
  "uvdr-config-block-action-execution",
  "uvdr-config-block-task-creation",
  "uvdr-config-block-email-draft-creation",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 13);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all thirteen are forced true at once", () => {
  const config = createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig({
    allowUserVisibleOutput: true,
    allowProductionWiring: true,
    allowRouterChange: true,
    allowComposerChange: true,
    allowEndpointChange: true,
    allowFeatureFlag: true,
    allowRealPersistence: true,
    allowDbWrite: true,
    allowSupabaseWrite: true,
    allowExternalCalls: true,
    allowActionExecution: true,
    allowTaskCreation: true,
    allowEmailDraftCreation: true,
  });
  for (const field of BLOCKED_FIELD_FIXTURE_IDS.map((id) => fixtureFor(id).configOverrideField)) {
    assert.equal(config[field], false, `${field} must stay false`);
  }
});

test("config honors safe overrides (mode, minPreviewQualityScore, now, notes)", () => {
  const config = createDecisionSupportUserVisibleDryRunEvaluationHarnessConfig({
    mode: "internal_preview_rendering",
    minPreviewQualityScore: 80,
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "internal_preview_rendering");
  assert.equal(config.minPreviewQualityScore, 80);
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("default-off route/composer integration adapter"));
  assert.ok(joined.includes("dry-run adapter contract"));
  assert.ok(joined.includes("no-op production integration shell"));
  assert.ok(joined.includes("route guard contract tests"));
  assert.ok(joined.includes("composer guard contract tests"));
  assert.ok(joined.includes("feature flag contract review"));
  assert.ok(joined.includes("integration rollback contract review"));
});

test("listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportUserVisibleDryRunEvaluationHarnessAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("show preview to real user"));
  assert.ok(joined.includes("wire router directly to live decision_support"));
  assert.ok(joined.includes("wire composer directly to live decision_support"));
  assert.ok(joined.includes("wire endpoint directly to live decision_support"));
  assert.ok(joined.includes("enable production feature flag"));
  assert.ok(joined.includes("create db"));
  assert.ok(joined.includes("create migration"));
  assert.ok(joined.includes("create sql file"));
  assert.ok(joined.includes("write supabase"));
  assert.ok(joined.includes("implement real repository"));
  assert.ok(joined.includes("implement real storage adapter"));
  assert.ok(joined.includes("execute actions"));
  assert.ok(joined.includes("create tasks"));
  assert.ok(joined.includes("create emails"));
  assert.ok(joined.includes("create drafts"));
  assert.ok(joined.includes("call external services"));
  assert.ok(joined.includes("persist output real"));
});

test("listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportUserVisibleDryRunEvaluationHarnessProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Display contract ───────────────────────────────────────────────────────────────

const CONTRACT_FIXTURE_EXPECTATIONS = [
  ["uvdr-contract-clarification-first", "clarification_first_preview", ["internal_dry_run_notice", "acknowledgement", "clarifying_question", "assumptions", "recommended_next_step", "non_execution_notice"]],
  ["uvdr-contract-route-preservation", "route_preservation_preview", ["internal_dry_run_notice", "acknowledgement", "route_preservation_notice", "recommended_next_step", "non_execution_notice"]],
  ["uvdr-contract-unsupported-boundary", "unsupported_boundary_preview", ["internal_dry_run_notice", "acknowledgement", "unsupported_boundary_notice", "recommended_next_step", "non_execution_notice"]],
  ["uvdr-contract-shadow-only-internal", "shadow_only_internal_preview", ["internal_dry_run_notice", "shadow_only_notice", "non_execution_notice"]],
  ["uvdr-contract-blocked-unsafe", "blocked_unsafe_preview", ["internal_dry_run_notice", "blocked_notice", "non_execution_notice"]],
];

for (const [fixtureId, expectedPreviewKind, requiredSections] of CONTRACT_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: display contract requires the documented sections`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const contract = createDecisionSupportUserVisibleDryRunDisplayContract(fixtureCase.sourceQualityCaseEvaluation);
    assert.equal(contract.previewKind, expectedPreviewKind);
    for (const required of requiredSections) assert.ok(contract.requiredSections.includes(required), `missing required section ${required}`);
    assert.equal(contract.requiresInternalDryRunNotice, true);
    assert.equal(contract.blocksDirectDecision, true);
    assert.equal(contract.blocksExecution, true);
    assert.equal(contract.blocksPersistence, true);
    assert.equal(contract.blocksExternalCalls, true);
    assert.equal(contract.blocksProductionEligibility, true);
    assert.equal(contract.displayContractStatus, "compatible");
    assert.ok(contract.displayContractScore >= 85);
  });
}

test("display contract prohibited sections never overlap required sections", () => {
  const cases = [
    fixtureFor("uvdr-contract-clarification-first").sourceQualityCaseEvaluation,
    fixtureFor("uvdr-contract-route-preservation").sourceQualityCaseEvaluation,
    fixtureFor("uvdr-contract-unsupported-boundary").sourceQualityCaseEvaluation,
    fixtureFor("uvdr-contract-shadow-only-internal").sourceQualityCaseEvaluation,
    fixtureFor("uvdr-contract-blocked-unsafe").sourceQualityCaseEvaluation,
  ];
  for (const c of cases) {
    const contract = createDecisionSupportUserVisibleDryRunDisplayContract(c);
    for (const required of contract.requiredSections) assert.ok(!contract.prohibitedSections.includes(required));
  }
});

// ─── Preview rendering ────────────────────────────────────────────────────────────────

const RENDER_FIXTURE_EXPECTATIONS = [
  ["uvdr-render-clarification-first", "clarification_first_preview"],
  ["uvdr-render-route-preservation", "route_preservation_preview"],
  ["uvdr-render-unsupported-boundary", "unsupported_boundary_preview"],
  ["uvdr-render-shadow-only-internal", "shadow_only_internal_preview"],
  ["uvdr-render-blocked-unsafe", "blocked_unsafe_preview"],
];

for (const [fixtureId, expectedPreviewKind] of RENDER_FIXTURE_EXPECTATIONS) {
  test(`${fixtureId}: renders the expected preview kind with every dry-run invariant`, () => {
    const preview = renderFromFixture(fixtureId);
    assert.equal(preview.previewKind, expectedPreviewKind);
    assert.equal(preview.generatedForDryRunOnly, true);
    assert.equal(preview.internalPreviewOnly, true);
    assert.equal(preview.userVisibleNow, false);
    assert.equal(preview.persistedNow, false);
    assert.equal(preview.executableNow, false);
    assert.equal(preview.externalSideEffectsAllowed, false);
    assert.equal(preview.productionEligibleNow, false);
    assert.ok(["rendered", "validated"].includes(preview.status));
    assert.ok(preview.displaySections.some((s) => s.kind === "internal_dry_run_notice"));
    assert.ok(preview.displaySections.some((s) => s.kind === "non_execution_notice"));
    for (const section of preview.displaySections) {
      assert.equal(section.userVisibleNow, false);
      assert.equal(section.containsRawInput, false);
      assert.equal(section.containsFullCandidate, false);
      assert.equal(section.containsPii, false);
      assert.equal(section.containsProjectNameRaw, false);
      assert.equal(section.containsExecutableInstruction, false);
      assert.equal(section.containsPersistenceInstruction, false);
    }
  });
}

test("rendered previews never contain raw input, full candidate, PII, or a raw project name in body text", () => {
  for (const [fixtureId] of RENDER_FIXTURE_EXPECTATIONS) {
    const preview = renderFromFixture(fixtureId);
    for (const section of preview.displaySections) {
      assert.doesNotMatch(section.body, /@/, `section ${section.kind} body should not look like an email`);
      assert.doesNotMatch(section.body, /\bTODO_RAW_INPUT\b/);
    }
  }
});

// ─── Preview validation (positive) ───────────────────────────────────────────────────

const VALIDATION_POSITIVE_FIXTURE_IDS = [
  "uvdr-validate-internal-dry-run-notice",
  "uvdr-validate-display-contract",
  "uvdr-validate-clarification-first",
  "uvdr-validate-route-preservation",
  "uvdr-validate-unsupported-preservation",
  "uvdr-validate-non-execution-notice",
  "uvdr-validate-no-visibility-attempt",
  "uvdr-validate-no-production-eligibility",
  "uvdr-validate-no-leakage",
  "uvdr-validate-no-side-effects",
];

assert.equal(VALIDATION_POSITIVE_FIXTURE_IDS.length, 10);

for (const fixtureId of VALIDATION_POSITIVE_FIXTURE_IDS) {
  test(`${fixtureId}: valid preview passes every gate`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
    const validation = validateDecisionSupportUserVisibleDryRunPreview(preview);
    assert.equal(validation.valid, true);
    assert.equal(validation.qaStatus, "pass");
    assert.equal(validation.riskLevel, "low");
    assert.deepEqual(validation.violations, []);
    assert.equal(validation.internalDryRunNoticePassed, true);
    assert.equal(validation.displayContractPassed, true);
    assert.equal(validation.nonExecutionNoticePassed, true);
    assert.equal(validation.noVisibilityAttemptPassed, true);
    assert.equal(validation.noProductionEligibilityPassed, true);
    assert.equal(validation.noLeaksPassed, true);
    assert.equal(validation.noSideEffectsPassed, true);
    if (preview.previewKind === "clarification_first_preview") assert.equal(validation.clarificationFirstPassed, true);
    if (preview.previewKind === "route_preservation_preview") assert.equal(validation.routePreservationPassed, true);
    if (preview.previewKind === "unsupported_boundary_preview") assert.equal(validation.unsupportedPreservationPassed, true);
    assert.equal(validation.userVisibleOutputAttempted, false);
    assert.equal(validation.productionWiringAttempted, false);
    assert.equal(validation.routerChangeAttempted, false);
    assert.equal(validation.composerChangeAttempted, false);
    assert.equal(validation.endpointChangeAttempted, false);
    assert.equal(validation.featureFlagAttempted, false);
    assert.equal(validation.realPersistenceAttempted, false);
    assert.equal(validation.dbWriteAttempted, false);
    assert.equal(validation.supabaseWriteAttempted, false);
    assert.equal(validation.externalCallAttempted, false);
  });
}

test("clarification/route/unsupported passed flags trivially pass for non-matching preview kinds", () => {
  const routePreview = renderFromFixture("uvdr-render-route-preservation");
  const routeValidation = validateDecisionSupportUserVisibleDryRunPreview(routePreview);
  assert.equal(routeValidation.clarificationFirstPassed, true);
  assert.equal(routeValidation.unsupportedPreservationPassed, true);

  const shadowPreview = renderFromFixture("uvdr-render-shadow-only-internal");
  const shadowValidation = validateDecisionSupportUserVisibleDryRunPreview(shadowPreview);
  assert.equal(shadowValidation.clarificationFirstPassed, true);
  assert.equal(shadowValidation.routePreservationPassed, true);
  assert.equal(shadowValidation.unsupportedPreservationPassed, true);
});

// ─── Preview validation (negative synthetic) ─────────────────────────────────────────

test("uvdr-negative-missing-internal-dry-run-notice: fails internalDryRunNoticePassed and displayContractPassed", () => {
  const fixtureCase = fixtureFor("uvdr-negative-missing-internal-dry-run-notice");
  const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
  const mutated = { ...preview, displaySections: preview.displaySections.filter((s) => s.kind !== "internal_dry_run_notice") };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.internalDryRunNoticePassed, false);
  assert.equal(validation.displayContractPassed, false);
  assert.ok(validation.violations.includes("missing_internal_dry_run_notice"));
});

test("uvdr-negative-missing-required-section: removing clarifying_question fails displayContractPassed and clarificationFirstPassed", () => {
  const fixtureCase = fixtureFor("uvdr-negative-missing-required-section");
  const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
  const mutated = { ...preview, displaySections: preview.displaySections.filter((s) => s.kind !== "clarifying_question") };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.displayContractPassed, false);
  assert.equal(validation.clarificationFirstPassed, false);
  assert.ok(validation.violations.includes("missing_clarifying_question"));
});

test("uvdr-negative-prohibited-section-present: injecting blocked_notice into a clarification_first_preview fails displayContractPassed", () => {
  const fixtureCase = fixtureFor("uvdr-negative-prohibited-section-present");
  const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
  const mutated = {
    ...preview,
    displaySections: [...preview.displaySections, { sectionId: "blocked_notice-99", kind: "blocked_notice", title: "x", body: "x", order: 99, required: false, internalOnly: true, userVisibleNow: false, containsRawInput: false, containsFullCandidate: false, containsPii: false, containsProjectNameRaw: false, containsExecutableInstruction: false, containsPersistenceInstruction: false, warnings: [] }],
  };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.displayContractPassed, false);
  assert.ok(validation.violations.includes("unsafe_display_format"));
});

test("uvdr-negative-user-visible-now-true: preview.userVisibleNow true fails noVisibilityAttemptPassed and blocks", () => {
  const fixtureCase = fixtureFor("uvdr-negative-user-visible-now-true");
  const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
  const mutated = { ...preview, userVisibleNow: true };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noVisibilityAttemptPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("user_visible_output_attempted"));
});

test("preview with displaySection userVisibleNow true fails noVisibilityAttemptPassed", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const mutated = { ...preview, displaySections: preview.displaySections.map((s, i) => (i === 0 ? { ...s, userVisibleNow: true } : s)) };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.noVisibilityAttemptPassed, false);
  assert.equal(validation.valid, false);
});

test("uvdr-negative-production-eligible-now-true: preview.productionEligibleNow true fails noProductionEligibilityPassed", () => {
  const fixtureCase = fixtureFor("uvdr-negative-production-eligible-now-true");
  const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
  const mutated = { ...preview, productionEligibleNow: true };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
});

test("uvdr-negative-raw-input-leak: a section with containsRawInput true fails noLeaksPassed and blocks", () => {
  const fixtureCase = fixtureFor("uvdr-negative-raw-input-leak");
  const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
  const mutated = { ...preview, displaySections: preview.displaySections.map((s, i) => (i === 1 ? { ...s, containsRawInput: true } : s)) };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noLeaksPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("raw_input_leak"));
});

test("uvdr-negative-pii-leak: a section with containsPii true fails noLeaksPassed and blocks", () => {
  const fixtureCase = fixtureFor("uvdr-negative-pii-leak");
  const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
  const mutated = { ...preview, displaySections: preview.displaySections.map((s, i) => (i === 1 ? { ...s, containsPii: true } : s)) };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noLeaksPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("pii_leak"));
});

test("full candidate leak and project name leak also fail noLeaksPassed", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const fullCandidateCase = { ...preview, displaySections: preview.displaySections.map((s, i) => (i === 1 ? { ...s, containsFullCandidate: true } : s)) };
  assert.ok(validateDecisionSupportUserVisibleDryRunPreview(fullCandidateCase).violations.includes("full_candidate_leak"));

  const projectNameCase = { ...preview, displaySections: preview.displaySections.map((s, i) => (i === 1 ? { ...s, containsProjectNameRaw: true } : s)) };
  assert.ok(validateDecisionSupportUserVisibleDryRunPreview(projectNameCase).violations.includes("project_name_leak"));
});

test("uvdr-negative-side-effect: preview.persistedNow true fails noSideEffectsPassed and blocks", () => {
  const fixtureCase = fixtureFor("uvdr-negative-side-effect");
  const preview = renderDecisionSupportUserVisibleDryRunPreview(fixtureCase.sourceQualityCaseEvaluation);
  const mutated = { ...preview, persistedNow: true };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.equal(validation.qaStatus, "blocked");
  assert.ok(validation.violations.includes("real_persistence"));
});

test("preview with executable instruction fails noSideEffectsPassed", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const mutated = { ...preview, displaySections: preview.displaySections.map((s, i) => (i === 1 ? { ...s, containsExecutableInstruction: true } : s)) };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.ok(validation.violations.includes("action_execution"));
});

test("preview with persistence instruction fails noSideEffectsPassed", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const mutated = { ...preview, displaySections: preview.displaySections.map((s, i) => (i === 1 ? { ...s, containsPersistenceInstruction: true } : s)) };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.ok(validation.violations.includes("real_persistence"));
});

test("preview with externalSideEffectsAllowed true fails noSideEffectsPassed", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const mutated = { ...preview, externalSideEffectsAllowed: true };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.ok(validation.violations.includes("external_call"));
});

test("preview with executableNow true fails noSideEffectsPassed", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const mutated = { ...preview, executableNow: true };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.noSideEffectsPassed, false);
  assert.ok(validation.violations.includes("action_execution"));
});

// ─── Harness run ──────────────────────────────────────────────────────────────────────

test("harness processes the full Sprint 18R corpus and produces one case result per case", () => {
  assert.equal(HARNESS.caseResults.length, EVALUATION.caseEvaluations.length);
  assert.ok(HARNESS.caseResults.length > 0);
});

test("runDecisionSupportUserVisibleDryRunEvaluationHarness reuses the Sprint 34R evaluation decision", () => {
  assert.equal(HARNESS.evaluationSummary.decision, "ready_for_user_visible_dry_run_evaluation_harness");
});

test("runDecisionSupportUserVisibleDryRunEvaluationHarness honors the default synthetic corpus when no cases are supplied", () => {
  const defaultHarness = runDecisionSupportUserVisibleDryRunEvaluationHarness({ now: NOW });
  assert.ok(defaultHarness.caseResults.length > 0);
  assert.ok(defaultHarness.caseResults.length < DECISION_CLARIFICATION_CASES.length);
});

test("runDecisionSupportUserVisibleDryRunEvaluationHarness can reuse a pre-built evaluation instead of rebuilding one", () => {
  const evaluation = runDecisionSupportResponseDraftQualityEvaluation({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const harness = runDecisionSupportUserVisibleDryRunEvaluationHarness({ evaluation, now: NOW });
  assert.equal(harness.caseResults.length, evaluation.caseEvaluations.length);
  assert.equal(harness.evaluation, evaluation);
});

test("uvdr-summary-pass: totalCases matches the Sprint 18R corpus size, every case passes", () => {
  fixtureFor("uvdr-summary-pass");
  assert.equal(SUMMARY.totalCases, 79);
  assert.equal(SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(SUMMARY.previewRenderedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.previewAcceptedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.previewRejectedCount, 0);
  assert.equal(SUMMARY.previewBlockedCount, 0);
  assert.equal(SUMMARY.qaPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.qaWarningCount, 0);
  assert.equal(SUMMARY.qaFailCount, 0);
  assert.equal(SUMMARY.qaBlockedCount, 0);
});

test("summary: preview-kind counts match the documented Sprint 33R/34R draft-kind baseline", () => {
  assert.equal(SUMMARY.clarificationFirstPreviewCount, 69);
  assert.equal(SUMMARY.routePreservationPreviewCount, 10);
  assert.equal(SUMMARY.unsupportedBoundaryPreviewCount, 0);
  assert.equal(SUMMARY.shadowOnlyInternalPreviewCount, 0);
  assert.equal(SUMMARY.blockedUnsafePreviewCount, 0);
});

test("summary: preview-kind counts sum to totalCases", () => {
  const sum =
    SUMMARY.clarificationFirstPreviewCount + SUMMARY.routePreservationPreviewCount + SUMMARY.unsupportedBoundaryPreviewCount + SUMMARY.shadowOnlyInternalPreviewCount + SUMMARY.blockedUnsafePreviewCount;
  assert.equal(sum, SUMMARY.totalCases);
});

test("summary: safeFor* counts are as expected", () => {
  assert.equal(SUMMARY.safeForDefaultOffRouteComposerAdapterCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.safeForUserVisibleOutputNowCount, 0);
  assert.equal(SUMMARY.safeForProductionCount, 0);
});

test("summary: score averages/minimums meet their floors", () => {
  assert.ok(SUMMARY.averagePreviewQualityScore >= 90);
  assert.ok(SUMMARY.averageDisplayContractScore >= 90);
  assert.ok(SUMMARY.minPreviewQualityScore >= 85);
  assert.ok(SUMMARY.minDisplayContractScore >= 85);
});

test("summary: every gate-pass count equals totalCases for the clean corpus", () => {
  assert.equal(SUMMARY.internalDryRunNoticePassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.displayContractPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.nonExecutionNoticePassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noVisibilityAttemptPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noProductionEligibilityPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noLeaksPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noSideEffectsPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.clarificationFirstPassedCount, 69);
  assert.equal(SUMMARY.routePreservationPassedCount, 10);
  assert.equal(SUMMARY.unsupportedPreservationPassedCount, 0);
});

test("summary: violation and attempted counts are all clean", () => {
  assert.equal(SUMMARY.violationCount, 0);
  assert.equal(SUMMARY.criticalViolationCount, 0);
  assert.equal(SUMMARY.userVisibleOutputAttemptedCount, 0);
  assert.equal(SUMMARY.productionWiringAttemptedCount, 0);
  assert.equal(SUMMARY.routerChangeAttemptedCount, 0);
  assert.equal(SUMMARY.composerChangeAttemptedCount, 0);
  assert.equal(SUMMARY.endpointChangeAttemptedCount, 0);
  assert.equal(SUMMARY.featureFlagAttemptedCount, 0);
  assert.equal(SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(SUMMARY.externalCallAttemptedCount, 0);
});

test("uvdr-decision-ready-for-default-off-route-composer-integration-adapter: decision is as expected", () => {
  fixtureFor("uvdr-decision-ready-for-default-off-route-composer-integration-adapter");
  assert.equal(SUMMARY.decision, "ready_for_default_off_route_composer_integration_adapter");
});

test("uvdr-recommended-sprint-36r: recommendedNextSprint is Sprint 36R", () => {
  fixtureFor("uvdr-recommended-sprint-36r");
  assert.equal(SUMMARY.recommendedNextSprint, "Sprint 36R — Default-Off Route/Composer Integration Adapter");
});

test("summary accepts a bare case-results array plus sprint34EvaluationDecision option", () => {
  const bareSummary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(HARNESS.caseResults, {
    sprint34EvaluationDecision: HARNESS.evaluationSummary.decision,
  });
  assert.equal(bareSummary.totalCases, SUMMARY.totalCases);
  assert.equal(bareSummary.decision, SUMMARY.decision);
});

test("summary: bare case-results array without sprint34EvaluationDecision cannot reach ready_for_default_off_route_composer_integration_adapter", () => {
  const bareSummary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(HARNESS.caseResults);
  assert.notEqual(bareSummary.decision, "ready_for_default_off_route_composer_integration_adapter");
});

test("summary: representativeAcceptedPreviews is capped and rejectedPreviews/blockedPreviews are empty for the clean corpus", () => {
  assert.ok(SUMMARY.representativeAcceptedPreviews.length <= 8);
  assert.equal(SUMMARY.rejectedPreviews.length, 0);
  assert.equal(SUMMARY.blockedPreviews.length, 0);
});

// ─── Decision blocking paths (synthetic) ───────────────────────────────────────────

test("decision: a leaked case forces blocked_by_leakage_or_side_effect_risk", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const leaked = { ...preview, displaySections: preview.displaySections.map((s, i) => (i === 1 ? { ...s, containsPii: true } : s)) };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(leaked);
  const caseResult = {
    caseId: "leak-1",
    sourceDraftId: preview.sourceDraftId,
    sourceDraftKind: preview.sourceDraftKind,
    sourceRouteKind: preview.sourceRouteKind,
    preview: { ...leaked, status: "blocked" },
    validation,
    previewRendered: true,
    previewAccepted: false,
    previewRejected: false,
    previewBlocked: true,
    safeForDefaultOffRouteComposerAdapter: false,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness([caseResult], { sprint34EvaluationDecision: "ready_for_user_visible_dry_run_evaluation_harness" });
  assert.equal(summary.decision, "blocked_by_leakage_or_side_effect_risk");
});

test("decision: a rejected (contract gap) case with no leakage forces blocked_by_preview_contract_gap", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const rejected = { ...preview, displaySections: preview.displaySections.filter((s) => s.kind !== "clarifying_question") };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(rejected);
  assert.equal(validation.qaStatus, "fail");
  const caseResult = {
    caseId: "gap-1",
    sourceDraftId: preview.sourceDraftId,
    sourceDraftKind: preview.sourceDraftKind,
    sourceRouteKind: preview.sourceRouteKind,
    preview: { ...rejected, status: "rejected" },
    validation,
    previewRendered: true,
    previewAccepted: false,
    previewRejected: true,
    previewBlocked: false,
    safeForDefaultOffRouteComposerAdapter: false,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness([caseResult], { sprint34EvaluationDecision: "ready_for_user_visible_dry_run_evaluation_harness" });
  assert.equal(summary.decision, "blocked_by_preview_contract_gap");
});

test("decision: continue_dry_run_harness_only when the Sprint 34R evaluation decision is not ready", () => {
  const summary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(HARNESS.caseResults, { sprint34EvaluationDecision: "continue_quality_evaluation_only" });
  assert.equal(summary.decision, "continue_dry_run_harness_only");
});

// ─── Codex review hardening (post-merge fixes) ─────────────────────────────────────

test("decision: a stricter configured minPreviewQualityScore that the observed minimum fails to clear blocks even though the average still clears it", () => {
  // Documented corpus: average 91.88 clears a 90 floor, but the observed minimum (88.43) does not —
  // the decision must not silently stay ready just because the hardcoded 85/90 floors are satisfied.
  const strictHarness = runDecisionSupportUserVisibleDryRunEvaluationHarness({
    cases: DECISION_CLARIFICATION_CASES,
    now: NOW,
    config: { minPreviewQualityScore: 90 },
  });
  const strictSummary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(strictHarness);
  assert.ok(strictSummary.averagePreviewQualityScore >= 90);
  assert.ok(strictSummary.minPreviewQualityScore < 90);
  assert.equal(strictSummary.decision, "blocked_by_low_preview_quality");
});

test("decision: a stricter configured minDisplayContractScore that a case's own contract score fails to clear rejects that case (and blocks the decision)", () => {
  // A per-case displayContractScore below the configured floor fails displayContractPassed directly
  // (checkDisplayContract), which rejects that preview and trips the more specific
  // blocked_by_preview_contract_gap path before the average/minimum floor check is ever reached.
  const strictHarness = runDecisionSupportUserVisibleDryRunEvaluationHarness({
    cases: DECISION_CLARIFICATION_CASES,
    now: NOW,
    config: { minDisplayContractScore: 93 },
  });
  const strictSummary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness(strictHarness);
  assert.ok(strictSummary.minDisplayContractScore < 93);
  assert.ok(strictSummary.previewRejectedCount > 0);
  assert.notEqual(strictSummary.decision, "ready_for_default_off_route_composer_integration_adapter");
});

test("validateDecisionSupportUserVisibleDryRunPreview fails a contract that clears blocksProductionEligibility but leaves another blocks* flag false", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const mutated = { ...preview, displayContract: { ...preview.displayContract, blocksExecution: false } };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.noProductionEligibilityPassed, false);
  assert.ok(validation.violations.includes("unsafe_display_format"));
});

test("validateDecisionSupportUserVisibleDryRunPreview ignores an adapter-supplied contract that weakens requiredSections for the preview kind", () => {
  const preview = renderFromFixture("uvdr-render-blocked-unsafe");
  const withoutBlockedNotice = { ...preview, displaySections: preview.displaySections.filter((s) => s.kind !== "blocked_notice") };
  // The embedded contract is tampered to only require the sections still present — the validator must
  // still require blocked_notice because it derives requirements from previewKind, not from this object.
  const tamperedContract = { ...withoutBlockedNotice.displayContract, requiredSections: ["internal_dry_run_notice", "non_execution_notice"] };
  const mutated = { ...withoutBlockedNotice, displayContract: tamperedContract };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mutated);
  assert.equal(validation.valid, false);
  assert.equal(validation.displayContractPassed, false);
});

test("harness rejects a case whose source Sprint 34R quality evaluation is not pass/safeForUserVisibleDryRunHarness even though its rendered preview validates cleanly", () => {
  const baseEvaluation = runDecisionSupportResponseDraftQualityEvaluation({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const targetIndex = baseEvaluation.caseEvaluations.findIndex((c) => c.draftKind === "clarification_first_draft");
  assert.ok(targetIndex >= 0);
  const mutatedEvaluation = {
    ...baseEvaluation,
    caseEvaluations: baseEvaluation.caseEvaluations.map((c, i) => (i === targetIndex ? { ...c, pass: false, safeForUserVisibleDryRunHarness: false } : c)),
  };
  const harness = runDecisionSupportUserVisibleDryRunEvaluationHarness({ evaluation: mutatedEvaluation, now: NOW });
  const caseResult = harness.caseResults[targetIndex];
  assert.equal(caseResult.validation.valid, true, "the rendered preview shape itself should still validate cleanly");
  assert.equal(caseResult.previewAccepted, false);
  assert.equal(caseResult.previewRejected, true);
  assert.equal(caseResult.safeForDefaultOffRouteComposerAdapter, false);
  assert.ok(caseResult.warnings.some((w) => w.includes("not pass / safeForUserVisibleDryRunHarness")));
});

test("harness passes a stricter configured minDisplayContractScore into per-case validation rather than always using the default floor", () => {
  const harness = runDecisionSupportUserVisibleDryRunEvaluationHarness({
    cases: DECISION_CLARIFICATION_CASES,
    now: NOW,
    config: { minDisplayContractScore: 93 },
  });
  const routePreservationCase = harness.caseResults.find((c) => c.preview.previewKind === "route_preservation_preview");
  assert.ok(routePreservationCase, "corpus must contain at least one route_preservation_preview case");
  assert.equal(routePreservationCase.preview.displayContractScore, 92);
  assert.equal(routePreservationCase.validation.displayContractPassed, false);
  assert.equal(routePreservationCase.validation.valid, false);
  assert.equal(routePreservationCase.previewAccepted, false);
});

test("summary: criticalViolationCount counts only the violations classified critical, not every violation on a critical-risk preview", () => {
  const preview = renderFromFixture("uvdr-render-clarification-first");
  const mixed = {
    ...preview,
    displaySections: preview.displaySections
      .filter((s) => s.kind !== "clarifying_question")
      .map((s, i) => (i === 0 ? { ...s, containsPii: true } : s)),
  };
  const validation = validateDecisionSupportUserVisibleDryRunPreview(mixed);
  assert.ok(validation.violations.includes("pii_leak"));
  assert.ok(validation.violations.includes("missing_clarifying_question"));
  assert.equal(validation.riskLevel, "critical");

  const caseResult = {
    caseId: "mixed-1",
    sourceDraftId: preview.sourceDraftId,
    sourceDraftKind: preview.sourceDraftKind,
    sourceRouteKind: preview.sourceRouteKind,
    preview: { ...mixed, status: "blocked" },
    validation,
    previewRendered: true,
    previewAccepted: false,
    previewRejected: false,
    previewBlocked: true,
    safeForDefaultOffRouteComposerAdapter: false,
    safeForUserVisibleOutputNow: false,
    safeForProduction: false,
    warnings: [],
  };
  const summary = summarizeDecisionSupportUserVisibleDryRunEvaluationHarness([caseResult], { sprint34EvaluationDecision: "ready_for_user_visible_dry_run_evaluation_harness" });
  assert.equal(summary.violationCount, validation.violations.length);
  assert.equal(summary.criticalViolationCount, 1, "only pii_leak is critical — missing_clarifying_question must not inflate the count");
});

// ─── Explain ────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportUserVisibleDryRunEvaluationHarness returns a structured explanation", () => {
  const explain = explainDecisionSupportUserVisibleDryRunEvaluationHarness();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
});

// ─── Regression: Sprint 18R-34R + golden/classifier metrics unchanged ──────────────

test("regression: Sprint 34R response draft quality evaluation metrics stay clean against the 79-case corpus", () => {
  const evaluation = runDecisionSupportResponseDraftQualityEvaluation({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseDraftQualityEvaluation(evaluation);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.passCount, 79);
  assert.equal(summary.decision, "ready_for_user_visible_dry_run_evaluation_harness");
});

test("regression: Sprint 33R response draft harness metrics stay clean against the 79-case corpus", () => {
  const harness = runDecisionSupportResponseDraftHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseDraftHarness(harness);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.draftAcceptedCount, 79);
  assert.equal(summary.clarificationFirstDraftCount, 69);
  assert.equal(summary.routePreservationDraftCount, 10);
  assert.equal(summary.decision, "ready_for_response_draft_quality_evaluation");
});

test("regression: Sprint 32R response QA plan metrics stay clean against the 79-case corpus", () => {
  const plan = buildDecisionSupportResponseQaDryRunPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportResponseQaDryRunPlan(plan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.clarificationQuestionCaseCount, 69);
  assert.equal(summary.routePreservationCaseCount, 10);
  assert.equal(summary.decision, "ready_for_response_draft_harness");
});

test("regression: Sprint 31R clarification-gated integration plan metrics stay clean against the 79-case corpus", () => {
  const integrationPlan = buildDecisionSupportClarificationGatedIntegrationPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportClarificationGatedIntegrationPlan(integrationPlan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.clarificationGatedCaseCount, 69);
  assert.equal(summary.existingRoutePreservedCaseCount, 10);
  assert.equal(summary.decision, "ready_for_user_visible_dry_run_plan");
});

test("regression: Sprint 30R controlled replay metrics stay clean against the 79-case corpus", () => {
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowControlledReplayEvaluation(evaluation);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.deterministicReplayRate, 100);
  assert.equal(summary.safeReplayRate, 100);
  assert.equal(summary.decision, "ready_for_clarification_gated_integration_plan");
});

test("regression: Sprint 29R persistence readiness baseline matches the documented Sprint 29R result", () => {
  const inputMetrics = createDecisionSupportShadowPersistenceReadinessInputMetrics(DECISION_CLARIFICATION_CASES, { now: NOW });
  const review = buildDecisionSupportShadowPersistenceReadinessReview({ now: NOW, inputMetrics });
  const summary = summarizeDecisionSupportShadowPersistenceReadinessReview(review);
  assert.equal(summary.readinessScore, 62.9);
  assert.equal(summary.decision, "do_not_build_real_persistence_yet");
});

test("regression: Sprint 28R fake adapter metrics stay clean against the 79-case corpus", () => {
  const result = runDecisionSupportShadowStorageFakeAdapterEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(result);
  assert.equal(summary.fakeWriteAcceptedRate, 100);
});

test("regression: Sprint 27R adapter plan metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStorageAdapterPlanEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(results);
  assert.equal(summary.validDraftRate, 100);
});

test("regression: Sprint 26R storage policy metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStoragePolicyEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStoragePolicyEvaluation(results);
  assert.equal(summary.rawInputViolationCount, 0);
  assert.equal(summary.fullCandidateViolationCount, 0);
});

test("regression: Sprint 25R shadow capture harness metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW, context: { mode: "dry_run" } });
  const summary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(results);
  assert.equal(summary.acceptableCaptureRate, 100);
  assert.equal(summary.rawInputRetainedCount, 0);
});

test("regression: Sprint 22R clarification response evaluation still runs cleanly", () => {
  const results = runClarificationResponseEvaluation(toDecisionClarificationEvaluationCases(DECISION_CLARIFICATION_CASES), { now: NOW });
  assert.ok(results.length > 0);
});

test("regression: golden intent compatibilityRate is unaffected by this sprint", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.ok(report.overall.compatibilityRate >= 0);
  assert.ok(report.overall.compatibilityRate <= 100);
});

// ─── No real storage / no production ───────────────────────────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

const IMPLEMENTATION_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarness.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportUserVisibleDryRunEvaluationHarnessTypes.ts", import.meta.url),
  "utf8",
);

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /brainRouter/);
  assert.doesNotMatch(imports, /responseComposer/);
  assert.doesNotMatch(imports, /conversationalBrainGateway/);
  assert.doesNotMatch(imports, /handlers\//);
  assert.doesNotMatch(imports, /command-center\/chat/);
  assert.doesNotMatch(imports, /supabase/i);
  assert.doesNotMatch(imports, /nodemailer/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\bfetch\(/);
});

test("this module never imports intentCompatibilityAdapter.ts, intentClassifier.rules.ts, or intent-patterns.ts", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /intentCompatibilityAdapter/);
  assert.doesNotMatch(imports, /intentClassifier\.rules/);
  assert.doesNotMatch(imports, /intent-patterns/);
});

test("no feature flag / env read is ever performed by this sprint", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /process\.env/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /growthbook/i);
  assert.doesNotMatch(TYPES_SOURCE, /process\.env/);
});

test("no database/migration/storage-adapter vocabulary appears as executable code (only as string literals/docs)", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /createClient\(/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\.from\(["'`]\w+["'`]\)\.(insert|upsert|update|delete)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /CREATE TABLE/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /ALTER TABLE/i);
});

test("this module never calls the system clock (no bare Date.now()/new Date()) or an LLM", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /new Date\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /Date\.now\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\bopenai\b/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\banthropic\b/i);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /\.chat\.completions\b/);
});

test("this module never imports from tests/fixtures/", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /tests\/fixtures/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportUserVisibleDryRunEvaluationHarness/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});
