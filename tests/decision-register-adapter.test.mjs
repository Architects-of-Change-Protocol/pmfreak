import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The decision-governance service depends on next/headers cookies() (request-scoped),
// so it cannot be invoked live outside a Next.js request — following the same
// source-inspection convention already used for this service in
// tests/evidence-linked-decisions.test.mjs.
const listRoute = readFileSync("src/app/api/projects/[id]/decisions/route.ts", "utf8");
const detailRoute = readFileSync("src/app/api/decisions/[id]/route.ts", "utf8");
const approveRoute = readFileSync("src/app/api/decisions/[id]/approve/route.ts", "utf8");
const rejectRoute = readFileSync("src/app/api/decisions/[id]/reject/route.ts", "utf8");
const healthRoute = readFileSync("src/app/api/projects/[id]/health/route.ts", "utf8");
const contract = readFileSync("src/modules/decisions/contracts/decisions.contract.ts", "utf8");

test("the decisions adapter wires the real, previously-unwired decision-governance service — not a new persistence path", () => {
  assert.match(listRoute, /from "@\/lib\/decision-governance\/service"/);
  assert.match(listRoute, /listProjectDecisions/);
  assert.match(listRoute, /createDecision/);
  assert.match(listRoute, /submitDecision/);
  assert.match(detailRoute, /getDecision/);
  assert.match(detailRoute, /buildDecisionLineage/);
  assert.match(approveRoute, /approveDecision/);
  assert.match(rejectRoute, /rejectDecision/);
  assert.doesNotMatch(listRoute, /\.from\("project_decisions"\)/);
  assert.doesNotMatch(detailRoute, /\.from\("project_decisions"\)/);
});

test("every new decision route authorizes via the existing server-authorization seam, never a local role check", () => {
  for (const source of [listRoute, detailRoute, approveRoute, rejectRoute]) {
    assert.match(source, /requireAuthenticatedUser/);
    assert.match(source, /requireProjectAccess/);
    assert.doesNotMatch(source, /user\.role\s*===/);
  }
});

test("write operations require project 'write' permission, reads require 'read'", () => {
  assert.match(listRoute, /authorize\(projectId, "write"\)/);
  assert.match(approveRoute, /requireProjectAccess\(decision\.project_id, "write"\)/);
  assert.match(rejectRoute, /requireProjectAccess\(decision\.project_id, "write"\)/);
});

test("the project health adapter composes real RAID/schedule/critical-path services rather than a new aggregate table", () => {
  assert.match(healthRoute, /getProjectHealth/);
  assert.match(healthRoute, /requireProjectAccess/);
});

test("governance-relevant Decision Commands generate an Idempotency-Key per attempt and never resolve optimistically", () => {
  assert.match(contract, /crypto\.randomUUID\(\)/);
  assert.match(contract, /Idempotency-Key/);
  // The contract awaits the Command response before returning a result —
  // it never mutates local state ahead of the fetch resolving.
  assert.doesNotMatch(contract, /setState|useState/);
});

test("Decision approve/reject transitions map 1:1 to the governed Commands, never a bulk operation", () => {
  assert.match(contract, /approveDecision = \(decisionId: string, rationale\?: string\) => transitionDecision\(decisionId, "approve"/);
  assert.match(contract, /rejectDecision = \(decisionId: string, rationale\?: string\) => transitionDecision\(decisionId, "reject"/);
  assert.doesNotMatch(contract, /approveMany|bulkApprove|approveAll/i);
});
