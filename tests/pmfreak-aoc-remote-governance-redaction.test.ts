import test from "node:test";
import assert from "node:assert/strict";

import { redactPMFreakAocRemoteGovernanceTransportValue } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

function buildSensitivePayload() {
  return {
    headers: {
      authorization: "Bearer sk-demo-abcdefghijklmnopqrstuvwx",
      "x-aoc-governance-secret": "demo-shared-secret-value-1234567890",
    },
    contactEmail: "demo.contact@example.com",
    connectionString: "postgres://demo_user:demo_password@db.example.com:5432/demo",
    metadata: { note: "should be cleared in strict mode" },
    note: "no sensitive content here",
  };
}

test("safe_demo redaction removes emails, tokens, bearer tokens and connection strings with credentials", () => {
  const redacted = redactPMFreakAocRemoteGovernanceTransportValue(buildSensitivePayload(), "safe_demo");
  const serialized = JSON.stringify(redacted);

  assert.ok(!serialized.includes("demo.contact@example.com"));
  assert.ok(!serialized.includes("sk-demo-abcdefghijklmnopqrstuvwx"));
  assert.ok(!serialized.includes("demo-shared-secret-value-1234567890"));
  assert.ok(!serialized.includes("demo_user:demo_password"));
  assert.ok(serialized.includes("[redacted]"));
});

test("safe_demo redaction preserves non-sensitive content", () => {
  const redacted = redactPMFreakAocRemoteGovernanceTransportValue(buildSensitivePayload(), "safe_demo") as ReturnType<
    typeof buildSensitivePayload
  >;
  assert.equal(redacted.note, "no sensitive content here");
});

test("strict redaction clears metadata entirely", () => {
  const redacted = redactPMFreakAocRemoteGovernanceTransportValue(buildSensitivePayload(), "strict") as ReturnType<
    typeof buildSensitivePayload
  >;
  assert.deepEqual(redacted.metadata, {});
});

test("none mode returns an unredacted deep clone", () => {
  const payload = buildSensitivePayload();
  const untouched = redactPMFreakAocRemoteGovernanceTransportValue(payload, "none");

  assert.deepEqual(untouched, payload);
  assert.notEqual(untouched, payload);
});

test("redaction never mutates the input value", () => {
  const payload = buildSensitivePayload();
  const snapshot = JSON.parse(JSON.stringify(payload));

  redactPMFreakAocRemoteGovernanceTransportValue(payload, "strict");

  assert.deepEqual(payload, snapshot);
});
