import test from "node:test";
import assert from "node:assert/strict";

import { mapPMFreakAocDecisionToInboxCategory } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("category mapping identifies billing review", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "require_billing_review" as never }), "billing");
});

test("category mapping identifies evidence requirement", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "require_evidence" as never }), "evidence");
});

test("category mapping identifies approval requirement", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "require_pm_approval" as never }), "approval");
});

test("category mapping identifies contract review", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "require_contract_review" as never }), "contract");
});

test("category mapping identifies security review", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "require_security_review" as never }), "security");
});

test("category mapping identifies customer validation", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "require_customer_validation" as never }), "customer_validation");
});

test("category mapping applies deny + risk-related action -> risk", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "deny" as never, actionCategory: "risk" }), "risk");
});

test("category mapping applies hold + communication action -> communication", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "hold" as never, actionCategory: "communication" }), "communication");
});

test("category mapping falls back to a known actionCategory for allow", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "allow" as never, actionCategory: "billing" }), "billing");
});

test("category mapping falls back safely for unknown context", () => {
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "allow" as never }), "project_governance");
  assert.equal(mapPMFreakAocDecisionToInboxCategory({ decision: "deny" as never, actionCategory: "unrecognized_category" }), "project_governance");
});
