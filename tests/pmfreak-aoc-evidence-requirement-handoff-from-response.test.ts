import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse,
  demoPMFreakAocBillingMissingEvidenceResponse,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("builds a handoff package from a governance response, preserving response IDs", async () => {
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse({ response });
  assert.equal(handoff.responseId, response.responseId);
  assert.equal(handoff.requestId, response.requestId);
  assert.equal(handoff.clientId, response.clientId);
  assert.equal(handoff.source, "governance_response");
});

test("leaves project/action context undefined for a response-only builder", async () => {
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse({ response });
  assert.equal(handoff.projectId, undefined);
  assert.equal(handoff.actionId, undefined);
});

test("preserves evidence/approval ID arrays from the response", async () => {
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse({ response });
  assert.deepEqual(handoff.requiredEvidenceIds, response.requiredEvidenceIds);
  assert.deepEqual(handoff.missingEvidenceIds, response.missingEvidenceIds);
});

test("forces every capability flag to its safe literal value", async () => {
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse({ response });
  assert.equal(handoff.handoffOnly, true);
  assert.equal(handoff.evidenceAttachmentCapable, false);
  assert.equal(handoff.mutationCapable, false);
  assert.equal(handoff.communicationCapable, false);
});

test("does not mutate its input response", async () => {
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const snapshot = structuredClone(response);
  createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse({ response });
  assert.deepEqual(response, snapshot);
});

test("produces a deterministic handoffId based on the response ID", async () => {
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse({ response });
  assert.equal(handoff.handoffId, `pmfreak.aoc.evidence.handoff.${response.responseId}.v1`);
});
