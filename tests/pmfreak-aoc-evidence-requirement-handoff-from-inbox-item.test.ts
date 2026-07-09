import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem,
  demoPMFreakAocDecisionInboxRequireEvidenceItem,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("builds a handoff package from a decision inbox item, preserving inbox item IDs", async () => {
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem({ inboxItem });
  assert.equal(handoff.inboxItemId, inboxItem.inboxItemId);
  assert.equal(handoff.requestId, inboxItem.requestId);
  assert.equal(handoff.responseId, inboxItem.responseId);
  assert.equal(handoff.clientId, inboxItem.clientId);
  assert.equal(handoff.source, "decision_inbox_item");
});

test("preserves project/action context from the inbox item", async () => {
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem({ inboxItem });
  assert.equal(handoff.projectId, inboxItem.projectId);
  assert.equal(handoff.actionTitle, inboxItem.actionTitle);
});

test("preserves evidence/approval ID arrays from the inbox item", async () => {
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem({ inboxItem });
  assert.deepEqual(handoff.requiredEvidenceIds, inboxItem.requiredEvidenceIds);
  assert.deepEqual(handoff.missingEvidenceIds, inboxItem.missingEvidenceIds);
});

test("forces every capability flag to its safe literal value", async () => {
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem({ inboxItem });
  assert.equal(handoff.handoffOnly, true);
  assert.equal(handoff.taskCreationCapable, false);
  assert.equal(handoff.writebackCapable, false);
});

test("does not mutate its input inbox item", async () => {
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const snapshot = structuredClone(inboxItem);
  createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem({ inboxItem });
  assert.deepEqual(inboxItem, snapshot);
});

test("produces a deterministic handoffId based on the response ID", async () => {
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem({ inboxItem });
  assert.equal(handoff.handoffId, `pmfreak.aoc.evidence.handoff.${inboxItem.responseId}.v1`);
});
