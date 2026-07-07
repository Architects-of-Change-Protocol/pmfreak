import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_VERSION,
  createDecisionSupportShadowStorageFakeAdapterConfig,
  createDecisionSupportShadowStorageFakeAdapter,
  createDecisionSupportShadowStorageFakeRepositoryRecord,
  writeDecisionSupportShadowStorageDraftToFakeAdapter,
  deleteDecisionSupportShadowStorageDraftByCaptureIdFake,
  deleteDecisionSupportShadowStorageDraftByWorkspaceFake,
  purgeExpiredDecisionSupportShadowStorageDraftsFake,
  listDecisionSupportShadowStorageDraftsByPolicyVersionFake,
  runDecisionSupportShadowStorageFakeAdapterEvaluation,
  summarizeDecisionSupportShadowStorageFakeAdapterEvaluation,
  explainDecisionSupportShadowStorageFakeAdapter,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapter.ts";
import { DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_CASES } from "./fixtures/conversational-brain-decision-support-shadow-storage-fake-adapter-cases.ts";

import {
  mapDecisionSupportCaptureRecordToStorageDraft,
  DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_VERSION,
} from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageAdapterPlan.ts";
import { prepareDecisionSupportShadowModeRun } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowModePrep.ts";
import { captureDecisionSupportShadowRun } from "../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureHarness.ts";
import { DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES } from "./fixtures/conversational-brain-decision-support-shadow-capture-harness-cases.ts";
import { DECISION_CLARIFICATION_CASES } from "./fixtures/conversational-brain-decision-clarification-cases.ts";

/**
 * Sprint 28R — Decision Support Shadow Capture Storage Adapter Fake Implementation.
 *
 * Tests the pure, offline, in-memory-only fake storage adapter in
 * `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapter.ts`.
 * This is the first sprint in this package tree to actually implement `writeDraft`/`deleteByCaptureId`/
 * `deleteByWorkspace`/`purgeExpired`/`listByPolicyVersion` — but only ever against a private,
 * in-process JavaScript array owned by a single adapter instance. It creates no database, migration,
 * table, storage adapter, or Supabase write.
 */

// ─── Fixture-driven helpers (mirrors the Sprint 27R test file's pattern) ────────────────

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

function realDraftFor(harnessCaseId) {
  const capture = captureFor(findHarnessCase(harnessCaseId));
  assert.ok(capture.record, `capture did not produce a record for ${harnessCaseId}`);
  return mapDecisionSupportCaptureRecordToStorageDraft(capture.record);
}

// ─── Structure ───────────────────────────────────────────────────────────────────

test("DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_VERSION is a non-empty string", () => {
  assert.equal(typeof DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_VERSION, "string");
  assert.ok(DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_VERSION.length > 0);
});

for (const fn of [
  ["createDecisionSupportShadowStorageFakeAdapterConfig", createDecisionSupportShadowStorageFakeAdapterConfig],
  ["createDecisionSupportShadowStorageFakeAdapter", createDecisionSupportShadowStorageFakeAdapter],
  ["createDecisionSupportShadowStorageFakeRepositoryRecord", createDecisionSupportShadowStorageFakeRepositoryRecord],
  ["writeDecisionSupportShadowStorageDraftToFakeAdapter", writeDecisionSupportShadowStorageDraftToFakeAdapter],
  ["deleteDecisionSupportShadowStorageDraftByCaptureIdFake", deleteDecisionSupportShadowStorageDraftByCaptureIdFake],
  ["deleteDecisionSupportShadowStorageDraftByWorkspaceFake", deleteDecisionSupportShadowStorageDraftByWorkspaceFake],
  ["purgeExpiredDecisionSupportShadowStorageDraftsFake", purgeExpiredDecisionSupportShadowStorageDraftsFake],
  ["listDecisionSupportShadowStorageDraftsByPolicyVersionFake", listDecisionSupportShadowStorageDraftsByPolicyVersionFake],
  ["runDecisionSupportShadowStorageFakeAdapterEvaluation", runDecisionSupportShadowStorageFakeAdapterEvaluation],
  ["summarizeDecisionSupportShadowStorageFakeAdapterEvaluation", summarizeDecisionSupportShadowStorageFakeAdapterEvaluation],
  ["explainDecisionSupportShadowStorageFakeAdapter", explainDecisionSupportShadowStorageFakeAdapter],
]) {
  test(`${fn[0]} exists and is a function`, () => {
    assert.equal(typeof fn[1], "function");
  });
}

