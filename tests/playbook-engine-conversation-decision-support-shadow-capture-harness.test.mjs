import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createDecisionSupportShadowCapturePolicy,
  sanitizeDecisionSupportShadowInput,
  createDecisionSupportShadowInputHash,
  summarizeDecisionSupportShadowCandidate,
  createDecisionSupportShadowCaptureRecord,
  createInMemoryDecisionSupportShadowCaptureSink,
  captureDecisionSupportShadowRun,
  runDecisionSupportShadowCaptureHarnessEvaluation,
  summarizeDecisionSupportShadowCaptureHarnessEvaluation,
  explainDecisionSupportShadowCaptureHarness,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";
import { DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES } from "./fixtures/conversational-brain-decision-support-shadow-capture-harness-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

import {
  prepareDecisionSupportShadowModeRun,
  evaluateDecisionSupportShadowModeRun,
  runDecisionSupportShadowModePrepEvaluation,
  summarizeDecisionSupportShadowModePrepEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts";
import { DECISION_SUPPORT_SHADOW_MODE_PREP_CASES } from "./fixtures/conversational-brain-decision-support-shadow-mode-prep-cases.ts";
import {
  runDecisionSupportAdapterMappingPlan,
  summarizeDecisionSupportAdapterMappingPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlan.ts";
import {
  runDecisionSupportShadowMappingEvaluation,
  summarizeDecisionSupportShadowMappingEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts";
import { handleDecisionSupportCandidate } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportCandidateHandler.ts";
import { DECISION_SUPPORT_HANDLER_CASES } from "./fixtures/conversational-brain-decision-support-handler-cases.ts";
import {
  runDecisionClarificationArchitectureReview,
  summarizeDecisionClarificationArchitectureReview,
} from "../src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts";
import {
  runGeneralPmAdviceBoundaryReview,
  summarizeGeneralPmAdviceBoundaryReview,
} from "../src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts";
import { GENERAL_PM_ADVICE_BOUNDARY_CASES } from "./fixtures/conversational-brain-general-pm-advice-boundary-cases.ts";
import {
  runGoldenIntentEvaluation,
  summarizeGoldenIntentEvaluation,
} from "../src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts";
import { GOLDEN_INTENT_CASES } from "./fixtures/conversational-brain-golden-intents.ts";
import {
  runClarificationResponseEvaluation,
  summarizeClarificationResponseEvaluation,
  toDecisionClarificationEvaluationCases,
  toGeneralPmBoundaryEvaluationCases,
  toCustomFixtureEvaluationCases,
} from "../src/lib/playbook-engine/conversation/clarification/clarificationResponseEvaluation.ts";
import { CLARIFICATION_RESPONSE_CASES } from "./fixtures/conversational-brain-clarification-response-cases.ts";

/**
 * Sprint 25R — Decision Support Shadow Capture Harness.
 *
 * Tests the pure, offline, deterministic, test-only capture harness in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts`.
 * This module turns a Sprint 24R `DecisionSupportShadowModeRun` into a minimized, redacted capture
 * record — it never writes a database, calls Supabase, shows anything to a user, or executes any
 * action, even in its "test_only_in_memory" mode (a plain in-process array, opt-in only). The
 * regression section re-runs the golden evaluation and every prior sprint's evaluator to confirm
 * none of their metrics changed.
 */

function runSourceRun(fixtureCase) {
  return prepareDecisionSupportShadowModeRun(
    {
      id: fixtureCase.id,
      input: fixtureCase.input,
      availableContext: fixtureCase.availableContext,
      desiredFutureRoute: fixtureCase.desiredFutureRoute,
      architectureCategory: fixtureCase.architectureCategory,
      targetKind: fixtureCase.targetKind,
    },
    fixtureCase.shadowModeContext ?? {},
  );
}

function captureFixtureCase(fixtureCase) {
  const run = runSourceRun(fixtureCase);
  const context = { ...(fixtureCase.contextOverrides ?? {}), mode: fixtureCase.contextOverrides?.mode ?? fixtureCase.mode };
  return captureDecisionSupportShadowRun(run, context);
}

const FIXTURE_CAPTURES = new Map(DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES.map((c) => [c.id, captureFixtureCase(c)]));

function fixtureCase(id) {
  const found = DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES.find((c) => c.id === id);
  assert.ok(found, `expected a fixture case with id "${id}"`);
  return found;
}

function fixtureCapture(id) {
  const found = FIXTURE_CAPTURES.get(id);
  assert.ok(found, `expected a capture for fixture case "${id}"`);
  return found;
}

const DRY_RUN_RESULTS = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES);
const DRY_RUN_SUMMARY = summarizeDecisionSupportShadowCaptureHarnessEvaluation(DRY_RUN_RESULTS);

const IN_MEMORY_SINK = createInMemoryDecisionSupportShadowCaptureSink();
const IN_MEMORY_RESULTS = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES, {
  context: { mode: "test_only_in_memory", allowInMemoryCaptureForTests: true, policyAcknowledged: true },
  sink: IN_MEMORY_SINK,
});
const IN_MEMORY_SUMMARY = summarizeDecisionSupportShadowCaptureHarnessEvaluation(IN_MEMORY_RESULTS);

// ─── Structure ───────────────────────────────────────────────────────────────────

test("createDecisionSupportShadowCapturePolicy exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowCapturePolicy, "function");
});

