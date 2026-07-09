import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocRemoteGovernanceTransportError,
  PMFreakAocRemoteGovernanceTransportError,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("factory produces a safe, typed transport error", () => {
  const error = createPMFreakAocRemoteGovernanceTransportError("timeout", "AOC remote governance request timed out.");

  assert.ok(error instanceof PMFreakAocRemoteGovernanceTransportError);
  assert.ok(error instanceof Error);
  assert.equal(error.code, "timeout");
  assert.equal(error.message, "AOC remote governance request timed out.");
  assert.equal(error.safe, true);
});

test("toSafeDetails returns a safe, serializable details object", () => {
  const error = createPMFreakAocRemoteGovernanceTransportError("endpoint_error", "AOC endpoint returned HTTP 500.", { status: 500 });
  const details = error.toSafeDetails();

  assert.deepEqual(details, {
    code: "endpoint_error",
    message: "AOC endpoint returned HTTP 500.",
    safe: true,
    details: { status: 500 },
  });
});

test("errors never carry secrets, tokens, authorization headers or connection strings in their message", () => {
  const message = "authMode is bearer_token but no bearerToken is configured.";
  const error = createPMFreakAocRemoteGovernanceTransportError("invalid_config", message);

  assert.ok(!/authorization:/i.test(error.message));
  assert.ok(!/postgres:\/\//i.test(error.message));
  assert.ok(!/bearer\s+[a-z0-9]{16,}/i.test(error.message));
});
