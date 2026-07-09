import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateResultCardViewModel, demoPMFreakAocGovernedActionGateNeedsEvidenceResult } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("card view model includes requirement summary", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const card = createPMFreakAocGateResultCardViewModel({ result });
  assert.equal(card.kind, "gate_result_card");
  assert.equal(card.requirementSummary.requiredEvidenceCount, result.requiredEvidenceIds.length);
  assert.equal(card.requirementSummary.missingEvidenceCount, result.missingEvidenceIds.length);
  assert.equal(card.requirementSummary.requiredApprovalCount, result.requiredApprovalIds.length);
  assert.equal(card.requirementSummary.missingApprovalCount, result.missingApprovalIds.length);
});

test("card view model includes warning count", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const card = createPMFreakAocGateResultCardViewModel({ result });
  assert.equal(card.warningCount, result.warnings.length);
});

test("card view model includes error count", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const card = createPMFreakAocGateResultCardViewModel({ result });
  assert.equal(card.errorCount, result.errors.length);
});

test("card view model is presentation-only", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const card = createPMFreakAocGateResultCardViewModel({ result });
  assert.equal(card.presentationOnly, true);
});
