import test from "node:test";
import assert from "node:assert/strict";

import {
  demoPMFreakAocEvidenceRequirementBillingReviewRequiredItem,
  demoPMFreakAocEvidenceRequirementChecklist,
  demoPMFreakAocEvidenceRequirementContractReviewRequiredItem,
  demoPMFreakAocEvidenceRequirementCustomerAcceptanceMissingItem,
  demoPMFreakAocEvidenceRequirementExecutiveApprovalRequiredItem,
  demoPMFreakAocEvidenceRequirementHandoffBillingReview,
  demoPMFreakAocEvidenceRequirementHandoffContractReview,
  demoPMFreakAocEvidenceRequirementHandoffDetailViewModel,
  demoPMFreakAocEvidenceRequirementHandoffEmptyState,
  demoPMFreakAocEvidenceRequirementHandoffError,
  demoPMFreakAocEvidenceRequirementHandoffErrorState,
  demoPMFreakAocEvidenceRequirementHandoffExecutiveApproval,
  demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance,
  demoPMFreakAocEvidenceRequirementHandoffNoEvidenceRequired,
  demoPMFreakAocEvidenceRequirementHandoffPmApproval,
  demoPMFreakAocEvidenceRequirementHandoffSecurityReview,
  demoPMFreakAocEvidenceRequirementHandoffSummary,
  demoPMFreakAocEvidenceRequirementPmApprovalRequiredItem,
  demoPMFreakAocEvidenceRequirementReviewPacket,
  demoPMFreakAocEvidenceRequirementSecurityReviewRequiredItem,
  evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("missing customer acceptance handoff fixture has a customer_acceptance item", async () => {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance();
  assert.ok(handoff.requirementItems.some((item) => item.requirementType === "customer_acceptance" && item.status === "missing"));
});

test("billing review handoff fixture has a billing_review item", async () => {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffBillingReview();
  assert.ok(handoff.requirementItems.some((item) => item.requirementType === "billing_review"));
});

test("contract review handoff fixture has a contract_review item", async () => {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffContractReview();
  assert.ok(handoff.requirementItems.some((item) => item.requirementType === "contract_review"));
});

test("security review handoff fixture has a security_review item", async () => {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffSecurityReview();
  assert.ok(handoff.requirementItems.some((item) => item.requirementType === "security_review"));
});

test("pm approval handoff fixture has a pm_approval item", async () => {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffPmApproval();
  assert.ok(handoff.requirementItems.some((item) => item.requirementType === "pm_approval"));
});

test("executive approval handoff fixture has an executive_approval item", async () => {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffExecutiveApproval();
  assert.ok(handoff.requirementItems.some((item) => item.requirementType === "executive_approval"));
});

test("no evidence required handoff fixture is a valid handoff package", async () => {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffNoEvidenceRequired();
  assert.equal(handoff.handoffOnly, true);
});

test("error fixture returns a safe error state", () => {
  const state = demoPMFreakAocEvidenceRequirementHandoffError();
  assert.equal(state.kind, "evidence_requirement_handoff_error");
  assert.equal(state.safe, true);
});

test("error state fixture returns a safe error state", () => {
  const state = demoPMFreakAocEvidenceRequirementHandoffErrorState();
  assert.equal(state.kind, "evidence_requirement_handoff_error");
});

test("item fixtures produce the expected requirement type", () => {
  assert.equal(demoPMFreakAocEvidenceRequirementCustomerAcceptanceMissingItem().requirementType, "customer_acceptance");
  assert.equal(demoPMFreakAocEvidenceRequirementBillingReviewRequiredItem().requirementType, "billing_review");
  assert.equal(demoPMFreakAocEvidenceRequirementContractReviewRequiredItem().requirementType, "contract_review");
  assert.equal(demoPMFreakAocEvidenceRequirementSecurityReviewRequiredItem().requirementType, "security_review");
  assert.equal(demoPMFreakAocEvidenceRequirementPmApprovalRequiredItem().requirementType, "pm_approval");
  assert.equal(demoPMFreakAocEvidenceRequirementExecutiveApprovalRequiredItem().requirementType, "executive_approval");
});

test("checklist/review-packet/detail/summary fixtures build successfully", async () => {
  const checklist = await demoPMFreakAocEvidenceRequirementChecklist();
  assert.equal(checklist.kind, "evidence_requirement_checklist");

  const reviewPacket = await demoPMFreakAocEvidenceRequirementReviewPacket();
  assert.ok(reviewPacket.packetId.length > 0);

  const detail = await demoPMFreakAocEvidenceRequirementHandoffDetailViewModel();
  assert.equal(detail.kind, "evidence_requirement_handoff_detail");

  const summary = await demoPMFreakAocEvidenceRequirementHandoffSummary();
  assert.ok(summary.totalHandoffs > 0);
});

test("empty state fixture is safe", () => {
  const state = demoPMFreakAocEvidenceRequirementHandoffEmptyState();
  assert.equal(state.kind, "evidence_requirement_handoff_empty");
});

test("fixtures are deterministic when called twice", async () => {
  const first = await demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance();
  const second = await demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance();
  assert.deepEqual(first, second);
});

const REAL_LOOKING_EMAIL_PATTERN = /[a-z0-9._%+-]+@(?!example\.com)[a-z0-9.-]+\.[a-z]{2,}/i;
const REAL_LOOKING_DATASYS_ID_PATTERN = /datasys/i;

test("fixtures contain no real-looking secrets, emails, or Datasys-style IDs", async () => {
  const handoff = await demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance();
  const text = JSON.stringify(handoff);
  assert.ok(!REAL_LOOKING_EMAIL_PATTERN.test(text));
  assert.ok(!REAL_LOOKING_DATASYS_ID_PATTERN.test(text));
});

test("every fixture handoff package passes its own claim-safety check", async () => {
  const handoffs = await Promise.all([
    demoPMFreakAocEvidenceRequirementHandoffMissingCustomerAcceptance(),
    demoPMFreakAocEvidenceRequirementHandoffBillingReview(),
    demoPMFreakAocEvidenceRequirementHandoffContractReview(),
    demoPMFreakAocEvidenceRequirementHandoffSecurityReview(),
    demoPMFreakAocEvidenceRequirementHandoffPmApproval(),
    demoPMFreakAocEvidenceRequirementHandoffExecutiveApproval(),
    demoPMFreakAocEvidenceRequirementHandoffNoEvidenceRequired(),
  ]);
  for (const handoff of handoffs) {
    const result = evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety(handoff);
    assert.equal(result.safe, true, `expected handoff ${handoff.handoffId} to be claim-safe, found: ${result.unsafePhrases.join(", ")}`);
  }
});