test("sanitizeDecisionSupportShadowInput exists and is a function", () => {
  assert.equal(typeof sanitizeDecisionSupportShadowInput, "function");
});

test("createDecisionSupportShadowInputHash exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowInputHash, "function");
});

test("summarizeDecisionSupportShadowCandidate exists and is a function", () => {
  assert.equal(typeof summarizeDecisionSupportShadowCandidate, "function");
});

test("createDecisionSupportShadowCaptureRecord exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowCaptureRecord, "function");
});

test("createInMemoryDecisionSupportShadowCaptureSink exists and is a function", () => {
  assert.equal(typeof createInMemoryDecisionSupportShadowCaptureSink, "function");
});

test("captureDecisionSupportShadowRun exists and is a function", () => {
  assert.equal(typeof captureDecisionSupportShadowRun, "function");
});

test("runDecisionSupportShadowCaptureHarnessEvaluation exists and is a function", () => {
  assert.equal(typeof runDecisionSupportShadowCaptureHarnessEvaluation, "function");
});

test("summarizeDecisionSupportShadowCaptureHarnessEvaluation exists and is a function", () => {
  assert.equal(typeof summarizeDecisionSupportShadowCaptureHarnessEvaluation, "function");
});

test("explainDecisionSupportShadowCaptureHarness exists and is a function", () => {
  assert.equal(typeof explainDecisionSupportShadowCaptureHarness, "function");
});

// ─── Policy ───────────────────────────────────────────────────────────────────────

test("default policy retains no raw input, no full candidates, no user-visible output", () => {
  const policy = createDecisionSupportShadowCapturePolicy();
  assert.equal(policy.retainRawInput, false);
  assert.equal(policy.retainFullDecisionCandidate, false);
  assert.equal(policy.retainFullClarificationCandidate, false);
  assert.equal(policy.retainUserVisibleOutput, false);
});

test("default policy hashes input and redacts emails/phone numbers", () => {
  const policy = createDecisionSupportShadowCapturePolicy();
  assert.equal(policy.hashInput, true);
  assert.equal(policy.redactPotentialEmails, true);
  assert.equal(policy.redactPotentialPhoneNumbers, true);
});

test("maxInputPreviewChars default is finite and reasonable", () => {
  const policy = createDecisionSupportShadowCapturePolicy();
  assert.ok(Number.isFinite(policy.maxInputPreviewChars));
  assert.ok(policy.maxInputPreviewChars > 0);
  assert.ok(policy.maxInputPreviewChars <= 500);
});

test("policy overrides never actually loosen retain*/false fields", () => {
  const policy = createDecisionSupportShadowCapturePolicy({
    retainRawInput: true,
    retainFullDecisionCandidate: true,
    retainFullClarificationCandidate: true,
    retainUserVisibleOutput: true,
  });
  assert.equal(policy.retainRawInput, false);
  assert.equal(policy.retainFullDecisionCandidate, false);
  assert.equal(policy.retainFullClarificationCandidate, false);
  assert.equal(policy.retainUserVisibleOutput, false);
});

// ─── Sanitization ─────────────────────────────────────────────────────────────────

test("sanitizeDecisionSupportShadowInput trims and collapses whitespace", () => {
  const sanitized = sanitizeDecisionSupportShadowInput("   hola    mundo  \n  como estas   ");
  assert.equal(sanitized, "hola mundo como estas");
});

test("sanitizeDecisionSupportShadowInput truncates long input", () => {
  const longInput = "a".repeat(300);
  const sanitized = sanitizeDecisionSupportShadowInput(longInput);
  assert.ok(sanitized.length <= 121, `expected truncated length <= 121, got ${sanitized.length}`);
  assert.ok(sanitized.endsWith("…"));
});

test("sanitizeDecisionSupportShadowInput redacts emails", () => {
  const sanitized = sanitizeDecisionSupportShadowInput("contactame a victor@example.com por favor");
  assert.match(sanitized, /\[redacted-email\]/);
  assert.doesNotMatch(sanitized, /victor@example\.com/);
});

test("sanitizeDecisionSupportShadowInput redacts phone numbers", () => {
  const withCountryCode = sanitizeDecisionSupportShadowInput("llamame al +506 8888-8888");
  assert.match(withCountryCode, /\[redacted-phone\]/);
  assert.doesNotMatch(withCountryCode, /8888-8888/);

  const bareDigits = sanitizeDecisionSupportShadowInput("mi numero es 88888888");
  assert.match(bareDigits, /\[redacted-phone\]/);
  assert.doesNotMatch(bareDigits, /88888888/);
});