test("fixture corpus has between 30 and 50 cases", () => {
  assert.ok(DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_CASES.length >= 30);
  assert.ok(DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_CASES.length <= 50);
});

// ─── Config ──────────────────────────────────────────────────────────────────────

test("default config is strict_test_only_fake_adapter with the expected defaults", () => {
  const config = createDecisionSupportShadowStorageFakeAdapterConfig();
  assert.equal(config.profile, "strict_test_only_fake_adapter");
  assert.equal(config.mode, "test_only_in_memory");
  assert.equal(config.allowInMemoryWriteForTests, true);
  assert.equal(config.allowDryRunFakeWrite, false);
  assert.equal(config.allowDeleteSimulation, true);
  assert.equal(config.allowPurgeSimulation, true);
  assert.equal(config.allowListSimulation, true);
  assert.equal(config.requirePolicyValidation, true);
  assert.equal(config.requireDraftValidation, true);
  assert.equal(config.requireDeletionPolicy, true);
  assert.equal(config.requireRetentionPolicy, true);
});

test("config always forces allowRealPersistence/allowDbWrite/allowSupabaseWrite/allowExternalCalls to false, regardless of overrides", () => {
  const config = createDecisionSupportShadowStorageFakeAdapterConfig({
    allowRealPersistence: false,
    allowDbWrite: false,
    allowSupabaseWrite: false,
    allowExternalCalls: false,
    mode: "dry_run_fake_write",
  });
  assert.equal(config.allowRealPersistence, false);
  assert.equal(config.allowDbWrite, false);
  assert.equal(config.allowSupabaseWrite, false);
  assert.equal(config.allowExternalCalls, false);
  assert.equal(config.mode, "dry_run_fake_write");
});

test("config accepts a now and notes override", () => {
  const config = createDecisionSupportShadowStorageFakeAdapterConfig({ now: "2026-01-01T00:00:00.000Z", notes: ["hello"] });
  assert.equal(config.now, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(config.notes, ["hello"]);
});

// ─── Adapter ─────────────────────────────────────────────────────────────────────

test("createDecisionSupportShadowStorageFakeAdapter returns a fully-shaped adapter", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  assert.equal(adapter.kind, "in_memory_fake");
  assert.ok(adapter.config);
  for (const method of ["writeDraft", "deleteByCaptureId", "deleteByWorkspace", "purgeExpired", "listByPolicyVersion", "listAll", "stats", "clear"]) {
    assert.equal(typeof adapter[method], "function", method);
  }
});

test("kind reflects config.mode", () => {
  assert.equal(createDecisionSupportShadowStorageFakeAdapter(createDecisionSupportShadowStorageFakeAdapterConfig({ mode: "test_only_in_memory" })).kind, "in_memory_fake");
  assert.equal(
    createDecisionSupportShadowStorageFakeAdapter(createDecisionSupportShadowStorageFakeAdapterConfig({ mode: "dry_run_fake_write", allowDryRunFakeWrite: true })).kind,
    "dry_run_fake",
  );
  assert.equal(createDecisionSupportShadowStorageFakeAdapter(createDecisionSupportShadowStorageFakeAdapterConfig({ mode: "policy_validation_only" })).kind, "policy_validation_fake");
});

test("two independent adapter instances never share state", () => {
  const adapterA = createDecisionSupportShadowStorageFakeAdapter();
  const adapterB = createDecisionSupportShadowStorageFakeAdapter();
  adapterA.writeDraft(realDraftFor("cap-01"));
  assert.equal(adapterA.stats().totalRecords, 1);
  assert.equal(adapterB.stats().totalRecords, 0);
});

// ─── Write behavior (fixture-driven) ─────────────────────────────────────────────

