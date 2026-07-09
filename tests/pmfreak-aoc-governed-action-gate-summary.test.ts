import test from "node:test";
import assert from "node:assert/strict";

import { demoPMFreakAocGovernedActionGateMixedResults, summarizePMFreakAocGovernedActionGateResults } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("summary counts total", async () => {
  const results = await demoPMFreakAocGovernedActionGateMixedResults();
  const summary = summarizePMFreakAocGovernedActionGateResults(results);
  assert.equal(summary.total, results.length);
  assert.equal(summary.gateOnly, true);
});

test("summary counts passed, blocked and held", async () => {
  const results = await demoPMFreakAocGovernedActionGateMixedResults();
  const summary = summarizePMFreakAocGovernedActionGateResults(results);
  assert.equal(summary.passedCount, results.filter((r) => r.verdict === "passed").length);
  assert.equal(summary.blockedCount, results.filter((r) => r.verdict === "blocked").length);
  assert.equal(summary.heldCount, results.filter((r) => r.verdict === "held").length);
  assert.ok(summary.passedCount > 0);
  assert.ok(summary.blockedCount > 0);
  assert.ok(summary.heldCount > 0);
});

test("summary counts needs evidence, needs approval, needs review and errors", async () => {
  const results = await demoPMFreakAocGovernedActionGateMixedResults();
  const summary = summarizePMFreakAocGovernedActionGateResults(results);
  assert.equal(summary.needsEvidenceCount, results.filter((r) => r.verdict === "needs_evidence").length);
  assert.equal(summary.needsApprovalCount, results.filter((r) => r.verdict === "needs_approval").length);
  assert.equal(summary.needsReviewCount, results.filter((r) => r.verdict === "needs_review").length);
  assert.equal(summary.errorCount, results.filter((r) => r.verdict === "error").length);
  assert.ok(summary.needsEvidenceCount > 0);
  assert.ok(summary.needsApprovalCount > 0);
  assert.ok(summary.needsReviewCount > 0);
  assert.ok(summary.errorCount > 0);
});

test("summary counts canProceed vs cannotProceed", async () => {
  const results = await demoPMFreakAocGovernedActionGateMixedResults();
  const summary = summarizePMFreakAocGovernedActionGateResults(results);
  assert.equal(summary.canProceedCount, results.filter((r) => r.canProceed).length);
  assert.equal(summary.canProceedCount + summary.cannotProceedCount, summary.total);
});

test("summary breakdowns sum to the total", async () => {
  const results = await demoPMFreakAocGovernedActionGateMixedResults();
  const summary = summarizePMFreakAocGovernedActionGateResults(results);
  const sumOf = (record: Record<string, number>) => Object.values(record).reduce((a, b) => a + b, 0);
  assert.equal(sumOf(summary.byVerdict), summary.total);
  assert.equal(sumOf(summary.bySeverity), summary.total);
});

test("summary does not mutate the input array", async () => {
  const results = await demoPMFreakAocGovernedActionGateMixedResults();
  const snapshot = structuredClone(results);
  summarizePMFreakAocGovernedActionGateResults(results);
  assert.deepEqual(results, snapshot);
});
