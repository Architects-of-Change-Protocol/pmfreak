import test from "node:test";
import assert from "node:assert/strict";

import { demoPMFreakAocDecisionInboxMixedItems, filterPMFreakAocDecisionInboxItems } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("filter by decision works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { decisions: ["allow" as never] });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((item) => item.decision === "allow"));
});

test("filter by decisionStatus works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { statuses: ["needs_evidence"] });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((item) => item.decisionStatus === "needs_evidence"));
});

test("filter by severity works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { severities: ["danger"] });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((item) => item.decisionSeverity === "danger"));
});

test("filter by category works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { categories: ["evidence"] });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((item) => item.category === "evidence"));
});

test("filter by projectId works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const projectId = items[0].projectId!;
  const filtered = filterPMFreakAocDecisionInboxItems(items, { projectId });
  assert.ok(filtered.every((item) => item.projectId === projectId));
});

test("filter by agentId works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const agentId = items[0].agentId!;
  const filtered = filterPMFreakAocDecisionInboxItems(items, { agentId });
  assert.ok(filtered.every((item) => item.agentId === agentId));
});

test("filter by source works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { source: "local_mock" });
  assert.equal(filtered.length, items.length);
  const empty = filterPMFreakAocDecisionInboxItems(items, { source: "unsupported_remote" });
  assert.equal(empty.length, 0);
});

test("filter hasMissingEvidence works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { hasMissingEvidence: true });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((item) => item.missingEvidenceIds.length > 0));
});

test("filter hasMissingApprovals works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { hasMissingApprovals: true });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((item) => item.missingApprovalIds.length > 0));
});

test("filter hasErrors works", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { hasErrors: true });
  assert.equal(filtered.length, 0);
});

test("filter searchText uses only safe fields", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const filtered = filterPMFreakAocDecisionInboxItems(items, { searchText: "billing" });
  assert.ok(filtered.length > 0);
  for (const item of filtered) {
    const haystack = [item.decisionLabel, item.safeSummary, item.safeNextStep, ...item.reasonCodes, item.actionTitle ?? "", item.projectId ?? "", item.agentId ?? ""]
      .join(" ")
      .toLowerCase();
    assert.ok(haystack.includes("billing"));
  }
});

test("filters do not mutate the input array", async () => {
  const items = await demoPMFreakAocDecisionInboxMixedItems();
  const snapshot = structuredClone(items);
  filterPMFreakAocDecisionInboxItems(items, { decisions: ["allow" as never] });
  assert.deepEqual(items, snapshot);
});
