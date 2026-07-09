import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocDecisionInboxDetailViewModel, demoPMFreakAocDecisionInboxRequireEvidenceItem } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("detail view model includes title, subtitle and decision badge", async () => {
  const item = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const detail = createPMFreakAocDecisionInboxDetailViewModel(item);
  assert.ok(detail.title.length > 0);
  assert.ok(detail.subtitle.includes(item.requestId));
  assert.equal(detail.decisionBadge.label, item.decisionLabel);
  assert.equal(detail.decisionBadge.severity, item.decisionSeverity);
  assert.equal(detail.decisionBadge.status, item.decisionStatus);
});

const REQUIRED_SECTIONS = ["decision", "context", "evidence", "approvals", "reasons", "warnings", "errors", "safety"];

test("detail view model includes all required sections", async () => {
  const item = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const detail = createPMFreakAocDecisionInboxDetailViewModel(item);
  const sectionIds = detail.sections.map((section) => section.sectionId);
  for (const sectionId of REQUIRED_SECTIONS) {
    assert.ok(sectionIds.includes(sectionId), `expected section "${sectionId}"`);
  }
});

test("detail view model evidence section reflects missing evidence", async () => {
  const item = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const detail = createPMFreakAocDecisionInboxDetailViewModel(item);
  const evidenceSection = detail.sections.find((section) => section.sectionId === "evidence")!;
  const missingRow = evidenceSection.rows.find((row) => row.label === "Missing evidence")!;
  assert.deepEqual(missingRow.value, item.missingEvidenceIds);
});

test("detail view model does not expose raw metadata or secrets", async () => {
  const item = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const detail = createPMFreakAocDecisionInboxDetailViewModel(item);
  const text = JSON.stringify(detail).toLowerCase();
  assert.ok(!text.includes("metadata"));
  assert.ok(!text.includes("secret"));
  assert.ok(!text.includes("password"));
});

test("detail view model is display-only and includes safe next step", async () => {
  const item = await demoPMFreakAocDecisionInboxRequireEvidenceItem();
  const detail = createPMFreakAocDecisionInboxDetailViewModel(item);
  assert.equal(detail.displayOnly, true);
  assert.equal(detail.safeNextStep, item.safeNextStep);
});
