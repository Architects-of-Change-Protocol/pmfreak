import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocDecisionInboxDescriptor, PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("descriptor has the correct feature ID", () => {
  const descriptor = createPMFreakAocDecisionInboxDescriptor();
  assert.equal(descriptor.featureId, PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID);
  assert.equal(descriptor.featureId, "pmfreak.integration.aoc.decision_display_inbox.v1");
});

test("descriptor states PMFreak consumes AOC Governance", () => {
  const descriptor = createPMFreakAocDecisionInboxDescriptor();
  assert.equal(descriptor.runtimeDirection, "pmfreak_consumes_aoc_governance");
  assert.ok(descriptor.safeLabels.includes("PMFreak consumes AOC Governance"));
});

test("descriptor states displayOnly = true", () => {
  const descriptor = createPMFreakAocDecisionInboxDescriptor();
  assert.equal(descriptor.displayOnly, true);
});

test("descriptor states no action execution, mutation, writeback, invoice creation, communications or enforcement", () => {
  const descriptor = createPMFreakAocDecisionInboxDescriptor();
  assert.equal(descriptor.actionExecutionCapable, false);
  assert.equal(descriptor.productionMutationCapable, false);
  assert.equal(descriptor.decisionWritebackCapable, false);
  assert.equal(descriptor.invoiceCreationCapable, false);
  assert.equal(descriptor.communicationCapable, false);
  assert.equal(descriptor.enforcementCapable, false);

  const text = JSON.stringify(descriptor.disclaimers);
  assert.ok(text.includes("does not execute PMFreak actions"));
  assert.ok(text.includes("does not mutate PMFreak data"));
  assert.ok(text.includes("does not write decisions back"));
  assert.ok(text.includes("does not create invoices"));
  assert.ok(text.includes("does not send communications"));
  assert.ok(text.includes("does not enforce decisions"));
});

test("descriptor lists capabilities and forbidden operations", () => {
  const descriptor = createPMFreakAocDecisionInboxDescriptor();
  assert.ok(descriptor.capabilities.includes("normalize_governance_response"));
  assert.ok(descriptor.forbiddenOperations.includes("execute_action"));
  assert.ok(descriptor.forbiddenOperations.includes("create_invoice"));
});
