import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocDecisionInboxItemFromGovernanceResponse,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocDecisionInboxMixedItems,
  sortPMFreakAocDecisionInboxItems,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

async function buildTimestampedItems() {
  const response = await demoPMFreakAocBillingAllowedResponse();
  const early = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ response, createdAtLabel: "2026-01-01T00:00:00.000Z", inboxStatus: "new" });
  const late = createPMFreakAocDecisionInboxItemFromGovernanceResponse({ response, createdAtLabel: "2026-06-01T00:00:00.000Z", inboxStatus: "new" });
  return [late, early];
}

test("sorting newest_first is deterministic and orders by createdAtLabel descending", async () => {
  const items = await buildTimestampedItems();
  const sorted = sortPMFreakAocDecisionInboxItems(items, "newest_first");
  assert.equal(sorted[0].createdAtLabel, "2026-06-01T00:00:00.000Z");
  assert.deepEqual(sortPMFreakAocDecisionInboxItems(items, "newest_first"), sorted);
});

test("sorting oldest_first is deterministic and orders by createdAtLabel ascending", async () => {
  const items = await buildTimestampedItems();
  const sorted = sortPMFreakAocDecisionInboxItems(items, "oldest_first");
  assert.equal(sorted[0].createdAtLabel, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(sortPMFreakAocDecisionInboxItems(items, "oldest_first"), sorted);
});

test("sorting severity_desc follows danger/warning/info/success", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const sorted = sortPMFreakAocDecisionInboxItems(items, "severity_desc");
  const rank: Record<string, number> = { danger: 0, warning: 1, info: 2, success: 3 };
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(rank[sorted[i - 1].decisionSeverity] <= rank[sorted[i].decisionSeverity]);
  }
});

test("sorting does not mutate the input array", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const snapshot = [...items];
  sortPMFreakAocDecisionInboxItems(items, "decision_type");
  assert.deepEqual(items, snapshot);
});

test("sorting by decision_type, project, agent and source is deterministic", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  for (const sort of ["decision_type", "project", "agent", "source"] as const) {
    const first = sortPMFreakAocDecisionInboxItems(items, sort);
    const second = sortPMFreakAocDecisionInboxItems(items, sort);
    assert.deepEqual(first, second);
  }
});
