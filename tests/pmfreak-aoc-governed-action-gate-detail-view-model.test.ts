import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernedActionGateDetailViewModel,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("detail view model includes all required sections", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const detail = createPMFreakAocGovernedActionGateDetailViewModel(result);
  const sectionIds = detail.sections.map((section) => section.sectionId);

  assert.ok(sectionIds.includes("gate-result"));
  assert.ok(sectionIds.includes("aoc-decision"));
  assert.ok(sectionIds.includes("action-context"));
  assert.ok(sectionIds.includes("evidence"));
  assert.ok(sectionIds.includes("approvals"));
  assert.ok(sectionIds.includes("reasons"));
  assert.ok(sectionIds.includes("trace"));
  assert.ok(sectionIds.includes("safety"));
});

test("detail view model carries canProceed and gateOnly", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const detail = createPMFreakAocGovernedActionGateDetailViewModel(result);
  assert.equal(detail.canProceed, result.canProceed);
  assert.equal(detail.gateOnly, true);
});

test("detail view model gate badge reflects verdict and severity", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const detail = createPMFreakAocGovernedActionGateDetailViewModel(result);
  assert.equal(detail.gateBadge.verdict, "needs_evidence");
  assert.equal(detail.gateBadge.severity, result.severity);
});

test("detail view model does not expose raw metadata or secrets", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const detail = createPMFreakAocGovernedActionGateDetailViewModel(result);
  const serialized = JSON.stringify(detail);
  assert.ok(!serialized.includes("metadata"));
  assert.ok(!/secret|password|bearer|authorization/i.test(serialized));
});

test("detail view model evidence section reflects required/missing evidence", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const detail = createPMFreakAocGovernedActionGateDetailViewModel(result);
  const evidenceSection = detail.sections.find((section) => section.sectionId === "evidence");
  assert.ok(evidenceSection);
  const missingRow = evidenceSection?.rows.find((row) => row.label === "Missing evidence");
  assert.deepEqual(missingRow?.value, result.missingEvidenceIds);
});