test("sanitizeDecisionSupportShadowInput never returns the untouched raw input for long/sensitive text", () => {
  const input = "contactame a victor@example.com o al +506 8888-8888 antes de facturar el proyecto Delta completo con todo el detalle";
  const sanitized = sanitizeDecisionSupportShadowInput(input);
  assert.notEqual(sanitized, input);
});

test("createDecisionSupportShadowInputHash is stable for the same input", () => {
  assert.equal(createDecisionSupportShadowInputHash("hola mundo"), createDecisionSupportShadowInputHash("hola mundo"));
});

test("createDecisionSupportShadowInputHash differs for different input", () => {
  assert.notEqual(createDecisionSupportShadowInputHash("hola mundo"), createDecisionSupportShadowInputHash("chau mundo"));
});

test("createDecisionSupportShadowInputHash returns a dssh_-prefixed string, never the raw input", () => {
  const hash = createDecisionSupportShadowInputHash("informacion sensible del proyecto");
  assert.match(hash, /^dssh_[0-9a-f]+$/);
  assert.doesNotMatch(hash, /informacion sensible/);
});

test("cap-24/cap-25 hash reference pair: same input -> same hash, different input -> different hash", () => {
  const a = fixtureCase("cap-24");
  const b = fixtureCase("cap-25");
  assert.equal(createDecisionSupportShadowInputHash(a.input), createDecisionSupportShadowInputHash(a.input));
  assert.notEqual(createDecisionSupportShadowInputHash(a.input), createDecisionSupportShadowInputHash(b.input));
});

// ─── Dry run behavior ─────────────────────────────────────────────────────────────

test("default mode (omitted) creates capture_preview_generated with sinkKind none", () => {
  const capture = fixtureCapture("cap-01");
  assert.equal(capture.mode, "dry_run");
  assert.equal(capture.captureStatus, "capture_preview_generated");
  assert.equal(capture.sinkKind, "none");
  assert.equal(capture.recordCreated, true);
});

test("dry_run captures never retain raw input, full candidates, or user-visible output", () => {
  for (const capture of FIXTURE_CAPTURES.values()) {
    assert.equal(capture.rawInputRetained, false);
    assert.equal(capture.fullDecisionCandidateRetained, false);
    assert.equal(capture.fullClarificationCandidateRetained, false);
    assert.equal(capture.userVisibleOutputRetained, false);
  }
});

test("dry_run captures never write a database, Supabase, or perform any side effect", () => {
  for (const capture of FIXTURE_CAPTURES.values()) {
    assert.equal(capture.dbWriteAttempted, false);
    assert.equal(capture.supabaseWriteAttempted, false);
    assert.equal(capture.shouldReturnCandidateToUser, false);
    assert.equal(capture.shouldPersistShadowResult, false);
    assert.equal(capture.shouldExecuteAction, false);
    assert.equal(capture.shouldSendEmail, false);
    assert.equal(capture.shouldCreateTask, false);
    assert.equal(capture.shouldWriteToDb, false);
  }
});

// ─── Test-only in-memory behavior ─────────────────────────────────────────────────

test("mode test_only_in_memory + allowInMemoryCaptureForTests + policyAcknowledged writes to the in-memory sink", () => {
  const sink = createInMemoryDecisionSupportShadowCaptureSink();
  const run = runSourceRun(fixtureCase("cap-05"));
  const capture = captureDecisionSupportShadowRun(run, { mode: "test_only_in_memory", allowInMemoryCaptureForTests: true, policyAcknowledged: true }, sink);
  assert.equal(capture.captureStatus, "in_memory_capture_recorded");
  assert.equal(capture.sinkKind, "in_memory_test_only");
  assert.equal(sink.count(), 1);
});

test("in-memory sink count increments across multiple writes", () => {
  const sink = createInMemoryDecisionSupportShadowCaptureSink();
  const context = { mode: "test_only_in_memory", allowInMemoryCaptureForTests: true, policyAcknowledged: true };
  captureDecisionSupportShadowRun(runSourceRun(fixtureCase("cap-05")), context, sink);
  captureDecisionSupportShadowRun(runSourceRun(fixtureCase("cap-06")), context, sink);
  assert.equal(sink.count(), 2);
});

test("in-memory sink records can be listed", () => {
  const sink = createInMemoryDecisionSupportShadowCaptureSink();
  const context = { mode: "test_only_in_memory", allowInMemoryCaptureForTests: true, policyAcknowledged: true };
  captureDecisionSupportShadowRun(runSourceRun(fixtureCase("cap-05")), context, sink);
  const listed = sink.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].kind, "decision_support_shadow_capture_record");
});

test("in-memory sink clear() empties the sink", () => {
  const sink = createInMemoryDecisionSupportShadowCaptureSink();
  const context = { mode: "test_only_in_memory", allowInMemoryCaptureForTests: true, policyAcknowledged: true };
  captureDecisionSupportShadowRun(runSourceRun(fixtureCase("cap-05")), context, sink);
  assert.equal(sink.count(), 1);
  sink.clear();
  assert.equal(sink.count(), 0);
  assert.deepEqual(sink.list(), []);
});

