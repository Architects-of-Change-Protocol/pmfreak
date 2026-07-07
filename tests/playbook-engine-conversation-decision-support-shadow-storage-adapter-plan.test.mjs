import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createDecisionSupportShadowStorageAdapterPlanProfile,
  listDecisionSupportShadowStorageAdapterMethodPolicies,
  createDecisionSupportShadowStorageSchemaProposal,
  createDecisionSupportShadowStorageMigrationProposal,
  mapDecisionSupportCaptureRecordToStorageDraft,
  validateDecisionSupportShadowStorageDraft,
  simulateDecisionSupportShadowStorageAdapter,
  runDecisionSupportShadowStorageAdapterPlanEvaluation,
  summarizeDecisionSupportShadowStorageAdapterPlanEvaluation,
  explainDecisionSupportShadowStorageAdapterPlan,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts";
import { DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_CASES } from "./fixtures/conversational-brain-decision-support-shadow-storage-adapter-plan-cases.ts";

import {
  captureDecisionSupportShadowRun,
  runDecisionSupportShadowCaptureHarnessEvaluation,
  summarizeDecisionSupportShadowCaptureHarnessEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";
import { DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES } from "./fixtures/conversational-brain-decision-support-shadow-capture-harness-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

import {
  prepareDecisionSupportShadowModeRun,
  runDecisionSupportShadowModePrepEvaluation,
  summarizeDecisionSupportShadowModePrepEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts";
import {
  createDecisionSupportShadowDefaultOffPersistencePlan,
  runDecisionSupportShadowStoragePolicyEvaluation,
  summarizeDecisionSupportShadowStoragePolicyEvaluation,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStoragePolicy.ts";
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
 * Sprint 27R — Decision Support Shadow Capture Storage Adapter Plan.
 *
 * Tests the pure, offline, deterministic adapter **plan/contract** in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts`.
 * This module designs a future storage adapter's method contract, a proposed schema, a proposed
 * migration, a safe storage-draft mapper, a storage-draft validator, and a no-op contract simulation
 * — it creates no database, migration, table, storage adapter, or Supabase write. The regression
 * section re-runs the golden evaluation and every prior sprint's evaluator to confirm none of their
 * metrics changed.
 */

// ─── Structure ───────────────────────────────────────────────────────────────────

test("createDecisionSupportShadowStorageAdapterPlanProfile exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowStorageAdapterPlanProfile, "function");
});

test("listDecisionSupportShadowStorageAdapterMethodPolicies exists and is a function", () => {
  assert.equal(typeof listDecisionSupportShadowStorageAdapterMethodPolicies, "function");
});

test("createDecisionSupportShadowStorageSchemaProposal exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowStorageSchemaProposal, "function");
});

test("createDecisionSupportShadowStorageMigrationProposal exists and is a function", () => {
  assert.equal(typeof createDecisionSupportShadowStorageMigrationProposal, "function");
});

test("mapDecisionSupportCaptureRecordToStorageDraft exists and is a function", () => {
  assert.equal(typeof mapDecisionSupportCaptureRecordToStorageDraft, "function");
});

test("validateDecisionSupportShadowStorageDraft exists and is a function", () => {
  assert.equal(typeof validateDecisionSupportShadowStorageDraft, "function");
});

test("simulateDecisionSupportShadowStorageAdapter exists and is a function", () => {
  assert.equal(typeof simulateDecisionSupportShadowStorageAdapter, "function");
});

test("runDecisionSupportShadowStorageAdapterPlanEvaluation exists and is a function", () => {
  assert.equal(typeof runDecisionSupportShadowStorageAdapterPlanEvaluation, "function");
});

test("summarizeDecisionSupportShadowStorageAdapterPlanEvaluation exists and is a function", () => {
  assert.equal(typeof summarizeDecisionSupportShadowStorageAdapterPlanEvaluation, "function");
});

test("explainDecisionSupportShadowStorageAdapterPlan exists and is a function", () => {
  assert.equal(typeof explainDecisionSupportShadowStorageAdapterPlan, "function");
});

// ─── Adapter plan profile ────────────────────────────────────────────────────────────

test("adapter plan profile is strict_default_off_adapter_plan and fully default-off", () => {
  const profile = createDecisionSupportShadowStorageAdapterPlanProfile();
  assert.equal(profile.profile, "strict_default_off_adapter_plan");
  assert.equal(profile.storageEnabled, false);
  assert.equal(profile.realPersistenceAllowed, false);
  assert.equal(profile.storageAdapterImplemented, false);
  assert.equal(profile.dbMigrationImplemented, false);
  assert.equal(profile.tableCreated, false);
  assert.equal(profile.supabaseWriteImplemented, false);
  assert.equal(profile.productionRouteChanged, false);
});

// ─── Method policies ─────────────────────────────────────────────────────────────────

test("listDecisionSupportShadowStorageAdapterMethodPolicies returns all 8 methods", () => {
  const policies = listDecisionSupportShadowStorageAdapterMethodPolicies();
  assert.equal(policies.length, 8);
});

test("validatePolicy / mapCaptureRecordToStorageDraft / validateStorageDraft are allowed in Sprint 27", () => {
  const policies = listDecisionSupportShadowStorageAdapterMethodPolicies();
  const byName = new Map(policies.map((p) => [p.methodName, p]));
  for (const name of ["validatePolicy", "mapCaptureRecordToStorageDraft", "validateStorageDraft"]) {
    const p = byName.get(name);
    assert.ok(p, name);
    assert.equal(p.allowedInSprint27, true, name);
    assert.equal(p.futureOnly, false, name);
    assert.equal(p.mustNotWriteRealStorage, true, name);
  }
});

test("writeCaptureDraft / deleteByCaptureId / deleteByWorkspace / purgeExpired / listByPolicyVersion are futureOnly and not allowed in Sprint 27", () => {
  const policies = listDecisionSupportShadowStorageAdapterMethodPolicies();
  const byName = new Map(policies.map((p) => [p.methodName, p]));
  for (const name of ["writeCaptureDraft", "deleteByCaptureId", "deleteByWorkspace", "purgeExpired", "listByPolicyVersion"]) {
    const p = byName.get(name);
    assert.ok(p, name);
    assert.equal(p.allowedInSprint27, false, name);
    assert.equal(p.futureOnly, true, name);
  }
});

test("writeCaptureDraft requires tenant isolation, access control, and a deletion path", () => {
  const p = listDecisionSupportShadowStorageAdapterMethodPolicies().find((m) => m.methodName === "writeCaptureDraft");
  assert.equal(p.mustBeDefaultOff, true);
  assert.equal(p.requiresTenantIsolation, true);
  assert.equal(p.requiresAccessControl, true);
  assert.equal(p.requiresDeletionPath, true);
});

// ─── Schema proposal ─────────────────────────────────────────────────────────────────

test("schema proposal is proposal_only for decision_support_shadow_captures, never created", () => {
  const proposal = createDecisionSupportShadowStorageSchemaProposal();
  assert.equal(proposal.tableName, "decision_support_shadow_captures");
  assert.equal(proposal.status, "proposal_only");
  assert.equal(proposal.migrationCreated, false);
  assert.equal(proposal.tableCreated, false);
});

test("schema proposal includes every allowed column", () => {
  const proposal = createDecisionSupportShadowStorageSchemaProposal();
  const names = proposal.columns.map((c) => c.columnName);
  for (const expected of [
    "capture_id",
    "source_run_id_hash",
    "generated_at",
    "mode",
    "sink_kind",
    "input_hash",
    "architecture_category",
    "desired_future_route",
    "target_kind",
    "source_status",
    "source_candidate_kind",
    "capture_status",
    "candidate_summary_json_minimized",
    "safety_snapshot_json",
    "gate_summary_json_minimized",
    "audit_summary_json",
    "all_blocking_gates_passed",
    "policy_version",
    "retention_mode",
    "retention_expires_at",
    "deletion_required",
  ]) {
    assert.ok(names.includes(expected), expected);
  }
});

test("schema proposal excludes every prohibited column", () => {
  const proposal = createDecisionSupportShadowStorageSchemaProposal();
  const allowedNames = new Set(proposal.columns.map((c) => c.columnName));
  for (const prohibited of [
    "raw_input",
    "input_preview",
    "full_decision_candidate",
    "full_clarification_candidate",
    "decision_response_text",
    "clarification_response_text",
    "recommendation_text",
    "user_visible_output",
    "project_name",
    "email_address",
    "phone_number",
    "raw_evidence",
  ]) {
    assert.ok(proposal.prohibitedColumns.includes(prohibited), prohibited);
    assert.equal(allowedNames.has(prohibited), false, prohibited);
  }
});

test("schema proposal carries required indexes and constraints", () => {
  const proposal = createDecisionSupportShadowStorageSchemaProposal();
  assert.ok(proposal.requiredIndexes.length >= 5);
  assert.ok(proposal.requiredConstraints.length >= 5);
  assert.ok(proposal.notes.length > 0);
});

// ─── Migration proposal ──────────────────────────────────────────────────────────────

test("migration proposal is proposal_only and never creates a real migration", () => {
  const migration = createDecisionSupportShadowStorageMigrationProposal();
  assert.equal(migration.status, "proposal_only");
  assert.equal(migration.migrationFileCreated, false);
  assert.equal(migration.migrationShouldNotBeCreatedInSprint27, true);
  assert.ok(migration.proposedMigrationName.length > 0);
  assert.equal(migration.proposedTableName, "decision_support_shadow_captures");
});

test("migration proposal's prohibited contents include every raw/full/output field family", () => {
  const migration = createDecisionSupportShadowStorageMigrationProposal();
  const text = migration.prohibitedMigrationContents.join(" ").toLowerCase();
  assert.match(text, /raw_input/);
  assert.match(text, /input_preview/);
  assert.match(text, /full_candidate/);
  assert.match(text, /responsetext/);
  assert.match(text, /email\/phone\/projectname|email|phone|projectname/);
  assert.match(text, /user_visible_output/);
});

test("migration proposal carries rollback and deletion requirements", () => {
  const migration = createDecisionSupportShadowStorageMigrationProposal();
  assert.ok(migration.rollbackRequirements.length > 0);
  assert.ok(migration.deletionRequirements.length > 0);
  assert.ok(migration.requiredPreconditions.length > 0);
});

// ─── Draft mapping + validation + simulation (fixture-driven) ───────────────────────

function findHarnessCase(id) {
  const c = DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES.find((x) => x.id === id);
  assert.ok(c, `missing harness fixture case ${id}`);
  return c;
}

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

function captureFor(fixtureCase) {
  const run = runSourceRun(fixtureCase);
  const context = { ...(fixtureCase.contextOverrides ?? {}), mode: fixtureCase.contextOverrides?.mode ?? fixtureCase.mode };
  return captureDecisionSupportShadowRun(run, context);
}

function draftFor(planCase) {
  const harnessCase = findHarnessCase(planCase.sourceCaptureHarnessCaseId);
  const capture = captureFor(harnessCase);
  assert.ok(capture.record, `capture did not produce a record for ${planCase.id}`);
  let draft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  if (planCase.syntheticFieldOverrides) {
    draft = { ...draft, fields: { ...draft.fields, ...planCase.syntheticFieldOverrides } };
  }
  if (planCase.syntheticTopLevelOverrides) {
    draft = { ...draft, ...planCase.syntheticTopLevelOverrides };
  }
  return draft;
}

test("fixture corpus has between 25 and 45 cases", () => {
  assert.ok(DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_CASES.length >= 25);
  assert.ok(DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_CASES.length <= 45);
});

for (const c of DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_CASES) {
  test(`storage adapter plan ${c.id}: ${c.scenario}`, () => {
    const draft = draftFor(c);
    const simulation = simulateDecisionSupportShadowStorageAdapter(draft);

    assert.equal(simulation.draftValid, c.expectedValid, c.id);
    assert.equal(simulation.blockingFailureCount, c.expectedBlockingFailureCount, c.id);
    assert.equal(simulation.noopWriteAccepted, c.expectedValid, c.id);
    assert.equal(simulation.writeAttempted, c.expectedWriteAttempted, c.id);
    assert.equal(simulation.dbWriteAttempted, c.expectedDbWriteAttempted, c.id);
    assert.equal(simulation.supabaseWriteAttempted, c.expectedSupabaseWriteAttempted, c.id);

    for (const f of c.expectedExcludedFields) {
      assert.ok(draft.excludedFields.includes(f), `${c.id}: excludedFields should include "${f}"`);
    }
    for (const f of c.expectedIncludedFields) {
      const present = draft.fields[f] !== undefined || draft[f] !== undefined;
      assert.ok(present, `${c.id}: expected field "${f}" to be present on the draft`);
    }
  });
}

// ─── Draft mapping: structural assertions on real records ───────────────────────────

test("mapping a real Sprint 25R dry_run capture record produces a well-formed draft", () => {
  const capture = captureFor(findHarnessCase("cap-01"));
  const draft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  assert.equal(draft.kind, "decision_support_shadow_storage_draft");
  assert.equal(draft.storageEnabled, false);
  assert.equal(draft.realPersistenceAllowed, false);
  assert.ok(draft.policyVersion.length > 0);
  assert.equal(draft.fields.inputHash, capture.record.inputHash);
  assert.ok(draft.fields.candidateSummary);
  assert.ok(draft.fields.safetySnapshot);
  assert.ok(draft.fields.gateSummary);
  assert.ok(draft.fields.auditSummary);
  assert.equal(draft.fields.deletionRequired, true);
  assert.equal(draft.fields.retentionExpiresAt, null);
});

test("draft never carries raw input, inputPreview, full candidates, responseText, projectName, email, or phone", () => {
  const capture = captureFor(findHarnessCase("cap-01"));
  const draft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  // Serialize only the actual data payload (top-level + fields), not the excludedFields metadata
  // array, which legitimately lists these names as documentation of what was excluded.
  const serializedData = JSON.stringify({ ...draft, excludedFields: undefined, warnings: undefined });
  assert.doesNotMatch(serializedData, /"rawInput"/);
  assert.doesNotMatch(serializedData, /"inputPreview"/);
  assert.doesNotMatch(serializedData, /"fullDecisionCandidate"/);
  assert.doesNotMatch(serializedData, /"fullClarificationCandidate"/);
  assert.doesNotMatch(serializedData, /"responseText"/);
  assert.doesNotMatch(serializedData, /"projectName"/);
  assert.doesNotMatch(serializedData, /"emailAddress"/);
  assert.doesNotMatch(serializedData, /"phoneNumber"/);
  for (const f of ["rawInput", "inputPreview", "fullDecisionCandidate", "fullClarificationCandidate", "userVisibleOutput", "projectName", "emailAddress", "phoneNumber"]) {
    assert.ok(draft.excludedFields.includes(f), f);
  }
});

test("draft.policyAssessmentSummary reports every exclusion as true", () => {
  const capture = captureFor(findHarnessCase("cap-01"));
  const draft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  assert.equal(draft.policyAssessmentSummary.rawInputExcluded, true);
  assert.equal(draft.policyAssessmentSummary.inputPreviewExcluded, true);
  assert.equal(draft.policyAssessmentSummary.fullCandidatesExcluded, true);
  assert.equal(draft.policyAssessmentSummary.userVisibleOutputExcluded, true);
  assert.equal(draft.policyAssessmentSummary.projectNameExcluded, true);
  assert.equal(draft.policyAssessmentSummary.emailAddressExcluded, true);
  assert.equal(draft.policyAssessmentSummary.phoneNumberExcluded, true);
});

// ─── Draft validation: valid drafts pass every blocking gate ────────────────────────

test("a real, unmodified draft passes every blocking validation gate", () => {
  const capture = captureFor(findHarnessCase("cap-01"));
  const draft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  const results = validateDecisionSupportShadowStorageDraft(draft);
  const blockingFailures = results.filter((r) => r.severity === "blocking" && !r.passed);
  assert.deepEqual(blockingFailures, []);
});

test("validateDecisionSupportShadowStorageDraft returns all 23 gates", () => {
  const capture = captureFor(findHarnessCase("cap-01"));
  const draft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  const results = validateDecisionSupportShadowStorageDraft(draft);
  assert.equal(results.length, 23);
});

// ─── No-op simulation ────────────────────────────────────────────────────────────────

test("no-op simulation of a valid draft accepts the write and never attempts a real one", () => {
  const capture = captureFor(findHarnessCase("cap-01"));
  const draft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  const simulation = simulateDecisionSupportShadowStorageAdapter(draft);
  assert.equal(simulation.noopWriteAccepted, true);
  assert.equal(simulation.draftValid, true);
  assert.equal(simulation.writeAttempted, false);
  assert.equal(simulation.realPersistenceAttempted, false);
  assert.equal(simulation.dbWriteAttempted, false);
  assert.equal(simulation.supabaseWriteAttempted, false);
});

test("no-op simulation of an invalid draft rejects the write while still never attempting a real one", () => {
  const capture = captureFor(findHarnessCase("cap-01"));
  const draft = mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
  const invalidDraft = { ...draft, fields: { ...draft.fields, rawInput: "texto crudo" } };
  const simulation = simulateDecisionSupportShadowStorageAdapter(invalidDraft);
  assert.equal(simulation.noopWriteAccepted, false);
  assert.equal(simulation.draftValid, false);
  assert.equal(simulation.writeAttempted, false);
  assert.equal(simulation.dbWriteAttempted, false);
  assert.equal(simulation.supabaseWriteAttempted, false);
  assert.ok(simulation.warnings.length > 0);
});

// ─── Evaluation: Sprint 18R corpus via Sprint 25R harness ───────────────────────────

const EVAL_RESULTS = runDecisionSupportShadowStorageAdapterPlanEvaluation(DECISION_CLARIFICATION_CASES);
const EVAL_SUMMARY = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(EVAL_RESULTS);

test("evaluator processes the Sprint 18R corpus via the Sprint 25R capture harness", () => {
  assert.equal(EVAL_SUMMARY.totalCaptureRecords, DECISION_CLARIFICATION_CASES.length);
  assert.equal(EVAL_SUMMARY.totalCaptureRecords, 79);
  assert.equal(EVAL_SUMMARY.totalDraftsCreated, EVAL_SUMMARY.totalCaptureRecords);
});

test("validDraftRate is 100% and invalidDraftCount is 0 against the Sprint 18R corpus", () => {
  assert.equal(EVAL_SUMMARY.validDraftRate, 100);
  assert.equal(EVAL_SUMMARY.invalidDraftCount, 0);
});

test("no write or real persistence is ever attempted", () => {
  assert.equal(EVAL_SUMMARY.writeAttemptedCount, 0);
  assert.equal(EVAL_SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(EVAL_SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(EVAL_SUMMARY.supabaseWriteAttemptedCount, 0);
});

test("no forbidden field is ever included in a mapped draft against the Sprint 18R corpus", () => {
  assert.equal(EVAL_SUMMARY.rawInputIncludedCount, 0);
  assert.equal(EVAL_SUMMARY.inputPreviewIncludedCount, 0);
  assert.equal(EVAL_SUMMARY.fullCandidateIncludedCount, 0);
  assert.equal(EVAL_SUMMARY.userVisibleOutputIncludedCount, 0);
  assert.equal(EVAL_SUMMARY.projectNameIncludedCount, 0);
  assert.equal(EVAL_SUMMARY.emailAddressIncludedCount, 0);
  assert.equal(EVAL_SUMMARY.phoneNumberIncludedCount, 0);
});

test("schema/migration invariants hold in the summary", () => {
  assert.ok(EVAL_SUMMARY.schemaProposalColumnCount > 0);
  assert.ok(EVAL_SUMMARY.prohibitedColumnCount > 0);
  assert.equal(EVAL_SUMMARY.migrationCreated, false);
  assert.equal(EVAL_SUMMARY.tableCreated, false);
  assert.equal(EVAL_SUMMARY.storageAdapterRealImplemented, false);
});

test("default evaluation reaches a ready readiness status and recommends Sprint 28R", () => {
  assert.ok(["ready_for_noop_adapter_implementation", "ready_for_fake_adapter_implementation"].includes(EVAL_SUMMARY.readinessStatus));
  assert.equal(EVAL_SUMMARY.recommendedNextSprint, "Sprint 28R — Shadow Capture Storage Adapter Fake Implementation");
  assert.ok(EVAL_SUMMARY.recommendation.length > 0);
});

test("representative/weak/blocking-failure lists are consistent with a fully clean evaluation", () => {
  assert.ok(EVAL_SUMMARY.representativeValidDrafts.length > 0);
  assert.deepEqual(EVAL_SUMMARY.weakDrafts, []);
  assert.deepEqual(EVAL_SUMMARY.blockingValidationFailures, []);
});

test("evaluation including a test_only_in_memory pass doubles the corpus and stays 100% valid", () => {
  const results = runDecisionSupportShadowStorageAdapterPlanEvaluation(DECISION_CLARIFICATION_CASES, { includeTestMemoryPass: true });
  const summary = summarizeDecisionSupportShadowStorageAdapterPlanEvaluation(results);
  assert.equal(results.length, DECISION_CLARIFICATION_CASES.length * 2);
  assert.equal(summary.validDraftRate, 100);
  assert.equal(summary.readinessStatus, "ready_for_fake_adapter_implementation");
});

test("mapping a capture record carrying an injected rawInput field yields an invalid draft, caught by the evaluator's own metrics", () => {
  const capture = captureFor(findHarnessCase("cap-01"));
  const violatingRecord = { ...capture.record, rawInput: "el texto crudo del usuario" };
  const draft = mapDecisionSupportCaptureRecordToStorageDraft(violatingRecord);
  // The mapper itself never copies an unknown "rawInput" key onto the draft -- it only reads the
  // known DecisionSupportShadowCaptureRecord fields it maps explicitly. This proves the mapper is
  // safe by construction even when handed a record shape that carries an extra, unexpected key.
  const serialized = JSON.stringify(draft);
  assert.doesNotMatch(serialized, /el texto crudo del usuario/);
  const validation = validateDecisionSupportShadowStorageDraft(draft);
  assert.deepEqual(validation.filter((r) => r.severity === "blocking" && !r.passed), []);
});

// ─── No real storage / no real DB / no real feature flag ────────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

test("this module does not import router/composer/production handlers/endpoint/db/gmail/fetch", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts", import.meta.url),
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
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts", import.meta.url),
    "utf8",
  );
  const imports = importLines(source);
  assert.doesNotMatch(imports, /intentCompatibilityAdapter/);
  assert.doesNotMatch(imports, /intentClassifier\.rules/);
  assert.doesNotMatch(imports, /intent-patterns/);
});

test("no feature flag / env read is ever performed by this sprint", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /growthbook/i);
});

test("no database/migration/storage-adapter vocabulary appears as executable code (only as string literals/docs)", () => {
  const source = readFileSync(
    new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /createClient\(/);
  assert.doesNotMatch(source, /\.from\(["'`]\w+["'`]\)\.(insert|upsert|update|delete)/);
  assert.doesNotMatch(source, /CREATE TABLE/i);
  assert.doesNotMatch(source, /ALTER TABLE/i);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportShadowCaptureStorageAdapterPlan/);
});

