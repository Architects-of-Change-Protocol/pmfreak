import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateResultUIConfig } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("config defaults are safe", () => {
  const config = createPMFreakAocGateResultUIConfig();
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowProductionMutations, false);
  assert.equal(config.allowDecisionWriteback, false);
  assert.equal(config.allowInvoiceCreation, false);
  assert.equal(config.allowCommunications, false);
  assert.equal(config.allowLegalCertification, false);
  assert.equal(config.allowComplianceCertification, false);
  assert.equal(config.showExecutionButtons, false);
  assert.equal(config.showMutationButtons, false);
  assert.equal(config.showInvoiceButtons, false);
  assert.equal(config.showCommunicationButtons, false);
});

test("config defaults displayMode to card", () => {
  assert.equal(createPMFreakAocGateResultUIConfig().displayMode, "card");
});

test("config defaults showTrace/showRequirements/showSafetyDisclaimer to true", () => {
  const config = createPMFreakAocGateResultUIConfig();
  assert.equal(config.showTrace, true);
  assert.equal(config.showRequirements, true);
  assert.equal(config.showSafetyDisclaimer, true);
  assert.equal(config.showReasonCodes, true);
  assert.equal(config.showSafeLabels, true);
  assert.equal(config.showWarnings, true);
  assert.equal(config.showErrors, true);
});

test("config defaults redactionMode to safe_demo", () => {
  assert.equal(createPMFreakAocGateResultUIConfig().redactionMode, "safe_demo");
});

const unsafeOverrides: Array<[string, Record<string, unknown>]> = [
  ["allowActionExecution", { allowActionExecution: true }],
  ["allowProductionMutations", { allowProductionMutations: true }],
  ["allowDecisionWriteback", { allowDecisionWriteback: true }],
  ["allowInvoiceCreation", { allowInvoiceCreation: true }],
  ["allowCommunications", { allowCommunications: true }],
  ["allowLegalCertification", { allowLegalCertification: true }],
  ["allowComplianceCertification", { allowComplianceCertification: true }],
  ["showExecutionButtons", { showExecutionButtons: true }],
  ["showMutationButtons", { showMutationButtons: true }],
  ["showInvoiceButtons", { showInvoiceButtons: true }],
  ["showCommunicationButtons", { showCommunicationButtons: true }],
];

for (const [key, override] of unsafeOverrides) {
  test(`config cannot enable ${key}`, () => {
    const config = createPMFreakAocGateResultUIConfig(override as never);
    assert.equal((config as Record<string, unknown>)[key], false);
    assert.ok(config.warnings.some((warning) => warning.includes(key)));
  });
}
