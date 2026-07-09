import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequest,
  demoPMFreakAocBillingReadinessActionAttempt,
  redactPMFreakAocGovernancePayloadValue,
  redactPMFreakAocGovernanceRequest,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

function buildRequestWithSensitiveMetadata() {
  const actionAttempt = {
    ...demoPMFreakAocBillingReadinessActionAttempt(),
    metadata: {
      contactEmail: "demo.contact@example.com",
      apiToken: "sk-demo-abcdefghijklmnopqrstuvwx",
      note: "no sensitive content here",
    },
  };
  return createPMFreakAocGovernanceRequest({ actionAttempt });
}

test("safe_demo redaction removes emails and secret/token-like strings", () => {
  const request = buildRequestWithSensitiveMetadata();
  const redacted = redactPMFreakAocGovernanceRequest(request, "safe_demo");

  const serialized = JSON.stringify(redacted);
  assert.ok(!serialized.includes("demo.contact@example.com"));
  assert.ok(!serialized.includes("sk-demo-abcdefghijklmnopqrstuvwx"));
  assert.ok(serialized.includes("[redacted]"));
  assert.equal(redacted.actionAttempt.metadata.note, "no sensitive content here");
});

test("strict redaction clears metadata entirely", () => {
  const request = buildRequestWithSensitiveMetadata();
  const redacted = redactPMFreakAocGovernanceRequest(request, "strict");

  assert.deepEqual(redacted.actionAttempt.metadata, {});
});

test("none mode returns an unredacted deep clone", () => {
  const request = buildRequestWithSensitiveMetadata();
  const untouched = redactPMFreakAocGovernancePayloadValue(request, "none") as typeof request;

  assert.deepEqual(JSON.parse(JSON.stringify(untouched)), JSON.parse(JSON.stringify(request)));
  assert.notEqual(untouched, request);
});

test("redaction never mutates the input value", () => {
  const request = buildRequestWithSensitiveMetadata();
  const snapshot = JSON.parse(JSON.stringify(request));

  redactPMFreakAocGovernanceRequest(request, "strict");

  assert.deepEqual(JSON.parse(JSON.stringify(request)), snapshot);
});