test("test_only_in_memory captures never write a database, Supabase, or perform any side effect", () => {
  for (const id of ["cap-05", "cap-06", "cap-07", "cap-28"]) {
    const capture = fixtureCapture(id);
    assert.equal(capture.dbWriteAttempted, false);
    assert.equal(capture.supabaseWriteAttempted, false);
    assert.equal(capture.shouldReturnCandidateToUser, false);
    assert.equal(capture.shouldPersistShadowResult, false);
    assert.equal(capture.shouldExecuteAction, false);
  }
});

// ─── Blocking behavior ─────────────────────────────────────────────────────────────

const BLOCKED_CASE_IDS = ["cap-08", "cap-09", "cap-10", "cap-11", "cap-12", "cap-13", "cap-14", "cap-15", "cap-16", "cap-17", "cap-18", "cap-19"];

test("every blocked fixture case reports capture_blocked_by_gate with no record created", () => {
  for (const id of BLOCKED_CASE_IDS) {
    const capture = fixtureCapture(id);
    assert.equal(capture.captureStatus, "capture_blocked_by_gate", `case ${id}`);
    assert.equal(capture.recordCreated, false, `case ${id}`);
    assert.equal(capture.record, undefined, `case ${id}`);
    assert.equal(capture.sinkKind, "none", `case ${id}`);
  }
});

test("blocked captures do not write to any sink", () => {
  const sink = createInMemoryDecisionSupportShadowCaptureSink();
  for (const id of BLOCKED_CASE_IDS) {
    const c = fixtureCase(id);
    const run = runSourceRun(c);
    const context = { ...(c.contextOverrides ?? {}), mode: c.contextOverrides?.mode ?? c.mode };
    captureDecisionSupportShadowRun(run, context, sink);
  }
  assert.equal(sink.count(), 0);
});

test("blocked captures never persist, expose user output, or execute actions", () => {
  for (const id of BLOCKED_CASE_IDS) {
    const capture = fixtureCapture(id);
    assert.equal(capture.shouldPersistShadowResult, false, `case ${id}`);
    assert.equal(capture.shouldReturnCandidateToUser, false, `case ${id}`);
    assert.equal(capture.shouldExecuteAction, false, `case ${id}`);
    assert.equal(capture.dbWriteAttempted, false, `case ${id}`);
    assert.equal(capture.supabaseWriteAttempted, false, `case ${id}`);
  }
});

test("forcing allowDbWrite/allowSupabaseWrite/allowPersistence/allowUserVisibleOutput/allowExecution each fails a distinct blocking gate", () => {
  const expectedGateByCase = {
    "cap-08": "no_db_persistence",
    "cap-09": "no_supabase",
    "cap-10": "no_db_persistence",
    "cap-11": "no_user_visible_output",
    "cap-12": "no_execution",
  };
  for (const [id, expectedGate] of Object.entries(expectedGateByCase)) {
    const run = runSourceRun(fixtureCase(id));
    const record = createDecisionSupportShadowCaptureRecord(run, fixtureCase(id).contextOverrides);
    const gate = record.gateResults.find((g) => g.gate === expectedGate);
    assert.equal(gate.passed, false, `case ${id} expected gate ${expectedGate} to fail`);
  }
});

test("forcing retainRawInput/retainFullDecisionCandidate/retainFullClarificationCandidate/retainUserVisibleOutput each fails a blocking gate", () => {
  const expectedGateByCase = {
    "cap-13": "no_raw_input_retention",
    "cap-14": "candidate_minimized",
    "cap-15": "candidate_minimized",
    "cap-16": "candidate_minimized",
  };
  for (const [id, expectedGate] of Object.entries(expectedGateByCase)) {
    const run = runSourceRun(fixtureCase(id));
    const record = createDecisionSupportShadowCaptureRecord(run, fixtureCase(id).contextOverrides);
    const gate = record.gateResults.find((g) => g.gate === expectedGate);
    assert.equal(gate.passed, false, `case ${id} expected gate ${expectedGate} to fail`);
  }
});

test("test_only_in_memory without allowInMemoryCaptureForTests fails test_only_mode", () => {
  const run = runSourceRun(fixtureCase("cap-17"));
  const record = createDecisionSupportShadowCaptureRecord(run, fixtureCase("cap-17").contextOverrides);
  const gate = record.gateResults.find((g) => g.gate === "test_only_mode");
  assert.equal(gate.passed, false);
});

test("test_only_in_memory without policyAcknowledged fails capture_policy_acknowledged", () => {
  const run = runSourceRun(fixtureCase("cap-18"));
  const record = createDecisionSupportShadowCaptureRecord(run, fixtureCase("cap-18").contextOverrides);
  const gate = record.gateResults.find((g) => g.gate === "capture_policy_acknowledged");
  assert.equal(gate.passed, false);
});

test("an unacceptable source shadow run fails shadow_run_acceptable even under a plain dry_run capture", () => {
  const capture = fixtureCapture("cap-19");
  assert.equal(capture.captureStatus, "capture_blocked_by_gate");
});

