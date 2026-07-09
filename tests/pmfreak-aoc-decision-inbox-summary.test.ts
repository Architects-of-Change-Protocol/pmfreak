import test from "node:test";
import assert from "node:assert/strict";

import { demoPMFreakAocDecisionInboxMixedItems, demoPMFreakAocDecisionInboxWithErrors, demoPMFreakAocDecisionInboxWithWarnings, summarizePMFreakAocDecisionInboxItems } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("summary counts total", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const summary = summarizePMFreakAocDecisionInboxItems(items);
  assert.equal(summary.total, items.length);
  assert.equal(summary.displayOnly, true);
});

test("summary counts allowed, blocked and held", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const summary = summarizePMFreakAocDecisionInboxItems(items);
  assert.equal(summary.allowedCount, items.filter((item) => item.decisionStatus === "allowed").length);
  assert.equal(summary.blockedCount, items.filter((item) => item.decisionStatus === "blocked").length);
  assert.equal(summary.heldCount, items.filter((item) => item.decisionStatus === "held").length);
  assert.ok(summary.allowedCount > 0);
  assert.ok(summary.blockedCount > 0);
  assert.ok(summary.heldCount > 0);
});

test("summary counts needs evidence, needs approvals and review requirements", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const summary = summarizePMFreakAocDecisionInboxItems(items);
  assert.equal(summary.needsEvidenceCount, items.filter((item) => item.decisionStatus === "needs_evidence").length);
  assert.ok(summary.needsApprovalCount > 0);
  assert.equal(summary.needsBillingReviewCount, items.filter((item) => item.decisionStatus === "needs_billing_review").length);
  assert.equal(summary.needsContractReviewCount, items.filter((item) => item.decisionStatus === "needs_contract_review").length);
  assert.equal(summary.needsSecurityReviewCount, items.filter((item) => item.decisionStatus === "needs_security_review").length);
});

test("summary counts errors and warnings", async () => {
  const errorItems = await demoPMFreakAocDecisionInboxWithErrors();
  const errorSummary = summarizePMFreakAocDecisionInboxItems(errorItems);
  assert.equal(errorSummary.errorCount, 1);

  const warningItems = await demoPMFreakAocDecisionInboxWithWarnings();
  const warningSummary = summarizePMFreakAocDecisionInboxItems(warningItems);
  assert.equal(warningSummary.warningCount, 1);
});

test("summary breakdowns sum to the total", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const summary = summarizePMFreakAocDecisionInboxItems(items);
  const sumOf = (record: Record<string, number>) => Object.values(record).reduce((a, b) => a + b, 0);
  assert.equal(sumOf(summary.byDecision), summary.total);
  assert.equal(sumOf(summary.byDecisionStatus), summary.total);
  assert.equal(sumOf(summary.bySeverity), summary.total);
  assert.equal(sumOf(summary.byCategory), summary.total);
  assert.equal(sumOf(summary.bySource), summary.total);
});

test("summary does not mutate the input array", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const snapshot = structuredClone(items);
  summarizePMFreakAocDecisionInboxItems(items);
  assert.deepEqual(items, snapshot);
});
