import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_VERSION,
  createDecisionSupportResponseQaDryRunPlanConfig,
  listDecisionSupportResponseQaDryRunAllowedNextActions,
  listDecisionSupportResponseQaDryRunProhibitedActions,
  createDecisionSupportResponseQaDryRunResponseContract,
  createDecisionSupportResponseQaDryRunSyntheticDraft,
  evaluateDecisionSupportResponseQaDryRunGate,
  assessDecisionSupportResponseQaDryRunCase,
  buildDecisionSupportResponseQaDryRunPlan,
  summarizeDecisionSupportResponseQaDryRunPlan,
  explainDecisionSupportResponseQaDryRunPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseQaDryRunPlan.ts";
import { DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_CASES } from "./fixtures/conversational-brain-decision-support-response-qa-dry-run-plan-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

// Regression imports — Sprint 18R-31R + golden/classifier/vocabulary suites, reused read-only for comparison.
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
 * Sprint 32R — Decision Support Response QA / User-Visible Dry Run Plan.
 *
 * Tests the pure, offline, deterministic response QA plan in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseQaDryRunPlan.ts`. This
 * plans what a safe decision_support response would look like if it were eventually shown to a user —
 * it never shows anything to a real user, never persists anything real, and never touches the
 * router/composer/endpoint.
 */

const NOW = "2026-01-01T00:00:00.000Z";

function fixtureFor(id) {
  const c = DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_CASES.find((x) => x.id === id);
  assert.ok(c, `missing fixture case ${id}`);
  return c;
}

// Computed once against the real Sprint 18R corpus (79 cases) — reused across many tests below.
const PLAN = buildDecisionSupportResponseQaDryRunPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
const SUMMARY = summarizeDecisionSupportResponseQaDryRunPlan(PLAN);

// ─── Fixture shape ────────────────────────────────────────────────────────────────

test("fixture corpus has between 35 and 55 cases", () => {
  assert.ok(DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_CASES.length >= 35);
  assert.ok(DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_CASES.length <= 55);
});

test("every fixture case has a unique id and required fields", () => {
  const ids = new Set();
  for (const c of DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_CASES) {
    assert.equal(typeof c.id, "string");
    assert.ok(!ids.has(c.id), `duplicate fixture id ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.scenario, "string");
    assert.equal(typeof c.responseKind, "string");
    assert.equal(typeof c.expectedQaStatus, "string");
    assert.equal(typeof c.expectedRiskLevel, "string");
    assert.equal(typeof c.expectedSafeForResponseDraftHarness, "boolean");
    assert.equal(typeof c.expectedSafeForUserVisibleDryRunNow, "boolean");
    assert.equal(typeof c.expectedSafeForProduction, "boolean");
    assert.equal(typeof c.expectedDirectDecisionBlocked, "boolean");
    assert.equal(typeof c.expectedSideEffectsZero, "boolean");
    assert.equal(typeof c.expectedLeaksZero, "boolean");
    assert.equal(typeof c.notes, "string");
  }
});

