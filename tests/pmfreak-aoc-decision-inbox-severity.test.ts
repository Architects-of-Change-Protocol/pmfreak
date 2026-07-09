import test from "node:test";
import assert from "node:assert/strict";

import { mapPMFreakAocDecisionToInboxSeverity } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("severity mapping maps allow to success", () => {
  assert.equal(mapPMFreakAocDecisionToInboxSeverity("allow" as never), "success");
});

test("severity mapping maps deny to danger", () => {
  assert.equal(mapPMFreakAocDecisionToInboxSeverity("deny" as never), "danger");
});

test("severity mapping maps hold to warning", () => {
  assert.equal(mapPMFreakAocDecisionToInboxSeverity("hold" as never), "warning");
});

test("severity mapping maps require_* decisions to warning", () => {
  for (const decision of [
    "require_evidence",
    "require_pm_approval",
    "require_customer_validation",
    "require_billing_review",
    "require_contract_review",
    "require_security_review",
    "require_executive_approval",
  ]) {
    assert.equal(mapPMFreakAocDecisionToInboxSeverity(decision as never), "warning");
  }
});

test("severity mapping falls back to responseSeverity for unrecognized decisions", () => {
  assert.equal(mapPMFreakAocDecisionToInboxSeverity("unrecognized" as never, "danger"), "danger");
});

test("severity mapping falls back to info when nothing else is known", () => {
  assert.equal(mapPMFreakAocDecisionToInboxSeverity("unrecognized" as never), "info");
});
