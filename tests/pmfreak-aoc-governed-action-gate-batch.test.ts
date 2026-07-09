import test from "node:test";
import assert from "node:assert/strict";

import {
  batchEvaluatePMFreakAocGovernedActionGateResults,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingMissingEvidenceResponse,
  demoPMFreakAocDecisionInboxAllowItem,
  demoPMFreakAocDecisionInboxDenyItem,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("batch evaluation preserves deterministic response-then-inbox-item order", async () => {
  const allowedResponse = await demoPMFreakAocBillingAllowedResponse();
  const evidenceResponse = await demoPMFreakAocBillingMissingEvidenceResponse();
  const allowItem = await demoPMFreakAocDecisionInboxAllowItem();
  const denyItem = await demoPMFreakAocDecisionInboxDenyItem();

  const results = batchEvaluatePMFreakAocGovernedActionGateResults({
    responses: [allowedResponse, evidenceResponse],
    inboxItems: [allowItem, denyItem],
  });

  assert.equal(results.length, 4);
  assert.equal(results[0].responseId, allowedResponse.responseId);
  assert.equal(results[1].responseId, evidenceResponse.responseId);
  assert.equal(results[2].inboxItemId, allowItem.inboxItemId);
  assert.equal(results[3].inboxItemId, denyItem.inboxItemId);
});

test("batch evaluation handles responses-only input", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const results = batchEvaluatePMFreakAocGovernedActionGateResults({ responses: [response] });
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "passed");
});

test("batch evaluation handles inbox-items-only input", async () => {
  const item = await demoPMFreakAocDecisionInboxDenyItem();
  const results = batchEvaluatePMFreakAocGovernedActionGateResults({ inboxItems: [item] });
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "blocked");
});

test("batch evaluation does not mutate its inputs", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const snapshot = structuredClone(response);
  batchEvaluatePMFreakAocGovernedActionGateResults({ responses: [response] });
  assert.deepEqual(response, snapshot);
});

test("batch evaluation of the same fixtures twice is deterministic", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const first = batchEvaluatePMFreakAocGovernedActionGateResults({ responses: [response] });
  const second = batchEvaluatePMFreakAocGovernedActionGateResults({ responses: [response] });
  assert.deepEqual(first, second);
});
