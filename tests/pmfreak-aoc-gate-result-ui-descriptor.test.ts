import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateResultUIDescriptor, PMFREAK_AOC_GATE_RESULT_UI_ID } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("descriptor has the correct feature ID", () => {
  const descriptor = createPMFreakAocGateResultUIDescriptor();
  assert.equal(descriptor.featureId, PMFREAK_AOC_GATE_RESULT_UI_ID);
  assert.equal(descriptor.featureId, "pmfreak.integration.aoc.gate_result_ui.v1");
});

test("descriptor states PMFreak consumes AOC Governance", () => {
  const descriptor = createPMFreakAocGateResultUIDescriptor();
  assert.equal(descriptor.runtimeDirection, "pmfreak_consumes_aoc_governance");
  assert.ok(descriptor.safeLabels.includes("PMFreak consumes AOC Governance"));
});

test("descriptor states presentationOnly = true", () => {
  const descriptor = createPMFreakAocGateResultUIDescriptor();
  assert.equal(descriptor.presentationOnly, true);
});

test("descriptor states no action execution, mutation, writeback, invoice creation, communications or legal/compliance certification", () => {
  const descriptor = createPMFreakAocGateResultUIDescriptor();
  assert.equal(descriptor.actionExecutionCapable, false);
  assert.equal(descriptor.productionMutationCapable, false);
  assert.equal(descriptor.decisionWritebackCapable, false);
  assert.equal(descriptor.invoiceCreationCapable, false);
  assert.equal(descriptor.communicationCapable, false);
  assert.equal(descriptor.legalCertificationCapable, false);
  assert.equal(descriptor.complianceCertificationCapable, false);

  const text = JSON.stringify(descriptor.disclaimers);
  assert.ok(text.includes("does not execute PMFreak actions"));
  assert.ok(text.includes("does not mutate PMFreak data"));
  assert.ok(text.includes("does not write decisions back"));
  assert.ok(text.includes("does not create invoices"));
  assert.ok(text.includes("does not send communications"));
  assert.ok(text.includes("does not certify compliance"));
  assert.ok(text.includes("does not certify customer acceptance"));
  assert.ok(text.includes("does not certify invoice validity"));
  assert.ok(text.includes("does not provide legal advice"));
});

test("descriptor lists capabilities and forbidden operations", () => {
  const descriptor = createPMFreakAocGateResultUIDescriptor();
  assert.ok(descriptor.capabilities.includes("create_display_model"));
  assert.ok(descriptor.capabilities.includes("render_safe_gate_result"));
  assert.ok(descriptor.forbiddenOperations.includes("execute_action"));
  assert.ok(descriptor.forbiddenOperations.includes("create_invoice"));
  assert.ok(descriptor.forbiddenOperations.includes("mark_milestone_billing_ready"));
});
