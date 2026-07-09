import test from "node:test";
import assert from "node:assert/strict";

import { demoPMFreakAocDecisionInboxMixedItems, groupPMFreakAocDecisionInboxItems } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("grouping by decision works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const groups = groupPMFreakAocDecisionInboxItems(items, "decision");
  assert.equal(
    groups.reduce((sum, group) => sum + group.count, 0),
    items.length,
  );
  for (const group of groups) {
    assert.ok(group.items.every((item) => item.decision === group.groupKey));
  }
});

test("grouping by status works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const groups = groupPMFreakAocDecisionInboxItems(items, "status");
  for (const group of groups) {
    assert.ok(group.items.every((item) => item.decisionStatus === group.groupKey));
  }
});

test("grouping by severity works and orders danger/warning/info/success", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const groups = groupPMFreakAocDecisionInboxItems(items, "severity");
  const order = ["danger", "warning", "info", "success"];
  const seenOrder = groups.map((group) => group.groupKey);
  const filteredOrder = order.filter((key) => seenOrder.includes(key));
  assert.deepEqual(seenOrder, filteredOrder);
});

test("grouping by category works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const groups = groupPMFreakAocDecisionInboxItems(items, "category");
  for (const group of groups) {
    assert.ok(group.items.every((item) => item.category === group.groupKey));
  }
});

test("grouping by project works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const groups = groupPMFreakAocDecisionInboxItems(items, "project");
  for (const group of groups) {
    assert.ok(group.items.every((item) => (item.projectId ?? "unassigned") === group.groupKey));
  }
});

test("grouping by agent works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const groups = groupPMFreakAocDecisionInboxItems(items, "agent");
  assert.ok(groups.length > 1);
  for (const group of groups) {
    assert.ok(group.items.every((item) => (item.agentId ?? "unassigned") === group.groupKey));
  }
});

test("grouping is deterministic", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  assert.deepEqual(groupPMFreakAocDecisionInboxItems(items, "source"), groupPMFreakAocDecisionInboxItems(items, "source"));
});

test("grouping does not mutate the input array", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const snapshot = [...items];
  groupPMFreakAocDecisionInboxItems(items, "decision");
  assert.deepEqual(items, snapshot);
});
