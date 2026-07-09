import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocBillingMissingEvidenceResponse,
  demoPMFreakAocDecisionInboxRequireEvidenceItem,
  demoPMFreakAocGateResultUINeedsEvidenceDisplayModel,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  normalizePMFreakAocEvidenceRequirementHandoffContext,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("context normalizer prefers gateResult over other sources for scalar fields", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const context = normalizePMFreakAocEvidenceRequirementHandoffContext({ gateResult, inboxItem });
  assert.equal(context.clientId, gateResult.clientId);
  assert.equal(context.projectId, gateResult.projectId);
  assert.equal(context.gateResultId, gateResult.gateResultId);
});

test("context normalizer falls back to inboxItem when gateResult is absent", async () => {
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const context = normalizePMFreakAocEvidenceRequirementHandoffContext({ inboxItem });
  assert.equal(context.clientId, inboxItem.clientId);
  assert.equal(context.inboxItemId, inboxItem.inboxItemId);
});

test("context normalizer falls back to response when gateResult and inboxItem are absent", async () => {
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const context = normalizePMFreakAocEvidenceRequirementHandoffContext({ response });
  assert.equal(context.clientId, response.clientId);
  assert.equal(context.responseId, response.responseId);
  assert.equal(context.projectId, undefined);
});

test("context normalizer sources evidence/approval arrays from displayModel.requirementList when it is the only input", async () => {
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();
  const context = normalizePMFreakAocEvidenceRequirementHandoffContext({ displayModel });
  assert.deepEqual(context.requiredEvidenceIds, displayModel.requirementList.requiredEvidenceIds);
  assert.deepEqual(context.missingEvidenceIds, displayModel.requirementList.missingEvidenceIds);
  assert.equal(context.displayModelId, displayModel.displayModelId);
  assert.equal(context.projectId, undefined);
});

test("context normalizer dedupes evidence/approval ID arrays across sources", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const context = normalizePMFreakAocEvidenceRequirementHandoffContext({ gateResult, response: undefined });
  const uniqueRequired = new Set(context.requiredEvidenceIds);
  assert.equal(uniqueRequired.size, context.requiredEvidenceIds.length);
});

test("context normalizer does not mutate its inputs", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const snapshot = structuredClone(gateResult);
  normalizePMFreakAocEvidenceRequirementHandoffContext({ gateResult });
  assert.deepEqual(gateResult, snapshot);
});

test("context normalizer never copies raw metadata fields", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const context = normalizePMFreakAocEvidenceRequirementHandoffContext({ gateResult });
  assert.equal((context as Record<string, unknown>).metadata, undefined);
  assert.equal((context as Record<string, unknown>).raw, undefined);
});
