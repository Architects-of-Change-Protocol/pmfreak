import test from "node:test";
import assert from "node:assert/strict";

import { inferPMFreakAocEvidenceRequirementType } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const cases: Array<[string, string]> = [
  ["evidence.demo.customer-acceptance.missing", "customer_acceptance"],
  ["evidence.demo.acceptance.required", "customer_acceptance"],
  ["evidence.demo.billing-review.required", "billing_review"],
  ["demo.invoice.reference.v1", "billing_review"],
  ["evidence.demo.contract-review.required", "contract_review"],
  ["evidence.demo.security-review.required", "security_review"],
  ["approval.demo.executive.required", "executive_approval"],
  ["demo.approval.pm_approval.v1", "pm_approval"],
  ["demo.approval.project-manager.v1", "pm_approval"],
  ["demo.evidence.delivery-confirmation.v1", "delivery_confirmation"],
  ["demo.evidence.technical.v1", "technical_validation"],
  ["demo.evidence.validation.v1", "technical_validation"],
  ["demo.approval.change-request.v1", "change_approval"],
  ["demo.evidence.risk-assessment.v1", "risk_review"],
  ["demo.evidence.unrecognized-reference.v1", "unknown"],
];

for (const [referenceId, expectedType] of cases) {
  test(`infers ${expectedType} for reference "${referenceId}"`, () => {
    assert.equal(inferPMFreakAocEvidenceRequirementType({ referenceId }), expectedType);
  });
}

test("referenceId match takes priority over actionCategory", () => {
  assert.equal(inferPMFreakAocEvidenceRequirementType({ referenceId: "demo.evidence.security-review.v1", actionCategory: "billing" }), "security_review");
});

test("falls back to actionCategory when referenceId has no match", () => {
  assert.equal(inferPMFreakAocEvidenceRequirementType({ referenceId: "demo.evidence.unrecognized.v1", actionCategory: "billing" }), "billing_review");
  assert.equal(inferPMFreakAocEvidenceRequirementType({ referenceId: "demo.evidence.unrecognized.v1", actionCategory: "contract" }), "contract_review");
  assert.equal(inferPMFreakAocEvidenceRequirementType({ referenceId: "demo.evidence.unrecognized.v1", actionCategory: "security" }), "security_review");
});

test("falls back to unknown when neither referenceId nor actionCategory match", () => {
  assert.equal(inferPMFreakAocEvidenceRequirementType({ referenceId: "demo.evidence.unrecognized.v1", actionCategory: "planning" }), "unknown");
  assert.equal(inferPMFreakAocEvidenceRequirementType({ referenceId: "demo.evidence.unrecognized.v1" }), "unknown");
});

test("type inference is case-insensitive", () => {
  assert.equal(inferPMFreakAocEvidenceRequirementType({ referenceId: "DEMO.EVIDENCE.CUSTOMER-ACCEPTANCE.V1" }), "customer_acceptance");
});
