import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGovernanceRequestClient } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("health is healthy for the default local mock configuration", async () => {
  const client = createPMFreakAocGovernanceRequestClient();
  const health = await client.getHealth();

  assert.equal(health.status, "healthy");
  assert.deepEqual(health.errors, []);
  assert.deepEqual(health.warnings, []);
});

test("health reflects config warnings", async () => {
  const client = createPMFreakAocGovernanceRequestClient({
    config: { allowActionExecution: true as unknown as false },
  });
  const health = await client.getHealth();

  assert.equal(health.status, "degraded");
  assert.ok(health.warnings.some((warning) => /allowActionExecution/.test(warning)));
});

test("health is unavailable when the transport is unsupported_remote", async () => {
  const client = createPMFreakAocGovernanceRequestClient({ config: { transportKind: "unsupported_remote" } });
  const health = await client.getHealth();

  assert.equal(health.status, "unavailable");
  assert.equal(health.transportKind, "unsupported_remote");
});
