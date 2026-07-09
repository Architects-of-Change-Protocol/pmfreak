import test from "node:test";
import assert from "node:assert/strict";

import { mapPMFreakAocEvidenceRequirementPriority } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("missing customer_acceptance is critical", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "customer_acceptance", status: "missing" }), "critical");
});

test("missing billing_review is critical", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "billing_review", status: "missing" }), "critical");
});

test("missing security_review is high", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "security_review", status: "missing" }), "high");
});

test("missing contract_review is high", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "contract_review", status: "missing" }), "high");
});

test("missing pm_approval is high", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "pm_approval", status: "missing" }), "high");
});

test("missing executive_approval is high", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "executive_approval", status: "missing" }), "high");
});

test("missing unknown is medium", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "unknown", status: "missing" }), "medium");
});

test("missing risk_review (unlisted missing type) falls back to medium", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "risk_review", status: "missing" }), "medium");
});

test("required (not missing) is medium", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "customer_acceptance", status: "required" }), "medium");
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "unknown", status: "required" }), "medium");
});

test("available_reference is low", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "customer_acceptance", status: "available_reference" }), "low");
});

test("not_applicable is low", () => {
  assert.equal(mapPMFreakAocEvidenceRequirementPriority({ requirementType: "customer_acceptance", status: "not_applicable" }), "low");
});

test("priority mapping is deterministic", () => {
  const input = { requirementType: "billing_review" as const, status: "missing" as const };
  assert.equal(mapPMFreakAocEvidenceRequirementPriority(input), mapPMFreakAocEvidenceRequirementPriority(input));
});
