import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocEvidenceRequirementHandoffFromGateResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const UNSAFE_QUESTION_SUBSTRINGS = ["legally sufficient", "invoice valid", "certified", "compliant"];

test("review packet has a deterministic packetId based on the gate result ID", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.equal(handoff.reviewPacket.packetId, `pmfreak.aoc.evidence.review-packet.${gateResult.gateResultId}.v1`);
});

test("review packet questions are safe and non-certifying", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.ok(handoff.reviewPacket.reviewQuestions.includes("Which evidence references are missing?"));
  for (const question of handoff.reviewPacket.reviewQuestions) {
    for (const unsafe of UNSAFE_QUESTION_SUBSTRINGS) {
      assert.ok(!question.toLowerCase().includes(unsafe), `"${question}" should not include "${unsafe}"`);
    }
  }
});

test("review packet forces capability flags to safe literal values", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.equal(handoff.reviewPacket.handoffOnly, true);
  assert.equal(handoff.reviewPacket.evidenceAttachmentCapable, false);
  assert.equal(handoff.reviewPacket.taskCreationCapable, false);
  assert.equal(handoff.reviewPacket.approvalCapable, false);
  assert.equal(handoff.reviewPacket.invoiceCreationCapable, false);
  assert.equal(handoff.reviewPacket.communicationCapable, false);
});

test("review packet preserves requirement items and evidence/approval arrays", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.deepEqual(handoff.reviewPacket.requirementItems, handoff.requirementItems);
  assert.deepEqual(handoff.reviewPacket.requiredEvidenceIds, handoff.requiredEvidenceIds);
  assert.deepEqual(handoff.reviewPacket.missingEvidenceIds, handoff.missingEvidenceIds);
});
