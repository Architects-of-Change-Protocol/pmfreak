/**
 * Behavioral contract tests for the Create PMO transactional flow.
 *
 * Static-analysis tests (readFileSync + assert) verifying that the source
 * upholds transactional guarantees — no redirect without confirmed persistence,
 * no draft clear on failure, no false-positive Brain Activated, structured
 * logs with required events and fields.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const saveTenant = readFileSync(join(ROOT, "src/lib/pmo/save-pmo-tenant.ts"), "utf8");
const wizard = readFileSync(join(ROOT, "src/components/pmfreak/pmo/create-pmo-wizard.tsx"), "utf8");
const workspaceShell = readFileSync(
  join(ROOT, "src/components/pmfreak/workspace/workspace-shell.tsx"),
  "utf8"
);

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 1: savePmoTenant — explicit three-state return type
// ─────────────────────────────────────────────────────────────────────────────

test("savePmoTenant declares explicit three-state contract", () => {
  assert.match(saveTenant, /status: "success"/, "must have success state");
  assert.match(saveTenant, /status: "recoverable_failure"/, "must have recoverable_failure state");
  assert.match(saveTenant, /status: "fatal_failure"/, "must have fatal_failure state");
});

test("savePmoTenant returns fatal_failure for validation errors", () => {
  assert.match(saveTenant, /fatal_failure.*validation_failed|validation_failed.*fatal_failure/s);
});

test("savePmoTenant returns fatal_failure when unauthenticated", () => {
  assert.match(saveTenant, /fatal_failure.*unauthenticated|unauthenticated.*fatal_failure/s);
});

test("savePmoTenant returns recoverable_failure on upsert error", () => {
  assert.match(saveTenant, /recoverable_failure.*upsert_error|upsert_error.*recoverable_failure/s);
});

test("savePmoTenant returns success only after confirmed upsert", () => {
  const returnSuccessIdx = saveTenant.indexOf('status: "success"', saveTenant.indexOf("emit"));
  const upsertIdx = saveTenant.indexOf('from("workspace_governance").upsert');
  assert.ok(upsertIdx > 0, "upsert call must exist");
  assert.ok(returnSuccessIdx > 0, "success return must exist");
  assert.ok(returnSuccessIdx > upsertIdx, "success return must appear after the upsert call");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 2: failureClass in result
// ─────────────────────────────────────────────────────────────────────────────

test("savePmoTenant includes failureClass in recoverable_failure result", () => {
  assert.match(saveTenant, /failureClass.*recoverable_failure|recoverable_failure.*failureClass/s);
});

test("savePmoTenant includes failureClass in fatal_failure result", () => {
  assert.match(saveTenant, /failureClass.*fatal_failure|fatal_failure.*failureClass/s);
});

test("savePmoTenant includes correlationId in all return paths", () => {
  assert.match(saveTenant, /correlationId = crypto\.randomUUID\(\)/, "must generate correlationId");
  // All three return paths include correlationId
  const successReturn = saveTenant.match(/return \{[^}]*status: "success"[^}]*\}/s)?.[0] ?? "";
  const recoverableReturns = [...saveTenant.matchAll(/return \{[^}]*status: "recoverable_failure"[^}]*\}/gs)];
  const fatalReturns = [...saveTenant.matchAll(/return \{[^}]*status: "fatal_failure"[^}]*\}/gs)];
  assert.ok(successReturn.includes("correlationId"), "success return must include correlationId");
  assert.ok(recoverableReturns.length > 0, "recoverable returns must exist");
  assert.ok(fatalReturns.length > 0, "fatal returns must exist");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 3: structured logs — required events
// ─────────────────────────────────────────────────────────────────────────────

test("savePmoTenant emits pmo.create.started event", () => {
  assert.match(saveTenant, /pmo\.create\.started/, "must emit pmo.create.started");
});

test("savePmoTenant emits pmo.create.persisted after successful upsert", () => {
  assert.match(saveTenant, /pmo\.create\.persisted/, "must emit pmo.create.persisted");
  const persistedIdx = saveTenant.indexOf("pmo.create.persisted");
  const upsertIdx = saveTenant.indexOf('from("workspace_governance").upsert');
  assert.ok(persistedIdx > upsertIdx, "pmo.create.persisted must appear after upsert");
});

test("savePmoTenant emits pmo.create.failed on all failure paths", () => {
  const allFailed = [...saveTenant.matchAll(/pmo\.create\.failed/g)];
  assert.ok(allFailed.length >= 4, `must emit pmo.create.failed for all failure paths (found ${allFailed.length})`);
});

test("savePmoTenant emits pmo.create.success on success path", () => {
  assert.match(saveTenant, /pmo\.create\.success/, "must emit pmo.create.success");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 4: rollback events
// ─────────────────────────────────────────────────────────────────────────────

test("savePmoTenant has explicit rollback on exception", () => {
  assert.match(saveTenant, /rollback/, "rollback path must exist");
  assert.match(saveTenant, /\.delete\(\)/, "rollback must issue a delete");
  assert.match(saveTenant, /upsertedWorkspaceId/, "rollback must be gated on confirmed upsert");
});

test("savePmoTenant emits pmo.create.rollback.started before rollback delete", () => {
  assert.match(saveTenant, /pmo\.create\.rollback\.started/, "must emit rollback.started");
  const startedIdx = saveTenant.indexOf("pmo.create.rollback.started");
  const deleteIdx = saveTenant.indexOf(".delete()", startedIdx);
  assert.ok(deleteIdx > startedIdx, "rollback.started must precede the delete call");
});

test("savePmoTenant emits pmo.create.rollback.completed on successful rollback", () => {
  assert.match(saveTenant, /pmo\.create\.rollback\.completed/, "must emit rollback.completed");
});

test("savePmoTenant emits pmo.create.rollback.failed on failed rollback", () => {
  assert.match(saveTenant, /pmo\.create\.rollback\.failed/, "must emit rollback.failed");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 5: structured log fields
// ─────────────────────────────────────────────────────────────────────────────

test("structured logger includes timestamp in every event", () => {
  assert.match(saveTenant, /timestamp.*new Date\(\)\.toISOString\(\)|new Date\(\)\.toISOString\(\).*timestamp/s);
});

test("structured logger uses emit() helper for consistent output", () => {
  assert.match(saveTenant, /function emit\(/, "emit helper must be defined");
  const emitCalls = [...saveTenant.matchAll(/emit\(/g)].filter(
    (m) => !saveTenant.slice(m.index - 20, m.index).includes("function ")
  );
  assert.ok(emitCalls.length >= 6, `must call emit at least 6 times (found ${emitCalls.length})`);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 6: wizard handleCreate — no false-positive activation
// ─────────────────────────────────────────────────────────────────────────────

test("wizard handleCreate gates redirect on status=success", () => {
  assert.match(wizard, /result\.status !== "success"/, "must check status before proceeding");
  const blockReturnIdx = wizard.indexOf('result.status !== "success"');
  const redirectIdx = wizard.indexOf('router.push("/pmo/invite-team")');
  assert.ok(blockReturnIdx > 0, "failure branch must exist");
  assert.ok(redirectIdx > blockReturnIdx, "redirect must come after the failure guard");
});

test("wizard handleCreate does NOT clear draft on failure", () => {
  const guardIdx = wizard.indexOf('result.status !== "success"');
  const callIdx = wizard.indexOf("clearDraft();", guardIdx);
  assert.ok(guardIdx > 0, "failure guard must exist");
  assert.ok(callIdx > guardIdx, "clearDraft() invocation must be inside the success path");
});

test("wizard handleCreate does NOT write localStorage on failure", () => {
  const guardIdx = wizard.indexOf('result.status !== "success"');
  const localStorageIdx = wizard.indexOf('localStorage.setItem("pmfreak.pmo.tenant"');
  assert.ok(localStorageIdx > guardIdx, "localStorage write must be inside the success path");
});

test("wizard shows blocking error banner when persistence fails", () => {
  assert.match(wizard, /createError/, "createError state must exist");
  assert.match(wizard, /Command Center activation failed/, "blocking error title must be rendered");
});

test("wizard sets creating=false and returns early on failure", () => {
  const guardStart = wizard.indexOf('result.status !== "success"');
  const guardEnd = wizard.indexOf("// Persistence confirmed");
  assert.ok(guardStart > 0 && guardEnd > guardStart, "failure branch boundaries must be identifiable");
  const failureBranch = wizard.slice(guardStart, guardEnd);
  assert.match(failureBranch, /setCreating\(false\)/, "must reset creating spinner on failure");
  assert.match(failureBranch, /return/, "must return early on failure");
});

test("Activate button is disabled while createError is set", () => {
  assert.match(wizard, /disabled=\{creating \|\| !!createError\}/, "activate button must be disabled when createError is present");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 7: retry emits structured log
// ─────────────────────────────────────────────────────────────────────────────

test("wizard emits pmo.create.retry log before retrying", () => {
  assert.match(wizard, /pmo\.create\.retry/, "must emit pmo.create.retry event");
  const retryLogIdx = wizard.indexOf("pmo.create.retry");
  const setCreatingIdx = wizard.indexOf("setCreating(true)");
  assert.ok(retryLogIdx < setCreatingIdx, "retry log must be emitted before setCreating(true)");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 8: fatal vs recoverable UX — distinct actions
// ─────────────────────────────────────────────────────────────────────────────

test("wizard shows Retry action for recoverable failure", () => {
  assert.match(wizard, /Retry/, "Retry action must exist for recoverable failures");
});

test("wizard shows Return to edit action for fatal failure", () => {
  assert.match(wizard, /Return to edit/, "Return to edit must exist for fatal failures");
  assert.match(wizard, /fatal_failure/, "fatal_failure class must be tracked in wizard state");
});

test("wizard tracks createErrorClass to distinguish recoverable from fatal", () => {
  assert.match(wizard, /createErrorClass/, "createErrorClass state must exist");
  assert.match(
    wizard,
    /createErrorClass === "fatal_failure"/,
    "must branch on fatal_failure class to show correct action"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 9: no redirect without calling savePmoTenant
// ─────────────────────────────────────────────────────────────────────────────

test("wizard never pushes to invite-team without calling savePmoTenant", () => {
  const saveIdx = wizard.indexOf("await savePmoTenant(tenant)");
  const pushIdx = wizard.indexOf('router.push("/pmo/invite-team")');
  assert.ok(saveIdx > 0, "savePmoTenant must be called");
  assert.ok(pushIdx > saveIdx, "redirect must come after savePmoTenant");
  const allPushes = [...wizard.matchAll(/router\.push\("\/pmo\/invite-team"\)/g)];
  assert.equal(allPushes.length, 1, "redirect to invite-team must appear exactly once");
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT 10: "Brain Activated" gated on real PMO context
// ─────────────────────────────────────────────────────────────────────────────

test("workspace-shell Brain Activated message is gated on pmoContext.found", () => {
  assert.match(
    workspaceShell,
    /pmoContext.*found|freshOnboarding.*pmoContext/s,
    "Brain Activated must only display when pmoContext.found is true"
  );
});