// ─── Candidate summary ─────────────────────────────────────────────────────────────

test("decision candidate summary includes decisionType, confidence, counts, and safetyPass", () => {
  const run = runSourceRun(fixtureCase("cap-01"));
  const summary = summarizeDecisionSupportShadowCandidate(run);
  assert.equal(summary.candidateKind, "decision_support_candidate");
  assert.equal(typeof summary.decisionType, "string");
  assert.ok(["low", "medium", "high"].includes(summary.decisionConfidence));
  assert.ok(summary.decisionOptionCount >= 1);
  assert.ok(summary.decisionEvidenceNeededCount >= 1);
  assert.ok(summary.decisionRiskCount >= 1);
  assert.equal(summary.safetyPass, true);
});

test("clarification candidate summary includes strategyType, ambiguityLevel, missingSlots, routeOptionIntents, questionCount, safetyPass", () => {
  const run = runSourceRun(fixtureCase("cap-02"));
  const summary = summarizeDecisionSupportShadowCandidate(run);
  assert.equal(summary.candidateKind, "clarification_response_candidate");
  assert.equal(typeof summary.clarificationStrategyType, "string");
  assert.ok(["low", "medium", "high"].includes(summary.clarificationAmbiguityLevel));
  assert.ok(Array.isArray(summary.clarificationMissingSlots));
  assert.ok(Array.isArray(summary.clarificationRouteOptionIntents));
  assert.ok(summary.clarificationRouteOptionIntents.length > 0);
  assert.ok(summary.clarificationQuestionCount >= 1);
  assert.equal(summary.safetyPass, true);
});

test("existing route preserved summary does not include a full candidate and is safe", () => {
  const run = runSourceRun(fixtureCase("cap-03"));
  const summary = summarizeDecisionSupportShadowCandidate(run);
  assert.equal(summary.candidateKind, "existing_route_preserved");
  assert.equal(summary.decisionType, undefined);
  assert.equal(summary.clarificationStrategyType, undefined);
  assert.equal(summary.safetyPass, true);
});

test("none/not_applicable summary is safe", () => {
  const run = runSourceRun(fixtureCase("cap-26"));
  const summary = summarizeDecisionSupportShadowCandidate(run);
  assert.equal(summary.candidateKind, "none");
  assert.equal(summary.safetyPass, true);
});

// ─── Capture record ────────────────────────────────────────────────────────────────

test("capture record has kind decision_support_shadow_capture_record with captureId/sourceRunId/inputHash", () => {
  const capture = fixtureCapture("cap-01");
  assert.equal(capture.record.kind, "decision_support_shadow_capture_record");
  assert.ok(capture.record.captureId.length > 0);
  assert.ok(capture.record.sourceRunId.length > 0);
  assert.ok(capture.record.inputHash.length > 0);
});

test("capture record inputPreview is sanitized, not the raw input, when input contains an email", () => {
  const capture = fixtureCapture("cap-20");
  const c = fixtureCase("cap-20");
  assert.match(capture.record.inputPreview, /\[redacted-email\]/);
  assert.doesNotMatch(capture.record.inputPreview, /victor@example\.com/);
  assert.notEqual(capture.record.inputPreview, c.input);
});

test("capture record retention flags are all literal false", () => {
  const capture = fixtureCapture("cap-01");
  assert.equal(capture.record.rawInputRetained, false);
  assert.equal(capture.record.fullDecisionCandidateRetained, false);
  assert.equal(capture.record.fullClarificationCandidateRetained, false);
  assert.equal(capture.record.userVisibleOutputRetained, false);
});

test("capture record auditMetadata documents no_persistence storage policy and zero real writes", () => {
  const capture = fixtureCapture("cap-01");
  assert.equal(capture.record.auditMetadata.storagePolicy, "no_persistence");
  assert.equal(capture.record.auditMetadata.dbWriteAttempted, false);
  assert.equal(capture.record.auditMetadata.supabaseWriteAttempted, false);
  assert.equal(capture.record.auditMetadata.externalCallAttempted, false);
  assert.equal(capture.record.auditMetadata.adapterMappingRealChanged, false);
  assert.equal(capture.record.auditMetadata.routerChanged, false);
});

test("capture record allBlockingGatesPassed is true for every normal (non-blocked) fixture case", () => {
  for (const c of DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES) {
    if (BLOCKED_CASE_IDS.includes(c.id)) continue;
    const capture = fixtureCapture(c.id);
    assert.equal(capture.record.allBlockingGatesPassed, true, `case ${c.id}`);
  }
});

// ─── Redaction / truncation fixture assertions ──────────────────────────────────────

test("cap-21/cap-22 phone redaction fixture cases redact as expected", () => {
  for (const id of ["cap-21", "cap-22"]) {
    const c = fixtureCase(id);
    const capture = fixtureCapture(id);
    if (c.expectedPreviewContains) assert.match(capture.record.inputPreview, new RegExp(c.expectedPreviewContains.replace(/[[\]]/g, "\\$&")));
    if (c.expectedPreviewExcludes) assert.doesNotMatch(capture.record.inputPreview, new RegExp(c.expectedPreviewExcludes));
  }
});

