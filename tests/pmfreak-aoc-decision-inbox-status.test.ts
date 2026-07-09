import test from "node:test";
import assert from "node:assert/strict";

import { mapPMFreakAocDecisionToInboxStatus } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const CASES: Array<[string, string]> = [
  ["allow", "allowed"],
  ["deny", "blocked"],
  ["hold", "held"],
  ["require_evidence", "needs_evidence"],
  ["require_pm_approval", "needs_pm_approval"],
  ["require_customer_validation", "needs_customer_validation"],
  ["require_billing_review", "needs_billing_review"],
  ["require_contract_review", "needs_contract_review"],
  ["require_security_review", "needs_security_review"],
  ["require_executive_approval", "needs_executive_approval"],
];

test("decision status mapping covers all known decisions", () => {
  for (const [decision, expected] of CASES) {
    assert.equal(mapPMFreakAocDecisionToInboxStatus(decision as never), expected);
  }
});

test("decision status mapping falls back to unknown for unrecognized decisions", () => {
  assert.equal(mapPMFreakAocDecisionToInboxStatus("something_else" as never), "unknown");
});
