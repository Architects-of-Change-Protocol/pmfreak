import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocRiskEscalationAllowedRequest,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("governance request carries optional risk/billing/policy context when supplied", () => {
  const billingRequest = demoPMFreakAocBillingAllowedRequest();
  assert.ok(billingRequest.billingContext);
  assert.equal(billingRequest.billingContext?.billingSensitive, true);

  const riskRequest = demoPMFreakAocRiskEscalationAllowedRequest();
  assert.ok(riskRequest.riskContext);
  assert.deepEqual(riskRequest.riskContext?.riskIds, ["demo.risk.aoc-fixture.v1"]);
});

test("governance request always carries safeLabels, warnings and errors arrays", () => {
  const request = demoPMFreakAocBillingAllowedRequest();

  assert.ok(Array.isArray(request.safeLabels));
  assert.ok(request.safeLabels.length > 0);
  assert.ok(Array.isArray(request.warnings));
  assert.ok(Array.isArray(request.errors));
});

test("governance request evidence and approval contexts track provided vs missing separately", () => {
  const request = demoPMFreakAocBillingAllowedRequest();

  assert.deepEqual(request.evidenceContext.missingEvidenceIds, []);
  assert.ok(request.evidenceContext.providedEvidenceIds.length > 0);
  assert.deepEqual(request.approvalContext.missingApprovalIds, []);
  assert.ok(request.approvalContext.providedApprovalIds.length > 0);
});
