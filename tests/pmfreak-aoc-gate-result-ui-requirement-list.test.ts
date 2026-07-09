import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateRequirementListViewModel, demoPMFreakAocGovernedActionGateNeedsEvidenceResult } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("requirement list includes required and missing evidence/approval IDs", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const list = createPMFreakAocGateRequirementListViewModel(result);
  assert.deepEqual(list.requiredEvidenceIds, result.requiredEvidenceIds);
  assert.deepEqual(list.requiredApprovalIds, result.requiredApprovalIds);
  assert.deepEqual(list.missingEvidenceIds, result.missingEvidenceIds);
  assert.deepEqual(list.missingApprovalIds, result.missingApprovalIds);
});

test("requirement list does not create evidence or approvals", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const list = createPMFreakAocGateRequirementListViewModel(result);
  assert.equal(list.presentationOnly, true);
  assert.equal(list.kind, "gate_requirement_list");
  for (const item of list.items) {
    assert.ok(item.status === "required" || item.status === "missing");
  }
});
