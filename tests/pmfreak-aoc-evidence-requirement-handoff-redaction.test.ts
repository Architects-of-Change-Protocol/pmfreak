import test from "node:test";
import assert from "node:assert/strict";

import { redactPMFreakAocEvidenceRequirementHandoffValue } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("safe_demo mode redacts emails", () => {
  const redacted = redactPMFreakAocEvidenceRequirementHandoffValue("Contact demo.user@example.com for details.", "safe_demo") as string;
  assert.ok(!redacted.includes("demo.user@example.com"));
  assert.ok(redacted.includes("[redacted]"));
});

test("safe_demo mode redacts secret-like tokens", () => {
  const redacted = redactPMFreakAocEvidenceRequirementHandoffValue("token=abcdefghijklmnopqrstuvwxyz123456", "safe_demo") as string;
  assert.ok(!redacted.includes("abcdefghijklmnopqrstuvwxyz123456"));
});

test("safe_demo mode redacts bearer tokens", () => {
  const redacted = redactPMFreakAocEvidenceRequirementHandoffValue("Authorization: Bearer sometoken12345", "safe_demo") as string;
  assert.ok(!redacted.includes("sometoken12345"));
});

test("safe_demo mode redacts connection strings with embedded credentials", () => {
  const redacted = redactPMFreakAocEvidenceRequirementHandoffValue("postgres://user:pass@host:5432/db", "safe_demo") as string;
  assert.ok(!redacted.includes("user:pass@host"));
});

test("safe_demo mode redacts file-path-like strings", () => {
  const redacted = redactPMFreakAocEvidenceRequirementHandoffValue("/home/user/private/evidence-export.pdf", "safe_demo") as string;
  assert.ok(!redacted.includes("/home/user/private/evidence-export.pdf"));
});

test("strict mode clears metadata-like keys", () => {
  const redacted = redactPMFreakAocEvidenceRequirementHandoffValue({ metadata: { secretKey: "value" }, safeField: "ok" }, "strict") as Record<string, unknown>;
  assert.deepEqual(redacted.metadata, {});
  assert.equal(redacted.safeField, "ok");
});

test("none mode returns a deep clone without redacting", () => {
  const value = { email: "demo.user@example.com" };
  const redacted = redactPMFreakAocEvidenceRequirementHandoffValue(value, "none") as Record<string, unknown>;
  assert.equal(redacted.email, "demo.user@example.com");
  assert.notEqual(redacted, value);
});

test("redaction does not mutate its input", () => {
  const value = { email: "demo.user@example.com" };
  const snapshot = structuredClone(value);
  redactPMFreakAocEvidenceRequirementHandoffValue(value, "safe_demo");
  assert.deepEqual(value, snapshot);
});