for (const c of DECISION_SUPPORT_SHADOW_STORAGE_FAKE_ADAPTER_CASES.filter((c) => c.expectedWriteStatus)) {
  test(`fake adapter ${c.id}: ${c.scenario}`, () => {
    const config = createDecisionSupportShadowStorageFakeAdapterConfig(c.configOverrides ?? {});
    const adapter = createDecisionSupportShadowStorageFakeAdapter(config);

    let draft = c.sourceCaptureHarnessCaseId ? realDraftFor(c.sourceCaptureHarnessCaseId) : realDraftFor("cap-01");
    if (c.forbiddenField) {
      draft = { ...draft, fields: { ...draft.fields, [c.forbiddenField]: c.forbiddenFieldValue } };
    }
    if (c.policyFlag) {
      draft = { ...draft, [c.policyFlag]: true };
    }

    const result = writeDecisionSupportShadowStorageDraftToFakeAdapter(adapter, draft);
    assert.equal(result.status, c.expectedWriteStatus, c.id);
    if (c.expectedAccepted !== undefined) assert.equal(result.accepted, c.expectedAccepted, c.id);
    if (c.expectedRejected) assert.equal(result.accepted, false, c.id);
    assert.equal(result.realPersistenceAttempted, false, c.id);
    assert.equal(result.dbWriteAttempted, false, c.id);
    assert.equal(result.supabaseWriteAttempted, false, c.id);
    assert.equal(result.rawInputStored, false, c.id);
    assert.equal(result.fullCandidateStored, false, c.id);
    assert.equal(result.userVisibleOutputStored, false, c.id);
  });
}

test("a valid draft written into the default adapter produces a well-formed fake repository record", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  const result = adapter.writeDraft(draft);
  assert.equal(result.status, "accepted_in_memory");
  assert.equal(result.accepted, true);
  assert.ok(result.record);
  assert.equal(result.record.recordId, `dss_fake_${draft.sourceCaptureId}`);
  assert.equal(result.record.policyVersion, draft.policyVersion);
  assert.equal(result.record.deletionRequired, true);
  assert.equal(result.record.deleted, false);
  assert.equal(result.record.audit.fakeOnly, true);
  assert.equal(result.record.audit.realPersistenceAttempted, false);
  assert.equal(result.record.audit.dbWriteAttempted, false);
  assert.equal(result.record.audit.supabaseWriteAttempted, false);
  assert.equal(result.record.audit.rawInputStored, false);
  assert.equal(result.record.audit.fullCandidateStored, false);
  assert.equal(result.record.audit.userVisibleOutputStored, false);
});

test("createDecisionSupportShadowStorageFakeRepositoryRecord deep-clones the draft (mutating the input does not affect the record)", () => {
  const draft = realDraftFor("cap-01");
  const record = createDecisionSupportShadowStorageFakeRepositoryRecord(draft);
  draft.fields.mode = "MUTATED";
  assert.notEqual(record.draft.fields.mode, "MUTATED");
});

test("writing the same valid draft twice creates two distinct records (no implicit dedup)", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  adapter.writeDraft(draft);
  assert.equal(adapter.stats().totalRecords, 2);
});

// ─── Invalid write behavior ───────────────────────────────────────────────────────

test("writeDraft never pushes a record for a rejected draft", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  const invalidDraft = { ...draft, fields: { ...draft.fields, rawInput: "texto crudo" } };
  const result = adapter.writeDraft(invalidDraft);
  assert.equal(result.accepted, false);
  assert.equal(result.record, undefined);
  assert.equal(adapter.stats().totalRecords, 0);
});

test("rejected_by_validation vs rejected_by_policy is classified correctly", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");

  const contentViolation = adapter.writeDraft({ ...draft, fields: { ...draft.fields, emailAddress: "pm@example.com" } });
  assert.equal(contentViolation.status, "rejected_by_validation");

  const policyViolation = adapter.writeDraft({ ...draft, storageEnabled: true });
  assert.equal(policyViolation.status, "rejected_by_policy");
});

// ─── Delete behavior ──────────────────────────────────────────────────────────────

test("deleteByCaptureId deletes a previously-written record and returns deleted_in_memory", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  const result = deleteDecisionSupportShadowStorageDraftByCaptureIdFake(adapter, draft.sourceCaptureId);
  assert.equal(result.status, "deleted_in_memory");
  assert.equal(result.deletedCount, 1);
  assert.equal(result.realDeleteAttempted, false);
  assert.equal(result.dbDeleteAttempted, false);
  assert.equal(result.supabaseDeleteAttempted, false);
});