test("cap-23 long input is truncated below the default maxInputPreviewChars", () => {
  const c = fixtureCase("cap-23");
  const capture = fixtureCapture("cap-23");
  const policy = createDecisionSupportShadowCapturePolicy();
  assert.ok(c.input.length > policy.maxInputPreviewChars);
  assert.ok(capture.record.inputPreview.length <= policy.maxInputPreviewChars + 1);
});

// ─── Fixture corpus: every case matches its expectations ────────────────────────────

test("every fixture case matches its expected captureStatus/sinkKind/recordCreated", () => {
  for (const c of DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES) {
    const capture = fixtureCapture(c.id);
    assert.equal(capture.captureStatus, c.expectedCaptureStatus, `case ${c.id}`);
    assert.equal(capture.sinkKind, c.expectedSinkKind, `case ${c.id}`);
    assert.equal(capture.recordCreated, c.expectedRecordCreated, `case ${c.id}`);
    assert.equal(capture.rawInputRetained, c.expectedRawInputRetained, `case ${c.id}`);
    assert.equal(capture.fullDecisionCandidateRetained, c.expectedFullCandidateRetained, `case ${c.id}`);
    assert.equal(capture.userVisibleOutputRetained, c.expectedUserVisibleOutputRetained, `case ${c.id}`);
    assert.equal(capture.dbWriteAttempted, c.expectedDbWriteAttempted, `case ${c.id}`);
    assert.equal(capture.supabaseWriteAttempted, c.expectedSupabaseWriteAttempted, `case ${c.id}`);
    assert.equal(capture.shouldReturnCandidateToUser, c.expectedShouldReturnCandidateToUser, `case ${c.id}`);
    assert.equal(capture.shouldPersistShadowResult, c.expectedShouldPersistShadowResult, `case ${c.id}`);
    assert.equal(capture.shouldExecuteAction, c.expectedShouldExecuteAction, `case ${c.id}`);
  }
});

test("every fixture case reports isAcceptableCapture consistent with capture_blocked_by_gate", () => {
  for (const c of DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES) {
    const capture = fixtureCapture(c.id);
    if (BLOCKED_CASE_IDS.includes(c.id)) {
      assert.equal(capture.isAcceptableCapture, true, `case ${c.id} — blocked-but-clean captures are still acceptable (no violation occurred)`);
    } else {
      assert.equal(capture.isAcceptableCapture, true, `case ${c.id}`);
    }
  }
});

// ─── Evaluation: dry_run over the Sprint 18R corpus ─────────────────────────────────

test("evaluator processes the Sprint 18R corpus", () => {
  assert.equal(DRY_RUN_RESULTS.length, DECISION_CLARIFICATION_CASES.length);
});

test("dry_run summary.totalCases matches corpus length", () => {
  assert.equal(DRY_RUN_SUMMARY.totalCases, DECISION_CLARIFICATION_CASES.length);
  assert.equal(DRY_RUN_SUMMARY.totalCases, 79);
});

test("dry_run acceptableCaptureRate and allBlockingGatesPassedRate are 100%", () => {
  assert.equal(DRY_RUN_SUMMARY.acceptableCaptureRate, 100);
  assert.equal(DRY_RUN_SUMMARY.allBlockingGatesPassedRate, 100);
});

test("dry_run capturePreviewGeneratedCount is > 0 and inMemoryCaptureRecordedCount/captureBlockedByGateCount are 0", () => {
  assert.ok(DRY_RUN_SUMMARY.capturePreviewGeneratedCount > 0);
  assert.equal(DRY_RUN_SUMMARY.inMemoryCaptureRecordedCount, 0);
  assert.equal(DRY_RUN_SUMMARY.captureBlockedByGateCount, 0);
});

test("dry_run retention counts are all zero", () => {
  assert.equal(DRY_RUN_SUMMARY.rawInputRetainedCount, 0);
  assert.equal(DRY_RUN_SUMMARY.fullDecisionCandidateRetainedCount, 0);
  assert.equal(DRY_RUN_SUMMARY.fullClarificationCandidateRetainedCount, 0);
  assert.equal(DRY_RUN_SUMMARY.userVisibleOutputRetainedCount, 0);
});

