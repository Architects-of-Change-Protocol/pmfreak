import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocDecisionInboxAllowItem,
  demoPMFreakAocDecisionInboxDenyItem,
  demoPMFreakAocDecisionInboxEmpty,
  demoPMFreakAocDecisionInboxHoldItem,
  demoPMFreakAocDecisionInboxMixedItems,
  demoPMFreakAocDecisionInboxRequireBillingReviewItem,
  demoPMFreakAocDecisionInboxRequireContractReviewItem,
  demoPMFreakAocDecisionInboxRequireCustomerValidationItem,
  demoPMFreakAocDecisionInboxRequireEvidenceItem,
  demoPMFreakAocDecisionInboxRequireExecutiveApprovalItem,
  demoPMFreakAocDecisionInboxRequirePmApprovalItem,
  demoPMFreakAocDecisionInboxRequireSecurityReviewItem,
  demoPMFreakAocDecisionInboxWithErrors,
  demoPMFreakAocDecisionInboxWithWarnings,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const REAL_LOOKING_PATTERNS = [/@gmail\.com/i, /@datasys/i, /\bINV-\d/i, /\bCR-\d{6,}/];

test("item fixtures produce the expected decision for each scenario", async () => {
  assert.equal((await demoPMFreakAocDecisionInboxAllowItem()).decision, "allow");
  assert.equal((await demoPMFreakAocDecisionInboxDenyItem()).decision, "deny");
  assert.equal((await demoPMFreakAocDecisionInboxHoldItem()).decision, "hold");
  assert.equal((await demoPMFreakAocDecisionInboxRequireEvidenceItem()).decision, "require_evidence");
  assert.equal((await demoPMFreakAocDecisionInboxRequirePmApprovalItem()).decision, "require_pm_approval");
  assert.equal((await demoPMFreakAocDecisionInboxRequireCustomerValidationItem()).decision, "require_customer_validation");
  assert.equal((await demoPMFreakAocDecisionInboxRequireBillingReviewItem()).decision, "require_billing_review");
  assert.equal((await demoPMFreakAocDecisionInboxRequireContractReviewItem()).decision, "require_contract_review");
  assert.equal((await demoPMFreakAocDecisionInboxRequireSecurityReviewItem()).decision, "require_security_review");
  assert.equal((await demoPMFreakAocDecisionInboxRequireExecutiveApprovalItem()).decision, "require_executive_approval");
});

test("fixtures are deterministic across calls", async () => {
  assert.deepEqual(await demoPMFreakAocDecisionInboxAllowItem(), await demoPMFreakAocDecisionInboxAllowItem());
  assert.deepEqual(await demoPMFreakAocDecisionInboxRequireEvidenceItem(), await demoPMFreakAocDecisionInboxRequireEvidenceItem());
  assert.deepEqual(await demoPMFreakAocDecisionInboxMixedItems(), await demoPMFreakAocDecisionInboxMixedItems());
});

test("collection fixtures behave as expected", async () => {
  assert.equal(demoPMFreakAocDecisionInboxEmpty().length, 0);

  const mixed = await demoPMFreakAocDecisionInboxMixedItems();
  assert.equal(mixed.length, 10);

  const withErrors = await demoPMFreakAocDecisionInboxWithErrors();
  assert.ok(withErrors.length > 0);
  assert.ok(withErrors.every((item) => item.errors.length > 0));

  const withWarnings = await demoPMFreakAocDecisionInboxWithWarnings();
  assert.ok(withWarnings.length > 0);
  assert.ok(withWarnings.every((item) => item.warnings.length > 0));
});

test("fixtures use only fake, demo-only identifiers", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const serialized = JSON.stringify(items);

  for (const pattern of REAL_LOOKING_PATTERNS) {
    assert.ok(!pattern.test(serialized), `fixtures must not contain real-looking identifier matching ${pattern}`);
  }
  assert.ok(serialized.includes("demo."), "fixture identifiers should be namespaced under demo.*");
});
