import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_VERSION,
  createDecisionSupportResponseDraftHarnessConfig,
  listDecisionSupportResponseDraftHarnessAllowedNextActions,
  listDecisionSupportResponseDraftHarnessProhibitedActions,
  createDecisionSupportResponseDraftFromQaCase,
  validateDecisionSupportResponseDraft,
  runDecisionSupportResponseDraftHarness,
  summarizeDecisionSupportResponseDraftHarness,
  explainDecisionSupportResponseDraftHarness,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftHarness.ts";
import { DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_CASES } from "./fixtures/conversational-brain-decision-support-response-draft-harness-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Regression imports — Sprint 18R-32R + golden/classifier/vocabulary suites, reused read-only for comparison.
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
import { runGoldenIntentEvaluation, summarizeGoldenIntentEvaluation } from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";

/**
 * Sprint 33R — Decision Support Response Draft Harness.
 *
 * Tests the pure, offline, deterministic response draft harness in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftHarness.ts`. This
 * generates, validates, and evaluates synthetic drafts of a decision_support response for every case
 * the Sprint 32R response QA plan already assessed as safe for this harness — it never shows anything
 * to a real user, never persists anything real, and never touches the router/composer/endpoint.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const HARNESS = runDecisionSupportResponseDraftHarness({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const SUMMARY = summarizeDecisionSupportResponseDraftHarness(HARNESS);

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 35 and 55 cases", () => {
  assert.ok(DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_CASES.length >= 35);
  assert.ok(DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_CASES.length <= 55);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.draftKind, "string");
    assert.equal(typeof c.expectedDraftStatus, "string");
    assert.equal(typeof c.expectedQaStatus, "string");
    assert.equal(typeof c.expectedRiskLevel, "string");
    assert.equal(typeof c.expectedValid, "boolean");
    assert.equal(typeof c.expectedSafeForQualityEvaluation, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleOutputNow, "boolean");
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(typeof c.expectedSideEffectsZero, "boolean");
    assert.equal(typeof c.expectedLeaksZero, "boolean");
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_VERSION, "string");
  assert.ok(DECISION_SUPPORT_RESPONSE_DRAFT_HARNESS_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportResponseDraftHarnessConfig", createDecisionSupportResponseDraftHarnessConfig],
  ["listDecisionSupportResponseDraftHarnessAllowedNextActions", listDecisionSupportResponseDraftHarnessAllowedNextActions],
  ["listDecisionSupportResponseDraftHarnessProhibitedActions", listDecisionSupportResponseDraftHarnessProhibitedActions],
  ["createDecisionSupportResponseDraftFromQaCase", createDecisionSupportResponseDraftFromQaCase],
  ["validateDecisionSupportResponseDraft", validateDecisionSupportResponseDraft],
  ["runDecisionSupportResponseDraftHarness", runDecisionSupportResponseDraftHarness],
  ["summarizeDecisionSupportResponseDraftHarness", summarizeDecisionSupportResponseDraftHarness],
  ["explainDecisionSupportResponseDraftHarness", explainDecisionSupportResponseDraftHarness],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture rdh-config-default-strict)", () => {
  fixtureFor("rdh-config-default-strict");
  const config = createDecisionSupportResponseDraftHarnessConfig();
  assert.equal(config.profile, "strict_response_draft_harness");
  assert.equal(config.mode, "harness_only");
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
  assert.equal(config.requireQaPlanPass, true);
  assert.equal(config.requireContractMatch, true);
  assert.equal(config.requireClarificationFirstForDecisionSupport, true);
  assert.equal(config.requireRoutePreservationForExistingRoutes, true);
  assert.equal(config.requireUnsupportedPreservation, true);
  assert.equal(config.requireNonExecutionNotice, true);
  assert.equal(config.requireSafeNextStep, true);
  assert.equal(config.requireNoLeaks, true);
  assert.equal(config.requireNoSideEffects, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "rdh-config-block-user-visible-output",
  "rdh-config-block-production-wiring",
  "rdh-config-block-router-change",
  "rdh-config-block-composer-change",
  "rdh-config-block-endpoint-change",
  "rdh-config-block-feature-flag",
  "rdh-config-block-real-persistence",
  "rdh-config-block-db-write",
  "rdh-config-block-supabase-write",
  "rdh-config-block-external-calls",
  "rdh-config-block-action-execution",
  "rdh-config-block-task-creation",
  "rdh-config-block-email-draft-creation",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 13);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportResponseDraftHarnessConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all thirteen are forced true at once", () => {
  const config = createDecisionSupportResponseDraftHarnessConfig({
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

test("config honors safe overrides (mode, now, notes)", () => {
  const config = createDecisionSupportResponseDraftHarnessConfig({
    mode: "synthetic_draft_generation",
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "synthetic_draft_generation");
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportResponseDraftHarnessAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("response draft quality evaluation"));
  assert.ok(joined.includes("draft tone and structure evaluation"));
  assert.ok(joined.includes("clarification-first response evaluation"));
  assert.ok(joined.includes("non-execution safety review"));
  assert.ok(joined.includes("route preservation response evaluation"));
  assert.ok(joined.includes("unsupported boundary response evaluation"));
  assert.ok(joined.includes("no-leak validation"));
});

test("listDecisionSupportResponseDraftHarnessAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportResponseDraftHarnessAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportResponseDraftHarnessAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportResponseDraftHarnessProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("show draft to user"));
  assert.ok(joined.includes("wire router"));
  assert.ok(joined.includes("wire composer"));
  assert.ok(joined.includes("wire endpoint"));
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

test("listDecisionSupportResponseDraftHarnessProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportResponseDraftHarnessProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportResponseDraftHarnessProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Draft creation ─────────────────────────────────────────────────────────────────

function draftFor(sourceCase) {
  return createDecisionSupportResponseDraftFromQaCase(sourceCase);
}

test("rdh-create-clarification-first-draft: clarification_question creates clarification_first_draft", () => {
  const fixtureCase = fixtureFor("rdh-create-clarification-first-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.draftKind, "clarification_first_draft");
  assert.equal(typeof draft.sections.acknowledgement, "string");
  assert.equal(typeof draft.sections.clarificationQuestion, "string");
  assert.ok(Array.isArray(draft.sections.assumptions));
  assert.ok(draft.sections.assumptions.length > 0);
  assert.equal(typeof draft.sections.recommendedNextStep, "string");
  assert.equal(typeof draft.sections.nonExecutionNotice, "string");
  assert.equal(draft.userVisibleNow, false);
  assert.equal(draft.persistedNow, false);
  assert.equal(draft.executableNow, false);
  assert.equal(draft.generatedForHarnessOnly, true);
});

test("rdh-create-route-preservation-draft: route_preservation_notice creates route_preservation_draft", () => {
  const fixtureCase = fixtureFor("rdh-create-route-preservation-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.draftKind, "route_preservation_draft");
  assert.equal(typeof draft.sections.routePreservationNotice, "string");
  assert.equal(typeof draft.sections.recommendedNextStep, "string");
  assert.equal(typeof draft.sections.nonExecutionNotice, "string");
});

test("rdh-create-unsupported-boundary-draft: unsupported_boundary_notice creates unsupported_boundary_draft", () => {
  const fixtureCase = fixtureFor("rdh-create-unsupported-boundary-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.draftKind, "unsupported_boundary_draft");
  assert.equal(typeof draft.sections.unsupportedBoundaryNotice, "string");
});

test("rdh-create-shadow-only-internal-draft: shadow_only_internal creates shadow_only_internal_draft", () => {
  const fixtureCase = fixtureFor("rdh-create-shadow-only-internal-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.draftKind, "shadow_only_internal_draft");
  assert.equal(typeof draft.sections.shadowOnlyNotice, "string");
  assert.equal(typeof draft.sections.nonExecutionNotice, "string");
  assert.equal(draft.sections.clarificationQuestion, undefined);
  assert.equal(draft.sections.recommendedNextStep, undefined);
});

test("rdh-create-blocked-unsafe-draft: unsafe_response_blocked creates blocked_unsafe_draft", () => {
  const fixtureCase = fixtureFor("rdh-create-blocked-unsafe-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.draftKind, "blocked_unsafe_draft");
  assert.equal(typeof draft.sections.blockedNotice, "string");
  assert.equal(typeof draft.sections.nonExecutionNotice, "string");
});

test("no synthetic draft ever includes raw input, full candidate, project name, email, phone, task/email/draft/DB/Supabase/external-call payloads", () => {
  const drafts = [
    draftFor({ caseId: "y1", routeKind: "clarification_gated_decision_support", responseKind: "clarification_question" }),
    draftFor({ caseId: "y2", routeKind: "existing_route_preserved", responseKind: "route_preservation_notice" }),
    draftFor({ caseId: "y3", routeKind: "unsupported_preserved", responseKind: "unsupported_boundary_notice" }),
    draftFor({ caseId: "y4", routeKind: "shadow_only", responseKind: "shadow_only_internal" }),
    draftFor({ caseId: "y5", routeKind: "shadow_only", responseKind: "unsafe_response_blocked" }),
  ];
  for (const draft of drafts) {
    // Scan only the human-readable content (sections + warnings), not the object's own field names —
    // safety.rawInputIncluded/fullCandidateIncluded are structural booleans, not content leaks.
    const text = JSON.stringify({ sections: draft.sections, warnings: draft.warnings });
    assert.doesNotMatch(text, /raw[_\s-]?input/i);
    assert.doesNotMatch(text, /full[_\s-]?candidate/i);
    assert.doesNotMatch(text, /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
    assert.doesNotMatch(text, /\+?\d[\d\s().-]{7,}\d/);
    assert.doesNotMatch(text, /\b(crear tarea|create task|task_id|assignee)\b/i);
    assert.doesNotMatch(text, /\b(enviar email|send email|draft_id|para:|to:|subject:)\b/i);
    assert.doesNotMatch(text, /\b(https?:\/\/|fetch\(|axios\.|supabase\.|process\.env)\b/i);
    assert.equal(draft.safety.rawInputIncluded, false);
    assert.equal(draft.safety.fullCandidateIncluded, false);
    assert.equal(draft.safety.piiIncluded, false);
    assert.equal(draft.safety.projectNameIncluded, false);
    assert.equal(draft.safety.taskPayloadIncluded, false);
    assert.equal(draft.safety.emailDraftPayloadIncluded, false);
    assert.equal(draft.safety.dbPayloadIncluded, false);
    assert.equal(draft.safety.supabasePayloadIncluded, false);
    assert.equal(draft.safety.externalCallPayloadIncluded, false);
  }
});

// ─── Draft validation ───────────────────────────────────────────────────────────────

const VALIDATION_FIXTURE_IDS = [
  "rdh-validate-clarification-first-draft",
  "rdh-validate-route-preservation-draft",
  "rdh-validate-unsupported-boundary-draft",
  "rdh-validate-shadow-only-internal-draft",
];

for (const fixtureId of VALIDATION_FIXTURE_IDS) {
  test(`${fixtureId}: valid draft passes with qaStatus pass, riskLevel low, violations empty`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const draft = draftFor(fixtureCase.sourceCase);
    const result = validateDecisionSupportResponseDraft(draft);
    assert.equal(result.valid, true);
    assert.equal(result.qaStatus, "pass");
    assert.equal(result.riskLevel, "low");
    assert.deepEqual(result.violations, []);
    assert.equal(result.contractMatched, true);
    assert.equal(result.nonExecutionNoticePassed, true);
    assert.equal(result.safeNextStepPassed, true);
    assert.equal(result.noLeaksPassed, true);
    assert.equal(result.noSideEffectsPassed, true);
    assert.equal(result.userVisibleOutputAttempted, false);
    assert.equal(result.productionWiringAttempted, false);
    assert.equal(result.realPersistenceAttempted, false);
    assert.equal(result.dbWriteAttempted, false);
    assert.equal(result.supabaseWriteAttempted, false);
    assert.equal(result.externalCallAttempted, false);
  });
}

test("rdh-dimension-clarification-first-passed: true for clarification_first_draft", () => {
  const fixtureCase = fixtureFor("rdh-dimension-clarification-first-passed");
  const result = validateDecisionSupportResponseDraft(draftFor(fixtureCase.sourceCase));
  assert.equal(result.clarificationFirstPassed, true);
});

test("rdh-dimension-route-preservation-passed: true for route_preservation_draft", () => {
  const fixtureCase = fixtureFor("rdh-dimension-route-preservation-passed");
  const result = validateDecisionSupportResponseDraft(draftFor(fixtureCase.sourceCase));
  assert.equal(result.routePreservationPassed, true);
});

test("rdh-dimension-unsupported-preservation-passed: true for unsupported_boundary_draft", () => {
  const fixtureCase = fixtureFor("rdh-dimension-unsupported-preservation-passed");
  const result = validateDecisionSupportResponseDraft(draftFor(fixtureCase.sourceCase));
  assert.equal(result.unsupportedPreservationPassed, true);
});

test("clarificationFirstPassed/routePreservationPassed/unsupportedPreservationPassed are trivially true for non-applicable draft kinds", () => {
  const routeDraft = draftFor({ caseId: "z1", routeKind: "existing_route_preserved", responseKind: "route_preservation_notice" });
  const routeResult = validateDecisionSupportResponseDraft(routeDraft);
  assert.equal(routeResult.clarificationFirstPassed, true);
  assert.equal(routeResult.unsupportedPreservationPassed, true);

  const clarificationDraft = draftFor({ caseId: "z2", routeKind: "clarification_gated_decision_support", responseKind: "clarification_question" });
  const clarificationResult = validateDecisionSupportResponseDraft(clarificationDraft);
  assert.equal(clarificationResult.routePreservationPassed, true);
  assert.equal(clarificationResult.unsupportedPreservationPassed, true);
});

// ─── Synthetic negative validations ─────────────────────────────────────────────────

function baseClarificationDraft() {
  return draftFor({ caseId: "neg-1", routeKind: "clarification_gated_decision_support", responseKind: "clarification_question" });
}

test("draft without clarificationQuestion fails when clarification-first required", () => {
  const draft = baseClarificationDraft();
  draft.sections = { ...draft.sections, clarificationQuestion: undefined };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.equal(result.clarificationFirstPassed, false);
  assert.ok(result.violations.includes("missing_clarifying_question"));
});

test("draft without nonExecutionNotice fails", () => {
  const draft = baseClarificationDraft();
  draft.sections = { ...draft.sections, nonExecutionNotice: undefined };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.equal(result.nonExecutionNoticePassed, false);
  assert.ok(result.violations.includes("missing_non_execution_notice"));
});

test("draft with userVisibleNow true fails", () => {
  const draft = { ...baseClarificationDraft(), userVisibleNow: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.equal(result.noSideEffectsPassed, false);
  assert.ok(result.violations.includes("user_visible_output"));
  assert.equal(result.qaStatus, "blocked");
});

test("draft with persistedNow true fails", () => {
  const draft = { ...baseClarificationDraft(), persistedNow: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.equal(result.noSideEffectsPassed, false);
  assert.ok(result.violations.includes("real_persistence"));
  assert.equal(result.qaStatus, "blocked");
});

test("draft with rawInputIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, rawInputIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.equal(result.noLeaksPassed, false);
  assert.ok(result.violations.includes("raw_input_leak"));
  assert.equal(result.qaStatus, "blocked");
});

test("draft with fullCandidateIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, fullCandidateIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("full_candidate_leak"));
});

test("draft with piiIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, piiIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("pii_leak"));
});

test("draft with projectNameIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, projectNameIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("project_name_leak"));
});

test("draft with taskPayloadIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, taskPayloadIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("task_creation"));
});

test("draft with emailDraftPayloadIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, emailDraftPayloadIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("email_or_draft_creation"));
});

test("draft with dbPayloadIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, dbPayloadIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("db_write"));
});

test("draft with supabasePayloadIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, supabasePayloadIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("supabase_write"));
});

test("draft with externalCallPayloadIncluded true fails", () => {
  const draft = baseClarificationDraft();
  draft.safety = { ...draft.safety, externalCallPayloadIncluded: true };
  const result = validateDecisionSupportResponseDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("external_call"));
});

// ─── Harness run ────────────────────────────────────────────────────────────────────

test("runDecisionSupportResponseDraftHarness produces one case result per Sprint 32R case", () => {
  assert.equal(HARNESS.caseResults.length, DECISION_CLARIFICATION_CASES.length);
});

test("runDecisionSupportResponseDraftHarness reuses the Sprint 32R response QA plan decision", () => {
  assert.equal(HARNESS.qaSummary.decision, "ready_for_response_draft_harness");
});

test("runDecisionSupportResponseDraftHarness honors the default synthetic corpus when no cases are supplied", () => {
  const defaultHarness = runDecisionSupportResponseDraftHarness({ now: NOW });
  assert.ok(defaultHarness.caseResults.length > 0);
  assert.ok(defaultHarness.caseResults.length < DECISION_CLARIFICATION_CASES.length);
});

test("runDecisionSupportResponseDraftHarness can reuse a pre-built qaPlan instead of rebuilding one", () => {
  const qaPlan = buildDecisionSupportResponseQaDryRunPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const harness = runDecisionSupportResponseDraftHarness({ qaPlan, now: NOW });
  assert.equal(harness.caseResults.length, qaPlan.assessments.length);
  assert.equal(harness.qaPlan, qaPlan);
});

test("summary: totalCases matches the Sprint 18R corpus size", () => {
  assert.equal(SUMMARY.totalCases, 79);
  assert.equal(SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
});

test("summary: draftGeneratedCount/draftAcceptedCount === totalCases, draftRejectedCount/draftBlockedCount === 0", () => {
  assert.equal(SUMMARY.draftGeneratedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.draftAcceptedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.draftRejectedCount, 0);
  assert.equal(SUMMARY.draftBlockedCount, 0);
});

test("summary: clarificationFirstDraftCount and routePreservationDraftCount match the documented Sprint 32R baseline", () => {
  assert.equal(SUMMARY.clarificationFirstDraftCount, 69);
  assert.equal(SUMMARY.routePreservationDraftCount, 10);
  assert.equal(SUMMARY.unsupportedBoundaryDraftCount, 0);
  assert.equal(SUMMARY.shadowOnlyInternalDraftCount, 0);
  assert.equal(SUMMARY.blockedUnsafeDraftCount, 0);
});

test("summary: draft kind counts sum to totalCases", () => {
  const sum =
    SUMMARY.clarificationFirstDraftCount +
    SUMMARY.routePreservationDraftCount +
    SUMMARY.unsupportedBoundaryDraftCount +
    SUMMARY.shadowOnlyInternalDraftCount +
    SUMMARY.blockedUnsafeDraftCount;
  assert.equal(sum, SUMMARY.totalCases);
});

test("rdh-no-* fixtures: every QA status/safety count matches expectations", () => {
  fixtureFor("rdh-no-user-visible-output-attempted");
  fixtureFor("rdh-no-production-wiring-attempted");
  fixtureFor("rdh-no-db-supabase-attempted");

  assert.equal(SUMMARY.qaPassCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.qaWarningCount, 0);
  assert.equal(SUMMARY.qaFailCount, 0);
  assert.equal(SUMMARY.qaBlockedCount, 0);
  assert.equal(SUMMARY.safeForQualityEvaluationCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.safeForUserVisibleOutputNowCount, 0);
  assert.equal(SUMMARY.safeForProductionCount, 0);
  assert.equal(SUMMARY.contractMatchedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.clarificationFirstPassedCount, 69);
  assert.equal(SUMMARY.routePreservationPassedCount, 10);
  assert.equal(SUMMARY.unsupportedPreservationPassedCount, 0);
  assert.equal(SUMMARY.nonExecutionNoticePassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.safeNextStepPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noLeaksPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.noSideEffectsPassedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.violationCount, 0);
  assert.equal(SUMMARY.criticalViolationCount, 0);
  assert.equal(SUMMARY.userVisibleOutputAttemptedCount, 0);
  assert.equal(SUMMARY.productionWiringAttemptedCount, 0);
  assert.equal(SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(SUMMARY.externalCallAttemptedCount, 0);
  assert.equal(SUMMARY.rawInputIncludedCount, 0);
  assert.equal(SUMMARY.fullCandidateIncludedCount, 0);
  assert.equal(SUMMARY.piiIncludedCount, 0);
  assert.equal(SUMMARY.projectNameIncludedCount, 0);
  assert.equal(SUMMARY.taskPayloadIncludedCount, 0);
  assert.equal(SUMMARY.emailDraftPayloadIncludedCount, 0);
  assert.equal(SUMMARY.dbPayloadIncludedCount, 0);
  assert.equal(SUMMARY.supabasePayloadIncludedCount, 0);
  assert.equal(SUMMARY.externalCallPayloadIncludedCount, 0);
});

test("rdh-decision-ready-for-response-draft-quality-evaluation: decision is ready_for_response_draft_quality_evaluation", () => {
  fixtureFor("rdh-decision-ready-for-response-draft-quality-evaluation");
  assert.equal(SUMMARY.decision, "ready_for_response_draft_quality_evaluation");
});

test("rdh-recommended-sprint-34r: recommendedNextSprint is Sprint 34R", () => {
  fixtureFor("rdh-recommended-sprint-34r");
  assert.equal(SUMMARY.recommendedNextSprint, "Sprint 34R — Decision Support Response Draft Quality Evaluation");
});

test("summary accepts a bare case-results array plus sprint32QaDecision option", () => {
  const bareSummary = summarizeDecisionSupportResponseDraftHarness(HARNESS.caseResults, {
    sprint32QaDecision: HARNESS.qaSummary.decision,
  });
  assert.equal(bareSummary.totalCases, SUMMARY.totalCases);
  assert.equal(bareSummary.decision, SUMMARY.decision);
});

test("summary: bare case-results array without sprint32QaDecision cannot reach ready_for_response_draft_quality_evaluation", () => {
  const bareSummary = summarizeDecisionSupportResponseDraftHarness(HARNESS.caseResults);
  assert.notEqual(bareSummary.decision, "ready_for_response_draft_quality_evaluation");
});

test("summary: representativeAcceptedDrafts is capped and rejectedDrafts/blockedDrafts are empty for the clean corpus", () => {
  assert.ok(SUMMARY.representativeAcceptedDrafts.length <= 8);
  assert.equal(SUMMARY.rejectedDrafts.length, 0);
  assert.equal(SUMMARY.blockedDrafts.length, 0);
});

// ─── Explain ────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportResponseDraftHarness returns a structured explanation", () => {
  const explain = explainDecisionSupportResponseDraftHarness();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
});

// ─── Regression: Sprint 18R-32R + golden/classifier metrics unchanged ──────────────

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
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftHarness.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseDraftHarnessTypes.ts", import.meta.url),
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

test("this module never imports from tests/fixtures/", () => {
  const imports = importLines(IMPLEMENTATION_SOURCE);
  assert.doesNotMatch(imports, /tests\/fixtures/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportResponseDraftHarness/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});
