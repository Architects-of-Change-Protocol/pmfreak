import test from "node:test";
import assert from "node:assert/strict";

import { mapPMFreakAocDecisionToGateVerdict, mapPMFreakAocGateVerdictToSeverity } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const DECISION_TO_VERDICT: Array<[string, string]> = [
  ["allow", "passed"],
  ["deny", "blocked"],
  ["hold", "held"],
  ["require_evidence", "needs_evidence"],
  ["require_pm_approval", "needs_approval"],
  ["require_customer_validation", "needs_review"],
  ["require_billing_review", "needs_review"],
  ["require_contract_review", "needs_review"],
  ["require_security_review", "needs_review"],
  ["require_executive_approval", "needs_approval"],
];

for (const [decision, verdict] of DECISION_TO_VERDICT) {
  test(`${decision} maps to ${verdict}`, () => {
    assert.equal(mapPMFreakAocDecisionToGateVerdict(decision as never), verdict);
  });
}

test("undefined decision maps to error", () => {
  assert.equal(mapPMFreakAocDecisionToGateVerdict(undefined), "error");
});

test("unknown decision maps to error", () => {
  assert.equal(mapPMFreakAocDecisionToGateVerdict("not_a_real_decision" as never), "error");
});

const VERDICT_TO_SEVERITY: Array<[string, string]> = [
  ["passed", "success"],
  ["blocked", "danger"],
  ["held", "warning"],
  ["needs_evidence", "warning"],
  ["needs_approval", "warning"],
  ["needs_review", "warning"],
  ["error", "danger"],
];

for (const [verdict, severity] of VERDICT_TO_SEVERITY) {
  test(`${verdict} verdict maps to ${severity} severity`, () => {
    assert.equal(mapPMFreakAocGateVerdictToSeverity(verdict as never), severity);
  });
}
