import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocBillingReadinessActionAttempt,
  evaluatePMFreakAocGovernanceClaimSafety,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("action attempt model represents a proposed action only, never an authorization", () => {
  const attempt = demoPMFreakAocBillingReadinessActionAttempt();

  assert.equal(typeof attempt.actionAttemptId, "string");
  assert.equal(typeof attempt.agentId, "string");
  assert.equal(typeof attempt.projectId, "string");
  assert.equal(typeof attempt.actionId, "string");
  assert.ok(
    ["draft", "proposed", "pending_aoc_governance", "aoc_decision_received", "cancelled"].includes(attempt.status),
  );

  const result = evaluatePMFreakAocGovernanceClaimSafety(attempt);
  assert.equal(result.safe, true);
});

test("action attempt has no field claiming the action was executed, allowed, or legally authorized", () => {
  const attempt = demoPMFreakAocBillingReadinessActionAttempt();
  const keys = Object.keys(attempt);

  for (const forbiddenKey of ["executed", "allowed", "legallyAuthorized", "invoiceValid", "customerAcceptanceCertified"]) {
    assert.ok(!keys.includes(forbiddenKey), `action attempt must not carry a "${forbiddenKey}" field`);
  }
});