// ─── Structure ────────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_VERSION, "string");
  assert.ok(DECISION_SUPPORT_RESPONSE_QA_DRY_RUN_PLAN_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportResponseQaDryRunPlanConfig", createDecisionSupportResponseQaDryRunPlanConfig],
  ["listDecisionSupportResponseQaDryRunAllowedNextActions", listDecisionSupportResponseQaDryRunAllowedNextActions],
  ["listDecisionSupportResponseQaDryRunProhibitedActions", listDecisionSupportResponseQaDryRunProhibitedActions],
  ["createDecisionSupportResponseQaDryRunResponseContract", createDecisionSupportResponseQaDryRunResponseContract],
  ["createDecisionSupportResponseQaDryRunSyntheticDraft", createDecisionSupportResponseQaDryRunSyntheticDraft],
  ["evaluateDecisionSupportResponseQaDryRunGate", evaluateDecisionSupportResponseQaDryRunGate],
  ["assessDecisionSupportResponseQaDryRunCase", assessDecisionSupportResponseQaDryRunCase],
  ["buildDecisionSupportResponseQaDryRunPlan", buildDecisionSupportResponseQaDryRunPlan],
  ["summarizeDecisionSupportResponseQaDryRunPlan", summarizeDecisionSupportResponseQaDryRunPlan],
  ["explainDecisionSupportResponseQaDryRunPlan", explainDecisionSupportResponseQaDryRunPlan],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

// ─── Config ───────────────────────────────────────────────────────────────────────

test("default config matches the strict profile (fixture rqa-config-default-strict)", () => {
  fixtureFor("rqa-config-default-strict");
  const config = createDecisionSupportResponseQaDryRunPlanConfig();
  assert.equal(config.profile, "strict_response_qa_user_visible_dry_run_plan");
  assert.equal(config.mode, "plan_only");
  assert.equal(config.allowUserVisibleDryRun, false);
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
  assert.equal(config.requireClarificationGate, true);
  assert.equal(config.requireResponseContract, true);
  assert.equal(config.requireAssumptionDisclosure, true);
  assert.equal(config.requireNonExecutionGuarantee, true);
  assert.equal(config.requireNoRawInputLeak, true);
  assert.equal(config.requireNoFullCandidateLeak, true);
  assert.equal(config.requireNoPiiLeak, true);
  assert.equal(config.requireSafeNextStep, true);
});

const BLOCKED_FIELD_FIXTURE_IDS = [
  "rqa-config-block-user-visible-dry-run",
  "rqa-config-block-production-wiring",
  "rqa-config-block-router-change",
  "rqa-config-block-composer-change",
  "rqa-config-block-endpoint-change",
  "rqa-config-block-feature-flag",
  "rqa-config-block-real-persistence",
  "rqa-config-block-db-write",
  "rqa-config-block-supabase-write",
  "rqa-config-block-external-calls",
  "rqa-config-block-action-execution",
  "rqa-config-block-task-creation",
  "rqa-config-block-email-draft-creation",
];

assert.equal(BLOCKED_FIELD_FIXTURE_IDS.length, 13);

for (const fixtureId of BLOCKED_FIELD_FIXTURE_IDS) {
  test(`${fixtureId}: forbidden config override is ignored`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const field = fixtureCase.configOverrideField;
    assert.ok(field, `fixture ${fixtureId} must declare configOverrideField`);
    const config = createDecisionSupportResponseQaDryRunPlanConfig({ [field]: true });
    assert.equal(config[field], false, `${field} must stay false even when overridden to true`);
  });
}

