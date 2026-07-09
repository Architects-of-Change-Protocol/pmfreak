import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGateResultBlockerViewModel,
  demoPMFreakAocGovernedActionGateBlockedResult,
  demoPMFreakAocGovernedActionGateErrorResult,
  demoPMFreakAocGovernedActionGateHeldResult,
  demoPMFreakAocGovernedActionGateNeedsApprovalResult,
  demoPMFreakAocGovernedActionGateNeedsEvidenceResult,
  demoPMFreakAocGovernedActionGateNeedsReviewResult,
  demoPMFreakAocGovernedActionGatePassedResult,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("blocker view model is hidden for passed", async () => {
  const blocker = createPMFreakAocGateResultBlockerViewModel(await demoPMFreakAocGovernedActionGatePassedResult());
  assert.equal(blocker.visible, false);
});

test("blocker view model is visible for blocked", async () => {
  const blocker = createPMFreakAocGateResultBlockerViewModel(await demoPMFreakAocGovernedActionGateBlockedResult());
  assert.equal(blocker.visible, true);
});

test("blocker view model is visible for held", async () => {
  const blocker = createPMFreakAocGateResultBlockerViewModel(await demoPMFreakAocGovernedActionGateHeldResult());
  assert.equal(blocker.visible, true);
});

test("blocker view model is visible for needs_evidence", async () => {
  const blocker = createPMFreakAocGateResultBlockerViewModel(await demoPMFreakAocGovernedActionGateNeedsEvidenceResult());
  assert.equal(blocker.visible, true);
});

test("blocker view model is visible for needs_approval", async () => {
  const blocker = createPMFreakAocGateResultBlockerViewModel(await demoPMFreakAocGovernedActionGateNeedsApprovalResult());
  assert.equal(blocker.visible, true);
});

test("blocker view model is visible for needs_review", async () => {
  const blocker = createPMFreakAocGateResultBlockerViewModel(await demoPMFreakAocGovernedActionGateNeedsReviewResult());
  assert.equal(blocker.visible, true);
});

test("blocker view model is visible for error", async () => {
  const blocker = createPMFreakAocGateResultBlockerViewModel(await demoPMFreakAocGovernedActionGateErrorResult());
  assert.equal(blocker.visible, true);
});

test("blocker view model does not say legally blocked", async () => {
  const blocker = createPMFreakAocGateResultBlockerViewModel(await demoPMFreakAocGovernedActionGateBlockedResult());
  const text = JSON.stringify(blocker).toLowerCase();
  assert.ok(!text.includes("legally blocked"));
});
