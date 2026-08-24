/**
 * P2-15 — governance, audit and release readiness gate.
 *
 * Behavioural coverage for the conflict vocabulary (real logic, executed), plus the
 * structural facts that the release/compliance gates depend on. The RUNTIME proof for the
 * gates themselves is running them: `npm run compliance:artifacts:drift`,
 * `npm run check:ci-workflow-integrity`, `npm run check:beta-release`. Source reading
 * supplements those; it never replaces them.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GENERIC_OPERATIONAL_FLOW_CONFLICT,
  OPERATIONAL_FLOW_CONFLICTS,
  resolveOperationalFlowConflict,
} from "../src/lib/operational-flow/conflict-contract";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const route = read("src/app/api/operational-flow/route.ts");
const clientData = read("src/modules/workspace/presentation/command-center/operational-data.ts");
const intakePanel = read("src/modules/workspace/presentation/command-center/vault-intake-panel.tsx");
const attemptStore = read("src/modules/workspace/presentation/command-center/submission-attempt.ts");
const packageJson = JSON.parse(read("package.json"));
const releaseWorkflow = read(".github/workflows/release-governance.yml");
const ipComplianceWorkflow = read(".github/workflows/ip-compliance.yml");

// ─────────────────────── conflict vocabulary (executed logic) ───────────────────────

test("P2-15: an Evidence quality conflict resolves to a stable, non-leaking contract", () => {
  const resolved = resolveOperationalFlowConflict("derive_operational_evidence: evidence_idempotency_conflict");
  assert.ok(resolved, "the canonical raise must be recognised");
  assert.equal(resolved.code, "evidence_quality_conflict");
  assert.equal(resolved.recovery, "reload_recorded_assertion");

  // The message must be safe to render: no RPC name, no table/column, no driver text.
  for (const leak of [
    /derive_operational_evidence/,
    /evidence_items/,
    /idempotency_conflict/,
    /postgres|pg_|sql|constraint|relation/i,
  ]) {
    assert.ok(!leak.test(resolved.message), `client message must not contain ${leak}`);
  }
  // And it must say what actually happened and what to do next.
  assert.match(resolved.message, /immutable|already recorded/i);
  assert.match(resolved.message, /reload/i);
});

test("P2-15: intake content conflicts are distinguished from quality conflicts", () => {
  const intake = resolveOperationalFlowConflict("capture_live_operational_input: intake_idempotency_conflict");
  assert.equal(intake?.code, "intake_content_conflict");
  assert.notEqual(intake?.code, OPERATIONAL_FLOW_CONFLICTS.evidence_idempotency_conflict.code);
});

test("P2-15: an unnamed idempotency conflict still gets a stable answer, never raw text", () => {
  const resolved = resolveOperationalFlowConflict("some_future_rpc: widget_idempotency_conflict");
  assert.equal(resolved?.code, GENERIC_OPERATIONAL_FLOW_CONFLICT.code);
  assert.ok(!resolved?.message.includes("widget_idempotency_conflict"));
});

test("P2-15: conflict matching is ANCHORED, so an unrelated error is not mis-reported as 409", () => {
  // The route already learned this lesson with `*_unauthenticated`: a bare substring test
  // reports an unrelated driver fault as the wrong status AND echoes its text.
  assert.equal(resolveOperationalFlowConflict("connection reset by peer"), null);
  assert.equal(resolveOperationalFlowConflict("evidence_access_denied"), null);
  assert.equal(resolveOperationalFlowConflict("normalized_event_not_found_or_scope_mismatch"), null);
  // A word that merely CONTAINS a code must not match it.
  assert.equal(resolveOperationalFlowConflict("xevidence_idempotency_conflicty"), null);
});

test("P2-15: every declared conflict contract is renderable and actionable", () => {
  for (const [signal, contract] of Object.entries(OPERATIONAL_FLOW_CONFLICTS)) {
    assert.match(contract.code, /^[a-z][a-z0-9_]*$/, `${signal}: code must be a stable slug`);
    assert.ok(contract.message.length > 40, `${signal}: message must actually explain`);
    assert.ok(!contract.message.includes(signal), `${signal}: must not echo the raw signal`);
    assert.match(contract.recovery, /^[a-z][a-z0-9_]*$/, `${signal}: recovery must be machine-readable`);
  }
});

// ─────────────────────────── route / client / surface wiring ───────────────────────────

test("P2-15: the route answers a conflict with 409 and the stable envelope, not driver text", () => {
  assert.match(route, /const conflict = resolveOperationalFlowConflict\(message\);/);
  assert.match(route, /disposition: "conflict", code: conflict\.code, error: conflict\.message, recovery: conflict\.recovery, referenceId/);
  assert.match(route, /\{ status: 409 \}/);
  // The real error goes to the log, correlated by the same reference id the caller was given.
  assert.match(route, /logger\.warn\("operational_flow_conflict", \{[\s\S]{0,240}error_detail: safeErrorMessage\(error\)/);
  assert.match(route, /reference_id: referenceId/);
  // The old raw path is gone: a conflict must not reach the generic `{ error: message }`.
  assert.ok(
    !/const status = \/idempotency_conflict\/\.test\(message\) \? 409/.test(route),
    "conflicts must no longer fall through to the raw-message responder"
  );
});

test("P2-15: the client preserves the stable code and support reference", () => {
  assert.match(clientData, /export class OperationalFlowRequestError extends Error/);
  for (const field of ["code", "recovery", "referenceId", "status"]) {
    assert.ok(new RegExp(`readonly ${field}`).test(clientData), `${field} must survive the boundary`);
  }
  assert.match(clientData, /throw new OperationalFlowRequestError\(/);
  // Scoped to the canonical operational-flow boundary. Other helpers in this module post to
  // different routes that do not speak the conflict envelope, and are out of P2-15 scope.
  const boundary = clientData.slice(
    clientData.indexOf("export async function postOperationalFlow"),
    clientData.indexOf("export async function captureAndDeriveDemoEvidence")
  );
  assert.ok(boundary.length > 0, "the operational-flow boundary must be locatable");
  assert.ok(
    !/throw new Error\(/.test(boundary),
    "the boundary must not collapse the envelope back into a bare Error"
  );
});

test("P2-15: a conflict does NOT auto-retire the attempt or resubmit", () => {
  // Option A was ratified: the recorded assertion is immutable and a changed quality
  // judgement is refused, not coerced, not replayed, and not minted as a second assertion.
  // Any automatic recovery here would manufacture exactly the duplicates that ruled out B.
  const submitBody = intakePanel.slice(intakePanel.indexOf("const submit = async ()"), intakePanel.indexOf("return ("));
  const catchBody = submitBody.slice(submitBody.indexOf("} catch (caught) {"));
  assert.ok(!/clearSubmissionAttempt/.test(catchBody), "a failed attempt must not be retired in the catch");
  assert.ok(!/captureAndDerive/.test(catchBody), "nothing may be resubmitted automatically");
  // Success still retires it, so the next deliberate capture is its own submission.
  assert.match(submitBody, /clearSubmissionAttempt\(attemptKey\);/);
  // The support reference is surfaced rather than swallowed.
  assert.match(catchBody, /caught\.referenceId/);
});

test("P2-15: the intake attempt key is unchanged — quality is NOT folded into it", () => {
  // Folding quality in would change `attemptId`, hence `live-capture:${submissionId}`, and
  // append a second Raw Input and Normalized Event for one human submission — reopening the
  // duplicate-on-retry seam P2-14 closed.
  assert.match(attemptStore, /export function intakeAttemptKey\(\s*workspaceId: string,\s*projectId: string,\s*mode: string,\s*contentDigest: string\s*\)/);
  const body = attemptStore.slice(attemptStore.indexOf("export function intakeAttemptKey"));
  const returnLine = body.slice(0, body.indexOf("\n}"));
  for (const quality of ["assertionType", "classification", "confidence", "missingData"]) {
    assert.ok(!new RegExp(quality, "i").test(returnLine), `intakeAttemptKey must not include ${quality}`);
  }
  assert.match(intakePanel, /intakeAttemptKey\(workspaceId, projectId, mode, await sha256Hex\(content\.trim\(\)\)\)/);
});

// ─────────────────────────────── release / compliance gates ───────────────────────────────

test("P2-15: the beta release gate is wired into CI and holds no write authority", () => {
  assert.match(releaseWorkflow, /beta-release-validation:/);
  assert.match(releaseWorkflow, /run: npm run check:beta-release/);
  // A gate that only runs after merge cannot block a merge.
  assert.match(releaseWorkflow, /^on:[\s\S]*?^ {2}pull_request:/m);
  // Severity belongs to the orchestrator, not to YAML. Comments are stripped first, so
  // prose ABOUT masking (the workflow explains why it does not mask) cannot trip this.
  const executable = releaseWorkflow
    .split("\n")
    .map((line) => line.replace(/(^|\s)#.*$/, ""))
    .join("\n");
  assert.ok(!/\|\|\s*true/.test(executable), "no masked failure");
  assert.ok(!/continue-on-error:\s*true/.test(executable), "no swallowed failure");
});

test("P2-15: publication authority is unreachable from a pull request", () => {
  const releaseJob = releaseWorkflow.slice(releaseWorkflow.indexOf("\n  release:"));
  assert.match(releaseJob, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(releaseJob, /needs: beta-release-validation/);
  assert.match(releaseJob, /contents: write/);
  // The validation job must not carry any write scope.
  const validationJob = releaseWorkflow.slice(
    releaseWorkflow.indexOf("  beta-release-validation:"),
    releaseWorkflow.indexOf("\n  release:")
  );
  assert.ok(!/\bwrite\b/.test(validationJob), "validation must request no write permission");
});

test("P2-15: the ip-compliance workflow can actually parse and run a job", () => {
  // The defect: `timeout-minutes` at workflow level is not a valid key there, so GitHub
  // refused the file and all 168 runs failed in 0s with zero jobs.
  const topLevel = ipComplianceWorkflow.split("\n").filter((line) => /^[A-Za-z_][\w-]*:/.test(line)).map((line) => line.split(":")[0]);
  assert.ok(!topLevel.includes("timeout-minutes"), "timeout-minutes must not be a workflow-level key");
  assert.deepEqual(
    topLevel.filter((key) => !["name", "run-name", "on", "permissions", "env", "defaults", "concurrency", "jobs"].includes(key)),
    [],
    "every workflow-level key must be one GitHub accepts"
  );
  assert.match(ipComplianceWorkflow, /^ {4}timeout-minutes: 20$/m);
  // The impossible byte-comparison must not come back.
  assert.ok(
    !/git diff --exit-code[^\n]*artifacts\/compliance/.test(ipComplianceWorkflow),
    "byte-drift comparison can never pass and must stay replaced by the semantic gate"
  );
});

test("P2-15: both new gates are wired into existing gate chains, not left orphaned", () => {
  const scripts = packageJson.scripts;
  assert.equal(scripts["compliance:artifacts:drift"], "node scripts/compliance/check-compliance-artifact-drift.mjs");
  assert.equal(scripts["check:ci-workflow-integrity"], "node scripts/check-ci-workflow-integrity.mjs");
  assert.match(scripts["check:governance"], /check:ci-workflow-integrity/);

  // The drift gate must run BEFORE the generators it is auditing, or it compares a fresh
  // generation against a fresh generation and passes trivially.
  const compliance = scripts["compliance:check"];
  assert.ok(
    compliance.indexOf("compliance:artifacts:drift") < compliance.indexOf("compliance:licenses:generate"),
    "the drift gate must precede regeneration inside compliance:check"
  );
});
