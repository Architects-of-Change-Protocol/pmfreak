import test from "node:test";
import assert from "node:assert/strict";

import { extractPMFreakAocEvidenceRequirementReferences } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("extractor creates a required evidence item", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: ["evidence.demo.billing-review.required"],
    source: "gate_result",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "required");
  assert.equal(items[0].source, "gate_result");
});

test("extractor creates a missing evidence item", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    missingEvidenceIds: ["evidence.demo.customer-acceptance.missing"],
    source: "gate_result",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "missing");
  assert.equal(items[0].requirementType, "customer_acceptance");
});

test("extractor creates required and missing approval items", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    requiredApprovalIds: ["approval.demo.pm.required"],
    missingApprovalIds: ["approval.demo.executive.required"],
    source: "gate_result",
  });
  assert.equal(items.length, 2);
  assert.ok(items.some((item) => item.referenceId === "approval.demo.pm.required" && item.status === "required"));
  assert.ok(items.some((item) => item.referenceId === "approval.demo.executive.required" && item.status === "missing"));
});

test("extractor dedupes an ID present in both required and missing arrays: missing wins", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: ["evidence.demo.customer-acceptance.missing"],
    missingEvidenceIds: ["evidence.demo.customer-acceptance.missing"],
    source: "gate_result",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "missing");
});

test("extractor produces deterministic requirement item IDs", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: ["evidence.demo.billing-review.required"],
    source: "gate_result",
  });
  assert.equal(items[0].requirementItemId, "pmfreak.aoc.evidence.requirement.evidence.demo.billing-review.required.v1");
});

test("extractor sets all capability flags false on every item", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: ["evidence.demo.billing-review.required"],
    requiredApprovalIds: ["approval.demo.pm.required"],
    source: "gate_result",
  });
  for (const item of items) {
    assert.equal(item.attachmentCapable, false);
    assert.equal(item.uploadCapable, false);
    assert.equal(item.taskCreationCapable, false);
    assert.equal(item.mutationCapable, false);
    assert.equal(item.communicationCapable, false);
  }
});

test("extractor does not mutate its input arrays", () => {
  const requiredEvidenceIds = ["evidence.demo.billing-review.required"];
  const missingEvidenceIds: string[] = [];
  extractPMFreakAocEvidenceRequirementReferences({ requiredEvidenceIds, missingEvidenceIds, source: "gate_result" });
  assert.deepEqual(requiredEvidenceIds, ["evidence.demo.billing-review.required"]);
  assert.deepEqual(missingEvidenceIds, []);
});

test("extractor populates reasonCodes and a non-empty safeNextStep per item", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    missingEvidenceIds: ["evidence.demo.customer-acceptance.missing"],
    reasonCodes: ["aoc_requires_evidence"],
    source: "gate_result",
  });
  assert.deepEqual(items[0].reasonCodes, ["aoc_requires_evidence"]);
  assert.ok(items[0].safeNextStep.length > 0);
});

test("extractor assigns priority via the priority map", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({
    missingEvidenceIds: ["evidence.demo.customer-acceptance.missing"],
    source: "gate_result",
  });
  assert.equal(items[0].priority, "critical");
});

test("extractor returns an empty array for empty input", () => {
  const items = extractPMFreakAocEvidenceRequirementReferences({ source: "gate_result" });
  assert.deepEqual(items, []);
});
