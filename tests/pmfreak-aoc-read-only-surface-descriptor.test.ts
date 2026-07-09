import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_AOC_READ_ONLY_SURFACE_ID,
  createPMFreakAocReadOnlySurfaceDescriptor,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";

test("creates surface descriptor", () => {
  const descriptor = createPMFreakAocReadOnlySurfaceDescriptor();

  assert.equal(descriptor.surfaceId, "pmfreak.integration.aoc.read_only_surface.v1");
  assert.equal(descriptor.surfaceId, PMFREAK_AOC_READ_ONLY_SURFACE_ID);
  assert.equal(descriptor.providerId, "pmfreak");
  assert.equal(descriptor.consumerId, "aoc");
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
  const a = createPMFreakAocReadOnlySurfaceDescriptor();
  const b = createPMFreakAocReadOnlySurfaceDescriptor();
  assert.deepEqual(a, b);
});
