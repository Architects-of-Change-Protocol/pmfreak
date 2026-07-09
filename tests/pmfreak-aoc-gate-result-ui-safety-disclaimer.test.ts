import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateSafetyDisclaimerViewModel, demoPMFreakAocGovernedActionGateBlockedResult, demoPMFreakAocGovernedActionGatePassedResult } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("safety disclaimer includes no execution/mutation/writeback/invoice/communications messages", async () => {
  const result = await demoPMFreakAocGovernedActionGateBlockedResult();
  const disclaimer = createPMFreakAocGateSafetyDisclaimerViewModel(result);
  const text = JSON.stringify(disclaimer.messages);
  assert.ok(text.includes("does not execute PMFreak actions"));
  assert.ok(text.includes("does not mutate PMFreak data"));
  assert.ok(text.includes("does not write decisions back"));
  assert.ok(text.includes("does not create invoices"));
  assert.ok(text.includes("does not send communications"));
});

test("safety disclaimer for passed explains passed is not executed/legal/compliance/invoice/customer acceptance", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const disclaimer = createPMFreakAocGateSafetyDisclaimerViewModel(result);
  const text = disclaimer.messages.join(" ");
  assert.ok(text.includes("does not mean the action was executed"));
  assert.ok(text.includes("legally approved"));
  assert.ok(text.includes("compliance-certified"));
  assert.ok(text.includes("invoice-valid"));
  assert.ok(text.includes("customer-accepted"));
});

test("safety disclaimer is presentation-only", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const disclaimer = createPMFreakAocGateSafetyDisclaimerViewModel(result);
  assert.equal(disclaimer.presentationOnly, true);
  assert.equal(disclaimer.kind, "gate_safety_disclaimer");
});
