import test from "node:test";
import assert from "node:assert/strict";

import {
  createAocPMFreakConnectorHealth,
  createAocPMFreakReadOnlyConnectorConfig,
} from "../src/features/aoc-integrations/pmfreak-read-only-connector";

const config = createAocPMFreakReadOnlyConnectorConfig();

test("connector health is healthy without errors/warnings", () => {
  const health = createAocPMFreakConnectorHealth({ config });
  assert.equal(health.status, "healthy");
  assert.equal(health.readOnly, true);
  assert.equal(health.allowMutations, false);
});

test("connector health is degraded with warnings", () => {
  const health = createAocPMFreakConnectorHealth({ config, warnings: ["some non-fatal note"] });
  assert.ok(health.warnings.length > 0);
  assert.equal(health.status, "degraded");
});

test("connector health is unavailable with errors", () => {
  const health = createAocPMFreakConnectorHealth({ config, errors: ["source unreachable"] });
  assert.ok(health.errors.length > 0);
  assert.equal(health.status, "unavailable");
});

test("errors take priority over warnings", () => {
  const health = createAocPMFreakConnectorHealth({ config, warnings: ["note"], errors: ["failure"] });
  assert.equal(health.status, "unavailable");
});
