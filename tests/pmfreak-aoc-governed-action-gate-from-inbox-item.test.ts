import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocDecisionInboxAllowItem,
  demoPMFreakAocDecisionInboxDenyItem,
  demoPMFreakAocDecisionInboxRequireBillingReviewItem,
  demoPMFreakAocDecisionInboxRequireEvidenceItem,
  evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("inbox evaluator maps allow item to passed", async () => {
  const item = await demoPMFreakAocDecisionInboxAllowItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
  assert.equal(result.verdict, "passed");
  assert.equal(result.canProceed, true);
});

test("inbox evaluator maps deny item to blocked", async () => {
  const item = await demoPMFreakAocDecisionInboxDenyItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
  assert.equal(result.verdict, "blocked");
  assert.equal(result.canProceed, false);
});

test("inbox evaluator maps require_evidence item to needs_evidence", async () => {
  const item = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
  assert.equal(result.verdict, "needs_evidence");
  assert.equal(result.requiresEvidence, true);
});

test("inbox evaluator maps require_billing_review item to needs_review", async () => {
  const item = await demoPMFreakAocDecisionInboxRequireBillingReviewItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
  assert.equal(result.verdict, "needs_review");
  assert.equal(result.requiresReview, true);
});

test("inbox evaluator preserves inboxItemId", async () => {
  const item = await demoPMFreakAocDecisionInboxAllowItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
  assert.equal(result.inboxItemId, item.inboxItemId);
});

test("inbox evaluator preserves project/action context", async () => {
  const item = await demoPMFreakAocDecisionInboxAllowItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
  assert.equal(result.projectId, item.projectId);
  assert.equal(result.agentId, item.agentId);
  assert.equal(result.actionTitle, item.actionTitle);
});

test("inbox evaluator preserves the item's safe next step", async () => {
  const item = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
  assert.equal(result.safeNextStep, item.safeNextStep);
});

test("inbox evaluator does not mutate its input", async () => {
  const item = await demoPMFreakAocDecisionInboxAllowItem();
  const snapshot = structuredClone(item);
  evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
  assert.deepEqual(item, snapshot);
});

test("inbox evaluator rejects a mismatched requestId safely", async () => {
  const item = await demoPMFreakAocDecisionInboxAllowItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item, expectedRequestId: "demo.pmfreak.gate.mismatched-request-id.v1" });
  assert.equal(result.verdict, "error");
  assert.ok(result.reasonCodes.includes("mismatched_request_id"));
});

test("inbox evaluator rejects a mismatched clientId safely", async () => {
  const item = await demoPMFreakAocDecisionInboxAllowItem();
  const result = evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item, expectedClientId: "demo.pmfreak.gate.mismatched-client-id.v1" });
  assert.equal(result.verdict, "error");
  assert.ok(result.reasonCodes.includes("mismatched_client_id"));
});
