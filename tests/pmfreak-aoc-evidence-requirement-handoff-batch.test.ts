import test from "node:test";
import assert from "node:assert/strict";

import {
  batchCreatePMFreakAocEvidenceRequirementHandoffs,
  demoPMFreakAocBillingMissingEvidenceResponse,
  demoPMFreakAocDecisionInboxRequireEvidenceItem,
  demoPMFreakAocGateResultUINeedsEvidenceDisplayModel,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("batch builds one handoff per input entry", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();

  const handoffs = batchCreatePMFreakAocEvidenceRequirementHandoffs({
    gateResults: [gateResult],
    inboxItems: [inboxItem],
    responses: [response],
    displayModels: [displayModel],
  });

  assert.equal(handoffs.length, 4);
});

test("batch orders gateResults, then inboxItems, then responses, then displayModels", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const inboxItem = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const displayModel = await demoPMFreakAocGateResultUINeedsEvidenceDisplayModel();

  const handoffs = batchCreatePMFreakAocEvidenceRequirementHandoffs({
    gateResults: [gateResult],
    inboxItems: [inboxItem],
    responses: [response],
    displayModels: [displayModel],
  });

  assert.deepEqual(
    handoffs.map((handoff) => handoff.source),
    ["gate_result", "decision_inbox_item", "governance_response", "gate_result_ui_display_model"],
  );
});

test("batch with only some input lists still succeeds", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoffs = batchCreatePMFreakAocEvidenceRequirementHandoffs({ gateResults: [gateResult] });
  assert.equal(handoffs.length, 1);
  assert.equal(handoffs[0].source, "gate_result");
});

test("batch with no inputs returns an empty array", () => {
  assert.deepEqual(batchCreatePMFreakAocEvidenceRequirementHandoffs({}), []);
});

test("batch does not mutate its inputs", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const snapshot = structuredClone(gateResult);
  batchCreatePMFreakAocEvidenceRequirementHandoffs({ gateResults: [gateResult] });
  assert.deepEqual(gateResult, snapshot);
});