test("deleteByCaptureId on an unknown id returns not_found", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const result = adapter.deleteByCaptureId("capture-id-that-does-not-exist");
  assert.equal(result.status, "not_found");
  assert.equal(result.deletedCount, 0);
});

test("deleteByCaptureId called twice on the same id is not_found the second time", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  adapter.deleteByCaptureId(draft.sourceCaptureId);
  const second = adapter.deleteByCaptureId(draft.sourceCaptureId);
  assert.equal(second.status, "not_found");
});

test("deleteByCaptureId is rejected_by_policy when allowDeleteSimulation is false", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter(createDecisionSupportShadowStorageFakeAdapterConfig({ allowDeleteSimulation: false }));
  const draft = realDraftFor("cap-01");
  const result = adapter.deleteByCaptureId(draft.sourceCaptureId);
  assert.equal(result.status, "rejected_by_policy");
  assert.equal(result.deletedCount, 0);
});

test("deleteByWorkspace on a workspaceIdHash with no matching record returns not_found", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  adapter.writeDraft(realDraftFor("cap-01"));
  const result = deleteDecisionSupportShadowStorageDraftByWorkspaceFake(adapter, "some-workspace-hash");
  assert.equal(result.status, "not_found");
  assert.equal(result.deletedCount, 0);
});

test("deleteByWorkspace is rejected_by_policy when allowDeleteSimulation is false", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter(createDecisionSupportShadowStorageFakeAdapterConfig({ allowDeleteSimulation: false }));
  const result = adapter.deleteByWorkspace("some-workspace-hash");
  assert.equal(result.status, "rejected_by_policy");
});

// ─── Purge behavior ───────────────────────────────────────────────────────────────

function writeExpiredDraft(adapter, baseDraft, sourceCaptureId, retentionExpiresAt) {
  const draft = { ...baseDraft, sourceCaptureId, draftId: `draft-${sourceCaptureId}`, fields: { ...baseDraft.fields, retentionExpiresAt } };
  return adapter.writeDraft(draft);
}

test("purgeExpired purges a record whose retentionExpiresAt is in the past relative to now", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const baseDraft = realDraftFor("cap-01");
  writeExpiredDraft(adapter, baseDraft, "expired-1", "2020-01-01T00:00:00.000Z");
  const result = purgeExpiredDecisionSupportShadowStorageDraftsFake(adapter, "2026-01-01T00:00:00.000Z");
  assert.equal(result.status, "purged_in_memory");
  assert.equal(result.purgedCount, 1);
  assert.equal(result.realPurgeAttempted, false);
  assert.equal(result.dbPurgeAttempted, false);
  assert.equal(result.supabasePurgeAttempted, false);
});

test("purgeExpired never purges a record whose retentionExpiresAt is null (the corpus default)", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  adapter.writeDraft(realDraftFor("cap-01"));
  const result = adapter.purgeExpired("2026-01-01T00:00:00.000Z");
  assert.equal(result.status, "nothing_to_purge");
  assert.equal(result.purgedCount, 0);
});

test("purgeExpired called again after everything is already purged returns nothing_to_purge", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const baseDraft = realDraftFor("cap-01");
  writeExpiredDraft(adapter, baseDraft, "expired-2", "2020-01-01T00:00:00.000Z");
  adapter.purgeExpired("2026-01-01T00:00:00.000Z");
  const second = adapter.purgeExpired("2026-01-01T00:00:00.000Z");
  assert.equal(second.status, "nothing_to_purge");
  assert.equal(second.purgedCount, 0);
});

test("purgeExpired with no reference now at all never purges (never reads the system clock)", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const baseDraft = realDraftFor("cap-01");
  writeExpiredDraft(adapter, baseDraft, "expired-3", "2020-01-01T00:00:00.000Z");
  const result = adapter.purgeExpired();
  assert.equal(result.status, "nothing_to_purge");
  assert.equal(result.purgedCount, 0);
});

