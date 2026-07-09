import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernedActionGateInput,
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingReadinessActionAttempt,
  demoPMFreakAocDecisionInboxAllowItem,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("gate input creates a deterministic gateInputId", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const a = createPMFreakAocGovernedActionGateInput({ governanceResponse: response });
  const b = createPMFreakAocGovernedActionGateInput({ governanceResponse: response });
  assert.equal(a.gateInputId, b.gateInputId);
  assert.ok(a.gateInputId.startsWith("pmfreak.aoc.gate.input."));
  assert.ok(a.gateInputId.endsWith(".v1"));
});

test("gate input preserves actionAttempt", () => {
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();
  const input = createPMFreakAocGovernedActionGateInput({ actionAttempt });
  assert.deepEqual(input.actionAttempt, actionAttempt);
});

test("gate input preserves governanceRequest", () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const input = createPMFreakAocGovernedActionGateInput({ governanceRequest: request });
  assert.equal(input.governanceRequest, request);
});

test("gate input preserves governanceResponse", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const input = createPMFreakAocGovernedActionGateInput({ governanceResponse: response });
  assert.equal(input.governanceResponse, response);
});

test("gate input preserves decisionInboxItem", async () => {
  const item = await demoPMFreakAocDecisionInboxAllowItem();
  const input = createPMFreakAocGovernedActionGateInput({ decisionInboxItem: item });
  assert.equal(input.decisionInboxItem, item);
  assert.equal(input.source, "decision_inbox_item");
});

test("gate input derives expectedRequestId and expectedClientId from a governance request", () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const input = createPMFreakAocGovernedActionGateInput({ governanceRequest: request });
  assert.equal(input.expectedRequestId, request.requestId);
  assert.equal(input.expectedClientId, request.clientId);
});

test("gate input does not mutate its input action attempt", () => {
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();
  const snapshot = structuredClone(actionAttempt);
  createPMFreakAocGovernedActionGateInput({ actionAttempt });
  assert.deepEqual(actionAttempt, snapshot);
});

test("gate input defaults source to action_attempt when only an action attempt is given", () => {
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();
  const input = createPMFreakAocGovernedActionGateInput({ actionAttempt });
  assert.equal(input.source, "action_attempt");
});

test("gate input preserves warnings and errors", () => {
  const input = createPMFreakAocGovernedActionGateInput({ warnings: ["demo.warning.v1"], errors: ["demo.error.v1"] });
  assert.deepEqual(input.warnings, ["demo.warning.v1"]);
  assert.deepEqual(input.errors, ["demo.error.v1"]);
});
