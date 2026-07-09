import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequestClient,
  createUnsupportedRemotePMFreakAocGovernanceTransport,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingReadinessActionAttempt,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("client defaults to the local mock transport", () => {
  const client = createPMFreakAocGovernanceRequestClient();
  assert.equal(client.transport.transportKind, "local_mock");
  assert.equal(client.config.transportKind, "local_mock");
});

test("client builds a governance request from an action attempt", () => {
  const client = createPMFreakAocGovernanceRequestClient();
  const request = client.buildRequest({ actionAttempt: demoPMFreakAocBillingReadinessActionAttempt() });

  assert.equal(request.providerId, "pmfreak");
  assert.equal(request.consumerOf, "aoc");
  assert.equal(request.actionAttempt.actionId, "demo.action.mark-milestone-billing-ready.v1");
});

test("client evaluates a request through its configured transport", async () => {
  const client = createPMFreakAocGovernanceRequestClient();
  const response = await client.evaluateRequest(demoPMFreakAocBillingMissingEvidenceRequest());

  assert.equal(response.decision, "require_evidence");
  assert.equal(response.evaluatedBy, "local_mock_aoc");
});

test("client buildAndEvaluate returns the built request paired with its decision", async () => {
  const client = createPMFreakAocGovernanceRequestClient();
  const { request, response } = await client.buildAndEvaluate({
    actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
    providedEvidenceIds: ["demo.evidence.customer-acceptance.v1"],
    providedApprovalIds: ["demo.approval.billing_review.v1"],
  });

  assert.equal(response.requestId, request.requestId);
  assert.equal(response.decision, "allow");
});

test("client can be constructed with an explicit transport (e.g. unsupported remote)", async () => {
  const client = createPMFreakAocGovernanceRequestClient({ transport: createUnsupportedRemotePMFreakAocGovernanceTransport() });
  const { response } = await client.buildAndEvaluate({ actionAttempt: demoPMFreakAocBillingReadinessActionAttempt() });

  assert.equal(response.evaluatedBy, "unsupported_remote");
  assert.equal(response.decision, "hold");
});

test("client never executes PMFreak actions or mutates PMFreak data", async () => {
  const client = createPMFreakAocGovernanceRequestClient();
  const clientKeys = Object.keys(client);

  for (const forbiddenMethod of ["executeAction", "applyDecision", "mutateProject", "createInvoice", "sendEmail"]) {
    assert.ok(!clientKeys.includes(forbiddenMethod), `client must not expose "${forbiddenMethod}"`);
  }
});
