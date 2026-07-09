import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocEvidenceRequirementHandoffFromGateResult,
  demoPMFreakAocGovernedActionGateNeedsApprovalResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  summarizePMFreakAocEvidenceRequirementHandoffs,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("summary counts total handoffs and requirement items correctly", async () => {
  const gateResultA = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const gateResultB = await demoPMFreakAocGovernedActionGateNeedsApprovalResult();
  const handoffA = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult: gateResultA });
  const handoffB = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult: gateResultB });
  const summary = summarizePMFreakAocEvidenceRequirementHandoffs([handoffA, handoffB]);

  assert.equal(summary.totalHandoffs, 2);
  assert.equal(summary.totalRequirementItems, handoffA.requirementItems.length + handoffB.requirementItems.length);
  assert.equal(summary.handoffOnly, true);
});

test("summary groups by requirement type, status, priority and source", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  const summary = summarizePMFreakAocEvidenceRequirementHandoffs([handoff]);

  assert.equal(summary.bySource.gate_result, 1);
  for (const item of handoff.requirementItems) {
    assert.ok((summary.byRequirementType[item.requirementType] ?? 0) >= 1);
    assert.ok((summary.byStatus[item.status] ?? 0) >= 1);
    assert.ok((summary.byPriority[item.priority] ?? 0) >= 1);
  }
});

test("summary priority counters sum to totalRequirementItems", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  const summary = summarizePMFreakAocEvidenceRequirementHandoffs([handoff]);
  assert.equal(summary.criticalCount + summary.highCount + summary.mediumCount + summary.lowCount, summary.totalRequirementItems);
});

test("summary does not mutate its input", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  const snapshot = structuredClone(handoff);
  summarizePMFreakAocEvidenceRequirementHandoffs([handoff]);
  assert.deepEqual(handoff, snapshot);
});

test("summary of an empty list is all zeroes", () => {
  const summary = summarizePMFreakAocEvidenceRequirementHandoffs([]);
  assert.equal(summary.totalHandoffs, 0);
  assert.equal(summary.totalRequirementItems, 0);
  assert.equal(summary.criticalCount, 0);
});
