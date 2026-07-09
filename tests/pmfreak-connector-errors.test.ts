import test from "node:test";
import assert from "node:assert/strict";

import { createAocPMFreakConnectorError } from "../src/features/aoc-integrations/pmfreak-read-only-connector";

test("connector error is safe and does not leak secrets", () => {
  const error = createAocPMFreakConnectorError("read_failed", "PMFreak read-only source failed to read data.", {
    sourceKind: "in_memory",
  });

  assert.equal(error.safe, true);
  assert.equal(error.code, "read_failed");
  assert.ok(!error.message.toLowerCase().includes("token"));
  assert.ok(!error.message.toLowerCase().includes("secret"));
  assert.ok(!error.message.toLowerCase().includes("authorization"));
  assert.ok(!error.message.includes("://"));
});

test("every connector error code produces a safe error", () => {
  const codes = [
    "invalid_config",
    "source_unavailable",
    "read_failed",
    "mutation_not_allowed",
    "unsupported_source_kind",
    "redaction_failed",
    "unknown_error",
  ] as const;

  for (const code of codes) {
    const error = createAocPMFreakConnectorError(code, `Deterministic safe message for ${code}.`);
    assert.equal(error.safe, true);
    assert.equal(error.code, code);
  }
});
