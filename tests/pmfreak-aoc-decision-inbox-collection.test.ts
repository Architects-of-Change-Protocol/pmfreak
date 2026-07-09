import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocDecisionInbox, demoPMFreakAocDecisionInboxMixedItems } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("create inbox limits to maxItems", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const inbox = createPMFreakAocDecisionInbox({ items, config: { maxItems: 2 } });
  assert.equal(inbox.items.length, 2);
});

test("create inbox sorts by config defaultSort", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const inbox = createPMFreakAocDecisionInbox({ items, config: { defaultSort: "decision_type" } });
  const decisions = inbox.items.map((item) => item.decision);
  const sorted = [...decisions].sort();
  assert.deepEqual(decisions, sorted);
});

test("create inbox creates a summary matching its items", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const inbox = createPMFreakAocDecisionInbox({ items });
  assert.equal(inbox.summary.total, inbox.items.length);
});

test("create inbox forces display-only capability flags", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const inbox = createPMFreakAocDecisionInbox({ items });
  assert.equal(inbox.displayOnly, true);
  assert.equal(inbox.actionExecutionCapable, false);
  assert.equal(inbox.mutationCapable, false);
  assert.equal(inbox.writebackCapable, false);
  assert.equal(inbox.enforcementCapable, false);
});

test("create inbox does not mutate the input items array", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const snapshot = [...items];
  createPMFreakAocDecisionInbox({ items });
  assert.deepEqual(items, snapshot);
});
