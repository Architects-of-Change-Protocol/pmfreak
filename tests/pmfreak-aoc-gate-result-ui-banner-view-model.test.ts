import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGateResultBannerViewModel,
  demoPMFreakAocGovernedActionGateBlockedResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("banner view model renders passed safely", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const banner = createPMFreakAocGateResultBannerViewModel({ result });
  assert.equal(banner.kind, "gate_result_banner");
  assert.equal(banner.canProceed, true);
  assert.equal(banner.presentationOnly, true);
});

test("banner view model renders blocked safely", async () => {
  const result = await demoPMFreakAocGovernedActionGateBlockedResult();
  const banner = createPMFreakAocGateResultBannerViewModel({ result });
  assert.equal(banner.canProceed, false);
  assert.equal(banner.badge.tone, "danger");
});

test("banner view model renders needs_evidence safely", async () => {
  const result = await demoPMFreakAocGovernedActionGateNeedsEvidenceResult();
  const banner = createPMFreakAocGateResultBannerViewModel({ result });
  assert.equal(banner.canProceed, false);
  assert.equal(banner.badge.label, "Needs Evidence");
});

test("banner for passed says it does not execute the action", async () => {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  const banner = createPMFreakAocGateResultBannerViewModel({ result });
  assert.ok(banner.safetyText.toLowerCase().includes("does not execute the action"));
});
