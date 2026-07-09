import test from "node:test";
import assert from "node:assert/strict";

import { createAocPMFreakReadOnlyConnectorConfig } from "../src/features/aoc-integrations/pmfreak-read-only-connector";

test("creates default connector config safely", () => {
  const config = createAocPMFreakReadOnlyConnectorConfig();

  assert.equal(config.connectorId, "aoc.integration.pmfreak.read_only_connector.v1");
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
  const config = createAocPMFreakReadOnlyConnectorConfig({
    readOnly: false as unknown as true,
    allowMutations: true as unknown as false,
  });

  assert.equal(config.readOnly, true);
  assert.equal(config.allowMutations, false);
  assert.ok(config.warnings.some((w) => w.includes("readOnly was forced to true")));
  assert.ok(config.warnings.some((w) => w.includes("allowMutations was forced to false")));
});

test("config accepts optional scoping fields without requiring baseUrl for in_memory source", () => {
  const config = createAocPMFreakReadOnlyConnectorConfig({
    tenantId: "tenant.demo.pmfreak",
    workspaceId: "workspace.demo.pmfreak",
    projectId: "project.demo.network-refresh",
  });

  assert.equal(config.sourceKind, "in_memory");
  assert.equal(config.baseUrl, undefined);
  assert.equal(config.tenantId, "tenant.demo.pmfreak");
});
