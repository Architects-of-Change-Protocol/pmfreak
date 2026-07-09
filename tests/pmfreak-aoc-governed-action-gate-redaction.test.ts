import test from "node:test";
import assert from "node:assert/strict";

import { redactPMFreakAocGovernedActionGateValue } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("safe_demo redaction removes email-like strings", () => {
  const redacted = redactPMFreakAocGovernedActionGateValue({ note: "contact demo@example.com for details" }, "safe_demo") as { note: string };
  assert.ok(!redacted.note.includes("demo@example.com"));
  assert.ok(redacted.note.includes("[redacted]"));
});

test("safe_demo redaction removes secret/token-like keys", () => {
  const redacted = redactPMFreakAocGovernedActionGateValue({ apiKey: "a".repeat(32) }, "safe_demo") as { apiKey: string };
  assert.equal(redacted.apiKey, "[redacted]");
});

test("strict redaction clears metadata-like payloads", () => {
  const redacted = redactPMFreakAocGovernedActionGateValue({ metadata: { secretField: "should-not-survive-strict-mode-xxxx" } }, "strict") as {
    metadata: Record<string, unknown>;
  };
  assert.deepEqual(redacted.metadata, {});
});

test("none mode returns a deep clone without scrubbing", () => {
  const input = { note: "demo@example.com" };
  const redacted = redactPMFreakAocGovernedActionGateValue(input, "none") as { note: string };
  assert.equal(redacted.note, "demo@example.com");
  assert.notEqual(redacted, input);
});

test("redaction does not mutate its input", () => {
  const input = { note: "demo@example.com" };
  const snapshot = structuredClone(input);
  redactPMFreakAocGovernedActionGateValue(input, "safe_demo");
  assert.deepEqual(input, snapshot);
});
