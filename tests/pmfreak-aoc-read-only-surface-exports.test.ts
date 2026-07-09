import test from "node:test";
import assert from "node:assert/strict";

import * as surface from "../src/features/pmfreak-integrations/aoc-read-only-surface";

test("public exports are complete", () => {
  const expectedConstants = [
    "PMFREAK_AOC_READ_ONLY_SURFACE_ID",
    "PMFREAK_AOC_READ_ONLY_SURFACE_NAME",
    "PMFREAK_AOC_PROVIDER_SYSTEM_ID",
    "PMFREAK_AOC_CONSUMER_SYSTEM_ID",
    "PMFREAK_AOC_READ_ONLY_SURFACE_CAPABILITIES",
    "PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS",
  ];

  const expectedFunctions = [
    "createPMFreakAocReadOnlySurfaceDescriptor",
    "createPMFreakAocReadOnlySurfaceConfig",
    "createPMFreakAocReadOnlySurfaceClient",
    "createPMFreakAocSurfaceSnapshot",
    "createPMFreakAocSurfaceHealth",
    "createPMFreakAocSurfaceError",
    "createInMemoryPMFreakAocReadOnlySource",
    "createUnsupportedPMFreakAocRealReadOnlySource",
    "assertPMFreakAocReadOnlyOperation",
    "isPMFreakAocForbiddenSurfaceOperation",
    "redactPMFreakAocSurfaceValue",
    "redactPMFreakAocSurfaceSnapshot",
    "evaluatePMFreakAocReadOnlySurfaceClaimSafety",
    "assertNoPMFreakAocReadOnlySurfaceOverclaim",
  ];

  for (const name of expectedConstants) {
    assert.notEqual((surface as Record<string, unknown>)[name], undefined, `missing export: ${name}`);
  }

  for (const name of expectedFunctions) {
    assert.equal(typeof (surface as Record<string, unknown>)[name], "function", `missing function export: ${name}`);
  }
});

test("surface ID and name constants have the expected values", () => {
  assert.equal(surface.PMFREAK_AOC_READ_ONLY_SURFACE_ID, "pmfreak.integration.aoc.read_only_surface.v1");
  assert.equal(surface.PMFREAK_AOC_READ_ONLY_SURFACE_NAME, "PMFreak AOC Read-Only Integration Surface v1");
  assert.equal(surface.PMFREAK_AOC_PROVIDER_SYSTEM_ID, "pmfreak");
  assert.equal(surface.PMFREAK_AOC_CONSUMER_SYSTEM_ID, "aoc");
});
