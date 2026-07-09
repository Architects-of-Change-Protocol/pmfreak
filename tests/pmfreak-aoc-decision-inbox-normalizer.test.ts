import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocDecisionInboxItemFromGovernanceResponse,
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingMissingEvidenceResponse,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("normalizer creates a deterministic inboxItemId", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const first = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ response });
  const second = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ response });
  assert.equal(first.inboxItemId, second.inboxItemId);
  assert.ok(first.inboxItemId.startsWith("pmfreak.aoc.inbox."));
  assert.ok(first.inboxItemId.endsWith(".v1"));
});

test("normalizer preserves requestId, responseId and clientId", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const item = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ response });
  assert.equal(item.requestId, response.requestId);
  assert.equal(item.responseId, response.responseId);
  assert.equal(item.clientId, response.clientId);
});

test("normalizer copies project and agent/action context when request is provided", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const item = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response });

  assert.equal(item.projectId, request.projectContext.projectId);
  assert.equal(item.workspaceId, request.projectContext.workspaceId);
  assert.equal(item.tenantId, request.projectContext.tenantId);
  assert.equal(item.customerId, request.projectContext.customerId);
  assert.equal(item.agentId, request.agentContext.agentId);
  assert.equal(item.agentRole, request.agentContext.agentRole);
  assert.equal(item.actionId, request.actionContext.actionId);
  assert.equal(item.actionCategory, request.actionContext.actionCategory);
  assert.equal(item.actionTitle, request.actionContext.actionTitle);
});

test("normalizer leaves context undefined when no request is provided", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const item = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ response });
  assert.equal(item.projectId, undefined);
  assert.equal(item.agentId, undefined);
  assert.equal(item.actionTitle, undefined);
});

const decisionStatusCases: Array<[string, string]> = [
  ["allow", "allowed"],
  ["deny", "blocked"],
  ["hold", "held"],
  ["require_evidence", "needs_evidence"],
  ["require_pm_approval", "needs_pm_approval"],
  ["require_customer_validation", "needs_customer_validation"],
  ["require_billing_review", "needs_billing_review"],
  ["require_contract_review", "needs_contract_review"],
  ["require_security_review", "needs_security_review"],
  ["require_executive_approval", "needs_executive_approval"],
];

for (const [decision, expectedStatus] of decisionStatusCases) {
  test(`normalizer maps ${decision} to ${expectedStatus}`, async () => {
    const request = demoPMFreakAocBillingAllowedRequest();
    const response = { ...(await demoPMFreakAocBillingAllowedResponse()), decision: decision as never, decisionLabel: decision };
    const item = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response });
    assert.equal(item.decisionStatus, expectedStatus);
  });
}

test("normalizer forces display-only capability flags regardless of input", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const item = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ response });
  assert.equal(item.displayOnly, true);
  assert.equal(item.actionExecutionCapable, false);
  assert.equal(item.mutationCapable, false);
  assert.equal(item.writebackCapable, false);
  assert.equal(item.enforcementCapable, false);
});

test("normalizer does not mutate its input request or response", async () => {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const requestSnapshot = structuredClone(request);
  const responseSnapshot = structuredClone(response);

  createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response });

  assert.deepEqual(request, requestSnapshot);
  assert.deepEqual(response, responseSnapshot);
});

test("normalizer respects explicit source/inboxStatus/createdAtLabel overrides", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const item = createPMFreakAocDecisionInboxItemFromGovernanceResponse({
    response,
    source: "remote_http",
    inboxStatus: "reviewed",
    createdAtLabel: "2026-02-01T00:00:00.000Z",
    updatedAtLabel: "2026-02-02T00:00:00.000Z",
  });
  assert.equal(item.source, "remote_http");
  assert.equal(item.inboxStatus, "reviewed");
  assert.equal(item.createdAtLabel, "2026-02-01T00:00:00.000Z");
  assert.equal(item.updatedAtLabel, "2026-02-02T00:00:00.000Z");
});

test("normalizer infers source from evaluatedBy when no source override is given", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  assert.equal(response.evaluatedBy, "local_mock_aoc");
  const item = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ response });
  assert.equal(item.source, "local_mock");
});