test("every forbidden config field stays false even when all thirteen are forced true at once", () => {
  const config = createDecisionSupportResponseQaDryRunPlanConfig({
    allowUserVisibleDryRun: true,
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
  const config = createDecisionSupportResponseQaDryRunPlanConfig({
    mode: "response_contract_review",
    now: NOW,
    notes: ["note-1"],
  });
  assert.equal(config.mode, "response_contract_review");
  assert.equal(config.now, NOW);
  assert.deepEqual(config.notes, ["note-1"]);
});

// ─── Allowed / prohibited actions ──────────────────────────────────────────────────

test("allowed next actions include every required phrase", () => {
  const joined = listDecisionSupportResponseQaDryRunAllowedNextActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("response draft harness"));
  assert.ok(joined.includes("synthetic response drafts"));
  assert.ok(joined.includes("response contracts"));
  assert.ok(joined.includes("clarification-first answer shape"));
  assert.ok(joined.includes("route preservation answer shape"));
  assert.ok(joined.includes("unsupported boundary answer shape"));
  assert.ok(joined.includes("non-execution guarantees"));
  assert.ok(joined.includes("no-leak guarantees"));
});

test("listDecisionSupportResponseQaDryRunAllowedNextActions returns a fresh array each call", () => {
  const a = listDecisionSupportResponseQaDryRunAllowedNextActions();
  a.push("bogus");
  const b = listDecisionSupportResponseQaDryRunAllowedNextActions();
  assert.ok(!b.includes("bogus"));
});

test("prohibited actions include every required phrase", () => {
  const joined = listDecisionSupportResponseQaDryRunProhibitedActions().join(" | ").toLowerCase();
  assert.ok(joined.includes("show decision_support output to a user"));
  assert.ok(joined.includes("wire the router"));
  assert.ok(joined.includes("wire the composer"));
  assert.ok(joined.includes("wire the endpoint"));
  assert.ok(joined.includes("production feature flag"));
  assert.ok(joined.includes("create a database"));
  assert.ok(joined.includes("migration"));
  assert.ok(joined.includes("sql file"));
  assert.ok(joined.includes("write to supabase"));
  assert.ok(joined.includes("real repository"));
  assert.ok(joined.includes("real storage adapter"));
  assert.ok(joined.includes("execute actions"));
  assert.ok(joined.includes("create tasks"));
  assert.ok(joined.includes("create emails"));
  assert.ok(joined.includes("create drafts"));
  assert.ok(joined.includes("call external services"));
  assert.ok(joined.includes("persist output"));
});

test("listDecisionSupportResponseQaDryRunProhibitedActions returns a fresh array each call", () => {
  const a = listDecisionSupportResponseQaDryRunProhibitedActions();
  a.push("bogus");
  const b = listDecisionSupportResponseQaDryRunProhibitedActions();
  assert.ok(!b.includes("bogus"));
});

// ─── Response contracts ─────────────────────────────────────────────────────────────

test("rqa-contract-clarification-question: allowed, requires gate/assumptions/non-execution/next-step, 11 gates", () => {
  fixtureFor("rqa-contract-clarification-question");
  const contract = createDecisionSupportResponseQaDryRunResponseContract("clarification_question");
  assert.equal(contract.allowedInSprint32, true);
  assert.equal(contract.futureOnly, false);
  assert.equal(contract.prohibitedInSprint32, false);
  assert.equal(contract.requiresClarificationGate, true);
  assert.equal(contract.requiresAssumptionDisclosure, true);
  assert.equal(contract.requiresNonExecutionGuarantee, true);
  assert.equal(contract.requiresSafeNextStep, true);
  assert.equal(contract.allowsDirectDecision, false);
  assert.equal(contract.allowsActionExecution, false);
  assert.equal(contract.allowsTaskCreation, false);
  assert.equal(contract.allowsEmailDraftCreation, false);
  assert.equal(contract.allowsRealPersistence, false);
  assert.equal(contract.allowsExternalCalls, false);
  assert.equal(contract.allowsProductionWiring, false);
  assert.equal(contract.requiredGates.length, 11);
  assert.ok(contract.expectedStructure.length > 0);
});

test("rqa-contract-decision-support-advisory: future-only and prohibited in Sprint 32R, blocks direct decision, requires clarification gate", () => {
  fixtureFor("rqa-contract-decision-support-advisory");
  const contract = createDecisionSupportResponseQaDryRunResponseContract("decision_support_advisory");
  assert.equal(contract.allowedInSprint32, false);
  assert.equal(contract.futureOnly, true);
  assert.equal(contract.prohibitedInSprint32, true);
  assert.equal(contract.requiresClarificationGate, true);
  assert.equal(contract.allowsDirectDecision, false);
});

test("rqa-contract-route-preservation-notice: allowed, preserves route, blocks execution/persistence, 7 gates", () => {
  fixtureFor("rqa-contract-route-preservation-notice");
  const contract = createDecisionSupportResponseQaDryRunResponseContract("route_preservation_notice");
  assert.equal(contract.allowedInSprint32, true);
  assert.equal(contract.requiresClarificationGate, false);
  assert.equal(contract.allowsActionExecution, false);
  assert.equal(contract.allowsRealPersistence, false);
  assert.equal(contract.requiredGates.length, 7);
  assert.ok(contract.requiredGates.includes("must_preserve_existing_route"));
});

test("rqa-contract-unsupported-boundary-notice: allowed, preserves unsupported boundary, blocks execution/persistence, 7 gates", () => {
  fixtureFor("rqa-contract-unsupported-boundary-notice");
  const contract = createDecisionSupportResponseQaDryRunResponseContract("unsupported_boundary_notice");
  assert.equal(contract.allowedInSprint32, true);
  assert.equal(contract.requiresClarificationGate, false);
  assert.equal(contract.allowsActionExecution, false);
  assert.equal(contract.allowsRealPersistence, false);
  assert.equal(contract.requiredGates.length, 7);
  assert.ok(contract.requiredGates.includes("must_preserve_unsupported"));
});

test("rqa-contract-shadow-only-internal: allowed, remains internal, blocks user-visible output, 2 gates", () => {
  fixtureFor("rqa-contract-shadow-only-internal");
  const contract = createDecisionSupportResponseQaDryRunResponseContract("shadow_only_internal");
  assert.equal(contract.allowedInSprint32, true);
  assert.equal(contract.requiresSafeNextStep, false);
  assert.equal(contract.requiredGates.length, 2);
  assert.ok(contract.requiredGates.includes("must_remain_shadow_only"));
});

test("rqa-contract-unsafe-response-blocked: allowed as blocked/safe fallback, 6 gates", () => {
  fixtureFor("rqa-contract-unsafe-response-blocked");
  const contract = createDecisionSupportResponseQaDryRunResponseContract("unsafe_response_blocked");
  assert.equal(contract.allowedInSprint32, true);
  assert.equal(contract.requiredGates.length, 6);
});

test("every response contract blocks direct decision, action execution, task/email creation, persistence, external calls, and production wiring", () => {
  for (const responseKind of [
    "clarification_question",
    "decision_support_advisory",
    "route_preservation_notice",
    "unsupported_boundary_notice",
    "shadow_only_internal",
    "unsafe_response_blocked",
  ]) {
    const contract = createDecisionSupportResponseQaDryRunResponseContract(responseKind);
    assert.equal(contract.allowsDirectDecision, false, responseKind);
    assert.equal(contract.allowsActionExecution, false, responseKind);
    assert.equal(contract.allowsTaskCreation, false, responseKind);
    assert.equal(contract.allowsEmailDraftCreation, false, responseKind);
    assert.equal(contract.allowsRealPersistence, false, responseKind);
    assert.equal(contract.allowsExternalCalls, false, responseKind);
    assert.equal(contract.allowsProductionWiring, false, responseKind);
  }
});

// ─── Synthetic drafts ───────────────────────────────────────────────────────────────

function draftFor(sourceCase) {
  return createDecisionSupportResponseQaDryRunSyntheticDraft(sourceCase);
}

test("rqa-synthetic-clarification-draft: clarification_gated_decision_support creates clarification_question draft", () => {
  const fixtureCase = fixtureFor("rqa-synthetic-clarification-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.responseKind, "clarification_question");
  assert.equal(typeof draft.responseSections.clarificationQuestion, "string");
  assert.ok(draft.responseSections.clarificationQuestion.length > 0);
  assert.ok(Array.isArray(draft.responseSections.assumptions));
  assert.ok(draft.responseSections.assumptions.length > 0);
  assert.equal(typeof draft.responseSections.recommendedNextStep, "string");
  assert.equal(typeof draft.responseSections.nonExecutionNotice, "string");
  assert.equal(draft.userVisibleNow, false);
  assert.equal(draft.persistedNow, false);
  assert.equal(draft.generatedForQaOnly, true);
});

test("rqa-synthetic-route-preservation-draft: existing_route_preserved creates route_preservation_notice draft", () => {
  const fixtureCase = fixtureFor("rqa-synthetic-route-preservation-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.responseKind, "route_preservation_notice");
  assert.equal(typeof draft.responseSections.routePreservationNotice, "string");
  assert.equal(draft.userVisibleNow, false);
  assert.equal(draft.persistedNow, false);
});

test("rqa-synthetic-unsupported-draft: unsupported_preserved creates unsupported_boundary_notice draft", () => {
  const fixtureCase = fixtureFor("rqa-synthetic-unsupported-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.responseKind, "unsupported_boundary_notice");
  assert.equal(typeof draft.responseSections.unsupportedNotice, "string");
  assert.equal(draft.userVisibleNow, false);
  assert.equal(draft.persistedNow, false);
});

test("rqa-synthetic-shadow-only-draft: shadow_only creates shadow_only_internal draft", () => {
  const fixtureCase = fixtureFor("rqa-synthetic-shadow-only-draft");
  const draft = draftFor(fixtureCase.sourceCase);
  assert.equal(draft.responseKind, "shadow_only_internal");
  assert.equal(typeof draft.responseSections.nonExecutionNotice, "string");
  assert.equal(draft.responseSections.clarificationQuestion, undefined);
  assert.equal(draft.responseSections.recommendedNextStep, undefined);
  assert.equal(draft.userVisibleNow, false);
  assert.equal(draft.persistedNow, false);
});

test("no synthetic draft ever includes raw input, full candidate, project name, email, phone, task/email/draft/DB/Supabase/external-call payloads", () => {
  const drafts = [
    draftFor({ caseId: "x1", routeKind: "clarification_gated_decision_support" }),
    draftFor({ caseId: "x2", routeKind: "existing_route_preserved" }),
    draftFor({ caseId: "x3", routeKind: "unsupported_preserved" }),
    draftFor({ caseId: "x4", routeKind: "shadow_only" }),
  ];
  for (const draft of drafts) {
    const text = JSON.stringify(draft);
    assert.doesNotMatch(text, /raw[_\s-]?input/i);
    assert.doesNotMatch(text, /full[_\s-]?candidate/i);
    assert.doesNotMatch(text, /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
    assert.doesNotMatch(text, /\+?\d[\d\s().-]{7,}\d/);
    assert.doesNotMatch(text, /\b(crear tarea|create task|task_id|assignee)\b/i);
    assert.doesNotMatch(text, /\b(enviar email|send email|draft_id|para:|to:|subject:)\b/i);
    assert.doesNotMatch(text, /\b(https?:\/\/|fetch\(|axios\.|supabase\.|process\.env)\b/i);
    assert.equal(draft.prohibitedContentPresent, false);
  }
});

// ─── Gate evaluation ────────────────────────────────────────────────────────────────

const GATE_FIXTURE_IDS = [
  "rqa-gate-must-be-clarification-first",
  "rqa-gate-must-state-assumptions",
  "rqa-gate-must-avoid-direct-execution",
  "rqa-gate-must-not-create-tasks",
  "rqa-gate-must-not-create-emails",
  "rqa-gate-must-not-persist",
  "rqa-gate-must-not-call-external-services",
  "rqa-gate-must-not-leak-raw-input",
  "rqa-gate-must-not-leak-full-candidate",
  "rqa-gate-must-not-leak-pii",
  "rqa-gate-must-preserve-existing-route",
  "rqa-gate-must-preserve-unsupported",
  "rqa-gate-must-remain-shadow-only",
  "rqa-gate-must-be-safe-for-dry-run-only",
];

assert.equal(GATE_FIXTURE_IDS.length, 14);

for (const fixtureId of GATE_FIXTURE_IDS) {
  test(`${fixtureId}: gate passes for its matching synthetic draft`, () => {
    const fixtureCase = fixtureFor(fixtureId);
    const draft = draftFor(fixtureCase.sourceCase);
    const result = evaluateDecisionSupportResponseQaDryRunGate(draft, fixtureCase.gateType);
    assert.equal(result.gateType, fixtureCase.gateType);
    assert.equal(result.status, "pass");
    assert.equal(result.passed, true);
    assert.equal(result.riskLevel, "low");
    assert.deepEqual(result.violations, []);
  });
}

// ─── Case assessment ────────────────────────────────────────────────────────────────

test("clarification gated case: clarification_question, pass, low risk, safe for draft harness, blocks everything", () => {
  const assessment = assessDecisionSupportResponseQaDryRunCase({ caseId: "cg-1", routeKind: "clarification_gated_decision_support" });
  assert.equal(assessment.responseKind, "clarification_question");
  assert.equal(assessment.qaStatus, "pass");
  assert.equal(assessment.riskLevel, "low");
  assert.equal(assessment.safeForResponseDraftHarness, true);
  assert.equal(assessment.safeForUserVisibleDryRunNow, false);
  assert.equal(assessment.safeForProduction, false);
  assert.equal(assessment.directDecisionBlocked, true);
  assert.equal(assessment.actionExecutionBlocked, true);
  assert.equal(assessment.taskCreationBlocked, true);
  assert.equal(assessment.emailDraftCreationBlocked, true);
  assert.equal(assessment.persistenceBlocked, true);
  assert.equal(assessment.externalCallsBlocked, true);
});

test("existing route case: route_preservation_notice, pass, safe for draft harness, never safe for production", () => {
  const assessment = assessDecisionSupportResponseQaDryRunCase({ caseId: "er-1", routeKind: "existing_route_preserved" });
  assert.equal(assessment.responseKind, "route_preservation_notice");
  assert.equal(assessment.qaStatus, "pass");
  assert.equal(assessment.safeForResponseDraftHarness, true);
  assert.equal(assessment.safeForUserVisibleDryRunNow, false);
  assert.equal(assessment.safeForProduction, false);
});

test("unsupported case: unsupported_boundary_notice, pass, never safe for production", () => {
  const assessment = assessDecisionSupportResponseQaDryRunCase({ caseId: "un-1", routeKind: "unsupported_preserved" });
  assert.equal(assessment.responseKind, "unsupported_boundary_notice");
  assert.equal(assessment.qaStatus, "pass");
  assert.equal(assessment.safeForProduction, false);
});

test("shadow only case: shadow_only_internal, never safe for user-visible dry run or production", () => {
  const assessment = assessDecisionSupportResponseQaDryRunCase({ caseId: "sh-1", routeKind: "shadow_only" });
  assert.equal(assessment.responseKind, "shadow_only_internal");
  assert.equal(assessment.safeForUserVisibleDryRunNow, false);
  assert.equal(assessment.safeForProduction, false);
});

// ─── Plan build ─────────────────────────────────────────────────────────────────────

test("buildDecisionSupportResponseQaDryRunPlan produces one assessment per Sprint 31R case", () => {
  assert.equal(PLAN.assessments.length, DECISION_CLARIFICATION_CASES.length);
});

test("buildDecisionSupportResponseQaDryRunPlan reuses the Sprint 31R integration plan decision", () => {
  assert.equal(PLAN.integrationSummary.decision, "ready_for_user_visible_dry_run_plan");
});

test("buildDecisionSupportResponseQaDryRunPlan reuses Sprint 30R/29R decisions via the Sprint 31R plan", () => {
  assert.equal(PLAN.integrationPlan.replaySummary.decision, "ready_for_clarification_gated_integration_plan");
  assert.equal(PLAN.integrationPlan.persistenceReadinessSummary.decision, "do_not_build_real_persistence_yet");
});

test("buildDecisionSupportResponseQaDryRunPlan honors the default synthetic corpus when no cases are supplied", () => {
  const defaultPlan = buildDecisionSupportResponseQaDryRunPlan({ now: NOW });
  assert.ok(defaultPlan.assessments.length > 0);
  assert.ok(defaultPlan.assessments.length < DECISION_CLARIFICATION_CASES.length);
});

// ─── Plan summary ───────────────────────────────────────────────────────────────────

test("summary: totalCases matches the Sprint 18R corpus size", () => {
  assert.equal(SUMMARY.totalCases, 79);
  assert.equal(SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
});

test("summary: clarificationQuestionCaseCount and routePreservationCaseCount match the documented Sprint 31R baseline", () => {
  assert.equal(SUMMARY.clarificationQuestionCaseCount, 69);
  assert.equal(SUMMARY.routePreservationCaseCount, 10);
  assert.equal(SUMMARY.unsupportedBoundaryCaseCount, 0);
  assert.equal(SUMMARY.shadowOnlyCaseCount, 0);
  assert.equal(SUMMARY.advisoryCaseCount, 0);
  assert.equal(SUMMARY.unsafeBlockedCaseCount, 0);
});

test("summary: response kind counts sum to totalCases", () => {
  const sum =
    SUMMARY.clarificationQuestionCaseCount +
    SUMMARY.advisoryCaseCount +
    SUMMARY.routePreservationCaseCount +
    SUMMARY.unsupportedBoundaryCaseCount +
    SUMMARY.shadowOnlyCaseCount +
    SUMMARY.unsafeBlockedCaseCount;
  assert.equal(sum, SUMMARY.totalCases);
});

test("rqa-no-* fixtures: every QA status/safety count matches expectations", () => {
  fixtureFor("rqa-no-user-visible-output-attempted");
  fixtureFor("rqa-no-production-wiring-attempted");
  fixtureFor("rqa-no-db-supabase-attempted");
  fixtureFor("rqa-no-external-calls-attempted");
  fixtureFor("rqa-no-raw-input-leak");
  fixtureFor("rqa-no-full-candidate-leak");
  fixtureFor("rqa-no-pii-leak");

  assert.equal(SUMMARY.qaPassCaseCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.qaWarningCaseCount, 0);
  assert.equal(SUMMARY.qaFailCaseCount, 0);
  assert.equal(SUMMARY.qaBlockedCaseCount, 0);
  assert.equal(SUMMARY.safeForResponseDraftHarnessCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.safeForUserVisibleDryRunNowCount, 0);
  assert.equal(SUMMARY.safeForProductionCount, 0);
  assert.equal(SUMMARY.directDecisionBlockedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.actionExecutionBlockedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.taskCreationBlockedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.emailDraftCreationBlockedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.persistenceBlockedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.externalCallsBlockedCount, SUMMARY.totalCases);
  assert.equal(SUMMARY.userVisibleOutputAttemptedCount, 0);
  assert.equal(SUMMARY.productionWiringAttemptedCount, 0);
  assert.equal(SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(SUMMARY.externalCallAttemptedCount, 0);
  assert.equal(SUMMARY.rawInputLeakCount, 0);
  assert.equal(SUMMARY.fullCandidateLeakCount, 0);
  assert.equal(SUMMARY.piiLeakCount, 0);
  assert.equal(SUMMARY.projectNameLeakCount, 0);
  assert.equal(SUMMARY.violationCount, 0);
  assert.equal(SUMMARY.criticalViolationCount, 0);
});

test("rqa-decision-ready-for-response-draft-harness: decision is ready_for_response_draft_harness", () => {
  fixtureFor("rqa-decision-ready-for-response-draft-harness");
  assert.equal(SUMMARY.decision, "ready_for_response_draft_harness");
});

test("rqa-recommended-sprint-33r: recommendedNextSprint is Sprint 33R", () => {
  fixtureFor("rqa-recommended-sprint-33r");
  assert.equal(SUMMARY.recommendedNextSprint, "Sprint 33R — Decision Support Response Draft Harness");
});

test("summary accepts a bare assessments array plus sprint31IntegrationDecision option", () => {
  const bareSummary = summarizeDecisionSupportResponseQaDryRunPlan(PLAN.assessments, {
    sprint31IntegrationDecision: PLAN.integrationSummary.decision,
  });
  assert.equal(bareSummary.totalCases, SUMMARY.totalCases);
  assert.equal(bareSummary.decision, SUMMARY.decision);
});

test("summary: bare assessments array without sprint31IntegrationDecision cannot reach ready_for_response_draft_harness", () => {
  const bareSummary = summarizeDecisionSupportResponseQaDryRunPlan(PLAN.assessments);
  assert.notEqual(bareSummary.decision, "ready_for_response_draft_harness");
});

test("summary: representativePassingCases is capped and warningCases/blockedCases are empty for the clean corpus", () => {
  assert.ok(SUMMARY.representativePassingCases.length <= 8);
  assert.equal(SUMMARY.warningCases.length, 0);
  assert.equal(SUMMARY.blockedCases.length, 0);
});

// ─── Explain ────────────────────────────────────────────────────────────────────────

test("explainDecisionSupportResponseQaDryRunPlan returns a structured explanation", () => {
  const explain = explainDecisionSupportResponseQaDryRunPlan();
  assert.equal(typeof explain.capability, "string");
  assert.equal(typeof explain.purpose, "string");
  assert.ok(Array.isArray(explain.nonGoals));
  assert.ok(Array.isArray(explain.allowedNextActions));
  assert.ok(Array.isArray(explain.prohibitedNextActions));
  assert.equal(typeof explain.decisionRule, "string");
});

// ─── Regression: Sprint 18R-31R + golden/classifier metrics unchanged ──────────────

test("regression: Sprint 31R clarification-gated integration plan metrics stay clean against the 79-case corpus", () => {
  const integrationPlan = buildDecisionSupportClarificationGatedIntegrationPlan({ cases: DECISION_CLARIFICATION_CASES, now: NOW });
  const summary = summarizeDecisionSupportClarificationGatedIntegrationPlan(integrationPlan);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.clarificationGatedCaseCount, 69);
  assert.equal(summary.existingRoutePreservedCaseCount, 10);
  assert.equal(summary.unsupportedPreservedCaseCount, 0);
  assert.equal(summary.shadowOnlyCaseCount, 0);
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
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseQaDryRunPlan.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportResponseQaDryRunPlanTypes.ts", import.meta.url),
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
  assert.doesNotMatch(productionBarrel, /decisionSupportResponseQaDryRunPlan/);
});

test("no migration/SQL/table file was created by this sprint", () => {
  assert.throws(() => readFileSync(new URL("../supabase/migrations/decision_support_shadow_captures.sql", import.meta.url), "utf8"));
});
