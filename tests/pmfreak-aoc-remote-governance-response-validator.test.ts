import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocRemoteTransportBillingAllowedEndpointBody,
  validatePMFreakAocRemoteAocGovernanceResponse,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

function validResponse() {
  return demoPMFreakAocRemoteTransportBillingAllowedEndpointBody().response;
}

test("validator accepts a valid AOC endpoint response", () => {
  const result = validatePMFreakAocRemoteAocGovernanceResponse(validResponse());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validator rejects a missing responseId", () => {
  const response = { ...validResponse(), responseId: "" };
  const result = validatePMFreakAocRemoteAocGovernanceResponse(response);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /responseId/.test(e)));
});

test("validator rejects a missing requestId", () => {
  const response = { ...validResponse(), requestId: "" };
  const result = validatePMFreakAocRemoteAocGovernanceResponse(response);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /requestId/.test(e)));
});

test("validator rejects a missing clientId", () => {
  const response = { ...validResponse(), clientId: "" };
  const result = validatePMFreakAocRemoteAocGovernanceResponse(response);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /clientId/.test(e)));
});

test("validator rejects a providerId other than aoc", () => {
  const response = { ...validResponse(), providerId: "not-aoc" as unknown as "aoc" };
  const result = validatePMFreakAocRemoteAocGovernanceResponse(response);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /providerId/.test(e)));
});

test("validator rejects an evaluatedFor other than pmfreak", () => {
  const response = { ...validResponse(), evaluatedFor: "not-pmfreak" as unknown as "pmfreak" };
  const result = validatePMFreakAocRemoteAocGovernanceResponse(response);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /evaluatedFor/.test(e)));
});

test("validator rejects an unknown decision", () => {
  const response = { ...validResponse(), decision: "unknown_decision" as unknown as "allow" };
  const result = validatePMFreakAocRemoteAocGovernanceResponse(response);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /not a known AOC decision/.test(e)));
});

test("validator rejects an unknown severity", () => {
  const response = { ...validResponse(), decisionSeverity: "critical" as unknown as "danger" };
  const result = validatePMFreakAocRemoteAocGovernanceResponse(response);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /not a known decision severity/.test(e)));
});

test("validator catches unsafe claims", () => {
  const response = { ...validResponse(), safeSummary: "This action is production authorized." };
  const result = validatePMFreakAocRemoteAocGovernanceResponse(response);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /unsafe claim/.test(e)));
});
