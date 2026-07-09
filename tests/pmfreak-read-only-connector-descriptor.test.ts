import test from "node:test";
import assert from "node:assert/strict";

import {
  AOC_PMFREAK_READ_ONLY_CONNECTOR_ID,
  createAocPMFreakReadOnlyConnectorDescriptor,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";

test("creates connector descriptor", () => {
  const descriptor = createAocPMFreakReadOnlyConnectorDescriptor();

  assert.equal(descriptor.connectorId, "aoc.integration.pmfreak.read_only_connector.v1");
  assert.equal(descriptor.connectorId, AOC_PMFREAK_READ_ONLY_CONNECTOR_ID);
  assert.equal(descriptor.systemId, "pmfreak");
  assert.equal(descriptor.version, "v1");
  assert.equal(descriptor.mode, "read_only");
  assert.equal(descriptor.demoCompatible, true);
  assert.equal(descriptor.productionMutationCapable, false);
  assert.equal(descriptor.governanceDecisionCapable, false);

  assert.ok(descriptor.capabilities.includes("read_projects"));
  assert.ok(descriptor.forbiddenOperations.includes("update_project"));
  assert.ok(descriptor.disclaimers.length > 0);
  assert.ok(descriptor.safeLabels.length > 0);
});

test("descriptor is deterministic across calls", () => {
  const a = createAocPMFreakReadOnlyConnectorDescriptor();
  const b = createAocPMFreakReadOnlyConnectorDescriptor();
  assert.deepEqual(a, b);
});