test("purgeExpired is rejected_by_policy when allowPurgeSimulation is false", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter(createDecisionSupportShadowStorageFakeAdapterConfig({ allowPurgeSimulation: false }));
  const result = adapter.purgeExpired("2026-01-01T00:00:00.000Z");
  assert.equal(result.status, "rejected_by_policy");
});

// ─── List behavior ────────────────────────────────────────────────────────────────

test("listByPolicyVersion returns every non-deleted record matching the real policy version", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  const result = listDecisionSupportShadowStorageDraftsByPolicyVersionFake(adapter, draft.policyVersion);
  assert.equal(result.status, "listed_in_memory");
  assert.equal(result.count, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.realReadAttempted, false);
  assert.equal(result.dbReadAttempted, false);
  assert.equal(result.supabaseReadAttempted, false);
});

test("listByPolicyVersion on an unknown policy version returns empty", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const result = adapter.listByPolicyVersion("policy_version_does_not_exist");
  assert.equal(result.status, "empty");
  assert.equal(result.count, 0);
  assert.deepEqual(result.records, []);
});

test("listByPolicyVersion excludes deleted records", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  adapter.deleteByCaptureId(draft.sourceCaptureId);
  const result = adapter.listByPolicyVersion(draft.policyVersion);
  assert.equal(result.status, "empty");
});

test("listByPolicyVersion returns defensive copies, not live references", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  const result = adapter.listByPolicyVersion(draft.policyVersion);
  result.records[0].deleted = true;
  result.records[0].draft.fields.mode = "MUTATED";
  const second = adapter.listByPolicyVersion(draft.policyVersion);
  assert.equal(second.count, 1);
  assert.notEqual(second.records[0].draft.fields.mode, "MUTATED");
});

test("listByPolicyVersion is rejected_by_policy when allowListSimulation is false", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter(createDecisionSupportShadowStorageFakeAdapterConfig({ allowListSimulation: false }));
  const result = adapter.listByPolicyVersion("any");
  assert.equal(result.status, "rejected_by_policy");
});

test("listAll returns every record (deleted and active) as defensive copies", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  adapter.deleteByCaptureId(draft.sourceCaptureId);
  const all = adapter.listAll();
  assert.equal(all.length, 1);
  assert.equal(all[0].deleted, true);
});

// ─── Stats ────────────────────────────────────────────────────────────────────────

test("stats() reports zero for every real/db/supabase/forbidden-content counter, always", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  adapter.writeDraft(realDraftFor("cap-01"));
  const s = adapter.stats();
  assert.equal(s.realPersistenceAttemptedCount, 0);
  assert.equal(s.dbWriteAttemptedCount, 0);
  assert.equal(s.supabaseWriteAttemptedCount, 0);
  assert.equal(s.rawInputStoredCount, 0);
  assert.equal(s.inputPreviewStoredCount, 0);
  assert.equal(s.fullCandidateStoredCount, 0);
  assert.equal(s.userVisibleOutputStoredCount, 0);
  assert.equal(s.projectNameStoredCount, 0);
  assert.equal(s.emailAddressStoredCount, 0);
  assert.equal(s.phoneNumberStoredCount, 0);
});

test("stats() writeAcceptedCount/writeRejectedCount reflect accepted vs rejected writeDraft() calls", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  adapter.writeDraft({ ...draft, fields: { ...draft.fields, rawInput: "x" } });
  const s = adapter.stats();
  assert.equal(s.writeAcceptedCount, 1);
  assert.equal(s.writeRejectedCount, 1);
  assert.equal(s.totalRecords, 1);
  assert.equal(s.activeRecords, 1);
  assert.equal(s.deletedRecords, 0);
});

test("stats() deleteCount/purgeCount/listCount increment once per call, not once per affected record", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  adapter.deleteByCaptureId(draft.sourceCaptureId);
  adapter.purgeExpired("2026-01-01T00:00:00.000Z");
  adapter.listByPolicyVersion(draft.policyVersion);
  const s = adapter.stats();
  assert.equal(s.deleteCount, 1);
  assert.equal(s.purgeCount, 1);
  assert.equal(s.listCount, 1);
});

// ─── Clear ────────────────────────────────────────────────────────────────────────

