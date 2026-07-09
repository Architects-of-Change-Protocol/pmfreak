import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequestClient,
  createPMFreakAocGovernedActionGateInput,
  demoPMFreakAocBillingReadinessActionAttempt,
  demoPMFreakAocGovernedActionGateAllowInput,
  demoPMFreakAocGovernedActionGateDenyInput,
  evaluatePMFreakAocGovernedActionAttemptGate,
  evaluatePMFreakAocGovernedActionGate,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("main evaluator chooses governanceResponse when present", async () => {
  const gateInput = await demoPMFreakAocGovernedActionGateAllowInput();
  const result = await evaluatePMFreakAocGovernedActionGate({ gateInput });
  assert.equal(result.verdict, "passed");
});

test("main evaluator chooses decisionInboxItem when response is absent", async () => {
  const gateInput = await demoPMFreakAocGovernedActionGateDenyInput();
  assert.equal(gateInput.governanceResponse, undefined);
  const result = await evaluatePMFreakAocGovernedActionGate({ gateInput });
  assert.equal(result.verdict, "blocked");
});

test("main evaluator returns a safe error result when no response or inbox item exists", async () => {
  const gateInput = createPMFreakAocGovernedActionGateInput({});
  const result = await evaluatePMFreakAocGovernedActionGate({ gateInput });
  assert.equal(result.verdict, "error");
  assert.equal(result.canProceed, false);
  assert.ok(result.reasonCodes.includes("missing_governance_response"));
});

test("action attempt gate flow builds and evaluates a request using the existing governance client", async () => {
  const client = createPMFreakAocGovernanceRequestClient();
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();

  const { request, response, gateResult } = await evaluatePMFreakAocGovernedActionAttemptGate({
    actionAttempt,
    governanceClient: client,
  });

  assert.equal(request.actionAttempt.actionAttemptId, actionAttempt.actionAttemptId);
  assert.equal(response.requestId, request.requestId);
  assert.equal(gateResult.requestId, request.requestId);
  assert.equal(gateResult.responseId, response.responseId);
});

test("action attempt gate flow evaluates a gate result matching the response decision", async () => {
  const client = createPMFreakAocGovernanceRequestClient();
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();

  const { response, gateResult } = await evaluatePMFreakAocGovernedActionAttemptGate({
    actionAttempt,
    governanceClient: client,
  });

  if (response.decision === "allow") {
    assert.equal(gateResult.verdict, "passed");
  } else {
    assert.notEqual(gateResult.verdict, "passed");
  }
});

test("action attempt gate flow does not execute the action or mutate PMFreak data", async () => {
  const client = createPMFreakAocGovernanceRequestClient();
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();
  const attemptSnapshot = structuredClone(actionAttempt);

  const result = await evaluatePMFreakAocGovernedActionAttemptGate({ actionAttempt, governanceClient: client });

  assert.deepEqual(actionAttempt, attemptSnapshot);
  assert.equal(result.gateResult.actionExecutionCapable, false);
  assert.equal(result.gateResult.mutationCapable, false);
  assert.equal(result.gateResult.writebackCapable, false);
});
