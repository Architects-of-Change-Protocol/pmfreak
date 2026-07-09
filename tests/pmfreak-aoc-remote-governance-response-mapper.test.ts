import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocRemoteTransportBillingMissingEvidenceEndpointBody,
  mapAocEndpointResponseToPMFreakAocGovernanceResponse,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

function mapDemo() {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const endpointResponse = demoPMFreakAocRemoteTransportBillingMissingEvidenceEndpointBody().response;
  const mapped = mapAocEndpointResponseToPMFreakAocGovernanceResponse({ request, endpointResponse });
  return { request, endpointResponse, mapped };
}

test("mapper preserves decision, decisionLabel and decisionSeverity", () => {
  const { endpointResponse, mapped } = mapDemo();
  assert.equal(mapped.decision, endpointResponse.decision);
  assert.equal(mapped.decisionLabel, endpointResponse.decisionLabel);
  assert.equal(mapped.decisionSeverity, endpointResponse.decisionSeverity);
});

test("mapper preserves reasonCodes and safeSummary", () => {
  const { endpointResponse, mapped } = mapDemo();
  assert.deepEqual(mapped.reasonCodes, endpointResponse.reasonCodes);
  assert.equal(mapped.safeSummary, endpointResponse.safeSummary);
});

test("mapper preserves evidence and approval requirements", () => {
  const { endpointResponse, mapped } = mapDemo();
  assert.deepEqual(mapped.requiredEvidenceIds, endpointResponse.requiredEvidenceIds);
  assert.deepEqual(mapped.requiredApprovalIds, endpointResponse.requiredApprovalIds);
  assert.deepEqual(mapped.missingEvidenceIds, endpointResponse.missingEvidenceIds);
  assert.deepEqual(mapped.missingApprovalIds, endpointResponse.missingApprovalIds);
});

test("mapper preserves trace, policyPackIds and jurisdictionPackIds", () => {
  const { endpointResponse, mapped } = mapDemo();
  assert.deepEqual(mapped.trace, endpointResponse.trace);
  assert.deepEqual(mapped.policyPackIds, endpointResponse.policyPackIds);
  assert.deepEqual(mapped.jurisdictionPackIds, endpointResponse.jurisdictionPackIds);
});

test("mapper preserves warnings and errors", () => {
  const { endpointResponse, mapped } = mapDemo();
  assert.deepEqual(mapped.warnings, endpointResponse.warnings);
  assert.deepEqual(mapped.errors, endpointResponse.errors);
});

test("mapper preserves the PMFreak response shape (providerId pmfreak, evaluatedBy aoc)", () => {
  const { request, mapped } = mapDemo();
  assert.equal(mapped.providerId, "pmfreak");
  assert.equal(mapped.evaluatedBy, "aoc");
  assert.equal(mapped.clientId, request.clientId);
  assert.equal(mapped.requestId, request.requestId);
  assert.ok(mapped.responseId.length > 0);
});

test("mapper does not mutate the input request or endpoint response", () => {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const endpointResponse = demoPMFreakAocRemoteTransportBillingMissingEvidenceEndpointBody().response;
  const requestSnapshot = JSON.parse(JSON.stringify(request));
  const endpointResponseSnapshot = JSON.parse(JSON.stringify(endpointResponse));

  mapAocEndpointResponseToPMFreakAocGovernanceResponse({ request, endpointResponse });

  assert.deepEqual(JSON.parse(JSON.stringify(request)), requestSnapshot);
  assert.deepEqual(JSON.parse(JSON.stringify(endpointResponse)), endpointResponseSnapshot);
});
