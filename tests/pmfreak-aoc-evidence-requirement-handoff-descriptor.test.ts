import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
  createPMFreakAocEvidenceRequirementHandoffDescriptor,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("descriptor carries the feature ID", () => {
  const descriptor = createPMFreakAocEvidenceRequirementHandoffDescriptor();
  assert.equal(descriptor.featureId, PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID);
  assert.equal(descriptor.featureId, "pmfreak.integration.aoc.evidence_requirement_handoff.v1");
});

test("descriptor is structurally handoff-only", () => {
  const descriptor = createPMFreakAocEvidenceRequirementHandoffDescriptor();
  assert.equal(descriptor.handoffOnly, true);
  assert.equal(descriptor.evidenceAttachmentCapable, false);
  assert.equal(descriptor.taskCreationCapable, false);
  assert.equal(descriptor.actionExecutionCapable, false);
  assert.equal(descriptor.productionMutationCapable, false);
  assert.equal(descriptor.decisionWritebackCapable, false);
  assert.equal(descriptor.invoiceCreationCapable, false);
  assert.equal(descriptor.communicationCapable, false);
  assert.equal(descriptor.legalCertificationCapable, false);
  assert.equal(descriptor.complianceCertificationCapable, false);
  assert.equal(descriptor.customerAcceptanceCertificationCapable, false);
});

test("descriptor carries capabilities, forbidden operations, safe labels and disclaimers", () => {
  const descriptor = createPMFreakAocEvidenceRequirementHandoffDescriptor();
  assert.ok(descriptor.capabilities.includes("create_handoff_package"));
  assert.ok(descriptor.forbiddenOperations.includes("attach_evidence"));
  assert.ok(descriptor.safeLabels.includes("Handoff only"));
  assert.ok(descriptor.disclaimers.some((d) => d.includes("does not attach evidence")));
});
