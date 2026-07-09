import test from "node:test";
import assert from "node:assert/strict";

import { createPMFreakAocGateResultDetailPanelViewModel, demoPMFreakAocGovernedActionGateNeedsReviewResult } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const EXPECTED_SECTIONS = ["Gate Result", "AOC Decision", "Action Context", "Requirements", "Reasons", "Trace", "Warnings", "Errors", "Safety"];

test("detail panel includes all required sections", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsReviewResult();
  const panel = createPMFreakAocGateResultDetailPanelViewModel({ result });
  const titles = panel.sections.map((section) => section.title);
  for (const expected of EXPECTED_SECTIONS) {
    assert.ok(titles.includes(expected), `expected section "${expected}" to be present`);
  }
});

test("detail panel does not expose raw secrets or metadata", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsReviewResult();
  const panel = createPMFreakAocGateResultDetailPanelViewModel({ result });
  const text = JSON.stringify(panel).toLowerCase();
  assert.ok(!text.includes("authorization:"));
  assert.ok(!text.includes("bearer "));
  assert.ok(!text.includes("connectionstring"));
  assert.ok(!/[^\s"']+@[^\s"']+\.[a-z]+/.test(JSON.stringify(panel)));
});

test("detail panel is presentation-only", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsReviewResult();
  const panel = createPMFreakAocGateResultDetailPanelViewModel({ result });
  assert.equal(panel.presentationOnly, true);
  assert.equal(panel.kind, "gate_result_detail_panel");
});
