import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocSurfaceHealth,
  createPMFreakAocReadOnlySurfaceConfig,
} from "../src/features/pmfreak-integrations/aoc-read-only-surface";

const config = createPMFreakAocReadOnlySurfaceConfig();

test("surface health is healthy without errors/warnings", () => {
  const health = createPMFreakAocSurfaceHealth({ config });
  assert.equal(health.status, "healthy");
  assert.equal(health.readOnly, true);
  assert.equal(health.allowMutations, false);
});

test("surface health is degraded with warnings", () => {
  const health = createPMFreakAocSurfaceHealth({ config, warnings: ["some non-fatal note"] });
  assert.ok(health.warnings.length > 0);
  assert.equal(health.status, "degraded");
});

test("surface health is unavailable with errors", () => {
  const health = createPMFreakAocSurfaceHealth({ config, errors: ["source unreachable"] });
  assert.ok(health.errors.length > 0);
  assert.equal(health.status, "unavailable");
});

test("errors take priority over warnings", () => {
  const health = createPMFreakAocSurfaceHealth({ config, warnings: ["note"], errors: ["failure"] });
  assert.equal(health.status, "unavailable");
});