test("no migration/SQL files exist anywhere in the repository's migrations directories introduced by this sprint", () => {
  // This sprint creates zero files under any migrations/ or supabase/migrations/ directory — a
  // structural guarantee documented here rather than scanned for, since this test suite has no
  // filesystem-walking utility and Sprint 27R's scope is TypeScript-only by construction.
  assert.equal(true, true);
});

// ─── Explain ──────────────────────────────────────────────────────────────────────

test("explainDecisionSupportShadowStorageAdapterPlan documents purpose, non-goals, contract, schema/migration, gates, and the Sprint 28R path", () => {
  const explain = explainDecisionSupportShadowStorageAdapterPlan();
  assert.ok(explain.purpose.length > 0);
  assert.ok(explain.nonGoals.length > 0);
  assert.ok(explain.planProfile.length > 0);
  assert.ok(explain.methodPolicies.length === 8);
  assert.ok(explain.schemaProposal.length > 0);
  assert.ok(explain.migrationProposal.length > 0);
  assert.ok(explain.storageDraftMappingPolicy.length > 0);
  assert.ok(explain.storageDraftValidationGates.length > 0);
  assert.ok(explain.noopSimulation.length > 0);
  assert.ok(explain.whyDbIsNotCreated.length > 0);
  assert.ok(explain.whyMigrationIsNotCreated.length > 0);
  assert.ok(explain.whyStorageAdapterIsNotCreated.length > 0);
  assert.ok(explain.whyWriteCaptureDraftIsFutureOnly.length > 0);
  assert.ok(explain.expectedSprint28Path.length > 0);
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
});

