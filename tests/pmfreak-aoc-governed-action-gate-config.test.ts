import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGovernedActionGateConfig } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("config defaults are safe", () => {
  const config = createPMFreakAocGovernedActionGateConfig();
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowProductionMutations, false);
  assert.equal(config.allowDecisionWriteback, false);
  assert.equal(config.allowInvoiceCreation, false);
  assert.equal(config.allowCommunications, false);
  assert.equal(config.allowLegalCertification, false);
  assert.equal(config.allowComplianceCertification, false);
  assert.equal(config.treatAllowAsExecutable, false);
});

test("config defaults mode to dry_run", () => {
  assert.equal(createPMFreakAocGovernedActionGateConfig().mode, "dry_run");
});

test("config defaults source to governance_response", () => {
  assert.equal(createPMFreakAocGovernedActionGateConfig().defaultSource, "governance_response");
});

test("config defaults requireMatchingRequestId and requireMatchingClientId to true", () => {
  const config = createPMFreakAocGovernedActionGateConfig();
  assert.equal(config.requireMatchingRequestId, true);
  assert.equal(config.requireMatchingClientId, true);
});

test("config defaults requireFreshGovernanceResponse to false", () => {
  assert.equal(createPMFreakAocGovernedActionGateConfig().requireFreshGovernanceResponse, false);
});

test("config defaults redactionMode to safe_demo", () => {
  assert.equal(createPMFreakAocGovernedActionGateConfig().redactionMode, "safe_demo");
});

const unsafeOverrides: Array<[string, Record<string, unknown>]> = [
  ["allowActionExecution", { allowActionExecution: true }],
  ["allowProductionMutations", { allowProductionMutations: true }],
  ["allowDecisionWriteback", { allowDecisionWriteback: true }],
  ["allowInvoiceCreation", { allowInvoiceCreation: true }],
  ["allowCommunications", { allowCommunications: true }],
  ["allowLegalCertification", { allowLegalCertification: true }],
  ["allowComplianceCertification", { allowComplianceCertification: true }],
  ["treatAllowAsExecutable", { treatAllowAsExecutable: true }],
];

for (const [key, override] of unsafeOverrides) {
  test(`config cannot enable ${key}`, () => {
    const config = createPMFreakAocGovernedActionGateConfig(override as never);
    assert.equal((config as Record<string, unknown>)[key], false);
    assert.ok(config.warnings.some((warning) => warning.includes(key)));
  });
}
