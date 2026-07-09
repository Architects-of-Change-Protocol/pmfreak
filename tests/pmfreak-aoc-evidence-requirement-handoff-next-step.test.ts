import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocEvidenceRequirementHandoffSafeNextStep, extractPMFreakAocEvidenceRequirementReferences } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

function itemsFor(missingEvidenceIds: string[] = [], missingApprovalIds: string[] = []) {
  return extractPMFreakAocEvidenceRequirementReferences({ missingEvidenceIds, missingApprovalIds, source: "gate_result" });
}

test("next step for missing customer_acceptance", () => {
  const step = createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor(["evidence.demo.customer-acceptance.missing"]) });
  assert.equal(step, "Collect or link customer acceptance evidence before attempting this action again.");
});

test("next step for missing billing_review", () => {
  const step = createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor(["evidence.demo.billing-review.required"]) });
  assert.equal(step, "Prepare the evidence package for billing review. This handoff does not approve billing or create an invoice.");
});

test("next step for missing contract_review", () => {
  const step = createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor(["evidence.demo.contract-review.required"]) });
  assert.equal(step, "Prepare the required contract review references before attempting this action again.");
});

test("next step for missing security_review", () => {
  const step = createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor(["evidence.demo.security-review.required"]) });
  assert.equal(step, "Prepare the required security review references before attempting this action again.");
});

test("next step for missing approval reference", () => {
  const step = createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor([], ["approval.demo.pm.required"]) });
  assert.equal(step, "Collect the required approval references before attempting this action again.");
});

test("next step falls back to a generic review sentence", () => {
  const step = createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: [] });
  assert.equal(step, "Review the evidence requirements before attempting this action again.");
});

test("priority order: customer_acceptance wins over billing_review", () => {
  const step = createPMFreakAocEvidenceRequirementHandoffSafeNextStep({
    requirementItems: itemsFor(["evidence.demo.customer-acceptance.missing", "evidence.demo.billing-review.required"]),
  });
  assert.equal(step, "Collect or link customer acceptance evidence before attempting this action again.");
});

const UNSAFE_PHRASES = [
  "legally sufficient",
  "customer acceptance valid",
  "invoice approved",
  "billing authorized",
  "compliance passed",
  "contract satisfied",
  "action approved",
  "evidence validated",
];

test("no safe next-step sentence contains an unsafe phrase", () => {
  const allSteps = [
    createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor(["evidence.demo.customer-acceptance.missing"]) }),
    createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor(["evidence.demo.billing-review.required"]) }),
    createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor(["evidence.demo.contract-review.required"]) }),
    createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor(["evidence.demo.security-review.required"]) }),
    createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: itemsFor([], ["approval.demo.pm.required"]) }),
    createPMFreakAocEvidenceRequirementHandoffSafeNextStep({ requirementItems: [] }),
  ];
  for (const step of allSteps) {
    for (const phrase of UNSAFE_PHRASES) {
      assert.ok(!step.toLowerCase().includes(phrase), `"${step}" should not include "${phrase}"`);
    }
  }
});
