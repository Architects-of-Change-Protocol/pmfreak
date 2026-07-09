import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocEvidenceRequirementChecklistViewModel, extractPMFreakAocEvidenceRequirementReferences } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("checklist has one item per requirement item", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    missingEvidenceIds: ["evidence.demo.customer-acceptance.missing"],
    requiredApprovalIds: ["approval.demo.pm.required"],
    source: "gate_result",
  });
  const checklist = createPMFreakAocEvidenceRequirementChecklistViewModel(items);
  assert.equal(checklist.items.length, items.length);
});

test("checklist items are structurally done:false and actionable:false", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({ missingEvidenceIds: ["evidence.demo.customer-acceptance.missing"], source: "gate_result" });
  const checklist = createPMFreakAocEvidenceRequirementChecklistViewModel(items);
  for (const item of checklist.items) {
    assert.equal(item.done, false);
    assert.equal(item.actionable, false);
  }
});

test("checklist safeInstructions never imply task creation", () => {
  const checklist = createPMFreakAocEvidenceRequirementChecklistViewModel([]);
  for (const instruction of checklist.safeInstructions) {
    assert.ok(!instruction.toLowerCase().includes("create a task"));
    assert.ok(!instruction.toLowerCase().includes("task created"));
  }
});

test("checklist is handoffOnly", () => {
  const checklist = createPMFreakAocEvidenceRequirementChecklistViewModel([]);
  assert.equal(checklist.handoffOnly, true);
  assert.equal(checklist.kind, "evidence_requirement_checklist");
});

test("checklist item IDs are deterministic", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({ requiredEvidenceIds: ["evidence.demo.billing-review.required"], source: "gate_result" });
  const first = createPMFreakAocEvidenceRequirementChecklistViewModel(items);
  const second = createPMFreakAocEvidenceRequirementChecklistViewModel(items);
  assert.deepEqual(first, second);
});
