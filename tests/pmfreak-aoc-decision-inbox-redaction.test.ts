import test from "node:test";
import assert from "node:assert/strict";

import { redactPMFreakAocDecisionInboxValue } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("redaction safe_demo removes emails and secret/token-like strings", () => {
  const value = { note: "contact person@example.com with token abcdefghijklmnopqrstuvwx" };
  const redacted = redactPMFreakAocDecisionInboxValue(value, "safe_demo") as { note: string };
  assert.ok(!redacted.note.includes("person@example.com"));
  assert.ok(!redacted.note.includes("abcdefghijklmnopqrstuvwx"));
});

test("redaction none returns an unmodified deep clone", () => {
  const value = { note: "contact person@example.com" };
  const redacted = redactPMFreakAocDecisionInboxValue(value, "none") as { note: string };
  assert.equal(redacted.note, value.note);
  assert.notEqual(redacted, value);
});

test("strict redaction removes metadata-like payloads", () => {
  const value = { title: "Attempted action", metadata: { internal: "raw-detail" } };
  const redacted = redactPMFreakAocDecisionInboxValue(value, "strict") as { title: string; metadata: Record<string, unknown> };
  assert.equal(redacted.title, "Attempted action");
  assert.deepEqual(redacted.metadata, {});
});

test("redaction does not mutate the input value", () => {
  const value = { note: "contact person@example.com" };
  const snapshot = structuredClone(value);
  redactPMFreakAocDecisionInboxValue(value, "safe_demo");
  assert.deepEqual(value, snapshot);
});
