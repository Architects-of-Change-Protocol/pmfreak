import test from "node:test";
import assert from "node:assert/strict";

import { redactPMFreakAocGateResultUIValue } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("safe_demo redaction removes email-like strings", () => {
  const redacted = redactPMFreakAocGateResultUIValue({ note: "contact demo@example.com for details" }, "safe_demo") as { note: string };
  assert.ok(!redacted.note.includes("demo@example.com"));
  assert.ok(redacted.note.includes("[redacted]"));
});

test("safe_demo redaction removes secret/token-like keys", () => {
  const redacted = redactPMFreakAocGateResultUIValue({ apiKey: "a".repeat(32) }, "safe_demo") as { apiKey: string };
  assert.equal(redacted.apiKey, "[redacted]");
});

test("safe_demo redaction removes secret-like tokens", () => {
  const redacted = redactPMFreakAocGateResultUIValue({ note: "token=" + "x".repeat(32) }, "safe_demo") as { note: string };
  assert.ok(!redacted.note.includes("x".repeat(32)));
});

test("strict redaction removes metadata-like payloads", () => {
  const redacted = redactPMFreakAocGateResultUIValue({ metadata: { secretField: "should-not-survive-strict-mode-xxxx" } }, "strict") as {
    metadata: Record<string, unknown>;
  };
  assert.deepEqual(redacted.metadata, {});
});

test("redaction does not mutate its input", () => {
  const input = { note: "demo@example.com" };
  const snapshot = structuredClone(input);
  redactPMFreakAocGateResultUIValue(input, "safe_demo");
  assert.deepEqual(input, snapshot);
});
