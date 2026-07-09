import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocEvidenceRequirementHandoffFromGateResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("builds a handoff package preserving gate result IDs", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.equal(handoff.gateResultId, gateResult.gateResultId);
  assert.equal(handoff.requestId, gateResult.requestId);
  assert.equal(handoff.responseId, gateResult.responseId);
  assert.equal(handoff.clientId, gateResult.clientId);
  assert.equal(handoff.projectId, gateResult.projectId);
  assert.equal(handoff.actionTitle, gateResult.actionTitle);
});

test("builds a handoff package preserving verdict/decision and evidence/approval arrays", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.equal(handoff.verdict, gateResult.verdict);
  assert.equal(handoff.decision, gateResult.aocDecision);
  assert.deepEqual(handoff.requiredEvidenceIds, gateResult.requiredEvidenceIds);
  assert.deepEqual(handoff.missingEvidenceIds, gateResult.missingEvidenceIds);
  assert.deepEqual(handoff.requiredApprovalIds, gateResult.requiredApprovalIds);
  assert.deepEqual(handoff.missingApprovalIds, gateResult.missingApprovalIds);
});

test("builds requirement items with a customer_acceptance type for the needs-evidence fixture", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.ok(handoff.requirementItems.some((item) => item.requirementType === "customer_acceptance" && item.status === "missing"));
});

test("produces a deterministic handoffId based on the gate result ID", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.equal(handoff.handoffId, `pmfreak.aoc.evidence.handoff.${gateResult.gateResultId}.v1`);
});

test("builds a checklist and review packet", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.equal(handoff.checklist.kind, "evidence_requirement_checklist");
  assert.equal(handoff.checklist.items.length, handoff.requirementItems.length);
  assert.equal(handoff.reviewPacket.source, "gate_result");
});

test("forces every capability flag to its safe literal value", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.equal(handoff.handoffOnly, true);
  assert.equal(handoff.evidenceAttachmentCapable, false);
  assert.equal(handoff.uploadCapable, false);
  assert.equal(handoff.taskCreationCapable, false);
  assert.equal(handoff.actionExecutionCapable, false);
  assert.equal(handoff.mutationCapable, false);
  assert.equal(handoff.writebackCapable, false);
  assert.equal(handoff.invoiceCreationCapable, false);
  assert.equal(handoff.communicationCapable, false);
  assert.equal(handoff.legalCertificationCapable, false);
  assert.equal(handoff.complianceCertificationCapable, false);
  assert.equal(handoff.customerAcceptanceCertificationCapable, false);
});

test("does not mutate its input gate result", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const snapshot = structuredClone(gateResult);
  createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.deepEqual(gateResult, snapshot);
});

test("passed gate result produces a valid handoff with no required missing items necessarily", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGatePassedResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  assert.equal(handoff.source, "gate_result");
  assert.ok(Array.isArray(handoff.requirementItems));
});

test("config.includeApprovalReferences=false excludes approval requirement items", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const approvalIds = new Set([...gateResult.requiredApprovalIds, ...gateResult.missingApprovalIds]);
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult, config: { includeApprovalReferences: false } });
  assert.ok(handoff.requirementItems.every((item) => !approvalIds.has(item.referenceId)));
});
