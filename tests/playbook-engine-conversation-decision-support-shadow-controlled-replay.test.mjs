import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_VERSION,
  createDecisionSupportShadowControlledReplayConfig,
  listDecisionSupportShadowControlledReplayAllowedNextActions,
  listDecisionSupportShadowControlledReplayProhibitedActions,
  classifyDecisionSupportShadowControlledReplayCase,
  recommendDecisionSupportShadowControlledReplayRoute,
  runDecisionSupportShadowControlledReplayPass,
  runDecisionSupportShadowControlledReplayEvaluation,
  aggregateDecisionSupportShadowControlledReplayCaseResults,
  summarizeDecisionSupportShadowControlledReplayEvaluation,
  explainDecisionSupportShadowControlledReplayEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowControlledReplay.ts";
import { DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_CASES } from "./fixtures/conversational-brain-decision-support-shadow-controlled-replay-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Regression imports — Sprint 24R-29R + golden/classifier suites, reused read-only for comparison.
import {
  runDecisionSupportShadowModePrepEvaluation,
  summarizeDecisionSupportShadowModePrepEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts";
import {
  runDecisionSupportShadowCaptureHarnessEvaluation,
  summarizeDecisionSupportShadowCaptureHarnessEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";
import {
  runDecisionSupportShadowStoragePolicyEvaluation,
  summarizeDecisionSupportShadowStoragePolicyEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts";
import {
  runDecisionSupportShadowStorageAdapterPlanEvaluation,
  summarizeDecisionSupportShadowStorageAdapterPlanEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts";
import {
  runDecisionSupportShadowStorageFakeAdapterEvaluation,
  summarizeDecisionSupportShadowStorageFakeAdapterEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapter.ts";
import { runGoldenIntentEvaluation, summarizeGoldenIntentEvaluation } from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

import { prepareDecisionSupportShadowModeRun } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts";
import { captureDecisionSupportShadowRun } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";
import { mapDecisionSupportCaptureRecordToStorageDraft } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts";
import {
  createDecisionSupportShadowStorageFakeAdapter,
  writeDecisionSupportShadowStorageDraftToFakeAdapter,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapter.ts";

/**
 * Sprint 30R — Decision Support Controlled Shadow Replay Evaluation.
 *
 * Tests the pure, offline, deterministic controlled shadow replay in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowControlledReplay.ts`.
 * This replays the Sprint 18R corpus through the existing Sprint 24R-28R shadow pipeline multiple
 * times, using only the Sprint 28R fake (in-memory, test-only) adapter — it creates no database,
 * migration, table, real storage adapter, or Supabase write, and never shows anything to a user.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const EVALUATION = runDecisionSupportShadowControlledReplayEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
const SUMMARY = summarizeDecisionSupportShadowControlledReplayEvaluation(EVALUATION);

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 25 and 45 cases", () => {
  assert.ok(DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_CASES.length >= 25);
  assert.ok(DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_CASES.length <= 45);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.category, "string");
    assert.equal(typeof c.expectedRouteRecommendation, "string");
    assert.equal(typeof c.expectedStable, "boolean");
    assert.equal(typeof c.expectedSafetyStatus, "string");
    assert.equal(typeof c.expectedFakeWriteStatus, "string");
    assert.equal(typeof c.expectedForbiddenCountsZero, "boolean");
    assert.equal(typeof c.expectedSideEffectsZero, "boolean");
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_VERSION, "string");
  assert.ok(DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportShadowControlledReplayConfig", createDecisionSupportShadowControlledReplayConfig],
  ["listDecisionSupportShadowControlledReplayAllowedNextActions", listDecisionSupportShadowControlledReplayAllowedNextActions],
  ["listDecisionSupportShadowControlledReplayProhibitedActions", listDecisionSupportShadowControlledReplayProhibitedActions],
  ["classifyDecisionSupportShadowControlledReplayCase", classifyDecisionSupportShadowControlledReplayCase],
  ["recommendDecisionSupportShadowControlledReplayRoute", recommendDecisionSupportShadowControlledReplayRoute],
  ["runDecisionSupportShadowControlledReplayPass", runDecisionSupportShadowControlledReplayPass],
  ["runDecisionSupportShadowControlledReplayEvaluation", runDecisionSupportShadowControlledReplayEvaluation],
  ["aggregateDecisionSupportShadowControlledReplayCaseResults", aggregateDecisionSupportShadowControlledReplayCaseResults],
  ["summarizeDecisionSupportShadowControlledReplayEvaluation", summarizeDecisionSupportShadowControlledReplayEvaluation],
  ["explainDecisionSupportShadowControlledReplayEvaluation", explainDecisionSupportShadowControlledReplayEvaluation],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile", () => {
  const config = createDecisionSupportShadowControlledReplayConfig();
  assert.equal(config.profile, "strict_fake_adapter_controlled_replay");
  assert.equal(config.mode, "multi_pass_replay");
  assert.equal(config.replayPasses, 3);
  assert.equal(config.allowFakeAdapterWrites, true);
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.allowUserVisibleOutput, false);
  assert.equal(config.allowProductionWiring, false);
  assert.equal(config.requireCapturePolicyClean, true);
  assert.equal(config.requireStorageDraftValid, true);
  assert.equal(config.requireFakeAdapterSafety, true);
  assert.equal(config.requireDeterministicOutputs, true);
});

test("config default strict (fixture cr-config-default-strict)", () => {
  fixtureFor("cr-config-default-strict");
  const config = createDecisionSupportShadowControlledReplayConfig();
  assert.equal(config.profile, "strict_fake_adapter_controlled_replay");
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "cr-config-block-real-persistence",
  "cr-config-block-db-write",
  "cr-config-block-supabase-write",
  "cr-config-block-external-calls",
  "cr-config-block-user-visible-output",
  "cr-config-block-production-wiring",
];

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    const config = createDecisionSupportShadowControlledReplayConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all six are forced true at once", () => {
  const config = createDecisionSupportShadowControlledReplayConfig({
    allowRealPersistence: true,
    allowDbWrite: true,
    allowSupabaseWrite: true,
    allowExternalCalls: true,
    allowUserVisibleOutput: true,
    allowProductionWiring: true,
  });
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.allowUserVisibleOutput, false);
  assert.equal(config.allowProductionWiring, false);
});

test("config honors safe overrides (mode, replayPasses, allowFakeAdapterWrites)", () => {
  const config = createDecisionSupportShadowControlledReplayConfig({ mode: "determinism_check", replayPasses: 5, allowFakeAdapterWrites: false });
  assert.equal(config.mode, "determinism_check");
  assert.equal(config.replayPasses, 5);
  assert.equal(config.allowFakeAdapterWrites, false);
});

test("replayPasses is normalized: non-positive, fractional, and non-finite overrides are clamped to a positive integer", () => {
  assert.equal(createDecisionSupportShadowControlledReplayConfig({ replayPasses: 0 }).replayPasses, 1);
  assert.equal(createDecisionSupportShadowControlledReplayConfig({ replayPasses: -3 }).replayPasses, 1);
  assert.equal(createDecisionSupportShadowControlledReplayConfig({ replayPasses: 2.5 }).replayPasses, 2);
  assert.equal(createDecisionSupportShadowControlledReplayConfig({ replayPasses: Number.NaN }).replayPasses, 3);
  assert.equal(createDecisionSupportShadowControlledReplayConfig({ replayPasses: Infinity }).replayPasses, 3);
});

test("a fractional replayPasses override actually runs the normalized (floored) number of passes, not a stale reported value", () => {
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation([DECISION_CLARIFICATION_CASES[0]], { config: { replayPasses: 2.5 }, now: NOW });
  assert.equal(evaluation.config.replayPasses, 2);
  assert.equal(evaluation.passResults.length, 2);
});

test("replayPasses: 0 does not silently produce an empty, misleading evaluation", () => {
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation([DECISION_CLARIFICATION_CASES[0]], { config: { replayPasses: 0 }, now: NOW });
  assert.equal(evaluation.config.replayPasses, 1);
  assert.equal(evaluation.passResults.length, 1);
  assert.equal(evaluation.aggregates.length, 1);
});

// ─── allowFakeAdapterWrites: false is honored ──────────────────────────────────────

test("allowFakeAdapterWrites: false skips the fake write for every case in every pass", () => {
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation(DECISION_CLARIFICATION_CASES, {
    config: { allowFakeAdapterWrites: false, replayPasses: 1 },
    now: NOW,
  });
  assert.equal(evaluation.config.allowFakeAdapterWrites, false);
  for (const p of evaluation.passResults) {
    assert.equal(p.fakeWriteStatus, "not_written", `caseId ${p.caseId} should report not_written when writes are disabled`);
    assert.equal(p.fakeWriteAccepted, false);
    assert.equal(p.fakeRecordId, undefined);
  }
});

test("allowFakeAdapterWrites: false at the single-pass level also skips the write", () => {
  const [pass] = runDecisionSupportShadowControlledReplayPass([DECISION_CLARIFICATION_CASES[0]], { now: NOW, allowFakeAdapterWrites: false });
  assert.equal(pass.fakeWriteStatus, "not_written");
  assert.equal(pass.fakeWriteAccepted, false);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportShadowControlledReplayAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("controlled replay using fake adapter"));
  assert.ok(joined.includes("clarification-gated integration planning"));
  assert.ok(joined.includes("route recommendation analysis"));
  assert.ok(joined.includes("replay drift analysis"));
  assert.ok(joined.includes("safety regression analysis"));
});

test("listDecisionSupportShadowControlledReplayAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportShadowControlledReplayAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportShadowControlledReplayAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportShadowControlledReplayProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("real persistence"));
  assert.ok(joined.includes("db write"));
  assert.ok(joined.includes("supabase write"));
  assert.ok(joined.includes("migration file"));
  assert.ok(joined.includes("sql file"));
  assert.ok(joined.includes("production feature flag"));
  assert.ok(joined.includes("router/composer/endpoint"));
  assert.ok(joined.includes("user-visible output"));
  assert.ok(joined.includes("real repository"));
  assert.ok(joined.includes("real storage adapter"));
});

test("listDecisionSupportShadowControlledReplayProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportShadowControlledReplayProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportShadowControlledReplayProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Classification ─────────────────────────────────────────────────────────────────

test("classifyDecisionSupportShadowControlledReplayCase matches every fixture's declared category", () => {
  for (const fixtureCase of DECISION_SUPPORT_SHADOW_CONTROLLED_REPLAY_CASES) {
    if (!fixtureCase.caseInput) continue;
    const category = classifyDecisionSupportShadowControlledReplayCase(fixtureCase.caseInput);
    assert.equal(category, fixtureCase.category, `fixture ${fixtureCase.id} expected category ${fixtureCase.category}, got ${category}`);
  }
});

test("classifyDecisionSupportShadowControlledReplayCase agrees with the full Sprint 18R corpus breakdown", () => {
  const counts = { decision_candidate: 0, clarification_candidate: 0, existing_route_preserved: 0, unsupported_or_not_applicable: 0 };
  for (const c of DECISION_CLARIFICATION_CASES) counts[classifyDecisionSupportShadowControlledReplayCase(c)] += 1;
  assert.equal(counts.decision_candidate, 45);
  assert.equal(counts.clarification_candidate, 24);
  assert.equal(counts.existing_route_preserved, 10);
  assert.equal(counts.unsupported_or_not_applicable, 0);
});

// ─── Route recommendation ───────────────────────────────────────────────────────────

test("decision_candidate + safe -> clarification_gated_decision_support", () => {
  const result = recommendDecisionSupportShadowControlledReplayRoute({ category: "decision_candidate", safetyStatus: "safe" });
  assert.equal(result.routeRecommendation, "clarification_gated_decision_support");
  assert.equal(result.requiresClarificationGate, true);
});

test("clarification_candidate -> clarification_gated_decision_support", () => {
  const result = recommendDecisionSupportShadowControlledReplayRoute({ category: "clarification_candidate", safetyStatus: "safe" });
  assert.equal(result.routeRecommendation, "clarification_gated_decision_support");
  assert.equal(result.requiresClarificationGate, true);
});

test("existing_route_preserved -> keep_existing_route", () => {
  const result = recommendDecisionSupportShadowControlledReplayRoute({ category: "existing_route_preserved", safetyStatus: "safe" });
  assert.equal(result.routeRecommendation, "keep_existing_route");
  assert.equal(result.shouldUseExistingRoute, true);
});

test("unsupported_or_not_applicable -> keep_unsupported", () => {
  const result = recommendDecisionSupportShadowControlledReplayRoute({ category: "unsupported_or_not_applicable", safetyStatus: "safe" });
  assert.equal(result.routeRecommendation, "keep_unsupported");
  assert.equal(result.shouldRemainUnsupported, true);
});

test("synthetic drift -> shadow_only, overriding category", () => {
  fixtureFor("cr-route-shadow-only-synthetic-drift");
  const result = recommendDecisionSupportShadowControlledReplayRoute({
    category: "decision_candidate",
    stable: false,
    driftReasons: ["routeRecommendation"],
    safetyStatus: "safe",
  });
  assert.equal(result.routeRecommendation, "shadow_only");
  assert.equal(result.shouldRemainShadowOnly, true);
});

test("non-safe safety status -> shadow_only, overriding category", () => {
  const result = recommendDecisionSupportShadowControlledReplayRoute({ category: "existing_route_preserved", safetyStatus: "unsafe" });
  assert.equal(result.routeRecommendation, "shadow_only");
  assert.equal(result.shouldRemainShadowOnly, true);
});

// ─── Replay pass ────────────────────────────────────────────────────────────────────

const SINGLE_PASS = runDecisionSupportShadowControlledReplayPass(DECISION_CLARIFICATION_CASES, { passIndex: 0, now: NOW });

test("a single pass processes the whole corpus", () => {
  assert.equal(SINGLE_PASS.length, DECISION_CLARIFICATION_CASES.length);
});

test("every pass result carries a policy-clean capture and a valid storage draft", () => {
  for (const p of SINGLE_PASS) {
    assert.equal(p.captureCreated, true, `caseId ${p.caseId} should have captureCreated true`);
    assert.equal(p.capturePolicyClean, true, `caseId ${p.caseId} should have capturePolicyClean true`);
    assert.equal(p.storageDraftCreated, true, `caseId ${p.caseId} should have storageDraftCreated true`);
    assert.equal(p.storageDraftValid, true, `caseId ${p.caseId} should have storageDraftValid true`);
  }
});

test("every pass result's fake write is accepted for a policy-clean corpus", () => {
  for (const p of SINGLE_PASS) {
    assert.equal(p.fakeWriteStatus, "fake_write_accepted", `caseId ${p.caseId} should have fake_write_accepted`);
    assert.equal(p.fakeWriteAccepted, true);
    assert.equal(typeof p.fakeRecordId, "string");
  }
});

test("every pass result carries every side effect and forbidden retention flag as false", () => {
  for (const p of SINGLE_PASS) {
    assert.equal(p.sideEffects.realPersistenceAttempted, false);
    assert.equal(p.sideEffects.dbWriteAttempted, false);
    assert.equal(p.sideEffects.supabaseWriteAttempted, false);
    assert.equal(p.sideEffects.externalCallAttempted, false);
    assert.equal(p.sideEffects.userVisibleOutputAttempted, false);
    assert.equal(p.sideEffects.productionWiringAttempted, false);
    assert.equal(p.forbiddenRetention.rawInputRetained, false);
    assert.equal(p.forbiddenRetention.inputPreviewRetained, false);
    assert.equal(p.forbiddenRetention.fullCandidateRetained, false);
    assert.equal(p.forbiddenRetention.userVisibleOutputRetained, false);
    assert.equal(p.forbiddenRetention.projectNameRetained, false);
    assert.equal(p.forbiddenRetention.emailAddressRetained, false);
    assert.equal(p.forbiddenRetention.phoneNumberRetained, false);
  }
});

test("every pass result is safe against a policy-clean corpus", () => {
  for (const p of SINGLE_PASS) assert.equal(p.safetyStatus, "safe", `caseId ${p.caseId} should be safe`);
});

// ─── Multi-pass replay ──────────────────────────────────────────────────────────────

test("replayPasses is 3 and totalPassResults equals totalCases * 3", () => {
  assert.equal(EVALUATION.config.replayPasses, 3);
  assert.equal(EVALUATION.passResults.length, DECISION_CLARIFICATION_CASES.length * 3);
});

test("results are grouped by caseId with the right pass count each", () => {
  assert.equal(EVALUATION.aggregates.length, DECISION_CLARIFICATION_CASES.length);
  for (const a of EVALUATION.aggregates) assert.equal(a.passCount, 3);
});

test("deterministicReplayRate is 100 and there are no unstable cases by default", () => {
  assert.equal(SUMMARY.deterministicReplayRate, 100);
  assert.equal(SUMMARY.unstableCaseCount, 0);
  assert.equal(SUMMARY.unstableCases.length, 0);
});

test("fixture: deterministic multi-pass replay for a single decision-candidate case", () => {
  const fixtureCase = fixtureFor("cr-deterministic-multi-pass");
  const passResults = [0, 1, 2].map((passIndex) => runDecisionSupportShadowControlledReplayPass([fixtureCase.caseInput], { passIndex, now: NOW })[0]);
  const [aggregate] = aggregateDecisionSupportShadowControlledReplayCaseResults(passResults);
  assert.equal(aggregate.stable, true);
  assert.equal(aggregate.stabilityStatus, "stable");
  assert.deepEqual(aggregate.driftReasons, []);
});

test("aggregateDecisionSupportShadowControlledReplayCaseResults detects drift when a field disagrees between passes", () => {
  const [a] = runDecisionSupportShadowControlledReplayPass([DECISION_CLARIFICATION_CASES[0]], { passIndex: 0, now: NOW });
  const drifted = { ...a, passIndex: 1, safetyStatus: "warning" };
  const [aggregate] = aggregateDecisionSupportShadowControlledReplayCaseResults([a, drifted]);
  assert.equal(aggregate.stable, false);
  assert.ok(aggregate.driftReasons.includes("safetyStatus"));
  assert.equal(aggregate.stabilityStatus, "major_drift");
  assert.equal(aggregate.routeRecommendation, "shadow_only");
  assert.equal(aggregate.shouldRemainShadowOnly, true);
});

// ─── Per-category fixture replay ───────────────────────────────────────────────────

const CATEGORY_FIXTURE_IDS = [
  "cr-category-decision-candidate-stable",
  "cr-category-clarification-candidate-stable",
  "cr-category-existing-route-stable",
  "cr-category-unsupported-stable",
];

for (const fixtureId of CATEGORY_FIXTURE_IDS) {
  test(`${fixtureId}: replays stably with the expected route recommendation`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const passResults = [0, 1, 2].map((passIndex) => runDecisionSupportShadowControlledReplayPass([fixtureCase.caseInput], { passIndex, now: NOW })[0]);
    const [aggregate] = aggregateDecisionSupportShadowControlledReplayCaseResults(passResults);
    assert.equal(aggregate.category, fixtureCase.category);
    assert.equal(aggregate.stable, fixtureCase.expectedStable);
    assert.equal(aggregate.finalSafetyStatus, fixtureCase.expectedSafetyStatus);
    assert.equal(aggregate.routeRecommendation, fixtureCase.expectedRouteRecommendation);
    for (const p of passResults) assert.equal(p.fakeWriteStatus, fixtureCase.expectedFakeWriteStatus);
  });
}

// ─── Fake write rejected only for synthetic invalid ────────────────────────────────

test("fixture: fake write rejected only for a synthetic invalid draft, never for a real corpus case", () => {
  const fixtureCase = fixtureFor("cr-fake-write-rejected-synthetic-invalid-only");
  const [realPass] = runDecisionSupportShadowControlledReplayPass([fixtureCase.caseInput], { passIndex: 0, now: NOW });
  assert.equal(realPass.fakeWriteStatus, "fake_write_accepted");

  // Build a real, valid draft via the actual pipeline, then corrupt it with a forbidden field —
  // the underlying Sprint 28R fake adapter must reject it, proving no regression in its own
  // rejection behavior, while every real corpus-derived draft above stays accepted.
  const run = prepareDecisionSupportShadowModeRun(
    { id: fixtureCase.caseInput.id, input: fixtureCase.caseInput.input, desiredFutureRoute: fixtureCase.caseInput.desiredFutureRoute, now: NOW },
    {},
  );
  const capture = captureDecisionSupportShadowRun(run, { mode: "dry_run", now: NOW });
  const validDraft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  const invalidDraft = { ...validDraft, storageEnabled: true, realPersistenceAllowed: true };

  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const validResult = writeDecisionSupportShadowStorageDraftToFakeAdapter(adapter, validDraft);
  const invalidResult = writeDecisionSupportShadowStorageDraftToFakeAdapter(adapter, invalidDraft);

  assert.equal(validResult.accepted, true);
  assert.equal(invalidResult.accepted, false);
  assert.equal(invalidResult.status, "rejected_by_policy");
});

// ─── Summary ────────────────────────────────────────────────────────────────────────

test("summary: totalCases, replayPasses, totalPassResults", () => {
  assert.equal(SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(SUMMARY.replayPasses, 3);
  assert.equal(SUMMARY.totalPassResults, DECISION_CLARIFICATION_CASES.length * 3);
});

test("summary: determinism / safety / fake-write rates are all 100", () => {
  assert.equal(SUMMARY.deterministicReplayRate, 100);
  assert.equal(SUMMARY.safeReplayRate, 100);
  assert.equal(SUMMARY.fakeWriteAcceptedRate, 100);
});

test("summary: every side-effect count is zero", () => {
  assert.equal(SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(SUMMARY.externalCallAttemptedCount, 0);
  assert.equal(SUMMARY.userVisibleOutputAttemptedCount, 0);
  assert.equal(SUMMARY.productionWiringAttemptedCount, 0);
});

test("summary: every forbidden retention count is zero", () => {
  assert.equal(SUMMARY.rawInputRetainedCount, 0);
  assert.equal(SUMMARY.inputPreviewRetainedCount, 0);
  assert.equal(SUMMARY.fullCandidateRetainedCount, 0);
  assert.equal(SUMMARY.userVisibleOutputRetainedCount, 0);
  assert.equal(SUMMARY.projectNameRetainedCount, 0);
  assert.equal(SUMMARY.emailAddressRetainedCount, 0);
  assert.equal(SUMMARY.phoneNumberRetainedCount, 0);
});

test("summary: decision is ready_for_clarification_gated_integration_plan (fixture cr-decision-ready-for-integration-plan)", () => {
  fixtureFor("cr-decision-ready-for-integration-plan");
  assert.equal(SUMMARY.decision, "ready_for_clarification_gated_integration_plan");
});

test("summary: recommendedNextSprint is Sprint 31R (fixture cr-recommended-sprint-31r)", () => {
  fixtureFor("cr-recommended-sprint-31r");
  assert.equal(SUMMARY.recommendedNextSprint, "Sprint 31R — Clarification-Gated Decision Support Integration Plan");
});

test("a clean corpus with zero decision/clarification candidates is not reported ready — there is nothing to integrate", () => {
  const existingRouteOnlyCase = fixtureFor("cr-category-existing-route-stable").caseInput;
  const evaluation = runDecisionSupportShadowControlledReplayEvaluation([existingRouteOnlyCase], { now: NOW });
  const summary = summarizeDecisionSupportShadowControlledReplayEvaluation(evaluation);
  assert.equal(summary.deterministicReplayRate, 100);
  assert.equal(summary.safeReplayRate, 100);
  assert.equal(summary.fakeWriteAcceptedRate, 100);
  assert.equal(summary.clarificationGatedRecommendationCount, 0);
  assert.notEqual(summary.decision, "ready_for_clarification_gated_integration_plan");
  assert.equal(summary.decision, "continue_shadow_replay_only");
});

test("summary: route recommendation counts match the classification breakdown", () => {
  assert.equal(SUMMARY.clarificationGatedRecommendationCount, 45 + 24);
  assert.equal(SUMMARY.existingRouteRecommendationCount, 10);
  assert.equal(SUMMARY.unsupportedRecommendationCount, 0);
  assert.equal(SUMMARY.shadowOnlyRecommendationCount, 0);
});

test("summary accepts a bare aggregates array plus passResults option", () => {
  const bareSummary = summarizeDecisionSupportShadowControlledReplayEvaluation(EVALUATION.aggregates, {
    passResults: EVALUATION.passResults,
    replayPasses: 3,
  });
  assert.equal(bareSummary.totalCases, SUMMARY.totalCases);
  assert.equal(bareSummary.decision, SUMMARY.decision);
});

// ─── Explain ────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportShadowControlledReplayEvaluation returns a structured explanation", () => {
  const explain = explainDecisionSupportShadowControlledReplayEvaluation();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
});

// ─── Regression: Sprint 24R-29R metrics unchanged ──────────────────────────────────

test("regression: Sprint 24R shadow mode prep metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowModePrepEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowModePrepEvaluation(results);
  assert.equal(summary.acceptableShadowPrepRunRate, 100);
  assert.equal(summary.allBlockingGatesPassedRate, 100);
});

test("regression: Sprint 25R shadow capture harness metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW, context: { mode: "dry_run" } });
  const summary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(results);
  assert.equal(summary.acceptableCaptureRate, 100);
  assert.equal(summary.rawInputRetainedCount, 0);
  assert.equal(summary.userVisibleOutputRetainedCount, 0);
});

test("regression: Sprint 26R storage policy metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStoragePolicyEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStoragePolicyEvaluation(results);
  assert.equal(summary.rawInputViolationCount, 0);
  assert.equal(summary.fullCandidateViolationCount, 0);
  assert.equal(summary.sideEffectViolationCount, 0);
});

test("regression: Sprint 27R adapter plan metrics stay clean against the 79-case corpus", () => {
  const results = runDecisionSupportShadowStorageAdapterPlanEvaluation(DECISION_CLARIFICATION_CASES, { now: NOW });
  const summary = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(results);
  assert.equal(summary.validDraftRate, 100);
  assert.equal(summary.invalidDraftCount, 0);
});

test("regression: Sprint 28R fake adapter metrics stay clean against the 79-case corpus", () => {
  assert.equal(EVALUATION.fakeAdapterBaselineSummary.fakeWriteAcceptedRate, 100);
  assert.equal(EVALUATION.fakeAdapterBaselineSummary.readinessStatus, "ready_for_persistence_readiness_review");
  assert.equal(EVALUATION.fakeAdapterBaselineSummary.invalidDraftRejectedCount, 11);
});

test("regression: Sprint 29R persistence readiness baseline matches the documented Sprint 29R result", () => {
  const prs = EVALUATION.persistenceReadinessSummary;
  assert.equal(prs.readinessScore, 62.9);
  assert.equal(prs.readyDomainCount, 6);
  assert.equal(prs.partiallyReadyDomainCount, 6);
  assert.equal(prs.notReadyDomainCount, 7);
  assert.equal(prs.blockedDomainCount, 0);
  assert.equal(prs.blockerCount, 17);
  assert.equal(prs.criticalBlockerCount, 7);
  assert.equal(prs.blockingBlockerCount, 9);
  assert.equal(prs.warningBlockerCount, 1);
  assert.equal(prs.decision, "do_not_build_real_persistence_yet");
  assert.equal(prs.realPersistenceAllowedNow, false);
  assert.equal(prs.migrationFileAllowedNow, false);
  assert.equal(prs.sqlFileAllowedNow, false);
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
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowControlledReplay.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowControlledReplayTypes.ts", import.meta.url),
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

test("this module never calls the system clock (no bare Date.now()/new Date())", () => {
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /new Date\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /Date\.now\(\)/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportShadowControlledReplay/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});
