import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocEvidenceRequirementHandoffConfig } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("config defaults are safe", () => {
  const config = createPMFreakAocEvidenceRequirementHandoffConfig();
  assert.equal(config.allowEvidenceAttachment, false);
  assert.equal(config.allowFileUpload, false);
  assert.equal(config.allowTaskCreation, false);
  assert.equal(config.allowActionExecution, false);
  assert.equal(config.allowProductionMutations, false);
  assert.equal(config.allowDecisionWriteback, false);
  assert.equal(config.allowInvoiceCreation, false);
  assert.equal(config.allowCommunications, false);
  assert.equal(config.allowLegalCertification, false);
  assert.equal(config.allowComplianceCertification, false);
  assert.equal(config.allowCustomerAcceptanceCertification, false);
});

test("config defaults mode to dry_run", () => {
  assert.equal(createPMFreakAocEvidenceRequirementHandoffConfig().mode, "dry_run");
});

test("config defaults defaultSource to gate_result", () => {
  assert.equal(createPMFreakAocEvidenceRequirementHandoffConfig().defaultSource, "gate_result");
});

test("config defaults include flags to true", () => {
  const config = createPMFreakAocEvidenceRequirementHandoffConfig();
  assert.equal(config.includeApprovalReferences, true);
  assert.equal(config.includeGateTrace, true);
  assert.equal(config.includeSafetyDisclaimers, true);
  assert.equal(config.includeChecklist, true);
  assert.equal(config.includeReviewPacket, true);
});

test("config defaults redactionMode to safe_demo", () => {
  assert.equal(createPMFreakAocEvidenceRequirementHandoffConfig().redactionMode, "safe_demo");
});

const unsafeOverrides: Array<[string, Record<string, unknown>]> = [
  ["allowEvidenceAttachment", { allowEvidenceAttachment: true }],
  ["allowFileUpload", { allowFileUpload: true }],
  ["allowTaskCreation", { allowTaskCreation: true }],
  ["allowActionExecution", { allowActionExecution: true }],
  ["allowProductionMutations", { allowProductionMutations: true }],
  ["allowDecisionWriteback", { allowDecisionWriteback: true }],
  ["allowInvoiceCreation", { allowInvoiceCreation: true }],
  ["allowCommunications", { allowCommunications: true }],
  ["allowLegalCertification", { allowLegalCertification: true }],
  ["allowComplianceCertification", { allowComplianceCertification: true }],
  ["allowCustomerAcceptanceCertification", { allowCustomerAcceptanceCertification: true }],
];

for (const [key, override] of unsafeOverrides) {
  test(`config cannot enable ${key}`, () => {
    const config = createPMFreakAocEvidenceRequirementHandoffConfig(override as never);
    assert.equal((config as Record<string, unknown>)[key], false);
    assert.ok(config.warnings.some((warning) => warning.includes(key)));
  });
}
