/**
 * Release Gate 01 corrective regression: "Activate Brain" showing a
 * fabricated "network_error" for a viewer, with no distinct honest
 * permission-denial path and no retry idempotency.
 *
 * Investigation (see docs/audits/remediation/release-gate-01-brain-activation-honesty.md)
 * found three independent, real defects behind the single reported symptom:
 *
 *   1. create-project-wizard.tsx's handleActivate wrapped the
 *      saveProjectOnboarding Server Action call in a catch block that
 *      unconditionally reported ANY rejection as "A network error
 *      occurred" / failureDetail "network_error" — with no inspection of
 *      what was actually thrown. A genuine offline/DNS failure and an
 *      expired session mid-wizard (which middleware intercepts with a
 *      redirect the Server Action runtime can't parse, producing a thrown,
 *      non-network rejection) were indistinguishable to the user.
 *   2. save-project-onboarding.ts had NO role/permission gate on Project
 *      creation at all, while the PMO a brand-new project auto-creates
 *      (ensureDefaultPmo) WAS already gated to owner/admin/pm at the
 *      database (RLS) layer. A viewer creating the first project in a
 *      PMO-less workspace passed the (ungated) project path and then hit an
 *      unexplained RLS rejection creating the PMO underneath it — a real
 *      permission denial, flattened into the generic "unexpected_exception"
 *      bucket, never labeled as a permission problem.
 *   3. Retry was not idempotent — resubmission created a brand-new,
 *      independent Project row with no relationship to the original
 *      correlationId, so a lost success response followed by Retry could
 *      duplicate a Project + Brain.
 *
 * These tests exercise the real, unmodified production entry points
 * (canActivateProjectBrain, and source-level call-order/contract assertions
 * matching this file's own established static-analysis test style — see
 * tests/create-project-brain.test.mjs, tests/create-project-flow.test.mjs)
 * so they fail against the pre-fix behavior and pass after the correction.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const saveProject = readFileSync(join(ROOT, "src/lib/projects/save-project-onboarding.ts"), "utf8");
const wizard = readFileSync(join(ROOT, "src/components/pmfreak/projects/create-project-wizard.tsx"), "utf8");
const migration = readFileSync(join(ROOT, "supabase/migrations/20260901000000_project_onboarding_create_correlation_idempotency.sql"), "utf8");

const { canActivateProjectBrain } = await import("../src/lib/projects/project-brain-authorization.ts");

// ─────────────────────────────────────────────────────────────────────────────
// 1. canActivateProjectBrain — real invocation, the actual authorization
//    boundary. Mirrors the DB-level "workspace managers can manage pmos"
//    RLS policy (owner/admin/pm) so the two boundaries are consistent.
// ─────────────────────────────────────────────────────────────────────────────

test("canActivateProjectBrain denies viewer", () => {
  assert.equal(canActivateProjectBrain("viewer"), false);
});

test("canActivateProjectBrain denies missing/null role (fails closed)", () => {
  assert.equal(canActivateProjectBrain(null), false);
  assert.equal(canActivateProjectBrain(undefined), false);
});

test("canActivateProjectBrain allows owner, admin, and pm", () => {
  assert.equal(canActivateProjectBrain("owner"), true);
  assert.equal(canActivateProjectBrain("admin"), true);
  assert.equal(canActivateProjectBrain("pm"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. saveProjectOnboarding gates on permission BEFORE any PMO/project
//    mutation is attempted — not after, and not implicitly via an RLS
//    rejection surfacing as a generic error.
// ─────────────────────────────────────────────────────────────────────────────

test("saveProjectOnboarding checks canActivateProjectBrain before creating/attaching a PMO", () => {
  const permissionCheckIdx = saveProject.indexOf("canActivateProjectBrain(ensured.role)");
  const ensureDefaultPmoCallIdx = saveProject.indexOf("await ensureDefaultPmo(");
  const insertIdx = saveProject.indexOf('.from("projects")\n      .insert(');
  assert.ok(permissionCheckIdx > 0, "permission check must exist");
  assert.ok(ensureDefaultPmoCallIdx > permissionCheckIdx, "PMO creation must happen after the permission check");
  assert.ok(insertIdx > permissionCheckIdx, "project insert must happen after the permission check");
});

test("saveProjectOnboarding returns a distinct fatal_failure/insufficient_permissions result for an unauthorized role, not a generic error", () => {
  assert.match(saveProject, /failureClass: "insufficient_permissions"/);
  assert.match(saveProject, /status: "fatal_failure"[^}]*failureClass: "insufficient_permissions"|failureClass: "insufficient_permissions"[^}]*status: "fatal_failure"/s);
});

test("the permission-denial return does not carry a projectId (no partial success signal)", () => {
  const idx = saveProject.indexOf('failureClass: "insufficient_permissions"');
  const blockStart = saveProject.lastIndexOf("return {", idx);
  const blockEnd = saveProject.indexOf("};", idx);
  const block = saveProject.slice(blockStart, blockEnd);
  assert.ok(!block.includes("projectId"), "permission-denial result must not include projectId");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rollback-failure honesty: the returned message must not claim the
//    project was removed when the compensating delete itself failed.
// ─────────────────────────────────────────────────────────────────────────────

test("rollback failure path no longer unconditionally claims the project was removed", () => {
  const rollbackSucceededIdx = saveProject.indexOf("let rollbackSucceeded = false");
  assert.ok(rollbackSucceededIdx > 0, "rollback outcome must be tracked, not assumed");
  const setTrueIdx = saveProject.indexOf("rollbackSucceeded = true", rollbackSucceededIdx);
  assert.ok(setTrueIdx > rollbackSucceededIdx, "rollbackSucceeded must only be set true on a confirmed successful delete");
  assert.match(saveProject, /error: rollbackSucceeded\s*\?/, "the returned error message must branch on whether rollback actually succeeded");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Retry idempotency: a correlation id is persisted with the project row
//    and a unique-violation on retry resolves to the existing row instead
//    of erroring or creating a duplicate.
// ─────────────────────────────────────────────────────────────────────────────

test("migration adds a per-workspace unique constraint on create_correlation_id", () => {
  assert.match(migration, /add column if not exists create_correlation_id/);
  assert.match(migration, /create unique index if not exists projects_workspace_create_correlation_unique/);
  assert.match(migration, /on public\.projects \(workspace_id, create_correlation_id\)/);
  assert.match(migration, /where create_correlation_id is not null/);
});

test("saveProjectOnboarding writes the correlation id on insert and handles the unique-violation retry path", () => {
  assert.match(saveProject, /create_correlation_id: cid/);
  assert.match(saveProject, /UNIQUE_VIOLATION/);
  assert.match(saveProject, /error\?\.code === UNIQUE_VIOLATION/);
});

test("the idempotent-replay path returns success with the pre-existing project, not a fresh insert", () => {
  const violationIdx = saveProject.indexOf("error?.code === UNIQUE_VIOLATION");
  assert.ok(violationIdx > 0);
  const replayBlock = saveProject.slice(violationIdx, violationIdx + 1200);
  assert.match(replayBlock, /status: "success", projectId: existing\.id/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Client-side error classification: any Server Action rejection must not
//    be unconditionally reported as "network_error".
// ─────────────────────────────────────────────────────────────────────────────

test("wizard's activation catch block distinguishes a genuine transport failure from any other rejection", () => {
  const catchIdx = wizard.indexOf("} catch (err) {");
  assert.ok(catchIdx > 0, "catch block must inspect the thrown error, not use a bare catch {}");
  const catchBlock = wizard.slice(catchIdx, wizard.indexOf("activationInFlightRef.current = false;", catchIdx));
  assert.match(catchBlock, /err instanceof TypeError/, "must distinguish a real TypeError (fetch failure) from other rejections");
  assert.match(catchBlock, /action_transport_error/, "must classify non-network rejections distinctly from network_error");
});

test("wizard no longer unconditionally labels every activation rejection as network_error", () => {
  const catchIdx = wizard.indexOf("} catch (err) {");
  const catchBlock = wizard.slice(catchIdx, wizard.indexOf("return;", catchIdx));
  assert.match(catchBlock, /isGenuineNetworkFailure\s*\?/, "the network_error label must be conditional, not hardcoded");
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. UI never presents an apparently-actionable Activate Brain button to a
//    role that the server will always reject.
// ─────────────────────────────────────────────────────────────────────────────

test("StepBrainActivation renders a permission-denied state instead of the activation form when canActivateBrain is false", () => {
  const fnIdx = wizard.indexOf("function StepBrainActivation");
  assert.ok(fnIdx > 0);
  const fnBody = wizard.slice(fnIdx, wizard.indexOf("function CreateProjectWizard", fnIdx));
  assert.match(fnBody, /if \(!canActivateBrain\)/);
  assert.match(fnBody, /have permission to activate a Project Brain/i);
  // The permission-denied branch must not render the actionable Activate button.
  const gateIdx = fnBody.indexOf("if (!canActivateBrain)");
  const gateReturnEnd = fnBody.indexOf("return (", gateIdx);
  const gateBlockEnd = fnBody.indexOf("\n  }", gateReturnEnd);
  const gateBlock = fnBody.slice(gateIdx, gateBlockEnd);
  assert.ok(!gateBlock.includes("Activate Project Brain →"), "permission-denied branch must not render the actionable button");
});

test("handleActivate refuses to submit when canActivateBrain is false, even if called directly", () => {
  const idx = wizard.indexOf("const handleActivate = async () => {");
  const guardLine = wizard.slice(idx, wizard.indexOf("\n", idx + 400));
  assert.match(wizard.slice(idx, idx + 400), /!canActivateBrain/, `handleActivate's early-return guard must include !canActivateBrain: ${guardLine}`);
});

test("page.tsx resolves the real workspace role and passes canActivateBrain to the wizard, without a second independent getUser() call", () => {
  const page = readFileSync(join(ROOT, "src/app/(protected)/projects/new/page.tsx"), "utf8");
  assert.match(page, /assertRuntimeAuthContinuity\(\)/);
  assert.match(page, /canActivateProjectBrain\(/);
  assert.match(page, /canActivateBrain=\{canActivateBrain\}/);
  // Must NOT call getAuthUser()/requireAuthUser() again — assertRuntimeAuthContinuity()
  // (no injected deps) is the one, request-memoized real auth call.
  assert.doesNotMatch(page, /\brequireAuthUser\(/);
  assert.doesNotMatch(page, /\bgetAuthUser\(/);
});

test("assertRuntimeAuthContinuity's real (no-args) call path is memoized per request via React cache()", () => {
  const continuity = readFileSync(join(ROOT, "src/lib/auth/runtime-auth-continuity.ts"), "utf8");
  assert.match(continuity, /import \{ cache \} from "react"/);
  assert.match(continuity, /cache\(\(\): Promise<RuntimeAuthContinuityReport> =>/);
});
