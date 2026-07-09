import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocRemoteTransportBillingAllowedEndpointBody,
  demoPMFreakAocRemoteTransportEndpointErrorBody,
  demoPMFreakAocRemoteTransportMalformedBody,
  parsePMFreakAocRemoteGovernanceEndpointBody,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("parser accepts an already-parsed success body", () => {
  const body = demoPMFreakAocRemoteTransportBillingAllowedEndpointBody();
  const parsed = parsePMFreakAocRemoteGovernanceEndpointBody(body);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.body.response.decision, "allow");
  }
});

test("parser accepts a raw JSON string success body", () => {
  const body = demoPMFreakAocRemoteTransportBillingAllowedEndpointBody();
  const parsed = parsePMFreakAocRemoteGovernanceEndpointBody(JSON.stringify(body));

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.body.endpointId, body.endpointId);
  }
});

test("parser accepts an endpoint error body", () => {
  const body = demoPMFreakAocRemoteTransportEndpointErrorBody();
  const parsed = parsePMFreakAocRemoteGovernanceEndpointBody(body);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.body.error.code, "governance_evaluation_failed");
    assert.equal(parsed.body.error.safe, true);
  }
});

test("parser rejects malformed JSON safely", () => {
  const parsed = parsePMFreakAocRemoteGovernanceEndpointBody(demoPMFreakAocRemoteTransportMalformedBody());

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.body.error.code, "invalid_response");
    assert.equal(parsed.body.error.safe, true);
  }
});

test("parser rejects null and undefined safely", () => {
  const parsedNull = parsePMFreakAocRemoteGovernanceEndpointBody(null);
  const parsedUndefined = parsePMFreakAocRemoteGovernanceEndpointBody(undefined);

  assert.equal(parsedNull.ok, false);
  assert.equal(parsedUndefined.ok, false);
  if (!parsedNull.ok) assert.equal(parsedNull.body.error.code, "invalid_response");
  if (!parsedUndefined.ok) assert.equal(parsedUndefined.body.error.code, "invalid_response");
});

test("parser rejects an unexpected object shape safely", () => {
  const parsed = parsePMFreakAocRemoteGovernanceEndpointBody({ unexpected: "shape" });

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.body.error.code, "invalid_response");
  }
});

test("parser does not leak the raw response body in its error message", () => {
  const secretBearingBody = '{"secretValue": "sk-demo-should-not-leak-into-error-message-1234567890"}';
  const parsed = parsePMFreakAocRemoteGovernanceEndpointBody(secretBearingBody);

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.ok(!parsed.body.error.message.includes("sk-demo-should-not-leak-into-error-message-1234567890"));
  }
});
