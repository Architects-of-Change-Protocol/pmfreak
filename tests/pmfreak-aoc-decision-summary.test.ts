import test from "node:test";
import assert from "node:assert/strict";

import {
  createLocalMockPMFreakAocGovernanceTransport,
  createPMFreakAocGovernanceDecisionSummary,
  createPMFreakAocGovernanceRequest,
  createPMFreakAocGovernanceRequestClientConfig,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingMissingEvidenceResponse,
  demoPMFreakAocBillingReadinessActionAttempt,
  evaluatePMFreakAocGovernanceClaimSafety,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const BANNED_PHRASES = [
  "legally blocked",
  "invoice legally invalid",
  "customer acceptance invalid",
  "project non-compliant",
  "contract violated",
];

test("decision summary is safe for allow", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const summary = createPMFreakAocGovernanceDecisionSummary(response);

  assert.equal(summary.decision, "allow");
  assert.equal(summary.severity, "success");
  assert.ok(/do not treat this as proof of production execution/i.test(summary.nextStep));
  for (const phrase of BANNED_PHRASES) {
    assert.ok(!summary.nextStep.toLowerCase().includes(phrase));
  }
});

test("decision summary is safe for require_evidence", async () => {
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const summary = createPMFreakAocGovernanceDecisionSummary(response);

  assert.equal(summary.decision, "require_evidence");
  assert.ok(/missing evidence references/i.test(summary.nextStep));
  for (const phrase of BANNED_PHRASES) {
    assert.ok(!summary.nextStep.toLowerCase().includes(phrase));
  }
});

test("decision summary is safe for deny", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const config = createPMFreakAocGovernanceRequestClientConfig();
  const cancelledAttempt = { ...demoPMFreakAocBillingReadinessActionAttempt(), status: "cancelled" as const };
  const request = createPMFreakAocGovernanceRequest({ actionAttempt: cancelledAttempt });
  const response = await transport.evaluateGovernanceRequest(request, config);

  const summary = createPMFreakAocGovernanceDecisionSummary(response);

  assert.equal(summary.decision, "deny");
  assert.ok(/do not proceed with this attempted action/i.test(summary.nextStep));
  for (const phrase of BANNED_PHRASES) {
    assert.ok(!summary.nextStep.toLowerCase().includes(phrase));
  }

  const claimSafety = evaluatePMFreakAocGovernanceClaimSafety(summary);
  assert.equal(claimSafety.safe, true);
});