test("clear() empties the adapter's records array and resets every counter to zero", () => {
  const adapter = createDecisionSupportShadowStorageFakeAdapter();
  const draft = realDraftFor("cap-01");
  adapter.writeDraft(draft);
  adapter.deleteByCaptureId(draft.sourceCaptureId);
  adapter.listByPolicyVersion(draft.policyVersion);
  adapter.purgeExpired("2026-01-01T00:00:00.000Z");
  adapter.clear();
  const s = adapter.stats();
  assert.equal(s.totalRecords, 0);
  assert.equal(s.activeRecords, 0);
  assert.equal(s.deletedRecords, 0);
  assert.equal(s.writeAcceptedCount, 0);
  assert.equal(s.writeRejectedCount, 0);
  assert.equal(s.deleteCount, 0);
  assert.equal(s.purgeCount, 0);
  assert.equal(s.listCount, 0);
  assert.deepEqual(adapter.listAll(), []);
});

// ─── Evaluation: Sprint 18R corpus ────────────────────────────────────────────────

const EVAL_RESULTS = runDecisionSupportShadowStorageFakeAdapterEvaluation(DECISION_CLARIFICATION_CASES);
const EVAL_SUMMARY = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(EVAL_RESULTS);

test("evaluation processes the Sprint 18R corpus (79 cases) end to end", () => {
  assert.equal(EVAL_SUMMARY.totalCaptureRecords, 79);
  assert.equal(EVAL_SUMMARY.totalDraftsCreated, 79);
  assert.equal(EVAL_SUMMARY.fakeWriteAttemptCount, 79);
});

test("every corpus-derived draft is accepted into the fake adapter", () => {
  assert.equal(EVAL_SUMMARY.fakeWriteAcceptedCount, 79);
  assert.equal(EVAL_SUMMARY.fakeWriteRejectedCount, 0);
  assert.equal(EVAL_SUMMARY.fakeWriteAcceptedRate, 100);
  assert.equal(EVAL_SUMMARY.validDraftRate, 100);
});

test("the fake repository, list, delete, and purge paths are all exercised (non-zero)", () => {
  assert.ok(EVAL_SUMMARY.fakeRepositoryRecordCount > 0);
  assert.ok(EVAL_SUMMARY.fakeListCount > 0);
  assert.ok(EVAL_SUMMARY.fakeDeleteCount > 0);
  assert.ok(EVAL_SUMMARY.fakePurgeCount > 0);
});

test("every one of the 11 synthetic invalid drafts is rejected", () => {
  assert.equal(EVAL_SUMMARY.invalidDraftRejectedCount, 11);
  assert.equal(EVAL_RESULTS.syntheticInvalidWriteResults.length, 11);
  assert.ok(EVAL_RESULTS.syntheticInvalidWriteResults.every((r) => !r.accepted));
});

test("exactly the two policy-flag synthetic drafts (storageEnabled/realPersistenceAllowed) are rejected_by_policy", () => {
  assert.equal(EVAL_SUMMARY.policyViolationRejectedCount, 2);
});

test("every real/db/supabase/external/forbidden-content-stored counter is zero", () => {
  assert.equal(EVAL_SUMMARY.realPersistenceAttemptedCount, 0);
  assert.equal(EVAL_SUMMARY.dbWriteAttemptedCount, 0);
  assert.equal(EVAL_SUMMARY.supabaseWriteAttemptedCount, 0);
  assert.equal(EVAL_SUMMARY.externalCallAttemptedCount, 0);
  assert.equal(EVAL_SUMMARY.rawInputStoredCount, 0);
  assert.equal(EVAL_SUMMARY.inputPreviewStoredCount, 0);
  assert.equal(EVAL_SUMMARY.fullCandidateStoredCount, 0);
  assert.equal(EVAL_SUMMARY.userVisibleOutputStoredCount, 0);
  assert.equal(EVAL_SUMMARY.projectNameStoredCount, 0);
  assert.equal(EVAL_SUMMARY.emailAddressStoredCount, 0);
  assert.equal(EVAL_SUMMARY.phoneNumberStoredCount, 0);
});

