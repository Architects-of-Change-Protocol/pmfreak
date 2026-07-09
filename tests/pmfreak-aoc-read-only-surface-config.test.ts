import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocReadOnlySurfaceConfig } from "../src/features/pmfreak-integrations/aoc-read-only-surface";

test("creates default surface config safely", () => {
  const config = createPMFreakAocReadOnlySurfaceConfig();

  assert.equal(config.surfaceId, "pmfreak.integration.aoc.read_only_surface.v1");
  assert.equal(config.environment, "demo");
  assert.equal(config.sourceKind, "in_memory");
  assert.equal(config.readOnly, true);
  assert.equal(config.allowMutations, false);
  assert.equal(config.redactionMode, "safe_demo");
  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.maxRecords, 100);
  assert.deepEqual(config.notes, []);
  assert.deepEqual(config.warnings, []);
});

test("config cannot enable mutations", () => {
  const config = createPMFreakAocReadOnlySurfaceConfig({
    readOnly: false as unknown as true,
    allowMutations: true as unknown as false,
  });

  assert.equal(config.readOnly, true);
  assert.equal(config.allowMutations, false);
  assert.ok(config.warnings.some((w) => w.includes("readOnly was forced to true")));
  assert.ok(config.warnings.some((w) => w.includes("allowMutations was forced to false")));
});

test("config accepts optional scoping fields without requiring baseUrl for in_memory source", () => {
  const config = createPMFreakAocReadOnlySurfaceConfig({
    tenantId: "tenant.demo.pmfreak",
    workspaceId: "workspace.demo.pmfreak",
    projectId: "project.demo.network-refresh",
  });

  assert.equal(config.sourceKind, "in_memory");
  assert.equal(config.baseUrl, undefined);
  assert.equal(config.tenantId, "tenant.demo.pmfreak");
});
