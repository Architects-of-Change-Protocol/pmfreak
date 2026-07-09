import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocDecisionInboxConfig } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("config defaults are safe", () => {
  const config = createPMFreakAocDecisionInboxConfig();
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowProductionMutations, false);
  assert.equal(config.allowDecisionWriteback, false);
  assert.equal(config.allowInvoiceCreation, false);
  assert.equal(config.allowCommunications, false);
  assert.equal(config.allowEnforcement, false);
});

test("config defaults displayMode to demo", () => {
  assert.equal(createPMFreakAocDecisionInboxConfig().displayMode, "demo");
});

test("config defaults maxItems to 100", () => {
  assert.equal(createPMFreakAocDecisionInboxConfig().maxItems, 100);
});

test("config defaults defaultSort to newest_first", () => {
  assert.equal(createPMFreakAocDecisionInboxConfig().defaultSort, "newest_first");
});

test("config defaults redactionMode to safe_demo", () => {
  assert.equal(createPMFreakAocDecisionInboxConfig().redactionMode, "safe_demo");
});

const unsafeOverrides: Array<[string, Record<string, unknown>]> = [
  ["allowActionExecution", { allowActionExecution: true }],
  ["allowProductionMutations", { allowProductionMutations: true }],
  ["allowDecisionWriteback", { allowDecisionWriteback: true }],
  ["allowInvoiceCreation", { allowInvoiceCreation: true }],
  ["allowCommunications", { allowCommunications: true }],
  ["allowEnforcement", { allowEnforcement: true }],
];

for (const [key, override] of unsafeOverrides) {
  test(`config cannot enable ${key}`, () => {
    const config = createPMFreakAocDecisionInboxConfig(override as never);
    assert.equal((config as Record<string, unknown>)[key], false);
    assert.ok(config.warnings.some((warning) => warning.includes(key)));
  });
}