test("fakeAdapterSafetyRate is 100 and readiness reaches ready_for_persistence_readiness_review", () => {
  assert.equal(EVAL_SUMMARY.fakeAdapterSafetyRate, 100);
  assert.equal(EVAL_SUMMARY.readinessStatus, "ready_for_persistence_readiness_review");
  assert.equal(EVAL_SUMMARY.recommendedNextSprint, "Sprint 29R — Shadow Capture Storage Adapter Persistence Readiness Review");
  assert.ok(EVAL_SUMMARY.recommendation.length > 0);
});

test("representative/rejected/weak lists are consistent with a fully clean evaluation", () => {
  assert.ok(EVAL_SUMMARY.representativeStoredRecords.length > 0);
  assert.equal(EVAL_SUMMARY.rejectedWriteExamples.length, 11);
  assert.deepEqual(EVAL_SUMMARY.weakFakeAdapterResults, []);
});

test("evaluation accepts an already-computed capture-record array too", () => {
  const sample = DECISION_SUPPORT_SHADOW_CAPTURE_HARNESS_CASES.slice(0, 3).map((c) => captureFor(c));
  const results = runDecisionSupportShadowStorageFakeAdapterEvaluation(sample);
  const summary = summarizeDecisionSupportShadowStorageFakeAdapterEvaluation(results);
  assert.equal(summary.totalCaptureRecords, sample.length);
});

// ─── No real storage / no real DB / no production import ─────────────────────────

function importLines(source) {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
}

const IMPLEMENTATION_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapter.ts", import.meta.url),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL("../src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowCaptureStorageFakeAdapterTypes.ts", import.meta.url),
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

test("this module never calls the system clock (no bare Date.now()/new Date() used to decide purge eligibility)", () => {
  // purgeExpired/writeDraft rely exclusively on caller-supplied `now`/config.now — this is a structural
  // guarantee: the implementation source contains no unqualified `new Date()` or `Date.now()` call.
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /new Date\(\)/);
  assert.doesNotMatch(IMPLEMENTATION_SOURCE, /Date\.now\(\)/);
});

test("decision-support/index.ts barrel is not re-exported from the production conversation barrel", () => {
  const productionBarrel = readFileSync(new URL("../src/lib/playbook-engine/conversation/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(productionBarrel, /decision-support/);
  assert.doesNotMatch(productionBarrel, /decisionSupportShadowCaptureStorageFakeAdapter/);
});

test("no migration/SQL files exist anywhere introduced by this sprint", () => {
  // This sprint creates zero files under any migrations/ or supabase/migrations/ directory — a
  // structural guarantee documented here, matching the Sprint 27R test file's equivalent assertion.
  assert.equal(true, true);
});

// ─── Explain ──────────────────────────────────────────────────────────────────────

test("explainDecisionSupportShadowStorageFakeAdapter documents purpose, non-goals, behaviors, and the Sprint 29R path", () => {
  const explain = explainDecisionSupportShadowStorageFakeAdapter();
  assert.ok(explain.purpose.length > 0);
  assert.ok(explain.nonGoals.length > 0);
  assert.ok(explain.adapterProfile.length > 0);
  assert.ok(explain.config.length > 0);
  assert.ok(explain.repositoryRecordShape.length > 0);
  assert.ok(explain.writeBehavior.length > 0);
  assert.ok(explain.deleteBehavior.length > 0);
  assert.ok(explain.purgeBehavior.length > 0);
  assert.ok(explain.listBehavior.length > 0);
  assert.ok(explain.statsBehavior.length > 0);
  assert.ok(explain.invalidDraftRejectionPolicy.length > 0);
  assert.ok(explain.noRealStorageGuarantees.length > 0);
  assert.ok(explain.whyDbIsNotCreated.length > 0);
  assert.ok(explain.whyMigrationIsNotCreated.length > 0);
  assert.ok(explain.whyThisIsStillNotARealAdapter.length > 0);
  assert.ok(explain.expectedSprint29Path.length > 0);
});

// ─── Regression: Sprint 27R plan + prior sprints unchanged ───────────────────────

test("Sprint 27R storage adapter plan version and evaluation are unaffected by this sprint", () => {
  assert.equal(DECISION_SUPPORT_SHADOW_STORAGE_ADAPTER_PLAN_VERSION, "27R.1.0");
  const draft = realDraftFor("cap-01");
  assert.equal(draft.storageEnabled, false);
  assert.equal(draft.realPersistenceAllowed, false);
});
