import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocGovernedActionGateAllBlockedResults,
  demoPMFreakAocGovernedActionGateAllowInput,
  demoPMFreakAocGovernedActionGateAllPassedResults,
  demoPMFreakAocGovernedActionGateBlockedResult,
  demoPMFreakAocGovernedActionGateDenyInput,
  demoPMFreakAocGovernedActionGateErrorResult,
  demoPMFreakAocGovernedActionGateHeldResult,
  demoPMFreakAocGovernedActionGateHoldInput,
  demoPMFreakAocGovernedActionGateMismatchedClientInput,
  demoPMFreakAocGovernedActionGateMismatchedRequestInput,
  demoPMFreakAocGovernedActionGateMixedResults,
  demoPMFreakAocGovernedActionGateNeedsApprovalResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGateNeedsReviewResult,
  demoPMFreakAocGovernedActionGatePassedResult,
  demoPMFreakAocGovernedActionGateRequireBillingReviewInput,
  demoPMFreakAocGovernedActionGateRequireEvidenceInput,
  evaluatePMFreakAocGovernedActionGate,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const REAL_LOOKING_PATTERNS = [/@gmail\.com/i, /@datasys/i, /\bINV-\d/i, /\bCR-\d{6,}/];

test("result fixtures produce the expected verdict for each scenario", async () => {
  assert.equal((await demoPMFreakAocGovernedActionGatePassedResult()).verdict, "passed");
  assert.equal((await demoPMFreakAocGovernedActionGateBlockedResult()).verdict, "blocked");
  assert.equal((await demoPMFreakAocGovernedActionGateHeldResult()).verdict, "held");
  assert.equal((await demoPMFreakAocGovernedActionGateNeedsEvidenceResult()).verdict, "needs_evidence");
  assert.equal((await demoPMFreakAocGovernedActionGateNeedsApprovalResult()).verdict, "needs_approval");
  assert.equal((await demoPMFreakAocGovernedActionGateNeedsReviewResult()).verdict, "needs_review");
  assert.equal((await demoPMFreakAocGovernedActionGateErrorResult()).verdict, "error");
});

test("input fixtures evaluate to the expected verdict through the main evaluator", async () => {
  assert.equal((await evaluatePMFreakAocGovernedActionGate({ gateInput: await demoPMFreakAocGovernedActionGateAllowInput() })).verdict, "passed");
  assert.equal((await evaluatePMFreakAocGovernedActionGate({ gateInput: await demoPMFreakAocGovernedActionGateDenyInput() })).verdict, "blocked");
  assert.equal((await evaluatePMFreakAocGovernedActionGate({ gateInput: await demoPMFreakAocGovernedActionGateHoldInput() })).verdict, "held");
  assert.equal(
    (await evaluatePMFreakAocGovernedActionGate({ gateInput: await demoPMFreakAocGovernedActionGateRequireEvidenceInput() })).verdict,
    "needs_evidence",
  );
  assert.equal(
    (await evaluatePMFreakAocGovernedActionGate({ gateInput: await demoPMFreakAocGovernedActionGateRequireBillingReviewInput() })).verdict,
    "needs_review",
  );
});

test("mismatch input fixtures evaluate to error", async () => {
  const mismatchedRequest = await evaluatePMFreakAocGovernedActionGate({ gateInput: await demoPMFreakAocGovernedActionGateMismatchedRequestInput() });
  assert.equal(mismatchedRequest.verdict, "error");
  assert.ok(mismatchedRequest.reasonCodes.includes("mismatched_request_id"));

  const mismatchedClient = await evaluatePMFreakAocGovernedActionGate({ gateInput: await demoPMFreakAocGovernedActionGateMismatchedClientInput() });
  assert.equal(mismatchedClient.verdict, "error");
  assert.ok(mismatchedClient.reasonCodes.includes("mismatched_client_id"));
});

test("batch fixtures behave as expected", async () => {
  const mixed = await demoPMFreakAocGovernedActionGateMixedResults();
  assert.equal(mixed.length, 7);

  const allPassed = await demoPMFreakAocGovernedActionGateAllPassedResults();
  assert.ok(allPassed.every((r) => r.verdict === "passed"));

  const allBlocked = await demoPMFreakAocGovernedActionGateAllBlockedResults();
  assert.ok(allBlocked.every((r) => r.verdict === "blocked"));
});

test("fixtures are deterministic across calls", async () => {
  assert.deepEqual(await demoPMFreakAocGovernedActionGatePassedResult(), await demoPMFreakAocGovernedActionGatePassedResult());
  assert.deepEqual(await demoPMFreakAocGovernedActionGateMixedResults(), await demoPMFreakAocGovernedActionGateMixedResults());
});

test("fixtures use only fake, demo-only identifiers", async () => {
  const results = await demoPMFreakAocGovernedActionGateMixedResults();
  const serialized = JSON.stringify(results);

  for (const pattern of REAL_LOOKING_PATTERNS) {
    assert.ok(!pattern.test(serialized), `fixtures must not contain real-looking identifier matching ${pattern}`);
  }
  assert.ok(serialized.includes("demo."), "fixture identifiers should be namespaced under demo.*");
});
