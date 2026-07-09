import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceClientError,
  evaluatePMFreakAocGovernanceClaimSafety,
  PMFreakAocGovernanceClientError,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const ERROR_CODES = [
  "invalid_config",
  "invalid_request",
  "transport_unavailable",
  "unsupported_remote_transport",
  "evaluation_failed",
  "mutation_not_allowed",
  "redaction_failed",
  "unsafe_claim",
  "unknown_error",
] as const;

test("errors carry one of the documented, safe error codes", () => {
  for (const code of ERROR_CODES) {
    const error = createPMFreakAocGovernanceClientError(code, `test message for ${code}`);
    assert.ok(error instanceof PMFreakAocGovernanceClientError);
    assert.equal(error.code, code);
    assert.equal(error.safe, true);
  }
});

test("toSafeDetails() always reports safe: true and preserves the code/message", () => {
  const error = createPMFreakAocGovernanceClientError("invalid_request", "request is missing agentId", { field: "agentId" });
  const details = error.toSafeDetails();

  assert.equal(details.safe, true);
  assert.equal(details.code, "invalid_request");
  assert.equal(details.message, "request is missing agentId");
  assert.deepEqual(details.context, { field: "agentId" });
});

test("error messages are claim-safe", () => {
  const error = createPMFreakAocGovernanceClientError("mutation_not_allowed", 'Operation "create_invoice" is forbidden.');
  const result = evaluatePMFreakAocGovernanceClaimSafety(error.toSafeDetails());
  assert.equal(result.safe, true);
});
