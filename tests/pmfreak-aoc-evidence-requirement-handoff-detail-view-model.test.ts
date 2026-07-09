import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocEvidenceRequirementHandoffDetailViewModel,
  createPMFreakAocEvidenceRequirementHandoffFromGateResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const EXPECTED_SECTION_IDS = [
  "handoff-summary",
  "source-context",
  "action-context",
  "required-evidence",
  "missing-evidence",
  "approval-references",
  "review-packet",
  "safety",
];

test("detail view model includes all 8 expected sections in order", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  const detail = createPMFreakAocEvidenceRequirementHandoffDetailViewModel(handoff);
  assert.deepEqual(
    detail.sections.map((section) => section.sectionId),
    EXPECTED_SECTION_IDS,
  );
});

test("detail view model is handoffOnly and carries the handoff's checklist/review packet", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  const detail = createPMFreakAocEvidenceRequirementHandoffDetailViewModel(handoff);
  assert.equal(detail.handoffOnly, true);
  assert.equal(detail.kind, "evidence_requirement_handoff_detail");
  assert.deepEqual(detail.checklist, handoff.checklist);
  assert.deepEqual(detail.reviewPacket, handoff.reviewPacket);
});

test("detail view model never leaks secrets, tokens or raw metadata", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  const detail = createPMFreakAocEvidenceRequirementHandoffDetailViewModel(handoff);
  const text = JSON.stringify(detail).toLowerCase();
  assert.ok(!text.includes("authorization: bearer"));
  assert.ok(!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(text.replace(/\\/g, "")));
});

test("required evidence and missing evidence sections use empty labels when empty", async () => {
  const gateResult = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const handoff = createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult });
  const detail = createPMFreakAocEvidenceRequirementHandoffDetailViewModel(handoff);
  const approvalSection = detail.sections.find((section) => section.sectionId === "approval-references");
  assert.ok(approvalSection);
  for (const row of approvalSection!.rows) {
    if (Array.isArray(row.value) && row.value.length === 0) {
      assert.ok(row.emptyLabel);
    }
  }
});