test("dry_run side-effect counts are all zero", () => {
  assert.equal(DRY_RUN_SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(DRY_RUN_SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(DRY_RUN_SUMMARY.shouldReturnCandidateToUserCount, 0);
  assert.equal(DRY_RUN_SUMMARY.shouldPersistShadowResultCount, 0);
  assert.equal(DRY_RUN_SUMMARY.shouldExecuteActionCount, 0);
  assert.equal(DRY_RUN_SUMMARY.shouldSendEmailCount, 0);
  assert.equal(DRY_RUN_SUMMARY.shouldCreateTaskCount, 0);
  assert.equal(DRY_RUN_SUMMARY.shouldWriteToDbCount, 0);
});

test("dry_run decisionCandidateCaptureCount, clarificationCandidateCaptureCount, existingRouteCaptureCount are all > 0", () => {
  assert.ok(DRY_RUN_SUMMARY.decisionCandidateCaptureCount > 0);
  assert.ok(DRY_RUN_SUMMARY.clarificationCandidateCaptureCount > 0);
  assert.ok(DRY_RUN_SUMMARY.existingRouteCaptureCount > 0);
});

test("dry_run existingRouteCaptureCount is 10, matching the Sprint 18R corpus's existing_route_should_win cases", () => {
  assert.equal(DRY_RUN_SUMMARY.existingRouteCaptureCount, 10);
});

// ─── Evaluation: test_only_in_memory over the Sprint 18R corpus ────────────────────

test("test_only_in_memory summary.inMemoryCaptureRecordedCount is > 0 and matches sink.count()", () => {
  assert.ok(IN_MEMORY_SUMMARY.inMemoryCaptureRecordedCount > 0);
  assert.equal(IN_MEMORY_SINK.count(), IN_MEMORY_SUMMARY.inMemoryCaptureRecordedCount);
});

test("test_only_in_memory acceptableCaptureRate is 100% and side-effect/retention counts are zero", () => {
  assert.equal(IN_MEMORY_SUMMARY.acceptableCaptureRate, 100);
  assert.equal(IN_MEMORY_SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.userVisibleOutputRetainedCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.rawInputRetainedCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.fullDecisionCandidateRetainedCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.fullClarificationCandidateRetainedCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.shouldExecuteActionCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.shouldSendEmailCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.shouldCreateTaskCount, 0);
  assert.equal(IN_MEMORY_SUMMARY.shouldWriteToDbCount, 0);
});

test("test_only_in_memory reaching 100% acceptable in both modes recommends the Sprint 26R storage policy plan", () => {
  assert.equal(IN_MEMORY_SUMMARY.recommendedNextSprint, "Sprint 26R — Shadow Capture Storage Policy / Default-Off Persistence Plan");
});

// ─── Safety: no forbidden imports / no production wiring ───────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts", import.meta.url),
    "utf8",
  );
  const imports = importLines(source);
  assert.doesNotMatch(imports, /brainRouter/);
  assert.doesNotMatch(imports, /responseComposer/);
  assert.doesNotMatch(imports, /conversationalBrainGateway/);
  assert.doesNotMatch(imports, /handlers\//);
  assert.doesNotMatch(imports, /command-center\/chat/);
  assert.doesNotMatch(imports, /supabase/i);
  assert.doesNotMatch(imports, /nodemailer/i);
  assert.doesNotMatch(source, /\bfetch\(/);
});

test("this module never imports intentCompatibilityAdapter.ts, intentClassifier.rules.ts, or intent-patterns.ts", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts", import.meta.url),
    "utf8",
  );
  const imports = importLines(source);
  assert.doesNotMatch(imports, /intentCompatibilityAdapter/);
  assert.doesNotMatch(imports, /intentClassifier\.rules/);
  assert.doesNotMatch(imports, /intent-patterns/);
});

test("no feature flag is ever activated by this sprint (source has no feature-flag/env read)", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /growthbook/i);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportShadowCaptureHarness/);
});

// ─── Explain ──────────────────────────────────────────────────────────────────────

test("explainDecisionSupportShadowCaptureHarness documents purpose, non-goals, modes, policies, gates, and the Sprint 26R path", () => {
  const explain = explainDecisionSupportShadowCaptureHarness();
  assert.ok(explain.purpose.length > 0);
  assert.ok(explain.nonGoals.length > 0);
  assert.ok(explain.captureModes.length >= 2);
  assert.ok(explain.defaultDryRunPolicy.length > 0);
  assert.ok(explain.testOnlyInMemoryPolicy.length > 0);
  assert.ok(explain.noPersistencePolicy.length > 0);
  assert.ok(explain.minimizationPolicy.length > 0);
  assert.ok(explain.sanitizationPolicy.length > 0);
  assert.ok(explain.captureGates.length > 0);
  assert.ok(explain.whyRawInputIsNotRetained.length > 0);
  assert.ok(explain.whyFullCandidatesAreNotRetained.length > 0);
  assert.ok(explain.whyDbSupabaseAreForbidden.length > 0);
  assert.ok(explain.whyUserVisibleOutputIsForbidden.length > 0);
  assert.ok(explain.expectedSprint26Path.length > 0);
});

// ─── Regression: golden evaluation + prior sprints unchanged ────────────────────

test("this sprint does not change the golden evaluation's global compatibilityRate", () => {
  const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
  const report = summarizeGoldenIntentEvaluation(evaluation);
  assert.equal(report.overall.compatibilityRate, 72.5, `expected global compatibilityRate to stay 72.5, got ${report.overall.compatibilityRate}`);
});

