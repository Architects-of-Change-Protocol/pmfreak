import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocDecisionInboxSafeNextStep, evaluatePMFreakAocDecisionInboxClaimSafety } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const BANNED_PHRASES = ["legally blocked", "invoice legally invalid", "customer acceptance invalid", "contract violated", "compliance failed", "production authorized", "execution approved"];

test("safe next step for allow does not imply execution", () => {
  const step = createPMFreakAocDecisionInboxSafeNextStep({ decision: "allow" as never });
  assert.ok(/does not execute the action/i.test(step));
});

test("safe next step for deny does not claim legal invalidity", () => {
  const step = createPMFreakAocDecisionInboxSafeNextStep({ decision: "deny" as never });
  for (const phrase of BANNED_PHRASES) {
    assert.ok(!step.toLowerCase().includes(phrase));
  }
});

test("safe next step for require_evidence asks for missing evidence", () => {
  const step = createPMFreakAocDecisionInboxSafeNextStep({ decision: "require_evidence" as never });
  assert.ok(/evidence/i.test(step));
});

test("safe next step for require_billing_review asks for billing review", () => {
  const step = createPMFreakAocDecisionInboxSafeNextStep({ decision: "require_billing_review" as never });
  assert.ok(/billing review/i.test(step));
});

test("all safe next steps pass claim-safety", () => {
  const decisions = [
    "allow",
    "deny",
    "hold",
    "require_evidence",
    "require_pm_approval",
    "require_customer_validation",
    "require_billing_review",
    "require_contract_review",
    "require_security_review",
    "require_executive_approval",
  ];
  for (const decision of decisions) {
    const step = createPMFreakAocDecisionInboxSafeNextStep({ decision: decision as never });
    const result = evaluatePMFreakAocDecisionInboxClaimSafety(step);
    assert.equal(result.safe, true, `next step for ${decision} should be claim-safe: ${step}`);
  }
});
