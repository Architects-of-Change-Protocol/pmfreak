import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel,
  demoPMFreakAocGateResultUINeedsEvidenceDisplayModel,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("builds a handoff package from a gate result UI display model", async () => {
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel({ displayModel });
  assert.equal(handoff.displayModelId, displayModel.displayModelId);
  assert.equal(handoff.gateResultId, displayModel.resultId);
  assert.equal(handoff.source, "gate_result_ui_display_model");
});

test("leaves project/action/client context undefined for a display-model-only builder", async () => {
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel({ displayModel });
  assert.equal(handoff.projectId, undefined);
  assert.equal(handoff.actionId, undefined);
  assert.equal(handoff.clientId, undefined);
});

test("sources evidence/approval ID arrays from displayModel.requirementList", async () => {
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel({ displayModel });
  assert.deepEqual(handoff.requiredEvidenceIds, displayModel.requirementList.requiredEvidenceIds);
  assert.deepEqual(handoff.missingEvidenceIds, displayModel.requirementList.missingEvidenceIds);
});

test("still produces a valid, safe handoff package despite reduced context", async () => {
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel({ displayModel });
  assert.equal(handoff.handoffOnly, true);
  assert.ok(handoff.safeSummary.length > 0);
  assert.ok(handoff.safeNextStep.length > 0);
  assert.equal(handoff.checklist.kind, "evidence_requirement_checklist");
  assert.equal(handoff.reviewPacket.source, "gate_result_ui_display_model");
});

test("does not mutate its input display model", async () => {
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();
  const snapshot = structuredClone(displayModel);
  createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel({ displayModel });
  assert.deepEqual(displayModel, snapshot);
});

test("produces a deterministic handoffId based on the resultId", async () => {
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel({ displayModel });
  assert.equal(handoff.handoffId, `pmfreak.aoc.evidence.handoff.${displayModel.resultId}.v1`);
});