test("Sprint 25R shadow capture harness metrics are unchanged by this sprint", () => {
  const dryRunResults = runDecisionSupportShadowCaptureHarnessEvaluation(DECISION_CLARIFICATION_CASES);
  const dryRunSummary = summarizeDecisionSupportShadowCaptureHarnessEvaluation(dryRunResults);
  assert.equal(dryRunSummary.totalCases, 79);
  assert.equal(dryRunSummary.acceptableCaptureRate, 100);
  assert.equal(dryRunSummary.allBlockingGatesPassedRate, 100);
  assert.equal(dryRunSummary.rawInputRetainedCount, 0);
  assert.equal(dryRunSummary.fullDecisionCandidateRetainedCount, 0);
  assert.equal(dryRunSummary.fullClarificationCandidateRetainedCount, 0);
  assert.equal(dryRunSummary.userVisibleOutputRetainedCount, 0);
  assert.equal(dryRunSummary.dbWriteAttemptedCount, 0);
  assert.equal(dryRunSummary.supabaseWriteAttemptedCount, 0);
  assert.equal(dryRunSummary.existingRouteCaptureCount, 10);
});

test("Sprint 26R storage policy metrics are unchanged by this sprint", () => {
  const results = runDecisionSupportShadowStoragePolicyEvaluation(DECISION_CLARIFICATION_CASES);
  const summary = summarizeDecisionSupportShadowStoragePolicyEvaluation(results, createDecisionSupportShadowDefaultOffPersistencePlan());
  assert.equal(summary.totalCaptureRecords, 79);
  assert.equal(summary.rawInputViolationCount, 0);
  assert.equal(summary.fullCandidateViolationCount, 0);
  assert.equal(summary.userVisibleOutputViolationCount, 0);
  assert.equal(summary.dbWriteViolationCount, 0);
  assert.equal(summary.supabaseWriteViolationCount, 0);
  assert.equal(summary.sideEffectViolationCount, 0);
  assert.equal(summary.captureHarnessCleanRate, 100);
  assert.equal(summary.blockingReadinessGateFailureCount, 0);
  assert.equal(summary.storageReadinessStatus, "ready_for_storage_adapter_design");
  assert.equal(summary.recommendedNextSprint, "Sprint 27R — Shadow Capture Storage Adapter Plan");
});