test("Sprint 17R boundary review metrics are unchanged by this sprint", () => {
  const results = runGeneralPmAdviceBoundaryReview(GENERAL_PM_ADVICE_BOUNDARY_CASES);
  const summary = summarizeGeneralPmAdviceBoundaryReview(results);
  assert.equal(summary.policyAlignedRate, 82.9);
  assert.equal(summary.currentSystemAcceptableRate, 84.3);
});

test("Sprint 18R architecture review metrics are unchanged by this sprint", () => {
  const results = runDecisionClarificationArchitectureReview(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionClarificationArchitectureReview(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.currentSafeMappingRate, 84.8);
  assert.equal(summary.futureRouteAlreadySupportedRate, 84.8);
  assert.equal(summary.requiresNewHandlerCount, 45);
  assert.equal(summary.requiresClarificationCount, 24);
});

test("Sprint 19R candidate handler behavior is unchanged by this sprint", () => {
  for (const c of DECISION_SUPPORT_HANDLER_CASES.slice(0, 5)) {
    assert.doesNotThrow(() => handleDecisionSupportCandidate({ input: c.input }));
  }
});

test("Sprint 20R/21R shadow mapping evaluation metrics are unchanged by this sprint", () => {
  const results = runDecisionSupportShadowMappingEvaluation(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionSupportShadowMappingEvaluation(results);
  assert.equal(summary.candidateHandlerSafeRate, 100);
  assert.equal(summary.shadowRoutableRate, 40);
  assert.equal(summary.unsafeClassifierCollisionCount, 5);
  assert.equal(summary.recommendedIntegrationMode, "do_not_integrate");
});

test("Sprint 22R clarification response strategy metrics are unchanged by this sprint", () => {
  const cases = [
    ...toDecisionClarificationEvaluationCases(DECISION_CLARIFICATION_CASES),
    ...toGeneralPmBoundaryEvaluationCases(GENERAL_PM_ADVICE_BOUNDARY_CASES),
    ...toCustomFixtureEvaluationCases(CLARIFICATION_RESPONSE_CASES),
  ];
  const results = runClarificationResponseEvaluation(cases);
  const summary = summarizeClarificationResponseEvaluation(results);
  assert.equal(summary.evaluatedClarificationCases, 34);
  assert.equal(summary.acceptableResponseRate, 100);
  assert.equal(summary.safetyPassRate, 100);
  assert.equal(summary.routeOptionsCoverageRate, 100);
  assert.equal(summary.overQuestioningCount, 0);
});

test("Sprint 23R adapter mapping plan metrics are unchanged by this sprint", () => {
  const results = runDecisionSupportAdapterMappingPlan(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionSupportAdapterMappingPlan(results);
  assert.equal(summary.recommendedSprint24Strategy, "hybrid_shadow_then_clarify");
  assert.equal(summary.recommendedNextSprint, "Sprint 24R — Decision Support Shadow Mode Prep");
  const hybrid = summary.strategySummaries.hybrid_shadow_then_clarify;
  assert.equal(hybrid.safeOutcomeRate, 100);
  assert.equal(hybrid.riskyOutcomeCount, 0);
  assert.equal(hybrid.criticalRiskCount, 0);
  assert.equal(hybrid.preservesExistingRouteRate, 100);
  assert.equal(hybrid.candidateHandlerSafeCount, 45);
  assert.equal(hybrid.clarificationSafeCount, 51);
});

test("Sprint 24R shadow mode prep metrics are unchanged by this sprint", () => {
  const results = runDecisionSupportShadowModePrepEvaluation(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionSupportShadowModePrepEvaluation(results);
  assert.equal(summary.totalCases, 79);
  assert.equal(summary.shadowEligibleCount, 69);
  assert.equal(summary.decisionCandidateGeneratedCount, 18);
  assert.equal(summary.clarificationCandidateGeneratedCount, 51);
  assert.equal(summary.existingRoutePreservedCount, 10);
  assert.equal(summary.blockedBySafetyGateCount, 0);
  assert.equal(summary.acceptableShadowPrepRunRate, 100);
  assert.equal(summary.allBlockingGatesPassedRate, 100);
  assert.equal(summary.recommendedNextSprint, "Sprint 25R — Decision Support Shadow Capture Harness");
});

test("Sprint 24R shadow mode prep fixture corpus (forced-gate-failure cases) is unchanged by this sprint", () => {
  const fixtureResults = DECISION_SUPPORT_SHADOW_MODE_PREP_CASES.map((c) =>
    evaluateDecisionSupportShadowModeRun(
      prepareDecisionSupportShadowModeRun(
        { id: c.id, input: c.input, projectName: c.projectName, availableContext: c.availableContext, desiredFutureRoute: c.desiredFutureRoute, architectureCategory: c.architectureCategory, targetKind: c.targetKind },
        c.forcedContext ?? {},
      ),
    ),
  );
  const summary = summarizeDecisionSupportShadowModePrepEvaluation(fixtureResults);
  assert.equal(summary.blockedBySafetyGateCount, 5);
});
